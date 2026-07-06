'use client';

// Inline prose field for the review view — the SMARTT objective and a block's
// teacher_does / students_do. There is NO suggesting "mode": for a coordinator the
// text is directly editable AT ALL TIMES, edited IN PLACE (the rendered text node is
// the edit surface — a contentEditable, styled identically, so there's no box below
// and zero layout shift). Plain text only; RTL honoured via dir="auto".
//
//   • no provider (editor Review step, non-member view) → the PLAIN text, byte-identical.
//   • a pending `text` suggestion → the tracked-change diff (pre · struck del · ins ·
//     post). A coordinator clicks it to edit the proposal (to_value) in place; a
//     teacher/other member clicks it to focus its pane card.
//   • coordinator, no pending suggestion → the value, directly editable in place.
//
// The plan is NEVER written here — only plan_annotations. `from_value` is pinned to
// the field's stored text at first creation; re-edits move only `to_value`; an edit
// back to the original withdraws it; a click with no change is a no-op.

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { textDiffSegments, type DiffSegments } from '@/lib/review/textDiff';
import { useOptionalAnnotations } from './context';
import { pendingSuggestion } from './finders';
import { A } from './tokens';

export function ProseField({
  anchorType,
  phaseRef,
  field,
  value,
  placeholder,
}: {
  anchorType: 'objective' | 'phase_description';
  phaseRef?: string;
  field?: 'teacher_does' | 'students_do';
  value: string;
  placeholder?: string;
}) {
  const ctx = useOptionalAnnotations();
  const t = useTranslations('review');
  // Only used to swap a pending DIFF into its in-place editor for the coordinator.
  const [editingDiff, setEditingDiff] = useState(false);

  // No provider → plain text, byte-identical (the editor's Review step path).
  if (!ctx) return <>{value || renderPlaceholder(placeholder)}</>;

  const pending = pendingSuggestion(ctx.annotations, { shape: 'text', anchorType, phaseRef, blockRef: field });
  const canEdit = ctx.role === 'coordinator';
  const base = pending?.fromValue ?? value;

  const commit = async (nextRaw: string) => {
    const nt = nextRaw.trim();
    const bt = base.trim();
    if (pending) {
      if (nt === bt) await ctx.remove(pending.id); // reverted → withdraw
      else if (nt === (pending.toValue ?? '').trim()) return; // unchanged
      else await ctx.update(pending.id, nextRaw);
    } else {
      if (nt === bt) return; // no net change → create nothing
      await ctx.create({
        kind: 'suggestion',
        suggestionShape: 'text',
        anchorType,
        phaseRef: phaseRef ?? null,
        blockRef: field ?? null,
        fromValue: base,
        toValue: nextRaw,
        note: t('annotations.author.textNoteDefault'),
      });
    }
  };

  // A member who cannot author: read-only diff (if pending) or plain text.
  if (!canEdit) {
    if (pending) {
      const segs = textDiffSegments(pending.fromValue ?? '', pending.toValue ?? '');
      return <DiffText segs={segs} onClick={() => ctx.setActiveId(pending.id)} />;
    }
    return <>{value || renderPlaceholder(placeholder)}</>;
  }

  // Coordinator + a pending suggestion, not yet editing → show the diff; a click
  // swaps it to the in-place editor seeded with the proposal.
  if (pending && !editingDiff) {
    const segs = textDiffSegments(pending.fromValue ?? '', pending.toValue ?? '');
    return <DiffText segs={segs} title={t('annotations.author.editHint')} onClick={() => setEditingDiff(true)} />;
  }

  // Directly editable in place. Editing the pending proposal seeds `to_value` (caret
  // to end); otherwise the plain value is editable and a native click sets the caret.
  const seed = pending ? pending.toValue ?? '' : value;
  return (
    <InlineEditable
      key={seed}
      initial={seed}
      placeholder={placeholder ?? t('annotations.author.textEmptyHint')}
      caretEnd={editingDiff}
      onCommit={(text) => {
        setEditingDiff(false);
        void commit(text);
      }}
      onCancel={() => setEditingDiff(false)}
    />
  );
}

/** The tracked-change diff, rendered inline (clickable). */
function DiffText({ segs, onClick, title }: { segs: DiffSegments; onClick: () => void; title?: string }) {
  return (
    <span dir="auto" role="button" tabIndex={0} onClick={onClick} title={title} className="cursor-pointer">
      {segs.pre}
      {segs.del ? (
        <span className="line-through" style={{ color: A.fromFg }}>
          {segs.del}
        </span>
      ) : null}
      {segs.ins ? <span style={{ color: A.toFg }}>{segs.ins}</span> : null}
      {segs.post}
    </span>
  );
}

/** A contentEditable span that edits plain text in place. Uncontrolled: `initial` is
 *  rendered as the child ONCE (stable via the caller's `key`), so React never clobbers
 *  the user's edit; the value is read from the DOM on commit. Enter / blur commit,
 *  Escape reverts. Paste is coerced to plain text. dir="auto" for RTL. */
function InlineEditable({
  initial,
  placeholder,
  caretEnd,
  onCommit,
  onCancel,
}: {
  initial: string;
  placeholder: string;
  caretEnd: boolean;
  onCommit: (text: string) => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const cancelled = useRef(false);

  useEffect(() => {
    if (!caretEnd) return;
    const el = ref.current;
    if (!el) return;
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }, [caretEnd]);

  return (
    <span
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      tabIndex={0}
      dir="auto"
      data-placeholder={placeholder}
      className="rounded-[3px] px-[1px] outline-none transition-colors focus:bg-[#F1F7F4]"
      style={{ boxShadow: `inset 0 -1px 0 ${A.pillTealBorder}` }}
      onBlur={() => {
        if (cancelled.current) {
          cancelled.current = false;
          onCancel();
          return;
        }
        onCommit(ref.current?.textContent ?? '');
      }}
      onPaste={(e) => {
        // Plain text only — strip any formatting from the pasted content.
        e.preventDefault();
        const text = e.clipboardData.getData('text/plain');
        document.execCommand('insertText', false, text);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          (e.currentTarget as HTMLElement).blur(); // → onBlur → commit
        } else if (e.key === 'Escape') {
          e.preventDefault();
          cancelled.current = true;
          if (ref.current) ref.current.textContent = initial;
          ref.current?.blur();
        }
      }}
    >
      {initial}
    </span>
  );
}

function renderPlaceholder(placeholder?: string) {
  return placeholder ? <span className="text-text-muted">{placeholder}</span> : null;
}

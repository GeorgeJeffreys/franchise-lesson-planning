'use client';

// The student-worksheet builder for step 3 (Practise): a tiptap rich-text editor
// with a light formatting toolbar and a row of question-type chips that drop a
// ready-made scaffold into the document. The editor's JSON is lifted to the
// parent on every change so the wizard's autosave persists it to
// `lesson_plans.worksheet`.

import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useCallback } from 'react';
import type { JSONContent } from '@tiptap/core';

/** A question-type chip and the HTML scaffold it inserts at the cursor. */
const QUESTION_TYPES: { label: string; html: string }[] = [
  {
    label: 'Multiple choice',
    html: '<p><strong>Q.</strong> Question text…</p><ul><li>Option A</li><li>Option B</li><li>Option C</li></ul>',
  },
  {
    label: 'Short answer',
    html: '<p><strong>Q.</strong> Question text…</p><p>Answer: ______________________________</p>',
  },
  {
    label: 'Fill in the blank',
    html: '<p>Complete the sentence: The ______ is on the table.</p>',
  },
  {
    label: 'True / False',
    html: '<p><strong>Q.</strong> Statement…  <em>( ) True   ( ) False</em></p>',
  },
  {
    label: 'Matching',
    html: '<p><strong>Match the pairs:</strong></p><ol><li>Item 1 — ____</li><li>Item 2 — ____</li><li>Item 3 — ____</li></ol>',
  },
  {
    label: 'Open question',
    html: '<h2>Discuss</h2><p>Write your answer in full sentences…</p>',
  },
];

function ToolbarButton({
  active,
  onClick,
  label,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={
        'inline-flex h-[28px] min-w-[28px] items-center justify-center rounded-[7px] border px-[8px] text-[12.5px] font-semibold ' +
        (active
          ? 'border-teal bg-[#E4F0ED] text-[#186155]'
          : 'border-border-strong bg-surface text-neutral-700 hover:bg-surface-subtle')
      }
    >
      {children}
    </button>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  return (
    <div className="flex flex-wrap items-center gap-[6px] border-b border-[#EFE8DD] bg-surface-subtle px-[12px] py-[9px]">
      <ToolbarButton
        label="Bold"
        active={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        B
      </ToolbarButton>
      <ToolbarButton
        label="Italic"
        active={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <span className="italic">I</span>
      </ToolbarButton>
      <ToolbarButton
        label="Heading"
        active={editor.isActive('heading', { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        H
      </ToolbarButton>
      <span className="mx-[2px] h-[18px] w-px bg-border-strong" />
      <ToolbarButton
        label="Bullet list"
        active={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        • List
      </ToolbarButton>
      <ToolbarButton
        label="Numbered list"
        active={editor.isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        1. List
      </ToolbarButton>
    </div>
  );
}

export function WorksheetBuilder({
  value,
  onChange,
}: {
  /** The stored tiptap document (JSON), or undefined for a fresh worksheet. */
  value: JSONContent | undefined;
  onChange: (doc: JSONContent) => void;
}) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: value ?? '',
    // Avoid an SSR/CSR hydration mismatch — render the editor on the client only.
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'worksheet-prose min-h-[170px] px-[14px] py-[12px]',
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getJSON()),
  });

  const insert = useCallback(
    (html: string) => {
      if (!editor) return;
      editor.chain().focus().insertContent(html).run();
    },
    [editor]
  );

  return (
    <div className="overflow-hidden rounded-[12px] border border-border bg-surface">
      {editor ? <Toolbar editor={editor} /> : null}

      {/* Question-type chips */}
      <div className="flex flex-wrap items-center gap-[6px] border-b border-[#EFE8DD] bg-surface px-[12px] py-[9px]">
        <span className="mr-[2px] text-[11px] font-semibold uppercase tracking-[0.05em] text-text-faint">
          Add
        </span>
        {QUESTION_TYPES.map((q) => (
          <button
            key={q.label}
            type="button"
            onClick={() => insert(q.html)}
            className="rounded-badge border border-[#CFE6E0] bg-[#E4F0ED] px-[9px] py-[4px] text-[11px] font-semibold text-[#186155] hover:bg-[#d8ebe6]"
          >
            + {q.label}
          </button>
        ))}
      </div>

      <EditorContent editor={editor} />
    </div>
  );
}

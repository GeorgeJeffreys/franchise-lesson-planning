'use client';

// The selection bubble: a compact inline-formatting toolbar that floats above any
// non-empty text selection (bold/italic/underline, link, brand colour) plus the
// selection-level "Adjust with AI" action, which opens an inline prompt anchored at
// the selection. Hidden when an image/atom is selected.

import { BubbleMenu } from '@tiptap/react';
import type { Editor } from '@tiptap/core';
import { Bold, Italic, Underline, Link as LinkIcon, Sparkles } from 'lucide-react';
import { useEditorTick } from './useEditorTick';
import { BRAND } from './theme';
import { TBtn, TSep, ColourPicker, toggleLink } from './toolbarControls';

const ICON = 16;

export function BubbleToolbar({
  editor,
  onAdjustAI,
}: {
  editor: Editor | null;
  onAdjustAI: () => void;
}) {
  useEditorTick(editor);
  if (!editor) return null;
  const e = editor;

  return (
    <BubbleMenu
      editor={e}
      className="ws-no-print"
      shouldShow={({ editor: ed, from, to }) => ed.isEditable && from !== to && !ed.isActive('image')}
      tippyOptions={{ duration: 120, maxWidth: 'none' }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          padding: 4,
          background: '#fff',
          border: '1px solid #E7DECF',
          borderRadius: 10,
          boxShadow: '0 10px 26px -12px rgba(40,30,20,0.4)',
        }}
      >
        <TBtn title="Bold" active={e.isActive('bold')} onClick={() => e.chain().focus().toggleBold().run()}>
          <Bold size={ICON} />
        </TBtn>
        <TBtn title="Italic" active={e.isActive('italic')} onClick={() => e.chain().focus().toggleItalic().run()}>
          <Italic size={ICON} />
        </TBtn>
        <TBtn title="Underline" active={e.isActive('underline')} onClick={() => e.chain().focus().toggleUnderline().run()}>
          <Underline size={ICON} />
        </TBtn>
        <TBtn title="Link" active={e.isActive('link')} onClick={() => toggleLink(e)}>
          <LinkIcon size={ICON} />
        </TBtn>
        <ColourPicker editor={e} />
        <TSep />
        <button
          type="button"
          onMouseDown={(ev) => ev.preventDefault()}
          onClick={onAdjustAI}
          title="Adjust the selection with AI"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            height: 30,
            padding: '0 10px',
            borderRadius: 7,
            border: 'none',
            background: BRAND.teal,
            color: '#fff',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <Sparkles size={13} />
          Adjust
        </button>
      </div>
    </BubbleMenu>
  );
}

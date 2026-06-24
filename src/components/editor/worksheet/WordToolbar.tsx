'use client';

// The Word-like formatting toolbar shown at the top of every Free block. It acts
// on the block's tiptap editor (headings, bold/italic/underline, a pink text
// colour, alignment, lists), exposes the image-insert and Generate-with-AI
// actions, and mirrors the mockup's layout exactly. The "size" and table
// controls are visual-only for v1 (StarterKit has no font-size / table schema).

import { useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';

const TEAL = '#1F7A6C';
const TEAL_TEXT = '#186155';
const TEAL_TINT = '#E4F0ED';
const PINK = '#B62A5C';

/** A 30×30 square toolbar button with an active (teal) state. */
function IconButton({
  active,
  onClick,
  title,
  inert,
  children,
}: {
  active?: boolean;
  onClick?: () => void;
  title: string;
  inert?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      onMouseDown={(e) => e.preventDefault()}
      onClick={inert ? undefined : onClick}
      style={{
        width: 30,
        height: 30,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 7,
        border: 'none',
        cursor: 'pointer',
        background: active ? TEAL_TINT : 'transparent',
        color: active ? TEAL_TEXT : '#2A2422',
        font: 'inherit',
      }}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span style={{ width: 1, height: 20, background: '#ECE4D7', margin: '0 3px' }} />;
}

const HEADING_OPTIONS = [
  { label: 'Heading 1', level: 1 as const },
  { label: 'Heading 2', level: 2 as const },
  { label: 'Paragraph', level: 0 as const },
];

function HeadingDropdown({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const current = editor.isActive('heading', { level: 1 })
    ? 'Heading 1'
    : editor.isActive('heading', { level: 2 })
      ? 'Heading 2'
      : 'Paragraph';

  const apply = (level: 0 | 1 | 2) => {
    if (level === 0) editor.chain().focus().setParagraph().run();
    else editor.chain().focus().toggleHeading({ level }).run();
    setOpen(false);
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((o) => !o)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 12.5,
          fontWeight: 500,
          color: '#2A2422',
          background: '#FBF8F3',
          border: '1px solid #E7DECF',
          borderRadius: 7,
          padding: '6px 10px',
          cursor: 'pointer',
          font: 'inherit',
        }}
      >
        {current}
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#A79E94" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open ? (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 5px)',
            left: 0,
            background: '#fff',
            border: '1px solid #E7DECF',
            borderRadius: 9,
            boxShadow: '0 16px 40px -16px rgba(40,30,20,0.5)',
            padding: 5,
            zIndex: 30,
            minWidth: 140,
          }}
        >
          {HEADING_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => apply(opt.level)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                fontSize: 12.5,
                fontWeight: current === opt.label ? 600 : 500,
                color: current === opt.label ? TEAL_TEXT : '#2A2422',
                background: current === opt.label ? TEAL_TINT : 'transparent',
                border: 'none',
                borderRadius: 6,
                padding: '7px 9px',
                cursor: 'pointer',
                font: 'inherit',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function WordToolbar({
  editor,
  onInsertImage,
  onGenerate,
}: {
  editor: Editor;
  onInsertImage: () => void;
  onGenerate: () => void;
}) {
  const colorActive = editor.isActive('textStyle', { color: PINK });

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        flexWrap: 'wrap',
        padding: '8px 12px',
        background: '#fff',
        borderBottom: '1px solid #EFE8DD',
      }}
    >
      <HeadingDropdown editor={editor} />

      <div
        title="Text size (coming soon)"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 12.5,
          fontWeight: 500,
          color: '#2A2422',
          background: '#FBF8F3',
          border: '1px solid #E7DECF',
          borderRadius: 7,
          padding: '6px 10px',
        }}
      >
        17
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#A79E94" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>

      <Divider />

      <IconButton title="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
        <span style={{ fontSize: 14, fontWeight: 800 }}>B</span>
      </IconButton>
      <IconButton title="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <span style={{ fontSize: 14, fontStyle: 'italic' }}>I</span>
      </IconButton>
      <IconButton title="Underline" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <span style={{ fontSize: 14, textDecoration: 'underline' }}>U</span>
      </IconButton>
      <IconButton
        title="Text colour"
        active={colorActive}
        onClick={() =>
          colorActive
            ? editor.chain().focus().unsetColor().run()
            : editor.chain().focus().setColor(PINK).run()
        }
      >
        <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>A</span>
          <span style={{ width: 15, height: 3, background: PINK, borderRadius: 1, marginTop: 1 }} />
        </span>
      </IconButton>

      <Divider />

      <IconButton title="Align left" active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#5C544E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="3" y1="6" x2="15" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="13" y2="18" />
        </svg>
      </IconButton>
      <IconButton title="Align centre" active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#5C544E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="6" y1="6" x2="18" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="6" y1="18" x2="18" y2="18" />
        </svg>
      </IconButton>

      <Divider />

      <IconButton title="Bullet list" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#5C544E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="9" y1="6" x2="20" y2="6" /><line x1="9" y1="12" x2="20" y2="12" /><line x1="9" y1="18" x2="20" y2="18" /><circle cx="4" cy="6" r="1" /><circle cx="4" cy="12" r="1" /><circle cx="4" cy="18" r="1" />
        </svg>
      </IconButton>
      <IconButton title="Numbered list" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#5C544E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="10" y1="6" x2="20" y2="6" /><line x1="10" y1="12" x2="20" y2="12" /><line x1="10" y1="18" x2="20" y2="18" /><path d="M4 6h1v4M4 10h2M6 18H4l2-3H4" />
        </svg>
      </IconButton>

      <Divider />

      <IconButton title="Insert image" onClick={onInsertImage}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#5C544E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="M21 15l-5-5L5 21" />
        </svg>
      </IconButton>
      <IconButton title="Insert table (coming soon)" inert>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#C7BCAE" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="3" y1="15" x2="21" y2="15" /><line x1="9" y1="3" x2="9" y2="21" />
        </svg>
      </IconButton>

      <button
        type="button"
        onClick={onGenerate}
        style={{
          marginLeft: 'auto',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 12,
          fontWeight: 600,
          color: '#fff',
          background: TEAL,
          border: 'none',
          borderRadius: 8,
          padding: '7px 11px',
          cursor: 'pointer',
          font: 'inherit',
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 3l1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6z" />
        </svg>
        Generate with AI
      </button>
    </div>
  );
}

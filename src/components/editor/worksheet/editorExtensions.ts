// The tiptap extension set shared by every Free block's editor and by the
// Markdown→tiptap import. Kept in one place so the editing surface and the
// generated-content parser agree on the schema (headings, lists, underline,
// text colour, alignment, and images).

import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Image from '@tiptap/extension-image';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import TextAlign from '@tiptap/extension-text-align';
import type { AnyExtension } from '@tiptap/core';

/** Build the extension list (a fresh array per editor instance). */
export function worksheetEditorExtensions(): AnyExtension[] {
  return [
    StarterKit,
    Underline,
    TextStyle,
    Color,
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Image.configure({ inline: false, allowBase64: false }),
  ];
}

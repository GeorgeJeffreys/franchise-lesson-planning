// Block indent/outdent for paragraphs and headings (Word/Docs "increase/decrease
// indent"). Adds a bounded `indent` attribute (0..MAX) rendered as left margin, plus
// `indentBlock` / `outdentBlock` commands that shift every block in the selection.
//
// Additive and backward-compatible: docs without the attribute default to indent 0;
// the migration never emits it, and the v3→v2 downgrade keeps it as a harmless
// unknown attribute the legacy schema ignores. List indentation is separate — the
// toolbar routes list selections to sink/lift list-item instead.

import { Extension } from '@tiptap/core';

const STEP_PX = 28;
const MAX_LEVEL = 8;
const INDENT_TYPES = ['paragraph', 'heading'];

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    worksheetIndent: {
      indentBlock: () => ReturnType;
      outdentBlock: () => ReturnType;
    };
  }
}

export const Indent = Extension.create({
  name: 'worksheetIndent',

  addGlobalAttributes() {
    return [
      {
        types: INDENT_TYPES,
        attributes: {
          indent: {
            default: 0,
            parseHTML: (element) => {
              const ml = parseInt((element as HTMLElement).style.marginLeft || '0', 10);
              return ml > 0 ? Math.min(MAX_LEVEL, Math.round(ml / STEP_PX)) : 0;
            },
            renderHTML: (attributes) => {
              const level = Number(attributes.indent) || 0;
              return level > 0 ? { style: `margin-left: ${level * STEP_PX}px` } : {};
            },
          },
        },
      },
    ];
  },

  addCommands() {
    const shift =
      (direction: 1 | -1) =>
      ({ state, tr, dispatch }: { state: import('@tiptap/pm/state').EditorState; tr: import('@tiptap/pm/state').Transaction; dispatch?: (tr: import('@tiptap/pm/state').Transaction) => void }) => {
        const { from, to } = state.selection;
        let changed = false;
        state.doc.nodesBetween(from, to, (node, pos) => {
          if (!INDENT_TYPES.includes(node.type.name)) return;
          const current = Number(node.attrs.indent) || 0;
          const next = Math.max(0, Math.min(MAX_LEVEL, current + direction));
          if (next !== current) {
            tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent: next });
            changed = true;
          }
        });
        if (changed && dispatch) dispatch(tr);
        return changed;
      };

    return {
      indentBlock: () => shift(1),
      outdentBlock: () => shift(-1),
    };
  },
});

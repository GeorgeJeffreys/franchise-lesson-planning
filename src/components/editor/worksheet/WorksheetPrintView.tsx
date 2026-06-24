'use client';

// A static, non-editable render of the worksheet used by the print-preview modal
// (and the @media print output). It reuses the locked MasterFrame and renders
// each block without editing chrome: Free blocks are serialised from their stored
// tiptap doc via `generateHTML` (so the resizable-image width/align styles
// round-trip), and From-bank blocks reuse ResourceBlock in chromeless mode.

import { generateHTML, type JSONContent } from '@tiptap/core';
import type { Worksheet } from '@/types/lesson';
import type { ResourceWithTags } from '@/types/resource';
import { MasterFrame } from './MasterFrame';
import { ResourceBlock } from './ResourceBlock';
import { worksheetEditorExtensions } from './editorExtensions';
import type { WorksheetContext } from './context';

function freeBlockHtml(doc: unknown): string {
  if (!doc) return '';
  try {
    return generateHTML(doc as JSONContent, worksheetEditorExtensions());
  } catch {
    return '';
  }
}

export function WorksheetPrintView({
  ws,
  ctx,
  resolved,
}: {
  ws: Worksheet;
  ctx: WorksheetContext;
  resolved: Record<string, ResourceWithTags>;
}) {
  return (
    <MasterFrame ctx={ctx}>
      {ws.blocks.map((block, i) => {
        if (block.kind === 'free') {
          const html = freeBlockHtml(block.doc);
          return (
            <div
              key={block.id}
              className="worksheet-doc"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        }
        return (
          <ResourceBlock
            key={block.id}
            resource={resolved[block.resourceId] ?? null}
            uploaderName={block.uploaderName}
            index={i}
            onDelete={() => {}}
            chromeless
          />
        );
      })}
    </MasterFrame>
  );
}

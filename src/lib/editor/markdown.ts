// A deliberately small Markdown ↔ HTML/doc converter for the AI generator.
//
// `POST /api/generate-resource` returns "simple markdown" (headings, paragraphs,
// bold/italic, and unordered/ordered lists). Rather than pull in a full Markdown
// dependency, we convert that subset to HTML and let tiptap parse the HTML into
// its own schema (via `editor.commands.setContent`). Anything fancier than the
// subset degrades gracefully to plain paragraphs. `docToMarkdown` is the reverse:
// it serialises a tiptap doc back to the same markdown subset so the builder can
// send a Free block's current content to the generator as the base for a
// stateless "Adjust" refinement.
//
// Note for type-only consumers: JSONContent is imported from @tiptap/core.

import type { JSONContent } from '@tiptap/core';

/** Escape the five HTML-significant characters in raw text. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Apply inline emphasis (bold then italic) to already-escaped text. Only
 * asterisk syntax is honoured — worksheet content routinely contains underscores
 * (fill-in-the-blank runs, snake_case), so treating `_` as emphasis would mangle
 * it. `**bold**` is matched before `*italic*` so the single-asterisk rule does
 * not split a bold run.
 */
function inline(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*?)\*/g, '$1<em>$2</em>');
}

/** Render one block of non-list lines as a paragraph (single <br> between lines). */
function paragraph(lines: string[]): string {
  const html = lines.map((l) => inline(escapeHtml(l.trim()))).join('<br>');
  return `<p>${html}</p>`;
}

/**
 * Convert a simple-markdown string into an HTML fragment tiptap can parse.
 * Supports `#`/`##`/`###` headings, `-`/`*`/`+` bullet lists, `1.` ordered
 * lists, blank-line-separated paragraphs, and **bold** / *italic* inline marks.
 */
export function markdownToHtml(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];

  let para: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushPara = () => {
    if (para.length) {
      out.push(paragraph(para));
      para = [];
    }
  };
  const flushList = () => {
    if (list) {
      const tag = list.ordered ? 'ol' : 'ul';
      const items = list.items.map((i) => `<li>${inline(escapeHtml(i))}</li>`).join('');
      out.push(`<${tag}>${items}</${tag}>`);
      list = null;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/, '');

    if (line.trim() === '') {
      flushPara();
      flushList();
      continue;
    }

    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      flushPara();
      flushList();
      const level = heading[1].length;
      out.push(`<h${level}>${inline(escapeHtml(heading[2].trim()))}</h${level}>`);
      continue;
    }

    const ordered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (ordered) {
      flushPara();
      if (!list || !list.ordered) {
        flushList();
        list = { ordered: true, items: [] };
      }
      list.items.push(ordered[1].trim());
      continue;
    }

    const bullet = /^\s*[-*+]\s+(.*)$/.exec(line);
    if (bullet) {
      flushPara();
      if (!list || list.ordered) {
        flushList();
        list = { ordered: false, items: [] };
      }
      list.items.push(bullet[1].trim());
      continue;
    }

    // Plain text line — part of the current paragraph.
    flushList();
    para.push(line);
  }

  flushPara();
  flushList();
  return out.join('');
}

/** Serialise tiptap inline content (text nodes with bold/italic marks) to markdown. */
function inlineToMarkdown(nodes: JSONContent[] | undefined): string {
  if (!nodes) return '';
  return nodes
    .map((node) => {
      if (node.type === 'hardBreak') return '\n';
      if (node.type !== 'text') return '';
      let text = node.text ?? '';
      const marks = node.marks ?? [];
      // Bold inside italic, mirroring `inline()` above (** then *).
      if (marks.some((m) => m.type === 'bold')) text = `**${text}**`;
      if (marks.some((m) => m.type === 'italic')) text = `*${text}*`;
      return text;
    })
    .join('');
}

/** First paragraph's inline content inside a list item (the subset we emit). */
function listItemInline(item: JSONContent): string {
  const firstBlock = item.content?.[0];
  return inlineToMarkdown(firstBlock?.content);
}

/** Serialise one top-level tiptap block to a markdown string (or '' to skip). */
function blockToMarkdown(node: JSONContent): string {
  switch (node.type) {
    case 'heading': {
      const level = Math.min(3, Math.max(1, Number(node.attrs?.level) || 1));
      return `${'#'.repeat(level)} ${inlineToMarkdown(node.content)}`;
    }
    case 'paragraph':
      return inlineToMarkdown(node.content);
    case 'bulletList':
      return (node.content ?? []).map((li) => `- ${listItemInline(li)}`).join('\n');
    case 'orderedList':
      return (node.content ?? []).map((li, i) => `${i + 1}. ${listItemInline(li)}`).join('\n');
    case 'image':
      // Images don't round-trip into the generator's markdown; the adjust prompt
      // works on text. The teacher's image stays in the editor regardless.
      return '';
    default:
      return inlineToMarkdown(node.content);
  }
}

/**
 * Convert a tiptap/ProseMirror doc into the simple-markdown subset
 * {@link markdownToHtml} consumes — the inverse direction. Used to send a Free
 * block's current content to the resource generator as the base for an adjust.
 */
export function docToMarkdown(doc: JSONContent | null | undefined): string {
  if (!doc?.content) return '';
  return doc.content
    .map(blockToMarkdown)
    .filter((block) => block.trim().length > 0)
    .join('\n\n')
    .trim();
}

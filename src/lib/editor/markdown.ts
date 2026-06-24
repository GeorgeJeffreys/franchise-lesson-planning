// A deliberately small Markdown → HTML converter for the AI generator's output.
//
// `POST /api/generate-resource` returns "simple markdown" (headings, paragraphs,
// bold/italic, and unordered/ordered lists). Rather than pull in a full Markdown
// dependency, we convert that subset to HTML and let tiptap parse the HTML into
// its own schema (via `editor.commands.setContent`). Anything fancier than the
// subset degrades gracefully to plain paragraphs.

/** Escape the five HTML-significant characters in raw text. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Apply inline emphasis (bold then italic) to already-escaped text. */
function inline(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
    .replace(/(^|[^_])_([^_]+)_/g, '$1<em>$2</em>');
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

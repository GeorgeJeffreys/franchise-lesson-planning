// Minimal, dependency-free RFC-4180 CSV parser for the parity harness. The gold-master
// exports carry multi-line quoted fields (Arabic/English LO text with embedded newlines,
// commas and doubled quotes), a UTF-8 BOM, and literal `null` tokens for empty cells —
// all handled here. Returns an array of objects keyed by the header row.

/** Parse CSV text into rows of raw string cells (BOM-stripped). */
function parseRows(text: string): string[][] {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text; // strip BOM
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const n = src.length;

  while (i < n) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === ',') {
      row.push(field);
      field = '';
      i++;
      continue;
    }
    if (c === '\r') {
      // swallow CRLF / lone CR as a row break
      if (src[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i++;
      continue;
    }
    if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i++;
      continue;
    }
    field += c;
    i++;
  }
  // flush trailing field/row (unless the file ended exactly on a newline)
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/**
 * Parse CSV text into records keyed by the header row. Empty cells and the literal
 * token `null` (how the export encodes a SQL NULL) both become `null`.
 */
export function parseCsv(text: string): Record<string, string | null>[] {
  const rows = parseRows(text).filter((r) => !(r.length === 1 && r[0] === '')); // drop blank lines
  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.trim());
  const out: Record<string, string | null>[] = [];
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    const rec: Record<string, string | null> = {};
    for (let c = 0; c < header.length; c++) {
      const raw = cells[c] ?? '';
      rec[header[c]] = raw === '' || raw === 'null' ? null : raw;
    }
    out.push(rec);
  }
  return out;
}

/** Serialize a matrix to RFC-4180 CSV (quotes fields that need it). */
export function toCsv(header: string[], rows: (string | number | boolean | null)[][]): string {
  const esc = (v: string | number | boolean | null): string => {
    const s = v == null ? '' : String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [header.map(esc).join(',')];
  for (const row of rows) lines.push(row.map(esc).join(','));
  return lines.join('\n') + '\n';
}

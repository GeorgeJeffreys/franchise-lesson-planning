import 'server-only';

import * as XLSX from 'xlsx';
import {
  buildLessonKey,
  type CurriculumResource,
  type ParsedCurriculumRow,
} from '@/lib/curriculum/types';

// ── Parsing the curriculum workbook ─────────────────────────────────────────────
//
// The source spreadsheet is hostile: broken `#REF!`/`#VALUE!` formulas, merged
// Year/Month/Week cells that read blank except on the first row of a group, hidden
// helper columns, baseline/eval section rows, and an unreliable lesson identifier.
// So we never trust column POSITION — we locate columns by header text — and we
// forward-fill the grouped cells. One workbook is one subject; the subject code is
// a parameter (it must match subjects.code, e.g. 'english').

/** Spreadsheet error sentinels (and the literal "#N/A") collapse to null. */
const ERROR_RE = /^#(REF|VALUE|N\/?A|NAME|DIV\/?0|NULL|NUM)[!?]?$/i;

/** A logical column we care about, mapped from a header cell. */
type Field =
  | 'year'
  | 'month'
  | 'week'
  | 'period'
  | 'daily_outcome'
  | 'resources'
  | 'taxonomy_id'
  | 'linguistic_skill'
  | 'focus_area'
  | 'theme'
  | 'monthly_knowledge_lo'
  | 'monthly_skills_lo'
  | 'weekly_knowledge_lo'
  | 'weekly_skills_lo';

/** Columns whose value is shared across a merged group and must be filled down. */
const FILL_DOWN: Field[] = [
  'year',
  'month',
  'week',
  'monthly_knowledge_lo',
  'monthly_skills_lo',
  'weekly_knowledge_lo',
  'weekly_skills_lo',
];

function normalizeHeader(raw: unknown): string {
  return String(raw ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Classify a header cell into one of our logical fields, or null if we don't care.
 * Order matters: the compound monthly/weekly outcome columns are tested before the
 * plain Month/Week navigation columns, since their headers also contain "month"/"week".
 */
function classifyHeader(raw: unknown): Field | null {
  const h = normalizeHeader(raw);
  if (!h) return null;

  const has = (...needles: string[]) => needles.every((n) => h.includes(n));

  // Compound outcome columns first.
  if (has('month', 'knowledge')) return 'monthly_knowledge_lo';
  if (has('month', 'skill')) return 'monthly_skills_lo';
  if (has('week', 'knowledge')) return 'weekly_knowledge_lo';
  if (has('week', 'skill')) return 'weekly_skills_lo';

  if (h.includes('linguistic')) return 'linguistic_skill';
  if (h.includes('daily')) return 'daily_outcome';
  if (h.includes('resource')) return 'resources';
  if (h.includes('theme')) return 'theme';
  if (h.includes('focus')) return 'focus_area';
  if (h.includes('lesson') && (h.includes('ident') || h.includes('id') || h.includes('code')))
    return 'taxonomy_id';
  if (h.includes('period')) return 'period';

  // Plain navigation columns last (after the compound ones are claimed).
  if (h === 'year' || h.startsWith('year')) return 'year';
  if (h === 'month' || h.startsWith('month')) return 'month';
  if (h === 'week' || h.startsWith('week')) return 'week';

  return null;
}

/** Trim a cell, collapsing spreadsheet error sentinels and blanks to null. */
function clean(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  if (ERROR_RE.test(s)) return null;
  return s;
}

/** Extract the first integer from a cell (handles "Year 0", "Period 3", "1"). */
function toInt(value: unknown): number | null {
  const s = clean(value);
  if (s == null) return null;
  const m = s.match(/-?\d+/);
  return m ? parseInt(m[0], 10) : null;
}

/** Split a resources cell into [{label, url}]. Bare page refs are label-only. */
export function parseResources(raw: unknown): CurriculumResource[] {
  const s = clean(raw);
  if (s == null) return [];
  const pieces = s
    .split(/[\n;]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const out: CurriculumResource[] = [];
  for (const piece of pieces) {
    const urlMatch = piece.match(/https?:\/\/\S+/);
    if (urlMatch) {
      const url = urlMatch[0].replace(/[)\].,]+$/, '');
      const label = piece.replace(urlMatch[0], '').replace(/[-–—:|]\s*$/, '').trim() || url;
      out.push({ label, url });
    } else {
      out.push({ label: piece });
    }
  }
  return out;
}

/** Read a sheet as an array of rows (each a flat string array), errors as text. */
function sheetToMatrix(sheet: XLSX.WorkSheet): unknown[][] {
  // raw:false → formatted text; error cells become their "#REF!" text, which
  // clean() then nulls. defval:null keeps column positions stable across rows.
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: false,
    defval: null,
    blankrows: false,
  });
}

/** Locate the header row + column map in a matrix, or null if it isn't a content sheet. */
function findHeader(
  matrix: unknown[][],
): { headerRow: number; columns: Map<Field, number> } | null {
  const limit = Math.min(matrix.length, 25);
  for (let r = 0; r < limit; r++) {
    const row = matrix[r] ?? [];
    const columns = new Map<Field, number>();
    for (let c = 0; c < row.length; c++) {
      const field = classifyHeader(row[c]);
      // First column wins for a given field (ignore duplicate/hidden helpers).
      if (field && !columns.has(field)) columns.set(field, c);
    }
    // A real header row identifies the navigation key + the daily outcome.
    if (columns.has('year') && columns.has('month') && columns.has('period')) {
      return { headerRow: r, columns };
    }
  }
  return null;
}

/**
 * Parse a curriculum workbook for one subject into `curriculum_lesson` rows.
 *
 * Resilient by design: locates columns by header text (never position), forward-
 * fills merged Year/Month/Week and the monthly/weekly outcome cells, collapses
 * `#REF!`/`#VALUE!`/`#N/A` to null, and skips baseline/eval/section/blank rows
 * (anything without a valid 1–6 period and a resolved year/month/week).
 *
 * Rows with a null daily_outcome are KEPT (they count as "unresolved" upstream) so
 * the schedule grid stays complete.
 *
 * @throws if no sheet with a recognisable header is found.
 */
export function parseCurriculumWorkbook(
  buffer: Buffer | ArrayBuffer,
  subjectCode: string,
): ParsedCurriculumRow[] {
  const data = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;
  const workbook = XLSX.read(data, { type: 'buffer' });

  let matrix: unknown[][] | null = null;
  let header: { headerRow: number; columns: Map<Field, number> } | null = null;
  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name];
    if (!sheet) continue;
    const m = sheetToMatrix(sheet);
    const h = findHeader(m);
    if (h) {
      matrix = m;
      header = h;
      break;
    }
  }

  if (!matrix || !header) {
    throw new Error(
      'Could not find a curriculum sheet: no header row with Year, Month and Period columns.',
    );
  }

  const { headerRow, columns } = header;
  const at = (row: unknown[], field: Field): unknown =>
    columns.has(field) ? row[columns.get(field)!] : null;

  // Forward-fill state for merged/grouped columns.
  const filled = new Map<Field, string | null>();

  // De-dupe on the natural key within a single file (last row wins).
  const byKey = new Map<string, ParsedCurriculumRow>();

  for (let r = headerRow + 1; r < matrix.length; r++) {
    const row = matrix[r] ?? [];

    // Refresh fill-down state: a non-blank cell starts a new group.
    for (const field of FILL_DOWN) {
      const v = clean(at(row, field));
      if (v != null) filled.set(field, v);
    }

    const year = toInt(filled.get('year') ?? at(row, 'year'));
    const month = filled.get('month') ?? clean(at(row, 'month'));
    const week = toInt(filled.get('week') ?? at(row, 'week'));
    const period = toInt(at(row, 'period'));

    // Skip baseline/eval/section/blank rows: a real lesson needs the full key.
    if (year == null || month == null || week == null || period == null) continue;
    if (period < 1 || period > 6) continue;

    const lessonKey = buildLessonKey(subjectCode, year, month, week, period);
    byKey.set(lessonKey, {
      subject_code: subjectCode,
      year,
      month,
      week,
      period,
      lesson_key: lessonKey,
      daily_outcome: clean(at(row, 'daily_outcome')),
      focus_area: clean(at(row, 'focus_area')),
      linguistic_skill: clean(at(row, 'linguistic_skill')),
      theme: clean(at(row, 'theme')),
      resources: parseResources(at(row, 'resources')),
      taxonomy_id: clean(at(row, 'taxonomy_id')),
      monthly_knowledge_lo: filled.get('monthly_knowledge_lo') ?? clean(at(row, 'monthly_knowledge_lo')),
      monthly_skills_lo: filled.get('monthly_skills_lo') ?? clean(at(row, 'monthly_skills_lo')),
      weekly_knowledge_lo: filled.get('weekly_knowledge_lo') ?? clean(at(row, 'weekly_knowledge_lo')),
      weekly_skills_lo: filled.get('weekly_skills_lo') ?? clean(at(row, 'weekly_skills_lo')),
    });
  }

  return [...byKey.values()];
}

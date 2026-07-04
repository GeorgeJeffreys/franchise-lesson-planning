import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseCsv, toCsv } from './csv';
import { cleanEnglishWeeklyKnowledgeLo, cleanEnglishWeeklySkillsLo } from '../../parse';

// ── Parity harness support: gold-master loading, redaction, English cleanups ──────
//
// The gold master is the live `curriculum_lesson` (active rows) exported per subject.
// The parser is correct iff, per subject, its emitted `lesson_key` set is byte-identical
// to the gold master's. Two tiers:
//   • Committed, content-free `goldmaster-redacted/` (structural cols + per-field
//     non-null booleans) — powers the HARD key-parity gate; safe in git/CI.
//   • Gitignored full-text `goldmaster/` — powers the field-value spot-check; absent in
//     CI, so that tier auto-skips.
//
// IP: the real workbooks and the full CSVs never enter git history (see .gitignore).
// The full CSVs + workbooks resolve from CURRICULUM_FIXTURES_DIR (default
// test/fixtures/curriculum); the redacted set is always read from its committed repo
// path so the gate runs even without the IP fixtures present.

/** The seven in-scope subjects (Awareness has no gold master — out of scope). */
export const SUBJECTS = [
  'english',
  'arabic',
  'maths',
  'professionalism',
  'science',
  'it',
  'yoga',
] as const;
export type Subject = (typeof SUBJECTS)[number];

/** Text fields whose presence the redacted gold master encodes as a boolean. */
export const TEXT_FIELDS = [
  'daily_outcome',
  'weekly_skills_lo',
  'weekly_knowledge_lo',
  'monthly_lo',
  'monthly_skills_lo',
  'monthly_knowledge_lo',
  'grammar_vocabulary',
  'theme',
  'linguistic_skill',
] as const;
export type TextField = (typeof TEXT_FIELDS)[number];

/** Structural columns carried verbatim into the redacted gold master. */
export interface RedactedRow {
  subject_code: string;
  year: number;
  month: string;
  week: number;
  period: number | null;
  lesson_key: string;
  present: Record<TextField, boolean>;
}

const REPO_ROOT = resolve(import.meta.dirname, '../../../../..');

/** The IP fixtures dir (workbooks + full CSVs). Overridable for out-of-tree storage. */
export function fixturesDir(): string {
  return process.env.CURRICULUM_FIXTURES_DIR ?? resolve(REPO_ROOT, 'test/fixtures/curriculum');
}

/** Committed, content-free redacted gold master (always in-repo). */
export function redactedDir(): string {
  return resolve(REPO_ROOT, 'test/fixtures/curriculum/goldmaster-redacted');
}

export function workbookPath(subject: Subject): string {
  return resolve(fixturesDir(), `${subject}.xlsx`);
}
export function fullGoldPath(subject: Subject): string {
  return resolve(fixturesDir(), 'goldmaster', `${subject}.csv`);
}
export function redactedGoldPath(subject: Subject): string {
  return resolve(redactedDir(), `${subject}.csv`);
}

export function hasWorkbooks(): boolean {
  return SUBJECTS.every((s) => existsSync(workbookPath(s)));
}
export function hasFullGold(): boolean {
  return SUBJECTS.every((s) => existsSync(fullGoldPath(s)));
}
export function hasRedactedGold(): boolean {
  return SUBJECTS.every((s) => existsSync(redactedGoldPath(s)));
}

// ── Field normalization + known gold artefacts ───────────────────────────────────
//
// The English weekly cleanups now live in the parser (src/lib/curriculum/parse.ts,
// live-DB provenance — NOT migration 0024). The harness imports the SAME functions so
// its field spot-check normalises both sides identically and can never drift from what
// the ingest path emits.

/** Apply the parser's English cleanups to a (field, value) pair. Subject-scoped. */
export function normalizeField(
  subject: string,
  field: TextField,
  value: string | null,
): string | null {
  if (subject === 'english') {
    if (field === 'weekly_knowledge_lo') return cleanEnglishWeeklyKnowledgeLo(value);
    if (field === 'weekly_skills_lo') return cleanEnglishWeeklySkillsLo(value);
  }
  return value;
}

/**
 * Gold `lesson_key`s that are known DATA ARTEFACTS of the old out-of-band import, not
 * real curriculum — excluded from the zero-missing gate (the newer workbooks correctly
 * omit them). Documented so the carve-out is auditable, not silent.
 *   • yoga|Y5|Year 5|W5|P5 — month cell is the literal typo "Year 5", and period 5 in a
 *     period-1-only subject. A corrupt row that shouldn't have been imported.
 */
export const KNOWN_GOLD_ARTEFACTS = new Set<string>(['yoga|Y5|Year 5|W5|P5']);

/** Gold keys for a subject with known artefacts removed (the zero-missing baseline). */
export function goldKeysForGate(subject: Subject): string[] {
  return loadRedactedGold(subject)
    .map((r) => r.lesson_key)
    .filter((k) => !KNOWN_GOLD_ARTEFACTS.has(k));
}

// ── Loaders ───────────────────────────────────────────────────────────────────────

function toIntOrNull(v: string | null): number | null {
  if (v == null) return null;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
}

/** Load the full-text gold master for a subject (from the gitignored dir). */
export function loadFullGold(subject: Subject): Record<string, string | null>[] {
  return parseCsv(readFileSync(fullGoldPath(subject), 'utf8'));
}

/** Load the redacted (structural + presence-boolean) gold master for a subject. */
export function loadRedactedGold(subject: Subject): RedactedRow[] {
  const rows = parseCsv(readFileSync(redactedGoldPath(subject), 'utf8'));
  return rows.map((r) => {
    const present = {} as Record<TextField, boolean>;
    for (const f of TEXT_FIELDS) present[f] = r[`${f}_present`] === 'true';
    return {
      subject_code: r.subject_code ?? subject,
      year: toIntOrNull(r.year) ?? 0,
      month: r.month ?? '',
      week: toIntOrNull(r.week) ?? 0,
      period: toIntOrNull(r.period),
      lesson_key: r.lesson_key ?? '',
      present,
    };
  });
}

/** Derive a redacted row set from full-text gold rows (structural + non-null booleans). */
export function redactRows(rows: Record<string, string | null>[]): {
  header: string[];
  matrix: (string | number | boolean | null)[][];
} {
  const structural = ['subject_code', 'year', 'month', 'week', 'period', 'lesson_key'];
  const boolCols = TEXT_FIELDS.map((f) => `${f}_present`);
  const header = [...structural, ...boolCols];
  const matrix = rows.map((r) => [
    ...structural.map((c) => r[c] ?? null),
    ...TEXT_FIELDS.map((f) => r[f] != null && r[f] !== ''),
  ]);
  return { header, matrix };
}

export { toCsv };

// ── Key-set diff ────────────────────────────────────────────────────────────────

export interface KeyDiff {
  subject: string;
  goldCount: number;
  emittedCount: number;
  matched: number;
  missing: string[]; // in gold, not emitted
  extra: string[]; // emitted, not in gold
}

export function diffKeys(subject: string, goldKeys: string[], emittedKeys: string[]): KeyDiff {
  const gold = new Set(goldKeys);
  const emitted = new Set(emittedKeys);
  const missing = [...gold].filter((k) => !emitted.has(k)).sort();
  const extra = [...emitted].filter((k) => !gold.has(k)).sort();
  return {
    subject,
    goldCount: gold.size,
    emittedCount: emitted.size,
    matched: [...gold].filter((k) => emitted.has(k)).length,
    missing,
    extra,
  };
}

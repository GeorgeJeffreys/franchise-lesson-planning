// Report-only parity: parse each workbook, diff its emitted lesson_key set against the
// gold master, and print matched / missing / extra per subject (plus field-value diffs
// on matched keys when the full-text gold is present). NO assertions — this is the
// "report before fixing" view. The committed pass/fail gate lives in parity.test.ts.
//
//   npm run parity:report
import { readFileSync } from 'node:fs';
import { parseCurriculumWorkbook } from '../src/lib/curriculum/parse';
import {
  SUBJECTS,
  TEXT_FIELDS,
  diffKeys,
  fullGoldPath,
  hasFullGold,
  hasRedactedGold,
  hasWorkbooks,
  loadFullGold,
  loadRedactedGold,
  normalizeField,
  redactedGoldPath,
  workbookPath,
  type Subject,
} from '../src/lib/curriculum/__tests__/parity/goldmaster';

if (!hasWorkbooks()) {
  console.error('Missing workbooks under the fixtures dir. Place all 7 subject .xlsx first.');
  process.exit(1);
}
const useFull = hasFullGold();
const useRedacted = hasRedactedGold();
if (!useFull && !useRedacted) {
  console.error('No gold master found (neither goldmaster/ nor goldmaster-redacted/). Export it first.');
  process.exit(1);
}
console.log(`Gold source: ${useFull ? 'full (goldmaster/)' : 'redacted (goldmaster-redacted/)'}\n`);

const SPOT_CHECK_FIELDS = [
  'daily_outcome',
  'weekly_skills_lo',
  'weekly_knowledge_lo',
  'monthly_lo',
  'grammar_vocabulary',
  'theme',
] as const;

function goldKeys(subject: Subject): string[] {
  if (useFull) return loadFullGold(subject).map((r) => r.lesson_key ?? '');
  return loadRedactedGold(subject).map((r) => r.lesson_key);
}

let anyKeyDiff = false;
const rows: string[] = [];
for (const subject of SUBJECTS) {
  const buf = readFileSync(workbookPath(subject));
  const { lessonRows } = parseCurriculumWorkbook(buf, subject, { fileName: `${subject}.xlsx` });
  const diff = diffKeys(subject, goldKeys(subject), lessonRows.map((r) => r.lesson_key));
  const ok = diff.missing.length === 0 && diff.extra.length === 0;
  if (!ok) anyKeyDiff = true;
  rows.push(
    `${subject.padEnd(15)} gold=${String(diff.goldCount).padStart(5)}  emitted=${String(
      diff.emittedCount,
    ).padStart(5)}  matched=${String(diff.matched).padStart(5)}  missing=${String(
      diff.missing.length,
    ).padStart(4)}  extra=${String(diff.extra.length).padStart(4)}  ${ok ? 'PASS' : 'FAIL'}`,
  );
}

console.log('── lesson_key parity (hard gate) ─────────────────────────────────────');
for (const r of rows) console.log(r);
console.log('──────────────────────────────────────────────────────────────────────\n');

// Per-subject detail for failing subjects.
for (const subject of SUBJECTS) {
  const buf = readFileSync(workbookPath(subject));
  const { lessonRows } = parseCurriculumWorkbook(buf, subject, { fileName: `${subject}.xlsx` });
  const diff = diffKeys(subject, goldKeys(subject), lessonRows.map((r) => r.lesson_key));
  if (diff.missing.length === 0 && diff.extra.length === 0) continue;
  console.log(`### ${subject} — ${diff.missing.length} missing, ${diff.extra.length} extra`);
  if (diff.missing.length) console.log('  missing (in gold, not emitted):', diff.missing.slice(0, 12).join('  '));
  if (diff.extra.length) console.log('  extra   (emitted, not in gold):', diff.extra.slice(0, 12).join('  '));
  console.log('');
}

// Field spot-check (only with full-text gold).
if (useFull && !anyKeyDiff) {
  console.log('── field spot-check on matched keys (full-text gold) ─────────────────');
  for (const subject of SUBJECTS) {
    const buf = readFileSync(workbookPath(subject));
    const { lessonRows } = parseCurriculumWorkbook(buf, subject, { fileName: `${subject}.xlsx` });
    const emitted = new Map(lessonRows.map((r) => [r.lesson_key, r]));
    let diffs = 0;
    for (const gold of loadFullGold(subject)) {
      const key = gold.lesson_key ?? '';
      const row = emitted.get(key);
      if (!row) continue;
      for (const f of SPOT_CHECK_FIELDS) {
        const g = normalizeField(subject, f, gold[f] ?? null);
        const p = normalizeField(
          subject,
          f,
          (row as unknown as Record<string, unknown>)[f] as string | null,
        );
        if ((g ?? '') !== (p ?? '')) {
          diffs++;
          if (diffs <= 3) console.log(`  ${subject} ${key} [${f}]\n    gold: ${JSON.stringify(g)}\n    got:  ${JSON.stringify(p)}`);
        }
      }
    }
    console.log(`${subject.padEnd(15)} field diffs on matched keys: ${diffs}`);
  }
} else if (useFull) {
  console.log('(field spot-check skipped — resolve key parity first)');
}
void TEXT_FIELDS;
void fullGoldPath;
void redactedGoldPath;

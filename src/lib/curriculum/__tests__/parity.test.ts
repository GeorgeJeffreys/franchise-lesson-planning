import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseCurriculumWorkbook } from '../parse';
import {
  SUBJECTS,
  diffKeys,
  hasFullGold,
  hasRedactedGold,
  hasWorkbooks,
  loadFullGold,
  loadRedactedGold,
  normalizeField,
  workbookPath,
  type Subject,
} from './parity/goldmaster';

// ── Curriculum parser parity gate (LOCAL correctness gate, not CI/deploy) ─────────
//
// The real workbooks and the full-text gold master are gitignored IP, so this gate only
// runs where they're present locally. The hard assertion — per subject, the parser's
// emitted lesson_key set is byte-identical to the gold master — reads gold keys from the
// COMMITTED, content-free goldmaster-redacted/ set; the field-value spot-check reads the
// gitignored full-text goldmaster/ and self-skips when absent. When fixtures are missing
// (CI, or before George drops them in), every case skips with a reason rather than failing.

const skipReason = !hasWorkbooks()
  ? 'workbooks absent (gitignored IP) — run locally with test/fixtures/curriculum/*.xlsx'
  : !hasRedactedGold()
    ? 'goldmaster-redacted/ absent — run `npm run redact:goldmaster` after exporting the gold master'
    : null;

function emittedKeys(subject: Subject): string[] {
  const buf = readFileSync(workbookPath(subject));
  const { lessonRows } = parseCurriculumWorkbook(buf, subject, { fileName: `${subject}.xlsx` });
  return lessonRows.map((r) => r.lesson_key);
}

for (const subject of SUBJECTS) {
  test(`lesson_key parity — ${subject}`, { skip: skipReason ?? false }, () => {
    const goldKeys = loadRedactedGold(subject).map((r) => r.lesson_key);
    const diff = diffKeys(subject, goldKeys, emittedKeys(subject));
    assert.equal(
      diff.missing.length,
      0,
      `${subject}: ${diff.missing.length} gold key(s) NOT emitted (orphans live plans). ` +
        `e.g. ${diff.missing.slice(0, 8).join(', ')}`,
    );
    assert.equal(
      diff.extra.length,
      0,
      `${subject}: ${diff.extra.length} emitted key(s) NOT in gold. ` +
        `e.g. ${diff.extra.slice(0, 8).join(', ')}`,
    );
  });
}

// Field-value spot-check on matched keys — full-text gold only.
const spotSkip = skipReason ?? (!hasFullGold() ? 'full-text goldmaster/ absent' : false);
const SPOT_CHECK_FIELDS = [
  'daily_outcome',
  'weekly_skills_lo',
  'weekly_knowledge_lo',
  'monthly_lo',
  'grammar_vocabulary',
  'theme',
] as const;

for (const subject of SUBJECTS) {
  test(`field spot-check — ${subject}`, { skip: spotSkip }, () => {
    const buf = readFileSync(workbookPath(subject));
    const { lessonRows } = parseCurriculumWorkbook(buf, subject, { fileName: `${subject}.xlsx` });
    const emitted = new Map(
      lessonRows.map((r) => [r.lesson_key, r as unknown as Record<string, unknown>]),
    );
    const mismatches: string[] = [];
    for (const gold of loadFullGold(subject)) {
      const row = emitted.get(gold.lesson_key ?? '');
      if (!row) continue; // key parity is asserted separately
      for (const f of SPOT_CHECK_FIELDS) {
        const g = normalizeField(subject, f, gold[f] ?? null);
        const p = normalizeField(subject, f, (row[f] as string | null) ?? null);
        if ((g ?? '') !== (p ?? '')) mismatches.push(`${gold.lesson_key} [${f}]`);
      }
    }
    assert.equal(
      mismatches.length,
      0,
      `${subject}: ${mismatches.length} field mismatch(es) on matched keys. e.g. ${mismatches
        .slice(0, 8)
        .join(', ')}`,
    );
  });
}

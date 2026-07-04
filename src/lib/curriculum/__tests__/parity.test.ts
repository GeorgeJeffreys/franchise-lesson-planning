import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseCurriculumWorkbook } from '../parse';
import {
  SUBJECTS,
  diffKeys,
  goldKeysForGate,
  hasRedactedGold,
  hasWorkbooks,
  workbookPath,
  type Subject,
} from './parity/goldmaster';

// ── Curriculum parser parity gate (LOCAL correctness gate, not CI/deploy) ─────────
//
// The real workbooks and full-text gold master are gitignored IP, so this gate only runs
// where they're present locally; it self-skips otherwise (CI, or before the fixtures are
// dropped in) rather than failing.
//
// GATE = ZERO MISSING (gold ⊆ emitted). The parser MUST reproduce every lesson_key
// already in the live gold master — a missing key would orphan the live plans that
// reference it. EXTRA keys are NOT failures: these workbooks are newer than the gold
// export, so extras are real new curriculum a genuine sync would insert (see
// parity-report.ts for the per-subject new-content counts). Known gold data artefacts
// are excluded from the baseline (see KNOWN_GOLD_ARTEFACTS).

const skipReason = !hasWorkbooks()
  ? 'workbooks absent (gitignored IP) — run locally with test/fixtures/curriculum/*.xlsx'
  : !hasRedactedGold()
    ? 'goldmaster-redacted/ absent — run `npm run redact:goldmaster` after exporting the gold master'
    : null;

function emitted(subject: Subject) {
  const buf = readFileSync(workbookPath(subject));
  return parseCurriculumWorkbook(buf, subject, { fileName: `${subject}.xlsx` }).lessonRows;
}

for (const subject of SUBJECTS) {
  test(`zero-missing parity — ${subject}`, { skip: skipReason ?? false }, () => {
    const diff = diffKeys(
      subject,
      goldKeysForGate(subject),
      emitted(subject).map((r) => r.lesson_key),
    );
    assert.equal(
      diff.missing.length,
      0,
      `${subject}: ${diff.missing.length} gold key(s) NOT emitted (would orphan live plans). ` +
        `e.g. ${diff.missing.slice(0, 8).join(', ')}`,
    );
    // extra is expected (new curriculum in the newer workbook) — asserted non-fatal.
  });
}

// The 8 English weekly cleanups must be applied on the parse path itself (UI upload /
// endpoint), so a raw re-parse emits already-cleaned values and a re-import never
// reverts them. Assert the cleaned invariants directly on the emitted English rows.
test('English weekly cleanups applied on the parse path', { skip: skipReason ?? false }, () => {
  const rows = emitted('english');
  const pipeTagged = rows.filter((r) => /\|\s*[A-Za-z]+\s*$/u.test(r.weekly_knowledge_lo ?? ''));
  const numericSkills = rows.filter((r) => /^\s*\d+(\.\d+)?\s*$/.test(r.weekly_skills_lo ?? ''));
  assert.equal(
    pipeTagged.length,
    0,
    `weekly_knowledge_lo still has trailing |<skill> tags: ${pipeTagged
      .slice(0, 4)
      .map((r) => r.lesson_key)
      .join(', ')}`,
  );
  assert.equal(
    numericSkills.length,
    0,
    `weekly_skills_lo still numeric-only: ${numericSkills
      .slice(0, 4)
      .map((r) => r.lesson_key)
      .join(', ')}`,
  );
});

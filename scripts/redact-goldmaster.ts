// Derive the committed, content-free redacted gold master from the gitignored full-text
// export. For each subject CSV under <fixtures>/goldmaster/, emit a redacted CSV under
// test/fixtures/curriculum/goldmaster-redacted/ carrying ONLY structural columns
// (subject_code, year, month, week, period, lesson_key) + one `<field>_present` boolean
// per text field — no curriculum text. The redacted set is what the parity gate asserts
// against in CI; the full CSVs stay local for the field spot-check.
//
//   npm run redact:goldmaster
//
// Re-run whenever the gold master is re-exported. Requires the full CSVs to be present.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { parseCsv } from '../src/lib/curriculum/__tests__/parity/csv';
import {
  SUBJECTS,
  fullGoldPath,
  redactedDir,
  redactedGoldPath,
  redactRows,
  toCsv,
} from '../src/lib/curriculum/__tests__/parity/goldmaster';

const missing = SUBJECTS.filter((s) => !existsSync(fullGoldPath(s)));
if (missing.length) {
  console.error(
    `Missing full gold-master CSVs for: ${missing.join(', ')}\n` +
      `Export active curriculum_lesson rows per subject into <fixtures>/goldmaster/ first.`,
  );
  process.exit(1);
}

mkdirSync(redactedDir(), { recursive: true });
for (const subject of SUBJECTS) {
  const rows = parseCsv(readFileSync(fullGoldPath(subject), 'utf8'));
  const { header, matrix } = redactRows(rows);
  writeFileSync(redactedGoldPath(subject), toCsv(header, matrix));
  console.log(`${subject.padEnd(16)} ${rows.length} rows → ${redactedGoldPath(subject)}`);
}
console.log('\nRedacted gold master written. Commit test/fixtures/curriculum/goldmaster-redacted/.');

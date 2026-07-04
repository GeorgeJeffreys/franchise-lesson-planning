// Report-only parity view. Parses each workbook and, per subject, prints:
//   matched / missing (the ZERO-MISSING gate — must be 0) / extra-as-new-content.
// Extras are new curriculum these newer workbooks contain, NOT failures. With the
// full-text gold present it also prints field-value DRIFT on matched keys (informational
// — newer workbooks legitimately edit text; the committed gate does not fail on it).
// No assertions here; the pass/fail gate is parity.test.ts.
//
//   npm run parity:report
import { readFileSync } from 'node:fs';
import { parseCurriculumWorkbook } from '../src/lib/curriculum/parse';
import {
  KNOWN_GOLD_ARTEFACTS,
  SUBJECTS,
  diffKeys,
  goldKeysForGate,
  hasFullGold,
  hasRedactedGold,
  hasWorkbooks,
  loadFullGold,
  normalizeField,
  workbookPath,
  type Subject,
} from '../src/lib/curriculum/__tests__/parity/goldmaster';

if (!hasWorkbooks()) {
  console.error('Missing workbooks under the fixtures dir. Place all 7 subject .xlsx first.');
  process.exit(1);
}
if (!hasRedactedGold()) {
  console.error('Missing goldmaster-redacted/. Run `npm run redact:goldmaster` first.');
  process.exit(1);
}
const useFull = hasFullGold();

const SPOT_CHECK_FIELDS = [
  'daily_outcome',
  'weekly_skills_lo',
  'weekly_knowledge_lo',
  'monthly_lo',
  'grammar_vocabulary',
  'theme',
] as const;

function emitted(subject: Subject) {
  const buf = readFileSync(workbookPath(subject));
  return parseCurriculumWorkbook(buf, subject, { fileName: `${subject}.xlsx` }).lessonRows;
}

console.log('── zero-missing parity gate (extra = new curriculum, not a failure) ──');
let allPass = true;
for (const subject of SUBJECTS) {
  const rows = emitted(subject);
  const diff = diffKeys(subject, goldKeysForGate(subject), rows.map((r) => r.lesson_key));
  const pass = diff.missing.length === 0;
  allPass &&= pass;
  console.log(
    `${subject.padEnd(15)} gold=${String(diff.goldCount).padStart(5)}  emitted=${String(
      diff.emittedCount,
    ).padStart(5)}  matched=${String(diff.matched).padStart(5)}  missing=${String(
      diff.missing.length,
    ).padStart(4)}  new-content=${String(diff.extra.length).padStart(4)}  ${pass ? 'PASS' : 'FAIL'}`,
  );
  if (diff.missing.length) console.log('   MISSING:', diff.missing.slice(0, 10).join('  '));
}
console.log(
  `\n${allPass ? 'GATE GREEN — every gold key reproduced.' : 'GATE RED — missing keys above.'}` +
    ` (artefacts excluded: ${[...KNOWN_GOLD_ARTEFACTS].join(', ')})\n`,
);

// New-content breakdown per subject (years touched).
console.log('── new content (extra keys) by year ─────────────────────────────────');
for (const subject of SUBJECTS) {
  const rows = emitted(subject);
  const gold = new Set(goldKeysForGate(subject));
  const extra = rows.filter((r) => !gold.has(r.lesson_key));
  if (extra.length === 0) {
    console.log(`${subject.padEnd(15)} none`);
    continue;
  }
  const byYear = new Map<number, number>();
  for (const r of extra) byYear.set(r.year, (byYear.get(r.year) ?? 0) + 1);
  console.log(
    `${subject.padEnd(15)} +${extra.length}  (${[...byYear.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([y, n]) => `Y${y}:${n}`)
      .join(' ')})`,
  );
}

// Field-value DRIFT on matched keys (informational — newer workbooks edit text).
// Whitespace-insensitive: the Postgres export and the xlsx cell read differ on newline
// encoding / trailing space, which is not real content drift. Collapse both sides.
const collapseWs = (s: string | null): string => (s ?? '').replace(/\s+/g, ' ').trim();
if (useFull) {
  console.log('\n── field drift on matched keys (whitespace-insensitive; not gated) ───');
  for (const subject of SUBJECTS) {
    const byKey = new Map(emitted(subject).map((r) => [r.lesson_key, r as unknown as Record<string, unknown>]));
    const perField = new Map<string, number>();
    for (const gold of loadFullGold(subject)) {
      const row = byKey.get(gold.lesson_key ?? '');
      if (!row) continue;
      for (const f of SPOT_CHECK_FIELDS) {
        const g = collapseWs(normalizeField(subject, f, gold[f] ?? null));
        const p = collapseWs(normalizeField(subject, f, (row[f] as string | null) ?? null));
        if (g !== p) perField.set(f, (perField.get(f) ?? 0) + 1);
      }
    }
    const summary = [...perField.entries()].map(([f, n]) => `${f}:${n}`).join('  ') || 'clean';
    console.log(`${subject.padEnd(15)} ${summary}`);
  }
} else {
  console.log('\n(field drift skipped — full-text goldmaster/ not present)');
}

// DRY-RUN worksheet migration report (READ-ONLY — never writes).
//
// Reads every lesson_plans.worksheet value, runs `migrateWorksheetToV3` over it,
// and prints a corpus health summary so a human can review before the document
// editor's feature flag is enabled for users.
//
// Usage:
//   # against the real database (service role; reads only)
//   NEXT_PUBLIC_SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… \
//     npm run worksheet:dryrun
//
//   # offline, against a JSON fixture file (array of raw worksheet values, or of
//   # { id, worksheet } objects) — no database, no npm deps beyond the migration:
//   npm run worksheet:dryrun -- --fixtures ./path/to/rows.json
//
// The DB client is imported lazily so the --fixtures path runs with nothing but
// the pure migration module (handy in CI / a fresh checkout without node_modules).

import { readFileSync } from 'node:fs';
import { analyzeWorksheetRow, RESOURCE_REF_NOTE } from '../src/lib/editor/worksheet-migrate';

interface Row {
  id: string;
  worksheet: unknown;
}

/** Parse `--fixtures <path>` from argv, if present. */
function fixturesPath(): string | null {
  const i = process.argv.indexOf('--fixtures');
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : null;
}

/** Load rows from a fixtures file. Accepts an array of raw worksheet values or of
 *  `{ id, worksheet }` objects. */
function loadFixtures(path: string): Row[] {
  const parsed = JSON.parse(readFileSync(path, 'utf8'));
  if (!Array.isArray(parsed)) throw new Error('Fixtures file must be a JSON array.');
  return parsed.map((entry, i) => {
    if (entry && typeof entry === 'object' && 'worksheet' in entry) {
      return { id: String((entry as Row).id ?? `fixture-${i}`), worksheet: (entry as Row).worksheet };
    }
    return { id: `fixture-${i}`, worksheet: entry };
  });
}

/** Page through lesson_plans via the service-role client (reads only). */
async function loadFromDb(): Promise<Row[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Set them to ' +
        'run against the database, or pass --fixtures <path> to run offline.',
    );
  }
  // Lazy import so the --fixtures path needs no node_modules.
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const rows: Row[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('lesson_plans')
      .select('id, worksheet')
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Supabase read failed: ${error.message}`);
    if (!data || data.length === 0) break;
    rows.push(...(data as Row[]));
    if (data.length < PAGE) break;
  }
  return rows;
}

function pct(n: number, total: number): string {
  return total === 0 ? '0%' : `${((n / total) * 100).toFixed(1)}%`;
}

function sample(ids: string[], n = 10): string {
  if (ids.length === 0) return '(none)';
  const head = ids.slice(0, n).join(', ');
  return ids.length > n ? `${head}, … (+${ids.length - n} more)` : head;
}

async function main() {
  const path = fixturesPath();
  const source = path ? `fixtures: ${path}` : 'database (lesson_plans)';
  const rows = path ? loadFixtures(path) : await loadFromDb();

  const versions: Record<string, number> = { v1: 0, v2: 0, v3: 0, empty: 0, unknown: 0 };
  let withContent = 0;
  const floatingOverImageIds: string[] = [];
  const resourceRefIds: string[] = [];
  const overflowRiskIds: string[] = [];
  const failureIds: { id: string; error: string }[] = [];
  let totalFloatingImages = 0;
  let totalFloatingTextBoxes = 0;
  let totalResourceRefs = 0;

  for (const row of rows) {
    const a = analyzeWorksheetRow(row.worksheet);
    versions[a.source] = (versions[a.source] ?? 0) + 1;
    if (a.blockCount > 0) withContent += 1;
    totalFloatingImages += a.floatingImages;
    totalFloatingTextBoxes += a.floatingTextBoxes;
    totalResourceRefs += a.resourceRefs;
    if (a.floatingOverImage > 0) floatingOverImageIds.push(row.id);
    if (a.resourceRefs > 0) resourceRefIds.push(row.id);
    if (a.overflowRiskBlocks > 0) overflowRiskIds.push(row.id);
    if (!a.ok) failureIds.push({ id: row.id, error: a.error ?? 'unknown error' });
  }

  const total = rows.length;
  const lines = [
    '',
    '════════════════════════════════════════════════════════════════',
    '  WORKSHEET MIGRATION — DRY RUN (read-only, no writes)',
    `  source: ${source}`,
    '════════════════════════════════════════════════════════════════',
    '',
    `  Total rows scanned .................. ${total}`,
    `  Rows with worksheet content ........ ${withContent} (${pct(withContent, total)})`,
    '',
    '  On-disk version distribution:',
    `    v3 (already migrated) ............ ${versions.v3}`,
    `    v2 (block list) .................. ${versions.v2}`,
    `    v1 (bare tiptap doc) ............. ${versions.v1}`,
    `    empty (null) ..................... ${versions.empty}`,
    `    unknown / garbage ................ ${versions.unknown}`,
    '',
    '  ── Review flags ──────────────────────────────────────────────',
    `  Floating text-box OVER an image .... ${floatingOverImageIds.length} rows`,
    `      ${sample(floatingOverImageIds)}`,
    `  Legacy resource references ......... ${resourceRefIds.length} rows (${totalResourceRefs} blocks)`,
    `      ${sample(resourceRefIds)}`,
    `  Overflow-risk blocks (heuristic*) .. ${overflowRiskIds.length} rows`,
    `      ${sample(overflowRiskIds)}`,
    `  Migration FAILURES ................. ${failureIds.length} rows`,
    `      ${failureIds.length ? failureIds.slice(0, 10).map((f) => `${f.id}: ${f.error}`).join(' | ') : '(none)'}`,
    '',
    '  Totals across corpus:',
    `    floating images .................. ${totalFloatingImages}`,
    `    floating text boxes .............. ${totalFloatingTextBoxes}`,
    '',
    '  * Overflow-risk is a HEURISTIC proxy (image count / node count / text',
    '    length): true page-overflow needs rendered-height measurement, which is',
    '    not persisted and cannot run headless. Treat it as "worth eyeballing".',
    '',
    `  Resource-ref handling: ${RESOURCE_REF_NOTE}`,
    '════════════════════════════════════════════════════════════════',
    '',
  ];
  console.log(lines.join('\n'));

  // Machine-readable tail for pipelines / archiving.
  console.log(
    'JSON ' +
      JSON.stringify({
        source,
        total,
        withContent,
        versions,
        floatingOverImage: floatingOverImageIds.length,
        resourceRefRows: resourceRefIds.length,
        resourceRefBlocks: totalResourceRefs,
        overflowRiskRows: overflowRiskIds.length,
        failures: failureIds.length,
        totalFloatingImages,
        totalFloatingTextBoxes,
      }),
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});

// Curriculum Gaps — the six-state reconcile classifier.
//
// This is the SINGLE classifier behind the per-subject reconcile page. It is derived
// from the SAME taxonomy foundation the #99 coverage gate uses (`parseTaxonomyId` +
// the "well-formed EXCLUDES the S0/K0 sentinel" rule) so the reconcile page and the
// Logic-tree gate can never disagree on what counts as a real, placed outcome. Do NOT
// fork a second parser or a second "is this placed" rule here — reuse `parseTaxonomyId`.
//
// The gate's rule (SQL migration 0053 / composition.ts): a row is well-formed/"placed"
// iff its taxonomy_id matches `^\d+\.S\d+\.K\d+\.H\d+$` AND segment 2 ≠ `S0` AND
// segment 3 ≠ `K0`. Note the sentinel test is an OR over the two segments — matching
// the gate's two `split_part(...) <> …` conditions — NOT `isFlatArtefact` (which is an
// AND of both, a different question asked of the spiral-recurrence signal).

import { parseTaxonomyId } from './taxonomy';
import type { CurriculumResource } from './types';

/**
 * The six reconcile states, most-actionable-error first. Each active curriculum row is
 * assigned EXACTLY ONE, so the facet counts partition the subject's rows (they sum to
 * the total). Precedence is encoded in `classifyCurriculumRow`.
 */
export type GapStatus =
  | 'placed' // taxonomy_id well-formed, NOT S0/K0, unique — valid, in the logic tree.
  | 'placeholder' // well-formed shape but the skill or knowledge segment is the S0/K0 sentinel.
  | 'unmapped' // lesson identifier blank/absent — can't be placed.
  | 'duplicate' // identifier malformed (doesn't parse) or collides (lesson_key non-unique).
  | 'missing' // daily_outcome empty (independent of taxonomy).
  | 'guard'; // referenced by a live plan such that re-import archival is blocked (working as intended).

/** Facet order shown in the reconcile sidebar (headline placeholder first, valid last). */
export const GAP_STATUS_ORDER: GapStatus[] = [
  'placeholder',
  'unmapped',
  'missing',
  'duplicate',
  'guard',
  'placed',
];

/** Tri-severity + placed/guard tone bucket for a state (drives the palette; see the page). */
export type GapSeverity = 'error' | 'placeholder' | 'guard' | 'placed';

export const GAP_SEVERITY: Record<GapStatus, GapSeverity> = {
  unmapped: 'error',
  missing: 'error',
  duplicate: 'error',
  placeholder: 'placeholder',
  guard: 'guard',
  placed: 'placed',
};

/** The minimal fields the classifier needs from a `curriculum_lesson` row. */
export interface ClassifyInput {
  /** `curriculum_lesson.taxonomy_id` (the "Lesson identifier"). */
  taxonomyId: string | null;
  /** `curriculum_lesson.daily_outcome`. */
  dailyOutcome: string | null;
  /** `curriculum_lesson.lesson_key` — matched against the guard set. */
  lessonKey: string;
}

/**
 * Classify one live curriculum row into exactly one of the six states.
 *
 * Precedence (highest first), chosen so the classification reproduces the design's
 * hand-labelled example rows from real data:
 *   1. guard   — an import-time, working-as-intended state sourced from the last sync
 *                run's `warnings.skippedReferencedKeys`; it overrides the live taxonomy
 *                classification (a guarded row may itself be perfectly well-formed).
 *   2. missing — no usable daily outcome (a hard content error, independent of taxonomy).
 *   3. unmapped— no lesson identifier at all.
 *   4. placed  — well-formed AND not the S0/K0 sentinel (the gate's exact rule).
 *   5. placeholder — well-formed shape but S0/K0 sentinel (the headline bucket).
 *   6. duplicate — the residual: a non-empty identifier that doesn't parse to a
 *                well-formed id (malformed/unparseable). A lesson_key COLLISION is the
 *                other half of "duplicate", but `curriculum_lesson.lesson_key` carries a
 *                UNIQUE constraint, so collisions cannot exist in live rows and the
 *                importer records none — this bucket therefore only ever holds malformed
 *                codes when sourced live (documented, not faked).
 *
 * @param guardKeys lesson_keys the last successful sync left active because a live plan
 *                  references them (empty set when the importer recorded no guard).
 */
export function classifyCurriculumRow(row: ClassifyInput, guardKeys: ReadonlySet<string>): GapStatus {
  if (guardKeys.has(row.lessonKey)) return 'guard';

  const hasOutcome = !!row.dailyOutcome && row.dailyOutcome.trim() !== '';
  if (!hasOutcome) return 'missing';

  const parsed = parseTaxonomyId(row.taxonomyId);
  if (parsed.raw === '') return 'unmapped';

  // The gate's rule: well-formed EXCLUDES the S0/K0 sentinel (OR over the two segments).
  const isSentinel = parsed.skillLo === 'S0' || parsed.knowledgeLo === 'K0';
  if (parsed.wellFormed && !isSentinel) return 'placed';
  if (parsed.wellFormed && isSentinel) return 'placeholder';

  return 'duplicate';
}

/** The four canonical taxonomy segments, named to match `parseTaxonomyId`'s documentation. */
export interface TaxonomySegments {
  /** Segment 1 — the Focus Area number (NOT the year; see taxonomy.ts). */
  focusArea: number | null;
  /** Segment 2 — the Skill learning-outcome ref, normalised `S{n}`. */
  skillLo: string | null;
  /** Segment 3 — the Knowledge learning-outcome ref, normalised `K{n}`. */
  knowledgeLo: string | null;
  /** Segment 4 — the Hour ordinal. */
  hour: number | null;
}

/** Recover the display segments for a row's expand panel, via the same canonical parse. */
export function taxonomySegments(taxonomyId: string | null): TaxonomySegments {
  const p = parseTaxonomyId(taxonomyId);
  return { focusArea: p.focusArea, skillLo: p.skillLo, knowledgeLo: p.knowledgeLo, hour: p.hour };
}

// ── Report shapes (serialisable; shared server loader ↔ client page) ──────────────

/** One classified curriculum row, render-ready for the reconcile table. */
export interface GapRow {
  id: string;
  /** Source workbook row (`srow`), or null until the subject is re-imported post-0054. */
  sourceRow: number | null;
  lessonKey: string;
  year: number;
  month: string;
  week: number;
  period: number | null;
  taxonomyId: string | null;
  dailyOutcome: string | null;
  /** `linguistic_skill` — the "Skill" column. */
  skill: string | null;
  /** `grammar_vocabulary` — the "Topic" column (grammar / vocabulary focus). */
  grammarVocabulary: string | null;
  theme: string | null;
  resources: CurriculumResource[];
  status: GapStatus;
  focusArea: number | null;
  skillLo: string | null;
  knowledgeLo: string | null;
  hour: number | null;
  /** Guard rows only: how many live lesson plans reference this lesson_key (else 0). */
  referencedByPlans: number;
}

/** Per-status counts plus the `all` total — every count computed from classified rows. */
export type GapCounts = Record<GapStatus, number> & { all: number };

export interface GapYearFacet {
  year: number;
  count: number;
}

/** The whole per-subject reconcile payload the server loader hands the client page. */
export interface CurriculumGapsReport {
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  /** Uploaded workbook filename from the latest run (null for older runs / n8n). */
  sourceFilename: string | null;
  /** The source *type* of the latest run ('upload' | 'n8n' | 'sharepoint'), or null. */
  source: string | null;
  lastSyncedAt: string | null;
  /** True when at least one row carries a `source_row` — enables the Row column + copy. */
  hasSourceRows: boolean;
  rows: GapRow[];
  counts: GapCounts;
  years: GapYearFacet[];
}

/** Tally classified rows into the six facet counts plus `all`. */
export function tallyGapCounts(rows: readonly GapRow[]): GapCounts {
  const counts: GapCounts = {
    all: rows.length,
    placed: 0,
    placeholder: 0,
    unmapped: 0,
    duplicate: 0,
    missing: 0,
    guard: 0,
  };
  for (const r of rows) counts[r.status] += 1;
  return counts;
}

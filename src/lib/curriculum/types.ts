// Types for the Supabase-backed curriculum layer.
//
// The legacy presentational shape (`CurriculumLesson` in src/types/curriculum.ts)
// is preserved for consumers; these types describe the new persistence layer:
// the `curriculum_lesson` row, the parser's output, and a sync-run summary.

/** A resource reference. Page refs (e.g. "Jumpstart p6") are label-only. */
export interface CurriculumResource {
  label: string;
  url?: string;
}

/** A row of `curriculum_lesson`, exactly as parsed/persisted. */
export interface CurriculumLessonRow {
  subject_code: string;
  year: number;
  month: string;
  week: number;
  period: number;
  lesson_key: string;
  daily_outcome: string | null;
  focus_area: string | null;
  linguistic_skill: string | null;
  theme: string | null;
  resources: CurriculumResource[];
  taxonomy_id: string | null;
  monthly_knowledge_lo: string | null;
  monthly_skills_lo: string | null;
  weekly_knowledge_lo: string | null;
  weekly_skills_lo: string | null;
}

/** The parser's output for one workbook row (subject_code + content, no db-only fields). */
export type ParsedCurriculumRow = CurriculumLessonRow;

/** Where an import came from. */
export type CurriculumSyncSource = 'n8n' | 'upload';

/** Counts recorded for a single import run. */
export interface CurriculumSyncResult {
  runId: string | null;
  subjectCode: string;
  rowsUpserted: number;
  rowsDeactivated: number;
  unresolved: number;
  status: 'success' | 'error';
  error?: string;
}

/** Build the stable lesson_key from a row's natural key. */
export function buildLessonKey(
  subjectCode: string,
  year: number,
  month: string,
  week: number,
  period: number,
): string {
  return `${subjectCode}|Y${year}|${month}|W${week}|P${period}`;
}

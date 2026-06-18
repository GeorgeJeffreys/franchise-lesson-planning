import { createClient } from '@/lib/supabase/server';
import { getLessonById } from '@/lib/curriculumUtils';
import { DEFAULT_BLOCKS } from '@/lib/blocks';
import type { Block, LessonBlockType, LessonPlan } from '@/types/lesson';

/** Block types that have a pre-approved activity bank today. */
export const ACTIVITY_BLOCK_TYPES: LessonBlockType[] = ['cfu', 'exit_ticket'];

export type ClassLiteracy = 'literate' | 'illiterate' | 'mixed';

/** A pre-approved activity row, narrowed to what the editor needs. */
export interface ActivityBankItem {
  id: string;
  block_type: LessonBlockType;
  name: string;
  summary: string | null;
  literate_instructions: string | null;
  illiterate_instructions: string | null;
  sort_order: number;
}

/** The locked class context shown in the slim header. */
export interface EditorClassContext {
  id: string;
  year: number;
  groupLabel: string;
  literacy: ClassLiteracy;
  schoolName: string;
  subjectName: string;
}

/** The locked curriculum context resolved from `curriculum_lesson_id`. */
export interface EditorCurriculumContext {
  dailyLO: string;
  /** Focus area = the curriculum's linguistic skill (e.g. "Reading"). */
  focusArea: string;
  theme: string;
}

/** Everything the client editor needs, fully serializable. */
export interface EditorPlanData {
  plan: LessonPlan;
  classContext: EditorClassContext;
  curriculum: EditorCurriculumContext | null;
  /** Pre-approved activities grouped by block type (cfu, exit_ticket today). */
  activitiesByBlock: Partial<Record<LessonBlockType, ActivityBankItem[]>>;
}

// The Supabase client is intentionally untyped in this project (the generated
// Database type is still a placeholder), so we shape the joined rows by hand.
interface RawClassJoin {
  id: string;
  year: number;
  group_label: string;
  literacy: ClassLiteracy;
  school: { name: string } | { name: string }[] | null;
  subject: { name: string } | { name: string }[] | null;
}

interface RawPlanRow {
  id: string;
  class_id: string;
  curriculum_lesson_id: string;
  lesson_date: string;
  period: number | null;
  status: LessonPlan['status'];
  smartt_objective: string | null;
  smartt_check: LessonPlan['smartt_check'];
  blocks: unknown;
  created_by: string;
  submitted_at: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
  updated_at: string;
  class: RawClassJoin | RawClassJoin[] | null;
}

function one<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

/**
 * Load a lesson plan for the editor through the auth'd client (RLS enforced):
 * the plan, its class (school/subject/year/group/literacy), the resolved
 * curriculum context, and the activity bank for the blocks that have one.
 *
 * Returns `null` when the plan does not exist or the user is not permitted to
 * see it (RLS hides it), so the route can 404.
 */
export async function loadPlanForEditor(id: string): Promise<EditorPlanData | null> {
  const supabase = await createClient();

  const { data: planRow, error } = await supabase
    .from('lesson_plans')
    .select(
      `id, class_id, curriculum_lesson_id, lesson_date, period, status,
       smartt_objective, smartt_check, blocks, created_by, submitted_at,
       reviewed_at, review_note, created_at, updated_at,
       class:classes (
         id, year, group_label, literacy,
         school:schools ( name ),
         subject:subjects ( name )
       )`
    )
    .eq('id', id)
    .maybeSingle();

  if (error || !planRow) return null;

  const row = planRow as unknown as RawPlanRow;
  const rawClass = one(row.class);
  if (!rawClass) return null;

  const school = one(rawClass.school);
  const subject = one(rawClass.subject);

  const classContext: EditorClassContext = {
    id: rawClass.id,
    year: rawClass.year,
    groupLabel: rawClass.group_label,
    literacy: rawClass.literacy,
    schoolName: school?.name ?? '',
    subjectName: subject?.name ?? '',
  };

  // Resolve the locked curriculum context from the flat-file curriculum.
  const lookup = getLessonById(row.curriculum_lesson_id);
  const lesson = Array.isArray(lookup) ? lookup[0] : lookup;
  const curriculum: EditorCurriculumContext | null = lesson
    ? { dailyLO: lesson.dailyLO, focusArea: lesson.linguisticSkill, theme: lesson.theme }
    : null;

  // Activity bank for the blocks that have one.
  const { data: activityRows } = await supabase
    .from('activity_bank')
    .select('id, block_type, name, summary, literate_instructions, illiterate_instructions, sort_order')
    .in('block_type', ACTIVITY_BLOCK_TYPES)
    .order('sort_order', { ascending: true });

  const activitiesByBlock: Partial<Record<LessonBlockType, ActivityBankItem[]>> = {};
  for (const row of (activityRows ?? []) as ActivityBankItem[]) {
    (activitiesByBlock[row.block_type] ??= []).push(row);
  }

  const blocks: Block[] =
    Array.isArray(row.blocks) && row.blocks.length > 0
      ? (row.blocks as Block[])
      : DEFAULT_BLOCKS;

  const plan: LessonPlan = {
    id: row.id,
    class_id: row.class_id,
    curriculum_lesson_id: row.curriculum_lesson_id,
    lesson_date: row.lesson_date,
    period: row.period,
    status: row.status,
    smartt_objective: row.smartt_objective,
    smartt_check: row.smartt_check,
    blocks,
    created_by: row.created_by,
    submitted_at: row.submitted_at,
    reviewed_at: row.reviewed_at,
    review_note: row.review_note,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };

  return { plan, classContext, curriculum, activitiesByBlock };
}

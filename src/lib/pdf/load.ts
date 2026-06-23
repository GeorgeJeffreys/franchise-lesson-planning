// Data layer for the lesson-plan PDFs.
//
// Every read goes through the auth'd, cookie-bound Supabase server client, so
// RLS scopes results to the signed-in user exactly as the editor and overview
// do — the service-role key is never used here. These loaders return the
// presentational `PlanPdfModel` (see ./types) and never leak raw DB rows to the
// document components.

import { createClient } from '@/lib/supabase/server';
import { loadPlanForEditor } from '@/lib/editor/load-plan';
import { getLessonById } from '@/lib/curriculumUtils';
import { DEFAULT_BLOCKS } from '@/lib/blocks';
import { mondayOf, weekdayDates } from '@/lib/week';
import type { Block, LessonPlan } from '@/types/lesson';
import type { PdfCurriculumContext, PlanPdfModel } from './types';

/**
 * Load a single plan as a PDF model. Reuses the editor loader (same RLS-scoped
 * query for plan + class + curriculum) and drops the editor-only activity bank.
 * Returns null when the plan is missing or hidden by RLS, so the route can 404.
 */
export async function loadPlanPdfModel(id: string): Promise<PlanPdfModel | null> {
  const data = await loadPlanForEditor(id);
  if (!data) return null;

  return {
    plan: data.plan,
    classContext: {
      year: data.classContext.year,
      groupLabel: data.classContext.groupLabel,
      schoolName: data.classContext.schoolName,
      subjectName: data.classContext.subjectName,
    },
    curriculum: data.curriculum,
  };
}

// Joined-row shapes for the week query. The generated Database type is still a
// placeholder, so the client can't infer nested selects — narrow by hand, as
// the editor and overview loaders do.
interface RawClassJoin {
  id: string;
  year: number;
  group_label: string;
  school: { name: string } | { name: string }[] | null;
  subject: { name: string } | { name: string }[] | null;
}

interface RawWeekPlanRow {
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
  return Array.isArray(v) ? v[0] ?? null : v ?? null;
}

async function resolveCurriculum(curriculumLessonId: string): Promise<PdfCurriculumContext | null> {
  const lookup = await getLessonById(curriculumLessonId);
  const lesson = Array.isArray(lookup) ? lookup[0] : lookup;
  if (!lesson) return null;
  return { dailyLO: lesson.dailyLO, focusArea: lesson.linguisticSkill, theme: lesson.theme };
}

/**
 * Load every plan for one class within a week (Mon–Fri), ordered for printing
 * (by date, then period). `week` is any date in the target week; it is
 * normalised to that week's Monday. RLS limits visibility to plans the user may
 * see. Returns an empty array when the class has no plans that week.
 */
export async function loadWeekPdfModels(
  classId: string,
  week: string,
): Promise<PlanPdfModel[]> {
  const supabase = await createClient();
  const dates = weekdayDates(mondayOf(week));

  const { data, error } = await supabase
    .from('lesson_plans')
    .select(
      `id, class_id, curriculum_lesson_id, lesson_date, period, status,
       smartt_objective, smartt_check, blocks, created_by, submitted_at,
       reviewed_at, review_note, created_at, updated_at,
       class:classes (
         id, year, group_label,
         school:schools ( name ),
         subject:subjects ( name )
       )`,
    )
    .eq('class_id', classId)
    .gte('lesson_date', dates.mon)
    .lte('lesson_date', dates.fri)
    .order('lesson_date', { ascending: true })
    .order('period', { ascending: true, nullsFirst: true });

  if (error || !data) return [];

  const rows = data as unknown as RawWeekPlanRow[];

  // Resolve curriculum context for every plan up front (the build below is
  // synchronous). Reads are cached and deduped per curriculum id.
  const curriculumByKey = new Map<string, PdfCurriculumContext | null>();
  await Promise.all(
    [...new Set(rows.map((r) => r.curriculum_lesson_id))].map(async (id) => {
      curriculumByKey.set(id, await resolveCurriculum(id));
    }),
  );

  return rows.flatMap((row): PlanPdfModel[] => {
    const rawClass = one(row.class);
    if (!rawClass) return [];

    const school = one(rawClass.school);
    const subject = one(rawClass.subject);

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

    return [
      {
        plan,
        classContext: {
          year: rawClass.year,
          groupLabel: rawClass.group_label,
          schoolName: school?.name ?? '',
          subjectName: subject?.name ?? '',
        },
        curriculum: curriculumByKey.get(row.curriculum_lesson_id) ?? null,
      },
    ];
  });
}

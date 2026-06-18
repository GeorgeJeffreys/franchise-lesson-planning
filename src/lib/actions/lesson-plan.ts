'use server';

import { createClient } from '@/lib/supabase/server';
import { hasObjectiveContent } from '@/lib/editor/objective';
import type { Block } from '@/types/lesson';

export interface SavePlanInput {
  id: string;
  /** The full objective string, stem included (use composeObjective on the client). */
  smartt_objective: string | null;
  blocks: Block[];
}

export interface ActionResult {
  ok: boolean;
  error?: string;
  /** Server timestamp of the write, for the "Saved" indicator. */
  updated_at?: string;
}

/**
 * Autosave the editable lesson-plan state (objective + blocks) via the auth'd
 * client. RLS guarantees a teacher can only write a plan they created or are
 * assigned to. The `updated_at` trigger stamps the row.
 */
export async function saveLessonPlan(input: SavePlanInput): Promise<ActionResult> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('lesson_plans')
    .update({
      smartt_objective: input.smartt_objective || null,
      blocks: input.blocks,
    })
    .eq('id', input.id)
    .select('updated_at')
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'Plan not found or not permitted.' };

  return { ok: true, updated_at: data.updated_at };
}

/**
 * Submit a plan for coordinator approval: persists the latest objective + blocks,
 * then sets status to `submitted` and stamps `submitted_at`. Guarded by a
 * non-empty objective (beyond the enforced stem).
 */
export async function submitLessonPlan(input: SavePlanInput): Promise<ActionResult> {
  if (!hasObjectiveContent(input.smartt_objective)) {
    return { ok: false, error: 'Add a SMARTT objective before submitting.' };
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('lesson_plans')
    .update({
      smartt_objective: input.smartt_objective || null,
      blocks: input.blocks,
      status: 'submitted',
      submitted_at: new Date().toISOString(),
    })
    .eq('id', input.id)
    .select('updated_at')
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'Plan not found or not permitted.' };

  return { ok: true, updated_at: data.updated_at };
}

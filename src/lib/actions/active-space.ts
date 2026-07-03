"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Set the caller's active subject space to a (centre, subject) they belong to.
 *
 * Writes through the `set_primary_space` SECURITY DEFINER RPC (migration 0039):
 * `subject_membership` has no self-UPDATE RLS policy, so a direct `.update()` of
 * `is_primary` would be blocked — the RPC asserts ownership and flips the primary
 * flag atomically. On success we revalidate the whole app so the header chip, the
 * board, and the curriculum default all re-resolve to the new space; the caller
 * (the header switcher) reverts its optimistic UI when `ok` is false.
 */
export async function setActiveSpace(
  schoolId: string,
  subjectId: string,
): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_primary_space", {
    target_school: schoolId,
    target_subject: subjectId,
  });
  if (error) return { ok: false };

  // Every subject-defaulting surface reads the active space server-side, so
  // revalidate at the layout level to refresh the chip, board, and curriculum.
  revalidatePath("/", "layout");
  return { ok: true };
}

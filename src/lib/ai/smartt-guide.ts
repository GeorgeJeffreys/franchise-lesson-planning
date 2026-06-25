import 'server-only';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';

/**
 * Active SMARTT-objective-guide reader.
 *
 * The guide is the admin-uploaded steering text (Kadria's guidance) that forms
 * the MIDDLE of the objective checker's composed system prompt:
 *   [hardcoded role + org framing] → [this guide] → [hardcoded FLOOR + contract]
 * It is stored as text rows in `smartt_objective_guide` (latest `created_at` =
 * active version; see migration 0020). This module is the single read path for
 * the objective checker (`@/lib/ai/check-objective`).
 *
 * This is a faithful clone of `@/lib/ai/resource-guide` — see that module for the
 * shared rationale.
 *
 * Read path: the check-objective endpoint runs in teachers' (non-admin)
 * requests, which must not use the service-role key. Direct SELECT on the table
 * is admin-only, so the active content is exposed via the security-definer
 * `get_active_smartt_guide()` RPC (returns only the latest content, never the
 * history). When no guide has been uploaded the RPC returns null and we fall
 * back to {@link DEFAULT_SMARTT_GUIDE} so the check never breaks.
 */

/**
 * Hardcoded fallback guide used when the `smartt_objective_guide` table is empty.
 *
 * This is the STEERING half of the original hardcoded check-objective prompt —
 * how to judge each letter, the feedback granularity, and the tone. The
 * STRUCTURE/CONTRACT half (the six SMARTT letter definitions, the fixed stem, and
 * the JSON output shape) deliberately stays in code as the FLOOR in
 * `@/lib/ai/check-objective`, so a bad or empty upload can never strip it or
 * break the SmarttCheck shape the pills depend on.
 *
 * Because this default reproduces exactly the steering the original prompt
 * carried, the composed prompt with NO guide uploaded is behaviourally identical
 * to the pre-refactor prompt.
 */
export const DEFAULT_SMARTT_GUIDE = `For each of the six SMARTT letters, decide a status of "strong" or "needs work" and write a single, specific one-line note (no more than one sentence). Then give one or two overall suggestions to tighten the objective, and a suggested improved rewrite.

The improved rewrite should continue, after the fixed stem, with an observable, student-facing action.

Keep all notes and suggestions short, plain, and practical for a busy teacher. Base your judgement only on the objective and any context provided; do not invent facts about the lesson.`;

/**
 * Return the active guide's content for the objective checker, falling back to
 * {@link DEFAULT_SMARTT_GUIDE} when no guide has been uploaded (or the read
 * fails). Memoised per-request via React `cache()` so multiple checks in one
 * request share a single DB round-trip.
 */
export const getActiveSmarttGuide = cache(async (): Promise<string> => {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('get_active_smartt_guide');
    if (error) return DEFAULT_SMARTT_GUIDE;
    const content = typeof data === 'string' ? data.trim() : '';
    return content.length > 0 ? content : DEFAULT_SMARTT_GUIDE;
  } catch {
    return DEFAULT_SMARTT_GUIDE;
  }
});

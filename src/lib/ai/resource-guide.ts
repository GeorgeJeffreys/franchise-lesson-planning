import 'server-only';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';

/**
 * Active AI-resource-guide reader.
 *
 * The guide is the admin-uploaded best-practice text that forms the MIDDLE of
 * the generator's composed system prompt:
 *   [hardcoded role + org framing] → [this guide] → [hardcoded SAFETY FLOOR + contract]
 * It is stored as text rows in `ai_resource_guide` (latest `created_at` = active
 * version; see migration 0016). This module is the single read path for the
 * generator.
 *
 * Read path: the generate-resource endpoint runs in teachers' (non-admin)
 * requests, which must not use the service-role key. Direct SELECT on the table
 * is admin-only, so the active content is exposed via the security-definer
 * `get_active_resource_guide()` RPC (returns only the latest content, never the
 * history). When no guide has been uploaded the RPC returns null and we fall
 * back to {@link DEFAULT_RESOURCE_GUIDE} so generation never breaks.
 */

/**
 * Hardcoded fallback guide used when the `ai_resource_guide` table is empty.
 *
 * This is a compact version of the rich steering an admin would upload —
 * curriculum anchoring, literacy matching, and content guidance. It deliberately
 * overlaps with (but does not replace) the in-code SAFETY FLOOR + output contract
 * that the generator always appends after the guide; the floor stays in code so a
 * bad upload can never remove it.
 */
export const DEFAULT_RESOURCE_GUIDE = `CURRICULUM CONSTRAINTS (always active):
The daily outcome, weekly outcome, grammar & vocabulary, and theme are non-negotiable anchors. The resource MUST serve them. The teacher's prompt describes the format and context they want; the curriculum fields define the learning target. If the teacher's prompt would pull the resource away from the curriculum target, fulfil the prompt WITHIN the curriculum constraints — not instead of them.

MATCH FORMAT TO LITERACY (use year + literacy_flag together; never ask the teacher):
- Year 0-1, or literacy_flag "illiterate": pre/early literacy — oral instructions, image-matching, trace/copy tasks. Assume no independent reading.
- Year 2-3: emerging literacy — short sentences, supported reading, fill-in-the-blank with word banks.
- Year 4-5: developing literacy — paragraph-length texts, guided writing frames, structured exercises.
- Year 6: near-functional literacy — full reading passages, open-ended prompts, multi-step tasks.
- literacy_flag "mixed": produce a two-tier resource — a supported version AND a stretch version in the same resource.
- literacy_flag "literate": use the year-appropriate approach above.

CONTENT GUIDANCE (apply by default):
Do NOT assume students live in houses with gardens, go on holidays abroad, or have stable family structures. Treat all faiths equally; do not centre any one religion unless the theme explicitly calls for it.

USE INSTEAD:
- Urban Beirut and Syrian contexts: markets, buses, mobile phones, local food, neighbourhood landmarks.
- Aspirational contexts: work, skills, qualifications, travel, technology, sports.
- The real-world objects and situations the teacher has anchored their prompt to.

SENSITIVE TOPICS:
- Default: avoid sensitive topics without comment — simply don't go there.
- If the teacher's prompt drifts toward a sensitive area by accident: redirect gracefully. Fulfil the learning objective through a safer equivalent context. Do NOT explain or flag the redirect in your output.
- If the teacher explicitly frames a sensitive topic as intentional (e.g. "my students are ready to discuss their journey to Lebanon"): respect that professional judgement and generate accordingly, but keep the tone anchored in resilience and agency, not victimhood.`;

/**
 * Return the active guide's content for the generator, falling back to
 * {@link DEFAULT_RESOURCE_GUIDE} when no guide has been uploaded (or the read
 * fails). Memoised per-request via React `cache()` so multiple generate calls in
 * one request share a single DB round-trip.
 */
export const getActiveResourceGuide = cache(async (): Promise<string> => {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('get_active_resource_guide');
    if (error) return DEFAULT_RESOURCE_GUIDE;
    const content = typeof data === 'string' ? data.trim() : '';
    return content.length > 0 ? content : DEFAULT_RESOURCE_GUIDE;
  } catch {
    return DEFAULT_RESOURCE_GUIDE;
  }
});

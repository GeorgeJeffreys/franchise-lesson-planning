// Client wrapper for POST /api/generate-resource — the "Generate with AI" path
// of the worksheet builder. Mirrors the route's documented contract and maps
// non-2xx responses to a typed error the composer can surface inline.

import type { WorksheetContext } from '@/components/editor/worksheet/context';

export interface GeneratedResource {
  title: string;
  body: string; // markdown
  teacher_notes: string | null;
}

export class GenerateResourceRequestError extends Error {}

/**
 * Ask the generator for a resource, using the lesson's curriculum context.
 * `lesson_stage` is fixed to the Practise step.
 *
 * Two modes:
 *  - Fresh generate: pass `teacherPrompt`.
 *  - Stateless adjust: pass `currentContent` (the doc as it stands, in markdown)
 *    + `refinement` (the change). The endpoint refines the content and returns the
 *    full updated resource; `teacherPrompt` may be empty.
 */
export async function requestGeneratedResource(
  ctx: WorksheetContext,
  teacherPrompt: string,
  refinement?: string,
  currentContent?: string,
): Promise<GeneratedResource> {
  const res = await fetch('/api/generate-resource', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subject: ctx.subjectName,
      year: ctx.year ?? 0,
      daily_outcome: ctx.dailyOutcome,
      weekly_outcome: ctx.weeklyOutcome,
      monthly_lo: ctx.monthlyLo,
      grammar_vocab: ctx.grammarVocab,
      theme: ctx.theme,
      lesson_stage: 'independent_practice',
      ...(teacherPrompt.trim() ? { teacher_prompt: teacherPrompt } : {}),
      ...(refinement ? { refinement } : {}),
      ...(currentContent ? { current_content: currentContent } : {}),
    }),
  });

  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    // fall through to the status-based error below
  }

  if (!res.ok) {
    const message =
      payload && typeof payload === 'object' && 'error' in payload
        ? String((payload as { error: unknown }).error)
        : `The generator failed (${res.status}).`;
    throw new GenerateResourceRequestError(message);
  }

  if (
    !payload ||
    typeof payload !== 'object' ||
    typeof (payload as GeneratedResource).title !== 'string' ||
    typeof (payload as GeneratedResource).body !== 'string'
  ) {
    throw new GenerateResourceRequestError('The generator returned an unexpected response.');
  }

  const p = payload as GeneratedResource;
  return { title: p.title, body: p.body, teacher_notes: p.teacher_notes ?? null };
}

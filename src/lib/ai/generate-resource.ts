import Anthropic from '@anthropic-ai/sdk';

/**
 * AI teaching-resource generator service ("Aya").
 *
 * Generates a single, ready-to-use, text-based teaching resource from a
 * lesson's curriculum context plus a teacher's free-text prompt, using Claude.
 * This module is the single home for the prompt, the model call, and the safe
 * parsing of the model's reply; callers (currently the
 * `POST /api/generate-resource` route handler) only ever see the typed result
 * or a thrown `GenerateResourceError`.
 *
 * Backend-only: this runs server-side and reads `ANTHROPIC_API_KEY` from the
 * environment. It is destination-agnostic — it returns generated content and
 * does not decide where it lands, and deliberately does not touch Supabase, the
 * lesson schema, the resource bank, or any editor state.
 */

/** Model used for generation. Pinned deliberately — see CLAUDE.md model notes. */
const MODEL = 'claude-sonnet-4-6';

/**
 * Lesson stage the resource targets. Mirrors the codebase block enum — note it
 * is `independent_practice`, NOT "practice".
 */
export type LessonStage = 'new_content' | 'independent_practice';

/**
 * Everything needed to generate (or adjust) a resource. The curriculum fields are
 * non-negotiable anchors.
 *
 * Two modes share this shape:
 *  - Fresh generate: `teacher_prompt` describes the format/context wanted.
 *  - Stateless adjust: `current_content` (the doc as it stands, in markdown) plus
 *    `refinement` (the change to apply). The model returns the full updated
 *    resource; `teacher_prompt` is not required.
 */
export interface GenerateResourceContext {
  /** Subject the lesson teaches (e.g. "English"). */
  subject: string;
  /** Year group the lesson is aimed at. */
  year: number;
  /** The day's intended learning outcome. */
  daily_outcome: string;
  /** The week's intended learning outcome (sent to the model, not echoed back). */
  weekly_outcome: string;
  /** Grammar / vocabulary focus for the lesson. */
  grammar_vocab: string;
  /** Lesson or unit theme. */
  theme: string;
  /** Lesson stage the resource is for. */
  lesson_stage: LessonStage;
  /** The teacher's free-text request. Required for a fresh generate; ignored on adjust. */
  teacher_prompt?: string;
  /** The change to apply (typed instruction or preset chip). Set on an adjust call. */
  refinement?: string;
  /** The current resource (markdown) to refine. When present with `refinement`, the
   *  call is a stateless adjust: apply the refinement to this and return the full result. */
  current_content?: string;
}

/** Structured result of generating a resource. */
export interface GenerateResourceResult {
  /** Short descriptive title for the resource. */
  title: string;
  /** Full resource content in simple markdown. */
  body: string;
  /** Optional brief guidance for the teacher, or null. */
  teacher_notes: string | null;
}

/**
 * Error thrown when generation cannot be completed. `status` is an HTTP status
 * the route handler can surface directly.
 */
export class GenerateResourceError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'GenerateResourceError';
    this.status = status;
  }
}

/** JSON Schema the model's reply is constrained to (structured outputs). */
const RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    body: { type: 'string' },
    teacher_notes: { type: ['string', 'null'] },
  },
  required: ['title', 'body', 'teacher_notes'],
} as const;

const SYSTEM_PROMPT = `You are Aya, a teaching-resource generator for Alsama, a refugee-education organisation. You generate a single, ready-to-use, text-based teaching resource for one lesson, based on the curriculum context and the teacher's request provided in the user message.

CURRICULUM CONSTRAINTS (always active):
The daily outcome, weekly outcome, grammar & vocabulary, and theme are non-negotiable anchors. The resource MUST serve them. The teacher's prompt describes the format and context they want; the curriculum fields define the learning target. If the teacher's prompt would pull the resource away from the curriculum target, fulfil the prompt WITHIN the curriculum constraints — not instead of them.

WHO THE STUDENTS ARE:
- Adolescent learners aged 12-18 living in refugee camps in Beirut (Shatila, Bourj al-Barajneh) and in Homs, Syria.
- Mostly Syrian, with Palestinian and Lebanese students. Religiously and culturally diverse — treat all backgrounds with equal respect.
- Arabic is their first language. Resources are for classroom learning in the target subject language.
- Many have experienced trauma and displacement. Content should be calm, affirming, and grounded in possibility.

MATCH FORMAT TO YEAR (infer the reading level from the year group; never ask the teacher):
- Year 0-1: pre/early literacy — oral instructions, image-matching, trace/copy tasks. Assume no independent reading.
- Year 2-3: emerging literacy — short sentences, supported reading, fill-in-the-blank with word banks.
- Year 4-5: developing literacy — paragraph-length texts, guided writing frames, structured exercises.
- Year 6: near-functional literacy — full reading passages, open-ended prompts, multi-step tasks.

CONTENT GUARDRAILS (apply by default):
Do NOT generate content involving: family separation or the death of a parent/sibling; war or conflict imagery; references to detention or immigration enforcement; grief or loss as a primary theme; hunger or poverty as a framing device.
Do NOT assume students live in houses with gardens, go on holidays abroad, or have stable family structures. Do NOT use Western cultural references as defaults (e.g. Christmas, Halloween, American/British pop culture). Treat all faiths equally; do not centre any one religion unless the theme explicitly calls for it.

USE INSTEAD:
- Urban Beirut and Syrian contexts: markets, buses, mobile phones, local food, neighbourhood landmarks.
- Aspirational contexts: work, skills, qualifications, travel, technology, sports.
- The real-world objects and situations the teacher has anchored their prompt to.

SENSITIVE TOPICS:
- Default: avoid sensitive topics without comment — simply don't go there.
- If the teacher's prompt drifts toward a sensitive area by accident: redirect gracefully. Fulfil the learning objective through a safer equivalent context. Do NOT explain or flag the redirect in your output.
- If the teacher explicitly frames a sensitive topic as intentional (e.g. "my students are ready to discuss their journey to Lebanon"): respect that professional judgement and generate accordingly, but keep the tone anchored in resilience and agency, not victimhood.

OUTPUT:
Return ONLY a JSON object with keys "title", "body", "teacher_notes". "body" is the full resource in simple markdown. No code fences, no commentary outside the JSON.`;

/** True when this call refines an existing resource rather than generating fresh. */
function isAdjustCall(context: GenerateResourceContext): boolean {
  return (
    typeof context.current_content === 'string' &&
    context.current_content.trim().length > 0 &&
    typeof context.refinement === 'string' &&
    context.refinement.trim().length > 0
  );
}

/** Build the user-turn prompt from the curriculum context and teacher request. */
function buildUserPrompt(context: GenerateResourceContext): string {
  const lines: string[] = [
    'Curriculum context (non-negotiable anchors — the resource MUST serve these):',
    `- Subject: ${context.subject}`,
    `- Year group: ${context.year}`,
    `- Daily outcome: ${context.daily_outcome}`,
    `- Weekly outcome: ${context.weekly_outcome}`,
    `- Grammar / vocabulary: ${context.grammar_vocab}`,
    `- Theme: ${context.theme}`,
    `- Lesson stage: ${context.lesson_stage}`,
    '',
  ];

  if (isAdjustCall(context)) {
    // Stateless adjust: the provided content is the single source of truth — apply
    // the change to it and return the FULL updated resource. No conversation history.
    lines.push(
      'You are refining an EXISTING resource. Apply the requested change to the resource below and return the FULL updated resource (not just the changed part). Keep everything the teacher already has, except where the change says otherwise, and keep it serving the curriculum anchors above.',
      '',
      'Current resource (markdown):',
      context.current_content!.trim(),
      '',
      `Requested change: ${context.refinement!.trim()}`,
    );
  } else {
    lines.push(`Teacher's request:\n${(context.teacher_prompt ?? '').trim()}`);
    if (context.refinement && context.refinement.trim().length > 0) {
      lines.push(`\nRefinement: ${context.refinement.trim()}`);
    }
  }

  lines.push(
    '\nReturn ONLY the JSON object with keys "title", "body", "teacher_notes". Do not wrap it in markdown or add any prose.',
  );
  return lines.join('\n');
}

/** Pull the concatenated text out of a Claude message response. */
function extractText(message: Anthropic.Message): string {
  return message.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('')
    .trim();
}

/**
 * Parse the model's reply into a result, tolerating an accidental markdown
 * fence. Throws {@link GenerateResourceError} (502) if the text is not the
 * expected JSON shape.
 */
function parseResult(text: string): GenerateResourceResult {
  let raw = text;
  // Strip a ```json … ``` fence if the model added one despite instructions.
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fence) raw = fence[1].trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new GenerateResourceError('Model did not return valid JSON.', 502);
  }

  if (!isGenerateResourceResult(parsed)) {
    throw new GenerateResourceError('Model JSON did not match the expected shape.', 502);
  }
  return parsed;
}

/** Runtime guard mirroring {@link GenerateResourceResult}. */
function isGenerateResourceResult(value: unknown): value is GenerateResourceResult {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (typeof v.title !== 'string') return false;
  if (typeof v.body !== 'string') return false;
  if (v.teacher_notes !== null && typeof v.teacher_notes !== 'string') return false;
  return true;
}

/**
 * Generate a teaching resource with Claude.
 *
 * @param context Curriculum context plus the teacher's prompt (and optional
 *   `refinement` on a refine call).
 * @returns The generated resource: title, markdown body, and optional notes.
 * @throws {GenerateResourceError} on missing API key (503), or an unparseable /
 *   malformed model reply (502). Field validation is the route handler's job.
 */
export async function generateResource(
  context: GenerateResourceContext,
): Promise<GenerateResourceResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new GenerateResourceError('ANTHROPIC_API_KEY is not configured.', 503);
  }

  const client = new Anthropic({ apiKey });

  let message: Anthropic.Message;
  try {
    message = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildUserPrompt(context) }],
      output_config: {
        format: {
          type: 'json_schema',
          schema: RESPONSE_SCHEMA,
        },
      },
    });
  } catch (err) {
    const status = err instanceof Anthropic.APIError && typeof err.status === 'number' ? err.status : 502;
    throw new GenerateResourceError(
      `Claude request failed: ${err instanceof Error ? err.message : 'unknown error'}`,
      status >= 500 ? 502 : status,
    );
  }

  return parseResult(extractText(message));
}

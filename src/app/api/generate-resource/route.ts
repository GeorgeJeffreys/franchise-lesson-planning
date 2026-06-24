import { NextResponse, type NextRequest } from 'next/server';
import {
  generateResource,
  GenerateResourceError,
  type GenerateResourceContext,
  type LiteracyFlag,
  type LessonStage,
} from '@/lib/ai/generate-resource';

/**
 * POST /api/generate-resource
 *
 * Backend-only endpoint that generates a single, text-based teaching resource
 * ("Aya") from a lesson's curriculum context plus a teacher's prompt. The
 * prompt, model call, and parsing all live in `@/lib/ai/generate-resource`;
 * this handler is just the HTTP boundary — it validates the request body,
 * delegates, and maps errors to status codes.
 *
 * Destination-agnostic: it returns generated content; the caller decides where
 * it lands. No tags, resource_type, or lesson_stage are returned.
 *
 * Request body:
 *   {
 *     "subject": string,
 *     "year": number,
 *     "literacy_flag": "literate" | "illiterate" | "mixed",
 *     "daily_outcome": string,
 *     "weekly_outcome": string,
 *     "grammar_vocab": string,
 *     "theme": string,
 *     "lesson_stage": "new_content" | "independent_practice",
 *     "teacher_prompt": string,
 *     "refinement"?: string
 *   }
 *
 * Requires `ANTHROPIC_API_KEY` in the environment (locally and on Vercel).
 */

/** Shape we accept on the wire (validated before use). */
interface GenerateResourceBody {
  subject?: unknown;
  year?: unknown;
  literacy_flag?: unknown;
  daily_outcome?: unknown;
  weekly_outcome?: unknown;
  grammar_vocab?: unknown;
  theme?: unknown;
  lesson_stage?: unknown;
  teacher_prompt?: unknown;
  refinement?: unknown;
}

const LITERACY_FLAGS: readonly LiteracyFlag[] = ['literate', 'illiterate', 'mixed'];
const LESSON_STAGES: readonly LessonStage[] = ['new_content', 'independent_practice'];

/** Returns true for a present, non-empty string. */
function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export async function POST(request: NextRequest) {
  let body: GenerateResourceBody;
  try {
    body = (await request.json()) as GenerateResourceBody;
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }

  const requiredStrings: [keyof GenerateResourceBody, unknown][] = [
    ['subject', body.subject],
    ['daily_outcome', body.daily_outcome],
    ['weekly_outcome', body.weekly_outcome],
    ['grammar_vocab', body.grammar_vocab],
    ['theme', body.theme],
    ['teacher_prompt', body.teacher_prompt],
  ];
  for (const [field, value] of requiredStrings) {
    if (!isNonEmptyString(value)) {
      return NextResponse.json(
        { error: `Field "${field}" is required and must be a non-empty string.` },
        { status: 400 },
      );
    }
  }

  if (typeof body.year !== 'number' || !Number.isFinite(body.year)) {
    return NextResponse.json(
      { error: 'Field "year" is required and must be a number.' },
      { status: 400 },
    );
  }

  if (!LITERACY_FLAGS.includes(body.literacy_flag as LiteracyFlag)) {
    return NextResponse.json(
      { error: `Field "literacy_flag" must be one of: ${LITERACY_FLAGS.join(', ')}.` },
      { status: 400 },
    );
  }

  if (!LESSON_STAGES.includes(body.lesson_stage as LessonStage)) {
    return NextResponse.json(
      { error: `Field "lesson_stage" must be one of: ${LESSON_STAGES.join(', ')}.` },
      { status: 400 },
    );
  }

  if (body.refinement !== undefined && typeof body.refinement !== 'string') {
    return NextResponse.json(
      { error: 'Field "refinement" must be a string when provided.' },
      { status: 400 },
    );
  }

  const context: GenerateResourceContext = {
    subject: body.subject as string,
    year: body.year,
    literacy_flag: body.literacy_flag as LiteracyFlag,
    daily_outcome: body.daily_outcome as string,
    weekly_outcome: body.weekly_outcome as string,
    grammar_vocab: body.grammar_vocab as string,
    theme: body.theme as string,
    lesson_stage: body.lesson_stage as LessonStage,
    teacher_prompt: body.teacher_prompt as string,
    ...(typeof body.refinement === 'string' ? { refinement: body.refinement } : {}),
  };

  try {
    const result = await generateResource(context);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof GenerateResourceError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Unexpected error generating resource.' }, { status: 500 });
  }
}

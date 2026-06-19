// Suggested-resource matching for the embedded Resource Bank panel (editor
// steps 2 & 3). The Suggested tab fetches a broad candidate set (the lesson's
// subject + year) and ranks it by how well each resource matches the lesson's
// context — its theme, the focus skill, and the step's lesson stage. The score
// is a simple weighted overlap, presented as a percentage.

import type { ResourceWithTags, TagDimension } from '@/types/resource';

/** The lesson context a step matches its suggestions against. */
export interface SuggestContext {
  subjectId: string | null;
  year: number | null;
  /** The curriculum theme label (e.g. "Food & Drink"). */
  themeLabel: string | null;
  /** The focus/linguistic skill label (e.g. "Reading"). */
  skillLabel: string | null;
  /** Lowercase keywords identifying this step's lesson stage. */
  stageKeywords: string[];
}

/** Per-step lesson-stage keywords, matched against the `lesson_stage` tag label. */
export const STAGE_KEYWORDS: Record<'teach' | 'practise', string[]> = {
  teach: ['new content', 'content', 'input', 'model', 'present', 'instruction', 'i do'],
  practise: ['practice', 'practise', 'independent', 'group', 'application', 'you do'],
};

function norm(s: string): string {
  return s.trim().toLowerCase();
}

function hasTag(
  r: ResourceWithTags,
  dimension: TagDimension,
  predicate: (label: string) => boolean
): boolean {
  return r.tags.some((t) => t.dimension === dimension && predicate(norm(t.label)));
}

interface Weighted {
  weight: number;
  present: boolean;
  satisfied: boolean;
}

/**
 * A 0–100 match score for a resource against the lesson context. Only the
 * signals the context actually carries count toward the denominator, so a sparse
 * context still yields a meaningful percentage.
 */
export function matchScore(r: ResourceWithTags, ctx: SuggestContext): number {
  const theme = ctx.themeLabel ? norm(ctx.themeLabel) : '';
  const skill = ctx.skillLabel ? norm(ctx.skillLabel) : '';

  const signals: Weighted[] = [
    {
      weight: 20,
      present: !!ctx.subjectId,
      satisfied: !!ctx.subjectId && r.subject_id === ctx.subjectId,
    },
    {
      weight: 20,
      present: ctx.year != null,
      satisfied: ctx.year != null && r.year === ctx.year,
    },
    {
      weight: 25,
      present: !!theme,
      satisfied: !!theme && hasTag(r, 'theme', (l) => l.includes(theme) || theme.includes(l)),
    },
    {
      weight: 20,
      present: !!skill,
      satisfied: !!skill && hasTag(r, 'skill_type', (l) => l === skill || l.includes(skill)),
    },
    {
      weight: 15,
      present: ctx.stageKeywords.length > 0,
      satisfied: hasTag(r, 'lesson_stage', (l) => ctx.stageKeywords.some((k) => l.includes(k))),
    },
  ];

  let max = 0;
  let got = 0;
  for (const s of signals) {
    if (!s.present) continue;
    max += s.weight;
    if (s.satisfied) got += s.weight;
  }
  if (max === 0) return 0;
  return Math.round((got / max) * 100);
}

/** A resource paired with its computed match score, ranked high-to-low. */
export interface ScoredResource {
  resource: ResourceWithTags;
  score: number;
}

/** Score and rank candidates by match (then by popularity as a tiebreak). */
export function rankByMatch(
  candidates: ResourceWithTags[],
  ctx: SuggestContext
): ScoredResource[] {
  return candidates
    .map((resource) => ({ resource, score: matchScore(resource, ctx) }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.resource.usage_count - a.resource.usage_count;
    });
}

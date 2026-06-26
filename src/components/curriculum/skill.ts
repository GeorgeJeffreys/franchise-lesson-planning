// Linguistic-skill → colour mapping for the Curriculum browse screen. Client-safe
// (no server imports) so both the server data layer and the client components can
// use `skillKeyOf`. The four macro skills get the categorical colours sampled into
// `--color-skill-*` (globals.css); anything else (grammar terms, "mixed", exam
// rows, blank) falls back to the neutral cream-grey `other`.
//
// Class strings are written out in full literal form so Tailwind's source scan
// detects them (it cannot see dynamically-built class names).

import type { SkillKey } from '@/types/curriculum-browse';

/** Normalise a raw `linguistic_skill` label to a macro-skill key. */
export function skillKeyOf(label: string): SkillKey {
  const s = label.toLowerCase();
  if (s.includes('read')) return 'reading';
  if (s.includes('writ')) return 'writing';
  if (s.includes('listen')) return 'listening';
  if (s.includes('speak')) return 'speaking';
  return 'other';
}

/** Coloured text class for the table's Skill column (no fill, as in the design). */
export const SKILL_TEXT: Record<SkillKey, string> = {
  reading: 'text-skill-reading',
  writing: 'text-skill-writing',
  listening: 'text-skill-listening',
  speaking: 'text-skill-speaking',
  other: 'text-skill-other',
};

/** Tinted-pill class (fill + text + border) for the focus card's skill chip. */
export const SKILL_PILL: Record<SkillKey, string> = {
  reading: 'bg-skill-reading-bg text-skill-reading border-skill-reading-border',
  writing: 'bg-skill-writing-bg text-skill-writing border-skill-writing-border',
  listening: 'bg-skill-listening-bg text-skill-listening border-skill-listening-border',
  speaking: 'bg-skill-speaking-bg text-skill-speaking border-skill-speaking-border',
  other: 'bg-skill-other-bg text-skill-other border-skill-other-border',
};

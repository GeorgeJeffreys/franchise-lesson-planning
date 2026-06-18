// Helpers for the SMARTT objective field. The objective is stored whole in
// `lesson_plans.smartt_objective`, but the editor ENFORCES a fixed opening stem
// and only lets the teacher edit the remainder. These helpers keep the stored
// string and the editable remainder in sync.

/** The enforced opening of every SMARTT objective. */
export const OBJECTIVE_STEM = 'By the end of this session, students will be able to';

/** The six SMARTT criteria, shown as guidance in the pink box. */
export const SMARTT_CRITERIA: { label: string; description: string }[] = [
  { label: 'Specific', description: 'Targets one clear, concrete skill or outcome.' },
  { label: 'Measurable', description: 'Uses a verb you can observe and count (identify, list, read…).' },
  { label: 'Achievable', description: 'Realistic for these students in one 50-minute session.' },
  { label: 'Relevant', description: "Connected to the curriculum outcome and students' level." },
  { label: 'Time-bound', description: 'Bounded by the lesson — e.g. "by the end of this session".' },
  { label: 'Tangible', description: "Relatable to students' real lives." },
];

/**
 * Strip the enforced stem (and any leading punctuation/whitespace) from a stored
 * objective, returning just the teacher-editable remainder.
 */
export function stripStem(full: string | null | undefined): string {
  if (!full) return '';
  let rest = full.trim();
  if (rest.toLowerCase().startsWith(OBJECTIVE_STEM.toLowerCase())) {
    rest = rest.slice(OBJECTIVE_STEM.length);
  }
  return rest.replace(/^[\s.,:;-]+/, '').trim();
}

/**
 * Compose the full objective string to persist from the editable remainder.
 * Returns an empty string when the teacher has written nothing yet, so an
 * "objective is empty" check is simply `composeObjective(r) === ''`.
 */
export function composeObjective(remainder: string): string {
  const r = remainder.trim();
  return r ? `${OBJECTIVE_STEM} ${r}` : '';
}

/** True when the stored objective has real content beyond the stem. */
export function hasObjectiveContent(full: string | null | undefined): boolean {
  return stripStem(full).length > 0;
}

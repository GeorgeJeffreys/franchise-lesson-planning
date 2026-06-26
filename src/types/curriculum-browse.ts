// View-model types for the read-only Curriculum browse screen (a single-week,
// "zoomed-in" view of the curriculum table). These describe the shape the data
// layer (src/lib/curriculum-browse.ts) returns and the client components render.
//
// Everything on this screen is locked, curriculum-provided content — there are no
// teacher-editable fields here. The only action is the teal "Plan this lesson"
// CTA, which carries a curriculum slot's `lessonKey` into the existing
// create-from-curriculum flow (createScopedPlan).
//
// Kept free of server-only imports so the client components can import it.

/** A subject offered by the Subject selector (code + display name). */
export interface BrowseSubject {
  /** The `curriculum_lesson.subject_code` / `subjects.code` (e.g. "english"). */
  code: string;
  /** Friendly name from `subjects.name`, falling back to the code when unknown. */
  name: string;
}

/** A (month, week) curriculum coordinate the week stepper steps through. */
export interface BrowseCoordinate {
  month: string;
  week: number;
}

/** The four macro linguistic skills, plus a neutral fallback for anything else. */
export type SkillKey = 'reading' | 'writing' | 'listening' | 'speaking' | 'other';

/** One curriculum period (a table row + the focus card's source). */
export interface BrowseRow {
  /** Curriculum period (1–5). 1 = Mon … 5 = Fri. */
  period: number;
  /** Mon–Fri column index derived from the period (1–5). */
  weekday: number;
  /** Daily learning outcome (stem-cleaned). May be empty. */
  dailyOutcome: string;
  /** Raw linguistic-skill label as stored (drives the pill text). */
  linguisticSkill: string;
  /** Normalised macro-skill key — picks the pill colour. */
  skillKey: SkillKey;
  /** Thematic context (`theme`). Empty when the row has none. */
  theme: string;
  /** Structured resources for this period; labels are always present. */
  resources: { label: string; url?: string }[];
  /** The `curriculum_lesson.lesson_key` the "Plan this lesson" CTA writes. */
  lessonKey: string;
}

/** Weekly outcome — cleanly split into skills + knowledge in the source. */
export interface WeeklyOutcome {
  skills: string | null;
  knowledge: string | null;
}

/**
 * Monthly outcome. The source carries BOTH a combined column (`monthly_lo`) and a
 * split pair (`monthly_knowledge_lo` / `monthly_skills_lo`). Per the agreed
 * "prefer split, fall back to combined" rule, the renderer shows the split pair
 * when either side is populated, else the combined block.
 */
export interface MonthlyOutcome {
  /** Combined "Monthly Learning Outcome" (`monthly_lo`). */
  combined: string | null;
  knowledge: string | null;
  skills: string | null;
}

/** Everything the Curriculum browse screen renders for one selected week. */
export interface CurriculumBrowseData {
  /** Subjects with synced curriculum, for the Subject selector. */
  subjects: BrowseSubject[];
  /** The available years for the selected subject, ascending. */
  years: number[];
  /** The resolved selection (snapped to a real coordinate). */
  selected: {
    subjectCode: string;
    subjectName: string;
    year: number;
    month: string;
    week: number;
  };
  /** Adjacent coordinates within the subject+year (null at the ends). */
  prev: BrowseCoordinate | null;
  next: BrowseCoordinate | null;
  /** Predominant theme for the week (the header topic chip). Null when none. */
  topicChip: string | null;
  weekly: WeeklyOutcome;
  monthly: MonthlyOutcome;
  /** The week's rows, one per period, ascending. Empty when the week has none. */
  rows: BrowseRow[];
}

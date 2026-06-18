import type { CurriculumLesson, CurriculumLookup } from "@/types/curriculum";

/** Strip the leading ". " prefix that curriculum.json uses on all LO fields. */
export function cleanLO(raw: string): string {
  if (!raw) return '';
  return raw.replace(/^(\.\s*)+/, '').trim();
}

function withCleanLOs(lesson: CurriculumLesson): CurriculumLesson {
  return {
    ...lesson,
    dailyLO: cleanLO(lesson.dailyLO),
    skillLO: cleanLO(lesson.skillLO),
    knowledgeLO: cleanLO(lesson.knowledgeLO),
  };
}

// ── Boundary data cleaning ──────────────────────────────────────────────────────
// The raw spreadsheet export carries two kinds of junk that must never reach a
// consumer (indexes, lookups, server actions, the AI layer or any document):
//   1. 18 field values that are the literal string "#N/A".
//   2. 22 empty "L.*" placeholder rows (spreadsheet stubs with no lesson content).
// We scrub both exactly once here, at the JSON boundary, so the public API below
// is otherwise identical to before and every downstream caller sees clean data.

const NA_PLACEHOLDER = '#N/A';

/** Replace any "#N/A" string field with an empty string. */
function sanitizeNa(lesson: CurriculumLesson): CurriculumLesson {
  const out = { ...lesson } as Record<string, unknown>;
  for (const [key, value] of Object.entries(out)) {
    if (typeof value === 'string' && value.trim() === NA_PLACEHOLDER) {
      out[key] = '';
    }
  }
  return out as unknown as CurriculumLesson;
}

/** Empty "L.*" rows are spreadsheet placeholders with no real lesson. */
function isPlaceholderRow(lesson: CurriculumLesson): boolean {
  return lesson.id.startsWith('L.');
}

/** Scrub "#N/A" values and drop "L.*" placeholder rows, preserving the lookup shape. */
function cleanCurriculumData(raw: CurriculumLookup): CurriculumLookup {
  const cleaned: CurriculumLookup = {};
  for (const [key, entry] of Object.entries(raw)) {
    if (Array.isArray(entry)) {
      // Every row in an array shares the key's id, so placeholder filtering is
      // all-or-nothing per key; the array shape is preserved for kept keys.
      const kept = entry.filter((l) => !isPlaceholderRow(l)).map(sanitizeNa);
      if (kept.length > 0) cleaned[key] = kept;
    } else if (!isPlaceholderRow(entry)) {
      cleaned[key] = sanitizeNa(entry);
    }
  }
  return cleaned;
}

// The curriculum is a ~950 KB baked JSON export. Requiring + cleaning it is the
// single most expensive bit of work on this module, so defer it to first use
// (lazy singleton) rather than running it at import time. This keeps it off the
// critical path for requests that import this module transitively but never
// query the curriculum — notably an empty Weekly Overview week, which resolves
// no targets and so never touches it. The explicit cast also avoids TypeScript
// inferring the full nested shape (which slows type-checking).
let _rawData: CurriculumLookup | null = null;

function getRawData(): CurriculumLookup {
  if (_rawData) return _rawData;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  _rawData = cleanCurriculumData(require("@/data/curriculum.json") as CurriculumLookup);
  return _rawData;
}

// ── Lazy indexes ──────────────────────────────────────────────────────────────
// Built once on first use; keyed as `${yearNum}_${week}` and `${yearNum}`.

type WeekKey = `${number}_${number}`;

let _byWeek: Map<WeekKey, CurriculumLesson[]> | null = null;
let _byYear: Map<number, CurriculumLesson[]> | null = null;

function buildIndexes(): void {
  if (_byWeek) return;
  _byWeek = new Map();
  _byYear = new Map();

  for (const entry of Object.values(getRawData())) {
    const items: CurriculumLesson[] = Array.isArray(entry) ? entry : [entry];
    for (const lesson of items) {
      const { yearNum, week } = lesson;
      if (yearNum !== null && week !== null) {
        const wKey = `${yearNum}_${week}` as WeekKey;
        const wList = _byWeek.get(wKey) ?? [];
        wList.push(lesson);
        _byWeek.set(wKey, wList);
      }
      if (yearNum !== null) {
        const yList = _byYear!.get(yearNum) ?? [];
        yList.push(lesson);
        _byYear!.set(yearNum, yList);
      }
    }
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Look up a lesson by its identifier (e.g. `"0.S1.K1.H3"`).
 *
 * Returns a single `CurriculumLesson` for IDs that are unique across years.
 * Returns a `CurriculumLesson[]` for IDs that appear in multiple years
 * (exam-slot rows such as `"E.S0.K0.H1"`).
 * Returns `null` when the ID is not found.
 */
export function getLessonById(id: string): CurriculumLesson | CurriculumLesson[] | null {
  const entry = getRawData()[id] ?? null;
  if (!entry) return null;
  return Array.isArray(entry) ? entry.map(withCleanLOs) : withCleanLOs(entry);
}

/**
 * Return every lesson scheduled for a specific year and week, sorted by
 * period number ascending.
 *
 * `year` can be a number (0–6) or the label string `"Year 0"` … `"Year 6"`.
 */
export function getLessonsByWeek(
  year: number | string,
  week: number
): CurriculumLesson[] {
  buildIndexes();
  const yn = resolveYearNum(year);
  if (yn === null) return [];
  const key = `${yn}_${week}` as WeekKey;
  const lessons = _byWeek!.get(key) ?? [];
  return [...lessons].sort(byPeriod).map(withCleanLOs);
}

/**
 * Return a sorted list of all week numbers that have at least one lesson in
 * the given year.
 *
 * `year` can be a number (0–6) or the label string `"Year 0"` … `"Year 6"`.
 */
export function getAllWeeks(year: number | string): number[] {
  buildIndexes();
  const yn = resolveYearNum(year);
  if (yn === null) return [];

  const weeks = new Set<number>();
  for (const key of _byWeek!.keys()) {
    const [keyYear] = key.split("_").map(Number);
    if (keyYear === yn) weeks.add(Number(key.split("_")[1]));
  }
  return [...weeks].sort((a, b) => a - b);
}

/**
 * Return every lesson for the given year, sorted by week then period number.
 *
 * `year` can be a number (0–6) or the label string `"Year 0"` … `"Year 6"`.
 */
export function getLessonsByYear(year: number | string): CurriculumLesson[] {
  buildIndexes();
  const yn = resolveYearNum(year);
  if (yn === null) return [];
  const lessons = _byYear!.get(yn) ?? [];
  return [...lessons].sort(byWeekThenPeriod).map(withCleanLOs);
}

/** Alias for getAllWeeks — returns sorted week numbers for a year. */
export function getWeeksForYear(year: number | string): number[] {
  return getAllWeeks(year);
}

/** Alias for getLessonsByWeek. */
export function getLessonsForWeek(year: number | string, week: number): CurriculumLesson[] {
  return getLessonsByWeek(year, week);
}

/**
 * Return months (in order) with their week numbers for the given year.
 * E.g. [{ month: 'February', weeks: [1,2,3,4] }, ...]
 */
export function getMonthsWithWeeks(year: number | string): { month: string; weeks: number[] }[] {
  buildIndexes();
  const yn = resolveYearNum(year);
  if (yn === null) return [];
  const lessons = _byYear!.get(yn) ?? [];

  const monthOrder: string[] = [];
  const monthWeeks: Map<string, Set<number>> = new Map();

  for (const l of lessons) {
    if (!l.month || l.week === null) continue;
    if (!monthWeeks.has(l.month)) {
      monthWeeks.set(l.month, new Set());
      monthOrder.push(l.month);
    }
    monthWeeks.get(l.month)!.add(l.week);
  }

  return monthOrder.map(month => ({
    month,
    weeks: [...monthWeeks.get(month)!].sort((a, b) => a - b),
  }));
}

/**
 * Return unique themes for a year with lesson counts, sorted by count desc.
 */
export function getThemesForYear(year: number | string): { theme: string; count: number }[] {
  buildIndexes();
  const yn = resolveYearNum(year);
  if (yn === null) return [];
  const lessons = _byYear!.get(yn) ?? [];

  const counts = new Map<string, number>();
  for (const l of lessons) {
    if (!l.theme) continue;
    counts.set(l.theme, (counts.get(l.theme) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([theme, count]) => ({ theme, count }))
    .sort((a, b) => b.count - a.count);
}

/** Return all lessons for a given year+theme. */
export function getLessonsByTheme(year: number | string, theme: string): CurriculumLesson[] {
  buildIndexes();
  const yn = resolveYearNum(year);
  if (yn === null) return [];
  const lessons = _byYear!.get(yn) ?? [];
  return lessons.filter(l => l.theme === theme).sort(byWeekThenPeriod).map(withCleanLOs);
}

/**
 * Return skill (linguistic skill) breakdown for a year.
 * skillKey is a normalised key: 'read'|'write'|'listen'|'speak'|'basic'.
 */
export function getSkillBreakdown(year: number | string): { skill: string; skillKey: string; count: number; pct: number }[] {
  buildIndexes();
  const yn = resolveYearNum(year);
  if (yn === null) return [];
  const lessons = (_byYear!.get(yn) ?? []).filter(l => l.linguisticSkill && l.linguisticSkill.length > 1);
  const total = lessons.length || 1;

  const counts = new Map<string, number>();
  for (const l of lessons) {
    counts.set(l.linguisticSkill, (counts.get(l.linguisticSkill) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([skill, count]) => ({ skill, skillKey: skillToKey(skill), count, pct: Math.round((count / total) * 100) }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Return skill LOs (skillLORef → skillLO text) with lesson counts, sorted by ref.
 */
export function getSkillLOs(year: number | string): { ref: string; lo: string; skill: string; count: number }[] {
  buildIndexes();
  const yn = resolveYearNum(year);
  if (yn === null) return [];
  const lessons = _byYear!.get(yn) ?? [];

  const map = new Map<string, { lo: string; skill: string; count: number }>();
  for (const l of lessons) {
    if (!l.skillLORef) continue;
    if (!map.has(l.skillLORef)) {
      map.set(l.skillLORef, { lo: cleanLO(l.skillLO), skill: l.linguisticSkill, count: 0 });
    }
    map.get(l.skillLORef)!.count++;
  }
  return [...map.entries()]
    .map(([ref, v]) => ({ ref, ...v }))
    .sort((a, b) => a.ref.localeCompare(b.ref, undefined, { numeric: true }));
}

/**
 * Return knowledge LOs under a given skillLORef, with lesson counts and week lists.
 */
export function getKnowledgeLOsForSkill(
  year: number | string,
  skillRef: string,
): { ref: string; lo: string; count: number; weeks: number[] }[] {
  buildIndexes();
  const yn = resolveYearNum(year);
  if (yn === null) return [];
  const lessons = (_byYear!.get(yn) ?? []).filter(l => l.skillLORef === skillRef);

  const map = new Map<string, { lo: string; weeks: Set<number>; count: number }>();
  for (const l of lessons) {
    if (!l.knowledgeLORef) continue;
    if (!map.has(l.knowledgeLORef)) {
      map.set(l.knowledgeLORef, { lo: cleanLO(l.knowledgeLO), weeks: new Set(), count: 0 });
    }
    const entry = map.get(l.knowledgeLORef)!;
    entry.count++;
    if (l.week !== null) entry.weeks.add(l.week);
  }
  return [...map.entries()]
    .map(([ref, v]) => ({ ref, lo: v.lo, count: v.count, weeks: [...v.weeks].sort((a, b) => a - b) }))
    .sort((a, b) => a.ref.localeCompare(b.ref, undefined, { numeric: true }));
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function resolveYearNum(year: number | string): number | null {
  if (typeof year === "number") return year;
  const m = year.match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
}

function byPeriod(a: CurriculumLesson, b: CurriculumLesson): number {
  return (a.periodNum ?? 0) - (b.periodNum ?? 0);
}

function byWeekThenPeriod(a: CurriculumLesson, b: CurriculumLesson): number {
  const wDiff = (a.week ?? 0) - (b.week ?? 0);
  return wDiff !== 0 ? wDiff : byPeriod(a, b);
}

function skillToKey(skill: string): string {
  const s = skill.toLowerCase();
  if (s.includes('read')) return 'read';
  if (s.includes('writ')) return 'write';
  if (s.includes('listen')) return 'listen';
  if (s.includes('speak')) return 'speak';
  return 'basic';
}

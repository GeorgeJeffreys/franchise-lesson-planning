'use server';

import {
  getAllWeeks, getLessonsByWeek, getLessonById,
  getMonthsWithWeeks, getThemesForYear, getSkillBreakdown,
  getSkillLOs, getKnowledgeLOsForSkill, getLessonsByYear,
} from '@/lib/curriculumUtils';
import type { CurriculumLesson } from '@/types/curriculum';

export async function fetchWeeksForYear(yearNum: number): Promise<number[]> {
  return getAllWeeks(yearNum);
}

export async function fetchLessonsForWeek(
  yearNum: number,
  week: number,
): Promise<CurriculumLesson[]> {
  return getLessonsByWeek(yearNum, week);
}

export async function fetchLessonById(id: string): Promise<CurriculumLesson | null> {
  const raw = getLessonById(id);
  if (!raw) return null;
  return Array.isArray(raw) ? raw[0] : raw;
}

export interface CurriculumYearData {
  months: { month: string; weeks: number[] }[];
  themes: { theme: string; count: number }[];
  skillBreakdown: { skill: string; skillKey: string; count: number; pct: number }[];
  skillLOs: { ref: string; lo: string; skill: string; count: number }[];
  totalLessons: number;
  totalWeeks: number;
}

export async function fetchCurriculumYearData(yearNum: number): Promise<CurriculumYearData> {
  const [months, themes, skillBreakdown, skillLOs, lessons] = await Promise.all([
    Promise.resolve(getMonthsWithWeeks(yearNum)),
    Promise.resolve(getThemesForYear(yearNum)),
    Promise.resolve(getSkillBreakdown(yearNum)),
    Promise.resolve(getSkillLOs(yearNum)),
    Promise.resolve(getLessonsByYear(yearNum)),
  ]);
  return {
    months,
    themes,
    skillBreakdown,
    skillLOs,
    totalLessons: lessons.length,
    totalWeeks: months.reduce((s, m) => s + m.weeks.length, 0),
  };
}

export async function fetchKnowledgeLOs(
  yearNum: number,
  skillRef: string,
): Promise<{ ref: string; lo: string; count: number; weeks: number[] }[]> {
  return getKnowledgeLOsForSkill(yearNum, skillRef);
}

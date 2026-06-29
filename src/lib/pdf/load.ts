// Data layer for the lesson-plan PDFs.
//
// Every read goes through the auth'd, cookie-bound Supabase server client, so
// RLS scopes results to the signed-in user exactly as the editor and overview
// do — the service-role key is never used here. These loaders return the
// presentational `PlanPdfModel` (see ./types) and never leak raw DB rows to the
// document components.

import { createClient } from '@/lib/supabase/server';
import { loadPlanForEditor } from '@/lib/editor/load-plan';
import { normalizeLinkIt, resolveTechniques, techniqueLabelMap } from '@/lib/editor/link-it';
import { resolveWeekSlotKeys, selectWeekPlanRows } from '@/lib/weekly-overview-selection';
import type { Block } from '@/types/lesson';
import type { PdfLinkIt, PlanPdfModel } from './types';

/** Resolve a plan's blocks into the PDF Link-it model using a technique-label map. */
function buildLinkIt(blocks: Block[], labels: Map<string, string>): PdfLinkIt {
  const linkIt = normalizeLinkIt(blocks);
  return {
    recap: linkIt.recap,
    cfu: resolveTechniques(linkIt.checkForUnderstanding, labels),
    exitTicket: resolveTechniques(linkIt.exitTicket, labels),
  };
}

/**
 * Load a single plan as a PDF model. Reuses the editor loader (same RLS-scoped
 * query for plan + class + curriculum) and drops the editor-only activity bank.
 * Returns null when the plan is missing or hidden by RLS, so the route can 404.
 */
export async function loadPlanPdfModel(id: string): Promise<PlanPdfModel | null> {
  const data = await loadPlanForEditor(id);
  if (!data) return null;

  // The editor loader already fetched the activity bank — reuse it for labels.
  const labels = techniqueLabelMap(
    data.activitiesByBlock.cfu ?? [],
    data.activitiesByBlock.exit_ticket ?? [],
  );

  return {
    plan: data.plan,
    classContext: {
      year: data.classContext.year,
      schoolName: data.classContext.schoolName,
      subjectName: data.classContext.subjectName,
    },
    curriculum: data.curriculum,
    linkIt: buildLinkIt(data.plan.blocks, labels),
  };
}

/** The board coordinate a weekly export mirrors — one subject space, one week. */
export interface WeekPdfCoordinate {
  /** The board's subject `code` (e.g. "english"). */
  subjectCode: string;
  /** The year groups in scope (the board's taught/curriculum years). */
  years: number[];
  /** Curriculum month, e.g. "March". */
  month: string;
  /** Curriculum week within the month (1-based). */
  week: number;
}

/**
 * Load every plan visible at a board coordinate as PDF models — the same set the
 * planning board shows for `(subject space · years · month · week)`. Selection
 * goes through the board's shared `resolveWeekSlotKeys` → `WHERE
 * curriculum_lesson_id IN (...)` path (no class filter, no date filter; RLS does
 * the scoping), so the export can never diverge from the board.
 *
 * Each plan is resolved through `loadPlanPdfModel`, so every page inherits Part
 * A's single-plan fidelity (objective, link-it strips, block minutes, and the
 * centre/org class context for plans with no single class). Nothing is dropped:
 * the returned list is every plan the user may see for the coordinate; the
 * document places `weekday`-bearing plans into their day and appends the rest as
 * the unscheduled section. Returns an empty array when the week has no plans.
 */
export async function loadWeekPdfModels(
  coordinate: WeekPdfCoordinate,
): Promise<PlanPdfModel[]> {
  const supabase = await createClient();

  const { slotKeys } = await resolveWeekSlotKeys(
    coordinate.subjectCode,
    coordinate.years,
    coordinate.month,
    coordinate.week,
  );

  // The plan ids for the coordinate (RLS-scoped). Resolve each through the
  // single-plan loader concurrently; a plan that disappears between the id read
  // and its load resolves to null and is dropped.
  const rows = await selectWeekPlanRows<{ id: string }>(supabase, slotKeys, 'id');
  const models = await Promise.all(rows.map((r) => loadPlanPdfModel(r.id)));
  return models.filter((m): m is PlanPdfModel => m !== null);
}

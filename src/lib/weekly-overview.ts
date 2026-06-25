// Data layer for the day-column planning board. The board is a per-year set of
// Mon–Fri columns: a plan appears on the board once it exists, placed by its own
// `weekday` (which column) and `period` (its position in that day's stack). The
// curriculum lessons for the selected (month · week) are the POOL the "+ Add
// lesson" picker draws from — the board groups plans by curriculum week via each
// plan's `curriculum_lesson_id`, then lays them out by weekday.
//
// Everything goes through the auth'd, cookie-bound Supabase client, so RLS scopes
// the reads: the teacher's own `class_teachers` rows, and the `lesson_plans` they
// may see (class/centre within their centre, org across centres). The service-role
// key is never used on this path.

import { createClient } from '@/lib/supabase/server';
import { getCurriculumNav, getCurriculumWeekCells } from '@/lib/curriculumUtils';
import { initialsOf } from '@/components/weekly-overview/avatar';
import type { PlanScope, PlanStatus } from '@/types/lesson';
import type {
  BoardClass,
  BoardCoordinate,
  BoardData,
  BoardLesson,
  BoardPlan,
  BoardYear,
  PlanOwner,
} from '@/types/weekly-overview';

// Calendar-month order so the prev/next arrows step through the scheme of work in
// the right sequence regardless of how rows come back from the DB.
const MONTH_ORDER = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function monthIndex(month: string): number {
  const i = MONTH_ORDER.indexOf(month);
  return i === -1 ? MONTH_ORDER.length : i;
}

// Hand-narrowed row shapes — database.types.ts is a placeholder until gen:types
// runs against a live DB, so the client can't infer the nested selects.
interface TaughtClassRow {
  id: string;
  year: number;
  group_label: string;
  archived_at: string | null;
  school_id: string;
  subject_id: string;
  schools: { name: string } | null;
  subjects: { code: string; name: string } | null;
}

interface PlanRow {
  id: string;
  curriculum_lesson_id: string;
  scope: PlanScope;
  class_id: string | null;
  school_id: string | null;
  subject_id: string | null;
  year: number | null;
  weekday: number | null;
  period: number | null;
  status: PlanStatus;
  review_note: string | null;
  created_by: string;
}

/** Clamp a value to the Mon–Fri (1–5) column range, defaulting to Monday. */
function clampWeekday(n: number | null | undefined): number {
  if (n == null || Number.isNaN(n)) return 1;
  return Math.min(5, Math.max(1, Math.trunc(n)));
}

/** Order plans within a day stack: by stored ordinal, then scope, then owner. */
const SCOPE_ORDER: Record<PlanScope, number> = { class: 0, centre: 1, org: 2 };
function byDayOrder(a: BoardPlan, b: BoardPlan): number {
  if (a.weekday !== b.weekday) return a.weekday - b.weekday;
  if (a.period !== b.period) return a.period - b.period;
  const s = SCOPE_ORDER[a.scope] - SCOPE_ORDER[b.scope];
  if (s !== 0) return s;
  return (a.owner?.name ?? '').localeCompare(b.owner?.name ?? '');
}

interface MembershipRow {
  school_id: string;
  subject_id: string;
  role: 'teacher' | 'coordinator';
  schools: { name: string } | null;
  subjects: { code: string; name: string } | null;
}

/** The empty board shown when there's no session or no teaching assignment. */
function emptyBoard(teacherName: string, subjectName = ''): BoardData {
  return {
    teacherName,
    context: null,
    subjectName,
    coordinate: { month: '', week: 1 },
    coordinateLabel: '—',
    prev: null,
    next: null,
    years: [],
    owners: [],
    planCount: 0,
    hasClasses: false,
    myClassesByYear: {},
  };
}

/**
 * Load the planning board for the signed-in teacher at a curriculum coordinate.
 *
 * `month`/`week` select the curriculum coordinate; when omitted (or out of range)
 * the first synced coordinate for the teacher's subject is used.
 *
 * The board is driven by the teacher's SUBJECT SPACE (their `subject_membership`),
 * NOT by their classes — so centre-, year-group- and org-scoped lessons render
 * even when the teacher teaches no classes. The years shown come from the
 * curriculum for that subject; each year carries the plans visible this week (laid
 * out by curriculum period → weekday) and the week's curriculum lessons.
 */
export async function getBoardData(input: {
  month?: string;
  week?: number;
}): Promise<BoardData> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return emptyBoard('there');

  // Identity, the teacher's subject spaces (the board's source of truth), and
  // their classes (only for the "My class" option) depend on the user id — fetch
  // together.
  const [{ data: profile }, { data: memRows }, { data: ctRows }] = await Promise.all([
    supabase.from('profiles').select('full_name, role').eq('id', user.id).maybeSingle(),
    supabase
      .from('subject_membership')
      .select('school_id, subject_id, role, schools ( name ), subjects ( code, name )')
      .eq('profile_id', user.id),
    supabase
      .from('class_teachers')
      .select(
        'classes ( id, year, group_label, archived_at, school_id, subject_id, schools ( name ), subjects ( code, name ) )',
      )
      .eq('teacher_id', user.id),
  ]);

  const teacherName =
    (profile as { full_name?: string | null } | null)?.full_name ?? user.email ?? 'there';
  const isAdmin = (profile as { role?: string } | null)?.role === 'admin';

  const memberships = (memRows ?? []) as unknown as MembershipRow[];

  // The teacher's (non-archived) classes — kept ONLY for the "My class" scope
  // choice (myClassesByYear). The board itself is never built from them.
  const taught = ((ctRows ?? []) as unknown as Array<{ classes: TaughtClassRow | null }>)
    .map((r) => r.classes)
    .filter((c): c is TaughtClassRow => !!c && !c.archived_at);

  // Pick the board's (centre, subject) space. When the teacher belongs to several,
  // prefer the subject they teach the most classes in (deterministic); otherwise
  // the first space by name. A teacher with classes but no membership row falls
  // back to their class-derived space so they still see a board.
  const classSubjectCounts = new Map<string, number>();
  for (const c of taught) {
    const code = c.subjects?.code ?? '';
    if (code) classSubjectCounts.set(code, (classSubjectCounts.get(code) ?? 0) + 1);
  }
  const preferredCode =
    [...classSubjectCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  interface Space {
    schoolId: string;
    code: string;
    name: string;
    school: string;
  }
  const spaces: Space[] = memberships
    .filter((m) => m.subjects?.code)
    .map((m) => ({
      schoolId: m.school_id,
      code: m.subjects?.code ?? '',
      name: m.subjects?.name ?? '',
      school: m.schools?.name ?? '',
    }));

  if (spaces.length === 0 && taught.length > 0) {
    const c = taught.find((t) => (t.subjects?.code ?? '') === preferredCode) ?? taught[0];
    spaces.push({
      schoolId: c.school_id,
      code: c.subjects?.code ?? '',
      name: c.subjects?.name ?? '',
      school: c.schools?.name ?? '',
    });
  }

  if (spaces.length === 0) {
    return emptyBoard(teacherName);
  }

  const board =
    spaces.find((s) => s.code === preferredCode) ??
    [...spaces].sort((a, b) => a.name.localeCompare(b.name))[0];
  const subjectCode = board.code;
  const subjectName = board.name;
  const context = [board.school, subjectName].filter(Boolean).join(' · ') || null;

  // The teacher's own classes in the board subject, grouped by year — the "My
  // class" choices in the scope chooser.
  const myClassesByYear: Record<number, BoardClass[]> = {};
  for (const c of taught) {
    if ((c.subjects?.code ?? '') !== subjectCode) continue;
    (myClassesByYear[c.year] ??= []).push({
      id: c.id,
      label: `Year ${c.year} · ${c.group_label}`,
    });
  }
  for (const list of Object.values(myClassesByYear)) {
    list.sort((a, b) => a.label.localeCompare(b.label));
  }

  // The coordinator spaces the teacher belongs to — drives per-plan edit rights.
  const coordinatorSpaces = new Set(
    memberships
      .filter((m) => m.role === 'coordinator')
      .map((m) => `${m.school_id}:${m.subject_id}`),
  );

  // Years come from the CURRICULUM for this subject (not from classes), so
  // year-group lessons show with zero classes present. A candidate year is kept
  // only if it has synced curriculum.
  const CANDIDATE_YEARS = [0, 1, 2, 3, 4, 5, 6];
  const candidateNavs = await Promise.all(
    CANDIDATE_YEARS.map((y) => getCurriculumNav(subjectCode, y)),
  );
  const years = CANDIDATE_YEARS.filter((_, i) => candidateNavs[i].length > 0);

  // Build the ordered list of curriculum coordinates available across those years,
  // so prev/next step through the scheme of work. Union the per-year navs.
  const weeksByMonth = new Map<string, Set<number>>();
  for (const nav of candidateNavs) {
    for (const { month, weeks } of nav) {
      if (!weeksByMonth.has(month)) weeksByMonth.set(month, new Set());
      const set = weeksByMonth.get(month)!;
      for (const w of weeks) set.add(w);
    }
  }
  const coords: BoardCoordinate[] = [...weeksByMonth.entries()]
    .sort((a, b) => monthIndex(a[0]) - monthIndex(b[0]))
    .flatMap(([month, weeks]) =>
      [...weeks].sort((a, b) => a - b).map((week) => ({ month, week })),
    );

  // Nothing synced for this subject/years yet → an empty-but-valid board.
  if (coords.length === 0) {
    return {
      ...emptyBoard(teacherName, subjectName),
      context,
      hasClasses: true,
      years: years.map((year) => ({ year, plans: [], lessons: [] })),
      myClassesByYear,
    };
  }

  // Resolve the selected coordinate from the params (snap to a real one).
  let index = coords.findIndex((c) => c.month === input.month && c.week === input.week);
  if (index === -1) index = 0;
  const coordinate = coords[index];
  const prev = index > 0 ? coords[index - 1] : null;
  const next = index < coords.length - 1 ? coords[index + 1] : null;

  // The curriculum lessons (P1..P5) for each taught year at the selected
  // coordinate — the "+ Add lesson" pool and the join target for the plans.
  const cellsByYear = await Promise.all(
    years.map((y) => getCurriculumWeekCells(subjectCode, y, coordinate.month, coordinate.week)),
  );

  // Every lesson key across the board — the join target for the visible plans, and
  // a lookup from a plan's curriculum_lesson_id back to its curriculum period.
  const slotKeys = new Set<string>();
  const periodByKey = new Map<string, number>();
  const outcomeByKey = new Map<string, string>();
  for (const cells of cellsByYear) {
    for (const cell of cells) {
      slotKeys.add(cell.lessonKey);
      periodByKey.set(cell.lessonKey, cell.period);
      outcomeByKey.set(cell.lessonKey, cell.dailyOutcome);
    }
  }

  // All plans (any scope) the teacher can see whose curriculum_lesson_id is one of
  // the week's lesson keys. RLS enforces visibility; legacy plans whose key matches
  // no lesson simply never load. Skip the query entirely when there are no lessons.
  let planRows: PlanRow[] = [];
  if (slotKeys.size > 0) {
    const { data: plans } = await supabase
      .from('lesson_plans')
      .select(
        'id, curriculum_lesson_id, scope, class_id, school_id, subject_id, year, weekday, period, status, review_note, created_by',
      )
      .in('curriculum_lesson_id', [...slotKeys]);
    planRows = (plans ?? []) as unknown as PlanRow[];
  }

  // Resolve plan owners (avatar + people filter). One read for the distinct
  // creators; the co-member profiles policy (0013) lets a teammate's id + name be
  // read within a shared space, kept RLS-scoped by the auth'd client.
  const ownerById = new Map<string, PlanOwner>();
  const ownerIds = [...new Set(planRows.map((p) => p.created_by).filter(Boolean))];
  if (ownerIds.length > 0) {
    const { data: ownerRows } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', ownerIds);
    for (const row of (ownerRows ?? []) as Array<{ id: string; full_name: string | null }>) {
      const name = row.full_name ?? 'Unknown';
      ownerById.set(row.id, { id: row.id, name, initials: initialsOf(name) });
    }
  }

  const canEdit = (p: PlanRow): boolean =>
    p.created_by === user.id ||
    isAdmin ||
    (!!p.school_id && !!p.subject_id && coordinatorSpaces.has(`${p.school_id}:${p.subject_id}`));

  // Turn each visible plan into a placed board card. `weekday` falls back to the
  // lesson's curriculum period (clamped to Mon–Fri) for legacy rows that predate
  // the column; `period` (the stored day-ordinal) likewise falls back. The
  // displayed "Period N" is re-derived from the sorted stack on the client.
  const plansByYear = new Map<number, BoardPlan[]>();
  for (const p of planRows) {
    if (p.year == null) continue;
    const curriculumPeriod = periodByKey.get(p.curriculum_lesson_id) ?? 1;
    const plan: BoardPlan = {
      id: p.id,
      lessonKey: p.curriculum_lesson_id,
      year: p.year,
      weekday: clampWeekday(p.weekday ?? curriculumPeriod),
      period: p.period ?? curriculumPeriod,
      status: p.status,
      scope: p.scope,
      owner: ownerById.get(p.created_by) ?? null,
      canEdit: canEdit(p),
      reviewNote: p.review_note,
      dailyOutcome: outcomeByKey.get(p.curriculum_lesson_id) ?? '',
    };
    (plansByYear.get(p.year) ?? plansByYear.set(p.year, []).get(p.year)!).push(plan);
  }
  for (const list of plansByYear.values()) list.sort(byDayOrder);

  const yearBands: BoardYear[] = years.map((year, i) => {
    const lessons: BoardLesson[] = cellsByYear[i].map((cell) => ({
      lessonKey: cell.lessonKey,
      period: cell.period,
      dailyOutcome: cell.dailyOutcome,
      focusArea: cell.focusArea,
    }));
    return { year, plans: plansByYear.get(year) ?? [], lessons };
  });

  // Distinct owners across the board, for the people filter.
  const owners = [...ownerById.values()].sort((a, b) => a.name.localeCompare(b.name));

  return {
    teacherName,
    context,
    subjectName,
    coordinate,
    coordinateLabel: `${coordinate.month} · Week ${coordinate.week}`,
    prev,
    next,
    years: yearBands,
    owners,
    planCount: planRows.length,
    hasClasses: true,
    myClassesByYear,
  };
}

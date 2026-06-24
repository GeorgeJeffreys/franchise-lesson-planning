// Data layer for the planning board — the curriculum-driven view of a teacher's
// week. The board is anchored on CURRICULUM coordinates (month · week · period),
// NOT on calendar dates: for each year the signed-in teacher teaches, every
// curriculum period (P1..P5) of the selected (month, week) is a slot, and every
// plan the teacher can see whose `curriculum_lesson_id` matches a slot key renders
// as a card over it.
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
  BoardSlot,
  BoardYear,
  PlanOwner,
  SlotPlan,
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
  status: PlanStatus;
  review_note: string | null;
  created_by: string;
}

interface MembershipRow {
  school_id: string;
  subject_id: string;
  role: 'teacher' | 'coordinator';
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

/** Order plans within a slot: by scope (class → centre → org), then owner name. */
const SCOPE_ORDER: Record<PlanScope, number> = { class: 0, centre: 1, org: 2 };
function byScopeThenOwner(a: SlotPlan, b: SlotPlan): number {
  const s = SCOPE_ORDER[a.scope] - SCOPE_ORDER[b.scope];
  if (s !== 0) return s;
  return (a.owner?.name ?? '').localeCompare(b.owner?.name ?? '');
}

/**
 * Load the planning board for the signed-in teacher at a curriculum coordinate.
 *
 * `month`/`week` select the curriculum coordinate; when omitted (or out of range)
 * the first synced coordinate for the teacher's subject is used. The board shows
 * one band per year the teacher teaches (distinct `classes.year` via
 * `class_teachers`), each with the P1..P5 curriculum slots for that coordinate and
 * every plan — at any scope the teacher can see — covering them.
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

  // Identity, the teacher's own classes (taught years + subject), and their
  // memberships (coordinator spaces) depend only on the user id — fetch together.
  const [{ data: profile }, { data: ctRows }, { data: memRows }] = await Promise.all([
    supabase.from('profiles').select('full_name, role').eq('id', user.id).maybeSingle(),
    supabase
      .from('class_teachers')
      .select(
        'classes ( id, year, group_label, archived_at, school_id, subject_id, schools ( name ), subjects ( code, name ) )',
      )
      .eq('teacher_id', user.id),
    supabase
      .from('subject_membership')
      .select('school_id, subject_id, role')
      .eq('profile_id', user.id),
  ]);

  const teacherName =
    (profile as { full_name?: string | null } | null)?.full_name ?? user.email ?? 'there';
  const isAdmin = (profile as { role?: string } | null)?.role === 'admin';

  // The teacher's (non-archived) classes — they define the taught years and the
  // board's subject. Archived classes are removed from planning.
  const taught = ((ctRows ?? []) as unknown as Array<{ classes: TaughtClassRow | null }>)
    .map((r) => r.classes)
    .filter((c): c is TaughtClassRow => !!c && !c.archived_at);

  if (taught.length === 0) {
    return emptyBoard(teacherName);
  }

  // Board subject (English first). A teacher normally teaches one subject; if more
  // than one, pick the one with the most classes (deterministic, name-tiebroken).
  const subjectCounts = new Map<string, { code: string; name: string; school: string; n: number }>();
  for (const c of taught) {
    const code = c.subjects?.code ?? '';
    const prev = subjectCounts.get(code);
    subjectCounts.set(code, {
      code,
      name: c.subjects?.name ?? '',
      school: c.schools?.name ?? '',
      n: (prev?.n ?? 0) + 1,
    });
  }
  const subject = [...subjectCounts.values()].sort(
    (a, b) => b.n - a.n || a.name.localeCompare(b.name),
  )[0];
  const subjectCode = subject.code;
  const subjectName = subject.name;
  const context = [subject.school, subjectName].filter(Boolean).join(' · ') || null;

  // Years the teacher teaches in this subject, ascending.
  const years = [
    ...new Set(taught.filter((c) => (c.subjects?.code ?? '') === subjectCode).map((c) => c.year)),
  ].sort((a, b) => a - b);

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
    ((memRows ?? []) as unknown as MembershipRow[])
      .filter((m) => m.role === 'coordinator')
      .map((m) => `${m.school_id}:${m.subject_id}`),
  );

  // Build the ordered list of curriculum coordinates available across the taught
  // years, so prev/next step through the scheme of work. Union the per-year navs.
  const navs = await Promise.all(years.map((y) => getCurriculumNav(subjectCode, y)));
  const weeksByMonth = new Map<string, Set<number>>();
  for (const nav of navs) {
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
      years: years.map((year) => ({ year, slots: [] })),
      myClassesByYear,
    };
  }

  // Resolve the selected coordinate from the params (snap to a real one).
  let index = coords.findIndex((c) => c.month === input.month && c.week === input.week);
  if (index === -1) index = 0;
  const coordinate = coords[index];
  const prev = index > 0 ? coords[index - 1] : null;
  const next = index < coords.length - 1 ? coords[index + 1] : null;

  // The curriculum slots (P1..P5) for each taught year at the selected coordinate.
  const cellsByYear = await Promise.all(
    years.map((y) => getCurriculumWeekCells(subjectCode, y, coordinate.month, coordinate.week)),
  );

  // Every slot key across the board — the join target for the visible plans.
  const slotKeys = new Set<string>();
  for (const cells of cellsByYear) for (const cell of cells) slotKeys.add(cell.lessonKey);

  // All plans (any scope) the teacher can see whose curriculum_lesson_id is one of
  // the slot keys. RLS enforces visibility; legacy plans whose key matches no slot
  // simply never load. Skip the query entirely when there are no slots.
  let planRows: PlanRow[] = [];
  if (slotKeys.size > 0) {
    const { data: plans } = await supabase
      .from('lesson_plans')
      .select(
        'id, curriculum_lesson_id, scope, class_id, school_id, subject_id, year, status, review_note, created_by',
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

  // Index plans by slot key.
  const plansByKey = new Map<string, SlotPlan[]>();
  for (const p of planRows) {
    const card: SlotPlan = {
      id: p.id,
      status: p.status,
      scope: p.scope,
      owner: ownerById.get(p.created_by) ?? null,
      canEdit: canEdit(p),
      reviewNote: p.review_note,
    };
    const list = plansByKey.get(p.curriculum_lesson_id);
    if (list) list.push(card);
    else plansByKey.set(p.curriculum_lesson_id, [card]);
  }
  for (const list of plansByKey.values()) list.sort(byScopeThenOwner);

  const yearBands: BoardYear[] = years.map((year, i) => {
    const slots: BoardSlot[] = cellsByYear[i].map((cell) => ({
      lessonKey: cell.lessonKey,
      year,
      period: cell.period,
      dailyOutcome: cell.dailyOutcome,
      focusArea: cell.focusArea,
      plans: plansByKey.get(cell.lessonKey) ?? [],
    }));
    return { year, slots };
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

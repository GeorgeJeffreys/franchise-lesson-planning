// The single source of truth for the signed-in user's "active subject space".
//
// The permission boundary is the (centre, subject) space modelled by
// `subject_membership`; a user can belong to several. Historically each surface
// picked one on its own (the chip by earliest membership, the curriculum browser
// English-first, the board by taught-class count), so they disagreed within a
// session. Every subject-defaulting surface now reads `getActiveSpace()` instead,
// so the chip, board, and curriculum default all agree.
//
// Resolution order (see `resolveActiveMembership`):
//   1. the membership the user flagged primary (`is_primary`, set via the
//      `set_primary_space` RPC — migration 0039);
//   2. otherwise a DETERMINISTIC default — the English membership if any, else the
//      earliest-joined membership. NOT class counts, NOT alphabetical.
//
// All reads go through the auth'd, cookie-bound client, so RLS scopes them to the
// caller's own rows (`sm_read`).

import { createClient } from '@/lib/supabase/server';
import type { MembershipRole } from '@/lib/auth';

/** A membership joined to its centre + subject names — the switcher's row shape. */
export interface MembershipFull {
  id: string;
  schoolId: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  schoolName: string;
  role: MembershipRole;
  isPrimary: boolean;
  createdAt: string;
}

/** The resolved active space — what every subject-defaulting surface consumes. */
export interface ActiveSpace {
  membershipId: string;
  schoolId: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  schoolName: string;
  role: MembershipRole;
}

interface MembershipQueryRow {
  id: string;
  school_id: string;
  subject_id: string;
  role: MembershipRole;
  is_primary: boolean;
  created_at: string;
  subjects: { code: string; name: string } | null;
  schools: { name: string } | null;
}

/** Is this membership the English space? Matches on subject code, then name. */
function isEnglish(m: MembershipFull): boolean {
  return m.subjectCode.toLowerCase() === 'english' || m.subjectName.toLowerCase() === 'english';
}

/**
 * Pick the active membership from a set, applying the resolution order above.
 * Pure and total: returns null only for an empty set. Exported so the board can
 * resolve its subject from the same algorithm (and against a `?subject=` subset)
 * without a second round-trip.
 */
export function resolveActiveMembership(rows: MembershipFull[]): MembershipFull | null {
  if (rows.length === 0) return null;

  const primary = rows.find((m) => m.isPrimary);
  if (primary) return primary;

  // Deterministic default: English first, else earliest-joined. Sort by created_at
  // then id so ties never depend on row order coming back from the DB.
  const byJoined = [...rows].sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
  return byJoined.find(isEnglish) ?? byJoined[0];
}

/** Map a raw membership query row to `MembershipFull`. */
function toFull(r: MembershipQueryRow): MembershipFull {
  return {
    id: r.id,
    schoolId: r.school_id,
    subjectId: r.subject_id,
    subjectCode: r.subjects?.code ?? '',
    subjectName: r.subjects?.name ?? '',
    schoolName: r.schools?.name ?? '',
    role: r.role,
    isPrimary: r.is_primary,
    createdAt: r.created_at,
  };
}

/**
 * The caller's memberships joined to centre + subject names. RLS (`sm_read`)
 * returns the caller's own rows (and teammates', filtered out here by profile_id).
 * Returns [] when signed out.
 */
export async function getMyMembershipsFull(): Promise<MembershipFull[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from('subject_membership')
    .select('id, school_id, subject_id, role, is_primary, created_at, subjects ( code, name ), schools ( name )')
    .eq('profile_id', user.id);

  // database.types.ts is a placeholder (untyped client) — narrow by hand.
  return ((data ?? []) as unknown as MembershipQueryRow[]).map(toFull);
}

/** The signed-in user's active space, or null when they belong to no space. */
export async function getActiveSpace(): Promise<ActiveSpace | null> {
  const active = resolveActiveMembership(await getMyMembershipsFull());
  if (!active) return null;
  return {
    membershipId: active.id,
    schoolId: active.schoolId,
    subjectId: active.subjectId,
    subjectCode: active.subjectCode,
    subjectName: active.subjectName,
    schoolName: active.schoolName,
    role: active.role,
  };
}

/** A switcher row: a space plus whether it is the active one. */
export interface SwitcherSpace {
  membershipId: string;
  schoolId: string;
  subjectId: string;
  subjectName: string;
  schoolName: string;
  role: MembershipRole;
  isActive: boolean;
}

/**
 * The data the header space-switcher renders: every space the user belongs to,
 * with the active one marked. The switcher only appears when there is more than
 * one, but we always return the full list so the caller can decide.
 */
export async function getSpaceSwitcher(): Promise<SwitcherSpace[]> {
  const rows = await getMyMembershipsFull();
  const active = resolveActiveMembership(rows);
  return [...rows]
    .sort(
      (a, b) =>
        a.schoolName.localeCompare(b.schoolName) || a.subjectName.localeCompare(b.subjectName),
    )
    .map((m) => ({
      membershipId: m.id,
      schoolId: m.schoolId,
      subjectId: m.subjectId,
      subjectName: m.subjectName,
      schoolName: m.schoolName,
      role: m.role,
      isActive: active?.id === m.id,
    }));
}

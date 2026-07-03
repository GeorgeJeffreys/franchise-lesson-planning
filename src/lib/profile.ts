// Shared header identity for the app shell — the signed-in teacher's display
// name and "Centre · Subject" subline. Goes through the auth'd, cookie-bound
// Supabase client, so RLS scopes the read to the user's own profile.

import { createClient } from '@/lib/supabase/server';
import { getActiveSpace } from '@/lib/active-space';

export interface HeaderProfile {
  /** Display name (full_name, falling back to email, then a friendly default). */
  name: string;
  /** "School · Subject" subline, or undefined when neither is set. */
  subtitle?: string;
}

/** Compose the "Centre · Subject" subline, degrading gracefully when one is absent. */
export function spaceSubtitle(school?: string, subject?: string): string | undefined {
  return school && subject ? `${school} · ${subject}` : school ?? subject ?? undefined;
}

/**
 * Load the shell's header identity for the signed-in user. The "Centre · Subject"
 * subline comes from the user's ACTIVE space (`getActiveSpace()`) — the single
 * canonical resolver every subject-defaulting surface shares, so the chip never
 * disagrees with the board or curriculum. Omitted when they belong to no space yet.
 */
export async function getHeaderProfile(): Promise<HeaderProfile> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { name: 'there' };

  const [{ data: profile }, active] = await Promise.all([
    supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle(),
    getActiveSpace(),
  ]);

  const name = (profile as { full_name: string | null } | null)?.full_name ?? user.email ?? 'there';
  const subtitle = active ? spaceSubtitle(active.schoolName, active.subjectName) : undefined;

  return { name, subtitle };
}

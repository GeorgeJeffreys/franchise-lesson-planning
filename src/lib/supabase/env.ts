/**
 * Read the client-safe Supabase env vars. Both are public (NEXT_PUBLIC_*) and
 * safe to expose to the browser. The service-role key is intentionally NOT read
 * here — it must never reach a user request (it bypasses RLS) and belongs only
 * in admin/seed scripts.
 */
export function getSupabaseEnv(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. ' +
        'Copy .env.example to .env.local and fill them in.'
    );
  }
  return { url, anonKey };
}

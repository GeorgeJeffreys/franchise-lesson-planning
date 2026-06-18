import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseEnv } from '@/lib/supabase/env';

/**
 * Server-side Supabase client for use in Server Components, Server Actions and
 * Route Handlers. It is cookie-bound and authenticated as the signed-in user,
 * so it honors Row Level Security. Always use this (never the service-role key)
 * for user-facing requests.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = getSupabaseEnv();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // `setAll` was called from a Server Component, where cookies are
          // read-only. The session refresh in middleware handles this case, so
          // it is safe to ignore here.
        }
      },
    },
  });
}

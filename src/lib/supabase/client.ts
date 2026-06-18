import { createBrowserClient } from '@supabase/ssr';
import { getSupabaseEnv } from '@/lib/supabase/env';

/**
 * Browser-side Supabase client for use in Client Components. Authenticated as
 * the signed-in user via the anon key, so it honors Row Level Security.
 */
export function createClient() {
  const { url, anonKey } = getSupabaseEnv();
  return createBrowserClient(url, anonKey);
}

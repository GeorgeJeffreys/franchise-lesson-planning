import { createClient } from "@/lib/supabase/server";

// Authenticated landing. Rendered per-request so it reflects the live session.
export const dynamic = "force-dynamic";

/**
 * Temporary placeholder landing. It exists only to prove the auth boundary:
 * the middleware redirects signed-out users to /login, and a signed-in user
 * sees their identity here. The real landing is built in a later phase.
 */
export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="mx-auto max-w-xl p-8">
      <h1 className="text-xl font-semibold">Alsama Lesson Planner</h1>
      <p className="mt-4">
        Signed in as: <strong>{user?.email ?? "(no user)"}</strong>
      </p>
      <p className="mt-2 text-sm text-gray-500">
        Temporary placeholder landing — proves the authentication boundary works.
      </p>
    </main>
  );
}

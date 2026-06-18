import { AppShell } from "@/components/app-shell/AppShell";
import { Card } from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/server";

// Authenticated landing. Rendered per-request so it reflects the live session.
export const dynamic = "force-dynamic";

/**
 * Authenticated landing — the app shell wrapping a placeholder body. The real
 * Weekly Overview content fills this in the next slice. The proxy redirects
 * signed-out users to /login, so reaching here means there is a session.
 */
export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user?.id ?? "")
    .maybeSingle();

  const name = profile?.full_name ?? user?.email ?? "there";

  return (
    <AppShell name={name}>
      <Card className="p-8">
        <h1 className="text-[22px] font-semibold">Signed in as {name}</h1>
        <p className="mt-2 text-[15px] text-text-muted">
          Your weekly overview is coming next.
        </p>

        {/* Temporary: surfaces the auth uid so you can run the teacher
            assignment helper in supabase/admin/. Remove once provisioning
            moves into the app. */}
        <p className="mt-6 text-[12.5px] text-text-faint">
          Your user id (for supabase/admin setup):{" "}
          <code className="rounded-badge bg-surface-subtle px-1.5 py-0.5 font-mono text-text-muted">
            {user?.id ?? "(none)"}
          </code>
        </p>
      </Card>
    </AppShell>
  );
}

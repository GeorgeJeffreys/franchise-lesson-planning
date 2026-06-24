import Link from 'next/link';
import { AppShell } from '@/components/app-shell/AppShell';
import { WeeklyOverview } from '@/components/weekly-overview/WeeklyOverview';
import { getBoardData } from '@/lib/weekly-overview';

// Rendered per-request so it reflects the live session and selected coordinate.
export const dynamic = 'force-dynamic';

type SearchParams = { month?: string; week?: string; view?: string };

/**
 * The authenticated home screen — the curriculum planning board inside the app
 * shell. The selected curriculum coordinate and view are driven by URL search
 * params (`?month=March&week=2`, `?view=calendar|status`) so the page is
 * server-rendered and linkable. The proxy redirects signed-out users to /login.
 */
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { month, week, view: viewParam } = await searchParams;

  const view = viewParam === 'status' ? 'status' : 'calendar';
  const weekNum = week ? Number(week) : undefined;

  const data = await getBoardData({
    month: month || undefined,
    week: Number.isFinite(weekNum) ? weekNum : undefined,
  });

  return (
    <AppShell name={data.teacherName} subtitle={data.context ?? undefined}>
      <WeeklyOverview data={data} view={view} />

      {/* Temporary dev aid: a quiet link to your auth uid, still needed to run
          the supabase/admin provisioning + sample-plan seed. Remove once
          provisioning moves into the app. */}
      <p className="mt-6 text-[12px] text-text-faint">
        Setup helper:{' '}
        <Link href="/whoami" className="underline underline-offset-2 hover:text-text-muted">
          view your user id
        </Link>
      </p>
    </AppShell>
  );
}

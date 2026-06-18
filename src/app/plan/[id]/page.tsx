import { notFound } from 'next/navigation';
import { AppShell } from '@/components/app-shell/AppShell';
import { Breadcrumb } from '@/components/app-shell/Breadcrumb';
import { LessonPlanEditor } from '@/components/editor/LessonPlanEditor';
import { loadPlanForEditor } from '@/lib/editor/load-plan';
import { createClient } from '@/lib/supabase/server';

/** Short context date for the breadcrumb, e.g. "Mon 15 Jun". */
function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(d);
}

// Rendered per-request: the plan is loaded with the auth'd client (RLS).
export const dynamic = 'force-dynamic';

export default async function PlanEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const data = await loadPlanForEditor(id);
  if (!data) notFound();

  // Display name for the shell chrome.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user?.id ?? '')
    .maybeSingle();
  const name = profile?.full_name ?? user?.email ?? 'there';

  const context = `Year ${data.classContext.year} · Group ${data.classContext.groupLabel} · ${shortDate(data.plan.lesson_date)}`;

  return (
    <AppShell name={name} subtitle={`${data.classContext.schoolName} · ${data.classContext.subjectName}`}>
      <Breadcrumb current={context} />
      <LessonPlanEditor data={data} />
    </AppShell>
  );
}

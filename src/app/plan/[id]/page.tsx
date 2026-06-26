import { notFound } from 'next/navigation';
import { AppShell } from '@/components/app-shell/AppShell';
import { LessonPlanEditor } from '@/components/editor/LessonPlanEditor';
import { loadPlanForEditor } from '@/lib/editor/load-plan';
import { getPlanComments } from '@/lib/review/comments';
import { createClient } from '@/lib/supabase/server';

// Rendered per-request: the plan is loaded with the auth'd client (RLS).
export const dynamic = 'force-dynamic';

export default async function PlanEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // The plan load, the shell-chrome identity, and the coordinator review comments
  // (read-only on the author side, RLS-scoped) are independent, so run them in
  // parallel rather than waterfalling.
  const supabase = await createClient();
  const [data, { data: { user } }, comments] = await Promise.all([
    loadPlanForEditor(id),
    supabase.auth.getUser(),
    getPlanComments(id),
  ]);
  if (!data) notFound();

  // Display name for the shell chrome (depends on the resolved user).
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user?.id ?? '')
    .maybeSingle();
  const name = profile?.full_name ?? user?.email ?? 'there';

  return (
    <AppShell name={name} subtitle={`${data.classContext.schoolName} · ${data.classContext.subjectName}`}>
      <LessonPlanEditor data={data} comments={comments} />
    </AppShell>
  );
}

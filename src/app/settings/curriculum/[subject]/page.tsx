import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { AppShell } from '@/components/app-shell/AppShell';
import { getHeaderProfile } from '@/lib/profile';
import { getConsoleAccess } from '@/lib/console';
import { getCurriculumGapsReport } from '@/lib/curriculum/gaps-report';
import { CurriculumGaps } from '@/components/curriculum/reconcile/CurriculumGaps';

// Per-request: reflects the live session and current curriculum rows.
export const dynamic = 'force-dynamic';

/**
 * Settings → Curriculum → per-subject Gaps reconcile. ADMIN-ONLY (reuses the console
 * admin gate — teachers/coordinators are redirected). Scoped to one subject (the
 * `[subject]` route param is the subject code) and its uploaded workbook; the report is
 * classified server-side from the live `curriculum_lesson` rows + the last run's guard
 * warnings (see `getCurriculumGapsReport`). Reached from the "Review gaps" link on the
 * Settings → Curriculum tab's per-subject sync card.
 */
export default async function CurriculumReconcilePage({
  params,
}: {
  params: Promise<{ subject: string }>;
}) {
  const { subject } = await params;
  const subjectCode = decodeURIComponent(subject);

  const access = await getConsoleAccess();
  if (!access.isAdmin) redirect('/');

  const [{ name, subtitle }, t, report] = await Promise.all([
    getHeaderProfile(),
    getTranslations('reconcile'),
    getCurriculumGapsReport(subjectCode),
  ]);

  // Unknown subject or a non-admin read → back to the console.
  if (!report) redirect('/settings');

  return (
    <AppShell name={name} subtitle={subtitle}>
      <div className="mx-auto max-w-[1440px]">
        <Link
          href="/settings"
          className="mb-[14px] inline-flex items-center gap-[6px] text-[12.5px] font-medium text-neutral-600 hover:text-text-muted"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="rtl:-scale-x-100"
            aria-hidden
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
          {t('backToCurriculum')}
        </Link>

        <CurriculumGaps report={report} />
      </div>
    </AppShell>
  );
}

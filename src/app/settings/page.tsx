import Link from 'next/link';
import { AppShell } from '@/components/app-shell/AppShell';
import { getHeaderProfile } from '@/lib/profile';
import { getMyMemberships } from '@/lib/auth';
import { getOnboardingData, getMyClasses } from '@/lib/onboarding';
import { SettingsForm } from '@/components/settings/SettingsForm';
import { SettingsConsole } from '@/components/settings/SettingsConsole';
import {
  getActiveResourceGuideVersion,
  getAdminMembers,
  getCentres,
  getConsoleAccess,
  getConsoleClasses,
  getCoordinatorMembers,
  getCurriculumStatus,
  getSubjects,
  type AdminMembersData,
  type CentreRow,
  type ConsoleClassesData,
  type CoordSpaceMembers,
  type CurriculumSubjectStatus,
  type ResourceGuideVersion,
  type SubjectRow,
} from '@/lib/console';

// Per-request: reflects the live session, memberships and org structure.
export const dynamic = 'force-dynamic';

/**
 * The settings console — a role-aware tabbed surface. Everyone gets the personal
 * "Profile" tab (the existing settings content). Admins additionally get Centres ·
 * Subjects · Classes · Members & roles · Curriculum; coordinators get Members &
 * roles (their spaces) + Curriculum (their subjects). This replaces the retired
 * standalone `/admin` route. Reached from the shell nav (admins/coordinators) and
 * the avatar menu (everyone).
 */
export default async function SettingsPage() {
  const { name, subtitle } = await getHeaderProfile();
  const [access, data, memberships, myClasses] = await Promise.all([
    getConsoleAccess(),
    getOnboardingData(),
    getMyMemberships(),
    getMyClasses(),
  ]);

  // The Profile tab is the existing personal-settings form, unchanged.
  const profileTab = (
    <SettingsForm
      fullName={data.fullName}
      centres={data.centres}
      subjects={data.subjects}
      classes={data.classes}
      teacherCounts={data.teacherCounts}
      classCounts={data.classCounts}
      memberships={memberships.map((m) => ({
        id: m.id,
        schoolId: m.schoolId,
        subjectId: m.subjectId,
        schoolName: m.schoolName,
        subjectName: m.subjectName,
      }))}
      myClasses={myClasses}
    />
  );

  // Load the admin/coordinator datasets only for the roles that render them.
  let centres: CentreRow[] | undefined;
  let subjects: SubjectRow[] | undefined;
  let classesData: ConsoleClassesData | undefined;
  let adminMembers: AdminMembersData | undefined;
  let coordSpaces: CoordSpaceMembers[] | undefined;
  let curriculum: CurriculumSubjectStatus[] | undefined;
  let resourceGuide: ResourceGuideVersion | null | undefined;

  if (access.isAdmin) {
    [centres, subjects, classesData, adminMembers, curriculum, resourceGuide] = await Promise.all([
      getCentres(),
      getSubjects(),
      getConsoleClasses(),
      getAdminMembers(),
      getCurriculumStatus(),
      getActiveResourceGuideVersion(),
    ]);
  } else if (access.isCoordinator) {
    const subjectIds = [...new Set(access.coordinatorSpaces.map((s) => s.subjectId))];
    [coordSpaces, curriculum] = await Promise.all([
      getCoordinatorMembers(),
      getCurriculumStatus(subjectIds),
    ]);
  }

  return (
    <AppShell name={name} subtitle={subtitle}>
      <div className="mx-auto max-w-[1080px]">
        <Link
          href="/"
          className="mb-[14px] inline-flex items-center gap-[6px] text-[12.5px] font-medium text-neutral-600 hover:text-text-muted"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Back to planning
        </Link>

        <SettingsConsole
          access={access}
          profileTab={profileTab}
          centres={centres}
          subjects={subjects}
          classesData={classesData}
          adminMembers={adminMembers}
          coordSpaces={coordSpaces}
          curriculum={curriculum}
          resourceGuide={resourceGuide}
        />
      </div>
    </AppShell>
  );
}

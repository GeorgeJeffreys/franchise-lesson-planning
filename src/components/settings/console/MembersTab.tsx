'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { CoordSpaceMembers } from '@/lib/console';
import { coordRemoveMember } from '@/lib/actions/console';
import {
  Avatar,
  ConsoleTable,
  EmptyState,
  ErrorText,
  GhostButton,
  RolePill,
  SectionCard,
  Td,
  Th,
} from './ui';

// ── Coordinator view ──────────────────────────────────────────────────────────

export function CoordinatorMembersTab({ spaces }: { spaces: CoordSpaceMembers[] }) {
  const router = useRouter();
  const t = useTranslations('settings');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        setError(res.error ?? t('common.somethingWrong'));
        return;
      }
      router.refresh();
    });
  }

  if (spaces.length === 0) {
    return (
      <SectionCard title={t('members.coordinator.title')}>
        <EmptyState>{t('members.coordinator.empty')}</EmptyState>
      </SectionCard>
    );
  }

  const dash = t('common.dash');

  return (
    <div className="space-y-[18px]">
      {spaces.map((space) => (
        <SectionCard
          key={`${space.schoolId}:${space.subjectId}`}
          title={
            <span dir="auto">
              {t('members.coordinator.spaceTitle', {
                subject: space.subjectName ?? '',
                school: space.schoolName ?? '',
              })}
              <span className="ms-2 text-[12.5px] font-medium text-[#A79E94]">
                {t('members.coordinator.spaceMeta', { count: space.members.length })}
              </span>
            </span>
          }
        >
          <ConsoleTable
            head={
              <tr>
                <Th>{t('members.col.person')}</Th>
                <Th>{t('members.col.role')}</Th>
                <Th>{t('members.col.class')}</Th>
                <Th className="text-end">{t('members.col.actions')}</Th>
              </tr>
            }
          >
            {space.members.map((m) => (
              <tr key={m.membershipId}>
                <Td>
                  <div className="flex items-center gap-[10px]">
                    <Avatar name={m.name} />
                    <span className="font-semibold text-[#2A2422]" dir="auto">
                      {m.name}
                      {m.isSelf ? (
                        <span className="ms-2 text-[11.5px] font-semibold text-[#A79E94]">
                          {t('members.you')}
                        </span>
                      ) : null}
                    </span>
                  </div>
                </Td>
                <Td>
                  <RolePill kind={m.role} />
                </Td>
                <Td className="text-[#7A7068]" dir="auto">{m.homeClass ?? dash}</Td>
                <Td className="text-end">
                  {m.isSelf ? (
                    <span className="text-[12.5px] text-[#A79E94]">{dash}</span>
                  ) : (
                    // Promotion to coordinator is now an org-level (all-schools)
                    // grant, so it lives in the admin "Edit access" modal only — a
                    // coordinator can remove a teacher from their space but not mint
                    // another coordinator. (See coordinator_subject / migration 0039.)
                    <GhostButton
                      tone="red"
                      disabled={pending}
                      onClick={() => run(() => coordRemoveMember({ membershipId: m.membershipId }))}
                    >
                      {t('members.coordinator.remove')}
                    </GhostButton>
                  )}
                </Td>
              </tr>
            ))}
          </ConsoleTable>
        </SectionCard>
      ))}
      <ErrorText>{error}</ErrorText>
      <p className="text-[12px] leading-relaxed text-[#A79E94]">
        {t('members.coordinator.footnote')}
      </p>
    </div>
  );
}

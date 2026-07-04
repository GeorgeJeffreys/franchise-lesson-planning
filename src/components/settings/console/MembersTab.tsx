'use client';

import { useCallback, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import type { SubjectMember, SubjectMemberSpace } from '@/lib/console';
import { formatNumber } from '@/lib/format';
import { coordRemoveMember } from '@/lib/actions/console';
import { avatarColors, initialsOf } from '@/components/weekly-overview/avatar';
import { RolePill, type RoleKind } from './ui';
import { cn } from '@/lib/cn';

// The coordinator "Members & roles" tab — a scoped re-skin of the admin Users tab.
// Same list chrome (colour-hashed avatars, search + count, flex-row columns) but
// scoped to the caller's coordinated subject(s), teachers only. The one write a
// coordinator has is "remove from subject", surfaced in a trimmed Edit-access-style
// modal. No invite, no role change, no deactivation — those stay admin-only.

// ── icons ─────────────────────────────────────────────────────────────────────
function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#B6ABA0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4-4" />
    </svg>
  );
}
function XIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

const roleKind = (role: SubjectMember['role']): RoleKind =>
  role === 'coordinator' ? 'coordinator' : 'teacher';

/** 34px colour-hashed initials avatar, matching the Users tab. */
function RowAvatar({ id, name, size = 34 }: { id: string; name: string; size?: number }) {
  const { bg, fg } = avatarColors(id);
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-bold"
      style={{ background: bg, color: fg, width: size, height: size, fontSize: size * 0.35 }}
      aria-hidden
    >
      {initialsOf(name)}
    </span>
  );
}

function SpaceChips({ spaces }: { spaces: SubjectMemberSpace[] }) {
  if (spaces.length === 0) return <span className="text-[13px] text-[#C7BFB5]">—</span>;
  return (
    <span className="flex flex-wrap gap-[5px]">
      {spaces.map((s) => (
        <span
          key={s.subjectId}
          dir="auto"
          className="rounded-[6px] bg-[#F3ECE2] px-[8px] py-[3px] text-[11px] text-[#5A524B]"
        >
          {s.subjectName ?? '—'}
        </span>
      ))}
    </span>
  );
}

export function CoordinatorMembersTab({
  members,
  currentUserId,
}: {
  members: SubjectMember[] | null;
  currentUserId: string | null;
}) {
  const t = useTranslations('settings');
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const closeModal = useCallback(() => setEditingId(null), []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members ?? [];
    return (members ?? []).filter((m) => {
      const hay = `${m.fullName ?? ''} ${m.email ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [members, search]);

  // ── error state ──────────────────────────────────────────────────────────
  if (members === null) {
    if (pending) return null;
    return (
      <ErrorCard
        title={t('members.coordinator.error.title')}
        body={t('members.coordinator.error.body')}
        retry={t('members.coordinator.error.retry')}
        onRetry={() => startTransition(() => router.refresh())}
      />
    );
  }

  // No teachers in any coordinated subject yet (the coordinator sees the tab, but
  // nobody has joined their subject). The footnote explains how people appear.
  if (members.length === 0) {
    return (
      <div>
        <Header count={0} locale={locale} title={t('members.coordinator.title')} />
        <EmptyMembers title={t('members.coordinator.emptyMembers')} />
        <Footnote text={t('members.coordinator.footnote')} />
      </div>
    );
  }

  const editing = editingId ? members.find((m) => m.userId === editingId) ?? null : null;

  return (
    <div>
      <Header count={members.length} locale={locale} title={t('members.coordinator.title')} />

      {/* Toolbar: search */}
      <div className="mb-[16px] flex flex-wrap items-center gap-[8px]">
        <div className="relative w-[260px]">
          <span className="pointer-events-none absolute inset-y-0 start-[11px] flex items-center">
            <SearchIcon />
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('members.coordinator.searchPlaceholder')}
            aria-label={t('members.coordinator.searchPlaceholder')}
            className="w-full rounded-[9px] border border-[#E0D6C7] bg-white px-[11px] py-[8px] ps-[32px] text-[12.5px] text-[#3A332E] outline-none focus:border-[#D9A6BC]"
          />
        </div>
      </div>

      {/* Column headers */}
      <div className="flex items-center border-b border-[#EFE7DA] px-[14px] pb-[9px] pt-[6px]">
        <span className="min-w-[280px] flex-1 text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#A79E94]">
          {t('members.col.person')}
        </span>
        <span className="w-[110px] text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#A79E94]">
          {t('members.col.role')}
        </span>
        <span className="w-[220px] text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#A79E94]">
          {t('members.col.spaces')}
        </span>
        <span className="w-[110px] text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#A79E94]">
          {t('members.col.status')}
        </span>
        <span className="w-[110px]" />
      </div>

      {/* Rows / empty */}
      {filtered.length === 0 ? (
        <EmptyFiltered
          title={t('members.coordinator.emptyFiltered.title', { query: search.trim() })}
          body={t('members.coordinator.emptyFiltered.body')}
          clear={t('members.coordinator.emptyFiltered.clear')}
          onClear={() => setSearch('')}
        />
      ) : (
        <div>
          {filtered.map((m) => (
            <MemberRow
              key={m.userId}
              member={m}
              isYou={m.userId === currentUserId}
              onManage={() => setEditingId(m.userId)}
            />
          ))}
        </div>
      )}

      <Footnote text={t('members.coordinator.footnote')} />

      {editing ? (
        <MemberModal
          key={editing.userId}
          member={editing}
          isSelf={editing.userId === currentUserId}
          onClose={closeModal}
        />
      ) : null}
    </div>
  );
}

// ── header (title + count pill) ─────────────────────────────────────────────────
function Header({ title, count, locale }: { title: string; count: number; locale: string }) {
  return (
    <div className="mb-[16px] flex items-center gap-[12px]">
      <h2 className="text-[19px] font-semibold tracking-[-0.01em] text-ink">{title}</h2>
      <span className="rounded-full bg-[#F3ECE2] px-[10px] py-[3px] text-[12px] font-semibold text-[#A79E94]">
        {formatNumber(count, locale)}
      </span>
    </div>
  );
}

// ── one row ───────────────────────────────────────────────────────────────────
function MemberRow({
  member,
  isYou,
  onManage,
}: {
  member: SubjectMember;
  isYou: boolean;
  onManage: () => void;
}) {
  const t = useTranslations('settings');
  const deactivated = member.isDeactivated;
  const name = member.fullName ?? member.email ?? '—';

  return (
    <div
      className={cn(
        'flex items-center border-b border-[#F0EAE1] px-[14px] py-[14px]',
        deactivated && 'bg-[#FCFAF6]',
      )}
    >
      {/* Person */}
      <span className={cn('flex min-w-[280px] flex-1 items-center gap-[12px]', deactivated && 'opacity-55')}>
        <RowAvatar id={member.userId} name={name} />
        <span className="flex flex-col leading-[1.3]">
          <span className="flex items-center gap-[8px] text-[13.5px] font-semibold text-ink" dir="auto">
            {name}
            {isYou ? (
              <span className="rounded-[5px] bg-[#F3ECE2] px-[6px] py-[2px] text-[9.5px] font-bold tracking-[0.05em] text-[#8A8178]">
                {t('members.coordinator.you')}
              </span>
            ) : null}
          </span>
          <span className="text-[12px] text-[#A79E94]" dir="ltr">
            {member.email}
          </span>
        </span>
      </span>

      {/* Role */}
      <span className={cn('w-[110px]', deactivated && 'opacity-55')}>
        <RolePill kind={roleKind(member.role)} />
      </span>

      {/* Subject spaces */}
      <span className={cn('w-[220px]', deactivated && 'opacity-55')}>
        <SpaceChips spaces={member.spaces} />
      </span>

      {/* Status */}
      <span className="w-[110px]">
        {deactivated ? (
          <span className="rounded-[6px] bg-[#F0EAE1] px-[9px] py-[3px] text-[10.5px] font-bold text-[#9A8C7B]">
            {t('members.coordinator.status.deactivated')}
          </span>
        ) : (
          <span className="inline-flex items-center gap-[6px] text-[12px] text-[#756B64]">
            <span className="size-[7px] rounded-full bg-teal" />
            {t('members.coordinator.status.active')}
          </span>
        )}
      </span>

      {/* Action */}
      <span className="flex w-[110px] items-center justify-end">
        <button
          type="button"
          onClick={onManage}
          className="rounded-[8px] border border-teal-tint-border px-[12px] py-[7px] text-[12.5px] font-semibold text-teal transition-colors hover:bg-teal-tint"
        >
          {t('members.coordinator.manage')}
        </button>
      </span>
    </div>
  );
}

// ── trimmed manage modal (Edit-access styling, remove-only) ─────────────────────
function MemberModal({
  member,
  isSelf,
  onClose,
}: {
  member: SubjectMember;
  isSelf: boolean;
  onClose: () => void;
}) {
  const t = useTranslations('settings');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const name = member.fullName ?? member.email ?? '—';
  const { bg: avatarBg, fg: avatarFg } = avatarColors(member.userId);

  function removeSpace(space: SubjectMemberSpace) {
    setError(null);
    startTransition(async () => {
      const res = await coordRemoveMember({ membershipIds: space.membershipIds });
      if (!res.ok) {
        setError(res.error ?? t('members.coordinator.modal.removeError'));
        return;
      }
      // The parent re-derives `member` from the refreshed list; when this was the
      // teacher's last space they drop out and the modal unmounts on its own.
      router.refresh();
    });
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(34,26,20,.34)' }}
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('members.coordinator.modal.title', { name })}
        onMouseDown={(e) => e.stopPropagation()}
        className="flex max-h-[88vh] w-full flex-col overflow-hidden bg-white outline-none"
        style={{ width: 480, borderRadius: 14, boxShadow: '0 30px 70px -24px rgba(40,28,18,.55)' }}
      >
        {/* Header strip */}
        <div className="flex items-center gap-[13px] border-b border-[#EFE7DA] bg-[#FCFAF6] px-[22px] py-[16px]">
          <span
            className="inline-flex size-[44px] shrink-0 items-center justify-center rounded-full text-[15px] font-bold"
            style={{ background: avatarBg, color: avatarFg }}
            aria-hidden
          >
            {initialsOf(name)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-[8px]">
              <span className="truncate text-[17px] font-semibold text-ink" dir="auto">
                {name}
              </span>
              {isSelf ? (
                <span className="shrink-0 rounded-[5px] bg-[#F3ECE2] px-[6px] py-[2px] text-[9.5px] font-bold tracking-[0.05em] text-[#8A8178]">
                  {t('members.coordinator.you')}
                </span>
              ) : null}
            </div>
            <div className="truncate text-[12.5px] text-[#A79E94]" dir="ltr">
              {member.email}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="shrink-0 rounded-[8px] p-[6px] text-[#8A8178] transition-colors hover:bg-[#F0EAE1] hover:text-ink"
          >
            <XIcon />
          </button>
        </div>

        {/* Body — the teacher's spaces in your subject(s), each removable */}
        <div className="flex-1 overflow-y-auto px-[22px] py-[20px]">
          <div className="mb-[10px] text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#A79E94]">
            {t('members.coordinator.modal.spacesLabel')}
          </div>
          <div className="flex flex-col gap-[8px]">
            {member.spaces.map((space) => (
              <div
                key={space.subjectId}
                className="flex items-center gap-[12px] rounded-[11px] border border-[#E7DECF] bg-white px-[14px] py-[11px]"
              >
                <span className="inline-flex size-[30px] shrink-0 items-center justify-center rounded-[8px] bg-[#E4F0ED] text-[#186155]">
                  <CoordinatorIcon />
                </span>
                <span className="min-w-0 flex-1 text-[14px] font-semibold text-ink" dir="auto">
                  {space.subjectName ?? '—'}
                </span>
                {isSelf ? (
                  <span className="text-[12.5px] text-[#A79E94]">{t('common.dash')}</span>
                ) : (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => removeSpace(space)}
                    className="inline-flex items-center gap-[6px] rounded-[9px] border border-[#EBC9C2] px-[13px] py-[8px] text-[12.5px] font-semibold text-[#B23A2E] transition-colors hover:bg-[#FBECE8] disabled:opacity-50"
                  >
                    {t('members.coordinator.modal.removeFrom', { subject: space.subjectName ?? '' })}
                  </button>
                )}
              </div>
            ))}
          </div>

          {error ? (
            <p className="mt-[12px] text-[12.5px] font-medium text-[#B23A2E]">{error}</p>
          ) : null}

          <p className="mt-[16px] text-[12px] leading-relaxed text-[#A79E94]">
            {t('members.coordinator.modal.removeHint')}
          </p>
        </div>

        {/* Footer — status + Done (no deactivation controls for coordinators) */}
        <div className="flex items-center gap-[12px] border-t border-[#EFE7DA] bg-[#FCFAF6] px-[22px] py-[14px]">
          <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#B4AA9E]">
            {t('members.col.status')}
          </span>
          {member.isDeactivated ? (
            <span className="rounded-[6px] bg-[#F0EAE1] px-[9px] py-[3px] text-[11px] font-bold text-[#9A8C7B]">
              {t('members.coordinator.status.deactivated')}
            </span>
          ) : (
            <span className="inline-flex items-center gap-[6px] text-[12.5px] text-[#5A524B]">
              <span className="size-[7px] rounded-full bg-[#1F7A6C]" />
              {t('members.coordinator.status.active')}
            </span>
          )}

          <button
            type="button"
            onClick={onClose}
            className="ms-auto rounded-[9px] bg-[#1F7A6C] px-[16px] py-[9px] text-[13px] font-semibold text-white transition-colors hover:bg-[#1a6a5d]"
          >
            {t('members.coordinator.modal.done')}
          </button>
        </div>
      </div>
    </div>
  );
}

function CoordinatorIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}

// ── empty / error / footnote ────────────────────────────────────────────────────
function EmptyMembers({ title }: { title: string }) {
  return (
    <div className="px-[24px] py-[44px] text-center">
      <div className="mb-[14px] inline-flex size-[40px] items-center justify-center rounded-[11px] bg-[#F3ECE2]">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#A79E94" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      </div>
      <div className="text-[14.5px] font-semibold text-ink">{title}</div>
    </div>
  );
}

function EmptyFiltered({
  title,
  body,
  clear,
  onClear,
}: {
  title: string;
  body: string;
  clear: string;
  onClear: () => void;
}) {
  return (
    <div className="px-[24px] py-[44px] text-center">
      <div className="mb-[14px] inline-flex size-[40px] items-center justify-center rounded-[11px] bg-[#F3ECE2]">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#A79E94" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4-4" />
        </svg>
      </div>
      <div className="mb-[4px] text-[14.5px] font-semibold text-ink" dir="auto">
        {title}
      </div>
      <div className="mb-[18px] text-[12.5px] text-[#A79E94]">{body}</div>
      <button
        type="button"
        onClick={onClear}
        className="rounded-[9px] border border-teal-tint-border bg-white px-[16px] py-[9px] text-[13px] font-semibold text-teal"
      >
        {clear}
      </button>
    </div>
  );
}

function ErrorCard({
  title,
  body,
  retry,
  onRetry,
}: {
  title: string;
  body: string;
  retry: string;
  onRetry: () => void;
}) {
  return (
    <div className="px-[24px] py-[34px] text-center">
      <div className="mb-[14px] inline-flex size-[40px] items-center justify-center rounded-[11px] bg-danger-bg">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#B23A2E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4M12 16h.01" />
        </svg>
      </div>
      <div className="mb-[4px] text-[14.5px] font-semibold text-ink">{title}</div>
      <div className="mb-[18px] text-[12.5px] leading-[1.5] text-[#A79E94]">{body}</div>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-[7px] rounded-[9px] bg-teal px-[18px] py-[10px] text-[13.5px] font-semibold text-white"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M21 12a9 9 0 1 1-2.6-6.4M21 4v5h-5" />
        </svg>
        {retry}
      </button>
    </div>
  );
}

function Footnote({ text }: { text: string }) {
  return <p className="mt-[18px] text-[12px] leading-relaxed text-[#A79E94]">{text}</p>;
}

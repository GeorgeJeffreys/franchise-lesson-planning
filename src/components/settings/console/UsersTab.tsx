'use client';

import { useMemo, useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { AdminUser, UserSpace } from '@/lib/console';
import { setUserAdmin, setUserDeactivated } from '@/lib/actions/users';
import { Avatar, ErrorText, Modal } from './ui';
import { cn } from '@/lib/cn';

type AccessFilter = 'all' | 'admin' | 'nonAdmin';
type StatusFilter = 'active' | 'deactivated' | 'all';

// ── icons (inline, matching the mockup) ───────────────────────────────────────
function ShieldIcon({ className, size = 12 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}
function PowerIcon({ className, size = 12 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M18.36 6.64a9 9 0 1 1-12.73 0M12 2v10" />
    </svg>
  );
}
function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#B6ABA0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4-4" />
    </svg>
  );
}
function Chevron() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8A8178" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

// ── filter dropdown (styled native select) ────────────────────────────────────
function FilterSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-[7px] rounded-[9px] border border-[#E0D6C7] bg-white px-[12px] py-[8px] text-[12.5px] font-semibold text-[#3A332E]">
      <span>{label}</span>
      <span className="relative inline-flex items-center gap-[7px]">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as T)}
          className="cursor-pointer appearance-none bg-transparent pe-[2px] font-semibold text-[#3A332E] outline-none"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <Chevron />
      </span>
    </label>
  );
}

// ── space chips ───────────────────────────────────────────────────────────────
function SpaceChips({
  spaces,
  isAdmin,
  deactivated,
  orgWideLabel,
  spaceLabel,
}: {
  spaces: UserSpace[];
  isAdmin: boolean;
  deactivated: boolean;
  orgWideLabel: string;
  spaceLabel: (s: UserSpace) => string;
}) {
  if (isAdmin) {
    return (
      <span
        className={cn(
          'rounded-[6px] px-[9px] py-[3px] text-[11px] font-semibold',
          deactivated ? 'bg-[#F0EAE1] text-[#9A8C7B]' : 'bg-teal-tint text-teal-deep',
        )}
      >
        {orgWideLabel}
      </span>
    );
  }
  if (spaces.length === 0) return <span className="text-[13px] text-[#C7BFB5]">—</span>;
  return (
    <span className="flex flex-wrap gap-[5px]">
      {spaces.map((s, i) => (
        <span
          key={i}
          dir="auto"
          className={cn(
            'rounded-[6px] px-[8px] py-[3px] text-[11px]',
            deactivated ? 'bg-[#F0EAE1] text-[#9A8C7B]' : 'bg-[#F3ECE2] text-[#5A524B]',
          )}
        >
          {spaceLabel(s)}
        </span>
      ))}
    </span>
  );
}

export function UsersTab({
  users,
  currentUserId,
}: {
  users: AdminUser[] | null;
  currentUserId: string | null;
}) {
  const t = useTranslations('settings');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [access, setAccess] = useState<AccessFilter>('all');
  const [status, setStatus] = useState<StatusFilter>('active');

  // Confirmation dialog state (promote + deactivate only).
  const [promoteTarget, setPromoteTarget] = useState<AdminUser | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<AdminUser | null>(null);

  const roleLabel = (role: UserSpace['role']) => t(`roles.${role}`);
  const spaceLabel = (s: UserSpace) => {
    const base = t('users.space', { subject: s.subject ?? '—', role: roleLabel(s.role) });
    return base;
  };

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, onDone?: () => void) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        setError(res.error ?? t('common.somethingWrong'));
        return;
      }
      onDone?.();
      router.refresh();
    });
  }

  // Number of admins who can still administer the org — the last one is protected.
  const activeAdminCount = useMemo(
    () => (users ?? []).filter((u) => u.isAdmin && !u.isDeactivated).length,
    [users],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (users ?? []).filter((u) => {
      if (q) {
        const hay = `${u.fullName ?? ''} ${u.email ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (access === 'admin' && !u.isAdmin) return false;
      if (access === 'nonAdmin' && u.isAdmin) return false;
      if (status === 'active' && u.isDeactivated) return false;
      if (status === 'deactivated' && !u.isDeactivated) return false;
      return true;
    });
  }, [users, search, access, status]);

  // ── error state ──────────────────────────────────────────────────────────
  if (users === null) {
    if (pending) return <UsersSkeleton usersLabel={t('users.title')} />;
    return (
      <ErrorCard
        title={t('users.error.title')}
        body={t('users.error.body')}
        retry={t('users.error.retry')}
        onRetry={() => startTransition(() => router.refresh())}
      />
    );
  }

  const clearFilters = () => {
    setSearch('');
    setAccess('all');
    setStatus('all');
  };
  const filterDescriptor = [
    search.trim(),
    access !== 'all' ? t(`users.filter.access.${access}`) : '',
    status !== 'all' ? t(`users.filter.status.${status}`) : '',
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div>
      {/* Title + total-count pill */}
      <div className="mb-[16px] flex items-center gap-[12px]">
        <h2 className="text-[19px] font-semibold tracking-[-0.01em] text-ink">{t('users.title')}</h2>
        <span className="rounded-full bg-[#F3ECE2] px-[10px] py-[3px] text-[12px] font-semibold text-[#A79E94]">
          {users.length}
        </span>
      </div>

      {/* Toolbar: search + Access + Status */}
      <div className="mb-[16px] flex flex-wrap items-center gap-[8px]">
        <div className="relative w-[260px]">
          <span className="pointer-events-none absolute inset-y-0 start-[11px] flex items-center">
            <SearchIcon />
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('users.searchPlaceholder')}
            aria-label={t('users.searchPlaceholder')}
            className="w-full rounded-[9px] border border-[#E0D6C7] bg-white px-[11px] py-[8px] ps-[32px] text-[12.5px] text-[#3A332E] outline-none focus:border-[#D9A6BC]"
          />
        </div>
        <FilterSelect<AccessFilter>
          label={`${t('users.filter.access.label')}:`}
          value={access}
          onChange={setAccess}
          options={[
            { value: 'all', label: t('users.filter.access.all') },
            { value: 'admin', label: t('users.filter.access.admin') },
            { value: 'nonAdmin', label: t('users.filter.access.nonAdmin') },
          ]}
        />
        <FilterSelect<StatusFilter>
          label={`${t('users.filter.status.label')}:`}
          value={status}
          onChange={setStatus}
          options={[
            { value: 'active', label: t('users.filter.status.active') },
            { value: 'deactivated', label: t('users.filter.status.deactivated') },
            { value: 'all', label: t('users.filter.status.all') },
          ]}
        />
      </div>

      <ErrorText>{error}</ErrorText>

      {/* Column headers */}
      <div className="flex items-center border-b border-[#EFE7DA] px-[14px] pb-[9px] pt-[6px]">
        <span className="min-w-[300px] flex-1 text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#A79E94]">
          {t('users.col.person')}
        </span>
        <span className="w-[108px] text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#A79E94]">
          {t('users.col.access')}
        </span>
        <span className="w-[268px] text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#A79E94]">
          {t('users.col.spaces')}
        </span>
        <span className="w-[120px] text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#A79E94]">
          {t('users.col.status')}
        </span>
        <span className="w-[210px]" />
      </div>

      {/* Rows / empty */}
      {filtered.length === 0 ? (
        <EmptyFiltered
          title={t('users.empty.title', { query: filterDescriptor })}
          body={t('users.empty.body')}
          clear={t('users.empty.clear')}
          onClear={clearFilters}
        />
      ) : (
        <div>
          {filtered.map((u) => (
            <UserRow
              key={u.userId}
              user={u}
              isYou={u.userId === currentUserId}
              isLastActiveAdmin={u.isAdmin && !u.isDeactivated && activeAdminCount <= 1}
              pending={pending}
              spaceLabel={spaceLabel}
              onMakeAdmin={() => setPromoteTarget(u)}
              onRemoveAdmin={() => run(() => setUserAdmin(u.userId, false))}
              onDeactivate={() => setDeactivateTarget(u)}
              onReactivate={() => run(() => setUserDeactivated(u.userId, false))}
            />
          ))}
        </div>
      )}

      {/* Promote dialog (teal, significant) */}
      {promoteTarget ? (
        <PromoteDialog
          user={promoteTarget}
          pending={pending}
          onCancel={() => setPromoteTarget(null)}
          onConfirm={() =>
            run(() => setUserAdmin(promoteTarget.userId, true), () => setPromoteTarget(null))
          }
        />
      ) : null}

      {/* Deactivate dialog (danger, reversible) */}
      {deactivateTarget ? (
        <DeactivateDialog
          user={deactivateTarget}
          pending={pending}
          onCancel={() => setDeactivateTarget(null)}
          onConfirm={() =>
            run(
              () => setUserDeactivated(deactivateTarget.userId, true),
              () => setDeactivateTarget(null),
            )
          }
        />
      ) : null}
    </div>
  );
}

// ── one row ───────────────────────────────────────────────────────────────────
function UserRow({
  user,
  isYou,
  isLastActiveAdmin,
  pending,
  spaceLabel,
  onMakeAdmin,
  onRemoveAdmin,
  onDeactivate,
  onReactivate,
}: {
  user: AdminUser;
  isYou: boolean;
  isLastActiveAdmin: boolean;
  pending: boolean;
  spaceLabel: (s: UserSpace) => string;
  onMakeAdmin: () => void;
  onRemoveAdmin: () => void;
  onDeactivate: () => void;
  onReactivate: () => void;
}) {
  const t = useTranslations('settings');
  const deactivated = user.isDeactivated;
  const name = user.fullName ?? user.email ?? '—';

  return (
    <div
      className={cn(
        'flex items-center border-b border-[#F0EAE1] px-[14px] py-[14px]',
        deactivated && 'bg-[#FCFAF6]',
      )}
    >
      {/* Person */}
      <span className={cn('flex min-w-[300px] flex-1 items-center gap-[12px]', deactivated && 'opacity-55')}>
        <Avatar name={name} />
        <span className="flex flex-col leading-[1.3]">
          <span className="flex items-center gap-[8px] text-[13.5px] font-semibold text-ink" dir="auto">
            {name}
            {isYou ? (
              <span className="rounded-[5px] bg-[#F3ECE2] px-[6px] py-[2px] text-[9.5px] font-bold tracking-[0.05em] text-[#8A8178]">
                {t('users.you')}
              </span>
            ) : null}
          </span>
          <span className="text-[12px] text-[#A79E94]" dir="ltr">
            {user.email}
          </span>
        </span>
      </span>

      {/* Access */}
      <span className={cn('w-[108px]', deactivated && 'opacity-55')}>
        {user.isAdmin ? (
          <span
            className={cn(
              'inline-flex items-center gap-[5px] rounded-[6px] py-[3px] pe-[9px] ps-[7px] text-[10.5px] font-bold',
              deactivated ? 'bg-[#F0EAE1] text-[#9A8C7B]' : 'bg-teal-tint text-teal-deep',
            )}
          >
            <ShieldIcon />
            {t('users.adminBadge')}
          </span>
        ) : (
          <span className="text-[13px] text-[#C7BFB5]">—</span>
        )}
      </span>

      {/* Subject spaces */}
      <span className={cn('w-[268px]', deactivated && 'opacity-55')}>
        <SpaceChips
          spaces={user.spaces}
          isAdmin={user.isAdmin}
          deactivated={deactivated}
          orgWideLabel={
            deactivated ? `${t('users.orgWide')}${t('users.retainedSuffix')}` : t('users.orgWide')
          }
          spaceLabel={(s) =>
            deactivated ? `${spaceLabel(s)}${t('users.retainedSuffix')}` : spaceLabel(s)
          }
        />
      </span>

      {/* Status */}
      <span className="w-[120px]">
        {deactivated ? (
          <span className="rounded-[6px] bg-[#F0EAE1] px-[9px] py-[3px] text-[10.5px] font-bold text-[#9A8C7B]">
            {t('users.status.deactivated')}
          </span>
        ) : (
          <span className="inline-flex items-center gap-[6px] text-[12px] text-[#756B64]">
            <span className="size-[7px] rounded-full bg-teal" />
            {t('users.status.active')}
          </span>
        )}
      </span>

      {/* Actions */}
      <span className="relative flex w-[210px] items-center justify-end gap-[4px]">
        {deactivated ? (
          <ActionButton tone="teal" bold onClick={onReactivate} disabled={pending}>
            {t('users.action.reactivate')}
          </ActionButton>
        ) : (
          <>
            {isLastActiveAdmin ? (
              <span className="group relative flex items-center gap-[4px]">
                <span className="cursor-not-allowed px-[8px] py-[4px] text-[12px] font-semibold text-[#C7BFB5]">
                  {t('users.action.removeAdmin')}
                </span>
                <span className="cursor-not-allowed px-[8px] py-[4px] text-[12px] font-semibold text-[#C7BFB5]">
                  {t('users.action.deactivate')}
                </span>
                <span
                  role="tooltip"
                  className="pointer-events-none absolute bottom-[calc(100%+9px)] end-[4px] z-10 w-[236px] rounded-[8px] bg-[#2A2422] px-[11px] py-[9px] text-[11.5px] leading-[1.5] text-[#F5EFE7] opacity-0 shadow-[0_8px_24px_-8px_rgba(40,30,20,0.5)] transition-opacity group-hover:opacity-100"
                >
                  {t('users.lastAdminTooltip')}
                </span>
              </span>
            ) : user.isAdmin ? (
              <>
                <ActionButton tone="danger" onClick={onRemoveAdmin} disabled={pending}>
                  {t('users.action.removeAdmin')}
                </ActionButton>
                <DeactivateAction isYou={isYou} pending={pending} onClick={onDeactivate} />
              </>
            ) : (
              <>
                <ActionButton tone="teal" onClick={onMakeAdmin} disabled={pending}>
                  {t('users.action.makeAdmin')}
                </ActionButton>
                <DeactivateAction isYou={isYou} pending={pending} onClick={onDeactivate} />
              </>
            )}
          </>
        )}
      </span>
    </div>
  );
}

/** The Deactivate text-action; always disabled on the current user's own row. */
function DeactivateAction({
  isYou,
  pending,
  onClick,
}: {
  isYou: boolean;
  pending: boolean;
  onClick: () => void;
}) {
  const t = useTranslations('settings');
  if (isYou) {
    return (
      <span className="cursor-not-allowed px-[8px] py-[4px] text-[12px] font-semibold text-[#C7BFB5]">
        {t('users.action.deactivate')}
      </span>
    );
  }
  return (
    <ActionButton tone="danger" onClick={onClick} disabled={pending}>
      {t('users.action.deactivate')}
    </ActionButton>
  );
}

function ActionButton({
  children,
  tone,
  bold,
  onClick,
  disabled,
}: {
  children: ReactNode;
  tone: 'teal' | 'danger';
  bold?: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'px-[8px] py-[4px] text-[12px] transition-opacity hover:opacity-70 disabled:opacity-40',
        bold ? 'font-bold' : 'font-semibold',
        tone === 'teal' ? 'text-teal' : 'text-danger',
      )}
    >
      {children}
    </button>
  );
}

// ── dialogs ───────────────────────────────────────────────────────────────────
function PromoteDialog({
  user,
  pending,
  onCancel,
  onConfirm,
}: {
  user: AdminUser;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const t = useTranslations('settings');
  const name = user.fullName ?? user.email ?? '—';
  const detail =
    user.spaces.length > 0
      ? user.spaces
          .map((s) => t('users.space', { subject: s.subject ?? '—', role: t(`roles.${s.role}`) }))
          .join(', ')
      : t('users.promoteDialog.noSpaces');

  return (
    <Modal
      open
      onClose={onCancel}
      width={468}
      title={
        <span className="flex items-center gap-[11px]">
          <span className="inline-flex size-[34px] shrink-0 items-center justify-center rounded-[9px] bg-teal-tint text-teal-deep">
            <ShieldIcon size={17} />
          </span>
          <span className="text-[16px] font-semibold text-ink" dir="auto">
            {t('users.promoteDialog.title', { name })}
          </span>
        </span>
      }
    >
      <div className="mb-[16px] text-[13px] leading-[1.6] text-[#5A524B]">
        {t('users.promoteDialog.body')}
      </div>
      <div className="mb-[18px] flex items-center gap-[10px] rounded-[10px] border border-given-border bg-given px-[13px] py-[11px]">
        <Avatar name={name} />
        <div className="leading-[1.3]">
          <div className="text-[13px] font-semibold text-ink" dir="auto">
            {name}
          </div>
          <div className="text-[11.5px] text-[#A79E94]" dir="auto">
            {t('users.promoteDialog.currently', { detail })}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-[10px]">
        <button
          type="button"
          onClick={onConfirm}
          disabled={pending}
          className="rounded-[9px] bg-teal px-[16px] py-[10px] text-[13px] font-semibold text-white transition-colors hover:bg-[#1a6a5d] disabled:opacity-50"
        >
          {t('users.promoteDialog.confirm')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="ms-auto text-[13px] font-medium text-[#756B64] disabled:opacity-50"
        >
          {t('common.cancel')}
        </button>
      </div>
    </Modal>
  );
}

function DeactivateDialog({
  user,
  pending,
  onCancel,
  onConfirm,
}: {
  user: AdminUser;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const t = useTranslations('settings');
  const name = user.fullName ?? user.email ?? '—';
  return (
    <Modal
      open
      onClose={onCancel}
      width={468}
      title={
        <span className="flex items-center gap-[11px]">
          <span className="inline-flex size-[34px] shrink-0 items-center justify-center rounded-[9px] bg-danger-bg text-danger">
            <PowerIcon size={17} />
          </span>
          <span className="text-[16px] font-semibold text-ink" dir="auto">
            {t('users.deactivateDialog.title', { name })}
          </span>
        </span>
      }
    >
      <div className="mb-[12px] rounded-[10px] border border-danger-border bg-danger-bg px-[14px] py-[12px] text-[13px] leading-[1.55] text-[#8A3A2E]">
        {t('users.deactivateDialog.warning', { name })}
      </div>
      <div className="mb-[18px] text-[13px] leading-[1.6] text-[#5A524B]">
        {t('users.deactivateDialog.body')}
      </div>
      <div className="flex items-center gap-[10px]">
        <button
          type="button"
          onClick={onConfirm}
          disabled={pending}
          className="rounded-[9px] bg-danger px-[16px] py-[10px] text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {t('users.deactivateDialog.confirm')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="ms-auto text-[13px] font-medium text-[#756B64] disabled:opacity-50"
        >
          {t('common.cancel')}
        </button>
      </div>
    </Modal>
  );
}

// ── empty / error / loading ───────────────────────────────────────────────────
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

function UsersSkeleton({ usersLabel }: { usersLabel: string }) {
  return (
    <div>
      <div className="sr-only">{usersLabel}</div>
      <div className="mb-[18px] h-[20px] w-[92px] animate-pulse rounded-[6px] bg-[#ECE4D7]" />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-[12px] border-b border-[#F0EAE1] py-[13px]">
          <span className="size-[34px] animate-pulse rounded-full bg-[#ECE4D7]" />
          <span className="flex-1">
            <span className="mb-[7px] block h-[12px] w-[46%] animate-pulse rounded-[4px] bg-[#ECE4D7]" />
            <span className="block h-[10px] w-[62%] animate-pulse rounded-[4px] bg-[#F0EAE1]" />
          </span>
          <span className="h-[18px] w-[66px] animate-pulse rounded-[6px] bg-[#F0EAE1]" />
        </div>
      ))}
    </div>
  );
}

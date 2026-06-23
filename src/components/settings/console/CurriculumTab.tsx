'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { CurriculumSubjectStatus } from '@/lib/console';
import { importCurriculumAction } from '@/lib/curriculum/actions';
import { ErrorText, GhostButton, MonoChip, SectionCard } from './ui';

function timeAgo(iso: string | null): string {
  if (!iso) return 'never';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'unknown';
  const secs = Math.round((Date.now() - then) / 1000);
  if (secs < 60) return 'just now';
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? '' : 's'} ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export function CurriculumTab({ statuses }: { statuses: CurriculumSubjectStatus[] }) {
  if (statuses.length === 0) {
    return (
      <SectionCard title="Curriculum">
        <div className="px-[18px] py-[34px] text-center text-[13px] text-[#A79E94]">
          No subjects to sync.
        </div>
      </SectionCard>
    );
  }
  return (
    <div className="space-y-[18px]">
      {statuses.map((s) => (
        <CurriculumCard key={s.subjectId} status={s} />
      ))}
    </div>
  );
}

function CurriculumCard({ status }: { status: CurriculumSubjectStatus }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const run = status.latestRun;
  const state: 'idle' | 'syncing' | 'success' | 'error' = pending
    ? 'syncing'
    : error
      ? 'error'
      : run?.status === 'error'
        ? 'error'
        : run
          ? 'success'
          : 'idle';

  function onFile(file: File) {
    setMessage(null);
    setError(null);
    const fd = new FormData();
    fd.set('subject_code', status.code);
    fd.set('file', file);
    startTransition(async () => {
      const res = await importCurriculumAction(null, fd);
      if (res.ok) {
        setMessage(res.message);
      } else {
        setError(res.message);
      }
      router.refresh();
    });
  }

  return (
    <SectionCard
      title={
        <span className="flex items-center gap-2">
          {status.name} <MonoChip>{status.code}</MonoChip>
        </span>
      }
      action={<StateBadge state={state} />}
    >
      <div className="flex flex-wrap items-end justify-between gap-4 px-[18px] py-[16px]">
        <div className="flex flex-wrap gap-x-[28px] gap-y-2 text-[13px]">
          <Stat label="Lessons" value={run?.rowsUpserted ?? '—'} />
          <Stat label="Unresolved" value={run?.unresolved ?? '—'} />
          <Stat label="Deactivated" value={run?.rowsDeactivated ?? '—'} />
          <Stat label="Last synced" value={timeAgo(run?.finishedAt ?? run?.startedAt ?? null)} />
        </div>
        <div className="flex items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
              e.target.value = '';
            }}
          />
          <GhostButton tone="teal" disabled={pending} onClick={() => fileRef.current?.click()}>
            {pending ? 'Syncing…' : 'Upload .xlsx'}
          </GhostButton>
        </div>
      </div>

      {run?.status === 'error' && run.error ? (
        <div className="px-[18px] pb-[14px]">
          <p className="text-[12.5px] font-medium text-[#B23A2E]">Last sync failed: {run.error}</p>
        </div>
      ) : null}
      {message ? (
        <div className="px-[18px] pb-[14px]">
          <p className="text-[12.5px] font-medium text-[#186155]">{message}</p>
        </div>
      ) : null}
      {error ? (
        <div className="px-[18px] pb-[14px]">
          <ErrorText>{error}</ErrorText>
        </div>
      ) : null}
    </SectionCard>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="text-[10.5px] font-bold uppercase tracking-[0.05em] text-[#A79E94]">{label}</div>
      <div className="mt-px text-[14px] font-semibold tabular-nums text-[#2A2422]">{value}</div>
    </div>
  );
}

function StateBadge({ state }: { state: 'idle' | 'syncing' | 'success' | 'error' }) {
  const map = {
    idle: { bg: '#F3ECE2', fg: '#7A7068', label: 'Not synced' },
    syncing: { bg: '#E4F0ED', fg: '#186155', label: 'Syncing…' },
    success: { bg: '#E4F0ED', fg: '#186155', label: 'Synced' },
    error: { bg: '#FBF2F5', fg: '#B23A2E', label: 'Error' },
  }[state];
  return (
    <span
      className="inline-flex items-center rounded-full px-[10px] py-[3px] text-[11.5px] font-semibold"
      style={{ background: map.bg, color: map.fg }}
    >
      {map.label}
    </span>
  );
}

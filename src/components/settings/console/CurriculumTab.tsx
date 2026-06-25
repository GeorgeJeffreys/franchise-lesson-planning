'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { CurriculumSubjectStatus } from '@/lib/console';
import { importCurriculumAction } from '@/lib/curriculum/actions';
import { GhostButton, MonoChip, SectionCard } from './ui';

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

/** Local clock time as HH:MM (for the "Sync failed · {HH:MM}" badge). */
function hhmm(iso: string | null): string {
  if (!iso) return '--:--';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '--:--';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * Card state for one subject — a discriminated union that renders EXACTLY ONE
 * status indicator (one badge + at most one status element). The standing stats
 * (Lessons / Unresolved / Deactivated / Last synced) keep coming from the run
 * summary and sit outside this union.
 *
 * `idle` / `syncing` / `error` are derived from the persisted latest run
 * (`success`→idle, `running`→syncing, `error`→error). `success` is a transient
 * client-only state, entered only when an in-session upload transitions
 * running→done; on a full reload the latest run reads back as `success` →
 * derives to `idle`.
 *
 * `syncing` carries optional parsed/total ONLY for a future run that exposes
 * them — `curriculum_sync_run` records no such counts today, so they stay
 * undefined and the bar renders indeterminate (never a fabricated %).
 */
type CurriculumSyncState =
  | { kind: 'idle' }
  | { kind: 'syncing'; parsed?: number; total?: number }
  | { kind: 'success'; summary: string }
  | { kind: 'error'; badgeAt: string; message: string };

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
  // Transient, in-session only. `success` holds the summary line after an upload
  // succeeds; `clientError` holds an upload/validation failure with the moment it
  // happened (for the "Sync failed · {HH:MM}" badge). Both clear on the next run
  // and neither survives a full reload — the card then re-derives from the run.
  const [success, setSuccess] = useState<string | null>(null);
  const [clientError, setClientError] = useState<{ message: string; at: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const run = status.latestRun;
  const lastSyncedIso = run?.finishedAt ?? run?.startedAt ?? null;
  const unresolved = run?.unresolved ?? 0;

  // ── Derive the single discriminated state ──
  // Precedence: in-flight upload → transient client result → persisted run. A run
  // that finished hours ago is `idle`, not `success`.
  const state: CurriculumSyncState = pending
    ? { kind: 'syncing' } // no parsed/total in the schema → indeterminate bar
    : clientError
      ? { kind: 'error', badgeAt: clientError.at, message: clientError.message }
      : success
        ? { kind: 'success', summary: success }
        : run?.status === 'running'
          ? { kind: 'syncing' }
          : run?.status === 'error'
            ? {
                kind: 'error',
                badgeAt: run.finishedAt ?? run.startedAt ?? '',
                message: `Couldn't reach the curriculum source. Last good sync was ${timeAgo(
                  status.lastGoodAt,
                )}.`,
              }
            : { kind: 'idle' };

  function onFile(file: File) {
    setSuccess(null);
    setClientError(null);
    const fd = new FormData();
    fd.set('subject_code', status.code);
    fd.set('file', file);
    startTransition(async () => {
      const res = await importCurriculumAction(null, fd);
      if (res.ok) {
        setSuccess(res.message);
      } else {
        setClientError({ message: res.message, at: new Date().toISOString() });
      }
      router.refresh();
    });
  }

  // No "re-pull from source" trigger exists (sync is n8n folder-watch driven, or
  // a manual file upload). Refresh now / Retry sync are rendered disabled until
  // such a trigger lands — see the curriculum-sync brief, Phase 0 #3.
  const noTrigger = true;

  return (
    <SectionCard
      title={
        <span className="flex items-center gap-2">
          {status.name} <MonoChip>{status.code}</MonoChip>
        </span>
      }
      action={<StateBadge state={state} lastSyncedIso={lastSyncedIso} />}
    >
      <div className="flex flex-wrap items-end justify-between gap-4 px-[18px] py-[16px]">
        <div className="flex flex-wrap gap-x-[28px] gap-y-2 text-[13px]">
          <Stat label="Lessons" value={run?.rowsUpserted ?? '—'} />
          <Stat label="Unresolved" value={run?.unresolved ?? '—'} />
          <Stat label="Deactivated" value={run?.rowsDeactivated ?? '—'} />
          <Stat label="Last synced" value={timeAgo(lastSyncedIso)} />
        </div>
        <div className="flex items-center gap-3">
          {state.kind === 'syncing' ? (
            // Syncing: the badge + progress bar are the entire status; the only
            // action is the disabled in-flight label.
            <GhostButton tone="teal" disabled>
              Refreshing…
            </GhostButton>
          ) : (
            <>
              {state.kind === 'error' ? (
                <GhostButton tone="teal" disabled={noTrigger}>
                  Retry sync
                </GhostButton>
              ) : (
                <GhostButton tone="teal" disabled={noTrigger}>
                  Refresh now
                </GhostButton>
              )}
              {state.kind === 'success' && unresolved > 0 ? (
                <GhostButton
                  tone="teal"
                  onClick={() => {
                    // TODO: no unresolved-review surface exists yet — that's a
                    // separate slice. Wire this to it when it lands.
                  }}
                >
                  Review {unresolved} unresolved
                </GhostButton>
              ) : null}
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
              <GhostButton tone="teal" onClick={() => fileRef.current?.click()}>
                Upload .xlsx
              </GhostButton>
            </>
          )}
        </div>
      </div>

      {/* Exactly one status element below the stat row, driven by the state. */}
      {state.kind === 'syncing' ? (
        <div className="px-[18px] pb-[16px]">
          <SyncProgress parsed={state.parsed} total={state.total} />
        </div>
      ) : state.kind === 'success' ? (
        <div className="px-[18px] pb-[14px]">
          <p className="text-[12.5px] font-medium text-[#186155]">{state.summary}</p>
        </div>
      ) : state.kind === 'error' ? (
        <div className="px-[18px] pb-[14px]">
          <p className="text-[12.5px] font-medium text-[#B23A2E]">{state.message}</p>
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

/**
 * The sync progress element. Determinate (teal fill + `{pct}% · {parsed} of
 * ~{total}`) when the run exposes parsed/total; otherwise a single indeterminate
 * teal bar with no text under it. The schema carries no counts today, so this
 * renders indeterminate — numbers are never fabricated.
 */
function SyncProgress({ parsed, total }: { parsed?: number; total?: number }) {
  const determinate = typeof total === 'number' && total > 0 && typeof parsed === 'number';
  if (determinate) {
    const pct = Math.min(100, Math.max(0, Math.round((parsed! / total!) * 100)));
    return (
      <div>
        <div className="relative h-[6px] w-full overflow-hidden rounded-full bg-[#E4F0ED]">
          <div
            className="h-full rounded-full bg-[#1F7A6C] transition-[width] duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-[7px] text-[12px] text-[#A79E94]">
          {pct}% · {parsed} of ~{total}
        </p>
      </div>
    );
  }
  return (
    <div
      className="relative h-[6px] w-full overflow-hidden rounded-full bg-[#E4F0ED]"
      role="progressbar"
      aria-label="Syncing curriculum"
    >
      <span className="curriculum-sync-bar" />
    </div>
  );
}

function StateBadge({
  state,
  lastSyncedIso,
}: {
  state: CurriculumSyncState;
  lastSyncedIso: string | null;
}) {
  const teal = { bg: '#E4F0ED', fg: '#186155' };
  const red = { bg: '#FBF2F5', fg: '#B23A2E' };

  let bg = teal.bg;
  let fg = teal.fg;
  let label: string;
  switch (state.kind) {
    case 'syncing':
      label = 'Syncing…';
      break;
    case 'success':
      label = 'Synced just now';
      break;
    case 'error':
      ({ bg, fg } = red);
      label = `Sync failed · ${hhmm(state.badgeAt)}`;
      break;
    case 'idle':
    default:
      label = `Synced ${timeAgo(lastSyncedIso)}`;
      break;
  }

  return (
    <span
      className="inline-flex items-center rounded-full px-[10px] py-[3px] text-[11.5px] font-semibold"
      style={{ background: bg, color: fg }}
    >
      {label}
    </span>
  );
}

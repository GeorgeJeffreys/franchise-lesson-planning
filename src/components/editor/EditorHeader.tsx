'use client';

import type { PlanStatus } from '@/types/lesson';
import type { EditorClassContext, EditorCurriculumContext } from '@/lib/editor/load-plan';
import { cn } from '@/lib/cn';
import { Spinner } from '@/components/ui/Spinner';

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

interface EditorHeaderProps {
  classContext: EditorClassContext;
  curriculum: EditorCurriculumContext | null;
  lessonDate: string;
  saveState: SaveState;
  status: PlanStatus;
  canSubmit: boolean;
  submitting: boolean;
  onSubmit: () => void;
  onUnsubmit: () => void;
}

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(d);
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === 'saving') {
    return <span className="text-[13px] text-neutral-600">Saving…</span>;
  }
  if (state === 'error') {
    return <span className="text-[13px] text-pink">Save failed — retrying on next edit</span>;
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] text-status-approved">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12l4 4 10-11" />
      </svg>
      Saved
    </span>
  );
}

/**
 * The single submit control. Its label, style, and behaviour follow the plan's
 * status, occupying one fixed slot in the header:
 *  - in_progress / needs_review → "Submit for approval" (submits the plan).
 *  - submitted → a filled "Submitted · click to keep editing" (reverts to
 *    in_progress so the teacher can keep editing).
 *  - approved → a display-only "Approved" badge (not clickable).
 */
function SubmitControl({
  status,
  canSubmit,
  submitting,
  onSubmit,
  onUnsubmit,
}: {
  status: PlanStatus;
  canSubmit: boolean;
  submitting: boolean;
  onSubmit: () => void;
  onUnsubmit: () => void;
}) {
  if (status === 'approved') {
    return (
      <span className="inline-flex items-center gap-[7px] rounded-sm border border-status-approved-border bg-status-approved-bg px-4 py-[9px] text-[14px] font-semibold text-status-approved">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12l4 4 10-11" />
        </svg>
        Approved
      </span>
    );
  }

  if (status === 'submitted') {
    return (
      <button
        type="button"
        onClick={onUnsubmit}
        disabled={submitting}
        aria-busy={submitting || undefined}
        title="Revert to in progress and keep editing"
        className={cn(
          'inline-flex items-center gap-[7px] rounded-sm border border-teal bg-teal px-4 py-[9px] text-[14px] font-semibold text-white hover:bg-[#1a6a5d] disabled:cursor-not-allowed disabled:opacity-60',
          submitting && 'opacity-80',
        )}
      >
        {submitting ? (
          <Spinner size={15} />
        ) : (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12l4 4 10-11" />
          </svg>
        )}
        {submitting ? 'Reverting…' : 'Submitted · click to keep editing'}
      </button>
    );
  }

  // in_progress / needs_review
  return (
    <button
      type="button"
      onClick={onSubmit}
      disabled={submitting || !canSubmit}
      aria-busy={submitting || undefined}
      title={!canSubmit ? 'Add a SMARTT objective first' : undefined}
      className={cn(
        'inline-flex items-center gap-[7px] rounded-sm border border-teal bg-teal px-4 py-[9px] text-[14px] font-semibold text-white hover:bg-[#1a6a5d] disabled:cursor-not-allowed disabled:opacity-60',
        submitting && 'opacity-80',
      )}
    >
      {submitting ? (
        <Spinner size={15} />
      ) : (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
        </svg>
      )}
      {submitting ? 'Submitting…' : 'Submit for approval'}
    </button>
  );
}

export function EditorHeader({
  classContext,
  curriculum,
  lessonDate,
  saveState,
  status,
  canSubmit,
  submitting,
  onSubmit,
  onUnsubmit,
}: EditorHeaderProps) {
  return (
    <div className="px-[22px] pt-[22px]">
      <div className="flex flex-wrap items-start justify-between gap-5">
        {/* Curriculum context only — never the objective */}
        <div>
          <div className="flex items-center gap-[10px] text-[19px] font-semibold">
            Year {classContext.year} · Group {classContext.groupLabel}
            {classContext.subjectName ? (
              <span className="rounded-badge bg-cream px-[9px] py-[3px] text-[13px] font-medium text-neutral-700">
                {classContext.subjectName}
              </span>
            ) : null}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[13.5px] text-neutral-600">
            <span>{formatDate(lessonDate)}</span>
            <span className="text-neutral-300">·</span>
            <span>{classContext.schoolName}</span>
            {curriculum?.focusArea ? (
              <>
                <span className="text-neutral-300">·</span>
                <span className="rounded-badge bg-status-submitted-bg px-2 py-0.5 font-semibold text-teal">
                  {curriculum.focusArea}
                </span>
              </>
            ) : null}
            {curriculum?.theme ? (
              <span className="rounded-badge bg-status-progress-bg px-2 py-0.5 font-semibold text-status-progress">
                {curriculum.theme}
              </span>
            ) : null}
          </div>
          {curriculum?.dailyLO ? (
            <div className="mt-1.5 max-w-[680px] text-[12.5px] text-neutral-400">
              <span className="font-semibold text-neutral-500">Curriculum outcome:</span>{' '}
              {curriculum.dailyLO}
            </div>
          ) : null}
        </div>

        {/* Status / save + actions */}
        <div className="flex flex-wrap items-center gap-[10px]">
          <SaveIndicator state={saveState} />
          <button
            type="button"
            disabled
            title="Word export — coming in a later slice"
            className="inline-flex items-center gap-[7px] rounded-sm border border-border-strong bg-surface px-[14px] py-[9px] text-[14px] font-medium text-ink opacity-60"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="5" y="3" width="14" height="18" rx="2" />
              <path d="M9 8h6M9 12h6M9 16h3" />
            </svg>
            Export to Word
          </button>
          <SubmitControl
            status={status}
            canSubmit={canSubmit}
            submitting={submitting}
            onSubmit={onSubmit}
            onUnsubmit={onUnsubmit}
          />
        </div>
      </div>
    </div>
  );
}

'use client';

// The draft-lesson picker for the standalone Resources tab's "Add to a lesson".
// The teacher isn't inside the editor here, so they choose which of their
// in-progress draft lessons to append the resource to. Lessons are listed
// most-recently-edited first; an empty state shows when the teacher has no drafts.
// The conversion + append is delegated to the caller via `onPick` (which reports
// success/failure), so this component stays presentational.

import { useEffect, useState } from 'react';
import { listDraftLessonsAction, type DraftLessonSummary } from '@/lib/actions/lesson-drafts';
import { XIcon } from '@/components/resources/icons';

const SCOPE_LABEL: Record<DraftLessonSummary['scope'], string> = {
  class: 'Class',
  centre: 'Centre',
  org: 'All centres',
};

function relativeTime(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(iso).toLocaleDateString();
}

export function LessonPickerModal({
  resourceTitle,
  onClose,
  onPick,
}: {
  resourceTitle: string;
  onClose: () => void;
  /** Append the resource to the chosen draft; returns whether it succeeded. */
  onPick: (lesson: DraftLessonSummary) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [lessons, setLessons] = useState<DraftLessonSummary[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    listDraftLessonsAction()
      .then((rows) => {
        if (active) setLessons(rows);
      })
      .catch(() => {
        if (active) setLessons([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const pick = async (lesson: DraftLessonSummary) => {
    if (busyId) return;
    setError(null);
    setBusyId(lesson.id);
    const res = await onPick(lesson);
    if (!res.ok) {
      setError(res.error ?? 'Could not add the resource to that lesson.');
      setBusyId(null);
    }
    // On success the caller closes this modal.
  };

  return (
    <div
      onClick={busyId ? undefined : onClose}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[rgba(42,36,34,0.5)] p-7"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Add to a lesson"
        className="flex max-h-[80vh] w-[460px] max-w-full flex-col overflow-hidden rounded-[16px] bg-surface shadow-card"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#EFE8DD] px-[20px] py-4">
          <div>
            <div className="text-[15px] font-semibold text-ink">Add to a lesson</div>
            <div className="mt-0.5 text-[12.5px] text-text-muted">
              Adds “{resourceTitle}” to a draft lesson as an editable block.
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={!!busyId}
            aria-label="Close"
            className="inline-flex size-[28px] shrink-0 items-center justify-center rounded-[8px] bg-surface-subtle text-neutral-700 disabled:opacity-50"
          >
            <XIcon size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-auto px-[20px] py-3">
          {lessons === null ? (
            <div className="py-12 text-center text-[13px] text-text-faint">Loading your drafts…</div>
          ) : lessons.length === 0 ? (
            <div className="rounded-[12px] border border-dashed border-border-strong py-12 text-center">
              <div className="text-[13.5px] font-semibold text-neutral-800">No draft lessons yet</div>
              <div className="mt-1 text-[12px] text-text-faint">
                Start a lesson plan, then add resources to it from here.
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {lessons.map((l) => {
                const isBusy = busyId === l.id;
                return (
                  <button
                    key={l.id}
                    type="button"
                    disabled={!!busyId}
                    onClick={() => pick(l)}
                    className="flex items-center gap-3 rounded-[11px] border border-border bg-surface px-[13px] py-[11px] text-left hover:border-teal hover:bg-surface-subtle disabled:opacity-60"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[13.5px] font-semibold text-ink">{l.title}</span>
                        <span className="rounded-[5px] bg-[#E4F0ED] px-[6px] py-[1px] text-[10px] font-semibold text-[#186155]">
                          {SCOPE_LABEL[l.scope]}
                        </span>
                      </div>
                      <div className="mt-0.5 truncate text-[12px] text-text-muted">{l.subtitle}</div>
                      <div className="mt-0.5 text-[11px] text-text-faint">
                        Edited {relativeTime(l.updatedAt)}
                      </div>
                    </div>
                    <span className="shrink-0 text-[12px] font-semibold text-teal">
                      {isBusy ? 'Adding…' : 'Add'}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {error ? (
            <div className="mt-3 rounded-[9px] bg-[#FBEFF3] px-3 py-2 text-[12px] font-medium text-[#B62A5C]">
              {error}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

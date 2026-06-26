'use client';

// Teacher-facing, READ-ONLY reveal of the coordinator's review comments, mounted at
// the top of the author's own lesson editor (`/plan/[id]`). This closes the
// return-for-changes loop: the teacher who wrote the plan can finally read the
// comments a coordinator left when returning it.
//
// Scope (deliberate): read-only. No composer, no reply, no read/unread state — those
// are a later slice. The thread itself (header + comment cards) is the shared
// `CommentThread`, identical to the coordinator sidebar's. This component only adds
// the editor-top chrome around it: a neutral notice header that expands/collapses the
// thread, plus a "Changes requested" call-out when the plan was returned.
//
// Source of truth is `plan_comments` (loaded via getPlanComments, now RLS-readable by
// the author) — NOT `review_note`, which is the bell notification's concern.
//
// Colour: this is an attention/notice element, so it uses the system's NEUTRAL
// treatment (surface-subtle + neutral borders / status-idle), never the reserved
// carriers (cream = curriculum, pink = editable, teal = tools/actions).

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { CommentThread } from '@/components/review/CommentThread';
import type { PlanComment } from '@/lib/review/comments';
import type { PlanStatus } from '@/types/lesson';

export function TeacherCommentsNotice({
  status,
  comments,
}: {
  status: PlanStatus;
  comments: PlanComment[];
}) {
  const t = useTranslations('review');

  // Nothing to reveal → render nothing (covers drafts and any plan with no comments).
  if (comments.length === 0) return null;

  const changesRequested = status === 'needs_review';
  // Default open when the teacher arrived to act on a return; openable otherwise.
  const [open, setOpen] = useState(changesRequested);

  // "Changes requested" only when actually returned; otherwise a neutral
  // "Coordinator notes" label (e.g. an approved plan that still carries comments) —
  // never show "Changes requested" on an approved plan.
  const label = changesRequested ? t('teacherNotice.changesRequested') : t('teacherNotice.notes');
  const summary = changesRequested ? t('teacherNotice.changesBody') : t('teacherNotice.notesBody');

  return (
    <div className="mb-[18px] overflow-hidden rounded-[14px] border border-status-idle-border bg-status-idle-bg">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-start gap-[12px] px-[18px] py-[14px] text-start transition-colors hover:bg-status-idle-bg/70"
      >
        <span
          aria-hidden
          className="mt-[1px] flex h-[24px] w-[24px] flex-shrink-0 items-center justify-center rounded-full bg-surface text-text-muted"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-semibold text-ink">{label}</span>
          <span className="mt-[2px] block text-[12.5px] leading-[1.45] text-text-muted">{summary}</span>
        </span>
        <span className="ml-[8px] mt-[2px] flex-shrink-0 text-[12px] font-semibold text-text-muted">
          {open ? t('teacherNotice.hide') : t('teacherNotice.show')}
        </span>
      </button>

      {open ? (
        <div className="border-t border-status-idle-border bg-surface">
          <CommentThread
            comments={comments}
            title={t('comments.title')}
            chipLabel={t('comments.coordinatorChip')}
          />
        </div>
      ) : null}
    </div>
  );
}

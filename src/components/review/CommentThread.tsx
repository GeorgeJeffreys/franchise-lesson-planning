// Presentational comment thread shared by the coordinator review sidebar and the
// teacher-facing read-only panel. It owns the header (title + count badge) and the
// chronological list of comment cards (oldest → newest) — and NOTHING ELSE: no
// composer, no decision footer, no modal. Those belong to the coordinator sidebar,
// which wraps this. The teacher panel reuses this same thread read-only.
//
// i18n: chrome strings (title, chip, empty state) are passed in by the caller so
// each surface owns its own catalog keys; the count renders through `formatNumber`.
// Comment bodies are free-text content islands → `dir="auto"`.

import { useLocale } from 'next-intl';
import { APP_TIME_ZONE, formatDate, formatNumber } from '@/lib/format';
import { initialsOf } from '@/components/weekly-overview/avatar';
import type { PlanComment } from '@/lib/review/comments';

export function CommentThread({
  comments,
  title,
  chipLabel,
  empty,
}: {
  comments: PlanComment[];
  /** Header title, e.g. "Coordinator comments". */
  title: string;
  /** Per-comment author chip, e.g. "Coordinator". */
  chipLabel: string;
  /** Empty-state copy. Omit to render nothing when there are no comments. */
  empty?: { title: string; body: string };
}) {
  const locale = useLocale();
  const hasComments = comments.length > 0;

  if (!hasComments && !empty) return null;

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-border px-[18px] py-[14px]">
        <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
        <span className="inline-flex min-w-[22px] items-center justify-center rounded-badge bg-surface-subtle px-[8px] py-[2px] text-[12px] font-bold text-text-muted">
          {formatNumber(comments.length, locale)}
        </span>
      </div>

      {/* Thread */}
      <div className="min-h-0 flex-1 overflow-y-auto px-[18px] py-[16px]">
        {hasComments ? (
          <ul className="flex flex-col gap-[14px]">
            {comments.map((c) => (
              <CommentCard key={c.id} comment={c} chipLabel={chipLabel} locale={locale} />
            ))}
          </ul>
        ) : empty ? (
          <div className="py-[18px] text-center">
            <p className="text-[13.5px] font-semibold text-ink">{empty.title}</p>
            <p className="mx-auto mt-[5px] max-w-[260px] text-[12.5px] leading-[1.5] text-text-muted">
              {empty.body}
            </p>
          </div>
        ) : null}
      </div>
    </>
  );
}

/** One comment: pink avatar, author name, "Coordinator" chip, timestamp, dir="auto" body. */
export function CommentCard({
  comment,
  chipLabel,
  locale,
}: {
  comment: PlanComment;
  chipLabel: string;
  locale: string;
}) {
  const name = comment.authorName || chipLabel;
  return (
    <li className="flex gap-[10px]">
      <span
        aria-hidden
        className="mt-[1px] flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-full text-[11.5px] font-bold"
        style={{ background: '#FBEFF3', color: '#B62A5C' }}
      >
        {initialsOf(name)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-[8px] gap-y-[2px]">
          <span dir="auto" className="text-[13px] font-semibold text-ink">{name}</span>
          <span className="rounded-badge bg-[#FBEFF3] px-[7px] py-[1px] text-[10px] font-bold uppercase tracking-[0.04em] text-[#B62A5C]">
            {chipLabel}
          </span>
        </div>
        <div className="mt-[1px] text-[11px] text-text-faint">
          {formatDate(comment.createdAt, locale, {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            timeZone: APP_TIME_ZONE,
          })}
        </div>
        <p dir="auto" className="mt-[5px] whitespace-pre-wrap text-[13px] leading-[1.5] text-neutral-800">
          {comment.body}
        </p>
      </div>
    </li>
  );
}

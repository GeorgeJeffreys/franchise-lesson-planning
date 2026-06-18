'use client';

import { useState } from 'react';
import type { ActivityBankItem, ClassLiteracy } from '@/lib/editor/load-plan';

interface ActivityCardProps {
  activity: ActivityBankItem;
  literacy: ClassLiteracy;
  added: boolean;
  onAdd: () => void;
}

/** A literacy-variant instruction tile (literate vs illiterate). */
function VariantTile({
  kind,
  text,
}: {
  kind: 'literate' | 'illiterate';
  text: string;
}) {
  const literate = kind === 'literate';
  return (
    <div
      className={
        literate
          ? 'rounded-sm border border-status-submitted-border bg-status-submitted-bg/60 px-[10px] py-2'
          : 'rounded-sm border border-status-review-border bg-status-review-bg/50 px-[10px] py-2'
      }
    >
      <div
        className={
          literate
            ? 'text-[11px] font-semibold text-teal'
            : 'text-[11px] font-semibold text-pink'
        }
      >
        {literate ? 'Literate · writing' : 'Illiterate · no writing'}
      </div>
      <div className="mt-0.5 text-[12px] text-neutral-900">{text}</div>
    </div>
  );
}

/**
 * One pre-approved activity. The "?" expands it to reveal the literate /
 * illiterate instruction variants, surfaced per the class's literacy (both for
 * 'mixed'). "Add" sets the block's activity; an added card shows a ✓ badge.
 */
export function ActivityCard({ activity, literacy, added, onAdd }: ActivityCardProps) {
  const [open, setOpen] = useState(false);

  const showLiterate = literacy === 'literate' || literacy === 'mixed';
  const showIlliterate = literacy === 'illiterate' || literacy === 'mixed';

  return (
    <div className="rounded-md border border-border bg-surface px-[13px] py-3">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <div className="text-[14.5px] font-semibold">{activity.name}</div>
          {activity.summary ? (
            <div className="mt-0.5 text-[12.5px] text-neutral-700">{activity.summary}</div>
          ) : null}
        </div>
        <div className="inline-flex items-center gap-[7px]">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            title="More detail"
            aria-expanded={open}
            className="size-[26px] rounded-full border border-border-strong bg-surface-subtle text-[13px] font-bold text-neutral-600 hover:bg-surface"
          >
            ?
          </button>
          {added ? (
            <span className="inline-flex items-center gap-[5px] rounded-sm border border-status-approved-border bg-status-approved-bg px-[10px] py-[5px] text-[12px] font-semibold text-status-approved">
              ✓ Added
            </span>
          ) : (
            <button
              type="button"
              onClick={onAdd}
              className="rounded-sm bg-teal px-3 py-[6px] text-[12.5px] font-semibold text-white hover:bg-[#1a6a5d]"
            >
              + Add
            </button>
          )}
        </div>
      </div>

      {open ? (
        <div className="mt-[10px] flex flex-col gap-[7px] border-t border-border pt-[10px]">
          <div className="grid grid-cols-1 gap-[9px] sm:grid-cols-2">
            {showLiterate ? (
              <VariantTile kind="literate" text={activity.literate_instructions ?? '—'} />
            ) : null}
            {showIlliterate ? (
              <VariantTile kind="illiterate" text={activity.illiterate_instructions ?? '—'} />
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

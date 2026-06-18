'use client';

import { useState } from 'react';
import type { Block, TeachingPhase } from '@/types/lesson';
import type { ActivityBankItem, ClassLiteracy } from '@/lib/editor/load-plan';
import { BLOCK_GUIDANCE } from '@/lib/block-guidance';
import { PHASE_OPTIONS, parsePhase } from '@/lib/editor/phase';
import { ActivityCard } from '@/components/editor/ActivityCard';
import { FieldLabel, Select, Textarea } from '@/components/editor/fields';

interface BlockPanelProps {
  block: Block;
  /** Pre-approved activities for this block type, if any. */
  activities: ActivityBankItem[];
  literacy: ClassLiteracy;
  onChange: (patch: Partial<Block>) => void;
}

/** Build the students-do prefill text for the class's literacy. */
function studentsDoFor(activity: ActivityBankItem, literacy: ClassLiteracy): string {
  const lit = activity.literate_instructions ?? '';
  const ill = activity.illiterate_instructions ?? '';
  if (literacy === 'literate') return lit;
  if (literacy === 'illiterate') return ill;
  // mixed — surface both.
  return [lit && `Literate: ${lit}`, ill && `Illiterate: ${ill}`].filter(Boolean).join('\n');
}

export function BlockPanel({ block, activities, literacy, onChange }: BlockPanelProps) {
  const [guidanceOpen, setGuidanceOpen] = useState(false);
  const guidance = BLOCK_GUIDANCE[block.type];

  const hasBank = activities.length > 0;
  const hasActivity = !!block.activity_ref || block.activity_title.trim().length > 0;
  // Editing fields show once an activity is added, or for any block with no bank.
  const showFields = hasActivity || !hasBank;

  function addActivity(activity: ActivityBankItem) {
    onChange({
      activity_ref: activity.id,
      activity_title: activity.name,
      teacher_does: activity.summary ?? block.teacher_does,
      students_do: studentsDoFor(activity, literacy) || block.students_do,
    });
  }

  function changeDuration(delta: number) {
    onChange({ duration_minutes: Math.max(0, block.duration_minutes + delta) });
  }

  return (
    <div className="p-[22px]">
      {/* Title row: name + ? + phase, with the duration stepper on the right */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-[9px]">
            <span className="text-[21px] font-semibold">{block.title}</span>
            <button
              type="button"
              onClick={() => setGuidanceOpen((v) => !v)}
              title="Teaching guidance"
              aria-expanded={guidanceOpen}
              className="inline-flex size-6 items-center justify-center rounded-full border border-status-submitted-border bg-status-submitted-bg text-[13px] font-bold text-teal"
            >
              ?
            </button>
          </div>
          <div className="mt-[9px]">
            <Select
              aria-label="Teaching phase"
              value={block.phase ?? ''}
              onChange={(e) => onChange({ phase: parsePhase(e.target.value) as TeachingPhase | null })}
            >
              {PHASE_OPTIONS.map((o) => (
                <option key={o.label} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="inline-flex items-center gap-2 pt-1">
          <span className="text-[12px] text-neutral-600">Duration</span>
          <div className="inline-flex items-center overflow-hidden rounded-sm border border-border-strong bg-surface">
            <button
              type="button"
              onClick={() => changeDuration(-1)}
              aria-label="Decrease duration"
              className="h-7 w-[26px] border-r border-border bg-surface-subtle text-[15px] text-neutral-600 hover:bg-surface"
            >
              −
            </button>
            <span className="px-[11px] text-[13px] font-semibold">{block.duration_minutes} min</span>
            <button
              type="button"
              onClick={() => changeDuration(1)}
              aria-label="Increase duration"
              className="h-7 w-[26px] border-l border-border bg-surface-subtle text-[15px] text-neutral-600 hover:bg-surface"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Teaching guidance (behind the ?) */}
      {guidanceOpen ? (
        <div className="mt-[14px] rounded-md border border-status-submitted-border bg-status-submitted-bg px-4 py-[15px]">
          <div className="mb-[11px] flex items-center justify-between">
            <span className="text-[12px] font-bold uppercase tracking-[0.06em] text-[#186155]">
              Teaching guidance
            </span>
            <button
              type="button"
              onClick={() => setGuidanceOpen(false)}
              className="text-[12px] text-teal"
            >
              Hide ✕
            </button>
          </div>
          <div className="grid grid-cols-1 gap-[13px] sm:grid-cols-2">
            <div>
              <div className="text-[11.5px] font-semibold text-teal">Purpose</div>
              <div className="mt-0.5 text-[13px] leading-[1.5] text-[#2A4A44]">{guidance.purpose}</div>
            </div>
            {guidance.success ? (
              <div>
                <div className="text-[11.5px] font-semibold text-teal">Success looks like</div>
                <div className="mt-0.5 text-[13px] leading-[1.5] text-[#2A4A44]">{guidance.success}</div>
              </div>
            ) : null}
            {guidance.technique ? (
              <div className="sm:col-span-2">
                <div className="text-[11.5px] font-semibold text-teal">Technique</div>
                <div className="mt-0.5 text-[13px] leading-[1.5] text-[#2A4A44]">{guidance.technique}</div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Activities-first: pre-approved activity cards */}
      {hasBank ? (
        <div className="mt-[18px]">
          <div className="mb-[11px] text-[12px] font-bold uppercase tracking-[0.06em] text-neutral-700">
            Pre-approved activities{' '}
            <span className="font-medium normal-case tracking-normal text-neutral-400">
              — add one to begin
            </span>
          </div>
          <div className="flex flex-col gap-[10px]">
            {activities.map((a) => (
              <ActivityCard
                key={a.id}
                activity={a}
                literacy={literacy}
                added={block.activity_ref === a.id}
                onAdd={() => addActivity(a)}
              />
            ))}
          </div>
        </div>
      ) : null}

      {/* Editing fields — revealed once an activity is added, or for bank-less blocks */}
      {showFields ? (
        <div className="mt-[18px] border-t border-border pt-[18px]">
          {hasActivity ? (
            <div className="mb-[13px] flex items-center gap-[9px]">
              <span className="text-[12px] font-bold uppercase tracking-[0.06em] text-[#186155]">
                Now editing
              </span>
              {block.activity_title ? (
                <span className="rounded-sm border border-status-submitted-border bg-status-submitted-bg px-[10px] py-[3px] text-[13px] font-semibold text-teal">
                  {block.activity_title}
                </span>
              ) : null}
            </div>
          ) : null}
          <div className="grid grid-cols-1 gap-[14px] sm:grid-cols-2">
            <div>
              <FieldLabel>What the teacher does</FieldLabel>
              <Textarea
                rows={3}
                className="mt-1.5"
                value={block.teacher_does}
                onChange={(e) => onChange({ teacher_does: e.target.value })}
              />
            </div>
            <div>
              <FieldLabel>What students do</FieldLabel>
              <Textarea
                rows={3}
                className="mt-1.5"
                value={block.students_do}
                onChange={(e) => onChange({ students_do: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <FieldLabel>Resources</FieldLabel>
              <Textarea
                rows={2}
                className="mt-1.5"
                value={block.resources}
                onChange={(e) => onChange({ resources: e.target.value })}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-[18px] rounded-md border border-dashed border-border-strong bg-surface-subtle p-[18px] text-center text-[13px] text-neutral-400">
          Add a pre-approved activity above to open the writing space —{' '}
          <b className="text-neutral-600">Teacher does</b>,{' '}
          <b className="text-neutral-600">Students do</b> and{' '}
          <b className="text-neutral-600">Resources</b>.
        </div>
      )}
    </div>
  );
}

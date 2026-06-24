'use client';

// Step 3 (Practise) body. Unlike the two-pane "Teach it" step, Practise is a
// single full-width card: the block header (phase + minutes), the two pink-
// editable teacher/student textareas, and below them the full student-worksheet
// builder (toolbar + inline A4 canvas). The resource bank is reached through the
// builder's modal (not an embedded side panel), matching the mockup.

import type { Block, TeachingPhase, Worksheet } from '@/types/lesson';
import type { TagsByDimension } from '@/types/resource';
import { blockMinutes } from '@/lib/blocks';
import { PhaseSelect } from '@/components/editor/PhaseSelect';
import { TimeStepper } from '@/components/editor/TimeStepper';
import { FieldLabel, Textarea } from '@/components/editor/fields';
import { WorksheetBuilder } from '@/components/editor/worksheet/WorksheetBuilder';
import type { WorksheetContext } from '@/components/editor/worksheet/context';

export function PractiseStep({
  block,
  onPatch,
  worksheet,
  onWorksheetChange,
  context,
  vocabulary,
}: {
  block: Block;
  onPatch: (patch: Partial<Block>) => void;
  worksheet: unknown;
  onWorksheetChange: (worksheet: Worksheet) => void;
  context: WorksheetContext;
  vocabulary: TagsByDimension;
}) {
  return (
    <div className="mt-[22px] overflow-hidden rounded-[16px] border border-border bg-surface">
      {/* Block header */}
      <div className="flex flex-wrap items-center gap-[14px] border-b border-[#EFE8DD] px-6 py-[18px]">
        <span className="text-[20px] font-semibold">Practise</span>
        <PhaseSelect
          value={block.phase}
          onChange={(phase) => onPatch({ phase: phase as TeachingPhase | null })}
        />
        <div className="ml-auto">
          <TimeStepper label="min" value={blockMinutes(block)} onChange={(next) => onPatch({ minutes: next })} />
        </div>
      </div>

      {/* Teacher / student writing (pink-editable) */}
      <div className="grid grid-cols-1 gap-[14px] border-b border-[#EFE8DD] px-6 py-[18px] md:grid-cols-2">
        <div>
          <FieldLabel>What the teacher does</FieldLabel>
          <Textarea
            rows={2}
            value={block.teacher_does}
            onChange={(e) => onPatch({ teacher_does: e.target.value })}
            placeholder="Model the task, narrate your thinking, set the success criteria…"
            className="mt-1.5"
          />
        </div>
        <div>
          <FieldLabel>What students do</FieldLabel>
          <Textarea
            rows={2}
            value={block.students_do}
            onChange={(e) => onPatch({ students_do: e.target.value })}
            placeholder="What the class is doing — reading, answering, working in pairs…"
            className="mt-1.5"
          />
        </div>
      </div>

      {/* Worksheet builder (toolbar + inline A4 canvas) */}
      <WorksheetBuilder
        value={worksheet}
        onChange={onWorksheetChange}
        context={context}
        vocabulary={vocabulary}
      />
    </div>
  );
}

'use client';

// The inline scope chooser behind the board's two creation affordances:
//   • openChooser  — a "Not started" card or a "+ make your own" link: the lesson
//     is fixed, the teacher only picks a scope.
//   • openAdd      — a day column's "+ Add lesson": the teacher picks one of the
//     week's curriculum lessons for that year, then a scope.
// Both create a correctly-scoped in_progress plan placed on the chosen day
// (`weekday` + the next `period` in that day) and route into the 5-step wizard.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/cn';
import { createScopedPlan } from '@/lib/actions/create-lesson';
import type { BoardClass, BoardLesson } from '@/types/weekly-overview';
import type { PlanScope } from '@/types/lesson';

/** A fixed curriculum lesson to plan, with the day placement to write. */
export interface ScopeTarget {
  lessonKey: string;
  year: number;
  dailyOutcome: string;
  /** The Mon–Fri column (1..5) to place the new plan on. */
  weekday: number;
  /** The day-ordinal position to write (next in that day's stack). */
  period: number;
}

/** A day column the teacher is adding a lesson to — lesson chosen in the dialog. */
export interface AddTarget {
  year: number;
  /** The Mon–Fri column (1..5) the "+ Add lesson" was pressed on. */
  weekday: number;
  /** The next day-ordinal position in that column. */
  period: number;
  /** The week's curriculum lessons for this year not already on the board. */
  lessons: BoardLesson[];
}

interface ScopeChooserApi {
  /** Open the scope chooser for a fixed curriculum lesson. */
  openChooser: (target: ScopeTarget) => void;
  /** Open the "+ Add lesson" picker for a day column. */
  openAdd: (target: AddTarget) => void;
}

const ScopeChooserContext = createContext<ScopeChooserApi | null>(null);

export function useScopeChooser(): ScopeChooserApi {
  const ctx = useContext(ScopeChooserContext);
  if (!ctx) throw new Error('useScopeChooser must be used within ScopeChooserProvider');
  return ctx;
}

export function ScopeChooserProvider({
  subjectName,
  myClassesByYear,
  children,
}: {
  subjectName: string;
  myClassesByYear: Record<number, BoardClass[]>;
  children: ReactNode;
}) {
  const [target, setTarget] = useState<ScopeTarget | null>(null);
  const [addTarget, setAddTarget] = useState<AddTarget | null>(null);
  const openChooser = useCallback((next: ScopeTarget) => {
    setAddTarget(null);
    setTarget(next);
  }, []);
  const openAdd = useCallback((next: AddTarget) => {
    setTarget(null);
    setAddTarget(next);
  }, []);
  const closeChooser = useCallback(() => setTarget(null), []);
  const closeAdd = useCallback(() => setAddTarget(null), []);

  return (
    <ScopeChooserContext.Provider value={{ openChooser, openAdd }}>
      {children}
      {target ? (
        <ScopeChooserDialog
          target={target}
          subjectName={subjectName}
          classes={myClassesByYear[target.year] ?? []}
          onClose={closeChooser}
        />
      ) : null}
      {addTarget ? (
        <AddLessonDialog
          target={addTarget}
          subjectName={subjectName}
          classes={myClassesByYear[addTarget.year] ?? []}
          onClose={closeAdd}
        />
      ) : null}
    </ScopeChooserContext.Provider>
  );
}

/** Close on Escape — shared by both dialogs. */
function useEscape(onClose: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
}

/** The shared modal frame (backdrop + click-away). */
function Modal({
  label,
  onClose,
  children,
}: {
  label: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(42,36,34,0.55)' }}
    >
      <div className="w-full max-w-[400px] overflow-hidden rounded-[16px] bg-surface shadow-[0_26px_60px_-22px_rgba(0,0,0,0.55)]">
        {children}
      </div>
    </div>
  );
}

/** The "Plan this lesson for…" footer with Cancel + the confirm button. */
function DialogFooter({
  label,
  busy,
  onCancel,
  onConfirm,
}: {
  label: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="mt-[16px] flex items-center justify-between border-t border-[#F0EAE1] px-[20px] py-[14px]">
      <button
        type="button"
        onClick={onCancel}
        className="text-[13px] font-medium text-neutral-700 transition-colors hover:text-ink"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={onConfirm}
        disabled={busy}
        className="inline-flex items-center gap-[7px] rounded-[10px] bg-teal px-[17px] py-[10px] text-[13.5px] font-semibold text-white shadow-[0_4px_12px_-4px_rgba(31,122,108,0.5)] transition-colors hover:bg-teal-deep disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? 'Starting…' : label}
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </button>
    </div>
  );
}

/** The reusable scope picker — My class (+ class sub-list) / centre / org. */
function ScopePicker({
  scope,
  setScope,
  classId,
  setClassId,
  classes,
  year,
  subjectName,
}: {
  scope: PlanScope;
  setScope: (s: PlanScope) => void;
  classId: string | null;
  setClassId: (id: string) => void;
  classes: BoardClass[];
  year: number;
  subjectName: string;
}) {
  const subjectLabel = subjectName || 'subject';
  const hasClasses = classes.length > 0;
  const multiClass = classes.length > 1;

  return (
    <div className="mt-[14px] flex flex-col gap-[8px] px-[20px]">
      <ScopeOption
        selected={scope === 'class'}
        disabled={!hasClasses}
        onSelect={() => setScope('class')}
        title="My class"
        detail={
          !hasClasses
            ? 'You teach no classes in this year yet.'
            : multiClass
              ? 'Pick which class below.'
              : classes[0]?.label
        }
      />
      {scope === 'class' && multiClass ? (
        <div className="mb-[2px] ml-[30px] flex flex-col gap-[5px]">
          {classes.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setClassId(c.id)}
              className={cn(
                'rounded-[9px] border px-[11px] py-[8px] text-left text-[13px] transition-colors',
                c.id === classId
                  ? 'border-teal bg-teal-tint font-semibold text-teal-deep'
                  : 'border-border bg-surface hover:bg-surface-subtle',
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      ) : null}

      <ScopeOption
        selected={scope === 'centre'}
        onSelect={() => setScope('centre')}
        title={`My centre's Year ${year} ${subjectLabel}`}
        detail="Shared across your centre — the default."
      />
      <ScopeOption
        selected={scope === 'org'}
        onSelect={() => setScope('org')}
        title="All centres"
        detail="Shared across every centre."
      />
    </div>
  );
}

function ScopeChooserDialog({
  target,
  subjectName,
  classes,
  onClose,
}: {
  target: ScopeTarget;
  subjectName: string;
  classes: BoardClass[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [scope, setScope] = useState<PlanScope>('centre');
  const [classId, setClassId] = useState<string | null>(classes[0]?.id ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEscape(onClose);

  const start = async () => {
    if (scope === 'class' && !classId) {
      setError('Pick a class to plan for.');
      return;
    }
    setBusy(true);
    setError(null);
    const res = await createScopedPlan({
      lessonKey: target.lessonKey,
      scope,
      classId: scope === 'class' ? classId ?? undefined : undefined,
      weekday: target.weekday,
      period: target.period,
    });
    if (res.ok) {
      router.push(`/plan/${res.planId}`);
      return; // keep the dialog up through the navigation
    }
    setError(res.error);
    setBusy(false);
  };

  return (
    <Modal label="Plan this lesson" onClose={onClose}>
      <div className="px-[20px] pt-[18px]">
        <h2 className="text-[17px] font-semibold tracking-[-0.01em]">Plan this lesson for…</h2>
        {target.dailyOutcome ? (
          <p className="mt-[5px] line-clamp-2 text-[12.5px] leading-[1.45] text-text-muted">
            {target.dailyOutcome}
          </p>
        ) : null}
      </div>

      <ScopePicker
        scope={scope}
        setScope={setScope}
        classId={classId}
        setClassId={setClassId}
        classes={classes}
        year={target.year}
        subjectName={subjectName}
      />

      {error ? (
        <p className="mx-[20px] mt-[12px] rounded-[10px] bg-status-review-bg px-[12px] py-[8px] text-[12.5px] text-status-review">
          {error}
        </p>
      ) : null}

      <DialogFooter label="Start planning" busy={busy} onCancel={onClose} onConfirm={start} />
    </Modal>
  );
}

function AddLessonDialog({
  target,
  subjectName,
  classes,
  onClose,
}: {
  target: AddTarget;
  subjectName: string;
  classes: BoardClass[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [lessonKey, setLessonKey] = useState<string | null>(target.lessons[0]?.lessonKey ?? null);
  const [scope, setScope] = useState<PlanScope>('centre');
  const [classId, setClassId] = useState<string | null>(classes[0]?.id ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEscape(onClose);

  const noLessons = target.lessons.length === 0;

  const add = async () => {
    if (!lessonKey) {
      setError('Pick a lesson to plan.');
      return;
    }
    if (scope === 'class' && !classId) {
      setError('Pick a class to plan for.');
      return;
    }
    setBusy(true);
    setError(null);
    const res = await createScopedPlan({
      lessonKey,
      scope,
      classId: scope === 'class' ? classId ?? undefined : undefined,
      weekday: target.weekday,
      period: target.period,
    });
    if (res.ok) {
      router.push(`/plan/${res.planId}`);
      return;
    }
    setError(res.error);
    setBusy(false);
  };

  return (
    <Modal label="Add a lesson" onClose={onClose}>
      <div className="px-[20px] pt-[18px]">
        <h2 className="text-[17px] font-semibold tracking-[-0.01em]">Add a lesson</h2>
        <p className="mt-[5px] text-[12.5px] leading-[1.45] text-text-muted">
          Year {target.year} · {WEEKDAY_LABELS[target.weekday] ?? 'this day'}
        </p>
      </div>

      {noLessons ? (
        <p className="mx-[20px] mt-[14px] rounded-[10px] border border-border bg-surface-subtle px-[12px] py-[10px] text-[12.5px] text-text-muted">
          Every curriculum lesson for Year {target.year} this week is already on the board.
        </p>
      ) : (
        <div className="mt-[14px] max-h-[210px] overflow-y-auto px-[20px]">
          <div className="flex flex-col gap-[6px]">
            {target.lessons.map((lesson) => (
              <button
                key={lesson.lessonKey}
                type="button"
                onClick={() => setLessonKey(lesson.lessonKey)}
                className={cn(
                  'flex w-full items-start gap-[9px] rounded-[10px] border px-[12px] py-[9px] text-left transition-colors',
                  lesson.lessonKey === lessonKey
                    ? 'border-[1.5px] border-teal bg-teal-tint'
                    : 'border border-border bg-surface hover:bg-surface-subtle',
                )}
              >
                <span className="mt-[1px] flex-shrink-0 rounded-badge bg-[#F3ECE2] px-[7px] py-[2px] text-[10.5px] font-bold text-neutral-700">
                  P{lesson.period}
                </span>
                <span className="min-w-0">
                  <span className="block text-[12.5px] font-semibold leading-[1.35] text-ink">
                    {lesson.dailyOutcome || 'Untitled lesson'}
                  </span>
                  {lesson.focusArea ? (
                    <span className="mt-[1px] block text-[11px] text-text-muted">{lesson.focusArea}</span>
                  ) : null}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {!noLessons ? (
        <ScopePicker
          scope={scope}
          setScope={setScope}
          classId={classId}
          setClassId={setClassId}
          classes={classes}
          year={target.year}
          subjectName={subjectName}
        />
      ) : null}

      {error ? (
        <p className="mx-[20px] mt-[12px] rounded-[10px] bg-status-review-bg px-[12px] py-[8px] text-[12.5px] text-status-review">
          {error}
        </p>
      ) : null}

      {noLessons ? (
        <div className="mt-[16px] flex items-center justify-end border-t border-[#F0EAE1] px-[20px] py-[14px]">
          <button
            type="button"
            onClick={onClose}
            className="text-[13px] font-medium text-neutral-700 transition-colors hover:text-ink"
          >
            Close
          </button>
        </div>
      ) : (
        <DialogFooter label="Add lesson" busy={busy} onCancel={onClose} onConfirm={add} />
      )}
    </Modal>
  );
}

/** Mon–Fri labels keyed by weekday number (1..5), for the add-dialog subtitle. */
const WEEKDAY_LABELS: Record<number, string> = {
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
};

function ScopeOption({
  selected,
  disabled,
  onSelect,
  title,
  detail,
}: {
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
  title: string;
  detail?: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={cn(
        'flex w-full items-start gap-[10px] rounded-[11px] border px-[13px] py-[11px] text-left transition-colors',
        disabled
          ? 'cursor-not-allowed border-border bg-surface-subtle opacity-60'
          : selected
            ? 'border-[1.5px] border-teal bg-teal-tint'
            : 'border border-border bg-surface hover:bg-surface-subtle',
      )}
    >
      <span
        className={cn(
          'mt-[2px] flex size-[17px] flex-shrink-0 items-center justify-center rounded-full',
          selected && !disabled ? 'bg-teal' : 'border-[1.5px] border-border-strong bg-surface',
        )}
      >
        {selected && !disabled ? (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M5 12l4 4 10-11" />
          </svg>
        ) : null}
      </span>
      <span className="min-w-0">
        <span className={cn('block text-[13.5px]', selected ? 'font-bold' : 'font-semibold')}>
          {title}
        </span>
        {detail ? <span className="mt-[1px] block text-[11.5px] text-text-muted">{detail}</span> : null}
      </span>
    </button>
  );
}

'use client';

// The inline scope chooser that replaces the old "+ Lesson" picker modal. Opened
// from a "Not started" card or a "+ make your own" affordance, it asks only "Plan
// this lesson for…" (My class / My centre's Year-N <subject> / All centres), then
// creates a correctly-scoped in_progress plan and routes into the wizard.

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
import type { BoardClass } from '@/types/weekly-overview';
import type { PlanScope } from '@/types/lesson';

/** The curriculum slot a chooser is opened for. */
export interface ScopeTarget {
  lessonKey: string;
  year: number;
  dailyOutcome: string;
}

interface ScopeChooserApi {
  /** Open the scope chooser for a curriculum slot. */
  openChooser: (target: ScopeTarget) => void;
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
  const openChooser = useCallback((next: ScopeTarget) => setTarget(next), []);
  const close = useCallback(() => setTarget(null), []);

  return (
    <ScopeChooserContext.Provider value={{ openChooser }}>
      {children}
      {target ? (
        <ScopeChooserDialog
          target={target}
          subjectName={subjectName}
          classes={myClassesByYear[target.year] ?? []}
          onClose={close}
        />
      ) : null}
    </ScopeChooserContext.Provider>
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const subjectLabel = subjectName || 'subject';
  const hasClasses = classes.length > 0;
  const multiClass = classes.length > 1;

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
    });
    if (res.ok) {
      router.push(`/plan/${res.planId}`);
      return; // keep the dialog up through the navigation
    }
    setError(res.error);
    setBusy(false);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Plan this lesson"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(42,36,34,0.55)' }}
    >
      <div className="w-full max-w-[400px] overflow-hidden rounded-[16px] bg-surface shadow-[0_26px_60px_-22px_rgba(0,0,0,0.55)]">
        <div className="px-[20px] pt-[18px]">
          <h2 className="text-[17px] font-semibold tracking-[-0.01em]">Plan this lesson for…</h2>
          {target.dailyOutcome ? (
            <p className="mt-[5px] line-clamp-2 text-[12.5px] leading-[1.45] text-text-muted">
              {target.dailyOutcome}
            </p>
          ) : null}
        </div>

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
            title={`My centre's Year ${target.year} ${subjectLabel}`}
            detail="Shared across your centre — the default."
          />
          <ScopeOption
            selected={scope === 'org'}
            onSelect={() => setScope('org')}
            title="All centres"
            detail="Shared across every centre."
          />
        </div>

        {error ? (
          <p className="mx-[20px] mt-[12px] rounded-[10px] bg-status-review-bg px-[12px] py-[8px] text-[12.5px] text-status-review">
            {error}
          </p>
        ) : null}

        <div className="mt-[16px] flex items-center justify-between border-t border-[#F0EAE1] px-[20px] py-[14px]">
          <button
            type="button"
            onClick={onClose}
            className="text-[13px] font-medium text-neutral-700 transition-colors hover:text-ink"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={start}
            disabled={busy}
            className="inline-flex items-center gap-[7px] rounded-[10px] bg-teal px-[17px] py-[10px] text-[13.5px] font-semibold text-white shadow-[0_4px_12px_-4px_rgba(31,122,108,0.5)] transition-colors hover:bg-teal-deep disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? 'Starting…' : 'Start planning'}
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

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

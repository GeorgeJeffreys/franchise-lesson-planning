'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';

/** Sentinel value for the unfiltered (all year groups) default. */
export const ALL_YEARS = 'all';

/**
 * The board's year-group dropdown — narrows the board to a single taught year, or
 * "All years" (the default). Replaces the old people/owner filter. A pure view
 * filter over already-loaded data (no re-fetch); the option list is the years the
 * teacher actually teaches this week.
 */
export function YearFilter({
  years,
  value,
  onChange,
}: {
  /** The taught year groups (0–6), ascending — the dropdown's options. */
  years: number[];
  /** Current selection: `ALL_YEARS` or a year number. */
  value: number | typeof ALL_YEARS;
  onChange: (value: number | typeof ALL_YEARS) => void;
}) {
  const t = useTranslations('board');
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open]);

  const allYears = t('yearFilter.allYears');
  const label = value === ALL_YEARS ? allYears : t('card.year', { n: formatNumber(value, locale) });

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t('yearFilter.label')}
        className="inline-flex items-center gap-[7px] rounded-[9px] px-[12px] py-[8px] text-[12.5px] font-semibold text-neutral-900 transition-colors hover:bg-surface-subtle"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8A8178" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="3" y="4" width="18" height="5" rx="1.5" />
          <rect x="3" y="13" width="18" height="5" rx="1.5" />
        </svg>
        {label}
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#A79E94" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open ? (
        <div className="absolute start-0 z-30 mt-[4px] max-h-[260px] min-w-[160px] overflow-y-auto rounded-[10px] border border-border bg-surface py-[4px] shadow-card">
          <Option
            label={allYears}
            active={value === ALL_YEARS}
            onClick={() => {
              onChange(ALL_YEARS);
              setOpen(false);
            }}
          />
          {years.map((y) => (
            <Option
              key={y}
              label={t('card.year', { n: formatNumber(y, locale) })}
              active={value === y}
              onClick={() => {
                onChange(y);
                setOpen(false);
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Option({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'block w-full px-[12px] py-[7px] text-start text-[12.5px] transition-colors hover:bg-surface-subtle',
        active ? 'font-semibold text-teal-deep' : 'text-neutral-900',
      )}
    >
      {label}
    </button>
  );
}

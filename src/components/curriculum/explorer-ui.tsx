'use client';

// Shared chrome for the Logic-tree and Topics bodies: the subject / year selector
// controls (which drive `?subject=` / `?year=`, preserving the active `?tab=`), plus a
// couple of small primitives reused by both. Visual style ports the mock's pill-shaped
// dropdowns; logical-property padding keeps it RTL-clean.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { formatNumber } from '@/lib/format';
import { createScopedPlan } from '@/lib/actions/create-lesson';
import type { ExplorerTab } from './ExplorerTabs';

/** A subject option (code + display name). */
export interface SubjectOption {
  code: string;
  name: string;
}

/** Build a `/curriculum` href that pins tab + subject + year. */
export function useExplorerNav(tab: ExplorerTab, subjectCode: string, year: number) {
  const router = useRouter();
  const go = (patch: { subject?: string; year?: number }) => {
    const sp = new URLSearchParams();
    sp.set('tab', tab);
    sp.set('subject', patch.subject ?? subjectCode);
    sp.set('year', String(patch.year ?? year));
    router.push(`/curriculum?${sp.toString()}`);
  };
  return go;
}

/** A pill-shaped native select (chevron on the trailing side). */
function PillSelect({
  ariaLabel,
  value,
  onChange,
  options,
}: {
  ariaLabel: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="relative inline-flex">
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none rounded-[10px] border border-[#DDD4C8] bg-surface py-[9px] pe-[34px] ps-[13px] text-[14px] font-medium text-ink transition-colors hover:bg-surface-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/40"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        className="pointer-events-none absolute end-[12px] top-1/2 -translate-y-1/2 text-[#A79E94]"
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </div>
  );
}

/** Subject + Year selector row for the Logic-tree body. */
export function SubjectYearBar({
  tab,
  subjects,
  subjectCode,
  years,
  year,
}: {
  tab: ExplorerTab;
  subjects: SubjectOption[];
  subjectCode: string;
  years: number[];
  year: number;
}) {
  const t = useTranslations('curriculum');
  const locale = useLocale();
  const go = useExplorerNav(tab, subjectCode, year);
  return (
    <div className="flex flex-wrap items-center gap-[12px] px-[26px] pt-[20px]">
      <PillSelect
        ariaLabel={t('subjectLabel')}
        value={subjectCode}
        onChange={(code) => go({ subject: code })}
        options={subjects.map((s) => ({ value: s.code, label: s.name }))}
      />
      <PillSelect
        ariaLabel={t('yearLabel')}
        value={String(year)}
        onChange={(y) => go({ year: Number(y) })}
        options={years.map((y) => ({ value: String(y), label: t('year', { n: formatNumber(y, locale) }) }))}
      />
    </div>
  );
}

/** Subject selector + read-only year pills for the Topics body. */
export function SubjectYearPills({
  tab,
  subjects,
  subjectCode,
  years,
  year,
}: {
  tab: ExplorerTab;
  subjects: SubjectOption[];
  subjectCode: string;
  years: number[];
  year: number;
}) {
  const t = useTranslations('curriculum');
  const locale = useLocale();
  const go = useExplorerNav(tab, subjectCode, year);
  return (
    <div className="flex flex-wrap items-center gap-[12px] px-[26px] pt-[20px]">
      <PillSelect
        ariaLabel={t('subjectLabel')}
        value={subjectCode}
        onChange={(code) => go({ subject: code })}
        options={subjects.map((s) => ({ value: s.code, label: s.name }))}
      />
      {years.length > 0 ? (
        <div className="ms-auto flex flex-wrap items-center gap-[7px]">
          <span className="me-[2px] text-[11px] font-semibold uppercase tracking-[0.04em] text-[#A79E94]">
            {t('topics.yearsLabel')}
          </span>
          {years.map((y) => (
            <span
              key={y}
              className="rounded-full bg-[#5C544E] px-[10px] py-[4px] text-[12px] font-semibold text-white"
            >
              {t('year', { n: formatNumber(y, locale) })}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** A cream section label (uppercase micro-heading), reused across the bodies. */
export function MicroLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`text-[10px] font-bold uppercase tracking-[0.05em] ${className ?? ''}`}>{children}</div>
  );
}

/**
 * "Plan this lesson →" — the SHARED handoff into the existing per-teacher create flow.
 * The tree/topics surfaces are taxonomy/theme-organised but plans are calendar-keyed,
 * so we pass the selected item's `lesson_key`; `createScopedPlan` derives subject / year
 * / period from it. Membership is enforced server-side; a refusal maps to friendly copy.
 */
export function PlanLessonButton({ lessonKey, period }: { lessonKey: string; period: number | null }) {
  const t = useTranslations('curriculum');
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const plan = async () => {
    setBusy(true);
    setError(null);
    const res = await createScopedPlan({
      lessonKey,
      scope: 'centre',
      weekday: period ?? undefined,
      period: period ?? undefined,
    });
    if (res.ok) {
      router.push(`/plan/${res.planId}`);
      return;
    }
    setError(/member/i.test(res.error) ? t('focus.notMember') : t('focus.genericError'));
    setBusy(false);
  };

  return (
    <div>
      <button
        type="button"
        onClick={plan}
        disabled={busy}
        className="inline-flex w-full items-center justify-center gap-[7px] rounded-[11px] bg-teal px-[16px] py-[12px] text-[14px] font-semibold text-white transition-colors hover:bg-teal-deep disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? t('focus.planning') : t('focus.plan')}
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="rtl:-scale-x-100">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </button>
      {error ? <p className="mt-[10px] text-[12.5px] text-[#b8366b]">{error}</p> : null}
    </div>
  );
}

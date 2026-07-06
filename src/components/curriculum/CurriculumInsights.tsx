'use client';

// Curriculum → Insights (coordinator/admin, read-only). A faithful port of the Alsama
// "Curriculum health" Claude Design: a title row (subject picker) over a 2×2 grid of
// analytics cards — Hours per month · Hours per focus area · Spiralling across years ·
// Coverage & gaps.
//
// The DESIGN is ported verbatim (spacing, the teal magnitude ramp, the clay/red gap
// tones, the deepening spiral, the coverage matrix with red gap-crosses and the callout).
// The DATA is real, not the mock's Maths-shaped constants: chart 1 ← hoursPerMonth
// (calendar count), charts 2–4 ← focus_area/theme (`TopicsData`, #99's cleaned logic —
// the live per-subject signal; english falls back to a relabelled "by theme" view). Each
// card owns an empty-state so a subject lacking an analytic's data shows "not available
// yet" instead of a misleading full-looking chart. The spiral's deepening is POSITIONAL
// (Nth recurrence), never a fabricated complexity signal.

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { SubjectOption } from './explorer-ui';
import type { HoursPerMonth, TopicsData } from '@/lib/curriculum/composition';
import {
  hoursPerMonthForYear,
  hoursByFocusArea,
  topicMatrix,
  gapNotes,
  deepeningColor,
  interiorGapYears,
  rowMax,
  monthInitial,
  LOW_MONTH_MEDIAN_FRACTION,
  type MatrixView,
  type MatrixRow,
} from '@/lib/curriculum/insights';

/** Topic-segment palette for the focus-area bars (biggest topic → deepest). */
const SEGMENT_STOPS = [
  'var(--color-chart-teal-6)',
  'var(--color-chart-teal-2)',
  'var(--color-chart-teal-3)',
  'var(--color-chart-teal-4)',
  'var(--color-chart-teal-5)',
  'var(--color-chart-teal-1)',
];

export function CurriculumInsights({
  subjects,
  subjectCode,
  years,
  year,
  hoursPerMonth,
  topics,
}: {
  subjects: SubjectOption[];
  subjectCode: string;
  /** Passed by the page for API symmetry with the Explorer surfaces; the design shows the
   *  subject in the picker + app chrome, so it isn't rendered separately here. */
  subjectName?: string;
  years: number[];
  year: number;
  hoursPerMonth: HoursPerMonth[];
  topics: TopicsData;
}) {
  const t = useTranslations('insights');
  const locale = useLocale();
  const router = useRouter();

  const go = (patch: { subject?: string; year?: number }) => {
    const sp = new URLSearchParams({
      subject: patch.subject ?? subjectCode,
      year: String(patch.year ?? year),
    });
    router.push(`/curriculum/insights?${sp.toString()}`);
  };
  const yearName = (y: number) => (y === 0 ? t('prep') : t('yearShort', { n: formatNumber(y, locale) }));
  const explorerHref = `/curriculum?${new URLSearchParams({ tab: 'topics', subject: subjectCode, year: String(year) }).toString()}`;

  return (
    <div className="mx-auto max-w-[1240px] overflow-hidden rounded-[18px] border border-border bg-surface shadow-card">
      {/* Title row: "Curriculum health" · subject picker (the year lens lives on card 1). */}
      <div className="flex flex-wrap items-center gap-[12px] px-[24px] pb-[6px] pt-[16px]">
        <h1 className="m-0 text-[21px] font-semibold tracking-[-0.01em] text-ink">{t('title')}</h1>
        <span className="mx-[4px] h-[20px] w-px bg-[#E0D6C7]" aria-hidden />
        <PillSelect
          ariaLabel={t('subjectLabel')}
          value={subjectCode}
          onChange={(v) => go({ subject: v })}
          options={subjects.map((s) => ({ value: s.code, label: s.name }))}
          variant="subject"
        />
      </div>

      <div className="bg-[#FBFAF6] px-[24px] pb-[24px] pt-[14px]">
        <div className="grid grid-cols-1 gap-[16px] lg:grid-cols-2">
          <HoursPerMonthCard
            hoursPerMonth={hoursPerMonth}
            year={year}
            years={years}
            yearName={yearName}
            onYear={(y) => go({ year: y })}
          />
          <FocusAreaCard topics={topics} />
          <SpiralCard topics={topics} yearName={yearName} />
          <CoverageCard topics={topics} yearName={yearName} explorerHref={explorerHref} />
        </div>
      </div>
    </div>
  );
}

// ── Shared chrome ────────────────────────────────────────────────────────────────────

function Card({
  title,
  headerRight,
  children,
}: {
  title: string;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[15px] border border-[#ECE3D5] bg-surface p-[18px]">
      <div className="mb-[16px] flex items-center justify-between gap-[10px]">
        <span className="text-[14px] font-semibold text-ink">{title}</span>
        {headerRight}
      </div>
      {children}
    </section>
  );
}

/** The small "All years" / "Prep ▾" chip in a card header. `onSelect` makes it a real
 *  year picker (card 1); without it, it's a static "All years" label (cards 2–4). */
function LensChip({
  label,
  years,
  value,
  yearName,
  onSelect,
}: {
  label: string;
  years?: number[];
  value?: number;
  yearName?: (y: number) => string;
  onSelect?: (y: number) => void;
}) {
  if (onSelect && years && value !== undefined && yearName) {
    return (
      <span className="relative inline-flex">
        <select
          aria-label={label}
          value={String(value)}
          onChange={(e) => onSelect(Number(e.target.value))}
          className="cursor-pointer appearance-none rounded-[8px] bg-[#F1EBE1] py-[4px] pe-[26px] ps-[10px] text-[12px] font-medium text-[#5C544E] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/40"
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {yearName(y)}
            </option>
          ))}
        </select>
        <Chevron className="pointer-events-none absolute end-[9px] top-1/2 -translate-y-1/2" />
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-[6px] rounded-[8px] bg-[#F1EBE1] px-[10px] py-[4px] text-[12px] font-medium text-[#5C544E]">
      {label}
      <Chevron />
    </span>
  );
}

function EmptyState({ message }: { message: string }) {
  const t = useTranslations('insights');
  return (
    <div className="flex min-h-[150px] flex-col items-center justify-center rounded-[10px] border border-dashed border-[#E0D6C7] bg-[#FBFAF6] px-[16px] py-[26px] text-center">
      <p dir="auto" className="text-[13px] text-text-muted">{message}</p>
      <p className="mt-[6px] text-[11px] text-text-faint">{t('fillsInNote')}</p>
    </div>
  );
}

// ── 1) Hours per month ──────────────────────────────────────────────────────────────

function HoursPerMonthCard({
  hoursPerMonth,
  year,
  years,
  yearName,
  onYear,
}: {
  hoursPerMonth: HoursPerMonth[];
  year: number;
  years: number[];
  yearName: (y: number) => string;
  onYear: (y: number) => void;
}) {
  const t = useTranslations('insights');
  const locale = useLocale();
  const view = useMemo(() => hoursPerMonthForYear(hoursPerMonth, year), [hoursPerMonth, year]);
  const max = view.maxHours;

  const barColor = (low: boolean, hours: number) => {
    if (low) return 'var(--color-flag-bar)';
    if (hours >= max) return 'var(--color-chart-teal-6)';
    if (max > 0 && hours / max >= 0.8) return 'var(--color-chart-teal-3)';
    return 'var(--color-chart-teal-2)';
  };
  const labelColor = (low: boolean, hours: number) => {
    if (low) return 'var(--color-gap)';
    if (hours >= max) return 'var(--color-coverage-text)';
    return '#A79E94';
  };

  return (
    <Card
      title={t('card1.title')}
      headerRight={<LensChip label={yearName(year)} years={years} value={year} yearName={yearName} onSelect={onYear} />}
    >
      {view.bars.length === 0 ? (
        <EmptyState message={t('card1.empty')} />
      ) : (
        <>
          <div className="grid items-end gap-[8px]" style={{ gridTemplateColumns: `repeat(${view.bars.length}, 1fr)`, height: 140 }}>
            {view.bars.map((b) => (
              <div key={b.month} className="flex h-full flex-col items-center justify-end gap-[6px]">
                <span className="text-[10px]" style={{ color: labelColor(b.low, b.hours), fontWeight: b.low || b.hours >= max ? 600 : 400 }}>
                  {formatNumber(b.hours, locale)}
                </span>
                <div
                  className="w-full rounded-t-[5px]"
                  style={{
                    height: `${max > 0 ? Math.max(6, (b.hours / max) * 100) : 6}%`,
                    background: barColor(b.low, b.hours),
                    border: b.low ? '1px dashed var(--color-gap)' : undefined,
                  }}
                  title={b.low ? t('card1.flagNote', { pct: Math.round(LOW_MONTH_MEDIAN_FRACTION * 100), median: formatNumber(view.median, locale) }) : undefined}
                />
              </div>
            ))}
          </div>
          <div className="mt-[7px] grid gap-[8px]" style={{ gridTemplateColumns: `repeat(${view.bars.length}, 1fr)` }}>
            {view.bars.map((b) => (
              <span key={b.month} dir="auto" className="text-center text-[9.5px] text-[#A79E94]">
                {monthInitial(b.month)}
              </span>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

// ── 2) Hours per focus area / theme ─────────────────────────────────────────────────

function FocusAreaCard({ topics }: { topics: TopicsData }) {
  const t = useTranslations('insights');
  const locale = useLocale();
  const view = useMemo(() => hoursByFocusArea(topics), [topics]);
  const isTheme = view.groupedBy === 'theme';

  return (
    <Card
      title={isTheme ? t('card2.titleTheme') : t('card2.titleFocus')}
      headerRight={<LensChip label={t('allYears')} />}
    >
      {view.bars.length === 0 ? (
        <EmptyState message={t('card2.empty')} />
      ) : (
        <div className="flex flex-col gap-[15px]">
          {isTheme ? (
            <p dir="auto" className="-mt-[4px] text-[11px] text-text-faint">{t('card2.themeNote')}</p>
          ) : null}
          {view.bars.map((b, i) => {
            const segs = b.topics.length > 0 ? b.topics : [{ topic: b.label ?? '', hours: b.hours }];
            return (
              <div key={`${b.label ?? 'x'}-${i}`}>
                <div className="mb-[5px] flex items-baseline justify-between gap-[10px]">
                  <span dir="auto" className="min-w-0 truncate text-[13px] font-medium text-[#3A332E]">{b.label ?? t('card2.titleTheme')}</span>
                  <span className="shrink-0 whitespace-nowrap text-[12px] tabular-nums text-[#6C6259]">
                    {t('hoursShort', { n: formatNumber(b.hours, locale) })} · {formatNumber(Math.round(b.pct), locale)}%
                  </span>
                </div>
                <div className="flex h-[12px] overflow-hidden rounded-full" style={{ background: 'var(--color-chart-track)' }}>
                  <div className="flex h-full overflow-hidden" style={{ width: `${Math.max(3, b.pct)}%` }}>
                    {segs.map((s, si) => (
                      <span
                        key={`${s.topic}-${si}`}
                        title={`${s.topic} · ${formatNumber(s.hours, locale)}`}
                        style={{ width: `${b.hours > 0 ? (s.hours / b.hours) * 100 : 100}%`, background: SEGMENT_STOPS[si % SEGMENT_STOPS.length] }}
                      />
                    ))}
                  </div>
                </div>
                {b.topics.length > 0 ? (
                  <div className="mt-[8px] flex flex-wrap gap-x-[14px] gap-y-[4px]">
                    {b.topics.map((s, si) => (
                      <span key={`${s.topic}-${si}`} dir="auto" className="text-[11px] text-[#8A8178]">
                        <span className="me-[5px] inline-block size-[7px] rounded-[2px] align-middle" style={{ background: SEGMENT_STOPS[si % SEGMENT_STOPS.length] }} />
                        {s.topic} · {formatNumber(s.hours, locale)}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// ── 3) Spiralling across years ──────────────────────────────────────────────────────

function SpiralCard({ topics, yearName }: { topics: TopicsData; yearName: (y: number) => string }) {
  const t = useTranslations('insights');
  const view = useMemo(() => topicMatrix(topics), [topics]);
  const rows = useMemo(() => view.groups.flatMap((g) => g.rows), [view]);
  const cols = `172px repeat(${view.years.length}, 1fr)`;

  return (
    <Card title={t('card3.title')} headerRight={<LensChip label={t('allYears')} />}>
      {rows.length === 0 ? (
        <EmptyState message={t('card3.empty')} />
      ) : (
        <>
          <div className="overflow-x-auto">
            <div className="grid min-w-max items-center gap-[6px]" style={{ gridTemplateColumns: cols }}>
              <span />
              {view.years.map((y) => (
                <span key={y} className="text-center text-[10px] text-[#A79E94]">{yearName(y)}</span>
              ))}
              {rows.map((row, ri) => {
                const taughtYears = view.years.filter((y) => row.byYear[y] !== undefined);
                return (
                  <SpiralRow key={`${row.topic}-${ri}`} row={row} years={view.years} taughtYears={taughtYears} />
                );
              })}
            </div>
          </div>
          <div className="mt-[16px] flex flex-wrap gap-[16px]">
            <span className="inline-flex items-center gap-[6px] text-[11px] text-[#8A8178]">
              <span className="inline-flex">
                <span className="size-[9px] rounded-[2px]" style={{ background: 'var(--color-chart-teal-1)' }} />
                <span className="size-[9px] rounded-[2px]" style={{ background: 'var(--color-chart-teal-3)' }} />
                <span className="size-[9px] rounded-[2px]" style={{ background: 'var(--color-chart-teal-6)' }} />
              </span>
              {t('card3.taughtDeepening')}
            </span>
            <span className="inline-flex items-center gap-[6px] text-[11px] text-[#8A8178]">
              <span className="size-[10px] rounded-[2px] border border-dashed" style={{ background: 'var(--color-cell-dash-bg)', borderColor: 'var(--color-cell-dash-border)' }} />
              {t('card3.notTaught')}
            </span>
          </div>
        </>
      )}
    </Card>
  );
}

function SpiralRow({ row, years, taughtYears }: { row: MatrixRow; years: number[]; taughtYears: number[] }) {
  return (
    <>
      <span dir="auto" className="truncate text-[12px] text-[#3A332E] [overflow-wrap:anywhere]">{row.topic}</span>
      {years.map((y) => {
        const taught = row.byYear[y] !== undefined;
        if (!taught) {
          return (
            <span key={y} className="h-[20px] rounded-[5px] border border-dashed" style={{ background: 'var(--color-cell-dash-bg)', borderColor: 'var(--color-cell-dash-border)' }} />
          );
        }
        const occ = taughtYears.indexOf(y);
        return <span key={y} className="h-[20px] rounded-[5px]" style={{ background: deepeningColor(occ, taughtYears.length) }} />;
      })}
    </>
  );
}

// ── 4) Coverage & gaps ──────────────────────────────────────────────────────────────

function CoverageCard({
  topics,
  yearName,
  explorerHref,
}: {
  topics: TopicsData;
  yearName: (y: number) => string;
  explorerHref: string;
}) {
  const t = useTranslations('insights');
  const locale = useLocale();
  const view = useMemo(() => topicMatrix(topics), [topics]);
  const notes = useMemo(() => gapNotes(view), [view]);
  const cols = `150px repeat(${view.years.length}, 1fr)`;

  const gapText = (gapYears: number[]) =>
    gapYears.length === 1
      ? yearName(gapYears[0])
      : t('yearsRange', { from: formatNumber(gapYears[0], locale), to: formatNumber(gapYears[gapYears.length - 1], locale) });
  const primary = notes[0];

  return (
    <Card
      title={t('card4.title')}
      headerRight={
        <span className="flex items-center gap-[8px]">
          <LensChip label={t('allYears')} />
          {notes.length > 0 ? (
            <span className="text-[11.5px] font-semibold text-gap">{t('card4.gapsFlagged', { count: notes.length })}</span>
          ) : null}
        </span>
      }
    >
      {view.groups.length === 0 ? (
        <EmptyState message={t('card4.empty')} />
      ) : (
        <>
          <div className="overflow-x-auto">
            <div className="grid min-w-max items-center gap-[5px]" style={{ gridTemplateColumns: cols }}>
              <span />
              {view.years.map((y) => (
                <span key={y} className="text-center text-[10px] text-[#A79E94]">{yearName(y)}</span>
              ))}
              {view.groups.map((g, gi) => (
                <CoverageGroup key={`${g.faLabel ?? 'g'}-${gi}`} group={g} years={view.years} gapAria={t('card4.gapAria')} />
              ))}
            </div>
          </div>

          {primary ? (
            <div className="mt-[14px] flex items-center gap-[8px] rounded-[9px] border border-gap-border bg-gap-bg px-[12px] py-[9px]">
              <WarningIcon />
              <span dir="auto" className="flex-1 text-[12.5px] text-[#7A4436] [overflow-wrap:anywhere]">
                {t.rich('card4.gapNarrative', {
                  topic: primary.topic,
                  gap: gapText(primary.gapYears),
                  reappear: yearName(primary.reappear),
                  b: (chunks) => <b className="font-semibold">{chunks}</b>,
                })}
              </span>
              <Link href={explorerHref} className="whitespace-nowrap text-[12px] font-semibold text-gap" aria-label={t('openInExplorer')}>
                {t('openInExplorer')}
                <span aria-hidden> →</span>
              </Link>
            </div>
          ) : null}
        </>
      )}
    </Card>
  );
}

function CoverageGroup({ group, years, gapAria }: { group: MatrixView['groups'][number]; years: number[]; gapAria: string }) {
  const locale = useLocale();
  return (
    <>
      {group.faLabel ? (
        <span dir="auto" className="pt-[4px] text-[9.5px] font-bold uppercase tracking-[0.05em] text-[#9A7B5C]" style={{ gridColumn: '1 / -1' }}>
          {group.faLabel}
        </span>
      ) : null}
      {group.rows.map((row, ri) => {
        const gaps = interiorGapYears(row, years);
        const rMax = rowMax(row, years);
        return (
          <div key={`${row.topic}-${ri}`} className="contents">
            <span dir="auto" className="truncate text-[11.5px] text-[#3A332E] [overflow-wrap:anywhere]">{row.topic}</span>
            {years.map((y) => {
              const hours = row.byYear[y];
              if (hours !== undefined) {
                return (
                  <span
                    key={y}
                    className="flex h-[26px] items-center justify-center rounded-[5px] text-[11px] font-semibold tabular-nums"
                    style={{ background: hours >= rMax ? 'var(--color-coverage-hi)' : 'var(--color-coverage-lo)', color: 'var(--color-coverage-text)' }}
                  >
                    {formatNumber(hours, locale)}
                  </span>
                );
              }
              if (gaps.has(y)) {
                return (
                  <span key={y} className="flex h-[26px] items-center justify-center rounded-[5px] border-[1.5px] border-gap bg-gap-bg text-gap" aria-label={gapAria}>
                    <CrossIcon />
                  </span>
                );
              }
              return <span key={y} className="h-[26px] rounded-[5px]" style={{ background: 'var(--color-cell-blank)' }} />;
            })}
          </div>
        );
      })}
    </>
  );
}

// ── Small primitives ─────────────────────────────────────────────────────────────────

function PillSelect({
  ariaLabel,
  value,
  onChange,
  options,
  variant,
}: {
  ariaLabel: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  variant: 'subject';
}) {
  return (
    <span className="relative inline-flex">
      <span className="sr-only">{ariaLabel}</span>
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'cursor-pointer appearance-none rounded-[9px] border border-border-strong bg-surface py-[8px] pe-[32px] ps-[12px] text-[13.5px] font-medium text-ink transition-colors hover:bg-surface-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/40',
          variant === 'subject' && '',
        )}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <Chevron className="pointer-events-none absolute end-[11px] top-1/2 -translate-y-1/2" />
    </span>
  );
}

function Chevron({ className }: { className?: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#A79E94" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-gap)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">
      <path d="M12 9v4M12 17h.01" />
      <path d="M10.3 3.9L2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
    </svg>
  );
}

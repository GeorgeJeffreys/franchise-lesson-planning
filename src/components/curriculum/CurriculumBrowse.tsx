'use client';

// The read-only Curriculum browse screen — a single-week, "zoomed-in" view of the
// curriculum table teachers already know, filtered to one Subject → Year → Week.
//
// COLOUR SEMANTICS (locked): everything here is curriculum-provided content, so it
// reads as cream/locked. The only teal is the "Plan this lesson" CTA and the
// selected-row / focus-card accent. There are NO teacher-editable zones, so the
// editable-pink (`--color-pink` #b62a5c) never appears; the rose accents on the
// "Skills" sub-labels and the Speaking skill are a distinct categorical hue.
//
// Selecting Subject / Year / Week navigates (the server re-fetches the week);
// selecting a DAY is pure client state that re-points the focus card.

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { createScopedPlan } from '@/lib/actions/create-lesson';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/cn';
import { SKILL_PILL, SKILL_TEXT } from '@/components/curriculum/skill';
import type {
  BrowseCoordinate,
  BrowseRow,
  CurriculumBrowseData,
} from '@/types/curriculum-browse';

export function CurriculumBrowse({ data }: { data: CurriculumBrowseData }) {
  const t = useTranslations('curriculum');

  if (data.subjects.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="overflow-hidden rounded-[18px] border border-border bg-surface shadow-card">
      <Header data={data} />
      <div className="border-t border-border p-[22px]">
        <OutcomePanels data={data} />
        {data.rows.length === 0 ? (
          <p className="mt-[20px] rounded-[14px] border border-border bg-surface-subtle px-[16px] py-[24px] text-center text-[13.5px] text-text-muted">
            {t('noLessons')}
          </p>
        ) : (
          <WeekGrid data={data} />
        )}
      </div>
    </div>
  );
}

// ── Header: selectors + week nav + topic chip + read-only badge ─────────────────

function Header({ data }: { data: CurriculumBrowseData }) {
  const t = useTranslations('curriculum');
  const locale = useLocale();
  const router = useRouter();
  const { subjectCode, year, month, week } = data.selected;

  const onSubject = (code: string) =>
    router.push(`/curriculum?subject=${encodeURIComponent(code)}`);
  const onYear = (y: string) =>
    router.push(`/curriculum?subject=${encodeURIComponent(subjectCode)}&year=${y}`);

  const coordHref = (c: BrowseCoordinate) =>
    `/curriculum?subject=${encodeURIComponent(subjectCode)}&year=${year}&month=${encodeURIComponent(c.month)}&week=${c.week}`;

  return (
    <div className="flex flex-wrap items-center justify-between gap-[14px] px-[22px] py-[15px]">
      <div className="flex flex-wrap items-center gap-[12px]">
        <Selector
          ariaLabel={t('subjectLabel')}
          value={subjectCode}
          onChange={onSubject}
          options={data.subjects.map((s) => ({ value: s.code, label: s.name }))}
        />
        <Selector
          ariaLabel={t('yearLabel')}
          value={String(year)}
          onChange={onYear}
          options={data.years.map((y) => ({
            value: String(y),
            label: t('year', { n: formatNumber(y, locale) }),
          }))}
        />
        <div className="flex items-center gap-[6px]">
          <NavArrow href={data.prev ? coordHref(data.prev) : null} label={t('prevWeek')} dir="left" />
          <span className="min-w-[160px] text-center text-[15px] font-semibold tracking-[-0.01em]">
            {month
              ? t.rich('weekWithMonth', {
                  n: formatNumber(week, locale),
                  month,
                  m: (chunks) => <span className="font-normal text-neutral-600">{chunks}</span>,
                })
              : '—'}
          </span>
          <NavArrow href={data.next ? coordHref(data.next) : null} label={t('nextWeek')} dir="right" />
        </div>
        {data.topicChip ? (
          <span
            dir="auto"
            className="inline-flex items-center rounded-full border border-[#ece4d7] bg-surface-cream px-[11px] py-[4px] text-[12.5px] font-medium text-[#8a6a3a]"
          >
            {data.topicChip}
          </span>
        ) : null}
      </div>
      <span className="text-[13px] text-text-faint">{t('readOnly')}</span>
    </div>
  );
}

function Selector({
  ariaLabel,
  value,
  onChange,
  options,
}: {
  ariaLabel: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="relative">
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none rounded-[10px] border border-border bg-surface py-[8px] pe-[32px] ps-[14px] text-[14px] font-semibold text-ink transition-colors hover:bg-surface-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/40"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        className="pointer-events-none absolute end-[11px] top-1/2 -translate-y-1/2 text-neutral-500"
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </div>
  );
}

function NavArrow({
  href,
  label,
  dir,
}: {
  href: string | null;
  label: string;
  dir: 'left' | 'right';
}) {
  const arrow = (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="rtl:-scale-x-100"
    >
      {dir === 'left' ? <path d="M15 18l-6-6 6-6" /> : <path d="M9 18l6-6-6-6" />}
    </svg>
  );
  if (!href) {
    return (
      <span
        aria-disabled="true"
        aria-label={label}
        className="inline-flex size-8 cursor-not-allowed items-center justify-center rounded-[8px] border border-border bg-surface text-text-faint opacity-40"
      >
        {arrow}
      </span>
    );
  }
  return (
    <Link
      href={href}
      aria-label={label}
      className="inline-flex size-8 items-center justify-center rounded-[8px] border border-border bg-surface text-ink transition-colors hover:bg-surface-subtle"
    >
      {arrow}
    </Link>
  );
}

// ── Outcome panels (cream, locked) ──────────────────────────────────────────────

function OutcomePanels({ data }: { data: CurriculumBrowseData }) {
  const t = useTranslations('curriculum');
  const locale = useLocale();
  const { month, week } = data.selected;
  const { monthly, weekly } = data;

  // Per the agreed rule: prefer the split monthly pair when either side is
  // populated, else fall back to the single combined block.
  const monthlySplit = !!(monthly.knowledge || monthly.skills);

  return (
    <div className="grid gap-[16px] md:grid-cols-2">
      <Panel label={t('monthlyOutcome', { month: month || '—' })}>
        {monthlySplit ? (
          <OutcomeColumns knowledge={monthly.knowledge} skills={monthly.skills} />
        ) : (
          <OutcomeValue value={monthly.combined} />
        )}
      </Panel>
      <Panel label={t('weeklyOutcome', { n: formatNumber(week, locale) })}>
        <OutcomeColumns knowledge={weekly.knowledge} skills={weekly.skills} />
      </Panel>
    </div>
  );
}

function Panel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[14px] border border-[#ece4d7] bg-surface-cream p-[18px]">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#a6794f]">
        {label}
      </h2>
      <div className="mt-[12px]">{children}</div>
    </section>
  );
}

function OutcomeColumns({
  knowledge,
  skills,
}: {
  knowledge: string | null;
  skills: string | null;
}) {
  const t = useTranslations('curriculum');
  return (
    <div className="grid gap-[18px] sm:grid-cols-2">
      <div>
        {/* teal accent = "Knowledge"; categorical, not an action */}
        <p className="text-[12px] font-semibold text-teal">{t('knowledge')}</p>
        <OutcomeValue value={knowledge} className="mt-[5px]" />
      </div>
      <div>
        {/* rose accent = "Skills"; deliberately NOT the editable-pink #b62a5c */}
        <p className="text-[12px] font-semibold text-[#b8366b]">{t('skills')}</p>
        <OutcomeValue value={skills} className="mt-[5px]" />
      </div>
    </div>
  );
}

function OutcomeValue({ value, className }: { value: string | null; className?: string }) {
  const t = useTranslations('curriculum');
  if (!value) {
    return <p className={cn('text-[14px] text-text-faint', className)}>{t('empty')}</p>;
  }
  return (
    <p dir="auto" className={cn('text-[14px] leading-[1.5] text-ink', className)}>
      {value}
    </p>
  );
}

// ── Week grid: table + focus card ───────────────────────────────────────────────

function WeekGrid({ data }: { data: CurriculumBrowseData }) {
  // Default-select the first period; clicking a row re-points the focus card.
  const [selected, setSelected] = useState(0);
  const safeIndex = Math.min(selected, data.rows.length - 1);
  const focusRow = data.rows[safeIndex];

  return (
    <div className="mt-[20px] grid gap-[18px] lg:grid-cols-[minmax(0,1fr)_360px]">
      <WeekTable rows={data.rows} selected={safeIndex} onSelect={setSelected} />
      <FocusCard row={focusRow} />
    </div>
  );
}

/** A merged Topic cell, computed from contiguous same-Theme runs. */
interface TopicCell {
  theme: string;
  rowSpan: number;
  /** Day-range sublabel for runs longer than one period; null otherwise. */
  range: string | null;
}

function WeekTable({
  rows,
  selected,
  onSelect,
}: {
  rows: BrowseRow[];
  selected: number;
  onSelect: (i: number) => void;
}) {
  const t = useTranslations('curriculum');

  // Compute the topic spans once. A run of equal non-empty Theme merges into one
  // cell (rendered at the run's first row); blank Theme is its own single cell.
  const topicCells = useMemo<(TopicCell | null)[]>(() => {
    const cells: (TopicCell | null)[] = new Array(rows.length).fill(null);
    let i = 0;
    while (i < rows.length) {
      const theme = rows[i].theme;
      if (!theme) {
        cells[i] = { theme: '', rowSpan: 1, range: null };
        i += 1;
        continue;
      }
      let j = i + 1;
      while (j < rows.length && rows[j].theme === theme) j += 1;
      const len = j - i;
      const range =
        len > 1
          ? t('table.sameTopic', {
              range: `${t(`daysShort.${rows[i].weekday}`)}–${t(`daysShort.${rows[j - 1].weekday}`)}`,
            })
          : null;
      cells[i] = { theme, rowSpan: len, range };
      i = j;
    }
    return cells;
  }, [rows, t]);

  return (
    <div className="overflow-hidden rounded-[14px] border border-border">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="bg-surface-cream">
            <Th className="w-[88px]">{t('table.day')}</Th>
            <Th>{t('table.learningOutcome')}</Th>
            <Th className="w-[110px]">{t('table.skill')}</Th>
            <Th className="w-[180px]">{t('table.topic')}</Th>
            <Th className="w-[190px]">{t('table.resources')}</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const isSelected = i === selected;
            const topic = topicCells[i];
            const tint = isSelected ? 'bg-[#edf5f2]' : '';
            return (
              <tr
                key={row.lessonKey}
                onClick={() => onSelect(i)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect(i);
                  }
                }}
                tabIndex={0}
                aria-selected={isSelected}
                className="cursor-pointer border-t border-border outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal/40"
              >
                <td
                  className={cn(
                    'border-s-[3px] px-[16px] py-[14px] align-top text-[13.5px] font-semibold text-ink',
                    isSelected ? 'border-s-teal' : 'border-s-transparent',
                    tint,
                  )}
                >
                  {t(`daysShort.${row.weekday}`)}
                </td>
                <td className={cn('px-[16px] py-[14px] align-top text-[13.5px] leading-[1.45] text-ink', tint)}>
                  <span dir="auto">{row.dailyOutcome || t('empty')}</span>
                </td>
                <td className={cn('px-[16px] py-[14px] align-top text-[13px] font-medium', tint)}>
                  {row.linguisticSkill ? (
                    <span dir="auto" className={SKILL_TEXT[row.skillKey]}>
                      {row.linguisticSkill}
                    </span>
                  ) : (
                    <span className="text-text-faint">{t('empty')}</span>
                  )}
                </td>
                {topic ? (
                  <td
                    rowSpan={topic.rowSpan}
                    className="border-s border-border bg-surface-subtle px-[16px] py-[14px] align-top"
                  >
                    {topic.theme ? (
                      <>
                        <span dir="auto" className="text-[13px] font-semibold text-teal-deep">
                          {topic.theme}
                        </span>
                        {topic.range ? (
                          <span className="mt-[3px] block text-[11px] text-neutral-500">
                            {topic.range}
                          </span>
                        ) : null}
                      </>
                    ) : null}
                  </td>
                ) : null}
                <td className={cn('px-[16px] py-[14px] align-top text-[13px] text-neutral-700', tint)}>
                  {row.resources.length > 0 ? (
                    <span dir="auto">{row.resources.map((r) => r.label).join(' · ')}</span>
                  ) : (
                    <span className="text-text-faint">{t('empty')}</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        'px-[16px] py-[11px] text-[11px] font-semibold uppercase tracking-[0.04em] text-neutral-600',
        className,
      )}
    >
      {children}
    </th>
  );
}

// ── Focus card (teal-accented) ──────────────────────────────────────────────────

function FocusCard({ row }: { row: BrowseRow }) {
  const t = useTranslations('curriculum');
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const plan = async () => {
    setBusy(true);
    setError(null);
    // Membership is enforced server-side by createScopedPlan; we always render the
    // CTA and map a membership refusal to friendly copy rather than a raw error.
    const res = await createScopedPlan({
      lessonKey: row.lessonKey,
      scope: 'centre',
      weekday: row.weekday,
      period: row.period,
    });
    if (res.ok) {
      router.push(`/plan/${res.planId}`);
      return; // keep the busy state through the navigation
    }
    setError(/member/i.test(res.error) ? t('focus.notMember') : t('focus.genericError'));
    setBusy(false);
  };

  return (
    <div>
      <p className="mb-[10px] text-[11px] font-semibold uppercase tracking-[0.06em] text-neutral-500">
        {t('focus.inFocus', { day: t(`daysLong.${row.weekday}`) })}
      </p>
      <div className="rounded-[16px] border border-teal bg-surface p-[18px]">
        <div className="flex flex-wrap items-center gap-[8px]">
          {row.linguisticSkill ? (
            <span
              dir="auto"
              className={cn(
                'inline-flex items-center rounded-full border px-[10px] py-[3px] text-[12px] font-medium',
                SKILL_PILL[row.skillKey],
              )}
            >
              {row.linguisticSkill}
            </span>
          ) : null}
          {row.theme ? (
            <span
              dir="auto"
              className="inline-flex items-center rounded-full border border-[#ece4d7] bg-surface-cream px-[10px] py-[3px] text-[12px] font-medium text-[#8a6a3a]"
            >
              {row.theme}
            </span>
          ) : null}
        </div>

        <p className="mt-[14px] text-[10.5px] font-semibold uppercase tracking-[0.06em] text-neutral-500">
          {t('focus.dailyOutcome')}
        </p>
        <p dir="auto" className="mt-[6px] text-[16px] font-semibold leading-[1.35] text-ink">
          {row.dailyOutcome || t('empty')}
        </p>

        {row.resources.length > 0 ? (
          <>
            <p className="mt-[16px] text-[10.5px] font-semibold uppercase tracking-[0.06em] text-neutral-500">
              {t('focus.resources')}
            </p>
            <ul className="mt-[8px] space-y-[8px]">
              {row.resources.map((r, i) => (
                <li key={`${r.label}-${i}`} className="flex items-center gap-[9px]">
                  <ResourceIcon label={r.label} />
                  <span dir="auto" className="text-[13.5px] text-ink">
                    {r.label}
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : null}

        <button
          type="button"
          onClick={plan}
          disabled={busy}
          className="mt-[18px] inline-flex w-full items-center justify-center gap-[7px] rounded-[12px] bg-teal px-[16px] py-[12px] text-[14px] font-semibold text-white shadow-[0_4px_12px_-4px_rgba(31,122,108,0.5)] transition-colors hover:bg-teal-deep disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? t('focus.planning') : t('focus.plan')}
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#fff"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
            className="rtl:-scale-x-100"
          >
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
        {error ? (
          <p className="mt-[10px] text-[12.5px] text-[#b8366b]">{error}</p>
        ) : null}
      </div>
    </div>
  );
}

/** Small content-inferred icon for a resource line (audio / cards / document). */
function ResourceIcon({ label }: { label: string }) {
  const s = label.toLowerCase();
  const kind =
    /audio|listen|sound|song|recording/.test(s) ? 'audio'
    : /flashcard|cards?\b|card/.test(s) ? 'cards'
    : 'doc';
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="shrink-0 text-teal"
    >
      {kind === 'audio' ? (
        <>
          <path d="M11 5 6 9H2v6h4l5 4V5z" />
          <path d="M15.5 8.5a5 5 0 0 1 0 7" />
        </>
      ) : kind === 'cards' ? (
        <>
          <rect x="3" y="5" width="14" height="14" rx="2" />
          <path d="M7 5V3h14v14h-2" />
        </>
      ) : (
        <>
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
          <path d="M14 3v5h5M9 13h6M9 17h6" />
        </>
      )}
    </svg>
  );
}

// ── Empty state ─────────────────────────────────────────────────────────────────

function EmptyState() {
  const t = useTranslations('curriculum');
  return (
    <div className="rounded-[14px] border border-border bg-surface px-6 py-16 text-center">
      <p className="text-[15px] font-semibold text-ink">{t('emptyState.title')}</p>
      <p className="mx-auto mt-2 max-w-[460px] text-[13.5px] text-text-muted">
        {t('emptyState.body')}
      </p>
    </div>
  );
}

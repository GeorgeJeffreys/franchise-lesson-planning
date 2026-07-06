'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { formatNumber } from '@/lib/format';
import {
  GAP_STATUS_ORDER,
  type CurriculumGapsReport,
  type GapRow,
  type GapStatus,
} from '@/lib/curriculum/gaps';
import { DownloadIcon, RefreshIcon, SearchIcon, ChevronDownIcon, BulbIcon } from './icons';
import { buildGapsCsv, downloadCsv } from './export';

// Curriculum Gaps — per-subject reconcile explorer (ADMIN-ONLY, one subject + workbook).
//
// Faithful port of the CurriculumGaps design into the app stack: next-intl strings,
// design tokens (no inline palette), RTL-clean logical properties. Every count is
// computed from the REAL classified rows in `report` (server-classified via the shared
// six-state classifier); nothing is hardcoded. Re-validate re-runs the live
// classification; Export downloads the currently-filtered rows.

/** Tri-severity palette, entirely token-based (see globals.css). RED here is the
 *  error-surfacing `gap` rust — NOT the reserved destructive delete-red #b23a2e. */
interface StatusTone {
  dot: string; // dot fill
  tag: string; // status pill (bg + text)
  fixPanel: string; // fix panel bg + border
  fixText: string; // fix panel text
  code: string; // lesson-id chip (when a code is present)
  tint: string; // subtle row background
  stripeVar: string | null; // inline-start stripe colour (CSS var), null = no stripe
}

const ERROR_TONE: StatusTone = {
  dot: 'bg-gap',
  tag: 'bg-gap-bg text-gap',
  fixPanel: 'bg-gap-bg border-gap-border',
  fixText: 'text-gap',
  code: 'bg-gap-bg text-gap',
  tint: 'bg-gap-bg/30',
  stripeVar: 'var(--color-gap)',
};

const TONE: Record<GapStatus, StatusTone> = {
  placed: {
    dot: 'bg-teal',
    tag: 'bg-teal-tint text-teal-deep',
    fixPanel: 'bg-teal-tint border-teal-tint-border',
    fixText: 'text-teal-deep',
    code: 'bg-neutral-100 text-teal-deep',
    tint: '',
    stripeVar: null,
  },
  placeholder: {
    dot: 'bg-status-progress-dot',
    tag: 'bg-status-progress-bg text-status-progress',
    fixPanel: 'bg-status-progress-bg border-status-progress-border',
    fixText: 'text-status-progress',
    code: 'bg-status-progress-bg text-status-progress',
    tint: 'bg-status-progress-bg/30',
    stripeVar: 'var(--color-status-progress-dot)',
  },
  guard: {
    dot: 'bg-guard-dot',
    tag: 'bg-guard-bg text-guard',
    fixPanel: 'bg-guard-bg border-guard-border',
    fixText: 'text-guard',
    code: 'bg-neutral-100 text-guard',
    tint: 'bg-guard-bg/40',
    stripeVar: 'var(--color-guard-dot)',
  },
  unmapped: ERROR_TONE,
  missing: ERROR_TONE,
  duplicate: ERROR_TONE,
};

/** Facet dot colour (matches the tone dot). */
const FACET_DOT: Record<GapStatus, string> = {
  placeholder: 'bg-status-progress-dot',
  unmapped: 'bg-gap',
  missing: 'bg-gap',
  duplicate: 'bg-gap',
  guard: 'bg-guard-dot',
  placed: 'bg-teal',
};

type SortKey = 'srow' | 'year' | 'week' | 'period' | 'lessonId' | 'skill' | 'dailyLo' | 'theme' | 'status';

const NUMERIC_SORTS = new Set<SortKey>(['srow', 'year', 'week', 'period']);

export function CurriculumGaps({ report }: { report: CurriculumGapsReport }) {
  const t = useTranslations('reconcile');
  const locale = useLocale();
  const router = useRouter();
  const [revalidating, startRevalidate] = useTransition();

  const [status, setStatus] = useState<GapStatus | 'all'>('all');
  const [year, setYear] = useState<number | 'all'>('all');
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('srow');
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const q = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    const rows = report.rows.filter((r) => {
      if (status !== 'all' && r.status !== status) return false;
      if (year !== 'all' && r.year !== year) return false;
      if (q) {
        const hay = [
          r.sourceRow ?? '',
          r.year,
          r.taxonomyId ?? '',
          r.lessonKey,
          r.skill ?? '',
          r.theme ?? '',
          r.grammarVocabulary ?? '',
          r.dailyOutcome ?? '',
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const sorted = rows.slice().sort((a, b) => sortRows(a, b, sortKey) * sortDir);
    return sorted;
  }, [report.rows, status, year, q, sortKey, sortDir]);

  const hasFilter = status !== 'all' || year !== 'all' || q.length > 0;
  const clearAll = () => {
    setStatus('all');
    setYear('all');
    setQuery('');
  };
  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir((d) => (d === 1 ? -1 : 1));
    else {
      setSortKey(key);
      setSortDir(1);
    }
  };

  const revalidate = () => startRevalidate(() => router.refresh());

  const onCopy = (id: string, text: string) => {
    void navigator.clipboard?.writeText(text).then(
      () => {
        setCopied(id);
        window.setTimeout(() => setCopied((c) => (c === id ? null : c)), 1400);
      },
      () => {},
    );
  };

  const onExport = () => {
    const csv = buildGapsCsv(filtered, report, (k, v) => t(k, v));
    const stamp = report.sourceFilename?.replace(/\.[^.]+$/, '') ?? report.subjectCode;
    downloadCsv(`curriculum-gaps-${stamp}.csv`, csv);
  };

  const sourceLabel = report.sourceFilename
    ? report.sourceFilename
    : t(`source.${report.source ?? 'unknown'}` as 'source.unknown');

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-card">
      {/* ── Action bar: subject + source, Export, Re-validate ── */}
      <div className="flex flex-wrap items-center gap-3 border-b border-border-strong bg-surface-subtle px-6 py-[11px]">
        <span className="text-[13.5px] font-semibold text-text" dir="auto">
          {report.subjectName}
        </span>
        <span className="font-mono text-[12px] text-text-faint" dir="auto">
          {sourceLabel}
        </span>
        <div className="ms-auto flex items-center gap-[9px]">
          <button
            type="button"
            onClick={onExport}
            className="inline-flex items-center gap-[7px] rounded-md border border-border-strong bg-surface px-[14px] py-[9px] text-[13px] font-semibold text-text hover:bg-surface-subtle"
          >
            <DownloadIcon />
            {t('actions.export')}
          </button>
          <button
            type="button"
            onClick={revalidate}
            disabled={revalidating}
            className="inline-flex items-center gap-[7px] rounded-md bg-teal px-[15px] py-[9px] text-[13px] font-semibold text-white hover:bg-teal-deep disabled:opacity-70"
          >
            <RefreshIcon spinning={revalidating} />
            {revalidating ? t('actions.revalidating') : t('actions.revalidate')}
          </button>
        </div>
      </div>

      <div className="flex items-stretch">
        {/* ── Facets ── */}
        <aside className="w-[244px] flex-none border-e border-border bg-surface-subtle px-4 pb-[30px] pt-[18px]">
          <div className="relative mb-5">
            <span className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-text-faint">
              <SearchIcon />
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('search.placeholder')}
              dir="auto"
              className="w-full rounded-md border border-border bg-surface py-[9px] pe-[10px] ps-[32px] text-[12.5px] text-text outline-none focus:border-teal"
            />
          </div>
          <div className="mb-[9px] text-[10.5px] font-bold uppercase tracking-[0.08em] text-text-faint">
            {t('facets.statusHeading')}
          </div>
          <div className="flex flex-col gap-[2px]">
            <FacetRow
              active={status === 'all'}
              onClick={() => setStatus('all')}
              dot="bg-neutral-400"
              label={t('status.all')}
              count={formatNumber(report.counts.all, locale)}
            />
            {GAP_STATUS_ORDER.map((s) => (
              <FacetRow
                key={s}
                active={status === s}
                onClick={() => setStatus(s)}
                dot={FACET_DOT[s]}
                label={t(`status.${s}`)}
                count={formatNumber(report.counts[s], locale)}
              />
            ))}
          </div>
        </aside>

        {/* ── Table ── */}
        <div className="min-w-0 flex-1 bg-surface-subtle">
          {/* toolbar */}
          <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-3">
            <span className="text-[12.5px] text-text-muted">
              {t.rich('table.showing', {
                shown: formatNumber(filtered.length, locale),
                total: formatNumber(report.counts.all, locale),
                strong: (chunks) => <strong className="font-bold text-text">{chunks}</strong>,
              })}
            </span>
            <div className="ms-[6px] inline-flex items-center gap-[7px]">
              <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-text-faint">
                {t('table.year')}
              </span>
              <select
                value={year === 'all' ? 'all' : String(year)}
                onChange={(e) => setYear(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                className="rounded-sm border border-border-strong bg-surface px-[11px] py-[7px] text-[12.5px] font-semibold text-text outline-none"
              >
                <option value="all">
                  {`${t('table.yearAll')} (${formatNumber(report.counts.all, locale)})`}
                </option>
                {report.years.map((y) => (
                  <option key={y.year} value={y.year}>
                    {`${t('table.yearLabel', { year: formatNumber(y.year, locale) })} (${formatNumber(y.count, locale)})`}
                  </option>
                ))}
              </select>
            </div>
            {hasFilter && (
              <button
                type="button"
                onClick={clearAll}
                className="rounded px-[6px] py-1 text-[12px] font-semibold text-teal hover:underline"
              >
                {t('table.clear')}
              </button>
            )}
            <span className="ms-auto text-[11.5px] text-text-faint">
              {t('table.sortedBy', { field: t(`sort.${sortKey}`) })}
            </span>
          </div>

          {!report.hasSourceRows && report.rows.length > 0 && (
            <div className="border-b border-border bg-guard-bg/50 px-5 py-2 text-[11.5px] text-guard">
              {t('note.sourceRowsPending')}
            </div>
          )}

          <div className="overflow-x-auto">
            <div className="min-w-[1120px]">
              {/* column headers */}
              <div className="flex items-center border-b border-border-strong bg-surface-cream px-5 py-[9px]">
                <HeaderCell w="w-6" />
                <HeaderCell w="w-[52px]" label={t('cols.row')} sortKey="srow" active={sortKey} dir={sortDir} onSort={toggleSort} />
                <HeaderCell w="w-[58px]" label={t('cols.year')} sortKey="year" active={sortKey} dir={sortDir} onSort={toggleSort} />
                <HeaderCell w="w-[34px]" label={t('cols.week')} sortKey="week" active={sortKey} dir={sortDir} onSort={toggleSort} />
                <HeaderCell w="w-8" label={t('cols.period')} sortKey="period" active={sortKey} dir={sortDir} onSort={toggleSort} />
                <HeaderCell w="w-[122px]" label={t('cols.lessonId')} sortKey="lessonId" active={sortKey} dir={sortDir} onSort={toggleSort} />
                <HeaderCell flex label={t('cols.dailyLo')} sortKey="dailyLo" active={sortKey} dir={sortDir} onSort={toggleSort} />
                <HeaderCell w="w-[108px]" label={t('cols.skill')} sortKey="skill" active={sortKey} dir={sortDir} onSort={toggleSort} />
                <HeaderCell w="w-[168px]" label={t('cols.topic')} />
                <HeaderCell w="w-[150px]" label={t('cols.theme')} sortKey="theme" active={sortKey} dir={sortDir} onSort={toggleSort} />
                <HeaderCell w="w-[118px]" label={t('cols.resources')} />
                <HeaderCell w="w-[110px]" label={t('cols.status')} sortKey="status" active={sortKey} dir={sortDir} onSort={toggleSort} />
                <HeaderCell w="w-[18px]" />
              </div>

              {/* rows */}
              {filtered.map((r) => (
                <RowItem
                  key={r.id}
                  row={r}
                  expanded={expanded === r.id}
                  onToggle={() => setExpanded((e) => (e === r.id ? null : r.id))}
                  report={report}
                  copiedId={copied}
                  onCopy={onCopy}
                />
              ))}

              {filtered.length === 0 && (
                <div className="px-5 py-14 text-center">
                  <div className="text-[14px] font-semibold text-text-muted">
                    {report.rows.length === 0 ? t('emptyData.title') : t('empty.title')}
                  </div>
                  {report.rows.length === 0 ? (
                    <p className="mt-2 text-[13px] text-text-faint">{t('emptyData.body')}</p>
                  ) : (
                    <button
                      type="button"
                      onClick={clearAll}
                      className="mt-2 text-[13px] font-semibold text-teal hover:underline"
                    >
                      {t('empty.clear')}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── sorting ────────────────────────────────────────────────────────────────────

function sortRows(a: GapRow, b: GapRow, key: SortKey): number {
  if (NUMERIC_SORTS.has(key)) {
    return numericField(a, key) - numericField(b, key);
  }
  return stringField(a, key).localeCompare(stringField(b, key));
}

function numericField(r: GapRow, key: SortKey): number {
  switch (key) {
    case 'srow':
      return r.sourceRow ?? 0;
    case 'year':
      return r.year;
    case 'week':
      return r.week;
    case 'period':
      return r.period ?? 0;
    default:
      return 0;
  }
}

function stringField(r: GapRow, key: SortKey): string {
  switch (key) {
    case 'lessonId':
      return r.taxonomyId ?? '';
    case 'skill':
      return r.skill ?? '';
    case 'dailyLo':
      return r.dailyOutcome ?? '';
    case 'theme':
      return r.theme ?? '';
    case 'status':
      return r.status;
    default:
      return '';
  }
}

// ── facet row ──────────────────────────────────────────────────────────────────

function FacetRow({
  active,
  onClick,
  dot,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  dot: string;
  label: string;
  count: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 rounded-md border px-[10px] py-[7px] text-start ${
        active ? 'border-teal-tint-border bg-teal-tint text-teal-deep' : 'border-transparent text-text'
      }`}
    >
      <span className={`h-[9px] w-[9px] flex-none rounded-full ${dot}`} />
      <span className="flex-1 text-[12px] font-medium leading-[1.3]">{label}</span>
      <span className="text-[11.5px] font-semibold text-text-faint">{count}</span>
    </button>
  );
}

// ── column header ──────────────────────────────────────────────────────────────

function HeaderCell({
  w,
  flex,
  label,
  sortKey,
  active,
  dir,
  onSort,
}: {
  w?: string;
  flex?: boolean;
  label?: string;
  sortKey?: SortKey;
  active?: SortKey;
  dir?: 1 | -1;
  onSort?: (k: SortKey) => void;
}) {
  const isSort = !!sortKey && sortKey === active;
  const clickable = !!sortKey && !!onSort;
  return (
    <span
      onClick={clickable ? () => onSort!(sortKey!) : undefined}
      className={`${flex ? 'flex-1 min-w-[200px] pe-2' : `${w} flex-none`} select-none text-[10px] font-bold uppercase tracking-[0.05em] ${
        isSort ? 'text-text-muted' : 'text-text-faint'
      } ${clickable ? 'cursor-pointer' : ''}`}
    >
      {label}
      {isSort ? <span className="text-[#c0a87e]">{dir === 1 ? ' ↑' : ' ↓'}</span> : ''}
    </span>
  );
}

// ── one data row + expand ────────────────────────────────────────────────────────

function RowItem({
  row,
  expanded,
  onToggle,
  report,
  copiedId,
  onCopy,
}: {
  row: GapRow;
  expanded: boolean;
  onToggle: () => void;
  report: CurriculumGapsReport;
  copiedId: string | null;
  onCopy: (id: string, text: string) => void;
}) {
  const t = useTranslations('reconcile');
  const locale = useLocale();
  const tone = TONE[row.status];
  const hasCode = !!row.taxonomyId && row.taxonomyId.trim() !== '';
  const outcome = row.dailyOutcome?.trim() ? row.dailyOutcome : t('table.noOutcome');

  const rowCopyId = `row-${row.id}`;
  const locatorCopyId = `loc-${row.id}`;
  const locator = row.sourceRow != null
    ? `${report.subjectName} · ${report.sourceFilename ?? report.subjectCode} · ${t('cols.row')} ${row.sourceRow}`
    : `${report.subjectName} · ${row.lessonKey}`;

  return (
    <div>
      <div
        onClick={onToggle}
        style={{
          borderInlineStartWidth: 3,
          borderInlineStartColor: tone.stripeVar ?? 'transparent',
        }}
        className={`flex cursor-pointer items-center border-b border-border px-5 py-[11px] ${
          expanded ? 'bg-cream/40' : tone.tint
        }`}
      >
        <span className="flex w-6 flex-none items-center">
          <span className={`h-2 w-2 rounded-full ${tone.dot}`} />
        </span>
        <span className="w-[52px] flex-none font-mono text-[11px] text-text-faint">
          {row.sourceRow != null ? formatNumber(row.sourceRow, locale) : '—'}
        </span>
        <span className="w-[58px] flex-none text-[12px] text-text-muted">
          {t('table.yearLabel', { year: formatNumber(row.year, locale) })}
        </span>
        <span className="w-[34px] flex-none text-[12px] text-text-muted">{formatNumber(row.week, locale)}</span>
        <span className="w-8 flex-none text-[12px] text-text-muted">
          {row.period != null ? formatNumber(row.period, locale) : '—'}
        </span>
        <span className="w-[122px] flex-none">
          <span
            dir="auto"
            className={`inline-block rounded-sm px-[7px] py-[3px] font-mono text-[11px] font-semibold ${
              hasCode ? tone.code : 'bg-gap-bg text-gap'
            }`}
          >
            {hasCode ? row.taxonomyId : t('table.blankCode')}
          </span>
        </span>
        <span className="min-w-[200px] flex-1 pe-3">
          <span
            dir="auto"
            className={`line-clamp-2 text-[12px] leading-[1.4] ${row.dailyOutcome?.trim() ? 'text-text-muted' : 'text-gap'}`}
          >
            {outcome}
          </span>
        </span>
        <span
          dir="auto"
          className={`w-[108px] flex-none pe-2 text-[12px] ${row.skill ? 'text-text-muted' : 'text-gap'}`}
        >
          {row.skill || '—'}
        </span>
        <span className="w-[168px] flex-none pe-[10px]">
          <span dir="auto" className="line-clamp-2 text-[11.5px] leading-[1.35] text-text-muted">
            {row.grammarVocabulary || '—'}
          </span>
        </span>
        <span className="w-[150px] flex-none pe-[10px]">
          <span dir="auto" className="line-clamp-2 text-[11.5px] leading-[1.35] text-text-muted">
            {row.theme || '—'}
          </span>
        </span>
        <span className={`w-[118px] flex-none pe-2 text-[11.5px] ${row.resources.length ? 'text-text-muted' : 'text-text-faint'}`}>
          {row.resources.length ? row.resources.map((r) => r.label).join(', ') : t('table.noResources')}
        </span>
        <span className="w-[110px] flex-none">
          <span className={`inline-block rounded-sm px-2 py-[3px] text-[10px] font-bold uppercase tracking-[0.03em] ${tone.tag}`}>
            {t(`flag.${row.status}`)}
          </span>
        </span>
        <span className="flex w-[18px] flex-none justify-end">
          <span className={expanded ? 'rotate-180 transition-transform' : 'transition-transform'}>
            <ChevronDownIcon />
          </span>
        </span>
      </div>

      {expanded && (
        <div className="flex flex-wrap gap-4 border-b border-border bg-cream/40 px-5 py-4 ps-11">
          <div className="min-w-0 flex-1">
            <div className="mb-3 flex flex-wrap gap-x-5 gap-y-2">
              <Field label={t('expand.focusArea')} value={row.focusArea != null ? formatNumber(row.focusArea, locale) : '—'} mono />
              <Field label={t('expand.skillLo')} value={row.skillLo ?? '—'} mono />
              <Field label={t('expand.knowledgeLo')} value={row.knowledgeLo ?? '—'} mono />
              <Field label={t('expand.hour')} value={row.hour != null ? formatNumber(row.hour, locale) : '—'} mono />
              <div className="min-w-[240px] flex-1">
                <FieldLabel>{t('expand.dailyLoFull')}</FieldLabel>
                <div dir="auto" className="mt-[2px] text-[12px] leading-[1.5] text-text-muted">
                  {outcome}
                </div>
              </div>
            </div>
            <div className="mb-3">
              <FieldLabel>{t('expand.lessonKey')}</FieldLabel>
              <div dir="auto" className="mt-[2px] break-all font-mono text-[11.5px] text-text-muted">
                {row.lessonKey}
              </div>
            </div>
            <div className={`flex max-w-[720px] gap-[10px] rounded-md border p-[11px] ${tone.fixPanel}`}>
              <BulbIcon className={tone.fixText} />
              <div className={`text-[12px] leading-[1.5] ${tone.fixText}`}>
                <strong className="font-bold">{t(`fix.title.${row.status}`)}</strong>{' '}
                {t(`fix.body.${row.status}`)}
                {row.status === 'guard' && row.referencedByPlans > 0
                  ? ' ' + t('fix.guardReferenced', { count: formatNumber(row.referencedByPlans, locale) })
                  : ''}
              </div>
            </div>
          </div>
          <div className="flex flex-none flex-col gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCopy(locatorCopyId, locator);
              }}
              className="whitespace-nowrap rounded-sm border border-border-strong bg-surface px-[13px] py-2 text-[12px] font-semibold text-text hover:bg-surface-subtle"
            >
              {copiedId === locatorCopyId ? t('actions.copied') : t('actions.copyLocator')}
            </button>
            {row.sourceRow != null && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onCopy(rowCopyId, String(row.sourceRow));
                }}
                className="rounded-sm px-[6px] py-1 text-[12px] font-semibold text-text-muted hover:text-text"
              >
                {copiedId === rowCopyId
                  ? t('actions.copied')
                  : t('actions.copyRow', { n: formatNumber(row.sourceRow, locale) })}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className={`mt-[2px] text-[12px] text-text-muted ${mono ? 'font-mono' : ''}`}>{value}</div>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[9.5px] font-bold uppercase tracking-[0.04em] text-text-faint">{children}</div>
  );
}

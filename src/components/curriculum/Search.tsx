'use client';

// The Search tab — instant client-side search + faceted filter over ONE subject's
// lessons. The whole subject is loaded once (server: getSearchData), so every keystroke
// filters in memory: no round-trip, no spinner. NO taxonomy dependency — it reads live
// columns (daily_outcome, theme, focus_area, linguistic_skill, grammar_vocabulary), so it
// works for every subject, including taxonomy-less ones.
//
// LAYOUT mirrors the Explorer shell: a selector row (subject + the search box), then the
// three-column body (facets rail · results · detail rail) — the SAME detail rail +
// "Plan this lesson →" handoff as Topics/Calendar. The matched term is highlighted with a
// NEUTRAL treatment (weight + soft grey tint), never a semantic cream/teal/pink/red.
//
// SUBJECT-CONDITIONAL FACETS come from the shared capability probe (composition.ts), not
// a second definition: Linguistic skill (english, arabic), Focus area (all but english,
// cascades to Topic), Grammar/vocabulary (english). Universal: Year, Month, Topic,
// Has resources.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/cn';
import { skillKeyOf, SKILL_PILL } from '@/components/curriculum/skill';
import { PlanLessonButton, type SubjectOption } from './explorer-ui';
import {
  highlightSegments,
  scoreFields,
  tokenize,
  type WeightedField,
} from '@/lib/curriculum/search-match';
import type { SearchData, SearchRecord } from '@/lib/curriculum/search';
import type { SubjectCapabilities } from '@/lib/curriculum/composition';

interface FacetState {
  years: Set<number>;
  months: Set<string>;
  topics: Set<string>;
  skills: Set<string>;
  focusAreas: Set<string>;
  hasResources: boolean;
  grammar: boolean;
}

const EMPTY_FACETS: FacetState = {
  years: new Set(),
  months: new Set(),
  topics: new Set(),
  skills: new Set(),
  focusAreas: new Set(),
  hasResources: false,
  grammar: false,
};

export function Search({
  data,
  capabilities,
  subjects,
  subjectCode,
  subjectName,
  initialQuery,
}: {
  data: SearchData;
  capabilities: SubjectCapabilities;
  subjects: SubjectOption[];
  subjectCode: string;
  subjectName: string;
  initialQuery: string;
}) {
  const t = useTranslations('curriculum');
  const locale = useLocale();
  const router = useRouter();

  const [query, setQuery] = useState(initialQuery);
  const [facets, setFacets] = useState<FacetState>(EMPTY_FACETS);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  // ── URL sync (?q=) — debounced replace so searches are shareable / back-safe ──────
  // Skip the mount run: the server already rendered from the incoming ?q=, so syncing on
  // mount would be a redundant navigation (and refetch). Only user typing drives it.
  const urlTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didMount = useRef(false);
  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      return;
    }
    if (urlTimer.current) clearTimeout(urlTimer.current);
    urlTimer.current = setTimeout(() => {
      const sp = new URLSearchParams();
      sp.set('tab', 'search');
      sp.set('subject', subjectCode);
      if (query.trim()) sp.set('q', query.trim());
      router.replace(`/curriculum?${sp.toString()}`, { scroll: false });
    }, 200);
    return () => {
      if (urlTimer.current) clearTimeout(urlTimer.current);
    };
  }, [query, subjectCode, router]);

  const queryTokens = useMemo(() => tokenize(query), [query]);

  // ── Facet option lists (derived from the corpus; Focus area → Topic cascades) ─────
  const focusAreaOptions = useMemo(
    () => distinct(data.records.map((r) => r.focusArea)),
    [data.records],
  );
  const skillOptions = useMemo(
    () => distinct(data.records.map((r) => r.linguisticSkill)),
    [data.records],
  );
  // Topics narrow to the selected focus areas (the cascade); with none selected, all show.
  const topicOptions = useMemo(() => {
    const scoped =
      facets.focusAreas.size > 0
        ? data.records.filter((r) => r.focusArea && facets.focusAreas.has(r.focusArea))
        : data.records;
    return distinct(scoped.map((r) => r.theme));
  }, [data.records, facets.focusAreas]);

  // A selected topic outside the current focus-area cascade is IGNORED (not deleted) —
  // derived here rather than pruned via an effect, so it re-applies if the focus area is
  // reselected. This is the topic set that actually filters + drives chip highlighting.
  const effectiveTopics = useMemo(() => {
    if (facets.topics.size === 0) return facets.topics;
    const allowed = new Set(topicOptions);
    return new Set([...facets.topics].filter((tp) => allowed.has(tp)));
  }, [facets.topics, topicOptions]);

  // Facet PRESENCE comes from the shared capability probe (not a second definition), but
  // each is AND-guarded by the corpus actually offering non-empty values — so a column
  // that is present-but-blank never renders a dead facet.
  const showSkill = capabilities.hasLinguisticSkillText && skillOptions.length > 0;
  const showFocusArea = capabilities.hasFocusAreaText && focusAreaOptions.length > 0;
  const hasGrammarFacet = useMemo(
    () => data.records.some((r) => r.grammarVocabulary),
    [data.records],
  );
  const showGrammar = capabilities.hasGrammarVocabText && hasGrammarFacet;
  const showTopic = topicOptions.length > 0;
  const hasResourcesFacet = useMemo(
    () => data.records.some((r) => r.resources.length > 0),
    [data.records],
  );
  const showMore = hasResourcesFacet || showGrammar;

  // The facet set that actually filters — topics narrowed to the cascade (see above).
  const effectiveFacets = useMemo<FacetState>(
    () => ({ ...facets, topics: effectiveTopics }),
    [facets, effectiveTopics],
  );

  const anyFacetActive =
    facets.years.size > 0 ||
    facets.months.size > 0 ||
    effectiveTopics.size > 0 ||
    facets.skills.size > 0 ||
    facets.focusAreas.size > 0 ||
    facets.hasResources ||
    facets.grammar;
  const hasQuery = queryTokens.length > 0;
  const active = hasQuery || anyFacetActive;

  // ── Filter (facets, AND across dimensions) then rank (query score) ────────────────
  const results = useMemo(() => {
    const filtered = data.records.filter((r) => matchesFacets(r, effectiveFacets));
    if (!hasQuery) {
      // No query: facet-only browse, in scheme-of-work order.
      return filtered
        .map((record) => ({ record, score: 0 }))
        .sort((a, b) => calRank(a.record) - calRank(b.record));
    }
    const scored: Array<{ record: SearchRecord; score: number }> = [];
    for (const record of filtered) {
      const score = scoreFields(searchableFields(record), queryTokens);
      if (score != null) scored.push({ record, score });
    }
    scored.sort((a, b) => b.score - a.score || calRank(a.record) - calRank(b.record));
    return scored;
  }, [data.records, effectiveFacets, hasQuery, queryTokens]);

  // Selection is DERIVED, not synced via an effect: the clicked row when it's still in the
  // result set, else the first result. So the rail always shows something without a
  // cascading setState, and a click simply overrides the default.
  const selected =
    results.find((r) => r.record.lessonKey === selectedKey)?.record ??
    results[0]?.record ??
    null;

  const toggleValue = useCallback(
    <K extends 'years' | 'months' | 'topics' | 'skills' | 'focusAreas'>(
      key: K,
      value: FacetState[K] extends Set<infer V> ? V : never,
    ) => {
      setFacets((f) => {
        const next = new Set(f[key] as Set<typeof value>);
        if (next.has(value)) next.delete(value);
        else next.add(value);
        return { ...f, [key]: next };
      });
    },
    [],
  );

  const clearAll = useCallback(() => {
    setFacets(EMPTY_FACETS);
    setQuery('');
  }, []);

  return (
    <div>
      {/* Selector row: subject switcher + search box */}
      <div className="flex flex-wrap items-center gap-[12px] px-[26px] pt-[20px]">
        <SubjectSelect
          ariaLabel={t('subjectLabel')}
          value={subjectCode}
          subjects={subjects}
          onChange={(code) => {
            const sp = new URLSearchParams();
            sp.set('tab', 'search');
            sp.set('subject', code);
            if (query.trim()) sp.set('q', query.trim());
            router.push(`/curriculum?${sp.toString()}`);
          }}
        />
        <div className="relative min-w-[240px] flex-1">
          <span className="pointer-events-none absolute start-[13px] top-1/2 -translate-y-1/2 text-teal">
            <SearchGlyph />
          </span>
          <input
            type="search"
            dir="auto"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={t('search.inputAria', { subject: subjectName })}
            placeholder={t('search.placeholder')}
            className="w-full rounded-[11px] border-[1.5px] border-teal bg-surface py-[11px] pe-[14px] ps-[40px] text-[15px] text-ink outline-none placeholder:text-text-faint focus-visible:ring-2 focus-visible:ring-teal/30"
          />
        </div>
        {active ? (
          <button
            type="button"
            onClick={clearAll}
            className="text-[13px] font-semibold text-teal transition-colors hover:text-teal-deep"
          >
            {t('search.clearAll')}
          </button>
        ) : null}
      </div>

      <div className="grid gap-[20px] px-[26px] pb-[28px] pt-[18px] lg:grid-cols-[230px_minmax(0,1fr)_320px]">
        {/* Facets rail */}
        <div className="self-start">
          <div className="mb-[10px] text-[11px] font-bold uppercase tracking-[0.06em] text-[#8A8178]">
            {t('search.filters')}
          </div>
          <div className="flex flex-col gap-[16px]">
            {data.years.length > 0 ? (
              <FacetGroup label={t('search.facets.year')}>
                {data.years.map((y) => (
                  <Chip
                    key={y}
                    active={facets.years.has(y)}
                    onClick={() => toggleValue('years', y)}
                    label={t('year', { n: formatNumber(y, locale) })}
                  />
                ))}
              </FacetGroup>
            ) : null}

            {data.months.length > 0 ? (
              <FacetGroup label={t('search.facets.month')}>
                {data.months.map((m) => (
                  <Chip
                    key={m}
                    active={facets.months.has(m)}
                    onClick={() => toggleValue('months', m)}
                    label={m}
                  />
                ))}
              </FacetGroup>
            ) : null}

            {showFocusArea ? (
              <FacetGroup label={t('search.facets.focusArea')}>
                {focusAreaOptions.map((fa) => (
                  <Chip
                    key={fa}
                    active={facets.focusAreas.has(fa)}
                    onClick={() => toggleValue('focusAreas', fa)}
                    label={fa}
                  />
                ))}
              </FacetGroup>
            ) : null}

            {showTopic ? (
              <FacetGroup label={t('search.facets.topic')}>
                {topicOptions.map((tp) => (
                  <Chip
                    key={tp}
                    active={facets.topics.has(tp)}
                    onClick={() => toggleValue('topics', tp)}
                    label={tp}
                  />
                ))}
              </FacetGroup>
            ) : null}

            {showSkill ? (
              <FacetGroup label={t('search.facets.skill')}>
                {skillOptions.map((sk) => (
                  <Chip
                    key={sk}
                    active={facets.skills.has(sk)}
                    onClick={() => toggleValue('skills', sk)}
                    label={sk}
                  />
                ))}
              </FacetGroup>
            ) : null}

            {showMore ? (
              <FacetGroup label={t('search.facets.more')}>
                {hasResourcesFacet ? (
                  <Chip
                    active={facets.hasResources}
                    onClick={() => setFacets((f) => ({ ...f, hasResources: !f.hasResources }))}
                    label={t('search.facets.hasResources')}
                  />
                ) : null}
                {showGrammar ? (
                  <Chip
                    active={facets.grammar}
                    onClick={() => setFacets((f) => ({ ...f, grammar: !f.grammar }))}
                    label={t('search.facets.grammar')}
                  />
                ) : null}
              </FacetGroup>
            ) : null}
          </div>
        </div>

        {/* Results */}
        <div className="min-w-0">
          {active ? (
            <div className="mb-[12px] text-[12px] font-semibold text-text-muted">
              {t('search.resultCount', { count: results.length })}
            </div>
          ) : null}

          {!active ? (
            <SearchState
              title={t('search.emptyTitle')}
              body={t('search.emptyBody', { subject: subjectName })}
            />
          ) : results.length === 0 ? (
            <SearchState title={t('search.noMatchTitle')} body={t('search.noMatchBody')} />
          ) : (
            <ul className="flex flex-col gap-[10px]">
              {results.map(({ record }) => (
                <li key={record.lessonKey}>
                  <ResultRow
                    record={record}
                    queryTokens={queryTokens}
                    active={record.lessonKey === selected?.lessonKey}
                    onSelect={() => setSelectedKey(record.lessonKey)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Detail rail — same rail + Plan handoff as Topics/Calendar */}
        <div className="self-start">
          <div className="mb-[8px] text-[10.5px] font-bold uppercase tracking-[0.05em] text-[#A79E94]">
            {selected ? t('search.detailHeading') : t('focus.inFocusPlain')}
          </div>
          {selected ? (
            <DetailRail record={selected} queryTokens={queryTokens} />
          ) : (
            <div className="rounded-[14px] border border-border bg-surface-subtle p-[15px] text-[13px] text-text-muted">
              {t('search.selectResult')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Result row ────────────────────────────────────────────────────────────────────────

function ResultRow({
  record,
  queryTokens,
  active,
  onSelect,
}: {
  record: SearchRecord;
  queryTokens: string[];
  active: boolean;
  onSelect: () => void;
}) {
  const t = useTranslations('curriculum');
  const locale = useLocale();
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={cn(
        'w-full rounded-[12px] border px-[15px] py-[12px] text-start transition-shadow',
        active
          ? 'border-[1.5px] border-teal bg-[#EFF6F4] shadow-[0_12px_26px_-20px_rgba(31,122,108,0.5)]'
          : 'border border-[#EAD9C5] bg-surface-cream hover:shadow-[0_10px_22px_-20px_rgba(60,40,30,0.5)]',
      )}
    >
      <div className="mb-[6px] text-[10px] font-semibold uppercase tracking-[0.04em] text-[#A79E94]">
        {calendarPath(record, t, locale)}
      </div>
      <div dir="auto" className="text-[14px] leading-[1.45] text-ink [overflow-wrap:anywhere]">
        <Highlighted text={record.dailyOutcome} queryTokens={queryTokens} />
      </div>
      <FacetChips record={record} className="mt-[9px]" />
    </button>
  );
}

// ── Detail rail ─────────────────────────────────────────────────────────────────────

function DetailRail({ record, queryTokens }: { record: SearchRecord; queryTokens: string[] }) {
  const t = useTranslations('curriculum');
  const locale = useLocale();
  return (
    <div className="rounded-[14px] border-[1.5px] border-teal bg-surface p-[15px] shadow-[0_14px_30px_-24px_rgba(31,122,108,0.6)]">
      <FacetChips record={record} className="mb-[10px]" />
      <div className="mb-[8px] text-[10px] text-[#A79E94]">{calendarPath(record, t, locale)}</div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.04em] text-[#A79E94]">
        {t('focus.dailyOutcome')}
      </div>
      <p
        dir="auto"
        className="mb-[14px] mt-[5px] text-[15.5px] font-medium leading-[1.4] text-ink [overflow-wrap:anywhere]"
      >
        <Highlighted text={record.dailyOutcome} queryTokens={queryTokens} />
      </p>
      {record.resources.length > 0 ? (
        <>
          <div className="mb-[7px] text-[10px] font-semibold uppercase text-[#A79E94]">
            {t('focus.resources')}
          </div>
          <ul className="mb-[14px] space-y-[6px]">
            {record.resources.map((r, i) => (
              <li
                key={`${r.label}-${i}`}
                dir="auto"
                className="flex items-start gap-[8px] text-[13px] text-ink"
              >
                <ImageGlyph />
                <span className="min-w-0 break-all">{r.label}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <PlanLessonButton lessonKey={record.lessonKey} period={record.period} />
    </div>
  );
}

// ── Small pieces ────────────────────────────────────────────────────────────────────

/** The matched facet chips for a record: Topic (theme), Focus area, and Skill. */
function FacetChips({ record, className }: { record: SearchRecord; className?: string }) {
  const chips: React.ReactNode[] = [];
  if (record.focusArea) {
    chips.push(
      <span
        key="fa"
        dir="auto"
        className="rounded-[7px] bg-surface-cream px-[9px] py-[3px] text-[11px] font-semibold text-[#8A6D57]"
      >
        {record.focusArea}
      </span>,
    );
  }
  if (record.theme) {
    chips.push(
      <span
        key="theme"
        dir="auto"
        className="rounded-[7px] bg-surface-cream px-[9px] py-[3px] text-[11px] font-semibold text-[#8A6D57]"
      >
        {record.theme}
      </span>,
    );
  }
  if (record.linguisticSkill) {
    chips.push(
      <span
        key="skill"
        dir="auto"
        className={cn(
          'rounded-[7px] border px-[9px] py-[3px] text-[11px] font-semibold',
          SKILL_PILL[skillKeyOf(record.linguisticSkill)],
        )}
      >
        {record.linguisticSkill}
      </span>,
    );
  }
  if (chips.length === 0) return null;
  return <div className={cn('flex flex-wrap gap-[6px]', className)}>{chips}</div>;
}

/** Render text with query-token occurrences wrapped in a NEUTRAL (off-palette) mark. */
function Highlighted({ text, queryTokens }: { text: string; queryTokens: string[] }) {
  const segments = useMemo(() => highlightSegments(text, queryTokens), [text, queryTokens]);
  return (
    <>
      {segments.map((seg, i) =>
        seg.hit ? (
          <mark
            key={i}
            className="rounded-[3px] bg-neutral-200/60 px-[1.5px] font-semibold text-ink"
          >
            {seg.text}
          </mark>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </>
  );
}

function FacetGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-[7px] text-[10px] font-bold uppercase tracking-[0.05em] text-[#9A7B5C]">
        {label}
      </div>
      <div className="flex flex-wrap gap-[6px]">{children}</div>
    </div>
  );
}

function Chip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      dir="auto"
      className={cn(
        'rounded-full border px-[11px] py-[5px] text-[12px] font-semibold transition-colors',
        active
          ? 'border-teal bg-teal-tint text-teal-deep'
          : 'border-[#E3DACD] bg-surface text-[#5C544E] hover:bg-surface-subtle',
      )}
    >
      {label}
    </button>
  );
}

function SearchState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-[12px] rounded-[14px] border border-dashed border-[#DBCDBB] bg-surface-subtle px-[26px] py-[56px] text-center">
      <span className="inline-flex size-[52px] items-center justify-center rounded-[15px] bg-[#F3EEE6] text-[#C7BFB5]">
        <SearchGlyph size={24} />
      </span>
      <div className="text-[14px] font-semibold text-ink">{title}</div>
      <p className="max-w-[340px] text-[13px] text-text-muted">{body}</p>
    </div>
  );
}

function SubjectSelect({
  ariaLabel,
  value,
  subjects,
  onChange,
}: {
  ariaLabel: string;
  value: string;
  subjects: SubjectOption[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative inline-flex">
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none rounded-[10px] border border-[#DDD4C8] bg-surface py-[9px] pe-[34px] ps-[13px] text-[14px] font-medium text-ink transition-colors hover:bg-surface-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/40"
      >
        {subjects.map((s) => (
          <option key={s.code} value={s.code}>
            {s.name}
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

function SearchGlyph({ size = 17 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

function ImageGlyph() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="mt-[2px] shrink-0 text-teal"
    >
      <rect x="4" y="6" width="16" height="12" rx="2" />
      <circle cx="9" cy="12" r="2" />
    </svg>
  );
}

// ── Pure helpers ────────────────────────────────────────────────────────────────────

/** Distinct, non-empty, trimmed values in first-seen-then-alphabetical order. */
function distinct(values: (string | null)[]): string[] {
  const set = new Set<string>();
  for (const v of values) {
    const s = (v ?? '').trim();
    if (s) set.add(s);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

/** The weighted searchable fields for a record — daily outcome dominates. */
function searchableFields(record: SearchRecord): WeightedField[] {
  const fields: WeightedField[] = [{ tokens: tokenize(record.dailyOutcome), weight: 3 }];
  if (record.theme) fields.push({ tokens: tokenize(record.theme), weight: 1.5 });
  if (record.focusArea) fields.push({ tokens: tokenize(record.focusArea), weight: 1.5 });
  if (record.linguisticSkill) fields.push({ tokens: tokenize(record.linguisticSkill), weight: 1 });
  if (record.grammarVocabulary) {
    fields.push({ tokens: tokenize(record.grammarVocabulary), weight: 1 });
  }
  return fields;
}

/** Whether a record passes the active facets (OR within a facet, AND across facets). */
function matchesFacets(r: SearchRecord, f: FacetState): boolean {
  if (f.years.size > 0 && !f.years.has(r.year)) return false;
  if (f.months.size > 0 && !f.months.has(r.month)) return false;
  if (f.topics.size > 0 && !(r.theme && f.topics.has(r.theme))) return false;
  if (f.skills.size > 0 && !(r.linguisticSkill && f.skills.has(r.linguisticSkill))) return false;
  if (f.focusAreas.size > 0 && !(r.focusArea && f.focusAreas.has(r.focusArea))) return false;
  if (f.hasResources && r.resources.length === 0) return false;
  if (f.grammar && !r.grammarVocabulary) return false;
  return true;
}

/** Scheme-of-work sort rank (year, then globally-monotonic week, then period). */
function calRank(r: SearchRecord): number {
  return r.year * 1_000_000 + r.week * 100 + (r.period ?? 0);
}

/** "Yr N · Month · Wk N · P N" — the same calendar path Topics/Calendar show. */
function calendarPath(
  r: SearchRecord,
  t: ReturnType<typeof useTranslations>,
  locale: string,
): string {
  return [
    t('year', { n: formatNumber(r.year, locale) }),
    r.month,
    t('tree.slotWeek', { n: formatNumber(r.week, locale) }),
    r.period != null ? t('tree.slotPeriod', { n: formatNumber(r.period, locale) }) : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

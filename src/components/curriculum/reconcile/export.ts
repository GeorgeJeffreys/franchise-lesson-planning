// CSV export for the Curriculum Gaps reconcile page — the artefact the content team
// takes offline to fix the workbook. Emits the currently-filtered rows with enough to
// locate + fix each: source row (when available), current code, status, the reason, and
// the locating fields (year / month / week / period / theme / daily outcome).

import type { CurriculumGapsReport, GapRow } from '@/lib/curriculum/gaps';

type Translate = (key: string, values?: Record<string, string | number>) => string;

/** RFC-4180 escaping: wrap in quotes and double any embedded quotes. */
function cell(value: string | number | null | undefined): string {
  const s = value == null ? '' : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildGapsCsv(rows: readonly GapRow[], report: CurriculumGapsReport, t: Translate): string {
  const header = [
    t('csv.sourceRow'),
    t('csv.lessonKey'),
    t('csv.code'),
    t('csv.status'),
    t('csv.reason'),
    t('csv.year'),
    t('csv.month'),
    t('csv.week'),
    t('csv.period'),
    t('csv.skill'),
    t('csv.theme'),
    t('csv.dailyOutcome'),
  ];
  const lines = [header.map(cell).join(',')];
  for (const r of rows) {
    lines.push(
      [
        cell(r.sourceRow ?? ''),
        cell(r.lessonKey),
        cell(r.taxonomyId ?? ''),
        cell(t(`status.${r.status}`)),
        cell(t(`fix.title.${r.status}`)),
        cell(r.year),
        cell(r.month),
        cell(r.week),
        cell(r.period ?? ''),
        cell(r.skill ?? ''),
        cell(r.theme ?? ''),
        cell(r.dailyOutcome ?? ''),
      ].join(','),
    );
  }
  return lines.join('\r\n');
}

/** Trigger a client-side download of a CSV string (UTF-8 BOM so Excel reads it right). */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

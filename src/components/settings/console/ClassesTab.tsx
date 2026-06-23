'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { ConsoleClassesData, ConsoleClassRow } from '@/lib/console';
import { archiveClass, createClass, restoreClass, updateClass } from '@/lib/actions/console';
import {
  ConsoleTable,
  EmptyState,
  ErrorText,
  FieldLabel,
  GhostButton,
  Modal,
  PrimaryButton,
  SectionCard,
  StatusBadge,
  Td,
  Th,
} from './ui';

const YEARS = [0, 1, 2, 3, 4, 5, 6];

const selectClass =
  'w-full rounded-[9px] border border-[#DDD4C8] bg-white px-[11px] py-[8px] text-[13.5px] text-[#2A2422] outline-none focus:border-[#1F7A6C]';

interface FormState {
  id: string | null; // null = creating
  schoolId: string;
  subjectId: string;
  year: number | '';
  groupLabel: string;
}

const EMPTY_FORM: FormState = { id: null, schoolId: '', subjectId: '', year: '', groupLabel: '' };

export function ClassesTab({ data }: { data: ConsoleClassesData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [fCentre, setFCentre] = useState('');
  const [fSubject, setFSubject] = useState('');
  const [fYear, setFYear] = useState('');

  const [form, setForm] = useState<FormState | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<ConsoleClassRow | null>(null);

  const centreName = (id: string) => data.centres.find((c) => c.id === id)?.name ?? '';
  const subjectName = (id: string) => data.subjects.find((s) => s.id === id)?.name ?? '';

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, onDone?: () => void) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        setError(res.error ?? 'Something went wrong.');
        return;
      }
      onDone?.();
      router.refresh();
    });
  }

  const filtered = useMemo(() => {
    return data.classes.filter(
      (c) =>
        (!fCentre || c.schoolId === fCentre) &&
        (!fSubject || c.subjectId === fSubject) &&
        (!fYear || c.year === Number(fYear)),
    );
  }, [data.classes, fCentre, fSubject, fYear]);

  const active = filtered.filter((c) => !c.archivedAt);
  const archived = filtered.filter((c) => c.archivedAt);
  const hasFilter = !!(fCentre || fSubject || fYear);

  // Live tuple-uniqueness for the form.
  const tupleClash = useMemo(() => {
    if (!form || !form.schoolId || !form.subjectId || form.year === '' || !form.groupLabel.trim())
      return null;
    const hit = data.classes.find(
      (c) =>
        c.id !== form.id &&
        c.schoolId === form.schoolId &&
        c.subjectId === form.subjectId &&
        c.year === Number(form.year) &&
        c.groupLabel.toLowerCase() === form.groupLabel.trim().toLowerCase(),
    );
    if (!hit) return null;
    return `${centreName(form.schoolId)} · ${subjectName(form.subjectId)} · Year ${form.year} · ${form.groupLabel.trim()} already exists.`;
  }, [form, data.classes]); // eslint-disable-line react-hooks/exhaustive-deps

  const formValid =
    !!form &&
    !!form.schoolId &&
    !!form.subjectId &&
    form.year !== '' &&
    !!form.groupLabel.trim() &&
    !tupleClash;

  function submitForm() {
    if (!form) return;
    const payload = {
      schoolId: form.schoolId,
      subjectId: form.subjectId,
      year: Number(form.year),
      groupLabel: form.groupLabel,
    };
    run(
      () => (form.id ? updateClass({ id: form.id, ...payload }) : createClass(payload)),
      () => setForm(null),
    );
  }

  return (
    <div className="space-y-[18px]">
      <SectionCard
        title="Classes"
        action={<PrimaryButton onClick={() => setForm({ ...EMPTY_FORM })}>＋ New class</PrimaryButton>}
      >
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 border-b border-[#F0EAE1] px-[18px] py-[13px]">
          <select className={`${selectClass} max-w-[200px]`} value={fCentre} onChange={(e) => setFCentre(e.target.value)} aria-label="Filter by centre">
            <option value="">All centres</option>
            {data.centres.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select className={`${selectClass} max-w-[180px]`} value={fSubject} onChange={(e) => setFSubject(e.target.value)} aria-label="Filter by subject">
            <option value="">All subjects</option>
            {data.subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <select className={`${selectClass} max-w-[130px]`} value={fYear} onChange={(e) => setFYear(e.target.value)} aria-label="Filter by year">
            <option value="">All years</option>
            {data.years.map((y) => (
              <option key={y} value={y}>Year {y}</option>
            ))}
          </select>
          {hasFilter ? (
            <GhostButton
              tone="teal"
              onClick={() => {
                setFCentre('');
                setFSubject('');
                setFYear('');
              }}
            >
              Clear
            </GhostButton>
          ) : null}
        </div>

        {filtered.length === 0 ? (
          <EmptyState>
            {hasFilter ? 'No classes match these filters.' : 'No classes yet. Create the first one.'}
          </EmptyState>
        ) : (
          <ConsoleTable
            head={
              <tr>
                <Th>Centre</Th>
                <Th>Subject</Th>
                <Th>Year</Th>
                <Th>Group</Th>
                <Th className="text-right">Members</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            }
          >
            {[...active, ...archived].map((c) => {
              const isArchived = !!c.archivedAt;
              return (
                <tr key={c.id} className={isArchived ? 'opacity-55' : undefined}>
                  <Td className="font-semibold text-[#2A2422]">
                    {c.schoolName ?? '—'}
                    {isArchived ? (
                      <span className="ml-2 align-middle">
                        <StatusBadge archived />
                      </span>
                    ) : null}
                  </Td>
                  <Td className="text-[#7A7068]">{c.subjectName ?? '—'}</Td>
                  <Td className="text-[#7A7068]">Year {c.year}</Td>
                  <Td className="text-[#7A7068]">{c.groupLabel}</Td>
                  <Td className="text-right tabular-nums text-[#7A7068]">{c.memberCount}</Td>
                  <Td className="text-right">
                    {isArchived ? (
                      <GhostButton
                        tone="teal"
                        disabled={pending}
                        onClick={() => run(() => restoreClass({ id: c.id }))}
                      >
                        Restore
                      </GhostButton>
                    ) : (
                      <div className="flex items-center justify-end gap-3">
                        <GhostButton
                          tone="teal"
                          onClick={() =>
                            setForm({
                              id: c.id,
                              schoolId: c.schoolId,
                              subjectId: c.subjectId,
                              year: c.year,
                              groupLabel: c.groupLabel,
                            })
                          }
                        >
                          Edit
                        </GhostButton>
                        <GhostButton tone="amber" onClick={() => setArchiveTarget(c)}>
                          Archive
                        </GhostButton>
                      </div>
                    )}
                  </Td>
                </tr>
              );
            })}
          </ConsoleTable>
        )}
        <div className="px-[18px]">
          <ErrorText>{error}</ErrorText>
        </div>
      </SectionCard>

      {/* Create / Edit modal */}
      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? 'Edit class' : 'New class'}>
        {form ? (
          <div className="space-y-[14px]">
            <div>
              <FieldLabel>Centre</FieldLabel>
              <select
                className={selectClass}
                value={form.schoolId}
                onChange={(e) => setForm({ ...form, schoolId: e.target.value })}
              >
                <option value="">Choose a centre…</option>
                {data.centres.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel>Subject</FieldLabel>
              <select
                className={selectClass}
                value={form.subjectId}
                onChange={(e) => setForm({ ...form, subjectId: e.target.value })}
              >
                <option value="">Choose a subject…</option>
                {data.subjects.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-3">
              <div className="w-[130px]">
                <FieldLabel>Year</FieldLabel>
                <select
                  className={selectClass}
                  value={form.year}
                  onChange={(e) => setForm({ ...form, year: e.target.value === '' ? '' : Number(e.target.value) })}
                >
                  <option value="">Year…</option>
                  {YEARS.map((y) => (
                    <option key={y} value={y}>Year {y}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <FieldLabel>Group</FieldLabel>
                <input
                  className={selectClass}
                  value={form.groupLabel}
                  onChange={(e) => setForm({ ...form, groupLabel: e.target.value })}
                  placeholder="e.g. A"
                  aria-label="Group"
                />
              </div>
            </div>
            {tupleClash ? (
              <p className="text-[12.5px] font-medium text-[#B23A2E]">{tupleClash}</p>
            ) : null}
            <div className="mt-[6px] flex items-center justify-end gap-3">
              <GhostButton onClick={() => setForm(null)}>Cancel</GhostButton>
              <PrimaryButton disabled={pending || !formValid} onClick={submitForm}>
                {form.id ? 'Save class' : 'Create class'}
              </PrimaryButton>
            </div>
            <ErrorText>{error}</ErrorText>
          </div>
        ) : null}
      </Modal>

      {/* Soft-archive warning */}
      <Modal
        open={!!archiveTarget}
        onClose={() => setArchiveTarget(null)}
        title={`Archive ${archiveTarget ? `Year ${archiveTarget.year} · ${archiveTarget.groupLabel}` : 'class'}?`}
      >
        {archiveTarget ? (
          <>
            {archiveTarget.activePlanCount > 0 ? (
              <p className="text-[13.5px] leading-relaxed text-[#7A7068]">
                {archiveTarget.activePlanCount}{' '}
                {archiveTarget.activePlanCount === 1 ? 'active plan references' : 'active plans reference'}{' '}
                this class. Archiving keeps the plans but removes the class from planning.
              </p>
            ) : (
              <p className="text-[13.5px] leading-relaxed text-[#7A7068]">
                This class will be removed from planning. You can restore it at any time.
              </p>
            )}
            <div className="mt-[18px] flex items-center justify-end gap-3">
              <GhostButton onClick={() => setArchiveTarget(null)}>Cancel</GhostButton>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  run(() => archiveClass({ id: archiveTarget!.id }), () => setArchiveTarget(null))
                }
                className="rounded-[9px] px-[15px] py-[8px] text-[13px] font-semibold text-white disabled:opacity-50"
                style={{ background: '#B0651E' }}
              >
                Archive anyway
              </button>
            </div>
          </>
        ) : null}
      </Modal>
    </div>
  );
}

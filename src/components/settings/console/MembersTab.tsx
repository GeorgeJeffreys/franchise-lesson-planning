'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { AdminMembersData, CoordSpaceMembers, Person } from '@/lib/console';
import type { MembershipRole } from '@/lib/auth';
import {
  coordPromoteMember,
  coordRemoveMember,
  removeMembership,
  saveMembership,
} from '@/lib/actions/console';
import {
  Avatar,
  ConsoleTable,
  EmptyState,
  ErrorText,
  FieldLabel,
  GhostButton,
  Modal,
  PrimaryButton,
  RolePill,
  SectionCard,
  Td,
  Th,
} from './ui';
import { cn } from '@/lib/cn';

// ── Admin view ────────────────────────────────────────────────────────────────

interface FlatRow {
  person: Person;
  membershipId: string | null;
  role: MembershipRole | null;
  schoolName: string | null;
  subjectName: string | null;
  homeClass: string | null;
}

function flatten(people: Person[]): FlatRow[] {
  const rows: FlatRow[] = [];
  for (const person of people) {
    if (person.memberships.length === 0) {
      rows.push({ person, membershipId: null, role: null, schoolName: null, subjectName: null, homeClass: null });
    } else {
      for (const m of person.memberships) {
        rows.push({
          person,
          membershipId: m.membershipId,
          role: m.role,
          schoolName: m.schoolName,
          subjectName: m.subjectName,
          homeClass: m.homeClass,
        });
      }
    }
  }
  return rows;
}

export function AdminMembersTab({ data }: { data: AdminMembersData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Person | null>(null);

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

  const rows = flatten(data.people);

  return (
    <div className="space-y-[18px]">
      <SectionCard title="Members & roles">
        {rows.length === 0 ? (
          <EmptyState>No people to show.</EmptyState>
        ) : (
          <ConsoleTable
            head={
              <tr>
                <Th>Person</Th>
                <Th>Role</Th>
                <Th>School</Th>
                <Th>Subject</Th>
                <Th>Class</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            }
          >
            {rows.map((r, i) => (
              <tr key={`${r.person.profileId}:${r.membershipId ?? 'none'}:${i}`}>
                <Td>
                  <div className="flex items-center gap-[10px]">
                    <Avatar name={r.person.name} />
                    <span className="font-semibold text-[#2A2422]">{r.person.name}</span>
                  </div>
                </Td>
                <Td>
                  <RolePill kind={r.role ?? 'no-access'} />
                </Td>
                <Td className="text-[#7A7068]">{r.schoolName ?? '—'}</Td>
                <Td className="text-[#7A7068]">{r.subjectName ?? '—'}</Td>
                <Td className="text-[#7A7068]">{r.homeClass ?? '—'}</Td>
                <Td className="text-right">
                  {r.membershipId ? (
                    <div className="flex items-center justify-end gap-3">
                      <GhostButton tone="teal" onClick={() => setEditing(r.person)}>
                        Edit
                      </GhostButton>
                      <GhostButton
                        tone="red"
                        disabled={pending}
                        onClick={() => run(() => removeMembership({ membershipId: r.membershipId! }))}
                      >
                        Remove
                      </GhostButton>
                    </div>
                  ) : (
                    <GhostButton tone="teal" onClick={() => setEditing(r.person)}>
                      Assign
                    </GhostButton>
                  )}
                </Td>
              </tr>
            ))}
          </ConsoleTable>
        )}
        <div className="px-[18px]">
          <ErrorText>{error}</ErrorText>
        </div>
      </SectionCard>

      {editing ? (
        <AssignModal
          person={editing}
          centres={data.centres}
          subjects={data.subjects}
          pending={pending}
          onClose={() => setEditing(null)}
          onSave={(input) => run(() => saveMembership(input), () => setEditing(null))}
        />
      ) : null}
    </div>
  );
}

function AssignModal({
  person,
  centres,
  subjects,
  pending,
  onClose,
  onSave,
}: {
  person: Person;
  centres: Array<{ id: string; name: string }>;
  subjects: Array<{ id: string; name: string }>;
  pending: boolean;
  onClose: () => void;
  onSave: (input: {
    profileId: string;
    role: MembershipRole;
    schoolIds: string[];
    subjectIds: string[];
  }) => void;
}) {
  const seededRole: MembershipRole = person.memberships.some((m) => m.role === 'coordinator')
    ? 'coordinator'
    : 'teacher';
  const [role, setRole] = useState<MembershipRole>(seededRole);
  const [schoolIds, setSchoolIds] = useState<Set<string>>(
    new Set(person.memberships.map((m) => m.schoolId)),
  );
  const [subjectIds, setSubjectIds] = useState<Set<string>>(
    new Set(person.memberships.map((m) => m.subjectId)),
  );

  function toggle(set: Set<string>, setter: (s: Set<string>) => void, id: string) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
  }

  const valid = schoolIds.size > 0 && subjectIds.size > 0;

  return (
    <Modal open onClose={onClose} title={`Permissions · ${person.name}`} width={500}>
      <p className="-mt-[8px] mb-[16px] text-[12.5px] text-[#7A7068]">
        Access is granted per (centre × subject) space. Saving sets exactly the selected pairs at
        the chosen role and removes any de-selected ones.
      </p>

      <FieldLabel>Role</FieldLabel>
      <div className="mb-[18px] inline-flex rounded-[9px] border border-[#DDD4C8] p-[3px]">
        {(['teacher', 'coordinator'] as const).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRole(r)}
            className={cn(
              'rounded-[7px] px-[14px] py-[6px] text-[12.5px] font-semibold capitalize transition-colors',
              role === r ? 'bg-[#E4F0ED] text-[#186155]' : 'text-[#7A7068]',
            )}
          >
            {r}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <FieldLabel>Centres</FieldLabel>
          <div className="space-y-[6px]">
            {centres.length === 0 ? (
              <p className="text-[12.5px] text-[#A79E94]">No active centres.</p>
            ) : (
              centres.map((c) => (
                <CheckboxRow
                  key={c.id}
                  checked={schoolIds.has(c.id)}
                  label={c.name}
                  onToggle={() => toggle(schoolIds, setSchoolIds, c.id)}
                />
              ))
            )}
          </div>
        </div>
        <div>
          <FieldLabel>Subjects</FieldLabel>
          <div className="space-y-[6px]">
            {subjects.length === 0 ? (
              <p className="text-[12.5px] text-[#A79E94]">No active subjects.</p>
            ) : (
              subjects.map((s) => (
                <CheckboxRow
                  key={s.id}
                  checked={subjectIds.has(s.id)}
                  label={s.name}
                  onToggle={() => toggle(subjectIds, setSubjectIds, s.id)}
                />
              ))
            )}
          </div>
        </div>
      </div>

      <div className="mt-[20px] flex items-center justify-end gap-3">
        <GhostButton onClick={onClose}>Cancel</GhostButton>
        <PrimaryButton
          disabled={pending || !valid}
          onClick={() =>
            onSave({
              profileId: person.profileId,
              role,
              schoolIds: [...schoolIds],
              subjectIds: [...subjectIds],
            })
          }
        >
          Save permissions
        </PrimaryButton>
      </div>
    </Modal>
  );
}

function CheckboxRow({
  checked,
  label,
  onToggle,
}: {
  checked: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center gap-[10px] rounded-[8px] px-[8px] py-[6px] text-left hover:bg-[#FBF8F3]"
    >
      <span
        className={cn(
          'inline-flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border-[1.5px]',
          checked ? 'border-[#1F7A6C] bg-[#1F7A6C]' : 'border-[#D8CFC2] bg-white',
        )}
      >
        {checked ? (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M20 6L9 17l-5-5" />
          </svg>
        ) : null}
      </span>
      <span className="text-[13.5px] font-medium text-[#2A2422]">{label}</span>
    </button>
  );
}

// ── Coordinator view ──────────────────────────────────────────────────────────

export function CoordinatorMembersTab({ spaces }: { spaces: CoordSpaceMembers[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        setError(res.error ?? 'Something went wrong.');
        return;
      }
      router.refresh();
    });
  }

  if (spaces.length === 0) {
    return (
      <SectionCard title="Members & roles">
        <EmptyState>You don’t coordinate any spaces.</EmptyState>
      </SectionCard>
    );
  }

  return (
    <div className="space-y-[18px]">
      {spaces.map((space) => (
        <SectionCard
          key={`${space.schoolId}:${space.subjectId}`}
          title={
            <span>
              {space.subjectName} at {space.schoolName}
              <span className="ml-2 text-[12.5px] font-medium text-[#A79E94]">
                · Your space · {space.members.length}{' '}
                {space.members.length === 1 ? 'member' : 'members'}
              </span>
            </span>
          }
        >
          <ConsoleTable
            head={
              <tr>
                <Th>Person</Th>
                <Th>Role</Th>
                <Th>Class</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            }
          >
            {space.members.map((m) => (
              <tr key={m.membershipId}>
                <Td>
                  <div className="flex items-center gap-[10px]">
                    <Avatar name={m.name} />
                    <span className="font-semibold text-[#2A2422]">
                      {m.name}
                      {m.isSelf ? (
                        <span className="ml-2 text-[11.5px] font-semibold text-[#A79E94]">You</span>
                      ) : null}
                    </span>
                  </div>
                </Td>
                <Td>
                  <RolePill kind={m.role} />
                </Td>
                <Td className="text-[#7A7068]">{m.homeClass ?? '—'}</Td>
                <Td className="text-right">
                  {m.isSelf ? (
                    <span className="text-[12.5px] text-[#A79E94]">—</span>
                  ) : (
                    <div className="flex items-center justify-end gap-3">
                      {m.role === 'teacher' ? (
                        <GhostButton
                          tone="teal"
                          disabled={pending}
                          onClick={() => run(() => coordPromoteMember({ membershipId: m.membershipId }))}
                        >
                          Promote to coordinator
                        </GhostButton>
                      ) : null}
                      <GhostButton
                        tone="red"
                        disabled={pending}
                        onClick={() => run(() => coordRemoveMember({ membershipId: m.membershipId }))}
                      >
                        Remove
                      </GhostButton>
                    </div>
                  )}
                </Td>
              </tr>
            ))}
          </ConsoleTable>
        </SectionCard>
      ))}
      <ErrorText>{error}</ErrorText>
      <p className="text-[12px] leading-relaxed text-[#A79E94]">
        To add a teacher who isn’t here yet, ask them to sign in and complete onboarding for this
        space, or have an admin assign them. Coordinators can’t browse the full people directory.
      </p>
    </div>
  );
}

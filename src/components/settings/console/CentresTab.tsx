'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { CentreRow } from '@/lib/console';
import {
  archiveCentre,
  createCentre,
  renameCentre,
  restoreCentre,
} from '@/lib/actions/console';
import {
  ConsoleTable,
  EmptyState,
  ErrorText,
  GhostButton,
  Modal,
  PinkField,
  PrimaryButton,
  SectionCard,
  StatusBadge,
  Td,
  Th,
} from './ui';

export function CentresTab({ centres }: { centres: CentreRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // New-centre inline form.
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRegion, setNewRegion] = useState('');

  // Inline rename.
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  // Archive dialog target.
  const [archiveTarget, setArchiveTarget] = useState<CentreRow | null>(null);

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

  const active = centres.filter((c) => !c.archivedAt);
  const archived = centres.filter((c) => c.archivedAt);

  return (
    <div className="space-y-[18px]">
      <SectionCard
        title="Centres"
        action={
          <PrimaryButton onClick={() => setAdding((v) => !v)}>
            {adding ? 'Close' : '＋ New centre'}
          </PrimaryButton>
        }
      >
        {adding ? (
          <div className="border-b border-[#F0EAE1] bg-[#FBF8F3] px-[18px] py-[16px]">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[200px] flex-1">
                <PinkField
                  value={newName}
                  onChange={setNewName}
                  placeholder="Centre name (required)"
                  aria-label="Centre name"
                  autoFocus
                />
              </div>
              <div className="min-w-[160px] flex-1">
                <PinkField
                  value={newRegion}
                  onChange={setNewRegion}
                  placeholder="Region (optional)"
                  aria-label="Region"
                />
              </div>
              <PrimaryButton
                disabled={pending || !newName.trim()}
                onClick={() =>
                  run(() => createCentre({ name: newName, region: newRegion }), () => {
                    setNewName('');
                    setNewRegion('');
                    setAdding(false);
                  })
                }
              >
                Create
              </PrimaryButton>
              <GhostButton onClick={() => setAdding(false)}>Cancel</GhostButton>
            </div>
          </div>
        ) : null}

        {centres.length === 0 ? (
          <EmptyState>No centres yet. Create the first one above.</EmptyState>
        ) : (
          <ConsoleTable
            head={
              <tr>
                <Th>Name</Th>
                <Th>Region</Th>
                <Th className="text-right">Classes</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            }
          >
            {[...active, ...archived].map((c) => {
              const isArchived = !!c.archivedAt;
              const editing = editId === c.id;
              return (
                <tr key={c.id} className={isArchived ? 'opacity-55' : undefined}>
                  <Td className="font-semibold text-[#2A2422]">
                    {editing ? (
                      <div className="max-w-[260px]">
                        <PinkField
                          value={editName}
                          onChange={setEditName}
                          aria-label="Centre name"
                          autoFocus
                          onEnter={() =>
                            run(() => renameCentre({ id: c.id, name: editName }), () =>
                              setEditId(null),
                            )
                          }
                        />
                      </div>
                    ) : (
                      c.name
                    )}
                  </Td>
                  <Td className="text-[#7A7068]">{c.region ?? '—'}</Td>
                  <Td className="text-right tabular-nums text-[#7A7068]">{c.activeClassCount}</Td>
                  <Td>
                    <StatusBadge archived={isArchived} />
                  </Td>
                  <Td className="text-right">
                    {editing ? (
                      <div className="flex items-center justify-end gap-3">
                        <GhostButton
                          tone="teal"
                          disabled={pending || !editName.trim()}
                          onClick={() =>
                            run(() => renameCentre({ id: c.id, name: editName }), () =>
                              setEditId(null),
                            )
                          }
                        >
                          Save
                        </GhostButton>
                        <GhostButton onClick={() => setEditId(null)}>Cancel</GhostButton>
                      </div>
                    ) : isArchived ? (
                      <GhostButton
                        tone="teal"
                        disabled={pending}
                        onClick={() => run(() => restoreCentre({ id: c.id }))}
                      >
                        Restore
                      </GhostButton>
                    ) : (
                      <div className="flex items-center justify-end gap-3">
                        <GhostButton
                          tone="teal"
                          onClick={() => {
                            setEditId(c.id);
                            setEditName(c.name);
                          }}
                        >
                          Rename
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
        <ErrorText>{error}</ErrorText>
      </SectionCard>

      {/* Archive dialog — blocked when active classes remain. */}
      <Modal
        open={!!archiveTarget}
        onClose={() => setArchiveTarget(null)}
        title={`Archive ${archiveTarget?.name ?? 'centre'}?`}
      >
        {archiveTarget && archiveTarget.activeClassCount > 0 ? (
          <>
            <p className="text-[13.5px] leading-relaxed text-[#7A7068]">
              {archiveTarget.activeClassCount}{' '}
              {archiveTarget.activeClassCount === 1 ? 'class' : 'classes'} still reference this
              centre. Reassign or archive those classes first.
            </p>
            <div className="mt-[18px] flex items-center justify-end gap-3">
              <GhostButton onClick={() => setArchiveTarget(null)}>Close</GhostButton>
              <button
                type="button"
                disabled
                className="cursor-not-allowed rounded-[9px] bg-[#E7DECF] px-[15px] py-[8px] text-[13px] font-semibold text-[#A79E94]"
              >
                Archive
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-[13.5px] leading-relaxed text-[#7A7068]">
              This centre will be hidden from planning. You can restore it at any time.
            </p>
            <div className="mt-[18px] flex items-center justify-end gap-3">
              <GhostButton onClick={() => setArchiveTarget(null)}>Cancel</GhostButton>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  run(() => archiveCentre({ id: archiveTarget!.id }), () => setArchiveTarget(null))
                }
                className="rounded-[9px] px-[15px] py-[8px] text-[13px] font-semibold text-white disabled:opacity-50"
                style={{ background: '#B0651E' }}
              >
                Archive centre
              </button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}

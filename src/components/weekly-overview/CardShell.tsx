import type { ReactNode } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/cn';
import { LinkPending } from '@/components/ui/LinkPending';

const BASE = 'block rounded-[12px] border border-border bg-surface px-[13px] py-[12px]';

/**
 * The flat lesson card surface shared by the Calendar and Status views — white,
 * 1px border, 12px radius, no shadow. A card with a plan links to the plan: the
 * editable wizard (`/plan/[id]`) when the viewer may edit it, otherwise the
 * read-only view (`/plan/[id]/view`) — a non-creator save would be rejected by
 * RLS. A "Not started" card (no plan id) is handled by the views themselves.
 */
export function CardShell({
  planId,
  canEdit = true,
  children,
}: {
  planId: string | null;
  /** Whether the viewer may edit this plan (creator / coordinator / admin). */
  canEdit?: boolean;
  children: ReactNode;
}) {
  if (!planId) {
    return <div className={BASE}>{children}</div>;
  }

  const href = canEdit ? `/plan/${planId}` : `/plan/${planId}/view`;

  return (
    <Link
      href={href}
      // The Status board makes this card a @dnd-kit draggable. Disabling the
      // browser's native link drag-and-drop keeps that pointer drag clean; a
      // plain click still navigates to the plan.
      draggable={false}
      className={cn(BASE, 'relative transition-colors hover:bg-surface-subtle')}
    >
      <LinkPending size={13} className="absolute right-[8px] top-[8px] text-teal" />
      {children}
    </Link>
  );
}

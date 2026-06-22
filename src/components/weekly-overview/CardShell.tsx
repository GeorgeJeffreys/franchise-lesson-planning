import type { ReactNode } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/cn';
import { LinkPending } from '@/components/ui/LinkPending';

const BASE = 'block rounded-[12px] border border-border bg-surface px-[13px] py-[12px]';

/**
 * The flat lesson card surface shared by the Calendar and Status views — white,
 * 1px border, 12px radius, no shadow. A card with a plan links to the editor and
 * shows an inline pending spinner; a "Not started" card (no plan id) is a plain,
 * non-interactive surface (the creation flow is not designed yet).
 */
export function CardShell({
  planId,
  children,
}: {
  planId: string | null;
  children: ReactNode;
}) {
  if (!planId) {
    return <div className={BASE}>{children}</div>;
  }

  return (
    <Link
      href={`/plan/${planId}`}
      // The Status board makes this card a @dnd-kit draggable. Disabling the
      // browser's native link drag-and-drop keeps that pointer drag clean; a
      // plain click still navigates to the editor (Change 1).
      draggable={false}
      className={cn(BASE, 'relative transition-colors hover:bg-surface-subtle')}
    >
      <LinkPending size={13} className="absolute right-[8px] top-[8px] text-teal" />
      {children}
    </Link>
  );
}

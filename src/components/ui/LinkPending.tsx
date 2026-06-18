'use client';

import { useLinkStatus } from 'next/link';
import { cn } from '@/lib/cn';
import { Spinner } from '@/components/ui/Spinner';

/**
 * Inline pending feedback for a `<Link>`: a small spinner that fades in while the
 * navigation triggered by its ancestor link is in flight (Next 16 `useLinkStatus`).
 * Must be rendered as a descendant of the `<Link>` it reports on. The element is
 * always mounted and toggles opacity so it never shifts layout.
 */
export function LinkPending({
  size = 14,
  className,
}: {
  size?: number;
  className?: string;
}) {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden
      className={cn(
        'pointer-events-none inline-flex transition-opacity duration-150',
        pending ? 'opacity-100' : 'opacity-0',
        className,
      )}
    >
      <Spinner size={size} />
    </span>
  );
}

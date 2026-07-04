import { cn } from '@/lib/cn';
import { STATUS_META } from '@/components/weekly-overview/status';
import type { SlotStatus } from '@/types/weekly-overview';

/**
 * The status dot — a small solid disc in the status's mid-tone dot colour, or a
 * hollow 1.5px ring for "Not started". Shared by the column headers and the status
 * pill so the two never drift. Purely decorative (the adjacent label carries the
 * meaning), so it's `aria-hidden`.
 */
export function StatusDot({ status, size = 8 }: { status: SlotStatus; size?: number }) {
  const meta = STATUS_META[status];
  return (
    <span
      aria-hidden
      className={cn(
        'inline-block flex-shrink-0 rounded-full',
        meta.hollow ? cn('border-[1.5px]', meta.dot) : meta.dot,
      )}
      style={{ width: size, height: size }}
    />
  );
}

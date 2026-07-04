import { useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';
import { STATUS_META } from '@/components/weekly-overview/status';
import { StatusDot } from '@/components/weekly-overview/StatusDot';
import type { SlotStatus } from '@/types/weekly-overview';

/**
 * The small pill that carries a slot's status at a glance — a mid-tone dot + label
 * in the status colour tokens. Flat (tint fill, no border, 6px radius) per the
 * grouped Status-board design.
 */
export function StatusChip({ status }: { status: SlotStatus }) {
  const t = useTranslations('board');
  const meta = STATUS_META[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-[5px] rounded-badge px-[8px] py-[3px] text-[10.5px] font-semibold',
        meta.badge,
      )}
    >
      <StatusDot status={status} size={6} />
      {t(`status.${status}`)}
    </span>
  );
}

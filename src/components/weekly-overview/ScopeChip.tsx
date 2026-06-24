import { cn } from '@/lib/cn';
import type { PlanScope } from '@/types/lesson';

/** Short label + tint per scope. */
const SCOPE_META: Record<PlanScope, { label: string; cls: string }> = {
  class: { label: 'Class', cls: 'text-status-progress bg-status-progress-bg' },
  centre: { label: 'Centre', cls: 'text-status-review bg-status-review-bg' },
  org: { label: 'All centres', cls: 'text-status-approved bg-status-approved-bg' },
};

/**
 * The small pill that marks a plan card's scope (Class / Centre / All centres) so
 * multiple plans on one curriculum slot are distinguishable by owner + scope.
 */
export function ScopeChip({ scope }: { scope: PlanScope }) {
  const meta = SCOPE_META[scope];
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-badge px-[7px] py-[2px] text-[10px] font-bold uppercase tracking-[0.03em]',
        meta.cls,
      )}
    >
      {meta.label}
    </span>
  );
}

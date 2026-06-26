import { useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';
import type { PlanScope } from '@/types/lesson';

/** Tint per scope (the label comes from the `board.scope.*` messages). */
const SCOPE_CLS: Record<PlanScope, string> = {
  class: 'text-status-progress bg-status-progress-bg',
  centre: 'text-status-review bg-status-review-bg',
  org: 'text-status-approved bg-status-approved-bg',
};

/**
 * The small pill that marks a plan card's scope (Class / Centre / All centres) so
 * multiple plans on one curriculum slot are distinguishable by owner + scope.
 */
export function ScopeChip({ scope }: { scope: PlanScope }) {
  const t = useTranslations('board');
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-badge px-[7px] py-[2px] text-[10px] font-bold uppercase tracking-[0.03em]',
        SCOPE_CLS[scope],
      )}
    >
      {t(`scope.${scope}`)}
    </span>
  );
}

import { AppShellSkeleton, Skeleton } from '@/components/ui/Skeleton';

/**
 * Instant fallback for the Weekly Overview while the server component fetches the
 * teacher's week. Mirrors the header + week-grid frame so navigation never feels
 * frozen. Prefetched by Next, so it appears immediately on navigation.
 */
export default function Loading() {
  return (
    <AppShellSkeleton>
      {/* Header: context + week nav + toggle */}
      <div className="flex flex-wrap items-center justify-between gap-5 border-b border-neutral-100 p-5">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-[16px] w-[90px]" />
          <Skeleton className="h-[13px] w-[200px]" />
        </div>
        <div className="flex items-center gap-4">
          <Skeleton className="h-8 w-[240px]" />
          <Skeleton className="h-8 w-[160px]" />
        </div>
      </div>

      {/* Week grid */}
      <div className="grid grid-cols-[150px_repeat(5,1fr)]">
        {Array.from({ length: 6 }).map((_, col) => (
          <div key={`h-${col}`} className="border-b border-neutral-100 bg-surface-subtle px-[14px] py-[11px]">
            <Skeleton className="h-[13px] w-[60px]" />
          </div>
        ))}
        {Array.from({ length: 18 }).map((_, i) => (
          <div key={`c-${i}`} className="border-b border-l border-neutral-100 p-[14px]">
            <Skeleton className="mb-2 h-[12px] w-[80%]" />
            <Skeleton className="h-[18px] w-[64px] rounded-badge" />
          </div>
        ))}
      </div>
    </AppShellSkeleton>
  );
}

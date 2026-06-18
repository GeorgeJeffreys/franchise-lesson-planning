import { AppShellSkeleton, Skeleton } from '@/components/ui/Skeleton';

/**
 * Instant fallback for the plan-creation bridge while the class context loads and
 * the existing-plan check runs. Mirrors the picker's header + two-column body so
 * navigation from an empty slot never feels frozen.
 */
export default function Loading() {
  return (
    <AppShellSkeleton>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-neutral-100 p-5">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-[16px] w-[120px]" />
          <Skeleton className="h-[13px] w-[220px]" />
        </div>
        <Skeleton className="h-8 w-[80px]" />
      </div>

      <div className="grid lg:grid-cols-[260px_1fr]">
        {/* Left rail: months / weeks */}
        <div className="flex flex-col gap-3 border-b border-neutral-100 p-4 lg:border-b-0 lg:border-r">
          <Skeleton className="h-[12px] w-[140px]" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex flex-wrap gap-1.5">
              <Skeleton className="h-[28px] w-[64px] rounded-badge" />
              <Skeleton className="h-[28px] w-[64px] rounded-badge" />
              <Skeleton className="h-[28px] w-[64px] rounded-badge" />
            </div>
          ))}
        </div>
        {/* Right panel */}
        <div className="flex flex-col gap-2 p-4">
          <Skeleton className="h-[14px] w-[180px]" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[72px] w-full rounded-md" />
          ))}
        </div>
      </div>
    </AppShellSkeleton>
  );
}

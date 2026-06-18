import { AppShellSkeleton, Skeleton } from '@/components/ui/Skeleton';

/**
 * Instant fallback for the lesson-plan editor while the plan, its class context,
 * curriculum target and activity bank load. Mirrors the editor's header + SMARTT
 * box + block columns so the page never appears frozen on navigation.
 */
export default function Loading() {
  return (
    <AppShellSkeleton>
      {/* Breadcrumb */}
      <Skeleton className="mb-4 h-[14px] w-[260px]" />

      {/* Header: context + actions */}
      <div className="flex flex-wrap items-start justify-between gap-5 px-[22px] pt-[22px]">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-[20px] w-[260px]" />
          <Skeleton className="h-[14px] w-[320px]" />
          <Skeleton className="h-[13px] w-[420px]" />
        </div>
        <div className="flex items-center gap-[10px]">
          <Skeleton className="h-[38px] w-[150px]" />
          <Skeleton className="h-[38px] w-[170px]" />
        </div>
      </div>

      {/* SMARTT objective box */}
      <div className="px-[22px]">
        <Skeleton className="mt-[18px] h-[120px] w-full rounded-lg" />
      </div>

      {/* Block list + panel */}
      <div className="mt-[18px] grid grid-cols-1 border-t border-border lg:grid-cols-[360px_1fr]">
        <div className="flex flex-col gap-2 border-r border-border p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[52px] w-full rounded-md" />
          ))}
        </div>
        <div className="flex flex-col gap-3 p-[22px]">
          <Skeleton className="h-[24px] w-[180px]" />
          <Skeleton className="h-[90px] w-full rounded-md" />
          <Skeleton className="h-[90px] w-full rounded-md" />
        </div>
      </div>
    </AppShellSkeleton>
  );
}

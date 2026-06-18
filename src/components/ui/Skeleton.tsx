import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** A single pulsing placeholder bar/box. Colour follows the warm neutral ramp. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse rounded-sm bg-neutral-100", className)} aria-hidden />
  );
}

/**
 * The app-shell chrome as a skeleton, matching AppShell's header so route-level
 * `loading.tsx` fallbacks show the same frame instantly while the page streams
 * in. The body is supplied per route.
 */
export function AppShellSkeleton({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex min-h-screen flex-col"
      role="status"
      aria-busy="true"
      aria-label="Loading"
    >
      <header className="border-b border-border bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 lg:px-10">
          <div className="flex items-center gap-3">
            <Skeleton className="h-[26px] w-[96px]" />
            <span className="h-[26px] w-px bg-neutral-300" />
            <Skeleton className="h-[14px] w-[120px]" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="size-[42px] rounded-full" />
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-[14px] w-[120px]" />
              <Skeleton className="h-[11px] w-[80px]" />
            </div>
          </div>
        </div>
      </header>
      <main className="flex-1 bg-surface">
        <div className="px-6 py-8 lg:px-10">{children}</div>
      </main>
    </div>
  );
}

/** A card-shaped surface to hold a route's body skeleton. */
export function SkeletonCard({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-card">
      {children}
    </div>
  );
}

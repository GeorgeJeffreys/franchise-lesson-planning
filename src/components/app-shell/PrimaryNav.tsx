'use client';

// The shell's primary navigation: Lesson Planning · Curriculum · Resources.
// Active state is teal text on a pale-teal pill (per the design); the active
// item is derived from the current route. Curriculum is in the nav but not yet
// designed, so it is present but inert.

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ACTIVE = 'bg-[#E4F0ED] font-semibold text-[#186155]';
const INACTIVE = 'font-medium text-neutral-900 hover:bg-surface-subtle';
const BASE = 'rounded-[9px] px-[14px] py-2 text-[13.5px] transition-colors';

export function PrimaryNav() {
  const pathname = usePathname();
  const onResources = pathname?.startsWith('/resources') ?? false;
  // Lesson Planning is the home/week + editor surface.
  const onPlanning = !onResources;

  return (
    <nav className="flex items-center gap-1" aria-label="Primary">
      <Link href="/" className={`${BASE} ${onPlanning ? ACTIVE : INACTIVE}`}>
        Lesson Planning
      </Link>
      <span
        className={`${BASE} cursor-not-allowed text-neutral-500`}
        aria-disabled="true"
        title="Not designed yet"
      >
        Curriculum
      </span>
      <Link href="/resources" className={`${BASE} ${onResources ? ACTIVE : INACTIVE}`}>
        Resources
      </Link>
    </nav>
  );
}

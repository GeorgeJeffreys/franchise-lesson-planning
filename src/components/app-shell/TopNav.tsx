'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';

type NavItem = {
  label: string;
  href: string;
  isActive: (p: string) => boolean;
};

/**
 * Primary navigation pills in the shared shell. The active item is derived from
 * the current pathname (teal text on a pale-teal pill). "Lesson Planning" also
 * owns the editor route (`/plan/...`); "Curriculum" is a placeholder stub for now.
 */
const ITEMS: NavItem[] = [
  { label: 'Lesson Planning', href: '/', isActive: (p) => p === '/' || p.startsWith('/plan') },
  { label: 'Curriculum', href: '/curriculum', isActive: (p) => p.startsWith('/curriculum') },
  { label: 'Resources', href: '/resources', isActive: (p) => p.startsWith('/resources') },
];

/**
 * The settings/console entry, shown to admins and coordinators (the people who
 * have console tabs beyond Profile). The route itself is role-aware at
 * `/settings`; this is presentation only. Everyone can still reach Settings via
 * the avatar menu.
 */
const SETTINGS_ITEM: NavItem = {
  label: 'Settings',
  href: '/settings',
  isActive: (p) => p.startsWith('/settings'),
};

export function TopNav({ showSettings = false }: { showSettings?: boolean }) {
  const pathname = usePathname();
  const items = showSettings ? [...ITEMS, SETTINGS_ITEM] : ITEMS;

  return (
    <nav className="flex items-center gap-1">
      {items.map((item) => {
        const active = item.isActive(pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'rounded-[9px] px-[14px] py-[8px] text-[13.5px] transition-colors',
              active
                ? 'bg-teal-tint font-semibold text-teal-deep'
                : 'font-medium text-neutral-900 hover:bg-surface-subtle',
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

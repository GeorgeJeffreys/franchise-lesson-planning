'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { PSEUDO_RTL_COOKIE } from '@/i18n/config';

/**
 * Dev-only "Force RTL" toggle. Sets/clears the `pseudo_rtl` cookie so the root
 * layout forces `dir="rtl"` while keeping English text — letting RTL be tested
 * before Arabic exists. Rendered only when `ENABLE_PSEUDO_RTL==='true'` (the
 * parent decides; this component assumes it should show). Also honours a
 * `?pseudoRtl=1` / `?pseudoRtl=0` query override on mount.
 *
 * Toggling hard-reloads because the `dir` attribute is computed server-side.
 */
function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  return document.cookie
    .split('; ')
    .find((entry) => entry.startsWith(`${name}=`))
    ?.split('=')[1];
}

function writePseudoRtl(on: boolean): void {
  document.cookie = on
    ? `${PSEUDO_RTL_COOKIE}=1; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`
    : `${PSEUDO_RTL_COOKIE}=; path=/; max-age=0; samesite=lax`;
}

export function ForceRtlToggle() {
  const t = useTranslations('nav');
  const [on, setOn] = useState(false);

  useEffect(() => {
    const cookieOn = readCookie(PSEUDO_RTL_COOKIE) === '1';
    const query = new URLSearchParams(window.location.search).get('pseudoRtl');
    if (query === '1' || query === '0') {
      const want = query === '1';
      if (want !== cookieOn) {
        writePseudoRtl(want);
        window.location.reload();
        return;
      }
    }
    setOn(cookieOn);
  }, []);

  function toggle() {
    writePseudoRtl(!on);
    window.location.reload();
  }

  return (
    <button
      type="button"
      role="menuitemcheckbox"
      aria-checked={on}
      onClick={toggle}
      className="flex w-full cursor-pointer items-center justify-between rounded-[8px] px-3 py-[9px] text-start text-[13px] text-neutral-700 hover:bg-surface-subtle"
    >
      <span>{t('forceRtlDev')}</span>
      <span
        aria-hidden
        className={`relative h-[18px] w-[32px] rounded-full transition-colors ${
          on ? 'bg-teal' : 'bg-neutral-200'
        }`}
      >
        <span
          className={`absolute top-[2px] size-[14px] rounded-full bg-white transition-[inset-inline-start] ${
            on ? 'start-[16px]' : 'start-[2px]'
          }`}
        />
      </span>
    </button>
  );
}

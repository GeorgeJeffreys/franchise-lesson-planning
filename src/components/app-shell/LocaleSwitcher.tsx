'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { setLocale } from '@/app/actions/locale';
import { enabledLocales, localeLabels, type Locale } from '@/i18n/config';

/**
 * The language switcher shown in the user menu. It lists only `enabledLocales`
 * (Arabic is switched on in its own branch). Selecting a locale persists the
 * `NEXT_LOCALE` cookie via the `setLocale` server action, then HARD-reloads the
 * page — the root layout derives `<html lang/dir>` server-side, and a soft
 * `router.refresh()` would not re-evaluate the `dir` attribute.
 */
export function LocaleSwitcher({ onSelect }: { onSelect?: () => void }) {
  const t = useTranslations('nav');
  const current = useLocale();
  const [pending, startTransition] = useTransition();

  function choose(locale: Locale) {
    if (locale === current) {
      onSelect?.();
      return;
    }
    startTransition(async () => {
      await setLocale(locale);
      window.location.reload();
    });
  }

  return (
    <div role="group" aria-label={t('language')} className="px-1 pb-1 pt-[6px]">
      <div className="px-2 pb-1 text-[10px] font-bold uppercase tracking-[0.06em] text-text-faint">
        {t('language')}
      </div>
      {enabledLocales.map((locale) => {
        const active = locale === current;
        return (
          <button
            key={locale}
            type="button"
            role="menuitemradio"
            aria-checked={active}
            disabled={pending}
            onClick={() => choose(locale)}
            className="flex w-full cursor-pointer items-center justify-between rounded-[8px] px-3 py-[9px] text-start text-[13px] text-neutral-900 hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span>{localeLabels[locale]}</span>
            {active ? (
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-teal"
                aria-hidden
              >
                <path d="M5 12l4 4 10-11" />
              </svg>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

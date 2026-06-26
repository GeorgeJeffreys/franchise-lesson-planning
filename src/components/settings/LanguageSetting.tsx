'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { setLocale } from '@/app/actions/locale';
import { cn } from '@/lib/cn';
import { enabledLocales, localeLabels, type Locale } from '@/i18n/config';

/**
 * The Settings → Profile "Language" row. Lists only `enabledLocales` (Arabic is
 * switched on in its own branch) and persists the choice through the SAME
 * `setLocale` server action the user-menu switcher uses — no new action. After
 * the cookie is written we HARD-reload so the root layout re-derives
 * `<html lang/dir>` (a soft `router.refresh()` would not re-evaluate `dir`).
 *
 * Endonyms come from `localeLabels` and are intentionally NOT translated — a
 * language always names itself in its own script.
 */
export function LanguageSetting() {
  const t = useTranslations('settings');
  const current = useLocale();
  const [pending, startTransition] = useTransition();

  function choose(locale: Locale) {
    if (locale === current) return;
    startTransition(async () => {
      await setLocale(locale);
      window.location.reload();
    });
  }

  return (
    <div className="mt-[26px] border-t border-[#F0EAE1] pt-5">
      <div className="mb-[11px] text-[11.5px] font-bold uppercase tracking-[0.05em] text-text-faint">
        {t('language.label')}
      </div>
      <div role="radiogroup" aria-label={t('language.label')} className="flex flex-wrap gap-2">
        {enabledLocales.map((locale) => {
          const active = locale === current;
          return (
            <button
              key={locale}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={pending}
              onClick={() => choose(locale)}
              className={cn(
                'rounded-[10px] border-[1.5px] px-4 py-[9px] text-[13px] transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                active
                  ? 'border-teal bg-teal font-semibold text-white'
                  : 'border-[#E0D6C7] bg-surface font-medium text-neutral-900 hover:bg-surface-subtle',
              )}
            >
              {localeLabels[locale]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

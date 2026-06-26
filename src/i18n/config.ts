/**
 * i18n configuration — the single source of truth for locales.
 *
 * Source of locale is the `NEXT_LOCALE` cookie (no URL prefix, no next-intl
 * routing middleware). `en` is the default and fallback. `ar` exists in the
 * codebase (message mirrors, RTL plumbing, font) but is only *offered* to users
 * once it appears in `enabledLocales` — that switch is flipped in its own branch.
 */

export const locales = ['en', 'ar'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en';

/**
 * Locales the language switcher actually offers. Arabic ships dormant until its
 * own branch turns it on here, so the switcher renders only what's enabled.
 */
export const enabledLocales: readonly Locale[] = ['en'];

/** The cookie carrying the active locale. Read in `i18n/request.ts`. */
export const LOCALE_COOKIE = 'NEXT_LOCALE';

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (locales as readonly string[]).includes(value);
}

/** Text direction for a locale. Arabic is RTL; everything else LTR. */
export function dirForLocale(locale: string): 'rtl' | 'ltr' {
  return locale === 'ar' ? 'rtl' : 'ltr';
}

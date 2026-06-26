/**
 * Locale configuration for the app's i18n foundation.
 *
 * Locale is carried in the `NEXT_LOCALE` cookie — there is NO URL prefix and no
 * next-intl routing middleware (the only middleware, `src/proxy.ts`, stays the
 * Supabase/SSO session refresher and is not touched here).
 */

/** Every locale that has a message catalog under `messages/<locale>/`. */
export const locales = ['en', 'ar'] as const;
export type Locale = (typeof locales)[number];

/** The fallback locale, used when no (or an unknown) cookie is present. */
export const defaultLocale: Locale = 'en';

/**
 * Locales a user can actually switch to from the UI. Arabic ships *disabled*
 * here and is switched on in its own branch; its catalog already loads if the
 * cookie is set manually (or via pseudo-RTL), so the rollout can be staged. The
 * language switcher renders only these.
 */
export const enabledLocales: readonly Locale[] = ['en'];

/**
 * Endonyms for the switcher. A language always names itself in its own script,
 * so these are intentionally NOT part of the translatable message catalog.
 */
export const localeLabels: Record<Locale, string> = {
  en: 'English',
  ar: 'العربية',
};

/** Cookie names owned by the i18n layer. */
export const LOCALE_COOKIE = 'NEXT_LOCALE';
export const PSEUDO_RTL_COOKIE = 'pseudo_rtl';

/** Narrow an arbitrary cookie value to a known {@link Locale}. */
export function isLocale(value: string | undefined | null): value is Locale {
  return value != null && (locales as readonly string[]).includes(value);
}

/** Whether a locale reads right-to-left. */
export function isRtl(locale: Locale): boolean {
  return locale === 'ar';
}

/** The `dir` attribute for a locale. */
export function dirFor(locale: Locale): 'rtl' | 'ltr' {
  return isRtl(locale) ? 'rtl' : 'ltr';
}

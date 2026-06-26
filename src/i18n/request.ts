import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { defaultLocale, isLocale, LOCALE_COOKIE, type Locale } from './config';
import { loadMessages } from './messages';

/**
 * next-intl request configuration. The active locale comes from the
 * `NEXT_LOCALE` cookie (no URL prefix, no routing middleware); an absent or
 * unknown value falls back to {@link defaultLocale}. Messages are deep-merged
 * from every `messages/<locale>/*.json` namespace.
 */
export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;
  const locale: Locale = isLocale(cookieLocale) ? cookieLocale : defaultLocale;

  return {
    locale,
    messages: loadMessages(locale),
  };
});

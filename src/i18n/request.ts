import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';

import { defaultLocale, isLocale, LOCALE_COOKIE } from './config';
import { loadMessages } from './messages';

/**
 * Per-request i18n config. The active locale comes from the `NEXT_LOCALE`
 * cookie (set by the language switcher's server action); anything missing or
 * unrecognised falls back to the default. No URL prefix, no routing middleware —
 * locale lives entirely in the cookie, independent of `src/proxy.ts`.
 */
export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(cookieValue) ? cookieValue : defaultLocale;

  return {
    locale,
    messages: await loadMessages(locale),
  };
});

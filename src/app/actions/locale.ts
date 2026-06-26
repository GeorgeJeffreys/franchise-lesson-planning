'use server';

import { cookies } from 'next/headers';
import { isLocale, LOCALE_COOKIE, type Locale } from '@/i18n/config';

/**
 * Persist the chosen UI locale in the `NEXT_LOCALE` cookie. The client triggers a
 * hard reload afterwards so the root layout re-computes `<html lang/dir>` from
 * the new cookie. No URL prefix and no routing middleware are involved.
 */
export async function setLocale(locale: Locale): Promise<void> {
  if (!isLocale(locale)) return;
  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // one year
    sameSite: 'lax',
  });
}

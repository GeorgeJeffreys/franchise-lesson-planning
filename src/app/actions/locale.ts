'use server';

import { cookies } from 'next/headers';

import { isLocale, LOCALE_COOKIE } from '@/i18n/config';

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/**
 * Persist the user's chosen UI locale in the `NEXT_LOCALE` cookie. Read back by
 * `i18n/request.ts` on the next request. The caller hard-reloads afterwards so
 * the root layout re-evaluates `<html lang>`/`dir`. Unknown values are ignored.
 */
export async function setLocale(locale: string): Promise<void> {
  if (!isLocale(locale)) return;

  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: ONE_YEAR_SECONDS,
    sameSite: 'lax',
  });
}

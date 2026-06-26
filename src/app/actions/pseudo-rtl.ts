'use server';

import { cookies } from 'next/headers';

import { isPseudoRtlEnabled, PSEUDO_RTL_COOKIE } from '@/i18n/pseudo-rtl';

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/**
 * Dev-only: force RTL layout while staying in English, to test mirroring before
 * Arabic exists. Writes/clears the `pseudo_rtl` cookie, which the root layout
 * reads to force `dir="rtl"` with `lang="en"`. No-op unless ENABLE_PSEUDO_RTL is
 * set, so it can never take effect in an environment that hasn't opted in.
 */
export async function setPseudoRtl(on: boolean): Promise<void> {
  if (!isPseudoRtlEnabled()) return;

  const cookieStore = await cookies();
  if (on) {
    cookieStore.set(PSEUDO_RTL_COOKIE, '1', {
      path: '/',
      maxAge: ONE_YEAR_SECONDS,
      sameSite: 'lax',
    });
  } else {
    cookieStore.delete(PSEUDO_RTL_COOKIE);
  }
}

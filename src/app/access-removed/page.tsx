'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { Logo } from '@/components/ui/Logo';

/**
 * The front-door block for a deactivated user (see src/lib/supabase/proxy.ts).
 * A deactivated user is redirected here; the page clears their session in the
 * browser (belt-and-braces with the server-side auth.sessions revocation in
 * set_user_deactivated) and shows a clean "access removed" state. It lives on
 * the public path surface so it renders whether or not a session still exists.
 */
export default function AccessRemovedPage() {
  const t = useTranslations('accessRemoved');

  useEffect(() => {
    // Best-effort local sign-out so the stale cookie is cleared client-side too.
    createClient()
      .auth.signOut()
      .catch(() => {});
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center p-5 sm:p-10">
      <div className="w-full max-w-[520px] rounded-lg border border-border bg-surface p-10 text-center shadow-card sm:p-12">
        <div className="mb-8 flex justify-center">
          <Logo size="md" />
        </div>
        <div className="mb-[18px] inline-flex size-[44px] items-center justify-center rounded-[12px] bg-danger-bg">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#B23A2E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M18.36 6.64a9 9 0 1 1-12.73 0M12 2v10" />
          </svg>
        </div>
        <h1 className="m-0 text-[22px] font-semibold text-ink">{t('title')}</h1>
        <p className="mx-auto mt-3 mb-[26px] max-w-[420px] text-[14px] leading-[1.6] text-text-muted">
          {t('body')}
        </p>
        <Link
          href="/login"
          className="inline-flex items-center justify-center rounded-[9px] bg-teal px-[18px] py-[10px] text-[13.5px] font-semibold text-white transition-colors hover:bg-[#1a6a5d]"
        >
          {t('backToSignIn')}
        </Link>
      </div>
    </main>
  );
}

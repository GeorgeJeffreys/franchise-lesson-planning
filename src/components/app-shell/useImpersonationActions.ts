'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

/**
 * The single client-side implementation of the impersonation POST used by the
 * TEST MODE banner (role switches + Return) and the account menu (Return). Both
 * consumers share this one handler so the "Return to my account" logic is never
 * forked: it always hits `POST /api/test-impersonate` and, on success, refreshes
 * in place (or follows the clean session-expired `redirectTo` fallback) so server
 * components re-read the swapped session and RLS-scoped data re-loads.
 *
 * The route replies `{ ok:false, stage, message }` with a secret-free reason on
 * failure; `error` surfaces it for callers that render one (the banner). Callers
 * that don't (the menu item) simply ignore it.
 */
export function useImpersonationActions() {
  const router = useRouter();
  const t = useTranslations('testBar');
  const [isPending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function post(payload: Record<string, unknown>) {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/test-impersonate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        // The route returns { ok:false, stage, message } with a secret-free
        // reason; surface it so failures are diagnosable. Fall back if absent.
        let detail = t('switchFailed');
        try {
          const data = (await res.json()) as { stage?: unknown; message?: unknown };
          if (typeof data?.stage === 'string' && typeof data?.message === 'string') {
            detail = `${data.stage}: ${data.message}`;
          }
        } catch {
          // Non-JSON body; keep the generic message.
        }
        setError(detail);
        setBusy(false);
        return;
      }
      // A clean fallback (e.g. the real session expired while impersonating) asks
      // us to send the user to normal login rather than surfacing an error.
      let redirectTo: string | null = null;
      try {
        const data = (await res.json()) as { redirectTo?: unknown };
        if (typeof data?.redirectTo === 'string') redirectTo = data.redirectTo;
      } catch {
        // No / non-JSON body — just refresh in place.
      }
      // Cookies are now swapped; refresh so server components re-read the session
      // and RLS-scoped data re-loads as the new user (or go to login on fallback).
      startTransition(() => {
        if (redirectTo) router.push(redirectTo);
        else router.refresh();
        setBusy(false);
      });
    } catch {
      setError(t('switchFailed'));
      setBusy(false);
    }
  }

  /** Restore the real account — the shared Return action (banner + menu). */
  function returnToAccount() {
    return post({ action: 'return' });
  }

  return { post, returnToAccount, busy: isPending || busy, error };
}

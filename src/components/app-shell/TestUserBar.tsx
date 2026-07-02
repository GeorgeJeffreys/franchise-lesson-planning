'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';
import type { Persona, TestRole } from '@/lib/test-roles';

type TestUserBarProps = {
  /** Whether a real session is stashed (we are currently viewing-as). */
  impersonating: boolean;
  /** The persona currently being viewed, when impersonating. */
  currentPersona: Persona | null;
  /** The caller-scoped personas the picker may offer (client-safe, no emails). */
  personas: Persona[];
};

/**
 * Dev/preview-only TEST MODE bar. Lets an eligible tester step into one of the
 * dedicated per-tester personas surfaced by the server — a faithful, RLS-scoped
 * impersonation, not a cosmetic toggle: each switch swaps the real Supabase
 * session server-side, then we refresh so data re-loads as that persona (and any
 * plan the persona creates/edits is owned by the persona, under per-teacher
 * ownership).
 *
 * It only ever sends a persona UID to `POST /api/test-impersonate`; the server
 * re-validates it against the caller-scoped, is_test_persona-only list and maps it
 * to a sign-in email server-side. Whether this renders at all, and which personas
 * it may offer, is decided server-side (see getImpersonationState); it is never
 * shown in production for real users.
 *
 * Colour is semantic: cream surface + pink TEST MODE marker so it reads as an
 * unmistakable, not-normal-chrome affordance; teal for the switch action.
 */
export function TestUserBar({ impersonating, currentPersona, personas }: TestUserBarProps) {
  const router = useRouter();
  const t = useTranslations('testBar');
  const [isPending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const roleLabels: Record<TestRole, string> = {
    teacher: t('roleTeacher'),
    coordinator: t('roleCoordinator'),
    admin: t('roleAdmin'),
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return personas;
    return personas.filter((p) =>
      [p.name, roleLabels[p.role], p.centre ?? ''].join(' ').toLowerCase().includes(q),
    );
    // roleLabels is derived from stable translations; personas + query drive this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personas, query]);

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
      setOpen(false);
      setQuery('');
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

  const viewing = impersonating && currentPersona ? currentPersona.name : t('yourAccount');
  const disabled = isPending || busy;

  // The picker is a lightweight dropdown; blur-close is debounced so a click on an
  // option (which blurs the trigger) still registers before the panel unmounts.
  function scheduleClose() {
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  }
  function cancelClose() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }

  return (
    <div className="sticky top-0 z-[60] flex h-10 items-center gap-3 border-b border-pink/40 bg-surface-cream px-[30px] text-[12.5px]">
      <span className="inline-flex items-center gap-1.5 rounded-badge bg-pink px-2 py-[3px] text-[11px] font-semibold uppercase tracking-[0.1em] text-white">
        <span className="size-[6px] rounded-full bg-white/90" aria-hidden />
        {t('testMode')}
      </span>

      <span className="text-neutral-700">
        {t('viewingAs')}{' '}
        <span className="font-semibold text-ink" dir="auto">
          {viewing}
        </span>
      </span>

      <div
        className="relative ml-auto flex items-center gap-1.5"
        onBlur={scheduleClose}
        onFocus={cancelClose}
      >
        <button
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className={cn(
            'rounded-sm border px-[10px] py-[4px] font-semibold transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40 focus-visible:ring-offset-1',
            'disabled:cursor-not-allowed disabled:opacity-60',
            'border-teal/40 bg-surface text-teal hover:bg-teal-tint',
          )}
        >
          {t('switchPersona')}
        </button>

        {open ? (
          <div
            role="listbox"
            className="absolute end-0 top-[calc(100%+6px)] z-[70] max-h-[320px] w-[300px] overflow-auto rounded-md border border-border-strong bg-surface p-1.5 shadow-lg"
          >
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('searchPlaceholder')}
              dir="auto"
              className="mb-1.5 w-full rounded-sm border border-border bg-surface px-2 py-1.5 text-[12.5px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40"
            />
            {filtered.length === 0 ? (
              <p className="px-2 py-2 text-neutral-500">{t('noPersonas')}</p>
            ) : (
              <ul className="flex flex-col">
                {filtered.map((p) => {
                  const active = impersonating && currentPersona?.id === p.id;
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={active}
                        disabled={disabled}
                        onClick={() => post({ personaId: p.id })}
                        className={cn(
                          'flex w-full flex-col items-start gap-0.5 rounded-sm px-2 py-1.5 text-start transition-colors',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40',
                          'disabled:cursor-not-allowed disabled:opacity-60',
                          active ? 'bg-teal text-white' : 'hover:bg-teal-tint',
                        )}
                      >
                        <span className="font-semibold" dir="auto">
                          {p.name}
                        </span>
                        <span
                          className={cn(
                            'text-[11px]',
                            active ? 'text-white/80' : 'text-neutral-500',
                          )}
                          dir="auto"
                        >
                          {[roleLabels[p.role], p.centre ?? t('noCentre')].join(' · ')}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : null}

        {impersonating ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => post({ action: 'return' })}
            className={cn(
              'ml-1.5 rounded-sm border border-border-strong bg-surface px-[10px] py-[4px] font-semibold text-neutral-800 transition-colors',
              'hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40 focus-visible:ring-offset-1',
              'disabled:cursor-not-allowed disabled:opacity-60',
            )}
          >
            {t('returnToAccount')}
          </button>
        ) : null}

        {error ? <span className="ml-2 font-medium text-pink">{error}</span> : null}
      </div>
    </div>
  );
}

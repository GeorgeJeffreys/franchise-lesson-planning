'use client';

import { useEffect } from 'react';

import { setPseudoRtl } from '@/app/actions/pseudo-rtl';

/**
 * Reconciles the `?pseudoRtl=1` (or `=0`) URL convenience into the `pseudo_rtl`
 * cookie, then hard-reloads so the root layout re-evaluates `<html dir>`. Only
 * mounted when the dev flag is enabled. `active` is the current cookie state
 * (server-rendered) — if the URL already matches it, nothing happens, so there's
 * no reload loop.
 */
export function PseudoRtlSync({ active }: { active: boolean }) {
  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get('pseudoRtl');
    if (param == null) return;
    const desired = param === '1';
    if (desired === active) return;
    void setPseudoRtl(desired).then(() => window.location.reload());
  }, [active]);

  return null;
}

/**
 * Pseudo-RTL dev toggle — shared constants + flag check.
 *
 * When ENABLE_PSEUDO_RTL is set, the app can be forced into RTL while staying in
 * English (`lang="en"`, `dir="rtl"`), so the shell and shared primitives can be
 * mirror-tested before Arabic exists. The flag — NOT NODE_ENV — gates this,
 * because production doubles as the test environment.
 */

export const PSEUDO_RTL_COOKIE = 'pseudo_rtl';

/** Server-only: whether the pseudo-RTL dev toggle is available in this env. */
export function isPseudoRtlEnabled(): boolean {
  return process.env.ENABLE_PSEUDO_RTL === 'true';
}

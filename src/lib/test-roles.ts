/**
 * Client-safe role keys for the test-user impersonation feature. These are just
 * the public role identifiers (no UIDs, no env, no secrets), so this module is
 * safe to import from the browser bar component. The server-only gates and the
 * role→UID map live in `@/lib/test-impersonation`.
 */

/** The three impersonatable role keys. The client only ever sends one of these. */
export const TEST_ROLES = ['teacher', 'coordinator', 'admin'] as const;
export type TestRole = (typeof TEST_ROLES)[number];

export function isTestRole(value: unknown): value is TestRole {
  return typeof value === 'string' && (TEST_ROLES as readonly string[]).includes(value);
}

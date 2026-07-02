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

/**
 * A persona the tester may step into, as rendered in the picker. Client-safe: it
 * carries NO email or credential — only the display fields plus the uid the client
 * sends back on switch. The server maps the uid to a sign-in email (see
 * `@/lib/test-impersonation`). Lives here so both the server module and the client
 * bar can share the type without the bar importing server-only code.
 */
export interface Persona {
  /** The persona's auth uid — the only thing the client sends back on switch. */
  id: string;
  /** Display name (full name, or email as a fallback resolved server-side). */
  name: string;
  /** The persona's global role, for the "name · role · centre" line. */
  role: TestRole;
  /** A representative centre name for display, or null. */
  centre: string | null;
}

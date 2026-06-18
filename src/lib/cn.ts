/**
 * Minimal className joiner — drops falsy values and joins with spaces. Kept
 * dependency-free (no clsx/tailwind-merge yet) since the primitive set is small.
 */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

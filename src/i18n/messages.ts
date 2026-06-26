import 'server-only';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { defaultLocale, type Locale } from './config';

/**
 * Per-namespace message loading.
 *
 * Every `messages/<locale>/*.json` file is read and deep-merged into one object,
 * so each surface owns its OWN `messages/<locale>/<surface>.json` and parallel
 * branches never edit each other's catalogs (no shared file to conflict on). The
 * files are read from disk at request time; `next.config.ts` traces
 * `messages/**` into the deployed bundle so this works in production too.
 *
 * Convention: each file is keyed by its namespace, e.g. `nav.json` contains
 * `{ "nav": { … } }`, and `useTranslations('nav')` reads it.
 */

export type Messages = Record<string, unknown>;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Recursively merge `source` onto `target`, mutating and returning `target`. */
function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> {
  for (const [key, value] of Object.entries(source)) {
    const existing = target[key];
    if (isPlainObject(existing) && isPlainObject(value)) {
      deepMerge(existing, value);
    } else {
      target[key] = value;
    }
  }
  return target;
}

/** Read and merge every namespace JSON for one locale. Missing dir → `{}`. */
function readLocaleDir(locale: Locale): Messages {
  const dir = join(process.cwd(), 'messages', locale);
  let files: string[];
  try {
    files = readdirSync(dir)
      .filter((name) => name.endsWith('.json'))
      .sort();
  } catch {
    return {};
  }

  const merged: Messages = {};
  for (const file of files) {
    const raw = readFileSync(join(dir, file), 'utf8');
    deepMerge(merged, JSON.parse(raw) as Record<string, unknown>);
  }
  return merged;
}

// Disk reads are cached in production (catalogs are static there); in dev the
// cache is skipped so edited JSON shows up on the next request without a restart.
const cache = new Map<Locale, Messages>();
const useCache = process.env.NODE_ENV === 'production';

/**
 * Load the merged messages for a locale. A non-default locale is layered on top
 * of the default catalog, so any namespace or key it is missing falls back to
 * the default rather than surfacing a raw key.
 */
export function loadMessages(locale: Locale): Messages {
  if (useCache) {
    const hit = cache.get(locale);
    if (hit) return hit;
  }

  const own = readLocaleDir(locale);
  const result =
    locale === defaultLocale ? own : deepMerge(readLocaleDir(defaultLocale), own);

  if (useCache) cache.set(locale, result);
  return result;
}

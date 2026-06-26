import { promises as fs } from 'fs';
import path from 'path';

import { defaultLocale, type Locale } from './config';

type Messages = Record<string, unknown>;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Recursively merge `source` into `target`. Nested objects merge key-by-key so
 * two namespace files contributing to the same top-level namespace combine
 * rather than clobber. Leaf values from `source` win.
 */
function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(source)) {
    const existing = target[key];
    if (isPlainObject(existing) && isPlainObject(value)) {
      deepMerge(existing, value);
    } else {
      target[key] = value;
    }
  }
}

/**
 * Load and deep-merge every `messages/<locale>/*.json` file into one object.
 *
 * Per-namespace files (e.g. `common.json`, `nav.json`) are discovered from the
 * filesystem at request time, so each surface adds its OWN message file without
 * editing a shared registry — branches never collide in one giant JSON. Each
 * file is shaped `{ "<namespace>": { ...keys } }`; deep-merging keeps namespaces
 * separate while tolerating two files extending the same namespace.
 *
 * The `messages/` directory is shipped to the serverless bundle via
 * `outputFileTracingIncludes` in `next.config.ts`.
 */
export async function loadMessages(locale: Locale): Promise<Messages> {
  const merged: Messages = {};
  for (const loc of locale === defaultLocale ? [defaultLocale] : [defaultLocale, locale]) {
    const dir = path.join(process.cwd(), 'messages', loc);
    let files: string[];
    try {
      files = await fs.readdir(dir);
    } catch {
      continue;
    }
    for (const file of files.filter((f) => f.endsWith('.json')).sort()) {
      const raw = await fs.readFile(path.join(dir, file), 'utf-8');
      deepMerge(merged, JSON.parse(raw) as Record<string, unknown>);
    }
  }
  return merged;
}

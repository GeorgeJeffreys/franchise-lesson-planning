// Client-safe, dependency-free fuzzy matcher for the Curriculum Search tab.
//
// The corpus is small (≤~1,240 rows/subject) and loaded once, so matching is a plain
// in-memory scan — no index, no server round-trip. Two concerns live here so they stay
// consistent and testable in isolation from React:
//   1. TYPO-TOLERANT matching — normalise (Latin diacritics + Arabic letter folding),
//      tokenise, and match each query token against a field's tokens by exact / prefix /
//      substring / bounded-edit-distance, so "listning" still finds "listening".
//   2. HIGHLIGHTING — map normalised match ranges back to ORIGINAL string offsets so the
//      UI can wrap the actually-typed substring, diacritics and Arabic forms intact.
//
// Nothing here is server-only or English-specific: it runs the same over Arabic outcome
// text (RTL) as over English, and over any subject's rows.

/**
 * Normalise ONE source character to its match form (possibly empty). Latin letters are
 * lower-cased and stripped of combining diacritics (é → e); Arabic letters are folded to
 * a canonical form (أإآ → ا, ى → ي, ة → ه) with tashkeel and tatweel removed, so a
 * search ignores harakat and hamza/alef spelling variants the same way it ignores accents.
 */
function normalizeChar(ch: string): string {
  const folded = ch
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '') // combining marks (Latin accents + Arabic harakat)
    .replace(/ـ/g, '') // tatweel (Arabic kashida)
    .replace(/[ى]/g, 'ي') // alef maksura → ya
    .replace(/[ة]/g, 'ه'); // ta marbuta → ha
  return folded;
}

/** Normalise a whole string for matching (see `normalizeChar`). */
export function normalizeText(s: string): string {
  let out = '';
  for (const ch of s) out += normalizeChar(ch);
  return out;
}

/** Split a normalised string into alphanumeric word tokens (Unicode-aware). */
export function tokenize(s: string): string[] {
  const norm = normalizeText(s);
  return norm.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

/**
 * Bounded Levenshtein distance between two already-normalised tokens. Returns a value
 * `> max` (not the true distance) as soon as it's certain the distance exceeds `max`, so
 * the common "no match" case bails cheaply.
 */
export function boundedLevenshtein(a: string, b: string, max: number): number {
  if (a === b) return 0;
  const al = a.length;
  const bl = b.length;
  if (Math.abs(al - bl) > max) return max + 1;
  if (al === 0) return bl;
  if (bl === 0) return al;

  let prev = new Array<number>(bl + 1);
  let curr = new Array<number>(bl + 1);
  for (let j = 0; j <= bl; j += 1) prev[j] = j;

  for (let i = 1; i <= al; i += 1) {
    curr[0] = i;
    let rowMin = curr[0];
    const ac = a.charCodeAt(i - 1);
    for (let j = 1; j <= bl; j += 1) {
      const cost = ac === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > max) return max + 1; // whole row already over budget
    [prev, curr] = [curr, prev];
  }
  return prev[bl];
}

/** Typo budget for a query token — longer tokens tolerate more edits. */
function fuzzyBudget(len: number): number {
  if (len <= 3) return 0;
  if (len <= 6) return 1;
  return 2;
}

/** How strongly a single query token matches a single field token. 0 = no match. */
function tokenScore(queryTok: string, fieldTok: string): number {
  if (fieldTok === queryTok) return 4;
  if (fieldTok.startsWith(queryTok)) return 3; // prefix — handles mid-typing
  if (queryTok.length >= 3 && fieldTok.includes(queryTok)) return 2;
  const budget = fuzzyBudget(queryTok.length);
  if (budget > 0 && boundedLevenshtein(queryTok, fieldTok, budget) <= budget) return 1;
  return 0;
}

/** A searchable field with its relative weight (daily outcome dominates). */
export interface WeightedField {
  tokens: string[];
  weight: number;
}

/**
 * Score a record's fields against the query tokens. AND semantics: EVERY query token must
 * match at least one field token somewhere, else the record is not a hit (returns null).
 * The score sums each query token's best weighted field match, so exact hits in the daily
 * outcome rank above fuzzy hits in a chip.
 */
export function scoreFields(fields: WeightedField[], queryTokens: string[]): number | null {
  if (queryTokens.length === 0) return 0;
  let total = 0;
  for (const qt of queryTokens) {
    let best = 0;
    for (const field of fields) {
      for (const ft of field.tokens) {
        const s = tokenScore(qt, ft) * field.weight;
        if (s > best) best = s;
      }
    }
    if (best === 0) return null; // this query token matched nothing → not a hit
    total += best;
  }
  return total;
}

// ── Highlighting ────────────────────────────────────────────────────────────────────

/** One run of the original text, flagged as a search hit or not. */
export interface HighlightSegment {
  text: string;
  hit: boolean;
}

interface NormMap {
  norm: string;
  /** `map[i]` = index in the ORIGINAL string of the char that produced `norm[i]`. */
  map: number[];
}

/** Build the normalised string alongside a per-char map back to original offsets. */
function buildNormMap(text: string): NormMap {
  let norm = '';
  const map: number[] = [];
  let originalIndex = 0;
  for (const ch of text) {
    const n = normalizeChar(ch);
    for (let k = 0; k < n.length; k += 1) map.push(originalIndex);
    norm += n;
    originalIndex += ch.length; // surrogate-pair safe (iterating code points)
  }
  return { norm, map };
}

/**
 * Split `text` into highlight segments, marking every occurrence of any query token
 * (matched in NORMALISED space, so accents/harakat differences still highlight). Only
 * exact/substring occurrences are highlighted; a purely fuzzy (typo) hit yields no
 * highlight but the row still shows — an intentional, honest treatment.
 */
export function highlightSegments(text: string, queryTokens: string[]): HighlightSegment[] {
  const tokens = queryTokens.filter((t) => t.length >= 2);
  if (!text || tokens.length === 0) return [{ text, hit: false }];

  const { norm, map } = buildNormMap(text);
  // Collect [start, end) ranges in ORIGINAL offsets for every token occurrence.
  const ranges: Array<[number, number]> = [];
  for (const tok of tokens) {
    let from = 0;
    for (;;) {
      const idx = norm.indexOf(tok, from);
      if (idx === -1) break;
      const startOrig = map[idx];
      const lastNorm = idx + tok.length - 1;
      const endOrig = map[lastNorm] + charLenAt(text, map[lastNorm]);
      ranges.push([startOrig, endOrig]);
      from = idx + tok.length;
    }
  }
  if (ranges.length === 0) return [{ text, hit: false }];

  // Merge overlapping/adjacent ranges, then emit alternating plain/hit segments.
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([r[0], r[1]]);
  }

  const segments: HighlightSegment[] = [];
  let cursor = 0;
  for (const [start, end] of merged) {
    if (start > cursor) segments.push({ text: text.slice(cursor, start), hit: false });
    segments.push({ text: text.slice(start, end), hit: true });
    cursor = end;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), hit: false });
  return segments;
}

/** UTF-16 length of the code point starting at `i` (1 or 2), for original-offset math. */
function charLenAt(text: string, i: number): number {
  const code = text.charCodeAt(i);
  return code >= 0xd800 && code <= 0xdbff ? 2 : 1;
}

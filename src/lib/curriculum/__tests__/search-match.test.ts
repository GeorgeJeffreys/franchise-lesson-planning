import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  boundedLevenshtein,
  highlightSegments,
  normalizeText,
  scoreFields,
  tokenize,
  type WeightedField,
} from '../search-match.ts';

// ── normalisation ──────────────────────────────────────────────────────────────────

test('normalizeText lowercases and strips Latin diacritics', () => {
  assert.equal(normalizeText('Café RÉSUMÉ'), 'cafe resume');
});

test('normalizeText folds Arabic alef/ya/ta-marbuta and strips harakat', () => {
  // أ إ آ → ا ; ى → ي ; ة → ه ; tashkeel removed.
  assert.equal(normalizeText('أَحْمَد'), 'احمد');
  assert.equal(normalizeText('إسلام'), 'اسلام');
  assert.equal(normalizeText('مدرسة'), 'مدرسه');
  assert.equal(normalizeText('مُصْطَفى'), 'مصطفي');
});

// ── tokenisation ───────────────────────────────────────────────────────────────────

test('tokenize splits on non-alphanumerics across scripts', () => {
  assert.deepEqual(tokenize('Reading: comprehension (skill)'), ['reading', 'comprehension', 'skill']);
  assert.deepEqual(tokenize('القراءة، والكتابة'), ['القراءه', 'والكتابه']);
});

// ── bounded edit distance ────────────────────────────────────────────────────────────

test('boundedLevenshtein returns the true distance within budget and bails past it', () => {
  assert.equal(boundedLevenshtein('listening', 'listning', 2), 1);
  assert.equal(boundedLevenshtein('kitten', 'sitting', 3), 3);
  assert.ok(boundedLevenshtein('apple', 'orange', 1) > 1);
});

// ── scoring / typo tolerance ─────────────────────────────────────────────────────────

function fields(daily: string, extra: Array<[string, number]> = []): WeightedField[] {
  return [
    { tokens: tokenize(daily), weight: 3 },
    ...extra.map(([text, weight]) => ({ tokens: tokenize(text), weight })),
  ];
}

test('scoreFields matches an exact word', () => {
  const s = scoreFields(fields('Students practise listening comprehension'), tokenize('listening'));
  assert.ok(s != null && s > 0);
});

test('scoreFields is typo-tolerant ("listning" → "listening")', () => {
  const s = scoreFields(fields('Students practise listening comprehension'), tokenize('listning'));
  assert.ok(s != null && s > 0);
});

test('scoreFields supports mid-typing prefixes', () => {
  const s = scoreFields(fields('Students practise listening comprehension'), tokenize('compreh'));
  assert.ok(s != null && s > 0);
});

test('scoreFields requires ALL query tokens to match (AND semantics)', () => {
  const s = scoreFields(fields('Students practise listening comprehension'), tokenize('listening algebra'));
  assert.equal(s, null);
});

test('scoreFields ranks daily-outcome hits above chip-only hits', () => {
  const inDaily = scoreFields(fields('reading fluency'), tokenize('reading'));
  const inChip = scoreFields(fields('fluency drills', [['Reading', 1]]), tokenize('reading'));
  assert.ok(inDaily != null && inChip != null && inDaily > inChip);
});

test('scoreFields matches Arabic ignoring harakat and hamza form', () => {
  const s = scoreFields(fields('يتعلّم الطالب القراءة'), tokenize('القراءه'));
  assert.ok(s != null && s > 0);
});

// ── highlighting ─────────────────────────────────────────────────────────────────────

test('highlightSegments wraps the matched substring, preserving original casing', () => {
  const segs = highlightSegments('Listening comprehension', tokenize('listening'));
  const hit = segs.find((s) => s.hit);
  assert.equal(hit?.text, 'Listening');
});

test('highlightSegments maps back through Latin diacritics to original offsets', () => {
  const segs = highlightSegments('Café society', tokenize('cafe'));
  const hit = segs.find((s) => s.hit);
  assert.equal(hit?.text, 'Café');
  assert.equal(segs.map((s) => s.text).join(''), 'Café society');
});

test('highlightSegments reconstructs the full original text', () => {
  const text = 'Reading and writing practice';
  const segs = highlightSegments(text, tokenize('reading writing'));
  assert.equal(segs.map((s) => s.text).join(''), text);
  assert.equal(segs.filter((s) => s.hit).length, 2);
});

test('highlightSegments handles Arabic (RTL) matches through harakat', () => {
  const text = 'القراءة الجهرية';
  const segs = highlightSegments(text, tokenize('القراءه'));
  assert.equal(segs.map((s) => s.text).join(''), text);
  assert.ok(segs.some((s) => s.hit));
});

test('highlightSegments returns a single plain segment when nothing matches', () => {
  const segs = highlightSegments('no match here', tokenize('xyz'));
  assert.deepEqual(segs, [{ text: 'no match here', hit: false }]);
});

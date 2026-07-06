import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyCurriculumRow, GAP_STATUS_ORDER } from '../gaps';

const NO_GUARDS = new Set<string>();
const row = (taxonomyId: string | null, dailyOutcome: string | null, lessonKey = 'k') => ({
  taxonomyId,
  dailyOutcome,
  lessonKey,
});

test('placed: well-formed, not S0/K0, with an outcome', () => {
  assert.equal(classifyCurriculumRow(row('1.S3.K2.H1', 'Read a text'), NO_GUARDS), 'placed');
  assert.equal(classifyCurriculumRow(row('4.S1.K1.H5', 'Do a thing'), NO_GUARDS), 'placed');
});

test('placeholder: well-formed shape but S0 or K0 sentinel (OR, matching the gate)', () => {
  assert.equal(classifyCurriculumRow(row('0.S0.K0.H1', 'Trace letter a'), NO_GUARDS), 'placeholder');
  // OR semantics — a single sentinel segment is enough (isFlatArtefact would miss this).
  assert.equal(classifyCurriculumRow(row('2.S0.K1.H1', 'Outcome'), NO_GUARDS), 'placeholder');
  assert.equal(classifyCurriculumRow(row('2.S1.K0.H1', 'Outcome'), NO_GUARDS), 'placeholder');
});

test('unmapped: blank/absent identifier but has an outcome', () => {
  assert.equal(classifyCurriculumRow(row('', 'Outcome'), NO_GUARDS), 'unmapped');
  assert.equal(classifyCurriculumRow(row(null, 'Outcome'), NO_GUARDS), 'unmapped');
});

test('duplicate: a non-empty identifier that does not parse to a well-formed id', () => {
  assert.equal(classifyCurriculumRow(row('Reading…H0', 'Outcome'), NO_GUARDS), 'duplicate');
  assert.equal(classifyCurriculumRow(row('E.S0.K0', 'Outcome'), NO_GUARDS), 'duplicate');
  assert.equal(classifyCurriculumRow(row('nonsense', 'Outcome'), NO_GUARDS), 'duplicate');
});

test('missing: empty daily outcome takes precedence over taxonomy state', () => {
  assert.equal(classifyCurriculumRow(row('1.S3.K2.H1', null), NO_GUARDS), 'missing');
  assert.equal(classifyCurriculumRow(row('1.S3.K2.H1', '   '), NO_GUARDS), 'missing');
  assert.equal(classifyCurriculumRow(row('', ''), NO_GUARDS), 'missing');
});

test('guard: a referenced lesson_key overrides everything, even a valid placed row', () => {
  const guards = new Set(['g1']);
  assert.equal(
    classifyCurriculumRow(row('1.S3.K2.H1', 'Read a text', 'g1'), guards),
    'guard',
  );
  assert.equal(classifyCurriculumRow(row('1.S3.K2.H1', 'Read a text', 'other'), guards), 'placed');
});

test('every state is represented in the facet order', () => {
  assert.equal(new Set(GAP_STATUS_ORDER).size, 6);
});

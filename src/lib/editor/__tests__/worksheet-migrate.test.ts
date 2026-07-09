import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  migrateWorksheetToV3,
  migrateV3ToV2,
  analyzeWorksheetRow,
  findFloatingOverImage,
  sourceVersion,
  isWorksheetV3,
} from '../worksheet-migrate';

// ── v2 block worksheet → v3 continuous document ───────────────────────────────
// The forward migration flattens the ordered block list (Free blocks' tiptap docs
// + block-owned floating overlays, resource references) into ONE doc, in order.
// Pure JSON in, pure JSON out — no tiptap, no DOM — so it runs headless here.

/** A tiptap doc holding the given top-level nodes. */
function doc(...content) {
  return { type: 'doc', content };
}
function heading(text, level = 2) {
  return { type: 'heading', attrs: { level }, content: [{ type: 'text', text }] };
}
function para(text) {
  return { type: 'paragraph', content: text ? [{ type: 'text', text }] : [] };
}
function freeBlock(id, content, elements = []) {
  return { id, kind: 'free', doc: doc(...content), fromAI: false, elements };
}
function floatImage(id, geom) {
  return { id, kind: 'image', src: `https://x/${id}.png`, alt: id, z: 1, ...geom };
}
function floatBox(id, geom, text) {
  return {
    id,
    kind: 'textbox',
    doc: text ? doc(para(text)) : null,
    border: false,
    fill: 'transparent',
    z: 2,
    ...geom,
  };
}

test('flattens ordered v2 free blocks into one doc, preserving order', () => {
  const ws = {
    version: 2,
    blocks: [
      freeBlock('a', [heading('Exercise 1'), para('First')]),
      freeBlock('b', [heading('Exercise 2'), para('Second')]),
    ],
  };
  const v3 = migrateWorksheetToV3(ws);
  assert.equal(v3.version, 3);
  assert.equal(v3.doc.type, 'doc');
  assert.deepEqual(
    v3.doc.content.map((n) => n.type),
    ['heading', 'paragraph', 'heading', 'paragraph'],
  );
  assert.equal(v3.doc.content[0].content[0].text, 'Exercise 1');
  assert.equal(v3.doc.content[3].content[0].text, 'Second');
});

test('a floating image becomes an inline image node with width + align', () => {
  const ws = {
    version: 2,
    blocks: [freeBlock('a', [para('Look:')], [floatImage('img', { x: 10, y: 10, w: 320, h: 200 })])],
  };
  const v3 = migrateWorksheetToV3(ws);
  const img = v3.doc.content.find((n) => n.type === 'image');
  assert.ok(img, 'expected an inline image node');
  assert.equal(img.attrs.src, 'https://x/img.png');
  assert.equal(img.attrs.width, 320);
  assert.equal(img.attrs.align, 'center');
});

test('a floating text box with content becomes a blockquote callout', () => {
  const ws = {
    version: 2,
    blocks: [freeBlock('a', [para('Body')], [floatBox('tb', { x: 0, y: 0, w: 200, h: 80 }, 'Note!')])],
  };
  const v3 = migrateWorksheetToV3(ws);
  const quote = v3.doc.content.find((n) => n.type === 'blockquote');
  assert.ok(quote, 'expected a blockquote callout');
  assert.equal(quote.content[0].content[0].text, 'Note!');
});

test('an empty text box is dropped (no orphan callout)', () => {
  const ws = {
    version: 2,
    blocks: [freeBlock('a', [para('Body')], [floatBox('tb', { x: 0, y: 0, w: 200, h: 80 }, '')])],
  };
  const v3 = migrateWorksheetToV3(ws);
  assert.equal(v3.doc.content.filter((n) => n.type === 'blockquote').length, 0);
});

test('floating overlays flatten after flow content in z-order', () => {
  const ws = {
    version: 2,
    blocks: [
      freeBlock('a', [para('Body')], [
        { ...floatImage('img', { x: 0, y: 0, w: 100, h: 100 }), z: 5 },
        { ...floatBox('tb', { x: 300, y: 0, w: 100, h: 40 }, 'Caption'), z: 3 },
      ]),
    ],
  };
  const v3 = migrateWorksheetToV3(ws);
  // paragraph, then z=3 callout, then z=5 image.
  assert.deepEqual(
    v3.doc.content.map((n) => n.type),
    ['paragraph', 'blockquote', 'image'],
  );
});

test('a legacy resource block becomes a render-only resourceRef node', () => {
  const ws = {
    version: 2,
    blocks: [{ id: 'r', kind: 'resource', resourceId: 'res-123', uploaderName: 'Jane' }],
  };
  const v3 = migrateWorksheetToV3(ws);
  assert.deepEqual(v3.doc.content, [
    { type: 'resourceRef', attrs: { resourceId: 'res-123', uploaderName: 'Jane' } },
  ]);
});

// ── legacy / edge shapes ──────────────────────────────────────────────────────

test('a legacy v1 bare tiptap doc migrates to v3 with its content intact', () => {
  const v1 = doc(heading('Title', 1), para('Legacy body'));
  const v3 = migrateWorksheetToV3(v1);
  assert.equal(v3.version, 3);
  assert.deepEqual(
    v3.doc.content.map((n) => n.type),
    ['heading', 'paragraph'],
  );
});

test('null / garbage migrates to a non-empty doc the editor can mount', () => {
  for (const raw of [null, undefined, 42, 'nope', {}, { version: 2 }]) {
    const v3 = migrateWorksheetToV3(raw);
    assert.equal(v3.doc.type, 'doc');
    assert.ok(v3.doc.content.length >= 1, `expected >=1 node for ${JSON.stringify(raw)}`);
  }
});

test('migration is idempotent for a v3 envelope', () => {
  const first = migrateWorksheetToV3({
    version: 2,
    blocks: [freeBlock('a', [heading('X'), para('Y')])],
  });
  const second = migrateWorksheetToV3(first);
  assert.deepEqual(second, first);
  // and stable across a third pass
  assert.deepEqual(migrateWorksheetToV3(second), first);
});

test('a v3 envelope with an empty doc is normalised to one empty paragraph', () => {
  const v3 = migrateWorksheetToV3({ version: 3, doc: { type: 'doc', content: [] } });
  assert.deepEqual(v3.doc.content, [{ type: 'paragraph' }]);
});

// ── reversibility (migrateV3ToV2 + parseWorksheet routing) ───────────────────

test('migrateV3ToV2 wraps the doc as a single v2 free block (graceful degrade)', () => {
  const v3 = migrateWorksheetToV3({
    version: 2,
    blocks: [
      freeBlock('a', [heading('One'), para('1')]),
      freeBlock('b', [heading('Two'), para('2')]),
    ],
  });
  const back = migrateV3ToV2(v3.doc);
  assert.equal(back.version, 2);
  assert.equal(back.blocks.length, 1);
  assert.equal(back.blocks[0].kind, 'free');
  // the flowing content survives the round trip
  assert.deepEqual(
    back.blocks[0].doc.content.map((n) => n.type),
    ['heading', 'paragraph', 'heading', 'paragraph'],
  );
});

// ── version classification ────────────────────────────────────────────────────

test('sourceVersion classifies every on-disk shape', () => {
  assert.equal(sourceVersion(null), 'empty');
  assert.equal(sourceVersion({ version: 3, doc: { type: 'doc', content: [] } }), 'v3');
  assert.equal(sourceVersion({ version: 2, blocks: [] }), 'v2');
  assert.equal(sourceVersion({ type: 'doc', content: [] }), 'v1');
  assert.equal(sourceVersion(42), 'unknown');
  assert.equal(isWorksheetV3({ version: 3, doc: { type: 'doc', content: [] } }), true);
  assert.equal(isWorksheetV3({ version: 2, blocks: [] }), false);
});

// ── floating-over-image detection ─────────────────────────────────────────────

test('detects a text box overlapping an image (label-over-figure)', () => {
  const els = [
    floatImage('img', { x: 0, y: 0, w: 200, h: 200 }),
    floatBox('tb', { x: 50, y: 50, w: 100, h: 40 }, 'Label'),
  ];
  assert.deepEqual(findFloatingOverImage(els), [{ textBoxId: 'tb', imageId: 'img' }]);
});

test('disjoint text box and image do not count as an overlap', () => {
  const els = [
    floatImage('img', { x: 0, y: 0, w: 100, h: 100 }),
    floatBox('tb', { x: 300, y: 300, w: 100, h: 40 }, 'Label'),
  ];
  assert.deepEqual(findFloatingOverImage(els), []);
});

test('edge-touching rectangles do not count as an overlap', () => {
  const els = [
    floatImage('img', { x: 0, y: 0, w: 100, h: 100 }),
    floatBox('tb', { x: 100, y: 0, w: 100, h: 100 }, 'Label'),
  ];
  assert.deepEqual(findFloatingOverImage(els), []);
});

// ── corpus analysis (drives the dry-run summary) ──────────────────────────────

test('analyzeWorksheetRow reports counts and never throws on shape', () => {
  const ws = {
    version: 2,
    blocks: [
      freeBlock('a', [para('x')], [
        floatImage('img', { x: 0, y: 0, w: 200, h: 200 }),
        floatBox('tb', { x: 10, y: 10, w: 100, h: 40 }, 'over'),
      ]),
      { id: 'r', kind: 'resource', resourceId: 'res-1', uploaderName: null },
    ],
  };
  const a = analyzeWorksheetRow(ws);
  assert.equal(a.ok, true);
  assert.equal(a.source, 'v2');
  assert.equal(a.blockCount, 2);
  assert.equal(a.freeBlocks, 1);
  assert.equal(a.resourceRefs, 1);
  assert.equal(a.floatingImages, 1);
  assert.equal(a.floatingTextBoxes, 1);
  assert.equal(a.floatingOverImage, 1);
});

test('analyzeWorksheetRow flags an overflow-risk block by the image heuristic', () => {
  const manyImages = Array.from({ length: 4 }, (_, i) => ({
    type: 'image',
    attrs: { src: `p${i}.png` },
  }));
  const ws = { version: 2, blocks: [freeBlock('a', manyImages)] };
  const a = analyzeWorksheetRow(ws);
  assert.equal(a.overflowRiskBlocks, 1);
});

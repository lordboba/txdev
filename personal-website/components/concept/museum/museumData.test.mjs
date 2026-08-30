import assert from 'node:assert/strict';
import test from 'node:test';

const museumData = await import('./museumData.ts').catch(() => null);

test('museum palettes cover every real git era with valid colours', () => {
  assert.ok(museumData, 'museumData.ts must exist');
  assert.equal(museumData.eraPalettes.length, 5);
  assert.deepEqual(
    museumData.eraPalettes.map((entry) => entry.commit),
    ['96ccd76', '79348e8', '46a72ca', '4fc5d06', 'ad3e87a'],
  );

  for (const palette of museumData.eraPalettes) {
    assert.match(palette.wall, /^#[0-9a-f]{6}$/);
    assert.match(palette.ink, /^#[0-9a-f]{6}$/);
    assert.match(palette.accent, /^#[0-9a-f]{6}$/);
    assert.match(palette.miniature, /^#[0-9a-f]{6}$/);
  }
});

test('timeline math clamps to the five hard-ended exhibits', () => {
  assert.ok(museumData, 'museumData.ts must exist');
  assert.equal(museumData.clampEraIndex(-1), 0);
  assert.equal(museumData.clampEraIndex(2.4), 2.4);
  assert.equal(museumData.clampEraIndex(9), 4);
  assert.equal(museumData.nearestEraIndex(2.49), 2);
  assert.equal(museumData.nearestEraIndex(2.5), 3);
});

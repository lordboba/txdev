import assert from 'node:assert/strict';
import test from 'node:test';
import { conceptViews, featuredProjects, gitEras } from './conceptData.ts';
import { conceptEntries } from './conceptRegistry.ts';

test('concept view identifiers are unique and cover the four profile angles', () => {
  assert.equal(conceptViews.length, 4);
  assert.deepEqual(
    new Set(conceptViews.map((view) => view.id)).size,
    conceptViews.length,
  );
});

test('featured projects are visual and link to real work', () => {
  assert.ok(featuredProjects.length >= 3);

  for (const project of featuredProjects) {
    assert.match(project.image, /^\/projects\/.+\.png$/);
    assert.match(project.link, /^https:\/\//);
  }
});

test('git eras are chronological snapshots backed by short commit hashes', () => {
  assert.ok(gitEras.length >= 4);

  for (const era of gitEras) {
    assert.match(era.commit, /^[0-9a-f]{7}$/);
    assert.match(era.date, /^\d{4}-\d{2}-\d{2}$/);
  }

  const dates = gitEras.map((era) => era.date);
  assert.deepEqual(dates, [...dates].sort());
});

test('every concept direction has a distinct route and a full palette', () => {
  assert.equal(conceptEntries.length, 4);

  const routes = conceptEntries.map((entry) => entry.route);
  assert.equal(new Set(routes).size, routes.length);

  for (const entry of conceptEntries) {
    assert.equal(entry.route, `/concept/${entry.id}`);
    assert.equal(entry.palette.length, 3);

    for (const colour of entry.palette) {
      assert.match(colour, /^#[0-9a-f]{6}$/);
    }
  }
});

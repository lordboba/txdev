import assert from 'node:assert/strict';
import test from 'node:test';
import {
  conceptViews,
  experimentNotes,
  experiments,
  gitEras,
  notesLabel,
} from './conceptData.ts';
import { conceptEntries } from './conceptRegistry.ts';
import { featuredProjects } from '../../content/projectData.ts';

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
    assert.match(project.image, /^\/projects\/.+\.(?:png|jpe?g|webp|svg)$/);
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

test('every effort has exactly one elaboration and a visible label', () => {
  assert.equal(experimentNotes.length, experiments.length);
  assert.ok(notesLabel.length > 0);

  for (const experiment of experiments) {
    const matches = experimentNotes.filter(
      (note) => note.number === experiment.number,
    );

    /*
     * One note per blank, keyed by the letter the blank is engraved with. The
     * panel looks its note up by that key, so a duplicate or a missing entry
     * silently drops a plate's elaboration.
     */
    assert.equal(matches.length, 1, `notes for ${experiment.number}`);

    const [note] = matches;
    assert.ok(note.question.length > 0);
    assert.ok(note.readout.length > 0);
    assert.ok(note.next.length > 0);
    assert.ok(note.running.length >= 3);
    assert.ok(note.evidence.length >= 2);
  }
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

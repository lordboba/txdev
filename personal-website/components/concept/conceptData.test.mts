import assert from 'node:assert/strict';
import test from 'node:test';
import {
  companyRun,
  companyTags,
  conceptViews,
  experimentNotes,
  experiments,
  featuredProjects,
  gitEras,
  notesLabel,
} from './conceptData.ts';
import { conceptEntries } from './conceptRegistry.ts';
import { experiences } from '../../lib/siteData.ts';

test('concept view identifiers are unique and cover the four profile angles', () => {
  assert.equal(conceptViews.length, 4);
  assert.deepEqual(
    new Set(conceptViews.map((view) => view.id)).size,
    conceptViews.length,
  );
});

test('signature view copy uses Tyler’s approved release wording', () => {
  const views = Object.fromEntries(conceptViews.map((view) => [view.id, view]));

  assert.equal(views.profile.heading, 'Welcome to my site! :)');
  assert.equal(
    views.profile.description,
    'Sharing my dev work, experiments, and personal thoughts here :)',
  );
  assert.equal(
    views.work.description,
    "I've worked at Scale AI, SafetyKit, and Ramp.",
  );
  assert.equal(
    views.signals.description,
    'Right now, I’m building tools for myself, evaluating agents, and finishing this site.',
  );
  assert.equal(views.history.description, 'Previous site history :)');
});

test('focus areas use direct labels and descriptions', () => {
  assert.deepEqual(experiments, [
    {
      number: 'A',
      status: 'Building',
      title: 'Tools I wanted enough to make',
      description:
        'Small, local-first products built around problems I kept running into.',
    },
    {
      number: 'B',
      status: 'Testing',
      title: 'Finding where agents break',
      description:
        'Evals that preserve failures, resume interrupted runs, and show what actually went wrong.',
    },
    {
      number: 'C',
      status: 'Editing',
      title: 'One profile, a few different views',
      description:
        'The site changes depending on what you came to learn: who I am, what I’ve built, or what I’m testing.',
    },
  ]);
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

test('company tags carry a verified mark and no invented copy', () => {
  assert.equal(companyTags.length, 4);
  assert.equal(new Set(companyTags.map((tag) => tag.mark)).size, 4);

  /* The run leads in its own order; the credential is the last tag. */
  assert.deepEqual(
    companyTags.slice(0, companyRun.length).map((tag) => tag.mark),
    companyRun.map((entry) => entry.company),
  );
  assert.equal(companyTags[companyTags.length - 1].mark, 'UCLA');

  for (const tag of companyTags) {
    assert.match(tag.logo, /^\/logos\/[a-z-]+\.svg$/);

    /* Every prose field has to exist verbatim on a real experience record. */
    const record = experiences.find((entry) => entry.company === tag.org);
    assert.ok(record, `no experience record for ${tag.org}`);
    assert.equal(tag.role, record.role);
    assert.equal(tag.period, record.period);
    assert.equal(tag.summary, record.summary);
    assert.equal(tag.proof, record.proof);
    assert.deepEqual(tag.focus, record.focus);

    /* And the run label, where there is one, has to match the run entry. */
    const run = companyRun.find((entry) => entry.company === tag.mark) ?? null;
    assert.equal(tag.run, run ? run.period : null);
    assert.equal(tag.detail, run ? run.detail : null);
  }
});

test('every experiment has exactly one elaboration, and it is marked a draft', () => {
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

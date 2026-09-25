import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { projects } from '../content/projectData.ts';
import { getAllPostMeta } from './blog.ts';
import {
  ANSWER_LABELS,
  PROJECT_RIDDLES,
  RIDDLE_TARGETS,
  datePhrase,
  dayOfYear,
  indexLabel,
  postClue,
  projectField,
  readTimePhrase,
  riddleFor,
  riddleSlate,
} from './festivalRiddles.ts';

const posts = await getAllPostMeta();
const slate = riddleSlate(posts);

/** The front matter as the file has it, independent of `lib/blog.ts`. */
function readFrontMatter() {
  const dir = path.join(process.cwd(), 'content', 'blog');

  return readdirSync(dir)
    .filter((file) => file.endsWith('.md'))
    .map((file) => {
      const raw = readFileSync(path.join(dir, file), 'utf8');
      const block = /^---\n([\s\S]*?)\n---/.exec(raw);
      const meta = Object.fromEntries(
        (block?.[1] ?? '')
          .split('\n')
          .map((line) => line.split(/:\s*(.*)/))
          .filter(([key]) => key)
          .map(([key, value]) => [key.trim(), (value ?? '').trim()]),
      );

      return { slug: file.replace(/\.md$/, ''), ...meta };
    });
}

test('the slate is eleven project riddles then one per published post', () => {
  assert.equal(PROJECT_RIDDLES.length, 11);
  assert.equal(slate.length, 11 + posts.length);
  assert.equal(posts.length, 1, 'one published post as of 2026-09-25');
  assert.equal(slate.length, 12);

  slate.forEach((riddle, i) => {
    assert.equal(riddle.index, i + 1);
    assert.equal(riddle.total, slate.length);
    assert.equal(riddle.label, indexLabel(i + 1, slate.length));
    assert.equal(riddle.pool, i < 11 ? 'project' : 'post');
    assert.equal(riddle.answerLabel, ANSWER_LABELS.Hans);
    assert.equal(
      riddle.ariaLabel,
      `Lantern riddle: ${riddle.clue} Answer: ${riddle.answer}`,
    );
  });

  assert.equal(slate[2].label, '03 / 12');
  assert.equal(slate[11].label, '12 / 12');
});

test('every project 谜底 is an existing project title with its link as href', () => {
  const titles = new Set(projects.map((project) => project.title));

  for (const riddle of slate.filter((r) => r.pool === 'project')) {
    assert.ok(titles.has(riddle.answer), `${riddle.answer} is not a project`);

    const project = projects.find((p) => p.title === riddle.answer);
    assert.equal(riddle.href, project.link);
    assert.equal(riddle.external, project.link.startsWith('http'));
    assert.equal(riddle.target, RIDDLE_TARGETS.project.Hans);
  }

  // No project is used twice.
  const answers = slate
    .filter((r) => r.pool === 'project')
    .map((r) => r.answer);
  assert.equal(new Set(answers).size, answers.length);
});

test('every 谜面 keyword appears verbatim in its cited project field', () => {
  for (const riddle of slate.filter((r) => r.pool === 'project')) {
    const project = projects.find((p) => p.title === riddle.answer);

    assert.ok(riddle.sources.length > 0, `${riddle.answer} cites no field`);

    for (const source of riddle.sources) {
      const text = projectField(project, source.field);

      assert.ok(text, `${riddle.answer}.${source.field} is empty`);

      for (const keyword of source.keywords) {
        assert.ok(
          text.includes(keyword),
          `${riddle.answer}.${source.field} lacks "${keyword}"`,
        );
      }
    }
  }
});

test('the slate matches the bible §6.A3 table line for line', () => {
  const expected = [
    ['Calendar events become alarm rules.', 'iCalarms'],
    ['A party game you play by tilting the phone.', 'Charades 2026'],
    [
      'Secrets kept in the Keychain; folders opened only when you say so.',
      'Personal Env',
    ],
    [
      'It clones the repo, runs it, and asks before it changes anything.',
      'Personal Software Builder',
    ],
    ['Reads the bill, audits the charges, drafts the letter.', 'Med Negotiate'],
    ['Fish and Viet Cong, played from a browser.', 'Multiplayer Card Games'],
    ['A Discord bot that runs the stock market as a game.', 'StonksGame'],
    ['Reads the air and warns of fire.', 'Wildfire Detection'],
    ['Tell it in plain words; it routes the documents in Drive.', 'DocuPilot'],
    ['An instructor and a TA, both agents, teach the lesson.', 'Kinetic'],
    ['Goals, habits, gentle reminders.', 'Grow & Give'],
    [
      'The first post; one minute to read; dated the fourteenth of February.',
      'Introduction',
    ],
  ];

  assert.deepEqual(
    slate.map((r) => [r.clue, r.answer]),
    expected,
  );
});

test('the post riddle is data from the front matter, not a string', () => {
  const frontMatter = readFrontMatter();
  const post = slate.find((r) => r.pool === 'post');
  const file = frontMatter.find((fm) => fm.slug === 'introduction');

  assert.ok(file, 'content/blog/introduction.md has front matter');
  assert.equal(post.answer, file.title);
  assert.equal(post.href, `/blog/${file.slug}`);
  assert.equal(post.external, false);
  assert.equal(post.target, RIDDLE_TARGETS.post.Hans);
  assert.equal(file.readTime, '1 min read');
  assert.equal(file.date, '2026-02-14');

  // The clue's clauses come from the meta the front matter declares.
  assert.equal(readTimePhrase(file.readTime), 'one minute to read');
  assert.equal(datePhrase(file.date), 'the fourteenth of February');
  assert.equal(
    postClue(
      { ...posts[0], readTime: file.readTime, publishedAt: file.date },
      1,
    ),
    post.clue,
  );

  // Keywords cited by the post riddle are in the meta.
  for (const source of post.sources) {
    for (const keyword of source.keywords) {
      assert.ok(String(posts[0][source.field]).includes(keyword));
    }
  }

  // Generic phrasing for later posts.
  assert.equal(readTimePhrase('5 min read'), 'five minutes to read');
  assert.equal(datePhrase('2026-10-01'), 'the first of October');
  assert.equal(
    postClue(
      { ...posts[0], readTime: '3 min read', publishedAt: '2026-11-21' },
      2,
    ),
    'The second post; three minutes to read; dated the twenty-first of November.',
  );
});

test('rotation: the two project pages never coincide; /blog draws the post pool', () => {
  for (let day = 1; day <= 366; day += 1) {
    const past = riddleFor('project', day, 0, posts);
    const call = riddleFor('project', day, 5, posts);

    assert.equal(past.pool, 'project');
    assert.equal(call.pool, 'project');
    assert.notEqual(past.index, call.index, `day ${day}`);
    assert.equal(past.index, (day % 11) + 1);
    assert.equal(call.index, ((day + 5) % 11) + 1);

    assert.equal(riddleFor('post', day, 0, posts).index, 12);
  }

  assert.equal(riddleFor('post', 100, 0, []), null);
  assert.equal(
    riddleFor('project', -3, 0, posts).index,
    (((-3 % 11) + 11) % 11) + 1,
  );
});

test('Traditional script flips the 谜目 and 谜底 glyphs only', () => {
  const hant = riddleSlate(posts, 'Hant');

  assert.equal(hant[0].target, '打一項目');
  assert.equal(hant[11].target, '打一文');
  assert.equal(hant[0].answerLabel, '謎底');
  assert.deepEqual(
    hant.map((r) => [r.clue, r.answer, r.href]),
    slate.map((r) => [r.clue, r.answer, r.href]),
  );
});

test('dayOfYear is 1-based local time', () => {
  assert.equal(dayOfYear(new Date(2026, 0, 1)), 1);
  assert.equal(dayOfYear(new Date(2026, 8, 25)), 268);
  assert.equal(dayOfYear(new Date(2026, 11, 31)), 365);
  assert.equal(dayOfYear(new Date(2028, 11, 31)), 366);
});

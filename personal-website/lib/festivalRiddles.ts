/**
 * Lantern riddles (灯谜) for the Mid-Autumn slip on lantern B (bible §6.A3).
 *
 * The slate is composed from `content/projectData.ts` and the blog front
 * matter only: eleven 打一项目 ("guess one project") riddles, in slate order,
 * and one 打一文 ("guess one post") riddle per published post. Nothing in a
 * 谜面 asserts anything that is not in its cited source field;
 * `lib/festivalRiddles.test.mjs` checks every answer, keyword and href
 * against the data.
 *
 * Rotation: `/past-experience` (routeSeed 0) and `/schedule-a-call`
 * (routeSeed 5) draw `pool项目[(dayOfYear + routeSeed) mod 11]`, so the two
 * pages never show the same riddle on the same day; `/blog` draws
 * `pool文[dayOfYear mod pool文.length]`.
 *
 * Pure: no DOM, no three; node tests import it with the `.ts` extension.
 */
import { projects, type Project } from '../content/projectData.ts';
import type { BlogPostMeta } from './blog.ts';
import { festival, type FestivalScript } from './festival.ts';

export type RiddlePool = 'project' | 'post';

/** The 谜目 for each pool in both scripts (both forms are in the font subset). */
export const RIDDLE_TARGETS: Record<
  RiddlePool,
  Record<FestivalScript, string>
> = {
  project: { Hans: '打一项目', Hant: '打一項目' },
  post: { Hans: '打一文', Hant: '打一文' },
};

/** The 谜底 label that precedes the answer on the unfolded card. */
export const ANSWER_LABELS: Record<FestivalScript, string> = {
  Hans: '谜底',
  Hant: '謎底',
};

/** The Han–Latin separator on the answer line (`谜底 · iCalarms`). */
export const ANSWER_SEPARATOR = ' · ';

/** Where a project riddle's words come from. */
export type ProjectSourceField = 'description' | 'proof' | 'bench.description';

export interface RiddleSource {
  /** The `projects[]` field (or blog meta field) the clue paraphrases. */
  field: ProjectSourceField | keyof BlogPostMeta;
  /** Substrings that must appear verbatim in that field. */
  keywords: readonly string[];
}

export interface Riddle {
  /** 1-based slate number (the index label's numerator). */
  index: number;
  /** Slate size (the index label's denominator). */
  total: number;
  pool: RiddlePool;
  /** 谜面, set in Cormorant italic. */
  clue: string;
  /** 谜目 in the configured script. */
  target: string;
  /** 谜底: an existing `projects[].title` or blog `title`. */
  answer: string;
  /** The 谜底 label in the configured script. */
  answerLabel: string;
  /** `project.link` or `/blog/<slug>`. */
  href: string;
  /** External links open with `target="_blank" rel="noreferrer"`. */
  external: boolean;
  /** `03 / 12`, tabular Plex Mono at the top of the strip. */
  label: string;
  /** `aria-label` for the slip button. */
  ariaLabel: string;
  sources: readonly RiddleSource[];
}

interface ProjectRiddleEntry {
  title: string;
  clue: string;
  sources: readonly RiddleSource[];
}

/**
 * The eleven project riddles, slate order 01–11 (bible §6.A3 table). Each
 * keyword is a verbatim substring of the cited field; the test enforces it.
 */
export const PROJECT_RIDDLES: readonly ProjectRiddleEntry[] = [
  {
    title: 'iCalarms',
    clue: 'Calendar events become alarm rules.',
    sources: [
      {
        field: 'bench.description',
        keywords: ['Calendar events become', 'alarm rules'],
      },
    ],
  },
  {
    title: 'Charades 2026',
    clue: 'A party game you play by tilting the phone.',
    sources: [
      { field: 'description', keywords: ['party game', 'tilt-controlled'] },
    ],
  },
  {
    title: 'Personal Env',
    clue: 'Secrets kept in the Keychain; folders opened only when you say so.',
    sources: [
      {
        field: 'description',
        keywords: ['Apple Keychain storage', 'explicit local folder approval'],
      },
    ],
  },
  {
    title: 'Personal Software Builder',
    clue: 'It clones the repo, runs it, and asks before it changes anything.',
    sources: [
      {
        field: 'description',
        keywords: [
          'cloning',
          'running',
          'visible approvals around local repo mutation',
        ],
      },
    ],
  },
  {
    title: 'Med Negotiate',
    clue: 'Reads the bill, audits the charges, drafts the letter.',
    sources: [
      {
        field: 'description',
        keywords: [
          'extracts line items',
          'audits charges',
          'drafts provider outreach',
        ],
      },
    ],
  },
  {
    title: 'Multiplayer Card Games',
    clue: 'Fish and Viet Cong, played from a browser.',
    sources: [
      { field: 'description', keywords: ['playing Fish and Viet Cong online'] },
      { field: 'proof', keywords: ['browser-playable'] },
    ],
  },
  {
    title: 'StonksGame',
    clue: 'A Discord bot that runs the stock market as a game.',
    sources: [
      {
        field: 'description',
        keywords: ['Discord bot that runs live stock-trading simulations'],
      },
    ],
  },
  {
    title: 'Wildfire Detection',
    clue: 'Reads the air and warns of fire.',
    sources: [
      {
        field: 'description',
        keywords: ['ingests air-quality data and flags wildfire risk'],
      },
    ],
  },
  {
    title: 'DocuPilot',
    clue: 'Tell it in plain words; it routes the documents in Drive.',
    sources: [
      {
        field: 'description',
        keywords: [
          'Google Drive agent',
          'natural language chat',
          'handling routing',
        ],
      },
    ],
  },
  {
    title: 'Kinetic',
    clue: 'An instructor and a TA, both agents, teach the lesson.',
    sources: [
      {
        field: 'description',
        keywords: ['instructor and TA agents to deliver multi-modal lessons'],
      },
    ],
  },
  {
    title: 'Grow & Give',
    clue: 'Goals, habits, gentle reminders.',
    sources: [
      {
        field: 'description',
        keywords: ['set goals', 'habit tracking and gentle reminders'],
      },
    ],
  },
];

/** Reads a project's cited field (`bench.description` reaches into `bench`). */
export function projectField(
  project: Project,
  field: ProjectSourceField,
): string | undefined {
  if (field === 'bench.description') return project.bench?.description;

  return project[field];
}

export function findProject(title: string): Project | undefined {
  return projects.find((project) => project.title === title);
}

// ---------------------------------------------------------------------------
// Post riddles: composed from the front matter, one per published post
// ---------------------------------------------------------------------------

const ORDINALS = [
  'first',
  'second',
  'third',
  'fourth',
  'fifth',
  'sixth',
  'seventh',
  'eighth',
  'ninth',
  'tenth',
  'eleventh',
  'twelfth',
];

const SMALL_NUMBERS = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
];

const DAY_ORDINALS: Record<number, string> = {
  1: 'first',
  2: 'second',
  3: 'third',
  4: 'fourth',
  5: 'fifth',
  6: 'sixth',
  7: 'seventh',
  8: 'eighth',
  9: 'ninth',
  10: 'tenth',
  11: 'eleventh',
  12: 'twelfth',
  13: 'thirteenth',
  14: 'fourteenth',
  15: 'fifteenth',
  16: 'sixteenth',
  17: 'seventeenth',
  18: 'eighteenth',
  19: 'nineteenth',
  20: 'twentieth',
  21: 'twenty-first',
  22: 'twenty-second',
  23: 'twenty-third',
  24: 'twenty-fourth',
  25: 'twenty-fifth',
  26: 'twenty-sixth',
  27: 'twenty-seventh',
  28: 'twenty-eighth',
  29: 'twenty-ninth',
  30: 'thirtieth',
  31: 'thirty-first',
};

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** `1` → "first", `13` → "13th" (the slate will never be that long). */
function ordinalWord(n: number): string {
  return ORDINALS[n - 1] ?? `${n}th`;
}

/** `'1 min read'` → "one minute to read"; `'5 min read'` → "five minutes to read". */
export function readTimePhrase(readTime: string): string {
  const match = /(\d+)/.exec(readTime);

  if (!match) return readTime;

  const minutes = Number(match[1]);
  const word = SMALL_NUMBERS[minutes] ?? String(minutes);

  return `${word} minute${minutes === 1 ? '' : 's'} to read`;
}

/** `'2026-02-14'` → "the fourteenth of February" (calendar date, no TZ). */
export function datePhrase(publishedAt: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(publishedAt);

  if (!match) return publishedAt;

  const month = MONTHS[Number(match[2]) - 1];
  const day = DAY_ORDINALS[Number(match[3])];

  if (!month || !day) return publishedAt;

  return `the ${day} of ${month}`;
}

/** Oldest first, so a post's slate number never changes when new ones ship. */
export function postsInSlateOrder(
  posts: readonly BlogPostMeta[],
): BlogPostMeta[] {
  return [...posts].sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));
}

/**
 * The 打一文 clue for the n-th published post (1-based, oldest first):
 * "The first post; one minute to read; dated the fourteenth of February."
 * Every clause is a fact of the front matter (`readTime`, `date`).
 */
export function postClue(post: BlogPostMeta, ordinal: number): string {
  return `The ${ordinalWord(ordinal)} post; ${readTimePhrase(post.readTime)}; dated ${datePhrase(post.publishedAt)}.`;
}

export function postHref(post: Pick<BlogPostMeta, 'slug'>): string {
  return `/blog/${post.slug}`;
}

// ---------------------------------------------------------------------------
// Slate and rotation
// ---------------------------------------------------------------------------

/** `03/12`: five tabular mono glyphs fit the 36 px strip interior at 10 px. */
export function indexLabel(index: number, total: number): string {
  return `${String(index).padStart(2, '0')}/${String(total).padStart(2, '0')}`;
}

export function riddleAriaLabel(clue: string, answer: string): string {
  return `Lantern riddle: ${clue} Answer: ${answer}`;
}

/**
 * The full slate in order: the eleven project riddles, then one riddle per
 * published post (oldest first). `total` is the slate size for every entry.
 */
export function riddleSlate(
  posts: readonly BlogPostMeta[] = [],
  script: FestivalScript = festival.script,
): Riddle[] {
  const orderedPosts = postsInSlateOrder(posts);
  const total = PROJECT_RIDDLES.length + orderedPosts.length;
  const answerLabel = ANSWER_LABELS[script];

  const projectRiddles = PROJECT_RIDDLES.map((entry, i): Riddle => {
    const project = findProject(entry.title);

    if (!project) {
      throw new Error(`festivalRiddles: no project titled ${entry.title}`);
    }

    return {
      index: i + 1,
      total,
      pool: 'project',
      clue: entry.clue,
      target: RIDDLE_TARGETS.project[script],
      answer: project.title,
      answerLabel,
      href: project.link,
      external: /^https?:\/\//.test(project.link),
      label: indexLabel(i + 1, total),
      ariaLabel: riddleAriaLabel(entry.clue, project.title),
      sources: entry.sources,
    };
  });

  const postRiddles = orderedPosts.map((post, i): Riddle => {
    const index = PROJECT_RIDDLES.length + i + 1;
    const clue = postClue(post, i + 1);

    return {
      index,
      total,
      pool: 'post',
      clue,
      target: RIDDLE_TARGETS.post[script],
      answer: post.title,
      answerLabel,
      href: postHref(post),
      external: false,
      label: indexLabel(index, total),
      ariaLabel: riddleAriaLabel(clue, post.title),
      sources: [
        { field: 'readTime', keywords: [post.readTime] },
        { field: 'publishedAt', keywords: [post.publishedAt.slice(0, 10)] },
      ],
    };
  });

  return [...projectRiddles, ...postRiddles];
}

/** 1-based day of the year in local time (1 on 1 January). */
export function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 1);
  const local = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  return Math.round((local.getTime() - start.getTime()) / 86_400_000) + 1;
}

/**
 * The riddle a route shows today. `routeSeed` comes from
 * `RouteLayout.routeSeed` (0 on `/past-experience`, 5 on `/schedule-a-call`),
 * so the two project-pool pages never coincide. Returns `null` only when the
 * post pool is asked for and no post is published.
 */
export function riddleFor(
  pool: RiddlePool,
  dayOfYearValue: number,
  routeSeed: number,
  posts: readonly BlogPostMeta[] = [],
  script: FestivalScript = festival.script,
): Riddle | null {
  const slate = riddleSlate(posts, script);
  const candidates = slate.filter((riddle) => riddle.pool === pool);

  if (candidates.length === 0) return null;

  const offset = pool === 'project' ? routeSeed : 0;
  const pick = mod(Math.trunc(dayOfYearValue) + offset, candidates.length);

  return candidates[pick];
}

function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

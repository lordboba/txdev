/*
 * The `.ts` extension is deliberate and load-bearing: this module is imported
 * by conceptData.test.mts under `node --test`, whose ESM resolver does not
 * extension-guess. tsconfig sets `allowImportingTsExtensions`, and bundlers
 * resolve the literal path, so the same specifier works in all three.
 */
import {
  experienceGroups,
  experiences,
  projects,
  type Experience,
  type Project,
} from '../../lib/siteData.ts';

export type ConceptViewId = 'profile' | 'work' | 'signals' | 'history';

export type ConceptView = {
  id: ConceptViewId;
  index: string;
  label: string;
  shortLabel: string;
  description: string;
};

export type FeaturedProject = {
  title: string;
  role: string;
  description: string;
  image: string;
  link: string;
  accent: string;
};

export type GitEra = {
  commit: string;
  date: string;
  label: string;
  title: string;
  description: string;
  visualLanguage: string;
  palette: string;
};

export const conceptViews: ConceptView[] = [
  {
    id: 'profile',
    index: '01',
    label: 'In motion',
    shortLabel: 'Profile',
    description:
      'Raised in San Diego, studying CS at UCLA, usually somewhere between LA, SF, New York, and home.',
  },
  {
    id: 'work',
    index: '02',
    label: 'Things shipped',
    shortLabel: 'Work',
    description:
      'I build and ship my own software — all four products below are live — between runs at Scale AI, SafetyKit, Ramp, and Snowflake.',
  },
  {
    id: 'signals',
    index: '03',
    label: 'Open tabs',
    shortLabel: 'Signals',
    description:
      'What I have in rotation right now: personal tools, agent evaluation, and this profile itself.',
  },
  {
    id: 'history',
    index: '04',
    label: 'Version history',
    shortLabel: 'History',
    description:
      'Every visual era this site has lived through, pulled straight from my commit history.',
  },
];

export const companyRun = [
  {
    company: 'Scale AI',
    period: '2024—25',
    detail: 'Coding and reasoning evaluation loops',
  },
  {
    company: 'SafetyKit',
    period: '2025',
    detail: 'Agentic trust and safety workflows',
  },
  {
    company: 'Ramp',
    period: '2026',
    detail: 'Agents for reimbursements',
  },
  {
    company: 'Snowflake',
    period: '2026',
    detail: 'Data platforms and collaboration',
  },
];

/**
 * One hanging tag per place the work was done, in the order the run happened,
 * with the credential last.
 *
 * Every field on a tag is a join, never a rewrite: `mark` and `logo` name the
 * verified asset in public/logos, `run` is the short label the company run
 * already carries, and everything else — the legal org name, the role title,
 * the dated period, the summary and the proof line — is lifted verbatim from
 * the matching record in lib/siteData `experiences`. A tag can therefore never
 * claim anything the resume does not: if a record disappears, its tag does
 * too, rather than falling back to invented copy.
 */
export type CompanyTag = {
  /** Display name, and the key into the logo table on both surfaces. */
  mark: string;
  logo: string;
  /** The org exactly as the experience record names it. */
  org: string;
  role: string;
  /** Dated period from the record, e.g. "Nov 2024 to May 2025". */
  period: string;
  /** Short run label from `companyRun`, absent for the credential. */
  run: string | null;
  /** One-line focus from `companyRun`, absent for the credential. */
  detail: string | null;
  status: Experience['status'];
  statusLabel: string;
  summary: string;
  proof: string;
  focus: string[];
};

const TAG_SOURCES: { mark: string; logo: string; record: string }[] = [
  { mark: 'Scale AI', logo: '/logos/scale-ai.svg', record: 'Scale AI' },
  { mark: 'SafetyKit', logo: '/logos/safetykit.svg', record: 'SafetyKit' },
  { mark: 'Ramp', logo: '/logos/ramp.svg', record: 'Ramp' },
  { mark: 'Snowflake', logo: '/logos/snowflake.svg', record: 'Snowflake' },
  {
    mark: 'UCLA',
    logo: '/logos/ucla.svg',
    record: 'Upsilon Pi Epsilon @ UCLA',
  },
];

export const companyTags: CompanyTag[] = TAG_SOURCES.flatMap((source) => {
  const record = experiences.find((entry) => entry.company === source.record);

  if (!record) {
    return [];
  }

  const run = companyRun.find((entry) => entry.company === source.mark) ?? null;
  const group = experienceGroups.find(
    (entry) => entry.status === record.status,
  );

  return [
    {
      mark: source.mark,
      logo: source.logo,
      org: record.company,
      role: record.role,
      period: record.period,
      run: run ? run.period : null,
      detail: run ? run.detail : null,
      status: record.status,
      statusLabel: group ? group.label : record.status,
      summary: record.summary,
      proof: record.proof,
      focus: record.focus,
    },
  ];
});

export const featuredProjects: FeaturedProject[] = [
  {
    title: 'iCalarms',
    role: 'iOS product',
    description:
      'Calendar events become configurable alarm rules, timelines, and native scheduling behavior.',
    image: '/projects/icalarms.png',
    link: 'https://icalarms.vercel.app',
    accent: 'AlarmKit / EventKit',
  },
  {
    title: 'Personal Env',
    role: 'macOS product',
    description:
      'A local-first environment variable manager with Keychain storage and explicit folder access.',
    image: '/projects/personal-env.png',
    link: 'https://personal-env.vercel.app',
    accent: 'SwiftUI / Keychain',
  },
  {
    title: 'Med Negotiate',
    role: 'AI workflow',
    description:
      'A medical-bill audit and negotiation workflow built around real cases and provider outreach.',
    image: '/projects/med-negotiate.png',
    link: 'https://med-negotiate-yvml.vercel.app',
    accent: 'Next.js / AI SDK',
  },
  {
    title: 'Charades 2026',
    role: 'iOS game',
    description:
      'A native party game with custom decks, tilt controls, commerce, and release gates.',
    image: '/projects/charades-2026.png',
    link: 'https://charades-2026.vercel.app',
    accent: 'SwiftUI / StoreKit 2',
  },
];

/**
 * Everything in the full project list that is NOT one of the four shipped
 * products staged on the bench. These are the gallery hang behind the side
 * projects tablet — same records, same real links, no second copy of the data.
 *
 * `image` is nullable on purpose: one entry has no capture in public/projects,
 * and inventing a screenshot for it would be the one thing this gallery must
 * never do. The renderer draws a stated "no capture" plate instead.
 */
export type SideProject = {
  title: string;
  role: string;
  description: string;
  tech: string[];
  link: string;
  linkLabel: string;
  image: string | null;
};

const FEATURED_TITLES = new Set(featuredProjects.map((entry) => entry.title));

export const sideProjects: SideProject[] = projects
  .filter((entry: Project) => !FEATURED_TITLES.has(entry.title))
  .map((entry: Project) => ({
    title: entry.title,
    role: entry.role,
    description: entry.description,
    tech: entry.tech,
    link: entry.link,
    linkLabel: entry.linkLabel,
    image: entry.image ?? null,
  }));

export const experiments = [
  {
    number: 'A',
    status: 'Shipping',
    title: 'Personal software that earns a permanent place',
    description:
      'Testing whether focused, local-first tools can replace small recurring frictions in my own life.',
  },
  {
    number: 'B',
    status: 'Measuring',
    title: 'Agent reliability through explicit evaluation',
    description:
      'Benchmark runners, resume-safe workflows, and visible failure accounting instead of a polished demo alone.',
  },
  {
    number: 'C',
    status: 'Collecting',
    title: 'A profile that changes with the question',
    description:
      'This interface itself: one identity, several useful cuts, and no single canonical homepage.',
  },
];

export const personalNotes = [
  'Raised in San Diego',
  'Computer Science at UCLA',
  'Former cross-country and track runner',
  'Usually between Los Angeles, San Francisco, New York, and San Diego',
];

export const gitEras: GitEra[] = [
  {
    commit: '96ccd76',
    date: '2025-11-17',
    label: 'Foundation',
    title: 'The first portfolio',
    description:
      'A direct personal site arrives: portrait, profile, and the first structured pass at the work.',
    visualLanguage: 'Editorial profile',
    palette: 'Paper / ink / rust',
  },
  {
    commit: '79348e8',
    date: '2025-11-18',
    label: 'Terminal',
    title: 'The interface becomes a command',
    description:
      'A terminal moves onto the homepage and turns navigation into something exploratory and slightly hidden.',
    visualLanguage: 'CLI as portfolio',
    palette: 'Charcoal / phosphor',
  },
  {
    commit: '46a72ca',
    date: '2026-03-23',
    label: 'Scene',
    title: 'Information enters orbit',
    description:
      'The site moves from a document into an interactive scene with rings, panels, and a more spatial identity.',
    visualLanguage: 'Spatial interface',
    palette: 'Night / signal gold',
  },
  {
    commit: '4fc5d06',
    date: '2026-04-18',
    label: 'Orbital',
    title: 'A complete orbital system',
    description:
      'Themes, axes, content modes, and richer information make the homepage feel like a small instrument.',
    visualLanguage: 'Interactive atlas',
    palette: 'Dusk / brass / sage',
  },
  {
    commit: 'daebe22',
    date: '2026-04-18',
    label: 'Dusk',
    title: 'The system quiets down',
    description:
      'The orbital idea is retained while the composition, motion, and color settle into the current warm direction.',
    visualLanguage: 'Warm technical editorial',
    palette: 'Umber / parchment / gold',
  },
  {
    commit: 'ad3e87a',
    date: '2026-05-26',
    label: 'Proof',
    title: 'The work becomes visible',
    description:
      'Real screenshots and live links shift the portfolio from describing products to showing them.',
    visualLanguage: 'Product evidence',
    palette: 'Dusk / screen color',
  },
];

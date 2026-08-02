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
    /*
     * Framing copy only. The biographical fields — home, study, rotation —
     * are engraved on the badge in the scene (and printed by its DOM twin on
     * mobile), so the dek must not recite them a second time on the same
     * screen.
     */
    description:
      'The whole record is engraved on one badge. Lean in and read it — the links below go the places an engraving cannot.',
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

/* ========================================================================== *
 * TEMPLATE COPY — Tyler to tune                                              *
 * ==========================================================================
 *
 * Everything between this banner and the closing one is the *only* place the
 * signals elaboration panel gets its words from. It is deliberately one block
 * so a rewrite is one edit in one file, not a hunt through a 5,700-line scene.
 *
 * Two rules this block is written under, and must keep being written under:
 *
 *   1. No invented facts. Every concrete noun here already exists somewhere in
 *      the repo — the four shipped products and their proof lines in
 *      lib/siteData `projects`, the run in `experiences`, the routes under
 *      app/, the commits in `gitEras`, and the two working drafts in
 *      content/blog/drafts. Nothing claims a metric, a date, or an outcome
 *      that is not already written down.
 *   2. `readout` and `next` are stated as intentions in the first person, not
 *      as results. An experiment that is still running has not concluded, and
 *      the panel must not read as though it has.
 *
 * The panel prints `notesLabel` beside the record so the page never presents
 * this as finished copy.
 */

export type ExperimentNote = {
  /** Joins onto `experiments[].number`. */
  number: string;
  /** The question the experiment is actually asking. */
  question: string;
  /** What is running right now, one line per thread. */
  running: string[];
  /** The bar being held — an intention, never a claimed result. */
  readout: string;
  /** Things that already exist in the repo or are already shipped. */
  evidence: string[];
  /** Where this goes if the readout holds. */
  next: string;
};

/** The honest marker the elaboration panel prints on itself. */
export const notesLabel = 'Draft notes';

export const experimentNotes: ExperimentNote[] = [
  {
    number: 'A',
    question:
      'Does a tool built for one person survive a month of ordinary use, or does it get uninstalled once the novelty of having built it wears off?',
    running: [
      'iCalarms — calendar events turned into configurable alarm rules, day timelines, and snooze behavior, running against my own calendar.',
      'Personal Env — environment variables in the Apple Keychain behind Touch ID, with explicit per-folder approval, used across my own projects.',
      'Med Negotiate — line-item bill extraction, pricing audit, and provider outreach, built around real cases rather than a sample file.',
      'Charades 2026 — the one built for other people: bundled decks, custom deck import, tilt play, and StoreKit commerce.',
    ],
    readout:
      'The bar I am holding these to is not downloads. It is whether I still open them without reminding myself that I made them.',
    evidence: [
      'Four products live at their own addresses, each linked from the work view',
      'App Store support surfaces and submission gates on the two iOS builds',
      'Local-first storage paths — Keychain vaults, Touch ID unlock, dotenv import and export',
    ],
    next: 'Keep the ones that stayed installed, and retire the ones that did not, in public.',
  },
  {
    number: 'B',
    question:
      'Does agent reliability come from better prompting, or from boring infrastructure — explicit states, bounded toolsets, and a failure count nobody is allowed to drop?',
    running: [
      'A TruthfulQA benchmark runner: forced binary comparisons, frozen question sets, answer-order controls, and provider budgets.',
      'Resume-safe runs — JSONL integrity checks and resume validation, so a run that dies halfway is continued rather than restarted and quietly re-scored.',
      'Invalid-output accounting kept inside the report instead of removed from the denominator.',
      'A working draft, "Agent Workflows Need Boring Guardrails": classify, bound the toolset, retry under strict timeouts, escalate when confidence drops.',
    ],
    readout:
      'I want a number I would be willing to show someone who disagrees with me, with the failures still in it.',
    evidence: [
      'Completed controlled runs against both an OpenAI and an Anthropic model, with cost tracking',
      'A persisted run-state machine — queued, running, needs review, completed, failed',
      'Evaluation loops at Scale AI, agentic trust and safety at SafetyKit, reimbursement agents at Ramp',
    ],
    next: 'Publish the guardrails draft with the run reports attached to it, rather than as an opinion piece.',
  },
  {
    number: 'C',
    question:
      'Can one person have several honest homepages, so that a recruiter, an engineer, and a friend each land on the cut that answers their question?',
    running: [
      'This bench — four views over a single scene: the work, the person, the open questions, and the version history.',
      'A terminal homepage at /terminal, from the era where navigation became a command instead of a menu.',
      'An orbital homepage at /orbital, where the same records are axes, themes, and content modes.',
      'Every earlier visual era kept reachable in the history view instead of being rewritten away.',
    ],
    readout:
      'It works if someone can tell me which cut they were looking at without my having to name the tabs for them.',
    evidence: [
      'Six commits, 96ccd76 through ad3e87a, each still readable as its own era',
      'Two live alternate homepages under app/, not screenshots of retired ones',
      'A working draft on treating terminal convention as information architecture rather than decoration',
    ],
    next: 'Let the entry point follow the question that brought someone here, instead of asking them to pick.',
  },
];

/* ========================================================================== *
 * END TEMPLATE COPY                                                          *
 * ========================================================================== */

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

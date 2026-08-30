export type ConceptViewId = 'profile' | 'work' | 'signals' | 'history';

export type ConceptView = {
  id: ConceptViewId;
  index: string;
  label: string;
  shortLabel: string;
  heading: string;
  description: string;
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
    heading: 'Welcome to my site!',
    /*
     * Framing copy only. The biographical fields — home, study, rotation —
     * are engraved on the badge in the scene (and printed by its DOM twin on
     * mobile), so the dek must not recite them a second time on the same
     * screen.
     */
    description:
      'Sharing my dev work, experiments, and personal thoughts here :)',
  },
  {
    id: 'work',
    index: '02',
    label: 'Things shipped',
    shortLabel: 'Work',
    heading: 'Hi, I’m Tyler Xiao.',
    description: "I've worked at Scale AI, SafetyKit, and Ramp.",
  },
  {
    id: 'signals',
    index: '03',
    label: 'Open tabs',
    shortLabel: 'Signals',
    heading: 'Here’s what I’m testing.',
    description:
      'Right now, I’m building tools for myself, evaluating agents, and finishing this site.',
  },
  {
    id: 'history',
    index: '04',
    label: 'Version history',
    shortLabel: 'History',
    heading: 'Previous site history.',
    description: 'Earlier versions, oldest to newest.',
  },
];

export const experiments = [
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
 *      the repo — the shipped products in content/projectData, the run in
 *      content/experienceData, the routes under app/, the commits in `gitEras`,
 *      and the two working drafts in content/blog/drafts. Nothing claims a
 *      metric, a date, or an outcome that is not already written down.
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
      'Does workflow reliability come from better instructions, or from explicit states, bounded tools, and visible failures?',
    running: [
      'Resume-safe runs with JSONL integrity checks and validation, so interrupted work can continue without being quietly re-scored.',
      'Invalid-output accounting kept inside the report instead of removed from the denominator.',
      'A working draft, "Agent Workflows Need Boring Guardrails": classify, bound the toolset, retry under strict timeouts, escalate when confidence drops.',
    ],
    readout:
      'I want a number I would be willing to show someone who disagrees with me, with the failures still in it.',
    evidence: [
      'A persisted run-state machine — queued, running, needs review, completed, failed',
      'Evaluation loops at Scale AI, trust and safety automation at SafetyKit, reimbursement workflows at Ramp',
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

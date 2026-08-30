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
    label: 'Current efforts',
    shortLabel: 'Signals',
    heading: 'Here are some of my current efforts:',
    description:
      'I’m hosting Codex meetups, improving AI developer experience inside companies, and sharing what I learn in public.',
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
    status: 'Organizing',
    title: 'Hosting Codex meetups',
    description:
      'I’m a Codex Ambassador, and I host roughly monthly meetups wherever I happen to be. They bring together builders who use agents, share what they’re working on, and build cool projects with them.',
  },
  {
    number: 'B',
    status: 'Engineering',
    title: 'Improving AI developer experience',
    description:
      'Professionally, I’m interested in AI developer experience: how organizations can improve the way they use AI systems and build shared infrastructure that makes those systems more useful across the company.',
  },
  {
    number: 'C',
    status: 'Posting',
    title: 'Sharing what I’m learning',
    description:
      'Catch me on Twitter or LinkedIn to follow along with my professional journey and see my takes on tech, AI, and other fun stuff!',
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
export const notesLabel = 'Current effort';

export const experimentNotes: ExperimentNote[] = [
  {
    number: 'A',
    question:
      'I’m a Codex Ambassador, and I host roughly monthly meetups wherever I happen to be.',
    running: [
      'Hosting roughly monthly Codex meetups in whichever city I am in.',
      'Bringing together builders who use agents, share what they are working on, and build cool projects with them.',
      "Helping host Ramp's Builders Cup and judging the Codex prize track.",
    ],
    readout:
      'I care about meeting builders in person and giving them a place to learn from one another.',
    evidence: [
      'Codex Ambassador',
      'Six Codex events hosted so far',
      "Ramp's Builders Cup host and Codex prize track judge",
    ],
    next: 'Keep hosting meetups as I move between cities and make hands-on building the center of each event.',
  },
  {
    number: 'B',
    question:
      'Professionally, I’m interested in how organizations can improve the way they use AI systems.',
    running: [
      'Looking at how developers across an organization can use AI systems more effectively.',
      'Building shared infrastructure so useful AI workflows can be reused across teams.',
      'Learning where AI fits into day-to-day software development and where it gets in the way.',
    ],
    readout:
      'I want AI to be genuinely useful inside a company, not simply available.',
    evidence: [
      'Reusable tools and workflows instead of one-off setups',
      'Infrastructure that improves as teams learn what works',
    ],
    next: 'Keep finding repeated developer needs and turn the useful patterns into shared systems.',
  },
  {
    number: 'C',
    question:
      'Catch me on Twitter or LinkedIn to follow along with my professional journey.',
    running: [
      'Posting about my professional journey on Twitter and LinkedIn.',
      'Sharing my takes on tech and AI.',
      'Making room for fun stuff that catches my attention.',
    ],
    readout:
      'I want my posts to sound like me and make it easy to follow what I am working on.',
    evidence: ['Twitter at @tylerxdev', 'LinkedIn at /in/tyler-xiao'],
    next: 'Post more consistently and keep the mix broad enough to reflect what I actually care about.',
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
    description: 'The first foundations of my personal site.',
    visualLanguage: 'Editorial profile',
    palette: 'Paper / ink / rust',
  },
  {
    commit: '79348e8',
    date: '2025-11-18',
    label: 'Terminal',
    title: 'Design #1, Terminal',
    description: 'I added a simple terminal to the homepage for my site!',
    visualLanguage: 'CLI as portfolio',
    palette: 'Charcoal / phosphor',
  },
  {
    commit: '46a72ca',
    date: '2026-03-23',
    label: 'Scene',
    title: 'Orbit, SAAS, a step back',
    description:
      'After several iterations, I was very concerned that my site was too much like a SAAS website. I took a step back and changed it to an orbit-style site.',
    visualLanguage: 'Spatial interface',
    palette: 'Night / signal gold',
  },
  {
    commit: '4fc5d06',
    date: '2026-04-18',
    label: 'Orbital',
    title: 'A complete orbital system',
    description:
      'Pushing this orbital idea further, I added a whole solar system design to the homepage.',
    visualLanguage: 'Interactive atlas',
    palette: 'Dusk / brass / sage',
  },
  {
    commit: 'ad3e87a',
    date: '2026-05-26',
    label: 'Enhanced Proof',
    title: 'My work becomes visible',
    description:
      'Added better screenshots and live links of my personal projects',
    visualLanguage: 'Product evidence',
    palette: 'Dusk / screen color',
  },
];

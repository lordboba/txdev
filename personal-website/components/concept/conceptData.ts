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
    description: 'The person, places, and momentum behind the work.',
  },
  {
    id: 'work',
    index: '02',
    label: 'Things shipped',
    shortLabel: 'Work',
    description: 'A visual cut through products, systems, and responsibility.',
  },
  {
    id: 'signals',
    index: '03',
    label: 'Open tabs',
    shortLabel: 'Signals',
    description: 'Experiments in progress, questions, and what is in rotation.',
  },
  {
    id: 'history',
    index: '04',
    label: 'Version history',
    shortLabel: 'History',
    description: 'A curated walk through the website’s distinct visual eras.',
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

export type Experience = {
  role: string;
  company: string;
  start: string;
  end: string;
  period: string;
  status: 'upcoming' | 'current' | 'past';
  summary: string;
  proof: string;
  focus: string[];
};

export type Project = {
  title: string;
  role: string;
  description: string;
  proof: string;
  proofLabel: string;
  tech: string[];
  link: string;
  linkLabel: string;
  image?: string;
};

export type ExperienceGroup = {
  status: Experience['status'];
  label: string;
  description: string;
  items: Experience[];
};

export const experiences: Experience[] = [
  {
    role: 'Software Engineering Intern',
    company: 'Decagon AI',
    start: 'Sep 2026',
    end: 'Dec 2026',
    period: 'Sep 2026 to Dec 2026',
    status: 'upcoming',
    summary: 'Machine learning engineering',
    proof: 'Incoming software engineering role focused on machine learning.',
    focus: ['Machine Learning', 'Software Engineering'],
  },
  {
    role: 'Software Engineering Intern',
    company: 'Ramp',
    start: 'Jun 2026',
    end: 'Sep 2026',
    period: 'Jun 2026 to Sep 2026',
    status: 'upcoming',
    summary: 'Build Agents for reimbursements',
    proof: 'Incoming agent workflow role for reimbursement automation.',
    focus: ['Workflow Systems', 'Backend Systems'],
  },
  {
    role: 'Member of Technical Staff',
    company: 'SafetyKit',
    start: 'Jun 2025',
    end: 'Sep 2025',
    period: 'Jun 2025 to Sep 2025',
    status: 'past',
    summary:
      'First intern owning trust and safety review workflows, helping the team ship automation that humans actually trusted.',
    proof:
      'Owned agentic review workflows in a trust and safety production context.',
    focus: ['Workflow Systems', 'Trust & Safety'],
  },
  {
    role: 'Induction & Membership Chair',
    company: 'Upsilon Pi Epsilon @ UCLA',
    start: 'May 2025',
    end: 'Present',
    period: 'May 2025 to Present',
    status: 'current',
    summary:
      'Scaled onboarding for the honor society and built Discord automation to keep events organized for a fast-growing membership base.',
    proof:
      'Runs membership systems and automation for UCLA computer science honor society onboarding.',
    focus: ['Leadership', 'Automation'],
  },
  {
    role: 'Technical Advisor Intern',
    company: 'Scale AI',
    start: 'Nov 2024',
    end: 'May 2025',
    period: 'Nov 2024 to May 2025',
    status: 'past',
    summary:
      'Trained generative AI systems on complex coding and reasoning tasks, designing eval loops that kept quality high while throughput scaled.',
    proof:
      'Designed coding and reasoning evaluation loops for generative AI training quality.',
    focus: ['Evaluation Systems', 'Quality'],
  },
];

export const experienceGroups: ExperienceGroup[] = [
  {
    status: 'upcoming',
    label: 'Upcoming',
    description: 'Committed roles that have not started yet.',
    items: experiences.filter((exp) => exp.status === 'upcoming'),
  },
  {
    status: 'current',
    label: 'Current',
    description: 'Active work and leadership responsibilities.',
    items: experiences.filter((exp) => exp.status === 'current'),
  },
  {
    status: 'past',
    label: 'Past',
    description: 'Completed roles and shipped responsibility.',
    items: experiences.filter((exp) => exp.status === 'past'),
  },
];

export const projects: Project[] = [
  {
    title: 'iCalarms',
    role: 'iOS Product Engineer',
    description:
      'Calendar alarm app that lets people turn calendar events into configurable alarm rules, day timelines, snooze behavior, and App Store-ready support flows.',
    proof:
      'EventKit calendar access, AlarmKit-aware scheduling, Google calendar import, Pro entitlement plumbing, and App Store support surfaces.',
    proofLabel: 'Live website',
    tech: ['SwiftUI', 'EventKit', 'AlarmKit', 'Next.js'],
    link: 'https://icalarms.vercel.app',
    linkLabel: 'Open website',
    image: '/projects/icalarms.png',
  },
  {
    title: 'Charades 2026',
    role: 'iOS Product Engineer',
    description:
      'Native SwiftUI party game with a large bundled deck catalog, custom decks, tilt-controlled gameplay, StoreKit commerce, and release verification gates.',
    proof:
      '178 bundled decks, custom deck import/export, StoreKit 2 products, Game Center state sync, and App Store submission evidence.',
    proofLabel: 'Live website',
    tech: ['SwiftUI', 'StoreKit 2', 'Game Center', 'Next.js'],
    link: 'https://charades-2026.vercel.app',
    linkLabel: 'Open website',
    image: '/projects/charades-2026.png',
  },
  {
    title: 'Personal Env',
    role: 'macOS Product Engineer',
    description:
      'Native macOS utility for developers managing project environment variables with Apple Keychain storage, device authentication, and explicit local folder approval.',
    proof:
      'Local-first secret vaults, Touch ID unlock, dotenv import/export, project scanning, and a bundled CLI installer path.',
    proofLabel: 'Live website',
    tech: ['SwiftUI', 'Keychain', 'Local Auth', 'Next.js'],
    link: 'https://personal-env.vercel.app',
    linkLabel: 'Open website',
    image: '/projects/personal-env-card.svg',
  },
  {
    title: 'Personal Software Builder',
    role: 'Desktop Product Engineer',
    description:
      'Desktop workbench for cloning, inspecting, running, and personalizing open-source projects with visible approvals around local repo mutation.',
    proof:
      'Guided brief intake, GitHub source handling, managed local app folders, command approval flows, and publish boundaries.',
    proofLabel: 'App repo',
    tech: ['Electron', 'React', 'Vite', 'TypeScript'],
    link: 'https://github.com/lordboba/personal-software',
    linkLabel: 'Open app repo',
    image: '/projects/personal-software.png',
  },
  {
    title: 'Med Negotiate',
    role: 'Full Stack AI Engineer',
    description:
      'Medical bill negotiation workflow that extracts line items, audits charges against market pricing, and drafts provider outreach through a case dashboard.',
    proof:
      'Bill upload analysis, CPT and pricing checks, charity-care eligibility, Gmail-connected drafts, inbox sync, and negotiation status tracking.',
    proofLabel: 'Live website',
    tech: ['Next.js', 'Supabase', 'Gmail API', 'AI SDK'],
    link: 'https://med-negotiate-yvml.vercel.app',
    linkLabel: 'Open website',
    image: '/projects/med-negotiate.png',
  },
  {
    title: 'Multiplayer Card Games',
    role: 'Product Engineer',
    description:
      'Full-stack platform for playing Fish and Viet Cong online with synchronized state, matchmaking, and polished animations.',
    proof:
      'Real-time multiplayer state, matchmaking, and browser-playable game flows.',
    proofLabel: 'Live product',
    tech: ['TypeScript', 'Next.js', 'Vercel'],
    link: 'https://35-lproject.vercel.app',
    linkLabel: 'Open live game',
    image: '/projects/multiplayer-card-games.png',
  },
  {
    title: 'StonksGame',
    role: 'Creator',
    description:
      'Discord bot that runs live stock-trading simulations complete with leaderboards, analytics, and Alpha Vantage powered data feeds.',
    proof:
      'Discord-native trading simulation with rankings, analytics, and market data hooks.',
    proofLabel: 'Repository',
    tech: ['Python', 'Discord.py', 'Alpha Vantage API'],
    link: 'https://github.com/lordboba/stonksgame',
    linkLabel: 'View repository',
    image: '/projects/stonksgame.png',
  },
  {
    title: 'Wildfire Detection',
    role: 'ML Engineer',
    description:
      'Telemetry pipeline that ingests air-quality data and flags wildfire risk via TensorFlow models and alerting hooks.',
    proof:
      'Telemetry ingest, model inference, and alert routing for environmental risk signals.',
    proofLabel: 'System diagram',
    tech: ['TypeScript', 'TensorFlow', 'Node.js'],
    link: 'https://github.com/lordboba/wildfire-detection',
    linkLabel: 'View repository',
  },
  {
    title: 'DocuPilot',
    role: 'Workflow Engineer',
    description:
      'Google Drive agent that executes document workflows from natural language chat, handling routing, summarization, and task updates.',
    proof:
      'Natural-language Drive workflows with routing, summarization, and task execution.',
    proofLabel: 'Agent workflow',
    tech: ['FastAPI', 'LangChain', 'Gemini API', 'React'],
    link: 'https://github.com/lordboba/docupilot',
    linkLabel: 'View repository',
  },
  {
    title: 'Kinetic',
    role: 'Full Stack Engineer',
    description:
      'Automated lecture builder that uses instructor and TA agents to deliver multi-modal lessons with live collaboration tools.',
    proof:
      'Instructor and TA agent loop with live collaboration infrastructure.',
    proofLabel: 'Learning system',
    tech: ['Next.js', 'Fastify', 'LiveKit', 'Anthropic Claude API'],
    link: 'https://github.com/safinsingh/LectureGen',
    linkLabel: 'View repository',
    image: '/projects/kinetic.png',
  },
  {
    title: 'Grow & Give',
    role: 'iOS Developer',
    description:
      'SwiftUI productivity app that helps students set goals and stay accountable through habit tracking and gentle reminders.',
    proof: 'Native SwiftUI accountability flow for student habit tracking.',
    proofLabel: 'iOS app',
    tech: ['Swift', 'SwiftUI'],
    link: 'https://github.com/lordboba/PAR',
    linkLabel: 'View repository',
    image: '/projects/grow-and-give.png',
  },
];

export const quickFacts = [
  { label: 'Location', value: 'San Diego, Los Angeles, San Francisco, NYC' },
  {
    label: 'Education',
    value: "UCLA B.S. in Computer Science '27",
  },
  {
    label: 'Focus',
    value: 'Product software, backend systems, developer tools',
  },
];

export const contactLinks = [
  { label: 'Email', href: 'mailto:tylerxiao@ucla.edu' },
  { label: 'GitHub', href: 'https://github.com/lordboba' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/tyler-xiao' },
  { label: 'Twitter', href: 'https://x.com/tylerxdev' },
  {
    label: 'Buy Me a Coffee',
    href: 'https://buymeacoffee.com/yxiao1717o',
  },
];

export const callHighlights = [
  'A short introduction and context for the conversation.',
  'Time to compare notes on projects, engineering, or work.',
  'A clear follow-up if there is one.',
];

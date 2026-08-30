export type BenchProjectData = {
  order: number;
  role: string;
  description: string;
  accent: string;
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
  bench?: BenchProjectData;
};

export type FeaturedProject = {
  title: string;
  role: string;
  description: string;
  image: string;
  link: string;
  accent: string;
};

export type SideProject = {
  title: string;
  role: string;
  description: string;
  tech: string[];
  link: string;
  linkLabel: string;
  image: string | null;
};

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
    bench: {
      order: 0,
      role: 'iOS product',
      description:
        'Calendar events become configurable alarm rules, timelines, and native scheduling behavior.',
      accent: 'AlarmKit / EventKit',
    },
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
    bench: {
      order: 3,
      role: 'iOS game',
      description:
        'A native party game with custom decks, tilt controls, commerce, and release gates.',
      accent: 'SwiftUI / StoreKit 2',
    },
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
    bench: {
      order: 1,
      role: 'macOS product',
      description:
        'A local-first environment variable manager with Keychain storage and explicit folder access.',
      accent: 'SwiftUI / Keychain',
    },
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
    bench: {
      order: 2,
      role: 'AI workflow',
      description:
        'A medical-bill audit and negotiation workflow built around real cases and provider outreach.',
      accent: 'Next.js / AI SDK',
    },
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

export const featuredProjects: FeaturedProject[] = projects
  .flatMap((project) => {
    if (!project.bench || !project.image) return [];

    return [
      {
        title: project.title,
        role: project.bench.role,
        description: project.bench.description,
        image: project.image,
        link: project.link,
        accent: project.bench.accent,
        order: project.bench.order,
      },
    ];
  })
  .sort((left, right) => left.order - right.order)
  .map((project) => ({
    title: project.title,
    role: project.role,
    description: project.description,
    image: project.image,
    link: project.link,
    accent: project.accent,
  }));

export const sideProjects: SideProject[] = projects
  .filter((project) => !project.bench)
  .map((project) => ({
    title: project.title,
    role: project.role,
    description: project.description,
    tech: project.tech,
    link: project.link,
    linkLabel: project.linkLabel,
    image: project.image ?? null,
  }));

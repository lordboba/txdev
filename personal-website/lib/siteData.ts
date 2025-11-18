export type Experience = {
  role: string;
  company: string;
  start: string;
  end: string;
  summary: string;
  focus: string[];
};

export type Project = {
  title: string;
  role: string;
  description: string;
  tech: string[];
  link: string;
  focus: string[];
};

export type Writing = {
  title: string;
  summary: string;
  date: string;
  link: string;
};

export const experiences: Experience[] = [
  {
    role: "Member of Technical Staff",
    company: "SafetyKit",
    start: "May 2025",
    end: "Sep 2025",
    summary:
      "First intern owning agentic AI workflows for trust & safety review pipelines, helping the team ship automation that humans actually trusted.",
    focus: ["AI Agents", "Trust & Safety"],
  },
  {
    role: "Technical Advisor Intern",
    company: "Scale AI",
    start: "Nov 2024",
    end: "May 2025",
    summary:
      "Trained generative AI systems on complex coding and reasoning tasks, designing eval loops that kept quality high while throughput scaled.",
    focus: ["AI Systems", "Evaluation"],
  },
  {
    role: "Induction & Membership Chair",
    company: "Upsilon Pi Epsilon @ UCLA",
    start: "May 2025",
    end: "Present",
    summary:
      "Scaled onboarding for the honor society and built Discord automation to keep events organized for a fast-growing membership base.",
    focus: ["Leadership", "Automation"],
  },
];

export const projects: Project[] = [
  {
    title: "Multiplayer Card Games",
    role: "Product Engineer",
    description:
      "Full-stack platform for playing Fish and Viet Cong online with synchronized state, matchmaking, and polished animations.",
    tech: ["TypeScript", "Next.js", "Vercel"],
    link: "https://35-lproject.vercel.app",
    focus: ["Realtime", "Web Apps"],
  },
  {
    title: "StonksGame",
    role: "Creator",
    description:
      "Discord bot that runs live stock-trading simulations complete with leaderboards, analytics, and Alpha Vantage powered data feeds.",
    tech: ["Python", "Discord.py", "Alpha Vantage API"],
    link: "https://github.com/lordboba/stonksgame",
    focus: ["Bots", "Finance"],
  },
  {
    title: "Wildfire Detection",
    role: "ML Engineer",
    description:
      "Telemetry pipeline that ingests air-quality data and flags wildfire risk via TensorFlow models and alerting hooks.",
    tech: ["TypeScript", "TensorFlow", "Node.js"],
    link: "https://github.com/lordboba/wildfire-detection",
    focus: ["ML", "Climate"],
  },
  {
    title: "DocuPilot",
    role: "AI Engineer",
    description:
      "Google Drive agent that executes document workflows from natural language chat, handling routing, summarization, and task updates.",
    tech: ["FastAPI", "LangChain", "Gemini API", "React"],
    link: "https://github.com/lordboba/docupilot",
    focus: ["AI Agents", "Automation"],
  },
  {
    title: "Kinetic",
    role: "Full Stack Engineer",
    description:
      "Automated lecture builder that uses instructor and TA agents to deliver multi-modal lessons with live collaboration tools.",
    tech: ["Next.js", "Fastify", "LiveKit", "Anthropic Claude"],
    link: "https://github.com/safinsingh/LectureGen",
    focus: ["AI", "Education"],
  },
  {
    title: "Grow & Give",
    role: "iOS Developer",
    description:
      "SwiftUI productivity app that helps students set goals and stay accountable through habit tracking and gentle reminders.",
    tech: ["Swift", "SwiftUI"],
    link: "https://github.com/lordboba/PAR",
    focus: ["Mobile", "Productivity"],
  },
];

export const writings: Writing[] = [
  {
    title: "Balancing Craft and Velocity in High-Stakes Roadmaps",
    summary:
      "Practical framework for pairing engineering rigor with product discovery when timelines are tight.",
    date: "Dec 2024",
    link: "https://tylerxiao.com/writing/craft-and-velocity",
  },
  {
    title: "Patterns for Human + AI Collaboration in Ops Tools",
    summary:
      "Field notes on when to trust automation, when to defer to humans, and how to keep both informed.",
    date: "Sep 2024",
    link: "https://tylerxiao.com/writing/human-ai-patterns",
  },
  {
    title: "How We Built an Accessible Design Token Pipeline",
    summary:
      "Deep dive on the tooling that keeps 14 product teams aligned on brand and accessibility requirements.",
    date: "Jun 2024",
    link: "https://tylerxiao.com/writing/design-token-pipeline",
  },
];

export const quickFacts = [
  { label: "Location", value: "San Diego native · based in Los Angeles" },
  { label: "Currently", value: "UCLA CSE '27 · Building agentic AI systems" },
  {
    label: "Focus",
    value: "AI agents, backend systems, trust & safety automation",
  },
];

export const contactLinks = [
  { label: "Email", href: "mailto:tylerxiao@ucla.edu" },
  { label: "GitHub", href: "https://github.com/lordboba" },
  { label: "LinkedIn", href: "https://www.linkedin.com/in/tyler-xiao" },
  { label: "Past Experience", href: "/past-experience" },
];

export const callHighlights = [
  "15-minute intro focused on your product goals.",
  "Walk through prior experience relevant to your roadmap.",
  "Identify a concrete next step (advisory, sprint, referral).",
];

export const callSocialProof = [
  "",
];

import { formatPeriod } from '../lib/formatPeriod.ts';

export type ExperienceStatus = 'upcoming' | 'current' | 'past';

export type BenchExperienceData = {
  order: number;
  mark: string;
  logo: string;
  run: string | null;
  detail: string | null;
};

export type Experience = {
  role: string;
  company: string;
  start: string;
  end: string;
  period: string;
  status: ExperienceStatus;
  summary: string;
  proof: string;
  focus: string[];
  bench?: BenchExperienceData;
};

export type ExperienceGroup = {
  status: ExperienceStatus;
  label: string;
  description: string;
  items: Experience[];
};

export type CompanyRunEntry = {
  company: string;
  period: string;
  detail: string;
};

export type CompanyTag = {
  mark: string;
  logo: string;
  org: string;
  role: string;
  period: string;
  run: string | null;
  detail: string | null;
  status: ExperienceStatus;
  statusLabel: string;
  summary: string;
  proof: string;
  focus: string[];
};

const experienceEntries: Omit<Experience, 'period'>[] = [
  {
    role: 'Software Engineering Intern',
    company: 'Decagon AI',
    start: 'Sep 2026',
    end: 'Dec 2026',
    status: 'current',
    summary: 'Building AI developer experience',
    proof:
      'Current software engineering internship building AI developer experience at Decagon.',
    focus: ['AI DevX', 'Developer Tools'],
    bench: {
      order: 0,
      mark: 'Decagon',
      logo: '/logos/decagon.svg',
      run: '2026',
      detail: 'AI developer experience',
    },
  },
  {
    role: 'Software Engineering Intern',
    company: 'Ramp',
    start: 'Jun 2026',
    end: 'Sep 2026',
    status: 'past',
    summary: 'Build Agents for reimbursements',
    proof:
      'Scaled the Reimbursements team’s software and built internal talent-team tooling.',
    focus: ['Workflow Systems', 'Backend Systems'],
    bench: {
      order: 3,
      mark: 'Ramp',
      logo: '/logos/ramp.svg',
      run: '2026',
      detail: 'Agents for reimbursements',
    },
  },
  {
    role: 'Member of Technical Staff',
    company: 'SafetyKit',
    start: 'Jun 2025',
    end: 'Sep 2025',
    status: 'past',
    summary:
      'First intern owning trust and safety review workflows, helping the team ship automation that humans actually trusted.',
    proof:
      'Owned agentic review workflows in a trust and safety production context.',
    focus: ['Workflow Systems', 'Trust & Safety'],
    bench: {
      order: 2,
      mark: 'SafetyKit',
      logo: '/logos/safetykit.svg',
      run: '2025',
      detail: 'Trust and safety workflow automation',
    },
  },
  {
    role: 'Induction & Membership Chair',
    company: 'Upsilon Pi Epsilon @ UCLA',
    start: 'May 2025',
    end: 'Present',
    status: 'current',
    summary:
      'Scaled onboarding for the honor society and built Discord automation to keep events organized for a fast-growing membership base.',
    proof:
      'Runs membership systems and automation for UCLA computer science honor society onboarding.',
    focus: ['Leadership', 'Automation'],
    bench: {
      order: 4,
      mark: 'UCLA',
      logo: '/logos/ucla.svg',
      run: null,
      detail: null,
    },
  },
  {
    role: 'Technical Advisor Intern',
    company: 'Scale AI',
    start: 'Nov 2024',
    end: 'May 2025',
    status: 'past',
    summary:
      'Trained generative AI systems on complex coding and reasoning tasks, designing eval loops that kept quality high while throughput scaled.',
    proof:
      'Designed coding and reasoning evaluation loops for generative AI training quality.',
    focus: ['Evaluation Systems', 'Quality'],
    bench: {
      order: 1,
      mark: 'Scale AI',
      logo: '/logos/scale-ai.svg',
      run: '2024–2025',
      detail: 'Coding and reasoning evaluation loops',
    },
  },
];

export const experiences: Experience[] = experienceEntries.map((entry) => ({
  ...entry,
  period: formatPeriod(entry.start, entry.end),
}));

const experienceGroupMeta: Omit<ExperienceGroup, 'items'>[] = [
  {
    status: 'upcoming',
    label: 'Upcoming',
    description: 'Committed roles that have not started yet.',
  },
  {
    status: 'current',
    label: 'Current',
    description: 'Active work and leadership responsibilities.',
  },
  {
    status: 'past',
    label: 'Past',
    description: 'Completed roles and shipped responsibility.',
  },
];

export const experienceGroups: ExperienceGroup[] = experienceGroupMeta.map(
  (group) => ({
    ...group,
    items: experiences.filter(
      (experience) => experience.status === group.status,
    ),
  }),
);

const benchExperienceRecords = experiences
  .flatMap((experience) =>
    experience.bench ? [{ experience, bench: experience.bench }] : [],
  )
  .sort((left, right) => left.bench.order - right.bench.order);

export const companyRun: CompanyRunEntry[] = benchExperienceRecords.flatMap(
  ({ bench }) =>
    bench.run && bench.detail
      ? [{ company: bench.mark, period: bench.run, detail: bench.detail }]
      : [],
);

export const companyTags: CompanyTag[] = benchExperienceRecords.map(
  ({ experience, bench }) => ({
    mark: bench.mark,
    logo: bench.logo,
    org: experience.company,
    role: experience.role,
    period: experience.period,
    run: bench.run,
    detail: bench.detail,
    status: experience.status,
    statusLabel:
      experienceGroups.find((group) => group.status === experience.status)
        ?.label ?? experience.status,
    summary: experience.summary,
    proof: experience.proof,
    focus: experience.focus,
  }),
);

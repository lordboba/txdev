export type JourneyMapId =
  | 'san-diego'
  | 'ucla'
  | 'san-francisco'
  | 'new-york'
  | 'horizon';

export type JourneyEditorialStatus =
  | 'confirmed'
  | 'needs-tyler'
  | 'source-conflict';

export type JourneyArtifact = {
  id: string;
  label: string;
  asset: string | null;
  sourceNote: string;
};

export type JourneyMapNode =
  | {
      id: string;
      mapId: JourneyMapId;
      label: string;
      x: number;
      y: number;
      kind: 'main';
      beatId: string;
      adjacency: string[];
    }
  | {
      id: string;
      mapId: JourneyMapId;
      label: string;
      x: number;
      y: number;
      kind: 'side';
      artifactId: string;
      adjacency: string[];
    };

export type JourneyBeatRef = { company: string } | { project: string };

export type JourneyBeat = {
  id: string;
  mapId: JourneyMapId;
  title: string;
  period: string;
  story: string[];
  artifactIds: string[];
  interactionId: string;
  nextId: string | null;
  editorialStatus: JourneyEditorialStatus;
  sourceNotes: string[];
  refs: JourneyBeatRef[];
};

export type JourneyMap = {
  id: JourneyMapId;
  name: string;
  placeLabel: string;
};

export type JourneyWordingRule = {
  beatId: string;
  forbidden: string[];
  required: string[];
  note: string;
};

export type JourneyCanonicalRef = {
  beatId: string;
  ref: JourneyBeatRef;
};

export const journeyBeats: JourneyBeat[] = [
  {
    id: '00-wake',
    mapId: 'san-diego',
    title: 'The screen wakes',
    period: 'Now',
    story: [
      'Tyler Xiao?',
      'The short answer fits on this screen. The longer one starts in San Diego.',
      'Learn more.',
    ],
    artifactIds: ['portrait'],
    interactionId: 'wake-display',
    nextId: '01-practices',
    editorialStatus: 'confirmed',
    sourceNotes: [
      'Entry screen copy; the interaction wakes the dark display.',
      'Workshop decision recorded: the Personal Env laptop is the portal.',
    ],
    refs: [],
  },
  {
    id: '01-practices',
    mapId: 'san-diego',
    title: 'San Diego: several ways to learn',
    period: 'Around age eleven or twelve',
    story: [
      'I grew up in San Diego. Around eleven or twelve, I made games in Scratch, then moved into Java for competitive programming. Around the same time, I went to Chinese after-school classes and math competitions. I also spent a lot of time playing cello, and before the pandemic I played water polo. Programming mattered, but it was not the whole story.',
    ],
    artifactIds: ['scratch-or-cello'],
    interactionId: 'visit-week-practices',
    nextId: '02-del-norte',
    editorialStatus: 'confirmed',
    sourceNotes: [
      'Tyler confirmed: Scratch games, then Java competitive programming around age eleven or twelve; Chinese after-school and math competitions in the same period; cello; water polo before the pandemic.',
      'Public support: San Diego upbringing; USACO Silver in eighth grade and Gold in ninth; cello continues through UCLA.',
    ],
    refs: [],
  },
  {
    id: '02-del-norte',
    mapId: 'san-diego',
    title: 'Del Norte: learning to set the pace',
    period: 'High school',
    story: [
      'In high school, I kept two practices running at once. Cross-country and track taught me pace; the Math and Algorithmic Coding clubs taught me how to help a group keep moving. I learned that leadership was less about having the fastest answer and more about making it easier for other people to continue.',
    ],
    artifactIds: ['running-bib'],
    interactionId: 'hold-team-pace',
    nextId: '03-first-app',
    editorialStatus: 'needs-tyler',
    sourceNotes: [
      'Verified: Del Norte, cross-country and track, president of both clubs.',
      'Ask Tyler: exact team leadership title and whether this interpretation feels true.',
    ],
    refs: [],
  },
  {
    id: '03-first-app',
    mapId: 'san-diego',
    title: 'The first app for someone else',
    period: '2022 to 2023',
    story: [
      'Grow & Give turned focused minutes into progress inside an app and support for real nonprofits. Building it meant making choices for someone besides me: what to show, what to store, and what to make easy. A running app was only the beginning.',
    ],
    artifactIds: ['grow-and-give-app'],
    interactionId: 'plan-focus-reflect',
    nextId: '04-ucla',
    editorialStatus: 'needs-tyler',
    sourceNotes: [
      "Verified: Swift and MongoDB app, 2022-2023, first place in the fair's senior computer-science category.",
      'Ask Tyler: is Grow & Give the app you mean, or should this beat use RideHop?',
    ],
    refs: [{ project: 'Grow & Give' }],
  },
  {
    id: '04-ucla',
    mapId: 'ucla',
    title: 'UCLA: the map gets larger',
    period: '2024 to present',
    story: [
      'I came to UCLA in 2024 to study computer science. [One academic moment that changed how I approached the work.] [One community moment that changed who I built with.] I kept playing cello in the Symphony Orchestra, so programming was still not the only practice in my week.',
    ],
    artifactIds: ['ucla-mark'],
    interactionId: 'connect-campus-nodes',
    nextId: '05-safetykit',
    editorialStatus: 'needs-tyler',
    sourceNotes: [
      'Verified: degree and coursework; ACM ICPC, UPE, VEST, Symphony Orchestra, tutoring, Jogging Club.',
      'Ask Tyler: one academic moment and one community moment to replace the bracketed placeholders.',
      'Optional beat: Scale AI evaluation work or DocuPilot team leadership during freshman year.',
    ],
    refs: [],
  },
  {
    id: '05-safetykit',
    mapId: 'san-francisco',
    title: 'San Francisco: production starts',
    period: 'Jun 2025 to Sep 2025',
    story: [
      'After freshman year, the route moved north. SafetyKit was my first startup-engineering summer and my first time spending months in San Francisco. I worked on trust-and-safety systems where a pipeline could fail and a reviewer could lose trust. The details mattered because people used the system.',
    ],
    artifactIds: ['safetykit-mark'],
    interactionId: 'repair-production-route',
    nextId: '06-codex',
    editorialStatus: 'confirmed',
    sourceNotes: [
      'Verified: SafetyKit reflection, June to September 2025, first engineering intern, months in San Francisco.',
      'Wording rule: this is the first startup-engineering summer, never the first internship overall; Scale AI appears earlier.',
    ],
    refs: [{ company: 'SafetyKit' }],
  },
  {
    id: '06-codex',
    mapId: 'new-york',
    title: 'Codex: turn the tools into a room',
    period: '2025 to present',
    story: [
      "I wanted technical work to happen in person, too. As a Codex Ambassador, I began hosting campus demos, workshops, and build sessions. Builders brought projects, compared notes, and made things together. The same thread followed me to New York, where I helped organize and judge Ramp's Builders Cup.",
    ],
    artifactIds: ['codex-event'],
    interactionId: 'gather-builders',
    nextId: '07-ramp',
    editorialStatus: 'confirmed',
    sourceNotes: [
      'Verified: ambassador directory; UPE and BMES events; Sundays in LA; Builders Cup role.',
      'Boundary: Ambassador is a community-program role, not employment at the tool vendor.',
    ],
    refs: [{ company: 'Ramp' }],
  },
  {
    id: '07-ramp',
    mapId: 'new-york',
    title: 'New York: build at a larger scale',
    period: 'Summer 2026',
    story: [
      "This summer brought me to New York and Ramp's Reimbursements team. New city, larger system, same question: what would make this workflow genuinely useful to the person depending on it? Building and gathering people started to feel like parts of the same job.",
    ],
    artifactIds: ['ramp-nyc-photo'],
    interactionId: 'ship-reimbursements',
    nextId: '08-horizon',
    editorialStatus: 'confirmed',
    sourceNotes: [
      'Verified: user brief, Reimbursements announcement, public New York and Builders Cup posts.',
      'Repo cleanup: canonical site data still marks Ramp as incoming, which is stale for August 2026.',
    ],
    refs: [{ company: 'Ramp' }],
  },
  {
    id: '08-horizon',
    mapId: 'horizon',
    title: 'Horizon: the unlabelled map',
    period: 'Next',
    story: [
      'One next step is already planned. The rest is not. I want to keep building AI systems that become genuinely useful inside companies, and keep bringing the people using those systems into the same room. The map ends here because the story does not.',
    ],
    artifactIds: ['unprinted-margin'],
    interactionId: 'place-next-pin',
    nextId: null,
    editorialStatus: 'source-conflict',
    sourceNotes: [
      'Conflict: the repository names Decagon AI next; public LinkedIn still says Snowflake.',
      'Ask Tyler: which employer, if any, should appear in the ending; the copy stays employer-neutral until resolved.',
    ],
    refs: [],
  },
];

export const journeyArtifacts: JourneyArtifact[] = [
  {
    id: 'portrait',
    label: 'Portrait',
    asset: '/pfp.JPG',
    sourceNote: 'Existing site portrait already shipped in public/.',
  },
  {
    id: 'scratch-or-cello',
    label: 'Scratch sprite or cello score',
    asset: null,
    sourceNote:
      'Tyler must supply a Scratch game screenshot, a cello score, or a program from that period.',
  },
  {
    id: 'running-bib',
    label: 'Running bib or team photo',
    asset: null,
    sourceNote:
      'Tyler must supply a running bib or a cross-country or track team photo from Del Norte.',
  },
  {
    id: 'grow-and-give-app',
    label: 'Grow & Give screenshot',
    asset: '/projects/grow-and-give.png',
    sourceNote:
      'Existing Grow & Give screenshot from the project gallery in public/.',
  },
  {
    id: 'ucla-mark',
    label: 'UCLA mark',
    asset: '/logos/ucla.svg',
    sourceNote:
      'Existing UCLA mark in public/; Tyler may later swap in a campus, UPE, Symphony, or project-team photo that carries an actual memory.',
  },
  {
    id: 'safetykit-mark',
    label: 'SafetyKit mark',
    asset: '/logos/safetykit.svg',
    sourceNote:
      'Existing SafetyKit mark in public/; Tyler may later swap in an intern presentation, MCP diagram, or his own San Francisco photo.',
  },
  {
    id: 'codex-event',
    label: 'Codex event photo or poster',
    asset: null,
    sourceNote:
      'Tyler must supply a Codex event photo or poster from UCLA, Sundays in LA, or Builders Cup.',
  },
  {
    id: 'ramp-nyc-photo',
    label: 'Ramp New York photo',
    asset: null,
    sourceNote:
      'Tyler must supply a Ramp New York or event photo cleared by company-safe review.',
  },
  {
    id: 'unprinted-margin',
    label: 'Unprinted margin',
    asset: null,
    sourceNote:
      'Intentionally rendered as blank map margin; Tyler may later supply a small note naming the confirmed next stop.',
  },
];

export const journeyNodes: JourneyMapNode[] = [
  {
    id: 'sd-wake',
    mapId: 'san-diego',
    label: 'The dark display',
    x: 14,
    y: 84,
    kind: 'main',
    beatId: '00-wake',
    adjacency: ['sd-wake-artifact', 'sd-practices'],
  },
  {
    id: 'sd-wake-artifact',
    mapId: 'san-diego',
    label: 'Portrait',
    x: 9,
    y: 79,
    kind: 'side',
    artifactId: 'portrait',
    adjacency: ['sd-wake'],
  },
  {
    id: 'sd-practices',
    mapId: 'san-diego',
    label: 'A week of practices',
    x: 20,
    y: 77,
    kind: 'main',
    beatId: '01-practices',
    adjacency: ['sd-wake', 'sd-practice-artifact', 'sd-del-norte'],
  },
  {
    id: 'sd-practice-artifact',
    mapId: 'san-diego',
    label: 'Scratch or cello',
    x: 14,
    y: 71,
    kind: 'side',
    artifactId: 'scratch-or-cello',
    adjacency: ['sd-practices'],
  },
  {
    id: 'sd-del-norte',
    mapId: 'san-diego',
    label: 'Del Norte',
    x: 26,
    y: 71,
    kind: 'main',
    beatId: '02-del-norte',
    adjacency: ['sd-practices', 'sd-track-artifact', 'sd-first-app'],
  },
  {
    id: 'sd-track-artifact',
    mapId: 'san-diego',
    label: 'Running bib',
    x: 31,
    y: 76,
    kind: 'side',
    artifactId: 'running-bib',
    adjacency: ['sd-del-norte'],
  },
  {
    id: 'sd-first-app',
    mapId: 'san-diego',
    label: 'First app',
    x: 30,
    y: 64,
    kind: 'main',
    beatId: '03-first-app',
    adjacency: ['sd-del-norte', 'sd-app-artifact', 'la-ucla'],
  },
  {
    id: 'sd-app-artifact',
    mapId: 'san-diego',
    label: 'Grow & Give',
    x: 36,
    y: 68,
    kind: 'side',
    artifactId: 'grow-and-give-app',
    adjacency: ['sd-first-app'],
  },
  {
    id: 'la-ucla',
    mapId: 'ucla',
    label: 'UCLA',
    x: 33,
    y: 56,
    kind: 'main',
    beatId: '04-ucla',
    adjacency: ['sd-first-app', 'la-ucla-artifact', 'sf-safetykit'],
  },
  {
    id: 'la-ucla-artifact',
    mapId: 'ucla',
    label: 'UCLA mark',
    x: 38,
    y: 60,
    kind: 'side',
    artifactId: 'ucla-mark',
    adjacency: ['la-ucla'],
  },
  {
    id: 'sf-safetykit',
    mapId: 'san-francisco',
    label: 'SafetyKit',
    x: 22,
    y: 30,
    kind: 'main',
    beatId: '05-safetykit',
    adjacency: ['la-ucla', 'sf-safetykit-artifact', 'ny-codex'],
  },
  {
    id: 'sf-safetykit-artifact',
    mapId: 'san-francisco',
    label: 'SafetyKit mark',
    x: 17,
    y: 25,
    kind: 'side',
    artifactId: 'safetykit-mark',
    adjacency: ['sf-safetykit'],
  },
  {
    id: 'ny-codex',
    mapId: 'new-york',
    label: 'Codex community',
    x: 66,
    y: 38,
    kind: 'main',
    beatId: '06-codex',
    adjacency: ['sf-safetykit', 'ny-codex-artifact', 'ny-ramp'],
  },
  {
    id: 'ny-codex-artifact',
    mapId: 'new-york',
    label: 'Event poster',
    x: 62,
    y: 44,
    kind: 'side',
    artifactId: 'codex-event',
    adjacency: ['ny-codex'],
  },
  {
    id: 'ny-ramp',
    mapId: 'new-york',
    label: 'Ramp',
    x: 74,
    y: 32,
    kind: 'main',
    beatId: '07-ramp',
    adjacency: ['ny-codex', 'ny-ramp-artifact', 'horizon-pin'],
  },
  {
    id: 'ny-ramp-artifact',
    mapId: 'new-york',
    label: 'New York photo',
    x: 79,
    y: 37,
    kind: 'side',
    artifactId: 'ramp-nyc-photo',
    adjacency: ['ny-ramp'],
  },
  {
    id: 'horizon-pin',
    mapId: 'horizon',
    label: 'The next pin',
    x: 90,
    y: 14,
    kind: 'main',
    beatId: '08-horizon',
    adjacency: ['ny-ramp', 'horizon-margin'],
  },
  {
    id: 'horizon-margin',
    mapId: 'horizon',
    label: 'Unprinted margin',
    x: 95,
    y: 8,
    kind: 'side',
    artifactId: 'unprinted-margin',
    adjacency: ['horizon-pin'],
  },
];

export const journeyWordingRules: JourneyWordingRule[] = [
  {
    beatId: '05-safetykit',
    forbidden: ['first internship'],
    required: ['first startup-engineering summer'],
    note: 'SafetyKit is the first startup-engineering summer; Scale AI came earlier.',
  },
  {
    beatId: '08-horizon',
    forbidden: ['Decagon', 'Snowflake'],
    required: [],
    note: 'The ending names no employer until the source conflict is resolved.',
  },
  {
    beatId: '06-codex',
    forbidden: ['OpenAI'],
    required: ['Codex Ambassador'],
    note: 'Ambassador is a community role, not OpenAI employment.',
  },
];

const journeyMapMeta: JourneyMap[] = [
  { id: 'san-diego', name: 'San Diego', placeLabel: 'SAN DIEGO' },
  { id: 'ucla', name: 'UCLA', placeLabel: 'LOS ANGELES / UCLA' },
  { id: 'san-francisco', name: 'San Francisco', placeLabel: 'SAN FRANCISCO' },
  { id: 'new-york', name: 'New York', placeLabel: 'NEW YORK' },
  { id: 'horizon', name: 'Horizon', placeLabel: 'HORIZON' },
];

export const journeyMaps: JourneyMap[] = journeyMapMeta.filter((map) =>
  journeyBeats.some((beat) => beat.mapId === map.id),
);

export const beatsByMap: Record<JourneyMapId, JourneyBeat[]> = {
  'san-diego': journeyBeats.filter((beat) => beat.mapId === 'san-diego'),
  ucla: journeyBeats.filter((beat) => beat.mapId === 'ucla'),
  'san-francisco': journeyBeats.filter(
    (beat) => beat.mapId === 'san-francisco',
  ),
  'new-york': journeyBeats.filter((beat) => beat.mapId === 'new-york'),
  horizon: journeyBeats.filter((beat) => beat.mapId === 'horizon'),
};

export const orderedBeatIds: string[] = (() => {
  const beatsById = new Map(journeyBeats.map((beat) => [beat.id, beat]));
  const ids: string[] = [];
  const seen = new Set<string>();
  let current: JourneyBeat | undefined = journeyBeats[0];

  while (current && !seen.has(current.id)) {
    ids.push(current.id);
    seen.add(current.id);
    current =
      current.nextId === null ? undefined : beatsById.get(current.nextId);
  }

  return ids;
})();

export const canonicalRefs: JourneyCanonicalRef[] = journeyBeats.flatMap(
  (beat) => beat.refs.map((ref) => ({ beatId: beat.id, ref })),
);

import { usPlaces, type UsPlace, type UsPlaceId } from './usMapGenerated.ts';

export type JourneyMapId = UsPlaceId;

export type JourneyEditorialStatus =
  | 'confirmed'
  | 'needs-tyler'
  | 'source-conflict';

export type JourneyArtifact = {
  id: string;
  label: string;
  asset: string | null;
  /** Printed under the image only when it says more than the image does. */
  caption?: string;
  sourceNote: string;
};

/**
 * Every node hangs off its map's real city: `dx`/`dy` are an offset from the
 * projected city, in the atlas frame's units (see usMapGenerated.ts), so a
 * cluster of chapters fans out around San Diego without leaving San Diego.
 * The resolved `x`/`y` are derived at module load, never authored.
 */
type JourneyNodeBase = {
  id: string;
  mapId: JourneyMapId;
  label: string;
  dx: number;
  dy: number;
  /** Where the label sits relative to the pin, so labels never sit on the route. */
  labelSide: 'left' | 'right' | 'below';
  adjacency: string[];
};

export type JourneyMapNode = JourneyNodeBase & {
  /** Atlas-frame coordinates, resolved from the map's city plus the offset. */
  x: number;
  y: number;
} & ({ kind: 'main'; beatId: string } | { kind: 'side'; artifactId: string });

type JourneyNodeSource = JourneyNodeBase &
  ({ kind: 'main'; beatId: string } | { kind: 'side'; artifactId: string });

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
  /** The neighbourhood the chapters actually happen in, when finer than the city. */
  locality?: string;
  /** State or water the place sits in, for the map's place plate. */
  region: string;
  /** The real place, projected: the pin the map's chapters gather around. */
  place: UsPlace;
  /** Which corner of the ring the city name sits in, kept off the route at far zoom. */
  labelSide: 'ne' | 'se';
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
    title: 'Start',
    period: 'Now',
    story: [
      'Tyler Xiao?',
      'A short walk through where I have lived and what I built there. It starts in San Diego.',
      'Start in San Diego.',
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
    title: 'San Diego: growing up',
    period: 'Around age eleven or twelve',
    story: [
      'I grew up in San Diego. Around eleven or twelve I made games in Scratch, then moved to Java for competitive programming. In the same years I went to Chinese after-school classes and math competitions, played cello, and, before the pandemic, played water polo. Programming was one of several things I did.',
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
    title: 'Del Norte High School',
    period: 'High school',
    story: [
      'In high school I ran cross-country and track and was president of the Math Club and the Algorithmic Coding Club. Running taught me pacing. The clubs taught me how to keep a group going: having the answer first mattered less than making it easy for other people to keep working.',
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
    title: 'Grow & Give, my first app',
    period: '2022 to 2023',
    story: [
      'Grow & Give was a Swift and MongoDB app I built in 2022 and 2023. You set a focus timer, and finished sessions turned into support for real nonprofits. It was the first time I made product decisions for other people: what to show, what to store, and what to make easy. It won first place in its fair’s senior computer-science category.',
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
    title: 'UCLA',
    period: '2024 to present',
    story: [
      'I came to UCLA in 2024 to study computer science. [One academic moment that changed how I approached the work.] [One community moment that changed who I built with.] I still play cello in the Symphony Orchestra.',
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
    title: 'SafetyKit, San Francisco',
    period: 'Jun 2025 to Sep 2025',
    story: [
      'After freshman year I spent June to September 2025 at SafetyKit in San Francisco. It was my first startup-engineering summer and my first time living in the city. I worked on trust-and-safety systems. When a pipeline failed, a reviewer lost time and stopped trusting the tool, so the details mattered.',
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
    mapId: 'ucla',
    title: 'Codex community, Los Angeles',
    period: '2025 to present',
    story: [
      "I also wanted the technical work to happen in person. As a Codex Ambassador I started hosting demos, workshops, and build sessions at UCLA and around Los Angeles. People brought projects, compared notes, and built together. Later, in New York, I helped organize and judge Ramp's Builders Cup.",
    ],
    artifactIds: ['codex-event'],
    interactionId: 'gather-builders',
    nextId: '07-ramp',
    editorialStatus: 'confirmed',
    sourceNotes: [
      'Verified: ambassador directory; UPE and BMES events; Sundays in LA; Builders Cup role.',
      'Tyler confirmed 2026-09-01: the Codex community work started in Los Angeles, so this beat sits on the UCLA map; New York is where the Builders Cup thread landed.',
      'Boundary: Ambassador is a community-program role, not employment at the tool vendor.',
    ],
    refs: [{ company: 'Ramp' }],
  },
  {
    id: '07-ramp',
    mapId: 'new-york',
    title: 'Ramp, New York',
    period: 'Summer 2026',
    story: [
      "In summer 2026 I moved to New York to work on Ramp's Reimbursements team. It was a bigger system with the same question: what makes this workflow actually useful to the person who depends on it? By then, building things and organizing people felt like parts of the same job.",
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
    title: 'What comes next',
    period: 'Next',
    story: [
      'One next step is already planned. The rest is open. I want to keep building AI systems that are genuinely useful inside companies, and keep bringing the people who use them into the same room.',
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
    label: 'Scratch game or cello score',
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
    label: 'UCLA logo',
    asset: '/logos/ucla.svg',
    sourceNote:
      'Existing UCLA mark in public/; Tyler may later swap in a campus, UPE, Symphony, or project-team photo that carries an actual memory.',
  },
  {
    id: 'safetykit-mark',
    label: 'SafetyKit logo',
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
    label: 'Blank margin',
    asset: null,
    sourceNote:
      'Intentionally rendered as blank map margin; Tyler may later supply a small note naming the confirmed next stop.',
  },
];

const journeyNodeSources: JourneyNodeSource[] = [
  {
    id: 'sd-wake',
    mapId: 'san-diego',
    label: 'Start',
    dx: 2,
    dy: -10,
    labelSide: 'left',
    kind: 'main',
    beatId: '00-wake',
    adjacency: ['sd-wake-artifact', 'sd-practices'],
  },
  {
    id: 'sd-wake-artifact',
    mapId: 'san-diego',
    label: 'Portrait',
    dx: 0,
    dy: -18,
    labelSide: 'left',
    kind: 'side',
    artifactId: 'portrait',
    adjacency: ['sd-wake'],
  },
  {
    id: 'sd-practices',
    mapId: 'san-diego',
    label: 'Growing up',
    dx: 20,
    dy: -2,
    labelSide: 'right',
    kind: 'main',
    beatId: '01-practices',
    adjacency: ['sd-wake', 'sd-practice-artifact', 'sd-del-norte'],
  },
  {
    id: 'sd-practice-artifact',
    mapId: 'san-diego',
    label: 'Scratch or cello',
    dx: 26,
    dy: 4,
    labelSide: 'right',
    kind: 'side',
    artifactId: 'scratch-or-cello',
    adjacency: ['sd-practices'],
  },
  {
    id: 'sd-del-norte',
    mapId: 'san-diego',
    label: 'Del Norte',
    dx: 22,
    dy: -14,
    labelSide: 'right',
    kind: 'main',
    beatId: '02-del-norte',
    adjacency: ['sd-practices', 'sd-track-artifact', 'sd-first-app'],
  },
  {
    id: 'sd-track-artifact',
    mapId: 'san-diego',
    label: 'Running bib',
    dx: 28,
    dy: -26,
    labelSide: 'right',
    kind: 'side',
    artifactId: 'running-bib',
    adjacency: ['sd-del-norte'],
  },
  {
    id: 'sd-first-app',
    mapId: 'san-diego',
    label: 'First app',
    dx: 10,
    dy: -24,
    labelSide: 'right',
    kind: 'main',
    beatId: '03-first-app',
    adjacency: ['sd-del-norte', 'sd-app-artifact', 'la-ucla'],
  },
  {
    id: 'sd-app-artifact',
    mapId: 'san-diego',
    label: 'App screenshot',
    dx: 4,
    dy: -34,
    labelSide: 'right',
    kind: 'side',
    artifactId: 'grow-and-give-app',
    adjacency: ['sd-first-app'],
  },
  {
    id: 'la-ucla',
    mapId: 'ucla',
    label: 'UCLA',
    dx: 0,
    dy: 0,
    labelSide: 'right',
    kind: 'main',
    beatId: '04-ucla',
    adjacency: ['sd-first-app', 'la-ucla-artifact', 'sf-safetykit'],
  },
  {
    id: 'la-ucla-artifact',
    mapId: 'ucla',
    label: 'UCLA logo',
    dx: -12,
    dy: -9,
    labelSide: 'left',
    kind: 'side',
    artifactId: 'ucla-mark',
    adjacency: ['la-ucla'],
  },
  {
    id: 'sf-safetykit',
    mapId: 'san-francisco',
    label: 'SafetyKit',
    dx: 0,
    dy: 0,
    labelSide: 'right',
    kind: 'main',
    beatId: '05-safetykit',
    adjacency: ['la-ucla', 'sf-safetykit-artifact', 'la-codex'],
  },
  {
    id: 'sf-safetykit-artifact',
    mapId: 'san-francisco',
    label: 'SafetyKit logo',
    dx: 12,
    dy: -12,
    labelSide: 'right',
    kind: 'side',
    artifactId: 'safetykit-mark',
    adjacency: ['sf-safetykit'],
  },
  {
    id: 'la-codex',
    mapId: 'ucla',
    label: 'Codex community',
    dx: 15,
    dy: -7,
    labelSide: 'right',
    kind: 'main',
    beatId: '06-codex',
    adjacency: ['sf-safetykit', 'la-codex-artifact', 'ny-ramp'],
  },
  {
    id: 'la-codex-artifact',
    mapId: 'ucla',
    label: 'Event poster',
    dx: 27,
    dy: 3,
    labelSide: 'right',
    kind: 'side',
    artifactId: 'codex-event',
    adjacency: ['la-codex'],
  },
  {
    id: 'ny-ramp',
    mapId: 'new-york',
    label: 'Ramp',
    dx: 0,
    dy: 0,
    labelSide: 'below',
    kind: 'main',
    beatId: '07-ramp',
    adjacency: ['la-codex', 'ny-ramp-artifact', 'horizon-pin'],
  },
  {
    id: 'ny-ramp-artifact',
    mapId: 'new-york',
    label: 'New York photo',
    dx: -6,
    dy: -14,
    labelSide: 'left',
    kind: 'side',
    artifactId: 'ramp-nyc-photo',
    adjacency: ['ny-ramp'],
  },
  {
    id: 'horizon-pin',
    mapId: 'horizon',
    label: 'Next step',
    dx: 0,
    dy: 0,
    labelSide: 'right',
    kind: 'main',
    beatId: '08-horizon',
    adjacency: ['ny-ramp', 'horizon-margin'],
  },
  {
    id: 'horizon-margin',
    mapId: 'horizon',
    label: 'Blank margin',
    dx: 18,
    dy: -12,
    labelSide: 'right',
    kind: 'side',
    artifactId: 'unprinted-margin',
    adjacency: ['horizon-pin'],
  },
];

export const journeyNodes: JourneyMapNode[] = journeyNodeSources.map((node) => {
  const place = usPlaces[node.mapId];
  return { ...node, x: place.x + node.dx, y: place.y + node.dy };
});

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
  {
    id: 'san-diego',
    name: 'San Diego',
    placeLabel: 'SAN DIEGO',
    locality: '4S Ranch',
    region: 'San Diego, California',
    place: usPlaces['san-diego'],
    labelSide: 'se',
  },
  {
    id: 'ucla',
    name: 'UCLA',
    placeLabel: 'LOS ANGELES / UCLA',
    region: 'California',
    place: usPlaces.ucla,
    labelSide: 'ne',
  },
  {
    id: 'san-francisco',
    name: 'San Francisco',
    placeLabel: 'SAN FRANCISCO',
    region: 'California',
    place: usPlaces['san-francisco'],
    labelSide: 'se',
  },
  {
    id: 'new-york',
    name: 'New York',
    placeLabel: 'NEW YORK',
    region: 'New York',
    place: usPlaces['new-york'],
    labelSide: 'ne',
  },
  {
    id: 'horizon',
    name: 'Next',
    placeLabel: 'NEXT STOP',
    locality: 'Next stop',
    region: 'not on the map yet',
    place: usPlaces.horizon,
    labelSide: 'ne',
  },
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

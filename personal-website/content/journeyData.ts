import { usPlaces, type UsPlace, type UsPlaceId } from './usMapGenerated.ts';

export type JourneyMapId = UsPlaceId;

export type JourneyEditorialStatus =
  | 'confirmed'
  | 'needs-tyler'
  | 'source-conflict';

export type JourneyArtifactKind = 'photo' | 'mark' | 'video' | 'youtube';

export type JourneyArtifact = {
  id: string;
  label: string;
  /** Image description for assistive tech; the label is used when omitted. */
  alt?: string;
  /** Public path. For a YouTube artifact this is the still shown behind the frame. */
  asset: string | null;
  /** Rendering branch; inferred from the asset extension when omitted. */
  kind?: JourneyArtifactKind;
  /** Video only: the still shown before play, and instead of play under reduced motion. */
  poster?: string;
  /** YouTube only: the privacy-enhanced embed URL. */
  embedUrl?: string;
  /** Adds place, date, or who; omitted when it would only restate the image. */
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

/** An outbound link the story names, shown under the paragraphs. */
export type JourneyBeatLink = { label: string; href: string };

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
  links?: JourneyBeatLink[];
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
    period: 'Childhood',
    story: [
      'I grew up in San Diego. Around eleven or twelve I made games in Scratch, then moved to Java for competitive programming. In the same years I went to Chinese after-school classes and math competitions, played cello, and, before the pandemic, played water polo. I did a lot of things, and programming was one of them.',
      'This is one of the first recorded cello performances I have. It’s one of the first things I did, and I still enjoy it when I have a cello around and the time.',
    ],
    artifactIds: ['scratch-or-cello'],
    interactionId: 'visit-week-practices',
    nextId: '02-del-norte',
    editorialStatus: 'confirmed',
    sourceNotes: [
      'Tyler confirmed: Scratch games, then Java competitive programming around age eleven or twelve; Chinese after-school and math competitions in the same period; cello; water polo before the pandemic.',
      'Tyler, 2026-09-21 session: the artifact is one of his first recorded cello performances (YouTube), in his words "This is one of the first recorded cello performances I have. It’s one of the first things I did, and I still enjoy it when I have a cello around and the time."',
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
      'In high school I ran cross-country and track. Running cross-country, I learned to be a teammate and a leader, and I found out I could train through pain and push past what I thought I could do. Mostly I learned to take a process seriously and hold myself to it.',
      'I was also president of the Math Club and the Algorithmic Coding Club. Running them, I learned to bring people together, host events, and make people feel welcome. Looking back, I built foundations for both clubs, but honestly my impact then left more to be desired. I still learned a lot from the events that flopped and the plans that never happened, about how not to host and how not to lead.',
    ],
    artifactIds: ['running-bib'],
    interactionId: 'hold-team-pace',
    nextId: '03-first-app',
    editorialStatus: 'confirmed',
    sourceNotes: [
      'Verified: Del Norte, cross-country and track, president of both clubs.',
      'Tyler, 2026-09-21 session: cross-country as team player and team leader, mental fortitude and resilience, training through pain, taking a process seriously with discipline; clubs as leadership, hosting, making people welcome; candid that his impact then left more to be desired and that the failures taught him how not to host and how not to lead.',
    ],
    refs: [],
  },
  {
    id: '03-first-app',
    mapId: 'san-diego',
    title: 'Grow & Give, my first app',
    period: '2022 to 2023',
    story: [
      'I built Grow & Give in 2022 and 2023 with Swift and MongoDB. You set a focus timer, and every session you finished counted toward support for real nonprofits. I entered it in my fair and took first place in the senior computer-science category.',
      'Shipping Grow & Give was a turning point for me: I fought through the hoops and abstractions of iOS development and got Swift code over the line, before AI. I am still proud of that.',
    ],
    artifactIds: ['grow-and-give-app'],
    interactionId: 'plan-focus-reflect',
    nextId: '04-ucla',
    editorialStatus: 'confirmed',
    sourceNotes: [
      "Verified: Swift and MongoDB app, 2022-2023, first place in the fair's senior computer-science category.",
      'Tyler, 2026-09-21 session: Grow & Give is the app; the turning point was how difficult app development was (hoops, abstractions) and the pride of pushing through in Swift, pre-AI, to ship it.',
    ],
    refs: [{ project: 'Grow & Give' }],
  },
  {
    id: '04-ucla',
    mapId: 'ucla',
    title: 'UCLA',
    period: '2024 to present',
    story: [
      'I came to UCLA in 2024 to study computer science, with a strong foundation from competitive programming. In my first year I applied to about 300 internships and did not hear back from many of them.',
      'In the meantime I explored and built: I competed in ACM ICPC, tutored, did evaluation work for Scale AI, led the DocuPilot team, ran with Jogging Club, and kept playing cello in the Symphony Orchestra. I joined several clubs, including Creative Labs, and failed to get into a few others. I settled on two: VEST at UCLA and Upsilon Pi Epsilon at UCLA.',
    ],
    artifactIds: ['vest-mark', 'upe-mark'],
    interactionId: 'connect-campus-nodes',
    nextId: '05-safetykit',
    editorialStatus: 'confirmed',
    sourceNotes: [
      'Verified: degree and coursework; ACM ICPC, UPE, VEST, Symphony Orchestra, tutoring, Jogging Club; Scale AI evaluation work and DocuPilot team leadership during freshman year.',
      'Tyler, 2026-09-21 session: strong CS foundation from competitive programming; about 300 internship applications in year one with few replies; joined several clubs including Creative Labs, failed to get into a few, settled on VEST at UCLA and UPE at UCLA.',
    ],
    refs: [],
  },
  {
    id: '05-safetykit',
    mapId: 'san-francisco',
    title: 'SafetyKit, San Francisco',
    period: 'Jun 2025 to Sep 2025',
    story: [
      'I went through a brutal application season, and SafetyKit took the chance on me. I spent June to September 2025 with them in San Francisco: my first startup-engineering summer and my first time living in the city.',
      'There I learned and built in the agentic-AI space for the first time. I learned how a real software-engineering company works, with real principles and real tools; I ran cloud systems at scale on AWS; and I made changes that affected hundreds of thousands of dollars in real time.',
    ],
    artifactIds: ['safetykit-mark'],
    interactionId: 'repair-production-route',
    nextId: '06-codex',
    editorialStatus: 'confirmed',
    sourceNotes: [
      'Verified: SafetyKit reflection, June to September 2025, first engineering intern, months in San Francisco.',
      'Tyler, 2026-09-21 session: brutal application season, SafetyKit took the chance; first time building in agentic AI; real software-engineering principles and tools; AWS at scale; changes affecting hundreds of thousands of dollars in real time.',
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
      "As a Codex Ambassador I started hosting demos, workshops, and build sessions at UCLA and around Los Angeles. Through the Codex community I found my way into the LA tech scene on the community side, and I now host Sundays in LA. Later, in New York, I helped organize and judge Ramp's Builders Cup.",
    ],
    artifactIds: ['codex-matcha', 'codex-demo'],
    interactionId: 'gather-builders',
    nextId: '07-ramp',
    editorialStatus: 'confirmed',
    links: [{ label: 'Sundays in LA', href: 'https://sundays.rsvp' }],
    sourceNotes: [
      'Verified: ambassador directory; UPE and BMES events; Sundays in LA; Builders Cup role.',
      'Tyler confirmed 2026-09-01: the Codex community work started in Los Angeles, so this beat sits on the UCLA map; New York is where the Builders Cup thread landed.',
      'Tyler, 2026-09-21 session: cover the Codex community and Sundays in LA; it brought him into the tech scene on the community side; he is now a host of Sundays in LA (link sundays.rsvp); two photos supplied.',
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
      "In summer 2026 I moved to New York to work at Ramp. I scaled the Reimbursements team's software, and I spent much of my time building tools for the internal talent team: better event coordination, custom software for the intern expo, and more.",
    ],
    artifactIds: ['ramp-boat', 'ramp-construction'],
    interactionId: 'ship-reimbursements',
    nextId: '08-decagon',
    editorialStatus: 'confirmed',
    sourceNotes: [
      'Verified: user brief, Reimbursements announcement, public New York and Builders Cup posts.',
      'Tyler, 2026-09-21 session: he did scale the Reimbursements software, but the primary work also came as tools for the internal talent team (event coordination, intern expo software, and more); two photos supplied.',
      'Repo cleanup: canonical site data still marks Ramp as incoming, which is stale for August 2026.',
    ],
    refs: [{ company: 'Ramp' }],
  },
  {
    id: '08-decagon',
    mapId: 'san-francisco',
    title: 'Decagon, San Francisco',
    period: 'Sep 2026 to Dec 2026',
    story: [
      'From September to December 2026 I am back in San Francisco as a Software Engineering Intern at Decagon, working on AI DevX: making AI more productive for developers and building the infrastructure behind it.',
    ],
    artifactIds: ['decagon-ribbon'],
    interactionId: 'build-ai-devx',
    nextId: '09-horizon',
    editorialStatus: 'confirmed',
    sourceNotes: [
      'Verified: experienceData.ts (after PR #9): Software Engineering Intern, Decagon AI, Sep 2026 to Dec 2026, building AI developer experience, focus AI DevX and Developer Tools.',
      "Tyler, 2026-09-21 session: \"decagon should be second to last, but keep a 'what's next?' question page\"; Decagon is SF-based; the ribbon video is the artifact.",
      'Tyler, 2026-09-21 session: "i\'m working on AI DevX to enhance AI productivity and build infra".',
    ],
    refs: [{ company: 'Decagon AI' }],
  },
  {
    id: '09-horizon',
    mapId: 'horizon',
    title: 'What’s next?',
    period: 'Next',
    story: [
      'The future is bright, but it is still open and up for grabs. Stay tuned :)',
    ],
    artifactIds: ['unprinted-margin'],
    interactionId: 'place-next-pin',
    nextId: null,
    editorialStatus: 'confirmed',
    sourceNotes: [
      'Tyler, 2026-09-21 session: keep the ending as a "what\'s next?" question page, employer-neutral, with the unprinted margin and the pin interaction unchanged.',
      'Resolved: the former source conflict is moot now that Decagon has its own beat (08-decagon); the ending names no employer by design.',
    ],
    refs: [],
  },
];

export const journeyArtifacts: JourneyArtifact[] = [
  {
    id: 'portrait',
    label: 'Portrait',
    asset: '/pfp.JPG',
    kind: 'photo',
    sourceNote: 'Existing site portrait already shipped in public/.',
  },
  {
    id: 'scratch-or-cello',
    label: 'Early cello performance',
    alt: 'Tyler playing cello, one of his first recorded performances',
    asset: '/journey/cello-duet-poster.jpg',
    kind: 'youtube',
    embedUrl: 'https://www.youtube-nocookie.com/embed/AIJTxXDWExM',
    sourceNote:
      'Tyler, 2026-09-21 session: https://www.youtube.com/watch?v=AIJTxXDWExM, one of his first recorded cello performances. The still is its YouTube thumbnail. The artifact id is kept so node ids and the store tests stay unchanged.',
  },
  {
    id: 'running-bib',
    label: 'Cross-country race',
    alt: 'Tyler mid-race on a dirt cross-country course, wearing bib 1224, with runners and spectators behind him',
    asset: '/journey/del-norte-xc.jpg',
    kind: 'photo',
    caption: 'Cross-country, Del Norte years.',
    sourceNote:
      'Tyler, 2026-09-21 session: supplied running photo (1024×682), bib 1224, cross-country race. Re-encoded, EXIF stripped.',
  },
  {
    id: 'grow-and-give-app',
    label: 'Grow & Give screenshot',
    asset: '/projects/grow-and-give.png',
    kind: 'photo',
    sourceNote:
      'Existing Grow & Give screenshot from the project gallery in public/.',
  },
  {
    id: 'vest-mark',
    label: 'VEST at UCLA mark',
    asset: '/logos/vest.svg',
    kind: 'mark',
    caption: 'VEST at UCLA',
    sourceNote:
      'Tyler, 2026-09-21 session: settled on VEST at UCLA. Official mark from vestucla.com; see public/logos/manifest.json.',
  },
  {
    id: 'upe-mark',
    label: 'Upsilon Pi Epsilon at UCLA key',
    asset: '/logos/upe.png',
    kind: 'mark',
    caption: 'Upsilon Pi Epsilon, UCLA',
    sourceNote:
      'Tyler, 2026-09-21 session: settled on UPE at UCLA. Official key mark from upe.seas.ucla.edu (PNG, the only raster the site serves); see public/logos/manifest.json.',
  },
  {
    id: 'safetykit-mark',
    label: 'SafetyKit logo',
    asset: '/logos/safetykit.svg',
    kind: 'mark',
    sourceNote:
      'Existing SafetyKit mark in public/; Tyler may later swap in an intern presentation, MCP diagram, or his own San Francisco photo.',
  },
  {
    id: 'codex-matcha',
    label: 'Codex matcha',
    alt: 'A matcha latte and a cupcake, each topped with the Codex mark, beside Codex and OpenAI stickers on a wooden table',
    asset: '/journey/codex-matcha.jpg',
    kind: 'photo',
    sourceNote:
      'Tyler, 2026-09-21 session: supplied Codex matcha and cupcake photo (682×1024). Re-encoded, EXIF stripped.',
  },
  {
    id: 'codex-demo',
    label: 'Codex demo',
    alt: 'Tyler presenting outdoors beside a screen showing a Codex Agentic Loop slide, with an audience in front of him',
    asset: '/journey/codex-demo.jpg',
    kind: 'photo',
    sourceNote:
      'Tyler, 2026-09-21 session: supplied photo of him presenting in front of a "Codex Agentic Loop" poster (682×1024). Re-encoded, EXIF stripped.',
  },
  {
    id: 'ramp-boat',
    label: 'Ramp boat trip',
    alt: 'Nine people in Ramp tees posing on a boat deck at sunset with the water behind them',
    asset: '/journey/ramp-boat.jpg',
    kind: 'photo',
    caption: 'New York, summer 2026.',
    sourceNote:
      'Tyler, 2026-09-21 session: supplied group-on-a-boat photo (1024×696). Re-encoded, EXIF stripped.',
  },
  {
    id: 'ramp-construction',
    label: 'Ramp for construction',
    alt: 'Two people in yellow hard hats holding a yellow “ramp for construction” sign above their heads in a bar',
    asset: '/journey/ramp-construction.jpg',
    kind: 'photo',
    sourceNote:
      'Tyler, 2026-09-21 session: supplied "ramp for construction" sign photo (768×1024). Re-encoded, EXIF stripped.',
  },
  {
    id: 'decagon-ribbon',
    label: 'Decagon ribbon',
    alt: 'A silver ribbon folds into the Decagon mark, then a card reads Fall 2026, committed: Tyler Xiao, Software Engineering Intern, Decagon',
    asset: '/journey/decagon-ribbon.mp4',
    kind: 'video',
    poster: '/journey/decagon-ribbon-poster.jpg',
    sourceNote:
      'Tyler, 2026-09-21 session: supplied decagon-v6-ribbon.mp4 (720×1280, 21 s). Remuxed without metadata; poster frame extracted with ffmpeg.',
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
    label: 'Early cello performance',
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
    label: 'Cross-country',
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
    label: 'VEST and UPE',
    dx: -12,
    dy: -9,
    labelSide: 'left',
    kind: 'side',
    artifactId: 'vest-mark',
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
    label: 'Codex demo',
    dx: 27,
    dy: 3,
    labelSide: 'right',
    kind: 'side',
    artifactId: 'codex-demo',
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
    adjacency: ['la-codex', 'ny-ramp-artifact', 'sf-decagon'],
  },
  {
    id: 'ny-ramp-artifact',
    mapId: 'new-york',
    label: 'On the water',
    dx: -6,
    dy: -14,
    labelSide: 'left',
    kind: 'side',
    artifactId: 'ramp-boat',
    adjacency: ['ny-ramp'],
  },
  {
    id: 'sf-decagon',
    mapId: 'san-francisco',
    label: 'Decagon',
    dx: -14,
    dy: 10,
    labelSide: 'left',
    kind: 'main',
    beatId: '08-decagon',
    adjacency: ['ny-ramp', 'sf-decagon-artifact', 'horizon-pin'],
  },
  {
    id: 'sf-decagon-artifact',
    mapId: 'san-francisco',
    label: 'Ribbon',
    dx: -24,
    dy: 18,
    labelSide: 'left',
    kind: 'side',
    artifactId: 'decagon-ribbon',
    adjacency: ['sf-decagon'],
  },
  {
    id: 'horizon-pin',
    mapId: 'horizon',
    label: 'Next step',
    dx: 0,
    dy: 0,
    labelSide: 'right',
    kind: 'main',
    beatId: '09-horizon',
    adjacency: ['sf-decagon', 'horizon-margin'],
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
    beatId: '09-horizon',
    forbidden: ['Decagon', 'Snowflake'],
    required: [],
    note: 'The ending is an open question and names no employer; Decagon has its own beat.',
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

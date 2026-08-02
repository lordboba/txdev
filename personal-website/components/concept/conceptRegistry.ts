export type ConceptId = 'observatory' | 'bench' | 'evalrun' | 'museum';

export type ConceptEntry = {
  id: ConceptId;
  code: string;
  name: string;
  route: string;
  thesis: string;
  motion: string;
  object: string;
  palette: [string, string, string];
};

/**
 * The directions on the comparison board. Each one commits hard to a single
 * idea instead of hedging — and since round two, each centerpiece is built
 * from the real profile data, so none survives a resume-swap unchanged.
 * Archive (B) and Press (C) were retired: abstract objects carrying no data.
 */
export const conceptEntries: ConceptEntry[] = [
  {
    id: 'observatory',
    code: 'A',
    name: 'Observatory',
    route: '/concept/observatory',
    thesis:
      'The page as a measuring instrument. Mono only, hairline plates, live telemetry read off the real camera.',
    motion: 'Camera transits, scrambling readouts, cursor-tracked parallax.',
    object: 'A six-ring armillary armature that reconfigures per view.',
    palette: ['#0a0b0d', '#74e0e8', '#c9d3da'],
  },
  {
    id: 'bench',
    code: 'D',
    name: 'Bench',
    route: '/concept/bench',
    thesis:
      'Product photography as interface. The shipped apps are the only color on the page — their screens carry the real screenshots.',
    motion:
      'Slow weighted camera transits; hovered devices lift toward the lens.',
    object:
      'A studio workbench of real devices textured with the shipped work.',
    palette: ['#dfe1e3', '#141517', '#b8bbbe'],
  },
  {
    id: 'evalrun',
    code: 'E',
    name: 'Eval Run',
    route: '/concept/evalrun',
    thesis:
      'The profile as a benchmark harness executing. Every test name is a real fact; projects pass and emit their screenshots as artifacts.',
    motion: 'Streaming cases, deterministic timers, mechanical resolve ticks.',
    object: 'Four suites compiled from the data, re-run on every view entry.',
    palette: ['#0d120e', '#8fd97a', '#e0b45c'],
  },
  {
    id: 'museum',
    code: 'F',
    name: 'Museum',
    route: '/concept/museum',
    thesis:
      'The site as its own museum. Six real git eras rebuilt as living miniatures; the chrome has no color until an era lends it one.',
    motion: 'A weighted timeline scrub; the active era recolors the page.',
    object: 'A gallery wall of this repository’s actual past homepages.',
    palette: ['#eceae4', '#1a1917', '#8a8578'],
  },
];

export function getConceptEntry(id: ConceptId): ConceptEntry {
  const entry = conceptEntries.find((candidate) => candidate.id === id);

  if (!entry) {
    throw new Error(`Unknown concept: ${id}`);
  }

  return entry;
}

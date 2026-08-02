export type EraPalette = {
  commit: string;
  wall: string;
  ink: string;
  accent: string;
  miniature: string;
};

type PaletteWords =
  | 'Paper / ink / rust'
  | 'Charcoal / phosphor'
  | 'Night / signal gold'
  | 'Dusk / brass / sage'
  | 'Umber / parchment / gold'
  | 'Dusk / screen color';

/**
 * Representative colours transcribed from the styles at each real commit.
 * The keys are the exact palette strings in gitEras, translating the source
 * words into usable colour without inventing a separate museum palette.
 */
export const paletteByWords: Record<
  PaletteWords,
  Omit<EraPalette, 'commit'>
> = {
  'Paper / ink / rust': {
    wall: '#f4f4f5',
    ink: '#171717',
    accent: '#b45309',
    miniature: '#ffffff',
  },
  'Charcoal / phosphor': {
    wall: '#f7f5ef',
    ink: '#1f2933',
    accent: '#12b76a',
    miniature: '#111827',
  },
  'Night / signal gold': {
    wall: '#d9d7d0',
    ink: '#17181d',
    accent: '#e8c468',
    miniature: '#07080c',
  },
  'Dusk / brass / sage': {
    wall: '#e5ded2',
    ink: '#201b16',
    accent: '#c89b52',
    miniature: '#12100d',
  },
  'Umber / parchment / gold': {
    wall: '#e8e0d4',
    ink: '#201b16',
    accent: '#a57b37',
    miniature: '#181512',
  },
  'Dusk / screen color': {
    wall: '#e2d9cc',
    ink: '#201b16',
    accent: '#c89b52',
    miniature: '#12100d',
  },
};

const museumEraKeys: { commit: string; palette: PaletteWords }[] = [
  { commit: '96ccd76', palette: 'Paper / ink / rust' },
  { commit: '79348e8', palette: 'Charcoal / phosphor' },
  { commit: '46a72ca', palette: 'Night / signal gold' },
  { commit: '4fc5d06', palette: 'Dusk / brass / sage' },
  { commit: 'daebe22', palette: 'Umber / parchment / gold' },
  { commit: 'ad3e87a', palette: 'Dusk / screen color' },
];

export const eraPalettes: EraPalette[] = museumEraKeys.map(
  ({ commit, palette }) => ({ commit, ...paletteByWords[palette] }),
);

export function clampEraIndex(value: number) {
  return Math.min(eraPalettes.length - 1, Math.max(0, value));
}

export function nearestEraIndex(value: number) {
  return Math.round(clampEraIndex(value));
}

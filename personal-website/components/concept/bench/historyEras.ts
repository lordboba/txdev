/*
 * The history view's run of eras, assembled from two sources that are never
 * allowed to blur into one another:
 *
 *   1. `gitEras` in conceptData.ts — hand-authored, six real commits, each with
 *      a curated title, visual language, and palette. Nothing writes to it but
 *      a person.
 *   2. historyGenerated.json — written by scripts/update-history.mjs off `git
 *      log`. It carries at most one provisional era for the current head of the
 *      repository, the commit-URL base read from the real git remote, and the
 *      manifest of which captures actually exist on disk.
 *
 * Splitting them is what keeps the view honest. A provisional entry is marked
 * `provisional: true`, and every surface that prints one says so, because its
 * name is a heuristic off a commit subject rather than a judgement anyone made.
 *
 * The `.ts` specifier on the conceptData import is load-bearing for the same
 * reason it is over there: node --test resolves the literal path.
 */
import { gitEras, type GitEra } from '../conceptData.ts';
import generated from './historyGenerated.json';

export type HistoryEra = GitEra & {
  /**
   * Path to a real capture of this state of the site, or null when none has
   * been taken. The archived eras are photographed from the museum miniatures
   * (DOM rebuilds of those exact commits); the provisional era is photographed
   * from the running site.
   */
  shot: string | null;
  /** The commit on the repo's remote, or null when the repo has no remote. */
  commitUrl: string | null;
  /** True for an era the script recorded and nobody has named yet. */
  provisional: boolean;
};

/*
 * JSON imports are typed structurally from the literal, so an empty
 * `appendedEras` widens to never[] and `commitUrlBase` narrows to the exact
 * string in the file. Both are asserted back to what the generator's contract
 * actually promises — the shape is enforced by the script, not by the sample.
 */
const appended = generated.appendedEras as GitEra[];
const commitUrlBase = (generated.commitUrlBase ?? null) as string | null;
const shots = generated.shots as Record<string, string | undefined>;

function join(era: GitEra, provisional: boolean): HistoryEra {
  return {
    ...era,
    shot: shots[era.commit] ?? null,
    commitUrl: commitUrlBase ? `${commitUrlBase}${era.commit}` : null,
    provisional,
  };
}

/** The full run, oldest first. Every surface — 3D and DOM — reads this. */
export const historyEras: HistoryEra[] = [
  ...gitEras.map((era) => join(era, false)),
  ...appended.map((era) => join(era, true)),
];

/** Every capture that exists, for warming the textures before the transit. */
export const historyShots: string[] = historyEras
  .map((era) => era.shot)
  .filter((shot): shot is string => shot !== null);

/** The date the generated half was last refreshed, for the view's own footer. */
export const historyGeneratedAt: string = generated.generatedAt;

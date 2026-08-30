/*
 * CAPTURE HARNESS — development only. It 404s in production and is never
 * prerendered, so nothing here reaches the shipped site.
 *
 * Renders one museum miniature standalone, full-bleed at the viewport size, so
 * `npm run history` can screenshot it straight into public/history. The
 * miniatures in components/concept/museum/miniatures are faithful DOM rebuilds
 * of the real commits in `gitEras` (built from `git show` against those
 * hashes), which is the sanctioned way to photograph a past state of this site
 * without checking out and booting an old build.
 *
 * It stays in the tree rather than being deleted after the first pass because
 * the archive is re-shootable: change a miniature, run `npm run history`, and
 * every card's face is regenerated from the same source of truth. With the
 * route gone the script skips the archive cleanly and only the live capture
 * refreshes.
 */
import { notFound } from 'next/navigation';
import { gitEras } from '@/components/concept/conceptData';
import { DuskMiniature } from '@/components/concept/museum/miniatures/DuskMiniature';
import { FoundationMiniature } from '@/components/concept/museum/miniatures/FoundationMiniature';
import { OrbitalMiniature } from '@/components/concept/museum/miniatures/OrbitalMiniature';
import { ProofMiniature } from '@/components/concept/museum/miniatures/ProofMiniature';
import { SceneMiniature } from '@/components/concept/museum/miniatures/SceneMiniature';
import { TerminalMiniature } from '@/components/concept/museum/miniatures/TerminalMiniature';

export const metadata = {
  title: 'History capture harness',
  robots: { index: false, follow: false },
};

const MINIATURES = [
  FoundationMiniature,
  TerminalMiniature,
  SceneMiniature,
  OrbitalMiniature,
  DuskMiniature,
  ProofMiniature,
];

export default async function HistoryCapturePage({
  params,
}: {
  params: Promise<{ commit: string }>;
}) {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  const { commit } = await params;
  const index = gitEras.findIndex((era) => era.commit === commit);
  const EraMiniature = index >= 0 ? MINIATURES[index] : undefined;

  if (!EraMiniature) {
    notFound();
  }

  return (
    <>
      {/*
       * The dev overlay is chrome, not history. It would otherwise print a
       * Next.js badge and a devtools pill into every archived capture.
       */}
      <style>{`
        nextjs-portal { display: none !important; }
        html, body { margin: 0; padding: 0; overflow: hidden; }
      `}</style>
      <div
        id="capture-stage"
        style={{
          position: 'fixed',
          inset: 0,
          overflow: 'hidden',
          containerType: 'inline-size',
        }}
      >
        <EraMiniature />
      </div>
    </>
  );
}

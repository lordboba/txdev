/**
 * A/B ablation switches for the bench scene, driven entirely by the URL so a
 * measurement harness can toggle one visual feature per run without touching
 * code: `/?ablate=keyshadow,env` turns features off, everything else stays.
 *
 * Flags in use (each gates one feature at its creation site in BenchScene):
 *   keyshadow — the key directional's VSM shadow map
 *   contact   — the final-pose ContactShadows ground bake
 *   env       — the studio Environment cubemap
 *   dpr       — cap the canvas at 1x device pixel ratio
 */

let flags: Set<string> | null = null;

function readFlags(): Set<string> {
  if (typeof window === 'undefined') {
    return new Set();
  }

  return new Set(
    (new URLSearchParams(window.location.search).get('ablate') ?? '')
      .split(',')
      .map((flag) => flag.trim())
      .filter(Boolean),
  );
}

export function isAblated(flag: string): boolean {
  flags ??= readFlags();
  return flags.has(flag);
}

/**
 * Hands the renderer and scene to the measurement harness when the page is
 * opened with `?bench-debug=1`. Inert on every normal visit.
 */
export function exposeBenchDebug(gl: unknown, scene: unknown) {
  if (
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).has('bench-debug')
  ) {
    (window as unknown as Record<string, unknown>).__benchGL = gl;
    (window as unknown as Record<string, unknown>).__benchScene = scene;
  }
}

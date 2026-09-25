/**
 * The conductor's choreography (bible §4.1 mount, §4.2 route change and the
 * §3.3 mobile scroll-lift): which sim commands are issued when, on sim time.
 * DOM-free: the canvas hands it the sim, the moon controller, the theme
 * target, the layouts and the two page reads it needs (`scrollY`, the settled
 * attribute), so the rows are node-tested against a recording sim.
 *
 * It owns the sequence id that stale scheduled jobs are guarded by, the
 * pending exit that a link click starts before the pathname commits, the
 * mobile `lifted` state and the one-shot `data-festival-settled` schedule.
 */

import type { MoonController } from './moonController.ts';
import {
  CHOREOGRAPHY,
  type Rect,
  type RouteLayout,
  type SimApi,
} from './types.ts';

export type TextPhase = 'hidden' | 'enter' | 'exit';
export type Timing = 'mount' | 'route';
export type Reveal = 'poem' | 'colophon' | 'slip' | 'translation';

const MOUNT = CHOREOGRAPHY.mount;
const ROUTE = CHOREOGRAPHY.route;
/** The exit's 280 ms: candle 160, rise from +40 over 240 (§4.2). */
export const ROUTE_EXIT_S = (ROUTE.riseDelayMs + ROUTE.riseMs) / 1000;
/**
 * An exit started at a link click is confirmed by the pathname change. If
 * none arrives within this long (a slow route, a link Next handled without
 * a route change, a handler that cancelled the navigation after the exit
 * had started) the lanterns lower back in on the same page.
 */
export const EXIT_CONFIRM_S = 4;

export interface ChoreographyDeps {
  sim(): SimApi | null;
  moon: MoonController;
  /** The live theme target: 1 night, 0 the afternoon before. */
  nightTarget(): 0 | 1;
  layout(): RouteLayout;
  /** Resolves a route against the live page (the §4.2 anchor re-read). */
  resolveLayout(path: string): RouteLayout;
  /** A route's nav band from the tables alone, before its page can be read. */
  navBandFor(path: string): Rect | null;
  /** Swaps the composition; `moonDone` when the moon rows already ran. */
  applyLayout(next: RouteLayout, moonDone: boolean): void;
  /** The overlay view: a fresh enter (all text hidden), the exit, a reveal. */
  onEnter(timing: Timing): void;
  onExit(): void;
  reveal(part: Reveal): void;
  view(): { phase: TextPhase; translationShown: boolean };
  scrollY(): number;
  reduced(): boolean;
  /** Reduced motion: one still frame of the new route. */
  renderReduced(): void;
  /** `data-festival-settled` on `<html>`. */
  setSettled(on: boolean): void;
  disposed(): boolean;
}

export interface Choreography {
  /** §4.1 (mount) or §4.2 enter rows, with delays measured from `base` (sim s). */
  enterSequence(timing: Timing, base: number): void;
  /** §4.2 exit rows: text out, candles out, lanterns up. */
  exitSequence(): void;
  /** Starts the exit at navigation start (a link click, the rocket). */
  startExit(path: string | null): void;
  /** The pathname committed: confirm or start the exit, re-read, enter. */
  routeChange(path: string): void;
  /** Per frame: the mobile scroll-lift rows (§3.3, §4.2). */
  stepScrollLift(): void;
  /** Per frame: the translation at the settle event, settled 500 ms later. */
  advanceSettle(): void;
  /** Reduced motion: snaps the lift state from a scroll; true when it changed. */
  snapScrollLift(): boolean;
  /** Reduced motion re-render: nothing in flight, the page is settled. */
  resetForReduced(): void;
  /** A pending exit is dropped (reduced motion switched on). */
  cancelExit(): void;
  readonly lifted: boolean;
}

export function createChoreography(deps: ChoreographyDeps): Choreography {
  let sequenceId = 0;
  let lifted = false;
  /** An exit already running for the next route, awaiting the pathname. */
  let pendingExit: { path: string | null; at: number } | null = null;
  let settledScheduled = false;

  const guard = (id: number, fn: () => void) => () => {
    if (!deps.disposed() && id === sequenceId) fn();
  };

  const clearSettled = (): void => {
    settledScheduled = false;
    deps.setSettled(false);
  };

  /** The catch, decided when it is due (§2.1: a theme flip during the lower-in leaves the candle out). */
  const scheduleCatch = (
    sim: SimApi,
    id: number,
    lanternId: RouteLayout['lanterns'][number]['id'],
    at: number,
    T: typeof MOUNT | typeof ROUTE,
  ): void => {
    sim.schedule(
      at,
      guard(id, () => {
        // A scroll-lift that landed during the lower-in must not light a
        // hidden lantern either.
        if (deps.nightTarget() !== 1 || lifted) return;
        sim.light(lanternId, {
          delayS: 0,
          durationS: T.candleMs / 1000,
          target: 1,
          poolDelayS: T.poolDelayMs / 1000,
          poolDurationS: T.poolMs / 1000,
        });
      }),
    );
  };

  const enterSequence = (timing: Timing, base: number): void => {
    const sim = deps.sim();

    if (!sim) return;

    const T = timing === 'mount' ? MOUNT : ROUTE;
    const layout = deps.layout();
    const now = sim.state.ts;
    const id = sequenceId;
    const lowerDelay = timing === 'mount' ? 0 : ROUTE.lowerInDelayMs;

    // A fresh page: whatever the last one's scroll-lift state was, these
    // lanterns are being hung now.
    lifted = false;
    // Mobile /blog* entered already scrolled (a hash, Back, a route change
    // mid-article): the lantern is parked raised and unlit from the first
    // frame (§4.2 scroll-lift) instead of lowering in over the article and
    // lifting again; the return below `returnBelowScrollY` plays the
    // lower-in and catch rows. `snapshotLift` clears the queue: first.
    const lift = layout.scrollLift;
    const parked =
      !!lift &&
      layout.lanterns.length > 0 &&
      deps.scrollY() > lift.liftAtScrollY;

    if (parked) {
      lifted = true;
      sim.snapshotLift(true, lift.px);
    }

    for (const spec of parked ? [] : layout.lanterns) {
      const lowerAt =
        base + (lowerDelay + T.lanternStaggerMs * spec.order) / 1000;
      const arrival = lowerAt + T.lowerInMs / 1000;

      sim.lowerIn(spec.id, {
        delayS: Math.max(0, lowerAt - now),
        durationS: T.lowerInMs / 1000,
      });
      scheduleCatch(sim, id, spec.id, arrival + T.candleDelayMs / 1000, T);
    }

    deps.onEnter(timing);
    clearSettled();

    sim.schedule(
      base + T.poemStartMs / 1000,
      guard(id, () => deps.reveal('poem')),
    );
    sim.schedule(
      base + T.colophonStartMs / 1000,
      guard(id, () => deps.reveal('colophon')),
    );
    sim.schedule(
      base + T.slipStartMs / 1000,
      guard(id, () => deps.reveal('slip')),
    );
  };

  const exitSequence = (): void => {
    const sim = deps.sim();

    if (!sim) return;

    deps.onExit();
    clearSettled();
    for (const spec of deps.layout().lanterns) {
      sim.light(spec.id, {
        delayS: 0,
        durationS: ROUTE.candleOutMs / 1000,
        target: 0,
      });
      sim.raise(spec.id, {
        delayS: ROUTE.riseDelayMs / 1000,
        durationS: ROUTE.riseMs / 1000,
        px: ROUTE.risePx,
      });
    }
  };

  /**
   * The exit starts at NAVIGATION START, not at the commit: `usePathname`
   * changes only after Next has fetched and committed the route (≈ 90 ms
   * warm, seconds cold on dev), and the old lanterns would otherwise rise
   * over the new page. The pathname change confirms it; if none arrives the
   * lanterns lower back in.
   */
  const startExit = (path: string | null): void => {
    const sim = deps.sim();

    if (!sim || deps.reduced() || pendingExit) return;

    sequenceId += 1;

    const id = sequenceId;

    exitSequence();
    pendingExit = { path, at: sim.state.ts };
    sim.schedule(
      sim.state.ts + EXIT_CONFIRM_S,
      guard(id, () => {
        if (!pendingExit) return;
        pendingExit = null;
        enterSequence('route', sim.state.ts - ROUTE.lowerInDelayMs / 1000);
      }),
    );
  };

  const routeChange = (path: string): void => {
    const sim = deps.sim();

    if (!sim) return;

    sequenceId += 1;

    const id = sequenceId;

    if (deps.reduced()) {
      pendingExit = null;
      deps.applyLayout(deps.resolveLayout(path), false);
      deps.renderReduced();

      return;
    }

    const now = sim.state.ts;
    const exitAt =
      pendingExit && (pendingExit.path === null || pendingExit.path === path)
        ? pendingExit.at
        : null;

    pendingExit = null;
    if (exitAt === null) exitSequence();

    // The exit's 280 ms count from when it started; the new page is read no
    // earlier than 60 ms after the commit (§4.2 "anchor re-read").
    const rereadAt = now + ROUTE.anchorRereadDelayMs / 1000;
    const relayoutAt = Math.max(rereadAt, (exitAt ?? now) + ROUTE_EXIT_S);
    const base = relayoutAt - ROUTE_EXIT_S;
    const exitingBodies = deps.layout().lanterns.map((l) => l.bodyRect);
    let pending: RouteLayout | null = null;
    let moonDone = false;

    // The new page paints on this commit, 60 ms before its anchors are
    // read: hand the moon the new route's nav band now (the table's
    // fallback rect; the live one follows at the re-read) so the disc is
    // already out from under an inset nav on the first painted frame.
    deps.moon.avoid(deps.navBandFor(path));

    sim.schedule(
      rereadAt,
      guard(id, () => {
        pending = deps.resolveLayout(path);
        // §8: bodies never cross the moon disc. When an exiting lantern is
        // still rising across the glide path, the glide waits for the exit.
        const crosses =
          pending.moon !== null &&
          relayoutAt > sim.state.ts &&
          deps.moon.glideCrosses(
            pending.moon.centre,
            pending.moon.diameter,
            exitingBodies,
            ROUTE.risePx,
          );

        if (!crosses) {
          deps.moon.enter(pending, sim.state.ts);
          moonDone = true;
        }
      }),
    );
    sim.schedule(
      relayoutAt,
      guard(id, () => {
        deps.applyLayout(pending ?? deps.resolveLayout(path), moonDone);
        // §4.2: the enter's settle floor/ceiling count from the navigation.
        sim.setSequenceStart(base);
        enterSequence('route', base);
      }),
    );
  };

  const stepScrollLift = (): void => {
    const sim = deps.sim();
    const layout = deps.layout();
    const lift = layout.scrollLift;

    if (!sim || !lift || !layout.lanterns.length) return;
    if (deps.view().phase !== 'enter') return;

    const y = deps.scrollY();

    if (!lifted && y > lift.liftAtScrollY) {
      lifted = true;
      for (const spec of layout.lanterns) {
        sim.light(spec.id, {
          delayS: 0,
          durationS: ROUTE.candleOutMs / 1000,
          target: 0,
        });
        sim.raise(spec.id, {
          delayS: ROUTE.riseDelayMs / 1000,
          durationS: lift.ms / 1000,
          px: lift.px,
        });
      }
    } else if (lifted && y < lift.returnBelowScrollY) {
      lifted = false;
      for (const spec of layout.lanterns) {
        const lowerDelay =
          (ROUTE.lowerInDelayMs + ROUTE.lanternStaggerMs * spec.order) / 1000;

        sim.lowerIn(spec.id, {
          delayS: lowerDelay,
          durationS: ROUTE.lowerInMs / 1000,
        });
        scheduleCatch(
          sim,
          sequenceId,
          spec.id,
          sim.state.ts +
            lowerDelay +
            (ROUTE.lowerInMs + ROUTE.candleDelayMs) / 1000,
          ROUTE,
        );
      }
    }
  };

  const advanceSettle = (): void => {
    const sim = deps.sim();

    if (!sim || deps.view().phase !== 'enter' || !sim.state.settled) return;
    if (!deps.view().translationShown) deps.reveal('translation');
    if (settledScheduled) return;
    settledScheduled = true;
    sim.schedule(
      sim.state.ts + MOUNT.settledAfterTranslationMs / 1000,
      guard(sequenceId, () => deps.setSettled(true)),
    );
  };

  const snapScrollLift = (): boolean => {
    const sim = deps.sim();
    const layout = deps.layout();
    const lift = layout.scrollLift;

    if (!sim || !lift || !layout.lanterns.length) return false;

    const y = deps.scrollY();
    const next = lifted ? y >= lift.returnBelowScrollY : y > lift.liftAtScrollY;

    if (next === lifted) return false;
    lifted = next;
    sim.snapshotLift(lifted, lift.px);

    return true;
  };

  return {
    enterSequence,
    exitSequence,
    startExit,
    routeChange,
    stepScrollLift,
    advanceSettle,
    snapScrollLift,
    resetForReduced() {
      lifted = false;
      settledScheduled = true;
      deps.setSettled(true);
    },
    cancelExit() {
      pendingExit = null;
    },
    get lifted() {
      return lifted;
    },
  };
}

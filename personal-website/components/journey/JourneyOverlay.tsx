'use client';

import { createPortal } from 'react-dom';
import {
  closeBenchJourney,
  setBenchJourneyEscapeDelegate,
} from '../concept/bench/benchStore';
import { Journey } from './Journey';
import { escapeJourney, readJourneyState } from './journeyStore';
import styles from './Journey.module.css';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), ' +
  'select:not([disabled]), textarea:not([disabled]), ' +
  '[tabindex]:not([tabindex="-1"])';

/**
 * The bench store's escape delegate: one unwind step per press, reporting
 * true once the journey has fully unwound to 'closed' — the bench ladder's
 * cue to drop the overlay.
 */
function stepJourneyEscape(): boolean {
  escapeJourney();
  return readJourneyState().status === 'closed';
}

/**
 * The overlay owns the body scroll lock exclusively: this flag stops a double
 * mount from double-locking, and a lock already held by someone else (the
 * shared Modal sets the same property) is left exactly as found.
 */
let scrollLocked = false;

/**
 * All of the overlay's mount work in one ref callback with a cleanup — the
 * React 19 replacement for a mount effect. Module-level so its identity is
 * stable and React runs it exactly once per mount.
 *
 * On mount: remember the focused trigger, make the Bench inert for readers
 * and pointers alike, lock body scroll, register the escape delegate, trap
 * Tab inside the overlay, and move focus onto the dialog itself. The cleanup
 * undoes each one and hands focus back to the trigger.
 */
function mountOverlay(element: HTMLDivElement | null) {
  if (!element) {
    return;
  }

  const trigger =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
  const benchRoot = document.querySelector('[data-bench-root]');
  benchRoot?.setAttribute('inert', '');
  document.documentElement.setAttribute('data-journey-open', '');

  const ownsScrollLock =
    !scrollLocked && document.body.style.overflow !== 'hidden';

  if (ownsScrollLock) {
    scrollLocked = true;
    document.body.style.overflow = 'hidden';
  }

  setBenchJourneyEscapeDelegate(stepJourneyEscape);

  const trapTab = (event: KeyboardEvent) => {
    if (event.key !== 'Tab' || !element.isConnected) {
      return;
    }

    const items = Array.from(element.querySelectorAll<HTMLElement>(FOCUSABLE));

    if (items.length === 0) {
      event.preventDefault();
      element.focus();
      return;
    }

    const active = document.activeElement;
    const wrapFrom = event.shiftKey ? items[0] : items[items.length - 1];

    if (active === wrapFrom || !element.contains(active)) {
      event.preventDefault();
      (event.shiftKey ? items[items.length - 1] : items[0]).focus();
    }
  };

  /*
   * On `document`, not the overlay element: a listener on the element only
   * ever hears keys targeted at its own descendants, so the recapture branch
   * below would never fire. Focus really can fall to <body> mid-journey — a
   * pager button that disables itself while focused drops focus there — and
   * from body a Tab must be pulled back into the dialog, not walk the page.
   */
  document.addEventListener('keydown', trapTab);

  /*
   * Focus the dialog container, not the first control: the wake hint's
   * onFocus is a deliberate keyboard handoff that wakes the screen, and
   * autofocusing it would skip the near-dark waking reveal on every open.
   * From here a keyboard user's first Tab reaches the hint intentionally,
   * exactly as on the standalone route.
   */
  element.focus();

  return () => {
    document.removeEventListener('keydown', trapTab);
    setBenchJourneyEscapeDelegate(null);

    if (ownsScrollLock) {
      scrollLocked = false;
      document.body.style.overflow = '';
    }

    benchRoot?.removeAttribute('inert');
    document.documentElement.removeAttribute('data-journey-open');
    trigger?.focus();
  };
}

/**
 * The Bench's full-viewport journey surface: the same <Journey /> the direct
 * /journey route renders, portalled to <body> because the bench shell clips
 * overflow. It sits under the site's grain film (z-index 999) so the page
 * keeps one uniform texture, and its opaque ground means no pointer event
 * reaches the inert, demand-rendered scene behind it.
 */
export function JourneyOverlay() {
  return createPortal(
    <div
      aria-label="Tyler’s journey"
      aria-modal="true"
      className={styles.overlay}
      ref={mountOverlay}
      role="dialog"
      tabIndex={-1}
    >
      {/*
       * The dialog's visible dismiss: Escape is invisible and a touch visitor
       * has no keyboard, so without this button the overlay would strand
       * anyone who cannot press a key.
       */}
      <button
        aria-label="Close Tyler’s journey"
        className={styles.overlayClose}
        onClick={closeBenchJourney}
        type="button"
      >
        Close <span aria-hidden="true">✕</span>
      </button>
      <Journey onExit={closeBenchJourney} />
    </div>,
    document.body,
  );
}

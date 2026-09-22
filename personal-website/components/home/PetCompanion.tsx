'use client';

import {
  useCallback,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { createPortal } from 'react-dom';
import { DownloadSimple, X } from '@phosphor-icons/react';
import styles from './PetCompanion.module.css';

const preferenceKey = 'lordboba-visible';
function subscribe(callback: () => void) {
  window.addEventListener('storage', callback);
  window.addEventListener('pet-preference', callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener('pet-preference', callback);
  };
}
function readPreference() {
  try {
    return localStorage.getItem(preferenceKey) === 'true';
  } catch {
    return false;
  }
}

export function PetCompanion() {
  const savedVisible = useSyncExternalStore(
    subscribe,
    readPreference,
    () => false,
  );
  const [localVisible, setLocalVisible] = useState<boolean | null>(null);
  const visible = localVisible ?? savedVisible;
  const [open, setOpen] = useState(false);
  const [waving, setWaving] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  function toggle() {
    setLocalVisible(!visible);
    try {
      localStorage.setItem(preferenceKey, String(!visible));
      window.dispatchEvent(new Event('pet-preference'));
    } catch {
      /* Keep the toggle usable when browser storage is unavailable. */
    }
  }

  const bindPanel = useCallback((node: HTMLElement | null) => {
    if (!node) return;
    function dismiss(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        trigger.current?.focus();
      }
    }
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', escape);
    };
  }, []);

  return (
    <>
      <div
        className={styles.root}
        ref={root}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget))
            setOpen(false);
        }}
      >
        <button
          ref={trigger}
          className={styles.trigger}
          type="button"
          aria-label="Lordboba pet settings"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen(!open)}
          title="Meet Lordboba"
        >
          <span className={styles.icon} aria-hidden="true" />
        </button>
        {open && (
          <section
            ref={bindPanel}
            id={panelId}
            className={styles.panel}
            aria-label="Lordboba pet settings"
          >
            <div className={styles.heading}>
              <div>
                <h2>Meet Lordboba</h2>
                <p>My little coding companion.</p>
              </div>
              <button
                className={styles.close}
                aria-label="Close pet settings"
                onClick={() => {
                  setOpen(false);
                  trigger.current?.focus();
                }}
              >
                <X size={18} />
              </button>
            </div>
            <button
              className={styles.toggle}
              role="switch"
              aria-checked={visible}
              onClick={toggle}
            >
              <span>Keep me company</span>
              <span
                className={styles.switch}
                data-on={visible}
                aria-hidden="true"
              >
                <span />
              </span>
            </button>
            <p className={styles.hint}>
              A small friend for this page. Your choice is remembered.
            </p>
            <a
              className={styles.download}
              href="/pets/lordboba.zip"
              download="lordboba.zip"
            >
              <DownloadSimple size={18} /> Download for Codex
            </a>
            <p className={styles.hint}>
              Pet pack · ZIP · includes setup instructions.
            </p>
          </section>
        )}
      </div>
      {visible &&
        createPortal(
          <button
            className={styles.companion}
            aria-label="Wave to Lordboba"
            title="Say hello"
            onClick={() => setWaving(true)}
          >
            <span
              className={`${styles.sprite} ${waving ? styles.wave : styles.idle}`}
              aria-hidden="true"
              onAnimationEnd={() => setWaving(false)}
            />
          </button>,
          document.body,
        )}
    </>
  );
}

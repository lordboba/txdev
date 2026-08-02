#!/usr/bin/env node
/*
 * update-history.mjs — keeps the bench's history view honest about its own
 * repository, without a single new dependency.
 *
 * WHAT IT DOES
 *   1. Reads the hand-authored eras out of components/concept/conceptData.ts.
 *      That file stays hand-authored; the script never writes to it.
 *   2. Runs `git log` to find whether the repository has moved past the newest
 *      recorded era and, once it has drifted far enough (SPAN_DAYS), records
 *      the head of that drift as ONE provisional era in
 *      components/concept/bench/historyGenerated.json. Later runs re-point that
 *      same entry at the newer head instead of adding another, so the run stays
 *      six-or-seven cards long rather than growing a card per commit.
 *   3. Rescans public/history/*.png and writes the commit -> capture manifest,
 *      so an era that has a real capture shows it and one that does not is
 *      cleanly absent rather than a broken image.
 *   4. Records the commit URL base from `git remote get-url origin`, or null
 *      when there is no remote — the view then omits the link entirely instead
 *      of inventing one.
 *   5. Refreshes the capture for the PROVISIONAL era only, by photographing the
 *      running site, when a dev/preview server is reachable AND a headless
 *      browser can be found. The archived eras are never overwritten by a shot
 *      of today's site: their captures come from the museum miniatures, which
 *      are DOM rebuilds of those exact commits (see --capture).
 *
 * USAGE
 *   node scripts/update-history.mjs            # the normal pass (npm `prebuild`)
 *   node scripts/update-history.mjs --capture  # also re-shoot every archived
 *                                              # era from the temporary
 *                                              # /concept/history-capture
 *                                              # harness, when it is present
 *   node scripts/update-history.mjs --dry-run  # print the payload, write nothing
 *
 *   HISTORY_ORIGIN=http://localhost:3000  override the server probe
 *   CHROME_PATH=/path/to/chrome           override browser discovery
 *
 * CONTRACT
 *   The exit code is ALWAYS 0. This runs as npm `prebuild`, and a portfolio
 *   build must never fail because git, a browser, or a dev server was missing.
 *   Every failure downgrades to a `note:` line on stdout.
 *
 * A generated era carries a provisional label derived from its commit subject
 * and inherits the previous era's palette, because naming a palette is a
 * curatorial judgement this script is not entitled to make. Promoting it means
 * moving the entry into `gitEras` in conceptData.ts by hand.
 */

import { execFileSync, spawn } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SITE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_FILE = join(
  SITE_ROOT,
  'components/concept/bench/historyGenerated.json',
);
const SHOT_DIR = join(SITE_ROOT, 'public/history');
const CONCEPT_DATA = join(SITE_ROOT, 'components/concept/conceptData.ts');

/**
 * How far the repository has to drift past the newest recorded era before a
 * *new* provisional card is opened. Inside the window the existing provisional
 * card is simply re-pointed at the newer head, which is what keeps this
 * idempotent and keeps the run from growing a card per commit.
 */
const SPAN_DAYS = 14;

/** Viewport the archive is photographed at. 16:9 — the card's own aspect. */
const SHOT_WIDTH = 1280;
const SHOT_HEIGHT = 720;

/** Below this a PNG is a blank frame, not a capture, and is thrown away. */
const MIN_SHOT_BYTES = 3_000;

/**
 * How long a page is left running before the shutter. The archived eras are
 * static DOM; the live homepage is a WebGL scene that loads textures, plays an
 * intro, and damps every transform into place, and photographing it early gets
 * an empty grey room.
 */
const ARCHIVE_SETTLE_MS = 3_500;
const LIVE_SETTLE_MS = 14_000;

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const captureArchive = args.has('--capture');

let noteCount = 0;

function note(message) {
  noteCount += 1;
  console.log(`note: ${message}`);
}

function git(...argv) {
  return execFileSync('git', argv, {
    cwd: SITE_ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
}

/* -------------------------------------------------------------------------- */
/* Hand-authored eras                                                          */
/* -------------------------------------------------------------------------- */

/**
 * conceptData.ts is TypeScript, and Node strips types natively, so the array is
 * read from the real module rather than re-parsed out of the source — there is
 * no second copy of the data to drift. If the import ever stops working the
 * script says so and carries on with an empty base rather than guessing.
 */
async function readAuthoredEras() {
  try {
    const loaded = await import(pathToFileURL(CONCEPT_DATA).href);
    return Array.isArray(loaded.gitEras) ? loaded.gitEras : [];
  } catch (error) {
    note(
      `could not import gitEras (${error.message}); base run treated as empty`,
    );
    return [];
  }
}

/* -------------------------------------------------------------------------- */
/* Generated file                                                              */
/* -------------------------------------------------------------------------- */

function readGenerated() {
  const empty = {
    appendedEras: [],
    shots: {},
    headCommit: null,
    commitUrlBase: null,
  };

  if (!existsSync(DATA_FILE)) {
    return empty;
  }

  try {
    const parsed = JSON.parse(readFileSync(DATA_FILE, 'utf8'));
    return {
      appendedEras: Array.isArray(parsed.appendedEras)
        ? parsed.appendedEras
        : [],
      shots:
        parsed.shots && typeof parsed.shots === 'object' ? parsed.shots : {},
      headCommit:
        typeof parsed.headCommit === 'string' ? parsed.headCommit : null,
      commitUrlBase:
        typeof parsed.commitUrlBase === 'string' ? parsed.commitUrlBase : null,
    };
  } catch (error) {
    note(
      `historyGenerated.json was unreadable (${error.message}); rebuilding it`,
    );
    return empty;
  }
}

/* -------------------------------------------------------------------------- */
/* Labels                                                                      */
/* -------------------------------------------------------------------------- */

/** Housekeeping verbs and glue that never make a good era name. */
const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'the',
  'for',
  'with',
  'into',
  'onto',
  'to',
  'of',
  'in',
  'on',
  'at',
  'by',
  'is',
  'its',
  'it',
  'as',
  'so',
  'add',
  'adds',
  'added',
  'fix',
  'fixes',
  'fixed',
  'update',
  'updates',
  'updated',
  'refactor',
  'refactors',
  'restore',
  'enhance',
  'simplify',
  'refine',
  'tweak',
  'make',
  'makes',
  'new',
  'more',
]);

/**
 * A provisional one-word name off the commit subject: the first content word
 * that is not a verb of housekeeping. Deliberately dumb — a generated card is
 * named well enough to be recognised and no better, and the view prints it as
 * provisional so nobody mistakes it for a curated name.
 */
function labelFromSubject(subject) {
  const words = subject
    .replace(/^[a-z]+(\([^)]*\))?:\s*/i, '')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
  const pick =
    words.find((word) => !STOP_WORDS.has(word.toLowerCase())) ??
    words[0] ??
    'Working';

  return pick.charAt(0).toUpperCase() + pick.slice(1).toLowerCase();
}

function daysBetween(fromIso, toIso) {
  const from = Date.parse(`${fromIso}T00:00:00Z`);
  const to = Date.parse(`${toIso}T00:00:00Z`);

  if (Number.isNaN(from) || Number.isNaN(to)) {
    return 0;
  }

  return Math.round((to - from) / 86_400_000);
}

/* -------------------------------------------------------------------------- */
/* Headless capture                                                            */
/* -------------------------------------------------------------------------- */

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);

/** Relative paths to a usable binary inside one playwright cache entry. */
const SHELL_PATHS = [
  'chrome-headless-shell-mac-arm64/chrome-headless-shell',
  'chrome-headless-shell-mac-x64/chrome-headless-shell',
  'chrome-headless-shell-linux64/chrome-headless-shell',
  'chrome-linux/chrome',
];

/**
 * Playwright's browser cache, if the machine happens to have one. This is a
 * filesystem lookup, not a dependency: nothing is installed and nothing from
 * playwright is imported.
 */
function cachedShells() {
  const roots = [
    join(process.env.HOME ?? '', 'Library/Caches/ms-playwright'),
    join(process.env.HOME ?? '', '.cache/ms-playwright'),
  ];
  const found = [];

  for (const root of roots) {
    if (!existsSync(root)) {
      continue;
    }

    for (const entry of readdirSync(root)) {
      for (const relative of SHELL_PATHS) {
        const candidate = join(root, entry, relative);

        if (existsSync(candidate)) {
          found.push(candidate);
        }
      }
    }
  }

  /* Newest build directory first — the names sort lexically by version. */
  return found.sort().reverse();
}

function findBrowser() {
  return (
    [...CHROME_CANDIDATES, ...cachedShells()].find((candidate) =>
      existsSync(candidate),
    ) ?? null
  );
}

async function reachable(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
    return response.ok;
  } catch {
    return false;
  }
}

async function findOrigin() {
  const candidates = process.env.HISTORY_ORIGIN
    ? [process.env.HISTORY_ORIGIN]
    : [
        'http://localhost:8790',
        'http://localhost:3000',
        'http://localhost:3001',
      ];

  for (const origin of candidates) {
    if (await reachable(origin)) {
      return origin;
    }
  }

  return null;
}

/**
 * Injected before any page script runs. A capture of the site is a capture of
 * the *site*: the Next dev overlay and the react-grab toolbar are local tooling
 * and have no business being archived into the history view. The observer is
 * there because both mount themselves late and would otherwise re-appear after
 * the style element is replaced during hydration.
 */
const HIDE_TOOLING = `
(() => {
  const style = document.createElement('style');
  style.textContent =
    'nextjs-portal,[data-react-grab],[data-nextjs-toast],#__next-build-watcher{display:none!important}';
  const attach = () => (document.head || document.documentElement).appendChild(style);
  attach();
  new MutationObserver(() => {
    if (!style.isConnected) attach();
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
`;

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

/**
 * A headless browser driven over CDP's stdio pipe — no WebSocket, no client
 * library, nothing installed. The pipe is used rather than the one-shot
 * `--screenshot` CLI flag for two reasons the archive depends on: a script can
 * be injected before first paint (see HIDE_TOOLING), and the page settles in
 * real time, which a WebGL scene needs and `--virtual-time-budget` does not
 * give it.
 */
function openCamera(browser) {
  const scratch = mkdtempSync(join(tmpdir(), 'bench-history-'));
  const child = spawn(
    browser,
    [
      '--headless',
      '--remote-debugging-pipe',
      '--no-first-run',
      '--no-default-browser-check',
      '--hide-scrollbars',
      '--disable-extensions',
      '--disable-background-networking',
      '--disable-sync',
      /* The homepage is a WebGL scene; give it a software rasteriser. */
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      `--user-data-dir=${join(scratch, 'profile')}`,
      'about:blank',
    ],
    { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] },
  );

  const pending = new Map();
  let buffer = Buffer.alloc(0);
  let sequence = 0;

  child.stdio[4].on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);

    /* Pipe frames are NUL-terminated JSON. */
    for (let end = buffer.indexOf(0); end !== -1; end = buffer.indexOf(0)) {
      const raw = buffer.subarray(0, end).toString('utf8');
      buffer = buffer.subarray(end + 1);

      let message;

      try {
        message = JSON.parse(raw);
      } catch {
        continue;
      }

      const waiter = pending.get(message.id);

      if (waiter) {
        pending.delete(message.id);
        waiter(message.error ? null : message.result);
      }
    }
  });

  function send(method, params, sessionId) {
    sequence += 1;
    const id = sequence;
    const frame = { id, method, params: params ?? {} };

    if (sessionId) {
      frame.sessionId = sessionId;
    }

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        resolve(null);
      }, 30_000);

      pending.set(id, (result) => {
        clearTimeout(timer);
        resolve(result);
      });

      try {
        child.stdio[3].write(`${JSON.stringify(frame)}\0`);
      } catch {
        clearTimeout(timer);
        pending.delete(id);
        resolve(null);
      }
    });
  }

  return {
    /**
     * A capture only replaces the archived image once it is a real frame, so a
     * failed or blank shot can never blank out an era that already has one.
     */
    async capture(url, destination, settleMs) {
      const created = await send('Target.createTarget', { url: 'about:blank' });

      if (!created?.targetId) {
        return false;
      }

      const attached = await send('Target.attachToTarget', {
        targetId: created.targetId,
        flatten: true,
      });
      const session = attached?.sessionId;

      if (!session) {
        return false;
      }

      await send(
        'Emulation.setDeviceMetricsOverride',
        {
          width: SHOT_WIDTH,
          height: SHOT_HEIGHT,
          deviceScaleFactor: 1,
          mobile: false,
        },
        session,
      );
      await send('Page.enable', {}, session);
      /* Background tabs never composite, so the shot would hang without this. */
      await send('Target.activateTarget', { targetId: created.targetId });
      await send(
        'Page.addScriptToEvaluateOnNewDocument',
        { source: HIDE_TOOLING },
        session,
      );
      await send('Page.navigate', { url }, session);
      await sleep(settleMs);

      const shot = await send(
        'Page.captureScreenshot',
        { format: 'png', captureBeyondViewport: false },
        session,
      );

      await send('Target.closeTarget', { targetId: created.targetId });

      if (!shot?.data) {
        return false;
      }

      const bytes = Buffer.from(shot.data, 'base64');

      if (bytes.length < MIN_SHOT_BYTES) {
        return false;
      }

      const staged = join(scratch, 'shot.png');
      writeFileSync(staged, bytes);
      copyFileSync(staged, destination);
      return true;
    },

    close() {
      child.kill();
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Main                                                                        */
/* -------------------------------------------------------------------------- */

async function main() {
  mkdirSync(SHOT_DIR, { recursive: true });

  const authored = await readAuthoredEras();
  const previous = readGenerated();
  const appendedEras = previous.appendedEras.slice();

  let head = null;
  /*
   * Seeded from the last run. A build machine without git, or a clone with the
   * remote temporarily unreachable, must not silently strip the commit links
   * out of a file that already had them — an absent tool is not evidence that
   * the remote went away.
   */
  let commitUrlBase = previous.commitUrlBase;

  try {
    head = {
      commit: git('log', '-1', '--format=%h'),
      date: git('log', '-1', '--format=%ad', '--date=short'),
      subject: git('log', '-1', '--format=%s'),
    };
  } catch (error) {
    note(`git log unavailable (${error.message}); the era run is left as-is`);
  }

  try {
    const remote = git('remote', 'get-url', 'origin');
    const https = remote
      .replace(/^git@([^:]+):/, 'https://$1/')
      .replace(/\.git$/, '');

    if (/^https?:\/\//.test(https)) {
      commitUrlBase = `${https}/commit/`;
    } else {
      note(`remote "${remote}" is not an http(s) URL; commit links omitted`);
    }
  } catch {
    note(
      commitUrlBase
        ? 'git remote unreadable; keeping the commit link base already recorded'
        : 'no git remote named origin; commit links omitted',
    );
  }

  /* ---- era run ---------------------------------------------------------- */

  const recorded = [...authored, ...appendedEras];
  const newest = recorded[recorded.length - 1] ?? null;
  /*
   * What the provisional card is measured *from*. When one already exists it is
   * the era before it, so re-pointing the same card never restarts the clock —
   * that is the whole of the idempotence guarantee.
   */
  const anchor =
    appendedEras.length > 0
      ? (recorded[recorded.length - 2] ?? newest)
      : newest;

  if (head && newest && anchor && head.commit !== newest.commit) {
    const drift = daysBetween(anchor.date, head.date);
    const entry = {
      commit: head.commit,
      date: head.date,
      label: labelFromSubject(head.subject),
      title: head.subject,
      description: `Recorded from commit ${head.commit} — “${head.subject}”. Not yet named or classified by hand.`,
      visualLanguage: 'Current build',
      /* Inherited: naming a palette is a judgement, not a git fact. */
      palette: anchor.palette,
    };

    if (drift < SPAN_DAYS && appendedEras.length === 0) {
      note(
        `head ${head.commit} is ${drift} day(s) past ${newest.commit}; under the ${SPAN_DAYS}-day span, nothing appended`,
      );
    } else if (appendedEras.length > 0 && drift < SPAN_DAYS) {
      appendedEras[appendedEras.length - 1] = entry;
      console.log(`history: provisional era re-pointed at ${head.commit}`);
    } else {
      appendedEras.push(entry);
      console.log(`history: appended provisional era ${head.commit}`);
    }
  } else if (head) {
    console.log(`history: era run already current at ${head.commit}`);
  }

  const eras = [...authored, ...appendedEras];
  /* Only a generated era depicts the site as it stands right now. */
  const live = appendedEras[appendedEras.length - 1] ?? null;
  /*
   * Re-shooting the live page on every build would rewrite a half-megabyte PNG
   * each time and dirty the tree for nothing. The capture is only refreshed
   * when the commit it claims to depict has actually moved, when the file is
   * missing, or when --capture asks for the whole archive.
   */
  const liveShotIsCurrent =
    live !== null &&
    !captureArchive &&
    /* No git means no evidence the head moved, so nothing is re-shot. */
    (head === null || previous.headCommit === head.commit) &&
    existsSync(join(SHOT_DIR, `${live.commit}.png`));

  /* ---- captures --------------------------------------------------------- */

  const origin = dryRun ? null : await findOrigin();
  const browser = findBrowser();

  if (dryRun) {
    note('--dry-run: captures skipped');
  } else if (liveShotIsCurrent) {
    console.log(`history: ${live.commit}.png already depicts this head`);
  } else if (!live && !captureArchive) {
    console.log('history: every era is archived; no live capture needed');
  } else if (!origin) {
    note('no dev/preview server reachable; capture skipped');
  } else if (!browser) {
    note('no headless browser found (set CHROME_PATH); capture skipped');
  } else {
    const camera = openCamera(browser);

    try {
      if (live && !liveShotIsCurrent) {
        const ok = await camera.capture(
          `${origin}/`,
          join(SHOT_DIR, `${live.commit}.png`),
          LIVE_SETTLE_MS,
        );
        console.log(
          ok
            ? `history: captured ${live.commit}.png from ${origin}/`
            : `note: capture of ${origin}/ produced nothing; archive left alone`,
        );
      }

      if (captureArchive) {
        for (const era of eras) {
          if (era === live) {
            continue;
          }

          const url = `${origin}/concept/history-capture/${era.commit}`;

          if (!(await reachable(url))) {
            note(`capture harness has no page for ${era.commit}; skipped`);
            continue;
          }

          const ok = await camera.capture(
            url,
            join(SHOT_DIR, `${era.commit}.png`),
            ARCHIVE_SETTLE_MS,
          );
          console.log(
            ok
              ? `history: captured ${era.commit}.png`
              : `note: capture of ${era.commit} produced nothing`,
          );
        }
      }
    } finally {
      camera.close();
    }
  }

  /* ---- manifest --------------------------------------------------------- */

  const shots = {};

  for (const era of eras) {
    if (existsSync(join(SHOT_DIR, `${era.commit}.png`))) {
      shots[era.commit] = `/history/${era.commit}.png`;
    }
  }

  const payload = {
    $comment:
      'Generated by scripts/update-history.mjs. Do not hand-edit — the curated eras live in components/concept/conceptData.ts.',
    generatedAt: new Date().toISOString().slice(0, 10),
    headCommit: head?.commit ?? previous.headCommit,
    commitUrlBase,
    appendedEras,
    shots,
  };

  if (dryRun) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  /*
   * `generatedAt` is excluded from the comparison on purpose: a build that
   * changed nothing must not produce a diff, or `prebuild` would dirty the
   * working tree on every single run.
   */
  const stable = (value) => JSON.stringify({ ...value, generatedAt: null });
  const before = existsSync(DATA_FILE)
    ? stable(JSON.parse(readFileSync(DATA_FILE, 'utf8')))
    : null;

  if (before === stable(payload)) {
    console.log('history: no change');
    return;
  }

  writeFileSync(DATA_FILE, `${JSON.stringify(payload, null, 2)}\n`);
  console.log('history: wrote components/concept/bench/historyGenerated.json');
}

try {
  await main();
} catch (error) {
  note(`aborted without changes: ${error.message}`);
}

if (noteCount > 0) {
  console.log(`history: finished with ${noteCount} note(s)`);
}

process.exit(0);

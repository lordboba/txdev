/**
 * Mid-Autumn festival: flag, window, script choice, route allow-list and
 * runtime-override parsing (bible §7.2). Pure and testable: no DOM, no three.
 *
 * Server side (`app/layout.tsx`) reads `isFestivalEnabledOnServer()` and drops
 * the mount entirely when it is false. The client gate (`FestivalMount`) reads
 * the calendar window and the `?festival=` / `localStorage.festival` overrides
 * through `resolveFestivalGate()`.
 */

export type FestivalScript = 'Hans' | 'Hant';

export type FestivalConfig = {
  /** Master switch. `false` removes every festival node, font and attribute. */
  enabled: boolean;
  /** Han script for the colophon, poem, slip and moon name (§6.A, §9.1). */
  script: FestivalScript;
  /** The fifteenth night, ISO calendar date (local time). */
  date: string;
  /** Inclusive calendar window, compared in the visitor's local time. */
  window: { start: string; end: string };
  /** 走马灯 on the 72 px `/` hero; flipped to false if §7.7 V6 fails. */
  revolvingOnHome: boolean;
};

export const festival: FestivalConfig = {
  enabled: true,
  script: 'Hans',
  date: '2026-09-25',
  window: { start: '2026-09-21', end: '2026-10-04' },
  revolvingOnHome: true,
};

/** `html[data-festival="mid-autumn"]` while the layer is mounted. */
export const FESTIVAL_ATTRIBUTE_VALUE = 'mid-autumn';
/** `localStorage` key holding the persisted `?festival=0|1` override. */
export const FESTIVAL_STORAGE_KEY = 'festival';
/** Query keys (same gate style as `?bench-debug=1`). */
export const FESTIVAL_QUERY_KEY = 'festival';
export const FESTIVAL_SEED_QUERY_KEY = 'festival-seed';
/** Env var read on the server; `'0'` disables the mount. */
export const FESTIVAL_ENV_KEY = 'NEXT_PUBLIC_FESTIVAL';

/** Mobile threshold matches the Bench (`components/concept/bench/Bench.tsx`). */
export const MOBILE_MAX_WIDTH = 700;
export const MOBILE_MEDIA_QUERY = `(max-width: ${MOBILE_MAX_WIDTH}px)`;

export function isMobileWidth(viewportWidth: number): boolean {
  return viewportWidth <= MOBILE_MAX_WIDTH;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export const FESTIVAL_ROUTES = [
  '/',
  '/orbital',
  '/blog',
  '/blog/[slug]',
  '/past-experience',
  '/schedule-a-call',
] as const;

export type FestivalRoute = (typeof FESTIVAL_ROUTES)[number];

/**
 * Maps a live pathname to its allow-list entry, or `null` when the festival
 * is off for that path (`/terminal`, `/journey`, `/concept/*`, unknown).
 * `/blog/<slug>` (one segment, non-empty) resolves to `'/blog/[slug]'`.
 */
export function festivalRoute(pathname: string): FestivalRoute | null {
  if (!pathname) return null;

  const path = normalizePathname(pathname);

  if (path === '/') return '/';
  if (path === '/orbital') return '/orbital';
  if (path === '/blog') return '/blog';
  if (path === '/past-experience') return '/past-experience';
  if (path === '/schedule-a-call') return '/schedule-a-call';
  if (/^\/blog\/[^/]+$/.test(path)) return '/blog/[slug]';

  return null;
}

export function isFestivalRoute(pathname: string): boolean {
  return festivalRoute(pathname) !== null;
}

function normalizePathname(pathname: string): string {
  const withoutQuery = pathname.split(/[?#]/, 1)[0] || '/';
  const trimmed = withoutQuery.replace(/\/+$/, '');

  return trimmed === '' ? '/' : trimmed;
}

// ---------------------------------------------------------------------------
// Flag, window and overrides
// ---------------------------------------------------------------------------

/** Server gate: the flag and `NEXT_PUBLIC_FESTIVAL=0` (bible §7.2). */
export function isFestivalEnabledOnServer(
  env: Record<string, string | undefined> = process.env,
  config: FestivalConfig = festival,
): boolean {
  return config.enabled && env[FESTIVAL_ENV_KEY] !== '0';
}

/** Local calendar key `YYYY-MM-DD` for a Date (no UTC shift). */
export function localDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');

  return `${y}-${m}-${d}`;
}

/** Inclusive calendar comparison in the visitor's local time. */
export function isWithinFestivalWindow(
  now: Date,
  window: FestivalConfig['window'] = festival.window,
): boolean {
  const key = localDateKey(now);

  return key >= window.start && key <= window.end;
}

type SearchInput = string | URLSearchParams | null | undefined;

function toParams(search: SearchInput): URLSearchParams {
  if (search instanceof URLSearchParams) return search;
  if (!search) return new URLSearchParams();

  return new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
}

/** `?festival=1` → true, `?festival=0` → false, anything else → null. */
export function parseFestivalOverride(search: SearchInput): boolean | null {
  const value = toParams(search).get(FESTIVAL_QUERY_KEY);

  if (value === '1') return true;
  if (value === '0') return false;

  return null;
}

/** `?festival-seed=<n>` → a finite non-negative integer, else null. */
export function parseFestivalSeed(search: SearchInput): number | null {
  const value = toParams(search).get(FESTIVAL_SEED_QUERY_KEY);

  if (value === null || !/^\d{1,9}$/.test(value.trim())) return null;

  return Number.parseInt(value, 10);
}

/** Reads the persisted override; tolerant of a missing or throwing storage. */
export function readStoredOverride(
  storage: Pick<Storage, 'getItem'> | null | undefined,
): boolean | null {
  try {
    const value = storage?.getItem(FESTIVAL_STORAGE_KEY) ?? null;

    if (value === '1') return true;
    if (value === '0') return false;

    return null;
  } catch {
    return null;
  }
}

export type FestivalGateInput = {
  /** `location.search` (with or without the leading `?`). */
  search?: SearchInput;
  /** `readStoredOverride(localStorage)`; the query wins over it. */
  storedOverride?: boolean | null;
  now?: Date;
  config?: FestivalConfig;
};

export type FestivalGate = {
  /** Mount the layer. */
  active: boolean;
  /** Which input decided it (for `?bench-debug=1` logging). */
  reason: 'flag-off' | 'query' | 'storage' | 'window';
  /** The query override to persist (`null` when the query carried none). */
  persist: boolean | null;
  seed: number | null;
};

/**
 * Client gate (bible §7.2): `enabled` must be true; then the `?festival=`
 * query overrides everything and is persisted; then the stored override; then
 * the calendar window. `?festival-seed=<n>` rides along.
 */
export function resolveFestivalGate({
  search,
  storedOverride = null,
  now = new Date(),
  config = festival,
}: FestivalGateInput = {}): FestivalGate {
  const seed = parseFestivalSeed(search);
  const query = parseFestivalOverride(search);

  if (!config.enabled) {
    return { active: false, reason: 'flag-off', persist: null, seed };
  }
  if (query !== null) {
    return { active: query, reason: 'query', persist: query, seed };
  }
  if (storedOverride !== null) {
    return { active: storedOverride, reason: 'storage', persist: null, seed };
  }

  return {
    active: isWithinFestivalWindow(now, config.window),
    reason: 'window',
    persist: null,
    seed,
  };
}

// ---------------------------------------------------------------------------
// Colophon (bible §6.A1)
// ---------------------------------------------------------------------------

/** The literal used at runtime on any Intl mismatch (asserted by the test). */
export const COLOPHON_FALLBACK = '丙午年八月十五';
/** The mono label that follows the Han dateline on `/` only. */
export const COLOPHON_LABEL = 'THE FIFTEENTH NIGHT';
export const COLOPHON_TITLE =
  'Mid-Autumn, the fifteenth night of the eighth month, year 丙午';

const HAN_DIGITS = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

/** Day of a lunar month, 1–30, in the strip-dating convention (廿 for 21–29). */
export function hanDay(day: number): string {
  if (!Number.isInteger(day) || day < 1 || day > 30) {
    throw new RangeError(`hanDay: ${day} is not a lunar day 1–30`);
  }
  if (day < 10) return HAN_DIGITS[day];
  if (day === 10) return '十';
  if (day < 20) return `十${HAN_DIGITS[day - 10]}`;
  if (day === 20) return '二十';
  if (day < 30) return `廿${HAN_DIGITS[day - 20]}`;

  return '三十';
}

/** Parses `YYYY-MM-DD` as a local calendar date (midnight local). */
export function parseLocalDate(iso: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);

  if (!match) throw new RangeError(`parseLocalDate: ${iso} is not YYYY-MM-DD`);

  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/**
 * `yearName + '年' + month + hanDay(day)` from the ICU Chinese calendar, e.g.
 * `丙午年八月十五` for 2026-09-25. Throws when a part is missing so the caller
 * can fall back to `COLOPHON_FALLBACK`.
 */
export function formatChineseDate(
  date: Date,
  script: FestivalScript = festival.script,
): string {
  const locale =
    script === 'Hant' ? 'zh-Hant-u-ca-chinese' : 'zh-Hans-u-ca-chinese';
  const parts = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).formatToParts(date);
  const part = (type: string) => parts.find((p) => p.type === type)?.value;
  const yearName = part('yearName');
  const month = part('month');
  const day = Number(part('day'));

  if (!yearName || !month || !Number.isInteger(day)) {
    throw new Error(
      'formatChineseDate: ICU returned no chinese-calendar parts',
    );
  }

  return `${yearName}年${month}${hanDay(day)}`;
}

/**
 * The colophon dateline for the configured festival date; never throws. For
 * the shipped date the ICU result must equal `COLOPHON_FALLBACK` (the test
 * asserts it); on any runtime mismatch the literal is used instead.
 */
export function colophonDate(config: FestivalConfig = festival): string {
  const shippedDate = config.date === festival.date;

  try {
    const value = formatChineseDate(parseLocalDate(config.date), config.script);

    return shippedDate && value !== COLOPHON_FALLBACK
      ? COLOPHON_FALLBACK
      : value;
  } catch {
    return COLOPHON_FALLBACK;
  }
}

/**
 * The one date-range convention every surface renders: `Mon YYYY–Mon YYYY`
 * with an en dash and no spaces, the year written once when both ends share
 * it ("Jun–Sep 2025"), "Present" for an open end ("May 2025–Present"), and a
 * bare `YYYY` for a year-only range that starts and ends in the same year.
 */

const EN_DASH = '\u2013';
const MONTH_YEAR =
  /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{4})$/;
const YEAR = /^\d{4}$/;

export const PRESENT = 'Present';

type Point = { month: string | null; year: string };

function parsePoint(value: string): Point | null {
  const monthYear = MONTH_YEAR.exec(value);

  if (monthYear) {
    return { month: monthYear[1], year: monthYear[2] };
  }

  if (YEAR.test(value)) {
    return { month: null, year: value };
  }

  return null;
}

function label(point: Point) {
  return point.month ? `${point.month} ${point.year}` : point.year;
}

/**
 * Formats a `start`/`end` pair, each `Mon YYYY` or `YYYY`, with `end` also
 * accepting "Present". Anything else is passed through joined by the en dash,
 * so a phrase that is not a date is never mangled.
 */
export function formatPeriod(start: string, end: string): string {
  const from = parsePoint(start);

  if (!from) {
    return `${start}${EN_DASH}${end}`;
  }

  if (end === PRESENT) {
    return `${label(from)}${EN_DASH}${PRESENT}`;
  }

  const to = parsePoint(end);

  if (!to) {
    return `${label(from)}${EN_DASH}${end}`;
  }

  if (from.year === to.year) {
    if (from.month && to.month) {
      return from.month === to.month
        ? label(from)
        : `${from.month}${EN_DASH}${to.month} ${from.year}`;
    }

    if (!from.month && !to.month) {
      return from.year;
    }
  }

  return `${label(from)}${EN_DASH}${label(to)}`;
}

/**
 * Mid-Autumn festival font: hand-subsets Noto Serif SC Medium (weight 500) to
 * the 28 Han glyphs the layer sets (colophon, poem, riddle 谜目/谜底, the moon's
 * name, in both Simplified and Traditional) and writes the woff2 that
 * `components/festival/fonts.ts` loads through `next/font/local`.
 *
 * Bible §6.A ("Font"). Run once by hand; the output is committed, the source
 * OTF is not.
 *
 * Usage:
 *   node scripts/build-festival-font.mjs [--cache <dir>] [--out <file>]
 *
 *   --cache  where the 11.7 MB source OTF is downloaded and kept
 *            (default: <os.tmpdir()>/festival-font-cache; pass the session
 *            scratchpad when running inside Claude Code)
 *   --out    the woff2 to write
 *            (default: components/festival/fonts/NotoSerifSC-festival.woff2)
 *
 * Source: https://github.com/notofonts/noto-cjk/raw/main/Serif/SubsetOTF/SC/NotoSerifSC-Medium.otf
 *         Noto Serif CJK, © Google/Adobe, SIL Open Font License 1.1
 *         (https://github.com/notofonts/noto-cjk/blob/main/Serif/LICENSE).
 *         The OFL permits subsetting and redistribution; the subset keeps
 *         the font's name records.
 *
 * Tooling: `pyftsubset` from fontTools (https://fonttools.readthedocs.io).
 *   It is looked up on PATH first, then at /opt/miniconda3/bin/pyftsubset.
 *   If neither exists the script fails loudly with the install hint below.
 *   No project dependency is added.
 *
 * What it does:
 *   1. downloads the SubsetOTF into `--cache` (skipped when already there),
 *   2. runs `pyftsubset <otf> --text=<28 glyphs> --layout-features=vert,vrt2,
 *      locl,kern,halt --no-hinting --desubroutinize --flavor=woff2`,
 *   3. re-opens the woff2 with fontTools and asserts every code point of the
 *      subset text is mapped, the glyph count is 29 (28 + .notdef; a few more
 *      are tolerated if a future source adds vertical alternates), the weight
 *      class is 500 and the file is within the 12 KB payload budget (§7.5).
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const SOURCE_URL =
  'https://github.com/notofonts/noto-cjk/raw/main/Serif/SubsetOTF/SC/NotoSerifSC-Medium.otf';
const SOURCE_FILE = 'NotoSerifSC-Medium.otf';
/** Sanity floor for the download (the real file is ≈ 11.7 MB). */
const SOURCE_MIN_BYTES = 10_000_000;

/**
 * The 28 glyphs (bible §6.A): 中秋 · 丙午年八月十五 (colophon) · 打一项目文
 * (谜目) · 谜底 · 千里共婵娟 (poem) · 玉盘 (moon name) · 項謎嬋盤 (the
 * Traditional forms so `festival.script = 'Hant'` costs nothing) · U+00B7.
 */
export const SUBSET_TEXT =
  '中秋丙午年八月十五打一项目文谜底千里共婵娟玉盘項謎嬋盤·';
export const LAYOUT_FEATURES = ['vert', 'vrt2', 'locl', 'kern', 'halt'];
export const EXPECTED_WEIGHT_CLASS = 500;
/** §7.5 payload row: font ≤ 12 KB. */
export const MAX_BYTES = 12 * 1024;

const PYFTSUBSET_CANDIDATES = ['pyftsubset', '/opt/miniconda3/bin/pyftsubset'];
const PYTHON_CANDIDATES = ['python3', '/opt/miniconda3/bin/python'];
const INSTALL_HINT =
  'pyftsubset (fontTools) is required: `pip install fonttools brotli`, or ' +
  'use the miniconda copy at /opt/miniconda3/bin/pyftsubset.';

function parseArgs(argv) {
  const args = {};

  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i].startsWith('--')) {
      args[argv[i].slice(2)] = argv[i + 1];
      i += 1;
    }
  }

  return args;
}

function findExecutable(candidates, probeArgs) {
  for (const candidate of candidates) {
    const probe = spawnSync(candidate, probeArgs, { encoding: 'utf8' });

    if (!probe.error && probe.status === 0) return candidate;
  }

  return null;
}

async function download(url, target) {
  if (existsSync(target) && statSync(target).size >= SOURCE_MIN_BYTES) {
    console.log(`source cached: ${target}`);

    return;
  }

  console.log(`downloading ${url}`);
  const response = await fetch(url, { redirect: 'follow' });

  if (!response.ok) {
    throw new Error(`download failed: HTTP ${response.status} for ${url}`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());

  if (bytes.length < SOURCE_MIN_BYTES) {
    throw new Error(
      `download too small (${bytes.length} bytes); expected ≈ 11.7 MB`,
    );
  }

  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, bytes);
  console.log(`saved ${bytes.length} bytes → ${target}`);
}

function subset(pyftsubset, source, output) {
  mkdirSync(dirname(output), { recursive: true });

  const args = [
    source,
    `--text=${SUBSET_TEXT}`,
    `--layout-features=${LAYOUT_FEATURES.join(',')}`,
    '--no-hinting',
    '--desubroutinize',
    '--flavor=woff2',
    `--output-file=${output}`,
  ];

  console.log(`${pyftsubset} ${args.join(' ')}`);
  const result = spawnSync(pyftsubset, args, { encoding: 'utf8' });

  if (result.status !== 0) {
    throw new Error(
      `pyftsubset failed (${result.status}):\n${result.stderr || result.stdout}`,
    );
  }
}

/** Re-opens the woff2 with fontTools and prints one JSON line of facts. */
function inspect(python, output) {
  const script = `
import json, sys
from fontTools.ttLib import TTFont
font = TTFont(sys.argv[1])
cmap = font.getBestCmap()
text = sys.argv[2]
gsub = sorted({r.FeatureTag for r in font['GSUB'].table.FeatureList.FeatureRecord}) if 'GSUB' in font else []
gpos = sorted({r.FeatureTag for r in font['GPOS'].table.FeatureList.FeatureRecord}) if 'GPOS' in font else []
print(json.dumps({
  'numGlyphs': font['maxp'].numGlyphs,
  'missing': [c for c in text if ord(c) not in cmap],
  'weightClass': font['OS/2'].usWeightClass,
  'family': font['name'].getDebugName(1),
  'flavor': font.flavor,
  'gsub': gsub,
  'gpos': gpos,
}))
`;
  const result = spawnSync(python, ['-c', script, output, SUBSET_TEXT], {
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    throw new Error(`fontTools inspection failed:\n${result.stderr}`);
  }

  return JSON.parse(result.stdout.trim());
}

function assertSubset(facts, output) {
  const uniqueGlyphs = new Set(SUBSET_TEXT).size;
  const expected = uniqueGlyphs + 1; // + .notdef
  const bytes = statSync(output).size;
  const problems = [];

  if (facts.missing.length > 0) {
    problems.push(`unmapped code points: ${facts.missing.join(' ')}`);
  }
  if (facts.numGlyphs < expected || facts.numGlyphs > expected + 8) {
    problems.push(
      `glyph count ${facts.numGlyphs}, expected ${expected} (28 + .notdef, ≤ 8 vertical alternates)`,
    );
  }
  if (facts.weightClass !== EXPECTED_WEIGHT_CLASS) {
    problems.push(`weight class ${facts.weightClass}, expected 500`);
  }
  if (facts.flavor !== 'woff2') problems.push(`flavor ${facts.flavor}`);
  if (bytes > MAX_BYTES) {
    problems.push(`${bytes} bytes exceeds the ${MAX_BYTES} byte budget`);
  }

  if (problems.length > 0) {
    throw new Error(`subset assertions failed:\n  ${problems.join('\n  ')}`);
  }

  console.log(
    `ok: ${facts.family} ${facts.weightClass}, ${facts.numGlyphs} glyphs ` +
      `(${uniqueGlyphs} mapped + .notdef), GSUB [${facts.gsub}] GPOS [${facts.gpos}], ` +
      `${bytes} bytes → ${output}`,
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cache = resolve(args.cache ?? join(tmpdir(), 'festival-font-cache'));
  const output = resolve(
    args.out ??
      join(
        PROJECT_ROOT,
        'components/festival/fonts/NotoSerifSC-festival.woff2',
      ),
  );

  const pyftsubset = findExecutable(PYFTSUBSET_CANDIDATES, ['--help']);
  const python = findExecutable(PYTHON_CANDIDATES, ['-c', 'import fontTools']);

  if (!pyftsubset || !python) {
    console.error(INSTALL_HINT);
    process.exit(1);
  }

  const source = join(cache, SOURCE_FILE);
  await download(SOURCE_URL, source);
  subset(pyftsubset, source, output);
  assertSubset(inspect(python, output), output);
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});

'use client';

import {
  ContactShadows,
  Environment,
  Lightformer,
  RoundedBox,
  useTexture,
} from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { useMemo, useRef, useSyncExternalStore } from 'react';
import * as THREE from 'three';
import {
  companyRun,
  experiments,
  featuredProjects,
  gitEras,
  personalNotes,
  type ConceptViewId,
  type FeaturedProject,
} from '../conceptData';
import { useConceptView } from '../conceptViewStore';
import {
  damp,
  dampAngle,
  quadraticBezier,
  usePointerListener,
} from '../shared/runtime';
import {
  clearBenchSelection,
  readBenchFocus,
  readBenchPointer,
  readBenchSettled,
  setBenchHover,
  setBenchPointer,
  setBenchSelection,
  setBenchSettled,
  subscribeBenchSettled,
} from './benchStore';

const INK = '#141517';
const ALUMINUM = '#b4b6b8';
const ALUMINUM_DARK = '#9a9c9e';
const ALUMINUM_BRIGHT = '#d3d5d7';
const PHONE_INK = '#1b1c1e';
const SCREEN_WELL = '#0a0b0c';
/**
 * Graded studio values. These are deliberately three separated steps — bench
 * top lightest, sky a full step down — so the set never collapses into one
 * flat field the way a single grey does.
 */
/*
 * Pulled ~14% of linear reflectance out of the bench (was #d4d6d8). The set had
 * an inverted value structure: an empty patch of bench out at CSS x1100/y700
 * rendered at L234 while Tyler's face on the profile card sat at L165, so the
 * brightest object in a portrait was the furniture. The subject gets the top of
 * the range now and the bench sits under it.
 */
const BENCH_TOP = '#c7c9cb';
const BENCH_FLOOR = '#c4c7ca';
/* Tracks BENCH_TOP down: a front chamfer brighter than the surface it turns
   off reads as a lit stripe across the bottom of the frame, not as an edge. */
const BENCH_RAIL = '#babcbe';
/**
 * The set is deliberately a full value step under the bench top now. At
 * #c6c9cc the sky sat 14 levels under BENCH_TOP, which is inside the noise of
 * a JPEG and read as one flat field; #b7babd is 29 levels down, so the bench
 * separates from the backdrop before any fog or falloff is applied.
 */
const SET_GREY = '#b7babd';
const COVE_GREY = '#b4b7ba';
const PHONE_TITLES = new Set(['iCalarms', 'Charades 2026']);

/**
 * Bench top: top surface at y = 0, front edge pinned at z = 1.7 (just clear of
 * the frontmost device). The back edge is buried inside the studio cove, so it
 * never terminates as a visible plateau lip.
 */
const BENCH_WIDTH = 32;
const BENCH_DEPTH = 15;
const BENCH_THICKNESS = 0.22;
const BENCH_FRONT_Z = 1.7;
const BENCH_BACK_Z = BENCH_FRONT_Z - BENCH_DEPTH;
const BENCH_CENTER_Z = BENCH_FRONT_Z - BENCH_DEPTH / 2;
/** Hairline seam, placed off the front edge so it stays inside every frame. */
const BENCH_SEAM_Z = BENCH_FRONT_Z - 3.4;

/** Infinity cyc: bench top sweeps into the back wall on a 4-unit cove. */
const COVE_RADIUS = 4;
const COVE_HEIGHT = 16;
const COVE_BACK = 12;
const COVE_WIDTH = 46;

const HISTORY_SPACING = 1.52;
/** Shallow arc radius the history chips are laid on so the outer chips toe in. */
const HISTORY_ARC = 16;
/**
 * Where the work cluster sits. The camera *and* the look target both ride this
 * value, so moving it slides the whole cluster across the frame without ever
 * skewing the lens off the subject.
 *
 * It used to be -0.52, parked a full unit left of the cluster centroid purely
 * to dodge the DOM intro plate. That bought clearance by donating 40% of the
 * frame to empty bench on the left while the rightmost lid cleared the edge by
 * 72 CSS — an off-balance shot with a dead half. The lens now rides the cluster
 * itself and the DOM gets out of its way instead.
 */
const WORK_CENTER_X = 0.35;
/**
 * Camera distance for the work lens; the tighter value is the selected pose.
 * Pulled in from 7.15 with the re-centre: the four-device silhouette was
 * leaving ~260 CSS of bench on both sides once it was centred, and the devices
 * are the subject — they get the viewport.
 */
const WORK_CAMERA_Z = 6.5;

/**
 * The display needs the world position and world normal of every fragment, not
 * just its uv: the sheen band and the Fresnel rim are both functions of the
 * view vector, and a highlight that does not move when the pointer parallax
 * swings the camera is the loudest tell that a render is not a photograph.
 * `cameraMatrix`-free — three supplies `cameraPosition` to every ShaderMaterial.
 */
const SCREEN_VERTEX_SHADER = `
  varying vec2 vUv;
  varying vec3 vWorld;
  varying vec3 vNormal;
  varying vec3 vTangent;

  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    /* A plane's local axes are the panel's own right/up, so no TBN needed. */
    vNormal = normalize(mat3(modelMatrix) * vec3(0.0, 0.0, 1.0));
    vTangent = normalize(mat3(modelMatrix) * vec3(1.0, 0.0, 0.0));
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;
/**
 * Nine-tap defocus that also desaturates and lifts toward the set grey, so a
 * peripheral device recedes atmospherically instead of showing tap ghosting.
 * uRepeat/uOffset carry the cover-crop the standard uv transform cannot apply
 * to a raw ShaderMaterial; uSize/uRadius mask the plane to a rounded display.
 * The sheen band, vignette and emissive gain are what turn a screenshot decal
 * into lit glass — uSeed slides the band so no two screens share a highlight.
 */
const SCREEN_FRAGMENT_SHADER = `
  uniform sampler2D uTexture;
  uniform vec2 uTexel;
  uniform vec2 uRepeat;
  uniform vec2 uOffset;
  uniform vec2 uSize;
  uniform float uBlur;
  uniform float uRadius;
  uniform float uSeed;
  uniform float uGain;
  varying vec2 vUv;
  varying vec3 vWorld;
  varying vec3 vNormal;
  varying vec3 vTangent;

  vec3 tap(vec2 uv) {
    vec2 clamped = clamp(uv, vec2(0.0), vec2(1.0)) * uRepeat + uOffset;
    return texture2D(uTexture, clamped).rgb;
  }

  void main() {
    vec2 stepSize = uTexel * uBlur;
    vec3 color = tap(vUv) * 0.24;
    color += tap(vUv + vec2(stepSize.x, 0.0)) * 0.12;
    color += tap(vUv - vec2(stepSize.x, 0.0)) * 0.12;
    color += tap(vUv + vec2(0.0, stepSize.y)) * 0.12;
    color += tap(vUv - vec2(0.0, stepSize.y)) * 0.12;
    color += tap(vUv + stepSize) * 0.07;
    color += tap(vUv - stepSize) * 0.07;
    color += tap(vUv + vec2(stepSize.x, -stepSize.y)) * 0.07;
    color += tap(vUv + vec2(-stepSize.x, stepSize.y)) * 0.07;

    float defocus = clamp(uBlur / 4.0, 0.0, 1.0);
    float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
    color = mix(color, vec3(luma), defocus * 0.55);
    color = mix(color, vec3(0.620, 0.634, 0.647), defocus * 0.35);

    /*
     * Emissive gain: a lit display always out-values the bench. Trimmed from
     * 1.16/0.016 now that the Canvas runs NoToneMapping — without the ACES
     * shoulder the old gain clipped Tyler's shipped UI to paper white.
     *
     * uGain is the per-capture exposure scalar. A gain that is right for a
     * dark-UI capture blows a high-key one: the Med Negotiate login panel is
     * already near paper white in the source PNG, so a flat 1.05 across the set
     * clipped it to a featureless rectangle. Each screenshot now carries its
     * own stop alongside its sheen seed.
     */
    color = color * uGain + 0.008;

    /*
     * Reflected set. A display in a studio is a mirror before it is a screen:
     * the bottom picks up the bench top it is standing on, the top picks up the
     * overhead softbox. Without this ramp the panel renders as a flat decal.
     */
    float roomRamp =
      mix(0.945, 1.0, smoothstep(0.0, 0.46, vUv.y)) *
      mix(1.0, 1.05, smoothstep(0.58, 1.0, vUv.y));
    color *= roomRamp;

    /*
     * Reflection streak baked straight into the display instead of a separate
     * cover plate. Two ramps, not one: a wide feathered core plus a very broad
     * low-amplitude body underneath it. A narrow high-peak band renders as a
     * hard-edged diagonal wedge — a smudge, not a reflection — because the
     * terminator is inside a couple of pixels at the hero camera distance.
     */
    /*
     * View-dependent, not painted on. The band coordinate is pushed by the
     * component of the view vector lying in the panel's own plane, so the
     * streak slides across the glass as the pointer parallax swings the camera
     * and as a device turns between views. 0.62 is tuned so a full-width
     * parallax sweep moves the highlight roughly a third of the panel — the
     * amount a real reflection travels, not a rotating gradient.
     */
    vec3 viewDir = normalize(cameraPosition - vWorld);
    vec3 panelUp = normalize(cross(vNormal, vTangent));
    float shiftX = dot(viewDir, vTangent);
    float shiftY = dot(viewDir, panelUp);
    float band = vUv.x * 0.68 + (1.0 - vUv.y) * 0.74 + uSeed
      - shiftX * 0.62 + shiftY * 0.34;
    float sheen =
      smoothstep(0.20, 0.44, band) - smoothstep(0.50, 0.78, band);
    float bloom =
      smoothstep(-0.16, 0.42, band) - smoothstep(0.46, 1.22, band);
    /*
     * Cool tint (#eef2f6): studio glass never throws a neutral-white highlight.
     * Amplitude raised from 0.085/0.03 — at the work camera the old band moved
     * the panel by under three sRGB levels, which is inside the noise of the
     * capture underneath it, so no highlight resolved at hero distance and the
     * display read as a decal. 0.15/0.055 is still well short of a blown
     * specular but it is a highlight you can actually see travel.
     */
    color += (sheen * 0.15 + bloom * 0.055) *
      vec3(0.933, 0.949, 0.965) * (1.0 - defocus * 0.6);

    /*
     * Fresnel rim. Glass viewed at a grazing angle reflects almost everything;
     * without this the edges of an angled panel sit at exactly the same value
     * as its centre, which no coated display in a lit room ever does.
     */
    float fresnel = pow(1.0 - clamp(dot(vNormal, viewDir), 0.0, 1.0), 4.0);
    color += fresnel * 0.16 * vec3(0.902, 0.925, 0.945) * (1.0 - defocus * 0.5);

    /*
     * Edge vignette. Shallower than it was: at 0.70 the border swallowed the
     * outer end of the sheen ramp, so the highlight *darkened* exactly where a
     * reflection should lift. A rolled glass border is a hint, not a frame.
     */
    vec2 inner = smoothstep(vec2(0.0), vec2(0.042), vUv) *
      smoothstep(vec2(0.0), vec2(0.042), vec2(1.0) - vUv);
    color *= mix(0.86, 1.0, inner.x * inner.y);

    /*
     * Black floor. A powered display in a lit studio has no true black in it —
     * the panel's own leakage plus the room falling on the coating put the
     * darkest pixel somewhere around 0.03-0.04 linear. Without this the dark-UI
     * captures bottomed out at the shader's 0.008 lift and read as holes cut in
     * the chassis rather than as glass with an image behind it.
     */
    color = max(color, vec3(0.035));

    vec2 point = (vUv - 0.5) * uSize;
    vec2 extent = uSize * 0.5 - uRadius;
    vec2 delta = abs(point) - extent;
    float dist =
      length(max(delta, vec2(0.0))) + min(max(delta.x, delta.y), 0.0) - uRadius;
    float mask = 1.0 - smoothstep(-0.006, 0.006, dist);

    gl_FragColor = vec4(color, mask);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

type Transform = {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
};

/**
 * Work: phones stand in machined slot fixtures, laptops sit open on the bench.
 * A shallow arc rather than a bunch — laptops on the back line, the two phones
 * pushed forward into the gaps between them, so the four read as one cluster
 * with even margins and no device touching a viewport edge. Order follows
 * featuredProjects: iCalarms, Personal Env, Med Negotiate, Charades.
 */
/*
 * The two laptops had interpenetrating chassis: rotated x half-extents of 1.37
 * and 1.32 against a 2.50 centre gap, with only 0.20 of z between them, so the
 * near lid passed *through* the far one instead of overlapping it. They now sit
 * 3.12 apart — 0.43 of clear bench between the silhouettes — and are staggered
 * 0.80 in depth so the near chassis reads as crossing in front of the far one.
 */
const PROJECT_WORK: Transform[] = [
  { position: [-0.66, 0, 0.5], rotation: [0, 0.26, 0], scale: 0.6 },
  { position: [-1.0, 0, -2.55], rotation: [0, 0.32, 0], scale: 0.68 },
  { position: [2.12, 0, -1.75], rotation: [0, -0.3, 0], scale: 0.66 },
  { position: [1.6, 0, 0.42], rotation: [0, -0.32, 0], scale: 0.58 },
];

/**
 * Profile: the badge is the whole shot. The profile camera now sits 6 units off
 * the card at fov 34, so the frame is only ~5 units wide at the subject — every
 * device is parked well outside it rather than bisected by the frame edge, the
 * way the signals treatment already handles them.
 */
const PROJECT_PROFILE: Transform[] = [
  { position: [-7.6, 0, -2.6], rotation: [0, 0.55, 0], scale: 0.55 },
  { position: [-7.5, 0, 0.4], rotation: [0, 0.72, 0], scale: 0.52 },
  { position: [7.4, 0, 0.6], rotation: [0, -0.7, 0], scale: 0.44 },
  { position: [7.6, 0, -2.4], rotation: [0, -0.55, 0], scale: 0.55 },
];

/** Signals: the devices leave frame entirely rather than clipping mid-body. */
const PROJECT_SIGNALS: Transform[] = [
  { position: [-5.9, 0, -2.4], rotation: [0, 0.5, 0], scale: 0.4 },
  { position: [-6.2, 0, 1.4], rotation: [0, 0.6, 0], scale: 0.4 },
  { position: [6.2, 0, 1.4], rotation: [0, -0.6, 0], scale: 0.4 },
  { position: [5.9, 0, -2.4], rotation: [0, -0.5, 0], scale: 0.4 },
];

const HIDDEN: Transform = {
  position: [0, -2.8, 3.5],
  rotation: [0, 0, 0],
  scale: 0.08,
};

/** Sheen offsets so the four displays never share an identical highlight. */
const SCREEN_SEEDS = [0, 0.19, -0.14, 0.33];
/**
 * Per-capture exposure, in the same order as `featuredProjects`. Tyler's four
 * screenshots are not shot at one key: iCalarms and Charades are dark-UI, but
 * the Med Negotiate login panel is a near-white sheet that clipped to paper at
 * the shared 1.05 gain and lost the whole form. Index 2 comes down a third of a
 * stop so its panel keeps its type and card edges.
 */
const SCREEN_GAINS = [1.05, 1.03, 0.9, 1.05];

/**
 * Source rectangles, in normalised image space measured from the top-left, for
 * the two screenshots that are marketing composites rather than raw captures.
 * Without these the cover-crop lands on the source's own status bar and, for
 * Charades, its own rendered device frame — a double status bar and a double
 * bezel inside the modeled one. Cropping below the status bar and inside the
 * drawn frame leaves only app content on the modeled display.
 */
type SourceRect = { x: number; y: number; w: number; h: number };

const SCREEN_CROPS: Record<string, SourceRect> = {
  /* Right-hand Settings capture, from just under its own status bar. */
  iCalarms: { x: 990 / 1600, y: 168 / 900, w: 335 / 1600, h: 670 / 900 },
  /*
   * Charades ships a landscape capture inside a drawn black device frame. A
   * portrait display can only hold a column of it, so take the deck grid —
   * app content, no chrome, and it survives the crop where the wordmark and
   * subhead would be sliced mid-word.
   *
   * The rect is aligned to whole-card boundaries on the rightmost column
   * (KIDS above ANIMALS, cards at 1267→1372 / 326→544 in source pixels) with a
   * few px of gutter, so the modeled display shows two complete deck cards
   * rather than a card sliced by the bezel and a half-occluded badge.
   */
  'Charades 2026': {
    x: 1262 / 1600,
    y: 310 / 900,
    w: 116 / 1600,
    h: 250 / 900,
  },
};

const PALETTE_COLORS: Record<string, string> = {
  paper: '#e7e1d5',
  ink: '#242424',
  rust: '#955a43',
  charcoal: '#303234',
  phosphor: '#bad28c',
  night: '#1c222b',
  'signal gold': '#c4a55f',
  dusk: '#62565b',
  brass: '#a58b5b',
  sage: '#7f907d',
  umber: '#654839',
  parchment: '#ded0ac',
  gold: '#b99953',
  'screen color': '#8ba2aa',
};

/**
 * Employer / school marks, ordered by the real company run. Aspect ratios come
 * straight from each viewBox in public/logos/manifest.json — the marks are only
 * ever scaled uniformly from these.
 */
const LOGO_SOURCES: Record<string, { file: string; aspect: number }> = {
  'Scale AI': { file: 'scale-ai.svg', aspect: 1377 / 261 },
  SafetyKit: { file: 'safetykit.svg', aspect: 178 / 40 },
  Ramp: { file: 'ramp.svg', aspect: 96 / 26 },
  Snowflake: { file: 'snowflake.svg', aspect: 184 / 44 },
  UCLA: { file: 'ucla.svg', aspect: 250 / 81.851547 },
};

/**
 * Shop marking, not an award.
 *
 * The marks used to stand on the bench as a leaning trophy placard on a milled
 * foot. Two things were wrong with that and neither was fixable by moving it:
 * a freestanding plaque is a prize, and in /#work it sat dead centre restating
 * the DOM COMPANY RUN row a hundred pixels below it. They are now five small
 * laser-marked inserts dropped flush into the bench surface — a kerf, a satin
 * insert face and the mark cut into it — camera-left of the product cluster.
 * A machinist's bench carries its supplier marks this way: in the work
 * surface, at the size the laser cut them, competing with nothing.
 *
 * Two rows of 2 / 3 rather than one row of five: at the height the marks need
 * to survive the bench's ~18° incidence, a single row is 2.6 units wide and
 * spans a third of every frame. Split, the block is 1.5 x 0.44 and sits in the
 * empty left gutter the work lens leaves.
 */
const SHOP_MARK_HEIGHT = 0.085;
const SHOP_PAD_X = 0.048;
const SHOP_PAD_Y = 0.04;
const SHOP_GAP = 0.055;
const SHOP_ROW_GAP = 0.05;
/** Width of the milled kerf showing around each insert. */
const SHOP_SEAM = 0.011;
const SHOP_PLATE_HEIGHT = SHOP_MARK_HEIGHT + SHOP_PAD_Y * 2;
/**
 * Insert stock: a light machined face a step ABOVE the bench it is set into.
 * A dropped-in plate reads as milled metal only if it out-values its host —
 * seated a step under, the same rectangle reads as a paper label stuck down.
 */
const SHOP_INSERT = '#d2d4d6';
/** The kerf the insert is dropped into — the only dark value in the assembly. */
const SHOP_KERF = '#77797b';

/** Chronological run, then the credential — split 2 / 3 so the rows balance. */
const SHOP_ROWS: string[][] = (() => {
  const companies = [...companyRun.map((entry) => entry.company), 'UCLA'];
  return [companies.slice(0, 2), companies.slice(2)];
})();

type ShopPlate = {
  company: string;
  width: number;
  x: number;
  y: number;
};

const SHOP_PLATES: ShopPlate[] = SHOP_ROWS.flatMap((row, rowIndex) => {
  const entries = row.map((company) => {
    const source = LOGO_SOURCES[company];
    const markWidth = SHOP_MARK_HEIGHT * (source ? source.aspect : 3);
    return { company, width: markWidth + SHOP_PAD_X * 2 };
  });
  const total =
    entries.reduce((sum, entry) => sum + entry.width, 0) +
    SHOP_GAP * (entries.length - 1);
  const y =
    ((SHOP_ROWS.length - 1 - rowIndex * 2) *
      (SHOP_PLATE_HEIGHT + SHOP_ROW_GAP)) /
    2;
  let cursor = -total / 2;

  return entries.map((entry) => {
    const x = cursor + entry.width / 2;
    cursor += entry.width + SHOP_GAP;
    return { company: entry.company, width: entry.width, x, y };
  });
});

/** Badge fields, label above value, straight out of the real personal notes. */
const BADGE_FIELDS = [
  { label: 'Home', value: personalNotes[0] },
  { label: 'Study', value: personalNotes[1] },
  { label: 'In rotation', value: personalNotes[3] },
];

/* -------------------------------------------------------------------------- */
/* Module-scope texture factories. Each is built at most once per page load and */
/* shared by every material that needs it — nothing re-rasterises per instance. */
/* -------------------------------------------------------------------------- */

let brushedRoughness: THREE.Texture | null = null;
let brushedRoughnessCross: THREE.Texture | null = null;
let datumGrid: THREE.Texture | null = null;
let benchFalloff: THREE.Texture | null = null;
let coveFalloff: THREE.Texture | null = null;
let contactCore: THREE.Texture | null = null;
let contactSmear: THREE.Texture | null = null;
let cardFalloff: THREE.Texture | null = null;
let coveGeometry: THREE.ExtrudeGeometry | null = null;
const logoAlphaCache = new Map<string, THREE.Texture>();
const coverCache = new Map<string, THREE.Texture>();

/** Anisotropic aluminum grain: the raking Lightformer resolves as a streak. */
function getBrushedRoughness() {
  if (brushedRoughness) {
    return brushedRoughness;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');

  if (context) {
    /*
     * Near-white base, because roughnessMap *multiplies* material.roughness —
     * a mid-grey fill would silently halve every roughness value in the file
     * and turn satin aluminum into chrome. The grain lives in the streaks.
     */
    context.fillStyle = '#f0f0f0';
    context.fillRect(0, 0, 256, 256);

    for (let line = 0; line < 400; line += 1) {
      const y = Math.floor(Math.random() * 256) + 0.5;
      const alpha = 0.02 + Math.random() * 0.04;
      context.strokeStyle =
        Math.random() > 0.5
          ? `rgba(255,255,255,${alpha * 2})`
          : `rgba(0,0,0,${alpha})`;
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(256, y);
      context.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 1);
  texture.anisotropy = 8;
  brushedRoughness = texture;
  return texture;
}

/**
 * The same grain turned 90°, for a face whose machining runs the other way.
 *
 * Grain direction is not decoration: on a real unibody the palmrest is brushed
 * across the deck and the lid back is brushed front-to-back, and the two catch
 * the raking slit at different points because of it. Sharing one texture
 * orientation across every aluminum face in the file is what let two large
 * plates a hand's width apart return an identical streak.
 */
function getBrushedRoughnessCross() {
  if (brushedRoughnessCross) {
    return brushedRoughnessCross;
  }

  const texture = getBrushedRoughness().clone();
  texture.center.set(0.5, 0.5);
  texture.rotation = Math.PI / 2;
  texture.repeat.set(1, 3);
  texture.needsUpdate = true;
  brushedRoughnessCross = texture;
  return texture;
}

/** Etched machinist datum crosshatch for the blank that is being measured. */
function getDatumGrid() {
  if (datumGrid) {
    return datumGrid;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');

  if (context) {
    context.strokeStyle = '#ffffff';
    context.lineWidth = 1;

    for (let step = -256; step <= 256; step += 16) {
      context.beginPath();
      context.moveTo(step, 0);
      context.lineTo(step + 256, 256);
      context.stroke();
      context.beginPath();
      context.moveTo(step, 256);
      context.lineTo(step + 256, 0);
      context.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 4);
  datumGrid = texture;
  return texture;
}

/**
 * The key pool, painted.
 *
 * A drei `Environment` bakes one cubemap and samples it by normal alone, so
 * every point on a 32x15 bench with the same up-normal receives *identical*
 * irradiance no matter how the Lightformers are sized or placed — resizing the
 * softbox cannot make the set fall off, which is why the bench rendered as one
 * uniform field from frame edge to frame edge with no light shape at all.
 *
 * So the falloff is painted in world space instead: an elliptical pool centred
 * on the subject cluster, full value under the devices and roughly a stop down
 * by the frame edges. The map is sRGB and its peak is white, so BENCH_TOP is
 * the brightest the surface can ever get.
 */
/*
 * Sized to the frame, not to the bench. The work camera sees only ~6.9 world
 * units of bench width, so the old 4.5/5.2 sigmas over a 0.75 floor fell from
 * 1.00 to 0.89 edge to edge — a 3% luminance drop that no viewer can see. At
 * 2.9/3.7 over a 0.56 floor the same span runs 1.00 → 0.70, a ~30% linear drop
 * from pool centre to frame edge, which is a lit set rather than a flat field.
 */
const BENCH_POOL_X = 0.5;
const BENCH_POOL_Z = -0.9;
const BENCH_POOL_SIGMA_X = 2.9;
const BENCH_POOL_SIGMA_Z = 3.7;
/** Deepest the pool goes, as a fraction of peak, out at the far corners. */
const BENCH_POOL_FLOOR = 0.62;
/**
 * A second, much wider and much shallower falloff laid under the key pool.
 *
 * The key pool is sized to the subject cluster, so at four units out it has
 * already bottomed out at its floor and the whole rest of the bench renders as
 * one flat plateau — which is how an empty patch of foreground at CSS
 * x1100/y700 ended up the brightest thing in the profile frame. This term keeps
 * falling long after the pool has: 14% over ~9 units, far too gradual to read
 * as a vignette, but enough that the frame edges never out-value the subject.
 */
const BENCH_EDGE_SIGMA_X = 8.5;
const BENCH_EDGE_SIGMA_Z = 7;
const BENCH_EDGE_DEPTH = 0.14;

function getBenchFalloff() {
  if (benchFalloff) {
    return benchFalloff;
  }

  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');

  if (context) {
    const image = context.createImageData(size, size);

    for (let py = 0; py < size; py += 1) {
      /* flipY is on: canvas row 255 is v = 0, the bench's front lip. */
      const v = 1 - (py + 0.5) / size;
      const worldZ = BENCH_FRONT_Z - v * BENCH_DEPTH;
      const dz = (worldZ - BENCH_POOL_Z) / BENCH_POOL_SIGMA_Z;
      const ez = (worldZ - BENCH_POOL_Z) / BENCH_EDGE_SIGMA_Z;

      for (let px = 0; px < size; px += 1) {
        const u = (px + 0.5) / size;
        const worldX = -BENCH_WIDTH / 2 + u * BENCH_WIDTH;
        const dx = (worldX - BENCH_POOL_X) / BENCH_POOL_SIGMA_X;
        const ex = (worldX - BENCH_POOL_X) / BENCH_EDGE_SIGMA_X;
        const pool = Math.exp(-(dx * dx + dz * dz));
        /*
         * Encoded, not applied raw. This canvas is consumed as an sRGB map, so
         * scaling the byte by 0.86 is a ~27% cut in linear reflectance rather
         * than the 14% asked for — enough to drop the far bench a full step
         * under the cove and cut a hard horizon line across every frame. The
         * gamma puts the falloff where it was meant to land.
         */
        const edge = Math.pow(
          1 - BENCH_EDGE_DEPTH * (1 - Math.exp(-(ex * ex + ez * ez))),
          1 / 2.2,
        );
        const value = Math.round(
          255 * (BENCH_POOL_FLOOR + (1 - BENCH_POOL_FLOOR) * pool) * edge,
        );
        const index = (py * size + px) * 4;
        image.data[index] = value;
        image.data[index + 1] = value;
        image.data[index + 2] = value;
        image.data[index + 3] = 255;
      }
    }

    context.putImageData(image, 0, 0);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  benchFalloff = texture;
  return texture;
}

/**
 * Cove falloff — the luminance gradient that stops the top third of every
 * frame reading as blank paper. Bright where the sweep meets the bench,
 * shading off into the unlit upper wall.
 */
function getCoveFalloff() {
  if (coveFalloff) {
    return coveFalloff;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 256;
  const context = canvas.getContext('2d');

  if (context) {
    /*
     * Canvas y=0 is uv v=1 — the top of the wall. The ramp is deliberately
     * front-loaded: the work camera sits at y 2.35 and only sees the wall up to
     * about y 3 of 16, so the drop has to happen inside the bottom fifth or
     * that view alone renders against a flat backdrop while the higher
     * profile/history lenses show the falloff. One studio, four lenses.
     */
    const gradient = context.createLinearGradient(0, 0, 0, 256);
    gradient.addColorStop(0, '#3a3d40');
    gradient.addColorStop(0.5, '#636669');
    gradient.addColorStop(0.78, '#7c7f82');
    gradient.addColorStop(0.9, '#8a8d8f');
    gradient.addColorStop(0.97, '#8d8f91');
    /*
     * The junction value is not a free choice: it has to land on the value the
     * bench top renders at its far edge under the same fog, or the horizon
     * shows as a hard step across the whole frame instead of the seamless cyc
     * sweep the cove geometry exists to provide. With the key pool retuned the
     * bench's far edge now renders a value step darker than BENCH_TOP, so the
     * junction stop came down with it — and again with the ~14% the bench top
     * lost to put the subject back on top of the value range.
     */
    gradient.addColorStop(1, '#a4a6a8');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 4, 256);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  coveFalloff = texture;
  return texture;
}

/**
 * Occlusion falloffs, drawn WHITE on transparent and consumed as `alphaMap`,
 * never as `map`. A canvas texture's own alpha channel does not survive the
 * `map` + `transparent` path in this build — the previous dark-gradient-as-map
 * version composited to nothing, which is the entire reason the set had no
 * contact darkening and every object appeared to hover.
 *
 * Two ramps, because one cannot do both jobs: a wide ambient smear the whole
 * body sits in, and a tight near-black core right at the feet.
 */
/**
 * Rounded-rect occlusion ramp, written per texel rather than with a canvas
 * blur: `ctx.filter` is not dependable across engines, and a radial gradient
 * reads as a sticker oval under a rectangular object. This is a signed-distance
 * rounded rectangle with a soft outward falloff, so a laptop base and a stand
 * foot both get a shadow the shape of the thing casting it.
 *
 * White on transparent — consumed as `alphaMap`, never as `map`. A canvas
 * texture's own alpha does not survive the `map` + `transparent` path in this
 * build; the previous dark-gradient-as-map version composited to nothing, which
 * is why the whole set appeared to hover.
 */
function buildFalloff(
  inset: number,
  feather: number,
  peak: number,
  radius: number,
) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');

  if (context) {
    const image = context.createImageData(size, size);
    const half = size / 2 - inset;
    const extent = Math.max(0, half - radius);

    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const dx = Math.abs(x + 0.5 - size / 2) - extent;
        const dy = Math.abs(y + 0.5 - size / 2) - extent;
        const outside = Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
        const inside = Math.min(Math.max(dx, dy), 0);
        const distance = outside + inside - radius;
        const t = Math.min(1, Math.max(0, 1 - distance / feather));
        const index = (y * size + x) * 4;
        image.data[index] = 255;
        image.data[index + 1] = 255;
        image.data[index + 2] = 255;
        image.data[index + 3] = Math.round(255 * peak * t * t * (3 - 2 * t));
      }
    }

    context.putImageData(image, 0, 0);
  }

  const texture = new THREE.CanvasTexture(canvas);
  /*
   * No mipmaps: these planes are viewed at a hard grazing angle and the lower
   * mips average the soft tail into a hard scalloped ring around the object.
   */
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

function getContactCore() {
  if (!contactCore) {
    contactCore = buildFalloff(92, 36, 0.9, 20);
  }

  return contactCore;
}

function getContactSmear() {
  if (!contactSmear) {
    contactSmear = buildFalloff(100, 88, 0.28, 20);
  }

  return contactSmear;
}

/**
 * Card falloff — the vertical luminance gradient a physical card standing in a
 * top-lit studio has and a flat-shaded plane does not.
 *
 * The profile badge fills nearly half the frame height, and at BADGE_LEAN the
 * card face is within 14° of the key's own falloff plane, so the whole 4-unit
 * sheet returned one value top to bottom: a white DOM rectangle standing in the
 * scene. This is drawn WHITE-on-transparent and consumed as `alphaMap` on a
 * shading pass laid over the card face — same reason as the contact ramps, a
 * canvas texture's own alpha does not survive the `map` + `transparent` path
 * here. Zero at the top edge, full at the stand, for a ~15% drop.
 *
 * The ramp is written into the RGB channels of an OPAQUE canvas, not into the
 * alpha channel: `alphaMap` samples green, and a gradient painted with rgba()
 * stops round-trips back through the canvas' premultiplied backing store as a
 * flat 255 green — which renders as a uniform veil over the entire card rather
 * than a falloff. Black-to-white opaque is unambiguous.
 */
function getCardFalloff() {
  if (cardFalloff) {
    return cardFalloff;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 256;
  const context = canvas.getContext('2d');

  if (context) {
    /* flipY is on: canvas row 0 is v = 1, the top edge of the card. */
    const gradient = context.createLinearGradient(0, 0, 0, 256);
    gradient.addColorStop(0, '#000000');
    gradient.addColorStop(0.42, '#434343');
    gradient.addColorStop(0.82, '#c7c7c7');
    gradient.addColorStop(1, '#ffffff');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 4, 256);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  cardFalloff = texture;
  return texture;
}

/**
 * The studio cove: bench top sweeps up into the back wall on a 4-unit radius
 * so the horizon dissolves instead of terminating as a lit plateau lip. UVs are
 * rewritten off local height, because ExtrudeGeometry's side-wall UV generator
 * emits raw world units that no gradient can be mapped onto.
 */
function getCoveGeometry() {
  if (coveGeometry) {
    return coveGeometry;
  }

  const shape = new THREE.Shape();
  shape.moveTo(0, -2);
  shape.lineTo(COVE_BACK, -2);
  shape.lineTo(COVE_BACK, COVE_HEIGHT);
  shape.lineTo(COVE_RADIUS, COVE_HEIGHT);
  shape.lineTo(COVE_RADIUS, COVE_RADIUS);
  shape.absarc(0, COVE_RADIUS, COVE_RADIUS, 0, -Math.PI / 2, true);
  shape.lineTo(0, -2);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: false,
    curveSegments: 18,
    depth: COVE_WIDTH,
    steps: 1,
  });

  const position = geometry.attributes.position;
  const uv = new Float32Array(position.count * 2);

  for (let index = 0; index < position.count; index += 1) {
    uv[index * 2] = position.getZ(index) / COVE_WIDTH;
    uv[index * 2 + 1] = Math.min(
      1,
      Math.max(0, position.getY(index) / COVE_HEIGHT),
    );
  }

  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  coveGeometry = geometry;
  return geometry;
}

/**
 * Rasterises an SVG mark to a white-on-transparent alpha mask. White is the
 * *mask*, not the colour — the ink comes from the material, so the marks are
 * always monochrome no matter what the brand file contains.
 */
function getLogoAlpha(file: string, aspect: number) {
  const cached = logoAlphaCache.get(file);

  if (cached) {
    return cached;
  }

  const width = 512;
  const height = Math.max(2, Math.round(512 / aspect));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 8;
  const context = canvas.getContext('2d');

  if (context) {
    const image = new Image();
    image.onload = () => {
      /*
       * Letterboxed at a single uniform scale off the intrinsic size, so a file
       * whose width/height attributes disagree with its viewBox can never
       * stretch the mark.
       */
      const fit = Math.min(
        width / image.naturalWidth,
        height / image.naturalHeight,
      );
      const drawWidth = image.naturalWidth * fit;
      const drawHeight = image.naturalHeight * fit;
      context.clearRect(0, 0, width, height);
      context.drawImage(
        image,
        (width - drawWidth) / 2,
        (height - drawHeight) / 2,
        drawWidth,
        drawHeight,
      );
      context.globalCompositeOperation = 'source-in';
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, width, height);
      context.globalCompositeOperation = 'source-over';
      texture.needsUpdate = true;
    };
    image.src = `/logos/${file}`;
  }

  logoAlphaCache.set(file, texture);
  return texture;
}

const bezelRingCache = new Map<string, THREE.ExtrudeGeometry>();

function roundedRectShape(width: number, height: number, radius: number) {
  const shape = new THREE.Shape();
  const x = width / 2;
  const y = height / 2;
  const r = Math.min(radius, x, y);

  shape.moveTo(-x + r, -y);
  shape.lineTo(x - r, -y);
  shape.quadraticCurveTo(x, -y, x, -y + r);
  shape.lineTo(x, y - r);
  shape.quadraticCurveTo(x, y, x - r, y);
  shape.lineTo(-x + r, y);
  shape.quadraticCurveTo(-x, y, -x, y - r);
  shape.lineTo(-x, -y + r);
  shape.quadraticCurveTo(-x, -y, -x + r, -y);
  shape.closePath();

  return shape;
}

/**
 * The raised bezel land, as an actual ring with a hole in it. A solid plate
 * cannot do this job: anything proud enough to cast the hairline self-shadow
 * onto a recessed display would also cover the display. Cached per size, so the
 * two phones share one geometry and the two laptops share another. The same
 * factory supplies the bright chamfer rings around each body perimeter.
 */
function getBezelRing(
  outerWidth: number,
  outerHeight: number,
  innerWidth: number,
  innerHeight: number,
  outerRadius: number,
  innerRadius: number,
  depth: number,
) {
  const key = [
    outerWidth,
    outerHeight,
    innerWidth,
    innerHeight,
    outerRadius,
    innerRadius,
    depth,
  ].join(':');
  const cached = bezelRingCache.get(key);

  if (cached) {
    return cached;
  }

  const shape = roundedRectShape(outerWidth, outerHeight, outerRadius);
  shape.holes.push(roundedRectShape(innerWidth, innerHeight, innerRadius));

  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: false,
    curveSegments: 6,
    depth,
  });
  bezelRingCache.set(key, geometry);
  return geometry;
}

/**
 * Cover-crops a texture into a target aspect via repeat/offset, cached so a
 * remount never clones the same bitmap twice. An optional source rectangle
 * (normalised, measured from the image's top-left the way a crop tool reads)
 * restricts the cover to a sub-region first — that is the path the phone
 * screenshots take to drop their own status bar and drawn device frame.
 */
function coverTexture(
  texture: THREE.Texture,
  targetAspect: number,
  rect?: SourceRect,
) {
  const region = rect ?? { x: 0, y: 0, w: 1, h: 1 };
  const key = [
    texture.uuid,
    targetAspect.toFixed(4),
    region.x.toFixed(4),
    region.y.toFixed(4),
    region.w.toFixed(4),
    region.h.toFixed(4),
  ].join(':');
  const cached = coverCache.get(key);

  if (cached) {
    return cached;
  }

  const clone = texture.clone();
  const image = texture.image as { width?: number; height?: number } | null;
  const sourceAspect =
    ((image?.width ?? 3) * region.w) / ((image?.height ?? 2) * region.h);

  clone.wrapS = THREE.ClampToEdgeWrapping;
  clone.wrapT = THREE.ClampToEdgeWrapping;
  clone.repeat.set(region.w, region.h);
  /* flipY is on, so image-space y from the top becomes 1 - (y + h) in v. */
  clone.offset.set(region.x, 1 - (region.y + region.h));

  if (sourceAspect > targetAspect) {
    const next = region.w * (targetAspect / sourceAspect);
    clone.offset.x += (region.w - next) / 2;
    clone.repeat.x = next;
  } else {
    const next = region.h * (sourceAspect / targetAspect);
    clone.offset.y += (region.h - next) / 2;
    clone.repeat.y = next;
  }

  clone.needsUpdate = true;
  coverCache.set(key, clone);
  return clone;
}

function useConfiguredTextures(paths: string[]) {
  const textures = useTexture(paths);

  return useMemo(
    () =>
      textures.map((texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = 8;
        return texture;
      }),
    [textures],
  );
}

function createTextTexture(
  lines: string[],
  options?: { background?: string; color?: string; size?: number },
) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const context = canvas.getContext('2d');

  if (!context) {
    return new THREE.CanvasTexture(canvas);
  }

  if (options?.background) {
    context.fillStyle = options.background;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }

  context.fillStyle = options?.color ?? INK;
  context.font = `500 ${options?.size ?? 40}px Helvetica Neue, Arial, sans-serif`;
  context.textBaseline = 'middle';

  lines.forEach((line, index) => {
    const rowHeight = canvas.height / lines.length;
    context.fillText(line, 32, rowHeight * (index + 0.5), canvas.width - 64);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

type SpacedContext = CanvasRenderingContext2D & { letterSpacing?: string };

function wrapLines(
  context: CanvasRenderingContext2D,
  value: string,
  maxWidth: number,
) {
  const words = value.split(' ');
  const lines: string[] = [];
  let current = '';

  words.forEach((word) => {
    const candidate = current ? `${current} ${word}` : word;

    if (context.measureText(candidate).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  });

  if (current) {
    lines.push(current);
  }

  return lines.slice(0, 2);
}

/**
 * The badge field block: letterspaced uppercase micro-label above each value,
 * matching the DOM convention. 2048px wide so the type stays crisp at the
 * profile camera distance.
 */
function createFieldTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 1024;
  const context = canvas.getContext('2d') as SpacedContext | null;

  if (!context) {
    return new THREE.CanvasTexture(canvas);
  }

  let cursor = 78;

  BADGE_FIELDS.forEach((field) => {
    context.letterSpacing = '11px';
    context.fillStyle = 'rgba(20,21,23,0.55)';
    context.font = '600 44px Helvetica Neue, Arial, sans-serif';
    context.textBaseline = 'alphabetic';
    context.fillText(field.label.toUpperCase(), 60, cursor);

    context.letterSpacing = '0px';
    context.fillStyle = 'rgba(20,21,23,0.9)';
    context.font = '500 74px Helvetica Neue, Arial, sans-serif';
    const lines = wrapLines(context, field.value, 1900);
    lines.forEach((line, lineIndex) => {
      context.fillText(line, 60, cursor + 88 + lineIndex * 82);
    });

    cursor += 96 + lines.length * 82 + 34;

    context.fillStyle = 'rgba(20,21,23,0.16)';
    context.fillRect(60, cursor - 44, 1928, 2);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function createNameTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const context = canvas.getContext('2d') as SpacedContext | null;

  if (!context) {
    return new THREE.CanvasTexture(canvas);
  }

  context.letterSpacing = '9px';
  context.fillStyle = 'rgba(20,21,23,0.55)';
  context.font = '600 40px Helvetica Neue, Arial, sans-serif';
  context.fillText('NAME', 12, 62);

  context.letterSpacing = '-1px';
  context.fillStyle = 'rgba(20,21,23,0.92)';
  context.font = '600 104px Helvetica Neue, Arial, sans-serif';
  context.fillText('Tyler Xiao', 8, 176);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/**
 * The alpha mask milled into an experiment blank's data pocket: the status as a
 * letterspaced micro-label over the experiment title. White is the mask, not
 * the colour — EngravedDecal supplies the groove and lip out of the host metal,
 * so this can never read as a printed sticker.
 */
function createExperimentPlateTexture(status: string, title: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 710;
  const context = canvas.getContext('2d') as SpacedContext | null;

  if (!context) {
    return new THREE.CanvasTexture(canvas);
  }

  context.fillStyle = '#ffffff';
  context.textBaseline = 'alphabetic';

  context.letterSpacing = '13px';
  context.font = '600 46px Helvetica Neue, Arial, sans-serif';
  context.fillText(status.toUpperCase(), 40, 78);
  context.fillRect(40, 116, 944, 3);

  context.letterSpacing = '-1px';
  context.font = '500 82px Helvetica Neue, Arial, sans-serif';
  const words = title.split(' ');
  const lines: string[] = [];
  let current = '';

  words.forEach((word) => {
    const candidate = current ? `${current} ${word}` : word;

    if (context.measureText(candidate).width > 944 && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  });

  if (current) {
    lines.push(current);
  }

  lines.slice(0, 5).forEach((line, index) => {
    context.fillText(line, 40, 218 + index * 96);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 8;
  return texture;
}

function createPaletteTexture(palette: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 640;
  const context = canvas.getContext('2d');
  const names = palette.split('/').map((name) => name.trim().toLowerCase());

  if (context) {
    const band = canvas.height / names.length;
    names.forEach((name, index) => {
      const color = PALETTE_COLORS[name];

      if (!color) {
        throw new Error(`Bench palette token is not mapped: ${name}`);
      }

      context.fillStyle = color;
      context.fillRect(0, index * band, canvas.width, band + 1);
    });
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/* -------------------------------------------------------------------------- */
/* Shared materials                                                            */
/* -------------------------------------------------------------------------- */

function AluminumMaterial({
  color = ALUMINUM,
  envMapIntensity = 1.4,
  grain = 'lateral',
  metalness = 1,
  roughness = 0.2,
}: {
  color?: string;
  envMapIntensity?: number;
  /** Which way the brushing runs across the face: across it, or along it. */
  grain?: 'lateral' | 'axial';
  /**
   * Full metal by default. Anything below 1 is a deliberate cheat for a part
   * whose visible faces are near-vertical: pure metal has no diffuse term, so
   * a vertical wall can only ever return whatever the cubemap holds in the
   * front hemisphere — which in this studio is a dark room. Letting a little
   * diffuse through is what keeps the history stands out of the black.
   */
  metalness?: number;
  roughness?: number;
}) {
  const map = useMemo(
    () =>
      grain === 'axial' ? getBrushedRoughnessCross() : getBrushedRoughness(),
    [grain],
  );

  return (
    <meshStandardMaterial
      color={color}
      envMapIntensity={envMapIntensity}
      metalness={metalness}
      roughness={roughness}
      roughnessMap={map}
    />
  );
}

/**
 * The diamond-cut chamfer every machined body needs and none of them had. A
 * second RoundedBox 0.004 proud in x/y and 0.004 shy in z: the centre is buried
 * inside the body, so all that survives is a 0.002 band standing off the
 * perimeter in near-mirror aluminum. That band is the only thing in the scene
 * narrow enough to resolve the raking specular Lightformer as an actual edge
 * highlight rather than a broad sheen.
 *
 * Only for bodies whose thin axis faces away from the bench — a phone rail, a
 * lid edge, the lip of a plate. On a slab lying thin-axis-up the band would
 * replace the entire side wall with mirror metal and put a bright halo exactly
 * where the object meets the bench, which is the opposite of grounding it.
 */
function ChamferBand({
  args,
  color = ALUMINUM,
  radius,
  smoothness = 4,
  position = [0, 0, 0],
}: {
  args: [number, number, number];
  color?: string;
  radius: number;
  smoothness?: number;
  position?: [number, number, number];
}) {
  return (
    <RoundedBox
      args={[args[0] + 0.004, args[1] + 0.004, args[2] - 0.004]}
      position={position}
      radius={radius}
      smoothness={smoothness}
    >
      <AluminumMaterial color={color} envMapIntensity={2.2} roughness={0.06} />
    </RoundedBox>
  );
}

function InkMetalMaterial({ roughness = 0.3 }: { roughness?: number }) {
  return (
    <meshStandardMaterial
      color={PHONE_INK}
      envMapIntensity={1.1}
      metalness={1}
      roughness={roughness}
    />
  );
}

/**
 * Ground-plane direction of the key. The key sits at [-6.5, 7, 3.2] aimed at
 * the origin, so every soft shadow body in the set has to travel toward +x and
 * -z; a symmetric pool centred under the object is the tell that the contact
 * pass and the directional pass disagree about where the light is. The smear
 * rides this vector by roughly the object's own standoff height, since the key
 * is at ~44° of elevation.
 */
const KEY_DRIFT_X = 0.897;
const KEY_DRIFT_Z = -0.442;

/**
 * The ground pass that travels with each object: a wide ambient smear at ~1.25x
 * the host footprint, drifted along the key, and inside it a tight core at
 * ~0.7x that puts a narrow darkening right where the feet, stand base or card
 * edge meet the bench. Nothing in the set may meet the bench with a lighter
 * halo than the bench itself, and this is what enforces that.
 *
 * Values are deliberately grey, not black. On a #d4d6d8 bench a black-cored
 * pool reads as a decal stuck to the surface no matter how soft its edge is,
 * and stacked against the single ContactShadows pass the old 0.75/0.5 pair on
 * near-black put the combined ground alpha over 0.55 — the near-black ellipse
 * under the profile badge stand.
 */
function ContactCore({
  width,
  depth,
  y = 0.0075,
  x = 0,
  z = 0,
  opacity = 1,
}: {
  width: number;
  depth: number;
  y?: number;
  x?: number;
  z?: number;
  opacity?: number;
}) {
  const smear = useMemo(() => getContactSmear(), []);
  const core = useMemo(() => getContactCore(), []);
  /* Drift scales with the footprint, which stands in for the object's height. */
  const drift = Math.min(0.22, width * 0.055);

  return (
    <group name="contact-core" position={[x, y, z]}>
      <mesh
        position={[drift * KEY_DRIFT_X, 0, drift * KEY_DRIFT_Z]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[width, depth]} />
        <meshBasicMaterial
          alphaMap={smear}
          color="#4c4f52"
          depthWrite={false}
          opacity={0.52 * opacity}
          toneMapped={false}
          transparent
        />
      </mesh>
      <mesh position={[0, 0.0012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width * 0.75, depth * 0.75]} />
        <meshBasicMaterial
          alphaMap={core}
          color="#3a3d40"
          depthWrite={false}
          opacity={0.3 * opacity}
          toneMapped={false}
          transparent
        />
      </mesh>
    </group>
  );
}

function Screen({
  texture,
  width,
  height,
  radius,
  position,
  seed,
  gain = 1.05,
  crop,
  materialRef,
}: {
  texture: THREE.Texture;
  width: number;
  height: number;
  radius: number;
  position: [number, number, number];
  seed: number;
  gain?: number;
  crop?: SourceRect;
  materialRef?: (node: THREE.ShaderMaterial | null) => void;
}) {
  const cropped = useMemo(
    () => coverTexture(texture, width / height, crop),
    [texture, width, height, crop],
  );
  const uniforms = useMemo(
    () => ({
      uTexture: { value: cropped },
      uTexel: { value: new THREE.Vector2(1 / 1600, 1 / 900) },
      uRepeat: { value: new THREE.Vector2(cropped.repeat.x, cropped.repeat.y) },
      uOffset: { value: new THREE.Vector2(cropped.offset.x, cropped.offset.y) },
      uSize: { value: new THREE.Vector2(width, height) },
      uBlur: { value: 0 },
      uRadius: { value: radius },
      uSeed: { value: seed },
      uGain: { value: gain },
    }),
    [cropped, width, height, radius, seed, gain],
  );

  return (
    <mesh position={position}>
      <planeGeometry args={[width, height]} />
      <shaderMaterial
        fragmentShader={SCREEN_FRAGMENT_SHADER}
        ref={materialRef}
        transparent
        uniforms={uniforms}
        vertexShader={SCREEN_VERTEX_SHADER}
      />
    </mesh>
  );
}

/**
 * The cover glass, as a real surface standing over the panel rather than a term
 * inside the screen shader.
 *
 * The shader's sheen and Fresnel travel with the *image*, which means they
 * cannot do the one thing cover glass does: sit at a different depth from the
 * pixels and reflect the room independently of them. This is a single plane
 * 0.004 proud of the display in near-mirror dielectric — metalness 0 because
 * glass is not metal, opacity 0.15 because it is a coating and not a mirror,
 * depthWrite off so it never sorts in front of the transparent panel under it.
 *
 * The groove ring is the other half: a 0.006 inset dark channel where the glass
 * meets the chassis. Every laminated display has that shadow line, and its
 * absence is what made the bezel land and the panel read as one printed sheet.
 */
function GlassCover({
  width,
  height,
  radius,
  position,
}: {
  width: number;
  height: number;
  radius: number;
  position: [number, number, number];
}) {
  const groove = useMemo(
    () =>
      getBezelRing(
        width,
        height,
        width - 0.012,
        height - 0.012,
        radius,
        Math.max(0.002, radius - 0.006),
        0.0012,
      ),
    [width, height, radius],
  );

  return (
    <group position={position}>
      <mesh geometry={groove} position={[0, 0, -0.0006]}>
        <meshStandardMaterial
          color="#0a0b0c"
          envMapIntensity={0.35}
          metalness={0.2}
          roughness={0.55}
        />
      </mesh>
      <mesh>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial
          depthWrite={false}
          envMapIntensity={1.7}
          metalness={0}
          opacity={0.15}
          roughness={0.05}
          transparent
        />
      </mesh>
    </group>
  );
}

/**
 * Groove geometry, shared by every milled mark in the scene. The offset between
 * the two passes is the apparent channel width; the darker the floor and the
 * brighter the lower lip, the deeper the cut reads. Held wide enough that the
 * rail marks survive being 0.085 tall at a 1440px frame.
 */
const ENGRAVE_OFFSET = 0.0026;
const ENGRAVE_FLOOR = 0.6;
const ENGRAVE_LIP = 0.34;

/**
 * A milled groove, not a sticker. Two passes: the shadowed wall of the channel
 * in a darkened host colour, and a lighter pass below-right standing in for the
 * lit lower lip. Both passes carry the host material's own metalness/roughness
 * so the mark takes the same environment reflection as the surface it is cut
 * into. The mask is always monochrome — the ink comes from the host metal, so
 * a brand file's own colours can never leak into the set.
 */
function EngravedDecal({
  alpha,
  width,
  height,
  position,
  rotation,
  hostColor = ALUMINUM,
  metalness = 1,
  roughness = 0.32,
  envMapIntensity = 1.4,
  offset = ENGRAVE_OFFSET,
  floor = ENGRAVE_FLOOR,
  lipMix = ENGRAVE_LIP,
  opacity = 1,
}: {
  alpha: THREE.Texture;
  width: number;
  height: number;
  position: [number, number, number];
  rotation?: [number, number, number];
  hostColor?: string;
  metalness?: number;
  roughness?: number;
  envMapIntensity?: number;
  offset?: number;
  floor?: number;
  lipMix?: number;
  opacity?: number;
}) {
  const [cut, lip] = useMemo(() => {
    const base = new THREE.Color(hostColor);
    return [
      base.clone().multiplyScalar(floor),
      base.clone().lerp(new THREE.Color('#ffffff'), lipMix),
    ];
  }, [floor, hostColor, lipMix]);

  return (
    <group position={position} rotation={rotation}>
      {/* Lit lower lip of the groove, offset down and right of the channel. */}
      <mesh position={[offset, -offset, 0]} renderOrder={1}>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial
          alphaMap={alpha}
          color={lip}
          depthWrite={false}
          envMapIntensity={envMapIntensity}
          metalness={metalness}
          opacity={opacity}
          roughness={roughness}
          transparent
        />
      </mesh>
      {/*
       * Shadowed channel wall. renderOrder is explicit: both passes are
       * transparent and 0.0006 apart, which is inside the depth-sort's noise
       * floor — left to sort themselves the lip lands on top and the mark
       * embosses outward instead of cutting in.
       */}
      <mesh position={[0, 0, 0.0006]} renderOrder={2}>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial
          alphaMap={alpha}
          color={cut}
          depthWrite={false}
          envMapIntensity={envMapIntensity}
          metalness={metalness}
          opacity={opacity}
          roughness={roughness}
          transparent
        />
      </mesh>
    </group>
  );
}

/** An employer / school mark, cut with the same groove treatment. */
function EtchedMark({
  company,
  height,
  position,
  rotation,
  hostColor = ALUMINUM,
  metalness = 1,
  roughness = 0.32,
  envMapIntensity = 1.4,
  offset,
  floor,
  lipMix,
}: {
  company: string;
  height: number;
  position: [number, number, number];
  rotation?: [number, number, number];
  hostColor?: string;
  metalness?: number;
  roughness?: number;
  envMapIntensity?: number;
  offset?: number;
  floor?: number;
  lipMix?: number;
}) {
  const source = LOGO_SOURCES[company];
  const alpha = useMemo(
    () => (source ? getLogoAlpha(source.file, source.aspect) : null),
    [source],
  );
  const fallback = useMemo(
    () => (source ? null : createTextTexture([company], { size: 72 })),
    [company, source],
  );

  if (!source || !alpha) {
    return (
      <mesh position={position} rotation={rotation}>
        <planeGeometry args={[height * 3, height]} />
        <meshStandardMaterial
          envMapIntensity={envMapIntensity}
          map={fallback}
          metalness={metalness}
          roughness={roughness}
          transparent
        />
      </mesh>
    );
  }

  return (
    <EngravedDecal
      alpha={alpha}
      envMapIntensity={envMapIntensity}
      floor={floor}
      height={height}
      hostColor={hostColor}
      lipMix={lipMix}
      metalness={metalness}
      offset={offset}
      position={position}
      rotation={rotation}
      roughness={roughness}
      width={height * source.aspect}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Set                                                                          */
/* -------------------------------------------------------------------------- */

function StudioCove() {
  const geometry = useMemo(() => getCoveGeometry(), []);
  const falloff = useMemo(() => getCoveFalloff(), []);

  return (
    <mesh
      geometry={geometry}
      position={[-COVE_WIDTH / 2, 0, BENCH_BACK_Z + 0.3]}
      rotation={[0, Math.PI / 2, 0]}
    >
      <meshStandardMaterial
        color={COVE_GREY}
        map={falloff}
        metalness={0}
        roughness={0.98}
      />
    </mesh>
  );
}

function BenchTop() {
  const falloff = useMemo(() => getBenchFalloff(), []);

  return (
    <group>
      <mesh position={[0, -0.42, BENCH_CENTER_Z]}>
        <boxGeometry args={[56, 0.4, 30]} />
        <meshStandardMaterial color={BENCH_FLOOR} roughness={0.95} />
      </mesh>

      {/*
       * No castShadow on the slab: its own top face sits 0.0006 under the
       * graded surface plane, and at shadow-map precision that reads as a
       * coplanar occluder — the whole bench falls into its own shadow.
       */}
      <mesh position={[0, -BENCH_THICKNESS / 2, BENCH_CENTER_Z]}>
        <boxGeometry args={[BENCH_WIDTH, BENCH_THICKNESS, BENCH_DEPTH]} />
        <meshStandardMaterial color={BENCH_TOP} roughness={0.68} />
      </mesh>

      {/* Graded working surface: full value at the lip, falling off to the cove. */}
      <mesh
        position={[0, 0.0006, BENCH_CENTER_Z]}
        receiveShadow
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[BENCH_WIDTH, BENCH_DEPTH]} />
        <meshStandardMaterial
          color={BENCH_TOP}
          map={falloff}
          metalness={0}
          roughness={0.68}
        />
      </mesh>

      {/* One hairline seam running the length of the top. */}
      <mesh position={[0, 0.0016, BENCH_SEAM_Z]}>
        <boxGeometry args={[BENCH_WIDTH, 0.002, 0.016]} />
        <meshStandardMaterial color="#a9abad" roughness={0.6} />
      </mesh>

      {/* Chamfered front rail. Bare — the shop marks live on the nameplate. */}
      <group
        position={[0, -0.055, BENCH_FRONT_Z + 0.03]}
        rotation={[-0.62, 0, 0]}
      >
        <mesh castShadow receiveShadow>
          <boxGeometry args={[BENCH_WIDTH, 0.26, 0.5]} />
          <meshStandardMaterial color={BENCH_RAIL} roughness={0.74} />
        </mesh>
      </group>
    </group>
  );
}

/**
 * Per-view seats, damped like every other subject in the set.
 *
 * The marks lie IN the bench now, so a seat is a patch of empty work surface
 * rather than somewhere a prop can stand: rotation is the bench normal in every
 * view and only the patch and its apparent size change. Scale rises with camera
 * distance so the laser marking holds one size on screen across four lenses.
 *
 * `SHOP_FLUSH_Y` clears the ContactShadows catch plane at y 0.005; below it the
 * insert faces z-fight with the shadow buffer.
 */
const SHOP_FLUSH_Y = 0.0075;
const SHOP_FLAT: [number, number, number] = [-Math.PI / 2, 0, 0];

/**
 * Parked pose for the marks. Distinct from HIDDEN only in that it keeps the
 * bench-normal rotation: damping from a face-up patch through a 90° flip on the
 * way out is a rotating billboard, which is the one thing a milled mark cannot
 * do.
 */
const SHOP_HIDDEN: Transform = {
  position: [0, -2.8, 3.5],
  rotation: SHOP_FLAT,
  scale: HIDDEN.scale,
};

const NAMEPLATE_SEATS: Record<ConceptViewId, Transform> = {
  /* The empty left gutter the work lens leaves beside the device cluster. */
  work: {
    position: [-1.72, SHOP_FLUSH_Y, 0.15],
    rotation: SHOP_FLAT,
    scale: 1,
  },
  /*
   * Foreground strip, in front of the run rather than beside it. The old
   * standing plate clipped the bottom edge of the third blank; a flush marking
   * on bench the blanks do not occupy cannot collide with anything.
   */
  signals: {
    position: [-1.95, SHOP_FLUSH_Y, 1.05],
    rotation: SHOP_FLAT,
    scale: 1.05,
  },
  /*
   * History parks them. Six era cards on a 1.52 pitch fill the whole frame and
   * the lens tracks laterally across them, so any patch of bench the marks
   * could take is bench a card is standing on.
   */
  history: SHOP_HIDDEN,
  /*
   * Profile: camera-left of the badge and on its ground line, so the frame
   * reads as one arrangement — the card holding the right two-thirds and a
   * quiet marking on the empty bench opposite it.
   */
  profile: {
    position: [-1.6, SHOP_FLUSH_Y, -2.6],
    rotation: SHOP_FLAT,
    scale: 1.55,
  },
};

/**
 * One laser-marked insert: the milled kerf it is dropped into, the satin insert
 * face, and the mark cut into that face with the same groove/lip shading every
 * other engraving in the set uses. Aspect comes off the manifest viewBox, so
 * the marks are never scaled non-uniformly.
 */
function ShopMarks({
  plateRef,
}: {
  plateRef: (node: THREE.Group | null) => void;
}) {
  return (
    <group
      position={NAMEPLATE_SEATS.work.position}
      ref={plateRef}
      rotation={NAMEPLATE_SEATS.work.rotation}
    >
      {SHOP_PLATES.map((plate) => (
        <group key={plate.company} position={[plate.x, plate.y, 0]}>
          {/* Kerf: the darkened gap the insert is seated in. */}
          <mesh position={[0, 0, 0.0004]}>
            <planeGeometry
              args={[plate.width + SHOP_SEAM, SHOP_PLATE_HEIGHT + SHOP_SEAM]}
            />
            <meshStandardMaterial
              color={SHOP_KERF}
              envMapIntensity={0.5}
              metalness={0.3}
              roughness={0.85}
            />
          </mesh>
          {/* Insert face, flush with the work surface. */}
          <mesh position={[0, 0, 0.001]}>
            <planeGeometry args={[plate.width, SHOP_PLATE_HEIGHT]} />
            <meshStandardMaterial
              color={SHOP_INSERT}
              envMapIntensity={1.5}
              metalness={0.5}
              roughness={0.26}
            />
          </mesh>
          <EtchedMark
            company={plate.company}
            envMapIntensity={1.2}
            floor={0.42}
            height={SHOP_MARK_HEIGHT}
            hostColor={SHOP_INSERT}
            lipMix={0.5}
            metalness={0.5}
            offset={0.003}
            position={[0, 0, 0.0016]}
            roughness={0.34}
          />
        </group>
      ))}
    </group>
  );
}

function StudioEnvironment() {
  return (
    <Environment frames={1} resolution={512}>
      {/*
       * The light-grey studio shell. Without it the baked cubemap is black and
       * metalness-1 aluminum has nothing to reflect but the lightformers, which
       * is what turns real metal into painted MDF.
       */}
      <color args={['#bfc2c5']} attach="background" />
      {/*
       * Overhead-front softbox, the key. Tightened from an 18x9 slab hung at
       * z 4.5 — at that size it lit the bench as one uniform field from frame
       * edge to frame edge and the set had no light shape at all. Half the
       * width and pulled in over the subject cluster, so the brightest point
       * sits under the devices and the bench falls a full value step toward
       * the corners. Falloff shaping, not a relight: same colour, same palette.
       */}
      <Lightformer
        color="#ffffff"
        form="rect"
        intensity={2.4}
        position={[0.5, 7.2, 2.2]}
        rotation={[-Math.PI / 3, 0, 0]}
        scale={[9.5, 6, 1]}
      />
      {/*
       * Narrow high-intensity strip, camera-left. A broad dim room gives
       * metalness-1 nothing to reflect but flat grey — this is the source the
       * brushed roughnessMap resolves into an actual directional streak.
       */}
      <Lightformer
        color="#ffffff"
        form="rect"
        intensity={4}
        position={[-3.6, 8.6, 2.6]}
        rotation={[-Math.PI / 2.55, 0, 0.07]}
        scale={[14, 0.5, 1]}
      />
      <Lightformer
        form="rect"
        intensity={1.5}
        position={[-6, 4.6, 0]}
        rotation={[0, Math.PI / 2, 0]}
        scale={[14, 1.2, 1]}
      />
      {/*
       * Chamfer specular. A single very narrow, very bright vertical slit
       * raking the front-left edges: its only job is to be the small hard
       * source the 0.002 chamfer bands and the brushed roughnessMap streak
       * across. Kept narrow precisely so it shows as an edge highlight instead
       * of lifting the value of the whole set.
       *
       * Dropped from y 3.4 to 2.5 and widened 0.35 → 0.55. The work camera sits
       * at y 2.25 and the chassis chamfers are near-horizontal bands, so their
       * reflection vector points only a little above the horizon; a slit hung a
       * full unit over the lens missed every one of them and the raking
       * specular only ever resolved on the tall Signals blanks.
       */}
      <Lightformer
        color="#ffffff"
        form="rect"
        intensity={10}
        position={[-4.2, 2.5, 5.2]}
        rotation={[0, 2.46, 0]}
        scale={[0.55, 9, 1]}
      />
      <Lightformer
        color="#e6eaee"
        form="rect"
        intensity={0.55}
        position={[6, 3, 2]}
        rotation={[0, -Math.PI / 2, 0]}
        scale={[8, 5, 1]}
      />
      {/*
       * Gradient rig. A 512 cubemap baked from broad uniform softboxes has
       * nothing in it for a metal plane to sweep across: every deck, lid back
       * and rail rendered one flat value because every normal in the hemisphere
       * saw the same irradiance. These four narrow, high-contrast strips are
       * hung at deliberately different angles so a surface changes value as its
       * normal turns — the MacBook top deck now runs light at the front lip to
       * dark at the hinge instead of holding a single tone across 2.3 units.
       */}
      <Lightformer
        color="#ffffff"
        form="rect"
        intensity={6}
        position={[2.8, 6.4, 1.4]}
        rotation={[-Math.PI / 2.9, 0, -0.42]}
        scale={[10, 0.35, 1]}
      />
      <Lightformer
        color="#ffffff"
        form="rect"
        intensity={5}
        position={[-1.4, 5.2, -2.6]}
        rotation={[-Math.PI / 2.2, 0, 0.86]}
        scale={[10, 0.35, 1]}
      />
      <Lightformer
        color="#f4f7fa"
        form="rect"
        intensity={7}
        position={[4.6, 2.6, 3.4]}
        rotation={[0, -1.02, 0.24]}
        scale={[0.4, 8, 1]}
      />
      {/*
       * The dark bar. Without something in the cubemap that is *below* the room
       * average, a metal plane can only ever sweep bright-to-less-bright; this
       * gives the sweep somewhere to land, which is what makes the gradient
       * read as a reflection rather than a shading ramp.
       */}
      <Lightformer
        color="#6e7174"
        form="rect"
        intensity={0.4}
        position={[-2.2, 3.2, 4.2]}
        rotation={[0, 0.34, 0.18]}
        scale={[9, 1.6, 1]}
      />
      {/*
       * Set wall. Up-facing metal — the Signals blanks lying flat on the bench —
       * reflects the *back* hemisphere at a shallow angle, so this is what makes
       * them read as light brushed aluminum instead of muddy grey plastic.
       */}
      <Lightformer
        color="#c9ccd0"
        form="rect"
        intensity={0.55}
        position={[0, 5, -11]}
        scale={[26, 12, 1]}
      />
      {/*
       * Negative fill, kept low and shallow so it only darkens grazing edges
       * rather than swallowing every horizontal reflection.
       */}
      <Lightformer
        color="#8e9194"
        form="rect"
        intensity={0.34}
        position={[0, 0.9, -7.4]}
        scale={[16, 2.2, 1]}
      />
    </Environment>
  );
}

/* -------------------------------------------------------------------------- */
/* Devices                                                                      */
/* -------------------------------------------------------------------------- */

const PHONE_LEAN = 0.35;
/**
 * A 6.1in phone is 147mm tall; a 14in lid is 250mm. The model was authored at
 * roughly one unit per "device", which rendered a phone taller than a laptop —
 * the single loudest credibility break in the work shot. This factor puts the
 * body back at 0.62x the lid height at equal depth, and the phones earn their
 * presence from standing forward of the laptops instead of from fake scale.
 */
const PHONE_MODEL_SCALE = 0.46;

function PhoneStand() {
  return (
    <group>
      <RoundedBox
        args={[1.95, 0.09, 0.78]}
        castShadow
        position={[0, 0.045, -0.14]}
        radius={0.02}
        receiveShadow
        smoothness={3}
      >
        <AluminumMaterial roughness={0.28} />
      </RoundedBox>
      <mesh castShadow position={[0, 0.13, 0.2]}>
        <boxGeometry args={[1.95, 0.16, 0.07]} />
        <AluminumMaterial roughness={0.28} />
      </mesh>
      <mesh
        castShadow
        position={[0, 0.34, -0.34]}
        rotation={[-PHONE_LEAN, 0, 0]}
      >
        <boxGeometry args={[1.95, 0.56, 0.06]} />
        <AluminumMaterial roughness={0.28} />
      </mesh>
    </group>
  );
}

function Phone({
  texture,
  seed,
  gain,
  crop,
  materialRef,
}: {
  texture: THREE.Texture;
  seed: number;
  gain: number;
  crop?: SourceRect;
  materialRef: (node: THREE.ShaderMaterial | null) => void;
}) {
  /*
   * Bezel slimmed to 0.045 on the sides and 0.055 top and bottom — 2.9% and
   * 1.6% of the body. The previous land was 4.8%/4.9%, roughly three times any
   * shipping iPhone, which is what made the modeled device read as a mock.
   */
  const bezel = useMemo(
    () => getBezelRing(1.55, 3.35, 1.46, 3.24, 0.16, 0.128, 0.0062),
    [],
  );
  const chamfer = useMemo(
    () => getBezelRing(1.552, 3.352, 1.522, 3.322, 0.161, 0.152, 0.004),
    [],
  );
  /*
   * The rail: a real side band wrapping the body, 0.016 proud in x/y and 0.013
   * proud of the display in z. Without it the phone silhouette is a flat black
   * rounded-rect stroke — a 2D sticker standing where a machined object should
   * be. The inner wall is buried inside the ink body, so all that shows is the
   * band, in polished aluminum.
   */
  const rail = useMemo(
    () => getBezelRing(1.582, 3.382, 1.514, 3.314, 0.166, 0.132, 0.206),
    [],
  );
  /* Front and back edge loops of the rail, the hard line the slit rakes. */
  const railEdge = useMemo(
    () => getBezelRing(1.584, 3.384, 1.552, 3.352, 0.167, 0.151, 0.005),
    [],
  );
  /* The 0.002-proud mirror band wrapping the rail's outer perimeter. */
  const railProud = useMemo(
    () => getBezelRing(1.586, 3.386, 1.5745, 3.3745, 0.168, 0.1625, 0.206),
    [],
  );

  return (
    <group scale={PHONE_MODEL_SCALE}>
      <ContactCore depth={1.35} width={2.6} z={-0.12} />
      <PhoneStand />
      <group position={[0, 0.1, 0.12]} rotation={[-PHONE_LEAN, 0, 0]}>
        <group position={[0, 1.71, 0]}>
          <RoundedBox
            args={[1.55, 3.35, 0.18]}
            castShadow
            radius={0.16}
            smoothness={5}
          >
            <InkMetalMaterial />
          </RoundedBox>
          <ChamferBand args={[1.55, 3.35, 0.18]} radius={0.16} smoothness={5} />

          {/* Polished aluminum side band standing proud of the glass. */}
          <mesh castShadow geometry={rail} position={[0, 0, -0.103]}>
            <AluminumMaterial
              color={ALUMINUM_BRIGHT}
              envMapIntensity={2.0}
              roughness={0.12}
            />
          </mesh>
          {/*
           * Chamfer at the rail / front-glass junction, running the phone's
           * full height. The body already carried a ChamferBand, but at 1.554
           * wide it is buried *inside* the 1.582 rail and never showed — which
           * is why the phone silhouette rendered as a flat mid-grey stripe with
           * no cut line while the laptop lip read perfectly.
           *
           * It has to be a *ring*, not a ChamferBand: ChamferBand is a solid
           * RoundedBox that only works when the host is a solid of the same
           * size, and the rail is a shell. A solid band here spans the full
           * 0.206 of rail depth straight across the display well and buries
           * the screen behind mirror aluminum.
           */}
          <mesh geometry={railProud} position={[0, 0, -0.103]}>
            <AluminumMaterial
              color={ALUMINUM_BRIGHT}
              envMapIntensity={2.6}
              roughness={0.05}
            />
          </mesh>
          {/* Front and back edge loops of the rail. */}
          <mesh geometry={railEdge} position={[0, 0, 0.0975]}>
            <AluminumMaterial
              color={ALUMINUM_BRIGHT}
              envMapIntensity={3.0}
              roughness={0.05}
            />
          </mesh>
          <mesh geometry={railEdge} position={[0, 0, -0.1035]}>
            <AluminumMaterial envMapIntensity={2.4} roughness={0.06} />
          </mesh>

          {/* Machined chamfer around the display perimeter, in bright metal. */}
          <mesh geometry={chamfer} position={[0, 0, 0.0868]}>
            <AluminumMaterial color={ALUMINUM_BRIGHT} roughness={0.16} />
          </mesh>

          {/*
           * Bezel land of body colour, its front face standing at 0.0952 so the
           * display recessed behind it catches a hairline self-shadow along the
           * top and side edges.
           */}
          <mesh geometry={bezel} position={[0, 0, 0.089]}>
            <InkMetalMaterial roughness={0.4} />
          </mesh>
          <mesh position={[0, 0, 0.0905]}>
            <planeGeometry args={[1.48, 3.27]} />
            <meshStandardMaterial color={SCREEN_WELL} roughness={0.22} />
          </mesh>

          {/*
           * Display, 0.004 below the bezel plane. No modeled island: the source
           * captures carry their own status bar, and two of them stacked read
           * as a manufacturing defect rather than a device.
           */}
          <Screen
            crop={crop}
            gain={gain}
            height={3.24}
            materialRef={materialRef}
            position={[0, 0, 0.0912]}
            radius={0.12}
            seed={seed}
            texture={texture}
            width={1.455}
          />
          <GlassCover
            height={3.24}
            position={[0, 0, 0.0952]}
            radius={0.12}
            width={1.455}
          />

          {/*
           * Buttons as real pills standing off the rail: two volume keys on the
           * left edge, the side/power key on the right. A rail with no controls
           * on it is a bezel, not a chassis.
           */}
          {[0.9, 0.5].map((y) => (
            <RoundedBox
              args={[0.024, 0.32, 0.075]}
              key={y}
              position={[-0.8, y, 0]}
              radius={0.011}
              smoothness={3}
            >
              <AluminumMaterial envMapIntensity={2.0} roughness={0.15} />
            </RoundedBox>
          ))}
          <RoundedBox
            args={[0.024, 0.46, 0.075]}
            position={[0.8, 0.62, 0]}
            radius={0.011}
            smoothness={3}
          >
            <AluminumMaterial envMapIntensity={2.0} roughness={0.15} />
          </RoundedBox>

          {/* Antenna breaks in the rail. */}
          {[1.16, -1.16].map((y) => (
            <mesh key={y} position={[0.7908, y, 0]}>
              <boxGeometry args={[0.012, 0.026, 0.2]} />
              <meshStandardMaterial
                color="#3a3c3e"
                metalness={0.4}
                roughness={0.6}
              />
            </mesh>
          ))}

          {/*
           * Camera plateau on the back face: a rounded island standing off the
           * rear shell with two lens barrels. Only visible when a phone turns
           * away from camera in the peripheral views, but its silhouette is
           * what keeps the body from reading as a symmetrical slab.
           */}
          <group position={[-0.4, 1.16, 0]}>
            {/*
             * Standoff raised from 0.05 to 0.085 so the island's own side wall
             * is deep enough to catch the raking slit; at the old depth it sat
             * flush enough with the shell to disappear into it.
             */}
            <RoundedBox
              args={[0.62, 0.62, 0.085]}
              position={[0, 0, -0.132]}
              radius={0.15}
              smoothness={4}
            >
              <InkMetalMaterial roughness={0.24} />
            </RoundedBox>
            <ChamferBand
              args={[0.62, 0.62, 0.085]}
              position={[0, 0, -0.132]}
              radius={0.15}
              smoothness={4}
            />
            {[
              [-0.13, 0.13],
              [0.13, -0.13],
            ].map(([x, y]) => (
              <mesh
                key={`${x}:${y}`}
                position={[x, y, -0.186]}
                rotation={[Math.PI / 2, 0, 0]}
              >
                <cylinderGeometry args={[0.115, 0.115, 0.028, 18]} />
                <meshStandardMaterial
                  color="#101112"
                  metalness={0.9}
                  roughness={0.14}
                />
              </mesh>
            ))}
          </group>
        </group>
      </group>
    </group>
  );
}

const LID_ANGLE = -0.2094;

/**
 * 78 keys as one InstancedMesh. At the new work camera the keyboard well is
 * within a hand's width of the screen and cannot stay two flat planes.
 */
const KEY_COLUMNS = 13;
const KEY_ROWS = 6;
/**
 * Keycap footprint, sized off the pitch so the gutter between caps is a fixed
 * ~0.030 world. At 0.162 x 0.142 the gutters were 0.026 / 0.025 and, against a
 * #37393b cap on a #232527 floor, the whole deck averaged out to one mid-grey
 * blob at the value of the palmrest — the laptops read as untextured primitives
 * at hero distance. Black keys, black well, silver chassis is the whole tell.
 */
/*
 * The values move, the gutters do not.
 *
 * A #2a2c2e well floor under #3c3e40 caps is a real cap / shadow-line pair,
 * where the old #0b0c0d floor crushed the whole deck to one black mass. But the
 * scale-correct 0.012 gutter that was meant to come with it does not survive
 * this camera: a cap is fifteen screen pixels wide at the work distance, so
 * 0.012 resolves to a single antialiased pixel and — measured against the
 * render — thirteen columns merged into a darker slab than the exaggerated
 * gutter they replaced. Lighter caps over a lighter floor also cut the local
 * contrast that was doing the separating (4.8:1 down to 1.9:1), so the geometry
 * has to keep doing it. Gutters stay at the proven 0.030 / 0.042.
 */
/*
 * 0.020, not the 0.012 a real 19mm-pitch keyboard holds. At the work camera a
 * cap is fifteen screen pixels wide, so a 0.012 gutter resolves to a single
 * antialiased pixel and thirteen columns merged back into one dark slab —
 * measured against the render, a scale-correct gap is *less* separated here
 * than the exaggerated one it replaced. 0.020 is the smallest gutter that
 * still holds a visible shadow line at hero distance.
 */
const KEY_GUTTER = 0.03;
/*
 * The row gutter stays wider than the column gutter, and it has to. The work
 * camera sits ~18° above the deck, so a gap in z foreshortens to about a third
 * of its width while the cap standing in front of it does not: at an equal
 * gutter the near row covers the gap behind it outright and six rows of keys
 * merge back into one dark slab. 0.042 is the smallest z gap that still clears
 * the 0.013 of cap standing in front of it.
 */
const KEY_ROW_GUTTER = 0.042;
const KEY_COLUMN_PITCH = 0.1877;
const KEY_ROW_PITCH = 0.1667;
const KEY_CAP_WIDTH = KEY_COLUMN_PITCH - KEY_GUTTER;
const KEY_CAP_DEPTH = KEY_ROW_PITCH - KEY_ROW_GUTTER;
/**
 * The palmrest is a solid RoundedBox whose top face is local y 0.1, and there
 * is no CSG in this file — anything placed below 0.1 is simply occluded by the
 * deck itself. So the well is built *on* the deck plane and sold by value
 * rather than by depth: a near-black plate at 0.1006, a bright machined lip
 * ring standing 0.004 proud around it, and the caps standing on the plate. The
 * caps end up ~0.009 above the lip, which is what a low-profile keyboard
 * actually does.
 */
const KEY_WELL_FLOOR = 0.1006;
const KEY_WELL_LIP = 0.004;
const KEY_CAP_HEIGHT = 0.013;
const KEY_MATRICES: THREE.Matrix4[] = (() => {
  const matrices: THREE.Matrix4[] = [];

  for (let row = 0; row < KEY_ROWS; row += 1) {
    for (let column = 0; column < KEY_COLUMNS; column += 1) {
      matrices.push(
        new THREE.Matrix4().setPosition(
          (column - (KEY_COLUMNS - 1) / 2) * KEY_COLUMN_PITCH,
          /* Standing on the well plate, so the gutters between caps expose the
             near-black plate 0.013 below every cap top. */
          KEY_WELL_FLOOR + 0.0004 + KEY_CAP_HEIGHT / 2,
          -0.3 + (row - (KEY_ROWS - 1) / 2) * KEY_ROW_PITCH,
        ),
      );
    }
  }

  return matrices;
})();

function attachKeyGrid(mesh: THREE.InstancedMesh | null) {
  if (!mesh) {
    return;
  }

  KEY_MATRICES.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
  mesh.instanceMatrix.needsUpdate = true;
}

function KeyGrid() {
  return (
    <instancedMesh
      args={[undefined, undefined, KEY_MATRICES.length]}
      ref={attachKeyGrid}
    >
      <boxGeometry args={[KEY_CAP_WIDTH, KEY_CAP_HEIGHT, KEY_CAP_DEPTH]} />
      {/*
       * envMapIntensity is the whole fight here. The studio cubemap is baked
       * from a stack of intensity-2.4-to-10 Lightformers, so at the default 1.0
       * the IBL term alone lifted a #2a2c2e cap to roughly 40% grey and the
       * deck rendered as a light field with faint outlines — the exact "mid-grey
       * blobs at the value of the palmrest" read. Held down to 0.35 with no
       * metalness, the caps finally sit where black keycaps belong.
       */}
      <meshStandardMaterial
        color="#3c3e40"
        envMapIntensity={0.35}
        metalness={0}
        roughness={0.62}
      />
    </instancedMesh>
  );
}

function Laptop({
  texture,
  seed,
  gain,
  materialRef,
}: {
  texture: THREE.Texture;
  seed: number;
  gain: number;
  materialRef: (node: THREE.ShaderMaterial | null) => void;
}) {
  const bezel = useMemo(
    () => getBezelRing(3.35, 2.14, 3.245, 2.035, 0.028, 0.014, 0.006),
    [],
  );
  const chamfer = useMemo(
    () => getBezelRing(3.352, 2.142, 3.276, 2.066, 0.03, 0.026, 0.004),
    [],
  );
  /* Bright machined lip band standing around the well plate. */
  const keyLip = useMemo(
    () => getBezelRing(2.78, 1.28, 2.7, 1.2, 0.024, 0.018, KEY_WELL_LIP),
    [],
  );

  return (
    <group>
      <ContactCore depth={3.0} width={4.35} />

      {/* Rubber feet, and the 0.02 lift they give the body off the bench. */}
      {[
        [-1.44, 0.95],
        [1.44, 0.95],
        [-1.44, -0.95],
        [1.44, -0.95],
      ].map(([x, z]) => (
        <mesh key={`${x}:${z}`} position={[x, 0.011, z]}>
          <cylinderGeometry args={[0.075, 0.075, 0.022, 14]} />
          <meshStandardMaterial
            color="#2c2e30"
            metalness={0}
            roughness={0.88}
          />
        </mesh>
      ))}

      <group position={[0, 0.022, 0]}>
        {/*
         * Palmrest. Brushed across the deck, camera-left to camera-right, at
         * the 0.24 satin a bead-blasted-then-brushed unibody actually holds —
         * at 0.16 it was closer to a polished plate and the grain map had
         * nothing to modulate.
         */}
        <RoundedBox
          args={[3.35, 0.1, 2.3]}
          castShadow
          position={[0, 0.05, 0]}
          radius={0.028}
          receiveShadow
          smoothness={4}
        >
          <AluminumMaterial
            envMapIntensity={2.0}
            grain="lateral"
            roughness={0.24}
          />
        </RoundedBox>
        {/*
         * Base chamfer, as a top-edge loop rather than a ChamferBand. The base
         * lies thin-axis-up, and a ChamferBand there would expand in y — mirror
         * metal poking out below the body exactly where it meets the bench. A
         * 0.011 band inset from both faces and 0.002 proud in x/z gives the
         * front and side edges the machined cut line without lifting the
         * contact. Bottom edge is left alone: it lives in the contact shadow.
         */}
        {/*
         * This loop is also the palmrest's front lip: it wraps the full top
         * perimeter of the base, so the chamfer that faces the lens square-on
         * is the front run of it. Brightened to ALUMINUM_BRIGHT so it resolves
         * the raking slit as a hard line rather than a broad sheen.
         */}
        <RoundedBox
          args={[3.354, 0.011, 2.304]}
          position={[0, 0.092, 0]}
          radius={0.005}
          smoothness={3}
        >
          <AluminumMaterial
            color={ALUMINUM_BRIGHT}
            envMapIntensity={2.6}
            roughness={0.05}
          />
        </RoundedBox>

        {/*
         * Keyboard well: an actual recess, not two coplanar planes. A bright
         * machined lip ring at the deck plane, then the well's own side walls
         * dropping 0.008 to a near-black floor the caps stand in. The value
         * order is what sells it — silver chassis, bright lip, black well,
         * black keys — and it is the single largest credibility gain on the
         * laptops at this camera distance.
         */}
        <mesh
          geometry={keyLip}
          position={[0, KEY_WELL_FLOOR - 0.0006, -0.3]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <meshStandardMaterial
            color="#a4a6a8"
            envMapIntensity={1.8}
            metalness={1}
            roughness={0.2}
          />
        </mesh>
        {/*
         * The near-black plate the caps stand on. envMapIntensity is the whole
         * fight: the studio cubemap is baked from a stack of intensity-2.4-to-10
         * Lightformers, so at the default 1.0 an ink plate returns ~40% grey and
         * the deck reads as a light field with faint outlines — the exact
         * "mid-grey blobs at the value of the palmrest" problem.
         */}
        <mesh
          position={[0, KEY_WELL_FLOOR, -0.3]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[2.7, 1.2]} />
          <meshStandardMaterial
            color="#2a2c2e"
            envMapIntensity={0.22}
            metalness={0}
            roughness={0.9}
          />
        </mesh>
        <KeyGrid />

        {/*
         * Trackpad: a filled slab of glass, not an outline. It used to be a
         * #c6c8ca plane brighter than the palmrest it is cut into, which reads
         * as a hole in the chassis rather than a part. Now it is a distinct
         * cooler, darker, much smoother value inside a dark milled gap.
         */}
        <mesh position={[0, 0.1008, 0.62]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1.11, 0.76]} />
          <meshStandardMaterial
            color="#75777a"
            metalness={0.6}
            roughness={0.55}
          />
        </mesh>
        <mesh position={[0, 0.1014, 0.62]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1.05, 0.7]} />
          <meshStandardMaterial
            color="#a7aaad"
            envMapIntensity={1.7}
            metalness={0.45}
            roughness={0.08}
          />
        </mesh>

        {/* Hinge. */}
        <mesh
          castShadow
          position={[0, 0.088, -1.09]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry args={[0.045, 0.045, 3.15, 18]} />
          <AluminumMaterial color={ALUMINUM_DARK} roughness={0.3} />
        </mesh>

        <group position={[0, 0.09, -1.09]} rotation={[LID_ANGLE, 0, 0]}>
          {/* Lid back: grain runs front-to-back, across the palmrest's. */}
          <RoundedBox
            args={[3.35, 2.14, 0.055]}
            castShadow
            position={[0, 1.07, 0]}
            radius={0.028}
            smoothness={4}
          >
            <AluminumMaterial
              envMapIntensity={2.0}
              grain="axial"
              roughness={0.24}
            />
          </RoundedBox>
          {/* Bright chamfer edge loop, the full lid outer perimeter. */}
          <ChamferBand
            args={[3.35, 2.14, 0.055]}
            color={ALUMINUM_BRIGHT}
            position={[0, 1.07, 0]}
            radius={0.028}
          />
          {/* Bright machined chamfer running the lid perimeter. */}
          <mesh geometry={chamfer} position={[0, 1.07, 0.0262]}>
            <AluminumMaterial color={ALUMINUM_BRIGHT} roughness={0.14} />
          </mesh>
          {/* 0.0525 bezel land, raised so the display sits 0.004 under it. */}
          <mesh geometry={bezel} position={[0, 1.07, 0.027]}>
            <AluminumMaterial roughness={0.26} />
          </mesh>
          <mesh position={[0, 1.07, 0.0282]}>
            <planeGeometry args={[3.26, 2.05]} />
            <meshStandardMaterial color={SCREEN_WELL} roughness={0.22} />
          </mesh>
          <Screen
            gain={gain}
            height={2.03}
            materialRef={materialRef}
            position={[0, 1.07, 0.029]}
            radius={0.012}
            seed={seed}
            texture={texture}
            width={3.24}
          />
          <GlassCover
            height={2.03}
            position={[0, 1.07, 0.033]}
            radius={0.012}
            width={3.24}
          />
          <mesh position={[0, 2.108, 0.0335]}>
            <circleGeometry args={[0.016, 14]} />
            <meshStandardMaterial
              color="#0d0e0f"
              metalness={0.5}
              roughness={0.2}
            />
          </mesh>
        </group>
      </group>
    </group>
  );
}

function ProjectDevice({
  project,
  texture,
  index,
  deviceRef,
  materialRef,
}: {
  project: FeaturedProject;
  texture: THREE.Texture;
  index: number;
  deviceRef: (node: THREE.Group | null) => void;
  materialRef: (node: THREE.ShaderMaterial | null) => void;
}) {
  const phone = PHONE_TITLES.has(project.title);
  const seed = SCREEN_SEEDS[index % SCREEN_SEEDS.length];
  const gain = SCREEN_GAINS[index % SCREEN_GAINS.length];
  const crop = SCREEN_CROPS[project.title];

  return (
    <group
      onClick={(event) => {
        event.stopPropagation();
        setBenchSelection('work', index);
      }}
      onPointerEnter={(event) => {
        event.stopPropagation();
        setBenchHover('work', index);
      }}
      onPointerLeave={() => {
        setBenchHover('work', -1);
      }}
      position={HIDDEN.position}
      ref={deviceRef}
      scale={HIDDEN.scale}
    >
      {phone ? (
        <Phone
          crop={crop}
          gain={gain}
          materialRef={materialRef}
          seed={seed}
          texture={texture}
        />
      ) : (
        <Laptop
          gain={gain}
          materialRef={materialRef}
          seed={seed}
          texture={texture}
        />
      )}
    </group>
  );
}

/* -------------------------------------------------------------------------- */
/* Profile badge                                                                */
/* -------------------------------------------------------------------------- */

const BADGE_LEAN = -0.244;
const CARD_WIDTH = 2.9;
const CARD_HEIGHT = 4.0;

function ProfileBadge({
  badgeRef,
}: {
  badgeRef: (node: THREE.Group | null) => void;
}) {
  const portrait = useConfiguredTextures(['/pfp.JPG'])[0];
  const coveredPortrait = useMemo(
    () => coverTexture(portrait, 2 / 3),
    [portrait],
  );
  const fields = useMemo(() => createFieldTexture(), []);
  const name = useMemo(() => createNameTexture(), []);
  const shading = useMemo(() => getCardFalloff(), []);

  return (
    <group position={HIDDEN.position} ref={badgeRef} scale={HIDDEN.scale}>
      {/*
       * Sized to the easel's actual footprint — the 3.3 slot bar plus the brace
       * foot behind it — not to the card standing on it. At 4.3 x 2.4 the
       * rounded-rect ramp degenerated into a broad symmetric oval a full unit
       * wider than anything touching the bench, which is what read as a black
       * ellipse painted under the badge.
       */}
      <ContactCore depth={1.55} opacity={0.72} width={3.6} z={-0.5} />

      {/*
       * Easel: slot bar the card stands in, angled brace, visible feet.
       *
       * The end caps are the problem this radius/metalness pair solves. A
       * 0.02-radius cap is effectively a flat wall whose normal points straight
       * down ±x; the key is at [-6.5, 7, 3.2] and full metal has no diffuse
       * term, so the camera-right cap could only ever return what the cubemap
       * holds in that direction — an unlit corner of the room — and rendered as
       * a near-black unlit block on the end of a bright bar. A 0.048 fillet
       * gives the cap a band of normals that sweep up into the key, and 0.78
       * metalness lets enough diffuse through that the wall itself has a value.
       */}
      <RoundedBox
        args={[3.3, 0.1, 0.62]}
        castShadow
        position={[0, 0.1, 0]}
        radius={0.048}
        receiveShadow
        smoothness={4}
      >
        <AluminumMaterial
          envMapIntensity={1.6}
          metalness={0.78}
          roughness={0.26}
        />
      </RoundedBox>
      <mesh position={[0, 0.151, -0.02]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.98, 0.1]} />
        <meshStandardMaterial color="#5f6163" roughness={0.7} />
      </mesh>
      <mesh castShadow position={[0, 0.725, -0.665]} rotation={[0.49, 0, 0]}>
        <boxGeometry args={[0.18, 1.42, 0.06]} />
        <AluminumMaterial color={ALUMINUM_DARK} roughness={0.3} />
      </mesh>
      <RoundedBox
        args={[0.9, 0.09, 0.34]}
        castShadow
        position={[0, 0.06, -1.0]}
        radius={0.02}
        smoothness={3}
      >
        <AluminumMaterial roughness={0.26} />
      </RoundedBox>
      {[-1.4, 1.4].map((x) => (
        <mesh key={x} position={[x, 0.025, 0]}>
          <cylinderGeometry args={[0.09, 0.09, 0.05, 16]} />
          <meshStandardMaterial color="#3b3d3f" roughness={0.8} />
        </mesh>
      ))}
      {[-0.34, 0.34].map((x) => (
        <mesh key={x} position={[x, 0.015, -1.0]}>
          <cylinderGeometry args={[0.07, 0.07, 0.03, 14]} />
          <meshStandardMaterial color="#3b3d3f" roughness={0.8} />
        </mesh>
      ))}

      <group position={[0, 0.09, 0]} rotation={[BADGE_LEAN, 0, 0]}>
        <group position={[0, CARD_HEIGHT / 2 + 0.04, 0]}>
          <RoundedBox
            args={[CARD_WIDTH, CARD_HEIGHT, 0.06]}
            castShadow
            radius={0.05}
            smoothness={4}
          >
            {/*
             * Card stock, not paper white — but the subject, so it out-values
             * the bench it stands on. At envMapIntensity 0.62 over a #d4d6d8
             * bench the card rendered a value step UNDER the furniture, which
             * is a lighting mistake no portrait survives. The bench came down
             * ~14% and the card's key response came up to 0.95; the stock is
             * also a step lighter and a step warmer than #dedfdf, so the sheet
             * separates from the grey set by hue as well as by value. Still
             * short of paper white: the falloff pass below needs headroom.
             */}
            <meshStandardMaterial
              color="#e6e4e0"
              envMapIntensity={0.95}
              metalness={0}
              roughness={0.54}
            />
          </RoundedBox>

          {/* Portrait: 2:3 ID window inside a 0.04 inset frame. */}
          <mesh position={[-0.73, 0.78, 0.031]}>
            <planeGeometry args={[1.26, 1.85]} />
            <meshStandardMaterial
              color="#d0d0cf"
              envMapIntensity={0.9}
              roughness={0.6}
            />
          </mesh>
          {/* Key response tracks the card stock it is printed on. */}
          <mesh position={[-0.73, 0.78, 0.0325]}>
            <planeGeometry args={[1.18, 1.77]} />
            <meshStandardMaterial
              envMapIntensity={0.92}
              map={coveredPortrait}
              roughness={0.52}
            />
          </mesh>

          <mesh position={[0.72, 1.24, 0.0325]}>
            <planeGeometry args={[1.16, 0.29]} />
            <meshStandardMaterial
              map={name}
              metalness={0}
              roughness={0.62}
              transparent
            />
          </mesh>

          {/* Three left-aligned field rows, label above value. */}
          <mesh position={[0.0, -0.82, 0.0325]}>
            <planeGeometry args={[2.5, 1.25]} />
            <meshStandardMaterial
              map={fields}
              metalness={0}
              roughness={0.62}
              transparent
            />
          </mesh>

          {/*
           * UCLA credential mark, debossed into the card's lower-right corner
           * where an issuing institution stamps one. It used to run 0.29 tall
           * in the empty column under NAME — a 1.4x0.29 wordmark on a 2.9-unit
           * card, which is a banner, not a credential, and it read as the
           * card's headline. At 0.16 it is a stamp; lipMix comes up to 0.3 so
           * the shallower cut still carries a lit lower edge.
           */}
          <EtchedMark
            company="UCLA"
            envMapIntensity={0.8}
            floor={0.44}
            height={0.16}
            hostColor="#e6e4e0"
            lipMix={0.3}
            metalness={0}
            offset={0.007}
            position={[0.94, -1.66, 0.0315]}
            roughness={0.5}
          />

          {/* Punched slot plus the clip end that carries the Snowflake mark. */}
          <mesh position={[0, CARD_HEIGHT / 2 - 0.16, 0.031]}>
            <planeGeometry args={[0.42, 0.055]} />
            <meshStandardMaterial color="#7d7f81" roughness={0.7} />
          </mesh>

          {/*
           * Shading pass over the whole card face, portrait and type included —
           * they are printed on the same sheet, so they take the same falloff.
           * Zero at the top edge, ~15% down at the stand. Laid last and with
           * depthWrite off so it never sorts under the content it shades.
           */}
          <mesh position={[0, 0, 0.0345]} renderOrder={3}>
            <planeGeometry args={[CARD_WIDTH - 0.012, CARD_HEIGHT - 0.012]} />
            <meshBasicMaterial
              alphaMap={shading}
              color="#3f4245"
              depthWrite={false}
              opacity={0.2}
              toneMapped={false}
              transparent
            />
          </mesh>
        </group>

        {/*
         * Bulldog clip biting the punched slot, then a woven strap running up
         * out of frame — the object the card actually belongs to, so the badge
         * is hanging from something rather than levitating.
         */}
        <RoundedBox
          args={[0.62, 0.24, 0.1]}
          castShadow
          position={[0, CARD_HEIGHT + 0.16, 0]}
          radius={0.03}
          smoothness={3}
        >
          <AluminumMaterial roughness={0.24} />
        </RoundedBox>
        <EtchedMark
          company="Snowflake"
          height={0.09}
          hostColor={ALUMINUM}
          position={[0, CARD_HEIGHT + 0.16, 0.049]}
          roughness={0.24}
        />
        {/* Swivel barrel the strap turns on. */}
        <mesh
          castShadow
          position={[0, CARD_HEIGHT + 0.31, 0]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry args={[0.038, 0.038, 0.3, 14]} />
          <AluminumMaterial color={ALUMINUM_DARK} roughness={0.28} />
        </mesh>
        {/*
         * Strap, folded back nearly flat over the swivel. At the new profile
         * distance the badge is more than twice the size it was, and the old
         * upright fold put 0.4 units of woven nylon straight through the site
         * header's nav row. It still explains what the clip is attached to;
         * it just does it lying down.
         */}
        <mesh
          castShadow
          position={[0, CARD_HEIGHT + 0.33, -0.2]}
          rotation={[1.16, 0, 0]}
        >
          <boxGeometry args={[0.26, 0.52, 0.022]} />
          <meshStandardMaterial
            color="#26282a"
            metalness={0}
            roughness={0.88}
          />
        </mesh>
        <mesh
          castShadow
          position={[0, CARD_HEIGHT + 0.25, -0.6]}
          rotation={[1.46, 0, 0]}
        >
          <boxGeometry args={[0.26, 0.56, 0.022]} />
          <meshStandardMaterial
            color="#2c2e30"
            metalness={0}
            roughness={0.88}
          />
        </mesh>
      </group>
    </group>
  );
}

/* -------------------------------------------------------------------------- */
/* Signals blanks                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Signals staging.
 *
 * Spacing is opened to 2.45 and the scale trimmed to 0.9 so the three plates
 * clear the frame edges by ~74 CSS and each other by ~60 CSS at 1440x900 —
 * previously the outer two were cropped by the left and right edges.
 *
 * BLANK_TILT is the reason the low signals lens works at all. A plate lying
 * dead flat under a 18° camera foreshortens its engraved title to roughly 8
 * screen pixels of cap height. Seated on a machined angle block the plate
 * meets the lens at ~33° instead, which nearly doubles the type and lets the
 * groove read. BLANK_LIFT is not a free parameter: it is exactly the height
 * that puts the plate's front-bottom edge back on the bench after the tilt, so
 * the blank still *touches* the surface it is standing on.
 */
const BLANK_SPACING = 2.45;
const BLANK_SCALE = 0.9;
const BLANK_TILT = 0.26;
const BLANK_HALF_LENGTH = 3.15 / 2;
const BLANK_HALF_THICKNESS = 0.16 / 2;
const BLANK_LIFT =
  BLANK_HALF_LENGTH * Math.sin(BLANK_TILT) +
  BLANK_HALF_THICKNESS * Math.cos(BLANK_TILT);

/**
 * The angle block the tilted plate is seated on: a right-trapezoid prism whose
 * sloped top face lies exactly on the plate's underside, so the two parts touch
 * along a full-length line instead of intersecting. Profile is authored in the
 * (z, y) plane and rotated into place, because ExtrudeGeometry only ever
 * extrudes a XY shape along +Z.
 */
const BLOCK_FRONT_Z = 1.35;
const BLOCK_BACK_Z = -0.6;
const BLOCK_WIDTH = 1.7;

let angleBlockGeometry: THREE.ExtrudeGeometry | null = null;

function getAngleBlock() {
  if (angleBlockGeometry) {
    return angleBlockGeometry;
  }

  /*
   * Height of the plate's underside above the bench as a function of z. The
   * pivot is the plate's front-bottom corner, which the lift puts exactly on
   * the bench, so the line passes through zero there and rises at tan(tilt).
   */
  const pivotZ =
    BLANK_HALF_LENGTH * Math.cos(BLANK_TILT) -
    BLANK_HALF_THICKNESS * Math.sin(BLANK_TILT);
  const underside = (z: number) => (pivotZ - z) * Math.tan(BLANK_TILT);

  const shape = new THREE.Shape();
  shape.moveTo(BLOCK_BACK_Z, 0);
  shape.lineTo(BLOCK_FRONT_Z, 0);
  shape.lineTo(BLOCK_FRONT_Z, underside(BLOCK_FRONT_Z));
  shape.lineTo(BLOCK_BACK_Z, underside(BLOCK_BACK_Z));
  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: false,
    depth: BLOCK_WIDTH,
    steps: 1,
  });
  /* Shape x → world z, extrusion → world −x; recentre on the plate. */
  geometry.rotateY(-Math.PI / 2);
  geometry.translate(BLOCK_WIDTH / 2, 0, 0);
  geometry.computeVertexNormals();
  angleBlockGeometry = geometry;
  return geometry;
}

function ExperimentBlank({
  index,
  blankRef,
}: {
  index: number;
  blankRef: (node: THREE.Group | null) => void;
}) {
  const experiment = experiments[index];
  const measuring = experiment.status.toLowerCase() === 'measuring';
  const plate = useMemo(
    () => createExperimentPlateTexture(experiment.status, experiment.title),
    [experiment.status, experiment.title],
  );
  const grid = useMemo(() => (measuring ? getDatumGrid() : null), [measuring]);
  const block = useMemo(() => getAngleBlock(), []);

  return (
    <group
      onPointerEnter={(event) => {
        event.stopPropagation();
        setBenchHover('signals', index);
      }}
      onPointerLeave={() => setBenchHover('signals', -1)}
      position={HIDDEN.position}
      ref={blankRef}
      scale={HIDDEN.scale}
    >
      <ContactCore depth={3.1} opacity={0.9} width={2.4} y={0.009} />

      {/* Machined angle block: the plate's seat, and the thing it touches. */}
      <mesh castShadow geometry={block} receiveShadow>
        <AluminumMaterial
          color={ALUMINUM_DARK}
          envMapIntensity={0.9}
          roughness={0.42}
        />
      </mesh>

      <group
        position={[0, BLANK_LIFT, 0]}
        rotation={[-Math.PI / 2 + BLANK_TILT, 0, 0]}
      >
        <RoundedBox
          args={[2.2, 3.15, 0.16]}
          castShadow
          radius={0.05}
          receiveShadow
          smoothness={3}
        >
          {/*
           * Light brushed aluminum, in the BENCH_TOP value band. It used to
           * render a full value step *under* the bench it was standing on —
           * base ALUMINUM at envMapIntensity 0.6 — which is muddy grey slab,
           * not stock. Now the plate is the brightest metal on the bench and
           * the pocket cut into it is what carries the darkness.
           */}
          <AluminumMaterial
            color="#c4c6c8"
            envMapIntensity={1.15}
            roughness={0.36}
          />
        </RoundedBox>
        <ChamferBand args={[2.2, 3.15, 0.16]} radius={0.05} smoothness={3} />

        {grid ? (
          <mesh position={[0, 0, 0.0805]}>
            <planeGeometry args={[2.02, 2.97]} />
            <meshStandardMaterial
              alphaMap={grid}
              color="#5c5e60"
              depthWrite={false}
              metalness={1}
              opacity={0.18}
              roughness={0.5}
              transparent
            />
          </mesh>
        ) : null}

        {/*
         * The data plate: a 2.02x1.4 pocket milled into the top face, its floor
         * a step down from the blank, carrying the experiment's status and
         * title as cut metal. A blank with nothing on it cannot be the subject
         * of a view — this is the content, straight out of conceptData.
         */}
        {/*
         * Pocket: a bright machined lip ring around a floor held a step under
         * the plate face, so the recess reads by value rather than by outline.
         */}
        <mesh position={[0, 0.28, 0.0802]}>
          <planeGeometry args={[2.06, 1.44]} />
          <meshStandardMaterial
            color="#d2d4d6"
            envMapIntensity={1.3}
            metalness={1}
            roughness={0.24}
          />
        </mesh>
        <mesh position={[0, 0.28, 0.0806]}>
          <planeGeometry args={[2.02, 1.4]} />
          <meshStandardMaterial
            color="#9fa1a3"
            envMapIntensity={0.85}
            metalness={1}
            roughness={0.55}
          />
        </mesh>
        {/*
         * Same lip-highlight / darkened-floor pair the nameplate pocket uses.
         * At the default 0.34 lip and 0.6 floor the SHIPPING / MEASURING /
         * COLLECTING labels carried about 8% local contrast against the pocket
         * — invisible at the signals distance. At lipMix 0.5 / floor 0.3 each
         * glyph gets a bright machined edge over a cut a third of the pocket's
         * value, which is roughly 45% local contrast.
         */}
        <EngravedDecal
          alpha={plate}
          envMapIntensity={0.85}
          floor={0.3}
          height={1.28}
          hostColor="#9fa1a3"
          lipMix={0.5}
          offset={0.0034}
          position={[0, 0.29, 0.081]}
          roughness={0.55}
          width={1.84}
        />

        {/*
         * The foot of the blank is left as bare stock. It used to carry a
         * 0.92-unit embossed A / B / C — a single-character index badge, which
         * is exactly the numbered-badge pattern this set is not allowed to use,
         * and it was competing with the data plate for value besides.
         */}
      </group>
    </group>
  );
}

/* -------------------------------------------------------------------------- */
/* History chips                                                                */
/* -------------------------------------------------------------------------- */

function HistoryArtifact({
  index,
  artifactRef,
}: {
  index: number;
  artifactRef: (node: THREE.Group | null) => void;
}) {
  const era = gitEras[index];
  const palette = useMemo(
    () => createPaletteTexture(era.palette),
    [era.palette],
  );
  const label = useMemo(
    () => createTextTexture([era.label, era.visualLanguage], { size: 44 }),
    [era.label, era.visualLanguage],
  );

  return (
    <group
      onClick={(event) => {
        event.stopPropagation();
        setBenchSelection('history', index);
      }}
      onPointerEnter={(event) => {
        event.stopPropagation();
        setBenchHover('history', index);
      }}
      onPointerLeave={() => setBenchHover('history', -1)}
      position={HIDDEN.position}
      ref={artifactRef}
      scale={HIDDEN.scale}
    >
      {/*
       * Tight and narrow: six of these used to overlap into one airbrushed grey
       * cloud with no contact core anywhere in it. Sized to the stand footprint
       * (1.2 x 0.4) rather than to the card, and run at full strength so each
       * base gets a near-black line where it meets the bench.
       */}
      <ContactCore depth={0.66} opacity={0.9} width={1.42} />

      {/*
       * Slot fixture, same machined language as the phone stands, shortened
       * from 1.36 to 1.2 so neighbouring stands keep a visible gap instead of
       * intersecting end caps around frame centre.
       */}
      {/*
       * Value lifted into the same band as the phone stands and the Signals
       * blanks. At base ALUMINUM these six read as heavy black slabs marching
       * under otherwise light cards — the crudest geometry on the page — purely
       * because a 0.09-tall bar seen at 18° shows almost nothing but its own
       * unlit front wall.
       */}
      {/*
       * receiveShadow is off on purpose, and it is the fix for the stripe that
       * ran the length of the history run. The base's top face sits 0.005 under
       * the card foot standing on it and is very nearly parallel to the key, so
       * the depth comparison flipped across a shadow texel and laid a hard comb
       * of acne along all six bases. No bias value fixes a receiver that close
       * to its own occluder — it only trades the comb for peter-panning. The
       * groove below already supplies the darkening where the card meets the
       * bar, which is the only contact shadow this joint should have.
       */}
      <RoundedBox
        args={[1.2, 0.09, 0.4]}
        castShadow
        position={[0, 0.045, 0]}
        radius={0.018}
        receiveShadow={false}
        smoothness={3}
      >
        <AluminumMaterial
          color={ALUMINUM_BRIGHT}
          envMapIntensity={1.7}
          metalness={0.78}
          roughness={0.24}
        />
      </RoundedBox>
      {/*
       * Top-edge chamfer loop, the same treatment the laptop base gets: a thin
       * mirror band inset from both faces and 0.004 proud in x/z. Not a
       * ChamferBand — the stand lies thin-axis-up, and a band that grows in y
       * would put bright metal exactly where the stand meets the bench.
       */}
      {/* 0.0875, not 0.085: at 0.085 this loop's top face was exactly coplanar
          with the bar's, which is the other half of the banding. */}
      <RoundedBox
        args={[1.204, 0.01, 0.404]}
        position={[0, 0.0875, 0]}
        radius={0.005}
        smoothness={3}
      >
        <AluminumMaterial envMapIntensity={2.4} roughness={0.06} />
      </RoundedBox>

      {/*
       * An actual 0.02-deep groove: shadowed side walls, a dark floor, and the
       * card seated down into it. The card used to simply intersect the bar,
       * which reads as two parts occupying the same space.
       */}
      {/*
       * The banded comb that ran the length of all six stand bases was not
       * shadow acne — it was these two planes z-fighting the bar they sit on.
       * The lip was at 0.0908 against a top face at 0.0900 and a chamfer loop
       * whose top face is also 0.0900: eight ten-thousandths at the history
       * camera's 9-unit depth is inside the buffer's resolution, so the three
       * surfaces interleaved per pixel. The groove is now a clear 0.0035 proud
       * of both and sells its depth with value, the way every other recess in
       * this file does.
       */}
      <mesh position={[0, 0.0935, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.1, 0.09]} />
        <meshStandardMaterial color="#9a9c9e" metalness={1} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.0939, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.08, 0.07]} />
        <meshStandardMaterial color="#6e7174" metalness={0.6} roughness={0.7} />
      </mesh>

      <group position={[0, 0.06, 0]} rotation={[-0.14, 0, 0]}>
        <RoundedBox
          args={[1.06, 1.55, 0.05]}
          castShadow
          position={[0, 0.78, 0]}
          radius={0.02}
          smoothness={3}
        >
          <meshStandardMaterial
            color="#e9eaea"
            envMapIntensity={0.8}
            metalness={0}
            roughness={0.55}
          />
        </RoundedBox>
        {/*
         * Printed card stock, lit like card stock — not an unlit Keynote fill.
         * The 0.004 white lip around the swatch is what catches the overhead
         * softbox and stops the block reading as vertex colour on a primitive.
         */}
        <mesh position={[0, 0.95, 0.0262]}>
          <planeGeometry args={[0.928, 1.028]} />
          <meshStandardMaterial
            color="#f4f4f3"
            envMapIntensity={1.3}
            metalness={0}
            roughness={0.3}
          />
        </mesh>
        <mesh position={[0, 0.95, 0.0265]}>
          <planeGeometry args={[0.92, 1.02]} />
          <meshStandardMaterial
            envMapIntensity={0.9}
            map={palette}
            metalness={0}
            roughness={0.42}
          />
        </mesh>
        <mesh position={[0, 0.27, 0.0265]}>
          <planeGeometry args={[0.92, 0.32]} />
          <meshStandardMaterial
            map={label}
            metalness={0}
            roughness={0.6}
            transparent
          />
        </mesh>
      </group>
    </group>
  );
}

/* -------------------------------------------------------------------------- */
/* Scene                                                                        */
/* -------------------------------------------------------------------------- */

type CameraShot = {
  position: [number, number, number];
  look: number;
  fov: number;
  /**
   * Camera roll, radians. Under a degree and a half, and with opposing signs
   * between the frontal work plate and the portrait — enough that the four
   * views read as four exposures by the same hand rather than one rig at four
   * heights, but never enough to look like a dutch angle.
   */
  roll: number;
};

/**
 * Staged transition. A view change is not one move: the objects leaving are
 * dead weight the moment the heading changes, and the objects arriving are the
 * new subject. Outgoing runs at 4.6 and is gone in ~250ms; incoming runs at 2.6
 * and takes ~600ms to seat. The overlap is what makes a cut read as a change of
 * setup rather than a crossfade of two equally-important arrangements.
 */
const LAMBDA_OUT = 4.6;
const LAMBDA_IN = 2.6;

function transitLambda(target: Transform, reducedMotion: boolean) {
  if (reducedMotion) {
    return 80;
  }

  return target.scale <= HIDDEN.scale ? LAMBDA_OUT : LAMBDA_IN;
}

function dampTransform(
  group: THREE.Group,
  target: Transform,
  lambda: number,
  delta: number,
) {
  group.position.x = damp(group.position.x, target.position[0], lambda, delta);
  group.position.y = damp(group.position.y, target.position[1], lambda, delta);
  group.position.z = damp(group.position.z, target.position[2], lambda, delta);
  group.rotation.x = dampAngle(
    group.rotation.x,
    target.rotation[0],
    lambda,
    delta,
  );
  group.rotation.y = dampAngle(
    group.rotation.y,
    target.rotation[1],
    lambda,
    delta,
  );
  group.rotation.z = dampAngle(
    group.rotation.z,
    target.rotation[2],
    lambda,
    delta,
  );
  group.scale.setScalar(damp(group.scale.x, target.scale, lambda, delta));

  /*
   * A parked group still costs three draw calls per mesh every frame — main
   * pass, directional shadow pass, contact-shadow pass — so cull it once it has
   * finished shrinking away. It stays visible for the whole transit out.
   */
  group.visible =
    target.scale > HIDDEN.scale || group.scale.x > HIDDEN.scale * 1.05;

  return (
    Math.abs(group.position.x - target.position[0]) +
    Math.abs(group.position.y - target.position[1]) +
    Math.abs(group.position.z - target.position[2]) +
    Math.abs(group.scale.x - target.scale)
  );
}

/**
 * ContactShadows re-renders a full depth pass every frame. Gate it on the store
 * settle flag: dynamic while anything is still damping, then exactly one more
 * pass once the scene lands (drei resets its internal counter on re-render, so
 * flipping `frames` to 1 captures the settled pose and stops).
 *
 * ONE pass, not three. At 0.30 / 0.38 / 0.30 the old stack multiplied out to
 * ~0.70 effective alpha wherever the three overlapped, which is exactly the
 * near-black ellipse that appeared under the profile badge stand, and its three
 * differently-sized 10-unit planes cut visible straight terminators across the
 * bench — a diagonal behind the left laptop in work, horizontal value steps in
 * signals.
 *
 * The single survivor is not the soft body of the shadow: `far` at 0.5 means
 * only geometry within half a unit of the bench registers, so this supplies
 * tight contact occlusion and nothing else. The *directional* key at
 * [-6.5, 7, 3.2] is the sole grounding authority for shadow direction, so every
 * soft shadow in the set now travels the same way instead of a symmetric pool
 * disagreeing with a pale streak thrown to the right. `scale` 17 puts the plane
 * edge outside every frustum in the file, and the colour is a studio grey
 * rather than the default black — on a #d4d6d8 bench a black-cored shadow is
 * always going to read as a decal.
 */
function GroundShadows({ mobile }: { mobile: boolean }) {
  const settled = useSyncExternalStore(
    subscribeBenchSettled,
    readBenchSettled,
    readBenchSettled,
  );
  const frames = settled ? 1 : Infinity;

  return (
    <ContactShadows
      blur={1.8}
      color="#6b6e71"
      far={0.5}
      frames={frames}
      opacity={0.22}
      /* Offset along the key's ground vector so it agrees with the directional. */
      position={[0.22, 0.005, -0.1]}
      resolution={mobile ? 512 : 1024}
      scale={17}
    />
  );
}

function Scene({
  initialView,
  reducedMotion,
  mobile,
}: {
  initialView?: ConceptViewId;
  reducedMotion: boolean;
  mobile: boolean;
}) {
  const view = useConceptView(initialView);
  const projectTextures = useConfiguredTextures(
    featuredProjects.map((project) => project.image),
  );
  const projects = useRef<(THREE.Group | null)[]>([]);
  const projectMaterials = useRef<(THREE.ShaderMaterial | null)[]>([]);
  const blanks = useRef<(THREE.Group | null)[]>([]);
  const artifacts = useRef<(THREE.Group | null)[]>([]);
  const badge = useRef<THREE.Group | null>(null);
  const nameplate = useRef<THREE.Group | null>(null);
  const cameraLook = useRef(new THREE.Vector3());
  const cameraRoll = useRef(0);
  const transit = useRef({
    view: null as ConceptViewId | null,
    from: new THREE.Vector3(),
    control: new THREE.Vector3(),
    t: 1,
  });

  useFrame(({ camera }, rawDelta) => {
    const delta = Math.min(rawDelta, 1 / 30);
    const lambda = reducedMotion ? 80 : 3.2;
    const workFocus = readBenchFocus('work');
    const signalFocus = readBenchFocus('signals');
    const historyFocus = readBenchFocus('history');
    const pointer = readBenchPointer();
    let motion = 0;

    projects.current.forEach((project, index) => {
      if (!project) {
        return;
      }

      let target = HIDDEN;
      if (view === 'work') {
        const active =
          workFocus.hovered === index || workFocus.selected === index;
        const base = PROJECT_WORK[index];
        target = {
          position: [
            base.position[0],
            base.position[1] + (active ? 0.28 : 0),
            base.position[2] + (active ? 0.22 : 0),
          ],
          rotation: [
            base.rotation[0],
            base.rotation[1] * (active ? 0.45 : 1),
            base.rotation[2],
          ],
          scale: base.scale * (active ? 1.07 : 1),
        };
      } else if (view === 'profile') {
        target = PROJECT_PROFILE[index];
      } else if (view === 'signals') {
        target = PROJECT_SIGNALS[index];
      }
      motion = Math.max(
        motion,
        dampTransform(
          project,
          target,
          transitLambda(target, reducedMotion),
          delta,
        ),
      );

      const screenMaterial = projectMaterials.current[index];
      if (screenMaterial) {
        const blurTarget = view === 'profile' ? 4 : view === 'signals' ? 3 : 0;
        screenMaterial.uniforms.uBlur.value = damp(
          screenMaterial.uniforms.uBlur.value as number,
          blurTarget,
          lambda,
          delta,
        );
      }
    });

    blanks.current.forEach((blank, index) => {
      if (!blank) {
        return;
      }
      const active = signalFocus.hovered === index;
      const target =
        view === 'signals'
          ? {
              position: [
                (index - 1) * BLANK_SPACING,
                /*
                 * Seated on the bench: the tilt lift lives inside the blank,
                 * so the group itself rides at y 0 and the angle block's flat
                 * underside is what touches.
                 */
                active ? 0.34 : 0,
                /*
                 * Pushed back off the front lip so the whole run clears the
                 * DOM detail band by ~200 CSS and leaves the foreground strip
                 * for the nameplate.
                 */
                index === 1 ? -1.85 : -1.15,
              ] as [number, number, number],
              /* Roll trimmed to 0.03: any more visibly lifts a corner of the
                 angle block off the bench. */
              rotation: [0, (index - 1) * -0.16, (index - 1) * 0.03] as [
                number,
                number,
                number,
              ],
              scale: BLANK_SCALE * (active ? 1.09 : 1),
            }
          : HIDDEN;
      motion = Math.max(
        motion,
        dampTransform(
          blank,
          target,
          transitLambda(target, reducedMotion),
          delta,
        ),
      );
    });

    artifacts.current.forEach((artifact, index) => {
      if (!artifact) {
        return;
      }
      const active =
        historyFocus.hovered === index || historyFocus.selected === index;
      const offset = index - (gitEras.length - 1) / 2;
      const chipX = offset * HISTORY_SPACING;
      /*
       * One smooth arc, nothing else. The run used to carry a ±0.62 depth
       * stagger and ±0.12 rad of alternating yaw on top of the arc, which was
       * meant to read as a sequence in a room and instead read as jitter:
       * Scene, an even index, sat a full 0.62 forward of both its neighbours,
       * so it rendered lower and larger and the intended shallow arc broke into
       * an uneven line. Every card now shares an identical world y, and only z
       * and rotation.y vary — both as smooth functions of the arc.
       */
      const target =
        view === 'history'
          ? {
              position: [
                chipX,
                active ? 0.16 : 0,
                -(chipX * chipX) / (2 * HISTORY_ARC),
              ] as [number, number, number],
              rotation: [0, -chipX / HISTORY_ARC, 0] as [
                number,
                number,
                number,
              ],
              /* The focused era steps 1.12x clear of the run and becomes its hero. */
              scale: active ? 1.1 * 1.12 : 1.1,
            }
          : HIDDEN;
      motion = Math.max(
        motion,
        dampTransform(
          artifact,
          target,
          transitLambda(target, reducedMotion),
          delta,
        ),
      );
    });

    if (badge.current) {
      const badgeTarget: Transform =
        view === 'profile'
          ? {
              /*
               * Brought 3.7 units forward and up to 0.62 scale so the badge
               * commands the frame rather than standing in a grey room.
               *
               * Seated on the RIGHT third and turned a touch toward camera
               * left. The two subjects swapped thirds: on the left the card's
               * portrait window and top field row rendered at CSS x 465-660,
               * which is directly underneath the intro plate — the one part
               * of the frame the DOM owns outright. Camera-right of centre
               * the whole 1.18x1.77 portrait window stands on open bench.
               */
              position: [1.15, 0, -2.1],
              rotation: [0, -0.11, 0],
              /*
               * Scaled up with the pull-back, not shrunk by it: the card now
               * runs ~320 CSS of frame height inside the 66→520 window the
               * header and the DOM note band leave for it.
               */
              scale: 0.62,
            }
          : HIDDEN;
      motion = Math.max(
        motion,
        dampTransform(
          badge.current,
          badgeTarget,
          transitLambda(badgeTarget, reducedMotion),
          delta,
        ),
      );
    }

    if (nameplate.current) {
      const markTarget = NAMEPLATE_SEATS[view];
      motion = Math.max(
        motion,
        dampTransform(
          nameplate.current,
          markTarget,
          transitLambda(markTarget, reducedMotion),
          delta,
        ),
      );
    }

    const selectedProject =
      view === 'work' && workFocus.selected >= 0
        ? PROJECT_WORK[workFocus.selected]
        : null;
    const historyIndex =
      historyFocus.hovered >= 0
        ? historyFocus.hovered
        : historyFocus.selected >= 0
          ? historyFocus.selected
          : (gitEras.length - 1) / 2;
    const historyX =
      (historyIndex - (gitEras.length - 1) / 2) * HISTORY_SPACING * 0.7;
    const parallaxX = mobile || reducedMotion ? 0 : pointer.x * 0.34;
    const parallaxY = mobile || reducedMotion ? 0 : pointer.y * 0.18;

    /**
     * Four distinct lenses, not four heights of the same shot: work is the
     * tight frontal product plate, profile a slightly off-axis portrait, signals
     * a high plan, history a longer lens tracking laterally along the run.
     */
    /*
     * Mobile has no intro plate beside the cluster, so it keeps the camera on
     * the cluster centroid instead of the desktop lens's deliberate left bias.
     */
    const workCenterX = mobile ? 0.55 : WORK_CENTER_X;
    const shots: Record<ConceptViewId, CameraShot> = mobile
      ? {
          work: {
            position: [
              workCenterX,
              selectedProject ? 3.5 : 3.8,
              selectedProject ? 9.6 : 10.8,
            ],
            look: 0.85,
            fov: 34,
            roll: 0,
          },
          profile: { position: [0.8, 2.9, 7.4], look: 1.3, fov: 34, roll: 0 },
          signals: { position: [0, 5.2, 9.6], look: 0.2, fov: 38, roll: 0 },
          history: {
            position: [historyX, 4.4, 13.4],
            look: 0.9,
            fov: 30,
            roll: 0,
          },
        }
      : {
          work: {
            position: [
              workCenterX + parallaxX,
              selectedProject ? 2.1 : 2.25,
              selectedProject ? WORK_CAMERA_Z - 0.45 : WORK_CAMERA_Z,
            ],
            look: 0.55,
            fov: selectedProject ? 31 : 33,
            roll: 0.012,
          },
          /*
           * Portrait lens. The axis now runs straight down the middle of the
           * arrangement rather than being yawed camera-left to fling a
           * centred badge onto the right third: the subjects are staged in
           * world space instead — badge on the left third, nameplate on the
           * right third, both on the same ground line — so the frame is a
           * composition rather than one object plus a stray.
           */
          /*
           * Camera-right and lower, and a half unit closer. The badge now sits
           * on the right of the arrangement, so the lens moves with it: at
           * x 0.1 the card was pinned to frame centre under the intro plate and
           * the bulldog clip was sliced clean off by the 88px header. Aimed a
           * fifth of a unit higher and pulled to 6.15 the whole prop — clip,
           * swivel and all — clears the header and the card runs the right
           * two-thirds of the frame.
           */
          profile: {
            position: [0.85 + parallaxX * 0.4, 2.05, 6.15],
            look: 0.95,
            fov: 34,
            roll: -0.014,
          },
          /*
           * Signals drops from a ~29° plan to ~18°, so the blanks are read
           * across rather than looked down on. The engraved copy survives the
           * lower angle because the plates are seated on angle blocks.
           *
           * Down again to 2.15 and out to fov 36: at 2.6/33 the run's top edge
           * landed near CSS y 270 and the top third of every frame was blank
           * cove. The subject now starts around y 220 and fills the height it
           * is given.
           */
          signals: {
            position: [parallaxX, 2.15, 6.9],
            /*
             * The look target does the reclaiming, not the camera height. At
             * 0.45 the horizon sat at CSS y 287 and the run's top edge landed
             * right under it, so a third of the frame was blank cove no matter
             * how wide the lens went. Aimed at 0.12 the whole set — horizon and
             * subject together — rides ~70 CSS up the frame.
             */
            look: 0.12,
            fov: 36,
            roll: 0.006,
          },
          /* Same treatment: the era run climbs into the upper two-thirds. */
          history: {
            position: [historyX + parallaxX * 0.25, 2.85, 9.2],
            look: 0.8,
            fov: 36,
            roll: -0.008,
          },
        };
    const shot = shots[view];
    const targetX = shot.position[0];
    const targetY = shot.position[1] - parallaxY;
    const targetZ = shot.position[2];

    /*
     * Transits ride a quadratic Bezier whose control point is pushed out in +y
     * and +z from the midpoint, so the camera pulls back and arcs across rather
     * than sliding down a straight line. Departure is fast, arrival is slow.
     */
    const move = transit.current;

    if (move.view !== view) {
      if (move.view === null || reducedMotion) {
        move.t = 1;
      } else {
        move.from.copy(camera.position);
        move.control.set(
          (move.from.x + targetX) / 2,
          (move.from.y + targetY) / 2 + 1.1,
          (move.from.z + targetZ) / 2 + 2.4,
        );
        move.t = 0;
      }
      move.view = view;
    }

    if (move.t < 1) {
      const arc = 4.5 + (2.2 - 4.5) * move.t;
      move.t = damp(move.t, 1, arc, delta);

      if (move.t > 0.997) {
        move.t = 1;
      }

      camera.position.set(
        quadraticBezier(move.from.x, move.control.x, targetX, move.t),
        quadraticBezier(move.from.y, move.control.y, targetY, move.t),
        quadraticBezier(move.from.z, move.control.z, targetZ, move.t),
      );
      motion = 1;
    } else {
      motion = Math.max(
        motion,
        Math.abs(camera.position.x - targetX) +
          Math.abs(camera.position.y - targetY) +
          Math.abs(camera.position.z - targetZ),
      );
      camera.position.x = damp(camera.position.x, targetX, lambda, delta);
      camera.position.y = damp(camera.position.y, targetY, lambda, delta);
      camera.position.z = damp(camera.position.z, targetZ, lambda, delta);
    }

    const perspective = camera as THREE.PerspectiveCamera;
    const nextFov = damp(perspective.fov, shot.fov, lambda, delta);
    if (Math.abs(nextFov - perspective.fov) > 0.0008) {
      perspective.fov = nextFov;
      perspective.updateProjectionMatrix();
      motion = Math.max(motion, 0.01);
    }

    /*
     * The look axis rides the subject, not a fraction of it. `* 0.5` on the
     * work axis aimed camera-left of the camera's own x, which is what pushed
     * the four-device silhouette into the right 60% of the frame and left a
     * dead third under the intro plate.
     */
    const lookX =
      view === 'history'
        ? historyX
        : view === 'profile'
          ? mobile
            ? 0.15
            : 0.1
          : view === 'work'
            ? (selectedProject?.position[0] ?? workCenterX)
            : 0;
    cameraLook.current.x = damp(cameraLook.current.x, lookX, lambda, delta);
    cameraLook.current.y = damp(cameraLook.current.y, shot.look, lambda, delta);
    cameraLook.current.z = damp(cameraLook.current.z, 0, lambda, delta);
    camera.lookAt(cameraLook.current);

    /*
     * Roll last: lookAt rewrites the whole quaternion, so this has to be a
     * post-multiplied rotation about the camera's own forward axis. Damped on
     * its own axis so a transit rolls into the new lens instead of snapping.
     */
    cameraRoll.current = damp(cameraRoll.current, shot.roll, lambda, delta);
    camera.rotateZ(cameraRoll.current);

    setBenchSettled(motion < 0.004);
  });

  return (
    <>
      <color attach="background" args={[SET_GREY]} />
      {/*
       * Working fog. At 30/68 nothing in the set was inside the ramp — the
       * subjects sit 5–11 units out and the cove back is only ~20 — so the
       * backdrop and the bench held the same value and no device ever
       * separated from the set. 13/42 puts the cove a clear step behind.
       */}
      <fog attach="fog" args={[SET_GREY, 13, 42]} />
      <StudioEnvironment />
      {/*
       * Ambient and key are both trimmed for the NoToneMapping response: with
       * no ACES shoulder the previous 0.12 / 1.5 pair drove BENCH_TOP straight
       * into clip and the whole set rendered as white paper.
       */}
      <ambientLight intensity={0.07} />
      {/*
       * Frustum tightened to the working area actually in frame. The old
       * ±14 / +12..-12 box spread a 2048 map over 28 world units — 0.014 per
       * texel, far too coarse for contact darkening to survive. ±7 / 6..-3
       * doubles texel density for nothing.
       */}
      {/*
       * bias/normalBias rebalanced: at -0.0009 / 0.035 the two laptop chassis
       * laid a hard stair-stepped sawtooth of shadow acne into the gap between
       * them. Pushing the offset onto the *normal* instead of the depth value
       * kills the sawtooth without floating the contact away from the feet.
       *
       * Rebalanced again for the six history stand bases: their top faces are
       * near-coplanar with the shadow the card above throws onto them, so at
       * 0.05 / -0.0004 the depth comparison flipped back and forth across a
       * texel and laid a dark banded stripe down the run. The offset moves
       * further onto the normal (0.09) and off the depth value (-0.0002) —
       * self-shadow acne is a *normal*-space problem, and a deeper depth bias
       * only trades it for peter-panning at the feet.
       */}
      {/*
       * Key. Raised from 0.95: with a single directional at 0.95 over ambient
       * 0.07 and everything else coming off a normal-sampled cubemap, every
       * vertical face in the set held one flat value — there was no key/fill
       * ratio at all, only an average. This is a ratio change, not a relight:
       * same position, same light-grey studio palette.
       */}
      <directionalLight
        castShadow
        intensity={1.3}
        position={[-6.5, 7, 3.2]}
        shadow-bias={-0.0002}
        shadow-camera-bottom={-3}
        shadow-camera-far={22}
        shadow-camera-left={-7}
        shadow-camera-near={2}
        shadow-camera-right={7}
        shadow-camera-top={6}
        shadow-mapSize={mobile ? [1024, 1024] : [2048, 2048]}
        shadow-normalBias={0.09}
      />
      {/*
       * Fill, camera-right and slightly below the key's elevation, at roughly a
       * 4:1 ratio to it. Deliberately NOT a shadow caster: a second shadowing
       * light would double the depth passes and reintroduce exactly the crossed
       * shadow directions the contact pass was just collapsed to avoid. A
       * shadowless directional is free at the current budget, and it is what
       * gives the camera-right faces of every chassis, stand and blank a second
       * value to fall to.
       */}
      <directionalLight intensity={0.3} position={[5.5, 2.4, 4.5]} />

      <StudioCove />
      <BenchTop />
      <ShopMarks
        plateRef={(node) => {
          nameplate.current = node;
        }}
      />

      {featuredProjects.map((project, index) => (
        <ProjectDevice
          deviceRef={(node) => {
            projects.current[index] = node;
          }}
          index={index}
          key={project.title}
          materialRef={(node) => {
            projectMaterials.current[index] = node;
          }}
          project={project}
          texture={projectTextures[index]}
        />
      ))}

      <ProfileBadge
        badgeRef={(node) => {
          badge.current = node;
        }}
      />

      {experiments.map((experiment, index) => (
        <ExperimentBlank
          blankRef={(node) => {
            blanks.current[index] = node;
          }}
          index={index}
          key={experiment.number}
        />
      ))}

      {gitEras.map((era, index) => (
        <HistoryArtifact
          artifactRef={(node) => {
            artifacts.current[index] = node;
          }}
          index={index}
          key={era.commit}
        />
      ))}

      <GroundShadows mobile={mobile} />
    </>
  );
}

export function BenchScene({
  className,
  initialView,
  reducedMotion,
  mobile,
}: {
  className?: string;
  initialView?: ConceptViewId;
  reducedMotion: boolean;
  mobile: boolean;
}) {
  usePointerListener(setBenchPointer);

  return (
    <div className={className}>
      <Canvas
        camera={{
          far: 90,
          fov: 33,
          near: 0.1,
          position: [WORK_CENTER_X, 2.25, WORK_CAMERA_Z],
        }}
        dpr={[1, 1.75]}
        /*
         * NoToneMapping. ACES' shoulder was compressing the one thing on the
         * bench that is allowed to carry colour — Tyler's shipped UI — into
         * grey-on-grey; the iCalarms Settings capture read at roughly half its
         * real contrast. The screen shader's gain/lift and the aluminum
         * envMapIntensity values are re-balanced for the linear response.
         */
        gl={{
          alpha: false,
          antialias: true,
          toneMapping: THREE.NoToneMapping,
        }}
        onCreated={({ gl }) => {
          /*
           * An alpha:false context defaults clearAlpha to 1, which makes the
           * ContactShadows depth target clear to *opaque black* — the catch
           * shadow then paints a solid slab across the whole bench. The scene
           * background is a Color, so the main pass still clears opaque.
           */
          gl.setClearAlpha(0);
        }}
        onPointerMissed={clearBenchSelection}
        shadows
      >
        <Scene
          initialView={initialView}
          mobile={mobile}
          reducedMotion={reducedMotion}
        />
      </Canvas>
    </div>
  );
}

'use client';

import {
  ContactShadows,
  Environment,
  Lightformer,
  RoundedBox,
  useTexture,
} from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  Suspense,
  useLayoutEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react';
import * as THREE from 'three';
import {
  companyTags,
  experiments,
  featuredProjects,
  personalNotes,
  sideProjects,
  type CompanyTag,
  type ConceptViewId,
  type FeaturedProject,
  type SideProject,
} from '../conceptData';
import { useConceptView } from '../conceptViewStore';
import { exposeBenchDebug, isAblated } from './benchAblation';
import {
  damp,
  dampAngle,
  quadraticBezier,
  usePointerListener,
} from '../shared/runtime';
import {
  clearBenchGalleryPiece,
  clearBenchHistorySelection,
  clearBenchSelection,
  clearBenchSignalSelection,
  clearBenchTagSelection,
  closeBenchGallery,
  openBenchGallery,
  readBenchFocus,
  readBenchGallery,
  markBenchHistoryLive,
  readBenchHistory,
  readBenchPointer,
  readBenchSettled,
  readBenchSignals,
  readBenchTags,
  releaseBenchGallery,
  setBenchGalleryPiece,
  setBenchHistorySelection,
  setBenchHover,
  setBenchPointer,
  setBenchRenderInvalidator,
  setBenchSettled,
  setBenchSignalHover,
  setBenchSignalSelection,
  setBenchTagHover,
  setBenchTagSelection,
  subscribeBenchGallery,
  subscribeBenchHistory,
  subscribeBenchSettled,
  toggleBenchSelection,
} from './benchStore';
import { historyEras, historyShots } from './historyEras';

const INK = '#141517';
/*
 * Aluminum stock, lifted with the shell's drop. A metalness-1 surface has no
 * albedo — its colour is a tint on whatever the room hands it — so taking the
 * room down two stops without taking these up would have turned every chassis
 * into gunmetal. The three steps between them are what carry the machined
 * hierarchy now that the room no longer flattens them.
 */
const ALUMINUM = '#c9cbcd';
const ALUMINUM_DARK = '#a4a6a8';
const ALUMINUM_BRIGHT = '#e8eaec';
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
/*
 * Gallery high-key grade. The set is bright, but it is a *sweep*, not a field:
 * cove brightest at the horizon, bench a step under it, foreground darkest.
 * Every value below is the top of its own ramp — the painted falloffs and the
 * hemisphere gradient carry it down from there.
 */
/*
 * Down one more notch, and this half of the deepening is albedo rather than
 * light. Pulling the set's env share was the right first move — it takes the
 * flat ambient wash out and leaves the key's shaping intact — but measurement
 * says the cubemap is under a third of this surface's budget, so env alone
 * cannot move the bench far enough to stop being the least-transformed thing
 * in the frame. A ~6% cut in stock takes the rest without touching a single
 * light, so the sweep the falloffs paint arrives unchanged, one step lower.
 */
const BENCH_TOP = '#9fa2a5';
const BENCH_FLOOR = '#63666a';
/*
 * The bench front is now the darkest band in the frame, not a lighter strip
 * stacked on a darker one. Fascia, rail and understructure all resolve into a
 * single shadowed edge instead of three horizontal bars leaking at the corners.
 */
const BENCH_RAIL = '#6e7175';
/**
 * The set falls a full value step under the bench top rather than the ~19 codes
 * it used to, so a lid silhouette separates from the backdrop on value alone.
 * The cove *map* then lifts the horizon back up to near-paper — that lift is
 * what makes the sweep read as a lit cyclorama instead of a painted wall.
 */
const SET_GREY = '#9da1a5';
/*
 * The cove *stock* is near-paper; its map carries it from a deep upper wall to
 * a bright horizon. Base and map used to both be mid, which is how the backdrop
 * ended up living inside the same 20-code band as the bench and the chassis.
 */
const COVE_GREY = '#cfd3d7';
/**
 * How much of the studio cubemap the *set* is allowed to see, as opposed to
 * the machined bodies standing on it.
 *
 * This is the one dial that lets a bright gallery and a contrasty room coexist
 * in the same frame. A cubemap is sampled by normal alone, so the shell is an
 * ambient term: drop it far enough for aluminum to have somewhere to fall and
 * the bench, cove and fascia fall with it; keep it high enough for the set and
 * every chassis is flooded flat. Splitting the two is what buys real value
 * structure without a relight.
 *
 * The set keeps its own light — the hemisphere gradient and the key, neither of
 * which a metalness-1 surface can see — so what comes off here is the flat
 * ambient half of its budget, not its shape. Held at 0.55 rather than the
 * quarter a dark-editorial grade would take: measured, the cubemap is only
 * about 29% of the bench's total budget, so even zero here cannot take the set
 * a full half-stop down — and everything under ~0.35 buys almost no further
 * depth while flattening the cove's horizon lift, which is the one thing
 * holding the gallery sweep together.
 */
const SET_ENV = 0.42;
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
/**
 * How far the cyc's floor carries on past the tangent, forward under the bench
 * top. Buried — the bench plane runs 13.3 further forward than this — and its
 * only job is to give the tangent ring an up-facing neighbour on both sides so
 * the smoothed normals there stay vertical.
 */
const COVE_FOOT = 0.9;

/** Pitch of the six-card run this shot was composed for. */
const HISTORY_BASE_SPACING = 1.52;
/** Never tighter than this: below it the cards' own edges start touching. */
const HISTORY_MIN_SPACING = 1.34;
/** Shallow arc radius the history chips are laid on so the outer chips toe in. */
const HISTORY_ARC = 16;
/**
 * The run has to survive growing. scripts/update-history.mjs records a
 * provisional era whenever the repository drifts past the newest recorded one,
 * so the composition cannot be hard-tuned to six cards — a seventh at the
 * original pitch hangs half of the outermost card off both edges of the frame.
 *
 * Two moves in order, and only as far as each is needed: close the pitch up to
 * the floor above, then, if the run is still wider than the six-card shot
 * framed, pull the lens back by exactly the overflow. Six cards land on the
 * original numbers to the decimal.
 */
const HISTORY_SPACING = Math.max(
  HISTORY_MIN_SPACING,
  Math.min(
    HISTORY_BASE_SPACING,
    (5 * HISTORY_BASE_SPACING) / Math.max(1, historyEras.length - 1),
  ),
);
/** Half the run's footprint, card body included. */
const HISTORY_RUN_HALF = ((historyEras.length - 1) / 2) * HISTORY_SPACING + 0.6;
/** What the composed history lens frames at its own stand-off. */
const HISTORY_FIT_HALF = 2.5 * HISTORY_BASE_SPACING + 0.6;
const HISTORY_CAMERA_Z = 9.2 * Math.max(1, HISTORY_RUN_HALF / HISTORY_FIT_HALF);
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
/*
 * Re-centred from 0.35 with the tablet: the arrangement is no longer four
 * devices, it is a tablet at x −2, four devices, and a signature, and its
 * centroid moved camera-left with the tablet.
 */
const WORK_CENTER_X = 0.22;
/**
 * Camera distance for the work lens; the tighter value is the selected pose.
 * It was pulled in to 6.5 when the shot held four devices and 260 CSS of dead
 * bench on each side. It holds six subjects now spanning ~6.4 world units, and
 * at 6.5 the tablet ran off the left edge and the signature crowded the right;
 * 7.35 buys back the ~0.6 of world width the two new objects need without
 * giving the margins back to empty bench.
 */
const WORK_CAMERA_Z = 7.35;

/**
 * The display needs the world position and world normal of every fragment, not
 * just its uv: the sheen band and the Fresnel rim are both functions of the
 * view vector, and a highlight that does not move when the pointer parallax
 * swings the camera is the loudest tell that a render is not a photograph.
 * `cameraMatrix`-free — three supplies `cameraPosition` to every ShaderMaterial.
 */
/**
 * Cover glass. Two terms and nothing else: a Schlick Fresnel that decides how
 * much room the surface returns at this angle, and one window-shaped highlight
 * the studio's overhead softbox stands in for.
 *
 * The window is deliberately hard-ish edged and rectangular — a soft round
 * blob is what a screen-space "sheen" gives you, and it reads as haze. A shape
 * with corners reads as a reflection of a thing, which is what makes the panel
 * sit under glass instead of behind gauze.
 */
const GLASS_VERTEX_SHADER = `
  varying vec2 vUv;
  varying vec3 vView;
  varying vec3 vNorm;

  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vView = normalize(cameraPosition - world.xyz);
    vNorm = normalize(mat3(modelMatrix) * vec3(0.0, 0.0, 1.0));
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;
const GLASS_FRAGMENT_SHADER = `
  uniform float uSeed;

  varying vec2 vUv;
  varying vec3 vView;
  varying vec3 vNorm;

  void main() {
    float facing = clamp(dot(normalize(vNorm), normalize(vView)), 0.0, 1.0);
    /* Schlick, F0 ~0.04 for glass. Near zero face-on, near one at the edge. */
    float fresnel = 0.035 + 0.965 * pow(1.0 - facing, 5.0);

    /*
     * The window. Sheared in x by y so it rakes with the key rather than
     * hanging square, and slid by the caller's seed so no two displays in the
     * cluster carry the same reflection.
     */
    vec2 p = vUv - vec2(0.30 + uSeed * 0.12, 0.74);
    p.x += p.y * 0.55;
    /* Not \`half\` — that is a reserved word in GLSL ES and fails to compile. */
    vec2 extent = vec2(0.16, 0.085);
    vec2 d = abs(p) - extent;
    float edge = max(d.x, d.y);
    float window = 1.0 - smoothstep(-0.02, 0.045, edge);
    /* A hairline mullion, so the shape reads as a window and not as a card. */
    window *= 1.0 - 0.55 * (1.0 - smoothstep(0.0, 0.006, abs(p.x - 0.02)));

    /*
     * The sheet itself.
     *
     * Fresnel and one window are enough to say "there is glass here" at the
     * edges and in one corner, and nothing at all across the middle four-fifths
     * of a display — which is where a viewer actually looks, and why the panels
     * still read as decals printed on the bezel. Real cover glass always
     * carries a low, broad wipe of the room across it. This is that wipe: one
     * soft diagonal band raked with the key, peaking at under 3% so it lands as
     * a property of the surface and never as a mark on the content. Every value
     * under it survives — 3% of white on the darkest UI in the set lifts it by
     * about seven codes.
     */
    float diagonal = vUv.x * 0.58 + vUv.y * 0.81;
    float wipe =
      smoothstep(0.05, 0.55, diagonal) * (1.0 - smoothstep(0.62, 1.25, diagonal));

    float alpha = fresnel * 0.34 + window * 0.16 + wipe * 0.028;
    gl_FragColor = vec4(vec3(1.0), clamp(alpha, 0.0, 0.6));
  }
`;
/**
 * The bench's own return, faked as a card lying on it.
 *
 * A bead-blasted work top is not a mirror, but it is not a sheet of paper
 * either: stand anything on one under a studio rig and the last centimetre in
 * front of it carries a smeared, mostly unreadable ghost of whatever is
 * standing there. The set had none — every object met the surface with a
 * contact shadow and nothing else, which is what made the bench read as a
 * printed backdrop the props were pasted onto.
 *
 * A real reflection pass is a second render of the whole set and is not worth
 * one frame of this budget. This is the card version: a plane on the bench
 * immediately in front of the object, reading the source mirrored in v, blurred
 * harder the further the ray has travelled, and faded out inside a short
 * distance of the contact line. Additive, so it can only ever lift the surface
 * — a reflection that darkens is a shadow, and the shadows are already drawn.
 */
const REFLECTION_VERTEX_SHADER = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const REFLECTION_FRAGMENT_SHADER = `
  uniform sampler2D uTexture;
  uniform vec2 uRepeat;
  uniform vec2 uOffset;
  uniform vec3 uTint;
  uniform float uOpacity;
  uniform float uMapped;

  varying vec2 vUv;

  void main() {
    /* v = 1 at the contact line, 0 at the far end of the smear. */
    float run = clamp(vUv.y, 0.0, 1.0);
    vec3 tone = uTint;

    if (uMapped > 0.5) {
      /*
       * Mirrored: the bench sees the foot of the object at the contact and
       * progressively more of its face further out. Five taps, and the kernel
       * widens with distance because a rough surface scatters a reflected ray
       * more the longer it travels — which is also why the far end of the smear
       * has to be unreadable, not just faint.
       */
      float spread = 0.015 + 0.2 * (1.0 - run);
      vec3 sum = vec3(0.0);

      for (int tap = -2; tap <= 2; tap += 1) {
        float step = float(tap) * spread * 0.5;
        vec2 source = clamp(
          vec2(vUv.x + step * 0.35, (1.0 - run) + step),
          0.0,
          1.0
        );
        sum += texture2D(uTexture, source * uRepeat + uOffset).rgb;
      }

      tone = sum * 0.2;
    }

    /* Short: gone within about a third of the card's own run. */
    float fade = pow(run, 2.6);
    float feather =
      smoothstep(0.0, 0.14, vUv.x) * smoothstep(0.0, 0.14, 1.0 - vUv.x);
    gl_FragColor = vec4(tone * uOpacity * fade * feather, 1.0);
  }
`;
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
/*
 * Restaged. Two products were being read through each other.
 *
 * The Charades phone stood at x 1.6 with the Med Negotiate laptop behind it at
 * x 2.12 — 0.5 of lateral offset against a phone half a unit wide, so at every
 * pose in the parallax range the phone bisected the laptop's display and
 * neither product could be read. It moves out to 2.98 and forward, which puts
 * it in the gap *beside* the laptop rather than in front of it, and yaws
 * further inboard so it still addresses the lens.
 *
 * With that seat vacated the near-left phone comes inboard to 0.32 — the shot
 * had a dead corridor straight down the middle of the frame, which is where
 * the eye went instead of to the products on either side of it.
 */
/*
 * Two tangencies closed, both of them the same defect at different scales: a
 * silhouette edge landing within a few pixels of another one, which reads as a
 * merge rather than as either an overlap or a gap.
 *
 * The centre phone's top edge was arriving 9px under the left MacBook's lid
 * line — two near-horizontal edges of similar value, so the eye could not tell
 * whether the phone stood in front of the deck or grew out of the hinge. It
 * comes down a size and forward, which drops its crown clear onto the black
 * keyboard well: the separation is now a value contrast rather than a hairline,
 * and it triples the gap.
 *
 * The Charades phone had the mirror problem on both sides at once. Its left
 * edge sat 4px off the right MacBook's chassis edge, and its right edge stood
 * ~95px from the frame — an accent pressed against the border of the picture
 * with a tangency behind it. Bringing it inboard fixes both: the frame margin
 * roughly doubles, and the 4px kiss becomes a decisive overlap the depth
 * stagger (z 0.86 against the laptop's −1.82) reads unambiguously.
 */
const PROJECT_WORK: Transform[] = [
  { position: [-0.3, 0, 0.9], rotation: [0, 0.3, 0], scale: 0.55 },
  { position: [-1.06, 0, -2.55], rotation: [0, 0.32, 0], scale: 0.68 },
  { position: [2.0, 0, -1.82], rotation: [0, -0.3, 0], scale: 0.66 },
  { position: [2.46, 0, 0.86], rotation: [0, -0.5, 0], scale: 0.57 },
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

/**
 * Signals: the devices leave frame entirely rather than clipping mid-body.
 *
 * Out from ±6 to ±9.4, which is a consequence of the focus lens. Opening a
 * signal swings the camera around that plate's own normal, and from the left
 * plate's axis the ±6 park was 22° off centre — a stray iPhone floated into the
 * top-left of the record shot. At ±9.4 every park is outside the widest of the
 * four setups by a clear margin.
 */
const PROJECT_SIGNALS: Transform[] = [
  { position: [-9.4, 0, -2.4], rotation: [0, 0.5, 0], scale: 0.4 },
  { position: [-9.6, 0, 1.4], rotation: [0, 0.6, 0], scale: 0.4 },
  { position: [9.6, 0, 1.4], rotation: [0, -0.6, 0], scale: 0.4 },
  { position: [9.4, 0, -2.4], rotation: [0, -0.5, 0], scale: 0.4 },
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
/*
 * Charades is the one saturated object on a monochrome bench, and it was also
 * the brightest — a full-bleed magenta/cyan card deck running at the same gain
 * as the grey UI around it, which made it the subject of a shot it is meant to
 * accent. Half a stop off (1.05 → 0.74) leaves it unmistakably the colour note
 * and stops it out-shouting four other products.
 */
const SCREEN_GAINS = [1.05, 1.03, 0.92, 0.74];

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
  /*
   * The LEFT screen of the App Store composite — "Rules & Calendars" — not the
   * right-hand Settings one.
   *
   * The front phone is at the visual centre of the work composition and it is
   * one of only four shipped products, and it was displaying a near-empty
   * settings list: Permissions, Notifications, Default Sound, Version 1.0.0.
   * That is the least characteristic screen the app has, it carries no product
   * story, and as a near-pure-white rectangle it was also the brightest 3D
   * surface in the frame. The DOM card beside it promises "configurable alarm
   * rules"; this screen is those rules — connected calendars, per-calendar
   * alarm enables, lead time, snooze.
   *
   * The window stops at 678 because the middle screen of the composite
   * overlaps this one from 680, and it is cut to the display's own 1:2 so the
   * cover fit has nothing left to trim off the nav title.
   */
  iCalarms: { x: 372 / 1600, y: 168 / 900, w: 306 / 1600, h: 612 / 900 },
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
  /*
   * Left-anchored, and only in x — no crop in y.
   *
   * The capture is 16:9 and the modeled MacBook display is 16:10, so the cover
   * fit takes a 1.6 slice out of a 1.78 source and has to drop a tenth of the
   * width. Centred, that came off both edges: the headline starts at 2.8% and
   * the crop started at 5.1%, so the largest colour surface in the work view
   * read "gotiate medical / lls with clarity" — chopped words, at rest and at
   * tag-zoom framing alike.
   *
   * Anchoring the window at the left edge spends the whole tenth on the right
   * instead, where the sign-in form ends at 88% and everything past it is
   * margin. Nothing is lost and the headline is whole.
   */
  'Med Negotiate': { x: 0, y: 0, w: 0.9, h: 1 },
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
  Decagon: { file: 'decagon.svg', aspect: 147 / 32 },
  UCLA: { file: 'ucla.svg', aspect: 250 / 81.851547 },
};

/**
 * The shop's signature: who the work was done between runs at.
 *
 * Three earlier attempts are worth stating, because this rack is the answer to
 * all of them. First a freestanding trophy placard — a prize, not a marking.
 * Then one insert per mark laser-cut flush into the bench, which read at 71° off
 * axis under the work lens and were, correctly, called illegible. Then one
 * canted plate carrying every mark together: legible at last, and a single
 * object where there are distinct places.
 *
 * So the marks come apart into four hanging spec tags on one rail. They are
 * still a group — one rail, one baseline, one plate size, the run's own order
 * with the credential last — but each is now a discrete thing that can be
 * pointed at, swung, and opened. A tag hanging vertically also solves the
 * legibility problem outright: its face normal is horizontal, and the work lens
 * rakes down only ~13°, so every mark is read within cos 0.97 of face-on.
 *
 * The rail hangs on two hairline drops that leave the top of the frame. That is
 * deliberate rather than lazy: every seat on this bench that could carry a post
 * is either a shipped product's or lands the post across a product's display,
 * and the one clear band in the work frame — above the laptop lids, right of
 * the intro veil — has no floor under it to stand on.
 */
const TAG_W = 0.62;
const TAG_H = 0.31;
/*
 * 0.052, not 0.03. The plates were reading as UI decals pinned to the wall
 * rather than as machined stock hanging in front of it, and the largest single
 * cause was that they had no measurable thickness — at 0.03 the top and bottom
 * edges resolved to well under a pixel at the work lens, so the object had a
 * face and no body. Thick enough now that the lit top edge and the shaded
 * bottom edge are both visible bands.
 */
const TAG_T = 0.052;
/** Centre-to-centre across the rail. */
const TAG_PITCH = 0.74;
/** Punched hole, measured down from the plate's top edge. */
const TAG_HOLE_INSET = 0.05;
const TAG_HOLE_R = 0.017;
/**
 * Pivot depth below the rail: hairline drop, then the ring the plate hangs on.
 *
 * 0.125, down from 0.17, and the 0.045 is bought for the plate's *lower* edge.
 * At the resting work pose the Scale plate's bottom measured 18 CSS px above
 * the centre MacBook's lid line — the round-1 move closed an actual overlap
 * here, and what it left behind was a near-miss, which is the same defect one
 * step down: two near-horizontal edges of similar value close enough to read as
 * one band, so the depth between the row and the machine collapsed. Shortening
 * the drop lifts the plates ~8.5 px and takes the gap to ~27 without touching
 * the seat, so the rail stays where it is and nothing new arrives at the top of
 * the frame. Both parallax extremes were already far looser than the resting
 * pose (64 and 74 px); this is the tight case getting the room.
 */
const TAG_DROP = 0.125;
const TAG_RING_R = 0.028;
/**
 * Half the rail's run, and it is a set-dressing number rather than a fit.
 *
 * At 1.95 the bar stopped just inside the right edge of the work frame and
 * showed its end cap floating in mid-air over the bench — a rail that
 * terminates inside the picture is a prop lying on a table, not a fixture bolted
 * to a room. It has to leave the frame at both ends at every aspect the desktop
 * lens runs, and the rack scales down as the viewport narrows (see fitWorkRack),
 * so the length is set for the worst case: at fit 0.6 this still puts both ends
 * a comfortable margin outside the widest frame the shot can produce.
 *
 * The end caps ride out with it and are never seen; they stay because they are
 * what makes the object a length of stock with ends rather than an infinite bar.
 */
const TAG_RAIL_HALF = 7.6;
const TAG_RAIL_R = 0.016;
/** Drop wires, long enough to leave the top of the work frame (y 2.76 at z −1). */
const TAG_WIRE_X = 1.85;
const TAG_WIRE_LEN = 1.0;

/**
 * Satin plate stock, and the value it lifts to when a tag is live.
 *
 * #c8cacc sat within a couple of codes of the cove behind it, so the row had no
 * silhouette at all — four marks floating on the wall, which is exactly the
 * decal read. The stock goes up to near-paper and the cove has come down, so
 * the plates now clear the backdrop by a full value step in the direction a
 * bright metal object should: brighter than what is behind it.
 */
const TAG_PLATE = '#f2f4f6';
const TAG_PLATE_LIVE = '#ffffff';
const TAG_PLATE_COLOR = new THREE.Color(TAG_PLATE);
const TAG_PLATE_LIVE_COLOR = new THREE.Color(TAG_PLATE_LIVE);

/**
 * Every mark is set to one width rather than one cap height — four plates of
 * identical size want four marks of identical measure, and a shared height
 * would have left the 5.3:1 Scale lockup twice as long as the 3.1:1 UCLA one.
 * The height cap catches the squarest mark so nothing overruns the plate.
 */
const TAG_MARK_W = 0.48;
const TAG_MARK_MAX_H = 0.14;
const TAG_MARK_Y = -0.035;
/** Pigment in the channel — the page's ink, so a mark can never read tinted. */
const TAG_MARK_INK = '#26282a';
/**
 * Optical trim, applied on top of the geometric fit.
 *
 * Setting four marks to one measure is the right *construction* rule and the
 * wrong *optical* one, because a mark's weight on the plate is the ink it
 * covers, not the box it fits in. Measured over the plate faces in the work
 * shot, the company marks cover 8.8–14.6% of the card and the UCLA block covers
 * 16.0% at the darkest average ink in the set — it is also the squarest lockup
 * in the row, so it is the only one that hits `TAG_MARK_MAX_H` and gets the
 * full height as well. The result was a row of employers with the school
 * shouting at the end of it.
 *
 * 0.87 uniform, which is a scale and never a squash: `EtchedMark` still derives
 * width from the manifest aspect, so the mark keeps its own proportions and
 * only its area comes down — to ~12%, which is the ramp lockup, the mid-weight
 * of the row and the one this was judged against.
 */
const TAG_MARK_TRIM: Record<string, number> = { UCLA: 0.84 };

function tagMarkHeight(mark: string) {
  const source = LOGO_SOURCES[mark];
  const fitted = Math.min(
    TAG_MARK_MAX_H,
    TAG_MARK_W / (source ? source.aspect : 3),
  );

  return fitted * (TAG_MARK_TRIM[mark] ?? 1);
}

/**
 * Hover / focus response, all of it damped or sprung — there is no keyframe
 * anywhere in the rack.
 *
 * The swing is an actual second-order spring rather than another exponential
 * damp, because a tag on a ring is a pendulum and a pendulum overshoots. At
 * stiffness 110 / damping 14 the ratio is ζ ≈ 0.67: one small overshoot, gone
 * in about half a second, and dead still after. Anything lighter reads as a
 * cartoon swing; anything heavier is just a rotation.
 *
 * It pivots at the RAIL, not at the ring, and that is the whole of the "lift".
 * An earlier pass translated the plate up and forward on hover and left the
 * ring behind, which at focus range opened a visible gap between a tag and the
 * thing holding it. Swinging the entire hanger about the bar it hangs on gives
 * the same read for free: the plate rises L(1 − cos θ) and travels L sin θ
 * toward the lens, and the cord and ring come with it because they are the
 * same object.
 */
const TAG_SWING_HOVER = -0.3;
const TAG_SWING_SELECTED = -0.12;
const TAG_SPRING_STIFFNESS = 110;
const TAG_SPRING_DAMPING = 14;

/**
 * Value response. One signed channel: +1 is the live tag, −1 is a tag standing
 * down while one of its neighbours is open. Nothing moves for the recede — a
 * hanging plate that steps back leaves its own cord behind — so the row makes
 * its hierarchy out of value alone, the way a lighting setup would.
 *
 * The stand-down is held to about half a stop. At #b0b2b4 against a #c8cacc
 * live plate the gap was wide enough that the row stopped reading as one set
 * of four identical plates under one key and started reading as card stock
 * next to acetate — siblings apparently made of different materials, which is
 * the one thing a signature row may not do.
 */
const TAG_PLATE_DIM = '#bec0c2';
const TAG_PLATE_DIM_COLOR = new THREE.Color(TAG_PLATE_DIM);

/**
 * Rest pose per tag. Four plates hung dead flat and dead parallel is the one
 * arrangement no real rail ever produces: each ring seats a little differently
 * and each plate finds its own face. A degree or two of yaw is enough to give
 * every plate its own value off the same cubemap — which is what stops the row
 * reading as one wide decal — and far too little to break the group.
 */
/*
 * The spread is capped at ±0.035 rather than ±0.05. Measured off the rendered
 * plates the row was running a 9-value spread face to face — Scale at L196 and
 * brightest plate at L205 — and at that width the jitter has stopped being "each ring
 * seats a little differently" and started reading as plates of different stock.
 * Tightened, the same four angles still give every plate its own value off the
 * cubemap, inside about a 4-value band.
 */
const TAG_REST_YAW = [0.032, -0.026, 0.017, -0.03];
const TAG_REST_ROLL = [-0.011, 0.007, -0.005, 0.013];

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

  /*
   * Non-square, and wide in the direction the brushing runs. The grain is a
   * stack of 1px horizontal lines, so every texel of vertical resolution buys
   * a distinct scratch while every texel of horizontal resolution buys
   * nothing but memory. 1024x512 at repeat (2,1) puts roughly twice as many
   * resolvable passes across a deck as the old 512² at repeat (3,1) did, and
   * anisotropy 16 is what keeps them from averaging into a flat grey the
   * moment the surface tips away from the lens.
   */
  const width = 1024;
  const height = 512;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');

  if (context) {
    /*
     * Near-white base, because roughnessMap *multiplies* material.roughness —
     * a mid-grey fill would silently halve every roughness value in the file
     * and turn satin aluminum into chrome. The grain lives in the streaks.
     */
    context.fillStyle = '#f2f2f2';
    context.fillRect(0, 0, width, height);

    /*
     * The fine pass: dense, low-contrast hairlines. On their own these are
     * film grain — they modulate the lobe everywhere by a little and read as
     * noise rather than as a finish. They are the substrate the coarse pass
     * below is cut into.
     */
    for (let line = 0; line < 1400; line += 1) {
      const y = Math.floor(Math.random() * height) + 0.5;
      const alpha = 0.06 + Math.random() * 0.14;
      const polish = Math.random() > 0.5;
      context.strokeStyle = polish
        ? `rgba(255,255,255,${Math.min(1, alpha * 1.9)})`
        : `rgba(0,0,0,${alpha})`;
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(width, y);
      context.stroke();
    }

    /*
     * Coarse tool scores: the marks that read as machining rather than as
     * grain. A real brushed unibody has a dozen or so passes wide enough and
     * deep enough to catch a raking source individually — and it is those,
     * not the hairlines, that a viewer resolves as "brushed" when the lens
     * sweeps and a bright bar walks across the deck one score at a time.
     */
    for (let score = 0; score < 34; score += 1) {
      const y = Math.floor(Math.random() * height) + 0.5;
      const deep = Math.random() > 0.45;
      /*
       * Halved. At 0.34/0.55 with a 3px pen these scores were wide enough and
       * dark enough to survive minification as individual bars, so any face
       * that turned toward the lens showed them as stripes — corrugation, not
       * a finish. The brushing is meant to live in the anisotropic lobe the
       * material stretches along the grain; the map only has to give that lobe
       * something to break on. At this contrast it does that and resolves to an
       * even sheen the moment the face is more than a hand's width away.
       */
      context.strokeStyle = deep
        ? 'rgba(0,0,0,0.17)'
        : 'rgba(255,255,255,0.28)';
      context.lineWidth = 1.2 + Math.random() * 0.9;
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(width, y);
      context.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 1);
  texture.anisotropy = 16;
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
  texture.repeat.set(1, 2);
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
  /*
   * 7x8, not 3x4. The blank now meets the lens nearly square instead of at a
   * 15° rake, and at the old pitch the crosshatch resolved into a coarse
   * checkerboard the size of the type next to it — it read as a transparency
   * grid, not as a datum etch.
   */
  texture.repeat.set(7, 8);
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
/**
 * Deepest the pool goes, as a fraction of peak, out at the far corners.
 *
 * Raised with the foreground ramp's arrival. The pool used to be the only
 * shaping term, so it had to be deep enough to carry the whole falloff on its
 * own — and it paid for that by dropping the bench's *far* edge to L159 under
 * a cove junction at L238. The near ramp now owns the near end, which frees
 * this to sit high enough that the far edge meets the cyc without a step.
 */
const BENCH_POOL_FLOOR = 0.68;
/**
 * Ceiling on the pool, and the fix for the one thing this grade still had
 * inverted.
 *
 * The map's peak used to be pure white, which made the patch of empty bench
 * directly under the device cluster the single brightest large region in the
 * frame — measured at L233, above the laptop chassis standing on it and level
 * with the screens. A key pool is allowed to be the brightest part of the
 * *set*; it is not allowed to out-value the subject. Capping the peak at 0.9
 * and dropping the floor with it keeps the same ~25% sweep from cluster to
 * frame edge while putting the whole ramp a step under the hardware.
 */
const BENCH_POOL_PEAK = 0.9;
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
/*
 * Deepened and tightened for the wider lenses. The work shot sees ~7 units of
 * bench and the pool shapes all of it, but profile and history stand further
 * off and show 14 — out there the pool has long since bottomed out and the
 * frame was 60% one flat plateau, which is exactly the wash this direction has
 * to beat. 24% over ~6 units keeps falling where the pool has stopped.
 */
/*
 * Deepened again, 0.19 → 0.26, for the profile lens specifically. Profile is
 * the flattest of the four views — it stands furthest off, sees the widest
 * span of bench and holds the smallest subject, so it is the one frame where
 * the pool has bottomed out across almost everything visible and the only
 * shaping left is this term. A third more depth is a visible corner falloff
 * out there and still under a code value per unit in the work shot, where the
 * pool is doing the work.
 */
const BENCH_EDGE_SIGMA_X = 6.5;
const BENCH_EDGE_SIGMA_Z = 6;
const BENCH_EDGE_DEPTH = 0.26;
/**
 * The baked joint in the bench top: how deep the darkening goes at its centre,
 * and how far it feathers out either side of BENCH_SEAM_Z.
 *
 * 3.5% over ±0.09 world units. Two shop plates butted together do leave a line,
 * but the line is a shadow a hair wide, not a value break — the whole point of
 * replacing the modeled seam was to get its contrast down inside the 1-2% step
 * the rest of the sweep holds to, and at this sigma the steepest adjacent texel
 * pair across it comes in under that.
 */
const BENCH_SEAM_DEPTH = 0.035;
const BENCH_SEAM_SIGMA = 0.09;
/**
 * The foreground ramp — the third band of the gallery sweep.
 *
 * Bright cove, mid bench, dark foreground. The pool alone cannot deliver that:
 * it is radially symmetric, so the near lip and the far lip come back at the
 * same value and the frame reads as one plateau with a soft vignette. This term
 * is one-sided in z, running from untouched at the pool centre to a hard 0.55
 * of reflectance by the bench's front lip. It also does the corner-banding work
 * from the other direction: with the near bench already the darkest band in the
 * frame, the fascia and the rail have nothing lighter to stack against.
 */
const BENCH_NEAR_START = -0.6;
const BENCH_NEAR_FLOOR = 0.55;

/**
 * Roughness variation for the bench top.
 *
 * The working surface is ~40% of every frame and it was one constant roughness
 * across all of it, which is the definition of a fill: no raking light can find
 * a surface that has nothing to find. This is a handful of superposed sine
 * lobes at very long wavelengths — deliberately too broad to resolve as a
 * texture, wide enough that a hand-finished top reads as *finished* rather than
 * as a value. Multiplied against material.roughness, so it is ±0.06 either way.
 */
let benchSheen: THREE.Texture | null = null;

function getBenchSheen() {
  if (benchSheen) {
    return benchSheen;
  }

  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');

  if (context) {
    const image = context.createImageData(size, size);

    for (let py = 0; py < size; py += 1) {
      const v = (py + 0.5) / size;

      for (let px = 0; px < size; px += 1) {
        const u = (px + 0.5) / size;
        const wave =
          Math.sin(u * 5.1 + 0.7) * 0.5 +
          Math.sin(v * 3.3 - 1.2) * 0.32 +
          Math.sin((u + v) * 8.4) * 0.18;
        const value = Math.round(230 + wave * 22);
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
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  benchSheen = texture;
  return texture;
}

/**
 * Fascia falloff — the last few values of the sweep, below the bench lip.
 *
 * Without it the front reads as banding rather than as an edge. The rail's own
 * underside is the darkest line in the frame at L76, which is correct — it is
 * the shadowed undercut, and it is the single edge M6 asks the bench front to
 * resolve into. But a *flat* fascia under it at L125 makes that line a stripe:
 * dark bar, light bar, dark bar. Starting the fascia just under the undercut
 * and letting it keep falling turns the same three values into one continuous
 * shadow side running off the bottom of the frame.
 */
let fasciaFalloff: THREE.Texture | null = null;

function getFasciaFalloff() {
  if (fasciaFalloff) {
    return fasciaFalloff;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 64;
  const context = canvas.getContext('2d');

  if (context) {
    /* Canvas y=0 is uv v=1 — the top of the fascia, up against the rail. */
    const gradient = context.createLinearGradient(0, 0, 0, 64);
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(0.35, '#e0e0e0');
    gradient.addColorStop(1, '#b2b2b2');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 4, 64);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  fasciaFalloff = texture;
  return texture;
}

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
      /*
       * One-sided, and smoothstepped rather than linear so the ramp has no
       * visible start line where it leaves the pool. Encoded through the sRGB
       * gamma for the same reason the edge term is: this canvas is sampled as
       * an sRGB map, so a raw multiply here would land ~2x deeper than asked.
       */
      const nearT = THREE.MathUtils.clamp(
        (worldZ - BENCH_NEAR_START) / (BENCH_FRONT_Z - BENCH_NEAR_START),
        0,
        1,
      );
      const near = Math.pow(
        1 - (1 - BENCH_NEAR_FLOOR) * nearT * nearT * (3 - 2 * nearT),
        1 / 2.2,
      );
      /*
       * The joint in the top, baked here rather than modeled.
       *
       * It used to be a 0.002-tall box laid across the bench at BENCH_SEAM_Z.
       * That box carried no falloff map, so while the plane around it was being
       * multiplied down to ~0.78 by the pool and edge terms, the seam rendered
       * at its own flat colour — and a strip that ignores the grade the whole
       * surface is under does not read as a joint, it reads as a lit wire. It
       * measured a 20-value spike at the left of frame and a 22-value one at
       * the right: the crisp full-width horizon the cove work had otherwise
       * closed. Baked into the falloff it is in the same value space as
       * everything around it by construction, and it can be feathered, so the
       * largest step across it is under 1%.
       */
      const seam = Math.pow(
        1 -
          BENCH_SEAM_DEPTH *
            Math.exp(-(((worldZ - BENCH_SEAM_Z) / BENCH_SEAM_SIGMA) ** 2)),
        1 / 2.2,
      );

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
          255 *
            (BENCH_POOL_FLOOR + (BENCH_POOL_PEAK - BENCH_POOL_FLOOR) * pool) *
            edge *
            near *
            seam,
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
    gradient.addColorStop(0, '#34373a');
    gradient.addColorStop(0.45, '#55585c');
    gradient.addColorStop(0.72, '#74777b');
    gradient.addColorStop(0.88, '#8b8e92');
    gradient.addColorStop(0.96, '#8f9295');
    /*
     * The junction value is not a free choice: it has to land on the value the
     * bench top renders at its far edge under the same fog, or the horizon
     * shows as a hard step across the whole frame instead of the seamless cyc
     * sweep the cove geometry exists to provide. With the key pool retuned the
     * bench's far edge now renders a value step darker than BENCH_TOP, so the
     * junction stop came down with it — and again with the ~14% the bench top
     * lost to put the subject back on top of the value range.
     *
     * Measured, not guessed. At a full-white junction stop the cove rendered
     * L238 against a bench far edge of L159 — a 79-value cliff straight across
     * the frame, the exact hard horizon this stop exists to prevent, just
     * inverted from the old one. #b6b9bc lands the junction within a few
     * values of the bench edge under the same fog, so the sweep closes.
     *
     * Re-measured, and it no longer does — deliberately left. Across the whole
     * frame the junction now reads cove 174–181 over bench 141–154, a step of
     * 30–33 values landing in two pixels (largest adjacent step 9.0–9.9%), and
     * it is the same magnitude at the left of frame as at the right. It is a
     * step, not a trough: the cove ramp above it is monotonic to within 1.3
     * values over 190 px and the bench below it is flat to within 2 over 20,
     * so there is nothing local to feather. Closing it means moving one of the
     * two whole surfaces by 30 values — lifting the far bench puts the top
     * third back to blank paper, and dropping this stop makes a cyc that gets
     * darker where it meets the lit bench. What the step actually reads as is
     * the far edge of a table against a lit backdrop, which is what it is.
     */
    gradient.addColorStop(1, '#989b9e');
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

  /*
   * The foot runs on past the tangent before it drops.
   *
   * The profile used to turn the corner and fall straight to −2 from the same
   * vertex the arc ends on, which means that vertex was shared between a
   * face pointing up and a face pointing at the lens. computeVertexNormals
   * averages at a shared vertex, so the very last ring of the sweep came back
   * with a normal tipped forward and rendered a ~12-value trough — a soft dark
   * line across the whole frame exactly where the cyc is supposed to become
   * invisible. Continuing the floor 0.9 forward, under the bench top where
   * nothing can see it, gives the tangent ring two up-facing neighbours and the
   * trough closes.
   */
  const shape = new THREE.Shape();
  shape.moveTo(-COVE_FOOT, -2);
  shape.lineTo(COVE_BACK, -2);
  shape.lineTo(COVE_BACK, COVE_HEIGHT);
  shape.lineTo(COVE_RADIUS, COVE_HEIGHT);
  shape.lineTo(COVE_RADIUS, COVE_RADIUS);
  shape.absarc(0, COVE_RADIUS, COVE_RADIUS, 0, -Math.PI / 2, true);
  shape.lineTo(-COVE_FOOT, 0);
  shape.lineTo(-COVE_FOOT, -2);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: false,
    /*
     * 30, not 18. The sweep's whole job is that the eye cannot find the join
     * between the floor and the wall, and eighteen segments across a quarter
     * circle put a facet boundary every 5° — enough that the first two facets
     * off the tangent returned measurably different values and the junction
     * still drew a soft band across the frame. At 30 the largest step across
     * the tangent is inside the 1-2% the rest of the sweep holds to.
     */
    curveSegments: 30,
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
       * Drawn to fill, not letterboxed off `naturalWidth`.
       *
       * The canvas is already cut to the manifest's viewBox aspect, so filling
       * it is the *only* transform that cannot stretch a mark — and it is the
       * one that survives a file with no intrinsic size. safetykit.svg carries
       * a viewBox and no width/height, so Chrome reports it as the SVG default
       * 300x150 (aspect 2, against its real 4.45); the old letterbox fit then
       * drew that mark at 45% of the plate's measure while the four files that
       * do declare a size drew at 100%. That is what split the row into two
       * apparent weights.
       */
      context.clearRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
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
  const scale = 0.5;
  const canvas = document.createElement('canvas');
  canvas.width = 2048 * scale;
  canvas.height = 1024 * scale;
  const context = canvas.getContext('2d') as SpacedContext | null;

  if (!context) {
    return new THREE.CanvasTexture(canvas);
  }

  context.scale(scale, scale);

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

/* -------------------------------------------------------------------------- */
/* Side projects: tablet screen, gallery placards                               */
/* -------------------------------------------------------------------------- */

/**
 * The tablet's own UI, drawn the way every other screen on this bench is drawn:
 * as a real capture-shaped sheet, in the page's own greys and ink, so it sits
 * in the same colour world as Tyler's four shipped screenshots without
 * pretending to be one of them.
 *
 * The eight cells are not decoration — they are the eight side projects, each
 * showing its own capture, and the count under the title is read off the same
 * array the hang is built from.
 */
let tabletScreenTexture: THREE.Texture | null = null;

const TABLET_SCREEN_ASPECT = 1024 / 1400;

function getTabletScreenTexture() {
  if (tabletScreenTexture) {
    return tabletScreenTexture;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1400;
  const context = canvas.getContext('2d') as SpacedContext | null;
  /*
   * Built before the drawing rather than after it: the eight thumbnails paint
   * asynchronously and each one has to re-upload the canvas as it lands.
   */
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;

  if (context) {
    context.fillStyle = '#f4f4f3';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.textBaseline = 'alphabetic';

    context.letterSpacing = '16px';
    context.fillStyle = 'rgba(20,21,23,0.5)';
    context.font = '600 42px Helvetica Neue, Arial, sans-serif';
    context.fillText('GALLERY', 82, 168);

    context.letterSpacing = '-3px';
    context.fillStyle = 'rgba(20,21,23,0.94)';
    context.font = '600 126px Helvetica Neue, Arial, sans-serif';
    context.fillText('Side', 78, 320);
    context.fillText('Projects', 78, 446);

    context.fillStyle = 'rgba(20,21,23,0.18)';
    context.fillRect(82, 512, 860, 3);

    context.letterSpacing = '0px';
    context.fillStyle = 'rgba(20,21,23,0.62)';
    context.font = '500 50px Helvetica Neue, Arial, sans-serif';
    context.fillText(
      `${sideProjects.length} pieces, not the shipped four`,
      82,
      588,
    );

    /*
     * The hang, in miniature — the real captures, not an outline of where
     * captures would go.
     *
     * Eight empty hairline rectangles on a foreground hero object is the
     * universal drawing for a thumbnail grid that failed to load, and seven of
     * these eight pieces have a real capture sitting in public/projects. Each
     * cell is painted with its plate tone up front so the grid is never a set
     * of empty boxes even for the frame or two before the images decode, then
     * each capture is cover-fitted into its own cell as it arrives and the
     * texture is re-uploaded. The eighth piece has no capture and keeps its
     * plate, which reads as one quiet tile in a grid of pictures rather than
     * as a row of broken ones.
     */
    const cellWidth = 196;
    const cellHeight = 128;
    const gapX = 26;
    const gapY = 30;
    const cellX = (index: number) => 82 + (index % 4) * (cellWidth + gapX);
    const cellY = (index: number) =>
      676 + Math.floor(index / 4) * (cellHeight + gapY);

    sideProjects.forEach((piece, index) => {
      const x = cellX(index);
      const y = cellY(index);
      context.fillStyle = 'rgba(20,21,23,0.09)';
      context.fillRect(x, y, cellWidth, cellHeight);

      if (!piece.image) {
        return;
      }

      const image = new Image();
      image.onload = () => {
        const scale = Math.max(
          cellWidth / image.naturalWidth,
          cellHeight / image.naturalHeight,
        );
        const drawWidth = image.naturalWidth * scale;
        const drawHeight = image.naturalHeight * scale;
        context.save();
        context.beginPath();
        context.rect(x, y, cellWidth, cellHeight);
        context.clip();
        context.drawImage(
          image,
          x + (cellWidth - drawWidth) / 2,
          y + (cellHeight - drawHeight) / 2,
          drawWidth,
          drawHeight,
        );
        context.restore();
        texture.needsUpdate = true;
      };
      image.src = piece.image;
    });

    context.fillStyle = 'rgba(20,21,23,0.18)';
    context.fillRect(82, 1096, 860, 3);

    context.letterSpacing = '13px';
    context.fillStyle = 'rgba(20,21,23,0.88)';
    context.font = '600 54px Helvetica Neue, Arial, sans-serif';
    context.fillText('OPEN', 82, 1194);
    context.letterSpacing = '0px';
    context.font = '500 60px Helvetica Neue, Arial, sans-serif';
    context.fillText('→', 322, 1196);
  }

  texture.needsUpdate = true;
  tabletScreenTexture = texture;
  return texture;
}

/**
 * The cover a framed piece gets when there is no capture for it in
 * public/projects.
 *
 * It used to be a dashed-outline box with "NO CAPTURE" set inside it. Dashed
 * borders are the wireframe idiom — the universal drawing for an asset that
 * failed — and hung at the same size and elevation as seven real screenshots
 * it read as a broken frame rather than as an honest gap. This is a typeset
 * cover instead: the studio's own ground, its own hairline, the piece's title
 * as the subject, and the fact that there is no capture stated as a footnote
 * in the same micro-label voice every other field name uses. Still no invented
 * screenshot — a portfolio gallery may never do that — but the wall now shows
 * a designed plate where it has nothing to photograph.
 */
const placeholderCache = new Map<string, THREE.Texture>();

function getPlaceholderTexture(title: string, tech: string[]) {
  const cached = placeholderCache.get(title);

  if (cached) {
    return cached;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 576;
  const context = canvas.getContext('2d') as SpacedContext | null;

  if (context) {
    /* The page's own studio ramp, raking the way the studio key does. */
    const ground = context.createLinearGradient(
      0,
      0,
      canvas.width,
      canvas.height,
    );
    ground.addColorStop(0, '#e4e6e7');
    ground.addColorStop(1, '#c3c6c8');
    context.fillStyle = ground;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.textBaseline = 'alphabetic';

    context.letterSpacing = '0px';
    context.fillStyle = 'rgba(20,21,23,0.18)';
    context.fillRect(84, 300, canvas.width - 168, 2);

    context.letterSpacing = '-1px';
    context.fillStyle = 'rgba(20,21,23,0.9)';
    context.font = '600 74px Helvetica Neue, Arial, sans-serif';
    context.fillText(title, 84, 268, canvas.width - 168);

    context.letterSpacing = '2px';
    context.fillStyle = 'rgba(20,21,23,0.6)';
    context.font = '500 36px Helvetica Neue, Arial, sans-serif';
    context.fillText(tech.join('   ·   '), 84, 366, canvas.width - 168);

    context.letterSpacing = '14px';
    context.fillStyle = 'rgba(20,21,23,0.42)';
    context.font = '600 28px Helvetica Neue, Arial, sans-serif';
    context.fillText('SOURCE ONLY · NO CAPTURE', 84, 494);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  placeholderCache.set(title, texture);
  return texture;
}

/**
 * The title strip on a frame's bottom rail: ink on the moulding, not a groove
 * cut into it.
 *
 * It was an alpha-masked deboss — pure white engraved into mid-grey aluminum —
 * and at the browse camera the strip is 13 CSS px tall, which left every piece
 * in the hang effectively untitled at roughly 1.5:1 contrast. A groove needs
 * both a lit lip and a shadowed wall to read, and neither survives at nine
 * pixels of cap height. Museums do not engrave their labels for this reason:
 * they print them. So this is a real map — ink glyphs on transparent — drawn
 * over the rail, and it holds ~9:1 against the moulding at any distance the
 * frame is legible at all.
 *
 * The canvas aspect matches the plane exactly; a 4:1 canvas stretched across a
 * 20:1 plane is how set type turns into a smear.
 */
const FRAME_TITLE_ASPECT = 1400 / 100;
const FRAME_TITLE_W = 1.22;
const FRAME_TITLE_H = FRAME_TITLE_W / FRAME_TITLE_ASPECT;
const frameTitleCache = new Map<string, THREE.Texture>();

function getFrameTitleTexture(title: string) {
  const cached = frameTitleCache.get(title);

  if (cached) {
    return cached;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 1400;
  canvas.height = 100;
  const context = canvas.getContext('2d') as SpacedContext | null;

  if (context) {
    /*
     * Tracking is held to 5px. At this size the 16px the rest of the set's
     * micro-labels use turns the word into a row of separate glyphs, and the
     * measure runs out before the longest title in the hang.
     */
    context.fillStyle = 'rgba(20,21,23,0.92)';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.letterSpacing = '5px';
    context.font = '700 62px Helvetica Neue, Arial, sans-serif';
    context.fillText(
      title.toUpperCase(),
      canvas.width / 2,
      canvas.height / 2 + 2,
      canvas.width - 60,
    );
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  frameTitleCache.set(title, texture);
  return texture;
}

/**
 * The museum label beside a focused piece: role, title, tech, and the host the
 * piece lives on.
 *
 * Deliberately NOT the description, and deliberately not a clickable link. The
 * DOM focus bar below carries the sentence and the real anchor — it has to,
 * because a canvas texture is invisible to assistive tech and a URL you cannot
 * click is furniture. Printing the same paragraph on both surfaces two hundred
 * pixels apart is the exact duplication the company-run row was just cured of,
 * so the two halves split the record instead: the object states what the piece
 * IS, the DOM states what it does and where it goes.
 */
const placardCache = new Map<string, THREE.Texture>();

/** Bare host of a real link, for the "where this lives" line. */
function linkHost(link: string) {
  return link.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

function getPlacardTexture(piece: SideProject) {
  const cached = placardCache.get(piece.title);

  if (cached) {
    return cached;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 560;
  const context = canvas.getContext('2d') as SpacedContext | null;

  if (context) {
    context.fillStyle = '#eeeeed';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.textBaseline = 'alphabetic';

    context.letterSpacing = '14px';
    context.fillStyle = 'rgba(20,21,23,0.52)';
    context.font = '600 34px Helvetica Neue, Arial, sans-serif';
    context.fillText(piece.role.toUpperCase(), 62, 116);

    context.letterSpacing = '-1px';
    context.fillStyle = 'rgba(20,21,23,0.92)';
    context.font = '600 76px Helvetica Neue, Arial, sans-serif';
    context.fillText(piece.title, 60, 232, 1080);

    context.fillStyle = 'rgba(20,21,23,0.16)';
    context.fillRect(62, 300, 1076, 2);

    context.letterSpacing = '2px';
    context.fillStyle = 'rgba(20,21,23,0.68)';
    context.font = '500 38px Helvetica Neue, Arial, sans-serif';
    context.fillText(piece.tech.join('   ·   '), 62, 380, 1076);

    context.letterSpacing = '0px';
    context.fillStyle = 'rgba(20,21,23,0.46)';
    context.font = '400 34px Helvetica Neue, Arial, sans-serif';
    context.fillText(linkHost(piece.link), 62, 460, 1076);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  placardCache.set(piece.title, texture);
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
  /* 1024 x 782 is the decal's own 1.86 x 1.42 aspect; anything else stretches. */
  canvas.height = 782;
  const context = canvas.getContext('2d') as SpacedContext | null;

  if (!context) {
    return new THREE.CanvasTexture(canvas);
  }

  context.fillStyle = '#ffffff';
  context.textBaseline = 'alphabetic';

  context.letterSpacing = '15px';
  context.font = '600 50px Helvetica Neue, Arial, sans-serif';
  context.fillText(status.toUpperCase(), 40, 84);
  context.fillRect(40, 126, 944, 4);

  context.letterSpacing = '-1px';
  context.font = '500 92px Helvetica Neue, Arial, sans-serif';
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

  /*
   * The title block is centred in the field under the rule rather than hung
   * from a fixed baseline: the three titles wrap to two, three and three lines
   * respectively, and a fixed start left the two-line plate top-heavy with a
   * third of its pocket empty.
   */
  const kept = lines.slice(0, 4);
  const leading = 104;
  const top = 150;
  const block = kept.length * leading;
  const first = top + (canvas.height - top - block) / 2 + 74;

  kept.forEach((line, index) => {
    context.fillText(line, 40, first + index * leading);
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

/**
 * The catalogue card printed under each era's capture: the date and short hash
 * as one letterspaced micro-label, the era name at display size, then its
 * visual language and palette as body. Transparent ground — this is ink on the
 * card stock the mesh already is, not a second brighter plate laid over it.
 *
 * 1024px across 0.92 world units, the same ~1113 px/unit the rest of the
 * bench's printed surfaces are drawn at.
 */
function createEraPlacardTexture(
  era: { commit: string; date: string; label: string; palette: string },
  visualLanguage: string,
) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 880;
  const context = canvas.getContext('2d') as SpacedContext | null;

  if (!context) {
    return new THREE.CanvasTexture(canvas);
  }

  context.textBaseline = 'alphabetic';

  context.letterSpacing = '10px';
  context.fillStyle = 'rgba(20,21,23,0.5)';
  context.font = '600 40px Helvetica Neue, Arial, sans-serif';
  context.fillText(era.date.toUpperCase(), 30, 62);

  context.letterSpacing = '4px';
  context.fillStyle = 'rgba(20,21,23,0.42)';
  context.font = '500 38px IBM Plex Mono, Menlo, monospace';
  context.fillText(era.commit, 30, 128);

  context.fillStyle = 'rgba(20,21,23,0.16)';
  context.fillRect(30, 170, 964, 2);

  context.letterSpacing = '-2px';
  context.fillStyle = 'rgba(20,21,23,0.92)';
  context.font = '600 106px Helvetica Neue, Arial, sans-serif';
  context.fillText(era.label, 26, 292, 968);

  context.letterSpacing = '0px';
  context.fillStyle = 'rgba(20,21,23,0.72)';
  context.font = '500 50px Helvetica Neue, Arial, sans-serif';
  wrapLines(context, visualLanguage, 964).forEach((line, index) => {
    context.fillText(line, 30, 386 + index * 62);
  });

  context.letterSpacing = '8px';
  context.fillStyle = 'rgba(20,21,23,0.45)';
  context.font = '600 34px Helvetica Neue, Arial, sans-serif';
  context.fillText(era.palette.toUpperCase(), 30, 540, 964);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/* -------------------------------------------------------------------------- */
/* Shared materials                                                            */
/* -------------------------------------------------------------------------- */

function AluminumMaterial({
  /*
   * Exposed, because not every aluminum face in the set is brushed. A machined
   * chamfer is a *polished* cut — a single pass of a diamond tool, not a belt —
   * and stretching its lobe along the brushing is what turned the one hard edge
   * highlight in the frame back into a broad sheen. Bodies keep the streak;
   * cuts turn it off.
   */
  anisotropy = 0.9,
  /**
   * Which geometry group this material dresses. drei's RoundedBox is an
   * ExtrudeGeometry, so it ships two groups: 0 is the pair of flat caps at the
   * ends of the extrusion axis, 1 is the bevel fillets plus the perimeter
   * walls. That split happens to be exactly the split a machinist would make —
   * on a lid extruded through its thin axis the caps ARE the broad brushed
   * faces and group 1 is the rim; on a base extruded front-to-back the caps are
   * the thin front and back edges and group 1 is the deck. Passing `material-0`
   * / `material-1` is what lets one body carry brushing on its broad faces and
   * a smooth anodised finish on its edges.
   */
  attach,
  color = ALUMINUM,
  /*
   * Up with the shell's drop. A metalness-1 surface has *only* the environment
   * — take two stops out of the room without putting any back here and every
   * chassis in a high-key gallery renders gunmetal. The gain restores the
   * aluminum's overall level while keeping the room's new contrast, which is
   * the entire trade this grade is built on.
   */
  envMapIntensity = 2.1,
  grain = 'lateral',
  metalness = 1,
  /*
   * 0.13, not 0.20. A brushed unibody is a *tight* lobe smeared along one
   * axis, not a broad satin one: at 0.2 the specular from the raking slit was
   * already a foot wide by the time it reached the surface, so it read as an
   * even sheen and never travelled as the lens moved. Tightening the lobe is
   * what turns the grain from a texture nobody can see into a streak that
   * crosses the deck under parallax.
   */
  roughness = 0.13,
}: {
  /** 0 disables the directional lobe; 1 is a fully drawn-out brush streak. */
  anisotropy?: number;
  /** R3F attach path — `material-0` / `material-1` for a per-group dress. */
  attach?: string;
  color?: string;
  envMapIntensity?: number;
  /**
   * Which way the brushing runs across the face: across it, along it, or not
   * at all. `none` drops the roughnessMap entirely and is for polished cuts —
   * a chamfer is one pass of a diamond tool, so it has no brushing to carry,
   * and forcing the grain onto it at near-mirror roughness resolves every
   * individual tool score as its own hard stripe down the edge.
   */
  grain?: 'lateral' | 'axial' | 'none';
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
  const map = useMemo(() => {
    if (grain === 'none') {
      return null;
    }

    return grain === 'axial'
      ? getBrushedRoughnessCross()
      : getBrushedRoughness();
  }, [grain]);

  /*
   * meshPhysicalMaterial, for one property: `anisotropy`.
   *
   * A roughnessMap of horizontal streaks does not make brushed metal — it
   * makes metal with stripes painted on it. Every texel still returns a
   * circular GGX lobe, so the highlight is round wherever it lands and the
   * grain only modulates its brightness. Real brushed aluminum stretches the
   * lobe *along* the grain: one bright bar that slides across the face as the
   * lens moves, and stays a bar rather than becoming a disc.
   *
   * That is the difference between a specular streak and a smudge, and it is
   * the whole reason this material exists. The roughnessMap stays — it is what
   * gives the stretched bar its structure — but the shape now comes from the
   * BRDF instead of from a canvas.
   */
  return (
    <meshPhysicalMaterial
      anisotropy={anisotropy}
      anisotropyRotation={grain === 'axial' ? Math.PI / 2 : 0}
      attach={attach}
      color={color}
      envMapIntensity={envMapIntensity}
      metalness={metalness}
      roughness={roughness}
      roughnessMap={map}
    />
  );
}

/**
 * The edge dress: smooth anodised aluminum with no grain and no directional
 * lobe, for the narrow faces of a machined body.
 *
 * A brushed roughnessMap on a face two hundredths of a unit tall is not a
 * finish, it is an aliasing pattern: the whole 512-line canvas gets crushed
 * into a handful of screen pixels and resolves as corrugation running the
 * length of every base and lid rim at close range. Real anodised edge faces are
 * bead-blasted and near-featureless anyway — the read comes from the single
 * bright chamfer highlight along the top edge, which is its own geometry.
 * Roughness is held a step above the broad faces so the edge answers the raking
 * slit with a satin band rather than a mirror line.
 */
function AnodisedEdge({
  attach,
  color = ALUMINUM,
  /*
   * Held well under the broad faces, and this is a value decision rather than a
   * physical one. A metal wall standing near-vertical returns whatever the
   * cubemap holds in front of it, and blurring that return over a 0.3 lobe
   * pulls in the overhead run — at parity with the deck's gain the front edge of
   * every base came back a step BRIGHTER than the bench it stands on, which
   * flattens the chassis into the surface. A machined body needs its edge faces
   * to sit under both the deck above them and the bench in front of them; that
   * value step is the whole of the read.
   */
  envMapIntensity = 1.0,
  roughness = 0.26,
}: {
  attach?: string;
  color?: string;
  envMapIntensity?: number;
  roughness?: number;
}) {
  return (
    <meshPhysicalMaterial
      anisotropy={0}
      attach={attach}
      color={color}
      envMapIntensity={envMapIntensity}
      metalness={1}
      roughness={roughness}
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
  /*
   * Eight, not four. A fillet resolved in four segments shows its facets the
   * moment the band is more than a couple of pixels wide, and each facet
   * catches the raking slit at its own angle — the cut line beads instead of
   * running. Eight is the point where the highlight reads continuous at the
   * closest lens in the set.
   */
  smoothness = 8,
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
      {/*
       * Anisotropy off. A chamfer is a polished diamond cut, not a brushed
       * face, and a directional lobe here smears the one hard edge highlight
       * in the set back into the same broad sheen the band exists to replace.
       *
       * 0.085 / 2.05, up from 0.055 / 2.4. At the glancing poses in the
       * parallax sweep this band is the widest thing the accent slit can find,
       * and it was returning past the screen whites standing right behind it —
       * a chassis rim brighter than a powered display reads as chrome trim, not
       * as the same aluminum as the body. Held here it still resolves the slit
       * as a line and still travels with the lens, and it stays a value under
       * the panels it wraps.
       */}
      <AluminumMaterial
        anisotropy={0}
        color={color}
        envMapIntensity={2.05}
        grain="none"
        roughness={0.085}
      />
    </RoundedBox>
  );
}

/**
 * Anodised black, not painted black.
 *
 * A metalness-1 body at #1b1c1e in a dark room returns almost nothing, and
 * "almost nothing, evenly" is what plastic looks like. The tell of a real
 * anodised part is the clearcoat: a thin dielectric film over the metal whose
 * own Fresnel goes to ~1 at grazing angles, so the body stays near-black
 * face-on and picks up a bright hard rim exactly where it turns away from the
 * lens. That rim is the entire read, and it costs one extra lobe.
 *
 * The coat is held much smoother than the body under it — a mirror film over a
 * fine-blasted substrate, which is what an anodised phone rail actually is.
 */
function InkMetalMaterial({ roughness = 0.3 }: { roughness?: number }) {
  return (
    <meshPhysicalMaterial
      clearcoat={1}
      clearcoatRoughness={0.09}
      color={PHONE_INK}
      envMapIntensity={1.4}
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
  /*
   * One asymmetry that gets measured rather than fixed, because measuring it
   * says there is nothing to fix.
   *
   * Every host in the set drifts its pool through this one component, so the
   * sign is shared by construction — a laptop and a phone stand cannot be
   * throwing opposite ways. What they *can* differ by is the yaw of the group
   * this sits inside, since the offset below is stated in the host's local
   * frame: the right MacBook is yawed −0.3 and the Charades phone −0.5, which
   * turns the shared vector by 17° and 29° respectively. Worked through, the
   * right laptop lands its pool at world (0.143, −0.023) and the phone at
   * (0.037, +0.002) — both firmly camera-right, and the z terms that differ in
   * sign differ by 0.025 of a world unit, which is a tenth of a pixel at the
   * work lens. What actually reads as "one spreads left" is the radial ambient
   * smear under a stand whose own footprint is narrow: the pool is symmetric
   * and the object standing in it is not. Counter-rotating the offset into
   * world space would need the host's animated world yaw read every frame, for
   * a correction two orders of magnitude under a pixel.
   */

  return (
    <group name="contact-core" position={[x, y, z]}>
      <mesh
        position={[drift * KEY_DRIFT_X, 0, drift * KEY_DRIFT_Z]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[width, depth]} />
        {/*
         * Backed off with the arrival of PCSS. These two planes used to be the
         * only thing grounding the near cluster and they were carrying far more
         * weight than the directional's hard edge did on the far cluster —
         * which is precisely why the two halves of the bench looked lit by
         * different rigs. The soft directional is the grounding authority now;
         * what is left here is contact darkening in the last millimetre.
         */}
        <meshBasicMaterial
          alphaMap={smear}
          color="#54585c"
          depthWrite={false}
          opacity={0.3 * opacity}
          toneMapped={false}
          transparent
        />
      </mesh>
      <mesh position={[0, 0.0012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width * 0.75, depth * 0.75]} />
        <meshBasicMaterial
          alphaMap={core}
          color="#3f4347"
          depthWrite={false}
          opacity={0.26 * opacity}
          toneMapped={false}
          transparent
        />
      </mesh>
    </group>
  );
}

/**
 * One reflection card. `texture` is optional: a device whose display faces the
 * lens above the bench gets its screen read back mirrored, and a body that meets
 * the bench with a machined wall — a laptop base — gets a flat tint instead,
 * because what the bench can actually see of it is a strip of aluminum and a
 * chamfer, not an image.
 *
 * renderOrder is load-bearing. The contact darkening and the ContactShadows pass
 * both live a couple of thousandths above this card and both write no depth, so
 * without an explicit order the sort could put a reflection over the shadow that
 * grounds the same object. −2 draws it first, under everything.
 */
function BenchReflection({
  width,
  run,
  texture,
  crop,
  sourceAspect,
  tint = ALUMINUM,
  opacity = 0.06,
  z,
}: {
  /** Width of the card, normally the object's own footprint width. */
  width: number;
  /** How far the smear reaches out from the contact line toward the lens. */
  run: number;
  texture?: THREE.Texture;
  crop?: SourceRect;
  /**
   * The display's own aspect, so the cover-crop resolves to the identical
   * texture `Screen` already built and the reflection costs no second clone.
   * The card then squashes that whole image into its run, which is what a
   * reflection foreshortened almost to the surface does anyway.
   */
  sourceAspect?: number;
  tint?: string;
  opacity?: number;
  /** World z of the contact line the smear runs forward from. */
  z: number;
}) {
  const cropped = useMemo(
    () =>
      texture && sourceAspect
        ? coverTexture(texture, sourceAspect, crop)
        : null,
    [texture, sourceAspect, crop],
  );
  const uniforms = useMemo(
    () => ({
      uTexture: { value: cropped },
      uRepeat: {
        value: new THREE.Vector2(
          cropped?.repeat.x ?? 1,
          cropped?.repeat.y ?? 1,
        ),
      },
      uOffset: {
        value: new THREE.Vector2(
          cropped?.offset.x ?? 0,
          cropped?.offset.y ?? 0,
        ),
      },
      uTint: { value: new THREE.Color(tint) },
      uOpacity: { value: opacity },
      uMapped: { value: cropped ? 1 : 0 },
    }),
    [cropped, tint, opacity],
  );

  return (
    <mesh
      position={[0, 0.0035, z + run / 2]}
      renderOrder={-2}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <planeGeometry args={[width, run]} />
      <shaderMaterial
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        fragmentShader={REFLECTION_FRAGMENT_SHADER}
        transparent
        uniforms={uniforms}
        vertexShader={REFLECTION_VERTEX_SHADER}
      />
    </mesh>
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

  const uniforms = useMemo(
    () => ({
      uSeed: { value: (width * 7.3 + height * 3.1) % 1 },
    }),
    [width, height],
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
      {/*
       * Fresnel-driven, not a flat veil.
       *
       * `opacity 0.15` over the whole panel is a milky film: it lifts the black
       * of the UI evenly, which is the one thing real cover glass never does.
       * Glass is almost perfectly clear where you look through it square and
       * almost perfectly reflective at a grazing angle, and it carries *shaped*
       * reflections — the softbox, an edge of the room — not an even wash.
       *
       * So: a Schlick term for the falloff, plus one discrete window-shaped
       * highlight raked across the upper-left in the key's direction. One
       * plane, one cheap fragment, and the screens stop looking laminated in
       * fog.
       */}
      <mesh>
        <planeGeometry args={[width, height]} />
        <shaderMaterial
          depthWrite={false}
          fragmentShader={GLASS_FRAGMENT_SHADER}
          transparent
          uniforms={uniforms}
          vertexShader={GLASS_VERTEX_SHADER}
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
  cutColor,
  cutMetalness,
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
  /**
   * Fills the channel with a stated pigment instead of a darkened copy of the
   * host. A groove cut in bare metal reads by value alone, and value is
   * exactly what a thin mark loses at browse distance: the lip is offset by a
   * fixed amount, so on a hairline stroke it covers most of the channel and
   * the mark flips from cut to embossed. Filled, every mark holds the same
   * ink whatever its stroke weight — which is what a real filled engraving
   * does, and why nameplates are made that way.
   */
  cutColor?: string;
  cutMetalness?: number;
}) {
  const [cut, lip] = useMemo(() => {
    const base = new THREE.Color(hostColor);
    return [
      cutColor ? new THREE.Color(cutColor) : base.clone().multiplyScalar(floor),
      base.clone().lerp(new THREE.Color('#ffffff'), lipMix),
    ];
  }, [cutColor, floor, hostColor, lipMix]);

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
          envMapIntensity={cutColor ? envMapIntensity * 0.3 : envMapIntensity}
          metalness={cutMetalness ?? metalness}
          opacity={opacity}
          roughness={cutColor ? 0.7 : roughness}
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
  cutColor,
  cutMetalness,
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
  cutColor?: string;
  cutMetalness?: number;
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
      cutColor={cutColor}
      cutMetalness={cutMetalness}
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
        envMapIntensity={SET_ENV}
        map={falloff}
        metalness={0}
        roughness={0.98}
      />
    </mesh>
  );
}

function BenchTop() {
  const falloff = useMemo(() => getBenchFalloff(), []);
  const sheen = useMemo(() => getBenchSheen(), []);
  const fascia = useMemo(() => getFasciaFalloff(), []);

  return (
    <group>
      {/*
       * The understructure. It used to render at #b6b9bd — within four codes of
       * the bench top above it and the rail in front of it, so the bottom of
       * every frame was three near-identical horizontal strips whose seams read
       * as banding rather than as an edge. It is a full step down now: the
       * whole bench front resolves into one shadowed mass.
       */}
      {/*
       * Pinned so its front face lands exactly on the bench's front lip. It
       * used to be centred on the bench and 30 deep, which pushed 7.5 units of
       * it out *past* the front edge — and that overhang's up-facing top
       * caught the full skylight and printed a light horizontal band across
       * the bottom of every frame, immediately under the shadowed rail. That
       * band was half of the corner banding; the other half was the raw
       * background showing under it.
       */}
      <mesh position={[0, -0.42, BENCH_FRONT_Z - 15]}>
        <boxGeometry args={[56, 0.4, 30]} />
        <meshStandardMaterial
          color={BENCH_FLOOR}
          envMapIntensity={SET_ENV}
          roughness={0.95}
        />
      </mesh>

      {/*
       * No castShadow on the slab: its own top face sits 0.0006 under the
       * graded surface plane, and at shadow-map precision that reads as a
       * coplanar occluder — the whole bench falls into its own shadow.
       *
       * Carries BENCH_FLOOR rather than BENCH_TOP: the only faces of it a lens
       * ever sees are the near side wall and the ends, and those belong to the
       * shadowed front mass, not to the lit working surface.
       */}
      <mesh position={[0, -BENCH_THICKNESS / 2, BENCH_CENTER_Z]}>
        <boxGeometry args={[BENCH_WIDTH, BENCH_THICKNESS, BENCH_DEPTH]} />
        <meshStandardMaterial
          color={BENCH_FLOOR}
          envMapIntensity={SET_ENV}
          roughness={0.8}
        />
      </mesh>

      {/*
       * Graded working surface: brightest under the cluster, falling off to the
       * cove behind and — new — falling off harder toward the lens, so the shot
       * reads bright backdrop / mid bench / dark foreground rather than one
       * plateau with a vignette.
       *
       * The sheen map is the other half of M7: a very low-frequency roughness
       * variation, ±0.06 around the base. It is invisible as a texture and it
       * is the entire difference between a surface and a fill — the raking key
       * now finds something to break on across the 40% of frame this plane
       * occupies instead of returning one flat Lambert value.
       */}
      <mesh
        position={[0, 0.0006, BENCH_CENTER_Z]}
        receiveShadow
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[BENCH_WIDTH, BENCH_DEPTH]} />
        {/*
         * Metalness down from 0.04 to 0. It was a rounding error as a material
         * property and a real defect as a photograph: a 4% metallic term on a
         * plane this large is enough IBL specular that the camera-right accent
         * slit printed a hard white bloom onto the bench in front of the right
         * laptop, brighter than the screens it stood next to. The surface is
         * bead-blasted work top — it has no metallic term at all, and what
         * little sheen it should hold comes from the dielectric lobe the
         * roughness map already shapes.
         */}
        <meshStandardMaterial
          color={BENCH_TOP}
          envMapIntensity={SET_ENV}
          map={falloff}
          metalness={0}
          roughness={0.72}
          roughnessMap={sheen}
        />
      </mesh>

      {/*
       * The seam that used to stand here as a 0.002 box is now baked into the
       * bench falloff — see BENCH_SEAM_DEPTH. A strip of raised geometry could
       * not see the grade the surface under it was being held to, so it lit
       * independently of the bench and printed the one crisp full-width line
       * left in the frame.
       */}

      {/*
       * Chamfered front rail, and the one edge the bench front is allowed to
       * show. Bare — the shop marks hang on the tag rack.
       */}
      <group
        position={[0, -0.055, BENCH_FRONT_Z + 0.03]}
        rotation={[-0.62, 0, 0]}
      >
        <mesh castShadow receiveShadow>
          <boxGeometry args={[BENCH_WIDTH, 0.26, 0.5]} />
          {/*
           * The rail sits under the lip, facing the lens and away from the
           * key, so the ambient half of its budget is *all* it has — which is
           * exactly why it needs to see less of the room than the top does.
           * Half the set's share keeps the bench front the darkest band in the
           * frame instead of a lighter strip stacked on a darker one.
           */}
          <meshStandardMaterial
            color={BENCH_RAIL}
            envMapIntensity={SET_ENV * 0.5}
            roughness={0.74}
          />
        </mesh>
      </group>

      {/*
       * The fascia — one continuous shadowed mass running off the bottom of
       * every frame.
       *
       * What used to be down here was a leak, not a surface: the rail ended,
       * the understructure ended, and below them the raw scene background
       * showed through at L174 while the strips above it sat at L184 and L183.
       * Three near-identical horizontal bars and a hole, which is exactly the
       * banding the lower frame corners were showing.
       *
       * One tall plane at a genuinely dark value replaces all of it, so the
       * bench front resolves into a single edge with a graded top-to-bottom
       * sweep — bench L~183, rail L~150, fascia L~120 — and there is no seam
       * for a viewport to find at any aspect. Front-facing, so a lens that
       * ever ends up *behind* it (a focused tag stands off to z 2.2) sees
       * straight through rather than into a wall.
       */}
      <mesh position={[0, -3.1, BENCH_FRONT_Z + 0.06]}>
        <planeGeometry args={[56, 6]} />
        <meshStandardMaterial
          color="#63666a"
          envMapIntensity={SET_ENV * 0.5}
          map={fascia}
          roughness={0.9}
        />
      </mesh>
    </group>
  );
}

/**
 * Parked pose, damped to like every other subject in the set. The rack's origin
 * is the rail, not a patch of bench, because this object hangs.
 *
 * It belongs to `work` and only to `work`, and each of the other three views
 * parks it for its own reason rather than by default. Profile already prints
 * the whole company run as a DOM table carrying the same four marks, so hanging
 * them over the badge as well would be the exact duplication this rack was
 * built to end. Signals is a near-plan view of three blanks with no headroom
 * above them. History tracks laterally across six era cards and has no still
 * band at all.
 */
const TAG_RACK_PARKED: Transform = {
  position: [0, -2.8, 3.5],
  rotation: [0, 0, 0],
  scale: HIDDEN.scale,
};

/** How far the lens stands off a focused plate, at rack scale 1. */
const TAG_FOCUS_DISTANCE = 3.2;

/**
 * The work seat, fitted to the canvas aspect.
 *
 * The band it sits in is the one clear strip in the work frame: above the two
 * laptop lids, right of the intro veil's falloff, under the header — about 0.9
 * world units tall at this depth, which is what set the tag's own proportions.
 * z −1.0 puts the rail in front of both lids rather than behind them, so no
 * mark is ever occluded by a product, and the plates still stop ~0.25 above the
 * nearer lid's top edge, so no product is ever occluded by a mark.
 *
 * A fixed seat only frames one shape of viewport, and this one has an obstacle
 * a fixed seat cannot see: the intro veil is `min(26rem, 38vw)` wide, so it
 * takes 38% of a 4:3 frame and only 22% of a 16:9 one. Holding the rack at a
 * constant world x therefore parked the first two tags behind the headline at
 * 1024 and left a dead quarter-frame at 1920. `fit` tracks the aspect for the
 * rack's size, and the second term pushes it clear of the veil by however much
 * the veil has grown — which is what keeps the same picture at every width.
 *
 * Mutated in place rather than rebuilt: this is read once per frame.
 */
const WORK_RACK_ASPECT = 1.6;
/*
 * y 2.44, not 2.16. At the old seat the Scale plate's lower edge crossed the
 * left MacBook's lid at the near end of the parallax sweep — a tangency, and
 * the worst kind: two flat objects of near-identical value overlapping by a
 * few pixels, so the eye could not tell which was in front. The row now clears
 * the taller of the two lids at both parallax extremes with margin left over.
 */
/*
 * The seat itself does NOT move again, and that is the point of the shorter
 * drop above. The rack's own rail sits four pixels under the header rule at
 * this seat: raising the seat by the 0.05 the plates needed was measured, and
 * it put the rail behind the header band entirely — four plates hanging from
 * wires that vanish into a UI bar, with the fixture that holds them out of the
 * picture. The clearance comes out of the drop instead, which moves the plates
 * and leaves the rail exactly where it reads.
 */
const workRackSeat: Transform = {
  position: [0.85, 2.44, -1.0],
  rotation: [0, 0, 0],
  scale: 1,
};

function fitWorkRack(aspect: number) {
  const fit = THREE.MathUtils.clamp(aspect / WORK_RACK_ASPECT, 0.6, 1.1);
  workRackSeat.position[0] = WORK_CENTER_X + 0.63 * fit + (1 - fit) * 2;
  workRackSeat.scale = fit;

  return workRackSeat;
}

/** World centre of a tag's plate — what the focus lens aims at. */
function tagFocusSeat(index: number, seat: Transform) {
  const across = (index - (companyTags.length - 1) / 2) * TAG_PITCH;

  return {
    x: seat.position[0] + across * seat.scale,
    y: seat.position[1] - (TAG_DROP + TAG_H / 2 - TAG_HOLE_INSET) * seat.scale,
    z: seat.position[2],
    scale: seat.scale,
  };
}

/*
 * One geometry per part, shared by all four tags. Four plates that differ only
 * in the mark cut into them have no business owning four box geometries.
 */
let tagPlateGeometry: THREE.BoxGeometry | null = null;
let tagRingGeometry: THREE.TorusGeometry | null = null;
let tagHoleGeometry: THREE.CircleGeometry | null = null;
let tagCordGeometry: THREE.CylinderGeometry | null = null;

/** Hairline run from the rail down to the ring the plate hangs on. */
const TAG_CORD_LEN = TAG_DROP - TAG_RING_R;

/**
 * The one thing that stops a small vertical plate reading as paper: a face
 * gradient. A flat plane has a constant normal, so neither the key nor the
 * cubemap can put any form on it — the value has to come from the map.
 *
 * The ramp runs bright at the top-left to dim at the bottom-right, which is the
 * direction the studio key actually travels ([-6.5, 7, 3.2] aimed at origin).
 * It is the same grade the bench and the cove already carry, applied to the one
 * new surface in the set.
 */
let tagFalloff: THREE.Texture | null = null;

function getTagFalloff() {
  if (tagFalloff) {
    return tagFalloff;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext('2d');

  if (context) {
    /*
     * Steepened, and turned to run top-left → bottom-right rather than corner
     * to corner. A standing plane lit from above and camera-left has to *read*
     * as a standing plane, and the only cue a 0.62 x 0.31 rectangle can give
     * for that is a legible gradient down its own face. At 255 → 176 there was
     * a 30% ramp spread over the diagonal — real, and below the threshold at
     * which an eye calls it a plane rather than a flat swatch.
     */
    const gradient = context.createLinearGradient(4, 0, 60, 64);
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(0.42, '#f0f0f0');
    gradient.addColorStop(1, '#a4a4a4');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 64, 64);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  tagFalloff = texture;
  return texture;
}

function getTagPlateGeometry() {
  if (!tagPlateGeometry) {
    tagPlateGeometry = new THREE.BoxGeometry(TAG_W, TAG_H, TAG_T);
  }

  return tagPlateGeometry;
}

function getTagRingGeometry() {
  if (!tagRingGeometry) {
    tagRingGeometry = new THREE.TorusGeometry(TAG_RING_R, 0.0065, 6, 20);
  }

  return tagRingGeometry;
}

function getTagHoleGeometry() {
  if (!tagHoleGeometry) {
    tagHoleGeometry = new THREE.CircleGeometry(TAG_HOLE_R, 16);
  }

  return tagHoleGeometry;
}

function getTagCordGeometry() {
  if (!tagCordGeometry) {
    tagCordGeometry = new THREE.CylinderGeometry(0.005, 0.005, TAG_CORD_LEN, 6);
  }

  return tagCordGeometry;
}

/**
 * One tag: a hairline drop off the rail, a split ring, and a punched satin
 * plate with the employer's real mark milled into its face.
 *
 * The whole hanger is one swinging body pivoted at the rail. The plate keeps a
 * static yaw and roll of its own inside it, so the four plates never render as
 * one wide parallel decal, but nothing inside the hanger ever moves relative to
 * anything else — a tag and the ring holding it can never come apart.
 */
function CompanyTagPlate({
  index,
  tag,
  swingRef,
  plateRef,
}: {
  index: number;
  tag: CompanyTag;
  swingRef: (node: THREE.Group | null) => void;
  plateRef: (node: THREE.MeshStandardMaterial | null) => void;
}) {
  const plate = useMemo(() => getTagPlateGeometry(), []);
  const ring = useMemo(() => getTagRingGeometry(), []);
  const hole = useMemo(() => getTagHoleGeometry(), []);
  const cord = useMemo(() => getTagCordGeometry(), []);
  const grain = useMemo(() => getBrushedRoughness(), []);
  const falloff = useMemo(() => getTagFalloff(), []);
  const holeY = TAG_H / 2 - TAG_HOLE_INSET;

  return (
    <group
      position={[(index - (companyTags.length - 1) / 2) * TAG_PITCH, 0, 0]}
      ref={swingRef}
    >
      <mesh geometry={cord} position={[0, -TAG_CORD_LEN / 2, 0]}>
        <AluminumMaterial
          color={ALUMINUM_DARK}
          envMapIntensity={1.5}
          roughness={0.24}
        />
      </mesh>

      <mesh
        geometry={ring}
        position={[0, -TAG_DROP, 0]}
        rotation={[0, Math.PI / 2, 0]}
      >
        {/*
         * Metalness well under 1. A torus standing edge-on to the lens has all
         * its normals pointing sideways, and pure metal there can only return
         * the dark front hemisphere of the studio cubemap — the ring rendered
         * as a black bead. A diffuse term is what makes it steel.
         */}
        <AluminumMaterial
          color={ALUMINUM_BRIGHT}
          envMapIntensity={1.5}
          metalness={0.5}
          roughness={0.24}
        />
      </mesh>

      <group
        onClick={(event) => {
          event.stopPropagation();
          setBenchTagSelection(index);
        }}
        onPointerEnter={(event) => {
          event.stopPropagation();
          setBenchTagHover(index);
        }}
        onPointerLeave={() => setBenchTagHover(-1)}
        position={[0, -TAG_DROP - holeY, 0]}
        rotation={[0, TAG_REST_YAW[index], TAG_REST_ROLL[index]]}
      >
        {/*
         * No ChamferBand here, unlike every other machined body in the set.
         * The tags are read very close to face-on, so the band adds no edge
         * highlight at all — all it did was serrate the silhouette with its
         * own low-segment outline standing 0.002 proud of the plate.
         */}
        {/*
         * The plate's own thickness, made visible. Two hairline bars standing
         * a hair proud of the top and bottom edges — the top in near-mirror
         * bright stock, the bottom in dark. This is the cheapest and most
         * reliable cue there is that an object is stock with a body rather
         * than a rectangle printed on the backdrop, and at this lens it is
         * doing more work than the face gradient.
         */}
        <mesh position={[0, TAG_H / 2 - 0.004, 0]}>
          <boxGeometry args={[TAG_W - 0.008, 0.008, TAG_T + 0.002]} />
          <meshStandardMaterial
            color="#f4f6f8"
            envMapIntensity={2.4}
            metalness={0.7}
            roughness={0.1}
          />
        </mesh>
        <mesh position={[0, -TAG_H / 2 + 0.005, 0]}>
          <boxGeometry args={[TAG_W - 0.008, 0.01, TAG_T + 0.002]} />
          <meshStandardMaterial
            color="#6f7275"
            envMapIntensity={0.7}
            metalness={0.5}
            roughness={0.45}
          />
        </mesh>
        {/*
         * Metalness down, environment gain up. Measured at the old 0.45/1.25
         * the plate face rendered L143 against a cove at L169 — DARKER than
         * the wall behind it, which is the whole reason the row read as four
         * decals printed on the backdrop rather than four objects hanging in
         * front of it. A satin plate is mostly a diffuse surface with a sheen
         * on top; letting the diffuse term through is what puts it back above
         * the wall, and the gain keeps the sheen a plate's rather than paper's.
         */}
        <mesh castShadow geometry={plate}>
          <meshStandardMaterial
            color={TAG_PLATE}
            envMapIntensity={3.2}
            map={falloff}
            metalness={0.22}
            ref={plateRef}
            roughness={0.3}
            roughnessMap={grain}
          />
        </mesh>

        {/* The punched hole itself, as a recessed dark land. */}
        <mesh geometry={hole} position={[0, holeY, TAG_T / 2 + 0.0009]}>
          <meshStandardMaterial
            color={SCREEN_WELL}
            metalness={0.25}
            roughness={0.5}
          />
        </mesh>

        {/*
         * Height, not width, is what varies between marks: `EtchedMark`
         * derives width from the manifest aspect, so feeding it W / aspect
         * sets every mark to the same measure without ever scaling one
         * non-uniformly.
         */}
        {/*
         * Filled engraving, not bare groove. At the browse camera a tag is
         * ~110x55 CSS px and a groove has only value to work with, so the two
         * lightest lockups in the set — the 5.3:1 Scale wordmark and the
         * widest mark — lost its channels under its own lip and read as
         * watermarks while UCLA held. The channel now carries the page's ink
         * at metalness 0, so every mark lands at the same weight whatever its
         * stroke, and the lip is pulled back to a hairline so it edges the
         * pigment rather than competing with it.
         */}
        <EtchedMark
          company={tag.mark}
          cutColor={TAG_MARK_INK}
          cutMetalness={0}
          envMapIntensity={1.2}
          height={tagMarkHeight(tag.mark)}
          hostColor={TAG_PLATE}
          lipMix={0.42}
          metalness={0.5}
          offset={0.0015}
          position={[0, TAG_MARK_Y, TAG_T / 2 + 0.001]}
          roughness={0.3}
        />
      </group>
    </group>
  );
}

type TagMotion = {
  angle: number;
  velocity: number;
  /** Signed value channel: +1 live, −1 standing down for a neighbour. */
  glow: number;
  resting: boolean;
};

/**
 * The rack: one rail on two drops, four tags, and the only per-frame work in
 * the object.
 *
 * The loop early-outs on any tag that is already sitting exactly on its
 * targets, so an idle work shot integrates nothing at all and a hover
 * integrates one tag — the neighbours are untouched, which is the whole point
 * of hanging them separately.
 */
function CompanyTagRack({
  rackRef,
  reducedMotion,
}: {
  rackRef: (node: THREE.Group | null) => void;
  reducedMotion: boolean;
}) {
  const swings = useRef<(THREE.Group | null)[]>([]);
  const plates = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const motion = useRef<TagMotion[]>(
    companyTags.map(() => ({
      angle: 0,
      velocity: 0,
      glow: 0,
      resting: true,
    })),
  );

  useFrame(({ gl, invalidate }, rawDelta) => {
    const delta = Math.min(rawDelta, 1 / 30);
    const focus = readBenchTags();
    let geometryChanged = false;
    let animating = false;

    for (let index = 0; index < companyTags.length; index += 1) {
      const swing = swings.current[index];
      const state = motion.current[index];

      if (!swing) {
        continue;
      }

      const hovered = focus.hovered === index;
      const selected = focus.selected === index;
      /*
       * Reduced motion keeps the highlight and drops the pendulum entirely —
       * the tag brightens where it hangs and never moves.
       */
      const targetAngle = reducedMotion
        ? 0
        : hovered
          ? TAG_SWING_HOVER
          : selected
            ? TAG_SWING_SELECTED
            : 0;
      const targetGlow = hovered || selected ? 1 : focus.selected >= 0 ? -1 : 0;

      if (
        state.resting &&
        state.angle === targetAngle &&
        state.glow === targetGlow
      ) {
        continue;
      }

      const previousAngle = state.angle;

      /* Semi-implicit Euler on a second-order spring; see TAG_SPRING_*. */
      state.velocity +=
        (targetAngle - state.angle) * TAG_SPRING_STIFFNESS * delta;
      state.velocity -=
        state.velocity * Math.min(1, TAG_SPRING_DAMPING * delta);
      state.angle += state.velocity * delta;
      state.glow = damp(state.glow, targetGlow, reducedMotion ? 80 : 9, delta);

      if (
        Math.abs(state.angle - targetAngle) < 0.0006 &&
        Math.abs(state.velocity) < 0.002 &&
        Math.abs(state.glow - targetGlow) < 0.002
      ) {
        state.angle = targetAngle;
        state.velocity = 0;
        state.glow = targetGlow;
        state.resting = true;
      } else {
        state.resting = false;
        animating = true;
      }

      swing.rotation.x = state.angle;
      geometryChanged ||= state.angle !== previousAngle;

      const material = plates.current[index];

      if (material) {
        material.color
          .copy(TAG_PLATE_COLOR)
          .lerp(
            state.glow >= 0 ? TAG_PLATE_LIVE_COLOR : TAG_PLATE_DIM_COLOR,
            Math.abs(state.glow),
          );
      }
    }

    if (geometryChanged) {
      gl.shadowMap.needsUpdate = true;
    }
    setBenchSettled('tags', !animating);
    if (animating) {
      invalidate();
    }
  });

  return (
    <group
      position={TAG_RACK_PARKED.position}
      ref={rackRef}
      scale={TAG_RACK_PARKED.scale}
    >
      {/* The two drops. They run past the top of the work frame by ~0.35. */}
      {[-TAG_WIRE_X, TAG_WIRE_X].map((x) => (
        <mesh key={x} position={[x, TAG_WIRE_LEN / 2, 0]}>
          <cylinderGeometry args={[0.006, 0.006, TAG_WIRE_LEN, 6]} />
          <AluminumMaterial
            color={ALUMINUM_DARK}
            envMapIntensity={1.4}
            roughness={0.26}
          />
        </mesh>
      ))}

      {/*
       * The rail. Axial grain: it is a turned tube, so the brushing runs the
       * length of it rather than across it the way a milled face does.
       */}
      {/*
       * No castShadow. The bar now runs the full width of the set, and a
       * 15-unit tube hanging 2.4 above the bench under a soft directional laid
       * one long horizontal smear straight across the working surface — a
       * second horizon, exactly the artefact the seam work upstream just
       * removed. The plates it carries still cast; the bar itself is thin
       * enough that its own shadow was never part of the read.
       */}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry
          args={[TAG_RAIL_R, TAG_RAIL_R, TAG_RAIL_HALF * 2, 14]}
        />
        <AluminumMaterial
          envMapIntensity={1.2}
          grain="axial"
          roughness={0.28}
        />
      </mesh>

      {[-TAG_RAIL_HALF, TAG_RAIL_HALF].map((x) => (
        <mesh key={x} position={[x, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry
            args={[TAG_RAIL_R + 0.011, TAG_RAIL_R + 0.011, 0.05, 14]}
          />
          <AluminumMaterial
            color={ALUMINUM_DARK}
            envMapIntensity={1.2}
            roughness={0.34}
          />
        </mesh>
      ))}

      {companyTags.map((tag, index) => (
        <CompanyTagPlate
          index={index}
          key={tag.mark}
          plateRef={(node) => {
            plates.current[index] = node;
          }}
          swingRef={(node) => {
            swings.current[index] = node;
          }}
          tag={tag}
        />
      ))}
    </group>
  );
}

function StudioEnvironment() {
  if (isAblated('env')) {
    return null;
  }

  return (
    <Environment frames={1} resolution={512}>
      {/*
       * The studio shell — the single most consequential value in the file.
       *
       * At #aeb2b6 it flooded every normal in the scene with the same mid-grey
       * irradiance: a cubemap is sampled by normal alone, so a shell that
       * bright *is* an ambient term no lightformer can out-shout, and chassis,
       * bench, wall and plates all landed inside one 20-code band. Dropped a
       * full two stops. Metal now has a dark room to fall to and the rig above
       * is the only thing lighting it, which is what makes a face turn.
       *
       * The set does not go dark with it: the diffuse half of the studio is
       * carried by a hemisphere gradient and the key, neither of which a
       * metalness-1 surface can see. That split is the whole grade — a bright
       * gallery for the matte set, a contrasty room for the aluminum.
       */}
      {/*
       * Down another two thirds of a stop, to the metal-only floor.
       *
       * The shell is no longer a shared term. With SET_ENV holding the bench,
       * cove and fascia off the cubemap, this value now lights exactly one
       * class of surface — the machined bodies — so it can be set to what
       * aluminum needs rather than to what the room can survive. At #6a6e73 it
       * was still a fill: every chamfer, rail and deck lip had a mid-grey floor
       * under its specular, which is why the front lips clipped to chrome and
       * the highlights never travelled. At #4f5357 the sources in this cubemap
       * are the only bright things in it, and a metal face that turns away from
       * them actually goes somewhere.
       */}
      <color args={['#4f5357']} attach="background" />
      {/*
       * Overhead-front softbox, the key. Tightened from an 18x9 slab hung at
       * z 4.5 — at that size it lit the bench as one uniform field from frame
       * edge to frame edge and the set had no light shape at all. Half the
       * width and pulled in over the subject cluster, so the brightest point
       * sits under the devices and the bench falls a full value step toward
       * the corners. Falloff shaping, not a relight: same colour, same palette.
       */}
      {/*
       * Slid a unit and a half camera-left of the cluster centroid and opened
       * up. The softbox is the single largest area source in the cubemap, so
       * hanging it on the centreline is what guaranteed a symmetric room and a
       * 1:1 lateral ratio no amount of edge lighting could break.
       */}
      {/*
       * Off the centre line properly, and rolled.
       *
       * Half a unit further camera-left and pulled back in z, but the roll is
       * the part that matters: a softbox hung square to the world puts its
       * reflection on an up-facing deck as a bar parallel to the deck's own
       * front edge, so the lid and the palmrest and the tablet face all return
       * the same horizontal sheen and none of it says which side the light is
       * on. Rolling the box 0.16rad tips that bar off-parallel — the decks now
       * carry a subtle diagonal, and the lateral sweep across a face reads as
       * a source with a position rather than as a gradient.
       */}
      <Lightformer
        color="#ffffff"
        form="rect"
        intensity={3.1}
        position={[-2.4, 7.2, 2.2]}
        rotation={[-Math.PI / 3, 0, 0.16]}
        scale={[8.5, 6, 1]}
      />
      {/*
       * Narrow high-intensity strip, camera-left. A broad dim room gives
       * metalness-1 nothing to reflect but flat grey — this is the source the
       * brushed roughnessMap resolves into an actual directional streak.
       */}
      <Lightformer
        color="#ffffff"
        form="rect"
        intensity={7}
        position={[-3.6, 8.6, 2.6]}
        rotation={[-Math.PI / 2.55, 0, 0.07]}
        scale={[14, 0.5, 1]}
      />
      {/*
       * Camera-left wall, the source the left half of every lid and deck
       * sweeps into. It is the direct counterpart of the dark bar hung on the
       * right: between them a face that turns from -x to +x runs bright to
       * dark, which is the ~2:1 lateral step the shot was missing.
       */}
      <Lightformer
        color="#ffffff"
        form="rect"
        intensity={3.4}
        position={[-6, 4.6, 0.6]}
        rotation={[0, Math.PI / 2, 0]}
        scale={[14, 3.4, 1]}
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
        intensity={16}
        position={[-4.2, 2.5, 5.2]}
        rotation={[0, 2.46, 0]}
        scale={[0.55, 9, 1]}
      />
      {/*
       * Front bounce, hung hard camera-left.
       *
       * A lid or a bezel standing square to the lens reflects the *front*
       * hemisphere, and with the shell two stops down that hemisphere is a
       * dark room — the near lid frames were rendering at L58, black plastic
       * in a gallery. This is the white flat a photographer would stand off
       * the left of the camera to open them up. Deliberately off-axis: a
       * frontal bounce on the lens axis would lift both flanks equally and
       * cost the lateral ratio the rest of the rig was built to produce.
       */}
      <Lightformer
        color="#e4e8ec"
        form="rect"
        intensity={1.5}
        position={[-4.6, 2.8, 6.6]}
        rotation={[0, 0.42, 0]}
        scale={[6, 5, 1]}
      />
      {/*
       * Camera-right wall, now a *negative*. It used to be a light source at
       * #e6eaee — a fill on the shadow side is what flattened the lateral ratio
       * to nothing. Held just above the shell value so the right flank of a
       * chassis still separates from the background instead of going to black.
       */}
      <Lightformer
        color="#585c60"
        form="rect"
        intensity={0.9}
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
      {/*
       * Narrowed 0.35 → 0.2 and driven harder. These two are what an up-facing
       * deck actually reflects, and a strip's *width* is the width of the bar
       * it puts on that deck: at 0.35 over a 0.24-rough palmrest the two of
       * them merged into a single wash covering the whole plate, which cannot
       * travel because it already covers everywhere it could travel to. Narrow
       * and bright is a highlight; broad and dim is a value.
       */}
      <Lightformer
        color="#ffffff"
        form="rect"
        intensity={11}
        position={[2.8, 6.4, 1.4]}
        rotation={[-Math.PI / 2.9, 0, -0.42]}
        scale={[10, 0.2, 1]}
      />
      <Lightformer
        color="#ffffff"
        form="rect"
        intensity={9}
        position={[-1.4, 5.2, -2.6]}
        rotation={[-Math.PI / 2.2, 0, 0.86]}
        scale={[10, 0.2, 1]}
      />
      {/*
       * The travelling slit, and the geometry that decides where it has to
       * hang.
       *
       * A palmrest faces straight up and the lens rakes it at about 18°, so its
       * mirror direction does NOT point at the ceiling — it points 18° above
       * the horizon, deep into -z. Every overhead strip in this rig therefore
       * misses the decks entirely; what a deck reflects is the *far wall*, and
       * the far wall here was one broad even panel. That is the real reason the
       * decks held a single tone: not the roughness, not the grain map, but a
       * reflection target with nothing in it.
       *
       * So the source goes where the deck is actually looking: a narrow
       * vertical slit standing on the back wall. Narrow in x is what matters —
       * as the lens swings its ±0.34 of parallax the mirror point slides along
       * the wall, and a slit is the only thing whose edge is sharp enough for
       * that slide to be legible. The material's anisotropy then stretches the
       * reflection along the brushing, which is what turns a moving dot into a
       * moving streak.
       */}
      <Lightformer
        color="#ffffff"
        form="rect"
        intensity={16}
        position={[-1.5, 3.3, -9.4]}
        rotation={[0, 0, 0.14]}
        scale={[0.45, 6, 1]}
      />
      <Lightformer
        color="#ffffff"
        form="rect"
        intensity={9}
        position={[2.9, 2.7, -9.4]}
        rotation={[0, 0, -0.2]}
        scale={[0.3, 5, 1]}
      />
      {/*
       * The one bright accent left on the camera-right side, and it is a slit,
       * not a wall: a specular that clips near-white on an edge is exactly what
       * a high-key grade needs to keep from going chalky, but at intensity 7
       * over 8 units of height it was lighting the whole right flank and
       * cancelling the key.
       */}
      <Lightformer
        color="#ffffff"
        form="rect"
        intensity={9}
        position={[4.6, 2.6, 3.4]}
        rotation={[0, -1.02, 0.24]}
        scale={[0.18, 8, 1]}
      />
      {/*
       * The dark bar. Without something in the cubemap that is *below* the room
       * average, a metal plane can only ever sweep bright-to-less-bright; this
       * gives the sweep somewhere to land, which is what makes the gradient
       * read as a reflection rather than a shading ramp.
       *
       * Deepened from #6e7174 to near-black and doubled in height. At the old
       * value it sat *above* half the set's rendered greys, so it was not a
       * dark end at all — it was a second fill, and the sweep it was supposed
       * to terminate ran bright-to-slightly-less-bright across every deck.
       */}
      <Lightformer
        color="#17191b"
        form="rect"
        intensity={0.9}
        position={[-2.2, 3.0, 4.2]}
        rotation={[0, 0.34, 0.18]}
        scale={[11, 3.2, 1]}
      />
      {/*
       * Its partner on the camera-right front quadrant, hung at a different
       * angle so a face turning across the frame reaches a dark end no matter
       * which way it is yawed. This is the half of the pair the right-hand
       * MacBook lid sweeps into.
       */}
      <Lightformer
        color="#1d1f22"
        form="rect"
        intensity={0.9}
        position={[3.6, 1.9, 4.6]}
        rotation={[0, -0.5, -0.2]}
        scale={[7, 3.6, 1]}
      />
      {/*
       * Set wall. Up-facing metal — the Signals blanks lying flat on the bench —
       * reflects the *back* hemisphere at a shallow angle, so this is what makes
       * them read as light brushed aluminum instead of muddy grey plastic.
       */}
      <Lightformer
        color="#d6d9dd"
        form="rect"
        intensity={0.95}
        position={[0, 5, -11]}
        scale={[26, 12, 1]}
      />
      {/*
       * Negative fill, kept low and shallow so it only darkens grazing edges
       * rather than swallowing every horizontal reflection. Taken down with the
       * shell — at #8e9194 it was lifting exactly the grazing edges it exists
       * to sink.
       */}
      <Lightformer
        color="#2a2c2f"
        form="rect"
        intensity={0.7}
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
      {/*
       * A phone stands upright with its whole display above the bench, so the
       * surface in front of it genuinely does see the screen — this is the one
       * device in the set whose reflection is the image rather than the
       * chassis. Run 1.1 at phone-model scale is about half a unit of bench.
       */}
      <BenchReflection
        crop={crop}
        opacity={0.075}
        run={1.1}
        sourceAspect={1.455 / 3.24}
        texture={texture}
        width={1.9}
        z={0.36}
      />
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
          {/*
           * Polished cuts, so no grain and no directional lobe — same reason
           * as ChamferBand. On a band this narrow the brushing map does not
           * read as a finish at all; it resolves as a row of hard stripes
           * marching down the phone's silhouette.
           */}
          {/*
           * Pulled off mirror with the rest of the set's cuts. These two rings
           * wrap the phone's whole silhouette and meet the lens at a glancing
           * angle through most of the parallax sweep, which is exactly where a
           * near-mirror dielectric-free metal clips — the rail was outshining
           * the display it frames. Satin machined aluminum instead.
           */}
          <mesh geometry={railProud} position={[0, 0, -0.103]}>
            <AluminumMaterial
              anisotropy={0}
              color={ALUMINUM_BRIGHT}
              envMapIntensity={2.05}
              grain="none"
              roughness={0.08}
            />
          </mesh>
          {/* Front and back edge loops of the rail. */}
          <mesh geometry={railEdge} position={[0, 0, 0.0975]}>
            <AluminumMaterial
              anisotropy={0}
              color={ALUMINUM_BRIGHT}
              envMapIntensity={2.2}
              grain="none"
              roughness={0.08}
            />
          </mesh>
          <mesh geometry={railEdge} position={[0, 0, -0.1035]}>
            <AluminumMaterial
              anisotropy={0}
              envMapIntensity={2.2}
              grain="none"
              roughness={0.06}
            />
          </mesh>

          {/* Machined chamfer around the display perimeter, in bright metal. */}
          <mesh geometry={chamfer} position={[0, 0, 0.0868]}>
            <AluminumMaterial
              anisotropy={0}
              color={ALUMINUM_BRIGHT}
              grain="none"
              roughness={0.16}
            />
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

/**
 * A moulded keycap, not an extruded rectangle.
 *
 * At 0.013 tall a box has nothing for a light to find: all four walls are
 * vertical, so under a single overhead key every cap returns one value and the
 * well renders as a flat black panel with a grid ruled on it. Two cheap changes
 * fix it and neither costs a draw call. The cap is a square frustum — four
 * segments of a cylinder turned 45° so its flats face the deck axes, with the
 * top ring drawn in 20% — so the walls tilt up into the source and catch it.
 * And the shade gradient is baked into vertex colour: the moulded top edge sits
 * at the top of the recess where the room reaches it, and the base sits down in
 * the gutter's own shadow, which is the read the recess geometry alone could
 * never give a body this shallow.
 */
/**
 * The moulded break at the top of the cap, in cap-local units.
 *
 * A frustum still meets its top face at a hard 90°-ish corner, and at closeup
 * range that corner is one pixel of nothing: the wall returns its wall value,
 * the top returns its top value, and the edge between them is where a real
 * moulded cap carries the only highlight on it. `CHAMFER_H` is a fifth of the
 * cap's 0.013 height, so the break is 0.0026 tall, and the inset is set so the
 * band's run across the cap's width lands at about the same — a face at very
 * close to 45°, which is the one angle that turns the overhead key back at the
 * lens off a facet this small.
 */
const KEY_CAP_CHAMFER_H = 0.2;
const KEY_CAP_CHAMFER_INSET = 0.035;
const KEY_CAP_GEOMETRY = (() => {
  /* Four radial segments put the square's corners at r, so its flats sit at
     r/√2 — the half-width the cap has to end up at once it is scaled. */
  const corner = Math.SQRT2 / 2;
  /*
   * Two height segments, not one, and the middle ring is moved rather than
   * left where the cylinder put it: ring 1 goes up to the start of the break
   * and takes the frustum's own top radius, so the long wall below it is
   * unchanged from the single-segment version and everything new lives in the
   * short band above. Costs four quads per cap on a geometry that is instanced
   * once — no extra draw call, no per-key work.
   */
  const geometry = new THREE.CylinderGeometry(corner * 0.8, corner, 1, 4, 2);
  const ring = geometry.attributes.position;
  const facing = geometry.attributes.normal;

  for (let index = 0; index < ring.count; index += 1) {
    const y = ring.getY(index);

    if (Math.abs(y) < 1e-6) {
      /* Middle torso ring: lift it to the break line at the frustum's radius. */
      const scale = (corner * 0.8) / (corner * 0.9);
      ring.setXYZ(
        index,
        ring.getX(index) * scale,
        0.5 - KEY_CAP_CHAMFER_H,
        ring.getZ(index) * scale,
      );
    } else if (y > 0) {
      /* Top ring and the cap face that shares its radius: pull it in. */
      ring.setXYZ(
        index,
        ring.getX(index) * (1 - KEY_CAP_CHAMFER_INSET),
        y,
        ring.getZ(index) * (1 - KEY_CAP_CHAMFER_INSET),
      );
    }
  }

  /*
   * Normals are re-derived, NOT recomputed.
   *
   * `computeVertexNormals` was the obvious call and it is wrong here, measured:
   * a cylinder duplicates its seam column so the two halves can carry different
   * uvs, and averaging face normals gives those duplicates only the faces on
   * their own side. On a body with four radial segments that is a quarter of the
   * ring getting a normal that points 20° off where its neighbours point — the
   * key grid rendered with a sawtooth running down one edge of every column and
   * the row gutters filled in. A surface of revolution has an analytic normal at
   * every vertex: the radial direction, which the position itself carries and
   * which is identical on both seam copies, against the slope of the band the
   * vertex belongs to. Caps keep the axis normal the cylinder already gave them.
   */
  const wallSlope = (corner - corner * 0.8) / (1 - KEY_CAP_CHAMFER_H);
  const breakSlope = (corner * 0.8 * KEY_CAP_CHAMFER_INSET) / KEY_CAP_CHAMFER_H;
  const facingAt = new THREE.Vector3();

  for (let index = 0; index < ring.count; index += 1) {
    if (Math.abs(facing.getY(index)) > 0.99) {
      continue;
    }

    const y = ring.getY(index);
    /* Top ring rides the break; the ring at the break line splits the two. */
    const slope =
      y > 0.4 ? breakSlope : y > 0.2 ? (wallSlope + breakSlope) / 2 : wallSlope;
    const x = ring.getX(index);
    const z = ring.getZ(index);
    const radius = Math.hypot(x, z) || 1;

    facingAt.set(x / radius, slope, z / radius).normalize();
    facing.setXYZ(index, facingAt.x, facingAt.y, facingAt.z);
  }

  geometry.rotateY(Math.PI / 4);
  geometry.scale(KEY_CAP_WIDTH, KEY_CAP_HEIGHT, KEY_CAP_DEPTH);

  const position = geometry.attributes.position;
  const colors = new Float32Array(position.count * 3);

  for (let index = 0; index < position.count; index += 1) {
    /* 0 at the cap's foot in the gutter, 1 at its moulded top edge. */
    const height = position.getY(index) / KEY_CAP_HEIGHT + 0.5;
    const shade = 0.66 + 0.62 * height;
    colors[index * 3] = shade;
    colors[index * 3 + 1] = shade;
    colors[index * 3 + 2] = shade;
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
})();

function KeyGrid() {
  return (
    <instancedMesh
      args={[KEY_CAP_GEOMETRY, undefined, KEY_MATRICES.length]}
      ref={attachKeyGrid}
    >
      {/*
       * envMapIntensity is the whole fight here. The studio cubemap is baked
       * from a stack of intensity-2.4-to-10 Lightformers, so at the default 1.0
       * the IBL term alone lifted a #2a2c2e cap to roughly 40% grey and the
       * deck rendered as a light field with faint outlines — the exact "mid-grey
       * blobs at the value of the palmrest" read. Held down to 0.35 with no
       * metalness, the caps finally sit where black keycaps belong.
       */}
      {/*
       * Down a step with the well plate under it. A keycap is the darkest
       * thing on a laptop and the deck only has weight if the value order —
       * silver chassis, bright lip, black well, black caps — actually spans
       * the range. At #3c3e40 over a #2a2c2e plate the well was two greys a
       * few codes apart and the whole keyboard averaged back into the deck.
       */}
      {/*
       * Colour up a step to pay for the gradient. The baked shade runs 0.66 to
       * 1.28 about the cap, so a flat #343638 would have dropped the average
       * value of the well; #3b3d3f lands the mid-cap back where the tuned
       * silver / lip / well / cap order put it, with the top edge now a step
       * above it and the foot a step below.
       */}
      <meshStandardMaterial
        color="#3b3d3f"
        envMapIntensity={0.3}
        metalness={0}
        roughness={0.62}
        vertexColors
      />
    </instancedMesh>
  );
}

function Laptop({
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
      {/*
       * A laptop meets the bench with a chassis wall, not a screen — the lid is
       * behind its own base, so the surface in front of the machine can only
       * see the front edge and the chamfer standing on it. Flat bright-aluminum
       * tint, and a short run: this is the last centimetre of bench answering
       * the lip, not a mirror image of the product.
       */}
      <BenchReflection
        opacity={0.075}
        run={0.62}
        tint={ALUMINUM_BRIGHT}
        width={3.3}
        z={1.15}
      />
      {/*
       * Screen spill, under the chassis return and much fainter than it.
       *
       * A lit display is a light source, and the one thing the bench in front
       * of an open laptop cannot look like is untouched. It did: the Med
       * Negotiate panel is the largest emitting surface in the frame and the
       * bench a centimetre in front of it measured within a value of open
       * bench three feet away, which is what made both screens read as decals
       * printed on the lids. This is a second reflection card carrying the
       * display's own image, run long and held at 5.5% so what lands is a
       * direction and a whisper of the screen's colour rather than a bounce —
       * the fade term concentrates it at the contact line and the widening tap
       * kernel has it unreadable well before the far end. Monochrome discipline
       * survives it, and that is measured rather than hoped: the five taps
       * average the whole display — green panel and white sign-in sheet
       * together — so what lands is achromatic. At the peak of the smear the
       * bench's channel spread reads 7.7 against 7.9 without the card, i.e. the
       * lift is neutral to within a fifth of a value, and it is a soft
       * 6.8-value gradient dying out inside 30 px rather than a bounce.
       */}
      <BenchReflection
        crop={crop}
        opacity={0.055}
        run={1.5}
        sourceAspect={3.24 / 2.03}
        texture={texture}
        width={3.6}
        z={1.15}
      />
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
         * Palmrest. Brushed across the deck, camera-left to camera-right.
         *
         * Down from 0.24 to 0.14. The deck is the largest flat metal surface a
         * lens ever sees on this bench and it is the surface the whole "does it
         * read as aluminum" question is settled on — at a 0.24 satin the
         * overhead strips reflected as a wash the width of the whole plate,
         * which is a value, not a highlight, and it did not move when the
         * camera did. At 0.14 with the material's anisotropy stretching the
         * lobe along the brushing, the same strips resolve as a bar that
         * travels across the deck through the parallax sweep.
         */}
        {/*
         * Two dresses, one body. The base is extruded front-to-back, so group 0
         * is the pair of thin faces the lens meets square — the front edge that
         * runs the full width of the shot — and group 1 is the deck plus the
         * two ends. The front edge used to carry the same 512-line brushing map
         * as the deck, crushed into ten screen pixels, and read as corrugation
         * at close range. It is smooth anodised now; the machined cut line
         * along its top is the chamfer loop below, which is where an edge
         * highlight belongs.
         */}
        <RoundedBox
          args={[3.35, 0.1, 2.3]}
          castShadow
          position={[0, 0.05, 0]}
          radius={0.028}
          receiveShadow
          smoothness={4}
        >
          <AnodisedEdge attach="material-0" envMapIntensity={0.45} />
          {/*
           * Left where the regrade put it.
           *
           * The palmrest carries a blown highlight across its front third, and
           * it is not the cubemap: dropping envMapIntensity moved it by nothing
           * measurable, because what clips there is the key's own specular on a
           * metalness-1 surface. The two levers that would actually pull it
           * down are the rig and the lobe, and both were tried and rejected —
           * the rig is settled, and widening the lobe to 0.17 spread the same
           * saturated energy over MORE of the deck (clipped pixels went up
           * 23%), which is the opposite of the ask. The rim speculars, which
           * are what P5 names, are clamped at the chamfers and rails instead.
           *
           * The base colour is the third lever and it is now measured too, and
           * it does not work either. Rendered with this colour cut 47% to
           * #6a6c6e, the blown core (hero x 410–458, y 414–421) read 255.0
           * before and 254.9 after — it does not move at all, because a
           * metalness-1 surface raked at this angle returns Fresnel toward 1.0
           * whatever its F0 is. What DOES move is everything that is not
           * clipped: the deck around the band went 127.1 → 97.4 and its
           * shoulder 140.5 → 110.3, i.e. the only thing a colour step buys is
           * a fifth of a stop off the largest metal surface in the frame for
           * zero change in the defect. The clip is a property of the key's
           * angle to a horizontal deck and it stays.
           */}
          <AluminumMaterial
            attach="material-1"
            envMapIntensity={2.3}
            grain="lateral"
            roughness={0.13}
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
        {/*
         * Pulled off chrome. At ALUMINUM_BRIGHT / 2.6 / 0.05 this loop was a
         * near-perfect mirror facing the lens square-on across the full width
         * of both decks, and what it mirrored was whichever source it happened
         * to be pointed at — so the front lip clipped to flat white and read as
         * a chrome trim strip glued onto an aluminum body. Stock colour, a
         * third off the gain and twice the roughness: it still resolves the
         * raking slit as a hard line that travels with the lens, but it is now
         * a machined cut in the same metal as the deck rather than a different
         * material.
         */}
        {/*
         * smoothness 3 put three segments across a fillet whose radius is
         * nearly half the loop's total height, so at close range each facet
         * caught the slit on its own and the cut line beaded down the front
         * edge like a row of drops. Eight segments resolve it as one line.
         *
         * Roughness up with it. This band faces the lens square-on across the
         * full width of both decks, and at 0.1 its glancing return was clipping
         * past the screen whites standing right above it — satin, not chrome.
         */}
        <RoundedBox
          args={[3.354, 0.011, 2.304]}
          position={[0, 0.092, 0]}
          radius={0.005}
          smoothness={8}
        >
          <AluminumMaterial
            anisotropy={0}
            envMapIntensity={1.55}
            grain="none"
            roughness={0.15}
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
            color="#222426"
            envMapIntensity={0.18}
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
          {/*
           * Lid back: grain runs front-to-back, across the palmrest's — and
           * only on the broad faces. The lid is extruded through its thin axis,
           * so group 0 is the two big plates and group 1 is the rim wrapping
           * them. The rim is a couple of screen pixels wide at this lens, which
           * is narrower than a single tool score on the grain map, so every
           * score landed on it as its own tick and the lid silhouette read as
           * ribbing. Smooth anodised there instead; the machined line comes
           * from the ChamferBand standing over it.
           */}
          <RoundedBox
            args={[3.35, 2.14, 0.055]}
            castShadow
            position={[0, 1.07, 0]}
            radius={0.028}
            smoothness={4}
          >
            <AluminumMaterial
              attach="material-0"
              envMapIntensity={2.0}
              grain="axial"
              roughness={0.24}
            />
            <AnodisedEdge
              attach="material-1"
              envMapIntensity={1.25}
              roughness={0.28}
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
          {/*
           * Polished cut, no grain. This ring is ~2 CSS px wide down the sides
           * of the lid, and the grain map's coarse tool scores are wider than
           * that — so each score landed on it as its own hard tick and the lid
           * silhouette read as a serrated edge rather than a machined one. The
           * scores belong on faces big enough to hold them.
           */}
          <mesh geometry={chamfer} position={[0, 1.07, 0.0262]}>
            <AluminumMaterial
              anisotropy={0}
              color={ALUMINUM_BRIGHT}
              grain="none"
              roughness={0.14}
            />
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
            crop={crop}
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
        toggleBenchSelection('work', index);
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
          crop={crop}
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
/* Side projects tablet                                                         */
/* -------------------------------------------------------------------------- */

/**
 * A real 11-inch tablet, at the same scale as everything else on the bench: the
 * phones put one world unit at ~159mm, so a 178 x 250mm slab is 1.12 x 1.57.
 * It is the only device here that is not one of Tyler's shipped products, which
 * is exactly why it is modeled as an ordinary tablet on an ordinary easel
 * rather than dressed up — it is the door to the gallery, not an exhibit.
 */
const TABLET_WIDTH = 1.12;
const TABLET_THICKNESS = 0.052;
const TABLET_RADIUS = 0.07;
const TABLET_BEZEL = 0.066;
const TABLET_SCREEN_W = TABLET_WIDTH - TABLET_BEZEL * 2;
/*
 * Body height is derived from the screen canvas, not chosen: `Screen` cover-
 * crops whatever it is handed, so a display whose aspect disagrees with its
 * texture silently eats the margins of the UI drawn on it.
 */
const TABLET_SCREEN_H = TABLET_SCREEN_W / TABLET_SCREEN_ASPECT;
const TABLET_HEIGHT = TABLET_SCREEN_H + TABLET_BEZEL * 2;
const TABLET_LEAN = 0.3;

/**
 * Hover slot for the tablet. It rides one past the four featured devices in the
 * same `work` focus channel, so it can never collide with a project index and
 * the DOM cue and the raycast agree about what is lit.
 */
const TABLET_INDEX = featuredProjects.length;

/**
 * The left gutter the work lens leaves beside the device cluster — the patch
 * the employer marks used to be milled into. It is the only seat the tablet
 * has: it belongs to the work shot and nothing else, so every other view parks
 * it rather than restaging it.
 */
const TABLET_SEAT: Transform = {
  position: [-2.02, 0, 0.24],
  /*
   * 0.74, not 0.88 and not 1. At true scale an 11-inch portrait tablet is
   * taller in frame than a 14-inch laptop lid — correct, and wrong for this
   * shot, because the one object here that is not a shipped product would be
   * the largest thing in it. 0.88 did not go far enough: standing front-most
   * and nearest the lens it still read as the dominant mass of the frame, and
   * a viewer's first fixation landed on the *unshipped* work.
   *
   * Backed off another notch and pushed half a unit back into the cluster, so
   * it now reads as the door it is: present, clearly openable, and secondary
   * to the four products it stands beside.
   */
  scale: 0.74,
  rotation: [0, 0.24, 0],
};

function TabletEasel() {
  return (
    <group>
      <RoundedBox
        args={[1.34, 0.055, 0.62]}
        castShadow
        position={[0, 0.0275, -0.1]}
        radius={0.014}
        receiveShadow
        smoothness={3}
      >
        <AluminumMaterial roughness={0.28} />
      </RoundedBox>
      {/* Front lip the tablet's bottom edge seats against. */}
      <mesh castShadow position={[0, 0.095, 0.16]}>
        <boxGeometry args={[1.34, 0.11, 0.05]} />
        <AluminumMaterial roughness={0.28} />
      </mesh>
      {/* Back leg, on the tablet's own lean so it beds flat against it. */}
      <mesh
        castShadow
        position={[0, 0.28, -0.28]}
        rotation={[-TABLET_LEAN, 0, 0]}
      >
        <boxGeometry args={[1.34, 0.5, 0.05]} />
        <AluminumMaterial roughness={0.28} />
      </mesh>
    </group>
  );
}

function SideProjectsTablet({
  tabletRef,
}: {
  tabletRef: (node: THREE.Group | null) => void;
}) {
  const screen = useMemo(() => getTabletScreenTexture(), []);
  const bezel = useMemo(
    () =>
      getBezelRing(
        TABLET_WIDTH,
        TABLET_HEIGHT,
        TABLET_SCREEN_W,
        TABLET_SCREEN_H,
        TABLET_RADIUS,
        TABLET_RADIUS - 0.03,
        0.006,
      ),
    [],
  );
  const rail = useMemo(
    () =>
      getBezelRing(
        TABLET_WIDTH + 0.026,
        TABLET_HEIGHT + 0.026,
        TABLET_WIDTH - 0.034,
        TABLET_HEIGHT - 0.034,
        TABLET_RADIUS + 0.012,
        TABLET_RADIUS - 0.016,
        TABLET_THICKNESS + 0.006,
      ),
    [],
  );

  return (
    <group
      onClick={(event) => {
        event.stopPropagation();
        /*
         * Warm the hang's textures on the same gesture that asks for them: the
         * camera transit is ~600ms and the decode lands inside it, so the
         * frames are already resolved when the gallery shot arrives.
         */
        useTexture.preload(GALLERY_IMAGES);
        openBenchGallery();
      }}
      onPointerEnter={(event) => {
        event.stopPropagation();
        setBenchHover('work', TABLET_INDEX);
      }}
      onPointerLeave={() => setBenchHover('work', -1)}
      position={HIDDEN.position}
      ref={tabletRef}
      scale={HIDDEN.scale}
    >
      {/*
       * The tablet stands the way the phones do, so the bench in front of it
       * sees the display. Held a shade under the phones: the gallery screen is
       * a near-white sheet and the same opacity off it was a visible pool.
       */}
      <BenchReflection
        opacity={0.055}
        run={0.62}
        sourceAspect={TABLET_SCREEN_ASPECT}
        texture={screen}
        width={1.15}
        z={0.19}
      />
      <ContactCore depth={1.05} width={1.85} z={-0.08} />
      <TabletEasel />

      <group position={[0, 0.12, 0.1]} rotation={[-TABLET_LEAN, 0, 0]}>
        <group position={[0, TABLET_HEIGHT / 2 - 0.02, 0]}>
          <RoundedBox
            args={[TABLET_WIDTH, TABLET_HEIGHT, TABLET_THICKNESS]}
            castShadow
            radius={TABLET_RADIUS}
            smoothness={5}
          >
            <InkMetalMaterial />
          </RoundedBox>

          {/* Polished side band, the same treatment the phone rails get. */}
          <mesh
            castShadow
            geometry={rail}
            position={[0, 0, -TABLET_THICKNESS / 2 - 0.003]}
          >
            <AluminumMaterial
              color={ALUMINUM_BRIGHT}
              envMapIntensity={2.0}
              roughness={0.12}
            />
          </mesh>

          {/* Bezel land, its face proud of the recessed display. */}
          <mesh
            geometry={bezel}
            position={[0, 0, TABLET_THICKNESS / 2 - 0.001]}
          >
            <InkMetalMaterial roughness={0.4} />
          </mesh>
          <mesh position={[0, 0, TABLET_THICKNESS / 2 + 0.0005]}>
            <planeGeometry args={[TABLET_SCREEN_W, TABLET_SCREEN_H]} />
            <meshStandardMaterial color={SCREEN_WELL} roughness={0.22} />
          </mesh>

          <Screen
            height={TABLET_SCREEN_H}
            position={[0, 0, TABLET_THICKNESS / 2 + 0.0018]}
            radius={0.045}
            seed={0.42}
            texture={screen}
            width={TABLET_SCREEN_W}
          />
          <GlassCover
            height={TABLET_SCREEN_H}
            position={[0, 0, TABLET_THICKNESS / 2 + 0.0055]}
            radius={0.045}
            width={TABLET_SCREEN_W}
          />
        </group>
      </group>
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
  const uprightPortrait = useMemo(() => {
    /* The JPEG pixels are stored a quarter-turn left with no EXIF orientation. */
    const upright = portrait.clone();
    upright.center.set(0.5, 0.5);
    upright.rotation = Math.PI / 2;
    upright.needsUpdate = true;
    return upright;
  }, [portrait]);
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
              map={uprightPortrait}
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

          {/* Punched slot plus the clip end that carries the Decagon easter egg. */}
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
          company="Decagon"
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
 * The previous set was three identically-sized plates on identical angle
 * blocks, evenly spaced along x at a shared 15° cant. Two things were wrong
 * with it and they were the same thing twice: at a 15° cant under an 18° lens
 * the engraved title met the camera 59° off its own normal, so every cap
 * height was cut roughly in half and the type disappeared into the metal; and
 * three equal objects on an even pitch is a specimen row, not a photograph.
 *
 * Both are fixed by the same move — treat them as coupons in an inspection
 * fixture rather than blanks on a shelf. The cant goes up to 40–46°, which is
 * within ~15° of the raised lens's axis (cos 15° ≈ 0.97 of full cap height),
 * and each seat gets its own depth, scale, yaw and cant so the run composes
 * front-to-back instead of left-to-right.
 *
 * The hero is B — the evaluation thread. It is the one the run at Scale AI,
 * SafetyKit and Ramp all point at, so it gets the near seat, the largest
 * scale, and a machined parallel riser that stands its engraved field a step
 * above the other two.
 */
type SignalSeat = {
  x: number;
  z: number;
  /** Yaw toward the lens. Positive turns a camera-left plate to face in. */
  yaw: number;
  /** Cant off the bench, in radians. Drives the block, the lift and the fixture. */
  cant: number;
  scale: number;
  /** Height of the parallel riser under the angle block; 0 seats it on the bench. */
  riser: number;
};

/**
 * Seats, in data order (A, B, C), which is also the left-to-right order the
 * DOM plates under the frame print them in — the two surfaces have to agree
 * about which object is which.
 */
/*
 * One setup in three seats, not three setups.
 *
 * The run used to hold three cants (0.70 / 0.80 / 0.72), three yaws
 * (17° / 2° / −16°), three scales spanning a third, two depths a full 2.3
 * apart, and a riser under exactly one of them — which is a set of accidents,
 * not a staging. The consequences were readable on the render: A's 17° threw
 * its engraved line onto a plane steep enough to shear the letterforms, and C
 * at 0.70 scale two units further back was the smallest, dimmest, most
 * foreshortened thing in the frame.
 *
 * This is the same fixture three times on a symmetric arc: one cant, mirrored
 * ±7.5° of yaw so the outer two turn in without shearing, one plinth design
 * with the hero simply raised higher on it, and the outer pair identical to
 * each other. The hierarchy is now made of height and scale alone — the two
 * things a bench actually uses to say which part is the subject.
 */
const SIGNAL_SEATS: SignalSeat[] = [
  { x: -2.45, z: -0.05, yaw: 0.13, cant: 0.78, scale: 0.84, riser: 0.09 },
  { x: 0, z: 0.42, yaw: 0, cant: 0.78, scale: 0.94, riser: 0.3 },
  { x: 2.45, z: -0.05, yaw: -0.13, cant: 0.78, scale: 0.84, riser: 0.09 },
];

const SIGNAL_HERO = 1;

/*
 * The blank is shorter than it was — 2.55 rather than 3.15. At the old length
 * a third of every plate was bare stock below the pocket, which at 15° read as
 * a plinth and at 45° reads as a plate that has been cut too long. Losing the
 * dead 0.6 also lets each seat carry a larger scale for the same silhouette
 * height, which is texels on the engraving.
 */
const BLANK_WIDTH = 2.2;
const BLANK_LENGTH = 2.25;
const BLANK_THICKNESS = 0.16;
const BLANK_HALF_LENGTH = BLANK_LENGTH / 2;
const BLANK_HALF_THICKNESS = BLANK_THICKNESS / 2;
const POCKET_HEIGHT = 1.54;

/**
 * The lift is not a free parameter: it is exactly the height that puts the
 * canted plate's front-bottom edge back down on its seat, so the blank still
 * *touches* the surface it is standing on.
 */
function blankLift(cant: number) {
  return (
    BLANK_HALF_LENGTH * Math.sin(cant) + BLANK_HALF_THICKNESS * Math.cos(cant)
  );
}

/** Where the plate's front-bottom edge lands in z once it is canted. */
function blankPivotZ(cant: number) {
  return (
    BLANK_HALF_LENGTH * Math.cos(cant) - BLANK_HALF_THICKNESS * Math.sin(cant)
  );
}

/**
 * The angle block's back wall. Follows the cant rather than being fixed: at a
 * steep angle the plate stands up instead of reaching back, and a block cut to
 * a constant depth would trail behind it as a bare wedge.
 */
function blockBackZ(cant: number) {
  return (
    blankPivotZ(cant) - Math.min(1.5, BLANK_LENGTH * Math.cos(cant) + 0.22)
  );
}

/**
 * The angle block the canted plate is seated on: a right-trapezoid prism whose
 * sloped top face lies exactly on the plate's underside, so the two parts touch
 * along a full-length line instead of intersecting. Profile is authored in the
 * (z, y) plane and rotated into place, because ExtrudeGeometry only ever
 * extrudes a XY shape along +Z.
 *
 * Cached per cant rather than once for the set: three seats now hold three
 * different angles, and a block cut for 40° under a plate canted 45° is a
 * plate floating on one edge.
 */
const BLOCK_WIDTH = 1.7;

/**
 * The fixture's base plate: the flat machined foot the angle block is bolted
 * down to, and the part that actually touches the bench.
 *
 * It exists because of what the steep cant does to the silhouette. At 45° the
 * angle block hides completely behind its own plate, so each blank rendered as
 * a rectangle floating in grey with nothing under it — three cards, not three
 * fixtures. The foot is wider than the plate and reaches past its bottom edge,
 * so there is always a machined ledge in frame catching the key, and a hard
 * contact line where it meets the bench.
 */
const FOOT_THICKNESS = 0.08;
const FOOT_WIDTH = BLANK_WIDTH + 0.3;
const FOOT_FRONT_REACH = 0.3;
const FOOT_BACK_REACH = 0.12;

const angleBlocks = new Map<number, THREE.ExtrudeGeometry>();

function getAngleBlock(cant: number) {
  const cached = angleBlocks.get(cant);

  if (cached) {
    return cached;
  }

  /*
   * The block's own footprint has to follow the cant. At a steep angle the
   * plate stands up rather than reaching back, so a fixed 1.95-deep block
   * would stick out behind it as a bare wedge. Both walls are derived from
   * where the plate actually is.
   */
  const pivotZ = blankPivotZ(cant);
  const frontZ = pivotZ - 0.02;
  const backZ = blockBackZ(cant);
  /*
   * Height of the plate's underside above the seat as a function of z. The
   * pivot is the plate's front-bottom corner, which the lift puts exactly on
   * the seat, so the line passes through zero there and rises at tan(cant).
   */
  const underside = (z: number) => (pivotZ - z) * Math.tan(cant);

  const shape = new THREE.Shape();
  shape.moveTo(backZ, 0);
  shape.lineTo(frontZ, 0);
  shape.lineTo(frontZ, underside(frontZ));
  shape.lineTo(backZ, underside(backZ));
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
  angleBlocks.set(cant, geometry);
  return geometry;
}

/**
 * Where the engraved field's centre sits in world space, and which way it
 * looks. The focus lens aims at the first and stands off along the second, so
 * an opened signal is read square-on instead of from wherever the resting
 * three-quarter shot happened to leave the camera.
 *
 * The pocket is milled 0.28 up the plate from its centre, so this is not the
 * plate's midpoint: aiming at the midpoint parks the type in the top half of
 * the frame with a bare foot underneath it.
 */
const SIGNAL_POCKET_OFFSET = 0.16;

function signalPlateCentre(index: number) {
  const seat = SIGNAL_SEATS[index];
  const lift = blankLift(seat.cant);
  /* Local to the blank, before yaw: the plate's local +y runs up the cant. */
  const localY = lift + SIGNAL_POCKET_OFFSET * Math.sin(seat.cant);
  const localZ =
    -SIGNAL_POCKET_OFFSET * Math.cos(seat.cant) +
    (BLANK_HALF_THICKNESS + 0.08) * Math.sin(seat.cant);

  return {
    x: seat.x + seat.scale * localZ * Math.sin(seat.yaw),
    y: seat.scale * (seat.riser + FOOT_THICKNESS + localY),
    z: seat.z + seat.scale * localZ * Math.cos(seat.yaw),
  };
}

/**
 * How high the focus lens rides. Deliberately shallower than the plate's own
 * cant: standing exactly on the face normal is a plan view of a bench, and the
 * shot loses the set it is standing in. 26° is close enough that the type
 * stays within ~18° of square (cos 18° ≈ 0.95) and far enough that the bench
 * is still a bench.
 */
const SIGNAL_FOCUS_ELEVATION = 0.45;
const SIGNAL_FOCUS_FOV = 29;

/**
 * The stand-off is fitted, not fixed. These three plates differ by a third in
 * scale, so a constant distance would frame the hero at 1.2 frame-heights and
 * the far one at two thirds of one — the shot would be a different picture
 * depending on which of three near-identical objects had been clicked.
 *
 * `SIGNAL_FOCUS_FILL` is the fraction of frame height the plate is fitted to.
 * It is bounded below by the elaboration panel, which takes the bottom ~27% of
 * the page and which the plate has to live entirely above. The lens is longer
 * than any other in the file (29° against 33–36) for the same reason it would
 * be on a real bench: a long lens flattens the fixture, throws the
 * neighbouring setups out of frame, and keeps the subject the only thing with
 * perspective in it.
 *
 * 0.66, up from 0.56. The plate is canted 45° and read from 26°, so it loses
 * about 6% of its own height to foreshortening on top of whatever the fill
 * leaves — at 0.56 that put roughly 145 CSS px of empty cove above the
 * subject, which is dead frame directly over a subject the same shot was
 * slicing at its left edge.
 */
const SIGNAL_FOCUS_FILL = 0.66;

/**
 * How far the two unopened fixtures slide down the run when one is opened.
 *
 * The alternative — holding them exactly where they sit — is what amputated
 * the SHIPPING fixture at the frame edge: the focus lens is fitted to the
 * subject, and at any fill tight enough to be a record shot a neighbour two
 * and a half units away lands half in. A subject sliced by the frame edge is
 * the one framing a bench photograph may not have, so the bench opens up
 * around the part under inspection instead — which is what a machinist does
 * with the setups either side of the one being measured.
 */
const SIGNAL_ASIDE = 2.85;

function signalFocusDistance(scale: number) {
  const height = (BLANK_LENGTH * scale) / SIGNAL_FOCUS_FILL;

  return height / (2 * Math.tan((SIGNAL_FOCUS_FOV * Math.PI) / 360));
}

/**
 * The resting lens aims at the hero's own engraved field, dropped a little so
 * the run rides above the DOM band. Derived rather than typed in, so moving
 * the hero seat moves the shot with it instead of leaving a stale magic
 * number pointing at where B used to be.
 */
const SIGNAL_REST_LOOK = signalPlateCentre(SIGNAL_HERO).y - 0.52;

function ExperimentBlank({
  index,
  blankRef,
}: {
  index: number;
  blankRef: (node: THREE.Group | null) => void;
}) {
  const experiment = experiments[index];
  const seat = SIGNAL_SEATS[index];
  const measuring = index === 1;
  const plate = useMemo(
    () => createExperimentPlateTexture(experiment.status, experiment.title),
    [experiment.status, experiment.title],
  );
  const grid = useMemo(() => (measuring ? getDatumGrid() : null), [measuring]);
  const block = useMemo(() => getAngleBlock(seat.cant), [seat.cant]);
  const footFront = blankPivotZ(seat.cant) + FOOT_FRONT_REACH;
  const footBack = blockBackZ(seat.cant) - FOOT_BACK_REACH;
  const footDepth = footFront - footBack;

  return (
    <group
      onClick={(event) => {
        event.stopPropagation();
        setBenchSignalSelection(index);
      }}
      onPointerEnter={(event) => {
        event.stopPropagation();
        setBenchSignalHover(index);
      }}
      onPointerLeave={() => setBenchSignalHover(-1)}
      position={HIDDEN.position}
      ref={blankRef}
      scale={HIDDEN.scale}
    >
      <ContactCore
        depth={footDepth + 0.3}
        opacity={0.9}
        width={FOOT_WIDTH + 0.3}
        y={0.009}
        z={(footFront + footBack) / 2}
      />

      {/*
       * The parallel riser: a plain machined block under the fixture, which is
       * how a shop actually raises one part of a setup above the rest.
       *
       * All three carry one now, at two heights. Only the hero used to have a
       * riser at all, which meant the run was two different plinth designs
       * standing side by side with no shared baseline — the set read as
       * assembled from spare parts. One plinth at 0.09 and 0.30 says the same
       * thing about hierarchy with a difference in height, not in kind.
       */}
      {seat.riser > 0 ? (
        <RoundedBox
          args={[FOOT_WIDTH - 0.24, seat.riser, footDepth - 0.3]}
          castShadow
          position={[0, seat.riser / 2, (footFront + footBack) / 2 - 0.05]}
          radius={0.02}
          receiveShadow
          smoothness={3}
        >
          <AluminumMaterial
            color={ALUMINUM_DARK}
            envMapIntensity={0.7}
            roughness={0.44}
          />
        </RoundedBox>
      ) : null}

      {/* The fixture's base plate — the part that touches the bench. */}
      <RoundedBox
        args={[FOOT_WIDTH, FOOT_THICKNESS, footDepth]}
        castShadow
        position={[
          0,
          seat.riser + FOOT_THICKNESS / 2,
          (footFront + footBack) / 2,
        ]}
        radius={0.014}
        receiveShadow
        smoothness={3}
      >
        <AluminumMaterial
          color={ALUMINUM_BRIGHT}
          envMapIntensity={0.95}
          roughness={0.34}
        />
      </RoundedBox>

      <group position={[0, seat.riser + FOOT_THICKNESS, 0]}>
        {/* Machined angle block: the plate's seat, and the thing it touches. */}
        <mesh castShadow geometry={block} receiveShadow>
          <AluminumMaterial
            color={ALUMINUM_DARK}
            envMapIntensity={0.9}
            roughness={0.42}
          />
        </mesh>

        <group
          position={[0, blankLift(seat.cant), 0]}
          rotation={[-Math.PI / 2 + seat.cant, 0, 0]}
        >
          <RoundedBox
            args={[BLANK_WIDTH, BLANK_LENGTH, BLANK_THICKNESS]}
            castShadow
            radius={0.05}
            receiveShadow
            smoothness={3}
          >
            {/*
             * Light brushed aluminum, in the BENCH_TOP value band — the plate
             * is the brightest metal on the bench and the pocket cut into it
             * is what carries the darkness.
             *
             * envMapIntensity is down from 1.15 to 0.72 and roughness up from
             * 0.36 to 0.46, and that is a consequence of the cant rather than
             * a taste change. Lying at 15° the face sampled the cubemap near
             * grazing and came back mid-grey; standing at 45° it points into
             * the softbox and at 1.15 the whole plate clipped to paper white,
             * taking the chamfer, the brushing and the pocket lip with it.
             */}
            <AluminumMaterial
              color="#c4c6c8"
              envMapIntensity={0.72}
              roughness={0.46}
            />
          </RoundedBox>
          <ChamferBand
            args={[BLANK_WIDTH, BLANK_LENGTH, BLANK_THICKNESS]}
            radius={0.05}
            smoothness={3}
          />

          {grid ? (
            <mesh position={[0, 0, 0.0805]}>
              <planeGeometry args={[2.02, BLANK_LENGTH - 0.18]} />
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
           * The data plate: a pocket milled into the top face, its floor a step
           * down from the blank, carrying the experiment's status and title as
           * cut metal. A blank with nothing on it cannot be the subject of a
           * view — this is the content, straight out of conceptData.
           *
           * The pocket grew from 2.02x1.40 to 2.02x1.54 and the type inside it
           * from 82px to 92px on a taller canvas, which is the other half of
           * the legibility fix: the cant buys back the foreshortening, and the
           * bigger field buys back the texels the smaller seat scales cost.
           */}
          {/*
           * Pocket: a bright machined lip ring around a floor held a step under
           * the plate face, so the recess reads by value rather than by outline.
           */}
          <mesh position={[0, SIGNAL_POCKET_OFFSET, 0.0802]}>
            <planeGeometry args={[2.06, POCKET_HEIGHT + 0.04]} />
            <meshStandardMaterial
              color="#d2d4d6"
              envMapIntensity={1.3}
              metalness={1}
              roughness={0.24}
            />
          </mesh>
          <mesh position={[0, SIGNAL_POCKET_OFFSET, 0.0806]}>
            <planeGeometry args={[2.02, POCKET_HEIGHT]} />
            <meshStandardMaterial
              color="#9fa1a3"
              envMapIntensity={0.85}
              metalness={1}
              roughness={0.55}
            />
          </mesh>
          {/*
           * Same lip-highlight / darkened-floor pair the tag plates use.
           * At the default 0.34 lip and 0.6 floor the SHIPPING / MEASURING /
           * COLLECTING labels carried about 8% local contrast against the
           * pocket — invisible at the signals distance. At lipMix 0.54 /
           * floor 0.26 each glyph gets a bright machined edge over a cut a
           * quarter of the pocket's value, which is roughly 55% local
           * contrast.
           */}
          {/*
           * Filled, like the employer tags. A bare groove in a mid-grey pocket
           * puts grey type on grey metal, which is what left the far fixture's
           * line the least readable thing in the frame at the resting camera.
           * The channel now carries ink at metalness 0, so the field reads at
           * the same weight from the browse shot and the record shot alike.
           */}
          <EngravedDecal
            alpha={plate}
            cutColor="#1e1f21"
            cutMetalness={0}
            envMapIntensity={0.85}
            height={POCKET_HEIGHT - 0.12}
            hostColor="#9fa1a3"
            lipMix={0.42}
            offset={0.0026}
            position={[0, SIGNAL_POCKET_OFFSET + 0.01, 0.081]}
            roughness={0.55}
            width={1.86}
          />

          {/*
           * The foot of the blank is left as bare stock. It used to carry a
           * 0.92-unit embossed A / B / C — a single-character index badge,
           * which is exactly the numbered-badge pattern this set is not
           * allowed to use, and it was competing with the data plate for value
           * besides.
           */}
        </group>
      </group>
    </group>
  );
}

/* -------------------------------------------------------------------------- */
/* History chips                                                                */
/* -------------------------------------------------------------------------- */

/*
 * The card is 1.18 x 1.5 and its face is laid out top-down: a 16:9 capture
 * window under a 0.06 margin, a palette mat strip beneath it, and the printed
 * catalogue block filling the rest. Every number below is in the card group's
 * own space, where the card body is centred at CARD_CENTER_Y.
 *
 * The capture used to be 0.92 wide inside a 1.06 card whose printed block was
 * a third *taller* than the picture — at the browse camera that made each era
 * a 130x90 CSS px thumbnail, and four of the seven eras are dark screens with
 * one orange accent, so Scene, Orbital, Dusk and Proof all resolved to the
 * same dark rectangle. The card is 8% wider and 3% shorter, the printed block
 * gives up 0.1 of its height, and the capture takes all of it: ~150x84 px at
 * the same lens against the old 130x73.
 *
 * The width is bounded by a hard number rather than by taste — the run's pitch
 * floors at HISTORY_MIN_SPACING and a hovered card grows 1.232x, so any body
 * past ~1.15 makes a hovered card overlap the one standing beside it.
 */
const CARD_BODY_W = 1.14;
const CARD_BODY_H = 1.5;
const CARD_CENTER_Y = 0.755;
const CARD_INNER_W = 1.02;
const CARD_TOP_Y = 1.44;
const SHOT_H = (CARD_INNER_W * 9) / 16;
const SHOT_CENTER_Y = CARD_TOP_Y - SHOT_H / 2;
const PALETTE_H = 0.05;
const PALETTE_CENTER_Y = CARD_TOP_Y - SHOT_H - 0.028 - PALETTE_H / 2;
const CARD_TEXT_H = PALETTE_CENTER_Y - PALETTE_H / 2 - 0.045 - 0.07;
const CARD_TEXT_CENTER_Y = 0.07 + CARD_TEXT_H / 2;

/** 1 at the key end of the run (camera-left), 0 at the far end. See below. */
function historyKey(index: number) {
  const span = Math.max(1, historyEras.length - 1) * HISTORY_SPACING;

  return THREE.MathUtils.clamp(
    0.5 -
      ((index - (historyEras.length - 1) / 2) * HISTORY_SPACING) / (span * 1.5),
    0,
    1,
  );
}

/**
 * Warms the era captures on the gesture that asks for them, and flips the
 * sticky flag that mounts them into the scene. Both halves belong to the same
 * moment: the nav click is the first honest signal that this run is wanted.
 */
export function preloadHistoryShots() {
  markBenchHistoryLive();

  if (historyShots.length > 0) {
    useTexture.preload(historyShots);
  }
}

/**
 * The capture, seated in the card's window. Its own component because it
 * suspends: the six images are only ever fetched once someone has actually
 * opened the history view, and an idle work shot pays nothing for them.
 */
function EraShot({ url }: { url: string }) {
  const [texture] = useConfiguredTextures([url]);

  return (
    <mesh position={[0, SHOT_CENTER_Y, 0.0265]}>
      <planeGeometry args={[CARD_INNER_W, SHOT_H]} />
      <meshStandardMaterial
        envMapIntensity={0.85}
        map={texture}
        metalness={0}
        roughness={0.44}
      />
    </mesh>
  );
}

/** What stands in the window while a capture loads, or when there is none. */
function EraShotBlank({ palette }: { palette: THREE.Texture }) {
  return (
    <mesh position={[0, SHOT_CENTER_Y, 0.0265]}>
      <planeGeometry args={[CARD_INNER_W, SHOT_H]} />
      <meshStandardMaterial
        envMapIntensity={0.9}
        map={palette}
        metalness={0}
        roughness={0.42}
      />
    </mesh>
  );
}

function HistoryArtifact({
  index,
  artifactRef,
  shot,
}: {
  index: number;
  artifactRef: (node: THREE.Group | null) => void;
  /** Null until the history view has been opened at least once. */
  shot: string | null;
}) {
  const era = historyEras[index];
  /*
   * This card's place on the run's value ramp.
   *
   * Seven identical white cards evenly spaced across 1300 CSS px, every one of
   * them the same luminance from the first to the last, is the single clearest
   * piece of evidence for the standing "no readable key-light direction"
   * complaint — a real key at [-6.5, 7, 3.2] rakes a run this wide and puts a
   * clear gradient down it. The renderer will not produce that on its own:
   * a distant directional hitting seven coplanar cards returns seven identical
   * values. So the falloff is authored, on the two surfaces that carry it —
   * the card stock's diffuse value, and the plinth rail's specular, which is
   * what makes the far end of the run read as further from the lamp rather
   * than merely darker.
   */
  const key = historyKey(index);
  const stock = useMemo(
    () =>
      `#${new THREE.Color('#e9eaea')
        .multiplyScalar(0.9 + key * 0.18)
        .getHexString()}`,
    [key],
  );
  const palette = useMemo(
    () => createPaletteTexture(era.palette),
    [era.palette],
  );
  const placard = useMemo(
    () =>
      createEraPlacardTexture(
        era,
        era.provisional
          ? `${era.visualLanguage} · not yet named`
          : era.visualLanguage,
      ),
    [era],
  );

  return (
    <group
      onClick={(event) => {
        event.stopPropagation();
        setBenchHistorySelection(index);
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
          envMapIntensity={1.15 + key * 0.95}
          metalness={0.78}
          roughness={0.29 - key * 0.08}
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
          args={[CARD_BODY_W, CARD_BODY_H, 0.05]}
          castShadow
          position={[0, CARD_CENTER_Y, 0]}
          radius={0.02}
          smoothness={3}
        >
          <meshStandardMaterial
            color={stock}
            envMapIntensity={0.68 + key * 0.28}
            metalness={0}
            roughness={0.55}
          />
        </RoundedBox>
        {/*
         * The mount: a 0.004 white lip around the capture window, printed the
         * way card stock is printed — not an unlit Keynote fill. It is what
         * catches the overhead softbox and stops the block reading as vertex
         * colour on a primitive, and it is also the frame that tells you the
         * image inside it is a photograph and not the card's own surface.
         */}
        <mesh position={[0, SHOT_CENTER_Y, 0.0262]}>
          <planeGeometry args={[CARD_INNER_W + 0.016, SHOT_H + 0.016]} />
          <meshStandardMaterial
            color="#f4f4f3"
            envMapIntensity={1.3}
            metalness={0}
            roughness={0.3}
          />
        </mesh>
        {/*
         * The era itself: a real capture of this state of the site. The archive
         * is photographed from the museum miniatures — DOM rebuilds of these
         * exact commits — and the current build is photographed from the
         * running site. When no capture exists the window falls back to the
         * palette bands rather than inventing a screenshot.
         */}
        {shot ? (
          <Suspense fallback={<EraShotBlank palette={palette} />}>
            <EraShot url={shot} />
          </Suspense>
        ) : (
          <EraShotBlank palette={palette} />
        )}
        {/*
         * The palette survives as a mat strip under the window — five threads
         * of the era's real colour, at a scale that reads as a swatch rather
         * than as the subject. The capture is the subject now.
         */}
        <mesh position={[0, PALETTE_CENTER_Y, 0.0265]}>
          <planeGeometry args={[CARD_INNER_W, PALETTE_H]} />
          <meshStandardMaterial
            envMapIntensity={0.9}
            map={palette}
            metalness={0}
            roughness={0.42}
          />
        </mesh>
        <mesh position={[0, CARD_TEXT_CENTER_Y, 0.0265]}>
          <planeGeometry args={[CARD_INNER_W, CARD_TEXT_H]} />
          <meshStandardMaterial
            map={placard}
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

/* -------------------------------------------------------------------------- */
/* Side projects gallery                                                        */
/* -------------------------------------------------------------------------- */

/**
 * The hang: a standing rack on the bench with two cross rails, eight framed
 * plates suspended from them on hairline wires. A rack rather than a wall,
 * because this set has no near wall — the cove is thirteen units back — and a
 * frame floating in air with nothing holding it is the one thing a gallery
 * never shows you.
 *
 * Real screenshots only. The single piece with no capture in public/projects
 * gets a stated "no capture" plate rather than an invented one.
 */
const GALLERY_COLUMNS = 4;
const FRAME_INNER_W = 1.16;
const FRAME_INNER_H = FRAME_INNER_W * (9 / 16);
/*
 * 0.105, not 0.09. The bottom rail is the piece's label, and a printed label
 * needs a margin above and below the type or it reads as crowded against the
 * artwork with bare mount under it. At 0.105 the 0.087 title strip sits with
 * an even 0.009 of moulding on both sides of it — optically centred in its own
 * rail, which is what a hung label is.
 */
const FRAME_BORDER = 0.105;
const FRAME_OUTER_W = FRAME_INNER_W + FRAME_BORDER * 2;
const FRAME_OUTER_H = FRAME_INNER_H + FRAME_BORDER * 2;
const FRAME_PITCH_X = FRAME_OUTER_W + 0.2;
/*
 * Eight 16:9 frames in four columns is a 2.7-aspect subject inside a 1.6
 * viewport, which parks the whole hang in the top half and leaves a dead lower
 * third. The extra 0.28 of row pitch spends that slack on air between the rows
 * instead — the vertical proportions of an actual gallery wall.
 */
const FRAME_PITCH_Y = FRAME_OUTER_H + 0.62;
const FRAME_TOP_Y = 3.15;
const FRAME_Z = -0.7;
/** Wire drop from a rail to the frame hanging off it. */
const WIRE_DROP = 0.26;

/**
 * The wall's key, as a value ramp across the hang.
 *
 * The studio key stands at [-6.5, 7, 3.2] aimed at origin, so on a subject
 * five units wide it is a raking light: the camera-left frames stand nearer
 * the lamp and the camera-right ones fall away. None of that reached the hang,
 * because eight frames lit by one distant directional at near-normal
 * incidence all return the same value — the row read as a texture dump, flat
 * from edge to edge. This is that falloff, applied where the renderer will not
 * produce it: to each frame's moulding value and to its own display gain, so
 * the wall has a lit side and a shadow side the way a hang always does.
 *
 * 1 at the key, 0 at the far edge.
 */
const GALLERY_KEY_SPAN = FRAME_PITCH_X * (GALLERY_COLUMNS - 1);

function galleryKey(x: number) {
  return THREE.MathUtils.clamp(0.5 - x / (GALLERY_KEY_SPAN * 1.4), 0, 1);
}

/** Display exposure at the shadow end of the ramp, and how far it climbs. */
const GALLERY_GAIN_BASE = 0.9;
const GALLERY_GAIN_RAMP = 0.26;
/** What an unselected piece falls to while one of its neighbours is open. */
const GALLERY_GAIN_STANDDOWN = 0.62;
/** Posts stand clear of the outermost frame rather than through it. */
const RAIL_HALF_SPAN =
  (FRAME_PITCH_X * (GALLERY_COLUMNS - 1)) / 2 + FRAME_OUTER_W / 2 + 0.3;

/** Only the pieces that actually have a capture ever reach `useTexture`. */
const GALLERY_IMAGES: string[] = sideProjects
  .map((piece) => piece.image)
  .filter((image): image is string => image !== null);

const GALLERY_ROWS = Math.ceil(sideProjects.length / GALLERY_COLUMNS);

type GallerySeat = { x: number; y: number };

const GALLERY_SEATS: GallerySeat[] = sideProjects.map((_, index) => {
  const column = index % GALLERY_COLUMNS;
  const row = Math.floor(index / GALLERY_COLUMNS);

  return {
    x: (column - (GALLERY_COLUMNS - 1) / 2) * FRAME_PITCH_X,
    y: FRAME_TOP_Y - row * FRAME_PITCH_Y,
  };
});

/**
 * Where a focused piece steps to: forward of the hang and camera-left of
 * centre, leaving the right of the frame for its wall label. Below the work
 * would have been the more usual arrangement and it does not survive here —
 * the DOM detail band owns the bottom 260 CSS of every view, and a label
 * hung under the piece lands inside it.
 */
/*
 * Raised from 2.58 and eased from 1.4x. A 1.4x plate at 2.58 hung its own
 * printed label straight across the DocuPilot piece in the row below — the one
 * thing a step-forward may not do is deface the work it steps in front of. At
 * 2.86 and 1.3x, with the hang recessed further behind it, the focused piece's
 * bottom rail clears the second row's top rail by about 40 CSS px at the
 * focus camera, so the overlap that remains is depth rather than overprint.
 */
const GALLERY_FOCUS: Transform = {
  position: [-0.62, 2.86, 1.5],
  rotation: [0, 0, 0],
  scale: 1.3,
};
/** Camera height and look for the focused shot; the piece is staged around it. */
const GALLERY_FOCUS_EYE = 2.62;

const PLACARD_W = 1.36;
const PLACARD_H = PLACARD_W * (560 / 1200);
const PLACARD_SEAT: [number, number, number] = [1.12, 2.72, 1.5];

/** Collapsed pose, small enough that `dampTransform` culls the group. */
const GALLERY_STOWED_SCALE = 0.05;

/**
 * Distance that fits a given half-width into the *actual* canvas aspect.
 *
 * A fixed camera z only ever frames one aspect ratio. Eight frames across is a
 * wide subject, and at 4:3 a distance tuned for 16:10 sliced the outer two
 * exhibits down their edges — the one thing a gallery hang cannot do. Vertical
 * fov is the fixed quantity in a perspective camera, so the horizontal fit has
 * to be solved for the distance instead.
 */
function galleryDistance(fov: number, aspect: number, halfWidth: number) {
  const vertical = halfWidth / Math.max(aspect, 0.5);

  return THREE.MathUtils.clamp(
    vertical / Math.tan((fov * Math.PI) / 360),
    4.4,
    16,
  );
}

/** Half-width of the framed hang, plus the margin a wall gives its outer works. */
const GALLERY_FIT_HALF =
  (FRAME_PITCH_X * (GALLERY_COLUMNS - 1)) / 2 + FRAME_OUTER_W / 2 + 0.34;
/** Focused piece on the left, its wall label on the right. */
const GALLERY_FOCUS_FIT_HALF = 2.3;

function galleryFrameTarget(
  index: number,
  gallery: { open: boolean; piece: number },
): Transform {
  if (!gallery.open) {
    const seat = GALLERY_SEATS[index];
    return {
      position: [seat.x, seat.y, FRAME_Z],
      rotation: [0, 0, 0],
      scale: GALLERY_STOWED_SCALE,
    };
  }

  if (gallery.piece === index) {
    return GALLERY_FOCUS;
  }

  const seat = GALLERY_SEATS[index];

  /*
   * The unfocused pieces do not merely stay put — they step back three
   * quarters of a unit and shrink, so the focused plate reads as pulled out of
   * a hang rather than pasted over one. The recede is deep enough to be a
   * depth cue at the focus camera's 6.4-unit stand-off; at the old 0.34 the
   * parallax was under two percent and the step forward read as scale alone.
   */
  const recessed = gallery.piece >= 0;

  return {
    position: [seat.x, seat.y, recessed ? FRAME_Z - 0.75 : FRAME_Z],
    rotation: [0, 0, 0],
    scale: recessed ? 0.84 : 1,
  };
}

function GalleryFrame({
  index,
  piece,
  texture,
  frameRef,
  screenRef,
}: {
  index: number;
  piece: SideProject;
  texture: THREE.Texture;
  frameRef: (node: THREE.Group | null) => void;
  screenRef: (node: THREE.ShaderMaterial | null) => void;
}) {
  const title = useMemo(() => getFrameTitleTexture(piece.title), [piece.title]);
  /*
   * This frame's place on the wall's value ramp. Everything the key touches
   * comes off it: the moulding, the backing board, the wire, and the display's
   * own gain.
   */
  const key = galleryKey(GALLERY_SEATS[index].x);
  const moulding = useMemo(
    () =>
      new THREE.Color(ALUMINUM).multiplyScalar(0.84 + key * 0.3).getHexString(),
    [key],
  );
  const border = useMemo(
    () =>
      getBezelRing(
        FRAME_OUTER_W,
        FRAME_OUTER_H,
        FRAME_INNER_W,
        FRAME_INNER_H,
        0.014,
        0.006,
        0.05,
      ),
    [],
  );

  return (
    <group
      onClick={(event) => {
        event.stopPropagation();
        setBenchGalleryPiece(index);
      }}
      position={[GALLERY_SEATS[index].x, GALLERY_SEATS[index].y, FRAME_Z]}
      ref={frameRef}
      scale={GALLERY_STOWED_SCALE}
    >
      {/* Two hairline wires up to the rail this row hangs from. */}
      {[-FRAME_OUTER_W / 2 + 0.09, FRAME_OUTER_W / 2 - 0.09].map((x) => (
        <mesh key={x} position={[x, FRAME_OUTER_H / 2 + WIRE_DROP / 2, -0.02]}>
          <cylinderGeometry args={[0.007, 0.007, WIRE_DROP, 6]} />
          <AluminumMaterial
            color={ALUMINUM_DARK}
            envMapIntensity={1.6}
            roughness={0.22}
          />
        </mesh>
      ))}

      {/* Frame moulding, at this frame's place on the wall's value ramp. */}
      <mesh castShadow geometry={border} position={[0, 0, -0.025]}>
        <AluminumMaterial
          color={`#${moulding}`}
          envMapIntensity={1.1 + key * 0.7}
          roughness={0.24}
        />
      </mesh>
      {/* Backing board, so the frame is a box and not a window. */}
      <mesh position={[0, 0, -0.03]}>
        <planeGeometry args={[FRAME_INNER_W, FRAME_INNER_H]} />
        <meshStandardMaterial color="#2a2c2e" roughness={0.6} />
      </mesh>

      <Screen
        gain={GALLERY_GAIN_BASE + key * GALLERY_GAIN_RAMP}
        height={FRAME_INNER_H}
        materialRef={screenRef}
        position={[0, 0, 0.006]}
        radius={0.004}
        seed={index * 0.17}
        texture={texture}
        width={FRAME_INNER_W}
      />
      <GlassCover
        height={FRAME_INNER_H}
        position={[0, 0, 0.02]}
        radius={0.004}
        width={FRAME_INNER_W}
      />

      {/*
       * The printed label on the bottom rail. depthWrite off and lit flat:
       * this is pigment lying on the moulding, so it must not take the
       * moulding's specular and must never sort against it.
       */}
      <mesh position={[0, -FRAME_OUTER_H / 2 + FRAME_BORDER / 2, 0.0262]}>
        <planeGeometry args={[FRAME_TITLE_W, FRAME_TITLE_H]} />
        <meshStandardMaterial
          depthWrite={false}
          envMapIntensity={0.25}
          map={title}
          metalness={0}
          roughness={0.75}
          transparent
        />
      </mesh>
    </group>
  );
}

/**
 * The wall label. It stays mounted with a null map between selections so it can
 * damp back out instead of vanishing the instant the focus clears.
 */
function GalleryPlacard({
  placardRef,
  piece,
}: {
  placardRef: (node: THREE.Group | null) => void;
  piece: SideProject | null;
}) {
  const texture = useMemo(
    () => (piece ? getPlacardTexture(piece) : null),
    [piece],
  );

  return (
    <group
      position={PLACARD_SEAT}
      ref={placardRef}
      scale={GALLERY_STOWED_SCALE}
    >
      <RoundedBox
        args={[PLACARD_W, PLACARD_H, 0.026]}
        castShadow
        radius={0.006}
        smoothness={3}
      >
        <meshStandardMaterial
          color="#c9cbcc"
          envMapIntensity={1.2}
          metalness={0.35}
          roughness={0.42}
        />
      </RoundedBox>
      {/*
       * Keyed and conditional, both deliberately. A material whose `map` flips
       * between null and a texture needs a shader recompile that three will not
       * do on its own — the label rendered as a blank white plate. Mounting a
       * fresh material per piece sidesteps it entirely.
       */}
      {texture && piece ? (
        <mesh key={piece.title} position={[0, 0, 0.0141]}>
          <planeGeometry args={[PLACARD_W, PLACARD_H]} />
          <meshStandardMaterial
            envMapIntensity={0.7}
            map={texture}
            metalness={0.08}
            roughness={0.58}
          />
        </mesh>
      ) : null}
    </group>
  );
}

/**
 * The rack and its eight frames. Mounted only while `gallery.mounted` is true,
 * which is what keeps an idle work shot from paying for eight screenshots, and
 * suspended on its own so a texture decode never blanks the rest of the set.
 */
function GalleryHang({ reducedMotion }: { reducedMotion: boolean }) {
  const gallery = useSyncExternalStore(
    subscribeBenchGallery,
    readBenchGallery,
    readBenchGallery,
  );
  const images = useConfiguredTextures(GALLERY_IMAGES);
  const frames = useRef<(THREE.Group | null)[]>([]);
  const screens = useRef<(THREE.ShaderMaterial | null)[]>([]);
  const placard = useRef<THREE.Group | null>(null);
  const rack = useRef<THREE.Group | null>(null);

  useLayoutEffect(
    () => () => {
      setBenchSettled('gallery', true);
    },
    [],
  );

  const textures = useMemo(() => {
    let cursor = 0;

    return sideProjects.map((piece) =>
      piece.image
        ? images[cursor++]
        : getPlaceholderTexture(piece.title, piece.tech),
    );
  }, [images]);

  const focused = gallery.piece >= 0 ? sideProjects[gallery.piece] : null;

  useFrame(({ gl, invalidate }, rawDelta) => {
    const delta = Math.min(rawDelta, 1 / 30);
    const state = readBenchGallery();
    let geometryMotion = 0;
    let screenMotion = 0;

    frames.current.forEach((frame, index) => {
      if (!frame) {
        return;
      }

      const target = galleryFrameTarget(index, state);
      geometryMotion = Math.max(
        geometryMotion,
        dampTransform(
          frame,
          target,
          transitLambda(target, reducedMotion),
          delta,
        ),
      );
    });

    /*
     * The stand-down. A hang with one piece pulled out of it does not stay
     * evenly lit — the attention light goes to the piece and its neighbours
     * fall away. Damped on the display's own gain rather than on a material
     * colour so it costs one uniform write per frame and nothing at rest.
     */
    screens.current.forEach((material, index) => {
      if (!material) {
        return;
      }

      const base =
        GALLERY_GAIN_BASE +
        galleryKey(GALLERY_SEATS[index].x) * GALLERY_GAIN_RAMP;
      const target =
        state.piece < 0 || state.piece === index
          ? base
          : base * GALLERY_GAIN_STANDDOWN;
      const uniform = material.uniforms.uGain;

      if (Math.abs(uniform.value - target) > 0.0015) {
        uniform.value = damp(
          uniform.value,
          target,
          reducedMotion ? 60 : 6,
          delta,
        );
        screenMotion = Math.max(screenMotion, Math.abs(uniform.value - target));
      }
    });

    if (rack.current) {
      const target: Transform = state.open
        ? { position: [0, 0, 0], rotation: [0, 0, 0], scale: 1 }
        : {
            position: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: GALLERY_STOWED_SCALE,
          };
      geometryMotion = Math.max(
        geometryMotion,
        dampTransform(
          rack.current,
          target,
          transitLambda(target, reducedMotion),
          delta,
        ),
      );
    }

    if (placard.current) {
      const target: Transform =
        state.open && state.piece >= 0
          ? { position: PLACARD_SEAT, rotation: [0, 0, 0], scale: 1 }
          : {
              position: [
                PLACARD_SEAT[0],
                PLACARD_SEAT[1] - 0.2,
                PLACARD_SEAT[2],
              ],
              rotation: [0, 0, 0],
              scale: GALLERY_STOWED_SCALE,
            };
      geometryMotion = Math.max(
        geometryMotion,
        dampTransform(
          placard.current,
          target,
          transitLambda(target, reducedMotion),
          delta,
        ),
      );
    }

    const motion = Math.max(geometryMotion, screenMotion);
    setBenchSettled('gallery', motion < MOTION_EPSILON);

    if (geometryMotion > 0) {
      gl.shadowMap.needsUpdate = true;
    }
    if (motion >= 0.0015) {
      invalidate();
    }
  });

  return (
    <group>
      {/*
       * Standing rack: two posts on machined feet, one rail per row.
       *
       * No per-foot ContactCore, unlike every other object on this bench, and
       * it is not an oversight. The core's ground planes are horizontal and
       * depth-write-off; the gallery lens looks level rather than down at the
       * bench, so at that grazing incidence each one smeared a translucent wash
       * across the whole hang and greyed out all eight screenshots. The feet
       * are below the DOM band in every gallery framing anyway, and the shared
       * final contact-shadow bake already catches them.
       */}
      <group ref={rack} scale={GALLERY_STOWED_SCALE}>
        {[-RAIL_HALF_SPAN, RAIL_HALF_SPAN].map((x) => (
          <group key={x} position={[x, 0, FRAME_Z]}>
            <RoundedBox
              args={[0.34, 0.05, 0.62]}
              castShadow
              position={[0, 0.025, 0]}
              radius={0.01}
              receiveShadow
              smoothness={3}
            >
              <AluminumMaterial
                color={ALUMINUM_BRIGHT}
                envMapIntensity={1.7}
                metalness={0.8}
                roughness={0.24}
              />
            </RoundedBox>
            <mesh castShadow position={[0, (FRAME_TOP_Y + 0.72) / 2, 0]}>
              <boxGeometry args={[0.07, FRAME_TOP_Y + 0.72, 0.07]} />
              <AluminumMaterial envMapIntensity={1.4} roughness={0.3} />
            </mesh>
          </group>
        ))}

        {Array.from({ length: GALLERY_ROWS }, (_, row) => (
          <mesh
            castShadow
            key={row}
            position={[
              0,
              FRAME_TOP_Y - row * FRAME_PITCH_Y + FRAME_OUTER_H / 2 + WIRE_DROP,
              FRAME_Z - 0.02,
            ]}
          >
            <boxGeometry args={[RAIL_HALF_SPAN * 2, 0.05, 0.05]} />
            <AluminumMaterial
              color={ALUMINUM_BRIGHT}
              envMapIntensity={1.9}
              roughness={0.18}
            />
          </mesh>
        ))}
      </group>

      {sideProjects.map((piece, index) => (
        <GalleryFrame
          frameRef={(node) => {
            frames.current[index] = node;
          }}
          index={index}
          key={piece.title}
          piece={piece}
          screenRef={(node) => {
            screens.current[index] = node;
          }}
          texture={textures[index]}
        />
      ))}

      <GalleryPlacard
        piece={focused}
        placardRef={(node) => {
          placard.current = node;
        }}
      />
    </group>
  );
}

type CameraShot = {
  position: [number, number, number];
  look: number;
  /**
   * Depth of the look target. Every bench lens aims at the z 0 datum and so
   * leaves this alone; a focused tag is the exception, because it hangs a unit
   * behind that datum and a level shot aimed at z 0 would look past it.
   */
  lookZ?: number;
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
const MOTION_EPSILON = 0.004;

function transitLambda(target: Transform, reducedMotion: boolean) {
  if (reducedMotion) {
    return 80;
  }

  return target.scale <= HIDDEN.scale ? LAMBDA_OUT : LAMBDA_IN;
}

function angleDistance(current: number, target: number) {
  const difference = current - target;
  return Math.abs(Math.atan2(Math.sin(difference), Math.cos(difference)));
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

  const remaining =
    Math.abs(group.position.x - target.position[0]) +
    Math.abs(group.position.y - target.position[1]) +
    Math.abs(group.position.z - target.position[2]) +
    angleDistance(group.rotation.x, target.rotation[0]) +
    angleDistance(group.rotation.y, target.rotation[1]) +
    angleDistance(group.rotation.z, target.rotation[2]) +
    Math.abs(group.scale.x - target.scale);

  if (remaining > 0 && remaining < MOTION_EPSILON) {
    group.position.set(...target.position);
    group.rotation.set(...target.rotation);
    group.scale.setScalar(target.scale);
  }

  return remaining;
}

/**
 * ContactShadows performs a depth render plus blur renders for every requested
 * frame. Keep it off while anything is damping, then bake the final pose once.
 * Drei resets its internal counter on re-render, so flipping `frames` from 0
 * to 1 captures the aggregate settled pose and stops.
 *
 * This is one low-opacity contact pass. The directional light remains the main
 * source of shadow direction and softness.
 */
function GroundShadows({ mobile }: { mobile: boolean }) {
  const settled = useSyncExternalStore(
    subscribeBenchSettled,
    readBenchSettled,
    readBenchSettled,
  );
  const frames = settled ? 1 : 0;

  if (isAblated('contact')) {
    return null;
  }

  return (
    /*
     * The wider depth range catches the stands while modest opacity keeps this
     * pass secondary to the directional shadow.
     */
    <ContactShadows
      blur={2.6}
      color="#5c6064"
      far={0.85}
      frames={frames}
      opacity={0.26}
      /* Offset along the key's ground vector so it agrees with the directional. */
      position={[0.22, 0.005, -0.1]}
      resolution={mobile ? 256 : 512}
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
  const invalidate = useThree((state) => state.invalidate);
  useLayoutEffect(() => invalidate(), [invalidate, view]);
  const gallery = useSyncExternalStore(
    subscribeBenchGallery,
    readBenchGallery,
    readBenchGallery,
  );
  const projectTextures = useConfiguredTextures(
    featuredProjects.map((project) => project.image),
  );
  const projects = useRef<(THREE.Group | null)[]>([]);
  const projectMaterials = useRef<(THREE.ShaderMaterial | null)[]>([]);
  const blanks = useRef<(THREE.Group | null)[]>([]);
  const artifacts = useRef<(THREE.Group | null)[]>([]);
  /*
   * Sticky, and held in the store rather than in this component: the era
   * captures are seven full-frame PNGs, an idle work shot must not pay for
   * them, and once they are in the scene they have to stay — dropping them on
   * exit would blank the cards mid-transit. Set by the nav gesture, or by the
   * frame loop below when someone lands on /#history directly.
   */
  const historyState = useSyncExternalStore(
    subscribeBenchHistory,
    readBenchHistory,
    readBenchHistory,
  );
  const badge = useRef<THREE.Group | null>(null);
  const tagRack = useRef<THREE.Group | null>(null);
  const tablet = useRef<THREE.Group | null>(null);
  const cameraLook = useRef(new THREE.Vector3());
  const cameraRoll = useRef(0);
  const transit = useRef({
    /*
     * A shot key, not a view id: the gallery and its focused state are extra
     * setups inside `work`, and each one earns the same arc-and-settle transit
     * a view change gets.
     */
    view: null as string | null,
    from: new THREE.Vector3(),
    control: new THREE.Vector3(),
    t: 1,
  });

  useFrame(({ camera, gl, invalidate }, rawDelta) => {
    const delta = Math.min(rawDelta, 1 / 30);
    const lambda = reducedMotion ? 80 : 3.2;
    const galleryState = readBenchGallery();
    /*
     * The gallery only ever exists inside the work view. Leaving that view by
     * any route — nav, hash, browser history — closes it, so there is no way
     * to strand the camera in a sub-view the chrome no longer offers an exit
     * from.
     */
    if (view !== 'work' && galleryState.open) {
      closeBenchGallery();
    }

    if (view !== 'work') {
      clearBenchTagSelection();
    }

    /*
     * Same contract the gallery has: leaving the view by any route — nav,
     * hash, browser history — closes the sub-view, so there is no way to
     * strand the camera on an object the chrome no longer offers an exit from.
     */
    if (view !== 'signals') {
      clearBenchSignalSelection();
    }

    const inGallery = view === 'work' && galleryState.open;
    const workFocus = readBenchFocus('work');
    /*
     * Mobile never opens a tag: the rack is not mounted there at all (four
     * marks at that camera distance render as four smudges, and an illegible
     * mark is worse than no mark), so there is nothing for the lens to fly to.
     * The DOM rail degrades to a caption to match.
     */
    const focusedTag =
      view === 'work' && !inGallery && !mobile ? readBenchTags().selected : -1;
    /*
     * Mobile keeps the resting three-quarter shot and never opens a signal,
     * for the same reason it never opens a tag: at that camera distance the
     * elaboration would be a full-height DOM panel over a plate the lens has
     * no room to fly to. The DOM list stays a list there.
     */
    const signalState = readBenchSignals();
    const focusedSignal =
      view === 'signals' && !mobile ? signalState.selected : -1;
    const historyFocus = readBenchFocus('history');

    /*
     * Landing on /#history directly never passes through the nav, so the frame
     * loop is the backstop that mounts the captures. `markBenchHistoryLive` is
     * a no-op once set, so this costs one comparison a frame and nothing else.
     */
    if (view === 'history') {
      markBenchHistoryLive();
    }

    const pointer = readBenchPointer();
    let motion = 0;
    let shadowMotion = 0;

    projects.current.forEach((project, index) => {
      if (!project) {
        return;
      }

      let target = HIDDEN;
      if (inGallery) {
        /* The hang is the whole shot; the bench clears for it. */
        target = HIDDEN;
      } else if (view === 'work') {
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
      const projectMotion = dampTransform(
        project,
        target,
        transitLambda(target, reducedMotion),
        delta,
      );
      motion = Math.max(motion, projectMotion);
      shadowMotion = Math.max(shadowMotion, projectMotion);

      const screenMaterial = projectMaterials.current[index];
      if (screenMaterial) {
        const blurTarget = view === 'profile' ? 4 : view === 'signals' ? 3 : 0;
        const blur = damp(
          screenMaterial.uniforms.uBlur.value as number,
          blurTarget,
          lambda,
          delta,
        );
        screenMaterial.uniforms.uBlur.value = blur;
        motion = Math.max(motion, Math.abs(blur - blurTarget));
      }
    });

    blanks.current.forEach((blank, index) => {
      if (!blank) {
        return;
      }
      const seat = SIGNAL_SEATS[index];
      const open = focusedSignal === index;
      const active = open || signalState.hovered === index;
      /*
       * An open signal does not fly out of the set — the lens goes to it. All
       * the plate does is stand up by a hair, so the shot reads as one of
       * three that has been stepped up to rather than as an object
       * teleporting into a light box. Its yaw is held exactly as seated,
       * because `signalPlateCentre` derives the focus camera's stand-off from
       * that yaw: a plate that turned on selection would walk out from under
       * its own lens.
       */
      /*
       * Hover steps the fixture *forward along its own facing*, it does not
       * lift it. The three other views raise a hovered subject off the bench,
       * and that works for a phone on a stand; a 2.4-unit angle fixture with a
       * machined foot floating 55 thou above the surface it is bolted to reads
       * as a bug. Forward keeps every contact where it belongs and still gains
       * the object a little scale from perspective.
       */
      const step = active ? 0.14 : 0;
      /*
       * A neighbour of an opened fixture slides out along the run, away from
       * the subject, and settles a little further back. See SIGNAL_ASIDE: the
       * record lens has to hold the plate it was fitted to without cutting the
       * one beside it in half, and at this stand-off there is no fill that
       * does both with the run left as seated.
       */
      const aside =
        focusedSignal >= 0 && !open
          ? (index < focusedSignal ? -1 : 1) * SIGNAL_ASIDE
          : 0;
      const target =
        view === 'signals'
          ? {
              position: [
                seat.x + step * Math.sin(seat.yaw) + aside,
                /*
                 * Seated: the cant lift, the foot and the riser all live
                 * inside the blank, so the group itself rides at y 0 and the
                 * foot's underside is what touches the bench.
                 */
                0,
                seat.z + step * Math.cos(seat.yaw) - (aside === 0 ? 0 : 0.8),
              ] as [number, number, number],
              rotation: [0, seat.yaw, 0] as [number, number, number],
              scale: seat.scale * (open ? 1.05 : active ? 1.03 : 1),
            }
          : HIDDEN;
      const blankMotion = dampTransform(
        blank,
        target,
        transitLambda(target, reducedMotion),
        delta,
      );
      motion = Math.max(motion, blankMotion);
      shadowMotion = Math.max(shadowMotion, blankMotion);
    });

    artifacts.current.forEach((artifact, index) => {
      if (!artifact) {
        return;
      }
      const active =
        historyFocus.hovered === index || historyFocus.selected === index;
      const offset = index - (historyEras.length - 1) / 2;
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
      const artifactMotion = dampTransform(
        artifact,
        target,
        transitLambda(target, reducedMotion),
        delta,
      );
      motion = Math.max(motion, artifactMotion);
      shadowMotion = Math.max(shadowMotion, artifactMotion);
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
      const badgeMotion = dampTransform(
        badge.current,
        badgeTarget,
        transitLambda(badgeTarget, reducedMotion),
        delta,
      );
      motion = Math.max(motion, badgeMotion);
      shadowMotion = Math.max(shadowMotion, badgeMotion);
    }

    if (tagRack.current) {
      const rackTarget =
        inGallery || view !== 'work'
          ? TAG_RACK_PARKED
          : fitWorkRack((camera as THREE.PerspectiveCamera).aspect);
      const rackMotion = dampTransform(
        tagRack.current,
        rackTarget,
        transitLambda(rackTarget, reducedMotion),
        delta,
      );
      motion = Math.max(motion, rackMotion);
      shadowMotion = Math.max(shadowMotion, rackMotion);
    }

    if (tablet.current) {
      const active = workFocus.hovered === TABLET_INDEX;
      const tabletTarget: Transform =
        view === 'work' && !inGallery
          ? {
              position: [
                TABLET_SEAT.position[0],
                TABLET_SEAT.position[1] + (active ? 0.16 : 0),
                TABLET_SEAT.position[2] + (active ? 0.14 : 0),
              ],
              rotation: TABLET_SEAT.rotation,
              scale: TABLET_SEAT.scale * (active ? 1.05 : 1),
            }
          : HIDDEN;
      const tabletMotion = dampTransform(
        tablet.current,
        tabletTarget,
        transitLambda(tabletTarget, reducedMotion),
        delta,
      );
      motion = Math.max(motion, tabletMotion);
      shadowMotion = Math.max(shadowMotion, tabletMotion);
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
          : (historyEras.length - 1) / 2;
    const historyX =
      (historyIndex - (historyEras.length - 1) / 2) * HISTORY_SPACING * 0.7;
    /*
     * Asymmetric, and deliberately so.
     *
     * A camera move to the left slides every subject to the right, and the one
     * thing sitting on the right of the intro plate is the hero subhead. At the
     * full −0.34 the left MacBook's lid corner arrived on top of the last word
     * of "I've worked at Scale AI, SafetyKit, and Ramp." — the page's second
     * line of copy, crossed by a hard chassis edge. Floored at −0.16 the lid
     * stops a clear margin short of the text box and the sweep to camera-right,
     * where there is nothing to hit, keeps its full travel. Nobody can measure
     * a parallax range; everybody can see a headline with a laptop through it.
     *
     * −0.10 is measured, not chosen. The lid's near edge travels 22px across
     * the full −0.245 sweep this viewport produces, and the subhead's last
     * glyph ends 17px inside where the lid sits at rest — so the floor has to
     * hold the travel to well under that. At −0.10 it moves nine, leaving eight
     * clear, and the camera-right half of the sweep is untouched.
     */
    const parallaxX =
      mobile || reducedMotion ? 0 : Math.max(pointer.x * 0.34, -0.1);
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
          /* Raised with the desktop lens for the same reason: the plates stand
             up now, so the axis has to meet their faces rather than their tops. */
          signals: { position: [0, 4.3, 8.9], look: 0.8, fov: 38, roll: 0 },
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
           * world space instead — badge on the left third, signature on the
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
          /*
           * The DOM band under this shot shrank from a two-plate table run to
           * one small links plate in the corner, so the lower third of the
           * frame is floor again. Aimed 0.15 higher and pulled 0.24 closer:
           * the badge drops into the reclaimed band (its base was parked at
           * mid-frame over dead floor) and gains ~4% height, while the clip
           * keeps clear of the header because the whole prop rides down.
           */
          profile: {
            position: [1.0 + parallaxX * 0.4, 2.05, 5.74],
            look: 1.1,
            fov: 34,
            roll: -0.014,
          },
          /*
           * Signals climbs back up, and this time the subject climbs with it.
           * The old 18° lens was chosen to stop a nearly-flat plate reading as
           * a sliver, and it worked as far as silhouette went — but a 15°
           * plate under an 18° camera meets the lens 59° off its own normal,
           * so the engraved title was always going to lose half its cap
           * height. The plates now stand at 40–46°, which means the lens can
           * be raised to ~27° and *gain* legibility instead of trading it: at
           * that pairing the type is within 15–19° of square.
           *
           * z 6.15 rather than 6.9 because the hero seat moved 2.2 units
           * forward onto the near half of the bench.
           */
          signals: {
            position: [parallaxX * 0.6, 4.24, 7.35],
            /*
             * Aimed just under the hero's own pocket. The subject is no longer
             * a flat run near the bench plane, so aiming at 0.12 would have
             * pointed the axis at the fixtures' feet and pushed all three
             * engraved fields into the top quarter.
             */
            look: SIGNAL_REST_LOOK,
            fov: 36,
            roll: 0.006,
          },
          /* Same treatment: the era run climbs into the upper two-thirds. */
          history: {
            position: [historyX + parallaxX * 0.25, 2.85, HISTORY_CAMERA_Z],
            look: 0.8,
            fov: 36,
            roll: -0.008,
          },
        };
    /*
     * The gallery is its own lens, not a dolly of the work shot: a longer,
     * squarer-on setup that reads the hang across rather than looking down a
     * bench. Focusing a piece moves up and in a little — enough that the step
     * forward is felt — while keeping the wall label clear of the DOM band.
     */
    const galleryAspect = (camera as THREE.PerspectiveCamera).aspect;
    const galleryFov = galleryState.piece >= 0 ? 33 : 34;
    const galleryShot: CameraShot =
      galleryState.piece >= 0
        ? {
            position: [
              0,
              GALLERY_FOCUS_EYE,
              GALLERY_FOCUS.position[2] +
                galleryDistance(
                  galleryFov,
                  galleryAspect,
                  GALLERY_FOCUS_FIT_HALF,
                ),
            ],
            look: GALLERY_FOCUS_EYE,
            fov: galleryFov,
            roll: 0,
          }
        : {
            position: [
              0,
              2.18,
              FRAME_Z +
                galleryDistance(galleryFov, galleryAspect, GALLERY_FIT_HALF),
            ],
            look: 2.18,
            fov: galleryFov,
            roll: 0,
          };

    /*
     * A focused tag is a third setup inside `work`, on the same contract as the
     * gallery: the hash never changes, Escape and empty space both unwind it,
     * and it earns the same arc-and-settle transit a view change gets.
     *
     * The lens goes level with the plate and 2.1 out, which puts a 0.56-wide
     * tag across ~31% of the frame with its two neighbours cut by the edges —
     * read as one of a row rather than lifted out of it.
     */
    const tagSeat =
      focusedTag >= 0
        ? tagFocusSeat(
            focusedTag,
            fitWorkRack((camera as THREE.PerspectiveCamera).aspect),
          )
        : null;
    const tagShot: CameraShot | null = tagSeat
      ? {
          position: [
            tagSeat.x + parallaxX * 0.25,
            tagSeat.y + 0.04 * tagSeat.scale,
            tagSeat.z + TAG_FOCUS_DISTANCE * tagSeat.scale,
          ],
          look: tagSeat.y,
          lookZ: tagSeat.z,
          fov: 30,
          roll: 0.008,
        }
      : null;

    /*
     * An opened signal is the fourth sub-shot in the file, on the same
     * contract as the gallery and the tag record: the hash never changes,
     * Escape and empty space both unwind it, and it earns the same
     * arc-and-settle transit a view change gets.
     *
     * The stand-off is computed off the plate's own yaw rather than from a
     * fixed seat, so the lens always arrives square to the engraved field
     * whichever of the three staggered seats it is flying to. The elevation is
     * held below the plate's cant on purpose — see SIGNAL_FOCUS_ELEVATION.
     */
    const signalCentre =
      focusedSignal >= 0 ? signalPlateCentre(focusedSignal) : null;
    const signalShot: CameraShot | null = signalCentre
      ? (() => {
          const seat = SIGNAL_SEATS[focusedSignal];
          const reach = signalFocusDistance(seat.scale);
          const flat = reach * Math.cos(SIGNAL_FOCUS_ELEVATION);

          return {
            position: [
              signalCentre.x + flat * Math.sin(seat.yaw) + parallaxX * 0.2,
              signalCentre.y + reach * Math.sin(SIGNAL_FOCUS_ELEVATION),
              signalCentre.z + flat * Math.cos(seat.yaw),
            ],
            /*
             * Aimed well under the field's centre. The offset is what lifts the
             * plate into the top two thirds: aimed at the centre it lands in
             * the middle of the frame, which is where the elaboration panel
             * starts.
             */
            look: signalCentre.y - 0.48 * seat.scale,
            lookZ: signalCentre.z,
            fov: SIGNAL_FOCUS_FOV,
            roll: 0.004,
          };
        })()
      : null;

    const shot = inGallery
      ? galleryShot
      : (tagShot ?? signalShot ?? shots[view]);
    const targetX = shot.position[0] + (inGallery ? parallaxX * 0.4 : 0);
    const targetY = shot.position[1] - parallaxY;
    const targetZ = shot.position[2];

    /*
     * Transits ride a quadratic Bezier whose control point is pushed out in +y
     * and +z from the midpoint, so the camera pulls back and arcs across rather
     * than sliding down a straight line. Departure is fast, arrival is slow.
     */
    const move = transit.current;
    const shotKey = inGallery
      ? `gallery:${galleryState.piece >= 0 ? 'piece' : 'hang'}`
      : focusedTag >= 0
        ? `tag:${focusedTag}`
        : focusedSignal >= 0
          ? `signal:${focusedSignal}`
          : view;

    if (move.view !== shotKey) {
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
      move.view = shotKey;
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
    const lookX = inGallery
      ? galleryState.piece >= 0
        ? GALLERY_FOCUS.position[0] * 0.45
        : 0
      : tagSeat
        ? tagSeat.x
        : signalCentre
          ? signalCentre.x
          : view === 'history'
            ? historyX
            : view === 'profile'
              ? mobile
                ? 0.15
                : 0.34
              : view === 'work'
                ? (selectedProject?.position[0] ?? workCenterX)
                : 0;
    cameraLook.current.x = damp(cameraLook.current.x, lookX, lambda, delta);
    cameraLook.current.y = damp(cameraLook.current.y, shot.look, lambda, delta);
    cameraLook.current.z = damp(
      cameraLook.current.z,
      shot.lookZ ?? 0,
      lambda,
      delta,
    );
    motion = Math.max(
      motion,
      Math.abs(cameraLook.current.x - lookX) +
        Math.abs(cameraLook.current.y - shot.look) +
        Math.abs(cameraLook.current.z - (shot.lookZ ?? 0)),
    );
    camera.lookAt(cameraLook.current);

    /*
     * Roll last: lookAt rewrites the whole quaternion, so this has to be a
     * post-multiplied rotation about the camera's own forward axis. Damped on
     * its own axis so a transit rolls into the new lens instead of snapping.
     */
    cameraRoll.current = damp(cameraRoll.current, shot.roll, lambda, delta);
    motion = Math.max(motion, Math.abs(cameraRoll.current - shot.roll));
    camera.rotateZ(cameraRoll.current);

    const settled = motion < MOTION_EPSILON;
    setBenchSettled('scene', settled);

    if (shadowMotion > 0) {
      gl.shadowMap.needsUpdate = true;
    }
    if (!settled) {
      invalidate();
    }

    /*
     * Drop the hang once the exit transit has landed — held until then so the
     * frames get to animate out, released after so an idle work shot carries
     * none of their meshes or textures.
     *
     * Gated on the transit rather than on total scene motion: pointer parallax
     * keeps `motion` off zero for as long as the mouse is moving, and a
     * threshold would have left the hang mounted the whole time someone was
     * moving their cursor. `move.t` reaches 1 at the end of the arc regardless,
     * and lands on the same frame under reduced motion.
     */
    if (!galleryState.open && galleryState.mounted && move.t >= 1) {
      releaseBenchGallery();
    }
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
       * The diffuse half of the studio, and the reason the shell could be taken
       * down two stops without the set going with it.
       *
       * A hemisphere is a *gradient* where an ambient is a flood: up-facing
       * normals get the skylight, down-facing normals get the bounce off the
       * bench, and everything between turns through it. That is the museum
       * overcast this direction is after — a bright room that still lets a
       * cylinder or a chamfer round. Metalness-1 aluminum has no diffuse term
       * and cannot see any of it, so the chassis keep the contrasty dark room.
       */}
      <hemisphereLight
        args={['#e9ecef', '#6a6e72', 1.45]}
        position={[0, 8, 0]}
      />
      <ambientLight intensity={0.03} />
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
      {/*
       * Under VSM the bias story changes completely: the depth comparison is a
       * Chebyshev bound on stored moments rather than a direct depth test, so
       * the old -0.0002 / 0.09 pair — tuned to keep PCF acne off the laptop
       * gap and the history stand tops — has nothing to correct and only ever
       * peter-pans the contact. `radius` and `blurSamples` are the softness
       * dials that replace them: 2.75 over a 1024 map is a penumbra a little
       * under the apparent size of the overhead softbox, which is the whole
       * point of the change.
       */}
      <directionalLight
        castShadow={!isAblated('keyshadow')}
        intensity={1.55}
        position={[-6.5, 7, 3.2]}
        shadow-bias={0}
        shadow-blurSamples={12}
        shadow-camera-bottom={-3}
        shadow-camera-far={22}
        shadow-camera-left={-7}
        shadow-camera-near={2}
        shadow-camera-right={7}
        shadow-camera-top={6}
        shadow-mapSize={[1024, 1024]}
        shadow-normalBias={0.02}
        shadow-radius={2.75}
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
      {/*
       * Held down to a 6:1 ratio against the key rather than 4:1. In the
       * high-key grade the hemisphere already carries the shadow side, and a
       * second broad directional on top of it was the last thing keeping the
       * two flanks of a chassis at the same value.
       *
       * It shares the key's +x ground direction rather than opposing it, so
       * nothing in the set gets a second, contradictory terminator.
       */}
      <directionalLight intensity={0.26} position={[5.5, 2.4, 4.5]} />

      <StudioCove />
      <BenchTop />
      {mobile ? null : (
        <CompanyTagRack
          rackRef={(node) => {
            tagRack.current = node;
          }}
          reducedMotion={reducedMotion}
        />
      )}

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

      <SideProjectsTablet
        tabletRef={(node) => {
          tablet.current = node;
        }}
      />

      {/*
       * Mounted only while the gallery is (or is leaving). Suspended on its own
       * boundary so the eight screenshot decodes can never blank the bench.
       */}
      {gallery.mounted ? (
        <Suspense fallback={null}>
          <GalleryHang reducedMotion={reducedMotion} />
        </Suspense>
      ) : null}

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

      {historyEras.map((era, index) => (
        <HistoryArtifact
          artifactRef={(node) => {
            artifacts.current[index] = node;
          }}
          index={index}
          key={era.commit}
          shot={historyState.live ? era.shot : null}
        />
      ))}

      <GroundShadows mobile={mobile} />
    </>
  );
}

/**
 * Empty space unwinds one level at a time, the same order Escape does: a
 * focused piece first, then an open tag record, then an open signal, then any
 * device selection. Clicking the set is always a way *out*, never a dead end.
 *
 * The gallery is the one sub-view a missed click may NOT close, and that is a
 * correction rather than an inconsistency. Its pieces are separated by large
 * gaps and keep moving for several seconds after entry, so a click aimed at a
 * plate misses easily — and at the old behaviour a single miss between the two
 * rows ejected the visitor to the bench mid-flight, with the iPad to find
 * again before they could get back. Empty space inside the hang now defocuses
 * and nothing more; leaving is Escape, or the Back control the DOM bar carries
 * for exactly this purpose.
 */
function handlePointerMissed() {
  const gallery = readBenchGallery();

  if (gallery.open) {
    if (gallery.piece >= 0) {
      clearBenchGalleryPiece();
    }

    return;
  }

  if (readBenchTags().selected >= 0) {
    clearBenchTagSelection();
    return;
  }

  if (readBenchSignals().selected >= 0) {
    clearBenchSignalSelection();
    return;
  }

  if (readBenchHistory().selected >= 0) {
    clearBenchHistorySelection();
    return;
  }

  clearBenchSelection();
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
  useLayoutEffect(() => () => setBenchRenderInvalidator(null), []);

  return (
    <div className={className}>
      <Canvas
        camera={{
          far: 90,
          fov: 33,
          near: 0.1,
          position: [WORK_CENTER_X, 2.25, WORK_CAMERA_Z],
        }}
        dpr={isAblated('dpr') ? 1 : [1, 1.5]}
        frameloop="demand"
        /*
         * NoToneMapping. ACES' shoulder was compressing the one thing on the
         * bench that is allowed to carry colour — Tyler's shipped UI — into
         * grey-on-grey; the iCalarms Settings capture read at roughly half its
         * real contrast. The screen shader's gain/lift and the aluminum
         * envMapIntensity values are re-balanced for the linear response.
         */
        gl={{
          alpha: false,
          antialias: false,
          toneMapping: THREE.NoToneMapping,
        }}
        onCreated={({ gl, invalidate, scene }) => {
          exposeBenchDebug(gl, scene);
          /*
           * An alpha:false context defaults clearAlpha to 1, which makes the
           * ContactShadows depth target clear to *opaque black* — the catch
           * shadow then paints a solid slab across the whole bench. The scene
           * background is a Color, so the main pass still clears opaque.
           */
          gl.setClearAlpha(0);
          gl.shadowMap.autoUpdate = false;
          gl.shadowMap.needsUpdate = true;
          setBenchRenderInvalidator(invalidate);
        }}
        onPointerMissed={handlePointerMissed}
        /*
         * Variance shadow maps, not the default PCF.
         *
         * The set was telling two stories at once: a softbox rig overhead and
         * bare-bulb shadow edges under every phone and tablet — a silhouette
         * that stayed razor-crisp a foot away from the object throwing it. VSM
         * stores depth moments and blurs the *map*, so the penumbra is a real
         * filtered footprint rather than a jittered hard edge, and it widens
         * with the caster's standoff the way an area source does.
         *
         * drei's SoftShadows (PCSS) is the other way to get this and it does
         * not compile against three 0.182 — its injected chunk still calls the
         * old `unpackRGBAToDepth` signature, which takes every material in the
         * scene down with it. VSM is core, costs one blur pass on a 2048 map
         * that only runs while the scene is unsettled, and needs no patching.
         */
        shadows={{ type: THREE.VSMShadowMap }}
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

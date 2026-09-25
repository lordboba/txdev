# Through Paper (透纸) — final art-direction bible for the Mid-Autumn layer

Status: FINAL, post-judging. Base: Proposal 1 ("Through Paper"). Grafted: Proposal 3's wind (module-scope clock, travelling gust fronts, scheduled first gust, scroll wind, seeded RNG) and Proposal 2's text discipline (verse read in stillness, glyph-by-glyph reveal, poem column as a virtual pendulum, figure/figcaption, 44 px hit areas, zero page-component changes, sim pre-warm, sim test, moon-texture build script). Every judge-named weakness is fixed and listed in §0. Reviewed 2026-09-25 against the working tree: every file anchor below was re-read and corrected; every remote asset URL returned 200; every Google font named exists in `next/font` data; the ambiguities found are patched in place and the three decisions that need Tyler are in §9.

All coordinates are CSS px at 1440×900 (desktop) and 390×844 (mobile). All colours are hex. All durations are ms unless stated. File anchors are relative to `/Users/tylerxiao/Documents/txdev/personal-website/`.

---

## 0. What changed from the winning proposal, and why

| #    | Change                                                                                                                                                                                                               | Reason                                                                                                                                                                                                                                                                    |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0.1  | `featuredProjects` has **four** titles (iCalarms, Personal Env, Med Negotiate, Charades 2026, in `bench.order`), not six                                                                                             | Counted in `content/projectData.ts:211-236`: only projects with both `bench` and `image` qualify                                                                                                                                                                          |
| 0.2  | The 走马灯 moves to the **hero lantern of every desktop route** and the home hero grows from 56 to **72 px**; the shadow strip is re-specified so letters are 19×28 px on an 88 px drum and 15×23 px on 72 px (§5.1) | At 56 px the letters were ~11×18 px after blur: unproven legibility on the thesis object. A legibility gate in the gauntlet (§7.7 V6) decides whether `/` keeps it at 72 or falls back to plain paper                                                                     |
| 0.3  | The riddle slip moves from the hero to lantern **B** on routes that have one                                                                                                                                         | The hero now carries the shadow titles; one object, one text                                                                                                                                                                                                              |
| 0.4  | `/past-experience` drops lantern C; the moon stays at x1290–1420                                                                                                                                                     | The 176 px right gutter cannot hold a 130 px moon and a cord-clear lantern (moon cannot move left: the inset nav ends at x1264). Two lanterns plus a moon is enough, and the count now varies across routes (3 / 2 / 3), which the brief's "deliberate variance" asks for |
| 0.5  | The dateline leaves the page eyebrows and becomes an overlay **colophon column** beside the poem (horizontal on `/`, which has no poem)                                                                              | Zero page components change during the festival (P2 A5). No layout slot, no `FestivalDateline` in page markup                                                                                                                                                             |
| 0.6  | Mobile `/blog*` loses the 56 px moon                                                                                                                                                                                 | It sat 36 px from the 36 px "Blog" H1; the H1 keeps the corner                                                                                                                                                                                                            |
| 0.7  | Colour themes: the lamp stays warm (P1 physics), but the **pool tint and halo tint** pass an OKLCH hue gate [55°, 95°] before mixing in `--accent`; outside the band they use pure paper colour                      | P2's "candle only burns amber" rule was right for the accent and wrong for the candle: a lamp does not go out because the page accent changed, and a green pool under a warm lamp is a bug                                                                                |
| 0.8  | One wind field `W(x,t)` at module scope with travelling gust fronts, a scheduled first gust, scroll wind, seeded RNG, and StrictMode/HMR ownership rules                                                             | The route change no longer restarts the weather; pages are rooms in one evening                                                                                                                                                                                           |
| 0.9  | Florets never exit on route change (bounds re-clamp 400 ms); sim pre-warmed 6 s                                                                                                                                      | Continuity and a full first frame                                                                                                                                                                                                                                         |
| 0.10 | The translation is **visible by default** and lands when the hero lantern's swing settles below 1° (event-driven, ceiling 3.6 s); pinyin appears on keyboard focus; glyph-by-glyph reveal                            | Verse is read in stillness (P2). The first gust is scheduled **after** that beat at 4.4 s, not 3.2 s: stillness first, then the wind                                                                                                                                      |
| 0.11 | One poem line site-wide (千里共婵娟), not five                                                                                                                                                                       | Tyler's call. Per-route pairings tie to page types (any journal, any booking page), not to this site; variance in prominence comes from what each page carries (§3.8), not from more quotes                                                                               |
| 0.12 | Halo peak lowered 0.55 → **0.35**, drawn under the paper (`renderOrder`), with a pixel-luminance assertion moon > any halo/paper pixel                                                                               | The luminance order was a table, not a guarantee                                                                                                                                                                                                                          |
| 0.13 | Sky tint is a CSS `radial-gradient` on the overlay wrapper, following `--moon-x/--moon-y`                                                                                                                            | Zero WebGL cost; one fewer draw call                                                                                                                                                                                                                                      |
| 0.14 | `scripts/build-moon-texture.mjs` added, running on the scratchpad's playwright-core headless canvas                                                                                                                  | The moon PNG is reproducible with no new project dependency (`sharp` and `canvas` are not installed)                                                                                                                                                                      |
| 0.15 | Route exit order: candle out first (160 ms); the lantern's rise starts at +40 ms, so `uLit` reaches 0 before the rise passes 8 px                                                                                    | The candle is put out before the lantern is raised (P3); the 120 ms overlap keeps the exit at 280 ms                                                                                                                                                                      |
| 0.16 | `/blog/[slug]`: moon dims to 60% past `scrollY 400`                                                                                                                                                                  | The reader is inside the article; the sky recedes (P2)                                                                                                                                                                                                                    |
| 0.17 | Riddle 09 (DocuPilot) reworded to "routes"                                                                                                                                                                           | The source field says routing, not moving                                                                                                                                                                                                                                 |

---

## 1. Concept

**Name: Through Paper (透纸).**

One paper lantern hangs close to the camera in the empty margin of the page, its rice paper lit from inside so sixteen bamboo ribs show as dark meridians and a warm pool of light settles on the page beside the text; on the hero lantern, the titles of Tyler's own shipped projects drift across the paper as shadows, the way a 走马灯 throws its cut-outs. Far across the page, small and cool, a real moon (NASA maria, the rabbit findable in them) answers the lamp, and osmanthus florets fall between the two, taking the colour of whichever light is nearer, on one wind that crosses the whole site. Nothing else glows, nothing is red except one tassel, and the site's own amber (`--accent #c89b52`) is what the candle is made of.

The image a visitor remembers: **the H1 sitting in lamplight, one paper lantern beside it with a project title passing through its paper as a shadow, the moon in the far corner, and a gust crossing the page left to right so the lanterns answer in order.**

What this angle refuses: a sky full of lanterns, a night grade over the whole page, particles, a rabbit lantern, red-and-gold, five quotes. The site stays the site; three object classes are added, and each is built the way the real thing is built.

---

## 2. Style sheet

### 2.1 Palette

Physical colours (paper, candle, bamboo, moon) are constants: a lamp does not change colour when the page theme changes. Page-side colours (the pool on the page, the riddle seal, the slip's link underline) derive from the live `--accent` through a hue gate so the four colour themes still read as one site.

**Site tokens that carry the festival unchanged**

| Role                           | Token          | Dark                            | Light     |
| ------------------------------ | -------------- | ------------------------------- | --------- |
| Night ground                   | `--background` | `#12100d`                       | `#f5f1e9` |
| Highest luminance of page text | `--foreground` | `#f4ecdf`                       | `#12100d` |
| Gold below the moon            | `--accent`     | `#c89b52`                       | `#a57b37` |
| Muted text                     | `--muted`      | as defined in `app/globals.css` |           |

**Festival constants** (`components/festival/palette.ts`; mirrored as CSS custom properties under `html[data-festival="mid-autumn"]` in `festival.css` so the HTML slips use the same values; all die with the flag)

| Constant        | Named colour    | Hex                                          | Use                                                       |
| --------------- | --------------- | -------------------------------------------- | --------------------------------------------------------- |
| `paperUnlit`    | 宣纸 warm paper | `#e9dcc4`                                    | Paper albedo when unlit (light theme; exit-dim)           |
| `paperEdge`     | 姜黄            | `#ffc773`                                    | Lit paper where it thins toward the caps                  |
| `paperMid`      | 藤黄 gamboge    | `#ffb61e`                                    | Lit paper mid-tone                                        |
| `paperHot`      | 杏黄            | `#ffa631`                                    | Candle-height band                                        |
| `paperCore`     | candle core     | `#ffd58a`                                    | Brightest paper value; must stay below the moon           |
| `paperRim`      | 赭 ochre        | `#9c5333` → `#7a3d1a` at the limb            | Dark scalloped rim where paper turns away                 |
| `rib`           | bamboo, stained | `#5a3a22`                                    | 16 meridians, 45% darkening of lit paper where they pass  |
| `cap`           | 漆黑 lacquer    | `#161823`                                    | Top and bottom collars                                    |
| `capChamfer`    | 栗色 chestnut   | `#60281e`                                    | 1 px chamfer band on each collar                          |
| `brass`         |                 | `#b08d57`                                    | Hook ring                                                 |
| `cord`          |                 | `#2a1f18` dark / `#4a3a2c` light             | 2 px cord, catenary                                       |
| `tassel`        | 银朱 vermilion  | `#bf242a` → `#8f1c22` at the tips            | The only red on the page                                  |
| `knot`          | 胭脂 rouge      | `#9d2933`                                    | Tassel knot                                               |
| `moonBody`      | 象牙白          | `#fffbf0`                                    | Lit disc base under the maria map                         |
| `moonRim`       | 月白 moon-white | `#d6ecf0`                                    | Limb tint, halo, poem ink                                 |
| `frost`         | 霜色            | `#e9f1f6`                                    | Outer halo; floret cool mix target                        |
| `nightNearMoon` | 黛蓝            | `#425066`                                    | 12% CSS radial tint within 2.2 moon diameters (dark only) |
| `floretGold`    | 缃色            | `#f0c239`                                    | 金桂 florets (80%)                                        |
| `floretIvory`   |                 | `#fff6dc`                                    | 银桂 florets (15%)                                        |
| `floretOrange`  | 橘黄            | `#ff8936`                                    | 丹桂 florets (5%)                                         |
| `leafGreen`     | 竹青            | `#789262` top / `#8fa37a` underside          | Osmanthus leaf                                            |
| `ginkgo`        | 枯黄 / 竹青     | `#d3b17d` blended 40–70% with `#9aa66f`      | Late-September ginkgo, still half green                   |
| `ink`           | 墨色            | `#2b241c` on slip paper; `#3d4a54` secondary | Riddle slip text (both ≥ 7:1 on slip paper)               |
| `slipPaper`     |                 | `#efe4cf`                                    | Riddle slip and unfolded card                             |

**Luminance order, enforced by a pixel assertion (§7.7 V3):** moon disc `#fffbf0` (Y ≈ 0.98) > paper core `#ffd58a` (Y ≈ 0.85) > paper mid > gold accent > everything else. The halo is drawn under the paper and peaks at alpha 0.35 over `#12100d`, so no halo pixel can reach the paper core, let alone the moon.

**Theme behaviour**

- `data-theme="dark"`: the night of the fifteenth. Candles lit, halos on, pools on, moon full and cool, 黛蓝 tint near the moon.
- `data-theme="light"`: the afternoon before. Lanterns hung and unlit (`paperUnlit` albedo, ribs at 12%, tassel still red), no halo, no pool, moon a daytime disc at 7% alpha with maria at 3%, no sky tint. Switching theme is dusk: the candles catch (§4.3).
- `/` ignores `data-theme` (the Bench set is grey `#c8c8c8` in both). The festival treats `/` as an interior at night with the lamps on: lanterns always lit, **no additive halo** (it vanishes on grey), the light carried by a `NormalBlending` pool on the wall at alpha 0.22 in `paperHot` (a grey wall needs chroma, not just alpha: at 0.10 in `paperMid` the pool was a 5-level shift and the lanterns read as stickers). Concretely: on `/` the layer pins `uNight = 1` and `uLit = 1`, ignores `THEME_EVENT`, and §4.3 is a no-op.
- Colour themes (`data-color-theme` mono / ember / ice / terminal): `--accent` is sampled at mount, on `THEME_EVENT` (`components/runtime/themePreferences.ts`) and by a `MutationObserver` on `data-color-theme`. Convert to OKLCH. **If hue ∈ [55°, 95°]**: pool tint = `mix(paperMid, accent, 0.2)`, halo tint = `mix(paperCore, accent, 0.15)`. **Otherwise**: pool = `paperMid`, halo = `paperCore`. The slip's 谜底 underline and the focus rings are page-side ink and simply follow `--accent` (no gate). The 9 px seal is 银朱 `#bf242a`, a physical colour: a seal is red ink, never a UI chip. Measured hues of the live `--accent` values in `app/globals.css`: default `#c89b52` 77.8° / light `#a57b37` 76.9° (pass); ember `#e8a060` 61.2° / light `#b86a1e` 59.0° (pass); **mono passes too**, because `[data-color-theme='mono']` (`globals.css:1653`) overrides only the `--c-*` orbital tokens and leaves `--accent` amber; ice `#5090e0` 255° / `#2862b0` 257° (fail); terminal `#80e840` 136° / `#288c12` 141° (fail). The gate is evaluated on the computed value, never on the theme name, so a future palette edit cannot break it. The lamp, paper, tassel and moon never change. Under `ice` the room is cool and the lamp is warm, which is the correct picture; it gets its own capture (§7.7 V7).

### 2.2 Materials

- **Paper (宣纸 over bamboo):** unlit `ShaderMaterial`, instanced, no scene lights. `through = pow(max(viewNormal.z, 0), 1.35)`; `candle = 1 - smoothstep(0, 0.62, abs(y - 0.05))`; `col = mix(paperRim, paperMid * aTint, through)`; `col = mix(col, paperCore, 0.55 * through * candle * aCandle)`; ribs: `col *= 1 - 0.45 * uLit * smoothstep(0.035, 0.012, abs(fract(u * 16) - 0.5) * 2)` so the meridians are dark only where light passes; fibre: 256 px tiling value-noise `CanvasTexture` multiplied at 6%. `uLit` (0..1) blends the whole thing to the unlit albedo (`paperUnlit`, ribs at 12%, a Lambert-ish `0.55 + 0.45 * max(N.y, 0)` shade). `aShadow = 1` on the hero samples the 走马灯 strip (§5.1).
- **Bamboo ribs:** the rib term above plus 16 scallops baked into the lathe profile (radius dips 3% at each rib: 1.5% was 0.66 px on the 88 px hero and the rim read smooth; 3% is ≈ 1.3 px).
- **Collars:** lacquer `#161823` with a 1 px `#60281e` chamfer, vertex-coloured, top-down shade baked (top brighter by 18%). Brass hook ring `#b08d57` with a fixed vertex-colour highlight.
- **Cord:** one `LineSegments` for all lanterns, 2 px, catenary sag 3% of length, from the route's anchor line (the Bench header lintel y64 on `/`, the tools-pill underside y66 for lantern C on `/orbital`, the viewport top y0 elsewhere) to the hook ring. The cord entering the blurred nav band reads as going up into the eaves.
- **Tassel:** 28 strands merged into a vertex-coloured cone (`#bf242a` → `#8f1c22`), knot sphere `#9d2933`, a second pendulum hung from the bottom collar: it restores toward **plumb** (relative angle → −θ), is driven by the collar's tangential acceleration `(1 + R/l)·θ''` (R pivot → collar, l the tassel, 0.32 body widths), ω = 2π/(0.45·T), ζ 0.35 (the tassel-to-cord length ratio √(24/118) ≈ 0.45, so 1.26 / 1.08 / 0.95 s), relative angle clamped ±0.35 rad. At the first-gust onset the strands trail the collar (relative ≈ −1× θ), then whip through plumb and peak past the body 50–150 ms after the body's peak. (A spring toward the body axis gave ≈ 16% relative amplitude, 0.4 px at the tip: welded to the lantern.)
- **Halo:** instanced billboard quad, `AdditiveBlending`, `depthTest: false`, `depthWrite: false`, `renderOrder` below the paper, premultiplied output `vec4(c*a, a)`, radial `pow(1 - r, 2.4)`, 2.8× body width, peak alpha 0.35 dark, 0 light, skipped on `/`.
- **Pool:** instanced quad at lantern z − 0.2, `NormalBlending`, elliptical falloff `pow(1 - r_ellipse, 2.0)` (a softer 1.4 was tried and spilled lantern B's skirt 0.036–0.041 onto the copy column on the 176 / 240 px gutters, over V2's 0.02), 3.2× body width, 1.35× taller than wide, centred 0.4 body-heights below the lantern's **bottom collar** (measured from the body centre the core hid behind the paper and only the skirt reached the wall), colour per the hue gate (`paperHot` on `/`), peak alpha 0.14 dark / 0.22 on the grey studio / 0 light. Pool and halo are also multiplied by `smoothstep(0, 0.6, uLit)` so the glow never leads the wick through its catch dip (M7).
- **Moon:** one plane, `NormalBlending`, `depthWrite: false`, texture `public/festival/moon-nearside-512.png` (§5.3, which bakes the limb darkening `pow(1 - r², 0.35)` and lifts the levels so highlands sit at ≈ 0.9 and maria at ≈ 0.55 of `moonBody`). Shader: tint toward `moonRim` at the limb (no second limb term: applied twice the disc read as a dim grey ball); halo as a second quad, additive, `frost`, radial `pow(1 - r', 2.6)` to 2.2× diameter, peak 0.18 dark / 0 light, breathing ±3% over 11 s.
- **Sky tint:** not geometry. `radial-gradient(circle at var(--moon-x) var(--moon-y), rgba(66,80,102,.12) 0, transparent calc(var(--moon-d) * 1.1))` on the overlay wrapper; `--moon-*` updated per frame during the glide, `opacity` × `uNight`.
- **Falling things:** one `InstancedMesh(PlaneGeometry(1,1))`, one 1024×512 `CanvasTexture` atlas (three species + a pre-blurred far-band floret), `alphaTest 0.5`, `DoubleSide`, `MeshBasicMaterial` with `instanceColor`, per-instance atlas cell via an `InstancedBufferAttribute`.
- **Riddle slip, poem, colophon, translation:** HTML (crisp at any dpr, selectable, screen-readable), positioned from the sim once per frame through CSS custom properties on the overlay root.

### 2.3 Light

Two sources, two temperatures, and the page is where they meet.

- **Candle**, ≈ 2000 K: inside every lantern at y = +0.05 of the paper height. Brightest band at candle height, falling toward both collars. Flicker `aCandle = 1 + 0.06 * (noise(7t) + 0.5 * noise(13t))`, floor 0.94, seeded per lantern.
- **Moon**, ≈ 6500 K (`#d6ecf0`): far, small, soft. Its light is visible only as (a) the 黛蓝 tint within 2.2 diameters and (b) the cool tint on florets nearer to it than to any lantern.
- **The pool:** each lantern casts a warm ellipse on the page. This is the "light falls on paper" cue and the single thing that makes lanterns belong to the page rather than float over it. Measured so pool alpha < 0.02 at the nearest copy-column edge on every route.
- **Florets:** per-instance colour `mix(warm, cool, smoothstep(0.35, 0.9, dNearestLantern / (dMoon + dNearestLantern)))` computed on the CPU at respawn (the ratio is 1 beside the moon, 0 beside a lantern: the nearer light wins); warm = species colour, cool = species colour mixed 45% toward `frost`. On `/` (no moon) all florets are warm.
- Nothing else emits. No scene lights, no shadows, no post-processing.

### 2.4 Typography (summary; §6 is normative)

Festival-only moments, five and no more: the 走马灯 shadow titles on the hero lantern (A2); the riddle slip on lantern B (A3); one vertical poem line with its translation beside the moon (A4); a vertical colophon dateline beside the poem, horizontal on `/` (A1); the moon's hover name (A5). Three tiers: T1 poem 22 px Han; T2 translation 17 px Cormorant italic, the slip card 19 px italic, the 谜底 line 17 px with its 谜底 label at 15 px (an optical size: Noto's full-height Han reads level with Cormorant's small x-height at 15), the slip's 谜目 15 px Han; T3 colophon 11 px Han / 10 px mono and the slip index 10 px mono. Nothing festival-textual ever exceeds an H1 in size, weight or contrast, and nothing festival-textual lives inside a page component.

Permanent refinements (own PR, ships first): B1–B8 in §6.B.

---

## 3. Page-by-page composition

Layer z per route (from the layering audit): `/` 2 (mobile 1), `/orbital` 2 mounted after children, NavBar routes 1, `/terminal` off. Lantern bodies never enter the NavBar band (+24 px), the Bench header/dock, any H1 rect, plates, the Calendly iframe, theme docks or the mobile fixed footer. Body sizes are paper width; paper height is 0.86× width. "Hero" = the 走马灯 lantern. The compositional grammar on every NavBar route is **eaves left, sky right**: lanterns in the left gutter, moon + verse in the right gutter, one small lantern under the sky where the gutter allows it.

### 3.1 `/` (Bench studio)

Desktop. The only free block in all four views is x ≥ 1200, y 64–280. Cords hang from the header lintel (y64), so they never cross the dock (x1303–1400, y10–54).

```
y0   ┌──────────────────────────────────────────────────────────────────────┐
     │ Tyler Xiao      Profile Work Signals History              🚀  >_    │ header z4 (0-64)
y64  ├────────────────────────────────────────────────────────────╥─────╥───┤ cords from y64
     │ THINGS SHIPPED             placard rail x510-1165 y120-185 ║     ║   │
y113 │ Hi, I'm Tyler Xiao.                                      ▓███▓  ▓█▓ │ A hero 72px x1300 body y120-182 (走马灯)
     │ (H1 x40-456)                                              ⌇      ⌇  │ B 44px x1400 body y104-142
y245 │ dek                                                     pool  pool  │ pools on the grey wall, alpha .22 paperHot
     │ ~~ floret band y64-330, x480-1440, alpha ≤ .6 ~~              丙午年八月十五 │ colophon, two lines right-aligned x1420, y252-276
     │                                                        THE FIFTEENTH NIGHT │ (x ≥ 1270: clear of the laptop screen, x ≤ 1205)
     │        MacBook          monitor          phone                       │ bench canvas z0 (opaque grey)
y644 ├── plates x40-1399 ───────────────────────────────────────────────────┤ details z3
y868 │ footer                                                               │
     └──────────────────────────────────────────────────────────────────────┘
```

- **Lantern A (hero, 走马灯):** 72 px at x1300 (body x1264–1336, y120–182), T = 2.8 s. No riddle slip (the shadows are its text). **Lantern B:** 44 px at x1400 (x1378–1422, y104–142), T = 2.1 s, plain, no slip (the block has no room for a card that does not cross the Signals card at x975 y290). Two lanterns: the set is already full.
- **Colophon (A1):** horizontal, two right-aligned lines ending at x1420 (Han y252–263, mono label y266–276; block x1270–1420). Clear of A's tassel (ends y208), the Signals right card (x975+, y290+) and the laptop screen (ends x≈1205; a single line would start at x1186 and sit on the monitor). Colour on the grey set: Bench `--ink #141517` (`Bench.module.css:11`) at 75% opacity (6:1 on `#c8c8c8`; 60% was 3.96:1), not `--muted` (a dark-page token that fails contrast); both lines, Han and mono.
- **Moon:** none. This is an interior. Florets are all warm.
- **Florets:** 24, emitter band x480–1440 y64–330, alpha ≤ 0.6 over the grey set, none below y330 (alpha ramp 280→330), none over the placard rail (x510–1165 y120–185, + 6 px: a speck on a wordmark reads as dirt on a sign) or the two lantern bodies.
- **Pools:** `NormalBlending` alpha 0.22 in `paperHot` under each lantern; A's pool is 230 px wide (x1185–1415), never reaching the rail (x ≤ 1165).
- Rocket launch: `BenchHome.tsx` dispatches `bench:launch` (one line); the layer runs the §4.2 exit at t = 0 of the launch.

Mobile: **0 lanterns, no text.** 10 florets confined to the live canvas rect (`canvas.getBoundingClientRect()`, y213–567 at rest, tracked per frame), so they scroll with the studio. Layer z 1, `position: fixed` (no second layout mode).

### 3.2 `/orbital`

Desktop (no scroll; DOM/SVG page, so the festival canvas is its only WebGL context; layer z 2 after children so rings, H1, index and star paint over it).

```
y0   ┌ ☾ moon 120px x100-220 y40-160 ──── H1 x384-1056 y34-108 ──── [tools x985-1412 y28-65] ┐
     │                       ║                                                        ║(from y66)
     │ 丙 千                ▓█▓  A 56px x300 body y66-114                             ▓██▓ C hero 64px x1330 body y120-175 (走马灯)
     │ 午 里                 ⌇                                                          ⌇
     │ 年 共                                                                            (no slip: the hero carries shadows;
     │ 八 婵    poem x128-150 y176-302 · colophon x106-118 y176-272                     B absent, so no slip on /orbital)
     │ 月 娟    translation left-aligned x128 y314-330
     │ 十        ┌── rings x170-840 y200-880 ──┐          side column x964-1224 y297-763
     │ 五        │            ★                │
     │ dock x28-207 y822-872                                                             │
```

- Lanterns: **A** 56 px at x300 (body x272–328, y66–114; 56 px left of the H1) and **C hero** 64 px at x1330 (x1298–1362, y120–175), hung from the tools pill's underside (anchor y66) so the cord never crosses the pill. Two; the star owns the centre.
- Moon 120 px at x100–220 y40–160; never right of x384 above y110. Poem column x128–150 y176–302 (left of the rings' x170 edge by 20 px); colophon column x106–118; translation left-aligned at x128 y314–330 (the one left-aligned lockup on the site, because the moon is left here; ends x≈390, over ring strokes that paint above it — acceptable, strokes are 1 px on transparent).
- Florets: 30, full width minus the H1 (x384–1056 y34–108) and the dek (`.orb-title-copy`, ≈ x455–985 y125–172): both are transparent text over the layer, so the fall showed inside the letters. Behind `.orb-shell`.
- No slip on this route (no lantern B). The 走马灯 and the poem are its text.

Mobile: 0 lanterns, no moon, no text, 12 florets behind `.orb-shell`, emitted only below the dek (band y ≥ 216, 8 px feather: the H1 at y16–135 and the dek at y148–195 are transparent text over the layer, so florets showed through the letters; the rings and the index still get the fall, V10). (Pre-existing `.orb-hero-tools`-over-H1 bug at ≤ 760 px is fixed in the typography PR, B6.)

### 3.3 `/blog`

Desktop. Gutters x0–304 and x1136–1440 are the largest voids on the site; the hero lives left, the sky right.

```
y0   ┌──────────────────────── NavBar full-bleed 0-75 (z30, blur) ────────────────────────────┐
     │       ║                                                                  ☾ moon 150px  │
     │     ▓███▓  A hero 88px x96 body y118-194 (走马灯)                          x1193-1343   │
     │       ⌇                                JOURNAL                            y110-260     │
     │              ║                          Blog  (H1 x304-400 y158-206)     丙 千          │
     │             ▓█▓  B 56px x214 body y176-224                               午 里          │
     │              ⌇                          dek                              年 共  colophon x1160-1172 y276-372
     │             ▯ slip x195-233 y238-390    ┌ post card x304-1136 y276-488 ┐ 八 婵  poem x1178-1200 y276-402
     │                                         └────────────────────────────┘ 月 娟          ║
     │                                                                        十     ▓█▓ C 56px x1385 body y196-244
     │                                                                        五      ⌇
     │                                      translation right-aligned x1420 y412-429           │
```

- Lanterns: **A hero** 88 px at x96 (x52–140, y118–194; T 2.8 s); **B** 56 px at x214 (x186–242, y176–224; T 2.4 s) with the slip; **C** 56 px at x1385 (x1357–1413, y196–244; T 2.1 s), cord x1385, 42 px clear of the moon disc and 27 px from the viewport edge, so its 2.8× halo (157 px) and 3.2× pool are whole (at x1395/60 the halo ran past x1440 and the right lantern read as cropped). A's pool (282 px) reaches x237, 67 px short of the column.
- Moon 150 px at x1193–1343, y110–260 (35 px below the nav band; 57 px clear of the post card). Poem column under its lower-left limb; colophon column to the poem's left; translation right-aligned to x1420 (x≈1158–1420: the 17 px italic line measures 261 px, so its rect is 262 wide) at y412, clear of the post card (x ≤ 1136) and of C's tassel (ends y272).
- Florets: 36, both gutters plus the top band y75–112 (above the JOURNAL eyebrow at y125–137; the H1 starts at y158). On `/blog/[slug]` the breadcrumb links own that row, so the post page has gutters only (the count stays 36).

Mobile 390×844: **1 lantern** 44 px at x335 (x313–357, body y74–112; free block x200–374 y62–140), cord from y62 (nav bottom); **no moon, no slip, no text**; **6 florets, florets only** (no leaf or ginkgo: a 34–40 px fan beside a 44 px lantern is the size of the object, and twelve of them in a 174×78 px block read as a sticker clump), kept 8 px off the lantern; scroll-lift when `scrollY > 120` (lift 24 px + fade 260 ms), return below 40.

### 3.4 `/blog/[slug]`

Desktop: identical shell and gutters to `/blog`; lanterns are fixed and survive the scroll. **No riddle slip** (reading page). Poem, colophon and moon stay; the moon dims to 60% (400 ms) once `scrollY > 400` and returns at the top. The 走马灯 keeps turning: on the long scroll it is the page's only motion besides the wind. Mobile: as `/blog` mobile; scroll-lift mandatory (article text passes under x200–374).

### 3.5 `/past-experience`

Desktop. Container x176–1264 (inset nav y56–131 at load, pinned 0–75); gutters 176 px, never covered by the nav.

```
     │ ║                    [NavBar x176-1264 y56-131 → pins 0-75]                ☾ 130px   │
     │▓██▓ A hero 72px x64 body y112-174 (走马灯)                              x1290-1420  │
     │ ⌇                                                                        y90-220    │
     │          ║            EXPERIENCE                                        丙 千        │
     │         ▓█▓ B 52px x138 body y210-255                                   午 里 colophon x1254-1266 y240-336
     │          ⌇            H1 x176-944 y277-397                              年 共 poem x1272-1294 y240-366
     │         ▯ slip x119-157 y268-420                                        八 婵
     │                                                                         月 娟
     │                                                                         十
     │                                                                         五   translation right-aligned x1420 y378-395
```

- Lanterns: **A hero** 72 px at x64 (x28–100, y112–174) and **B** 52 px at x138 (x112–164, y210–255; slip x119–157) with the slip: 12 px clear of the container edge at x176, so the slip's swing at a gust (0.8·8° over its 152 px strip ≈ ±17 px at the foot) never crosses the H1 or the '← Back to home' bar (at x150 the body abutted the bar and the tilted strip touched the 'E' of Experience). **No lantern C** (§0.4).
- Moon 130 px at x1290–1420 y90–220; poem column x1272–1294 (8 px right of the container edge; the H1 ends at x944, the Focus Areas card starts at y470); colophon x1254–1266; translation right-aligned to x1420 at y378.
- Florets: 30, gutters only (x < 176, x > 1264). Mobile: 0 lanterns, no moon, no text, **florets off** (decided, not gated: a 20 px gutter cannot carry a 6–10 px floret without it touching the copy column, and `/schedule-a-call` mobile is already off for the same reason).

### 3.6 `/schedule-a-call`

Desktop. Container x240–1200 (widest gutters on the site, 240 px) and a white Calendly iframe at x241–1199 y582–1342 that must never receive florets.

- Lanterns: **A hero** 88 px at x92 (x48–136, y112–188); **B** 56 px at x196 (x168–224, y196–244) with the slip (x177–215, y258–410); **C** 52 px at x1396 (x1370–1422, y240–285), cord x1396, 31 px clear of the moon disc and 18 px from the viewport edge so the halo is whole (at x1410/56 it sat 2 px in and the halo was cut by the viewport).
- Moon 130 px at x1235–1365 y90–220 (35 px right of the container edge at x1200); poem column x1228–1250 y240–366; colophon x1210–1222 y240–336; translation right-aligned to x1420 at y378 (C's tassel ends y306, 72 px above).
- Florets: 30, gutters only (x < 232, x > 1208), 24 px alpha feather at the clip. Mobile: 0 lanterns, no moon, no text, florets off.

### 3.7 `/terminal`

Off (allow-list). It is a different world (blue-black, opaque `z-50`). The module wind clock keeps running so the evening continues when you leave.

### 3.8 Counts and sizes at a glance

| Route              | Desktop lanterns (body px; hero = 走马灯) | Moon | Florets | Slip | Poem + colophon            | What this page carries                | Mobile                        |
| ------------------ | ----------------------------------------- | ---- | ------- | ---- | -------------------------- | ------------------------------------- | ----------------------------- |
| `/`                | 2 (72 hero, 44)                           | none | 24      | none | colophon only (horizontal) | the shadow titles                     | 0 / 10 florets in canvas rect |
| `/orbital`         | 2 (56, 64 hero)                           | 120  | 30      | none | yes                        | moon + verse, left                    | 0 / 12                        |
| `/blog`            | 3 (88 hero, 56, 56)                       | 150  | 36      | on B | yes                        | the fullest page                      | 1 (44) / 6, no moon           |
| `/blog/[slug]`     | 3 (88 hero, 56, 56)                       | 150  | 36      | none | yes                        | quiet reading; moon recedes on scroll | 1 (44) / 6, scroll-lift       |
| `/past-experience` | 2 (72 hero, 52)                           | 130  | 30      | on B | yes                        |                                       | 0 / 0                         |
| `/schedule-a-call` | 3 (88 hero, 56, 52)                       | 130  | 30      | on B | yes                        |                                       | 0 / 0                         |
| `/terminal`        | off                                       |      |         |      |                            |                                       | off                           |

Budget: ≤ 3 lanterns desktop (allowed 6), ≤ 1 mobile (allowed 3).

**Moon anchors for the glide (centre, diameter):** `/orbital` (160, 100, 120) · `/blog*` (1268, 185, 150) · `/past-experience` (1355, 155, 130) · `/schedule-a-call` (1300, 155, 130) · `/` none. The right-gutter moon and lantern C are placed together: the cord keeps §8's 30 px clearance from the disc and the lantern keeps ≥ 18 px from the viewport edge so its halo is never clipped.

---

## 4. Choreography

Easings are cubic-bezier: `enter (0.05, 0.7, 0.1, 1)`, `exit (0.3, 0, 0.8, 0.15)`, `std (0.2, 0, 0, 1)`, `calm (0.37, 0, 0.63, 1)`. Sim `dt` is clamped to 33 ms. The loop runs at most 60 Hz (skip if `now - last < 15 ms`) and never renders on pointer events. Simulation time `ts` (the wind clock) is module-scope, pauses when hidden, and is never reset by a route change. `?festival-seed=<n>` fixes the RNG.

The layer publishes `document.documentElement.dataset.festivalSettled = 'true'` when all cords are at length, all candles at 1, and the text sequence is complete (≈ 3.6 s after mount).

### 4.1 First mount (t = 0 when the canvas exists AND `document.fonts.ready` resolved or 800 ms elapsed)

| Element                                    | Delay                                                                                                                                                                            | Duration                    | Easing / model                                             | Notes                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Canvas opacity 0 → 1                       | 0                                                                                                                                                                                | 200                         | linear                                                     | No one-frame pop                                                                                                                                                                                                                                                                                                              |
| Florets                                    | 0                                                                                                                                                                                | 1600 alpha 0 → target       | std                                                        | Sim pre-warmed 6 s before frame 1: mid-fall, never all at the top                                                                                                                                                                                                                                                             |
| Moon disc (dark)                           | 0                                                                                                                                                                                | 900 fade 0 → 1              | std                                                        | Halo follows at 150 over 600                                                                                                                                                                                                                                                                                                  |
| Sky tint (CSS)                             | 0                                                                                                                                                                                | 900                         | std                                                        | 0 → 12%                                                                                                                                                                                                                                                                                                                       |
| Lantern i lower-in (i = 0 hero, 1, 2 by x) | 120·i                                                                                                                                                                            | 1100, cord 0.05 → L         | enter                                                      | Arrival 1.10 / 1.22 / 1.34 s; total stagger 240 (< 600 rule)                                                                                                                                                                                                                                                                  |
| Release into pendulum                      | at arrival                                                                                                                                                                       | free, ζ 0.12                | damped pendulum                                            | θ = 0, θ̇ = 0.03·W(x, ts) rad/s (≤ 0.4° of swing from the breeze alone): arrives already answering the breeze, never dead-still; ambient keeps it < 2°                                                                                                                                                                         |
| Candle catch (dark)                        | arrival + 150                                                                                                                                                                    | 700                         | keyframes 0 → .15@120 → .05@180 → .6@320 → .45@380 → 1@700 | Hung first, then lit; reads as a wick catching                                                                                                                                                                                                                                                                                |
| 走马灯 shadows                             | with the candle                                                                                                                                                                  | 700                         |                                                            | Shadow term × `uLit`                                                                                                                                                                                                                                                                                                          |
| Pool + halo                                | catch + 150                                                                                                                                                                      | 500                         | (0, 0, 0, 1)                                               |                                                                                                                                                                                                                                                                                                                               |
| Tassel                                     | from arrival                                                                                                                                                                     | pendulum                    | ω 2π/(0.45·T), ζ 0.35, toward plumb                        | First kick from the arrival overshoot; driven by the collar's acceleration (§2.2)                                                                                                                                                                                                                                             |
| Poem glyph k (k = 0..4, top → bottom)      | 1400 + 90·k                                                                                                                                                                      | 420                         | opacity 0 → 1, translateY(−4) → 0, enter                   | Brush-order reveal; done at 2.24 s                                                                                                                                                                                                                                                                                            |
| Colophon glyph k (k = 0..6)                | 2000 + 60·k                                                                                                                                                                      | 300                         | opacity, std                                               | Done at 2.66 s                                                                                                                                                                                                                                                                                                                |
| Riddle slip                                | 1900                                                                                                                                                                             | 600                         | `rotateX(-70deg)` → 0, `transform-origin: top`, enter      | Then inherits 0.8× its lantern's θ                                                                                                                                                                                                                                                                                            |
| **Translation**                            | **at settle event** (hero \|θ\| < 1° continuously for one half-period, T/2 = 1.4 s, sampled each frame; floor 2.4 s = poem complete + 160 ms; expected 2.5–3.0 s; ceiling 3.6 s) | 500                         | opacity, std                                               | Verse is read in stillness. A full period was impossible: arrival 1.10 s + 2.8 s > the 3.6 s ceiling                                                                                                                                                                                                                          |
| `data-festival-settled`                    | 3.0–3.6 s (translation landed + 500)                                                                                                                                             |                             |                                                            | Gauntlet gate 4.5 s                                                                                                                                                                                                                                                                                                           |
| **First gust**                             | **4.4 s** (sim time)                                                                                                                                                             | front, ≈ 2.4 s at any point | §4.5                                                       | Launched from x = −0.1 vw, A = 1.8, L → R at 0.55 vw/s (792 px/s at 1440): arrival at a lantern at screen x is `4.4 + (x + 0.1·vw) / (0.55·vw/s)` s, so on `/blog` A (x96) 4.70 s, B (x214) 4.85 s, C (x1385) 6.33 s; on `/` the hero (x1300) 6.22 s. The signature is scheduled, and it comes **after** the verse has landed |

Scripted motion never exceeds one third of visible objects: only lanterns are scripted; moon, florets and text are fades.

### 4.2 Route change (`usePathname()` change, `bench:launch`, or the mobile scroll-lift)

The exit starts at **navigation start**, not at the commit: a capture-phase click listener on internal `<a href>` links (and the rocket's `bench:launch`) runs the exit rows at t = 0 of the click, and the `usePathname()` change confirms it (the new page is read 60 ms after the commit; the enter rows count from `max(commit + 60, exit start + 280) − 280`). `usePathname` alone changed only after Next had fetched and committed the route (≈ 90 ms warm, seconds cold), so the old lanterns rose over the new page. If no pathname change arrives within 4 s the lanterns lower back in on the same page.

| Phase   | Element                             | Delay                                                                               | Duration                                                                               | Easing                          | Notes                                                                                                                                                                                                                                                     |
| ------- | ----------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Exit    | Riddle slip                         | 0                                                                                   | 160                                                                                    | `rotateX(-70deg)` + opacity → 0 |                                                                                                                                                                                                                                                           |
| Exit    | Poem, colophon, translation         | 0                                                                                   | 180                                                                                    | opacity → 0, exit               |                                                                                                                                                                                                                                                           |
| Exit    | Candle: `uLit` → 0, pool + halo → 0 | 0                                                                                   | 160                                                                                    | (0.3, 0, 1, 1)                  | The candle is put out first                                                                                                                                                                                                                               |
| Exit    | Lantern rises 40 px, alpha → 0      | 40                                                                                  | 240                                                                                    | exit                            | θ frozen and carried up; all together, no stagger (exits are dismissive)                                                                                                                                                                                  |
| Persist | Moon                                | 60 (the anchor re-read); 280 when an exiting body still rises across the glide path | 600 glide to the new anchor (centre + diameter), or 280 fade if the new route has none | std                             | "The moon is shared" is literal; `--moon-*` follow so the sky tint glides too. Bodies never cross the disc (§8): when the straight glide, inflated by the disc radius, meets an exiting body's rect (+40 px rise), the glide waits for the exit to finish |
| Persist | Florets                             | —                                                                                   | bounds re-clamp over 400                                                               | damp λ 8                        | Never exit; instances outside the new bounds fade over their next 300 ms and respawn inside                                                                                                                                                               |
| Persist | Wind clock                          | —                                                                                   | —                                                                                      | —                               | Never resets; a gust in flight finishes on the next page                                                                                                                                                                                                  |
| Enter   | Anchor re-read                      | 60 after the new pathname                                                           |                                                                                        |                                 | nav rect, viewport, route table                                                                                                                                                                                                                           |
| Enter   | Lanterns lower-in                   | 300 + 90·i                                                                          | 520                                                                                    | enter                           | Hero first                                                                                                                                                                                                                                                |
| Enter   | Candle catch                        | arrival + 100                                                                       | 420 (keyframes compressed)                                                             |                                 | Pool + halo at catch + 150, 400                                                                                                                                                                                                                           |
| Enter   | Poem glyphs / colophon              | 900 + 70·k / 1300 + 50·k                                                            | 360 / 260                                                                              |                                 |                                                                                                                                                                                                                                                           |
| Enter   | Slip                                | 1100                                                                                | 500                                                                                    | as mount                        |                                                                                                                                                                                                                                                           |
| Enter   | Translation                         | settle event, ceiling 2.4 s after enter start                                       | 400                                                                                    |                                 |                                                                                                                                                                                                                                                           |

Exit 280 ms; enter ≈ 1.0 s to lit. Reduced motion: both 0 ms (state snaps). The mobile scroll-lift (`/blog*` only) runs just the candle row and the lantern row of this table with a 24 px rise over 260 ms instead of 40 px over 240, and on return (`scrollY < 40`) the lantern lower-in and candle-catch rows; mobile has no moon, slip or text, so no other row applies. Under reduced motion the lift is a snap from a passive scroll listener (`sim.snapshotLift`: raised 24 px, unlit, alpha 0 past `scrollY 120`; back at rest below 40), and the §0.16 moon dim snaps the same way, since no loop runs.

### 4.3 Theme switch (`THEME_EVENT`, ridden on `triggerThemeFlash()`)

| Direction              | Element                                                      | Delay           | Duration | Model                         |
| ---------------------- | ------------------------------------------------------------ | --------------- | -------- | ----------------------------- |
| light → dark (dusk)    | `uNight` 0 → 1 (paper albedo → lit shader; sky tint opacity) | 0               | 400      | damp λ 8                      |
|                        | Candle catch per lantern                                     | 120 + 90·i      | 700      | keyframes as §4.1             |
|                        | Pool + halo                                                  | catch + 150     | 500      | (0, 0, 0, 1)                  |
|                        | Moon: 7% daytime disc → full; halo 0 → 0.18                  | 0               | 900      | std                           |
|                        | 走马灯 shadows                                               | with the candle | 700      |                               |
|                        | Poem, colophon, translation, slip colours                    | 0               | 400      | CSS `transition: color 400ms` |
| dark → light (morning) | Candles snuff (`uLit` → 0)                                   | 0               | 260      | exit                          |
|                        | Pool + halo → 0                                              | 0               | 200      |                               |
|                        | `uNight` 1 → 0                                               | 0               | 400      | damp λ 8                      |
|                        | Moon → 7%, halo → 0, sky tint → 0                            | 0               | 500      |                               |

The halo never swaps blend mode (its alpha simply reaches 0 in light); no pop at the crossing. Colour-theme change: re-sample `--accent`, run the hue gate, damp pool/halo tint over 300 ms. Nothing else changes.

### 4.4 Cursor wind (desktop), touch (mobile), scroll (both)

| Input                     | Measure                                                                                   | Force into `W`                                           | Falloff                                                                                                        | Decay                |
| ------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------- |
| Pointer move              | `vx` in px/s from a second `usePointerListener` subscriber (never calls any `invalidate`) | `Fc = clamp(vx / 900, -1, 1) × 6`                        | `× (1 - smoothstep(0, 0.35·vw, dist(pointer, lantern)))` per lantern; florets take 0.25·Fc in a 0.35 vw radius | `exp(-3.5 dt)`       |
| Pointer leaves the window |                                                                                           |                                                          |                                                                                                                | to 0 in ≈ 0.9 s      |
| `touchstart` (mobile)     | tap position                                                                              | local gust A 0.6, `(1 - cos)` over 1.2 s, radius 0.35 vw |                                                                                                                | at most once per 3 s |
| Scroll                    | scroll velocity in vh/s                                                                   | `Fy = clamp(v, -3, 3) × 0.25` vertical                   | uniform                                                                                                        | `exp(-4 dt)`         |

- The lantern is never a magnet: force is proportional to velocity; a still pointer does nothing.
- Scroll wind: florets lift/dip up to 12 px against the scroll; lanterns bob on a cord-stretch spring (ω = 2π/0.45 s, ζ 0.5, max 8 px). Most visible on `/blog/[slug]` and `/past-experience`.
- The poem column is a virtual pendulum in the same sim (L 3.0 u, ζ 0.2, driven at 0.15× the field), rendered as `rotate(θ·0.5)` about its top pin, clamped to ±0.6° after the scaling: the text leans in the wind. The colophon shares its θ. Slips take 0.8× their lantern's θ.

### 4.5 Idle life: the wind field W(x, ts)

`x` in viewport widths (0..1), `ts` in seconds of simulation time.

| Component            | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Units                | `W` is dimensionless. It enters the pendulum as a quasi-static lean: `θ_eq = 0.04 rad · W` (W = 1 leans a lantern 2.3°). Check: cursor `Fc` max 6 → 13.8° (the "cursor can reach 14°" row); first gust A 1.8 → 4.1° static, ≈ 7° at the peak with the ζ 0.12 step overshoot (×1.69)                                                                                                                                                                                                                                                                                                                                        |
| Breeze               | 2-octave fBm over ts/9 s, amplitude 0.5 (→ 1.1° static lean, < 2° with resonance), spatial phase 0.7·x so neighbours are correlated but offset                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Gust train           | Scheduled events from the seeded RNG; interval U(12, 18) s after the first (4.4 s); amplitude A ∈ [1.2, 2.2] (first: 1.8; peaks 4.6–8.6°); direction L → R 80%, R → L 20%; **travelling front** at 0.55 vw/s (1440 px in ≈ 1.8 s); envelope at a point: rise `smoothstep` 350 ms, hold 200 ms, decay `exp(-t/1.4 s)`                                                                                                                                                                                                                                                                                                       |
| Pendulum per lantern | `θ'' = -(g'/L) · (sin θ − 0.04 · W(x, ts) · cos θ) − 2ζω θ'` (the wind term is the lean above, scaled by the same restoring stiffness so a heavier hero leans the same angle but answers slower); **g' = 4π²L/T²** per lantern with L = the drawn cord length in world units, so the visual cord and the pivot always agree; T hero 2.8 s, mid 2.4 s, small 2.1 s (no two within 8%); ζ 0.12 idle, 0.9 during scripted lifts                                                                                                                                                                                               |
| Amplitude            | ≤ 2° between gusts; 5–8° at a gust; cursor can reach 14°; idle clamp ±0.22 rad                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Tassel               | ω 2π/(0.45·T), ζ 0.35 (1.26 / 1.08 / 0.95 s), restoring toward plumb, driven `(1 + R/l)·θ''`, relative angle ±0.35 rad; trails the collar at a gust's onset, whips past the body 50–150 ms after its peak                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Candle flicker       | `1 + 0.06 (noise(7ts) + 0.5 noise(13ts))`, floor 0.94, on paper core and halo scale                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 走马灯 drift         | 10 screen px/s across the paper front × `(1 + 0.15 · noise(0.4 ts))` (convection wavers with the flame)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Florets              | 36 desktop / 6 mobile (florets only) / 24 on `/` (0 on mobile `/past-experience` and `/schedule-a-call`); descent per viewport height: florets 11–16 s, osmanthus leaves 8–12 s, ginkgo 9–13 s; lateral flutter 12–28 px at 0.6–1.1 Hz; spin about the long axis 1–3 rad/s; 20% full tumble (leaves/ginkgo, the Froude split); lateral drift velocity `18·W px/s + 5·curl2D(x, y, ts) px/s` (breeze ≈ 9 px/s, a 1.8 gust ≈ 32 px/s) from one simplex field sampled on the CPU (≤ 36 evaluations per frame) so they never clump; respawn `mod(ts·speed + seed·period, period)` with alpha ramps over the top and bottom 10% |
| Depth bands          | 3: scale 1.0 / 0.7 / 0.45, alpha 1.0 / 0.7 / 0.45, pointer parallax 1.0 / 0.6 / 0.3 of a (8, 4) px offset at the pointer's full travel (normalised pointer −1..1, damped λ 6, decaying to 0 when the pointer leaves the window; none in reduced motion); far band uses the pre-blurred atlas tile                                                                                                                                                                                                                                                                                                                          |
| Moon                 | static between routes; halo breathes ±3% over 11 s; parallax 0.85 (z −3) of the same (8, 4) px pointer offset, written into `--moon-x/--moon-y` so the sky tint and the moon button follow; lanterns take none (§4.4: never a magnet)                                                                                                                                                                                                                                                                                                                                                                                      |
| Loop                 | 60 Hz cap; renders from the layer's own clock only                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

### 4.6 Reduced motion (`usePrefersReducedMotion()` true at any time)

One frame: lanterns at θ = 0.03 rad (a hint of lean, so it is a still photograph, not a diagram), candles lit (dark) at 1.0, florets scattered from the pre-warm, moon full, slip, poem, colophon and translation visible with no transition, 走马灯 frozen on a title. No rAF loop; pointer, touch and scroll listeners detached. Theme switch and route change re-render one frame. Slip hover reveal is a CSS transition of 0 ms.

### 4.7 Tab hidden / covered

- `visibilitychange` → hidden: `cancelAnimationFrame`, drop `last`, pause `ts`; no timer runs while hidden and the same event wakes the loop. Zero frames while hidden; no gust burst on return (the scheduler is on sim time).
- Pause the same way while any of these is open: journey overlay (`data-journey-open` on `<html>`, one attribute write in the journey component), Bench lightbox (z 20), `/orbital` modals (z 100); their closing has no event, so a 200 ms poll resumes the loop. Resume continues the clock.
- `IntersectionObserver` on the canvas (free; matters only if the layer is ever made `absolute`).
- `webglcontextlost` → unmount the scene, keep the module clock. No restore attempt.

---

## 5. Object construction

### 5.1 The lantern (灯笼)

Draw calls for all lanterns on a page: **5** (paper instanced, hardware instanced, cords as one `LineSegments`, halos instanced, pools instanced).

**Paper body:** one `LatheGeometry`, 48 radial × 20 profile segments. Profile in body-height units (y from −0.5 to +0.5, r as a fraction of body width), oblate (width : height = 1 : 0.86), slightly heavier below the equator:

```
y:  +0.50  +0.46  +0.40  +0.30  +0.15   0.00  -0.15  -0.30  -0.40  -0.46  -0.50
r:   0.16   0.30   0.41   0.49   0.545  0.56   0.55   0.50   0.42   0.30   0.16
```

Sixteen rib scallops: `r × (1 - 0.03 · (0.5 + 0.5 cos(16θ)))`. Instance attributes: `aTint` (three paper tints `#ffb61e` / `#ffb020` / `#ffbd2e`, no two lanterns match), `aCandle` (flicker, per frame), `aLit`, `aShadow` (1 on the hero only).

**Collars:** two cylinders (r 0.17, h 0.05) in lacquer with the chestnut chamfer; brass hook ring r 0.06, thickness 0.012. **Cord:** 2 px catenary from the route anchor to the ring. **Tassel:** 28-strand cone (r 0.035 → 0.06, h 0.32) hung 0.08 below the bottom collar; knot sphere r 0.028. All hardware is one `mergeGeometries` `InstancedMesh` with `MeshBasicMaterial({ vertexColors: true })`.

**Light through paper:** the shader in §2.2; no lights. **Halo:** §2.2, peak 0.35, drawn under the paper, skipped on `/`. **Pool:** §2.2.

**走马灯 (revolving lantern), ship: yes, on the hero lantern of every desktop route.** No inner mesh. The shadow is a long strip: `scripts`-free, built at runtime after `document.fonts.ready`: a 4096×128 canvas with the four `featuredProjects[].title` values in `bench.order` — `ICALARMS · PERSONAL ENV · MED NEGOTIATE · CHARADES 2026` — set in Cormorant Garamond 600 caps at 76 px (Cormorant's cap height is 0.63 em, so the caps are 48 px = 37.5% of the strip; cap band vertically centred: baseline y 88, caps y 40–88 of 128), tracking 0.08 em, painted black on transparent, blurred 2 px (a shadow through paper is soft), then copied into a `DataTexture` of `RedFormat` / `UnsignedByteType` (512 KB) from the canvas alpha. Text occupies ≈ 2600 of 4096 px; the remainder is the pause between loops.

Sampling: `shadow = texture(uShadow, vec2(fract(uScroll + atan(p.x, p.z) / 6.2832 * 0.15), p.y + 0.5)).r` (the full strip height maps onto the paper height); lit paper darkens by `0.6 · shadow · pow(through, 0.6) · uLit` (0.35 read as a smudge at 1×; with the paper's own `through^1.35` only two or three caps read at a glance, the softened view term keeps letters legible to ≈ 35 px from the drum centre, four to five caps on the 88 px hero). `0.15` means one circumference of the drum reads 15% of the strip, so a 49 px cap advance on the strip becomes 22 px on an 88 px hero (circumference 276 px), 18 px on a 72 px hero; cap height 48/128 of the paper height gives 28 px at 88, 23 px at 72. `uScroll` advances 10 screen px/s equivalent (strip loops in ≈ 124 s; a title enters and leaves the lit front in ≈ 16 s). The text reads forward (the cut-outs face outward); mirrored letters would cost V6 its human read. Unlit paper shows nothing. This is the site's typographic moment and the reason the object cannot be swapped onto another résumé.

Legibility gate (§7.7 V6): on the 88 px and 72 px heroes the gauntlet crops the drum at 2× and asserts ≥ 3 letter-width columns with ≥ 12% luminance drop against adjacent lit paper, plus a human eye pass. If the 72 px `/` hero fails, `/` falls back to plain paper (`aShadow = 0`) and the 88 px heroes keep the strip; the sub-flag is `festival.revolvingOnHome`.

### 5.2 Falling things (one `InstancedMesh`, one draw call, one atlas)

Atlas 1024×512 `CanvasTexture`, `SRGBColorSpace`, mipmaps, four tiles (three species + a pre-blurred far-band floret), `alphaTest 0.5`, `DoubleSide`, `MeshBasicMaterial` with `instanceColor`; per-instance UV rect as a 4-value attribute. `PlaneGeometry(1, 1)` scaled per instance. Species mix on a 36-instance page: 22 florets, 8 osmanthus leaves, 6 ginkgo (≤ 17%).

| Species                 | Geometry / drawing                                                                                                                                         | Screen size         | Per-instance ranges                                               | Colour                                                                                       |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Osmanthus floret (桂花) | 4-lobed corolla, lobes divided almost to the base, tiny tube at the centre 1 px darker; three florets per tile (they fall in fascicles), the tile 16–26 px | 6–10 px per corolla | descent 11–16 s/vh, flutter 12–20 px, spin 1–2 rad/s              | 80% `#f0c239`, 15% `#fff6dc`, 5% `#ff8936`; cooled toward `#e9f1f6` by moon proximity (§2.3) |
| Osmanthus leaf          | long-elliptic 3.2 : 1, entire margin, glossy: a 30% white streak along one side                                                                            | 22–34 px            | descent 8–12 s, flutter 18–28 px, spin 1–3 rad/s, 20% tumble      | `#789262` top, `#8fa37a` underside (DoubleSide flips it)                                     |
| Ginkgo fan              | bilobed fan with a central notch, no midrib, dichotomous veins as 7 forking strokes from the petiole, petiole 0.6× blade                                   | 26–40 px            | descent 9–13 s, flutter 20–28 px, mostly side-to-side, 10% tumble | `#d3b17d` mixed 40–70% with `#9aa66f`: late September, still turning                         |

Per-instance attributes set once: `seed`, `species`, `band`, `speed`, `flutterHz`, `flutterAmp`, `spinRate`, `tumble`, `phase`, colour. Matrices composed on the CPU per frame with one shared `Matrix4/Quaternion/Vector3`. Emitter bounds per route (§3) are px rectangles; instances outside them respawn at the top of their band. Nothing falls over the Calendly iframe, the H1s or the Bench plates, and `layout.ts` adds the moon disc (+12 px), the verse, colophon and translation rects (+6 px) and every lantern body and slip strip (+6 px; +8 on mobile) to every route's floret exclusions at resolve time, so the fall passes beside the moon (§2.3's cool tint is on florets _near_ it), never through the 55–70% verse ink, and never across the paper (band-0 instances sit in front of the lanterns, and a 30 px ginkgo on the hero drum read as a sticker, not a leaf in the wind). Mobile pages carry 6 florets and no leaf or ginkgo (§3.3).

### 5.3 The moon

One plane (§2.2), 120–150 px desktop, none on mobile. z = −3 (parallax 0.85). Dark: full disc, limb darkening, `moonRim` limb tint, halo to 2.2×, CSS 黛蓝 tint. Light: 7% alpha disc, maria at 3%, no halo, no tint. The maria are NASA's; the rabbit is where tradition finds it, not drawn. Hover/focus shows its name (§6.A5).

**Texture build:** `scripts/build-moon-texture.mjs` (run by hand once, output committed, source and licence in the header). It launches the scratchpad's playwright-core Chromium, draws NASA SVS 4720 `lroc_color_poles_1k.jpg` (`https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_poles_1k.jpg`, 139 KB, CGI Moon Kit, public domain; fetched into the scratchpad by the script, never committed) onto a 2D canvas with an orthographic projection of the near side at sub-Earth point (0°, 0°), desaturates 60%, applies limb darkening `pow(1 - r², 0.35)`, tints the rim 12% toward `moonRim` over an ivory base, and writes `public/festival/moon-nearside-512.png` (512², alpha outside the disc, ≈ 40 KB). No project dependency is added.

### 5.4 Other objects: decisions

| Object                                        | Ship                                                                   | Reason                                                                                           |
| --------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Riddle slip (灯谜 strip) on lantern B         | **Yes**, `/blog`, `/past-experience`, `/schedule-a-call`               | The data tie-in; a real form (a paper strip hung on the lantern, pulled to check the answer)     |
| 走马灯                                        | **Yes**, the hero of every desktop route (`/` gated)                   | Shadows of real titles through paper: the thesis as an object                                    |
| Poem column + translation + colophon          | **Yes**, one line, moon pages                                          | Text as attention device, tier 1; the colophon is how a strip is dated                           |
| Rabbit (lantern or figure)                    | **No**                                                                 | Rabbit lanterns are 元宵; at Mid-Autumn the rabbit is in the moon, and NASA's maria hold it      |
| Osmanthus branch                              | **No**                                                                 | A branch is a prop; florets falling from the moon (the 桂子 rain) is the story, at zero geometry |
| Mooncake seal (印)                            | **Partial**: a 9 px 银朱 seal square at the foot of the slip, no glyph | A seal signs a paper slip; a glyph at 9 px is illegible ornament; a mooncake is clip-art         |
| Chang'e                                       | **No**                                                                 | Figure illustration is where kitsch begins                                                       |
| Palace lantern (宫灯)                         | **No**                                                                 | A second silhouette dilutes the one perfect object                                               |
| Clouds (祥云), stars, bokeh, dust             | **No**                                                                 | Particle fields fail the slop test                                                               |
| Ginkgo                                        | **Yes, minority (≤ 17%)**, half-green                                  | Honest phenology; Tyler asked for leaves, so leaves fall, but osmanthus leads                    |
| Bloom, post-processing, scene lights, shadows | **No**                                                                 | Measured worse and slower; the paper shader is the light                                         |

---

## 6. Typography plan

### 6.A Festival-only moments (inside `components/festival/`, die with the flag)

**Script.** Simplified by default (`festival.script: 'Hans'`); one constant flips to Traditional, and both glyph sets are in the subset. This is a question for Tyler before ship, not a guess: the bible defaults to Simplified because the site's existing voice is contemporary, and the flip costs nothing.

**Font.** Han glyphs are set in a hand-subset **Noto Serif SC 500** (a Song face beside a Garamond: serif with serif), loaded with `next/font/local` inside the festival component (`preload: false`, `display: 'swap'`, `variable: '--font-cjk'`, `adjustFontFallback: false`, `declarations: [{ prop: 'unicode-range', value: 'U+4E00-9FFF, U+3000-303F, U+00B7' }]`). Subset text: `中秋丙午年八月十五打一项目文谜底千里共婵娟玉盘項謎嬋盤·` (28 glyphs; 盤 is the Traditional 盘 for the moon's name, ≈ 9 KB woff2), built by `scripts/build-festival-font.mjs`: it downloads `https://github.com/notofonts/noto-cjk/raw/main/Serif/SubsetOTF/SC/NotoSerifSC-Medium.otf` (11.7 MB, OFL; 200 verified) into the scratchpad, then runs `pyftsubset NotoSerifSC-Medium.otf --text=… --layout-features=vert,vrt2,locl,kern,halt --no-hinting --desubroutinize --flavor=woff2` (`/opt/miniconda3/bin/pyftsubset`, fontTools 4.62.1 is installed; the script fails loudly with the install hint if it is missing). Run once, output committed to `components/festival/fonts/NotoSerifSC-festival.woff2`; the source OTF is never committed. Han spans use `font-family: var(--font-cjk), var(--font-display), serif` and contain no Latin; Latin spans use `var(--font-display)` first so Cormorant never falls into Noto. Every Han span has `lang="zh-Hans"` (or `zh-Hant`).

**Text tiers:** T1 poem 22 px; T2 translation 17 px italic, slip card 19 px italic, 谜底 line 17 px (label 15 px, optical); T3 colophon 11 px Han + 10 px mono, slip labels 10–15 px. Nothing festival-textual exceeds an H1.

**A1. The colophon dateline.** `丙午年八月十五` (bǐng wǔ nián bā yuè shí wǔ: year 丙午, eighth month, fifteenth day; 2026 = 1966 + 60; Mid-Autumn 2026 is 25 September) plus, on `/` only, `THE FIFTEENTH NIGHT` on a second line in Plex Mono `--label-xs` (10 px / 0.10 em, at weight 400 and 72% opacity so the Han date stays the line and the label its caption). On moon pages it is a **vertical column** to the left of the poem column (`writing-mode: vertical-rl; text-orientation: upright`), Noto Serif SC 500 at 11 px, tracking 0.12 em, colour `--muted`, top-aligned with the poem. On `/` it is horizontal, two lines right-aligned to x1420 from y252: Han 11 px, then the mono label 3 px below (a single line ran onto the laptop screen). Rendered by `PoemColumn.tsx` inside the overlay; the string is computed from `festival.date` in `lib/festival.ts` by `Intl.DateTimeFormat('zh-Hans-u-ca-chinese', { year: 'numeric', month: 'long', day: 'numeric' }).formatToParts()` → `yearName + '年' + month + hanDay(day)`, where `hanDay` is a 30-entry table (`一 … 十 十一 … 二十 廿一 … 三十`; ICU returns the day as `15`, verified on Node 24). `lib/festival.test.mjs` asserts the result is exactly `丙午年八月十五`; on any mismatch at runtime the literal from the test is used. Under `script: 'Hant'` the same parts are formatted with `zh-Hant-u-ca-chinese` (identical glyphs for this date). No hover `title` (the overlay root is `pointer-events: none`, so a tooltip could never show). Motion: §4.1.

**A2. The 走马灯 shadow titles** (§5.1): Cormorant Garamond 600 caps, 76 px on a 4096×128 strip, tracking 0.08 em, 2 px blur, read as moving shadows on the hero lantern. Data: `featuredProjects[].title` (four titles). Typography as light through paper.

**A3. The riddle slip (灯谜)** on lantern B. At rest: a vertical paper strip 38 × ≈ 150 px hung 14 px under the bottom collar, showing only the 谜目 in vertical upright writing (`打一项目` "guess one project" or `打一文` "guess one post"), Noto Serif SC 500 at 15 px, tracking 0.18 em, ink `#2b241c`, with a Plex Mono `--label-xs` index (`03/12`, tabular, no spaces: five glyphs at 10 px fit the 36 px strip interior) at the top and the 9 px 银朱 seal at the foot. Top edge lit by the lantern above: `linear-gradient(180deg, rgba(255,182,30,.22), transparent 38%)`, 1 px `#d9cbb0` edge. The strip is a `<button aria-expanded>` with a 44 px padded hit area; on hover / focus / tap it "pulls" (translateY +6 px, 180 ms, enter), and a card unfolds 8 px under the strip's foot, inside the gutter (max-width 28ch of its own Cormorant italic = 236 px, narrowed to the gutter and kept 8 px clear of the copy column and the viewport edge; `text-wrap: pretty`, `hanging-punctuation: first`; `layout.ts` resolves the rect against the same exclusions as the strip and a slip whose card cannot be placed is not hung) with the 谜面 in **Cormorant Garamond italic 500, 19 px, line-height 1.3** on `#efe4cf`; 600 ms later the 谜底 line: `谜底 · iCalarms ↗` in Cormorant Garamond 500, 17 px, `lining-nums`, underlined in `--accent`, an `<a>` to `project.link` (the arrow is an inline SVG: no served font has U+2197, and a system glyph broke the underline). The line is a wrapping flex row (label, then the link as one unbreakable unit): on the 160 px `/past-experience` card a long title drops to its own line whole, never 'Med / Negotiate'. Escape closes (wherever focus is) and returns focus to the strip button (`aria-controls` points at the card); a hover-opened card closes 400 ms after the pointer leaves (the diagonal from the strip to the 谜底 link crosses bare page first; ≈ 80 ms of it on `/schedule-a-call`), while a focus- or click-opened card stays until blur or Escape: a click on a hover-opened slip keeps it open; mobile has no slips. `aria-label="Lantern riddle: {clue}. Answer: {answer}"`. Positioned each frame from the lantern's bottom-collar world point (`damp` λ 12), inheriting 0.8× θ. Contrast of ink on slip paper ≥ 7:1.

Riddles are composed from `content/projectData.ts` and the blog front matter only, in `lib/festivalRiddles.ts`, validated by `lib/festivalRiddles.test.mjs` (every 谜底 equals an existing `projects[].title` or blog `title`; every 谜面 keyword appears in its cited field; every href equals the entry's `link` or `/blog/<slug>`). The slate, each line verified against the file on 2026-09-25:

| #   | 谜面 (Cormorant italic)                                               | 谜目     | 谜底                      | Source field (verbatim anchor)                                                          |
| --- | --------------------------------------------------------------------- | -------- | ------------------------- | --------------------------------------------------------------------------------------- |
| 01  | Calendar events become alarm rules.                                   | 打一项目 | iCalarms                  | `bench.description` "Calendar events become configurable alarm rules"                   |
| 02  | A party game you play by tilting the phone.                           | 打一项目 | Charades 2026             | `description` "party game … tilt-controlled gameplay"                                   |
| 03  | Secrets kept in the Keychain; folders opened only when you say so.    | 打一项目 | Personal Env              | `description` "Apple Keychain storage … explicit local folder approval"                 |
| 04  | It clones the repo, runs it, and asks before it changes anything.     | 打一项目 | Personal Software Builder | `description` "cloning … running … visible approvals around local repo mutation"        |
| 05  | Reads the bill, audits the charges, drafts the letter.                | 打一项目 | Med Negotiate             | `description` "extracts line items, audits charges … drafts provider outreach"          |
| 06  | Fish and Viet Cong, played from a browser.                            | 打一项目 | Multiplayer Card Games    | `description` "playing Fish and Viet Cong online"; `proof` "browser-playable"           |
| 07  | A Discord bot that runs the stock market as a game.                   | 打一项目 | StonksGame                | `description` "Discord bot that runs live stock-trading simulations"                    |
| 08  | Reads the air and warns of fire.                                      | 打一项目 | Wildfire Detection        | `description` "ingests air-quality data and flags wildfire risk"                        |
| 09  | Tell it in plain words; it routes the documents in Drive.             | 打一项目 | DocuPilot                 | `description` "Google Drive agent … natural language chat, handling routing"            |
| 10  | An instructor and a TA, both agents, teach the lesson.                | 打一项目 | Kinetic                   | `description` "instructor and TA agents to deliver multi-modal lessons"                 |
| 11  | Goals, habits, gentle reminders.                                      | 打一项目 | Grow & Give               | `description` "set goals … habit tracking and gentle reminders"                         |
| 12  | The first post; one minute to read; dated the fourteenth of February. | 打一文   | Introduction              | front matter `excerpt` "first blog post :)", `readTime` "1 min read", `date` 2026-02-14 |

Rotation: the slate is two pools, 打一项目 (riddles 01–11, in slate order) and 打一文 (12, one per published post). `/past-experience` (routeSeed 0) and `/schedule-a-call` (routeSeed 5) draw `pool项目[(dayOfYear + routeSeed) mod 11]`, so the two pages never show the same riddle on the same day; `/blog` draws `pool文[dayOfYear mod pool文.length]` (with one post: always 12). The index label is the slate number over the slate size (`03/12`). The 谜底 link: external `project.link` opens with `target="_blank" rel="noreferrer"`; `/blog/<slug>` is a Next `Link`. Blog metadata reaches the layer as a prop from `getAllPostMeta()` (`lib/blog.ts:353`) in the server layout, so riddle 12 is data, not a string. Nothing in a 谜面 asserts anything not in the source field.

**A4. The poem column.** One line, moon pages only, hung under the moon's lower-left limb (lower-right on `/orbital`, where the moon is left): `千里共婵娟` (Su Shi, 水调歌头, Mid-Autumn 1076; pinyin _qiān lǐ gòng chán juān_; "a thousand miles apart, we share one moon"). Noto Serif SC 500, 22 px, `writing-mode: vertical-rl; text-orientation: upright; letter-spacing: 0.18em; line-height: 1; margin-block-end: -0.18em`, colour `#d6ecf0` at 55% (dark) / `--muted` (light). Markup: `<figure>` containing the column (the figure's `aria-label` is the line alone; glyph spans `aria-hidden`) and a `<figcaption>` with the translation and the pinyin, so screen readers get the verse once and the translation once. **Translation:** Cormorant Garamond italic 500, 17 px, moon-white 70%, right-aligned to x1420 (left-aligned x128 on `/orbital`), visible by default, arriving at the settle event (§4.1). **Pinyin** in Plex Mono `--label-xs` under the translation, revealed on keyboard focus of the figure only. Mobile: absent. The column is the only tier-1 festival text; the H1s keep the top of the hierarchy. The column leans in the wind (§4.4).

**A5. The moon's name.** Hover/focus on the moon (a borderless `<button>` the size of the disc, `pointer-events: auto`, `aria-label="Full moon, fifteenth night of the eighth month"`) shows `玉盘 · jade plate` for 1.6 s in the translation's style, 12 px under the disc and right-aligned to its right edge on right-moon routes (centred, the name sat level with the poem column's first glyph; 8 px above the disc on `/orbital`, where the verse hangs under the moon; the HTML overlay there sits at z 4, above `.orb-shell`, while the canvas stays under the rings at z 2). Quiet and data-free. **Ships**: it exists only on hover/focus for 1.6 s in the translation's style, so it cannot compete with anything; the gauntlet's `moon hover` state captures it (§7.7).

Not shipped: any change to eyebrows, H1s or wordmarks during the festival; a lunar dateline on blog posts (no post falls in the window); any animated or "breathing" text; any text over an H1, nav, dock or tap target; any festival text on mobile.

### 6.B Permanent upgrades (own PR, ships _before_ the festival, stands alone after it)

Order matters: B1 is blocking, because the festival's "same serif" argument is false on four of six routes today.

**B1. Fix the family utilities (blocking).** `font-[var(--font-display)]` and `font-[var(--font-mono)]` compile to `font-weight: var(--font-display)` in Tailwind v4 and are dropped. Replace all 33 (count verified: `grep -rn 'font-\[var(--font-' app components` = 33; Tailwind 4.1.17 compiles the class to `font-weight: var(--font-display)`, confirmed with `compile()`) with `font-display` / `font-mono` (generated from `@theme inline`, `app/globals.css:101-103`): `components/NavBar.tsx:40,131`, `components/ThemeBar.tsx:58,137`, `app/blog/page.tsx:17,21,43,51,59`, `app/blog/[slug]/page.tsx:66,71,81,91,92,93`, `app/past-experience/page.tsx:35,38,50,58,73,78,89,95,108,123,126,154,165,169,182`, `app/schedule-a-call/page.tsx:28,31,68`. The hand-written `.font-display` rule at `globals.css:187-191` shadows the generated utility and carries `letter-spacing: -0.035em; line-height: 0.96`; in B1 reduce it to the family declaration only (B3 owns tracking and leading through the `.display` recipe), so the H1s do not inherit a tracking they never had. Add a computed-style assertion to the capture script (every H1 on those routes reports `Cormorant Garamond`; every eyebrow `IBM Plex Mono`).

**B2. One label scale.** Promote `--label-xs` (10 px / 0.10 em / 500 / uppercase, `globals.css:27-33`) to the site eyebrow: rewrite `.eyebrow` (`globals.css:178-185`) as `font: 500 var(--label-xs)/1.4 var(--font-mono); letter-spacing: var(--label-xs-tracking); text-transform: uppercase;` and replace the eight inline Tailwind tracking variants (0.18–0.24 em) with it. `--label-sm` (11 px / 0.08 em) for datelines, read-times and tags; `--label-md` (12 px / 0.06 em) for the footer "Theme controls". Remove the no-op `tabular-nums` on Plex Sans or leave one comment.

**B3. Display scale, weight, figures.** Next to the label tokens:

```css
--display-1: clamp(2.6rem, 4.4vw, 4.35rem); /* page H1, same as Bench */
--display-2: clamp(1.75rem, 2.6vw, 2.25rem); /* section H2, post title */
--display-3: 1.25rem; /* card H2/H3; Cormorant floor is 20px */
```

and a `.display` recipe: `font-family: var(--font-display), 'Cormorant Garamond', Georgia, 'Times New Roman', serif; font-weight: 500` (600 at `--display-3`); `letter-spacing: -0.015em` at display-1, `0` at display-2, `0.005em` at display-3 (Cormorant needs more air as it gets smaller; drop the −0.03/−0.035 em at `globals.css:187-191` and `.blog-prose h2, h3` `globals.css:498-505`, sizes at `507-517`); `line-height: 0.96 / 1.05 / 1.15`; `font-variant-numeric: lining-nums` (the served Cormorant defaults to old-style figures, so "Book a 15-minute chat." and "Charades 2026" stop dipping); `text-wrap: balance`; `font-kerning: normal`. Apply to the H1s in the four `app/**/page.tsx` files and to `.blog-prose` headings. Italic never gets negative tracking. The Bench H1 keeps 600 / −0.02 em (tuned against the grey set); a 500 trial is a follow-up screenshot pass.

**B4. The blog reading column.** In `app/blog/[slug]/page.tsx:89-101` remove the whole `[&_h1]…[&_pre]` override block (the `className` string of the `blog-prose` div) so `.blog-prose` owns the article; in `globals.css:487-491` set `.blog-prose { max-width: 66ch; font-size: 1.0625rem; line-height: 1.6; text-wrap: pretty; hanging-punctuation: first last; }` centred in the card. In `lib/blog.ts` demote markdown headings (`#` → `h2`, `##` → `h3`, `###` → `h4`) so a post has one H1, and add smart punctuation in `renderInlineMarkdown` (`'` → ’/‘, `"` → “ ”, `-` → `–`, `--` → —, `...` → …; code spans untouched). Post title → `--display-2`, section h2 → `--display-3`, h3 → Plex Sans 600 1.125rem. Before: 98ch, leading 2.0, four H1s, straight quotes; after: 66ch, 1.6, one H1, curly quotes. At 390 px add `hyphens: auto`.

**B5. One wordmark, one nav grammar.** "Tyler Xiao" in Cormorant Garamond 500 at 1.1rem, tracking −0.01 em, mixed case, on both `components/NavBar.tsx:40` (remove the typed caps `TYLER XIAO`) and `Bench.module.css:70-76` (from Plex 650). Nav links Plex Sans 500 at 0.82rem / 0.015 em everywhere (the Bench values), one indicator style (the Bench underline, `Bench.module.css:106-125`) instead of the pill. Mobile menu (`NavBar.tsx:131`) → `font-mono` at `--label-sm`. Leave the NavBar inside the padded containers on `/past-experience` and `/schedule-a-call` (the inset band is what keeps those gutters lantern-safe).

**B6. Global hygiene** in the `body` block (`globals.css:131-137`): `font-synthesis: none` (kills the faux-bold Plex Mono 600 at `globals.css:1297,2248,2938`; load 600 or drop to 500); `-webkit-font-smoothing: antialiased` only in dark, `auto` in light; one Cormorant fallback stack everywhere (`globals.css:188,500,1947`, `Bench.module.css:224,551`); `text-wrap: balance` on all H1/H2 and card titles, `text-wrap: pretty` on `.blog-prose p/li`, the exp/call leads and Bench `.intro p`; fix the `.orb-hero-tools`-over-H1 overlap at ≤ 760 px (`position: static` in that query); delete the orphan `.blog-topbar/.blog-shell/.blog-article*` block (`globals.css:262-484`; no `.tsx` references any of the three, verified).

**B7. A CJK slot that outlives the festival.** One rule, no font: `[lang^="zh"] { font-family: var(--font-cjk, 'Noto Serif SC', 'Noto Serif TC', 'Songti SC', 'Songti TC', serif); line-height: 1.7; letter-spacing: 0.04em; font-feature-settings: "locl", "kern"; }`. `--font-cjk` is unset outside the festival, so any future Chinese text renders in a Song face at correct leading without festival code, and the festival only fills the variable.

**B8 (optional, later).** Self-host Cormorant Garamond 500/600 roman and 300/400 italic with full features (95/66 KB each) to unlock true small caps and `dlig`; Plex Mono 400/500 with `zero` for the terminal. Not required by the festival.

Verification for B: rerun the computed-style census (the capture script) before/after; §7.7 T1.

---

## 7. Engineering plan

### 7.1 Files

```
lib/festival.ts                          flag, window, script choice, route allow-list, seed parsing (pure, testable)
lib/festivalRiddles.ts                   riddle slate composed from projectData + blog meta
lib/festivalRiddles.test.mjs             every 谜底 exists; every 谜面 keyword is in its cited field; every href matches (node test, like lib/formatPeriod.test.mjs)
lib/festival.test.mjs                    window/flag/query parsing; the colophon string equals 丙午年八月十五 (Intl chinese calendar, §6.A1)
components/festival/FestivalMount.tsx    'use client'; owns `dynamic(() => import('./MidAutumnLayer'), { ssr: false })` and the client-side gate (window dates, ?festival=, localStorage). Next 16 refuses `ssr: false` inside a Server Component, and app/layout.tsx is one
components/festival/MidAutumnLayer.tsx   the ONE client layer (three is imported only here, so it loads only when the gate passes); mounted through FestivalMount after {children}
components/festival/FestivalCanvas.tsx   raw three r182 (no R3F): renderer, camera, 60 Hz clock, visibility/IO, theme sampling, pointer velocity; writes projected anchors to CSS vars
components/festival/FestivalType.tsx     HTML overlay root: PoemColumn (A1, A4, A5) + RiddleSlip (A3)
components/festival/RiddleSlip.tsx
components/festival/PoemColumn.tsx
components/festival/scene/sim.ts         PURE: pendulums, tassel/poem springs, floret loop, pre-warm; seeded; no three imports
components/festival/scene/loop.ts        rAF at ≤ 60 Hz, pause / poll / resume (visibilitychange, overlays), frame timing; timers injected, node-tested
components/festival/scene/themeSampler.ts  data-theme + --accent read, OKLCH hue gate, damped uNight and pool/halo tints; DOM-free, node-tested
components/festival/scene/moonController.ts  moon glide / fade between anchors, scroll dim, the moon's day/night blend behind one setNight(); node-tested
components/festival/scene/tween.ts       the small from → to tween the three above share
components/festival/scene/wind.ts        MODULE-SCOPE clock + W(x,t): breeze, gust scheduler (seeded), fronts, cursor/touch/scroll terms
components/festival/scene/lantern.ts     lathe profile, hardware merge, paper shader, 走马灯 strip texture
components/festival/scene/fall.ts        atlas painter + InstancedMesh + species params + curl noise
components/festival/scene/moon.ts        disc + halo quads
components/festival/scene/layout.ts      per-route anchors (px → world), moon anchors, emitter rectangles, exclusion rects, nav-rect reader, z-index
components/festival/scene/projectPx.ts   world → px for the HTML slips and poem pin
components/festival/palette.ts           constants of §2.1
components/festival/fonts.ts             localFont(NotoSerifSC subset) → --font-cjk
components/festival/festival.css         tokens under html[data-festival="mid-autumn"]; sky-tint gradient
components/festival/festival.module.css  slip, card, poem, colophon styles
components/festival/fonts/NotoSerifSC-festival.woff2   hand subset (≈ 9 KB)
components/festival/sim.test.mjs         periods within 2% of T; settle < 6 s; no NaN after 10 min; hidden = 0 steps; same seed → same state
public/festival/moon-nearside-512.png    NASA-derived near-side disc (≈ 40 KB)
scripts/build-festival-font.mjs          pyftsubset wrapper (documented, run once, output committed)
scripts/build-moon-texture.mjs           playwright-core headless canvas projection (documented, run once, output committed)
scripts/gauntlet-festival.mjs            acceptance test (§7.7)
```

Touched outside the directory: `app/layout.tsx` (+4 lines, and `RootLayout` becomes `async`), `components/concept/shared/runtime.ts` (+`useWebGLSupport` with its module cache and `noMobileSubscribe`, lifted from `Bench.tsx:80-99`; Bench imports it, 2 lines), `components/home/BenchHome.tsx` (+1 line inside `handleRocketClick` after `setLaunching(true)`: `window.dispatchEvent(new CustomEvent('bench:launch'))`), `components/journey/JourneyOverlay.tsx` (+1 attribute write `data-journey-open` on `<html>` while open; it is mounted inside `Bench.tsx:57`, so this matters on `/` only). Shared hooks reused: `damp`, `dampAngle`, `useMounted`, `usePrefersReducedMotion`, `usePointerListener`; theme via `useThemeMode()` and `THEME_EVENT`.

Layout mount (`app/layout.tsx`, after `{children}` so DOM order breaks z ties):

```tsx
{
  festival.enabled && <FestivalMount posts={await getAllPostMeta()} />;
}
// FestivalMount ('use client'): const MidAutumnLayer = dynamic(() => import('./MidAutumnLayer'), { ssr: false });
// it returns null until its own gate (§7.2) passes, then renders <MidAutumnLayer posts={posts} />
```

**Raw three, not a second R3F root:** the bench's R3F invalidator is a global (`setBenchRenderInvalidator`) that the overlay must never touch; a raw renderer with its own 60 Hz clock has no event system to accidentally share. `three/addons/utils/BufferGeometryUtils.js` for the merge. No new dependencies.

**Module-scope wind ownership:** `wind.ts` keeps its state on `globalThis.__festivalWind` (created once, versioned), so React StrictMode's double mount and HMR do not create two clocks; listeners (`visibilitychange`, scroll) are registered once with an ownership token and removed in the layer's cleanup only if the token matches; `import.meta.webpackHot?.dispose()` clears the singleton in dev. `window.__festival` (under `?bench-debug=1`) exposes `wind(t)`, `renderer.info`, lantern θ arrays and the frame counter.

### 7.2 Kill switch and path policy

- `lib/festival.ts`: `export const festival = { enabled: true, script: 'Hans', date: '2026-09-25', window: { start: '2026-09-21', end: '2026-10-04' }, revolvingOnHome: true }`. `enabled: false` and `NEXT_PUBLIC_FESTIVAL=0` are read on the server in `app/layout.tsx` and remove the mount, the font, the CSS attribute and every festival DOM node. The **window** and the runtime overrides are read on the client inside `FestivalMount` (it is `ssr: false`, so there is no hydration mismatch and no server clock to disagree with): outside `window` (calendar dates compared in the visitor's local time) the mount renders `null` and `three` is never requested; `?festival=0|1` overrides both the window and the flag at runtime (persists to `localStorage.festival`; `1` is how the layer is reviewed after 10-04), `?festival-seed=<n>` fixes the RNG (same gate style as `?bench-debug=1`). The layer sets `html[data-festival="mid-autumn"]` in its mount effect and removes it in cleanup; nothing else writes that attribute.
- Routes: **allow-list** `/`, `/orbital`, `/blog`, `/blog/[slug]`, `/past-experience`, `/schedule-a-call`; everything else (`/terminal`, `/journey`, `/concept/*`, unknown) is off. `usePathname()` drives `setRoute`, which runs the §4.2 exit/enter.
- Mobile threshold matches the Bench: `matchMedia('(max-width: 700px)')`.
- Removal after the festival: delete `components/festival/`, `lib/festival*.ts`, `public/festival/`, the three scripts, and the 4 + 1 + 1 lines in `layout.tsx`, `BenchHome.tsx`, the journey component. `useWebGLSupport` in `runtime.ts` and B7's `[lang^="zh"]` rule are the only intended survivors.

### 7.3 Canvas configuration (mirrors the bench's real attributes)

```ts
const renderer = new THREE.WebGLRenderer({
  canvas,
  alpha: true,
  antialias: true,
  premultipliedAlpha: true,
  powerPreference: 'high-performance',
  stencil: false,
  depth: true,
});
renderer.toneMapping = THREE.NoToneMapping; // amber stays honest
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0x000000, 0);
renderer.setPixelRatio(Math.min(devicePixelRatio, mobile || isHome ? 1 : 1.5)); // dpr 1 on `/`: the bench already runs [1,1.5]
renderer.shadowMap.enabled = false;
const camera = new THREE.PerspectiveCamera(30, w / h, 0.1, 40);
camera.position.z = h / 100 / 2 / Math.tan(Math.PI / 12); // 1 world unit = 100 CSS px at z = 0 (16.79 at 900 px tall)
```

Lanterns at z ∈ [−0.4, 0.2], pools at lantern z − 0.2, florets in three bands z ∈ [−1.5, 1.5], moon at z −3. Resize: recompute camera z and aspect, `setSize(w, h, false)`, re-anchor from px. Render order: halos → pools → paper → hardware → cords → moon → fall (the moon before the fall: florets are nearer than z −3 regardless, and a floret faded out over the disc by an exclusion would otherwise write depth and punch a dark hole in a moon drawn after it).

### 7.4 Layering

Canvas and HTML overlay are siblings in one `position: fixed; inset: 0; pointer-events: none` root appended after `{children}`, with `z-index` from `layout.ts` per route: `/` 2 (mobile 1), `/orbital` 2, NavBar routes 1. Never ≥ 999 (the grain must multiply over the lanterns too: same film stock). Only the slip button, its card link, the poem figure (focus target) and the moon button set `pointer-events: auto`. Lantern bodies keep ≥ 24 px below the nav band's bottom edge, read live from `document.querySelector('header.sticky')?.getBoundingClientRect()` on scroll/resize (131 px at load on `/past-experience` and `/schedule-a-call`, 75 px pinned). Exclusion zones are a placement rule (§3), not a stacking rule.

### 7.5 Performance budget (contract; the gauntlet fails on any miss)

| Metric                                                        | Budget                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Where enforced                              |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| WebGL contexts                                                | 2 on `/`, 1 elsewhere, 0 on `/terminal`                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | gauntlet                                    |
| Draw calls per frame                                          | ≤ 7 (paper, hardware, cords, halos, pools, fall, moon)                                                                                                                                                                                                                                                                                                                                                                                                                                                          | `renderer.info` via `window.__festival`     |
| Programs / textures / geometries                              | ≤ 7 / ≤ 5 (atlas, fibre, shadow strip, moon, halo) / ≤ 6                                                                                                                                                                                                                                                                                                                                                                                                                                                        | same                                        |
| Triangles                                                     | ≤ 8 000 (measured 7 826 on the three-lantern routes, 98%: the next saving is the 48×20 lathe's 20 profile segments → 16, ≈ −900 tris, invisible at 88 px)                                                                                                                                                                                                                                                                                                                                                       | same                                        |
| Lantern instances                                             | ≤ 3 desktop, ≤ 1 mobile                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | same                                        |
| Fall instances                                                | ≤ 36 desktop, ≤ 12 mobile                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | same                                        |
| dpr                                                           | ≤ 1.5 desktop (1 on `/`), 1 mobile                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | same                                        |
| Loop                                                          | ≤ 60 renders/s; 0 when hidden; ≤ 1 per 2 s in reduced motion                                                                                                                                                                                                                                                                                                                                                                                                                                                    | same                                        |
| Overlay `render()` CPU                                        | ≤ 1 ms avg (prototype 0.12–0.20); `window.__festival.frameMs()` reports the frame's exponential average and its max over the last 120 frames                                                                                                                                                                                                                                                                                                                                                                    | same                                        |
| rAF gap p95 on `/` idle, both settled                         | ≤ 12 ms; gaps > 33 ms = 0; long tasks = 0 (bench alone 9.3 ms)                                                                                                                                                                                                                                                                                                                                                                                                                                                  | same                                        |
| Pointer sweep on `/`                                          | gap p95 ≤ 17 ms, max ≤ 34 ms; bench resettles ≤ 3 s                                                                                                                                                                                                                                                                                                                                                                                                                                                             | same                                        |
| `/blog`, `/orbital`                                           | gap p95 ≤ 10 ms, ≤ 1 gap > 33 ms                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | same                                        |
| JS heap delta from mount                                      | ≤ 12 MB (shadow strip 512 KB included)                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | same                                        |
| `data-festival-settled` / `data-bench-settled` with the layer | ≤ 4.5 s / ≤ 8 s                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | same                                        |
| Payload                                                       | font ≤ 12 KB (measured 5.6 KB CJK subset, plus the 8.8 KB Cormorant italic-500 file only the festival requests), moon ≤ 60 KB (40.7 KB), festival chunk ≤ 45 KB gz excluding `three` (measured 38 KB: 33.0 scene + 4.8 layer entry, plus 2.8 KB of festival CSS); on NavBar routes `three` (179 KB gz on three 0.182) is the overlay's first import, `ssr:false`, after paint: the gauntlet records the chunk sizes and asserts LCP element unchanged and LCP within +50 ms of the flag-off baseline on `/blog` | build output + gauntlet                     |
| Shadows / post-processing / scene lights                      | none                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | code review + `shadowMap.enabled === false` |

Never call the bench's `invalidate`; never render on pointer events; only the bench does that.

### 7.6 No-WebGL and failure paths

- `useWebGLSupport()` false → the component returns `null`: no canvas, no overlay, no font request, no `data-festival` attribute. The poem alone would be a quote on a wall; the concept is the lockup, so all or nothing.
- `new WebGLRenderer` in try/catch → `null`. `webglcontextlost` → unmount, no restore.
- Font subset fails → Han spans fall to the system Song face through B7; overlay text boxes are fixed-px, so a fallback face cannot reflow anything.
- Fonts not ready for the 走马灯 → the strip is drawn when `document.fonts.ready` resolves; until then `aShadow = 0`.
- Reduced motion, hidden tab, overlays: §4.6–4.7.
- Mobile Safari 100vh: the root uses `inset: 0` on a fixed element, never `100vh`.

### 7.7 QA: what great looks like (the gauntlet scores these)

`scripts/gauntlet-festival.mjs`, modelled on `scripts/capture-bench.mjs`; GPU path for timing, swiftshader (`--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`) with `?festival-seed=7` for pixel-stable captures; 1440×900 @2 and 390×844; dark + light; all four colour themes on `/blog`; states: mount 0.5 s, 1.5 s, 2.6 s, settled (`data-festival-settled`), first gust mid-front (5.0 s), route mid-exit (140 ms after `router.push`), theme mid-catch (350 ms after toggle), slip hover, poem focus, moon hover. PNGs go to the scratchpad and every one is looked at, not just diffed.

**Visual**

- V1. The hero lantern reads as paper: ribs as dark meridians only where lit; brighter band at candle height; scalloped dark rim; no plastic highlight (no pixel inside the drum brighter than `paperCore`); fibre visible at 2×; ≥ 6 luminance minima along the equator row of the 2× drum crop (the ribs: the camera sees 8 of the 16 meridians), each ≥ 20% below its neighbours.
- V2. The pool is visible on the page beside the H1 and never touches the copy column (pool alpha < 0.02 at the column edge, sampled).
- V3. Luminance order: max luminance in the moon rect > max in any lantern rect (paper or halo) in every dark capture.
- V4. Light theme: unlit cream paper `#e9dcc4` ± 6, no glow, moon ≤ 8% alpha; the page reads as afternoon.
- V5. `/`: no additive halo; the grey wall shows a warm pool; florets ≤ 0.6 alpha; nothing below y330; nothing festival inside x40–456 y88–370 or above y64 at x1303–1400.
- V6. 走马灯 legibility: on 88 and 72 px heroes, a 2× crop of the drum shows ≥ 3 letter-width columns with ≥ 12% luminance drop against adjacent lit paper, and a human reads at least one title per pass. Fail on `/` → `revolvingOnHome: false`.
- V7. Under `ember`, `ice`, `mono`, `terminal` the lamp stays warm (paper-core pixel within ±4 of `#ffd58a` in all four); the pool tint is accent-mixed under default, ember and mono (which keeps the amber `--accent`) and pure `paperMid` under ice and terminal; the `ice` capture is eyeballed for a cool room / warm lamp reading.
- V8. Rect-intersection assertions per route and viewport: lantern bodies, slips, poem, colophon and translation intersect none of `header.sticky`, Bench `.header`, dock links, any `h1`, Bench `.details`, the Calendly iframe, `.orb-hero-tools`, `.home-theme-dock`, the mobile fixed footer. Cords intersect no moon disc.
- V9. Grain (z 999) is visibly over the lanterns (same film).
- V10. Mobile: on every route, a pixel diff of each text block's rect (`main h1, h2, p, li, a`) between flag-on and flag-off captures is 0 (the layer never paints under copy on a phone); on `/past-experience` and `/schedule-a-call` the flag-on and flag-off mobile captures are identical.
- V11. Swap test by a human: replace the riddle deck and the shadow strip with lorem and the layer should look wrong.

**Motion**

- M1. Lanterns lower in with stagger ≤ 240 ms; the hero reaches rest length by 1.2 s; candle catch visible; `data-festival-settled` ≤ 4.5 s.
- M2. Translation appears between 2.4 and 3.6 s (event-driven; expected 2.5–3.0), after the last poem glyph (2.24 s) and before the first gust (4.4 s).
- M3. First gust front reaches each lantern at `4.4 + (x + 0.1·vw) / (0.55·vw/s)` s ± 120 ms (on `/blog` A 4.70 s; on `/orbital` A at x300 4.96 s; on `/` the hero at x1300 6.22 s); θ onsets (the first frame after 4.4 s where θ moves > 0.15° from its pre-gust value) occur in x order with spacing = Δx / (0.55 vw/s) ± 150 ms (on `/blog`: A→B ≈ 150 ms, B→C ≈ 1.49 s); peaks are 5–8° each but carry no spacing (a lighter lantern with a shorter period answers ≈ 200 ms faster).
- M4. Three lanterns have three periods (FFT of θ over 20 s: peaks at 2.8 / 2.4 / 2.1 s ± 8%); no two within 8%.
- M5. A scripted pointer sweep at 1200 px/s deflects the nearest lantern ≥ 8° and the farthest ≤ 3°; the poem column leans ≤ 0.6°; no attraction. Tassel whip: the absolute tassel angle (`theta + tasselTheta`) peaks 50–150 ms after the hero's body peak at the first gust and reaches ≥ 90% of it (the relative angle `tasselTheta` runs opposite to θ at the onset).
- M6. Route change `/blog` → `/past-experience`: `uLit` reaches 0 before the rise passes 8 px (the candle row is 160 ms, the rise starts at +40); text gone ≤ 200 ms; exit ≤ 300 ms; moon glides (position sampled at 3 frames is monotonic); new lockup lit ≤ 1.1 s after the exit; floret count > 0 in every frame; a gust started 1 s before navigation is still measurable 1 s after (`window.__festival.wind(t)`).
- M7. Theme toggle: candle-catch visible and done within 1.1 s (120 + 90·2 + 700 = 1000 ms for the third lantern, plus frame slack); reverse snuffs ≤ 300 ms; no frame with both a halo and albedo paper at full.
- M8. Reduced motion: frame counter +≤ 1 over 2 s idle and during a sweep. Hidden: +0 over 1 s; resume without a θ discontinuity > 0.02 rad.
- M9. Scroll on `/blog/[slug]`: lanterns bob ≤ 8 px, florets lift ≤ 12 px; moon at 60% past scrollY 400.

**Typography**

- T1. After the B PR: every H1 on the six routes computes to Cormorant Garamond; every eyebrow to Plex Mono 10 px / 0.10 em; blog measure ≤ 66ch; one H1 per post; curly quotes in rendered HTML.
- T2. Han spans render in the subset: read `getComputedStyle(span).fontFamily`, take its first family (next/font/local emits a hashed name, so it is never hard-coded) and assert `document.fonts.check('11px ' + family)` is true and that family's `FontFace.status === 'loaded'`; spans have `lang`, `text-orientation: upright`, and contain no Latin; no Latin text node resolves to a family containing `Noto`.
- T3. Poem column: 5 upright glyphs, spacing variance < 5%; colophon 7 glyphs; figure/figcaption present; pinyin only on focus.
- T4. Slip: 谜目 upright vertical; card ≤ 28ch; 谜底 link resolves to the entry's `link`; `lib/festivalRiddles.test.mjs` passes; 44 px hit area.
- T5. 走马灯 strip: exactly the four `featuredProjects` titles in `bench.order`, Cormorant 600 (assert the canvas font string after `fonts.ready`).
- T6. Text-node census under the overlay root: ≤ 1 column + 1 colophon + 1 translation + 1 pinyin + 1 slip lockup; nothing festival-textual on mobile; no festival text inside any page component (assert no `[data-festival]` descendants under `main`).

**Perf:** every row of §7.5, written to `shots/festival-perf.json`; timing on GPU only (skip when `UNMASKED_RENDERER_WEBGL` contains "SwiftShader").

**Accessibility:** slip and moon are real buttons with names, keyboard-reachable in DOM order after main content, Escape closes; canvas `aria-hidden`; `prefers-reduced-motion` honoured live (flip mid-session, assert loop stops); slip ink contrast ≥ 7:1, translation ≥ 4.5:1 on both themes; `elementFromPoint` on 12 sample points (nav links, dock, H1, CTA) never returns a festival node.

**Kill switch:** `?festival=0` and `enabled: false` produce zero festival DOM nodes, no second canvas, no `__festival`, no extra font request, no `data-festival` attribute.

---

## 8. Risks and the decisions that avoid them

| Risk                                                                                                           | Decision                                                                                                                                                |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The festival's "same serif" story is false on four routes because of the broken `font-[var(--font-*)]` classes | B1 ships first as its own PR; the gauntlet asserts computed families before the festival branch merges                                                  |
| Additive glow vanishes on the grey Bench set, so `/` lanterns look like stickers                               | Halo skipped on `/`; the light is a NormalBlending pool on the wall; paper stays emissive                                                               |
| The 走马灯 is illegible and the thesis object fails                                                            | Hero drum ≥ 72 px, strip re-specified (19×28 px letters at 88), legibility gate V6 with a plain-paper fallback on `/`                                   |
| A glowing lantern on cream reads as daytime kitsch                                                             | Light theme = the afternoon before: unlit paper, no halo, no pool, daytime moon; toggle = dusk with the candle-catch                                    |
| Red-and-gold second Lunar New Year                                                                             | Red exists twice (tassel, seal); gold is the site's own accent; night is `--background`, not a grade                                                    |
| Quote wall / inspirational Chinese                                                                             | One line, five glyphs, one translation, one colophon; no 中秋快乐, no 祥云; nothing on mobile                                                           |
| The layer competes with the H1                                                                                 | Pools measured against the copy column; bodies in gutters; tier-1 text only beside the moon                                                             |
| Cords through the moon                                                                                         | Every cord x is ≥ 30 px outside its route's disc (V8 asserts); `/past-experience` drops lantern C rather than cheat                                     |
| Two contexts on `/` drop compositor frames                                                                     | 60 Hz cap; render from the layer's clock; dpr 1 on `/`; gauntlet thresholds from the measured baseline                                                  |
| Route change feels like a reload                                                                               | Module-scope wind clock; florets persist; the moon glides; only lanterns lift and lower                                                                 |
| Module state breaks under StrictMode / HMR                                                                     | `globalThis.__festivalWind` singleton with ownership tokens and an HMR dispose hook (§7.1)                                                              |
| Riddles drift into invented facts                                                                              | Table with a cited field per line; test asserts titles, keywords and hrefs against the data                                                             |
| Green or blue candle under terminal / ice                                                                      | OKLCH hue gate on the computed `--accent` (page-side tints only; mono passes because it keeps the amber accent); the lamp is physical and never changes |
| CJK font payload                                                                                               | Hand subset ≈ 9 KB via `next/font/local`, `preload: false`, unicode-range declared                                                                      |
| Simplified vs Traditional mismatch with Tyler's usage                                                          | Ask before ship; one constant flips it; both forms in the subset                                                                                        |
| Wrong phenology (ginkgo gold in September)                                                                     | Osmanthus leads; ginkgo ≤ 17% and half-green                                                                                                            |
| Premultiplied-alpha halos fringe on cream or grey                                                              | Halo shader outputs `vec4(c·a, a)`; no halo in light or on `/`                                                                                          |
| Halo out-shines the moon                                                                                       | Peak 0.35, drawn under the paper, pixel assertion V3                                                                                                    |
| The layer paints over article text on mobile `/blog/[slug]`                                                    | Scroll-lift at `scrollY > 120`; 0 lanterns on the other mobile routes; no mobile text                                                                   |
| Journey overlay, lightbox, modals, hidden tab keep the loop running                                            | Pause on `data-journey-open`, lightbox, modal and `visibilitychange`; resume without a delta spike                                                      |
| Rocket launch on `/` flies the page while lanterns stay                                                        | `bench:launch` runs the exit choreography at t = 0 of the launch                                                                                        |
| The overlay chunk delays LCP on NavBar routes                                                                  | `ssr:false`, mounted after paint; gauntlet asserts LCP element unchanged and within +50 ms                                                              |
| Typography changes tangled with the temporary layer                                                            | Two PRs: B first, then the festival; the festival touches no page component and no base CSS rule                                                        |
| "One more object" creep                                                                                        | The ship table in §5.4 is the contract: three object classes, one 走马灯 per page, one slip, one poem line, one moon                                    |
| The layer outlives its welcome                                                                                 | `window` dates auto-disable after 2026-10-04; `enabled: false` is one line; removal is one directory plus six touched lines                             |

---

## 9. Open questions for Tyler

Everything else in this document is decided. These three are his to make; each has a default so the build never blocks.

1. **Script: Simplified or Traditional?** `festival.script` defaults to `'Hans'` (谜底 · 千里共婵娟 · 玉盘). Flipping to `'Hant'` (謎底 · 千里共嬋娟 · 玉盤) is one constant; both glyph sets are in the subset. Default: Simplified.
2. **The wordmark (B5) is a permanent brand change**, not a festival one: "TYLER XIAO" in typed caps on the NavBar and the Plex 650 wordmark on the Bench both become "Tyler Xiao" in Cormorant Garamond 500. Ship it in the typography PR, or keep the two wordmarks as they are and ship only B1–B4, B6, B7? Default: ship B5.
3. **Phones get almost nothing** (florets only; one lantern on `/blog*`; no moon, no verse, no slip, and nothing at all on `/`, `/past-experience` and `/schedule-a-call` beyond florets or silence). That is the budget's answer (one WebGL context on `/` already, 24 px gutters elsewhere). Accept, or is one lit lantern on mobile `/` worth a second context there? Default: accept.

---

### References used for decisions in this bible

- Su Shi, 水调歌头 (1076): https://eastasiastudent.net/china/classical/su-shi-water-song/
- Lantern riddle form (谜面 / 谜目 / 谜底): https://baike.baidu.com/en/item/Lantern%20Festival%20Riddles/1526628
- Osmanthus phenology and the 桂子 rain: https://www.ehangzhou.gov.cn/2025-09/30/c_295217.htm
- Traditional colour names (月白, 藤黄, 银朱, 黛蓝, 墨色): https://www.ttpeise.com/color/china.html · https://chinesecoloratlas.com/festivals/mid-autumn-festival
- NASA CGI Moon Kit (SVS 4720), public domain: https://svs.gsfc.nasa.gov/4720
- Vertical CJK on the web: https://www.w3.org/International/articles/vertical-text/
- Pairing a Song serif with a Latin serif: https://blog.justfont.com/2025/03/how-to-pair-chinese-and-latin-fonts-en/
- Damped springs and pendulum periods: https://www.ryanjuckett.com/damped-springs/ · https://en.wikipedia.org/wiki/Pendulum
- Motion durations and easing: https://m3.material.io/styles/motion/easing-and-duration
- next/font/local `declarations`: https://nextjs.org/docs/app/api-reference/components/font
- Tailwind v4 font-family utilities: https://tailwindcss.com/docs/font-family
- Sexagenary cycle (2026 = 丙午): https://en.wikipedia.org/wiki/Sexagenary_cycle
- The reference brief on process (research, style sheet first, rigorous timing, verification loops): https://x.com/donaldjewkes/status/2102801469976248500

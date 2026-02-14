# Personal Website Design

## Aesthetic Direction — "Midnight Forge"

A precision-engineered dark interface that pairs warm metallic accents against cool, deep backgrounds. The terminal/IDE metaphor remains but is executed with restraint — evoking the feel of a premium code editor theme rather than a novelty terminal replica. Every element shares the same warm-cool tension: burnished gold commands attention while soft teal marks secondary signals, all grounded on ink-dark surfaces with a subtle blue undertone.

## Goals

- Present Tyler Xiao as a systems-minded builder through a refined, code-first aesthetic rooted in terminal and IDE metaphors.
- Keep copy and structure concise so recruiters can scan the site in under a minute.
- Provide clear entry points for contacting Tyler, reviewing projects, and exploring deeper write-ups.

## Brand Foundations

- **Voice:** Confident, precise engineer — short declarative sentences with inline `code` snippets for emphasis. No exclamation marks; let the work speak.
- **Imagery:** IDE-inspired panels, command palettes, and syntax-highlighted blocks. Restrained — no neon glows or gratuitous particle effects. Window chrome (title bars, dot indicators) used sparingly as structural cues, not decoration.
- **Grid:** 12-column fluid layout with sections housed inside "panes" featuring minimal window chrome (thin top bar, subtle separators). Generous vertical rhythm between sections (`py-24` / `py-32`).

## Typography

| Role | Font Stack | Details |
| --- | --- | --- |
| Display | `"Clash Display", "Satoshi", system-ui, sans-serif` | Hero headings, nav logotype, section titles. Semi-bold to bold (600–700). Tight tracking (`-0.03em`). Source from [Fontshare](https://www.fontshare.com/fonts/clash-display). |
| Body | `"Satoshi", "General Sans", system-ui, sans-serif` | Paragraphs, links, CTA labels. Regular to medium (400–500). Generous line-height (`1.65`). Source from [Fontshare](https://www.fontshare.com/fonts/satoshi). |
| Mono | `"Monaspace Neon", "Fira Code", Menlo, monospace` | Code snippets, terminal commands, eyebrow labels. Normal case for code blocks; uppercased with wide tracking (`0.08em`) for section eyebrows. Source from [GitHub Monaspace](https://monaspace.githubnext.com). |

**Why these fonts:** Clash Display brings a geometric, commanding presence that feels engineered — not the rounded softness of Space Grotesk. Satoshi is a clean geometric sans that reads beautifully at body sizes without the ubiquity of Inter. Monaspace Neon is GitHub's textured monospace with a distinctive character that elevates code surfaces beyond the usual Fira Code / JetBrains Mono defaults.

**Tailwind setup:** Extend `fontFamily` with `sans` → Satoshi stack, `display` → Clash Display stack, `mono` → Monaspace Neon stack. Load via `@font-face` declarations in `globals.css`. Apply `font-sans` globally, `font-display` on headings and navigation logotype, `font-mono` on code surfaces and label accents.

## Color Palette

| Token | Value | Usage |
| --- | --- | --- |
| `--bg` | `#07080C` | Body background. Deep space black with cool blue undertone — richer than flat `#000`. |
| `--surface` | `#10131A` | Cards, panels, nav bar. One step above background. |
| `--surface-raised` | `#181C27` | Hover states, active panels, modal overlays. |
| `--accent` | `#E8C468` | Primary accent. Buttons, links, highlighted text, active indicators. Warm burnished gold. |
| `--accent-muted` | `rgba(232, 196, 104, 0.12)` | Badge/chip fills, subtle highlight backgrounds. |
| `--secondary` | `#4ECDC4` | Secondary accent. Code syntax highlights, status dots, inline tags. Soft teal. |
| `--secondary-muted` | `rgba(78, 205, 196, 0.10)` | Secondary badge fills, terminal output accents. |
| `--text` | `#E8ECF1` | Primary text. Soft white — not harsh `#FFF`. |
| `--text-muted` | `#6C7689` | Metadata, timestamps, secondary copy. |
| `--divider` | `rgba(232, 196, 104, 0.06)` | Borders, separators. Warm-tinted for palette cohesion. |

**Gradients:** `--accent → --secondary` (`#E8C468 → #4ECDC4`) used sparingly — hero glow, primary button hover shimmer, and timeline node accents. Apply as radial blurs behind focal elements or as directional gradients on interactive surfaces. Never as flat background fills.

**Why this palette:** The purple-green combination in the previous design pulled from two unrelated hues with no tonal bridge. This palette centers on warm-cool tension — gold and teal are complementary, creating natural harmony. The warm gold reads as premium and intentional against cool dark surfaces, while the teal provides contrast without competing. Every derived color (muted fills, dividers) traces back to these two anchors, creating visual unity across the entire interface.

## Layout & Key Sections

1. **Hero**
   - Full viewport height minus nav.
   - Left column: stacked statements styled like commented code (`// hi, i'm tyler`) in mono, leading into a bold display heading set in Clash Display. Subheading in Satoshi, `--text-muted`.
   - Right column: terminal pane showing a cycling JSON/resume snippet or agent log. Syntax highlighting uses `--accent` for keys/strings and `--secondary` for values/booleans.
   - CTA buttons: `Contact` (primary — `--accent` fill, `--bg` text, firm shadow) and `View Past Experience` (secondary — transparent, dashed `--divider` border, `--text-muted` label). Both use mono font for labels.

2. **About Snapshot**
   - Two-column layout; text on left in Satoshi, on the right a "status monitor" card with quick facts as key-value pairs (mono font, `--divider` grid lines, `--secondary` for values).

3. **Experience Timeline**
   - Vertical timeline styled as git commit history: nodes with abbreviated hashes in `--text-muted`, role/company as commit message in `--text`, duration as metadata. Timeline connector uses a thin `--accent` line with a soft glow (`box-shadow: 0 0 8px rgba(232, 196, 104, 0.15)`).

4. **Selected Projects**
   - 2-up grid of code-editor cards: tab header (project name in mono, `--accent`), body with description in Satoshi, and tech tags as chips (`--accent-muted` background, `--accent` text, mono font).

5. **Writing / Speaking**
   - Changelog-style entries: date in `--text-muted` mono, `feat:` keyword in `--secondary`, title in `--text`. Clean left-aligned list.

6. **Contact / Footer**
   - Terminal-style footer with pseudo-commands (`$ connect --via=email`). Command text in mono, interactive spans in `--accent` with underline on hover.

7. **Past Experience Page**
   - Separate route; expanded timeline for every project and role.
   - Filters styled as command palette tags: inactive uses `--surface-raised` fill, active uses `--accent-muted` fill with `--accent` text and border.

8. **Schedule a Call Page**
   - Hero-sized card embedding or linking to Calendly.
   - Supporting bullets styled as terminal output lines with `--secondary` status indicators (`[ok]`).

## Components & Elements

- **Navigation:** Fixed top bar on `--surface` with 1px `--divider` bottom border. Logotype on left in Clash Display (`--text`). Nav links on right in Satoshi medium weight. Active link: `--accent` text with a subtle underline glow (`box-shadow: 0 2px 8px rgba(232, 196, 104, 0.25)`). No keyboard shortcut badges in nav — keep it clean.
- **Badge chips:** Pill-shaped, mono font, small size (12–13px). `--accent-muted` background, `--accent` text, 1px `rgba(232, 196, 104, 0.15)` border. For secondary tags: same pattern using `--secondary-muted` and `--secondary`.
- **Cards:** `rounded-lg`, 1px `--divider` border, layered shadow (`shadow-[0_4px_24px_rgba(0,0,0,0.35),_0_1px_2px_rgba(0,0,0,0.25)]`). Minimal top bar with three small dots in `--text-muted` opacity. Background: `--surface`.
- **Buttons:**
  - Primary: `--accent` fill, `--bg` text (dark on gold), shadow `0 2px 12px rgba(232, 196, 104, 0.2)`. Hover: gradient shifts toward `--secondary`, shadow deepens. No pulsing animations — polish over gimmick.
  - Secondary: transparent, 1px dashed `--divider` border, `--text-muted` text. Hover: border color transitions to `--accent`, text to `--text`.
- **Section headers:** Mono eyebrow label in `--text-muted`, uppercased, tracked (`0.08em`). Main heading in Clash Display, `--text`. Separated by a faint `--divider` rule below the heading.

## Theme Toggle (Light / Dark)

A small circular button fixed to the right edge of the viewport at vertical center. Dark mode is the default.

- **Behavior:** Toggles `data-theme` attribute on `<html>` between `'dark'` and `'light'`. Persists choice in `localStorage`. An inline `<script>` in `<head>` applies the stored theme before first paint to prevent flash.
- **Light palette:** Warm parchment background (`#F6F4EF`), white surfaces, deeper gold accent (`#A07D1C`) and teal (`#168F86`) for text contrast. All tokens adapt via CSS custom properties — no class name changes needed in components.
- **Icon:** Sun icon in dark mode (switch to light), moon icon in light mode (switch to dark). Hover highlights with `--accent`.
- **Terminal:** Always renders with its own dark palette regardless of theme — terminals should stay dark.

## Interaction & Motion

- **Page load:** Staggered fade + translate-up reveals (`motion-safe`). Hero elements enter first (heading → subheading → CTAs → terminal, 80ms stagger). Sections below reveal on scroll.
- **Hover states:** Cards lift with `scale(1.01)` and shadow deepening (no tilt — keep it grounded). Buttons transition color and shadow over 200ms ease.
- **Cursor glow:** A faint `--accent` radial gradient follows the cursor on the hero section only. Implemented via CSS `radial-gradient` repositioned on `mousemove`. Subtle — 200px radius at 4% opacity.
- **Terminal typing:** Hero terminal text types in at 45ms per character with natural pauses at punctuation. Keep total duration under 3s.
- **Accessibility:** Large text contrast >= 3:1, body text >= 4.5:1 against `--bg`. All animations respect `prefers-reduced-motion`. Focus rings use `--accent` with 2px offset.

## TODO After Approval

- Load fonts: `@font-face` for Clash Display and Satoshi (Fontshare CDN), Monaspace Neon (GitHub CDN or self-hosted).
- Update `globals.css` theme block with new color tokens, font stacks, and shadow values.
- Refactor components to use `--accent` / `--secondary` tokens instead of hard-coded purple/green values.
- Replace template `app/page.tsx` sections and routes for Past Experience and Schedule a Call.
- Add metadata (OpenGraph image, description) to `app/layout.tsx`.

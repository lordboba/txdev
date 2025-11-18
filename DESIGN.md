# Personal Website Design

## Goals
- Present Tyler Xiao as a systems-minded builder through a polished, code-first aesthetic reminiscent of terminals and IDEs.
- Keep copy and structure concise so recruiters can scan the site (or skim code-like snippets) in under a minute.
- Provide obvious entry points for contacting Tyler, reviewing projects, and exploring deeper write-ups.

## Brand Foundations
- **Voice:** Confident, curious engineer—mix short declarative sentences with inline code snippets/backticks for emphasis.
- **Imagery:** IDE-inspired panels, command palettes, code block highlights, and neon cursor flourishes instead of photos.
- **Grid:** 12-column fluid layout, but group sections inside “panes” with faux window chrome (title, dots, thin separators) to mimic a coding environment.

## Typography
| Style | Font Stack | Usage |
| --- | --- | --- |
| Display | `"Google Sans Code", "Space Grotesk", system-ui, sans-serif` | Hero headings, nav logotype, pane titles. Use tight tracking and semi-bold weights (600). |
| Body | `"Google Sans Code", "Inter", "Helvetica Neue", system-ui, sans-serif` | Paragraphs, anchor links, CTA labels for a cohesive coding vibe. Keep at 400–500 weights. |
| Mono Accent | `"Google Sans Code", "IBM Plex Mono", Menlo, monospace` | All code snippets, faux terminal commands, eyebrow labels. Use uppercased text with extra tracking. |

**Tailwind setup:** extend `fontFamily` with `sans`/`display`/`mono` pointing to Google Sans Code stacks. Import via CSS `@import` until hosted locally. Apply `font-sans` globally and `font-mono` for code cards, nav command palette, and CTA chips.

## Color Palette
| Purpose | Color | Usage |
| --- | --- | --- |
| Background | `#05060A` (near-black) | Body background for high contrast. |
| Surface | `#0F1119` | Cards, panels, nav background. |
| Primary Accent | `#7C5CFC` | Buttons, key links, highlight text. |
| Secondary Accent | `#56D364` | Badges, status dots, gradient mixes with primary. |
| Muted Text | `#8B93A7` | Secondary copy and meta labels. |
| Divider | `rgba(255,255,255,0.08)` | Borders, separators. |

Gradients: mix `#7C5CFC → #56D364` for hero blur or button hover states (use Tailwind `bg-gradient-to-r from-primary to-secondary`).

## Layout & Key Sections
1. **Hero**
   - Full viewport height minus nav.
   - Left column: stacked statements styled like commented code (`// hi, i’m tyler`) leading into punchy headline.
   - Right column: “terminal pane” showing highlighted JSON/resume snippet or AI agent log that cycles through achievements.
   - CTA buttons: `Contact`, `View Past Experience`, styled as command buttons with icons (▶ run command).
2. **About Snapshot**
   - Two-column layout; text on left, on the right a “status monitor” card with quick facts rendered as key/value pairs (monospace, subtle grid).
3. **Experience Timeline**
   - Vertical timeline resembles git commit history: nodes with commit hashes, role/company as commit message, duration as metadata.
4. **Selected Projects**
   - Grid of code-editor cards (2-up) featuring tab headers (project name), body with description + syntax-highlighted tech tags (chips look like language tokens).
5. **Writing / Speaking**
   - Render as “changelog” entries: `[2024-12-04] feat: Balancing Craft and Velocity...`.
6. **Contact / Footer**
   - “Terminal” footer letting visitors run pseudo commands (`$ connect --via=email`) with clickable spans that open links.
7. **Past Experience Page**
   - Separate route linked from CTAs and nav; long-form timeline that expands on every project/role.
   - Filters appear as toggles styled like VS Code command palette tags (AI Agents, Backend, Automation).
8. **Schedule a Call Page**
   - Hero-sized card that embeds or links directly to Tyler’s Calendly (manual URL placeholder in content copy).
   - Include quick bullets styled as terminal output plus log-style social proof (`[ok] Trusted by …`).

## Components & Elements
- **Navigation**: Fixed top nav styled like a command palette window—Tyler’s name on left, quick command shortcuts right (⌘1 About, ⌘2 Experience). Active link uses glowing underline resembling a caret.
- **Badge chips**: Pill-shaped tokens with gradient borders mimicking syntax tokens; use `rgba(124,92,252,0.15)` background and neon text `#C7B7FF`.
- **Cards**: Rounded corners (`lg`), 1px divider, subtle shadow (`shadow-[0_20px_60px_rgba(0,0,0,0.45)]`), and top bars with three dots to evoke editor panes.
- **Buttons**:
  - Primary: gradient background, white text, drop shadow that pulses like a cursor (use `animate-pulse` on glow).
  - Secondary: transparent with dashed border referencing CLI prompts.
- **Section headers**: Eyebrow label uses ALL CAPS `font-mono`, main heading sits atop faint horizontal rule like a code comment (`// section`).

## Interaction Notes
- Scroll-triggered fade + translate reveals (`motion-safe`) for hero, section headers, cards.
- Use framer-motion or Tailwind transitions for hover states (scale + slight tilt) with cursor glow to mimic hovering over code panes.
- Ensure accessible contrast: large text ratio >= 3:1, body text >= 4.5:1 against background.
- Consider typing animations for hero terminal text (simulate commands being typed, but keep durations short for accessibility).

## TODO After Approval
- Implement Tailwind config updates (fonts, colors, boxShadow).
- Replace template `app/page.tsx` with sections described above plus new routes for Past Experience and Schedule a Call.
- Add metadata (OpenGraph image, description) to `app/layout.tsx`.

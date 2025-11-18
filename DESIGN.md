# Personal Website Design

## Goals
- Present Tyler Xiao as a thoughtful engineer/designer hybrid with a clean, modern aesthetic.
- Keep copy and structure concise so recruiters can scan the site in under a minute.
- Provide obvious entry points for contacting Tyler and exploring deeper work samples.

## Brand Foundations
- **Voice:** Confident, approachable, obsessed with craft. Use short paragraphs and occasional punchy statements.
- **Imagery:** Primarily typography and subtle iconography; use abstract geometric accents instead of photos.
- **Grid:** 12-column fluid layout with generous spacing (min 24px gutters, 64px max-width padding) for readability.

## Typography
| Style | Font Stack | Usage |
| --- | --- | --- |
| Display | `"Inter Tight", "Inter", "Helvetica Neue", system-ui, sans-serif` | Hero name, section headers, CTA headlines. Set tracking-tight and bold weights (600–700). |
| Body | `"Inter", "Helvetica Neue", system-ui, sans-serif` | Paragraphs, list items, nav links at regular/medium weights (400–500). |
| Mono Accent | `"IBM Plex Mono", "SFMono-Regular", Menlo, monospace` | Code snippets, taglines like “building delightful dev tools”. |

**Tailwind setup:** extend `fontFamily` for `display`, `sans`, and `mono` entries, and use utilities such as `font-display`, `font-sans`, and `font-mono` in components.

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
   - Left column text stack, right column animated orbital graphic using accent gradient.
   - CTA buttons: `Contact`, `View Past Experience`.
2. **About Snapshot**
   - Two-column layout; text on left, quick facts (location, focus areas, currently building) on right card.
3. **Experience Timeline**
   - Vertical timeline with chips for role, company, duration; include a subtle accent line.
4. **Selected Projects**
   - Grid of cards (2-up on desktop, stacked on mobile) with project title, role, short description, tech tags, link icon.
5. **Writing / Speaking**
   - List latest 3 posts with title, 1-line summary, published date.
6. **Contact / Footer**
   - Inline contact form CTA linking to email, plus links to GitHub, LinkedIn, Resume, and small copyright.
7. **Past Experience Page**
   - Separate route linked from CTAs and nav; long-form timeline that expands on every project/role.
   - Include filters by focus area (Product, Dev Tools, AI, etc.) and repeat cards from “Selected Projects” with deeper content.
8. **Schedule a Call Page**
   - Hero-sized card that embeds or links directly to Tyler’s Calendly (manual URL placeholder in content copy).
   - Include quick bullets on what to expect from the call and social proof (logos/testimonials).

## Components & Elements
- **Navigation**: Fixed top nav with name mark left, anchor links right (Home, Past Experience, Schedule a Call); highlight active section with accent underline.
- **Badge chips**: Pill-shaped with background `rgba(124,92,252,0.15)` and text `#C7B7FF`.
- **Cards**: Rounded corners (`lg`), 1px divider, subtle shadow (`shadow-[0_20px_60px_rgba(0,0,0,0.45)]`).
- **Buttons**:
  - Primary: gradient background, white text, soft glow hover.
  - Secondary: transparent with border using divider color and text accent.
- **Section headers**: Use uppercase label `eyebrow` in mono font, then large display font line with gradient underline.

## Interaction Notes
- Scroll-triggered fade + translate reveals (`motion-safe`) for hero, section headers, cards.
- Use framer-motion or Tailwind transitions for hover states (scale to 1.01, drop shadow increase).
- Ensure accessible contrast: large text ratio >= 3:1, body text >= 4.5:1 against background.

## TODO After Approval
- Implement Tailwind config updates (fonts, colors, boxShadow).
- Replace template `app/page.tsx` with sections described above plus new routes for Past Experience and Schedule a Call.
- Add metadata (OpenGraph image, description) to `app/layout.tsx`.

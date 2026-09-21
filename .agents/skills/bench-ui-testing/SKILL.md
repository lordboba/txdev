---
name: bench-ui-testing
description: Run and visually verify the public Bench homepage and its WebGL-backed record views.
---

# Local setup

- From `personal-website`, use Node 24 (`source ~/.nvm/nvm.sh && nvm use 24` in nvm environments), `npm install`, then `npm run dev`.
- Open `http://localhost:3000/`; the homepage is public and needs no authentication.
- Software WebGL can take tens of seconds to mount and camera transitions can be slow. Wait for actual scene pixels before asserting visual state.

# UI checks

- Work is the initial view. Company rail tags and the named buttons in the lower Signed row both open tag records.
- Record HUD text is DOM content above the scene. Escape closes a record; the navigation buttons select Profile, Work, Signals, or History.
- Capture both the rail overview and the opened record. Use browser Find for absence assertions on obsolete copy.

# Browser instrumentation

- Inspecting during initial hydration can inject `devinid`, `devin-tagname`, or `devin-hidden` attributes and produce a hydration warning.
- If a warning specifically names these attributes, preserve and report it, then reload and wait for hydration before inspecting. Check the fresh-load console again rather than treating the initial warning as an app regression or silently ignoring it.

# Devin Secrets Needed

None for local public-homepage testing.

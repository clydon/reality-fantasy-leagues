# Plan: commissioner tour (rebuilt 2026-10-17)

Replaces the commissioner path in PLAN-guided-tour.md. Built, uncommitted. Check: `node scripts/dev-test/check-commissioner-tour.js [outDir] [--width=390]` (logged out, plays every step, screenshots each).

## Assumptions

- No data arrives by itself. Every import is copy a prompt, paste the answer. The tour never makes anyone search: **Paste** fills a ready-made answer (`src/lib/tour/samples.ts`).
- Real show, Survivor 51 (21 castaways, Toka and Savu, photos in `public/photos/s51/`), so the subject is familiar. The tour *pretends Survivor isn't listed* and imports it (research prompt, paste, approve rules). "Skip: use a listed show" jumps past that; Survivor then appears in the list anyway.
- Active Roster, you plus Ben and Kat (computer players). Roster of 2 starters + 1 bench so the practice draft is 3 picks. Episode 1 results are made up and say so.

## Path (about 50 taps; Skip tour is always there)

1. **Add show (6):** My show isn't here, Build prompt, Copy, Paste, Create draft, approve the rules found.
2. **Create (9):** show, season, type (the three types in the detail), name, draft, waivers, Create, copy the code, open League Settings.
3. **Settings (16):** cast import (open, copy, paste, review, import), Scoring & rules (tap an event, change points, the ⋯ menu: reset / customise when events score), Waivers (replacement rules, windows and swaps), League setup (snake vs blind draft, under More options).
4. **Draft (3):** start it, pick 3.
5. **Episode 1 (7):** copy the question, paste, read, a card on research proposing a rule change (it waits under Scoring & rules), check each result (one low-confidence row), apply. End card.

6. **Waivers (5):** Mike is voted out; Lineup, then Waivers; the commissioner opens a waiver window (replace who's out, swaps each), claims are private, Process now.
7. **Episode 2 (5):** it airs; the same copy, paste, read, apply with a second made-up set of results ("same job every week"). Applying counts as the commissioner revealing it; players reveal on their own.

## What changed in the product (all real, not tour-only)

- `PasteBar` (`components/paste-bar.tsx`): **Paste** reads the clipboard in one tap, **Clear** empties the box. Used by the cast import, the episode results page and the show-research panel.
- Cast import review: one line per person (photo, name, tribe, ✕), photo URL only when missing, **Import N pinned above the tab bar**.
- Copy buttons and step targets carry `data-tour`; steps end on `tourMark` events (`did` in `tour-store.ts`), not clicks.

## Host plate and spotlight fixes

- Lit targets that touch or overlap share one ring; a lit region stops at a page's own bottom bar.
- The plate moves to the top when something lit is under it (once per step, no flicker); sheets still put it on top.
- The page scrolls lit targets (tapped or look-only) into the clear band between header and plate/tab bar.
- `cta` can jump (`ctaTo`) and record (`ctaMark`).

## Open

- `docs/ux-baseline/scripts/tour.js` still expects an old `more-waivers` target in the player path (stale before this work).
- After the cast import the league takes the Balanced waiver suggestion (the tour seeds it, since a real create does that from the season's cast size). Process now in mock mode now really processes (it was a no-op).
- Customise-when-events-score isn't playable in the tour (needs a live league); it's explained at the ⋯ menu.
- Desktop (sidebar has no `data-tour` targets) wasn't checked; at 390 and 360 the full run passes.
- What's New: not added (needs the user's approval).

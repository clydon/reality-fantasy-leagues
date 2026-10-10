# Plan: guided tour (player and commissioner)

Shaped 2026-10-10 with `/impeccable shape` + `distill`. Answers the feedback that the app feels
overwhelming at first. Supersedes the BACKLOG entry "A guided onboarding tour / coachmarks:
backburnered" (its staleness concern is answered under **Staying fresh** below).

## Goal

Prove in about 3 minutes that one episode night is easy. Doubles as a diagnostic: **if a step can't
be explained in one host line (about 12 words), the screen is the problem, not the tour.** Log it on
a "simplify this screen" list instead of writing a longer line.

## Rules

- One tap per step, one host line per step, no Next buttons. Steps advance on the real action.
- Skip is always visible. Once finished or skipped, never auto-shown again.
- Runs on the existing mock mode (`useMutate` mock branch, real `state-logic.js`, nothing saved).
  Not a separate tutorial build.
- Mobile first: designed and verified at 390px.

## The show: *Rise & Fall* (placeholder name)

A made-up baking competition, scripted so each episode teaches exactly one thing. No spoilers, no real
people, no image rights.

- **Cast:** 10 bakers named A to J: Ana, Ben, Cleo, Dev, Emma, Finn, Gus, Hana, Ivy, Jo.
- **Players:** the user plus 2 computer players (one is Ben-the-gloater in chat; name the computer
  players so they don't clash with bakers — rename the baker or the bot when building).
- **League type:** Active Roster (chosen because it's the most complicated: if it feels easy, the
  point is made). Roster 3: 2 starters, 1 bench. 3 teams × 3 = 9 drafted, so one baker (Ivy) stays
  free for the pickup.
- **Scoring, two events only:**

  | Event | Points |
  |---|---|
  | Won the week | +3 |
  | Bottom two | −1 |

  Going home scores nothing; it removes the baker and opens a roster spot.

- **Script:**
  - Episode 1: the user's **bench** baker wins the week (+3, not counted). One of the user's starters
    is in the bottom two and goes home.
  - Episode 2: Ivy (just picked up) or another starter wins; the user climbs the standings.
  - Exact assignments depend on what the user drafts: the script picks winners/bottom two from the
    user's actual roster at reveal time, so the lessons land whatever they choose.

## Player path (~3 minutes, every main button)

| # | Where | Host line | Tap |
|---|---|---|---|
| 1 | Overview: League Scoring card | "Winner +3. Bottom two −1. That's it. Tap Draft." | Draft tab |
| 2 | Draft tab | "Pick 3 bakers." | ×3 (computer players pick instantly) |
| 3 | Lineup tab | "Only starters score. Bench one." | Bench |
| 4 | Episodes tab | "Episode 1 aired. Reveal it." | Reveal |
| — | Episode detail | (no step: bench baker shows "+3, not counted, on bench"; a starter went home) | — |
| 5 | Scoreboard tab | "See where you stand." | Scoreboard |
| 6 | Chat (header icon, unread dot) | "Ben's gloating. Have a look." | Chat |
| 7 | More → Mid-Season | "You have an open spot. Open More." → "Pick up Ivy." | ×3 |
| 8 | Episodes | "Episode 2. Reveal it." | Reveal |
| End | Scoreboard | "That's the whole season." **Start a league** · *Commissioner tour* · *Anything unclear?* | — |

Coverage: Overview (incl. points per event), Draft, Lineup, Episodes, Scoreboard, Chat, More,
Mid-Season. League Settings and Research belong to the commissioner tour. Account, What's new and
Report an issue are standard and not toured.

## Commissioner path (~4 taps)

Create a league (prefilled, one tap) → copy the invite link (nothing is sent) → start the draft
(computer players fill the seats) → **results are in: check and approve** → end card. Approving
results is the commissioner's weekly job, so the tour builds to it. Same rules and host plate.

## The host plate (the only new UI)

```
 ┌ HOST ┐ EPISODE 1 OF 2            Skip
 │ Only starters score. Bench one baker. │
 └────────────────────────────────────────┘
```

- Lower third docked above the bottom nav: chyron-yellow HOST caption tag + white caption plate
  (existing `caption-tag-chyron` / `caption-plate` tokens, DESIGN.md direction A).
- Progress reads as episodes ("EPISODE 1 OF 2"), not step counts.
- Spotlight: target lit, everything else scrimmed and not tappable.
- The Demo bar is hidden during the tour (its show/type pickers and scrubber would break the script).
- The tour holds back other urgency badges (Lineup "!", More dot) until their step.
- Host text is an `aria-live` region; focus moves to the plate on each step; reduced motion jumps
  the spotlight instead of gliding it.

## Entry points

- Login screen "Take a Tour" → player tour (replaces today's unguided demo picker; the picker stays
  reachable from More → Demo season).
- Empty dashboard after signup (no leagues) → offer the player tour.
- More → "Replay tour" row (both tours).
- Player end card → commissioner tour.

## Measuring

- Silent step log: tour id, step id, reached / skipped / finished, timestamp. Small Postgres table
  plus a public insert route (logged-out visitors take the tour too); an admin funnel view later.
- End card "Anything unclear?" opens the existing Report an issue flow, tagged with the tour.

## Staying fresh

- Steps advance on state events (drafted, lineup saved, episode revealed, pickup made), not on DOM
  clicks.
- Targets use stable `data-tour="..."` attributes on long-lived components, never CSS paths.
- A headless Playwright script plays both tours end to end at 390px; a redesign that breaks a step
  fails it.

## Build notes

- Demo seasons today ship with rosters pre-computed (`demo-season-builder.ts` `computeRoster`). The
  tour season must start undrafted, with a scripted snake draft where computer players pick instantly.
- *Rise & Fall* needs a show format with the two events above and baker/terms naming (show terms,
  not Survivor's). Likely a dedicated demo season row plus a minimal format.
- The reveal script resolves winners/bottom two against the user's actual roster (see Script).

## Cut from v1, on purpose

| Cut | Why | Where it went |
|---|---|---|
| Title card / cold open | Slows the start | "2 episodes · Skip" lives in the first host line |
| Episode 3, finale | Episode 1 carries the bench lesson and the elimination | Two episodes |
| "Notice this" steps with Next | Reading isn't doing | All steps are actions |
| Classic and Eliminator Pool chapters | Not part of a first visit | BACKLOG #2 "How this league works" cards |
| Commissioner: computer players, pickups toggle, research copy/paste | Setup, not the weekly loop | v2; research gets its own short tour (likeliest confusion spot) |
| Per-card "confused me" link | Clutter on every step | Silent step log + one end-card question |

## Open

- Final show name and baker names (placeholders approved for now).

## Built: phase 1, the player path (2026-10-10)

Commissioner path, step log table and admin funnel are left for a later phase.

- **The season:** `src/lib/tour/rise-and-fall.ts`. Client-side only (no demo-season row, no
  migration): a data-only format (`rise-and-fall`, two events, carried as `settings.showFormatData`)
  plus `buildTourState()`, which starts undrafted with the draft open and you first. Computer players
  are **Ben** and **Kat** (baker B became **Bruno** so no names clash), and they pick from fixed lists with
  Ivy last.
- **The cast (changed by the user, 2026-10-10):** ten bakers from an illustrated cast sheet the user
  supplied, cropped to headshots (`public/photos/tour/<key>.jpg`, the sheet's number badges and
  labels left out): Ana, Gus, Ivy and Bruno are amateurs, Emma, Finn, Hana and Dev ordinary bakers,
  Jo a professional, Clive world-renowned. **Clive, the best, wins every week whoever has him. Gus,
  the worst, is in the bottom two every week until he goes home.** `scriptEpisode()`: in Episode 1
  the other bottom-two spot is one of your starters, and that starter goes home (Gus, if you started
  him), so the pickup step always has a spot to fill. In Episode 2 Gus goes home if he's still in.
  Ben takes Clive at pick 2 if you don't take him first. The lessons now depend on your draft: the
  host's line after the first reveal says whether Clive scored for you, sat on your bench ("didn't
  count") or won for someone else, and Ben's chat line gloats only if he's on top. You no longer
  always finish first.
- **Tests:** `tests/tour-season.test.js` plays the season under the real engine five ways: first
  baker each time, Clive started, Clive benched, Gus started, and drafting Ivy yourself.
- **The engine:** `src/lib/tour/steps.ts` (the step list; each step has a line, `data-tour` targets,
  an optional `nav` for reaching its page, and `done()` on state or route) and
  `src/lib/tour/tour-store.ts` (the current step, plus `useTourDirector`, which bots-drafts, airs
  episodes, starts the pickup round and posts Ben's gloat on state changes).
- **Store:** `touring` in `store.ts`. The tour league is mock state, but it keeps spoiler protection
  (`spoilersOn`/`useSpoilersOn`), so its reveals are real reveals. You're a member, not a
  commissioner. `useMutate`'s mock branch now mutates `fullState`; elsewhere that's the same object.
- **Host plate and spotlight:** `src/components/tour/tour-host.tsx`, mounted in AuthGate. Its height
  feeds `--tour-h`, which `--tabbar-h` and main's padding include, so confirm bars ride above it. The
  scrim is an SVG mask, so overlapping holes stay open, and holes glide unless motion is reduced. Taps
  outside the lit targets are blocked in the capture phase. With nothing lit there's no scrim and
  nothing is blocked. The plate docks at the top while a sheet (`role="dialog"`) is open.
- **Held back while the host is on:** the Demo bar, the alert strip, the reveal prompt, and tab-bar
  "!" marks other than the current step's.
- **Entry points (startable any time, signed in or not):** Login's "Take a Tour"; on a phone, More →
  "Take the tour" beside Demo season; on desktop, the sidebar's account menu and, with no league,
  a "Take the tour" row under Demo Season. Each says "Replay the tour" while the tour's league is
  loaded, and starting it replaces whatever league was showing (a signed-in user gets their own back
  by leaving the demo, as from the demo season). Not done: the empty-dashboard offer, and lighting on
  desktop (the sidebar has no `data-tour` targets, so there the host talks but nothing is lit).
- **Deviations from the table above:**
  - Step 1's "League Scoring card" doesn't exist on Overview any more, so the line carries the rules.
  - Step 3 says "Only starters score. Start two, bench one." After the draft the lineup is empty,
    and two slots can't hold three, so "bench one" can't be the tap.
  - Step 5's line depends on where Clive was (see the cast above); step 6 says "Ben has something to
    say", since he only gloats when he's on top.
  - The end card offers **Start a league** and **Look around**, plus "Anything unclear?" when signed
    in (reports from the tour are tagged "Guided tour (Rise & Fall)"). There's no commissioner-tour
    link yet.
- **Also fixed:** owner lines say "on your roster" for the viewer's own seat (`ownersLine`'s new
  `me`). They used to show your seat's name as if it were someone else's.
- **Check:** `node docs/ux-baseline/scripts/tour.js <outDir> [--light]` plays it end to end at
  390×844, logged out. It fails on a missing target, a tap the spotlight let through, a confirm bar
  under the plate, overflow, or a console or HTTP error.

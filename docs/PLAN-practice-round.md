# Plan: the practice round (the guided tour, on this league)

**Status:** Decided 2026-10-11 (with `/impeccable shape`). **Built 2026-10-11** (all three scripts), not
yet committed. See "As built" at the end.

## Decision

The practice round **is the guided tour** (TourHost: host plate, spotlight, steps that advance on the
action) running on a throwaway copy of the joined league instead of Rise & Fall. It is not cards; the
"How this league works" explainer (`src/components/explainer/league-explainer.tsx`) stays the 1-minute
rules sequence.

| | How this league works | Practice round |
|---|---|---|
| Job | Watch: the rules | Do: a practice episode |
| Who | Every joiner, every league | Offered to everyone |
| Length | ~1 min | ~2 min, hands-on |

## Offer

- Everyone, every league (no first-timer rule): on the explainer's end card, under the primary ("Go to
  the draft"), a plain link "Try a practice round first · 2 min". Also More -> "Practice round", next to
  "How this league works", for the open league.
- Late joiners get the same offer before the start question; the practice round returns them to
  "Which episodes have you watched?", so that decision stays last.
- A game type with no practice-round script yet offers nothing (Rise & Fall plays Active Roster and
  would teach a Classic joiner the wrong rules).

## What it must keep (the guided-tour nature)

- The spotlight lights exactly what to tap (draft tile, lineup slot, pick button, Reveal, next tab);
  everything else sits under the scrim and ignores taps.
- Steps advance on doing the thing; Next only on "look at this" steps.
- One host line per step plus "What does this mean?", in this league's words (show terms, its scoring
  events).
- **The episode airs during it, like the weekly night:** lineups lock and the plate says "Episode 1 is
  airing. In a real week you'd be watching now."; then "Results are in" and the spotlight goes to
  Reveal; the reveal plays in full (the host waits); points land; spotlight to the standings, then to
  "set your next lineup".
- Computer opponents with made-up names (never league members) draft and set lineups.

## On this league

- The cast as it stood before episode 1 (no spoilers), the same game type and ownership, the same
  scoring and terms. A red MADE-UP RESULTS tag in the host plate's top strip throughout. Random outcomes,
  never the real ones, and never the real next boot first (as in `src/lib/explainer-sample.ts`).
  Nothing is written to the server.
- First plate: "Practice round of {league}. Real cast and rules, made-up results. Nothing here counts."
- End card: "Back to {league}", returning to exactly where they left (draft, start question, Overview).

## Scripts per type, in build order

1. **Active Roster:** reuse the current tour (`src/lib/tour/rise-and-fall.ts`, `steps.ts`,
   `tour-store.ts`), swapping in the league's cast, events and terms. One aired episode.
2. **Classic:** draft 3 -> episode airs -> reveal -> someone goes home, with live points per
   `PLAN-classic-live-scoring.md` -> standings; a side bet if they're enabled. One episode.
3. **Eliminator Pool:** pick who stays -> airs -> reveal -> streak 1 -> next episode, earlier pick
   crossed out (no repeats) -> pick again. **Two episodes** (no-repeats is the rule people get wrong).

Classic and Eliminator Pool need `data-tour` markers added to their draft and pick screens.
"Take the tour" from the front door stays the Rise & Fall tour.

## As built (2026-10-11)

**Files.**
- `src/lib/tour/practice.ts`: the practice league and its other players. `practiceTypeOf` (which
  script, or none), `buildPracticeState` (the cast from `SpoilerLogic.viewThrough(raw, 0)`, ownership
  cleared, starting groups, the league's settings with pickups/swaps/finale picks/late joiners off),
  `directPractice` (computer players draft, set lineups, pick and answer the bet; says when an
  episode should start airing), `airEpisode` (random results through the real engine), `lockInBlind`,
  and the small readers the host lines use.
- `src/lib/tour/practice-steps.ts`: one step list per game type, built once per run with the
  league's name, show terms, roster sizes and the computer players' names.
- `src/lib/tour/use-practice-round.ts`: `usePracticeRound()` -> `{ available, start(returnTo?) }`, used
  by the explainer and both More menus.
- `src/lib/tour/tour-store.ts`: a third tour kind, `"practice"`. `startPractice` sets the kind first
  (loading the league wakes the director), snapshots the real league's store slice and loads the
  copy through `startTour`; `leavePractice` puts the slice back and returns where to go. The airing
  clock (`AIR_MS`, 4s) lives here, beside the director.
- `src/components/tour/tour-host.tsx`: the red MADE-UP RESULTS tag in the strip on every step, Skip
  reads "Leave" (and leaves for the real league), an airing bar on `onAir` steps, and the end card's
  one button "Back to {league}" plus "Anything unclear?". New for every tour: a small lit target the
  plate covers is scrolled up above it once per step (Classic's guess field sits low on Overview).
- Entry points: the explainer's last card (`league-explainer.tsx`), More -> Practice round on phones
  (`mobile-nav.tsx`) and in the desktop account menu (`sidebar.tsx`), next to "How this league works".
- `blind-draft-panel.tsx` gets a mock branch (locking in reveals at once, the computer players locking
  in random teams); `bet-card.tsx` gets `data-tour="bet-guess"`. The draft, lineup and pick screens
  already carried the shared `picker-tiles` / `picker-confirm` / `lineup-*` markers.
- End-to-end check: `node docs/ux-baseline/scripts/practice.js [outDir] [ar|classic|pool|all] [--light]`.
  It seeds its own throwaway account and three leagues and removes them afterwards.

**The scripts as built.**
- Active Roster (one episode): welcome -> draft (blind or snake, per the league) -> lineup -> airs ->
  reveal -> "You're 2nd with 4 points. Tap Scoreboard." (detail: what your bench scored that didn't
  count) -> "Points are in. Now set your next lineup." -> end card on Lineup.
- Classic (one episode): welcome -> draft -> side bet "Who goes home first?" on Overview, when the
  league has bets -> airs -> reveal -> "{name} went home. Tap Scoreboard." (detail: your team's point
  each, and whether your bet paid) -> end card on Scoreboard.
- Eliminator Pool (two episodes): welcome -> pick -> airs -> reveal -> "{pick} stayed: your streak is 1.
  Tap Pick." -> "Pick again, but not {pick}." -> airs -> reveal -> "streak 2", or "went home: streak
  back to 0" with "your best streak still counts" -> end card on Scoreboard.

**Calls made.**
- **No "Getting around" cards and no chat step.** The practice round is this league's rules,
  hands-on, in about two minutes; the app tour stays the Rise & Fall tour. Not seeding chat also
  leaves the real league's chat alone.
- **You play under your own name in the league**, not "You" (which read "You YOU" in the standings).
- **The league's real roster sizes and draft**, not a cut-down one: Active Roster's default is a blind
  draft of 5, which is one Lock in; a snake draft is one tap and confirm per round.
- **Computer players**: two, or one when an exclusive draft's cast can't fit three teams; names from a
  fixed list minus any member's first name. No practice round when the cast can't fit two teams (or,
  for the Pool, has fewer than 4): there's nothing honest to practise on.
- **Who goes home**: never anyone the real season sent home in episodes 1 or 2; where it can be
  helped, not one of your team (Classic, Active Roster); never your Episode 1 Pool pick, so the streak
  lesson lands; Episode 2 is fully random (your pick can go home, which teaches the reset). With a
  Classic bet, the first computer player's guess goes home when it can, so a bet visibly pays out.
- **Active Roster events**: the league's own events minus Endgame and Leaving-the-game ones (no
  fire-making in episode 1). One of your starters gets the biggest, one of your bench the next (the
  bench lesson), each computer player's starter one, someone the biggest loss.
- **Airing**: when your part is done (lineup full, guess in, pick locked) the episode gets an air time,
  so every screen says picks and lineups are closed; lineups lock, and results land 4s later. The
  episode after the script's last is created (your next lineup) but never airs.
- **Leaving**: Leave and the end card both put the real league back exactly as it was loaded, on the
  page the round started from: the draft or Overview (where the explainer's own button would have
  gone), the start question for a late joiner, or the page More was opened on. A reload mid-round should
  load the real league again, since nothing of the round is kept (reasoned, not browser-checked). Nothing is written to the server (the check script fails on any
  non-GET call); the only call is the explainer marking itself seen as it closes.
- Starting a Rise & Fall tour from inside a practice round drops the practice round.

**Verified** at 390x844 in Night and Studio with throwaway data (removed afterwards): all three scripts
end to end, tapping only lit targets, no console errors, no server writes, each landing back where it
started; and `tour.js` (both Rise & Fall tours) still passes.

**Not done.** A What's New entry (the user approves those). The User Manual doc doesn't mention it.

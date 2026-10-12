# Plan: Classic scoring that counts as it happens

**Status:** Decided 2026-10-11 (with `/impeccable shape`). **Built 2026-10-11** (see "As built" below). Build this first: the Classic
practice round (`PLAN-practice-round.md`) teaches this scoring.

## The problem

Classic scores each castaway by finishing place (first out 1, winner N). Today points are only added
when a castaway goes home (`EliminationOrderScoringStrategy` in `src/lib/game/state-logic.js`), so
mid-season a player who lost someone early has points while everyone whose castaways are still in shows
0. Reported case: a drafted castaway went home in episode 4, everyone else's are still in, and the
leaderboard shows the one player with a loss in first place. That's backwards: castaways still in are
guaranteed more.

## Decision: a castaway earns 1 point, plus 1 for every elimination they outlast

- The score climbs each week they survive and stops when they leave. Out 4th = outlasted 3 = 4 points.
  Winner of 18 = 18. Still in after k eliminations = k + 1 so far.
- **Final totals are identical to today's formula.** Same rule, counted live. Verify this on completed
  local leagues (compare old and new totals for every player) before changing anything visible.
- Multiple eliminations in one episode each count (+2 for a double boot).
- Side bets, finale predictions, and Active Roster / Eliminator Pool scoring are untouched.
- Respect spoiler views: compute on whatever state the viewer sees (`SpoilerLogic.viewThrough`).

## On screen

- Standings rank by the running total. Ties share a rank ("T-1"). Each row gets a muted second line:
  "3 still in" or "2 still in · 1 out".
- Each castaway on a team: points so far; still in gets a small "still earning" label; out gets the red
  Out tag and "Final: 4".
- After a reveal, castaways still in show "+1" per elimination that episode.
- Explainer copy (`src/components/explainer/league-explainer.tsx`, Classic "ladder" card) becomes:
  "Your castaways earn a point each time someone else goes home. The longer they last, the more they
  earn. The winner of {N} ends on {N}." Update its visual to match (running points, not only finishes).

## Touches

`state-logic.js` (Classic scoring) and every place Classic points show: Overview standings, Scoreboard,
your team, the per-episode breakdown (`src/components/overview/standings-card.tsx`,
`src/components/scoreboard/*`). Grep for consumers of the score rows' `locked` field. Design at 390px
first; verify locally in the browser.

## As built (2026-10-11)

- Engine: `EliminationOrderScoringStrategy.castawayPoints/stillInPoints` in `state-logic.js`; a Classic
  row's `locked` is now every owned castaway's points so far, with `banked` the part from those out.
- Proof: every local league (11, 39 player totals; S49 is the only finished season, the rest were
  played to the end by script) gives identical final totals old vs new, and running totals never fall
  episode to episode. Unit tests: `tests/classic-live-scoring.test.js`.
- Screens: Standings second line "3 still in · 1 out", face corner badge = final points; Your Team
  plates and the player page carry a "So far"/"Final" number, "Still earning" under the still-in;
  Scoreboard tiles show points under each face; the episode page shows what each team earned
  ("You earn 3 · 3 still in, +1 each · Kim out, ends on 4"), the Episodes list "You +2 · Sam +3", the
  reveal "3 still in, +1 each"; "You keep 4" replaces "You bank 4". Rules page, create-league
  copy and the explainer card (a three-column "Ep 1 / Midway / Finale" table) use the new wording.
- Ties keep the app's existing "T1" label (the plan wrote "T-1").

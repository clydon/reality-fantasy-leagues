# Plan: the bot settles results, final at noon, changes after final are told

> **Status (2026-11-20): in build on branch `results-settle` (lane `rfl-results`, port 3017).** Engine first (A1-A4), then the
> words through the design process (B), then the screens (C), then checks and the push (D). Nothing pushed.

## Why

The user, 2026-11-20, looking at the desk: "I have a lot of disputed stats... it's a bit overwhelming to me as an admin." What
production showed (read-only, and a backup of 2026-11-19):

- **All 551 disputed results came from one run**: the catch-up of Mon 2026-11-16, ~9:10-11:20 PM ET, which asked our bot again
  about every aired episode of every show (for cast properties). Each source is one voice (`community-results.ts inputsFor`),
  so where the catch-up and Autopilot disagreed it was 1 against 1, and nothing broke the tie (the tie-break run was off).
  There were no player flags, and none came from the weekly final-results window.
- **Only 56 touched anyone's game** (Survivor 51 Eps 5-8, the couch's three games). The Challenge 42 had 202 (a finished season,
  one game with one person), The Traitors 5 had 251 and Below Deck 13 had 42 (no games).
- **The desk's Inbox showed only The Challenge's**: `desk-inbox.ts disputes()` takes 30, highest episode number first across
  every show, so its Episodes 9-14 filled every slot. Backstage reads one season, so it showed Survivor's, worded as if a player
  had flagged them ("Someone flagged it · one more answer settles it").
- **Noon is the right time; "final" just didn't mean anything.** The regular runs end ~9:30 AM (full at 12 h), and nothing in
  Eps 7-9's weekly cycle changed after noon. But final results were only "a time to look" (final-results.js), so the catch-up
  moved 18 Survivor results' points weeks later, and a correction sends nobody a word.
- **The morning run could take results out but not put them in.** `fact-status.ts` held a result back while any answer for the
  episode, the same bot's earlier one included, didn't report it, and held back anything a single source wasn't sure of. 14
  Survivor results the 9:30 AM run reported (Episode 7's ten reward wins among them) sat out for 11 days until the catch-up
  agreed; Episode 9's two (Mike's reward win, Sharonda learning of the idol) waited until the user confirmed them.

## Decisions (the user, 2026-11-20)

| # | Decision |
|---|---|
| 1 | Let the AI settle so the app runs itself; correct data applied, never skipped. This season is a beta: the couch knows points can move. |
| 2 | Episode 9's two waiting results are right: accepted on the desk (12:07 PM, "by you", undoable). |
| 3 | Today's disputes: the bot's third look, majority wins. The desk's tie-break switch went on at 12:08 PM ET; it works through ~30 episodes. |
| 4 | Until final, the bot's latest answer counts, additions included. |
| 5 | Final results at 12:00 noon the next day stay. After that, a correction from the bot applies once a second look by the bot agrees, and that game's players are told what changed and how their points moved. The admin or the game's maker can still override. |
| 6 | Screen words go through the design process first; no push without the user's OK, never on a Wednesday. |

## The rules (fact-status.ts)

- **Voices.** Each sender is one voice and its newest answer is its word (as now). New: a bot answer filed after the episode's
  final time is a voice of its own (`<key>#after`), so it can't overwrite the bot's own answer from before final; it disagrees
  with it, and the tie-break settles the split.
- **One look is enough before final.** A result one voice reports and no voice's newest answer disputes reaches every game,
  whatever its confidence. A voice's older answers no longer hold back what its newest one adds (`contradicted` is gone).
- **Two looks after final.** On an episode that had results by its final time (an answer from before it, or a result an admin
  decided), a result only after-final bot answers report stays out until a second one agrees (confirmed, it goes in) or one
  doesn't (removed). An episode with no results by then takes its first answer as one look, whenever it comes.
- **Splits** stay as they were until settled (as now); the tie-break run settles them.
- Locked (an admin's), and the cast properties that settle at once (prop, holding), are unchanged.

## Steps

### A. The engine (no screens)
- **A1. The rules** in `src/lib/game/fact-status.ts` (`settleEpisode(facts, subs, { confirmAt, finalAt, hadResults })`), the
  episode's final time and whether it had results then in `community-results.ts inputsFor`; tests/fact-status.test.js.
- **A2. The tie-break** (`db/bot-research.js`): due an hour after the split, not a day (so a split before final settles
  before noon), and also asked of a result waiting for its second look after final; tests/bot-research.test.js.
- **A3. Told after final:** the season sync (`season-decisions.ts syncSeasonLeagues`) collects each game's corrections to
  episodes past their final time and sends one notice per person per sync (push-events.ts, a new type in the "Final results
  are in" moment), with what changed and their points. Before final, a correction stays quiet (as now).
- **A4. The backlog:** a desk route that settles every episode again under the new rules (`settleEverything`), run once after
  the deploy; what moves is told by A3.

### B. The words (docs/DESIGN-PROCESS.md: Intent, then Perception-First Design, then Impeccable; a screenshot story at 390)
Backstage's needs (the disputed and "wait for you" rows go: nothing waits for the couch), the after-final notice and its line
on the episode, the "Final results are in" moment's line, the early results' line, the desk's Inbox (only what the bot couldn't
settle, one row per episode), the season and episode pages' counts and reasons, and the catch-up's answer labelled as such
(it reads "On its schedule" now).

### C. The screens, after the user's review of B.

### D. Checks and the push
`npm test`, tsc, eslint; the results checks in scripts/dev-test (check-new-settling, check-new-community, check-final-results,
check-tonight-results); a what-would-move run of A4 over a fresh production backup (which leagues' totals change, by how much),
for the user before the push; the deploy rehearsal if a migration lands; then the push on the user's OK.

## Noticed, not fixed
- Local master holds one docs commit (cd1427a8) that origin/master doesn't; this branch is from origin/master (61a13da6). The
  sports session (main folder, `sports-phase2`, from cd1427a8) carries it.
- The catch-up holds an answer that would change scores for the admin's Send (catch-up.ts). With two looks after final its lone
  answers can't move scores, so the hold is mostly moot; leave it until the next catch-up.

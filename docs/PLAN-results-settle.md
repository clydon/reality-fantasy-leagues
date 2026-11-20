# Plan: the bot settles results, final at noon, changes after final are told

> **Status (2026-11-20, 3:30 PM): A and B built on branch `results-settle` (lane `rfl-results`, port 3017), not pushed. D's
> what-would-move run is done (below, "D: what would move"); it found one fix, made. Waiting on the user's OK to push** (no
> migration, so no Neon rehearsal; never a Wednesday). After the deploy, POST /api/desk/settle-again once and check the Inbox.

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

## As built (2026-11-20, a2a95b4b..bb2bb3af)
- **A1** `fact-status.ts` (`settleEpisode(…, { confirmAt, finalAt, hadResults })`, `voiceOf`), `community-results.ts inputsFor`
  (the episode's final time from `schedule.ts finalAtOf`; had results = an answer from before it, or a locked result). A late
  result waits whether or not it's in the games now, so an agreeing answer taken back leaves it waiting again (bb2bb3af).
- **A2** `db/bot-research.js`: `TIEBREAK_AFTER_MS` an hour; `tiebreakQuestions` asks of reported-and-pending results too, its
  `newest` leaves the tie-break's own answer out, and `from` (app_settings 'tiebreak_from') re-asks every open question.
- **A3** `season-decisions.ts` returns each game's corrections and deltas (`SyncResult.corrections`, `deltas`) and
  `syncSeasonLeagues` tells corrections to episodes past their final time (`push-events.ts notifyResultsChanged`, type
  `resultsChanged` in the Final results moment); `rulings.ts` tells a house ruling after final results the same way.
- **A4** `POST /api/desk/settle-again` (`desk.ts settleAgain`): settleEverything as the system, then 'tiebreak_from', then the
  bot's clock told. No screen.
- **B** (Impeccable alone: words and small fixes, docs/DESIGN-PROCESS.md "When not to use them"): Backstage's disputed and
  waiting jobs gone, its Results card passive (our bot is checking / the site's admin decides), the tick-to-apply card gone,
  the Results row "our bot is checking N results again" (each once: `BackstageEpisode.settling`); the Inbox one row an episode
  ("Survivor 51, Episode 8: 3 results still split"), newest first, only what the bot couldn't settle; the switch "When answers
  disagree: our bot looks again an hour later"; the desk's "being settled", "waiting for a second look", "1 source", the
  catch-up's and the tie-break's answers named; the Final results moment's line.
- **Checks** on the new rules: check-new-settling (103 pass), check-new-community (91), check-new-backstage (64),
  check-desk-episode (92), all at 390; `npm test` 2482. The story's frames: `scripts/dev-test/capture-results-settle.js`
  (any version of the code), under `.ui-atlas/stories/results-settle/`.

## D: what would move (2026-11-20, backups/prod-2026-11-20 taken 1:41 PM ET)
`scripts/dev-test/what-would-move.js --backup=<dir>`: the backup restored into a scratch `restore_` database, settleEverything
run there as settle-again does (no bot asked), then each result in or out, each game's totals and each notice, against the backup.
- **First run: a fix.** Survivor 51 Ep 6's two results (Ori's shot in the dark and lost vote, in the games and confirmed) went
  to a split: Autopilot answered before AND after final, both without them, and `#after` counted it twice against the catch-up
  and the tie-break (2 to 2), a split no further look could break (the tie-break's newer answer replaces its own). Now a bot's
  after-final answer that says what it said before is one voice; only a change of mind is its own (`fact-status.ts settleFact`,
  tests/fact-status.test.js). Ep 6 stays confirmed.
- **With the fix:** one game moves, the couch's Weekly Start/Bench: Survivor 51 Ep 3's four catch-up-only results (Danny's and
  Mike's sat out, Lewis searched another's bag, Rob gave away an advantage) come out to wait for a second look: +1, +0.5, +0.5,
  no places change; each of the three is told once ("Ep 3 results changed"). Below Deck 13 Ep 5 (7) and The Traitors 5 Eps 3, 5,
  9, 10 (75) go in: seasons without games. Nothing else moves; the other Survivor games and The Challenge stay as they are.
- **Then the bot's look** (settle-again re-asks every open question; due an hour later): 25 Survivor results waiting for a
  second look on Eps 1 (16) and 3 (9, the four above among them), catch-up-only, 21 of them never in the games (Ep 1's reward
  wins among them). If it agreed with all of them (a one-off bound, not a prediction): the same game, +5, +5 and 0 against
  production now, no places change. Eps 7 and 8's splits (16 and 26, Autopilot against the catch-up, no tie-break answer yet)
  settle by the tie-break either way, pushed or not (on in production since 12:08 PM).
- Checks after the fix: `npm test` 2482, tsc, eslint (fact-status.ts); check-new-settling 103 and check-new-community 91, each
  with the one line that fails on origin/master too (below).

## Noticed, not fixed
- **check-new-settling and check-new-community fail one line on origin/master too** (61a13da6, run 2026-11-20): "jordan's
  Episode 6: the corrections sit right above 'Something wrong in this episode?', not at the top" ({"above":false}). Not this
  branch's; the episode page's corrections moved since the check was written. For the next UI polish session.
- **ESLint on origin/master: 3 errors, 7 warnings** in files this branch doesn't touch (src/new/show/game-page.tsx and
  lineup-sheet.tsx `react-hooks/purity`, src/new/preview/*, src/lib/episode-results.ts, format-timeline.js,
  start-gallery/index.js, src/new/desk/pages.tsx). For whoever pushes next to look at.
- **(Measured: "D: what would move" above.) The settle-again's one-time churn, to measure before the push (step D):** Survivor 51's Episode 3 has four results only the
  2026-11-16 catch-up reported (they went in that night on the user's word); under the two looks after final they wait for a
  second look, so settle-again takes them out and the tie-break run looks again within the hour (likely back in: two notices
  for the couch, once). Episodes 4-6 had bot answers after their final times too (the 2026-10-29 re-runs), mostly backed by a
  second look since; the what-would-move run over a fresh production backup lists exactly what moves, for the user, first.
- Local master holds one docs commit (cd1427a8) that origin/master doesn't; this branch is from origin/master (61a13da6). The
  sports session (main folder, `sports-phase2`, from cd1427a8) carries it.
- The catch-up holds an answer that would change scores for the admin's Send (catch-up.ts). With two looks after final its lone
  answers can't move scores, so the hold is mostly moot; leave it until the next catch-up.

# A castaway opened from a week: decisions (BACKLOG 251)

## 2026-11-22 · The sheet leads with the week as a block, not a different sheet
- Decided by: the user (the direction, "it should be assumed I want to see his week"); Claude (the form)
- Why: one castaway sheet from every way in (the user, 2026-11-16, after two different castaway sheets confused them); the season stays one scroll below, which the user likes
- Rejected: a separate "Carter in Ep 9" sheet (a second castaway sheet); the breakdown expanded in place under the Started cards (three narrow columns grow tall and uneven at 390, and a face's tap would do different things on different screens)
- Rests on: docs/BACKLOG.md 251; memory game-data-display-intent (2026-11-16 and 2026-11-22)

## 2026-11-22 · The rows add up to the total, every factor a row
- Decided by: Claude, default
- Why: "how did he get +6" is answered only when the arithmetic closes; a captain's double or a finale window otherwise reads as a wrong sum
- Rejected: moments only, with the total beside them (the gap unexplained)
- Rests on: state-logic.js ActiveRosterLogic.episodeScore (a line is its moments times the captain's, the episode's and a stint's factors)

## 2026-11-22 · Only games that score people week by week get the block
- Decided by: Claude, default
- Why: a pool's pick, an Outlast row and a show-only door have no game arithmetic for one person in one episode; their doors land on the story at that episode, as the season table's numbers do today
- Rejected: a block for every game kind (it would repeat the story entry for most of them)
- Rests on: cast-sheet.tsx countsWeekly; game-view.ts castWeeks

## 2026-11-22 · Moments a game gives nothing for are listed, muted, in one line
- Decided by: Claude, default
- Why: "he started and got 0, but didn't he do something?" is the 0's question; the line answers it without a row per nothing
- Rejected: leaving them out (the 0 looks like a missing result); a row each (busy)
- Rests on: team-episode-breakdown.ts items include every moment, scoring or not

## 2026-11-22 · One name per moment everywhere: the show's
- Decided by: the user (took the recommendation)
- Why: the check found one moment named two ways on one sheet ("Individual immunity win" in the game, "Won the Immunity challenge" in the show's stats and story)
- Rejected: the game's names everywhere (older, and the show's tabs already speak the rulebook's); leaving the two (a moment read as two facts)
- Rests on: docs/design-round/week-door-critique.md; src/lib/game/moment-names.ts (display only: rulebook-compile.js keeps the format's labels so recorded answers keep their meaning)

## 2026-11-22 · No lineup stepping on the castaway's sheet, and no breakdown hint on the Started card
- Decided by: the user (took the recommendations)
- Why: Back returns to the same week in one tap, and the tap itself now answers what a hint would promise
- Rejected: ‹ › through the lineup in the castaway sheet's header; "+6 · 2 moments" on the card
- Rests on: docs/design-round/week-door-critique.md, "For the user"

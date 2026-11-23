# Rivalries (sports-couch C1): the check and its one batch (step 4)

The built card and sheet at 390 (story-rivalry.js's frames in `.ui-atlas/stories/rivalry/after/`: a spectator before anyone picks,
a fan, the fan's sheet, the call sent, the challenged fan and their sheet, both calls in, a spectator's side picked, the second
rivalry, the rivalry game's own page, on now, over for a spectator and for the fan, over while hiding scores and after Show records,
Studio), checked once by PFD's `evaluate` (against [rivalry-first-view.md](rivalry-first-view.md)) and Impeccable's `critique` (a
design review and the detector, run apart). Every finding below was fixed in one batch, or is listed as open.

## PFD evaluate (once)

Foundation 70 · L1 82 · L2 84 · L3 80 · L4 78.

| # | Severity | Layer | Finding | Fix |
| --- | --- | --- | --- | --- |
| P1 | Major | L4, R5 | A spectator who picked a side got the page's "Your move" plate for the margin: the optional half of the game read as a due move, and pushed the card down 70 px (spectator). | Once a rivalry's side is picked, the rest of it is optional: never a move (answers.ts `summaryOf`). |
| P2 | Major | L1, R2 | Two rivalries in a week: the second card's call was always outlined, even when the first card asked nothing of you, so Sam's own call had no yellow anywhere (spectator, on). | One yellow a page: the move strip's, else the first card you're a fan in. |
| P3 | Major | Foundation, R1 | The spectator's card ran 369 to 433 px, over R1's 300: "Add a margin" and "Other games on it" were two 44 px rows. | One foot row: Other games on it at the left, Add a margin (or "Your margin: 4 · Change") at the right. 323 px fresh, 387 px with sides drawn. |
| P4 | Major | (rule) | Once a rivalry was final, the card moved to the week's next rivalry, so its result was never shown on This week (the before frames' `over`). | The week's cards are on now, then the next, then the last played, two at most: a final stays as the second card. |

## Impeccable critique (once: a design review and the detector, run apart)

**Design review:** the friendship reads first (people under each team, their calls where a score sits); the result line is the
card's one caption-type line; one yellow a view in every frame but a sheet's (the dimmed card's under the scrim). Nielsen 29/40
(status 3, real world 3, control 3, consistency 3, prevention 3, recognition 3, flexibility 2, minimalism 3, recovery 3, help 3).
**Detector:** exit 0, 0 anti-patterns; eight advisory font-size notes (14 px, 17 px, 20 px, 12 px: the house sizes the league page
already uses; DESIGN.md's ramp to update, not this file). Its scan of the frames' words: no overlaps (overlaps.json empty).

| # | Severity | Finding | Fix (one batch) |
| --- | --- | --- | --- |
| C1 | Major | The rivalry game's own page listed the public sides as team ids ("zt_nd_alex 9301"); the same `answerWords` fall-through shows any one-game side answer by id after the lock too (game-page). | A side answer says its team's name (its faces, or each game's sides): questions.tsx `answerWords`. |
| C2 | Minor | The winning side's check sat on the last face of a stack, half hidden by the next (over). | The check goes before the winning side's count words, which turn to the foreground. |
| C3 | Minor | "Other games on it" was a 40 px target. | 44 px, in the foot row. |

## The confirming look (once)

`over`, `spectator`, `game-page` re-shot: the result card second under the next rivalry, its check in the words; the spectator card
323 px fresh; the game page's sides by name. Every scripted check passes (13), no overlaps.

## Open (not chased)

- **The game page's one-game sides are listed home first** ("ZT Jets at ZT Eagles" for Eagles at Jets): the listing's team order,
  older than C1, every Pick'em on one game. BACKLOG 255 (a).
- **A person's episode sheet** shows their answers only after the lock, so a rivalry's public side isn't on it before kickoff (the
  conservative way; the card and the game page show it). BACKLOG 255 (b).
- **The fixture's names** are usernames (zt_nd_alex): the card says whatever name the couch shows, so real couches read "Andrew
  called it". The caption type uppercases them, as the house's caption does everywhere.

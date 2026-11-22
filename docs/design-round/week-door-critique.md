# A castaway opened from a week: the check (BACKLOG 251)

Method: dual-agent (A: design review · B: detector and browser evidence), plus Perception-First Design's evaluation
([week-door-pfd-eval.md](week-door-pfd-eval.md), 72/100), each run once on the build's frames at 390
(`.ui-atlas/stories/week-door/after/`, `scripts/dev-test/story-week-door.js`).

## Design health

| # | Heuristic | Score | Key issue |
| --- | --- | --- | --- |
| 1 | Visibility of system status | 3 | after ‹ the subtitle still says "up to Ep 5" over "Episode 4" (true: it's the viewer's mark) |
| 2 | Match with the real world | 3 | "scored, didn't count" beside a 0 |
| 3 | User control and freedom | 3 | ‹ › swap in place; Back returns to the same week pane |
| 4 | Consistency and standards | 2 | one moment, two names on one sheet; a captain's week +11 beside a game row's +5.5 |
| 5 | Error prevention | 3 | the captain week invites a misreading |
| 6 | Recognition rather than recall | 4 | nothing carried across the tap |
| 7 | Flexibility and efficiency | 3 | weeks step by taps only (the pane it came from swipes) |
| 8 | Aesthetic and minimalist design | 3 | a lone "‹ Ep 4" row costs 44px |
| 9 | Error recovery | n/a | read-only; a week without data falls back to today's sheet |
| 10 | Help and documentation | 3 | "Changed by this game's rules" explains nothing (a rare path) |
| | **Total** | **27/36** | Good |

**Specificity:** authored for this product: the block repeats the week pane's head, the chart's band marks and the bench's muted
ink; the rows read as a scorer's receipt. Detector: 56 advisory font-size findings, 7 in the new code (14, 17 and 34px), all
following the files' habit and the ramp gap BACKLOG 106 records; the live overlay found nothing in the sheet. No overlapping words
in any frame.

## Priority issues, and what the fix batch does

| | Issue (frames) | Fix in this batch |
| --- | --- | --- |
| P1 | A captain's week reads +11 while the game row under it marks Ep 2 at +5.5 and the season at +5 (captain) | a subtotal row, "Their own points +5.5", before "Your captain ×2 +5.5": the block's own +5.5 is the game row's |
| P2 | A bench 0 "scored, didn't count"; a 0 with nothing at all says "Nothing that scores in this game" while the story says "Nothing recorded" (season-cell, zero) | "On your bench: didn't count" when it's 0; "Nothing recorded" when there's no moment; "Nothing that scores in this game" only before a "What they did:" line |
| P2 | One moment, two names on one sheet: "Individual immunity win" in the block, "Won the Immunity challenge" in Their numbers and the story (captain, start, step) | the block names moments as the sheet does (by key); the Started card keeps the game's name: which name wins everywhere goes to the user |
| P2 | The marked Each episode column reads "2" (moments) under a "+3.5" total (step, captain) | only the game's points chart (In the couch's games) marks the week |
| P3 | The episode door is 34px tall with a faint underline, and the name and the episode stack tight (every block frame) | 44px target, the Control Edge underline, more room above the block than inside it |
| minor | ‹ › named only "Ep 4"; "N more" stays open across weeks; no cross-fade returning to the first week | "Previous week: Episode 4"; the fold closes on a new week; every swap fades |

## Persona red flags
- **Joanna:** the bench 0 that "scored" (fixed); "Changed by this game's rules" if she ever meets it (kept: a stint's factor, rare).
- **Andrew:** the crumb says "alex" while the block says "you" (kept: the crumb names levels, the block speaks to you).
- **Conor:** the captain week that didn't reconcile (fixed); ‹ › moves with the number of rows, so quick stepping re-aims (kept).

## For the user
- Which name a moment wears everywhere: the show's ("Won the Immunity challenge") or the game's ("Individual immunity win").
- Whether the castaway's sheet should also step through the lineup (Eric › Cristian › Jelly), since checking the next starter is
  the likeliest next move.
- Whether the Started card should promise the breakdown ("+6 · 2 moments").

Questions skipped: the round's process (docs/DESIGN-PROCESS.md) takes the check's open choices to the user in the screenshot story.

# A game's sheet with Play (sports-couch B4): the check and its one batch (step 4)

The built sheet at 390 (story-game-sheet.js's frames in `.ui-atlas/stories/game-sheet/after/`: before kickoff with and without a
couch game, Squares chosen, Go bigger, a rivalry, live, live while hiding scores, final, a daily sport, solo, Studio, a real NFL
game), checked once by PFD's `evaluate` (against [game-sheet-first-view.md](game-sheet-first-view.md)) and Impeccable's `critique`
(a design review and the detector, run apart). Every finding below was fixed in one batch, or is listed as open.

## PFD evaluate (once)

Foundation 72 · L1 80 · L2 82 · L3 74 · L4 82.

| # | Severity | Layer | Finding | Fix |
| --- | --- | --- | --- | --- |
| P1 | Major | L4, R5 | Join said twice: the couch row's "Join ›" and the yellow plate, and the plate sat under the tiles, so it read as tied to the tile chosen (pre). | The yellow Join sits under its couch row; the row has no Join of its own; Play below is "Or start your own". |
| P2 | Major | L3, R4 | The couch game named "Pick'em · Game 12" (the engine's name) (pre). | "Riley's Pick'em" (its maker and kind). |
| P3 | Minor | Foundation | The kickoff time three times in one view (the bug, Join's line, Start another's line) (pre). | Start another's line says only the undo; the lock is on Join's line. |
| P4 | Minor | L2 | The chosen type's line was the engine's ("Game 1 · 1 question"). | Removed; each tile says it in a fan's words. |

## Impeccable critique (once: a design review and the detector, run apart)

**Design review:** mostly specific (the shared bug, the caps title, one yellow); Nielsen 28/40 (status 3, real world 3, control 3,
consistency 3, prevention 3, recognition 3, flexibility 3, minimalism 2, recovery 2, help 3). **Detector:** exit 0, ten advisory
font-size notes (14 px off DESIGN.md's ramp: a house size used 589 times; DESIGN.md's to update, not these files); no other hit.
Its scan of the frames' words: no overlaps, nothing undefined, and the wording points below.

| # | Severity | Finding | Fix (one batch) |
| --- | --- | --- | --- |
| C1 | Major | Join twice, and the chosen tile's white fill competed with the yellow (A, with P1). | As P1; the chosen tile is an ink outline with a check (PFD's R2 and the spec), the yellow the only fill; Studio reads too. |
| C2 | Major | Solo: tiles that look choosable lead nowhere (solo). | Solo has no tiles: "Start a couch" is the yellow, "Join one with a code" a link. |
| C3 | Major | "Picks closed at kickoff." shown with no couch game on it ("picks for what?") (live). | Only when a couch game covers it; otherwise the thread link, or "Talk about it" when there's no talk yet. |
| C4 | Minor | A rivalry read as an ordinary game: the couch line muted, Pick'em not a side (rivalry). | The couch line in full weight; Pick'em's tile says "Pick a side" when both teams have couch fans. |
| C5 | Minor | "Sixers at Knicks, Nov 23 – Nov 24" read like the same game again (daily). | "Their series · 2 games · Nov 23–24". |
| C6 | Minor | "It locks" (whose?), "the couch is told, 10 seconds to undo" (B). | "Squares locks at kickoff"; "You have 10 seconds to undo, then the couch is told". |
| C7 | Minor | This week's row said "every game still to come" (reads as the season) (B). | "Pick'em on this week's games still to come". |
| C8 | Minor | "The party grid" doesn't say what Squares is (A). | "A grid of score digits". |
| C9 | Minor | Tiles used `aria-pressed` for a single choice (A). | A radio group: `role="radiogroup"`, each `role="radio"` with `aria-checked`. |

**Kept, with the reason:**
- **The day alone under the title** ("Today"), the time in the bug (A: merge them): the bug is the shared row and keeps its status
  column (R3); the day is the one thing it doesn't say when grouped. Open if it reads odd.
- **The line as ESPN's short form** ("NYG by 3", "DAL by 8.5"; A: "in words"): the scorebug's approved form since A1 (round 3's
  default); a change goes to every surface at once. Open.
- **"10:24PM" on the bug, "10:24 PM" in words**, ESPN's "Fox" casing: the bug's own and the provider's.
- **Collapsing Play behind "Start another…" when a couch game exists** (A): the batch's fix (Join under its row, "Or start your
  own" heading) settles the duplicate without hiding the types; collapsing them would cost Conor a tap to see what else exists.

## The confirming look

One re-shoot of every frame: all 12 pass (one yellow before kickoff, none after), no overlapping words. Still showing: the couch
row's second line repeats its maker ("Riley's Pick'em" over "Riley · 1 in"); listed, not chased. `npm test`: 2,599 pass; tsc and
ESLint clean on the app files.

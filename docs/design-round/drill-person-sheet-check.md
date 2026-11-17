# The castaway sheet and the stat's board: the check, the batch, the confirming look

Run once each, on the built frames at 390 px (`.ui-atlas/stories/person-sheet/after/`, re-made by
`node scripts/dev-test/story-person-sheet.js --up --dress-from=rfl_castprops --stat="Zero votes"` and, with the dev server reading
the cast-props lane's copy of production, `--real-db=rfl_castprops --real-name=Sharonda --real-ep=7`):
- **Impeccable critique, 27/40** (dual-agent: an unanchored design review, and the detector's CLI scan with its overlay injected on
  three live views): [drill-person-sheet-critique.md](drill-person-sheet-critique.md); the snapshot is in `.impeccable/critique/`.
- **PFD evaluate, 72/100** (L0 68, L1 82, L2 74, L3 64, L4 76; R2 met, R1 and R3 to R5 partly):
  [drill-person-sheet-pfd-eval.md](drill-person-sheet-pfd-eval.md).

## The batch (one)

| Finding | From | Fix |
| --- | --- | --- |
| Their numbers read backwards: "Rank of 21" over the count, "T1" hiding a nine-way tie | A P1, PFD major 1 | The count first, under it where it ranks in words ("3rd most, tied with 7", "Most of anyone"); the caption "Out of 21"; sorted by place, then the fewest sharing it, then the most |
| The game you came from disappears (from Outlast: only Weekly Lineup offered, Outlast's row closed at the fold) | A P1, PFD major 2 | In your games puts the game the sheet was opened from first and open (`from`, every drill level that reads a game); a row opened by a tap scrolls its holders into view (PFD major 3) |
| The who block keeps the owner's constraint by addition | PFD major 2 | Kept all of it: the billed line muted (the bright lines are the status and the holding), the billing's paragraph two lines with the rest a tap away in place; "Counted by" on its plates' row |
| A chosen lens chip was the brightest thing in view | A (Andrew), PFD noted | One `plate` for a switch that isn't a move: raised and outlined in bone, never filled; 44 px; the Cast tab's own Counted by uses it too |
| The catch-all grey the loudest colour; "Counted for you" styled as a link; dead space under the chart | A P2 | "Everything else" in the control edge's grey (3:1, the quietest); a bone dot under the weeks that counted for you, said once ("every episode") when they all did; the chart's foot trimmed |
| The lens changes the story's numbers unnamed; the board's holders depend on a lens set two levels up, never Outlast | A P2 | The story's caption names the game whose points it shows; the board has its own "Who has them in" (Nobody and every game you play that has teams), starting at the lens or the game you came from; the castaway it opens comes from that game |
| "Free" in a shared game | PFD minor 4 | Free only where no castaway is on two teams |
| A rare stat's board: 17 rows of nothing; "1 of 18" read as a place | A P2, PFD minor 5 | Everyone without it as a grid of faces once they outnumber the rest; "Nobody else so far" under a sole leader; the subtitle "1 of 18 has it" |
| The board's out rows at 3.4:1 | B | No dimmed row: an out name muted, its face greyed, the words at full contrast |
| The framed row 6 px off the board's columns | PFD minor 7 | The frame sits outside the row's columns |
| Three label sizes within a pixel (12, 12.5, 13) | B, PFD minor 10 | 13 px for labels in the new parts |
| A pick's closed row without its episode | A minor | "Picked by you · Ep 3" |

Also: Compare with… waits until something's counted (check-cast-props.js 3 expects it, from master's sheet).

## The confirming look (one)

The frames re-made once found two slips in the batch itself, fixed without another round: the billing's paragraph showed three
lines (a `block` class beat the two-line clamp), and the board's switch clipped its third plate at the sheet's edge (with more than
two plates the label now sits above them). The last frames are the ones in the story; no overlaps, no page errors.

## Open (in the story, for the user)

- **The chart's colours** (A P2, PFD's named choice): the season's three most frequent stats take the colours, which on many
  castaways marks what everyone did (tribe results) and greys what's theirs. One colour per stat for the season stays (step 5);
  which three is the choice: the most frequent, or the ones that separate castaways.
- **The lens on the sheet** (the spec's open question; A asks it again): kept on the sheet and now named where its numbers land.
  The alternative is a game's points only in its row under In your games, the chart always what they did.
- Noticed, not this round's: the game page's week tag picks white ink on a light hsl colour (`inkOn` in game-week.tsx reads only
  hex; 2.6:1, BACKLOG); Something wrong is offered only from the Cast tab's drill (the game page passes no `onFlag`); a failed
  stats read leaves the drill's levels pulsing (no error state); the sheet's header slices text as it scrolls under it (ui/sheet.tsx,
  every sheet); holdings and property changes are told in the story but not counted in the chart's "moments" (a count and a
  story that differ by them); a long season's chart opens at Episode 1 (the newest weeks off to the right).

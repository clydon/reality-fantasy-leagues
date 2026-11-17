# The castaway sheet and the stat's board: Impeccable critique (built frames, 390 px)

Method: dual-agent (A: an unanchored design review that saw neither the detector, PFD's findings nor the round's reasoning;
B: the detector's CLI scan and its in-page overlay on three live views, injected through the headless helper).

Frames: `.ui-atlas/stories/person-sheet/after/` (the zt couch on Survivor 51's castaways, dressed with the real billed bios,
properties and holdings; and `real-*`, the real Survivor 51 at Episode 7), against `before/`. Source: `src/new/show/cast-sheet.tsx`,
`game-sheets.tsx`, `cast.tsx`, `stats.tsx`. This is the build before the check's batch; the batch is in
[the check](drill-person-sheet-check.md).

## Heuristic scores

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 3 | The mark and the path back always show; a lens switch rewrites the story three sections down unsaid |
| 2 | Match with the real world | 3 | The show's own words; the new numbers slip into shorthand ("T1", "Rank of 18", "1 of 18") |
| 3 | User control and freedom | 3 | Every level a way back; the chart's jump to the story has no way back but scrolling |
| 4 | Consistency and standards | 3 | One layout everywhere; underline means a link in the crumb and "counted for you" in the chart |
| 5 | Error prevention | 2 | Misreadings invited: "Rank of 21" over the count, "1 of 18" reads as a place |
| 6 | Recognition rather than recall | 3 | Faces, names and the framed row carry memory; the story's points never name their game |
| 7 | Flexibility and efficiency | 3 | Every number opens something; holders show on the board only after a weekly lens |
| 8 | Aesthetic and minimalist design | 3 | Calm sections; a chosen chip is the brightest thing in view, the catch-all grey the loudest colour |
| 9 | Error recovery | 2 | Something wrong only from the Cast tab; a failed stats read pulses forever in the drill's levels |
| 10 | Help and documentation | 2 | The new numbers don't explain themselves ("T1", Outlast's "6", which column "Rank of" labels) |
| **Total** | | **27/40** | Acceptable, at the top of the band |

## Design specificity

**Review:** the words are this product's (the tethered idol and who gave it, "On riley's team", "Counted by Weekly Lineup", the
spoiler mark in every subtitle); the layout could be any fantasy app's player card. The structure is now one object, the win;
visually it is the system's quiet layer only, with none of its loud one (plates, tags): the risk PRODUCT.md principle 8 names.

**Detector:** 0 primary findings; 56 advisories, all `design-system-font-size` against DESIGN.md's front-matter ramp (21 from this
change, 35 already there; the ramp under-describes the app, where 14 px is on 479 lines). It misses decimal sizes: 12.5 px ×9 in
the new code. In the page: the board's out rows at 3.4:1 (muted text in a row dimmed to 62%), a true positive in new code; on the
game page under the sheet, the "EP 6" week tag at 2.6:1 (`inkOn` reads an hsl colour as rgb and picks white), a real bug outside
the target; "repeated-container-text" (one stat as a legend label, a numbers row and a story line: three jobs, not a defect);
bounce easing in new.css, predating the change.

## What's working

1. One layout from every way in: the face anchors it, the gold fill is gone, a shared game's four identical rows fold into one
   line behind a tap. The relative's stumble is fixed in the structure, not with paint.
2. The board turns a dead end into an answer: one scale, ties placed, out castaways greyed with when they left, the castaway you
   came from framed and scrolled into view, holders in a game's lens, the path back naming every level.
3. Spoiler discipline: everything stops at the viewer's mark (sam at Episode 3), and sections that don't apply aren't there
   (riley's watch-only Traitors).

## Priority issues

1. **[P1] Their numbers reads backwards.** "Rank of 21" sits over the count; "T1" hides a nine-way tie; sorted by place alone,
   big ties lead. Fix: the count first, its rank in words under it, the tie's size said. (/impeccable clarify)
2. **[P1] The game you came from disappears.** From Outlast the sheet offers only Weekly Lineup, Outlast's row closed at the fold;
   the spec asks for it open. Fix: that game's row first and open. (/impeccable layout)
3. **[P2] The chart's colours and marks point the wrong way.** Colour goes to the season's most frequent stats (often the least
   telling); the catch-all grey is the loudest fill; "Counted for you" is styled as a link. Fix: a quiet catch-all, a dot for
   counted weeks, choose the colours by what separates castaways. (/impeccable colorize)
4. **[P2] The lens changes things it doesn't name, and isn't where it's needed.** The story's points don't say whose; the board's
   holders depend on a lens chosen two levels up and never show for Outlast. Fix: name it where its numbers land; give the board
   its own switch. (/impeccable layout)
5. **[P2] A rare stat's board is mostly empty rows, and its count reads as a rank.** Fix: the none group as a face grid when it
   outnumbers the rest; "1 of 18 has it"; say a sole leader. (/impeccable distill)

## Persona red flags

- **Joanna:** "Counted by" asks her to choose before she knows what changes; "Rank of 18" over "T1 · 1"; "1 of 18" reads as 1st.
- **Andrew:** the brightest thing in view is an already-chosen chip; "Counted for you" looks like the crumb's link; orange reads
  as "mine".
- **Conor:** "who's 1st, are they free in my game" works only after a weekly lens; "T1" hides eight others; totals don't match the
  story (holdings are told but not counted); a 25-episode chart opens at Episode 1.

## Minor observations

Rank words mixing "1st" and "T3"; "You" opening a sheet titled ALEX; "7.5" and "+7.5" for one number; Something wrong only from
the Cast tab; the sheet's header slicing text as it scrolls under; 20 px of dead space under the chart's numbers; 40 px lens
plates and ~34 px crumb links; a closed pool row without its episode; the compare picker framing the castaway you came from with
no way to tap it.

Questions skipped: the critique's questions go to the screenshot story (decisions.md, 2026-11-15: the user's process runs the
check once and fixes once before a single pause).

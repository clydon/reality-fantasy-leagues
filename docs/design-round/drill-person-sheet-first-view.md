# The castaway sheet and the stat's board, first view: requirements

Mode 2 derivation on [the page spec](drill-person-sheet-spec.md), at 390 × 844, building on Phase 0's app-wide
[R1–R5](phase0-first-views.md) and [step 5's](step5-cast-first-view.md). Today's frames: `.ui-atlas/stories/person-sheet/before/`
(the zt couch, Survivor 51's real castaways and photos): `cast-sheet` (from the Cast tab), `game-sheet` (Weekly Lineup's Your team),
`cast-in-game` (the Cast tab's sheet › In your games › Weekly Lineup), `outlast-sheet`, `sam-sheet` (two behind), each with its
whole sheet (`.full.jpg`) and words (`.txt`).

## The problem

Someone taps a castaway to find out about her, from wherever they are. What they get depends on where they tapped. From the Cast
tab a sheet opens on her photo, her season drawn and her numbers ranked. From a game page a sheet with the same name opens on a
gold tag and four rows of "+7.5" beside four letter tiles: no photo, no chart, no numbers (`game-sheet`). Showing the app to a
relative, the user stumbled on exactly this: the second sheet didn't read as the same thing. And the numbers that are there look
like answers but go nowhere: "Zero votes at Tribal Council · Most of anyone · 1" has no door to who else has it, or whether they're
free in your game.

## L0 · Cognitive load

**Constraint.** Working memory holds three to five chunks, and noise that isn't attended still spends it.

**Violation.** Two layouts for one person: whoever learned the Cast tab's sheet re-learns a second one inside a game, and the
second spends its first view on one fact said four times (`game-sheet`: four holder rows, each "Counted for jordan in 5
episodes · +7.5", in a game where everyone shares her). The Cast tab's numbers say each rank in a different phrase ("Most, with 1
other", "Most, with 4 others", "Most of anyone"), with "of 18" floating in the caption.

**R1.** One layout to learn. The sheet's first view holds four chunks, the same four in the same places from every way in: who
(face, group, status), the season counted (the lens and the chart as one block, its headline number in the chart's caption, not
a line of its own), In your games, and the top of Their numbers. A fact is said once: in a game everyone shares, the holders are
one line with their faces ("All four of you"), opened to rows only on a tap. A rank is one short word ("2nd", "Most", "T2"), the
"of 18" once, at the list's head.

**Citations:** Cowan (2001) for the three-to-five chunk ceiling; Hassin et al. (2009) for unattended noise spending working memory.

## L1 · First impression

**Constraint.** Appeal and meaning are judged in about 50 ms, and a face is processed first and fastest of anything on a screen.

**Violation.** The game's sheet opens without her face: its 50 ms gestalt is a column of four letter tiles, a list of people
who aren't her. Its loudest element is a filled gold tag, the same family as the app's one yellow for what's due.

**R2.** Her face anchors the first view in every context: the same photo, the same size, the same place, so the first glance says
"this is her" before a word is read. Nothing in the who block is filled: the group is a small swatch and its name. The chart is
the second element and the same visual object in both lenses (the same axis, the same columns, the same colours), so the sheet's
silhouette is identical whichever way in; only the bars' heights and the caption change.

**Citations:** Lindgaard et al. (2006) for the 50 ms judgment; Kurosu and Kashimura (1995) for appeal read as usability.

## L2 · Processing fluency

**Constraint.** What is easy to process feels true, and inconsistency across a surface erodes that, compounding.

**Violation.** One person, two sheets, each fact in two forms: "up to Ep 5" and "up to Episode 5"; the group as a dot and as a
filled tag; the chart in counts with the season's colours and in points with colours chosen per person (the same kind orange on
one sheet and lilac on the next); the story with points and without; and Outlast's sheet showing Weekly Lineup's points in its
story, a number under the wrong game's name (`outlast-sheet`). Rows that open something (In your games) and rows that don't (Their
numbers) look alike.

**R3.** One form per fact, everywhere: the header's wording, the group's swatch, a stat's colour (one for the season, in every
chart and on the board's bars), a rank's grammar, and a game's number only beside that game's name. One door mark: a row that
opens something carries the same quiet chevron at its end wherever it appears, and a row that opens nothing carries none.

**Citations:** Reber and Schwarz (1999) for ease of processing read as truth; Alter and Oppenheimer (2009) for fluency
generalising to trust and confidence.

## L3 · Perception bias

**Constraint.** People predict before they look: a match passes on autopilot, a mismatch fires attention (and reads as an error).

**Violation.** "Most of anyone · 1" reads as a ranking, and the prediction on tapping it (the ranking) is met with nothing. A
game row under In your games predicts "her, in that game", and a different-looking sheet slides over the first: the relative's
stumble is this prediction error. A holder's face predicts that person and opens nothing on the Cast tab's sheet.

**R4.** Everything that names a set or a rank opens it, and the destination's first glance confirms the prediction: a stat row
opens its board, titled with the stat's name, the castaway you came from marked and in view; a game row opens her in that game in
place (the sheet keeps its face and its title: it doesn't become another sheet); a holder opens that person. The way back is the
same everywhere: the crumb names where you came from, and Back returns there as it was.

**Citations:** Clark (2013) for predictive processing; Nisbett and Wilson (1977) for acting before reasoning.

## L4 · Decision architecture

**Constraint.** People follow the easiest trail; option density should fit the context (sparse at a decision, rich in a reference
view); show, don't describe.

**Violation.** The sweat's chain (is she good at this, who's better, are they free in my game, then claim or start) has no trail
from the sheet: the numbers end there, and the stats page's boards (from Tonight) have no holders and no doors. The casual's one
question (is she mine?) is answered by four identical rows.

**R5.** One tap a step from a fact to the game's decision: sheet › stat › board, and in a game's lens the board carries who holds
each (faces, yours first and ringed, Free where the game has one owner each), so the next decision's data is on the board. The
board is a reference view, dense on purpose (place, face, name, count, a bar on one scale, holders), with nothing to act on inside
it: claiming and starting stay in the game's own moves. The casual path ends earlier: the sheet's first view answers who, still
in, and mine without a tap.

**Citations:** Thaler and Sunstein (2008) for choice architecture; Hertwig and Erev (2009) for experience over description.

## R1–R5

1. One layout, four chunks: who, the season counted, In your games, Their numbers; each fact once.
2. Her face anchors every first view; the chart is the same object in both lenses; nothing filled in the who block.
3. One form per fact, one colour per stat for the season, one door mark (a quiet chevron) only on rows that open.
4. Every set or rank opens; its first glance confirms the tap; the crumb and Back return the same way everywhere.
5. One tap a step to the game's decision; the board is dense, holders on it in a game's lens, nothing to act on in it.

## The first views

**The sheet** (a sheet of about 743 px; under the header, top to bottom):
1. The crumb (when it's over another level), the name, "ZT Survivor · up to Ep 5".
2. Who: the photo (76 × 96) at the left; at its right the swatch and group (· position), the status ("Still in", or "Out ·
   Ep 5 · Voted out"), and a revealed role.
3. The season counted: "Counted by" with The show and each game that counts week by week (only when there is one), directly over
   the chart it changes; the chart's caption carries the headline ("5 moments so far"; in a game's lens "+7.5 so far · 3rd of
   18"). No separate points line.
4. In your games, compact: a row a game, one line of who (faces, yours first) and her number there, with the chevron.
5. Their numbers starts at or just under the fold: each stat, a short rank, the count, a chevron; "of 18" at the head.

The spec's open question (the lens on the sheet, or a game's points only in its row) is settled by R1 and R4: the lens on the sheet
keeps one chart and says the context where the points appear; the row-only form doubles the chart.

**The board** (over the sheet):
1. The crumb ("Jelly ›"), the stat's name as the title, "ZT Survivor · up to Ep 5 · 7 of 18".
2. Rows, about ten in the first view: place (T for ties), face, first name and position (or "Out · Ep 3", dimmed), a bar on one
   scale in the stat's colour, the count; in a game's lens, holders' faces at the row's end. The castaway you came from marked by
   a rule and bold, not by the lift your own rows use.
3. "None so far", then everyone without it.
4. The link to The numbers at the foot.

**Measures for the check:** the sheet's first view at most four chunks and five type sizes, her face within the first 300 px, the
chart in view without a scroll in both lenses; the board's first view at least eight rows; no words over words; a chevron on every
row that opens and on no other.

## The gap

No proposal so far defines the door mark app-wide (R3, R4): which rows show they open, how, and the rule that a row without one
opens nothing. Nor how "the castaway you came from" is marked apart from "yours" (R5): the app's lift already means yours.

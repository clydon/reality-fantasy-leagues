# The castaway sheet and the stat's board: Perception-First Design evaluation

Built frames at 390 × 844: `.ui-atlas/stories/person-sheet/after/` (the zt couch as alex, sam and riley; the real Survivor 51 at
Episode 7), against `before/`. Against [the spec](drill-person-sheet-spec.md) and [the first-view requirements](drill-person-sheet-first-view.md),
under the user's standing constraint (decisions.md, 2026-11-16: the bio, what they hold and their properties stay on this view),
which outranks them. Mode 1, run once, read-only except this file: the corpus' HTML rebuild of the top fixes was skipped as out of
proportion, and the skill's insight-log entry with it (no other file edited). `cast-sheet.tsx` and `game-sheets.tsx` were read to
confirm what a still can't show: the type sizes, the framed row's padding, the Free rule and the board's subtitle. Tailwind
utilities on the Lower Third tokens; no corpus profile applied.

## Score: 72 / 100

| Layer | Score | Why |
| --- | --- | --- |
| Foundation (L0) | 68 | One layout from every way in, a shared game's holders on one line, the board dense on purpose; but the who block (194–396 px) and the lens leave In your games cut at the fold and Their numbers under it, in eight type sizes |
| L1 first impression | 82 | Her face, the same size and place, opens every sheet; the gold tag is a swatch; the chart is one object in both lenses; the chosen lens plate is the brightest block after the face and the name |
| L2 fluency | 74 | The Ep wording, the swatch, a stat's colour across faces, lenses and boards, and the rank's grammar hold; points in two forms, a framed row off the board's rails, three small sizes within a pixel |
| L3 prediction | 64 | Every stat, holder and column opens and the board confirms the tap; but "Rank of 21" heads the count, a game row opens out of sight, and "Free", "N of M" and a link-styled legend predict what isn't there |
| L4 decisions | 76 | Sheet › stat › board a tap a step, holders on the board yours first and ringed, nothing to act on in it; "mine" sits at the fold, and "Free" in a shared game clouds "are they free?" |

(68 × 1.5 + 82 + 74 + 64 + 76) / 5.5 = 72.4. No dependency caps apply (no layer under 40, nothing critical); the 18-point spread
is the stack's own (a strong L1, an L3 carrying two majors). Closest anchor: "good". Ethics: Alignment, Sincerity and Golden Rule
pass, no urgency or pressure anywhere; "Free" in a shared game is the one Sincerity wobble (#4). Spoilers hold at sam's mark
(sam-sheet: "up to Ep 3", the idol found Ep 2 kept, the chart stops at 3).

## The standing constraint

All three stay, in every context, a game's lens included (game-sheet, outlast-sheet, stat-person, real-stat-person): the
properties ride the group line, muted ("Toka · Woman"); the billed bio line sits beside the photo and mostly fits its 96 px; the
holding is a full-width line under the photo ("Has a tethered idol · given by Kristin Flickinger Ep 7"); the billing is a muted
paragraph clamped at three lines. Placement and wording are sound: the holding is plain and prominent (Fogg 2003: what's prominent
gets interpreted), nothing is filled, and nothing else was dropped to make room. The handling is additive, though: about 110 px
more, which takes Their numbers out of the first view (the constraint outranks R1's fourth chunk, so that cost is accepted) and
cuts In your games at the fold (which it needn't), with the block's lines at near-equal weight. Finding 2 keeps all three in view
and orders them.

## Requirements

| | Met? | Evidence |
| --- | --- | --- |
| R1 one layout, four chunks, each fact once | **Partly** | One layout from every way in: cast-sheet, game-sheet, outlast-sheet, lens-game, stat-person, stats-card, sam-sheet and real-cast-sheet draw the same part in the same order (before, game-sheet had no photo, chart or numbers, and four "+7.5" rows). A shared game's holders are one line ("On every team", four faces); a rank is one word, "of 18" once. But with games the first view holds three chunks: In your games is cut at the fold and Their numbers' head is about 60 px under it (cast-sheet, game-sheet, sam-sheet); a game's points are said twice in its lens (lens-game: "+7.5 so far", "7.5") |
| R2 the face anchors; one chart object; nothing filled | **Met** | The 76 × 96 photo at the same place in every sheet: 194–290 px (cast-sheet), 221–317 px under a crumb (game-sheet, stat-person); before/game-sheet's gold TOKA tag is a 10 px swatch; lens-game against cast-sheet: the same axis, columns and colours, only the heights, the caption and the counted underline change |
| R3 one form per fact, one colour per stat, one door mark | **Partly** | "up to Ep 5" on every sheet; "3rd in the Immunity challenge" ember on Jelly and Cristian, "Zero votes at Tribal Council" orchid in Sharonda's and Jelly's real charts and on the real board's bars; a game's number only by its name (outlast-sheet's story no longer carries Weekly Lineup's points); chevrons right on rows that open a level, down on rows that open in place, none on the story. Drift: points signed and bare, "Ep 1–5", "N of M" for two facts, a legend in the link style, two frames for "you came from" (#5, #8, #9, #11) |
| R4 every set opens and confirms; one way back | **Partly** | stat-level: titled with the stat, Jelly framed at the top; real-stat-level: Sharonda framed, eighth row, in view; stat-person carries "Jelly › Zero votes at Tribal Council ›" and real-stat-person "Sharonda › …"; stat-back is the board as it was; holder-person opens alex in Weekly Lineup under "Jelly ›", Jelly in Started; chart-episode lands on Episode 2, lit. But a game row opens out of sight (cast-in-game, #3), "Rank of 21" predicts a rank the board won't show (real-cast-sheet, #1), and a column's "2" opens an episode of three lines (#6) |
| R5 a tap a step; the board dense, holders, nothing to act on | **Partly** | Sheet › stat › board one tap each; 11 to 12 rows in the board's first view; in a game's lens the holders' faces, yours first and ringed (game-stat-level); nothing to act on but the rows and the foot. But "Free" on six rows of a game everyone shares (#4), the framed row's bar short for its count (#7), and the casual's "mine" at the fold (#2) |

**The measures.** At most four chunks: met as a ceiling (three with games), R1's fourth starting about 906 px. At most five type
sizes: **not met**, eight (26, 20, 15, 14, 13, 12.5, 12, 11 px; #10). Her face within 300 px: met. The chart in view without a
scroll in both lenses: met (500–665 px in cast-sheet, 528–703 px in game-sheet). The board's first view at least eight rows: met
(11, 12, 11). No words over words: met, no overlap in any of the 18 checked frames. A chevron on every row that opens and on no
other: met for rows; the "Counted for you" legend wears the link style (#9).

## Findings (by severity)

1. **Major, L3: "Rank of 21" heads the count, not the rank (real-cast-sheet, real-stat-person; cast-sheet).** The caption is
   right-aligned, so it sits over the 20 px count and its chevron (316–374 px) while the rank is the 12.5 px muted word to their
   left (about 298 px). On the real season the two disagree: "Tribe won the Immunity challenge · T2 · 4", "Voted with the
   majority · T5 · 2", "Won the Reward challenge · T10 · 2". Read down the labelled, larger column, Sharonda is 4th, 2nd and 2nd;
   the board a tap away says T2, T5 and T10, so the destination contradicts the prediction R4 asks it to confirm (Clark 2013), on
   the sweat's own question. Before, the rank was words ("2nd most, tied"), which no one reads as a count; the short form needs its
   column named. In your games' "Points there" works because its rows carry one number.
   **Fix:** head the columns where they stand: "Rank of 21" ending over the rank word, "Times" over the count.
2. **Major, L0 · L1: the constraint is kept by addition, not by order (cast-sheet, game-sheet, sam-sheet, lens-game).** The holding
   (a full-width line, about 34 px) and the billing (three muted lines, about 75 px on Jelly) make the who block run 194–396 px;
   the lens and chart follow (421–665 px), In your games starts at 691 px with its third row at the fold (Survival Pool's "Picked
   by you" about 862 px), and Their numbers' head is at about 906 px. From a game page the crumb adds 27 px, and the row cut is
   that game's own ("On every team", your ring: game-sheet). Inside the block the bio (14 px, foreground, two lines) is set like
   the holding (15 px, foreground) and close to the status, so what's true now doesn't separate from who she is, and the billing,
   the least decision-relevant text, is a size above the bio. Losing Their numbers is the constraint's accepted cost; losing the
   casual's "mine" isn't (Cowan 2010; Fogg 2003). **Fix, all three still in view:** the bio line muted like the group line, so the
   two lit lines are the status and the holding (Wertheimer 1923, similarity); the billing at 14 px, two lines, the rest opening
   in place; "Counted by" as the lead-in on the plates' own row; from a game page or in a game's lens, that game's row first in
   In your games. About 45 px back on Jelly: In your games whole in the first view, Their numbers' head just under the fold (the
   first view's own allowance).
3. **Major, L3 · L4: In your games opens out of sight (cast-in-game).** The rows sit at 707–879 px; a tap opens four holder rows
   from about 830 px down, with no motion (the shape's choice), so the first glance after the tap is a 16 px chevron turning and
   the top of one face. R4 asks that glance to confirm the tap; a change that small at the edge of view carries little signal
   against the rest of the screen (Green & Swets 1966) and reads as nothing happening. **Fix:** on open, scroll the opened block
   into view (nearest; instant under reduced motion), as the board already does for its framed row.
4. **Minor, L3 · L4: "Free" in a game everyone can share (game-stat-level).** Weekly Lineup lets every team hold anyone (Jelly,
   Devin and Eric are on all four), yet six rows read "Free". R5 gives Free only where the game has one owner each; in a shared
   game the word predicts a scarcity the game doesn't have and makes the faced rows look taken (Pirolli & Card 1999). The board
   writes Free for anyone unheld (`HoldersMark`). **Fix:** Free only in a game with one owner each; in a shared game an unheld
   row's holders column stays empty.
5. **Minor, L3: "N of M" means two things in one drill (stat-level, real-stat-level).** On the sheet it's a rank ("+7.5 so far ·
   2nd of 18"; a player's "T2 of 4"); on the board's subtitle it's how many have the stat ("1 of 18", "19 of 21"). Opened from
   Jelly, who is 1st, "1 of 18" reads as her place (Clark 2013). **Fix:** "1 of 18 has it", "19 of 21 have it"; "N of M" stays
   the rank's form.
6. **Minor, L3: a column's number and its episode disagree (chart-episode, cast-sheet, real-cast-sheet).** The chart counts the
   stats' moments; the story also lists what they came to hold. Jelly's column 2 says 2 and opens Episode 2 with three lines
   ("Found a hidden immunity idol"); "5 moments so far" heads six story lines; Sharonda's column 7 says 2 over "Was given a
   tethered idol" and two more. The round made the column a door, so the mismatch is met on arrival (Clark 2013). **Fix:** make
   the count and the rows agree: a holding line counts as a moment, or it's drawn apart in the story (muted, in the holding's own
   wording) so the caption's number matches the rows it heads.
7. **Minor, L2: the framed row leaves the board's rails (real-stat-level, stat-level, game-stat-level).** The frame adds 6 px of
   padding each side, so the castaway you came from has her place, face, name, count and chevron 6 px off every other row's
   column, and her bar, on the board's one scale, is 6 px shorter than an equal count's (Sharonda's 3 under Thien's 3). A near
   miss on the one row the board opens to show (Learning #16; Wertheimer 1923). **Fix:** the frame without moving the content:
   every board row takes the same 6 px inset, or the outline is drawn over an unchanged row.
8. **Minor, L2: two forms for one fact (lens-game, game-sheet, compare-versus).** A game's points are signed in the chart's
   caption, the holder rows and the story ("+7.5") and bare in In your games ("7.5"), and in a game's lens both are in one view;
   the range is "up to Ep 5" on every sheet and "Ep 1–5" on Side by side (Reber & Schwarz 1999). **Fix:** points signed
   everywhere; in a game's lens that game's In your games row drops its number (the caption above carries it); Side by side's
   subtitle "ZT Survivor · up to Ep 5".
9. **Minor, L3: the legend wears the link style (game-sheet, lens-game).** "Counted for you" is 13 px semibold, foreground and
   underlined, exactly the crumb's link ("Weekly Lineup ›" above it), and the underline it explains is the link mark on the
   episode numbers, though every column opens the story, underlined or not (Clark 2013). **Fix:** the legend in the key's muted
   13 px, a sample underlined "1" before "counted for you".
10. **Minor, L0 · L2: eight type sizes in the first view, three within a pixel (cast-sheet, and every sheet).** 26, 20, 15, 14,
    13, 12.5, 12 and 11 px against the measure's five; the muted labels alone use 12 ("Counted by"), 12.5 ("Points there", "Rank
    of 18") and 13 (the chart's caption and key, the game lines). Sizes that close read as drift, not a step (practitioner
    observation: Learning #16's near miss, carried from colour to size). **Fix:** one small muted size, 13 px, for every label and
    line on the sheet; that leaves six, and the last merge (the 14 px captions or the bio) is Impeccable's.
11. **Cosmetic, L2: "you came from" is framed two ways (compare-pick against stat-level).** The wall marks Jelly with a 2 px
    outline set off the tile, the board with a 1 px inset; and the wall's framed face is a dead tap with a press state (it can't
    be picked). **Fix:** the board's frame on both, and the framed face drawn without a press state.

Noted, not ranked:
- **The chart's colours.** A stat keeps one colour for the season (R3), and the colours go to the season's three most frequent
  stats. On the fixture that leaves Jelly's chart one colour, on her least distinctive moment ("3rd in the Immunity challenge"),
  with her immunity win and her idol in "Everything else" (cast-sheet); on the real season the same rule colours 9 of Sharonda's
  14 moments and is the "bit of beauty" the user named (real-cast-sheet). PFD's own requirements pull both ways here (one colour
  per stat; the pop-out on what's distinctive), so if it matters it's a named choice for the user: the season's colours
  everywhere, or a person's own top kinds on their chart with the board keeping the season's.
- **The chosen lens.** The selected plate's bone fill (cast-sheet, 436–475 px) is the largest bright block in the first view after
  the face and the name, ahead of "Still in" and the chart. It's the app's selected state everywhere (step 8 noted the same), so
  Impeccable's call.

## Top three fixes

1. **Head Their numbers' columns (#1).** L3, about +4: one line of layout, and the only misread of the sweat's own question goes.
2. **Order the who block and keep In your games whole in the first view (#2, #3).** L0 about +5, L1 +2, L3 +3, L4 +3: the bio
   quiet, the billing at two lines, the lens label on the plates' row, the game you came from first, an opened row scrolled into
   view.
3. **One form per fact, one mark per meaning (#4, #5, #6, #8, #9).** L2 about +3, L3 +4: each is small; together they're the drill
   reading as one mind made it.

*Initial findings. Ralph Loop a layer score, cite further, switch to solve / analyze, or ask any follow-up to dig deeper.*

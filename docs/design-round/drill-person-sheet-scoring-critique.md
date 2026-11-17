# The castaway sheet scored by the show: Impeccable critique (built frames, 390 px)

Method: dual-agent (A: an unanchored design review of the code and frames, which saw neither the detector nor PFD's evaluation;
B: the detector's CLI scan, the frames' overlap reports, computed contrast and the code's geometry). No browser overlay: this check
judges the frames already shot (`.ui-atlas/stories/person-sheet/score/`, against `before/`). Source: `src/new/show/cast-sheet.tsx`
under "score" / "score-red", tokens in `src/app/(new)/new.css`. The fx frames predate the last source edit, so every finding was
checked against the code. Snapshot not persisted (this check writes one file); the last run on this file scored 27/40.

## Heuristic scores

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 3 | "up to Ep N" on every level; an open row shows only by its turned chevron |
| 2 | Match with the real world | 3 | The show's own words throughout, but the Sole Survivor "went home", in red |
| 3 | User control and freedom | 3 | Rows open and close in place; from a game page four identical holder rows open by default |
| 4 | Consistency and standards | 3 | One class code everywhere; four rank forms; holders indented, See everyone not; Studio gets Night hexes |
| 5 | Error prevention | 2 | Misreadings built in: a column's number counts what hangs under it; each sheet on its own scale |
| 6 | Recognition rather than recall | 3 | Key, worths and episode numbers stay in view; a teal slice's kinds take opening rows one by one |
| 7 | Flexibility and efficiency | 3 | Rows open side by side, a column jumps to the story; "is she free?" is a third tap |
| 8 | Aesthetic and minimalist design | 3 | Calm and rationed, but grey carries about 70% of the chart's ink and "out" is said three times |
| 9 | Error recovery | 2 | A failed stats read still pulses forever, no message or retry (`CastSheetBody` 1172, `CastLevel` 327) |
| 10 | Help and documentation | 3 | The fixed key and "+2 each" teach the code in place; nothing says the worths are the show's |
| **Total** | | **28/40** | Good, at the low end. Cognitive load: 2 of 8 fail (one list of up to 11 rows; no clear first mark) |

## Design specificity

The value code is this product's own (classes from the show's rulebook, setbacks hanging under the line, the show's words on every
row). The anatomy is a stats app's player card (photo and bio, a stacked column chart with a legend, an accordion table), and Lower
Third's loud layer, a plate or a tag, appears nowhere, not even for out or won (finding 9). **Detector:** 0 primary, 36 advisories;
the 16 in the scored parts are font sizes DESIGN.md's prose already uses (false positives, but for the figure's 28 px: finding 14).
**Overlaps:** all 20 frames empty, but that checks text against text in the first 844 px only; at full size the rest has none either.

## What's working

1. One code, really one: the same 4 × 12 mark leads the key, every numbers row and every story moment; Their numbers reads as runs.
2. One episode geometry: chart, game weeks, kind strips and figure share `fitW` and one centre formula (within 0.5 px at 5, 7, 30).
3. Setbacks coded twice (under the line, Ember at 6.1:1), red kept for leaving, a one-line key, ⌄ and › used exactly as ruled.

## Findings, most severe first

1. **[P1] The winner is drawn as eliminated.** `real-savannah`: the Sole Survivor's key says "Ep 13: went home" in Live Red, her
   axis 13 is red and her photo greyed. Fix: for a finalist the note says how she finished, in `--good` ("Ep 13: sole survivor"),
   the axis number takes `--good`, the face keeps its colour; `--live` stays for exits (`ScoredChart` 335, `Columns` 151, `Who` 1051).
2. **[P2] A column's number disagrees with its bar.** It counts the setbacks but sits on the up-bar: `real-sharonda` Ep 5 "2" over
   one moment (as tall as Ep 1's "1"), Ep 6 "3" over two; `real-savannah` Ep 1 "3" over two. Fix: the up count over the up-bar, the
   setbacks' count under the Ember bar, `under`'s room kept whenever a column has one (`ScoredChart` 315, `Columns` 115, 138).
3. **[P2] Grey carries the glance.** 10 of Sharonda's 14 marks are grey, the winner's chart is as grey, and every bar's top edge is
   grey, so "doing well?" reads alike for everyone. Fix: the small class at half the bar's width (12 px, centred), so teal and Ember
   are the solid marks; heights and counts unchanged (`Columns` 136, the scored chart only).
4. **[P2] Each sheet is on its own scale.** `top` is this castaway's busiest night (`Columns` 105–107): Ada's one +1 fills her chart
   (`riley-traitors`) as Savannah's six-moment night fills hers. Fix: scale every sheet to the season's busiest episode (the max
   over `d.cast` of one night's up and setback counts), so flipping between faces compares.
5. **[P2] On the board, the castaway you came from is drawn 12 px short.** `real-stat-level`: Sharonda's "2" and › sit 12 px left of
   the column and her bar for 2 is shorter than Jelly's 2: `w-full` beats `w-[calc(100%+12px)]`. Fix: `w-full` only when the row
   isn't `from` (`BoardRow` 1283).
6. **[P2] The worths aren't said to be the show's (R4).** Caption: "Most valuable first · of 21"; in a game whose maker changed the
   points, "+4 each" contradicts that game's row above it. Fix: caption right "By the show's points"; "of 21" moves into the ranks.
7. **[P2] From a game page, Andrew's number misses the measure.** `fx/game-sheet`: "+7.5" at 631–644 px (measure: above 600;
   production said "7.5 pts in this game" at 225 px); a longer Who or a figure pushes it lower. Fix: from a game, the subtitle
   carries it: "ZT Survivor · up to Ep 5 · +7.5 in Weekly Lineup" (the header is outside the brief's scope: the user's call).
8. **[P2] The classes are silent to a screen reader.** The chart says "Ep 5: 2", every `ClassMark` is `aria-hidden`, the story shows
   no worth. Fix: per episode "Ep 5: 1 small moment, 1 setback" (`ScoredChart` 319) and sr-only class words in `ClassMark`.
9. **[P2] No broadcast graphic where the moment matters.** `real-xavier` says "out" three times in text (Who, the red 3, the key's
   red line); nothing on the sheet is a tag. Fix: the key's note becomes a live caption tag "OUT · EP 3" (good: "SOLE SURVIVOR").
10. **[P2] "See everyone ›" reads as the next row.** `real-sharonda-open`: flush left under a full-width hairline, 14 px semibold
    (heavier than the names), where game holders indent 12 px. Fix: indent it to the name's column (`pl-3`, hairline from there),
    14 px regular, its accessible name naming the stat ("See everyone: Won the Reward challenge") (`KindStrip` 442).
11. **[P2] Studio gets Night's hard-coded colours.** The figure's Bone bars (#cfc8bb) are 1.56:1 on the Studio panel; a game's weeks
    use games.ts hexes (Outlast 2.47:1, Survival Pool 2.37:1). Fix: `--nd-amount` (Night #cfc8bb, Studio #7d7566 at 4.3:1) and
    Studio twins for the game colours (`ONE_TONE` 229, `GameWeeks` 398).
12. **[P3] Columns from a hard-coded 358.** 30 episodes end 28 px short of the key (`fx-30`), doors 11 px wide; a 360 px phone clips
    a 7-episode chart. Fix: measure the section, `colW = width / n` unfloored for all four parts, no doors under 24 px (`fitW` 294).
13. **[P3] Four rank forms.** "2nd of 18", "T9 of 18", "10th most, tied with 4", "T10"; the long one widens the right column and
    pushes names onto a second line. Fix: one form, "10th of 21 · 5 tied" (`rankWords` 780, `Figures` 370).
14. **[P3] The figure outranks her name.** `fx-amount`: "7,550" in 28 px under a 26 px name (R2: smaller). Fix: 22 px (`Figures` 366).
15. **[P3] A kind's strip.** Its count is `--card` ink inside the dot, 3.4:1 on the grey (no ink reaches 4.5:1 on #75708a), and its
    "didn't" ticks are the small class's own grey. Fix: the count over the dot in 11 px muted; no ticks (`KindStrip` 421–431).

**Ember or Live Red** (the spec's open question): keep Ember. In "score-red" setbacks share `--live` with the went-home note and the
red axis number (Savannah: red at 1 and 12 for setbacks, 13 for leaving); Ember is also brighter on the panel (6.1:1 against 4.8:1).

## Persona red flags

- **Joanna:** the winner "went home"; one small moment fills Ada's chart; a "2" over a one-moment bar.
- **Andrew:** from a game, "+7.5" at 631 px (production: 225); Outlast's "T1 of 18" is true of everyone still in.
- **Conor:** "See everyone" looks like the next row; "+4 each" may not be his game's; his castaway's equal count drawn shorter.
- **Sam:** "Ep 5: 2" with no classes; 11 px counts at 3.4:1 in grey dots; 11 px column doors at 30 episodes.

## Minor observations

"Counted for you every episode" over "You · Counted for you in 5 episodes"; "On riley's team" twice in Outlast's open row; four
identical holder rows (+7.5) open by default push Outlast and the Pool ~320 px down; the column doors have no visible affordance;
the fixed key lists Setbacks on The Traitors, whose rulebook has none; Won the Reward is teal on S51 (+2), grey on S49 (+1); the
chart head's `mt-4` against the captions' `mt-5`; 8 px initials in the game rows' 18 px faces; the crumb's › is a separator.

Questions skipped: they go to the screenshot story (DESIGN-PROCESS.md: one check, one batch of fixes, then the pause). For the user:
finding 7 (the header), finding 9 (the tag) and Ember or Live Red.

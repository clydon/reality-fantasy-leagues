# Players / Cast, first view: requirements (step 5)

Mode 2 derivation on [the page spec](step5-cast-spec.md), at 390 × 844, building on Phase 0's app-wide
[R1–R5](phase0-first-views.md) and step 4's [Episodes requirements](step4-episodes-first-view.md). Today's frames:
`.ui-atlas/stories/step5-cast/before/` (the zt couch with real photos and art: `cast-alex`, `cast-sheet`, `watchonly-riley-cast`;
the bench: `bench/show-results`, `bench/nfl-real-pool-due` at 344 athletes), each with its measures in the `.json` beside it.

## The problem

Someone opens the cast tab to put a face to a name, see who's left, or find who's done the most of something. Today the first
view for Alex puts four controls and a slider (Faces / Rank / By episode, an episode range, a Show dropdown) between the tab and
the first face, so one and a half faces are visible. Every tile carries a game's points ("7.5 pts"), and Riley, who watches The
Traitors with no game, sees "3 pts" under faces with nothing to say whose points they are. A castaway's sheet is a text column of
moments with points beside each. At a sport's size the same tab is 344 photo tiles with no search.

## L0 · Cognitive load

**Constraint.** Working memory holds three to five chunks, and noise that isn't attended still spends it.

**Violation.** `cast-alex`: 18 controls in the first view, 9 type sizes, a range slider whose two thumbs set nothing the faces
show. "Your team" tags sit on 9 of 18 faces, a second label system over the photos. `watchonly-riley-cast`: 21 controls in view
for a person with nothing to choose between. `cast-sheet`: 128 words in the first view, each moment a row with a number.

**R1.** The cast tab's first view holds four chunks at most: the show and your place (the bar with the compact control), what's
yours to set (the strip), and the cast itself, grouped by tribe (the group labels are the chunks' handles, not extra chunks). No
control before the first face: the range, the sort, the lens and Compare live with the table, below the faces. A tile is a face
and at most two short lines; no number on a tile. At most five type sizes and 40 words above the fold, names aside. The person
sheet's first view is who they are and their weekly graph: two chunks.

**Citations:** Cowan (2001) for the three-to-five chunk ceiling; Hassin et al. (2009) for unattended noise spending working
memory.

## L1 · First impression

**Constraint.** Appeal and meaning are judged in about 50 ms, and faces are processed first and fastest of anything on a screen.

**Violation.** The cast's photos are the tab's best asset (real castaways, real light), but the first 50 ms lands on a white
segmented control and a slider. At 3 tiles a row a face is 110 px wide, so the first view holds four faces of eighteen: the
"who's left" glance needs two screens of scrolling. At a sport's size, faces lead where there are too many to recognise, and a
team's logo stands in as a person.

**R2.** On a competition show the faces are the first and largest element under the strip, dense enough that most of the cast
is in the first view (about 12 to 16 faces), grouped by tribe in the tribe's own colour; who's out is visibly out (dimmed, at
the foot, in boot order). On a sport the first element is the way in, search and positions, then rows; a face is a small mark
on a row, never a tile. The person sheet opens on their face and their season drawn, not a list.

**Citations:** Lindgaard et al. (2006) for the 50 ms judgment; Kurosu and Kashimura (1995) for appeal read as usability.

## L2 · Processing fluency

**Constraint.** What is easy to process feels true, and inconsistency across one surface erodes that.

**Violation.** "7.5 pts" on a face reads as the show's fact; it is Weekly Lineup's, and for Riley it is the rulebook's
suggestion, which no game counts. The same person is "Jelly · 7.5 pts" on Cast, "+5" in her story's Episode 2, and another
number on the game page. A castaway opens a story sheet on Cast and a different cast sheet on the game page. Rank says "Points as
Lineup League counts them" in 12 px under a control labelled "Ranked by".

**R3.** One meaning, one form. The show's tab says only the show's facts: counts by the rulebook's own names, still in or out,
tribe. A game's points appear only under that game's name, chosen. A person is one sheet from everywhere, opening at the context
you came from. Counts are numbers in the number face, aligned; a zero is a quiet mark, not a "0". Tribe colours match the game
page's tags.

**Citations:** Reber and Schwarz (1999) for fluency read as truth; Alter and Oppenheimer (2009) for disfluency signalling error.

## L3 · Prediction

**Constraint.** People act on what they expect from a label; a surface that breaks its entry's promise costs a re-read.

**Violation.** The tab is called Castaways and opens on controls. "Faces" is a mode you're already in. Compare two turns every
face into a selector without a visible change of state beyond a pill. A sort by points predicts the show's points; there are
none. On a sport, "Still in · 344" predicts eliminations a sport doesn't have.

**R4.** The tab's name is met in its first view: people, by the show's own grouping (tribes; a sport's positions). The table's
head says what it counts ("Counted by · The show"), and the alternative is named where it is chosen; choosing a game puts its
name in the table's head and changes nothing above it. A face always opens their sheet; Compare starts from a sheet and says it
("Compare Jelly with…"). Words follow the flavor: no "Still in" on a sport.

**Citations:** Clark (2013) for prediction error drawing attention; Bar (2007) for gist matched to expectation.

## L4 · Decision

**Constraint.** A decision costs effort in proportion to its options and their ambiguity; but in a reference or expert surface,
cutting options harms the expert.

**Violation.** The tab's one casual decision (whose face to tap) waits behind four. The sweat's decision (who's done the most of
X) offers one stat at a time with a second "beside it", so comparing three stats is three sorts.

**R5.** Two layers, each with its own density: the surface offers one decision (tap a face); the table is the expert palette,
dense on purpose: every stat a column at once, any column a tap to sort, the range and the lens beside it. The default lens is
the show. The sheet's one action is Compare; In your games opens a game's view of the same person.

**Citations:** Iyengar and Lepper (2000) for choice overload at a decision point; Johnson and Goldstein (2003) for defaults
carrying decisions.

## R1–R5

- **R1** Four chunks; no control above the first face; no number on a tile; ≤5 sizes, ≤40 words above the fold; the sheet
  opens on who and the graph.
- **R2** Faces first and dense (12 to 16 in view) by tribe colour, out ones dimmed at the foot; on a sport, search and positions
  first, rows not tiles; the sheet opens on a face and a drawn season.
- **R3** Only the show's facts on the show's tab; a game's points only under its chosen name; one person sheet; counts aligned.
- **R4** People first meets the tab's name; the table's head names its lens; a face always opens the sheet; flavor words.
- **R5** One decision on the surface; the table is the dense expert layer; the show is the default lens.

## The solution these require

- **Cast:** the compact bar and the strip; then each tribe's caption in its colour with its count and its faces four to a row
  (a name each, no numbers, no team tags); then Out, dimmed, newest first, "Ep 5 · Voted out". Below the faces, **The numbers**:
  its head "Counted by · The show" (a game's name when chosen), the episode range, the one pattern, then the table (a sticky name
  column, a column per stat, sorted by a tap on its head, zeros quiet).
- **The person sheet:** face, name, tribe, state; the weekly graph of what they did, stacked by kind; their numbers with where
  each ranks; In your games; their story without points; Compare with…
- **A sport:** search and position chips under the strip, then rows (face mark, name, position, team, their line so far), 40 at
  a time.

## Tested against today, and against the spec

| | R1 | R2 | R3 | R4 | R5 |
| --- | --- | --- | --- | --- | --- |
| Cast today | fails: 18 controls, four before the first face | partly: real photos, but four in view | fails: a game's points on every tile | fails: opens on controls | fails: one stat at a time |
| The cast sheet today | fails: 128 words of moments | fails: a text column | fails: points per moment | passes | passes |
| A sport today | fails | fails: 344 tiles | fails: "Still in" | fails | fails: no search |
| The spec | passes | passes | passes | passes | passes |

## The gap

Nothing today draws what a cast member did week by week in the show's own terms (the game page's chart draws one game's points);
the show lens's weekly graph is new. What no design here closes: a story show's people (no tribes, nobody out) need their own
grouping, step 11.

> *Initial findings. Ralph Loop a requirement, cite further, switch to analyze / evaluate, or ask any follow-up to dig deeper.*

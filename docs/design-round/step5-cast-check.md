# Players / Cast: the check (step 5)

The built pages at 390 × 844, judged once by each skill on real renders: `.ui-atlas/stories/step5-cast/after/` (the zt couch
with real photos and art: cast-alex, cast-numbers, cast-lens, cast-sheet, cast-sheet-more, cast-compare, cast-game-sheet,
watchonly-riley-cast, watchonly-riley-cast-sheet) and `after/bench/` (show-results, show-behind, xw-waivers-open, staged-merged
on Survivor 51's real cast; nfl-real-pool-due at 344 athletes and real-nfl-game-final for the sports check), each with its flows
(numbers, lens, person).

## PFD evaluate

Context: a show's people tab, a reference surface for watchers and players alike; the job is "who's left, what has each done,
and their season" with the show's facts only, a game's points only when chosen (step5-cast-spec.md). Design system: the app's
own Lower Third tokens on Tailwind 4.

| Layer | Score | Against |
| --- | --- | --- |
| L0 Cognitive load | 78 | R1: three chunks in Alex's first view (bar with the compact control, the strip, the wall); no control before the first face (four before); 55 words with twelve names and the tab bar (35 without); 8 type sizes counting the bar and the tab bar against 5 |
| L1 First impression | 86 | R2: 12 faces of 18 in the first view (4 before), grouped by tribe; out faces greyed at the foot in boot order; the sport opens on search and positions, rows not tiles; the sheet opens on the face and the drawn season |
| L2 Fluency | 72 | R3: no game's points on the tab (Riley's "3 pts" gone); one person sheet. Two exceptions below |
| L3 Prediction | 82 | R4: the tab opens on people; "Counted by · The show" names the lens and the alternative; a face always opens the sheet; Compare says who it starts from |
| L4 Decision | 74 | R5: one decision on the surface (a face); the table every stat at once. Its default sort opens on a sparse column (below) |

Overall (Foundation weighted 1.5): 78.

**Findings**

1. **Major, L4/R5.** The numbers open sorted by the rulebook's first stat ("Won the Reward challenge"), with the columns in the
   rulebook's order: the first view of the table is two numbers among thirty dots (`cast-numbers`), and the stats people did most
   sit off to the right. Fix: columns ordered by how many people have each (the fullest first), sorted by the first; `?rank=`
   and a pattern still pick their own. *Iyengar and Lepper (2000): a default carries the decision; an empty default reads as
   nothing here.*
2. **Major, L2/R3.** A tribe is a small square beside its name on the wall and a filled tag in the person sheet (`cast-sheet`:
   Toka's gold fill reads as the one yellow that means "due for you"). Fix: the sheet says the tribe the way the wall does, a
   square and the name. *Reber and Schwarz (1999): one form per fact; Alter and Oppenheimer (2009): a second form costs a re-read.*
3. **Major, L2/R3.** In your games opens a game's own sheet for them (step 2b's), and in Outlast it says "6 pts in this game"
   over a chart "+7.5 so far" (`cast-game-sheet`): the chart is drawn from the stats read, whose points are another game's
   (Weekly Lineup's) when the couch has one. Fix: that chart only where the stats' points are this game's. *Reber and Schwarz
   (1999).*
4. **Minor, L0.** Three controls stand between the numbers' heading and the first row (the lens, the range, the pattern). Accept:
   it is the expert layer (R5), and each is used there.
5. **Minor, L1.** The sports rows carry no "so far" line on the bench's worlds (no box-score lines reach their roster), and a
   finished real game's athlete says "No games of theirs you've seen yet". A fixture gap, not the design's; listed.

Ethics: nothing hustles. No game's points are shown as the show's; a game's numbers appear only under the game's name, chosen.

## Impeccable critique

A design review of the renders and source by a sub-agent that saw neither PFD's findings nor this session's reasoning (it ran
both of the critique's assessments in one context, not two), and the detector on cast.tsx.

Design health 26/40 (visibility 3, real-world match 3, control 3, consistency 2, error prevention 3, recognition 2, flexibility
3, minimalism 3, recovery 2, help 2). Strengths: the face wall wins the first view (about 12 faces, no control above them); the
show's tab is the show's facts only (Riley's "3 pts" gone; "Their role stays secret until they leave"); the person sheet's
drawn season, numbers and In your games.

Detector: 23 advisory findings, exit 0, all sizes off DESIGN.md's ramp (14 px ×16, 12 px ×4, 20 px ×2, 17 px ×1): app-wide drift,
as in steps 3 and 4.

**Priority issues, merged with the PFD findings**

1. The game sheet opened from In your games said "6 pts in this game" over a chart "+7.5 so far" (PFD 3; the review's first).
2. The chart's colours meant a different stat on each person (orange was Jelly's idol and Brady's votes): a key learned on one
   face broke on the next (the review's second).
3. The numbers opened on a sparse column with the rulebook's order, three of seventeen columns visible with no cue there were
   more, and the two-thumb slider the heaviest thing in the section (PFD 1; the review's third).
4. With a game chosen nothing at the table's head named it, and the game table looks unlike the show's (centred names, "0" for
   none, filled chips) (the review's fourth).
5. The sports list put the lens above the search, and the athlete's sheet said "No games of theirs" twice around a placeholder
   that looked broken (the review's fifth).
6. The tribe as a gold fill in the sheet, a second yellow (PFD 2; the review's minor); table rows reachable only by a click on
   the row (the review's minor).

**The user, during the check:** "we need positions: NFL WR, QB etc. Survivor tribes. Below Deck interior/chief stew, second stew
etc." Sports had them (chips, rows, the athlete's sheet) and Survivor its tribes; a crew's role had no way onto the tab.

## The one batch

- The game's own sheet draws its chart only where the stats' points are that game's; its story loses the repeated photo.
- One colour per stat for the whole season (the season's three most frequent stats; grey for the rest), on every person's chart.
- The table's columns ordered by how many people have each, sorted by the first; "17 stats · scroll for more" over it and a
  fade at its right edge; the episode range folded to "Episodes 1–5 · Change" until asked for.
- A game chosen: "Points as Weekly Lineup counts them, and who holds each" at the table's head; a sports game named by its
  type's name ("Weekly Lineup", not "active-roster").
- Sports: search and positions first, the lens under them; the athlete's sheet says the empty state once.
- The sheet says the tribe as the wall does (a square and its name), not a filled tag; a tie says how many ("Most, with 4
  others"); a table row's name is a button.
- **Positions and roles:** what each person does (`season_cast.role`) rides on the stats read (season-stats.ts `position`)
  and shows under their name on the wall, in the table and in the sheet: a crew's "Chief stew" under Interior, a sport's "WR".
  `scripts/dev-test/crew-fixture.js` (ZT Yacht, a crew by department) shows it; no real TV show's cast records a crew role yet.

Not changed, with why: the game table's own look (step 2c's part: centred names, "0", its chips) and the game page's cast sheet
(step 2b's: its story in the stats' points, its tribe tag) wait for their ripple; the type-ramp drift is app-wide.

## The confirming look

All frames re-rendered (`after/`, `after/bench/` with the numbers, lens and person flows): no words over words; one yellow at most
in each view. Holding: the wall, the numbers opening on the fullest stat, the lens named at the table's head, the sheet's tribe and
role read as on the wall, the crew by department with roles, and 344 athletes behind search and positions. Still seen, left open:
the game page's cast sheet's story in the stats' points and its tribe tag (step 2b ripple); the game table's own look (step 2c
ripple); one colour per stat leaves a person whose moments sit outside the season's top three mostly grey; the sports rows'
"so far" line unproven (the bench writes no box-score lines to the roster); no TV cast records its properties yet (BACKLOG 89, cast properties).

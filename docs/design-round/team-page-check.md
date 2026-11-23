# A team's page (sports-couch B2): the check and its one batch (step 4)

The built page at 390 (story-team-page.js's frames in `.ui-atlas/stories/team-page/after/`: the stand-in's gameday, midweek,
hidden, daily, off, solo, studio and failed worlds, and real ESPN schedules for the Eagles, the Knicks and the Yankees), checked
once by each of PFD's `evaluate` (against [team-page-first-view.md](team-page-first-view.md)'s R1–R5) and Impeccable's `critique`
(a design review and the detector, run apart). Every finding below was fixed in one batch, or is listed as open.

## PFD evaluate (once)

Layer scores (0–100, the rubric's full range): Foundation 74 · L1 first impression 84 · L2 fluency 82 · L3 prediction 70 ·
L4 decision 80. Read through the corpus's rubric and anti-patterns; the step that rebuilds fixes as HTML in the plugin's own
folder was skipped (the fixes go into the page itself, below).

| # | Severity | Layer, requirement | Finding | Fix |
| --- | --- | --- | --- | --- |
| P1 | Major | Foundation, R1 | A daily sport's Start a game on draws the next game, the season and four series (real MLB: six rows, 380 px), so the schedule starts at 1,010 px, two screens down, and five starts compete beside the one yellow (real-mlb). | At most one series row, the next one (the schedule's runs carry Start a game on it for the rest). |
| P2 | Major | L3, R4 | A team with no games listed (the stand-in's off-season) shows three empty sections: a "The season" heading over a bare baseline, a List · Month switch over nothing, and "No games against them this season", which is false (no filter is on) (off). | No games: one line, and no season or schedule block. "No games against them" only under a filter. |
| P3 | Minor | L1, R2 | Play the next game's line wraps to two lines on football ("…vs Giants · tells the / couch") when the game is more than a week away (dayOf's "Sun, Nov 29"), so the plate grows 20 px in the first view (gameday, hidden). | Kept as A1/B1's approved words; listed as open (the wrap is the date's length, not new here). |
| P4 | Minor | L2, R3 | The record shows twice in football's first view: on the plate's line and on the bug before kickoff ("3-7" beside "EAGLES": the scorebug's own, approved in A1) (real-nfl). | Kept: the bug's grammar is the point of R3; the plate's is the page's subject. Open for the user only if it bothers them. |
| P5 | Minor | Foundation, R1 | Football's first view holds five groups: Start a game on's two rows fit whole under the season (605–732 px of 844). R1 asked for four; the first-view doc's gap allowed either if nothing is cut. | Passes the gap's condition (nothing cut); kept. |
| P6 | Minor | L2 | The season strip's month labels drop one where two fall close (real MLB's April under March) — seen before the unbegun-season fix took the strip out there. | Labels kept at a 30 px minimum spacing; listed. |

Passes: the team's name is the first and largest thing (R2: the before's "A TEAM" gone); one yellow on every frame (the story
script counts it); the live red only on the live bug and the live row; hidden holds every result before drawing (hidden: the plate
says the league alone, the bug Started with its eye, the season one held row, rows "Played"); the schedule opens on the current
month with Earlier folded and counted (R4); the bye is a named row and a gap in the strip; Against sits in the schedule's head with
All chosen (R5); Month view's home fill and away outline make a road trip read as a run.

## Impeccable critique (once: a design review and the detector, run apart)

**Design review** (Assessment A, its own agent): specific to the product, "mostly earned" (the plate and tag, the shared bug, one
yellow, live red only on the live bug and the Today row, Earlier folded and counted, the bye in the strip). Nielsen: status 3,
real world 3, control 3, consistency 3, error prevention 4, recognition 2, efficiency 2, minimalism 3, recovery 3, help 2.

**Detector** (Assessment B, its own agent): exit 0, 27 advisory `design-system-font-size` notes (14, 12, 10, 18 and 28 px off
DESIGN.md's ramp); no anti-pattern hit. The codebase's sizes are arbitrary by habit, so all but the two 10 px uses are false
positives. Its scan of the frames' words: no overlaps, no "undefined"/"NaN", and four real things (C3–C5 and C8 below).

| # | Severity | Finding | Fix (one batch) |
| --- | --- | --- | --- |
| C1 | Major | Start a game on grows without limit on a daily sport (six rows on real MLB) (A, with PFD's P1). | One series row, and only when it starts within two weeks (real NBA offered one four months off). |
| C2 | Major | The follow line repeats the bar: "✓ Following" and "You follow them: their games lead your guide" (A). | Your follow alone draws no sentence (the faces stay); the line names the others when there are any. |
| C3 | Major | ESPN's unset times show as "12:00 AM" (14 on real MLB, an NFL flex game) (B). | A game listed at midnight Eastern says "TBD" in its row and "time to be set" on Play. |
| C4 | Major | After Show the season, the game on now's row showed "Live 14–10" while the bug above still said Started (B). | Show the season shows games that are over; a game on now keeps its own ask on its row, as on the bug. |
| C5 | Minor | The season strip's month labels dropped the month with the season in it (real NBA's November) (B). | A close pair keeps the later month. |
| C6 | Minor | Play's line wrapped to two lines and led with the date (A, with PFD's P3). | "Pick'em vs Giants · Nov 29 4:25 PM · tells the couch": the game first, the date short. |
| C7 | Minor | Month view: the legend sat under the grid, a season's first month opened on three empty weeks, W/L and dates at 10 px (A, B). | The legend under the month's name; the grid starts at the first game's week; 11 px. |
| C8 | Minor | The strip's words stretched with the SVG on a wider screen; Studio's loss bars at half strength fell under 3:1; the game on now was a faint tick (A). | Labels and BYE as HTML placed by percentage; losses at 70%; a live dot over the game on now. |
| C9 | Minor | "On now" / "Next game" in sentence case beside the page's caps headings (A). | The page's caption voice, as Scores' day headings. |

**Kept, with the reason** (the process's rules: each skill wins only inside its own question):
- **The strip's bars aren't tapped** (A: the tinkerer can't open a game from a bar): a football bar is narrower than a 24 px target
  and touches its neighbours, a daily sport's 2 px; the schedule under it opens every game (the shape's call, inside Impeccable's
  question). Open for the user.
- **A 162-game strip is dense** (A: "noise"): it's the season's shape, read not counted; a rolling window would hide the season
  the strip exists to show. Open.
- **The couch's faces on the bug ("Z")**, the bug's records before kickoff, its hyphenated records and "8:20PM": the scorebug's own,
  approved in A1 and B1; not changed on one page.
- **The game's sheet** ("A GAME", "It's over."): B4 redesigns it as the Play sheet; listed there.
- **"tells the couch"** stays: the start's approved words (U1); the critique's "insider words" note goes to B4's Play sheet.
- **The Studio theme keeps a dark bar**: the league bar's rule, Night in both themes.

## The confirming look

One re-shoot of every frame after the batch: all 19 shots pass, one yellow on each, no overlapping words, no "12:00 AM". It showed
one regression from the batch (C2 left your face alone with no words when only you follow), so the line is "You follow them"
(short; the long tail stays gone), and the frames were shot once more. check-sports-couch.js: 128 passes, no failures; it now runs
through the team page into Start a game's gallery and stops at a later, stale step (the gallery has no "rest of the season" length
for a one-game start: BACKLOG 252). `npm test`: 2,599 pass. tsc clean; ESLint clean on the app files.

## After the user's call on the rows (2026-11-22)

The rows stay the one-team form (decisions.md) and carry the couch: a rival's face and name, your game's controller and due dot, and
the room's talk count into its thread. Built in `SchedRow`; the story's gameday world seeds a Pick'em on the Eagles' next game and
three messages in the game on now's thread. Re-shot every frame; tsc and ESLint clean.

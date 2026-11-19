# A show's games when short games are frequent, first view: requirements (Round 3)

Mode 2 derivation on [the page spec](round3-short-games-spec.md), at 390 × 844. It builds on Phase 0's app-wide
[R1–R5](phase0-first-views.md) and step 6's [Games tab requirements](step6-games-first-view.md): a season game's row is step 6's,
unchanged. Today's frames: `.ui-atlas/stories/round3-short-games/before/` (short-games-fixture.js with `open`: 60 one-episode games
over 20 episodes, Episode 20's three still to answer for alex and sam): `games-alex`, `games-sam`, `tonight-alex`, `tonight-sam`,
`reveal-sam` and its beats, `archived-game`.

## The problem

Someone opens Games, Tonight or the reveal on a season where three one-episode games start before every episode. They want the
next thing to play and whether they won the last ones.
- **The Games tab** (`games-alex`) is 63 rows and 18,168 px tall. Its first view is fine on its own (the strip, Survival Pool's row,
  Outlast's head), but Episode 20's three games are about 28%, 63% and 98% of the way down: the farthest about 17,800 px below
  the fold.
- **Finished games** stand between them: 57 rows, each a full step 6 row (a place, a line, a leaderboard of four). 19 of them read
  "— · 4 players · nothing counted yet" above "Final · you won it" (a tie at nothing, called a win).
- **Tonight** (`tonight-alex`) lists "Your games · 63", a mini each, 12,284 px. Every finished one says "— · After the game ended".
- **The reveal** (`reveal-sam`) plays about 16 beats, one per game. Three in a row read "0 pts on your sheet".
- **A finished game's page** (`archived-game`) says "Tied 1st of 4 · 1 pts · in front". It draws "The season" as one column, with
  "The next ones stay hidden until they lock".

## L0 · Cognitive load

**Constraint.** Working memory holds three to five chunks, and unattended noise still spends it.

**Violation.**
- **The tab:** every game is a chunk of the same weight. The 57 that are over cost the same scanning as the six that are on, and
  nothing groups the three that belong to one night.
- **Tonight and the reveal:** they repeat the count: 63 minis, and 16 beats where one night is one event.

**R1.** Each surface's first view holds at most four chunks. A night's games are **one** chunk, never three.
- **The Games tab:** the bar with its compact control; the strip; the next episode's block; the head of the season games.
  - The next episode's block is a heading and one row per night's game, each row two lines at most and no more than 64 px. Three
    games and the heading fit in 260 px, so the first season game's name and place are in the first view.
  - Finished games add one block below the season games, never one row each at full weight.
  - The tab's height stops growing with the season: the same at 20 episodes as at 30.
- **The archive:** the bar; your record (one headline and at most four opponent rows); the kind chips; the newest episode's
  results.
- **Tonight:** a night's games are two compact parts (the last results, the next games), one line per game.
- **The reveal:** a night's games are one beat, a row per game.

**Citations:** Cowan (2001) for the three-to-five chunk ceiling; Miller (1956) for chunking related items into one unit.

## L1 · First impression

**Constraint.** Meaning is judged in about 50 ms; faces are processed first and fastest.

**Violation.** A night's game before its episode leads with "—" and four "–" leaderboard rows: no face says anything happening, and
a dash is the first thing seen. A finished game leads with your place as a dash or "T3" in a 30-px figure, while who won it is a
13-px line beneath. The reveal's night beats lead with "0 PTS ON YOUR SHEET" at 44 px, three times.

**R2.** Each part leads with the people:
- **A night row:** who's in it, as faces, each ticked once they've answered. The ticks are the row's news before the episode
  (Joanna sees "everyone but me").
- **A result row:** the winner's face and the winner in words ("Jordan won", "You won"), then your place.
- **The archive's first impression:** your record as one large number ("19 wins"), with the people you play as faces on their split
  bars.
- **The reveal's night beat:** the night's winners' faces, row by row, with yours marked when you won.

**Citations:** Lindgaard et al. (2006) for the 50 ms judgement; Crouzet, Kirchner and Thorpe (2010) for faces reached before other
objects.

## L2 · Processing fluency

**Constraint.** One form per fact reads as true; a second form costs a re-read and erodes trust.

**Violation.**
- **A result:** a finished game's result has four forms today: the row's "Final · you won it", Tonight's "After the game ended", the
  reveal's "0 pts on your sheet", and the page's "Tied 1st of 4 · in front".
- **A tie:** it is a win on one surface and "in front" on another.
- **"Final":** it's said on every one of 57 rows.

**R3.** A finished game has **one** part, the result row, on the tab, in the archive and on Tonight. The reveal's beat is the same
row at the reveal's size.
- **The result's words,** one rule everywhere:
  - one winner: "Jordan won" or "You won";
  - a shared win: "Tied: you and Riley";
  - everyone level at nothing: "Nobody scored".
  - "Won" is never said for a tie of everyone.
- **Your place:** step 6's form, "2nd of 4 · 3 pts".
- **"Final" or the episode is said once,** by the block's heading ("Episode 19's results"), never on each row.
- **A night row's move state is said once,** in words ("Answered · change until Sun 8 PM"). Its button is outlined, and the strip
  keeps the one yellow.
- **The robot face:** a computer player is the robot face in every part (E1).

**Citations:** Reber and Schwarz (1999) for one form reading as true; Alter and Oppenheimer (2009) for the cost of disfluent forms.

## L3 · Prediction

**Constraint.** People act on prediction and notice only what breaks it.

**Violation.**
- **Order:** today's tab orders by "due first, then as they started", and finished games are interleaved by name. Nobody can
  predict where Episode 20's Prediction Sheet is.
- **"Final" against "ended":** a "Final" row and a running row share one form, so "is this one over?" needs reading.
- **The finished page:** it says "the next ones stay hidden until they lock" when none will come.

**R4.** The tab reads in time order, the next thing first, and every door predicts what's behind it.
- **The blocks:** the next episode, what runs all season, the last episode's results, the door.
- **Someone behind:** each episode ahead of their mark is a block in episode order. The first is open. A later one is a single line
  with a chevron and a count ("Episode 19 · 3 games · answered") that opens in place, unless a move in it is due now.
- **Results and the door:** "Episode 17's results" is the newest the viewer has seen, never a later one. The door names its count
  ("All finished games · 57").
- **The archive's pages:** each ends on a button saying what comes next ("Episodes 11 to 1"). Back from a game opened in the archive
  returns to the archive where it was.
- **A finished game's page:** it says Final, and says nothing about episodes to come.

**Citations:** Clark (2013) for prediction and its violations; Norman (2013) for signifiers that say what an action will do.

## L4 · Decision

**Constraint.** One decision per view, with what decides it beside it; no manufactured urgency.

**Violation.** None of today's surfaces offers the decision a frequent short game asks for: play the same thing again next
episode. A game you'd repeat is a trip through Start a game each night. No surface adds up a win, so the sweat decides nothing from
the record.

**R5.** Each view has one decision, and nothing presses:
- **The Games tab:** the next move (the strip, or a night row's button).
- **The reveal's last beat, and a finished game's page:** **Again for Episode 21**, offered once, outlined, never made for you.
- **The archive:** no decision. It's for reading, and its one control is the kind filter.
- **The sweat's depth:** your record by opponent and by kind, dense on the archive, one tap from the tab's door.
- **No pressure:** no streak to lose, no "don't break it", no count of days played, no red for a loss. A loss is a place, said like
  any other.
- **A couch of one:** the same. Its record is wins and losses against each computer player, never a nudge to play.

**Citations:** Iyengar and Lepper (2000) for one decision at a decision point; Thaler and Sunstein (2008) for defaults offered, not
imposed.

## The first views, then

**The Games tab, alex (caught up, Episode 20 next):**
- The bar and compact control, then the strip (yellow: "Pick who survives · Fill in your sheet").
- **Episode 20 · Sun 8 PM:** three night rows. Each: the game's dot and name, the faces ticked (Riley and Jordan in, you not), "4
  questions · locks Sun 8 PM" and an outlined Answer.
- Then **Running all season** with Survival Pool's name and place at the fold.
- Must not: a finished game above the season games, a leaderboard on a night row, a second yellow, "Final" on a row.

**The Games tab, sam (behind, Episode 18 next):**
- The bar and the control asking "Seen Ep 18?".
- **Episode 18 · results when you reveal it:** three rows, each "Answered".
- **Episode 19** and **Episode 20** as one line each.
- Then the season games.
- Must not: any result past Episode 17, or a winner's face on an Episode 18, 19 or 20 game.

**The archive:**
- The bar ("Finished games").
- Your record: "19 wins of 57" large; three opponent rows, each a split bar on one scale (you above them, level, them above) with
  their face.
- The kind chips (All · Prediction Sheet · Split the Pot · Match the Majority).
- "Episode 19 · Nov 15" with its three result rows.
- Must not: a row per game at step 6's weight, red on a loss (a win is marked in teal, DESIGN.md's good news; a loss is a place),
  a page with no end.

**A finished game's page:**
- The title card: Final, "Jordan won · you 2nd of 4".
- For a one-episode game: no season grid of one column, no weekly graph of one point; Again for Episode 20 at its foot.

**Tonight:** the season games' minis, then "Episode 19's results" (three result rows) and "Episode 20's games" (three lines with
their states).

**The reveal:**
- After who went home and the GIFs: one beat, "Episode 18's games", three result rows at the reveal's size, the winners' faces, "You
  won 1 of 3".
- Then each season game's beat and the table.
- The last beat offers Again beside Close.

The eye's order everywhere: when (the episode) → who (faces: who's in, who won) → you (your move's state or your place) → the
door to depth.

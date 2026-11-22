# A league's page, This week (sports-couch B1): first-view requirements (Perception-First Design, step 2)

Mode 2 derivation on [league-page-spec.md](league-page-spec.md), once, bottom-up, for This week at 390 × 844. The first view is
what's between the bar (about 96 px) and the tab bar (66 px): about 680 px.

## The problem

A fan taps their league to see their friends' teams this week: who meets whom, where each stands, and what's theirs to do. A
sports app answers "what's on" with a scoreboard; this page has to answer "what's the couch's" first, without turning a Sunday's
eight games, a rivalry, a table and a due move into a wall to read.

## The layers

**Foundation, load.** Constraint: about four chunks at once (Cowan 2001, 2010); noise spends working memory unattended (Hassin et
al. 2009). Violation: the spec's six sections, each with several parts, could all crowd the first view, and a team's game could
appear in the rivalry, the table and a schedule list at once.
- **R1. The first view holds at most four groups, in this order: your move (only when due), the rivalry (only when there is one),
  the couch's table with at least its first three rows, and nothing past that complete.** The rivalry is at most about 150 px so
  the table's top three rows fit under a due move. A table row is at most two lines and line one at most five things (rank, mark,
  name, faces, record). Each team's game appears once: in its table row, or, for the rivalry's two teams, in the rivalry, whose
  rows in the table then say "Rivalry above" rather than the game again.
- **Citations:** Cowan (2001) for the four-chunk limit; Hassin et al. (2009) for unattended noise spending working memory.

**L1, the first glance.** Constraint: a screen is classified in about 50 ms, before words (Lindgaard et al. 2006), and faces are
found before text. Violation: a page that opens on a heading and a paragraph (today's sheet: "A week's games make one episode…")
reads as instructions, not as the couch.
- **R2. Faces and team marks lead every group; numbers sit in one right-hand column in tabular figures; live is the only red; no
  hero, no paragraph, no VS slab.** The rivalry reads as two side lines (person over team), not a poster. The page's title is the
  league's own name.
- **Citations:** Lindgaard et al. (2006) for the 50 ms judgement; Leder et al. (2004) for classifying before evaluating.

**L2, fluency.** Constraint: what's easy to process reads as true (Reber & Schwarz 1999), and consistency carries into trust
(Alter & Oppenheimer 2009). Violation: the rivalry, the table and the strip each inventing their own way to show a team and a
game; a form strip unlike the team sheet's.
- **R3. One side line everywhere on the page (mark · name · faces · number), the same as the strip's and the card's; form ticks the
  team sheet's (a filled W, an outlined L, a half T); a game's words the sports screens' own ("Sun 1:00 PM", "Started 1:00 PM",
  "On now", "Final", "Bye"), never "episode".** The table reads as standings: rank on the left, record on the right.
- **Citations:** Reber & Schwarz (1999) for fluency read as truth; Alter & Oppenheimer (2009) for fluency spreading to trust.

**L3, what people predict.** Constraint: people act on prediction and notice violations (Clark 2013); trust is perceived from
coherence (Seckler et al. 2015). Fans predict "my team first", standings ordered by record, and a spoiler-safe page to stay
spoiler-safe everywhere on it. Violation: a table ordered by record while records are hidden gives the results away by position;
a one-row table with "1" beside it, or an empty rivalry box, reads as broken.
- **R4. Your team is found in a glance (your face first on it, ringed as on the card). Hiding scores: no number anywhere on the page,
  the table ordered yours first then by fans (never by record), one quiet Show records at the table's head. A lone fan's table is
  still a table, without a rank for one row; no rivalry, no box for it. Solo: "Your teams", no faces column (it would only be
  you).** Off-season says so in the first line, with when it's back.
- **Citations:** Clark (2013) for prediction and violation; Seckler et al. (2015) for trust from visual coherence.

**L4, the decision.** Constraint: simplify the decision point, not the workspace; near actions in concrete words (Trope &
Liberman 2010); showing over describing (Hertwig & Erev 2009). Violation: two yellows (a due move and Play this week's games), or
a rivalry's start shouting louder than the move that's actually due.
- **R5. At most one yellow in the view: your due move, in its own words. The rivalry's Start a game on it is outlined; Play this
  week's games is outlined while a move is due and sits below the table, never in the first view on top of it. No countdowns, no
  "last chance".** The rest of the league is one quiet row, after everything of the couch's.
- **Citations:** Trope & Liberman (2010) for concrete words for near actions; Hertwig & Erev (2009) for showing over describing.

## What satisfies all five

From the top: the due move as one yellow strip (R5), only when due; the rivalry as two stacked side lines with the people's faces
and names leading, the game's time or state on the right, one outlined action (R1, R2); the couch's table as standings rows, your
face first, form ticks and this week's game on line two (R1, R3, R4); below the first view, rivalries this season, your games and
Play this week's games, and the rest of the league as one row (R5).

## The proposals against R1–R5

- Round 2's This week (strip · rivalry · table · rivalries · your games and the room · the rest): passes once the rivalry's sides
  and Pick a side (C1) are out, which makes it short enough for R1.
- Today's league sheet (a paragraph, two start actions, then every game by day): fails R1 (each game in a list of the week), R2 (a
  paragraph first) and R5 (a yellow Play while nothing's due leads the sheet).

## The gap

**The rivalry's two teams in the table.** R1 says a game appears once; the table says where every couch team stands. Neither
proposal says what those two rows say on line two: their game is in the rivalry above. The requirement: their line two keeps
their form and says "Rivalry, above" in place of the game, so the table stays complete and the game isn't drawn twice.

## First views, in the eye's order

- **Sunday, a rivalry on now:** the rivalry (two faces, their teams, On now and the score, or Started when hidden) · the table's
  first three rows · (the due move above both when one is due).
- **Wednesday, a move due:** the due move · the rivalry with its day and time · the table's first rows.
- **Hiding scores:** the same groups with no numbers; Show records at the table's head.
- **A lone fan:** the table (his team, his face) leads; nothing for a rivalry.
- **Solo:** Your teams, no faces; no rivalry; your games.

> *Initial findings. Ralph Loop a requirement, cite further, switch to analyze / evaluate, or ask any follow-up to dig deeper.*

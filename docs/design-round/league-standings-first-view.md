# A league's page, Standings (sports-couch B1, session 4): first-view requirements (Perception-First Design, step 2)

Mode 2 derivation on [league-standings-spec.md](league-standings-spec.md), once, bottom-up, for Standings at 390 × 844. The first
view is what's between the league's bar (about 96 px) and the tab bar (66 px): about 680 px.

## The problem

A fan opens Standings to answer one question about one team ("is my team leading?", "where would we be seeded?"), and the table is
32 rows of near-identical lines of numbers. What gets in the way: finding the team, finding the one number that answers the
question among four or five, and knowing which order the rows are in (division, conference, the league's tiebreaks or ours).

## The layers

**Foundation, load.** Constraint: working memory holds about four chunks (Cowan 2001); a dense grid of numbers is read as one
chunk per row only if each row's form is the same and its columns line up (Tufte 1983's data-ink: every mark carries data).
Violation: five numeric columns a row at 390 make every row a column-reading task; split lines, form ticks and this week's game
(This week's two-line row) would double the rows' height and push the couch's group off the first view.
- **R1. One line a row, at most three numbers after the name (the record and the sport's one or two ranking numbers), tabular and
  right-aligned under a column head per group. The couch's first group whole in the first view: heading, column heads and its
  rows (an NFL division: 4 rows; an NBA conference: its top 8 at least). Splits only on demand, one row at a time.**
- **Citations:** Cowan (2001) for the four-chunk limit; Tufte (1983) for data-ink and aligned columns.

**L1, the first glance.** Constraint: a target is found by a feature that pops out pre-attentively (colour, a filled shape, faces)
in about 200 ms whatever the number of rows (Treisman & Gelade 1980); faces are found before words. Violation: a team found by
reading names row by row is a serial search that grows with the table.
- **R2. The couch's teams pop out without reading: your team's row raised (the standings row "you"), each couch team's fans'
  faces on its row, and the team marks in their colours on every row. Nothing else on a row is filled; the place column muted
  except the group's leader.**
- **Citations:** Treisman & Gelade (1980) for pop-out search; Wolfe (1994) for guided search by feature.

**L2, fluency.** Constraint: what's easy to process reads as true and familiar (Reber & Schwarz 1999); a form already learned is
read without effort (Alter & Oppenheimer 2009). Violation: every sports app shows standings as rank · team · W · L · then the
league's number; an order of our own (the couch's teams first inside a group) or an unfamiliar column breaks the learned read.
- **R3. Inside a group the league's own order, never re-sorted (the couch's groups may come first; the rows inside never move).
  Columns in the order fans know (record, then PCT/GB or PTS), headed by their usual short names, the same form as This week's
  table row (mark, name, faces, the number at the right), one row height across every group.**
- **Citations:** Reber & Schwarz (1999) for fluency read as truth; Alter & Oppenheimer (2009) for fluency spreading to trust.

**L3, what people predict.** Constraint: people act on a model of the page and notice when it breaks (Clark 2013); a switch's
current state must be visible to predict what the rows mean (Norman 1988's visibility). Violation: a place number that means
"2nd in the division" in one view and "seed 5" in another, with nothing saying which, makes the same digit lie; a page that shows
results to someone hiding them breaks the app's one promise.
- **R4. The view's state says what the numbers mean: the chosen switch segment visibly on, and the place column's head says it
  ("Div" or "Seed"). Hide sports scores holds everything on the tab behind one plate before any number draws (and while the
  setting is unknown); out of season, the table says "Final" in its first line.**
- **Citations:** Clark (2013) for prediction and its violation; Norman (1988) for visible system state.

**L4, the decision.** Constraint: a decision is fast when the options are few and a default carries it (Hick 1952; Johnson &
Goldstein 2003). The tab has no move to make: its decisions are which view and which row to open. Violation: a switch with three
or more views, or a Show and an Open on every row, turns reading into choosing.
- **R5. One switch of two segments (none for a one-level league), opened on the league's usual view; a row's only action is to
  open its splits (the whole row), and the team's sheet one tap further inside them. No yellow anywhere on the tab: there's no
  move to make (the One Chyron Rule spends it only on a move); the hidden plate's Show is outlined.**
- **Citations:** Hick (1952) for decision time growing with choices; Johnson & Goldstein (2003) for defaults carrying the choice.

## What satisfies all five

From the top: the switch (two segments, the chosen in ink) and nothing else above the tables; then the couch's first group: its
name as the heading, a row of column heads (place's "Div"/"Seed", then W-L and the sport's numbers), and one-line rows of 48 px
(place, mark, short name, faces, the numbers). Your row raised. The rest of the groups below, the same form. A tap opens one row's
splits under it in two short lines and Open ›. Hidden: the groups' names greyed, one outlined Show the standings, nothing else.

At 680 px: switch 52 + heading 44 + column heads 24 + 4 rows × 48 = 312 for an NFL division, so the next group starts in view
(R1 passes); an NBA conference fits its top 9 (52 + 44 + 24 + 9 × 48 = 552).

## The spec's proposals against R1–R5

- One read, both levels, the switch on the league's usual view: pass R4 and R5.
- The couch's groups first, the league's order inside: pass R3 (only whole groups move).
- Three columns at most, from the sport: pass R1 (football's DIFF third column is the most it can carry; keep it the quietest).
- The row opening in place, Open › inside: pass R5.
- The whole tab held behind one plate when hidden: passes R4.
- Clinched and out as words: pass R3 only if they don't add a column: put them as a short muted word after the name, never a
  fourth number.

## The gap

The spec doesn't say **how the place column reads in Conference** when seeds and division leaders differ (the NFL's 4th seed can
have a worse record than the 5th). A fan predicts rows by record; a seed order breaks that unless the reason shows. Mark a
division leader in Conference (a small muted "Div" mark beside the seed, or the leader's division as its row's second word), so
the order explains itself.

> *Initial findings. Ralph Loop a requirement, cite further, switch to analyze / evaluate, or ask any follow-up to dig deeper.*

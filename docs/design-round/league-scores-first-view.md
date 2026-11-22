# A league's page, Scores (sports-couch B1, session 2): first-view requirements (Perception-First Design, step 2)

Mode 2 derivation on [league-scores-spec.md](league-scores-spec.md), once, bottom-up, for Scores at 390 × 844. The first view is
what's between the league's bar (about 96 px) and the tab bar (66 px): about 680 px.

## The problem

A fan opens the league's scores to see what's on, what's coming and how games ended, this week or another. What gets in the way:
a Sunday is 13 to 16 games, a sweat wants any week of the season, a casual fan only wants their friends' games, and someone hiding
scores must be able to browse the same list without being told anything by it.

## The layers

**Foundation, load.** Constraint: about four chunks at once (Cowan 2001, 2010); a familiar unit is chunked as one (Gobet et al.
2001). Violation: a switcher of 22 weeks, a couch group, day headings and 16 rows of two teams, a time, a network, a line and faces
each could make every row a dozen items, and the switcher a strip of 22 equal chips.
- **R1. The first view is the switcher, then whole rows only: the switcher at most about 60 px, then the couch's games (when any)
  and the first day's rows, at least five rows of about 72 px in the view under a heading each. A row is one chunk: two team lines
  and one status column; nothing on a row outside them.** The switcher shows about five chips at once, the chosen one in full.
- **Citations:** Cowan (2001) for the four-chunk limit; Gobet et al. (2001) for a familiar unit read as one chunk.

**L1, the first glance.** Constraint: a screen is classified in about 50 ms (Lindgaard et al. 2006); people recognise a schema
before reading (Leder et al. 2004). Violation: today's rows (two small marks, "Eagles at Jets", a 13 px score off to the right)
read as a list of links, not a scoreboard.
- **R2. It reads as a scoreboard at a glance: team over team, the score large in one right-hand column of tabular figures, the
  status in a fixed column after it, live the only red (its rule and dot).** Headings are quiet caps; the switcher is quieter than
  the rows (no fills but the chosen chip's mark).
- **Citations:** Lindgaard et al. (2006) for the 50 ms judgement; Leder et al. (2004) for classifying before evaluating.

**L2, fluency.** Constraint: what's easy to process reads as true (Reber & Schwarz 1999); consistency across places carries trust
(Alter & Oppenheimer 2009). Violation: the hub's scorebug, the strip's sheet, This week and Scores each drawing a game their own
way, so the same game looks different two taps apart.
- **R3. The row is the hub's scorebug, full width, with the same states, words and marks (Final, Started, the eye, the pick's
  underline, the controller); only the team's code grows to its name because there's room.** The switcher's chosen chip is marked
  as the tab bar marks its tab (the chyron-line rule), not a new kind of selection.
- **Citations:** Reber & Schwarz (1999) for fluency read as truth; Alter & Oppenheimer (2009) for fluency spreading to trust.

**L3, what people predict.** Constraint: people act on predictions and notice violations (Clark 2013). Fans predict a scoreboard
opens on now (this week, today), their favourites first, and a week switcher to scroll sideways. Hiding-scores users predict that
nothing on the page will tell them. Violation: a list ordered live-then-final would tell a hidden user which games ended by their
place; a switcher that opens on Week 1 makes "now" a hunt; away from now, no way back.
- **R4. It opens on now (the current week, today) with the chosen chip in view; the couch's games first, found by faces; every
  group in kickoff order only, never by state, so position tells nothing; away from now, one "This week" (or "Today") link back.
  Hiding: Started and an eye on every begun game, the week's one Show scores at the list's head.**
- **Citations:** Clark (2013) for prediction and violation; Seckler et al. (2015) for trust from visual coherence.

**L4, the decision.** Constraint: simplify the decision point, not the workspace (Hick 1952 for choices at the point of
decision; Trope & Liberman 2010 for concrete words on near actions). Violation: a Play button on every upcoming row makes 16 equal
decisions in one list; a yellow on a scoreboard competes with nothing it should beat.
- **R5. No yellow and no buttons on the rows: a row is one tap target that opens its game (or your game); the only controls are
  the switcher, the way back to now and, hiding, Show scores (outlined).** Your move lives on This week; here the controller and
  its dot are enough.
- **Citations:** Hick (1952) for decision time growing with choices; Trope & Liberman (2010) for concrete words on near actions.

## What satisfies all five

A sticky switcher about 56 px tall (week chips: the label over its dates; day chips: weekday over date, arrows at the ends), the
chosen chip in foreground with the chyron-line rule under it, now's chip saying so, the rest muted (R2, R3, R4). Under it, quiet
caps headings ("The couch's games", then each day), each over full-width scorebugs 72 px tall with 8 px between (R1, R3): team
names in the bug's caption face, faces after the name, the score 26 px in one column, the status column behind a hairline (R2).
Hiding, one outlined Show scores at the top of the list (R4, R5). No Play on the rows (R5). Off-season: one line in the switcher's
place.

## The spec's proposals against R1–R5

- The switcher (weeks for football, a week of days for daily sports): passes R1 if it shows about five chips and stays under 60 px;
  R4 needs it to open scrolled to now.
- The couch's games first: passes R4; R1 asks it not to grow past the view on its own (a 10-team couch on a Sunday): past four
  rows, the couch group stays whole (they're the page's reason) and the day's games follow it below the fold, which is fine.
- The shared row as A1's bug: passes R2 and R3.
- No Play on rows: passes R5 (and the open choice for the user stands).
- Show scores for the week while hiding: passes R4 and R5 as one outlined control.
- Kickoff order everywhere: passes R4 (and the spec should say so: it does, "by kickoff").

## The gap

The spec doesn't say what a **row tells you it's yours** beyond faces: a game you play shows the controller, but a team you follow
with nobody else on the couch following it shows only your face, which on a phone is small. Keep the bug's ringed face (yours
ringed, A1) so "mine" is found by shape, not by reading a name.

> *Initial findings. Ralph Loop a requirement, cite further, switch to analyze / evaluate, or ask any follow-up to dig deeper.*

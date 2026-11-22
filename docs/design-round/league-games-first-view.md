# A league's page, Games (sports-couch B1, session 3): first-view requirements (Perception-First Design, step 2)

Mode 2 derivation on [league-games-spec.md](league-games-spec.md), once, bottom-up, for Games at 390 × 844. The first view is
what's between the league's bar (about 96 px) and the tab bar (66 px): about 680 px.

## The problem

A fan opens the league's Games to play: to do what's due, to join what the couch already plays, or to start something. What gets
in the way: four groups of rows, most of them starts that look alike ("Play…", "Start…", "Every…"), and the casual fan who came to
do one thing has to tell a game they're in from a game they could join from a game they could start.

## The layers

**Foundation, load.** Constraint: about four chunks at once (Cowan 2001); choice sets past a handful slow and discourage choosing
(Iyengar & Lepper 2000). Violation: your games, games to join, two starts, three rivalry rows with their extra lines and a team's
season could put nine or ten actions in one view.
- **R1. The first view holds at most three groups and at most five actions: what's yours (your games, due first), then what's
  the couch's (games to join, then this week's start), then the rest below the fold is fine. Rivals and Your team never push your
  games or a due move below the fold. A group past four rows folds.**
- **Citations:** Cowan (2001) for the four-chunk limit; Iyengar & Lepper (2000) for large choice sets reducing choice.

**L1, the first glance.** Constraint: a screen is classified in about 50 ms (Lindgaard et al. 2006); faces are found before words.
Violation: a column of outlined boxes reads as a settings page, not as games with people in them.
- **R2. Rows lead with what tells them apart at a glance: a game you're in or could join by its name in caps and the faces in it;
  a rivalry by its two team marks; a start by a verb. No boxes around rows; only the one start that's the tab's action may be a
  plate.**
- **Citations:** Lindgaard et al. (2006) for the 50 ms judgement; Leder et al. (2004) for classifying before evaluating.

**L2, fluency.** Constraint: what's easy to process reads as true (Reber & Schwarz 1999); one form for one kind of thing carries
trust across places (Alter & Oppenheimer 2009). Violation: the show's Games tab draws a game you're in and a game to join one way;
a league's drawing them another makes the same thing look different a hub-tap apart.
- **R3. A game you're in and a game to join are the show launcher's rows, with its Join button; a rivalry row's marks and words are
  This week's season rivalry row's. A start's words say what starts and on what ("Pick'em on every game still to come · 4 games").**
- **Citations:** Reber & Schwarz (1999) for fluency read as truth; Alter & Oppenheimer (2009) for fluency spreading to trust.

**L3, what people predict.** Constraint: people act on predictions and notice violations (Clark 2013). People predict a button does
what it says, now. Violation: a start a solo player can't use (it answers "Start or join a couch first") breaks that prediction at
the moment of commitment; a heading promising "On your own" that starts on the couch does too.
- **R4. Nothing is offered that can't be done: no start for a solo player until one works, said once in plain words; group names
  say who it's with as it is ("Your team", not "On your own"). A spectator sees no Rivals or Your team groups.**
- **Citations:** Clark (2013) for prediction and violation; Seckler et al. (2015) for trust from coherence.

**L4, the decision.** Constraint: simplify the decision point (Hick 1952); a default carries the choice for most people (Johnson &
Goldstein 2003). Violation: two equal starts side by side (this week, the season) and a Start on every rivalry row make every
option equal.
- **R5. One default action at a time, in the one yellow: your due move when there is one, else Play this week's games. Every
  other start is outlined or a quiet line; a rivalry row's Start is small and outlined; a pair's every-meeting start is a text
  line, not a second button.**
- **Citations:** Hick (1952) for decision time growing with choices; Johnson & Goldstein (2003) for defaults carrying the choice.

## What satisfies all five

From the top: Your games here (launcher rows, due first, the move in chyron line), then With the couch (join rows with Join; Play
this week's games as the plate when nothing's due; Play the season outlined), then Rivals (two marks, the game, its day and the two
people; a small outlined Start), then Your team (one row a team). Solo: your games, then one line. Off-season: your games, one line.

## The spec's proposals against R1–R5

- The four groups: pass R1 only if Rivals and Your team sit after the couch's group (they do) and the join list folds at four.
- The launcher's rows for yours and to join: pass R2 and R3.
- Rivals' rows with Start and a quiet every-meeting line: pass R5.
- "Your team" for "On your own": passes R4.
- Solo's honest line and This week dropping its dead-end start: pass R4.

## The gap

The spec doesn't say what a **game you're in** shows when nothing is due: "Open" is a word with no information. Give it what it
is and where you stand without a result ("Pick'em · 3 of 4 weeks picked", "Week 12 locks Sun 1:00 PM"), or the people in it and
"All set": never a place or a score (those are results, and the tab has none).

> *Initial findings. Ralph Loop a requirement, cite further, switch to analyze / evaluate, or ask any follow-up to dig deeper.*

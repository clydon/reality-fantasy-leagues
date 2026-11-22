# A league's page, Chat (sports-couch B1, session 5): first-view requirements (Perception-First Design, step 2)

Mode 2 derivation on [league-chat-spec.md](league-chat-spec.md), once, bottom-up, for Chat at 390 × 844. The first view is what's
between the league's bar (about 96 px) and the composer over the tab bar (about 66 + 72 px): about 600 px of stream.

## The problem

A couch member opens the league's Chat to read what friends said and say something back, often during a game. What gets in the
way: many games at once, so a message's subject isn't obvious; talk about a game someone hasn't seen yet; and the question of where
their own message will land.

## The layers

**Foundation, load.** Constraint: about four chunks at once (Cowan 2001); a chat is read as a stream of messages, and every row of
chrome above it costs messages in view. Violation: a threads row, a fold per game, a game tag on every message and an About chip
could leave three messages in the first view.
- **R1. At least five messages (or their folds) in the first view at 390 × 844. Chrome above the stream at most one 44 px row
  (the threads row), and none when there's nothing to choose. A game tag only on a run's first line, never per bubble.**
- **Citations:** Cowan (2001) for the four-chunk limit; Sweller (1988) for extraneous load.

**L1, the first glance.** Constraint: faces and the bubble shape are found before words (Treisman & Gelade 1980); a dashed outline
reads as "something held back" when the app already uses it so. Violation: a fold styled like a message invites reading it; a game
tag styled like a name competes with the name.
- **R2. A message is the show chat's bubble (one form everywhere); the fold the show chat's dashed line; a game tag is muted text on
  the name line, after the name and before the time. Live is the red dot only, and only on a game shown live to you.**
- **Citations:** Treisman & Gelade (1980) for pop-out of shape and colour; Wolfe (1994) for guided search.

**L2, fluency.** Constraint: one form learned is read without effort (Reber & Schwarz 1999); the show's Chat is already learned.
Violation: a league chat that draws messages, the sheet or the composer differently makes the same act feel new.
- **R3. Message, reactions, sheet, GIF and composer are the show chat's parts, reused. Days divide as the show's; a game thread
  reads as a landmark does (the game's name where its talk is), never a VS graphic.**
- **Citations:** Reber & Schwarz (1999) for fluency read as truth; Alter & Oppenheimer (2009) for fluency spreading to trust.

**L3, what people predict.** Constraint: people act on a model of where their action goes (Norman 1988, the gulf of execution);
broken spoiler expectations destroy trust in the whole app (Clark 2013, prediction error). Violation: a message sent into a thread
the author didn't see chosen; a folded line that leaks the game's state in its words ("since the Eagles scored").
- **R4. Where a message will go is visible before Send (the About chip, its game named, × to post to the room). A fold says only
  how many, who and which game, and "since it started", never a score, a state or a winner; a hidden game's chip says "Started".**
- **Citations:** Norman (1988) for visible mapping of action to outcome; Clark (2013) for prediction and its violation.

**L4, the decision.** Constraint: a default carries the choice for most people (Johnson & Goldstein 2003); a decision point costs
time per option (Hick 1952). Violation: asking where to post every time, or a threads row of every game in the week.
- **R5. One default, no question: while a couch game is live, About is on for it; in a thread, there; else the room. The threads
  row holds All and at most three games, live first. No yellow on the tab (no move to make); the fold's Show the score outlined.**
- **Citations:** Johnson & Goldstein (2003) for defaults carrying the choice; Hick (1952) for decision time growing with options.

## What satisfies all five

The threads row (44 px, chips: All, then up to three games) only when a game has talk or is on; under it the stream as the show's
Chat (days, runs, bubbles), a run in a thread headed "Riley · Eagles at Jets · 2:14 PM", a hidden game's talk folded into one
dashed line per game; the composer with an About chip above the field only while it applies. Empty: the show's empty words.

## The spec's proposals against R1–R5

- The threads row: passes R1 and R5 only if it hides with nothing to choose and caps at three.
- The game on the run's first line: passes R1 and R2.
- The fold per game, said without state: passes R4.
- The About chip on by default while live: passes R4 and R5, if it sits above the field (not inside it) and names the game.

## The gap

The spec doesn't say what the **About chip looks like when a thread is selected**: the chip row already says which game; a second
"About" there is redundant. In a thread, the composer's placeholder names it instead ("Message about Eagles at Jets"), no chip.

> *Initial findings. Ralph Loop a requirement, cite further, switch to analyze / evaluate, or ask any follow-up to dig deeper.*

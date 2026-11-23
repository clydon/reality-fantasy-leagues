# A game's sheet with Play (sports-couch B4): first-view requirements (Perception-First Design, step 2)

Mode 2 derivation on [game-sheet-spec.md](game-sheet-spec.md), once, bottom-up, for the sheet at 390 × 844. The sheet rises over
the screen that opened it; its first view (handle, title and what fits before the fold) is about 700 px.

## The problem

Someone taps a real game to play something on it, or to see how it's going. What gets in the way today: the sheet doesn't say what
it is ("A GAME"), it offers one game with no choice and hides the rest behind two more screens, it doesn't say the couch already
has a game on it (so a second one gets started), and once the game starts it has nothing to offer.

## The layers

**Foundation, load.** Constraint: about four chunks at once (Cowan 2001); a sheet is a task surface, read as one decision (Sweller
1988: extraneous load is what the layout adds to the task). Violation: a matchup, a couch line, the couch's games, four types, a
line about the type, Start, a lock line, Go bigger and More options would be nine chunks if all drawn as equals.
- **R1. The first view holds at most four groups, in this order: what the game is (title and bug, the couch's names on the same
  line or under it), the couch's game on it if any (at most two rows, the rest "+N more"), the types (four at most, one row of two
  or a 2×2), and the decision (Start with its lock line). Go bigger and More options start below the fold. After kickoff: the
  game, your games on it, the talk.**
- **Citations:** Cowan (2001) for the four-chunk limit; Sweller (1988) for extraneous load.

**L1, the first glance.** Constraint: the largest, most contrasting element is found first (Lindgaard et al. 2006); one colour
that means "act" pops out (Treisman & Gelade 1980). Violation: today the two 64 px marks are the loudest thing and "A GAME" the
largest word; with tiles, a chosen tile in yellow would compete with Start.
- **R2. The matchup is the title (the sheet's largest words). The one yellow is the decision: Start, or Join when the couch's game
  of the chosen kind is there. The chosen tile is marked by an ink outline and a check, never yellow; live red only on a live
  bug.**
- **Citations:** Lindgaard et al. (2006) for the 50 ms first impression; Treisman & Gelade (1980) for pop-out by one feature.

**L2, fluency.** Constraint: a learned form reads effortlessly and is trusted (Reber & Schwarz 1999). The row that opened the
sheet is a scorebug; the gallery's tiles are the app's way of showing game types. Violation: two big marks and a sentence are a
third way to show a game.
- **R3. The game is the shared scorebug, the same as the row that opened it (wide, the status column at the right). Types use
  the app's tile form (name in bold, one short line), in the order the rail gives (Pick'em first). Plain words a fan would say:
  "Who wins", "Three players", "The party grid".**
- **Citations:** Reber & Schwarz (1999) for fluency read as rightness; Alter & Oppenheimer (2009) for learned forms and trust.

**L3, what people predict.** Constraint: people act on a prediction of what a button will do (Clark 2013); concrete words fit near
actions (Trope & Liberman 2010). Violation: "Play this game · tells the couch" predicts neither when picks lock nor what the couch
gets; a sheet that tells a hidden score breaks the app's promise.
- **R4. Start says exactly what starts ("Start Pick'em"), and the line under it says when picks lock and what the couch hears
  ("Picks lock at kickoff, Sun 4:25 PM · the couch is told, with 10 seconds to undo"). A couch game names its maker and who's in.
  After kickoff the sheet tells nothing hidden: the bug's own rule, your games by name, the talk as a count.**
- **Citations:** Clark (2013) for prediction errors; Trope & Liberman (2010) for concrete words for near actions.

**L4, the decision.** Constraint: a default carries most choices (Johnson & Goldstein 2003); the easiest path should be the good
one (Thaler & Sunstein 2008). The good outcome for the couch is one game everyone's in, not two. Violation: a yellow Start beside
an existing Pick'em makes the duplicate the default.
- **R5. Pick'em is chosen by default. When the couch already has a game of the chosen kind on this game, Join it is the yellow and
  Start reads "Start another Pick'em" as a quiet outlined button; picking another type moves the yellow back to Start. Two taps from
  the row to a started game (open, Start); one more for any other type.**
- **Citations:** Johnson & Goldstein (2003) for defaults; Thaler & Sunstein (2008) for making the good choice the easy one.

## What satisfies all five

From the top: the handle; the title "Cowboys at Giants" (the sheet's caption title, 28 px) with "Sun 4:25 PM · CBS · NYG by 3" under
it; the bug (80 px) with the couch's faces; the couch line in names ("Sam's Cowboys at Jordan's Giants", 13 px); the couch's game
(a 60 px row: "Riley's Pick'em · 2 in", Join); the four tiles as a 2×2 (2 × 64 + 8); the chosen type's one line; the decision (64 px)
and its lock line. About 64 + 22 + 80 + 26 + 60 + 136 + 24 + 64 + 36 + gaps ≈ 600 px: inside the first view. Go bigger and More
options under it.

Per situation, the first view:
- **Before kickoff, nothing on the couch:** game · couch line · tiles · Start Pick'em (yellow) and its lock line.
- **Before kickoff, Riley's Pick'em on it:** game · couch line · "Riley's Pick'em · 2 in" with **Join** (yellow) · tiles (Pick'em
  chosen) · "Start another Pick'em" (outlined). Choosing Squares: Join turns outlined, Start Squares is the yellow.
- **A rivalry (your Eagles at Riley's Jets):** the couch line reads "Your Eagles at Riley's Jets"; everything else as above.
- **Live:** game (the live bug, red rule) · your games on it ("Your Pick'em", Open) · the talk ("3 messages") · "Picks closed at
  kickoff." No yellow.
- **Final:** game (Final and the score) · your games · the talk. No yellow.
- **Hidden:** the bug Started with its ask; your games by name; the talk as a count; nothing else changes.
- **Solo:** game · couch line absent · tiles shown, Start replaced by "Starting a sports game needs a couch for now. Start a couch ·
  Join one".

Must not be in the first view: two yellows; a tile in yellow; a pick or a standing from a couch game before its lock; a score for
anyone hiding; Go bigger above the decision.

## The spec's proposals against R1–R5

- The matchup as the title, the bug under it: R2, R3 pass.
- The couch line in names: R4 passes; R1 holds if it's one line (not a group of its own).
- Already on the couch above Play: R5 needs the rule above (Join takes the yellow for the chosen kind), or it fails: a row with
  an outlined Join beside a yellow Start still makes the duplicate the default.
- Tiles with Pick'em chosen, one Start: R2 (chosen marked in ink), R5 pass.
- The lock line in full words: R4 passes; it also answers the spec's open question (the full line, not "tells the couch").
- Go bigger and More options below: R1 passes.

## The gap

The spec has no rule for **which game is the primary when the couch already has one**: R5 settles it (Join is the yellow for the
chosen kind). Also unsaid: what a couch game covering this game but of a longer span reads as ("Every Giants game · Jordan's"):
it goes in the same rows, its line saying it covers this game ("this game counts in it"), and it never takes the yellow from Start
(joining a season isn't the same choice as playing tonight).

> *Initial findings. Ralph Loop a requirement, cite further, switch to analyze / evaluate, or ask any follow-up to dig deeper.*

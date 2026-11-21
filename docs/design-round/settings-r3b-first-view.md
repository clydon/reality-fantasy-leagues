# Settings, Round 3b: the first views (Perception-First Design, `solve`)

> **Status (2026-11-21): Round 3b, step 2 of the design process.** PFD's Mode 2 derivation on Intent's spec
> ([settings-r3b-spec.md](settings-r3b-spec.md)), before anything is built. It owns what's noticed first and how much is at once;
> Intent's structure stands. Phone at 390 × 844, one first view ≈ 690 px under the bar, Lower Third (Night). The surfaces: the
> lock row and its states; How it plays' new lines; the strip's runner line; a player's vote (the strip's move and its sheet); a
> person's sheet with a missing move; Undo wherever a change saves.

## Step 1: the problem

A game is under way and something about it has to change: the lock tonight, how late claims close, whether a new moment counts
back, a forgotten lineup. The person changing it (a runner, mostly Conor, sometimes riley) wants to know three things before and
after they touch it: **who it reaches, from when, and how to take it back**. The people it reaches (Joanna, Andrew) want to know
one: **did something change that moves my points, and do I get a say**. Today the answers are missing or wrong: the lock's
state after airtime is a code ("Override: open past its start"), four Undos only re-send an old value, a new moment silently
rescores weeks already played, and a vote exists on the server with no screen.

## Step 2: layer by layer

**Foundation (cognitive load: the bandwidth a change costs).** Constraint: a change is judged with what working memory has left
after reading the control, about four chunks; a state that has to be decoded ("Override", "Auto", on and off meaning opposite
things before and after airtime) spends the whole budget on the mapping, leaving nothing for the consequence. Violation: the
lock is a two-state toggle whose two states mean four different things; How it plays grows by five lines in 3b, and the vote, if
it arrived as a settings change, would ask players to model a rule they never chose.
- **R1. Every changeable state is named as what it does to people, in the show's words, never as a mode ("Open to whoever hasn't
  watched", not "Auto"); a control shows only the states reachable now (two before airtime, three after, none once results are
  in). How it plays' first view stays at the three or four lines 3a set: 3b's new lines go under the ones people come for most
  (the lock is its own row above; the five new lines sit below Who can join), each closed, value first.**
  **Citations:** Cowan (2001) for about four chunks; Sweller (1988) for extraneous load from decoding a representation.

**L1 (first impression: what pops in the first 200 ms).** Constraint: one salient signal wins, and the house yellow already means
"yours to do now" on the strip and Manage this game. Violation risk: a runner's line, a player's vote and a missing-move count
each want the yellow; on an episode night the strip already carries the player's own lineup due.
- **R2. One yellow per view, owned by the most urgent thing that's this person's to do. A player's own move outranks a runner's
  job (the runner line sits beneath it in the plate's quiet weight, never a second yellow plate); a vote is a move (it may take
  the yellow when nothing else is due, being due at airtime); a missing-move count on Who's playing is quiet text, never colour.
  The lock row's state carries its colour only when it differs from the game's rule (locked early, open to everyone, locked for
  everyone), so "nothing unusual" reads calm.**
  **Citations:** Treisman & Gelade (1980) for a single feature popping out; Wolfe (1994) for guided search following the strongest
  cue.

**L2 (processing fluency: one grammar).** Constraint: a page learned once is read on autopilot; a new control shape on a familiar
page costs a re-read and reads as less trustworthy. Violation risk: 3b adds a three-way lock, a stepper, two-way choices, a
switch, a vote and a sheet action; drawn as six shapes they'd break 3a's grammar.
- **R3. Every 3b control reuses a shape 3a built: the chosen-with-a-tick card (`Choice`) for any pick of one from a few (the
  lock's states, others' lineups, who goes first, free agency, when the show adds a moment, the vote's two answers), the
  `Stepper` for hours, the `SwitchRow` for on/off (fill from the bench), the value-first line for every row, the person sheet for
  a missing move. Undo is always the toast's word and the change line's word, in the same place, doing the same thing.**
  **Citations:** Reber & Schwarz (1999) for fluent reading feeling true; Alter & Oppenheimer (2009) for fluency generalising to
  trust.

**L3 (perception bias: what people actually infer).** Constraint: people infer a consequence from where a control sits and what
it says, not from a help line; a change that moves standings already played is felt as a loss far more than an equal gain
(loss aversion), and an Undo that silently fails teaches people not to trust any Undo. Violation: "Fixed a mistake" rescored
Episode 3 with no notice; Undo on the lock did nothing after a reload.
- **R4. Each change says from when in the control itself, before it's chosen ("From Ep 7 on", "the next window", "from the
  start: every episode rescored"), and a change that moves points already played names whose and how much ("+5 to Carter's
  holders for Ep 3") wherever a player meets it. An Undo is offered only where it works after a reload; past its window, the
  line says "Can't undo: Ep 7 has aired" instead of a dead button.**
  **Citations:** Kahneman & Tversky (1979) for losses weighing more than gains; Nisbett & Wilson (1977) for people acting on the
  cue in front of them, not the rule they were told.

**L4 (decision architecture: the right choice is the easy one).** Constraint: a vote is fair only if both answers are equally
easy and their consequences are shown, not described; the default must be the one that holds if nobody acts (Joanna won't
vote). A runner acting for someone else must not be able to read their secret back. Violation risk: a "Vote now" button with the
house's answer pre-picked; a runner's sheet that shows Joanna's last lineup.
- **R5. The vote's two answers are equal in weight and order (the default named as "for now", not pre-selected), each with its
  consequence for the standings; nobody voting keeps the default, said up front. A runner's missing-move action opens the game's
  own editor for that person with only what's public (who's still in), and the sheet afterwards says "Set by you", never what.
  The strip shows a runner's job only when it's genuinely theirs to do now (a request, a draft to start, a waiver window that's
  due), never "everything's fine" for a runner.**
  **Citations:** Thaler & Sunstein (2008) for defaults deciding for the inactive; Hertwig & Erev (2009) for consequences shown,
  not described.

## Step 3: the requirements

R1 states named by their effect, only reachable ones, How it plays' first view held. R2 one yellow, owned by the person's own most
urgent move. R3 3a's shapes only. R4 from-when in the control, whose and how much where points already played move, Undo only
where it works. R5 a fair vote with consequences shown, a runner's action that can't read secrets back, the strip only for real
jobs.

## Step 4: the first views this asks for

1. **Manage this game, episode night before airtime** (riley): the head; the lock row "Ep 6's lineups · Open · locks 8 PM" with
   a quiet chevron (no colour: it's the game's rule); How it plays' first lines. Tapping the lock opens two choices in place
   (Open until 8 PM · Lock now), the current one ticked.
2. **The same, after airtime:** "Ep 6's lineups · Open to whoever hasn't watched" (the rule, calm); opened: three choices with
   their one-line effects; choosing Locked for everyone turns the row's icon to the lock colour and the toast says "Locked for
   everyone · Undo".
3. **How it plays, scrolled:** the new lines closed, value first: Others' lineups "Hidden until they lock"; When the show adds a
   moment "From the next episode"; Who scores each week "… · empty slots fill from the bench". Timing inside Replacing people who
   leave, real controls, each saying "from the next window".
4. **The strip, a runner who also plays, on episode night:** their own lineup due in the yellow plate; beneath it, the quiet
   runner line "Lineup League · jordan asked to join · Let in". No yellow for it.
5. **The strip, a player when a vote is open:** "Vote · Count 'Mutinied to another tribe' from the start? · by Wed 8 PM" (the
   yellow if nothing else is due). The sheet: the moment and its points; two equal cards, From the start (+5 to Carter's holders
   for Ep 3) and From Ep 8 (nothing earlier changes), "for now: From Ep 8"; "Nobody voting keeps From Ep 8". After voting: the
   tally (2 of 5 voted) and Change my vote.
6. **A person's sheet, a missing move:** "No lineup for Ep 6 yet · Set it for them"; afterwards "Ep 6's lineup: set by you".
7. **Undo:** every toast's Undo works after a reload too (it's the change line's); a line past its window says why it can't.

## Step 5: the spec's proposals, tested

- The lock row above How it plays (spec): passes R1–R3 once its states are named by effect.
- The lock riding the night plate's line for a runner (spec): passes R2 (no second yellow) and R5 (not a job unless changed).
- The vote as a strip move (spec): passes R2 and R5 if the answers are equal and the default is "for now". A vote card on the game
  page alone would fail R4: Joanna doesn't open the game page between episodes.
- A missing move as a count on Who's playing (spec): passes R2 and R5.
- Five new How it plays lines (spec): pass R1 only below the first view; their order is Intent's, the first view stays 3a's.

## Step 6: the gap

R4's "+5 to Carter's holders for Ep 3" needs the server to compute what a rule change would move, per game, before it's applied
(a preview of the standings under each answer). The engine scores on every read, so the preview is the scoring run twice (with
and without the moment's gate); it doesn't exist yet as a call. Without it, the vote sheet can only say "earlier episodes are
rescored", which R4 judges too abstract for a loss.

> *Initial findings. Ralph Loop a requirement, cite further, switch to analyze / evaluate, or ask any follow-up to dig deeper.*

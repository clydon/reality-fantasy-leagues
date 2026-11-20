# Episode night, the late window: first-view requirements (PFD, Mode 2)

From [the page spec](strip-night-spec.md). The first phone view at 390 × 844 on Tonight while the episode is on (or just aired)
and the person hasn't watched it: the show bar over the art (about 470 px: SURVIVOR, Season 51, "Through Ep 8 · 1 behind",
"● Ep 9 · on air now", the couch's ruler, "Where everyone is"), Watch along, the strip, then Ep 9's bingo row and Last time.

## The problem

On the night, someone opens the show before watching the episode that's on. They come to settle one of two things: whether they
can still change their moves before they watch (and change them), or who they've got tonight. The screen says their moves are
locked, which is false for them, and shows who they've got nowhere in the first view. Two more people share the screen: one who
watched it live and must not be invited to change anything, and one passing by who must see the yellow only when something's
actually missing.

## The layers

### L0 · Cognitive load
- **Constraint:** working memory holds about three to five chunks, and unattended visual noise spends it too. The first view
  already holds five blocks (the show bar's lines and ruler, Watch along, the strip, the bingo row, Last time).
- **Violation:** the strip spends two chunks on a false state ("Locked") and an unrelated reassurance ("Scores stay hidden"),
  then the badge's "3" contradicts it, and resolving the contradiction is a third. The system's own product (pace × phase ×
  carried-or-saved × strict) leaks into the one word "Locked". Who you've got costs a tap, a scan of tiles and recall.
- **R1:** in the window, the strip costs at most two chunks: **one decidable state in the person's own terms** (open until you
  watch, or locked) and **who you've got**. No third clause (no score reassurance; the next airing's lock only within a day).
  The pace, the phase and the carried-or-saved distinction never surface as words. The first view gains no block.
- **Citations:** Cowan (2001) for the three-to-five-chunk ceiling; Hassin et al. (2009) for unattended noise spending working
  memory.

### L1 · First impression
- **Constraint:** in 50 ms people take in tone, weight, colour and pictures, not words; a symbol is classified before the line
  beside it is read.
- **Violation:** today's 50 ms read is a grey plate with a padlock: "closed, nothing for me". Scenario A has decided before
  reading. Faces, the competition show's own signal (the art, the ruler), are missing from the one place that holds your move,
  so scenario B finds nothing pre-attentively.
- **R2:** the 50 ms read tells the truth: **the padlock only when it's locked for this person; the yellow only for a real gap;
  who you've got as faces**, sized and shaped as cast (portrait tiles), distinct from the couch's square avatars on the ruler.
- **Citations:** Lindgaard et al. (2006) for the 50 ms gate; Fogg (2003) for prominence before interpretation (the padlock is
  noticed and read as "closed" first).

### L2 · Processing fluency
- **Constraint:** what's easy to process feels true, and every surface telling the same story is what makes it easy; each
  inconsistency is a prediction error.
- **Violation:** the same night says four things: the strip "Locked", the badge "3 due", the sheet's editable tiles under
  "change anything until 8:00 PM" (past), the Games tab "Ep 9 aired · set your lineup first". A carried lineup reads "All set"
  at 7:59 PM and "Set your lineup" at 8:00 PM. One false surface taxes trust in the others (if the lock is wrong, is the lineup?).
- **R3:** **one vocabulary and one tone map on every surface that night**: the strip, the badge, the sheet's head, Save's toast,
  the Games tab's card and the push. The window is always "before you watch"; yellow means missing, a tick means all in, a
  padlock means locked; no time already past; the badge counts what the strip calls due; a lineup doesn't change state at
  airtime unless something in it changed.
- **Citations:** Reber & Schwarz (1999) for fluency read as truth; Spence (2011) for every element telling the same story.

### L3 · Perception bias
- **Constraint:** people run on prediction and act on autopilot; a match passes unnoticed, a violation fires attention.
- **Violation:** the prior every fantasy player brings, which this app also taught for months, is "it locks at kickoff".
  "Locked" matches it, so scenario A never even taps: the window fails silently. Joanna's autopilot is the opposite: yellow
  says set it, so she sets it, though she watched.
- **R4:** the window is **said as open**, not merely not-locked: a deliberate break from the "locks at airtime" prior. The honour
  condition rides **in the same sentence as the invitation** ("Before you watch it", "Change it before you watch"), so the
  autopilot reader takes the condition with the action. The words are the person's frame ("before you watch"), never the
  system's ("late", "live pace", "until the next airing").
- **Citations:** Clark (2013) for prediction errors firing attention; Kahneman (2011) for autopilot decisions.

### L4 · Decision architecture
- **Constraint:** the environment decides most choices; a label must predict where it leads; near-term actions read best in
  concrete verbs; an alarm that rings without cause trains people to ignore it.
- **Violation:** for A the easiest path (not tapping a "Locked" strip) is the wrong one, and its scent predicts read-only. For B
  the easiest path (a glance) yields nothing. For Joanna the easiest path (tap the yellow, set it) is the dishonest one, and the
  honest exit, "I've watched it", is a dead end during the airing. If a complete carried lineup is "due" every week, the yellow
  rings for everyone behind every night and stops meaning anything.
- **R5:** **each person's right step is the easiest one**: A, one tap from "open" to the editable lineup; B, no tap; Joanna, the
  condition where the invitation is and an exit that never dead-ends (the words alone before results, Seen Ep 9? after); the
  drive-by's yellow kept for real gaps so it keeps its meaning. Concrete near-term verbs ("Change it", "Set your lineup"), never
  state words ("Locked", "Pending", "Late").
- **Citations:** Pirolli & Card (1999) for a label's scent predicting what's behind it; Green & Swets (1966) for false alarms
  shifting the criterion until a signal is ignored.

## Added by the user (2026-11-18), above the derivation

"We also don't want someone who's watching live to be mistaken that they can make moves because that would be cheating."
So R4 and R5 tighten: **a person watching live never reads an invitation to change as theirs.** The condition names the
moment they start ("when you start watching"), and the moment of change asks them (Your moves' question, Not yet / I'm
watching), so changing after the start takes a deliberate, untrue answer, never a misreading.

## R1 to R5

1. **R1:** two chunks at most, a state in the person's terms plus who you've got; no machinery in words; no new block.
2. **R2:** the 50 ms read is true: padlock only when locked for you, yellow only for a gap, who you've got as cast faces.
3. **R3:** one vocabulary and tone map across strip, badge, sheet, toast, Games card and push; nothing past; the badge equals the
   strip; nothing changes state at airtime unless it changed.
4. **R4:** said as open; the honour condition in the invitation's sentence; the person's frame.
5. **R5:** A one tap, B no tap, Joanna never dead-ended, the yellow kept for gaps; concrete verbs.

## What satisfies all five

A strip of the same height class that carries **one line of state with the condition in it and a row of cast faces**: the
starters as one group, the pick as another, an empty slot dashed, a missing pick dashed. The tone and glyph follow the truth
(yellow for a gap, a tick for all in, a padlock only when locked). One tap opens Your moves at the first game with something
missing, else the first game. The sheet's head, the toast, the Games card and the push say "before you watch"; the honour
note's "I've watched it" appears once results are in. The faces read as one gestalt (proximity groups them), so the strip stays
two chunks.

Eye order in the window: the show's name and "on air now" → Watch along → the strip's tone and faces → its line. With a gap,
the yellow takes the strip before Watch along: set it, then watch, which is the right order for that person.

## The three directions against R1 to R5

| | R1 | R2 | R3 | R4 | R5 |
| --- | --- | --- | --- | --- | --- |
| **A · Say it straight** (words, who one tap away) | Pass | Partial: no faces, B reads nothing pre-attentively | Pass with the sheet's words | Pass | Fail for B (one tap) |
| **B · Who you've got** (faces on the strip) | Pass: state + one face gestalt | Pass | Pass with the sheet's words | Pass | Pass |
| **C · Before you watch** (a plate per game on Tonight) | Fail: a block of three game rows, the state and the honour line (five chunks) pushes Last time out of the first view | Pass | Pass | Pass | Pass, at a cost to everything under it |

B is derived. A is the fix that ships if faces wait; C answers B fully for three games at once, at the first view's expense.

## The gap no direction closes

- **R3's "nothing changes state at airtime" and "the badge equals the strip"** hold only if a lineup carried in complete reads
  as set in the window. Today's server calls it due (due-moves.ts, your-move.ts, reminders.js): then every night the strip goes
  yellow and a push goes out for everyone behind, and R5's yellow stops meaning anything. That's the open question in the spec,
  and it decides more than any of the three directions.
- **Joanna's exit before results** is words only: nothing lets her say "I watched it, keep it as it is" until results exist.
  Closing that needs a rule (a seat's own lock for an episode), outside this round.
- **Cast faces next to the couch's faces:** two rows of 28 px faces on one view (the ruler's people, the strip's cast) must read
  as different things; the shape decides how (portrait tiles for cast, as the lineup sheet's tiles are).

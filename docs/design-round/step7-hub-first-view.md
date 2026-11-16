# The hub and the TV guide, first view: requirements (step 7)

Mode 2 derivation on [the page spec](step7-hub-spec.md), at 390 × 844, building on Phase 0's app-wide
[R1–R5](phase0-first-views.md) (the Hub row) and step 3's strip and progress control. Today's frames:
`.ui-atlas/stories/step7-hub/before/` (`hub-alex` caught up with a move due, `hub-sam` two behind with results waiting,
`hub-casey` a couch of two, `hub-guide` the guide inline, `hub-person-sheet`), measures in the `.json` beside each.

## The problem

Someone opens the app between other things and wants one answer before anything else: is anything waiting for me, and on which
show. Then: when is my next episode, where is everyone, what's on. Today Alex's first view (`hub-alex`) says the move three times
(the status line "2 moves due · your ZT Survivor pick locks Wed 8:00 PM", the plate's PICK "Make your Episode 6 pick", its line
"Locks Wed 8:00 PM · in 4 days") and the time three times (the plate's head "Ep 6 · Wed 8:00 PM", "WED 8:00 PM · IN 4 DAYS", the
lock), across 14 type sizes. The couch's faces carry no marks. The plate opens the show, not the move: Andrew's pick is two taps
and a scroll. What's on TV is 1.4 screens down, a seven-column reel whose columns are cut at 390 (`hub-guide`), and the hub is
3.5 screens tall.

## Foundation · Attention is spent before it's directed

**Constraint.** Onset motion and luminance contrast capture attention pre-attentively, before any goal directs it; the first
thing that moves or glows wins the first fixation whether it matters or not.

**Violation.** Today two things signal at once in the first view: the status line's yellow dot and the plate's yellow PICK tag
for the same move, and (on a live night) the On now row's pulsing dot beside them. Decision 7 adds a row that must be "really
animated": placed carelessly, its motion would take the first fixation from the yellow move, the one thing that's due.

**Citations:** Abrams & Christ (2003) for motion onset capturing attention; Theeuwes (1992) for salient singletons capturing
attention against the goal.

## L0 · Cognitive load

**Constraint.** Working memory holds three to five chunks, and unattended noise still spends it.

**Violation.** `hub-alex`: a status line, the couch's name and faces, a plate holding six parts (a tag, the season line, the name,
the countdown, the move plate, who's set with faces, Watch along), then Your shows' head: seven chunks, 14 type sizes, 91 words.
Who's set repeats the couch's faces 40 px under the couch's own row. `hub-sam`: 27 controls in view, because each poster's flip
and chips are controls.

**R1.** The hub's first view holds four chunks: the next thing (the plate: art, the show, its episode and when once, the one
thing for you), On TV, your people, and the head of your shows. Inside the plate, at most three lines of words under the name.
The move's lock is said once (as words when it isn't the airtime; not at all when it is: the plate's "Wed 8 PM" says it). Who's
set is a count on the move's line ("0 of 4 in"), never a second set of faces: the faces are your people's, once. At most six
type sizes in the first view. The guide's first view holds three chunks above its cards: the bar, the switch, the week.

**Citations:** Cowan (2001) for the three-to-five chunk ceiling; Hassin et al. (2009) for unattended noise spending working
memory.

## L1 · First impression

**Constraint.** Meaning is judged in about 50 ms; faces and scenes are processed first and fastest.

**Violation.** The plate's art lands well (`hub-alex`, `hub-casey`: Survivor's host on a beach is "TV night" at a glance). The
first 50 ms of the hub's top 120 px, though, is a grey status bar of words. The guide, the app's most TV-like object, is never in
the first impression; when reached it's a cut-off grid.

**R2.** The first 50 ms lands on the plate's art and the show's name, nothing above them but the bar. On TV's anchor is art too
(tonight's shows as small cards), so the row reads as TV, not as a link. With no art (a show added by name), the plate falls to
the show's name large on the night ground with its letter, and On TV's cards to their letters. The guide opens on what's on now
or next tonight, its art first.

**Citations:** Lindgaard et al. (2006) for the 50 ms gate; Bar et al. (2006) for scene gist ahead of detail.

## L2 · Processing fluency

**Constraint.** What's easy to process is judged truer and more likeable; one meaning should have one form.

**Violation.** The move has three forms in one view (status line, tag slab, plate). "Up next" means the show bar's tag, a Tonight
section and this plate. A friend's position is a ruler on Tonight, nothing on the hub, and "Up to Episode 25 of 30" in the sheet.

**R3.** The plate's move is the strip's object (step 3) in the plate's frame: the same tag ("Ep 6"), the same title ("Make your
pick", "Reveal Ep 4", "Your pick now", "All set for Ep 6") and the same yellow rule. A friend's mark is the ruler's (step 3): a
face at an episode number; on the hub, compact, a face with its number under it. On TV's cards are the guide's cards, small.

**Citations:** Reber & Schwarz (1999) for fluency judged as truth; Alter & Oppenheimer (2009) for fluency across forms.

## L3 · Perception bias

**Constraint.** People act on the prediction they arrive with; a match runs on autopilot, a mismatch fires attention.

**Violation.** Opening a TV app predicts "my show, and when"; opening it after a push predicts "the thing the push said". Today
both are met by the plate, then contradicted by the plate's tap (it opens the show, not the move). Yellow is spent twice on one
move, so its absence doesn't yet mean "nothing for you".

**R4.** The hub's one attention signal is the plate's yellow, and only when something is due (a move, a reveal); with nothing
due the plate has no yellow and no motion of its own, so "no yellow" reliably means "all set". On TV's motion is the second
signal and must lose to the first: it sits under the plate, starts after the plate has landed (about a second), moves slowly (a
reel's drift, not a flash), pauses under a finger, and never pulses except a live dot when something is on now. With reduced
motion it holds still and still reads as TV (art, the label, the live dot static).

**Citations:** Clark (2013) for prediction match and violation; Yantis & Jonides (1984) for abrupt onsets winning attention.

## L4 · Decision architecture

**Constraint.** Make the right choice the easiest; match the words to how near the commitment is.

**Violation.** The plate's move takes two taps and a scroll to its editor; the reveal one. The guide's switch (Couch, Competitions,
All TV, Sports) sits at its foot, under seven columns. A friend's mark needs a tap into their sheet.

**R5.** The plate's move opens its editor in one tap (the pick sheet, the lineup, the draft room); Reveal opens the reveal. The
show's name opens the show. A face's mark is readable without a tap; the face opens their sheet. On TV opens the guide at the day
tapped. In the guide, the switch is at the top beside the week, and a card opens what it is (your show, its sheet).

**Citations:** Hick (1952) for choice time with options; Trope & Liberman (2010) for concrete words at near commitments.

## R1–R5, together

1. **R1** Four chunks: the plate, On TV, your people, your shows' head. The lock once; who's set a count, no second faces; six
   type sizes at most. The guide: bar, switch, week, then cards.
2. **R2** The plate's art first, nothing above it but the bar; On TV is art too; deliberate no-art forms.
3. **R3** The plate's move is the strip's object; a friend's mark is the ruler's, compact; On TV's cards are the guide's.
4. **R4** One attention signal (the plate's yellow, only when due); On TV's motion under it, late, slow, held under a finger, still
   with reduced motion.
5. **R5** One tap from the plate to the move's editor; marks readable without a tap; the guide's switch at its top.

## What satisfies all five

**On TV's place: under the plate.** Above it (a crawl under the bar) the reel's motion would take the first fixation before the
yellow move (Foundation, R4) and push the plate's art down out of the first 50 ms (R2). Under it, the eye lands on the art, reads
the move, and the drift catches it next: noticeable, and second.

**The hub's first view, in the eye's order** (Alex: a move due):
1. The plate's art and the show's name (about 270 px, down from 330).
2. Its head: "Ep 6 · Wed 8 PM · in 4 days", once.
3. The move in yellow: "Make your pick" with "0 of 4 in"; "1 more move · Weekly Lineup" under the plate when there is one.
4. **On TV**, about 96 px: the label, a live dot when something's on, a drifting reel of small art cards with their times.
5. Your people, about 64 px: the couch's name and each face with its episode mark under it.
6. Your shows' head and the top of the posters.

**Never in the hub's first view:** a status line; the lock said twice; who's set as faces; Watch along when nothing's out to
watch; a second yellow; a poster's game chips; the guide's grid; the nudge, Streaming, the couch's numbers, Start / Join a couch
(except solo, where Start a couch is the point).

**By situation:** Sam (results waiting): the plate's yellow is Reveal Ep 4; On TV and people as above. All set: the plate quiet
("All set for Ep 6"), so On TV's drift is the most animated thing on the screen, rightly, as nothing's due. On now: the plate says
"On now · Ep 6" with the live tag (red, not yellow) and Watch along; On TV's live dot matches. Solo: Welcome in one line, the
plate, On TV, Your shows; Watching solo (Start a couch) under them.

**The guide's first view:** the bar ("On TV", back to Home, Add a show); the switch; the week (seven cells, today marked, the art
of your shows each day small); then today's cards, on now first. At least two cards in view.

## The spec's proposals against R1–R5

| Proposal | R1 | R2 | R3 | R4 | R5 |
| --- | --- | --- | --- | --- | --- |
| The status line folded into the plate | ✓ | ✓ | ✓ | ✓ one yellow | ✓ |
| Who's set inside the plate (with faces, as today) | ✗ faces twice | | | | |
| Who's set as a count on the move's line | ✓ | | ✓ | | |
| On TV above the plate | | ✗ art pushed down | | ✗ motion first | |
| On TV under the plate, late and slow | ✓ | ✓ | ✓ | ✓ | ✓ |
| People with marks | ✓ one row | ✓ faces | ✓ the ruler's mark | | ✓ no tap |
| The guide as a week of cells and a day's list | ✓ | ✓ | ✓ the cards kept | | ✓ |

## The gap

No proposal says how a mark reads when the plate's show isn't the one a person watches (they're on the couch for another
show): the face carries no number, and the row must not imply they're behind. And no part of today's app says a person is on a
show you don't watch from the hub; the person sheet does, a tap in.

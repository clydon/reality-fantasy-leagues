# Notifications and waivers: first-view requirements (step 8, Perception-First Design, Mode 2)

On [the spec](step8-notify-spec.md). Before frames: `.ui-atlas/stories/step8-notify/before/` and `.ui-atlas/stories/step8-waivers/before/`.

## The problem

**The push and the bell.** Someone's phone lights up for a second and a half; they read a title, maybe a body, and either tap or
don't. Later, on the hub, they open the bell to see what they missed. Today the title often spends its first words on a game's
name ("Lineup League: episode 5 airs in about 2 hours"), a tap lands near the thing rather than on it, and the bell opens on a
line repeating the hub's plate, then ten rows that each carry the same show's picture and a yellow dot, including a reminder for an
episode four days gone.

**Waivers.** Someone arrives from "Replace Carter by 8 PM" (or the strip) wanting to bring someone in and leave. Today the page
says the deadline three times and "Replace Carter" four, ticks seconds, shows three yellow buttons, and keeps who's free (the
choice itself) behind a button; the sweat can't compare without opening a sheet, the casual player has to open it to act.

## Foundation (L0): cognitive load

**Constraint.** Three to five chunks at once; unattended noise still costs (Hassin 2009). On a lock screen, one notice is one
chunk: the title. In a sheet, each repeated element is paid for on every row.

**Violation.** The bell's first view holds a due row, ten art thumbnails of one picture, ten yellow dots and a "10 new": four
signals for one fact (these are new). Waivers' first view holds a label, a countdown, a title, two chips, three rows with buttons,
a hint, and a sticky foot that repeats the title and the deadline: about nine chunks for one move.

**R1.** Each first view carries one fact once. The bell: what's new is said by a heading, not by marks on each row; a row's leading
mark carries information the row's words don't (its kind), never the same picture again; the due row goes (the plate behind the
sheet says it). Waivers: the move, its deadline and its options once; no sticky foot, no countdown in seconds, one accent.

**Citations:** Cowan (2010) for the 3-5 chunk ceiling; Hassin et al. (2009) for unattended noise spending working memory.

## L1: first impression

**Constraint.** The first 50 ms decide whether attention engages (Lindgaard 2006); on a lock screen the title is the first
impression, and a phone cuts it after about thirty characters.

**Violation.** Titles that lead with "Lineup League:" or "ZT Survivor 51:" spend the 50 ms on a name the person may not even think
in (they think "Survivor", not the game's name), and the cut falls on the news. Waivers' first glance lands on a yellow
"DUE WED 8:00 PM" label and a ticking "5:59:45", so the page's first impression is pressure, not the move.

**R2.** The first thing seen is the news for you. A push's title starts with the change ("Ep 6 pick locks in 2 hours", "You got
Maggie"), number first when an episode is the subject, inside ~32 characters. The bell's first row is the newest that needs you.
Waivers opens on what's yours to do ("Replace Carter"), then when, calmly ("by Wed 8 PM · in 2 days").

**Citations:** Lindgaard et al. (2006) for the 50 ms gate; Leder et al. (2004) for classification failing when the first stage
carries the wrong subject.

## L2: processing fluency

**Constraint.** What's easy to process feels true and safe; inconsistency across touchpoints erodes trust (Reber & Schwarz 1999;
Spence 2011).

**Violation.** Pushes speak three grammars (game-first, show-first, news-first), and "airs" means a lock in one and an airing in
another. Yellow means "your move" across the app but "new" in the bell; red means live or out but marks the bell's dot. The
waivers page names one move as "Replace Carter", "Swap", "Carter's spot is open" and "Replace by".

**R3.** One grammar and one colour per meaning, everywhere the same thing is said. Every push: title = the news, body = show ·
game · what to do. The same move carries the same words on the push, the bell, the strip and the waivers page ("Replace Carter").
Yellow only where a move is due; the bell's dot is not the live colour.

**Citations:** Reber & Schwarz (1999) for fluency read as truth; Spence (2011) for cross-touchpoint coherence.

## L3: prediction

**Constraint.** The brain predicts what a tap will show; a match passes on autopilot, a miss fires attention and costs trust
(Clark 2013).

**Violation.** "New prediction" opens the Games tab, not the bet; a reminder opens Tonight and the person must find the move; a
stale reminder in the bell predicts an action that's no longer possible. A notification list that isn't ordered by time breaks
the model every phone has taught (newest first). On waivers, "Choose who comes in" hides the answer to the question the push
raised (who?).

**R4.** Every way in meets its promise in the first view. A push's tap lands on the named thing with it open. The bell reads newest
first, in two bands people already know (New, Earlier), with only what's still true in it (a done or locked reminder leaves). A
waivers page reached from "Replace Carter" shows the people who could replace him in its first view.

**Citations:** Clark (2013) for predictive processing; Seckler et al. (2015) for trust as a perceptual output of coherence.

## L4: decision architecture

**Constraint.** Make the right choice the easiest; demonstrate rather than describe (Hertwig & Erev 2009); match option density to
the context: sparse at a decision, rich in the expert's space; no manufactured urgency.

**Violation.** The casual player must open a sheet to see any option, then tap a person, then a confirm labelled "Tap someone";
the sweat's numbers (each free person's weeks) aren't there at all; the seconds-ticking countdown is a casino's pressure the frame
rules out. A missed claim's safety net ("whoever's free with the most points comes in") is said, good, and is the reason Joanna can
ignore it.

**R5.** The decision sits where the question is asked: the top free options on the page, best first, each claimable in one tap
(Undo after), each showing its numbers week by week on one shared scale so the sweat compares across rows; the full list a tap
away. The deadline is stated, not counted down, until the last hour. The safety net stays in one line beside the move.

**Citations:** Hertwig & Erev (2009) for decisions from experience over description; Trope & Liberman (2010) for concrete
near-term wording ("Bring in Ori").

## The requirements, together

| | Requirement |
| --- | --- |
| R1 | One fact once per first view: no due row, no repeated art, no per-row new mark; waivers' move, deadline and options once, no sticky foot, one accent |
| R2 | The news first: a push's title is the change in ~32 characters, number first; waivers opens on the move, then the time, calmly |
| R3 | One grammar and one colour per meaning across push, bell, strip and page |
| R4 | Each tap lands on the named thing; the bell newest first in New and Earlier with only what's still true; waivers' first view shows who could come in |
| R5 | The top free options on the page, one tap to claim, weekly numbers on one scale, all a tap away; a stated deadline, not a ticking one |

## What satisfies all five

**The push:** the spec's grammar table as written, with one change from L2: the waiver reminder for someone who has seen the
episode uses the strip's own words ("Replace Carter by 8 PM").

**The bell, first view:** the head ("Notifications · 3 new"); **New**: rows newest first, each a kind icon, the title, a body that
starts with the show's short name, the time; a notice that needs a decision (a join request, a watch along asking "Are you in?")
leads New; **Earlier** below, the same rows a step quieter; a reminder whose move is made or locked isn't listed. The dot on the
bell is the foreground colour, not red.

**Waivers, first view (Alex, owed):** the bar (one game switch, only with two games); the move: "Replace Carter", "by Wed 8 PM · in
2 days", the safety net line; directly under it, **who could come in**: the three best free, each a row with the face, the name,
the tribe, the season's points and their weeks as small bars on one scale, tapped to claim (the claim then shows in the move:
"Ori comes in for Carter · Change"); "All 9 free" opens the picker. Your team, the picking order line and How it works follow below
the fold.

## The spec's two open questions, settled

1. **Who's free on the page: yes, three of them, as the move's options** (not a separate five-row block). R4 needs the answer to
   "who?" in the first view, and R5 needs the decision where the question is. Three fit under the move at 390 px with Your team's
   head in view; five would push it out (R1). In a quiet week, nobody can claim, so the list isn't shown (an element with no action
   would only cost attention): the quiet week shows Last time (the last run's moves) instead.
2. **The bell: by time only, New and Earlier, no show groups.** Show headers inside two time bands would be four headings in one
   view for a list most people read top down (R1), and newest first is the model every phone has taught (R4). The show is named
   once per row, first in its body, and the picture goes (R1, R3).

## Proposals tested

| Proposal | R1 | R2 | R3 | R4 | R5 |
| --- | --- | --- | --- | --- | --- |
| Today's bell | ✗ four signals for new, ten pictures | ✗ the due row first | ✗ yellow for new | ✗ stale reminders | |
| Bell grouped by show (the spec's option) | ✗ four headings | | ✓ | ✗ breaks newest first | |
| Today's waivers | ✗ nine chunks | ✗ a countdown first | ✗ four names for one move | ✗ no one shown | ✗ two sheets to act |
| Who's free as a five-row block (the spec) | ✗ Your team below the fold | ✓ | ✓ | ✓ | ✓ |
| Three options under the move | ✓ | ✓ | ✓ | ✓ | ✓ |

## The gap

No version on the table claimed in one tap from the page. That's the non-obvious part: the casual player's path from the push is
two taps (open, tap Ori) with the safety net if they don't, and the sweat's numbers ride on the same rows rather than in a block of
their own.

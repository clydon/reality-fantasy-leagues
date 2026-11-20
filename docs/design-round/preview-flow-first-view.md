# The live preview's flow: first-view requirements (Perception-First Design, step 2)

Mode 2 derivation on docs/design-round/preview-flow-spec.md, at 390 px. Four first views: Try it with its allowance line, the wait,
the refusals on the wait's frame, and the desk's Game previews row and sheet.

## The problem

A person mid-setup wants to watch the game before making it. What stands between them and that: a limit they never chose (five a
day) that they can't see until it bites; a wait whose length they can't judge; refusals that all look like the same failure, so
they can't tell "me", "everyone" and "this game" apart, or whether the failure cost them; and, for the admin, a budget measured in a
unit (CPU) that means nothing at a glance.

## Layer by layer

### L0, cognitive load
**Constraint.** Working memory holds about four chunks, and unattended visual noise spends it anyway.
**Violation.** The gallery's game page is already dense (about, effort, length, lock, popular changes). A count added as a badge,
a second button or a sentence would compete with every other chunk. The wait today holds five things (tag, headline, sentence, bar,
counter), and the counter is one that changes twice a second, which the eye can't ignore. Refusals put a status and a server string
where a person expects a next step.
**R1.** Each view holds **at most three chunks that matter**, and nothing that moves except the one thing that means "working":
- Try it: the button, and one line under its row (one chunk, the count first).
- The wait: what's being made (the tag and the game's name read as one), that it's working (the sweep), and the way out (Back). The
  allowance is a footnote, not a fourth headline.
- A refusal: what happened, whose it is, what to do (one button, at most a second, quieter one).
- The desk's sheet: the choice, then the month as one bar with one line.
**Citations:** Cowan (2001) for the four-chunk ceiling; Hassin et al. (2009) for unattended noise spending working memory.

### L1, first impression
**Constraint.** The first glance (about 50 ms) decides whether things are fine or not, before any word is read.
**Violation.** Today every refusal and failure wears "The preview didn't come together": the glance says "broken" even when nothing
broke (none left today is a rule working, busy is a queue). A red or warning tone would say "your fault" or "danger" for what is
mostly ordinary.
**R2.** The first glance must **separate three kinds by shape, not by reading**: *working* (the sweep, nothing else moving), *a
limit* (calm, the same ink as the wait, no warning colour, the headline names the limit), and *gone* (ended or a used link: no
sweep, a single way back). No refusal uses the app's error or danger colour; none of them is the person's fault, and a limit drawn
like a fault is read as one.
**Citations:** Lindgaard et al. (2006) for the 50 ms judgement; Leder et al. (2004) for classification before evaluation.

### L2, processing fluency
**Constraint.** What's easy to process feels true and trustworthy; inconsistency is read as unreliability.
**Violation.** Ten refusals written ten ways (the server's strings: "Busy: try again in a minute.", "Previews are full this month:
back on the 1st.", a 422's gap reason) read as an unfinished feature. The desk's percentage of "CPU" is a unit the admin has to
translate.
**R3.** **One grammar for every refusal**: a headline that names the situation in the person's terms ("No previews left today",
"Lots of previews right now", "Previews are full this month"), one line that says what to do or when it changes, then the button.
Where a use was given back, the same four words every time: "This one wasn't counted." The allowance always as "n previews left
today" (never "uses", "credits" or a fraction). The desk's month in the desk's own unit, **previews and a share of the budget**
("120 previews · 40% of the budget"), never seconds or CPU.
**Citations:** Reber & Schwarz (1999) for fluent wording read as true; Alter & Oppenheimer (2009) for fluency carrying trust.

### L3, perception bias
**Constraint.** People act on what they predict and rationalise afterwards; a violated prediction is what grabs attention.
**Violation.** Three predictions go wrong today. (1) A number near a button predicts "this costs that": shown on the wait, "Uses 1
of your 3" reads as *already paid* before the preview exists, so a failure afterwards feels like a loss. (2) A rising seconds counter
predicts "slow and getting slower"; at 6 s on a 2 to 7 s task it reads as stuck. (3) A badge-shaped count predicts "something to
clear", inviting taps to make it go away.
**R4.** Say the cost **as what's left, before the tap, and as given back after a failure**, never as a charge during the wait:
- Try it's line is the only place the count is first read ("3 previews left today"), in plain text under the button row, not on it,
  not in a pill.
- The wait says nothing about cost while it works (the allowance line there is removed from the spec's proposal); it appears only
  when the outcome is known: in a refusal ("This one wasn't counted") or not at all.
- No elapsed time. After 8 s, one reassurance that predicts the end ("a long season takes up to half a minute"), so the wait stays
  inside the person's prediction.
**Citations:** Clark (2013) for prediction errors drawing attention; Kahneman (2011) for loss framing weighed above gain.

### L4, decision architecture
**Constraint.** The environment makes the right next step the easiest one; decisions from experience beat decisions from
description.
**Violation.** A refusal with only "Try again" sends people round a loop that can't succeed (none left, full, off); one with no
action at all is a dead end. The desk's three choices with a "recommended" mark would push one release stage regardless of where the
release is.
**R5.** **Every frame has exactly one primary way on that can succeed now**: Back to the game when nothing can change soon (none
left, full, off, can't be previewed, ended); Try again only when a minute can change it (busy, not answering, a failed make); Sign
in when that's the block. A used link opens the app, nothing about whose. On the desk, no recommended choice; the month's bar sits
under the choices so the admin decides with the budget in view (experience, not a rule).
**Citations:** Hertwig & Erev (2009) for deciding with the outcome in view; Thaler & Sunstein (2008, via the framework's L4) for the
easiest path being the right one.

## R1 to R5

- **R1** At most three chunks per view; only the "working" mark moves.
- **R2** Working, a limit and gone are told apart by shape at a glance; no refusal wears an error colour.
- **R3** One grammar for every refusal; "This one wasn't counted" verbatim; "n previews left today"; the desk in previews and a share.
- **R4** The count is read before the tap, never as a charge during the wait; no elapsed time; one end-predicting line after 8 s.
- **R5** One primary way on that can succeed now; Try again only where a minute changes it; no recommended release stage.

## The first views (what satisfies all five)

1. **Try it.** Eye order: the button (unchanged place, unchanged weight), then the line under its row, muted, 13 px, the count
   first: "3 previews left today". Ready: "Your preview is ready: opens free" (the one state in foreground ink, as it's good news).
   None left: "No previews left today: more tomorrow". No pill, no number on the button.
2. **The wait.** Eye order: "Made-up season" tag and the game's name (one unit), the sentence, the sweep. Back to the game at the
   foot, quiet. Nothing else; after 8 s the sentence's line below the sweep says "Still going: a long season takes up to half a
   minute." **Change from the spec:** no "Uses 1 of your 3 left today" on the wait (R4).
3. **A refusal.** The same frame, the sweep gone: the tag, the headline in the person's terms, one line (with "This one wasn't
   counted." last where it applies), one primary button (Back to the game, or Try again), a second quiet one only where both make
   sense. Foreground ink throughout; no red, no icon of alarm.
4. **Gone (ended, a used link).** The same frame, its headline and one line, one way back. Identical for used, expired and unknown.
5. **The desk.** The row reads "Game previews · Site admins only · 12 this month" (the value first, the count after). The sheet: the
   three choices as cards; under them a thin bar (the budget's share, in the desk's ink, yellow only past 80%) and one line, "This
   month: 12 previews · 3% of the budget". Not answering: the line alone, no bar.

## Testing the spec's proposals

| Proposal | R1 | R2 | R3 | R4 | R5 | Note |
| --- | --- | --- | --- | --- | --- | --- |
| Count under the button row, not on it | ✓ | ✓ | ✓ | ✓ | ✓ | |
| "Uses 1 of your 3 left today" on the wait | ✗ | ✓ | ✓ | ✗ | ✓ | a fourth chunk; reads as paid before the outcome: **dropped** |
| Seconds counter removed, 8 s line | ✓ | ✓ | ✓ | ✓ | ✓ | |
| Refusals on the wait's frame, one table | ✓ | ✓ | ✓ | ✓ | ✓ | needs the calm tone (R2) said in the build |
| "This one wasn't counted" | ✓ | ✓ | ✓ | ✓ | ✓ | |
| Desk: no recommended choice, month under the choices | ✓ | ✓ | ✓ | ✓ | ✓ | |
| Desk row dot past 80% | ✓ | ✓ | ✓ | ✓ | ✓ | the only alert |

## The gap

R4's split of the allowance (read before, never charged during) is what no existing screen did: the spec put the count on the wait
too. And R2's calm limit tone has no precedent in the app's states, which use the error frame for anything that isn't success; the
build needs the limit to look like the wait standing still, not like a failure.

*Initial findings. Ralph Loop a requirement, cite further, switch to analyze / evaluate, or ask any follow-up to dig deeper.*

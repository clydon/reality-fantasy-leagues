# One episode at a time: first-view requirements (PFD, Mode 2 derivation)

On [the page spec](step-through-spec.md). Tonight's tall progress control, at the foot of the show bar over the art, top of the
first phone view at 390 px, while you're behind on an airing show.

## 1. The problem

Someone opens Tonight having watched some of what's aired. They need to tell the app exactly how far they've watched, so the
episode they just saw opens and nothing past it does. The control offers one answer that over-claims (Yes: both) and one that
under-claims (Not yet: neither). The exact answer ("just 9") is reachable only through the question's own words, which don't look
tappable. The person either lies to the app (and is spoiled, or hides what they saw) or gives up.

## 2. Bottom-up

### Foundation (L0): cognitive load

**Constraint.** Working memory holds about three to five chunks, and anything unattended in the view still spends some of it.
A yes/no prompt is cheap only when the person's state maps onto one answer without composing anything.

**Violation.** "Seen Ep 9 and 10?" is a compound proposition. For Andrew (saw 9) both answers are false, so Andrew holds the mismatch,
searches for a third option, and has to invent the door. That is extraneous load at the control's most common moment. The
episode stack (two numbers in the question, the mark under it, the ruler's eleven ticks, faces) is already four chunks before the search
begins.

**R1.** Every true state of the viewer (saw none, saw the next one, saw some, saw all) **must** map onto one visible answer with no
composition. The first view must add **no more than one new chunk** over the caught-up control (the question replaces the mark
line; it doesn't sit beside it).
**Citations:** Cowan (2010) for the three-to-five chunk ceiling; Sweller (1988) for extraneous load competing with the task.

### L1: first-impression architecture

**Constraint.** The view is classified in a glance, before reading: "what is this, is it for me, what do I do". The top of Tonight
is the show's art (Traitors' cast, a dark backdrop) with white type over it. The thing that switches attention on must be one
shape, in the one place the eye lands after the title.

**Violation.** Today the question and its two buttons look like any confirm prompt; the ruler beneath carries the actual
information (where you are, how much is out) but reads as decoration, because its out run (8 to 10) looks the same as the aired
run. A first glance says "a yes/no about Traitors", not "you're two behind; which have you seen".

**R2.** In the first glance the control **must** read as *the next step from where you are*: the next episode's number as the
largest thing in the control, and the out run visibly different from the seen run, so "two out past your mark" is perceived, not
read. Nothing in it may compete with the show's title for first fixation.
**Citations:** Lindgaard et al. (2006) for the glance-time classification; Wertheimer (1923) for grouping by similarity (the out
run as its own group).

### L2: processing fluency

**Constraint.** What's easy to process feels true and safe. Fluency comes from consistency: one control that always speaks the
same way, the same words on every tab.

**Violation.** The compact line on Episodes, Games and Cast says **"I watched Ep 9"**; Tonight says **"Seen Ep 9 and 10?"**. The same
mark is described two ways a swipe apart, and the spoiler guard's sheet says "Seen up to Ep 10?". Three wordings for one act.
After Not yet the control changes form again ("Catching up · Ep 9 next" and only Watch along).

**R3.** One episode-stepping vocabulary across Tonight, the compact line, the guard and the recap's end: **the act names a single
episode** ("Seen Ep 9", "I watched Ep 9"), and a range is only ever an explicit extension of it ("Ep 10 too"). The control's form
**must** stay the same before and after Not yet (only the question words go quiet).
**Citations:** Reber & Schwarz (1999) for fluency as felt truth; Alter & Oppenheimer (2009) for fluency carrying into trust and
confidence.

### L3: perception bias

**Constraint.** People act on autopilot and rationalize after. They predict the interface from habit; a match passes unnoticed and
a violation fires attention. TV habit is episodic: every streaming app's "next episode" advances by one, and trackers check off
one at a time. Expectation: answering about what I watched moves me one step.

**Violation.** "Yes" is the habitual tap. Autopilot answers it; the range in the question is read only after, too late (the guard
sheet then says "Seen up to Ep 10?", which an autopilot tap also confirms). The design turns a habit into a spoiler. Separately,
people don't report their exact state when the cost of exactness is a hunt: they round to the nearest offered answer.

**R4.** The habitual tap **must** be the safe one: autopilot's Yes may only ever claim the **next** episode. Claiming more than one
**must** require attention: a separately-placed, separately-worded control, never the default and never the same position as Yes.
**Citations:** Clark (2013) for prediction match and violation; Nisbett & Wilson (1977) for acting first and explaining after.

### L4: decision architecture

**Constraint.** The environment makes the right choice the easiest one. Paths to equivalent truths must be symmetric (L4 symmetry:
the cost of saying the less-convenient true thing should not exceed the convenient one's). Near-term actions want concrete words.

**Violation.** Today: say "both" = 2 taps; say "just 9" = 4 taps through a door that doesn't look like one. The cost ratio is over
2×, which pushes people toward over-claiming, the one answer that spoils. And "Not yet" ends in a state with no next step except
Watch along, so it isn't a real exit either.

**R5.** The three true answers **must** cost the same: just the next one, more than one, and not yet, each **≤ 2 taps** to a settled
state, each from the first view or the one sheet it opens. Every exit **must** leave the next step in reach (after Not yet, "I
watched Ep 9" is still one tap). Words are concrete and near: the episode's number, "Seen", "too", never "up to date" or
"catch up" as the act.
**Citations:** Thaler & Sunstein (2008) for choice architecture making the right choice easy; Trope & Liberman (2010) for concrete
language at near commitments.

## 3. The requirements, all binding

| | Requirement |
| --- | --- |
| R1 | Every true state maps onto one visible answer; the behind control adds ≤ 1 chunk over the caught-up one |
| R2 | At a glance: the next episode's number leads the control, the out run looks different from the seen run, nothing outranks the show's title |
| R3 | One vocabulary: the act names one episode; a range is an explicit "too"; the form survives Not yet |
| R4 | Autopilot's tap claims only the next episode; more than one takes a separately placed, separately worded control |
| R5 | Just this one, more than one, not yet: each ≤ 2 taps to settled, symmetric; every exit leaves the next step one tap away |

## 4. What satisfies all five

The first view: **one line that names the next episode, its answer beside it, and the out run marked on the ruler under it**.
"Seen Ep 9?" with **Yes** and **Not yet** (R1, R4: autopilot is safe); Ep 9's number the biggest type in the control (R2); the
ruler's 9 and 10 drawn as *out, unseen* (hollow ticks, a dashed run from your face to the latest) so "two out" is seen without a
sentence (R2). The range lives **one tap in**, in the guard: its primary "Yes, Ep 9", its secondary "**I've seen Ep 10 too**" on its
own row (R4, R5: both truths cost 2). The guard is the only sheet, so every path is ≤ 2 taps (R5). After Not yet the line keeps its
shape, the question becomes the mark ("Catching up · through Ep 8"), and **I watched Ep 9** is the action again (R3, R5).

That is look **A**'s structure. B and C pass only partly:

## 5. The three looks against R1 to R5

| | R1 load | R2 glance | R3 vocabulary | R4 autopilot | R5 symmetry | Risk |
| --- | --- | --- | --- | --- | --- | --- |
| **A · The next one** | pass: one proposition | pass if the ruler marks the out run; the line alone doesn't show "how many" | pass | pass | pass (both 2) | the range is invisible until the guard: Joanna learns it once |
| **B · Pick how far** | **at risk**: n stops = n answers; fine at 2, over the ceiling at 5+ (needs the gap rule) | pass: the stops *are* the out run | pass if each stop says "through 9" | **at risk**: the last stop ("10", the latest) is where a thumb lands for "done"; the stops are equal-weight so the safe one isn't the default | pass (both 2) | equal stops make over-claiming one tap; the row adds a chunk (a new row above the ruler) |
| **C · Move your face** | pass: no new element | strong: the ruler becomes the answer | weak: no words name the act until the guard | **at risk**: the ruler's tap already opens Where everyone is; a stop and the ruler's door share one target | at risk at 30 episodes: ticks 11 px apart (below a thumb's 44) without a zoomed run | discoverability depends on a hint line; direct manipulation is the most natural *once seen* |

## 6. The gap

No look as framed satisfies **R2's "how many are out" and R4's "autopilot is safe" together** on the first view: A satisfies R4
and leaves R2 to the ruler; B and C satisfy R2 by making every out episode an equal target, which breaks R4. The non-obvious
answer is to **split the two jobs across the two parts that are already there**: the line asks one question (R4), and the ruler,
not a new row, shows the out run (R2) as perception, not as buttons. B and C are worth mocking as the user's comparison, but each
should carry the fix for its risk: B gives the next stop the weight (filled, first, labelled "Seen Ep 9") and the rest a quieter
form; C keeps a one-line question above the ruler and zooms the run from your mark to the latest so its stops are thumb-sized.

## Hand-on to Impeccable: what the first view must and mustn't hold

- **Must:** the next episode's number, the one-tap answer, Not yet, the out run distinguishable on the ruler, your face at your mark.
- **Must not:** a second episode number as a co-equal answer on the line (A); any new row taller than the line it replaces; titles
  or who left past your mark; a second yellow (the due move's, or the reveal's when it holds it).
- **The eye's order:** the show's title → the question's episode number → Yes → the ruler's out run → Last time.

> *Initial findings. Ralph Loop a requirement, cite further, switch to analyze / evaluate, or ask any follow-up to dig deeper.*

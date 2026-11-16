# Chat: first-view requirements (step 9, Perception-First Design, Mode 2)

On [the spec](step9-chat-spec.md). Before frames: `.ui-atlas/stories/step9-chat/before/`.

## The problem

Someone opens Chat to see what the couch said and add to it. The stream opens at the newest message, which is right; but once they
scroll, nothing says which episode the talk is about (only day dividers), every episode adds one reveal line per person, and the
composer's hint wraps to two lines above the keyboard.

## Foundation (L0): cognitive load

**Constraint.** Three to five chunks; unattended noise still costs (Cowan 2010; Hassin 2009). **Violation.** In alex's first view,
5 of 13 rows are dividers or reveal lines ("riley revealed Episode 5", "jordan revealed Episode 5", "FRI, NOV 13", "TODAY"...): a
third of the view is chrome. **R1.** Chrome per episode, not per person: one reveal line per episode naming everyone who revealed;
a day divider and an episode landmark that fall together are one line.
**Citations:** Cowan (2010) for the chunk ceiling; Hassin et al. (2009) for unattended noise.

## L1: first impression

**Constraint.** The first glance decides whether this is "the conversation" (Lindgaard 2006). **Violation.** None at the bottom:
the newest messages and the composer are there. **R2.** Opens at the newest message with the composer under it, as today; the
composer's hint fits one line.
**Citations:** Lindgaard et al. (2006) for the first glance.

## L2: fluency

**Constraint.** One form per meaning across the app (Reber & Schwarz 1999). **Violation.** Episodes are "Ep 5" on every other tab
but "Episode 5" in reveal lines and no form at all as a place in the chat; your own reaction wears the move's yellow. **R3.** The
episode landmark uses the app's episode form ("Ep 5", caption type) and differs from a day divider at a glance; yellow stays the
move's.
**Citations:** Reber & Schwarz (1999) for fluency; Spence (2011) for coherence.

## L3: prediction

**Constraint.** Scrolling predicts where you are (Clark 2013). **Violation.** Scrolled up, "that vote was cold" has no episode
above it. **R4.** The nearest landmark above any message says which episode's talk it is; an episode's fold sits under its own
landmark.
**Citations:** Clark (2013) for prediction; Passini-style wayfinding (orientation cues) via Seckler et al. (2015) for coherence as
trust.

## L4: decision architecture

**Constraint.** Make the easy thing the right one. **Violation.** None of weight: react, reply, GIF, and the fold's Reveal sit
where the question is raised. **R5.** Keep the fold's two actions (Reveal where you meet the fold; Show them for the curious) and
the composer's three controls.
**Citations:** Hertwig & Erev (2009) for acting where the question is met.

## Requirements

| | |
| --- | --- |
| R1 | One reveal line per episode; a landmark and a day divider that fall together merge |
| R2 | Opens at the newest, composer below; the hint on one line |
| R3 | Landmarks in the app's "Ep 5" form, unlike a day divider; no yellow off the move |
| R4 | Every message has its episode's landmark above it; a fold under its own episode |
| R5 | The fold's Reveal and Show them, the composer's GIF, box, Send: kept |

## What satisfies all five

The spec's structure: days, with an episode landmark at each airing ("Ep 5 · aired Wed 8 PM", the episode chip's form, a rule
either side), that episode's reveal lines folded into one under it ("riley and jordan revealed it"); where the landmark and the
day's divider would sit back to back, the landmark carries the day. Composer hint "Message the couch". **Settled:** episodes are
landmarks (yes); reveal lines grouped (yes); the fold unchanged.

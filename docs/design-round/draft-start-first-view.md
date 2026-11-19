# A draft that waits for whoever runs the game: first-view requirements (Perception-First Design, Mode 2)

Round 5 (2026-11-19), on [the spec](draft-start-spec.md). The surface: the strip under the show bar on every show tab, and the
game page's strip and the hub's plate that say the same, at 390 px.

## The problem

Whoever runs a game with an unscheduled draft opens any show tab and must register, in the first glance at its top, that
something waits on them and what it is. Everyone else in it must register that a draft is coming and that it isn't theirs to do,
without taking it for being set ("All set") or for a move of their own. Today the strip tells all of them "All set for Ep 9" with a
tick: the one moment the runner's attention is needed, the strip turns it off.

## Layer by layer

**L0, load.** The strip's states share one shape (a tag, a title, a line, a chevron). A new state told apart only by its words costs
a full read to sort, and the runner's job beside another due move doubles the decision.
- **R1.** The strip sorts in one look before a word is read: by tone and icon (a yellow plate is yours to do; a tick, set; a lock,
  locked), and the waiting state gets its own icon on the quiet panel, never the tick. The title carries the one fact, the line at
  most one reason. With another move due as well, the draft leads and the rest is a count ("Start the draft · 1 more"), never two
  titles of equal weight.
  **Citations:** Cowan (2001) for the 3 to 5 chunk ceiling; Treisman & Gelade (1980) for tone and shape sorted before reading.

**L1, first impression.** The first 50 ms decides whether attention turns on. A quiet panel with a tick says "nothing for me", to
the runner, exactly when it's theirs.
- **R2.** For the runner the first glance must turn attention on, with the shape every due move already has (the yellow plate, the
  chyron tag) and the game's own word for it ("Draft"), so it's read as the move it is. For everyone else the first glance must
  not turn it on (no yellow) and must not falsely turn it off (no tick): the gist is "something's coming, and it isn't yours".
  **Citations:** Lindgaard et al. (2006) for the 50 ms gist; Leder et al. (2004) for a classification stage that fails apart from
  the later ones.

**L2, fluency.** One fact said three ways reads as three facts: Backstage says "Schedule the draft", the room "Start it when
everyone's in", the strip "All set".
- **R3.** The same fact in the same words on every surface: the tag "Draft"; "Start the draft" for the runner on the strip, the
  game page and the hub, and the room's button its continuation ("Start the draft now"); "Waiting for Riley to start the draft" for
  everyone else, on the strip, the game page and the room's card.
  **Citations:** Reber & Schwarz (1999) for easy-to-process read as true; Spence (2011) for coherence across touchpoints.

**L3, priors.** People rely on "the app tells me when it's my move" and never test a status that matches it: a false "All set" is
never doubted (the 2026-11-18 strip entry: a false status costs more than a missing one). The runner also carries the prior "a
draft starts on its own", which is true here only when a time is set.
- **R4.** The runner's line states the prior's exception and why it's theirs, in the same sentence: "Nobody can pick until you do".
  Everyone else's names the person ("Waiting for Riley"), because a named wait is believed and can be acted on (a nudge on the
  couch), where "whoever runs the game" reads as a system's state.
  **Citations:** Clark (2013) for prediction errors as what turns attention on; Kahneman (2011) for autopilot on priors.

**L4, decision.** The runner's job sits two levels down. Starting is a near-term commitment that opens picking and pushes everyone.
- **R5.** One tap from the strip to where Start lives, and the start itself one deliberate tap there, never from the strip; the
  other way (Pick a time) beside it, as easy to reach but lighter. Everyone else's strip opens the same room (who's in, when it
  starts) and asks nothing.
  **Citations:** Trope & Liberman (2010) for concrete words at near-term action; Hertwig & Erev (2009) for seeing the room rather
  than being told about it.

## What must be first, what must not be there, the order

- **First (the runner):** the yellow plate with "Draft", then "Start the draft", then why ("Nobody can pick until you do").
- **First (everyone else):** the quiet panel with the waiting icon and "Draft", then who it waits for.
- **Not there:** a tick or the words "All set" in a game whose draft hasn't started; a Start button on the strip; a second runner-only
  card competing with the strip; the episode's air time again (the show bar has it).
- **How much at once:** one state, one fact, one reason, the chevron.

## The proposals against R1 to R5

- **Today's "All set for Ep 9":** fails R2 (turns the runner off) and R4 (a false status nobody tests).
- **A separate runner-only component** (the user's "maybe"): meets R2 for the runner, but fails R1 (two statements of what's yours,
  two yellows) and R3 (a new shape and new words for a kind of thing the strip already says).
- **The gap:** the strip has no quiet shape for "coming, and not yours": all its quiet tones say something about your own move (set,
  locked, waits on a reveal). R1 and R2 need one more quiet tone, with its own icon.

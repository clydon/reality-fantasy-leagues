# Start a game, where you are: the steps and each view's job (Round 2c, on the bold pass)

The user, 2026-11-18, on the bold pass's game screen: "it seems a bit dated compared to the rest of the bold design choices. it is no
apparent we are setting 'How Long' since that text is so small compared to everything else. we need to make sure each step thru the
Create a Game process is clear to the user so they know what part of the game create they are at. ... redesign that section then go
thru the other sections of the create a game process and make sure the user would be clear what the intention of this page/view is."

## 1. Intent: the steps, and what each view is for

**Three steps, named everywhere:** 1 **Choose a game** (the gallery, search, a ready or saved game, Describe), 2 **Set it up** (the
game's screen and everything it opens), 3 **Start** (Ask the couch first, what Start makes). Every view says which step it's in and
what it's for, in its head, before anything else.

**The game screen is three decisions and a review,** each a question with its answer in view:
- **How long?** The answer ("The rest of the season · Episode 9 to the finale"), the season as a timeline with the stretch marked,
  then every length as a card. Today's chip row (half its options off the edge) and 15 px label go.
- **When do moves lock?** Where the couch is (who's behind, by how much), then each way as a card with what it means and who it would
  cost. Choosing the card is the fix (no separate screen, no Change link).
- **The rules:** Make it… first (by goal), then every rule as a line, your own moments, Find a change.

**Each view's job, said in its head and first line:**

| View | Its head | Its first line |
|---|---|---|
| The gallery | Choose a game | (the field and the shelves say it) |
| A game's screen | Set it up | the title card: the game's name and what it is |
| A rule's change | its question ("How does someone win?") | "Pick one for Outlast." |
| The questions | What everyone answers | "Each episode, before it airs." |
| Your own moments | Your own moments | "Something the results won't catch?" |
| Every rule | Every rule | "Outlast, in the engine's words." |
| Try it | Try it | "How Outlast plays, step by step. Nothing saves." |
| Ask the couch first | Ask the couch first | "They see this, and Start waits for their yes." |
| What Start makes | Ready to start | "This is the game Start makes." |
| Describe | Describe your game | (its field says it) |
| Community and saved / a ready game | Choose a game | "A ready-made game: start a copy, or change it first." |

Left out: a step for "invite" (Start already tells the couch, and Ask is part of starting).

## 2. Perception-First Design: first-view requirements

- **R1 (load):** a game screen's first view holds the step line, the title card, what everyone does with Try it, and How long's
  question with its answer and timeline; its cards may start below the fold. Never more than one decision's options in view at once.
- **R2 (first impression):** the decisions read as the page's structure. Question heads at section size (26 px condensed caps), not
  15 px labels, and the season drawn as a timeline, not a row of form boxes.
- **R3 (fluency):** one shape for every decision: the question, the answer, the options as cards. The same option card for a length,
  a lock and a rule's choice; chosen looks the same everywhere (DESIGN.md's flow: a white plate, a chyron-line outline, a tick).
- **R4 (bias):** consequences sit on the option. The length card says where it ends and how many episodes; the lock card says
  who'd miss moves; a card that can't be had says why.
- **R5 (decision architecture):** where you are (step 2 of 3) and the current answer are always in view; the recommended way is
  marked; one tap changes it, one tap back.
- Citations: Cowan (2001) for the load ceiling; Lindgaard et al. (2006) for the first look; Reber and Schwarz (1999) for one shape
  read as true; Nielsen (1994) for visibility of system status and recognition over recall.

## 3. Impeccable: the shape

- **The step line** (the sheet's subtitle): three 4 px segments, chyron-line up to the current step (DESIGN.md lists progress
  segments under chyron-line), then "2 of 3 · Set it up · Survivor 51" in 13 px.
- **A question head:** 26 px condensed caps in bone, the answer under it in 16 px semibold, a detail line in 14 px.
- **The timeline:** one bar 52 px tall; the aired run folded and dashed; the chosen stretch one joined band (a 2 px bone outline and
  a faint fill, never a heavy fill: Start keeps that); stage names above it; the finale at the end. It fits 30 episodes (the long
  seasons rule) by folding the rest.
- **Option cards:** two across for lengths, stacked for locks; 64 px or more; a night panel with a hairline; chosen as a white plate
  with a 3 px chyron-line outline and a tick; can't-be-had dashed with why.
- **No new motion.** Yellow stays on Start.

# Tonight's games, the night: the visual brief

- **Job and mode.** Operate. The day after an episode, someone reads how the night went for them in each game and how everyone
  else did; Joanna and Andrew read the closed cards and leave, Conor opens them. Structure: [the page spec](tonight-night-spec.md);
  first view: [R1–R5](tonight-night-first-view.md).
- **Direction: the night as a results crawl.** The committed world, Lower Third on Night. The section is a rundown under one
  heading ("Your night · Ep 6"), each game a hairline-separated block, never a boxed card. The block's spine is one broadcast
  line: the place as a condensed tabular number (30 px), a movement caret beside it (teal up, bone down, a muted dash held), "of 5"
  and the game's measure small, and at the right edge the night's change in condensed numerals (22 px). Under it, the picks are the
  picture: cast faces (36 px, 3 px corners) wearing their result (points under a starter, a teal check on a pick that stayed, a
  live-red cross and grey on one who went home). The last line is the couch: one face and the night's news about someone else in
  normal-width 14 px, the couch's faces stacked small at the right, a chevron that turns. Open, everything under the head drops into
  a panel well (night panel, no shadow): your ledger, then everyone's rows on one scale, See all.
- **The focal moment and the one motion.** A card's change plays once, the first time it is half in view after a new episode: the
  old place slides up and out as the new one rises in (a broadcast number flip, `translateY` and opacity, 420 ms, the exponential
  ease-out), the caret slides in after it, a lineup's bars grow (`scaleX`), a lost face greys and its cross lands. Nothing else
  moves; reduced motion shows the end state.
- **Colour.** Yellow nowhere in the section (nothing here is due; the strip holds it). Teal for an up caret, a pick that stayed,
  a won week and the couch's best night. Live red only for a castaway who went home. People colours on avatars; game inks only on
  the head's dot.
- **Quick games and extras** use the same spine: a quick game's place line becomes its result ("Riley won", the winner's face);
  the extras are one block with a line each: bingo as small three-by-three cards (ticked squares filled in bone, a counted line in
  teal), trivia as three dots a person.
- **A watcher's Join row** is a Next-block row like its neighbours (icon slot, title, one detail line), the couch's faces stacked,
  and an outlined Join (`Btn tone="optional"`), never yellow.
- **States and ranges.** 1 to 12 people a game (five rows open, then See all); 1 to 9 games (three, then a fold row with a chip a
  game); a lineup of 1 to 9 starters (five faces, then "+n"); names to 20 characters (truncate in rows, never on the couch line's
  subject); a friend behind (their row says so, no picks); early results ("so far"); no couch (solo: no couch line, no open).
- **Untouched.** The show bar, the strip, Last time, Stats, the game page, the sheets the rows open, the reveal.

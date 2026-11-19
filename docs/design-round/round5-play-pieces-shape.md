# The pieces a game's page can't play yet: the look (Round 5, Impeccable)

Operate mode, in the committed world (Lower Third, DESIGN.md), and in the game page's own parts (Plate, the season grid's squares,
the moves sheet's tiles, the person sheet's rows), so each piece reads as part of the game that already has it. Built on
[the spec](round5-play-pieces-spec.md) and [the first view](round5-play-pieces-first-view.md). Behind `?play=b2` (TEMP-UI, remembered
for the browser tab; `?play=off` drops it) until the user approves. The view's new fields, and BACKLOG 47's fix (no lineup or pick
for someone knocked out), are everyone's at once: they change nothing until a screen reads them, and the move the server refuses
was a bug.

- **Your moves, a lineup** (the dock's LineupPanel):
  - **The captain's tile** is tagged "Captain ×2" in bone (foreground on background), not the chyron "Starting". The chyron keeps
    meaning "what's due" (Round 4's call).
  - **The Captain row** sits under the tiles, a hairline above it:
    - a 13 px caption-caps label, "Captain ×2";
    - then each starter as a choice, a 44 px pill with their first name and their points so far, 13 px muted;
    - the chosen pill in bone with a check.
    - One row whatever the number of starters: it scrolls sideways when they don't fit.
    - A benched captain empties the row, which then reads "No captain: pick one of your starters".
  - **A slot's row** (one per slot) follows, the same hairline grammar:
    - the "Slot 1" tag (Plate's angled tag, quiet; good while it's riding);
    - the group's name in caption caps, its people as 28 px faces, and a 13 px line of its state ("Riding", "Dropped: re-paired
      after Ep 2", "Void this episode").
    - **Open** (empty or dropped, with groups on offer): the row reads "Pick a group" with a chevron and opens the groups in place,
      one row each (faces, name, "Held by Bo" in an exclusive game, greyed and refused). A tap fills the slot and closes the list.
    - Saved with the sheet's Save, as the lineup is.
- **Your moves, a pick** (PoolPanel):
  - **The parts line** sits under the sheet's line, 13 px muted, with lucide Heart and RotateCcw glyphs at 14 px: "1 life left · 1
    mulligan left · buy back once for 3". Only the parts the pool has.
  - **Two places** side by side, each half the width and 64 px tall: a 44 px face (or a dashed square), the caption "Your pick" or
    "Second pick", the name or "Optional · counts if two or more go home".
    - The active place has a 2 px good outline; tapping a filled place makes it active; the second carries an × to empty it.
    - On the faces below, the first is ringed with a "1" and the second with a "2", in the good colour.
    - A face in the other place can't be chosen for this one, and a toast says so.
- **The season grid** (a pool's squares, game-page Cell):
  - the night's outcome as today (✓ good, ✗ live red);
  - **forgiven:** the ✗ quiet, with a lucide ShieldCheck badge;
  - **bought back:** a RotateCcw badge in the chyron line colour;
  - **skipped:** a Minus in muted, no face;
  - **a counted second pick:** a 2 px pip at the square's foot.
  - The key line under the grid names the marks it uses ("A shield: a wrong pick forgiven · the arrow: bought back in").
  - Every mark is one drawn glyph at 14 px, so a square holds it at 30 columns.
- **The page's hero, knocked out** (the strip's "out" plate, extended from the pool's to any game):
  - the tag "Out", quiet;
  - the title "Cut after Ep 1" (or "Out since Ep 3" for a pool);
  - the line "4th of 4 · your 2 pts stand · Ann, Bo and Cy play on".
  - No move under it, and no game tab in Your moves.
- **Against the bot** (a new block under the grid, a game of questions with beat the bot), in Round 3's record form:
  - a caption heading, its aside "The bot: 1 of 2 right";
  - one row per person: their face and name, a split bar on one scale (beat in good, beaten in live red), the two numbers at its
    ends;
  - a person who has neither shows a hairline bar and "Even".
- **Your team, an auction** (YouSection's rows and the person sheet's TeamBlock):
  - each row's second line gains the price ("Still in · won at 12", "Out · Ep 1 · filled at 1");
  - the section's aside reads "Spent 87 of 100".
- **A person's week, a lineup** (WeekPane):
  - the captain's row first among the starters, its name followed by a bone "×2" tag;
  - its points as the engine counts them (already doubled), its why "Individual immunity win ×2".
  - Each slot's row after the starters: the tag, the group's name, its people's faces, and its points; or its why at 0 ("Void:
    they didn't play as a pair").
- **A person's episode, a pool** (EpisodeBlock and PickBlock):
  - the big word reads the night ("Stayed", "Went home", "Forgiven", "Bought back", "Skipped");
  - the line under the head names both picks;
  - the second pick is a CastRow of its own, "Second pick · counted (two went home)" or "Second pick · didn't count: one went
    home", ticked when it counted;
  - a forgiven or bought-back night adds one 13 px line under the rows ("Your mulligan forgave it: the streak carried on · none
    left", "Out of lives: bought back in for 3 points").
- **A person's answers, beat the bot** (AnswersBlock): under each settled answer's verdict, a 13 px line with a lucide Bot glyph:
  "The bot said Cameron too", "The bot said No: you beat it".
- **Motion:** none new. A slot's groups open with the app's existing chevron turn.

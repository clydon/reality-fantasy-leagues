# The pieces a game's page can't play yet, first view: requirements (Round 5)

Mode 2 derivation on [the page spec](round5-play-pieces-spec.md), at 390 × 844, building on Phase 0's app-wide
[R1–R5](phase0-first-views.md) and the game page's grammar (the hero, the strip, the season grid, Your team, How it plays). Today's
frames: `.ui-atlas/stories/b2-play-pieces/before/` (`scripts/dev-test/play-pieces-fixture.js`'s seven cases, as their viewer):
`captain-*`, `second-*`, `slots-*`, `auction-*`, `bot-*`, `cut-*`, `pool-buyback-*` and `pool-mulligan-*`, each `-page` (the
game's page), `-move` (Your moves) and `-you` (your sheet).

## The problem

Each of these games promises a piece on its page and then gives no way to use it, or no sign it did anything:
- **A captain** (`captain-move`): the lineup sheet is starters and bench. "Captain scores double" is the game's summary, and Ann's
  Episode 2 reads "+11 · Individual immunity win" (`captain-you`), a doubled score with nothing saying why.
- **A second pick** (`second-move`): the pick sheet takes one face. On `second-page`, Episode 2's square is a green tick while
  the sheet says "streak now 0": the second pick that counted and was wrong appears nowhere.
- **Group slots** (`slots-page`): a "Slot 1 · Finley Fischer & Cameron Chen" plate, its points on no week, and nothing in Your
  moves.
- **An auction** (`auction-page`): Your team lists names and points, never what anyone paid.
- **Beat the bot** (`bot-page`): "Who goes home? Cameron · Cameron went home · 0", with nothing saying the bot named Cameron too.
- **Knocked out** (`cut-page`, Di): "4th of 4 · 2 pts · Change your lineup", a move the server refuses, under a grid marking Di OUT.
- **A pool's lives** (`pool-buyback-page`, `pool-mulligan-page`): a plain ✗ on a night Ann bought back in for 3 points, or on a
  night her mulligan forgave.

## L0 · Cognitive load

**Constraint.** Working memory holds three to five chunks; each new control on a sheet claims one.

**Violation.**
- Adding a captain and a slot to the lineup sheet makes three decisions where there was one.
- A second pick on the pick sheet makes two.
- Done as more tiles or more taps on the same tiles, each would compete with the starters for the same attention.

**R1.** Each sheet keeps one primary decision in its first view, the pieces after it as one line each:
- **The lineup sheet:** its line, the tiles (starters and bench), then **one row** for the captain and **one row** for each slot.
  Each row holds its height whatever the number of starters or groups (a long list opens in place, one at a time).
- **The pick sheet:** its line, then **two places** side by side (Your pick, Second pick), then the faces.
- **A person's week or episode:** the score, then the rows that made it; each piece's row in the same list as the rest, never a
  section of its own.

**Citations:** Cowan (2001) for the chunk ceiling; Sweller (1988) for the cost of controls not in use.

## L1 · First impression

**Constraint.** Meaning is judged in about 50 ms, from the largest, most distinct element.

**Violation.**
- **Di's page** (`cut-page`) leads with "Change your lineup" in the place a move goes, so the first impression is "you have
  something to do" in a game she's out of.
- **On the pool** the largest elements are the grid's ticks and crosses, so a forgiven night reads as a loss.

**R2.**
- **Someone knocked out:** the hero's largest element is their finish ("Out · cut after Ep 1", "4th of 4"), in the strip's
  place, with no move.
- **The grid's marks:** a forgiven or bought-back night and a skipped night are distinct at a glance from a plain wrong one.
  One glyph each, at the square's size, so they read in the first impression of the grid.

**Citations:** Lindgaard et al. (2006) for the 50 ms judgement; Treisman and Gelade (1980) for a single distinct feature
popping out.

## L2 · Processing fluency

**Constraint.** One form per fact; the same thing said in the same words everywhere.

**Violation.**
- A captain is "Captain scores double" in the summary, a "C" badge on the hero's faces in one layout, "Captain ×2" in another, and
  nothing on the week.
- The page's multiplier chips say "×2 EP 2".

**R3.**
- **One mark for a multiplier: "×2".** The captain's tile is tagged "Captain"; their week row and their face carry "×2" in the
  same form as the multiplied episode's chip.
- **One word per pool outcome, the same on the grid's key and the sheet:** "Forgiven", "Bought back", "Skipped", "Didn't
  count".
- **Prices as numbers, the same on the page and the sheet:** "12", "Filled · 1", "Spent 87 of 100". No currency sign, since the
  budget has no unit.
- **The bot is named "the bot"** everywhere: its call, the line under the grid, the rider.

**Citations:** Reber and Schwarz (1999) for one form reading as true; Alter and Oppenheimer (2009) for the cost of a second
form.

## L3 · Prediction

**Constraint.** People act on prediction. A tap does what the thing looks like it does, and the same gesture never does two
things.

**Violation.**
- On the lineup sheet a tile tap starts or benches. A captain named by another tap on the tile would break that prediction.
- On the pick sheet a face tap is the pick, so a second tap on another face would replace it, not add a second.

**R4.**
- **The captain is chosen on its own row,** from the starters by name, never by tapping a tile again. Benching the captain
  clears the row, and the row says so.
- **The pick sheet's two places:** one is active (outlined), and a face tap fills it. The second place says when it counts
  ("Counts if two or more go home") and can be emptied. The same face can't fill both.
- **A slot's row** opens its groups in place. A group tap fills the slot.
- **Nothing a knocked-out person can't do looks tappable:** no strip move, and no game tab in Your moves.

**Citations:** Clark (2013) for prediction and its violations; Norman (2013) for mappings and signifiers.

## L4 · Decision

**Constraint.** One decision per view, with what decides it beside it; comparison on one scale.

**Violation.**
- How the couch does against the bot, and what each team paid, are comparisons nobody can make today: the numbers aren't shown
  side by side, or at all.

**R5.**
- **What decides it, beside each choice:**
  - **The captain row:** each starter's points so far, and the rule "×2" once.
  - **The second place:** its rule.
  - **A slot's groups:** their people and, in an exclusive game, who holds them.
  - **The pool's line:** what's left ("1 life left · 1 mulligan left · buy back once for 3"), above the faces.
- **Against the bot:** one row per person, beat and beaten on one shared scale (a split bar, Round 3's record), with the bot's
  own right calls as the row's context.
- **Prices:** in the same column as points on Your team, so a castaway's price reads against what they've scored.
- **Defaults:**
  - The captain carries with the lineup.
  - A second pick never carries.
  - No captain is named for you (an open question for the user).

**Citations:** Iyengar and Lepper (2000) for one decision at a decision point; Tufte (2001) for comparisons within the eye's
span.

## The first views, then

**Your moves, a lineup with a captain and a slot (Ann):**
- The line ("Start 2 of your 3").
- The tiles: the captain's tagged Captain.
- **Captain:** Avery ×2, the other starter beside it.
- **Slot 1:** Finley & Cameron · riding.
- Save.
- The eye's order: who starts → who captains → what the slot holds.
- Must not: a fourth decision in view; a captain chosen by a tile tap.

**Your moves, a pick with a second pick and lives (Ann):**
- The line ("Who survives Episode 3?").
- The parts line ("1 life left · buy back once for 3"), when the pool has parts.
- The two places (Your pick, outlined; Second pick · counts if two or more go home).
- The faces, then Save.

**The page for someone knocked out (Di):**
- The bar and title, then the hero: "Out · cut after Ep 1", "4th of 4 · 2 pts", one line of what's still theirs.
- The season grid with the cut line, Di below it, dim.
- Must not: Change your lineup, or any move.

**A person's week, a captain game (Ann, Episode 2):**
- "Episode 2 · +11".
- Started: Avery, Captain ×2, +11 (Individual immunity win ×2); Blake, 0.
- The slot's row after the starters, where the game has slots.

**A person's episode, a pool (Ann):**
- The night's outcome in words beside its head ("Wrong · forgiven").
- The pick's row and the second's row, each right or wrong, the second "Counted" or "Didn't count".

**The page, beat the bot:**
- The grid, then **Against the bot**: a row a person, beat against beaten, on one scale.

> *Initial findings. Ralph Loop a requirement, cite further, switch to analyze / evaluate, or ask any follow-up to dig deeper.*

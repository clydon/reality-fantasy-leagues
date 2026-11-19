# The game page's title card: page spec (B1, chunk 7)

## The job

The top of a started game's page says which game this is in the form it was made in: its name in caps over the show's art, as
the setup screen's title card ([parts.tsx `TitleCard`](../../src/new/couch/gallery-bold/parts.tsx)) said it a minute before
Start. Making a game and playing it read as one thing ([decisions, 2026-11-18](decisions.md), "The game's title card comes back
on the started game's page").

The card is the page's identity; This week (the week block) stays its news. The card never changes with the situation, so the
week block's state line is still the one thing in the first view that does ([R4](step2-game-page-first-view.md)), and the card
can't spoil anything. The first view still answers who you play, your move and by when, and where you stand
([R1](step2-game-page-first-view.md): four chunks, the card and the bar together being the first). Where the two compete for
height, the card gives way first: its sentence goes, then its name steps down a size; the week block's faces and the move never
move below the fold at 390 × 844.

The couch's other people never saw the setup screen. For them the card is the game's introduction, which is why it carries the
setup's sentence until they've played (below).

## The header, top to bottom

| # | Part | Holds | Verdict |
| --- | --- | --- | --- |
| 1 | **The bar** | Back ("Games", back where you came from) and the menu; its centre is empty while the card is in view and takes the game's name, truncated, once the card's name scrolls under it | **Restructure**: the name lives once on screen at any moment |
| 2 | **The title card** | The show's name small over the game's name (the kicker: the season, or a sport's league or team season); the game's name in caps, wrapped, never cut off; a sport's team marks at its right, as on the setup screen; the setup's first sentence while you haven't made a move in this game | **New display** (it returns), the setup card's form with "Also called" left off |
| 3 | **The stage line** (a game in stages) | The stage being played and the next, as today, directly under the card | **Keep**: it tells which part of the game the week block is about |
| 4 | **This week** (the week block) | Unchanged from [step 2's spec](step2-game-page-spec.md): the matchup or your week, its state line, the move as the one yellow | **Keep**: its content and states were settled in step 2 |
| 5 | **The art** | One surface behind the bar, the card and the week block: at its fullest behind the card, fading under the week block so the faces and numbers read | **Restructure**: today it is a wash behind the week block only |

The card is not a control. How it plays stays in the menu and at the page's foot, so the card adds no target beside the move.

The art is the show's or season's key art (`backdropUrl`, else `artUrl`), never an episode's still, so a page seen by someone
behind shows nothing from past their mark.

## The sentence

The setup screen's first sentence for this game (what everyone does, in the season's nouns), the same words the maker read at
Start. It shows to each person until they've made their first move in this game (a draft pick, a lineup, a pick, an answer), and
then the card is the kicker and the name. It is not a banner and has nothing to dismiss. A game made before the setup screen
existed gets its sentence the same way, from its spec.

The game in a line ("All season · Draft 3, start 2 · Only 2 moments count") stays as How it plays' lead, not on the card: it is
rules, and the first view carries no rules (R1).

## By situation

Each row: what the card holds, then what sits under it. The card's name and kicker are the same in every row.

| Situation | The card | Under it |
| --- | --- | --- |
| Just started: nothing aired, the draft not done | Kicker, name, the sentence | The week block with the first move (Draft your team, when the draft opens, who it waits for); its short height pays for the sentence |
| Arriving from Start a game (the maker's first visit) | The same card as the setup screen's, in the same place: the name and art carried over unchanged | As above; Start's toast with Undo is the only "it's made" signal, no banner on the page |
| A friend's first visit (from the couch's push or the Games tab) | As the maker's first visit | As above |
| Mid-season, a move due | Kicker and name (a move made long ago) | You vs Bo, the state line, **Set your lineup** · its lock once |
| A move set | Kicker and name | "You're set", your starters' faces; no yellow anywhere in view |
| A game in stages | The whole game's name, never the stage's | The stage line, then the stage's week block; the overall as one line below |
| A sport's game | Kicker the league or team season ("NFL 2026", "Bills 2026"), the team marks at the right; never letter tiles | The week block in sports words (Week, game, players); results as they come, unless scores are hidden |
| A story show | Kicker and name over the show's art | The episode's calls: what's open, what's settled |
| A finished game | Kicker and name, unchanged: no "Final", no champion, no place | The champion and your finish (step 2's `show-champion`) |
| Someone behind | Kicker and name, unchanged | "You're up to Ep 3", the Ep 4 matchup with no score, **Reveal Ep 4** |
| A very long name | The name wraps to two lines at a smaller step, then three; never an ellipsis in the card (the bar may truncate it) | The sentence goes before the week block's faces leave the first view |
| A show with no art | The card on the show's colour, as the week block's backdrop does today; a sport on its team's colour with its marks | Unchanged |
| A later visit | Kicker and name | Per the week |

## Scroll

As the card scrolls under the bar, the bar takes the name (one line, truncated) with the show's name small above it, as the bar
reads today. Scrolling back up gives the name back to the card. The name is on screen once at any moment.

## Left off the card, and where it lives

- "Also called…": a finder's aid in the gallery; on a game you're in it answers no question. Not on the game page.
- The setup's effort line, Make it…, the rule lines, Try it, the heart and its count: setup tools, for a game not yet made.
- The date plate, setting chips and spoiler line that rode with the old 64 px title: left where step 2 put them (This week, How
  it plays, the menu's Where you are).
- Any state (a record, a place, "Season over", a countdown): the week block's.
- The game's rename: Backstage, for whoever runs the game.

## Dark-pattern checks

- The card must not push the move out of the first view (the card gives way first, above); a decorative header that hides the
  one thing due would be obstruction by layout.
- No "new game" interstitial, confetti screen or tour over the first visit: the toast with Undo is the feedback.
- The sentence describes the game plainly; no selling lines ("the most fun way to watch"), no invented counts of players or saves.
- Nothing on the card depends on results, so no layer of it can spoil.

## Open questions

1. **The art's colour.** Grayscale under a gradient, as the setup card, so the two read as one object; or the art in its own
   colours, the user's call for the game page (2026-11-08), so the setup card and the page differ in tone.
2. **The sentence's life.** Until your first move (each person meets the game once, then the card is lean); or always (every
   visit restates what the game is, at the cost of a line over the week block in every situation).
3. **The name in the bar.** Only once the card scrolls away (the name once); or always, as today (the bar reads the same at every
   scroll, at the cost of the name twice in the first view).

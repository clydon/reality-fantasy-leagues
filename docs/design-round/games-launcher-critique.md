# Games tab (launcher): Impeccable critique

DEGRADED: single context. Run as a delegated reviewer; the design review (A) was finished before the detector (B) ran, so the
detector's output didn't shape it. Frames: `.ui-atlas/stories/games-launcher/{after,before}/`, 390 px. One pass, nothing edited.

## Score: 26 / 40 (Acceptable: a big step up from before; a few real traps left)

| # | Heuristic | Score | Key issue |
|---|-----------|-------|-----------|
| 1 | Visibility of status | 3 | Each row says its move's state; but the fold hides a due game, and nothing says "you're set" outright |
| 2 | Match with the real world | 2 | T1, T2, R2 pick 7, G 1, 0–0–1, "7 left", "1 first", "lets you in" |
| 3 | User control | 3 | Join goes through a sheet with a close button; the fold opens on a tap |
| 4 | Consistency | 2 | A dashed box means you, an empty slot and Start; "Games to join" vs "Longer games to join"; Head to Head's right column differs from every other row |
| 5 | Error prevention | 2 | Again can start a second "Who survives?" next to the one you could Join |
| 6 | Recognition over recall | 3 | Faces and names do the work; the coloured kind dots carry meaning with no label |
| 7 | Flexibility | 3 | A button for a one-episode game, the whole row for a longer one, Again chips |
| 8 | Aesthetic, minimalist | 3 | Much calmer than before. The episode time is said three times and the Join sheet names the game three times |
| 9 | Error recovery | 2 | The behind state is good ("Reveal Episode 4 first" with the Reveal button), but no failure state is rendered (join fails, offline) |
| 10 | Help | 3 | How it works sits at the end and the Join sheet explains the game; Ask isn't explained where it appears |

**Detector:** 10 advisory findings, all `design-system-font-size`: 12 px (games.tsx 286, 298 …), 14 px (whats-on.tsx 176, 358),
17 px (380) and 28 px (465) are off the DESIGN.md type ramp. Nothing blocking. Either put them on the ramp or add the steps to it.

## Is it this product's own?

Mostly yes. The caption-caps game names, the place numerals and the Night ground read as Lower Third, and compared with before, the
tab is now a launcher rather than a third leaderboard. The weak spots are shared parts that blur meaning (dashed tiles, dots), not
generic styling.

**What's working:** (1) Casey's before page had six yellow Join fills and the after page has none, so the one-yellow rule holds.
(2) The behind state is honest: rows gate on "Reveal Episode 4 first" and the one yellow is the Reveal. (3) The busy page keeps
its height (four rows and a fold), and Finished games is one record row ("57 · 17 firsts · 3rd on the couch").

## Findings, by severity

**P1-1 The strip's words collide with a game you're not in.** week.top: the strip says "Pick who survives" (Survival Pool's
move), and the first "WHO SURVIVES?" below it is a one-episode game you're not in, with a **Join** button. Joanna, asked to "pick
who survives", taps Join on the wrong game. *Fix:* when another game on the tab shares the verb, the strip's move names its game
("Survival Pool: pick a survivor").

**P1-2 Again offers a duplicate of a game you can Join.** week.top: "Again for Episode 7 · Who survives?" sits two rows under the
couch's "Who survives?" for Episode 7, which has a Join button. `onAgain` (whats-on.tsx:127) checks only your own games
(`show.play`), not the couch's joinable ones (`open`). *Fix:* leave out an Again chip when `quickTo(n)` already has that kind.

**P1-3 The fold can hide a move that's due.** busy.full: games are ordered by when they end (whats-on.tsx:348) and the first four
show. The "4 more games" row lists names only, with no dot (425-429), so a folded game that needs you is invisible on this tab.
*Fix:* put games that need you first (or never fold one), and show the dot plus "1 needs you" on the fold row.

**P1-4 Casey gets a wall of equal buttons.** watcher.full: seven boxed buttons stacked in one column (2 Join, Ask, 4 Join) with
no hierarchy, and Ask reads "zt_nd_alex lets you in", which shows a username and doesn't say what Ask does. It isn't pressure,
but it's no easy way in either. *Fix:* lead with the one-episode games, which are the smallest commitment. Fold longer games to
join after two ("+3 more"). Ask's line becomes "Alex decides who joins · Ask", using the display name.

**P2-5 A dashed box means three things.** week.top/s2: a dashed ring marks *you* in a night row, a dashed square is an *empty
slot* in Lineup League and Survival Pool, and the dashed tile is *Start*. *Fix:* keep dashed for empty and start, and mark you
with the solid ring the code already uses once you're in.

**P2-6 Two columns of dots, neither explained.** week.s2, patterns.kinds-1: a colour dot before each name shows the kind, and a
yellow dot under it shows something's due. Blue covers six kinds and purple, lime and grey appear only in patterns. *Fix:* drop
the kind dot on this tab (the name already says the kind) and keep only the yellow due dot.

**P2-7 Jargon in states and places.** behind.full "T2 / T1", draft.full and sport.top "R2 pick 7", sport.top "G 1" and "Start
a game on G 1 only", patterns "0–0–1", "4 pts", "0 lines", all rows "7 left", the record row "1 first". *Fix:* "Tied 1st",
"Round 2, pick 7", "Game 1", "7 episodes left", "1 tie" (or W–L–T with a label), "1 win".

**P2-8 Andrew can't see that he's set.** week.s2, short.full: a longer game with nothing due shows other content ("Optional swaps
open", "Sage and Remy"), so "set" is only the absence of a dot. *Fix:* once this episode's move is made, the state says so
quietly ("Set for Ep 7", muted, with a tick) and keeps its content after it.

**P2-9 The strip may be leaving out a due one-episode move.** week.top: "Who goes home?" shows **Pick** ("Pick before you watch"),
but the strip lists only "Set your lineup · Pick who survives". *Fix:* check that the strip counts one-episode moves that are due.
If it doesn't, add them (patterns already shows "· 1 more").

**P2-10 The draft strip puts the less urgent move first.** draft.full: "Start the draft · 1 more" hides "You're up · R2 pick 7",
the live pick. A yellow dot also sits on the ••• menu, a second yellow mark in the view. *Fix:* put the live pick first in the
strip, and use a muted badge on the menu.

**P3-11 The time is said three times.** week.top: the header ("Sat 7:37 AM · in 7 days"), the strip ("Lock when it airs") and the
For Ep 7 heading ("Sat 7:37 AM"). *Fix:* drop the heading's time, or turn it into the lock ("locks 7:37 AM") only when it differs
from air time.

**P3-12 The Join sheet repeats itself.** week.join: the title "JOIN WHO SURVIVES?", then "Who survives? Ep 7", then the button
"Join Who survives?". *Fix:* the subtitle becomes "Ep 7 · Alex and Sam playing" and the button "Join". Showing who's playing
answers Casey's real question.

**P3-13 The archive's head-to-head bars can't be read.** week.archive: Riley's row is a full-width white bar with "1" at its left
edge, and Alex's and Sam's are full-width grey bars with "1" centred. There's no midline or scale. *Fix:* a bar from a marked
centre line, filled only toward the side that leads.

**P3-14 Head to Head breaks the place column.** patterns.kinds-1: "0–0–1" is the big numeral and "1st of 4" the small one, the
reverse of every other row. *Fix:* the place stays big and the record moves into the state line.

**P3-15 "Games to join" (watcher) vs "Longer games to join" (everyone else).** watcher.top: same list, different heading. *Fix:*
use one heading.

## Persona notes

- **Joanna (forgets, on the night):** the strip and the For Ep 7 block answer "anything tonight?" in the first viewport, but P1-1
  and P1-2 give her two "Who survives?" choices to get wrong.
- **Andrew (drive-by):** the places on the right are scannable, but "set" is never stated (P2-8), and on a busy couch the fold can
  hide the one game he hasn't done (P1-3).
- **Conor (tinkers):** Start a one-episode game, Again, the extras fold and Start a longer game are all reachable. The only
  problem is Again duplicating a live game (P1-2).
- **Casey (watcher):** the absence of yellow is right, but seven equal buttons and an unexplained Ask make it read like a sign-up
  form (P1-4).

Not persisted to `.impeccable/critique/` (the caller allowed this one file only). Questions skipped: running as a delegated
reviewer; the caller relays to the user.

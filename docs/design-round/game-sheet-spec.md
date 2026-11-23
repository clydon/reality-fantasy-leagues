# A game's sheet with Play (sports-couch B4): the page spec (Intent, step 1)

2026-11-22, the `sports-couch` lane. Intent's `journey`, once. On round 1's Play sheet ("Any game row that hasn't started has Play;
it opens one sheet on that game: the matchup, the game types as tiles with Pick'em chosen, bigger sizes as rows (both teams'
Thanksgiving, their series, the team's season, the week), the couch line, and Start": [sports-space-spec.md](sports-space-spec.md);
its first-view R5: "From any game row, the game is the scope: one sheet, Pick'em chosen, Start two taps from the row"), the user's
decision at B1 Scores (no Play button on rows: a row opens its game, and B4's sheet holds Play), round 2's ways to play
([sports-couch-play-spec.md](sports-couch-play-spec.md)), and what B2's check left for B4 (the sheet's "A GAME" title, "It's
over.", "tells the couch" reading as insider words).

## What's wrong today (before frames: `.ui-atlas/stories/game-sheet/before/`)

1. **Titled "A game"**, two big marks and "Eagles at Bears" under it: the sheet never says what it's for.
2. **Play is one tap with no choice**: "Play this game" starts Pick'em; every other game type hides behind "Another game on it…",
   which opens a second sheet and then the gallery (three screens to Squares).
3. **Nothing says what the couch already has on this game.** Riley's Pick'em on Cowboys at Giants sits on the Games tab; the sheet
   offers a second one beside it, and the couch ends up with two.
4. **Once it starts, the sheet is a dead end**: "It's already on: picks closed at the start." or "It's over." No score story, no way
   to the couch's talk about it, no way to the games you play on it.
5. **It doesn't know who on the couch cares**: a game between Riley's Jets and your Eagles reads like any other.

## The job

**One real game: what it is and when, who on the couch cares, and a game on it in two taps without starting a duplicate.** Before
kickoff the job is Play. Once it's on or over, the job turns to the game itself: the score (when it may be told), the couch's
games on it, and the couch's talk about it.

## Where it lives

- **A sheet, opened from any game row**: the hub's scores strip, a league's Scores and This week (the rivalry, the rest of the
  week), a team's page (the schedule and Month cells), a cast list's game log. `openSports({ kind: "game", league, team, game })`
  stays the one door; the sheet reads the game from the team's schedule it already reads.
- **Over the screen that opened it**; closing returns there. Start lands on the started game's page (today's behaviour, with Undo).

## Structure, in rank order (before kickoff)

1. **The title is the matchup** ("Cowboys at Giants"), with its day and time, network and the line in words ("Sun 4:25 PM · CBS ·
   NYG by 3") under it. The two teams as **the shared scorebug** (wide), so the game looks the same here as on the row that opened it
   (R3), with the couch's faces on each side.
2. **The couch line** (only when someone on the couch follows a side): who's with whom, in names ("Sam's Cowboys at Jordan's
   Giants"; "Your Eagles at Riley's Jets": a rivalry). Faces with names (the saved rule).
3. **Already on the couch** (only when there's one): each couch game that covers this game, a row each: its name and type, who's
   in (faces and a count), and its action: **Join** (the show's Join sheet), **Open** (yours: "You're in · your pick's due"), or
   a quiet "Full" / "Started". Above Play, so nobody starts a second Pick'em on a game that has one.
4. **Play**: the one-game types as tiles, **Pick'em chosen** (its outline in the foreground: the one yellow is Start): Pick'em ("Who
   wins"), Pick a few ("Three players"), A draft ("A few players each"), Squares ("The party grid"); a type that doesn't fit this
   game is left out (the rail's own check). Under the tiles, one line on how the chosen one plays (the rail's line). Then
   **Start Pick'em** (the yellow), with the lock line under it in plain words: "Picks lock at kickoff, Sun 4:25 PM · the couch is
   told, with 10 seconds to undo". With a game already on the couch of the chosen type, Start reads "Start another Pick'em".
5. **Go bigger** (quiet rows, a row each, two or three at most): their series still to finish ("Bucks vs Sixers, 2 games"), the
   couch team's season ("Every Giants game left · 6"), this week's games ("Pick'em on all 14 games this week"); each hands off to
   Start a game on that scope (2.8's handoff).
6. **More options…** (a text link): the chosen type in Start a game's screens (its size, scoring, who's playing): today's "Another
   game on it…", without its extra sheet.

## Once it's on, or over

1. The title and **the scorebug** (live: the clock and score; final: the score), each through the score's hiding (a hidden game
   says Started and asks: the bug's own ask).
2. The couch line (as above).
3. **Your games on it** (rows into each: "Riley's Pick'em · your pick: Giants" only after lock; the pick is the game's to show),
   and the couch's others (no Join: picks closed).
4. **The couch's talk**: "3 messages in its thread" into the league's room (a count, never a word: B1's rule), or "Talk about it"
   when there's none and you're on a couch.
5. One plain line instead of a dead end: "Picks closed at kickoff." (on) or nothing (final: the score says it).

## Situations, in rank order

| # | Who, when | First need |
| --- | --- | --- |
| 1 | Andrew taps tonight's game on the strip | when it is, and Play in two taps |
| 2 | Riley started a Pick'em on it; Joanna opens the game | "Riley's Pick'em" with Join, above Play |
| 3 | A rivalry: your Eagles at Riley's Jets | the couch line names it; Pick'em reads as picking a side |
| 4 | Conor wants Squares for the Thanksgiving game | the Squares tile, Start Squares, two taps |
| 5 | The game is on | the score (or Started, hidden), your games on it, the thread |
| 6 | Over | the final (or Started), the thread |
| 7 | Hiding sports scores | Started and the bug's ask; nothing else told |
| 8 | Solo (no couch) | the game and when; Play says a couch is needed for now (C4 brings solo play), Start a couch · Join one |
| 9 | Postponed | "Postponed" in the bug; no Play; its makeup is a game of its own |
| 10 | A daily sport's game (one of 82) | the same sheet; Go bigger offers the series and the homestand or trip |
| 11 | Loading, the schedule failed, the game not on it | a skeleton; one line and Try again |

## Each surface and its verdict

| Level | Questions (casual · sweat) | Data held | Today | Verdict |
| --- | --- | --- | --- | --- |
| The sheet | What is this, can I play? | team schedule, week game | "A game" + marks | **restructure** (titled by the matchup) |
| The matchup | Who, when, the line | week game (network, line, clock), schedule | two lg marks + words | **repaint** to the shared scorebug |
| The couch line | Who on the couch cares? | couch teams' followers | none | **new display** |
| Already on the couch | Is there a game on it? | couch games + the game's seasons (new small read) | none | **new display** |
| Play's types | Which game? | the sport's rail for one game | one plate + "Another game…" | **restructure** (tiles, Pick'em chosen, one Start) |
| Go bigger | A longer game | series, the team's season, the week | Start a game on rows (team page) | **new display** here (reused rows) |
| After kickoff | Score, my games, talk | week game, my games, room counts | "It's over." | **restructure** |
| The game's own page | (inside a game) | | | **keep** (the started game's page) |

## Hide sports scores, and watching as if live

The bug follows its own rule (Started and its ask, never a clock or score for a hidden game). After kickoff nothing on the sheet
tells the game: your games on it say their names, not their standings; the talk is a count. Before kickoff nothing is hidden (there's
no result yet; the line is a price, not a result).

## Return paths

- Close: back to the screen that opened it, at its scroll.
- Join: the show's Join sheet over it; joined, its game's page (the Join sheet's own).
- Start: the started game's page, with Undo in the toast (today's). Go bigger and More options: Start a game's screens; their Back
  returns to the sheet (the handoff's `back`).
- The thread: the league's Chat tab on that thread.

## The data

- **One small new read** (ours, no ESPN): `GET /api/sports/game/seasons?league=&event=`: the seasons this real game is in and its
  episode in each (`season_events`; the same for everyone, edge-kept a minute). The sheet filters the couch's games read (already on
  the phone) to those whose season holds this game inside their span. No migration, no engine change.
- Reused: the team's schedule (the game, its teams), the league's one-day week read (network, line, clock), the couch's teams read
  (who follows each side), the sport's rail for one game (`useSportRail`: types and whether each fits), `/api/sports/mine` (your
  games on it), the room's counts (the thread link), `useStartSport` with the chosen type, the start handoff for bigger scopes.

## Left out, and why

- **Odds and prices** beyond ESPN's line in words: Phase D (lines).
- **Back or Fade, rivalry challenges, stakes:** C1, C2, C6 (they frame Pick'em; this sheet leaves the couch line as their place).
- **A box score or play-by-play:** the game's own page after a start, and Phase 5's live points; the sheet stays one screen.
- **Setting a game's options here:** Start a game's screens own them (More options…).

## Open for the user

- **"tells the couch"** on Start: today's words for "the couch hears about it"; the sheet says it in full under Start instead
  ("the couch is told, with 10 seconds to undo"). Recommended: the full line.

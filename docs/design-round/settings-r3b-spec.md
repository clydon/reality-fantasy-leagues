# Settings, Round 3b: changing a game once it's under way (Intent's spec)

> **Status (2026-11-21): Round 3b, step 1 of the design process** (docs/DESIGN-PROCESS.md: Intent, then Perception-First Design,
> then Impeccable). 3a (live 2026-11-21, 535e2ecf) gave each game its one runner page, **Manage this game**; 3b is what a runner
> does there once the game is under way. Its parts: the options that are safe to change after the start (A15); the game's say
> when the show's rules change mid-season, and the players' vote on it (A17, BACKLOG 230); a real Undo for the lock, the late
> moves, the questions, the freeze and computer players (rule 6); the lock's three states after airtime (BACKLOG 157); a
> runner's jobs on the strip, a waiver window that's due among them; and A16 (164 replacements on by default, 165 an empty
> starter's slot filled from the bench, 166 make a missing move for someone). The engine facts this rests on are listed at the
> end ("What the engine has").

## The job

A running game changes for three reasons: **something happened** (the show added a moment, someone forgot their lineup, a
starter went home), **the couch wants it different** (claims close later, lineups shown, end at the merge), or **a runner slipped**
(locked the wrong episode, turned on strict by mistake). The round's job is that each of these is one place, says who it touches
and from when, and can be taken back.

The page's promise grows by one sentence: **"Each change saves at once, with Undo."** stops being half true. Today the lock, the
late moves, the questions and the freeze re-send an old value (or nothing), and computer players say "This can't be undone".

## Rule 6, applied: how far a change reaches decides how it saves

| Reach | Examples in 3b | How it saves |
| --- | --- | --- |
| **Just this week, reversible** | the lock, the late moves, claims close, who goes first, free agency, others' lineups shown | At once. Toast with a real Undo (a typed undo on the server, so it survives a reload: Recent changes' Undo too) and a change line. |
| **Moves standings from now on** | a new moment counted from the next episode, an empty slot filled from the bench, end at a phase | At once, with the sentence "From Ep 7 on" in the control itself, Undo, and the players told in the game's feed. |
| **Moves standings already played** | a new moment counted from the start (the default for a new show) | Never silently: the players are told what moved ("+5 to Carter's holders for Ep 3"), and the game's rule decides whether it can count back: the runner's call, or the players' vote. |
| **Hard to undo** | take out a computer player | Held, with its sentence; restorable for 30 days like removing a person (3a). |

## Who comes, and why

| Who | Why they come | Where they start | The fix, and its taps |
| --- | --- | --- | --- |
| **riley**, a Helper, episode night | the West Coast airing spoils it: lock Lineup League now | the strip | strip's runner line "Ep 6's lineups lock 8 PM · Lock now" (1) |
| **riley**, after airtime | sam watched early and set a lineup late; lock it for everyone | the game | gear › the lock › Locked for everyone (2) |
| **alex**, the morning after | locked the wrong episode by mistake | the toast, or the game | the toast's Undo (1), or gear › This game's changes › Undo (2) |
| **alex** | the couch keeps forgetting claims: close them later | the game | gear › Replacing people who leave › Timing › Claims close (3) |
| **Conor** | wants to see everyone's lineups before the episode | the game | gear › Others' lineups › Shown as they're set (2) |
| **alex** | the season splits at the merge: end Pool Party there | the game | gear › How long › Till the merge (2) |
| **Joanna** | forgot her lineup; the Commissioner sets it | the strip (her runner) or Who's playing | Who's playing › Joanna › Set her lineup (3) |
| **anyone** | the show added "Mutinied +5" after Ep 7 | a change line in the game's feed | the line says it counts from Ep 8 here (the game's rule) and, if the game votes, "Vote: count it from the start?" (1) |
| **alex** | wants this game to always count new moments from the start | the game | gear › When the show's rules change › From the start (2) |
| **alex** | added a computer player by mistake, then took it out | the game | Who's playing › the bot › Take it out › hold; then the toast's Undo |
| **Andrew**, a player, drives by | a starter went home and he didn't look | nothing | his bench's first player started for him; the reveal says "filled for you" (0) |

## The lock, with its three states (BACKLOG 157)

One row on Manage this game, above How it plays, while the game locks by episode. Its value says the state in the show's words;
a tap opens the choices in place (Round 2's chosen-with-a-tick card), never a toggle you have to decode.

**Before the episode airs** (two states):
- **Open · locks at 8 PM** (Auto). The default.
- **Locked early**: everyone's move is set now. Change line: "riley locked Ep 6 early".

**After it airs** (three states, the game's late-move rule named in the first):
- **Open to whoever hasn't watched** (Auto, for a game with late moves on the honour system): "Anyone who's watched is locked; the
  rest have until they watch or Ep 7 airs." For a game with no late moves, Auto reads **Locked at airtime**.
- **Open to everyone**: "for a couch that sat down late"; everyone can still move, on the honour system.
- **Locked for everyone**: "nobody moves now, watched or not". This is the state the engine can't reach today (lockWrite writes
  `lineupsLocked = !aired`), and the one check-episode-lock expected.

Once results are in: **Locked for good**, no choices. A sport that locks by game says so and has no row (each player locks at his
game; nothing to choose).

Every choice saves at once with a typed Undo (back to the state it was) and a line. Choosing Auto again is just another choice,
not "Back to Auto" (one control, one vocabulary).

## A15: what's safe to change after the start

Each is a line in How it plays, value first, opened in place (3a's grammar). The line says from when, if it isn't "now".

| Option | Today | 3b | From when |
| --- | --- | --- | --- |
| **Claims close** (waivers' timing) | read-only row in Fine-tune | a stepper: 6 · 12 · 24 · 48 h before the episode | the next window |
| **Who goes first** | read-only | Fewest points (Recommended) · Most points · Rolling | the next window |
| **Free agency** | read-only | Until airtime · Off | now |
| **Others' lineups** (`hideStarters`) | set only at Start a game | Hidden until they lock (Recommended for head to head) · Shown as they're set | the next episode (this week's hidden lineups never flash open) |
| **How long: till a phase** | `endPhase` set only at Start a game | How long offers "Till the merge" (the season's phases still to come) beside "Through Ep N" | a phase that hasn't started |
| **Team size before the draft** | built in 3a | unchanged | until the draft |
| **When the draft opens** | the draft room's setting | unchanged (the draft job links there) | until it starts |

Fixed after the start, and each fixed line says why: how moves lock (own pace is chosen at the start), the questions once
answers are in, the team size once the draft starts, where it starts once it's begun.

## A17: when the show's rules change mid-season

### What happens today

The desk (the site admin) changes a season's rulebook in two ways: **Fixed a mistake** (rewrites it from Episode 1) and **The show
changed from Episode N**. A couch's own copy asks its Commissioner "Add it or Skip". Every game on the season follows. On
2026-11-05/06 Survivor 51 gained "Mutinied to another tribe +5" as a Fixed a mistake, so it counted back to Episode 1: Carter's
Episode 3 mutiny gave two seats +5 that nobody could have set a lineup for.

### The game's say

A line in How it plays, for games scored by the rulebook: **When the show adds a moment**.
- **Count it from the start**: every episode is rescored. Right for a brand-new show, or one whose seasons differ (The
  Challenge), where the first rulebook is a guess.
- **Count it from the next episode**: episodes already played keep their points. Right for a known format, where the rules were
  there to plan around.
- **Let the players vote**: the game's default applies at once (nothing waits: "let the AI settle"), and the players vote until
  the next episode airs; the Commissioner breaks a tie.

**What counts as "adds a moment":** a moment the game's rulebook didn't have before (found by comparing the rulebook the game
had with the one it's given: a new id in its moments). **A correction is not one:** a moment that was in the rules all along and
was scored wrong (Cristian's Episode 8 idol, +8) always counts as the results say, whatever the game's rule. **New points for a
moment it had** count from the start, as today (the engine keeps one number per moment; points by episode is its own engine step,
named in the story as a choice).

**How it works underneath** (the engine read, below): the show's facts are gathered for the whole season, the same for every game;
each game decides which of them count. When a game's rulebook gains a moment, the game records the episode it counts from: the
next one to air for "from the next episode", Episode 1 for "from the start". Scoring skips a moment before its episode. Only
moments added after this ships get an entry, so **no game's existing totals move** (compare-totals and the golden replays hold).

**The default by show** (recorded on the game when it starts, changeable after): from the start for a show in its first season
here, or a season-to-season format (The Challenge); from the next episode otherwise. Existing games: from the next episode
for Survivor 51 (a known format), which is what the couch argued for on 2026-11-06.

### The players are told, either way

The change reaches each game as a line in its changes ("New in the rules: Mutinied to another tribe, +5. Counted from Ep 8
here."), readable by every player. With a vote, it's also **a move on the strip** for each player, due when the next episode
airs: "Vote · Count 'Mutinied' from the start?" opening a small sheet with the moment, its points, what each answer means for
the standings ("From the start: +5 to Carter's holders for Ep 3"), and two answers (From the start · From Ep 8). After you vote
the sheet shows the tally so far. When it settles (more than half agree, or at airtime by the most votes, the Commissioner
breaking a tie, and nobody voting keeps the default), the line says how: "The couch voted 4–1 to count it from the start."
The ballots are the format-change vote's (`stage_change_votes`, keyed by the change), so the server has one vote.

## Typed undos (rule 6)

| Change | Today | 3b |
| --- | --- | --- |
| The lock | no Undo | typed: back to the state it was |
| Late moves (pace live/strict) | re-sends the old value from the phone | typed |
| The questions | re-sends the old list | typed (the undo reads the show's ctx on the server) |
| Freeze rules and joining | typed on the server, but the toast re-sends | the toast uses the batch |
| Computer players: add, level | no Undo | typed |
| Computer players: take out | "This can't be undone" | held, restorable 30 days, and the toast's Undo |
| Waiver timing, others' lineups, till a phase, the new-moment rule | new | typed (`settingsSet`) |
| Who fills in results | re-sends | gone: the control went in 3a (C27); nothing to build |

Undo lives where the change was made (the toast) and in This game's changes; both call the same typed undo, so a reload doesn't
lose it. Undo ends where today's ends (the next airtime), and a line past it says so instead of offering a dead button.

## A runner's jobs on the strip

The strip holds a person's moves; a runner's jobs join them, sorted by deadline, and each opens Manage this game at that job
(`&job=`). At most one runner job shows; more read "+2 more in games you run" (3a's assumption, kept). The jobs:
- **The lock on an episode night**, only for a game that locks together and only while it's open: it isn't a job (nothing needs
  doing), so it rides the night plate's own lock line as a runner's door: "Lineups lock 8 PM · You run it: Lock now". It becomes a
  line of its own only when someone changed it ("Locked early by riley").
- **A join request**: "jordan asked to join Lineup League" · Let in.
- **Start the draft**: as today's draft plate, now opening Manage this game's draft job.
- **A waiver window that's due**: a game whose windows open by hand ("You decide") with a team short: "2 teams are short in Couch
  Cup · Open a waiver window"; an open window closing within a day with seats still to pick: "Waivers close Tue 7 PM · 3 of 5
  picked · Pick for them".
- **A missing move** (166) is never a strip job: it would nag a runner about every forgetful friend each week. It's a count on Who's
  playing ("2 haven't set a lineup") and an action on that person's sheet.

One shared server read builds them (the lock, requests, the draft, waivers), so the strip, Manage this game, Games you run and
the show's ⋯ dot never disagree (today they're assembled on the phone from three sources).

## A16

- **164: a drafted Weekly Lineup starts with replacements on** ("Whenever one goes home"), at Start a game. Existing games keep
  theirs.
- **165: an empty starter's slot fills from the bench**, a game setting under Who scores each week: **Fill an empty slot from the
  bench** (on for new games). When a starter goes home and their seat doesn't change the lineup, the first one on the bench (in
  draft order) starts. The reveal and the person's lineup say "filled for you". Existing games: off until a Commissioner turns it
  on; it applies from the next episode, never to one already played.
- **166: set a missing move for someone** (a lineup or a pool pick), from their sheet in Who's playing, for a Commissioner or a
  Helper, while it's still open for them. The sheet says what they're missing ("No lineup for Ep 6 yet"); the move is made in the
  game's own editor, opened for them; logged "riley set Joanna's lineup"; the sheet never shows their moves back to the runner
  beyond "set" (as Pick for them).

## Manage this game, in order (3a's, with 3b's additions marked)

1. The head (3a).
2. Needs you (3a; **3b**: the shared jobs read, the waiver window that's due).
3. **This episode's lock** (**3b**: the states above, opened in place).
4. How it plays: How moves lock · Who scores each week (**3b**: Fill an empty slot from the bench) · **Others' lineups** (3b) ·
   Team size · The questions · Who can join · How long (**3b**: till a phase) · Replacing people who leave (**3b**: Timing real) ·
   **When the show adds a moment** (3b) · Points.
5. Who's playing (**3b**: "2 haven't set a lineup" on the section; a person's sheet: Set their lineup / Make their pick; computer
   players' Undo).
6. This season's rules on this couch (3a; Freeze's Undo real).
7. This game's changes (3a; every line's Undo real where 3b made it so).
8. This game: Rename, Stop (3a).

## Situations (the story's and the checks')

- **People:** alex (Commissioner of three games), riley (Helper on Lineup League), jordan (a player: nothing runner-only shows),
  Joanna (forgot her lineup).
- **Moments:** an episode night before airtime (lock open; locked early); after airtime (the three states); results in (locked for
  good); a new moment arriving mid-season on a known format (counted from the next episode) and on a new show (from the start); a
  vote open, voted, settled; a waiver window due (by hand, a team short) and closing; a starter gone home with an empty slot
  (filled from the bench, and off); a computer player added, taken out, undone.
- **Shapes:** own pace (no lock row; late moves fixed); a sport (lock by game: no row); a staged game (till the merge); a
  Prediction Sheet (the questions, fixed once answers are in).

## Left out, and why

- **A general "players vote on any change"** (any setting put to a vote). The rules change is the one the couch argues about; a
  vote on claims-close hours would be ceremony. The vote is built general on the server (any change key), so another can use it
  later without a new table.
- **A18** (hand a seat to someone else): not approved in Round 0.
- **A lock job on every episode night** for every runner: noise. The lock rides the night plate's line.
- **A missing move as a strip job**: see above.

## Open questions about the flow (for the user, named in the story with a recommendation each)

1. **Does a vote bind, or advise?** Recommended: it binds; the Commissioner breaks a tie. (Advice the Commissioner can ignore is
   a poll, and the couch has polls.)
2. **New points for a moment a game already had: from the start (as built), or by the game's rule too?** Recommended for now:
   from the start, as today, and the players told. By the game's rule needs points kept by episode in the engine (the spec
   format, Change the points and its preview all change): its own step if wanted.
3. **The default by show.** Recommended: from the start for a show's first season here or a varying format; from the next episode
   otherwise.

## What the engine has (from reading it, 2026-11-21)

- Settings writes: `settingsWrite` and its `SETTING_FIELDS` whitelist (backstage-games.ts:722); each key guards itself. No
  engine table of what may change after the start.
- `league_changes` with typed `ChangeUndo` (change-log.ts:109) and one undo route (`undoBatch`, league-changes.ts:174). The lock,
  pace and questions log `plainChange` (no undo); computer players too.
- A vote exists for stage-starting format changes: `StageLogic.tally/vote/decide` (state-logic.js:6215-6242), ballots in
  `stage_change_votes` (0205), the route `/api/leagues/[id]/stage-changes`, and no screen.
- Rulebook changes: `rulebook_edits` from an episode (`show_changed`), Fixed a mistake rewrites the base; `blocksAt` compiles per
  episode; the couch's copy asks Add it or Skip.
- The lock: `lockOf`/`lockWrite` (backstage-games.ts:623-669); `GhostLogic.lateWindow` closes on `lineupsLocked`.
- 165: `carriedLineup` leaves an empty slot on purpose (state-logic.js:4656). 166: the lineup and pick routes already take
  another seat, Commissioner only, logged `forPlayerChange`.

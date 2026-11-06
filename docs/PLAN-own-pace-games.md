# Games at your own pace: a game on a season that has already aired

**Status:** planned 2026-11-02 (the user wanted a game on The Challenge 42, which had finished airing; Start a game refused
it: "The season's over: every episode has aired"). **Part 1 built and checked 2026-11-05** (see "As built"); parts 2–4 next.
Decisions below are the user's (2026-11-02).

## Why

A finished season is watched "at your own pace" already (show-space.tsx `ownPace`, Tonight's "Your own pace" aside, Where
everyone is: "Finished", "Up to Episode 4 of 8"). But a game on it couldn't start: `startOptions` only starts a game with the
next episode to air, and on a finished season that's past the end. The case isn't the main one, but it's real: a couple
watching a season way behind who want a friendly game along the way, a few close friends doing the same. Any game should be
playable that way, trivia and bingo included.

The engine already plays this loop for one person: a late joiner "catching up" (docs/PLAN-new-design.md step 9; GhostLogic
in state-logic.js) makes their move for an episode, watches it, reveals it in that game alone (`catchUpReveal`,
`markRevealed`), then the next. Their copy of the game ends at their own mark (`viewFor` → `rewindTo`), their moves run
against that copy (`applyAs`), standings, chat and Where everyone is are cut to each person's mark. A game at your own pace
is a game where **every seat starts that way**, bots included. Nearly everything is reused; what's new is small and named
below.

## The rules (what a person reads)

- On a show that's finished airing, **Start a game** works as always. A strip at the top says: *Your own pace · Everyone
  plays one episode at a time, whenever they watch. Nobody has to wait for anyone.*
- **Starts** offers at most two: *Where you are · Episode 3* (your Spoiler-safe mark plus one; the default, nothing to
  enter) and *From the top · Episode 1*. One tile when they're the same.
- Everyone who joins starts where **they** are: never before the game's start, never behind what they've seen. The join sheet
  has nothing to choose: "You'll start at Episode 6."
- Playing is the catching-up strip and sheet: "Pick, watch it, then reveal · Episode 3 of 14". Your standings, the chat and
  Where everyone is show what you've seen, nothing past it.
- **Nothing blocks you, and nothing's hidden from you about the others.** The strip and the sheet say where everyone is
  ("Joanna · Ep 2 · Andrew · Ep 4"; "You're all here · Episode 3"). If revealing would put you more than one episode ahead
  of someone, the button says so, at the moment of tapping: *Reveal Episode 5 · you'll be 2 ahead of Joanna*. One ahead says
  nothing. Someone left behind sees "Conor's ahead · on Episode 5" on their strip. No locks, no nudges, no releases: close
  friends sort "don't watch 5 yet" between themselves, and someone who drifts off can't freeze the game.
- **Watch it together**: one row in the sheet opens the watch-along for that episode (its together clock, or plan a night).
- Computer players play too: they move the moment the first person reveals an episode, on what was known the episode
  before, so they're never ahead of or behind anyone.

## Decided (2026-11-02, the user)

- Soft guardrail, not a lock: visibility in the button and the strip; no nudge, no "go on without me", no timer. Reason:
  running ahead harms nothing in the game (every view is per person), only the togetherness, and a lock needs release
  machinery that isn't casual.
- Zero inputs to start: where you are, or from the top. Everyone joins where they are.
- Order by who plays it: a couple way behind plays Survival Pool, Bingo and Trivia, not a six-person draft.
- Exclusive-ownership Outlast at your own pace needs its own guardrails for waivers and swaps (claims resolve league-wide
  at airtime today, meaningless when people are on different episodes): part 3b.
- Words: "at your own pace" to people (the app's existing words for a finished season); "catching up" stays the engine's.

## The UI, mocked (2026-11-05; the user's picks)

Mocked with /impeccable: `.impeccable/mocks/own-pace/index.html` (gitignored), published privately at
https://claude.ai/artifact/3E6rgiMSJcP3MYJaQkS3rh. Seven flows; part 1's built screens get tightened to match.

- **Tonight = one plate per own-pace game (the user picked it).** "Episode 3 of 14 · Survival Pool", a Pick · Watch · Reveal
  steps bar, your pick with Change, and one button that's always the next step (Pick who survives → I've watched it · Reveal,
  the gap words small inside it past one ahead). Revealing without a pick asks once on the plate ("No pick for Episode 3 · Pick
  first / Reveal anyway"). It replaces the catch-up strip, the episode heading and the Your moves card for that game. One quiet
  line under it only when someone's behind or on the same one. Watch it together and the episode's bingo card sit under it. The
  reveal sheet ends with "Pick for Episode 4" (primary) and "Done for now". "Catching up" never shows in an own-pace game.
  Live late joiners keep today's strip (not asked to change).
- **Start a game:** no banner, no "for now" line, no AI card, no How long at your own pace; subtitle "all 14 episodes are out";
  starts read number first ("Episode 3 · where you are" / "Episode 1 · from the top", sub lines "You've seen 1 and 2" /
  "A rewatch"); the pace sentence sits under them. Games that can't play at your own pace yet aren't listed.
- **Join:** "You start at Episode N" on a plate, who's playing and where (computer players "Keeps pace"), one Join button.
- **Finish:** a "You finished it" plate (your place; anyone behind still has it hidden) and Start another.
- **Part 2:** the Games tab's "This week" becomes "Your Episode N" (bingo, Who goes home?, trivia on what you've seen, Watch it
  together); calls close when you reveal that episode.
- **Part 4:** the Prediction Sheet uses the same plate, first step "Answer N questions" (the questions listed on it).
- **Exclusive teams, replacements (the user, 2026-11-05):** replace on reveal: when you reveal an episode and lose someone, you
  pick a replacement right there from who's still in and on nobody's team; first to get there picks first. **But people on the
  same pace use the standard way**: those who reveal that episode together (on the same episode at once) put in claims as a
  normal waiver week and the usual priority settles them, among whoever's on pace. Part 3b designs when "together" closes.

## How it reuses the engine

| Need | What exists | What's new |
|---|---|---|
| Each person's copy ends at their own episode | `GhostLogic.viewFor` → `rewindTo`; `markFor` = min(league mark, season mark) | nothing |
| Moves for an aired episode, one at a time | `applyAs` (only `seen+1`, on the rewound copy); pick/lineup/group-slot routes already call it | nothing |
| Reveal one episode in one game | `catchUpReveal` → `markRevealed` ("reveal that one first"); CatchUpStrips + CatchUpSheet | gap words; Watch it together row |
| A seat that starts catching up | `addPlayer` marks `lateJoin` for humans joining an underway game | `GhostLogic.paceAll(state, from)`: every seat (bots too) `lateJoin = { startEpisode, catchingUp: true, seenThrough: from-1 }`, no ghost |
| Who's where | Where everyone is (`where.ts`), `ownPace` | the gap line in the strip and sheet |
| Over | `gameOver` on the full state is true at once on a finished season | not over while any seat is catching up |
| Bots | `Bots.run` on the full state at `currentEpisode` | on a catching-up bot: `applyAs` at `lj.seenThrough`, ratings on `viewFor`; run for episode N when the first human reveals N, then `lj.seenThrough = N` |

## Parts

### Part 1: Survival Pool at your own pace
- state-logic.js: `GhostLogic.paceAll`, bots' marks in state (`lj.seenThrough`), `gameOver` false while anyone's catching up.
- start-game.ts: `ownPace` on the options (a finished season: not `blocked`; `starts` = where you are / from the top); `startGame`
  writes the starter's membership with `results_seen_through = from-1`, calls `paceAll` after the season's results land
  (`makeLeague`'s `after`), bots too. Only games bots and the loop support: Survival Pool first.
- couch-joins.ts: joining an own-pace game: `start = max(game start, your season mark + 1)`, no choice.
- bots.ts / bot-logic.js: a catching-up bot picks on its view; `catchUpReveal` runs the bots for N before marking.
- Reads: `ended` (couch-joins, backstage, desk) judged on catching up; `ownPace` show space keeps its words.
- UI: start-game.tsx (the strip, the two Starts tiles, the subtitle "at your own pace · from Episode 3"); games.tsx (Play it's
  line and the Start row on a finished season); join-game.tsx (no choices; the gap words in the strip and the reveal button);
  Tonight's strip.
- Tests: tests/own-pace.test.js (paceAll, bots' marks, the gap words, over), a dev-test fixture (`zt-` league on a finished
  season with two seats and a bot) for the browser check at 390px.

### Part 2: the one-night games keyed to your next episode
- On an own-pace show the Games tab's "This week" is **your next episode** (mark + 1): Bingo's card, Weekly Calls (open
  while your mark is N-1, honour system like bingo; today "closed when it started"), Trivia (already per person).
- Watch it together row in the catch-up sheet → the watch-along for that episode (`?plan=`, planned night `how: 'start'`).
- The watch-along End panel's "Reveal your scores" opens the catch-up reveal for a game at your own pace.

### Part 3: the drafts
- 3a: Outlast and Weekly Lineup with teams picked from the cast as it stood at your start (the late joiner's pick from
  `draftPool(start-1)`, a blind draft; shared ownership).
- 3b: the live snake draft on an old season (the draft room on `viewThrough(start-1)`), exclusive ownership, **with waivers
  and swaps resolved per person's episode or switched off** (the user's caveat).

### Part 4: Prediction Sheet at your own pace
- Answers lock per person by their mark instead of by air time (`AnswerLogic.closed`, answers.ts refuses catching-up players
  today).

## As built: part 1 (2026-11-05)

Survival Pool at your own pace, checked end to end by `scripts/dev-test/check-own-pace.js` (API, then the screens at 390px on
new-fixture's couch and a real finished season in the local database) and `tests/own-pace.test.js`.

- **Engine.** `GhostLogic.ownPace` (settings.ownPace), `anyCatchingUp`, `paceAll(state, from)`: every seat, bots too,
  `lateJoin = { startEpisode: from, catchingUp, seenThrough: from-1 }`, no ghost. `bot-logic.js`: `botIds` leaves out a
  catching-up bot (never the league's live episode); `catchUpTo(state, n)` plays each week up to `n` on the bot's own copy
  (`applyAs`, so nothing past the week exists in it) and moves its mark; `eliminatorPickFor` split out for it.
- **Server.** `startOptions`: `pace` (`here` = your season mark plus one, `top`, `aired`) and `ownPace`; a finished season isn't
  blocked, its default start is where you are; `start=N` on an aired episode is an own-pace start (on a season you're behind on
  too: catch up to live, then play live, as a late joiner does). Only Survival Pool fits at your own pace for now (the rest say
  "an episode still to air, for now"). `startGame`: the starter's membership gets `results_seen_through = from-1`, `paceAll`
  after `setGame` (the season's results landed in `syncLeagueDecisions`), the change line and the push say "at your own pace".
  `couch-joins.ts`: `JoinGame.ownPace`; `gameOver` is false while anyone's catching up (the couch's lists, joining); joining
  forces the start to where you are (`ownPaceStart`: never before the game's start, never past live), nothing to choose.
  `reveal.ts markRevealed`: `Bots.catchUpTo(s, n)` under the lock, so the bots pick for an episode the moment the first person
  reveals it. `season-games.ts`: `catchUp.others` (name, week or null once finished) from every seat's mark (`seatsIn` now
  returns `marks`). `show-space.ts Game.ownPace`, `couch-hub.ts PlayingGame.ownPace`, `GameStanding.ownPace`.
- **UI.** `start-game.tsx`: the Your own pace strip, the subtitle, Starts' *Where you are · Episode N* and *From the top* tiles
  (the only ones on a finished season; under the live starts on one you're behind on). `games.tsx`: the Play it line, the Games
  tab's *Start a game · at your own pace* row on a finished season (Run it back under it when there's a next season).
  `join-game.tsx`: the join line and a no-choice join sheet ("You'll start at Episode N"); the strip's Your own pace tag and
  where-the-others-are line; the sheet's title, the others line, the reveal button's gap words (`src/new/couch/pace.ts`:
  `othersLine`, `allHere`, `aheadWords`), and the finish ("That was the last one"). `your-move.ts`, `tonight.tsx`: "Locks when
  you reveal it", "to do before you reveal" instead of airtime while catching up. A show with only own-pace games on it stays
  "at your own pace" (`played` leaves them out: show-space.tsx, where.ts, where-sheet.tsx, hub sections.tsx).
- Names in the words are the couch's (`couchMembers`: the username), as the standings show them.

## Noticed, not fixed
- The Play it card on a finished season offered Start a game and the sheet then refused it (the dead end that started this).
  Part 1 fixes it by making the start work; the Games tab's own Start row already hid itself.
- A pool with lives: once anyone's out for good (`GhostLogic.someoneOut`, bots included, which run ahead of a slower joiner),
  nobody new joins, as in a live game. At your own pace that can shut the door earlier than feels right; a rule for part 3.
- The Games tab's "This week" is empty on a finished season (bingo, calls, trivia key on the live episode): part 2.
- The watch-along End panel's "Reveal your scores" doesn't open the catch-up reveal: part 2.
- The hub's Where everyone is on the couch's own-pace season reads `ownPace` through the home read's games (GameRef.ownPace):
  built, not looked at in a browser.

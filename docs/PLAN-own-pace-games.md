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

## Exclusive teams: own pace with two sync points (the user, 2026-11-06)

Exclusive ownership needs everyone on the same episode only twice, so **exclusive teams play at your own pace with two sync
points**, and everything else stays as built. The use case (the user): a group starting a season late, a couple of episodes
behind (live or finished), drafting at an episode (Episode 1, before the season, or wherever they are), playing forward at their
own pace, maybe catching up to live, maybe not.

- **Sync point 1, the draft:** everyone in an exclusive game starts at the same episode and drafts together in the usual draft
  room, on the cast as it stood before that episode. Joining closes once the draft starts (as a live Outlast). Whoever runs the
  game starts the draft.
- **Sync point 2, a waiver moment:** an episode where someone's team lost a person, in a game with waivers on. Whoever reaches it
  first sees **"Wait for everyone else before watching more episodes, so the waivers are fair."** **Words only** (the user's pick):
  nothing stops them going on. Once every human has revealed that episode, a normal waiver week runs on the cast as it stood then
  (the usual order, claims, auto-fill); it settles when everyone's claims are in, or when its time runs out. Then everyone carries
  on at their own pace.
- Shared games never wait. A group that catches up to live just plays live.
- **Dropped (2026-11-06, the user: "too niche"):** a separate "Watch it together" mode with one game clock ("We're watching it
  now" locking everyone's moves). Designed and mocked the same day, never built; what carried over: the draft room on the cast
  as it stood before the start, waivers settled before newer results, and warn-don't-lock words.
- Mocked as flow 8 (https://claude.ai/artifact/3E6rgiMSJcP3MYJaQkS3rh): the Draft together plate, the waiver moment's wait
  (OK, I'll wait; Episode 6 quiet below with Go on), and Everyone's here: waivers.

## Every game at your own pace, through the wizard (the user, 2026-11-09)

"i want to use the wizard for everything so i have the same limitless options for game types. if im watching an old season of
the challenege with friends id want acess to these game types and to be able to reveal as i watch (some games require
syncronous, others can be played asyncronouly, some can be a hybrid of both and have check points to sync up)."

- **The wizard for every season.** An aired season (at your own pace) and Run it back open Start a game's wizard with the same
  options as a live season: the field, Randomize, every game. When it runs offers *Where you are · Episode N* and *From the top ·
  Episode 1*; Run it back fills in the last game. Today's list goes (`start-spec.ts wizardOptions` returns `wizard: null` for
  own pace now; `start-game.tsx` StartRouter sends it to the list).
- **Every game gets a pace, read from its spec** (a census over every spec, none left out, as the game page's):
  - **At your own pace**: everything one person does an episode at a time. Picks, lineups, best ball, a question each
    episode, bingo, trivia, a race, categories, wagers, and head to head (a matchup shows when you reveal that episode). Calls on
    a clock play on your own clock, honour-based (U0's late viewer).
  - **With sync points**, your checkpoints, only where a part needs everyone on the same episode:
    - an exclusive draft or an auction: draft together (built for Outlast);
    - waivers, FAAB or trades on exclusive teams: the waiver moment (built);
    - answers that depend on each other (split the pot, match the majority, only unique answers), and co-op's shared lives: that
      episode settles once everyone has revealed it ("Settles when Joanna reaches Episode 3"). Words only, as decided: nothing
      blocks anyone.
  - **Together**: watching at the same time is the watch along's planned night. The separate together mode stays dropped.
- **The wizard says it on the game**: "At your own pace", or "At your own pace · syncs at the draft and at waivers".
- **Order.** Engine first: the catch-up loop for every kind of spec game, `paceOf(spec)` naming its sync points, the census,
  and part 4's Prediction Sheet folded in. Then U1: the wizard on aired seasons and Run it back.

## Solo, then a simple bot (the user, 2026-11-09)

"maybe rather than computer players we allow users to play solo. for now at least, then introduce bots (or we just have a very
simple bot that picks randomly or based on players total points). end of the day this is so a solo player can play any game
type by themselves." After the above.

- **Solo first.** A couch of one starts any game in the wizard. Anyone invited later joins where they are. Your score is the
  game's own number (a streak, points, lines) against your own best.
- **What can't score alone.** Of 2,701 specs, 1,833 (68%) play solo as they are. The rest rank against or depend on others:
  head to head 371, split the pot 192, most episodes won 134, in teams 111, match the majority 79, only unique answers 59. Solo,
  those stay out of the wizard's choices until a bot can stand in; a typed game that needs them says why.
- **Then a simple bot**: a seat that picks at random, or by the points so far (the user's idea). It opens every game to a solo
  player, then grows into today's computer players (drafts and pools) for every answer kind.
- **The page solo**: no couch panel (the grid needs a couch); You is the page. The grid appears when someone joins.

## One person at their own pace on a live game (the user, 2026-11-09)

"i also want current games (with live airing) to have a option backstage to allow users to run at their own pace. aka in
survivor 51 i have a user who often forgets to set lineups and other actions by the air time, but i know she doesnt always watch
live. im okay letting her pick late if she hasnt watched the episode yet"

- **Backstage › Members › a person: "Plays at their own pace"**, a switch per game, set by the game's Commissioner. For
  someone who doesn't always watch live.
- **What it does:** after an episode airs, their moves for it stay open until they mark it watched (their Spoiler-safe mark
  passes it) **or the next episode airs, whichever comes first** (the user's pick). That covers a lineup, a pick, answers, and
  calls and a bingo card on their own clock. It's honour-based: only if they haven't watched it. Then the move locks and scores
  as if made on time. League-wide windows keep their times: a draft, waivers, trades.
- **The couch sees a quiet marker** (the user's pick): their row and sheet say "Set after it aired, before they watched". In
  head to head, the opponent's week reads "Waiting on Joanna's lineup" until it's set.
- **What they see:** after airtime, while they're behind, the move is still due. It's still the yellow, and it says why: "Episode
  8 aired · you haven't watched it · set your lineup first". Then watch, reveal and the scores, as at your own pace.
- **The engine:** no new machinery. A live seat with the switch on catches up while it's behind (the late joiner's loop:
  `applyAs` on their copy at their mark + 1, reveal with `catchUpReveal`). The flag sits on the membership; the cap is the
  next episode's air time.
- **Backlogged** (the user, "the former is simpler"): no limit, open until they watch even past the next airtime (BACKLOG 44).

## Pace is the game's setting, not a person's (the user, 2026-11-13)

Found while connecting stages in the gameplay explorer: the per-person switch above had to be set stage by stage and did
nothing on the staged game itself. The underlying flaw: how late someone watches is already tracked per person per show (one
reveal moves it for all their games), so a second per-person flag, set per game by the Commissioner, duplicated it; and the
person who watches late had to ask someone to find a switch. The user agreed, and decided:

- **One setting per game, three values** (`GhostLogic.pace`):
  - **Own pace**: the game waits for people. A move stays open until you've watched that episode, however far behind you are;
    drafts and waivers on exclusive teams wait at their sync points (above).
  - **Live**: the calendar runs it. A move stays open after an episode airs until you've watched it or the next one airs,
    whichever is first (the per-person switch's rule, now everyone's). Honour-based.
  - **Live, strict**: everything locks at airtime.
- **Running games: Live for all** (the user's pick): every live game already running gets the late window for everyone at
  once. In the data that's the default: only a strict game stores anything (`settings.lockAtAir`), so nothing is migrated, and
  a seat still carrying the old per-person flag is simply covered.
- **The control: tiles** (the user's pick) in Backstage › Game settings, one set per game, under the episode's lock row. A
  Commissioner's; frozen in Competitive mode. A game in stages sets it once, and its stages follow.
- **Order of building.** (1) The setting, the late window for everyone, the per-person switch gone, stages inheriting, the
  tiles. (2) Own pace as a choice when a game starts on a season still airing, and a game that stays at its own pace as new
  episodes air (today a seat that catches up plays live from then on).
- **Open, for the user** (found while reading the start code, not decided): with Own pace the default on a season still
  airing, a shared-team draft (Weekly Lineup) would lose its blind draft revealed together, because a game at its own pace has
  each seat pick its own team whenever they start. See "Step 2, and what it waits on" under this step's As built.

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

## As built: part 1's UI to the mock (2026-11-05)

The mock's part 1 screens, built and checked at 390px (`check-own-pace.js`, nine screens: the Games tab's row, Start a game,
Tonight's plate asking for the pick / asking once before a reveal with none / picked with the gap words, the revealed sheet,
riley's plate, the join sheet, the finish plate).

- **Tonight's plate** (`src/new/show/pace-plate.tsx`, `OwnPacePlates`): one per own-pace game, first on Tonight. Tag "Episode N
  of M · Survival Pool", the step as its title, a Pick · Watch · Reveal bar, your pick's face with Change, one button that's the
  next step (the gap words small inside the reveal button), "I've already watched it" asking once ("No pick for Episode N · Pick
  first / Reveal anyway"), and one quiet line only when someone's behind you or on the same one. The reveal opens a sheet
  (`CatchUpResult`, shared with the late joiner's sheet) with your place so far, "Pick for Episode N+1" and "Done for now", or
  "See how you finished". Once you've seen the last episode the plate is the finish plate (your place of how many, who's still
  behind with it hidden, See the standings). Tonight leaves out the episode heading and that game's Your moves card (no block at
  all when it's the only game). Late joiners in live games keep the strip (`CatchUpStrips` skips own-pace games).
- **Data:** `GameView.ownPace` (from `Game.ownPace` through `refOf`) and `GameView.pace` (`others`, `last`) for every own-pace
  game, caught up or not; `catchUp.others` is gone. `JoinOptions.playing` (name, computer, episode) for an own-pace game.
- **Start a game:** no banner, no AI card, no How long at your own pace, no doesn't-fit line (`noFit` null); the subtitle on a
  finished season is "Survivor 49 · all 13 episodes are out"; "Start from" tiles read number first ("Episode 5 · where you are",
  "You've seen 1 to 4." / "Episode 1 · from the top", "A rewatch.") with the pace line under them.
- **Join:** a plate ("You start at Episode N", what you've seen or that the game starts there), Who's playing with each episode
  (computers "Keeps pace"), one Join button.
- **Play it's line** on a finished show: "Every episode is out. Pick who survives before you watch each one, reveal after."
- Not built from the mock yet: the finish plate's "Start another" (no next all-out show is read for it), Watch it together and
  the bingo row on the plate (part 2).

## As built: part 2 (2026-11-05)

The one-night games follow your episode on a show watched at your own pace (every episode out, or a streaming drop).

- **Call it** (`calls.ts`): `pacedSeason` (finished, every listed episode aired, or a binge drop) and `pacedOpen`: an aired
  episode's calls are **open to whoever is on it** (has seen the one before, not it), on the honour system like bingo's ticks;
  "behind" before that; closed once you've seen it ("You've seen Episode N: its calls are closed"). `EpisodeCalls.paced` turns
  the sheet's words from airtime to "until you've seen it" / "until they've watched it". Live seasons are unchanged.
- **Games tab:** "This week" reads **"Your Episode N · Before you watch"** at your own pace, with Call it for that episode (bingo
  already dealt your next episode's card: `bingoEpisode`). Trivia was already about what you've seen.
- **Tonight:** Extras reads "Extras · Episode N" and offers your next episode's calls (`paceNext`, `toCall`). The watch along
  under the plate is the mock's "Watch it together" (no second row); your episode's bingo card stays in Extras.
- **Watch along's end** (`EndPanel`): on an episode an own-pace game of yours is on, "Reveal it on Tonight to see how your pick
  did" with **Back to Tonight to reveal it**, where the plate's Reveal is the first thing.
- Checked by `check-own-pace.js`: calls 5 open (alex on 5), 6 behind, 4 closed with verdicts and a call on it refused; the Games
  tab's "Your Episode 5" with its Call it row.

## As built: bingo's bank at your own pace (2026-11-05)

A season added after it aired has no episode banks (the bot writes those the day before an episode airs) and no season bank
unless an admin ran Write squares now, so bingo showed nothing at your own pace. Now starting an own-pace game on a season with
no bank of its own asks our bot for one (`desk-research.ts queueSeasonBingo`, after the answer: the desk's Run now queue, a
season bank, asked by whoever started the game, logged on the desk), handed to a request of its own (`handOn`). Nothing when
the season has its bank, one's on its way, or the bot isn't answering. A dev server's stand-in bot comes through the start
route (`botFor`). `check-own-pace.js` proves it with a stand-in (never ChatGPT) and cleans what it made on the real season.

## As built: part 3a, shared teams (2026-11-05)

Outlast and Weekly Lineup play at your own pace with **shared** teams (the user, 2026-11-05: Outlast counts the whole season, as
it always does, so a later joiner keeps the head start of picking from who was still in).

- **Engine:** `paceAll` stamps a blind draft as revealed in a game with teams (no draft room or Your move ever asks for one);
  `GhostLogic.teamAt`/`takeTeam` (begin's team checks pulled out), `needsTeam`, `pickTeam` (a seat whose start is set picks its team
  once, from `draftPool`); `viewFor` leaves out the team of anyone who started after your week (it would say who survives).
  `bot-logic.js`: `paceTeams` (each bot picks its team on the copy before its start: ratings, the tribe spread, any cap),
  `lineupFor` split out of `lineups`, and `catchUpTo` sets a Weekly Lineup's lineup for each week a bot plays.
- **Server:** `start-game.ts` lets Outlast and Weekly Lineup fit at your own pace (`PACED`), forces `own: shared, order: blind`,
  fits Outlast's team size on the copy before the start, and runs `Bots.paceTeams` after `paceAll`. `POST
  /api/leagues/[id]/team` ({ castawayIds }: `pickTeam`). `markRevealed` refuses a reveal before your team ("Pick your team
  first"). `GameView.pace.team` ({ need, pool }). No draft room for own-pace games (`season-draft.ts`).
- **UI:** Tonight's plate starts with **Pick your team** (`TeamPlate`, "5 from who was still in before Episode 1. They're yours
  for the whole game.") and a face grid sheet (`TeamSheet`: tap to take, "Pick 2 more", "This is my team"); then the plate's
  usual steps (Weekly Lineup: Set · Watch · Reveal; Outlast: Watch · Reveal). Joiners pick theirs in the join sheet, as before.
- Checked: `tests/own-pace.test.js` (four 3a cases), `check-own-pace.js` (jordan's Weekly Lineup: no draft, the bot's team, the
  team plate and sheet at 390px, the lineup step, a lineup on an aired episode, the bot's lineup set at the reveal).

## As built: exclusive teams, two sync points (2026-11-06)

Outlast at your own pace is exclusive again (as Outlast is everywhere: 3a's forced sharing taken out), with the two sync points;
Weekly Lineup stays shared (its preset). Everything else at your own pace is unchanged.

- **Sync point 1, the draft:** `GhostLogic.draftsTogether` (own pace, exclusive, a team), `draftDone`, `paceSeat` (a joiner
  before the draft: a seat in it at the game's start with everyone, no ghost). `joinMode` is open until the draft starts, locked
  after. The draft room runs as usual: `draftView` never sends you to reveal first in an own-pace game and reads the cast on the
  copy before the start; `startDraft` checks that copy; `pickInDraft` refuses anyone who wasn't in before the start or is taken;
  bots draft on that copy (`bot-logic.js draftCopy`; `run`/`hasWork` count catching-up bots). `markRevealed` refuses "Draft
  together first". `needsTeam`/`pickTeam` are the shared games' only. `season-draft.ts` shows the draft room for exclusive
  own-pace games. Joining: `joinOptions` says `drafts` (start = the game's, no team to pick), `joinGame` uses `paceSeat`.
- **Sync point 2, a waiver moment:** `waivers.js` runs an own-pace exclusive game's waivers on the league **as it stood at the
  episode everyone has reached** (`pacedMark`: the lowest of its people's marks; computer players keep pace; `pacedCopy`), and
  folds what the week did back (`foldBack`: the waiver weeks and log, who owns whom). A week opens there only at a waiver moment
  (`lossAt`: someone on a team went home in that episode, not replaced), settles once everyone owed a replacement has a claim in
  (`owedIn`, also right after a claim's saved) or when its time runs out, and closes when everyone has moved past it (auto-fill as
  usual). Claims are checked on the same copy (`saveClaim`). Bots claim on the copy (their `waiverClaim`).
- **Words:** `GameView.pace.draft` ("waiting" / "live") and `pace.gather` ({ episode, lost (who, whose team, yours), waiting,
  open }). Tonight's `DraftPlate` ("Draft together": who's in, Start the draft for the runner, Go to the draft once it's on),
  `GatherPlate` ("Waivers after Episode N": who went home from whose team, "Wait for everyone else before watching more
  episodes, so the waivers are fair", waiting on whom, **OK, I'll wait**, and **Go on to Episode N+1 anyway**: words only), then
  "Everyone's here: waivers" with Go to waivers. The join sheet says "You'll draft your team together with everyone".
- Checked: `tests/own-pace.test.js` (the draft on the cast before the start; a waiver week opening only once everyone's there,
  at that episode, settling and auto-filling from who was still in), `check-own-pace.js` (sam's Outlast with jordan and a computer:
  the draft plate, joining before the draft, nobody after, the draft through its route, waivers on, sam ahead at a waiver moment
  with the wait and Go on, jordan arriving and the week on at that episode; three screens at 390px).

## As built: one person at their own pace on a live game (2026-11-09)

The user's decisions above, built and checked (no migration: the switch rides on the seat in the league's state).

- **Engine** (`state-logic.js GhostLogic`): `player.ownPace` is the switch (`playsOwnPace`, `setPlaysOwnPace`: never a computer player,
  a seat still catching up, or a game everyone plays at their own pace). `lateWindow(state, seat, mark, now)` is the latest of the
  game's episodes that has aired, while the seat's mark is before it and the next one hasn't aired (`until`, its air time; none
  known: until they watch). `lateCopy(state, n)` is the league going into `n` with `n` held open (`openPastAir`; its results hidden,
  the teams as they are, since waivers and trades keep their times); `applyAs(..., { late: true })` runs the move there, copies the
  seat's part back and marks `ep.lateSet[seat]` when anything of theirs changed. `movedFor` (a lineup set for it, not carried in, or
  a pick) and `lateWaiting(state, marks, now)` (only a game with a lineup or a pick) name who the couch waits on. Answers:
  `AnswerLogic.closed` and `lateEpisode` take the one answering (`player`) and keep that episode open the same way.
- **Server:** `own-pace-seats.ts` (`watchMark`: the seat's season mark, guard.ts `seenThrough`, so someone who sees results as
  they come is never behind; `paceMarks`; `lateMark` for a move on that episode). The lineup, pick (set and clear) and group-slot
  routes run a late move through `applyAs` late. `due-moves.ts` lists the episode's lineup or pick from the late copy as `late`,
  due by the next air time, in place of the next episode's (a carried lineup counts as not set). `calls.ts` opens an aired
  episode's calls to someone with a seat at their own pace on the season (`lateOn`, from the schedule). Bingo cards never close
  once aired, so nothing there. `backstage-members.ts`: `Member.pace`, `Member.seesAll`, `MemberGame.pace`, `setMemberPace` (a
  Commissioner of that game; a line in Recent changes), `PUT /api/seasons/[id]/backstage/members/[userId]/pace`.
- **Views** (`game-view.ts`): `GameView.late` (your window, while you're one behind; your copy has the episode open and
  `revealFirst` is null, since its results don't stand in the way of its own move) and `GameView.waiting` (from the server's
  marks), which marks both squares of a head-to-head matchup that waits (`Square.waiting`). `Square.late` from `ep.lateSet`.
- **Screens** (through impeccable; 390 first): Backstage › Members › a person: a "Plays at their own pace" section, a switch per
  game of theirs you're a Commissioner of (the shared `SwitchRow`, bone when on), its meaning said once ("After an episode airs,
  their moves stay open until they watch it or the next one airs"), or, for someone who sees results as they come, that nothing
  stays open until they hide them; a toast with Undo. Their due move is the yellow with the reason (Tonight's card, the Games
  tab's card: "Episode 6 aired · you haven't watched it · set your lineup first"; once set, "Change until you watch it"). The
  quiet marker: a small clock in the corner of their square (grid and strip), the grid's foot saying "Set after it aired, before
  they watched", and the same words on their episode's line and lineup week. Head to head: that matchup's two squares pending
  (a dashed "…"), the grid's foot "Episode 6: waiting on jordan's lineup", the week's line "Waiting on jordan's lineup".
- Checked: `tests/own-pace.test.js` (six live cases), `tests/answers-time.test.js` (answers), `npm test` 2023 pass;
  `scripts/dev-test/check-own-pace-live.js` (API, then 390: ALL PASS; seven screens); `check-own-pace.js` still passes.
- **Follow-ups the same day** (from the list below): head to head's records leave a waiting matchup out of both seats' W–L (and
  your own matchup record) until it's set (`game-view.ts withoutResult`; the order stays the engine's); the reminders job sends one
  push after airtime ("Lineup League: episode 6 has aired · Set your episode 6 lineup before you watch it", `db/reminders.js
  remindLate`, window `late` in reminder_log, once an episode; nobody who sees results as they come or moves along Live);
  `check-own-pace-live.js` now also proves a Prediction Sheet answer and a Call it call taken after airtime (and refused without
  the switch), the records, the reminder (a dry run), and the Members sheet's read-only line for a game you don't run.

## As built: pace is the game's setting, step 1 (2026-11-13; pushed 2026-11-14, live)

The user's decisions above ("Pace is the game's setting"), the first of the two steps. The second is built too: "As built: … step 2"
below.

- **Engine** (`state-logic.js GhostLogic`): `pace(state)` is `'own'` (`settings.ownPace`), `'strict'` (`settings.lockAtAir`, set
  true, never stored false; in `settings.js` OUTSIDE, so setting the game keeps it) or `'live'` (nothing stored: the default, so
  every live game already running is live with no migration). `setPace(state, 'live' | 'strict')` is the Commissioner's write: it
  refuses on a game at your own pace and for `'own'` ("when it starts, for now"), and clears any seat's old `player.ownPace`.
  `playsOwnPace(state, seat)` (the name kept: lanes may call it) now reads the game: a seat playing live in a game that's
  `'live'`, never a computer player or one still catching up. `setPlaysOwnPace` is gone. Everything downstream is unchanged and
  follows by itself: `lateWindow`, `lateCopy`, `applyAs` late, `lateWaiting`, answers' `closed` and `lateEpisode`, the routes'
  `lateMark`, due moves, Call it's `lateOn`, the reminders job.
- **Server:** `backstage-games.ts` `GameSettings.pace` (`{ mode, of }`: `of` names the game a stage follows) and `paceWrite` (a
  Commissioner's; refused while locked down, on a stage, and on a game at your own pace; a line in Recent changes: "Moves stay
  open until you've watched, or the next episode airs" / "Moves lock at airtime"); `PATCH /api/seasons/[id]/backstage/settings
  { leagueId, pace }`. `backstage-members.ts` lost `Member.pace`, `Member.seesAll`, `MemberGame.pace` and `setMemberPace`; the
  route `backstage/members/[userId]/pace` is deleted.
- **A game in stages sets it once** (`stages.ts` `mirrorPace`, in `seatStage`; `stagesToSeat` notices a stage that differs): the
  write to the game commits, then each stage follows in its own write, as its seats do. A stage made later follows at the game's
  next write.
- **Screens** (through impeccable; 390 first): Backstage › Game settings, under the episode's lock row: **When moves lock**, two
  tiles as Who can join ("When you've watched it", Recommended: "Open after an episode airs until you watch it, or the next one
  airs" / "At airtime": "Everything locks when the episode starts"), "The same for everyone in the game. Late is on the honour
  system: only if you haven't watched it yet.", saved at once with Undo on the toast. A game at your own pace and a stage read as
  one line each (nothing to choose there). The lock row's Auto line now agrees with it in a live game ("locks at its start, Fri
  8:00 PM, later for anyone who hasn't watched it"). Backstage › Members › a person: the "Plays at their own pace" section is gone.
- **The explorer:** its `live-only` timing is live and strict (`runtime-data.cjs` `syncMarks` stores `lockAtAir`;
  `core-runtime-28`), as a live game always was there. A live game with late moves isn't a timing yet (its late moves need the
  routes' late path as actions).
- **Checked:** `tests/own-pace.test.js` and `tests/answers-time.test.js` (the live cases moved to the game's setting: live by
  default for every human seat, strict locks, the old flag cleared, own pace refuses); `npm test` 2,141 pass; type check and
  eslint clean; `node scripts/dev-test/check-own-pace-live.js` (API, then 390: ALL PASS; strict refuses, live opens for whoever
  hasn't watched, the settings tiles and their toast, the Members sheet without the switch, the late card, the couch's marker);
  `node scripts/dev-test/check-stages-explorer.js --case=pace` (a game in stages on the real routes: strict refuses Bo's late
  lineup in a stage, a stage refuses the setting, live on the game and both stages follow and take it, strict again and they
  follow back).
- **The honour note** (the user, 2026-11-13: "a slight UI hint/warn to ensure we keep the honours system alive", so someone can
  set a late move in good faith, or say they've watched and keep what they had). Your moves, once for the sheet, above its games
  (watching an episode is across all of them): "Episode 6 has aired · It's still open because you haven't watched it. Seen it
  already? Leave this as it is." and **I've watched it**, a link to Tonight with that episode's reveal open
  (`paths.reveal`): nothing is saved, anything changed and unsaved is dropped, and the reveal closes the move with what stood.
  The sheet's foot says what locks it: "Watching it does." The couch's marker ("Set after it aired, before they watched") was
  there already and is the other half of the honour system. `dock.tsx` `OnYourHonour`; checked in `check-own-pace-live.js`
  (the note once for the sheet, its words, the way out: the reveal opens, the mark moves to 6, the lineup they had stands, a
  later change is refused).
- **What changes for people on the next push** (the user's "turn it on for all"): in every live game, anyone who hasn't watched an
  episode can still set its lineup, pick or answers after it airs, until they watch it or the next one airs; the couch sees the
  quiet marker; the after-airtime reminder ("episode 6 has aired: set your lineup before you watch it") now goes to everyone in
  that position, once an episode, not to one switched person. A Commissioner who wants the old behaviour picks At airtime.

### Step 2: the user's decisions (2026-11-13)

- **The draft stays together.** A draft that isn't private needs everyone there (a snake's turns); a private draft is each
  person's in their own time, revealed together, as now. Own pace begins after the draft. So starting a game at its own pace on
  a season still airing must not use today's "each seat picks its own team" (that stays for a season that has aired, where
  everyone starts on a different episode).
- **It keeps waiting all season.** Catching up to the calendar once doesn't end own pace: someone can fall behind again, and the
  game waits for them again.
- **The pace family is chosen at the start.** A game that starts live stays live (it can still be made strict or back); own
  pace to live isn't offered.
- **The four late rules become one** (the user: "I'd go with your call"; BACKLOG 64). The game's pace is the rule. The episode's
  lock override stays as the one exception, by hand, for one episode. A game of questions' late lock in hours
  (`extras.lateLock`) is retired into the pace: live already does what it did, capped by the next airing instead of by hours.
  BACKLOG 44 (no limit) is own pace. Built with step 2.
- **A draft that opens mid-season** (a later stage's; the user asked for an honest view, nothing decided): see BACKLOG 67.

### Step 2, and what it waited on

Own pace as a choice when a game starts on a season still airing, and as the default. Not built: it turned out to carry a
decision of the user's, found only once the start code was read (their ground rule, 2026-11-13: bring a design flaw up, don't
design around it).

- **What a game at its own pace does today that a new game on an airing season wouldn't expect.** `paceAll` makes every seat a
  late joiner and marks a private draft as revealed, so **shared teams are never drafted together**: each seat picks its own
  team whenever it starts (right for a season that has aired, where everyone is on a different episode). On a season still
  airing, where everyone starts on the same episode, that would quietly take away the blind draft revealed together, the most
  common game's first night. Options: keep the draft together when everyone starts on the same episode and let own pace begin
  after it (recommended; needs a variant of `paceAll` that leaves the draft to be played); each picks their own, as now; or keep
  Live the default and make Own pace a choice.
- **A game at its own pace stops waiting once you catch up.** `markCaughtUp` ends catching up for good, so on a season still
  airing a caught-up seat plays strictly live from then on (it doesn't even get the live game's late window: `playsOwnPace`
  leaves own-pace games out, as before). Step 2 needs the seat to catch up again when a new episode's results arrive (its mark
  is in the state, `lateJoin.seenThrough`, so a settle after results can do it), and the late window between airtime and
  results. The explorer's own-pace games already behave this way (its `syncMarks`), which is evidence the reads cope; the
  server's write path has never done it.
- **Turning a running game to or from own pace** isn't a flag flip: every seat needs a mark, exclusive teams switch to their
  sync points, and seats mid catch-up need somewhere to land. Start-only is the safe first cut.
- **Where it's chosen:** the wizard's sheet (a control there is a U0-level decision) and the old list.
- BACKLOG 56 and 57 are own-pace bugs still open; BACKLOG 52 (the twist) too.

## As built: pace is the game's setting, step 2 (2026-11-13; pushed 2026-11-14, live)

Own pace as a choice when a game starts on an episode still to air, the default for a show, and a game that keeps waiting all
season. The user's three decisions above ("Step 2: the user's decisions") are what it does.

- **Made and drafted as a live game** (`GhostLogic.paceTogether`): a start on an episode still to air sets `settings.ownPace`
  and `settings.startedTogether` (both in `settings.js` OUTSIDE) and nothing else. No seat is a late joiner yet, so the draft
  is the game's ordinary one: a private draft locked by each person and revealed for everyone at once, a draft with turns in
  the draft room. (A start on an episode that has aired is unchanged: `paceAll`, each seat picks its own team.)
  `GhostLogic.ownTeams` is the one question "does each seat pick its own team here?" (`season-draft.ts` read the ownership
  alone before, which would have hidden this game's draft room); `needsTeam` is never true while a private draft is still to
  be revealed.
- **It waits from its first results on, and keeps waiting** (`GhostLogic.settlePace`, run after every write to a league in
  `db.ts withLeagueLock`, beside the other settles): in a game at its own pace, once results exist in its span, a seat with no
  late-join record gets one (`{ startEpisode: the game's, catchingUp: true, seenThrough: start - 1 }`), and a seat that had
  caught up is catching up again when results arrive past its mark (`lateJoin.seenThrough`). Never past the game's last
  episode; never a seat that left, a ghost, or one still choosing its start. Computer players too: they keep pace with the
  first person to reveal, as before. This also fixes the older gap for a game made on an aired episode of a season still
  airing: a seat that caught up used to play strictly live from then on.
- **Between airtime and the results** a caught-up seat has the live game's late window (`playsOwnPace` is now "any seat in a
  game that isn't strict, unless it's catching up"), with no closing time at its own pace (`lateWindow`: `until: null`, and an
  episode past the game's span airing doesn't end it). So the honour note, the couch's marker and "Waiting on" all apply.
- **The reveal** (`reveal.ts markRevealed`): a seat with no mark of its own in a game at its own pace is where the show has the
  person, never past the episode before its start (`showMark`), so someone behind the game's start reveals the earlier episodes
  first instead of being told they're on the game's first one; an episode already passed changes nothing (it was refused).
  **A bug found by the new check and fixed:** a reveal that reaches a game through its linked group (`late-join.ts
  revealAcrossGroup`, the usual way on a couch with several games on one season) never moved the game's computer players, and
  skipped the team-first and draft-first lines its own reveal holds. Both are held there now.
- **The start** (`start-game.ts`): `StartOptions.runs { choices, recommended }` (from an aired episode: own only; from one
  still to air: own, live, strict, recommended own for a show and **live for a sport**, which stays live as decided 2026-11-09);
  `paceAsked` checks a start's `pace` (none sent is live from an episode still to air, so a phone on an older bundle, a
  sport's own start and every test fixture start what they always did; from an aired episode it's own); `applyPace` sets it.
  Both starts take it (`startGame`, `startFromSpec`). Run it back with nothing said plays at the pace of the game it runs
  back. **A start with a phase runs live or strict**: own pace is refused there for now (its draft would open mid-season for
  people who may be behind: BACKLOG 67, the user's to decide). The pace family is fixed at the start: `setPace` still refuses
  own, without "for now".
- **Screens** (through impeccable; 390 first): Start a game's sheet, under When it runs: **When moves lock**, one line that says
  what the game will do ("When you've watched it. However late that is: the game waits for each of you.") with **Change**
  behind it: three choices named by the latest moment a move can be made, so the heading reads on into the answer (When you've
  watched it, Recommended / When the next one airs: "Or sooner, once you've watched it." / At airtime: "Everything locks when
  the episode starts."), and the honour line. The recommended one is already chosen, so the one-tap start costs nothing extra.
  Hidden on a start from an aired episode (the switch above it says it already). Backstage › Game settings uses the same three
  names: its live tile is now "When the next one airs" (it was "When you've watched it", which is own pace's name now), the
  own-pace line reads "When you've watched it. At your own pace: …", and the lock row's Auto line says who it stays open for
  at own pace too.
- **Checked:** `tests/own-pace.test.js` (three new: made and drafted as a live game then late joiners from its first results,
  the window with no end, catching up again; the settle's limits; a private draft still to be revealed and `ownTeams`);
  `npm test` 2,144 pass; type check clean; `node scripts/dev-test/check-own-pace-start.js` (new, reusable; on the real
  routes: the options and refusals, the game made as a live one, the private draft revealed together with a computer player,
  a late lineup between airtime and results with no closing time, every seat catching up at the results, the reveal, a lineup
  set after the results by someone who hasn't watched, Episode 7's results leaving everyone behind again; then 390: the sheet's
  line, Change, the three choices, Game settings); `check-own-pace-live.js` and `check-own-pace.js` run again after it (ALL
  PASS, both); a 30-case explorer campaign on the real routes (`.ui-atlas/campaigns/pace2-api`: 30 of 30, known findings only), so
  the server's new settle agrees with the explorer's own-pace games.
- **What changes for people on the next push:** a new game on a show still airing starts at its own pace unless whoever
  starts it changes When moves lock. Every seat reveals each episode to move on (as on any season you play), a move for an
  episode stays open until that person has watched it, and standings show through each person's own episode. Exclusive teams
  with waivers wait at their waiver moment for everyone (sync point 2, words only). Games already running don't change.

## As built: the late lock retired into the pace (2026-11-14; BACKLOG 64; pushed 2026-11-14, live)

The last of "the four late rules become one". After it, two things decide whether a move is taken after airtime: the game's pace,
and whoever runs the game locking or opening one episode by hand.

- **Nothing reads `extras.lateLock`** (a game of questions' "until you've seen it, up to 12 to 72 hours", A7).
  `AnswerLogic.closed` and `lateEpisode` go by the game's pace alone (`GhostLogic.lateWindow`): in a live game the pace's window
  already covered what the hours did (until you've watched, capped by the next airing instead of by hours); in a strict game the
  hours contradicted the setting.
- **Nothing describes or offers it:** `describe.js` lost its rule line ("Watching late? …") and its "Watching late" setting; the
  drafter's manual no longer lists the field; the game page no longer tags "Late lock". **A spec that carries one is still
  valid** (`schema.js` keeps its check, marked retired; `settings.js` still round-trips `lateLockHours`), so no stored game is
  touched and nothing is migrated.
- **A hand lock beats the late window** (`lateWindow` returns nothing for an episode locked by hand, `ep.lineupsLocked`): the
  hours' path honoured it, and the pace's window didn't, so retiring the hours would have lost it. It's the one exception. That's
  a lock set **before the episode starts** (Backstage's row stores one only then). Once an episode has started the row can open
  it to everyone, but has no "locked for everyone" (noticed below).
- **The trivia sheet's key** (`trivia-key.ts heldFromSheet`) is held until the round locks for that person by the game's pace:
  to airtime; then, for someone who hasn't watched it, until they do at own pace, and until they do or the next one airs in a
  live game; a strict game, to airtime only. It was airtime plus the hours.
- **Checked:** `tests/answers-time.test.js` (the late lock's case rewritten: a spec that carries one is valid and kept, the
  hours alone open nothing, live goes past them, strict locks at airtime, a hand lock closes it) and `tests/own-pace.test.js`
  (a hand lock: no late window); `npm test`; on the real routes `check-trivia-game.js` (updated: the sheet holds the batch
  from someone who hasn't watched, and gives it once they have), `check-questions-time.js`, `check-engine-lab.js --api`
  (a spec with a late lock plays, said nowhere), `check-own-pace-live.js` (now also: alex locks Episode 6 by hand before it
  airs, and jordan, who hasn't watched it, has no late window in a live game).
- **Found on the way:** `check-trivia-game.js` had been failing since step 1 (it expected a round to close at airtime for
  someone who hadn't watched; nobody reran it). Only checks the change could affect are run each step, and that one was missed:
  any check that asserts a lock at airtime belongs on that list from now on.

## As built: three own-pace bugs decided and fixed (2026-11-14; BACKLOG 56, 57, 68, and 69; pushed 2026-11-14, live)

The user's decisions (2026-11-14): 57 "definitely address this"; 56 "sure A"; 68 "sure C", and asked whether it wants a lock or
an explanation: an explanation (a lock would take away a game that works).

- **57: a week already played keeps who was fielded in it.** A lineup never saved for an episode is carried from the last one
  saved; it now keeps whom the seat held **for that episode**, read from the move log (`ActiveRosterLogic.heldFor`), where it
  kept whom the seat holds today. So points never move without new results. Nothing stored, nothing migrated. A seat ahead of
  the pack that moves in the pack's waiver week (exclusive teams) keeps the weeks it had already played (`seen` on the log
  entry). A week a seat hasn't played is still its to change.
- **56: whoever runs the game acts at everyone's episode.** Run now, Open a window and Undo in a game at its own pace with
  exclusive teams take the copy at the episode everyone has reached (`waivers.js handOn`), as a claim always did; an Undo's hold
  is respected by the paced clock.
- **68: its own teams start on When the next one airs.** Own pace stays a choice there, and says what it closes; the join row
  and Game settings say the game's rule in place of "someone closed it" and two buttons that did nothing.
- **69 (found on the way, decided and built the same day): a lineup SET for a week leaves out whoever its seat let go before
  it.** The mirror of 57: a live game saves every seat's next lineup as the episode is made, so a swap before it aired left
  the old starter scoring for a team that no longer held them. Read from the move log (`letGoBefore`), never written: Undo
  brings them back, and someone who hasn't seen the move sees no gap.
- **What the checks turned up on the way** (each recorded where it belongs):
  - The fix to 57 isn't only an own-pace fix: one finished league on the local database changes hands with it. The user said it
    isn't production's, and it isn't (the 2026-10-30 backup: ten leagues, none of them it, and none of their totals move).
    `scripts/dev-test/compare-totals.js` is the gate for any change to how games score: run it on a fresh backup before a push.
  - The wizard's standard games all share their teams, so 56 and 68 are rarer than this plan's step 2 said ("a couch's next
    Outlast with waivers will reach them" was wrong for the wizard's own Outlast).
  - The explorer's lineup check counted a week as played once ANYONE had seen it; at own pace it's per seat now. Two more of its
    checks were out of step, neither a product finding: "can this claim still be made" was asked of the season as it stands
    where the fixed server asks it at everyone's episode; and a captain's twin can't be replayed on a game with a cut or a race
    (a captain's points change who's still in).
- **Checked:** `npm test` (2,158 with 69's); on the real routes `check-waiver-commissioner.js` (every case, both doors, `saved` for 69),
  `check-own-pace-start.js` (with the new exclusive-teams part and its screens at 390), `check-own-pace.js`,
  `check-own-pace-live.js`; a 200-case engine campaign on the commissioner's seed (`.ui-atlas/campaigns/commish-fixed2`: 200
  pass, neither old finding, both failures now if they come back).

## Noticed, not fixed
- (2026-11-14) **A shared-team game at its own pace runs its waivers on the season as it stands, not per person.** A seat that's
  behind and makes a move has it logged at the league's latest episode, so its carried lineups for the weeks in between (which
  it hasn't played) still field someone it let go, if they're still in. Nobody loses points by it; it's the per-person waivers
  the parts list always owed ("drafts + waivers per person"), and BACKLOG 69's stored case is its cousin.
- (2026-11-14) **After an episode has started, whoever runs the game can't close it for people who haven't watched.** The lock
  row is a switch: open to everyone, or back to the pace's rule. With the pace, an aired episode has three states (open to
  everyone / open to whoever hasn't watched / locked for everyone) and the row shows two. Making the game At airtime for a week
  is the workaround. docs/UX-IDEAS.md "The lock row says who it's open for".
- (2026-11-13, step 2; **done 2026-11-14**, "As built: three own-pace bugs") BACKLOG 56 and 57 on the default path, and
  exclusive teams at own pace taking nobody new after the draft (BACKLOG 68).
- (2026-11-13, step 2) A seat created by the settle starts with `seenThrough: start - 1` in the state even when the person is
  further back on the show (the server reads their real mark where it matters: `markFor`, `markRevealed`). "Where the others
  are" (`othersIn`) can read one episode generous for such a seat until its first reveal.
- (2026-11-13, step 2) When an episode's results are late enough that the next one airs first, the late window is on the
  latest aired episode only (as live); the earlier one is closed to a caught-up seat until its results land.
- (2026-11-13, step 2) The explorer doesn't make late moves yet (its lineup, pick and group-slot actions don't take the routes'
  late path), so a caught-up seat's window between airtime and results is covered by unit tests and the new check, not by
  campaigns. Its own-pace timing is otherwise this one (it already re-entered catching up at each result).
- (2026-11-13; done 2026-11-14, "As built: the late lock retired") Three other "late" rules overlapped the game's pace: a game of questions' late lock in hours
  (`extras.lateLock`, A7), the per-episode lock override ("open past its start, on the honour system") and BACKLOG 44 (no
  limit). BACKLOG 64.
- Head to head's ranks still order by the engine's records, which count a waiting matchup as scored with the carried lineup; the
  W–L shown leaves it out. Two seats can look out of order by one result until it's set.
- The hero's matchup line also says "waiting on" (model.ts), but today's game page shows head to head in the grid, not the hero.
- An opponent sees "Waiting on" only once they've revealed that episode themselves (before then it's hidden like any result).
- Someone two or more behind: the window is on the latest aired episode; they reveal the one before first (as anyone does).
- (The desk's seat moves, desk-seat-moves.ts, were listed here by mistake: they link accounts to seats; Act as them uses the
  same routes, so it already follows the window.)
- The Play it card on a finished season offered Start a game and the sheet then refused it (the dead end that started this).
  Part 1 fixes it by making the start work; the Games tab's own Start row already hid itself.
- A pool with lives: once anyone's out for good (`GhostLogic.someoneOut`, bots included, which run ahead of a slower joiner),
  nobody new joins, as in a live game. At your own pace that can shut the door earlier than feels right; a rule for part 3.
- The hub's Where everyone is on the couch's own-pace season reads `ownPace` through the home read's games (GameRef.ownPace):
  built, not looked at in a browser.
- The finish plate's "Start another" from the mock is skipped (the user, 2026-11-05: nothing to point it at yet).

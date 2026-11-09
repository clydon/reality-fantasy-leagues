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

## Noticed, not fixed
- The Play it card on a finished season offered Start a game and the sheet then refused it (the dead end that started this).
  Part 1 fixes it by making the start work; the Games tab's own Start row already hid itself.
- A pool with lives: once anyone's out for good (`GhostLogic.someoneOut`, bots included, which run ahead of a slower joiner),
  nobody new joins, as in a live game. At your own pace that can shut the door earlier than feels right; a rule for part 3.
- The hub's Where everyone is on the couch's own-pace season reads `ownPace` through the home read's games (GameRef.ownPace):
  built, not looked at in a browser.
- The finish plate's "Start another" from the mock is skipped (the user, 2026-11-05: nothing to point it at yet).

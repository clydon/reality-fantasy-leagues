# Plan: the Start-a-game GPT, on games as data

Status: **planned 2026-10-27; hardened 2026-10-28** with the user: the engine first, built to everything in "Where the engine
is headed", then today's games recreated on it, then the UI last; the GPT's words grow alongside the engine. **S1 (2026-10-27)
and S2 (both parts, 2026-10-28) are built and merged into master** (their As built is under track S); the test couch plays
them next (the user's, in production). A1–A4 are built on `engine` (A4 in two parts: the engine and storage, then the Prediction Sheet's screens, built before
the screens moved to U1), not yet merged: the main folder merges them (review, checks, the Neon rehearsal, the user's OK).
A5 and A6 built on `engine` (2026-10-28: the tracker and the engine lab; questions about who and about each); A7 next, then A8. **Waiting on the user (A2):** the game-specs flag in production (a Neon branch check from
your terminal, then on), after the merge. The live-sports plan is
folded in as track L (2026-10-28): one engine and one plan for shows and sports. Each step is its own session (Opus 5.5 at
xhigh). Siblings: `docs/PLAN-sports-live.md` (on the `sports` branch: folded in here as track L; its file keeps the details)
and `docs/PLAN-researched-survivor.md` (Survivor's switch, now mid-season: track S here).

## What the user asked for (2026-10-27)

- **A Start-a-game GPT.** Someone types the game they want into one field. The app sends part of it to our ChatGPT bot with
  the data structure we want back; the bot fills in as much of the game as it can, then a wizard asks what they didn't say.
- **The examples** (the test fixtures):
  1. "I want to set up a fantasy league for Survivor 51." Then the wizard asks what wasn't said (how many get drafted?).
  2. "For this upcoming Red Sox–Yankees series I want a draft where we draft 3 players each. We'll score 5 points for every
     home run and 1 point for each total base."
  3. "I want to make a game for the 76ers home opener. I want us all to predict 3 things: winner, top scorer, and over/under
     total points."
- **Goals:** the possibilities for making a game should feel endless; far fewer taps to make one; a basic game fast, a
  customised one can take more.
- **Groundwork first:** time spans, a data structure that becomes a game, the wizard.
- **No built-in game rules** (said before, restated): the app, its data and its engine all come from structure. Survivor 51
  breaks that today. A data-driven engine is sturdier and more customisable, and it's what makes "GPT to league" work.
- **Impeccable** for every screen.

## Decisions (the user's answers, 2026-10-27)

| Question | Decision |
|---|---|
| What reads what someone types | **Always our ChatGPT bot** (llm-browser-api), every ask. No instant matcher, no paid API. |
| The bot's queue | **The GPT's asks go first:** they wait only for the question the bot is already answering, never for jobs queued behind it. A VM change, approved in principle; deployed with the user's OK when it's built. |
| Who settles a rule | **Only what data can settle.** Sports: box scores and scoreboards. Shows: the show's results research, which counts as data. A moment research already answers scores at once; a new one becomes a question research asks after each episode **only if research rates it reliable**, otherwise the GPT offers the closest moment we have. Never the couch's word or the game maker's call (bingo's honour system and couch-answered moments stay as they are; the GPT just doesn't make rules like them). |
| Survivor 51 | **Off built-in rules mid-season, once proven:** the test couch plays the new rules for two episodes, every table matching at today's points, then the three real games switch and Survivor's code is deleted. (Was: at Survivor 52.) |
| Order (2026-10-27, revised below) | **The engine first, the GPT right after it** (shows and today's games), **then the sports branch**; the GPT learns the sports formats when the branch merges. |
| The wizard | **A healthy balance:** people always see what they're making, in plain words; details they don't care about stay out of sight (recommended, changeable later, never asked). |
| Order, revised (2026-10-28) | **The engine first, to its full target** (every dial in "Where the engine is headed"), **then today's games recreated on it, then the UI, last**: "the finalized UI will certainly be dumbed down while the backend remains ultra powerful". The GPT's words (G1) grow alongside the engine. The sports branch keeps its own lane. |
| Where the GPT starts (2026-10-28) | **On a show's page**, the show and season known. The bot drafts the spec from a context pack and the engine's manual; our check decides. |
| Progress (2026-10-28) | **Living tables:** the dials and the stretch requests, each row's status generated from the engine itself (A5), so the user sees what's possible as the engine grows. |
| Live sports (2026-10-28) | **Folded into this plan** ("Live sports in the same engine"): one engine for shows and sports. The difference is when results arrive: a sport's live, play by play, a show's after the episode. The sports plan's own decisions stand. |
| Mechanics the players decide (2026-10-28) | **Allowed** (the user's hunch, Claude's call): votes among the players, matching the majority, the top scorer's twist, a rotating host, secret roles, bounties. Guardrails: facts about the show are still settled only by data (a host's questions must be data-settled; the couch never decides what happened); answers that depend on each other stay hidden until the lock; a player-decided outcome changes the game only, never someone's place on the couch. |
| Numbers from outside research (2026-10-28) | **Allowed from vetted sources** (the user's hunch, Claude's call): free, with terms that allow it (TVmaze's episode ratings, ESPN's stats), settled once at a fixed moment (a rating seven days after airing) and stored, because outside numbers drift. A new source goes into HOSTING.md first. |
| The engine lab (2026-10-28) | **Yes**, in A5: an admin-only, plain page on the desk for trying the engine's pieces before the UI exists. |

## What's there today (mapped 2026-10-27)

**Already data:** a show's moments and their points (per ownership), counts scored per unit (`per`, `units`), phase gating,
and a game's end (`settings.endEpisode`, `src/lib/game/spans.ts`).

**Still code, or missing:**
- **Five hard-coded game types** (`state-logic.js` `LEAGUE_TYPES`, 1232-1312): `classic-draft` (Outlast), `active-roster`
  (Weekly Lineup), `pickem` (Survival Pool), `weekly-calls`, `weekly-bingo`. Each fixes what you hold, what counts and how it
  scores (Outlast's score is the boot order, Weekly Lineup's starters score moments, a Survival Pool pick survives). The ids
  are compared as literals in 45 files (197 times), and their flags (`hasRoster`, `hasActiveRoster`, `hasWeeklyPicks`, ...)
  are read across the UI.
- **Settings have no schema.** `types.ts` (223-352) calls itself "best-effort"; `RosterLogic.updateSettings` stores whatever
  it's sent (state-logic 1847); classic's PATCH doesn't validate; the new design's Game settings takes six fields
  (`backstage-games.ts` 548); some fields are written straight in.
- **No real predictions.** Side bets are free text the commissioner grades (1–3 points, no lock; `BetLogic`, 3190-3259),
  finale predictions are a fixed top 3 and winner, and Weekly Calls are two generated questions an episode. Nothing asks
  "pick a team", "the most of a stat" or an over/under.
- **Spans** start at the next episode to air (or the one on now) and end at any later listed one. Nothing starts later, and
  nothing is a date or a condition (post-merge).
- **Sports** (`src/lib/server/sports/`): a sport's games exist only as a TV listing's episodes (`season_events` needs a
  `season_episodes` row), linked to ESPN up to 8 days ahead. The adapter reads scoreboards, rosters and box scores, but not
  team schedules, odds or plays. Box scores (`game_lines`) only fill the Players tab: **sports games score from ChatGPT
  research** of rulebook moments (the World Series library rulebook has `homeRun` at 5). Final scores and winners aren't
  stored. ESPN's box score has no per-player total bases (team totals only, checked 2026-10-27), but its plays do.
- **Survivor 51** plays a rulebook frozen from `survivor.js` (`compiled_source 'legacy'`, `reader 'survivor'`). 26 of its 27
  rules are data, but its research checks (5 per person, 4 per episode), notes and sentences are functions. The blocks can't
  express a few of its conditions: zero votes and safe needs no tribe immunity; reward is either of two answers; chosen for
  reward leaves out the winners; votes negated needs an advantage played; runner-up and third come from a place; exile. Shared
  code names Survivor (`bot-logic.js` 85-112, `research-rows.tsx` 89, `episode-editor.tsx` 31, `db/episode-research.js` 1133
  and 252/267, stored answers matched by `provenance.format`). Survivor 52 would get another frozen rulebook
  (`ensureSeasonRulebook` mirrors `shows.format`). The real lock-in is ids: every stored result uses Survivor's event ids,
  exit names and question keys, so the switch keeps the ids and drops the code.
- **Starting a game** (`src/new/couch/start-game.tsx`, `src/lib/server/start-game.ts`): 2–3 taps from the hub; it asks which
  game, How long, computer players, Include it and Tell the couch; everything else is a default. Nothing turns free text into a
  show, season or team.
- **The bot** (`src/lib/server/ask-bot.ts`): free, one question at a time per provider (a plain `queue.Queue` in
  llm-browser-api's `server.py` `Worker`); a short question takes about 20 s while Chrome is open, research 2–4 minutes; it can
  stream progress. Answers are pulled out of chatter and repaired (`parseRulebookAnswer`, `reviewRulebook`, Make it a game's
  `salvage`).

## How it fits together

```
page + words ──(bot + the engine's manual)──▶ a draft game ──(our check)──▶ game spec ──(wizard)──▶ Start ──▶ a league
the show, season, cast,      a spec, each part marked said,   the validator decides;    what they're making;
its rulebook, the couch      assumed, to ask or can't yet     ids, numbers, defaults    assumptions as chips
```

- **Started from a page** (the user, 2026-10-28). The GPT is always opened on a show's page (later a sport's or a team's), so
  the show and season are known, never looked for. The words only say what game.
- **The more the bot is told, the better the game.** It gets everything the app knows about the page (the context pack) and
  the engine's manual, generated from the spec's vocabulary, and drafts the game as a spec. Each part of the draft is marked
  **said** (their words quoted), **assumed** (with why), **ask** (a question for the wizard) or **can't yet**.
- **The bot drafts; our code decides.** The draft is never trusted. The validator decides what's a game. Ids must come from the
  pack, a number only from their words, and defaults are ours. Whatever doesn't hold becomes a question or a can't-yet, never a
  silent fix. So the same words make the same game, and the bot's mistakes become questions, not games.
- **The spec is the game.** It lives in the league's state as `settings.game`; the engine scores from it, the wizard's sentence
  and How it works are read from it, Backstage edits it, and Start a game's taps build one too. A preset (Outlast, Weekly
  Lineup, ...) is a spec with defaults.
- **The taps stay** (Product principle 2, free stays complete): every game the GPT makes can be made without it, and the bot
  being down never blocks a game.

## The game spec (the data structure that becomes a game)

One schema for shows and sports, with room for every format both plans name, so nothing needs a redesign later. It says what a
game *is*. What can happen on the show (the rulebook) or in the sport (the Sport classes in `PLAN-sports-live.md`) it only
refers to. A draft; A1 settled it (`src/lib/game/game-spec/index.d.ts` has the schema; A1's As built, under track A, what
changed):

```jsonc
{
  "spec": 1,
  "preset": "weekly-lineup",               // the preset it started from, if any (its name, Run it back)
  "span":  { "from": 7, "to": null },      // episodes of the season; to null = the season's end
                                            //   A3: "from": { "phase": "merge" } waits for that phase
  "pool":  { "of": "cast", "where": null }, // who can be picked; where: { "teams": [...] } | { "stillIn": true } | { "group": id }
  "get":   { "by": "draft", "each": 5, "order": "blind", "own": "shared" },
                                            //   by: draft (order snake | blind; own exclusive | shared)
                                            //     | pick (one an episode, "repeat": "cycle") | card (bingo) | none
                                            //   sports: squares, ...
  "count": { "start": 3 },                 // what of yours counts each episode: { start: n } (your lineup) | { all: true }
                                            //   | { pick: true }; sports: { best: n } (best ball)
  "score": { "by": "moments", "points": null },
                                            //   moments (the rulebook's ids; null = its own points) | place (Outlast)
                                            //   | survive (Survival Pool) | answers | calls | lines (bingo)
                                            //   sports: stats ({ "HR": 5 }, the Sport's keys)
  "rank":  { "by": "total" },               // total | streak; sports: matchups (head-to-head) | categories | roto
  "ask":   [],                              // A4: questions answered before the lock, each settled by data
  "closes": "start",                       // moves lock at each episode's start (today's airtime lock); sports: daily | weekly
  "extras": { "waivers": {}, "bets": true, "finale": {}, "draft": { "at": null, "timer": 0, "away": "wait" }, "join": "open" }
}
```

A question in `ask` says what's answered and how data settles it:

```jsonc
{ "id": "top", "ask": "Who scores the most points?", "answer": "person", "points": 1,
  "settle": { "by": "stat", "stat": "PTS", "take": "most" } }
// answer: person | side | yesNo | number (closest wins) | overUnder (with "line") | choice (with "options")
// settle, shows (A4): { by: "results", take: "winner" | "out" | "placed" } | { by: "moment", moment: id, take: "happened" | "count" }
// settle, sports (the branch): { by: "final", take: "winner" | "total" | "margin" } | { by: "stat", stat, take: "most" | "least" | "value" }
```

**Today's five as presets** (A1 proves each one round-trips): Outlast = draft, all count, place, total. Weekly Lineup = draft,
start n, moments, total. Survival Pool = pick, the pick counts, survive, streak. Weekly Calls = generated questions, calls.
Weekly Bingo = a card, lines. In A4, finale predictions and Weekly Calls become `ask` presets.

**The three examples as specs** (fixtures in A1; end to end in U1 and G3):

```jsonc
// 1. "a fantasy league for Survivor 51": the wizard asked which game (Weekly Lineup, recommended); the rest is the preset's
{ "spec": 1, "preset": "weekly-lineup", "span": { "from": 7, "to": null },
  "pool": { "of": "cast", "where": { "stillIn": true } },
  "get": { "by": "draft", "each": 5, "order": "blind", "own": "shared" }, "count": { "start": 3 },
  "score": { "by": "moments", "points": null }, "rank": { "by": "total" }, "closes": "start" }

// 2. "the upcoming Red Sox–Yankees series, draft 3 each, 5 per home run, 1 per total base"
{ "spec": 1, "span": { "from": 1, "to": 3 },           // the series' games, as a season of their own (the sports branch)
  "pool": { "of": "cast", "where": { "teams": ["<BOS>", "<NYY>"] } },
  "get": { "by": "draft", "each": 3, "order": "snake", "own": "exclusive" }, "count": { "all": true },
  "score": { "by": "stats", "points": { "HR": 5, "TB": 1 } }, "rank": { "by": "total" }, "closes": "start" }

// 3. "the 76ers home opener: predict the winner, top scorer and over/under total points"
{ "spec": 1, "span": { "from": 1, "to": 1 }, "pool": { "of": "cast", "where": { "teams": ["<PHI>", "<opponent>"] } },
  "get": { "by": "none" }, "score": { "by": "answers" }, "rank": { "by": "total" }, "closes": "start",
  "ask": [
    { "id": "winner", "ask": "Who wins?", "answer": "side", "points": 1,
      "settle": { "by": "final", "take": "winner" } },
    { "id": "top", "ask": "Who scores the most points?", "answer": "person", "points": 1,
      "settle": { "by": "stat", "stat": "PTS", "take": "most" } },
    { "id": "total", "ask": "Total points: over or under?", "answer": "overUnder", "line": null,
      "points": 1, "settle": { "by": "final", "take": "total" } } ] }
// line null: ESPN's line when its scoreboard lists one (e.g. 237.5 for Sixers at Pacers, Oct 28), else the wizard asks
```

**The data-can-settle rule, in code:** the validator refuses a spec with a scoring item or question nothing settles. A moment
must be one research answers (`answeredBy: research`), a stat must be one of the sport's keys, and every question needs a
`settle` our data can do.

## The ask (what the bot is given, and what it answers)

Redesigned 2026-10-28 with the user: the GPT starts from a show's page, so the bot can draft the game itself. It gets four
things.

1. **The context pack**, everything the app knows about the page:
   - the show and season, its status, today's date, the episodes so far and the next one (number, when), its phases (the
     merge);
   - the cast: who's still in and who's gone (and how), and their groups as of now (tribes, couples, crews);
   - the rulebook: every moment research answers (its id, its words, its points and per what), the numbers research records per
     person per episode (Dancing with the Stars' `judgesScore`), its exits and phases;
   - the couch: how many people (it sizes a draft) and the games already on it ("like last season's").
2. **The engine's manual**, generated from the spec's `VOCAB`, never written by hand. It covers only what plays now (on a sports
   page, the sport's too), each part in plain words, with the presets and the worked examples below as examples, including ones
   it can't do yet. When a step lands, the manual grows with it.
3. **The person's words**, marked as a description of a game, never instructions.
4. **What to answer:**

```jsonc
{ "draft": 1,
  "game":    { /* a spec: only the manual's parts, every id from the pack */ },
  "said":    [{ "part": "ask[0]", "quote": "who goes home" }],                 // each part their words made, quoted
  "assumed": [{ "part": "ask[0].points", "value": 1, "why": "no points named" }],
  "ask":     [{ "part": "span", "question": "Just tonight's episode, or the rest of the season?",
                "options": ["Tonight's episode", "The rest of the season"] }],
  "cantYet": [{ "what": "which tribe wins immunity", "why": "a question can't name who a moment happened to yet",
                "nearest": null }],
  "summary": "A game of calls for Survivor 51: before each episode, everyone says who goes home. 1 point a right call." }
```

- **No web search.** The pack holds what it needs, so the ask is short: about 10–20 s on signed-in ChatGPT's GPT-6 Instant
  (2026-10-28; Survivor 51 episode 5's full research took 105 s there, with search).
- **Never a number they didn't say.** One it chose is listed under `assumed`.
- **Only the pack's moments, people and numbers score.** The user's rule: only what data can settle.
- **Two games in one request** ("a survivor draft and also a traitors pool"): the first is drafted, the second offered after.

## Our check (the draft to a spec)

- **The validator decides** (`specProblems`, `specWaitsFor`). A part it refuses becomes a question (with the nearest valid
  choice) or a can't-yet. Nothing is fixed silently.
- **Ids from the pack.** A moment, person or group that isn't in it (a typo, last season's castaway) becomes a question.
- **Numbers as said.** Each number in the spec is in a `said` quote or listed in `assumed`. Anything else is dropped and asked.
- **A moment the show doesn't have** ("predict if it's going to rain" on Survivor) is never made up and never left to the couch
  to judge. A second, short ask rates whether research can answer it reliably from recaps and wikis. If it can, it's offered as
  a new research question for the season ("Add 'It rained' as a question research answers each episode?"), and the game asks
  yes or no from the next episode (a moment settles a yes-or-no question: A4). If not, it's a can't-yet, with the nearest things
  that are settled ("Will anyone be medically evacuated?", "Will an idol be played?").
- **Defaults are ours:** the preset's, plus what fits the couch and the pool (the draft size cut to who's left).
- **What's left to ask:** the draft's questions and the required parts it left empty. Everything else goes into the wizard's
  sentence, with each assumption a chip that can be changed.
- **Changes:** a typed change ("make it 3 each") goes back to the bot with the current spec and the change. A tap changes the
  spec directly, without the bot.
- **Another show than the page's** becomes a question ("Make this for The Traitors instead?"). A show that isn't set up
  chains Make it a game first (the bot, 2–4 minutes). Sports pages: teams and games from ESPN (the sports branch).

## Requests from a show's page (worked examples, 2026-10-28)

The user's examples, as people would type them on a show's page. They go into the manual's examples and the test set (G1).

| On the page of | They type | Today's engine (A1–A4) | Needs |
|---|---|---|---|
| any show | "bingo cards and trivia every episode, bingo lines are worth 5 points, correct trivia questions earn one point" | No | A13 (trivia questions), A9 (points per bingo line), A12 (a game that scores two ways) |
| Red Sox–Yankees series | "a homer draft: everyone picks 3 players they think gets a home run" | The shape: a shared draft, 3 each, scored by stats | The sports branch (`score.by: stats`, rosters, a series span) |
| Survivor 51 | "each week you must correctly predict the tribe winner and who goes home" | Who goes home, each episode (A4) | A6: which tribe wins immunity (who a moment happened to) |
| Survivor 51 | "a single episode game where we must predict different things, most correct wins" | Yes: one episode (A3), a game of questions (A4): who goes home, yes or no, how many | A6 for "who wins immunity" questions |
| Dancing with the Stars 34 | "everyone predicts the scores of each couple; whoever's closest to the average gets a point; ties both get points" | Closest wins and ties all score (A4's number answer) | A6: a question for each couple, settled by research's `judgesScore`. The wizard asks: this episode or the season? The judges' total or their average? |
| Survivor 51 | "every week we predict if it's going to rain" | A yes-or-no question each episode, once a moment settles it (A4) | No rain moment: the new-moment path (Our check). Likely rated unreliable, so a can't-yet with the nearest settled questions |

What these need is in the engine track (Steps: A6, A9, A12, A13).

## Where the engine is headed: the dials (a stress test, 2026-10-28)

The user asked to look past today's app and past fantasy leagues ("we have to not think thru the lens of our app ... so we can
stress test what we aspire the engine to be able to create"). Every watch-along game is a setting on nine dials (the ninth,
live, added the same day: games played while watching together, on TV now or later in sync). The middle
column is what the engine plays after A4; the right one is where it's headed. The engine track (A5–A14 in Steps) builds toward
it, and A5's tracker keeps this table and the requests below live (`docs/ENGINE-CAPABILITIES.md`), so the user can watch what's
possible grow.

| Dial | After A4 | Where it's headed |
|---|---|---|
| When you act | before each episode, or once (locks at the start or the finale) | every 2 episodes; per phase; rolling windows ("within the next 3"); live, mid-episode; your own lock time when you watch late |
| What you predict | who goes home, the winner or top N, did X happen, how many | which tribe or couple; an order; which episode something happens in; who said the title quote; a vote split (5-2-1) |
| How you answer | pick, yes or no, number, over/under, choice | rank, spread 10 chips, wager points, bid, trade, vote, a random draw |
| What settles it | results, moments, the show's calls | the group's own answers (majority, minority); the bot's own call as an opponent; phases; episode facts; outside numbers |
| Scoring | fixed points, closest wins, streaks, draft totals | split the pot (rarer right calls win more), the only right answer, jackpots that roll over, multipliers, double or nothing, points that shrink with time |
| How you win | highest total, longest streak, last one standing | first to 20 ends it, co-op against the show, head-to-head with playoffs, beat the bot, players knocked out |
| Who plays with whom | everyone against everyone | teams, co-op, secret roles among the players, a rotating host, handicaps, late joiners |
| Shape over time | one game, one set of rules, one span | stages (a second draft at the merge), rules per phase, a season of mini-games, carry-over between seasons and shows |
| Live (watching together, live or later in sync) | nothing inside an episode: a game moves an episode at a time and locks at airtime | the episode's own clock (the watch along's runtime): questions that open and close at a point in it (the halfway mark, the last 10 minutes, before an ad break), a call pinned to when you made it (earlier is worth more), your own clock when you watch later (spoiler-safe, biased late), the couch's live answers replayed as a ghost to play against; sports: a call on every play, settled by ESPN's timestamped plays (this at-bat, the next drive) |

**Requests that push the dials**, typed on a show's page. They join G1's test set as stretch cases: until the engine grows,
the GPT should answer most of them with a clear can't-yet and the nearest game it can make.

- *From fantasy leagues and pools:*
  - "Guillotine: everyone drafts 4, the lowest scorer each week is out and their castaways go back in the pool."
  - "Points every week, but at the merge the bottom half of us is cut."
  - "Auction draft: everyone gets $100 to bid on castaways." "Salary cap: couples cost more the better they're doing."
  - "Everyone drafts one castaway from each tribe." "Draft a guy and a girl each, and they score together."
  - "Reverse draft: the earlier your castaways go home, the more you score."
  - "Captain each week: one of your castaways scores double." "Best ball: draft 5, your best 3 count, no lineups."
  - "A pool with 2 lives and one buyback before the merge." "On double-boot nights you pick two."
  - "Confidence picks: rank everyone from most to least likely to go home; you score your confidence on whoever goes."
  - "Draft the boot order before the premiere; points for every boot within 2 spots." "Predict the leaderboard each week."
  - "Parlay: who goes home AND who wins immunity, triple if both." "Bounties: if your castaway votes out mine, you steal 2."
  - "Dynasty: keep 2 of your players when they come back next season" (The Challenge). "My partner and I share one team."
  - "Newcomers get 5 bonus points a week." "One league across Survivor and The Traitors." "A kids' version, no points shown."
  - "Stock market: buy and sell castaways each week." "One mulligan a season."
  - "Two of us are secretly traitors who score when the faithful's picks get banished" (The Traitors).
- *Beyond fantasy:*
  - "Every two episodes, name someone who'll be gone by then." "Within the next 3 episodes, will there be a blindside?"
  - "Guess which episode the merge happens in." "Each episode, guess who says the episode's title quote."
  - "10 points an episode, split between everyone who called the boot." "You only score if you're the only one who called it."
  - "Guess what most of us will pick; you score if you match the majority." "If nobody calls it, the points roll over."
  - "Spread 10 chips on who wins immunity." "Bet any of your points on your call, double or nothing."
  - "Beat the bot: the AI makes its call too; you score when you're right and it's wrong." "First to 20 points wins."
  - "Co-op: together we have 5 lives; every faithful banished we didn't see coming costs one" (The Traitors).
  - "Names out of a hat: everyone gets a random castaway; last one standing wins."
  - "Pre-merge and post-merge are separate games with their own drafts, plus an overall winner."
  - "Each week's top scorer picks a twist for next week" (Big Brother). "My brother watches a day late: let him lock later."
  - "Predict each episode's IMDb rating" (Dancing with the Stars). "Each week a different one of us writes 3 questions."
  - "Seal a winner pick before the premiere; every change costs a point." "A season of mini-games: bingo one week, a draft the
    next." "For 10 random pairs, who outlasts whom?" "Predict the final tribal vote split." "Guess every elimination winner;
    a wrong guess knocks you out" (The Challenge).
- *Live, with the watch along* (on TV now, or later in sync with the episode's runtime):
  - "At the halfway mark everyone calls who goes home; it locks at minute 30 of the episode."
  - "Lock in your boot call any time during the episode; the earlier you call it, the more it's worth."
  - "With 10 minutes left you get one chance to change your call, for half points."
  - "Before each ad break, call what happens after it" (live on TV: the watch along's ad-break taps).
  - "Bet your points on the immunity challenge before it starts; the pot splits between everyone who called it" (Twitch's
    predictions: a pool, a window of 1 to 30 minutes).
  - "Quiz cards pop up as we watch; answer each before the next one."
  - "Bingo by segment: the first line in each segment wins it."
  - "My sister watched live, we're watching Thursday: we play against her answers as we reach them" (a ghost).
  - "Only the people watching together right now can play; everyone later just sees how it went."
  - "Score each dance 1–10 as you watch; closest to the judges wins" (Dancing with the Stars: a lock inside the episode that
    data can't place, since nothing records when each dance airs).
  - Sports: "Every at-bat: hit or out?" (YES Network's Pick-N-Play). "Next drive: touchdown, field goal or punt?"
    (Simplebet's Playbook). "Predict the minute of the first goal." "Our fantasy players' points tick live, head to head."
    "Replay last night's game in sync and play its live calls as if it were on" (ESPN's timestamped plays).

**The pieces.** To make most of these, presets give way to pieces that combine. A4's question is the seed: what's asked,
when, what settles it, how it scores, how you win.
- Time: windows instead of only "each episode" or "once": every N episodes, within N, by phase, a person's own lock.
- Answers: ranks, chip spreads, wagers, an episode number, a quote's speaker, a vote split.
- Settles: the group's own answers, the bot's own call, phases, episode facts. Outside numbers later, if ever.
- Scoring that combines: split the pot, the only right answer, roll over, multiply, shrink with time, wager.
- Winning and groups: a race, co-op, head-to-head, teams, players knocked out.
- Stages: a game made of phases or mini-games, each with its own rules.
- Live: a clock inside the episode, shared with the watch along (shows: the runtime; sports: the plays). Questions open and
  close on it, each viewer's own clock decides their lock and what they're shown, answers carry the moment they were made, and
  standings can be worked out at anyone's moment (`stateAt(t)`, as the sports plan does it).

**In what order:** the engine track in Steps (A5–A14): the tracker first, then what most pieces stand on (who and each, time,
answers), then scoring, pools and drafts, winning and groups, stages, trivia, and last the players' own mechanics (allowed, with
guardrails: below).

**Decided 2026-10-28** (Decisions, above): mechanics the players decide are allowed, with guardrails; numbers from outside
research are allowed from vetted sources, settled once at a fixed moment. A14 is planned, no longer waiting.

## Live sports in the same engine (folded in 2026-10-28)

The live-sports plan (`docs/PLAN-sports-live.md`, on the `sports` branch) is folded in here: one engine for shows and sports,
one plan. Its file stays on the branch for the details (ESPN's shapes per sport, the screens list).

**The difference is when results arrive** (the user): a show's come after the episode, from research; a sport's come live, play
by play. So the engine's model is that **every fact has a time it became known**:
- a show's facts are known when research is accepted, after the episode; a sport's when the play happens (ESPN's `wallclock`),
  and for good when the game is final;
- every game, standing and question is worked out **as of a moment** (`stateAt(t)`): now for someone watching live, their
  synced clock for someone watching later, the end for everyone else;
- live is provisional and the final is the truth: a sport's live points are worked out on the phone, and the final box score is
  saved once, as today, for standings, trophies and anyone who never watched live.

So every piece in "Where the engine is headed" works for both, settling as its facts arrive. "Top scorer" shows a running
leader all game. A guillotine league on the NFL knocks someone out on Monday night as the last game ends. A captain's double
points tick live. A split pot on "next drive" pays out when the drive ends.

**What sports adds to the dials:**

| Dial | Sports |
|---|---|
| When you act | lineups daily (NBA, NHL, MLB), weekly (NFL, college football) or per event (golf, racing, fights); live calls during the game |
| What you predict | the winner, the margin, the total, a player's stat, the next play, the next scorer |
| How you answer | a side; a squares grid; a bracket |
| What settles it | the final (winner, total, margin), a player's stats (most, least, value), plays as they happen |
| Scoring | points per stat key (`{ "HR": 5, "TB": 1 }`), from the sport's standard table, editable |
| How you win | head-to-head matchups, categories, roto, best ball |
| Live | every play timestamped for the team sports; by round, session or bout for golf, racing, MMA and tennis |

**The sports plan's decisions** (the user's, 2026-10-27), unchanged:
- live by default; a later watch syncs both ways (start when you press play, pause, ±30 s; or tap the last play you saw);
- everything ESPN offers (boxing, esports and horse racing aren't in its API: left out, in the backlog);
- formats: head-to-head, best ball, pick'em each game, categories and roto, squares, brackets, pick a few, live calls, plus
  Weekly Lineup and Survival Pool;
- scoring built in per sport (a standard table, like Yahoo's), editable by the commissioner; lineup locks per sport, like Yahoo;
- built in per sport is fine for a sport's vocabulary, with good OOP so each sport is easy to test and change (shows stay
  universal).

**What ESPN gives** (checked 2026-10-27):
- **The team sports** (NFL, college football, MLB, NBA, WNBA, college basketball, NHL; soccer's key events): a live box score and
  every play with its time, so live and a later replay are exact.
- **Golf** (by round), **F1, NASCAR, IndyCar** (by session), **UFC and MMA, tennis** (by bout): no per-play times.
- **Boxing, esports, horse racing:** not in ESPN's API.
- Also **team schedules** (games straight from ESPN, not only a TV listing's), **odds** (the over/under's default line) and
  **finals** (to store).

**How live stays free:** phones poll ESPN themselves (every ~15 s; ESPN caches it) and work out live points on the phone, so
nothing reaches our server or Neon while a game is live. The final is saved once. A later watch fetches the finished game once
and replays it on the phone. If ESPN ever stops answering browsers, one Vercel route forwards it with a 15 s CDN cache.

**Built in vs data:** a sport's vocabulary and readers are code: `Sport` and its subclasses (positions, stat keys, periods,
ESPN's box score and plays read into `Play`s), `Sport.reduce(plays)` for the box score at any moment, and `GameClock` (live,
synced, snapped), which is A15's clock too. Everything a game is stays a spec: the formats are the engine's pieces, not sports
classes, and a sport's defaults are default specs, stored as data.

**More stretch requests, sports:**
- "Guillotine NFL league: the lowest score each week is out, decided live on Monday night."
- "Captain each night: one of your NBA players scores double." "Best ball for the World Series: your best 3 hitters count."
- "Super Bowl squares, paid out each quarter." "March Madness bracket with a bonus for every upset."
- "NFL pick'em with confidence points." "NBA head-to-head by categories this week."
- "Predict the exact final score; closest wins." "Next goal scorer, called during the match."
- "Buy and sell players during the game; prices move with their live stats."
- "Our couch needs 10 right live calls this game to win together." "First to 20 points during the game wins."
- "Over/under on total runs, locked at first pitch, settled live."

**Track L: live sports** (the Sports lane, `sports` branch; the sports plan's steps, renumbered). A piece is built once, in the
engine track; L brings each sport's data to it. Its screens wait for the UI track.
- **L1. The framework, no UI.** `Sport` and the big four (football, baseball, basketball, hockey), their ESPN readers and
  reducers (the reduced box score at the end equals ESPN's own), games straight from ESPN's schedule, finals and odds stored,
  fixtures and tests (the user's two examples among them). The sports parts of the spec (`score.by: stats`, the sports
  settles, the default specs) once master has A2.
- **L2. The live clock.** The phone's poller and `GameClock` (live, synced, snapped), shared with A15; fake-espn replaying a
  recorded game in real time or 60x; HOSTING.md.
- **L3. Live scoring through the spec.** Points per stat from box scores and plays (`score.by: stats`), live on the phone and
  saved once when final, replacing today's ChatGPT research of sports moments.
- **L4. The formats, as the engine's pieces with sports data:** head-to-head, categories and roto (A11), best ball (A9),
  pick'em and pick a few (A4's questions with the sports settles), brackets (A8), squares (a sports way to `get`), live calls
  (A15); lineup locks per sport.
- **L5. More of ESPN:** soccer; college and the WNBA; golf, racing, MMA and tennis (the field and bout shapes).
- **L6. Release:** `sports` merges into master at once (migrations checked against a production backup first), then G3
  teaches the GPT these formats.
- Its screens (the scorebug, the live box score, the couch's play feed, players organised, the matchup, sync, each format's
  own) are in U0 and U1.

**Open, from the sports plan:** head-to-head's schedule over a span, and playoffs; whether a sport's moves follow Weekly
Lineup's waivers or need their own rhythm for daily sports; what a live call is worth, and how fast they open and close;
tennis's draw, and how a bracket reads ESPN's. **Noticed:** golf, racing, MMA and tennis can sync a later watch only by round,
session or bout.

## The wizard (U0 designs it, last, with impeccable)

- **Simple on top, powerful underneath** (the user, 2026-10-28): the finished UI stays plain (a sentence, chips for what was
  assumed, the few questions left), while the engine underneath can make everything in "Where the engine is headed". A piece
  doesn't get a control of its own: it's reached by words, through the GPT ("make it every two episodes"), and Backstage shows
  the game in plain words.
- **The game in a sentence or two** at the top: "A Weekly Lineup for Survivor 51: everyone drafts 5 and starts 3 each episode,
  Episode 7 to the finale. Scored by Survivor 51's rules." What they said reads as theirs and what we chose reads as ours, so
  nothing is assumed silently.
- **Questions only for the unknowns**, the recommended answer first. A basic game is one tap to start.
- **The details nobody asked about** (draft order, timer, who can join, waivers, ties) are recommended and out of sight, in
  Backstage › Game settings later, as today.
- **Start** works as today's does (on the couch, linked to its other games, Tell the couch), from the spec.
- **For U0 to design:** where the field lives (my recommendation: every Start a game entry opens it, the show filled in when
  opened from one, today's taps under it); the bot's half-minute wait (what it shows, leaving and coming back); ideas under the
  field from what's on (the guide's shows and games, so "endless" shows before anyone types); the errors (bot away, show not set
  up, a past game, can't count that); How it works for a game someone typed. Walk it through the archetypes
  (`docs/ARCHETYPES.md`): the Tinkerer's custom game, the Drive-By's quick one, the Late Recruit reading a game someone typed.

## Steps (each its own session, Opus 5.5 at xhigh)

**S. Survivor off built-ins** (master). This is time-bound: the proof needs two airing episodes of Survivor 51. The details are
in `PLAN-researched-survivor.md`'s "What the switch needs", with this plan's decision.
- **S1. Blocks say everything Survivor's code half does.** The conditions the blocks can't express (above) and exile, as block
  fields; a question map beside the event and exit maps, so stored answers keep reading. Survivor's blocks, compiled with no
  base and the generic reader, give the same events, questions and rules as `survivor.js` (the golden test, now without
  `base`).
- **S2. Checks as data, and no shared code naming Survivor.**
  - The 9 checks become conditions over checklist answers (report or repair) in the rulebook, run by research for any show.
  - Notes and sentences come from each question's own words.
  - The computer players' signals and research's safety list become moment tags.
  - Finalist exits come from `waysOut.means`, `tribalGroupProblems` reads the vote's own key, and `notableTwist` is generic.
  - Stored answers are matched by rulebook, not by format id.
  - `ensureSeasonRulebook` never freezes a built-in again.
  - Maker scoring's event-id vs moment-id mismatch is fixed.
  - Then the test couch plays it.
  - **Split in two (2026-10-28):** part 1, checks and notes (the first two bullets, plus the research reader's own Survivor
    names: `tribalGroupProblems`' key, `notableTwist`, and the episode editor's finalist exits); part 2, the shared-code
    clean-up (moment tags, stored answers by rulebook, `ensureSeasonRulebook`, maker scoring).
- **S3. The switch.** After two episodes with every table matching at today's points, the three real games move onto the data
  rules (with the user's OK). Then `survivor.js`'s code half, `BUILT_IN_READERS` and legacy freezing go, and Traitors' and the
  Challenge's built-ins with them once nothing plays them.

**S1 as built (2026-10-27, `survivor-data`, not merged; no migration).** Survivor's blocks, compiled with no base and the generic
reader (`compileRulebook(blocks, { aliases, reader: 'research' })`), now give `survivor.js`'s events, questions and rules.
- **The refinements** (`rulebook-schema.js`; each optional, and leaving one out is what the blocks always did):
  - a segment's `groupWin: 'won'`: a group's win counts as winning it, so one moment scores on either answer and both are asked
    (Survivor's reward);
  - `places: 'place'`: 2nd and 3rd come from one finishing place (`individualChallengeFinish`);
  - a vote by the cast's `skippedBy: <segment>`: the group that wins it doesn't go, so zero votes needs no tribe immunity;
  - a finalist way out's `winnerToo: true`: the winner reached the end too. The plan missed this one: with no base, the Sole
    Survivor got no finalist points;
  - an advantage's `cancelled: 'count'`: votes cancelled are a count, asked of whoever played one;
  - a side trip's `away: 'yes'`: exile. It's the episode's exile record and scores from it. Survivor's Exile is now a twist, and
    a rulebook can have at most one such trip;
  - a custom moment's `exceptWinners: true`: the segment's winners can't have it (chosen for a reward).
- **How research asks**, the rulebook's own `research` block:
  - `searchHint`;
  - `questions[key]`: `words`, `needsSource: false`, or a `type` (with `of: 'episode'` and its words) for a question asked
    besides, which scores nothing of its own.
  - Survivor's blocks carry `survivor.js`'s words for every question, its five unsourced yeses, and its four questions asked
    besides (what was found, what was played, anything else notable, whether Tribal was held).
  - On a base, the base keeps its own words.
  - Words for a question the blocks don't ask are a compile warning, not a refusal, so taking a moment out never gets stuck on
    them.
- **The question map**: `aliases.questions`, beside events and exits (`tribalCouncilAttended` → `attendedTribal`, 16 in all), so
  stored answers keep reading.
- **Moments carry their conditions** (`rulebook-moments.js`: `also`, `needs`, `unless`, `ask.when`, `exile`). The compiler asks
  every question a condition reads, including one whose own moment is switched off.
- **A fix the plan didn't list:** whoever left isn't scored for voting with or against the majority, as they already weren't for
  votes against them. Every compiled rulebook with a cast vote gets it, but only when it's next compiled. The only one stored in
  production, The Traitors 5's, scores "voted against" at 0.
- **The golden test** (`tests/rulebook-golden.test.js`, "Survivor on its own blocks", three tests) compares:
  - events by id, points and implied;
  - every question word for word (one deliberate difference: whether Tribal was held now says what it asks);
  - claims, the search hint, the research schema, and the research and implied rules as sets;
  - the recap;
  - the harness's answers staging the same results, and the same exits and exile implying the same events;
  - demo leagues of every type scoring the same.

  Each refinement taken out makes it fail. The on-a-base golden tests stay as they were: Survivor 51 plays that path until S3.
- **Different from `survivor.js` on purpose:**
  - the order of events, rules and questions is the blocks';
  - event labels and categories are the blocks' (How it works already showed them; classic's scoring card changes at S3);
  - the wiki read is the generic one (Survivor's is code half);
  - notes, sentences and the whole-episode checks are still the code half's (S2).
- **The bot and the editors:**
  - The rulebook prompt lists the refinements.
  - A template's research block isn't shown to the chat, and an answer's is left out.
  - A refinement that doesn't fit its item is dropped, never the item (`dropMisfitRefinements`, used by the review, Make it a
    game's salvage and the desk editor).
  - Salvage now also drops a dropped part's points and notes, which used to leave the answer unusable.
  - Check for changes keeps the rulebook's research block, and rulebook edits carry it.
- **Cast stats:** a number scored once (2nd place, votes cancelled) counts in times.
- **What anyone sees today:**
  - Survivor's call rotation is identical.
  - How it works for a season read from `rulebookFor` lists Exile as a twist, with the ways out in `survivor.js`'s order.
- **Checks:**
  - 761 unit tests;
  - every other rulebook (library, samples, stored formats, the researched Traitors) compiles exactly as before, bar the
    majority fix;
  - `check-new-show.js` (81 PASS) and `check-new-stats.js` (57 PASS) at 390 on this lane's server.

**S1 noticed, not fixed:**
- **Legacy rows keep the blocks and aliases they were frozen with.** That's Survivor's library template and season rows
  (`compiled_source 'legacy'`): `behind()` in `db/rulebooks.js` compares only compiled, reader and provenance.
  - S3 has to move Survivor 51's row and the template onto the new blocks and aliases (questions included) before taking the
    base away. Otherwise a no-base compile of the old row reads none of the stored answers.
  - Until then, How it works differs between a season read from its row and one read from `rulebookFor`. (S3.)
- **The desk editor has no controls for the refinements or the research block.** They're kept through edits and dropped when an
  edit makes one not fit, but nobody can set them by hand. (The desk-parity plan, or after S2.)

**S2 part 1 as built (2026-10-28, `survivor-data`, not merged; no migration).** Research's review is the rulebook's data:
Survivor's blocks with the generic reader review research exactly as `survivor.js`'s code half does (its problems, its
repairs, its notes and sentences), and so can any show's.
- **`src/lib/game/formats/research-review.js`** (new, browser-safe): the words and the checks, their runner and their
  validation.
  - **Words.** A checklist field can carry `note` (the reviewer's phrase) and `sentence` (semantic search's, the note when
    absent), each a template: `{value}`, `{s}` (plural unless 1), `{nth}` (2nd), another answer (`{advantageFoundName|an
    advantage}`, with what to say when it's empty); `shown` (a condition) says when it's said, and `false` says nothing. A note
    with no placeholder is a label, read as before (stored formats unchanged), and so is one whose braces name nothing it can
    say (a moment labelled "Said {catchphrase}"), so a label can never break a compile.
  - **Checks** (`research.checks` in FormatData, run in order): a person's (`when`, `say`, optional `set`, run where
    `entryProblems` ran) or the episode's (`of: 'episode'`: `values` counts and sums over the cast, `when` on them and the
    episode's answers, `who` it repairs, `each` for one line per person; run where `episodeProblems` ran). Conditions are
    rules.js's, plus `{ value }` and `{ episode }` leaves and a number compared with another value.
  - `formatProblems` validates every check's placeholders, conditions and repairs, and each `shown`, against the checklist (a
    repair can't touch the questions every checklist has).
- **The generic reader** (`custom.js`) runs them: `entryProblems`, `episodeProblems` (new for data-only formats), notes and
  sentences from each question's words. A season rule change's added questions read their sentences too.
- **The compiler derives the checks from the blocks' structure**, for any show (no base only; on a base the base's stay,
  since a built-in's code half has its own):
  - a vote by the cast: votes against someone who wasn't there, everyone there on zero (cleared: nobody marked safe), votes
    against people vs people voting (reported);
  - asked whether it was held (`<segment>Held`, a question asked besides of the episode: Survivor's `tribalCouncilHeld`):
    attendance cleared when it wasn't;
  - `skippedBy`: whoever is in the group whose win skips it cleared to unknown, one line each;
  - a segment with safety on the line: won it yet went home by a vote's exit;
  - `places: 'place'`: 1st without the win;
  - an advantage's `cancelled: 'count'`: votes cancelled with nothing played.
  - The research block's `checks` (by id) give one its own words, its own condition or `off`, and add checks of their own (a
    condition on a person's answers, and words). One that reads a question the rulebook doesn't ask is left out with a
    warning, so taking a moment out never gets stuck on it; an override of the blocks' own that does falls back to the blocks'
    version, with a warning.
  - Default words name the segment ("No Tribal Council this episode, but ..." is `survivor.js`'s sentence word for word).
- **Survivor's blocks** carry `survivor.js`'s words for every question's note and sentence and for its checks, one condition of
  their own (a 1st place excuses a reward win too: Survivor's finishing place covers every individual challenge) and one
  check of their own (found an advantage without saying what).
- **The missed tribe move** (`db/episode-research.js tribalGroupProblems`) reads `research.groupVotes`: `[{ attended, say }]`,
  each vote one group goes to at a time (compiled from a cast vote with `skippedBy`) and its words for the move ({name},
  {group}, {was}). `survivor.js`'s data gains `groupVotes` (attendedTribal, its own sentence) and the on-a-base compile
  carries it. **So Survivor's legacy rulebook rows** (the library template and Survivor 51's season row) are behind their
  source and refresh once, with a version bump, the next time `ensureSeasonRulebook`/`ensureTemplate` runs: the data is the
  same bar that key, and nothing scores differently. Until then (and for a base saved before) `formatForRulebook` gives data
  read by a built-in reader the family's `groupVotes` for the votes it asks about, so the repair never lapses. Research on a
  legacy season that isn't live reads the built-in anyway (the local copy's Survivor 51: not live, flag off).
- **`notableTwist`**: the research prompt only tells a chat to put conflicts there when the ask has it (every built-in does; a
  rulebook only when its research block asks it; a re-ask of a few questions, `onlyFormat`, doesn't), read from the ask's own
  schema. Prompts for the built-ins are unchanged. (Making it a core field was tried and dropped in review: a stored format
  using the key for something else would stop building.)
- **Finalist exits** (classic's episode editor): a finalist's exit asks for jury votes wherever the format scores them (an
  implied rule per vote, or one for none) and the exit reaches the end (`endgameExitMethods`, from the ways out's `means`),
  not by format id. The same two exits as before for Survivor.
- **What other rulebooks get:** any compiled rulebook with a cast vote gets the vote's checks when it's next compiled (a
  stored one, like The Traitors 5's, only when edited); from then on an answer with everyone at its vote on zero is cleared
  rather than scoring everyone "zero votes".
- **Different from `survivor.js` on purpose:** problems, notes and sentences come in the blocks' order (the claims message
  lists its questions in the checklist's order); the golden test compares them as sets.
- **Checks:**
  - the golden test's new "research is reviewed the same" compares every harness answer plus six scenarios (no Tribal held,
    the immunity tribe at Tribal, everyone on zero, votes vs voters, one person contradicting themselves, a missed tribe
    move): problems, repairs, counts, notes, sentences and what stages after, and asserts each of the nine checks and the
    move was reached. Switching off any check, or a question's words, fails it (checked by hand);
  - `tests/research-review.test.js` (9): a made-up show's derived checks and their default words, held/not held, the research
    block's words, condition, off and own check (the two it leaves out, the override it falls back from), a talk show with
    none, `formatProblems` refusing bad checks, the templates (and braces in a label), the missed move on a show that isn't
    Survivor, data frozen before `groupVotes`, the prompt's notableTwist (a re-ask too);
  - 771 unit tests; `tsc` and eslint clean; `/code-review` on the diff (its fixes: the fallback, frozen data's `groupVotes`,
    labels with braces, notableTwist from the ask's schema, the goat's jury votes, one `the` and one `words`);
  - `scripts/dev-test/check-episode-editor.js` (new, reusable: `--league`, `--episode`, width) 9 PASS at 390 on this lane's
    server; `check-maker-scoring.js` (it recompiles rulebooks and asks research again) 57 PASS at 390, as before.

**S2 part 1 noticed, not fixed:**
- The research harness's `patterned()` never fills a nullable text answer (its JSON schema's type is a list), so votedFor, the
  advantage names and notableTwist are only ever null there; the golden test's own scenarios cover them. (Any later step
  touching `tests/harness/research-fixtures.js`; it feeds the format-regression harness too.)
- ~~A fresh researched rulebook doesn't ask `notableTwist`~~ (done in S2 part 2: below).
- The desk editor has no controls for the research block's words or checks (S1's noticed item, now bigger). (The desk-parity
  plan.)

**S2 part 2 as built (2026-10-28, `survivor-data`, not merged; no migration).** No shared code names Survivor's, The
Traitors' or The Challenge's ids any more: what the computer players and the Safety ranking read is data, stored answers are
matched by the rulebook that asked them, and a new Survivor season's rulebook is Survivor's blocks compiled, never frozen.
Nothing scores differently on any league today, and the computer players choose exactly as before.
- **Moment tags** (`src/lib/game/formats/moment-tags.js`, new): what a moment says about someone's place in the game, as
  `events[].tags` in FormatData (validated by `formatProblems`): `danger` (in the firing line and lived), `safe` (with the
  numbers), `threat` (a win that makes a target after a merge), `protectionGained` / `protectionUsed` (an advantage carried
  into a later vote, and using it up), `safety` (kept off the chopping block: the Safety ranking).
  - **The compiler derives them** (`rulebook-moments.js derivedTags`): a vote that sends someone home or puts them at risk
    (votes against them survived: danger + safety; none against them: safe + safety; with the majority: safe; targeted and
    survived, in the bottom: danger), being put at risk (danger), winning a safety segment (threat + safety), and an advantage
    that keeps someone safe or cancels votes and lasts past the episode (got: protectionGained; played, and the votes it
    cancelled: protectionUsed). A rulebook gives any moment its own with `momentNotes[id].tags` (`[]` for none; a moment added
    by hand has none of its own). Every event compiled from blocks carries `tags`, `[]` for none; on a base, the base's own.
  - **The built-ins' data carries them by hand**, exactly what `bot-logic.js` SIGNALS and `research-rows.tsx` SAFETY_EVENTS
    read by id before. The Traitors' and The Challenge's blocks set their own (`momentNotes`) so their no-base compiles match
    their built-ins too: their Round Table and daily win keep nobody "safe" for a Safety ranking (Survivor's Tribal and
    immunity do), being considered for murder, accused or nominated and lived is danger, an elimination win is a threat.
    Dropping those notes would give The Traitors' and The Challenge's Survival Pools a Safety ranking: a product call, not
    made.
  - **Data from before tags** (a legacy rulebook, a base saved then, a league's own copy, a stored format, a rulebook compiled
    before, and an event recorded under an id the rules no longer build) reads the built-ins' tags by event id
    (`formats/index.js momentTags`): exactly what the old lists did. It goes with the built-ins at S3, once every stored
    rulebook carries its own.
  - **Readers:** `bot-logic.js` profiles read `momentTags`; `tribeEdges` ("tribes vote their own out") reads the format's
    `research.groupVotes` (`groupVotesOf`, which gives a league's own copy of a built-in's rules from before part 1 its
    family's). The Safety ranking (`research-rows.tsx`) counts moments tagged `safety`, and a show has it when any moment is.
  - **The legacy-row refresh:** `survivor.js`, `traitors.js` and `challenge.js`'s data changed (tags), so their legacy rows
    (templates and seasons, Survivor 51's included) refresh once, a version on, the next time `ensureTemplate` /
    `ensureSeasonRulebook` runs, as part 1's `groupVotes` did; the data is the same bar the tags. The local copy's are
    refreshed already (the flag check runs the backfill).
- **Stored answers matched by rulebook** (`db/episode-research.js askedAlike`, at all five places). Research records the
  rulebook that asked it in `provenance.rulebook` ({ id, version }: `db/rulebooks.js seasonResearchRulebook`): the season's
  rulebook when research asks by it, or an unedited frozen one when research asks by the format it mirrors (the same
  questions: so Survivor 51's answers from now on carry its rulebook, and S3 moving that row onto the blocks keeps them).
  Stored answers count when the same rulebook asked them, whatever its format is called now, or (as before, and for answers
  from before) the same format. Re-staging reads answers asked by an earlier rulebook of the season with that rulebook's rules
  and the season's rule changes (`askedFormat`). `seasonRulebookFormat` is now `seasonResearchRulebook`'s format.
- **`ensureSeasonRulebook` never freezes a built-in whose blocks stand alone.** `survivor.blocks.js` says `standsAlone: true`
  (data: the golden tests prove it; a test keeps it to Survivor's). A new Survivor season's rulebook is those blocks compiled
  with the generic reader, no base, under Survivor's aliases (`fromBuiltInBlocks`), and while unedited it follows them as a
  frozen one follows its format (compiled again, a version on, when the blocks or the compiler move). Not live until the flag
  or the season's own switch, so its leagues play survivor.js meanwhile, as research asks; the stats for someone with no game
  read it now (`season-stats.ts`), and count the same. **The Traitors and The Challenge stay frozen**: their blocks don't say
  everything their code does yet (their scores differ with no base), so a new season of theirs would count differently.
  Existing legacy rows, Survivor 51's included, stay until S3.
  - A season whose show moved to another format gets that format's rulebook anew, the old one archived (it used to be
    rewritten in place, which would have let answers match by rulebook across formats). A phase start the results confirm
    recompiles a rulebook from blocks (a legacy one still just records it).
  - The flag's gates hold every season to `isFormatsRules`: frozen equal to its format, or its blocks compiled as they stand.
    `scripts/rulebooks-flag.js comparePlayed` compares such a season's leagues' events and catalog as sets (the blocks' order
    and words), so the flag can still go on with a new Survivor season.
- **The anything-else question** (part 1's Noticed): every rulebook compiled with no base asks `notableTwist` (in the research
  block's words when it gives them), so research has somewhere for conflicts, as every built-in has; not a talk show (its
  questions are about the night) nor a sport (results from its data; a long roster). Rulebooks already stored get it when next
  compiled. Asking an episode again for "just the new questions" skips questions nothing scores (`unaskedKeys`), so it never
  asks for that one alone. The library's stored compiles were re-saved (it, and `tags`).
- **Maker scoring:** the page lists each moment by its own id (`pointGroups` items now carry `momentId` and the rules'
  `defaultPoints`), so a rulebook with aliases (a new Survivor season, editable by a site admin before a game) saves; an event
  id is refused. A moment worth `{ exclusive, shared }` shows both ("+4.5 if on several teams"), − and + move both, and they
  save whole (it used to show and save the exclusive one alone).
- **Checks:**
  - 782 unit tests; `tsc` and eslint clean.
  - `tests/moment-tags.test.js` (new, 9): the built-ins' tags against the old lists, data from before tags (a legacy
    rulebook, an own copy, a stored format) reading the same, own tags and `[]` winning, a made-up show's derived tags (and
    what isn't tagged), `momentNotes` tags, Survivor's, The Traitors' and The Challenge's blocks reading like their built-ins,
    `groupVotesOf`, and the computer players' ratings identical on a legacy rulebook from before tags and `groupVotes`, an own
    copy from before, and Survivor's blocks with the generic reader.
  - The golden test: Survivor's blocks with the generic reader give survivor.js's tags; only Survivor's blocks stand alone.
  - `tests/episode-research-cache.test.js`: matching by rulebook (a renamed format keeps its answers, another format with
    another rulebook doesn't), and re-asks skipping questions nothing scores. `tests/research-review.test.js`: the
    anything-else question (its words, never on a talk show or a sport, a rulebook compiled before isn't told about it).
  - `scripts/dev-test/check-rulebook-flag.js` (all passed): its fixture's built-in seasons now start frozen as every season
    made before this step was; new: a season made today (Survivor's is its blocks, its league scores as on survivor.js with
    the flag on, The Traitors' still frozen), what asks research, a frozen season from before its data moved refreshing, an
    unedited blocks rulebook following its blocks, a show switched to another format.
  - `check-maker-scoring.js` (step 6, new: a Survivor season from its blocks, its moment ids and split worths, in the browser
    at 390), `check-new-computer-players.js` (43), `check-pool-research.js` (the Safety ranking: the same output with the old
    and new code), `check-new-stats.js`, `check-research-asks.js` (50), `check-new-show.js` (81): all passed at 390 on this
    lane's server.
  - `/code-review` on the diff (its fixes: the flag's gates for a season from blocks, its refresh and phase starts, answers
    matched by rulebook or format, the season's rule changes when re-staging, `tags: []` so a moment added by hand never reads
    a built-in's by id, re-asks skipping unscored questions, `pointGroups` giving the maker's page its ids, the fixture not
    touching library rows).
- **Then the test couch plays it** (the user's, in production): after S2 merges and deploys, Settings › Test couch › Rules:
  choose **Today's rules as a rulebook** again (choosing it compiles Survivor's blocks as they are now; the couch was made
  with the blocks from before S1), then watch two airing episodes with every table matching the real games at today's points.

**S2 part 2 noticed, not fixed:**
- On a Survivor season's Scoring page (a new one from its blocks, for a site admin before a game), the blocks' own moments
  added by hand (Chosen to join a reward, Sat out a challenge, Learned of an idol privately) show "Its own question" and an
  X: the page treats every custom moment as the maker's, so it could take out one of the show's. (Maker scoring, or S3.)
- The Traitors' and The Challenge's blocks with no base score differently from their built-ins (the flag check's first run
  without the freeze: Traitors' scores, the Challenge's catalog). Their own S1 is what lets their new seasons stop freezing,
  or S3 retires them first. (S3.)

**A. The engine: games as specs** (master).
- **A1. The game spec, pure, no engine change.**
  - The schema above with every field, the sports branch's marked as its own.
  - The presets.
  - `specOf(settings)`: today's settings to a spec, for every league.
  - `describeSpec`: the wizard's sentence and How it works.
  - `specProblems`, with the data-can-settle rule in it.
  - Tests: every league in the local copy round-trips, and the three examples are fixtures.

  **As built (A1, 2026-10-27, on `engine`, not merged; no migration, no engine change).** `src/lib/game/game-spec/`, plain
  CommonJS like `formats/` so `state-logic.js` can require it in A2 (types in `index.d.ts`):
  - **`schema.js`**: the schema with every field. `VOCAB` says who builds each value: `now` (today's engine), `A3`, `A4`,
    `sports` (marked as the branch's: `get.by` squares, `count.best`, `score.by` stats, `rank` matchups / categories / roto,
    `closes` daily / weekly, `pool.where` teams, the `side` answer, the `final` and `stat` settles) or `later` (`pool.where`
    group). The five **`PRESETS`**, exactly as Start a game makes them today (frozen). `fullSpec` fills what a spec leaves
    out: from its preset while a part is the same kind ("draft 6 each" on a Weekly Lineup stays its shared blind draft), else
    the mechanics' own defaults; a spec with no preset starts with no side bets. `typeOf`: the league type today's engine
    plays it as, from the mechanics only, never the preset's name.
  - **`specProblems(spec, ctx, opts)`**: the shape (unknown keys too, so a misspelled one isn't played as the default), a new
    game's sizes as Game settings allows them (Outlast 1–10, a lineup up to 8 starters and 6 on the bench), and waivers the
    engine would read as something else (only a lineup is short; a window swaps at most the team). With `ctx`, **the
    data-can-settle rule**: every moment that scores (the spec's points for it, or else the rulebook's own) is answered by
    research or known from its answers, never the couch's word; a moment the spec gives points is the show's; a stat is one
    of the sport's keys; every question's settle is one data can do. `opts.league` is for a league's own rules (A2's
    writes): its couch-answered moments (Make it ours), leftover moment ids and a team bigger than a new game's stay as they are.
  - **`specWaitsFor`**: what a valid spec needs that isn't built, and the step that builds it (or, every part built, no game
    plays them together yet: step null).
  - **`settings.js`**: `specOf(settings)` reads a league as `state-logic.js` reads its settings today. `settingsOf(spec)`
    gives the fields a spec writes (null when it has problems or no game plays it). `withSpec(settings, spec)` writes only the
    parts of the game that change. So writing a league's own spec back changes nothing, a stored form the engine reads the
    same way survives (a Who can join choice under classic's late-joiner switch, the waiver suggestion still to be fitted),
    and the result always reads as the spec. `OWNED` lists every field a spec writes, `OUTSIDE` what isn't the game (the show
    and rules it refers to, what it's revealed, archiving, setup, the waiver suggestion's bookkeeping).
  - **`describe.js`**: `describeSpec(spec, ctx)` gives the sentence ("A Weekly Lineup for Survivor 51: everyone drafts 5 and
    starts 3 each episode, Episode 7 to the finale. Scored by Survivor 51's rules.") and its `parts`, each with the part of
    the spec it says, for G2's "theirs and ours". `rules` is How it works, the Rules sheet's own lines (`game-rules.ts`) for
    every league. `details` are the ones nobody asked about, each marked recommended or not. A spec still being made is said
    as far as it goes.
  - **Shape, settled here:** a Survival Pool's score is `{ by: 'survive', means: staysIn | scores, points }`; `count` is null
    when nothing is held; the extras are waivers, bets, finale, calls (the public pool's), the draft room, join,
    hideStarters and lockedDown; every game today picks from `{ stillIn: true }`; a draft's order follows its ownership
    (enforced, as today). A spec doesn't name its show or season: the league does, and the resolver hands Start both.
  - **Tests** (`tests/game-spec.test.js`, 12, in `npm test`, now 764): the presets, and what Start a game makes; 20 kinds of
    league round-trip. Each is rebuilt from its spec alone, its fields taken out by the test's own list of what each kind is
    made of, and every reading the engine makes is the same (type, flags, roster, waivers, joining, span, finale, bets, draft
    room, pool, every moment's points, the scores). Its own spec written back changes nothing. How it works is the Rules
    sheet's. Also: the three examples (`tests/fixtures/game-specs.js`), the data rule, the problems, the waits, and `withSpec`
    turning every preset into every other. Every league in this lane's database (9, read only, ids only) round-trips too,
    skipped without a local database. Mutations of `settings.js` (a field forgotten, a pass dropped) all fail it.
  - **For A2:** `state-logic.js` takes the vocabularies and readers from here, which removes the second copy in
    `settings.js` that the tests hold in step today. A writer that flips a draft's ownership remaps the points it read
    (`specOf` carries the stored map), as `updateSettings` does, and makes a later start's episode. A league's own
    spec is validated with `opts.league`.
  - **Open, for G1 (the user's call):** side bets are on in every preset, as Start a game makes them today. They're graded
    by whoever runs the game, not by data, so a spec with no preset starts without them: should the GPT's preset games too?
- **A2. The engine reads specs.**
  - `getLeagueType` and every strategy parameter come from `specOf(state)`. The flags (`hasRoster`, ...) are worked out from
    it, so the 45 files reading them keep working.
  - Every settings write (classic's PATCH, `updateSettings`, Game settings, Start a game) goes through the spec's validator,
    which writes today's fields from it while classic still reads them.
  - `settings.game` goes behind a flag (`app_settings 'game-specs'`, `scripts/game-specs-flag.js status|check|on|off`). The
    check: every league scores the same with it on, on the local copy and on a Neon branch of production (from the user's
    terminal). Then it goes on in production, with the user's OK.

  **As built (A2, 2026-10-28, on `engine`, not merged; no migration).** One session.
  - **The engine reads specs.** `StateLogic.gameOf(state)` is the game a league plays: game-spec's `gameOf(settings)`, its
    carried `settings.game` while that's whole, a game plays it and nothing's wrong with it as a league's own (checked once
    per spec, since a league's spec is replaced, never changed in place), else `specOf(settings)` (read only; the points
    map isn't copied, so the hot paths stay cheap). `getLeagueType` works the type out from the spec's mechanics
    (`playsAs`, typeOf without the copy) and its ownership; the five types' flags are their presets' (`flagsOf`), the
    shared variants the shared draft's, no longer written by hand. Every setting the engine reads comes from it: the span
    (startEpisode, endEpisode, inPlay), the team, starters and bench, ownership, a moment's points, side bets and finale
    points (one `addSideLayers` for both drafts), the draft room's time, a pool's survive-by-scoring, points and call,
    waivers (`WaiverLogic.waivers`: the spec's, or for a game with none what its fields store, as the waiver screens
    start from), who can join and Lock it down; outside the engine, draft-view's timer and the lineup page's hidden
    starters. The vocabularies, `legacyConfig`, `normalizeWindows` and the bet clamp are game-spec's (one copy).
  - **What reads differently** (the pre-A2 engine against the new one, on every lane league and played demos of the three
    drafts and pools: every reading and every score the same, except): a game that doesn't score by moments (Outlast, a
    pool) no longer reads the stale points copy `defaultState` gives every league, so `pointsFor` there is the rulebook's
    own (a sport's pool asks whether a pick scored; the computer players' form in a pool); the team and lineup sizes are 0
    in a game with none (they were the leftover fields); finale predictions switched off no longer count (scoring added
    them whenever the finale was in); `MidSeasonLogic.replenishAt` is `WaiverLogic.shortAt` (only the unused
    `replenishNeed` called it). `computeScores` is about twice as slow, still under 0.1 ms for a whole 12-episode season.
  - **One writer.** `RosterLogic.setGame(state, spec, { ctx })` checks the spec as the league's own (`specProblems` with
    `opts.league` and the new `opts.was`: a problem the league already had doesn't block; the size limits hold for what
    grows), writes today's fields with `withSpec` (only the game's fields, so a big rulebook isn't copied), moves points
    still at the old ownership's defaults when a draft changes hands (unless the write set the points itself), makes a later
    start's episode, and keeps a carried spec in step (`syncGame`). It returns the problems it refused for ([] when
    written). `editSettings(state, fn)` runs a change made the old way on a copy and writes what the copy plays through
    `setGame`; `updateSettings` sends a game field (game-spec `OWNED`, and the waiver suggestion) that way (`writeSetting`
    is today's normalizing) and returns the problems; the league's own fields (show, season, reveal, setup) are written as
    before. The waiver suggestion goes through it too, and `migrateLeagueState` keeps a carried spec in step.
  - **One set of size limits**, game-spec's (`MAX_TEAM` 10, `MAX_STARTERS` 8, `MAX_BENCH` 6, `MAX_LINEUP_TEAM` 14), for every
    write; a league already bigger keeps its size and can come down. Game settings reports each size's `max` (the team, once
    drafted) and its steppers stop there; classic's setup steppers, which had no maximum, stop there too.
  - **The writers.** Classic's settings route (refused: 400 with why), Game settings (each change; drafted starters as one
    change of the spec's count, the team unchanged), Fine-tune, Lock it down, the points, the draft room's time and timer,
    Undo (one setting through `updateSettings`; a set put back as it was, then `syncGame`; `change-log.ts` leaves `game`
    out of a settings diff), the public pool's call and the practice couch (`solo.ts`), and **Start a game**: one spec (the
    made league's preset, its span, a sport's shared draft and a pool surviving by scoring, Outlast's team fitted to the
    couch, Run it back's parts within the limits: `againParts`, which replaces `AGAIN_KEEPS`), written once with `setGame`.
    `game-writes.ts refused` turns problems into an answer.
  - **The flag**, `app_settings 'game-specs'` (`db/game-specs.js`: `gameSpecsOn`, `carryGame`, `syncLeagueGame`,
    `syncLeagueRow`). On, every league carries `settings.game`; `makeLeague` and classic's settings route carry it from the
    start. `scripts/game-specs-flag.js status | check | on | off` (`GAME_SPECS_DATABASE_URL` for a Neon branch, `--yes` away
    from localhost; league ids only). **check**: for each league, its spec has nothing wrong as the league's own and a game
    plays it, writing it back changes nothing, and carrying it plays the same: type, flags, sizes, span, waivers, joining,
    the extras, every moment's points, the scores, and the scores after every episode. **This lane's database: 9 of 9 PASS;
    the flag is on here** (left on, so A3 and A4 build on it), and after every browser check below, none drifted.
    Production: the user's (below). **With it on, a league's fields are only written through the writer**: anything that
    writes them straight in (a fixture editing a stored league, the guided tour's practice round copying a real league's
    settings) calls `StateLogic.syncGame` after, as `check-pool-research.js`, `up-next-fixture.js` and `tour/practice.ts`
    now do; `status` lists any league that drifted.
  - **The Rules sheet** (`game-rules.ts`) is `describeSpec`'s How it works now: the same lines (fixtures in
    `tests/game-spec.test.js`), a sport's pool "scores in it", and a line for finale predictions when they're on.
  - **Noticed items taken:** the stale comment (fixed). `migrateLeagueState`'s 'mostPoints' backfill **stays**: it's for
    saves from before 'rolling', and SurvivorDraft's engine (this file's source, checked) ordered by most points when a
    league had none; every league made here has the field. Said in a comment there.
  - **The code review's fixes** (`/code-review`, before the commit): the season's stats read a Weekly Lineup's own points
    (`season-stats.ts`'s facts league plays as one, since `pointsFor` reads points only in a game scored by moments); Run it
    back keeps a shared Outlast's ownership with no waivers (its waivers follow the ownership it keeps); Undo of a set syncs
    the spec before the waiver switches are mirrored from it; a drafted lineup's most starters is the team within the limit;
    the waiver feel says the writer's real reason (`WaiverLogic.writeRecommendation`); a carried spec is checked whole and
    sound before it's played; `WaiverLogic.legacyConfig`, which nothing called, is gone. Declined: memoizing `gameOf` for a
    league that carries no spec (a nested setting changed in place would read stale; the cost is under 0.1 ms a season, and
    a carried spec is already read as stored).
  - **Tests:** `tests/game-spec-engine.test.js` (10: the flags; a carried spec decides, a broken one doesn't; refusals write
    nothing; the limits; what a change does (points moved once, guided setup's shared, a later start, the waiver suggestion,
    a field kept for later); `setGame` with a whole spec; migrate; the flag's check on every kind; a carried spec played only
    whole, and an Undo's order; the stats' facts league), the Rules sheet's fixtures; `npm test` 775. Browser, at 390 on this
    lane's server with the flag on: `check-new-backstage-ii.js` grows A2's (149 PASS: the drafted maximum, Game settings and
    classic's route refusing past the limits with nothing written, the stepper stopping at the team, and no game drifted
    after every write the check makes); `check-new-start-game.js` 75, `check-new-solo.js` 92, `check-new-draft.js` 90,
    `check-new-show.js` 81 (the Rules sheet), `check-new-stats.js` 57, `check-settings.js` (classic, both drafts) clean. One
    early Backstage II run failed one line that didn't come back in four more (cut off before it was read).
  - **For the user (after the merge):** a Neon branch of production, then from your terminal
    `$env:GAME_SPECS_DATABASE_URL = "<the branch's string>"; node scripts/game-specs-flag.js check; Remove-Item
    Env:GAME_SPECS_DATABASE_URL`. It must end PASS; then `on` against production (`--yes`), with your OK.
  - **For A3:** the spec now can be carried, but `withSpec`, `carryGame` and the check assume today's fields say all of it
    (true through A2). A phase start (`span.from: { phase }`) is the first thing they can't: A3 makes the engine play it from
    `settings.game` and decides what the fields say meanwhile (and what `syncGame` does, which today rebuilds the spec from
    the fields).
- **A3. Spans that start later.** "Starts" on Start a game: any later listed episode, or when a rulebook phase starts (the game
  waits, and its draft can happen first). Game settings moves a start before it airs. Also the rest of BACKLOG item 10: side
  bets after the end, one word for an episode, and the places that don't know the end.

  **Split in two (2026-10-28).** A phase's start lives only on the season's rulebook row (`rulebooks.phase_starts`, a person's
  on the desk), never in a league's state, so a phase start needs a server write to settle it and its own engine, fields, Start
  a game and Game settings work. Part 1 is everything with an episode number. Part 2 is the phase start, designed below.

  **As built (A3 part 1, 2026-10-28, on `engine`, not merged; no migration).** One session.
  - **Starts on Start a game** (`start-game.ts`, `start-game.tsx` `Starts`): "With the next one · Episode 6" (when it airs)
    or Later, any listed episode after it, from a list by date ("Episode 9 · Sat, Nov 21"), with "It waits for Episode 9:
    nothing before it counts, and the draft can happen any time before then." Choosing one reads the options again from there
    (`?start=9`, as Include it does), so How long counts from it; Start waits while they reload, and sends the start you chose
    (`from`). The server takes `from` only as a listed episode from the next on, not with Include it, and checks it after the
    season's own refusals; Recent changes says "started Outlast from Episode 9". `startOptions` returns `nextEpisode` and
    `starts`; the next season it used to call `next` is `nextSeason` (a phone on the old bundle reading `next` finds nothing,
    not a number). A game that starts later is only `settings.startEpisode`: the engine already played that (a league formed
    mid-season), and `setGame` makes its first episode.
  - **Game settings moves a start** until its first episode airs (`backstage-games.ts`: `startEpisode` is a Game settings
    field, frozen by Lock it down; `span.started` and `span.starts`, the episodes still to come up to its end): a Starts list
    above Ends, "Move its start before Episode 9 airs, its end before it's reached. Only what's between them scores.", Undo on
    the toast. Undo can't put back a start that's aired: a change undoes only until the next episode airs, and a start moves
    only before it does. The Games tab says "Starts with Episode 9 ·" while a game waits for a start later than the next
    episode (by the schedule, not what you've seen).
  - **This week is never past the episode after the latest results** (`BetLogic.upcomingEpisodeNumber`): moving a start later
    makes every episode up to it, so a start moved back used to leave this week's picks, lineups and bets on the later one.
    `currentEpisodeNumber` is the one definition of this week's episode, for moves and bets alike.
  - **Side bets** (`BetLogic.target`, `add`, `addPrediction`, `addSideLayers`; classic's bets route): a bet goes on the game's
    own episode (its first, for a game that starts later), never one before its start or after a span's end, and none once the
    game is over (409 "This game is over: no new predictions"); no guesses on a bet outside the span; and **bets outside the
    span no longer pay** (one made before a start moved later did). Classic only offered the box on `currentEpisode`, so only
    the API could reach these. The guided tour's practice round plays its own Episodes 1-2 whatever span the real game has.
  - **The places that didn't know the end:** classic's catch-up reveal stops at a span's last episode (`RevealLogic.isComplete`,
    `revealNext`), saying "Game over" / "Final" / "This game is over" where it said the season was (catch-up panel, results
    card, reveal route); Backstage's open episodes count only games still waiting on an episode, so one past a span's end holds
    nothing open (`backstage.ts` `needs`; results still reach it); How it works' updates say "Ends with Episode 7 · Nothing
    after it scores", always shown like the start, in episode order around the hidden ones (`UpdateRow`).
  - **One word for an episode:** Start a game and How it works say the show's (`episode_term`, through `showWords`), as the
    hub, plaques and Game settings do, in every line the rulebook words too (its `parts` replaced by the show's).
  - **Titles held back:** the start sheet's later episodes (and How long's ends) carry a title only for a sport or a linked
    game, the matchup; a show's later titles are quotes from the episode (`schedule.ts titledFor`'s rule).
  - **Code review** (`/code-review`, before the commit): taken: the start moved back, bets outside the span paying, the
    sheet's start sent from stale options, the Games tab's line from what you've seen, the renamed field, the check order,
    titles, the updates' order, How it works' word, the season-complete wording, one this-week definition. Declined: Undo of a
    start after it airs (can't happen, above); `BetLogic.add` returning reasons (the route asks the engine's `betTarget` and
    `inPlay` itself); reading only the spans again on a start change (as Include it does; Start waits meanwhile).
  - **Checks:** `tests/spans.test.js` (+6: a later start's moves, scores and bets; bets after the end, including a last
    episode that's the latest; the catch-up reveal; How it works' end; a start moved back; a bet the start moved past);
    `npm test` 781. `scripts/dev-test/check-spans.js` grows A3's (99 PASS at 390: Starts' options and refusals, an Outlast
    from Episode 9 started in the sheet, its first episode made, its bet on 9, "Starts with Episode 9", Game settings moving it
    to 11 and Undo, its refusals, bets refused on the finished pool and lineup game, and every game jordan started still
    carrying the spec its fields play); `check-new-start-game.js` 75, `check-new-backstage-ii.js` 149, `check-new-show.js` 81,
    `check-settings.js` (classic, both drafts) clean. `game-specs-flag.js status`: on, 9 of 9 carry their spec, none drifted;
    `check` PASS.
  - **Not merged in:** master's two commits since the branch was cut (lanes overnight, the playtest lane: docs and
    `scripts/lane.js` only); the session loop can't merge. `node scripts/lane.js sync engine` before part 2.

  **The phase start, decided (2026-10-28), for part 2.**
  - **The spec:** `span.from` is an episode number, or `{ phase }` while the game waits for that phase of the season's
    rulebook, then `{ phase, at }` once data says where it starts: `at` is the episode it plays from. The phase stays (the
    words, "When Merged starts"; Game settings; Run it back from the same phase next season).
  - **Where a phase starts:** the season's rulebook (the league's own copy when it plays by one: `rulebookForLeague`),
    `phaseRanges(blocks, row.phaseStarts)[phase].from`: a start a person confirmed on the desk (from research's
    `phaseStarted`, results or "when N are left" cues) or a phase that starts at a fixed episode. The same start the scoring's
    phase gates use, so a game "from the merge" starts where the rulebook's merged phase does. Never guessed.
  - **Settling `at`** is a write through `setGame`: `at` = the later of the phase's first episode and the first episode still
    open for moves when it's learned (an announced phase is confirmed only after its first episode airs, and nobody is scored
    on an episode they couldn't make moves for). Written at Start a game when the start is already known and ahead; when the
    desk confirms, corrects or clears a phase start (`confirmPhase` then a settle of every league on the season waiting on it,
    or settled to an episode that hasn't aired: cleared goes back to waiting); and as a backstop in the season sync
    (`syncSeasonLeagues`, after every result). Never once `at` has aired.
  - **While it waits** the engine plays nothing: no episode in play, nothing asked (`currentEpisode` null), nothing scores, no
    waiver windows, not over (unless the season ends first: over, never started); the draft room and joining as before a
    start. `startEpisode(state)` is null then, and its callers (state-logic's this week, the pool's rows, the waiver
    recommendation and windows, `GhostLogic.startFor` / `isUnderway` / `startChoices`, the lineup message; bingo, calls,
    couch-hub, couch-joins, How it works, solo, episode-view) each say what waiting means for them.
  - **The fields meanwhile:** one more owned field, `startPhase` (the phase id), beside `startEpisode`: waiting is
    `startPhase` with no `startEpisode`, settled is both. `specOf` reads them back into `{ phase }` / `{ phase, at }`, so the
    fields still say the whole game: `withSpec` and `settingsOf` write both (the span part's fields), `syncGame` (which
    rebuilds the spec from the fields) and `carryGame` keep the phase, the flag's `check` needs no new case (its round trip
    and same-play hold), and **a league without the flag plays it the same from its fields**. Why not the spec alone: every
    path that rebuilds the spec from the fields (an Undo, a flag sync, `editSettings`) would drop it, and phase games couldn't
    exist in production until the flag is on. One more mirrored field until classic goes (step C) is the cheaper price. The two
    raw SQL reads of `startEpisode` (`show-space.ts games`, `start-game.ts`'s Run it back) take a null start as waiting.
  - **The schema:** `span.from: n | { phase, at? }`; `specProblems` checks the phase is a non-empty id, `at` 1 or more, `to`
    from `at` on; with `ctx.phases`, a phase of the rulebook that isn't its first (that's Episode 1). `specWaitsFor` drops
    `A3`; `plainParts` accepts it, so every preset plays a phase start.
  - **Start a game:** Starts adds "When Merged starts" for each phase of the season's rulebook still to come (its start
    unknown, or known and ahead: then "· Episode 9"), with its summary; How long is the rest of the season (an end once it's
    settled, in Game settings). **Game settings:** "Starts when Merged starts" (waiting) or "Starts with Episode 9, when Merged
    started"; switchable between a phase and an episode until it airs. Its check: a phase game started, its desk confirmation
    settling it, a correction moving it, a clear sending it back, the season sync settling one the desk walk missed, and the
    flag's check over a waiting and a settled league.

  **As built (A3 part 2, 2026-10-28, on `engine`, not merged; no migration).** One session, as decided above. Master merged in
  first (`lane.js sync engine`: the playtest lane's docs, `scripts/lane.js` and `keep-awake.ps1`); 781 then.
  - **The spec** (`schema.js`): `span.from` is an episode or `{ phase, at? }`; `spanStart(span)` is the episode it plays from
    (null while it waits) and `spanPhase(span)` its phase. `specProblems`: the phase named, `at` 1 or more, `to` from `at` on
    (any while it waits: nothing to check it against), only `phase` and `at` in `span.from`; with `ctx.phases`, one of the
    season's and never the first. `specWaitsFor` has no A3 any more (gone from its order), and `plainParts` accepts it, so every
    preset plays one. `describeSpec` says it by the phase's name (`ctx.phases`, else its id): "from when Merged starts", once
    settled "Episode 9 to the finale, starting with Merged"; How it works "It starts when Merged starts: nothing before then
    scores." or "It starts with Merged, at Episode 9: the episodes before it are history." (Words that hold whether that
    episode has aired or is still to come: a start the rulebook fixes, or the desk confirms ahead, settles before it airs.)
  - **The fields** (`settings.js`): `startPhase` beside `startEpisode`, in the span part (so `OWNED`): waiting is `startPhase`
    with `startEpisode` null, settled is both. `spanOf` reads them back into `{ phase }` / `{ phase, at }`, so `withSpec`,
    `settingsOf`, `syncGame`, `carryGame` and the flag's `check` keep the phase with no case of their own (the check's snapshot
    reads `startPhase` too), and a league without the flag plays it the same from its fields.
  - **The engine while it waits** (`state-logic.js`): `startEpisode(state)` null, `startPhase`, `waitsForPhase`. No episode in
    play, `currentEpisode` null (so no lineup, pick, bet target, computer player's move or lock push), no waiver week or
    window, `isUnderway` only by its draft (results before it are history), `startChoices` the next live episode (a newcomer
    joins live), `startFor` null, the waiver recommendation counts from after the latest results, a lineup refused with "This
    game hasn't started: it waits for its phase of the season". Over only when the season ends first (over, never started).
    **`RosterLogic.settleStart(state, { from, open })`** (`StateLogic.settleStart`) is the rule, through `setGame`: the later of
    the phase's first episode and the first episode still open; unknown again (cleared) waits again; never once it has
    aired; an end the new start passes goes (to the season's end). A game waiting for its phase has no end (so it can't be
    over before it starts): a clear drops it, and so does switching to a phase (`writeSetting`: a `startEpisode` drops the
    phase, a `startPhase` waits with no end). `setGame` makes a first episode only for a known start.
  - **Settling** (`src/lib/server/phase-starts.ts`, new): `phasesOf` (rulebook-compile.js `phaseRanges` over the rulebook's
    confirmed starts), `seasonBlocks` (moved from start-game.ts, now with the confirmed starts), `phasesFrom` / `leaguePhases`
    (a couch's own copy, Make it ours, with the season's confirmed starts under its own: the desk confirms on the season's
    and a copy keeps those it was made with; else the season's), `openEpisode` (the one after the latest that's aired or has
    results), `settleIn`, `settleLeague` (with a Recent changes line, kind `game.settled`, tier 1, no Undo: "Starts with
    Merged, at Episode 6", "Waits for Merged to start again") and `settleSeasonStarts` (only games whose start could still
    move: one that's aired isn't locked and rewritten). Called at Start a game; from `desk-rulebooks.ts writePhase`, which the
    desk's confirm, correction, clear and History Undo all go through (every game on the season, a league's own rulebook
    through its league's season); and in `syncSeasonLeagues` after each league's results,
    loaded lazily as bingo is, after the season's rulebook is brought up to date (`ensureSeasonRulebook`), so a merge its
    results confirm (`knownPhaseStarts`) settles in the same sync.
  - **Start a game**: options carry `phases` (by the rules the couch's games here play by; each still to come, never the
    first; `at` when known and ahead); POST takes
    `phase` (refused with a later episode, Include it or an end, and for the first phase or one the season hasn't got); a start
    known and ahead is settled there and then. Recent changes "started Weekly Lineup from when Merged starts"; the push "from
    when Merged starts". The sheet: Starts gains "When Merged starts" with the phase's summary ("· Episode 9" when known), a
    note that it waits and runs to the season's end, the title "ZT Survivor · when Merged starts", and no How long. Run it
    back keeps a phase start the season still has to come (`again.phase`, preselected).
  - **Game settings**: `span.from` null while it waits, `span.phase` and `span.phases` (still to come, until it's started);
    `startPhase` is a settings field (refused once started, for the first phase, by someone who doesn't run it, or locked
    down), settled at once, its end gone. The screen: "When Merged starts, to the season's end" and that it waits, no Ends
    until it's settled; then "Episode 6 to the season's end" and "Starts with Merged, at Episode 6" ("Started" once it's
    aired); Starts lists the phases and the episodes. Game settings reads the season's book once for all its games. Part 1's
    Noticed item taken: `span.starts` and `span.ends` carry numbers only.
  - **Every reader of a null start**: the Games tab "Starts when Merged starts ·" (`GameView.from` null, `GameView.phase` the
    phase's name, filled in by season-games.ts) and its Run it back filter (a waiting game starts after anything over),
    `show-space.ts games` and couch-joins (`start` null, no span), the couch hub (no span; Weekly Calls and Bingo count nothing),
    bingo and calls (nothing counted, no card or calls to make), How it works (the start row from the premiere: "The game
    starts when Merged starts."), episode view ("Before the game started"), the side bet route ("This game hasn't started:
    predictions open once it does"), solo (a public pool never waits), research's ranges, classic's setup (a locked "Starts"
    line: Game settings changes it) and the waiver tools.
  - **Tests**: `game-spec.test.js` (round trips of a waiting lineup, a played pool waiting, a played Outlast settled at 8 and a
    played lineup settled at 4 through 10; the shape; the waits; the words), `game-spec-engine.test.js` (+1, settleStart's rule
    end to end; setGame writes a phase start; the flag's check over a waiting and a settled league), `spans.test.js` (+1, every
    kind while it waits, then settled; over, never started). `npm test` 783.
  - **Browser** (`scripts/dev-test/check-phase-starts.js`, new, on new-fixture.js, with the desk's own admin; 58 PASS at 390):
    the options and their refusals; a Weekly Lineup when Merged starts started in the sheet, a pool too, an Outlast from 9
    switched in Game settings; nothing asked, scored or bet while they wait; Game settings switching to Episode 9 and Undo
    back; the desk confirming Episode 5 in the browser (all three settle at 6), a correction to 8, one to 4 (back to 6), a clear;
    Episode 6's results coming in all post-merge (the sync confirms Merged at 6 and settles all three at 7); nothing moving
    once 7 aired; a game settled at Start a game (Episode 9); Run it back's phase; the flag's check and no drift. Part 1's,
    unchanged: `check-spans.js` 99, `check-new-start-game.js` 75, `check-new-backstage-ii.js` 149, `check-new-show.js` 81 (one
    run back to back with the others lost its browser at 42; alone, 81). `game-specs-flag.js status`: on, 9 of 9 carry their
    spec, none drifted; `check` PASS.
  - **Code review** (`/code-review`, before the commit): taken: a couch's own copy never got the desk's confirmed starts (its
    games would have waited for good: the season's now sit under the copy's, and Start a game lists the copy's phases); a stale
    end on a game switched to a phase or cleared back to waiting (it could be over before it started); the desk walk locking
    and rewriting games whose start had aired; the past tense for a start settled ahead of its episode; a one-episode question
    game settled at a phase; the solo screen's "from Episode null"; Game settings reading the season's book per game; a second
    schedule read and a duplicate `leagueSeason` (push-events.ts has it). Declined: one shared fallback for a null start
    (research ranges over every episode while a game waits, waivers count from the next live one: each says what waiting
    means for it, as decided). The checks above are from after these fixes.
- **A4. Questions settled by data** (`ask`).
  - The answer kinds and the lock (`closedForPlay`).
  - Answers stored per game (like `episode_calls`), graded on read from the season's results (the shows' settles), with points
    and standings.
  - Weekly Calls and finale predictions become presets of it, scores unchanged.
  - Answering and results on screen move to the UI track (U1); A4 is the engine and storage.
  - Sports' settles are the branch's.

  **Split in two (2026-10-28).** Part 1 is the engine and storage: the question's shape, the answer kinds, the lock, the
  grader, `game_answers`, the answers API, a game of questions' standings, Weekly Calls and finale predictions as `ask`
  presets with their scores proven unchanged, side bets' lock and Predictions only where they count. Part 2 is the screens:
  answering and results, designed with impeccable at 390 first, finale predictions in the new design, and starting a game
  of questions.

  **As built (A4 part 1, 2026-10-28, on `engine`, not merged; migration 0200).** One session. Master hadn't moved since A3
  part 2's merge (783 tests then).
  - **The question** (`schema.js`): `{ id, ask, answer, points, settle, asked, closes, pick?, from?, line?, options? }`.
    - `asked`: `once` (the default) or `each` episode the game plays.
    - `closes`: `start` (its episode's start, or the game's first for one asked once) or `finale` (the season's last
      episode's start).
    - A person answer names `pick` of them (default 1; each right one scores) `from` the cast still in or a draft's own team.
    - Results settle `out` (asked once: the first to go in the game), `winner`, `placed` (who finished `place`th) and the
      new `top` (in the top `place`); a moment settles `happened` or `count` (asked once: over the game).
    - The rules (`questionProblems`): who wins, placed and top are the season's (asked once, in a game that runs to its end);
      only who wins or the final few wait for the finale (anything else could be settled before it); `team` needs a draft;
      ids, at most 12 questions, points 0 to 100, choices of 2 to 12 options (yes/no for whether it happened, numbers or
      ranges like "3+" for a count).
    - A league's own keeps what it already plays (finale predictions on a game with an end, points past 100).
    - **The data rule holds for every question**: a moment settles only if research answers it, even in a league's own
      (`strict`; only Weekly Calls' talk-show calls keep the couch's word, `ctx.calls`), results need `ctx.results`, a
      winner `ctx.winner`. `RosterLogic.setGame` refuses a game's own new or changed questions without the show's ctx, so
      every write checks them; the presets are today's games.
    - `specWaitsFor` has no A4 any more (only the sports branch, and an over/under's line still to set).
  - **The ask presets.** `CALLS`, Weekly Calls' one question (the show's two calls, Call it's, a person's): the Weekly
    Calls preset is now `score: { by: 'answers' }, ask: [CALLS]` (`score.by: 'calls'` is gone), still graded by `calls.ts
    callRights`, so its scores are unchanged by construction. `finaleQuestions({ top3, winner, from })`: a draft's finale
    predictions as two questions (`top3`: pick 3, top 3; `winner`), asked once, closing at the finale; `extras.finale` is
    gone. `finaleOf(ask)` reads them back. `playsAs`: a draft plays an empty ask or exactly the finale pair; `weekly-calls`
    is `[CALLS]`; a new league type **`questions`** plays nothing held, scored by its own questions (each a show's, its line
    set). Flags: `hasQuestions`; `hasCalls` from the calls question.
  - **Side bets only where they count** (A1's and A2's Noticed item): `betsFit` (a draft) and `StateLogic.betsOn(state)`, which
    every reader of side bets asks now, in the new design and classic alike (`predictionsOf`, `actionItems`, the hub's "Called
    it", the Rules sheet, the details, the classic overview, episode pages, scoreboards, setup, the explainer, the poll's
    nudges). `specOf` reads a pool's, Weekly Calls' or Weekly Bingo's switch as off; the stored `bonusEnabled` stays as it is,
    read by nothing. The presets for those three have `bets: null`.
  - **The fields** (`settings.js`): a game of questions keeps its questions in `settings.questions` (owned); finale
    predictions are their four fields, as before; Weekly Calls' question is its type's. So the fields still say the whole
    game, and a league without the flag plays it the same.
  - **The grader** (`game-spec/answers.js`, pure): `verdictOf(q, episode, facts)` (waiting, off with why, or known with the
    right answers and a count), `pointsFor` (a person answer per right pick; a number the closest, ties all; an over/under
    against its line, right on it off; a choice matched to names, yes/no or ranges), `isRight`, `answerProblem`.
  - **The engine** (`state-logic.js` `AnswerLogic`):
    - `facts(state)`: from the league's own results as the viewer's copy says them, so nothing past their mark is graded.
      It includes who went home in each of the game's episodes, each moment's count once the results are final, the
      winner, and the finish order once the season is over. The finish order (`finishOrder`) is the winner first, then by
      exit episode, finalists above others in the same episode, by jury votes, then the order the results came in.
    - The lock (`closesAt`, `closed`): the closing episode's `closedForPlay`, so whoever runs the game can keep it open or
      lock it early. For an episode the league hasn't made yet, the schedule's air time is used, except in a league
      catching up at its own pace. It also closes once the episode has results, or the game is over. Nothing settles a
      question before it closes, so the lock never reads the results. With no finale listed, a finale question closes at
      the game's end.
    - `episodeNow` (this week's: the one picks and lineups are for).
    - `grade(state, answers)`: only the copy's own players, so a late joiner someone can't see counts for nothing.
    - `finaleAnswers` and `finalePoints`: **finale predictions are settled by the results**, no longer by the result
      typed in by hand. `finaleActual` gives the results' answer.
    - `addSideLayers` scores the finale through it.
    - `BetLogic.closed`: a side bet locks at its episode's start, and `add`, `addPrediction` and `removePrediction` refuse
      after it (A4's Noticed item).
    - `FinaleLogic.setActual*` are gone. Computer players make no finale picks once this week's episode has started.
  - **Storage** (migration 0200): `game_answers` (league, player, question, episode (0 for once), answer as jsonb, who
    wrote it), keyed on all four, cascading with the league, backed up (`backup-common.js`, its slice in
    `backup-leagues.js`). Graded on read, never stored.
  - **The server.**
    - `answers.ts`: `GET` and `POST` `/api/seasons/[id]/answers?league=`, for one of your games on the season (`gamesHere`
      now takes `only`). The GET gives this week's questions (the game's, not your mark's) and the game's own, each with:
      its status (open, behind: see the episode before it first, or closed), when it closes, who you can name, yours, and
      how many have answered. Once it closes: everyone's answers, you first, and how each stands at your mark.
    - Nobody else's answer leaves the server before the lock.
    - The POST refuses 409 (locked, or not this week's episode), 403 (naming someone while behind) and 400 (a wrong
      answer). A game of questions' answers are written in one transaction, the lock checked again as they're written. A
      draft's finale picks go into its state through the engine.
    - `questionContext` builds the show's ctx for `setGame`: the moments of the rules it plays by, by the ids its results
      record, whether its results say who goes home, whether anyone wins, who settles its calls, and its phases.
    - `answer-points.ts`: `leagueAnswers` gives the Games tab a game of questions ranked by points (`game-view.ts tableOf`
      treats it as Weekly Calls), `answerStanding` gives the hub its standing now and an episode back (its answers read
      once), `finaleEpisode`, and `finaleLock` (classic's finale routes).
  - **Classic:**
    - Finale predictions lock when the season's last episode starts (409).
    - Typing in the result is refused (409 "The results settle the finale now").
    - The finale panel shows the results' final three and winner, read only.
    - The bet routes refuse after the lock (`game-writes.ts refuseLockedBet`).
    - Classic's game-type list leaves out `questions`.
  - **Where a game of questions is like Weekly Calls:**
    - Computer players don't play it.
    - Classic's league list leaves it out.
    - Its name is "Questions" (`league-season.ts`).
    - Your moves gives it no tab (its own screen is part 2's).
    - Its table rows don't open, and your line says points.
    - Run it back skips it (no preset to start again).
  - **What reads differently** (each intended):
    - Finale predictions are graded against the results, not a result typed in. This lane's copy has none typed in, nor
      any finale picks.
    - Finale predictions and side bets lock.
    - A pool, Weekly Calls and Weekly Bingo no longer offer or mention side bets they never scored.
    - Weekly Calls' and the finale's spec shape changed. This lane's nine carried specs (stored by A2 in the old shape) all
      drifted. `game-specs-flag.js on` carried them again, and they now read as their fields.
  - **The proof** (as A2's): the pre-A4 engine (ee0942ca's `src/lib/game`, extracted) against today's, on this lane's 9
    leagues and 10 played demos (every kind, part-played and to the end, the drafts with finale predictions scoring 7, 4
    and 2). Every reading and score was the same, after every episode, with the old engine given the results' answer as
    the typed-in result: PASS. A one-off script, kept out of the repo as A2's was.
  - **Tests:**
    - `tests/answers.test.js`, 8 tests: the shape; the data rule for every question through `setGame`; each kind graded; a
      game of questions at two viewers' marks, its table and How it works; the lock, including a league catching up; side
      bets' lock and where they count; finale predictions against the pre-A4 formula, spoiler-safe, the finish order by
      jury votes; Weekly Calls.
    - `game-spec.test.js` updated: no Predictions line on a pool's, Weekly Calls' or Bingo's sheet; bets as the engine reads
      them; the questions field.
    - `npm test` 791.
  - **Browser.** `scripts/dev-test/check-questions.js` is new, on new-fixture.js; 47 PASS at 390. It covers:
    - jordan's Survival Pool, joined by riley and sam, made a game of questions through `setGame`: refused without the
      show's moments, written with them.
    - Answering: the refusals, the privacy, sam behind, the lock at Episode 6's start.
    - Episode 6's results graded only once jordan has seen it: 3 points, the Games tab ranks by them, riley at 5 sees none.
    - The flag's check on it.
    - A side bet guessed before Episode 6 and refused after; the pool's Rules sheet without Predictions.
    - The Outlast's finale predictions through classic and the answers API, and typing the result in refused.
    - In the browser: the table, its Rules sheet and the pool's.
    - Re-runs after the code review's fixes: `check-new-start-game.js` 75, `check-new-backstage-ii.js` 149,
      `check-phase-starts.js` 58.
    - `game-specs-flag.js status`: on, 9 of 9 carry their spec, none drifted. `check` PASS.
  - **Code review** (`/code-review`, before the commit).
    - Taken:
      - A league catching up was locked on the broadcast's clock.
      - "This week" came from the viewer's cut view, so anyone behind got a long-locked episode.
      - "Closed once settled" told someone behind that something had been settled. Now nothing settles before its lock,
        and only who wins or the final few wait for the finale.
      - Late joiners' answers counted for others.
      - New rules refused existing leagues' finale predictions (on a span, big points).
      - Classic still offered bets after their lock, or read the switch directly.
      - Answer writes weren't one transaction.
      - Computer players could make finale picks during the finale.
      - Classic offered `questions` in its type list, and Run it back offered it.
      - Scoring worked out every episode's facts for the finale on every read.
      - The answers API loaded every game on the season.
      - Duplicate helpers; dead setters; an unused index.
    - Declined: a finale result typed in by hand still counts for nothing when the results never record a winner. Only data
      settles it (the user's rule), and the season sync records the winner's exit.
  - **For the merge:** 0200 is rehearsed with the other migrations, and goes in HOSTING.md (`game_answers`: a row per
    answer, tiny; nothing polls or runs on a schedule). Production's flag is off, so no carried spec there has A2's shape;
    if it were turned on before this merges, `game-specs-flag.js on` would carry them again.
  - **For part 2** (impeccable `shape` first, at 390, then build):
    - Answering a game's questions: where they live (Tonight's card, Your moves' tab, the dock), the lock's countdown,
      who you can name without spoiling anyone behind, and taking an answer back.
    - Results: how each question went and the couch's answers, at your mark.
    - Finale predictions in the new design (on the same API).
    - Starting a game of questions with taps (its questions from the show's moments, through `questionContext`), its name,
      and Backstage's view of it.
    - The home's due moves for it.

  **As built (A4 part 2, 2026-10-28, on `engine`, not merged; no migration).** Built before the hardened plan moved
  answering and results on screen to the UI track (U1): U1 takes these screens as built. One session. Master hadn't moved since A4 part 1
  (791 tests then).
  - **Designed first** (impeccable `shape`, at 390, in the Lower Third system; the session loop can't ask, so the brief's
    decisions were inferred from this plan and are the session's): Operate mode inside the established world, Call it's sheet
    (`calls.tsx`) as the pattern.
  - **Its name: Prediction Sheet** (`league-season.ts`; lime `#9bc25b` in `games.ts`, the one colour the other five leave; How each
    game works in Settings' Help and the solo hub). Finale predictions are the same kind of thing now (data-settled questions), so
    the names sit together.
  - **The sheet** (`src/new/show/questions.tsx`, `openSheet`, hosted in the signed-in layout), one for a Prediction Sheet's
    questions and a draft's finale predictions, on part 1's API:
    - Before they lock: grouped by when they lock ("Episode 6 · Locks Sat 8:00 PM · in 3 days", ticking inside the last day;
      "For the season"; "The finale"), each with its points.
    - The controls: a person as faces (who's still in at your mark, from the server; pick-N counts "2 of 3 named" and refuses
      a fourth), yes or no, over or under and choices as chips, a number on a stepper.
    - A tap again takes an answer back; Save sends what changed (null for one taken back): "Saved · change until Sat 8:00 PM".
    - Someone behind sees "Who's still in decides this one, so it waits until you've seen Episode 5" where the faces would
      be; a late joiner catching up, "Catch up on the game first" (the server now marks every open question of theirs
      behind, `catchUp` null, since the POST refuses them).
    - Once locked: everyone's answers, yours first, with faces; once settled at your mark, what was right ("Cristian went
      home" with the face, "It happened", "The final 3: ..."), ticks and crosses, what each earned, and your points on a plate
      ("Your sheet · 3 points · 2 of 2 right"). Waiting says why: "See Episode 6 to find out" past your mark (the read's new
      `mark`), "Settles when the season ends" for the season's.
    - The read gained `cast` (every castaway's name and face, no status, for answers naming someone who's gone), `mark`,
      each question's `settle` (the words for what was right) and each person's `userId` (their face).
  - **Where it lives:**
    - The home's moves (`answers.ts questionMoves`, beside Weekly Calls' in `/api/me/home`): "Fill in your sheet (3
      questions)", "Finish your sheet (1 to go)", with its lock.
    - Tonight's required card ("Fill it in", the one yellow when it's first), its done card ("Your sheet is in · change
      until ..."), the dock's words ("your sheet") and the hub's Up next ("your Survivor sheet locks Sat 8:00 PM").
    - The Games tab's This week, which stands in for Call it whenever a sheet asks about that episode; Tonight's Extras
      hides Call it the same way.
    - A draft's finale predictions are an Extras row while they're open, as before an optional extra, never a move.
    - Results: Tonight's Extras ("Episode 6: your sheet, 3 points") and the episode page (under the game's name).
    - The Games read carries each game's `sheet` (`GameView.sheet`, a `SheetMove`: this week's open count, answered,
      lock, behind, finale), so the cards and rows cost no read of their own.
  - **Its night and the reveal:**
    - Episodes' "Your night" and the reveal's part read a sheet's answers (`answer-points.ts sheetNights`, through
      `episode-view.ts nightIn`/`revealIn`'s new optional `sheet`): "+3 pts · 2 of 2 right", "It didn't count" when nobody
      went home, "Its questions are for the season" for a sheet with none per episode.
    - The reveal's table moves by its points (`leagueAnswers` at the marks before and after); before this step it read
      "All safe · 0 of 0 still in" and a table of zeros.
    - A failed read of the answers never fails the reveal (its mark has moved already) and is never called a miss.
  - **Start a game** (`start-game.ts`, `start-game.tsx`): a Prediction Sheet is offered, last, on a competition or a series
    whose moments research answers (not a sport's, whose settles are the sports branch's, nor a talk show's, the couch's
    word). **The questions** are toggles from the show's moments (`src/lib/game/question-choices.ts`, pure, with `contextOf`
    moved there from answers.ts):
    - Who goes home? (each episode, 2 points, on), up to three of the show's most callable research moments (calls.ts
      `callMoments`; the first on, 1 point), Who goes home first? (once, 2), Who wins? (once, 5, on) and Who makes the final
      three? (once, three names, 1 each).
    - Each offered only if `specProblems` passes it against the show's ctx, so the data-can-settle rule holds for every
      question offered.
    - The season's questions only in a game that runs to the season's end (dimmed otherwise; defaults drop them over a span).
    - At least one stays on.
    - POST `questions` (ids of those offered; none: the defaults, or Run it back's), written once through
      `RosterLogic.setGame` with that ctx, on Survival Pool's type as its base (nothing held, results in its state;
      `rank: total` set with it).
    - Run it back keeps a sheet's questions (`again.questions`).
  - **Backstage › Game settings** (`backstage-games.ts`): a sheet's questions, its own on, the rest the show can ask off,
    each line in the show's word for an episode. A Commissioner switches them until the game starts, never while it's
    locked down; it's read only after that, saying why. `questionsWrite`, PATCH `{ leagueId, questions }`, goes through
    `setGame` with the show's ctx, with a line in Recent changes; Undo is the toast's (the list sent back), since a set of
    questions can only be written with the ctx. Its Who can join says there are no teams.
  - **Tests:**
    - `tests/answers.test.js` +2: the choices for every built-in and sample show, the data rule, spans, written through
      `setGame`; the night line.
    - `npm test` 793.
  - **Browser:** `scripts/dev-test/check-questions.js` grew part 2's (see its header) and a `--theme=light|dark` option: 97
    PASS at 390 on Night, and again on Studio.
    - Start a game's options and refusals; jordan starts one by taps; the home's moves, the Games read's sheet, sam behind.
    - Backstage's list, add and take off, the refusals, Recent changes, Run it back's options.
    - The dock and This week, then the sheet: answer, take back, save, the done card.
    - After the lock and the results: the night line, riley's reveal (her part, the table moving), the results sheet from
      Extras, finale predictions from Extras into the league's state, the episode page, and Backstage read only.
  - **Re-run, after the code review's fixes:**
    - `check-new-start-game.js` 75 (its game lists now include the sheet: four on a competition, two on a series).
    - `check-new-backstage-ii.js` 149, `check-phase-starts.js` 58, `check-new-show.js` 81, `check-new-reveal.js` 49.
    - `game-specs-flag.js status`: on, 9 of 9 carry their spec, none drifted; `check` PASS.
    - impeccable's detector: advisories only (type sizes, the same as Call it's sheet).
  - **Code review** (`/code-review`, before the commit).
    - Taken:
      - A late joiner catching up was offered questions the POST refuses.
      - A night where nobody went home stayed "Waiting" for good.
      - The reveal could fail after the mark had moved.
      - Call it was hidden by any sheet, not one asking that episode, and This week skipped even the span.
      - Run it back on a sheet 404'd; it now runs it back with its questions.
      - The defaults over a span were refused instead of dropping the season's questions.
      - A season-only sheet read as a miss every night.
      - Errors were swallowed with nothing logged.
      - Backstage worded the episode differently from Start a game.
      - The home read each sheet one after another (now at once).
      - The Games read read a sheet's answers twice and a draft's finale for nothing.
      - Rows fetched what the Games read already had.
      - The copy's rules were read again by id.
      - Weekly Calls' type as the base (now Survival Pool's, with `rank: total`, which a unit test caught).
    - Declined: none.
  - **For the merge:** no migration. HOSTING.md: the home read now reads each Prediction Sheet's answers (at once, only for
    someone who plays one), the Games read a sheet's once, the reveal its points; nothing new polls or runs.

**The engine track after A4** (2026-10-28: the engine to its full target, "Where the engine is headed", before the UI). Every
step proves itself the same way: unit tests on specs; the tracker (A5) regenerated, and no row it marks ✅ without a spec that
passes `specProblems` and `specWaitsFor`; the golden replays (every taped season through every game it already plays scores
exactly as before the step: the playtest lane's `playtest.js`); and a zt- fixture played through the engine's own API, no
screens. Each step names the research data it needs and checks the tapes have it.
- **A5. The capability tracker** (small, first). `tests/fixtures/engine-capabilities.json` holds the dials' values and the
  stretch requests, each with its dial, the spec it needs (once the schema can say it) or the step that brings it.
  `scripts/engine-capabilities.js` writes `docs/ENGINE-CAPABILITIES.md`: both tables, each row ✅ plays now, ⏳ its step, 🆕 not
  planned, or ❓ waits on a rule decision. A unit test keeps it honest. Every later step regenerates and commits it, so the git
  history is the progress. **One list:** the playtest lane's words corpus (rewritten for a page) and the stretch requests
  become this file, and G1's bank and the recorder read it, so the requests never drift apart.
  **The engine lab** (decided 2026-10-28): an admin-only, plain page on the desk (`/desk/lab`, no design work). Pick a season, then
  paste a spec or pick a tracker request: it shows the validator's verdict (`specProblems`, `specWaitsFor`), the sentence and How
  it works (`describeSpec`), the tracker row's status, and "Start it as a test game" on a zt- fixture or the test couch. G1 plugs
  the GPT into it later (words, the draft, our check, the spec), so every piece can be tried as it lands, long before U.
  **As built (A5, 2026-10-28, on `engine`, not merged; no migration).** One session, after `lane.js sync engine` brought this
  plan in (877 tests then).
  - **The tracker:** `tests/fixtures/engine-capabilities.json`, kept by hand. Its rows:
    - the nine dials' values (91);
    - the worked examples typed on a show's page (6);
    - the stretch requests (63);
    - the words corpus, all 104 moved whole from the playtest lane's `start-a-game-words.json` (now deleted).
    Each row says what it needs:
    - a `spec` (once the schema can say it);
    - a `step` (A6..A15, L1..L6, G1, ...);
    - a rule to `decide`;
    - `planned: false`;
    - or `gpt` (not a game: a typo, a season that never was, two games at once, the GPT's to ask or refuse).
  - **Each request is typed on a page.** `page` is the show and season (or the sport and event), and its `rulebook` names the
    rules its specs are checked against: a built-in, one of `rulebook-samples.js`, or a stand-in of the same kind
    (`checkedAs`: Dancing with the Stars against The Amazing Race's, Love Island against Survivor's). The corpus keeps each
    request's expected reading for G1's bank and the recorder.
  - **The status is worked out, never written** (`src/lib/game/game-spec/capabilities.js`, pure: `statusOf`, `rowProblems`,
    `rowsOf`, `pageName`; `src/lib/game/capability-rows.ts`: `pageCtx`, shared by the doc and the lab):
    - ✅ plays now when the spec passes `specProblems` with its page's ctx and `specWaitsFor`;
    - ⏳ its step;
    - 🆕 not planned;
    - ❓ waits on a rule decision;
    - 💬 the GPT's.
    So a row turns ✅ by itself once its step lands and its spec passes.
  - **`scripts/engine-capabilities.js`** writes `docs/ENGINE-CAPABILITIES.md`. Each ✅ row reads in the engine's own words
    (`describeSpec`), saying when it was checked against a stand-in. Every step from here regenerates and commits it.
    `--check` exits 1 when it's out of date.
  - **Now:** 89 ✅ · 150 ⏳ · 1 🆕 · 1 ❓ · 23 💬, of 264. Waiting: A6 14, A7 11, A8 11, A9 20, A10 16, A11 14, A12 9, A13 3,
    A14 14, A15 15, L3 7, L4 13, G1 3.
  - **One list.** `tapes.js`, `tapes-words.js` (its new `wordsCorpus()`, which tapes.js uses) and `tests/tapes.test.js` read
    the tracker's corpus; PLAN-playtests.md says where it went.
  - **Found on the way:** a plain Weekly Lineup on Below Deck's sample rules is refused as a new spec, because two of its
    scoring moments (a hookup, crying on camera) are the couch's word. The two corpus rows score them 0, which is our check's
    offer.
  - **The engine lab**, `/desk/lab`, admin-only, plain, in its own files:
    - the route `src/app/(new)/(in)/desk/lab/page.tsx`, a static segment beside the desk's catch-all, so no desk file changed;
    - the screen `src/new/lab/lab.tsx`; the server `src/lib/server/engine-lab.ts`; `GET/POST /api/desk/lab` (`requireDesk`);
    - `routes.ts` gains one line, so back goes up to the desk.
  - **What the lab does:**
    - Pick a season that's a game, then a tracker row (filter by id, words or step; tagged with its status) or paste a spec.
    - Check gives the verdict on that season's own rules: what's wrong (the data rule with its ctx), what waits, the league
      type it plays as, the sentence, How it works and the details, and the row's status there.
    - Start it as a test game puts it on the admin's test couch (`test_couches.owner_id`) or, locally, a zt- fixture's couch
      they're on (made by a `zt_` account). Never a real couch.
    - The game goes through `RosterLogic.setGame` with the rules it plays by there (a couch's own copy, else the season's).
      With no span it starts with the next episode to air, as Start a game's do (`startFrom`, now exported).
    - It's named "Lab · Weekly Lineup", with a line in its Recent changes, followed, and a refused setup takes its half-made
      league away.
    - G1 plugs the GPT into it.
  - **Tests:** `tests/engine-capabilities.test.js`, 4 tests:
    - every row says what it needs, and a spec always has a page's rules;
    - no ✅ without a passing spec, and a spec that doesn't pass yet names its step;
    - each dial has something that plays now;
    - the status is the engine's (incl. Below Deck's couch moments);
    - the doc is current.
    `npm test` 881.
  - **Browser:** `scripts/dev-test/check-engine-lab.js` (new, on new-fixture.js with the desk's own admin), 21 PASS at 390:
    - the options, and the 403 for someone who isn't an admin;
    - a ✅ dial spec plays on ZT Survivor 51, in words, ✅ there;
    - a made-up moment refused, a sport's stats waiting, bad JSON a 400;
    - start: refused for a spec that doesn't play and on another couch; made on the zt- couch (a game of questions, the admin
      its Commissioner, its spec in step, from Episode 6, its Recent changes line);
    - in the browser: the row picked and checked, started, a row with no spec emptying the box, a refused spec saying why.
  - **After master's merge** (`lane.js sync engine`: S1, S2, the playtest tools, the plan), the batch again, all passing:
    `check-questions.js` 97, `check-new-start-game.js` 75, `check-new-backstage-ii.js` 149, `check-phase-starts.js` 58,
    `check-new-show.js` 81, `check-new-reveal.js` 49, `check-engine-lab.js` 21. `game-specs-flag.js status`: on, 9 of 9, none
    drifted.
  - **Code review** (`/code-review`, before the commit).
    - Taken:
      - the admin isn't on their own test couch, so it's found by its owner;
      - fixture couches by a `zt_` maker, not their name;
      - a refused setup's half-made league is cleaned up;
      - a row with no spec no longer keeps the last row's spec;
      - shape-only ✅ rows now need a page's rules (stand-ins), and Terrace House's "who leaves next" became the GPT's;
      - a test game starts with the next episode;
      - its Recent changes line and follow;
      - back goes to the desk;
      - the lab's tags are each row's real status;
      - one page name, one `rowsOf`, one corpus reader;
      - the couch's own rules;
      - no double season read;
      - dead code;
      - PLAYTESTS' mentions of the deleted file.
    - Declined: one shared helper for Start a game's and the lab's league setup. Start a game's is couch UX: linking,
      Tell the couch, Run it back, computer players. The lab's is a plain test game. Both go through `makeLeague` and
      `setGame`, and the parts that matter (cleanup, Recent changes, the next episode, the couch's rules) are in both.
- **A6. Questions about who and about each.** Person and group answers settled by a moment in the episode ("Which tribe wins
  immunity?", "Who finds an idol?"), from research's per-person moments and each episode's groups (after swaps); one question
  asked of each person still in, an answer per person ("each couple's score"), counting as one of the 12; a person's number
  from research (`judgesScore`) for number and over/under answers.

  **As built (A6, 2026-10-28, on `engine`, not merged; no migration).** One session, after `lane.js sync engine` brought in
  master's desk-parity and bingo work (882 tests then).
  - **What research records, mapped first.**
    - A moment reaches a league as a scoring event on a person (`{ type, castawayId, units? }`). A per-unit moment carries
      research's number as its units: a judges'-score segment builds `<segment>PerPoint` (Dancing with the Stars' judges'
      points), so **a person's number is a per-unit moment's count for them**, accepted, reveal-gated and spoiler-safe like
      every other result. No new data path.
    - Groups after a swap: research's `newGroup` stages a `group` decision, which records `episode.groups` (GroupLogic). The
      spoiler view clears a hidden episode's groups and works each castaway's group out again.
    - Secret roles: the cast's starting roles go into Episode 1's roles, recruits into their episode's (RoleLogic).
  - **The schema** (`schema.js`):
    - A new answer, `group` (a tribe, a team; `pick` of them, like a person).
    - New settles: `moment` takes `who` (who it happened to; a group answer, the groups they were on that episode) and `most`
      (who it happened to most, ties all). `results` takes `stays` (who didn't go home: an episode's, asked each). A new
      settle, `role`: `who` (who held it: in the episode, or ever in the game), `end` (who held it among those still in at the
      end: after the episode, or in at the game's last episode) and `count` (how many of them).
    - `each: 'person'`: one question about each person still in when it closes, answered `{ castawayId: answer }`, still one
      of the 12. It takes a yes or no, a number, an over/under or a choice, settled for each by their own moment (happened,
      count) or whether they went home or stayed (`EACH_SETTLES_FOR`). It closes at the start.
    - The data rule: a role is one of the show's (`ctx.roles`, its secret-role twists'); a group answer needs a cast in groups
      (`ctx.grouped`); a moment and results as before. `contextOf` gives both.
    - A plain yes or no stays "whether a moment happened": "will anyone go home tonight?" is Survivor's `votedOut` moment.
  - **The grader** (`answers.js`): a moment over the game (who, most) is known once the game is over. A group answer is off
    when nobody it happened to was on a group, never a question nobody can get right. A choice is a count's range only when a
    count settles it, else names (people's, and their groups'). A question about each person grades each one on its own: a
    number the closest on each, ties all; its points for each one right.
  - **The engine** (`AnswerLogic.facts`): for each of the game's episodes, who was still in at its start, each person's group
    in it (where they started, then each change in episode order), and, once its full results are in, who each moment happened
    to and how many times, and everyone's role as of it (one pass). From the state it's given, so the viewer's copy names no
    swap, role or result past their mark.
  - **Storage:** none new. An answer about each person is a map in `game_answers.answer` (jsonb).
  - **The server** (`answers.ts`): a group answer's faces are the groups someone still in is on, as you've seen them; a
    question about each person's are who's still in. Both wait until you've seen the episode before, like a person answer. The
    read names the groups (`groups`): only those anyone in your copy is on, since a tribe a later swap or the merge made is in
    the league's list from the moment it's recorded.
  - **Words:** How it works says a question about each person ("Answer for each castaway still in: the closest on each wins 1
    point") and a group's picks.
  - **The screens are U1's.** The Prediction Sheet tolerates the new kinds: a group answer as faces (initials), a question about
    each person held back with a line ("answered for each of the 13 still in, on a screen still to come"). Start a game doesn't
    offer A6's kinds (`question-choices.ts` is unchanged but for the ctx): nothing could answer them on screen yet.
  - **A sample rulebook** for Dancing with the Stars (`rulebook-samples.js` `dancing`), trimmed from the one the bot wrote for
    season 34 (in the tapes; its viewers' vote "decided a score", which a vote can't, so it puts couples at risk). Its judges'
    score is `judgesScoringPerPoint`. The tracker's Dancing with the Stars rows are checked against it now, not The Amazing
    Race's.
  - **The tracker:** specs for A6's 14 rows, all ✅: the dials (who, which group, each person, a person's number), the worked
    examples (the tribe winner and who goes home; each couple's score), and the corpus (a Traitor who won't get caught, who
    wins the leg, star baker, which couples stay, who dies, who gets a rose, how many Traitors make the end, who the Traitors
    are). Stand-ins, said in the doc: Great British Bake Off and Married at First Sight against Dancing with the Stars', The
    White Lotus against Pluribus', The Bachelor against Survivor's. **Now: 103 ✅** (was 89) · 136 ⏳ · 1 🆕 · 1 ❓ · 23 💬.
  - **Research data the tapes lack:** Survivor 49's tapes predate `newGroup`, so a swap there isn't on tape (The Challenge 41's
    is). Dancing with the Stars 34's research asked the stored format's `judgesScore`, which no moment counts; a couch's season
    on the compiled rulebook asks `judgesScoringScore`, which does. The Traitors 4's roles are there.
  - **Tests:** `tests/answers-who.test.js` (new, 4): the shape and the data rule for each new part; grading on facts (a swap
    counting from its own episode, most with ties, over the game, who stays, each person's number and yes or no, a group off);
    a league's facts (groups after a swap at two viewers' marks, a per-unit count, How it works); The Traitors' roles (a recruit,
    who's left, how many, nothing before the end for someone behind). `engine-capabilities.test.js`: the waiting example is an
    answer no step builds now. `npm test` 886.
  - **Browser and API:** `scripts/dev-test/check-questions-who.js` (new, on new-fixture.js), 42 PASS at 390: a game of four
    questions written through `setGame` with the show's ctx (a Traitors question refused: no roles); the faces (three tribes,
    the 13 still in); seven refusals; sam behind on all four; the sheet in the browser; the lock; Episode 6's results with a swap
    onto Savu and one onto a new tribe; graded at each mark (jordan 7, riley none, and none of the new tribe's name until she's
    seen it); the Games tab; the flag's check. `check-engine-lab.js` grew A6's specs (two play on ZT Survivor 51, a Traitors
    question and each couple's score refused there, a tribe question started as a test game): 27 PASS.
  - **Re-runs:** `check-questions.js` 97, `check-new-start-game.js` 75, `check-phase-starts.js` 58, `check-new-show.js` 81.
  - **The main session's fix** (the A1–A4 merge's checks): `check-questions.js` and `check-phase-starts.js` read the game-specs
    flag first. Off, a game's spec is what its fields say (`specOf`), the carried-spec checks print a NOTE, and nothing else
    changes; on, they assert as before. Proven both ways: with the flag turned off in this lane's database, 70 and 45 PASS
    (`--api`) with their NOTEs; on again (9 of 9 carry their spec, none drifted, `check` PASS), 97 and 58.
  - **Golden replays:** every taped season through every game it plays (`playtest.js run`, from a copy of the tapes:
    `TAPES_DIR`; the four this lane didn't have loaded first with `tapes.js load`), each season's leagues kept and read by the
    engine before A6 and after it, from the same states: as nobody, and as each seat, at every mark (nothing seen, each
    episode, everything), the game, its span, every score, this week's episode, finale predictions and the results' answer.
    Survivor 49 (30 games), the Traitors 4 (22), The Challenge 41 (22), Dancing with the Stars 34 (22), Below Deck 12 (20):
    **116 games, 11,981 reads, every one the same.** Engine against engine, because two runs of the replays differ by
    themselves (Noticed). A one-off, kept out of the repo as A2's and A4's were.
  - **`game-specs-flag.js`:** `status` on, 9 of 9, none drifted; `check` PASS.
  - **Code review** (`/code-review`, before the commit).
    - Taken:
      - a plain yes or no settled by who went home could never be right (it's a moment's now; `EACH_SETTLES_FOR` for each
        person);
      - a choice settled by who it happened to most was matched against count ranges;
      - the read named every tribe, a later swap's too (a spoiler);
      - a group answer whose leaver was on no group read as settled with nobody right (off now);
      - `in` read without a guard;
      - roles worked out per person per episode (one pass now);
      - the names list in three places, the per-person answers twice;
      - the sheet's "1 of 2 named" for a group.
    - Declined: none.
- **A7. Time.** Windows instead of only "each episode" or "once": every N episodes, within N, by phase; which episode something
  happens in (settled by phases and results); a person's own lock time when they watch late (spoiler-safe).
- **A8. More answers.** An order (the boot order, a leaderboard), confidence (a ranking with weights), spreading chips, a wager,
  pairs (who outlasts whom), a vote split (5-2-1).
- **A9. Scoring that combines.** Per question: split the pot, the only right answer, roll over, multiply, shrink with time,
  double or nothing. Per lineup: a captain who scores double, best ball (your best N count), scoring in reverse. Points per
  bingo line.
- **A10. Pools and drafts.** A pool's lives, buybacks and two-pick nights; a draft slot per group (one per tribe, a guy and a
  girl); auction and a salary cap; keepers across seasons; teams two people share.
- **A11. Winning, and who plays with whom.** A race (first to N ends the game), co-op (the group against the show, with shared
  lives), head-to-head with playoffs, teams of players, players knocked out each week (guillotine) or cut at a phase,
  handicaps, late joiners.
- **A12. Stages.** A game made of phases or mini-games, each with its own rules and an overall: a second draft at the merge, a
  season of mini-games, a game that scores two ways (bingo lines plus answers), one game across two shows.
- **A13. Trivia and episode facts.** Trivia questions settled by the episode's trivia key (the bot's trivia research, written
  and checked as now); episode facts (who said the title quote) through new research questions rated reliable (Our check).
- **A14. The players' own mechanics** (allowed 2026-10-28, with the Decisions table's guardrails): votes among the players,
  matching the majority, the top scorer's twist, a rotating host's questions (still data-settled), secret roles, bounties, the
  bot's call as an opponent; and numbers from vetted outside sources (an episode's TVmaze rating, settled once at a fixed
  moment). Answers stay hidden until the lock once they depend on each other.
- **A15. Live and replay** (with the watch along, docs/PLAN-couch-and-episode-night.md §6, and the sports branch's
  `GameClock`). It needs A7. The watch along is in its infancy (the user, 2026-10-28): its concept, how it's built and how it
  connects to games are all open, so A15 is where the games shape it, not only where they plug into it.
  - **One clock for every game:** episodes (today), the runtime inside an episode (the watch along's clock), and plays (sports,
    timestamped). A question's opening and closing can name any of them: "minute 30", "the last 10 minutes", "the next ad
    break" (live TV), "this at-bat".
  - **Each viewer's clock:** live (now), synced (the watch along: start, pause, nudge, ad breaks) or snapped (sports: tap the last
    play you saw). A person's lock is their own clock reaching the close, and every answer carries the runtime it was made at,
    so a call can be worth more the earlier it came.
  - **Settles stay data.** A runtime-pinned question about a show is settled by research after the episode: what happened, not
    when. In-episode timing settles only sports, from ESPN's timestamped plays. Show research has no timestamps. The watch
    along's first concept rejected "moment buttons" (tapping when something happens: spoiler-prone, and nobody does it); they
    come back only if a game needs them and the user allows players' own mechanics (the first open question).
  - **What a viewer sees stops at their clock:** other people's answers, results and standings appear as they reach them,
    biased late (the watch along's 30 s). Someone watching later can play against the couch's live answers, replayed as a
    ghost at the same runtime.
  - **Cost:** a show's live answers are small writes; sports' live scoring stays on the phone (the sports plan: nothing reaches
    our server while a game is live).
  - **Proof:** taped episodes replayed at 60x with made-up viewers, one live and one a day late, through the playtest lane's
    replay harness with clocks added: their locks, what each one sees, and their scores.
  - **What games could ask of the watch along** (ideas, for its redesign):
    - **A host's clock:** one person's clock drives the room, so a watch party moves together and nobody drifts.
    - **Games come to you while you watch:** live calls, quiz cards and bingo by segment appear on the watch along at their
      runtime, instead of in a separate tab.
    - **The ghost:** later viewers play against the couch's live answers at the same runtime, and see their reactions.
    - **A heat strip behind you:** where the couch reacted most, drawn only for the part you've already watched.
    - **Marks the episode itself gives:** opening credits, ad breaks and the end credits as anchors that games can use and a
      drifting clock can snap to.
    - **Joining a room late:** you start at the room's clock, and the games' answered questions show as "missed".

**R. Today's games on the new engine** (after the engine track, before the UI).
- **R1.** Today's five games and their extras (waivers, side bets, finale predictions, calls) rebuilt as compositions of the
  pieces: no `getLeagueType` branch left in scoring, no game type compared as a literal. Every league scores the same: the local
  copy, a replay of every taped season, and a Neon branch of production (from the user's terminal).
- **R2.** The game-specs flag on in production (the user's OK), then a week of watching every table.
- **R3.** The old type code goes: `LEAGUE_TYPES`, the literal comparisons (45 files), and the UI's flags, read from the spec.

**G. The Start-a-game GPT** (alongside the engine track; its screens are the UI track's).
- **G1. Words to a spec, no UI** (the ask and our check, above). It starts when A5 lands (the tracker's requests are its test
  set) and grows with the engine: the manual is generated from the spec's vocabulary, so each engine step teaches it.
  - The context pack, the engine's manual (generated from `VOCAB`) and the prompt.
  - `askBot` with search off and `priority`. In llm-browser-api, `Worker` gets a `PriorityQueue` and `/ask` takes
    `priority: "now"`; deployed to the VM with the user's OK.
  - The parser and repair (as `parseRulebookAnswer` does), our check, the reliability ask for a new show moment, and what's
    left to ask.
  - A bank of requests typed on a show's page (`tests/fixtures/game-words/`: page + words → draft → spec): the playtest lane's
    104-request corpus rewritten for a page, with the worked examples above. Run on the stand-in bot
    (`scripts/dev-test/fake-bot.js`), and `scripts/dev-test/check-game-words.js` against the real bot (writes nothing).
  - A daily cap per person (Make it a game's is 5).
- **G3. The GPT learns sports** (after the sports branch merges): teams and games from ESPN's schedule, stat words to the
  Sport's keys, sports settles, and the over/under line from ESPN's odds. The Red Sox and 76ers sentences pass end to end.

**U. The UI, last** ("it can get complicated": the user, 2026-10-28). Simple on top, powerful underneath (The wizard, above).
- **U0. Design.** Impeccable `shape`, then mocks in `.impeccable/mocks/start-a-game/` at 390: the wizard and everything listed
  under it above (was G0), answering questions and their results (was A4's), the live pieces with the watch along (A15), the
  sports screens (track L's: the scorebug, the live box score, the couch's play feed, players organised, the matchup, sync,
  each format's own; was the sports plan's step 0), and the few controls the pieces need. Everything else is reached by words.
  The user confirms before anything is built.
  **The sports screens' brief** (the sports plan's step 0 prompt, kept here 2026-10-28 so it isn't lost): phone first at 390 in
  the Lower Third flavour, bold choices that make organising and a fast workflow a pleasure. The live game on the show space
  (the scorebug, the live box score with the couch's players lit and their points ticking, the couch's play feed); the later
  watch's sync (Start, pause, ±30 s, "Tap the last play you saw"); the players list by team and position, sorted by stat chips,
  with a player sheet; one format first, head-to-head. Light inspiration from the MLB app, Yahoo Fantasy and Yahoo Sports. Ask
  the user before deciding anything the plan leaves open.
- **U1. Build.** The field and the wizard in Start a game, Start from a spec, Make it a game chained for a show that isn't set
  up (was G2); answering and results; the live and sports screens; checked at 390 on Night and Studio with a zt- fixture.

**L. Live sports:** the steps are in "Live sports in the same engine", above (L1–L6, the Sports lane).

**Suggested order** (revised 2026-10-28): S1 → S2 → A1 → A2 → A3 → A4 (all built or building), S3 once proven, then A5 (the
tracker) → A6 → … → A13 (A14 if allowed) → A15 → R1 → R2 → R3 → U0 → U1. Alongside: G1 from A5; track L in the Sports lane
(L1 and L2 any time; L3 and L4 as master gets A2 and each format's engine piece; L6 releases it), then G3. Run in lanes (next
section), it takes about half the calendar time.

## Running steps at the same time (lanes)

The user asked (2026-10-27) for the plan to say what can run at once, so work goes faster without losing quality. The idea: a
**lane** is one line of work. Each lane has its own folder (a git worktree), branch, local database, dev-server port and session
loop. Sessions in different lanes never share a file in flight, a database or a server. Within a lane, steps run one after
another, as today. `docs/PARALLEL-SESSIONS.md` has the setup.

| Lane | Folder (worktree) | Branch | Database | Port | Steps |
|---|---|---|---|---|---|
| Main | `reality-fantasy-leagues` | master | `reality_fantasy_leagues` | 3000 | the user's own work, merges, production fixes |
| Survivor | `../rfl-survivor` | `survivor-data` | `rfl_survivor` | 3001 | S1 → S2 → S3 |
| Engine | `../rfl-engine` | `engine` | `rfl_engine` | 3002 | A1 → A4, the engine track A5 → A14, then R1 → R3, then U1 |
| GPT words | `../rfl-gpt` | `gpt` | `rfl_gpt` | 3003 | G1, alongside the engine from A5 (the tracker's requests are its test set) |
| Sports | `../reality-fantasy-leagues-sports` | `sports` | `rfl_sports` | 3004 | track L: L1 (its spec parts once A2 is on master) and L2 now (**running since 2026-10-28**, in the playtest lane's place); L3 and L4 with the engine's pieces; L5; L6 releases it |
| Design | the main folder (the mocks in `.impeccable/mocks/` aren't in git) | – | – | – | U0 (last, the sports screens in it): with the user there, never unattended |
| Playtest | `../rfl-playtest` | `playtest` | `rfl_playtest` | 3005 | docs/PLAN-playtests.md: season tapes (recorded from the local bot) and replays of them (since 2026-10-28). **Its Claude sessions paused 2026-10-28** for the sports lane (its replays had paid off until the engine changes); the recorder keeps recording seasons (not the old-shape words) as a plain script, and its tools merge into master for the engine's golden replays |

**What can run alongside what:**

| Step | Needs first | Can run at the same time as |
|---|---|---|
| S1 | nothing | A1, L1, L2 |
| S2 | S1 | A1 or A2, G1, L1, L2 |
| S3 | S2, and two episodes proven on the test couch | A3, A4, G1; not while a step is mid-change in `state-logic.js` (S3 touches `formatOf`) |
| A1 | nothing | S1 or S2, L1, L2 |
| A2 | A1 | S2, G1, L1, L2 |
| A3, A4 | A2 (one after the other: both change `state-logic.js` and Start a game) | S3, G1, the sports branch |
| A5 → A14 | A4, one after another (each changes the spec and the engine) | S3, G1, the sports branch, playtests |
| R1 → R3 | the engine track (today's games are rebuilt from its pieces); R2 and R3 need the user's OK | G1, the sports branch |
| G1 | A5 (the tracker's requests are its test set; the manual grows as each engine step lands) | A6–A14, R, S, the sports branch |
| G3 | the sports branch merged | – |
| U0 | the engine's target settled (it designs for what the engine and the GPT can make) | anything (it needs the user, not a lane) |
| U1 | U0 and R | the sports branch |
| L1 (no spec parts), L2 | nothing (no UI: the screens are U's) | anything |
| L1's spec parts, L3, L4 | A2 on master, merged into `sports`; each L4 format, its engine piece (A8, A9, A11, A15) | G1, the engine track, S |
| L5 | L1 | anything |
| L6 (the release) | L1–L5, migrations checked against a production backup | – |
| Playtests (docs/PLAN-playtests.md) | nothing | anything: it only adds files, but holds the local bot while it records |

**Who gets the usage** (Claude's call, 2026-10-28; the user handed the main session the lane decisions and the sports track).
The weekly usage allowance limits how much gets done, not the number of lanes. By today's readings, a full 5-hour window is
about 12% of the week, so a week holds about eight full windows; two lanes running around the clock would use it up in about
three days. The loops stop at 90% of the week, so the user's own sessions keep the rest. So lanes are chosen, not added:
- **Always:** the Engine lane, the critical path (A5 → A14, then R).
- **The second slot:** the Sports lane until the desk's designs are approved (docs/PLAN-desk-parity.md). Its order: L1, then L2,
  then L1's spec parts and L3 once A1–A4 is on master and synced into `sports` (L5 meanwhile). Then the desk's build takes the
  slot, with sports paused at a part boundary, and sports takes it back whenever the desk lane waits on the user.
- **When there's room:** G1 (needs A5). A third lane only after a weekly reset, with the week mostly unused.
- **Never unattended:** design (the desk's, U0), merges into master, pushes.
- **Before a weekly reset, use what's left** (the user, 2026-10-28: "cranking it, safely"). The allowance doesn't carry over, so the
  main session fills the slots with work that's safe unattended. It doesn't stack more than the user's own session can bear by day,
  since a full 5-hour window pauses that session too, and it keeps the loops' 90% stop. On 2026-10-28 that meant the engine lane
  going on past A6 to A8, the A1–A4 merge prepared and checked in a throwaway worktree (`rfl-merge`, port 3006, branch
  `merge-engine`), and the desk's build as a lane once its first designs are approved.
The main session records each switch here.

**The rules that keep the quality:**
1. **One lane, one folder, one database, one port.** The dev-test fixtures (zt- rows) and migrations would collide on a shared
   database, and two checks on one server trip over each other (the testing bank's rule: never two checks on one fixture at
   once). A lane's `.env.local` points `AUTH_DATABASE_URL` at its own copy and `BETTER_AUTH_URL` at its own port, and its checks
   run with `BASE=http://localhost:<port>` (every `scripts/dev-test/` check reads both).
2. **Migration numbers by range**, as the new-design branch did with 0100: master 0155–0199, engine 0200–0249, GPT words
   0250–0279, survivor 0280–0299, sports 0300–0399, playtest 0400–0419. `db/migrate.js` runs them by name, so ranges never
   collide.
3. **A hot file has one lane at a time:** `state-logic.js` (the engine lane; S3 waits for a step boundary), `start-game.ts` and
   `start-game.tsx` (the engine lane: A2, A3, then U1), `db/episode-research.js` and the rulebook compiler (the survivor lane).
   A step that needs another lane's hot file waits for that lane's step to merge.
4. **Merge at step boundaries, never mid-step.** A lane merges master in when a step starts, and its finished step merges into
   master (with the user's OK) when it's safe to ship: S1, S2, A1, A2 behind its flag, G1. The sports branch stays a branch until
   its release, merging master in when it needs the spec.
5. **Each lane writes only its own docs mid-step:** its plan's Status and As built. HANDOFF.md, BACKLOG.md and the shared
   memories change at merge time, so lanes don't fight over them.
6. **Every step's checks, unchanged:** its unit tests, its browser check at 390 on its own server, and a code review of its diff
   (`/code-review`) before it merges. After merging master in, the full batch again. Opus 5.5 at xhigh in every lane.
7. **One real-bot check at a time** (the bot answers one question at a time); every other check uses the stand-in. While the
   playtest lane records season tapes, the local bot is that lane's.
8. **What waits for the user, however many lanes run:** production backups and Neon rehearsals, the game-specs flag (A2), the
   VM deploy (G1), Survivor 51's switch (S3), merges and pushes, and design reviews (U0, with the sports screens). The user's attention
   is the real limit, so **start with two lanes** (Survivor and Engine: S is time-bound, A is the longest path), add the sports
   lane's steps 0 and 2 when there's room, and the GPT words lane once A5 lands.
9. **Lanes share one usage window.** Three lanes at xhigh use it about three times as fast; each session loop pauses itself near
   the limit (`--pause-at`).

## Risks and open points

- **The UI comes last, so the engine's pieces have no screens for a while.** The tracker, the golden replays and the zt-
  fixtures are how each one is seen until then. Open: a plain, admin-only **engine lab** on the desk (type a request on a show's
  page and see the draft, our check, the spec and its sentence; start it as a test game), built with no design work, so the
  user can try each piece as it lands.
- **Every piece multiplies the ways a game can go wrong.** The golden replays are the regression suite: every taped season,
  through every game the engine already plays, must score exactly as before each step. The playtest lane keeps recording
  seasons for it.
- **The spec keeps growing.** `SPEC_VERSION` goes up with each step that changes its shape; every stored spec still reads,
  through a tested migration per version.
- **Scoring on read gets heavier** (split pots, co-op and head-to-head read every player's answers). Each step measures a
  league's read time on the local copy, and caches per episode if it needs to.
- **Answers that depend on each other** (matching the majority, splitting the pot) are hidden from the other players until the
  lock, or the game can be gamed.
- **Production's bot is signed out.** The VM's ChatGPT can be capped the way this PC's was (116 asks in about 3 hours,
  2026-10-28). The GPT's asks are short, there's a daily cap per person, and the taps make every game without it. Production's
  bot is never signed in to a personal account.
- **A person's own lock time** (watching late) has to stay spoiler-safe: nothing about the episode shows them before it, and
  their lock is still before they watch.
- **Live games trust the viewer's clock** (A15). Someone can pause, look ahead and answer late. Runtime locks make that a
  deliberate act rather than an accident, and the stakes stay social (no prizes), as everywhere in the app.
- **A sport's live result can change at the final** (a scoring change, a stat correction). The final saved once wins, and a
  game whose standings moved says so ("Updated with the final box score").
- **A show's events have no times** in research, so a live window tied to an event ("before tribal", "before the judges score
  this dance") can only be a runtime guess. The GPT says so and offers a runtime point instead ("the last 10 minutes").
- **The half-minute wait.** It's always the bot. U0 designs the wait, and the progress stream already exists. Even with the
  queue jump, a busy bot finishes the answer it's on first, which can take up to ~4 minutes.
- **The bot away** (the VM down, or ChatGPT's page changed): the field says so, and the taps still make every game.
- **Words are data.** The person's words go into the prompt marked as such. The answer can only describe a game, and we validate
  and resolve the spec ourselves: nothing the GPT makes goes beyond what the person could tap.
- **Spoilers.** The wizard never lists the cast (who's still in would spoil someone behind); the draft room shows it, as today.
- **Keeping the words.** Each ask (words, request, spec, started or not) is worth keeping for 30 days to grow the sentence bank.
  It's people's own text, so it never goes in the repo (it's public), and it goes in HOSTING.md.
- **Open, for their steps:** the reliability bar for a new research question (high only, or medium too); points per question by
  default; whether a game can be made with no couch (today: Start a couch first); what the GPT says for a sports format the
  branch hasn't built yet.

## Noticed, not fixed (from the maps, 2026-10-27)

- `maker-scoring.ts` lists compiled event ids but checks moment ids (59, 93-99 against 198-203), so Survivor's aliased ids would
  be refused, and `pointsOf` shows `{exclusive, shared}` points as one number. (S2.)
- Side bets have no lock (`BetLogic.addPrediction`, state-logic 3221-3229). (A4.)
- The comment at `state-logic.js` 460-462 ("always EliminationOrderScoringStrategy") is out of date, and `migrateLeagueState`
  backfills `replenishOrderBy` 'mostPoints' where the default is 'rolling' (3947 vs 3874). (A2.)
- Start a game's `SOON` branch is dead (`rulebook-fits.js` 25), and the Games tab's talk line still says "Coming with episode
  games" (`show/games.tsx` 402). (U1.)
- Sports games score from ChatGPT research, against "ChatGPT never for stats"; `research-asks.ts` 20-21 says a sport's results
  come from its sports data, which isn't built. (L3.)
- A sport's cast stops growing from ESPN once it's a game (`cast.ts` `castable`). (L1.)

From A1 (2026-10-27):
- Start a game's drafts start with waivers off (no replacements, windows only when opened). Classic's create flow, the
  practice couch and the commissioner tour apply Balanced's recommendation (`waiverRecommendation`). The presets record what
  Start a game does today. (A2 or G2, the user's call.)
- Every new game has side bets on (`defaultState`'s `bonusEnabled`), but only Outlast and Weekly Lineup score them. A Survival
  Pool, Weekly Calls and Weekly Bingo show "Predictions: ..." on the Rules sheet, and bets on episodes, that never count. (A4.)
- The Rules sheet (`game-rules.ts`) tells a sport's Survival Pool, which survives by scoring, "pick one you think stays in";
  `describeSpec` says "scores in it". It doesn't mention finale predictions when they're on, either. (A2, when the sheet reads
  `describeSpec`.)
- A league's `eventPoints` is `defaultState`'s copy of the default format's points, made before the show is known. This lane's
  Traitors league carries 26 Survivor ids (22 not zero), and a shadow league on researched rules 20 ids its rulebook doesn't
  have. They score nothing. (A2: validate a league's own with `opts.league`, or drop them when writing.)
- Classic's setup has no cap on a team (its stepper has a minimum only); Game settings caps it at 10, and at 8 starters and 6
  on the bench. A new spec gets Game settings' caps, a league's own none. (A2: one set of limits.)

Taken by A2 (2026-10-28): the stale comment, the replenishOrderBy backfill (kept, with why), the Rules sheet (describeSpec),
the points copy (a league's own is validated with `opts.league`; a game that doesn't score by moments no longer reads it),
one set of limits.

From A3 part 1 (2026-10-28):
- Run it back's "same length again" counts episodes, not nights: a span over a double-header night is two (BACKLOG item 10's
  last open line). (Whoever next touches spans.)
- Game settings' `span.starts` and `span.ends` still carry every later episode's title in the API, though the screen shows
  only numbers (the start sheet's are held back now). (Part 2, which touches the same read.)
- How it works' updates say "Ep" over each number whatever the show calls an episode (the screen's own label; the words now
  are the show's). (Whoever next touches How it works.)

Taken by A3 part 2 (2026-10-28): Game settings' starts and ends carry numbers only.

From A3 part 2 (2026-10-28):
- Outlast scores by place (the boot order) whatever its start: a castaway drafted early and voted out while the game waits for
  its phase, or before a later start, earns their place on your team. A pool and a lineup score nothing before the start.
  That was already so for part 1's later starts; whether Outlast should count only boots from its start is the user's call.
  (Whoever next touches Outlast's scoring.)
- A game settling at its phase tells everyone the phase has begun, whatever they've seen: its lineups open for that
  episode, and Game settings and Recent changes say "Starts with Merged, at Episode 9". It's what the game is, but someone
  behind learns the merge happened. (G0 or the user's call.)
- Undo of a start switched in Game settings puts back the start as it stood then, even if the desk moved the phase since;
  the next result's season sync settles it again. (Whoever next touches Undo.)
- Weekly Calls and Weekly Bingo can start at a phase (every preset can), but no talk show's rulebook has a second phase, so
  Start a game never offers one there yet. (G2, if a series gets phases.)
- A couch's own copy of the rules (Make it ours) keeps the phase starts it was made with: the desk confirms on the season's,
  and nothing passes them on, so the copy's scoring phase gates (its segments that wait for Merged) never learn when it
  began. A game's start now reads the season's under the copy's own; the scoring doesn't. (S2, or whoever next touches Make it
  ours.)

Taken by A4 part 1 (2026-10-28): side bets have no lock (the map's item), and Predictions shown on games that never score
them (A1's and A2's).

From A4 part 1 (2026-10-28):
- Finale predictions wait for the season's last episode by its schedule's episode count; a season whose count isn't known
  leaves them open until the season is over (classic had no lock at all). (Part 2, or whoever next touches the schedule.)
- Computer players don't answer a game of questions (they don't play it, as Weekly Calls), and a draft's computer players
  pick their finale once. (Part 2 or later.)
- Weekly Calls' calls lock at airtime, Call it's own rule: whoever runs the game can't keep them open past the start or lock
  them early, as its other moves can (they're a person's, across couches). (The user's call, if it matters.)
- A game's own questions beside a draft (anything but its finale predictions) aren't played yet: `specWaitsFor` says no game
  plays them, since a draft's scores live in its state and their answers in `game_answers`. (G2, if the GPT makes them.)
- Who finished second and third, two runner-ups with no jury votes recorded, falls to the order their results came in
  (`finishOrder`); a question asking for exactly second is only as good as that. (Whoever next touches the finale's results.)
- `state.finaleActual` is read by nothing now but stays in every league's state (types, `defaultState`, migrate, the spoiler
  guard's reset), as do the finale's actual routes, which answer 409 for an old phone's bundle. (Step C, with classic.)
- The hub's "Called it" accolade counts side bets only where they count now, so a pool's graded guesses no longer add to it.

Taken by A4 part 2 (2026-10-28): none of part 1's items (computer players still don't answer a Prediction Sheet).

From A4 part 2 (2026-10-28):
- The reminders (`db/reminders.js`) come from `actionItems` only, so nothing nudges anyone before a Prediction Sheet locks, and the
  sheet doesn't offer the reminder ask after a save (its picture is a lineup's or a pick's). (Whoever next touches reminders.)
- A question's points are fixed per kind (2, 1, 5, 1 each): neither Start a game nor Game settings changes them. (G2, if the GPT
  makes "5 points for who wins" from words.)
- A moment's question is its label asked ("Got an idol or advantage?"); a series' per-person moments can read oddly as an
  episode's yes or no ("In the episode?", off by default). (S2's words from each question, or whoever next touches
  `callMoments`.)
- The episode page still shows Call it's results for an episode a sheet asked about (only This week and Tonight's Extras stand
  the sheet in for Call it). (Whoever next touches Call it.)
- The hub's couch pages (power rankings, By the numbers) weren't looked at with a Prediction Sheet on the couch; its standings
  come from `answerStanding` (part 1). (The next hub pass.)

From A5 (2026-10-28):
- `describeSpec` calls a game of questions "A game" (not "A Prediction Sheet"), and an Outlast's or a lineup's sentence leaves out
  its finale predictions (How it works has them). (U0, or whoever next touches describe.js.)
- Start a game writes its Weekly Lineup without the show's ctx, so on rules with moments the couch answers (Below Deck's
  sample) it makes a game the GPT's check would refuse until those moments score 0. Which rule should a preset meet? (R1.)
- The lab isn't linked from the desk: its screens are being redesigned in the main folder, so it's reached at /desk/lab. (The
  desk's redesign.)
- The lab imports the tracker and the sample rulebooks from `tests/fixtures/`, so they ship in the app's bundle. Small; the
  tracker is the lab's source by design. (Whoever next touches the lab.)

From A6 (2026-10-28):
- The spoiler view (`SpoilerLogic.viewThrough`) clears a hidden episode's groups but keeps `state.tribes`, so a tribe a later
  swap or the merge made is in every viewer's copy by name. The answers read now names only the groups anyone in your copy is
  on; other reads of `state.tribes` (the board's tribe list, the cast pages) weren't looked at. (Whoever next touches the
  spoiler view.)
- A question about each person has no screen yet, and a group answer shows as initials (no tribe colour). Start a game doesn't
  offer A6's kinds. (U1.)
- `tapes.js load` refuses this lane's `.env.local` (production's bot is listed first), so a load needs
  `LLM_BROWSER_API_URL=http://127.0.0.1:8765` on the command; a loaded season gets this database's id while the tape's
  `season.json` keeps the recorder's, so `playtest.js run` can't find it (copySeason looks it up by the tape's id); and Below
  Deck 12's tape predates `notableTwist`, so its load stops at Episode 1 (playtest.js fills such fields; load doesn't). (The
  playtest lane's tools.)
- The replays aren't the same run to run (waiver auto-fills and computer players choose differently among equals: the playtest
  lane's floor), so a step's "scores exactly as before" is shown engine against engine on the same kept leagues (a one-off,
  below each As built). A `playtest.js golden` that keeps each season's leagues and reads them with two trees would make it a
  command. (R1, or the playtest lane.)

From A2 (2026-10-28):
- Start a game still makes a Weekly Lineup with `defaultState`'s copy of the points (a map), not the preset's null. A copy
  keeps the points it was made with; null follows the season's rulebook, so a desk fix to a moment's points reaches it.
  The GPT's games (G2) will start from presets: which should a game follow? (G2, the user's call.)
- Survival Pool, Weekly Calls and Weekly Bingo still show "Predictions" on the Rules sheet when side bets are on, which
  never count there (A1's item; A4).
- `MidSeasonLogic.replenishNeed` (and so `replenishAt`) has no caller outside state-logic. (Any step that touches waivers.)
- `check-new-start-game.js` prints `[push] bingoLine notification failed: TypeError ... 'pool'` five times from its own
  process (the bingo fixture notifying outside a request): no check fails, and no game-spec code is on that path.
  (Whoever next touches the bingo fixture.)

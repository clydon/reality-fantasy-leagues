# Plan: the Start-a-game GPT, on games as data

Status: **planned 2026-10-27; hardened 2026-10-28** with the user: the engine first, built to everything in "Where the engine
is headed", then today's games recreated on it, then the UI last; the GPT's words grow alongside the engine. **S1 (2026-10-27)
and S2 (both parts, 2026-10-28) are built and merged into master** (their As built is under track S); the test couch plays
them next (the user's, in production). A1–A3 are built on `engine`, not yet merged; A4 is in progress. The live-sports plan is
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
refers to. A draft; A1 settles it:

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
  - **Split in three (2026-10-28):** part 1, the framework with baseball (built: As built below); part 2, basketball, hockey
    and football on it (all three built: As built below; football, whose plays are text only, in a session of its own);
    part 3, games straight from ESPN's schedule as a season of their own, finals and odds stored (the migration,
    HOSTING.md) and the 76ers example's game from the schedule (its recorded game is part 2's fixture) (built: As built
    below). L1 is done but its spec parts, which wait for A1-A4 on master.
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

**L1 part 1 as built (2026-10-28, `sports`, not merged; no migration, no ESPN calls from the app, nothing stored).** The
framework and baseball: a game is its plays, so the box score at any moment is the plays up to it, added up, and the final box
score is the truth.
- **`src/lib/sports/`** (new, pure: the server, the phone and the tests share it; nothing in it asks ESPN).
  - `sport.ts`: `Sport` (abstract: its groups and positions, stat groups, stats, periods, lock cadence; `stat`, `full`,
    `specStats`, `where`) and `TeamSport` (a box score and timestamped plays: `readBox`, `readPlays`, `reduce`, `correction`,
    `timeline`, `stateAt`). `FieldSport` and `BoutSport` come with L5.
  - A stat is `{ key, label, short, noun, better, group, kind }`: keys unique in the sport (what a spec names: `{ HR: 5 }`,
    `{ stat: "PTS" }`); `short` as a column says it (a hitter's K and a pitcher's PK are both "K"); `noun` for a sentence ("5 a
    home run": the spec's `ctx.stats` label, as A1's describe reads it); `kind` count (plays carry them), derived (from one
    game's counts, added game by game: TB, IP, a quality start) or rate (never added: AVG, ERA). `known: "final"` for what only
    the final box score knows (a pitcher's win, loss, save, hold, blown save); `judged` for the official scorer's calls
    (earned runs, RBIs).
  - A `Play` is `{ id, at, period, half, clock, text, kind, team, unit, people, score, deltas }`: `at` is ESPN's wallclock but
    never before the play before it (`inOrder`: ESPN stamps a change made in the break with when it was made, filed after the
    next inning's start, up to minutes back), so a moment's plays are always the first so many; `unit` is the at-bat (later
    the drive: live calls' "this at-bat"); `deltas` what it adds to whose line.
  - `reduce(plays, t)` is the game as of t (Date, ms or ISO). `timeline(summary)` is the plays and, once final, the final's
    correction: one more play, at the last one's time, whose deltas make the plays' box score ESPN's own (its wins and holds,
    a scoring change after the play, someone the plays credited who isn't in the box score). A play with no time (only a final
    with no timed plays) counts only at the end, so a moment never sees it.
  - `index.ts`: `sportOf(league)` by ESPN's sport slug ("baseball/mlb", "baseball/college-baseball": Baseball), `sportById`,
    `allSports`, `defaultsFor(sport)`.
- **`Baseball`** (`baseball.ts`): batters and pitchers; ESPN's position abbreviations as keys (C, 1B... DH, PH, PR, SP, RP, P);
  batting PA AB R H 1B 2B 3B HR TB RBI BB IBB HBP K SB CS SF SH GIDP NP (#P) and AVG OBP SLG; pitching GS OUTS IP PH PR ER PBB
  PK PHR PC PST W L SV HLD BS QS and ERA WHIP; nine innings ("Top 3rd"); daily locks.
  - **The box score**: ESPN's batting and pitching tables by their labels, only the columns a table has, zeros kept (the
    correction needs both); IP to outs; the first pitcher listed is the starter; decisions from the notes ("W, 1-0", "L, 3-2,
    B, 1"); the team's own totals (doubles, total bases, plate appearances, GIDPs, outs, strikes), but not its earned runs,
    which MLB works out again over the inning and can be fewer than its pitchers'.
  - **The plays**: every pitch (the batter's pitches seen, the pitcher's count and strikes; an automatic ball isn't a pitch)
    and every play-result. The play-result's text says what happened, read clause by clause by who each starts with (names as
    ESPN writes them: last names, "Mesa Jr." or "Mesa", "We. Wilson" when two share one, no accents), lists of names sharing a
    verb ("McMahon, Jones, and Goldschmidt scored"), MLB's own sentences after a 2026 ABS challenge ("...overturned: Eli White
    walks. Ozzie Albies scores."). Runs come from each play's `scoreValue`, who scored from the text (else the runners gone,
    lead runner first), outs from the text and, on a batter's play, ESPN's outs after it. **Total bases are counted from the
    plays** (single 1, double 2, triple 3, home run 4), since ESPN's per-player batting has none.
  - **Runs charged** to the pitcher who put the runner on (a pinch runner takes over his base and his pitcher; a fielder's
    choice keeps an earlier pitcher's runner his); earned unless the runner reached on an error, was safe on a botched play
    made on him, took a base on an error and didn't come in on a hit, scored on a passed ball, or the inning would have been
    over without the errors (the rules' 9.16). RBIs as 9.04 says (none on a ground ball's double play; on an error only from
    third with fewer than two outs; "scored on error" with no fielder named goes with the batter's play, "scored on throwing
    error by third baseman Ortiz" doesn't).
  - **ESPN's quirks, handled**: steals and wild pitches recorded twice (a typed play and a play-result, one with a review note
    the other lacks); an at-bat's start and any play in the middle of it carrying the at-bat's final outs and score; the last
    pitch filed again when the scorer changes the call; pitches filed under an at-bat after its end (an overturned strike
    three); a pinch runner the next at-bat's start doesn't show; extra innings' runner on second nobody lists (the half's
    first pitcher's, unearned); a half-inning missing its last out (the pitcher on the mound gets it, and the reader notes it).
- **Baseball's defaults as data** (`src/lib/sports/defaults/baseball.json`): ESPN's standard points (R, TB, RBI, BB, SB 1; K
  −1; IP 3; PH, PBB −1; ER −2; PK 1; W 2, L −2, SV 5, HLD 2), Yahoo's 5x5 categories, Yahoo's standard roster (C, 1B, 2B, 3B,
  SS, 3 OF, 2 Util, 2 SP, 2 RP, 4 P, 5 bench; each slot takes positions or groups), daily locks, and two specs in A1's shape:
  `season` (draft 23, start 18, head to head, daily) and `short` (one game, a series, a team's next few: draft 3 each, all
  count, most points). They plug into the spec when master has A2 (merged in here first); slots and categories aren't in A1's
  schema yet (L4 adds them), so they sit beside it.
- **How a sport's Make it a game will start from its default spec, not ChatGPT.** Today Make it a game (`make-game.ts`) asks
  the bot to write a rulebook of sports moments (2–4 minutes) and the game scores from ChatGPT's research of them. For a sport
  ESPN carries, `sportOf(season's league)` gives the Sport and `defaultsFor` its specs: the game is `short` for a span of a few
  games and `season` for a season, scored by stats from ESPN's box scores and plays (L3), with no rulebook and no bot. The
  wizard's sentence reads from the spec as for any game; the bot stays for a sport ESPN hasn't got.
- **Fixtures**: the 2026 AL Wild Card Series, Red Sox at Yankees (ESPN 401907924 and 401907963: the Yankees in two, 9-0 and
  9-2), in `tests/fixtures/espn/`, trimmed to what the readers read (~225 KB each from ~930 KB) by
  `scripts/dev-test/record-espn.js` (new, reusable: `--league --event --note`; refuses a game that isn't final). It's the
  user's first example, made real: `tests/fixtures/sports-examples.js` has both examples as words, spec (ESPN's team ids:
  BOS 2, NYY 10; PHI 20, CLE 5), games and what they settle to. The series at 5 a home run and 1 a total base: Ben Rice 22
  (2 HR, 12 TB), Bellinger 11, García Jr. 11, Contreras 10, Sogard 9. The 76ers home opener was 2026-10-22, Cavaliers at
  76ers (ESPN 401909093): 114-106, ESPN's line PHI −2.5 and 237.5 (DraftKings), so the total 220 is under, and the top
  scorers tied at 32 (Maxey, Mitchell). It's part 2's basketball fixture.
- **Checks.**
  - `tests/sports-baseball.test.js` (13): the vocabulary; derived and rate stats; the box score in Baseball's keys; **the
    proof** for each recorded game (the plays alone reduce to ESPN's own box score, 266 and 268 numbers, every team total
    ESPN gives and the score, with no notes from the reader); plays in time order with their inning, half, at-bat, people and
    deltas (Rice's grand slam: his RBIs, the three runners, the runs charged to the two pitchers who put them on); `stateAt`
    at moments; the final's correction (only final-only stats; with it, every number of ESPN's; a scoring change after the
    play taken back; someone not in the box score taken back; a live game has none; a final with no timed plays spoils no
    moment); the reader's words; ESPN's quirks on a made-up game; a thinner box score; the series scored as typed; the
    defaults.
  - `scripts/dev-test/check-sport-reduce.js` (new, reusable: `--league --from --days --max` or `--events`; caches only
    finished answers): the same proof on real games. **126 of 128 games reduce exactly** to ESPN's box score on every
    player's every count (2026 regular season, July, September and May, three days each, plus the six Wild Card and World
    Series games; about 61,000 plays). The two others are ESPN's team totals counting a steal no play shows. The scorer's
    calls, apart: earned runs right on 1,081 of 1,110 pitcher lines, RBIs on 2,777 of 2,779 (the final's correction
    settles them).
  - 849 unit tests; `tsc` clean; eslint clean on `src/lib/sports` (tests and dev scripts use `require`, as everywhere).
  - `/code-review` on the diff (its fixes: only the columns a box score has, a final with no timed plays spoiling no moment,
    the botched force's out in the earned-run count, RBIs on a fly's double play, typed plays' twins both ways, the dev
    scripts caching only finished answers, someone the plays credited who isn't in the box score, the derived stats' docs,
    and `ordinal`, `str` and `idOf` shared, not copied: `server/sports/espn.ts` reads the last two from `sport.ts`).
  - No HOSTING.md change: nothing here calls ESPN from the app, adds a table or stores data (part 3 does).

**L1 part 1 addendum: baseball on days it wasn't tuned on (2026-10-28, `sports`, not merged; no migration, nothing stored).**
Part 2's Noticed item, taken. Each difference was a count, read against ESPN's data before changing the reader:
- **A dropped third strike** ("Friedl struck out, Friedl to first on passed ball by Ruiz"): ESPN lists the batter only on
  first, so the strikeout was lost. The batter is now the at-bat's (from its start and pitches) when a clause starts with him
  doing a batter's thing; reaching on a passed ball or an error is an out the fielders missed (his run unearned), on a wild
  pitch it isn't. ESPN's outs on such a play are left alone.
- **A pitch challenged under ABS is filed twice** ("Ball 2", then "Strike 1 Looking" typed `strike-looking---overturned`), and
  **so is a result the scorer changed** ("struck out, to first on passed ball", then "safe at first on throwing error"): the
  last filing stands (every case seen: 6 pitches and 1 result). This replaces part 1's "a pitch once, the first".
- **A walk a relief pitcher came in to at 2-0, 2-1, 3-0, 3-1 or 3-2** is the pitcher's before him (the rules' 9.16(h)), and
  so is that runner's run; ESPN's box agrees.
- **A muffed foul fly** ("Wells continues to at bat after dropped foul ball by catcher Rutschman") isn't a plate appearance;
  the batter reaching afterwards is an out the fielders missed.
- **MLB's own words after a challenge or review**: "steals (6) 2nd base", "steals (4) home" (a run), "catcher Henry Davis picks
  off Mickey Moniak at 3rd", "Umpire reviewed (home run), call on the field was upheld:", two challenges in a row. A typed play's
  twin is now also the play-result on the same pitch of the same at-bat that tells it otherwise (in MLB's words, or with the
  batter's result naming the runner: "Young struck out swinging, Abrams caught stealing second", which had counted a caught
  stealing twice). The review note after a play no longer eats the name before it ("...by Jensen. Kansas City Royals
  challenged").
- **A ground ball's double play is grounded into (GIDP) only as a force or a reverse force**: a runner who had to run, put out
  at the base he had to reach. Not "Holliday grounded into double play, ..., Alonso out at third" (Alonso from first), nor a
  runner on second with first empty run down; ESPN's totals agree.
- **The first pitcher listed is the starter whatever ESPN's `starter` flag says**: it's false for Ohtani starting on the mound
  as a two-way player (2026-06-17); the only such row in 680 pitching tables.
- **The numbers.** The days part 2 named: May 12-14 **41 of 41** (was 33), September 1-3 **39 of 39** (was 37). Part 1's days
  as before: May 2-4 41 of 42, July 18-20 45 of 46, September 10-12 35 of 35, the six Wild Card and World Series games 6 of 6
  (the two left: ESPN's team totals counting a steal no play shows). **New days, honestly, on their first run**: April 14-16
  37 of 40, June 16-18 35 of 37, August 11-13 37 of 39; after the GIDP, twin and starter fixes 38 of 40, 36 of 37, 39 of 39.
  **Every cached MLB game: 335 of 340** (314 before; ~163,000 plays); the five left are ESPN's own: four team totals with a
  steal no play shows (one a double steal's runner who "scored on throwing error"), and a suspended game (stopped June 16,
  resumed June 17) whose plays lack two at-bats. The scorer's calls, apart: earned runs right on 2,861 of 2,928 pitcher lines
  (2,857 before), RBIs on 7,276 of 7,290 (unchanged).
- `tests/sports-baseball.test.js` (14): a test of these quirks on made-up games (a challenged pitch, a dropped third strike,
  a muffed foul fly, steals in MLB's words with their typed twins, an inherited walk at 2-0 and one at 1-0, a force and a
  non-force double play, a result filed twice, a caught stealing told twice), and the new clause shapes in the reader's words.
  Both fail on part 1's reader.

**L1 part 1 noticed, not fixed:**
- **Earned runs are the scorer's reconstruction**: 97% of pitcher lines from the rules as the plays say them; the rest come
  right at the final. A full inning-by-inning reconstruction (each error's would-be out and the runners it moved) could close
  more, if L3's live points need it.
- **ESPN's team totals can count a steal no play shows** (2 of 128 games): nothing to read; the final box score is the truth
  for a team's question.
- **Live plays are untested**: every check is on finished games. A live summary's at-bat start may carry the outs and score
  so far rather than the at-bat's end (ESPN updates it as the at-bat goes); the reader doesn't trust either, but L2 should
  check a live game's plays against the same game's final (fake-espn's replay can't show it). (L2.)
- **Slots should take the roster's position, not the game's**: the box score gives the position played that day (DH, PH,
  PR), the roster ESPN's (SP, RP, OF: `season_cast.role`). A slot's eligibility reads the roster's. (L4.)
- **A tie for "the most"**: the 76ers opener's top scorers tied at 32. The `stat: most` settle needs its rule (both right, as
  A4's closest number does). (L4, with A4's questions.)
- **`GameState.score` is empty before the first play** (no teams yet): the scorebug would seed it from the header. (L2.)
- **College baseball reads as Baseball but isn't checked**: its box scores are thinner (L5, with college).
- **A game's plays are ~60% pitches** (~450 Plays, a few hundred KB as JSON): fine for the phone, which reads ESPN's summary
  (~1 MB) anyway. (L2.)

**L1 part 2 as built: basketball and hockey (2026-10-28, `sports`, not merged; no migration, no ESPN calls from the app,
nothing stored).** Football, whose plays are text only, is part 2's next session.
- **`sport.ts`** gains what they need: the header's season type, status detail and a hockey game's goalies of record
  (`featuredAthletes`); basketball's shot flags and hockey's strength and net on a play; `Play.shootout`; `pair` ("6-10");
  the helpers every sport shares (`count`, `position`, `val`, `ratio`, `rosterOf`, `cleanDeltas`, a default `positionKey`:
  Baseball uses them now); `Sport.leagues`, the ESPN leagues a sport reads when not all of its sport's play alike. The final's
  correction also takes back what the plays credit to someone ESPN's box lists with no line (a player who didn't play), and
  the final keeps the shootout flag.
- **`Basketball`** (`basketball.ts`; the NBA and the WNBA; college basketball plays halves, so `sportOf` gives it null until
  L5): guards, forwards, centers (PG SG G, SF PF F, C: a box score says G, F or C, a roster PG to C); MIN PTS FGM FGA 3PM 3PA
  FTM FTA OREB DREB REB AST STL BLK TO PF PM (+/−), FG% 3P% FT%, DD and TD game by game; four quarters ("2nd quarter, 5:32");
  daily locks. **Known at the final: MIN and PM** (who's on the floor, which ESPN's substitutions only mostly say).
  **Judged: REB, OREB, DREB, AST, STL, BLK, TO** (the statistician's calls, which ESPN's box can credit to a teammate after the
  play).
  - The box score: its one table by label, made-attempted pairs, zeros kept, a player who didn't play with no line at all; the
    team's totals (its pairs from their text).
  - The plays: typed, their people with no roles but in a set order (the shooter, then the assister or blocker; who turned it
    over, then who stole it; who enters, then who leaves). Counts come from the type and the shot flags (`shootingPlay`,
    `pointsAttempted`, `scoringPlay`, `scoreValue`); a free throw by its type alone; **a missed heave isn't an attempt** (the
    NBA's rule since 2025-26; ESPN's box agrees in every quarter, the 4th's included); a team rebound or team turnover is
    nobody's; personal fouls include a flagrant, not a technical, a defensive three seconds or a delay; a double personal
    foul comes as two plays, each its fouler's. The unit is **a possession**: a new one when the ball changes hands, or after a
    made basket, a turnover or the last free throw (an and-one's free throw stays in its basket's, a technical's in whoever's
    it is, and a held ball won back keeps it).
- **`Hockey`** (`hockey.ts`; the NHL; college hockey ends a tie otherwise, so null until L5): forwards, defense, goalies (C LW
  RW F, D, G); skating G A PTS PM PPG PPA PPP SHG SHA SHP SOG SM BLK HIT TK GV FW FL FO% SHFT SOGOAL; goaltending GA SA SV SV%
  GAA ESSV PPSV SHSV W L OTL SO SOSV SOGA; ice time and penalties TOI PPTOI SHTOI ESTOI (in seconds, so they add) PN PIM; three
  periods ("2nd period, 5:32 in": ESPN's hockey clock counts up; "overtime, 1:10 in"; "shootout"); daily locks. **Known at the
  final: PM, TOI and its kinds, SHFT, and the goalies of record** (W; L, or OTL past regulation in the regular season; SO, the
  winner's when he was his side's only goalie and the other side scored none). **Judged: SOG, SM (and so SA, SV and the
  strength saves), HIT, BLK, TK, GV** (the real-time scorer's).
  - The box score: forwards, defenses and goalies by label, zeros kept, but not its shootout columns (ESPN leaves them at 0);
    the decisions from the header's `featuredAthletes`, overtime from the detail ("Final/OT", "Final/SO": the summary's header
    has no period); the team's totals, but not its penalties (a bench minor is nobody's).
  - The plays: by type and the people's roles (scorer, assister, shooter, saver, defender, hit-credited, giver, taker,
    face-off-winner; a penalty's committer first). **A goal is against** the goalie the last shot at that net named (a missed
    shot's goalie comes untyped), or after an intermission the one the next shot names; an empty net's is nobody's. Power-play
    and shorthanded goals and assists by the goal's strength (the scoring side's); an empty-net goal's from the play before it
    (a play's strength is its own side's, so the other side's is flipped). A shot blocked by a teammate isn't a block; saves
    count by the shot's strength. **The shootout** ("SO") is its own: shootout goals, saves and goals against, never the game's
    goals, shots or score, and its winner's one goal at its end. The unit is **the run of play from a faceoff**.
- **Defaults as data**: `defaults/basketball.json` (Yahoo's head-to-head points PTS 1, REB 1.2, AST 1.5, STL 3, BLK 3, TO −1;
  its 9 categories; PG, SG, G, SF, PF, F, 2 C, 2 Util, 3 bench; daily; `season` drafts 13 and starts 10 head to head, `short`
  drafts 3, all count) and `defaults/hockey.json` (Yahoo's G 6, A 4, +/− 2, PPP 2, SOG 0.9, BLK 1, and for goalies W 5,
  GA −3, SV 0.6, SO 5; its 10 categories; 2 C, 2 LW, 2 RW, 4 D, 2 G, 4 bench; daily; drafts 16 and starts 12).
- **Fixtures** (`record-espn.js` now keeps each sport's play fields, the status detail, the goalies of record and ESPN's line,
  `pickcenter`): the 76ers opener (`nba-401909093.json`, 201 KB, now in `sports-examples.js`'s `recorded`), Kings at Rangers
  2026-10-26 (`nhl-401892582.json`: the Rangers' goalie pulled after the 1st, an empty-net goal, power plays) and Red Wings at
  Kraken 2026-10-20 (`nhl-401892547.json`: overtime, then a shootout).
- **Checks.**
  - `tests/sports-basketball.test.js` (10) and `tests/sports-hockey.test.js` (12): the vocabulary, derived and rate stats, the
    box score, **the proof** on each recorded game (the plays alone come to ESPN's box score: 285, 453 and 446 numbers, every
    team total and the score, with no notes from the reader and nobody credited who didn't play), the plays and their units,
    `stateAt` at moments, the final's correction (only final-only stats in it; with it, every number), the rules the
    recordings don't show on made-up games, and the defaults. **The 76ers example settles as typed**: PHI wins 114-106, 220 is
    under DraftKings' 237.5 (read from the fixture's own line), and Maxey and Mitchell tie at 32.
  - `check-sport-reduce.js` now fails a count the plays credit to someone who didn't play, and sets apart only stats a sport
    marks `judged`. On real games: **basketball 59 of 73** (the NBA's first eight days, four days of last May's playoffs, three
    July days of the WNBA; ~36,200 plays; one more game ESPN answered 404), with a judged count in 20 (settled at the final);
    the 14 left are ESPN's own: 7 a shot attempt its plays have and its box doesn't, or the other way round (a buzzer shot the
    official count wiped, a putback missing from the plays), 5 a personal foul (a double technical its box counts as a foul in
    some games and not others, or a foul missing from the plays), and 2 a basket its box credits to a teammate. **Hockey 63 of
    64** (eight October days and four playoff days, ~20,600 plays), a judged shot in 3; the one left is ESPN's "Penalty Shot
    Infraction", charged in its box to a teammate of the one its play names. Baseball reads as before.
  - 871 unit tests; `tsc` clean; eslint clean on `src/lib/sports`.
  - `/code-review` on the diff (its fixes: a player who didn't play taken back at the final and failed by the check; Hockey
    for the NHL only; the check's "credited to a teammate" bucket replaced by the sports' own `judged`; a goalie changed at the
    intermission; the shootout read from the period's name before the 5th-period rule; the final keeping the shootout flag; a
    free throw by its type; a held ball's possession; the shared helpers; one set of goalies, read once. Two it raised were
    checked against ESPN's data and kept: a missed 4th-quarter heave isn't an attempt either, and a penalty typed "Bench" can be
    a player's own, so whoever a penalty names is charged).
  - No HOSTING.md change: nothing calls ESPN from the app, adds a table or stores data.

**L1 part 2 (basketball and hockey) noticed, not fixed:**
- **Minutes and plus/minus, time on ice and shifts come only at the final.** ESPN's NBA substitutions cover the floor in most
  games (quarter-start changes too), so tracking who's on could give live minutes and +/−; hockey's plays say nothing of
  shifts. (L3, if live points need them.)
- **A goalie changed mid-period whose first shot faced is a goal** is charged to the one pulled until the final: no play says
  a goalie changed (the intermission's case is handled). (L3.)
- **The heave rule is checked on the NBA only**: the WNBA's ten games had none. (L5, with the WNBA's next season.)
- **A possession's neutral plays** (the defense's foul right after a steal) stay in the possession before. (L4's live calls,
  if "this possession" needs them exact.)
- **A shutout in a 0-0 game won in a shootout** goes to the winner's goalie only; the NHL's own rule wasn't checked. Rare.
  (L4.)
- ~~**Baseball's reader does less well on days part 1 didn't tune it on**~~ (May 12-14 33 of 41, September 1-3 37 of 39):
  **done** in part 1's addendum (above): 41 of 41 and 39 of 39, every cached MLB game 335 of 340.

**L1 part 2 as built: football (2026-10-28, `sports`, not merged; no migration, no ESPN calls from the app, nothing
stored).** Part 2 is done: L1 part 3 (games from ESPN's schedule) is next, or L2.
- **`Football`** (`football.ts`; **the NFL only**: college football's plays are another grammar, below), registered in
  `index.ts` with `defenseId` exported. Positions as ESPN's rosters say them (QB RB FB WR TE OT G C OL; DE DT NT DL LB CB S
  DB; PK P LS; DEF, the team defense) in offense, defense, kicking and team; four quarters ("2nd quarter, 5:32", "overtime");
  **weekly locks**. Stat keys, unique in the sport: passing CMP PATT PYDS (gross, as a passer's line) PTD INT SACKED SACKYDS,
  NPYDS (net) worked out, CMP% YPA; rushing RATT RYDS RTD, YPC; receiving REC RECYDS RECTD TGT, YPR; two-point P2PT R2PT
  RE2PT and 2PT (Yahoo's: the passer and the catcher both); fumbles FUM FUML FREC FRTD; defense TCK SOLO SACK (halves)
  TFL PD QBH DTD FF SAF BLKK; interceptions DINT DINTYDS DINTTD; returns KR KRYDS KRTD PR PRYDS PRTD, RETTD; kicking FGM FGA,
  **made by distance** FGM0 FGM20 FGM30 FGM40 FGM50 (from the plays: ESPN's box has only totals), XPM XPA, FGMISS XPMISS
  KPTS FG%; punting PUNT PUNTYDS PUNTTB PUNTIN20, PUNTAVG.
  - **The team defense is a line of its own per side** (`def:<ESPN team id>`, Yahoo's DEF): DSTG (its game, so a shutout
    still has a line), DSTSACK DSTINT DSTFR (the other side's fumbles it recovered, a muffed punt's too) DSTTD (defense and
    special teams touchdowns) DSTSAF DSTBLK, and PA, **points allowed as Yahoo counts them** (not a safety, a turnover's
    return touchdown or a defensive two-point return; a kick's or punt's return touchdown is), with Yahoo's brackets PA0
    PA1_6 ... PA35 worked out from it. The box score gives each side's DEF its sacks, interceptions, the other side's fumbles
    lost and ESPN's "Defensive / Special Teams TDs"; safeties, blocks and points allowed only the plays say. Checked on 236
    team defenses: never more allowed than the other side scored, the gaps exactly their return touchdowns and safeties.
  - **Known at the final: nothing** (every count ESPN's box has, the plays carry). **Judged** (the stat crew's calls, which
    ESPN's box makes otherwise after the play: it splits a sack the text gives one player, or counts a tackle, a tackle for
    loss, a hit or a target the text doesn't name): **TGT, TCK, SOLO, SACK, TFL, PD, QBH, FF, DSTSACK**.
- **The box score**: its ten tables by name and label (only the columns a table has, zeros kept; "27/40" and "2-11" two counts
  each); no positions (ESPN's NFL box has none: the roster's say); the team's totals (completions, attempts, net passing
  yards, sacks, interceptions, carries, rushing yards, fumbles lost).
- **The plays** sit in `drives.previous[].plays` (and live `drives.current`, read once); each Play's unit is its drive, its team
  the side with the ball at the snap, its score ESPN's after it (which never goes down: ESPN gives a two-minute warning 0-0).
  They're text only, read sentence by sentence: names become placeholders, each matched on the side its place says (the
  passer, runner and receiver the offense's, tacklers the other side's, a kick's returner the receiving side's, "RECOVERED by
  ATL-G.Dexter" whoever ATL is), by first-name letters and last name ("Bi.Robinson", "A.St. Brown", "J.van den Berg", a
  suffix dropped, a hyphenated name's first part: "S.Joseph" is Sebastian Joseph-Day), else by last name alone on that side (a
  box score's nickname: "Bam Knight" is "Z.Knight"). **The text's team codes are the league's** (HST, BLT, CLV, ARZ, LA, WAS),
  learned per game from its kickoffs; spots are placed from the home side's goal line, as ESPN's `start.yardLine` is.
  - **Tackles**: "(A)" solo, "(A; B)" shared, "(A, B)" A's with B's help (A solo); a tackle for loss the first tackler's
    when the play ends behind the line; "[A]" a hit on the quarterback, and a sacker's unless he fumbled or ran out ("sacked
    ob"); "sack split by A and B" half each, no tackle for loss; a pass defended from "incomplete ... (A)" and the
    interceptor's.
  - **Yards as ESPN's box counts them** (each rule from the data, checked on every case seen): a spot foul by the side with the
    ball behind where its gain ended counts the gain to the spot (a return's too, and a negative return whose foul is at the
    catch counts nothing); "TOUCHDOWN NULLIFIED by Penalty" is no touchdown but the run to the foul's spot; a fumble the other
    side (or a teammate) got counts to where it was first touched or recovered, but never past the fumble spot when that was a
    gain, while the fumbler's own recovery moves it either way, and one out of bounds forward comes back to its spot (the
    rules'); a sack's yards with a fumble are to where the other side first touched it, or where the play ended for the
    quarterback's side, never a gain; a lateral's yards are the second man's and all the passer's, the catch the first's;
    a punt's yards run to "impetus ends at", and on a muff on to where the ball ended when that's farther; "inside the 20" is
    where the ball ended, a receiving side's foul during the return ending it at the foul's spot.
  - **ESPN's quirks, handled**: the quarter's last play recorded twice (the next play from scrimmage starts at the same down
    and spot: the first is left out); a fumbled snap told as a move ("C.Stroud to HST 11 for -5 yards. FUMBLES, and recovers")
    isn't a run when a pass or sack follows; an aborted snap is the quarterback's carry for no gain, from the line when he runs
    with it, never below nothing; a muffed punt is a fumble and a return of nothing (a kickoff's kept isn't a fumble, but is a
    return); a blocked punt isn't a punt; "Illegal Forward Pass" isn't an attempt; "Fumble Forced by 55-D.Hunter" moves the
    forced fumble; a reversed call reads what follows "REVERSED."; replay, injury and "reported in" notes are skipped; a
    scoring play ESPN tells only as a summary with full names ("Dallas Goedert 9 Yd pass from Jalen Hurts (Jake Elliott
    Kick)") and the phrases it writes when the league's text is missing ("Kirk Cousins Pass Complete for 5 Yds to Michael
    Mayer", "Incomplete Pass, Intended For", "Team Safety") are read for what they say.
- **Defaults as data** (`defaults/football.json`): **Yahoo's default half-PPR** (help.yahoo.com/kb/SLN6489.html): PYDS 0.04,
  PTD 4, INT −1, RYDS 0.1, RTD 6, REC 0.5, RECYDS 0.1, RECTD 6, RETTD 6, FRTD 6, 2PT 2, FUML −2; kickers FG 0-39 3, 40-49 4, 50+
  5, XPM 1; team defense sack 1, interception 2, fumble recovery 2, touchdown 6, safety 2, blocked kick 2, points allowed 0: 10,
  1-6: 7, 7-13: 4, 14-20: 1, 21-27: 0, 28-34: −1, 35+: −4. No categories (Yahoo's football is points). Yahoo's roster: QB, 2 WR,
  2 RB, TE, W/R/T, K (takes PK), DEF, 6 bench; weekly; `season` drafts 15 and starts 9 head to head, `short` drafts 3, all count.
- **Fixtures** (`record-espn.js` keeps football's drives, only the fields the reader reads, one drive a line: 74-80 KB from
  ~570 KB): 49ers at Falcons 2026-10-25 (`nfl-401873017.json`) and Cardinals at 49ers 2026-09-27 (`nfl-401872958.json`). No
  college fixture: college isn't read (below).
- **Checks.**
  - `tests/sports-football.test.js` (16): the vocabulary, derived and rate stats (points allowed's brackets), the names and
    sentences, the box score, **the proof** on each recorded game (471 and 458 numbers: the plays alone come to ESPN's box
    score, every team total and the score, with no notes; the second's only differences four of the crew's tackles), the plays
    (a sack, shared and helped tackles, an interception, a spot foul, a lateral, a fumble short of the catch's end, an aborted
    snap), the 49ers' quirks (a lateral touchdown, a nullified touchdown, a muffed punt, a play recorded twice), `stateAt` at
    the half, the final's correction (only judged stats in it; with it every number; a live game has none, its current drive
    read once), and on made-up games the fumble and snap rules, the scoring summaries and phrases, two points, a pick-six and a
    safety and the points allowed, sacks, tackles, punts and kickoffs, whose a safety or a muff's touchdown is, a name on its
    own side; the defaults.
  - `check-sport-reduce.js` takes `--weeks`, `--season`, `--seasontype` (and `--groups` for college once read). On real NFL
    games: **weeks 3-7, 62 of 75; the 2025-26 playoffs, 11 of 14; weeks 1-2, 22 of 32** (15 of 32 on its first run there, before
    the phrases only those weeks had): **95 of 121, ~22,300 plays**, with a judged count otherwise in 91 (tackles in most;
    settled at the final), and **with the final's correction every game equals ESPN's box on every number**. The 26 left are
    ESPN's own: 3 games with no box score at all (one the Pro Bowl), ~14 one-yard differences where its box was corrected after
    the game but the play's text wasn't, fumbles and a sack no text describes (summary-only plays, three fumbles), an aborted
    snap credited to the back who picked it up (in another game to the quarterback), a punt typed "-12 yards" (38 in the box).
  - 887 unit tests; `tsc` clean; eslint clean on `src/lib/sports`.
  - `/code-review` on the diff (its fixes: a safety on a return is the kicking side's; a muff the coverage recovers and scores
    is its defense and special teams' touchdown, not an offensive fumble return; a phrase's fumble a teammate recovered isn't
    lost; a name looked up on its own side by last name before the other side exactly; a two-point pass only when complete,
    and a defensive two-point return's 2 points; one penalty regex; the check's `--weeks` stops at `--max`; the recorder's play
    count with a live drive).
  - No HOSTING.md change: nothing calls ESPN from the app, adds a table or stores data (the dev check asked ESPN ~170 times,
    every finished answer cached).

**L1 part 2 (football) noticed, not fixed:**
- **College football isn't read**: its plays are another grammar ("#12 K.Russell pass complete short right to #40 J.Ford caught
  at ALA40, for 16 yards to the ALA41 (#7 D.Brooks), 1ST DOWN", "QB hurried by"), all 30 games checked, and its box has no sacks
  taken or targets, "QB HUR" for hits and half tackles for loss. A `CollegeFootball` reader on Football's vocabulary and box
  reader, its own text grammar. (L5, with college.)
- **A one-yard difference ESPN corrected after the game** (~14 lines in 121 games): its box is right and the play's text isn't,
  so a live point can be a tenth off until the final settles it. (L3, nothing to do but the final.)
- **A box score ESPN never filled in** (3 of 121 games, tables named "xfl", "nfl", "ufl" with no one in them): no final's
  correction is possible; the plays would have to be the final. (L3, when it saves a final: fall back to the plays.)
- **Plays only the plays carry**: forced fumbles, safeties, blocked kicks, offensive fumble return touchdowns, two-point
  conversions, field goals by distance and points allowed have no ESPN number to prove them against; they're checked on
  made-up plays and (points allowed) the 236 defenses' sanity check. The Yahoo points that read them can't be proven against
  a box. (L3.)
- **A team defense needs a cast entry**: its line is `def:<team>`, so a game's cast needs one per team for a DEF slot
  (`season_cast.provider_ids.espn = "def:12"`). (L4, with slots.)
- **Live drives are untested**: every check is on finished games; `drives.current` is read but never seen live. (L2.)
- **A muffed punt's foul** (a holding call at the recovery spot): ESPN kept the return whole and the punt where it was, the one
  such case seen; the reader does too. Rare. (L3.)
- **Baseball's reader on days part 1 didn't tune it on**: done since, in part 1's addendum (above).

**L1 part 3 as built: games straight from ESPN's schedule (2026-10-28, `sports`, not merged; migration 0300; HOSTING.md
updated).** A matchup (one game, a series, a team's next few) is a season of its own, made from a team's ESPN schedule, keyed
by its games and shared by everyone who asks for them; each linked game's final and line are kept. No UI, no API route: the
GPT (G3) and the wizard (U1) will call `makeMatchup`.
- **`src/lib/sports/matchup.ts`** (new, pure: the server, the phone and the tests share it). `pickMatchup(team, schedule, ask)`:
  `games` (by ESPN's ids), `opener` (the first regular-season game; `home: true` for the home opener), `series` (the whole run of
  games in a row against a team, at most 3 days apart, that the next one still to play is in: asked mid-series it's still the
  whole series, never a run weeks on), `next` (the next few, against one team if asked); "still to play" is ESPN's state, or as
  of `from` (an ISO time: "the upcoming series" asked on a schedule read after it). `matchupKey` (provider, league, the event
  ids sorted: "espn:basketball/nba:401909093"), `matchupName` ("Cavaliers at 76ers, Oct 22", "Red Sox at Yankees, Sep 29 –
  Sep 30", "Yankees vs Red Sox, ..." home and away, "76ers, 3 games, ..."; dates in the East), `matchupStatus`, `leagueName`
  ("NBA"), `factsOf` (a game's sides, final and line as kept) and `finalOf` (what a final settles: the winner, each score, the
  total, and against a line over, under or a push).
- **ESPN** (`server/sports/espn.ts`, `types.ts`, `cache.ts`): `schedule(league, team, { season, type })`, a team's schedule
  (`teams/{id}/schedule`, the scoreboard's own event shape: `readScoreboard` reads it, its stage from `seasonType`, its scores
  from `{ value, displayValue }`), cached 12 hours (an hour when a game is within the day, 3 minutes while one's on). **Lines**
  (`Odds`: provider, details, overUnder, spread, the home side's): the scoreboard's `competitions[0].odds[0]` before a game
  (ESPN drops it from the scoreboard once the game's over, and a schedule has none), and a summary's `pickcenter[0]` (kept
  after: the box score now carries it).
- **`server/sports/matchup.ts`** (new): `makeMatchup({ league, team, ask, season?, type? })` reads the schedule, picks the
  games and makes or finds their season: `matchupSeason` puts it on its league's show (`shows.sports_league`, "espn:basketball/
  nba": made once, "NBA", kind sport, Players, Teams and Games, "Not a game yet" like a show added from its listing), the next
  season number, named by `matchupName`, its status from its games; an episode per game (air time, ESPN's name, its note),
  each linked to its event at once (`season_events` with the teams; `sports_links` saying all linked, so the daily linking never
  looks for it); `sports_matchups` keys it (two people asking at once: the second gets the first's). Its people are the teams'
  rosters after the answer (`castFromEvents`; `castable` now lets a matchup season's people come from its teams even once its
  league's show is a game). **Each game's facts** (`storeEvents`, `sports_events`: its sides and state, its final once over,
  never changed after, and its line: taken while the game is still to play, after only when none was kept): made for a
  matchup's games (the line from the game's day's scoreboard, or a finished game's summary), and **the daily listings job**
  (`refreshSportsEvents`) reads every linked game's day's scoreboard from three days back to a week ahead until it's final (a
  matchup's or a TV listing's, at most 40 days a run, each cached), then sets each matchup season's status from its games.
- **Migration 0300** (`sports_events`, `sports_matchups`, `shows.sports_league`), applied to `rfl_sports`.
- **The user's examples from the schedule**: `tests/fixtures/sports-examples.js` gains each one's `matchup` (the 76ers: team 20,
  `opener` at home; the Red Sox–Yankees: team 10, the 2026 postseason, `series` against 2 as of 2026-09-29). Fixtures recorded
  by `scripts/dev-test/record-espn-schedule.js` (new, reusable: `--league --team [--season --seasontype --note]`, ~55 KB from
  ~815 KB): the 76ers' 2026-27 (`nba-schedule-20.json`, 80 games) and the Yankees' 2026 postseason (`mlb-schedule-10-2026-3.json`).
- **Checks.**
  - `tests/sports-matchup.test.js` (8): a schedule read as games, lines from a scoreboard and a pickcenter, the picks on the
    76ers' real schedule (the home opener 401909093, the opener at the Knicks, the next few, against one team, by ids) and on a
    made-up series, the key, names, status and league names, the schedule's cache time, **the Red Sox–Yankees example's two
    games from the Yankees' postseason**, and **the 76ers example made from the schedule settling as typed**: the home opener
    is the example's game, its final from the schedule (114-106, the summary's own), DraftKings' 237.5 from its summary is the
    spec's line, and the final settles it: the 76ers, 220, under (the top scorers, the box score's, part 2's test).
  - `scripts/dev-test/check-matchup.js` (new, reusable; this lane's database and the stand-in ESPN, keyed `zt-`, cleaned up):
    19 checks, all pass: the home opener made (the league's show, the season, its linked episode, its link, its key, both
    teams' players with ESPN's ids, its final and its line from the summary: under), asked again (the same season), a series
    and the next game (seasons 2 and 3 of the same show, the next game's line from its scoreboard), the daily job's part (a
    line moved before the game taken, the final once played with the line before it kept, each matchup's status, a final
    kept once, a linked game first seen after it ended given its summary's line), and a matchup's people once its show is a
    game. `fake-espn.js` gains a team's schedule and lines (a
    scoreboard's before the game, a summary's pickcenter). `check-sports-links.js` still passes.
  - Measured on the real ESPN (the 76ers opener): 5 calls in 0.5 s, none a second time (HOSTING.md).
  - 896 unit tests; `tsc` clean; eslint clean on `src/lib/sports`, `src/lib/server/sports` and `tv-listings.ts`.
  - `/code-review` on the diff (its fixes: a line is only a default, so ESPN not answering for one leaves it out, never the
    matchup; lines looked for only within the week; the daily job's refresh reads past days first and gives a game first seen
    after it started its summary's line (the box score stats.ts reads, cached for good); a matchup is completed only when
    every game has a row and is over; a postseason series stays whole however many days off; `num` for scores; the daily job's
    three sports steps each on its own).

**L1 part 3 noticed, not fixed:**
- **The line kept is the last one read before the game**, and the daily job reads once a day, so it can be up to a day older
  than the game's start. A spec's line is fixed when its game is made (from the kept one); a live game's lock could read the
  scoreboard's line itself. (L2, the phone's poller; L3.)
- **A postponed game** comes from ESPN as `post` but not completed: its matchup reads as completed and its final never comes.
  ESPN moves it to a new event or date; the matchup would need its new game. (L3.)
- **A game not final three days after it starts** (suspended, resumed later) isn't read again by the daily job, and **a game
  moved to another day** is looked for on its first day's scoreboard (`season_events.starts_at` isn't updated for a matchup).
  (L3, with postponements.)
- **A league's show is named from its slug** ("NBA", "Mens College Basketball"; soccer's "eng.1" would be "Eng 1"): L5 should
  take ESPN's own (the scoreboard's `leagues[0].name` and `abbreviation`). And it's always its own show: a TV listing's show
  already called "NBA" would sit beside it in search as a second "NBA" (`nba-2`). Whether a league's matchups join a listing's
  show of the same league is a call for the wizard (U0) or the GPT's context pack (G1).
- **A full season's schedule is ~60 KB of cache row** (the read shape keeps every side's logo and names): fine kept 12 hours;
  trim it if many teams' schedules are asked. (When the GPT asks for them, G3.)
- **Nothing makes a matchup yet** but code: the GPT's ask (G3), the wizard (U1) or an engine lab page (A5) will call
  `makeMatchup`; a route for it comes with the first of them.

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
- **A2. The engine reads specs.**
  - `getLeagueType` and every strategy parameter come from `specOf(state)`. The flags (`hasRoster`, ...) are worked out from
    it, so the 45 files reading them keep working.
  - Every settings write (classic's PATCH, `updateSettings`, Game settings, Start a game) goes through the spec's validator,
    which writes today's fields from it while classic still reads them.
  - `settings.game` goes behind a flag (`app_settings 'game-specs'`, `scripts/game-specs-flag.js status|check|on|off`). The
    check: every league scores the same with it on, on the local copy and on a Neon branch of production (from the user's
    terminal). Then it goes on in production, with the user's OK.
- **A3. Spans that start later.** "Starts" on Start a game: any later listed episode, or when a rulebook phase starts (the game
  waits, and its draft can happen first). Game settings moves a start before it airs. Also the rest of BACKLOG item 10: side
  bets after the end, one word for an episode, and the places that don't know the end.
- **A4. Questions settled by data** (`ask`).
  - The answer kinds and the lock (`closedForPlay`).
  - Answers stored per game (like `episode_calls`), graded on read from the season's results (the shows' settles), with points
    and standings.
  - Weekly Calls and finale predictions become presets of it, scores unchanged.
  - Answering and results on screen move to the UI track (U1); A4 is the engine and storage.
  - Sports' settles are the branch's.

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
- **A6. Questions about who and about each.** Person and group answers settled by a moment in the episode ("Which tribe wins
  immunity?", "Who finds an idol?"), from research's per-person moments and each episode's groups (after swaps); one question
  asked of each person still in, an answer per person ("each couple's score"), counting as one of the 12; a person's number
  from research (`judgesScore`) for number and over/under answers.
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

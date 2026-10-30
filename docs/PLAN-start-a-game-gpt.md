# Plan: the Start-a-game GPT, on games as data

Status: **planned 2026-10-27; hardened 2026-10-28** with the user: the engine first, built to everything in "Where the engine
is headed", then today's games recreated on it, then the UI last; the GPT's words grow alongside the engine. **S1 (2026-10-27)
and S2 (both parts, 2026-10-28) are built and merged into master** (their As built is under track S); the test couch plays
them next (the user's, in production). **Merged and live in production (2026-10-30):** A1–A11 part 5b with F1–F4 (9:29 AM,
`df527fe6`, migrations 0200–0202), then A11 part 5c, A12 part 1 and R1 parts 1–2 (2:59 PM, `46b77bba`, migration 0203), and
**the game-specs flag is on** (R2, 2:39 PM: every league carries its spec); later parts stay on `engine` until the main folder
merges them, after each lettered step. A1–A4 are built on `engine` (A4 in two parts: the engine and storage, then the Prediction Sheet's screens, built before
the screens moved to U1), merged and live since 2026-10-30 (above).
A5 to A9 built on `engine` (2026-10-28: the tracker and the engine lab; questions about who and about each; time; more
answers; scoring that combines, per question and points per bingo line, then per lineup: a captain, best ball, Outlast in
reverse, points that multiply by when). The format foundation (F1 to F4, one part a session: "Formats nobody
announced") is under way: F1, the study (2026-10-28: [STUDY-format-changes.md](STUDY-format-changes.md), the
seasons' ground truth as data, `format-study.js`) and F2, the research prompt's format section (2026-10-29: every show's research
says who is with whom at each episode's end and what changed, as data; proven on 23 recorded episodes), are done, and so is
F3's first part (2026-10-29: the format's state over time, `format-timeline.js`, and its readers with their fallbacks; each
person's tribe move worked out from the section, so `newGroup` asks only for whoever moved and went home the same night),
and F3's second part (2026-10-29: the timeline from the database; the prompt's groups going in from it; newcomers asked about,
staged for the season and cued for the desk; one word for the groups beside the section; A6's group question on a season
played in pairs, graded on the pairs that played, void by default), and F4, the blind replays (2026-10-29: five taped seasons
replayed as if live through every game the tracker says plays, each format change arriving only in its episode's research,
`blind.js`; two grading fixes it found: a paired season's premiere, groups the league holds that nobody plays in). The format
foundation is done. A10 is under way, in parts: part 1, group slots and the exclusive-or-shared count (2026-10-29: a draft's +1 or
+2 slot for a pair or team the show forms, on the format's state over time, `GroupSlotLogic`), and part 2, a pool's pieces
(2026-10-29: lives, a buyback until an episode or a phase, mulligans, a second pick that counts on a night two go home, and last
one standing, `PickEmLogic.parts`), and part 3, a draft's slots and the draw (2026-10-29: a draft spread across the cast's groups as
the data has them when it drafts, one from each tribe, `SpreadLogic`; names out of a hat, seeded and recorded, `DrawLogic`; a guy
and a girl refused, since nothing records who is which), and part 3b, a draft's prices (2026-10-29: an auction by sealed bids
settled at once, `AuctionLogic`; a salary cap whose prices follow the data, `PriceLogic` and `BudgetLogic`), and part 3c, buying and
selling each week (2026-10-29: a stock market on those prices, trading in the waiver weeks, cash a ledger from the logs, ranked by
worth when the game says so, `MarketLogic`), and part 4, keepers across seasons (2026-10-29: a game that continues last season's,
each keeping up to N of their team there who are on this season's cast, named before the draft and locked as it starts, the draft
filling the rest whatever its kind, `KeeperLogic` and `keepers.ts`), and part 4b, a team two people share (2026-10-29: up to N
accounts on one seat, a second joining by an invite to it, either making its moves, who made each recorded, the lowest mark where the
seat's state depends on one, one leaving keeping it for the other, each credited on the couch, the exclusive count by teams,
`shared-seats.ts`, migration 0202), are built. **A10 is done.** A11 is under way, in parts (2026-10-29): part 1, a race and
players knocked out in a draft (first to N points ends it; the guillotine, a cut after an episode or before a phase, last one
standing, a knocked-out player's castaways back in the pool, `KnockoutLogic`, `lastEpisode`), and part 2, a pool's knockouts (a
pick that never repeats; one or none left ending it, and the night everyone left goes out, as settings: `rank.oneLeft`,
`rank.allOut`, `PickEmLogic.walk`), and part 2b, a game of questions' race and knockouts (2026-10-30: lives on its answers, its
race and cuts on their points, walked over the graded answers by the server on each copy it reads and handed to the engine,
`AnswerLogic.walk`, `answerWalk`), and part 3, co-op against the show (2026-10-30: a game of questions whose lives are the couch's
together, a night none of you saw coming costing one, won or lost by all, `rank.by 'coop'`, `score.saves`), and part 4, head to head
with playoffs, a draft's (2026-10-30: a round robin of the seats each episode on that episode's points, the standings by wins, the
playoffs over the game's last episodes, `rank.by 'matchups'`, `rank.playoffs`, `MatchupLogic`), and part 4b, head to head on a game
of questions (2026-10-30: each episode's points what its answers settled by then add, the walk handing them over, `answerWalk.series`,
`MatchupLogic.series`), and part 5, teams of players (2026-10-30: the couch split into teams that score together, drawn or chosen,
summed or their mean, by their points or head to head between the teams, `rank.teams`, `TeamLogic`), and part 5b, handicaps
(2026-10-30: points each episode the game plays for newcomers, by the couch's history the server works out and the engine keeps once
the game starts, `rank.handicap`, `HandicapLogic`, `handicaps.ts`), and part 5c (2026-10-30: teams that follow the show's own groups
refused, with why and what rides the show's groups instead; the late joiners' leftovers: nobody new once someone's out in every game
that knocks people out, someone catching up in a pool with lives, a late joiner dealt after a draw and paying under a price, a late
joiner's captain and second pick played through the routes, computer players' group slots), are built, so A11 is done. A12 (stages) is
under way, in parts (2026-10-30): part 1, the stage spec and its overall (a game in stages, each stage a game and a league of its own tied
to it, on an episode or a phase; a second draft at the merge, drafting from who's left and counted as it opens; the overall by points,
places or stages won, at each viewer's mark; a game that ends before a phase; `StageLogic`, `stages.ts`, migration 0203), is built; parts 2
to 4 next (a stage a format change starts, when a grouping lasts, mini-games and two shows), then A13 and A14
overnight (the user's word, 2026-10-28), stopping before A15. **R pulled ahead of A12's other parts** (the user, 2026-10-30): R1 is under
way, in parts: part 1, Survivor 51's three kinds as compositions of the pieces (2026-10-30: Outlast with its finale predictions, side bets
and waivers, Weekly Lineup and Survival Pool drafted and scored by the pieces their spec names, never a league type: `piecesOf`; the
league type only names a game for the screens now), and part 2, the games scored outside the state (2026-10-30: Weekly Calls,
Weekly Bingo and the game of questions chosen by their pieces wherever they're read, the home's moves and classic's list included, nothing
in scoring reading a league type or filtering the stored type by one), are built, so R1 is built (it merges once the Survivor 51
rehearsal passes); A12's other parts next (part 2, a stage a format change starts). **Waiting on the user (A2):** the game-specs flag in production (a Neon branch check from
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
- **Randomize** (the user, 2026-10-29, for later): Create a game offers two doors, **GPT it** or **Randomize**. Roll again as
  often as you like, and lock a few things before rolling: the length (one episode, say) and one or two main rules. A rolled
  game is "easy to read at a glance": a very short description.
- **Game pages, generated** (the user, 2026-10-30): the Games tab keeps today's overview, with the moves to make and each
  game's brief up front the moment it opens, and becomes a **game launcher** when there's more than one game: each game gets
  **its own page**, with more control and insight into it. The combinations run to thousands, so no page is designed per game:
  "a heavy research spike of a programmatic way to generate the UIs", then a handful of generated screenshots to review the
  UX, then a few hundred unique combinations. Better, more efficient ways to review and test the generated screens are welcome.

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
| Exclusive or shared (2026-10-28) | **Shared whenever the math says so** (the user: "many things will just mathematically have to be shared, no way around it", as in a 12-person Survivor game where everyone drafts several castaways). An exclusive draft only when the pool covers every pick, counted where the game drafts and as the pool shrinks (a later stage, a side draft, group slots among fourteen pairs); otherwise our check makes it shared and the wizard says why ("12 players × 3 picks is more than 18 castaways: two of you can have the same one"). Group slots are shared by default. |
| Randomize (2026-10-29) | **Planned** (the user's idea): the wizard's other door, designed in U0 with the rest of it, its engine piece G4 built before U1. No bot: a roll is instant, free and works when the bot is away. |
| Game pages (2026-10-30) | **Planned** (the user's idea): the Games tab stays the overview (the moves and each game's brief first) and launches each game's own page, opened over the show (no per-game tabs). Pages are generated from the spec, the game's state and the seat, never designed one by one: track V (a research spike, a first look, a review set of a few hundred games), then U0 frames them and U1 builds them. |
| A pool's finale (2026-10-30) | **Only the winner survives the finale** (the user: "it keeps the game rules consistent: pick the player that survives the episode"; chosen over the finalists surviving it, high stakes accepted). A finale pick is right only when its person is who the results record as winning (each winner, on a show with several); a finalist who loses is out like any exit; on a show with no winner, whoever isn't among the episode's exits survives, as on any night. Data settles it. It changes today's pools' finales (Survivor 51's Survival Pool on Dec 16): built and merged before then. |
| A preset's rule (2026-10-30) | **Open until the engine is complete** (the user). Whether a tapped preset meets the same data-can-settle rule as the GPT's games: R1 part 1's question, options (a) to (c) in its Noticed (Claude recommends (a)). The user's reason: what the moments say research can answer may differ from what research reliably returns at the end of each episode. So decide it on what research actually returns: the season tapes hold every research answer, episode by episode, so each moment's real rate can be measured then. Nothing running is affected meanwhile (no couch plays a show with couch-answered moments). A fourth option, from "Custom moments" below: (d) a preset's couch-answered moment goes through the same feasibility ask, becoming a question research answers each episode if it's feasible, else scoring 0. |
| Custom moments (2026-10-30) | **Allowed, sometimes encouraged** (the user: "a fun league of Below Deck that just every week players guess 'did someone cry'"). A moment the show's research doesn't cover, typed to the GPT or added by hand (Make it ours included), takes the new-moment path in "Our check": a short feasibility ask at the start (how reliably research can answer it each episode, from recaps), and, if it's feasible, a question research asks after every episode (it won't come up unless it's asked explicitly). The user leans toward allowing somewhat-reliable moments (crying "will likely be mentioned in post episode recaps"); the bar (high only, or medium too) is still open. Claude's recommendation: medium too, with three nets: the feasibility answer shown to the maker, an episode research can't settle voided (no points either way), and the game's real answer rate shown as the season goes. Before the bar is set, measure on the season tapes whether the feasibility ask predicts what research actually returns (the user's concern in "A preset's rule"). |

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
                                            //   | { pick: true } | { best: n } (best ball, A9: shows and sports)
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
| The Challenge | "I also want to automatically start a new draft stage whenever there is a major format change such as split into teams or split into individuals" | No | A12: a stage that starts on a format change of the kinds named, from each episode's research (Formats nobody announced, below). The wizard says what "major" covers. What players see, and whether the new draft waits for the maker's OK, are the format-change design session's (below) |
| The Challenge | "draft solo players in the challenge. if we ever get teams forming or pairing up that lasts for multiple episode i want us to start a 'side draft' after that episode ends" | The solo draft: yes (a draft of people) | F3's grouping lifetimes ("lasts" is known only once it has: held N episodes), A12's side stage that opens on a lasting grouping and closes when it changes. If pairs change every episode, it never opens, and the builder says so up front from the show's history (F1). "When a grouping lasts", below |
| The Challenge | A solo draft, then once teams or pairs are announced, a +1 or +2 slot on your roster for a pair or team for the next week ("Liz & Mark", "Justin & Susan"); if they stick, you ride with them, otherwise that slot just drops for everyone | The solo draft: yes | Group slots (A10, on F3's grouping lifetimes): "When a grouping lasts", below |

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

### Formats nobody announced (the user, 2026-10-28)

A taped season comes with hindsight; a live one doesn't. The Challenge changes its format from season to season and often
several times within one (pairs, then teams, then each for themselves; a new phase; a twist), Survivor swaps tribes, and The
Traitors adds twists. None of it is known when a game is made, so a game built on the format at its start can be thrown by
a change mid-season. Today's replays can't show it: a taped season's "how it works" comes from a rules answer written after
the season ended, so it already lists every change, and a change in a live season shows up only in each episode's research,
in a catch-all text field (`notableTwist`) the engine doesn't act on. Every game has to keep playing through a change
nobody announced:

- **Ride on data, not on the format at the start.** A pick or a question names people, groups and moments as the latest data
  has them: its choices are read at each lock, so a swap, a split or a new team changes them by itself.
- **Notice it.** Each episode's research says when the format changed (what changed, from which episode on), as data the
  engine reads, not only as free text.
- **Act on it, without a person.** The engine checks every running game against the new format. What still makes sense
  carries on. What doesn't follows a fallback its spec carries from the start (carry on with what's left, void that
  episode's question and its points, or start the game's next stage), and the maker is told what changed and what the game
  did. No game stops to wait for someone.
- **Prove it with blind replays.** Replay a taped season as if it were live: the game is made from what was known before its
  premiere (the previous season's format, or a rules answer as of the premiere), and each change arrives only in its
  episode's research. The Challenge's three seasons are the hard test (40 and 39 go on tape next for this): every game the
  tracker says it plays keeps playing, scores sensibly and ends.

Its home is A12 (a stage the show starts, not one the game planned), and it holds for every step from A9 on, along with A6's
choices and A7's windows. A rule call the Decisions table doesn't settle (which fallback by default, what the maker hears)
goes in the step's Noticed with a recommendation, for the user.

**The foundation first: the prompt, then the engine, then the UI** (the user, 2026-10-28: "the prompt has to be prepared and
get this information cleanly so we can act upon it"). What research says today can't be acted on: in The Challenge 41's
episode 5 every pair was redrawn, and its research says so only as 29 notes in `notableTwist`, one per person ("Re-paired
with ..."), mixed with a coin toss and someone leaving. So right after A9, before A10 (whose draft slots per group and A11's
teams read the format's state rather than guess it), the engine track does the format foundation, one part a session:

- **F1. Study The Challenge.** Past seasons give the ground truth: their stages are known, so the study can check how each
  change would have come in live. For each season (41 on tape; 40 and 39 as they land; Survivor 49's swap and merge and The
  Traitors 4's twists as the other shows' checks), a timeline: each episode's grouping (pairs, teams, each for themselves,
  and who's with whom), its phase, how people go home, and every change, with its kind, the episode it took effect and how
  the show brought it in (announced ahead, at the episode's start, mid-episode, at its end). Then today's prompt against it:
  for each change, what that episode's research said, where, and whether the engine could act on it. Written up as its own
  doc for the user.

  **As built (F1, 2026-10-28, on `engine`, not merged; no migration, no engine change).** One session, after `lane.js sync
  engine` (already up to date; 906 tests).
  - **The doc:** [STUDY-format-changes.md](STUDY-format-changes.md), for the user: how it was made, nine findings, each
    season's changes and what research said, the proposals for F2 (the change vocabulary, the format state's shape, the
    prompt section: the user's to approve at F2's merge), what it means for F3, A10, A11 and A12, six open questions, and the
    generated timelines.
  - **The ground truth as data:** `tests/fixtures/format-timelines/<show>-<season>.json` for The Challenge 41, 40 and 39,
    Survivor 49 and The Traitors 4, made once from each season's Wikipedia page (the raw wikitext's tables; the revision in
    each file; the parse a one-off, kept out of the repo) under the tapes' cast names. Each episode's phase, how it was played
    (`everyone | tribes | teams | pairs | individuals | mixed | none`), who went home and how, who came in; each grouping as
    **spells** (who was with whom, `from` [episode, start | mid], `shown` [episode, start | mid | end]); a fixed grouping
    marked `label` (Vets / New Threats); the season's twists, phases and role changes with their words.
  - **`scripts/dev-test/format-study.js`** (no database, bot or network): the timelines, every change worked out by
    comparing one spell with the next (its kind from the proposed vocabulary, `brought`: at the start, mid-episode, at the end
    of the episode before, announced ahead), how long each group lasted (`lifetimes`, with or without an exit ending a group;
    groups shown but never played apart), the state at an episode's end (`stateAtEnd`, what F2 scores against), and, for a
    season on tape, what research said about each change (`researchSays`: the structured fields the engine reads, `newGroup`,
    `merged`, the roles, and the free text it doesn't, `rulesNote`, `summary`, `notableTwist` with how many of the change's new
    groups a note names together; in the episode it was shown, took effect, and the one after, marked late). `--md` prints
    the doc's tables; `--check` each fixture's problems.
  - **Findings, in short:** of 35 changes on tape the engine could act on one (The Traitors 4's recruit); The Challenge's
    prompt asks about the cast's group (Vets / New Threats, eras) under the built-in format's word, "agency", so its pairs are
    never data; the pairs are in `notableTwist`, a person at a time, without saying whether they're this episode's or the
    next's; the Lock In left no pairs at all; a format change also broke who went home (Episode 12's pair exit, Episode 16's
    claim, a wrong exit cascading); a newcomer (Jonna) is never in the cast; groupings lasted one episode each on The Challenge
    41's rotating pairs and all of The Challenge 39, up to the whole season elsewhere.
  - **The Challenge 40** finished its full research during the step and is loaded into this lane's database (`tapes.js load
    the-challenge 40`): its first golden replay, `golden.js --seasons="the-challenge 40"`, 22 games, 3,772 reads, every one the
    same. No engine code changed, so no other replay was needed.
  - **Tests:** `tests/format-study.test.js` (new, 13): every fixture sound and naming its revision; a broken one's problems
    (reported, never thrown on; other files in the folder skipped);
    when a spell plays; lifetimes (a re-pairing, a mid-episode claim, down to one, a re-formed group a new run, never played,
    a tribe losing someone with and without exits ending it); changes (a swap of every group, a claim, a split, a merge, teams
    formed, a change of play with no spell, a newcomer in a leaver's place, when each came in); what research said (free text,
    `newGroup` acted on, late, nothing, not on tape; a twist's words with hyphens; a recruit); the state at an episode's end;
    the review's cases (a stray `newGroup`, a group's whole name, a shrunken tribe kept mid-episode, moves to and from being
    alone, a newcomer who came in earlier); and the studied seasons' numbers. `npm test` 919.
  - **Code review** (`/code-review`, before the commit; it ran this time). Taken: `newGroup` counted only on someone the
    change moved and only for a grouping change (it counted anyone's, for any change); a tribe that lost someone could read
    as changed in an episode a mid-episode spell kept it (a line keeps every member list it played under); a move between a
    group and being alone wasn't a move, and a newcomer counted only in the episode they came in; a malformed fixture threw
    instead of being reported (and `shown`, a twist's moments and `playShown` weren't checked); a group's name matched by its
    first word ("New Threats" by "new"), and a first name another of the cast shares; a non-fixture file in the folder threw;
    the command line ran every season on one argument; a dead branch for spells from an episode's end; regexes compiled per
    call. Declined: none.
- **F2. The research prompt's format section,** the same for any show: the format's state at the episode's end, as data (the
  grouping, who's with whom, the phase), and what changed in the episode, as a kind from a small vocabulary with the episode
  it took effect, and how sure. Proven by asking recorded episodes again with it, through the local bot only, and scoring the
  answers against F1's timelines, as the bingo check was proven.

  **As built (F2, 2026-10-29, on `engine`, not merged; no migration, no engine change; the vocabulary, the state's shape and
  the prompt section are the user's to approve at F2's merge, as the study says).** One session, after `lane.js sync engine`
  (already up to date; 919 tests).
  - **The section** (`db/episode-research.js`; its vocabulary, loose read, checks and our comparison in the new
    `src/lib/game/formats/format-state.js`): every show's research now answers `formatState`, how the game is organised at the
    END of the episode, going into the next one: `playedAs` (everyone, tribes, teams, pairs, individuals, mixed, none,
    unknown), `phase` (the show's own name), `groups` (each with its name if the show gives one and its members by the list's
    names; `[]` everyone for themselves, `null` not known), `alone`, `newcomers` (name, who they replaced, their group),
    `wentHomeAs` (individuals, groups, nobody, unknown) and `changes` (each a `kind` from the study's nine, `when` start /
    mid / end, `from` the episode it takes effect, `what`, `sure` high / low). It sits after the rules note and before the
    cast in the schema and the skeleton (shown at its don't-know values, groups `null`); the prose prompt asks it as "How
    the game is organised", with the vocabulary.
  - **The prompt's words** (`formatLines`): "HOW THE GAME IS ORGANISED", the groups going in as far as we know (the latest
    earlier episode's stored answer that says who is with whom, `formatGoingInto`, read beside `groupsGoingInto`: its groups
    as lines, "Ann & Bea" for an unnamed pair, "Hina: ..." for a named tribe, who's on their own, anyone no longer on the list
    left out, a newcomer since kept), "as of the end of the last episode" or "of episode N" when older; without one, that the
    names' groups above are the cast list's and may be only a label (Vets / New Threats), or that there are none. Then the
    episode numbers a change at its start and at its end take effect from. Never a format's built-in word for its groups:
    the section says "tribes, teams or pairs" and the groups' own names. The old newGroup paragraph's plural is spelt right
    now ("agencies", `plural`), and it and the section no longer each claim to be "the only place" a change is recorded.
  - **newGroup and merged kept beside it**, asked as before: a live season's staging reads them (a swap's group moves, the
    merge's phase start), and they keep doing so until F3 reads the new state; meanwhile the two cross-check each other (a
    named group that disagrees with someone's newGroup is a problem the reviewer sees). Staging is unchanged: the research
    store-and-stage regression (`tests/harness/research-store-regression.js`, before against after) differs only in the new
    key in stored answers and the pasted text that carries it, every `season_decisions` write the same. (The harness had
    gone stale on the group queries; `fake-research-db.js` answers them now, and `formatGoingInto`'s.)
  - **Old answers parse** (`validateLeniently`: no section is `null`, as the rules note), and a section said loosely is
    repaired and reported, never a failed run: a value outside a list takes its catch-all (`unknown`; a change's `sure`
    `low`, its `when` null), a change of a kind outside the vocabulary is dropped, "Pair" reads as `pairs`. The review's
    checks (`formatStateProblems`, never fatal): names made the list's own (a newcomer's own name first, then the loose
    match), anyone it can't place dropped, someone in two groups, a group of one read as on their own, someone still in but
    nowhere, a leaver still grouped, "nobody left" when someone did, and a whole pair or team said to go home together when
    a partner going in didn't (F1's finding 6). A second pass fills the section in field by field (`fillFormatState`; the
    groups and who's alone as one answer). A pass asked about only some of the cast (a commissioner's paste for whoever
    isn't settled: `formatForAsking`) and a re-ask of a few questions (`onlyFormat`) leave the section out.
  - **Our comparison** (`changesBetween`): what changed between two states, from who is with whom, never anyone's label: a
    split, a merge, teams or pairs formed (the shape before as it was played, so a pair losing someone doesn't make pairs
    stop being pairs), a swap (who moved: a group carries on from one before when it has its name or more than half of each
    is the same people; everyone in a group that's new, and whoever joined one that carried on, moved; a leaver's partner
    left on their own didn't), a newcomer (taking a leaver's place is a newcomer, not a swap); one group or none is the game
    not divided. `crossCheck`: a change both find is as sure as the answer says; one only one side finds is unsure; one our
    code can't see (a phase, a twist, a role) is the answer's alone. F3 builds the state over time on these.
  - **The proof** (`scripts/dev-test/format-asks.js`: `plan`, `prompt`, `ask`, `reread`, `score [--md]`): the study's set
    asked again through the local bot only (http://127.0.0.1:8765, never this lane's LLM_BROWSER_API_URL; waiting for the
    bot and pausing between questions so the tapes recorder gets its turns; stopping on a usage limit), the whole
    full-research prompt as the bot's run sends it, each answer kept beside the tapes (`~\rfl-tapes\<show>\<season>\format\`,
    never over a tape) and read by the app's own parser and checks, nothing written to the database. The state going in is
    this run's answer for the episode before, else the fixture's truth at its end (the first of a run, or a gap). Scored
    against F1's fixtures (`truthAtEnd` on `stateAtEnd`; at an episode's end before a change at the next one's start, either
    state counts): how it was played, each group found exactly, each person's group, newcomers, wentHomeAs, and the changes
    the fixture says were shown in that episode, the answer's own and ours. The results: STUDY-format-changes.md, "F2: the
    format section asked again". In short, 23 episodes: who is with whom said in all 23, exactly right in 18; 104 of 109
    groups and 281 of 298 people (94%) placed right; every Survivor 49 tribe through both swaps and the merge, 87 of The
    Challenge 41's 91 pairs (the Lock In's 12 too, where F1 found nothing); the newcomer; 21 of 23 on whether a whole group
    went home; 18 of 24 changes named by kind, 17 with their episode; our comparison found 9 of 14 grouping changes, all 9
    sure, and made the answer's one wrong structural claim unsure. Before F2, none of those grouping changes was data. The
    words were tuned once after two answers (re-drawn pairs are a `swap`), and those two asked again; one answer that
    wasn't valid JSON was asked again. The golden replays: 6 seasons, 138 games, 15,753 reads, every one the same (no
    engine code changed; the tracker unchanged, `--check`). No zt- fixture: nothing the engine reads changed.
  - **Tests:** `tests/format-state.test.js` (new, 13): the schema on every show and not on a cut-down ask, the vocabulary the
    study's word for word, the skeleton, the prompt's words (the groups going in, older, none, a label, never "agency", the
    prose), old and new answers, loose ones repaired, the review's checks, a second pass, the state going in, our comparison
    (a re-pairing, a claim, a leaver, a newcomer in a leaver's place, the merge, a split, teams and pairs formed, a partial
    swap, merged then individual, someone joining from alone, not known), the cross-check, the scorer's truth on the five
    fixtures, and the scorer itself; the code review's cases. `research-review.test.js`'s pinned sentence moved to the new
    words. `npm test` 932.
  - **Code review** (`/code-review`, before the commit; it ran this time). Taken: a commissioner's partial paste would have been
    asked the whole-cast section and replaced the stored one with a gutted state (now left out of a partial ask); a newcomer
    from an earlier episode was dropped from later groups (the earlier newcomers are passed to the checks); the whole-pair
    check read a stale going-in state's partners who'd left since, and missed trios (only who's still in counts; a trio
    checked, and "no group going in left whole"); a second pass could mix one pass's groups with the other's alone; newGroup
    and the section both said "the only place"; a newcomer whose name a cast member's loosely matches was made that person;
    `formatGoingInto` ran in series (now beside `groupsGoingInto`); a redundant check in the prompt. Declined: none. What
    changed after it, from the answers, reviewed by hand: the kinds' words (re-drawn pairs are a `swap`), the review's check
    of an answer against itself (a split said with groups still listed, a merge with several, teams or pairs formed with
    none; not for a change announced further ahead than the next episode, so `validateResearch` takes the episode), a
    leaver's message, and `reread` keeping each answer's groups and refreshing its Markdown. The store-and-stage regression
    and `npm test` (932) run again after them.
- **F3. The engine's format state over time,** built from each episode's report, with the changes found by comparing an
  episode's state with the one before (our code, not the bot's labels), what reads it (A6's choices, A10's slots per group,
  A11's teams, A12's stages and triggers) and each piece's fallback. A corrected report works out everything after it again.

  **As built (F3 part 1, 2026-10-29, on `engine`, not merged; no migration; the engine's games don't read it yet).** One
  session, after `lane.js sync engine` (already up to date; 932 tests). Two parts: this one the state over time, its readers
  and `newGroup`; the second (next) newcomers into the cast and research, the timeline from the database and what reads it
  first, with a zt- fixture.
  - **The state over time** (`src/lib/game/formats/format-timeline.js`, pure, browser-safe): `buildTimeline(reports, { cast,
    start })` from each episode's report (`reportFrom`: its stored format section, who it has going home, `merged`), built
    from every report at once, so a corrected one works out everything after it again. Per episode: who is with whom at its
    end (going into the next; a group down to one is that person on their own), whether that's **sure** and, when not, why
    (no research, no section, groups not said, carried on from an earlier episode, a change one side alone sees, an answer
    whose changes its own groups don't show, nothing before it to check against, compared with an assumed start); how it was
    **played** (the groups going in; the end's when a change came at its start, Survivor's swaps and the merge; the start's
    when one came partway, Q3, with the new ones as `mid`; none when it was played apart); its **changes**, our comparison
    (`changesBetween`) crossed with the answer's (`crossed`: both sides, as sure as the answer says; one side, unsure; a
    phase, twist or role the answer's alone; one announced for later than the next episode `ahead`, not held against this
    end); which groups **went home whole**, from the exits and the groups in play (never the answer's word: `wentHomeAs`
    ours, theirs, agree); who's **unplaced** (still in, in no group, while the game is divided); and newcomers.
  - **What F2's proof asked for:** `playedAs` is read with the groups (an episode played alone between two grouped states,
    The Challenge 41's 9, is a split at its start, unsure unless the answer says it too, and the new groups at its end); an
    answer that contradicts itself is unsure, and the next answer settles it (The Challenge 40's 9 and 10); our
    divided-to-not-divided matches the answer's merge or split either way, taking its kind, and `merged: yes` the first time
    makes our merge the answer's too; a twist or a role never moves a game's structure; a whole pair going home comes from
    the exits.
  - **Lifetimes and spells** (F1's questions 1, 3 and 4 as recommended, the user not having answered): a group is its exact
    members, less who went home (a tribe that loses someone carries on; a pair down to one is none); any join or move ends
    it; the same people together again later are a new group; someone the answer before had nowhere, placed by the next, is
    that answer filled in, not a join. Each group: who, `shown` (the episode whose end first listed it), the episodes it
    `played`, what ended it (`left`, `split`, `merge`, `changed`, with the change's id) and `never` (shown, gone before it
    played: Cara Maria & Leo, Theo & Dee). Only while the game is divided: one group of everyone isn't one to ride. A
    **spell** is the groups as a whole from one change to the next (a group going home doesn't end it).
  - **The readers, each with the fallback a spec carries** (`FALLBACKS`: carry on, void, next stage; 'void' when none is
    given, the safe one): `goingInto(n)` (the state at a lock, sure or why not, and changes announced for it), `playedIn(n)`;
    **A6's choices** `groupChoices(n)` (sure groups, else void, or the last known with carry-on) and `heldThrough(group, n)`
    (whether a group picked at the lock played it as picked); **A10's group slots** `groupSlots()` (per group: opens after
    the episode that showed it, scores the episodes it then played, drops after its last; void for an episode whose lock or
    play wasn't sure, and for the next episode when it never played, F1's Q2); **A12's side stages** `sideStages({ after })`
    (a spell that held N episodes opens after the Nth, scores from the next, closes when it changes; not when the report of
    the Nth already shows it gone, as a re-pairing at that episode's end does) and **stage triggers** `stageTriggers(kinds)`
    (`MAJOR` by default, F1's Q5 as recommended: teams formed, pairs formed, split, merge, `swap-all`; `act` the sure ones
    from the episode they take effect, `held` the unsure ones, flagged, never acted on); `castAt(n)` (the cast and newcomers
    still in); **A11's teams** read `playedIn`. `timelineDiff(before, after)`: the first episode told differently, the
    changes gone, new or told differently by id (what a stage started on one now gone undoes), the groups that moved.
  - **Tribe moves come from the section; `newGroup` asks only for whoever moved and went home the same night; `merged`
    stays** (the decision F2 left for F3, by the proof's numbers). Each person's tribe move is worked out from the section
    (`FormatStates.movesFromState`, `applyStateMoves`), once, in `validateResearch`, with the same groups going in the review
    shows (a league's own cast too), and stored as `newGroup`, which staging and re-staging read as before. The section
    speaks for everyone it places on a named tribe or team, moved or not, over any `newGroup` an answer carries (the
    difference is reported); a tribe's name said another way ("Hina Tribe", "the new Hina") is that tribe, kept as staged
    (`tribeKey`); a name no tribe going in has is a new tribe (a swap's, the merge's); pairs (and named pairs with a trio,
    unless every group is a tribe already), a group without a name and a section that doesn't say move nobody. Anyone it
    doesn't place keeps what the answer said: beside the section `newGroup` asks only for **someone who moved and then went
    home in the same episode** (the groups at the end can't hold them; its old ask of everyone stays for a pass about some of
    the cast, which leaves the section out); the Tribal check still fills in a missed move, but never for someone the
    section placed, and when the section's change came at the episode's end it reads the groups going in (the vote was
    before it). On Survivor 49's kept answers the section's moves are 11 of 11 at the first swap and 6 of 6 at the second,
    none wrong (`newGroup`: 1 of 11 and 6 of 6); the merge moves nobody either way (neither named the merged tribe). On The
    Challenge 41's Episode 9 the old `newGroup` named partners as groups (22 tribes called after people); the section moves
    nobody there. `merged` was right at the merge, the phase cues read it, and the timeline crosses it with the state's
    merge, so it stays asked.
  - **`changesBetween` fixed** (F2's): nobody moving, nobody new and every group carrying one on is no change, whatever the
    sizes read as (a tribe of two beside one of three read as pairs turning into teams when an answer filled someone in);
    pairs joined by newcomers into trios is still teams formed. F2's scores the same (`format-asks.js score`).
  - **The proof** (`scripts/dev-test/format-asks.js timeline [--md]`, no bot: the state over time built from F2's kept
    answers, an episode not asked carried on with the fixture's exits, the first going-in F1's truth, scored against F1's
    fixtures; the tables in STUDY-format-changes.md, "F3: the state over time"): of 23 episodes, 20 sure, the 3 unsure exactly
    the 3 answers that contradict themselves; **11 grouping changes called sure, all 11 right, none wrong** (every swap,
    Survivor's two swaps and the merge, the Lock In's pairs, the claim, The Challenge 40's teams and its split); of the 13
    the fixtures have within reach, 11 sure, 1 unsure (the episode played alone, said only by `playedAs`), 1 missed (Theo's
    MRI swap, which the answer missed); played apart 3 of 3; whole groups home 22 of 23 from the exits (the answers' word
    21); **lifetimes 85 of 85 exactly** (the episodes each group played, for every group the fixtures have; 3 the answers
    made up); side stages after 11 on The Challenge 41 (the locked pairs, closed by the claim at 16), after 5 on Survivor 49
    (closed by the swap at 6), after 4 on The Challenge 40 (the eras, closed by the split at 10), as F1 measured.
  - **Staging, before against after** (`tests/harness/research-store-regression.js`, with F3's scenarios added: a swap
    answered with `newGroup` alone, with both, with the section alone; someone swapped and voted out the same night; the
    merge): every write, every stored answer and every `season_decisions` row the same, but the section-only answer, which
    stages its two moves now (none before: the old code read only `newGroup`) and stores them as `newGroup`. The golden
    replays: 6 seasons, 138 games, 15,753 reads, every one the same (run before the code review's fixes and again after); the
    tracker unchanged (`--check`). No zt- fixture: no game reads the timeline yet (part 2's).
  - **Tests:** `tests/format-timeline.test.js` (new, 13): a swap at the start and the merge (sure, played by the new
    tribes, a tribe losing someone carrying on, lifetimes and spells, triggers, a twist never one); the merge said only by
    `merged`; re-drawn pairs, a newcomer in a leaver's place, an episode played apart, a pair home together, a claim partway;
    the readers and their fallbacks; an unsure change and a contradicted answer settled by the next; a missing report carried
    on and a change announced ahead; someone left out filled in, the same people again a new group; a correction and its
    diff; `reportFrom` and an assumed start; `movesFromState` (names said another way, named pairs with a trio, small tribes
    already known, the merge); `newGroup` narrowed beside the section, asked of everyone in a partial pass, kept from an old
    answer; the review's moves (the section wins, a leaver keeps the answer's, pairs move nobody); the Tribal check beside the
    section; staging a section-only answer through the in-memory database; the code review's cases. The pinned prompt
    sentences moved (`format-state.test.js`, `research-review.test.js`), and `format-proposal.test.js` checks both asks.
    `npm test` 947.
  - **Code review** (`/code-review`, before the commit; it ran this time). Taken: the moves were worked out twice (in the
    review and again when staging, from the season's cast only, so a league's own cast would have moved everyone onto the
    tribe they were on; now once, in the review); a tribe's name said another way moved its whole tribe every episode
    (`tribeKey`); named pairs with a trio got past the pairs guard; dropping `newGroup` lost who moved and went home the same
    night where the Tribal check can't tell (it's asked for them alone now); the Tribal check could move back someone the
    section placed, and read their end group for a vote before a change at the end; a spell kept counting episodes after it
    ended; an unsure change of unknown timing left the play sure; the first lock didn't read a sure start; a low-sure split
    made the play sure; `changesBetween`'s shortcut hid pairs turning into trios through newcomers; the old answers' keeper
    reached a cut-down ask (gone: the schema keeps `newGroup`); the scorer crashed on an episode the fixture lacks; the test
    stubbed the embeddings after the module had bound them. Declined: none.

  **As built (F3 part 2, 2026-10-29, on `engine`, not merged; no migration).** One session, after `lane.js sync engine` (already
  up to date; 947 tests). Where the engine first reads the state, and newcomers.
  - **The season's timeline from the database** (`db/format-timeline.js`, new): `seasonFormatTimeline` builds it from the
    season's stored combined research (one query, `REPORTS`: each answer's format section, `merged`, and the names of who it
    has going home, worked out in the database so the checklists' sources never leave it) and the cast, on read, never
    stored; `timelineForSeason` (by `show_seasons.id`), `timelineForShow` (a league's show slug and season), `seasonReports`,
    `reportOf`. No cache: the research context reads it once an episode, a game's grading once a read (only for a game that
    asks a group question each episode); the plan's earlier note on caching by the research rows' times stands.
  - **The groups going in, from the timeline** (`formatGoingIntoFrom`, `formatGoingInto` kept as its database wrapper): the
    timeline's `goingInto`, so whoever went home since the answer that said it is dropped (and a group down to one is that
    person on their own), as `{ episode: the answer that said it (a carried state's), state: { playedAs, phase, groups, alone },
    newcomers, sure, why }`. F2's prompt words are kept (the same lines for the same data); when it isn't sure, one line more:
    "We aren't sure of these: an earlier answer may have them wrong, so check them against what you find." The review's
    whole-pair check reads the same groups. The context (`fromTimeline`, both ways in: a season's and a league's) builds the
    timeline of the episodes before the one asked, once, and reads everything below from it.
  - **Newcomers asked about, staged, cued.** The context adds the newcomers the timeline has still in going into the episode
    (`Timeline.newcomersIn`: not on the cast research asks about, matched exactly, never loosely) after the cast, as
    `castNames` and `ctx.newcomers`: from the episode after the one research says they came in, they're on the checklist like
    anyone, so they get an entry, results and an exit, staged for the season under research's name for them (the quick check
    asks about them too: it reads the same context; `researchItems` keeps a name the cast's forgiving match would make someone
    else with an entry of their own, a newcomer "Joy" beside "Joy Jones"). Applying their results to a game skips them (`applyDecision`: not on its
    cast) until a person adds them to the cast every league sees. **The cue, as data, no screen:** `Timeline.newcomerCues` /
    `seasonNewcomerCues(pool, seasonId)` (who research says came in that the cast doesn't have: name, the episode, for whom,
    the group they joined, the episode they left), and a line in the review of the episode they came in ("Joy Jones came in this
    episode (for Fay Fox) and isn't in the cast: research asks about them from the next episode, and their results reach a game
    once they're added to its cast"). A9 part 2's reverse count isn't touched (Noticed).
  - **One word for the groups beside the section** (`Timeline.groupWord`, the context's `groupWord`, passed to
    `researchSchemaFor`'s new third argument and to `buildPrompt`): the season's word when the timeline says it (the groups
    going in were played as tribes or teams: "tribe", "team"), else the show's own word as before (its data: Survivor's tribe,
    Dancing with the Stars' and Love Island's couple, Big Brother's alliance), never a list of ours; pairs never set it
    (staging moves nobody onto a pair). The line beside the names, when their groups are only a label (`labelsOnly`: the
    section is asked, the timeline has pairs going in, and none of the names' groups is one of them by name: The Challenge's
    Vets and New Threats beside its pairs), says so and names no word: "The group after each name is the one our records give
    them going INTO this episode, which may be only a label the show gives them (like Vets and New Threats); who plays with
    whom going in is below. If people moved between tribes or teams in this episode, say so in formatState below; someone who
    moved and then went home in this same episode: the tribe or team they went home from, in newGroup." So The Challenge's
    prompt no longer says "agency" once the timeline knows its pairs; before that (its premiere, a season before the section)
    it still says its show row's word (Noticed: a data fix). Survivor's words are unchanged.
  - **A6's group question on the timeline** (`Timeline.groupFacts`, `answer-points.ts formatGroupsFor` and `answerFacts`,
    `answers.ts`, `answers.js onTimeline`). **Which source wins where:** a group question asked each episode, about the one
    episode (`Spec.readsTimeline`, one test for the grader and the server), reads the timeline's groups at a lock from the
    first one with **pairs the league doesn't hold** going in (`Timeline.unstaged`: pairs, none of them a group the league has
    by name; movesFromState stages nobody onto them) and every lock after it, through the league's latest episode (one with
    everyone together, or each for themselves, offers nothing; one past the last report offers nothing unless the game follows
    the people: its groups aren't known yet), until tribes or teams are going in again; **everything else stays the league's
    own groups as today**: Survivor's tribes (its staged tribe moves, accepted by a person), small tribes one of which the
    league has (late in a pre-merge), a tribe an answer left unnamed, a group question asked once or over a window, every
    season before the section. On the timeline: the faces are the groups going into the lock ("Ann & Bea", a trio "Ann, Bea &
    Cy", a named one by its name; ids the timeline's; members matched to the league's cast the forgiving way), named in the
    read's `groups` up to the lock after the viewer's mark; graded on the groups that played the episode (`played.held`: the
    ones offered that played it as offered, and one whose members all went home in it, a pair voted out together; a change at
    its start re-draws, one partway keeps the start's, F1's Q3; an episode with research but no format section, or none while a
    later one has it, played unsure), the right groups the ones the right people were in as offered. **The fallback, a spec
    setting** (`ask[].fallback`, the vocabulary's `ask.fallback`: `void` the default, `carry-on`, `next-stage` A12's and
    'later'): void when the groups at the lock, or as played, aren't sure (off, no points either way: nothing is offered at an
    unsure lock, and the read says why, `offWhy`), and a pick of a group that didn't play as offered is void for whoever made it
    (neither right nor wrong; a wager on it stakes nothing); carry-on follows the people (a group graded by who was in it as
    offered, whatever happened to it; an unsure lock offers the last known). Waiting while an episode with results has no report
    yet (void once the game is over: its research never came). The tables (`leagueAnswers`, `answerStanding`, `sheetNights`,
    where a void pick is a night's "didn't count") grade with the same facts; the season's research is read once a grading
    read (one query by the show's slug). The sheet's face for a group shows its whole name. `specProblems` takes
    `fallback` only on a group question asked about each episode; `specWaitsFor` and `playable` treat `next-stage` as not yet
    built. The default is the user's (Noticed). Screens are U1's.
  - **A pass about some of the cast** (a commissioner's paste for whoever the stored answers don't settle, which asks no
    section): the stored section, the whole cast's, now says the moves of whoever it asked again (`validateResearch`'s
    `storedState`, from `researchFromPasteForLeague`), as a full pass's would (F3 part 1's Noticed).
  - **The proof.** Unit tests (`tests/format-timeline-reads.test.js`, new, 9): the timeline from stored rows (the query, who went
    home, only the episodes before, a malformed row), the newcomers in and the cues; the groups going in (who left since
    dropped, a carried state's answer, unsure said in the prompt, nothing before the first answer); one word (tribes, pairs
    falling back to the format's, a word that's neither, the schema's newGroup); the research context through the in-memory
    database (a newcomer cued in the episode she came, on the next episode's checklist and its groups going in, her exit staged
    for the season, never "agency", the label line); a newcomer named like someone on the cast staged as their own person; a
    partial pass moved by the stored section; which source wins and the pairs offered and played (a re-drawn pair not held, an
    unsure lock, everyone for themselves, Survivor's tribes not on the timeline, small tribes and an unnamed one staying the
    league's, a lock past the last report, no section played unsure, a pair voted out together held, the forgiving match); the
    grading (held right, re-drawn void, a wager on a void pick, nobody right, carry-on, an unsure episode off, no report
    waiting, void once the game is over, a window over two the league's, the shared test); the spec's fallback; the show's own
    word (a couple). The pinned prompt sentence moved (`format-state.test.js`: no "agency" beside the section either). `npm
    test` 956. **A zt- fixture
    through the engine's API** (`scripts/dev-test/check-format-groups.js`, new, 25 PASS, on new-fixture's couch): ZT Survivor 51
    turned into pairs by its stored research; a game of questions asks "Which pair wins immunity?" void by default and
    following the people; the faces are the six pairs going into 6, never the league's tribes (a tribe refused, 400; sam,
    behind, waits); Episode 6's research re-draws two pairs at its start and brings in Zed Newman; graded on read: jordan's held
    pair right (2), riley's re-drawn pair void (right null) and wrong when following the people, the Games tab the same (4);
    Episode 7 offers the pairs after the swap; Episode 7's research asks about Zed, a paste stages his exit (pending), the
    desk's cue names him (in at 6, for whom, out at 7). `check-questions-who.js --api` (Survivor's tribes) ALL PASS, unchanged.
    **Staging, before against after** (`tests/harness/research-store-regression.js`): byte-identical (the fake database
    answers the timeline's query, and a show's own word for its groups). **The golden replays** (`golden.js`, every season loaded here: The Challenge 39 isn't yet, Noticed): 6 seasons, 138 games,
    15,753 reads, every one the same, before the code review's fixes and again after them. **The tracker**
    unchanged (`--check`: the group answer's row was ✅ already; what changed is where a paired season's groups come from).
    **`format-asks.js timeline`** unchanged: its code paths aren't touched (the timeline module only gained readers; its totals
    are F3 part 1's: 23 episodes, 20 sure, 11 sure grouping changes all right, lifetimes 85 of 85).
  - **Code review** (`/code-review`, before the commit; it ran this time). Taken: a lock past the last report fell back to the
    league's tribes (now the timeline's, unsure: void, so a pick can't be made on one source and graded on the other); an
    episode with research but no format section played as sure; a pair kept at a re-draw that went home whole wasn't held, so
    "which pair goes home" could never be right there; small Survivor tribes with one unnamed could move its group questions to
    the timeline (now any league tribe by name keeps them the league's); the word was a list of ours overriding the show's own
    (Couple, Alliance: now the show's word stands unless the timeline says tribes or teams); a night counted a void pick as a
    miss; the sheet showed a pair by its first member's first name; members matched only exactly; a newcomer "Joy" beside "Joy
    Jones" staged as Joy Jones; the label line on any unnamed going-in groups (now beside pairs only); an episode research never
    covered waiting for ever (void once the game is over); the timeline read in two queries; two tests for which questions
    read it; the check's header didn't say it's one fixed scenario. Tried and dropped: a 5-second memo of the season's timeline
    for a request that grades twice (it graded on the timeline from before research that had just landed). Declined: the
    reviewer's altitude point (one source of groups instead of switching at pairs): switching only where the league can't hold
    the groups is the step's design, and its edges are the fixes above; the premiere of a paired season is in Noticed.
- **F4. Blind replays:** a taped season replayed as if live (above), every game the tracker says it plays, The Challenge's
  seasons first.

  **As built (F4, 2026-10-29, on `engine`, not merged; no migration).** One session, after `lane.js sync engine` (already up to
  date; 956 tests). The local bot didn't answer during the step (no reply after 210 s, the recorder's asks too, from 07:15 UTC),
  so nothing was asked of it: the replays run on what's on tape.
  - **The Challenge 39 loaded** (`tapes.js load the-challenge 39`, no bot) and its fixture moved to the tapes' cast names (190
    names, each matched one to one; `format-study.js --check` sound, its study re-read with its research on tape, the study
    doc's appendix regenerated). The golden replays read seven seasons now.
  - **`scripts/dev-test/blind.js`** (new; `run`, `games`, `sections`, `summary [--md]`, `down`): a taped season replayed as if
    live through the app's own code (playtest.js's harness, exported for it: the season's copy, the seats, the draft, the
    lineups and picks, waivers, the results through the bot's own run on Autopilot). **Every game the tracker says plays:**
    each ✅ row's spec once (81 distinct), checked on the season by the engine lab's own `labCheck`, those that play started
    with `labStart` before the premiere on a zt- couch of their own (from what was known then: the season's rules, and of its
    format nothing; the app has nowhere to hold a timeline's `start`, the previous season's format or a rules answer as of the
    premiere, so none was passed, and the premiere item below says where one would come from), four seats (the friend-group archetypes) joining through
    Join; a group question asked each episode also played following the people (`fallback: 'carry-on'`); and, since the
    tracker's group question is Survivor's (which tribe wins immunity), The Challenge's own in its daily challenge
    (`dailyWin`), both ways. Before each episode, the moves and every open question answered by habit through `answers.ts`
    (an answer for every kind of question, each one the engine's own `answerProblem` takes), its choices as the app offers
    them at that lock. **Each change arrives only in its episode's research:** the tape's answers, with the format section the
    tapes don't have (the local bot's own answer where F2 asked that episode again, 23 of 88; else a stand-in from F1's
    fixture at the episode's end, as research would say it if it were right) and who went home as the fixture has it (the
    tapes' wrong exits: The Challenge 41's 11 and 14), the quick check's wording and the fixture's confidence, so a held
    exit (the playtest report's findings 2 and 3) doesn't stand in for a format change. After each episode, the format state
    over time as the app reads it from the database (what changed, sure or held, the stage triggers, group slots and side
    stages it opens), what the next prompt would carry (the groups going in, sure or not, the newcomers on its checklist, the
    word for its groups), and what each game did. At the season's end every question read again: anything answered still
    waiting never settled. The checks: every game over, every score a finite number, nothing scored on an off question or a
    void pick, no answer refused, no problem in the moves. Records: `~\rfl-tapes\replays\blind\<show>-<season>.json` and
    `.md`; the study doc has the tables.
  - **What it found, and fixed in the grader** (each would have scored nonsense through a format change nobody announced):
    - **A paired season's premiere** (F3 part 2's item): The Challenge 41's group question offered the league's own groups,
      the cast list's labels (Vets, New Threats); every pair is one of each, so everyone who answered was right. Now an
      episode research says was played in pairs the league doesn't hold, when nothing said so going in, is the timeline's
      with nothing offered (`groupFacts`'s `pairedNow`): off once its research lands.
    - **Groups the league holds that nobody plays in:** The Challenge 40's eras are its league's groups (the cast list's), but
      they were teams only in Episodes 3-9; in 1-2 everyone played together (all four eras right) and from 10 each for
      themselves (graded on the daily winner's era). Now, where the league's own groups would be read, an episode whose own
      report says it was played without groups (`apartNow`), or going into which nobody is in a group (`noneGoingIn`: nothing
      offered at its lock either), is off. Survivor after its merge reads the same; its tribes before it stay the league's.
    - Each off entry says why (`off`: 'unknown', 'apart'), so the verdict and the sheet's `offWhy` give the real reason ("It
      was played without pairs or teams", "Who played with whom wasn't known going into it"), not "isn't sure".
  - **What it found and left:** a question about the finale never settles on The Challenge 41 (its group question, the week's
    points leaderboard): the finale's results stay early (the playtest report's finding 20, the survivor lane's), so its moments
    never come in. A grader fix (off once the game is over) was built and taken out at the code review: the game is over as
    soon as the finale's early results land, so every finale moment question would have read off through the hours before its
    full research, on every finale night. The replay reports these apart ("waits on early results"), and the fix stays
    finding 20's (Noticed). **The Challenge 39's fixture had no final** (F1 recorded nobody leaving in 18-19), so its blind
    replay crowned nobody: its final added from the same Wikipedia revision (Jay 7th, Moriah 6th, Berna 5th, Corey 4th,
    Colleen 3rd, Nurys 2nd, Emanuel the winner; which of the two episodes Jay and Moriah left in, the tapes' recaps).
  - **The results** (the study doc's "F4: blind replays" has every season's tables): **every game ended on all five seasons**: The Challenge 41
    51 of 51 played through, 40 and 39 50 of 51, Survivor 49 69 of 69, The Traitors 4 51 of 51 (the tracker's 81 distinct specs:
    51 play on each Challenge season and The Traitors, 69 on Survivor; the rest name an idol, the merge or secret roles the show
    hasn't). The one game short on 40 and 39 is the tracker's w072 ("will anyone quit?", asked once): nobody quit, and "no" waits
    for every episode's moments while 40's finale and 39's Episode 3 stayed early (finding 20's; the replay classes it so now).
    On The Challenge 41, "which pair wins the daily challenge" offered each episode's new pairs at every re-pairing (2-8), the
    Lock In's twelve from 10, was off at the individual 9 and wherever the timeline wasn't sure (2: the premiere's report has
    nothing to check against; 11: 10's answer contradicted itself; 16-17: the claim partway), and following the people offered
    the last known there; the newcomer Jonna Mannion was on the checklist from 6, and the tapes' wrong exits were made right.
    Every sure trigger on the five seasons was right; the held ones were the premiere's, 10's contradicted answer, the claim, the
    finale's split and Survivor 49's split immunity. Left open (Noticed): a group question on the league's own groups at an
    episode whose groups changed at its start (The Challenge 39's teams drawn each episode, Survivor's swaps) is graded on the new
    groups by name.
  - **F3 part 2's items, settled from the tapes** (its Noticed): whether `newGroup` names a partner as a team on a paired season
    (never on production's prompt: 0 in 63 of The Challenge's full answers on tape; F2's raw answers did, 22 times in The
    Challenge 41's 9, and F3's code already drops them); a pair voted out together at a re-draw (it never happens on the five
    seasons); the premiere of a paired season (fixed above). Details under From F4.
  - **Tests:** `tests/blind-replay.test.js` (new, 7): who left in each format's words; the stand-in (a newcomer and who for, the
    re-draw sure, the Lock In's pairs after the episode played alone, none for an episode the fixture lacks); where each section
    comes from and the merge; the quick check and the full answer as filed (the fixture's exits, the tape's title and sources
    kept, an exit worded differently or at medium confidence made the quick check's and sure); every kind of answer the
    players give passing `answerProblem`; a record's checks; what a game did, in a line. `format-timeline-reads.test.js`: the
    premiere's entry, and a new test (an episode played without groups, nobody in a group going in, the eras as teams staying
    the league's, graded off with its reason; Survivor's tribes still none, an individual immunity before the merge among
    them). `npm test` 964.
  - **The proof, as the plan says:** the golden replays (`golden.js`, seven seasons now, The Challenge 39 among them): 160 games,
    19,361 reads, every one the same; the tracker unchanged (`--check`: no row's status moved; the group question it has is
    Survivor's); `format-asks.js timeline` unchanged (23 episodes, 20 sure, 11 sure grouping changes all right, lifetimes 85 of
    85); db/episode-research.js untouched, so no store-and-stage regression; the zt- fixtures through the engine's API on the final
    code, `check-format-groups.js` (ALL PASS, 25) and `check-questions-who.js --api` (ALL PASS); and the blind replays themselves,
    every game made, played and graded through the app's own writes and reads (the engine lab, Join, the draft room, the lineup and
    pick routes, `answers.ts`, the bot's run) on zt-pt- rows.
  - **Code review** (`/code-review`, before the commit; it ran this time). Taken: the grader's finale fix read every finale moment
    question off through the hours before its full research (taken out: finding 20's); `apartNow` would have moved a Survivor
    tribe question at an individual immunity before the merge off its tribes (now only an episode ending with nobody in a group);
    the blind hooks ran after the finale's placing, undoing its rank order (now before it); an off entry said "isn't sure" when
    its reason was known (`off`, with its words in the verdict and `offWhy`); the stale doc comment on `formatGroupsFor`; the
    `sections` command's merge read from the show's slug (now the rulebook's) and its unguarded fields; one seat's failed read
    skipping the others' answers; two merged branches and an alias. Declined: that `pairedNow` and `apartNow` are worked out
    after the lock, from the episode's own report: by design (nothing is known at the lock; once research lands the episode is
    off rather than graded on labels), and the picker at the premiere is in Noticed. After it, reviewed by hand: The Challenge
    39's final added to its fixture, the replay's classing of questions that wait on early results, and an episode with nobody
    in a group going in but played in groups drawn at its start ('unknown', not 'apart').

The research prompt is shared by every show's research, production's included, so F2 reaches it only through a reviewed merge
with the user's OK, like everything else.

**When a grouping lasts** (the user's second example, 2026-10-28: a solo draft, plus a side draft when teams or pairs form
and last). "Lasts" can't be known when a grouping forms, and on some seasons pairs change almost every episode, so the
engine gives a game several ways to meet a change, and the builder picks with the maker:
- **Follow the people** (the safest default): a game drafts people, and whatever their group does flows to them each episode
  (a pair's win scores both), so no change ever breaks it.
- **A side draft once a grouping has lasted:** it opens after a grouping has held N episodes (2, say), scores from then on,
  and closes when that grouping changes, its points kept. If pairs change every episode, it never opens.
- **A pick each episode instead:** "which pair wins this week", its choices the pairs on screen now, for groupings that
  don't last.
- **Ask the game's people at the moment:** "The Challenge formed teams of four (since episode 6). Start a side draft?" One
  tap for the maker or a quick vote of the players (A14's votes), and the game's default if nobody answers by the next lock.
- **The show's history sets expectations:** F1 measures how long groupings lasted on each show's recent seasons, so the
  builder can say so up front ("on the last three seasons, pairs lasted one to three episodes: a side draft might open once,
  or never; a pick each episode fits better").
- **Group slots** (the user's third idea, and the one that needs no guessing): a solo draft, plus a +1 or +2 slot on each
  roster that holds a pair or a team. When groupings are announced, the slots open for the next episode; while that group
  lasts you ride with it; when it ends, its slot drops. Pairs that last make it a side draft, and pairs that change every
  episode make it a pick each episode, with one mechanic and nothing to predict. What keeps it clean: a group is its exact
  members, so any change to them ends it (a partner leaves, a swap, a re-pairing); when the show re-pairs everyone or goes
  each for themselves, every slot drops at once; a slot opens after the episode that announced the groups and scores from
  the next one (a group revealed mid-episode can't be picked before it). Shared by default (Decisions: exclusive or shared);
  open for the design session: +1 or +2, and whether a slot can be swapped while its group lasts.

The engine builds all of them (F3's grouping lifetimes: who's in it, from which episode, until which); which ones the builder
offers, their defaults and how the asking looks are the format-change design session's.

**A change can also be what a game is built around** (the user, 2026-10-28): "automatically start a new draft stage whenever
there is a major format change such as split into teams or split into individuals" (Requests from a show's page). So:

- **A stage can start on a format change**, as well as on an episode or a rulebook phase: of the kinds the spec names, from the
  episode the research says it took effect. A new draft is one thing a stage can start with.
- **"Major" is data, not a judgment at game time.** Research reports each change as one of a small vocabulary of kinds (teams
  formed, split into individuals, pairs, a swap, a merge, a new phase, a twist), and the spec names which kinds count. The
  wizard says in words what the game will treat as major.
- **Only a reliable report moves a game's structure.** A change research is unsure of gets the safe fallbacks only, and is
  flagged. A structural action that came from research that turns out wrong is undone when the research is corrected, as a
  result taken back is.
- **A structural action can wait for the maker's OK or run by itself with an undo.** The engine builds both; which is the
  default is the user's call.

**There's a lot at stake, so the decisions are the user's, made in a design session, not in a lane** (the user, 2026-10-28).
Lanes build the engine's pieces (the vocabulary, the triggers, the fallbacks, both kinds of structural action, the undo, blind
replays) and decide nothing a person sees. The format-change design session, with the user and mocked at 390 first like the
rest, settles: how a maker asks for it (the builder's words, the wizard's assumptions); what players see when a change lands
(what changed, what the game did, a new draft opening and its deadline); what the maker and the commissioner can confirm,
change or undo; how a wrong report is put right in front of the players; and the edge cases (a change during a draft, two
changes in one episode, a change in the finale, a change that comes back). It runs after A12, so it designs on what the
engine does, before any of its UI is built; then the UI follows it (U0 for the wizard's part, the game pages (track V) for the rest).

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
- **Randomize, the other door** (the user, 2026-10-29). Roll a game, roll again, lock what you want kept. A roll is a random
  spec from what the show's data can settle (its rulebook's moments, its format's groups and phases, the episodes left); a lock
  fixes one part before the roll (how long; how you play: a draft, a pick each episode, questions or a card; how you win; a
  twist) and the roll fills the rest. Our check vets every roll as it vets the GPT's drafts, so a roll that can't be played is
  rolled again, never shown. Rolls are seeded (as the draw's names out of a hat), so Back returns to the last one and a roll
  can be shared. **Easy to read at a glance:** a roll stacks one or two twists at most and shows the game's short form, a title
  and one line ("Episode 7 · draft 2 · your captain scores double"), the sentence and How it works a tap away. The doors mix:
  what someone typed is locked and the rest rolls, and a question left can be answered with a roll. No bot: instant, free, and
  it works when the bot is away.
- **The details nobody asked about** (draft order, timer, who can join, waivers, ties) are recommended and out of sight, in
  Backstage › Game settings later, as today.
- **Start** works as today's does (on the couch, linked to its other games, Tell the couch), from the spec.
- **For U0 to design:** where the field lives (my recommendation: every Start a game entry opens it, the show filled in when
  opened from one, today's taps under it); the bot's half-minute wait (what it shows, leaving and coming back); ideas under the
  field from what's on (the guide's shows and games, so "endless" shows before anyone types); the errors (bot away, show not set
  up, a past game, can't count that); How it works for a game someone typed. Walk it through the archetypes
  (`docs/ARCHETYPES.md`): the Tinkerer's custom game, the Drive-By's quick one, the Late Recruit reading a game someone typed.

## The Games tab and game pages (track V, then U0)

- **Today** (master, 2026-10-30): a game is a block on the show's Games tab (`src/new/show/games.tsx`): its standings (a row
  opens the player sheet), its rules in a sheet, This week. Its move for the night is a card on Tonight, and its tools (Draft,
  Waivers, Scoring, Blind, Backstage) are pages over the show. That holds one simple game, not what the engine now makes: a
  matchup and a bracket, teams, lives and who went out when, stages with their own tables, a game's span and its history
  (most of the Noticed items marked U1).
- **The Games tab, an overview and a launcher** (the user): it opens on the moves to make and each game's brief, up front as
  today, and under them every game the couch plays on the show, each opening its own page. With one game, U0 decides whether
  the tab shows that page in place.
- **A game's page:** more control and insight into that one game: where you stand and why, this week (your move, your
  matchup), the whole table, bracket or teams, what's happened episode by episode (corrections included), the rules in the
  engine's words (the short form on top, the sentence and How it works a tap away), and the maker's controls. It opens over
  the show as Draft and Scoring do, so the show's tabs stay the show's (the 2026-10-22 mock: no per-game tab sets, no game
  switcher).
- **Generated, never designed one by one:** the dials multiply to thousands of games, so a page is composed in code from
  blocks that the spec, the game's state and the seat call for. The design goes into the blocks and the rules that pick and
  order them, reviewed on generated screens (V2, V3). Deterministic at run time: nothing composes a page with AI when someone
  opens it (no paid service, and the bot is never in a page's path).

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
    answer, tiny; nothing polls or runs on a schedule). Production's flag was off then (on since 2026-10-30), so no carried spec there has A2's shape;
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
exactly as before the step: the playtest lane's `playtest.js`, read engine against engine by `node scripts/dev-test/golden.js`
since A8); and a zt- fixture played through the engine's own API, no screens. Each step names the research data it needs and checks the tapes have it.
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

  **As built (A7, 2026-10-28, on `engine`, not merged; no migration).** The same session as A6, after its commit.
  - **Windows** (`schema.js`): a question is asked `once`, `each` episode (and with `over: N`, about that episode and the next
    N - 1: "within the next three"), `every` N episodes (`every: N`, each run of N from the game's first), or once a `phase`.
    An answer is for its window: the episode it opens at (`game_answers.episode`; 0 asked once), and it closes as that episode
    starts. Over a window, who went home is anyone who did (asked once it stays A4's first to go); a moment, a role or who it
    happened to most is over the window's episodes, known once they all have their results and the window's end is known.
  - **Which episode:** `{ by: 'phase', phase, take: 'starts' }` (a number, or a choice of ranges: asked once) and a moment's
    `first` (a number: which episode it first happened in; a person: who it happened to then). Whether a phase starts in an
    episode or a window: `{ by: 'phase', take: 'happened' }`, yes once its start is known there, no once it's known elsewhere
    or the game is over without it, so a start the desk confirms late is never read as no.
  - **Phases are data the desk confirms** (A3's starts, from research's `phaseStarted`, results or "when N are left"). The same
    settle pass that settles a game's start at a phase (Start a game, Game settings, the desk's confirm, the season sync after
    every result, and now the lab) records, for a game that asks by phase (`AnswerLogic.byPhase`):
    - `state.phaseStarts`, the season's confirmed starts, which the grader counts only once the viewer has seen that episode;
    - `state.phaseWindows`, where each later phase's window opens: its start, or the first episode still open when it's only
      known once it's begun (nobody answers about what's aired). One that's opened (this week's or past) never moves and keeps
      its start, so its answers are always graded. A window runs to where the next opens. It shows to a viewer once they're up
      to the episode before it, so someone further behind never learns a phase began (A3's Noticed is the same kind of thing).
    - The desk's settle pass locks and writes such a game only when something would change (tried on a copy first).
  - **A late lock** (`extras.lateLock: { hours: 12 | 24 | 48 | 72 }`, `settings.lateLockHours`, a game of questions' own):
    someone who hasn't seen an episode can answer its questions after it starts, until they've seen it, up to that many hours
    past its air time (the league's, or the schedule's). Whoever runs it locking the episode closes it. Nobody's answers show
    to them while they can still answer; everyone else sees theirs. "This week" for them is the episode after their mark while
    it's open (`AnswerLogic.lateEpisode`). Only a game's questions: lineups and picks keep the airtime lock (A15's own clock).
  - **The engine:** `AnswerLogic.windowStarts`, `opensAt`, `windowAt` (where each window opens, whether an answer's key is
    one, the window an episode's in); `closed` takes the viewer's mark; `grade` keys answers by window (worked out once a
    question); `facts` gains the phase starts the viewer has seen, the phase windows and their mark. `StateLogic.settlePhases`.
  - **The server:** `answers.ts` answers this week's window of each question (a run's or a phase's, not only the episode's),
    with the late lock; `phase-starts.ts` settles phases for games that ask by phase (the desk's pass and the season sync);
    the sheet and its night lines treat a windowed question as the week's.
  - **The shape changed** (a new extra): this lane's nine carried specs drifted and were carried again (`game-specs-flag.js
    on`), as A4's were. Production's flag was off then (on since 2026-10-30), so nothing there carries a spec.
  - **Words:** "Every two episodes, before the first:", "Before each episode, about it and the next two:", "Once a phase, as it
    begins:"; the sentence says "before every two episodes" or "each phase"; the late lock in How it works ("Watching late?
    Answer before you watch...") and in the details.
  - **The tracker:** A7's 11 rows: 10 ✅ (every two episodes, once a phase, within three, your own lock, which episode the
    merge is, the merge within two; name someone gone in the next two; guess the merge's episode; a brother watching a day
    late; who gets the first perfect score). "Within the next 3, will there be a blindside?" moves to G1: its window plays
    now, but a blindside isn't a moment research answers (the new-moment path). **Now: 113 ✅** · 126 ⏳ · 1 🆕 · 1 ❓ · 23 💬.
  - **Research data the tapes lack:** where the merge was. Survivor 49's tapes have no episode-level `phaseStarted` (today's
    research asks it), so a replay settles no phase question unless someone confirms the start; the desk does in the app.
  - **Tests:** `tests/answers-time.test.js` (new, 4): the shape and the data rule; grading over windows on facts (every two,
    over three, by phase with a start known late, which episode, a moment's first, each person over a run); the engine's
    windows (where each opens, which an answer is for, phase windows recorded, frozen once open, hidden from someone further
    behind, a start counted once seen); the late lock (open while unseen and within its hours, closed once seen, past the
    hours or locked by whoever runs it; from the schedule's air time). `game-spec.test.js`: the late lock's field. `npm test`
    890.
  - **API:** `scripts/dev-test/check-questions-time.js` (new, on new-fixture.js with the desk's admin), 25 PASS: a game of four
    (every two, over two, the merge's episode, once a phase) with a late lock of 72 hours; the desk confirming the merge at 7
    ahead (recorded, its window there); the lock (jordan, who's seen 6, refused; riley at 5 answering late and seeing nobody's
    answers, jordan seeing hers); Episode 6's results (Merged's window opens at 7, answered); 7's; graded at each mark (jordan
    7, riley nothing at 5 and her late answer once she's seen 7). `check-engine-lab.js` grew A7's specs: 31 PASS.
  - **Re-runs** (after the code review's fixes): `check-questions-time.js` 25, `check-phase-starts.js` 58, `check-questions.js`
    97, `check-questions-who.js` 42, `check-engine-lab.js` 31, `check-new-start-game.js` 75, `check-new-show.js` 81.
  - **Golden replays** (as A6's, engine against engine on each taped season's kept games; the code before A7 and after the
    review's fixes): the same 116 games, **11,981 reads, every one the same.**
  - **`game-specs-flag.js`:** `status` on, 9 of 9, none drifted (after carrying them again); `check` PASS.
  - **Code review** (`/code-review`, before the commit).
    - Taken:
      - the sheet, its night lines and the episode's line only knew questions asked each or once (a windowed one vanished);
      - Start a game's own path didn't record phases for a game that asks by phase;
      - the window shown came from the league's state, so someone behind saw a new phase window open (a spoiler);
      - an open window with answers could move on a desk correction (frozen once it's this week's now, its start kept);
      - a phase window ended at the next phase's start but opened at its window (one source now: where the next opens);
      - the late episode ignored the schedule's air time;
      - the desk's pass locked and rewrote every game that asks by phase;
      - each answer worked its question's windows out again;
      - the types still said "once" or "each".
    - Declined: a Recent changes line when a phase's window opens. It would tell everyone, behind or not, that the phase
      began; the sheet shows each person the window at their own mark.
- **A8. More answers.** An order (the boot order, a leaderboard), confidence (a ranking with weights), spreading chips, a wager,
  pairs (who outlasts whom), a vote split (5-2-1).

  **As built (A8, 2026-10-28, on `engine`, not merged; no migration).** The same session as A6 and A7, after A7's commit (paused
  once by the usage limit during its code review, and picked up after).
  - **Answers** (`schema.js`):
    - `order`: `pick` people in order (2 to 24, a whole cast's boot order), its points for each in its place, or within
      `within` places (0 to 5);
    - `confidence`: `pick` people, surest first; each right one scores its points times its weight (`pick` for the first, 1
      for the last): "you score your confidence on whoever goes";
    - `chips`: `chips` (2 to 100) spread as `{ castawayId: chips }`; each chip on someone right scores its points;
    - `split`: a vote split, `[5, 2, 1]`, right when it's the split exactly (zeros left out on both sides: "5-3" is "5-3-0");
    - `pairs`: `pairs` (1 to 12) drawn from who's in at the game's start, the same every time, answered `{ "a|b": who }`;
    - `wager` (on a yes or no, a choice, an over/under, or one person or group): `{ answer, stake }`, up to `wager` points;
      right, its points and the stake; wrong, the stake lost; off (nobody right, right on the line), nothing.
  - **Settles:** `results` takes `order` (who went home in order over a run, a phase or the game; a double boot shares its
    places), `split` (the jury's: the finalists' votes, the season's) and `outlast` (pairs: decided as soon as one goes; the
    same night is a tie; to the season's end, where they finished breaks it; a game with an end of its own never reads the
    season's later order); `moment` takes `order` (a leaderboard by a moment's count, ties share places); a new settle,
    `points`, takes `most` and `order`: each person's points by the game's rules, as the engine scores a moment
    (`ActiveRosterLogic.eventPoints`: the rulebook's points, a couch's copy, units).
  - **The data rule:** a points leaderboard needs every moment that scores to be research's (and rules that score something);
    a jury split needs a finale a jury decides (`ctx.jury`, from the blocks).
  - **Pairs aren't stored:** both the grader and the server draw them from `AnswerLogic.startIn` (who was in at the game's
    first episode), keyed by the pair's two ids, so a cast correction that redraws them never grades an answer against
    another pair.
  - **The engine:** `facts` gains each episode's `points`, `startIn` and the jury's votes; the grader `placesOf` /
    `placesBy` (the places each one could hold, ties sharing a block).
  - **The server:** the read gives an order's or confidence's `pick`, `within`, `chips`, `wager` and the `pairs` (key and two
    faces); faces for orders, confidence and chips are who's still in; answers are checked against them (a pair's against its
    two).
  - **The sheet** holds A8's kinds back with a line ("answered on a screen still to come": U1's); once locked it says their
    answers and verdicts in words (an order's names, a split's numbers, "settled pair by pair").
  - **Words:** How it works for each ("Put five in order: 2 points for each in its place, or within one place of it", "Rank
    four, the one you're surest of first...", "Spread ten chips...", "5 points for the split exactly", "Three pairs, the same
    for everyone...", "Stake up to 5 points on it...").
  - **The tracker:** A8's 11 rows, all ✅ (an order, a vote split, rank them, chips, a wager; confidence picks; the boot order
    within two; the week's leaderboard by points; chips on who wins immunity; ten pairs; the final vote split). **Now: 124 ✅**
    · 115 ⏳ · 1 🆕 · 1 ❓ · 23 💬.
  - **Research data the tapes lack:** the votes at an ordinary Tribal. Research records `votesReceived` per person, but no
    moment counts it, so a vote split there can't be settled; the jury's can (the finalists' jury votes). "Predict the final
    tribal vote split" reads as the jury's.
  - **Tests:** `tests/answers-more.test.js` (new, 3): the shape and the data rule; grading on facts (the boot order within one,
    a double boot's shared places, a points leaderboard with ties, who scored most, a moment's order, confidence, chips, the
    split with and without a zero, pairs decided as they go, the same night, a game with its own end, a wager won, lost and
    void, 0 points still right, what an answer has to be); a league's points and a game of them graded; How it works. `npm
    test` 893.
  - **API:** `scripts/dev-test/check-questions-more.js` (new, on new-fixture.js): 24 PASS: a game of six (an order every
    three, confidence, chips, a wager, three pairs, who scored most); the read (faces, pick, chips, wager, the pairs, the same
    for riley); six refusals; Episodes 6 to 8; jordan 23 at 8 (each one's points), riley's wager lost, nothing for her at 5;
    the Games tab; the flag's check. `check-engine-lab.js` grew A8's specs (the boot order, the points leaderboard, a wager,
    the jury split): 35 PASS.
  - **Re-runs** (after the code review's fixes): `check-questions-more.js` 24, `check-questions-time.js` 25,
    `check-questions-who.js` 42, `check-engine-lab.js` 35, `check-questions.js` 97, `check-phase-starts.js` 58,
    `check-new-start-game.js` 75, `check-new-show.js` 81.
  - **Golden replays** (as A6's: the code before A8 and after the review's fixes, on each taped season's kept games): the same
    116 games, **11,981 reads, every one the same.**
  - **`game-specs-flag.js`:** `status` on, 9 of 9, none drifted; `check` PASS.
  - **Code review** (`/code-review`, before the commit; the first run stopped at the usage limit, the second ran whole).
    - Taken:
      - a game with an end of its own settled pairs from the season's later finish order;
      - a jury split with a zero-vote finalist never matched "5-3";
      - the points leaderboard rebuilt points from the rulebook's defaults instead of the engine's own scoring (now
        `eventPoints`, one rule);
      - a double boot was ordered by the order its results were typed (now a tie: shared places, a pair off);
      - pairs were redrawn by a second copy of "who's in at the start" and keyed by index (one `startIn`, keyed by the
        pair);
      - a 0-point question was never "right";
      - the sheet's verdict line for a split, pairs and an order, and a split waiting for the season's end;
      - the problem messages (the new answers and settles, a split asked each episode);
      - a wager's base question built three times, the leaderboard's places in quadratic time, a misplaced comment, faces
        worked out for a pairs question and never used.
    - Declined: none.
- **A9. Scoring that combines.** Per question: split the pot, the only right answer, roll over, multiply, shrink with time,
  double or nothing. Per lineup: a captain who scores double, best ball (your best N count), scoring in reverse. Points per
  bingo line.

  **Split in two (2026-10-28).** Part 1: per question (a game of questions' ways of combining) and points per bingo line. Part 2:
  per lineup (a captain, best ball, scoring in reverse) and points that multiply by when (w046's "double in the finale"), which
  touch a draft's own scoring in state-logic's Outlast and Weekly Lineup strategies.

  **"Shrink with time", decided (2026-10-28, before A15's in-episode clock).** A call's worth shrinks with **when it was made**,
  on the episode clock: A15's "a call pinned to when you made it, earlier is worth more", at episode grain. It fits the only
  questions open once a game is on (asked once, closing at the finale: who wins, who makes the final few), as a point less for
  each of the game's episodes that had started when the answer was made, or a point for each change once the game's on ("seal
  a winner pick before the premiere; every change costs a point"). "Earlier windows worth more" (an episode, a phase or the
  finale counting double) is a multiplier by when, part 2's, since it's the same dial for a lineup ("double in the finale").
  A15 moves the same `late` from episodes to the runtime.

  **As built (A9 part 1, 2026-10-28, on `engine`, not merged; migration 0201).** One session, after `lane.js sync engine`
  brought in master's desk-parity plan and the lanes' keeper (893 tests then).
  - **A question's ways of combining** (`schema.js`; a wager plays alone, as A8 has it):
    - `share: 'split'`: its points are a pot for each window, split between everyone right, by what each would have earned (a
      right pick each), to the cent: "10 points an episode, split between everyone who called the boot". Rarer right calls win
      more.
    - `share: 'only'`: a right answer scores only when nobody else's on it does (the only player who earned anything there; the
      closest's tie on a number is nobody).
    - `rollover: true` (asked each, every N or by phase): a window nobody earns anything on (nobody right, or it didn't count)
      carries its points, and whatever it carried, into the next. The jackpot is unclaimed at the game's end.
    - `shrink: { points, per: 'episode' | 'change' }` (asked once, closing at the finale): points less for each of the game's
      episodes that had started when the answer was made, or for each change once the game had started, a first answer made
      then counting as one (so waiting never beats sealing early); never below 0. Once the game's on, a shrinking call can be
      changed but not taken back (409), or a take-back would start it over.
    - `wager: 'total'`: A8's wager, staking any of your points as they stand for you when you answer (double or nothing),
      less what you've staked on other such wagers still to settle; the stake is checked when it's given, not capped at
      grading.
    - A game of questions' parlays, `score: { by: 'answers', parlays: [{ of: [2 to 4 question ids], times }] }`: someone right
      on every one of them in the same window has their points on them multiplied ("who goes home AND who wins immunity, triple
      if both"). Legs are plain (no share, rollover, shrink or wager), one answer each, asked the same way; a question is in
      one parlay at most; times above 1, up to 10.
    - Points per bingo line: `score: { by: 'lines', points: 1 to 100 }` (1 when it's left out, so no stored spec changes).
  - **The grader** (`answers.js`): `windowPoints(q, v, answers, facts, { worth })`, each window's points with a share, a
    rollover's worth and each answer's `late`/`changes`; a question with none of them earns exactly `pointsFor`'s, by the same
    code (no arithmetic changed for today's games); `allRight` (a parlay's legs), `shrunk`.
  - **The engine** (`AnswerLogic.grade`): returns each window's `earned` and a rollover's `worth` beside the points. A rollover
    is graded window by window from its first (one nobody answered rolls over too); a window still to settle at the viewer's
    mark stops it there, so nothing after it counts until it does and someone behind never sees a jackpot they haven't reached.
    A parlay multiplies its legs' points for whoever's right on all of them. Totals to the cent. `AnswerLogic.started` (how
    many of the game's episodes had started at a moment: their locks, the schedule's air times, never for a league catching up).
  - **Storage** (migration 0201): `game_answers.late` and `changes`, written by the answers API on every answer (`late` only
    when the answer changes; the same answer again isn't a change). Every existing answer reads as made before its game,
    unchanged. Backups read columns as they are.
  - **The settings** (`settings.js`): `settings.parlays` (a game of questions') and `settings.linePoints` (a Weekly Bingo's), so a
    league plays them with the game-specs flag off; `OWNED` gains both.
  - **The server:** the answers read gives each question's `share`, `rollover`, `jackpot` (what's carried into this window, once
    the windows before it are settled as far as you've seen), `shrink`, `worth` (what your shrinking call is worth, or one made
    now) and `stakeMost`; what each person earned comes from the engine's grade (a split pot, a jackpot, a parlay). The sheet's
    night lines read the same. The POST records `late` and `changes` and checks a stake of any of your points. Weekly Bingo's
    table and the couch hub's standings are lines times its points (`bingo.ts pointsPerLine`), and the Games read's
    `linePoints` has Tonight say "pts" for one worth more than a point.
  - **Words:** How it works for each ("The points are a pot, split between everyone who gets it right: the fewer of you, the
    more each gets.", "It only scores if you're the only one who gets it right.", "If nobody gets it, its points roll over to
    the next one.", "It's worth 1 point less for each episode that's started when you make or change it...", "Once it's
    started, each change costs 1 point.", "Stake any of your points on it...", "A parlay: right on ... together, and your
    points on them are triple.", "Each line is worth 5 points."); the sentence says them too, and a game whose questions all
    close at the finale says "before the finale".
  - **The tracker:** 13 of A9's 20 rows ✅ (the pot, the only one, the jackpot, the parlay, double or nothing, shrinking with
    time, points per line; s15, s29, s30, s32, s34, s44). Part 2's 7 wait (a captain, best ball, in reverse; s07, s08, s09;
    w046). **Now: 137 ✅** · 102 ⏳ · 1 🆕 · 1 ❓ · 23 💬.
  - **Research data:** nothing new. Every part grades what A4–A8 already settle.
  - **Tests:** `tests/answers-scoring.test.js` (new, 5): the shape and where each goes; grading on facts (the pot, to the cent and
    by right picks, only the one, a shrinking call per episode and per change, any of your points); the engine (a rollover
    window by window at two marks, a parlay's windows, the pot); `started` by locks and air times; the settings both ways and
    How it works. `game-spec.test.js`: the two new fields. `npm test` 898.
  - **API:** `scripts/dev-test/check-questions-scoring.js` (new, on new-fixture.js), 38 PASS: a game of nine (the pot, a parlay
    of who goes home and who wins immunity, only the one, a jackpot, two wagers of any of your points, two winner calls that
    shrink); the read's ways; jordan's seal changed after Episode 6 starts (late 1, one change, worth 9; the same answer again
    no change; take-back refused), riley's late first seal (a change already); Episode 6 graded (jordan 10: half the pot, the
    parlay doubled; both right on the idol, neither scores); the jackpot rolled to 2; stakes against his 10 (11 refused; 4 on
    the line leaves 6); Episode 7 (jordan 19 with the jackpot of 4 and his stake won, riley the pot alone and her stake lost);
    the Games tab; a Weekly Bingo at 5 a line with a card's line from the results (5, said as points), the hub reading it; the
    flag's check on both. `check-engine-lab.js` grew A9's specs (each said in its sentence, a parlay of a question the game
    doesn't ask refused, a parlay and a line-points bingo started as test games): 45 PASS.
  - **Re-runs** (after the code review's fixes): `check-questions-who.js` 42, `check-questions-time.js` 25,
    `check-questions-more.js` 24, `check-engine-lab.js` 45, `check-new-start-game.js` 75, `check-phase-starts.js` 58,
    `check-new-show.js` 81, `check-questions.js` 97 (after 9:30 PM ET: the fixture's live window, Noticed; its API half 70 before).
  - **Golden replays** (`node scripts/dev-test/golden.js`, HEAD against the working tree, before and after the review's fixes):
    the same 116 games, **11,981 reads, every one the same.**
  - **`game-specs-flag.js`:** `status` on, 9 of 9, none drifted (no new default in a stored spec, so nothing to carry again);
    `check` PASS.
  - **Code review** (`/code-review`, before the commit).
    - Taken:
      - a stake of any of your points could count the same points twice across open wagers (now less what's on the line,
        this answer's other stakes too);
      - a first shrinking call made late counted no change, so waiting beat sealing early;
      - the couch hub counted bingo lines without their points (one `pointsPerLine` for the table and the hub);
      - Tonight said "10 lines" for 2 lines at 5;
      - totals weren't rounded (a split pot's cents);
      - describe crashed on a half-made parlay;
      - a window's membership scanned a list for every answer (a Set again);
      - how many episodes had started was worked out per question.
    - Declined: one read of the answers for a POST with a wager of any of your points. The stake is checked against the
      answers before the write, and the response reads them after it.

  **As built (A9 part 2, 2026-10-28, on `engine`, not merged; no migration).** One session, after `lane.js sync engine`
  brought in master's format-foundation plan (898 tests then). Every part is off unless a spec says it, and none adds a default
  to a stored spec (`fullSpec`), so today's leagues and the nine carried specs read exactly as before.
  - **A captain** (`score.captain: { times }`, on a game scored by moments with a lineup: `count.start`): one of your starters you
    name each episode, whose points multiply (more than 1, up to 10; "scores double" is 2), negatives too.
    - Stored per episode like the lineup it's one of (`episode.captains[playerId]`, null for none) and locked with it
      (`ActiveRosterLogic.validateCaptain`, through `validateLineup`'s checks: the episode, its lock, the span, the player).
    - **Decided: nobody named carries the last captain**, as a lineup carries (the Fan Who Forgets), and only while they're
      starting. Benching your captain takes the armband off (`setLineup` sets it to none), and a captain benched or gone
      counts as none.
    - Written through the engine (`setCaptain`) and the lineup route: `PUT .../lineups/:playerId` takes an optional
      `captainId` (null for none), checked against the lineup sent with it. A late joiner's goes through `GhostLogic.applyAs`,
      copied back with their lineup.
    - Computer players name their best starter.
    - Not on best ball: there are no starters to name (refused).
  - **Best ball** (`count: { best: n }`, now the engine's for shows too: VOCAB `count.best` 'now'): draft a team, and each
    episode your best n count, no lineups.
    - **Decided: Weekly Lineup's league type, not its own.** It plays as `active-roster`, a variant built once like shared
      ownership's (`BEST_BALL_VARIANTS`, exclusive and shared): the same id and scoring strategy, with `hasActiveRoster` false
      (no lineups: the lineup route and computer players leave it alone) and a new flag, `hasBestBall`. Why: every server read
      treats `active-roster` as "scored by moments" (points, the week's +N, moves), while a new id would fall into Outlast's
      branches across 45 files.
    - Settings: `bestBall: true`, with `activeSlots` its n and `benchSlots` the rest.
    - Each episode's team comes from the mid-season log (`ActiveRosterLogic.teamFor`), as the spoiler view and the waiver weeks
      have it: who you hold now, with every move from that episode on taken back (a move after episode k counts from k + 1),
      less anyone out before it. So a waiver move never reaches back.
    - The n highest count, negatives too when fewer than n are left; a tie can't change the total (the cast's order breaks it).
    - 1 to 8 count (the lineup's starters' limit), of a team of up to 14.
    - Its waivers have no "replace only when short" (a lineup's: there are no starters to be short of), as Outlast's.
  - **Outlast in reverse** (`score: { by: 'place', reverse: true }`, settings `reverseOrder`): the earlier yours go home, the
    more. Each castaway earns 1, plus 1 for everyone who outlasts them: the cast's size + 1 less their Outlast points, so out
    first of 18 is 18, the winner 1.
    - **Decided: someone still in counts what they'd score if they went home next** (the cast less the boots so far), shrinking
      by 1 for each boot they outlast. It's Outlast's live count mirrored, so a mid-season table ranks as the end would if
      everyone went home next.
    - In words it's "A game", not "Outlast".
  - **Points that multiply by when** (`score.times`: [{ times, and one of `episode`, `from` (with `to`, or none for the
    season's end), `phase`, `finale` }], up to 8, on a game scored by moments: a lineup or best ball; settings `pointsTimes`):
    corpus w046's "double in the finale", and "earlier windows worth more".
    - times is more than 0 and not 1, up to 10 (half points are 0.5). An episode in two windows counts both, multiplied.
    - A new game's windows are inside its episodes, and the finale needs a game that runs to it.
    - The data rule: a phase is one of the season's; the finale only on a show whose results say who goes home or wins.
    - **The engine** (`ActiveRosterLogic.timesFor`):
      - a phase counts from where data says it starts (`state.phaseStarts`, the desk's confirmed starts) to where the next
        one known does, and only once the copy is up to the episode before its start, so nobody behind learns a phase began;
      - the finale is the episode that ended the season (`finaleEpisodeOf`: the winner's), known once its results are;
      - a captain and the episode's multiplier go together (a captain in a doubled finale is four times).
    - **The settle passes record phase starts for such a game too:** `StateLogic.readsPhases` (asks by phase, or multiplies
      in a phase) replaces `AnswerLogic.byPhase` in the desk's pass, the season sync, Start a game and the lab. Its SQL
      (`phase-starts.ts`) reads `settings.pointsTimes`, and `settlePhases` records the starts alone (only questions have
      windows).
  - **One episode's score, as the engine counts it:** `ActiveRosterLogic.episodeScore` (a captain, best ball's counted ones,
    the multiplier). `ActiveRosterEventScoringStrategy.compute` uses it only for a game that combines (`combines`). A plain
    lineup scores event by event with the arithmetic it always had.
    - The Games tab's week (`teamEpisodeBreakdown`), `episodePlayerPoints` (the episode lines, the reveal) and the game
      view's "last" (best ball: who counted) read it.
    - The waiver auto-fill's "most points" free agent now asks "scored by moments" rather than `hasActiveRoster` (the same
      leagues today, plus best ball).
  - **Part 1's open item, taken (agreed with its recommendation): "only the only one right" counts each pick** for a person or
    group answer. Each right pick nobody else named scores, so two players each alone on a different right one (the final
    three, a double boot) both do. Anything else stays per player. How it works: "A right pick only scores if nobody else
    named it."
  - **Through a format change** (Formats nobody announced): each part rides on data.
    - A captain is a person named each episode, and best ball counts whoever's on your team.
    - A phase that never starts never multiplies (the points stay plain), and a show whose season ends with no results to
      place a finale never doubles one.
    - Reverse counts the cast as it stands (Noticed).
  - **Words:**
    - the sentence: "...starts 3 each episode, one of them a captain who scores double", "Points in the finale count double.",
      "Each scores more the earlier they go home: the first one out carries you.";
    - How it works: "Name one of your starters captain each episode: their points count double. Name nobody and your last
      captain keeps it, while they're starting.", "Each episode, your best three count, whoever they are: no lineups to set.",
      "Points from Episode 10 on count double.", reverse's three lines.
  - **The tracker:**
    - A9's 7 waiting rows, all ✅: the dials (a captain, best ball, reverse), s07, s08, s09 and w046. w046 is now checked
      against the Dancing with the Stars sample: its judges' points alone, the rest at 0, the finale doubled.
    - A new dial row, `score.byWhen` ✅.
    - **Now: 145 ✅** · 95 ⏳ · 1 🆕 · 1 ❓ · 23 💬, of 265.
  - **Research data:** nothing new; the finale and phase starts are what A3 and A7 already record. The Challenge 40 was still
    being recorded (the playtest lane, at Episode 8), so it isn't loaded here yet.
  - **Tests:** `tests/lineup-scoring.test.js` (new, 8):
    - the shape and the data rule for each part;
    - the settings both ways, with none of the fields written for a game without it;
    - a captain named, carried, benched and locked;
    - best ball through a waiver move;
    - each window's multiplier (a phase once it's begun, the finale once it's over, a spoiler view);
    - reverse, live and final;
    - today's lineups as before, and computer players' captains;
    - How it works.

    `answers-scoring.test.js`: only the only one per pick; `game-spec.test.js`: the new fields, best ball playing. `npm test`
    906.
  - **API:** `scripts/dev-test/check-lineup-scoring.js` (new, on new-fixture.js with the desk's admin), 31 PASS. The couch's
    Weekly Lineup is a shared draft, so every expectation is worked out from each player's own lineup or team.
    - a captain refused while the game has none, then the game made one with a captain and Merged doubled (setGame, the
      show's ctx);
    - jordan's lineup and captain (stored on Episode 6); a captain off the lineup refused; not sam's (403);
    - the desk confirming the merge at 7 (the lineup game records its start, no windows);
    - Episode 6 airing (the captain locked) and its results (doubled, the Games tab's week too);
    - Episode 7 (the merge: the carried captain four times over);
    - best ball (no lineups, waivers replacing right away; Episode 8, each player's best two of their team);
    - the couch's Outlast reversed (each player's points mirrored, the first out 18, the still-in 18 less the boots, the
      Games tab);
    - the flag's check on both, their carried specs in step.

    `check-engine-lab.js` grew part 2's specs (each said in its sentence; a captain on best ball and a phase the season
    doesn't have refused; a captain lineup, a best ball and a reverse Outlast started as test games): 54 PASS.
  - **Re-runs** (one at a time): `check-questions.js` 97 (after 9:30 PM ET), `check-questions-who.js` 42,
    `check-questions-time.js` 25, `check-questions-more.js` 24, `check-questions-scoring.js` 38 (again after the per-pick
    change: 38), `check-new-start-game.js` 75, `check-phase-starts.js` 58, `check-new-show.js` 81, and the lineup checks the part
    touches: `check-new-computer-players.js` 42, `check-new-reveal.js` 49, `check-new-backstage-ii.js` 149, `check-waivers.js` 85.
  - **Golden replays** (`node scripts/dev-test/golden.js`, HEAD against the working tree, before and after the per-pick change
    and the review's fix): the same 116 games, **11,981 reads, every one the same.**
  - **`game-specs-flag.js`:** `status` on, 9 of 9, none drifted (nothing new in a stored spec); `check` PASS.
  - **Code review:** `/code-review` was started twice, and both times the session ended during it with nothing recorded, so the
    diff was reviewed by hand instead.
    - Taken: an open-ended run read "Points in Episodes 10 on" ("Points from Episode 10 on" now).
    - Looked at and right as they are: a plain lineup's and Outlast's arithmetic (unchanged paths), the auto-fill's condition
      (the same leagues), the lineup route's order (lineup, then captain, both against the lineup sent), a late joiner's
      copy, and the settle passes' SQL.
- **A10. Pools and drafts.** A pool's lives, buybacks and two-pick nights; a draft slot per group (one per tribe, a guy and a
  girl); auction and a salary cap; keepers across seasons; teams two people share.

  **Split in parts (2026-10-29), each its own session.** Part 1: the user's group slots (the 9 PM note, "When a grouping lasts")
  on F3's grouping lifetimes, with their fallbacks from the start, and the exclusive-or-shared count as the pool shrinks (the
  9:10 PM decision, A9 part 2's Noticed). Part 2: a pool's pieces (lives, a buyback, two-pick nights, one mulligan: s10, s11,
  s23). Part 3: a draft's slots and prices (a draft slot per group, one per tribe, a guy and a girl; auction, a salary cap, a
  random draw, buying and selling: s03 to s06, s22, s38, answer.bid, answer.trade, answer.draw). Part 4: keepers across seasons
  and a team two people share (s17, s18, shape.keepers, who.sharedTeam). Each part the engine's only (no screens: U1's).
  Part 3 split in three as it went (2026-10-29): 3 the slots and the draw (s05, s06, s38, answer.draw), 3b the prices (an auction
  and a salary cap: s03, s04, answer.bid), 3c buying and selling each week (the stock market: s22, answer.trade), on 3b's prices.
  Part 4 split in two as it went (2026-10-29): 4 keepers across seasons (s17, shape.keepers), and 4b a team two people share (s18,
  who.sharedTeam), the last of A10: a seat two accounts hold meets the database's one account a seat (`league_memberships`'
  `UNIQUE(league_id, player_id)`), the joins that refuse a taken seat, the couch's tables, records, calls and bingo credited by
  person through a seat-to-account map that keeps one, the change log treating a co-owner's move as someone else's, and leaving a
  seat, a session of its own.

  **As built (A10 part 1, 2026-10-29, on `engine`, not merged; no migration).** One session, after `lane.js sync engine` (already
  up to date; 964 tests).
  - **The spec** (`schema.js`): a draft's `get.groups`, `{ slots, own, swap, fallback, points }`, beside a draft scored by
    moments (a lineup or best ball: what a group scores is what its people do; Outlast, a pick or no draft refuse it). `slots` 1
    or 2 (`MAX_GROUP_SLOTS`, the user's "+1 or +2"); `own` shared or exclusive; `swap` whether a slot can change its group while
    it lasts; `fallback` void or carry-on (`next-stage` A12's: `specWaitsFor` says so); `points` mean or sum. What it leaves out
    is the defaults (`GROUP_SLOTS`: 1, shared, no swaps, void, the mean), filled by `fullSpec` only on a spec that has slots, so
    no stored spec changes. VOCAB's `get.groups.own`, `.fallback`, `.points`; `flagsOf`'s `hasGroupSlots`. The settings:
    `settings.groupSlots`, both ways (`OWNED`), none for a game without it.
  - **Exclusive or shared, counted** (the 9:10 PM decision): `covers({ pool, people, each })`, and `specProblems` with
    `ctx.pool` (how many can be drafted where the game drafts) and `ctx.couch` (how many people): an exclusive draft that
    doesn't cover every pick is refused at `get.own`, with the reason ("7 of you × 3 picks is more than the 18 who can be drafted:
    make it shared, so two of you can have the same one"). A new game's only (a league's own keeps its draft: people join it by
    asking); not counted without both numbers. As the pool shrinks: group slots count each opening (below); a stage's or a side
    draft's is A12's, with the same `covers`.
  - **The groups, from the format's state over time** (`format-timeline.js slotRecords`): each episode's groups as a league reads
    them, `{ end: { groups, divided, sure, why }, played: { groups, apart, sure } | null }`, the end the timeline's `goingInto`
    the next episode and the play its `played`; members as the league's castaway ids (the forgiving match, as A6's group
    questions), `size` the group's people as research has them (someone not on the league's cast, a newcomer not yet added,
    still counts in a mean). **Written into the game, not read from research on every score:** `GroupSlotLogic.settle` writes
    each one onto its episode (`episode.formatGroups`), only on an episode with results (so nothing of an episode reaches a game
    before its results do), wholesale (a corrected report rewrites every episode after it), none for a game without slots. The
    server's `group-slots.ts` (`slotRecordsFor`, `settleGroupSlots`) reads the season's timeline (db/format-timeline.js, one
    query) and settles it on **every write to a game with slots** (`withLeagueLock`: before the mutation, so a pick reads
    what's on offer now, and after it, for results it applied or slots it turned on; in a savepoint, so a failed read never
    aborts the write). So the season sync after every result settles it, and every score, on the server or in the browser,
    reads it from the league's state (`computeScores` is pure). Why not on read, as A6's questions: a draft's scores are
    worked out in 15 places, the browser's among them, from the state alone. The spoiler view drops a hidden episode's record,
    so someone behind is offered nothing they haven't seen.
  - **The engine** (`state-logic.js GroupSlotLogic`, pure): `offered(n)`, the groups at episode n - 1's end while the show is
    divided (none at an unsure lock with void; carry-on offers them, unsure), with `shared` when an exclusive game's opening
    doesn't cover every team's slots (`covers`, counted over the game's rotation: a late joiner's picks are private); a pick
    per slot on the episode it's for (`episode.groupSlots[playerId][slot]`: the group's id, its members as offered and its
    size), carried like a lineup; `standing(n)`: held (its group played n as picked), void (the lock or the play wasn't sure,
    or it was shown and changed before n started: F1's Q2, it reopens for the next), dropped (it ended before n: it didn't play
    an episode since as picked, or isn't among the groups going into n; a re-pairing or each for themselves drops every slot
    at once), waiting, empty; a pick is found by its id, else by its members (a correction that moves the episode a group was
    first shown changes its id: F3 part 2's item). `episodeLines(n)`: each held slot's points, its people's points by the
    game's rules, their mean over the group's size or their sum, times the episode's multiplier (A9 part 2's `score.times`);
    carry-on follows the people (a group that didn't play as picked scores its members as picked). `validatePick` /
    `setPick`: a group on offer, the slot's number, locked as lineups are (`isLineupLocked`), a slot riding with its group
    while it lasts unless `swap`, not the same group in two of your slots, not another team's in an exclusive opening that
    covers (first come). `index(state)`: the episodes by number and who went home when, once a pass.
  - **Scoring:** `ActiveRosterLogic.combines` takes a game with slots onto `episodeScore`'s path, which adds each slot's points
    to the episode's total and returns them as `slots` (so the Games tab's week, the episode lines and the reveal count them);
    a plain lineup's arithmetic is untouched. `teamEpisodeBreakdown` gives each slot a line (its group, how it stood, its
    people, its points), so a total never has points without a line. A late joiner's pick goes through `GhostLogic.applyAs`,
    copied back with their lineup.
  - **The route** (`/api/leagues/[id]/episodes/[epId]/group-slots/[playerId]`): `GET` what a player's slots hold going into an
    episode and what's on offer, at their mark (the season's, guard.ts, or a late joiner's own week), on the groups the game
    has stored (what every table scores); `PUT { slot, groupId }` (null empties it), the player's own or the commissioner's for
    anyone, a refused pick a 400 with the reason. No screen (U1's).
  - **Words** (`describe.js`): the sentence ("..., plus a slot for a pair or team the show forms") and How it works, a line each
    for when a slot opens and scores, riding with a group and dropping, shared or exclusive, swaps, and the fallback.
  - **The tracker:** a dial row (`who.groupSlots`, two slots on The Challenge 41) and the plan's three Challenge requests as
    examples: p9 (group slots, one) ✅; p7 (a stage on a format change) and p8 (a side draft once a grouping lasts) ⏳ A12.
    **Now: 147 ✅** · 97 ⏳ · 1 🆕 · 1 ❓ · 23 💬, of 269 (A10's 16 rows wait for its later parts; A12's are 11 now).
  - **Research data:** nothing new: the format section (F2) and the timeline (F3) are what the slots read. On the tapes, the
    stand-ins of F4 (`blind.js`) carry the section where F2 didn't ask.
  - **Tests:** `tests/group-slots.test.js` (new, 10): the shape, defaults, words and settings; the exclusive count (where it
    drafts, a later start, not without both numbers, not a league's own); `slotRecords`; a slot opening after the episode that
    showed its groups, riding with its group, dropping at a re-pairing and picking again (the table counting it); each for
    themselves dropping every slot; a group re-drawn at the start of the episode it was picked for void (Q2); an unsure lock void
    or followed (carry-on, and following the people when re-drawn); two slots, swaps, exclusive first come and the count as the
    pool shrinks (a pair down to one after an exit: the opening shared); a corrected report (void, put back, an id moved), records
    only with results, the spoiler view, a late joiner; a group's mean over its size; a plain lineup as before.
    `game-spec.test.js`: the new field; `blind-replay.test.js`: the record's slot checks. `npm test` 974.
  - **API:** `scripts/dev-test/check-group-slots.js` (new, on new-fixture.js), 22 PASS: the couch's Weekly Lineup given a slot;
    its season turned into pairs by its stored research and the season sync; the six pairs going into 6 on offer, sure; jordan's
    and riley's picks, a second slot, someone else's slot and a group not on offer refused; sam, behind, offered nothing; the
    lock; Episode 6 re-drawing two pairs at its start, its results through the season sync; jordan's slot held (his pair's
    mean), riley's void, the table counting jordan's and nothing for riley's; the read hiding Episode 6 until jordan has seen it;
    Episode 7 offering the pairs after the swap, riley's slot dropped and picking again, jordan's riding with its pair.
    `check-engine-lab.js` grew A10's (two slots said in the sentence, slots beside Outlast refused, started as a test game in its
    field): 50 PASS (`--api`).
  - **Re-runs** (on the final code): `check-lineup-scoring.js`, `check-format-groups.js`, `check-questions-who.js --api`, ALL PASS.
  - **Golden replays** (`golden.js`, HEAD against the working tree, after the code review's fixes): 7 seasons, 160 games, **19,361
    reads, every one the same** (no game they play has slots, and nothing on their paths changed: a write to a game without
    slots reads no timeline). The tracker `--check` up to date.
  - **Blind replays** (`blind.js run`, the five seasons, after the code review's fixes; the seats' habit for slots: an empty or
    dropped slot takes the group on offer holding most of its team, else one by its seat): **every game ended on all five
    seasons**, the two slot games (two slots and one) among them on each: The Challenge 41 53 of 53, 40 53, 39 53, Survivor 49
    71, The Traitors 4 53; no slot scored while not held, no pick the app offered refused. What the slots did (the study doc's
    "A10 part 1: group slots, replayed blind"): on The Challenge 41's rotating pairs a fresh pick at nearly every episode,
    nothing on offer at the premiere and at 2 (the premiere's report can't be checked: void by default, F4's item), void at
    the Lock In's unsure 11 and the claim at 16-17; on The Challenge 40 the eras ridden through 3-9 and dropped at the split; on
    Survivor 49 the tribes ridden, void at the swaps (re-drawn at an episode's start) and dropped at the merge; on The Traitors
    4 nothing ever offered (no groups: a solo draft); on The Challenge 39 never held (its teams drawn at the start of nearly
    every episode: Noticed). The first run found one problem, the replay's own habit (a seat's first slot taking the group its
    second rode with, which the app rightly refused): fixed in `blind.js` and The Challenge 41 replayed again.
  - **Code review** (`/code-review`, before the long runs; it ran this time). Taken: the GET's late joiner read their start, not
    their own week (now `catchingUpMark`'s, as the PUT); a failed timeline read inside a write's transaction would have aborted
    the write (now in a savepoint); a group's mean divided by the members on the league's cast only (now by its people as
    research has them: `size`); the breakdown's total had slot points without a line (now `slots`); a mutation turning slots
    on didn't read the groups until a later write; the GET settled fresh groups in memory while the tables scored the stored
    ones (now both read the stored); exclusive counted any seat as a holder but covered only the rotation (now the rotation
    both ways); the slot lock its own copy of the lineup lock (now `isLineupLocked`); two doc comments separated from what they
    describe; `exits` and an episode scan per player and episode (now `index()`, once a pass); a no-op in the PUT. Partly: the
    season-cast link for matching members (kept the forgiving match, as F3 part 2's group questions, and Noticed); the
    `ctx.pool` check having no caller (Noticed: G1's context pack and the lab). After it, by hand: the replay's habit could put
    the group a seat's other slot rides with into its second slot (fixed in `blind.js`), and its header.

  **As built (A10 part 2, 2026-10-29, on `engine`, not merged; no migration).** One session, after `lane.js sync engine` (already
  up to date; 974 tests). A pool's pieces, each riding on data with its fallback from the start; every default the user's
  (Noticed, below).
  - **The spec** (`schema.js`): a Survival Pool's `score` takes `lives` (1 to `MAX_LIVES`, 5: a wrong pick, or none, costs one;
    at none you're out, with no more picks), `buyback` `{ times, before, cost }` (with lives only: someone out in an episode
    before `before`, `{ phase }` or `{ episode }` or null for any time, is back in from the next episode with one life, `cost`
    points off their total; 1 to `MAX_BUYBACKS` times, 0 to `MAX_BUYBACK_COST` points) and `mulligans` (1 to `MAX_MULLIGANS`:
    the first wrong picks, or missed ones, forgiven: no life lost, the streak carries on). Its `get` takes `second` `{ fallback:
    void | counts }`: a second pick beside the first, open every episode, that counts on a night two or more go home; on a night
    only one goes it's void (no points either way) or counts like the first (two picks every night). A new rank,
    `rank: { by: 'standing' }`, last one standing (a pool with lives only): whoever's still in first, by their points then lives
    left; then whoever's out, the later out first, then their points. VOCAB's `rank.by.standing`, `get.second.fallback`; the
    defaults (`BUYBACK`: once, any time, its cost one right pick's points capped at `MAX_BUYBACK_COST`; `SECOND_PICK`: void)
    filled by `fullSpec` only on a spec that has them, so no stored spec changes; a pool with lives keeps the streak's rank unless
    the spec says standing. `specProblems`: each range; a buyback without lives; a buyback before a new game's own first episode
    (a league's own keeps what it plays); with ctx, a buyback's phase one of the season's and not its first, and a second pick
    on a show whose results say who goes home; a second pick beside a pool that scores (nobody goes home there) or a draft;
    standing without lives. `poolParts(spec)`: the one reading of a pool's parts (defaults filled), for the engine and the words.
    Plays as `pickem` (`playsAs` takes standing beside streak).
  - **What's data at the lock, for two picks:** nothing. The schedule has only a runtime (a two-hour episode is often one boot),
    no rulebook marks a double, and research comes after the episode. So the second pick is open every episode, optional, and
    the results settle whether it counted: two or more non-winners among the episode's exits (`PickEmLogic.double`; a finale's
    winner isn't one going home). A missing second pick is nothing, never a miss (nobody knew).
  - **The settings, both ways** (`settings.js`): `poolLives`, `poolBuyback`, `poolMulligans`, `poolSecond`, `poolRank`, each
    absent unless a game says it (`OWNED`; a part of its own for the rank).
  - **The engine** (`state-logic.js`, pure): `PickEmLogic.parts(state)` (`poolParts` of the game, null for today's pool);
    `history()` walks the season once with the parts: a night's picks judged together, its right ones first, then its wrong ones
    (so a night with a wrong pick ends the streak whichever pick it was), each wrong one a mulligan forgives or a life it costs;
    a night that empties someone's lives ends, once, with a buyback (`canBuyBack`: before its episode, or before its phase's
    first episode where data says it starts, `state.phaseStarts`; a phase whose start isn't known hasn't started, so the
    buyback stands, and a start confirmed later takes it back, as every result is worked out live) or out for good (no rows
    after it; a pick made before the results that knocked them out never counts). Rows carry `second` (and `void`),
    `forgiven`, `lifeLost`, `lives`, `boughtBack`, `out`, and the history `lives`, `out`, `mulligans`, `buybacks`, `cost`, all
    only on a pool with parts: a plain pool's rows and table are exactly as before. `eligibility`: someone out can pick nobody
    (`out`); a second pick is in the cycle and blocks back to back once it counted (a void one never played); the last episode's
    picks both blocked. `setPick(…, { second: true })`: beside a first already made, never the same person, by the same rules;
    the first moved onto the second's person drops it. `removePick(…, { second: true })`: the second alone; in a pool with a
    second pick, neither once the episode is locked or decided (a wrong second cleared after the results would take back its
    cost). `PickEmScoringStrategy` adds `lives`, `out`, `mulligans`, `buybacks` to a pool's rows and sorts by `standingKey`
    under last one standing. `readsPhases`: a pool whose buyback lasts until a phase records the season's phase starts
    (`settlePhases`).
  - **The server:** the pick routes take `second: true` (PUT) and `?second` (DELETE), their Recent changes line saying "second
    pick"; the Games tab's table (`game-view.ts tableOf`) ranks a standing pool by the engine's key (its `total` column still
    the streak: U1's); `phase-starts.ts settleSeasonStarts` finds pools whose buyback lasts until a phase (`poolBuyback.before.phase`),
    so a desk confirmation reaches them. Computer players (`bot-logic.js`) make a second pick, the next safest; none once out.
  - **Words** (`describe.js`): the sentence ("…, and a second that counts when two go home"; "Two lives: a wrong pick costs one.
    One buyback before Merged starts. One wrong pick forgiven. Last one standing wins.") and How it works, a line each; a pool
    ranked by standing is still a Survival Pool.
  - **The tracker:** s10 (two lives, a buyback before the merge, last one standing), s11 (a second pick), s23 (a mulligan) ✅,
    and a dial row, `win.standing` (last one standing among the players, three lives) ✅. **Now: 151 ✅** · 94 ⏳ · 1 🆕 · 1 ❓ ·
    23 💬, of 270 (A10's 13 rows wait for parts 3 and 4).
  - **Tests:** `tests/pool-parts.test.js` (new, 11): the shape, defaults, ranges, words and settings both ways; a plain pool
    exactly as before; lives (a missed pick costs one, out with no rows after, nobody to pick, last one standing and by streak);
    the order among those still in and the Games tab's table; mulligans (with and without lives, a missed pick forgiven); a
    buyback before an episode and before a phase (standing while unknown, taken back by a start confirmed later); a night that
    empties lives buying back once; the capped default cost and hand-written settings without a cost; a second pick void, counted
    and in the cycle only when it counted, fallback counts, a winner's exit not a double; its writes and the lock on clearing
    it; computer players. `game-spec.test.js`: the new fields. `npm test` 985.
  - **API:** `scripts/dev-test/check-pool-parts.js` (new, on new-fixture.js), 29 PASS: the couch's Survival Pool given two lives,
    a buyback before the merge, a mulligan, a second pick and last one standing (setGame, the show's ctx); Episodes 1 to 5
    replayed as each player picked (riley's first wrong forgiven, a life, her last bought back; sam never picks: out in 4); the
    Games tab's table; picks through the route (a second, the same one twice not stored, cleared on its own, the cycle, sam out,
    someone else's refused); a double boot through the season sync (jordan's two right, alex's second forgiven by his unused
    mulligan, riley out in 6, her right second still scoring); the desk confirming the merge at 4 (riley's buyback in 4 taken
    back, sam's in 3 standing) and correcting it to 7 (hers back); a single night voiding jordan's second; the table's order the
    engine's. `check-engine-lab.js` grew A10 part 2's (the three rows said in their sentences, a buyback without lives and one
    until a phase the season lacks refused, each started as a test game in its fields, the phases recorded): 58 PASS (`--api`).
  - **Re-runs** (on the final code): `check-phase-starts.js --api` all passed, `check-lineup-scoring.js` ALL PASS.
  - **Golden replays** (`golden.js`, HEAD against the working tree, before the code review's fixes and again after them): 7
    seasons, 160 games, **19,361 reads, every one the same** both times (the pools they play have no parts: their rows, tables
    and picks are as they were; the replay's seats and computer players make a second pick only where a pool has one). The
    tracker `--check` up to date.
  - **Blind replays** (`blind.js run`, the five seasons, on the final code; no piece reads the format, but the tracker's new games
    are among those it plays, and the seats' habit makes a second pick, the next by the same habit, never by a lazy seat):
    **every game ended on all five seasons**, the new pools among them: The Challenge 41 56 of 56, 40 56, 39 56 (a buyback
    before the merge refused there: no such phase), Survivor 49 75 of 75 (all four), The Traitors 4 56 of 56; every check ok
    but F4's known "waits on early results" (finding 20). What the pieces did: a second pick counted wherever a night sent two
    home, which on The Challenge is often (the Tinkerer 19 points with one, 15 without, on 41) and on The Traitors nearly every
    night (a murder and a banishment: 16 against 10); on Survivor 49 only the finale did, where every pick is wrong anyway
    (Noticed); lives knocked the Fan and the Forgetter out early on every season, so last one standing ranks them by when.
  - **Code review** (`/code-review`, before the long runs). Taken: clearing a decided second pick took back its cost (now locked
    in a pool with one); a double night's two wrong picks could buy back and spend the new life the same night (now a night
    empties lives, then buys back or goes out, once); the default cost could pass the cap (now capped); the pool's parts read again
    for every episode and eligibility (now passed down); a buyback written without a cost made totals NaN (now `poolParts` fills
    it, the one reading the words share); the settings' types; a second copy of the streak's arithmetic (now one path); Recent
    changes saying "pick" for a second pick. Not taken here: the screens that rank a pool by streak (Noticed, U1's). Found by the
    API check, before the review: the desk's season-wide settle picked its leagues by SQL and missed pools (now
    `poolBuyback.before.phase`).
  **Part 3 split in two (2026-10-29):** part 3, a draft's slots and the draw (s05, s06, s38, answer.draw: this session); part
  3b, a draft's prices (an auction with a budget, a salary cap whose prices follow the data, buying and selling each week: s03,
  s04, s22, answer.bid, answer.trade), next, before part 4.

  **As built (A10 part 3, 2026-10-29, on `engine`, not merged; no migration).** One session, after `lane.js sync engine` (already
  up to date; 985 tests). A draft spread across the cast's groups and a draw, each riding on data with its fallbacks from the
  start; every default the user's (Noticed, below).
  - **The spec** (`schema.js`): a draft's `get.across`, `{ of: group | gender, then: keep }`, beside any draft (a snake, a blind
    draft or a draw, scored any way): the team spread across the cast's groups as the data has them when it drafts, no more
    than ceil(each / groups) from one and at least floor(each / groups) from each while that group has someone to take
    (`spreadBounds`: a team of three over three tribes is one from each; of five, two, two and one; of two, no two from one), a
    show with fewer than two groups then a plain draft. `then: keep` is the fallback for a swap or the merge, carried in the
    spec: a drafted castaway stays yours wherever they go (its only value now; `DRAFT_ACROSS` fills it). A draw is a draft
    order, `get.order: 'draw'`, with either ownership (`DRAW_OWN` exclusive when it's said alone: one hat, nobody shares;
    shared, a hat each), playing the game its ownership and count make (`playsAs`: an Outlast, a Weekly Lineup, best ball).
    VOCAB's `get.order.draw`, `get.across.of` (group now, gender `later`), `get.across.then`. `specProblems`: the spread's shape;
    a draw with either ownership (a draft people pick in still pairs its order with its ownership). The data rule
    (`settleProblems`): a spread across groups needs a show whose cast has them (`ctx.grouped`); **a guy and a girl is refused**
    (no show's cast or research records who is which: s06 is ❓, the user's question below); exclusive or shared counted per
    group where it drafts (`ctx.poolGroups`, each group's size: every group covers its share of every team, `covers`, the 9:10
    PM decision as the pool shrinks), and an exclusive draw by `ctx.pool` and `ctx.couch` as any exclusive draft. No stored spec
    changes (each part absent unless a game says it).
  - **The settings, both ways** (`settings.js`): `draftDraw` (true) and `draftAcross` (the spec's), for Outlast and Weekly
    Lineup alike, each absent unless a game says it (`OWNED`).
  - **Which groups:** the league's own as the data has them when it drafts (each castaway's `tribeId`: the season cast's
    starting tribes and research's moves since, F3 part 1's tribe moves from the section), the groups the draft room shows the
    cast by; not F3's timeline, which has nothing before the premiere's report (a draft usually comes before it) and whose pairs
    aren't the league's groups. A draft later in the season (a later start) reads the tribes after the swaps; someone on no group
    is a free pick while the floors still hold; a tribe nobody's left in isn't one.
  - **The engine** (`state-logic.js`, pure). `SpreadLogic`: `groupsNow` (each castaway still in's group, the groups in play and
    the bounds, null when not spread or not divided); `allowed(picked, candidates)` (those that keep a team spread, worked out
    from one tally a pass: no group past its most, and each group's share still owed, as far as it has people left to give, no
    more than the picks left; **every candidate when none does, so the spread never blocks a draft**, and a group too small, or
    taken in an exclusive draft, asks only what it has); `pickProblem` (a turn-based pick refused only while someone else would
    keep the team spread, the pick tested first) and `teamProblem` (a blind team, spread as a whole in any order), each with the
    reason in the show's word ("Spread your team across the tribes: at least 1 from each, and no more than 1 from one").
    `SnakeDraftStrategy.pick` and `BlindDraftLogic.validateSubmission` check them. `DrawLogic`: `outcome(state, seed)`, who draws
    whom from a seed, changing nothing (the seats in the rotation shuffled by the seed, `hashUnit`; each round every seat takes
    the first of its hat that keeps its team spread; exclusive one hat, a team it runs out on short; shared a hat each, the
    whole cast still in); `draw` (once: ownership as dealt, each a line in the draft's log, `drawn`, the draw's order the
    draft's, so the waivers' priority reads it, and `state.draw` { seed, at, order, short }: the same seed deals the same teams
    from the league as it was); `ready` (not drawn, a cast, someone to deal to, and **nobody on a team yet: a league drafted
    another way is never dealt over**); `due` (ready, and started: its scheduled time came or the Commissioner's Start, one that
    couldn't deal then included); `settle`. `DrawDraftStrategy` (the draft for a draw: no turn until it's dealt, complete after;
    started by its time or Start, which draws; nothing to pick, order or take back), as `getLeagueType`'s draw variant of
    whichever type its ownership and count make (built once per type, its flags unchanged). `BlindDraftLogic.on`: a blind
    draft is a shared draft people pick in, not a shared draw, the one predicate the call sites read now (`action-items.js`,
    `computer-players.ts draftOpen`, `status-plate.ts`, `bot-logic.js`), rather than the ownership alone.
  - **The server:** `withLeagueLock` settles a due draw before the mutation, and `readyLeague` treats one as work, so a
    scheduled draw is dealt by whoever's write or read comes first after its time, nobody having to start it. The pick route
    (`pickInDraft`) answers a pick that breaks the spread with a 400 and the reason; the queue's pick when the timer runs out takes
    the first queued that keeps the team spread, else waits (as with nothing queued). The draft room (`draft-view.ts`): a draw is
    its own kind (`draw`), read as a revealed blind draft is (the teams, no turns or clock, `revealedAt` the draw's), each team in
    the order it was dealt (by seat and castaway, since a shared draw deals the same one to several). Computer players keep a
    spread draft (snake and blind) and leave a draw to the draw. No screen (U1's).
  - **Words** (`describe.js`): the sentence ("everyone drafts 3 from across the tribes", "everyone gets 1 drawn at random") and
    How it works (the draw's hat or hats and that it's recorded; the spread, its fallbacks and keep), in the show's word for its
    groups (`ctx.group`: `contextOf` gives the rulebook's, `game-rules.ts` the format's); the draft's detail ("At random, out of
    one hat").
  - **The tracker:** s05 (an Outlast of three spread across the tribes), s38 (names out of a hat: an Outlast of one each,
    drawn) and answer.draw (a shared draw) ✅; a dial row, `who.spread` (a Weekly Lineup spread across The Challenge 41's teams)
    ✅; s06 ❓ (who is a guy and who is a girl: the user's). **Now: 155 ✅** · 90 ⏳ · 1 🆕 · 2 ❓ · 23 💬, of 271 (A10's 9 rows
    wait for part 3b, five, and part 4, four).
  - **Tests:** `tests/draft-spread-draw.test.js` (new, 8): the shape, defaults, words and settings both ways; the data rule (no
    groups, a guy and a girl) and the count per group; the bounds; a snake draft spread (one from each tribe, a second from one
    refused with why, a plain draft unchecked); the fallbacks (a tribe that runs out, nobody left that keeps it, one tribe, an
    unplaced castaway, a swap after the draft moving nobody's team, the groups as the data has them now); a blind draft spread in
    any order; a draw (dealt at once, nobody sharing, recorded, the same seed the same teams on any copy, another seed another
    draw, once, picks inert, the draft view, a late joiner); its fallbacks (a hat that runs out, shared hats, spread hats, a
    scheduled draw due and dealt, no cast); computer players; the code review's cases (a Start nobody could be dealt yet dealt
    once someone is, a drafted league never dealt over, a shared draw no blind draft for the action items, the bots' removal
    and the draft view's order). `game-spec.test.js`: the new fields. `npm test` 993.
  - **API:** `scripts/dev-test/check-draft-spread.js` (new, on new-fixture.js), 20 PASS: Couch Cup made an Outlast of three spread
    across the tribes (three tribes going into Episode 6, after five boots), started by alex, drafted turn by turn through the
    pick route (someone else's turn 403; a second from a tribe someone has 400, with why), every team one from each tribe; Pool
    Party made names out of a hat, Start dealing everyone one at once, nobody sharing, the seed dealing the same teams from the
    league as it was, a pick and a new order refused, the draft room reading it as a draw; Lineup League a Weekly Lineup of three
    from a hat each, spread, scheduled a minute ago: jordan's read of the league dealt it, a second read nothing new; ZT Extra a
    blind Weekly Lineup spread across the tribes: casey's two Tokas refused (400, with why), the spread teams locked in and
    revealed. `check-engine-lab.js` grew A10 part 3's (s05 and s38 said in their sentences, a guy and a girl refused, each started
    as a test game in its fields): 63 PASS (`--api`).
  - **Re-runs** (on the final code): `check-group-slots.js` ALL PASS (withLeagueLock changed).
  - **Golden replays** (`golden.js`, HEAD against the working tree, after the code review's fixes): 7 seasons, 160 games,
    **19,361 reads, every one the same** (no game they play is spread or drawn; the call sites that read "shared" as a blind draft
    read `BlindDraftLogic.on` now, which is the same for every league that isn't a draw; the replay's seats and computer players
    take who keeps a team spread, everyone where nothing is). The tracker `--check` up to date.
  - **Blind replays** (`blind.js run`, the five seasons, on the final code; the spread reads the groups the data has): **every game
    ended on all five seasons**, the tracker's four new ones among them: The Challenge 41 60 of 60, 40 60, 39 60, Survivor 49 79 of
    79, The Traitors 4 58 of 58; no problem in any game's moves, no check failed. The draws dealt every seat at the premiere's
    draft (one hat: four different; a hat each: some the same), and on The Traitors 4 the two spread games were refused (nobody's
    in a group), as the data rule says. **What it found:** every game is made before the premiere, and no season's league had
    groups then (Survivor 49's cast has its tribes from the premiere on, `tribes_from_episode`, so a league sees them once Episode
    1 has results; The Challenge's teams come from research), so each spread draft drafted plainly, the fallback (Survivor 49's
    blind spread Weekly Lineup gave two seats five Kele each). The spread itself is proven by the unit tests and the API check (a
    draft after the tribes are known); the question is the user's (Noticed, item 4). The study doc's "A10 part 3: the spread and
    the draw, replayed blind".
  - **Code review** (`/code-review`, before the long runs; it ran this time). Taken: a shared draw read as a blind draft
    wherever the ownership alone was asked (a lock-in item nobody could clear, computer players that could never be taken out;
    now `BlindDraftLogic.on`, read by those call sites); a Start nobody could be dealt yet never dealt later (`due` counts the
    Start); a league drafted another way dealt over once it became a draw (`ready`: nobody on a team); the draft view ordering a
    shared draw's teams by someone else's draw; computer players and the replay's seats reading the spread over a narrower list
    than the pick's check (a stall where a ghost owns someone; now over every free agent, as the check); the spread's tally
    worked out again for every candidate (now once a pass, the pick tested first); the draw's seat order merged from the
    draft order and then shuffled anyway (now the rotation); owned ids by hand beside `Core.ownedCastawayIds`; the count counting
    an empty group. Partly: `ctx.poolGroups` has no caller (Noticed, with part 1's `ctx.pool`). Not taken here: the classic draft
    board and grid that read shared as blind (U1's screens, Noticed).
  **As built (A10 part 3b, 2026-10-29, on `engine`, not merged; no migration).** One session, after `lane.js sync engine` (master's
  48 commits: the desk's read-only games met A4's question sheets and A3's phase starts in five files, both kept; 1019 tests). A
  draft's prices, each riding on data with its fallbacks from the start; every default the user's (Noticed, below). Buying and
  selling each week was split off as part 3c (it builds on these prices: cash a sale refills, what someone gone home is worth,
  ranking by worth).
  - **The spec** (`schema.js`): a draft's `get.budget` and `get.order: 'auction'`. A budget beside an auction is everyone's money,
    `{ total, floor, fallback }`; beside any other draft order (a snake, a blind draft, a draw) it's a salary cap, `{ total, floor,
    ceiling, gone }`. An auction is exclusive (fullSpec: said alone, exclusive; shared refused: "what they cost comes from the data
    instead (a salary cap)"), and always has a budget. Defaults (`BUDGET`, `AUCTION`, `CAP`, the user's): 100 each (the user's
    "$100"), the lowest price or bid 1, an auction's team its bids didn't fill filled at the lowest price, a cap counting someone
    gone home as nothing; a cap's highest price left out is `ceilingFor`'s (the middle price, what everyone costs before anyone's
    scored, is the most a team can average within the cap: 100 for 5 is 1 to 39). VOCAB's `get.order.auction`,
    `get.budget.gone`, `get.budget.fallback`. `budgetProblems`: the budget 1 to `MAX_BUDGET`; everyone able to fill a team at the
    lowest price; an auction's parts and a cap's apart (a ceiling or gone on an auction, a fallback on a cap, refused); a cap only
    on a draft scored by moments (scored by place everyone still in has the same points, so nothing would cost more). The
    exclusive count (the 9:10 PM decision) says, for an auction the pool doesn't cover, "make it a salary cap". `budgetParts`
    reads it the one way for the engine and the words. No stored spec changes (absent unless a game says it).
  - **The settings, both ways** (`settings.js`): `draftAuction` (true) and `draftBudget` (the spec's), each absent unless a game
    says it (`OWNED`).
  - **Prices from data** (`PriceLogic`, `state-logic.js`, pure): each castaway's points so far by the game's own rules (the moments
    recorded for them in every episode with results, the whole season's, at the game's points), and a cap's price by where they
    stand among those still in: the best at the highest price, the last at the lowest, evenly between, ties sharing the middle of
    their places, whole numbers; before anyone's scored everyone costs the middle. Someone gone home: nothing, or what they cost
    going into the episode they went home in (`gone: last`). Prices move with every episode's results; `prices(state, through)`
    reads them as of any episode.
  - **The salary cap** (`BudgetLogic`): a team's prices together within the cap when it's drafted and whenever it changes. At the
    draft: a snake pick refused only while someone else who keeps the team spread would keep it within, with room left for its
    other places at the cheapest of everyone free (`least`; the refusal says "Your team would cost at least 34, with 1 more to
    pick at the cheapest: the cap is 30"); a blind team refused when it costs more than the cap (unless even the cheapest team
    would); a draw takes from each hat the first that keeps the team within it. **The cap never blocks a draft** (with nobody who
    fits, anyone can be taken). After the draft, every change (a waiver claim's pair, at the claim and again at processing,
    free agency, a replacement filled at the lock): within the cap at today's prices, or no further over than it is (**a team
    that went over as its prices moved keeps its team**); a replacement for someone gone home is never refused when nobody
    cheaper is free (the cap never leaves a place empty; autoPick fills with the same). A pass the cap stopped reads "would have
    taken your team past the cap" (`WaiverPass.reason 'cap'`, its words in `waivers-model.ts` and `waiver-view.ts`). The spread
    and the cap compose (`draftFits`, `draftFitsFor`: the cap over the spread's choices, so a pick passing both always exists).
  - **The auction** (`AuctionLogic`, `AuctionDraftStrategy`): once the bidding opens (the draft's start: its time or the
    Commissioner's Start) everyone bids in private, a sheet of up to three bids for each place (backups), each a whole number from
    the lowest price to what's left after it for every other place (`maxBid`); a sheet can be empty (fill me). It settles at
    once, the moment everyone has a sheet in, **or when the game's first episode starts with sheets still out** (`due`: no game
    waits for someone; whoever runs it can lock in an empty sheet for someone, as the blind draft's lock-in for someone).
    Settling (`outcome`, pure): every bid from the highest down, **ties in a seeded order** (`hashUnit`, the seed recorded in
    `state.auction`, so the same bids and seed settle the same way), each won at what was bid while its castaway is free, the
    bidder's team has a place, they can still pay the lowest price for every place after it, and it keeps a spread team spread;
    then, by the fallback, every team still short filled a round at a time from a seeded hat of what's left at the lowest price
    (so not bidding never beats bidding), or left short. `settle`: ownership, the draft's log with each price (`filled: true`
    for one the bids didn't win), the seed's seat order as the draft's (the waivers' priority reads it), `state.auction` { seed,
    at, order, spent, short }. Never over teams made another way (`ready`, as a draw is never dealt over). Someone joining
    after joins as after any finished draft. `sheetFor`: a sheet from an order (the budget over the first team's worth by rank,
    the backups at the lowest), how computer players and the replays' seats bid.
  - **The server:** the sheets live where a blind draft's picks do, in `blind_draft_picks` (its JSONB column holding [{ castawayId,
    bid }]; no migration), private until it settles, the state holding only who's locked in (`src/lib/server/auction.ts`:
    `lockAuctionBids` settles in the same transaction when it's the last sheet, `unlockAuctionBids`, `settleAuction`,
    `settleDueAuction`; who's in read by `blind-draft.ts lockedIdsFor`). `withLeagueLock` settles a due auction before the
    mutation and `readyLeague` treats one as work, so it settles at whoever's write or read comes first after the first episode
    starts. `draft.ts`: `lockBidsFor` (yours, or someone's when you run the game, a line in Recent changes that never says what
    they bid), `unlockBidsFor`, `readOwnBids` (self only, as a blind draft's picks); **each withdrawal only on its own kind of
    draft** (the two share the table: the code review's find). Routes: `/api/leagues/[id]/draft/bids` (GET your own, POST lock,
    DELETE withdraw; a refused sheet answers 400 with why) and the season draft route's `bid` and `unbid` actions. The pick
    route answers a pick past the cap with a 400 and why; the queue's pick when the timer runs out takes the first queued that
    keeps the team spread and within the cap. The draft room (`draft-view.ts`): an auction is its own kind (`auction`), read as a
    blind draft is (who's locked in; the teams once settled) with its budget, and once settled what each spent and who's short.
    Computer players bid (`bot-logic.js auctionBids`, locked in by `bots.ts` as a person's), draft within a cap (snake and
    blind) and claim on waivers within it. No screen (U1's).
  - **Words** (`describe.js`): the sentence ("everyone has 100 to bid on a team of 5", "everyone drafts 4 under a salary cap of
    100") and How it works (the auction's sealed bids, when it settles, ties, the fill; the cap's prices by how they're doing,
    starting equal, moving after every episode, a team over keeping its team, someone gone home counting as nothing or what they
    cost); the draft's detail ("An auction: sealed bids, settled at once").
  - **The tracker:** s03 (a Weekly Lineup auction, 100 each), s04 (a blind Weekly Lineup under a salary cap of 100, checked against
    The Amazing Race's rules as a show of its kind) and answer.bid (an Outlast auction) ✅; s22 and answer.trade wait for part 3c.
    **Now: 158 ✅** · 87 ⏳ · 1 🆕 · 2 ❓ · 23 💬, of 271.
  - **Tests:** `tests/draft-prices.test.js` (new, 8): the shape, defaults, words and settings both ways, what's refused, the count
    saying "make it a salary cap"; prices by standing, ties, moving with results, someone gone home (zero, last); the auction
    (the bids' shape, the highest first at what was bid, the fill, what each spent, the same seed the same way, once, nothing to
    pick, the draft view); ties by the seed (both seats win across seeds), what a bid can pay, the fallback short, a spread
    auction, the close at the first episode's lock; the cap at the draft (a snake pick refused with its cost and allowed when
    nobody fits, a blind team, a draw, computer players); after the draft (further over refused, coming down or no further over
    allowed, gone counting nothing, autoPick within it); the code review's cases (the default highest price fitting an average
    team for 3 to 7, the places left priced from everyone free, never over teams made another way, the cheapest replacement, a
    budget that isn't one, a sheet from an order); computer players' sheets. `game-spec.test.js`: the new fields. `npm test`
    1027.
  - **API:** `scripts/dev-test/check-draft-prices.js` (new, on new-fixture.js), 26 PASS: Couch Cup made an Outlast auction of two
    each from Episode 6, opened by alex; a bid of 100 refused (400: "from 1 to 99"); riley's sheet locked, a second lock refused,
    withdrawn, locked again and read back; jordan bidding the same 40 on one of hers; riley refused locking in for sam (403);
    alex an empty sheet for sam; the state naming who's in and never a bid; a blind draft's withdrawal on the auction refused;
    alex's sheet settling it (every team two, the tie to jordan by the recorded seed, settled the same way again from it, sam
    filled at 1 each, the sheets gone, the draft room reading an auction, done). Pool Party an auction from Episode 1 (aired):
    jordan's read settled it, everyone filled. Lineup League a blind Weekly Lineup under a cap of 45: the three dearest (68)
    refused with their cost, a cheap team locked in, an auction's withdrawal on it refused. ZT Extra a snake Weekly Lineup of
    two under a cap of 40 (two immunity wins given so the prices differ: 25, 23, the rest 11): casey's second pick that would
    cost 48 refused (400, saying so), a cheap one taken with its price in the log. `check-engine-lab.js` grew part 3b's (s03 and
    s04 started as test games in their fields): 65 PASS (`--api`).
  - **Re-runs** (on the final code, the lane's database migrated to master's 0430 first): `check-draft-prices.js` 26 PASS and
    `check-engine-lab.js --api` 65 PASS again, `check-draft-spread.js` ALL PASS (the draw's and the snake's checks changed),
    `check-waivers.js` all passed (the claim and free agency checks changed). `npx tsc --noEmit -p .` clean (but the stale
    generated route types for master's new `/admin/[[...path]]`, which the dev server regenerates).
  - **Golden replays** (`golden.js`, HEAD against the working tree, after the code review's fixes and `npm run migrate`): 7
    seasons, 160 games, **19,361 reads, every one the same** (no game they play has a budget; the snake's and blind draft's checks,
    the draw's dealing and the waivers' checks read the cap only where there is one). Its first run said "0 games, every one the
    same" on every season: the lane's database was 11 migrations behind after the sync (Noticed); `golden.js` now fails a season
    whose replays made no game.
  - **Blind replays** (`blind.js run`, the five seasons, on the final code): **every game ended on all five seasons**, the
    tracker's three new ones among them: The Challenge 41 63 of 63, 40 63, 39 63, Survivor 49 82 of 82, The Traitors 4 61 of 61; no
    problem in any game's moves, no check failed. The auctions settled at the premiere's draft with every sheet in (the seats bid
    by habit through `sheetFor`; the forgetter's sheet locked in empty for them, filled at 1 each); where two wanted the same one
    the higher bid won and a backup filled the other's place. **What it found:** the salary cap didn't bite at the draft on any
    season, since every game is made before the premiere, when every price is the same (Noticed, item 8). The study doc's "A10
    part 3b: the auction and the salary cap, replayed blind".
  - **Code review** (`/code-review` at high, before the long runs; it ran this time). Taken: a withdrawal of auction bids on a
    blind draft (or the reverse) deleting the other's private row (the two share the table: each withdrawal now checks its own
    kind); the default highest price rounding an average team past the cap, so the cap never applied before anyone scored
    (`ceilingFor` now makes the middle price exactly what an average team can afford); the places still to fill priced from the
    spread's narrowed list (now from everyone free); an auction settling over teams made another way (`ready`); a replacement for
    someone gone home refused at the cap while autoPick would fill it with the same (now allowed when nobody cheaper is free); the
    words throwing on a budget that isn't one; prices computed again for every pair of a claim and twice a pick (now once a claim
    and a pick); the bidding formula copied between the bots and the replays (now `sheetFor`), and the sheets' "who's in" read
    copied from the blind draft's (now shared); free agency's cap refusal shown before its own; the draft room not giving the
    budget or what each spent. Not taken: nothing. After it, by hand: `golden.js` failing a season that made no game, and the API
    check's two cross-kind withdrawals.

  **As built (A10 part 3c, 2026-10-29, on `engine`, not merged; no migration).** One session, after `lane.js sync engine` (master's
  64 files, its migration 0431 applied to the lane's database with `npm run migrate`; 1041 tests). Buying and selling each week, a
  stock market, on part 3b's prices, each piece riding on data with its fallback from the start; every default the user's
  (Noticed, below).
  - **The spec** (`schema.js`): a budget's `trade: { fee }` makes it a stock market (beside a salary cap's draft or an auction,
    scored by moments: its prices are part 3b's, each castaway's points so far by the game's rules, by standing; after an auction
    the same prices, so an auction that trades has a ceiling and `gone` too). `left`, what the draft's money left over does:
    `cash` (to trade with: a market's default), `lost` (worth nothing after the draft, as an auction's always was; trading is then
    a sale to buy), or `bids` (a budget to bid on free agents with on waivers: VOCAB 'later', `specWaitsFor` says it waits: 3b's
    Noticed item 11, decided only as a setting). `rank.by: 'worth'`, a market's: cash plus the team at today's prices, ties to
    the points. A market's trades are its waivers' moves, so a market whose spec leaves its waivers out gets `marketWaivers`: a
    window after every episode, the whole team tradeable in each, someone gone home sold and replaced whenever (replace
    'always'); the rest as waivers off. Defaults (`TRADE`, `MARKET_LEFT`): no fee, cash. Refused: worth without a market; `left:
    cash` without trading; a fee past the budget; trading on a game scored by place; a market whose windows allow no trade; a
    market whose prices before anyone's scored would put every team over the budget (every game is made before its premiere:
    "everyone costs 11, so a team of 2 would cost 22, more than the 20 everyone has: a highest price of at most 19 fits"). **The
    exclusive count** (the 9:10 PM decision): an exclusive market needs someone left over to buy, so a couch whose teams take
    the whole pool is told "nobody's left to buy: make it shared"; shared, two can hold the same castaway. No stored spec changes
    (absent unless a game says it). `marketOf`; the settings both ways (`settings.js`): the budget in `draftBudget` as before,
    and `draftRank: 'worth'` (a lineup's or best ball's).
  - **The cash ledger** (`MarketLogic`, `state-logic.js`): never stored, worked out from the logs: the budget (or nothing, when
    the money left over is lost), less what the draft's log recorded each castaway at (a snake's picks under the cap, as 3b
    recorded them; a draw's, now recorded too; an auction's bids), less a blind draft's recorded at its reveal
    (`blindDraft.paid`: a blind draft has no log), plus what each move's log entry recorded it sold for, less what it paid and
    its fee (`MidSeasonLogic.log` stamps `sold`, `paid` and `fee` on every move in a market, at today's prices, read once a run
    and once a free-agency move). So **Undo last waiver run and the spoiler views take the cash back with the move** (they take
    the log entry back), and a pick taken back gives its price back. `cash`, `cashAll` (everyone's in one pass), `terms`,
    `moveProblem`, `worth`, `view` (prices, cash and worth for the screens).
  - **Trading** rides on the waiver weeks: open after an episode's results until the next airs, closed while one is on (the
    lock); claims in private, processed in waiver order, then free agency. A trade is a waivers move (a swap sells someone still
    in, a replacement someone gone home), selling at today's price and buying at theirs: `BudgetLogic.moveProblem` answers with
    the market's rule, so every check that held a team to a cap holds a market to its cash (a claim, the run, free agency,
    autofill, computer players). **Nobody spends more than they have**: a move that would leave cash below nothing (or lower, when
    it's already below, only ever from a draft the cap's fallback let go over) is refused with why ("C4 Person costs 15, and a
    trade 1: you'd have 9 to spend"); the run passes it for want of cash (`WaiverPass.reason 'cash'`, its words in
    `waivers-model.ts` and `waiver-view.ts`). **Someone gone home** sells for nothing or their last price (3b's `gone`). **A
    replacement nobody can afford isn't filled** at the close: they hold who they have (the market's fallback, where the cap's is
    the cheapest); **someone who doesn't trade keeps what they have**. Whether two can hold the same one is the draft's ownership.
    Picking a feel for a market's waivers keeps it trading (`WaiverLogic.recommend`'s `market`: every episode, the whole team).
  - **Computer players and the replays' seats** (`bot-logic.js waiverClaim`, which playtest.js's seats claim through by habit)
    trade within their cash: in a market they rank, of those they rate higher, only the ones a sale pays for (the best overall is
    the dearest, refused for want of cash), so a castaway whose price ran ahead of their form pays for one who's in form now.
    The first blind run found the seats barely trading without it (three moves in The Challenge 41's 21 episodes: everyone
    starts with nothing left, and the three best-rated free agents are the dearest). playtest.js's waiver record says each
    trade's price, what it sold for and its fee, and each seat's cash after the week; blind.js keeps the cash and checks it never
    goes below nothing.
  - **Ranking:** a market's score rows carry `cash` and `worth`; ranked by worth they sort by it, ties to the points. **One rank
    key** (`StateLogic.rankKey`: a pool's standing or streak, a market's worth, else the points) for the engine's sorts, the
    table (`game-view.ts tableOf`, its number the worth) and the waivers' order by standings (least points first reads worth in
    a market ranked by it).
  - **Words** (`describe.js`): the sentence ("everyone drafts 5 with 100 to spend, then buys and sells after every episode ...
    Most worth wins: cash plus the team at today's prices"; an auction's "has 100 to bid on a team of 4, then buys and sells
    after every episode") and How it works (the market's prices, the draft within the budget and its fallback, the money left
    over, when trading opens and how much, a fee, someone gone home, who can buy whom, keeping what you have, worth).
  - **The tracker:** s22 (a shared Weekly Lineup of five, 100 each, trading after every episode, ranked by worth) and
    answer.trade (an exclusive snake Weekly Lineup of four that trades) ✅. **Now: 160 ✅** · 85 ⏳ · 1 🆕 · 2 ❓ · 23 💬, of 271.
  - **Tests:** `tests/stock-market.test.js` (new, 8): the shape, defaults, words and settings both ways, what's refused, the
    exclusive count, `bids` waiting; cash through every kind of draft (a snake, a pick taken back, money left over lost, a blind
    reveal, a draw, an auction that trades) and none without a market; a waiver week (at today's prices, refused at the claim
    with why, the run's 'cash' pass, each move's log entry, free agency, Undo taking it back, a fee, exclusive buying only who
    nobody holds); someone gone home (zero: a replacement nobody can afford refused and not filled; last: filled); the spoiler
    view taking a week's trades and cash back, the view, ranked by worth (the rows, the table) and by points; computer players'
    claims within their cash, the recommendation keeping a market trading; the code review's cases (one rank key, the waiver
    order by worth, a market over its budget, free agency's prices read once, everyone's cash in one pass); computer players
    selling one whose price ran ahead of its form for one a sale pays for (after the blind replays). `game-spec.test.js`:
    `draftRank`. `npm test` 1049.
  - **API:** `scripts/dev-test/check-market.js` (new, on new-fixture.js), 18 PASS: Lineup League a shared market of two (30
    each, a trade 1) ranked by worth: its waivers every episode, both tradeable; everyone's blind team revealed, what each paid
    recorded, cash the rest; a week open after Episode 5; riley's claim on the dearest refused (400, saying what she'd have), a
    cheaper one claimed; riley refused Process now (403); alex's Process now running it (the log: 12 sold, 6 paid, the fee 1);
    free agency refusing riley the dearest (400) and jordan buying it (shared: alex keeps his); worth 30, 30, 29, 29; the couch
    hub ranking it by worth; sam's copy (seen through 3) without the week's trades; alex's Undo taking them back with the cash.
    ZT Extra an exclusive snake market (the draft's log 11, 25, 11, 23; casey's cash the rest; casey can't buy one of alex's,
    409, and can buy one nobody holds). Pool Party a Weekly Lineup auction that trades from Episode 1: settled at jordan's read,
    everyone filled at 1 each, 18 left each, the data's prices after it. `check-engine-lab.js` grew s22 (started as a test game in
    its fields): 66 PASS (`--api`).
  - **Re-runs** (on the final code): `check-market.js` ALL PASS, `check-waivers.js` all passed, `check-draft-prices.js` and
    `check-draft-spread.js` ALL PASS (the draw's log and the free-agency checks changed), `check-engine-lab.js --api` ALL PASS.
    `npx tsc --noEmit -p .` clean.
  - **Golden replays** (`golden.js`, HEAD against the working tree, after the code review's fixes, and again on the final code
    after the computer players' market habit): 7 seasons, 160 games, **19,361 reads, every one the same** (no game they play trades; the waivers' order by standings reads `rankKey`, the points for every
    one of them; a draw's log carries a price only under a cap). Survivor 50, on tape since the playtest lane recorded it, isn't
    loaded in this lane's database, so it isn't among them.
  - **Blind replays** (`blind.js run`, the five seasons, on the final code): **every game ended on all five seasons**, the
    tracker's two new ones among them: The Challenge 41 65 of 65, 40 65, 39 65, Survivor 49 84 of 84, The Traitors 4 63 of 63; no
    problem in any game's moves, nobody's cash below nothing in any week. The tinkerer traded one to six times a season, selling
    one whose price had run ahead of their form for one in form (Survivor 49's s22: Sophie Segreti sold at 21 for Rizo Velovic at
    14). **What it found:** a first run, before the seats ranked only what a sale pays for, barely traded (stopped, and run again
    on the habit above); and **nobody could replace someone gone home**: drafted before the premiere, every team costs exactly the
    budget, someone gone home sells for nothing and the cheapest costs 1, so a seat that hadn't made money trading held its
    castaways out all season (Noticed, items 1, 5 and 7). The study doc's "A10 part 3c: the stock market, replayed blind".
  - **Code review** (`/code-review` at high, before the long runs). Taken: one rank key in the engine (`StateLogic.rankKey`),
    read by the table and by the waivers' order by standings (least points first had put the worth leader first); a market whose
    prices before anyone's scored put every team over its budget, now refused, and How it works saying the draft's fallback;
    the scores working out cash twice a row (now everyone's in one pass, `cashAll`, and worth given it); a draw and a
    free-agency move working out prices twice (now once, a free-agency move recording what it read); the 'cash' pass's words
    starting with who it was, as the others do; the rank message naming worth. Not taken, as screens (Noticed, for U1): the
    classic Standings card, Scoreboard, player page, season results card and the reveal ranking by points.
  **As built (A10 part 4, 2026-10-29, on `engine`, not merged; no migration).** One session, after `lane.js sync engine` (master's
  ten files: the corrections fold, no migration; 1049 tests). Keepers across seasons; a team two people share split off as part 4b
  (above). Each piece rides on data with its fallback from the start; every default the user's (Noticed, below).
  - **The spec** (`schema.js`): a draft's `get.keep`, `{ each, from, cost, fallback }`: a game that continues `from` (the couch's
    game on an earlier season of the show, a league id), each seat keeping up to `each` of its team there who are on this season's
    cast. `cost` place (a place on the team, nothing else: a snake passes over a full team, so a keeper costs one of its last
    rounds) | round (a snake's only: it sits out one of its first rounds for each keeper) | price (their price at the draft, out of
    a budget the data prices: a salary cap or a stock market; never an auction's bids alone); `fallback` best (someone who names
    nobody keeps their best who are back) | none. Defaults (`KEEP`, `keepCostFor`): one each, best, `price` in a market and
    `place` elsewhere, filled by `fullSpec` only on a spec with keepers, so no stored spec changes. VOCAB's `get.keep.cost` and
    `.fallback`; `keepParts`; `flagsOf`'s `hasKeepers`; the settings' `draftKeep`, both ways. Refused: more than the team, no
    `from`, a round outside a snake, a price without the data's prices. **The data rule:** `ctx.games` (the couch's games on the
    show's earlier seasons, the context pack's), when given, holds `from` to one of them. **The exclusive count** (the 9:10 PM
    decision) needs nothing more: each keeper takes one castaway out of the pool and one pick out of the draft, so a pool that
    covers every pick still does (a unit test proves it on three couches).
  - **Who can be kept** (`keepers.ts`, server): never a name a person types. For each account on this game that had a seat on
    `from`, that seat's team there as it stands, best first by last season's own measure (an Outlast by how long they lasted, then
    points; anything else by its points, then how long they lasted: `KeeperLogic.rankFrom`), each matched to this league's cast by
    name as each season's cast records it (`nameKey`: accents, case, punctuation, a nickname in double quotes and a Jr. or Sr. left
    out, nothing looser, since nothing in the data links two seasons' cast rows: `optionsFrom`). A game it can't find, on another
    show, or not an earlier season offers nothing (everyone drafts a whole team). Every write to a game whose keepers are open
    settles the options (`withLeagueLock`, in a savepoint: before the mutation, and after one that turned keepers on); the GET
    works them out on its copy without writing.
  - **Naming and the lock** (`KeeperLogic`, `state-logic.js`): a seat names up to `each` of its options before the draft (none is
    keeping nobody; who named them recorded, `chosen.by`); in an exclusive game nobody names someone another seat named first.
    What a seat named stays as named (a bad read of last season's game never erases it), and the lock keeps only those still among
    its options, so someone who left the cast frees the place. They lock as the draft starts (its time, the Commissioner's Start,
    the first pick, a draw, an auction's settling, a blind reveal: `settle` on every write and on the read that finds it due), each
    keeper the seat's own (`acquiredVia 'keeper'`, recorded with its price where it costs one), seats that named theirs first in
    the order they named them, then the fallback's in the draft's order. A game whose teams were drafted before its keepers locked
    keeps its teams. A keeper isn't a pick: Undo doesn't take one back.
  - **The draft fills the rest, whatever its kind:** a snake's turns round by round, a seat taking a turn only in a round its keepers
    leave it (`turns`); a blind sheet of the places left, never the seat's own keeper, a full seat not waited for; a draw dealing
    only the places left (an exclusive hat without anyone kept), its log the dealt alone; an auction's bids for the places left,
    each seat's most bid from what its keepers leave; a salary cap counting keepers like anyone on the team; a stock market's cash
    less a keeper's price; every seat full, a blind draft revealed and an auction settled as the keepers lock. Computer players
    sheet and bid for the places left. `draft-view.ts`'s turns and each pick's round follow the engine's.
  - **Words** (`describe.js`): the sentence ("everyone drafts 3, keeping up to two of last season's team who come back") and How
    it works (who can be kept, a place each, what a keeper costs, whether someone else can have yours, the fallback, someone not
    back).
  - **API:** `GET/PUT /api/leagues/[id]/keepers` (a seat's options and what it named, everyone's once locked; a member names their
    own, the commissioner anyone's; a refusal is a 400 with the reason).
  - **The tracker:** s17 (an Outlast for The Challenge 42, keeping up to two) and shape.keepers (a snake Weekly Lineup of four whose
    keeper costs a round) ✅. **Now: 162 ✅** · 83 ⏳ · 1 🆕 · 2 ❓ · 23 💬, of 271 (A10's two left are part 4b's).
  - **Tests:** `tests/keepers.test.js` (new, 6): the shape, defaults, words and settings both ways, what's refused, the data rule
    and the exclusive count; names across seasons and a seat's options; naming, the lock and its fallbacks (named first, the best,
    none, shared, a cast change, a bad read, a game already drafted); a snake by place and by round, a seat its keepers fill, keepers
    gone from the spec; a blind sheet, every seat full, a draw (exclusive and shared), an auction; a cap counting them, a market's
    cash, computer players. `game-spec.test.js`: `draftKeep`. `npm test` 1055.
  - **API check:** `scripts/dev-test/check-keepers.js` (new, on new-fixture.js's couch, its own zt rows: ZT Survivor 52, four of
    Couch Cup's castaways back, one as the new cast records him with a nickname, ten newcomers), 27 PASS: an exclusive snake Outlast
    keeping up to two (each seat's options, best first; refusals; riley's named, who named it recorded; sam's returnee leaving the
    cast before the draft, so nothing he named is kept; alex naming nobody and keeping his best two; the Start locking them; the snake
    passing over a full team; nobody drafting a keeper; every team three; Couch Cup untouched) and a shared blind Weekly Lineup
    keeping one (a sheet of the places left; another seat taking alex's keeper too; the reveal). `check-engine-lab.js --api` grew
    s17 (started as a test game in its fields): ALL PASS. Re-runs: `check-draft-prices.js`, `check-draft-spread.js`,
    `check-market.js` ALL PASS. `npx tsc --noEmit -p .` clean.
  - **Golden replays** (`golden.js`, HEAD against the working tree, after the code review's fixes): 7 seasons, 160 games,
    **19,361 reads, every one the same** (no game they play keeps anyone; the snake's turns are as before when nobody kept anyone).
  - **Blind replays** (`blind.js run`, the five seasons, on the final code): **every game ended on all five seasons**, the tracker's
    two keepers games among them: The Challenge 41 67 of 67, 40 67 of 67, 39 67 of 67, Survivor 49 86 of 86, The Traitors 4 65 of
    65. `blind.js` now makes a keepers game's last season first: an Outlast for the same four seats on the show's previous season as
    this database has it loaded, each dealt a team at random (a shared draw, so two seats can hold the same castaway), and the new
    game keeps from it through the app's own writes. **What it found:** on The Challenge 41, 11 of 40's cast are back (Bananas among
    them under his nickname, matched by name); on 40, 5 of 39's; each seat kept who it had among them, best first, and every team
    filled to its size; two seats that held the same returnee in last season's shared game met in an exclusive one (Horacio
    Gutiérrez Jr. on The Challenge 40), and the first in the draft's order kept him, the other its next one (Noticed, item 4).
    Survivor 49, The Traitors 4 and The Challenge 39 have no previous season loaded here, so their keepers games kept nobody and
    drafted whole teams (the fallback). The first run of the dial row (an exclusive snake of five) ran out of castaways on Survivor
    49, since the replays start a tracker game without the couch's count; it now drafts four (Noticed). The study doc's "A10 part
    4: keepers, replayed blind".
  - **Code review** (`/code-review` at high, before the long runs). Taken: a salary cap's cheapest-team check counting a keeper
    twice (an over-cap sheet let through); a blind draft or an auction whose every seat its keepers filled waiting forever (now
    done as they lock; a full seat not waited for in an auction either); one bad read of last season's game erasing what seats had
    named (named keepers now stay, filtered at the lock); a snake whose keepers left its spec after they locked throwing on every
    read; How it works leaving out a cap's snake whose keepers cost a round; `nameKey` built on the engine's own name normalizing;
    the castaway type's `acquiredVia` learning 'keeper'; the draft room's view model (`draft-view.ts`) following the engine's turns;
    the GET refusing another seat's keepers that the state carries anyway (now anyone's, Noticed item 5). Not taken: the UUID check
    in `keepers.ts` stays its own (the shared one sits in `auth-helpers.ts`, which imports `db.ts`, which imports `keepers.ts`); the
    reads while keepers are open (Noticed, cost). Part 3c's optional item 3 (a shared market straight to free agency) wasn't taken:
    it goes with part 4b or U1.

  **As built (A10 part 4b, 2026-10-29, on `engine`, not merged; migration 0202).** One session, after `lane.js sync engine` (master's
  view-as, one conflict in `show-space.ts` kept both sides; 1055 tests). A team two people share, the last of A10. Each piece rides
  on data with its fallback from the start; every default and everything a person sees is the user's (Noticed, below).
  - **The spec** (`schema.js`): `extras.seats`, `{ people }`: how many accounts can hold one seat, 2 to `MAX_SEAT_PEOPLE` (4); `{}`
    is two (`SEATS`). Left out (or null) is one a seat, as every game today: `fullSpec` leaves it out then, so no stored spec changes
    and nothing drifts (`game-specs-flag.js`). `seatPeople(spec)`; the settings' `seatPeople`, both ways (`OWNED`), written only where
    it shares. Refused beside Weekly Calls, Weekly Bingo and a pool's weekly call: a call and a bingo card are each person's own (Call
    it's calls are made once for every game; a card is dealt to a person), so a seat there has nothing to share (Noticed, item 5).
    Words (`describe.js`): the sentence ("Up to two of you can share a team."), How it works (joining by an invite, any of them
    making its moves, the last one counting, one team in the game's table), and a detail, Sharing a team (One each, recommended).
  - **The exclusive count, by teams** (the 9:10 PM decision): `teamsOf(ctx)`, `ctx.teams` beside `ctx.couch` (how many teams the couch
    makes when some share one), counted in place of the couch wherever the count is (a draft, a stock market, a spread draft): "6
    teams × 3 picks". Without `ctx.teams` it counts `ctx.couch`, everyone their own team, the most there can be (fail closed). No
    caller passes either yet (G1's context pack, the lab).
  - **The database** (`db/migrations/0202_shared_seats.sql`): `league_memberships.seat_slot` (0 the seat's first, every join until now
    and every join that takes a seat of its own; 1 and up those who joined to share it), and `UNIQUE(league_id, player_id, seat_slot)`
    in place of `UNIQUE(league_id, player_id)`, so a seat still can't take a second account by accident: only a join that means to
    share it picks another slot. `UNIQUE(league_id, user_id)` stays (one seat an account a league). `seat_moves` (league, seat, kind,
    episode): who made a shared seat's latest move of each kind, written only on a seat two or more hold.
  - **Joining** (`shared-seats.ts` `shareCheck`, `join-league.ts`, the invites route): a second person joins by an invite to the
    seat, from someone on it or the commissioner, while the game shares, the seat has room, nobody new is shut out (Who can join
    locked, Lock it down) and the seat isn't a late joiner still catching up or choosing where to start. They take its lowest free
    slot; the seat keeps its name, team and history; they join its couch and follow its season. Their spoiler mark starts where they
    are on the season (`show_follows`, `seenThrough`), never past the latest results, as joining a game under way does. An invite that
    can't share any more (full, the game stopped sharing, catching up) lets them in as a new player, as a hand-over invite whose seat
    was taken does today. Checked again inside the join's lock, so two can't take the last place.
  - **Acting**: every act-for-a-seat check already compares the seat with the caller's own membership (`requireLeagueRole`'s
    playerId), so any of them can make its moves (lineups, picks, group slots, side bets, finale picks, blind sheets, auction bids,
    draft picks, keepers, answers, waiver claims); the last write wins. **Who made it** is recorded where nothing recorded it:
    `forPlayerChange` and a new `seatMoveOf` carry a seat move to `withLeagueLock`, which writes `seat_moves` in the move's own
    transaction, only where the game shares its seats (no query for any other game); waiver claims (`updated_by`), answers
    (`answered_by`) and keepers (`chosen.by`) record theirs already. A co-owner's own move is no Recent changes line (tier 0, as a
    player's own always was).
  - **Marks** (fail closed): each person keeps their own spoiler mark. Where the seat's own state depends on one, it's the lowest of
    the seat's (`seatMark`): a late joiner's week (`catchingUpMark`), and the reveal moving the seat's catching up and its
    `seenThrough` (`reveal.ts`), so one of them revealing never carries the other past what they've seen. A commissioner's waiver nudge
    to a shared seat is worded for whoever has seen least (`waiver-pushes.js`).
  - **Leaving**: one leaving keeps the seat for the others, as it is (`freeSeat`, so Members & roles' take out, Leave these games and
    the desk's account deletion; classic's leave route, now through the league's lock and `freeSeat` too); the last one leaving
    frees it as before. Taken out of a shared team, the
    line's `MemberUndo` says so (`shared`), and Undo (or the desk's Put back) puts them back on it at a free slot while it has room
    (`restoreMember`). Renaming your account doesn't rename a team you share (`renameSeats`). The desk's Link (replacing an account
    on a seat) gives the new one the replaced one's slot.
  - **The couch** (`couch-hub.ts`, `couch-standings.ts`): each person on a shared team is credited with its place: a standings row
    each, the rows carrying their `seat`, and the field counting the team once (`fieldOf`), so nobody else's points change (a place of
    four teams, not five rows); trophies go to both; head to head, your numbers and the accolades follow. One team, credited once, is
    the other option (Noticed, item 3).
  - **Seat-to-account maps**: the game views' (`season-games.ts` `seatsIn`), the waiver admin's (`backstage-games.ts`) and the couch's
    now take a shared seat's first account (by `seat_slot`), not whichever row came last, and someone on a shared seat sees it as theirs
    (so "you" in every view, Weekly Calls' own tally, the draft's own pick). Keepers (`keepers.ts`): a shared team is offered both
    their teams from last season's game, ranked together.
  - **API:** no new route: the invites route (`POST /api/leagues/[id]/invites` with `playerId` a held seat) and the accept route.
    `shared-seats.ts` has `seatAccounts` and `seatMoves` for U1's screens.
  - **The tracker:** who.sharedTeam (an exclusive snake Outlast of three on The Challenge 41, two a team) and s18 (a Weekly Lineup on
    Survivor 51, two a team) ✅. **Now: 164 ✅** · 81 ⏳ · 1 🆕 · 2 ❓ · 23 💬, of 271. A10's rows are all ✅.
  - **Tests:** `tests/shared-seats.test.js` (new, 5): the shape, default, words and settings both ways (a game that never shared reads
    with no seats); what's refused (one, five, a fraction, a misspelled key, bingo, calls, a pool's call, a league's own); the
    exclusive count by teams (a draft, a market, a spread draft; fail closed without `ctx.teams`); the room and the next slot; the
    couch crediting both while the field counts the team once (a trophy each, the plaque's margin, Ran it back for whichever of them
    won before, partners never in each other's head to head). `game-spec.test.js`: `seatPeople` among the fields, the new detail.
    `npm test` 1060.
  - **API check:** `scripts/dev-test/check-shared-seats.js` (new, on new-fixture.js's couch: casey, the fixture's fifth person,
    joins riley's team in ZT Lineup), 28 PASS: refused before the game shares; sharing on; jordan can't invite onto riley's team;
    riley invites casey, casey accepts (slot 1, the seat's name kept, her mark 4 where she is, not the latest 5), the team full
    after; casey and riley each setting the team's lineup (the last counts, `seat_moves` saying who, no Recent changes line), casey
    refused jordan's; the couch crediting casey with the team's place among four teams; casey leaving (riley keeps it), back by
    invite, riley leaving (casey keeps it, its name, its lineup); riley back by casey's invite (the free slot 0), taken out by alex
    (the team stays casey's, the Undo saying so), and Undo putting her back beside casey. Re-runs, after the code review's fixes:
    `check-keepers.js` ALL PASS, `check-desk-seats.js`, `check-new-backstage-ii.js`, `check-new-couches.js`, `check-new-hub.js` and
    `check-new-reveal.js` all passed (the hub's and the reveal's first runs each failed a step while an edit recompiled the dev
    server under them; alone, both passed), `check-engine-lab.js --api` ALL PASS. `npx tsc --noEmit -p .` clean.
  - **Golden replays** (`golden.js`, HEAD against the working tree, before the code review's fixes and again after them): 7 seasons,
    160 games, **19,361 reads, every one the same** both times (nothing they play shares a seat; a seat's moves and marks are as
    before with one account on it).
  - **Blind replays** (`blind.js run`, the five seasons, on the code after the review's fixes): **every game ended on all five
    seasons**, the tracker's two sharing games among them: The Challenge 41 69 of 69, 40 69 of 69, 39 69 of 69, Survivor 49 88 of 88,
    The Traitors 4 67 of 67. The replays' four seats each have an account of their own, so the sharing games play as one account a
    seat: they prove a game that shares its seats plays and ends through every format change (a shared team is one seat to every
    format reader), not the sharing, which `check-shared-seats.js` does (Noticed). The study doc's "A10 part 4b: a shared team,
    replayed blind".
  - **Code review** (`/code-review` at high, before the long runs). Taken: the desk's Undo of a Link putting the account that came out
    back at slot 0 (a collision on a shared team: now its own slot, saved in the undo); the hub's own games saying "of 5" for four
    teams (`fieldOf`); an invite to share losing to reclaiming an old seat of theirs (the invite wins now, as a hand-over's does);
    classic's leave checking for the partner outside the league's lock (two leaving at once could leave a team with nobody: now
    through `withLeagueLock` and `freeSeat`); someone joining to share never seeing How this league works (their explainer mark now
    unset, as any newcomer's); the desk's account deletion saying a shared team stays "unplayed" (it says the others keep it); a
    shared winning team losing its plaque's margin and Ran it back, and partners counted as a tie against each other (one team a
    winner by `fieldOf`, partners never in each other's head to head: unit-tested); the reveal able to move a late joiner's
    `seenThrough` back (forward only now); `takeOut` asking the database what its locked rows already said. Not taken: `seatMoves` (the
    reader for `seat_moves`) stays exported with no caller, for U1's screens.
- **A11. Winning, and who plays with whom.** A race (first to N ends the game), co-op (the group against the show, with shared
  lives), head-to-head with playoffs, teams of players, players knocked out each week (guillotine) or cut at a phase,
  handicaps, late joiners.

  **Split in parts (2026-10-29), each its own session, the engine's only (no screens: U1's).** Each piece rides on data with its
  fallback from the start (a winner or a knockout from results research is unsure of, a tie, a night nobody goes home, a
  knocked-out player's castaways, late joiners, teams of players on a show whose own groups change); every default and what
  players are told goes in the part's Noticed for the user.
  - **Part 1: a race and players knocked out, in a draft** (win.race, win.guillotine, win.cut; s01, s02, s36): `rank.race`
    (first to N points wins, and the game ends that episode) and `rank.cut` (knocked out every N episodes by the points since,
    the guillotine, or at an episode or a phase by the total, the bottom N or half), last one standing for a draft (`rank.by
    'standing'`), the game ending at a race's end or with one left, a knocked-out player's castaways back in the pool (an
    exclusive draft) and their moves refused.
  - **Part 2: a race and knockouts in a game of questions and a pool** (s48, w047): a game of questions is scored on the server
    (its answers: `game_answers`, answers.js), so its race and knockouts read the answers (a wrong guess knocks you out); a pool's
    pick that never repeats; a pool that ends with one left and a night everyone left goes out (A10 part 2's items 8 and 9, as
    settings). **Split (2026-10-29), as its seed allowed:** part 2 is the pool's (w047) and last one standing's end as settings
    (the shapes 2b reuses), built; **part 2b is the game of questions'** (s48): its race (`rank.race`), its cuts (`rank.cut`) and
    a wrong answer, or none, knocking you out (lives on the answers), walked over the graded answers on every server read of the
    game (answer-points.ts, answers.ts, game-view.ts's table, couch-standings, the hub), its end reaching `lastEpisode` and
    `gameOver` though the state doesn't hold the answers, answers refused for someone out or after the end, `oneLeft` and
    `allOut` as the pool's, each fallback from the start (a question voided by a format change or F3 part 2's group fallback, an
    answer research is unsure of, a night nobody goes home skipped by default, a tie, late joiners), and the harness answering
    nothing for a seat that's out.
  - **Part 3: co-op against the show** (win.coop, s37): the couch's lives together, a night nobody saw coming costing one, the
    game won or lost by all.
  - **Part 4: head to head, with playoffs** (win.h2h): a matchup each episode (`rank.by 'matchups'` for shows; L4 brings it to
    sports), the schedule, the standings by wins, playoffs at the season's end, a tie and a night nobody scores. **Split
    (2026-10-30), as its seed allowed:** part 4 is a draft's (Outlast, a lineup, best ball: the spec, the schedule, the standings,
    the playoffs, their fallbacks, and the Games tab's, the hub's and the trophies' readers), built; **part 4b is a game of
    questions'**: its episodes' points from part 2b's walk (each episode's growth, which the walk works out on the server and hands
    over: `answerWalk` carrying its series), head to head refused there until then (`matchupProblems`), and the couch's head to
    head counted from the matchups themselves if the user wants it (part 4's Noticed item 9).
  - **Part 5: teams of players and handicaps** (who.teams, who.handicap, s19): the couch split into teams that score together
    (and teams that follow the show's own groups, through a swap), a handicap's points a week for whoever it names (newcomers,
    from the couch's history), and the late joiners' leftovers (Noticed: computer players and group slots; a late joiner's captain
    and second pick through `GhostLogic.applyAs`; A10's late-joiner items). **Split (2026-10-30), as its seed allowed:** part 5 is
    teams of players (who.teams: drawn or chosen, summed or their mean, a draft's or a game of questions', by their points or head to
    head between the teams, the Games tab's, the hub's and the couch's numbers' readers, the route, every fallback), built; **part 5b
    is handicaps** (who.handicap, s19: a handicap's points a week for whoever it names, newcomers from the couch's history, its
    fallbacks: someone new to the couch, a couch with no seasons, a late joiner), **teams that follow the show's own groups**
    (`rank.teams.made` 'group', VOCAB 'later' now: each team tied to one of the show's groups, on F3's grouping lifetimes, through a
    swap, a merge, each for themselves) **and the late joiners' leftovers** (above, with part 5's: a late joiner's team when the
    game is drawn, `GhostLogic.allowed` for a game in teams). **Split again (2026-10-30), as its seed allowed:** part 5b is handicaps
    (who.handicap, s19: a handicap's points each episode for newcomers, from the couch's history, its fallbacks), built; **part 5c is
    teams that follow the show's own groups** (`rank.teams.made` 'group': each team of players tied to one of the show's groups, on
    F3's grouping lifetimes and the records group slots write, through a swap, a merge, each for themselves, a group dissolving or
    going home whole, an unsure report, a corrected one; or refused, with a recommendation, and left to A12's stages) **and the late
    joiners' leftovers** (computer players and group slots; a late joiner's captain and second pick through `GhostLogic.applyAs`, a
    check that plays them; a late joiner after a draw; `GhostLogic.allowed` for a pool with lives and a game of questions with
    knockouts; the join route reading a game of questions as it stands; a late joiner's team when a game in teams is drawn). **Part
    5c built (2026-10-30), in one session, no 5d:** teams that follow the show's own groups refused (they don't fit as a team of
    players: below, with the recommendation for A12), and the late joiners' leftovers, every one. A11 is done.

  **As built (A11 part 1, 2026-10-29, on `engine`, not merged; no migration).** One session, after `lane.js sync engine` (master's
  desk fixes: a season matched, a group corrected; 1064 tests). A race and players knocked out, in a draft. Each piece rides on data
  with its fallback from the start; every default and everything a person sees is the user's (Noticed, below).
  - **The spec** (`schema.js`): `rank.race`, `{ to }` (1 to `MAX_RACE`, 1000 points): the first there wins, and the game ends after
    that episode. `rank.cut`, a list of 1 to `MAX_CUTS` (4), each `{ at, out, tie, quiet }`: `at` `{ every: n }` (every 1 to 10 of
    the game's episodes, by each one's points over them: the guillotine) | `{ episode: n }` | `{ phase: id }` (by the total, after
    that episode or the one before the phase starts); `out` 1 to `MAX_CUT_OUT` (20) or `'half'` (the bottom half, rounded down);
    `tie` keep | all; `quiet` cut | skip. What a cut leaves out is the defaults (`CUT`: one goes, a tie at the line keeps them all, a
    night nobody goes home cuts like any other), filled by `fullSpec`; a rank that says only its cuts ranks last one standing, which
    `rank.by 'standing'` now also means for a draft that cuts. Both beside a draft (Outlast, a lineup, best ball): a game of
    questions' and a pool's are refused, part 2's. Refused besides: a cut at an episode outside the game or at its last (a league's
    own keeps what it plays), a cut at the phase the game starts at, a race beside a stock market ranked by worth; the data rule
    (`settleProblems`): a phase of the season, not its first, and `quiet: 'skip'` only where results say who goes home. VOCAB
    `rank.cut.at`, `.tie`, `.quiet`; `knockoutParts`; `flagsOf`'s `hasRace`, `hasCuts`. The settings: `draftRank` gains
    `'standing'` (Outlast's too, not only a lineup's), `draftRace`, `draftCut`, both ways (`OWNED`).
  - **Words** (`describe.js`): the sentence ("Each episode the lowest scorer is out. Last one standing wins.", "Before Merged starts
    the bottom half is cut.", "First to 20 points wins: the game ends there."), How it works (each cut with its tie and quiet night,
    a knocked-out player scoring nothing more and making no moves, their castaways back in the pool in an exclusive draft, last one
    standing and one left ending it, nobody new joining once someone's out, a race's tie and a season it never finishes, waiting
    for an episode's full results). A draft that cuts is still its preset's game by name.
  - **The engine** (`state-logic.js` `KnockoutLogic`), worked out from the data on every read, as a pool's lives are: nothing is
    stored, so a corrected result works everything after it out again, and a viewer's copy knocks out only what they've seen.
    `series` (each scored episode's totals as the table counts them, each team as it stood then: a lineup's points episode by
    episode, Outlast's from whoever was held then by the mid-season log, side bets and finale predictions as they settle; the
    parts with them), `walk`/`run` (who's out after which episode, where it ends; a guard so a read inside the walk sees the span
    alone), `cut`, `endsAt`, `outs`, `outOf`, `isOut`, `endedBefore`, `moveProblem`, `frees`, `apply` (the rows' `out`, their
    totals and parts frozen at their last episode in, ranked by `standingKey`). `lastEpisode` (new): the span's end or earlier where a
    race was won or one is left; `spanView`, `gameOver`, the Games tab's results to reveal (`game-view.ts`) and a waiver week's
    opening read it, while `endEpisode` stays the span the game was made with (Game settings, couch-joins, what's said). `rankKey`:
    last one standing for a draft that cuts.
  - **Someone out:** scores nothing after their last episode in; their lineup, captain and group slot refused (`validateLineup`,
    `validatePick`: "You’re out of this game"; a move after an early end: "This game ended with episode N"), their claims and free
    agency refused and out of the waivers' rotation, no side bet on an episode after an early end (`BetLogic`), a computer player
    out sets no lineup (`bot-logic.js`). In an exclusive draft their castaways are back in the pool: exclusivity looks past them as it
    looks past a late joiner's private team (`ownersAside` in `leagueOwnersOf`, worked out once a loop), and a claim keeps them on
    the castaway for their history (`Core.setOwner`). Exclusive group slots stop counting them.
  - **The fallbacks:** the newest episode with early results (who went home, before the scoring) waits: the walk stops there; an
    earlier one still marked early once a later one has results counts as it stands (an episode where nothing scored can stay
    early for good: the season sync marks it final only on a scoring moment or the full answers; the blind replays found The
    Challenge 39's Episode 3 stopping its guillotines for the rest of the season). A tie at the
    line keeps everyone tied there or sends them all, never everyone left; a window's tie goes to the total first. A night nobody
    goes home (`ep.noExit`) cuts like any other, or is skipped. A cut before a phase falls after the episode before it starts, as
    soon as data says where (`state.phaseStarts`, read as a phase's multiplier reads it); where that's known only once the phase
    has begun, it lands then and the phase's first episode no longer counts for whoever it cut. A race nobody reaches plays out by
    the total; two past it at once, the most points first, a tie sharing it. One left of everyone (whatever their start) ends it.
    Late joiners: a ghost (a private season) is outside it; someone still catching up is in it but can't be cut or finish a race
    until caught up, and counts as still in; nobody new joins once someone's out (`GhostLogic.allowed`). `readsPhases` for a cut
    before a phase, and `phase-starts.ts`'s season settle picks such games by `settings.draftCut`.
  - **The tracker:** win.race (a Weekly Lineup, first to 20), win.guillotine (an exclusive Outlast of three, the lowest every two
    episodes out), win.cut (a Weekly Lineup, the bottom half cut before Merged), s01 (an exclusive best ball of four, the lowest each
    episode out, with waivers so their castaways can be claimed), s02, s36 ✅. **Now: 170 ✅** · 75 ⏳ · 1 🆕 · 2 ❓ · 23 💬, of 271;
    A11's eight left are parts 2 to 5's (win.coop, win.h2h, who.teams, who.handicap, s19, s37, s48, w047).
  - **Tests:** `tests/knockouts.test.js` (new, 12): the shape, defaults, words and settings both ways, and what's refused; a plain
    draft scoring as before (no `out` on its rows); the guillotine (ties to the total, frozen totals, one left ending it, nothing
    after the end counting, the table following the engine); ties kept or all, never everyone, the bottom half, a quiet night
    skipped or cut; every two episodes, after an episode by the total, early results waiting (and an earlier episode still early
    once a later one has results counting), a corrected result working it out again; a cut before a phase known ahead and known only once begun (a viewer behind sees none; the rows' parts adding up); a race
    (two at once, nobody there, beside cuts); the walk reading the table's points (a lineup's and Outlast's); someone out (no moves,
    out of the rotation, their castaways free in an exclusive draft, a claim keeping them, a shared draft freeing nothing, a
    lineup refused); the field (a ghost outside, a late start); each team as it stood (a pickup after a cut not reaching back) and
    nobody new joining once someone's out; someone catching up immune but counted. `game-spec.test.js`: the draft's rank fields.
    `npm test` 1076.
  - **API check:** `scripts/dev-test/check-knockouts.js` (new, on new-fixture.js's couch), 18 PASS: Couch Cup made a guillotine
    through `setGame` with the show's ctx (alex out after 1, since his loss there stood until his replacement after 4; riley after 2;
    jordan after 3 on 2 points to sam's 3 though he has more; sam left, over at 3, the span unchanged); the Games tab ranking sam,
    jordan, riley, alex on 12, 13, 8, 5; their castaways free agents, the rotation sam alone. Lineup League a race to 20 (over at 4,
    jordan first on 21, a lineup for 6 refused), then a cut every two (sam out after 2, riley after 4; sam's lineup refused, and
    alex setting it as the commissioner; alex's own accepted; the Games tab as jordan reads it, and as sam does, seen through 3: only
    his own cut). Episode 6 through the season sync: who went home alone is early results, so no cut; a scoring moment makes it
    final, the cut leaves one, and the Games tab agrees once alex reveals 6. `check-engine-lab.js --api` ALL PASS. `npx tsc --noEmit
    -p .` clean.
  - **Cost:** the walk runs about five times for a Games tab read of a game that cuts (10 players, 13 episodes: under 3 ms more,
    a scratch benchmark), and not at all for any other game; nothing is memoised (Noticed).
  - **Code review** (`/code-review` at high, before the long runs; ten findings). Taken: Outlast's walk scored every past episode
    from today's teams, so a pickup (a knocked-out player's freed castaway above all) reached back and could change who'd been cut
    (now each team as it stood, by the mid-season log: the fixture's Couch Cup story changed with it, alex's Episode 1 loss standing
    until his replacement after 4); `endEpisode` had become the early end for every server caller (Game settings, couch-joins,
    phase-starts' line: now `lastEpisode`, beside it, and `endEpisode` the span as made); a cut before a phase waited for the
    phase's first episode even when its start was known ahead (now as a phase's multiplier reads it, so it lands ahead when it can);
    side bets on an episode after an early end; exclusive group slots still counting a knocked-out player (their carried pick held
    its group); the end counted only those who'd started (a late start could end it early) and someone catching up was left out
    of it (now in, immune until caught up, counted as still in; nobody new joins once someone's out); a castaway out with no episode
    recorded counted as still in by the walk; a frozen row's parts not adding up to its total. Not taken (Noticed): the refusals
    naming a knock-out to someone behind (the routes check the league as it stands; U1's wording), `inPlay` left reading the span
    (routing it through the walk would walk once an episode inside every score: the move paths check the early end instead), and
    a memo.
  - **Golden replays** (`golden.js`, HEAD against the working tree, after the code review's fixes): 7 seasons, 160 games, **19,361
    reads, every one the same** (no game they play races or cuts).
  - **The harness** (`playtest.js`, which the blind replays move through): a seat knocked out makes no lineup or claim, and nothing
    is moved for an episode after a game ended early, as the app will offer nothing (the first blind run had the replay's seats
    trying both, refused by the engine: Survivor 49's race and its cut before Merged, The Traitors 4's race).
  - **Blind replays** (`blind.js run`, the five seasons, on the final code): **every game ended on all five seasons**, the tracker's
    four new games among them (The Challenge 41, 40 and 39 72 of 72, Survivor 49 92 of 92, The Traitors 4 70 of 70; the cut before
    Merged plays on Survivor 49 only, the one season with that phase). The race: won at 5 (Survivor 49), 6 (The Traitors 4), 10
    (The Challenge 39) and in 40's finale; never reached on 41 (its scoring runs negative), played to the end. The guillotines ended
    at 3 to 8. They found the early-results fallback above (The Challenge 39's Episode 3) and the harness's moves. The study doc's
    "A11 part 1: a race and knockouts, replayed blind". The golden replays ran again on the final code: 160 games, 19,361 reads,
    every one the same; `check-knockouts.js` ALL PASS again.

  **As built (A11 part 2, 2026-10-29, on `engine`, not merged; no migration).** One session, after `lane.js sync engine` (already
  current; 1076 tests). **Split** (above): the game of questions' race and knockouts (s48) are part 2b, since a game of questions is
  scored on the server from `game_answers`, so its walk is over the graded answers on every server read and its end has to reach
  a state that doesn't hold them: with the pool's pieces, more than a session. Part 2 is the pool's (w047), and last one standing's
  end as settings, the shapes 2b reuses. Every default and everything a person sees is the user's (Noticed, below).
  - **The spec** (`schema.js`): `get.repeat` 'never' (VOCAB), nobody picked twice in the game (a second pick that counted
    included; one that was void never played), and `get.fallback` for a night you've picked everyone still in: miss (a missed
    pick: the streak breaks, and with lives it costs one; the default, `NEVER`, filled by `fullSpec` only beside 'never') | skip
    (nothing counts that night). `rank.oneLeft` ends | plays, beside last one standing (a pool with lives, a draft that cuts):
    once one or none is left, the game ends there or plays on. `rank.allOut` points | share | back, a pool's with lives ranked
    standing: the night everyone left goes out, all out by their points, all out sharing the win whatever their points, or all
    back in. Their defaults are as each was built (`DRAFT_END` ends, `POOL_END` plays and points), read by `knockoutParts` and
    `poolParts`, never filled into a spec (a stored spec reads the same). Refused (`endProblems`, the pick's checks): a fallback
    beside a pick that cycles (it never runs out), `oneLeft` without last one standing, `allOut` on a draft (a cut never takes
    everyone) or a pool ranked by its streak; a race or cut beside a pool says a pool knocks players out with its lives, a game of
    questions' says part 2b. `poolParts` gains `never`, `oneLeft`, `allOut`; `knockoutParts` `oneLeft`. KEYS; the types
    (index.d.ts: the pick's repeat and fallback, `SpecRank`'s race, cut, oneLeft, allOut). Settings both ways: `poolRepeat`,
    `poolFallback`, `rankOneLeft` (a pool's or a draft's), `rankAllOut` (`OWNED`).
  - **Words** (`describe.js`): the sentence ("never the same one twice", "Once one of you is left, it's over.", "If everyone left
    goes out together, they share the win." or "they're all back in."); How it works: "You can't pick the same castaway twice, all
    season." and its fallback in place of the cycle's rule, one left ending it, sharing or all back in; a draft that plays on with
    one left says so. The default `allOut` has no line of its own: the standing rule's "Ties go to the most points" is it.
  - **The engine** (`state-logic.js` `PickEmLogic`), worked out from the data on every read, as A10 part 2's lives are. `history`
    became a `stepper` (one player's season an episode at a time: `step`, `spare`, `result`), walked alone (`solo`) or with
    everyone together (`walk`) when the pool's end is the pool's (`together`: oneLeft 'ends', or allOut other than 'points').
    The walk: nothing after the episode it ended at; the night everyone left goes out (two or more still in at its start, none
    catching up, all of them out after it) spared (allOut 'back': the lives, mulligans and streak they had before it, `spared` on
    the row, its lost life taken off the row) or shared (`shared` on the history and the score row: `standingKey` ties them).
    `histories` (one walk for the table: `compute` and game-view.ts `tableOf`), `endsAt`. `KnockoutLogic.endsAt` reads a pool's
    end too, so `lastEpisode`, `gameOver`, `spanView` and `endedBefore` (side bets, the harness) all read it. `eligibility`: after
    the end nobody picks (`{ available: [], blocked: {}, ended }`, so `setPick` refuses); with 'never', everyone used in their own
    season blocked (reason 'used'; picks before their start don't count, as history's don't), and nobody left is an empty list
    (no cycle fallback). A draft's walk ends with one left only with oneLeft 'ends'.
  - **The fallbacks:** a night with nobody left to pick (miss or skip; a forgotten pick with someone left is a miss either way); a
    night nobody goes home (every pick survives, as A10 part 2 built: nothing to be wrong about); a tie (points: by points; share:
    shared); everyone out the same night and one left (the settings); a lone survivor going out is just going out, never spared;
    late joiners: someone catching up counts as still in (holds the end off, never part of an everyone-out night), a ghost is
    outside the walk and their season stops at the game's end, a late start counts as in until it starts; a corrected result
    works the end out again (the game back on, or a shared win become one winner); early results, which say who went home, decide
    a pool's picks and so can end it (Noticed).
  - **The tracker:** w047 ✅ (a Survival Pool for Survivor 51 that never repeats, one life, last one standing, none or one left
    ending it, a shared win); s48 ⏳ A11 part 2b. **Now: 171 ✅** · 74 ⏳ · 1 🆕 · 2 ❓ · 23 💬, of 271; A11's seven left: s48 (2b),
    win.coop, s37 (part 3), win.h2h (part 4), who.teams, who.handicap, s19 (part 5).
  - **Tests:** `tests/pool-knockouts.test.js` (new, 6): the shape, defaults, words and settings both ways, and what's refused; a
    pick that never repeats (a void second unused, a counted one used, a repeat not stored, nobody left a miss or a skipped night,
    a forgotten pick still a miss, picks before the game's start unused); one left ending it (over, nobody picks after, nothing
    after it counts, the span unchanged, a corrected result putting it back on) and a pool playing on by default; everyone out
    the same night by points, shared (the table's T1s) and all back in (lives and streak restored, again the next time, a lone
    survivor never spared), and not everyone; the field (someone catching up, a ghost); a draft that cuts playing on with one left.
    `game-spec.test.js`'s fields, `pool-parts.test.js`'s parts. `npm test` 1082.
  - **API check:** `scripts/dev-test/check-pool-knockouts.js` (new, on new-fixture.js's couch), 19 PASS: the couch's Survival Pool
    made w047's game through `setGame` with the show's ctx (its fields); Episodes 1 to 5 as each played (sam's pick home in 2, out);
    the Games tab as jordan reads it (three tied first, sam last); through the pick route, jordan's repeat of her Episode 2 pick
    not stored (eligibility: used in 2), sam's pick refused; Episode 6 through the season sync, two home, riley out; Episode 7,
    alex's repeat refused, both picks home: everyone left out together, sharing the win, none left, over at 7 (the Games tab: T1,
    T1, riley, sam, over), nobody picks for 8; the desk's decision for 7 corrected (re-decided): jordan alone the last one
    standing, alex second, still over at 7, the Games tab agreeing. `check-pool-parts.js`, `check-knockouts.js` and
    `check-engine-lab.js --api` ALL PASS. `npx tsc --noEmit -p .` clean.
  - **Code review** (`/code-review` at high, before the long runs; ten findings). Taken: under allOut 'back' a lone survivor was
    spared every time (an everyone-out night now needs two or more); never's eligibility counted picks before a player's own
    season, which history doesn't (a 'skip' night could have read as a miss); a spared night kept its lost life and broken streak
    on the row (now taken back: lives, mulligans, streak); the sentence read the spec's raw `oneLeft` where the rules read the
    engine's; the default `allOut` had a redundant line in every pool with lives ranked standing (dropped: "Ties go to the most
    points" says it); the eligibility types ('used', `ended`, game-view.ts `PickMove`); the table walking the pool once a row (now
    `histories`, once). Not taken (Noticed): the pick screens reading only `blocked` and a skipped row's `correct: null` (U1's);
    a pool's end on early results (as its picks are graded); no memo.
  - **Golden replays** (`golden.js`, HEAD against the working tree, after the code review's fixes): 7 seasons, 160 games, **19,361
    reads, every one the same** (no game they play repeats never or ends a pool).
  - **Blind replays** (`blind.js run`, the five seasons, on the final code): **every game ended on all five seasons**, w047 among
    them (The Challenge 41, 40 and 39 73 of 73, Survivor 49 93 of 93, The Traitors 4 71 of 71), no move refused. w047 was over at
    1 (The Challenge 41: the premiere sent the tinkerer's pick home), 7, 5, 2 and 10, one left each time; the forgetter and the
    fan, who don't pick every week, went out after Episode 1 on every season (one life: A10 part 2's item 2 seen live). No night
    sent everyone left out together and nobody ran out of people to pick: the unit tests and the API check prove those. The study
    doc's "A11 part 2: a pool's knockouts, replayed blind".

  **As built (A11 part 2b, 2026-10-30, on `engine`, not merged; no migration).** One session, after `lane.js sync engine` (master's
  edits to the words corpus carried into the tracker's fixture, where A5 moved it; 1085 tests). A game of questions' race and
  knockouts (s48, "Guess every elimination winner; a wrong guess knocks you out"). Every default and everything a person sees is the
  user's (Noticed, below).
  - **The spec** (`schema.js`): `score.lives` beside `score.by 'answers'` (1 to `MAX_LIVES`) on a game of questions (never Weekly
    Calls'): a wrong answer, or none, to a question it rides on costs one once that question is settled, and at none you're out;
    `score.livesOn`, the questions it rides on (each asked each episode, about that episode alone: `livesQuestion`), else every
    one asked so. `rank.race` and `rank.cut` as a draft's, on the answers' points. Last one standing (`rank.by 'standing'`) whenever
    it knocks players out (`fullSpec` fills it for lives as for cuts); `rank.oneLeft` (with lives or cuts) and `rank.allOut` (with
    lives) as a pool's, their defaults `ANSWERS_END` (ends; points), read by `answerParts` and never filled in. Refused: lives on
    Weekly Calls, lives ranked by the total, lives with nothing asked each episode about it alone, `livesOn` naming a question that
    isn't (asked once, every N, over N), an unknown one or one twice, `livesOn` without lives, `allOut` with cuts only. `playsAs`: a
    game of questions ranked standing when it knocks players out. `flagsOf`: `hasRace` and `hasCuts` for it too, `hasAnswerLives`.
    KEYS, the types. Settings both ways: `questionsLives`, `questionsLivesOn`, `questionsRace`, `questionsCut`, with `rankOneLeft`
    and `rankAllOut` (`OWNED`); last one standing isn't stored (it's the only way such a game ranks: the code review).
  - **Words** (`describe.js`): the sentence ("One life: a wrong answer, or none, costs one. Last one standing wins.", the questions
    named when `livesOn` picks some, a race, cuts, and an end that isn't the default); How it works (lives, a night that doesn't
    count costing nobody, answering and scoring nothing more once out, last one standing and one or none left ending it, `allOut`, a
    race, waiting for the answers to settle; "Most points wins." only without them).
  - **The engine** (`state-logic.js` `AnswerLogic.walk`, pure, over answers and facts as `grade` takes them): episode by episode, the
    game's with results; each one's points through it from the windows settled by then (`answers.js` `factsThrough`: the facts as they
    stood once that episode was in, the season's end only when it came by then: `facts.endedAt`); then a race, lives (each question it
    rides on, settled there: each wrong or missing answer costs one; off, or a void pick, costs nothing; everyone left out the same
    night: `allOut`), cuts (`KnockoutLogic.cutAfter`, now shared with a draft's walk: the code review), one left. Plain data back:
    `{ ends, out, lives, shared, totals }`, the totals as the table shows them (frozen at each one's last episode in; at an early end,
    graded through it with the game over). The server hands it to the engine on a shallow copy (`withWalk`: `answerWalk`, never on the
    state itself, never stored), and `KnockoutLogic.endsAt` and `outs` read it (`walkOf`), so `lastEpisode`, `gameOver`, `spanView`,
    `endedBefore` and `isOut` do; `ScoringLogic.compute` puts its `out`, totals, lives and `shared` on the rows (`applyWalk`), and
    `rankKey` ranks a game of questions standing by `standingKey`. A copy that hides anything (`viewThrough`, `viewFor`) drops the
    walk, and `spanView` keeps it on the copy it cuts at the game's end. `liveRows`: someone out keeps only their answers to windows
    settled by their last episode in (none about the whole game, none to a window still open then), so they take no share of a pot
    settled after them (the code review).
  - **Why the server walks and hands it over** (the seed left the way open): the walk needs the answers (`game_answers`) and the
    format's groups (F3's timeline, `formatGroupsFor`), neither in the state, and it has to be worked out on each viewer's own
    spoiler-trimmed copy. So the walk is a pure function the server calls with what it reads anyway, and its result is small plain
    data on a copy, which every engine reader picks up without learning about answers; any copy that hides something drops it, so a
    walk never outlives the data it was worked from, and a state without one plays as its span says (nobody out), the safe fallback
    for a reader not taught yet. Not taken: putting the answers on the state for the engine to walk when asked (the timeline's groups
    are Maps that the spoiler guard's JSON copies lose, and the answers would ride along into a league's writes).
  - **The server:** `answer-points.ts` `walked` (the viewer's copy walked: its view cut at the end, its facts, the answers that
    count, the walk; a copy already carrying the walk of exactly what they see keeps it) and `asItStands` (the league walked over
    every answer and result: for the refusals and which results are the game's to reveal); `leagueAnswers` and `answerStanding` hand
    over the walk with the points (frozen), the hub's `through` stops at the game's end, `sheetNights` reads the answers that count;
    `viewOf` is gone (the code review). `season-games.ts` `gamesHere` walks the league as it stands for every reader of a season's
    games (`GameHere.answers`, reused by the Games tab, the sheet, the episodes' nights and the reveal). `game-view.ts` `gameView`
    puts the viewer's walk (`GameCalls.walk`) on its copy, and `tableOf` ranks a walked game as the engine does; `couch-hub.ts`
    `standingOf` the same. `answers.ts`: its reads walk the game (your points the walk's); `GameQuestions.out` (your last episode in,
    as far as you've seen) and `.ended`; this week's is none once it ended as far as you've seen, and a past episode after the end is
    refused (400); `answerQuestions`, as the league stands, refuses an answer past someone's last episode in, or about the whole game
    once they're out ("You’re out of this game", 409), and past where the game ended ("This game ended with Episode N"), while an
    episode up to then stays answerable while it's open for you (a late lock: the code review); the sheet asks nothing of someone out.
    The same refusals now hold for a draft that cuts (part 1): a cut player's finale predictions are refused and their sheet is gone,
    as part 1's "no more moves" has it (their total is frozen, so the predictions could never count).
  - **The fallbacks:** a night that doesn't count (nobody went home, nothing happened: off) costs nobody a life, answered or not, and
    a void pick (F3's group fallback) neither; a verdict still to settle stops the walk at the newest episode with results, as does
    early results there for a race or a cut (points still to come); one still to settle once a later episode has results costs
    nothing (The Challenge 39's Episode 3); lives on who goes home count on early results, as a pool's picks do; a tie (a race's: the
    most points then, sharing it; a cut's: part 1's); everyone left out the same night (`allOut`); one left (`oneLeft`); a corrected
    result works it all out again; late joiners: a ghost outside, someone catching up in (never losing a life or cut, holding the end
    off), a late start from their start.
  - **The tracker:** s48 ✅ (The Challenge 42: Who wins the elimination? each episode, by `eliminationWin`, one life, last one
    standing). **Now: 172 ✅** · 73 ⏳ · 1 🆕 · 2 ❓ · 23 💬, of 271; A11's six left: win.coop, s37 (part 3), win.h2h (part 4),
    who.teams, who.handicap, s19 (part 5).
  - **Tests:** `tests/answer-knockouts.test.js` (new, 8): the shape, defaults, words and settings both ways, and what's refused
    (s48 on The Challenge's rules); one life (a wrong or missing answer out, the last one standing ending it, frozen points, the
    table's order, `lastEpisode`, `gameOver`, `spanView` keeping the walk) and two; each fallback (a quiet night, an answer still to
    settle, an earlier episode left early, a corrected result, a void pick); each wrong answer its own life; everyone out the same
    night by points, shared or all back, and a lone survivor never spared; one left playing on; the field (a ghost, someone catching
    up, a late start); a race and a guillotine on the answers' points; someone out's later answers and their answer about the whole
    game counting for nobody, a copy that hides anything dropping the walk, a viewer behind not knocked out; the Games tab's table
    from the walk it's handed, and s48 on a Challenge league. `game-spec.test.js`'s fields, `pool-knockouts.test.js`'s message.
    `npm test` 1093.
  - **API check:** `scripts/dev-test/check-answer-knockouts.js` (new, on new-fixture.js's couch), 23 PASS: jordan's Survival Pool made
    a game of questions through `setGame` with the show's ctx (Who goes home? each episode, one life); Episode 6 answered through the
    answers route, its result through the season sync (early results: all a who-goes-home question needs), riley and sam out; the
    Games tab as jordan reads it (alex and jordan tied first, riley and sam tied after) and as sam does (seen 5: nobody out, all
    level); riley's questions read saying she's out, her sheet asking nothing, alex's asking Episode 7's; riley's and sam's answers for
    7 refused; an answer of riley's for 7 written as if made before her result counting for nobody; Episode 7, jordan the last one
    standing, over at 7, her questions read saying it ended, an answer for 8 refused; the hub (first, over, the plaque hers); Episode
    7's result corrected (re-decided), alex the last one standing; the sheet's nights. `check-questions.js`, `-who`, `-time`,
    `-scoring`, `-more` (`--api`), `check-knockouts.js`, `check-pool-knockouts.js` and `check-engine-lab.js --api` ALL PASS. `npx tsc
    --noEmit -p .` clean.
  - **Code review** (`/code-review` at high, before the long runs; ten findings). Taken: with a late lock, someone who watches late
    was refused an answer to an episode still open for them, because the league as it stands counted it missing (the refusals now
    cover only what's after their last episode in, or about the whole game); someone out still took a share of a pot settled after
    them through their answer about the whole game, or to a window still open (`liveRows` by when each window settles); the cuts
    copied from a draft's walk (`KnockoutLogic.cutAfter`, shared); `questionsRank` stored though it's implied; a dead check in the
    walk; `viewOf` left with no caller; the episodes' sheet reading the answers again. Not taken (Noticed): the refusals naming what
    someone hasn't seen (part 1's), lives taken on early results (a pool's), the walk unmemoised, and the refusals for a draft's cut
    player (kept: part 1's rule).
  - **The harness** (`blind.js`, which answers every open question by habit): nothing is answered for a seat that's out or after a
    game ended early, as the app offers nothing then (`asItStands`, as playtest.js's moves skip them); each episode's record says
    who's out and the lives left.
  - **Golden replays** (`golden.js`, HEAD against the working tree, after the code review's fixes): 7 seasons, 160 games, **19,361
    reads, every one the same** (no game they play knocks players out of a game of questions; a draft's cuts, now through the shared
    `cutAfter`, read the same).
  - **Blind replays** (`blind.js run`, the five seasons, on the final code): **every game ended on all five seasons**, s48 among
    them on The Challenge's three (41, 40 and 39 74 of 74, Survivor 49 93 of 93, The Traitors 4 71 of 71: s48 plays only where the
    rules have who won an elimination), no answer refused. s48 was over at 1 on 41 and 39 (the tinkerer and the drive-by guessed
    wrong at the premiere and the forgetter and the fan answered nothing: everyone left out the same night, all tied on 0, sharing
    first by default) and at 2 on 40 (its premiere had no elimination winner, so nobody lost a life; in 2 only the drive-by was right).
    So one life among four seats ends it at once: item 5's `allOut` 'back' would have kept it going. The study doc's "A11 part 2b:
    a game of questions' knockouts, replayed blind".

  **As built (A11 part 3, 2026-10-30, on `engine`, not merged; no migration).** One session, after `lane.js sync engine` (master's
  lane-watch.js; 1093 tests). Co-op against the show (win.coop, s37 "Co-op: together we have 5 lives; every faithful banished we
  didn't see coming costs one"). Every default and everything a person sees is the user's (Noticed, below).
  - **The spec** (`schema.js`): `rank.by 'coop'`, a game of questions the couch plays together against the show, on its lives
    (`score.lives`, part 2b's, 1 to `MAX_LIVES`, riding on `score.livesOn` or every question asked each episode about it alone): the
    couch's together, not each player's. `score.saves`, who saves a night: `one` (one right answer among you), `most` (more than half
    of those who answered), `all` (all of them); its default `COOP` (one), read by `answerParts` and never filled in. `answerParts`
    gives `coop: { saves }` (else null) and no `oneLeft` or `allOut` for it (nobody is knocked out). Refused: co-op without lives,
    co-op on anything but a game of questions (a pool's or a draft's isn't built), `saves` without co-op or with another value, a
    race, a cut, `oneLeft` or `allOut` beside it (`coopProblems`, with `knockoutProblems` and `endProblems`). `playsAs`: a game of
    questions ranked co-op with lives. `flagsOf`: `hasCoop` (and `answerParts` read once there: the code review). KEYS, the types.
    Settings both ways: `questionsRank` 'coop' (said, as last one standing isn't: lives alone imply that) and `questionsSaves`; a
    co-op rank keeps whatever else its settings say (a race, cuts, an end), so our check refuses it rather than it being lost (the
    code review).
  - **Words** (`describe.js`): the sentence ("Together you have five lives: each time none of you gets it right, you lose one. Keep
    one to the end and you all win."; `most`: "half or more of you get it wrong"; `all`: "any of you gets it wrong"; the questions
    named when `livesOn` picks some); How it works (five lives for all of you, not each; a question costing one once settled unless
    enough of you got it right; not answering doesn't count against you, but a night nobody answers costs one; a night that doesn't
    count costing nothing; right answers still earning their points; nobody knocked out, lost by all at the last life, won by all at
    the end with one left; a life waiting for the answers to settle).
  - **The engine** (`state-logic.js` `AnswerLogic.walk`, part 2b's walk, a branch of it): each question a life rides on, settled at
    an episode, costs the couch one unless enough of it saw it coming. Of those who answered (in it from their start and caught up: a
    ghost never, a late joiner from their start, someone catching up only once caught up, as answers.ts refuses their answers till
    then: the code review), a void answer counts as none, a night every answer was void costs nothing (as a void pick does: the code
    review), silence neither helps nor hurts, and a night nobody answered costs one (nobody saw it coming). Off (nobody went home,
    only a murder, a Traitor banished, nothing settles it) costs nothing. At none left it ends there (`ends`), lost by all; at its end
    (the span's last episode, or the season's, walked with nothing still to settle, having played an episode: the code review) with
    one left, won by all. The walk gives `coop: { lives, of, lost: [{ episode, question }], result: won | lost | null }`, nobody in
    `out`, everyone in `shared` with the couch's lives (`lives`), the totals as part 2b's. `rankKey`: one shared place for everyone
    (`[0]`), `applyWalk` listing them by their points within it (who called the most: the code review). Everything part 2b taught
    reads it unchanged: `lastEpisode`, `gameOver`, `spanView`, `endedBefore`, a copy that hides anything dropping it.
  - **s37 on The Traitors:** "Which Faithful will be banished?" each episode, settled by the format's own implied moment
    `banishedAsFaithful` (an exit Banished by someone whose role, as of the episode, isn't a Traitor: traitors.js impliedRules), so a
    Traitor banished, a murder, a recruit banished (a Traitor by then) and a night nobody goes are off, costing nothing, and only a
    Faithful banished whom none of you named costs one. The role verdicts answers.js has weren't needed: the moment is the role
    verdict, on the data every Traitors game already scores. win.coop on Survivor: Who goes home? each episode, three lives.
  - **The server:** every reader of a game of questions already goes through part 2b's walk (`answer-points.ts` `walked` and
    `asItStands`, `season-games.ts` `gamesHere`), so a co-op game is walked everywhere; what's new is carrying its result.
    `game-view.ts` `GameView.coop` (the viewer's walk's lives and result) and the table's one shared place; `answers.ts`
    `GameQuestions.coop`, and the refusals part 2b built ("This game ended with Episode N" past a lost game's end, nothing asked then;
    nobody is ever "out"); `couch-hub.ts` `standingOf` and `PlayingGame.coop`; `couch-standings.ts` `GameStanding.coop`: power
    rankings, head to head, titles, finishes and your numbers' places leave a co-op game out (everyone shares one place in it, so it
    isn't a finish against each other: `versus`), the seasons you played keep it; the trophy shelf keeps it as a plaque whose winners
    are everyone when it was won and nobody when it was lost (`Plaque.coop`), never a title, never the earlier win a "Ran it back"
    counts (the code review).
  - **The fallbacks:** a night nobody goes home, only a murder or a Traitor banished: off, nothing lost; a role research hasn't said:
    the format's default, Faithful, as every Traitors moment reads it (Noticed); results still early: the walk waits at the newest
    episode (the moment needs the full results); an earlier one left early once a later one is in: never settles, costs nothing; a
    corrected result: worked out again (a lost game back on: `check-coop.js`); someone who never answers: silence doesn't count
    against the couch, a night nobody answers does; late joiners: from their start, a ghost outside, someone catching up once caught
    up; the format changing (The Traitors' recruit): the role as of the episode, so a recruit banished is a Traitor; a role the format
    doesn't know reads as not a Traitor (Noticed).
  - **The tracker:** win.coop ✅ (Survivor 51, three lives), s37 ✅ (The Traitors (US) 5, five lives on `banishedAsFaithful`). **Now: 174
    ✅** · 71 ⏳ · 1 🆕 · 2 ❓ · 23 💬, of 271; A11's four left: win.h2h (part 4), who.teams, who.handicap, s19 (part 5).
  - **Tests:** `tests/coop.test.js` (new, 6): the shape, defaults, words and settings both ways, what's refused (s37 on The Traitors'
    rules, win.coop on Survivor's); s37's nights (a Faithful named saves it; a Traitor banished, a murder, a quiet night cost nothing;
    one nobody named, one nobody answered; lost by all, `lastEpisode`, `gameOver`, `endedBefore`, nobody out, one shared place listed
    by points); who saves a night (one, most, all, silence); each fallback (early results, an earlier one left early, a corrected
    result, a recruit, late joiners, a ghost, someone catching up, a night every answer was void); won at the span's end and at the
    season's, a viewer behind, a game that never played; the Games tab's table and view, the couch's standings, trophies (no Ran it
    back after a co-op win) and your numbers. `answer-knockouts.test.js`'s parts, `game-spec.test.js`'s fields. `npm test` 1099.
  - **API check:** `scripts/dev-test/check-coop.js` (new, on new-fixture.js's couch), 22 PASS: jordan's Survival Pool made a co-op game
    of questions through `setGame` with the show's ctx (Who goes home? each episode, two lives); Episode 6 answered through the answers
    route (alex right, riley and jordan wrong, sam silent), its result through the season sync: both lives stand; the Games tab as
    jordan reads it (one shared place, alex's point, `coop`) and as sam does (seen 5: nothing graded); Episode 7, nobody right: one
    life gone, the questions read says so; Episode 8, nobody right: lost by all, over, the questions read ended with 8, an answer for 9
    refused, the sheet empty; the hub (the plaque with no winners, its result lost, the power rankings without it); Episode 8's result
    corrected (re-decided) to the one alex and jordan named: one life left, the game back on. `check-answer-knockouts.js`,
    `check-questions.js`, `-who`, `-time`, `-scoring`, `-more` (`--api`), `check-knockouts.js`, `check-pool-knockouts.js` and
    `check-engine-lab.js --api` ALL PASS. `npx tsc --noEmit -p .` clean.
  - **Code review** (`/code-review` at high, before the long runs; ten findings). Taken: a versus game after a co-op one the couch won
    handed "Ran it back" to its winner (everyone "won" the co-op one); someone catching up counted on the couch's nights (no answer of
    theirs can be made then, but a stored one could flip a night after the fact: caught up first, as the rest of the walk has it); a
    night every answer was void cost a life; a game that never played an episode read as won; the rows not listed by their points;
    the `most` sentence disagreeing with the engine (half right costs a life); a co-op rank from settings dropping a race or cuts
    silently; `answerParts` read four times in `flagsOf`; the seasons rule written twice. Not taken (Noticed): a plaque for a co-op
    game that ended undecided (archived while it played, or its last night still to settle) has no winners and says `result: null`;
    the shared place "T1" on a lost game's plaque and in the hub's games list (both now carry `coop`, for U1 to say it).
  - **The harness** (`blind.js`): each episode's record of a co-op game says the couch's lives, the nights lost and the result
    (`.coop`), instead of each seat's lives.
  - **Golden replays** (`golden.js`, HEAD against the working tree, after the code review's fixes): 7 seasons, 160 games, **19,361
    reads, every one the same** (no game they play is co-op).
  - **Blind replays** (`blind.js run`, the five seasons, on the final code): **every game ended on all five seasons**, win.coop on all
    five and s37 on The Traitors 4 among them (Survivor 49 94 of 94, The Challenge 41, 40 and 39 75 of 75, The Traitors 4 73 of 73), no
    answer refused, no problem in the moves. win.coop was lost by all at 4 on Survivor 49 and The Traitors 4, at 3 on The Challenge 41
    and 39, at 9 on 40 (pairs going home together, so naming either saved a night); s37 at 10 of The Traitors 4's 12 (its premiere, 7
    and 8 off: no Faithful banished; 2 and 5 saved). Four seats rarely call a boot, so three shared lives go fast: items 1 and 6 are
    the user's. The study doc's "A11 part 3: co-op against the show, replayed blind".

  **As built (A11 part 4, 2026-10-30, on `engine`, not merged; no migration).** One session, after `lane.js sync engine` (master's
  lane-watch.js; 1099 tests). Head to head, with playoffs (win.h2h), a draft's. **Split** (above): a game of questions' head to head
  is part 4b. Every default and everything a person sees is the user's (Noticed, below).
  - **The spec** (`schema.js`): `rank.by 'matchups'` now plays on a show (VOCAB `now`; categories and roto stay the sports
    branch's), a draft's: Outlast, a lineup, best ball (a stock market's too). `rank.playoffs` `{ teams, from? }` (2 to
    `MAX_PLAYOFF_TEAMS`, 8, or null for none): the top `teams` seeded by the standings, a bracket of `playoffRounds(teams)` rounds
    (2: 1, 3 or 4: 2, 5 to 8: 3), one an episode, over the game's last episodes, or from `from`. `rank.odd` median | bye and
    `rank.quiet` skip | tie, their defaults `MATCHUPS` (median, skip), read by `matchupParts` and never filled in. A rank that says only
    head to head's keys (`MATCHUP_KEYS`) is head to head (`fullSpec`). Refused (`matchupProblems`): head to head on a pool ("a pool's
    picks don't score an episode's points against someone") or a game of questions (part 4b's); playoffs, `odd` or `quiet` without
    it; teams out of range; `from` at or before the game's first episode, or not ending at a span's end when it has one (the game
    ends with its final); a span too short for its rounds after one episode of matchups (a league's own keeps what it plays); a race,
    cuts, `oneLeft` or `allOut` beside it (their own checks: they rank by the total or last one standing); with ctx, more playoff teams
    than the couch has (`teamsOf`: teams, not people; fewer is fine, the top seeds get byes). `playsAs`: a draft ranked by matchups
    with no race or cuts. `flagsOf`: `hasMatchups`. KEYS, the types. Settings both ways: `draftRank` 'matchups' and `rankMatchups`
    (what it says of playoffs, odd and quiet).
  - **Words** (`describe.js`): the sentence ("Each episode you play one of the others head to head: more points wins it. The top four
    by wins make the playoffs, over the last two episodes." / "from Episode 12" / "Most wins at the end wins."); How it works (everyone
    in turn, a tie half a win, the odd one out against the middle score or sitting it out, a night nobody scores, the standings, the
    playoffs with their byes and a tie to the better seed, the final ending it, the season ending first, waiting for full results).
    A draft played head to head is still its preset's game by name.
  - **The engine** (`state-logic.js` `MatchupLogic`), worked out from the data on every read, as the knockouts are, so a corrected
    result works it all out again and a viewer's copy plays only what they've seen. Each episode's points are each team's growth in
    part 1's series (`KnockoutLogic.series`: a lineup's or best ball's points that episode, Outlast's boots outlasted, side bets and
    finale predictions as they settle, each team as it stood then). `round` (the circle method over the seats in the order they
    joined, a round an episode from the game's first: the same on every read), `seatsAt`, `median`, `bracket` (1 v 8, 4 v 5, 2 v 7,
    3 v 6: the top two meet only in the final), `walk`/`run` (each regular-season week's games and results, the records `{ wins,
    losses, ties, for, against }`, the seeds once every episode before the playoffs has been played, the rounds up to the first still
    to play, who's still in, the champion, each seat's tier), `apply` (each row's `matchups`: the record, seed, tier, alive, champion),
    `view` (a seat's record, their next matchup and the latest they played, the playoffs' seeds, bracket and champion), `endsAt` (the
    final's episode: `KnockoutLogic.endsAt`, so `lastEpisode`, `gameOver`, `spanView` and `endedBefore` read it), `moveProblem` (no
    move after the final: `KnockoutLogic.moveProblem`'s), `settle` (below). `rankKey`: how far you went in the playoffs (tier: 0 out of
    them or before them, 1 in them, one more a round won, the champion one past the last), then wins (a tie half), then the regular
    season's points, then the seed (the one tie seeding broke by who joined first).
  - **Where the playoffs go:** the game's last `rounds` episodes, its last being its span's end, else the season's as its schedule says
    (`state.seasonEpisodes`, `show_seasons.episode_count`, stamped by the server only for such a game: `air-times.ts`
    `stampSeasonLength`, on every read and write, and again after a write's mutation so one that turns head to head on saves it),
    the earlier when both are known; or `from`. They begin only after at least one episode of matchups. Where nothing says the end
    (no span's end, no count), there are none until something does. Once their first round has results, where they began is kept
    (`state.playoffsFrom`, `MatchupLogic.settlePlayoffs` on every write, db.ts): a count that changes after that moves nothing; taken
    back with those results, or when the game no longer places them itself.
  - **Who plays:** a seat from when it joined the schedule (`state.matchupSeats`, `settleSeats` on every write: the first time
    everyone there from their own start, so a game made head to head mid-season counts its past; after that a seat new to it, brought
    in mid-season or a late joiner once caught up, from the first episode still to play, so the weeks played never change; a state
    never written, from its own start, not while catching up). A disabled seat stays (its team plays on, its points counting, as
    `disablePlayer` has it). A ghost plays nobody, and their own row on their copy has no record (`matchups` null). A seat still to be
    brought in isn't in it.
  - **The fallbacks:** an odd number of seats (whoever the round robin leaves out plays the median of everyone else's points, or sits
    it out: a bye's points still count toward the standings' points); a tie (half a win; in the playoffs, the better seed); a night
    nobody in it scores (an Outlast's night nobody goes home: counts for nobody, or ties everyone; in the playoffs the better seed);
    results still early (the series stops at the newest episode while early, so its matchups and the seeds wait); a corrected result;
    a bracket short of seeds (byes for the top seeds; two seats in a bracket of four meet in the final); a season longer than its
    schedule said (the game ends with its final, nothing after it counting); one that ends first (the season over with rounds to play:
    the best seed still in; before the playoffs: seed 1), and nothing after the season's finale plays (a schedule that counts a
    reunion: the blind replays found it); one seat alone (nobody to play); a game over a span (its end places them).
  - **The server:** the Games tab (`game-view.ts`): `TableRow.record` (wins, losses, ties, points for and against, seed, alive,
    champion; null for any other game) and `GameView.matchups` (`MatchupLogic.view` on your copy; null with no seat); the table ranks as
    the engine does (the champion first, whatever the points). The hub (`couch-hub.ts`): `standingOf`'s `through` stops at
    `lastEpisode` (a final played, a race won, one left), and `GameStanding.matchups`, so the plaque (the champion's: first in the
    table) gives no margin in points (`couch-standings.ts`). Power rankings, head to head and finishes count it by its places, as any
    game against each other.
  - **The tracker:** win.h2h ✅ (a Weekly Lineup on Survivor 51, the top four in the playoffs over the last two episodes). **Now: 175
    ✅** · 70 ⏳ · 1 🆕 · 2 ❓ · 23 💬, of 271; A11's three left: who.teams, who.handicap, s19 (part 5).
  - **Tests:** `tests/matchups.test.js` (new, 10): the shape, defaults, words and settings both ways, and what's refused; the round
    robin (every pair once a cycle, an odd list, one alone), the bracket and the median; matchups, ties and the standings, the table
    and the view; the median and a bye, a night nobody scores skipped or tied, a 0-0 tie; early results, a corrected result, a viewer
    behind; the playoffs (seeded, a tie to the better seed, the champion first, over at the final, the couch's plaque); byes, the season's
    length placing them, kept once begun, a longer season ending at the final, moves refused after it, taken back with its results, a
    span's end with a shorter count, too short for any; the season over first (the best seed still in), nothing placing them, Outlast
    head to head; who plays (a late joiner, a ghost, a disabled seat, one to be brought in); seat starts kept (a seat brought in later
    from the next episode, the weeks played unchanged, a late joiner once caught up, a ghost never, dropped when not head to head, a
    ghost's own row). `game-spec.test.js`'s fields and specWaitsFor. `npm test` 1109.
  - **API check:** `scripts/dev-test/check-h2h.js` (new, on new-fixture.js's couch), 16 PASS: Lineup League made head to head through
    `setGame` with the show's ctx (the top four); the Games tab as jordan reads it (jordan and alex on a win and four ties, riley and
    sam level, T3), its playoffs at the season's end from its 13 episodes (12 and 13: the season length stamped on the read), jordan's
    next matchup; as sam reads it (seen 3), the records through 3; made to end with Episode 7 (the playoffs 6 and 7, seeded); Episode 6
    through the season sync (the semifinals: sam's upset on an immunity, alex through a 0-0 tie on the better seed; where the
    playoffs began kept on that write); Episode 7, the final (sam the champion, first, over; no Episode 8 past the game's end, and the
    engine refusing a move for it); the hub's plaque sam's with no margin; Episode 7 corrected (re-decided) to alex's starter: alex the
    champion. `check-knockouts.js`, `check-coop.js`, `check-answer-knockouts.js`, `check-pool-knockouts.js` and `check-engine-lab.js
    --api` ALL PASS. `npx tsc --noEmit -p .` clean.
  - **Cost:** a read of a head-to-head game walks part 1's series about twice (the table, then the view): 3.4 ms against 0.8 ms for the
    same game ranked by its total (10 players, 13 episodes, a scratch benchmark); nothing is memoised (Noticed).
  - **Code review** (`/code-review` at high, before the long runs; ten findings). Taken: a seat brought in mid-season (no late join of
    its own) re-paired every week already played, and a late joiner still catching up was counted from their chosen past start and
    lost every week until they caught up (now `state.matchupSeats`, kept on every write); the hub's `through` past a game's early end
    (now `lastEpisode`); a write that turns head to head on saved no season length (stamped again after the mutation, its own
    `stampSeasonLength`); two seats level on everything shown tied while seeding put one ahead (the seed now breaks it among the
    playoffs' seats); a ghost's own row ranked last on a zero record (now none); a double delete in the stamp; head to head's keys
    listed in four places (`MATCHUP_KEYS`). Not taken (Noticed): a memo for the walk, and one early-end dispatcher in place of
    `KnockoutLogic.endsAt` and `moveProblem` branching to each kind. After the long runs, the blind replays' finding (a final played on the reunion after the
    season's end) was fixed, the unit tests, the golden and the blind replays and `check-h2h.js` (ALL PASS) run again on
    it.
  - **The harness** (`blind.js`): each episode's record of a head-to-head game says the records (wins-losses-ties), where the
    playoffs are, the seeds once known, the rounds played and the champion (`.matchups`), as the app reads the league.
  - **Golden replays** (`golden.js`, HEAD against the working tree, on the final code): 7 seasons, 160 games, **19,361 reads, every
    one the same** (no game they play is head to head), after the code review's fixes and again after the reunion fix.
  - **Blind replays** (`blind.js run`, the five seasons, on the final code): **every game ended on all five seasons**, win.h2h among
    them (Survivor 49 95 of 95, The Challenge 41, 40 and 39 76 of 76, The Traitors 4 74 of 74), no problem in the moves. Survivor 49:
    seeded after 11 (the tinkerer 10-1 first), the semifinals at 12, the final at 13, the fan the champion from the second seed with
    69 points to the tinkerer's 106 (head to head, not the most points). The Traitors 4: the semifinals at 11, its finale; 12 (an
    episode after the finale its count includes) didn't play: the tinkerer, the best seed still in, the champion. The Challenge 41, 40 and 39: their
    schedules count 21 episodes but the final is 18 and 19, so the playoffs sat on 20 and 21, after the season's end; the season
    over first, the regular season's leader won (the drive-by, the fan, the tinkerer), the playoffs never played. The first run, on the
    code before it, played those rounds on the reunion's results after the game read over at 19 (all ties, so the same champions):
    nothing after the finale plays now (a unit test), and Noticed item 12 is the user's. The study doc's "A11 part 4: head to head,
    replayed blind".

  **As built (A11 part 4b, 2026-10-30, on `engine`, not merged; no migration).** One session, after `lane.js sync engine` (already
  up to date; 1109 tests). Head to head on a game of questions (part 4's matchups, its episodes' points from the answers). Every
  default and everything a person sees is the user's (Noticed, below).
  - **The spec** (`schema.js`): `matchupParts` now reads a game of questions ranked `matchups` as well as a draft (`questionsGame`,
    now exported); `answerParts` carries it (`matchups`: matchupParts' or null) and is non-null for it, so everything that walks a
    game of questions (the server's `walked` and `asItStands`, `walkOf`) walks a head-to-head one. `playsAs`: a game of questions
    ranked by matchups with nobody racing, cut or losing a life (`questions`). `matchupProblems` no longer refuses it; it refuses a
    pool's ("a pool's picks don't score an episode's points against someone") and Weekly Calls' ("counted outside the game"). Beside
    it on a game of questions, lives (the lives' rank: last one standing or co-op), cuts (last one standing), a race (won on points),
    `oneLeft`, `allOut` and co-op's `saves` are refused by their own checks, as a draft's are. `flagsOf` `hasMatchups` for it. Settings
    both ways: `questionsRank` 'matchups' (said, as co-op is) and `rankMatchups` (the draft's field, `matchupsOf` shared); settings that
    say head to head and lives keep both, so our check refuses them rather than one being lost.
  - **Words** (`describe.js`): the sentence as a draft's ("Each episode you play one of the others head to head: more points wins it.
    The top two by wins make the playoffs, over the last episode."); How it works is part 4's `matchupRules` (in place of "Most points
    wins."), plus what an episode's points are ("Your points in an episode are what your answers settled by then earn", with, only
    when the game asks one, "one about more than one episode counts in the episode it's settled in" and "one about the whole game
    counts in the episode it's settled in, at the end") and what its matchups wait for ("its full results, and for its questions to be
    settled").
  - **The engine** (`state-logic.js`): `AnswerLogic.walk` (part 2b's), for head to head, hands over its series: each episode walked,
    with everyone's points through it as plain data (`answerWalk.series: [{ number, totals }]`, never stored, on the copy the server
    walked), so an episode's points are what the answers settled by then add (its own questions; a run or a phase in the episode its
    window ends; one about the whole game at the game's end). The newest episode waits while its results are early or a question asked
    about it alone is still to settle (research unsure: a pair with no report); an earlier one, once a later one is in, counts as it
    stands. Nothing after the game's final (`MatchupLogic.endsAt`), or the season's finale once it's over if that came first, is
    walked, and the final's step is graded with the game over (its questions about the game settle there, as the table's totals,
    graded through it, have them: the code review). `MatchupLogic.series` is the one reader for both kinds: a draft's from
    `KnockoutLogic.series`, a game of questions' from the walk (none without it: nobody has played, the safe fallback a reader not
    taught yet gets). `ScoringLogic.compute` puts the walk's points on the rows (`AnswerLogic.walkRows`, `applyWalk` without its sort)
    and `MatchupLogic.apply` ranks them; `rankKey`, `lastEpisode`, `gameOver`, `spanView`, `view` read it as a draft's.
    `MatchupLogic.endedAt`: where it ended, once it has (its final played, or the season's finale when the season ended first; null
    while the final's results are early). Nothing after the season's finale plays now for a draft either: a regular-season week after
    it (a schedule that counts a reunion, with points) is skipped, as part 4 skipped its playoff rounds.
  - **The server:** every reader of a game of questions already goes through part 2b's walk (`answer-points.ts` `walked` and
    `asItStands`, `season-games.ts` `gamesHere`), so a head-to-head one is walked everywhere and part 4's readers read it: the Games
    tab's `TableRow.record` and `GameView.matchups` (`game-view.ts`, from the walked copy), the hub's standings and plaque
    (`couch-hub.ts` `standingOf`, `GameStanding.matchups`: no margin in points), the season's length stamped for its playoffs
    (`air-times.ts`), where the playoffs began and the seats kept on every write (`db.ts`). `answers.ts`: head to head's end is known
    from the start (its final's episode), so the refusals tell "This game ends with Episode N" (an answer past the final before it's
    played) from "This game ended with Episode N" (once it's played, or the season ended first: `endedAt`), and an answer about the
    whole game is refused only once it has ended (before, part 2b's refusal would have refused it from the start); `GameQuestions.ended`
    says where it ended.
  - **The fallbacks:** results still early (the matchups wait; the table's points as they stand); a verdict research is unsure of
    (waits at the newest, then counts as it stands); a corrected result (worked out again, a champion changed); a night nobody
    answers, or nobody gets right, or the question doesn't count (nobody went home): nobody scores, so it counts for nobody (`quiet`
    skip) or ties everyone (tie); a void pick (F3 part 2's group fallback) earns nothing either way, the rest decide the night; late
    joiners (from their start, someone catching up once caught up, a ghost never, kept on every write: part 4's `state.matchupSeats`);
    a final before the season's end (the game ends there, nothing after it counted); the season's count counting a reunion (nothing
    after the finale plays, a week nor a round; the best seed still in wins); a state without the walk (nobody has played).
  - **Not done (the user's):** the couch's head to head counted from the matchups themselves (part 4's item 9): left as it is (by
    places), since it changes what every couch's numbers say and item 9 is still open.
  - **The tracker:** no new row: the corpus has no request for a game of questions played head to head (win.h2h is a Weekly
    Lineup's); regenerated, unchanged: 175 ✅ · 70 ⏳ · 1 🆕 · 2 ❓ · 23 💬, of 271; A11's three left: who.teams, who.handicap, s19
    (part 5).
  - **Tests:** `tests/answer-matchups.test.js` (new, 6): the shape, defaults, words and settings both ways, what's refused (lives,
    cuts, a race, `oneLeft`, `saves`, settings saying head to head with lives, more playoff teams than the couch); the walk's series and
    the matchups over it, the records, the table and the view, a state without the walk; an episode's points (a two-episode window in
    the episode it ends, a question about the game at the finale); each fallback (early results, a corrected result, a quiet night
    skipped or tied, a question off, a void pick, a verdict still waiting then counting as it stands); who plays (a late joiner, someone
    catching up, a ghost, the seats kept); the playoffs (seeded, the final, the champion first, `endedAt` null while the final's
    results are early, the plaque), a final before the season's end (its question about the game settling at the final, nothing after
    it), a schedule that counts a reunion. `matchups.test.js`: a game of questions no longer refused, Weekly Calls' is, a draft's
    regular-season week after the finale skipped; `answer-knockouts.test.js` and `coop.test.js`'s parts (`matchups: null`);
    `game-spec.test.js`'s fields (`rankMatchups` for a game of questions). `npm test` 1115.
  - **API check:** `scripts/dev-test/check-answer-h2h.js` (new, on new-fixture.js's couch), 28 PASS: jordan's Survival Pool made a
    game of questions played head to head through `setGame` with the show's ctx (Who goes home? each episode, Who wins the most
    immunities? asked once, Episodes 6 to 8, the top two in the final at 8); answers about the whole game before 6 accepted, one for
    Episode 9 refused ("ends with Episode 8"); Episode 6 through the answers route and the season sync: who went home alone (early)
    leaves the matchups waiting, the table's points as they stand; a scoring moment makes them final (jordan beats sam, alex beats
    riley); as sam reads it (seen 5), nothing played; Episode 7 (a tie, an upset), seeded jordan and alex, the final next; Episode 8,
    the final: alex's call about the whole game settling there makes alex the champion 2-1, first; over; the questions read ended
    with 8, nothing open; an answer for 9 refused ("ended with Episode 8"); the hub's plaque alex's, no margin; Episode 8's immunity
    corrected (re-decided): jordan's call comes good, 3-0, jordan the champion. `check-h2h.js`, `check-answer-knockouts.js`,
    `check-coop.js`, `check-knockouts.js`, `check-pool-knockouts.js`, `check-questions.js`, `-who`, `-time`, `-scoring`, `-more`
    (`--api`) and `check-engine-lab.js --api` ALL PASS, again after the code review's fixes. `npx tsc --noEmit -p .` clean.
  - **Code review** (`/code-review` at high, before the long runs; nine findings). Taken: the final's series step graded without the
    game over (a question about the whole game left out of the final's points while the table's totals had it, so a final before the
    season's end could crown the other seat); `endedAt` saying ended once the final had early results (the matchup still waiting), and
    not saying it where the season ended before the final; a unit test for a draft's week after the finale; `applyWalk`'s sort thrown
    away before `MatchupLogic.apply`'s (`walkRows`); blind.js walking the matchups twice; `matchupsOf`'s unused return. Not taken
    (Noticed): an earlier episode still early once a later one is in counts as it stands even at the final (the established fallback,
    worked out again on every read, so a final that later gets its full results is played again); `MatchupLogic.series` building its
    Maps on each read (with part 4's memo item).
  - **The harness** (`blind.js`): its per-episode record of a head-to-head game (`.matchups`, `matchupLine`) reads a game of questions
    too, on the league walked as its table reads it; no tracker row plays one yet (above).
  - **Golden replays** (`golden.js`, HEAD against the working tree, after the code review's fixes): 7 seasons, 160 games, **19,361
    reads, every one the same** (no game they play is head to head).
  - **Blind replays** (`blind.js run`, the five seasons, on the final code): **every game ended on all five seasons** (Survivor 49 95 of
    95, The Challenge 41, 40 and 39 76 of 76, The Traitors 4 74 of 74), nothing refused, no problem in the moves. No row plays a game of
    questions head to head (above); win.h2h, a draft's, played as part 4's did, the same records, seeds and champions on all five (the
    week after the finale now skipped changes nothing there: on The Challenge the playoffs sat on the reunion, on The Traitors 4 the
    regular season ended before its finale). The study doc's "A11 part 4b: head to head on a game of questions, replayed blind".
  **As built (A11 part 5, 2026-10-30, on `engine`, not merged; no migration).** One session, after `lane.js sync engine` (already
  up to date; 1115 tests). Teams of players (who.teams). **Split** (above, as the seed allowed): handicaps (who.handicap, s19), teams
  that follow the show's own groups and the late joiners' leftovers are part 5b. Every default and everything a person sees is the
  user's (Noticed, below).
  - **The spec** (`schema.js`): `rank.teams` `{ of, made, score, unplaced, names? }`: the couch split into `of` teams (2 to
    `MAX_PLAYER_TEAMS`, 6) that score together, each of you still playing your own game (your own draft, lineup or answers). `made`
    draw (at random at the game's start, seeded and recorded) | choose (each picks theirs before it starts) | group (the show's own
    groups: VOCAB 'later', part 5b; said, `specWaitsFor` names it and nothing plays it); `score` sum | mean (of the members on it,
    episode by episode); `unplaced` smallest | none (where someone on no team goes once they count: a late joiner, someone who didn't
    choose by the start); `names` up to one a team, each 1 to `MAX_TEAM_NAME` (24) characters, none twice. The defaults `TEAMS` (draw,
    mean, smallest), read by `teamParts`, never filled in. `teamParts` (null unless it plays: a draft or a game of questions, ranked
    by its total or head to head, with no race). Refused (`teamProblems`): a pool ("a pool's streak is one person's run of right
    picks"), Weekly Calls and Weekly Bingo (counted outside the game), co-op ("the whole couch on one side already"), last one
    standing ("a team knocked out isn't built"), a race, a stock market's worth; `of`, `made`, `score`, `unplaced` or `names` out of
    range; the playoffs taking more teams than `of`; with ctx, more teams than the couch has seats (`teamsOf`: a shared seat once:
    "2 of you can't fill 3 teams"), and the playoffs counted against the teams of players in place of the seats. `answerParts` carries
    `teams` and is non-null for it, so a game of questions in teams is walked everywhere it's read. `flagsOf` `hasTeams`. Settings
    both ways: `rankTeams` (a draft's and a game of questions'). The exclusive count is unchanged: each seat still drafts its own
    team of castaways (a team that drafts together is A10 part 4b's shared seat).
  - **Words** (`describe.js`): the sentence ("Played in two teams, drawn at random at the start: a team's points are its members'
    average." / "(Red, Blue and Gold), each of you picking yours before it starts" / "added up"); head to head between teams ("Each
    episode your team plays another head to head", "The top two teams by wins make the playoffs"); How it works (the split, a team's
    points, where a late joiner goes, a seat that leaves, "The team with the most points wins: everyone on it shares the win", and
    head to head's rules in teams' words: an odd number of teams, the top N teams). A game of questions in teams says "No draft."
    (not "no team").
  - **The engine** (`state-logic.js` `TeamLogic`), worked out from the data on every read, as the knockouts are, so a corrected result
    works it out again and a viewer's copy counts only what they've seen; what's kept is who's on which team. `ids` ('t1'...),
    `teamAt` (a seat's team at an episode: its kept spell, else a draw's provisional team), `sideOf` (the team a seat plays for: its
    last), `membersAt`, `teamsAt`, `drawn` (the seats in the rotation there from the start, not catching up, in the seed's order, a
    team each in turn: sizes one apart at most), `started` (the game's first episode locked or with results), `series` and
    `standings` (each episode the game has played, its series `MatchupLogic.seatSeries`: a draft's own scoring, a game of questions'
    walk; each team's points what its members on it then earned in it, summed or their mean; then what they've earned since the last
    episode walked as the table has it, on the team they're on now: results still early, a question settled since), `label` (each
    row's `team`: id, name, points, place, rank, `now`), `apply`, `view` (made, score, of, set, yours, each team's members now, points,
    place; `fromRows`, the same read from the table's labelled rows, so the Games tab doesn't work them out twice),
    `chooseProblem`/`choose` (a seat picks before the start in a chosen game; whoever runs the game puts anyone on one then, and moves
    anyone once it's started, from the first episode not played or locked: `openEpisode`, `openFor`), `seed`, `settle` (on every
    write, db.ts, before and after the mutation). The standings place the teams as the game ranks them: by their points, or head to
    head by the team's record (how far in the playoffs, wins, the regular season's points, the seed), so a champion team with fewer
    points is first. `rankKey`: the team's points (every member shares its place, listed by their own points), someone never on a team
    after every team; head to head between teams, the team's record. `RosterLogic.setGame` gives a game made in teams its draw's seed
    at once (`state.teamDraw.seed`, `TeamLogic.seed`, as settle does for a state without one), so the same seats give the same teams
    from its first read; the draw before it's kept is memoised by state (its seats, start and seed).
  - **Who's on which, over time** (`state.teamSeats`: each seat's spells `[{ team, from, left? }]`): nothing kept for a drawn game
    until it starts (its draw from its seed on every read); kept once started (`state.teamDraw.kept`), the draw as it stood or the
    choices, each from their own start; a game made in teams mid-season keeps it at once, counting its past; a seat new to it (a
    late joiner once caught up, one brought in) from the first episode not played or locked. Before the start the draw is dealt over
    the seats there, so someone joining or leaving then can deal others onto other teams (`GameView.teams.set` false until kept).
  - **Head to head between teams** (`MatchupLogic`): the sides are the teams with someone on them (`seatsAt`, `series` from
    `TeamLogic.series`, `sideOf`), so the round robin, the median for an odd number of teams, the standings, the playoffs (their seeds
    teams) and the champion are the teams'; each row's `matchups` is its team's record (every member a champion), `MatchupLogic.view`
    says the seat's `side` and plays its team's matchups; a seat on no team plays nobody.
  - **The fallbacks:** someone who didn't choose by the start, or a late joiner once caught up, or a seat brought in later: onto the
    smallest team then (a tie: the first), or none (`unplaced` 'none': they play for nobody, ranked after every team); a ghost (a late
    joiner's private season) on none; someone still catching up placed once caught up; a disabled seat off its team from the first
    episode still to play (its points before staying with it; its row still plays for that team), back on it when reclaimed; a seat
    removed outright gone, its points with it; a team the spec no longer has (fewer teams): its seats placed again from the next
    episode; a team nobody's on scores nothing and plays nobody; a tie between teams shares the place (head to head: half a win, the
    better seed in the playoffs); results still early (counted as the table has them; head to head's matchups wait, as part 4's); a
    corrected result; a viewer behind; a shared seat (A10 part 4b) on a team is one member, credited for each account; a format change
    nobody announced reaches a team through each member's own game (nothing in teams reads the show's format: part 5b's teams that
    follow a group will); a state without a seed draws from a fixed one; a game of questions read without its walk counts everyone
    level (the safe fallback a reader not taught yet gets).
  - **The server:** the Games tab (`game-view.ts`): `TableRow.side` (the team the seat plays for: points, place, rank, `now`) and
    `GameView.teams` (`TeamLogic.view` on your copy, from the table's own points). The route `PUT /api/leagues/[leagueId]/player-teams/
    [playerId]` `{ team }` (a member their own before the start in a chosen game; the commissioner anyone's, and moves once it has
    started; a refusal a 400 with the reason). `db.ts` settles the teams on every write. The hub (`couch-hub.ts` `standingOf`): each
    member's place is their team's, each row's `side`, `GameStanding.teams`; `couch-standings.ts`: `fieldOf` counts a team of players
    once, head to head never pairs teammates, the plaque's winners are the winning team's members (each credited a title) with no
    margin in anyone's own points. A game of questions in teams is walked by `answer-points.ts` as any with `answerParts`, and the walk
    hands its episodes over (`answerWalk.series`, for teams as for head to head).
  - **The tracker:** who.teams ✅ (a Weekly Lineup on Survivor 51 in two teams, drawn). **Now: 176 ✅** · 69 ⏳ · 1 🆕 · 2 ❓ · 23 💬, of
    271; A11's two left: who.handicap and s19 (part 5b).
  - **Tests:** `tests/teams.test.js` (new, 9): the shape, defaults, words and settings both ways, what's refused (a pool, Weekly Calls,
    Weekly Bingo, co-op, last one standing, a race, each part out of range, the playoffs over `of`, the couch's count, a shared seat
    once, a league's own), `made` 'group' waiting for its step; the draw (balanced, seeded at setGame, the same on every read, kept at
    the start or the first lock, a ghost, a late joiner and a disabled seat not dealt, made mid-season counting its past, everything
    gone when teams are off); choosing (before the start, changing your mind, the unplaced onto the smallest at the start, a move from
    the next episode, back again, a drawn game's refusals, a ghost, someone catching up, a disabled seat); a team's points (sum and
    mean, every member sharing the place, the table's sides, the view, a tie); who's on a team over time (a late joiner caught up, a
    disabled seat and one reclaimed, `unplaced` 'none', a team the spec drops); results still early, a corrected result, a viewer
    behind; head to head between teams (the records, the seeds, the view's side, the final's champion team, three teams and the
    median, someone on no team); a game of questions in teams from its walk (and without it); the couch (one team in the field, a
    shared seat's two rows, the place points, head to head without teammates, the plaque's winners, a title each). The answer
    parts' shape in `answer-knockouts.test.js`, `coop.test.js` and `answer-matchups.test.js` (`teams: null`); `game-spec.test.js`'s
    fields (`rankTeams`). `npm test` 1124.
  - **API check:** `scripts/dev-test/check-teams.js` (new, on new-fixture.js's couch), 26 PASS: Lineup League made a game for Episodes 6
    and 7 in two chosen teams, the Reds and the Blues, summed, through `setGame` with the show's ctx; the Games tab before the start
    (not set, nobody on one); each picks through the route (a team that isn't one refused; riley can't pick for jordan); jordan's
    Survival Pool made a game of questions in two drawn teams (its seed set as it's made; a pick refused: drawn), the answers through
    the answers route; Episode 6 through the season sync: both games' teams kept (as chosen from 6; as drawn, the teams the Games tab
    showed before the start), each team's points its members' (the lineup's from their own points, the pool's the walk's right calls),
    every member sharing the team's place; sam's switch refused (set); alex moves riley to the Blues from 7; Episode 7: riley's points
    to the Blues, Episode 6's staying with the Reds, over; the hub's plaque the winning team's members, no margin; the hub's rankings
    read; Episode 7 corrected (re-decided): worked out again. `check-h2h.js`, `check-answer-h2h.js`, `check-coop.js`,
    `check-answer-knockouts.js`, `check-knockouts.js`, `check-pool-knockouts.js`, `check-questions.js`, `-who` (`--api`) and
    `check-engine-lab.js --api` ALL PASS; `check-teams.js`, `check-h2h.js` and `check-answer-h2h.js` again after the code review's
    fixes. `npx tsc --noEmit -p .` clean.
  - **Cost:** a read of a game in teams walks its series once more than a game without them (the table's, then the view's); nothing is
    memoised (with part 4's memo item).
  - **Code review** (`/code-review` at high, before the long runs; nine findings, all taken). Head to head between teams placed the
    teams by their points on the table's sides, the Games tab's teams and the couch (the plaque could go to a team with more points
    that lost the final): the standings now place them as head to head ranks them (a unit test: the champion team with fewer points
    first). A seat on no team kept its seat's place on the couch beside team places (7th of a field of 3): placed after every team now.
    A move made while an episode was locked, before its results, counted for that episode: from the first episode not played or locked
    now (`openEpisode`; a unit test). The words said someone who didn't choose goes onto a team "from the next episode" (they go on from
    the start). The draw was worked out again on every call before it's kept (memoised by state now); the Games tab worked the
    standings out twice (`fromRows`); a re-entrancy guard that guarded nothing (gone); the seed set in two places (`TeamLogic.seed`);
    a comment that said the teams shown before the start are always the ones kept (someone joining before the start can deal others
    elsewhere: said so now, and Noticed).
  - **The harness** (`blind.js`): each episode's record of a game in teams says each team's points, place and who's on it now
    (`.teams`, `teamLine`), as the app reads the league (a game of questions' on the league walked as its table reads it).
  - **Golden replays** (`golden.js`, HEAD against the working tree, after the code review's fixes): 7 seasons, 160 games, **19,361
    reads, every one the same** (no game they play is in teams).
  - **Blind replays** (`blind.js run`, the five seasons, on the final code): **every game ended on all five seasons**, who.teams among
    them (Survivor 49 96 of 96, The Challenge 41, 40 and 39 77 of 77, The Traitors 4 75 of 75), no problem in the moves. who.teams, a
    Weekly Lineup in two teams drawn from the four seats (two and two, a draw of its own on each season), each team's points the mean
    of its members' at every episode, as the table has them: Survivor 49 the tinkerer and the forgetter 56.25 to 45.5 (106 and 6.5
    against 22 and 69), The Challenge 41 the drive-by and the fan 2.5 to -3.5, 40 the drive-by and the fan 10 to 2.5, 39 the tinkerer
    and the fan 31.5 to 17.5, The Traitors 4 the tinkerer and the drive-by 41.5 to 23; level at the premiere on 39 and The Traitors 4
    (both teams T1). Nothing in teams reads the show's format, so The Challenge's re-pairings reach it only through each member's
    lineup. The study doc's "A11 part 5: teams of players, replayed blind".
  **As built (A11 part 5b, 2026-10-30, on `engine`, not merged; no migration).** One session, after `lane.js sync engine` (already
  up to date; 1124 tests). Handicaps (who.handicap, s19). **Split again** (A11's bullet, as the seed allowed): teams that follow the
  show's own groups and the late joiners' leftovers are part 5c. Every default and everything a person sees is the user's (Noticed,
  below).
  - **The spec** (`schema.js`): `rank.handicap` `{ points, who?, newTo? }`: `points` (1 to `MAX_HANDICAP`, 50) each episode the game
    plays, added to what the seat scores, for whoever `who` names: `new` (VOCAB `rank.handicap.who`: the only one), newcomers by the
    couch's history; `newTo` couch (no game on this couch on a season that premiered before this game's: the default) | show (none of
    this show on it). The defaults `HANDICAP` (new, couch), read by `handicapParts`, never filled in. `handicapParts` (null unless it
    plays: a draft, Outlast, a lineup, best ball or an auction, or a game of questions, ranked any way but co-op or a stock market's
    worth). Refused (`handicapProblems`): a pool ("a pool ranks by its streak, or who's still standing, not its points: a handicap
    would only break ties"), Weekly Calls and Weekly Bingo (counted outside the game), co-op ("nobody's ahead to even out"), a market
    ranked by worth; `points`, `who` or `newTo` out of range; an unknown key. `answerParts` carries `handicap` and is non-null for it,
    so a game of questions with one is walked everywhere it's read. `flagsOf` `hasHandicap`. Settings both ways: `rankHandicap` (a
    draft's and a game of questions', `settings.js handicapOf`).
  - **Words** (`describe.js`): the sentence ("Newcomers get 5 points an episode: anyone with no game on this couch from an earlier
    season." / "...no game of this show on this couch..."; the show isn't named, as the words' `show` is the season's label); How it
    works (the points every episode the game plays, who's new, that it's worked out from the couch's games when the game starts and
    stays all season, a late joiner's as they join, counting from their first episode; a team two share new only if everyone on it is).
  - **Who's new is data** (`src/lib/server/handicaps.ts`, new): for each seat, how many games its accounts have had on the game's couch
    before it (`couch`) and of this show (`show`): a game on the same couch (not this one, not deleted, not a practice or public game)
    whose season premiered before this game's (the catalog's premiere date, else when that game was made), where the account held a
    seat; a team two share stamped with the most of its accounts'; a league on no couch with nobody before anyone (everyone new, as the
    words say). Stamped into the state (`state.seatHistory`) on a write to such a game (`db.ts withLeagueLock`, after the mutation, in
    a savepoint) while the engine still needs it (`HandicapLogic.needsHistory`: before the start, or with a seat a person holds that
    isn't kept yet), so one query a write then and none once everyone's kept; a failed read keeps the stamp it had (logged); never a
    person's word.
  - **The engine** (`state-logic.js` `HandicapLogic`): `isNew` (kept once the game has started, else the history as it stands; a seat
    the history doesn't have, an empty one or a history never read, isn't new: it fails closed; a computer player never), `named` (the
    seats it pays, each from its own start or the episode it was kept from: not one still choosing where to start, nor one not brought
    in), `played`, `tally` (each newcomer's points through each episode walked, nothing after the season's finale), `apply` (a draft's rows: `handicap`, in `total`,
    ranked again), `view` (points, newTo, newcomers, yours, kept), `needsHistory`, `settle` (on every write: once the game has started
    (`TeamLogic.started`), each seat kept as the history has it then, `state.handicapSeats` `{ newTo, seats, from? }`; a seat kept after
    the first keep, not a late joiner, from the first episode still to play (`from`: a seat brought in, a computer player's taken over,
    a history read late); a computer player never kept; everything kept again when `newTo` changes, each `from` kept; all of it gone
    when the game has no handicap). Its points go where the points are made, so every reader has them: a draft's rows
    (`ScoringLogic.compute`, before anything ranks them) and its series (`KnockoutLogic.series`, which a race, the cuts, head to head
    and teams of players read; `KnockoutLogic.apply` freezes it with the rest for someone out), a game of questions' walk (each
    episode's totals, the totals the table shows, `answerWalk.handicap`, frozen for someone out; `walkRows` puts it on the rows).
  - **The fallbacks:** someone new to the couch (no history: new); a couch with no seasons before (everyone new, so it changes nothing
    between them: Noticed); a late joiner (kept as they join, from their own start: catching up, their own copy counts what they've
    played); a shared seat with one newcomer (not new: the most of its accounts'); a team of players with a newcomer (the team's sum or
    mean carries theirs); the history unreadable (never read: nobody new; a failed read: the last stamp); the history changing
    mid-season (kept once the game starts: a game deleted, a membership moved or an account added to a seat moves nothing); a seat
    handed over or brought in later (from the first episode still to play); a seat that leaves (keeps earning it, as its team plays on:
    Noticed); a viewer behind (their copy counts what they've seen); a corrected result; a span's end, a race won or one left (nothing
    after); the season's finale (nothing after it: a reunion The Challenge's schedule counts, with results of its own, gives nothing,
    as head to head's weeks after it don't play); someone knocked out (frozen at their last episode in); results still early (the table counts the episode; the cuts' walk
    and head to head's weeks wait, as their points do); a game of questions read without its walk (nobody's handicap: the safe
    fallback a reader not taught yet gets, none known).
  - **The server:** the Games tab (`game-view.ts`): `TableRow.handicap` (its points so far, null without one) and `GameView.handicap`
    (`HandicapLogic.view` on your copy). The hub and the couch's numbers read the table's totals, so a newcomer's handicap is in
    their place.
  - **The tracker:** who.handicap ✅ and s19 ✅ (a Weekly Lineup on Survivor 51, 5 points an episode for newcomers to the couch).
    **Now: 178 ✅** · 67 ⏳ · 1 🆕 · 2 ❓ · 23 💬, of 271; A11's rows all ✅ (part 5c's teams that follow the show's groups is the
    VOCAB value `rank.teams.made` 'group', no row of its own).
  - **Tests:** `tests/handicaps.test.js` (new, 6): the shape, defaults, words and settings both ways, what's refused (a pool, Weekly
    Calls, Weekly Bingo, co-op, a market by worth, each part out of range, an unknown key); who's new (no stamp: nobody; couch or show;
    a computer player never; before the start the history as it stands; kept at the start; the history changing after it; a seat
    brought in and a computer player's taken over, each from the first episode still to play; `newTo` changed; turned off;
    `needsHistory`); its points (each episode with results from the seat's start, a night nobody went home, the table's rows and rank,
    a viewer behind, a corrected result, a late joiner from their start, one still choosing and one not brought in getting nothing, a
    span's end, Outlast); a race won on it, the guillotine (it keeps newcomers in; someone out frozen with theirs), head to head's
    weeks, teams of players' points; a game of questions' walk (its totals, `handicap`, the table, its series in teams, someone out
    frozen); the couch's standings. The answer parts' shape in `answer-knockouts.test.js`, `coop.test.js` and
    `answer-matchups.test.js` (`handicap: null`); `game-spec.test.js`'s fields (`rankHandicap`). `npm test` 1130.
  - **API check:** `scripts/dev-test/check-handicaps.js` (new, on new-fixture.js's couch, its helpers in `check-kit.js`, new: the
    ones the other checks each copy), 27 PASS: the couch's history made (Survivor 50 with alex and riley, The Traitors 4 with jordan;
    sam's games deleted or on another couch); Lineup League made a game for Episodes 6 and 7 with 5 points an episode for newcomers to
    the couch, through `setGame` with the show's ctx; sam's lineup through the route stamps each seat's history (sam new, nothing
    kept); the Games tab names sam; casey (with a Survivor 50 game) on sam's seat makes it not new, off again new; jordan's Survival
    Pool made a game of questions with 2 an episode for newcomers to Survivor (jordan and sam); Episode 6 through the season sync: both
    kept, sam's row 5 in the total (everyone else's own points), the pool's walk 2 each for jordan and sam; the Survivor 50 game
    deleted: not read again while everyone's kept, nothing moves; casey joins the pool after its start: kept as new at the next write,
    2 from Episode 7, the history read again for them (alex's now nothing, still kept as not new); Episode 7: sam's 10, jordan's and
    sam's 4, casey's 2; the hub's plaque the winners with the handicap in. `check-teams.js`, `check-h2h.js`, `check-answer-h2h.js`,
    `check-coop.js`, `check-answer-knockouts.js`, `check-knockouts.js`, `check-pool-knockouts.js`, `check-questions.js`, `-who`
    (`--api`) and `check-engine-lab.js --api` ALL PASS. `npx tsc --noEmit -p .` clean.
  - **Code review** (`/code-review` at high, before the long runs; ten findings, nine taken, one the user's). The words named the season
    ("no Survivor 51 game ... from an earlier season"): the show isn't named now. A computer player was kept as not new at the start, so
    a newcomer who took its seat over could never be new: never kept now, and a seat kept after the start counts from the first episode
    still to play (`from`). The view listed seats the points didn't pay (one still choosing where to start, one not brought in): both
    read `named` now. A league on no couch had nobody new though its words say everyone is: everyone is now. The stamp ran on every write
    all season: only while the engine needs it (`needsHistory`). `HandicapLogic.on` read per row in the table, `parts` read per player:
    once each. `teamsOf` in settings carried the handicap: `handicapOf`. The check copied check-teams.js's helpers: `check-kit.js`. The
    check hard-coded the fixture's Traitors slug: read from its row. Taken to the user (Noticed item 10): a wager of "any of your points"
    can stake a handicap's. **The blind replays found one more** (their first run, on the reviewed code): on The Challenge the handicap
    counted the reunion's two episodes after the final (its schedule counts 21; results recorded on them), 105 where the game is over at
    19 with 95. It stops at the season's finale now (`tally`, as head to head's weeks do; a unit test), and the replays ran again. Last,
    by hand: `needsHistory` waited all season for a seat that left before the start (never kept, so the server read the history on
    every write); a seat that left isn't waited for now (a unit test). It changes only when the server reads, nothing scored, so the
    replays and the check stand.
  - **The harness** (`blind.js`): a game with a handicap gets an earlier game on its replay's couch first (`earlierGame`: a bare Outlast
    on the show's season before, made a year before the premiere, for the tinkerer and the fan), so the drive-by and the forgetter are
    its newcomers; each episode's record says who it names, whether that's kept, and each one's points from it (`.handicap`,
    `handicapLine`); each game's record its `history`.
  - **Golden replays** (`golden.js`, HEAD against the working tree, after the code review's fixes): 7 seasons, 160 games, **19,361
    reads, every one the same** (no game they play has a handicap).
  - **Blind replays** (`blind.js run`, the five seasons, on the final code): **every game ended on all five seasons**, who.handicap and s19 among them
    (Survivor 49 97 of 97, The Challenge 41, 40 and 39 78 of 78, The Traitors 4 76 of 76), no problem in the moves. who.handicap, a
    Weekly Lineup with 5 points an episode for newcomers, the tinkerer and the fan seated in an earlier game on each replay's couch, so
    the drive-by and the forgetter were its newcomers, kept from Episode 1: 5 an episode each through the season's finale (Survivor 49
    65 over 13 episodes, The Challenge 95 over 19, The Traitors 4 55 over 11), the newcomers first on four seasons of five (Survivor
    49's tinkerer, 106 on their own, still first). On The Challenge, where a lineup's season is -9 to 27 points, the handicap decides
    the game (Noticed item 8). The study doc's "A11 part 5b: handicaps, replayed blind".

  **As built (A11 part 5c, 2026-10-30, on `engine`, not merged; no migration).** One session, after `lane.js sync engine` (already
  up to date; 1130 tests). Teams that follow the show's own groups, refused; and the late joiners' leftovers. Not split (the seed's
  5d wasn't needed: the refusal is small). Every default and everything a person sees is the user's (Noticed, below).
  - **Teams that follow the show's own groups: refused** (`schema.js`: `rank.teams.made` 'group' is out of VOCAB, so the manual never
    offers it; `teamProblems` says why, naming what does ride the show's groups: "Teams of players are the couch's own and last the
    game, while the show's groups end at a swap, a merge or a re-pairing: to ride the show's groups, give each of you a group slot (a
    pair or team you ride while it lasts), or ask which group wins each episode"; `teamParts` plays no teams for a `made` that isn't one,
    never the default's draw; `specWaitsFor` no longer names it). Why it doesn't fit as a team of players: a team of players is a side of
    the couch ranked over the whole game, and the show's groups don't last (F1's lifetimes and F3's: The Challenge 41's rotating pairs
    and all of 39 one episode each, Survivor's tribes ended by its swaps and the merge, every Challenge season individual by its
    end), so a team tied to one ends mid-game, or the game makes its teams again at every change, which is a stage, not a team. What a
    couch means by it is already the engine's or A12's: a group slot (A10: you ride a group while it lasts), a group question each
    episode (A6: "which tribe wins immunity"), and A12's stages (a stage per grouping, a side stage once one lasts, a stage started by a
    format change that can draw the couch's teams for it: "when the show forms teams, we draw teams too"). The other shape, a fixed
    team that backs one of the show's groups, is the user's question (Noticed item 1), with A12.
  - **Nobody new once someone's out, in every game that knocks people out** (part 1's rule, as recommended there, now one rule):
    `GhostLogic.someoneOut` (a draft's cuts and a game of questions' walk through `KnockoutLogic.outs`, a pool's lives run out with no
    buyback left through `PickEmLogic`'s walk or each seat's own season; a ghost's private season and a seat that left don't count),
    read by `GhostLogic.allowed`, so `joinMode` is locked and the couch's join refuses. **The join route reads a game of questions as it
    stands:** `couch-joins.ts couchGameList` walks each game of questions that knocks players out or ends early over its answers
    (`answer-points.ts asItStands`, side by side), so who may join and whether it's over read the walk (the join route and the couch's
    game list both: the list's `ended` was part 2b's item too). **A seat joining by a code or an invite once someone's out**
    (`join-league.ts`, which has no join-mode gate) waits, inactive, as one joining after a finished draft does (`addPlayer`'s
    `someoneOut`, the server's verdict read as it stands), never playing from the start, where a pool's or a game of questions' missed
    episodes would knock it out at once (the code review's; a computer player still plays).
  - **Someone catching up in a pool with lives** (part 2's item): their season is played only as far as their own week (the episode
    after their mark, kept on their `lateJoin.seenThrough` by every route that moves it; or the latest episode they've picked in, should
    that lag), in every copy: an episode past it isn't theirs yet and their week with no pick is still open, so neither is a missed pick
    or a life lost, whatever results everyone else has (`PickEmLogic.stepper`'s reach). Caught up, a missed episode is a miss again.
  - **A late joiner after a draw is dealt** (A10 part 3's item 7, as recommended): `DrawLogic.dealsLate` (a draw that has dealt) and
    `lateDeal` (as many as the draw deals each, from who was still in before their start: owned or not for a late joiner playing their
    own season, nobody's for someone let in to play in the open; a shared draw's own hat; shuffled by the draw's seed and their seat, so
    the same join deals the same team; a spread and a salary cap, at the prices as of their start, take the first that keeps the team
    within them; short when fewer are left). `GhostLogic.begin` deals it and reads no `castawayIds`; the couch's join options say
    `dealt` (nothing to pick), and the join sheet (`src/new/couch/join-game.tsx`) joins straight from the start choice instead of opening
    an empty picker (the code review's: the one change to a screen, so an existing sheet keeps working; its words are U1's).
  - **A late joiner under a price** (A10 part 3b's and 3c's items): `GhostLogic.begin` prices their team as of the episode before their
    start (as the draft paid then): a salary cap holds it (`BudgetLogic.teamProblem`, its cheapest team counted from who they could have,
    `pool`: never refused when no team they could have fits, the code review's), and what it cost is `player.joinPaid`, which a stock
    market's cash counts (`MarketLogic.draftPaid`, and `cashAll` from it now, so the draft's cost has one sum). Castaways whoever runs the
    game gives a seat (`RosterLogic.activatePlayer`) are paid at today's prices too, never refused (the runner's call: Noticed).
  - **A late joiner's captain and second pick** (A9 part 2's and A10 part 2's items): they always went through `GhostLogic.applyAs`;
    now a check plays them through the lineup and pick routes (below).
  - **A late joiner's team in a drawn game in teams** (part 5's): placed on the smallest from the first episode still to play, as
    built; the check joins one through the route.
  - **Computer players fill group slots** (A10 part 1's item; `bot-logic.js groupSlotPicks`, in `run`): before the episode locks, a slot
    with nothing in it (never picked, or its group ended) takes the group on offer whose people it rates best (their likely points on
    average, as its lineup reads them, plus its own taste); a slot riding with its group is left (never a swap), a group someone else
    holds in an exclusive opening is passed over for the next, nothing on offer leaves it empty; not for a bot knocked out or with no
    castaways. Idempotent, as every bot move is (`hasWork` finds nothing more).
  - **The tracker:** unchanged (`--check`): no row is a late joiner's or a teams-follow-groups row (the dial's who.teams row is drawn
    teams). 178 ✅ · 67 ⏳ · 1 🆕 · 2 ❓ · 23 💬, of 271.
  - **Tests:** `tests/late-joins.test.js` (new, 6): nobody new once someone's out (a pool's lives, a buyback, a plain pool, a seat that
    left and a ghost not counting, the waiting seat and a computer player's, a game of questions raw and walked, by its code); someone
    catching up in a pool with lives (their week, a pick for it through `applyAs`, a lagging mark, caught up); a late joiner after a draw
    (from what's left, a ghost's from everyone still in, a shared draw's hat, the same deal twice, a snake's still picked); under a price
    (a cap, a market's cash at their start's prices and at the premiere's, the cheapest team from their pool, castaways given); a late
    joiner's captain and second pick (as they see the league, counted); computer players' group slots (nothing on offer, the best pair, a
    person's slot left, riding, re-paired and picked again). `teams.test.js`: 'group' refused. `npm test` 1136.
  - **API check:** `scripts/dev-test/check-late-joins.js` (new, on new-fixture.js's couch and `check-kit.js`), 30 PASS: Lineup League with
    a captain; casey joins it by its code (a late joiner, unseen), starts from Episode 4 through the late-join route, sets their week's
    lineup and captain through the lineup route (on the real Episode 4; Episode 5 refused, ahead of them; their own copy counts the
    captain twice); the Survival Pool from Episode 4 with a life each and a second pick, casey on the couch catching up from 4, their
    pick and second pick through the pick route (on the real Episode 4), Episodes 5 and 6 no missed picks in everyone's copy; jordan's
    Survival Pool made a game of questions with a life each, open to casey; Episode 6 through the season sync (sam's pick and answer the
    one who went home): sam out of both, casey still in on their week, both games locked on the couch's list (the game of questions
    read as it stands) and casey's join refused (403); ZT Extra's game made a shared draw in two drawn teams, drawn, riley told the team
    is dealt, joining live and dealt two from their own hat, onto the smallest team from then, the draw kept. Also ALL PASS:
    `check-pool-knockouts.js`, `check-answer-knockouts.js`, `check-group-slots.js`, `check-new-couches.js --api`,
    `check-new-computer-players.js --api`, `check-new-solo.js --api`, `check-handicaps.js`, `check-teams.js`, `check-knockouts.js`,
    `check-h2h.js`, `check-draft-spread.js`, `check-market.js`. `npx tsc --noEmit -p .` clean.
  - **Code review** (`/code-review` at high, before the long runs; ten findings, eight taken, two declined). Taken: the cap's cheapest
    team counted every castaway still in, so someone let into an exclusive game could be refused a team no team they could have
    beats (counted from their pool now); the join sheet opened an empty picker for a drawn game (`dealt` on every options read, the
    sheet joins straight); a code or invite join once someone was out made a seat that played from the start, out at once in a pool
    with lives (it waits now, a game of questions read as it stands); the couch's list walked its games of questions one after another
    (side by side); `someoneOut` walked every seat's season on every call (the pool's walk once, or each seat until one's out); the bot
    rated each group again on every comparison (once), and filled slots for a bot with no castaways (skipped); `cashAll` summed the
    draft's costs beside `draftPaid` (from it now). Declined: that `teamParts` no longer draws for an unknown `made` (`specProblems`
    refuses one at `setGame`, and a spec stored with 'group' had no teams before either: VOCAB 'later'); that `begin` and `lateDeal`
    each work out the view and its prices (once a join). Taken to Noticed: the walk read where joining is read elsewhere (`shareCheck`,
    classic's late-join toggle), and `gameOnCouch` building the whole couch list to find one game.
  - **Golden replays** (`golden.js`, HEAD against the working tree): 7 seasons, 160 games, **19,361 reads, every one the same** (after the code review's fixes; no
    game they play has a late joiner, someone out with a newcomer joining, or a drawn game's late deal).
  - **Blind replays** (`blind.js run`, the five seasons, on the final code): **every game ended on all five seasons** (Survivor 49 97 of 97,
    The Challenge 41, 40 and 39 78 of 78, The Traitors 4 76 of 76: part 5b's counts, no row added or lost), no problem in the moves,
    nothing refused; the questions waiting on early results as before (finding 20's: 2, 2 and 3 on The Challenge). The replays' four
    seats join before the premiere and stay, so none of part 5c's late-joiner paths runs there (the unit tests and
    `check-late-joins.js` play them), and no tracker row is played in teams that follow the show's groups (refused). The study doc's
    "A11 part 5c: the late joiners' leftovers, replayed blind".
- **A12. Stages.** A game made of phases or mini-games, each with its own rules and an overall: a second draft at the merge, a
  season of mini-games, a game that scores two ways (bingo lines plus answers), one game across two shows.

  **Split in parts (2026-10-30), each its own session, the engine's only (no screens: U1's and track V's).** Each piece rides on data
  with its fallback from the start; every default, what players and the maker are told, and the edge cases (a change during a draft,
  two in one episode, one in the finale, one that comes back) go in the part's Noticed, for the format-change design session after A12.
  - **Part 1: the stage spec, stages on an episode or a phase, the overall, a second draft counted where it drafts** (shape.stages,
    shape.phaseRules, s39; a game that ends before a phase, when.toPhase): built (below).
  - **Part 2: a stage started by a format change** (p7): a stage that starts on a change of the kinds the spec names (F3's `MAJOR` by
    default, `stageTriggers`: the sure ones acted on from the episode they take effect, the unsure ones held and flagged), again at every
    such change ("whenever": a stage made each time from the spec's own), the maker's OK or by itself with an undo (both built, a spec
    setting), a stage started on a report later corrected undone (`timelineDiff`: its start waits again and what it scored goes, as a
    result taken back does), the 'next-stage' fallbacks VOCAB marks 'later' (`ask.fallback`, `get.groups.fallback`), proven on The
    Challenge's three seasons and Survivor 49's swaps and merge, replayed blind.
  - **Part 3: when a grouping lasts** (p8): a side stage that opens once a grouping has held N episodes (F3's `sideStages`), scores from
    then on and closes when it changes (its points kept), follow the people, a pick each episode from the groupings on screen, and a
    decision point for the game's people with the game's default if nobody answers by the next lock (the maker's OK now, A14's vote
    later); and A11 part 5c's backing team if a request asks.
  - **Part 4: mini-games, two ways of scoring, two shows, late joiners** (shape.minis, shape.twoWays, shape.twoShows, s45, s20, p1):
    stages of bingo and Weekly Calls (their tables from the server's own counts), stages that play at the same time, a stage on another
    show's season, and someone joining a game in stages once it has started.

  **As built (A12 part 1, 2026-10-30, on `engine`, not merged; migration 0203).** One session, after `lane.js sync engine` (master's
  daylight-saving fixes and handoff; 1141 tests). A game in stages, on episodes and phases, with its overall. Every default and
  everything a person sees is the user's (Noticed, below).
  - **The shape: a stage is a league of its own.** A stage that's bingo one week and a draft the next, two ways of scoring at once and
    one game across two shows can't share one league's state, and a game's own data (its answers, its bingo cards, its draft) is keyed
    by its league. So a game in stages is a league (the game: its seats, its table the overall) and each stage is an ordinary league,
    a game the engine plays exactly as it would alone, tied to it (`leagues.stage_of`, `stage_key`, migration 0203, a stage deleted with
    its game), on the same couch and season, its results the season sync's like any league's.
  - **The spec** (`schema.js`): `{ spec, preset: null, stages, overall, extras? }`. `stages`: 2 to `MAX_STAGES` (6), each `{ id, name,
    game }`, `game` an ordinary spec checked as one (with the show's ctx; the exclusive count only for the first stage, where the game
    drafts: a later stage's waits for its draft to open), never nested, in order: each starts where the one before ends (the episode
    after its last, or the phase it ends before; a gap, which nobody would play, is refused; stages that overlap wait for part 4). A
    stage that doesn't say where it ends ends where the next starts (`stageGames`), and a later stage's draft opens at its start unless
    it says. Its own parts are what a game in stages is (`fullStaged`: nothing held, `score.by` 'stages', its span from its first stage's
    start to its last's end); anything else said there is refused ("its rules are its stages'"), as an overall on a game that isn't in
    stages. `overall`: `{ by: points | places | wins, places? }` (VOCAB `overall.by`; `OVERALL` points): each stage's total as its table
    shows it added up (every stage as it stands); points for each place in a stage that's over (`places` [1st, 2nd, ...], else one for
    each of you below you, plus one; ties share the higher place); stages won (ties all win), then places, then points. A stage of bingo
    or Weekly Calls (scored outside the game) waits for part 4 (`specWaitsFor`); `playsAs` 'stages' only when every stage plays one of
    `STAGE_KINDS`. Its settings (`settings.js`): `leagueTypeId` 'stages', `settings.stages` (each game whole) and `stageOverall`, both
    ways (the round trip, `withSpec`). Its words (`describe.js describeStages`): "A game in two stages for Survivor 51: Pre-merge, an
    Outlast ...; then Post-merge, ... Overall, the most stages won wins ...", How it works the overall then each stage's own.
  - **A game that ends before a phase** (`span.to { phase }`, `{ phase, at }` once settled; `spanEnd`, `spanEndPhase`, settings'
    `endPhase`): it runs on while the phase's start is unknown, then ends with the episode before where a game starting at that phase
    would play from (`RosterLogic.settleStart`'s `where.end`, the same rule as a start: its first episode, or the first still open once
    it's begun), so a stage that ends before the merge and the next that starts at it always meet; it never moves once the episode after
    it has aired, waits again when the phase's start is cleared, and one whose phase came before its start never plays. Settled where a
    phase start is (`phase-starts.ts settleIn`, the desk's confirm through `settleSeasonStarts`, the season sync's backstop), each with
    its line ("Ends before Merged, with Episode 7"); every reader of `span.to` reads `spanEnd` (`endEpisode`, `inPlay`, the knockouts'
    series, the answers' facts, the cut, playoff and points-times checks). A plain request on its own: "a Weekly Lineup until the merge".
  - **A draft that opens at its game's start** (`extras.draft.opens`: 'any', today's, by leaving it out; 'start', a later stage's
    default; settings' `draftOpens`): it opens once the game's start is known and the episode before it has results, so it drafts from
    who's still in (`DraftLogic.waits`, with why; `isStarted`, a pick, a draw and an auction's bids wait for it; a Start before then
    waits too, and the draft room's start route refuses with the reason), and stays open once anyone is on a team (`DraftLogic.begun`).
    As it opens, an exclusive draft that no longer covers every pick (the seats in its rotation × each, against who's still in) is played
    shared from then on (`RosterLogic.settleDraftShare`: a snake becomes a private draft revealed at once, a draw deals each seat from its
    own hat, waivers go where a shared draft has none; an auction stays, filling what it can), once, before anyone's on a team, through
    `setGame`, with a line in its Recent changes ("The draft is shared: 4 of you × 3 is more than the 11 still in, so two of you can have
    the same one"): the 9:10 PM decision counted where the game drafts and as the pool shrinks (db.ts runs it before and after every
    write's mutation, `stages.ts settleStageDraft`).
  - **The overall** (`state-logic.js StageLogic`, the league type 'stages' with `StagesScoringStrategy`, `rankKey`): from the stages'
    tables as the server reads them (`answer-points.ts stageWalk`, in `asItStands`, so every walked reader has it: the Games tab, the
    couch's game list, the hub): each stage league as it stands (a game of questions graded and walked on its answers), its table after
    each episode it played, the one anyone on its couch sees at that mark (`gameView`, no seat), to its end; never stored. The game's
    copy at a viewer's mark reads each stage's last entry by then (`SpoilerLogic.viewThrough` cuts the walk too), so someone behind
    sees only what they've seen. A stage not yet started counts nothing; someone not in a stage's table scores nothing there. The game
    ends with its last stage (`StageLogic.endsAt` in `lastEpisode`, early where that stage ended early), and nobody new joins it once its
    first stage has started (`StageLogic.started` in `GhostLogic.allowed`; a code join then waits, inactive: `addPlayer`).
  - **The server** (`src/lib/server/stages.ts`): the game holds the seats; each stage mirrors them and their memberships (`seatStage`,
    `mirrorMemberships`: a seat the game has added to the stage under the same player id through `addPlayer`, so the stage's own rule for
    someone joining holds; a seat gone from the game taken out where the stage hasn't begun, else left with its team and points; names,
    leaving, coming back and computer players mirrored; a membership the game no longer has, a hand-over and a role change mirrored),
    through each stage's own `withLeagueLock` after any write to the game commits (`db.ts syncStages`, from `withLeagueLock` and
    `join-league.ts`; only the stages that differ, `stagesToSeat`), so the stage's bots, settles and draft share run as on any write.
    The engine lab makes a game in stages (`engine-lab.ts makeStages`: the game, then a league per stage with its spec through `setGame`
    and the season's ctx, tied, seated, its phases settled; a spec that doesn't say where it starts starts its first stage with the next
    episode to air). Deleting the game takes its stages with it, restoring brings them back (`end-game.ts`, `deleteStages`,
    `restoreStages`). The couch's hub counts the game, never its stages (`show-space.ts` `Game.stageOf`); the stages are on the couch's
    lists as games of their own (their moves are there: U1 and track V decide how they're shown). `GAME_NAMES` calls it "Stages" (a
    working name).
  - **The tracker:** shape.stages (a second draft at the merge: a Weekly Lineup before it, another drafted at it, the overall by points),
    shape.phaseRules (a Weekly Lineup before the merge, a Survival Pool after it, by places), s39 (pre-merge and post-merge Outlasts with
    their own exclusive drafts, by stages won) and two new rows, shape.episodes (the season's halves by episode, so The Challenge and The
    Traitors play stages too) and when.toPhase (until the merge), ✅. **183 ✅** · 64 ⏳ · 1 🆕 · 2 ❓ · 23 💬, of 273 (A12's are 8 now).
    s39's first stage drafts 4 × 3 = 12 exclusively, which every taped season's cast covers; its second is counted as it opens.
  - **Tests:** `tests/stages.test.js` (new, 8): a game that ends before a phase (its spec, words, settings, where it settles, never
    moving once the next has aired, cleared, one that never plays, one from phase to phase); a stage that ends before the merge and the
    next always meeting; a draft that opens at its start (waiting with why, a Start waiting, nothing counted before, opened by the
    episode before's results, made shared with waivers gone, one that fits staying exclusive and drafting from who's left, open once
    begun, a draw, today's drafts untouched); the staged spec (whole, in order, its words and settings, every problem and wait, the
    exclusive count only where the first stage drafts); a game in stages through the engine (two Outlast drafts, the second at the
    merge from who's left and shared, the overall by points, places and wins at each viewer's mark, read as the server reads the stages:
    `gameView` at each episode); ties sharing a place and a win; nobody new once it's started; a gap refused. `game-spec.test.js`'s
    fields: `endPhase`, `draftOpens`, `stages`, `stageOverall`. `npm test` 1149.
  - **API check:** `scripts/dev-test/check-stages.js` (new, on new-fixture.js's couch and `check-kit.js`), 34 PASS: the desk's admin starts
    s39 from the engine lab (the game and two stage leagues, tied, its seat in each; Pre-merge from Episode 6 until Merged, Post-merge
    waiting with its draft at its start); alex, riley, jordan and sam join the game on the couch and are seated in both stages under the
    same ids; Post-merge's draft refused with why; Pre-merge drafted through the pick route; Episode 6 through the season sync, the Games
    tab's table the first stage's (at a viewer's mark: alex caught up first); jordan leaves (out of both stages, a disabled seat with its
    team in the begun one, gone from the other); the desk confirms Merged at 8 (Pre-merge ends with 7, Post-merge starts with 8, a line in
    each, its draft now waiting for 7); Episode 7: the draft opens and is shared (4 × 3 more than the 11 still in, its line), nobody new
    can join, drafted in private through the blind lock route; Episode 8: the game's table each seat's two stages added up; sam behind
    sees nothing, then Pre-merge only; the hub counts the game, not its stages; deleted and restored with its stages. Also ALL PASS:
    `check-phase-starts.js`, `check-engine-lab.js`, `check-late-joins.js`, `check-new-couches.js --api`, `check-desk-games.js`,
    `check-group-slots.js`, `check-knockouts.js`, `check-new-computer-players.js --api`. `npx tsc --noEmit -p .` clean.
  - **Code review** (`/code-review` at high, before the long runs; ten findings, all taken). The seat sync only ever added seats and
    memberships: a seat leaving the game stayed seated and in charge in every stage, a hand-over or a role change never reached them, and
    a waiting seat got a membership in a stage it wasn't in (now `seatStage` and `mirrorMemberships` mirror both ways); it wrote the
    stages raw inside the game's transaction, skipping their bots and settles (now each through its own write after the game's commits,
    only those that differ); deleting the game left its stages live (soft delete: they go and come back with it now); the season's phase
    walk skipped a game asking by phase whose end could still move; a gap between stages passed (refused); `stageWalk` read the stages one
    after another (side by side; its cost is Noticed); the lab copied seats its own way (`seatIn`, shared) and counted stage leagues in its
    names; the join route walked a game in stages to find someone out (none is). Then, by hand, a code join once the game has started waits
    inactive and isn't seated in its stages.
  - **Golden replays** (`golden.js`, HEAD against the working tree, after the code review's fixes): 7 seasons, 160 games, **19,361 reads,
    every one the same** (no game they play is in stages, ends before a phase or has a draft that opens at its start).
  - **Blind replays** (`blind.js run`, the five seasons, on the final code; `blind.js` plays each stage as a game of its own beside the
    game, its draft when it opens, and reads the game's table as it stands): **every game ended on all five seasons** (Survivor 49 110 of
    110: 102 tracker games and eight stage records; The Challenge 41, 40 and 39 81 of 81; The Traitors 4 79 of 79), nothing refused. On
    Survivor 49 the merge came in with Episode 7's results, so the stages ending before it ended with 7 and the next started with 8;
    s39's second draft opened at 8 and went shared (4 × 3 more than the 11 left); each overall added up as its rule says (shape.stages
    by points, the Tinkerer 45 + 64 = 109; s39 by stages won, one each for the Fan and the Tinkerer). The season's halves (shape.episodes)
    played on all five. The study doc's "A12 part 1: stages, replayed blind".
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
  copy, a replay of every taped season, and a Neon branch of production (from the user's terminal). In parts (2026-10-30): **part 1**,
  the three kinds Survivor 51's couch plays (Outlast with finale predictions, side bets and waivers; Weekly Lineup; Survival Pool), in
  the engine and everything that scores them or reads what they hold; **part 2**, Weekly Calls, Weekly Bingo and the game of questions
  (the games scored outside the state: `answer-points.ts`, `answers.ts`, `calls.ts`, `bingo.ts`, `season-games.ts`'s calls, the me
  route), which empties tests/pieces.test.js's list of part 2's files. R3 takes the rest of that list (the type field's writers and the
  screens' readers). Its proof beyond the golden replays: the Survivor lane's Survivor 51 season-forward rehearsal
  (`scripts/dev-test/season-forward.js`), which has to pass before R1 merges (never on a Wednesday; the main folder merges).

  **As built (R1 part 1, 2026-10-30; merged and live the same day, `46b77bba`; no migration).** One session.
  - **The pieces** (`state-logic.js` `piecesOf(state)`): a game plays the composition its spec names, never a league type. Its
    draft mechanic from how it gets its castaways (`DRAFT_PIECES` by `get.order`: a snake, a blind draft, a draw, an auction;
    `NoDraftStrategy` with nothing to draft: `draftPiece`), its scorer from how it scores (`SCORE_PIECES` by `score.by`: the boot
    order, moments, who survives, answers and bingo lines counted outside the state, stages: `scorePiece`), the spec's parts that
    picked them (`holds`, `counts`, `scores`, `ranks`) and what it has (game-spec `flagsOf`, the game's own: a lineup is a draft
    whose starters count, best ball one whose best n do, a pool a pick each episode, waivers, side bets and finale predictions beside
    a draft). Frozen and kept per carried spec (a carried spec is replaced, never changed in place); a game read from its fields is
    read fresh each call, as `gameOf` is: 2 to 3.5 µs a call there (the league type's lookup was 0.4 to 1.1 µs; a whole scoring pass
    is 26 to 102 µs). A spec no game plays falls back to an Outlast drafted the way the spec says (a shared draft blind, a draw or an
    auction as such), exactly as the league types' fallback played it.
  - **Drafting and scoring dispatch through them:** `ScoringLogic.compute`, every `DraftLogic` method, `StageLogic.on`,
    `GhostLogic.sharedJoin` and `teamSize`, a lineup's validation, the waivers (`supported`, `waivers`, `shortAt`, the replace rule's
    writes, `recommendFor`) and classic setup's ownership step. `WaiverLogic.recommend` takes how a game scores (`scores: 'place'`
    for Outlast, `'moments'` for a lineup) instead of a league type's id.
  - **The league type only names a game for the screens now** (until R3): `LEAGUE_TYPES`' entries are a name, words and flags, with
    no strategies; the draw's and the auction's variants went (they only swapped the strategy); `getLeagueType` gives the type its
    ownership and count make. Its flags are the pieces' on every kind of league and every game the tracker plays (tests).
  - **Outside the engine, everything that scores these games or reads what they hold reads the pieces:** the Games tab's view and
    table (`game-view.ts`); an episode's lines and the reveal (`episode-view.ts`; `season-episodes.ts`'s main table by how each game
    scores, `RevealPart.scores`, and its order, a game scored by moments first); Recent changes' results (`results-changes.ts`); the
    pool's and the lineup's moves (`pool-view.ts`, `lineup-view.ts`); the couch's standings (`couch-hub.ts`, with `GameStanding.pool`
    for a pool's plaque giving no margin in `couch-standings.ts`, where it compared `gameType !== "pickem"`); the season's stats and
    How it works (the game scored by moments first: `season-stats.ts`, `how-it-works.ts`, each game's pieces read once); Backstage's
    points (`pointsWrite`, `scoringRules`); Up next's lineups and picks (`season-games.ts` `progressOf`, by how the game scores); the
    computer players (`bot-logic.js`, `computer-players.ts`); classic's lineup lock and scoring-event routes.
  - **What reads differently:** nothing on today's games (the golden replays, the flag check, the fixture's checks). One gate follows
    its piece: classic's scoring-event route takes a moment for any game scored by moments (best ball and a stock market too, which it
    refused for having no lineups); its DELETE had no gate before and has none now.
  - **The flag's check** (`scripts/game-specs-flag.js check`, R2's) snapshots the pieces as well (the draft, the scorer, the spec's
    parts, every flag) beside the league type's name and flags.
  - **The guard** (tests/pieces.test.js): every file under `src/lib` and `src/app/api` that still reads a league type or compares one
    by name is listed with the step that takes it (part 2's six; R3's seventeen: the type field's writers, the tours, the screens' readers);
    a new reader fails it, and so does a listed file once it's clean, so the list only shrinks. In `state-logic.js`, only the setup
    checklist's name and the league type's own machinery.
  - **Proof:** `tests/pieces.test.js` (5: each kind's pieces and the screens' flags; every game the tracker plays, 183; a draw, an
    auction and best ball; the waivers' recommendation; the guard), the strategy reads in the game-spec, draft prices, the draw, best
    ball and stages tests moved to the pieces, the waivers' and the couch standings' fixtures to `scores` and `pool`; `npm test` 1154;
    `tsc` and `eslint` clean. `game-specs-flag.js check`: PASS, 9 of 9 (this lane's database, the flag on). The golden replays
    against the code before the step (`golden.js`, `--before=HEAD`): 7 seasons, 160 games, 19,361 reads, every one the same, before
    the review's fixes and again after them; against master's (production's engine, `--before=master`): the same, 7 seasons, 160 games, 19,361 reads. The blind
    replays (`blind.js run`): every game played through and over on all five seasons, as after A12 part 1 (Survivor 49 110 of 110, The Challenge 41, 40 and 39 81 of 81 each, The Traitors 4 79 of 79; the questions waiting on early results finding 20's 2, 2 and 3). On the zt_nd_ fixture through the app (this lane's server): the reveal (49), the hub's standings
    (77), the season's stats (57), the draft room (91), Backstage II (149: Game settings, waivers, the points' limits), Make it ours (95:
    the points page), the computer players (26, `--api`) and the show page with How it works (81), all passed.
  - **The code review** (`/code-review` at high, on the diff before the long runs). Fixed: the fallback (it dropped the spec's
    ownership; it mirrors the old one now); the strategies left on the league types as a second table (gone); the flag's check
    snapshotting the league type's strategies (the pieces now); `recommend`'s declared input (`scores`); `piecesOf` worked out on every
    call (kept per carried spec, frozen); each game's pieces read several times a request (once); Up next still filtering by type id
    (by how the game scores); the guard's hand-picked list (a scan of every file, with what's left named). Kept, said here: the
    scoring-event route's wider gate (above); How it works and the stats loading every one of the viewer's games on the season to find
    the one scored by moments (cached by hash, a handful of games).

  **As built (R1 part 2, 2026-10-30; merged and live the same day, `46b77bba`; no migration).** One session.
  - **The games scored outside the state read their pieces:** Weekly Calls, Weekly Bingo and a game of questions are chosen by
    `StateLogic.piecesOf` (`hasCalls`, `hasBingo`, `hasQuestions`: game-spec `flagsOf`, from how the spec scores and what it asks), never
    a league type or a type id compared by name. A game of questions' answers, its walk, its standing and its stages' walk
    (`answer-points.ts`: `walked`, `stageWalk`, `leagueAnswers`, `answerStanding`), what a wager can stake and the sheet's answers
    (`answers.ts`), a Weekly Bingo game's lines (`bingo.ts` `leagueBingo`), Weekly Calls' table and a pool's Who goes home? (`calls.ts`
    `leagueCalls`), which of them a game on the Games tab reads (`season-games.ts` `viewWithCalls`) and, beyond the list, whether a game
    scored outside its state is over for joining and the desk (`couch-joins.ts` `gameOver`, the one line that kept it on R3's list).
  - **Where a reader needed the kind before the state (decided: load the states, carry no new field).** The home's moves for Weekly
    Calls and a sheet of questions (`weeklyCallMoves`, `questionMoves`) chose a game by `Game.gameType`, the stored type field read in
    SQL (`show-space.ts` `games()`). They now take each game's state and choose by its pieces: the home reads your games' states
    (`leagueStates`, cached by md5, so a hash each) after `dueMoves` has read them, as it already did for Up next and results due, and
    hands them over. A spec-derived field on `Game` would have meant `games()` sending every league's settings on every couch page and
    show space for a field only the home's two moves need, and it would be a second copy of the kind beside the stored one R3 removes.
    Classic's list (`/api/me`) left Weekly Calls, Weekly Bingo and games of questions out by the type field in SQL (`NOT IN (...)`); it
    now reads each league's settings (only them: `jsonb_build_object('settings', ...)`, all the route ever read of a state) and leaves
    them out by their pieces (`classic-list.ts` `inClassicList`). That sends less than before: the route sent every listed league's
    whole state (20-40 KB) and now sends settings only, the three kinds' included. Its label for each game ("Active Roster") is still
    the league type's name: a screen's words, R3's (the preset's name), so the me route moved from part 2's lines to R3's.
  - **What reads differently:** nothing on today's games. One edge, said here: a league whose settings can't be read at all now lists
    in classic (as any such league did), where a broken one with one of the three types was left out by the SQL.
  - **The guard** (tests/pieces.test.js): part 2's lines are gone; R3's list is seventeen files (couch-joins.ts off it, the me route's
    label on it). It also fails on a type id written into a SQL filter on the stored type (`->>'leagueTypeId' ... NOT IN ('weekly-calls',
    ...)`, on one line or across a query's lines); a filter by ids passed in (the desk's search by a game's name) is the screens', R3's.
  - **Proof:** `tests/pieces.test.js` (7: Weekly Calls, Weekly Bingo and two games of questions through the pieces, each scoring nobody
    in the state; every kind of league and every game the tracker plays, by its fields and carrying its spec, chosen by its pieces exactly
    as its stored type chose it, for the home's moves, the Games tab and classic's list, from its settings alone too; the guard shorter);
    `npm test` 1156; `tsc` and `eslint` clean; the tracker regenerated (183 ✅, unchanged) and `--check`. `game-specs-flag.js check`:
    PASS, 9 of 9 (this lane's database, the flag on). The golden replays against the code before the part (`golden.js`,
    `--before=HEAD`, after the review's fixes): 7 seasons, 160 games, 19,361 reads, every one the same; against master's (production's
    engine, `--before=master`): the same, 7 seasons, 160 games, 19,361 reads. The blind replays (`blind.js run`): every game played through and over on all five seasons, as after part 1 (Survivor 49 110 of
    110, The Challenge 41, 40 and 39 81 of 81 each, The Traitors 4 79 of 79; the questions waiting on early results finding 20's 3, 2
    and 2). Every league in
    this lane's database read as `/api/me` reads it now (settings only, by the pieces) and as it did (whole states, the SQL filter, the
    league type's name): 9 of 9 the same. On the zt_nd_ fixture through the app (this lane's server, `--api`
    where a check has it): the episode's games (189: Weekly Calls' move on the home and its going once made, classic's list leaving
    Weekly Calls and Weekly Bingo out, Weekly Calls' and Weekly Bingo's tables, over at the season's last show), the Prediction Sheet
    (70: the home's sheet moves, its table and finale predictions), the desk's bingo (79), the bingo bank (127), more questions (24),
    head to head on answers (28), co-op (22) and the hub (77: its standings and Up next), all passed. (Two of the hub's browser steps
    timed out once while golden ran beside it, a page's slide-in and a deck's fill; 76 then 77 of 77 on the runs after, the last on a
    quiet machine.)
  - **The code review** (`/code-review` at high, on the diff before the long runs). Fixed: the home reading the states beside
    `dueMoves` (both could fetch the same states in full on a cold cache: now after it, a hash each); `/api/me` fetching the three kinds'
    whole states to throw them away (settings only now, for every league); classic's names copied into a second table to keep the label
    off the league type (the label stays the league type's, R3's); the guard's SQL check missing a filter split across lines (it reads
    the query whole). Kept, said here: the two moves each taking the states map (each chooses its own games, as before; the map covers
    every game with a season, the only ones either ever made a move for); a desk search by the stored type's ids (R3's, above).
- **R2.** The game-specs flag on in production (the user's OK), then a week of watching every table. **Done 2026-10-30, 2:39 PM**
  (the main folder's `.session-loop/flag-on-prod.ps1`, the user's Copy and Enter: the read-only check passed on all 10 leagues,
  then 10 of 10 carry their spec); the week of watching runs to 2026-11-06.
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
- **G4. Randomize, no UI** (the user, 2026-10-29; the wizard's other door, above). `rollSpec(ctx, locks, seed)` in
  `src/lib/game/game-spec/`, pure like the rest: a seeded roll over the spec's vocabulary within the context pack, the locks
  held, our check the gate (a roll that fails is rolled again from the next seed, a bounded number of times, then the nearest
  it found with why). Taste: a twist budget (each piece weighed; one or two twists a roll), weights toward what the tracker says
  plays, a length that fits what's left of the season. The short form in `describeSpec`, beside the sentence: a title and one
  line, with a cap on its length. Proof: thousands of seeds on every taped season, each roll passing the check and playing to
  the end in the blind replays (F4's `blind.js`); the same seed and locks make the same game; every lock holds; every short
  form fits its cap. After A14 (the pieces it rolls) and before U0, so the mocks show real rolls. No migration: a rolled game
  is an ordinary spec.

**V. Game pages, generated** (the user, 2026-10-30; "The Games tab and game pages", above).
- **V1. The page generator: a research spike, then a prototype** (heavy; likely two sessions). First how others turn data
  into screens: server-driven UI (screens described as a tree of known components), schema-driven forms, generative UI over a
  component catalog, design systems' composition rules; what holds at thousands of shapes and what breaks. Then ours: a
  catalog of blocks (the brief, your move, where you stand by how the game ranks: a table, a matchup, a bracket, teams, lives,
  stages; this week; what's happened; the rules; the maker's controls), each reading `game-view.ts` and saying what it needs;
  the rules that pick and order them by the spec, the game's state (not started, early results, mid-season, behind on
  watching, out, ended, archived) and the seat (a player, the maker, someone behind); how each block reads empty, early or
  corrected; the Games tab's overview and launcher from the same blocks. Out: a written recommendation, a prototype that
  renders any spec's page on a real season (plain styling is fine), and a playground in the engine lab: turn the dials, or
  roll once G4 is in, and the page changes at once. It decides nothing a person sees; V2's review and U0 do. The research can
  start any time; the prototype after A12, when the view's shapes have settled.
- **V2. The first look.** About ten pages picked to differ (a draft by points, head to head with playoffs, a pool with lives,
  co-op, teams, a game of questions, stages), on taped seasons at 390, Night and Studio, through `scripts/dev-test/`'s
  headless browser. The user reviews the UX; the blocks and rules change; again until the shape holds.
- **V3. The review set: a few hundred unique games.**
  - **Chosen, not random:** a covering array over the dials (every pair of choices in some game), the tracker's rows and G4's
    rolls; each passed by our check and deduped by its canonical spec.
  - **In states and seats:** each game at a few moments of a taped season through the blind replays (before it starts,
    Episode 1, mid-season, the finale, ended), as a player, the maker and someone behind; zt- seats only, and the screens
    kept outside the repo (it's public).
  - **Machine checks first, on every screen:** no sideways scroll at 390, nothing clipped or overlapping, tap targets,
    contrast and an axe pass, no empty labels, "undefined" or NaN, and no spoilers for someone behind (the blind replays know
    what each seat may see).
  - **Looks, not screens:** screens with the same blocks in the same order are one look; a person reviews one of each, plus
    what the checks flagged.
  - **Claude's first pass** (the Claude Code CLI on this PC, never the site's keys) against a rubric: the next move clear at a
    glance, the brief readable, each archetype (`docs/ARCHETYPES.md`); the looks ranked worst first.
  - **The user's review in a gallery:** each look with keep or fix and a note, stored where the lane fixing them reads the
    verdicts back (an Artifact with a database, or a desk page).
  - **Then golden screens:** the set renders again after every change and is diffed, so a fix in one block can't quietly
    break two hundred games.

**U. The UI, last** ("it can get complicated": the user, 2026-10-28). Simple on top, powerful underneath (The wizard, above).
- **U0. Design.** Impeccable `shape`, then mocks in `.impeccable/mocks/start-a-game/` at 390: the wizard and everything listed
  under it above (was G0), answering questions and their results (was A4's), the live pieces with the watch along (A15), the
  sports screens (track L's: the scorebug, the live box score, the couch's play feed, players organised, the matchup, sync,
  each format's own; was the sports plan's step 0), the Games tab (its overview and launcher) and the frame of a game's page
  (on track V's blocks and the looks V3's review kept), and the few controls the pieces need. Everything else is reached by words.
  Randomize is designed with the wizard (its door, the lock chips, Roll again and Back, the short form), on G4's real rolls.
  The user confirms before anything is built.
  **The sports screens' brief** (the sports plan's step 0 prompt, kept here 2026-10-28 so it isn't lost): phone first at 390 in
  the Lower Third flavour, bold choices that make organising and a fast workflow a pleasure. The live game on the show space
  (the scorebug, the live box score with the couch's players lit and their points ticking, the couch's play feed); the later
  watch's sync (Start, pause, ±30 s, "Tap the last play you saw"); the players list by team and position, sorted by stat chips,
  with a player sheet; one format first, head-to-head. Light inspiration from the MLB app, Yahoo Fantasy and Yahoo Sports. Ask
  the user before deciding anything the plan leaves open.
- **U1. Build.** The field and the wizard in Start a game, Start from a spec, Make it a game chained for a show that isn't set
  up (was G2); answering and results; the live and sports screens; the Games tab's launcher and the game pages from track V's
  generator (V3's golden screens their check); checked at 390 on Night and Studio with a zt- fixture.

**L. Live sports:** the steps are in "Live sports in the same engine", above (L1–L6, the Sports lane).

**Suggested order** (revised 2026-10-28): S1 → S2 → A1 → A2 → A3 → A4 (all built or building), S3 once proven, then A5 (the
tracker) → A6 → … → A12 part 1 → R1 → R2 → R3 → A12's other parts → A13 (A14 if allowed) → A15 → U0 → U1 (R pulled ahead, 2026-10-30; R2 and R3 wait on the user, so the Engine lane goes on to A12's other parts once R1 is built). Alongside: G1 from A5, G4 between A14 and U0, track V from A12 (V1's research any time; V3 adds G4's rolls once built); track L in the Sports lane
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
  **2026-10-28:** the user approved the desk's steps 1–7, so the desk lane (`rfl-desk`, port 3003; made and checked) takes this
  slot at the weekly reset, Thursday 2026-10-29 at 4 PM ET, sports stopping after its session then. The switch's four
  commands are in PLAN-desk-parity.md, The build lane.
- **When there's room:** G1 (needs A5). A third lane only after a weekly reset, with the week mostly unused.
- **Never unattended:** design (the desk's, U0), merges into master, pushes.
- **Before a weekly reset, use what's left** (the user, 2026-10-28: "cranking it, safely"). The allowance doesn't carry over, so the
  main session fills the slots with work that's safe unattended. It doesn't stack more than the user's own session can bear by day,
  since a full 5-hour window pauses that session too, and it keeps the loops' 90% stop. On 2026-10-28 that meant the engine lane
  going on past A6 to A8, the A1–A4 merge prepared and checked in a throwaway worktree (`rfl-merge`, port 3006, branch
  `merge-engine`), and the desk's build as a lane once its first designs are approved. That evening, with A8 done, the user
  sent the engine on through A9–A14 overnight, one fresh session a step, stopping before A15 (the watch along's concept is
  still open). A step that needs the user partway leaves its question in its Noticed, and the next step goes on. At 7:45 PM
  the user started the desk's build early (its lane was set up for Thursday's reset): it took sports' slot, sports stops after
  L5 part 2 (a STOP file), and the keeper watches the engine and the desk.
- **No big merge on an episode night** (the user, 2026-10-28). A push to master deploys production and runs its migrations,
  so a big merge or a migration doesn't ship on the evening of an episode the couch plays (Survivor 51: Wednesdays, 8 PM
  ET). The A1–A4 merge moved to 2026-10-29, after that night's results are accepted and the test couch is compared. A small
  push that's been checked is the user's call: that evening, before the episode, they pushed four small app files (no
  migrations).
- **R ahead of the rest of the engine** (the user, 2026-10-30, 11 AM: "the sooner we know the game data structure is stable
  the sooner we can move away from the stored game rules and structure"). Today's games go onto the spec first, starting with
  the couch's Survivor 51 games: the Engine lane finishes A12 part 1 and goes to R1 (Survivor 51's three kinds first), then
  A12's other parts, A13, A14. The **Survivor lane** (`rfl-survivor`, port 3001) builds the proof both need, the Survivor 51
  season-forward rehearsal (`scripts/dev-test/season-forward.js`: the couch's real games from a production backup played
  past Episode 6 through swaps, the merge, a medevac, idols, a double boot, the daylight-saving week and the finale; flag off
  against on, old engine against new, screens at 390), seeded from `.session-loop/seed-s51-forward.md` in its folder. Then:
  the main folder merges it, turns the game-specs flag on in production (R2) with the user once it passes with the flag on
  (not on a Wednesday), and merges R1 only after it passes the rehearsal too. Sports stays stopped until Monday, as planned.
The main session records each switch here.

**The rules that keep the quality:**
1. **One lane, one folder, one database, one port.** The dev-test fixtures (zt- rows) and migrations would collide on a shared
   database, and two checks on one server trip over each other (the testing bank's rule: never two checks on one fixture at
   once). A lane's `.env.local` points `AUTH_DATABASE_URL` at its own copy and `BETTER_AUTH_URL` at its own port, and its checks
   run with `BASE=http://localhost:<port>` (every `scripts/dev-test/` check reads both).
2. **Migration numbers by range**, as the new-design branch did with 0100: master 0155–0199, engine 0200–0249, GPT words
   0250–0279, survivor 0280–0299, sports 0300–0399, playtest 0400–0419, desk 0420–0449. `db/migrate.js` runs them by name, so ranges never
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
- **Open, for their steps:** the reliability bar for a new research question (high only, or medium too: the user leans medium, 2026-10-30, in the Decisions table's "Custom moments"); points per question by
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
  lane's floor), so a step's "scores exactly as before" is shown engine against engine on the same kept leagues. Taken after
  A8 (42345eb6): `node scripts/dev-test/golden.js`, the code at HEAD against the working tree, on every season loaded here.

From A8 (2026-10-28):
- A vote split at an ordinary Tribal can't be settled: research asks `votesReceived` per person, but no moment counts it, so it
  never reaches a league. A per-unit "votes received" moment in Survivor's rules would. (A13's episode facts, or S3.)
- Pairs aren't stored: they're drawn from who's in at the game's start on every read. A cast correction before the start draws
  them again, and answers for the old pairs count for nothing (never against another pair). Store them at the lock if that
  ever matters. (Whoever next touches pairs.)
- A wager can take a player's total below zero; tables show it as it is. (U1, to say why.)
- Orders, confidence, chips, splits, pairs and wagers have no controls on the sheet, and computer players answer none of them
  (as A4). (U1.)

From A9 part 1 (2026-10-28):
- **A question for the user (with a recommendation):** "only the only one right" is per player: on a question naming several
  (who makes the final three), two players each alone on a different right pick both score nothing. Per pick ("each right pick
  nobody else named") reads closer to "you only score if you're the only one who called it" there. Recommended: per pick for
  names, per player for everything else; it's a small change in `windowPoints`. (G1 or the user's call; part 2 can take it.)
- A split pot's shares are rounded to the cent, so a pot of 10 three ways gives out 9.99. (The user's call, if it matters.)
- An unclaimed jackpot is lost at the game's end, and a window that didn't count (nobody went home) rolls over like one nobody
  got. (G1, if a game wants otherwise.)
- A stake of any of your points is checked when it's given: a result corrected later can leave a total below zero, as A8's
  wager can. (U1, to say why.)
- Parlays tie questions asked the same way (the same windows); one across windows ("the boot this week and the winner") isn't
  a parlay. (G1, if it's asked for.)
- A shrinking call is only one open once the game is on (who wins, who makes the final few, closing at the finale). A15 moves
  `late` to the runtime for live calls.
- `check-questions.js` (and any check that reads Tonight's Extras on new-fixture.js) fails from 8 to 9:30 PM ET: the fixture's
  ZT Survivor 51 airs at 8 PM ET for 90 minutes, the check moves Episode 6 to today, and Tonight hides its Extras while an
  episode is live. Run it outside that window. (Whoever next touches new-fixture.js.)
- The sheet has no controls for A9's parts (a jackpot, a stake of any of your points, what a shrinking call is worth); the read
  gives them. (U1.)

Taken by A9 part 2 (2026-10-28): part 1's question for the user ("only the only one" per pick for answers naming people), as
recommended.

From A9 part 2 (2026-10-28):
- **Exclusive only when the pool covers every pick isn't counted yet** (the 9:10 PM decision): `specProblems` has no pool or couch
  size in its ctx, so it never refuses an exclusive draft of 12 × 3 from 18 castaways, nor counts a shrinking pool (a later stage,
  a side draft, group slots). The GPT's check is to make it shared, with the reason as an assumption. (A10, with the pool's
  pieces: a ctx with the pool's size and the couch's, and unit tests for the shrinking case.)
- No screen names a captain, and best ball still gets Weekly Lineup's lineup tab in the new design (`moves.ts` keys it on
  `active-roster`), whose saves the route refuses. Classic's screens read `hasActiveRoster` false as Outlast's (the episode
  lines, the standings card). Start a game and Game settings offer none of part 2's parts. (U1, or Step C for classic.)
- Captains are in everyone's copy before the lock, as lineups are: hiding starters until the lock is a screen's courtesy
  (`lineup-page.tsx`), so a screen for captains has to hide them with the starters. (U1.)
- `playerEventRows`, `castawayEarnedStats` and `castawaysEverOwned` (`active-roster-rows.ts`) count lineup starters at the
  rulebook's points: a captain's double, an episode's multiplier and best ball's counted ones aren't in the Scoreboard's per-event
  rows. The totals, the week and the episode lines are the engine's. (U1.)
- Best ball's team for an episode trusts the mid-season log: someone moved onto a team by hand (a commissioner's reassignment,
  which logs nothing) reads as held from the start. (Whoever next touches ownership or waivers.)
- Reverse counts the cast as it stands: a castaway added mid-season (The Challenge's newcomers) moves every reverse score by 1,
  and the first one out scores the cast's size then. (F3, or A10 if it matters.)
- A phase start confirmed late moves points already scored: the episodes from its start on take its multiplier when the desk
  confirms it (data settles where it starts, as it should), so a table changes after the fact. (U1, to say why.)
- Points that multiply by when are for drafts scored by moments only: "the finale's questions count double" in a game of
  questions, and a pool's double points, aren't built. (G1, if they're asked for.)
- Best ball's waivers can't "replace only when short" (short of its best n): they replace right away, as Outlast's. (A10, if
  a game wants it.)
- A late joiner's captain goes through `GhostLogic.applyAs` like their lineup, but no check plays it. (A11's late joiners.)
- The Challenge 40 was mid-recording (the playtest lane) during this step, so the golden replays covered the five seasons
  loaded here; load it (`tapes.js load the-challenge 40`, with `LLM_BROWSER_API_URL=http://127.0.0.1:8765`) once it's whole.
  (F1, which studies it.)
- `/code-review` ended the session twice when started here. If it happens again, the review is done by hand and recorded.
  (The session loop's keeper, or whoever next looks at it.)

From F1 (2026-10-28; the details in [STUDY-format-changes.md](STUDY-format-changes.md)):
- **Questions for the user (each with a recommendation; F3 and A10 build on them):**
  1. Does someone going home end their group? Recommended: no for a tribe or a team, yes for a pair (one person isn't a pair);
     any join or move ends it. (F3, A10.)
  2. A group shown at an episode's end that changes before the next one starts (The Challenge 41's Cara Maria & Leo, Theo &
     Dee), with a slot already picked on it. Recommended: the slot is void for that episode, no points either way, and
     reopens for the next. (A10.)
  3. A group that changes mid-episode (The Challenge 41's claim in 16). Recommended: the group in force at the episode's start
     scored it (a slot keeps those points) and the slot drops after it. (A10, A12.)
  4. The same members together again later. Recommended: a new group, not the old one carrying on. (F3.)
  5. "Major" by default for a stage started by a change. Recommended: teams formed, pairs formed, split into individuals, the
     merge, and a swap where every group is new. (A12, the format-change design session.)
  6. The change vocabulary, the format state's shape and the prompt section (the study's proposals). (The user, at F2's
     merge.)
- The Challenge's built-in format calls its groups "agency" (from *Spies, Lies & Allies*), and every Challenge season's prompt
  uses it ("If agencys were swapped..."): the group's word should come from the season (pairs, teams, eras), and the plural
  is spelt by adding "s". (F2.)
- A newcomer (The Challenge 41's Jonna Mannion, an alternate from Episode 5) is never in a season's cast, so research never
  had an entry for her and nothing could give her a result, a group or an exit. (F2: `newcomers`; F3 adds them to the cast.)
- A wrong exit cascades on the tapes: The Challenge 41's Episode 11 full research had Leo and Will leaving (citing later
  episodes) instead of Gabe and Jonna, so the next prompts left Leo and Will out (their real exits in 14 and 16 couldn't be
  reported) and kept Gabe in; Episode 12's kept Dee in (a pair goes home together from Episode 10); Episode 11's quick check
  found nobody though its headline names Gabe and Jonna. (The playtest lane's report; F2's `wentHomeAs` gives our code a
  check: a pair's exit with one partner reported.)
- Survivor 49's research on tape is production's, stored before `newGroup` and `merged` existed: its swaps can't show today's
  prompt. (F2 asks episodes 3-8 again.)
- The Challenge 39 isn't on tape (the recorder hadn't reached it during F1); its timeline is in the fixtures under
  Wikipedia's short names. Once it's recorded, `format-study.js` reads its research as it does the others' if its fixture's
  names are moved to the tapes' cast names. (F2 or F4.)

Taken by F2 (2026-10-29): F1's "agency" plural (the format section never says it; newGroup's paragraph spells it right), a
newcomer's place (`newcomers`), the pair-exit check (`wentHomeAs`), and Survivor 49's episodes 3-8 asked with today's prompt.

From F2 (2026-10-29; the results in [STUDY-format-changes.md](STUDY-format-changes.md), "F2: the format section asked again"):
- **For the user, at F2's merge:** the vocabulary, the state's shape and the prompt section, as built (recommended: as they
  are). Two choices inside it, each with a recommendation: `role` stays one of the kinds (yes: The Traitors' recruit, which the
  engine already acts on, would otherwise be only a twist), and a whole team going home together is `wentHomeAs`, not a kind
  of change (yes: it changes who's left, not how people are grouped).
- `newGroup` and `merged` are still asked beside the section, since a live season's staging reads them; the two can now
  disagree (the review reports it). Once F3 reads the state, both can be worked out from it and leave the prompt, with this
  proof's numbers on how often they agreed. Their paragraph still says the format's built-in word for its groups ("agency" on
  The Challenge) and asks about the cast's labels (Vets / New Threats). (F3.)
- A newcomer the section names isn't added to the season's cast, so they still get no checklist entry, result or exit; the
  groups going in carry them from episode to episode. (F3.)
- The groups going in come from the stored combined answer of the latest earlier episode that knows them; an earlier episode
  asked again (a correction) changes the next prompt, but the episodes after it aren't asked again. (F3: a corrected report
  works out everything after it.)
- The cross-check (`crossCheck`) is worked out by the scorer only: nothing stores, per episode, which changes both sides saw
  and which are unsure. (F3, with the state over time.)
- The tapes' wrong exits stay in this lane's database (`stillInGame` reads the loaded research): The Challenge 41's Nia Moore
  (out in Episode 3) is still on its list from Episode 4, which the section's coverage check flags in every answer ("still in
  but in no group"), and Leo and Will are off it from Episode 12. (F4: a blind replay starts from the fixture's exits.)
- At an episode's end, a change that takes effect at the next one's start (Survivor 49's swap at Episode 4, The Challenge 40's
  teams at 3) can be answered either way by a recap written later; the scorer counts either. Which the engine believes is
  `changes[].from` and `when`. (F3.)
- What the proof found for F3 (the study's "What it means for F3"): `newGroup` named a new tribe for 1 of the 11 people
  who changed tribe at Survivor 49's first swap, and none at the merge, where the section had every tribe exactly; a pair
  going home together came back as `individuals` twice (exits and the groups going in say it better); an answer listed a
  label (The Challenge 40's eras) as its groups while saying everyone now plays alone (the review now flags an answer that
  contradicts itself); an individual episode between paired ones can't be seen from two paired states without `playedAs`;
  twists are noisy (most of the 15 changes listed that aren't in the fixtures), which costs nothing while a twist never
  moves a game's structure. (F3.)
- The tapes recorder reached The Challenge 39 on 2026-10-29 (Episode 5 by 05:40 UTC). Its fixture is under Wikipedia's
  short names; F1's note on renaming them stands. (F4.)
- The quick check (`bot-research.js` `buildQuickPrompt`) doesn't ask the section: a format change is known only from the full
  research, about 9 hours after an episode. Fine for a change acted on at the next lock; not for anything sooner. (A12, if a
  stage must start before then.)
- The prompt is longer (The Challenge 41's Episode 6: about 29.1k characters, against 20.8k on its tape, most of it the section's schema) and so are the
  answers took about twice as long (136 s against 71 s on The Challenge 41's tapes; the longest 198 s), nearer the app's
  285 s stop for a bot answer. If production's runs time out, the section's JSON schema (most of the added length) could be
  shown as a filled example only. (Whoever watches the bot's research budget after the merge.)

Taken by F3 part 1 (2026-10-29): F2's `newGroup` and `merged` beside the section (tribe moves worked out from it, `newGroup`
asked beside it only for whoever moved and went home the same night; `merged` stays), the cross-check worked out per episode (the timeline, from stored research each
time it's read), a corrected report working out everything after it (the timeline; the prompts aren't asked again), which
the engine believes for a change at an episode's end (`effective`: its `from`, else its `when`), and what F2's proof found
for F3 (`playedAs` with the groups, a contradicted answer unsure, whole groups home from the exits, a twist never moving
anything). F1's questions 1, 3 and 4 taken as recommended (still the user's to confirm, with 2 and 5, below).

From F3 part 1 (2026-10-29; the proof in [STUDY-format-changes.md](STUDY-format-changes.md), "F3: the state over time"):
- **For the user, at the merge:** tribe moves from the section, with `newGroup` asked beside it only for whoever moved and
  went home the same night (production's research asks it of everyone today, so Survivor 51's next swap would stage its tribe
  moves from the section). Recommended: yes, with the numbers above (11 of 11 and 6 of 6 against 1 of 11 and 6 of 6;
  partners' names as tribes on The Challenge).
- A pass about some of the cast (a commissioner's paste) leaves the section out and asks `newGroup` of everyone, as before
  F3: its answer replaces those people's entries, moves and all, while the stored section stays the whole cast's. (Fine
  while such passes are rare; F3 part 2 could work the moves out again from the stored section for them.)
- The line before the section still says the show's own word for its groups ("The agency after each name ...", "the agency
  they went home from" on The Challenge, from its show row) beside the cast list's labels (Vets / New Threats), while the
  schema's `newGroup` says the format's ("team") and the section says tribes, teams or pairs. (F3 part 2: one word, the
  season's.)
- A move staged in an episode puts someone on the new tribe for that whole episode, whether the change came at its start
  or its end, as `newGroup` did ("the tribe they are on at the END of this episode"); the timeline knows when it came. (A6's
  next reader, if a question about an end-of-episode swap's episode matters.)
- **For the user, in the format-change design session (after A12), each with a recommendation:**
  1. Each reader's fallback by default (a group question, a group slot, a side stage, a team): recommended 'void' (no
     points either way for an episode whose groups aren't sure) for questions and slots; carry on for teams that follow the
     people; the next stage only where a spec asks for it.
  2. Does one tribe of everyone (the merged tribe) count as a grouping for a side stage? F1 counted it (a side draft after
     Survivor 49's 8); the timeline doesn't (everyone's in it). Recommended: no.
  3. A side stage whose grouping held N episodes but changed at the next one's start (Survivor 49's swap tribes, after 5)
     opens and closes having scored nothing. Recommended: open it anyway (live, nobody knew), and say so; or wait one more
     episode before opening (fewer empty stages, later ones).
- A group formed partway through an episode that then went home whole (The Challenge 41's claim in 16: Aviv & Will) isn't
  seen: the section's groups are at the end, and they've gone by then (`wentHomeAs` ours said individuals there). (A12, if a
  game scores it; or the section asking who went home with whom.)
- Who went home in an episode whose groups changed at its start isn't placed in its groups (the end's groups don't have
  them), so a group answer about them is off, as A6 has it today; Survivor's Tribal check knows for a swap. (A6's next
  reader, F3 part 2 if it matters.)
- Neither `newGroup` nor the section named the merged tribe (Lewatu), so the merge moves nobody's tribe, as before; the
  merge's phase comes from `merged`. The section could ask the merged group's name by itself. (The user, at the merge; G1.)
- The timeline isn't stored: it's worked out from stored research each time it's read (one query a season). If a reader
  needs it per request, cache it by the research rows' times. (F3 part 2, A10.)
- `formatGoingInto` (the prompt's groups going in) is still the latest earlier stored answer that says who is with whom, not
  the timeline's `goingInto` (which drops who left since and knows when it isn't sure). (F3 part 2.)
- Newcomers are in the timeline (`castAt`), but still not in the season's cast or research's list, so they get no
  checklist entry, result or exit; and A9 part 2's reverse count moves when one is added. (F3 part 2: research asks about
  them; adding someone to the cast every league sees stays a person's, a cue on the desk.)
- Episode 1 has nothing before it: the cast list's groups (maybe only a label) are never taken as the state going in, so
  the premiere's own answer is the first state (its groups played it unless it says a change). A blind replay passes what
  was known before the premiere as `start`, unsure. (F4.)

Taken by F3 part 2 (2026-10-29): the timeline from the database (read, not cached), `formatGoingInto` from its `goingInto`,
newcomers into research (asked about, staged at the season level, a cue for the desk), one word for the groups beside the
section, A6's group question on a paired season, and a partial pass's moves from the stored section.

From F3 part 2 (2026-10-29):
- **For the user, at the merge (with F2's section):** the prompt's new words: the line beside the names when their groups are
  only a label (The Challenge, once the timeline knows its pairs), the season's tribe or team when the timeline says it, the
  line when the groups going in aren't sure, and newcomers on the checklist from the episode after they came in (production's
  research would start asking about someone the cast doesn't have). Recommended: as built.
- **For the user (production data, the desk's):** The Challenge's show row says its groups are an "Agency" (`shows.tribe_term`,
  from *Spies, Lies & Allies*), so its premiere and any episode before the timeline knows its pairs still say "agency".
  Recommended: change it to "Team" on the desk (the word is the show's data; the code no longer overrides a show's word).
- **For the user, in the format-change design session (after A12):**
  1. A group question's fallback by default (`ask[].fallback`): recommended `void` (no points either way when the pairs at
     the lock or as played aren't sure, and a re-drawn pair's pick void), as built; `carry-on` (follow the people) where a
     maker asks for it.
  2. The pairs come straight from research's format section, which nobody reviews (Survivor's tribe moves are staged and a
     person accepts them; pairs never are). Recommended: as built, "sure" being the guard (our comparison agreeing with the
     answer, F3 part 1: 11 of 11 sure changes right), with the timeline shown on the desk for a person to see, and a wrong
     pair put right by asking the episode again (everything after it works itself out on read).
- Group ids are the timeline's (`<episode shown>:<members>`), and `game_answers` stores them: a corrected answer that changes
  the episode a group was first shown changes its id, so a pick made on the old one reads as a group that didn't play
  (void). Safe, but a correction voids those picks. (A10, whose slots need ids that last: key a group by its members and
  first episode played, or keep a map from old ids to new.)
- A group question asked once or over a window on a paired season reads the league's own groups (The Challenge's labels,
  Vets and New Threats). (G1's check, or A6's next reader: refuse it there, or read the timeline over the window.)
- A newcomer the desk adds under another spelling than research's would be asked twice (research's name and the cast's):
  the context matches newcomers exactly. (The desk's step 5a, cast: add them under the cue's name.)
- Reverse (A9 part 2) still counts the cast as it stands: a newcomer moves every reverse score only once a person adds them to
  a league's cast, which nothing does yet. (The desk's add-to-cast step: record the episode they came in, and count the cast
  at each castaway's exit.)
- `formatGroupsFor` reads the season's research once per grading read of a game that asks a group question each episode (the
  couch hub reads its standing twice a game, a reveal three times): one small query each. A short memo was tried and dropped
  (it graded on a timeline from before research that had just landed). (The merge: a line in HOSTING.md; a cache keyed by the
  research rows' latest time if it shows.)
- The Challenge 39's research is whole on tape (21 quick, 21 full, 2026-10-29 07:00 UTC; its bingo still recording) but not
  loaded in this lane's database, so the golden replays skip it. (F4: load it, and move its fixture's names to the tapes'.)
- newGroup's description on The Challenge says the format's word ("team"): a someone-moved-and-went-home answer on a paired
  season could still name a partner as a team, which stages as a tribe move. (F4 shows whether it happens on the tapes; the
  section could then stop asking newGroup on a season whose groups going in are pairs.)
- A paired season's premiere lock reads the league's own groups (labels on The Challenge): nothing is known going in until
  the premiere's research. (F4's blind replays pass what was known before the premiere as `start`; the game could do the same
  from the previous season's format, or void a group question at the premiere.)
- The sheet doesn't show `offWhy` (an unsure lock is an empty picker), and a known verdict with no right pair is an empty
  line. (U1.)
- A pair whose members all went home in an episode with a re-draw at its start is taken to have played as offered (nobody
  else was with them at its end); two partners re-drawn apart who each went home that night would read so too. (F4, if the
  tapes show it.)

Taken by F4 (2026-10-29): The Challenge 39 loaded and its fixture under the tapes' cast names (the golden replays read seven
seasons); a blind replay starting from the fixture's exits (The Challenge 41's Nia Moore, Leo and Will); F3 part 2's three
items for F4, settled from the tapes (below); and F3 part 1's premiere item (a blind replay's games are made before the
premiere, with nothing of its format known).

From F4 (2026-10-29; the results in [STUDY-format-changes.md](STUDY-format-changes.md), "F4: blind replays"):
- **F3 part 2's items, settled from the tapes:**
  - `newGroup` naming a partner as a team on a paired season: production's prompt never did, in 63 of The Challenge's full
    answers on tape (41, 40, 39); F2's prompt (asking it of everyone beside the section) did, 22 times in The Challenge 41's
    Episode 9, and F3's code already drops them (the section's pairs speak for whoever they place). Nothing to change.
    But The Challenge 39's tapes name "Blue Team" and "Orange Team" (18 times) and "Individual" (15): a name like
    "Individual" for someone the section doesn't place would be staged as a tribe of that name. (A10, or whoever next
    touches movesFromState: read "Individual" and the like as on their own; the section's own `alone` says it better.)
  - A pair voted out together at a re-draw: it never happens on the five seasons (The Challenge 41's nine whole pairs, in 10
    to 17 and 19, all went home with no re-draw at their episode's start; the one at 16 is the claim's own pair, formed
    partway). Left as built.
  - The premiere of a paired season: its group question offered the league's own groups (The Challenge 41's Vets and New
    Threats), and since each pair is one of each, everyone who answered was right. **Fixed in the grader**
    (`groupFacts`): an episode research says was played in pairs the league doesn't hold, when nothing said so going in, is
    the timeline's with nothing offered, so it's off once its research lands (no points either way). Still open: the picker
    at the premiere's lock offers the labels, since nothing is known then. **For the user (with a recommendation):** read the
    rulebook's `cast.groups.change: often` (data the app has at set-up: The Challenge's "All the time") so a group question
    at the premiere of such a season offers nothing and says why, rather than labels that get voided. (G1, which checks a
    game against the rulebook; or A10 if group slots need the premiere.)
- **Groups the league holds that nobody plays in** (The Challenge 40's eras outside 3-9, Survivor's tribes after the merge):
  **fixed in the grader** (`apartNow`, `noneGoingIn`), as above. Still open, the same as the premiere's: the league's own
  groups stay its own after a split (the eras, the pre-merge tribes: the merge moves nobody), so a question asked over a window
  or once (which reads the league's groups, F3 part 2's item) still offers them. (G1's check, or A6's next reader.)
- **A group question on the league's own groups, at an episode whose groups changed at its start, is graded on the new groups
  by name.** The Challenge 39 draws named teams at the start of nearly every episode (Blue, Red, Team 1 to 6, Orange...), each
  staged as tribe moves on Autopilot, so its lock offers the teams the league then has and the episode is graded on its new
  ones: at 7, 8, 11 and 14 the right team wasn't on offer, so nobody could be right, and at 13 it was by name only (Team 1 to 4
  drawn afresh each episode under the same names). Survivor 49's swaps read the same: at 4 the old Hina,
  Kele and Uli were offered and the new Kele was right by its name (members all new), a pick of the dissolved Uli wrong, not
  void. (The pairs on the timeline already void a pick of a group that didn't play as offered.) **For the user, with the
  format-change design session's defaults:** recommended, read the timeline's `played.held` for the league's own groups too,
  so a pick of a group that didn't play the episode as offered is void (no points either way) on Survivor's swaps and The
  Challenge's drawn teams alike, and offer nothing at the lock on a season whose rulebook says its groups change all the time;
  the other way, keep grading a tribe by its name (Survivor's players may expect "Kele won" to count). (A10, whose slot per
  group reads the same groups at a lock, or a part before it; it changes Survivor's grading at a swap, so the default is the
  user's.)
- **Survivor 49's premiere offered no tribes:** its cast has them (Hina, Kele and Uli, six each), but "which tribe wins
  immunity" had nothing to pick at the premiere's lock in every game asking it (from Episode 2 on it offered the tribes), and
  was graded on them after. Not traced in F4: perhaps the view before anyone has seen an episode. (A6's next reader.)
- **A question about the finale never settles** (The Challenge 41: its group question and the week's points leaderboard): the
  finale's results stay early (the playtest report's finding 20), so its moments never come in, and a question about it waits
  after the game is over. A grader fix (off once the game is over) was built and taken out at the code review: the game is over
  as soon as the finale's early results land, so it would have read every finale moment question off through the hours before
  the full research, on every finale night. Nothing in the data says "the full research came and went", so the fix is finding
  20's: the full research, applied with nothing more to score, should still take the early mark off. (The survivor lane, with
  `season-decisions.ts`; the blind replay reports these as "waits on early results".)
- **Episode 2 of a season in rotating pairs is always void by default:** the premiere's report has nothing before it to check
  its changes against, so the pairs going into 2 are never sure, and a group question asked with `fallback: 'void'` is off
  there (following the people, it offers them). **For the user, in the format-change design session:** keep it void (safe:
  one episode a season), or count a premiere's groups sure when the answer agrees with itself (the risk: an answer's pairs
  wrong at the premiere would be graded). Recommended: keep it void; the wizard can say so.
- **The claim at The Challenge 41's 16** (a swap partway through an episode, its new pair going home that night) reads unsure:
  at the episode's end only the two partners left behind are paired again, which our comparison takes as filled in, not a
  swap, so the answer's swap is held and the group question void at 17 by default. F3 part 1's proof had it sure because its
  episodes 11-15 were carried on. Safe as it is. (A12, whose triggers read it: two people whose partners both went home that
  night, paired at its end, could count as the answer's swap.)
- **The finale's own split** (The Challenge 41's 19, everyone placed): our comparison sees a split the answer doesn't say, so
  it's held; nothing reads it after the finale. (A12, if a stage could start at a finale: the edge case is already the
  design session's.)
- **The tracker's group question is Survivor's** (which tribe wins immunity, `tribeImmunity`), so it doesn't play on The
  Challenge, whose own moment for a group's win is a daily challenge (`dailyWin`): F4 added its own (`blind.js` OWN). (G1:
  the manual's examples should name a show's own group win; the tracker could carry The Challenge's.)
- **What the blind replay doesn't play:** Weekly Calls (Call it's calls) and Weekly Bingo (the couch's squares) are started and
  end, but nobody plays them (neither is settled by research's format section); a newcomer's results still reach no game
  until a person adds them to the cast (F3 part 2's cue), so Jonna Mannion's pair was offered with Jake alone resolved.
- **The stand-ins.** Of the 88 episodes, F2's own bot answers cover 23; the rest are F1's fixture at each episode's end
  (as research would say it if it were right). The blind replay proves the engine's side through every change; research's
  side is F2's proof. A bot run of the whole season with today's prompt (format-asks.js `ask`, the local bot only) would
  replace the stand-ins when the bot is free: it wasn't during F4 (no reply after 210 s since 07:15 UTC). (Whoever next has
  the local bot to spare; then `blind.js run` again.)

Taken by A10 part 1 (2026-10-29): A9 part 2's exclusive-or-shared count (`specProblems` with `ctx.pool` and `ctx.couch`, and each
group slot opening counted as the pool shrinks), F1's question 2 as recommended (a slot on a group shown that changed before it
played is void for that episode and reopens for the next), and F3 part 2's group ids that last (a slot's pick is found by its
id, else by its members).

From A10 part 1 (2026-10-29):
- **For the user, in the format-change design session (after A12), each with a recommendation (built as spec settings, the
  defaults in `GROUP_SLOTS`):**
  1. How many slots: +1 or +2 (`slots`). Recommended: +1 (a pair or team beside a solo team of five is one more of yours, not
     a second game); +2 where a maker asks.
  2. Exclusive or shared (`own`). Decided shared by default (Decisions: "Exclusive or shared"); built both, exclusive only
     while the groups on offer cover every team's slots (else that opening is shared, `offered.shared`).
  3. Swaps while a group lasts (`swap`). Recommended: no (you ride with it; a slot changes only when its group ends), so a
     pick means something and Conor can't chase each week's winner; yes where a maker asks.
  4. What a slot does when the groups at its lock or as played aren't sure (`fallback`). Recommended: void (no points either
     way), as F3 part 2's group questions; carry-on (follow the people) where a maker asks.
  5. A group's points (`points`): its people's mean, so a slot scores like one more person whatever the group's size, or their
     sum (a team of four winning is worth four). Recommended: the mean.
  6. Who gets a group first in an exclusive opening. Built: first come (each pick under the league's lock). Recommended: keep
     first come while shared is the default; if exclusive matters, the waiver order (least points first) is the fairer one,
     not built.
  7. An empty slot for someone who doesn't pick (the Fan Who Forgets). Built: it stays empty and scores nothing. Recommended: fill
     it for them at the lock with the group holding most of their team, as a lineup carries; the player can change it before
     the lock.
- **On a season that draws its groups at each episode's start, a slot never holds** (the blind replay of The Challenge 39: its
  teams drawn afresh at the start of nearly every episode, so the groups at an episode's end, the ones a slot is picked from,
  never play the next one; every pick void, no points, on the default). Safe, and what F1's question 2 asked for, but such a
  game is a solo draft with a slot that never counts. **For the user, in the design session, with a recommendation:** the
  builder says so up front from the show's history (F1's lifetimes: "on the last three seasons, teams lasted one episode"),
  and offers carry-on there (a slot follows the people picked, so a drawn team's members still score for whoever picked them)
  or a pick each episode (A6's group question) instead. Recommended: say so and offer the pick each episode; keep void the
  default.
- **F4's open question doesn't reach group slots:** slots read only the format's state over time, never the league's own
  groups, so a group re-drawn at an episode's start (The Challenge 39's teams, Survivor's swaps) voids the slot's episode
  rather than grading it on the new group by name. The question (whether a group question on the league's own groups should
  read the timeline's `played.held` too) stays the user's, with F4's recommendation (yes), for the design session.
- A paired season's premiere doesn't reach slots either: a slot opens after the episode that showed its groups, so nothing is
  offered at the premiere's lock (F4's premiere item is the group questions').
- A season before the format section (production's research until F2 merges) has no groups in its timeline, so its slots
  never open: the game plays as a solo draft (carry on with what's left). One group of everyone (a merged tribe) isn't divided,
  so nothing is offered (F3 part 1's question 2, as recommended).
- **Stale groups between a corrected report and the next write:** a game's groups are settled on every write to it, and the
  season sync writes after every result, but research asked again that changes no result writes no league, so the GET and the
  tables read the groups as they were until the next write. (Whoever next touches research's store: settle the season's games
  with group slots when an answer is stored; or the season sync after any stored answer.)
- One query more on every write to a game with group slots (its season's timeline, inside the write's transaction, in a
  savepoint). (The merge: a line in HOSTING.md.)
- The PUT validates against the league as it stands, as the lineup route does: a player behind could pick a group from an
  episode they haven't seen by calling it directly, and its refusal could name one. The GET is at their mark. (U1: offer only
  what the GET returns.)
- Computer players don't pick group slots (bot-logic.js). (Whoever next touches computer players; A11's late joiners.)
- `playerEventRows` and the Scoreboard's per-event rows (`active-roster-rows.ts`) don't have the slots' points, as with A9
  part 2's captains; the totals, the week, the episode lines and the breakdown do. (U1.)
- **No caller passes `ctx.pool` and `ctx.couch` yet**, so the exclusive count runs only where they're given: the engine lab's
  check and G1's context pack should (the couch's size, and the cast still in where the game drafts). The decision says our
  check makes such a draft shared, with the reason as an assumption: `specProblems` refuses it with the reason, and G2's check
  turns that into the shared spec and its assumption. (G1, G2; the lab when it next changes.)
- A slot's group members are matched to the league's cast the forgiving way (`Core.findCastawayByName`), as F3 part 2's group
  questions are, not by the season-cast link (`seasonCastId`); someone it can't place scores nothing and still counts in the
  mean. (Whoever next touches the cast link: match by `findSeasonCastaway` with the season's cast rows.)

Taken by A12 part 1 (2026-10-30): A11 part 4's item 12 in part (a stage that starts at a phase and a game that ends before one are
built; the playoffs starting when research names the final stays with the desk's finale episode); A11 part 4's early ends' dispatcher
in part (`StageLogic.endsAt` sits beside `KnockoutLogic.endsAt` in `lastEpisode`, not inside its dispatch).

From R1 part 1 (2026-10-30):
- **The Survivor 51 season-forward rehearsal still has to pass before R1 merges** (the 11:15 AM note): `scripts/dev-test/season-forward.js`
  isn't on master yet (the Survivor lane builds it). R1 changes scoring for live games, so the main folder merges it only after the
  rehearsal passes (the couch's real games from a production backup, flag off against on, old code against new, every read the same),
  never on a Wednesday. Until then the golden replays (`--before=master` included) are the proof. (The main folder, at R1's merge.)
- **For the user: which rule a preset meets** (A5's item, R1's): Start a game writes its Weekly Lineup without the show's ctx, so on
  rules with moments the couch answers (Below Deck's sample) it makes a game the GPT's check would refuse until those moments score 0.
  Options: (a) presets meet the same data-can-settle rule as any spec (Start a game passes the show's ctx; a couch-answered moment scores
  0 in a new game, said as an assumption); (b) presets keep today's rule (the rulebook's own points, couch-answered moments included);
  (c) (a) for new games, today's kept for Run it back. Recommended: (a), since the taps and the GPT must make the same game from the
  same words (product principle 2); no couch plays a show with couch-answered moments today, so nothing running changes. (Still the
  user's after R1 part 2: see its item.)
- **Still the user's: a pick of the season's winner is wrong at the finale** (F's item, "R1, or whoever next touches pool grading"):
  not changed here, since R1 keeps every score as it was; the recommendation stands (the winner and finalists survive the finale). It
  changes today's pools' finales (Survivor 51's Survival Pool among them), so it goes in with the user's word, ideally before Survivor
  51's finale. (Whoever next touches pool grading, with the user's word: R1 part 2 didn't.)
- **The stats' facts league still writes the type field** (`season-stats.ts`: `leagueTypeId: "active-roster"` with the game's points, so
  the facts read the moments as the lineup reads them): it now chooses that game by its spec, but the league it builds is made of fields.
  (R3, when the fields go: build it from the game's spec.)
- **`LEAGUE_TYPES`' names are classic's** ("Classic", "Active Roster", "Eliminator Pool"): the me route and classic's setup show them.
  (R3: the preset's name, `PRESET_LABELS`; R1 part 2 left the me route's label on it, which games it lists going by the pieces.)

From R1 part 2 (2026-10-30):
- **The Survivor 51 season-forward rehearsal still has to pass before R1 merges** (R1 part 1's item, for both parts):
  `scripts/dev-test/season-forward.js` still isn't on master. Part 2 moves no score (the golden replays, `--before=master` too), but R1
  as a whole changes how live games are scored, so the main folder merges it only after the rehearsal passes, never on a Wednesday.
  (The main folder, at R1's merge.)
- **Still the user's: which rule a preset meets** (R1 part 1's item): not settled here, since every option changes something a person
  sees (under (a), a new Weekly Lineup on a show with moments the couch answers starts with those at 0 on its points page). The
  recommendation stands: (a), said as an assumption in the wizard. (Whoever next touches Start a game's spec, or U0, with the user's word.)
- **Still the user's: a pick of the season's winner is wrong at the finale** (R1 part 1's item): part 2 doesn't touch pool grading. The
  recommendation stands, ideally decided before Survivor 51's finale. (Whoever next touches pool grading, with the user's word.)
- **`Game.gameType` is still the stored type field** (`show-space.ts` `games()`, read in SQL), carried on every game the screens get:
  nothing that scores or chooses a game reads it now, but the screens' readers do (Start a game's Run it back and counts, `start-game.ts`
  `KEY_OF`; End a game's words, `end-game.ts`; the trophy shelf's "same kind of game", `couch-standings.ts`; the desk's search by a game's
  name, `desk-games.ts`; the test couch). (R3: the kind from the spec, where the screens need one, or the preset's name.)
- **Backstage's Game settings reads the games scored outside the state through the league type** (`backstage-games.ts`: a game of
  questions' questions, whether a game scored outside its state has started or is over, the lock), beside the screens' other flags in
  the same file. Each is a one-line move to `piecesOf` (the flags are the same: tests/pieces.test.js), left with the rest of the file.
  (R3, or whoever next works in Game settings.)
- **For the hosting notes, at the merge:** `/api/me` (classic's sign-in and every classic load) now sends each league's settings, not its
  whole state (20-40 KB each): less Neon transfer than before. (The main folder: docs/HOSTING.md, with the merge.)

From A12 part 1 (2026-10-30):
- **For the user, in the format-change design session (after A12), each with a recommendation (built as spec settings or engine rules):**
  1. The overall by default (`OVERALL`: points). Options: places (a stage you finish scores by your place), stages won. Recommended:
     points when every stage scores the same way (a second draft at the merge is one game going on: its points are alike), places when
     they don't (a lineup's points beside a pool's streak aren't), the wizard saying which; wins only when the words say "an overall
     winner of the stages".
  2. Places' points. Built: one for each of you below you, plus one (4, 3, 2, 1 for four), ties sharing the higher; `places` for a
     table of the maker's ("10 for first, 6 for second"). Recommended: keep.
  3. When a stage counts in the overall. Built: by points as it stands, every episode; by places and wins only once it's over.
     Options: places as they stand too (a live overall that moves every week). Recommended: keep (a place in a stage that isn't over
     isn't a place yet), the game's page showing the stage in progress beside the overall (track V).
  4. A later stage's draft. Built: it opens at its stage's start (once the episode before has results), its exclusive count then, and
     nothing makes it finish before the stage's first lock (a snake not finished scores whoever's drafted, a blind draft not revealed
     scores nobody). Options: a deadline (the stage's first lock), with the pick timer and "away: queue" on by default and anyone not
     done picked for (as computer players pick); or the stage's first episode skipped for the draft. Recommended: the deadline with
     picks made for whoever isn't done, said in the draft room ("Picks close when Episode 8 starts").
  5. An exclusive later draft that no longer fits who's left. Built: shared from then on, said in its Recent changes (the decision's
     fallback, automatic). Options: fewer each (3 → 2) to stay exclusive; ask the maker. Recommended: shared (the decision), the draft
     room saying why before anyone picks.
  6. Nobody new once the first stage has started. Built (a code join waits, inactive, and isn't seated in the stages). Options: join the
     stage in play as its late joiner (its own rules) and every later stage from its start. Recommended: that, in part 4.
  7. What players see. Built: each stage is a game on the couch's lists (its moves are there) and the game is too (its table the
     overall); the hub counts the game only. Recommended: the game's page shows the overall and its stages inside it (track V's stages
     block), the couch's lists the game alone, each stage's moves reached from the game's page.
  8. The edge cases: the merge confirmed after its first episode aired (built: the first stage keeps that episode, the second starts
     with the next, as A3's starts do); the merge moved later by a correction (both stages move together until the episode after the
     first one's end has aired, then neither does); a merge that never comes (the first stage runs to the season's end, the second
     never starts, the overall is the first's); a stage that never plays (its end's phase came before its start: "never"). Recommended:
     keep, each said on the game's page.
- **`stageWalk`'s cost:** every read of a game in stages works out each stage's table at each episode it played (a `gameView` each:
  about 26 for two stages over 13 episodes), on the Games tab, the couch's game list, the hub and the join route. Fine for a few games;
  cache each stage's walk by its `updated_at` if it shows. (The merge: a line in HOSTING.md; whoever next sees a slow couch.)
- **Seats reach the stages from `withLeagueLock` and `joinLeague` only**, after the game's write commits: the desk's seat moves
  (`desk-seat-moves.ts`, its own transaction) and anything else that writes a game's memberships without a write to the game reach its
  stages at the game's next write. A failed sync is logged and done again by the next write. (Whoever next touches seat moves; part 4.)
- **A seat that left a begun stage and comes back** gets a seat of its own again in the game (reclaimed by account there), but in the
  begun stage it's a new seat: the old one, left with its team, isn't reclaimed. (Part 4's late joiners.)
- **Changing a game in stages' stages after it's made** (Game settings, a typed change) writes the game's spec but doesn't remake its
  stage leagues: only the lab makes them. (G2, U1: a write that changes the stages.)
- **The stages are on the couch's lists** (the Games tab, the couch's game list, Start a game's "already on this couch"), each a game,
  beside the game itself. (U1 and track V.)
- **The lab passes no `ctx.pool` or `ctx.couch`** (as before), so the first stage's exclusive count runs only where they're given (G1);
  a later stage's runs as its draft opens, from the stage's own seats and cast.
- The stage sentences inside a game in stages' words say "the show's rules" (each stage described without the show's name), and the
  sentence joins them with semicolons. (U0, with the wizard's words.)

Taken by A11 part 5c (2026-10-30): part 5's teams that follow the show's groups (refused, below); A10 part 1's computer players and
group slots; A9 part 2's and A10 part 2's late joiner's captain and second pick (a check plays them); A10 part 3's someone who joins after
a draw (dealt, as recommended); A10 part 3b's and 3c's late joiner given castaways under a price (they pay); part 1's and part 2's nobody
new once someone's out (every game that knocks people out); part 2's someone catching up in a pool with lives; part 2b's and part 3's
join route reading a game of questions without its walk (the couch's join and its game list read it as it stands); part 5's late
joiner's team in a drawn game (checked through the route).

From A11 part 5c (2026-10-30):
- **For the user, in a design session (with part 5b's twelve questions and parts 1 to 5's), each with a recommendation:**
  1. Teams that follow the show's own groups. Built: refused, with what rides the show's groups instead (a group slot, a group question
     each episode, A12's stages). Option: a fixed team of players that backs one of the show's groups: drawn or chosen at the start, each
     team tied to one of the groups going in, its points its members' own plus the group's (a group slot the whole team holds, on
     GroupSlotLogic's records), re-tied at a change by following the people (the group holding most of its old members) or left untied
     (carry on), untied at the merge or when the show goes each for themselves. Recommended: refused now; the backing team only if a
     request asks ("each team roots for a tribe"), built as part of A12's stages, since it lasts only as long as the show's groups do
     and the stages already start and end on their changes.
  2. Nobody new once someone's out, now in every game that knocks people out (a pool's lives, a game of questions' walk, a draft's
     cuts). Built: one rule (part 1's item 5, recommended as built). Options: a pool with lives lets a newcomer in with one life, or
     the fewest anyone left has; join out, watching only. Recommended: keep one rule.
  3. A seat joining by a code or an invite once someone's out (the couch's join refuses it). Built: it waits, inactive, as one joining
     after a finished draft does, until whoever runs the game brings it in; brought in (`activatePlayer`), it plays from the game's first
     episode, so a pool's or a game of questions' missed episodes knock it out at once. Options: refuse the code join too (the couch's
     words: "Nobody new can join this game"); bring a seat in from the next episode. Recommended: refuse it at the code join too, one
     rule everywhere (small: join-league.ts), and Backstage's bring-in offers only a start from the next episode (U1).
  4. A late joiner after a draw. Built: dealt (A10 part 3's recommendation), from who was still in at their start (owned or not for a
     late joiner playing their own season, nobody's for someone let in to play in the open, their own hat in a shared draw). Options:
     what's left for everyone. Recommended: keep. What they're told is U1's: the join sheet still says "Pick your team from who's still
     in" on a drawn game's start choice; "Your team is dealt from the hat as you join" would say it.
  5. A late joiner's team under a price. Built: at the prices as of the episode before their start (what the draft paid then), held to
     a salary cap (never when no team they could have fits), paid from a stock market's budget. Options: today's prices (a late joiner
     catching up from an early start pays what everyone did then, which is the fair one; today's would charge them for results they
     haven't seen). Recommended: keep.
  6. Castaways whoever runs the game gives a seat (`activatePlayer`) under a price. Built: paid at today's prices, never refused by the
     cap (the runner's call, as their roster tools always were). Options: hold it to the cap, with the reason. Recommended: keep, the
     screen saying what the team costs and whether it's over (U1).
  7. Computer players' group slots. Built: the group whose people they rate best, never a swap while it lasts, an exclusive opening's
     taken group passed over. Recommended: keep; a swap to a better group only if a couch finds them easy.
  8. What players and the maker are told (U1): a seat that waits once someone's out, a dealt team, a late team's cost and the cash it
     leaves, someone catching up still in (not out) on everyone's table.
- **Where joining is read without the walk:** `shared-seats.ts shareCheck` (sharing a seat) and classic's "Let people join late" toggle
  (`players-section.tsx`) read `GhostLogic.allowed` on the state as it is, so a game of questions with someone out still lets someone share
  a seat, and the toggle reads on; the toggle also reads off for a pool with lives once someone's out (as it has for a draft's cuts since
  part 1). Game settings (`backstage-games.ts`) and the desk's games list read a game of questions without its walk (part 2b's items). (Whoever
  next touches shared-seats.ts: `asItStands` there; U1 for the screens.)
- **`gameOnCouch` builds the whole couch's game list to find one game** (`couch-joins.ts`), so join options and a join pay for walking
  every game of questions on the couch (one answers read each, side by side). (Whoever next touches couch-joins.ts: walk only the one.)
- **A game of questions' someone catching up** reads, in everyone else's copy, as missing the answers they haven't given yet: a late lock
  with lives (part 2b's item 7) isn't built, so a pool's reach has no game of questions' twin. (Whoever next touches AnswerLogic.walk.)
- Computer players still don't answer a game of questions (A4's item). (Whoever next touches computer players.)
- One answers read more per game of questions that knocks people out, each time a couch's games are listed or joined, and one on a code
  join. (The merge: a line in HOSTING.md.)

From A11 part 5b (2026-10-30):
- **For the user, in a design session (with part 5's twelve questions and parts 1 to 4b's), each with a recommendation (built as spec
  settings or engine rules, the defaults `HANDICAP`, read by `handicapParts`, never filled into a spec):**
  1. Who's a newcomer. Built: no game on this couch (`newTo` couch: the default) or none of this show on it (show), on a season that
     premiered before this game's; any game counts where the account held a seat (archived ones too; not a deleted, practice or public
     one, nor one on another couch). Options: none finished (a game played to its end: each earlier game's end isn't a column, so the
     server would read their states); joined the couch lately (`couch_members.joined_at`); fewer than N games. Recommended: as built,
     the couch by default, the show when the words say "new to Survivor" (G1).
  2. What "before" is. Built: a season that premiered before this game's (the catalog's date, else when that game was made), so games on
     the same season never count each other (a game made mid-season doesn't count the couch's other games of it). Options: a game that
     started before this one's first episode. Recommended: keep (stable, and a couch's first season has everyone new).
  3. A couch where everyone's new (its first season, a couch with no games before). Built: everyone gets it, which changes nothing
     between them (only a race comes sooner and the points run higher). Options: nobody when everyone is (a handicap evens a field);
     the wizard saying so before the game's made (G1's context pack knows the couch's history). Recommended: keep, with the wizard's
     warning ("Everyone here is new to the couch: the handicap won't change anything").
  4. When it's settled. Built: kept at the game's start (its first episode locked or with results); before then it's the history as it
     stands; a seat that comes in later is kept at the first write that reads it, a late joiner from their own start, a seat brought in
     or a computer player's taken over from the first episode still to play. Recommended: keep.
  5. A team two people share. Built: new only if everyone on it is (the most of its accounts' history). Options: new if anyone is; a
     share of the points for each newcomer on it. Recommended: keep.
  6. A seat that leaves (disabled). Built: it keeps earning the handicap, as its team plays on in a draft (in a game of questions it
     answers nothing, but still gets it). Options: stop from the first episode still to play once they leave (small: a `to` beside
     `from`). Recommended: stop it (a handicap is for a newcomer playing), as a small change.
  7. Computer players. Built: never new (a bot has no history to be new to), never kept, so a person taking its seat is read then.
     Recommended: keep.
  8. How much and how often. Built: `points` every episode the game plays (an episode with results in its span from the seat's start:
     a night nobody went home counts; one with early results counts in the table at once, while a race's or the cuts' walk and head to
     head's weeks wait for final results, as their points do). Options: only episodes with final results; a head start instead (a
     number once: "newcomers start with 20", a `start` beside `points`); a share that shrinks each week. Recommended: keep; a head start
     as its own small setting if a request asks. The size matters more than the shape (the blind replays): on The Challenge, where a
     Weekly Lineup's whole season is -9 to 27 points, 5 an episode (95 by the final) decides the game; on Survivor 49 (6.5 to 106) it
     closes a gap. Recommended too: the wizard offers a handicap scaled to the show's typical episode (G1's context pack can carry a
     week's points) and says what it amounts to over the season.
  9. Who else a handicap names (`who` new only now). Options: last season's champion on this couch (minus points), last season's last
     place, the couch's lowest-ranked in its power rankings (all data the couch's history has). Recommended: the champion and last
     place as VOCAB 'later' values when a request asks (G1's corpus could add "the defending champ starts 10 behind").
  10. Wagers (the code review's). Built: a game of questions with a handicap is walked, so "bet any of your points" (A9's wagers) can
     stake its points too. Options: answers' points only. Recommended: keep (they're on your row as your points).
  11. A pool. Built: refused (it ranks by its streak, or who's still standing). Options: an extra life (or a mulligan) for newcomers in
     a pool with lives. Recommended: a life, when a request asks (small, on `PickEmLogic`'s lives).
  12. What players and the maker are told (U1): who's new and why ("no game on this couch before"), their bonus on their row and in the
     episode's breakdown, before the start that it's provisional (`GameView.handicap.kept`), a seat that becomes new when someone takes
     it over.
- **The breakdowns don't have it:** the Games tab's `week` column (`teamEpisodeBreakdown`), `playerEventRows`, the Scoreboard's per-event
  rows and the episode lines show what the castaways scored, not the handicap (the rows, the totals, the series, the hub and the couch's
  numbers have it), as with A9's captains. (U1.)
- **One query on a write to a game with a handicap** until everyone a person holds is kept (before its start, and when someone new comes
  in), none after. (The merge: a line in HOSTING.md.)
- **The history is read only on a write:** a game made straight in the database (the checks' `setGame`) has none until its next write,
  so nobody is new on reads before it (fails closed). Start a game and the engine lab write through the app. (Noted.)
- **No caller passes the couch's history to our check:** a handicap on a couch where everyone (or nobody) is new is made without a word.
  (G1's context pack: the couch's newcomers, for item 3's warning.)
- **The other API checks copy `check-kit.js`'s helpers** (`check-teams.js`, `check-h2h.js`, `check-answer-h2h.js`, `check-coop.js`, the
  knockouts' checks): move them onto it when each is next touched. (Whoever next touches one.)
- **No request in the corpus names a handicap's other shapes** (a head start, the champion's penalty, new to the show): G1's corpus could
  add them. (G1.)
- Start a game, Game settings and the engine lab offer none of it (the lab starts the tracker's rows). (U1.)

From A11 part 5 (2026-10-30):
- **For the user, in a design session (with part 4b's six questions and parts 1 to 4's), each with a recommendation (built as spec
  settings or engine rules, the defaults `TEAMS`, read by `teamParts`, never filled into a spec):**
  1. How the teams are made. Built: `made` draw (at random at the game's start, seeded and recorded: the default) | choose (each picks
     theirs before the start; whoever runs the game can put anyone on one). Options: the maker sets them (choose already lets the
     commissioner do it); balanced by the couch's history (the strongest split up). Recommended: draw by default ("split us into two
     teams"), choose when the words name the teams ("boys against girls", "couples"), the GPT reading which from the words (G1).
  2. When they're set. Built: at the game's start (its first episode locked, or with results); before it a drawn game's teams are dealt
     over whoever's there, so someone joining before the start can deal others onto other teams (`GameView.teams.set` says when they're
     kept). Options: drawn at the draft's start, so teammates can plan their picks; drawn when the maker says. Recommended: as built for
     a game of questions; for a draft, drawn when the draft starts (a small setting, `at: 'draft'`), since a couch drafting as teams
     will want to know its teammates; U1 shows provisional teams as "drawn at the start", never as fixed.
  3. A team's points. Built: the mean of its members' points, episode by episode, of whoever was on it then (the default) | sum.
     Recommended: mean (a team of three and a team of two weigh the same; with equal teams it ranks as the sum does), the Games tab
     showing both; sum when a request says "added up".
  4. Someone on no team when they start counting (a late joiner caught up, someone who didn't choose by the start, a seat brought in).
     Built: `unplaced` smallest (onto the smallest team, a tie to the first: the default) | none (they play for nobody, ranked after
     every team). Options: a tie to the team behind on points; the maker places them; they choose within a window. Recommended:
     smallest, a tie to the team behind on points (a small change: the settle has the series), U1 telling them which team.
  5. A late joiner's points before they join a team (catching up, they play episodes the team already played). Built: they count for
     no team (a team's past points never change after the fact); placed from the first episode not played or locked. Recommended:
     keep.
  6. A seat that leaves (disabled). Built: off its team from the first episode not played or locked, its points before staying with
     it; reclaimed, back on that team from then; a seat removed outright is gone, its points with it (every episode worked out again
     without it). Options: it stays on its team (as head to head keeps a disabled seat: its draft plays on by itself), which helps with
     sum and hurts with mean in a game of questions (it answers nothing). Recommended: as built; a removal once the game has results
     made a disable (part 4's item 8, the same).
  7. A seat moved to another team mid-season. Built: by whoever runs the game only, from the next episode; its row, the couch's
     numbers and the plaque credit it with the team it ended on. Options: credited with the team it played the most episodes for, or
     with both. Recommended: as built, the move in Recent changes (it is: "Put riley on a team").
  8. The couch's numbers. Built: each member credited with the team's place, one team in the field (`fieldOf`), teammates never in each
     other's head to head (as a shared seat's), the plaque the winning team's members (a title each), no margin in anyone's own points.
     Options: a team game's margin in the teams' points on the plaque; team games counted apart ("team wins"). Recommended: as built,
     plus the teams' margin on the plaque (`GameStanding` carrying the teams' points: small).
  9. Head to head between teams. Built: the teams play each other (a round robin of the teams, the median for an odd number of teams,
     the standings by wins, the playoffs over teams, the champion team's members all champions); a seat on no team plays nobody.
     Recommended: keep; with two teams every week is the same matchup, so the wizard offers head to head between teams from three.
  10. Balance in a chosen game. Built: nothing stops a lopsided split (five on one team, one on the other); the mean keeps it fair on
     points. Options: refuse a choice that makes a team more than one bigger than another (`balanced: true`). Recommended: a setting
     if a couch asks; the mean is enough by default.
  11. Names. Built: the spec's names (up to one a team) or none (the words say "two teams"; U1 "Team 1"). Options: a team names itself
     (a move). Recommended: the spec's or "Team 1", a rename on the team's screen in U1.
  12. What players are told (U1): their team and teammates, the team's points and place beside their own, being placed on one (a late
     joiner, the unplaced), a move, the draw at the start; on the episode night, how the team did.
- **The Games tab's seat `rank` in a game in teams** is the seat's place among seats ("T1", "T1", "3"); the team's place is
  `TableRow.side` (the hub reads it). (U1: show the team's place.)
- **The draw is worked out on every read before the start** (memoised per state object) and the standings walk the game's series once
  more than a game without teams (head to head walks the matchups again inside them). Nothing at a couch's size. (With part 4's memo
  item.)
- **Readers not taught teams:** the couch's game list (`couch-joins.ts`), Game settings (`backstage-games.ts`), the desk's games list
  and Start a game show nothing of them; a game of questions read without its walk counts every team level. (U1.)
- **Teams of players don't read the show's format:** a change nobody announced reaches a team through each member's own game (its
  pieces' fallbacks). Teams that follow one of the show's groups (`made` 'group') were refused in part 5c (its As built and Noticed
  item 1: they don't fit as a team of players; A12's stages, a group slot or a group question each episode ride the show's groups).
- **No request in the corpus asks for teams of players** (who.teams is the dial's row): G1's corpus could add "split us into two
  teams" and "boys against girls". (G1.)
- Start a game, Game settings and the engine lab offer none of it (the lab starts the tracker's rows). (U1.)

From A11 part 4b (2026-10-30):
- **For the user, in a design session (with part 4's twelve questions and parts 1 to 3's), each with a recommendation (built as engine
  rules; the defaults are part 4's `MATCHUPS`, read by `matchupParts`, never filled into a spec):**
  1. What an episode's points are, in a game of questions played head to head. Built: what the answers settled by then add: each
     episode's own questions in it; a question over several episodes (every N, over N, a phase) in the episode its window ends; one
     about the whole game at the game's end (the final, or the season's finale), so it lands on the last week's matchup (with playoffs,
     the final's). Options: only questions asked each episode about that episode count in the matchups (the rest only in the points,
     the standings' tiebreak and the table); a question about the whole game left out of the matchups; its points spread over the
     weeks. Recommended: as built: one rule for both kinds (a draft's finale predictions count at the finale the same way), every point
     the game gives counts in the week it's settled, and nothing waits on a rule of its own; the wizard says it when a game asks
     something about the whole game ("Who wins? is worth 5 in the final's matchup"). If a couch wants each week to be that week's
     answers alone, a spec setting for both kinds (the draft's finale predictions too) is small: a rank key such as `weekly: 'episode'
     | 'settled'`.
  2. What a week waits for. Built: its full results (early results wait, as a draft's do) and any question asked about it alone still
     to settle (research unsure); once a later episode is in, it counts as it stands. Options: the verdicts only (a game of who goes
     home only would decide on the early results, right after the episode); a fixed time (the final results at noon). Recommended: as
     built: a matchup decided once, at the final results (noon the next day), never flipping when the full results land; the
     episode night says when it's decided (U1). Risk: an episode research never gives a scoring moment stays early, and its matchup
     waits for the next episode's results (the season sync marks an episode final only on a scoring moment).
  3. A question only the season's end can settle (who wins, the final three) in a game whose final comes before it (playoffs `from`
     with no span end): it never settles and counts for nobody. Our check refuses such questions beside a span end, but can't tell
     where the season ends beside a `from`. Recommended: refuse them there once ctx carries the season's length (G1's context pack, or
     the desk's count); until then the fallback holds.
  4. A night nobody scores is common in a game of questions (everyone wrong, or nobody went home). Built: part 4's `quiet` skip by
     default (it counts for nobody). Recommended: skip, as built; `tie` for a couch that wants everyone's record to move every week.
  5. The couch's head to head (part 4's item 9) for a game of questions too: left by places, as part 4 built it. Recommended: part 4's
     (count the matchups themselves), the same rule for both kinds.
  6. What players are told (U1): the refusals' words ("This game ends with Episode 8" before the final, "ended with" after), that the
     matchups wait for the final results while the table's points already move, and the record beside the points.
- **No blind replay plays one:** no tracker row asks for a game of questions played head to head (the corpus has no such request), so
  `blind.js` never starts one; its `.matchups` record reads one (`matchupLine`) the day a row does. (G1's corpus, or whoever adds a
  request for one.)
- **`GameQuestions.ended` reports the season's end only for head to head** (its final's episode, or the finale when the season ended
  first); a race nobody won or a co-op game won at the season's end reports null there and is over by `over`. (U1, saying "ended" for
  every game from `over`.)
- **An earlier episode still early once a later one is in counts as it stands, even at the final** (the code review): a final decided
  then is played again on every read once its full results land, but a champion shown in between can change. (The user's, with item
  2; the season sync marking an episode final.)
- **`MatchupLogic.series` builds its Maps from the walk on each read** (episodes × seats, small). (With part 4's memo item.)
- **Nothing after the season's finale plays for a draft either now:** a regular-season week after it (a schedule that counts a
  reunion, with points) is skipped, as part 4 skipped its playoff rounds. A draft played head to head without playoffs on such a
  season counted those weeks before. (None known; noted.)
- Start a game, Game settings and the engine lab offer none of it (the lab starts the tracker's rows). (U1.)

From A11 part 4 (2026-10-30):
- **For the user, in a design session (with parts 1, 2, 2b and 3's questions and A10's), each with a recommendation (built as spec
  settings or engine rules, the defaults in `MATCHUPS` and `MatchupLogic`, never filled into a spec):**
  1. An odd number of you. Built: `rank.odd`, median (whoever the round robin leaves out plays the median of everyone else's points
     that episode: the default) | bye (they sit it out, in turn). Recommended: median, as built: nobody has a week off, everyone plays
     the same number of matchups, so ranking by wins stays fair; a bye for a couch that wants only real opponents (then item 3's
     win percentage).
  2. A night nobody scores (everyone in it on 0: an Outlast's night nobody goes home). Built: `rank.quiet`, skip (counts for nobody:
     the default) | tie (everyone ties). Recommended: skip, as built; in the playoffs either way the better seed goes through (item 4).
  3. The standings. Built: wins (a tie half a win), then the regular season's points, then who joined first (the seeding's last tie;
     the table shows T until the playoffs, then the seed orders them). Options: win percentage (fairer with byes, or a seat that joined
     late), points against, the head to head between the tied. Recommended: as built with the median; win percentage if a couch picks
     byes.
  4. The playoffs. Built: `rank.playoffs` `{ teams, from? }`, none when the spec leaves it out; the top 2 to 8, a fixed bracket (1 v 4,
     2 v 3; never re-seeded), a round an episode over the game's last episodes; a tie, or a night nobody scores, to the better seed.
     Options: a default for the wizard (none; the top half rounded down to 2, 4 or 8; the top two only); re-seeding after each round;
     a playoff tie to the season's points, or a shared title. Recommended: the wizard offers playoffs from four of you up, the top
     half rounded down to a power of two (4 of 6 to 9, 8 of 10 or more), the bracket fixed and a tie to the better seed, as built.
  5. Where the playoffs sit, when the season's length changes. Built: the game's last episodes as the data has it (its span's end,
     else the season's episode count from its schedule), moving with it until their first round has results, then kept; a season
     longer than it said ends the game with its final (later episodes don't count); one that ends first (the finale earlier than
     scheduled, rounds still to play) is won by the best seed still in, or seed 1 before the playoffs began; nothing saying the end
     (no span's end, no count): no playoffs, the standings decide. Options: shared titles among those still in; the playoffs placed
     once at the game's creation and never moved. Recommended: as built, the wizard saying where they are and letting the maker set
     `from`; the desk's count is the source, so a wrong count (item 11) is the risk.
  6. Seats out of the playoffs (never in them, or knocked out). Built: no matchup, their moves still open (their points still show;
     a lineup set changes nothing that counts). Options: their moves refused, as a knocked-out player's are (part 1); a consolation
     bracket. Recommended: as built (harmless, and the Drive-By's lineup isn't refused for nothing); a consolation bracket only if a
     request asks for one.
  7. A seat that comes in later (brought in mid-season, a late joiner once caught up). Built: from the first episode still to play,
     with no record before (behind on wins), the weeks played unchanged (`state.matchupSeats`). Options: a record to start from (the
     median's, or the average); refusing late joiners once matchups have started. Recommended: as built, with the join screen saying
     they're behind; refusing a late joiner once the playoffs are seeded (nobody can catch up then: not built, `GhostLogic.allowed`).
  8. A seat that leaves. Built: a disabled seat stays in the schedule, its team playing on as the engine plays it (best ball and
     Outlast by themselves, a lineup carried), as `disablePlayer` keeps its points; a seat removed outright (`removePlayer`: the desk's
     and Backstage's member removal, a computer player) is gone, and every week is paired again without it. Options: a disabled seat's
     opponents winning by forfeit; dropping it from the next episode (the settle could keep when). Recommended: as built for a
     disabled seat; a removal once the game has results made a disable (whoever next touches member removal; U1).
  9. The couch's head to head (the hub's, `couch-standings.ts` `rankingsOf`): a head-to-head game counts there as every game does, by
     who finished above whom. Options: its own matchups between the two counted instead (won, lost, tied each week). Recommended:
     count its matchups, since that's literally head to head (part 4b, with `GameStanding` carrying each pair's record).
  10. What a head-to-head game shows (the user's, U1): the record beside the points (`TableRow.record`), this week's opponent and last
     week's result (`GameView.matchups`), the bracket during the playoffs, the champion on the plaque (built: no margin in points).
     Recommended: the record first and the points after it; "This week: you v riley" on the episode night; the bracket on the Games tab
     once seeded; the champion named on the plaque as the playoffs' winner. What players are told when they're seeded, knocked out of
     the playoffs, or when a correction changes a result already shown, is U1's.
  11. The season's length comes from `show_seasons.episode_count` (the desk's, held or from the listing). A wrong count places the
     playoffs wrong until it's corrected, and once their first round has results it can't be. Recommended: the desk's season page
     says when a head-to-head game's playoffs read its count (the desk lane), and the wizard shows the episodes they'll be on.
  12. A schedule that counts more than the competition (the blind replays): The Challenge's seasons count 21 episodes, but their final
     is 18 and 19 (20 and 21 are the reunion), so the playoffs were placed on the reunion, after the season's end. Built: the fallback
     holds (the season over first: nothing after its finale plays, the best seed still in wins; there, before the playoffs began,
     seed 1, the regular season's leader), so the playoffs never play on such a season. Options: the desk's count leaving the reunion
     out (a finale episode in the schedule, beside its count); the playoffs starting when research says the final begins (F2's
     format section reports a new phase: "the final", The Challenge 41's from 18), as a stage that starts on a phase (A12); a playoff
     of one round only. Recommended: the schedule's finale episode on the desk (the desk lane: it already holds the count), and A12's
     stage on a phase for a show whose final research names; until then, the fallback.
- **Readers not taught the early end:** the couch's game list (`couch-joins.ts`), Game settings' span (`backstage-games.ts`) and the
  desk's games list (`desk-games.ts`) read the span (`endEpisode`), so a head-to-head game whose `from` ends it before its season's end
  runs to the season's end there, as part 1's and 2b's games do. (U1 for the lists.)
- **The hub reads states without stamping them** (`leagueStates`): a head-to-head game's season length there is as of its last write;
  a count changed on the desk reaches it at the next write. (Rare; whoever next touches the hub's reads.)
- **Nothing is memoised:** a read walks part 1's series about twice (3.4 ms against 0.8 ms, 10 players, 13 episodes). A memo by
  state for the walks (knockouts, pools, matchups) together. (Whenever a read gets slow; A12 has more walks.)
- **The early ends branch in `KnockoutLogic`:** `endsAt` and `moveProblem` dispatch to each kind (a draft's knockouts, a pool's, a
  game of questions' walk, head to head's final). One dispatcher each logic registers with would keep the order from mattering.
  (A12, which adds stages that end.)
- **A game of questions' head to head** was refused until part 4b: built there (its episodes' points the walk's, handed over).
- **Sports:** L4 brings head to head to sports on this engine (a sport's stats score each matchup); categories and roto stay the
  sports branch's (VOCAB 'sports').
- Start a game, Game settings and the engine lab offer none of part 4's fields (the lab starts the tracker's rows). (U1.)

From A11 part 3 (2026-10-30):
- **For the user, in a design session (with parts 1, 2 and 2b's questions and A10's), each with a recommendation (built as spec
  settings or engine rules, the defaults in `COOP` and `AnswerLogic.walk`, never filled into a spec):**
  1. Who saves a night. Built: `score.saves`, one (one right answer among you: the default) | most (more than half of those who
     answered) | all (all of them). Recommended: one, as built (s37's "we didn't see coming" read as none of us named them); most and
     all for a couch that wants it harder, the wizard saying it in the words the sentence uses.
  2. Silence. Built: someone who doesn't answer neither helps nor hurts (the field is who answered), but a night nobody answers costs
     one (nobody saw it coming). Options: silence counts as not seeing it (most and all over everyone in the game); a night nobody
     answers costs nothing. Recommended: as built (the Fan Who Forgets: the couch shouldn't lose for her, and a couch that stops answering
     still loses, so the game ends). The second option would also let a couch that walks away "win" at the end with every life.
  3. Two Faithful banished in one night. Built: one life a question a night at most (naming either saves it; part 2b's "each question
     its own life"). Options: a life for each one nobody named ("every faithful banished", read literally). Recommended: as built, the
     seed's own words ("a night nobody saw coming costing one"); a per-person cost as a setting if the GPT finds requests that need it
     (G1's corpus will show).
  4. The finale. The Traitors' finale banishments are `banishedInFinale` (traitors.js: in the finale, either role), not
     `banishedAsFaithful`, so s37's question is off at the finale: a Faithful banished at the last Round Table costs nothing. Options:
     a settle on who went home by an exit and a role (`{ by: 'results', take: 'out', exit: 'Banished', role: 'Faithful' }`: data
     already settles both), so the finale counts too. Recommended: build that settle (a small piece, A13 or whichever step next
     touches settles), s37 moving onto it; until then the finale costing nothing is the safe side.
  5. How it ends. Built: lost by all the episode the last life goes, won by all at its end (the span's last episode, or the
     season's) with one left; nothing else ends it. Options: a target to win early ("call eight boots before we lose five lives"), won
     early on the show's own end (every Traitor banished). Recommended: as built for now; a target as its own setting when a request
     asks for one (none of the corpus's does yet).
  6. How many lives. Built: `MAX_LIVES` (5), part 2b's, which s37 asks for exactly. A couch's lives together may want more ("ten lives
     between us"). Recommended: let co-op go to 10 (one constant), on the user's word.
  7. What a co-op game shows (the user's, U1): one shared place for everyone (the table's "T1", even when the couch lost; each row's
     points still there, listed by who called the most), the couch's lives and the nights they went (`GameView.coop`,
     `GameQuestions.coop`, `PlayingGame.coop`), the result. On the couch: no place in power rankings, head to head or finishes (built:
     nobody played anyone), the plaque everyone's when it was won and nobody's when it was lost (built), no title for a win (built).
     Recommended: the lives above the table and "Won together" or "The show won" in place of a place; a co-op win a shared plaque,
     not a title, as built. What players and the maker are told (a life lost, the game lost or won, a correction bringing it back) is
     U1's.
  8. A late lock with co-op (part 2b's item 7, the same here): someone who watches late can still answer within their window after
     others have the results, so a night already lost (and a game already over) can be saved after the fact. Recommended: pending,
     as part 2b's item 7 (a night waits until everyone's late window has passed: the server has the clock and each one's mark), when
     a game has both; not built.
  9. A corrected result that brings a lost game back: answers were refused while it read as over, so a night in between that nobody
     could answer reads as nobody answered and costs a life (`check-coop.js` corrected the last night itself, with nothing after
     it). Recommended: a night whose lock fell while the game read as ended costs nothing (the walk would need when it read as ended:
     the server could keep the walk's end with the time it was first seen); not built, rare.
- **A role research hasn't said reads as a Faithful** (traitors.js `roles.default`, as every Traitors moment and its points read it):
  a Traitor banished whose role research never reported is `banishedAsFaithful`, and costs the couch a life if nobody named them.
  Research reports a banished person's role with the exit as a rule, so it's rare. Recommended: when the role decisions carry how
  sure research was (F2's format section has a `sure`; the role questions don't), a banishment with no role said holds the night as
  waiting. (Whoever next touches The Traitors' research; the user's, with item 4.)
- **A role the format doesn't know** (a new twist's role, not a Traitor) reads as not a Traitor, so its banishment counts as a
  Faithful's. (The format's rule, as above; A12's twists if one comes.)
- **Not walked yet** (part 2b's item, now co-op's too): the couch's game list (`couch-joins.ts`), Game settings' span
  (`backstage-games.ts`), the desk's games list (`desk-games.ts`) and the join route read a co-op game without its walk: a lost game
  runs to its span's end there. Recommended: `asItStands` in each, as part 2b's. (Part 5c's late joiners for the join; U1 for the lists.)
- **A plaque for a co-op game that ended undecided** (archived while it played, or its span's last episode in with its night still
  to settle) has no winners and `coop.result` null, which a screen could read as a loss. (U1, with item 7.)
- **Co-op is a game of questions' only:** a pool's ("together we have five lives; every wrong boot pick costs one") or a draft's
  (the couch's points against a target) isn't built; `rank.by 'coop'` elsewhere is refused. (When a request asks: A12 or later.)
- Start a game, Game settings and the engine lab offer none of part 3's fields (the lab starts the tracker's rows). (U1.)

From A11 part 2b (2026-10-30):
- **For the user, in a design session (with parts 1 and 2's questions and A10's), each with a recommendation (built as spec
  settings or engine rules, the defaults in `ANSWERS_END` and `AnswerLogic.walk`, never filled into a spec):**
  1. A missed answer. Built: it costs a life, as a missed pick does (s48's "a wrong guess" read as a wrong answer or none). Options:
     a missed answer forgiven (nothing that night); filled at the lock with the most-picked answer. Recommended: as built for the rule,
     with A10 part 2's item 2 deciding a fill or a forgiven first miss for pools and games of questions together (in the blind
     replays the forgetter and the fan, who don't answer every week, were out at the premiere on The Challenge 41 and 39 for
     answering nothing: the Fan Who Forgets).
  2. Several questions a night. Built: each wrong (or missing) answer to a question a life rides on costs its own life. Options: one
     life a night at most, however many are wrong. Recommended: as built (each guess is a guess), the wizard saying it where a game
     asks more than one.
  3. Which questions a life rides on. Built: `livesOn`, else every question asked each episode about that episode alone. Recommended:
     as built; the GPT names them when the words do ("a wrong guess at the elimination"), G1's.
  4. How it ranks. Built: last one standing whenever it knocks players out (whoever's still in by their points, then whoever went out
     last, ties to the points). Options: most points wins, a wrong guess only freezing you (ranked by the total). Recommended: as built
     (the request says knocked out; "most points" is a different game and can be its own setting later).
  5. Its end. Built: `ANSWERS_END`, one or none left ends it (a draft's), the night everyone left goes out all out by their points (a
     pool's). Recommended: decide it with part 2's items 2 and 3 as one rule for every game that knocks players out (ends; all back).
     The blind replays argue for all back: s48 with one life was over at the premiere on two of three seasons, everyone out at once
     and tied on nothing.
  6. Lives on early results. Built: a who-goes-home question settles on early results (who went home), so someone can be out right
     after the episode, a correction at the final results working it out again; a moment's question waits for the full results.
     Recommended: keep, as a pool's (part 2's Noticed item on a pool's end): the user's, with it.
  7. A late lock with lives. Built: someone who watches late reads as out to everyone else (their answer missing) until they answer
     within their window, then the walk is worked out again; they can still answer an episode up to their last one in. Options: a
     missing answer is pending, not wrong, until everyone's late window has passed (the walk would need the clock and each one's mark:
     the server has both). Recommended: pending, when a game has both (rare); not built.
  8. What players and the maker are told (out, a life lost, the game over early, a shared win, the refusals) is U1's.
- **Not walked yet:** the couch's game list (`couch-joins.ts` `gameOver`, its `ended`), Game settings' span (`backstage-games.ts`
  `spanState`), the desk's games list (`desk-games.ts`) and the join route (`GhostLogic.allowed`: nobody new once someone's out) read a
  game of questions without its walk: running to its span's end, nobody out. Recommended: `asItStands` in each (one answers read
  per game of questions with knockouts). (Part 5c's late joiners for the join; U1 for the lists.)
- **The refusals name what happened** (part 1's item, the same here): sam, who hasn't seen the episode that put him out, is told
  "You’re out of this game" when he answers; someone behind a game's early end, "This game ended with Episode N". (U1.)
- **The walk isn't memoised:** a read of a game of questions with knockouts walks it a few times (the league as it stands in
  `gamesHere`, each viewer's copy in the table, the sheet and the nights; the hub twice), each a grade per episode. Nothing at a
  couch's size; an incremental grade or a memo before a public game of questions knocks players out. (Whoever next profiles the
  engine, with parts 1 and 2's.)
- Someone out's answer about the whole game leaves its question's "everyone's answers" once they're out (it counts for nobody:
  `liveRows`). (U1.)
- The table's rows (`TableRow`) still don't carry `out` or lives (part 1's item). (U1.)
- Start a game, Game settings and the engine lab offer none of part 2b's fields (the lab starts the tracker's rows). (U1.)

From A11 part 2 (2026-10-29):
- **For the user, in a design session (with part 1's and A10's questions), each with a recommendation (built as spec settings,
  the defaults in `NEVER`, `DRAFT_END` and `POOL_END`, never filled into a spec):**
  1. A pick that never repeats, once you've picked everyone still in. Built: a missed pick (`get.fallback` 'miss', the default:
     with one life you're out), or nothing that night ('skip': no points, no life lost, the streak holds). Options: picks open
     again from then (that's the cycle's rule, `repeat` 'cycle'). Recommended: 'miss' (the request's words read strictly; saving
     your safest picks for late is the game), the wizard saying it up front ("once you've used everyone still in, you're out of
     picks").
  2. One left ends a pool (A10 part 2's item 8, part 1's item 2). Built: `rank.oneLeft`, ends | plays, its default as each was
     built: a draft that cuts ends, a pool with lives plays on (the last one's points still growing, nobody left to pick for
     once they go). Recommended: ends everywhere, one rule (flip `POOL_END.oneLeft`), on the user's word.
  3. The night everyone left goes out (A10 part 2's item 9). Built: `rank.allOut`, points (the default, as built: all out,
     ranked by their points, a tie sharing it) | share (all out, sharing the win whatever their points: "ties split", w047) |
     back (all back in for the next episode with the lives, mulligans and streak they had before it; its right second pick's
     points kept). Only when two or more were left: one left going out is just going out (else a lone survivor under 'back'
     could never go out: the code review). Recommended: back as the default (the classic pool's rule), share when the maker
     says ties split.
  4. The finale: every pool pick is wrong at the finale (A10 part 2's noticed winner bug: the winner's exit is one of its
     exits), so with one life everyone left goes out together at every finale, and `allOut` decides the winner there: 'back'
     brings them all back with nothing after it (ranked by points, still in), 'share' ties them all, 'points' ranks them by
     points. Recommended: fix the finale's grading first (the winner and finalists survive it), so `allOut` only meets real nights.
  5. What players and the maker are told (a repeat refused, nobody left to pick, the game over early, a shared win, everyone back
     in) is U1's.
- **The pick screens read only `blocked`** (game-view.ts `pickOf`, pick-page.tsx): after a pool's early end eligibility is
  `{ available: [], blocked: {}, ended }`, so the page offers everyone and a refused pick still says "Locked in"; the new 'used'
  reason has no sentence; a skipped night's row is `correct: null`, which the grid reads as a pick still to be decided. (U1, with
  A10 part 2's "the screens don't know a pool's parts".)
- **A pool's end reads early results** (who went home, before the scoring), as every pool pick is graded since A10 part 2: the
  game can be over, and a winner named, right after an episode, a correction at its final results working it out again. A
  draft's cuts wait for final results (part 1) because its points come with them; a pool's don't. Recommended: keep; if the user
  wants "over" to wait for final results, stop the walk's end checks at the newest early episode. (The user's, with item 2.)
- A catching-up player in a pool with lives reads, in everyone else's copy, as missing the picks they haven't made yet (A10 part
  2's walk), while the end counts them as still in. (Part 5c's late joiners.)
- Nobody new joins once someone's out is a draft's only (`GhostLogic.allowed` reads `KnockoutLogic.outs`): a pool with lives
  still lets a late joiner in with all their lives after someone's out. (Part 5c's late joiners; the user's, with part 1's item 5.)
- The pool's walk isn't memoised: a read walks it a few times (lastEpisode, the table's scores and histories, eligibility), each
  every player through every episode. Nothing at a couch's size; a public pool of hundreds with these settings would want a memo
  before it's offered. (Whoever next profiles the engine, with part 1's.)
- Start a game, Game settings and the engine lab offer none of part 2's fields (the lab starts the tracker's rows). (U1.)
- `tests/status-plate.test.js`'s "weekly default after the draft" fails when `NOW + 3 days` crosses a daylight-saving change: run
  at 12:24 AM Eastern on 2026-10-30, three days on is 11:24 PM on 1 November (the fall-back hour), two calendar days, so it reads
  "In 2 days". Nothing in this part touches it; it passes again once the change is behind. (Whoever next touches the status plate:
  count from a fixed hour of the day, or compare calendar days in the season's zone.)

From A11 part 1 (2026-10-29):
- **For the user, in a design session (with A10's questions), each with a recommendation (built as spec settings or engine rules,
  the defaults in `CUT` and `KnockoutLogic`):**
  1. A cut's defaults. Built: one goes, a tie at the line keeps everyone tied there (nobody goes by a tie), a window's tie goes to
     the total first, a night nobody goes home cuts like any other (it still has points). Options: ties all go; a quiet night
     skipped. Recommended: as built for points (the guillotine, a cut at the merge); `quiet: 'skip'` is for part 2's knockouts on
     who goes home (a wrong guess), where a quiet night has nothing to be wrong about.
  2. One left ends the game. Built: once a cut leaves one of everyone, it's over and they win (a pool with lives doesn't: A10 part 2's
     item 8). Options: play on to the season's end, the last one's points still growing. Recommended: end it everywhere, pools too,
     one rule (part 2 can make it the pools' with the user's word).
  3. A cut before a phase whose start is known only once it's begun. Built: it lands then, after the episode before the phase,
     and the phase's first episode no longer counts for whoever it cut (their lineup and points there, taken back); known ahead, it
     lands before. Options: let them keep the phase's first episode (cut after it, still on the totals before it). Recommended: as
     built, with the desk confirming a merge's start ahead whenever the show has announced it, so it rarely lands late (whether the
     desk's phase confirmation takes a start before its episode airs wasn't checked here).
  4. A knocked-out player's castaways. Built: back in the pool in an exclusive draft, always (the request's words), kept on the
     castaway for the knocked-out player's history. Options: they leave with them (nobody gets them). Recommended: as built; "leave
     with them" only if a maker asks (a spec setting then).
  5. Late joiners. Built: nobody new joins once someone's out; before then a late joiner joins as now (someone catching up can't be
     cut or finish a race until caught up). Options: join with what they score from their start (a cut on the total would likely
     take them next); join out (watching only). Recommended: as built.
  6. A race's finish. Built: the game ends after the episode someone reaches the line; the most points then win, a tie shares first
     (T1); nobody there by the season's end, the most points win. Recommended: keep.
  7. What players and the maker are told (a cut, a race won, the game over early, a knocked-out player's screens, a push) is U1's.
- **The refusals name what happened** (the move routes check the league as it stands, as every move did): someone knocked out in
  an episode they haven't revealed, or behind a race's finish, is told "You’re out of this game" or "This game ended with episode
  N" when they try a move, which spoils it. A pool's someone out (A10 part 2) has the same shape. Recommended: U1 offers no move
  past what the player's own view allows, and a refusal for someone behind says only that moves are closed. (U1.)
- **The game's early end is `lastEpisode`; everything else reads the span** (`endEpisode`): Game settings, the couch's span line,
  `currentEpisodeNumber`, a question's windows and the draft's finale predictions still treat episodes after a race's finish as
  the game's (nothing scores there: `spanView`). `over` is right everywhere. (U1: say "ended early" from `over` and `lastEpisode`.)
- **A corrected result that brings someone back** after one of their freed castaways was claimed: both own it in an exclusive draft
  (the claim kept the knocked-out player on it, for their history). Rare (a correction after a claim); recommended: keep both, and
  tell the maker (U1). (Whoever next touches waivers.)
- **The walk isn't memoised:** about five walks for a Games tab read of a game that cuts, one for every exclusivity check (a
  claim's `setOwner`, `freeAgents`), each the whole season's scores. Fine at a couch's size; a memo keyed to the state's version
  if a game grows (or a public pool cuts). (Whoever next profiles the engine.)
- **Outlast's table reads today's teams** (a pickup's whole placement counts at once, as it always has), while the walk reads each
  team as it stood: a still-in row's total and the walk's can differ for a move made after the latest results. Only the frozen and
  the cut read the walk. (R1, if Outlast's pickups ever count from when they're made.)
- The table's rows (`game-view.ts` `TableRow`) don't carry `out` (a score row does), so nothing says who's out or when. (U1.)
- **An episode where nothing scored can stay at early results for good** (the season sync marks an episode final on a scoring
  moment or the full answers: `season-decisions.ts`), as The Challenge 39's Episode 3 does in the blind replays. The walk counts
  such an episode once a later one has results; anything else that waits for final results (the "final results are in" push, the
  reveal's wording) may wait on it forever. (Whoever next touches results' stages: mark an episode final when the full results'
  run finds nothing to score.)
- Start a game, Game settings and the engine lab offer no race or cut fields (the lab starts the tracker's rows). (U1; the lab
  when it next changes.)

From A10 part 4b (2026-10-29):
- **For the user, in a design session (with A10 parts 1 to 4's questions), each with a recommendation (built as spec settings or
  server rules, the defaults in `SEATS`, `MAX_SEAT_PEOPLE` and `shared-seats.ts`):**
  1. How many people a team (`extras.seats.people`). Built: 2 when the spec says `seats: {}`, up to 4, none unless the game says so.
     Options: two only (the request is "my partner and I"); up to a family's four. Recommended: two by default, up to four where the
     maker says so, and sharing off unless asked for (it changes who's in the game, so it's never a silent default).
  2. Whether both must agree. Built: either of them makes the team's moves, the last one counts, who made each recorded
     (`seat_moves`). Options: a move one makes waits for the other's OK; one of them the team's captain whose word wins; a push to the
     other when one changes something ("casey changed your lineup"). Recommended: as built, with U1 showing who made each move on the
     team's own screens and no push (the Fan Who Forgets: a lineup waiting for an OK would sit unset at airtime).
  3. What the couch shows, and who's credited. Built: each person on a shared team is credited with its place (their own row in the
     couch's standings, the field counting the team once, a trophy each, head to head between the two a tie). Options: one team,
     credited once (a row "riley & casey", which isn't a person the couch's tables know: rankings, trophies and your numbers are by
     account); only the seat's first. Recommended: each credited, as built (couples on a couch want the season to count for both), and
     U1 showing a shared team once in a game's own table, with both names.
  4. How the second person joins. Built: an invite to the seat (the invites route's `playerId`), from someone on it or the
     commissioner, no OK needed from the commissioner when it's someone on the seat; refused while Who can join is locked or the game
     is locked down, while the seat is a late joiner catching up, and when it's full. Options: a "share my team" link; asking to join a
     team (as Ask to join); the commissioner's OK for every second person. Recommended: the invite now, a share link in U1, and Who
     can join's rule for it too (ask means the commissioner lets them in).
  5. Calls and bingo. Built: refused beside Weekly Calls, Weekly Bingo and a pool's weekly call, since a call is a person's own across
     every game (Call it's) and a bingo card is dealt to a person. Options: allow them, the team counting the better of the two's calls
     or lines, their sum, or its first's. Recommended: keep it refused (a couple plays those as two people, which is what they are),
     and the wizard saying why.
  6. What players and the maker are told, and the team's name. Built: the join's push says "casey joined", as any join does; the seat
     keeps its first person's name, and renaming an account doesn't rename a shared team; nobody is told when the other makes a move.
     Options: name a shared team after both ("riley & casey") when the second joins; tell the commissioner when someone joins a team.
     Recommended: both names by default when the second joins (changeable on the team's screen), and the join's push saying whose team
     ("casey joined riley's team").
  7. Someone leaving a shared team. Built: the others keep it as it is; the one who left comes back only by another invite (the seat
     isn't disabled, so it isn't theirs to reclaim), or by Undo, onto a free place. Recommended: keep; U1 saying so on Leave ("riley
     keeps the team").
  8. A late joiner and a shared team. Built: a seat still choosing where to start, or catching up, takes nobody else until it's caught
     up; where the seat's own state depends on a mark, it's the lowest of its people's (fail closed). Recommended: keep (catching up is
     one person's pace; two at two paces on one team would leave its week unclear).
- **Built, not decided by anyone:** a game that stops sharing keeps everyone already on a seat until they leave, and nobody new joins
  one; an invite that can't share any more lets them in as a new player (as a hand-over invite whose seat was taken does); a computer
  player's seat is never shared (it has no account to share with: the invite route hands it over as before); someone taken out of a
  shared team that's since filled can't be put back on it (Undo refuses, saying why).
- **What the screens still read one account a seat** (U1, and the desk lane's for the desk): classic's setup (`state/route.ts`'s
  `playerAccounts`, `players-section.tsx` shows one username); Members & roles (`backstage-members.ts` lists both under the seat's
  name); the desk's seat pages (`desk-seat-moves.ts` `lineFor` shows one, `desk-seats.ts` `unlinkSeat` says a seat "waits for an
  account" while the other still holds it, the desk's Link replaces rather than adds alongside); the test couch's stand-in seats
  (`test-couch.ts`); the faces in previews (`backstage.ts`, `ours.ts`, `rulings.ts`: whichever account's row came last). None of them
  changes a score or a mark.
- **The couch's game tables list a shared team once a person** (couch-hub's standings rows, item 3): a screen that shows a game's rows
  from the hub shows riley and casey as two rows with the same place. (U1: group a game's rows by `seat`.)
- **Cost:** a move on a shared seat writes one `seat_moves` row in its own transaction; a game that doesn't share pays nothing (no
  query). Joining to share reads the season's follow once. (The merge: a line in HOSTING.md.)
- **No caller passes `ctx.teams` (or `ctx.couch`)**, so the count by teams is the check's only; G1's context pack should pass the
  couch's people and, where a game shares, its teams. The blind replays play the tracker's two sharing games with one account a seat
  (sharing changes who acts, not what scores), so they prove the games play, not the sharing; the API check does that. (Whoever next
  touches blind.js: put two of its seats' people on one team in a game that shares.)
- **Part 3c's item 3** (a shared market straight to free agency once the results are in) wasn't taken here either: it's a waivers
  setting of its own, for U1 or a small part of A11.

From A10 part 4 (2026-10-29):
- **For the user, in a design session (with A10 parts 1 to 3c's questions), each with a recommendation (built as spec settings,
  the defaults in `KEEP` and `keepCostFor`):**
  1. How many keepers (`get.keep.each`). Built: 1 when it's left out, up to the team's size. Options: the user's own "keep 2"; a
     share of the team. Recommended: 1 by default (a keeper is a carry-over, the draft stays the main event), the maker's number
     where they say one, and at most the team's size less one, so everyone drafts at least once (not built: the check allows the
     whole team).
  2. What a keeper costs (`cost`). Built: a place on the team and nothing else (`place`: a snake passes over a full team, so a
     keeper costs one of your last rounds), one of a snake's earliest rounds (`round`: you sit out one of your first rounds for each),
     or their price at the draft out of a stock market's cash (`price`; under a salary cap the cap counts keepers like anyone on the
     team whatever they cost). Defaults: `price` in a market, else `place`. Recommended: `round` for an exclusive snake (keeping the
     best castaways costs your top picks, as in a keeper league; `place` there makes keeping a pure edge), `place` for a shared draft
     and a draw (nobody's pick is taken, so nothing to pay), `price` for a market (as built).
  3. Someone who names nobody by the draft (`fallback`). Built: `best`, they keep their best who are back; or `none`. Recommended:
     `best` (the Fan Who Forgets; the Drive-By).
  4. Two wanting the same keeper in an exclusive game (only when last season's game was shared). Built: first come (whoever named
     them first has them; the fallback's seats go after everyone who named theirs, in the draft's order). Options: neither (back in
     the pool); last season's lower finisher first. Recommended: first come, said up front ("whoever names them first has them").
  5. Keepers named in the open. Built: the game's state carries every seat's options and named keepers, so everyone on it sees them
     before the draft (the GET reads any seat's). Option: hidden until the lock (as a blind draft's picks are, in a table of their
     own). Recommended: open, as keeper leagues announce keepers (and in an exclusive game it avoids clashes).
  6. Who's "best". Built: last season's game's own measure (an Outlast by how long they lasted, then points; any other by its points,
     then how long they lasted). Recommended: keep.
  7. Knowing a person across seasons. Built: by name as each season's cast records it, made comparable (accents, case, punctuation,
     a nickname in double quotes, a Jr. or Sr.: `KeeperLogic.nameKey`), nothing looser, since nothing in the data links two
     seasons' cast rows (no person id; the photos' TMDB and TVmaze credits are matched by name and keep no id). Options: a person id
     kept from the listings when a cast is made; the desk confirming "back from season N" on a new cast. Recommended: names now, and
     the desk's confirmation when the cast pipeline next changes, so a returnee recorded by a new name (a married name, a nickname
     alone) isn't missed. (Whoever next touches season casts.)
  8. Run it back with keepers. Not built (no screen): Run it back makes a fresh game and records nowhere which game it ran back
     (the change log's words only). Recommended: Run it back offers "keep N from this game" (`from` set to it), and G1's context
     pack lists the couch's games on the show's earlier seasons as `ctx.games`, which the check already reads. (U1, G1.)
- **Built, not decided by anyone:** a keeper who leaves the cast after the lock (withdrew before the premiere) leaves an empty place,
  which the game's waivers fill as for someone gone home (a game without waivers stays short). A computer player has no account, so
  it keeps nobody. A game whose teams were drafted before its keepers locked keeps its teams (nobody keeps anyone). Keepers that come
  out of a spec after they locked keep their places (their last rounds in a snake).
- **The new design's draft room** still lays a snake out in full rounds (`draft-helpers` picksLeftFor, `draft-grid`'s rounds): with
  keepers it would show turns a seat never takes. `draft-view.ts`'s turns and each pick's round now follow the engine's
  (`KeeperLogic.turns`). No screen shows options, named keepers or what each kept. (U1: read the keepers route.)
- **Cost:** every write to a game whose keepers are open reads last season's league state and both leagues' members (keepers.ts, in
  a savepoint), and the keepers GET works the options out again; nothing once they lock. (The merge: a line in HOSTING.md.)
- **No caller passes `ctx.games`** (the couch's games on the show's earlier seasons), so `from` is checked only for its shape; the
  server offers nothing from a game on another show or a later season. (G1's context pack, the lab when it next changes.)
- **The blind replays start a tracker game without the couch's count** (`ctx.pool` and `ctx.couch`, A10 part 1's item): the first
  run of this part's shape.keepers row (an exclusive snake of five) ran out of castaways on Survivor 49 (four teams of five, 18
  castaways), as the 9:10 PM decision's check would have refused it had anyone passed the couch. The row now drafts four. (Whoever
  next touches blind.js or the lab: pass the replay's four seats and the cast as the count, so a row the pool can't cover is
  reported as the check would, not started.)

From A10 part 3c (2026-10-29):
- **For the user, in a design session (with A10 parts 1 to 3b's questions), each with a recommendation (built as spec settings,
  the defaults in `TRADE`, `MARKET_LEFT`, `marketWaivers`, 3b's `BUDGET`, `CAP` and `ceilingFor`):**
  1. The starting cash. Built: the budget (100), and the draft spends from it. With the default highest price, a team drafted
     before the premiere costs exactly the budget (every price is the middle, which an average team affords), so everyone starts
     with nothing left: trading is a sale to buy until prices move (worth changes only as prices do, and by fees). Options: (a)
     as built, said up front ("you spend it all on your team; what you sell for is what you buy with"); (b) a lower highest price
     for a market, so some cash is left to start (100 for 5: 1 to 35 leaves 10); (c) cash on top of the budget; (d) a lowest
     price of 0 for a market, so a replacement at the lowest price is always free. **The blind replays settle the direction:**
     with (a), someone gone home selling for nothing and the cheapest costing 1, nobody who hadn't made money trading could
     ever replace someone gone home (their teams emptied all season). Recommended: (b), a market's highest price set so the draft
     leaves a tenth of the budget, enough for a replacement at the lowest prices; with item 5's zero kept.
  2. How often trading opens. Built: after every episode until the next airs (a window after every episode, the whole team
     tradeable). Options: every two or three episodes (the windows' `every`); only when whoever runs it opens one. Recommended:
     every episode (it's what a stock market is).
  3. Claims first, then free agency. Built: as the waivers do (private claims, processed in waiver order a day before the next
     airs, then buys first come, first served), shared or exclusive. In a shared market nothing's contested, so the claims step
     only delays a trade. Options: a shared market straight to free agency once the results are in (a waivers setting: not
     built). Recommended: straight to free agency for a shared market, as its own small piece (part 4 or U1); exclusive keeps
     claims (two can want the same one).
  4. How it ranks. Built: the game's points by default (what each castaway scores while you hold them, as every draft ranks), or
     worth when the spec says so (cash plus the team at today's prices, ties to the points). Options: worth by default for a
     market; both, with a winner of each. Recommended: as built, with G1's words making "stock market" rank by worth (s22's
     spec does) and the screens showing both numbers.
  5. Someone gone home. Built: sells for nothing (3b's `gone: zero`, the default) or for the price they went home at (`last`).
     Recommended: nothing (losing value when yours goes home is the market's risk; `last` makes going home free).
  6. A fee or a limit on trades. Built: a fee each trade (`trade.fee`, 0 by default), on a swap and a replacement alike; the
     trades each window are the waivers' swaps (the whole team by default). Recommended: no fee and the whole team (cash itself
     limits trades); a fee of 1 if a couch churns.
  7. A replacement nobody can afford. Built: not filled at the close (they hold who they have); the autofill takes the most
     points among those they can afford. Option: the cap's fallback (the cheapest, cash below nothing). Recommended: keep
     (nobody spends what they haven't got).
  8. An auction's money left over (3b's item 11). Built, as a setting (`left`): cash to trade with where the game trades (the
     default), lost (worth nothing after the draft, as before), or a budget to bid on free agents with on waivers (`bids`:
     waits, not built). Recommended: cash where it trades, lost where it doesn't; blind bidding on waivers its own later piece,
     if a couch asks.
  9. Exclusive or shared (the 9:10 PM decision). Built: shared whenever the math says so; an exclusive market needs someone left
     over to buy (else "make it shared"), and as people go home an exclusive market's replacement waits for someone free (as an
     exclusive draft's waivers do). Recommended: shared by default for a market (s22), exclusive only for a small couch.
  10. Selling without buying (holding cash, a place empty). Not built: every trade is a sale and a buy, so a team stays full
     (lineups need it). Recommended: keep.
  11. A result corrected after trades. Built: each move keeps the prices it was made at (a trade is a trade), so a correction
     moves prices, and worth, from then on, never what someone paid. Option: re-price the trades after it (as the format's
     state over time works everything out again). Recommended: keep.
- **The classic screens rank a market by points:** the Standings card, the Scoreboard's lineup board, the player page, the
  season results card's champions and the reveal's "X leads with N" each build their own rank key from the points, and show
  points; the new design's table (`tableOf`) reads `StateLogic.rankKey` and shows worth. No screen shows cash, a price, worth or a
  trade's cost, and the waivers' claim and free agency screens trade without saying what anything costs (a refusal says why).
  (U1: read `StateLogic.rankKey` and `MarketLogic.view`; offer only what the view shows at their mark.)
- A draft made after results a viewer hasn't seen records its prices from them, so a viewer behind could read them in someone's
  cash, as 3b's refusal words can. (U1, with 3b's.)
- A late joiner given castaways (`activatePlayer`) pays nothing for them, and whoever runs the game can move castaways with the
  classic roster tools outside the ledger. (A11's late joiners; U1.)
- Computer players and the replays' seats trade by their ratings within their cash, not by price (no buying low, selling high).
  (Whoever next touches computer players, if a couch finds them easy.)
- `PriceLogic.prices` is worked out again on each read that needs it (the scores, the view, a claim). (U1's views: cache by the
  results' last change, with 3b's.)
- playtest.js's waiver record lists a week's moves when its run processes; the autofill at its close (when the next episode's
  results arrive) lands in the log after, so no week's record lists it (the cash follows it). (Whoever next touches playtest.js's
  waivers.)
- blind.js's table records each seat's points, in the engine's order; a market ranked by worth isn't recorded with its worth.
  (Whoever next touches blind.js's records.)
- The round-trip test (`every league in the local database round-trips through its spec`) fails while blind.js's games stand (`--keep`, or mid-run): a spread draft on The Challenge, its Rules sheet saying
  "teams" where the words say "groups". (Whoever next touches describe's group words; not this part's.)

From A10 part 3b (2026-10-29):
- **For the user, in a design session (with A10 parts 1 to 3's questions), each with a recommendation (built as spec settings,
  the defaults in `BUDGET`, `AUCTION`, `CAP` and `ceilingFor`):**
  1. The budget and the lowest price. Built: 100 each, the lowest price or bid 1. Recommended: keep (the user's own "$100"); the
     wizard shows them as assumptions. The currency word ("$", points, nothing) is the screens' (U0).
  2. A sealed auction or a live room. Built: sealed (everyone bids in private, settled at once, as the blind draft is), the only
     one the engine can run without everyone there at once. Options: a live room (someone nominates, a clock, bids in real time),
     a different engine piece (a nomination order, a bid clock, someone away) and screens. Recommended: sealed as the default
     (the Fan Who Forgets, the Drive-By: nobody has to be at a draft night); a live room only if a couch asks for a draft night,
     after U1, as its own step.
  3. What a winning bid pays. Built: what was bid (first price). Option: one more than the next bid on them (second price: bidding
     what someone's worth to you is safe). Recommended: first price (one sentence to explain: "you pay what you bid").
  4. When the bidding closes with sheets still out. Built: the moment everyone has a sheet in, or when the game's first episode
     starts; whoever runs the game can lock in an empty sheet for someone. Options: a close time of its own (the draft room's
     time plus a day). Recommended: keep, with Start a game opening the bidding a few days before the first episode and the
     screens saying when it closes.
  5. A team the bids didn't fill. Built: filled from what's left at the lowest price, from a seeded hat (fill), or left short.
     Recommended: fill (nobody plays short because they forgot); from a hat, not the best left, so not bidding never beats
     bidding.
  6. How a salary cap prices. Built: by where each stands on points so far by the game's rules (the best the highest price, the
     last the lowest, evenly between, ties sharing), the whole season's. Options: in proportion to the points (a runaway leader
     costs far more than the next); only the last few episodes (form). Recommended: by standing, the whole season (the same on
     any show's scale: Survivor's moment points, Dancing with the Stars' judges' scores).
  7. The highest price left out. Built: the one that makes the middle price what an average team can afford (100 for 5: 1 to
     39). Recommended: keep.
  8. **A salary cap drafted before the premiere prices everyone the same** (nobody has scored yet), so it bites only on changes
     after (the blind replays: every game is made before its premiere). Options: (a) as built, said up front ("prices start
     equal and move after each episode"); (b) prices from last season (not this season's data: the data rule refuses it); (c) a
     cap drafted after Episode 1. Recommended: (a), with Start a game offering the cap where the team changes (waivers every
     episode) and saying so; (c) where a maker wants the draft itself to bite.
  9. Someone gone home against the cap. Built: nothing (zero) or the price they went home at (last), zero by default; a
     replacement for them is never refused when nobody cheaper is free. Recommended: keep zero.
  10. A team over the cap after its prices moved. Built: it keeps its team; a change can't take it further over (the cheapest
     replacement for someone gone home excepted). Recommended: keep.
  11. An auction's money left over. Built: worth nothing after the auction. Options: carried into waivers as a budget to bid on
     free agents with (blind bidding on waivers), or as part 3c's cash to trade with. Recommended: decide with part 3c. (Taken
     by part 3c, as a setting: `get.budget.left`, its item 8.)
  12. An auction the pool doesn't cover, or shared. Built: refused, "make it a salary cap" (the 9:10 PM decision: an auction needs
     castaways nobody else can have, and its shared version is a cap). Recommended: keep, as G2's check turns it into a cap with
     the reason as an assumption.
- **The lane's database was 11 migrations behind after the sync** (master's 0420 to 0430), so every replay's game failed to start
  (`column c.deleted_at does not exist`) and `golden.js` counted the seasons that made no game as the same: applied with `npm run
  migrate` (this lane's local database), and `golden.js` now fails a season whose replays made no game. (Whoever next touches
  `lane.js sync`: run the lane's pending migrations after a merge that brings some, or say so.)
- **No caller passes `ctx.pool` and `ctx.couch` yet** (part 1's item), so an auction the pool doesn't cover is refused only where
  they're given. (G1, G2; the lab when it next changes.)
- **The screens don't know prices:** no bid sheet, no budget, no price beside a castaway, no cap on the draft board or waivers; the
  classic draft board reads the ownership; the draft room's view has an auction's budget and what each spent once settled, but
  no prices for a cap. A refused pick, sheet or claim answers with the reason. (U1.)
- The pick, blind and waiver routes check the cap against the league as it stands, as the group-slot route does: a player behind
  could learn a price from results they haven't seen from a refusal's words. (U1: offer only what the view shows at their mark.)
- Whoever runs the game can still give a late joiner castaways (`activatePlayer`) or edit a team (the classic roster tools)
  without the cap. (A11's late joiners; U1.)
- An auction's sheets share `blind_draft_picks` with a blind draft's picks (no migration): each withdrawal checks its own kind,
  and a draft switched from blind to an auction while picks are in reads those picks as no bids (filled at the lowest price).
  (Whoever next touches `setGame`: clear the table's rows when the draft's kind changes.)
- `PriceLogic.prices` walks the season's results on every call (cheap at a season's size; once a claim and once a pick now). (U1's
  draft room, if it shows prices on every read: cache them by the results' last change.)
- Computer players bid by their ratings' order, the budget by rank (`sheetFor`), not by what others might bid. (Whoever next
  touches computer players, if a couch finds them easy to outbid.)

From A10 part 3 (2026-10-29):
- **For the user, in a design session (with A10 parts 1 and 2's questions), each with a recommendation (built as spec settings,
  the defaults in `DRAFT_ACROSS`, `DRAW_OWN` and `spreadBounds`):**
  1. A guy and a girl (s06). Refused: no show's cast or research records who is which, and the data rule allows only what data
     settles. Options: leave it a can't-yet, offering the nearest ("one from each tribe"); or record it where the show itself
     splits by it (The Challenge's men's and women's eliminations, a couples show's pairs), as a cast field the desk sets from
     the show's own structure, never a guess research makes about a person. Recommended: leave it a can't-yet unless the user
     wants s06; if so, the show's own split only, set on the desk, and `get.across.of: gender` reads it (the engine's side is a
     group by another field).
  2. How even a spread is. Built: as even as a team's size allows (no more than ceil(each / groups) from one, at least
     floor(each / groups) from each while it has someone to take). Recommended: keep; "exactly one from each" is the same thing
     when the team is the tribes' number, and the wizard can say the team's size from the tribes at the start.
  3. After the draft (`then`). Built: keep, a castaway is yours wherever they go (a swap or the merge changes nobody's team),
     and a replacement or a swap on waivers comes from anyone. Options for later values: a replacement for someone drafted into a
     tribe's share comes from that tribe as the data has it then (while it exists); or a lineup spread across the tribes each
     week, read at each lock. Recommended: keep as the default; the lineup spread only if a maker asks.
  4. A show not divided when it drafts (the merge before a late start, a season with no tribes yet). Built: a plain draft, said
     in How it works. **The blind replays found it's the usual case for a draft before the premiere:** a season's cast shows its
     tribes from the premiere on (`tribes_from_episode` 1, a spoiler guard: Survivor 49's), so a league has none at a pre-premiere
     draft and "one from each tribe" drafts plainly. Options: (a) as built, said up front; (b) the spread draft waits for the
     groups (it can't start until the cast's groups reach the league: draft after the premiere); (c) the desk shows the starting
     tribes before the premiere when the network has announced them (`tribes_from_episode` cleared), so the draft can spread.
     Recommended: (a) as the fallback, with Start a game saying so when the season's groups aren't known yet and offering to
     schedule the draft after the premiere (G1's context pack, U1), and (c) on the desk wherever the tribes are public before
     the premiere.
  5. An exclusive spread or draw the pool doesn't cover. Built: the count refuses it where it knows the couch and the groups (no
     caller passes them yet: below); at the draft, a tribe too small for everyone goes first come in a snake and by the draw's
     order in a draw, and the rest take what keeps them spread; an exclusive hat that runs out leaves the last dealt short
     (`state.draw.short`). Recommended: keep, with G1's context pack passing the counts so Start a game makes such a game
     shared; a couch that grows past it afterwards carries on short.
  6. A draw's ownership said alone. Built: exclusive (one hat: names out of a hat are each different). Recommended: keep; shared
     where the math says so (the decision), with the reason as an assumption.
  7. Someone who joins after a draw. Built: as after any finished draft (a late joiner, or inactive until whoever runs it adds
     them). Recommended: deal them from what's left (exclusive) or their own hat (shared) when they join, automatically, so
     nobody has to; not built (A11's late joiners).
- **No caller passes `ctx.poolGroups`** (nor part 1's `ctx.pool` and `ctx.couch`), so the per-group count runs only where
  they're given: G1's context pack should (each group's size where the game drafts, the couch's size). (G1, G2; the lab when it
  next changes.)
- **The screens don't know a draw or a spread:** the classic draft board and grid (`draft-board.tsx`, `draft-grid.tsx`), the
  explainer and the setup sections read `ownershipMode === 'shared'` as a blind draft, so a shared draw would show a lock-in
  board; the new design's draft room reads the `draw` kind as a revealed blind draft (no screen of its own); nothing hints
  which tribe a team still needs (a refused pick shows the route's reason). (U1.)
- The classic draft-order route (POST /draft/order) still reorders a draw's order before it's dealt (inert: the seed shuffles
  the seats); the new design's draft room refuses it. (Whoever next touches the classic draft routes.)
- Part 3b is next: a draft's prices (an auction with a budget, a salary cap whose prices follow the data, buying and selling
  each week: s03, s04, s22, answer.bid, answer.trade), each with its fallback (a bid's ties, someone who never bids or trades).
  (Taken by part 3b, 2026-10-29: the auction and the salary cap; buying and selling split off as part 3c.)

From A10 part 2 (2026-10-29):
- **For the user, in a design session (with A10 part 1's slot questions), each with a recommendation (built as spec settings,
  the defaults in `BUYBACK`, `SECOND_PICK` and `fullSpec`):**
  1. A pool with lives: how it ranks, and how someone out reads. Built: the spec says (last one standing, `rank.by
     'standing'`, or the streak, frozen once out), and a pool with lives keeps the streak unless it says standing; someone out
     has no more picks and their season stops at the episode they went out. Recommended: last one standing whenever a pool has
     lives (a knockout pool is about who lasts; a streak with lives breaks while you still have some), so the GPT writes it.
  2. A missed pick. Built: it costs a life (as it breaks a streak today), and a mulligan forgives it. Recommended: keep, and
     pair it with A10 part 1's item 7 (fill a missed pick at the lock: the safest one still eligible), or the Fan Who Forgets misses her way
     out of a pool with lives.
  3. A buyback. Built: automatic (out before its deadline, while one's left: back in), back with one life, its cost one right
     pick's points (up to 20) off the total, which can go below 0. Recommended: keep automatic (nobody waits for someone; under
     last one standing everyone would buy back, so asking only punishes forgetting), one life, the cost as built.
  4. A buyback until a phase whose start isn't known. Built: it stands until data says the phase started; a start confirmed
     later at or before the knockout takes it back (worked out live, as every result is). Recommended: keep (data settles it),
     and tell the maker and the player when a correction takes one back (U1's).
  5. A second pick. Built: open every episode, optional, counting only on a night the results show two or more went home; void
     (no points either way) on a night only one goes, or counted like the first (`fallback: 'counts'`). Nothing at a lock says
     a night is a double (the schedule has a runtime only, no rulebook marks one). Recommended: keep it open every episode,
     void by default; a desk mark ahead ("a double tonight") only if a show's schedule ever says so (not built).
  6. A night with one right pick and one wrong. Built: its right picks count first, then its wrong ones, so the streak ends
     whichever was wrong; a night that empties lives buys back or goes out once. Recommended: keep.
  7. A mulligan. Built: automatic, on the first wrong or missed pick. Recommended: keep (a mulligan you play before a lock is a
     joker, a different piece: A14's, if asked for).
  8. Everyone out. Built: the game runs to the season's end with nothing to pick (`gameOver` unchanged), and nobody is named
     the winner early. Recommended: once at most one player is left in (of two or more), the game ends and names them; the
     user's call, with what the table says then. (A11 part 2 built it as a setting, `rank.oneLeft`: its item 2.)
  9. Everyone left goes out on the same night. Built: all out, ranked by their points. Recommended: the classic pool's rule,
     all of them back for the next episode. (A11 part 2 built it as a setting, `rank.allOut`, back among its values: its item 3.)
- **A pick of the season's winner is wrong at the finale** (today's pools too, before this step): `history` grades a pick
  right when its person isn't among the episode's exits, and the winner's "Sole Survivor" is one. So every finale pick is
  wrong, and with lives the finale costs everyone a life. Recommended: the winner (and, by the rulebook, the finalists) survive
  the finale; it changes today's pools' finales, so it's the user's to say. (R1, or whoever next touches pool grading.)
- **The screens don't know a pool's parts:** the Scoreboard's `poolKey` and ranks, `SeasonResultsCard`'s champions,
  `reveal-moment`'s "you beat", the standings card and the player page sort and say a pool by its streak; the Games tab's
  table ranks a standing pool by the engine (`tableOf`) but its `total` column is still the streak. Nothing shows lives, an
  out, a buyback, a mulligan or a second pick, and Tonight's pick card for someone out shows nobody to pick. (U1.)
- The pick routes still answer a refused pick with 200 and nothing stored (their convention): someone out, a second the same as
  the first, a cleared pick in a locked two-pick pool. (U1, or whoever next touches the pick routes: a 400 with the reason, as
  the group-slot route does.)
- Start a game and Game settings offer none of part 2's pieces; the engine lab starts them. (U1.)
- A late joiner's second pick goes through `GhostLogic.applyAs` with their pick, but no check plays it. (A11's late joiners.)
- A11's knockouts (a guillotine, a cut at a phase) can reuse `rank.by 'standing'` and a row's `out`; a pool's lives are its own
  (`score.lives`). (A11.)

From A7 (2026-10-28):
- The late lock is a game of questions' only: lineups and picks still lock at airtime, whoever watches when. (A15, each
  viewer's own clock.)
- When a phase's start is only known once it's begun, the episodes between its start and where its window opens count in the
  previous phase's window (a window runs to where the next opens). (Whoever next touches phase windows.)
- A window over the whole game (a boot order, who it happened to most) settles only at the end; nothing scores as it goes.
  (A8's orders show it most; U1's results screens may want "so far".)
- Start a game doesn't offer windows, a phase question or the late lock (no screens: U1).

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

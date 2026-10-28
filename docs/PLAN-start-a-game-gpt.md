# Plan: the Start-a-game GPT, on games as data

Status: **planned 2026-10-27**. **A1 built** the same day and **A2 built** on 2026-10-28, both on the `engine` lane, not
merged (their As built under track A). **A3 runs in two parts:** part 1 (later episode starts, moving a start, the rest of
BACKLOG item 10, and the phase start's design) built 2026-10-28 on `engine`; part 2 (phase starts) next. The rest not started. **Waiting on the user (A2):** the game-specs flag in production
(a Neon branch check from your terminal, then on), after the merge. The user's idea, their decisions and the order are below; each step is its own
session (Opus 5.5 at xhigh). Siblings: `docs/PLAN-sports-live.md` (on the `sports` branch: live sports, its Sport classes and
formats, written against this plan's game spec) and `docs/PLAN-researched-survivor.md` (Survivor's switch, now mid-season:
track S here).

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
| Order | **The engine first, the GPT right after it** (shows and today's games), **then the sports branch**; the GPT learns the sports formats when the branch merges. |
| The wizard | **A healthy balance:** people always see what they're making, in plain words; details they don't care about stay out of sight (recommended, changeable later, never asked). |

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
words ──(bot)──▶ request ──(resolver)──▶ game spec ──(wizard)──▶ Start ──▶ a league playing settings.game
         what they said,           ids, every rule data,        what they're making,
         in our shape, no ids      our defaults filled          only the unknowns asked
```

- **Two structures, on purpose.** The bot answers with a **request**: what the person said, in our shape, in their words,
  with no ids. Our code turns it into a **game spec**: ids, numbers and references to the show's moments or the sport's stats,
  with our defaults. **The bot understands; our code decides.** Defaults, ids, what fits and what data can settle are never the
  bot's guess, so the same words make the same game, and the bot's job stays small (faster, fewer mistakes).
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

**The three examples as specs** (fixtures in A1; end to end in G2 and G3):

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

## The request (what the bot answers)

The prompt is generated from the spec's vocabulary (as the rulebook prompt is generated from `OPT`), with today's date and the
person's words marked as a description, not instructions. No web search: the resolver looks things up, not the bot. The
answer:

```jsonc
{ "request": 1,
  "about": { "show": "Survivor", "season": "51", "sport": null, "league": null, "teams": [], "event": null },
  "when":  { "kind": null, "said": null },         // season | rest | next | one | series | from | through, and their words
  "game":  { "named": "fantasy league",            // their own name for it, if any
             "get": null, "count": null,            // e.g. draft, 3 each, own/order if said; "start 3" if said
             "score": [],                           // e.g. [{ "for": "home run", "points": 5, "per": "each" }]
             "ask": [] },                           // e.g. [{ "ask": "top scorer", "answer": "player", "stat": "points", "take": "most" }]
  "unsure": [] }                                    // anything said that didn't fit, quoted
```

Only what the person said or plainly meant goes in; the rest is null; numbers are never invented.

## The resolver (words to a spec)

- **What it's about:** a show and season from the catalog, else TVmaze (a show not here is added as "Not a game yet"; a season
  by its number, which `pickSeason` can't do today). A show that isn't set up chains Make it a game (the bot, 2–4 minutes, with
  its progress) and comes back. Sports: teams through ESPN's `find`, games from its schedule (the sports branch).
- **When:** the span from the season's episodes (the next one, the rest, through the finale, from a phase: A3); for sports, a
  series, one game, the next few (the sports branch). A past event becomes a question: "The 76ers' home opener was Oct 22.
  Their next home game is Oct 30 against the Knicks?"
- **The game:** the person's name for it to a preset ("fantasy league" is a draft; which one is asked); "draft 3 each" to
  `get.each`; score words to the rulebook's moments by label, or for sports to the Sport's stat keys by ESPN's own labels; a
  show moment that isn't there becomes a research question only after a second, short ask rates it reliable; questions to
  `ask`, with their settle.
- **Defaults:** the preset's, plus what fits the people and the pool (the draft size cut to who's left, as Start a game does
  today).
- **What's left to ask:** every required field with no safe default: which game, which game night, a line ESPN hasn't got, a
  stat no data counts (with the nearest ones offered). Everything else goes into the wizard's sentence, not a question.

## The wizard (G0 designs it, with impeccable)

- **The game in a sentence or two** at the top: "A Weekly Lineup for Survivor 51: everyone drafts 5 and starts 3 each episode,
  Episode 7 to the finale. Scored by Survivor 51's rules." What they said reads as theirs and what we chose reads as ours, so
  nothing is assumed silently.
- **Questions only for the unknowns**, the recommended answer first. A basic game is one tap to start.
- **The details nobody asked about** (draft order, timer, who can join, waivers, ties) are recommended and out of sight, in
  Backstage › Game settings later, as today.
- **Start** works as today's does (on the couch, linked to its other games, Tell the couch), from the spec.
- **For G0 to design:** where the field lives (my recommendation: every Start a game entry opens it, the show filled in when
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
- **S3. The switch.** After two episodes with every table matching at today's points, the three real games move onto the data
  rules (with the user's OK). Then `survivor.js`'s code half, `BUILT_IN_READERS` and legacy freezing go, and Traitors' and the
  Challenge's built-ins with them once nothing plays them.

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
- **A4. Questions settled by data** (`ask`).
  - The answer kinds and the lock (`closedForPlay`).
  - Answers stored per game (like `episode_calls`), graded on read from the season's results (the shows' settles), with points
    and standings.
  - Weekly Calls and finale predictions become presets of it, scores unchanged.
  - Answering and results in the new design, with impeccable.
  - Sports' settles are the branch's.

**G. The Start-a-game GPT** (master, after A).
- **G0. Design.** Impeccable `shape`, then a mock in `.impeccable/mocks/start-a-game/` of the wizard and everything listed under
  it above, at 390. The user confirms before anything is built. It can run any time.
- **G1. Words to a spec, no UI.**
  - The request and its prompt.
  - `askBot` with search off and `priority`. In llm-browser-api, `Worker` gets a `PriorityQueue` and `/ask` takes
    `priority: "now"`; deployed to the VM with the user's OK.
  - The parser and repair (as `parseRulebookAnswer` does), the resolver, the reliability ask for a new show moment, and what's
    left to ask.
  - A bank of sentences (`tests/fixtures/game-words/`: sentence → request → spec), run on the stand-in bot
    (`scripts/dev-test/fake-bot.js`), and `scripts/dev-test/check-game-words.js` against the real bot (writes nothing).
  - A daily cap per person (Make it a game's is 5).
- **G2. The GPT in the app.**
  - The field and the wizard in Start a game, and Start from a spec.
  - Make it a game, chained for a show that isn't set up.
  - A sports request gets as far as today's sports games go and says what isn't there yet.
  - Checked at 390 on Night and Studio with a zt- fixture.
- **G3. The GPT learns sports** (after the sports branch merges): teams and games from ESPN's schedule, stat words to the
  Sport's keys, sports settles, and the over/under line from ESPN's odds. The Red Sox and 76ers sentences pass end to end.

**The sports branch** (`PLAN-sports-live.md`): its design (step 0) and live data (step 2) can go any time. Its framework,
scoring and formats (steps 1 and 4–6) build on A1–A2, so master gets merged in first. It adds:
- games straight from ESPN's schedule;
- stored finals and odds;
- total bases from plays;
- each Sport's stat keys;
- the sports' default specs (data);
- its formats as spec mechanics;
- the sports' settles.

**Suggested order, one session at a time:** S1 → S2 (the test couch starts proving) → A1 → A2 → S3 (once proven) → A3 → A4
→ G1 → G2 → the sports branch → G3. G0 can come any time before G2. Run in lanes (next section), the same steps take about
half the calendar time.

## Running steps at the same time (lanes)

The user asked (2026-10-27) for the plan to say what can run at once, so work goes faster without losing quality. The idea: a
**lane** is one line of work. Each lane has its own folder (a git worktree), branch, local database, dev-server port and session
loop. Sessions in different lanes never share a file in flight, a database or a server. Within a lane, steps run one after
another, as today. `docs/PARALLEL-SESSIONS.md` has the setup.

| Lane | Folder (worktree) | Branch | Database | Port | Steps |
|---|---|---|---|---|---|
| Main | `reality-fantasy-leagues` | master | `reality_fantasy_leagues` | 3000 | the user's own work, merges, production fixes |
| Survivor | `../rfl-survivor` | `survivor-data` | `rfl_survivor` | 3001 | S1 → S2 → S3 |
| Engine | `../rfl-engine` | `engine` | `rfl_engine` | 3002 | A1 → A2 → A3 → A4, then G2 → G3 |
| GPT words | `../rfl-gpt` | `gpt` | `rfl_gpt` | 3003 | G1, from when A1 is on master |
| Sports | `../reality-fantasy-leagues-sports` | `sports` | `rfl_sports` | 3004 | its steps 0 and 2 now; 1 and 4–6 once A2 is on master |
| Design | the main folder (the mocks in `.impeccable/mocks/` aren't in git) | – | – | – | G0 and the sports design: with the user there, never unattended |
| Playtest | `../rfl-playtest` | `playtest` | `rfl_playtest` | 3005 | docs/PLAN-playtests.md: season tapes (recorded from the local bot) and replays of them (since 2026-10-28) |

**What can run alongside what:**

| Step | Needs first | Can run at the same time as |
|---|---|---|
| S1 | nothing | A1, G0, sports 0 and 2 |
| S2 | S1 | A1 or A2, G1, G0, sports 0 and 2 |
| S3 | S2, and two episodes proven on the test couch | A3, A4, G1; not while a step is mid-change in `state-logic.js` (S3 touches `formatOf`) |
| A1 | nothing | S1 or S2, G0, sports 0 and 2 |
| A2 | A1 | S2, G1, G0, sports 0 and 2 |
| A3, A4 | A2 (one after the other: both change `state-logic.js` and Start a game) | S3, G1, the sports branch |
| G0 | nothing | anything (it needs the user, not a lane) |
| G1 | A1 (the schema; later starts and questions are already in it, so the resolver writes them before A3/A4 build them) | A2–A4, S, the sports branch |
| G2 | A2, G0 and G1 (A3 and A4 too, so the GPT starts with later starts and questions) | the sports branch |
| G3 | the sports branch merged | – |
| Sports 0, 2 | nothing | anything |
| Sports 1, 4–6 | A2 on master, merged into `sports` | G1, G2, S |
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
   `start-game.tsx` (the engine lane: A2, A3, then G2), `db/episode-research.js` and the rulebook compiler (the survivor lane).
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
   VM deploy (G1), Survivor 51's switch (S3), merges and pushes, and design reviews (G0, the sports design). The user's attention
   is the real limit, so **start with two lanes** (Survivor and Engine: S is time-bound, A is the longest path), add the sports
   lane's steps 0 and 2 when there's room, and the GPT words lane once A1 is on master.
9. **Lanes share one usage window.** Three lanes at xhigh use it about three times as fast; each session loop pauses itself near
   the limit (`--pause-at`).

## Risks and open points

- **The half-minute wait.** It's always the bot. G0 designs the wait, and the progress stream already exists. Even with the
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
  games" (`show/games.tsx` 402). (G2.)
- Sports games score from ChatGPT research, against "ChatGPT never for stats"; `research-asks.ts` 20-21 says a sport's results
  come from its sports data, which isn't built. (The sports branch's stat scoring.)
- A sport's cast stops growing from ESPN once it's a game (`cast.ts` `castable`). (The sports branch.)

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

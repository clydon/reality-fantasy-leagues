# Core game catalog

Generated from the current engine by `node scripts/core-game-catalog.js`. Machine-readable companion: [core-game-catalog.json](core-game-catalog.json). Regenerate after changing the schema, wizard, page grammar or sports defaults. `--check` checks both files without writing.

The app has **8 engine families**, **8 show-wizard starting bases**, **15 generated-page patterns**, and **16 answer controls**. These are different classifications, not counts to add together. The five named presets do not describe the entire engine.

There is no single finite list of all configured games: the engine composes compatible pieces, numeric settings, question content, time spans and stages. This catalog is the complete current inventory of the finite core families and control/page enums, plus the source-defined named starting forms and their variations.

## All engine families

| Engine type | Core play forms | What it does |
| --- | --- | --- |
| `classic-draft` | Outlast / placement draft | A drafted team scored by placement; supports reversed placement and compatible draft/ranking modifiers. |
| `active-roster` | Lineups, best ball and scored rosters | Drafted moment- or sports-stat scoring: selected starters, automatically selected best N, or a whole sports roster. Also the home for compatible objectives, captain, category and market variants. |
| `pickem` | Survival pools and weekly participant picks | One survival pick per episode, or one/multiple fresh picks scored by show moments. Lives, streaks and points apply only where their spec is compatible. |
| `weekly-calls` | Weekly Calls | The show-specific recurring calls, counted by their specialized grading flow. |
| `weekly-bingo` | Weekly Bingo | Episode cards graded by completed bingo lines. |
| `questions` | Prediction / answer games | Arbitrary compatible question sheets, including sports winner/slate picks, brackets, trivia, confidence/chip/pair controls and player-built tickets. |
| `stages` | Multi-stage / hybrid games | Compose supported child games sequentially or alongside each other, with overall scoring; compatible stage rules can follow format changes or other seasons/shows. |
| `squares` | Sports squares | Hold squares on a two-team score-digit grid; the relevant period/halftime/final score pays the winning square. |

A sports game called **Pick’em** usually plays internally as `questions` with `answer: side` or `person`. The internal `pickem` family also covers fresh show-moment picks. Game names alone are therefore not a reliable basis for choosing an overview component.

## The eight show-wizard starting games

| Game | Generator base | How you play |
| --- | --- | --- |
| Weekly Lineup | `lineup` | Draft a roster and choose the starters that count each episode. |
| Best Ball | `best-ball` | Draft a roster; the engine automatically counts the best N each episode. No manual lineup. |
| Outlast | `outlast` | Draft a team; every holding scores by how long it lasts. Reversed placement scoring is an optional variation. |
| Prediction Sheet | `questions` | Answer a configurable sheet of predictions; questions can use any compatible answer/settlement controls. |
| Weekly Picks | `picks` | Pick one or several participants afresh each episode and score what they do. This is distinct from drafting a roster. |
| Survival Pool | `pool` | Pick one participant per episode to survive or meet the game’s scoring condition; track a streak, points or lives. |
| Weekly Calls | `calls` | Play the show’s specialized recurring two-call format. This is distinct from arbitrary prediction questions. |
| Weekly Bingo | `bingo` | Play an episode bingo card; completed lines score. |

The five frozen presets are `outlast`, `weekly-lineup`, `survival-pool`, `weekly-calls`, `weekly-bingo`. Best Ball, Weekly Picks and generic Prediction Sheets are additional generator bases rather than separate frozen preset entries.

## Sports starting forms

| Form | Default ID | Where explicitly declared |
| --- | --- | --- |
| Season roster / lineup league | `season` | baseball, basketball, football, golf, hockey, mma, racing, racing/f1, racing/irl, soccer, tennis |
| Short draft / whole-roster game | `short` | baseball, basketball, football, golf, hockey, mma, racing, racing/f1, racing/irl, soccer, tennis |
| Winner / sports pick’em predictions | `pickem` | baseball, basketball, football, golf, hockey, mma, racing, soccer, tennis |
| Pick several athletes in a stat prediction | `pickAFew` | baseball, basketball, football, golf, hockey, racing, soccer |
| Sports best ball | `bestBall` | baseball, basketball, football, golf, hockey, soccer |
| Head-to-head categories | `categories` | baseball, basketball, hockey |
| Rotisserie categories | `roto` | baseball, basketball, hockey |
| Sports squares | `squares` | basketball, basketball/mens-college-basketball, football |
| Tournament / playoff bracket | `bracket` | baseball/mlb, basketball/nba, basketball/wnba, football/nfl, hockey/nhl, tennis, tennis/wta |

There are **49 base declarations across 9 sport-default files**, plus **11 league-specific declarations**. These are declarations, not 60 distinct mechanics; league specs merge over the sport’s defaults. Brackets may require a playoffs context. A default’s existence does not mean every league, event or sports-start rail offers it. See [sports start rails](../src/lib/sports/start-games.ts), [sportGames](../src/lib/sports/page.ts) and [defaultsFor](../src/lib/sports/index.ts).

## The sixteen answer / prediction forms

| Control | Play form |
| --- | --- |
| `person` | Pick participant(s) |
| `group` | Pick group(s) / tribe(s) / team(s) |
| `yesNo` | Yes / no |
| `number` | Number prediction |
| `overUnder` | Over / under a line |
| `choice` | Choose a listed option |
| `calls` | Specialized show calls |
| `order` | Ordered predictions |
| `confidence` | Confidence-ranked predictions |
| `chips` | Spread chips over participants |
| `split` | Split an allocation |
| `pairs` | Pair / match participants |
| `side` | Pick a sports matchup’s side |
| `bracket` | Round-by-round bracket |
| `trivia` | Trivia answers |
| `ticket` | Build a multi-leg prediction ticket |

These can create distinct prediction experiences: a winner pick, several athletes, a score/number estimate, an over/under, an ordered finish, confidence picks, chips, allocations, pairs, brackets, trivia or multi-leg tickets. They are answer controls inside a game, not sixteen independent engine families. Cards chosen from moments, by the bot or by a rotating host are also content-source variations where compatible.

## Ways to win and larger structural variants

| Rank | Meaning |
| --- | --- |
| `total` | Most points |
| `streak` | Longest streak |
| `standing` | Last one standing / elimination ordering |
| `worth` | Cash plus current holding values |
| `coop` | The couch wins or loses together |
| `matchups` | Head-to-head wins / losses |
| `weeks` | Most episodes / weeks won |
| `categories` | Head-to-head stat categories |
| `roto` | Rank points across stat categories |

Also supported as compatible structures/modifiers:

- **Race to a target** (`rank.race`).
- **Guillotine / cuts / last-player-standing** (`rank.cut`), or lives-based elimination for eligible pools/question games.
- **Co-op survival**: shared lives against the show; this is a question-game structure, not arbitrary co-op on every base.
- **Stock-market play**: buy/sell holdings; compatible moment-scored drafted games can rank by cash plus holdings’ worth. A market can also rank by points.
- **Objective collection** (`score.hits: objective`): complete each objective rather than repeatedly scoring every hit.
- **Category head-to-head or roto**: compare actual stat columns rather than adding incompatible stat units into a points total.
- **Teams of people**: combine seats into teams by sum/mean; this is distinct from a player’s drafted cast roster.
- **Multi-stage / parallel / cross-season games**: change or combine child games, including compatible format-change starts. Current child-type list: `classic-draft`, `active-roster`, `pickem`, `questions`, `weekly-bingo`, `weekly-calls`. Squares is not in that child-type list.

Not every base supports every rank or modifier. For example, bingo and specialized Weekly Calls rank by totals; show-moment picks have different race/cut restrictions from drafted rosters; sports-stat picks directly in `get.by: pick` are rejected, while athlete-stat prediction questions are supported. Use the validator instead of a Cartesian product.

## Modifiers that create the thousands of combinations

- Acquisition: snake, blind, random draw or auction; shared/exclusive ownership; salary caps, group slots, spread drafts and keepers where compatible.
- Roster management: starters, bench, best N, captain, waiver/replacement/swap windows and permitted trading.
- Pick rules: one or several, cycling, never-repeat or free-repeat, second picks, lives, mulligans and buybacks where compatible.
- Scoring: show moments or sports stats, custom weights, reverse placement, objectives, multipliers by episode/phase/finale or acquisition history.
- Prediction extras: wagers/banks, confidence, split pots, only-right scoring, rollovers, shrinking values, parlays/tickets, majority/minority-style settlement and beating the bot.
- Social/competition extras: teams, bounties, secret roles, player-chosen twists, redrafts, handicaps, playoffs and eligible joining rules.
- Time/content: one episode/event, several, rest of season, phase boundaries, game/daily/weekly locks, and moment/bot/host-sourced cards.

The seeded randomizer itself exposes **31 named twists**: `captain`, `finale-double`, `first-double`, `reverse`, `draw`, `auction`, `finale-picks`, `boot-call`, `bounty`, `roles`, `top-twist`, `only`, `objectives`, `group-slot`, `spread`, `replacements`, `mulligan`, `second-pick`, `never-twice`, `buyback`, `split-pot`, `only-right`, `rollover`, `double-or-nothing`, `bank`, `parlay`, `beat-bot`, `majority`, `teams`, `redraft`, `trivia-too`. This list is narrower than the full spec language. Each candidate is still checked against its page context.

## All generated main-page patterns

| Main block | Primary information |
| --- | --- |
| `together` | Shared co-op outcome, lives and progress |
| `race` | Progress toward a points target |
| `matchup` | Head-to-head matchup and record |
| `categories` | Stat-category comparisons, head-to-head or roto |
| `worth` | Market holdings, prices, cash and total worth |
| `week` | Episode/week winners and weeks won |
| `board` | Sports squares grid and payouts |
| `card` | Bingo card and lines |
| `objectives` | Objectives hit / completed |
| `team` | Drafted roster, contributions and totals (Outlast, lineup, best ball or stats) |
| `picks` | Fresh participant picks scored by what they do |
| `ladder` | Survival picks, streak and/or remaining lives |
| `slate` | Predictions across a sports slate / matchup sides |
| `ballot` | Prediction or answer sheet |
| `stages` | Stage progress and overall results |

These patterns are the main graphic selected by the compiler, not the whole game taxonomy. An Outlast, lineup and Best Ball can all use `team`; a head-to-head modifier can make their primary graphic `matchup`. `compileGame` separately handles `stages` before using `mainOf` for each child. Controls, moves, badges, tables and events are composed alongside the main pattern.

## What is explicitly not available yet

| Dial | Value | Status |
| --- | --- | --- |
| `pool.where` | `group` | later |
| `ask.settle` | `outside` | later |
| `multiply.on` | `streak` | later |
| `multiply.on` | `picked` | later |
| `get.across.of` | `gender` | later |
| `get.budget.left` | `bids` | later |

This includes arbitrary group pool filters, outside-source settlement (the TVmaze-rating path remains gated), streak/draft-position multipliers, gender-spread drafting and carrying draft money into waiver bids. A vocabulary entry or a UI grammar entry is not proof that a game can actually start.

## How a game becomes playable

1. The show’s rulebook supplies cast, moments, exits, phases and settleable facts; sports adapters supply the corresponding stats, games, results and eligible participants.
2. The wizard, seeded randomizer or typed/AI-assisted creation path produces a `GameSpec`.
3. `fullSpec` resolves defaults. `specProblems(spec, ctx)` checks structure and the page’s data; `specWaitsFor` rejects unimplemented or incomplete combinations; `typeOf` checks placement in the scoring sequence. The server repeats these gates.
4. The scoring sequence holds participants, scores lines, applies multipliers, combines results, resolves the week and ranks players.
5. `compileGame(spec)` produces a deterministic page description. The UI draws those compiled blocks; no AI invents a new page each time someone opens it.

Sources: [schema](../src/lib/game/game-spec/schema.js), [wizard](../src/lib/game/start-wizard/index.js), [randomizer](../src/lib/game/game-spec/roll.js), [server checks](../src/lib/server/start-spec.ts), [sequence](../src/lib/game/sequence/index.js), [page grammar](../src/lib/game/game-page/grammar.ts), [compiler](../src/lib/game/game-page/compile.ts).

## Coverage for the UI review

Use this catalog to cover more than lineups: roster/placement, auto-best-ball, survival, fresh picks, answer controls, bingo, calls, squares, markets, categories, races, co-op and stages have different information needs. Expansion/scoring views and permitted opponents’ choices should follow their underlying structure.

`node scripts/dev-test/game-page-census.js --rolls 150` samples specs, not all possible configurations. At the catalog’s initial verification it compiled 1,337 specs (1,160 rolls, 123 fixtures, 49 base sports defaults, 5 presets), with no grammar holes, 92 drawn places and no malformed words in 4,011 phase models. It exercised 14 of the 15 main blocks; `objectives` was absent from that sample. This generator separately verifies a playable objective example. The existing census also does not enumerate league-specific default overrides. Neither result proves rendered, responsive or end-to-end play coverage for all configurations.

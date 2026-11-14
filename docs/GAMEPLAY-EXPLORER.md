# Gameplay explorer: documents, analysis and execution

Implemented: plan chunks **0–2**, plus the **headless portion of Chunk 3**. Full-spec definitions in an explicitly supported profile now share a seeded world, production projections/actions, answer stores, clock, atomic traces and replay/checkpoints through Node, CLI and HTTP. A stateless browser transport calls that same endpoint, and the visible bench now opens v2 definitions in the same runtime, with the actual application frames reading and writing through it (see [Bench bridge](#bench-bridge)). Snapshot reconciliation and caching remain before declaring Chunk 3 complete. No new visual design or UI coverage is approved.

See the [implementation plan](PLAN-GAMEPLAY-SCENARIO-EXPLORER.md) for the remaining chunks and the [bench guide](GAMEPLAY-BENCH.md) for current playable fixtures.

## Start here

Inspect the included non-recipe prediction sheet, with participant and yes/no answer controls:

```powershell
node scripts/gameplay-bench.js inspect --file=tests/fixtures/gameplay-explorer/questions-input.json
```

Execute it without a recorded dataset, app server, browser, database or provider request:

```powershell
node scripts/gameplay-bench.js execute --file=tests/fixtures/gameplay-explorer/questions-input.json --out=.ui-atlas/questions-run-01.json
node scripts/gameplay-bench.js execute --file=.ui-atlas/questions-run-01.json --out=.ui-atlas/questions-resumed-01.json
```

The output contains a durable `gameplay-execution` bundle, not an ephemeral bench ID. Existing output files are preserved; choose a new filename for each attempt. No campaign starts from these commands.

Save the full analysis instead of printing its entire graph:

```powershell
node scripts/gameplay-bench.js inspect --file=tests/fixtures/gameplay-explorer/questions-input.json --out=.ui-atlas/questions-analysis.json
```

Normalize a preserved version-1 replay into the new document:

```powershell
node scripts/gameplay-bench.js normalize --file=tests/fixtures/gameplay-explorer/legacy-lineup-v1.json --out=.ui-atlas/lineup-document-v2.json
node scripts/gameplay-bench.js inspect --file=.ui-atlas/lineup-document-v2.json
```

Inspect current discovery counts and the preserved baseline inputs:

```powershell
node scripts/gameplay-bench.js baseline --out=.ui-atlas/explorer-baseline.json
```

Outputs preserve existing files. Choose a new filename when saving another revision. Normalization requires `--out`; it never overwrites the original.

Inspection/normalization/baseline commands do not require the app, recorded Atlas dataset, provider requests or database access. Existing `generate` still uses the recorded dataset and pilot generator. An optional `generate --format=document` exports that pilot run in v2; it does not make the v2 runtime playable. The existing browser replay loader continues to accept v1 files.

CLI `inspect` returns exit code 2 for an engine-invalid definition, 1 for malformed input/tool errors and 0 for successful inspection of other definitions, including definitions with adapter gaps. Exit 0 is **not** a runnable-game or UX pass. Inspect the separate engine/readiness/plan states.

## Accepted inputs

`inspect` and `normalize` accept:

1. A complete `gameplay-scenario` document, schema version 2.
2. A complete `gameplay-bench` export, schema version 1, with its snapshot and commands.
3. A `{ "spec": { ... }, "context": { ... } }` envelope. The spec can be any engine definition, not just a wizard recipe or seeded roll.
4. A bare game spec accompanied by `--context-file=<actual-context.json>`.

There is no implicit Survivor context for arbitrary specs. Full production contexts from existing fixtures can be reused. A spec is preserved as supplied; analysis separately exposes its engine-normalized form, including expanded defaults. Invalid definitions can be inspected without turning them into valid substitutes.

Only JSON data is accepted. Structural validation checks IDs/references, game memberships/roles, viewer marks, context/event relationships, clock/timezone, history position, stage bindings and supported document versions. Unknown top-level/game configuration fields are rejected rather than discarded. Game-specific rules belong in the spec and are checked by the engine.

Current local inspection budgets are 12 MB per CLI input file, 250,000 JSON values and nesting depth 64. Dependency planning also has a bounded graph/depth budget. These are tool limits, not gameplay restrictions. Credential-shaped fields, non-finite values, cycles and reserved object keys are rejected. Existing Atlas replay-account validation applies to archived bundles.

## Scenario document contract

The runtime validator/constructors live in `tools/gameplay-bench/explorer/document.cjs`. Use `create` for a document with multiple contexts/games, `fromSpec` for one full spec and explicit context, and `read` at an import boundary. `validate` checks a complete v2 document without performing gameplay actions.

| Field | Meaning |
| --- | --- |
| `kind`, `schemaVersion` | `gameplay-scenario`, `2` |
| `id`, `revision`, `seed`, `testMode` | Stable document identity/revision, deterministic seed and playable/invalid-definition/legacy-presentation purpose |
| `versions` | Document, engine and adapter source signatures; inspection reports current signatures separately |
| `world.contexts` | Named show/sport contexts with their actual engine context descriptors |
| `world.people` | Stable people identities; game-specific roles are on each game |
| `world.participants` | Cast/athlete identities scoped to a context |
| `world.events` | Shared episodes/events with number, context and explicit result availability |
| `world.facts`, `world.media` | Source facts and media references, distinct from game scoring and choices |
| `games` | Game IDs, raw specs, context references/overrides, seats, roles and own-pace/live-only policy |
| `games[].contextBindings` | Stage JSON-pointer paths bound to other world contexts; recursively analyzed |
| `games[].stageOf`, `stageKey` | A stage's own game, derived after its game in stages on every read (`stages.cjs`): never written by hand, replaced if given |
| `situation` | Fixed clock, timezone, selected viewer, person/context viewing marks and lifecycle |
| `content`, `transport` | Content profile and requested transport conditions; their runtime adapters are still pending |
| `setup.gameStates`, `setup.stores` | Supplied per-game snapshots and other application stores; presence is not verification of a runnable scenario |
| `history` | Recorded entries/checkpoints and whether setup represents the history's beginning or saved head |
| `presentation` | Surface (`create`, `mini`, `quick`, `full`, `detail`, `reveal`), viewport, theme and renderer reference |
| `provenance`, `evidence` | Import/version history and explicit evidence records; no automatic promotion of checks/reviews |
| `compatibility` | Optional original v1 archive, preserved for downloading the original run |

Games sharing a context share the person's viewing mark for that context. A second game does not introduce a second reveal boundary. Roles and timing can differ between games. This contract supports that representation now; actual multi-game reveal execution remains future runtime work.

The schema distinguishes the starting snapshot from history position. A v1 import sets `history.snapshotAt` to `head`: its saved state already includes the recorded commands. Applying those commands again would duplicate actions. The original config and commands remain intact in the compatibility archive for the legacy replay path.

`originalLegacy(document)` returns the **original archived run**, not a reverse migration of subsequent v2 edits. Current v1 exports remain v1. `session.document()` and the new document endpoint provide an additive v2 representation.

JSON hashes sort object keys and retain array order. From-spec IDs are stable for the same input; legacy-import IDs identify the complete original export, including its provenance. Evidence must use the document hash and versions rather than relying on a display ID alone.

## What analysis reports

`explorer/analyze.cjs` uses production `fullSpec`, contextual checks, waits/type classification, compiler, vocabulary and grammar. It recursively creates separate game/stage scopes and separate question requirement scopes. Different children and questions cannot silently share an action/state identity merely because their graphics match.

Requirements include engine/compiler checks, acquisition/counting/scoring/ranking dials, fields, renderer placements, source facts, actions, viewing boundaries and composition needs. Numeric or unknown fields are retained as requirements, so a newly accepted spec feature cannot disappear merely because no enum recognizes it.

Each requirement retains its origins. Source locations distinguish supplied fields from expanded engine defaults. The original raw spec remains in the document; the analysis node's `normalizedSpec` explains default-only locations. Engine problem paths translate array indices to JSON pointers, alongside the original engine error paths.

Cross-season stages without an explicit context binding report a missing-context diagnostic and requirement. Binding a child replaces its engine context with the referenced context for that child's analysis; its context hash is reported. This does not generate cross-season results or verify transition behavior.

Readiness is separate from engine legality:

- A valid spec can still have missing fixture, transport, projection or action support.
- Supplied snapshots are reported per game; partial snapshots do not imply all games have data.
- Rendering and interaction remain unverified; design remains unreviewed; user approval remains separate.
- The broad source-requirement graph still describes unconnected declarations across all possible mechanics and surfaces. `runtimeSupport` separately reports eligibility for the bounded headless execution profile; it does not turn graph gaps into passes. A declaration, eligibility and an executed case remain different facts.

## Adapter dependency planner

`explorer/planner.cjs` accepts requirements and adapter declarations. A declaration specifies `id`, positive integer `version`, exact provided keys, dependencies and owned resources, with an optional matching predicate. Dependencies/resources can use same, parent, context or world scope.

The planner produces deterministic dependency order and reports:

- Unmatched requirements, with source paths.
- Missing transitive dependencies and blocked dependents.
- Ambiguous providers, without silently selecting one.
- Competing writers for a scoped resource.
- Dependency cycles.

Directly requested source requirements remain distinguishable from adapter-introduced dependencies. If a dependency is also requested directly, its real origins are preserved.

The broad discovery registry declares engine checking, compiler checking and matching legacy snapshot input. Their labels explicitly say engine-only, compiler-only or preserved-input-only. `planned` means a declaration graph resolved; `execution: not-executed` never means a renderer/action passed. The execution runtime has a separate, actually executed dependency plan: world people → shared context facts → each game's state/store → projection. The context adapter executes once per context, rather than inventing different episode facts for each game. Its plan and materialization sources are exported under `preparation`.

## Shared headless runtime

`tools/gameplay-bench/explorer/runtime.cjs` exposes:

| Entry | Behavior |
| --- | --- |
| `open(input)` | Validate, check support and construct an isolated case; returns a session or throws `Blocked` with a structured report |
| `session.project(gameId, personId)` | Production `gameView`, plus basic question options and permitted historical answers; no mutation |
| `session.apply(action, origin?)` | Accepted/rejected/blocked record with before/after hashes and affected games, contexts and stores; rejection rolls back the entire action |
| `session.checkpoint(id)` / `fork(id)` | Name an exact trace position; rebuild a separate branch by replay |
| `session.reset()` | Reconstruct the initial state and replay setup history exactly once |
| `session.export()` | Versioned input, initial/final state hashes, trace, named checkpoints, preparation and evidence scope |
| `resume(execution)` | Pin engine/adapter/runtime versions, reconstruct, replay and verify hashes before retaining checkpoints |
| `execute(input, steps?, queries?)` | Structured one-case result; always disposes the session; accepts a scenario, execution bundle or saved case-result envelope |
| `session.dispose()` | Release case state; subsequent reads/writes are refused |

`execute` is the runner boundary. It returns `{ok,status,outcomes,projections,execution}` on an executed case. Unsupported requirements return `{ok:false,status:'blocked',category,message,gaps?}`; invalid input or replay divergence returns `status:'failed'`. A matched expected rejection can pass a negative case, while its trace still says `rejected`. Inspect `outcomes` and the trace rather than counting an execution as a UI save. Construction failures, tool budgets and gameplay validation are distinct categories. Query failures retain an available execution bundle for diagnosis.

The supported profile is `core-post-acquisition-v1`: draft/pick/no acquisition; roster, best-count and basic pick decisions; moments/survival/placement scoring and basic rankings; per-event participant and yes/no questions settled by results or a recorded moment. Draft ownership is a seeded **post-acquisition setup**, not an exercised draft. Default empty draft/waiver configuration does not imply acquisition or waiver drivers exist. Question lines can compose into a draft's production totals. Unsupported modifiers, stages, external stores, sports stat generation, custom rulebooks and transport failures return gaps.

Generation requires an explicit context `format: {id:'survivor'}` (or another built-in rulebook), separate from its actual compiler `engine` context. There is no default Survivor assumption. Newly generated content is synthetic; supplied names/photos are retained, but this adapter does not fetch artwork or provider facts. `world.media` binding is not connected yet. Each context owns ordered events, participants, result fact bundles and independent people marks; games keep choices and per-game answer rows. Missing released-event facts are generated from the seed and context once. Supplied facts are checked against the rulebook and all games consume the same bundle.

Imported v1 head snapshots remain lossless/inspectable and playable through the **existing pilot**. They are blocked in the new runtime pending reconciliation: some exports' recipe and saved effective settings differ. We must resolve that explicitly, not regenerate a different game and call it the same snapshot.

There is no mutable global case cache or replaced global clock. Context facts are reused within a case; projections/branches are separate copies. Persistent cross-case caching is deferred until its input/version keys and eviction can be proven. All deadline decisions take the scenario's explicit clock through optional production clock parameters; ordinary app callers retain their defaults. Direct commands exercise engine behavior, not DB authorization or production HTTP handling.

### Actions and reproducible queries

`--steps-file` accepts a JSON array of actions, or `{action,expect}` wrappers. Supported `type` values and fields:

| Type | Fields |
| --- | --- |
| `lineup`, `pick` | `gameId`, `personId`, `eventId`, `ids` |
| `answer` | `gameId`, `personId`, `question`, `episode`, `answer` (null removes your answer) |
| `reveal` | `contextId`, `personId`, optional episode (next unseen by default) |
| `clock` | `at`: explicit timestamp at or after the current clock |
| `results` | `contextId`, `eventId`, `source:'provider-fixture'`, `resultStatus`, `data` |

Every action optionally accepts `expectedHash` to reject a stale starting state. Unknown action fields are rejected. Reveal advances only that person's shared context mark, across every game in that context. Historical and pending opponent choices follow the production viewing boundary. Result publication proceeds in event order, supports partial → final → corrected, and validates/updates all affected games atomically. Postponement/cancellation adapters remain gaps. A result payload has `events`, `scoringEvents`, optional `noExit`; it cannot inject player choices.

For example, save this as `.ui-atlas/question-steps.json` for the included question input:

```json
[
  {"type":"answer","gameId":"game-1","personId":"person-1","episode":3,"question":"happens","answer":"yes"},
  {"action":{"type":"answer","gameId":"game-1","personId":"person-1","episode":3,"question":"happens","answer":"maybe"},"expect":"rejected"}
]
```

```powershell
node scripts/gameplay-bench.js execute --file=tests/fixtures/gameplay-explorer/questions-input.json --steps-file=.ui-atlas/question-steps.json --out=.ui-atlas/questions-decisions-01.json
```

`--queries-file` accepts `[{"gameId":"game-1","personId":"person-1"}]`. Projection reads do not enter the mutation trace. The CLI prints a compact summary, writes the full case result, and exits 0 for matched expectations, 2 for blocked cases, 1 for failures. Source drift starts a new execution with an explicit `preparation.versionDrift` warning; resuming a pinned execution across version drift is refused.

Tool budgets are separate from engine restrictions: 32 games, 64 questions per game, 64 people, 1000 participants per context, 60 generated events, 10000 estimated participant/choice-event cells, 1000 actions/checkpoints and 64 projection queries per call. These bound a case, not an unattended campaign. Worker watchdogs, cancellation scheduling, durable campaign accounting and failure minimization belong to Chunk 4A and are not implemented here.

The synthetic three-definition proof builder is `tests/fixtures/gameplay-explorer/runtime-proof.cjs`: an explicit-weight lineup, three fresh picks and a participant/yes-no sheet share one context and independent viewing marks. `tests/gameplay-runtime.test.js` covers saves/rejections, clock locks, result settlement/correction, per-game stores, spectator restrictions, reveal, reset, checkpoints and resume. These are **headless architectural checks**; the three-case browser interaction proof in Chunk 4 remains open.

## Local API

These routes are served by the existing Atlas on port 4400:

| Method/path under `/__atlas/bench/` | Purpose |
| --- | --- |
| `POST analyze` | `{ "input": <accepted input>, "context": <optional context for a bare spec> }`; return full analysis |
| `POST normalize` | Same body; return a v2 document |
| `POST execute` | `{input,steps?:[],queries?:[]}`; run the shared runtime and return a durable case result; no recorded dataset/session required |
| `GET baseline` | Current discovery inventory, frozen example references and known issues |
| `GET document?id=<session>` | Additive v2 head snapshot of an existing pilot session |
| `GET snapshot?id=<session>` | Existing v1 export, unchanged |

Analyze/normalize return structural errors as HTTP 400. Engine-invalid definitions are successfully inspected as HTTP 200 reports with `engine.status: invalid`. Missing adapters remain explicit plan/readiness states. These endpoints add no production mutation path.

Execute returns structured case outcomes as HTTP 200, including blocked/rejected cases; malformed HTTP/JSON remains a transport error. The bench page exposes `window.__GAMEPLAY_EXPLORER__.execute(input,steps,queries,{signal?})` as a stateless browser bridge to that exact endpoint. Keep each returned bundle with its own branch; responses do not overwrite a global current run. This is an automation/integration seam, **not a new visible explorer or evidence that the current product renderer supports these definitions**. The existing pilot form, load button, frames and mutation allowlist remain separate until connected.

## Bench bridge

Added 2026-11-12. `tools/gameplay-bench/runtime-session.cjs` wraps a runtime session for the Atlas frame proxy, so a v2 definition drives the real application pages. It has two read tiers.

### Live tier: real routes on zt-gb- rows (the bench default)

The user's decision (plan §3.4): no duplicated response layer, so new screens, API changes and engine updates appear by themselves.

- `tools/gameplay-bench/live-db.cjs` materializes the case into the **local** dev database: one zt_gb_<key>_<n> user per person (password zt-pass-12345), a couch, one zt show and season per context, a league per game holding the runtime's game state, memberships, follows, season cast, accepted results (`season_decisions`) and `game_answers`. Leagues join their season through `settings.showId`/`wikiSeason`.
- The server restamps air times from the season schedule and takes no injected clock, so `sync` writes each event's air time to `season_episodes.air_at` shifted by (now − scenario clock). The frame's `Date` is left real.
- The Atlas proxy sends a live frame's page loads, API reads and writes to the real app as the **selected viewer's** zt user. A write the runtime can't replay (anything but lineups, picks, the reveal and answers) is refused, never sent.
- After a real write, the runtime replays the same action (origin `bench-frame-live`) and compares the DB with its own state (lineups, picks, marks, answers). Picks fail silently with 200 on the server, so states are compared, not status codes. Each comparison is in `state().live.comparisons`; a disagreement is kept as a finding, then the DB is re-synced from the runtime, which stays authoritative.
- A case's rows go when it's evicted (24 cases) or disposed; `scripts/dev-test/restart-atlas.sh` also runs `node tools/gameplay-bench/live-db.cjs down-all`, which removes every zt-gb- case.
- Checks: `node scripts/dev-test/check-bench-live-db.js` (no browser: real `/games`, `/space`, `/answers` for every person match the runtime projection) and the browser check below, which also asserts every real write agreed.

- Each live viewer gets its own frame origin (as each person has their own browser), so the app's client-side cache can't show one person's data to another after View as.
- **World rule:** while a season airs, the production read path (`ensureNextEpisode`) always keeps an upcoming episode. A definition whose events are all released must have a further event, or mark its season ended, or the server appends an episode the runtime does not model. Not yet enforced by the runtime; give live definitions a next event.

### Redesign testing (plan §6A, started 2026-11-12)

- **Host surfaces:** Tonight, Episodes, Hub and Chat open in runtime mode, on the real routes for the case. They sit alongside the game surfaces (toolbar buttons; their final design waits for the bench design pass).
- **Social seeding** (`live-db.cjs` `seedSocial`, once per case), timed from each shifted airing:
  - chat before each airing, and an after-air line that names who went home (deliberately, to exercise hiding for people behind);
  - reveal lines, a reaction, a couch-chat message;
  - a GIF per person per seen episode (placeholder KLIPY URLs: real GIF art needs a cached-asset decision);
  - recap summaries on released episodes (players get these only in the reveal response).
- **People:** sign-in usernames are `<name>_ztgb<case key><n>`, so faces carry the person's own initial. Atlas's `isFixtureUser` accepts these and `zt_` usernames, loopback only.
- **Write policy:** compared writes are lineups, picks, the reveal and answers. **Untracked** writes are allowed and logged (`state().live.untracked`) for chat posts and reads, reactions, GIFs and preferences. Anything else is refused and never sent.
- **Renderers:** a renderer is a running local app.
  - `GET /__atlas/bench/runtime/renderers` lists this checkout and each worktree's dev server that answers, labelled by branch.
  - `runtime/open {app}` materializes the case into **that worktree's own database** (each lane has one; from its `.env.local`, never returned by a route) and frames it through that app.
  - `runtime/close` removes a case and its rows. `live-db.cjs down-all` sweeps every worktree database.
- **Side by side:** `node scripts/dev-test/compare-renderers.js --b=http://localhost:30xx [--surfaces=tonight,episodes,full] [--viewers=ann,bo]` opens one definition once per renderer (isolated rows) and writes paired phone captures plus `compare.json` (overflow, console errors) to `.ui-atlas/renderer-compare/`. First run: main vs the reactions branch on Tonight and Episodes, eight captures, clean.
- **Spoiler oracle, first version** (`check-bench-live-db.js`, 30 checks):
  - every real route a person reads (home, space, games, episodes, chat, how-it-works, answers) is scanned for tokens that exist only past their mark (after-air chat lines, later moment IDs, recap sentences);
  - a positive control proves the chat probe does see those tokens when they're allowed;
  - no leak found for a behind or a caught-up person.

**Noticed (fixed later the same day, see Product fixes):** Tonight showed **"You finished it · Weekly Lineup, 2nd of 2"** to a caught-up own-pace player while episode 3 is still to air (`pace-plate.tsx` `OwnPacePlates`: any own-pace game you aren't catching up on gets `FinishPlate`). Own-pace plates were built for aired seasons; with own pace the intended default on airing seasons (PRODUCT.md principle 11), this becomes reachable. Reproduce: the proof with `{ann:2,bo:1}`, View as Ann, Tonight. Also, between branches, main says "Episode 2 of 5" where the reactions branch says "Episode 2 of 2" for the same catching-up case: a difference to review, not yet a bug.

### The explorer page (2026-11-12)

`http://127.0.0.1:4400/__atlas/explorer` builds the approved bench-v2 design (mock and shots: `tools/gameplay-bench/design/`; the old bench stays at `/__atlas/bench` until the explorer covers its checks). Code: `tools/gameplay-bench/explorer/page/`.

- **Open…:** a file (definition, saved explorer run, execution or `execute` result, campaign reproducer, which is replayed with its recorded outcomes so its steps can be walked), the built-in three-game example (`GET runtime/example`), or "Start from a recipe" (the old bench).
- **Who's watching:** people with their marks, Viewing, and "Reveal N", which opens the real reveal as them.
- **Episodes:** a timeline relative to the case's now:
  - **Air it** moves the clock past the airing;
  - **Partial / Final / Correct** publish results generated from the case's seed (`runtime/publish`; a correction picks a different exit).
- **Screens:** Tonight, Episodes, a game's page, Hub, Chat, and More (quick action, player detail, reveal, create).
- **App:** any running local app (`runtime/renderers`).
- **Compare:** opens a second case from the same input on another app version. Every action is applied to both, so they stay at one step; the evidence column folds away (the approved tweak).
- **Frames:** live, scaled iframes. After each load the frame bridge runs the UI checks (`bridge.js` `oracles`) and their results show under the phone.
- **Evidence:**
  - Checks: server agreement, writes not compared, and "Check spoilers and standings now" (`runtime/check`, the API-tier checks for everyone);
  - Actions: the trace;
  - Data: case, renderer(s), failed reads;
  - Notes: kept in the browser.
- **Steps:** an opened run's recorded steps can be walked back and forth (`runtime/seek`).
- **Export:** a run that `execute` and the page reopen.
- **Recipes** (Open… → Start from a recipe): the old bench's form as v2 definitions (`explorer/recipes.cjs`, `POST runtime/recipe`). The panel reuses the old form's catalog, presets and per-game quantity fields, and drops "Photography" (generated casts have no recorded photos).
  - All five show games (lineup, best ball, Outlast, picks, Survival Pool) × all five situations × every pace, plus every preset, open in the shared runtime (84 combinations; unit test in `tests/gameplay-bench-runtime.test.js`).
  - Deliberate differences from the pilot: "Decision needed" leaves the episode open for everyone; "Game finished" ends the game's span.
  - The weekly-lineup preset has side bets on: the runtime accepts that with none posted, as a declared note shown in Evidence ("posting and settling bets is not connected yet").
  - Sports recipes stay in the old bench until generated sports statistics are connected; that is the only thing keeping it.
- **Saved runs survive page edits.** The adapter version no longer hashes presentation-only files (`explorer/page/`, `design/`, the old shell), so editing the page doesn't invalidate saved runs. Engine, adapter, runtime and generator changes still do.
- **Check:** `node scripts/dev-test/check-explorer-page.js [--b=http://localhost:30xx]`, 12 steps:
  - example, then viewer;
  - Air it and Final, then Bo's reveal (only Bo moves);
  - a game page, then the route checks;
  - compare with the reactions branch, with evidence folding;
  - export replayed headlessly;
  - phone order, with no sideways scroll;
  - a definition that can't run.

  - a recipe through the panel.

  It asserts the app inside the frame is signed in as the selected person after each change. Last run: 12 of 12, no console errors.

### Lessons from the breadth program (read before the next capability; 2026-11-13, after twenty)

What the first twenty capabilities taught, each learned the hard way at least once. The capability sections below carry the detail.

**Picking and scoping**
- **Pick by count.** `node scripts/dev-test/profile-blockers.js` lists what blocks the most show specimens. `--path=score/parlays` (no leading slash under Git Bash) shows the shapes a gap blocks, so a capability covers the shapes that occur, not every shape the schema allows. Every team specimen was drawn, so `made: 'choose'` stayed a gap. Rebuild the matrix first if the engine changed (`node scripts/gameplay-matrix.js build`).
- **Count a handoff's shapes yourself.** The handoff before stages said 19 staged specimens were two games split at the merge. Ten were; nine start a new draft on a format change (a stage's `on`), which is another server path (`change-stages.ts`). Print the specimens' own keys before scoping a slice.
- **Read the server's read path too.** The table's points for a game of questions come from `answer-points.ts` `pointsOf`: the walk's totals when there is a walk (frozen at the game's end), else the grade's. The runtime ranked by the grade alone until a co-op game exposed it.
- **Read the server's write path first.** The runtime has to do what the server does around each write, not only what the engine does. In particular, db.ts `withLeagueLock` runs settles before and after every mutation: head to head's `MatchupLogic.settle` (after `stampSeasonLength`), `TeamLogic.settle`, `stampVoteRecords`, phase-starts.ts `settleIn` after results. Also mirror the routes' refusal rules in their order: answers.ts refuses for the game's end, then for someone out, then for the lock, so the refusal says why. The API tier materializes runtime rows and doesn't replay writes through the server. So a write the runtime accepts but the server refuses only shows up through live app writes, which makes mirroring the refusals essential.
- **Facts the server reads from other tables get materialized in those tables.** Phase starts go in the season rulebook (`ensureSeasonRulebook`, `setPhaseStart`); who voted for whom goes in `episode_research`, source `combined`. Then show that the server read them: it disagrees, or drops a stored stamp, without them.

**A game the server keeps as several leagues**
- **It is several games in the definition.** `document.cjs` derives each stage's own game from its parent's spec on every read (`stages.cjs` `expand`: `<game>~<stage>`, with `stageOf` and `stageKey`). So every action, projection, invariant, materialized row and route check treats a stage as any game, and only the parent's table needed new code. Derive, never hand-write: the parent's spec stays the one source, and a stage game given in the input is replaced by its derivation. The analyzer still reports a stage once, where it's written (as its parent's stage node).
- **A draft the runtime has to make mid-run is made by the engine's own draft** (sheets locked and revealed, or picks in turn), then stamped with the scenario's clock so a replay drafts the same. Prove it on the server: materialize the state from just before the draft and have the people make the same draft through the real routes (`check-stages-explorer.js --case=draft`).

**Determinism**
- **The engine names things at random** (`Core.uid`: a team draw's seed, an episode `settleStart` makes past the world). Seed it from the game's id (`'zt-' + game.id`) or rename by number, and carry it into the materialized state so the server keeps it. Symptom: `replay-diverged`.
- **Make new facts only where a game reads them.** Votes are generated only when a game has a bounty, so every other world's facts and hashes stay as they were (and so do pinned replays).

**Generator**
- **Ask the engine what it refuses.** `generator-defect: open:engine-definition` lists the engine's problem for each case. Teach the generator the rule; never relax the engine. Examples: an exclusive draft is a snake; no bounty beside a cut; no teams on a questions game with lives or a race.
- **Make the interesting case happen.** Results often follow the couch's answers, so right answers, split pots and bounties actually occur. After a campaign, count how often the new mechanic did something (a scratch counter in the campaign's own folder), not just that it was present. A clean run proves little until that count does: parlays passed 200 of 200 three times while never paying once. The count showed why (legs open only until their airing, and steps spread over every question and person), and the walk was changed until they paid.
- **A question that must be answered gets steps of its own.** Answer steps spread over every question and person, and a per-episode window closes at its airing, so a new question kind may never be answered at all (confidence's first probe: none in 40 cases). Make it a focus question (generator `focusOf`: a parlay's legs, a confidence ranking): some steps answer it before it locks.
- **What the server can't name, compare by name.** The materializer gives rows the server's own ids (a call by its `season_cast` id), so a route check maps both sides to names, and the live bench maps an app write back to the world's id.
- **A modifier gets a twin.** For a rule that changes points (a multiplier), walk the same actions on the same definition without it, and compare episode by episode (`times-paired`). The twin also tests the plain path: it found BACKLOG 49.

**Failures**
- **A failure is often the check's.** Six of the first runs' failures were wrong invariants, not product bugs: shares under `only`, wagered questions, bounties after a race was won, own-pace catch-up joining a team late. Before calling it a bug:
  1. Reproduce it (`campaign --repro=<i> --out=<file inside the workspace>`).
  2. Read the minimal steps.
  3. Ask whether the engine's own doc comment describes it as intended, and whether the real server agrees.
- **A bug seen only in the runtime isn't the product's until the server shows it.** BACKLOG 50 was filed from the runtime's behavior and retracted when the API tier showed the server did otherwise: the runtime had graded the sheet on a copy the server cuts at the game's end. Before filing, confirm on the real routes (a materialized case, or the API tier).
- **A product bug or gap goes on the record.** A bug goes in BACKLOG (47: a cut player offered a lineup). A missing screen or words go on the plan's "Designs needed". Neither is built before the user's batched design round.

**Page check and environment**
- **Restart Atlas after adapter edits** (`bash scripts/dev-test/restart-atlas.sh`), but never while an API campaign runs: the restart removes every zt-gb row, the campaign's too. Don't edit the generator, `case.cjs` or the runtime while any campaign runs either: workers load them fresh for each case. Have page steps poll the server's `runtime/state` rather than trust the page's copy, and screenshot before a save reloads the frame. A known gap prints a `NOTE` line naming its "Designs needed" item, not a failure.
- **A positive control on the engine is a temporary edit of its file** (copy it aside, edit, run the control, copy it back and `cmp`), never an in-process patch: the projection's TypeScript loads its own copy of the engine, so a patched `S.PickEmLogic` reaches the history but not the page. And never while any campaign runs: its workers load the engine fresh for each case, so a case run in that window plays the edited rule (`auction-api`'s first run failed one case that way). `state-logic.js` may carry uncommitted work of the user's; the restore keeps it.
- **A control that passes may be checking the wrong thing.** A slot that never drops came out void, 0 points either way, so a points-only twin couldn't see it; checking the status as well gave it teeth (13 of 45). When a control passes, ask what the edited rule changes that the check doesn't read.
- **When the server's code is async, port it; when it draws random ids, seed them.** The waiver routes await `waiver_claims` on every step, so the runtime ports `waivers.js` around the same engine calls rather than calling it. And `Core.uid` is random: while engine code that names things runs, hand it seeded ids (`runtime-waivers.cjs seeded`) and restore it after.
- **Check the shape the app actually sends.** The new app saves a claim one spot at a time (`{ spot }`), not as the route's documented `{ pairs }`; the page step's write showed it.
- **Find the door the app uses.** The new app sends the commissioner's waiver actions through Backstage's own route (`/backstage/waivers`), not the classic routes, and a run's Undo through Recent changes. Port the server function they share once, mirror each door's refusals, translate both, and let reads sent as POSTs (a preview) pass as untracked.
- **Own pace with exclusive teams is a server path of its own** (a copy of the league at everyone's episode). Compare every new action there too: three of the thirty-fourth capability's findings were there, and only there.
- **A new walk reshuffles old ground.** New steps change every walk that has those games, so an older capability's check can fail for the first time (BACKLOG 57 came from a bounty check on a lineup with waivers). Chase it as a finding; don't quiet it.
- **A generated clock sits on round numbers.** The next episode airs exactly a day after a case's clock, the very moment a waiver week's claims run. The runtime ran a window in the step that opened it while the server, a moment later by its own clock, left it open. Move a page step's clock off the mark and let the invariant allow the boundary.
- **A page step with several writes goes back to its screen after each.** The explorer page looks at the run every 2.5 s and loads the game's page again when it has moved on.
- **Run positive controls from a driver.** A `control.cjs` in the campaign's folder reruns only the cases the capability touches; the driver (`node scripts/dev-test/engine-controls.js --controls=<controls.json> --run="node .ui-atlas/campaigns/<name>/control.cjs 90"`) applies each engine edit, runs it in a fresh process, restores the file and compares its hash, one control after another, after a baseline run on the unedited file. While a control is applied the app's dev server recompiles with the broken rule: run no route or page check, and don't restart Atlas, until the driver has finished. The engine file has Windows line endings: keep each control's `find` to one line.
- **A campaign's id is part of each case's seed.** A new id with the same seed is 200 new cases, not a rerun. To run the same cases again on changed code, run them in-process against that campaign's manifest (its folder's `control.cjs`, or `runCase(manifest, index)`).
- **A campaign pins `adapters`, which is all of `tools/gameplay-bench`.** Editing `live-db.cjs` or `api-checks.cjs` while an engine campaign runs doesn't change its cases (they never load them), but the campaign can't be resumed afterwards and its manifest no longer names the code on disk. Finish adapter edits before starting one, or run it again at the end on the final code.
- **Windows tooling:**
  - Python here-docs mangle `\s` and `\b` (use the Edit tool or Node for regex lines).
  - Git Bash rewrites leading-slash arguments.
  - `campaign --out` must be inside the workspace.
  - Start a campaign as a tracked background task, never with a shell `&`: an `&` run can outlive the call, and a resume started beside it makes two runners on one campaign (`retries` rising in `--status` is the sign).

**Workflow**
- **Order of work per capability:** world/runtime, then the unit test pinning the exact rule, then the generator, then a 200-case engine campaign, then invariants, then the materializer plus a direct server comparison, then API checks plus a 30-case `--tier=api` run (`--workers=1`, app on :3000), then the page-check step plus a screenshot, then docs (this guide's section, the plan's Progress, "Designs needed", the handoff). Long checks once per capability, at its end.
- **Session boundaries.** Carry on through related capabilities in one session while one capability's lessons feed the next. Hand off at a real boundary: a new family of mechanics, or a session long enough to have been compacted. Leave a seed prompt that says the same.

### Capability: side bets (breadth program C, first capability, 2026-11-12)

The per-capability definition of done (plan §6A item 10), item by item:

- **Runtime actions** (`runtime.cjs` `sideBet`, `core-runtime-5`): `bet`, `guess`, `unguess`, `grade`, each mirroring its route's rules:
  - anyone playing posts a bet;
  - a guess is refused while catching up;
  - posting and guessing close when the episode starts or has results (by the scenario clock);
  - only the commissioner grades (the first seat, as the materializer seats them, unless roles say otherwise);
  - taking a guess back after the lock is a silent no-op, as on the server.

  Engine IDs are random (`Core.uid`), so IDs are either the action's own (the server's, for writes made in the app, read from its answer) or derived from the trace; replays stay exact. The runtime profile accepts `extras.bets` with no note now.
- **Generator family** (`proof-family-5`): half the generated lineup games turn side bets on, and the walk posts, guesses (unique words), takes back and grades, including refusals. Across 22 such cases the walks' bet steps were accepted and refused for the right reasons (closed, catching up, commissioner only).
- **Invariant:** nobody's projection contains someone else's guess while its bet is open (`guess-visible`).
- **Materializer:** bets live in league state, so `sync` already carries them.
- **Real routes:**
  - bet writes from the app map to the actions, and `compare` checks every bet's label, points, guesses and grading;
  - the API tier scans every route for others' open guesses;
  - campaign `api-bets-30`: 30 of 30 pass.
- **UI driver:**
  - the explorer's **Side bets** section posts a bet (as the viewer) and marks guesses Right or Wrong once aired (as the commissioner);
  - the page check posts a bet, guesses in the app's real Your moves → Predictions, airs and publishes the episode, then grades; server and runtime agree.
- **Findings:**
  1. **The new app can't post or settle side bets.** Weekly Lineup has them on by default, but only the classic routes post and grade them; the new app only lets players guess. Bets therefore never appear in practice. The user wants it built, batched into one design round with the other gaps the breadth program finds (see **Designs needed** in the plan, §6A).
  2. Backlogged by the user (docs/BACKLOG.md item 45). **The classic `GET /api/leagues/{id}/state` returns the whole league to any member**, including results past their mark and others' open guesses (verified for Bo, one behind). The new app doesn't read it, but anyone calling it directly would. The API tier reports it as `known:classic-state-spoiler` (counted apart from failures; 21 of 30 cases still reproduce it), so a fix can be proven.

Also from this step:
- **Actions queue:** the explorer runs its actions in order instead of dropping one started mid-refresh (a game chosen while a bet was posting used to vanish).
- **Recipes:** they carry two upcoming episodes, so airing and publishing one leaves the season airing.

### Capability: season-long questions (breadth program C, second capability, 2026-11-12)

Questions asked once for the whole game: "Who wins?" and "Who makes the final three?" (`asked: 'once'`, closing at the finale or the game's start, settled by the results' winner or top N). They're the most common unconnected part of the most common family. The definition of done, item by item:

- **Runtime** (`core-runtime-6`): a once-asked answer is filed as episode 0, as `game_answers` stores it.
  - Any other episode is refused, and so is an answer after the question locks.
  - The finale is the world's last episode, the same number the server reads from the season's episode count.
  - Others' answers stay out of a projection while the question is open; your own always shows.
  - `pick: 3` means up to three names, as production allows.
- **Finale facts** (`runtime-data.cjs` `outcome`): the season's last episode, on a format that crowns a winner:
  - cuts the field to a final three (vote exits);
  - sends the two losing finalists out by the format's endgame exit (Survivor's jury loss);
  - crowns a winner, so the season ends and no episode is appended.

  World generation and the explorer's Publish share it. Finale recaps name the winner and fit the 1,000-character column. Before this, a long list of names broke one case.
- **Generator** (`proof-family-6`): 60% of questions games add both questions, and the walk may air and publish the finale. Campaign `season-long-200`: 200 of 200 pass. Across those walks:
  - 87 games had the questions, with 375 accepted answers and 105 wrong-episode refusals;
  - 182 seasons reached a finale;
  - 105 answers were settled with points.
- **Real routes:**
  - answer writes map to episode 0 for once-asked questions, as the server files them;
  - the API checks compare the real question sheet with the runtime (closed or not, your own answer) and flag anyone else's answer while it's open;
  - campaign `api-season-long-30c`: 30 of 30 pass (22 hits of the backlogged `known:classic-state-spoiler`).
- **Unit test:** the season-long case in `tests/gameplay-bench-runtime.test.js` covers:
  - answering as episode 0, with refusals;
  - privacy while the question is open;
  - the lock at the finale's air time;
  - the winner and final three settling only after the viewer's reveal;
  - exact replay.
- **UI driver** (`check-explorer-page.js`): the check opens a definition from a file and answers "Who wins?" on the real game page, where server and runtime agree. Then it airs and publishes the finale, plays Ann's reveal, and reads her settled verdict from the real sheet.
- **Findings:**
  1. **Settled season-long answers don't show after the finale.** The game page shows its questions only while one is open, and the person sheet lists per-episode answers only. Its header still says "All season · 4 questions". Ann can't see that her winner pick was wrong (or right) anywhere. Added to **Designs needed**.
  2. **The finale's "Who goes home?" names everyone who left, but not who won.** The grading is right (on a night with a winner, everyone else went home), but the words could lead with the winner. Added to **Designs needed** with item 1.
  3. **The intermittent Bo's reveal step:** it timed out in two of four runs. Found and fixed with lives and co-op: the explorer page didn't refresh after reveals made in the app (see "Capability: lives and co-op").

### Capability: head to head (breadth program C, third capability, 2026-11-12)

`rank: { by: 'matchups' }`, the next most common gap (146 specimens), with its riders: how an odd one out plays (`odd`: the median or a bye), what a night nobody scores counts as (`quiet`: skip or tie), and `playoffs` (`teams`, optionally `from`). It works on all three connected families: lineup, picks and questions. The definition of done, item by item:

- **Runtime** (`core-runtime-7`): the server's write hook (db.ts `withLeagueLock`) is mirrored by `runtime-data.cjs` `settleWrite`.
  - It runs at setup and after every accepted action that changed a game's state.
  - It stamps the season's length for playoffs placed at the end (`seasonEpisodes`, the world's event count, as `show_seasons.episode_count` holds it), then runs `MatchupLogic.settle`: when each seat joined, and where the playoffs began.
  - Those inputs (results, who's catching up) change only on writes, so settling after state-changing actions matches the server.
  - The projection now passes the answer facts to the walk, grade and lines, as the server builds them on the viewer's copy. A questions game on head to head walks episode by episode, and the walk had no fallback.
- **Generator** (`proof-family-7`): 35% of games of each family go head to head, with a random odd-one-out rule and quiet-night rule, and half get playoffs (two teams, or four with four people). Campaign `h2h-200b`: 200 of 200 pass. The walks covered:
  - 138 head-to-head games;
  - 80 decided matchups and 101 ties;
  - 24 byes and 25 median games;
  - 63 playoffs placed and 55 champions crowned.

  The first run (`h2h-200`) crashed in 47 cases on the walk's missing facts; that is the fix above.
- **Invariant:** `matchup-past-mark`: no one's last matchup, record or played playoff round runs past their mark.
- **Real routes:** the API checks compare the server's head-to-head view with the runtime's: record, last and next matchup, playoff start, seeds and champion. Campaign `api-h2h-30`: 30 of 30 pass.
- **Unit test:** the head-to-head case in `tests/gameplay-bench-runtime.test.js` covers:
  - seats kept at setup;
  - the season's length;
  - the playoffs placed only once their round has results;
  - a champion from the two seeds;
  - a viewer behind seeing neither later matchups nor the champion;
  - exact replay.
- **UI driver** (`check-explorer-page.js`): the check opens a four-person Weekly Lineup on head to head with a two-team final. The real season grid shows Ann's record as the runtime projects it. The check then airs and publishes the last regular episode and the final, plays Ann's reveals, and runs the route checks: no spoilers, standings match.
- **Findings** (all UI; see **Designs needed** item 3):
  1. **This week's opponent isn't shown anywhere.** `matchups.next` is in every game view but nothing in the new app reads it. While a lineup is due, the page leads with the move and the grid, so nothing says who you're playing.
  2. **The playoffs have no presence beyond a line and a mark.**
     - Nothing names the champion.
     - The losing finalist is marked OUT, like those who missed the playoffs.
     - The final's square sits unmarked in the regular-season grid.
     - A champion with a 2–1 record ranks above a 3–0 finalist with no reason shown.
  3. **A quiet night shows as dashes for everyone** with nothing saying why (with `quiet: 'skip'` it counts for nobody).

### Capability: weeks won (breadth program C, fourth capability, 2026-11-12)

`rank: { by: 'weeks', ties }`: whoever adds the most points in an episode wins the week. Under `ties`, a week two or more top goes to each of them (`all`), is shared (`split`), or goes to nobody (`none`). WeekLogic works it out on every read from the same series and seats as head to head, and the server keeps nothing for it, so the runtime needed no new state. The definition of done, item by item:

- **Runtime:** the profile accepts `rank.by: 'weeks'` and `rank.ties`. No runtime version change.
- **Generator** (`proof-family-8`): 25% of games of each family rank by weeks won, with a random tie rule. Campaign `weeks-200`: 200 of 200 pass, covering 97 games (lineup 35, picks 35, questions 27), 309 weeks, 24 of them shared.
- **Invariant:** `week-past-mark`: nobody's weeks-won count exceeds the episodes the viewer has seen.
- **Real routes:** the API checks compare the server's `weeksWon` and, for every game, the table's order with the runtime's. Campaign `api-weeks-30`: 30 of 30 pass.
- **Unit test:** the weeks-won case in `tests/gameplay-bench-runtime.test.js` covers each tie rule, a viewer behind counting only through their mark, and exact replay.
- **UI driver** (`check-explorer-page.js`): the real game page's weeks block (`data-game-main="week"`) shows Ann's count as the runtime projects it.
- **Findings:**
  1. **A shared week isn't marked as shared.** With `ties: 'split'` a shared week counts half (a column of 2.5 and 0.5), but its square looks like a whole win, and the legend ("a teal one won the week") doesn't explain the halves. Added to **Designs needed** item 3.
  2. **Fixture realism (noticed, not fixed):** 167 of the 309 generated weeks were won by nobody, because generated results carry few scoring moments (Publish adds one). The checks still hold, but most weeks are quiet. Richer generated moments would exercise more real wins and ties; that belongs with the content profiles.

Also from this step: the explorer page no longer throws "Cannot read properties of null (reading 'postMessage')" when a case is opened while the previous frame is still loading (its checks message is skipped for a replaced frame).

### Capability: only some moments count, and hits (breadth program C, fifth capability, 2026-11-12)

`score.only` (a fixed list of the moments that count; every other one scores nothing) and `score.hits` (each moment that counts is a hit worth 1: `every` time, once per objective for each `pick`, or once per `objective` for you). These were the commonest blockers among the matrix's show specimens: 151 and 110. Both are worked out on every read (`Spec.momentWorth`), with nothing kept by the server. The weekly card's moments (`only: 'card'`, with the `card` feature: 77 specimens) need server stamping and remain a gap for their own capability. The definition of done, item by item:

- **Runtime:** the profile accepts `score.only` as a list and `score.hits`; `only: 'card'` stays an explicit gap. No runtime version change.
- **Generator** (`proof-family-9`): lineup and picks games get an `only` list of two to four moments (40%) and/or a hits rule (40%), shuffled with a seeded Fisher-Yates. Campaign `counting-200b`: 200 of 200 pass, covering 182 games (120 with a list; hits: 39 every, 34 pick, 37 objective).
- **Real routes:** standings and table order already compare every game. Campaign `api-counting-30`: 30 of 30 pass.
- **Unit test:** the only/hits case in `tests/gameplay-bench-runtime.test.js` has an independent expectation: a moment off the list and moments on the bench add nothing, and one listed moment on a starter adds exactly one hit. It also covers exact replay.
- **UI driver** (`check-explorer-page.js`): the real game page's summary says "Only 2 moments count" and the route checks agree. The step also reads How it works and prints a NOTE while it doesn't say the rule (see the findings).
- **Findings** (Designs needed item 4):
  1. **How it works misstates the scoring.** Its "What scores" section, headed "This game's points", lists every moment at its rulebook points (idol found 2, idol played 1, …) for a game where only two moments count, each a hit worth 1. `describe.js` writes the right sentences ("Only two moments count: …", "Each time one happens is a hit, worth 1"), but they don't reach How it works (saved response: `.ui-atlas/explorer-page/only-hits-how-it-works.json`).
  2. **The game page never names the moments that count**, and it labels hits as points (the PTS column, "0 pts").
  3. **Fixture realism:** with a two-moment list, most generated episodes score nothing (generated results carry few moments; see "Capability: weeks won").

### Capability: lives and co-op (breadth program C, sixth capability, 2026-11-12)

`score.lives` (124 specimens), with `score.livesOn` and, for co-op (`rank.by: 'coop'`), `score.saves`. A wrong answer (or none) to a question a life rides on costs one. At none you're out (ranked by who's still standing), or, in co-op, the couch has lost together. Survival pools carry their own lives too (`score.by: 'survive'`). The answer walk and the pool walk work all of it out on every read. The definition of done, item by item:

- **Runtime** (`core-runtime-8`): the answer action now refuses as `answers.ts` does, in its order, on the league as it stands (walked over every answer and result):
  - nobody answers past where the game ended or ends (a last life, one left, head to head's final);
  - nobody answers once out;
  - then the lock.

  The projection's question locks read the same walked state, so a game that has ended shows its questions closed, as the server's sheet does.
  This also closes a gap left by head to head: a questions game on head to head accepted answers past its final in the runtime. The API tier couldn't see that, because it materializes the runtime's rows rather than replaying them through the server.
- **Profile:** accepts `score.lives`, `livesOn`, `saves` and `rank.by: 'coop'`.
- **Generator** (`proof-family-10`): 35% of questions games get one to three lives (half riding only on "Who goes home?"), ranked last one standing or co-op, sometimes with a `saves` rule. 30% of picks games become survival pools with lives. Campaign `lives-200b`: 200 of 200 pass. The walks covered:
  - 32 last-one-standing games (63 knocked out);
  - 34 co-op games (64 lives lost, 31 couches out of lives);
  - 53 pools (113 knocked out, 214 lives lost);
  - 119 answers refused after the game ended, 6 refused as "You're out of this game".
- **Real routes:** `api-lives-30` first failed 1 of 30. The server's sheet showed season-long questions closed once the game had ended, but the runtime's projection still showed them open. With the walked state that's fixed: `api-lives-30b`, 30 of 30.
- **Unit test:** the lives case in `tests/gameplay-bench-runtime.test.js` covers:
  - a last-one-standing game and a co-op game on the same night;
  - a wrong "Who goes home?" costing the one life;
  - Bo refused once out;
  - the co-op couch at none with every question closed;
  - exact replay.
- **UI driver** (`check-explorer-page.js`): "Who goes home?" is answered on a real co-op game page (server and runtime agree). After the episode, the page's lives left ("1 of 3 lives left" on the hearts, and the Lives row of the grid) matches the runtime, and the route checks pass. The step records where the count appears (`coop-page.json`) and prints a NOTE if it appears nowhere.
- **Findings:**
  1. **Co-op's lives left sit below the questions.** While answers are due, the first screen shows only "Together, 3 lives", the rule, which reads like the count. The couch's actual lives (1 of 3) are further down. Small; Designs needed item 5.
  2. **The explorer page went stale after anything done inside the app.** It refreshed only after its own actions and frame loads, so a reveal or save in the app left Who's watching and the evidence behind. This made "Bo's reveal…" flaky, and the head-to-head step once. Fixed: the page checks the run every 2.5 seconds (skipped while an action runs), and the steps wait on the server's state. Two consecutive page-check runs: 17 of 17.

### Capability: shared points (breadth program C, seventh capability, 2026-11-12)

The `share` question rider (117 specimens): `split` shares a question's points between everyone right; `only` pays only when you're the only one right. It's graded on every read. It rides on results questions ("Who goes home?") and moment questions (yes/no, and "who did it": `settle: { by: 'moment', take: 'who' }`). The definition of done, item by item:

- **Runtime:** the profile accepts `share` (`split` | `only`). No runtime version change.
- **Generator** (`proof-family-11`):
  - 35% of per-episode questions get a share rule;
  - 40% of questions games add "Who finds an idol?" (a who-did-it moment question);
  - generated results now often follow the couch's answers (the boot someone guessed, the idol finder someone named), so right answers happen at all.

  Campaign `share-200b`: 200 of 200 pass, covering 107 games, 64 split and 56 only rules.
- **Invariant:** `share-overpaid`: across everyone, a split question-episode pays at most its points, and an only one pays at most one person. Coverage is thin in walks: few windows pay out, because walks answer few questions per episode before results. The unit test pins the exact rules.
- **Real routes:** standings and order compare every game. Campaign `api-share-30`: 30 of 30 pass.
- **Unit test:** the shared-points case in `tests/gameplay-bench-runtime.test.js` uses three people:
  - a split pot of 4 with two right pays 2 each;
  - `only` with two right pays nobody;
  - `only` with one right pays the whole 2;
  - exact replay.
- **UI driver** (`check-explorer-page.js`): the real sheet states each rule as a rider ("Split between everyone who's right", "Scores only if you're the only one right"). An answer saved there agrees with the runtime. The episode is aired, published and revealed, and the route checks pass.
- **Findings** (Designs needed item 6, small):
  1. A split question's worth line says "+4" and "4 points if you're right" right above "Split between everyone who's right", where a shared pot pays less.
  2. The game's summary line names one rule ("Split the pot") when its questions use two.

### Capability: drafts out of a hat (breadth program C, eighth capability, 2026-11-12)

`get.order: 'draw'` (68 specimens): nobody picks; each team is dealt at random when the draft starts, exclusive or shared (DrawLogic). The runtime starts after the draft, so the setup records the draw the way a real one does (`state.draw`: seed, when, order). Without that record, the server's write hook (`DrawLogic.settle`) and the late joiner's deal (`dealsLate`) wouldn't see a drawn league. An auction (`order: 'auction'`, 11) keeps budgets and stays a gap. The definition of done, item by item:

- **Runtime:** the setup records the draw; the profile accepts `draw`.
- **Generator** (`proof-family-12`): 30% of lineup games are dealt from a hat, exclusive only when the couch's teams fit the smallest generated cast. The first run's six generator defects were oversized exclusive draws. Campaigns `draw-200b` and `draw-200c`: 200 of 200 each.
- **Real routes:** campaign `api-draw-30` failed 1 of 30 on a different, older mismatch, found because coverage keeps growing (below). With that fixed, `api-draw-30b`: 30 of 30.
- **Unit test:** the draw case in `tests/gameplay-bench-runtime.test.js`, exclusive and shared, checks:
  - recorded as drawn, never due again;
  - a server write deals nothing;
  - late joiners are dealt;
  - nobody shares in an exclusive draw.
- **UI driver** (`check-explorer-page.js`): the real game page reads the drawn teams ("3 from a hat, start 2"), and the route checks pass (standings would disagree if the server had dealt again).
- **Fixed on the way** (`core-runtime-9`): the server counts only the answers that count (`AnswerLogic.liveRows`). Someone out keeps no answer about the whole game, nor any for a window still open when they went out. The runtime's projection used every answer, so a knocked-out player's season-long answer showed on the runtime side and not on the server's sheet. The projection now walks over every answer, then grades, shows your answers and lists what's decided from the live rows, as `answer-points.ts walked` does.
- **Findings** (Designs needed item 7, small):
  1. When you're knocked out, your season-long answers vanish from your sheet (shown as unanswered), with nothing saying they no longer count.
  2. The drawn game's chip says "Order drawn" when it's the teams that were drawn.

### Capability: stakes and banks (breadth program C, ninth capability, 2026-11-13)

The `wager` rider (79 specimens): stake up to a number, or any of your points (`'total'`), as `{ answer, stake }`. `odds` is even (a right stake wins itself) or `pool` (the wrong stakes split among the right). Beside a bank (`score.bank: { start }`), every stake is drawn from it. The engine grades stakes; the server alone holds them to what you have. The definition of done, item by item:

- **Runtime** (`core-runtime-10`): `stakeLimit` mirrors `answers.ts` (`stakeRoom`, `heldStakes`, `stakeMost`): your points as they stand for you (the walk's total, else graded on your own copy with the answers that count), less your other stakes still riding. The answer action passes it to `answerProblem` as the server does. The projection exposes `wager` and `stakeMost`, null for a fixed wager alone, as the sheet does. The profile accepts `wager`, `odds` and `score.bank`.
- **Generator** (`proof-family-13`): 35% of per-episode questions take a stake (3, 5, 10 or any of your points; 30% at pool odds), and 40% of those games get a bank. Answers stake 0 up to what the sheet allows; invalid ones sometimes stake one more. Campaign `wager-200b`: 200 of 200 pass. Coverage is thin: 80 games carry stakes (21 with banks), but only 17 stakes were placed and 5 settled. The unit test pins the rules.
- **Invariants:** `wager-out-of-bounds`: a wrong answer loses at most its stake; at even odds a right one gains at most the question's points plus the stake. `share-overpaid` now skips wagered questions, since a stake is a line of its own, never shared (the first run's one failure was that invariant, not the runtime).
- **Real routes:** the API checks compare each open question's `stakeMost` on the real sheet with the runtime's. Campaign `api-wager-30b`: 30 of 30 pass.
- **Unit test:** the stakes case in `tests/gameplay-bench-runtime.test.js`, with a bank of 10:
  - 11 is refused;
  - 6 riding on the boot leaves 4 for the moment question, where 5 is refused;
  - right on both, Ann's total is 10 + (2 + 6) + (1 + 4) = 23;
  - exact replay.
- **UI driver** (`check-explorer-page.js`): the real sheet's stake control offers "Up to 10" (the bank as the server holds it). An answer with a stake of 3, stepped up there and saved, reaches the runtime as 3, and the route checks pass.
- **Also fixed in the page check:** the export step compared the replay with the page's cached hash, which can lag the run. It now compares with the server's hash and the export's own.
- **Findings** (Designs needed item 8, small): the stake moves one point a tap, but banks start at up to 10,000 and "any of your points" grows with your score. Large stakes need quick amounts (half, all in) or typing.
- **Noticed:** the projection now grades once more per staked question (`stakeLimit`); 200-case campaigns still run in a few minutes with four workers, but a single-threaded re-run of 200 cases took about five minutes.

### Capability: settled by the couch (breadth program C, tenth capability, 2026-11-13)

`settle: { by: 'players', take: majority | minority, of?, tie? }` (25 specimens, the largest share of the unconnected settles): "Who will most of you say goes home?" is right when it matches the answer most (or fewest) of you gave, to itself or to the question `of` names. What happened on the show doesn't decide it. It's graded on read from the answers alone. The definition of done, item by item:

- **Runtime:** the profile accepts `settle.by: 'players'` with `of` and `tie`. No runtime version change.
- **Generator** (`proof-family-14`): 30% of questions games add "Who will most of you say goes home?" (majority or minority of the boot answers, a tie counting none or all). Campaign `players-200b`: 200 of 200 pass. Coverage is thin (5 settled answers across 120 cases); the unit test pins the rule.
- **Invariant fixed:** `share-overpaid` assumed `only` pays one person. For a person answer, the engine pays each right pick nobody else named (a finale, where everyone but the winner went home, can have several), so the invariant now checks that no two paid people share a pick. The first run's one failure was the invariant, on a finale.
- **Real routes:** campaign `api-players-30`: 30 of 30 pass.
- **Unit test:** the couch-settled case in `tests/gameplay-bench-runtime.test.js`:
  - most of the couch says x goes home, but z does;
  - the two who said "most will say x" score 2;
  - nobody scores the boot itself;
  - exact replay.
- **UI driver** (`check-explorer-page.js`): answered on the real sheet; server and runtime agree; the route checks pass. The step saves the rider's words (`players-settle-rider.txt`) and prints a NOTE while they misstate the rule.
- **Finding** (Designs needed item 9): the sheet's rider says "Settled by what most of you say happened". The couch doesn't decide what happened; it's what most (or, for `minority`, fewest) of you answered to "Who goes home?". "Right if it matches what most of you answer to Who goes home?" would say it.

### Capability: races and cuts (breadth program C, eleventh capability, 2026-11-13)

`rank.race: { to }` (63 specimens: the first to N points wins and the game ends, on questions games and drafts) and `rank.cut` (54: the guillotine, the lowest out every N episodes, last one standing). KnockoutLogic and the answer walk work both out on read. Moves after someone's out or the game ended were already refused: lineups by the production setter (`validateLineup`'s `moveProblem`), answers by the runtime's answer limits (lives and co-op). The definition of done, item by item:

- **Runtime:** the profile accepts `rank.race` and `rank.cut`. The setup stops writing a player's historic lineups once they're out or the game has ended, as the setter would; it used to stop with "Generated historic lineup was rejected" (`knock-200`'s four fixture defects).
- **Generator** (`proof-family-15`): 15% of lineup games are a cut (every one to three episodes), 12% a race (to 3, 5 or 8); 15% of questions games race (to 2, 4 or 6). Campaign `knock-200b`: 200 of 200 pass. Across 120 cases: 18 races (2 won), 10 cuts (5 cut), 12 moves refused after a knockout.
- **Real routes:** campaign `api-knock-30`: 30 of 30 pass.
- **Unit test:** the knockouts case in `tests/gameplay-bench-runtime.test.js`:
  - the lowest of three is cut after episode 1, and their next lineup is refused;
  - a right "Who goes home?" reaches a race to 2, and a later answer is refused;
  - exact replay.
- **UI driver** (`check-explorer-page.js`): a four-person cut with one episode played. The step views the app as the one cut, records what the page offers (`cut-page.json`), prints a NOTE, and runs the route checks (they pass).
- **Finding: a product bug** (BACKLOG 47; Designs needed item 10). The person who's been cut sees "SET YOUR EPISODE 2 LINEUP · Change until …" as their move, while the grid marks them OUT, and saving it is refused by the server. The production game view's `lineupOf` (src/lib/game/game-view.ts) never asks `KnockoutLogic.moveProblem`. A race won early does the same for everyone. Likely fix: no lineup move once `moveProblem` says so (or a move marked out), plus the page's "you're out" state, which needs design.

### Capability: phases (breadth program C, twelfth capability, 2026-11-13)

Spans from or to a phase (`span: { from: { phase: 'merged' } }` or `to`: 69 specimens) and "When does the merge start?" (a number, asked once, `settle: { by: 'phase', take: 'starts' }`: 17). The season's phases are its rulebook's (`context.engine.phases`). The server reads their starts from the season's rulebook (`phase_starts`, which the desk confirms from accepted post-merge results) and places games on them when a game is made and after every result (phase-starts.ts `settleIn`: `settleStart`, then `settlePhases`, from the first episode still open). The definition of done, item by item:

- **World:** an opt-in `context.phaseStarts` (`{ merged: 3 }`: the phase's first episode). A start is known once that episode has results, as the desk confirms one. Results from the merge on are post-merge (`ep.postMerge`), as the desk's decisions carry it.
- **Runtime** (`core-runtime-11`): `runtime-data.cjs` `phaseList` and `settlePhasesIn` mirror `settleIn`. They run when the game is made (the setup places its span before writing history, and writes no move outside it) and after every results action, as the server does.
  - Episodes the engine makes past the world (a game confirmed to start after the last episode) get a name by number, not a random one, so replays are exact. The first `phases-200` run found three replay divergences there.
  - The answer action and the projection accept the number answer.
- **Materializer:** `live-db.cjs` `syncPhases` makes the zt season's rulebook as its own (`ensureSeasonRulebook`) and sets each start the desk's way (`setPhaseStart`), a start not yet confirmed cleared. Verified in the database: the rulebook is linked to the season with `phase_starts {"merged": 2}`, and the server's league starts where the runtime's does. Removing the show removes it (`rulebooks.season_id` cascades).
- **Generator** (`proof-family-16`): half the worlds get a merge (before their last episode); 20% of lineup games play from or until it, 15% of picks games until it; 30% of questions games ask "When does the merge start?". Campaign `phases-200b`: 200 of 200 pass.
- **Real routes:** campaign `api-phases-30`: 30 of 30 pass.
- **Unit test:** the phases case in `tests/gameplay-bench-runtime.test.js`:
  - a game from the merge waits through episodes 1 and 2;
  - after episode 3 confirms the merge, it plays from 4;
  - the game until the merge ends at 3;
  - episode 3 is post-merge;
  - Ann's "Episode 3" scores 2 and Bo's "5" nothing;
  - exact replay.
- **UI driver** (`check-explorer-page.js`): the real page of a game from the merge says "Starts when Merged starts · Nothing to do yet". After airing, publishing and revealing the merge episode, it says "Set your Episode 4 lineup", and the route checks pass. The page's words are saved in `merge-page.json`.
- **Findings** (Designs needed item 11, small):
  1. The summary line says "From merged": the phase's id, where its name is "Merged" ("From the merge").
  2. A game's first lineup (from the merge) says "last week's stands in till then", and "Until you set one, last week's stands in", when there's no last week.

### Capability: bounties (breadth program C, thirteenth capability, 2026-11-13)

A bounty (`score.bounty: { points }`, 57 specimens): a draft's points that move between seats. When one of your starters votes out one of someone else's, you take the bounty's points from them. Who voted for whom is research's: the season's stored answer (`episode_research`, source `combined`: each castaway's `votedFor` and `votesReceived`, in the format's own keys). The server stamps it on the league's episodes on every read and write (vote-records.ts, `episode.voteRecord`). A record is sure only when research's counts agree with its votes against who went home; one that isn't sure moves nothing. The definition of done, item by item:

- **World:** an event's facts may carry `votes: [{ castawayId, votedFor, votesReceived }]`. `runtime-data.cjs` `researchOf` turns them into research's answer (names and the format's keys). `voteFacts` makes them for generated history and results, and only in a world where one of the games has a bounty, so every other world's facts and hashes are unchanged. Each voter votes for someone going home (three in four) or anyone else. One episode in six miscounts against whoever went home, so its record isn't sure.
- **Runtime** (`core-runtime-12`): `applyFacts` stamps each episode's record as the server does: a game with a bounty, an episode with exits, the record read by names (`Formats.voteRecordOf` with `Core.findCastawayByName`). The results action accepts `votes`.
- **Materializer:** `live-db.cjs` writes the zt show's research rows from the same payload (`researchOf`), one per released episode with votes. Removing the show removes them (`show_id` cascades).
- **Verified against the server:** with the rows materialized, the real games route says Ann +12 and Bo −12, the same totals (19.5, −11), and the same unsure third episode. Without the rows the server drops the stored records (vote-records.ts deletes a stamp research doesn't back), so its agreement shows it read them.
- **Generator** (`proof-family-17`): 30% of lineup games not ranked by a cut (the schema's rule) get a bounty of 1 to 3, and results carry votes. Campaign `bounty-e2`: 200 of 200 pass. Over its first 80 cases, 15 bounty games held 56 sure records and 13 unsure ones; points moved in 3, as the first viewer saw them.
- **Invariants:**
  - `bounty-not-zero-sum`: a transfer adds up to nothing.
  - `bounty-past-mark`: each viewer's bounties equal a recount from the full state's records through their mark, on the game as its span saw it (`spanView`: nothing after a race was won counts).
  - The first run's two failures were the check's, not the product's: it counted past a race's end.
- **Real routes:** api-checks' `bounty-disagree` compares each seat's bounty with the server's (`twists.bounty`). Campaign `bounty-api`: 30 of 30 pass (5 cases with bounties).
- **Unit test:** the bounties case in `tests/gameplay-bench-runtime.test.js`. Ann's starters voting out Bo's starter take 2 a vote from Bo. The next episode's miscounted record is void. Exact replay.
- **UI driver** (`check-explorer-page.js`): a three-episode bounty game on the real page (screenshot `05u-bounty`, words in `bounty-page.json`), and the route checks pass.
- **Findings** (Designs needed item 12): the page names "Bounties" in its summary, but the season grid's squares (Ann's 2, 2.5 and 3; Bo's 2.5, −1.5 and 0) don't add up to the totals (19.5 and −11). The 12 bounty points sit on no episode, and nothing says who voted out whom.

### Capability: teams of players (breadth program C, fourteenth capability, 2026-11-13)

Teams of players drawn at random (`rank.teams: { of, score }`, 49 specimens, every one drawn). The server seeds the draw once (`TeamLogic.seed`: a random id) and settles it before and after every write (db.ts `withLeagueLock`: `TeamLogic.settle`). Once the game has started, it keeps the draw as it stood, and someone who joins later is placed from the first episode still to play. The definition of done:

- **Runtime:** `gameData` seeds the draw from the game's id (`zt-<game>`), so a replay draws the same teams; the materialized state carries the seed, so the server keeps that draw. `settleWrite` runs `TeamLogic.settle` at the scenario's clock around head to head's settle, as the server does. Teams each seat chooses (`made: 'choose'`, the player-teams route) stay a gap: none of the specimens use it.
- **Generator** (`proof-family-18`): 20% of games with three or more people play in two teams (mean or sum). The engine refuses some combinations, so the generator skips them:
  - a game of questions with lives or a race;
  - a survival pool's streak;
  - playoffs for more than the two teams.

  Campaign `teams-e4`: 200 of 200 pass.
- **Invariants:** `team-members` checks that nobody is listed on two teams and that points are finite. It also checks that a seat kept on its team from an episode already played is listed on it. A seat still catching up when an own-pace game started joins once caught up, from the next open episode: its team is "yours" before it lists you. That's the engine's rule, and the server agrees, so the first run's 14 failures were the check's.
- **Real routes:** api-checks' `teams-disagree` compares who's on each team, its points and place, whether the teams are set, and yours. Campaign `teams-api`: 30 of 30 pass (6 cases with teams).
- **Unit test:** the teams case. Teams are seeded from the game's id, two a team, and the same definition draws the same teams. They're not kept before the start, and kept as drawn after the first results. Each team's points are its members' mean. Exact replay.
- **UI driver:** a four-person, two-team game on the real page (screenshot `05v-teams`, words in `teams-page.json`), and the route checks pass.
- **Findings** (Designs needed item 13):
  1. The page says "In 2 teams" and "Teams: Bo + Di · Cy + you", but never what each team has (4.75 against 2.5) or which is ahead. Your line reads "Tied 3rd of 4 · −0.5 pts": the team's shared place beside your own points.
  2. Someone catching up in an own-pace game has a team before they're on it.

### Capability: parlays (breadth program C, fifteenth capability, 2026-11-13)

A parlay (`score.parlays: [{ of: [question ids], times }]`, 48 specimens) ties two or three per-episode questions of a game of questions together: someone right on every one of them in the same window has each leg's points multiplied by `times`. A leg left blank, wrong, or that didn't count breaks it, and then each leg pays its own points or nothing (`AnswerLogic.allRight`). A staked leg that pays has its points and its stake's winnings multiplied (the schema's order). Nothing is kept: the grade works it out on every read, on the server and in the runtime alike. The definition of done:

- **Runtime:** connected in the profile (`score.parlays`); no new world facts, since legs settle from the results and moments every other question uses. The projection now carries `earned` (what each window paid each seat, as the question sheet has it) and `worth` (a rollover window's points with its jackpot), both through the viewer's mark (and, from `core-runtime-13`, the open window's worth: see rollovers).
- **Generator** (`proof-family-19`, then 22 and 23): 35% of games of questions with two or more legs that aren't split pots (the schema's rule) get a parlay of two or three legs, times 2 or 3. The first runs showed parlays almost never paid: across 100 cases, 22 parlay games had two windows with every leg answered and none paid. Two causes. A per-episode leg is open only until its airing, which the walk's clock steps pass within a few steps. And each step answered a random question for a random person, mostly the season-long ones (open all season). From `proof-family-22`, in a case with a parlay, 35% of steps answer an open leg, a part-answered window's first: 13 windows answered in full and 3 paid in 40 cases. Campaign `parlays-200f` (seed 25, depth 40, on `proof-family-22`): 200 of 200 pass, with one case reporting BACKLOG 48 (`known:teams-none-left`). Coverage over its first 100 cases (`cover.cjs` in its folder): 21 parlay games, 14 windows with every leg answered, none paid: legs were answered but rarely all right. A yes/no leg comes true only when its moment happens, which results drew at random (one in three). From `proof-family-23`, a moment someone said yes to happens half the time, as the boot and the idol already follow the couch's guesses; over the first 100 cases of `times-200` (on `proof-family-23`, `parlay-cover.cjs` in its folder), 14 parlay games had 12 windows with every leg answered and 2 that paid..
- **Invariant** (`parlay-paid`): on every window a viewer sees, each seat right on every leg is paid each leg's points times the parlay's (with a stake's winnings, also multiplied), or nothing is multiplied for anyone. Stakes' bounds allow for a leg's multiplier (`wager-out-of-bounds`).
- **Real routes:** api-checks reads each past window's question sheet (`/api/seasons/{id}/answers?episode=N`, "for how it went") and compares what it paid each seat with the runtime's `earned` (`earned-disagree`), and a rolling question's jackpot with the runtime's `worth` (`jackpot-disagree`, ready for rollovers). Campaign `parlays-api3` (seed 26, depth 24, one worker, on `proof-family-22`): 30 of 30 pass (22 cases report the side-bets finding, `known:classic-state-spoiler`).
- **Unit test:** the parlays case in `tests/gameplay-bench-runtime.test.js`. Ann right on both legs gets the boot's 2 and the moment's 1 tripled (9); Bo, right on the boot alone, gets 2; Cy, with a leg left blank, gets 1. Exact replay.
- **UI driver** (`check-explorer-page.js`, `--only=parlay`): episode 1 paid Ann both legs doubled (the boot's 4) and Bo, right on one, the boot's 2. The real sheet and page are recorded (screenshot `05w-parlay`, words in `parlay-page.json`), an answer saved on the page reaches the runtime with no mismatch, and the route checks pass. The step's first run failed on its own assertion: the runtime's `earned` leaves out a seat that earned nothing (Bo, wrong on the moment), as the API check already reads it, where the step expected a 0.
- **Found on the way:** BACKLOG 48 (`known:teams-none-left`): a team game with a cut ends at its first episode when every seat is catching up as it starts.
- **Findings** (Designs needed item 14): the summary line says "Parlay pays double", and nothing else does. The questions read "+2 · 2 points if you're right" and "+1 · 1 point", with no word that they're tied together or that both right pays double. Ann's sheet then shows "Who goes home? 2 pts · Harper went home · +4" with no reason for the 4. How it plays lists the two questions without the parlay. The game view has what's needed: the spec's legs and `times`, and each window's `earned`.

### Capability: multipliers (breadth program C, sixteenth capability, 2026-11-13)

A multiplier (`score.times: [{ times, episode | finale }]`, 45 specimens, every one episode 1 or the finale, on drafts and pick games scored by moments) multiplies everything an episode scores. The finale is the episode whose results named the winner (`finaleEpisodeOf`), known to a viewer once they've seen it. The engine works it out on every read (`ActiveRosterLogic.timesFor`); nothing is kept. A run of episodes (`from`) and a phase stay gaps: no specimen uses them. The definition of done:

- **Runtime:** connected in the profile for episode and finale windows. No new facts or materializing: the server reads the spec and the season's results.
- **Paired sessions:** the check is the same game without its multipliers, walked with the same actions. Every action is taken the same way on the twin, and each seat's points on each episode (the season grid, `game.plays.rows`, which drafts and pick games both have) are the twin's times that episode's windows.
- **Unit test:** the multipliers case. A draft and a pick game with episode 1 doubled and the finale tripled, against twins without them, walked through an ordinary episode 2 and the finale. Episode 2 is unchanged; Bo, before the finale, sees episode 1 doubled and nothing of the finale. Exact replay.
- **Generator** (`proof-family-21`): 30% of drafts and moment-scored pick games get episode 1's window (or, 30% of the time, the first walked episode's), the finale's, or both, times 2 or 3. Never beside a race or a cut: points decide who's out there, so the twin could play a different game.
- **Invariant** (`times-paired`, in the case runner after the replay check): the paired-sessions check above on every case with a multiplier, for every viewer. Positive control: a runner copy that ignores the multiplier fails 7 of the first 12 multiplied cases (the other 5 had no scored square on a multiplied episode). Campaign `times-200` (seed 27, depth 40): 200 of 200 pass (on `proof-family-23` and `core-runtime-12`; the table fix below touches only games with an answer walk, never a multiplied one), with three cases reporting BACKLOG 49 (`known:hits-grid-plain`). Coverage over its first 100 cases (`cover.cjs`): 37 multiplied games: 21 episode windows and 23 finale windows; 10 finales played; 19 scored squares on a multiplied episode and 10 on a multiplied finale.
- **Real routes:** api-checks' `grid-disagree` compares a multiplied game's season grid (each seat's points on each episode) with the server's. Campaign `times-api` (seed 28, depth 24, one worker): 29 of 30 pass. Seven cases had a multiplier, and the one failure was elsewhere: a co-op game's standings, a runtime fault fixed under rollovers below. Rerun on the fixed runtime as `times-api2` (seed 28): 30 of 30 pass (9 cases with a multiplier).
- **UI driver** (`--only=multipliers`): a two-person Weekly Lineup with episode 1 doubled and the finale tripled ("Big nights"). Episode 1 is checked doubled against its twin; then the finale is aired, published and revealed on the page. The run is exported, resumed, and checked against the twin replaying its trace: episodes 1 and 3 are multiplied, 2 isn't. Screenshots `05x-multipliers` and `05y-multipliers-finale`, words in `multipliers-page.json`; the route checks pass. Episode 1: Ann 3.5 → 7, Bo 3 → 6; the finale: −4.5 → −13.5 and −6 → −18. The step's first run failed on its own reading of the page's export (a wrapper beside a source fingerprint, as the export step reads it).
- **Findings** (Designs needed item 15): the summary says "Episode 1 counts double" (chip "×2 EP1") and never mentions the finale's triple, before or after it plays; describe.js has the words ("Finale counts triple"), but the page shows only the first rider. The multiplied squares in the season grid (7 and 6; −13.5 and −18) look like any others. The week's lines carry the multiplied points with the moment's plain name ("Avery +8 · Individual immunity win", normally +4; "−9 · Voted out" in the finale), with no ×2 or ×3, so they read as wrong points. The game view has the factor for each episode (`episodeScore`'s `times`), but the week rows don't carry it. Also found: BACKLOG 49 (hits counted once each: the grid and the week don't add up to the standings), reported as `known:hits-grid-plain`.

### Capability: rollovers (breadth program C, seventeenth capability, 2026-11-13)

A rolling question (`rollover: true` on a question asked each episode, 43 specimens, every one a game of questions ranked by total or standing) carries its points into the next window when nobody earns anything on it (nobody right, nobody answered, or it didn't count); a win resets it. The grade walks each rolling question window by window on every read (`AnswerLogic.grade`: `Seq.jackpot`, `Seq.carry`); the first window still to settle carries the jackpot the sheet shows before you answer. Nothing is kept. The definition of done:

- **Runtime** (`core-runtime-13`): connected in the profile (the question rider `rollover`). The projection's `worth` now includes each open window's (its jackpot as the sheet opens), beside every window through the viewer's mark; the grade stops at the first window still to settle, so nothing past the viewer's copy is in it.
- **Found on the way, a runtime fix:** the multipliers API run failed once (`standings-disagree`). In a co-op game the couch had lost, then the finale settled "Who wins?". The server's table kept the walk's totals, which freeze at the game's end (`answer-points.ts` `pointsOf`), so it showed nothing, while the runtime ranked by the grade's points and counted the call. The runtime now ranks a game with an answer walk (lives, a race, co-op) by its walk's totals, as the server does. Unit test: "co-op lost" (the table, like the server, shows 0; since core-runtime-16 the sheet, graded on the copy cut at the game's end, pays the call nothing either).
- **Unit test:** the rollovers case. "Who goes home?" worth 3, rolling: nobody right, then nobody answering, make episode 3's worth 9 (the open window's jackpot); Ann right takes 9; episode 4's is back to 3. Exact replay.
- **Generator** (`proof-family-24`): 30% of plain per-episode questions (not shared, not staked) roll over, half of them worth 3; a rolling question is never a parlay's leg. `proof-family-25`: an episode's results never list one moment twice for one person. The first rollovers API run hit an `infrastructure` outcome (`api:23505`, `idx_season_decisions_identity`): family 23's "a moment someone said yes to happens" gave a reward win to the castaway the episode's random moment already had. The engine takes the repeat, but the season's decisions keep one row per person, moment and episode (a repeat is a count). Fixed at its source (a filter that draws nothing). Probe over 40 cases: 12 rolling games, 37 of 52 windows carried a jackpot (the biggest 18), and one was won.
- **Invariant** (`rollover-carry`, after every step, for every viewer): each window's worth is its points, plus the window before's when nobody earned anything on it; the first in play is worth its points. Through the open window. Campaign `roll-200` (seed 29, depth 40, `proof-family-24`): 200 of 200 pass (one case reporting BACKLOG 49); 69 of 96 windows carried a jackpot and 2 were won. After the fix below, `roll-200b` (seed 29, `proof-family-25`): 200 of 200 pass (one case reporting BACKLOG 49). Coverage over its first 100 cases (`cover.cjs`): 27 rolling games, 71 of 101 windows carrying a jackpot (the biggest 18), and 3 jackpots won.
- **Real routes:** api-checks' `jackpot-disagree` (each past window's sheet) and, new, `open-jackpot-disagree`: the open window's jackpot on the sheet as it opens, against the runtime's `worth`. Campaign `roll-api` (seed 30, depth 24, one worker): `roll-api` (`proof-family-24`): 29 pass and one `infrastructure` outcome, the duplicate moment described under the generator. Rerun as `roll-api2` (seed 30, `proof-family-25`): 30 of 30 pass (6 cases with a rolling question; 25 report the side-bets finding). Multipliers' API run again on the fixed runtime, `times-api2` (seed 28): 30 of 30 pass (9 cases with a multiplier; one case reporting BACKLOG 49).
- **UI driver** (`--only=rollover`): a two-person game, "Who goes home?" worth 3 and rolling. Episode 1 both wrong and episode 2 nobody answering make episode 3's worth 9. The real sheet's jackpot is 6 (carried onto its 3), as the runtime has it. The page and question are recorded (screenshot `05z-rollover`, words in `rollover-page.json`), an answer saved there reaches the runtime with no mismatch, and the route checks pass.
- **Findings** (Designs needed item 16, small): the page does well here. There's a summary chip ("Unwon points roll over"), the question says "Nobody got the last one: +6 rolled into this", and How it plays explains it. But the question's headline still says "+3 · 3 points if you're right" while it's worth 9: the total is never stated.

### Capability: whole-game moment questions (breadth program C, eighteenth capability; the first of the other answer kinds, 2026-11-13)

A question asked once for the whole game, locked at its start and settled by a moment (`asked: 'once'`, `settle: { by: 'moment', take }`): who it happens to (`who`, a person, `pick` of them), who it happens to first (`first`), whether it happens at all (`happened`, yes or no), and how many times (`count`, a number: the closest wins, ties all). The first of the "other answer kinds" family (`node scripts/dev-test/profile-blockers.js --kinds`). The specimens come from several shows (killedOff, perfectScore, quit); the runtime's world is Survivor's, so the generator asks Survivor's own moments. Nothing is kept: the grade settles them on every read. The engine's rules, as the runs found them:

- `first` and `happened` settle as soon as it happens; `happened` is "no" once the season's over.
- `who` and `count` settle at the game's end, over every episode: the finale, or where a game that ends early ended (a race won, a couch out of lives), on the sheet as in the table.
- `who` or `first` that never happened is void (`off`, "It didn't happen"), with no points either way.
- While any episode has only early (partial) results, the count waits.

The definition of done:

- **Runtime:** no new code; connected in the profile (`momentOnce`: each `take` with its answer kind).
- **Unit test:** "whole-game moment questions". Four questions, two people, through the finale. The first idol and a reward win settle at once; who found one and how many wait for the end; then Ann's two right picks pay 2 each and her count of 2 (right) pays 3. Exact replay.
- **Generator** (`proof-family-26`, then 27): 35% of games of questions get one or two of four Survivor questions ("Who finds an idol this season?" with one or two picks, "Who wins individual immunity first?", "Will anyone go to Exile?", "How many reward wins this season?"). A generated game has started by the case's start, so these are answered as setup, before it (episode 0): each person each question four times in five, from a random stream of their own. The first 200-case run passed, but its count showed "first" settled 18 times and never paid, and "who" settled 3 times and never paid: picks were anyone among 10 to 18, and the first immunity is usually in the history. From `proof-family-27`, half the person picks follow the generated history (read from a probe open of the same world), and walk results sometimes give an idol to someone picked before the start.
- **Invariant** (`once-moment`, after every step, for every viewer): an independent recount from the world's facts through the viewer's mark, by the rules above. Its first runs failed on the check's own rules four times: numbers are closest-wins, not exact; an unfulfilled `who` is void; a count waits while results are partial; and, first written as a product bug (BACKLOG 50, now retracted), that a game ending early settled on the sheet at the season's end. That was the runtime's own fault: it graded the sheet on the viewer's copy uncut, where the server cuts it at the game's end. The API tier caught it (`once-earned-disagree`, a co-op couch out of lives, during the weekly card's run), and the runtime was fixed (core-runtime-16).
- **Real routes:** api-checks' `once-earned-disagree`: what each closed whole-game question paid each seat on the real sheet, against the runtime's grade. This also checks the season-long winner and final-three questions from capability two. Campaign `once-api` (seed 32, depth 24, one worker, family 26): 30 of 30 pass; `once-api2` (family 27): 30 of 30 pass (7 cases with whole-game questions; one reports BACKLOG 49).
- **Campaign** `once-200` (seed 31, depth 40, family 26): 200 of 200 pass. `once-200b` (family 27): 200 of 200 pass (three cases report BACKLOG 49). Coverage over its first 100 cases (`cover.cjs`): 24 games, 83 answers, 32 settled, 17 paid. By kind: happened 17 settled and 6 paid; first 9 and 7; who 3 and 2; how many 3 and 2. Who and how many settle only at the season's end, which a walk reaches in some cases.
- **UI driver** (`--only=whole-game`): a two-person game with all four, answered before the start, three episodes played. Ann's answers follow the history (the first immunity winner, an idol finder, the reward wins so far). Ann's first-immunity pick has paid 3 before the finale. The finale is aired, published and revealed on the page; every question then settles on the real sheet (Ann 2, 3, 1 and 3; Bo nothing), and the route checks pass. Screenshots `05za-whole-game` and `05zb-whole-game-settled`, words in `whole-game-page.json`.
- **Found, then retracted:** BACKLOG 50 (see the invariant above). The unit test "a game that ends early settles its whole-game questions at its end" pins the server's rule: a race won at episode 1 voids "Who finds an idol?" there, and an idol found later never counts, on the sheet or in the standings.
- **Findings** (Designs needed item 17, item 2's family): the page never shows how these questions settled. Ann has 3 points before the finale and 9 after, every square in the season grid is 0, and her sheet says "Nothing was asked that episode". The questions appear only in How it plays, as rules. Also the words "0 a episode".

### Capability: Weekly Calls (breadth program C, nineteenth capability; the largest of the other answer kinds, 2026-11-13)

Weekly Calls (`{ preset: 'weekly-calls' }`: one question, the show's calls; 11 specimens) has its own subsystem (src/lib/server/calls.ts).
- **What a call is:** a person's, one per episode and question, whichever couch they're on (`episode_calls`), counted by every Weekly Calls game on the season.
- **The two calls:** each episode has who goes home (from who's still in) and a yes or no on one of the format's callable moments in turn (`src/lib/game/calls.ts` `callQuestions`, from the season's rulebook).
- **When:** calls open for the next episode to air until it starts, or at your own pace on a paced season or own-pace game. Calling needs the episode before seen.
- **Settling:** from the season's accepted results (`episodeFacts`). Who goes home is known once anyone left (the winner leaving by winning doesn't count). A moment is known once the episode has any accepted moment; partial results aren't decisions yet.
- **The table:** each player's right calls (`leagueCalls`), not the answer grade.

A talk show's calls (settled by the couch's says) and a public pool's Who goes home? stay gaps. The definition of done:

- **Runtime** (`core-runtime-14`, new `explorer/runtime-calls.cjs`, loaded only by a case with calls):
  - a calls store per context, kept only when a game counts calls, so every other case's hash and pinned replays are unchanged; the setup can carry calls made before the case (`setup.stores.calls`);
  - a `call` action (`contextId`, `personId`, `episode`, `question`, `answer` or null), refused in the route's own words: "Calls are open for Episode N", "Episode N has no air time yet", "Calls for Episode N closed when it started", "See Episode N first", "Call someone still in", "Yes or no";
  - the table from the calls (the pure calls.ts functions, the book from the format's rulebook);
  - a projection `calls`: each episode as the calls route gives it to that person, or the route's refusal.
- **Materializer:** `episode_calls` from the store, a cast call by its `season_cast` id (matched by name); open follows (the defaults) let everyone's calls count for each other. Both tables cascade with the season and the user.
- **Verified against the server:** a materialized run gives the same standings and the same calls route, episode by episode, for someone caught up and someone behind. With the calls left out of the database, the standings and three calls views disagree, so the server read exactly what the runtime wrote.
- **Live bench:** the explorer page's frames now write calls. A POST to the calls route becomes `call` actions, a cast call mapped back from its `season_cast` id; `Live.read` reads `episode_calls` and the live comparison checks each call.
- **Unit test:** "Weekly Calls". Calls made, the route's refusals, someone behind refused, settlement (Ann right twice: 2; Bo wrong: 0), who went home no longer callable, exact replay.
- **Generator** (`proof-family-28`): a Weekly Calls game on 25% of cases (own-pace four times in five). In such a case 30% of steps call an episode open to someone, 15% of them invalid. Results follow called boots and moments called yes, as they follow answers. Probe over 40 cases: 13 with calls, 69 calls accepted, 11 refused with five of the route's messages, 51 kept, 12 right.
- **Invariant** (`calls-tally`, after every step, for every viewer): each player's total is their right calls through the viewer's mark, recounted from the world's accepted results and the store, without the calls module. Campaign `calls-200` (seed 33, depth 40): 200 of 200 pass (one case reporting BACKLOG 49). Coverage over its first 100 cases (`cover.cjs`): 32 cases with calls (24 own-pace); 173 calls accepted and 22 refused (five of the route's messages); 125 kept (58 who goes home, 67 moments); 27 right in the tables.
- **Real routes:** the existing standings check, and `calls-disagree` / `calls-status-disagree`: each episode through the one after the person's mark, as the calls route gives it (status, catch-up, the two questions and their options, their own calls, the verdicts), or the same refusal. A cast call is compared by name. Campaign `calls-api` (seed 34, depth 24, one worker): 30 of 30 pass (7 cases with calls; 18 report the side-bets finding).
- **UI driver** (`--only="Weekly Calls"`): Ann called episode 1's boot right before it aired, Bo wrong (setup calls): 1 to 0. On the real page, the game's strip opens Call it for episode 2, Ann calls both, and Done saves. Both calls reach the runtime with no mismatch, and the route checks pass. Screenshots `05zc-weekly-calls` and `05zd-call-it`, words in `weekly-calls-page.json`.
- **Findings** (Designs needed item 18): How it plays tells a Survivor game's players "The couch says what happened as it watches: two of you agreeing settles a call", the talk-show rule (describe.js says it for every Weekly Calls game). Their calls are settled by the season's results. Otherwise the page and the Call it sheet read well.

### Capability: confidence picks (breadth program C, twentieth capability; another of the other answer kinds, 2026-11-13)

A confidence question ("Rank who goes home, surest first": `answer: 'confidence'`, `pick` N, asked each episode, settled by who goes home): each right pick scores the question's points times its weight, the first N, then one less each. A ranking of fewer than N is allowed, its first still worth N. The engine refuses a repeat ("Rank each one once"), too many ("Rank N at most") and someone not still in ("Rank only who is still in"). The definition of done:

- **Runtime** (`core-runtime-15`): the answer action and the projection's options take `confidence` (the cast's faces); the profile connects `confidence · each · start · results:out`. 827 of 1,312 specimens run.
- **Unit test:** "confidence picks". Three people; the boot ranked second pays 2, first 3, unranked 0; the three refusals; exact replay.
- **Generator** (`proof-family-29`): 25% of games of questions get a ranking of 2 to 4, never shared, staked, rolling or a parlay's leg; the boot sometimes follows someone's surest pick. The first probe answered none: rankings competed with every other question for steps. A confidence ranking is now a focus question, getting steps of its own before it locks, as a parlay's legs do: 5 settled and 4 paid (weights 2 and 4) in 60 cases.
- **Invariant** (`confidence-paid`, after every step, for every viewer): a settled ranking pays its points times the weight of each right pick, recounted from who went home in the world's facts. Campaign `conf-200` (seed 35, depth 40): 200 of 200 pass (one case reporting BACKLOG 48, three BACKLOG 49). Coverage over its first 100 cases (`cover.cjs`): 26 games with a ranking, 24 rankings settled, 11 paid (weights from 2 to 6: 2, 3, 4, and a 6 that was points 2 times 3).
- **Real routes:** api-checks' `earned-disagree` now reads each past window's sheet for games with a ranking too, and compares what it paid each seat with the runtime's grade. Campaign `conf-api` (seed 36, depth 24, one worker): 30 of 30 pass (5 cases with a ranking).
- **UI driver** (`--only="confidence picks"`): Ann ranked episode 1's boot second (setup): 2. On the real sheet she taps three faces for episode 2 ("Tap your surest first: it scores the most · 3 of 3", each face showing its rank) and saves; the ranking reaches the runtime with no mismatch, and the route checks pass. Screenshot `05ze-confidence`, words in `confidence-page.json`.
- **Findings** (Designs needed item 19, small): the question headlines "+1" when the surest pick is worth 3, and the sheet later shows "1 pts" beside a +2. The rank numbers and How it plays ("3 for the first") are clear.

### Capability: the weekly card (breadth program C, twenty-first capability, 2026-11-13)

A weekly card (`card: { from: 'moments', each, of }` with `score.only: 'card'`; 74 specimens, every one a pick game counting hits once for each pick, `hits: 'pick'`): each episode's card is the next `each` of the spec's list of moments, in turn (`Spec.cardLines` → `drawInTurn`), so it's new each week and the same for everyone. Only that week's card moments count, each a hit once for each pick however often. Pure: nothing is stored. A card the bot chooses (2 specimens) or a host writes (1) needs their choice made server-side, and stays a gap. The definition of done:

- **Runtime:** no new code; the profile connects a drawn card and `only: 'card'`. 901 of 1,312 specimens run.
- **Unit test:** "the weekly card". The card rotates (episode 1: reward win, individual immunity, sat out; episode 2: idol found, third place, reward win). Ann's pick with two card moments, one of them twice, scores 2; Bo's with one card moment and one off the card scores 1. Exact replay.
- **Generator** (`proof-family-30`, then 31): 35% of moment-scored pick games play a card of 2 to 5 lines from a list of 5 to 10 of Survivor's moments, no multiplier. From 31, half the time an episode's results give one picked castaway a moment on that week's card. Card points stay rarer than off-card moments, since the generated history's moments are random: over the probe, 6 card hits against 19 off-card moments on picks. Both sides of the rule happen.
- **Invariant** (`card-only`, after every step, for every viewer): each seat's square each episode is, for each of their picks, the number of that week's card moments that castaway had, recounted from the world's facts. A square this viewer isn't shown yet (`null`, a seat at its own pace) is skipped; the first probe's one failure was that. Campaign `card-200` (seed 37, depth 40): 200 of 200 pass (on core-runtime-15; the runtime fix below changes only how a game of questions grades its sheet, never a card game), two cases reporting BACKLOG 49. Coverage over its first 100 cases (`cover.cjs`): 16 card games, 198 squares, 40 card hits counted and 100 off-card moments on picks that didn't count.
- **Real routes:** api-checks' `grid-disagree` now covers a card game's season grid as well as a multiplied one's. Campaign `card-api` (seed 38, depth 24, one worker): its first run stopped at one failure elsewhere, `once-earned-disagree` on a co-op game's whole-game question, the runtime's fault (see whole-game moment questions: BACKLOG 50 retracted, core-runtime-16). Rerun on the fixed runtime: 30 of 30 pass (4 cases with a card).
- **UI driver** (`--only="the weekly card"`): the game page and the real moves sheet are recorded; Ann picks for episode 2 and saves; the pick reaches the runtime with no mismatch; the route checks pass, the grid included. Screenshots `05zf-weekly-card` and `05zg-weekly-card-pick`, words in `weekly-card-page.json`.
- **Findings** (Designs needed item 20): the game calls itself a Survival Pool ("PICK A SURVIVOR"), and its sheet asks "Who survives Episode 2? Streak 1. Not someone you've used." There's no streak, nobody goes out, and this one lets you pick again. Neither names this week's card, and How it plays names the list by ids. The engine types every pick game `pickem`, so the pool's words likely reach any moment-scored pick game.

### Capability: beat the bot (breadth program C, twenty-second capability, 2026-11-13)

A question played against the bot (`beat: { by: 'bot', none }`, 75 specimens, every one a per-episode person or yes/no question, `none: 'plays'`). The bot makes its own call on each window before its first lock, kept apart and hidden until that lock (`bot_calls`, filed by db/bot-calls.js; the server hands each locked call to the grade as `facts.bot`: answer-points.ts `botCallsFor`). A right answer scores only where the bot's call isn't right: for a person answer, each right pick the bot didn't name; for a yes or no, only when the bot was wrong. A window with no call plays as usual (`none: 'plays'`) or doesn't count (`'void'`). The bot is never a seat: how the couch did against it is a line beside the table (`botLine`: its calls settled and right, each seat's beat and beaten). The definition of done:

- **Runtime** (`core-runtime-17`):
  - a bot store per game, kept only when a game plays against the bot, so other hashes are unchanged; the setup can carry calls (`setup.stores.bot`);
  - a `botCall` action (`gameId`, `question`, `episode`, `answer`): one a window, changeable until the lock, refused after it ("The bot calls before the window's first lock"), checked against who could be picked as a seat's answer is;
  - the bot's locked calls in the grade's facts on the viewer's copy, the walk's and the refusals';
  - the bot line, ported from `botLine` (it reads the grade, not the DB).

  The profile connects a person or yes/no question asked each episode, never beside a share, stake or rollover. 976 of 1,312 specimens run.
- **Materializer:** `bot_calls` rows from the store, filed as a stand-in's (`made_by 'stand-in'`: never production's); they cascade with the league.
- **Verified against the server:** a materialized run gives the same standings, the same bot line, and the same payouts window by window. A bot call on the still-open window stays hidden (the spoiler scan). Without the bot's calls in the database, the standings, the bot line and four windows' payouts disagree.
- **Unit test:** "beat the bot". The bot names the boot: Ann and Cy, right, score nothing for it. It says no to a reward win and is wrong: Ann and Bo score. A late call is refused, nothing of the bot shows before the lock, a window with no call plays. Exact replay.
- **Generator** (`proof-family-32`, then 33): 30% of plain per-episode person or yes/no questions settled by the results or a moment play against the bot, a no-call window playing two times in three, else void. The bot calls open windows (a focus step), and a beat question is a focus question.
  - The first probes settled almost nothing with a call: answers and calls came only in the walk's few episodes.
  - From 33, over the episodes already played, each person answered seven times in ten and the bot called three times in four, about two in five of each right (read from a probe of the same world): 8 settled windows with a call, 12 right answers blocked, 3 scored in 60 cases.
- **Invariant** (`beat-paid`, after every step, for every viewer): on a settled window, a right answer scores its points unless the bot's call (read from its store, never through the runtime's facts) named it or got it right; with no call, it plays or is void. Campaign `beat-200` (seed 39, depth 40): 200 of 200 pass (one case reporting BACKLOG 49). Coverage over its first 100 cases (`cover.cjs`): 10 games against the bot, 14 bot calls, 10 settled windows with a call, 5 right answers the bot blocked and 4 that scored. A settled window without a call didn't occur in these walks; the unit test plays one.
- **Real routes:** api-checks' `bot-line-disagree` (the game view's bot line) and `earned-disagree` (each past window's sheet, now for games against the bot too). Campaign `beat-api` (seed 40, depth 24, one worker): 30 of 30 pass (3 cases with a game against the bot). For a stretch two runners worked this campaign at once (a shell `&` start outlived its call beside a resume: see the lessons); each case still counts once, by its first result, and none failed.
- **UI driver** (`--only="beat the bot"`): episode 1 played, the bot naming the boot Ann named (nothing) and wrong on the moment Ann got right (1). The page is recorded (screenshot `05zh-beat-the-bot`, words in `beat-the-bot-page.json`), Ann answers episode 2 on the real sheet, it reaches the runtime with no mismatch, and the route checks pass.
- **Findings** (Designs needed item 21): the rule reads well, but once a window locks the bot's call appears nowhere. Ann's sheet says "Who goes home? Cameron · Cameron went home · 0" with nothing about why, and the couch's record against the bot isn't on the page.

### Capability: Outlast in reverse (breadth program C, twenty-third capability, 2026-11-13)

Outlast in reverse (`score: { by: 'place', reverse: true }`, 31 specimens): every holding counts, and a castaway earns 1 plus 1 for everyone who outlasts them, the cast's size + 1 less their forward place: the first out of 18 scores 18, the winner 1. Someone still in counts what they'd score going home next (the cast less the boots so far), shrinking as they outlast boots (`EliminationOrderScoringStrategy`, `Seq.placed`, `Seq.stillIn`). Nothing is kept. The definition of done:

- **Runtime:** no new code; the profile connects `reverse`. 1,004 of 1,312 specimens run. (Three reverse specimens stay blocked by something else.)
- **Paired sessions:** in reverse each holding is worth the cast's size + 1 less its forward value, gone home or still in. So each seat's reverse total is (size + 1) for every holding less the same game's total played forward (a twin, walked with the same actions). The table's `team` lists every holding, gone home or not.
- **Unit test:** "Outlast in reverse". The same draft forward and in reverse, three episodes played, both seats with holdings gone home; the identity for each seat; exact replay.
- **Generator** (`proof-family-34`): Outlast games, which no family had made before. 30% of cases have one, a blind shared draft of 2 to 4 each, every holding counted; half of them in reverse.
- **Invariant** (`reverse-paired`, in the case runner after the replay check, beside multipliers' twin): every action is taken the same way forward, and the identity holds for every seat as every viewer sees it. Positive control: a runner copy using the cast's size instead of size + 1 fails all 5 reverse cases of the probe. Campaign `rev-200` (seed 41, depth 40): 200 of 200 pass (one case reporting BACKLOG 49). Coverage over its first 100 cases (`cover.cjs`, every viewer): 15 Outlast games forward and 14 in reverse; summed over every viewer, 277 holdings gone home and 187 still in checked; the best seat 66.
- **Real routes:** the standings check covers it (a reverse total is the table's). Campaign `rev-api` (seed 42, depth 24, one worker): 30 of 30 pass (11 Outlast games, 5 in reverse).
- **UI driver** (`--only="Outlast in reverse"`): a reverse Outlast with three episodes played, recorded on the real page (screenshot `05zi-outlast-reverse`, words in `outlast-reverse-page.json`); the route checks pass.
- **Found:** BACKLOG 51. The generated game page notes "Fewest points wins" under a reversed table, beside "1st of 2 · 19 pts" for the higher score; in reverse the most points win, as the routes rank them.
- **Findings** (Designs needed item 22): besides that note, the sheet's episode by episode reads a running value as points scored ("+22 (Ep 1)", then −2 and −1, "6.3 a episode"). How it plays says the rule right ("the earlier yours go home, the better").

### Capability: the top scorer's twist (breadth program C, twenty-fourth capability, 2026-11-13)

The top scorer's twist (`score.twist: { of, who, by, tie, closes, fallback }`, 35 specimens, every one double or half points on a lineup or a moment-scored pick game). After each episode's final results, its top scorer, among the seats playing, chooses one of the spec's twists for the next episode. The top scorer is by that episode's points, a tie broken by the standings. The choice is private until it closes, `closes` hours before the episode airs (12 by default), or when the episode locks or has results; it lives in the server's own table (`twist_choices`), never in the state. Once closed, the first read or write files what the episode plays: the choice, if whoever made it still chooses by the data, else the fallback. It is stamped on the episode (`episode.twist`) and multiplies that episode's points. A league at its own pace files nothing and plays the fallback (src/lib/server/twists.ts `stampTwists`, `chooseTwist`; `TwistLogic`). The definition of done:

- **Runtime** (`core-runtime-18`):
  - a twists store per game (the choices by episode, open or filed), kept only for a game with a twist;
  - `stampTwists` ported, run at open and after every action (a clock step can close a choice);
  - a `twist` action (`gameId`, `personId`, `twist`), refused in the route's words: "You don't choose Episode N's twist", "That isn't one of this game's twists", "Watch Episode N's results first: they say who chooses", "Episode N's twist is already set";
  - a projection `twist` mirroring the twist route's GET (the rules, your seat, the episode being chosen, each filed twist).

  The profile connects `score.twist`. 1,039 of 1,312 specimens run.
- **Materializer:** `twist_choices` from the store; the stamps travel with the state. **Live bench:** a POST to the twist route becomes a `twist` action, and the live comparison checks the open choice the server kept.
- **Verified against the server:** with Ann's choice open, and again once filed, the twist route and every other check agree. With the choice rows left out, the twist view disagrees.
- **Unit test:** "the top scorer's twist". Ann tops episode 1 and alone may choose; a twist the game doesn't offer is refused. It's private and unstamped while open, then filed as chosen at the close, after which changing it is refused; Bo's immunity in the doubled episode 2 scores 8. Exact replay.
- **Generator** (`proof-family-35`): 25% of lineups and moment-scored pick games get double or half points. Never beside a race or cut (points decide who's out), nor hits counted once each (the twin without it would take the path BACKLOG 49 miscounts). The chooser chooses (a focus while they haven't), 15% of the time someone else tries. An episode with a twist gives one of someone's starters or picks a moment, so the twist changes points. Probe over 60 cases: 14 choices accepted and 10 refused; 4 filed as chosen, 25 as the fallback; 3 squares a twist changed.
- **Invariant** (`twist-paired`, `twist-chooser`, in the case runner): a twin without the twist replays every other action the same way. Each seat's square, as each viewer sees it, is the twin's times the twist stamped on that episode, and a twist filed as chosen was chosen by episode n−1's unique top scorer, recounted from the grid. Positive control: a runner copy ignoring the stamp failed one of the first probe's nine twist cases, the one with a non-zero twisted square (only such a square can catch it). The first run, `twist-200` (seed 43, depth 40), failed three cases. Two were the twin's: it skipped the twist choices, which shifted ids derived from the trace's length, so a side bet's guess no longer matched; now the choices are replayed and refused there. One was BACKLOG 52, confirmed on the real routes: in an own-pace game a twist is filed while some seats haven't played the episode that decides who chooses. That is reported as `known:twist-own-pace`. Rerun as `twist-200b`: 200 of 200 pass (one case reporting BACKLOG 52, two BACKLOG 48, two BACKLOG 49). Coverage over its first 100 cases (`cover.cjs`): 23 twist games, 18 choices accepted and 45 refused, 4 filed as chosen (2 double, 2 half) and 77 as the fallback, 4 non-zero squares a twist changed. Choices stay rare: a choice is open only between an episode's final results and 12 hours before the next airs, which the walks' clock steps cross quickly.
- **Real routes:** api-checks' `twist-disagree`: the twist route's GET (the episode being chosen, whether you choose it, your choice; each filed twist, by whom, how) against the runtime's. Campaign `twist-api` (seed 44, depth 24, one worker): 30 of 30 pass (6 cases with a twist). Its first start was stopped when the engine run found the check's twin fault, and rerun.
- **UI driver** (`--only="top scorer's twist"`): the chooser (Ann, who topped episode 1) sees "Your twist · Pick a twist · You topped Ep 1", picks double points and saves. The runtime replays it with no mismatch. Episode 2 is aired (the twist filed), and the page is recorded as Ann and as Bo; the route checks pass. Screenshots `05zj` to `05zm`, words in `top-scorer-twist-page.json`.
- **Found:** BACKLOG 52 (above).
- **Findings** (Designs needed item 23, small): the choice works well. Once filed, every seat sees the chip "×2 EP 2", but nothing says who chose it or that it was chosen rather than the fallback, and episode 2's week doesn't mark its points as doubled. The twist route's comment ("No screen yet") is out of date.

### Capability: a captain (breadth program C, twenty-fifth capability, 2026-11-13)

A captain (`score.captain: { times }`, 24 specimens, every one a lineup scored by moments, times 2 or 3): one of your starters, named with the lineup (the lineup route's `captainId`), whose points multiply. Stored per episode like the lineup (`episode.captains`), it carries forward as a lineup does, and counts only while a starter: benching them takes the armband off (`ActiveRosterLogic.captainFor`, `validateCaptain`). The definition of done:

- **Runtime** (`core-runtime-19`): the lineup action takes `captainId` (a starter's id, or null for none), checked in the route's order (the lineup's problem, then the captain's: "Your captain is one of your starters") and written with the lineup; left out, the captain stays as it is. The profile connects `score.captain`. 1,063 of 1,312 specimens run.
- **Live bench:** an app lineup PUT carries `captainId` through, and the live comparison checks the captain the server kept. Captains travel in the league's state, so the materializer needs nothing new; the grid comparison now covers captain games.
- **Unit test:** "a captain". Ann's captain wins immunity (4, doubled: 8); a captain off the lineup is refused; Bo names none (4). The captain carries into episode 2 until Ann benches them. Exact replay.
- **Generator** (`proof-family-36`): 30% of lineups not counting hits once each get a captain, times 2 or 3. The walk names one of its lineup's starters most of the time, sometimes none, and (as an invalid step) someone on the bench. Probe over 60 cases: 33 lineups naming a captain accepted, 48 refused (mostly past the lock); 24 squares with a captain, 6 where it changed the points.
- **Invariant** (`captain-paired`, in the case runner): a twin without the captain replays the lineups without `captainId` (one refused here, for its captain or not, is refused there too, so derived ids stay aligned), and every action is taken the same way. Each seat's square is the twin's plus (times − 1) times their captain's line in the twin that episode. Positive control: a runner copy leaving out the captain's share fails 4 of the probe's 11 captain cases. Campaign `cap-200` (seed 45, depth 40): 200 of 200 pass (one case each reporting BACKLOG 48 and 52, two BACKLOG 49). Coverage over its first 100 cases (`cover.cjs`): 14 captain games; 55 lineups naming a captain accepted and 58 refused (mostly past the lock); 33 squares with a captain, 14 where it changed the points.
- **Real routes:** the standings and the season grid. Campaign `cap-api` (seed 46, depth 24, one worker): 30 of 30 pass, but only one case had a captain, so the server was also compared directly: a materialized run (Ann's doubled captain, 8 against Bo's 4) agrees on every check, and with the captains left out of the state the standings and the grid disagree.
- **UI driver** (`--only="a captain"`): a two-person Weekly Lineup with a doubled captain; the game page and the real lineup sheet are recorded; a lineup changed and saved there reaches the runtime with no mismatch; the route checks pass. Screenshots `05zn-captain` and `05zo-captain-lineup`, words in `captain-page.json`.
- **Findings** (Designs needed item 24): nobody can name a captain in the new app. The page says "Captain scores double", but the lineup sheet has no captain control and nothing sends one, so the multiplier never applies. How it plays doesn't mention it, and a captain's doubled line shows as plain points.

### Capability: secret roles (breadth program C, twenty-sixth capability, 2026-11-13)

Secret roles (`score.roles: { count, name, points, on, deal, reveal, mates }`, 28 specimens, every one a draft). Once the game starts, `count` seats are dealt the role (a Traitor) at random. Each scores `points` whenever a castaway held by a seat without the role goes home (`on: 'out'`, any way out but winning) or is voted out (`'votedOut'`). The deal lives in the server's own table (`secret_role_deals`), never in the state. Each seat learns only its own role; at the reveal (the game's end, or a named episode) the server stamps the deal on the state, and from then on the table counts the role's points (src/lib/server/secret-roles.ts `stampSecretRoles`; `SecretRoleLogic`). The definition of done:

- **Runtime** (`core-runtime-20`): a roles store per game (the deal, or none until due), kept only for a game with roles. `stampSecretRoles` is ported and run before the twist's at open and after every action. The deal is seeded from the game's own id (`zt-<game>`: the server's seed is random, and the materialized deal carries this one), the state marked dealt, and the deal stamped once revealed. A projection `roles` mirrors the roles route's GET (dealt, your own role and its points, the reveal). The profile connects `score.roles`. 1,091 of 1,312 specimens run.
- **Materializer:** `secret_role_deals` from the store, replacing any deal the server made itself on a read.
- **Verified against the server:** mid-season, every check agrees, Ann's private 4 kept off the table. At the reveal they agree on her total with the role's 8 in it. With the deal written to name Bo instead, the standings, order and roles views disagree.
- **Unit test:** "secret roles". Not dealt before the start; dealt from `zt-g` once it starts; only the holder told; their own points growing privately; revealed at the game's end. The same definition deals the same way. Exact replay.
- **Generator** (`proof-family-37`): half of the lineups ranked by a plain total, with three or more people, and Outlast games, get roles (one or two holders, 1 or 2 points, on any exit or only votes). Never beside a race, a cut, head to head (the engine refuses them) or teams.
- **Invariant** (`roles-paired`): a twin without roles plays the same walk. For every viewer, before they've seen the reveal, every seat's total is the twin's (nothing leaks onto the table). From it, a holder has the twin's plus the role's points for each castaway gone home whom some seat without the role held then, recounted from the world; everyone else the twin's. Positive control: a runner copy leaving out the role's points fails 7 of the probe's 9 roles cases. Probe over 60 cases: 9 roles games, 8 dealt, 7 revealed, 58 role points on revealed tables. Its first run failed four cases on Outlast in reverse's check, not the product's: that twin compares totals, and role points sit beside them, so games with roles are now left to `roles-paired`. Campaign `roles-200` (seed 47, depth 40), rerun: 200 of 200 pass (known: four BACKLOG 49, one each 48 and 52). Coverage over its first 100 cases (`cover.cjs`): 13 roles games, 12 dealt, 8 revealed to the furthest viewer, 53 role points on revealed tables and 10 still private.
- **Real routes:** api-checks' `roles-disagree`: the roles route's GET (dealt, your role and its points, the reveal) against the runtime's. Campaign `roles-api` (seed 48, depth 24, one worker): 30 of 30 pass (7 cases with roles).
- **UI driver** (`--only="secret roles"`): two episodes played; the holder's and another seat's real pages are recorded, asserting the other's page never names the Traitor; the route checks pass. Screenshots `05zp-roles-holder` and `05zq-roles-other`, words in `secret-roles-page.json`.
- **Findings:** none new. The holder sees "Secret · You're a Traitor · Only you can see it · 0 points so far"; the others see only "A secret Traitor". The roles route's comment ("No screen yet") is out of date.

### Capability: a draft spread across tribes (breadth program C, twenty-seventh capability, 2026-11-13)

A draft spread across the cast's groups (`get.across: { of: 'group', then: 'keep' }`, 28 specimens; shared blind drafts and exclusive snakes). Each team is spread across the tribes as they stand at the draft, no tribe past ceil(each ÷ tribes), and each at least floor(each ÷ tribes) while it has someone to give. The spread never blocks a draft, and a castaway stays yours wherever they go after it (`SpreadLogic`). The runtime starts after the draft, so the draft-time rule itself is the draft room's. After the draft only pickups read the spread, which need waivers, not connected. What this capability connects is everything after a spread draft, on a world with tribes. The definition of done:

- **World** (`core-runtime-21`): a context may declare `tribes` (2 to 4). Each participant is put on one in blocks, as a cast lists each tribe together, so a draft taken in the cast's order isn't spread by itself. The state carries `tribes` and each castaway's `tribeId`. Only a world that asks has them, so every other world's facts and hashes are unchanged.
- **The generated draft:** with `get.across` on a world with tribes, each team is drafted as the rule allows (`SpreadLogic.allowed`), in snake rounds (one pick a seat, reversed each round), so exclusive teams share the tribes as a real draft would. The profile connects `get.across` of `group`, needing tribes. `profile-blockers.js`'s probe world now has two tribes. 1,119 of 1,312 specimens run.
- **Unit test:** "a draft spread across tribes". Three tribes in blocks of four; shared and exclusive teams of four each come out 2, 1, 1, and nobody shares in the exclusive one. Exact replay. An exclusive draft of the whole cast lets the last teams take what's left (the rule allows it), so that case drafts from 18.
- **Generator** (`proof-family-38`): 30% of lineup drafts and Outlast drafts spread across tribes, the world then given two or three.
- **Invariant** (`spread-draft`, at the case's open): each team as drafted, recounted from the castaways' tribes (not `SpreadLogic`), has no tribe past its share and each at least its least, as far as the tribe had people to give it (in an exclusive draft, those nobody else took).
  - Positive control: with the spread switched off (a plain draft in the cast's order), the check fails all 19 spread cases of the probe.
  - Two earlier versions taught the setup. With tribes assigned in turn, a plain draft was spread by itself, so the control caught 1 of 19; drafting exclusive teams one at a time emptied the first tribe.

  Campaign `across-200` (seed 49, depth 40): 200 of 200 pass (54 cases with a spread draft, 6 of them exclusive; one each reporting BACKLOG 48 and 49).
- **Real routes:** the tribes travel in the state (the server never overwrites them); the standings and the rest. Campaign `across-api` (seed 50, depth 24, one worker): 30 of 30 pass (11 cases with a spread draft).
- **UI driver** (`--only="spread across tribes"`): the real page recorded; the route checks pass. Screenshot `05zr-spread-draft`, words in `spread-draft-page.json`.
- **Findings** (Designs needed item 25, small): the summary says "1 from each tribe" for a team of four across three tribes (How it plays has it right), and the team never shows anyone's tribe.

### Capability: a survival pool's mulligans and buyback (breadth program C, twenty-eighth capability, 2026-11-13)

A pool's riders: `score.mulligans` (your first n wrong or missed picks forgiven: no life lost, the streak carries on; 6 specimens, streak pools) and `score.buyback` (`{ times, before, cost }`: the night your lives run out, before its deadline and with one left, you're back in from the next episode with one life and `cost` points off; 8 specimens). Both are automatic, the pool's walk on every read (`PickEmLogic.stepper`, `Seq.poolNight`/`poolEmptied`), so they need no action, store or materializer change. The definition of done:

- **Profile:** `buyback` and `mulligans` join the connected score keys. 1,133 of 1,312 specimens run.
- **Unit test:** "a survival pool's mulligans and buyback". One life, a mulligan and a 3-point buyback; Ann wrong every night: night 1 forgiven (no mulligans left), night 2 her life lost and bought back (−3 on the table and the grid), night 3 out with no buy-back line. The plain twin is out on night 1. Exact replay.
- **Found and fixed (BACKLOG 53):** the page's pool (`game-twists.ts`) counted mulligans left backwards (the engine's tally counts the ones left) and offered "You can buy back in" to anyone out with none left. Both are fixed in the working tree.
- **Generator** (`proof-family-39`): 30% of pick games are survival pools as before; of those, a quarter are streak pools with mulligans alone (as the specimens have them), and the rest get mulligans (35%) and a buyback (40%: once or twice, any time or until episode 2 to 4, free or 3 points).
- **Invariant** (`pool-riders`): the viewer's own season recounted from their decided picks, right or wrong, in order (a mulligan forgives; a life lost; the night they run out, a buyback left and in time brings them back for its cost, else out and nothing after counts). It must match the page's pool (lives, mulligans left, out, never a buy-back line once out) and the table's points.
  - Positive controls: the old mulligans line fails 8 of 8 mulligan cases; the old buy-back line fails 2 of 5 buyback cases (the ones with someone out).
- **Coverage** (`cover.cjs`): in 200 cases, 24 pools with riders (11 streak pools); 151 wrong picks, 74 forgiven, 11 buybacks (4 that cost points) and 17 seats out.
- **The multipliers twin, fixed:** a lineup with side bets graded on a multiplied finale failed `times-paired`. A side bet's points sit beside the draft's, never multiplied (the schema: "a draft's points multiply"), so the twin now takes each week's side-bet points (the table's `predictions`) out before applying the factor.

  Campaign `pool-200b` (seed 51, depth 40): 200 of 200 pass (one each reporting BACKLOG 49 and 52). (`pool-200`, the same seed before the twin's fix, had the one `times-paired` failure.)
- **Real routes:** picks travel as before; the pool's riders are the spec's. A new check, `pool-disagree`, compares the viewer's pool, every seat's points and the season grid. A direct comparison (`$TEMP`, three nights of the unit test's walk) agrees on each night; its control (Ann's first pick written as Bo's, a right one) gives `pool-disagree` and `standings-disagree`. Campaign `pool-api` (seed 52, depth 24, one worker): 30 of 30 pass (4 cases with a pool's riders).
- **UI driver** (`--only="survival pool's"`): a world with two pools whose first night's picks went home, one bought back and one forgiven; both real pages recorded, the route checks pass, and the used mulligan never shows as left. Screenshots `05zs-pool-buyback` and `05zt-pool-mulligan`, words in `pool-riders-page.json`.
- **Findings** (Designs needed item 26): the page names the rules (a "Buy back in" badge) but never what happened. Nothing says Ann bought back in or what it cost; the grid shows that night and a forgiven one as a plain ✗; her points (−2) are on no screen; and this layout never says how many mulligans are left.

### Capability: a pool's second pick (breadth program C, twenty-ninth capability, 2026-11-13)

A survival pool's second pick (`get.second: { fallback }`, 5 specimens, streak pools): a second castaway beside the first, never the same one, that counts on a night two or more go home; on a night only one goes, `void` voids it and `counts` counts it anyway. A night's right picks count first, then its wrong ones, so a wrong pick ends the streak whichever it was. The engine plays it on every read (`PickEmLogic.stepper`, `secondCounted`); what was missing was making one. The definition of done:

- **Runtime** (`core-runtime-22`): the pick action takes `second: true` with one castaway, as the picks route does (`PUT .../picks` with `second: true`), beside a first already made and refused once closed. The profile connects `get.second`. 1,138 of 1,312 specimens run.
- **Unit test:** "a pool's second pick". Both fallbacks: night 1 only Ann's second goes home (void: nothing; counts: her streak resets); night 2 two go home, Ann's first among them (her right second counts first, then the wrong first resets her), Bo's two right (+2). A second pick of two castaways is refused. Exact replay.
- **Generator** (`proof-family-40`): pools are 40% of pick games; half are streak pools, 70% of those with a second pick (void or counts), the rest with mulligans. A focus step (35%) makes someone's first pick, then their second; ordinary pick steps sometimes add a second (invalid: the first's own castaway). In a case with a second pick, half the nights send two home.
- **Invariant** (`pool-riders`, widened): the recount now goes a night at a time, a counted second judged from the world's facts (two or more went home, a winner's exit not one; right when that castaway didn't go home, or won the finale), right picks first. It checks the points, the best and current streak (the table's total and week on a streak or standing pool) and the pool's lives, mulligans and out.
  - Positive control: with `secondCounted` always true (a temporary edit of the engine file; an in-process patch can't reach the projection, whose TypeScript loads its own engine copy), 9 of the 18 second-pick cases fail.
- **Coverage** (`cover.cjs`): in 200 cases, 21 pools with a second pick; 77 second picks made, 32 counted right, 15 counted wrong and 29 void (and, across all 44 pools with riders, 77 wrong picks forgiven, 25 buybacks and 16 seats out).

  Campaign `second-200` (seed 55, depth 40): 200 of 200 pass (BACKLOG 49 in four, BACKLOG 52 in two).
- **Real routes:** the second pick travels in the league's state; the bench translates the route's `second: true`. `pool-disagree` now covers second-pick pools and each seat's current streak. A direct comparison (`$TEMP`, the unit test's walk, both fallbacks) agrees; its control (Ann's night-2 second left out) gives `pool-disagree` and `standings-disagree`. Campaign `second-api` (seed 56, depth 24, one worker): 30 of 30 pass (2 cases with a second pick; the usual BACKLOG 45 reports).
- **UI driver** (`--only="second pick"`): the real page and pick sheet recorded; a pick saved on the sheet reaches the runtime with no mismatch; the route checks pass. Screenshots `05zu-second-pick` and `05zv-second-pick-sheet`, words in `second-pick-page.json`.
- **Findings** (Designs needed item 27): nobody can make a second pick in the new app. The page says "A second pick" and How it plays explains it, but the pick sheet ("Who survives Episode 2?") takes one castaway, and nothing in the new app sends `second: true`.

### Capability: group slots (breadth program C, thirtieth capability, 2026-11-13)

Group slots (`get.groups: { slots, own, swap, fallback, points }`, 17 specimens, all the defaults): a draft's +1 or +2 slot that holds a pair or a team the show forms. A slot opens after the episode that showed its groups and scores from the next, riding with its group while it lasts (its members' moments, their mean or sum) and dropping when it changes (`GroupSlotLogic`). The groups are the season's format state over time, built from each episode's stored research (`format-timeline.js`), which the server settles into the game on every write (`group-slots.ts`). The definition of done:

- **World** (`core-runtime-23`): a context may declare `pairs: { every: 1 to 4 }`. Everyone still in is paired at the premiere and re-paired at the end of every `every`th episode (a swap going into the next), each time in a seeded order of its own. Between, a pair keeps its people; one down to one is on their own (`runtime-data.cjs pairsOf`). The stored answer (`researchOf`, now taking the episode's number) carries the format section (`formatState`: who is with whom at the episode's end, the re-pairing as a change) and who left. The night the show stops being divided (fewer than two pairs left: one pair among people on their own reads as no longer divided, as a merge does; a finale, everyone gone), the answer says so (a split into individuals), as research would. The recount likewise holds a pair only while there are two or more (found by `auction-200`'s case 27).
- **Runtime:** `settleWrite` settles the slots as the server does: the timeline from the stored answers of every released episode, `slotRecords`, names matched the forgiving way, `GroupSlotLogic.settle`. A new `groupSlot` action is the route's `PUT .../group-slots/{player} { slot, groupId }`, for the viewer's next episode, locked by the scenario clock (the engine's lock reads the real one), as they see the league. The profile connects `get.groups` on a world with pairs. 1,155 of 1,312 specimens run.
- **Unit test:** "group slots". A mean game and a sum game on one world with the same lineups and the same pair picked: nothing on offer before the premiere, the game's records are the world's pairs, a group not on offer is refused, the sum game's square exceeds the mean game's when the pair scores, the slot drops at the re-pairing that splits the pair, and a dropped slot scores nothing. Exact replay.
- **Generator** (`proof-family-41`): 30% of lineup drafts get slots (one or two, shared or exclusive, a swap or not, void or carry-on, mean or sum), the world then pairing every one to three episodes. Slotted games count every hit (the engine refuses `hits: pick` or `objective` beside slots). A focus step (50%) fills an empty or dropped slot (any, with a swap), sometimes emptying one or naming a group not on offer. Results often give a slotted pair's people a moment, so slots score.
- **Invariant** (`groups-paired`, an end-of-case twin): the same definition without slots, walked with the same actions (its group-slot actions refused). Each seat's square is the twin's plus each slot's points, recounted from the world's own pairs (`pairsOf`, not the timeline): the latest pick holds in episode n only while its exact pair was one at every end from the one before the pick through n − 1; held, it scores its two people's moments at the game's points (`scoredEvents`, the scoring primitive), their mean or sum, times the episode's multiplier. And each person's slots going into their next episode are empty, waiting (or held, once that episode has results in their copy) or dropped, as recounted.
  - Positive controls (temporary edits of the engine files, restored byte-identical): a mean divided by one more fails 8 of the 45 slotted cases; a slot that never drops fails 13 of 45 (on its status: a never-dropped slot comes out void, 0 points either way, so the points alone couldn't tell).
  - The first campaign (`groups-200`) failed one own-pace case on a finale: the world's report emptied every pair without saying so, and the timeline, finding a split the answer doesn't state, marked the night unsure and voided the slots. That's the product's behaviour on such data (BACKLOG 54, a question); the world now states the split.
- **Coverage** (`cover.cjs`, slotted cases only): 45 slotted games, 64 picks, 44 held lines (22 scoring), 21 dropped, 1 void.

  Campaign `groups-200b` (seed 58, depth 40): 200 of 200 pass, and the status check, added after, passes on all 45 slotted cases.
- **Real routes:** the materializer stores each released episode's answer with its format section (the same `researchOf`). The bench translates the route's PUT. New checks: `slots-disagree` (the viewer's slots and what's on offer) and the season grid for slotted games. A direct comparison (`$TEMP`) agrees as written. Written without the game's groups, a real `PUT` of Bo's slot makes the server settle them again from the stored answers, and everything agrees (Bo's slot too). Written without them and no write, the control gives `slots-disagree`, `grid-disagree` and `standings-disagree`. Campaign `groups-api` (seed 59, depth 24, one worker): 30 of 30 pass (3 cases with slots; the usual BACKLOG 45 reports).
- **UI driver** (`--only="group slots"`): the real page and lineup sheet recorded; the route checks pass. Screenshots `05zw-group-slots` and `05zx-group-slots-lineup`, words in `group-slots-page.json`.
- **Findings** (Designs needed item 28): nobody can fill a slot in the new app. The page says "Plus a tribe slot" with a "Group slots" chip, but the lineup sheet has only the draft's starters, and nothing sends the route's PUT (its own comment: "No screen yet"). (On this Survivor world the page says "tribe", the format's word for its groups; a show that forms pairs has its own.)

### Capability: a pool that skips a night you've used everyone (breadth program C, thirty-first capability, 2026-11-13)

A survival pool whose pick never repeats (`get.repeat: 'never'`) has a fallback for a night you've already picked everyone still in (`get.fallback`): `miss` (the default: a missed pick, the streak breaks and, with lives, it costs one) or `skip` (11 specimens: nothing counts that night, no life lost, the streak holds). The engine plays it on every read (`PickEmLogic.stepper`, `spent`), so it needs no action. The definition of done:

- **Profile:** `get.fallback: 'skip'` connects on a pick game that never repeats. 1,166 of 1,312 specimens run.
- **Unit test:** "a pool that never repeats". Two pools on one five-person world with the same picks, one skipping and one not: Ann picks c1, c2, c3 on nights 1 to 3 (each stays) while c5, c4 and c1 go home, so going into night 4 she has nobody left to pick. Skip: night 4 skipped, both lives, the streak of 3 holds. Miss: a life lost, the streak reset. Exact replay.
- **Generator** (`proof-family-42`): 40% of survival pools skip. A case with one has a cast of six to eight (unless a draft is exclusive). The pick focus step now covers skip pools too, so people pick most nights. Results usually send home someone the first seat hasn't picked, so they run out.
- **Invariant** (`pool-riders`, widened to every pool that never repeats): each night with no pick of theirs is skipped exactly when they had used everyone still in at its start (their earlier first picks against the world's exits; a game with a second pick not checked here), else it's a miss. The rest of the recount (points, streaks, lives) now runs on every such pool too.
  - Positive controls (temporary edits of the engine file, restored byte-identical): never skipping fails the one case of 23 where a skip lands on a seat checked from its own view; always skipping fails 14 of 23.
- **Coverage** (`cover.cjs`, skip cases only): 23 skip pools, 3 skipped nights and 62 missed nights checked.
- **Twins fixed along the way:** the captain twin leaves out a game with the top scorer's twist (a captain changes who scores most, so who chooses the twist; one case's twist was refused with a captain and accepted without). And the pairs world states the split whenever no pairs are left, even on a re-pairing night (a finale that was both).

  Campaign `skip-200` (seed 63, depth 40): 200 of 200 pass (BACKLOG 49 in two, BACKLOG 52 in one).
- **Real routes:** picks travel as before; the skip is the spec's. `pool-disagree` now covers skip pools and each seat's picks as the table lists them (a skipped night is `correct: null`, a miss `false`). A direct comparison (`$TEMP`, the unit test's walk) agrees; its control (Ann's night-3 pick left out of what's written, so night 4 isn't spent on the server) gives `standings-disagree` and `pool-disagree`. Campaign `skip-api` (seed 64, depth 24, one worker): 30 of 30 pass (1 case with a skip pool; the usual BACKLOG 45 reports).
- **UI driver** (`--only="never repeats"`): a five-person world whose history (seed 8) has Ann right three nights, then skipped; the real page recorded; the route checks pass. Screenshot `05zy-skip-pool`, words in `skip-pool-page.json`.
- **Findings** (Designs needed item 29; the wrong words are BACKLOG 55): Ann's sheet calls the skipped night "No pick · missed" and "Waiting", though nothing counted against her (her streak of 3 held, both lives). The rules shown say "a wrong pick, or no pick, costs one" with nothing about the skip (the rest are behind "All 6 rules"). And the page still asks her to pick for episode 5, with nobody left she hasn't used.

### Capability: an auction (breadth program C, thirty-second capability, 2026-11-13)

An auction (`get.order: 'auction'`, exclusive, with its budget `get.budget: { total, floor, fallback }`; 11 specimens blocked by the order and 11 more by the budget, all Outlast games): everyone bids in private on whom they want, and once all are in (or the first episode starts) the bids settle at once. Every bid from the highest down is won at what was bid, while the team has room and can still pay the lowest price for each place left; ties go in a seeded order; then a team its bids didn't fill is filled from what's left at the lowest price (`fill`) or stays short (`short`) (`AuctionLogic`). After that, play reads only the teams. The runtime starts after the draft, so this is a setup adapter. The definition of done:

- **Runtime** (`core-runtime-24`): `runtime-data.cjs settleAuctionIn` generates each seat's sealed bids (`auctionBids`, seeded from the document and the game: none (fill me) up to three for each place, each a whole number from the lowest price to the most one bid can be) and settles them with the engine's own `AuctionLogic.settle`, seeded `zt-<game>`, its moments (the settle's, the draft's start and turn, which the engine stamps with the real clock) set to the scenario's clock so a replay settles the same. The profile connects `order: 'auction'` and its budget (total, floor, fallback); a salary cap or a stock market (prices from the data, trading) stays a gap. 1,177 of 1,312 specimens run.
- **Unit test:** "an auction", both fallbacks. Nobody on two teams, every team within the budget, each win at its seat's bid (or filled at 1), settled at the scenario clock. Ann (seed 5) wins one castaway at 95 and can't pay her other bids after it (each must leave 1 for her last place): short, she has one; filled, two more at 1 each (97). Exact replay.
- **Generator** (`proof-family-43`): 35% of Outlast games are auctions (exclusive; a budget of 100 or 50, the lowest price 1 or 2, fill or short), with everyone's places within the smallest cast (the engine refuses an auction whose places outnumber who can be drafted).
- **Invariant** (`auction-settled`, at the case's open): the auction replayed from the same sealed bids, not `AuctionLogic`: highest first, won at the bid while the team has room and can pay the lowest price for each place left, then filled from what's left or left short. Each seat's team and what it spent must be that. With two bids of one amount, the engine's seeded tie order decides, so only each win's price, the totals, the sizes and nobody sharing are checked.
  - Positive controls (temporary edits of the engine file, restored byte-identical): settling the lowest bid first fails 8 of the 17 auction cases; filling at one more than the lowest price fails 9 of 17.
- **Coverage** (`cover.cjs`): 17 auction games (8 short), 149 bids, 55 won, 30 places filled, 18 teams left short; 10 replayed exactly, 7 with a tie.
- **Twins and checks fixed along the way** (`auction-200`'s three failures, none an auction's): the group-slots twin leaves out a game with the top scorer's twist (slot points change who chooses it); the twist's chooser recount adds each episode's bounty lines to the grid's squares (a bounty's points sit on no square, Designs needed item 12, but the engine's standings count them); and the pairs world and the slot recount read fewer than two pairs as no longer divided (above).

  Campaign `auction-200b` (seed 66, depth 40): 200 of 200 pass (BACKLOG 49 in five, BACKLOG 52 in one).
- **Real routes:** the materialized state carries the settled auction, so the server never settles it again. A new check, `auction-teams-disagree`, compares each seat's team. A direct comparison (`$TEMP`) agrees as written. Written unsettled (no teams, no auction, the draft started), with each seat then locking in its generated sheet through the real route (`POST .../draft/bids` as that person), the server settles the last sheet in: with `short` it settles exactly the runtime's teams. With `fill`, only the filled places differ (the hat is the auction's seed, which the server draws at random), every bid-won place the same. The control (written unsettled, nobody bids) gives `auction-teams-disagree` and `standings-disagree`. Campaign `auction-api` (seed 67, depth 24, one worker): 30 of 30 pass (3 cases with an auction; the usual BACKLOG 45 reports). Its first run failed one auction case because a positive control's engine edit was in place while it ran (see the lessons); the rerun is clean.
- **UI driver** (`--only="an auction"`): Ann's real page recorded (she won one at 5 and was filled with two at 1); the route checks pass. Screenshot `05zz-auction`, words in `auction-page.json`.
- **Findings** (Designs needed item 30): the page names the auction ("Bid for 3", "Auction"; How it plays explains the bidding), but nothing says what anyone paid, what's left of the budget, or that two of Ann's castaways were filled at the lowest price. The draft room (placing bids) is outside the explorer, as every draft is.

### Capability: mid-season waivers (breadth program C, thirty-third capability, 2026-11-13)

Mid-season waivers (`extras.waivers`, 11 specimens, and the 9 `score.multiply` specimens whose replacements come through them: "replacements score half"): after an episode with results a waiver week opens; people claim, in private, ranked pairs (add a free agent, drop a loss or, in a window with swaps, someone still in); at its time the week processes every claim in the waiver order (computer players' too), then free agency runs first come, first served until the next episode airs, when the week closes and fills any loss nobody claimed (auto-fill). The claims never enter the league's state (waiver_claims), and the server runs the waiver clock lazily on every read and write (`src/lib/server/waivers.js syncWaivers`). The definition of done:

- **Runtime** (`core-runtime-25`, `runtime-waivers.cjs`): `waivers.js` ported (its routes are async; the runtime's actions aren't): each game's claims in a private store by week (`stores.waivers`, the table's place), the waiver clock synced on every action and at open through the same `WaiverLogic` (open, cancel, process with computer players' claims, close), and a game at its own pace with exclusive teams run on the league as it stood at everyone's episode, folded back (`syncPaced`). The engine's ids are random (`Core.uid`: a week's, a processed claim's transaction), so while the waiver code runs it gets seeded ones (`seeded`: the game, the league log's length and a counter): replays write the same ids. New actions, as their routes take them: `claim` (`PUT .../waivers/claims`: `{ pairs }` the whole claim, or `{ spot: { dropId, addIds } }` one spot of it, merged with `WaiverLogic.setSpot`, which is what the app sends), refused until the week's episode is revealed (`waiver-actor.ts`); and `freeAgency` (`POST .../waivers/free-agency`). The profile connects `extras.waivers` and `score.multiply`. 1,187 of 1,312 specimens run. The commissioner's Open a window, Process now and Undo weren't actions yet (a manual window never opened by itself): they are the thirty-fourth capability, below. Its free-agency move also missed the route's wait for the week's reveal, fixed there.
- **Unit test:** "mid-season waivers", paired with and without the replacement multiplier: the results open a week; a claim before the reveal is refused ("Reveal episode 1 first"), after it saved (who has claims in is public; no claim is in the state); the week processes at its time and Ann wins her claim; Bo loses one, never claims, gets nothing at processing and is filled when the week closes; Ann's total with the multiplier is lower by half of what the replacement earned. Exact replay.
- **Generator** (`proof-family-44`): about a third of Outlast games and lineup drafts use waivers (the specimens' shape varied: every loss replaced, or only when short on a lineup; manual windows or every episode with a swap or none; auto-fill or not; replacements per holder shared or not). A waived Outlast game drafts exclusive in a snake (the engine refuses waivers on Outlast with shared teams), and half of them score a replacement at half (not in reverse, which the engine refuses). The walk claims for people owed a replacement (or allowed a swap), mostly people who have revealed the week's episode, sometimes naming someone on a team (invalid), and moves in free agency once a week has processed.
- **Invariant** (`waivers-honored`): no castaway on two teams in an exclusive game; no claim's contents in the league's state; and on the step a week processes, every claim it says was won is one of that seat's stored pairs, the seat holds who it added and not who it dropped, and a replacement drops someone who went home.
  - Positive control (a temporary edit of the engine file, restored byte-identical; no campaign running): a won claim applied to another free agent fails 4 of the 61 waiver cases (every case where a claim was won as its week processed).
- **Coverage** (`cover.cjs`, waiver cases only): 66 games with waivers (5 scoring replacements at half) in 61 cases; 118 weeks closed; 19 claims accepted (51 refused, mostly before the reveal); 9 won at processing; 31 auto-fills; 22 free-agency moves (69 refused: no swaps that week, or the window's used); 49 replacements in all.

  Campaign `waivers-200` (seed 69, depth 40): 200 of 200 pass. (The claim's spot form was added to the runtime while it ran; the campaign's own claims are whole pairs, which behave the same.)
- **Real routes:** the materializer stores the runtime's claims in `waiver_claims` (in its order) and shifts every moment of the waiver weeks as it shifts the schedule (a week's times are worked out from when it opened and the next air time; unshifted, the server would never process one). The bench translates both routes. New checks: `waiver-claim-disagree` (each person's own claim as `GET .../waivers` reads it back, held back until they've revealed the week's episode) and `waiver-teams-disagree`. A direct comparison (`$TEMP`) agrees with the week open and Ann's claim in it (live and at own pace); with the commissioner's Process now on the real route, the server processes from `waiver_claims` exactly as the runtime processes at its time; the control (her claim left out of `waiver_claims`) gives `waiver-teams-disagree` and `waiver-claim-disagree`. Campaign `waivers-api` (seed 70, depth 24, one worker): 30 of 30 pass (8 cases with waivers).
- **UI driver** (`--only="mid-season waivers"`): Ann (seed 1), owed a replacement after the week processed, opens the real waivers screen (`/show/<season>/waivers`), Free agency, adds a free agent and drops her loss; the move reaches the runtime (`freeAgency`, accepted) with no mismatch; the route checks pass. Screenshots `05zz2-waivers`, `05zz3-waivers-free-agency`, words in `waivers-page.json`.
- **Findings** (Designs needed item 31): the screen says "No change for you · No pick in" for a week that left Ann a replacement owed, with nothing telling her she still has a loss to replace (or that it's filled automatically when the week closes); and nowhere says a replacement scores half in this game.

### Capability: the commissioner's waiver actions (breadth program C, thirty-fourth capability, 2026-11-13)

What whoever runs a game does with its waivers: Open a waiver window (or change the open week's, or turn it off), Run now, Undo, and Pick for them. No specimen was blocked by these (waivers were connected by the thirty-third), but 480 of the matrix's show specimens are drafts with no waivers of their own (`replace: 'never'`, windows by hand), where a window opened by hand is the only waivers the game ever sees; and a manual window never opened at all before this. The app's door is Backstage › Waivers (`POST /api/seasons/{S}/backstage/waivers { leagueId, action }`: `backstage-games.ts` `waiverWrite`); the classic routes (`/api/leagues/{L}/waivers/window`, `/process`, `/undo`) do the same through the same `waivers.js` and `WaiverLogic`. The definition of done:

- **Runtime** (`core-runtime-26`; ported beside `runtime-waivers.cjs`: `openWindow`, `processNow`). Four actions, each on the league itself as the server runs it, the waiver clock synced after:
  - `waiverWindow { swaps, replace? }`: opens a window on the latest episode with results (the week gets the seeded id a clock-opened week gets), makes the open week one, or changes it; `swaps: null` turns it off (a plain week again where weeks run after every episode, else over on the spot, its claims gone). Claims that no longer fit are trimmed, each trimmed claim rewritten at one moment, as the server's rows share the transaction's `now()`. Any game that could have waivers: one with none gets its claim store here.
  - `waiverRun`: every claim that's in, at once, by `'commissioner'`.
  - `waiverUndo { periodId? }`: the last run taken back while free agency is open (its free-agency moves too), the week held; with `periodId`, only that week's (Recent changes' Undo names the run's week: `league-changes.ts`).
  - `claim { forId, spot }`: one spot of someone's claim sent for them, in Backstage's order of refusals (one spot; a week that's open; the sender's own reveal of its episode; someone in this week's waivers).

  Only whoever runs the game: the commissioner its roles name, else its first seat (`runsGame`, which side bets' grading now shares; the materializer seats them the same way). Also fixed here: a free-agency move waits for the week's reveal as a claim does (`waiver-actor.ts` holds both; the runtime had held only the claim). Still not actions: changing how waivers work mid-game (Backstage's feel and Fine-tune), the classic Nudge (a push and a stamp on the week), and the classic route's own Claim for (`playerId` on a claim: its rules differ from Backstage's).
- **Unit tests:** "the commissioner's waiver actions" (a game whose replacements wait for windows opened by hand, and one with no waivers at all): no week opens by itself; who may act and each refusal's reason; a window as asked; a claim sent for Bo; Process now before its time, with the exact run; Undo by its week (everyone back, the order back, the claims as they were, the week held past its time); a window cut to no swaps trims Ann's swap and removes Bo's whole claim; a window on the game with none keeps waivers on while it runs, and turned off can't open again for that episode; exact replay. And "a free-agency move waits for the week's reveal".
- **Generator** (`proof-family-45`): the walk's steps only (no new shapes: the specimens' are a draft with no waivers, and the eleven with their own). On any game that could have waivers, whoever runs it opens a window (sometimes more swaps than a team has, or nothing to claim), changes it (often cutting one with claims in back to no swaps, or off), runs the open week once a claim is in, takes a run back (sometimes naming another week) or sends one spot for someone; one step in ten is somebody else trying. Claims are a focus while a hand-opened window is open, swaps mostly.
- **Invariant** (`waivers-by-hand`, from each step's own before and after, not `WaiverLogic`): only whoever runs the game is taken up on one; a game with no waivers of its own has only weeks opened by hand, each on a window step; a window step leaves the week as asked, and every claim still stored is what its seat had, in order, less only what the window no longer allows (nothing at all when the window didn't shrink), with who has claims in being who has one stored; a run by hand is the open week's own, at the clock; an undo puts every castaway back with whoever held them before the week ran (kept from the step it ran on), leaves no move of that week in the log and its claims as they were, and the week open and held; a held week runs again only by hand or once it closes; a claim sent for someone is that one spot, the rest kept, by someone who has revealed the week's episode; a claim or free-agency move of your own waits for that reveal too.
  - Positive controls (temporary edits of the engine file by a driver that restores it and compares its hash after each; no campaign running; the campaign folder's `control.cjs` over the cases with a step by hand: all 133 pass on the unedited engine). Over the first 80 of them: an undo that leaves the week's newest move in place fails 3; a changed window that trims nothing fails 7; a waiver clock that ignores a hold fails 25; a window changed on an open week that keeps its old swaps fails 17.
- **Coverage** (`cover.cjs`, 200 cases): 147 cases with a step by hand; 163 windows opened, 60 changed, 16 turned off (187 of the 239 accepted window steps were on games with no waivers of their own); 29 weeks run by hand (23 claims won in them, 2 missed); 57 runs taken back, 9 run again after; 45 claim pairs trimmed by a changed window; 16 claims sent for someone; 223 claims and 21 free-agency moves made in windows opened by hand. Refusals for every reason (not whoever runs it 29, too many swaps 20, nothing to claim 11, no results yet 30, the season over 16, another week named 7, the sender's reveal 8).

  Campaign `commish-200` (seed 71, depth 40): 200 of 200 pass. Known issues it counts apart: BACKLOG 56 in 19 cases, BACKLOG 57 in 11 (and BACKLOG 48 in two, 49 in one).
- **Real routes, step by step** (`node scripts/dev-test/check-waiver-commissioner.js`, reusable: a case is materialized, each step sent to the app as that person and applied in the runtime, the server never re-synced between steps): after every step both sides agree on whether it was taken and on the weeks (window, swaps, hold, who has claims in, the run and its results), every team, the move log, the stored lineups and each seat's private claim. Both doors (Backstage, with Undo through Recent changes' line; the classic routes): a live game (13 steps), a game with no waivers (15), own pace with exclusive teams (4): 76 of 76 with the control (the runtime skips one claim: the comparison disagrees from the next run on). Five more cases record the findings below.
- **Materializer:** a game's commissioner is the one its roles name (else the first seat, as before); `read` also returns `waiver_claims`. The state already carried everything else (a week's window, hold and who opened it are fields of the week).
- **API tier** (new checks): `waiver-week-disagree` (each person's week as their waivers screen reads it: the production view, `waiver-view.ts` `waiverWeek`, of the runtime's state at their mark against `GET /api/seasons/{S}/waivers`: stage, window and swaps, who they may replace, swaps left, their spots, the order, every run they may see), `waiver-admin-disagree` (Backstage › Waivers for whoever runs the game: the week and whether it was opened by hand, who has picks in, the last run and whether it can be undone) and `waiver-admin-open` (nobody else sees the game there). The team and own-claim checks now cover a game with no waivers once it has a week. A control (a hand-opened window with claims in it, materialized open, after a run and after its undo: clean each time; with the stored week's swaps changed behind the runtime, both checks disagree). Campaign `commish-api` (seed 72, depth 24, one worker): 30 of 30 pass. 23 of its cases had a draft game; 18 ended with a waiver week (13 of them with one opened by hand, 10 with a week still running, 13 with a run to show). The usual BACKLOG 45 reports, BACKLOG 56 in five cases and BACKLOG 57 in one.
- **Bench:** Backstage's window, run, undo and claimFor, Recent changes' Undo of a run this session saw made (its batch stands for the week), and the classic three routes are translated; `preview` and `claimView` (reads sent as POSTs) pass as untracked; `feel` and `set` are refused. Every waiver write (claims and free agency too, which had no comparison) is now compared: weeks, teams, the log and every seat's stored claim. The proxy passes a write's body to `allows` (the Backstage route's action decides).
- **UI driver** (`--only="commissioner's waiver window"`): on a draft with no waivers, Ann opens "Replace + 1 swap" on the real Backstage screen, picks for Bo, runs it now after the preview, takes the run back from Last run (Recent changes' line) and turns the window off; each write reaches the runtime as its action with no mismatch; the route checks pass. Screenshots `05zz4` to `05zzb`, words in `backstage-waivers-page.json`.
- **Findings:**
  1. **BACKLOG 56** (own pace with exclusive teams; confirmed on the real routes): Run now, Open a window and Undo act on the season as it stands, not on everyone's episode. Run now gives away losses and exits nobody has seen; Open a window opens and is cancelled in one write while saying it opened; Undo is run again at once. `known:waivers-own-pace-by-hand`.
  2. **BACKLOG 57** (own pace, a lineup with replacements; confirmed on the real routes): a lineup carried from an earlier week is worked out from who the seat holds now, so replacing a starter rewrites the weeks already played (Bo's total went from 10 to 8.5 with no new results; with a bounty, points moved between two seats). Not a commissioner's action: the new walk surfaced it in the thirty-third capability's ground. `known:carried-lineup-rewritten`.
  3. **BACKLOG 58** (a question): a window opened a little more than a day before the next episode runs within minutes.
  4. **BACKLOG 59** and **Designs needed item 32**: after Undo the new app still says when the week will run; a window turned off can't be reopened but the screen offers it; the run preview's fill rule is a lineup's; a "Waivers" chip on a game with none.

### Capability: stages (breadth program C, thirty-fifth capability, 2026-11-13)

A game in stages (`spec.stages`, `overall`: "pre-merge and post-merge are separate games with their own drafts, plus an overall winner"; 32 specimens). On the server each stage is a league of its own, an ordinary game tied to the game by `leagues.stage_of` and `stage_key` (`src/lib/server/stages.ts`, made by `engine-lab.ts` `makeStages`); the game holds the seats and its table is the overall, worked out on every read from its stages' tables (`answer-points.ts` `stageWalk`, `StageLogic.standings` and `overall`), each viewer's copy cut at their mark. A later stage's draft opens at its start (`extras.draft.opens: 'start'`): once the game's start is known and the episode before it has results, from who's still in then; an exclusive draft the seats no longer fit among them is played shared from then on (`settleDraftShare`, in the stage's own write).

**This slice: the 10 specimens that are two games split at the merge** (6 Weekly Lineup, 4 Outlast: `span.to` then `span.from` `{ phase: 'merged' }`, overall by points). The handoff counted 19: the other 9 are a Weekly Lineup with a "New draft" stage a format change starts (a stage's `on`), which is another server path (`change-stages.ts`: copies made when research says the format changed) and stays a gap, with the 13 that pair Weekly Bingo with trivia alongside. 1,197 of 1,312 specimens run. The definition of done:

- **Definition** (`explorer/stages.cjs`, `document.cjs`): each stage is a game of its own in the definition, after its game in stages: `<game>~<stage>`, its spec the game the stage's own league plays (`Spec.stageLeagueGame`), the game's context, seats, roles and timing, with `stageOf` and `stageKey`. Derived on every read (never written by hand: one given in the input is replaced), so every action, projection, invariant, materialized row and route check treats a stage as any game. The analyzer reports a stage once, as its parent's stage node.
- **Runtime** (`core-runtime-27`):
  - the game's projection carries its stages' walk, built as `stageWalk` builds it (`stages.cjs` `walkOf`: each stage's table after each episode it played, as anyone on its couch sees it at that mark, from the production game view called as the server calls it), so the production view works out the overall and cuts it at the viewer's mark;
  - a stage that starts or ends at a phase is placed as any such game is (the twelfth capability's `settlePhasesIn`, after results and at setup): the merge confirmed by Episode N's results, the stage before ends with N and the next starts with N + 1;
  - **a later stage's draft is made the moment it opens** (`draftAtStart`, in the settle after the results that open it, and at setup for a case that starts past it): first `settleDraftShare`, then every seat's team from who's still in, by the engine's own draft (a private draft's sheets checked as the lock route checks them, locked and revealed; a snake picked turn by turn), seeded from the definition and the game, stamped at the scenario's clock. A generated setup operation, as every draft is here (the runtime starts after a draft): **the draft room as actions is its own capability**, so a stage whose draft is open while its first episode airs is never played;
  - a later stage's game is checked with no pool, as the server writes it; a game with a waiting draft starts with nobody on a team.
- **Profile:** a game in stages made live (nothing in the product makes one a game at its own pace: own pace is turned on only by Start a game, which refuses a staged spec for now, and the engine lab, the one door for stages, never turns it on. When moves lock is the game's setting since 2026-11-13 (live: open until you've watched, the product's default; or strict), set once on a game in stages and followed by its stages: `check-stages-explorer.js --case=pace`. The explorer's live-only is the strict one; a live game's late moves aren't actions here yet), the overall by points, every stage on the game's own season starting at an episode or a phase, each stage a plain Weekly Lineup (start N or the best N) or Outlast with a snake or a private draft, side bets and waivers by hand as the specimens have them. Gaps, each named: own pace; an overall by places or stages won; a stage with `on`, `side`, `alongside` or `season`; a rider on a stage (head to head, a captain, a bounty, a hat or an auction for its draft, waivers after every loss...: each plays as it does alone, but needs its own proof); a stage that isn't a draft.
- **Unit test:** "stages" in `tests/gameplay-bench-runtime.test.js`: the derived games; what stays a gap; the second stage waits (no start, no team, no lineup, and why the draft is closed); the game takes no move; Episode 3 confirms the merge (stages end with 3 and start with 4); every seat drafted a whole team only from who's still in; three seats of four no longer fit the nine still in, so the exclusive snake is played shared; the overall is each seat's two stages added up, and by hand for Outlast (10 + 19 or 20); Bo, one behind, sees the first stage only and Cy, two behind, sees it as it stood after Episode 2; a case made past the merge (drafted at setup); a split at an episode; a team of six with five still in (BACKLOG 60: open and unmade); exact replay.
- **Generator** (`proof-family-46`): three cases in ten get a game in stages, from a random stream of its own (every other game in the case is as it was): two Weekly Lineups or two Outlasts (an exclusive snake while everyone's places fit the cast, else a private draft), the same game each side or each stage's own size, split at the merge (the world gets one when it has none, most times) or at an episode (sometimes twice: three stages), side bets and waivers by hand on most. The walk plays each stage as its own game; while a later stage waits for its draft it airs and publishes more often, and three steps in ten someone with a lineup open in a stage sets it, or someone a stage is waiting on reveals.
- **Invariants**, recounted from each stage's own table and the world's facts, never from `StageLogic`:
  - `stages-overall` (every viewer, every step): the game's table is, seat by seat, the sum of each stage's own table as that viewer sees the stage, counting a stage only once an episode it plays has results they've seen; the game is over exactly when its last stage is;
  - `stages-meet`: each stage ends the episode before the next starts, and neither is settled without the other;
  - `stage-draft`: nobody is on a team in a later stage until the episode before its start has results; its teams appear on a results step (or at setup); every seat then has a whole team drawn only from who was still in; the draft is still exclusive exactly when everyone's places fit among them; a draft open and unmade is only ever the too-few-left case.
  - Positive controls (`node scripts/dev-test/engine-controls.js`, the reusable driver: temporary edits of the engine file, restored byte for byte after each; no campaign running; the campaign folder's `control.cjs` over the staged cases among `stages-200`'s first 90, all 21 passing on the unedited engine):
    - the overall counts only each seat's first stage: 9 of 21 fail `stages-overall`;
    - a stage that ends at a phase ends an episode late: 15 fail `stages-meet`;
    - a draft that opens at its start doesn't wait for the episode before it: 5 fail `stage-draft`;
    - an exclusive draft that no longer fits stays exclusive: 1 fails `stage-draft` (the one case in 21 where that happened mid-walk);
    - the pool a draft offers includes people who've gone home: 16 fail `stage-draft` (and two more can't be built: other games' picks read the same pool);
    - **a stage's tables not filtered at the viewer's mark: 0 fail.** A second guard holds (the viewer's copy cuts the walk too: `cutWalk`). With both removed, all 21 fail `stages-overall`: the check sees a leak, and the engine has two guards against one.
- **Coverage** (`cover.cjs` over `stages-200`'s 200 cases): 57 cases with a game in stages (35 split at the merge, 4 more where the merge never comes, 18 at an episode; 51 of two stages, 6 of three; 33 Weekly Lineups, 13 Outlasts in an exclusive snake, 11 in a private draft). Of 63 later stages, 24 were drafted at setup and 32 on a step of the walk as its results came in; 2 exclusive ones were played shared; 1 was left open and unmade (BACKLOG 60); 6 never started. 75 episodes scored in a later stage; in 39 cases two stages both counted in someone's overall, and in 55 two people saw different overalls at the same moment. 36 lineups set in a stage (25 in a later one; 58 refused, mostly for a reveal owed first); on stage games, 46 side bets and guesses, 61 waiver windows opened by hand and 105 claims and free-agency moves. Nobody was left with a lineup stored for an episode its stage no longer plays.
- **Campaigns** (depth 40; a campaign's id is part of each case's seed, so each is 200 different cases):
  - `stages-200` (seed 73): 200 of 200 pass. It ran before the open-and-unmade check and the two known counters were added; the controls' baseline reran its staged cases with them.
  - `stages-200b` (seed 74): 199 of 200. The one failure was `bounty-past-mark` on a lineup at its own pace with a bounty and waivers, no stage involved, after one clock step: **BACKLOG 57 reached a way its detector didn't look** (a waiver week's fill rewrote the lineup a seat had carried into a week it hadn't reached itself, but others had seen). The detector now looks at any week someone has seen; the case passes and counts as known.
  - `stages-200c` (seed 74, on the final code): 200 of 200 pass. Known issues it counts apart: BACKLOG 61 in 46 cases, BACKLOG 60 in one, BACKLOG 56 in 22, BACKLOG 57 in 10.
- **Real routes, directly** (`node scripts/dev-test/check-stages-explorer.js`, reusable; 57 checks):
  - `overall`: two games in stages played through the episode after the merge, Ann caught up, Bo one behind, Cy two behind. Every person's `/games`: the overall and each stage's table, lineup episode, start, end and whether it's over equal the runtime's; each stage names its game. Control: with one stage untied behind the runtime, the server's overall is the first stage's alone, so the server is shown to read the stage leagues.
  - `draft`: **the second stage's draft made on the server by the people themselves.** The case is materialized as Episode 3's results come in, the draft open and nobody on a team (the runtime's state before its own draft). Before the merge the server refuses to start it, and says why. Then whoever runs the game starts it (nobody else may), each seat locks in the team the runtime generated (a sheet naming someone gone home is refused, and one a castaway short), and the last lock reveals. The server's teams, how the draft is played (shared, in private: three seats of four among nine) and its waivers equal the runtime's.
  - `snake`: an exclusive snake that still fits, picked turn by turn in the runtime's order: the teams and the draft's log equal the runtime's; a pick out of turn takes nobody.
  - `lineup`: a lineup saved in the second stage through the real lineup route is stored as the runtime stores it; the game's own league takes none.
  - `short`: six each with five still in: the server starts the draft and refuses every sheet (BACKLOG 60).
- **Materializer:** each stage's league is tied to its game's (`stage_of`, `stage_key`), its seats and memberships under the same player ids (as `stages.ts` mirrors them).
- **API tier** (new checks): `stage-of-disagree` (each stage names its game; the game names none) and `stage-span-disagree` (start, end, over); the game's overall is the standings check every game gets. `known:later-stage-past-mark` counts BACKLOG 61 apart. Campaign `stages-api` (seed 75, depth 24, one worker): 30 of 30 pass. Six of its cases have a game in stages (twelve stage leagues): five with a later stage drafted, two of those with an episode already played in it, two where an exclusive later stage was being played shared, and one where the merge never comes. BACKLOG 61 in five cases; the usual BACKLOG 45 reports, BACKLOG 56 in seven cases and BACKLOG 57 in one. (It ran before the last two small edits, the profile's extra refusals and the wider BACKLOG 57 detector, neither of which a route check reads; `check-stages-explorer.js` was run again after them.)
- **UI driver** (`--only="stages:"`): two Weekly Lineups split at the merge, Ann caught up, Bo a week behind. The game's real page (the overall, its stages in a strip), each stage's page, the Merged stage before the merge; Episode 3 aired and published on the page (the merge confirmed, the first stage "Final", the Merged stage drafted); what Bo is shown before he reveals; Ann starts two of her three on the real lineup sheet and saves: the write reaches the runtime as a lineup for Episode 4 (which only the Merged stage takes) with no mismatch; the route checks pass. Screenshots `05zzc` to `05zzi`, words in `stages-page.json`.
- **Findings:**
  1. **BACKLOG 60** (confirmed on the real routes): a later stage's private draft can't be locked in when fewer are still in than a team takes; the stage never has teams. `known:stage-draft-short`.
  2. **BACKLOG 61** (confirmed on the real routes): someone behind is shown the next stage's start (so when the merge came) and their team (who survived it). `known:later-stage-past-mark`.
  3. **BACKLOG 62** (a question): an Outlast stage that starts mid-season starts everyone on points; its own page shows them before its first episode while the overall counts none, then all at once.
  4. **Designs needed item 33** (from the real pages): the game's page says "All set · Nothing to do before Ep 3" while its first stage asks for an Episode 3 lineup; the overall is one number, with nothing saying what each stage gave; a stage waiting for the merge ends up showing a "Draft · Not started yet" plate for a draft the server refuses to start; a new stage's first lineup says "last week's stands in"; "Redraft at merged" (the phase's id); and, undriven because the runtime makes the draft, everything about the next stage's draft opening mid-season. Only the desk's engine lab can start a game in stages.

### Product fixes from these findings (2026-11-12, uncommitted; the user asked for all four)

Each was reproduced through the bench, fixed, and is now a hard assertion in `check-explorer-proof.js` or a UI oracle:

1. **Tonight's false "You finished it"** (`src/new/show/pace-plate.tsx`): an own-pace plate now needs a draft, team pick, waiver gather, catching up, or a game that's over (`GameView.over`). A caught-up seat on an airing season gets Tonight's usual flow. Proof: Ann, caught up, has no finish plate (the check confirms the real `/games` data that used to trigger it); Bo, behind, keeps his catch-up plates.
2. **First-name-only answer faces** (`src/new/show/answer-controls.tsx`): `shortNames` keeps a first name when it's unique in the control, adds the last initial when first names collide ("Avery A." / "Avery B."), else the full name. Face buttons carry the full name as their accessible name; the chip steppers' labels use full names. The UI oracle compares **visible** text, which it now does, on a `shared`-names case: clean.
3. **The behind player's "Your moves"** (`src/new/show/dock.tsx`):
   - the subtitle names the person's own episode ("Episode 2 · change it until you reveal it"), or each episode when their games differ;
   - the footer says "Revealing the episode does." instead of "Airtime does." when catching up.

   The squeezed cards came from the old synthetic names; cards render full width now, and the proof asserts no choice narrower than 64 px.
4. **Three-pick quick editor** (`game-view.ts` `PickMove.each` and `picks`; `data.ts` `moves.pick` sends `castawayIds` for several; `dock.tsx` `PoolPanel`): it multi-selects up to the game's count, with "Pick 3 for Episode N · k of 3 chosen", a toast at the limit, and saves the whole pick. A pool (one pick) works as before. Proof: three picks held and saved; server and runtime agree.

### UI oracles (plan §6A item 7)

`node scripts/dev-test/check-ui-oracles.js [--cases=3] [--seed=7] [--app=http://localhost:30xx] [--surfaces=tonight,episodes,full]` walks campaign cases, opens each exported run in the live tier on the chosen renderer, and checks every person's pages at 390 px:
- sideways overflow;
- indistinct choices within one control group;
- unnamed buttons and links;
- a due move outside the first phone screen;
- failed requests (by URL) and other console errors.

Seeded placeholder GIF media is counted separately as a fixture gap. Output goes to `.ui-atlas/ui-oracles/<port>/report.json`, with screenshots only for pages with findings. These checks are cheap and broad; they are not a design review.

First runs:
- **Main:** 62 pages over 4 cases, clean.
- **Reactions branch:** every game page 404s. The branch dates from 2026-11-02, before the game pages existed, so the oracle reports the surfaces that renderer lacks.
- **Shared first names:** the oracles found the participant answer grid shows only a name's first word; the same thing, with synthetic names, produced the `answer-faces-indistinct` finding. Realistic names no longer trigger it; the `shared` profile reproduces it on purpose.

### Chunk 4 proof (2026-11-12)

`node scripts/dev-test/check-explorer-proof.js [--width=390]` runs the three-case proof on the real routes through the bench: `runtime-proof.cjs` with `{ann:2, bo:1, eventCount:5}` (a two-starter lineup, three fresh picks, a participant + yes/no sheet, long names). 24 steps pass:

- every game's full page renders;
- the lineup is saved in the real quick editor and its player detail opens;
- a pick is saved in the real quick editor;
- both questions are answered on the real sheet;
- the clock passes airtime and the lineup and questions lock;
- episode 3's results are published, and Ann reveals across all three games;
- her boot answer is graded right by the real server;
- player detail opens for all three games;
- the lineup locks while it's being edited (the clock passes airtime with the editor open): the server refuses the save (the one expected console 400) and the runtime rejects it too;
- episode 4 goes partial (Ann reveals early), then final, then corrected with a different exit;
- Bo sees the catch-up views with his questions waiting, and reveals one episode while Ann keeps her mark.

Every real write agreed with the runtime replay, and the real `/games` standings matched the runtime's headless projection for both people after each phase. Report: `.ui-atlas/explorer-proof/proof-report.json`.

Findings it records (reproducible, not fixed):

- `multi-pick-editor`: the shared quick pick editor holds one selection for a game that picks three per round (known product gap).
- `answer-faces-indistinct`: participant answer choices show only the first word of a name; with the long-name profile 15 of 16 choices read "PARTICIPANT". Partly the synthetic names, but two contestants sharing a first name would collide the same way.
- `bench-no-episodes-surface`: closed. The proof now opens episode 3's page on the Episodes surface and checks the graded sheet there, as well as through the real `/answers` response.

Every required Chunk 4 transition is now exercised through the real UI, or recorded as one of the findings above. The behind viewer's quick-editor finding below still stands.

Driver note for Chunk 5: the bench's Quick action taps the first `[data-game-strip]` button. After a reveal that strip can open a recap rather than the move, so the proof opens editors from the game page's strip only when it is a `move`.

### Shaped tier (DB-free; tests and headless use only)

`runtime/open` with `live:false`. `frame-bundle.cjs` shapes responses from production projections. Don't grow it for new surfaces; extend the materializer. The details below describe it.

- **Reads.** `tools/gameplay-bench/frame-bundle.cjs` shapes the application's API responses from production projections. The v1 pilot (`session.cjs`) and the runtime session both call it; the pilot's output was verified byte-identical over 21 configurations, including saves and reveals, when it moved. Each game gets a stable UUID (the app's routes require one) derived from the document and game IDs. Every game in the selected context appears on the couch; the selected game is primary (wizard, rules).
- **Writes.** A lineup PUT, pick PUT or season reveal POST from the frame becomes a runtime action with origin `bench-frame`, acting only as the selected viewer (403 otherwise). A rejection returns 422 and leaves the state unchanged. Unknown writes still fall to the proxy's 403.
- **The reveal** advances the viewer's context mark through the runtime, then composes every seated game's `revealIn` part with `revealAcross` from `src/lib/game/episode-view.ts`. Production's `revealSeason` now uses that same function (moved out of `season-episodes.ts`, no behaviour change).
- **Clock.** New frame loads freeze `Date` at the runtime's current clock, not the activation time.
- **Routes** under `/__atlas/bench/runtime/`: `POST open {input, gameId?, viewerId?, surface, theme}` (a blocked definition returns `{status:'blocked', category, message, gaps}` and opens nothing), `POST select {id, gameId?, viewerId?}`, `POST frame`, `POST apply {id, action}`, `POST reset`, `GET state?id=`, `GET export?id=`. Any POST may carry `expectedRevision`; a stale one gets 409 with the current state. The shell also drops responses that arrive after a newer request.
- **Export** is `{kind:'gameplay-bench-runtime', presentation, execution}`. `execute`, the CLI and the bench's open all accept it; they replay the pinned trace and verify the same state hash.
- **Shell.** **Open a saved run or definition** accepts a scenario document, execution, runtime export or `{spec, context}`. A **Game** select joins **View as**. A blocked definition shows its gaps and closes the previous preview and readouts. The Checks panel lists action counts, unverified evidence and known gaps rather than passes. The pilot form is unchanged; **Generate game** returns to the pilot.

Known shaped-tier gaps (the live tier serves all of these from the real routes):

- The question sheet's `GET/POST /api/seasons/{id}/answers` (the full game page renders; its answers read is a visible 424, writes 501). It needs a pure builder extracted from `src/lib/server/answers.ts` `gameQuestions`, not a bench copy. Sheet reveal parts (`revealSheet`) need the same.
- A reveal for a viewer with no game seat (production's `watchedReveal`).
- A frame shows one context; multi-context documents select it through the game.
- Home moves list lineups only, as the pilot's did.

Adapter versions pin the whole `tools/gameplay-bench` tree, including the shell, so editing any bench file while Atlas runs makes its exports refuse to resume in a fresh process ("Execution versions changed"). Restart Atlas after bench edits; `scripts/dev-test/restart-atlas.sh` restarts it and restores its non-bench frames on their ports.

Checks: `node --test tests/gameplay-bench-runtime.test.js` (no app or browser), and `node scripts/dev-test/check-gameplay-bench-runtime.js [--file=<definition.json>] [--width=390]` with the app and Atlas running: opens the three-game proof, renders every game's page, saves a lineup in the real quick editor, switches viewers, reveals for the behind viewer, exports and replays headlessly, checks the phone layout, and opens a blocked definition. These are scoped bridge checks, not Chunk 4 interaction passes or design review.

**Noticed, not fixed (for Chunk 4):** on the real routes, `/episodes` for Ann (own pace, through 1, episode 2 released) returns `reveal: null` and lists only episode 1; check whether a catching-up own-pace viewer is meant to reveal from elsewhere before calling it a bug. Also, for a viewer who is behind (Ann through episode 1 of 2), the real quick editor ("Your moves") offers **Episode 3** while her game page says her open lineup is **Episode 2**, and its participant cards render squeezed against the right edge. The browser check saves as a caught-up viewer for now. Reproduce: open the proof with `{ann:1}`, Quick action.

## Campaigns

Chunk 4A, the engine/state tier (2026-11-12). Code: `tools/gameplay-bench/campaign/`.

```powershell
node scripts/gameplay-bench.js campaign --dir=.ui-atlas/campaigns/<name> --create=<name> --seed=<n> --cases=<n> [--depth=12] [--workers=2] [--limit=<n>]
node scripts/gameplay-bench.js campaign --dir=.ui-atlas/campaigns/<name> [--workers=4]          # resume
node scripts/gameplay-bench.js campaign --dir=.ui-atlas/campaigns/<name> --status=1
node scripts/gameplay-bench.js campaign --dir=.ui-atlas/campaigns/<name> --repro=<case index> --out=<new file>
```

- **Manifest** (`manifest.json`): the id, seed, generator, case count and limits (action depth, per-case wall-clock timeout, worker heap), plus the pinned engine, adapter, runtime, generator and campaign versions. Changed code refuses to resume; start a new campaign, and say what it was linked from.
- **Cases**: case N's seed and ID derive from the manifest and N alone, so worker count, order and crashes never shift a case. The `proof-family-1` generator varies:
  - 1–3 of the lineup, picks and question games, with their quantities;
  - 2–4 people, each with their own mark;
  - own-pace or live-only timing, content labels, pool size and released episodes.

  A seeded walk then reads the runtime's own projections to choose decisions, about 20% of them deliberately invalid, alongside reveals, clock steps past airtimes, and partial or final results.
- **Invariants after every step**: a rejected or blocked action leaves the hash unchanged; a reveal moves only its person; each member has exactly one "you" row; totals are finite; nobody sees history past their own mark. At the end, the exported run must replay to the same hash.
- **Durability**: `attempts.jsonl` gets a line before a case runs and `results.jsonl` after (each fsynced). A start with no result is an abandoned attempt: it is counted, and its case runs again. A case counts once, by its first finished result; any later results are retries.
- **Workers**: each case runs in a fresh `worker_threads` worker with a heap limit and a real wall-clock watchdog, independent of the scenario clock. Ctrl+C cancels: in-flight cases stay abandoned and are never passed.
- **Outcomes**: `pass`, `fail` (an invariant, with a signature), `generator-defect`, `error`, `timeout` and `infrastructure`; failures are grouped by signature.
- **Reproducers**: `--repro` writes the definition, the exact actions, `executeSteps` (each action with its recorded outcome, which `execute --steps-file` takes) and, for a failure, a step-dropping minimal list. The bench opens the reproducer or the `execute` result directly.
- **Acceptance**: `node --test tests/gameplay-campaign.test.js` covers:
  - an uninterrupted run against an interrupted, crash-injected run resumed with a different worker count (same per-case outcomes and final hashes, the abandoned attempt counted, no double counting);
  - cancellation;
  - an injected failure that reproduces on its own and minimizes to four steps;
  - version-drift refusal.
- **First run**: 200 cases at depth 12 with 4 workers all passed (2026-11-12).

**API tier** (`--tier=api [--app=http://localhost:3000]`; plan §6A item 2):
- Each case runs its engine walk, then its final state is materialized as zt-gb rows with social seeding, and every person's real routes are checked by `tools/gameplay-bench/api-checks.cjs`:
  - agreement: standings, catch-up flag and open lineup/pick episodes;
  - the spoiler scan, with its positive control.
- Workers report a lease (the case's row key) before writing, so rows from a crashed attempt are removed on resume.
- API-tier manifests also pin a hash of `src/`.
- First runs found two **fixture incoherences**, both fixed at their source rather than by loosening the check:
  - results published before their episode aired: the runtime now refuses results before the event's air time (`core-runtime-2`), and the generator steps the clock past an airing first;
  - seeded chat "written" by someone who hadn't seen the episode: the after-air author now has seen it.

  After the fixes, 40 of 40 API cases passed (`.ui-atlas/campaigns/api-40b`).

**Generated casts** have distinct realistic names (`core-runtime-3`). `content.labels: 'shared'` pairs first names on purpose, so name-collision defects are tested deliberately rather than everywhere.

**Scope, honestly:** this is the engine/state tier over one generator family. It doesn't cover other mechanics, the projection/transport tier, the live DB tier or browser journeys, and it doesn't do coverage-guided selection or deduplication of equivalent cases. Equivalence is by case ID only. A passing campaign isn't evidence of UI or design quality.

## Preserved baseline and checks

`tests/fixtures/gameplay-explorer/` contains synthetic v1 lineup, three-pick and NFL exports, a source-context question-sheet input and a frozen baseline manifest. They contain no recorded real-user identity or live provider data.

The manifest separates source capabilities, legacy fixture recipes, declared surfaces and unverified UI/interaction status. It preserves hashes and source requirement keys. Tests detect changes to frozen bytes/meaning, source vocabulary/families/patterns/controls and normalized requirement discovery. Review changes before intentionally updating a manifest; do not regenerate it just to hide a failing test.

Focused contract/planner checks:

```powershell
node --test tests/gameplay-explorer.test.js tests/gameplay-runtime.test.js
```

Broader backend milestone checks:

```powershell
node --test tests/gameplay-runtime.test.js tests/gameplay-explorer.test.js tests/gameplay-bench.test.js tests/gameplay-bench-controls.test.js tests/gameplay-bench-sports.test.js tests/gameplay-matrix.test.js tests/ui-atlas.test.js tests/active-roster-lineups.test.js tests/game-view.test.js tests/own-pace.test.js tests/answers.test.js
```

Run focused checks while changing a contract; broaden at milestones. Browser/visual checks are warranted when renderer, controls or transport behavior actually changes. This milestone changes no product UI and records no new UI/design passes.

## Next implementation handoff

Chunk 3's browser bridge is in place (above). Still open in Chunk 3: reconcile supplied snapshots and prove caching before claiming those features; the question-sheet builder can come with Chunk 4. Do not mark Chunk 3 complete on the strength of the bridge alone.

Unattended automation is a first-class consumer. Its headless case runtime/result/cleanup boundary now exists; after the three-case browser proof, **Chunk 4A** introduces deterministic campaigns, checkpoint/resume, bounded concurrency and durable result accounting. Do not make that runner depend on the pilot's 24 ephemeral UI sessions. The campaign runner is planned, not implemented by the current execution command.

Then prove the three cases in Chunk 4 before building the explorer workflow in Chunk 5. Do not expand the named-recipe allowlist as a substitute. The new public scenario schema must retain true mechanic-specific quantities rather than introducing starter/bench aliases again.

# Gameplay bench

Open **http://127.0.0.1:4400/__atlas/bench**, or choose **Gameplay bench** in the UI Atlas. Start it with `node scripts/ui-atlas.js serve` while the app runs on port 3000. It needs the existing `recorded` Atlas dataset and its local `zt_` fixture login; see [UI-ATLAS.md](UI-ATLAS.md) for setup.

The [scenario explorer implementation plan](PLAN-GAMEPLAY-SCENARIO-EXPLORER.md) defines the next architecture and dependency-ordered chunks for arbitrary specs, composable adapters, semantic controls and full capability coverage. This guide describes the current implementation; planned milestones are not implemented support.

The [explorer document/analyzer foundation](GAMEPLAY-EXPLORER.md) now implements chunks 0–2 alongside this pilot. Use `inspect`, `normalize` and `baseline` for arbitrary-spec analysis and versioned documents. The browser runs the legacy pilot from its form, and **Open a saved run or definition** opens a v2 definition, execution or runtime export in the shared runtime instead (see [the bench bridge](GAMEPLAY-EXPLORER.md#bench-bridge)). The redesigned explorer at `/__atlas/explorer` now covers every show recipe ("Start from a recipe"); this bench remains for sports recipes until generated sports statistics are connected to the shared runtime.

This is the first executable adapter for the [gameplay coverage matrix](GAMEPLAY-COVERAGE.md): **shared-roster lineups in a Survivor context, plus source-derived sports roster/stat games**. It generates synthetic LeagueState data, scores through the production engine, applies the production viewer projection and opens the actual application routes and components. Recorded show/cast artwork supplies show identity. Sports use synthetic athletes/box scores and cached vector artwork, with a generic fallback; all scores, choices and histories are synthetic.

## Using the bench

Choose **Game type** after choosing a show/sports context. The selector discovers all eight show-wizard bases plus the multi-stage family, and each sport's declared starting games. Entries marked **adapter needed** are selectable for inspection: they explain the missing data/interaction driver and clear the previous preview. They do not generate a substitute lineup fixture. The fraction beside “Build a situation” counts connected fixtures in this context, not distinct engine families or verified UX coverage.

The quantity fields follow the actual spec:

| Mechanic | Quantity inputs |
| --- | --- |
| Manual lineup | Starting slots, reserve slots |
| Best ball | Roster size, best scorers counted automatically |
| Whole-roster / Outlast | Roster size |
| Fresh participant picks | Picks per round |
| Survival pool | Its source-defined pick count, currently one |
| Questions / sports Pick'em | Read-only question definition count while its fixture adapter is missing |
| Squares | Source-defined grid width while its fixture adapter is missing |
| Calls, bingo, stages | Their missing specialized data/interaction requirements; no roster inputs |

Show quantities are editable for connected adapters. Sports retain their current source-defined defaults and display them as read-only values. These are semantic controls, not renamed starter/bench fields: a best-ball roster can have more excluded participants than a manual lineup's bench limit permits. The engine checks legal combinations separately.

Connected show fixtures are **Weekly Lineup, Best Ball, Outlast, Weekly Picks and Survival Pool**. Prediction Sheets, Weekly Calls, Weekly Bingo and stages remain explicit fixture/interaction gaps; sports questions, choose-a-few, squares and brackets still need their own adapters. There is no claim that all engine types are now playable in the bench. The previous **94 sports recipes** number means league/default combinations within supported roster/stat mechanics, not 94 distinct game types.

The pool's real quick-pick UI can save through the in-memory engine adapter. Weekly Picks supports generated multi-pick history and programmatic `pick` commands with an `ids` array, but today's shared production quick editor still chooses a single participant. Multi-pick interaction is a product/renderer coverage gap; generating a three-pick case does not certify that editor. Inspect and record that gap when reviewing this profile.

- Choose a preset for a regular game, one player/one starter, 24 players with long names, the maximum lineup roster, no episode history, you behind, a friend behind, mixed progress, or behind in a live-only game. Presets generate immediately.
- Customize seed, player count, starters, bench, completed episodes, labels, photography and saved/needed/locked/behind/finished state. **Generate game** applies these settings; changing a field alone leaves the active run intact.
- Switch between the full game, Games overview, quick lineup editor, player/scoring detail, **Episode reveal** and **Create game**. These use the app's existing UI. Player detail opens a permitted standings row; other people remain available from the app's own controls.
- Switch the viewing player, viewport or Night/Studio theme. Inspect the real rendered elements, their dimensions and first-view position. Clicking an element in the inspector locates it in the preview.
- Make a lineup in the actual editor. Its normal PUT request is intercepted by an explicit in-memory adapter, checked against the selected player and passed to `ActiveRosterLogic.validateLineup` / `setActiveRosterLineup`. Subsequent reads regenerate from that state.
- In a behind scenario, **Reveal next episode** opens the actual full-screen recap/reveal. Its season-level POST advances only the selected viewer by one episode and returns a payload built by production `revealIn`, including counted starters, contribution reasons and before/after standings. An episode reveal covers every game for that episode; this pilot currently contains one lineup game, with no per-game reveal selector.
- On **Episode reveal**, choose a watched episode to replay without advancing progress, or the next unseen episode to reveal it. Choose the full recap, lineup contributions or standings movement for direct entry. Unseen episode titles remain hidden. Skipping ahead and replaying an unseen episode are rejected.
- Open the couch progress readout to see every person's independent mark and switch viewers. A reveal changes that person's mark only; switching back restores the other person's position. At-own-pace games use the engine's late-join/catch-up copy and `GhostLogic.applyAs` for past episode lineups. Live-only games retain the app's reveal prerequisite and airtime locks.
- **Create game** is an inspection baseline of today's wizard, with the current lineup/roster size and explicit effective scoring supplied through its existing made-for-game input and selected automatically. It includes the premiere so this recipe starts at episode 1. You can inspect settings and drill-downs, but creation/AI writes are blocked. Wizard edits do not update the running bench game. This captures current behavior for the future overhaul; it does not implement the redesigned draft-to-game preview.
- **Reset game** restores the generated initial state. **Replay commands** rebuilds it and reapplies accepted commands. An invalid replay leaves the existing state intact.
- **Copy scenario link** shares the initial configuration, surface, theme and viewport. Export a replay to include subsequent choices.
- Export the exact fixture, initial configuration, accepted command log, source fingerprint, engine checks, rendered-element inventory and review notes. Load that JSON later to regenerate and replay it. Notes are stored locally by starting configuration until exported.

On small screens, detailed configuration collapses so the preview is easier to reach. Fixed-size phone/desktop previews scroll inside their stage; the surrounding bench does not claim they fit a smaller viewport. The current renderer is the initial reference. Alternative game redesigns have not yet been connected to a shared comparison adapter.

## Sports contexts

The context selector includes all **nine sport families** in the app: football, basketball, baseball, hockey, soccer, golf, racing, MMA and tennis. NFL, NBA and MLB come first. Thirty initial league contexts are discovered from production league lists/default overrides, with a few named examples for the open soccer/MMA/tennis adapters. **Another supported league** accepts additional ESPN-style paths such as `soccer/esp.1`; validation checks the local app adapter, not the existence or completeness of a live ESPN feed.

Sport games, scoring tables, categories, ranking, roster counts, position labels and cadence come from production exports. There is no second sports rules engine. Counts follow the chosen default: NFL 9 counted + 6 bench, NBA 10 + 3, MLB 18 + 5. Best-ball and other defaults can use a different count; the controls update with the selected game. Scenario presets retain those counts. Synthetic participants fill every required roster without claiming a real league has enough athletes for a 24-player stress fixture.

Implemented fixtures cover season/short/best-ball points games and categories/roto where the sport offers them. The app itself determines which games exist for each context. Full and overview renderers are connected for those fixtures. Quick lineup is available for explicit starters, scalar player detail for points games, current season reveals for season games, and the current sports wizard baseline for short/best-ball recipes. Unsupported combinations are disabled. Pick'em, choose-a-few, squares and bracket adapters remain gaps, along with category-specific detail/reveal and slate-based season creation. The current wizard is inspection only; it does not create or change the preview game.

**Known product UI gaps surfaced by this adapter:** some athlete point chips and detail/history projections still use show-event totals, despite correctly stat-scored standings. The current reveal can use TV phrasing. These are review targets, not hidden corrections in a mock. Live/partial stats, postponed events, provider roster constraints and sport-specific watch-along controls need separate fixtures. The bench adds no position enforcement beyond the actual engine's GameSpec. All automatic passes remain engine/adapter evidence, never a UI-quality certification.

## Programmatic use

Generate a durable fixture without opening the browser:

```powershell
node scripts/gameplay-bench.js generate --seed=42 --players=4 --starters=3 --bench=2 --labels=long --out=.ui-atlas/lineup-long-names.json

# Different mechanics use different quantities.
node scripts/gameplay-bench.js generate --showGame=best-ball --rosterSize=10 --bestCount=4 --out=.ui-atlas/best-ball-10.json
node scripts/gameplay-bench.js generate --showGame=outlast --rosterSize=3 --out=.ui-atlas/outlast-3.json
node scripts/gameplay-bench.js generate --showGame=picks --picksPerRound=3 --out=.ui-atlas/weekly-picks-3.json

# Independent positions: Alex 5, Riley 3, Sam 2, Jordan not started.
node scripts/gameplay-bench.js generate --progress=5,3,2,0 --timing=own-pace --out=.ui-atlas/mixed-progress.json

# Counts, scoring and context come from the selected sport default.
node scripts/gameplay-bench.js generate --context=football/nfl --sportGame=season --out=.ui-atlas/nfl-season.json
node scripts/gameplay-bench.js generate --context=baseball/mlb --sportGame=categories --pace=mixed --out=.ui-atlas/mlb-categories.json
node scripts/gameplay-bench.js generate --context=tennis/wta --out=.ui-atlas/wta-season.json
```

Existing output files are preserved; choose another filename for a new version. The command prints checks and a URL for the same scenario. Load the exported file in the bench to play it. A backend and local fixture login are required for the actual UI preview, but fixture generation itself uses the pure engine without creating database rows.

The local HTTP interface also supports automation:

| Method/path under `/__atlas/bench/` | Purpose |
| --- | --- |
| `GET meta` | Available presets, engine-derived bounds, defaults and implemented surfaces |
| `POST context` | `{league}`; register an additional locally supported sport/league context |
| `POST generate` | `{config, surface, theme, replay?}`; return session ID, isolated frame URL, projection and checks |
| `GET snapshot?id=…` | Exact exportable fixture, state and accepted commands |
| `POST frame` | `{id, surface, theme, episode?, section?}`; switch surface; reveal section is `story`, `lineup` or `table` |
| `POST command` | `{id, command}`; selected-player lineup, viewer change or viewing-boundary reveal |
| `POST reset` | `{id}`; restore initial state |
| `POST replay` | `{id, commands}`; atomically replay from initial state |

Sessions are in memory. Restarting the Atlas loses them; export important runs first. The most recent 24 sessions are retained, with older frame servers disposed. Frame origins isolate different sessions/themes; surfaces within one run share its engine state. Ordinary Atlas frames remain read-only. Unknown writes and missing reads fail explicitly rather than falling through to production application mutations or unrelated captured game data.

## What checks establish

The automatic checks verify contextual spec validity, compiler mappings, one selected viewer, episode-history boundaries, finite/population-complete standings and displayed totals reconciled to engine calculations. Unit tests also include a known half-point bench event that must not enter the counted score, invalid/unauthorized/locked lineup rejection, deterministic generation and atomic replay.

These are **engine/adapter checks**. A successful save in this bench does not prove database persistence, complete server authorization, every engine format, every interaction or high design quality. The fixture supplies explicit empty ancillary experiences where they are outside the lineup scenario; they are not certified gameplay adapters. Runtime/HTTP errors and missing data adapters remain visible.

Use Intent to critique the task, decisions and return paths; PFD for perceptual hierarchy; Impeccable for visual and interaction craft. Review with actual labels, contributions and opponent visibility. Exports remain **unreviewed** and never record matrix passes automatically. Inspect the exact subject, fixture and scope before authoring evidence in the coverage ledger. User approval remains separate from automated or AI checks.

## Extending without parallel engine definitions

The generator reads the engine's preset expansion, limits and contextual validator. `gameView` supplies viewer-scoped scores, histories, roster and legal next actions. The renderer is the real app; edits there appear in the bench. The show-level scoring explanation also uses the existing rulebook descriptor.

The reusable layers are:

| File | Responsibility |
| --- | --- |
| `tools/gameplay-bench/scenario.cjs` | Seeded state, context validation, production-engine commands and invariant checks |
| `tools/gameplay-bench/game-controls.cjs` | Source-discovered show catalog, fixture availability and spec-derived semantic input contracts |
| `tools/gameplay-bench/sports.cjs` / `sports-project.cjs` | Production sport discovery/defaults, synthetic stat inputs and sport API presentation |
| `tools/gameplay-bench/session.cjs` | Artwork/identity adapter, coherent API projections, export/reset/replay |
| `tools/gameplay-bench/router.cjs` | Isolated sessions, surface entry points and exact mutation allowlist |
| `tools/gameplay-bench/shell.*` | Bench controls, live preview, element inspection and review export |
| `tools/ui-atlas/server.cjs` / `bridge.js` | Existing application proxy and runtime instrumentation |

This pilot's 24-player and 12-completed-episode controls bound fixture generation; they do not introduce product limits. Unbroken names are adversarial presentation stress data, not a claim those labels pass every production identity form. The contextual GameSpec is still validated separately. Generic starter/bench bounds cannot be copied into sport adapters: NFL already has a valid nine-starter default.

For another family, add a reusable context/state/command adapter and connect its real surfaces; reuse common content and quantity transforms. Let the matrix discover new vocabulary/placements and flag missing support. A new mechanic still needs deliberate UI and driver behavior; do not generate a generic fallback and call it playable. Creation persistence, a redesigned draft-to-play preview, multi-game aggregation, early/final correction variants, other game families and live/partial/postponed sports variants remain explicit follow-up work. Current full-screen final-result reveals are connected for the lineup pilot.

Exports now include a fingerprint of the bench adapter code alongside the application's source fingerprint. Loading an older adapter's export warns that replay uses the current progress model; inspect changed results before reusing evidence. An optional `progress` array has one integer per player, from zero through completed episodes. Without it, `pace` selects together/you-behind/friend-behind/mixed, and `timing` defaults to own-pace unless explicitly live-only.

After an engine/source change, restart the Atlas so Node engine modules, inventory and snapshots agree. Preserve failures as regression fixtures instead of changing a seed until they disappear.

```powershell
node --test tests/gameplay-bench.test.js tests/gameplay-bench-sports.test.js tests/gameplay-matrix.test.js tests/ui-atlas.test.js
node scripts/dev-test/check-gameplay-bench.js
node scripts/dev-test/check-gameplay-bench-flows.js
node scripts/dev-test/check-gameplay-bench-sports.js
```

The browser check exercises the bench and the real application, writes scoped results and caches captures in `.ui-atlas/bench/`. Preserve any long-term evidence outside disposable generated output before relying on it in the matrix ledger.

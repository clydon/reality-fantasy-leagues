# UI Atlas

A reusable, generated HTML workbench for discovering the current UI, rendering named states with data, comparing mocks, and exporting focused context for design reviews.

Open **http://127.0.0.1:4400** while the atlas is running. The generated file is `.ui-atlas/index.html`. It is self-contained for browsing the inventory; interactive application rendering requires the local app and atlas server.

For generated games, open **Gameplay matrix** in the header or **http://127.0.0.1:4400/__atlas/gameplay**. The [gameplay coverage guide](GAMEPLAY-COVERAGE.md) describes its capability-by-surface chart, visual/data contracts, stress profiles, sampled engine witnesses and scoped evidence ledger. It regenerates with the Atlas; source/compiler coverage remains separate from verified UI coverage.

The executable [Gameplay bench](GAMEPLAY-BENCH.md) at **http://127.0.0.1:4400/__atlas/bench** generates seeded lineup scenarios and opens the actual app's overview, editor, full game, player details, episode reveal and current creation wizard baseline. It supports independent viewing marks, own-pace/live-only scenarios, in-memory lineup saves and reveals, viewer changes, reset/replay and fixture/review export. Wizard creation remains blocked. The context selector also discovers all nine app sport families, with NFL/NBA/MLB first, synthetic stat fixtures and explicit per-game surface gaps. Additional open-adapter leagues can be entered without calling ESPN. Game type controls discover all show-wizard bases and the sport defaults, expose adapter gaps, and display quantities appropriate to the actual mechanic. Five show fixture recipes are connected; see the bench guide for per-family limitations. This is a bounded roster/stat/pick adapter; ordinary Atlas frames remain read-only and matrix coverage remains unreviewed until scoped evidence is recorded.

## Start on this workspace

The recorded-season and draft datasets have already been captured here.

```powershell
# Keep the app running in another terminal.
npm run dev

# Generates the inventory and starts the workbench.
npm run ui:atlas
```

In Windows PowerShell, use `npm.cmd` if local execution policy blocks `npm.ps1`.

The atlas defaults to the app at `http://localhost:3000` and binds its own servers to loopback only. A different app/atlas port can be supplied:

```powershell
node scripts/ui-atlas.js serve --app=http://localhost:3001 --port=4400
```

This is a development tool. Its controls and comparison UI do not redesign or ship new product screens. The actual shared-component workbench is available only in development, behind the existing session layout and a loopback-host check.

## What is generated automatically

The TypeScript AST scanner discovers JSX component candidates throughout `src`, including local components, rather than only looking for named exports. It records:

- Components, source paths and line numbers, props, child component names, UI markers and local state declarations.
- Conditional rendering expressions as state hints.
- App Router pages, route groups, layouts/loading/error boundaries, dynamic paths and possible file-level reachability.
- Source hashes, including non-JSX source dependencies, so snapshots and context identify the source revision.

The initial inventory found **1,372 component candidates, 65 page routes and 2,888 UI-marker occurrences**. These include new-design, legacy and shared source. Counts change when regenerated; they are not a claim that every component is mounted or every branch is understood.

The initial registry contains **121 entries**: 15 recorded-fixture cases, 29 derived UI-fixture cases, 12 loading/error cases, 20 isolated component stories and 45 automatically discovered route entries needing further state/data adapters. The Gaps tab makes missing coverage visible.

## How to use the workbench

| Area | Purpose |
| --- | --- |
| Screens | Select a surface and a named situation: no couch, empty couch, watching only, multiple shows, catch-up, solo, saved, locked, waiting, early results, finished or drafting. |
| Components | Search names, source paths and markers. See available stories or an explicit source-only entry. |
| Routes | Inspect discovered pages and their source. Dynamic routes with unresolved parameters still need a recipe. |
| Gaps | Find missing stories and state adapters. A recipe’s existence is separate from runtime verification. |
| Data / Load JSON | Select a captured dataset or import a compatible, versioned API bundle. |
| Recorded game | On the generated-game screen, select any game carried by the chosen dataset. The current dataset offers six real engine-generated examples, including an ended game. |
| Viewport / Theme / Clock | Use phone, small phone, tablet or desktop dimensions; Night/Studio; captured or live time. |
| Reference | Use the interactive current implementation or a saved static baseline. |
| Design version | Show OG/current alone or compare it with a registered proposal. Tonight has preserved V1 and revised V2 options; data-alignment status remains explicit. |
| Elements | Inspect real rendered controls and sections, their sizes, markers, owner hints and viewport placement; click one to highlight it. |
| Source | Read component branches, state and source without searching the whole repository. |
| Review | Use Intent, Impeccable or PFD prompts, keep notes, and export a focused context packet. |

Frame origins are isolated by case, dataset, theme and clock. This prevents one case’s React Query cache, cookies or local storage from silently becoming another case’s state.

“First view” checks both axes and the element’s center-point visibility. A sideways carousel control outside the frame is not counted merely because its vertical coordinate fits. After scrolling, distinguish the current viewport from the initial view. These are useful inspection signals, not an accessibility or usability certification.

React owner paths are optional development hints from the mounted tree. They are not a supported React API or a complete source map; markers and the AST inventory remain the fallback.

## Three coverage levels

1. **Discovered:** the element/component/route exists in source. It may still have no reproducible preview.
2. **Registered:** an explicit story or state recipe supplies a way to inspect it.
3. **Observed/checked:** the actual frame rendered and a particular interaction or assertion was checked.

Do not collapse these levels into “everything passes.” Arbitrary valid application state cannot be inferred from a component name or an `if` expression. The scanner identifies the inventory and likely branches; explicit recipes provide meaningful data and entry conditions.

A large number of source-only components is expected initially. Many already render inside registered full screens, while their isolated prop stories or unusual branches remain unregistered. Add coverage where the review needs it instead of building a second copy of every component.

## Data modes and their limits

| Mode | What it proves |
| --- | --- |
| Recorded fixture | Uses captured GET projections from an actual local `zt_` fixture account with the real application renderer. |
| Derived UI fixture | Applies a named transformation to captured projections to exercise a UI branch. It is a presentation fixture, not a simulation of every engine rule or permission. |
| Fault | Injects read failure or a 25-second delay to inspect loading/error behavior. |
| Component story | Passes explicit props to the actual shared React component. |
| Route-only | A discovered route is addressable, but its appropriate data, role or state still needs an adapter. |

The proxy forwards the app’s HTML, React bundles and styles. It does not recreate current product markup in hand-written HTML. API reads come from the selected recorded bundle and recipe. **Application writes are blocked.** Unsaved client choices, opening sheets, navigation and component interactions can work; save/reveal/create flows need explicit local mutation adapters before they can be tested end to end.

Capture time freezes client time for reproducible state inspection. Choose Live clock when checking time-dependent interaction. The frozen mode is not appropriate evidence for a running playback timer.

Source/data snapshots are not permission guards. Production authorization and spoiler tests still belong to the app’s engine and server tests. Derived fixtures can be incomplete for complex modifiers or nested workflows; missing reads appear as gaps rather than fabricated empty responses.

## Prepare data on a fresh checkout

The tool does not depend on the dated study directories. Existing fixture builders can prepare reusable local datasets:

```powershell
# Existing repo prerequisites: dependencies, migrated local Postgres, app running.
node scripts/ui-atlas.js prepare-live
node scripts/ui-atlas.js capture --fixture=live --dataset=recorded --browser

node scripts/ui-atlas.js prepare-draft
node scripts/ui-atlas.js capture --fixture=draft --dataset=draft --browser

npm run ui:atlas
```

Preparation reuses matching test rows when possible. If the fixture is absent it invokes its existing builder. `--reset` deliberately recreates that fixture’s test rows. Do not run reset while another check is using the same `zt_nd` or `zt_dr` fixture. These builders refuse non-local databases.

The current workspace also has a recorded Survivor 49 study fixture with season artwork and cached cast photos:

```powershell
node scripts/ui-atlas.js capture --fixture=fidelity --dataset=recorded --browser
```

That convenience adapter requires its existing local descriptor. Use `prepare-live` on a fresh checkout, or provide your own descriptor. Public fixture photos under `/mock` are reused; the fidelity adapter additionally reuses its existing cached media.

`--browser` visits registered representative screens to capture their dependent GET requests. It opens setup but does not create a game. It skips authentication responses. Bundles store no session cookies or passwords. Only explicit `zt_` fixture accounts are accepted, and credential-shaped values are rejected. Actual sessions stay in the server process.

### Capture reads discovered in another state

Some endpoints are only requested after opening a sheet or switching to a different progress state. The workbench shows missing adapters and keeps a request journal.

```powershell
# With the atlas still running, capture missing GETs using its fixture accounts.
node scripts/ui-atlas.js capture-missing

# Restart the atlas to load the updated bundles.
npm run ui:atlas
```

Alternatively, `serve --record-missing` deliberately records missing fixture reads as you explore. Keep strict replay as the default when reproducibility matters. Unknown endpoints return HTTP 424 in strict mode; they do not silently fall back to live application data.

### Capture another fixture or import data

Descriptor example:

```json
{
  "user": "zt_example_reviewer",
  "seasonId": "your-local-fixture-season-uuid",
  "couchId": "your-local-fixture-couch-uuid",
  "games": [{ "id": "your-local-fixture-game-uuid", "type": "active-roster" }]
}
```

```powershell
node scripts/ui-atlas.js capture --fixture=path/to/fixture.json --dataset=my-show-v1 --browser
node scripts/ui-atlas.js import --file=path/to/bundle.json --dataset=my-show-v2
```

Imports also work through **Load JSON**. Use an atlas bundle with `schemaVersion: 1`, `context`, `responses`, and preferably `capturedAt` and provenance. Each response is keyed by API path/query and contains `{ "status": 200, "body": ... }`. A baseline’s `.data.json` demonstrates this format. Referenced local media must also be available; loading JSON does not magically install its image files.

The fixture account must exist locally so the actual app’s server session layout can render. Site-operator pages need a separate appropriate test role and dataset. A bundle does not elevate the session’s permissions. Use `ATLAS_FIXTURE_PASSWORD` for a non-default fixture password; do not commit credentials.

## Freeze a baseline

Use **Save baseline**, or:

```powershell
node scripts/ui-atlas.js snapshot --case tonight.live --viewport=390x844

# Choose a particular generated game from a loaded dataset.
node scripts/ui-atlas.js snapshot --case game.live --game=<fixture-game-id> --viewport=390x844
```

This records a PNG, metadata/control measurements, the effective API-data bundle and a focused source packet under `.ui-atlas/baselines/`. Filenames include theme, viewport, source fingerprint and effective data/recipe fingerprint. Existing captures are not overwritten unless `--replace` is explicitly requested.

Saved references appear under **Reference**. They are static screenshots, clearly distinguished from the interactive current implementation. The metadata does not reconstruct an old executable code checkout. Keep the corresponding git revision/worktree separately if an interactive old implementation is required.

Regenerate after changing source by restarting `npm run ui:atlas`, or run `npm run ui:atlas:build` for an offline artifact. Known source changes invalidate activation until regenerated, so a newly rendered screen is not casually labeled with an older source fingerprint.

## Build mocks alongside current views

Register variants in `tools/ui-atlas/mocks.json`. For a data-bound mock, put its files under `tools/ui-atlas/mocks/`:

```json
{
  "id": "tonight-option-a",
  "title": "Tonight option A",
  "surface": "tonight",
  "file": "tonight-option-a.html",
  "alignment": "same-proxy-data",
  "note": "Uses the selected case’s API bundle."
}
```

The mock runs on the active case’s proxy origin. It can fetch the same recorded API routes or `fetch('/__atlas/data')` for the case, context, provenance and effective responses. Use that contract for future prototypes; do not copy another hardcoded dataset into each mock.

The included **Data contract example** shows how to read this data. It is explicitly not a proposed product redesign. The existing Tonight study is also registered, with **independent-fixtures** alignment: it uses its own participation/progress scenarios and must not be mistaken for an identical-data comparison.

External/local mock URLs can also be registered. Label alignment honestly. Side-by-side display alone does not establish equivalent state or data.

Use `caseIds` in place of `surface` to restrict a mock to selected situations. A shareable comparison link can include `?case=tonight.catchup&mock=tonight-pilot-v2`; switching to another supported case keeps that mock selected. The [Tonight V2 proposal](show-soul-review/tonight-v2-2026-11-11.md) has watching-only and multiplayer variants, illustrative social fixtures and local interactions. `tonight-pilot` remains the preserved V1; the Design version dropdown's OG option shows the current application without a proposal. Versioned mock files and separate local-state keys preserve earlier iterations for comparison.

The [V3 proposal](show-soul-review/tonight-v3-2026-11-11.md) adds game results, entity drill-down and a shared showcase/summary reveal. Open `?case=tonight.reveal-ready&mock=tonight-pilot-v3` to inspect watched episode 3 with unrevealed game results. This registered derived recipe brings the current registry to 122 entries. A bounded recorded episode-3 payload is loaded only after explicit local reveal confirmation; production mutations remain blocked. Verify this proposal with `node scripts/dev-test/check-tonight-results.js`. V2's checks now target its preserved files.

## Context for AI design work

Before defining generated-game coverage, read the source-derived [core game catalog](CORE-GAME-CATALOG.md) or its [JSON inventory](core-game-catalog.json). It separates the eight runtime families, eight wizard bases, sports/league-specific defaults, fifteen main-page patterns, sixteen answer controls, ranking modes and modifiers. Regenerate with `node scripts/core-game-catalog.js`; `--check` detects drift. A handful of lineup examples is not complete game coverage.

The [data and detail round](http://127.0.0.1:4400/?case=tonight.catchup&mock=tonight-data-r3) is the latest focused component study. It keeps the liked season overview A while comparing **three actual episode popups**, **three shared viewing timelines** and **three lineup/graph representations**, including their connected expanded and scoring views. Its [notes](show-soul-review/tonight-data-round3-2026-11-12.md) record the user's clarified direction and data boundaries. Run `node scripts/dev-test/check-tonight-data-r3.js`; evidence is under `.ui-atlas/tonight-data-r3/`. Its local action state is separate from previous V4 rounds.

For focused visual alternatives, open the [Tonight component studio](http://127.0.0.1:4400/?case=tonight.catchup&mock=tonight-components), also listed in **Design version**. The current **bold round** compares three options each for **Your place in the season**, **Your couch's pace** and **Your game night** alongside their unchanged V4 originals. Choose independently, open **Your mix**, and export choices as JSON. The [bold study notes](show-soul-review/tonight-components-bold-2026-11-11.md) describe the concepts, motion and data boundaries. Run `node scripts/dev-test/check-tonight-components-bold.js` for its focused evidence. The [first round](http://127.0.0.1:4400/?case=tonight.catchup&mock=tonight-components-r1) remains frozen and uses `check-tonight-components.js`. These do not replace the current-application browser checks.

The current [V4 Tonight proposal](show-soul-review/tonight-v4-2026-11-11.md) replaces V3's selective-reveal assumption with an episode reveal across all games and a full-screen recap. Compare [compact minis](http://127.0.0.1:4400/?case=tonight.catchup&mock=tonight-pilot-v4) with [detailed minis](http://127.0.0.1:4400/?case=tonight.catchup&mock=tonight-pilot-v4-detail), or use `tonight.reveal-ready` to try the reveal. Both are in **Design version** alongside preserved OG/V1/V2/V3. Verify V4 with `node scripts/dev-test/check-tonight-v4.js`; screenshots and bounded behavior checks are saved under `.ui-atlas/tonight-pilot-v4/`. This remains a one-page review proposal.

```powershell
node scripts/ui-atlas.js cases
node scripts/ui-atlas.js inspect --case tonight.catchup --lens intent
node scripts/ui-atlas.js inspect --case tonight.catchup --lens impeccable
node scripts/ui-atlas.js inspect --case tonight.catchup --lens pfd

# Inspect one component without reopening its entire source tree.
node scripts/ui-atlas.js inspect --case kit.sheet.open --component="src/new/ui/sheet.tsx#Sheet"
```

Packets contain the case’s purpose, dimensions, data mode, source locations, relevant state/branch hints, related imports and lens-specific questions. The browser also exports the observed controls, sizes and viewport placement. Recent runtime observations are cached per case and reused by the CLI when their source fingerprint matches.

| Skill | Use the atlas for |
| --- | --- |
| Intent | Screen purpose, valid situations, entry/return paths, content to remove/combine, missing views and consequences of actions. |
| Impeccable | Actual components, representative imagery/data, density, spacing, typography, interaction states and meaningful visual comparisons. |
| PFD | The initial attention order, grouping, actionable signals and whether relevant actions are actually visible and reachable. |

Review notes are kept locally in `.ui-atlas/review-notes.json`, with browser storage as an offline fallback, and can accompany exported packets. Notes and test results do not automatically approve a design. The [full-app brief](APP-REVIEW-DESIGN-BRIEF.md) and its one-page-at-a-time review boundary still apply.

This saves repeated discovery tokens: generate the broad index once, then inspect one case/component/lens. Refresh after relevant source or data changes. Do not paste the entire generated manifest into every AI session.

## Extend coverage

| Change | Where |
| --- | --- |
| New screen/state recipe, purpose and review expectations | `tools/ui-atlas/catalog.cjs` |
| Data capture, request matching and coherent state transformations | `tools/ui-atlas/data.cjs` |
| Isolated props/state of a real shared component | `src/new/dev/atlas-stories.tsx`, then register its cases |
| Source discovery, markers and branch inventory | `tools/ui-atlas/inventory.cjs` |
| Rendered-element inspection | `tools/ui-atlas/bridge.js` |
| Mocks | `tools/ui-atlas/mocks.json` and `mocks/` |
| Focused context format | `tools/ui-atlas/packet.cjs` |
| HTML workbench | `tools/ui-atlas/shell.html`, `.css`, `.js` |

Add explicit mutation adapters before claiming save/create/reveal flows are fully usable. Add operator fixtures before claiming Desk coverage. Extend the generated-game cases from the compiler grammar and [existing census](../scripts/dev-test/game-page-census.js), rather than assuming one representative game covers every generated structure.

## Verify and maintain

```powershell
npm run ui:atlas:build
node scripts/ui-atlas.js validate
npm run ui:atlas:check

# Requires app, atlas and prepared datasets.
node scripts/dev-test/check-ui-atlas.js
```

The browser check covers 18 named cases plus the loaded generated-game variants, element inspection, data-bound mock comparison and design lenses. Unit checks cover AST discovery, source changes, request matching, fixture transformations, credential rejection, filesystem boundaries, case isolation, read-only behavior and missing adapters. These results are narrower than the complete source inventory.

On the initial workspace, the full-project TypeScript check reports existing generated Next route-type errors and stale references to removed admin routes. No diagnostics point to the new atlas TSX files. That project-wide check is not recorded as passing.

Generated HTML/JSON, fixture projections, observations, notes and screenshots live under ignored `.ui-atlas/`. Source tooling, recipes, stories and this guide are versionable. Existing application tests and the project’s required checks still apply to implementation changes; the atlas is additional reusable evidence, not their replacement.

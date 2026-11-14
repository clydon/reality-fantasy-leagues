# Gameplay coverage matrix

The persistent capability-to-UI contract for generated games. Use it with the [core game catalog](CORE-GAME-CATALOG.md) and [UI Atlas](UI-ATLAS.md) to choose design work, build representative fixtures and track evidence without repeating a whole-repository investigation.

Follow the [scenario explorer implementation plan](PLAN-GAMEPLAY-SCENARIO-EXPLORER.md) when connecting matrix requirements to executable scenarios. It separates foundation, runnable breadth and reviewed coverage milestones; adding gap labels or sampled recipes does not complete those milestones.

Open **http://127.0.0.1:4400/__atlas/gameplay**, or click **Gameplay matrix** in the Atlas header. Starting the Atlas generates it automatically:

```powershell
node scripts/ui-atlas.js serve

# Generate the standalone HTML and complete JSON without starting a server.
node scripts/gameplay-matrix.js build
```

The outputs are `.ui-atlas/gameplay-matrix.html` and `.ui-atlas/gameplay-matrix.json`. The HTML embeds a bounded selection of examples; the JSON contains the complete sampled corpus. HTTP export downloads the complete JSON. Generated files are disposable; tracked contracts, fixtures and the evidence ledger are the durable inputs.

The [Gameplay bench](GAMEPLAY-BENCH.md) now provides the first executable adapter: generated shared-roster lineups with real app rendering, in-memory engine commands and reproducible exports. Open `/__atlas/bench` to inspect overview/editor/full-game/player-detail, full-screen episode reveal (including lineup and standings beats) and the current creation wizard baseline. Independent viewer marks cover you behind, friends behind and mixed progress, with explicit own-pace/live-only policy. Its sports context selector also covers all nine app sport families, using production defaults and synthetic box-score fixtures. NFL/NBA/MLB lead the selector; unsupported decisions and surfaces remain explicit gaps. See the bench guide for current sports renderer limitations. This does not implement every stress recipe or mark coverage passed; the broader matrix remains the requirements and evidence plan.

## What the chart maps

Rows cover engine families, wizard bases, primary page patterns, answer controls, ranking modes, vocabulary values, twists and declared renderer placements. Columns cover **Create/preview, Overview/mini, Quick action, Full game, Detail/scoring and Episode reveal**. Unmapped surfaces remain explicit rather than claiming a universal component fits everything.

The initial build discovers 408 capability rows, 15 primary page patterns and 16 answer controls. It compiles 1,312 distinct normalized specimens from 1,349 declarations, including rolled combinations, show fixtures, sports defaults, league overrides and an objectives witness. These counts describe source coverage and sampling, not the number of possible games. `weeklyCard` is an auxiliary section, not a sixteenth primary page pattern.

The main visual contracts are:

| Page pattern | Required representation and detail |
| --- | --- |
| `team` | Own and permitted opponent rosters; counted contributions, bench/best selection and exact scoring |
| `picks` | Selected targets, saved/locked state and each pick's outcome |
| `ladder` | Survival, lives/streak, pick history and valid next choices |
| `ballot` | Question completion, readable answers and pending/settled/void grading |
| `slate` | Event decisions, individual locks, postponements and results |
| `card` | Bingo geometry, marked moments, lines and grading sources |
| `board` | Sports squares, ownership, digits and payout periods |
| `together` | Shared progress/lives plus permitted individual contributions |
| `race` | Actual target, exact progress, remaining distance and competitor trajectories |
| `matchup` | Comparable opponent scores, lineups, ties/byes and schedule/bracket |
| `categories` | Category values, units, direction, rates and ranking |
| `worth` | Holdings, cash, prices/time and portfolio valuation |
| `week` | Episodes/weeks won, current points and tie policy |
| `objectives` | Distinct objectives, completion and who contributed |
| `stages` | Active/parallel child formats, transitions and overall scoring |

Each row also declares required data and overflow behavior. A miniature can summarize a complete list; it must expose the list and retain exact values. The matrix flags 17 current spec/tag-only placements: source declarations need inspection before assuming meaningful live data or a working control exists.

## What a status means

Keep three independent claims separate:

1. **Source support:** a vocabulary value or renderer placement is declared. Gated values remain gated.
2. **Compiled specimen:** a sampled spec exercises the capability and produces a page model. Shape-playable does not establish validity in a particular show, sport, pool or rulebook.
3. **UI evidence:** the actual renderer or named mock has been checked against saved data for a particular surface and situation.

Every required UI unit identifies a capability, surface, stress profile, subcase, viewport and theme. It needs three current gates: **render, interaction and design**, all for the same named renderer/version, engine specimen and fixture bytes. Mixing different mocks or datasets leaves the unit blocked. A screenshot alone cannot verify decision saving or design quality. Passing one unit creates partial coverage; it does not verify the whole cell or family.

Cells show Unreviewed, Partial, Verified, Failing, Blocked, Stale or Engine-gated. Initially **zero cells are verified**. Existing Tonight mock checks have bounded scopes and have not been promoted automatically.

Thirty stress profiles include long labels, empty/one/many/maximum quantities, hidden opponents, insufficient choices, lifecycle transitions, own-pace/live-only timing, partial/corrected results, ties, missing data, dense grids, allocation, stage changes, keyboard, large text and reduced motion. Arrays in a recipe create independent subcases; themes and viewports also remain independent.

This deliberately conservative plan initially expands to 1,784 cells and 492,392 units. That is a coverage backlog, not a request for half a million manual screenshots. Build parameterized fixtures and batch checks; one recorded case can support multiple capabilities it actually exercises. Refine overly broad applicability in `contracts.cjs` with a documented engine/UI reason. Never reduce scope merely to obtain a green score.

## Recommended design workflow

1. Pick one meaningful slice, such as the `team` miniature plus its lineup/scoring drill-down. Search the chart and export its focused packet, or run:

   ```powershell
   node scripts/gameplay-matrix.js inspect main:team
   ```

   The normal packet is bounded for AI context. Add `--expand` only when you need every required tuple.

2. Use **Intent** to define the decision, compact summary, information hierarchy, opponent visibility and return path. Use **PFD** to specify what must be noticed and understood first. Use **Impeccable** to design the graphic, typography, density, interaction and motion. Apply the actual skills and [design brief](APP-REVIEW-DESIGN-BRIEF.md); the matrix is their shared checklist, not a replacement for design judgment.

3. Select a compiled witness, validate it with the **actual page context**, and build a real Atlas data adapter or component story. Compiler examples are not API response bundles. The stress recipes currently say **adapter needed**; selecting a recipe does not render that state automatically. Add missing GET projections and explicit local mutation adapters for create/save flows; the Atlas blocks application writes.

4. Start with baseline, few/many items and long labels. Add the engine/context maximum, invalid maximum+1 on creation/save, hidden opponent data, counted-versus-excluded contributions and relevant lifecycle transitions. Expand across the remaining applicable profiles and recorded viewport/theme units. Use valid fixtures for gameplay; use separately labeled adversarial projections for malformed legacy/imported content.

5. Capture the actual view, drill-down, decision and return behavior. Preserve exact fixture data and test/screenshot artifacts. Identify the actual renderer or mock version. A screenshot should show real labels, graphics and values; do not substitute generated artwork for data.

6. Record only the units and gates actually checked. Present the redesigned slice for user review before extending its design to other surfaces. A passing design review record does not imply the user's approval.

The Interactions tab shows observed main/control, base/rank, control/rider and count/rank pairs. An absent pair may be invalid, context-dependent or unsampled. Pairwise samples cannot prove every valid higher-order combination. Add witnesses and specific regressions for new collisions; retain the engine's unsupported-combination gates.

## Limits, constraints and context

Generic exported constants are reference values, not universal UI caps. The automated boundary probes currently check minimum/maximum/maximum+1 picks and starters in a Survivor context, plus the NFL default's nine starters. The generic starter maximum is eight; **nine is valid for the NFL context**. Always validate through `specProblems(spec, context)`, `specWaitsFor(spec)` and `typeOf(spec)`.

Long-label checks distinguish the actual field's longest valid value from an adversarial imported projection. Above-maximum checks belong to creation and quick-action guards, not fictional results pages for invalid games. Never silently truncate picks, drop rows, replace missing scores with zero or lower valid game limits to fit a card.

The Constraints tab contains proposals for wrapping, disclosure, overflow and potential hard caps. These do not change the game. A new gameplay restriction requires an explicit decision, shared schema/server enforcement, actionable UI feedback and both-side boundary checks.

## Durable fixtures and evidence

| Tracked input | Purpose |
| --- | --- |
| `tools/gameplay-coverage/contracts.cjs` | Surfaces, visual/data contracts, profile applicability, viewport/theme requirements and constraint proposals |
| `tools/gameplay-coverage/specimens.json` | Additional engine witnesses with stable `id`, actual `context` and `spec`; the build rejects invalid entries |
| `tools/gameplay-coverage/reviews.json` | Append-only scoped evidence records |
| `scripts/gameplay-matrix.js` | Build, integrity/readiness checks, focused inspection and evidence import |

Use the inspector's evidence template for the current fingerprint and specimen ID. Fill its exact profile/subcase/viewport/theme, gate, `subject` (actual renderer/version), substantive `note`, saved `fixture` path and `artifacts` paths. Paths must point to existing files inside this workspace. For a pass, a current sampled specimen must exercise the named capability. If none exists, first add a context-checked witness.

```powershell
# Validate and append one record or an array; compute artifact/fixture hashes.
node scripts/gameplay-matrix.js record --input .ui-atlas/my-review.json
```

Reuse an artifact across multiple records only when it demonstrates each named unit. Distinguish mock evidence from production renderer evidence. Local browser notes remain local until exported; a focused packet is not an imported pass. Keep important fixtures/artifacts in durable project storage before relying on the ledger long term. Moving or deleting them invalidates their evidence.

Changes to source/contracts/mock code, fixture bytes or evidence artifacts invalidate passes. The source fingerprint is intentionally conservative and may invalidate unrelated reviews. Recheck affected evidence; do not rewrite its old fingerprint to make it current.

```powershell
# Integrity: source mappings, compiler samples, catalog freshness, boundaries, ledger.
node scripts/gameplay-matrix.js check

# Readiness: also require every applicable UI unit to be verified.
# Initially exits 1 because UI evidence is still missing.
node scripts/gameplay-matrix.js check --strict

# Tests of the matrix/Atlas tool, not proof of generated-game UI quality.
node --test tests/gameplay-matrix.test.js tests/ui-atlas.test.js
node scripts/dev-test/check-gameplay-matrix.js
```

If the core catalog drifts, regenerate it with `node scripts/core-game-catalog.js`, inspect the differences and rebuild the matrix. New source values without contracts become mapping gaps. Keep gameplay constraints, UI contracts, contextual witnesses and actual evidence together as the engine evolves.

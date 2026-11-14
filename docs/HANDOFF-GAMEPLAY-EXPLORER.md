# Gameplay explorer: resume prompt

Prepared 2026-11-12. Copy the prompt below into a new session in this repository.

---

Continue implementing the engine-driven gameplay scenario explorer in `C:\Users\conor\reality-fantasy-leagues`. Read `AGENTS.md`, `docs/PLAN-GAMEPLAY-SCENARIO-EXPLORER.md` and `docs/GAMEPLAY-EXPLORER.md` first. Reuse the existing implementation and frozen fixtures; do not restart discovery or replace the project with another named-recipe pilot.

The tool is for both a person testing manually and unattended automated campaigns. The eventual objective is to inspect arbitrary full engine specs, compose compatible fixture/action/presentation adapters, generate coherent situations, interact with real application views and record precise UX/coverage gaps. Five recipe fixtures are not five total game types. Unknown capabilities must remain explicit gaps, never a substitute lineup view. Source discovery, fixture generation, rendering, interaction, design review and user approval are separate milestones.

## Where we stopped

Chunks 0–2 are implemented: versioned v2 scenario documents, lossless v1 archives, recursive capability analysis, scoped dependency planning and source/frozen-baseline drift checks. Chunk 3's **headless core** now works, but Chunk 3 is not complete. The visible bench controls and production frames still use the v1 pilot.

Implemented core files under `tools/gameplay-bench/explorer/`:

- `document.cjs`: shared contexts, people, events, facts, games, roles, independent viewing marks, stores, history, presentation and provenance. Optional explicit context `format:{id:'survivor'}` is required by runtime generation; the compiler's `engine` context alone is insufficient. V1 migration retains the complete original.
- `analyze.cjs`, `planner.cjs`, `registry.cjs`: source requirements/dependencies. `runtimeSupport` separately reports bounded headless eligibility. The broad source graph still has unconnected declarations; do not mark those supported just because a core case runs.
- `runtime-profile.cjs`: explicit first executable profile. Post-draft ownership, roster/count decisions, basic picks, moment/survival/placement scoring, basic ranks, per-event participant and yes/no questions settled from results/moments. Unknown modifiers, stages, sports stat generation, custom rulebooks, transport faults and unreconciled snapshots are gaps.
- `runtime-data.cjs`: seeded context facts reused across games, deterministic identities, production historical setters, actual rulebook result validation and independent viewing marks. No DB, provider requests or replaced global clock.
- `runtime.cjs`: `open`, `resume`, `execute`; sessions expose `project`, `apply`, `snapshot`, `hash`, `checkpoint`, `fork`, `reset`, `export`, `dispose`. Whole-action rollback, explicit simulated clock, per-game answer stores, corrections across games, hash guards, bounded case sizes and pinned replay/checkpoint verification. Case results distinguish expected rejections, blocked adapters, bad fixtures and failed expectations.

Entry points:

- `node scripts/gameplay-bench.js execute --file=<scenario or saved result.json> --out=<new result.json> [--steps-file=<actions.json>] [--queries-file=<queries.json>]`
- `POST /__atlas/bench/execute` with `{input,steps?,queries?}` returns that same runtime's durable case result, independent of recorded data or ephemeral pilot sessions.
- `tools/gameplay-bench/runtime-client.js`, loaded on the existing bench, exposes stateless `window.__GAMEPLAY_EXPLORER__.execute(input,steps,queries,{signal?})`. This is a transport seam, **not an interactive v2 bench or an actual browser gameplay proof**.
- Existing generate/frames/commands/load/replay remain v1-compatible in `scenario.cjs`, `session.cjs`, `router.cjs`. Do not break them during the bridge.

Small backwards-compatible production changes pass explicit clocks through `gameView` lineup/pick reads, `pickWindow`, and `setPickEmPick` options (`now`). Defaults remain unchanged for ordinary callers. The legacy pick command now passes its existing scenario clock too.

## Next work, in dependency order

**Superseded ordering (2026-11-12):** the user adopted the plan's §6A revisions. Follow §6A "Progress" and "Suggested order". A, B, the first part of D, recipes and thirty-five breadth capabilities are done: side bets, season-long questions, head to head, weeks won, only-some-moments/hits, lives/co-op, shared points, drafts out of a hat, stakes/banks, settled-by-the-couch, races/cuts, phases, bounties, teams of players, parlays, multipliers, rollovers, whole-game moment questions, Weekly Calls, confidence picks, the weekly card, beat the bot, Outlast in reverse, the top scorer's twist, a captain, secret roles, a draft spread across tribes, a survival pool's mulligans and buyback, a pool's second pick, group slots, a pool that skips a night you've used everyone, an auction, mid-season waivers, the commissioner's waiver actions and stages (their first slice). 1,197 of 1,312 show specimens pass the runtime profile; generator proof-family-46, runtime core-runtime-27. The twenty-eighth found and fixed BACKLOG 53 in game-twists.ts (uncommitted). Open product bugs the explorer found, confirmed on the real routes and NOT fixed (the user decides): BACKLOG 56 and 57 (own pace: waivers by hand, carried lineups; `node scripts/dev-test/check-waiver-commissioner.js`), 60 and 61 (stages: a draft nobody can lock in, a later stage shown to someone behind; `node scripts/dev-test/check-stages-explorer.js`). Questions for the user: BACKLOG 54, 58, 62.

**Stages, first slice (the thirty-fifth, 2026-11-13).** Read the guide's "Capability: stages". In short: each stage is a game of its own in the definition (`<game>~<stage>`, derived by `explorer/stages.cjs` from the parent's spec on every read), so everything treats a stage as any game; the game's table is built from their tables as `answer-points.ts` `stageWalk` builds it; a later stage's draft is made the moment it opens, by the engine's own draft, from who's still in. Connected: two (or three) plain Weekly Lineups or Outlasts split at the merge or at an episode, the overall by points, made live (a whole staged game at its own pace has no door in the product yet: Start a game refuses a staged spec; when moves lock is the game's setting since 2026-11-13, set once on a game in stages: docs/PLAN-own-pace-games.md, "Pace is the game's setting". The explorer's live-only is live and strict, `core-runtime-28`; since 2026-11-14 the runtime is `core-runtime-29` (BACKLOG 56 and 57 fixed in the product: whoever runs a game at its own pace with exclusive teams acts at everyone's episode, and a carried lineup reads who the seat held for that episode; `known:waivers-own-pace-by-hand` and `known:carried-lineup-rewritten` are failures now, the lineup one per seat at own pace); a live game whose moves stay open late, the product's default now, isn't a timing here yet: its late moves need the routes' late path as actions, a capability to add). The handoff before this one said 19 specimens were this shape: 10 were.

**Next (2026-11-13, after thirty-five): a stage a format change starts** (9 specimens, nothing else blocks them; `node scripts/dev-test/profile-blockers.js` gives the totals):
- the specimens: a Weekly Lineup "Draft" stage and a "New draft" stage with `on: { change: [teams-formed, pairs-formed, split-into-individuals, merge, swap-all], again: true }`, `extras.changes: { ok: 'auto', unanswered: 'start' }`, overall by points (rolled from Below Deck: check the format they need before assuming Survivor's);
- what the server does (read these first, write path before read path): `src/lib/server/change-stages.ts` (the season sync settles it after every result and research answer: `settleSeasonChanges`; a copy of the stage is a league keyed `<stage id>@<the change's id>`, made mid-season, the stage before ended where it starts; a copy whose change a corrected report no longer says is taken away; the maker's answer through the stage-changes route), `StageLogic.changePlan` and `state.changeStages` in the engine, `formats/format-timeline.js` `stageTriggers`, and `db/format-timeline.js` `timelineForShow` (the stored research answers);
- what the runtime already has: stage games as games (`stages.cjs`: `expand` skips a stage with `on`, since its copies are made when the change comes: a copy is a game added mid-run, which the definition can't hold, so decide where copies live: likely the runtime's state, with the walk reading them); a world with pairs (`context.pairs`) whose research payload says the changes (`runtime-data.cjs` `researchOf`: a split into individuals, a swap), and the timeline built from it for group slots (`settleGroupsIn`);
- settle before building: which changes the generated world can produce (pairs give two of the five kinds), how a copy made mid-run is materialized (a league row made on a sync, not at `up`), and the maker's undo (an action).

After it: **bingo with trivia alongside** (13 specimens: bingo cards, then the trivia key, then the stage alongside), sports statistics (12 alone of 37; all need a generated sports world), the question tail (50 alone of 53, in 22 shapes: `--kinds`). And, blocking no specimen but found wanting by stages: **the draft room as actions** (every draft is generated; a draft open while its first episode airs is never played; the draft room's screens are never driven).

Tools this capability left for the next: `node scripts/dev-test/engine-controls.js` (the positive-control driver: temporary engine edits, restored and hash-checked; its header says how), `node scripts/dev-test/check-stages-explorer.js` (stages on the real routes, case by case) and `.ui-atlas/campaigns/stages-200c/` (`cover.cjs`, `control.cjs`, `controls.json`: copy and adapt).

A new family of mechanics: start a fresh session. Read the guide's "Lessons from the breadth program" before starting. Under §6A item 10's definition of done. Product gaps found go to the plan's "Designs needed" list for one batched design round (item 34 is next). The items below record what came before.


1. ~~**Finish Chunk 3's real browser/frame bridge.**~~ Done 2026-11-12 (Claude session): see the guide's [Bench bridge](GAMEPLAY-EXPLORER.md#bench-bridge). Then the same day the user chose real routes over hand-shaped responses: cases are materialized as local zt-gb- rows and frames read/write the real API (live tier). Remaining: multi-context frames, writes beyond lineups, picks, reveals, answers, side bets and calls (refused for now), and a policy for elapsed wall-clock time during long live sessions.
2. **Resolve snapshot reconciliation explicitly.** Some frozen v1 exported recipes differ from effective saved settings (resolved scoring weights, presets, disabled bets or pool filters). New runtime execution blocks supplied head snapshots instead of silently regenerating a different game. Original snapshots still work through the old pilot. Determine an explicit effective-spec/world migration policy with provenance before enabling them. Supplied custom rulebooks need their own adapter.
3. **Address the remaining cache requirement deliberately.** Facts are reused once per context within a case; branches/projections are isolated copies. Persistent cross-case caching is deferred. Prove actual-input/version keys, clone isolation, bounded eviction and privacy before adding it or claiming Chunk 3 complete.
4. **Chunk 4: three-case real interaction proof.** Done on real routes, 24/24 with 3 recorded findings (2026-11-12; see the guide's Chunk 4 proof section). `tests/fixtures/gameplay-explorer/runtime-proof.cjs` already constructs three unrelated full specs sharing a context: an explicit-weight two-starter lineup, three fresh picks, and a participant/yes-no question sheet. Headless tests exercise them, including a behind friend. Now use the real product surfaces for initial state, decisions, accepted/rejected saves, results, viewer switching, reveal and detail. Record missing product/driver behavior as reproducible failures. The shared quick pick editor's single-choice limitation remains a known product gap; direct commands do not fix or prove its UI.
5. **Chunk 4A: resumable campaign runner**: engine/state tier built and accepted 2026-11-12 (see the guide's Campaigns section). Still open: further tiers (projection/transport, live DB, browser), more generator families, deduplication and coverage-guided selection. Stable case IDs/independent seeds, pinned manifests, durable scheduling/checkpoints, bounded workers/watchdogs, cancellation, correct attempt/case accounting, reproducible failures/minimization. The headless case contract exists; the campaign scheduler does not. Test interruption/resume on small intentional runs. Do not start an enormous search campaign merely because the user wants this capability eventually.
6. **Chunk 5 and remaining plan:** build the usable explorer controls, then broaden capabilities in the plan's smaller subtasks. Follow the documented sequence rather than adding isolated named fixtures. Read the full plan for all later chunks.

## User experience/design requirements

Use **Intent for UX/strategy, Impeccable for visual craft, Perception-First Design for hierarchy** when building actual controls/views. Discover/read those skills from the local project setup; do not assume a skill was loaded if it is unavailable. Follow `docs/APP-REVIEW-DESIGN-BRIEF.md`, the Atlas and coverage matrix instead of rescanning the full app. The bench itself must be easy to operate, with semantic mechanic-specific controls; not everything has starters and a bench.

The app should be bold, beautiful and expressive through useful data, charts, art, GIFs and social behavior, while clear to casual watchers and deep enough for dedicated players. Avoid clinical redesigns, decorative slogans and cheesy game theatrics. Prioritize first-mobile-view relevance and direct drill-downs. Maintain real artwork and the animated TV guide when redesigning relevant host pages. Sports prioritize NFL, basketball and MLB but ultimately include all source-supported sports with appropriate fallbacks.

Own-pace play is the default; live-only is an explicit commissioner decision. Reveal advances only that person's viewing boundary across **all** games for the episode. Other people retain their own marks. Pending opponent choices/spoilers need actual production projection checks. Include overview/mini, quick decisions, full game, scoring/player detail, episode reveal and creation/wizard baseline. The wizard overhaul is separate work; current wizard inspection is not an interactive generated preview.

When the time comes for a new visual treatment, show **one complete reviewable page with relevant variants, then pause for user review before extending its theme**. No current new design is approved. Generate assets only when useful and tool access is verified; cache generated bytes/provenance for implementation instead of regenerating.

## Validation and current evidence

`tests/gameplay-runtime.test.js` has 13 focused tests: deterministic isolation, production saves/rejections, clocks before/after host date, question and draft/question settlement, result correction, own-pace/live-only behavior, shared reveals, stores/roles, setup histories, budgets/drift, checkpoint/fork/reset/resume and CLI/HTTP/browser-transport parity. Browser transport parity uses a VM + router in the unit test; **no Chromium gameplay proof was run this handoff**.

The milestone command passed **109 tests**:

```powershell
node --test tests/gameplay-runtime.test.js tests/gameplay-explorer.test.js tests/gameplay-bench.test.js tests/gameplay-bench-controls.test.js tests/gameplay-bench-sports.test.js tests/gameplay-matrix.test.js tests/ui-atlas.test.js tests/active-roster-lineups.test.js tests/game-view.test.js tests/own-pace.test.js tests/answers.test.js
```

After the final browser-transport/legacy-clock changes, the affected subset passed **44 tests**:

```powershell
node --test tests/gameplay-runtime.test.js tests/gameplay-explorer.test.js tests/gameplay-bench-controls.test.js tests/ui-atlas.test.js
```

Keep checks focused between changes and broaden at meaningful milestones, as the user requested. Do not repeatedly run the full suite without a new reason. Preserve the frozen baseline bytes/requirements; do not regenerate them to hide drift.

Full TypeScript checking was attempted. `next typegen` succeeded and cleared stale production route definitions, but `tsc --noEmit --incremental false` still reports one stale **development** cache error: `.next/dev/types/validator.ts(215,39)` imports removed `src/app/admin/shows/page.js`. No modified source-file type errors were reported. Do not claim a clean type check or create a dummy product page to satisfy stale cache. Refresh the dev-generated types when appropriate, without disrupting unrelated user work.

Read the relevant installed Next.js guide in `node_modules/next/dist/docs/` before writing Next code, per AGENTS.md. Do not assume older Next API conventions apply.

## Workspace/server state and practical cautions

- The workspace has extensive pre-existing uncommitted implementation, docs and assets. Preserve them. No commit, deploy or production DB write was performed for this core work.
- Atlas was restarted at `http://127.0.0.1:4400` and regenerated its source inventory. All **15** previous non-bench frame configurations were restored with their original origins; source drift was empty. The Next app was already running at port 3000. Process/session identifiers are ephemeral; discover current listeners before stopping anything.
- Temporary frame-resume metadata is `.ui-atlas/runtime-frame-resume.json`; it is not campaign progress. No campaign is running.
- For a quick self-contained run use `tests/fixtures/gameplay-explorer/questions-input.json`, which now includes the explicit Survivor format descriptor. Choose a fresh `--out` filename. Its generated actor/game IDs are `person-1`, `game-1`, and the next event is episode 3. Actions/queries are documented in the implementation guide.
- JSON stdout should stay compact; save full analysis/execution reports to files instead of dumping huge graphs. On Windows use apply_patch for non-ASCII content. PowerShell-to-Node pipes can replace non-ASCII with question marks. When using JavaScript string replacements, use callbacks if replacement text contains `$` sequences.
- Inspect existing exact API adapters in `session.cjs` and the frame proxy in `tools/ui-atlas/server.cjs` before designing the bridge. Use the matrix/source compiler for missing capabilities. The current broad registry and bounded runtime profile are intentionally separate; completing their composition remains real work, not a terminology change.

Begin with a short update, inspect the current bridge contracts and continue the first dependency-ready task. Do not repeat broad research or call the entire explorer complete because its headless proof passes.

---

End of copy-ready prompt.

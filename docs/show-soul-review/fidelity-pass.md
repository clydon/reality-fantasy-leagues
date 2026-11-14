# Higher-fidelity review

2026-11-10. Continuation of the art, company and clarity study. This pass uses Impeccable for visual design, Intent for flows and strategy, and Perception-First Design for perceptual hierarchy. The user wants faithful data and interaction states, meaningful new visual assets through Nano Banana, and small side-by-side choices where more than one direction is worth considering.

## Explicit user commitments

- Restore the animated TV guide. It may be on the hub itself or opened from a noticeable control at the top. Preserve the real rolling-week interaction and its reduced-motion behavior; a tiny unlabeled icon or a generic schedule list is not an equivalent replacement.
- The individual game page is a strong existing design. Preserve its useful graphs, data layout, season grid and drill-downs. Quick actions on an overview and a rich game page are complementary. Do not turn thousands of possible engine combinations into a few manually designed game templates.
- Other players' choices and picks are part of the social pleasure. Show them wherever the game's existing rules make them visible. A hidden pick must stay hidden until its actual visibility boundary; an interesting opponent comparison is not a reason to reveal it early.
- Review scoring comprehension and the create-game wizard as first-class flows. Explain a moment, its configured value and why it counted. Add a proposed playable preview before commitment: show the game's important screens with clearly labeled sample data, allow a sample choice and a scoring reveal, then return without losing setup edits. The eventual production preview must derive from the current GameSpec and use the same compiler/renderer; a separate collection of canned game previews would drift from the real combinations. Preview should not create a live game, notify a couch or reveal actual future results.
- Separate show-level cast/participant statistics from game-specific scoring. Lead with observed facts and performance on the main show's Players tab. Clearly labeled show-default points may remain optional. Inside a game, apply that game's rules and distinguish a participant's potential points from their counted contribution to a particular seat. Reuse the explorer with an explicit context instead of requiring two unrelated search interfaces. This is a review direction raised by the user, not approval of a production implementation.
- Use **NFL football** for this pass's sports example, replacing Formula 1. Sports overall includes what ESPN can provide: baseball, hockey, tennis, soccer and others. Individual sports can have their own presentation, with a generic fallback for the rest.

## Data and fidelity

The app's compiler is deterministic: it reads GameSpec dials through the grammar and produces the page's main block, controls, riders, locks, badges, tables and events. The runtime model adds viewer-scoped state. `GamePlays` carries different grid/block kinds, episode history and only the allowed next-move visibility. This is the design foundation; named game presets are examples, not the UI architecture.

The current compiler census covered 1,337 specs (rolled, fixture, sport and preset): 14 main-block kinds, 16 answer-control kinds and 92 used page places, with no undrawn places or compiler holes. It also identified nine places currently drawn from spec metadata rather than a corresponding runtime detail. Across 4,011 before/during/over sample models, it found no undefined, NaN or object-string output. These are compiler-coverage results, not evidence that all combinations are understandable or fun. See `scripts/dev-test/game-page-census.js`.

Prefer the actual app rendering and the actual generated-game compiler over another hand-written imitation of a game detail page. Recorded season facts, provider snapshots and engine-computed scores should carry provenance. Sample accounts and player decisions must be labeled as fixtures when they are fixtures. Keep private production identities out of the public repository and external generation prompts.

The local database has a loaded Survivor 49 season with 18 cast members and 421 accepted decisions. The existing blind-replay harness can play recorded season results through the real engine with deterministic fixture seats. It provides a stronger basis for comparing generated game shapes than invented scores. The local database also contains season-specific art URLs; use the appropriate season art instead of labeling a Season 50 poster as Season 51.

The first asset pass should fill visual gaps: an original backdrop without embedded show logos or fake UI, football atmosphere where appropriate, and a neutral entertainment/sports treatment where bespoke art is absent. Real show art, athlete portraits, team logos, charts, scores and controls should remain real assets or code. Image-generated mockups are optional directional aids, not evidence that a functional flow exists.

## Sport-specific presentation and fallback

Treat this as a shared event experience dressed by sport metadata. NFL can use teams, a football field, quarters and football metrics when the provider supports them. Tennis may use players, sets and rounds; baseball innings; soccer match time; hockey periods. Never synthesize missing detail to make a layout fuller.

The fallback uses event identity, participants, start time and the provider's available stat labels. It avoids a football field, team-only vocabulary, a forced two-team score or an assumed precise replay clock. If the event does not have adequate time-aligned data, explain the granularity honestly. Preserve separate score reveal and viewing position in every presentation, including dependent fantasy points, standings and commentary.

Games are offered from actual engine eligibility, not the mere existence of an ESPN event. The current NFL example is not a decision to specialize the whole app around football.

## Nano Banana readiness

The toolchain repair is complete for image generation: the Codex configuration was updated, tool discovery succeeded, the API's available models were checked, and an actual image-generation smoke check passed after the user enabled billing. See [Nano Banana setup and verification](../NANO-BANANA.md). The still-running agent can call the server through a local MCP client; native tool discovery requires reloading the Codex client.

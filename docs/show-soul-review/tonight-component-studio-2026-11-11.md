# Tonight component studio

**Historical first round.** The user found these alternatives too plain. The [bold round](tonight-components-bold-2026-11-11.md) is the current proposal. [Open this preserved first round](http://127.0.0.1:4400/?case=tonight.catchup&mock=tonight-components-r1); its files and choices remain separate for comparison.

[Open the interactive first-round comparison](http://127.0.0.1:4400/?case=tonight.catchup&mock=tonight-components-r1).

This bounded Impeccable study explores three components independently. Each has **three alternatives alongside its unchanged V4 original**, for twelve previews. Original means the V4 design currently under review; a separate **Open OG application** link opens the current app in the same Atlas case. No version has been approved or applied to production.

## Compare the ideas

| Component | A | B | C |
| --- | --- | --- | --- |
| Your place in the season | **Episode ticket:** a left-to-right handoff with the next episode on gold. | **Season rail:** released episodes establish where you are in the sequence. | **Up next, on screen:** show artwork leads, with last-watched context below. |
| Your couch's pace | **Shared season tracks:** everyone uses the same released-episode scale. | **Around your episode:** people grouped behind, with and ahead of you. | **Who's seen this?:** choose an episode to identify friends who have reached it. |
| Your game night | **The results desk:** a dense table comparing game-specific outcomes. | **Game spotlight:** switch games to see cast photography, contributions and permitted opponents. | **You and the couch:** choose a friend and compare results across games. |

The visual identity stays recognizable: Archivo's condensed display voice, dark ink surfaces, gold actions, seafoam results, show photography and cast/player faces. Alternatives vary hierarchy and layout rather than just border colors. Greater illustration/photography competes with compactness deliberately so the review can settle that tradeoff.

Every progress proposal has **one unified progress-update control**; watch and watched actions remain distinct and name their episode. The rail is a progress overview, not a second arbitrary-episode reveal mechanism. Live, caught-up fixtures omit the redundant watched action.

Pace compares viewing positions only. The episode selector does not change progress, reveal outcomes or screen freeform messages. Game comparisons use the same V4 captured metrics and sharing boundary. They do not sum incompatible scores or infer another player's revealed results from viewing progress. Hidden episode results lead to the existing all-game reveal confirmation.

## Use and reuse

Filter to a section to compare its original and A/B/C. **Choose** an option independently for each component, then open **Your mix** to see those three choices together. Choices persist locally; **Save choices** downloads a small JSON record for a future implementation session. This does not bake a design into app source or create a full-page production implementation.

The preview-width control supports 390px, 360px and available width. Progress, user, cast and score controls reuse V4's connected detail and return flows. Original components run the actual V4 renderer in independent viewport frames; their actions open the parent detail so they are not trapped in miniature dialogs. Alternatives share the active case's local V4 actions and state.

The registry supports watching-only, catch-up, reveal-ready, live, caught-up, saved and locked cases. Artwork is reused from the existing cache. No new bitmap generation was needed for these code-native compositions. The focused visual inspection covered Night theme at desktop and two phone sizes; it is not approval of every theme, dataset or generated-game structure.

## Evidence

Run `node scripts/dev-test/check-tonight-components.js` with app and Atlas running. The recorded pass covers twelve previews at 1440×1000, 390×844 and 360×700; choice persistence/JSON export; original-action bridging; episode-based friend filtering; game switching; score/cast return; unshared opponent results; episode-wide reveal confirmation; watching-only/locked states; and Atlas registration. It recorded zero browser errors, API writes or missing adapters in those checks.

Screenshots, selected-choice test JSON and `checks.json` live under ignored `.ui-atlas/tonight-components/`. Source lives in `tools/ui-atlas/mocks/tonight-components.*` and `tonight-component-original.*`; shared V4 files are reused unchanged. V1–V3 manifests still match their preserved files. The initial batched inspection and one confirmation completed the bounded visual QA pass. User review is the next design decision.

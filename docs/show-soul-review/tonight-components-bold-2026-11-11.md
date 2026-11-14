# Tonight components: the bold round

The user found the first component alternatives plain and uninspired. This round replaces those nine alternatives with more expressive compositions, while preserving their original V4 reference and a frozen copy of round 1. This is an Impeccable visual study awaiting review, not approval to apply it across the app.

- [Open the latest round in Atlas](http://127.0.0.1:4400/?case=tonight.catchup&mock=tonight-components)
- [Preserved first round](http://127.0.0.1:4400/?case=tonight.catchup&mock=tonight-components-r1)

## The design moves

| Component | A | B | C |
| --- | --- | --- | --- |
| Your place in the season | **The premiere frame:** real show art, opening-credit lettering and a clear next-episode slate. | **The episode splice:** a compact television guide cutting from last watched to next up and the following episode. | **Your season passport:** a printed show-specific watch record with a last-watched stamp. |
| Your couch's pace | **The viewing lounge:** an illustrated couch with a seat, face and episode badge for each visible friend. | **Different chapters:** bold episode posters group friends by their actual position. | **Who's seen this one?:** a tuner changes which portraits have reached a chosen episode. |
| Your game night | **The score broadcast:** a continuous entertainment scoreboard with game-specific outcomes, picks and comparisons. | **Cast in the spotlight:** photographed contribution posters make each starter's result tangible. | **Friendly competition:** split-color player portraits anchor a human matchup across games. |

The strongest initial candidate combination is premiere frame + viewing lounge + cast spotlight. The alternatives deliberately expose density and expression tradeoffs. Some are taller than the original compact components; choosing three independently is not proof they fit Tonight's first-viewport requirements together. Fit and content reduction belong to the next composed-page review after the user chooses a direction.

## Craft and behavior

This remains the app's visual vocabulary: Archivo's condensed display forms, ink, gold, seafoam, authentic show/cast photography and the cached TV companion. The couch is an authored SVG illustration. No new bitmap generation was needed or claimed. Nano Banana tools were not exposed in this session; previously cached artwork was reused.

The key motion is a short broadcast score reveal: captured numeric values count into place and comparison channels wipe on entry. Replay uses the original captured value even if triggered during an existing animation. It does not change scores or reveal another episode. Reduced motion renders the final facts without the count or wipe. There are no decorative loops or timed chapter advances.

Each season alternative has one progress-update control. Last/next are not separate buttons that open the same picker. Watch and watched actions name their target episode; the redundant watched action is absent in the live, caught-up fixture.

Viewing positions stay separate from game visibility. The tuner only compares episode marks. Unknown game results remain hidden even when someone has watched further. The reveal gate retains the all-game consequence. Game metrics are never added across incompatible scoring systems. Lineup posters, pick faces and scores open the existing V4 detail flows and preserve return context.

The studio's choice keys and exported JSON identify `bold-round2`, so an earlier round's option A cannot silently become this round's A. **Your mix** and **Save choices** remain available. The first round is frozen in `tonight-components-r1.*`, with a hash manifest; the nine bold alternatives live in `tonight-components-bold.*`. The shared studio accepts a direction renderer, allowing another review round without duplicating its data and interaction controller.

## Evidence and limits

`node scripts/dev-test/check-tonight-components-bold.js` passed for twelve previews at 1440×1000, 390×844 and 360×700, with no horizontal overflow, browser errors, API writes or missing adapters in the checked flows. It covers unified progress controls, actual couch/profile interactions, tuner changes, game switching, cast/score drill-down and return, protected opponent outcomes, persistence/export, result motion/reduced motion, all-game reveal confirmation, watching-only/locked states, Atlas switching and preserved round-1/V1–V3 hashes. All nine Atlas unit checks passed as well.

Screenshots and `checks.json` are saved under ignored `.ui-atlas/tonight-components-bold/`. One batched inspection and one confirmation completed the visual pass. This verifies representative Night-theme fixtures; it is not a sports-specific review, exhaustive engine coverage, measured user delight or user approval.

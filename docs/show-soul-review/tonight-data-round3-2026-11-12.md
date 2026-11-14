# Tonight: data and connected detail, round 3

[Open in Atlas](http://127.0.0.1:4400/?case=tonight.catchup&mock=tonight-data-r3).

This round follows the user's correction: keep the liked cinematic season overview A, focus its redesign on the actual Update popup, explore shared viewing timelines, and make Game night exciting through data rather than theatrical presentation. It is a component study awaiting review; it does not replace the production pages.

## What to compare

The page has twelve comparisons: the current reference and three alternatives for each component. **Kept: season overview A** expands the liked overview, whose Update control opens the selected episode-picker option. Each alternative also opens its corresponding actual popup or expanded detail.

| Component | A | B | C |
| --- | --- | --- | --- |
| Update episode popup | **Episode ledger:** grouped watched/ready/upcoming rows, title/date search and a selected watched-through boundary. | **Release calendar:** release-date tiles with watched and selected states. | **Viewing scrubber:** a native slider, before/after last-next preview and an optional episode list. |
| Couch viewing pace | **Shared episode axis:** aligned positions with self, friends, latest release and next airing. | **Viewing matrix:** episode columns, people rows, watched cells and explicit position/airing marks. | **Release timeline:** calendar-scaled releases with people anchored to their actual episode dates. |
| Lineups and results | **Expandable lineup ledger:** visible starters in each player summary; expand contributions and bench. | **Contribution comparison:** two real lineups on a shared signed points scale, with starters, exact values and scoring detail. | **Lineup matrix and trend:** starter selections/points by player, plus a real episode-points chart and exact-value links. |

These are functionally different data arrangements, not color variants. The expanded versions use the same representation with additional history, players, starters and bench information. No view sums different games' scoring systems.

## The connected flows

Episode selection remains a **draft** until Review update and Confirm. The review states the resulting watched-through and next episode, warns about eligible unsaved decisions where available, and says game reveal state is unchanged. Future episodes cannot be selected. A viewing update never calls the production API or advances local game-reveal marks. The scrubber supports pointer and keyboard adjustment without recreating its input during a drag. A not-started position has an appropriate first-episode game state.

An episode mark on any pace view opens a position detail listing who has reached it and who has not. A person opens their profile; Back returns to the episode position and then the same timeline. Expanded timelines cover the full recorded season. The matrix can scroll horizontally in that detailed view; its overview shows the relevant released/next range. Viewing marks never unlock a friend's game data.

A lineup summary retains the actual starter portraits and score while contributions can collapse. The comparison option includes another eligible player's **actual lineup**, not just their total. Episode switching exposes captured negatives as well as positives. Bars share a points domain and negative values extend to the left of zero. Zero contributes no filled bar. The trend chart uses real episode coordinates, a real signed scale, distinct series colors and an exact-value disclosure.

Starter/bench contributions open a scoring inspector with a cast portrait, counted/excluded status, exact contribution and captured reasons. Matrix-style inspection also shows that cast member's earlier starter/bench history in this lineup. Cast and player details retain their existing V4 destinations. Back restores the originating score/comparison and its native disclosure state. Bench points stay excluded from lineup totals. When the capture lacks per-moment allocations, the combined contribution remains explicit rather than assigning invented values to reasons.

The all-game reveal gate is retained. On the reveal-ready fixture, no lineup portraits or outcomes are displayed before confirmation. The fresh recorded reveal remains bounded to episode 3.

## Visual direction and implementation

Impeccable is applied in Operate mode: useful alignment, recognizable cast photography, clear selected states, signed scales and readable hierarchy. Gold identifies the viewer/selection; seafoam identifies shared results; restrained additional colors distinguish chart series. Normal data labels use the UI face rather than theatrical display lettering. Motion is a short bar-representation wipe on entry; final values are already present, and reduced motion removes the wipe. Existing cached art and photos are reused; no new generated assets are needed for code-native charts.

Source is `tools/ui-atlas/mocks/tonight-data-r3.{html,js,css}`. The V4 controller now exposes optional review callbacks and a storage prefix; its default render and episode flow remain in place. The original episode body is reused directly. The new study uses its own `tonight-data-r3` browser-state prefix, including its original-reference frames, so it does not overwrite prior V4 actions. **Choose**, **Your mix** and JSON export save the component decisions for future sessions. Earlier rounds remain available.

The recorded pilot has two lineup games and a survival-pool fallback, four people, and thirteen scheduled episodes. Episode titles are absent in this capture, so the UI uses episode numbers with actual dates. Other families retain their existing structural mini when selected; this is not a new lineup visualization for every generated game shape. The viewing schedule is the captured fixture, not a claim about the current real broadcast schedule.

## Verification and review gate

`node scripts/dev-test/check-tonight-data-r3.js` passed at 1440×1000, 390×844 and 360×700, including all twelve previews and three variants each of episode popups, expanded timelines and expanded lineup comparisons. It covers draft/review/cancel, disabled future episodes, search and scrubber, retained overview A, episode/person return, starter/bench scoring paths, cast return, protected opponent lineups, negative points, progress/reveal separation, all-game reveal confirmation, watching-only state, saved choices/export and Atlas registration. No browser errors, production writes or missing data adapters were recorded in those flows.

The existing V4 browser checks also passed: nine viewport/case combinations and fifteen connected-flow checks. All nine Atlas unit tests passed. Screenshots and JSON evidence are cached under ignored `.ui-atlas/tonight-data-r3/`. One batched visual inspection and one confirmation were used; no new usability-study result or approval is implied.

Pause for component review before composing the selected versions into Tonight and evaluating their combined first-mobile-viewport density.

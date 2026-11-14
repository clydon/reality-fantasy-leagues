# Tonight, in your situation

2026-11-10. Review **Tonight only** before extending this design to other pages. Work on the other screens remains paused until the user requests changes or says to continue.

The previous compact pass retained too much of the original content and omitted the participation and pace branches. It is superseded by the [content contract](tonight-content-contract.md) and this situation-aware proposal.

Open [Tonight A/B](http://127.0.0.1:4303/#tonight). The situation selector lives outside the phone and is a review control, not a product mode switch. A remains the current live fixture as a reference; it is not a matching backend persona for every B scenario.

| Situation | Review |
| --- | --- |
| Playing live with friends | [Decisions, summarized saved choices, watching and social context](http://127.0.0.1:4303/?scenario=live#tonight) |
| Watching only, behind | [Next episode, watch/update progress, friends and GIFs](http://127.0.0.1:4303/?scenario=watcher#tonight) |
| Playing at own pace | [Personal episode and Pick → Watch → Reveal](http://127.0.0.1:4303/?scenario=pace#tonight) |
| Watching an older season | [Continue without an airing deadline](http://127.0.0.1:4303/?scenario=archive#tonight) |
| Solo play | [Personal streak, without a first-of-one leaderboard](http://127.0.0.1:4303/?scenario=solo#tonight) |
| Caught up while still airing | [Plan the next airing; chat/react to the last watched episode](http://127.0.0.1:4303/?scenario=caughtup#tonight) |

## The content change

Full episode outcomes and score breakdowns, repeated saved-move cards, cast-stat podiums and the grid of every game leave the overview. Named entries open recap, saved choices and games. The established five tabs remain. In the six-game live fixture, two required decisions stay visible while lineup and bingo become one ready-summary entry. Watching-only has no game checklist. An optional one-episode pick does not turn the watcher into a full-season player.

Intent governs those content branches and return paths. Impeccable retains real show art, bold condensed type, the angled action plate and expressive reaction imagery. The [PFD derivation](perception-first.md) governs grouping and attention order. The saved Nano Banana TV illustration supports the optional game invitation; the saved island atmosphere supports the watch companion. No existing image was regenerated.

## Verification

`node scripts/dev-test/check-tonight-content.js` checks six situations at both **390×844 and 360×700**, plus pick/stats/return, clock pause/return, one-episode reveal, a shared friend-chat episode, the original live pick editor and the desktop board: **18 captures**, no browser errors or horizontal overflow. Necessary watch/decision controls and friends/personal-progress entries are above the tabs in all twelve overview captures. Full results and stat detail do not occupy the overview. Comparison captures wait for A's real content instead of taking its loading skeleton.

Evidence: `captures/fidelity-2026-11-10/tonight-content-checks.json` and `screens/content-*.png`. This is functional prototype verification, not a usability study or accessibility certification.

## Data and interaction boundary

Show art, cast, moments, episode results and existing game scores come from the recorded local Survivor 49 fixture. Participation, completed/airing status and differing friend/viewer progress are explicit review scenarios. B filters its displayed facts and episode results to the scenario mark; the underlying read-only session is still the live fixture through Episode 6. Production requires server-scoped reads for the actual viewer; this client prototype is not a new permission guard.

Live required moves delegate to the existing application editors inside a review frame. Scenario picks, clocks, chats, reactions, plans and progress operate in page memory, with no app writes. Historical lineup scores remain engine results; a trial pool pick's displayed survival outcome comes from the recorded elimination, not a new engine game. The complete rule-driven engine and production state eligibility are not reimplemented in this page.

The prototype sources and existing captures remain available for the next review. Other board destinations are retained earlier studies, not newly completed redesigns.

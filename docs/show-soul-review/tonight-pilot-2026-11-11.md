# Tonight: your episode, your people

**Preserved as V1.** The [V2 revision](tonight-v2-2026-11-11.md) responds to feedback about episode ambiguity, date-led actions, recap recognition and the default timing policy. Use the atlas's Design version dropdown to compare OG, V1 and V2. This document records the original pilot rather than the current proposal.

Review scope: one proposed Tonight page, watching-only and multiplayer catch-up variants. Production pages and full game renderers remain the current implementation. Awaiting the user's visual and flow review before extending this direction.

## Intent: purpose and journeys

The person needs to recognize where they are in the season, continue watching, react to the episode they just watched, and optionally make game decisions. Friends can be at different episodes. The same page adapts to actual participation; no product mode switch is introduced.

| Journey | Overview | Detail | Return |
| --- | --- | --- | --- |
| Continue watching | Last watched and next for you, date first; watch-along and mark watched | Episode selector or personal companion clock | Position and clock are retained locally |
| React and talk | Two expressive GIF reactions from the last watched episode, add/change GIF, conversation | Cached GIF picker or episode thread | Own GIF and draft messages stay with that episode |
| Check friends | Faces and explicit ahead count | Last-watched dates for each person | No later episode outcomes appear |
| Make a quick choice | Familiar game names, pick/set actions, saved status; Pick → Watch → Reveal | Cast selection, optional observed-stat disclosure | Draft selection survives disclosure and closing/reopening |
| Study or reveal a game | Full Games destination and per-game links | Current application game page with existing graphs, permitted picks and rules | Proposal remains open in its own tab/frame |

The game experience keeps its familiar selection model. Tonight summarizes decisions and provides quick entry; it does not become a replacement game dashboard. Watching progress and game reveal progress remain distinct. Marking watched asks about unsaved choices and never reveals outcomes automatically.

## PFD derivation

The five-layer framework is a practitioner synthesis; the requirements below are applied design hypotheses, not measured findings about this app. The research references follow the framework's [citation standards](https://github.com/skovalik/perception-first-design/blob/main/skills/pfd/references/citation-standards.md). Earlier research grounding is retained in [perception-first.md](perception-first.md).

1. **R1 · Cognitive load.** Reconciling several episode numbers across games and watching consumes attention. One grouped control must distinguish last watched from next for you. Games summarize only their decisions. **Citations:** Cowan (2010) for working-memory limits; Sweller (1988) for extraneous task demands, as referenced by the [PFD framework](https://github.com/skovalik/perception-first-design/blob/main/framework/PERCEPTION-FIRST-DESIGN.md).
2. **R2 · First impression.** Removing show identity and reactions weakens the reason to visit. Recognizable art and expressive GIFs must share the opening with necessary actions. **Citations:** Lindgaard et al. (2006) for rapid visual-appeal judgments; Leder et al. (2004) for aesthetic appreciation. Neither proves comprehension in 50 milliseconds.
3. **R3 · Fluency.** Number-only labels require recall. Date/title-led episode controls must retain episode numbers as secondary identifiers and consistent watched/saved/hidden signals. **Citations:** Forster, Leder & Ansorge (2013) for subjective processing fluency; the episode-label choice is a product-specific application.
4. **R4 · Expectations.** A watcher must encounter a complete social viewing experience. Game participation must add relevant decisions without displacing watching or requiring an identity choice. **Citations:** Clark (2013) for predictive processing as a theoretical model. This requirement also follows the user's explicit brief.
5. **R5 · Decisions and return.** Reacting, choosing and watching must lead to useful feedback and preserve place. Full analytical depth must stay reachable. **Citations:** Trope & Liberman (2010) for concrete near-term language. Selection persistence is an interaction requirement derived from the journeys, not a directly tested research claim.

## Impeccable: surface direction

Operate mode, existing Archivo/broadcast typography, Night and Studio palette families. Recompose Tonight rather than replacing the app-wide design system. The user authorized a concrete page proposal before another approval round, so the concept tournament is not a prerequisite to this build. The optional surface seed ran with the roll service unavailable; no external challenger boards were produced or claimed.

Considered structures: (1) next-episode hero, (2) reaction wall first, (3) compact viewing position followed by quick decisions and reactions, (4) timeline, (5) split watch/play panels, (6) a conversation-first feed, (7) game-first action queue. The third structure carries the proposal: episode context stays explicit, ordinary game controls remain recognizable, and the GIF wall becomes the visual payoff. The watcher variant expands that payoff into the space games do not need.

Composition: a short, art-led show header; a two-part viewing control; friends' pace; compact game decisions when applicable; watch actions; last-watched reactions and conversation. Full recap and game analysis open from named destinations. Typography stays readable, controls stay visible, and no horizontal action carousel is required.

Reused existing cached Archivo font, KLIPY GIFs, show/cast imagery, and Nano Banana island scene. No images were regenerated. Ordinary icons are SVGs from the installed Lucide library. GIFs have pause/play and poster behavior, including reduced-motion defaults. The social fixture and asset provenance are stored beside the mock.

## Data and simulation boundaries

- Reads the selected case's effective `/__atlas/data` projection. Both variants use the same renderer; the fixture's participation determines whether games appear.
- The recorded schedule has dates and null titles. Render dates honestly; the control supports a title when present. The dates belong to the local fixture, not a verified historical broadcast calendar.
- The captured fixture has no reactions/messages. The named social fixture supplies illustrative activity only for the initial last-watched episode. It never appears as a captured production conversation.
- Game choices, messages, likes, GIF selection, watched position and companion clock persist only in the current browser. No application mutations occur.
- Eligible cast IDs come from the effective pick/roster projection. Future elimination flags, standings and scores in partially derived fixtures are not rendered in the quick selector. This is a presentation guard, not permission/security certification.
- The stats disclosure counts captured show moments through the initial viewing boundary. It does not invent predictive confidence or fantasy values. Full analysis and player decisions remain in the current game page.
- Game reveal is a handoff to the existing game page; later result data is not loaded into this mock. Watch-along is a personal clock and does not claim group synchronization.
- Duplicate fixture lineup names get A/B suffixes for review identification. A production solution should use distinct user-defined game names or another established disambiguator.

## Review links

- [Watching only beside current](http://127.0.0.1:4400/?case=tonight.watcher&mock=tonight-pilot)
- [Playing with friends beside current](http://127.0.0.1:4400/?case=tonight.catchup&mock=tonight-pilot)

The atlas and local app must be running. Select **Tonight redesign · your episode & reactions** under Mock alongside if the query is absent. Use 390×844 and 360×700. Local interaction changes can be reset under About this design preview.

## Verification

The bounded browser pass exercised both initial variants at 390×844, 360×700 and 1100×900, with no horizontal page overflow or broken images. Episode controls, every quick game decision, watch actions, Add a GIF and the direct episode-chat control are above the navigation bar in both phone fixtures. The full reaction wall and conversation preview can continue below the smaller screen.

Checked friend progress, draft selection persistence, optional statistics, local pick/lineup saves, preserving a committed pick while editing a draft, focus return, GIF search/selection, likes, escaped local messages, companion-clock return, watched confirmation and full-game reveal handoff. The atlas opens the requested proposal from a shareable link and retains it when switching between the two supported cases. No mock writes to application APIs; no browser errors were reported.

Additional checks use explicitly synthetic long episode titles in Studio and 150% enlarged text to check wrapping. These titles are test inputs only. The final Studio contrast correction was confirmed from computed styles. Atlas unit checks pass (8/8). These checks do not establish usability, spoiler authorization correctness, full-game engine correctness, group watch synchronization or production readiness.

Saved captures and interaction evidence: `.ui-atlas/tonight-pilot/`. Rerun the bounded check with `node scripts/dev-test/check-tonight-pilot.js` while the app and atlas are running.

## Decisions

### 2026-11-11 · Last episode means last personally watched
- Decided by: user direction, applied by Codex.
- Why: reactions to the latest broadcast would be irrelevant or reveal later content for someone behind.
- Rejected: showing the latest released episode's reaction wall to everyone.
- Rests on: the latest request and the viewing-boundary requirements in APP-REVIEW-DESIGN-BRIEF.md.

### 2026-11-11 · Full analytical games retain their existing renderer
- Decided by: user direction, applied by Codex.
- Why: the user likes the current detailed game experience and wants Tonight to remain a quick overview.
- Rejected: rebuilding graphs, standings and complete game play inside Tonight.
- Rests on: the latest request and the individual-game-page requirements in APP-REVIEW-DESIGN-BRIEF.md.

*Initial findings. Ralph Loop a requirement, cite further, switch to analyze / evaluate, or ask any follow-up to dig deeper.*

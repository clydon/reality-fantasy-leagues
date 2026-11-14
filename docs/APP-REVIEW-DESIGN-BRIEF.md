# Game Your Show: full-app review and mock brief

## The assignment

Review and redesign the app’s screens **and the flows connecting them**. Produce a cohesive, visually ambitious, interactive mock that makes the app simpler to understand while preserving its entertainment, social character and analytical depth.

The central problem is that real users describe the app as overwhelming and confusing. Address the amount of information, its organization, the sequence of decisions and the relevance of each screen to the person using it. Changing artwork, tightening spacing or reducing card sizes alone does not fulfill this assignment.

Treat this as a fresh design brief, while reusing the existing research, screenshots, mockups, assets and working components. Earlier proposals are reference material, not an approved design system. **No proposed redesign should be assumed approved simply because it exists or passes automated checks.**

The immediate deliverable is a review/mock, not an automatic production rollout. Programmatic and architectural changes are welcome recommendations when they improve the experience; distinguish them from behavior actually implemented in the mock.

## What the app should feel like

Beautiful, intuitive, expressive and enjoyable. A place people want to open because their shows, sports, friends, reactions and games are there.

Show artwork, cast and athlete photography, bold television graphics, GIFs, movement and social moments provide character. Preserve their importance. Their execution may be refreshed or completely reimagined; the goal is not to preserve every existing visual element pixel for pixel.

Clarity should come from a strong hierarchy and useful disclosure, with enough visual excitement to make participation satisfying. Avoid a clinical dashboard or a generic collection of utility cards. Equally, decorative spectacle must not bury the current episode, a necessary decision or the people someone came to see.

Create pleasure through recognizable shows, anticipation, expressive reactions, visible choices, useful feedback and the payoff of playing with others. This is an experiential goal, not a claim that the design has measured a dopamine response.

## Who the experience must serve

| Situation | A complete, satisfying experience |
| --- | --- |
| Watching without playing | Follow shows; track personal progress; see what friends watch and where they are; chat, react and watch along. A game is never required to make this use worthwhile. |
| Occasional participation | Try a single episode, a quick gut pick or a small game without inheriting the complexity of a full-season commitment. |
| Solo play | Play for fun, a streak or personal progress. Avoid meaningless competitive presentation such as “1st of 1.” |
| Multiplayer | Make decisions, see permitted opponent picks, enjoy results together and understand differences in progress. |
| Serious play | Inspect metrics, rules, scoring, histories, comparisons and other players’ decisions to make informed choices. |
| Commissioners and operators | Set up and maintain games and show data without the management workflow overwhelming ordinary watching and playing. |

These are overlapping situations, not permanent user categories. The same person may watch one show, play a casual game on another and analyze a third in detail. **Do not add a required casual/expert or watcher/gamer mode switch to the product.** Adapt to actual participation and state.

## AI skills and visual tooling

Use these three skills together throughout the work. They have different responsibilities, but must inform one coherent experience.

| Skill/tool | Responsibility | How it should affect the work |
| --- | --- | --- |
| [Intent — ghaida/intent](https://github.com/ghaida/intent) | UX design and strategy | Establish the person’s goal, screen purpose, content hierarchy, information architecture, decision sequence, states, consequences and return paths. Use relevant specialties such as Journey and Organize. Challenge whether content belongs on the overview at all. |
| [Impeccable](C:/Users/conor/.claude/skills/impeccable/SKILL.md) | Visual and interaction design | Create deliberate composition, typography, density, color, artwork treatment, icons, motion and responsive behavior. Make the app feel distinctive and polished without sacrificing readability or discoverability. |
| [Perception-First Design](https://github.com/skovalik/perception-first-design) | Perceptual hierarchy and decision structure | Derive requirements before choosing a layout: cognitive load, first impression, processing fluency, fit with the person’s expectations, and the path to the next action. Evaluate what someone notices and understands first. |
| Nano Banana MCP | Supporting visual assets and visual exploration | Generate or edit distinctive illustrations, atmospheric assets, decorative graphics and optional mockup alternatives where they materially improve the app’s identity. It supports the design decisions; it does not replace UX reasoning or functioning interface code. |

Read the actual relevant skill instructions when applying them; naming the skills in a report is not sufficient. User requirements and already settled decisions take precedence over generic skill exercises. Do not restart a discovery questionnaire when this brief already supplies the answer.

The skills may be applied in parallel to critique a proposal from different perspectives. Reconcile their recommendations before presenting the page. An attractive composition that loses the watcher’s flow, or a clear task list that removes the app’s character, needs another design decision.

Use real, consistent, crisp icons for navigation and actions. Custom artwork and branded illustrations can add personality where appropriate. Do not rasterize ordinary controls or generate charts, scores, participant identities or interface text that should come from real data and code.

Codex and Claude Code have project guidance for the Nano Banana connection in [AGENTS.md](../AGENTS.md); setup and verification are documented in [NANO-BANANA.md](NANO-BANANA.md). Verify tool availability before claiming a generation succeeded. Do not make switching assistants part of the design process unnecessarily.

## The main design rule: overview first, depth on demand

Categorical overview pages should make the current situation and relevant next actions understandable in the **first mobile viewport**. Someone should not have to scroll through a large identity block, detailed results or repeated game cards to find what they need to do.

Every overview should answer:

1. Where am I: which show/event, episode, personal progress and viewing boundary?
2. What matters now: a viewing opportunity, required decision, saved choice, waiting state, result or relevant social activity?
3. What can I do next, and where is the deeper information?

Achieve this through **content selection and hierarchy**, not just smaller components. Remove repeated detail from the overview and give it an obvious destination. Summarize saved choices together when individual cards would crowd out more relevant content. Bring the watching and social experience forward instead of adding it below every game summary.

Keep controls and text comfortably sized: neither oversized sections nor subtle links people miss. Use readable supporting text and accessible touch targets. Keep essential work out of sideways-only carousels.

**Every overview must provide contextual drill-down.** People, cast members/athletes, teams, games, scores, result summaries and other entities that have deeper information should open that information directly from their simplified representation. Do not make someone hunt through tabs or repeat a search for an entity already on screen. Preserve the originating episode/game context, filters, scroll position and unsaved selections; provide an obvious return. Keep each detail within the same permissions and viewing/reveal boundary as its source overview. (User direction, 2026-11-11.)

The entire app does not have to fit on one screen. Detailed game pages, statistics, histories and substantial forms can scroll. For unusually large action lists, show an explicit, accurate “Review all N decisions” entry rather than silently omitting work or squeezing everything into tiny rows.

Use 390×844 and 360×700 as initial phone review sizes, then check relevant responsive and large-text behavior. Do not use clipping, hidden overflow or artificially fixed page heights to make a screenshot appear to pass.

## Keep the established structure

**Main hub → individual show → Tonight / Past episodes / Games / Players or Cast / Chat.**

Use the show or sport’s own vocabulary where it improves understanding. A sport may have events, matches or rounds instead of episodes, and athletes or teams instead of castaways. Keep navigation recognizable across those variations.

| Surface | Its overview should prioritize | Detail that should remain available |
| --- | --- | --- |
| Main hub | Personal shows and viewing context, important actions across shows, friends/activity, Add, and the TV Guide | Full guide, couch management, activity, rankings and other deeper destinations |
| Tonight | Personal next episode/event; relevant watching or game actions; social context; a compact last-viewed summary | Move editors, companion clock, progress/reveal, recap, full game results and friend progress |
| Past episodes | What is watched, next, hidden or unavailable; useful episode navigation | Full episode recap, moments, reactions, conversation and permitted game outcomes |
| Games | Clear ways to start/join; concise existing-game summaries and necessary quick actions | Rich individual game pages, standings, histories, rules and player decisions |
| Players / Cast | Recognizable participants, search and understandable show-level facts | Participant history, comparisons, filters and detailed statistics; explicit game-scoring context where appropriate |
| Chat | Which conversation/episode this is, viewing boundary, messages, GIFs and an obvious composer | Older threads, message actions, reactions and deliberate access to newer conversation |

### Tonight composition, clarified 2026-11-11

Tonight is the living detail of the person's latest episode, closely related to drilling into an episode from Episodes. Preserve this order:

1. Show/season identity and artwork.
2. One unified viewing-progress control: last watched, next episode, behind/caught-up/live status and the next release when relevant. Last/next are parts of one control, not separate buttons that open the same chooser.
3. Visible friends' viewing positions, with names/faces and actual episode marks. The group opens a fuller pace view; each person opens their own detail directly.
4. Start watching now via watch-along, or mark/update watched progress. Avoid a redundant watched/update action when caught up and the next episode is live. The progress chooser remains accessible.
5. The last watched episode's visual recap, GIF reactions and discussion, keeping already-posted GIF state explicit.
6. A game-update section with a structural mini for each game: last pick/outcome, lineup and scored contributions, predictions, card/team result or other appropriate summary. Include permitted other-player outcomes. Offer compact and richer mini concepts for review; retain direct paths into player, participant, contribution and game detail.

A **small but unmissable top strip** tells a player which required decisions are due, or that all games are ready for the next premiere/event. It opens the quick-action experience rather than filling Tonight with every pick/lineup/prediction editor. Those editors may be bold, expressive and useful because they receive their own focused space. Use authoritative eligible-action data during production implementation, including live-only deadlines and prerequisites.

Use meaningful motion for game updates: result numbers settle and comparison bars build when the mini enters view. Keep final values available without animation and honor reduced-motion preferences. The reveal is the main visual storytelling moment; normal progress and decision controls stay responsive.

Restore and retain the **animated TV Guide**. It may be inline on the hub or opened from a noticeable, clearly recognizable control near the top. A tiny unlabeled icon or a static generic schedule is not an equivalent substitute. Respect motion preferences and preserve useful guide interaction.

The complete review also inventories connected screens: onboarding and accounts, show discovery, following and progress, couch creation/joining/invitations, game creation and joining, drafts, picks, lineups, replacements/waivers, reveals, sharing, notifications, settings, commissioner workflows and operator tools. Make their coverage explicit rather than treating the six top-level destinations as the entire site.

## Participation, pace and lifecycle change the content

For the Tonight pilot, emphasize GIF responses and reactions to the person's **last watched episode**. Provide a clear viewing-position control showing the last watched episode and the next episode. **Use Episode N plus its title when available; dates are secondary.** Put the target episode on watch/mark-watched buttons and game decisions, so actions for the next episode cannot be mistaken for the last episode. Use relative labels such as “last week” only when they accurately match that person's viewing context. Add a compact, boundary-safe recap to jog memory before reacting. Distinguish “No GIF from you yet” from a posted GIF, with the person's GIF and a Change action. Name destinations “Discuss episode N” and “Episode N recap,” rather than date-only actions. Never invent absent titles or outcomes. Keep the game experience familiar and use Tonight for quick decisions, with the Games tab and individual game pages providing the full experience. The user explicitly permits completely reimagining these page compositions. (User direction and V1 feedback, 2026-11-11.)

**Playing at personal pace is the default product policy.** Anyone on a couch should be able to pick before watching and reveal afterward, using the honor system. The commissioner/game maker can explicitly choose **Live only** per game for shared deadlines and stricter competition. This is a per-game restriction, not a couch-wide watcher category or a special catch-up mode requiring permission. Surface the restriction when present; do not badge ordinary games or an entire couch as “At your pace.” Individual watched and per-game revealed progress stay distinct. Record any gaps between this direction and existing engine defaults rather than implying a visual mock has changed server behavior. (User clarification, 2026-11-11.)

Watching pace and participation are separate dimensions. Airing versus completed seasons are separate again. Do not equate “own pace” with an old season, or “airing” with everyone being caught up.

| Representative situation | Tonight’s emphasis |
| --- | --- |
| Watching only, behind | Personal next episode, Watch along, I watched it, friends’ progress, appropriate chat and reactions; optional game discovery |
| Playing live with others | Actual due decisions and deadlines, summarized saved choices, watching/planning, friends and a concise last-episode result |
| Playing at own pace on an airing season | Personal next episode and Pick → Watch → Reveal; clear per-game consequences; friends may be ahead or behind |
| Watching or playing an older season | Continue at personal progress; no invented upcoming broadcast deadline; the same social and analytical capabilities remain useful |
| Solo play | Personal progress and decisions, with optional social entry; no compulsory leaderboard framing |
| Caught up while a season is still airing | Waiting for the next release, planning/reminders and the last watched episode’s conversation; never a completed-season message |

Also review new/empty, saved, locked, blocked, waiting for results, early/provisional results, final results, finished, error and recovery states. Include people at different episodes, multiple games at different stages, late joining and synchronization/draft/waiver prerequisites.

One person’s watched progress, a game’s reveal progress, a friend’s progress and the broadcast schedule must remain distinct. The same authoritative eligible actions should feed hub counts, Tonight, Games and badges. Do not reproduce contradictory counts or invent a second client-side deadline system merely to make the mock look coherent.

## Social watching and watch-along

Social behavior is a central product purpose: seeing what friends watch, sharing progress, discussing an episode, reacting with GIFs, inviting people into games and enjoying their decisions together.

Give faces, progress and reactions meaningful space in overviews. Show enough context to choose a conversation with a friend at another pace. Do not use invented messages or reactions as if they were actual activity; distinguish illustrative fixtures from real data in the review.

Watch-along needs deliberate UX attention. It should explain that it accompanies the person’s TV playback, offer start/pause/resume and timing correction, preserve position when leaving and returning, and make timely reactions pleasant to use. Distinguish a personal clock from a shared session or synchronized group action. Respect the existing timing guards and the provider’s actual granularity.

Protect viewing boundaries across outcomes, standings, participant statistics, reactions and dependent game information. A friend’s progress can be visible without exposing their later picks or episode outcomes. Episode-organized freeform chat cannot be promised semantically spoiler-free just because it has an episode label.

## Games: quick entry and serious depth

### Component direction clarified 2026-11-12

The user likes **season overview A from the bold component round**. Keep that as the liked overview reference, while redesigning the **Update popup's episode list itself**. A successful option makes the selected watched-through boundary and resulting last/next episodes clear before committing; it does not automatically reveal games.

For couch pace, explore a timeline that places **the viewer, other viewers, latest released episode and current/next airing** on a common scale. Offer direct paths from people and episode marks into their relevant detail. Viewing progress does not authorize access to game outcomes.

For Game night, bold and exciting means **good data representation, graphs, informative comparisons and usable density**. The user rejected most theatrical concepts from the previous round. Show the person's actual lineup and permitted other lineups, their contributions and scores; use collapsible sections when they make the overview compact. Compare several options for both the summary and connected drill-down components. Preserve show/cast imagery as useful identity, without relying on slogans, mascots or oversized typography for excitement. This is a refinement of the design intent, not a request for a clinical aesthetic.

The [data round](show-soul-review/tonight-data-round3-2026-11-12.md) implements that focused comparison. Selecting a component does not approve the entire composed Tonight page or authorize production rollout.

The individual game page’s existing graphs, season grid and data layout are a strong reference. The user likes them. Preserve that useful depth and the ability to see other players’ permitted choices and picks. Improve specific problems with evidence; do not flatten a strong detailed game page to make it resemble a minimal overview.

Quick actions on an overview and complete individual game pages serve different needs. A casual player should be able to choose on instinct. A serious player should be able to inspect relevant facts, compare options and return to the same unsaved selection. Both paths should feel attractive and complete.

For players, Tonight must also show **how they and other permitted players did in the last episode**, rather than only the next decisions and a show recap. Keep scores and outcomes labeled by game and episode; do not sum incompatible game metrics or expose another person's later choices. These compact results should open the relevant comparison, contribution breakdown or full game directly.

**Revealing an episode reveals it across all of the person's games for that episode.** There is no per-game selection. V3's selective reveal gate was an incorrect design assumption and is preserved only as history. Confirm the episode and explain the all-game consequence. Keep the reveal full screen, close to the existing show's-recap experience: “Last time on [show]” (appropriate event/sport wording for sports), a visual episode recap, then a bold, enjoyable animated account of the games, standings and what players did. A watcher can enjoy the episode recap and reactions without game slides. Game participants get appropriate game-specific and statistical detail. Quick summary/Skip to results and replay are presentation choices using the same authorized episode data; they do not change reveal scope or reveal additional episodes. Entity/score drill-down returns to the same chapter. (User correction and direction, 2026-11-11.)

The game system is dynamic. Shows have structured rulebooks defining participants, moments, stages and possible interactions; the engine composes many GameSpec combinations and generates game pages. Study that structure before designing. Build the design around reusable states and interaction patterns supported by the engine, not a few hardcoded named-game templates.

Use the source-derived [core game catalog](CORE-GAME-CATALOG.md) as the design-coverage checklist. It distinguishes runtime families, wizard starting games, sports defaults (including league overrides), main-page patterns, answer controls and compatible modifiers. Its JSON companion and `node scripts/core-game-catalog.js` make that inventory reusable; the sampled page census does not enumerate every configuration.

Review representative generated structures and lifecycle states, including their quick actions, controls, locks, scores, history and opponent visibility. Structural compiler coverage and rendered screenshots answer different questions; neither alone proves the combinations are understandable.

## Scoring and participant statistics

Scoring comprehension is a priority pain point. People need to see the connection between a captured moment, its configured value and whether it counted for them.

| Context | What it should explain |
| --- | --- |
| Show-level Players / Cast | What participants actually did: observed counts, performance, affiliations and episode history through the viewer’s mark. Avoid silently inheriting one game’s custom fantasy scoring. |
| A specific game | How that game’s rules value the moments, including custom values, stage and applicable modifiers. |
| A particular player’s contribution | Why their selected team or decisions produced that score: starters versus bench, captain/other modifiers, excluded moments and adjustments. |

Clearly labeled show-default points may be an optional reference. Genuine sport statistics such as basketball points scored remain factual statistics; distinguish them from fantasy points. Reuse participant search/detail components with explicit context instead of creating disconnected statistics systems.

Use concrete examples, a traceable score breakdown and useful interaction rather than paragraphs of explanation alone. Distinguish missing data from zero and a per-occurrence value from a total contribution. Historical statistics should not be presented as guaranteed predictions.

## Create-game wizard and preview

The wizard is another priority pain point. Help people understand what playing the game will involve before asking them to commit to rules they only understand as sentences.

Sequence the essential decisions, make understandable starting points available and disclose advanced configuration without hiding its existence. Show the consequences of a change in the game’s own terms.

Provide a preview that can show the important play screens, a sample decision, permitted opponent choices, scoring and results. Return to setup without losing selections. The intended production preview derives from the **current draft GameSpec** and uses the same compiler/renderer as a real game.

A recorded example is useful for early exploration, but label it accurately if edited settings do not affect it. Do not imply a canned example represents every combination. Previewing must not create a real game, notify people or reveal future real results.

## Sports

Use **NFL football** as the first representative sports example, not Formula 1. The app’s intended sports scope is broader: baseball, hockey, tennis, soccer and other ESPN-supported events.

Use sport-specific imagery, participant layouts, terminology and metrics where helpful. Provide a neutral fallback when a sport has no custom treatment. Do not force football’s field, quarters, two teams or score presentation onto every event.

Available provider data and engine eligibility determine what the interface can offer. Do not invent missing statistics or precise playback synchronization. Keep score reveal separate from viewing time; hiding the score must also consider status, commentary, box scores and dependent game results that could disclose the outcome.

## Data, assets and reuse

Use representative real show/season art, cast images, public sports imagery, recorded results and engine-generated scores so the mock has the density and character of actual use. Clearly identify sample people, choices, progress and social activity. Keep factual data separate from decorative generated imagery.

Reuse existing local data and fixtures first. If production backup data would improve fidelity, assess the need explicitly and use an isolated development copy with appropriate handling of private identities. A production restore or write is not an implied step of creating a mock.

Reuse prior screenshots, flow findings, prototypes and working components. They reduce repeat work and provide baselines; they do not constrain the redesign to a cosmetic overlay. A higher-fidelity pass must retain the intended content and flow changes rather than quietly reverting to the current layout.

**Save every generated project image for reuse.** Implementation candidates belong in `public/art/generated/` with versioned filenames and a provenance manifest. Reuse the saved pixels when implementing a chosen design. Generate another version for an intentional visual change, not just to move a concept into the app. See [VISUAL-ASSETS.md](VISUAL-ASSETS.md).

## Review process and approval boundary

1. **Understand the actual app.** Read project instructions, relevant documentation, data structures, rulebooks and source. Inventory screens and connected flows, and capture the real baseline across meaningful states.
2. **Define the page’s content and behavior.** State its job, relevant situations, first-view requirements, detail destinations and return paths using Intent and PFD. Decide what leaves the overview before styling it.
3. **Design one representative page.** Start with Tonight unless the user chooses another pilot. Use Impeccable to produce a meaningful new composition, populated with representative data and saved artwork. Show its watcher, player and pace variants as part of evaluating that one page.
4. **Make the proposal concrete.** Include the critical interactions needed to judge it: opening detail, making a trial choice, inspecting stats, returning and retaining state. Clearly distinguish existing behavior, simulated behavior and production follow-up.
5. **Present and pause.** Once that page is ready, stop and wait for the user to request changes or say to continue. Do not carry its theme across the app, build a large family of screens or treat silence as approval.
6. **Continue from the user’s decision.** Revise the pilot or extend the accepted direction through the remaining surfaces and flows, keeping the state coverage visible. Approval of one page does not automatically approve every later layout or feature change.

When several strong ideas exist, present a small number of materially different visual options. Name what changes about content, hierarchy or interaction. A/B comparisons should expose real design choices; near-identical screens do not mean both passed. Where an existing design is intentionally retained, say why rather than presenting a duplicate as a redesign.

Place persona/state selectors in the review board, outside the product UI. Label whether comparisons use matching data and situations or whether one side is a reference fixture. Keep reviewer notes, evidence and implementation details beside the mock rather than throughout the product screens.

## What a review-ready page must demonstrate

- The situation and next action are clear, with necessary information and controls visible in the first phone view.
- Different participation and pace states change the content meaningfully, not just the title or artwork.
- The show’s identity and the social/entertainment character remain evident.
- Detailed information has an obvious destination and a reliable return path.
- Sample selections and setup choices survive relevant drill-downs and preview returns.
- Progress, deadlines, lock/reveal states and score scope are understandable and internally consistent.
- Useful expert detail and permitted opponent decisions remain available.
- Real content, imagery, narrow screens, loading, empty/error states, focus and motion have received appropriate bounded checks.

Capture the baseline and proposal, important scenario variants and critical interaction states. Report exactly what was checked and what remains simulated. A screenshot fitting the viewport, zero browser errors or a passing interaction script is useful evidence, but not a substitute for human review or user testing.

## Starting references

Use the [UI Atlas](UI-ATLAS.md) as the reusable inventory and state/data workbench for this review. It generates an interactive HTML explorer from source, renders registered cases, compares mocks and exports focused context for the three design skills. It is tooling for the review, not approval of a design or proof that every discovered component has a complete fixture.

For generated games, use the [gameplay coverage matrix](GAMEPLAY-COVERAGE.md) to plan and track each capability across creation/preview, mini, quick-action, full-game, detail/scoring and episode-reveal surfaces. Its content/quantity/privacy/lifecycle profiles and visual/data contracts support Intent, Impeccable and PFD reviews. Treat source declarations, compiled witnesses and actual UI evidence as separate claims. Extend fixtures and scoped evidence as designs are reviewed; neither a sampled game nor one approved layout proves every valid combination works.

| Reference | Why read it |
| --- | --- |
| [PRODUCT.md](../PRODUCT.md) and [DESIGN.md](../DESIGN.md) | Product context and established identity; inspect them against the user’s latest direction and actual source. |
| [Own-pace review](own-pace-review/evaluation.md) | Progress, deadline, reveal and lifecycle problems, with existing capture evidence. |
| [Show overview critique](show-overview-review/evaluation.md) | Content duplication, hidden actions, inconsistent summaries and overview/detail separation. |
| [Art, company and clarity brief](show-soul-review/brief.md) | Watching-only, visual character, GIFs, social context and game depth. |
| [PFD requirements](show-soul-review/perception-first.md) | Existing perceptual derivation; apply or revise it rather than invoking the framework by name only. |
| [Fidelity requirements](show-soul-review/fidelity-pass.md) | Dynamic engine, preview, artwork, scoring and sports requirements. |
| [Tonight content contract](show-soul-review/tonight-content-contract.md) and [scenario review](show-soul-review/tonight-scenarios-review.md) | Latest pilot exploration and its simulation boundaries; reference material awaiting user approval. |
| [Generated asset library](VISUAL-ASSETS.md) | Reusable images, stable URLs and provenance. |

Capture directories and local review servers may not exist or be running in a later session. Verify availability, and use the durable documents and saved assets to recover context. Do not infer that an old mock is approved or that a prior tool connection is currently live.

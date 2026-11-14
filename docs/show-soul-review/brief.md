# Artwork, company and clarity

2026-11-10. Revised design study after the user found the compact proposal too clinical. The user clarified that bold visual elements may be reimagined. The scope is the hub, the show and all five tabs, with watching-only, own-pace, casual one-night games, solo play, committed multiplayer, sports and watch-along in view.

## The three design lenses

- **Impeccable:** composition, artwork treatment, typography, density, hierarchy, motion and interaction craft. The existing Night television language is the starting point; the user permits refreshing it. This study explores an art-led stage, a white angled action plate, cast portraits and a GIF mosaic.
- **Intent:** goals, journeys, state truth, understandable choices and recovery. The app should let someone watch and socialize without starting a game, then support an occasional gut pick or serious analysis without forcing a user-type switch.
- **Perception-First Design:** what registers first, how the pieces group, whether the signals feel consistent and whether the next action follows naturally. See the [five requirements](perception-first.md), derived before the revised edit. Framework credit: [Stefan Kovalik / Aurochs](https://github.com/skovalik/perception-first-design). This is applied design reasoning, not measured cognitive or neurological evidence.

Three parallel reviews completed: visual character, watching/social behavior, and game depth/sports. Their source notes are in the ignored capture directory. This document preserves their recommendations in the project record.

## Review the visual study

Open **http://127.0.0.1:4302** while the local gallery server is running. The [local board](../../captures/show-soul-2026-11-10/index.html) compares the current app, the earlier compact proposal and this revised concept. Its selector changes sample situations for review; it is not a proposed product mode switch.

The [clickable study](../../captures/show-soul-2026-11-10/prototype.html) includes the hub and five tabs for watching at your own pace, active multiplayer, a solo survival streak, and a delayed sports session. The revised surfaces use existing show art and cast photos, plus GIFs returned by the app's existing KLIPY search. Existing promo artwork is illustrative and may depict a different season. Driver names and sports metrics are explicit placeholders, not fabricated real-world results.

This remains a local prototype. Common choices, stats return, clock controls, progress, GIF selection and score visibility are simulated in page memory. It does not post, create real games, update real watched progress or implement the full engine. Several secondary controls demonstrate a destination rather than complete it. Sports game creation is explicitly labeled proposed. Product screens and database schema have not been changed.

## The visual and flow changes to evaluate

**Give the show a stage.** Use recognizable artwork at the opening, a clear title and one short personal-progress line. A shorter art treatment carries identity into deeper tabs. The exact crop and geometry are proposals. Artwork can change by show without inventing new navigation rules.

**Make watching complete.** Tonight gives a watcher Continue/Watch along, I watched it, episode chat and friends' numbered progress. There is no empty game checklist. Offer a one-night game where it feels like extra fun, not a required onboarding step. The hub should lead with the person's shows and people; revise “start a game” onboarding copy that treats watching alone as incomplete.

**Keep each actual move visible.** A player sees the earliest necessary move prominently, then other due moves and saved lineups. The same eligible action set must feed hub, Tonight, game overview and tab badges. The current replacement discrepancy still needs a provider trace before a product fix. A compact summary does not replace the full draft, waiver, lineup, setup or scoring flows.

**Bring social payoff forward.** The existing product already has substantial GIF reactions and a mosaic. Move that pleasure ahead of secondary stats on the watcher overview. Keep a clear episode target, change/skip controls, a useful solo memory and the right route back to chat. Do not preview later episode GIFs or reaction patterns that hint at an unseen outcome. Animated GIF density needs a user setting or static-preview treatment before production.

**Keep faces and expert depth.** Players gets a recognizable cast grid with one scoped fact and an explicit Rank view. From a pick, a person can choose immediately or inspect a short statistical summary, then compare or explore episode detail. Preserve the draft selection when returning. Use only revealed data; distinguish missing from zero. Do not manufacture a “best pick” prediction from historical points.

**Make watch-along a real companion.** Explain that its clock accompanies the user's TV playback. Support start, pause/resume, adjustment and returning to the saved position. Existing episode reactions are released behind the viewer's runtime; the source review found a 30-second delay. Preserve that guard. A future shared countdown or pause must distinguish “your clock” from “everyone.” Planned nights and late arrivals need explicit join-here or start-on-your-own choices. These are further workflow requirements, not all completed in this study.

**Treat sports as sports.** Match, session, round, bout or race replaces episode terminology as appropriate. In strict hidden mode, a begun event may show its start time but not winner, final/live status, clock, period, overtime, standings or dependent fantasy results. Revealing a score is separate from changing viewing time. Team-sport play clocks and field-sport session data have different granularity; do not promise precise replay that the provider cannot support. The race study illustrates session-level treatment, not lap-synchronized results.

## Programmatic work worth doing next

1. Fix the source-confirmed own-pace defects independently of visual decisions: reveal-based editor copy, complete late-seat cutoff copy, and caught-up-but-still-airing falling through to a finished-season plate. See the [earlier review](../own-pace-review/evaluation.md).
2. Trace and unify eligible moves across the hub and show destinations. Reuse authoritative rules, deadlines and prerequisites. Keep scheduled airtime, personal watched progress and each game's reveal position separate.
3. Extract an overview summary that can vary by actual participation and state. Keep the five destinations. Do not create a permanent casual/expert profile setting.
4. Move existing progress/presence, episode GIF and companion-clock components into a clearer hierarchy, preserving their real behaviors. Freeform episode chat is folded by episode; it is not semantically guaranteed spoiler-free. Per-game reveals must remain independent even if a watcher marks an episode watched.
5. Add scoped stats previews and a durable return path from comparison. Keep the existing detailed cast and sports tools. Drafts, waivers and synchronized regrouping remain full workflows.
6. Apply equivalent sports guards to status, commentary, stats and dependent game results. Validate delayed-playback semantics against actual provider granularity.

## Evidence and limits

The source review and real screenshot inventories remain in [the overview review](../show-overview-review/evaluation.md) and [own-pace review](../own-pace-review/evaluation.md). This study adds 32 screenshots: 24 overviews covering four situations and six destinations at 390 × 844, seven interaction states, and a desktop review-board capture. Art loaded and the captured overviews had no horizontal overflow or browser errors. The whole page need not fit; the necessary actions must be visible without scrolling through unrelated content.

The simulated interaction check passed: watcher action placement; opening a shared Episode 2 thread from friends' progress; clock running, pausing and retaining its position after returning; watched progression and GIF choice; visible multiplayer claim, pick and lineup; retaining a draft pick through stats, comparison and episode details; saving and reopening a pick; Faces / Rank switching; solo progression into caught-up-but-still-airing; and hiding/revealing race standings without advancing the viewing clock. Browser errors: zero. These verify the study's implemented paths, not production state eligibility or spoiler correctness.

The final visual inspection confirms the repaired game-icon sizing, readable portrait/stat sheets and restored artwork/reaction composition. Known next refinements include bringing reaction controls closer to the watch clock, choosing final art crops, static previews for motion preferences and validating safe areas, large text, keyboard behavior and smaller devices. These remain review points; the study is not a finished production specification.

Use short task-based sessions to test identification of the current episode, action discovery, safe friend-chat selection, optional game entry, stats return and delayed sports viewing. Ask about the emotional response as well as task completion. This is not an accessibility certification, production performance test or measured increase in retention, enjoyment or dopamine.

To reopen: `node scripts/dev-test/serve-captures.js captures/show-soul-2026-11-10 --port=4302`. To capture: `node scripts/dev-test/check-show-soul-mock.js --capture`. To verify the simulated interactions: `node scripts/dev-test/check-show-soul-mock.js`.

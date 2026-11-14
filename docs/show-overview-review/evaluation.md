⚠️ DEGRADED: single-context review. Independent assessment agents hit account limits; the broader review was completed directly, with browser captures, source inspection and the detector results already produced.

# The hub and show overviews

**Higher-fidelity continuation:** The [new review](../show-soul-review/evaluation-fidelity.md) uses actual app rendering, recorded season results, real generated-game pages, Nano Banana atmosphere, a restored animated guide, scoring explanation, a wizard preview entry and an NFL example with a generic event fallback. Local board: http://127.0.0.1:4303. The individual game page's current graphs, grid and drill-downs are explicitly retained as a strong reference.

**Revision after user review:** The compact visual proposal below was judged too clinical and insufficiently expressive. The functional findings remain useful, but that layout is not an approved direction. The user permits reimagining bold visual elements and wants watching-only, occasional games, social progress, GIFs, sports and watch-along considered together. Continue with the [revised brief and study](../show-soul-review/brief.md) and [perception-first requirements](../show-soul-review/perception-first.md). Impeccable governs visual craft; Intent governs UX strategy and flows; Perception-First Design adds the perceptual review. None replaces the user's brief.

## Make each overview answer three questions

- Where am I: which show, season, episode and spoiler boundary?
- What matters now: a required move, available result, waiting state or relevant personal score?
- What can I do: a visible named action, with the full detail one tap away?

Keep the established hierarchy: hub → show → Tonight / Episodes / Games / Players (stats) / Chat. Preserve the television identity, show artwork and meaningful game colors. Reduce competing presentation layers rather than indiscriminately shrinking text or deleting capabilities.

The [comparison board](../../captures/show-overview-2026-11-10/index.html) pairs the current application with an interactive alternative. It includes live, own-pace, late-viewer and solo sample states, Night and Studio appearances, and local simulations of common actions.

## Priority issues

### Major — The overview action lists do not give one complete account of what is due

The captured hub says **2 moves due**. Games offers **Replace Carter**, closing Thursday. Tonight shows **1 to do before Friday**, with a Survival Pool pick and a saved lineup. A person relying on Tonight can miss the earlier replacement task. [Hub](../../captures/show-overview-2026-11-10/current/01-hub.png), [Tonight](../../captures/show-overview-2026-11-10/current/02-tonight.png), [Games](../../captures/show-overview-2026-11-10/current/02-games.png).

**Change:** Drive the hub summary, Tonight list, game-row action and tab badge from the same eligible action set. Include drafts, team selection, replacement claims, swaps, picks, lineups, answers and any required calls. Sort by actual deadline or prerequisite. Distinguish due, saved, locked, blocked by a prerequisite and waiting on someone else. Count the same underlying task once.

The presentation should name the task, game, episode, reason and deadline. A generic **Set** button that changes meaning by context is insufficient when another screen calls the same action **Claim**.

**Implementation consequence:** Inspect the home-actions and season/show move projections before changing only the cards. `isRequired` already includes pickup and draft kinds; this discrepancy needs a targeted provider/state trace. Reuse existing server eligibility rules; do not implement another client deadline engine. [Tonight](../../src/new/show/tonight.tsx), [move mapping](../../src/new/show/moves.ts), [show data](../../src/new/data.ts).

**Acceptance:** For the same fixture, user and timestamp, every due action visible on a game has a discoverable matching Tonight entry and the hub's count agrees. Cover a waiver due before airtime, a draft turn, a blind team choice, a late lineup and multiple games of the same kind.

### Major — Large identity blocks and repeated summaries crowd out the work

The current hub has a featured-show block with a minimum height of 330px, then repeats the show in its tile. Tonight uses a minimum 250px show header, a couch-progress block and an episode heading before the action section. Other tabs repeat the spoiler control, while several also carry a second fixed action dock above the tabs. [Hub source](../../src/new/hub/sections.tsx), [show bar](../../src/new/ui/show-bar.tsx), [show frame](../../src/new/screens/show-space.tsx).

**Change:** Use one compact shared show identity: recognizable artwork, show and season, a short schedule/progress line and the show menu. Keep the current episode/required work in the tab's content rather than another large header. Put couch progress behind an explicitly labeled link. Keep one fixed tab bar; use a second fixed action area only where the current task genuinely needs it.

Body copy remains readable; touch targets remain at least 44px. The prototype uses 15px body text, 13px supporting text, moderate condensed headings and 44px action buttons. The space comes from eliminating duplication and using rows, not from making everything smaller.

**Acceptance:** At 390 × 844 CSS pixels, the ordinary hub and tab overviews expose their main actions without scrolling. Check a short 390 × 700 viewport, browser chrome, text zoom and safe-area insets before shipping; the 844px study is not a guarantee for every device.

### Major — Sideways actions hide required work behind a discovery gesture

Tonight's pick button is visible, but the saved-lineup **Change** action sits off to the right. The first capture's action measurements put both near y=489, yet only the pick is unobscured and inside the viewport. A person sees a partial card instead of a complete list of what is due and what is already saved. [Current Tonight](../../captures/show-overview-2026-11-10/current/02-tonight.png).

**Change:** Replace the primary action carousel with a short vertical list. Every row has one game, episode, status and specific action. Use a saved check plus words, not a tiny dot alone. Keep the most urgent action visually strongest and other actions clearly outlined. Horizontal browsing may remain for optional game inspiration; it must not be the only way to discover required work.

**Acceptance:** All tasks in a typical three-game show can be identified together. For larger workloads, show an explicit named and counted **Review all N actions** entry; do not squeeze an unbounded list into illegible text or silently truncate it.

### Major — Category pages repeat detailed screens instead of opening them

Games repeats each full leaderboard, rule line and roster preview before reaching Start. Players puts views, an episode slider and filters before large portraits. Tonight repeats episode outcomes, personal game results, stats and game summaries. Each part is useful, but putting all of them on every overview makes the whole experience feel more complicated than each individual feature. [Games](../../captures/show-overview-2026-11-10/current/02-games.full.png), [Players](../../captures/show-overview-2026-11-10/current/02-cast.full.png), [Tonight](../../captures/show-overview-2026-11-10/current/02-tonight.full.png).

**Change:** Give each overview one clear job and a stable row that opens detail:

| Surface | First view | Opens in detail |
| --- | --- | --- |
| Hub | Due actions across shows; show identity/progress; Add; guide and couch entry | Full guide, activity, couch rankings, trophies, all shows and profile |
| Tonight | Personal episode; required and saved moves; watch/reveal; compact last-episode result; optional extras | Move editor, watch-along, reveal sequence, full episode recap and friends' progress |
| Episodes | Next episode and its state; recent watched episodes; All episodes | Full timeline, episode recap, game scores, plays and scoring events |
| Games | Start; each game's name, personal measure/rank, current move and deadline; Join/past games | Full standings, season grid, player/week sheets, rules and complete wizard |
| Players / stats | Search; current scope; readable comparison rows; Compare and Filters | Player story, episode statistics, advanced ranges, faces, share and comparisons |
| Chat | Episode/spoiler boundary, conversation and fixed composer | Message actions, reactions/GIFs, polls, older messages and permission to unfold newer discussion |

**Implementation consequence:** Reuse existing game pages, episode pages and the sheet family. Preserve the originating tab, selected game, episode and filters when returning. Consider smaller summary projections and lazy detail reads if profiling shows a benefit; there is no need to redesign storage just to change visual density.

**Acceptance:** A title or summary row is an obvious full-size tap target. Back returns to the correct context without clearing a saved choice. Keep rule editing and less common game configurations available in the full wizard.

### Major — State language must remain consistent as the layout becomes simpler

The [own-pace review](../own-pace-review/evaluation.md) already identifies contradictory lock instructions, competing episode clocks, caught-up games mislabeled finished and provisional ranks presented as final. A denser overview would make an incorrect status more prominent.

**Change:** Correct those state projections first or alongside the shared overview components. Every action must state its own game/episode; distinguish viewed progress, available results and the broadcast schedule. A one-person game should show personal progress rather than **1st of 1**. Preserve soft synchronization warnings and actual live deadline limits.

**Acceptance:** Run the same overview scenarios for live, whole-game own pace, late live seat, solo, no game, empty/no actions, waiting results, a finished game and a friend still behind. Include errors, loading and permission changes. Do not interpret unavailable data as zero tasks or a finished game.

## What the captures show

Coordinates below are CSS pixels from the current 390 × 844 fixture and the concept's corresponding viewport. They measure location, not usability or task success.

| Control | Current | Concept |
| --- | --- | --- |
| Hub: Add a show | y=1131; below first view | y=297; visible |
| Tonight: pick | y=487; visible | y=337; visible alongside the other moves |
| Tonight: saved lineup Change/Edit | y=489; horizontally outside view | y=402; visible |
| Games: Start | y=2040; below first view | y=171; visible |
| Games: lineup Edit | y=752; obscured/outside usable view | y=447; visible |
| Players: comparison | Requires another view/state | y=171; explicit visible action |
| Chat: composer | Visible; preserve it | Visible; preserve it |

The current hub, Tonight, Games and Players captures are approximately 2530, 2177, 2429 and 2183px tall. The representative concept overviews fit within 844px in both themes. Chat's message history scrolls, as expected; its composer and safety controls remain accessible. These are different illustrative layouts/content sets, not a controlled performance or conversion experiment. [Current measurements](../../captures/show-overview-2026-11-10/current/manifest.json), [concept measurements](../../captures/show-overview-2026-11-10/proposal/metrics.json).

## Action coverage and placement

This inventory covers action families across the show experience rather than every combination of game rules. Keeping an action in detail means retaining a visible, named entry to it.

| Family | Overview entry | Detail / contextual actions |
| --- | --- | --- |
| Show discovery | Hub: Add and show rows | Search, season choice, follow, progress at entry, make a show playable |
| Couch and account | Hub: couch/profile; show menu: Invite | Create/join/switch couch, membership, invitations, profile, notification and appearance settings |
| Watching progress | Shared show progress line; Tonight episode | Confirm watched, correction where permitted, spoiler settings, current/next episode and privacy |
| Starting games | Games: Start | Preset/custom/AI, origin, duration, roster/ownership, recurring move, win condition, scoring, bets, tell couch, bots and start Undo |
| Joining games | Games: Find a game to join | Join/request access, start position, shared seats and leave/end rules |
| Draft and acquisition | Tonight: named due row | Team choice, live draft/queue/pick order, blind draft, auctions or other supported acquisition mechanics |
| Recurring moves | Tonight and the relevant Games row | Picks, lineups, questions/answers, group slots, calls and game-specific choices |
| Replacements and trading | Tonight and the relevant Games row | Claims/priority/FAAB, swaps, trade windows and checkpoint explanations |
| Results and scoring | Tonight/Episodes: reveal or waiting state | Early/final reveal, personal score breakdown, pending settlement, corrections, disputes and shared-result availability |
| Personal/competitive progress | Games summary | Full table, season grid, person/week/castaway sheets, tie rules, provisional/final status |
| Episode history | Episodes: recent rows and All | Full chronology, episode recap, scoring moments, historical lineups/picks/answers and GIF reactions |
| Cast and stats | Players: rows/search/Compare/Filters | Show-specific groups, active/out/team filters, stat selection, range, story, comparison, faces, per-episode analysis and sharing |
| Conversation | Chat: visible composer and guarded boundary | Send/edit/delete own message, mentions, emoji reactions, GIFs, polls/votes, older/unread messages and guarded unfolding |
| Optional episode games | Tonight/Games: Bingo, Calls, Trivia | Tick/call/confirm/contest bingo, call answers/results and trivia based on seen episodes |
| Watching together | Tonight: Watch along / Plan together | Invite/RSVP/schedule/cancel, viewing clock, pause/break, timed reactions and return to reveal |
| Commissioning | Named Backstage entry with actual attention state | Results/research/paste/approval, member roles and own-pace permission, rules, game settings, waivers and change history |
| Less frequent show management | Show menu / Everything else | How the show works, scoring reference, notifications, privacy, unfollow or leave, history and archival actions |

The site-wide administrative Desk is a separate task surface. Its operations remain reachable for authorized administrators; this review does not flatten them into the player overviews.

## Build sequence

- Unify the action/status projection and fix deadline/completion truth.
- Introduce the compact shared show header and the row-based Tonight list.
- Replace overview leaderboards with game summaries linked to the existing details.
- Simplify the hub and Players controls, then align Episodes and Chat.
- Check every action family, role and state before removing old duplicate entry points.

Keep primary controls large enough to tap; do not trade the current oversized presentation for tiny text and unlabeled icons. Test with real returning players: can they identify their next action and explain its consequence without coaching? The reported confusion is user evidence; the proposed remedy still needs that validation.

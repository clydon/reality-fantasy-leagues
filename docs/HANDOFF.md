# Handoff: where things stand (for a fresh session)

Read this first, then `docs/BACKLOG.md` (what's open, and what's been decided against), then
`README.md` for the full history. `CLAUDE.md` / `AGENTS.md` hold the standing project rules.
`docs/ADDING-A-SHOW-FORMAT.md` is the playbook for adding a show beyond Survivor/Traitors/Challenge.

**State as of 2026-10-02:** everything below is on `master` and pushed (live). The user tests on
their phone against production and reports back, often with screenshots or screen recordings.

## Who uses this

- The user (`conor`) is the **only commissioner** and the site admin. Everyone else is a player, so
  player-facing copy (What's New, banners, settings help) should be written for non-commissioners.
- The user's friends play **three linked leagues on the same season** (Survivor 50): "Weekly
  Start/Bench" (Active Roster), "Avoid Elimination Streak" (Eliminator Pool) and "Last Survivor
  Standing (+Predictions)" (Classic). They share one chat (linked leagues, below).
- Most use is on **Android/iPhone**. Check mobile first. The user can't easily remote-debug, so a
  screen recording is the usual evidence. Frames can be pulled with Python + OpenCV (`cv2` is
  installed): crop the region that matters and diff consecutive frames to find the moment
  something changes.

## What shipped on 2026-10-01/02 (~60 commits, `fd15b0b..HEAD`)

Grouped by area, with the file to start from.

### Players: what needs doing, and when
- **Action bar** (`src/components/action-bar.tsx`, rules in `src/lib/game/action-items.js`). A bar
  above every page lists what's waiting on you in ANY league: draft turn, blind-draft picks,
  mid-season turn, incomplete lineup, Eliminator Pool pick, predictions to guess, and pending
  **league invites** (with Join/Decline inline). It shows one item at a time with `‹ ›`, and tapping
  one switches league and opens the right page or section.
  - The open league's items are computed client-side from the real state (`fullState`).
  - Other leagues' items come from `GET /api/me/actions`.
  - Demo seasons show it too, with their own items only.
- **"Turn on notifications" nudge** (`src/lib/notify-nudge.ts`). This is the bar's last item, shown
  on a device that supports push but isn't subscribed. ✕ snoozes it 14 days, and the 3rd dismissal
  stops it for good. It's tracked per device (localStorage) and never shown where the browser has
  blocked notifications.
- **Episode reminders** (`db/reminders.js`, migration 0033 `reminder_log`). A push goes out ~24h and
  ~2h before an episode airs if your lineup, pick or a prediction for it is still open.
  - It runs hourly as a step in `.github/workflows/auto-research.yml` (it uses the existing VAPID
    secrets).
  - It only covers leagues following a live season's schedule, not catching-up ones.
  - Inserting into `reminder_log` first is what guarantees each reminder sends at most once.
- **Lineups and picks lock at air time** (`src/lib/server/air-times.ts`).
  - The server stamps `ep.airsAt` from the season schedule on every read and on every write
    (`withLeagueLock`), and `ActiveRosterLogic.isLineupLocked` = manual lock || aired || has results.
  - `PickEmLogic.setPick` also refuses after air.
  - The manual "Lock lineups" button only shows for seasons with no schedule.
  - Starters carry over week to week; an eliminated starter leaves an empty slot
    (`ActiveRosterLogic.carriesInto`).

### Spoiler protection
- **New results are hidden until you tap "Results are in!"** (`StateLogic.SpoilerLogic`,
  `src/components/results-in-banner.tsx`, migration 0034).
  - Each membership has `results_seen_through`. The store keeps `fullState` (real) next to `state`
    (the viewer's trimmed copy), and every screen reads `state`.
  - The trim hides later episodes' eliminations, scoring, tribe moves, merge flag, prediction
    grading and finale answers.
  - It's on by default. Opt out in Account → Spoilers (`user_settings.show_results_immediately`).
  - Lineup and pick grids show "reveal first" while results are hidden.
  - Pushes: "Episode N results" names castaways only for people who opted out.
  - Chat is deliberately NOT covered.
  - It's client-side only: the full state still reaches the browser. That was a deliberate
    trade-off.
- **Admin is spoiler-free unless "Show episode results" is ticked** (Admin top). The ticket is per
  browser, alongside "Show paid AI actions" in `src/lib/paid-ai-store.ts`. With it off:
  - Each episode's review shows counts plus "Accept all pending", with a per-episode "Show this
    episode's results".
  - Research and pull notes give counts only, and the cast's starting tribes are hidden.

### Linked leagues (migration 0040, `src/lib/server/league-groups.ts`)
- Set up in League Settings → Linked leagues, by a **commissioner of every league involved**. Only
  leagues on the same season that reveal in step can be linked (both live, or both catching up at
  the same episode).
- **One shared chat.** Messages keep their `league_id`, and the group's chat reads all of them
  together, so unlinking splits them back. Unread counts, "Read by" and chat pushes all cover the
  group.
- **One reveal for all.** Revealing marks every linked league as seen and posts one
  "👀 conor revealed episode 9" line (chat type `reveal`). A catch-up "Reveal next episode" reveals
  every linked league that was in step.
- **The old automated chat lines are retired** ("X — Voted Out", "X guessed on…"). Old ones are
  hidden (type `system`, filtered out in `GET /chat`).
- **Swiping between linked leagues on mobile** (`src/components/league-swipe.tsx`). It's on for
  everyone now.
  - `useLeagueStore` reads a `LeagueStoreContext` first. That's how the neighbour league's REAL page
    is drawn through `makePeekStore`, while the same page components serve both.
  - Both neighbours are pre-rendered (hidden, one screen tall) ~400ms after a page opens. Drawing
    them on drag start dropped the gesture on heavy pages.
  - Touches are listened for on `document` and accepted anywhere in `main`. There's an 18px dead
    zone and a 32px gap between pages, and edges (28px) are left for the back gesture.
  - The top-bar title "rolls" vertically (`SwipeTitle`). Its transition is OFF at rest and only on
    while settling: re-enabling it a frame after the reset replayed the roll.
  - After landing, the league is re-fetched quietly, and a reveal updates the cached neighbours.
  - It only works on league pages (`LEAGUE_PAGES`), not Chat, Account, Admin or Reports.

### Screens redesigned
- **Your lineup** (`active-roster-lineup-grid.tsx`): an Active row with dashed empty slots, the
  roster grouped by current tribe with tribe badges, a collapsible "How starters score" chart
  grouped by category, and "Locks when it airs, <time>".
- **Overview Board for Active Roster** (`starters-board.tsx`): every player's starters for this
  week, live as they're set (the league poll syncs lineups via `syncLineups`), plus a compact cast
  grouped by tribe.
  - The commissioner setting "Hide other players' starters until the episode airs" turns other rows
    into grey "?" squares plus dashed empties, so the league can see who isn't set.
- **Scoreboard breakdown** (Active Roster, `active-roster-leaderboard-row.tsx`): one line per
  castaway with points earned for THAT player.
  - A per-episode bar chart around a centre line: gains up (green), losses down (red), benched
    weeks as an outline at what they would have scored, a dot after elimination.
  - Tap a castaway for each event on its own line with its points.
  - There's one legend per page ("How to read the breakdown").
- **Season results card with confetti** (`season-results-card.tsx`). The confetti is portalled into
  a fixed overlay. Inside the page it broke the Android tab bar's painting.
- **Chat** (`chat-tab.tsx`) fills the visible screen to the tab bar, or above the keyboard while
  typing (`useFitToVisible`: visual viewport + ResizeObserver on body/header). It opens at the newest
  message, and the page itself never scrolls.
- **Dark mode** is lighter, with dark logo variants (`BrandLogo`). The theme picker lives in Account
  → Appearance on desktop.

### Scoring (Survivor; values below are shared-ownership defaults)
- **Endgame:**
  - Every finalist (the winner too) gets "Reached Final Tribal Council" (3).
  - "Each jury vote received" (+1 per vote) is generated from `ep.events[].juryVotes`.
  - The Sole Survivor bonus is 3, and the goat ("no jury votes") is −3, cancelling the base.
  - A 7–2–0 vote scores 13 / 5 / 0.
  - Jury counts come from research (`juryVotesReceived`) via `season_decisions.jury_votes` (0036),
    or a commissioner types them in.
- **Fire-making:** winning is +2, losing −1 (0037).
- **Chosen for a reward without winning it:** +0.5.
- **"Learned about someone else's idol/advantage" is tracked at 0** while research's accuracy on it
  is checked. 0.5 is the suggested value if it proves reliable.
- **Predictions are worth 1–3 points**, picked with a 1/2/3 control (0039 capped existing ones).
  The math: at about one prediction a week, 3 points ≈ a quarter of what decides a Classic league.
- **Scoring categories:** each format lists `eventCategories` (Challenges, Tribal Council, Idols &
  Advantages, Leaving the game, Endgame). `scoringGroups()` feeds both "How starters score" and
  League Settings. A test keeps every event in exactly one category.
- **"Bets" are "Predictions"** in all user-facing text. Code, API and DB still say `bet`.
- **Research** includes pre-league episodes only when you tick "Include episode 1 (before the
  league started)". It's off by default and deliberately not remembered.

### What's New (`src/lib/whats-new.ts`, `src/components/whats-new-modal.tsx`, migration 0038)
- `RELEASES` is newest first. Each signed-in player sees every release newer than the one they last
  dismissed (`user_settings.whats_new_seen`), skipping releases older than their account.
- **To announce something:** add a release at the TOP with a new `id` and today's `date`. Write for
  players: a one-line title, an optional short `detail` behind a chevron, an emoji `icon`, and an
  optional `link` (currently only `whatsNewMenu`).
- "What's new" in the More menu and the sidebar shows every release, one heading per day. Anything
  within 7 days of the newest shows in full; older ones fold under "See older releases".
- Admin has "Preview What's New", which isn't recorded as seen.
- Shipped releases: `2026-10-01`, `2026-10-01b`, `2026-10-02`, `2026-10-02b`.

### Computer players (`src/lib/game/bot-logic.js`, `src/lib/server/bots.ts`, migration 0042)
- League Settings → Players: "Computer player" beside the new-player name, and on any seat with no
  account. A computer seat has a level (Casual / Solid / Sharp, `player.botLevel`, default Solid).
- Bots play every league type and show: snake draft turns, blind-draft lock-ins, Active Roster
  lineups, Eliminator Pool picks, replenish/swap turns, finale picks (once, after the merge or with
  ≤10 left). Not predictions (free text).
- They rate castaways from what the league already has: the show's own scoring events (recency
  weighted), danger/safe signals by event id (`SIGNALS`, covers Survivor/Traitors/Challenge), tribe
  numbers (Survivor only), unplayed idols, a known Traitor. Deterministic: a fixed per-bot "taste"
  breaks ties, so running twice does nothing the second time.
- They act inside `withLeagueLock` after every write, and `GET /state` runs them when one has a move
  waiting that no write prompted (e.g. a scheduled draft start). A bot overrides manual changes to its
  own seat; untick "Computer player" to play it by hand.
- **Hand over…** (any seat with no account): an invite with `league_invites.player_id`. Accepting
  takes that seat (renamed to their username, automation off) instead of adding a new player
  (`joinLeague`'s `seatPlayerId`). If the seat is gone or taken by then, they join as a new player.
- Tests: `tests/bots.test.js`.

### Admin
- **Auto-research timing** is "N hours after each episode airs" (default 12, migration 0035,
  `research_delay_hours`). Seasons on the old weekday/time slot keep it until a delay is set.
- **Notification tests:** each type has a "Test" button (Account → Notifications) that sends its
  sample message.
- **Wiki Connector section** only appears when there's a leftover cast proposal.

### Fixes worth knowing about
- **League dropdowns:** `/api/me` returns `type` and `showId` already sorted, so there's no re-sort
  flash.
- **More sheet links:** they navigate with `router.replace` over the sheet's history entry.
  `history.back()` raced `router.push` and undid it.
- **Draft Results** show original picks via `StateLogic.originalDraftPicks`, derived from the
  mid-season log.
- **Chat unread badge** counts from the server's `chat_reads`, not in-memory.
- **One unreadable league's state** no longer breaks `/api/me`, `/api/me/actions` or reminders.
- **Demo seasons:** "as of episode N" means N happened and N+1 is this week, open
  (`ensureNextEpisode`). Tested by `tests/demo-recent-features.test.js`.

## Database migrations this session (0033–0040)

| # | What |
|---|---|
| 0033 | `reminder_log` (episode reminders sent at most once) |
| 0034 | `league_memberships.results_seen_through`, `user_settings` (spoiler opt-out) |
| 0035 | `show_seasons.research_delay_hours` |
| 0036 | `season_decisions.jury_votes`; new endgame values set in every Survivor league |
| 0037 | lost fire-making −1 in every Survivor league |
| 0038 | `user_settings.whats_new_seen` |
| 0039 | predictions above 3 points capped to 3 |
| 0040 | `league_groups`, `leagues.group_id`, chat type `reveal` |
| 0041 | `episode_team_notes` |
| 0042 | `league_invites.player_id` (an invite that hands over a seat) |

The next free number is **0043**. Production applies migrations on deploy (`npm run build` runs
`db/migrate.js`).

## Local dev database: partly broken (user decision pending)

- Migrations **0016, 0017, 0019, 0021** are recorded in `schema_migrations` but were never actually
  applied locally. The cause: local Postgres has **no pgvector**, which 0016 needs, and they appear
  to have been marked done by hand.
- 0020's columns and table were repaired by hand this session. Re-running 0017–0024 (minus
  0016/0023) was **blocked by the permission system** as a shared-resource change. The user hasn't
  decided yet; don't do it without asking.
- 0033–0040 aren't applied locally either. `npm run migrate` would apply them, but it will fail once
  it reaches anything depending on the missing tables (`season_decisions` for 0036).
- So the local DB can't be fully exercised. New SQL has been checked by running it inside a
  transaction and rolling back (see "Working conventions").

## Things the user still needs to do in production

- Decide on the local DB repair above (local only).
- Optional: once research has a few episodes of "learned about an advantage" answers, check them in
  Admin's review and set the value (0.5 suggested).
- Earlier items (from before this session) may still stand: discard Survivor 51 episode 2's early
  research and set its premiere date, and confirm the auto-research workflow secrets.

## Working conventions (from this collaboration)

- **Commit straight to `master` and push** once a change is verified. The user tests live and asks
  for small rounds of fixes. (Earlier sessions used feature branches; this session the user asked
  for direct pushes.) Write clear commit messages, and end each with the attribution trailer from
  the system prompt.
- **Hold back anything user-facing for approval when asked:** What's New copy, scoring values and
  new categories. The user approves lists by number.
- **Before pushing:** run `npx tsc --noEmit -p .`, `npx eslint src`, and `npm test` (82 tests).
  ESLint is not run on `tests/` (they use `require`). If tsc complains about `.next/types`, run
  `rm -rf .next/types .next/dev/types && npx next typegen`.
- **Python edits on this Windows machine MUST use `encoding='utf-8'`** on both read and write. The
  default cp1252 once wrote "—" as byte 0x97 and broke the Next build. After editing, check files
  with `iconv -f utf-8 -t utf-8 <file>`.
  - Long inline Python inside a bash heredoc has twice failed with "unexpected EOF". Write the
    script to the scratchpad with the Write tool and run it instead.
  - When inserting an import line programmatically, make sure it doesn't land inside a multi-line
    `import { … }` block.
- **Checking SQL without a usable local DB:** run it inside `BEGIN … ROLLBACK` from a small node
  script (`require("dotenv").config({ path: ".env.local" })`), creating throwaway rows if needed.
  Delete the script afterwards.
- **Migrations** are hand-written SQL in `db/migrations/NNNN_*.sql`. `db/*.js` and
  `src/lib/game/*.js` are plain CommonJS with `.d.ts` next to them, so the CLIs and the hourly job
  run under bare `node` (e.g. `action-items.js`, `air-schedule.js`).
- **React rules the linter enforces here:** no `Date.now()` or module-variable writes during
  render, and no reading a function before it's declared. Put render-time "now" maths in effects,
  or derive it from data (e.g. the newest release's date).
- **Mobile layout pitfalls found this session:**
  - Fixed elements have `offsetParent === null`. Detect them by `getBoundingClientRect().height`.
  - Transformed/animated content that ends up outside the page widens it, and Android Chrome then
    stops painting the fixed tab bar. `body` has `overflow-x: clip`, and the confetti lives in a
    fixed, clipped overlay.
  - Many filtered elements (grayscale/saturate) on one page also upset painting. Eliminated
    castaways are faded with opacity only, and the tab bar has its own layer (`translateZ(0)`).
- **Secrets and commit text:** never commit secrets (`.env.local` is gitignored), never ask for the
  production DB URL, and keep model identifiers out of commit messages beyond the trailer.
- **Comments** explain *why*, matching the existing (fairly thorough) style.

## Earlier work (before this session)

Show formats (Survivor, The Traitors, The Challenge; `docs/PLAN-show-formats.md`) are done:
migrations 0021–0024, role tracking, team changes mid-season.

Season decisions (0019) mean episode results are staged once per season by the wiki connector and
research, decided by an admin, and applied to every league on the season through a per-league
ledger.

The air schedule and auto-research (0020), the model picker and cost hints, and research answering
predictions ("side bets") all landed earlier too. `README.md` has the long version.

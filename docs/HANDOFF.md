# Handoff: where things stand (for a fresh session)

Rewritten short on 2026-11-19. The build log it used to be (2026-10-01 to 2026-11-19) is
[archive/HANDOFF-log-2026-11-19.md](archive/HANDOFF-log-2026-11-19.md), kept word for word because plans and code cite its
sections by name. It's history: never act on a "waits on" or "not merged" there.

**Read in this order:** this page, then [BACKLOG.md](BACKLOG.md) (everything open, in session-sized groups, and what waits on
the user), then [PLANS.md](PLANS.md) (every plan's status and the order of the big work), then the plan named for your work.
`README.md` has the architecture and its history; `CLAUDE.md` and `AGENTS.md` hold the standing rules.

There's also a **User Manual & Product Guide** (https://claude.ai/code/artifact/cf6a3dd3-ecd3-4d80-88ea-d71b925a2042), a Claude
Doc written from the product side (no code). It isn't updated automatically; open it with the Docs tool when you need how the
app explains something to a player or a commissioner.

**Keep this page short.** Each step updates the five lists below in place (live, in flight, next, production, conventions) and
puts its build notes in its plan, not here.

---

## Live (production = origin/master, 56127b49+, deployed 2026-11-22)

Newest first. The plan or archive section named holds the detail.
- **Sports on the couch, A1-A3 and B1** (2026-11-22, merged and pushed 56127b49; migrations 0313 and 0314, rehearsed on a copy of
  production; the snapshot `pre-sports-couch-2026-11-22` keeps 7 days): the hub's scores strip under the guide bar, the league card in
  Your shows, following a league (your team per league), and a league's page with This week, Scores, Games, Standings (ESPN's
  standings, a new read) and Chat (the couch's room, a thread per game). Stories and notes: [PLAN-sports-couch.md](PLAN-sports-couch.md);
  leftovers BACKLOG 254. BACKLOG 254 (k): Hide sports scores reads as on until it's known.
- **The finale through research** (2026-11-22, 645c1303; no migration; compare-totals and a night's places: no league moves):
  a night's places by how each finished, a finale that scores nothing goes final, and research is told the finale's winner
  and finalists leave (BACKLOG 116; proven on the tapes).
- **The pool's finale rule** (2026-11-22; no migration; compare-totals: no league moves): How it plays says only the winner
  survives the finale, and the finale's pick asks "Who wins?" (BACKLOG 115).
- **Before Ep 10** (2026-11-22, pushed 5fb4babe; no migration): sign-in shares the app's guarded database pool and skips
  Better Auth's cold-start schema check (BACKLOG 39); Not yet's save is sent so it outlives the page (111).
- **Settings overhaul, Round 4** (2026-11-21, pushed 03730f59; no migration, no scoring change): the words and the ripple. Start a
  game and Manage this game use one set of words (Relaxed · Standard · Strict, Freeze rules and joining, Customize the rulebook,
  Fewest points first); nothing points at Backstage (pushes, errors, the tab's title Games you run); one Recommended tag; every
  confirm ends with Not now and Leave the pool is a hold; How it plays says when a new moment counts and that the bench fills an
  empty slot (BACKLOG 243); Start a game's Waivers turns back on (it couldn't); Lineups hidden gone. Recent changes keeps its name
  (the user's pick). Story: https://claude.ai/artifact/5mLdnBLiwQik8SiK3BifEz. [PLAN-settings-overhaul.md](PLAN-settings-overhaul.md),
  Round 4.
- **Settings overhaul, Round 3b** (2026-11-21, pushed af417333; no migration; compare-totals: no league moves; golden 7 seasons the
  same): changing a game once it's under way. The lock's states by effect (open to whoever hasn't watched, open to everyone, locked
  for everyone); real Undo for the lock, late moves, questions, the freeze and computer players; How long until a phase starts and
  waiver timing; when the show adds a moment mid-season, each game's rule (from the start, the next episode, or the players' vote;
  Survivor and The Traitors default to the next episode); a runner sets a move someone forgot; an empty slot fills from the bench
  (new games); runner jobs and votes as quiet lines under the strip. Story: https://claude.ai/artifact/SCCquWVBtn7qhotipLmcyx.
  [PLAN-settings-overhaul.md](PLAN-settings-overhaul.md), Round 3.
- **Tonight's night and the Games tab** (2026-11-21, pushed f5fddc1c; no migration; carries settings Round 3a, already on origin):
  Tonight is the night (each game you play a row led by its name and length, one-episode games first led by who won, opening to
  everyone's night; bingo and trivia as Last time's expander; a watcher sees no game's results), the Games tab is the way into games
  (the next episode's one-episode games first, yours and the couch's to Join, Start one; your longer games a row each; longer games
  to join; your record), a game's page is the season. The strip names a pick's game beside another pick game. Every kind of game
  has a Tonight row (src/lib/game/night-rows.ts) and docs/UI-REVIEW-MAP.md lists the screens each engine change reaches. Stories:
  https://claude.ai/artifact/1y8nHXhkub2XuSiMwwWykp (Tonight) and https://claude.ai/artifact/5D9STJ6R4jFVgtkKEdCdpx (Games);
  docs/design-round/tonight-night-*.md and games-launcher-*.md.
- **Settings overhaul, Round 3a** (2026-11-21, pushed 535e2ecf; no migration): Backstage retired; each game's Manage this game (a
  gear on its bar) with its jobs, its waiver week in place, Who's playing per game, rename, remove from one game and Stop; Games
  you run on the show's ⋯. Stories: https://claude.ai/artifact/53oCgbQkJdW1e6RARGWP73 and
  https://claude.ai/artifact/6CR3eNJ5sZ2uRXfJMRUtfN. [PLAN-settings-overhaul.md](PLAN-settings-overhaul.md), Round 3.
- **Sports steps 2.7 and 2.8, with 2.8's design round** (2026-11-21, merged 1484417a; migration 0312, additive, applied by the build
  without a Neon rehearsal on the user's word; no sports games in production): a game through the playoffs ("Regular season" by
  default, or "Through the Super Bowl" on Start a game and in Game settings; a team's season takes its playoff games as they're
  listed); a game's players are its scope's (a team's season, that team's only; one game, its two teams); the team's page offers
  the scopes as "Start a game on" rows, and Start a game says whose players a draft draws from and catches one too big before
  Start ("Make it shared"). [PLAN-sports-ready.md](PLAN-sports-ready.md) 2.7 and 2.8.
- **Settings overhaul, Round 2** (2026-11-21, pushed ce891ba2; migration 0448, rehearsed on a copy of production; the snapshot
  `pre-settings-r2-2026-11-21` keeps 7 days): a gear on every show's bar opens that show's settings for you (how far you've watched,
  when a new episode airs, when results show here, notifications, hide it from your couch, leave or remove last and quiet); the ⋯
  is things to do; Where you are with Undo; Leave this game; mute until the next episode; the hub names its couch (saved per
  account); handing a couch on confirms. [PLAN-settings-overhaul.md](PLAN-settings-overhaul.md), Round 2.
- **Settings overhaul, Round 1** (2026-11-20 at midnight, pushed c440bf5f; migration 0447, rehearsed on a copy of production; the
  snapshot `pre-settings-2026-11-20` keeps 7 days): Your settings as five groups with their values (the hub's gear opens it);
  notifications as one system (three kinds, invites always, Couch chat on every couch, a show's Mute, a couch's own chat, Your
  phones, Install the app); one When results show; Privacy as one switch; Grok and the AI setting gone; signing out turns this
  phone's notifications off (BACKLOG 237). [PLAN-settings-overhaul.md](PLAN-settings-overhaul.md), Round 1.
- **Sports Phase 2, steps 2.1 to 2.6** (2026-11-20, merged and pushed d4e594cf; migration 0311 on the build; light prep, the
  user's call: no sports games in production): each NFL player locks at his own game, fantasy playoffs end by Week 17 with a final,
  lineup slots for every team sport, IR places, waivers that run (weekly for the NFL, every game day for the NBA, NHL and MLB), and
  own pace for a sports game (a team sport's seat never more than one game behind, moving on by itself; baseball by the day).
  Next is 2.7 (a game through the playoffs), on a fresh branch. [PLAN-sports-ready.md](PLAN-sports-ready.md).
- **Results settle on their own** (2026-11-20, f63b2492; no migration): the bot's latest answer counts until final results
  (noon the day after); after them a bot correction needs a second look by the bot and the game's players are told; splits
  go to the tie-break an hour later; Backstage has nothing for the couch to tick; the desk's Inbox is one row an episode the
  bot couldn't settle. POST /api/desk/settle-again ran once after the deploy. [PLAN-results-settle.md](PLAN-results-settle.md).
- **Sports in good shape, Phases 0 and 1** (2026-11-20, f1488cf1..ba8f3a8e; migrations 0308–0310, rehearsed on a copy of
  production; the snapshot `pre-sports-2026-11-20` keeps 7 days): a sport's people go into its games and fit football's slots,
  team defenses, two players who share a name kept apart, rosters kept current, injuries and byes, finals never zeroed silently
  and corrections taken, finals in the standings within the hour (the hourly GitHub job now runs `db/sports-refresh.js`), a week
  counted as its games end, and live points during games for anyone shown everything (never an own-pace seat or anyone hiding
  sports scores). [PLAN-sports-ready.md](PLAN-sports-ready.md).
- **Episode night** (2026-11-19, 50651ca4 and 7cfb1bb5): look C is the app; Lock in is a real lock (`GhostLogic.lockIn`, the
  lock-in route, Undo for a minute); a full lineup carried in from last week counts as set. Survivor 51's Ep 10 (Wed
  2026-11-25) is the first night with it (BACKLOG 110). Spec: docs/design-round/strip-night-spec.md.
- **The reveal's face plates** (2026-11-19, 9b2d1e00): everyone the reveal names is a face over a caption strip in their
  tribe's colour.
- **Start a game, redone** (2026-11-19, merged b3f3dae7; migrations 0442 saved games, 0443 deletes the practice games): the
  gallery for every start (B1), computer players in every game (E1), short games at scale (E2), the show's games and their
  archive (B3), Game settings (B4), the play pieces (B2), and E3's first slice. One production league moved on the user's word:
  Survivor 51's Outlast that starts at Episode 2 now counts from its own start (every seat 3 fewer, the order unchanged).
  [PLAN-start-a-game-redo.md](PLAN-start-a-game-redo.md).
- **One episode at a time** (2026-11-17, 5b2cd7b5): someone behind is asked about one episode at a time, with air dates and a
  GIF slot per recap.
- **The design round's steps 2–9, the scored castaway sheet and the drill pass** (2026-11-16/17, 1dd10b96 and 484c323c): the
  game page, Tonight, Episodes and the reveal, Players, the Games tab and draft room, the hub and TV guide, notifications and
  waivers, and Chat. docs/design-round/decisions.md is the record.
- **Cast properties** (2026-11-16, 4ab2e026): what a show sorts its people by, researched for every show and usable in a game's
  rules; the catch-up ran in production. Chunk 7 is the redo plan's E3.
- **Pace is the game's setting** (2026-11-14, 8b12ef71): own, live or strict, chosen when a game starts.
  [PLAN-own-pace-games.md](PLAN-own-pace-games.md).
- Everything older (the new design for everyone from 2026-10-31, the desk replacing /admin on 2026-10-29, sports on the couch
  2026-11-09, rulebooks for every season, bingo, GIF reactions, the first-time tour) is in [PLANS.md](PLANS.md) under Done.

## In flight

- **Sports on the couch, B4: a game's sheet with Play** (2026-11-22, lane `sports-couch`; not committed; no migration): every game
  row's sheet, titled by the matchup, with the couch's games on it first (Join as the yellow so nobody starts a duplicate), the
  one-game types as tiles, one decision, Go bigger; after kickoff the score, the couch's games and the thread. Story: https://claude.ai/artifact/BqzTDp21SuBUZ7raWkf7Qx.
  Approved and committed in the lane (not merged). Next: B3, search.
- **Sports on the couch, B2: a team's page** (2026-11-22, lane `sports-couch`, port 3019; committed e11cd936, not merged; no migration, no new
  external read): the team sheet becomes a page at /league/<sport>/<code>/team/<id> (the game on now as the scorebug, Play, the
  season as a bar a game, one schedule by month with Against, homestands and road trips, Month view), BACKLOG 254 (m)'s team half.
  Story: https://claude.ai/artifact/GxZgu7KEX38h59Y2Kyq46g. The rows decided (one-team, with the couch on them: decisions.md). **Waits on the user's review** of the updated story.
- **A castaway opened from a week opens on that week, BACKLOG 251** (2026-11-22, approved, committed on master, not pushed; no
  migration): the castaway sheet leads with the week a door hands it; one name per moment everywhere (moment-names.ts); the
  Started cards' alignment fix. Story: https://claude.ai/artifact/DAwdM1gZTD4PtVQ1twyioq. **Waits on the user:** the push.
- **Admin, the full audit** (2026-11-22, on master as docs): phone first (the user uses admin on a phone more often than not).
  docs/design-round/admin-audit.md and https://claude.ai/artifact/6ijx8Nziw3NVn6fzCbhMoA. Waits on the user's 18 decisions and the four fix-now items (BACKLOG 250 the
  Back loop first); then three design rounds. Round 0's wide-screen shapes are replaced.
- **Game preview, branch `preview`** (lane rfl-preview): 17 commits not on master, 55 commits behind it, about 11 conflict
  hunks (strip.tsx, game-week.tsx, your-move.ts, tonight.tsx). It has P0, the visual story, the bench's preview maker and
  Round 5 (four real-app fixes, among them the finale reveal ranking a stage that had ended). It waits on the user's review of
  Round 5 (BACKLOG 155), then a rebase onto master and a merge. The branch's copy of PLAN-game-preview.md is current.
- **The local game writer, branch `writer`** (lane rfl-writer): 10 commits, docs and dev scripts only, merges cleanly. It
  records W4: a tuned 0.8B model is fast enough for a free VM, but right only about half the time when sure. It also carries
  C9's shuffled-bank decision in its copy of PLAN-start-a-game-gpt.md. Waits on BACKLOG 156.
- Every other local branch is merged. Four small branches (check-fix, docs-fix, fix-status-plate-dst, merge-engine) hold
  nothing that isn't on master (BACKLOG 186).

## Next

1. **Before Ep 10 (Wed 2026-11-25):** nothing left (247 checked: production's VM bot answers with ChatGPT). Nothing merges on
   the Wednesday.
2. **Thu 2026-11-26, after Ep 10:** BACKLOG 110 (watch the night). **Before the finale (Wed 2026-12-16):** walk Survivor 51's
   finale path once on the desk (what's left of 116); 248 (finding 21) is the rest of the finale's work.
3. **The quick sessions** in BACKLOG's "Now": the stale checks, the small engine fixes, the UI polish pass, the
   Designs-needed words batch, and the production check-ups.
4. **C8, the 2-on-1 head to head**, on a fresh branch from master (its seven answers are in decisions.md, 2026-11-19; who plays
   alone first is drawn at random), then the rest of the redo plan's E3.
5. **Sports, a lane of its own:** [PLAN-sports-ready.md](PLAN-sports-ready.md): Phases 0 and 1 and Phase 2 (2.1 to 2.8) are live (above); 2.7 and 2.8 too
   (2026-11-21); next is 4.1, then Phase 3. 1.1's part 4, the live screens, is the design round's page 2 and needs a small live
   read (polling the whole games read would be ~100 MB a phone an NFL game). Its words pass (4.0) can go in any free session.
6. The order after that is in [PLANS.md](PLANS.md).

**Waiting on the user:** BACKLOG's "Waiting on you" section, with a recommendation on each. The ones that unblock ready work
are 155 (preview), 156 (writer), 52, 158–159 and 94.

## Production

- **Hosting:** read [HOSTING.md](HOSTING.md) before adding anything that polls, runs on a schedule or stores data, and keep it
  current (the user's standing request). It's behind for 2026-11-16 to 11-19 (BACKLOG 154).
- **The repo is public** (since 2026-10-24): never commit secrets, real usernames or emails, or screenshots of real data.
- **A push to master deploys and migrates production.** Ask before pushing. Never push on a Wednesday (Survivor 51's night).
  Migrations are rehearsed on a Neon branch first (the deploy rehearsal routine).
- **Open production items:** the look-ups in BACKLOG 124 (bingo squares on Survivor 51's schedule, the bot VM's queue, Vercel
  storage, Neon's numbers, Below Deck 13's cast, The Traitors 5's groups); the Neon password (183); the image server's key
  (107); the listings backstop (184). Google sign-in stays off (185); the desk's tie-break run has been on since 2026-11-20.
- **Who uses it:** one couch. The user (Conor) is the site admin. Their friends play Survivor 51's three real games, and
  production's other leagues don't matter (the memory "Only three real leagues"). Judge the UX by the archetypes in
  docs/ARCHETYPES.md: Joanna forgets, Andrew drives by, Conor tinkers. Most use is on phones, so design and check at 390 first.
  A screen recording is the usual bug evidence; frames can be pulled with Python and OpenCV.

## Working conventions

- **Branches and pushes.** Work on a branch, verify, and merge at natural boundaries. Ask the user before pushing: a push to
  master is a production deploy, and they decide when production moves. Write clear commit messages ending with the attribution trailer. Hold back anything user-facing for
  approval when asked (scoring values, prompt changes, What's New); the user approves lists by number.
- **Before a push:** `npx tsc --noEmit -p .`, `npx eslint src` and `npm test`. ESLint doesn't run on tests/. If tsc complains
  about `.next/types`, `rm -rf .next/types .next/dev/types && npx next typegen`. No Prettier: never run a formatter.
- **A change to how games score:** take a fresh production backup and run `node scripts/dev-test/compare-totals.js
  --backup=<folder>`. It scores every league with the live engine and this tree's, and lists any whose table would change.
- **A change to when anything locks:** rerun every check that asserts a lock at airtime (check-trivia-game.js was once
  missed), and check-lock-in.js.
- **Tests and fixtures:** reuse and extend scripts/dev-test/ (CLAUDE.md, "Testing: build for reuse"). Key test rows on a `zt-`
  prefix with an up/down pair. Run one check on a fixture at a time. Long checks (golden, blind, the rehearsal) run once per
  step, last.
- **Python on this Windows machine:** `encoding='utf-8'` on read and write, and `newline=''` to keep line endings. Long inline
  Python inside a bash heredoc fails with "unexpected EOF": write the script to the scratchpad and run it.
- **Migrations** are hand-written SQL in `db/migrations/NNNN_*.sql`. `db/*.js` and `src/lib/game/*.js` are CommonJS with a
  `.d.ts` beside them, so the CLIs and jobs run under bare `node`. Never force-re-run a data migration.
- **React rules the linter enforces:** no `Date.now()` or module-variable writes during render, and no reading a function
  before it's declared. Put "now" in an effect, or derive it from data.
- **Mobile layout pitfalls:** fixed elements have `offsetParent === null` (measure them by their bounding box); content that
  ends up outside the page widens it and stops Android Chrome painting the fixed tab bar (`body` has `overflow-x: clip`); many
  filtered elements on one page also upset painting.
- **Secrets:** never commit them (`.env.local` is ignored), never ask for the production database URL, and keep model
  identifiers out of commit messages beyond the trailer. Nothing may spend the site's paid AI keys: AI help goes through our bot.
- **Worktrees:** never run `next dev` or `next build` in a worktree whose node_modules is junctioned to main. A second dev
  server on one checkout uses `NEXT_DIST_DIR`.
- **Running the dev-test checks from a Linux cloud session:** the steps are in the archived log, "Running the dev-test checks
  from a Linux cloud session" (pgvector, Better Auth's CLI first, `browser.js` pointed at a Linux Chromium).
- **UI work** goes through the design process (docs/DESIGN-PROCESS.md: Intent, then Perception-First Design, then Impeccable),
  phone first at 390, and reaches the user as a captioned before/after screenshot story published as an Artifact. Then pause.
- **Comments** explain why, matching the existing style.

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

## Live (production = origin/master, d4e594cf, deployed 2026-11-20)

Newest first. The plan or archive section named holds the detail.
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

- **Settings overhaul, Round 1, branch `settings-plan`** (lane rfl-settings, port 3018): Your settings and notifications as one
  system, built through the design process (PFD 82, Impeccable 33/40 after one batch of fixes). Reviewed 2026-11-20 on its story,
  https://claude.ai/artifact/97sfST4Ut41ib5HUHJPpjH: the user took all four picks and the sheet's ring fix, both built
  (decisions.md). Before merging: rewrite the browser halves of check-new-settings, check-new-notify and
  check-new-sharing for the new screens, rehearse migration 0447, and expect a conflict in src/new/data.ts (the sports lane edits it;
  this branch only removes `useAiChoice` and the `ai` field). The branch also holds origin/master's five commits from 2026-11-20
  that local master lacked. [PLAN-settings-overhaul.md](PLAN-settings-overhaul.md), Round 1.

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

1. **Before Ep 10 (Wed 2026-11-25):** BACKLOG 111 (Tonight forgets a Not yet) and 39 (the sign-in pool's crash risk). Nothing
   merges on the Wednesday.
2. **Before the finale (Wed 2026-12-16):** BACKLOG 115 (tell pool players the finale rule; the user OKs the words) and 116 (the
   finale through research).
3. **The quick sessions** in BACKLOG's "Now": the stale checks, the small engine fixes, the UI polish pass, the
   Designs-needed words batch, and the production check-ups.
4. **C8, the 2-on-1 head to head**, on a fresh branch from master (its seven answers are in decisions.md, 2026-11-19; who plays
   alone first is drawn at random), then the rest of the redo plan's E3.
5. **Sports, a lane of its own:** [PLAN-sports-ready.md](PLAN-sports-ready.md): Phases 0 and 1 and Phase 2's 2.1 to 2.6 are live (above); next is
   2.7 (a game through the playoffs) and 4.1, on a fresh branch from master. 1.1's part 4, the live screens, is the design round's page 2 and needs a small live
   read (polling the whole games read would be ~100 MB a phone an NFL game). Its words pass (4.0) can go in any free session.
6. The order after that is in [PLANS.md](PLANS.md).

**Waiting on the user:** BACKLOG's "Waiting on you" section, with a recommendation on each. The ones that unblock ready work
are 155 (preview), 156 (writer), 52, 157–159 and 94.

## Production

- **Hosting:** read [HOSTING.md](HOSTING.md) before adding anything that polls, runs on a schedule or stores data, and keep it
  current (the user's standing request). It's behind for 2026-11-16 to 11-19 (BACKLOG 154).
- **The repo is public** (since 2026-10-24): never commit secrets, real usernames or emails, or screenshots of real data.
- **A push to master deploys and migrates production.** Ask before pushing. Never push on a Wednesday (Survivor 51's night).
  Migrations are rehearsed on a Neon branch first (the deploy rehearsal routine).
- **Open production items:** the look-ups in BACKLOG 124 (bingo squares on Survivor 51's schedule, the bot VM's queue, Vercel
  storage, Neon's numbers, Below Deck 13's cast, The Traitors 5's groups); the Neon password (183); the image server's key
  (107); the listings backstop (184). Google sign-in and the tie-break run stay off (185).
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

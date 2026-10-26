# Hosting: what runs where, its limits, what uses them, and what more would cost

**Keep this current.** Update it in the same commit as any change that adds or changes polling, a scheduled
job, stored data, or a service, and whenever usage is checked (date the numbers). It exists so that, when a
free plan stops being enough, choosing the cheapest fit is arithmetic, not research. Last updated
**2026-10-25**.

## The stack

| Service | What it does for us | Plan | Cost now |
|---|---|---|---|
| **Vercel** (team `reality-fantasy-leagues`, project `tvleagues`) | The Next.js app, its API routes, `/mock` | Hobby | $0 |
| **Neon** (project `reality-fanatsy-leagues`, AWS us-east-2, Postgres 18) | Every table, auth included | Free | $0 |
| **Oracle Cloud** (`gys-bot`, VM.Standard.E2.1.Micro: x86, 1 GB) | The ChatGPT bot (`C:\Users\conor\llm-browser-api`) and the bot research clock | Always Free | $0 |
| **Cloudflare** tunnels | `bot.gameyourshow.com` (the VM), `bot-home.gameyourshow.com` (the PC fallback) | Free | $0 |
| **GitHub** (`clydon/reality-fantasy-leagues`, **public since 2026-10-24**) | The code; Actions runs the hourly job (`auto-research.yml`: auto-research, reminders, waivers) and the nightly wiki sync | Free; Actions minutes unlimited while public | $0 |
| healthchecks.io | Emails when the bot's daily self-test fails | Free | $0 |
| Resend | Sign-up and password emails | not checked | $0? |
| **TVmaze** API (`api.tvmaze.com`, new design step 10 part 1, on the branch) | TV listings for Add a show: the show search as you type, a show's seasons and episode air times when someone adds it, and its cast when someone makes a series or talk show a game (step 10 part 2a). Asked only then, never on a timer (step 11's daily schedule job is still to come) | Free, no key. Data is CC BY-SA (credited with a link back on Add a show); at least 20 calls every 10 seconds per IP, else HTTP 429; posters hotlinked from its image CDN (allowed) | $0 |
| Google Cloud OAuth client (**not made yet**: the user's, step 9 part 2) | Continue with Google on the new design's way in. Off until `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set (no keys, no button) | Free (sign-in only: the email, profile and openid scopes, no verification review needed) | $0 |
| Anthropic API | Paid auto-research (Claude), only for seasons switched on | Pay per use | per episode researched |
| Domain `gameyourshow.com` | Bought 2026-10-12 | not recorded | yearly |

## Alerts (open problems)

- **Vercel Hobby: "Exceeded free resources"**, Functions Storage 14.52 GB of 10 GB (seen 2026-10-24). Cause not
  looked into; a likely suspect is every retained deployment keeping its function bundles (the embedding
  model under `.models/` is fetched at build). Check Vercel › Usage and deployment retention.
- **The Neon password hasn't been rotated** since it was pasted into a chat on 2026-10-18 (a precaution, not a
  known leak; the user deferred it on 2026-10-24). Steps under "Rotating the database password".

## The repo is public

Public since 2026-10-24, so Actions minutes are free (a private account gets 2,000 a month; GitHub had stopped
the jobs on 2026-10-19 when they ran out). What that means:
- **Anything committed is readable by anyone, history included.** No secrets (they live in Vercel, Neon,
  GitHub secrets and `.env.local`), and **no real people's data**: no screenshots of real leagues or admin
  screens, no real usernames or emails in tests and docs (use the mock's demo names: alex, riley, jordan,
  sam). `.gitignore` covers `backups/` and the screenshot folders (`docs/ux-baseline/`, `docs/screenshots/`,
  `captures/`).
- Before going public the history was scanned and rewritten (git-filter-repo): the `docs/ux-baseline`
  screenshots (their admin screens showed real accounts' emails) removed from every commit, two real usernames
  and two partial emails replaced with demo ones, and commit emails moved to GitHub's private noreply address
  (this repo's `user.email` is set to it). The old history is kept, locally only, in
  `C:\Users\conor\rfl-history-before-scrub-2026-10-24.bundle`: it still holds that personal data, so it never
  goes anywhere public. GitHub can keep old commits reachable by their old hashes until it cleans up; nobody
  outside had them while the repo was private, and GitHub Support can purge them on request.
- **Going private again later** (a paid app): one switch (Settings › Danger zone, or `gh repo edit --visibility
  private`). Actions then counts minutes again: about 775 a month for these jobs (a run takes 35-50 s, billed as
  a minute; 24 a day plus the nightly sync), inside the free 2,000 unless other private repos share them.
  Anything public in the meantime may have been copied.

## Limits and usage

Snapshot **2026-10-24**. Neon's numbers are since its period start (Sep 30); Vercel's are its current cycle.

| Limit | Free allowance | Used | Notes |
|---|---|---|---|
| Neon query results sent ("network transfer") | 5 GB a month per project | **4.73 GB** | Running out suspends the database until the month resets. Was the chat polls (see Changelog) |
| Neon compute | 100 CU-hours a month per project | 35.38 CU-h | Running out suspends the database. Free computes sleep after 5 minutes idle and can't be kept awake |
| Neon storage | 1 GB per project (the billing page; one FAQ says 0.5) | 38.77 MB | Plus 254 kB of history |
| Neon history (point-in-time restore) | 6 hours | | So the JSON backups (`scripts/backup-leagues.js`) and named branches are the real safety nets |
| Neon branches | 10 per project | 2 | `production`, and `pre-new-design-2026-10-24` (made before migration 0066 shipped; never auto-deletes) |
| Vercel function invocations | 1M | 92K | |
| Vercel Fluid Active CPU | 4 h | 1 h 24 m | |
| Vercel CDN requests | 1M | 168K | |
| Vercel Functions Storage | 10 GB | **14.52 GB** | See Alerts |
| Vercel cron | once a day on Hobby | unused | Why the bot clock lives on the VM |
| Vercel Preview builds | | off | Ignored Build Step = "Only build production" since 2026-10-24: Preview shared production's database and every build runs migrations |
| GitHub Actions | unlimited while public (2,000 min a month if private) | ~775 min a month | See The repo is public |
| Oracle VM | 1 GB RAM, 1/8 OCPU burstable | | One question at a time: ~48 s with web search, ~114 s for a full research prompt |

## What uses each limit (for estimating)

**Neon compute** is about 0.25 CU × the hours in which any query ran in the previous 5 minutes (more when it
scales up under load). So what matters is how often something wakes it, not how much it does:

| Waker | Awake time | CU-hours a month |
|---|---|---|
| Hourly GitHub job (when it runs) | ~6 min an hour | ~18 |
| Bot research clock, after 2026-10-24 | each episode night's runs, plus a check-in every 6 h | ~3 per show airing |
| Tie-break runs (new design, step 6c; off until switched on in desk › Settings) | one call a day after a dispute, up to 3 tries | a few minutes per disputed episode |
| Bot research clock, before (a call every 2 min) | around the clock | ~180 (over the allowance) |
| People with the app open (classic, or a new-design show space: its Chat badge polls) | while they're on it, plus 5 minutes | the rest: ~20 in Oct 1-24 (35.4 total, less ~11 for the hourly job until it stopped and ~3 for the clock's first night) |
| Admin bot-research runs panel | polls every 60 s while open | admin only |

**Neon transfer** is bytes queries send back. Polls dominate it. Per screen open on a league (estimates, not
measured; measure from Neon's usage a week after a change):

| Poll | Every | Read from Neon |
|---|---|---|
| League state (`/state`) | 15 s | ~2 KB (a hash check; the full 20-40 KB state only when it changed; ~5-14 KB more per league with the rulebooks flag on, see Changelog) |
| Unread chat (`/chat/unread`) | 15 s | under 1 KB (a count) |
| Your moves (`/api/me/actions`) | 30 s | ~1-2 KB (hashes; full states only when changed) |
| Open chat (`/chat?v=`) | 5 s | under 1 KB when nothing changed |
| **Per open screen** | | **~1 MB an hour** (it was ~70 MB an hour before 2026-10-24) |
| New design, a show space: the Chat tab's badge (`/api/seasons/[id]/chat/unread`) | 30 s | under 1 KB (a count) |
| New design, the open Chat tab (`/api/seasons/[id]/chat?v=`) | 5 s, in place of the badge | under 1 KB when nothing changed (32 characters) |
| **Per open new-design screen** | | **~0.1 MB an hour** on a show space, ~0.5 MB on its Chat tab; nothing on the hub |
| New design, One tap asking (`/api/seasons/[id]/backstage/ask?run=`) | 2.5 s, only while the bot answers (~1-2 min) | under 1 KB (the run's row) |
| New design, Backstage › Results while a One tap runs (`/backstage/ways`) | 4 s, only while one runs | ~1 KB |
| New design, an episode page while the bot adds a show change (`/api/seasons/[id]/show-changes/[n]`) | 4 s, only while it's added (~1-3 min) | under 1 KB |
| New design, Make it a game while our bot asks (`/api/seasons/[id]/make?poll=1`) | 3 s, only while the bot asks (~2-4 min, once per show set up) | under 200 bytes (a version: one small row); the page reads the whole review (~10-20 KB) only when it moves |
| New design, the open draft room (`/api/seasons/[id]/draft?v=`) | 4 s while a turn-based draft is live; 15 s while a draft waits to start or people lock in a blind draft; not once it's done | ~1-2 KB (a hash check per game, a few small reads: your seat, queue and mark); the answer is 16 characters when nothing changed, else the draft (~10-20 KB) |

**The way in (new design, step 9 part 2)** polls nothing. First run's catalog (`/api/catalog`, open signed out: every
curated season with how far it's aired, a few KB) is the same for everyone, so Vercel's edge keeps it for five minutes
(`s-maxage=300`): crawlers and first-time visitors don't reach Neon more than once every five minutes for it. The
landing (`/welcome`) reads nothing from Neon (its faces and numbers are a static file); its show tiles come from that
cached catalog.

**Playing solo (new design, step 9 part 3)** polls nothing and runs nothing on a schedule. A season's **public pool**
("Survivor 51 · Everyone") is one league whose state holds every player: about **2 KB per player per season** (a seat, a
pick and a Who goes home? call each episode; measured: 195 KB for 100 players at a season's end, 573 KB for 300). Every
pick or call changes its hash, so the next read of it by anyone (their hub, the show space, the pool's page) fetches the
whole state again. At 100 players opening something that reads it ~5 times a week, that's roughly 500 reads × ~100 KB
(the season's middle) = **~200 MB of Neon transfer a month**; at 300 it would be ~1.8 GB, a third of the allowance, which
is why a pool holds at most **100** (`POOL_CAP` in `solo.ts`; "The pool is full"). Past that the picks would move into a
table of their own (one row per person and episode) and the board become a SQL read of the top ten and you. What a pool's
reads *send to the browser* stays small however big it gets: the top ten, you and your neighbours, and who's picked as a
count. A **practice couch** is an ordinary small league (you and three computer players, ~20-40 KB like any) per person
per season; the computer players take their turns inside the writes and reads that already happen (a pick, results
arriving, someone opening the game), so they wake nothing.

**Watching (new design, step 10 part 1)** polls nothing and runs nothing on a schedule. **Add a show's search** asks
`/api/listings/search?q=` once typing pauses (300 ms): one Vercel invocation per query, nothing from Neon, the answer kept
at the edge for an hour per query (a minute when TVmaze didn't answer), and one TVmaze call when it isn't cached. Its other
suggestions come from the catalog (`/api/catalog`, already cached at the edge for 5 minutes), which now lists **every**
show's seasons, not only the curated ones: about 250 bytes a season from Neon per uncached read, so it grows with each
show people add (fine at hundreds of seasons; past ~1,000, at most 12 uncached reads an hour, it would approach 1-2 GB of
transfer a month, and the search should move to the server). **Adding a show** nobody has added before is two TVmaze calls
(the show with its seasons, then one season's episodes) and a few small writes: a `shows` row (with its listing, ~1 KB), a
`show_seasons` row and a `season_episodes` row per episode (~100 bytes each), at most 10 new shows per person a day
(`NEW_SHOWS_A_DAY` in add-show.ts). Adding it again a day later reads that season's episodes again (the only refresh until
step 11's job). A show's poster is TVmaze's medium image, hotlinked (~25 KB; its only other size is the upload itself, often
over 1 MB, so it's never used). The hub's home read now also carries the couch's shows you don't follow (their headers and
schedules: a few hundred bytes each), and the show space's read one more small query (whether you play the season).

**Vercel invocations** are one per poll: about 10 a minute per open screen (600 an hour); 18 a minute on the
chat page (its 5-second poll replaces the badge's). The new design: 2 a minute on a show space, 12 on its Chat tab,
none on the hub.

**Rough scale, so the first wall is visible:** 100 couches of 4, each person with a screen open 3 hours a week,
is about 5,200 screen-hours a month: ~5 GB of Neon transfer (the free limit) and ~3M Vercel invocations (three
times Hobby's). Polling is the first thing growth hits; see Levers.

**Bot capacity:** each episode needs a quick check (usually 2-4 tries of ~48 s) and two full runs (~2 min each),
so about 5-8 minutes of bot time per show per episode, one at a time. Ten shows ending at the same hour would
push the last one's results about an hour back; a second bot (the PC fallback, or a second free VM) halves that.
One tap (new design, step 6c) adds one question per tap: who went home (~48 s) or the full results (~2 min). Results
are shared per season, so an episode needs at most one of each from any couch (a second tap joins the one running),
unless a dispute asks again: the tie-break run (step 6c part 2, off until switched on) is one more full question for an
episode disputed a day, and a show change the couches confirm one rulebook question (~1-3 min). Make it a game (step 10
part 2a) asks once per show anyone sets up: how it works (the rulebook question, ~1-3 min), then who's in it (~1 min; not
asked for a series or a talk show whose cast the TV listing has); at most 5 attempts per person a day, and a second tap
joins the one running.

**Vercel function time (One tap):** the bot is asked after the tap's request has answered (`after()`), so a function
stays alive while it waits, up to the route's 300 s (typically 40-120 s). That's mostly waiting: little Active CPU, but
provisioned memory for the whole wait (about 1 GB × 2 minutes per full-results tap). Make it a game's ask works the same
way, both its questions in one request when they fit in 300 s (else the open page asks for the second in a request of its
own): about 1 GB × 2-4 minutes per show set up.

## Levers, cheapest first

1. **Poll less** (free): one combined poll instead of three; stop polling when the window isn't focused (today
   only a hidden tab stops); slow down when nothing has changed for a while; push for the rare events.
2. **Free capacity elsewhere**: the bot clock already runs on the VM; the hourly job could too. Oracle's Always
   Free also offers Arm A1 machines (up to 4 OCPU / 24 GB) when the region has capacity: a bigger or second bot.
3. **Neon Launch** (prices from the Neon billing page, 2026-10-24): usage-based, $0.106 per CU-hour and $0.35 per
   GB-month, 500 GB of transfer per project, longer point-in-time restore, and compute can stay awake. At
   today's ~50 CU-hours that's about $5 a month; kept always awake at 0.25 CU, about $19.
4. **Vercel Pro**: per member per month with larger included usage (check current pricing and inclusions before
   deciding; not verified here).
5. **The bot tiers** (One tap $1 a season, Autopilot $5) are meant to pay for the research they trigger.

## Rotating the database password

The production connection string lives in exactly two places: Vercel's `AUTH_DATABASE_URL` (Production and
Preview) and the GitHub Actions secret `AUTH_DATABASE_URL` (the hourly job). The VM doesn't have it. Claude
never handles it: the user does the reset and the pasting.
1. Neon › project › Roles › `neondb_owner` › ⋯ › Reset password. Production fails from here until step 3 is live
   (3-5 minutes), so do 1-3 back to back at a quiet time.
2. Vercel › Settings › Environment Variables › `AUTH_DATABASE_URL` › Edit › paste. Use the same form as before:
   direct (connection pooling off) unless the old host had `-pooler`. `db/migrate.js` holds a session advisory
   lock, which a pooled (transaction-mode) connection can't keep.
3. Redeploy production (Deployments › the current one › Redeploy): environment changes only reach new deploys.
4. GitHub › Settings › Secrets and variables › Actions › `AUTH_DATABASE_URL` › Update.

## How to check usage

- **Neon**: console › project › Overview (compute, storage, history, transfer since the period started);
  Monitoring › Query performance (top queries, but only since the compute last woke). A banner warns near a limit.
- **Vercel**: dashboard › Usage; Settings › Build and Deployment for the Ignored Build Step.
- **GitHub**: `gh run list --workflow=auto-research.yml --limit 5` (green hourly; `gh workflow list --all` shows if one
  was disabled); Settings › Billing and plans for minutes once private.
- **The bot clock**: on the VM, `journalctl -u llm-browser-tick -n 20` (one line per call; nothing between).

## Changelog

- **2026-10-24.** Neon transfer was at 95% with a week left: every chat fetch read each linked league's full
  state once per member (~240 KB for 12 KB of chat). Fixed in 31294fd: `src/lib/server/league-states.ts`
  (hash check, cached copies), `/chat/unread`, `/chat?v=`; checked by `scripts/dev-test/check-chat-polls.js`.
  Vercel set to build production only. The bot clock's 2-minute tick kept Neon awake around the clock (~180
  CU-hours a month); now the app tells the VM when the next run is due (`db/bot-research.js` `nextRunAt`,
  llm-browser-api `deploy/tick.py`, `POST /tick` for schedule changes), runs count from the episode's end
  (0066 `episode_minutes`), and the quick check retries for 3 hours; checked by `tests/bot-research.test.js`
  and `scripts/dev-test/check-bot-clock.js`. Found GitHub Actions stopped since 2026-10-19 (Alerts).
  Then: the repo went public (history scrubbed first: see The repo is public) so Actions minutes are free; the
  hourly workflow, found disabled by hand on 2026-10-22, was re-enabled and both workflows ran green. Neon
  branch `pre-new-design-2026-10-24` created before 0066 shipped. Migration 0067 `season_episodes` (a row per
  episode whose start or length research confirmed: tiny) and the `season_air_dates` view, which every
  air-time query now reads (no extra polling). The VM's new tick deployed (13:44 UTC) and bot research switched on
  for Survivor 51 with a 90-minute episode length: the clock's next call is the quick check on 2026-10-29 01:40 UTC
  (Wednesday 9:40 PM Eastern), quiet until then apart from 6-hourly check-ins. Network transfer read 4.73 GB six
  hours after the polling fix (unchanged). The Neon password rotation was deferred (Alerts). Later the same day the
  user switched bot research off again: its full runs stage results for review, and unreviewed results aren't used
  (PLAN-new-design 6b). The clock has nothing scheduled, so it only checks in every 6 hours. Survivor 51's air time
  corrected to 8:00 PM (was 8:05). Migration 0068 adds the bot's schedule check (when the next episode airs and how
  long it runs, nothing to review): one bot question per episode, so a few minutes of Neon compute per episode night. Survivor 51's bot research is back on
  with only that check: its first run is 2026-10-29 02:00 UTC (Wednesday 10 PM Eastern, half an hour after episode 6).
- **2026-10-24, on the `new-design` branch (not deployed).** Step 0b's migrations 0100–0105 add four small tables:
  `couches`, `couch_members`, `couch_invites` (a row per couch, per person on it, per code) and `show_follows` (a row
  per person per season they follow or play): a few KB today, growing with people, not with play. Nothing new
  polls or runs on a schedule. Each classic reveal, join, late-join start, league made, left, linked or unlinked
  adds one or two tiny queries. The new design's `/api/me/home` and `/api/seasons/[id]/space` read only the fields
  they show (no league state but the action items', through `league-states.ts`) and aren't polled yet: whatever
  polls them later should poll something smaller. The rehearsal before deploying uses a third Neon branch (of the
  10 allowed); delete it once 0b is live.
- **2026-10-24, on the `new-design` branch (not deployed).** Step R3's migration 0107 adds `rulebooks` and
  `rulebook_edits`, filled by `db/backfill-rulebooks.js`: on the local copy of production 20 rows, 728 kB with
  indexes (a season's rulebook is ~29 KB: its blocks, its compiled data and the data it was frozen from; a library
  row ~19 KB), so about 30 KB more storage per new season. Nothing polls or runs on a schedule. With the rulebooks
  flag off (the default) the only new reads are one tiny `app_settings` row per season-research format lookup and
  per show or season change. **With the flag on, every league's state carries its rules** (`settings.rulebook`):
  +12.5 KB for a Survivor league, +14 KB Traitors, +5 KB Challenge, so today's 20-25 KB states become ~33-38 KB,
  and each full state read after a change costs that much more (the `/state` and `/api/me/actions` rows above:
  the hash checks are unchanged). If that matters when the flag goes on, the lever is to leave `data` out of an
  unedited built-in's `settings.rulebook` (formatOf would read the built-in's own data), which is most leagues.
  Rehearsal: `scripts/rehearse-migrations.js` now also runs the backfill and the read-only `rulebooks-flag.js
  check` on the branch.
- **2026-10-24, on the `new-design` branch (not deployed).** Step 0c, the new design's shell. Migration 0108 adds one
  column, `user_settings.ui` (classic or new). Classic's `/api/me` reads it (one tiny query on each app start) and
  sets a `gys_ui` cookie to match; a signed-in `/` with that cookie set to new is sent to `/home` by a `next.config.ts`
  redirect, which Vercel answers in its routing layer (no function, no database). The new design's signed-in pages
  read the session once per full page load (one Better Auth query, in place of classic's `/api/me` boot, which
  reads every league's state) and then `/api/me/home` and `/api/seasons/[id]/space` once a visit, again when you come
  back to the tab after a minute (react-query's refetch on focus), never on a timer. Nothing polls or runs on a
  schedule, and only accounts that opt in use any of it.
- **2026-10-24, on the `new-design` branch (not deployed).** Step 1, the show space on real leagues. No migration, no
  new table, nothing polled or scheduled. Two new reads, each once a visit (and on refocus after a minute):
  `/api/seasons/[id]/games` reads the states of your games on that show through `league-states.ts` (hash checks; a full
  20-40 KB state only when it changed, as `/state` does) and answers ~15-20 KB for three games; `/api/seasons/[id]/how-it-works`
  reads one state and the season's rulebook row only when the page opens (~9 KB out). `/api/me/home` now also says
  who's set for each show (its games' states, read just after the moves' own read, so hashes only). Saves go through
  the classic lineup, pick and prediction routes, asked `?quiet` so they answer `{ ok }` instead of the whole state.
- **2026-10-24, on the `new-design` branch (not deployed).** Step 2, episodes and the one reveal. Migration 0109 adds one
  nullable column, `show_follows.early_seen` (a number per person per season, set only while an early reveal waits on its
  final scores). An episode's stage rides in league state (`resultsStage: "early"` on an episode, a few bytes, absent
  for every episode today). Nothing polled or scheduled. `/api/seasons/[id]/episodes` (once a visit, and on refocus after a
  minute) reads your games' states through `league-states.ts` like `/games` (hashes when unchanged) and answers ~10-25 KB
  for a 13-episode season; a show you don't play reads the season's accepted eliminations (a few rows). The reveal
  (`POST /api/seasons/[id]/reveal`) is once per person per episode: classic's results-seen writes per league, one chat
  line per chat, two small `show_follows` writes, then the states again (~10 KB out). Share your night's "Post to the
  couch" is one ordinary chat message; its image is drawn in the browser (no server, no storage).
- **2026-10-24, on the `new-design` branch (not deployed).** Step 3, the cast explorer and stats. No migration, no new
  table, nothing polled or scheduled. `/api/seasons/[id]/stats` is read when the Cast tab, Tonight's Stats card, a stats page
  or By the numbers opens (once per show, then cached five minutes in the browser), and when the episode slider lets go;
  it answers ~5-15 KB (a cast of 18-24 over a season). It reads the season's cast (~20 small rows) and its accepted
  results: those are kept in the server's memory per season while unchanged, checked each time by one row (a count and an
  md5 the database works out), so a slider's every range and everyone on a couch cost the check rather than the few
  hundred rows (~40-60 KB at a season's end) again; plus one league state through `league-states.ts` (a hash when
  unchanged). A show you don't play builds its Episodes from the same read. Share this is one ordinary chat message.
- **2026-10-24, on the `new-design` branch (not deployed).** Step 4, one chat per couch and show. Migration 0110 makes
  `chat_messages.league_id` nullable and adds two nullable columns (`couch_id`, `season_id`, set only on a message about a
  show the couch watches without a game) and a small table, `couch_chat_reads` (a row per person per couch and show they've
  read): a few bytes a message, nothing more per league. The new design's **first polls**: a show space asks the Chat tab's
  badge every 30 s (a count worked out in the database, plus who's revealed the episode you're on when one's waiting: a few
  short reveal lines), and the open Chat tab asks every 5 s with its version, like classic's (`?v=`, an md5 of the messages
  and reactions in the database, so an unchanged chat sends 32 characters; the newest 300 only when it changed, ~30-60 KB for
  a busy week). Neither runs in a background tab. While someone has a show space open, Neon stays awake as it does for an
  open classic screen. The fold needs each episode's air time: kept in the server's memory per season for a minute rather
  than read on every poll. Posting writes one row (into the couch's first game on the show, so classic's chat shows it);
  reading writes `couch_chat_reads` and classic's `chat_reads` for the couch's games there. Backups take the couch's chat
  and its reads with the leagues (`scripts/backup-leagues.js`).
- **2026-10-25, on the `new-design` branch (not deployed).** Step 5, Backstage I. Migration 0111 adds `league_changes`
  (Recent changes): a row per league per change someone makes for others (results, settings, roles, the cast, waivers, the
  draft's start), ~0.3-1 KB each (a results change keeps its exact undo: a line per result it added, ~100 bytes each). A couch
  playing three games makes maybe 10-20 rows a week, so ~1 MB a season; nothing prunes them yet (an `undo` older than its
  `undo_until` could be nulled if it ever matters). Each logged write adds one insert and, for results and settings, one copy
  of the league state in memory (no extra read). Nothing polls or runs on a schedule: Backstage's read
  (`/api/seasons/[id]/backstage`) runs when a show space, Backstage or its Results page opens, for whoever runs a game
  there only (the ⋯ menu's dot; react-query keeps it 30 s, then refetches on focus; your games' states through `league-states.ts`, the season's staged results for the open episode, two small reads of
  `league_changes`; ~2-6 KB out), and Recent changes when its page opens (~1-10 KB). Ask an AI parks its question as a brief
  (`ai_briefs`, the classic flow's table: ~2 KB for the quick question, ~33 KB for the full one, expiring in a week) and
  pasting an answer is research's own paste (the same storage as before). No model is called and nothing costs money:
  copy and paste stays the free way.
- **2026-10-25, on the `new-design` branch (not deployed).** Step 6a, Backstage II. No migration, no new table, nothing
  polled or scheduled. New reads, each once a visit (react-query keeps them 30 s, then refetches on focus): your waivers
  (`/api/seasons/[id]/waivers`) when a show space opens for someone playing Outlast or Weekly Lineup there (Tonight's
  "Waivers ran" plate and Episodes' row share it) and on the Waivers page: your games' states through `league-states.ts`
  (hashes when unchanged), your own claim (one tiny `waiver_claims` row) and the stats' season facts (the same in-memory
  read as `/stats`), ~5-15 KB out. Backstage's Waivers, Game settings, Scoring rules and Members pages read when they open,
  for whoever runs a game there (~2-10 KB each; Scoring rules adds the rulebook row, Members one memberships query). Every
  write is one league write plus its Recent changes line, as before; a removal or leave keeps its undo for 30 days (one
  `league_changes` row per game). The run's "seen" mark is kept in the browser (localStorage), not the database.
- **2026-10-25, on the `new-design` branch (not deployed).** Step 6b part 1, results from everyone. Migration 0112: every
  answer sent is kept as its own `episode_research` row (a full answer's parsed JSON, ~10-30 KB; who went home or a tick,
  under 1 KB), plus `fact_sources` (~100 bytes per result per answer), `fact_disputes` and `league_rulings` (a few rows a
  season). Two couches filling in every episode of a 13-episode season is under 1 MB. Nothing polls or runs on a schedule.
  The cost that grows is writes: an answer now brings every league on the season in line (the season sync: each league
  locked, read and written once, about what an admin's Accept already did for Survivor 51), where step 5 wrote only the
  couch's games, and a correction adds a `league_changes` row per league it reaches. New reads, each once a visit: an
  episode's page reads its shared results (`/api/seasons/[id]/results/[n]`: the episode's facts, sources, flags, the couch's
  corrections and rulings; ~2-6 KB), the episodes read adds one corrections query, Backstage's read adds who filled each
  recent episode in, the open questions and the couch's flags (~1-3 KB), and the stats read one query for its "1 source"
  marks.
- **2026-10-25, on the `new-design` branch (not deployed).** Step 6b part 2, the admin's desk and the rulebook editor.
  Migration 0113: `admin_changes` (one row per desk change with its undo, under 1 KB; a handful a week),
  `rulebook_suggestions` (a note each), two lock columns and `show_seasons.rulebook_live`. Nothing polls or runs on a
  schedule. Every desk read is a site admin opening a page: the Inbox (a few small queries and four counts over the week's
  results, ~1-3 KB; also when a site admin opens the profile menu), Find (at most ~40 rows), each page ~2-10 KB, a
  rulebook's ~30-60 KB (its blocks as they are now and How it works). Writes: deciding a result or overriding a castaway
  brings every league on the season in line (the season or cast sync, as an admin's Accept already did); switching a
  season's leagues onto its rulebook adds `settings.rulebook` to their state (+5-14 KB each, R3's figure, which the 15 s
  state poll's hash check absorbs) and every later save rewrites it; Fix a mistake also reads the season's pasted answers
  again (one pass over a few dozen rows). Save as a starting point adds one library rulebook (~30 KB). Changing Confirmed
  needs settles every community result again but syncs only seasons where something moved. Backups now include
  `rulebooks` (~30 KB a season) and `rulebook_edits`.
- **2026-10-25, on the `new-design` branch (not deployed).** Step 6b part 3, Make it ours. Migration 0114: `couch_answers`
  (one row per person per couch moment per episode, under 200 bytes). A couch that makes its rulebook its own adds one
  rulebook row (~30 KB) and puts `settings.rulebook` into each of its games' state (+5-14 KB each, R3's figure; the real
  couch's three games would carry it if they made it theirs); every change to the copy rewrites that in each game. Nothing
  polls or runs on a schedule. New reads, each once a visit: Scoring rules adds the copy's half (a few small queries,
  ~1-3 KB), and an episode's page asks for the couch's own moments (one small read; empty for a couch without any). An
  answer writes one row and, when it settles something, each of the couch's games once.
- **2026-10-25, on the `new-design` branch (not deployed).** Step 6c part 1, how results get in. Migration 0115:
  `results_plans` (a row when a couch unlocks One tap for a season; nothing is charged in beta), `quick_waits` (a row per
  quick check that couldn't be sure, under 1 KB), and two columns on `bot_research_runs` (each One tap is a run row, ~1 KB
  with its outcome). **One tap** asks the bot from the server: the request answers at once and the function stays alive
  until the bot does (`after()`, at most 300 s; see Vercel function time above); the sheet polls the run every 2.5 s
  while it asks, and Backstage › Results polls the ways every 4 s while one runs (both under 1 KB a time, both stop when
  it's done). Opening the Ask an AI sheet asks the bot's `/health` (a call to the VM, no database; cached 20 s). **The
  bot's scheduled runs are now sources** (`src/lib/server/bot-results.ts`): what's trusted reaches every league on the
  season through the season sync (each league locked, read and written once, as a paste does), and a quick check that
  isn't sure waits for a commissioner and counts as a failed try, so it's asked again on the quick check's usual retry
  pace (every 5 minutes for half an hour, then every 15, for up to 3 hours: the same rule as "no source yet"). Survivor
  51's schedule is unchanged (only the schedule check), so nothing new runs on production when this ships.
- **2026-10-25, on the `new-design` branch (not deployed).** Step 6c part 2, settling without the admin. Migration 0116:
  `rulebook_notices` and `rulebook_notice_votes` (a row per episode whose research said the show changed, and one per
  person who answered; under 1 KB each, a handful a season), new kinds on `season_decisions` ("nobody went home", a fact
  like any other) and `bot_research_runs`. **The tie-break run** is a scheduled bot run: when a shared result has been
  disputed for a day, the bot asks that episode's full research once more (~2 min of the bot, up to three tries 20 minutes
  apart). It's planned with the rest (`db/bot-research.js planRuns`), so the VM's clock is told when one is due and calls
  only then; planning it adds one tiny `app_settings` read to each clock call, and while it's on two small queries (the
  episodes with a question open, their tie-break history). It's **off** (desk › Settings); switched on, it reaches every
  season with shared results. A flag, and the switch, tell the clock at once in production (one planning pass and one
  call to the VM). **Show changes the couches confirm**: once two couches agree an episode brought something new, the bot
  is asked the rulebook question once (~1-3 min of the bot), after the vote's response (`after()`, at most 300 s: Vercel
  function time, as One tap), and the episode's card polls every 4 s while it's added (under 1 KB a time; it stops when
  it's in). The rulebook's edit is written like the desk's The show changed (its version moves on; leagues on rulebooks
  rewrite `settings.rulebook`). The desk's season page reads the season's bot schedule and its last 6 runs (~1-2 KB).
  Nothing else polls; "nobody went home" is a fact like any other (one row, applied by the season sync).
- **2026-10-25, on the `new-design` branch (not deployed).** Step 7, the draft room and the blind draft. Migration 0117:
  `draft_queues` (each player's starred castaways in a game: a handful of ids, one row per player per game with a draft;
  backed up with the league). League state gains the draft's own log (`draftLog`: one small entry a pick, ~100 bytes, so
  ~1-2 KB for a 16-pick draft) and two timestamps. **The draft room polls** while it's open (`/api/seasons/[id]/draft?v=`):
  every 4 s while a turn-based draft is live, every 15 s while a draft waits to start or a blind draft waits for people
  to lock in, and not at all once every draft on the show is done; each poll is a hash check per league (league-states.ts)
  plus a few small reads (your seat, your queue, your mark), and an unchanged draft answers its 16-character version. A
  draft is an evening's thing: four people in the room for an hour is ~3,600 calls (Vercel) and a few MB from Neon, once a
  season. The pick timer (off by default) has no job of its own: when it runs out, any phone in the room asks the server,
  which checks the clock and, if the game says so, picks from their queue. The ⋯ menu reads the drafts once when it opens.
  Nudge sends one push (once a turn). Nothing runs on a schedule.
- **2026-10-25, on the `new-design` branch (not deployed).** Step 8, Hub I. **Nothing polls and nothing runs on a
  schedule**: the hub still reads only when it opens (and after a reveal), never on a timer. Opening it is now two reads
  instead of one: `/api/me/home` (as before, plus a hash check per league of yours, which league-states.ts answers from
  its cache, and one small `show_follows` read, for "results are in" and the morning update) and the new
  `/api/couches/[id]/hub` (power rankings, the trophy shelf, Commercial break's games, By the numbers' couch accolades,
  your numbers and On the couch): a hash check per game on the couch, the couch's memberships, your mark per season, the
  seasons' schedules, people's shared follows, a count of the couch's messages this month, and the newest 40 messages
  with their reactions (folded past where you are, on the server). About 5-15 KB from Neon per open for a couch like the
  live one, and two Vercel invocations; it's cached a minute in the browser. Previously on reads each show's episodes
  and stats when you open it (the same reads the show space makes; stats are cached on the server by the decisions'
  md5). Migration 0118 adds `show_follows.early_night` (JSONB): what your Weekly Lineup stood at when you revealed an
  episode early (the total, your starters' points, the table: a few hundred bytes), kept only until you've seen that
  episode's final scores, then cleared, so the morning update can show "so far +14 › final +22".
- **2026-10-25, on the `new-design` branch (not deployed).** Step 9 part 1, couches and joining their games. **Nothing
  polls and nothing runs on a schedule.** Migration 0119 adds `couch_members.via` (a word per member) and
  `game_join_requests` (one small row each time someone asks to join a game: who, which game, when it was answered and
  how). `couch_invites` (from 0100) now gets rows: one code per person per couch, made the first time they open Invite
  (a few dozen bytes each). New reads, each only when a screen or sheet opens: an invite page (`/api/couches/invite/[code]`,
  open signed out: the couch, its members and its games' join rules, a hash check per game; a few KB), the couch's games
  and who may join them (Commercial break, a show's Games tab when there's a game you're not in, the join sheet: a few KB),
  and the catch-up reveal (one game's episode, like a reveal). The chat badge's 30-second poll asks a slightly different
  question about late joiners (who the games can't see, instead of who's catching up) from the same league states, at the
  same cost. Two new pushes, both rare: a join request to whoever runs the game, and "You're in" when they're let in.
- **2026-10-25, on the `new-design` branch (not deployed).** Step 9 part 2, the way in. **No migration, nothing polls,
  nothing runs on a schedule.** New reads: the catalog (`/api/catalog`, signed out, cached at the edge for 5 minutes,
  a few KB), and first run's save (`POST /api/me/first-run`: one `show_follows` row per show picked, and
  `user_settings.ui`), once per new account. A new setting, `app_settings 'signups'` (the desk's Who gets in: approve /
  invites / open; unset means invites, the user's call: an invite lets a new account straight in, anyone else waits). A new service once the user makes it: a **Google
  OAuth client** for Continue with Google (free; Better Auth keeps each Google sign-in's tokens in `account`, encrypted
  now with `account.encryptOAuthTokens`: a few hundred bytes per Google account). Password resets and email
  verification go through Resend as before (a sign-up that gives an email gets one verification email; nothing new is
  sent otherwise).
- **2026-10-25, on the `new-design` branch (not deployed).** Step 9 part 3, solo. **Nothing polls and nothing runs on a
  schedule.** Migration 0120 adds `leagues.solo` ('public' | 'practice') and `leagues.solo_season_id`. New stored data:
  a **public pool** per season (one league made by its first Join; ~2 KB per player per season in its state, capped at
  100 players, so at most ~200 KB a pool) and a **practice couch** per person per season (an ordinary small league with
  three computer players). The pool is read in full after any pick or call changes it (league-states.ts' hash check
  otherwise): ~200 MB of Neon transfer a month for a full pool's 100 people (What uses each limit). New reads, each when
  a screen opens: `/api/me/solo` (the solo hub: per show you follow, its pool and your practice couch), `/api/seasons/
  [id]/pool` and `/practice` (the Games tab and the pool's page). The computer players' moves happen inside writes and
  reads that already happen (bots.ts in withLeagueLock; league-read.ts readyLeague), so nothing new wakes the database.
  A pool's players get the usual results pushes from the season sync (as any league's do); nobody hears who joined.
- **2026-10-25, on the `new-design` branch (not deployed).** Step 10 part 1, watching. **Nothing polls and nothing runs on
  a schedule.** A new service: the **TVmaze API** (free, no key, CC BY-SA, credited on Add a show), asked through
  `/api/listings/search` (edge-cached an hour per query, no Neon) and `/api/listings/[id]` (one show's season and how much
  has aired, edge-cached an hour) and when someone adds a show (`POST /api/me/shows`: two TVmaze calls for a show nobody
  has added). Migration 0121: `shows.set_up_at` (NULL = not a game yet), `shows.tvmaze_id` and `shows.listing`,
  `show_seasons.listing_id` and `listing_fetched_at`, `season_episodes.source` may be 'listing', `show_follows.nudge_off_at`.
  New stored data per added show: ~1 KB for the show, a season row and ~100 bytes per episode; at most 10 new shows per
  person a day. The catalog now lists every show's seasons (it grows as people add shows; What uses each limit says when
  that starts to matter). Posters are hotlinked from TVmaze's CDN at its medium size (~25 KB).
- **2026-10-25, on the `new-design` branch (not deployed).** Step 10 part 2a, Make it a game. **One new poll, only while
  our bot asks** (`/api/seasons/[id]/make?poll=1` every 3 s, a version of under 200 bytes, a few minutes once per show set
  up); nothing runs on a schedule. Migration 0122: `show_setups` (one row per attempt at setting a show up: ChatGPT's two
  answers kept as text, ~10-40 KB, at most 5 attempts per person a day). Setting a show up stores its season's rulebook
  (blocks and compiled rules, ~20-60 KB), the same rules as a stored format (`show_formats`, ~10-30 KB, so older readers
  agree), the season's cast (`season_cast`, ~200 bytes a person) and a desk History line. Our bot is asked one or two
  questions per show set up (Bot capacity); TVmaze one more call (`/shows/:id/cast`) for a series or talk show.

# Hosting: what runs where, its limits, what uses them, and what more would cost

**Keep this current.** Update it in the same commit as any change that adds or changes polling, a scheduled
job, stored data, or a service, and whenever usage is checked (date the numbers). It exists so that, when a
free plan stops being enough, choosing the cheapest fit is arithmetic, not research. Last updated
**2026-10-28** (Cost by size).

## The stack

| Service | What it does for us | Plan | Cost now |
|---|---|---|---|
| **Vercel** (team `reality-fantasy-leagues`, project `tvleagues`) | The Next.js app, its API routes, `/mock` | Hobby | $0 |
| **Neon** (project `reality-fanatsy-leagues`, AWS us-east-2, Postgres 18) | Every table, auth included | **Launch since 2026-10-28** (the user upgraded it at 98.3% of the free 5 GB transfer, three days before the reset): usage-based, $0.106 a CU-hour, $0.35 a GB-month, 500 GB of transfer, no minimum | ~$5 a month at today's use |
| **Oracle Cloud** (`gys-bot`, VM.Standard.E2.1.Micro: x86, 1 GB) | The ChatGPT bot (`C:\Users\conor\llm-browser-api`) and the bot research clock | Always Free | $0 |
| **Cloudflare** tunnels | `bot.gameyourshow.com` (the VM), `bot-home.gameyourshow.com` (the PC fallback) | Free | $0 |
| The PC's bot (`127.0.0.1:8765`, local work only) | Since 2026-10-28 its ChatGPT is **signed in to the user's own account** (a Plus trial) and its Gemini to their Google account, and it can ask Claude through the user's Claude Code. **Never list it in production's `LLM_BROWSER_API_URL`** (nor tunnel it for production): production's research would run on the user's personal accounts. The VM's bot stays signed out | – | $0 (the trial renews as paid Plus unless cancelled) |
| **GitHub** (`clydon/reality-fantasy-leagues`, **public since 2026-10-24**) | The code; Actions runs the hourly job (`auto-research.yml`: auto-research, reminders, waivers) and the nightly wiki sync | Free; Actions minutes unlimited while public | $0 |
| healthchecks.io | Emails when the bot's daily self-test fails | Free | $0 |
| Resend | Sign-up and password emails, and the desk's Let in ("You're in", one per account let in: docs/PLAN-desk-parity.md step 2) | Free: 3,000 emails a month, 100 a day (third-party sources, 2026; Pro $20 for 50,000) | $0 |
| **TVmaze** API (`api.tvmaze.com`, new design step 10 part 1, on the branch) | TV listings for Add a show: the show search as you type, a show's seasons and episode air times when someone adds it, and its cast when someone makes a series or talk show a game (step 10 part 2a). Since step 11 part 2, also once a day by the listings job (the week's schedules for the guide's Also on, what changed, new seasons): about 17-20 calls a day, on the bot clock's calls, never on a timer of its own | Free, no key. Data is CC BY-SA (credited with a link back on Add a show and the guide's listing and evening sheets); at least 20 calls every 10 seconds per IP, else HTTP 429 (the job spaces its calls 0.7 s apart); posters hotlinked from its image CDN (allowed) | $0 |
| Google Cloud OAuth client (**not made yet**: the user's, step 9 part 2) | Continue with Google on the new design's way in. Off until `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set (no keys, no button) | Free (sign-in only: the email, profile and openid scopes, no verification review needed) | $0 |
| **GIPHY** API (**no key yet**: the user's, new design step 13 part 1, on the branch) | GIFs in a watch along: what's trending and a search, asked by our server (`/api/gifs`, kept at the edge an hour per search); the pictures load from GIPHY's media CDN straight into the browser. Off until `GIPHY_API_KEY` is set (no key, no GIF button). Tenor, the other choice, closed its API on 2026-06-30 | Free. A new key is a beta key: 100 calls an hour (each distinct search, and trending, at most once an hour per edge region); past that, GIPHY's production key (applied for from its dashboard, reviewed, and they may talk pricing). "Powered by GIPHY" shown under the picker; ratings PG-13 at most | $0 |
| **TMDB** API (`api.themoviedb.org`, show art and cast photos, 2026-10-26, on the branch) | Show posters, header images (backdrops) and logos, season posters, and a season's cast photos by name (`src/lib/server/show-art.ts`). Images hotlinked from `image.tmdb.org`, stored as plain URLs. Off until `TMDB_READ_TOKEN` is set (the user's; in `.env.local`, and Vercel needs it too) | Free key, **non-commercial only**: charging users (or ads) needs TMDB's written agreement, price on request. Data kept at most 6 months (the daily job re-asks at 150 days); on a licence ending, everything on `image.tmdb.org` must go: `UPDATE ... WHERE url LIKE 'https://image.tmdb.org/%'`. Attribution: its logo and notice on Settings › Credits. About 40 requests a second allowed | $0 |
| **Wikipedia / Wikidata** API and **Jolpica** (`api.jolpi.ca`, F1) (2026-10-26, on the branch) | Athletes' photos for sport shows: Wikipedia's page image API returns only freely licensed (Commons) photos; Jolpica gives Formula 1's field with Wikipedia links | Free, no keys. Wikipedia rate-limits bursts (a probe got 429s after ~15 quick calls): batched, one call at a time, at most 30 searches a sweep. Commons photos need their photographer's credit | $0 |
| **ESPN** (`site.api.espn.com`, `site.web.api.espn.com`, `sports.core.api.espn.com`; sports data, 2026-10-27, local only) | A sport season's games (each day's scoreboard), linked to its episodes; each team's roster with headshots, the Players tab's players (headshots hotlinked from `a.espncdn.com` through ESPN's resizer); a game's box score in the sport's own columns and a player's regular-season line, the Players tab's stats (or a race's places, from its scoreboard); its search (which league a season's teams are in) (`src/lib/server/sports/`, docs/PLAN-sports-data.md). Asked by our server only; every answer cached in Neon (`sports_cache`) | Free, no key, but **unofficial and undocumented**: no published terms or rate limit, and it can change without notice. Asked little (cached hard), credited in Settings › Credits and under the Players tab's roster, other sources planned for when it fails (docs/BACKLOG.md). It refuses a User-Agent with a URL in it (403), so ours is a bare `GameYourShow/1.0` | $0 |
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
| Neon branches | 10 per project | 4 (2026-10-28) | `production`; `pre-new-design-2026-10-24` (made before migration 0066 shipped), `pre-merge-2026-10-26` and `pre-s2-2026-10-28` (made in the console before S1 and S2 deployed; a snapshot of production, no credentials handled): none auto-delete |
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
| Researched trivia runs (2026-10-26; in the default schedule) | one call a day before each episode (two ChatGPT asks, ~2 min), up to 3 tries | a few minutes per episode, ~0.1 per show airing |
| Tie-break runs (new design, step 6c; off until switched on in desk › Settings) | one call a day after a dispute, up to 3 tries | a few minutes per disputed episode |
| Results someone asked for (2026-10-27, migration 0152: Fill in what happened on a show made a game that nobody plays) | two clock calls per asked episode (who went home, ~25-50 s; then the full research, ~2.5-4 min), back to back with the clock's minute tick between, 2 tries for the full one; each run writes its progress every few seconds (0153); the asker's card polls every 4 s while an answer is coming | a season's catch-up of 7 episodes is ~25-35 min awake once; then nothing. On the VM, Chrome stays open 10 min after a question (~300 MB of its 1 GB) |
| The listings job (new design, step 11 part 2) | none of its own: it runs after a bot clock call that ran no bot job, which had woken the database already; ~10-30 s of queries once a day | ~0 (a backstop Vercel cron, if ever needed, ~0.6) |
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
| New design, a watch along while its clock runs (`/api/seasons/[id]/watch/[n]?at=&since=&beat=1`) | 5 s, only while its clock runs and the tab is in front (not paused, not in an ad break, not before you start) | under 1 KB when nobody said anything new (a few small queries: your mark, the couch, the reactions since the runtime it has, through 30 s behind your clock, and since step 13 part 2 who else is on it now, a few rows by the heartbeats' index; its heartbeat is written only every 15 s or so, a small UPDATE); ~200 bytes a new comment, more for a GIF's link, ~150 bytes a person on it |
| New design, a paused watch along's beat (`POST /api/seasons/[id]/watch/[n]/session` `{ beat }`, step 13 part 2) | 20 s, only while it's paused or in an ad break and in front, and for ten minutes at most after it stopped | a small UPDATE (the heartbeat) and who's on it now: under 1 KB |
| New design, a together watch along's look (`GET /api/seasons/[id]/watch/[n]/together?plan=&v=&beat=1`; while its clock runs, the reactions read above with `together=&sv=` instead, step 13 part 3) | 3 s while you're in one and it's in front (the running read's 5 s becomes 3 s together); 30 s once it's sat stopped and unchanged ten minutes; nothing after an hour (until a tap or coming back to the tab) | a few bytes (its version) while nothing has moved: one small row by its key, and the heartbeat written every 15 s or so; ~1-2 KB when it has (who's in it, its clock, its last change, who else is on the episode) |
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
suggestions come from the catalog (`/api/catalog`, already cached at the edge for 5 minutes; since step 11 part 1 read only
once Add a show opens, where before every signed-in page asked for it), which now lists **every**
show's seasons, not only the curated ones: about 250 bytes a season from Neon per uncached read, so it grows with each
show people add (fine at hundreds of seasons; past ~1,000, at most 12 uncached reads an hour, it would approach 1-2 GB of
transfer a month, and the search should move to the server). **Adding a show** nobody has added before is two TVmaze calls
(the show with its seasons, then one season's episodes) and a few small writes: a `shows` row (with its listing, ~1 KB), a
`show_seasons` row and a `season_episodes` row per episode (~100 bytes each), at most 10 new shows per person a day
(`NEW_SHOWS_A_DAY` in add-show.ts). Adding it again a day later reads that season's episodes again (and since step 11 part 2 the
daily listings job does whenever TVmaze says the show changed). A show's poster is TVmaze's medium image, hotlinked (~25 KB; its only other size is the upload itself, often
over 1 MB, so it's never used). The hub's home read now also carries the couch's shows you don't follow (their headers and
schedules: a few hundred bytes each), and the show space's read one more small query (whether you play the season).

**Starting, archiving and deleting games (new design, step 10 part 2b)** polls nothing and runs nothing on a schedule.
**Start a game** reads what fits once when the sheet opens (`/api/seasons/[id]/start`: the season's rulebook, the couch's
games and who watches it, a few KB) and makes an ordinary league (~20-40 KB of state like any, plus its rulebook as
`settings.rulebook`, ~5-14 KB) with one line in Recent changes; **Tell the couch** is one web push per person on the couch
(free: our own VAPID keys, no service). Its line on the hub's feed comes from that Recent changes row, read with the hub
(one more small query). **Archive** is a field in the game's own state (`settings.archivedAt`): from then on the season
sync, moves due, waivers and reminders skip it, so an archived game costs less than a playing one. **Delete** keeps the
game for 30 days (`leagues.deleted_at`, migration 0123; its people's seats in the Recent changes line that restores it,
~0.5 KB a person), then it's removed for good the next time anyone deletes a game (no job): at most a few dozen KB per
deleted game for a month.

**The rulebooks library and New show (new design, step 10 part 3)** poll nothing and run nothing on a schedule; they're the
desk's (site admins), read when a page opens. The library reads every library and season rulebook's blocks once per open
(~20-60 KB each: a few hundred KB with dozens of shows, for one admin now and then). Saving a starting point copies one
rulebook (~20-60 KB). "Looks right to us" is one tiny row per couch per made rulebook (`rulebook_checks`, migration 0124),
and a show the desk looked at two columns on its row. A set-up show's next season copies last season's rulebook once (~20-60
KB) when anything first reads it. New show makes a show as Add a show does (the same TVmaze calls) and asks our bot as Make
it a game does (Bot capacity); starting from a template asks the bot at most the cast question.

**The TV guide (new design, step 11 part 1)** polls nothing and runs nothing on a schedule. Its week comes with the hub's home
read (`/api/me/home`, read when the hub opens): each show's episodes from a day back to eight days on, cut from the schedules
that read already fetched for Up next, so nothing more from Neon but one tiny query for what you've hidden; it sends ~60 bytes
an episode more to the browser (a weekly show 1-2, a nightly one ~10, a streaming drop its episode count: a few hundred bytes to
a couple of KB per open). The browser lays the week out and moves the clock on each minute without asking the server. **Hide
from guide** is one small row per hidden show per person (`guide_hidden`, migration 0125, ~100 bytes), written when someone
hides one.

**Fill in what happened (2026-10-27, `src/lib/server/episode-recaps.ts`, migration 0143)** is one bot ask per season when someone
taps it (only aired episodes with no recap, so a season is asked about again only for new ones), run after the response like Make
it a game's (`maxDuration` 300, the bot's ~1-3 min). While it asks, the Episodes tab polls `/api/seasons/[id]/recaps` every 4 s
(a small JSON); nothing polls otherwise. Each recap is up to 1 KB on its episode's row (`season_episodes.summary`), plus one tiny
row per season (`episode_fills`). **Fill in who's playing** (migration 0144, `src/lib/server/rosters.ts`) is the same shape: one
bot ask per sport season, ever (only while it has no cast; ~30 s for the World Series), polling every 4 s only while it asks, and
~100 bytes a person on `season_cast` (a series' two teams and officials: ~90 rows). Its photos are Wikipedia searches right after
(one per person, ~0.3 s apart, ~1 min for a series; free, no key), stored as Wikimedia thumbnail URLs. **Stats** never ask our bot
(since step 4 of docs/PLAN-sports-data.md they come from ESPN's box scores: Sports data, below); `cast_stats` (0145, the bot's
snapshots) is no longer read or written. **Keeping up** (migration 0141) adds an UPDATE on your own reads only for shows set to move
along by themselves, and a few-ms query on each bot clock call.

**Sports data (docs/PLAN-sports-data.md steps 1-2, migration 0148)** polls nothing and wakes nothing of its own. ESPN is asked by our
server only: after the answer when someone adds a sport (linking its season's episodes to ESPN's games), and by the daily listings job
for sport seasons with games still to link (at most 20 seasons a run; a season is looked at again the next day while games are missing,
a week on when ESPN has none of them). Every answer goes through `sports_cache` in Neon, read into our shapes (ESPN's raw game summary
is ~1 MB and is never stored): searches and the league index a week, a past day's games a month, a finished game's box score for good,
a roster or a season line a day, anything live 3 minutes; when ESPN doesn't answer, the last answer is served. Measured on the real 2026
World Series (2026-10-27): its four games linked in 7 ESPN calls (3 searches, 4 days' games), 1.4 s, 7 cache rows; linking them again
took none. Storage: a day's games ~1 KB, a box score ~10 KB, a row per sport season (`sports_links`) and per linked episode
(`season_events`, ~300 bytes); the job prunes cache rows a week past their time. Not backed up (asked again). **Its players (step 3,
migration 0149)** come from the linked games: one roster call per team (cached a day), else the team's played games' box scores
(cached for good once final), so the World Series' 52 players took 2 calls; ~250 bytes a person on `season_cast` (with its headshot's address and ESPN's id).
Their headshots are hotlinked from ESPN's CDN through its own resizer (`a.espncdn.com/combiner`, ~36 KB each, lazily loaded; no
bytes through Vercel or Neon), and Wikipedia is searched only for whoever has none (none for the World Series). The Players tab's
read gains one small query (its links and fill), and when a fill is due runs it after the answer (nothing polls but the page,
every 4 s, while it's going: seconds). **Their stats (step 4, migration 0150)** come from the same games: each linked game's box
score once it's likely over (3 hours after it starts; cached for good once final, so one call a game, ever; again at most every 10
minutes while one isn't final), a race's places from its day's games (already cached), and each player's regular-season line for
coming in, **one call a player, once** (at most 60 a run, 4 at a time; the World Series' 52 took 52 calls, ~1-4 s). Measured on the
real World Series' Games 1-3 (2026-10-27): 55 ESPN calls in 1.2-3.6 s, none on a second run. Storage on `game_lines`: ~320 bytes a
player a game (~10 KB a game) and ~420 bytes a player for coming in (its main category only; ~22 KB for the series); a season line's
cache row is ~1.1 KB, kept a day. Each Players tab read pulls the lines up to your mark plus everyone's coming in (~25 KB for the
series at Game 1, ~85 KB at Game 7) and one small aggregate; a fill runs after the answer only when something's due (a game's over,
someone has no coming in yet), held on `stat_fills`, and the page polls every 4 s only while it runs. Nothing new polls or wakes Neon.

**All of TV and the daily listings job (new design, step 11 part 2)** poll nothing and wake nothing of their own. **The job**
(`src/lib/server/tv-listings.ts`) runs at most once an Eastern day, after the answer of a bot clock call
(`/api/cron/bot-research`) that ran no bot job (`after()`, so it never holds up a run or the VM): the VM calls at least every
six hours and each call has woken Neon already, so the job adds ~10-30 s of queries to a compute that's awake anyway (it
stays up 5 minutes after the last query either way). Its TVmaze calls: 16 for the week (`/schedule?country=US` and
`/schedule/web` for eight days), one `/updates/shows` (`since=day`, or `week` when its last upkeep was over 23 hours ago,
keeping only shows changed since: runs are once an Eastern day on six-hourly calls, so up to ~30 hours apart), then one per listing show TVmaze says changed and one per
season it reads again or makes (capped at 40 shows a run), and one per show here linked by name: ~20 a day today, spaced
0.7 s apart. A failed day keeps its old rows and the job tries again an hour on (at the clock's next call); its last run is
`app_settings 'listings'`. **`tv_listings`** (migration 0126) holds the evening (5 PM to 3 AM where it airs) and streaming
drops, in English on a US or worldwide service, never the news: measured on a real day (2026-10-27), 55 rows from TVmaze's
203 entries (12 drops), ~320 bytes each, so ~500 rows and ~150-200 KB with its indexes for the nine days it keeps (yesterday
on); each day's rows are replaced when it's read again, so it doesn't grow. It's TV data fetched daily: **not in the
backups**. **The read** (`/api/listings/week`, the guide's Also on) is the same for everyone with nobody's data in it, so
Vercel's edge keeps it an hour (`s-maxage=3600`, served stale while it refreshes): at most one function call and one Neon
read an hour per edge region, whoever opens the hub (~130 KB from Neon each: the nine days; at worst ~100 MB of transfer a
month if someone opens the hub every hour, 2% of the allowance). Each phone reads it once a visit (cached an hour in the
browser; ~25-30 KB gzipped) and leaves out its own shows, the couch's and what it hides. The same job keeps listing seasons
current (a changed show's episodes and status, a new season when announced: a few small writes, a season's rulebook copied
once for a show that's a game) and links shows by name (one `shows` row each). **If the VM stops calling**, the listings go
stale (Also on empties a week later; seasons stop moving on). The backstop is a Vercel cron (Hobby allows one a day) on `GET
/api/cron/listings?run=1`, which runs the job only when today's run hasn't happened: add `vercel.json` with `{"crons":
[{"path": "/api/cron/listings?run=1", "schedule": "0 10 * * *"}]}` (Vercel sends `CRON_SECRET` itself when it's set). It wakes
Neon once a day when nothing else has: ~5 minutes at 0.25 CU, about **0.6 CU-hours a month**. Not set up: the VM calls.

**Planned nights (new design, step 11 part 3)** poll nothing and run nothing on a schedule. A plan is one small row
(`watch_plans`, migration 0127, ~150 bytes) and one per person asked (`watch_plan_people`, ~80 bytes): a couch of four planning
a night a week is a few KB a year. Called-off and past nights stay (the feed reads the last 60 days, Undo needs a called-off
one; nothing removes them, and at this size nothing needs to). Planning one sends **one web push to each person invited**
(free: our own VAPID keys, push-core's `invite` setting), after the answer (`after()`). The hub's home read carries your
couches' nights still to come (one small query; their shows' headers and schedules are mostly read already, else one more
small read for the seasons it hasn't), the hub's feed one more small query, and the plan sheet reads what can be planned
when it opens (`/api/seasons/[id]/plans`: the season's header and schedule, the couch, who watches it, its plans: a few KB).
An answer, a plan or calling one off answers with your couches' plans, put into the cached home, so the home isn't read
again. Backed up with the couch's games (`backup-leagues.js`).

**Rate it and the couch verdict (new design, step 12 part 1)** poll nothing and run nothing on a schedule. A rating is one small
row (`episode_ratings`, migration 0128, ~100 bytes, ~250 with a take): a couch of four rating every episode of five weekly shows
is about a thousand rows a year (~0.2 MB). Rating sends nothing to anyone (no push). The reads: the Episodes read gains one small
grouped query (each episode's average and count through your mark: a few bytes an episode); the rate sheet reads its episode
when it opens (two small queries); Couch verdicts reads when its page opens (two small grouped queries over your shows); and the
hub's read gains one query for your taste twin, Agree with the couch and the rating accolades, sent from Neon compactly (one row
per person and season with its episodes and stars as one short string, "1:4,2:5": a couch of four with ten shows of twenty
episodes rated is ~5 KB per hub open, where plain rows would be ~50 KB) plus one small query for your marks. Backed up with the
couch's games (`backup-leagues.js`).

**Call it, Weekly Calls and the couch's polls (new design, step 12 part 2)** poll nothing and run nothing on a schedule. A call is
one small row (`episode_calls`, migration 0129, ~120 bytes), two per person per episode: a couch of four calling every episode of
five weekly shows is about 2,000 rows a year (~0.25 MB); what someone says happened on a talk show's call (`episode_call_says`)
~100 bytes; a poll ~400 bytes (`couch_polls`, its options as JSON: ~1.5 KB for a cast poll of 18) and a vote ~100 bytes
(`couch_poll_votes`). Nothing sends a push. The reads: the call sheet reads its episode when it opens (the season's rulebook,
its cast, the accepted results through it and the couch's calls: a few small queries, a few KB), and Tonight's Call it row reads
the next episode's the same way (kept 30 s); a show's Games tab and Tonight read the couch's polls on it (one small query and its
votes); Commercial break's This week only reads when its page opens (for each show you follow with an episode this week, its
rulebook and your calls; the couch's polls). A game that counts calls (a public pool's Who goes home?, Weekly Calls) adds two
small queries to the games read (its players' calls on the season, the season's accepted results), and the hub's read the same
for each Weekly Calls game; the home read adds one small read per Weekly Calls game you play (the next show's questions and
your calls). Grades are never stored: each read works them out from the season's results (or, a talk show's, what the couch
said). Backed up with the couch's games (`backup-leagues.js`).

**Bingo, trivia and Weekly Bingo (new design, step 12 part 3)** poll nothing and run nothing on a schedule. A bingo card is kept
only from its first tick (`bingo_cards`, migration 0130: nine squares as JSON, ~600 bytes), each tick a tiny row (`bingo_marks`,
~40 bytes): a couch of four playing every episode of five weekly shows, ticking five squares each, is about 1,000 cards and
5,000 ticks a year (~0.8 MB). A trivia play is ~300 bytes (`trivia_plays`, one per person, show and week). Nothing sends a push
(Tell the couch is a chat message the person posts). The reads: a bingo row or sheet reads its episode when it opens (the
season's rulebook, your card and ticks, a count of who's playing; once you've seen it the couch's cards and the season's results
or says for that episode: a few small queries, a few KB), kept 30 s, and each tick answers with the card; a tick on a talk show
also re-reads its calls (a tick is a say). Trivia reads when its row or sheet opens: the season's stats facts for at most two of
the show's seasons (season-stats.ts, whose accepted results are kept per server by a fingerprint), and the couch's scores.
**The bingo bank (docs/PLAN-bingo-bank.md, migration 0146)** replaces the rulebook's moments as a card's squares: about 30 short
squares per episode, and a season bank of the same, in `bingo_squares` (~150 bytes a square: ~5 KB an episode, ~70 KB a season of
13; not backed up, like researched trivia: a kept card carries its squares' labels). Written by pasting an AI chat's answer on the
admin episode page for now (free, no model call of ours); step 2 adds a bot run per episode (one more ChatGPT ask on the free VM,
like trivia's). A card read now also reads the episode's bank (one small indexed query) and, until you tick, deals from it each
read; a reroll is one upsert. A bank square is settled by the couch's says (the says query bingo already ran for talk shows).
`/api/me/trivia` (Commercial break, and the solo hub's On your own, kept 60 s) works out the round for up to six of your shows
until it has three: at most about a dozen of those stats reads per open, the heaviest new read (a cache per person and week
would make it one; Noticed). Commercial break's This week only adds each show's rulebook and card (two small queries a show).
Weekly Bingo adds two small queries to the games and hub reads (its players' cards and ticks on the season, the results or says
they need). Lines are never stored: each read works them out. All three tables are backed up with the couch's games.

**Watch along (new design, step 13 part 1)** polls only while someone is watching along with its clock running. A reaction is one
small row (`watch_reactions`, migration 0131: ~150 bytes for a quick reaction, ~250-400 for a comment, ~400 for a GIF, which keeps
GIPHY's link, never the picture): a couch of four watching every episode of five weekly shows together and saying something every
minute or so is about 15,000 rows a year (~5 MB; a busy couch could be a few times that). The watch along reads the couch's
reactions between two moments: when it opens or its clock jumps (Set the time, ±10 s), what was said in the 90 s before your clock
plus the pins (each comment's moment, a few bytes each) and the couch's count; then **every 5 s while the clock runs**, only what's
new since the runtime it has read (an unchanged answer is a few hundred bytes). Paused, in an ad break, before you start or with the
tab behind another, it asks nothing. Each poll is a few small queries (the session, your mark, the couch, the reactions by an index
on season, episode, couch and runtime); the season's air times are kept in the server's memory for 30 s rather than read each time.
An hour's episode watched start to finish is ~720 polls (Vercel invocations) and well under 1 MB from Neon, and it keeps Neon awake
while it's open, as an open chat does. Tonight's Watch along card reads once when the show opens (`/api/seasons/[id]/watch`: the
episode to watch along and the couch's count, two small queries). Saying something is one insert (at most 12 in ten seconds,
1,500 an episode, per person). **GIFs** are GIPHY's: the picker asks `/api/gifs` (what's trending when it opens, then a search as you
type, 350 ms after you stop), which our server asks GIPHY once per search an hour (edge-cached, `s-maxage=3600`), and the pictures
load from GIPHY's CDN in the browser (not through us: no Vercel bandwidth). No push, nothing on a schedule. Backed up with the
couch's games (`backup-leagues.js`).

**Who's on now (new design, step 13 part 2)** adds no poll of its own. Each open watch along's clock is kept in `watch_sessions` (migration
0132; ~250 bytes) with whoever's in it in `watch_session_people` (~120 bytes): one row each per person, episode and couch watched along,
reused when it's opened again, so a couch of four watching every episode of five weekly shows is ~1,000 of each a year (~400 KB). It's
written when the clock starts, pauses, goes to an ad break, moves or closes (a handful of small writes a watch along, a moment after the
last tap), and its heartbeat rides on the running watch along's 5 s read (written only every 15 s or so: most polls just look); paused or
in an ad break, it beats every 20 s for ten minutes at most, then stops, so a phone left paused with its screen kept on can keep Neon
awake ten minutes longer than part 1's nothing, never more. Someone's gone 45 s after their last heartbeat, worked out when read: nothing
sweeps the table and nothing runs on a schedule. Who else is on it now comes back with each of those reads (a few rows, by an index on
the heartbeat), with Tonight's card (when the show opens) and from `/api/couches/[id]/now`, the hub's On now: read when the hub opens
(and when you come back to it after 30 s), never polled, under 1 KB (the last minute's heartbeats on the couch, and each show's header).
Not backed up: a session is a clock and a heartbeat, true for a minute.

**Watching together (new design, step 13 part 3)** adds one poll, only while someone is in a together watch along with it open and in
front. A planned night's watch along is one session for everyone in it (`watch_sessions` with `plan_id`, migration 0133: four small
columns more on a row that already existed, one session a night); each person in it is a `watch_session_people` row as before. Anyone in it
moving the clock (the "3, 2, 1", a pause, a move, an ad break) is one small UPDATE, 300 ms after their last tap; joining and leaving one
each; a bingo tick by someone in it moves its version on (one more small UPDATE). **The poll:** every 3 s each phone in it asks whether the
session moved: while its clock runs, the reactions read part 1 already makes carries the question (`together=&sv=`), so that read comes every
3 s rather than 5 s; stopped (paused, an ad break, before the "3, 2, 1", the start), a look that answers a few bytes (`{ version }`) until
it has moved, then the session (~1-2 KB). It's the heartbeat too (written every 15 s or so, as part 2's). Stopped and unchanged for ten
minutes it asks every 30 s, and after an hour not at all until someone taps something or comes back to the tab, so a together watch along
left paused with the screen on keeps Neon awake an hour at most, never more. A couch of four watching an hour's episode together is ~1,200
looks each (Vercel invocations) and a megabyte or two from Neon all told (a few hundred bytes a look). A start screen opened before the night is due (15 minutes before a
shared start, the live airing's airtime) doesn't poll. Hearing the people in it at once (rather than 30 s late) is a condition in the
reactions read, not another read. By the numbers' two new accolades (most reactions, most watch alongs) are two small grouped queries
more in the hub's read. Not backed up: as part 2's sessions (a session goes with its night when a restore replaces the night).

**Streaming shows and the rail (new design, step 14 part 1)** add no read, no poll, nothing on a schedule and no table. The rail
under the guide is worked out in the browser from what the hub reads already: the home read (your shows, the couch's, who on the couch
streams each openly, the couch's planned nights) and the hub's On now (`/api/couches/[id]/now`, read when the hub opens, which The couch
is watching already asked for; the solo hub has no couch and doesn't ask). Every season header now carries its drop time
(`show_seasons.drop_at`) and its listing's service (`shows.listing->>'network'`): two short fields more per season in the home, space and
couch reads, a few dozen bytes each. A streaming season is never "on the air" (`schedule.ts upNext`), which only takes things away.

**The fold by progress, first to finish and daily streaming off Also on (new design, step 14 part 2)** poll nothing and run nothing on
a schedule. Migration 0134 adds two columns: `chat_messages.author_seen` (how far a message's author had seen, kept only on a season
watched at its own pace, NULL elsewhere: 4 bytes) and `show_follows.finished_at` (when someone first reached a season's last episode: 8
bytes a follow). Both go in the backups with their tables (`backup-common.js` reads each table's columns as they are): a restored chat
folds the same and the accolade keeps its times. **Posting a message** (either design, `chat.ts insertMessage`) reads a little before it
writes: the season's release and status (one small query, where a weekly season stops), and on a season watched at your own pace your
mark and any watch along you've had open in the last three hours (two or three small queries; a finished weekly season also its
schedule). Messages are typed by people, so it's a handful of reads a day. The open Chat tab's 5 s poll is unchanged when nothing has
moved (32 characters); when something has, its read carries one more small number per message, kept on the server. The hub's read
gains one small query (First to finish: the couch's finishes on streaming seasons you've finished). Daily streaming shows leave Also on
in the browser: the week's read and `tv_listings` are unchanged.

**Your settings and your profile (new design, step 15 part 1)** poll nothing and run nothing on a schedule. Settings and the profile
sheet read your profile when they open (`/api/me/profile`: one small query and one for "since", a few hundred bytes), and an Ask an AI
sheet reads it once to know your AI (kept five minutes). The reminder ask (2026-10-26, `show/remind.tsx`) reads it the same way, only
while this phone isn't getting notifications: after a save in Your moves until it has asked once on that phone, and on Tonight while its row
could show; nothing else (what it has asked is kept on the phone). Migration 0135: `user_settings.colour` and `user_settings.ai` (a few bytes each,
backed up with `user_settings`), and **`user_pictures`**: one picture per person who chooses one, made 256 by 256 in the browser (~10-30
KB as a JPEG, refused over 100 KB), so a couch of four with pictures is ~100 KB of Neon storage. **Not backed up** (a face, not the game:
whoever chose it can choose it again). A picture leaves Neon only through `GET /api/people/[id]/picture?v=<version>`, which the browser
keeps for good (`private, max-age=31536000, immutable`; a new picture is a new version): one read of ~10-30 KB per person, version and
browser, and only for someone on a couch with them. The home read gains each couch member's chosen colour and picture version (two small
columns from two LEFT JOINs on tables keyed by person) and one small query for your own. Saving a new name is rare and does a little:
Better Auth's update, one league write per league you play (`withLeagueLock`, renaming your seat) and one UPDATE of your messages'
signature. Rename, Hand it on and a new code are one or two small writes each.

**Notifications by moment (new design, step 15 part 2)** poll nothing and run nothing on a schedule. Every push, from either design and
from the hourly jobs, goes through one sender (`push-core.js sendPush`). **Web pushes are free**: our own VAPID keys, carried by the
browser's push service (Google's for Chrome and Android, Apple's for an installed iPhone app); each is one HTTPS request per device from
the function already handling the write that caused it, after its response (`after()`). What a push costs Neon: one small query for its
readers (their design, time zone, switches, and what they've turned off for this show), then per reader the words' own reads (the spoiler
guard's mark, one or two small queries; for results, which of two keys they have) and one INSERT into the bell, then one query for the
devices. **What pushes now:** everything classic sent, but results once per person however many linked games they play (three games'
results were three pushes, now one), worded per reader; and new: Final scores are in (the full results, the morning after: so at most two
results notices an episode per show), the couch chat on a show the couch only watches and to people on the couch who follow without
playing (on the new design), a poll, a bingo line, a flag settled, a game started and a watch along planned (both rode on classic's invite
push before), someone joining your couch, and a watch along called off. **The call-off waits:** after Call it off, the function stays up
8 s (the toast's Undo is 5 s) before deciding whether to tell anyone: wall time, no CPU, a few a season. **Stored:** `notifications` (the
bell; ~300-500 bytes a row, worded per person, each push's reader gets one whatever their switches say; chat isn't kept): for a couch of
four on two shows, roughly 15-25 notices a person a week, so ~100 rows (~40 KB) a person at the 30-day cap, which is kept by the insert
itself taking that person's older rows; **not backed up** (notices, not the game). `waiver_runs_seen`: one ~60-byte row per person per
waiver run watched; not backed up (a seen mark). `notification_prefs.chat` and `.shows`, `user_settings.tz` and `.notes_read_at`,
`fact_disputes.told_at`: a few bytes each, backed up with their tables. **Reads:** the home read gains one indexed count (the bell's dot)
and writes the phone's time zone only when it changed (as does classic's `/api/me`); the bell reads its list when it opens (up to 50
rows, ~10-20 KB, each row's guard mark from one query for all your seasons) and marks it read with one small write; a show's
Notifications reads one small row when its sheet opens; Settings' moments come with the profile read (one more small query). Tonight's
Waivers ran plate's seen mark comes with the waivers read (one small query), and watching a run is one tiny insert. After it writes, the
season sync reads the bingo cards on the episodes it touched (a few rows) and claims the flags it settled (one UPDATE).

**What your couch sees (new design, step 15 part 3)** polls nothing, runs nothing on a schedule and sends no push. **Stored:** four
booleans on `user_settings` (`share_where`, `share_now`, `share_ratings`, `share_reactions`, migration 0137, on by default): a few bytes
a person, backed up with `user_settings` (a privacy choice has to survive a restore). Trivia's Seen it all is one small `show_follows`
write. **Reads:** the guard checks a person's switch with a lookup by primary key inside the queries that already read their rows
(ratings, reactions, who's on now, the hub's feed and accolades, the chat's marks and reveal lines): index lookups, no more rows or
bytes sent, so the watch along's 5 s poll and the open Chat tab's 5 s poll send what they did. The home read gains one small query
(the couch's people's switches) and each member's mark per show they share (a few bytes a show); the space read the same for its
people. Settings' profile read gains two small queries (your switches; your lines from your follows, latest rating and reactions
count). Trivia's read gains one small query (the show's finished seasons you haven't marked).

**Studio, Earlier messages and Lock it down (new design, step 15 part 4)** add no poll, nothing on a schedule and no push. **Stored:**
`user_settings.theme` (migration 0138: 'night', 'studio' or 'phone', a few bytes a person; backed up with `user_settings`, like the
account's other choices) and each device's copy of it in a `gys_theme` cookie (no database read to draw a page: the boot script reads
the cookie). The home read and GET /api/me read the column with the row they already read and set the cookie only when a device's
differs; saving it is one small UPDATE. Lock it down is a league setting (`settings.lockedDown` in the league's state: no migration),
one league write per game when it's switched. **Earlier messages:** the open Chat tab's read now sends the newest 300 plus one row (to
say there are more); a tap on Earlier messages reads 100 more (~20-30 KB, folded as the rest; never polled); and once someone has read
back, their open chat's 5 s poll asks for everything from the earliest message they've loaded (at most 1,000) instead of the newest
300, with one more tiny EXISTS query. Its `{ unchanged }` answer while nothing moved is the same 32 characters, so the poll's cost only
changes on the reads where the chat changed (a few hundred rows more, ~50-100 KB, only for someone reading far back with it open).

**Vercel invocations** are one per poll: about 10 a minute per open screen (600 an hour); 18 a minute on the
chat page (its 5-second poll replaces the badge's). The new design: 2 a minute on a show space, 12 on its Chat tab,
none on the hub, 14 in a watch along while its clock runs (its own 12, and the 2 of the show space's Chat badge under it), 5 while
it's paused (a beat every 20 s, for ten minutes at most, and the badge's 2); 22 in a together watch along while it's open (its look
every 3 s, carrying the reactions while the clock runs, and the badge's 2), 4 once it's sat stopped ten minutes, 2 after an hour.

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

**Researched trivia (2026-10-26, on the branch)** is one more bot run per episode (`trivia`, a day before the next one airs): its
call to `/api/cron/bot-research` wakes Neon on its own (a different time from the episode night's runs), for the two asks
(~100 s, inside the route's 300 s) and a few small writes. Storage: six short questions an episode (`trivia_questions`, ~3 KB),
flags as people tap Wrong?. Nothing polls: the round is read when the trivia sheet, row or Commercial break opens, as before.

**Show art and cast photos (2026-10-26, on the branch)** polls nothing and adds no wake. The finder (`src/lib/server/show-art.ts`)
runs after the answer (`after()`) when a show is added from the listings or a season made, when Make it a game confirms a
cast, when the desk adds a season or taps Find art and photos, and as part of the daily listings job (which already runs on
the bot clock's calls): at most 6 shows' art, 4 new seasons' posters and 4 seasons' cast photos a day. A show is about 4 TMDB
calls (find, images, season images, season credits), plus 2-3 TVmaze calls when TMDB lacks someone; a sport season is 1
Jolpica call (F1) or up to 30 Wikipedia searches, then 1-2 batched page reads. Storage: a few URLs a show and season
(migration 0139: `shows.tmdb_id/backdrop_url/logo_url/art_by_hand/art_off/art_checked_at`, `show_seasons.art_url/
art_by_hand/tmdb_season/photos_checked_at`), nothing backed up separately (it can all be found again). Every picture is
hotlinked from TMDB's, TVmaze's or Wikimedia's CDN: no Vercel image optimisation, no bytes from Neon. Headers load TMDB's
`w1280` backdrop (~150-250 KB), cards the `w500` poster (~50-80 KB), cast avatars `w185` (~10-15 KB).

## Levers, cheapest first

1. **Poll less** (free): one combined poll instead of three; stop polling when the window isn't focused (today
   only a hidden tab stops); slow down when nothing has changed for a while; push for the rare events.
2. **Free capacity elsewhere**: the bot clock already runs on the VM; the hourly job could too. Oracle's Always
   Free also offers Arm A1 machines (up to 4 OCPU / 24 GB) when the region has capacity: a bigger or second bot.
3. **Neon Launch** (prices from the Neon billing page, 2026-10-24): usage-based, $0.106 per CU-hour and $0.35 per
   GB-month, 500 GB of transfer per project, longer point-in-time restore, and compute can stay awake. At
   today's ~50 CU-hours that's about $5 a month; kept always awake at 0.25 CU, about $19.
4. **Vercel Pro**: $20 per member per month plus usage, and required for any commercial use (Cost by size, below; check
   its inclusions on vercel.com/pricing before deciding).
5. **The bot tiers** (One tap $1 a season, Autopilot $5) are meant to pay for the research they trigger.

## Cost by size (estimate, 2026-10-28)

What the app would cost a month at each size, from the measurements above and the prices of 2026-10-28. "People" means
people who use it in a month. Prices: **Neon Launch** $0.106 a CU-hour and $0.35 a GB-month, no monthly minimum, 500 GB of
transfer, autoscaling (Neon's page via third-party summaries, matching the billing page of 2026-10-24); **Vercel Pro** $20 a
member a month plus usage (third-party summaries disagree on what's included and the overage rates: check vercel.com/pricing
before moving); **Resend** free to 3,000 emails a month. Estimates, not measurements: re-check against real usage at each step.

**The assumptions.** A person with the app open at a show space is 2 Vercel calls a minute, its Chat tab 12, a watch along 14,
a together watch along 22 (Vercel invocations, above). A mix of engaged people (two together watch alongs a week, some
browsing and chat: ~14,000 calls a month) and light ones (scores and picks: ~2,000) averages **~6,000 calls a person a
month**. Neon's compute is 0.25 CU for every hour anything woke it in the previous 5 minutes, more at busy times, so it
follows **how many hours a day someone is on**, not how many people: a handful of people is a few hours a day; a few hundred
spread over evenings and time zones keeps it awake almost all day. Research costs follow the **shows** played, not the
people (an episode is researched once for everyone), so the free bot keeps up far longer than the rest.

| Size | Vercel | Neon | Bot | Email | Domain | A month |
|---|---|---|---|---|---|---|
| Today (one couch) | Hobby, $0 (92K of 1M calls) | Free, $0 (~45 of 100 CU-hours) | free VM | free | ~$1 | **~$1** |
| Small, 10–50 | Hobby, $0 (~60K–300K calls) | Free to ~25 people; by ~50 it's awake 10+ hours a day and nears the 100 CU-hour cap, so Launch at ~$8–13 | free VM | free | ~$1 | **$1–14** |
| Medium, 100–300 | **Pro, $20** (~0.6–1.8M calls: Hobby's 1M runs out around 150–200 people) | Launch, ~$15–40 (awake most of the day, 0.25–0.5 CU) | free VM; a second free VM for spare capacity | free | ~$1 | **$35–60** |
| Large, 500–2,000 | Pro, ~$20–50 (3–12M calls; a little usage on top) | Launch, ~$40–120 (always awake, ~0.5–1.5 CU on average, more on episode nights) | free VMs; ~$0–10 if an API fallback is added | free, or Resend Pro $20 when sign-ups pass 100 a day | ~$1 | **$60–200** |
| Extra large, 2,000+ (say 5,000) | Pro, ~$50–150 (30M+ calls) | ~$150–300 (2–4 CU on average), or a fixed-price Postgres | ~$10–50 (more bots, or an API for the GPT's asks: a game-creation ask is a fraction of a cent on a small model) | Resend Pro $20 | ~$1 | **$250–500+**, unless polling gives way to push first |

**Costs that come with a decision, not with size:**
- **Charging anything** (the bot tiers, ads): Vercel's Hobby is for non-commercial use only, so **Pro ($20) from day one**,
  whatever the size; and TMDB's free key is non-commercial (a licence, or TheTVDB, free under $50k revenue, plus TVmaze).
- **Going private again:** GitHub Actions counts minutes (~775 a month: inside the free 2,000).
- **Paid research** (the Anthropic API, per season switched on): per episode researched, only if used.

**What keeps it low, cheapest first:** the Levers above. Polling is what grows with people: it's both Vercel's calls and Neon's
awake hours. One combined poll, polling only while the window is in front, slowing down when nothing moves, and push for rare
events would roughly halve both, for free. Past ~2,000 people, a realtime push service in place of polling (and caching what
everyone reads) is the bigger saving.

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
- **The listings job** (new design, step 11 part 2): `GET /api/cron/listings` with `Authorization: Bearer <CRON_SECRET>` says its
  last run (ok, days read, rows, seasons read again and made, shows linked) and how many listings each day has; `POST` runs it
  now. Vercel's function logs have one `[listings]` line per run.

## Changelog

- **2026-10-27, deployed.** A site admin's test couch (docs/PLAN-researched-survivor.md; migration 0151): a copy
  of a couch's games on a season, played by test players. Nothing polls and nothing new wakes Neon; its cost is the copy's size:
  for the couch's three Survivor 51 games, three more league rows (~the real ones' state each) and a handful of users, and every
  result accepted for the season syncs three more leagues (a few more writes on an episode night). Researched rules ask our bot
  once (the answer is kept). Remove it when done.
- **2026-10-27, local only (not deployed).** Sports data, steps 1-2 (docs/PLAN-sports-data.md; migration 0148): a new free service,
  **ESPN** (no key, unofficial: see The stack), asked by our server only when a sport is added and by the daily listings job, every
  answer cached in Neon (`sports_cache`). Nothing polls, nothing new wakes Neon. The real World Series' four games linked in 7 calls.
  Step 3 (migration 0149): a sport's players from its linked games (a roster call per team, cached a day), their headshots hotlinked
  from ESPN's CDN at ~36 KB each through its resizer; the World Series' 52 players in 2 calls. Step 4 (migration 0150): their stats
  from the games' box scores (a call a game, once final) and each player's regular season (a call a player, once): the World
  Series' Games 1-3 and 52 players in 55 calls; `game_lines` ~10 KB a game plus ~420 bytes a player. ChatGPT never asked for stats.
- **2026-10-26.** Show art and cast photos found on their own (docs/RESEARCH-show-art-and-cast-photos.md; migration 0139):
  two new free services, **TMDB** (key `TMDB_READ_TOKEN`, non-commercial only: see The stack) and **Wikipedia/Wikidata +
  Jolpica** (no keys) for sports. Rides on existing moments and the daily listings job; nothing new polls or wakes Neon.
  Before charging users: a TMDB licence, or switch to TheTVDB (free under $50k revenue) + TVmaze and remove TMDB's images.
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
- **2026-10-25, on the `new-design` branch (not deployed).** Step 10 part 2b, Start a game that fits, and archive or delete
  a game. **Nothing polls and nothing runs on a schedule.** Migration 0123: `leagues.deleted_at` and `deleted_by` (a deleted
  game is kept 30 days, restorable from Recent changes, then removed the next time anyone deletes one). A started game is an
  ordinary league (~20-40 KB) with one Recent changes line; Tell the couch is one web push per person on the couch. An
  archived game is skipped by the season sync, the hourly waiver job and the reminders (`db/waivers.js`, `db/reminders.js`
  now leave out archived and deleted games), so it costs less than one that's playing.
- **2026-10-26, on the `new-design` branch (not deployed).** Step 10 part 3, rulebooks phase 8: the library and the desk's
  New show. **Nothing polls and nothing runs on a schedule.** Migration 0124: `rulebook_checks` (one tiny row per couch that
  says a made rulebook looks right), `shows.reviewed_at`/`reviewed_by`, and wider checks on `rulebooks.review_status`,
  `show_setups.via` and `admin_changes.entity`. The library is read by the desk only, once per open (a few hundred KB at
  most). A starting point the desk saves is one rulebook copy (~20-60 KB); a set-up show's next season copies last season's
  rulebook once. A made show's stored format no longer becomes a library template whenever its season is read (it did on
  the branch since 2a; nothing reached production).
- **2026-10-26, on the `new-design` branch (not deployed).** Step 11 part 1, the TV guide on the couch's shows. **Nothing
  polls and nothing runs on a schedule.** Migration 0125: `guide_hidden` (one ~100-byte row per show someone hides from their
  guide). The hub's home read now carries each show's week (when its episodes air, cut from schedules it already read: no
  more from Neon, ~60 bytes an episode to the browser) and what you've hidden (one tiny query). One read fewer everywhere:
  the catalog (`/api/catalog`) is asked only once Add a show opens, not by every signed-in page. Part 2 (all of TV, a
  `tv_listings` table and its daily refresh) and part 3 (planned nights) will add their own lines.
- **2026-10-26, on the `new-design` branch (not deployed).** Step 11 part 2, all of TV and the daily listings job. **Nothing
  polls, and nothing wakes the database on its own.** Migration 0126: `tv_listings` (the week's evening airings and streaming
  drops from TVmaze, ~500 rows and ~150-200 KB, replaced daily; not backed up). The job runs at most once a day after a bot
  clock call that ran no bot job (`after()`; the VM is unchanged), ~20 TVmaze calls a day, and keeps listing seasons current,
  makes a listed show's next season and links shows by name. A new open read, `/api/listings/week`, kept at the edge an hour
  (at most one Neon read an hour, ~130 KB). `/api/cron/listings` (CRON_SECRET) for a run by hand, its status, and a backstop
  Vercel cron should the VM stop calling (~0.6 CU-hours a month; not set up). The bot clock's answer gains `listings` (true
  when it queued the job); the VM's tick ignores it.
- **2026-10-26, on the `new-design` branch (not deployed).** Step 11 part 3, planned nights. **Nothing polls and nothing runs on
  a schedule.** Migration 0127: `watch_plans` and `watch_plan_people` (a ~150-byte row a night and ~80 bytes a person asked;
  backed up). One web push to each person invited when a night is planned (push-core, the `invite` setting). The home read
  gains one small query (your couches' nights still to come), the hub's feed one more, and the plan sheet a few small reads
  when it opens (`/api/seasons/[id]/plans`); writes answer with the plans, so the home isn't read again.
- **2026-10-26, on the `new-design` branch (not deployed).** Step 12 part 1, Rate it and the couch verdict. **Nothing polls and
  nothing runs on a schedule.** Migration 0128: `episode_ratings` (a ~100-250-byte row per person and episode rated; backed up).
  No pushes. The Episodes read gains one small grouped query, the hub's read one compact query for your taste and the rating
  accolades (~5 KB at a couch of four with a year of ratings) and one for your marks, and the rate sheet and Couch verdicts a
  couple of small reads when they open.
- **2026-10-26, on the `new-design` branch (not deployed).** Step 12 part 2, Call it, Weekly Calls and the couch's polls. **Nothing
  polls and nothing runs on a schedule.** Migration 0129: `episode_calls` (~120 bytes a call, two a person and episode),
  `episode_call_says` (~100 bytes), `couch_polls` (~0.4-1.5 KB a poll) and `couch_poll_votes` (~100 bytes); all backed up. No
  pushes. The call sheet, Tonight's Call it row, a show's polls and Commercial break's This week only read when they open (a few
  small queries each); games that count calls (a public pool, Weekly Calls) add two small queries to the games and hub reads, and
  the home read one small read per Weekly Calls game. A public pool's Who goes home? moved out of its league's state into
  `episode_calls` (the pool's state is a little smaller).
- **2026-10-26, on the `new-design` branch (not deployed).** Step 12 part 3, bingo, trivia and Weekly Bingo. **Nothing polls and
  nothing runs on a schedule.** Migration 0130: `bingo_cards` (~600 bytes, kept from a card's first tick), `bingo_marks` (~40 bytes
  a tick) and `trivia_plays` (~300 bytes a person, show and week); all backed up. No pushes. A bingo row or sheet and trivia read
  when they open (a few small queries; trivia reads the stats facts of up to two seasons); `/api/me/trivia` (Commercial break, the
  solo hub) reads up to about a dozen seasons' facts per open; Commercial break's This week only gains two small queries a show;
  Weekly Bingo adds two small queries to the games and hub reads.
- **2026-10-26, on the `new-design` branch (not deployed).** Step 13 part 1, watch along on your own time. **One new poll, only
  while someone watches along with its clock running** (`/api/seasons/[id]/watch/[n]?at=&since=` every 5 s: the reactions since the
  runtime it has, under 1 KB when nothing's new; paused, before you start or in a hidden tab, nothing); nothing runs on a schedule.
  Migration 0131: `watch_reactions` (~150-400 bytes a reaction; backed up). A new service once the user makes a key: **GIPHY**
  (`GIPHY_API_KEY`; no key, no GIFs): searches asked by our server and kept at the edge an hour, pictures loaded from GIPHY's CDN in
  the browser; a beta key allows 100 calls an hour. Tonight reads one more small thing when a show opens (its Watch along card). No
  pushes.
- **2026-10-26, on the `new-design` branch (not deployed).** Step 13 part 2, who's on now and the live airing. **No new poll, nothing on a
  schedule.** Migration 0132: `watch_sessions` and `watch_session_people` (one small row each per person, episode and couch watched along;
  not backed up). Each open watch along writes its clock when it starts, pauses or moves, and a heartbeat: on the running 5 s read
  (written every 15 s or so), or every 20 s while paused for ten minutes at most (a paused watch along used to ask nothing). Who else is
  on it comes back with those reads, Tonight's card, and the hub's On now (`/api/couches/[id]/now`, read when the hub opens). No pushes.
- **2026-10-26, on the `new-design` branch (not deployed).** Step 13 part 3, watching together. **One new poll, only while someone is in a
  together watch along with it open and in front** (every 3 s: a few bytes while nothing moved; while its clock runs it's the reactions
  read, now every 3 s instead of 5; 30 s after ten still minutes, nothing after an hour); nothing on a schedule, no pushes. Migration 0133:
  four columns on `watch_sessions` (`plan_id`, who last changed the clock, how, when) and an index; still not backed up. The hub's read
  gains two small grouped queries (By the numbers' most reactions and most watch alongs). Bingo's read gains one small query while you're
  in a together session (who's in it and what they've ticked since it began).
- **2026-10-26, on the `new-design` branch (not deployed).** Step 14 part 1, streaming shows and the rail. **Nothing new: no read, no
  poll, nothing on a schedule, no migration, no pushes.** The rail is drawn from the hub's home read and its On now read; season headers
  carry two more short fields (the drop time and the listing's service).
- **2026-10-26, on the `new-design` branch (not deployed).** Step 14 part 2, the fold by progress, first to finish and daily streaming
  off Also on. **Nothing polls and nothing runs on a schedule; no pushes.** Migration 0134: `chat_messages.author_seen` and
  `show_follows.finished_at` (a number and a time; both backed up with their tables). Posting a chat message reads one to four small
  things more (the season, and on a streaming or finished season the author's mark and open watch along); the hub's read gains one small
  query (First to finish). Also on leaves daily streaming shows out in the browser.
- **2026-10-26, on the `new-design` branch (not deployed).** Step 15 part 1, your settings and your profile. **Nothing polls and
  nothing runs on a schedule; no pushes.** Migration 0135: `user_settings.colour` and `.ai` (backed up) and `user_pictures` (~10-30 KB a
  person who chooses a picture; not backed up), read through `/api/people/[id]/picture?v=`, which browsers keep for good. The home read
  carries each couch member's colour and picture version; Settings reads your profile when it opens.
- **2026-10-26, on the `new-design` branch (not deployed).** Step 15 part 2, notifications by moment. **Nothing polls and nothing runs on
  a schedule.** One sender for every push (`push-core.js`), worded per reader through the spoiler guard, in their time zone, opening the
  design they're on; results once per person per stage however many games (was once per league), plus new pushes: Final scores are in,
  watch-only couch chat, polls, bingo lines, flags settled, a game started, a watch along planned or called off (8 s after, past its
  Undo), someone joining your couch. Migration 0136: `notifications` (the bell, ~40 KB a person at its 30-day cap; not backed up),
  `waiver_runs_seen` (not backed up), `notification_prefs.chat`/`.shows`, `user_settings.tz`/`.notes_read_at`, `fact_disputes.told_at`
  (backed up with their tables). The home read gains the bell's count and keeps the phone's time zone (written only when it changes).
- **2026-10-26, on the `new-design` branch (not deployed).** Step 15 part 3, what your couch sees. **Nothing polls, nothing runs on a
  schedule, no pushes.** Migration 0137: four booleans on `user_settings` (backed up). The guard's sharing checks are primary-key lookups
  inside existing queries (no more bytes sent, the polls unchanged); the home and space reads carry each person's mark where they share
  it and one more small query; the profile read two; trivia's one; Seen it all one write.
- **2026-10-26, on the `new-design` branch (not deployed).** Step 15 part 4, Studio and the rest, which finishes step 15. **Nothing new
  polls and nothing runs on a schedule; no pushes.** Migration 0138: `user_settings.theme` (backed up), copied to each device as the
  `gys_theme` cookie (the page is drawn in it before anything loads; no read for it). Lock it down: a league setting, no migration. The
  open Chat tab's read sends one row more (whether there's anything earlier); Earlier messages reads 100 at a tap, and someone who has
  read back polls from the earliest they've loaded (its unchanged answer is the same 32 characters; a changed one carries what they've
  loaded, at most 1,000 messages).
- **2026-10-27, pushed to master (deploys with migration 0146).** The bingo bank, step 1 (docs/PLAN-bingo-bank.md). **Nothing polls, nothing
  runs on a schedule, no pushes.** Migration 0146: `bingo_squares` (~150 bytes a square, ~30 an episode plus a season's own; not backed
  up), `bingo_square_flags` (step 4), `bingo_cards.rerolls`/`.called_lines` (backed up with their table). A card read gains one small
  query (the episode's bank); the admin's prompt is built from a few reads, no model call. Step 2's bot run will add one ChatGPT ask
  per episode on the free VM.
- **2026-10-27, pushed to master (deploys with migration 0146).** The bingo bank, step 2: the bot's `bingo` run (in the default schedule,
  a day before each episode airs). **Per episode, on a season with the bot's schedule on and bingo in it: two ChatGPT asks on the
  free VM** (write, then check; up to ~4 min, inside the route's 300 s), plus two more once per season for its own bank (on the next
  call). Free (our bot), but it's VM time: with trivia, a season now asks four times between episodes. The planner reads one more
  tiny EXISTS query per bingo season per cron call (whether the season has its own bank). The VM is told to come back a day before
  each episode, as for trivia; nothing polls. A failed run tries three times, 20 minutes apart, never once the episode airs.
- **2026-10-27, pushed to master (deploys with migration 0146).** The bingo bank, step 3: calling BINGO and "Did it?". **Nothing polls,
  nothing runs on a schedule, no migration** (0146's `bingo_cards.called_lines` holds the calls). A call is one small UPDATE and
  at most one push per couch-mate per caller and episode (the existing `bingoLine` type, kept in the bell); a "Did it?" answer is
  one row in `episode_call_says` (~80 bytes). A seen card's read now carries the couch's called squares waiting on you (computed
  from the cards query it already ran) and someone else's card (`?of=`) is one query plus, while you're behind, one presence
  check of the together session.
- **2026-10-27, pushed to master (deploys with migration 0146).** The bingo bank, step 4: flags. **Nothing polls, nothing scheduled, no
  migration, no pushes.** A flag is one row in `bingo_square_flags` (0146, ~60 bytes); dealing a card adds two small subqueries
  per square of the episode's bank (counted flags, an admin's flag: indexed by the flags' primary key). The hub's read gains one
  query for the couch feed's BINGO lines (couch members' cards with a call, guarded as the notice is).
- **2026-10-29, pushed to master (deploys with migrations 0420-0430).** The desk, steps 1-7 (docs/PLAN-desk-parity.md): the
  site admins' pages that take over classic /admin's work (classic stays until step 8). **Nothing runs on a schedule, and a page
  polls only while something it started is running.** Storage: two new tables, `desk_runs` (a row per Run now, ~200 bytes) and
  `season_cast_answers` (a row per cast answer, its text and the people read from it: a few KB); nullable columns on
  `issue_reports`, `show_seasons`, `bingo_squares`, `couches` and `shows`; `admin_changes` takes person, report and game lines.
  Two triggers: on `leagues` (a game's insert, or a change to its couch or its delete, reads its couch's row by key) and on
  `shows` (a change to a show's words). **Run now no longer waits inside its request:** it queues a `desk_runs` row and answers at
  once; the request driving the queue asks the bot (up to 300 s, as classic's Run now did), then hands the next queued run to a
  request of its own through `/api/desk/runs/next` (Bearer `CRON_SECRET`, which production has): one more short function call
  per queued run. **While a page shows something running it polls** until it ends: a run's log every 3 s, a bingo bank being
  written or a cast being asked every 4 s, the rulebooks flag's check every 1 s; one site admin, so under a hundred small reads
  a run. A deleted couch or game is restorable for 30 days; `purgeDeleted` removes older ones when deletes and the desk's reads
  run, not on a schedule. Let in sends one Resend email per account let in. Which AI our bot asks (`app_settings` 'bot_ai') is
  one small row read with each ask; it stays ChatGPT until production's bot has the Claude Code CLI signed in.

# Site admin outside the desk: the audit

> **Status (2026-11-21): Reference** for the settings plan's Round 5 ([PLAN-settings-overhaul.md](../PLAN-settings-overhaul.md),
> "Round 5: the site admin's desk"), beside [desk-r0-audit.md](desk-r0-audit.md). That audit walks the desk's 27 screens (D1–D151)
> and what they lack (M1–M14); this one covers everything admin **outside** them: the doors and powers in the player app, what tells
> you something needs you, the other admin pages and routes, the scripts and scheduled jobs, the site's switches, and what was done
> by hand in production in the last month. Read from the code (master de50aed6) and the docs, not rendered. Line numbers drift:
> search for the words. Where an item is already one of the desk audit's, it says so and doesn't redo it.

**How to read it.** Every item has a number (O1, O2, ...) so you can approve or overturn it by number. A later section that meets the
same thing again points back to its number instead of giving it a new one. The ten that matter most are at the end.

| Verdict | Means |
| --- | --- |
| **Fine as is** | it does its job; leave it |
| **Keep as a script** | it stays a command on your PC; the reason is given (usually: it needs the database's connection string, which the site must never hold) |
| **Make it an admin button** | it should be a control in Site admin, so it can be done from a phone |
| **Admin should show its status** | you should be able to see it, or be told on your phone, without a terminal, SSH or a host's dashboard |
| **Drop** | dead, or dangerous and replaced |
| **Unsure** | the code and docs don't settle it |

**The short version.** Nothing in the app ever tells you that something needs you: you find out by opening the hub's profile
sheet or the desk. The bot, its clock and the hourly job can stop without the app saying so; you'd find out over SSH, from a
terminal, or from a player. Three jobs done in production this month had no button: Settle again (typed into a desktop browser),
the catch-up's release (a script that needs the database's password) and the AI for trivia and bingo (a raw call). Previewing as
a player has no bar and lasts 30 days. A few admin leftovers from classic are dead or dangerous and can go.

---

## a) Admin inside the player app

### The doors in

| # | What it is | Where | Verdict | Why |
| --- | --- | --- | --- | --- |
| O1 | The hub's profile sheet: the **"Site admin"** row, with "N need you" | src/new/hub/profile.tsx:140-149 (row), :99 (reads the whole To do list, only while the sheet is open), :146 (the count); the avatar has no dot: src/new/ui/bars.tsx:123 | **Admin should show its status** | the count is only seen after you open the sheet: put a dot on the avatar when To do has rows, from a light count read |
| O2 | Your settings' **"Site admin"** row, "To do, search and the site's settings" | src/new/settings/settings.tsx:138 | **Fine as is** | a second door; the count belongs on the first (O1) |
| O3 | A show's ⋯ menu: **"This season in Admin"** → the desk's season page | src/new/screens/show-space.tsx:567-569 | **Fine as is** | the right shortcut; its word follows the desk audit's D1 ("Site admin") |
| O4 | After a show is made a game: **"Its rulebook on the desk"** | src/new/show/make-game.tsx:721-726 (and :169, New show from the desk lands on the rulebook) | **Fine as is** | the natural next step for you only |
| O5 | Classic's **"Admin"** rows: the sidebar, and the More sheet's "Admin · Shows, users, results" | src/components/sidebar.tsx:135, 272-273; src/components/mobile-nav/mobile-nav.tsx:617 | **Drop** | classic only (accounts that went back to it), "results" is out of date; goes with classic after Dec 16 (C10, BACKLOG 45) |
| O6 | Admin badges: **none**; a players list says Commissioner, Helper or player only | src/new/manage/people.tsx:282 | **Fine as is** | nobody on a couch needs to know who the site admin is |

### Being someone else: Act as, View as, Read-only

| # | What it is | Where | Verdict | Why |
| --- | --- | --- | --- | --- |
| O7 | The **Act as** bar: "Viewing as {name} · N min left · Return to my account", which returns by itself with under a minute left; classic has its own bar | src/new/session.tsx:28, 45-86; src/components/auth-gate.tsx:315-321 | **Fine as is** | clear, timed, and logged in their History (the desk audit's D52 renames the button) |
| O8 | **View as** (the app as a player or a commissioner sees it) has **no bar at all**. It's a cookie that lasts 30 days; while it's on, every Site admin door disappears and /desk says only "The desk is for site admins"; the one way back is the hub profile sheet's "Admin · Viewing as a player: back to you" row | src/lib/server/view-as.ts:4-11, 44; src/app/(new)/(in)/layout.tsx:30-35; src/new/desk/desk.tsx:50-56; src/lib/server/auth-helpers.ts:45; src/new/desk/view-as.tsx:68-90; src/new/hub/profile.tsx:151 | **Admin should show its status** | a sticky bar like Act as's ("Previewing as a player · Back to you"), and an hour's life like Act as. The desk audit's D3 moves the door; this is the missing "you're still in it" |
| O9 | The **Read-only** plate over a couch's game opened from the desk "as its couch sees it" | src/new/read-only.tsx:12-18, 207; src/app/(new)/(in)/layout.tsx:47; the server refuses writes: src/lib/server/read-only.ts:26 | **Fine as is** | says what it is, and leaving the show leaves it |

### Extra powers a site admin has in player screens

| # | What it is | Where | Verdict | Why |
| --- | --- | --- | --- | --- |
| O10 | The server counts you as **Commissioner of every game**: Manage this game's writes, archive or delete any game, the maker's Scoring page, a couch's own moments | src/lib/server/auth-helpers.ts:99-127; league-changes.ts:43-48 ("a site admin runs them all"); backstage-games.ts:65, 74; end-game.ts:46, 53; maker-scoring.ts:81; couch-answers.ts:46 | **Fine as is** | the app only shows Manage this game where you really run it (show-space.tsx:88), so the power surfaces through the desk; the desk audit's M4 is where it belongs |
| O11 | You can open **any couch** (as a "viewer") | src/lib/server/couches.ts:278 | **Fine as is** | how the desk's Open works |
| O12 | You're a **chat moderator on every couch**: Remove anyone's message or reveal line | src/lib/server/couch-chat.ts:69; src/new/show/chat.tsx:563, 583 | **Fine as is** | an owner's power, used rarely |
| O13 | **One flag from you** takes a bingo square or a trivia question out for everyone (players need two) | src/lib/server/bingo.ts:168-174; src/lib/server/trivia-key.ts:26-29 | **Fine as is** | bingo says so (src/new/show/bingo.tsx:304); trivia's line says only "once two people say so" (src/new/show/trivia.tsx:220): add "or an admin's" in the next words pass |
| O14 | **No limits or waits** for you: making shows into games, typed game asks, Ask ChatGPT for me, starting from a library rulebook, adding a show by name, joining a couch without waiting | make-game.ts:454, 609; game-words.ts:64; ask-bot.ts:205-209; way-in.ts:60, 176; src/app/api/couches/join/route.ts:14 | **Fine as is** | you test and fix things |
| O15 | Classic only: every show, curated or not, in Create a league | src/components/dashboard/create-league-flow.tsx:118 | **Drop** | goes with classic |
| O16 | Game previews' **"Site admins only"** setting | src/lib/server/previews.ts:15-39 | **Fine as is** | the desk's switch (D38) |
| O17 | The sign-in screen tells a username-only player to **"ask the site admin for a temporary password"** | src/new/welcome/sign-in.tsx:153, 179 | **Fine as is** | the ask reaches you outside the app (a text); the desk's Password reset (D54) does it, until account recovery (BACKLOG 185) |

### What tells you something needs you

| # | What it is | Where | Verdict | Why |
| --- | --- | --- | --- | --- |
| O18 | **Nothing in the app ever notifies the site admin.** Every notification kind is a player's or a runner's; no push or bell line opens the desk. The only alert that reaches you is outside the app: healthchecks.io emails when the bot's hourly self-test has to fall back | src/lib/server/push-core.js:27-71 (the kinds); no "/desk" link in push-events.ts, push-core.js, db/reminders.js, db/waivers.js or db/bot-research.js; docs/HOSTING.md:21, 1372-1373 | **Admin should show its status** | you use admin on a phone, and the app already sends pushes: one "Site admin" kind, a push when To do gains a row (batched, the count in it), opening the desk |

Each case, and what happens today:

| # | When this happens | Where you see it today | On your phone? | Verdict | Why |
| --- | --- | --- | --- | --- | --- |
| O19 | Someone signs up and waits to get in | To do's "N accounts waiting" row (src/lib/server/desk-inbox.ts:228) | no: signing up only marks them waiting (src/lib/auth.ts:80-92) | **Admin should show its status** | they sit on "you're on the list" until you happen to look |
| O20 | A player sends a problem or an idea | To do's report row (desk-inbox.ts:295) | no: the route only saves it (src/app/api/reports/route.ts:10-30) | **Admin should show its status** | the sheet promises "Goes straight to us" (src/new/settings/sheets.tsx:307; settings.tsx:126) |
| O21 | Results the bot couldn't settle (still split, or waiting for a second look that can't come) | one To do row an episode (desk-inbox.ts:69-113) | no | **Admin should show its status** | the one results job left for you; on 2026-11-20 Episode 1's 16 results sat out of every game until someone looked (docs/PLAN-results-settle.md:135-141) |
| O22 | The bot stops answering, or its runs fail | nowhere until a Run now fails ("Our bot isn't answering right now", src/lib/server/desk-research.ts:568); the desk audit's M5 | only healthchecks.io's email, which is about ChatGPT falling back | **Admin should show its status** | the check already exists (src/lib/server/ask-bot.ts:228-233) |
| O23 | The catch-up holds an episode that would change scores, or stops | To do rows (desk-inbox.ts:282-294) | no | **Admin should show its status** | only while a catch-up runs, but then it waits on you |
| O24 | A couch nobody runs | To do row (desk-inbox.ts:144-160) | no | **Fine as is** | not urgent: To do is enough |
| O25 | A show added by name, a rulebook to check, a suggested fix, a season with no schedule, a sports game with no stats | To do rows (desk-inbox.ts:255-326) | no | **Fine as is** | none is urgent |
| O26 | Results change after final in your own games | the bell and a push, as a player (push-core.js:69) | yes, as a player | **Fine as is** | you hear what your couch hears |

---

## b) Other admin-only pages

| # | What it is | Where | Verdict | Why |
| --- | --- | --- | --- | --- |
| O27 | **/admin** and every address under it: classic's admin, retired. A site admin is sent to the same thing on the desk; anyone else goes home. Production serves it (it's a route); nothing in the app links to it but /reports | src/app/admin/[[...path]]/route.ts:10-19 | **Fine as is** | keeps old bookmarks working; can go with classic |
| O28 | **/reports**: sends you on to /admin/reports, then the desk's Reports; only classic's shell knows it | src/app/reports/page.tsx:3-8; src/components/auth-gate.tsx:47 | **Fine as is** | same; goes with classic |
| O29 | **/research, /dashboard, /scoreboard** are not admin pages: they're classic's player pages, with no admin check. Nothing in the new design links to them; only accounts that chose "Back to the classic design" reach them, and a classic reader's league-invite push still opens /dashboard | src/app/research/page.tsx, dashboard/page.tsx, scoreboard/page.tsx; src/new/settings/account.tsx:87-96; src/lib/server/push-events.ts:483 | **Drop** | with classic (C10, BACKLOG 45); count who's still on classic first (O76) |
| O30 | Classic's **"Reset all data"** for a league (League Settings › Danger zone, site admins only) → POST /api/leagues/[id]/reset: wipes a game back to empty, no undo, nothing in the desk's History | src/components/setup/setup-tab.tsx:236-262; backup-section.tsx:69-90; src/app/api/leagues/[leagueId]/reset/route.ts:7-18 | **Drop** | dangerous and unlogged; the desk's Delete, with Restore, replaced it |
| O31 | Classic's **Overview layout editor**: your reorder or hide of every classic player's Overview (app_settings `overview_layout:*`) → PUT /api/app-settings/overview-layout | src/lib/use-overview-layout.ts:22-35; src/app/api/app-settings/overview-layout/route.ts:21-28, 48 | **Drop** | goes with classic |
| O32 | **/desk/lab**: the desk audit gives it a door (D151, M9). New here: in production it can only check a game, not start one. Start offers only your test couch or a zt- test couch, and no test couch can be made since 2026-10-31 | src/lib/server/engine-lab.ts:181-191; src/new/lab/lab.tsx:182-198; BACKLOG 36 | **Unsure** | a developer's tool; decide whether it earns a door in production at all |
| O33 | Developer-only pages: /start/preview-story, its /sheet, a show's /atlas-kit | each calls notFound() in production (e.g. src/app/(new)/start/preview-story/page.tsx:12; show/[seasonId]/atlas-kit/page.tsx) | **Fine as is** | not admin pages; production never serves them |
| O34 | Better Auth's own admin endpoints (/api/auth/admin/*: list users, set role, ban, set password, remove, impersonate) | src/lib/auth.ts:136-141; src/lib/auth-client.ts:13; the desk calls only impersonate and stop: src/lib/server/desk-person-actions.ts:430, 479 | **Fine as is** | Better Auth guards them and the desk wraps what it needs with History. A call straight to them leaves no History, and nothing makes a second site admin: fine with one owner |

---

## c) Admin routes with no screen

| # | What it is | Where | Verdict | Why |
| --- | --- | --- | --- | --- |
| O35 | POST /api/desk/**settle-again**: every open episode settled again under today's rules, and the bot asked once more about what's open; logged in Settings history. Run twice on 2026-11-20 as a fetch typed into a signed-in desktop browser (HANDOFF.md:80 says once). The desk audit's M1 | src/app/api/desk/settle-again/route.ts:5-13; src/lib/server/desk.ts:152-173; docs/PLAN-results-settle.md:123-126, 139-141 | **Make it an admin button** | behind a hold, showing what it would move first (as the what-would-move run over a backup did); today it can't be done from a phone |
| O36 | POST /api/desk/seasons/[id]/**catchup** `{start}` / `{step}`: start a catch-up, try again after it stopped, take its next step now. The desk audit's M3 | src/app/api/desk/seasons/[id]/catchup/route.ts:10-14, 30-34 | **Make it an admin button** | the "stopped" To do row links to a page with no control |
| O37 | The same route's `{try}`: the scoring guard alone, for a check | catchup/route.ts:35-42; scripts/dev-test/check-catch-up.js | **Fine as is** | a test's door |
| O38 | PUT /api/desk/settings `{botAiRuns}`: **which AI each kind of run asks**. Production sends trivia and bingo to Codex, set by this call on 2026-11-07; they're to go back to ChatGPT before the ChatGPT Plus trial ends, or those runs fail. The desk audit's M6 | src/lib/server/desk.ts:93-98; src/lib/bot-runs.ts:4-5; docs/HOSTING.md:1398-1400, 1402-1408 | **Make it an admin button** | a live setting nobody can see or change without a raw call |
| O39 | POST /api/cron/**bot-research** (and GET ?dry=1): the bot clock the VM calls. Each call runs one research run, else a Getting it ready step, else a catch-up step; then the day's TV listings and the marks of shows set to move along. Bearer CRON_SECRET | src/app/api/cron/bot-research/route.ts:14-41, 71-85; src/lib/server/cron.ts:3-9 | **Admin should show its status** | when it was last called and what's due next (the dry read already says), beside the bot's own status (M5) |
| O40 | GET/POST /api/cron/**listings**: the daily TV listings job by hand, and its last run. Needs the cron secret, so only from a terminal. The desk audit's M13 | src/app/api/cron/listings/route.ts:8-30; its last run is app_settings `listings` (src/lib/server/tv-listings.ts:71-91) | **Admin should show its status** | "TV listings last updated …", with a warning when stale; a Run now isn't needed (Setup's TV listing covers a season) |
| O41 | POST /api/desk/runs/next: the desk's Run now queue handing itself on. Without CRON_SECRET the queue waits for your next desk visit | src/app/api/desk/runs/next/route.ts; src/lib/server/desk-research.ts:696-699 | **Fine as is** | machine to machine |
| O42 | POST /api/preview-live/sweep (open, hourly from the GitHub job) and /api/preview-live/month (signed: the desk's "This month" line) | src/app/api/preview-live/sweep/route.ts:6-10; month/route.ts:7-13 | **Fine as is** | the month's line is already the "status on the desk" pattern |
| O43 | GET /api/briefs/[code]/fetches: who opened an Ask-AI brief, "admin-only while the experiment runs"; defined in the client, called by nothing | src/app/api/briefs/[code]/fetches/route.ts:6-12; src/lib/api.ts:565-568 | **Drop** | dead |
| O44 | /api/test-couch (GET, POST, PATCH, DELETE): your test couch. Nothing has called it since 2026-10-31; the client's actAsTestPlayer is unused too | src/app/api/test-couch/route.ts:8-46; src/lib/api.ts:131-132; BACKLOG 36 | **Drop** | dead (BACKLOG 36 already plans it) |
| O45 | next.config.ts still lists the retired /api/admin research route for the embedding model; the routes that research now (the desk's research route, the bot clock) aren't listed, so their side-bet indexing may download the model on a cold start or quietly skip (it's caught and logged "could not embed") | next.config.ts:4-8; db/episode-research.js:2988-2995, 3082-3089 | **Unsure** | check Vercel's logs for "could not embed"; point the list at the live routes, or drop it if nothing needs side-bet suggestions now |

---

## d) Scripts and scheduled jobs

### Scripts run against production

Not counted: the dev-test checks (compare-totals.js, what-would-move.js), which run over a backup copy, never production itself.

| # | Script | What it does | Needed (evidence) | Needs a connection string? | Verdict | Why |
| --- | --- | --- | --- | --- | --- | --- |
| O46 | scripts/backup-leagues.js | a read-only snapshot of everything played, to files on your PC | 9 production backups since 2026-10-24 (backups/: 10-24, 10-26 twice, 10-30, 11-14, 11-19, 11-20 twice, 11-21), before each scoring change and Settle again | yes: BACKUP_DATABASE_URL, pasted through a clipboard window (.session-loop/backup-prod-now.ps1) | **Keep as a script** | it needs production's string and writes to your PC. Gap: it leaves out `app_settings` (no rule for it in the script), so no backup records the site's switches; that tripped a rehearsal on 2026-11-20 (docs/PLAN-results-settle.md:153-154) |
| O47 | scripts/restore-leagues.js | loads a backup into a local scratch database and checks it | once (2026-10-24) | local only | **Keep as a script** | a check on your PC |
| O48 | scripts/rehearse-migrations.js (runs db/backfill-rulebooks.js too) | the migrations on a Neon copy of production before a push | every migration push: 19 rehearsal wrappers in .session-loop/rehearse-*.ps1, all 2026-10-29 to 11-21 | yes: the copy's | **Keep as a script** | needs a branch's string |
| O49 | scripts/game-specs-flag.js status/check/on/off | the game-specs flag, for every league | once in production: on, 2026-10-30 (docs/HOSTING.md:1305-1307; .session-loop/flag-on-prod.ps1) | yes | **Keep as a script** | a one-time switch with a rollback (the desk audit's M11); its value should show read-only (O65) |
| O50 | scripts/rulebooks-flag.js | the same for the rulebooks flag | once (on in production); the desk has a switch too (D46) | yes | **Keep as a script** | the desk audit moves D46 here |
| O51 | scripts/catch-up-load.js **load** / status | loads a rehearsal's answers into production for the catch-up to use | once: 43 answers on 2026-11-16 (archive/HANDOFF-log-2026-11-19.md:317-324) | yes: CATCHUP_DATABASE_URL, --endpoint and --production | **Keep as a script** | it reads an answers file on your PC |
| O52 | scripts/catch-up-load.js **release** | lets a held catch-up ask our bot (app_settings `catchup_hold`) | once (2026-11-16) | yes | **Make it an admin button** | one switch, and To do already tells you to do it (the desk audit's M2, D24) |
| O53 | scripts/catch-up-locks.js status/clear | ends database sessions stuck holding a catch-up lock | once: two on 2026-11-16 (Survivor 51, The Traitors); the cause was fixed in 4ab2e026 | yes | **Keep as a script** | a rare database repair (the desk audit's M12) |
| O54 | scripts/catch-up-rehearse.js | runs a catch-up on a Neon copy, lists what would change scores | once (2026-11-16) | yes: the copy's | **Keep as a script** | never production; long-running |
| O55 | scripts/preview-database.js mark/check | marks the preview service's own database | once (2026-11-20) | yes | **Keep as a script** | one-time setup |
| O56 | db/link-season-cast.js | October's one-time pass linking each league's people to its season's cast | once, early October (docs/archive/ROADMAP-2026-10.md:93, 146) | yes | **Unsure** | done; keep until classic goes, then drop |
| O57 | db/episode-research.js's own command (`node db/episode-research.js <leagueId> <episode>`) | asks a paid AI (Claude, Gemini, Grok) about one league's episode | not used in production; the only code left that reads the paid AI keys | yes | **Drop** | our bot replaced it, and nothing may spend the site's paid keys (db/episode-research.js:3119-3153; docs/HOSTING.md:29) |
| O58 | db/outside-numbers.js | reads TVmaze ratings for games settled by an outside number | never: "NOT RUN BY ANY JOB YET" | yes | **Unsure** | waits on your OK of TVmaze ratings as a source (db/outside-numbers.js:9-12) |
| O59 | db/seed-dev-admin.js | makes a local admin account | dev only | local | **Fine as is** | "Never run against a real database" (db/seed-dev-admin.js:4) |
| O60 | db/migrate.js | applies migrations | on every build (db/migrate.js:4-13) | the build's | **Fine as is** | the deploy is the step |

### Scheduled jobs

| # | Job | Where and how often | What it does | How you'd find out it failed | Verdict | Why |
| --- | --- | --- | --- | --- | --- | --- |
| O61 | **"Reminders and waivers"** | GitHub Actions, hourly at :05 (.github/workflows/reminders-waivers.yml:24-26) | episode reminders, the after-airtime push for own-pace players, "Final results are in" at noon (db/reminders.js); waiver weeks and their reminders (db/waivers.js); sports finals within the hour (db/sports-refresh.js); the previews' sweep | nothing in the app: `gh run list` from a terminal (docs/HOSTING.md:709-710), or GitHub's own failure email to whoever last edited the schedule, if it's switched on (unsure). It has stopped silently before (minutes ran out, 2026-10-19: HOSTING.md:42-43); GitHub pauses a public repo's schedule after 60 days without activity on it; without the push keys it "runs and sends nothing" (yml:18); after a database password change its AUTH_DATABASE_URL secret must change too (BACKLOG 183) | **Admin should show its status** | last run and each step's result. (Its header still says it pushes Commissioners the morning after, yml:2; that push went in settings Round 1, db/reminders.js:17-18) |
| (O39) | **The bot clock** | the bot's VM calls /api/cron/bot-research when the next run is due, plus a check-in every few hours (its timer lives in the bot's own repo, llm-browser-api deploy/tick.py) | research runs and the tie-break, Getting it ready, the catch-up, the day's TV listings, moving marks | `journalctl -u llm-browser-tick` over SSH (HOSTING.md:711); healthchecks.io's email covers ChatGPT falling back, not the clock stopping | see O39 | |
| (O40) | **The daily TV listings** | rides on a bot-clock call that ran no research (bot-research/route.ts:81-82); the Vercel backstop isn't set up (HOSTING.md:409-413; BACKLOG 184) | the guide's Also on, new seasons, schedule changes | GET /api/cron/listings with the secret; if the VM stops calling they go stale quietly ("Also on empties a week later") | see O40 | add BACKLOG 184's daily backstop too |
| O62 | Moving marks for shows set to move along | every bot-clock call (bot-research/route.ts:84) | everyone's mark on those shows moves forward | nothing; it stops with the clock | **Fine as is** | covered by the clock's status (O39) |
| O63 | The bot's hourly self-test | on the VM, reporting to healthchecks.io (HOSTING.md:21, 1372-1373) | one small ChatGPT question an hour | an email when ChatGPT had to fall back | **Fine as is** | the one alert that works today; show its last result with the bot's status if it's cheap |
| O64 | Vercel crons | none (no vercel.json; HOSTING.md:76) | | | **Fine as is** | Hobby allows one a day: BACKLOG 184's backstop would be it |
| (O41) | The desk's Run now queue | hands itself on through /api/desk/runs/next | runs the Run now asks in turn | each run's line on the season's Research page | see O41 | |

---

## e) Flags and switches that change things for everyone

| # | Switch | What it changes | Where it's set | Production (from the docs) | Shown in admin? | Verdict | Why |
| --- | --- | --- | --- | --- | --- | --- | --- |
| O65 | `game-specs` (app_settings) | every game carries its rules as a spec | scripts/game-specs-flag.js (db/game-specs.js:1-25) | on since 2026-10-30 (HOSTING.md:1305) | no (M11) | **Admin should show its status** | read-only on the desk; the switch stays a script (O49) |
| O66 | `rulebooks` | games play by their season's rulebook | the desk's Settings (D46) and scripts/rulebooks-flag.js (db/rulebooks.js:5, 45-62) | on (PLAN-results-settle.md:153-154) | yes | **Fine as is** | the desk audit's D46 |
| O67 | `tiebreak` | the bot looks again when answers split | the desk (D40); off by default in code (db/bot-research.js:286-290) | on since 2026-11-20, 12:08 PM ET (PLAN-results-settle.md:35) | yes | **Fine as is** | the desk audit's D40 flips the default |
| O68 | `tiebreak_from` | the last Settle again: every open question asked again from then | Settle again only (src/lib/server/desk.ts:162; db/bot-research.js:336-338) | 2026-11-20 (twice) | only as a History line | **Admin should show its status** | "Last settled again …" beside O35's button |
| O69 | `confirm_at` | sources to confirm a result | the desk (D39) | 2, the default | yes | **Fine as is** | the desk audit's D39 |
| O70 | `signups` | who gets in | the desk (D37) | not in the docs | yes | **Fine as is** | |
| O71 | `new_couch_fill` | who fills in results on a new couch | the desk (D41) | the default (anyone) | yes | **Fine as is** | |
| O72 | `live_previews` | who can preview a game | the desk (D38) | not in the docs | yes | **Fine as is** | |
| O73 | `bot_ai` | which AI the bot asks | the desk (D44) | ChatGPT (BACKLOG.md:44-47) | yes | **Fine as is** | |
| (O38) | `bot_ai_runs` | an AI of its own for a kind of run | a raw call only | trivia and bingo on Codex | no (M6) | see O38 | |
| O74 | `bot_usual` | the default research schedule | a season's Research, "Make this our usual" (D104) | not in the docs | yes | **Fine as is** | |
| O75 | `catchup_hold` | holds a catch-up until answers are loaded | scripts/catch-up-load.js (src/lib/server/catch-up.ts:156-160) | released 2026-11-16 | a To do row only (D24) | **Admin should show its status** | held or not; the release itself is O52 |
| (O40) | `listings` | the TV listings job's last run | the job itself | | no | see O40 | |
| O76 | Each account's design, classic or new (user_settings.ui) | classic's pages for whoever chose them | each person's Settings › Your account (src/new/settings/account.tsx:87-96) | the new design for everyone since 2026-10-31; how many are still on classic isn't recorded | no | **Admin should show its status** | a count on People: BACKLOG 45 says count them before classic goes |
| (O31) | `overview_layout:*` | classic's Overview layout | classic's editor | | | see O31 | |
| O77 | LLM_BROWSER_API_URL, LLM_BROWSER_API_KEY (Vercel) | which bots the app asks, in order | Vercel's environment (src/lib/server/ask-bot.ts:9-16) | the VM, then the PC (BACKLOG 16 recommends dropping the PC); never the PC's personal bot (HOSTING.md:19) | no | **Admin should show its status** | each bot up or down, with the bot's status (M5) |
| O78 | CRON_SECRET | lets the VM's clock and a hand run in | Vercel and the VM's .env (src/lib/server/cron.ts:3-9) | set | no | **Fine as is** | a mismatch shows up in the clock's status (O39) |
| O79 | RESEND_API_KEY, AUTH_EMAIL_FROM | sign-up, password and "You're in" emails | Vercel (src/lib/auth.ts:152-163; way-in.ts:31-34) | set; free plan, 100 a day (HOSTING.md:22) | Let in's toast says whether the email went (desk-person-actions.ts:85-107) | **Fine as is** | |
| O80 | GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET | Continue with Google | Vercel (way-in.ts:25) | not set (BACKLOG 185) | no | **Fine as is** | off by your choice |
| O81 | KLIPY_API_KEY | GIFs | Vercel | test or production key not recorded (HOSTING.md:25; BACKLOG.md:317) | no | **Unsure** | check it once: a test key allows 100 searches an hour, then players see "Too many GIF searches this hour" |
| O82 | TMDB_READ_TOKEN | show art and cast photos | Vercel | set | no | **Fine as is** | |
| O83 | The push keys (VAPID) and the hourly job's AUTH_DATABASE_URL | web push; the job's database | Vercel and GitHub's secrets (reminders-waivers.yml:15-18) | set | no | **Fine as is** | their failure shows up as the hourly job's status (O61) |
| O84 | PREVIEW_SERVICE=1 and the PREVIEW_* values | turn a second deployment into the preview service; its month's budget | the gys-preview Vercel project (src/lib/auth.ts:64, 144; previews.ts:30; preview-live.ts:27); PREVIEW_SERVICE_URL is a GitHub variable (yml:19-20) | set since 2026-11-20 (HOSTING.md:14) | the desk's "This month" line (D38) | **Fine as is** | |
| O85 | The paid AI keys (ANTHROPIC_API_KEY, GEMINI_API_KEY, XAI/GROK) | read only by O57's command | GitHub's secrets, "for the user to remove"; Vercel unknown | maybe still stored (HOSTING.md:29, 1277-1279; BACKLOG.md:309-310) | no | **Drop** | remove them: nothing may spend them |

---

## f) Done by hand in production in the last month (2026-10-22 to 2026-11-22, the docs' dates)

| # | When | What | How it was done | Verdict | Why |
| --- | --- | --- | --- | --- | --- |
| (O46) | 2026-10-24 to 11-21 | 9 production backups | backup-leagues.js through a clipboard window | see O46 | |
| O86 | before each migration push (e.g. 11-16, 11-19, 11-20 twice, 11-21) | a Neon snapshot kept 7 days (pre-sports-2026-11-20, pre-settings-2026-11-20, pre-settings-r2-2026-11-21, …) and a rehearsal copy; then the push, `vercel logs` and a live look | the deploy rehearsal routine in a signed-in browser (HANDOFF.md:63, 68, 82, 148) | **Fine as is** | Neon's and Vercel's own consoles: the site shouldn't hold those keys |
| O87 | 2026-10-28 | Neon moved to its paid Launch plan at 98.3% of the free transfer | Neon's console, after its warning (HOSTING.md:16) | **Unsure** | usage on the desk would need a Neon key; Neon's own banner did the job |
| (O49) | 2026-10-30 | the game-specs flag on | the script, your Copy and Enter | see O49 | |
| O88 | 2026-10-30 | Survivor 51 set to 13 episodes (archive/HANDOFF-log-2026-11-19.md:1316) | the desk | **Fine as is** | |
| (O38) | 2026-11-07 | trivia and bingo sent to Codex | PUT /api/desk/settings by hand (HOSTING.md:1398-1400) | see O38 | |
| (O51–O54) | 2026-11-16 | the catch-up: a rehearsal on a copy, 43 answers loaded, the hold released, two stuck locks cleared; six held episodes and Survivor 51's Episode 3 sent on the desk (archive log:317-324) | catch-up-rehearse.js, catch-up-load.js, catch-up-locks.js; the sends were desk taps | see O51–O54 | the sends were fine on the desk |
| O89 | 2026-11-17 and 2026-11-22 | the bot checked by hand: the VM's uptime, memory, tunnel, clock and self-test timers and Codex's limits over SSH; then whether production's bot answers with ChatGPT (archive log:326-332; BACKLOG.md:44-47) | SSH; asking the bot | **Admin should show its status** | the desk audit's M5, plus the clock (O39) |
| O90 | 2026-11-20, 12:08 PM | the tie-break switched on (PLAN-results-settle.md:35) | the desk's Settings | **Fine as is** | |
| (O35) | 2026-11-20, 2:04 and 4:36 PM | Settle again, twice, each after a what-would-move run over a fresh backup | a fetch typed into a signed-in desktop browser (PLAN-results-settle.md:123-126, 139-141) | see O35 | |
| O91 | 2026-11-20, 4:40 PM | Episode 1's second look asked at once (PLAN-results-settle.md:142-145) | the desk's Run now | **Fine as is** | |
| O92 | 2026-11-20, 5:34 PM | Carter's mutiny scored 0, rehearsed first on a backup (PLAN-results-settle.md:146-154) | the desk's rulebook fix | **Fine as is** | the rulebook's save previews its reach (D142) |
| O93 | 2026-11-21 | migration 0312 applied by the build without a rehearsal, on your word (HANDOFF.md:56-57) | a push | **Fine as is** | |
| O94 | still to do (BACKLOG 124) | Survivor 51's bingo runs, Below Deck 13's cast, The Traitors 5's groups and cast word | the desk | **Fine as is** | |
| O95 | still to do (BACKLOG.md:316) | "run profile.ts renameSeats for them once" for seats whose name differs from the account's: no script or button does it; it runs only when someone renames (src/lib/server/profile.ts:247-259) | nothing yet | **Unsure** | a "fix seat names" action on a person's desk page, or a one-off script |
| O96 | still to do (BACKLOG 124, 183; HOSTING.md:32-39) | Vercel's storage over its limit, Neon's numbers and old branches, the KLIPY key, the unread paid keys, the Neon password | the hosts' dashboards | **Fine as is** | the site can't safely hold those keys |

---

## Counts

96 numbered items (a later section that meets the same thing points back to its number):

| Verdict | Items |
| --- | --- |
| Fine as is | 50 |
| Admin should show its status | 17 (O1, O8, O18–O23, O39, O40, O61, O65, O68, O75–O77, O89) |
| Keep as a script | 9 (O46–O51, O53–O55) |
| Drop | 9 (O5, O15, O29–O31, O43, O44, O57, O85) |
| Unsure | 7 (O32, O45, O56, O58, O81, O87, O95) |
| Make it an admin button | 4 (O35, O36, O38, O52) |

By section: a) 26 (O1–O26) · b) 8 (O27–O34) · c) 11 (O35–O45) · d) 19 (O46–O64) · e) 21 (O65–O85) · f) 11 (O86–O96).

---

## The ten that matter most

1. **Tell you on your phone when something needs you** (O18–O23, O1). Today nothing does: a sign-up waiting, a problem a player
   sent ("Goes straight to us"), results the bot couldn't settle, the bot down, a held catch-up. One "Site admin" notification,
   and a dot on the hub's avatar when To do has anything.
2. **See whether the bot and its clock are working, in the app** (O39, O77, O89; the desk audit's M5). Today it's SSH into the VM,
   or waiting for a Run now to fail. The code already has the check.
3. **Settle again as a button** (O35; M1), showing what it would move first. Today it's typed into a desktop browser, so it can't
   be done from a phone.
4. **A bar while you preview as a player** (O8). View as has none, lasts 30 days, hides every Site admin door, and the desk then
   only says it's for site admins.
5. **See the hourly job's health** (O61): reminders, waivers, sports finals. It has stopped without a word before, and GitHub
   pauses it after 60 days without activity on the code.
6. **Which AI each kind of run asks, on the desk** (O38; M6). Production sends trivia and bingo to Codex through a setting no
   screen shows, and it has to go back before the ChatGPT Plus trial ends.
7. **Catch-up release, start and try again as buttons** (O52, O36; M2, M3). Loading a rehearsal's answers stays a script (O51).
8. **One read-only list of the site's switches** (O65, O68, O75): game-specs, rulebooks, the tie-break, the catch-up hold, the last
   Settle again. Backups don't record them (O46), and that already tripped a rehearsal.
9. **Clear out the dead and the dangerous** (O30, O43, O44, O57, O85): classic's unlogged "Reset all data", two dead routes, the
   paid-AI research command and the paid keys still stored.
10. **TV listings: show when they last updated, and add the daily backstop** (O40; BACKLOG 184). They stop quietly when the VM
    stops calling.

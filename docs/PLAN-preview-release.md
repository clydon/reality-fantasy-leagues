# Live game previews: the production release plan

The user, 2026-11-19: "Let's finalize this and get a plan for a production release." What's being released is the on-demand preview
(docs/PLAN-game-preview.md, "On demand"): someone taps Preview on a game, a made-up season is played for them on the server, and the
story shows each moment with the app's real screens live in a phone. Nobody takes screenshots. This plan is how it gets from the
`preview` branch to gameyourshow.com.

## Where it stands (2026-11-19)

Finished in development, on this lane's dev server, for the gallery's Fantasy league, Prediction sheet and Survival pool on Survivor 51:
- The season is played in the runtime in under a second; each moment's state is a temporary copy of the game (the live tier); the
  first is written at once and the story opens on it, the rest land while you look (the Fantasy league's story opens in about 6 s,
  the Survival pool's in about 4 s; a live phone takes a few more seconds, mostly the dev server compiling pages).
- The story runs on a preview host, signed in there as the preview's own made-up viewer (a password made per preview, kept on the
  server), so the person's own session is never touched; the phones are the real app, live and tappable.
- Copies are removed when the story closes and after 30 minutes.
- Checked end to end in a browser (`scripts/dev-test/preview-live-check.js`) and by unit tests (`tests/preview-live.test.js`).

What isn't production-ready: the live tier writes only to a local database; the registry of previews lives in one server's memory;
the definition is the first slice's fixture (Survivor 51 to Episode 8), not the person's own season, mark and game; nothing starts it
but a development page.

## Decisions

Decided by the user (2026-11-19): **the free route** (2), **an allowance people can see** (4), **each person's own preview, never
shared, recycled strictly** (6, revised the same day), and 1, 3 and 5 and the numbers as recommended ("go", after the recommendations
and Who does what, below). Nothing is open.

1. **Where previews run (decided: a preview service of their own).** The same app deployed a second time, with its own Neon
   database: on its free `….vercel.app` address first (no DNS for the user), on `preview.gameyourshow.com` before everyone has it
   (one DNS record). A preview writes copies of a season, made-up people and their sessions;
   in their own database none of that can ever show in the real app's catalogue, counts or searches, and a bug in the preview path
   can't touch real data. The app asks the service for a preview and sends the person to its story.
   - **A second deployment, not only a second database**: the phones are the app's real pages, so whatever serves them must read the
     preview database.
   - **Its failures stay its own**: the preview database's limits (decision 2) only ever stop previews, never the app.
   - **A subdomain is safe** because the app's sign-in cookie is host-only (Better Auth's default; `src/lib/auth.ts` doesn't share it
     with subdomains), so the service never receives anyone's real session. Step 13 checks it stays so.
   - **What it shares is the Vercel account**: hence decision 4's monthly budget.

   Rejected: the same database with the copies hidden (every query would need a filter, and one missed is a leak); one deployment
   choosing a database per host (the app's one connection pool is global, so every query path would change).
2. **The free route (decided: "We definitely want to go the free route").** Nothing new is paid for:
   - **Vercel Hobby**, the service a second project on the same account (free; it shares the account's monthly limits). Hobby's
     Functions Storage is already over its 10 GB (docs/HOSTING.md, Alerts): before the second project, set deployment retention so old
     deployments go (Vercel › Settings), and keep the service's bundle to what it runs.
   - **A Neon organization of its own on the Free plan** for the preview database (1 GB of storage, 100 CU-hours and 5 GB of query
     results a month, compute asleep after 5 idle minutes; running out suspends that database alone). Not a second project in the
     app's organization: that one is on Launch, which would bill it. Neon's docs don't say whether a Free organization can sit beside
     a paid one; if the console refuses, a project in the Launch organization costs about $1–2 a month at these sizes.
   - **Cleanup from the hourly GitHub job** (free while the repository is public), since Hobby's cron runs once a day.
3. **Who sees it first (decided: a switch on the desk).** `live_previews` in `app_settings` (off, admins, everyone), on the desk's
   Settings beside Sign-ups, with a history line and Undo as Sign-ups has. It flips in a second, where a deploy (production builds
   only, migrations included) takes minutes; admins first tries what development can't (real seasons, real marks, the gallery's real
   games, real usage) before anyone else spends the month; and it's the brake if previews misbehave. No testers stage between: today
   everyone is one couch.
4. **An allowance you can see (decided).** "You have 3 previews left today" on the Preview button and the wait, and "No previews left
   today: more tomorrow" at none. Proposed: 5 a day each (a look through the gallery is 3 to 5 previews, and a day is easy to
   understand where an hour isn't); reopening your own kept preview (6) costs nothing and doesn't count. At most 10 being made at once
   overall ("Busy: try again in a minute" past that), for the database and the wait. These aren't the free plans' own limits, which
   are monthly totals for the whole account (Vercel's 4 active CPU-hours, Neon's 100 CU-hours): they share those out so one person or
   one busy night can't use the month up.
   **A monthly budget (decided, added 2026-11-19).** The service is a second project on the app's Hobby account, so it spends the
   app's own 4 CPU-hours, and Vercel's community forum has many reports (not official policy) of a Hobby account that went over a
   limit being paused whole, every project with it, until it upgraded, some still paused after the month reset. So the service adds
   up what each preview costs it and stops making new ones at a monthly budget: 1 of the 2.6 spare hours to start (very roughly 400
   to 700 previews), "Previews are full this month: back on the 1st" past it. Staging (step 16) sets the numbers.
5. **The spoiler rule (decided: no new rule).** A preview's mark is what the app's own spoiler guard says this person may be told
   about on this season (`seenThrough`, `src/lib/server/guard.ts`), the check every screen goes through: spoiler protection on, their
   mark; off, with a seat in a game on the season, everything; only following the season, still their mark; a show kept up by
   itself, what's aired; unknown, Episode 0. So a preview never shows more real results than the app would show them that day,
   whatever the guard's rules become. Everything becomes the latest episode whose results are in, not the latest aired (an episode
   that aired an hour ago has no results yet, so it's made up). The first proposal here, the latest aired episode for anyone with
   protection off, would have shown someone who only follows the season more than the app does.
6. **Each person's own preview, recycled strictly (decided; revised the same day: "if we are going to make a preview from a certain
   point in the season it might spoil other users if it's saved and reused. so maybe we should really just have this per user and
   have some strict recycling").** This replaces the first answer, previews of saved and popular community games kept and shared by
   recipe, season and mark. Keyed by mark, sharing wouldn't have shown anyone more than they'd seen, but one wrong key would have
   spoiled everyone who opened it, it needed read-only phones, and at today's size it saved almost nothing. Now:
   - **Never shared.** A preview is made for one person, and only they can open it (step 4's way in).
   - **One at a time.** Making a preview removes your last one.
   - **Gone when you're done**: when the story closes, and at most 30 minutes after it was made, **unless you leave it to make the
     game** (Create this game, or going back to change it). Then it's kept for coming back to while you make that game, reopened from
     it at once and free, as long as the game's settings and your mark haven't changed. It goes when the game is created, when you
     make another, when your mark moves (it would be out of date), and after 24 hours whatever happens.
   - **A change, previewed again**, makes a new one (it counts) on the same made-up season for you at that point, so the second shows
     what your change did.

   So the preview database holds at most one preview per person who previewed in the last day. Measured in development: 0.3 MB of the
   main tables for the Survival pool's or the Prediction sheet's copies, 0.9 MB for the Fantasy league's, perhaps twice that with
   people, sign-ins and indexes.

## Who does what (the user, 2026-11-19: "i want me to do as little input as possible")

Everything is done in this lane but five moments of the user's:
1. **The design story** (step 14): one look, the design process's pause.
2. **Vercel's sign-in, once**: the Vercel command line installed here and its sign-in approved; then the second project, its settings
   and secrets (made here, never shown), deployment retention on the app's project, and the test deployment are done from here, each
   change listed first. (Without it, a click-by-click list for the dashboard.)
3. **The database, one click**: Neon added from Vercel's Marketplace on the Free plan to the service's project (its terms are the
   user's to accept); it makes the database and sets `DATABASE_URL` on the project.
4. **One line to the wizard lane**: "do step 15 of the preview plan" (the Preview button is its code; step 15 says what to send).
5. **The release**: the merge (the lane's rules keep merging and pushing for the user), then on the desk: admins, one preview of
   their own, everyone. And one DNS record for `preview.gameyourshow.com` before everyone.

## How it fits together (the target)

```
gameyourshow.com (the app)                         preview.gameyourshow.com (the preview service)
  Preview, in the gallery                            own Neon database, PREVIEW_SERVICE=1
  POST /api/previews  (signed in)                    POST /api/preview-live  (signed by the app)
    builds the definition from real data  ───────►     plays the season (runtime + computer players)
    (season, cast, your mark, the game)                writes the first copy, the rest after the response
    gets back the story's address         ◄───────     returns the story's address and its pass
  sends you there                          ───────►  /api/preview-live/enter  signs in as the preview's viewer
                                                     /start/preview-story/live/<id>  the story, phones live
  Create this game  ◄──────────────────────────────  the last card goes back to make it, as you
```

- **The app** keeps everything real: it reads the season, its cast and photos, its real results up to the person's mark and the game
  they're making (the gallery's spec with its changes), and builds the definition. Only that goes to the service, with an opaque key
  for the person (a hash of their id), never their name or account.
- **The service** keeps nothing real: copies of a season's public facts up to a mark, and made-up people. No email, push, AI or
  provider keys are set on it, so a copy can never notify anyone or call out. No jobs run against it but the sweep.

## Steps

Each step says what it changes and how it's checked. Steps 1 to 9 are code on this branch; 10 to 13 need the user's accounts; 14 and
15 are the design round and the gallery (with the wizard lane); 16 to 18 are the release.

**Code (this lane)**
1. **The definition from real data, for any season** (`src/lib/server/preview-definition.ts`). Out of the dev script
   (`scripts/dev-test/preview-proof.js` builds the fixture): a season, a mark and a gallery spec become the v2 definition, with the
   explorer's document builder and the gallery's own spec (start-gallery, the wizard lane's), at the mark decision 5 gives. Checked:
   Survivor 51's definition equals today's fixture; a definition for mark N holds no real result past N, and no secret a format keeps
   past N (in a Traitors season the roles of anyone not revealed by N are made up, or the made-up episodes would give the real ones
   away); a season without a cast refuses with why.
   **Done (2026-11-19).** The builder is `tools/gameplay-bench/preview/definition.cjs` (pure: it refuses a real result past the mark
   and any cast field but name, photo and tribe); the app's reader is `src/lib/server/preview-definition.ts` (the season page from
   the wizard's own `wizardOptions`, so a couch is needed: the one asked for, else the person's first; the mark from `seenThrough`;
   the cast mixed a tribe at a time; air times a week apart where none are listed; under two episodes seen, the show's latest other
   season's rates) and `preview-season.ts` (the calendar, the seed). The dev preview now uses it: an account that hasn't watched
   Survivor 51 gets Episodes 1 to 8 made up too. Checked: the proof's three definitions equal the recorded fixture byte for byte;
   `tests/preview-definition.test.js` (a made-up season, `tests/fixtures/preview-season`); the end-to-end check on all three games,
   every ring found. Found on the way: the teams' ring asked for a castaway on every team, which only seed 51's season had; it
   now rings the most shared one (`live.cjs` teamsRing).
2. **Games the runtime can't play yet** say so before anything is made ("No preview for this game yet", with the reason from the
   explorer's own analysis of the spec), never a preview that fails partway. Checked against the gallery's whole catalogue.
   **Done (2026-11-19).** `definition.cjs` `verdict` (the explorer's analysis: engine-valid and a runtime profile with no gaps), asked
   by `preview-definition.ts` after building and before anything is made: a game it stops answers 422 "No preview for this game
   yet", its reasons logged. `scripts/dev-test/preview-catalogue.js` runs the gallery's whole catalogue: on the made-up season and
   on Survivor 51, 31 of the 50 games the gallery offers can be previewed, and the verdict and a season played headless agree on
   every one; with `--live`, all 31 were made as live previews through the real routes (1 to 2 s each) and removed. The 19 that
   can't yet, by the analysis's reasons: a salary cap and a stock market (prices from the data), a draft across tribes (the world's
   tribes), no-repeat picks, most question games beyond per-episode cast and yes/no questions (boot order, most, over/under, pairs,
   split, quote, seal, bank, props, trivia, host), bingo, bingo with trivia, two halves, and a redraft at a format change.
   **All 50 (2026-11-20, the user: "lets get the remaining ... working. even if we have a bank of fake questions and answer or
   scenarios").** Each of the 19 connected in the explorer's runtime (core-runtime-45), and on the real screens:
   - **A bank** of what research gives the server, each with a right answer: a round of trivia after each episode, who says the
     title quote, the finale's votes; filed where the server reads them (trivia_questions, episode_research). A typical rate for each
     of the format's own moments when a season gives nothing to go by.
   - **The bank's rule (the user, 2026-11-20): nothing made up is any one show's or sport's.** If a question, answer, quote, rate or
     scenario would fit only Survivor (or only Below Deck, SNL, the NFL, MLB, tennis…), it's too specific. Placeholders are fine and
     needn't make sense: the trivia is "Who is it?", "How many?" and "Did it happen?", the quote's line is "Quote", the votes are 5 to
     9 with the winner's a majority, a made-up exit is the format's own first way out, and the typical rates are a few made-up
     numbers keyed by any moment's id. Only the format's own data (its moments, tags, exits) and the cast's names go in.
   - **More question kinds** (the boot order, who outlasts whom, a vote split, over/under, a ticket, a trivia round, a choice), each
     with its options as the sheet has them; a card the bot chooses or a host writes, made up from its own list each episode
     (card_choices, host_cards); the computer players answer each kind and stake within their room.
   - **The season's real tribes** (a draft spread across them); a pool's last one standing; an overall by places or stages won; a
     salary cap (teams dealt within it at the engine's own prices); a stock market ranked by worth, its players trading now and then.
   - **Weekly Bingo** (`runtime-bingo.cjs`: a card of the show's moments each episode, ticked as it airs, settled by the results;
     the cards and ticks filed as kept, and a season bank for cards still to come); stages scored outside their state (bingo beside
     trivia).
   - **A new draft at a format change** plays from the made-up season's merge (the format's major change), as a stage that starts
     at the merge does: the one simplification (a format without a merge keeps it as a gap).
   Checked: the catalogue, 50 of 50 on the made-up season and on Survivor 51, verdict and season agreeing on every one, all 50 made
   live; in the browser, the trivia sheet's round, the quote settled, bingo's card and lines, bingo with trivia and redraft's stories;
   the explorer's, runtime's, bench's and preview's tests (235).
3. **The registry in the service's database** (a `live_previews` table: id, owner key, expiry, the viewer, the copies, the story as it
   fills in, complete or failed), since serverless instances don't share memory. Checked: two instances read one preview.
   **Done (2026-11-19).** `db/migrations/0442_live_previews.sql` (`live_previews`: the owner as an opaque key, the made-up viewer,
   the story as it fills in, the copies, until when; `live_preview_entries`: ways in, kept as hashes); `preview-live.ts` saves each
   copy's landing there, reads and closes by the session asking, and sweeps by taking rows (`DELETE ... RETURNING`, so two
   instances never remove one preview twice). A story closed before its last copy landed has those removed when they land. Every
   read is the database's, so any instance answers alike (one dev server shows it; a second instance is step 16's).
4. **Sign-in minted by the service** for the preview's viewer (Better Auth's own session for that user), no password at all, and **a
   way in used once**: the app asks the service for it each time its owner opens or reopens the preview (decision 6), so a copied
   link opens nothing (today's pass is good until the preview expires). Checked: the enter route signs in without a password; an
   expired, used or another preview's way in is refused.
   **Done (2026-11-19).** `src/lib/preview-session.ts`: a Better Auth endpoint marked server-only (its router never serves those),
   called as `auth.api.previewSession`, minting a session for a preview's made-up person only (the live tier's usernames), registered
   in development and on the preview service only. The enter route spends a way in (`?w=`, one use, two minutes, the story's own
   address) and signs the viewer in with it; the maker's per-preview password is the maker's alone and never kept. The story asks
   for nothing but its session. Checked end to end on all three games: the way in a second time is refused (403), the story to a
   browser that isn't its viewer too (401), and nothing is left after (no rows, ways in, people or sessions).
5. **The live tier's guard**: today "a local database only"; then "a local database, or one marked as a preview database"
   (`PREVIEW_SERVICE=1`), and it refuses the production database by its host whatever the flag says. Checked both ways.
   **Done (2026-11-19).** `live-db.cjs` `allowed`: the app's databases by host (`APP_DATABASE_HOSTS`, set on the service from the
   app's own settings, so no host is written in this public repository) refused first, whatever the flag; then a local database;
   then, with `PREVIEW_SERVICE=1`, a database that says it's a preview database (`app_settings` `preview_database`, asked once per
   database before any write), which `scripts/preview-database.js mark` sets, refusing the app's host and any database with one
   person in it who isn't a preview's. Checked: `tests/preview-live.test.js` both ways (and the mark refused or missing); the
   local path unchanged (three live previews made and removed). The service's own path is tried for real at step 16.
6. **The runtime shipped with the service's routes** (`outputFileTracingIncludes` for `tools/gameplay-bench/**` and the engine), and
   the bundle's size measured against Vercel's limits.
   **Done (2026-11-19).** `next.config.ts` `PREVIEW_ROUTES`/`PREVIEW_FILES`: the bench, `src/lib` (the engine, some of it TypeScript
   compiled by jiti as it loads), the explorer's fixtures, `db/rulebooks.js`, `fixture-art.js`, jiti and dotenv; and the embedding
   model's runtime left out (a preview never embeds; `db/embeddings.js` imports it only when it does). Each preview route ships
   21.4 MB (Vercel allows 250 MB unzipped), and `scripts/dev-test/preview-trace-check.js` finds every file a preview loads in its
   trace (it applies the config's excludes itself: a build writes a route's trace before them). Locally the build runs with
   `--webpack` into `.next-build`: Turbopack refuses this checkout's `.models`, a link out of the folder (Vercel's builds fetch it).
7. **Cleanup**: a sweep on each new preview (as now), and an hourly sweep from the existing GitHub job (`reminders-waivers.yml`) calling
   the service's sweep route (open, no secret: it only removes what has expired, at most once a minute), so a preview that's never closed still goes. The sweep also removes any copy older than the
   longest a preview lives (a day, decision 6), registered or not: in development a maker that failed after writing its copies left 43 cases behind
   before the registry learned to remove them. Checked: a forgotten preview is gone within the hour; nothing left after a hundred,
   including ones made to fail partway.
   **Done (2026-11-19).** `POST /api/preview-live/sweep` (`preview-live.ts` `sweepAll`): previews past their time, then any copy
   older than 26 hours that no preview holds (`live-db.cjs` `downStale`: by its show's, people's or couch's age), at most once a
   minute whoever asks (the last sweep's time in `app_settings`, taken in one statement). The hourly job's step calls it once the
   repository variable `PREVIEW_SERVICE_URL` is set. `scripts/dev-test/preview-sweep-check.js`: 78 copies (5 previews past their
   time, 8 orphans a day old, some stopped partway, one fresh orphan) swept to the fresh one's alone, a second sweep inside the
   minute did nothing, and nothing left after. Found on the way: a copy sharing another's people left its couch behind when that
   other went first (as a story closed partway removes it): 95 such couches and 8 copies from this session's own checks, removed;
   `down` now takes a bench couch whose maker is gone.
8. **The allowance, the budget and errors**: the daily allowance, counted in the app's database (a `preview_uses` row each time one is
   made) and shown as "previews left", the overall cap, and the monthly budget, the service adding up what each preview costs it
   (decision 4); the story's states for a service that's down, a preview that failed partway (the moments made so far stay), one
   that has ended, and a month that's full. Checked in the end-to-end check.
   **Done (2026-11-19), but for what's shown.** `db/migrations/0443`: `preview_uses` (the app's: a row per preview made, counted
   over the person's own day by `user_settings.tz`) and `live_preview_months` (the service's: previews and CPU milliseconds a month).
   `preview-allowance.ts` takes one of today's 5 (one take at a time per person) and gives it back when the preview isn't made;
   `GET /api/previews/allowance` says how many are left, for the Preview button and the wait. The maker's row now exists from the
   start, so `startMaking` refuses an 11th being made at once ("Busy: try again in a minute.") and a month past its budget
   ("Previews are full this month: back on the 1st."); each made preview adds the process's CPU while it was made, plus 1.5 s for
   its phones, to its month (`PREVIEW_MONTH_CPU_MS`, an hour by default). The story's moment that a preview stopped partway never
   made says "This moment couldn't be made". `scripts/dev-test/preview-limits-check.js` holds each through the real routes; a
   Survival pool preview measured 7.3 s on the dev server (with the phones' 1.5), so the hour is about 490 a month. What's left for
   the design round (step 14): "You have 3 previews left today" on the Preview button and the wait, and these refusals' screens.
8a. **Your preview, kept while you make the game** (decision 6): one per person (making one removes the last); removed when its story
   closes unless you left it for Create this game or a change, then kept against the game you're making (its settings and your mark)
   and reopened from it without making another; removed when that game is created, another is made, your mark moves, or after 24
   hours. A preview after a change plays the same made-up season (its seed from the person, the season and the mark, not the game).
   Checked: reopening within the day makes nothing; a change makes a new one and the old is gone; a copied link opens nothing for
   anyone else; nothing outlives a day.
   **Done (2026-11-19), the service's half.** `preview-live.ts`: a preview's key is its season, mark, base and changes
   (`gameKeyOf`); asking for the same key while it lasts reopens it with a new way in and takes no use; making one removes the
   person's others in the same statement that starts it; `POST /api/preview-live/[id]/keep` holds it to a day from when it was made;
   the story's own close (its page leaving) leaves a kept preview, its owner's removes it either way (the app's, when the game is
   made: step 9). The story's last card, live: Go back and Create this game keep it, then go to the app's host (`exits`, given when
   it's made; the gallery's places come with step 15). The seed was already the person's, season's and mark's (step 1), so a change
   previewed again plays the same made-up season. Checked: `scripts/dev-test/preview-keep-check.js` (reopened free, kept a day,
   another game removes the last, kept past its day swept) and `preview-live-check.js --create` (Create this game from the story:
   kept after its page closed, and reopened when asked again).
9. **The app's side** (also: the show's art sent with the definition, since the service's database has no real show to borrow it
   from, as the live tier does locally: `fixture-art.js` borrow): `POST /api/previews` (signed in, the switch on) builds the definition, asks the service (signed with a shared
   secret), and returns the story's way in; Create this game comes back to the app with the game's spec and the preview it came from
   (decision 6).
   **Done (2026-11-19).** `src/lib/server/previews.ts` (the app's half): the desk's switch (`app_settings` `live_previews`: off,
   admins, everyone; off in production until set, everyone in development), the season read for the person
   (`preview-definition.ts`, now with the show's art), one of today's previews taken, and the service asked: in-process in
   development, else over HTTPS to `PREVIEW_SERVICE_URL`, signed with `PREVIEW_SECRET` (`preview-signature.ts`: an HMAC of the time
   and the body, five minutes). It sends the definition, the made-up results' rates, the person as an opaque key and the game's key;
   a reopened preview gives its use back; at none left it can still reopen. `POST /api/previews` answers the story's address on the
   service (a way in) and how many are left; `DELETE /api/previews/[id]` removes it (the game made: kept or not). The service's half,
   `preview-live.ts` `makeFromDefinition` behind `POST /api/preview-live/make`, takes only signed asks, and a signed `DELETE` removes
   an owner's preview. The development page goes through the app's half too. Checked: `scripts/dev-test/preview-service-check.js`
   (unsigned, wrongly signed and stale asks refused; made, reopened, another owner's removal refused, its owner's done, all over
   HTTP); the end-to-end, limits and keep checks through the app's half. The app's `ask` over HTTPS is tried for real at step 16.

**Infrastructure (the user's accounts)**
10. **A Neon database on the Free plan** (decision 2), added to the service's project from Vercel's Marketplace (the user's click: Who
    does what), its migrations run by the same `db/migrate.js` on its own build, reading the `DATABASE_URL` the integration sets.
11. **A Vercel project for the service** (Hobby, after deployment retention clears old deployments: decision 2), made from here with
    the Vercel command line: this repository, production builds only (as the app's), Fluid compute on, its own environment: the preview
    database's URL, `PREVIEW_SERVICE=1`, `BETTER_AUTH_URL=https://preview.gameyourshow.com`, its own `BETTER_AUTH_SECRET`, the
    shared `PREVIEW_SECRET`; none of the app's email, push, AI or provider keys. The domain `preview.gameyourshow.com`.
    Also `AUTH_DATABASE_URL` (the code's name: the integration's `DATABASE_URL`, copied from here, never shown), and
    `APP_DATABASE_HOSTS` (the app's database host, so the live tier refuses it: step 5); then `scripts/preview-database.js mark`.
12. **The app's environment**: `PREVIEW_SERVICE_URL` and `PREVIEW_SECRET`, set from here (secrets made here, never shown).
13. **A security review** (run here) of the enter route (pass, host, redirect targets), the service's create route (signature, limits), and that
    the service's routes refuse anyone but a preview's viewer.
    **Done (2026-11-20).** A separate read of every route, the session plugin and the live tier's guard: nothing critical or high.
    Fixed: the app's preview routes refuse on the service (`previews.ts` `appOnly`: there they'd have asked the service in-process,
    unsigned) and the development page's route refuses in production; a preview viewer's session lasts a day and ends with the
    browser (it took the app's 60 days); a signature covers its method and path (a make's body can't stand in as a removal); a make
    that fails still counts its CPU against the month (not as a preview); the enter route's redirect is the service's own address, its
    tour cookie Secure on HTTPS; the live tier calls a database local by its host alone; a preview id is checked before it reaches
    the service's path; why a make stopped goes to the log, never the viewer; `ownerKey` needs `BETTER_AUTH_SECRET` in production;
    exits refuse `//`. Left as they are: a signed ask can be replayed inside its five minutes (it needs the app-to-service HTTPS
    traffic, and a replay only reopens the owner's own preview); the way in is a bearer link (whoever holds it in its two minutes
    enters a made-up viewer on the preview host, where nothing is real); a preview-style username can be registered on the service
    (only the registry's viewer is ever signed in). Found on the way: the story's own page returned 404 in any production build, so
    the service couldn't have shown it (now: development, or `PREVIEW_SERVICE=1`); and a preview that stopped partway could have
    copies land after it said so (the maker now waits for every write: `preview-sweep-check.js` holds it).

**Design and the gallery**
14. **The design round on the flow** (docs/DESIGN-PROCESS.md: Intent, Perception-First Design and Impeccable once each, one check, one
    batch, the screenshot story, a pause): the Preview button's place, the wait (today's making screen), moments arriving, the phone's
    states, the ended and failed states, and Create this game.
    **Built, waiting for the user's look (2026-11-20).** docs/design-round/preview-flow-spec.md (Intent: the flow, every refusal,
    Try it's line for step 15, the desk), preview-flow-first-view.md (PFD: R1 to R5; no count during the wait), then built: one
    frame for the wait and every way it stops (`live-story.tsx`, the words in `refusals.ts` for the gallery to reuse), the story's
    strip marking moments still coming and never made, a used or ended link's own page (the enter route sends it there), and the
    desk's switch. Checked once each: Impeccable's critique 27/40 (the detector: three type sizes off the ramp), PFD 79/100; one batch
    of fixes. Frames: `scripts/dev-test/story-preview-flow.js` into `.ui-atlas/stories/preview-flow/`. The story:
    https://claude.ai/artifact/YWYDNPaX9gcKFaRv8jew8f (a choice for the user: the wait as a title card, the show's art and the story's
    strip already drawn).
15. **The gallery's Preview button** (the wizard lane's code): it sends the game's spec, with its changes, to step 9.

**Release**
16. **Tried first without production**: a production build here; then a test deployment of the service straight from this branch
    (the Vercel command line, no push), on the preview database, asked by this lane's app and driven by the end-to-end check (no real
    data anywhere); 10 previews at once to see the limits hold, and what each costs (active CPU and query results: decision 4's
    numbers).
17. **Admins, then everyone**, by the switch (decision 3).
18. **Watched**: previews made, failed and refused, and the time to the first live phone, logged; a line on the desk ("Previews this
    month: 120 · 40% of the budget"), so nobody needs Vercel's or Neon's dashboards; docs/HOSTING.md updated with the service, its
    limits and its cost.
    **The desk's half done (2026-11-20).** Settings › People › Game previews: off, site admins only, everyone (`livePreviews`, a line
    in Settings history with Undo), and this month's previews against the budget as one bar and one line, asked of the service
    (`POST /api/preview-live/month`, signed; the desk still opens when it doesn't answer). HOSTING.md waits for the service to exist.

## What it costs on the free route (estimated from what development measured)

Money: nothing (decision 2). What it uses of the free plans:
- **Vercel active CPU** (4 hours a month for the whole account, about 1.4 of them used in the last snapshot): making a preview is
  about a second of the runtime, 2 to 6 seconds playing what's typical, and its copies' writes, mostly waiting on the database, which
  Fluid compute doesn't count; then its phones' page loads, a second or two in all. Call it 5 to 9 active seconds: the monthly
  budget's 1 hour (decision 4) is about 400 to 700 previews, and all 2.6 spare hours would be 1,000 to 1,900. What's typical can be
  played with fewer seasons if it's tight.
- **Neon CU-hours** (100 a month, the preview database's own): each burst of previews keeps it awake about five minutes (about 0.02
  CU-hours), so thousands.
- **Neon query results** (5 GB a month, its own): not measured; if a preview's phones read 1 to 3 MB, that's 1,700 or more a month,
  above the CPU budget.
- **Neon storage** (1 GB): 0.3 to 0.9 MB per preview in the main tables, perhaps twice that with people and sign-ins; at most one
  per person who previewed in the last day (decision 6).
All estimates until step 16 measures them.

## Risks

- **Bundle size**: the service's functions carry the runtime, on an account already over Hobby's Functions Storage (decision 2).
- **Coverage**: a game with a twist the runtime can't play yet has no preview (step 2 says so); the explorer's gaps list is the
  roadmap.
- **Vercel's pause**: the service shares the app's Hobby account, and an account over a limit can be paused whole, the app with it
  (decision 4). The monthly budget keeps previews well inside the spare, and the switch (3) stops them at once.
- **Spoilers** come from what goes into a preview, not who opens it: a wrong mark, or a secret a format keeps, would put real results
  in one. The mark is the app's own guard's (5), and step 1's checks hold the rest. Previews are never shared (6), so a mistake
  reaches one person, not everyone on a mark.
- **Two lanes**: the gallery (the wizard lane's) owns the button and the spec's shape; this plan needs both agreed before step 9.

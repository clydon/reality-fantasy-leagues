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

## Decisions for you

1. **Where previews run (recommended: a preview service of their own).** The same app deployed a second time, on
   `preview.gameyourshow.com`, with its own Neon database. A preview writes copies of a season, made-up people and their sessions;
   in their own database none of that can ever show in the real app's catalogue, counts or searches, and a bug in the preview path
   can't touch real data. The app asks the service for a preview and sends the person to its story. Rejected: the same database with
   the copies hidden (every query would need a filter, and one missed is a leak); one deployment choosing a database per host (the
   app's one connection pool is global, so every query path would change).
2. **The plans it needs.** Vercel Hobby allows a second project, but Hobby's Functions Storage is already over its 10 GB (docs/HOSTING.md,
   Alerts) and a second project adds to it; the service's functions also carry the runtime. Either clear old deployments first, or move
   to Pro ($20 a month). A second Neon project on the free plan (0.5 GB, 100 CU-hours a month) is likely enough: copies are small and
   gone in 30 minutes, and compute sleeps between previews.
3. **Who sees it first.** A switch in `app_settings` (`live_previews`: off, admins, everyone), as `catchup_hold` and `bot_ai` are.
4. **Limits.** Proposed: 6 previews an hour per person, 10 being made at once overall ("Busy: try again in a minute" past that).
5. **The spoiler rule for someone with spoiler protection off.** Proposed: their mark is the latest aired episode, so real results run
   to it and only what comes after is made up.

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
   explorer's document builder and the gallery's own spec (start-gallery, the wizard lane's). Checked: Survivor 51's definition equals
   today's fixture; a definition for mark N holds no real result past N; a season without a cast refuses with why.
2. **Games the runtime can't play yet** say so before anything is made ("No preview for this game yet", with the reason from the
   explorer's own analysis of the spec), never a preview that fails partway. Checked against the gallery's whole catalogue.
3. **The registry in the service's database** (a `live_previews` table: id, owner key, expiry, the viewer, the copies, the story as it
   fills in, complete or failed), since serverless instances don't share memory. Checked: two instances read one preview.
4. **Sign-in minted by the service** for the preview's viewer (Better Auth's own session for that user), no password at all. Checked:
   the enter route signs in without one; an expired or another preview's pass is refused.
5. **The live tier's guard**: today "a local database only"; then "a local database, or one marked as a preview database"
   (`PREVIEW_SERVICE=1`), and it refuses the production database by its host whatever the flag says. Checked both ways.
6. **The runtime shipped with the service's routes** (`outputFileTracingIncludes` for `tools/gameplay-bench/**` and the engine), and
   the bundle's size measured against Vercel's limits.
7. **Cleanup**: a sweep on each new preview (as now), and an hourly sweep from the existing GitHub job (`reminders-waivers.yml`) calling
   the service's protected sweep route, so a preview that's never closed still goes. Checked: a forgotten preview is gone within the
   hour; nothing left after a hundred.
8. **Limits and errors**: the per-person and overall limits (decision 4); the story's states for a service that's down, a preview that
   failed partway (the moments made so far stay), and one that has ended. Checked in the end-to-end check.
9. **The app's side**: `POST /api/previews` (signed in, the switch on) builds the definition, asks the service (signed with a shared
   secret), and returns the story's address; Create this game comes back to the app with the game's spec.

**Infrastructure (the user's accounts)**
10. **A Neon project for previews**, its migrations run by the same `db/migrate.js` on its own build.
11. **A Vercel project for the service**: this repository, production builds only (as the app's), its own environment: the preview
    database's URL, `PREVIEW_SERVICE=1`, `BETTER_AUTH_URL=https://preview.gameyourshow.com`, its own `BETTER_AUTH_SECRET`, the
    shared `PREVIEW_SECRET`; none of the app's email, push, AI or provider keys. The domain `preview.gameyourshow.com`.
12. **The app's environment**: `PREVIEW_SERVICE_URL` and `PREVIEW_SECRET`.
13. **A security review** of the enter route (pass, host, redirect targets), the service's create route (signature, limits), and that
    the service's routes refuse anyone but a preview's viewer.

**Design and the gallery**
14. **The design round on the flow** (docs/DESIGN-PROCESS.md: Intent, Perception-First Design and Impeccable once each, one check, one
    batch, the screenshot story, a pause): the Preview button's place, the wait (today's making screen), moments arriving, the phone's
    states, the ended and failed states, and Create this game.
15. **The gallery's Preview button** (the wizard lane's code): it sends the game's spec, with its changes, to step 9.

**Release**
16. **On a staging pair first**: the service and a copy of the app on Vercel preview URLs with their own databases; the end-to-end
    check run against them; 10 previews at once to see the limits hold and what each costs.
17. **Admins, then everyone**, by the switch (decision 3).
18. **Watched**: previews made, failed and refused, and the time to the first live phone, logged; docs/HOSTING.md updated with the
    service, its limits and its cost.

## What it costs (estimated from what development measured)

A preview is a second of the runtime, 1 to 12 seconds writing copies (5 for the Survival pool, 10 for the Fantasy league) and 2 to 6
seconds playing what's typical, on the service; then a few page loads per moment while someone looks. Much of the writing is waiting on
the database, which Vercel's Fluid compute doesn't count as active CPU. On Hobby's 4 active CPU-hours a month that's thousands of
previews; on Neon's free 100 CU-hours, each burst of previews keeps the database awake about five minutes (about 0.02 CU-hours), so
also thousands. Both are estimates until step 16 measures them.

## Risks

- **Bundle size**: the service's functions carry the runtime, on an account already over Hobby's Functions Storage (decision 2).
- **Coverage**: a game with a twist the runtime can't play yet has no preview (step 2 says so); the explorer's gaps list is the
  roadmap.
- **Spoilers**: a wrong mark would put real results in a preview; step 1's check holds the rule.
- **Two lanes**: the gallery (the wizard lane's) owns the button and the spec's shape; this plan needs both agreed before step 9.

# Handoff: where things stand (for a fresh session)

Read this first, then `docs/BACKLOG.md` (what's open, and what's been decided against), then
`README.md` for the full history. `CLAUDE.md` / `AGENTS.md` hold the standing project rules.
`docs/ADDING-A-SHOW-FORMAT.md` is the playbook for adding a show beyond Survivor/Traitors/Challenge.

There's also a player/commissioner/admin-facing **User Manual & Product Guide**
(https://claude.ai/code/artifact/cf6a3dd3-ecd3-4d80-88ea-d71b925a2042) — a Claude Doc, not a repo
file, written entirely from the product/UX side (no architecture, no code) and organized around a
Survivor 51/50 running example. It's not auto-updated when features change; open it with the Docs
tool if you need that framing (e.g. "what does the app call this to a player," "how is this
explained to a commissioner") rather than re-deriving it from source each time.

## Hosting: read [HOSTING.md](HOSTING.md) before adding anything that polls, runs on a schedule or stores data
Every service, its free limits, current usage, what drives each limit, and what more would cost; keep it current
(the user's standing request, 2026-10-24). **The repo is public** since 2026-10-24 (free Actions minutes; the
history was scrubbed of real people's data first): never commit secrets, real usernames or emails, or screenshots
of real data (HOSTING.md, The repo is public). Open alerts there: Vercel's Functions Storage is over its free 10 GB,
and the Neon password rotation (deferred; steps there). Fixed 2026-10-24: the chat polls that used up Neon's transfer
(31294fd); the bot clock that kept Neon awake (the VM calls only when a run is due; runs count from the episode's
end); GitHub Actions, stopped since 2026-10-19, runs again. Vercel builds production only (Preview shared
production's database).

## Next: moving the app onto the new design (plan written 2026-10-23)
**Read [PLAN-new-design.md](PLAN-new-design.md) first.** One database, no data transfer (the new screens read and
write the same leagues), additive migrations, the classic app running beside the new one until the couch switches,
and a Preview overlay (`<Preview step>`) on anything still on fixtures. Its Status table says what step is next; each
step updates it and adds an As built note. Step 0a (back up the live leagues) is done (2026-10-24: the production backup restores exactly), and so is 0b, the backend foundation (2026-10-24: couches, per-person progress, the schedule, the Game admin role, the server-side spoiler guard and the new design's read endpoints; migrations 0100–0105, rehearsed on production's data). **Before 0b's migrations reach production**: a fresh backup and a Neon branch rehearsal (`scripts/rehearse-migrations.js`), steps in 0b's As built. R1 (rulebooks phase 1, logic only: the schema, the built-ins as blocks, the How it works view model) is done too, and so is R2 (2026-10-24: the compiler on top of each format's frozen data, golden tests proving the built-ins score unchanged, counts scored per unit with decimals, secret roles, phase gating, state-logic with no winner; migration 0106, which ships with 0b's and needs the same rehearsal). One library item for the user's review: Below Deck's tip share now scores per dollar (R2's As built). R3 is done too (2026-10-24: migration 0107's `rulebooks` and `rulebook_edits`, `db/backfill-rulebooks.js` run on the local copy, `db/rulebooks.js`, and `settings.rulebook` written into leagues behind the `rulebooks` flag, which stays off; `scripts/rulebooks-flag.js check` shows every league scoring the same with it on). 0107 ships with 0b's migrations, and their rehearsal now runs the backfill and that check on the Neon branch. 0c is done too (2026-10-24: the new shell. Routes under `src/app/(new)/`, opting in with Try the new design (migration 0108 `user_settings.ui`, which ships with 0b's), the Night tokens forced, the primitives, the Preview registry and `check-preview.js`, and the navigation motion on React view transitions; checked by `check-new-shell.js`). Next is 0d. Updated 2026-10-24 with every
mock decision since, the rulebooks phases placed in its order (R1–R3 after 0b), and step 6 split into 6a/6b/6c. **All
code work is on the `new-design` branch**; don't merge or push it without asking.

## Full-site mock in progress, 2026-10-22 (`.impeccable/mocks/site/`, gitignored)
**This is the current focus.** The user wants a full clickable website mock as *the* design the real
app gets ported onto: no stone unturned, simplified or redesigned wherever /impeccable calls for it.
Way of working: go one area at a time, interview the user on direction, bring bold recommendations
(with a recommended option), then pause for review after each area. Casual-first (the trial showed
pressure turns players off), phone-first at a fixed 390 × 844.

- **See it:** open `.impeccable/mocks/site/index.html?n=4#/hub` in Chrome. The mock chip (bottom-left)
  switches 4 / 12 players / Solo / New player. Screenshot every area with no server or login:
  `node scripts/dev-test/shoot-site.js <outDir> [#/route ...] [--n=4] [--sheet]`. It prints page errors,
  so run it after every edit.
- **Journey:** sign-up → first run (pick shows → where you are → start / join a couch / just me) → hub
  (Tonight's Guide) → show space (Tonight · Episodes · Standings · Cast · Chat) → moves dock → draft
  room / blind draft → watch along → staged results and the reveal → Backstage (results with Ask an AI,
  waivers, scoring rules, members and roles, game settings, recent changes) → account settings.
- **Decisions:** all in memory `site-mock-decisions.md`, with the routes, how the mock is built and the
  pitfalls already hit. Read it before touching the mock. In short: Outlast / Weekly Lineup / Survival
  Pool; per-show tabs with games inside; always land on the hub; moves dock; casual-first draft;
  results in stages; Backstage per game with shareable roles; guards by blast radius.
- **Files:** `index.html` (hub CSS + JS inline, from `overdrive/hub.html`, plus the router at the end),
  then one JS + CSS file per area, in load order: show, round2 (signup, first run, solo, join, couches),
  dock, draft, episode, stages, backstage, askai, settings, guards; `device.css` loads last. **Later
  files override earlier functions by redeclaring them**, so grep for the last definition before editing.
  `roster-options.html` is the A–D roster comparison (D chosen). Real photos and art come from
  `.impeccable/mocks/showcase/` (`scripts/dev-test/export-showcase.js`).
- **Landing → sign-up built 2026-10-22, waiting on the user's review:** `landing.js`/`landing.css` (`#/welcome`,
  `lp-` classes), first run is now four steps (shows → where → account → people), `#/signin`, a Join with a code
  sheet, and the signed-out invite (account sheet, then where you are, then the join). The New player chip opens
  `#/welcome`. Check: `node scripts/dev-test/check-site-signup.js <outDir>`; `shoot-site.js --scroll` shoots long pages.
- **Every show in the show space + what the couch watches, built 2026-10-22, waiting on review:** `watching.js`/`watching.css`
  (loaded last; wraps showRoute, hub, openWatch and friends). Two example shows were added: The Amazing Race (not a game yet,
  you and jordan both watch) and Pluribus (a series only sam watches); their art is a typographic placeholder in
  `showcase/art/`. Check: `node scripts/dev-test/check-site-watching.js <outDir>`.
- **Still to do, in order:** (2) watch-only shows (built, see above; awaiting review) (Below Deck, The Challenge) inside the show space with the same tabs;
  (3) notifications depth; (4) a written plan for porting the real app onto the mock (the second-pass
  drill-down of `PLAN-couch-and-episode-night.md`, whose top now lists what the mock changed). Desktop
  layouts come after.
- **Live for testers (2026-10-22):** the whole site mock is served at **/mock** (and the older **/mock/hub** link)
  from `public/mock/`. After any mock change: `node scripts/dev-test/publish-site-mock.js`, then commit
  `public/mock/` and deploy. Phones get it full screen; desktops get the 390 × 844 frame. A floating
  Scenarios button (`mockmenu.js`) jumps testers to each state (new visitor, invite, hub sizes, shows, drafts). The
  mocks are gitignored and exist only on this machine.
- **Uncommitted:** this file, `docs/PLAN-couch-and-episode-night.md` (new), `scripts/dev-test/shoot-site.js`
  (new), `scripts/dev-test/inline-mock.js` (embeds key art). Commit only when the user says.
- **Security:** a production Neon connection string was pasted into the 2026-10-18 conversation. It
  wasn't used. The user should rotate that password if they haven't.

## Couch, hub and episode night: overview planned 2026-10-18; landing page shipped (61bb774)
The next big piece: a **couch** (the lasting group, across seasons and shows), a **hub** with a TV
guide, a **show space** per show organised Before / During / After, episode games (Rate it, bingo,
watch along) and show pages without a league. Overview plan: `docs/PLAN-couch-and-episode-night.md`
(read it first; it ends with what the detailed pass must produce). Mocks in
`.impeccable/mocks/overdrive/` (not in git). The signed-out landing page at `/` shipped in 61bb774
(`src/components/landing/`, sign in moved to `/sign-in`, checked by
`scripts/dev-test/check-landing.js`); it still uses wiki cast photos.

## Settings and Create a league reordered, 2026-10-17 (committed 45b050d)

[PLAN-settings-order.md](PLAN-settings-order.md): waivers aren't asked up front (they fit the real teams, ownership and cast when the draft starts); a new Teams & draft page holds ownership, roster, the fit arithmetic and the draft date; the index is grouped (Get ready / How it scores / League); the cast import hides starting tribes by default. Create a show done too (the research panel: name, copy, paste, sticky Review; the review's Approve is sticky). Checks: `check-settings.js`, `check-create-show.js`. **The commissioner tour is now out of step with these screens and is the next job.**

## Commissioner tour rebuilt on Survivor 51, 2026-10-17 (committed 555ddb8)

See [PLAN-commissioner-tour.md](PLAN-commissioner-tour.md): copy/paste everywhere with a Paste/Clear button, show import, cast import, points, waivers, draft types, results. Check: `scripts/dev-test/check-commissioner-tour.js`.

## League tabs redesign: built and shipped 2026-10-17 (b275693, d4bf873); the site mock will replace it

[PLAN-league-tabs.md](PLAN-league-tabs.md): the same six tabs in every game (Overview · Episodes ·
Scoreboard · Team/Lineup/Pick · Research · More), Research for Classic and Pool too, Waivers linked off
Team/Lineup instead of being a tab or a More row, linked groups under one name with a league strip
(swipe kept), and "Up next" on Overview (this game's most urgent move, "+N more" for the rest of the
group, a dark commissioner "control room" strip above it) to fix players missing their to-dos. Mockups
built from real captures are linked at the top of the plan. Build order is in the plan; the "light
touches" section needs the user's OK first. Uncommitted: `scripts/dev-test/view-as.js` now marks
What's New read for the zt_ account (so captures aren't covered).
Built, uncommitted: step 1 (six tabs, More), step 2 (Team for Classic, the waiver banner and section on Team /
Lineup), step 3 (group name in the header, the league strip, swipe kept, ▾ menu: the plan's "As built: step 3"),
step 4 (Up next and the commissioner's control room on Overview: the plan's "As built: step 4").
step 5 (bottom sheets close with a swipe down: the plan's "As built: step 5").
step 6 (Pool Research: Open to you / Used / Everyone, Safety ranking: the plan's "As built: step 6").
step 7 (the light touches, decided by the user: the plan's "As built: step 7"): Up next on every page but Team / Lineup
(own waiver banner) with Episodes keeping its results lead; the status plate's rules now say "Nothing to do in Pool ·
Next: …"; "Team" link on Overview's Your team; header art kept, contrast fixed and measured (`check-header-art.js`).
Decided against: the Episodes "The cast" → Research link and removing /cast.
Step 8 done: tour, DESIGN.md and the User Manual doc updated. Still open: the What's New entry (release 2026-10-17, three items drafted in conversation, not yet approved or added to `src/lib/whats-new.ts`). The impeccable animate + delight pass is built (uncommitted): DESIGN.md → "Motion"; `scripts/dev-test/check-motion.js` (+ `motion.js`, `up-next-fixture.js`). Open for the user: Up next's quiet "Next: …" line
shows on Overview only (a quiet game shows nothing on other pages); say if it should be everywhere.

## Waivers v2: engine, UI and window pushes committed and pushed 2026-10-16

One claim type (ranked "add X, drop Y" pairs), replacement rules (`replaceRule`), waiver windows
(`waiverWindows`), `autoFill`, the commissioner's Open a waiver window, and `WaiverLogic.recommend()`.
Plan: `docs/PLAN-waivers-v2.md`: "As built: phase 1" (engine), "As built: phase 2" (UI: file map, the calls
made, what was verified) and "As built: phase 3" (the window pushes: who reads what). Design: the canvas https://claude.ai/artifact/KEsHGXFXjsDeuWe65JWZZz; DESIGN.md →
"Waivers (mid-season moves)" now describes v2. `db/migrations/0063_waivers_v2.sql` is applied locally; production
gets it on deploy.
- **Pushed 2026-10-16** (with the caption-tag fix 8429df3). Three commits: the engine (a5f51b4),
  the UI (f611214) and the window pushes.
- **The four design decisions, answered 2026-10-16:** auto-fill on for Casual only; shared pickups join at the
  deadline; claims grouped by spot (replacements first, no way to put a swap first); "Only when short" hidden for
  Classic (reads as Replace right away). Plus: the create wizard asks "How many teams?" and re-fits the suggestion
  when the draft starts.
- **Waiting on the user:** the What's New draft (release `2026-10-16b` in `src/lib/whats-new.ts`, uncommitted; it
  also trims "Swaps are now called add/drops." from the live 2026-10-16 item, now wrong).
- **Phase 3 built:** when the commissioner opens, changes or turns off a window, the rotation (not the commissioner)
  gets "Waiver window open: <the sheet's own no-names line>" (or "Waiver window off"); anyone whose claim was
  trimmed gets "Your claim changed" instead. `src/lib/server/waiver-pushes.js` `windowMessages`/`sendWindow`; the
  line itself is now `src/lib/game/waiver-words.js`, shared with the sheet. User Manual doc updated 2026-10-16.
- Checks: `tests/waivers.test.js` (36); `tests/waiver-pushes.test.js` (14); `node scripts/dev-test/check-waivers.js` (85);
  `check-waivers-alerts.js` (now also opens, changes and turns off a window on `zt-wv-rebuild`); `node scripts/dev-test/check-waivers-ui.js <outDir> [390] [--dark] [--only=classic|roster|rebuild|wizard]`.
- Existing leagues keep their settings (Last Survivor Standing still reads Replace right away + every 3 + 1 swap)
  until their commissioner applies the suggestion in League Settings › Waivers.

## Mid-season waivers: phases 1–4 built 2026-10-16 (not committed); every league is on waivers

Pickups and Swap become **Waivers**: private ranked claims, processed at once in waiver order (pickups
first, then add/drops), then free agency until airtime. Design: the "Mid-Season Moves" canvas
(https://claude.ai/artifact/374Ha1KqK45HdbQR1ftcpk). Plan, rules, data model and phases:
`docs/PLAN-midseason-waivers.md` (its "As built: phase 1" has the file map and the calls made).
- Built: `WaiverLogic` in state-logic.js, the private `waiver_claims` table (0060, applied locally),
  `src/lib/server/waivers.js` (claims, the lazy clock in `withLeagueLock`/GET state, Process now), the
  `/waivers` routes, bot claims, and spoiler redaction (which also fixes live rounds' pickups showing to
  players who haven't revealed). Behind `settings.midSeasonMode: 'waivers'`: no league changes until
  it's switched on.
- Tests: `tests/waivers.test.js`; `scripts/dev-test/waivers-fixture.js` + `check-waivers.js` (34 API
  checks against the dev server); `api()` in `scripts/dev-test/browser.js`.
- **Phase 2, the UI, built the same day** (not committed): every board on the canvas but the alerts (11),
  in `src/components/waivers/`; `/waivers` for every league type (Classic: Mid-Season's slot; Active Roster:
  a row in the phone's More sheet, which carries a dot when a claim is yours; old `/research/waivers` links redirect). Shared leagues show no order or ranking. File map, calls and what was verified:
  the plan's "As built: phase 2". Browser check: `node scripts/dev-test/check-waivers-ui.js <outDir> [390] [--dark]`.
- **Phase 3, pushes and the clock job, built the same day** (not committed): `src/lib/server/waiver-pushes.js`
  (who hears what), "Waivers processed" sent by whoever processed the week (`withLeagueLock` or the new
  hourly `db/waivers.js`, a workflow step after reminders), 6h-before reminders, the results push's
  "Waivers process …" line, Nudge (`/waivers/nudge`), two new notification types (`waivers`,
  `waiverReminder`), the alert strip's pickup item, Overview's status plate and "You got …" plate. Calls and
  checks: the plan's "As built: phase 3". New checks: `tests/waiver-pushes.test.js`,
  `scripts/dev-test/check-waivers-alerts.js`; `check-waivers-ui.js` now shoots Overview too.
- Production, when this ships: the workflow's new step uses the same secrets as reminders.js (nothing new
  to set).
- Waiting on the user: a standalone Waivers tab for Active Roster (Episodes + Lineup merged) or keep it in
  Research (canvas board 14); in shared leagues, should pickups wait for processing or be instant.
- **Phase 4, built the same day** (not committed): waivers are the only mode. Live rounds are deleted (engine,
  routes, panels, bots' turns, the `midSeasonTurn` push, Swaps & pickups settings); `settings.midSeasonMode` is gone.
  `db/migrations/0061_waivers_for_every_league.sql` (applied locally; production on deploy) closes any open round.
  The guided tour's pickup is now a waiver claim. Details and calls: the plan's "As built: phase 4".
- Waiting on the user: the What's New draft (release `2026-10-16` in `src/lib/whats-new.ts`, uncommitted; it also
  deletes the 2026-10-10 "Make your own pickups and swaps" item, now wrong).
- **Phase 5 done 2026-10-16:** DESIGN.md has a "Waivers (mid-season moves)" section and the picker/status-plate/navigation lines
  say waivers; the User Manual doc's Replenish/Swap lines now describe waivers (its Episodes/results text is still the old path).

## Episodes tab + the commissioner's results job, built 2026-10-16 (not committed)

Filling in an episode's results is now every commissioner's job by default (any league, not just
league-decided seasons; an admin or, later, paid automation may get there first, then nothing is due):
- **Rule:** `resultsDueEpisode` in `src/lib/game/action-items.js` (aired, in play, nothing recorded; never
  in a catch-up league). Feeds the alert strip ("Results" item, commissioners only, hidden on /episodes*),
  the Episodes tab and a new push: `db/reminders.js` `remindResults`, the morning after airtime (9am season
  time, at least 6h after; once; new notification type `resultsDue` in `push-core.js`).
- **Episodes tab** (`episodes-tab.tsx`, new `week.tsx`): "This week" (the commissioner's task plate,
  `results-task.tsx`, then "Your week": lineup / pick / team / predictions rows + "3 of 4 lineups set"),
  "Last time" / "New results" (reveal or recap), then "All episodes" with later episodes folded.
- **Results page** (`episode-results-page.tsx`): numbered steps 1 Copy the question, 2 Paste its answer,
  3 Check and apply; Apply turns yellow only on step 3. The episode page uses the same task plate with
  "Or enter them by hand" under it; leagues with no season go straight to entering by hand.
- Tests: `tests/results-due.test.js`, three new cases in `tests/reminders.test.js`. Fixture and shots:
  `scripts/dev-test/results-fixture.js`, `scripts/dev-test/check-episodes.js`.
- Not done: DESIGN.md's Episodes/Results sections need the new layout written in; What's New entry
  (user approves); the User Manual doc still describes the old path.

## Rulebooks: Admin > Shows redesign, planned 2026-10-16 (not started)

A season-owned "rulebook" replaces formats, rulesets and rule changes, edited as six blocks of plain
questions that compile to today's engine data; covers competitions, series, talk shows and live events.
- Design (why, decisions, vocabulary, every editor question): `docs/PLAN-admin-shows-rulebooks.md`
- **Build from:** `docs/PLAN-rulebooks-implementation.md` (core logic → DB → API → every UI screen, 9
  phases with "done when", testing ideas T-10…T-72). Phase 1 is safe to start: no DB or scoring change.
- Clickable mockup: https://claude.ai/artifact/N9fyawYRUfgCJVuUtK9yuE (use its Phone toggle).

## Next up, decided 2026-10-11 (in this order)

1. **Built 2026-10-11, awaiting review/commit.** `docs/PLAN-classic-live-scoring.md`: Classic standings count points as castaways outlast each
   other (a mid-season leaderboard currently ranks a player who lost someone early first).
2. **Built 2026-10-11, awaiting review/commit.** `docs/PLAN-linked-late-join.md`: one "Which episodes have you watched?" answer per linked group,
   and one shared catch-up.
3. **Built 2026-10-11, awaiting review/commit.** `docs/PLAN-practice-round.md`: the guided tour, run on the joined league's own cast and rules.

## Practice round built 2026-10-11 (not committed)

The guided tour's host on a throwaway copy of the league you're in: its cast before episode 1, its
rules and words, two computer players, random results, nothing saved. Offered on "How this league
works"'s last card (a late joiner's, before the start question) and in More, for Active Roster, Classic
and Eliminator Pool. "Back to {league}" restores the real league on the page you left. Files, scripts,
the calls made and what was verified: `docs/PLAN-practice-round.md` -> "As built". End-to-end check:
`node docs/ux-baseline/scripts/practice.js <outDir>`. Waiting on the user: review, commit, and a What's
New entry.

## "How this league works" built 2026-10-11 (committed 1620f13)

A recap-style card sequence shown once after joining a league (and from More), playing a made-up
episode of that league; for late joiners it ends by recommending where to start. Details and the
calls made on the plan's open questions: `docs/PLAN-league-explainer.md` -> "As built". Waiting on the
user: review, commit, and a What's New entry.

## Late joiners ("ghosts") built 2026-10-11

Someone joining an underway league picks an episode to start from, drafts from the cast as it stood
then, and plays one episode at a time ("Have you watched episode N?" before each reveal), or jumps to
the latest. They're invisible to the league until the commissioner adds them (Players & invites →
Late joiners). On by default. Everything (model, spoiler guarantee, UX, limits, what was verified):
`docs/PLAN-late-joiners.md`. Announced in What's New (release 2026-10-11, with Research's tab and the tour).

The guided tour got a welcome card, six "Getting around" cards (one per tab), a plain-words `detail`
under each host line (collapses on first tap), and the league renamed "Bake-Off Champions". Later the
same day: Clive wins Episode 1 and Jo Episode 2 (never both), the computer players leave both to you,
"What does this mean?" works, and the front door fades each show's art in behind the show roll:
`docs/PLAN-guided-tour.md` → "Changed 2026-10-11".

## Guided tour: player path (phase 1) and commissioner path (phase 2) built 2026-10-10

"Take a Tour" on the login screen now plays a 3-minute guided tour on a made-up Active Roster season,
*Rise & Fall* (bakers, two computer players, two scripted episodes), with a host plate and spotlight.
Its end card leads into the **commissioner tour**: create the league (prefilled, nothing saved), copy
the code, start the draft, then check and apply Episode 1's results from research. Details, file maps
and deviations: `docs/PLAN-guided-tour.md` → "Built: phase 1" and "Built: phase 2". End-to-end check
of both tours: `node docs/ux-baseline/scripts/tour.js <outDir> [--light]`. Next: the step log table
and the admin funnel.

Built alongside phase 2 (not yet committed or pushed; What's New entry not written, the user approves
those):
- **Research (Active Roster scouting) redesigned** to the canvas's Scouting board and **moved into the
  tab bar** as a fifth slot (Overview, Episodes, Scoreboard, Draft/Lineup, Research, More). DESIGN.md
  → "Research".
- **The commissioner's results page**, `/episodes/N/research`: the research-apply flow for
  league-decided seasons, out of the episode editor's collapsed panel and onto its own page, with a
  "Results are in" plate on Episodes. DESIGN.md → "Episode results (commissioner)". The public show
  catalog now returns each season's `resultsBy`. The User Manual doc still describes the old panel.

## UX redesign in progress: direction A, "Lower Third" (branch `ux-direction-a`, not pushed)

**Status as of 2026-10-10 (light-mode pass and the declutter pass done; merged to master and pushed 2026-10-10).** A visual redesign is under way on the local branch `ux-direction-a`.
**Do not push or merge it until the redesign is done** (the user's call). Read these first:

- `PRODUCT.md` (repo root): product truth captured with the impeccable skill's `init`. Users,
  positioning ("any show can become a league", free copy/paste research, paid automation later),
  league types, principles. Open decisions recorded there: a shorter home-screen name and pricing. The name
  **Game Your Show** and its logo (direction C, "Insert") were decided 2026-10-12; see Brand Commitments.
- `docs/PLAN-ux-redesign.md`: the mobile-first UX review and plan (problems per screen, wireframes,
  ranked shortlist). The app is **mobile-first** for players and commissioners; admin is
  desktop-first but must work at 390px.
- `docs/ux-baseline/`: the "before" screenshots. `2026-10-09-mobile/` (390px) is the primary set.
- **Mockups:** a private design canvas, https://claude.ai/artifact/DeXL8tptC8crqRx8UtkEa5. Pages
  "A · …" are the chosen direction (Classic, Active Roster, Eliminator Pool, Commissioner, Create a
  league, Draft & mid-season, Spoilers & reveal, Admin). B ("Card Binder") and C were explored and
  **dropped**; B's pages are still there for reference.

**Decisions made:**
- **Direction A, "Lower Third", is the visual system.** The app speaks in broadcast graphics:
  night ground, white caption plates, chyron yellow (#FFC531) for "now", live red for eliminations,
  tribe colours as tags. One family, Archivo (variable; condensed caps for names, headings and
  numbers). Signature element: the caption plate (angled tag + white plate + optional action).
- **Both modes are direction A** (light-mode pass done 2026-10-10). Dark is "Night", light is
  "Studio": the same components on a pale cool-grey ground with night ink. Modes differ only in
  token values; the reveal always plays on Night. See DESIGN.md's Colors section.
- The spoiler mechanic already exists (each player is told results are ready and chooses when to
  reveal); the redesign restyles it, it doesn't add it.
- Show tiles in the create-league wizard use each show's key art with a brand-coloured gradient
  (mocked on the canvas). Rights to network key art are unconfirmed; check before shipping it.

**Built so far (foundation + Active Roster home, dark mode):**
- Tokens and type: `src/app/globals.css` (`:root` = Studio, `.dark` = Night; `--chyron`,
  `--chyron-line`, `--plate`, `--plate-foreground`, `--plate-muted`, `--live`, `--good-foreground`
  and the shadow/scrim tokens in both modes; `type-caption` and `type-num` utilities; the
  `section-title` class; an unlayered mobile
  rule forcing 16px on every text field so iOS doesn't zoom). Archivo replaces IBM Plex Sans in
  `src/app/layout.tsx` (Plex Mono stays as `font-mono`).
- `src/components/ui/caption-plate.tsx`: the signature component. Used by the alert strip
  (`action-bar.tsx`), the reveal prompt and "reveal first" (`results-in-banner.tsx`), and Last Week.
- `src/components/ui/bottom-sheet.tsx`: row actions in a sheet, destructive last in red text. Used
  for player rows in `setup/players-section.tsx`.
- Overview sections flat with condensed caps headings in dark (`dash-card.tsx` and the shared
  classes); Standings rows rebuilt (`standings-card.tsx`).
- Mobile header shows each page's title, league name above it (`mobile-nav/mobile-nav.tsx`).
- Shared Input/Select are 44px tall on phones.
- Customize Overview moved from a league's Overview into Admin as "Overview layouts"
  (`overview/overview-customize-panel.tsx`, `isOverviewSectionForType` in `lib/overview-layout.ts`).

**Next, in order:**
1. ~~`/impeccable document`~~ **Done 2026-10-09:** `DESIGN.md` (repo root) documents direction A
   as built in dark mode, with `.impeccable/design.json` alongside. Update both after the light-mode
   pass.
2. Redesign the remaining screens one at a time against the canvas: ~~Episodes~~, ~~Draft~~,
   ~~League Settings~~, ~~Create a league~~, ~~Overview & Scoreboard (commissioner)~~, ~~Spoilers &
   reveal~~, ~~Active Roster~~, ~~Classic~~, ~~Eliminator Pool~~, ~~Admin~~. All screens done; the light-mode pass is done too.
   - **Episodes done 2026-10-09** (plan 2e): `episodes-tab.tsx` is a status list (one row per
     episode: date + one status; Reveal on the earliest hidden one). Each episode has its own page,
     `src/app/episodes/[number]/page.tsx` -> `episode-detail.tsx`: read view by default (who left as
     live "Out" caption plates, then wins and role/tribe changes, predictions, lineups), and a
     commissioner's ⋯ sheet with "Edit results" (`episode-editor.tsx`: recorded items with Undo,
     full-width forms, research as "Fill gaps with research", renumber) and "Delete episode" last.
     Status logic is `episode-status.ts`. `episode-card.tsx` is gone. The mobile header shows a back
     button and "Episode N" on the sub-page; tab/sidebar highlight Episodes there too.
   - Not yet restyled inside the episode page: the Active Roster lineups section
     (`episode-active-roster-section.tsx`), prediction rows (`episode-bet-row.tsx`, still a ✏️),
     the research panel's insides, and the catch-up panel. Hidden/blocked/upcoming row states were
     built but the local test leagues have no such episodes, so only scored and "waiting" rows were
     seen in a browser.
   - **Draft done 2026-10-09** (plan 2d; canvas page "A · Draft, scouting & mid-season"). One
     layout per phase in `draft/draft-board.tsx`; the turn-based phases are in `snake-draft.tsx`:
     before (order with 44px ↑↓, Start, the cast collapsed), live ("On the clock" plate, snake order
     strip, your roster as photos plus numbered empty slots, tribe filter, 4-up tiles, and
     **select-then-confirm** in a sticky bar above the tab bar; a commissioner picking for someone
     else sees "Draft for Sam"), complete ("Draft complete" plate, Overview/Episodes buttons, teams
     as photo grids). The order panel and Undraft are gone after the start; Undraft lives behind
     ⋯ → Edit picks (commissioner, turn-based only). Blind draft (`blind-draft-panel.tsx`): lock
     strip, tiles, "N of 13 picked" bar with Lock in; the reveal shows your team with how many teams
     share each pick, "Most picked", then the other teams. New board page `/draft/board`
     (`draft-grid.tsx`): rounds × players, upcoming picks as numbered slots. Shared pieces (tile,
     confirm bar, tribe filter, pills) are in `draft/draft-ui.tsx`; `--tabbar-h` in `globals.css`
     is what the sticky bar sits on. The four old panels are deleted. More's "Draft Results" is
     now "Draft".
   - Mid-season restyled with the same pieces: Replenish (plate says whose turn and who they're
     replacing, order pills, 3-up free agents, confirm bar), Swap (1 · Drop photos, 2 · Add tiles,
     bar confirms both; Skip and End swap round below, End asks first), history as hairline rows.
     Finale predictions only got the new section heading.
   - **Pickups and Swap are player-run now** (user decision, 2026-10-09): the commissioner starts
     and ends a round; each player picks up, swaps or skips on their own turn, and the commissioner
     can still act for anyone. Server: `replenish/assign`, `trade/swap` and `trade/skip` take any
     member but refuse anyone but the turn's player or the commissioner (403 "It's not your turn"),
     the same rule as `draft/pick`; `start`/`cancel` stay commissioner-only. The turn push now says
     "Pick up a replacement" / "Make your swap, or skip it" instead of "let your commissioner know".
     Verified end to end with a real player account (`uxplayer`, holding Josie's old seat in
     `UX D Done`): refused off-turn, swapped and picked up on its turn.
   - **Replenish is called "Pickups"** everywhere a person reads it (Mid-Season, League Settings,
     the alert strip, pushes, Overview's status card, scoreboard and stat-card hints, the episode
     editor's warning). Code, routes, settings keys and the database still say `replenish`. The
     User Manual & Product Guide doc still says Replenish and commissioner-run; it isn't
     auto-updated. A What's New entry for both changes is due when the branch merges (the user
     approves those).
   - Also fixed while there: League Settings' Swap hint for non–Active Roster leagues described
     trading with other players; it now says drop one, add a free agent.
   - Known limits: the app doesn't record which round each pick was made in, so the board fills
     each player's column in cast order (right per round by count, not by which pick) and the
     on-the-clock plate can't say "Josie just took Maggie". No drag handle or Randomise on the
     order (only ↑↓; there's no bulk-reorder API), and scheduling stays in League Settings. The
     canvas's Scouting board (Research tab) wasn't in scope.
   - Verified at 390×844 dark with headless scripts (every phase, both draft kinds, Replenish and
     Swap, sheet and Edit picks), plus 1280 dark and 390 light for the live draft. Test leagues
     `UX D Pre`, `UX D Live`, `UX D Blind` (now revealed) and `UX D Done` (Replenish/Swap on, Swap
     round left open) are in the local DB; see `docs/ux-baseline/README.md`.
   - **League Settings done 2026-10-09** (plan 2b, 2c and 1c; canvas page "A · Commissioner":
     Settings-Index, Settings-Players, Rules, Rules-Edit). `/setup` (`setup/setup-tab.tsx`) is now a
     list: the join code as a quiet caption plate with Share (the phone's share sheet, else copy),
     then one row per page showing its current value, then a collapsed Danger zone (Leave league;
     Reset all data for site admins). Each row is its own route under `src/app/setup/`: `players`,
     `league`, `lineups` (Active Roster only), `rules` and `rules/edit`, `pickups` (hidden when the
     type can't have either, e.g. shared ownership), `predictions`, `cast`, `linked` (row only when
     there's something to link or it's linked), `backup`. The mobile header names each and backs up
     to `/setup` (`/setup/rules` for the editor). Shared pieces are `setup/settings-ui.tsx`
     (`SettingsPage`, `IndexRow`, `ToggleRow`, `StepperRow`, `Field`, `LockedValue`, `TextSheet`,
     `MoreButton`, `fieldCls`).
   - Players & invites: invite field, invite rows with a status chip and ⋯ → Revoke (no confirm
     dialog now; the sheet is the deliberate step). Player rows are one line (colour, name, who,
     roster count, ⋯); the sheet has Rename, Colour, Computer player on/off, Skill, Hand over,
     Activate (inactive seats) and Remove last in red. Add player / Add computer open a name sheet;
     the bot description shows there and in Skill, not on every row. Departed players stay listed as
     "Left the league", as before.
   - League setup: full-width fields, label above. Locked values are plain text with a lock and
     one sentence says why; a player sees every value as plain text. Starts-at and Ownership are
     behind "More options" (inline while guiding). Roster size (Classic) moved here from General.
     **Behaviour changes:** Season now locks with Show/type once the league is underway (the plan
     flagged it being editable after the draft), and the draft date input now shows local time (it
     used to show the UTC value as if local).
   - Guided setup is the same gate (`SetupLogic.isComplete`): `/setup` shows only the setup form
     (plus join code and Danger zone) until "Looks good, open League Settings".
   - Scoring & rules (`rules-section.tsx`): one line per event in the show's categories, first two
     open and "Show N more categories"; Active Roster rows show this league's points with a chyron
     dot when changed from recommended. Tapping a row opens a sheet with "Scores when" (the rule
     sentences, via `ruleSentencesFor` in `admin/format-rules-view.tsx`) and, for an Active Roster
     commissioner, a points stepper (decimals allowed) and Done. Classic explains finishing-place
     scoring and lists the events without points under "What the show records"; Eliminator Pool
     has its points-per-pick stepper here. The page's ⋯ has Customise/Edit when events score, Use
     recommended points, and Go back to the show's rules (red). Customise forks and opens
     `/setup/rules/edit`: the existing `LeagueRulesetEditor` with a sticky Save bar above the tab
     bar. Rule changes this season and the "master changed" notice sit on this page too. Admin's
     format rules view (3e) still uses its own `FormatRulesView`; unifying them is still open.
   - Lineups (starters, bench, hide starters), Swaps & pickups (toggles, thresholds, who goes
     first) and Predictions (weekly and finale, with points) are toggle and stepper rows.
     `finale-settings-section.tsx` and `pickem-settings-section.tsx` are gone (merged).
   - Tribes & castaways: tribe rows (swatch, name, count, ⋯ Rename/Colour/Remove), castaway rows
     (photo, name, tribe chip, where they stand, ⋯ Rename/Tribe/Photo/Delete when the cast is
     editable), then Import a cast as a flat disclosure. The season-cast notice is restyled.
   - Not done: the plan's desktop left sub-nav (desktop shows the same pages at 640px with a back
     link), an Undo toast in place of confirm dialogs for small removals (there's no toast yet), and
     the rules editor's insides (`RuleLine` etc.) are unrestyled. The "member joined" push now opens
     `/setup/players`.
   - Verified at 390×844 dark with headless scripts: every page, the player, tribe and castaway
     sheets, the rule sheet and menu, Danger zone, guided setup on a throwaway league (deleted
     after), a save round-trip (a toggle and a stepper, checked against the server, then put back),
     and `uxplayer`'s read-only view in `UX D Done`; plus 1280 dark and 390 light for the index. No
     new test data left behind.
   - **Create a league done 2026-10-09** (plan 2a; canvas page "A · Create a league", Create-1 to
     Create-4). A full-screen flow at `/new-league` (`dashboard/create-league-flow.tsx`, renamed from
     `create-league-wizard.tsx`): no app shell (AuthGate's `FULLSCREEN_ROUTES`), its own header (✕ or
     back, "New league", "N of 4"), a 4-segment chyron progress bar, and a sticky footer button.
     1 · show tiles (key art when an admin set `art_url`, else a plain 64px tile with the name; the
     lead season as a chip) and "My show isn't here" (the existing research flow), then season cards
     (newest 5 plus "Another", which takes a number). A finished season defaults to catch-up results
     and says so in one line, with a toggle either way. 2 · the three type cards (canvas copy, in the
     show's terms). 3 · name, then for draft types "When's the draft?" (Start it myself, the default,
     or Pick a time with date and time inputs) and a summary of the roster shape and draft kind from
     the real defaults. Create league makes the league and sets show, type, catch-up, season, draft
     time and `setupComplete` in that order (catch-up before season, so a catching-up league never
     gets results filed early; type before setupComplete, so Active Roster still defaults to shared).
     A retry after a part-way failure reuses the league. 4 · "{name} is ready", the join code plate
     with Share invite (share sheet, else copy) and Copy, invite by username or email, the players so
     far, Add a computer player (name sheet), and "Go to the draft" (or "Go to your league" for
     Eliminator Pool). The store only switches to the new league on leaving step 4, because switching
     shows the boot overlay and would unmount the flow.
   - **Guided setup is gone:** `setup-tab.tsx` always shows the settings list and
     `league-info-section.tsx` has no guided branches. `SetupLogic` stays in `state-logic.js` (the
     Active Roster shared default still reads `isComplete`); an old league left with
     `setupComplete: false` simply sees the normal settings.
   - **My Leagues** (`dashboard.tsx`) is restyled: invites as rows with Accept/Decline, your leagues
     as rows (tap to open; "Open" chip on the current one), then **New league** (chyron, to
     `/new-league`) and **Join with a code** (reveals the code field). The "Signed in as" line and
     the inline wizard card are gone.
   - **Test shows hidden from non-admins:** `/api/shows` now returns `curated` (no `created_by`) and
     `mine`; the flow offers a non-admin curated shows plus their own researched ones. The catalog
     itself isn't filtered, because members of a league on someone's researched show still need its
     terms. Verified: `uxplayer` sees 4 shows, `uxbaseline` (admin) sees all 6.
   - Not done from plan 2a: the commissioner's Danger zone still offers Leave league (Transfer
     commissioner and Delete league need new API routes). Step 3 shows the lineup or team size as a
     summary only (the canvas's Change button would need the league to exist). No show has key art
     locally, so the art tile was only checked in code, not in a browser.
   - Verified at 390×844 dark with `docs/ux-baseline/scripts/create-flow.js` (outside `run.js`; it
     signs in itself): both paths end to end (Survivor 51 live, Active Roster, scheduled draft, a
     computer player and an invite; Survivor 49 catch-up, Classic, start it myself), the saved
     settings checked in the DB (catch-up league revealed through 0 with nobody out), and Draft and
     League Settings afterwards. Both test leagues were deleted; no test data left behind.
   - **Overview & Scoreboard (commissioner) done 2026-10-09** (plan 2f; canvas "Standings" boards for
     Classic, Active Roster and Eliminator Pool). **Overview:** a **Commissioner** to-do list at the top
     (`overview/commissioner-card.tsx`, logic in `lib/game/commissioner-items.ts`), shown only to the
     commissioner and only when something's waiting: Invite players (fewer than 2), Draft not
     scheduled, "Episode N is next · Reveal" (catch-up), Pickups are due (the same check the start
     button runs, tried on a copy), Swap window is open (Active Roster), and N invites pending (fetched
     from the invites API). Rows link to where it's done; no chyron dots (the alert strip already owns
     the yellow). Read from the trimmed state, so it never hints at unrevealed results. Standings and
     Latest Episode stack below 420px. The catch-up notice is a plain muted line in dark.
   - **Scoreboard** (`scoreboard/scoreboard-tab.tsx`) is a compact list per league type, "After episode
     N" at the top: Classic rows show each team's faces with "IN" or where they finished ("21st" in live
     red) and "2 of 3 standing"; Active Roster is a table of the last three scored episodes plus Total,
     each episode's best score in chyron; Eliminator Pool is Streak / Best / Points, then a **Pick
     history** grid of settled picks only. Ties read "T1"; the leader's rank is chyron in dark only,
     and nobody's when everyone is level. The Sole Survivor footnote is gone (1g). The commissioner's
     "Write episode N lines" moved into the page's ⋯ sheet.
   - **Each player has a page**, `/scoreboard/[player]` (`scoreboard/player-score-page.tsx`, header
     shows their name with a back button): place and total, then Classic's Team (tribe chip and "Still
     in", or Out · episode · finished Nth · +points; "No longer on the team" for swapped or replaced),
     Active Roster's Episodes (each opens to the breakdown) and Roster (bars, legend), or the Pool's
     Picks, then Predictions. The Active Roster pieces moved from `active-roster-leaderboard-row.tsx`
     to `active-roster-detail.tsx`; `leaderboard-row.tsx` and `pickem-leaderboard-row.tsx` are gone.
   - **Privacy fix:** the old Scoreboard's Pool "Pick history" showed everyone's pick for an episode
     that hadn't played yet, which Overview deliberately hides. Now only settled picks show, plus your
     own pending one on your own page.
   - Not done: the canvas's Active Roster "Your season" stat cards (best starter, most benched, ...);
     the Overview's own sections beyond the plan's fixes (Latest Episode, Predictions, Teams, Castaways
     cards are as before); the lines modal (`episode-summary-modal.tsx`) is unrestyled. No league had
     real scores in Active Roster locally, so its best-score marking was only seen at all-zero.
   - Verified at 390×844 dark with `docs/ux-baseline/scripts/overview-scoreboard.js` against `UX Baseline S51`
     (Classic), `UX AR S51`, `UX D Pre`, `UX D Done` (as commissioner and as `uxplayer`), and a
     throwaway Eliminator Pool league on Survivor 49 catch-up (two episodes revealed, picks made,
     deleted after); plus 1280 dark and 390 light. No test data left behind.
   - **Spoilers & reveal done 2026-10-09** (canvas page "A · Spoilers & reveal": Spoiler-Gate,
     Reveal-Moment, CatchUp). The spoiler mechanic itself is unchanged; how it's asked and how it plays
     is new.
   - **One question for every Reveal:** the alert plate ("Episode 3 is in · Hidden until you're
     ready"), an Episodes row, the episode page, "reveal first" and chat all open the same sheet,
     "Reveal Episode 3?" with **Not yet** / **Reveal** (`RevealSheet` and its store in
     `results-in-banner.tsx`, mounted once in AuthGate; `useHiddenResults().reveal(through?)` asks,
     it no longer reveals). An Episodes row asks through its own episode; everything else through the
     latest. `BottomSheet` gained `hideCancel` for sheets with their own button pair.
   - **Overview while results are hidden:** Standings carries an "As of Episode N" pill, and Latest
     Episode becomes a locked "Episode 3" card ("Hidden until you reveal", tap to ask) with grey
     placeholder shapes behind the blur, never real photos or names (the canvas blurred real faces).
   - **The reveal plays** at `/reveal/[through]` (`reveal/reveal-moment.tsx`), full screen (AuthGate's
     `FULLSCREEN_ROUTES` now matches `/reveal/*`, so no alert strip or tab bar can show a result
     early). Tap anywhere for the next beat; Skip goes to the recap. Beats: "Previously on / Survivor /
     Episode 3" (or "Episodes 2–3" when several were waiting), then per episode each challenge's
     winners together as plates (tribe-coloured tag, "Yours: Brady, Danny"), each exit as the
     vote-out card (photo, live tag with the method, name plate), earlier plates staying stacked above
     the current one, then **your result**: Active Roster "Your starters scored +N"; Classic "You
     scored +N" and "2 of 3 still in"; Eliminator Pool "Your pick survived / went home" with your
     streak; plus where it leaves you ("You stay in 1st, 1 ahead of Bot Alpha", ties, "Everyone's
     still level"). A non-player sees who leads. Ends on "See the full recap" (the episode page; a
     white button so the hero number is the screen's one yellow) and "Go to Overview".
   - **Opening the reveal is what marks results seen** (on mount). `through` is clamped to the
     latest episode with results, so a typed /reveal/99 can't mark future episodes seen. Where the
     sequence starts is read once from the viewer's seen mark, before marking.
   - **Catch-up** (`episodes/catch-up-panel.tsx`, still at the top of Episodes; the episode list
     below it is the canvas's list): an info block ("This league plays Survivor 49 from the start" /
     "has played through Episode N"), a quiet plate "Episode N is up next" saying how many have set
     lineups or made picks (else "Predictions go in now"), the commissioner's full-width "Reveal
     Episode N results" and one line of help. The next episode's row says "Up next" instead of
     "Needs results". **Behaviour change:** the commissioner's reveal no longer marks it seen for
     them; when results landed cleanly it goes straight into `/reveal/N`, so the commissioner gets
     the moment too. If the reveal also sorted the tribes or skipped results, the panel stays and
     says so, and the normal reveal prompt offers the results.
   - Not done: the canvas puts Catch-up on its own page under League Settings; it stays on Episodes
     (the commissioner card already links there). No Eliminator Pool league was revealed in the
     browser this time, so the Pool "you" beat was only checked in code. A commissioner who hasn't
     revealed an episode for themselves can still reveal the next one for the league (unchanged).
     Overview's Standings still marks the leader's rank in chyron when everyone is level (Scoreboard
     already handles this; Standings doesn't).
   - Verified at 390×844 dark with `docs/ux-baseline/scripts/reveal-flow.js` (gate, sheet, Not yet,
     every beat, recap, Overview after) on `UX Baseline S51` (Classic, Episodes 1–2 at once, via the
     plate), `UX AR S51` (Active Roster, via an Episodes row) and `UX D Done` as `uxplayer`, by lowering
     `league_memberships.results_seen_through` first (each reveal put it back; all are at their old
     values). `catchup-reveal.js` on a throwaway "UX Create CU" league (Survivor 49 catch-up): Episode 1
     (tribes sorted, so it stayed), then Episode 2 straight into the moment, then Episode 3 with
     Episode 2 still hidden (plays 2–3, two exits); the league was deleted after. Plus 1280 dark and
     390 light. No console errors, no horizontal overflow, no test data left behind.
   - **Active Roster done 2026-10-09** (canvas page "A · Active Roster": AR-Home, AR-Lineup,
     AR-Starters, AR-Scoreboard; AR-Reveal was covered by Episodes and Spoilers).
   - **New Lineup page** at `/lineup` (`lineup/lineup-page.tsx`), with Mine and Everyone views and the
     lock time ("Locks Wed, Oct 14, 8:00 PM EDT · in 5 days", in the viewer's zone).
     - **Mine:** your starters as 3-up cast tiles (tap one to bench it) with dashed "Open slot"s, then
       the bench as rows: photo, tribe, what each scored last episode ("Ep 3: +1.5 on the bench"), and
       Start. Start is chyron while there's room and an outlined "Full" when there isn't. A status line
       says set or "Start N more before it locks". Each change saves as it's made ("Saved.").
     - **Everyone:** one row per player (you first) with a Set / Not set / "2 of 3" chip and their
       starters as 44px faces. Hidden ones are "?" when the commissioner's hide-starters setting is
       on. Points show once the episode has scored. Then **Top starters** of the last scored episode:
       each castaway once, who started them, what they did, and +N in teal.
     - Locked: the tiles and rows are read-only and the line says so. Results hidden: Reveal first,
       in both views. Shared helpers are in `lib/game/lineup-view.ts` (`lineupStatus`, `myLineupDue`,
       `lockLine`, `topStarters`, `signed`).
   - **Navigation:** for Active Roster after the draft, the tab bar's 4th slot is **Lineup** (plan
     1e), with the red "!" while your lineup has a slot to fill. Research moves to More, beside
     Mid-Season. (Since 2026-10-10 Research is its own fifth tab-bar slot instead; see the top.) The desktop sidebar has a Lineup row (Active Roster only) with the same badge. Swipe
     between linked leagues keeps `/lineup` when the other league has lineups. The alert strip's
     lineup item, and so the lineup reminder push, now open `/lineup` (they opened `/#lineup`).
     The Lineup tab is player-facing: put it in the What's New entry due at merge (the user approves
     those).
   - **Overview** (Active Roster):
     - "Set Lineup" is now **Starting this week** (`active-roster-lineup-grid.tsx`, `StartingThisWeek`):
       read-only tiles with Change and Open slot linking to `/lineup`, the bench as small round faces,
       and "Same lineup as last week" when it carried over. Locked, it's "Episode 4 starters · Locked".
     - **Last week** is the caption plate alone, "+6.5 last week", Recap to that episode's page.
     - **Your Team / Your Stats is no longer shown for Active Roster.** Its last-week view is the
       plate, and its season view is your Scoreboard page plus Your season (below).
     - **The Board is just the cast** (`cast-by-tribe.tsx`, `CastBoard`). Everyone's starters moved to
       Lineup → Everyone. `starters-board.tsx` and `castaway-stat-row.tsx` are gone; `Chip` and
       `CastByTribe` live in `cast-by-tribe.tsx`.
     - `overview-layout.ts`: `lastWeek` is eligible for Active Roster again and `yourTeam` isn't. The
       default order puts Starting this week, then Last week, before Standings (the canvas).
       **A saved layout overrides the default**, though. The local DB has one for Active Roster that
       puts Standings and Latest Episode first and Last week near the bottom. Production probably has
       one too. To match the canvas, reorder it in Admin → Overview layouts (the user's call).
   - **Standings** (every type): ranks use the Scoreboard's rules ("T1" for ties, nobody chyron when
     everyone is level; this was a known gap from the Spoilers work). Active Roster rows show each
     player's latest-episode score, muted, beside the total.
   - **Scoreboard:** "Your season" under the Active Roster table (`scoreboard/your-season.tsx`): Best
     starter, Most left on the bench, Most starts ("3 of 3") and Never started, each with a face. A
     card with no answer yet is left out.
   - Not done: the Lineup page doesn't let a commissioner set someone else's lineup (it never did).
     The "Not set" chip and "Nothing set yet" row were only checked in code, because the local
     computer players set their own lineups on every read. The episode page's lineups section
     (`episode-active-roster-section.tsx`) is still unrestyled. League Scoring stays on Overview
     (the canvas drops it for "What each event scores", which the Lineup page now links to).
   - Verified at 390×844 dark with `docs/ux-baseline/scripts/lineup-flow.js` and
     `overview-scoreboard.js` on `UX AR S51`. It was seeded from a snapshot (lineups for Episodes
     1–3, a few Episode 3 results, an open Episode 4) and restored after. Checked:
     - Mine, a bench and a start round trip, each confirmed on the server;
     - the tab badge and alert strip updating as the lineup changed;
     - Everyone and Top starters;
     - Overview, Scoreboard and Your season;
     - results hidden (everything stays at Episode 2) and Episode 4 locked by hand.
     Also checked: 390 light and 1280 dark, and a Classic Overview for regressions (Standings ties
     read "T2"). No console errors and no horizontal overflow. `npm test` 247/247. No test data left
     behind.
   - **Classic done 2026-10-09** (canvas page "A · Classic": Classic-Home, Classic-Episodes,
     Classic-Reveal; its Standings and Draft boards were already covered by the Scoreboard and Draft
     work). Shared helpers are in `lib/game/classic-view.ts` (`teamOrder`, `standingLine`,
     `episodeBanks`, `banksLine`, `predictionsRight`, `bootOrderThrough`), all reading the viewer's
     trimmed state and the scoring's own rules (a prediction pays only when someone else guessed too).
   - **Overview:** Classic Standings rows carry "2 of 3 standing" and the team as 30px faces (out ones
     greyed with their finishing place on a live-red corner), plus one line on boot-order scoring.
     **Your Team** is name plates: photo, then a white plate with the name and tribe ("Still in"), or a
     dark plate with "Out · Episode 1 · finished 21st · +1"; two up from `sm`. **The Board is just the
     cast for Classic too:** every team is in Standings now, so `teams-board.tsx` is gone. **Latest
     Episode** (every type) shows who left as small "Out" caption plates titled "Episode N", with
     "Finished 20th · Sam banks 2" for Classic and a recap link (Active Roster keeps its league table).
     Swapped or replaced castaways no longer show on Overview; they're on the player's Scoreboard page.
   - **A saved layout still overrides the default:** the local DB's Classic layout hides Your Team
     (production probably does too). To match the canvas, unhide it in Admin → Overview layouts (the
     user's call). It was checked by unhiding it locally and putting it back.
   - **Episodes:** a Classic row's detail is who banked points and whether your prediction paid ("You
     bank 1 · your prediction was right, +2"; "Nobody had Ana" when nobody did). Under the list, "19 of
     21 castaways still in the game" (every type).
   - **Episode page** (Classic): the Out plate says where they finished; a small plate per owner who
     scored ("+3" in the player's own colour, `colourTag` in `caption-plate.tsx` picks the ink; "Andrew
     banks 3"); a "Called it" plate when your prediction paid (any type); then **Boot order**: everyone
     out so far with their place, this episode's ringed, and "19 castaways still in, 2 of yours among
     them".
   - Not done: the canvas's **Predict tab** and "guess who goes home". Predictions here are free-text
     side bets graded by the commissioner, not a structured guess, so a Predict tab would be a product
     change, not a restyle; the Predictions section (`side-bets-section.tsx`, `bet-card.tsx`) is still
     unrestyled. The canvas's commissioner card on Episodes ("fill the gap with research") isn't added;
     research stays in the episode editor. No "See standings" button on the episode page. (The light-mode `good` tag ink was fixed in the
     light-mode pass.)
   - Verified at 390×844 dark with `overview-scoreboard.js` on `UX Baseline S51` (Overview, Episodes,
     Episodes 1 and 2, Scoreboard), with a graded two-guess prediction seeded on Episode 2 and Your
     Team unhidden, then the league state and layout restored from a snapshot (checked identical). Also
     `UX D Done` (Pickups: the out castaway banks nobody), `UX AR S51` for the Latest Episode change,
     390 light and 1280 dark. No console errors, no horizontal overflow, `npm test` 247/247.
   - **Eliminator Pool done 2026-10-10** (canvas page "A · Eliminator Pool": Pool-Home, Pool-Pick,
     Pool-Reveal; Pool-Scoreboard was already covered by the Scoreboard work). Shared helpers are in
     `lib/game/pool-view.ts` (`pickWindow`, `myPickDue`, `pickSlots`, `episodePicks`, `nameList`).
   - **New Pick page** at `/pick` (`pick/pick-page.tsx`). It shows when picks close (in the viewer's
     zone; "Open until Episode N is revealed" in a catch-up league, whose episodes have no air time),
     "Who survives Episode N?" with who's used and why, the tribe filter, and everyone still in as 4-up
     cast tiles. Used ones are dimmed with "Used Ep 1" / "Last pick · Ep 2" (CastTile gained a
     `detail` prop). **Select, then confirm** in the sticky bar ("Lock in Rob"; with a pick saved it
     names it and the button reads "Locked in" until another tile is chosen). Closed or results
     hidden: read-only / Reveal first.
   - **Navigation:** the Pool's tab bar fourth slot is **Pick** (it was Chat; chat stays on the header
     icon), with the red "!" while your pick is due. The sidebar has a Pick row (Pool only) with the
     same badge; swipe keeps `/pick` between Pool leagues. The alert strip's pick item, and so the
     pick reminder push, now open `/pick` (they opened `/#pickem-grid`). Player-facing: put it in the
     What's New entry due at merge (the user approves those).
   - **Overview** (`overview/pickem-pick-grid.tsx`, still the `pickGrid` section): the pick grid is
     gone from Overview. In its place: your current streak as a big number with "In a row" and where
     it leaves you ("Tied for 1st with Josie", "Your best is 4", "Everyone's level"); **Your picks**
     (the last few as faces with a survived tick or went-home cross, then this week's pick or a dashed
     "+" slot to /pick; "All picks" goes to your Scoreboard page); **Episode N picks** (Picked / Not
     yet chips; what others picked shows only once it airs, as before). The streak number is bone,
     not chyron, because the alert strip already holds the screen's yellow.
   - **Your Team / Your Pick is no longer shown for Eliminator Pool** (`overview-layout.ts`:
     `yourTeam` is Classic only now; its Admin label is "Your Team (Classic)", and `pickGrid`'s is
     "Your Pick & Streak (Eliminator Pool)"). **The saved Pool layout puts Standings, Season Status and
     Latest Episode before the pick section** in the local DB (production probably too). To match the
     canvas, move it up in Admin → Overview layouts (the user's call).
   - **Episode page** (Pool, scored): your pick as the reveal's vote-out card ("Your pick survived" /
     "went home", the streak it leaves you on or the one it ended), the Out plate for that same person
     left out; then "Everyone else's picks" (face, "Josie picked Patt", "Streak 3" / "Streak ends at
     2", Safe / Out / Missed). An Episodes row says "Your pick, Alex Moore, survived · streak 1".
   - Not done: a commissioner can't make a pick for someone else (they never could). The closed state
     of the Pick page (an aired episode without results) and a missed pick ("No pick", "Missed") were
     only checked in code: catch-up episodes never "air", and the computer player always picks. (The light-mode pick section with no card was fixed by the light-mode pass:
     every section is flat in both modes now.)
   - Verified at 390×844 dark with `docs/ux-baseline/scripts/pool-flow.js` on a throwaway "UX Pool
     CU" league (Survivor 49 catch-up, made with `create-flow.js POOL=1`; deleted after). Checked: the
     Episode 1 pick round trip (server-checked, the tab badge clearing); results hidden (Overview,
     Pick and the episode page leak nothing); the reveal's Pool beat, seen in a browser for the first
     time ("Your pick survived" and, on Episode 2, "went home · You drop to 2nd"); the episode pages,
     Episodes and Overview after both outcomes; used tiles on Episode 3. Plus 1280 dark and 390 light,
     and the tab bar on `UX AR S51` (Lineup) and `UX Baseline S51` (Chat) for regressions. No console
     errors, no horizontal overflow, `npm test` 247/247. No test data left behind.
   - **Admin done 2026-10-10** (plan 3a-3g; canvas page "A · Admin": Admin-Home, NewShow, ShowReview,
     Cast, Episode, Approve). The one long /admin page is now an admin area of separate pages, shared
     pieces in `admin/admin-ui.tsx` (`AdminPage`, `Row`, `ActButton`, `StickyBar`, `Step`, `CopyButton`,
     `Segmented`, `useAdminShows`/`useAdminSeason`) and episode-list logic in `lib/admin-season.ts`.
   - **Its own chrome** (`admin/admin-shell.tsx`, an AuthGate branch for `/admin/*`): on a phone a header
     (Back, "Admin" over the page name, a Paid AI on/off chip linking to Site) and a tab bar To do · Shows ·
     Users · Leagues · Site (chyron dot on To do while anything waits); on desktop an admin sidebar with
     "Back to {league}", plus Formats & rules and Reports. No alert strip, league swipe or install banner
     there. `/admin/layout.tsx` gates every page to super-admins and loads the paid-AI preferences.
   - **Pages:** `/admin` To do (Needs you: results per episode, a backlog season as one row, casts to
     approve, draft formats, open reports, airing seasons with no schedule; only the first button
     chyron; then Coming up). `/admin/shows` (empty and archived shows behind a disclosure),
     `/admin/shows/new` (Research new rules: name, terms, optional wiki/seasons, copy prompt, paste, then
     "Review the format" opens it; or Use a show's rules), `/admin/shows/[id]` (seasons, Add season sheet,
     ⋯ Archive/Delete) and `/settings` (Basics, "Connector and art" disclosure, Danger zone).
     `/admin/seasons/[id]` with tabs Episodes (schedule and auto-research summaries, wiki pull when paid
     AI is on, episode rows with one status and Review), `/cast` (rows with ⋯ Rename/Photo/Tribe/Remove,
     "Add photo" where one's missing, the tribes-hold toggle, change log, sticky Approve; Pull again is
     in ⋯ with its price and a confirm), `/rules` (the existing rule-check component) and `/setup` (name,
     status, wiki, schedule, auto research, who decides, Danger zone). `/episodes/[n]` sources (Wiki,
     Research, Paste research with the two steps; Clear/Discard in ⋯; sticky "Review N") and
     `/episodes/[n]/review` (see DESIGN.md). `/admin/formats` and `/formats/[id]` (built-in read-only via
     `FormatRulesView`, researched via `FormatReviewScreen`). `/admin/users` and `/users/[id]` (Profile,
     Password with a confirm now, Leagues with ⋯ role/unlink, Danger zone), `/admin/leagues` and
     `/leagues/[id]` (players with ⋯ link/unlink/remove, a link sheet), `/admin/site` (the two switches,
     AI models, What's New preview, Overview layouts, restyled flat), `/admin/reports` (`/reports`
     redirects there; the More sheet and sidebar no longer list Reports).
   - **Moved, not lost:** the AI model picker went from the Shows card to Site (`paid-ai-store` holds it
     now, same localStorage key). Cast photos resolve through `castawayPhotoSrc` (relative paths broke on
     the deeper routes). Deleted: `admin-tab`, `shows-section`, `season-cast-review`,
     `season-decisions-review`, `formats-panel`, `user-edit-modal`, `link-membership-form`,
     `reports/reports-tab`, `lib/reports-store`.
   - Not done: the canvas's paste-a-cast flow on the Cast tab (there's no admin route that adds people
     from a pasted cast; the wiki pull stays the source). The insides of the format editor
     (`format-review-screen.tsx`), the built-in rules view and the season rule-check review are the old
     screens in the new frame (their dropdowns are kept from running off a phone). Users and leagues are
     rows at every width, not a desktop table. Delete league still uses the plain confirm, not a typed
     name. No pending-result episode existed for Survivor 51 locally, so Needs a look and Accept all were
     checked on The Traitors (US) 5.
   - Verified with `docs/ux-baseline/scripts/admin-flow.js` (read-only: it blocks any accept, decide,
     pull, research or approve request, and leaves paid AI off) at 390×844 dark on Survivor 51 and The
     Traitors (US) 5, at 1280×900 dark, and 390 light. Every page, the cast row sheet, the paste panel
     (the free prompt fetch only), the review hidden and shown with a result sheet. No console errors,
     no horizontal overflow, `npm test` 247/247. No data was changed.
3. ~~Light mode pass~~ **Done 2026-10-10.** Light mode is direction A's "Studio" palette in
   `src/app/globals.css` (`:root`); the interim cream cards and terracotta are gone. DESIGN.md and
   `.impeccable/design.json` document both modes.
   - **Palette:** Studio Ground #ecebf1 (a step darker than the white plates, so plates still read as
     graphics laid over the picture), Studio Panel #f8f7fb (cards, sheets, fields, header, tab bar,
     sidebar), Raised #e1dfe8, Night Ink #16141d, Muted #5d586b; live #c02a34, good #0b7568 and gold
     #85601a, each with white ink on its fill where it has one; radius 4px like Night. Contrast checked:
     every text colour is 4.5:1 or better on every Studio fill it sits on.
   - **New tokens (both modes):** `--chyron-line` is the chyron as text, an outline, a border or a small
     dot: the yellow on Night, deep amber #845800 on Studio, where yellow can't be read. Every
     `text-primary`, `text-/outline-/border-chyron`, `border-primary`, the "needs you" dots, progress
     segments and the turn pill underline moved to it; `ring` and `accent-foreground` are it too.
     `chyron`/`primary` stay fills with ink (`primary` is the yellow in both modes now).
     `--good-foreground` replaces the hard-coded `#0e2b27` tag ink (9 places), fixing the `good` tag.
     `--plate-shadow`, `--sheet-shadow`, `--bar-shadow` (as `shadow-plate`/`-sheet`/`-bar`), `--scrim`
     and `--focus-halo` replace hard-coded shadows and the terracotta field focus halo (fields also take
     the Field Line border, `border-input`, as DESIGN.md already said).
   - **Same structure in both modes:** every `dark:`-gated box is gone (`DashCard`, League Scoring,
     the catch-up line, the catch-up info block, the locked Latest Episode card), and `section-shell`
     is deleted. This fixed the Pool pick section that had no card in light. `DashCard`'s heading now
     pins `font-extrabold leading-none` (CardTitle's `font-medium` was winning once `type-caption`
     lost its `dark:` variant). The leader's rank is `chyron-line` in both modes (it was dark-only).
   - **Decisions taken in the pass (easy to revert, the user's call):** the reveal (`/reveal/N`)
     **always plays on Night** (its root has `dark`): in light it showed a muddy amber hero number and a
     white button vanishing on the pale ground, and it's the broadcast moment. What's New's header was
     white text on a yellow gradient (broken in dark too); it's a chyron bar with ink now. The "(you)"
     row in Latest Episode's league table used a 5% yellow tint (beige in light); it's the documented
     raised fill now, in both modes.
   - **Logos:** the light `banner.png` and the sidebar logo had an opaque cream background baked in;
     both were keyed to transparent the way the dark pair already was (`sidebar-logo.jpg` is now
     `sidebar-logo.png`). The torch logo and name are still not binding.
   - Not done: the shadcn `Badge`'s own `dark:` variants (unused tints) were left alone; the sidebar's
     footer links are all chyron-line (they were all yellow in dark before; arguably too much yellow,
     not changed). `role-badge.tsx`'s terracotta role tag and `review-bits.tsx`'s gold confidence dot
     are fixed hex colours that read in both modes.
   - Verified at 390×844 **light** with the headless scripts: Classic Overview, Episodes, Episode 2,
     Scoreboard and a player page, League Settings and League setup (field focus), Players, Rules,
     My Leagues, the More sheet, What's New, Active Roster Overview and Lineup, the live Draft, the
     whole admin area (`admin-flow.js THEME=light`, read-only), the create-league flow end to end
     (`create-flow.js` now takes `THEME`; catch-up Classic), an Eliminator Pool league's Overview, Pick
     and Episodes (`POOL=1`), and the spoiler gate, sheet and every reveal beat (`reveal-flow.js`, with
     `results_seen_through` lowered first and put back). Plus 1280 light (Overview, Episodes, League
     setup) and dark at 390 and 1280 for regressions (Overview, League setup, Lineup, Pool, sheet, What's
     New). The two throwaway leagues were deleted (no invites left). `tsc` clean in `src`, eslint clean
     on every changed file, `npm test` 247/247. No paid AI was triggered.
4. ~~Declutter pass (direction A2)~~ **Done 2026-10-10**, built from `docs/PLAN-ux-declutter.md` in its build order,
   one commit per step (`980c9a0`..`f315abe`, plus the docs commit). The header art was mocked first on the canvas
   ("A2 · Header art": Night and Studio, with and without art, four shows) and approved (Mono treatment).
   - **Overview** (`lib/overview-layout.ts`): an opener plus three sections per league type; default order per type
     (`defaultOverviewOrder`); League Scoring, Season Status and Last Week are gone (Last Week is a "You" plate under
     the latest episode); before a draft only **Draft order** (new, `draft-order-card.tsx`) and **The cast** (Scout).
     One link per section on its heading line (`DashAside`); explainers and arrow links gone; empty sections render
     nothing. Eliminator Pool's "Episode N picks" became a Picked / Not yet chip on Standings. "Propose a prediction"
     moved to the upcoming episode's page (`episodes/propose-prediction.tsx`, shown on `currentEpisode` until it has
     results, the same window the old box had). `withNewSections` drops ids that no longer exist.
   - **Status plate** (`lib/game/status-plate.ts`, `overview/status-plate.tsx`, rendered by `action-bar.tsx` on `/`):
     a small quiet-tag plate when the alert strip has nothing for this league. **Judgement call:** when the strip only
     has another league's item, both show (the strip, then this league's plate). The commissioner's blocker comes first
     ("Commish"). Its action is a chevron (the word is for screen readers): action words truncated the title on a phone.
     New `--quiet-tag` tokens: ink with white on Studio. Commissioner to-dos left Overview: chyron dots on the League
     Settings rows, the sidebar's and More sheet's League Settings; pending invites are the Players row's value.
   - **Episodes / Cast:** catch-up is one sentence plus an "Up next" plate with Reveal as a chyron block
     (CaptionPlate's `actionTone`), standing in for that row; "19 of 21 still in the game · The cast" links to the new
     `/cast` page (the tribe-grouped board for every type; `board-grid.tsx` deleted).
   - **Step 4:** Scoreboard's heading "After Episode N" + "How it scores"; the finished Draft lost its Overview/Episodes
     buttons and its ⋯ moved into the mobile header (`lib/header-action-store.ts`, in chat's place); locked lineup with
     no starters says "No starters for Episode N" (Lineup and Overview); the alert strip skips this league's item for
     the page you're on (not `/#section` items).
   - **Sidebar (D1)** and **More sheet (M1)** as the plan says; `useWhatsNewCount` (in `whats-new-modal.tsx`) feeds
     "2 new" in both. **Mobile header:** no logo anywhere; Overview's name left-aligned (SwipeTitle `align="start"`).
   - **Header art:** Overview, mobile only, when the league's show has `shows.art_url` (`.show-art` in `globals.css`,
     tokens `--art-opacity/--art-filter/--art-side`); the header is clear over it until the page scrolls. **No show has
     art set**, locally or (as far as this branch knows) in production, and **rights to network key art are still
     unconfirmed** -- check before setting any. It was checked locally with the canvas's Survivor image as a temporary
     untracked file and DB value, both removed.
   - **Verified** at 390x844 dark, 1280 dark and 390 light with `declutter.js` and the existing scripts on UX Baseline
     S51, UX AR S51, UX D Pre, UX D Done, UX D Live and a throwaway "UX Pool CU" (deleted after, no orphan rows). One
     real catch-up reveal ran on that throwaway league through the new plate (`catchup-reveal.js` now finds the button
     by its label). `tsc` clean, eslint clean on every changed file, `npm test` 254/254. No paid AI was triggered.
   - **Local DB:** the four saved `overview_layout*` rows were deleted (decision 2; a copy of what they held is not kept
     in the repo). **On merge, delete them in production too** (`DELETE FROM app_settings WHERE key LIKE
     'overview_layout%'`) so the per-type defaults apply.
   - **Not done / left as is:** Overview's Predictions are still the old BetCards (only when something's open); the
     Cast page reuses the compact cast board rather than a new design; the sidebar's account menu and the More sheet's
     theme picker use the existing ThemePicker (its chosen segment is a chyron fill). DESIGN.md and
     `.impeccable/design.json` are updated (status plate, show art, the One Link rule, D1, M1, the quiet tag).
5. ~~Merge and push~~ **Done 2026-10-10:** `ux-direction-a` fast-forwarded into `master` and pushed, with What's New
   release `2026-10-10` (the new look, the tap-through reveal, player-run Pickups/Swap). The production
   `overview_layout%` rows (4) are to be deleted by the user once the deploy is live.

6. **Chat and the leftover pieces, done 2026-10-10** (no canvas mock: built straight in code and checked
   against screenshots). DESIGN.md's Chat, Predictions, and Episode lines and lineups sections describe them.
   - **Chat** (`chat/chat-tab.tsx`, `chat-message-row.tsx`): it's flat now. Messages are grouped by author, there's a
     divider between days, and your own messages use the You fill instead of chyron. A message's sheet holds the
     reactions, Copy, Edit and Delete. The spoiler line and the hidden-message placeholder are restyled, the field
     grows as you type, and new messages slide in. The keyboard and tab-bar sizing (`useFitToVisible`) is unchanged.
   - **Predictions** (`predictions/prediction-ui.tsx`, shared by `overview/bet-card.tsx` and
     `episodes/episode-bet-row.tsx`): they're hairline rows now. Grading uses ✓/✕ buttons instead of dropdowns, and
     ✏️ is replaced by a ⋯ sheet. **Behaviour change:** commissioners no longer grade on Overview; the ⋯ there opens
     the episode's page. The episode page only shows "Grade N guesses" once the episode has results. Before that,
     grading is still available from the ⋯ sheet. `PointsPicker` is now 44px buttons, with the chosen value in the
     You fill.
   - **Lineups section** (`episode-active-roster-section.tsx`): flat rows, condensed totals, and Out chips. Lost
     points are muted instead of red.
   - **Episode lines** are their own page now, `/scoreboard/lines` (`scoreboard/episode-lines-page.tsx`), and
     `episode-summary-modal.tsx` is deleted. The mobile header calls it "Episode lines" and its back button goes
     to Scoreboard.
   - Verified with headless scripts at 390×844 in dark and light, plus 1280 dark, on `UX Baseline S51` and
     `UX AR S51`. Covered: chat with grouping, reactions, the sheet, the picker, edit and spoiler states; Overview
     and the episode pages' predictions with grading and the edit sheet; Active Roster lineups with an open line;
     and the lines page. The test data (7 chat messages, three predictions, Episode 2 lineups) was seeded and then
     removed; both league states were restored from snapshots and checksum-matched. `npm test` 254/254, tsc and
     eslint clean. Write actions were blocked in the scripts, so sending, reacting, grading and saving were checked
     in code, not end to end.
   - Not done: the Overview "Your episode N" line card (`your-line-card.tsx`) is still the old italic quote. The
     User Manual still describes the old prediction grading.

**Notes for the next session:**
- The impeccable skill's launcher (`~/.claude/skills/impeccable/scripts/impeccable`) downloads and
  runs a prebuilt binary. This session didn't run it and used the skill's documented fallback
  (reading PRODUCT.md directly). Whether to run it is the user's call.
- The old `pickem-pick-grid.tsx` lint error (`Date.now()` during render) went with the Pool rewrite.
- Test data in the local DB: league `UX AR S51` (Active Roster, used to check the build) and the
  baseline league `UX Baseline S51`, both owned by the throwaway `uxbaseline` account; see
  `docs/ux-baseline/README.md`.
- Verify UI at 390×844 in dark mode first, then light (headless Chromium scripts:
  `docs/ux-baseline/scripts/`, `THEME=light`). Use `chyron-line` for any yellow that isn't a fill
  behind ink; DESIGN.md's Fill Not Line Rule.

**State as of 2026-10-02:** everything below is on `master` and pushed (live). The user tests on
their phone against production and reports back, often with screenshots or screen recordings.

## What's left — read `docs/ROADMAP.md` first

`docs/ROADMAP.md` is the single next-session entry point for remaining work (season-level delta
research, show artwork, the scoring-rules-as-data phases including the flowchart editor). It
supersedes piecing that together from
`docs/PLAN-rollout-order.md` plus the plans it sequences — read it instead of this section once
you're past "what shipped" and into "what's next." The plan docs themselves stay in place (several
are cited by code comments as permanent design rationale, not just task tracking) but
`docs/ROADMAP.md` is now the one place that tracks what's actually left.

## Rollout plan (2026-10-05, now historical — see `docs/ROADMAP.md` for what's left)

`docs/PLAN-rollout-order.md` sequenced three plans (`docs/PLAN-ai-generated-show-formats.md`,
`docs/PLAN-new-user-onboarding-flow.md`, `reports/Mobile React animation library picks.md`) into
stages, with a model recommendation per stage. **Stages 0 through 4 are all done** — Stage 4
(self-serve "+ Add it" show research, owner-scoped) was browser-verified end to end against the
local dev server on 2026-10-06: the tile opens the research flow, "Use for an existing show" is
confirmed absent from that path, approval creates the show and lands the wizard on step 2 with it
selected, the finished league correctly points at the new show, the show is visible to other users
immediately, and cross-user `GET`/`PATCH`/`DELETE` on another user's draft format all correctly
403. Two minor UI issues surfaced during that pass (stale "shows-catalog" cache after creating a
show) were fixed the same session.

- **Stage 0 (Foundation):** `motion` is installed. House convention is `src/components/motion.tsx`
  (exports `m`/`AnimatePresence`/`MotionProvider`) + `src/components/motion-features.ts` (a separate
  module so `LazyMotion`'s dynamic import actually code-splits `domMax` out of the initial bundle —
  importing it directly in `motion.tsx` would defeat the point). `MotionProvider` wraps the whole app
  in `src/app/layout.tsx`. Always `import { m } from "@/components/motion"` for animated elements,
  never `motion` directly (enforced by `LazyMotion strict`).
  `src/lib/game/formats/generic.js` ships as a real fourth format (registered in `formats/index.js`):
  minimal exit methods (Eliminated/Quit/Removed/Winner/Other), challenge-win/safe-at-risk scoring, no
  show-specific wiki vocabulary — usable as a manual-entry fallback with no research pipeline needed.
- **Stage 1 (onboarding phases 1–2):** `src/components/showcase-strip.tsx` (the pre-signup pitch,
  wired into `login-screen.tsx`) and `src/components/dashboard/create-league-wizard.tsx` (replaces
  Dashboard's old single-name-field "Create a League" panel with a 3-step wizard: show → league type
  → name, using `m`/`AnimatePresence` for the step transitions). Both read today's existing
  three-format catalog and `StateLogic.LEAGUE_TYPES` only — no AI-pipeline dependency. The wizard's
  "+ Add it" tile is present but disabled (`title="Coming soon — research your own show's rules"`);
  wiring it to the real research flow is stage 3, once `docs/PLAN-ai-generated-show-formats.md`'s
  phase 3 exists.
- **Stage 2 (formats as data):** every format file now builds a plain-JSON `data` object plus its
  functions, and `defineFormat` (`src/lib/game/formats/define.js`) assembles the same object callers
  always read. The research checklist is data too (`formats/checklist.js`). It was proven
  byte-identical with `tests/harness/format-regression.js`, which is now committed: run it before and
  after any format refactor and diff. Details, verification and what phase 3 inherits are under
  phase 2 in `docs/PLAN-ai-generated-show-formats.md`. No UI or scoring change; nothing for players.
- **Scoring rules as data, phase 1 (done 2026-10-05):** phase 1 of `docs/PLAN-scoring-rules-as-data.md`.
  - Every format's `research.items` and `impliedEvents` are now rules in its data half
    (`rules: { research, implied }`). `src/lib/game/formats/rules.js` is the evaluator, the validation
    (run by `formatProblems`) and a 4-function built-in library for the cross-person cases.
  - 65 of 69 rules are plain data. The four built-ins are Survivor's majority vote, Traitors' vote
    and case-lead outcomes by role, and "fooled to the end".
  - It was proven byte-identical with the harness, which gained fixtures for branches it had never
    reached. The proof was mutation-tested too. The evidence is in the plan.
  - `tests/scoring-rules.test.js` is new (148 tests now). Nothing outside `formats/` changed; no UI,
    database or player-facing change.
- **Stage 3 (done 2026-10-05): read `docs/PLAN-stage-3-format-proposals.md`.**
  - Decided: paste first (paid later), and flagged mechanics don't block approval.
  - Step 1, the pure core, is done: the proposal prompt, parsing, repair, the review model, data-only
    formats (`formats/custom.js`) and `formatFor(id, data)`.
  - Step 2, storage and wiring, is done:
    - migration 0049 `show_formats`, and `db/show-formats.js` as the one server path from a format id
      to rules;
    - leagues cache `settings.showFormatData`, and the settings route refuses requests that try to set
      it;
    - every `formatFor` call site is updated;
    - the admin API is in place: `/api/admin/formats`, `/prompt`, `/[id]` and `/[id]/approve`.
  - **Step 3, the screens, is done and browser-verified by the user end to end** (twice, including
    fixing real problems a chat's draft had). `src/components/admin/formats-panel.tsx`,
    `format-research-panel.tsx`, `format-review-screen.tsx` and `format-rules-view.tsx` (read-only, for
    a built-in viewed from a show's Settings). Mounted next to "+ Add a show" in `shows-section.tsx`;
    each show's Settings also got a "view rules" / "view/edit rules" link.
  - **Real use surfaced work beyond the original plan**, now also done:
    - **Rule editing.** The plan only called for inline label/points/category edits on events, but a
      real draft's problems (a bad built-in param, a type mismatch, two rules awarding one event)
      weren't fixable that way. Each rule row now gets controls scoped to it alone: dropdowns for
      event/exitMethod/question params (with "+ New event…" inline), a condition editor for `when`/
      `whenExit`, a "Built-in" switcher, "remove", and raw JSON as the last resort for what dropdowns
      can't cover. See the plan's step 3 section for the detail.
    - **`votedForLeavers`**, a new built-in in `formats/rules.js` — `votedForLeaver` only reads one
      name; a chat's draft needed to award on *any* of several (an extra-vote mechanic, which recurs
      across shows, Survivor included, not just the one being drafted). Harness-proven byte-identical
      and covered by a new test.
    - Approve/"Use for an existing show" now save the browser's edits before approving (approving
      re-derives from the server, not from in-progress edits — the first version silently approved the
      pre-edit version). Save/Approve both collapse the review screen on success.
    - A built-in's rules are viewable (read-only, `FormatRulesView`) from a show's Settings; a stored
      format's are editable from the exact same screen as "Researched show formats" opens, rather than
      a second, staler, read-only copy.
  - tsc/eslint clean (only the known pre-existing pickem error); `npm test` 158/158; the format
    regression harness byte-identical throughout.
- **Stage 4 (done 2026-10-06):** self-serve "+ Add it" show research, owner-scoped. Any signed-in
  user can research and create a brand-new show (never switch an existing one) via the Create-League
  wizard; new `/api/formats/*` routes are `requireAuth`-gated but ownership-scoped. Browser-verified
  end to end — see the rollout-plan section above for what was checked.
- **Not done yet:** see `docs/ROADMAP.md` — stages 5–6 of the old rollout plan (now folded into that
  doc) plus phases 2–5 of the scoring plan.
  - Decided: admins own each show's master rules, and commissioners can make their own copy for their
    league but never modify a master. Copies stay editable mid-season, with changes logged; a lock may
    come later. Rulesets can be shared with other leagues: backend only for now, no UI.

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

## Traitors scoring (2026-10-02, on `master`)

- **Catalog:** `docs/RESEARCH-traitors-events.md` decided which Traitors events trusted recaps report
  reliably. `src/lib/game/formats/traitors.js` has them: 14 new events in 5 categories (Missions,
  Murder & the Turret, Round Table, Leaving, Endgame). Traitors is read mostly from **recaps** via
  the copy-paste prompt, not the wiki. The checklist asks primitives (`isTraitor`, `votedFor` as a
  list, `accusedBy`) and code derives the Round Table outcomes.
- **Values:** `docs/RESEARCH-traitors-scoring-values.md`, from 20 finished English-language seasons
  of fandom voting grids (scripts in `docs/research-scripts/traitors/`). Applied as the code
  defaults, **on a ×2 scale** (smallest step 0.5). Votes and case leads score by both the voter's
  and the banished person's role. Finale banishments cost less, and a Faithful fooled to the end
  loses points. Exclusive leagues pay less for the win and the Traitor-vote events (owning the
  winner decided 80% of mock leagues, now 70%). Settings inputs now step in 0.25.
- **Next:** add the trusted recap sites (Gold Derby, Today.com, Peacock, A.V. Club) to the show's
  research domains (done as migration 0043). Switch the Traitors show's Rules to "The Traitors" in
  Admin if it's still on Survivor rules (it was locally).

## What shipped on 2026-10-01/02 (~60 commits, `6dfcdb6..HEAD`)

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
| 0043 | Traitors research domains |
| 0044 | Survivor 51 photos: wiki 90x90 icons → self-hosted `photos/s51/*.jpg` (480x600) |
| 0045–0048 | predictions moved T9FUMY → B999RR; linked-league order, favorite and name; What's New seen under impersonation |
| 0049 | `show_formats`: stored formats from research proposals (stage 3). Purely additive |
| 0050 | `shows.created_by` (self-serve show research, stage 4) |
| 0051 | `shows.art_url` (show artwork) |
| 0052 | `league_rulesets`, `leagues.ruleset_id` (scoring rules as data, phase 2) |
| 0053 | `season_rule_changes` (season rule changes, phase 2; `docs/PLAN-season-rule-changes.md`). Purely additive |

The next free number is **0054**. Production applies migrations on deploy (`npm run build` runs
`db/migrate.js`).

## Local dev database: healthy (checked 2026-10-05)

- **Every migration's schema is in place locally**, 0016/0017/0019/0021 included. A script checked every
  `CREATE TABLE`, `ADD COLUMN`, `CREATE INDEX` and constraint in every migration file against the live
  schema; it lives in the session scratchpad and isn't committed. pgvector is installed (0.8.7, see
  project memory). The earlier "recorded but never applied" state was fixed at some point after it
  was written down.
- The user authorized re-running migrations locally. Nothing was force-re-run, because several
  migrations change data (0045 moves predictions between leagues) and running them twice would
  corrupt it. `npm run migrate` applies only what isn't recorded, which was 0049.
- A `pg_dump` of the local DB from before 0049 is in that session's scratchpad.
- **It's local only.** `.env.local` points at the Docker container `survivor-draft-pg` on
  localhost:5432, and nothing here touches production.
- The local DB has copies of the three real leagues (WUYXVU, T9FUMY, B999RR), which is useful for
  regression checks: score them with the old and new code and diff.

## Things the user still needs to do in production

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
- **Before pushing:** run `npx tsc --noEmit -p .`, `npx eslint src`, and `npm test` (148 tests).
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

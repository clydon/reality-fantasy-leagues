# Plan: the desk catches up with classic's admin

Written 2026-10-27. The new design's desk (`/desk`: Inbox · Find · Settings · Library; `src/new/desk/`, `src/lib/server/desk*.ts`)
is ahead of classic's admin in places (disputes and canonical locks, couches nobody runs, rulebooks, TMDB art, undo from
History), but a site admin still has to go back to classic for about 25 things, and the new design has no way into classic's
admin at all (only Settings › Back to the classic design, or typing `/admin`). Nothing in `src/new` calls `/api/admin/*`. This
plan closes that gap, then retires classic's admin.

**Merged 2026-10-29 (`ce42872b`, a fast-forward) and pushed after the Neon rehearsal: steps 1-7 are in production, with
migrations 0420-0430. Step 8, classic's admin retiring, is next.**

**Status (2026-10-29): Step 1 ready to merge at 049c10db: parts 1a, 1b and 1c** (1a: the page frame, Find › Browse and People,
Settings regrouped, the Viewing as bar; 1b: a person's actions, Let in, Act as them, Name and email, Reset password, Stop
them signing in and Let them back in, with migration 0420; 1c: their couches and games, a seat's sheet, Hand on and Delete
<name>'s account, no migration; their As built is under step 1). **Step 2 ready to merge at 28901f65** (the Inbox: Needs you
most urgent first with each item's row to act on, Coming up, Find › Reports and a report's page, the couch nobody runs
handed on through Hand on, Let in told by email; migration 0421; its As built is under step 2); **Step 3 ready to merge at 3df4e790: parts 3a and 3b** (a season's
Setup: Name, Status held over its listing's dates, Who decides results, the season's Delete, migration 0422; its schedule:
When it airs and Episodes previewed then saved, times and a count by hand holding over the listing's, a TV listing found,
linked and unlinked, migration 0423; their As built is under step 3); **Step 4 ready to merge at 2ee06b36: parts 4a, 4b
and 4c** (4a: a season's Research and the bot, Run now queued with what it waits behind and how far it's got, its
schedule drawn as the next episode's night, Runs; migration 0424; 4b: an episode's page, its results from the shared facts
with Accept all, Take it back, the desk's paste as a submission and Clear, no migration; 4c: the Bingo bank, an admin's Show
it again outranking two flags, Paste squares with Undo, migration 0425; their As built is under step 4). **Step 5 ready to merge
at 9f3dc05f: parts 5a and 5b** (5a: a season's Cast, Ask our bot or Paste it, each answer staged; What changed; Send to its
games with Undo; the season page's Cast row and the Inbox's cast item; migration 0426; 5b: starting groups with Not a group,
secret roles together, and Hold until Episode 1 without un-approving; a castaway's page under the cast with Override, Look on
TMDB and TVmaze, Lock and Remove refused while in use, reaching every game; no migration; their As built is under step 5).
**Step 6 ready to merge at 3eda3131: parts 6a, 6b, 6c and 6d** (6a: Find › Games with a join code from three characters in any state, deleted ones with Restore; a game's page with its Join code and its Delete: Archive offered, restorable 30 days, then for good; migration 0427. 6b: a game's Seats, signed in, empty and out; the seat's sheet from both pages with Act as them, Link another account and Take them out; Link an account with Game admin, the seat taking their name and the couch joined; Put back; Remove a seat; the last-Commissioner guard on each; no migration. 6c: Open <game>, as you when you play it, else read-only in the app's show space as its couch sees it at your own mark, a History line, a site admin's read scope over the couch's game reads and every write refused while it's on; no migration. 6d: Find › Couches, searched by name or who runs it, deleted ones with Restore; a couch's Delete, its games going too and its people off it, told once, restorable 30 days from Couches › Deleted, Restore with Undo, every couch read leaving a deleted one out, a trigger refusing a live game on a deleted couch; migration 0428 (Noticed bq and bw closed); their As built is under step 6). **Part 7a done at f5d3a5a7** (a show on the desk: Find › Shows with Archived's Restore, Browse's Shows row and Find's three; a show's page with Add a season, Its words written into its seasons' rulebooks too, Research sites, Archive and Restore, and its Delete, refused while it has games, by season; migration 0429, two plural words and a trigger clearing a stale one; Noticed s, u, v and y closed, ca-ce new; its As built is under step 7). **Part 7b done at c1f0facf** (a show's Art and photos, `/desk/show/<id>/art`: the Header and the Cards in the crops they're used in, each with where it's from, TMDB on its own, Choose one from TMDB or a link, and its framing, dragged and zoomed, tier 1 with Undo; Cast photos by season, Find again, No art or photos; migration 0430, a source and a framing per frame, the framing bound to its image and carried on the image's address to every reader; Up next on the header frame; Noticed x closed, cf-cj new; its As built is under step 7). **Part 7c done at a6bd1443** (the desk's Settings, part one: Which AI our bot asks, ChatGPT or Claude, sent with every ask, tier 1 with Undo; the rulebooks flag, Check every league as a desk job with its progress and tally, Switch on for every season after a check that passed, Switch it off keeping a season on by itself and a couch's own copy, Undo both ways; no migration; Noticed ck-cn new; its As built is under step 7). **Step 7 ready to merge at a6bd1443: parts 7a, 7b and 7c.** What's New as data (decision 8, Noticed z, part 7d) is **postponed** (the user, 2026-10-29: too few players yet to be worth the effort): What's New stays code (`src/lib/whats-new.ts`) and paused, and nothing waits on its drafts editor's mock. Steps 1-7 are merged and in production. **Part 8a done at b4bfb4b6** (classic's admin retires, the pages and routes: /admin sends a site admin to the desk's page for the same thing, a player home; classic's 19 pages, 20 of its components, `admin-store.ts` and every `/api/admin` route gone, the pieces classic's player flows share moved; Test couch's switches on the desk's Act as them, logged; signing out while acting signs you out (Noticed ae and af taken); no migration; its As built is under step 8). Part 8b (the wiki and paid-research jobs, check-bingo-bank onto the desk, HOSTING.md) ends step 8. Before the build: **the design pass was done, and the build planned.** Step 0 is done, and the user approved
steps 1-7's screens (the site mock, `.impeccable/mocks/site/desk*.js` and `.css`, each step's group in Mock scenarios) with two
changes and a standing rule: What's New becomes data, drafted on the desk (decision 8); no wiki, and so no paid Claude research
either (decision 9); classic isn't the spec (decision 10). Each step below has its Changes at approval. One screen is still to
mock: What's New's drafts (decision 8), in the main folder with the user, before part 7c. **The build runs in the desk lane**
(`C:\Users\conor\rfl-desk`, branch `desk`, port 3003), made and checked on 2026-10-28, from the weekly usage reset (Thursday
2026-10-29, 4 PM Eastern): The build lane, below, has its parts, its rules and the switch. Classic's admin renders: all 19 of
its pages at 390px locally (`scripts/dev-test/check-classic-admin.js`, which step 8 can turn round), and in production To do,
Users, Leagues, a league's page, Shows and Site, with no console errors; the desk's Settings has Not on the desk yet › Classic
admin until step 8. Deletes are the user's sore point: a game's delete looked dead on a phone (a finger that rolled cancelled
the hold; fixed in 1e38aeea, with `scripts/dev-test/check-hold-touch.js`), and a season or a show can't be deleted outside
classic. Every delete is easy to find in the design (decision 4).

**Noticed, not fixed (step 0):** after the Classic admin link, classic keeps the new design's `dark` class on `<html>`, so it
shows in its dark theme until a reload whatever its own theme is. It reads fine, and classic's admin goes at step 8; a full
page load (`window.location.assign`) would fix it at the cost of the row being a link.

**Noticed, not fixed (design pass):** the new design's "Viewing as" bar (`src/new/session.tsx`) is white 13px text on #5089c4,
about 3.7:1, under the 4.5:1 floor. The step 1 mock uses #3c6ea6 (about 5:1); step 1's build takes it (taken in part 1a).
From step 3's mock (2026-10-28), all for step 3's build: (a) the daily listings job (`tv-listings.ts statusesByDate`) sets every
season linked to a TV listing to its status by date each morning, so a status an admin changes in classic is undone the next
day; (b) a schedule set by hand doesn't move the episodes a TV listing dated: their `season_episodes` rows (source 'listing',
`air_at`) sit over the weekly guess in `season_air_dates` (0067, 0104), so classic's "Airs at" changes nothing for them; (c)
classic's season route (`/api/admin/seasons/[id]` PATCH) can't set `release` or `drop_at` (nightly, all at once; 0104).
From step 4's mock (2026-10-28): (d) HANDOFF.md says asked results go who went home first in slot `asked-quick`, but
`db/bot-research.js` has only `asked` (`ASKED_SLOT`): the doc or the code is out of step; step 4's build checks it when it
lists asked runs. (e) Classic's Run now says "up to two minutes" while a full run takes about 2½-4 (classic goes at step 8,
so left). (f) `shoot-mock-scenarios.js` claimed a fresh load per scenario, but its hash-only `goto` kept the mock's state from
one scenario to the next; it reloads now (fixed in step 4's design pass).
From step 5's mock (2026-10-28), all for step 5's build unless said: (g) classic's Pull again is additive only
(`wiki-sync.js` upserts on the lowercased name, keeps the old group and photo): it never sees who's gone or changed, and a
new spelling inserts a second person; its confirm says it "replaces what's staged", which it doesn't. (h) Classic's Remove
deletes the `season_cast` row and un-approves the season but never reaches the games (the person stays in every league on a
dead id; `episode_calls` and `couch_polls` keep the id with no foreign key), with no in-use guard. (i) Changing Hold starting
groups un-approves the whole cast, and its hint is out of date (a live league now waits for the episode's results too).
(j) The real desk's season page shows groups with no spoiler guard and no approval state. (k) Nothing detects a cast change
for the Inbox: the mock's item is mock-only, and the nightly wiki read runs only for seasons with paid auto-research on.
(l) The season page's Cast row said "18 castaways"; Survivor 51 has 21 (fixed in the mock).
From step 6's mock (2026-10-28), all for step 6's build unless said: (m) classic's league delete is a hard `DELETE FROM leagues`
(no 30-day restore), and `leagueDeleted` then deletes the couch if it has no games left; the new design's delete is soft
(`end-game.ts`, `deleted_at`). Classic goes at step 8. (n) Classic's Remove player (`/api/admin/leagues/[id]/players/[pid]`)
calls `disablePlayer` without the account id, so the person can never get the seat back by rejoining (`joinLeague` matches
`disabledFromUserId`), and it disables even before a draft, where the app's `takeOut` removes the seat. (o) Linking an account
to a seat keeps the seat's own name (`state.players[].name`), and the tables name seats by it (`membersFor`: "Named as the games
name them"), so kat linked to mo's seat would show as "mo". (p) Classic's unlink (`memberships/[id]` DELETE) has no
last-Commissioner guard: it can leave a game with nobody running it. (q) Classic's link sheet offers Player and Commissioner
only (no Game admin, 0105) and lists every account in one select, with no search. (r) A site admin with no seat can't read a
game in the new design: its reads are membership-scoped (`couchGames`; `membersFor` needs you to run a game there).
From step 7's mock (2026-10-28), all for step 7's build unless said: (s) classic's Add a season inserts `results_by='admin'`
(`api/admin/shows/[id]/seasons/route.ts:53`), defaults its status to Airing, and turns a bad status into Completed on the server.
(t) `db/wiki-sync.js:66` falls back to Survivor's API when a show has no `wiki_api_url`, so a show with a season page but no API
is read through survivor.fandom.com. (u) Classic's show delete counts only leagues whose `settings.showId` is the show, then hard
deletes; the cascade takes `show_follows` (0102), so the people following it lose it with no word, plus chat, watch plans and
community results. (v) An archived show is left out of add-show's name and listing matches (`add-show.ts:110,307`), so adding
it again by name makes a second show. (w) Classic's AI models are per browser (`localStorage rfl.admin.aiModels`); with no
model sent, `wiki-sync.js:69` reads with `WIKI_MODEL` or Opus 5, so a desk pull (step 5) that sends none would read at five
times Haiku's price. (x) Classic's framing (`art_style`: zoom, x, y, colour, strength) crops `art_url`, the poster, while the
desk's Header frame shows `backdrop_url`; pasting a link sets `art_by_hand`, which also stops the finder updating the backdrop
and logo. (y) `episode_term` (0142) has no editor in classic; `castaway_term`/`tribe_term` live on `shows`, while the desk's
rulebook edits its own words (`rulebook.tsx` CastSheet): whether one writes the other wasn't checked. (z) What's New entries are
code (`src/lib/whats-new.ts`), not drafts; the desk's Paused/On and Drafts (approved with step 1) need them as data, and the new
design has no What's New card. (aa) In the mock, step 3's `dsOf` couldn't place Coming up's "Wed" row (The Challenge 41) and
read "Mexico City Grand Prix" as Episode 0, so Formula 1 2026 showed Upcoming (fixed in `desk-setup.js`).
**Settled at approval (2026-10-28):** (t) and (w) close: the desk never reads a wiki (decision 9), and classic's wiki read goes
at step 8. (g) is classic's pull only and goes with it. (k): the Inbox's cast item is a cast answer, our bot's or a paste, with
changes not sent (step 5's Changes at approval). (z): What's New becomes data (decision 8).

**Decisions (the user, 2026-10-27):**
1. **Act as them.** Opening the app as someone is classic's impersonation as it is: for an hour you are them (Better Auth's
   admin plugin, `impersonateUser`), anything you do is done as them, a bar says so, one tap returns you. Two additions: it's
   written in the desk's History (start and end; classic doesn't log it), and the person's page says what it does before it starts.
2. **Every gap, designed now**, in this plan's order, so each step has its screens when it's built.
3. **Phone first, wide later.** Designed at 390px like the rest of the mock; a wide layout (a list beside its detail) is part of
   the app's desktop pass, after the flows settle.

**Decisions (the user, 2026-10-28, for the design pass):**
4. **Delete is always the last thing on a page, named.** Every desk page (a person, a game, a season, a show) ends with a red
   "Delete <the thing>" row and one line of what it does, visible without opening anything; History above it shows its
   latest three. Same place and words on every kind of page.
5. **No Create account on the desk.** People make their own from a couch invite or sign-up; Who gets in lets them in; Reset
   password covers someone who can't get in. (Closes the brief's first open question.)
6. **Stopping someone signing in joins step 1; site roles don't.** From their page, with an optional reason only admins see;
   reversible (Let them back in), so no hold. (Closes the brief's second open question.)
7. **Staged results stay out of the Inbox** (the user, 2026-10-28, as on 2026-10-24): results settle when sources agree and
   only disputes reach the desk; step 4's queue on a season's page is there for anyone who wants to look, with no badge.

**Decisions (the user, 2026-10-28, approving steps 1-7's screens):**
8. **What's New is data, drafted on the desk** ("draft them in the app itself"). Releases and their items move from
   `src/lib/whats-new.ts` into the database: the code's releases as published ones, ids kept (a player's last seen is a release
   id), read by classic's popup as now. The desk writes a draft, previews it as a player sees it, publishes it (tier 1, Undo),
   and Paused holds anything new back. An item Claude proposes with a commit ships as a migration that inserts a **draft**,
   never a published one, and the user publishes it from the desk. The pause on proposals holds until the user lifts it. The
   drafts editor isn't mocked yet: it's mocked in the main folder with the user before part 7c. Players see What's New only in
   classic today; a card in the new design is player-facing, not the desk's (BACKLOG 22). **Postponed (the user, 2026-10-29):**
   "i dont have that many users so why bother putting the effort". What's New stays code and paused; the drafts editor isn't
   mocked or built until the user picks it up again.
9. **No wiki** ("we aren't using wiki at all anymore... all GPT and external APIs"). Casts come from our bot or a paste and
   photos from TMDB and TVmaze; nothing on the desk reads a wiki or picks a model to read one. The nightly wiki job has nothing
   to do (2026-10-28: three seasons, all skipped, since none has paid research on). By decision 10, **paid Claude research**
   stays behind too (Claude's call the same day: the hourly Auto research job researched 0 episodes; our bot researches).
   **Research sites stay**: they're the "Start with these trusted sites" line in the prompt our bot and the copy-and-paste
   brief use (`episode-research.js buildPrompt`).
10. **Classic isn't the spec** ("just because it's in classic doesn't mean it should come over if it's not useful anymore...
   things can improve"). Each build session weighs every classic behaviour it would port: what's outdated stays behind, and
   what can be better is, within the approved screens. Each call is a line in the step's As built (what was left, and why).
   Removing a dead row needs no mock; a new screen or flow does, and its session stops and asks.

**Not brought over:** classic's formats (`show_formats`: rulebooks replace them; retired at cut-over), classic's Overview layouts
(a classic screen), the Site page's Paid AI and spoiler switches (browser-only, and the desk has no paid actions). Neither app
can change someone's site role or ban them; that stays out until it's needed.

## The gaps (from the audit, 2026-10-27)

| Area | Classic has | The desk has | Gap |
|---|---|---|---|
| People | list, search by name or email, sort, paging; create; approve; edit name and email; reset password; their leagues with role change and unlink; delete; impersonate | Find: 6 name matches; a person's page that only looks; Who gets in counts who's waiting and sends you to classic | everything but the look |
| Games and couches | every game by name or join code; join code; delete for good; seats and the account in each (link, role, unlink, remove) | couches through Find; a couch page with its games and who runs them; "Hand it to..." for a game nobody runs | browse, seats, delete for good |
| Reports | the list (issue or idea, who, the screen, the game), delete | players send them (Settings › Report a problem); nothing reads them | all of it |
| Inbox | results to review, casts to approve, formats in draft, reports, airing seasons with no schedule, coming up | disputes, stranded couches, phase starts, show changes, suggested fixes, unchecked player rulebooks, shows added by name, the week's numbers | results, casts, reports, schedules, coming up |
| Seasons | name, status, wiki page; schedule (count, premiere, time, zone); results by admin or league; delete; auto research; bot settings in full and run now (quick, full, schedule, trivia, bingo); episode research (paste, discard, clear); the results queue with accept all; cast (pull, approve, remove, hold groups); bingo bank | status (read-only); bot on/off and runs on/off; a fact's decide, edit, reopen; castaway override and lock; "Not a group" | setup, schedule, research, run now, results queue, cast, bingo |
| Shows | list with dots; add a season with number, status, wiki; archive and restore; delete; terms; format; connector (wiki API, cast heading, research sites); art by URL with framing | New show; "New season N"; archive (shows added by name); terms through the rulebook; TMDB art | delete, restore, connector, season details, art framing |
| Site | AI models for wiki reads and research; What's New preview | confirm_at, tiebreak, new couch fill, Who gets in; the rulebooks flag read-only | AI models, What's New, the rulebooks flag (CLI-only in both) |

## Order of work (each its own session; each step ports its classic routes' logic to `/api/desk/*` and its screens to the desk)

0. **A way to classic meanwhile**: the desk's Settings gets "Classic admin" (one row, to `/admin`) until step 8.
1. **People.** Find's People: everyone, searchable by name, username or email, filtered (Waiting · Site admins · Everyone),
   sorted (newest, last active, name). A person's page: Act as them (decision 1), Approve, Reset password (a temporary one,
   shown once), Edit name and email, Stop them signing in and let them back (decision 6), their couches and games with each
   seat's role (change, unlink), Delete account last (decision 4; what it does to their seats said first; tier 3, hold to
   confirm). No new account (decision 5). Who gets in lets them in from the desk. **Hand on** (from the user's review of the
   mock): when the account's owner is a game's only Commissioner, the delete says so and hands the games on first: one person
   for them all (only someone who plays every one) or game by game, most active first; tier 1 with Undo, the new Commissioner
   told. The same sheet serves a seat ("runs it alone"), step 2's couch nobody runs and step 6's game page.
   **Find › Browse** (the user, 2026-10-28: "something for everything that's searchable"): Find lists every kind it searches,
   each opening a list like People's (search, filters, sort, paging): People here, Reports with step 2, Couches and Games
   (with Deleted: restorable for 30 days, with Restore) with step 6, Shows with step 7, and the Library as it is. Seasons,
   episodes, castaways and results stay inside their show; the search finds them.
   **As built, part 1a (2026-10-28):** the page frame (`src/new/desk/parts.tsx`): `DeskHeader` puts each page on a trail
   (`src/new/desk/trail.ts`, per browser tab) named by what it shows, so Back names where you came from (kat › ZT DK Couch
   says "‹ kat"); the tabs start it, a page already on it cuts back to it, leaving the desk ends it, and a page opened from a
   link falls back to its parent. `LowerThird`, `Facts`, `DeskRow`, `LatestHistory` (three, then All N in a sheet) and
   `DeleteRow` (last, named; built for 1c on, since no page in 1a's scope has a delete yet). Every desk page took the
   frame's Back and History; the person, couch, season, castaway and show pages also took the lower third, facts and Part
   of as links (a season's show and rulebook, a castaway's and a fact's season, a couch's people). **Find › Browse**: People
   (accounts, who's waiting) and Library (starting points, in use, nobody's checked), then Recently opened (per browser),
   then Airing now. **Find's search** shows three people and "All N people matching" into People, searched. **Find › People**
   (`/desk/people`, `src/new/desk/people.tsx`, `src/lib/server/desk-people.ts`, `GET /api/desk/people`): name, username or
   email; Everyone · Waiting (its dot) · Site admins · Can't sign in (while anyone can't); newest, last active, name; 25 at a
   time from the server; the search, filter and sort in the address, so Back from a person returns to the list as it was. **A
   person's page** in the frame: tag (You, Site admin, Waiting, Can't sign in, Player), name and email, joined, active and
   devices signed in, a Waiting or Can't-sign-in panel, their couches with their games and each seat's role, History.
   **Settings regrouped** (People, Results, Our bot, Rulebooks, Changes, Not on the desk yet): each row with its value and a
   dot off recommended (Who gets in: invites; Sources to confirm: 2; Who fills in on new couches: anyone), each sheet with
   Recommended and Reset to recommended, each change a toast with Undo (`PUT /api/desk/settings` answers `changeIds`) and a
   line in Settings history, its own sheet. The **Viewing as bar** is #3c6ea6. Check: `scripts/dev-test/check-desk-people.js`
   (zt_dk_ fixture, up and down, at 390); check-new-desk, -settling and -library updated for the new words.
   **Left behind or changed from classic, and why (decision 10):** classic's Users page read every account (up to 1,000) and
   searched in the browser; People reads a page at a time and searches on the server. Its Create account stays out (decision
   5). Its sort's default was name; People's is newest first, as mocked. A username-only account's stand-in email is never
   shown or searched (classic's search matched it). From the desk itself: Find's Library and New show buttons became Browse's
   Library row (New show was on the Library page too, and stays there); "Airing now" stays on Find until step 7's Shows
   list; the tie-break run's row is "When a result is disputed", and its History lines say so from now on. From the mock:
   "signed in on 2 phones" says devices (a session can be a computer); a waiting row's "no invite" isn't said (in "You let
   each one in" mode, invited people wait too). For later parts: Let in on a waiting row and in Who gets in (1b; the sheet
   links to People › Waiting meanwhile), the person's actions (1b), a seat's sheet and the Delete (1c), Which AI our bot asks
   and What's New (7c).
   **Noticed, not fixed (1a):** (ab) `check-new-desk.js` fails on master as it stands (bf6a9154, without 1a too): the rulebook's
   Fix a mistake saves (200) but the page never reaches version 2, and the check stops there; its "every league renames him"
   is flaky (failed twice, passed once). Run without its rulebook section, everything else passes, Settings included. For a
   main-folder session (the rulebook editor and S1's merge, e8d16445, are master's). (ac) A couch page's Games line names the
   season by its show slug and number ("survivor 51": `deskCouch`), not the season's name; step 6a, where games get pages,
   takes it. (ad) A library rulebook's "Delete it from the library" sits mid-page and is instant, against decision 4 (last,
   named); for whichever step takes the library (7c's Settings link it).
   **As built, part 1b (2026-10-28):** a person's actions (`src/lib/server/desk-person-actions.ts`; `POST /api/desk/people/[id]`
   with `letIn`, `signIn`, `name`/`email` or `password`; `/act`; `DELETE /api/desk/acting`), each a line in their History
   (`admin_changes` entity 'person': **migration 0420** widens its check; it changes an existing table's constraint, so it's
   rehearsed with the step's merge) written in one transaction with the change, and the tier 1 ones with Undo on the toast
   and in History, refused while a later line of its kind stands (stopped, let back, stopped again: only the latest undoes).
   **Let in** on their page (the yellow), on a waiting row in Find › People, and in Settings › Who gets in's Waiting list
   (newest first, 25, then "All N waiting, in People"). **Act as them**: the sheet says what it does first; Better Auth's
   impersonation from the desk, its start a line holding the session and when the hour ends; then the app's front door as them
   (their own design). The Viewing as bar says the minutes left and returns on its own with under a minute to go (once the hour
   has run out nothing can end it); **Return to my account** goes through the desk's route in both designs (classic's bar and
   the test couch's switches too: `api.stopImpersonating`), which writes the end ("Stopped acting as them · 4 minutes") when the
   hour began on the desk and comes back to their page with "Back to your account · it's in kat's History". An hour cut short
   by a stop or a reset ends there ("they were signed out"); one that ended any other way (Settings' Sign out, or it ran out)
   shows "ended, by the end of the hour" at the hour's end. Off on your own page, another site admin's (Better Auth's rule),
   someone waiting or someone stopped, each saying why. **Reset password**: three groups of four (no 0, O, 1, I or L; about 59
   bits), shown once with Copy; hashed by Better Auth's own hasher and written to their credential account (made with Google
   alone: one is added) in the transaction that signs them out everywhere. **Name and email**: the name is the username, by
   the app's sign-up rule (`src/lib/usernames.ts`, now shared with Settings' rename), refused under the field when taken (the
   admin's own too); a new name reaches their seats and messages (`profile.ts renameEverywhere`, shared too); a username-only
   account's email field is empty ("None yet"), never the stand-in; an email the desk sets counts as verified (no link was
   sent to check it). **Stop them signing in** (an optional reason, 200 characters, only admins see) and **Let them back in**:
   Better Auth's ban columns and their sessions deleted, as its banUser does; their page says "Since Oct 28, by you:
   "reason"", worked out from the stop and let-back lines and their Undos (a stop made outside the desk: no date). At sign-in a
   stopped account reads "This account can't sign in right now." (`auth.ts bannedUserMessage`, both designs; Better Auth's
   said "banned ... contact support"). Check: `check-desk-people.js` 162 PASS at 390 (each action through the API, then each
   sheet, the app as kat and back, Who gets in); check-new-settings 111, check-classic-admin all PASS, unit tests 837;
   check-new-desk without its rulebook section passes but for (ab)'s "every league renames him", which failed both runs here
   (desk-cast's Override, which 1b doesn't touch).
   **Left behind or changed from classic, and why (decision 10):** classic's reset password left them signed in and gave 12
   hex characters, and could reset your own (signing you out): the desk signs them out everywhere, gives a password you can
   read out, and sends you to Settings for yours. Classic's name and email went through Better Auth's `adminUpdateUser`, whose
   taken check runs against the admin (classic's PATCH worked round half of it): the desk checks against the person and writes
   the columns, and renames their seats and messages as Settings does (classic didn't). Classic's impersonation wasn't logged,
   ran out silently and returned to the front door; its approve had no Undo; it had no stop. No site roles (decision 6).
   Classic's delete (`users/[userId]` DELETE) and their games (`users/[userId]/leagues`) are 1c's. From the mock: devices, not
   phones; the name rule is the app's 3 to 30, not the mock's 20; the temporary password is groups of letters and numbers, not
   words (more of them to guess); the waiting panel's "or delete the account at the bottom of this page" waits for 1c's Delete;
   Password and Signing in on another site admin's page are rows saying why (the mock has no other admin); the toast back
   from acting is as mocked.
   **Noticed, not fixed (1b):** (ae) the test couch's switches still start an hour through classic's
   `/api/admin/users/[userId]/impersonate` (`api.adminImpersonate`), which isn't logged: step 8 moves them before that route
   goes. (af) Settings' Sign out while viewing as someone signs out the hour as them, not you; your own session waits in Better
   Auth's admin_session cookie, so you have to sign in again; for step 8 or the next session that touches the bar. (ag)
   Letting someone in doesn't tell them (no push or email; classic didn't either): they find out when they next open the app;
   for step 2, beside the Inbox's accounts waiting.
   **As built, part 1c (2026-10-28):** **their couches and games** on their page (`src/new/desk/people.tsx`): each game row
   (its role, a ⋯) opens its **seat's sheet** (`src/new/desk/seats.tsx SeatSheet`, built for step 6b's game page too, which
   adds Act as them, Link another account and Take them out to it): the role (Commissioner, Game admin, Player; tier 1, a toast
   with Undo), the only Commissioner's other roles and Unlink dimmed under "runs it alone. Hand it on first" (a game nobody else
   plays says there's nobody to hand it to); **Unlink** (tier 1, Undo: the seat keeps its team and scores, playing with nobody
   signed in; they stay on the couch, as the app's takeOut leaves them, and the Undo puts back how they were on it; refused for
   the only Commissioner, which closes Noticed p); **Open the game**. A busy person (more than six games) sees a couch with more
   than three folded to two, "N more on <couch>". Games on no couch say what they are (practice games, public pools, games
   from before couches). Server: `src/lib/server/desk-seats.ts`, `POST /api/desk/seats/[leagueId]/[userId]` (`{ role }`,
   `{ unlink: true }`: the seat route step 6b adds Link, Take out and Put back to). Each change is a line in the person's History
   (`admin_changes` entity 'person', its Undo through desk-undo.ts's new 'seat' case) and one in the game's own Recent changes
   (the role as Backstage writes it, `roleChange`; Unlink a 'member' line whose Undo is the desk's), in one transaction; the
   desk's Undo marks the game's line undone too, and is refused once their role has moved on, someone else is in the seat or
   the seat has changed. **Hand on** (`HandOnSheet`; `GET` and `POST /api/desk/hand-on`): games whose only Commissioner is
   going, to whoever plays them and can sign in, most active first; one person for them all (only someone who plays every one;
   the first tagged Most active) or game by game (Different people for different games, One person for all N). Tier 1: every
   game and its lines in one transaction (refused whole when one can't be: they've left it, or run it already); a role line
   in each game's Recent changes, "Handed R1, R2 and R3 on Race Night to dana" in the leaver's History (with the Undo, which is
   refused when it would leave a game with nobody running it) and "Made Commissioner of ..." in each taker's; whoever ran them
   stays one too; each new Commissioner is told, one notice for all their games (`push-events.ts notifyHandedOn`, type
   `invite`: Settings' Invites and join requests; it opens the first game's Backstage). From a seat (its one game) and from the
   Delete (every game they run alone that someone else plays); built for step 2's couch nobody runs and step 6's game page (no
   `from`: the hand-on line goes on the couch's History). **Delete <name>'s account** (`DELETE /api/desk/people/[id]`,
   `desk-person-actions.ts deleteAccount`), the last thing on the page, named (decision 4): off on your own page ("Not from the
   desk: another site admin would have to") and another site admin's. Tier 3 with a hold (`HoldSheet` takes a body and a
   subtitle now): what it does said first, as the mock's list (their seats that stay, marked as left; their seats that go;
   games only they play, which go too; the couches they come off; invites they sent that nobody's used), then, while they run
   games alone that someone else plays, "Nobody else runs ... Hand them on first, or <couch> comes to your Inbox" with Hand
   them on, and once handed, who runs them now; Leave them waiting (someone waiting) or Stop them signing in instead (anyone
   else; nothing instead for someone stopped). It stops them signing in first (signed out, "Being deleted"), lets each seat go
   as the app's takeOut does (`freeSeat`, taken out of `takeOut` in backstage-members.ts and shared: after a draft the seat
   stays in the standings, disabled; before one, or in a game with no draft, it goes), each with a tier 3 line in the game's
   Recent changes and no Undo; deletes the games only they play (their practice games; not a season's public pool), each with
   a line on its couch's History; then the account (the database's cascades take their place on each couch, follows, ratings,
   settings and pending invites; their messages stay under their name), hands a couch they started to whoever's next
   (`ensureOwner`) and removes a couch left with nobody and no games. Stopped partway, it says so ("Delete again finishes
   it"). Then People, with them off the trail and Recently opened (`trail.ts forgetDeskPage`), and "Deleted kat's account".
   The waiting panel's "or delete the account at the bottom of this page" is back. Two guards elsewhere for an account that's
   gone: a deleted game brought back leaves out its membership (`end-game.ts restoreGame` failed on the foreign key) and
   Recent changes' restore of someone taken out says "Their account was deleted" (`league-changes.ts restoreMember`).
   `/code-review` found the delete and the hand-on each committing game by game (a failure partway left games changed with no
   History line or Undo), orphaned games and couches, the list-joining with commas inside, the hand-on sheet losing its picks on
   a refetch and wording that didn't match what happens: all fixed. Check: `check-desk-people.js` 249 PASS at 390 (a seat's
   role and Unlink with their lines, Undos and refusals through the API, Hand on and its Undo and the bell, a Delete; then the
   seat's sheet run alone and not, Unlink and its Undo, pri's folded couch, pri's Delete with Hand them on game by game and the
   hold, and what's left after: R1's seat kept and disabled, R2's and the pools' gone, the practice game gone, Race handed to
   c13); check-new-settings 111, check-classic-admin all PASS, unit tests 837; check-new-desk without its rulebook section
   passes but for (ab)'s "every league renames him".
   **Left behind or changed from classic, and why (decision 10):** classic's delete (`users/[userId]` DELETE) disabled every
   seat in every game (`StateLogic.disablePlayer`) and called Better Auth's `removeUser`: the desk lets each seat go as the
   app's own takeOut does (a seat stays only where the game has drafted, as when someone leaves, so a draft never waits on a
   dead seat), deletes the games nobody else can play, passes on a couch they started, and logs a line in each game; it deletes
   the user row itself, in a transaction (as 1b writes Better Auth's columns), since `removeUser` runs nothing the cascades
   don't. Classic's `users/[userId]/leagues` read is the person's own read now (each seat's role, run alone, others in it,
   drafted). Classic's role change (the memberships POST, an upsert) and unlink (memberships DELETE, then `leftLeague`'s prune)
   wrote no History or Recent changes and had no Undo; its unlink had no last-Commissioner guard (Noticed p) and took them off
   the couch, where the desk's leaves them on it, as the app's takeOut does. Classic's link (the upsert with a player) is
   step 6b's. **Open the game** opens the game's couch page ("On <couch>'s page: who plays it and who runs it") until step 6a
   gives games a page of their own; 6a points it there with the mock's line. From the mock: the Delete row's line says what
   happens as it is ("1 seat stays, 7 go"; the mock always said "their seats stay, marked as left"); the sheet has the lines the
   mock didn't need (seats that go, games only they play, invites nobody's used); a game nobody else plays has nobody to hand
   it to, said on its seat's sheet.
   **Noticed, not fixed (1c):** (ah) a deleted game (restorable for 30 days) keeps its people's memberships in its Undo, not the
   table, so deleting an account doesn't let that seat go: brought back, the game has their seat playing with nobody signed in
   (an empty seat: step 6b's Link an account or Remove the seat) and maybe nobody running it (the Inbox's couch nobody runs);
   for step 6a or 6b. (ai) The couch page's "Hand it to ..." (`desk-couches.ts handCouchGame`) is the old way: no Undo, no
   notice, a line on the couch only; step 2's couch nobody runs moves it onto `HandOnSheet` (no `from`) and handCouchGame goes.
   (aj) Deleting an account ends a watch together they started for everyone in it (`watch_sessions.started_by` cascades); short
   lived, so the sheet doesn't say it. (ak) Four small `tx` helpers (desk-person-actions, desk-seats, couches, roles) do one
   thing; one in db.ts some day, for whoever next touches it.

**The desk's pages and how they link** (mocked 2026-10-28 at the user's ask, `desk-pages.js`; each step builds its own page's
actions, but the shape and links are set here). Every page: a lower third naming it, a facts line, **Part of** (what it
belongs to) and what it's made of, each a link; its actions; History (latest three); its Delete, last and named. Back names
the page you came from (a trail, as the app's nav-trail does); the tabs start a trail.

| Page | Part of / made of (links) | Its Delete | Built in |
|---|---|---|---|
| Person | their couches › games (a seat's sheet: role, unlink, Open the game); reports they sent | tier 3; hand on games they run alone first | 1 |
| Couch | its people; its games; who fills in results (Override); Hand them on when nobody runs it | its games go too; restorable 30 days (Couches › Deleted) | 6 |
| Game | its couch, season and rulebook; join code; seats (each a person); Open it read-only; Hand it on | Archive offered; restorable 30 days (Games › Deleted, Restore); then "for good, now" | 6 |
| Show | its seasons; Add a season; connector, art and photos, its words | refused while games play it, listing them | 7 |
| Season | its show and rulebook; Setup (3), Research and the bot (4), Cast (5), Bingo bank (4); episodes; its games | refused while games play it, listing them | 3-5 |
| Report | the sender, the couch or game or season it came from; Mark done; Act as them | gone for good; Mark done offered | 2 |

**A couch's delete is new** (neither app has one; added for decision 4, approved with step 1's screens on 2026-10-28).

**Settings, regrouped** (the user, 2026-10-28: "hard to figure out where everything is"): by the question you have, each row
with its value and a dot when it's off its recommended setting (its sheet has Reset to recommended), each change a toast with
Undo and a line in Settings history. **People** (Who gets in, with who's waiting) · **Results** (sources to confirm a result,
when a result is disputed, who fills in results on new couches; "who went home is always checked for free" is said, not a
row) · **Our bot** (Autopilot: the seasons it's on for, each a link; which AI it asks, step 7) · **Rulebooks** (games on
their season's rulebook, each a link; the library) · **Telling players** (What's New: paused, drafts, step 7's preview) ·
**Changes** (Settings history, its own sheet, not a long inline list) · **Not on the desk yet** (Classic admin).
2. **Inbox catches up.** Reports (read, mark done, open the game or screen it came from), accounts waiting, casts pulled and
   not approved, airing seasons with no schedule, and Coming up (the next episode of each airing season, and whether research
   will run on its own). Not staged results (decision 7). As mocked: Needs you is one list, most urgent first (a dispute, a
   couch nobody runs, no schedule, a cast changed, accounts waiting, reports, a rulebook nobody else checked, a show added by
   name), each tagged with its kind and opening the page that deals with it, where the row to act on carries a dot; dealing
   with it there clears it here and from the tab's count. Coming up is the week as a rundown (day and time, the season, the
   episode, and how its results come in: Autopilot, ESPN, or the couches).
   **Changes at approval (2026-10-28):** the cast item is a cast answer (our bot's or a paste) with changes not sent, not a
   wiki pull (decision 9).
   **As built, part 2 (2026-10-28):** **the Inbox** (`src/lib/server/desk-inbox.ts`, moved out of `desk.ts`; `src/new/desk/
   desk.tsx`): Needs you is one list, most urgent first: disputes (split, stale), a phase start to confirm and something new
   the couches split on (the yellow tags), then a couch nobody runs ("Nobody runs Wednesday Watchers' games", or the games
   by name when only some), an airing season with no schedule, a cast not sent (a season's cast with no approval, on a show
   that's a game), accounts waiting (one item, the first three faces, "signed up without an invite" or, in You let each one
   in, "waiting for you to let them in"), each open report (its first sentence, from whom, what it's about, how long ago), a
   suggested rulebook fix (tagged Fix now: Report is the reports'), a rulebook nobody else checked ("Formula 1 2026's rulebook
   needs a second look", quiet now) and a show added by name ("... was added by name"), each with its kind's tag in a column
   of its own and opening the page that deals with it, where the row to act on carries a dot: the couch's Hand it on, the
   season's **Running it › Setup** or **Cast** (`DeskRow dot="need"`), People › Waiting, the report. The tab's count is what
   Needs you lists, and dealing with one clears it there and here (every desk write refreshes the desk's reads). **Coming up**:
   each game season's next episode in the next seven days (shows set up as games, not archived, airing or upcoming), soonest
   first, five then All N this week: the day and time in the phone's own time (Tonight, Today, else the weekday), the season,
   the episode (a sport's event name), and how its results come in: Autopilot (the season's bot: "who went home, then full
   results", or "the schedule check after it"), ESPN (a season linked in `sports_links`), a talk show's "Couches tick what
   happened", else "Couches fill in results · no bot"; under it, the airing seasons with no schedule. **Reports**: migration
   **0421** (`issue_reports.done_at`, `done_by`, `sent_from`; `admin_changes` entity 'report'; it changes an existing table's
   constraint, so it's rehearsed with the step's merge, as 0420). Find › Browse's Reports row ("N open · N done"), Find's search
   (three, then All N reports matching), **Find › Reports** (`/desk/reports`, `src/new/desk/reports.tsx`, `GET /api/desk/reports`:
   Open · Done, what it says or who sent it, newest first, 25 at a time, the search and filter in the address) and **a report's
   page** (`/desk/report/<id>`, `GET`, `POST { done }` and `DELETE /api/desk/reports/[id]`, `src/lib/server/desk-reports.ts`):
   the sender's face and Open or Done in the lower third ("A problem" or "An idea", from whom, when), their words whole, where
   it was sent from ("Sent from Settings on an iPhone · the installed app · the new design": Report a problem now records the
   device from the user agent and whether the app runs installed; an older one says its screen and design), **Mark done** or
   Reopen (tier 1, a toast with Undo, History lines, refused once a later change stands), **Act as <sender>** (their page with
   Act as open, `?act=1`; off with why for a deleted account, you, another site admin, someone waiting or stopped), From (the
   sender, then the game it was sent from, on its couch's page until 6a, else the season of the show screen it came from, else
   their couch), History (Sent by, then the desk's lines) and **Delete this report**, last (tier 3, a hold: gone for good, the
   sender isn't told, Mark it done instead offered while it's open; a line kept in `admin_changes`). A person's page has
   **Reports they sent**. **The couch nobody runs** hands its games on through `HandOnSheet` with no `from`, as mocked: the
   couch page's panel ("Nobody runs its games ... Hand them on"); its Undo puts them back with nobody running them, in the
   Inbox again (each move records `nobodyRan`; `setLeagueRole` takes `{ nobodyRuns }` for it). `desk-couches.ts handCouchGame`
   and the couch route's `hand` are gone (Noticed ai closed). The couch page and the Inbox leave deleted games out (a deleted
   game's seats looked stranded). **Noticed ag**: Let in now tells them by email to a real address ("You're in", through
   `auth.ts sendAuthEmail`, now exported: Resend in production, the server's console locally), sent once they're in; the
   toast and their History line say whether it went ("Let in, and told by email", "the email to tell them didn't send", "no
   email to tell them by"). Shared helpers: `db.ts tx` and `likeOf` (the desk's copies use them: Noticed ak, but for
   couches.ts and couch-joins.ts), `schedule.ts hasSchedule`. `/code-review` found a route's season cast to a uuid that a
   mistyped address could break every read with, casts on shows that aren't games, Let in saying "told" before the email
   went, Undo's done_by on a deleted account, AM/PM split on a space, and duplicated helpers: all fixed. Check:
   `scripts/dev-test/check-desk-inbox.js` 105 PASS at 390 (zt_di_ fixture, up and down); check-desk-people 249 (Let in's
   words), check-classic-admin all PASS, check-new-settings 111, check-new-library 91 (the Inbox's new words), unit tests 837;
   check-new-desk without its rulebook section (a scratch copy, deleted) passes but for (ab)'s "every league renames him", its
   couch section now handing on through the sheet.
   **Left behind or changed from classic, and why (decision 10):** classic's To do listed results to review (staged results
   stay out: decision 7), formats in draft (rulebooks replace formats; a rulebook nobody checked is the Inbox's), reports as one
   row (each is its own item now, as mocked), casts pulled and not approved (kept, on shows that are games) and airing seasons
   with no schedule (kept); its Coming up said "research N h later, paid" (paid research stays behind: decision 9; Autopilot,
   ESPN or the couches instead). Classic's Reports deleted a report once it was dealt with, and showed its route raw; the desk
   keeps it as Done and names the screen. Classic's admin pages for a season's setup and cast stay where the desk sends you
   for now: the Running it rows link to them until steps 3 and 5 build Setup and Cast. From the mock: the cast item says
   "isn't in its games" ("changed on the wiki" is gone with the wiki, and nothing compares a cast answer yet: step 5a); the
   couch's "deleted their account" is "has gone" (it may have been a leave); older reports don't know their device; the
   suggested fix's tag is Fix.
   **Noticed, not fixed (part 2):** (al) a season whose results the admin decides (`results_by` 'admin') still says "Couches
   fill in results" in Coming up: step 3a's Who decides results should feed its line. (am) Each Inbox kind lists at most 20
   (as before), so the tab's count stops there for a kind; Reports › Open has every one. (an) Undo of Let in after the email
   went leaves them told they're in and back on the list; rare, and the toast's Undo is the only way to it that fast. (ao)
   Classic's Reports page still deletes "dealt with" reports until step 8, so one deleted there never reaches Done. (ap)
   Classic's Report an issue doesn't send whether the app is installed (only the new design's does); its reports say the
   device only.
3. **Seasons: setup.** A season page's Setup: name, status, wiki page, the schedule (episode count, premiere, air time, zone),
   who decides results (the admin, or each game), delete (tier 3).
   **As mocked (2026-10-28, `desk-setup.js`, waiting for approval):** Running it › Setup opens a page of its own
   (`/desk/.../setup`; the season page's Setup row now says "Wednesdays 8:05 PM Eastern · 13 episodes · results from sources").
   Its lower third is the season as set (status tag, name, the next episode). **The season**: Name (blank shows the show and
   its number), Status (Upcoming · Airing · Ended, each saying what it does), Wiki page (what the connector reads; optional for a
   show with no connector; a bad URL is refused with an example). **Schedule** (the aside says "Set by hand, by alex" or "From
   its TV listing"): the next two episodes and the finale as a rundown like the Inbox's Coming up, All N episodes (a sheet of
   dates and times), When it airs, Episodes, TV listing. **Results**: Who decides results. Then History (latest three, All N)
   and the season's Delete, the same row and sheet as the season page's (`dkSeasonDel`: refused while games play it, else a
   hold). Guards: name, status, wiki page, the listing and who decides are tier 1 (a toast with Undo, a History line); **When it
   airs** and **Episodes** are tier 2: Weekly · Nightly · All at once, the first episode (or the drop), the time and zone, with
   "What moves" (each episode's old and new time; lineups and picks in its games lock at the new times; reminders, the guide
   and Coming up move; the bot's check runs after each new end) and a warning when aired episodes would land in the future;
   lowering the count lists what's cleared (classic's prune) and turns the button red ("Clear and save") when aired episodes'
   research goes, with a check when it's fewer than have aired; Not known yet is a choice. **TV listing**: linked (its times,
   its dates moving the status, Find another listing, Unlink it: the times stay) or searched (TVmaze, as Add a show searches;
   other seasons' and ended look-alikes greyed; "What it fills"; Use this listing). A season with **no schedule** leads with
   "Find it in the TV listings" (the yellow) and "Set it by hand"; the Inbox's no-schedule item now opens Setup, and a season
   given a schedule leaves the Inbox and joins Coming up. **Who decides results**: "Sources that agree" (Recommended;
   `results_by = 'leagues'`: couches' and the bot's answers, two agreeing reach every game) or "You decide" (`'admin'`: what
   you accept on the desk reaches every game even with no other source, from the switch on, `results_admin_since`); either
   way a dispute you settle reaches every game (the words follow `season-decisions.ts`; the build confirms them).
   **What the build needs beyond classic** (Noticed, not fixed, a-c): a status set by hand on a linked season holds over the
   listing's dates until "Back to its listing's dates" (statusesByDate skips it: a column, so a migration); times set by hand
   win over the listing's per-episode times; the route takes `release` and `drop_at`; linking and unlinking a season's listing
   (`listing_id`) from the desk. Mock scenarios: Setup (Survivor 51), Change when it airs (to 9:00 PM), Fewer episodes (to 4),
   Who decides results, No schedule (Dancing with the Stars 34, from the Inbox), Find it in the TV listings, Nightly from its
   listing (Love Island USA 7), An ended season (Survivor 49, deletable). `scripts/dev-test/shoot-mock-scenarios.js
   --group=dss` shoots them all at 390.
   **Changes at approval (2026-10-28):** no Wiki page row (decision 9): The season is Name and Status.
   **As built, part 3a (2026-10-29):** **a season's Setup** (`/desk/season/<id>/setup`: `routes.ts deskSeasonPage`, a page
   under a season, depth 3, up to the season; `src/new/desk/setup.tsx`, `src/lib/server/desk-setup.ts`, `GET` and `POST
   /api/desk/seasons/[id]/setup`): the lower third (Airing, Upcoming or Ended, or No schedule; the name; its next episode,
   "Episode 3 · tomorrow, 8:05 PM", or how it ended), its facts ("2 games on it · 2 of 6 aired"), then **The season**: Name
   (blank, or the show and its number, shows the show and its number; 60 at most) and Status (Upcoming · Airing · Ended,
   each saying what it does); **Schedule** as it reads now (its aside From its TV listing or Set by hand; the next two
   episodes and the finale as a rundown with the gap between, All N episodes in a sheet, When it airs, Episodes and TV
   listing with their values as mocked), **Results** (Who decides results), History (latest three, All N) and the
   season's Delete. Dates and times are in the season's own zone, as its schedule is set. Name, Status and Who decides are
   tier 1: a toast with Undo and a line in the season's History (`logDesk` entity 'season', Undo through desk-undo.ts's
   'seasonSetup', refused once that field has moved on since). **Status holds** (Noticed a): **migration 0422**
   (`show_seasons.status_held_at`, additive) set when a status is chosen on a season linked to its listing, even the one it
   has; the daily job's `statusesByDate` (exported, for the check) and a listing read (`add-show.ts listedSeason`) leave a
   held status; the row says "set by hand, held over its listing", and the sheet offers **Back to its listing's dates**
   ("They'd make it Airing", by listing.ts `seasonStatus`, the job's rule), which sets it to what they say. Classic's
   status PATCH holds the same way, so the two agree until step 8. **Who decides results**: Sources that agree
   (Recommended, `results_by` 'leagues') or You decide ('admin', `results_admin_since` from the switch, kept when it's
   chosen again, as classic's route); the words confirmed against `season-decisions.ts`, with one the mock didn't have:
   going back to sources takes out of its games what only the desk accepted since the switch (`onlyYours`, said in the
   sheet and the History line), so its games are synced at once (`syncSeasonLeagues`), and its Undo syncs them back.
   **Coming up** (Noticed al): a season you decide says "You decide results · couches' answers count too" (`how`
   'admin'), or adds "· you decide too" to an Autopilot or ESPN line. **The season's Delete** (`SeasonDeleteRow`, the
   same on the season page, last, and on Setup; `DELETE /api/desk/seasons/[id]`): refused while games play it ("Not
   while 2 games play it"; a sheet listing them, ended ones marked, each to its couch until 6a gives games pages), else a
   hold: its episodes, cast and results go; its public pool (and the people playing it) and practice games go with it;
   the people following it lose it; the show and its other seasons are untouched. It takes what's kept by its show and
   number too (research, its search index, old wiki reads), as classic's did, and leaves a line on the show's History
   ("Deleted Survivor 49, with its public pool"). The **season page**: Running it › Setup always, with the mocked line
   ("Thursdays 8:05 PM Eastern · 6 episodes · results from sources", the dot when it's airing with no schedule), its
   lower third and facts from Setup, and the Delete last. The Inbox's no-schedule item opens Setup. `ChoiceCard` and
   `Field` moved to parts.tsx. `/code-review` found pools blocking a delete forever, classic's status not holding, the
   drop's rundown reading episode 1's time (a crash with no date), the season read doing Setup's work twice, two copies of
   the status rule and the zone names, and no way to hold the status it has: all fixed. Check:
   `scripts/dev-test/check-desk-setup.js` 90 PASS at 390 (zt_ds_ fixture, up and down; the listings job's status step run
   on a held season); check-desk-inbox 106 (its no-schedule item opens Setup now), check-desk-people 249, check-classic-admin
   all PASS, unit tests 837, check-new-settings 111 (run alone: twice in a batch after other checks its Rose colour
   didn't save in time, and on part 2's code too it passed alone); check-new-desk without its rulebook section (a scratch
   copy, deleted) passed whole once, and once failed only (ab)'s "every league renames him".
   **Left behind or changed from classic, and why (decision 10):** classic's season PATCH also set the season's number
   (not mocked; renumbering strands its games' `settings.wikiSeason`, and step 7a's Add a season checks a number before
   it's made), its cast size (the cast is its own, step 5), its wiki page (decision 9) and paid research's fields
   (decision 9); the bot's schedule and an episode's length are step 4a's (desk-bot.ts has the schedule), the schedule's
   fields 3b's. Classic's delete only warned about leagues on the season and deleted it anyway; the desk refuses while a
   couch's game plays it (deleted ones aside, as mocked) and takes the season's own pool and practice games with it. Classic
   switched who decides with no word about what leaves the games, and never synced them. From the mock: History lines
   don't say "by you" (History names who); the schedule's rows and the no-schedule panel's one button ("Set it in classic
   admin") open classic admin's Setup until 3b, with a line saying so; the follower line was added to the hold (as step
   7's show delete says it).
   **Noticed, not fixed (3a):** (aq) a couch's deleted game doesn't hold its season, as mocked: brought back after the
   season is deleted, it plays on no season (`end-game.ts restoreGame` doesn't check); for 6a, whose Restore it is. (ar)
   The daily job's `keepSeasons` skips an Ended season with no finale (or an old one), so holding Ended on a linked
   season also stops its listing's times updating; right for a season that's over, but Setup's TV listing row doesn't say
   so: for 3b, which owns that row. (as) `desk-cast.ts leaguesOn` (a season's `leagues` and `couches`, and Not a group's
   reach) counts deleted games and leaves out pools; the season page no longer shows it (its facts are Setup's), but Not
   a group still reaches deleted games: for 5b. (at) Setup's zone names come from classic's `admin-season.ts
   TIME_ZONES`: step 8 keeps it (or moves it) when classic's files go.
   **As built, part 3b (2026-10-29):** **Setup's schedule** (`src/lib/server/desk-schedule.ts`, `src/new/desk/setup-schedule.tsx`;
   `POST /api/desk/seasons/[id]/setup` takes `{ when }`, `{ episodes }`, each with `preview: true`, `{ listing }` and `{ unlink }`;
   `GET /api/desk/seasons/[id]/listings?q=`). The Schedule's rows and the no-schedule panel open their sheets as mocked: **When
   it airs** (or **Set it by hand** with no schedule): Weekly · Nightly · All at once, the first episode or the drop, the time,
   the zone; a summary line; What moves (each episode's old and new time, the first three and "and N more") or What it sets
   (the next episode); lineups and picks in its games lock at the new times, reminders and Coming up move, the bot's check
   when its bot is on, "From now on your times win over its TV listing's" when they didn't; the warning when aired episodes
   would land in the future. The server previews it (the clock lineups lock by, `air-schedule.js episodeAirTime`, on the
   dates the view would read), so the sheet and the save agree. **Episodes**: the stepper and Not known yet, the finale's day,
   What's cleared (classic's prune), the red "Clear and save" when aired episodes' research goes, Fewer than have aired, what's
   added. **TV listing**: linked (its times and dates, "Yours win" or "Yours holds" when they do, Find another listing, Unlink
   it: its times stay, "Kept from its old listing") or **Find it in the TV listings** (TVmaze through `listingsFor`, the show's
   season with this season's number and what it fills; an ended look-alike, another show's listing once the show has its own,
   a season another season has, and its own greyed, a tap saying why; nothing found offers Set it by hand). **Use this listing**
   takes the listing's times, dates, count and every episode's start (`add-show.ts listedSeason`, as the daily job reads it),
   gives a show with no listing this one, and lets go of what was held (times, count, status: Noticed a's "or says it holds"
   settled as clearing it, as the mock's What it fills says). **Times by hand win (Noticed b): migration 0423**
   (`show_seasons.times_held_at`, `count_held_at`, additive; `season_air_dates` recreated with its columns as they were): once
   When it airs is saved, the season's listing rows stop counting in the view (research's exact starts still do, as the
   mock's every-episode note says), and a listing read leaves its premiere, finale, release, drop and air time; a count set on
   the desk holds the same way. `release` and `drop_at` are set from the desk (Noticed c). Each change is a History line
   (`logDesk` entity 'season', actions when, count, listing, unlink) with Undo through desk-undo.ts's new 'seasonSchedule':
   refused once it has moved on since; a link's Undo puts the season, its times and its listing rows back from a snapshot,
   refused if its old listing has been taken since. The Schedule's aside says "Set by hand, by <who>" from the latest standing
   When it airs line; the bot's clock is nudged after each. **Noticed ar** taken: a linked season held Ended while its dates say
   it's on reads "not read again while it's held Ended" on its TV listing row and sheet. Setup and the season page have no
   link left to classic's season setup; Settings' Classic admin line no longer lists it. `desk-dates.ts` holds Setup's date
   words for both modules; `Btn` gained a `danger` tone. `/code-review` found linking deleting episode recaps (they live on
   listing rows: now only the times come off), Not known yet clearing the finale's date (an ended linked season would have gone
   back to Airing), a link's Undo leaving the show's listing, an aired-only correction refused as "Nothing moves" (it saves now,
   with a line saying only aired episodes change), the search firing on every keystroke (debounced; greyed hits read no
   episodes), aired episodes past 100 missed, a recap-only row reading as "Kept from its old listing", a binge listing labelled
   by its weekday, and three queries at once on a transaction's client: all fixed. Check: `check-desk-setup.js` 158 PASS at 390
   (its own TVmaze stand-in: the show with Seasons 1, 3 and 5, an ended look-alike, another show's Season 3; a listing read run
   through `listedSeason` on held times and count); check-desk-inbox 106 (its no-schedule item's Setup now leads with Find it
   and Set it by hand), check-desk-people 249, check-classic-admin 22, check-new-settings 111, unit tests 837; check-new-desk
   without its rulebook section (a scratch copy, deleted) failed only (ab)'s "every league renames him", as in 3a.
   **Left behind or changed from classic, and why (decision 10):** classic's Finale date field (the finale's date now follows
   the count and the times, which the listings' status rule reads; Not known yet keeps the last one); a blank air time meaning
   8 PM (the desk asks for a time); research's weekday, time and delay (paid auto research, decision 9; the bot's timing is
   4a's). Classic's prune is ported as it was (results still settling, research and its search index, auto research's tries,
   and the old wiki read's episodes past the count, kept because `season_air_dates` still reads old wiki dates); its "weekly
   from the premiere" only schedule becomes Weekly, Nightly or All at once. Classic's schedule fields now hold over the
   listing's the same way (`times_held_at`, `count_held_at`), so the two agree until step 8.
   **Noticed, not fixed (3b):** (au) `listing.ts releaseOf` never says nightly, so a nightly season made from its listing
   reads "Tuesdays 9:00 PM" on When it airs though its episodes' times are right; the found line says Nightly (it reads the
   gaps). listing.ts is shared with the sports lane: for a later step. (av) A link's Undo gives the show back no listing only
   when none of its seasons is linked; a show whose seasons were linked before the show had a TVmaze id keeps the one the link
   gave it. (aw) A lowered count leaves `research_asks` and `bot_research_runs` past it (classic did too): for 4a, which owns
   Runs. (ax) Each search is up to 1 + 5 + one more per usable hit TVmaze calls, uncached (`listings.ts` fetches no-store);
   debounced at 400 ms. If the desk ever searches a lot, cache its answers. (ay) The stand-in's season dates are UTC days, so
   its found line's range can read a day off the linked sheet's (the stand-in only: TVmaze's are the network's days).
4. **Seasons: research and the bot.** Run now (quick, full, schedule, trivia, bingo), the bot's episode length, each run's
   timing, add or remove a run, reset; an episode's research (paste an answer, discard, clear); auto research; the bingo bank
   (an episode's squares and the season's, hide or show, write by paste). The results queue: an episode's pending results with
   Accept all, accept, reject, correct.
   **As mocked (2026-10-28, `desk-research.js` and `desk-research.css`, waiting for approval):** Running it's two step 4 rows
   are real, and the season page's episodes open their own pages. **Research and the bot** (`/desk/.../research`): its lower
   third is Autopilot on or off and the next run's time. **Run now** has five buttons (full results first and wide, then who
   went home, the schedule check, trivia and bingo squares); each opens a sheet: which episode (aired ones; bingo the next two
   and the season's bank; the schedule check none), what it does in plain words (tier 2: a full answer is a source like a
   couch's, confirming what it agrees with in every game and disputing the rest, and replaces the bot's earlier answer; the
   schedule check keeps a time set by hand), and "one question at a time" (it starts after the run in progress). The run then
   shows in Runs with how far it's got ("9 of 21 people written up"). **Its schedule**: the Autopilot switch, then the bot's
   runs drawn as the next episode's night on a rail (Now, Episode N starts, It ends with Change for the episode length,
   each run at its real time with its switch; trivia and bingo counted back as `dueAt` counts them), Add a run (*n* of 8), Reset
   to our usual five, and "Not in its schedule" listing the usual runs a season lacks, each with Add (how Survivor 51's
   schedule-check-only setup shows why it gets no trivia or bingo). A run's sheet changes its timing on a stepper (refusing a
   duplicate) or takes it off; paid Claude research shows only on a season where it's on, with Switch it off (the desk has no
   paid actions). **Runs**: the latest five (done, failed, asking), each a sheet: what it found or why it failed, how many tries
   it gets, The question, Ask again or Try again. **Not in the games yet**: episodes with results one source wasn't sure of,
   no badge (decision 7). Then History and the season's Delete, as on Setup. **An episode** (`/desk/.../e/N`): its lower third
   (Early, Final or Waiting; who went home); **Results** with Hide names (classic's spoiler toggle: counts only), *Not in the
   games yet* (one source wasn't sure, or a name not in the cast: ✕ and ✓, or Who?), Accept all (tier 2: each into every game,
   its games scoring them as each player reveals it, the shared stats), *Disputed* (to its fact page), and *In every game*
   grouped by result (each a sheet: Correct it, Take it out, Unlock). **Answers**: each a source (a couch's paste, a quick check,
   our bot's runs), each with Take it back (tier 2: what only it reported leaves every game); Paste an answer (the plain Ask an
   AI, not the couch's $1 chooser) previews what it would add; Ask our bot is Run now for the episode. **Trivia**: the bot's
   questions about it, each with Take it out (the admin's flag), or Write trivia now. **Bingo**: a link to its squares. Last,
   red, **Clear Episode N's results** (tier 3: every answer and result, accepted ones too, out of every game; offered first,
   Clear only what's waiting). **Bingo bank** (`/desk/.../bingo`): a strip of episodes and the season's bank; each with who
   wrote it and how many passed its check, Write them again and Paste squares (a paste isn't checked, as classic's), squares by
   Likely, Maybe, Long shot and Out of new cards (two flags, hidden by you, dropped by the check); a square's sheet shows it as
   a plate, its flags and who sent them, Hide it from new cards or Show it again. Autopilot reaches Setup's What moves, the
   Inbox's Coming up ("Autopilot: who went home, then full results") and Settings › Our bot › Autopilot (its seasons, each a
   link). Mock scenarios: 16 (`scripts/dev-test/shoot-mock-scenarios.js --group=dsr` shoots them all at 390).
   **What the build needs beyond classic:** Run now as a queued run (classic runs it inside the request, up to 300 s, with no
   progress); every run's `progress` read on the desk (0153 writes it; only asked results read it today); a run in progress
   found from its row (`ok` null, under 10 minutes old) to say what a new one waits behind; the queue read from the new
   design's facts (`fact-status.ts`: a reported fact that isn't `live`, or a name not in the cast), not classic's staged
   `season_decisions`, with Accept and Correct making it canonical and Reject removing it (desk routes over the shared facts;
   classic's accept-episode applies staged rows); the desk's paste filed as a submission (`community-results.ts`), not
   classic's review-only staging; Take it back withdrawing one submission (the couch's Undo, for any source); Clear's two scopes
   mapped to classic's (everything = `scope=everything`; only what's waiting = the facts not live); Show it again on a square
   two people flagged overruling their flags (`bingo.ts` counts two flags or an admin's, so an admin's unhide must outrank
   them); trivia's questions per episode on the desk with the admin's flag (classic lists them only in the run's row).
   **Its three questions, settled (Claude's calls; the user asked for the best choices, 2026-10-28):** (1) every page under a
   season ends with the season's Delete, the same row and sheet (Setup, Research and the bot, the Bingo bank, and step 5's
   Cast), so wherever you are on a season its delete is last; an episode, which can't be deleted on its own (Setup's Episodes
   count removes it), ends with Clear its results. (2) Hide names starts on for an episode you haven't seen ("Never spoil":
   the desk knows your mark like any page) and off for one you have, with the switch either way; it also hides names in Accept
   all, Take it back and a paste's preview. (3) Trivia's questions and Take it out stay on an episode's page: the admin's flag
   already exists (`trivia.ts`), and it's where you'd look after a "Wrong?".
   **Changes at approval (2026-10-28):** no paid Claude research on the schedule, and no Switch it off (decision 9).
   **As built, part 4a (2026-10-29):** **Research and the bot** (`/desk/season/<id>/research`: `routes.ts` DESK_SEASON_PAGES
   gains `research`, depth 3; `src/new/desk/research.tsx`, `src/lib/server/desk-research.ts`, words shared by both in
   `src/lib/desk-bot-words.ts`; `GET` and `POST /api/desk/seasons/[id]/research`, `GET` and `POST .../runs`, `GET
   .../runs/[runId]`, `POST /api/desk/runs/next`). The season page's Running it has **Research and the bot** ("Autopilot on · 5
   runs after each episode", or "Autopilot off · Run now any time"); its old Autopilot trial section moved here. The page as
   mocked: the lower third (Autopilot on or off; "Next: tonight, 10:05 PM", "Asking now: Episode 5", "Nothing due" or "Nothing
   runs on its own"), "Asks ChatGPT · 2 runs this week", **Run now** (five, full results wide), **Its schedule** (Runs on its
   own; Around Episode N drawn as the night: the start, It ends with Change for the episode length, each run at db/bot-
   research.js `dueAt`'s time with its switch, Now in yellow, a passed run's ✓ or ✗; Add a run *n* of 8; Reset, or "Our usual
   five"; Not in its schedule with Add), **Runs** (the latest five, All N), History (the season's bot and Run now lines) and
   the season's Delete, last. Sheets as mocked: Run now (which episode: the latest six aired, bingo's next two and the
   season's, the schedule check none; what it does; what it waits behind; Ask it now), a run (Done in, Failed or Asking with
   how far it's got; how many tries a run like it gets; The question; Ask again or Try again, which opens Run now for it), a
   run's timing (the mock's ladder, a duplicate refused, Save, Take it off the schedule), Add a run, Reset to our usual five,
   Episode length (5 to 600 minutes). The rail's episode is the one whose runs are still to come (the latest aired while any
   of its runs is due, else the next), so tonight's runs stay on it after the episode starts; an Upcoming season says nothing
   runs until it's Airing. Schedule changes are tier 1: desk-bot.ts `setSeasonBot` takes `episodeMinutes` and `reset` too
   and says each change in words (`changeLine`: "Full results: 12 hr after it ends (was 9 hr after it ends)", "Autopilot
   off", "Schedule reset to our usual five"), a toast with Undo; an Undo puts the length back only with a line that changed
   it. Settings › Our bot › Autopilot lists each season with what it does after each episode ("Who went home, then full
   results", Coming up's words) and opens its Research and the bot.
   **Run now is queued (migration 0424, `desk_runs`, additive):** the request checks the bot answers (a refusal says so,
   nothing queued), queues the run (the same one open already is joined; a unique index lets one of two at once in), writes
   a History line and answers at once with what it waits behind ("One question at a time: it starts after full results for
   Episode 5, in about a minute", from the run asking anywhere, found from its row: `ok` null, under 10 minutes old, and
   what's queued). After the answer, the request driving the queue (`drainDeskRuns`) takes its first run, waits while the
   bot asks anything (up to 4 minutes a request), asks through runJob as classic's did (slot `now`, filed as a source by
   bot-results.ts), puts who asked on the run's row, and hands the next one to a request of its own (`/api/desk/runs/next`,
   Bearer CRON_SECRET), so every run has a whole 300 s; one that waited long hands itself on the same way. A driver cut off
   (a redeploy) lets go after 6 minutes, and the page's read, which polls every 3 s while anything asks or waits, takes over.
   Runs shows a queued run as waiting, an asking one with its bar ("9 of 21 people written up", or its stage: Opening
   ChatGPT, Searching the recaps, Writing 30 squares), and a row marked running past 10 minutes as cut off. A run's question
   is rebuilt as it would be asked now (full, who went home, the schedule check, trivia and bingo through their own
   builders; `db/bot-research.d.ts` and `episode-research.d.ts` gained declarations for what was already exported, and
   `db/trivia-research.d.ts` is new: no export changed). Noticed e: the sheet says "about 3 minutes" for full results.
   **Noticed d, settled:** the code is right. Asked results went who-went-home first in slot `asked-quick` for a day
   (2c929d07) and went back to each episode's full results in order the same day (ba15ffd0), so `ASKED_SLOT` 'asked' is all
   there is; HANDOFF.md's "Then (same day, the user's 'do all')" paragraph still describes the first way and wants
   correcting at the merge. Runs lists an asked run as "Fill in what happened". **Noticed aw, taken:** Setup's Episodes
   lowered (desk-schedule.ts) now also takes the season's `research_asks`, queued Run nows and finished `bot_research_runs`
   past the count (a run still asking finishes; trivia's and bingo's rows let go of the run); classic's prune doesn't, until
   step 8.
   **Left behind or changed from classic, and why (decision 10):** classic's Run now inside the request (up to 300 s, no
   progress, a second one waiting inside the bot on its own clock) is replaced by the queue; classic's runs list (GET
   bot-research, the last 100) is Runs' All N; classic's research PATCH fields for paid auto research (decision 9 and
   Changes at approval: no paid Claude research on the schedule, no Switch it off, so no Not our bot block); "signed in" in
   the meta line (the desk can't know how the bot is signed in); the schedule check with nothing aired (classic asked about
   episode 0's next; the listing or Setup says when a season starts). The mock's rows for an episode's results (the run
   sheet's link to Episode N's results, Not in the games yet) are 4b's, and the Bingo bank row 4c's: they come with their
   pages, so nothing links to a page that isn't there yet. `check-new-settling.js` part 5 now drives the season's bot on
   this page. `/code-review` found a run cut off mid-ask reading as asking for good (and polling), Try again on an older
   episode asking about the latest, an Undo of any bot line putting back an old episode length, two asks at once queuing
   twice, the sheet's copy of dueAt drifting from the server's (now `runTime`, held to `dueAt` by
   `tests/desk-bot-words.test.js`), copies of the duration words, and a read doing its queue queries twice: all fixed.
   Check: `scripts/dev-test/check-desk-research.js` 95 PASS at 390 (zt_dr_ fixture, up and down; the bot only through
   fake-bot.js and x-gys-bot; two seasons' runs queued one behind the other); check-desk-setup 158, check-desk-inbox 106,
   check-desk-people 249, check-classic-admin 22, check-new-settings 111, unit tests 840 (with `desk-bot-words.test.js`); check-new-desk without its
   rulebook section (a scratch copy, deleted) failed only (ab)'s "every league renames him", as in 3a and 3b; check-new-settling 96 (its part 5 on this page).
   **Noticed, not fixed (4a):** (az) the rail shows only the runs due around its episode, and only when there is one: a
   season with no episode coming up (or a trivia run with no time before the next episode) can't switch, retime or take off
   a run except by Reset; the mock draws only the rail, so a plain list of the runs would be a new screen. For whoever
   designs the ended or no-schedule season's page. (ba) Between the queue seeing the bot free and its run's row going in,
   a scheduled run or a One tap can start: the bot queues the second question itself ("waiting"), so nothing breaks, but
   that run's 300 s includes the wait. Only a claim the cron's planner reads would close it (db/bot-research.js, off limits
   here). (bb) Classic's Run now still asks inside its request until step 8, and the queue waits for it like any run.
   **As built, part 4b (2026-10-29):** **an episode's page** (`/desk/season/<id>/e/<n>`: `routes.ts paths.deskEpisode`,
   depth 4, Back to the season; the desk page route takes a fourth segment only as `season/<id>/e/<n>`; `src/new/desk/
   episode.tsx`, `src/lib/server/desk-episode.ts`; `GET`, `POST` and `DELETE /api/desk/seasons/[id]/episodes/[n]`, `GET
   .../question`). Read from the new design's shared facts (fact-status.ts), never classic's staged rows: a fact is **waiting**
   when it's reported and not in the games, or names nobody in the cast (with the closest cast name as a guess, "Linnea
   Capobianco, maybe?"); disputed, in every game (confirmed, one sure source, or canonical) and out (rejected or removed) as
   their statuses say. As mocked: the lower third (Early, Final, Waiting; Tonight or Coming up before it airs; who went home,
   or the season's name while names are hidden), its line, **Results** (Hide names: on by itself for an episode you haven't
   seen by your own mark, guard.ts seenThrough; counts only; it also hides trivia, which names people too), *Not in the games
   yet* (✕ ✓, Who?, Accept N or Accept all N), *Disputed* (Decide, to the fact's page), *In every game* by result (faces, who,
   how sure), rejected or taken out; each result's sheet (why, Says it happened, then Accept/Reject/correct it, Who was it?,
   Correct it and Take it out of every game, Unlock it, Put it back); **Answers** (each a source with who and when: a couch's
   quick check or paste, One tap, our bot's Run now by whom or its schedule, a tie-break, the desk's own paste), each a sheet
   (how many with another source agreeing and how many only it reported, what it was, Take it back); **Paste an answer**
   (`AskAiPasteSheet`, the plain Ask an AI with the season's checklist as JSON, buildPasteImportPrompt structured) then
   **Add it as a source?** (what it agrees with, what it confirms into every game, what it adds that waits, what it splits);
   **Ask our bot** and **Write trivia now** (4a's `NowSheet`, now exported, on this episode); **Trivia** (the questions written
   after it, each a sheet with Take it out or, out by an admin's flag, Put it back); **Bingo** a line until 4c (its own
   squares or the season's bank, not a link); History (each answer as it came, the episode's desk lines, its facts' own);
   **Clear Episode N's results** last (tier 3, held), offering Clear only what's waiting. Tiers as mocked: ✓ ✕ Correct Unlock
   Put back and trivia tier 1 (a toast with Undo: `decideFact` now hands back its change id); Accept all, Take it out, Take
   it back and a paste tier 2 (the sheet says what moves first: `community-results.ts settleWhatIf`, additive, settles the
   episode with an answer left out or added, nothing written); Clear everything tier 3; Clear only what's waiting tier 1 with
   Undo (its rows snapshotted and put back). New undo kinds in desk-undo.ts: `facts` (Accept all, put back in one sync:
   desk-facts.ts `restoreFacts`), `answer` (a taken-back answer counts again; a paste is withdrawn), `trivia`, `cleared`.
   Episode lines are the season's admin_changes (action `episode`, `after.episode`), so no migration. **The desk's paste is a
   submission** of its own (source `paste`, the admin's, no couch), read as our bot's answer is (`researchFromPaste`
   structured, merged into the stored answers when the episode has some, the wrong-episode check asking first: a 409 the
   sheet already handles), then `sendResults`: the episode settles and every game follows. **What 4a left**: the season
   page's Episodes are rows to their pages (the next one, then each aired one: "Aired Oct 21 · 3 not in the games yet", "in
   every game", "no results yet"; `episodeRows`), its old per-fact drill-down gone (the facts are on the episode's page);
   Research and the bot's **Not in the games yet** (episodes with results waiting: "2 one source wasn't sure of · 1 not in
   the cast", no badge, decision 7; `waitingEpisodes`); a run's sheet links **Episode N's results** (full, who went home, a
   tie-break, trivia; bingo's link is 4c's). `db/episode-research.d.ts` declares `researchFromPaste`'s other options and what
   it returns (no export changed).
   **Left behind or changed from classic, and why (decision 10):** classic's results queue (`decisions` GET/PATCH, accept-
   episode) reviews staged `season_decisions` with no fact status, rows only a wiki pull or classic's own research staged:
   the desk reads facts, so those rows never show (decision 7: results settle when sources agree), and classic's
   accept-episode is Accept all over the facts; classic's research POST (paid Claude search, a model picked per browser) stays
   behind (decision 9), and its paste, which staged for review, became a submission that counts at once like a couch's; the
   wiki sync route stays with classic (decision 9). Classic's Discard (delete research only, keep what the wiki staged) has no
   place without a wiki: Clear only what's waiting is the light clear, and it deletes only facts not in the games, with Undo,
   where classic's couldn't be undone. Clear everything is classic's `scope=everything` plus the episode's quick checks
   waiting in Backstage and the flags on its results (both answers and results by then); it leaves the episode's trivia (the
   mock's code dropped it, its sheet doesn't say so) and its research asks. From the mock: "ChatGPT, signed in" (the desk can't
   know); Correct it's "What happened" lists the show's ways out for an exit and its moments for a moment, nothing for other
   kinds; Who was it? lists the cast still in for the episode (by accepted exits before it). A couch's quick check and later
   paste are one source (fact-status.ts counts by who sent it), so "3 sources agree" can read 2 where one person sent two.
   `/code-review` found Clear only what's waiting deleting a stranger's result already in the games before the leagues let go
   of it (its record of what each was given goes with the row), Accept all and that clear acting on whatever waited when the
   request came rather than what the sheet showed (both now send the ids they showed), an episode with no air time never
   counting as aired (taken as aired now, as classic's research was), Hide names still naming the stranger in Accept all's
   line and a "Nobody went home" line in the previews, Correct it's default for an exit with no way out given, and a
   noexit's "correct it", each paste previewed twice, the game count's own copy of the league-to-season join, and the
   season read still sending every result for the old drill-down: all fixed. Left as it found: the episode's mutations read
   the whole page to find their facts (a few more queries a change, for one rule of what waits).
   Check: `scripts/dev-test/check-desk-episode.js` 91 PASS at 390 (zt_de_ fixture, up and down; the bot never asked, Ask our
   bot and Write trivia now only open Run now); check-desk-research 95, check-desk-setup 158, check-desk-inbox 106,
   check-desk-people 249, check-classic-admin 22, check-new-settings 111, check-new-settling 96, unit tests 840;
   check-new-desk without its rulebook section (a scratch copy, deleted) failed only (ab)'s "every league renames him", as
   in 3a-4a.
   **Noticed, not fixed (4b):** (bc) a result named for someone not in the cast can already be in every game (one sure
   source): the leagues skip it (no such castaway), so it scores nobody until Who? names them; it shows waiting here. Whether
   such a fact should wait instead is fact-status.ts's (settleFact knows no cast): for whoever next takes results settling.
   (bd) Undo of a desk paste withdraws it as a couch's Undo does, but its answers stay folded into the stored ones (the
   combined row) that later questions are cut down from; a couch's Undo does the same. For the same.
   **As built, part 4c (2026-10-29):** **a season's Bingo bank** (`/desk/season/<id>/bingo?bank=<n>|season`: `routes.ts`
   DESK_SEASON_PAGES gains `bingo`, depth 3, `paths.deskBingo`; `src/new/desk/bingo.tsx`, `src/lib/server/desk-bingo.ts`; `GET`
   and `POST /api/desk/seasons/[id]/bingo`, `GET .../bingo/question`). As mocked: the lower third (Ready or No squares;
   "Episode 6: 26 squares" or "Episode 7 uses the season's"), "A card is 8 squares round a free centre ... dealt to N people
   so far", the strip (the next two episodes and every one before, then the season's, each chip with how many squares deal
   from it; the URL keeps the one chosen, so Back and a reload come back to it), the bank: who wrote it ("Our bot, Run now by
   alex", "Our bot, on its schedule", "You pasted them") and when, "27 of 30 passed its check" or "27 pasted, not checked",
   **Write them again** (4a's `NowSheet` on that bank) and **Paste squares** (Ask an AI, `AskAiPasteSheet`, on the bot's own
   prompt for that bank; then "Save these squares?": what was pasted, what fits, what's left out and why, what it replaces;
   tier 2, Undo puts the old bank back with its squares' ids and flags, so cards not kept deal as before), the squares by
   Likely, Maybe, Long shot and Out of new cards (dropped, Two flags, Hidden by you, or "1 flag" on one still in); an aired
   episode has no Write or Paste ("Bingo never writes for an episode once it has aired"), one to come with none says whether
   the bot writes it ("Bingo isn't in <season>'s schedule..."); **a square's sheet** (it as a plate, where it's dealt "Dealt
   on 26 of the 38 cards so far", why it's out, Flagged as unfair with who sent each, Hide it from new cards or Show it again,
   tier 1 with Undo); History (the bot's banks as written, the desk's hides, shows and pastes, each square two flags took out)
   and the season's Delete (`SeasonDeleteRow`, which now forgets this page too), last. **An admin's Show it again outranks two
   players' flags (migration 0425, additive):** `bingo_squares.shown_at`/`shown_by`; `bingo.ts FLAGGED_OUT` counts only flags
   since it (two new ones take it out again; an admin's own flag still takes it out at once), with the caller's row's
   `shown_at` passed in where it has one (bankFor). Show it again deletes every admin's flag on it and stamps it; Hide is the
   admin's flag, as classic's was. A flag from before is listed as overruled, and a tile's "N flags" counts only the ones
   since. `pasted_by` (0425) says who pasted a bank. **What 4b left:** the season page's Running it has **Bingo bank** last
   with the mock's line ("Episode 6: 26 squares · the season's: 28", "The season's: 28 squares · none for Episode 7 yet", "No
   squares yet · write or paste them"; `bingoLine`); the episode page's Bingo row opens the bank on that episode, its line who
   wrote them and when (`bankBrief`); a bingo run's sheet links "Episode N's squares" or "The season's squares" (The bingo
   bank). `MovesSheet` is exported from episode.tsx, and MoveLine gains `grid` and `repeat` icons. History lines are the
   season's admin_changes (action `bingo`); undo kinds `bingoBank` and `bingoSquare` in desk-undo.ts. `bingo-bank.ts`
   exports `parseIn` and `contextFor` (no shape changed).
   **Left behind or changed from classic, and why (decision 10):** classic's bank route (`/api/admin/seasons/[id]/bingo`)
   reads one episode's bank and the season's together with the prompt inline; the desk reads one bank at a time from the strip
   and fetches the prompt only when Paste squares opens it. Classic's paste files at once; the desk's says what it keeps and
   leaves out first, and can be undone. Classic's Hide and Unhide only add or take back the admin's own flag, so an Unhide
   never overruled two players' flags; the desk's Show it again does (classic's stays as it is until step 8). From the mock:
   a flag has no note in the app (`bingo_square_flags` has none, and the player's flag asks for none), so a flag's line says
   when it was flagged, not the mock's quote; "Dealt to N people" counts the cards that have a row (one is kept once ticked
   or dealt again; a card only looked at is dealt afresh each read, so it isn't counted); a dropped square in a paste says
   "Left out of the paste", not "Its check dropped it". A season whose last episode has aired (not mocked) says "All aired"
   and the season's bank in its lower third. The page polls while a bingo run for the season is queued or asking (up to 15
   minutes; a queue whose driver was cut off is Research's read to take over).
   `/code-review` found the page polling for ever on a stalled queue, an Undo of a hide putting back a later Show it again,
   the paste's author stamped outside its own batch (a bot run at the same moment), a finished season naming an episode past
   its count, the strip missing a later episode's bank or the one asked for, overruled flags shown as live, FLAGGED_OUT's
   extra lookup on every card dealt, and a second bank read for one count: all fixed. Left as it found: classic's
   saveBingoBank and the desk's paste each parse the answer (classic's goes at step 8), and each desk page keeps its own small
   `SubHead` and `plural` as the others do.
   Check: `scripts/dev-test/check-desk-bingo.js` 79 PASS at 390 (zt_db_ fixture, up and down; the bot never asked: Write them
   again only opens Run now); check-desk-episode, check-desk-research, check-desk-setup, check-desk-inbox, check-desk-people,
   check-classic-admin, check-new-settings, check-new-settling and check-bingo-bank pass (check-bingo-bank and check-desk-episode
   again after `/code-review`'s fixes); unit tests 840; check-new-desk
   without its rulebook section (a scratch copy, deleted) passed whole, (ab)'s "every league renames him" too this time.
   **Noticed, not fixed (4c):** (be) a player's "This square's unfair" takes no reason (`bingo.ts flagBingo`, no column), so
   the desk can't say why someone flagged it as the mock's quotes do; a reason on the player's flag is player-facing, for
   whoever next takes bingo's card. (bf) "Dealt to N people" counts only cards with a row (ticked, or dealt again): counting
   every card looked at would mean writing a row on each read (docs/HOSTING.md), so it stays a floor. (bg) Classic's Unhide
   (`bingo-bank.ts adminFlagSquare`, on false) still only takes back the admin's own flag, so it never overrules two players',
   and classic's paste leaves `pasted_by` empty (the desk says "Pasted"); both go with classic at step 8.
5. **Seasons: cast.** Pull from the wiki and pull again, approve and send to the games, remove someone, hold starting groups
   until Episode 1.
   **As mocked (2026-10-28, `desk-cast.js` and `desk-cast.css`, waiting for approval):** Running it › Cast opens a page of its
   own (`/desk/.../cast`; the row says "21 castaways · in all 15 games", or carries the dot when a pull wasn't sent). Its lower
   third is In the games, Not sent or No cast. **A pull that found changes leads**: "Pulled again: 2 changes, not sent" (its
   games keep the cast as sent; sending never takes anyone out) with See what changed (the yellow): a new spelling asks
   "Same person / Someone new" (same: renamed in every game, teams, picks and results keep them; new: joins as nobody's), a
   group the wiki has differently says what it may mean ("A swap moved Carter to Toka: the wiki may mean his tribe now"; Keep
   ours first), someone new joins as nobody's, and someone the wiki stops listing shows there to remove from their page;
   then Send to its games (tier 2: each change, then "Teams, picks and results: stay as they are" and the cast's size). The
   Inbox's cast item now opens this page; sending clears it. **Getting it**: Pull it again (reads names, groups and photos;
   shows what changed before anything is sent), its wiki page (Setup's row), Ask our bot instead. A season with **no cast**
   leads with Pull it from the wiki, or, with no wiki connector, Ask our bot for it and Paste it (their answer opens the same
   review, with everyone new). **Starting groups**, in the show's own word (tribes, factions): each with how many start in it
   and Not a tribe (a quiet link; a button where the group is named like a secret role, which says it gives the role away and
   keeps its people hidden: the faces show Still in and Out instead); secret-role groups go out together, since one left
   behind still gives the role away (tier 2, Undo from History). **Hold them until Episode 1** (tier 1): someone who hasn't seen
   Episode 1 sees the cast with no groups; they arrive with its reveal. A note says a swap's groups come from results, game by
   game. Then **the cast** by starting group (four across, as the real desk's grid, Out · Ep N greyed), History and the season's
   Delete. **A castaway's page** (`/desk/.../c/<name>`): their photo in the lower third (Still in, Out, or New), how many teams
   have them, Part of (the cast), Name, Photo (a link, No photo, or Look on TMDB and TVmaze) and Starting group, each with
   Override reaching every game with Undo, Lock, History, and **Remove <name> from the cast** last: refused while a team, pick
   or result has them ("Remove is for someone listed by mistake", their teams listed, Override their name offered); otherwise a
   hold (out of the cast and every game; a pull would bring them back as someone new). The old castaway page sends here.
   Mock scenarios: 11 (`shoot-mock-scenarios.js --group=dsc`). The Inbox's example moved from The Challenge 41 (no cast in the
   mock) to Survivor 51.
   **What the build needs beyond classic** (Noticed g-l): a pull that compares (added, gone, renamed with a same-person guess,
   group changed, photo changed) and stages the differences until they're sent, instead of upserting by name; a scheduled pull
   for seasons on Autopilot too, so the Inbox's item is real; Send as classic's approve (`applyApprovedCastToLeagues`, then the
   season sync) with its preview, a rename applied by id; Remove reaching every game, refused while in use (the commissioner
   path's guard, `season-cast-write.ts`), without un-approving; Hold (`tribes_from_episode`) changed without un-approving, worded
   by the new rule; Not a group for secret-role groups together (`desk-cast.ts clearGroup` takes one); a person's Look on TMDB
   and TVmaze (`castPhotosFor`); our bot's cast ask and a paste on the desk (classic's admin has neither).
   **Calls made in the design (Claude's, 2026-10-28):** pulling never removes anyone; a new spelling defaults to Same person;
   a group the wiki has differently defaults to ours; Remove is refused while in use; the Cast page ends with the season's
   Delete and a castaway's with Remove.
   **Changes at approval (2026-10-28): no wiki** (decision 9). Getting it is **Ask our bot** (the yellow on a season with no
   cast; Ask our bot again on one with a cast) and **Paste it**; either answer opens the same review of what changed (a new
   spelling: Same person or Someone new; a group it has differently; someone new; someone it no longer lists), and Send to its
   games sends it. Photos come from TMDB and TVmaze as now (`castPhotosFor`). The wiki page row, "Pull it again" and "reads
   names, groups and photos" go. There's no scheduled cast ask: Autopilot doesn't add one, and a name research reports that
   isn't in the cast already shows in step 4's queue.
   **As built, part 5a (2026-10-29):** **a season's Cast** (`/desk/season/<id>/cast`: `routes.ts` DESK_SEASON_PAGES gains
   `cast`, depth 3; `src/new/desk/cast.tsx`, `src/lib/server/desk-cast-page.ts`, the review in `src/lib/desk-cast-diff.ts`, pure,
   with `tests/desk-cast-diff.test.js`; `GET` and `POST /api/desk/seasons/[id]/cast`, `GET .../cast/question`). As mocked, with
   the Changes at approval (no wiki): the lower third (In the games, Not sent or No cast; "21 castaways · 2 tribes"), where it
   came from and when it was sent ("From our bot · asked today, 9:00 am · sent Oct 9 to 15 games"); a cast not sent leads ("Our
   bot's answer: 2 changes, not sent", what its games keep, See what changed); no cast leads with Ask our bot for it and Paste it;
   Getting it (Ask our bot again, Paste it); its starting groups as the season page had them (Not a group, moved here; 5b redoes
   them with Hold), the castaways by starting group four across in its games' colours, Out · Ep N greyed (an accepted exit), Still
   in and Out when a group is named like a secret role; History (the cast's asks, answers, pastes and sends, groups taken out)
   and the season's Delete, last. **An answer is staged** (migration 0426, additive: `season_cast_answers`; 0424's `desk_runs`,
   not on production yet, takes a kind 'cast'): never written into the cast; only a season's latest is reviewed; one that changes
   nothing is settled at once, and a send settles any older one. **The review** (castChanges): names the same but for case match;
   then the nearest spelling, closest pairs first (no accents, case or punctuation, so Thien An and Thien-An are one; within an
   edit distance of a fifth of the name, at least 2, for names of six letters or more; or a first name one is short for, Matt and
   Matthew, within three letters, on the same surname) as a new spelling, Same person by default; a starting group the answer
   names differently (never an empty one, never on a show without groups), ours by default, its line saying "A swap moved Carter
   to Toka: the answer may mean their tribe now" only when a game already has them there; someone new; someone it no longer lists
   (said, never taken out). A locked castaway is never changed by an answer. **Send to its games** (tier 2, MovesSheet: each
   change, "Teams, picks and results: Stay as they are", "Castaways in each game: 22, from 21"; more than four joining fold into
   one line) in one transaction: a rename by id (guarded on the name it had; the season's staged results renamed with it, as an
   Override does), people joining with the answer's photo or the season's credits' (show-art.ts castPhotosFor: TMDB, then
   TVmaze), starting groups, each in season_cast_changes, the answer marked sent, the cast approved with its size, a History line
   with Undo; then every game gets it (applyApprovedCastToLeagues: a renamed castaway is the same one in each game, team, picks
   and results kept) and results waiting on someone in it land (syncSeasonLeagues), as classic's approve did. A send names its
   answer, so a newer one refuses it ("look at what changed again"). A cast staged and never sent (classic's pull) is a first
   send: everyone joins its games. **Undo** puts the cast back as it was sent (renames and groups back, each guarded on what the
   send left; who joined out of the cast and its games; a first send unapproved again, its people out of its games), refused once
   someone who joined is on a team or in a result in a live game, or while a later send stands. **Ask our bot** is queued as Run
   now is (desk-research.ts `queueCast`: the same ask joined, refused when the bot isn't answering, one 15 minutes old failed so
   a new one goes in) and asked by the queue's driver (drainDeskRuns: desk-cast-page.ts `askCastNow` asks cast-prompt.js's
   question in the show's words through askBot and stages the answer). It isn't a bot_research_runs run, so Research's Runs don't
   list it; the queue's wait line names it ("it starts after Survivor 51's cast"). The page says it's asking and polls, and its
   read takes over a queue nobody drives (`takeOverQueue`, as Research's read does); a failure is a History line ("Asked our bot
   for the cast: it failed (...)"). **Paste it**: AskAiPasteSheet on the same question, then What changed at once (or "Pasted:
   nothing changed"). **The season page's Running it › Cast** row is always there ("21 castaways · in all 15 games", "No cast
   yet: nothing to draft or pick from", "Your paste: 1 new spelling, 1 starting tribe · not sent to its games" with its dot), the
   classic-admin link gone; the page's groups and faces moved to the Cast page, and check-new-desk's section 7 follows them.
   **The Inbox's cast item** (Noticed k): a season's latest answer, our bot's or a paste, with changes not sent ("Survivor 51's
   cast: our bot's answer has changes", "1 new spelling, 1 starting tribe · not sent to its 15 games yet"), or a cast staged and
   never sent ("N castaways, not sent"); each opens the Cast page, and sending clears it. The secret-role rule is one helper
   (desk-cast.ts `isSecretRole`), and MovesSheet's icons gain `user`.
   **Left behind or changed from classic, and why (decision 10):** classic's wiki pull and Pull again (the sync route,
   wiki-sync.js's upsert by lowercased name: Noticed g) stay behind (decision 9); our bot and a paste replace them, staged and
   compared first. Classic's approve is Send, with what moves said first and an Undo (classic's had none), and no un-approve:
   nothing on this page un-approves a cast. Classic's per-castaway rename, photo and tribe edits are the castaway page's Override
   (as before); its Remove and Hold starting groups are 5b's. Roles in an answer (`startingRole`) aren't the cast (cast-import.ts
   says so too): the desk leaves them. A photo an answer gives someone already in the cast isn't a change (photos come from TMDB
   and TVmaze, and a castaway's Photo is 5b's); someone joining takes the answer's, else the credits'. From the mock: no wiki rows;
   the sheet is "What changed", not "on the wiki"; the group's line says what we have and names a swap only when a game shows one;
   someone new and someone not listed are rows of their own (the mock's sheet drew only the first two kinds); a send that
   changes nothing (Keep ours throughout, or only someone not listed) is still Send and settles the answer, since the mock has no
   Dismiss and none was invented.
   Noticed ab, fixed: check-new-desk's "every league renames him" picked Find's first "Eric Macksoud", which on this copy of
   production can be the real Survivor 51 castaway: the Override then renamed that local row (its Undo put it back) and the
   fixture's leagues never moved. It picks the fixture's ("Cast · ZT") now.
   `/code-review` found the route without the 300 s a queued ask needs, an answer that changed nothing staying unsent (so a later
   Override read as its news), spelling guesses too loose for short names and longer first names (Ben and Jen, Chris and
   Christine), a stale ask joined for ever, an older send's Undo overwriting a later one and its groups unguarded, a deleted game
   blocking an Undo, the Inbox reviewing seasons one at a time, and copies of the secret-role rule and the default pick: all
   fixed. Left as it found: the season read (`deskSeason`) still works out the cast, groups and castSent the season page no longer
   shows (check-new-desk reads its groups): Noticed bi.
   Check: `scripts/dev-test/check-desk-cast.js` 82 checks, all PASS at 390 (zt_dc_ fixture, up and down; the bot only through
   fake-bot.js and x-gys-bot); check-desk-inbox (its cast item now opens the Cast page), check-desk-bingo, check-desk-episode,
   check-desk-research, check-desk-setup, check-desk-people, check-classic-admin, check-new-settings, check-new-settling and
   check-bingo-bank pass; unit tests 847; check-new-desk without its rulebook section (a scratch copy, deleted) passed whole.
   **Noticed, not fixed (5a):** (bh) a waiting answer is compared with the cast as it is now: an Override on a castaway's page
   after the answer came in reads as the answer's new spelling, Same person by default (which would put the answer's spelling
   back). The admin sees it before Send; for 5b, whose castaway page could settle a waiting answer's change for that person. (bi)
   `deskSeason` still reads the cast and groups the season page no longer shows: for 5b, which redoes the groups. (bj) An answer
   our bot gives that can't be read says "what was pasted" in its History line (cast-prompt.js's words, whose shape this lane
   keeps). (bk) Classic's cast page and approve stay until step 8 and know nothing of staged answers: a classic approve leaves
   the desk's waiting answer waiting.
   **As built, part 5b (2026-10-29):** **Starting groups** on the Cast page (`src/new/desk/cast.tsx`), in the show's own word
   ("Starting tribes · 2 tribes"): each group with its colour and how many start in it, and Not a <group>: a quiet underlined
   link, or a button where the group is named like a secret role ("named like a secret role, so it gives the role away").
   **Not a <group>** (tier 2, MovesSheet, which gains a group's colour swatch in place of a face): "Faithful and Traitor: not
   factions?", "together: one left behind still gives the role away", each group's "N start in X → No faction", "Its N games →
   Off every board", "Stats and the Cast tab → No faction filter", Take them out, a toast with Undo and Undo from History (both
   back on the same people). `desk-cast.ts clearGroup` takes every group named like a secret role at once (a group not so named
   goes alone), one Recent changes line per game, and its Undo record lists each group's people (`groups`; an old `group` row
   still undoes). **Hold them until Episode 1** (tier 1): a switch under the groups, its line by the new rule (Noticed i:
   "Someone who hasn't seen Episode 1 sees the cast with no tribes. They arrive with its reveal, or its results in a live
   game."), the note that a swap's groups come from results; `POST .../cast { hold }` sets `tribes_from_episode` without
   un-approving the cast (classic's did), logs it in the cast's log and History with Undo (refused if Hold has changed since),
   and lets any game it's due in have them at once. **A castaway's page** (`/desk/season/<id>/c/<castId>`, depth 4, Back says
   Cast; `src/new/desk/castaway.tsx`; `routes.ts paths.deskCastaway`, upFrom the Cast page; the old `/desk/castaway/<id>` and a
   link with the wrong season send there; Find's castaway rows and the cast's faces link there): their photo in the lower third,
   Still in, Out ("Out in Episode 1 · voted out", an accepted result) or New (joined after the cast's first send, on nobody's
   team); "On 1 team in 1 game" (or "On nobody's team in its N games", "· no games on it yet", "· locked"); Part of (the
   season's cast, its size); About them: Name, Photo ("From TMDB", "From TVmaze", "A link", "None yet") and Starting tribe
   ("Hidden: named like a secret role" for one), each with Override (tier 1: the toast "Renamed Kristian Chavez in 1 game" with
   Undo, a History line "Renamed Kristian Chavez (was Cristian Chavez)"), the note of what each change reaches; Lock ("Answers and
   commissioners can correct them"); History, its own lines and the cast's log (a commissioner's edit "· from <game>", a send's
   rename, "Joined the cast"; the log's copy of a desk Override left out); and **Remove <name> from the cast** last. Photo:
   a link (https only), No photo, or **Look on TMDB and TVmaze** (`POST /api/desk/castaways/<id> { look }`, show-art.ts
   castPhotosFor over the season's credits): one found fills the link to Save ("TVmaze has one for them: Save to use it"), or
   says it's the one they have, or that neither has one. **Remove**: refused while anything has them (`usesOf`: a team, a pick
   or result in a game, found by the cast link or, unlinked, by name; the season's results, staged or accepted; a "who goes
   home" call or a couch poll), the sheet "Brady stays in the cast", "Remove is for someone listed by mistake", why ("1 team in 1
   game has Brady, so taking them out would change scores. If their name is wrong, override it instead."), their teams' games,
   Override their name; otherwise a hold (tier 3, "Can't be undone": out of the cast and every game, nobody has them, so no team
   or pick changes; an answer that lists them would bring them back as someone new), which deletes the cast row, logs it,
   updates the cast's size without un-approving it, takes them out of every game (Noticed h: `applyApprovedCastToLeagues` with
   `removed`) and returns to the Cast page. **Noticed bh, taken:** an Override of a name or starting group settles that person's
   line in a waiting answer (the answer's line takes the admin's value, worked out against the cast as it was and written once
   the override is; an answer left changing nothing is settled), and the Override's Undo puts the answer back as it was.
   **Noticed bi, taken:** `deskSeason` no longer reads the cast, its groups or castSent (the season page reads none of them);
   check-new-desk reads the groups from the Cast page. **Noticed j:** the season page shows no groups since 5a; the Cast page's
   and a castaway's page's groups have the spoiler guard (Still in and Out, Hidden) and the cast's state is the lower third's.
   No photo also clears each game's copy of the photo (the games' sync never clears one). Shared: `desk-cast.ts termsOf`,
   `gamesOn` and `groupColors` serve the Cast page too. No migration.
   **Left behind or changed from classic, and why (decision 10):** classic's Remove (`DELETE` the row, un-approve the season,
   never reach a game, no in-use guard: Noticed h) is the desk's refused-while-in-use Remove reaching every game, with no
   un-approve; classic's Hold (`tribesFromEpisode` any number, un-approving the cast) is the switch at Episode 1 (a season classic
   held at another episode shows that episode), with no un-approve; classic's per-field PATCH edits are the castaway page's
   Override (as since step 6b) with Undo; classic's change log is the castaway's History. Classic's cast routes stay until step
   8 (Noticed bk). Nothing was left that the mock has.
   **Calls made here (Claude's, within the approved screens):** Hold switched on again doesn't take groups back out of a game
   that already shows them before its Episode 1 (the toast says how many: "· 1 game already shows them"), since a game's tribes
   can't be told from a commissioner's; switching it off and its Undo likewise leave the games' groups as they are. The group
   picker shows a secret-role group as "Hidden" (the mock's), so two such groups differ only by their colour. Their teams'
   games in the refused Remove are rows without a link until part 6a builds a game's page. An Override or Lock answers with the
   whole page again (check-new-desk reads it), so each reads the season's games twice: fine at a season's size.
   `/code-review` found an override refused after its waiting answer was already rewritten, an Override's Undo leaving the
   answer settled, No photo never reaching the games, Remove's guard missing a game that matched by name only, a link with the
   wrong season, Hold's Undo unguarded and unlogged, and copies of the terms, games count and colours: all fixed.
   **Noticed, not fixed (5b):** (bl) Remove checks what has them, then deletes: a commissioner drafting them in the seconds
   between is skipped by `removeUnlinkedRows` (their game keeps them on a deleted row, as classic's Remove always left everyone).
   (bm) A send's renames and regroups show on the castaway's page as the cast's log has them, with no word that a send made them
   (`season_cast_changes` has no source column): for step 8's cleanup, or a column when it's needed.
   Check: `scripts/dev-test/check-desk-cast.js` 152 checks with its section 8 (Season 4, sent with no games and linked to the stand-in TV listing,
   fake-listings.js), all PASS at 390 (zt_dc_ fixture, up and down; the bot only through fake-bot.js and x-gys-bot);
   check-desk-bingo, check-desk-episode, check-desk-research, check-desk-setup, check-desk-inbox, check-desk-people,
   check-classic-admin ("all PASS"), check-new-settings, check-new-settling and check-bingo-bank ("ALL PASS") pass; unit tests
   847 (tests/new-nav.test.js adds the castaway's route); check-new-desk without its rulebook section (a scratch copy, deleted)
   passed whole, its sections 5 and 7 following the new page and the secret roles together.
6. **Games and couches.** Find's Games (by name or join code); a game's page: its seats and who's in each (link an account,
   change a role, unlink, remove a player), its join code, delete for good (tier 3), open it (as an admin, read-only).
   **As mocked (2026-10-28, `desk-games.js` and `desk-games.css`, waiting for approval):** **Find › Games** searches name, show,
   couch or join code; a code-shaped search (three characters or more, any case) matches from the start of a code and finds its
   game whatever the filter, deleted ones too (with Restore), the row leading "Join code 7VMAEC" with what matched marked; no
   match says "No game has the code QX7P0Z" and why ("codes never have a 0, O, 1 or I", or no code starts that way), and that a
   deleted game's code finds it for 30 days. (Two small hooks in `desk.js`'s list page: `pin`, a match shown whatever the
   filter, and `empty`, a list's own no-match.) **A game's page** keeps the shape set with step 1: the lower third, Restore or
   Hand it on when it needs one, then **Open <game>** ("As its couch sees it, read-only · up to Episode 4, where you are"), Part
   of, **Join code** (its own section: the code big, Copy, "Anyone with it can join Race Night, then Outlast"), **Seats** ("5 in
   · 1 empty · 1 out"), History (latest three, All N) and Delete last (as approved: Archive offered, 30 days, then "for good,
   now"). **A seat** is a place in the game, with its team, picks and scores, and one account signed in to it: *signed in*
   (face, active, role), *empty* (a dashed chair: "Saved by priya's invite" or "Unlinked Oct 26", nobody signed in, with Link
   on the row) or *out* (greyed under "Out of it": left, taken out or removed). **A seat's sheet** is the same from the game and
   from the person: who's in it (their page), the role (as step 1's, the only Commissioner's roles dimmed with Hand it on
   first), Act as them, Link another account ("its team, picks and scores go to them; fern comes out"), Unlink (tier 1, Undo:
   the seat keeps playing with nobody signed in), and **Take <name> out of <game>** last, red (tier 3, the app's `takeOut`:
   after a draft the seat stays in the standings, unplayed; before one, or in a pool, it goes; they stay on the couch; Unlink
   offered instead). From the person's page it adds Open the game instead of who's in it. **Link an account** ("Who signs in
   to this seat?"): the couch's people without a seat first, then a search of every account by name or email; each says what
   linking them does ("Not on Race Night: they join it too", "In Outlast already: their own seat is left empty"); someone
   waiting, stopped, or out of this game (Put back gives them their own seat) can't be chosen; the role as a segmented choice
   (the only Commissioner's seat stays Commissioner); a summary of what moves, including that the seat takes their name in the
   tables, and that they're told; tier 1 with Undo and History lines on the game and the person. **An empty seat's sheet**: who
   saved it and how it fills, Link an account, Remove the seat (tier 3). **Someone out**: what happened, Put them back (tier 1:
   their own seat, team and points, rejoining the couch if they'd left it). **Open it read-only**: the app's show space for the
   game's season under a Read-only bar (a caption plate: "Read-only · Outlast on Spoiler-Free Zone", Back to the desk), at your
   own spoiler mark; Games, Episodes and Cast show what anyone on the couch sees (no "you" anywhere); **Tonight and Chat aren't
   shown** ("Tonight is each player's own", "Spoiler-Free Zone's chat is theirs": act as one of them from their seat, logged);
   anything that would change something (Reveal, a flag, a button, the show's menu, the dock) says "Read-only"; the header's
   back says Desk; leaving the show space leaves read-only; opening it is a line in the game's History. In the mock, Survivor
   51's games open (the mock's show space is Survivor 51). Mock scenarios: 15 (`shoot-mock-scenarios.js --group=dsg`).
   **What the build needs beyond classic** (Noticed m-r): Find's games search by code prefix across every state, deleted ones
   within 30 days included; seats read from the league's players and memberships: signed in, empty (a live player with no
   membership; "saved" when an unaccepted invite carries it, `league_invites.player_id`, 0042), out (disabled players, who and when from the change
   log); Link as classic's upsert plus the Game admin role, joining the couch (`joinedLeague`), renaming the seat to the
   account's name, telling them, a change-log line with Undo, and the last-Commissioner guard; Unlink with that guard too;
   Take out as the app's `takeOut` and `outPreview` from the desk (not classic's `disablePlayer`), Put back as `restoreMember`
   at any time (its MemberUndo lasts 30 days; after that, the reclaim by account id); removing an empty seat (disabled after a
   draft, removed before); read-only as a site admin's read scope over the couch's game reads (standings, episodes, cast; not
   Tonight's own jobs or chat), writes refused on the server while it's on, and a desk History line. Act as from a seat is
   step 1's.
   **Calls made in the design (Claude's, 2026-10-28):** read-only shows what anyone on the couch sees at your own mark, not
   Tonight or Chat (Act as, logged, covers one person's view), and players aren't told an admin looked (the desk's History
   is); the desk's Take out is the app's (reclaimable; the seat stays after a draft), not classic's; a seat linked to another
   account takes that account's name; a code search matches from three characters across every state; no "new join code"
   (neither app has one); the seat's sheet is one sheet from both pages.
   **As built, part 6a (2026-10-29):** **Find › Games** (`/desk/games`: `routes.ts` DESK_PAGES gains `games`, `paths.deskGames`;
   `src/new/desk/games.tsx`, `src/lib/server/desk-games.ts`, `GET /api/desk/games`): a game's name, its season, its show, its
   couch, its kind ("Outlast") or its whole code; Playing · Nobody runs it · Ended · Archived · Deleted (the first, the one
   you're on and any with games in it, as mocked); Newest first, Most players, Name, A to Z; 25 at a time from the server, the
   search, filter and sort in the address. A code-shaped search (three to six letters and numbers, any case, a dash anywhere or
   one space after the first three, read as the join flow reads it: `couch-joins.ts normalizeCode`) also finds every game whose
   code starts with it, whatever the filter, deleted ones within their 30 days too; the row leads "Join code <mark>Z9WA</mark>A3
   · Outlast · ZT DG Show 2 · ZT DG Couch", and a deleted one carries Restore. No match: "No game has the code QX7P0Z" and why
   ("Codes never have a 0, O, 1 or I, so it was misread somewhere.", "No code starts that way. Codes are six letters and
   numbers.", "Check it with whoever sent it."), and that a deleted game's code finds it for 30 days. **Browse's Games row**
   ("39 playing · 1 deleted, restorable") and **Find's search** (three games and All N games matching, a code too). **A
   game's page** (`/desk/game/<id>`: DESK_KINDS gains `game`, up is Games; `GET`, `POST` and `DELETE /api/desk/games/[id]`):
   its season's art in the lower third with Playing, Ended, Archived or Deleted, the season and couch; its facts ("Outlast ·
   Started Oct 25 · 3 players · run by jo", a site admin in a seat "(site admin)", an archived one's "Archived Oct 26 by quinn
   · on the trophy shelf"); Deleted (by whom, until when) with Restore, or Nobody runs it with Hand it on (step 1's
   HandOnSheet, no `from`); Part of (its couch, its season, its rulebook: its own copy or its season's; a game on no couch
   says what it is); **Join code** (the code big, Copy, who it lets in, or "The game's over: the code still leads to ...,
   and lets nobody into ..." once it's ended or archived; none for a deleted game, a practice game or a public pool, which
   nobody joins by code: `join-league.ts`); History (the desk's lines, the game's Recent changes and Started by, latest three
   and All N; only the newest of Archive, Delete and Restore has Undo, and a desk Archive undone from Recent changes shows
   undone); and **Delete <game>** last (decision 4). Delete (tier 3, a hold): what it does ("3 players lose their teams, picks
   and scores in it, and are told", "<couch>'s other games are untouched"), **Archive it instead** (tier 1, a toast with Undo,
   a History line; Backstage's archive, `end-game.ts archiveLeague`), else the new design's soft delete (Noticed m):
   `end-game.ts deleteLeague`, the body of Backstage's deleteGame taken out to serve both (the seats into its line's undo, off
   its group, the chat to the couch's next game here or its own conversation), restorable for 30 days, a line in the game's
   Recent changes (its Commissioner can bring it back there too) and one in its desk History; its players are told
   (`push-events.ts notifyGameDeleted`: "<game> was deleted ... kept for 30 days, in case it comes back"). **Restore** (from
   its page, or its row in the list): `restoreGame`, the delete line marked undone, a toast with Undo (deleted again; refused
   once anything's changed since). A deleted game's page ends with **Delete <game> for good, now** ("Can't be undone · it goes
   on its own Nov 28"; a hold: it's gone now instead, its join code stops finding it): the row deleted, a line on the game and
   on its couch ("Deleted ZT DG Spare for good (Survival Pool on ZT DG Show 2)"), then Games (the list it came from, else
   Deleted). A season's public pool has no Archive or Delete ("A season's public pool goes with its season", as step 3's
   season delete and 1c's account delete leave it). **Links:** a seat's Open the game (`seats.tsx`) opens the game's page
   ("The game's page: its join code, its delete"; 6b makes it the mock's "its seats, its code, its delete"); a castaway's
   refused Remove lists their games as links (`castaway.tsx`); the couch page's Games are rows to each game's page, its season
   by name (**Noticed ac, taken**); a report's game opens its page. `admin_changes` entity 'game' (**migration 0427**, widening
   the check as 0420 and 0421 did: rehearsed with the step's merge); desk-undo.ts's `gameArchive` and `gameRestore`.
   **Left behind or changed from classic, and why (decision 10):** classic's Leagues page read every league at once and
   searched in the browser by name or whole code; its delete (`/api/admin/leagues/[leagueId]` DELETE) was a hard `DELETE FROM
   leagues` with no way back, its players not told, and `leagueDeleted` deleted the couch too when it had no games left
   (Noticed m). The desk pages on the server, finds a code from three characters in any state, soft deletes with 30 days to
   restore, tells the players, offers Archive first, deletes for good only a deleted game, and keeps the couch. Classic's league
   read (its state, members and memberships) is the game's page as far as 6a goes; its players and memberships routes (link,
   role, unlink, remove) are 6b's; classic's routes stay until step 8. From the mock: the title is the league's own name ("Last
   Survivor Standing"), with its kind in the facts and the row (the mock's games were named by their kinds); no "won by" on an
   ended row (the list doesn't read each game's standings); Open <game> (6c) and Seats (6b) aren't on the page yet; "it goes on
   its own Nov 28" (the mock read "until Nov 25").
   **Calls made here (Claude's, within the approved screens):** the list's Ended is "its season is completed" (after Deleted and
   Archived), worked out in SQL so the counts and pages are the server's; a game's page reads it as the app does
   (`couch-joins.ts gameOver`, now exported: a winner, a span over, a talk show's last episode aired), so a game over a span that
   has finished is Ended on its page and Playing in the list until its season completes (Noticed bn). Nobody runs it leaves out
   a season's public pool (nobody's meant to run one). A code's no-match is said when the code has a number in it; a word
   ("pool", which no code could be) gets Nothing matches with Search playing games. The players are told under A game started
   (the nearest of the notice switches). A Restore's Undo deletes it again without telling anyone a second time.
   `/code-review` found a desk Archive undone from Recent changes still showing Undo, a site admin's seat missing from "run
   by", Delete for good leaving no record for a game on no couch, a word taken for a code, the chips' counts recounted for
   every page, an unused parameter and a copy of the join flow's code reading: all fixed; and the span (Noticed bn) and chat
   (bo) items below.
   **Noticed, not fixed (6a):** (bn) the list's Ended and a game's page can differ for a game over a span (above); a stored
   "over" would let the list say it. (bo) A game whose season isn't in the catalog (a `settings.showId` with no season row,
   e.g. one made in classic) keeps its chat on itself when deleted, with no season on the couch to move it to, so the chat
   goes with it for good. (bp) Each of the game's actions reads the whole page (`deskGame`) before it starts; fine at the
   desk's size. (ah, from 1c) stays for 6b: a deleted game brought back has a seat with nobody signed in when its account went
   meanwhile. (bq) Find › Couches (Browse's Couches row, with Deleted) and a couch's Delete (new with decision 4, "built in 6"
   in The desk's pages) aren't in any part's row of The build lane's table: for 6c, or a part of their own after it.
   Check: `scripts/dev-test/check-desk-games.js` 116 PASS at 390 (zt_dg_ fixture, up and down; its games' codes start Z9W and
   it refuses to run if a real code does; every real account and league as it was): the list, filters, counts, sorts, paging,
   codes in every state, a page's facts, Archive and its Undo (and from Recent changes), Delete with the bell, Restore and its
   Undo, Delete for good; then the screens, from Browse to a deleted game's Restore, both holds, a seat's Open the game and a
   castaway's refused Remove. check-desk-cast, -bingo, -episode, -research, -setup, -inbox and -people, check-classic-admin
   ("all PASS"), check-new-settings, check-new-settling and check-bingo-bank ("ALL PASS") pass; unit tests 847
   (tests/new-nav.test.js adds Games and a game); check-new-desk without its rulebook section (a scratch copy, deleted) passed
   whole. check-desk-people's Open the game now expects the game's page.
   **As built, part 6b (2026-10-29):** **Seats** on a game's page (`src/new/desk/seats.tsx GameSeatsSection`, between Join code
   and History; read with the game, `src/lib/server/desk-seat-moves.ts gameSeats`): "4 in · 1 empty · 1 out"; signed in (face,
   name and tags, Active ..., the role, ⋯; "plays as <seat>" when the tables name the seat otherwise, as a seat linked before
   6b can be); empty (a dashed chair, nobody signed in, Link on the row: "Saved by jo's invite" from a pending
   `league_invites.player_id`, "Unlinked Oct 29" from the change line that left it empty, which Unlink and Link now write as
   `detail.emptied`, or "Its account was deleted"); Out of it (greyed: Left, Taken out Oct 29, by you, Removed, Account deleted:
   disabled seats, and the change log's member lines for a seat that went before a draft; "Their teams stay in the standings"
   while one does); and the note. **The seat's sheet** (`SeatSheet`, one sheet from the game and the person): from the game, the
   account's row (their page) and **Act as them** (step 1's, its sheet moved to `act.tsx`; not for you, another site admin,
   someone waiting or stopped); the role; **Link another account**; Unlink; from the person, **Open the game** ("The game's page:
   its seats, its code, its delete"); and **Take <name> out of <game>** last (tier 3, a hold: the app's `takeOut`, which gains
   an `inside` so the desk's History lines are written in its transaction; Unlink their account instead; the only
   Commissioner's dimmed). **Link an account** ("Who signs in to this seat?"; `GET /api/desk/games/[id]/accounts`): the couch's
   people without a seat in the game, most active first, then a search of every account by name, username or email, the couch's
   first, six at a time ("6 of 14: keep typing"); each line as mocked (On the couch · not in it; Not on it: they join it too;
   In it already: their own seat is left empty; Left or Taken out of it: Put back gives them their own seat; Waiting; Can't
   sign in; Signed in to it now), the last four not choosable; Player · Game admin · Commissioner (**Noticed q**), the seat that
   runs the game, or someone picked who runs it alone, staying Commissioner; what moves; tier 1 (`POST
   /api/desk/seats/[leagueId]/[userId] { link: { to, role } }` for a seat someone's in, `POST
   /api/desk/seats/[leagueId]/player/[playerId]` for an empty one): the seat takes their name in the tables (**Noticed o**, as an
   invite that hands a seat over names it), whoever was in it comes out and stays on the couch, they join the couch
   (`joinedLeague`) and follow the season, and they're told (`push-events.ts notifyDeskSeat`, under Invites and join
   requests); a line in Recent changes and History lines on the game (with the Undo), the person linked and anyone moved out.
   Its Undo puts the memberships, the seat's name and the one moved out back (with how they were on the couch), and takes the
   linked account off the couch if Link put them there; refused once the seat, their old seat or who's in either has changed.
   **Take out** (`{ takeOut: true }`): after a draft their seat stays, disabled and theirs to reclaim; before one it goes; they
   stay on the couch; its line in Recent changes keeps Backstage's 30-day restore, and the desk's Undo puts them back. **Put
   back** (`{ putBack: true }`, someone out, by account; a removed seat by its player id): Recent changes' `restoreMember` (now
   exported), at any time: their disabled seat reclaimed (preferred, with the line that took them out of it), else a new seat
   when theirs went before a draft, as the role they had; the line out marked undone; back on the couch; told. Its Undo takes
   them out again as they were (the line out standing again), refused once a draft has given a new seat a team. A deleted
   account: "Their account was deleted, so the seat can't be theirs again." **An empty seat's sheet**: who saved it and how it
   fills, Link an account, and **Remove <name>'s seat** (tier 3, a hold: disabled after a draft, gone before; "jo's invite still
   lets mo onto <couch>, as a new player"), with Undo, and Put the seat back from Out of it ("It waits for an account again").
   **The last-Commissioner guard** on Link (and its Undo), Take out and Put back's Undo (**Noticed p**, with 1c's on the role and
   Unlink). **Noticed ah, taken:** a game brought back without an account deleted meanwhile reads that seat as empty ("Its
   account was deleted"), with Link and Remove. A practice game or a public pool has no Link (said on the row; refused on the
   server; `src/lib/desk-seat-words.ts`). `PersonTags`, `useDebounced` and `Says` moved to `parts.tsx`. No migration.
   **Left behind or changed from classic, and why (decision 10):** classic's link (the memberships POST, an upsert) offered
   Player and Commissioner only and every account in one select; it kept the seat's name, told nobody, wrote no line, had no
   Undo, and refused a seat someone else was in. The desk adds Game admin, a search with the couch first, the seat's new name,
   the notice, the lines and Undo, and moves whoever was in it out (onto the couch). Classic's Remove player (the players
   DELETE: `disablePlayer` without the account id, before a draft too, no line, no way back: **Noticed n**) is the desk's Take
   out (reclaimable; the seat goes before a draft) and, for a seat with no account, Remove the seat. Classic's prune off the
   couch after a removal or unlink (`leftLeague`) stays behind: they stay on the couch, as the app's takeOut leaves them.
   Classic's league read (players and memberships) is the Seats read. `outPreview` isn't called: the game's read already says
   what the hold needs (drafted, their other games on the couch, run alone) and `takeOut` refuses the only Commissioner itself.
   Classic's routes stay until step 8. From the mock: an empty seat is named as the seat is ("mo's seat"); computer players are
   rows of their own ("Computer player · Normal · plays on its own", no actions: Backstage › Members adds and takes them out;
   the mock has none), counted in the aside ("· 2 computer"); someone taken out reads "Taken out of Outlast Oct 26: Put back
   ..." in Link's list (the mock had only "Left"); an account deleted reads "Account deleted" under Out of it.
   **Calls made here (Claude's, within the approved screens):** Put back's Undo takes them out as they were (the mock's undo of
   a snapshot), not as a new take-out; a game's History keeps showing the desk's line for the game's line it made, so a take out
   later put back reads undone, beside "Put fern back"; Link's list with no search shows up to 50 of the couch.
   `/code-review` found a link's Undo putting someone back in a seat removed meanwhile, Put back preferring a stale line over
   the disabled seat (and its Undo after a draft), a seat put back reading "Unlinked", the change-log read capped at 300 lines,
   Link's role for someone picked who runs the game alone and a pick a new search hid, Link reading the whole seats view to
   check one account, the solo refusal and `Says` written out three times and the undo-marking SQL in two files: all fixed.
   The three role-word tables (server, 1c's, the sheet's) stay one per file.
   **Noticed, not fixed (6b):** (br) a computer player's seat can't be linked from the desk, though an invite can hand one over
   (0042); Backstage › Members is where computer players are added and taken out; a later part, if it's wanted. (bs) A seat left
   empty by classic's unlink or before 6b has no date ("Nobody signed in"); only lines written from 6b on say when. (bt) Linking
   someone already in the game to another seat leaves their own seat empty under their name ("eli's seat"), which can read as
   if they're in it twice until it's linked or removed.
   Check: `scripts/dev-test/check-desk-seats.js` 101 PASS at 390 (zt_dt_ fixture, up and down, codes Z8T, every real account and
   league as it was, state included): the seats read and Link's list through the API; Link refused (waiting, stopped, out, no
   Commissioner left, a practice game), to an empty seat, moving someone out, from inside the game, each Undo (and refused once
   the old seat went); Take out after and before a draft; Put back and its Undo; Remove a seat after and before a draft; Noticed
   ah; then the screens: Seats, a seat's sheet, Link (the couch, a search, the summary, the toast's Undo), an empty seat's Link,
   the only Commissioner, someone picked who runs it alone, Take out's hold, someone out and Put back, Remove the seat, and the
   person page's sheet. check-desk-people, -games, -cast, -bingo, -episode, -research, -setup and -inbox, check-classic-admin
   ("all PASS"), check-new-settings, check-new-settling and check-bingo-bank ("ALL PASS") pass; unit tests 847; check-new-desk
   without its rulebook section (a scratch copy, deleted) passed whole (67).
   **As built, part 6c (2026-10-29):** **Open <game>** on a game's page (`src/new/desk/games.tsx OpenRow`, after the lower third
   and its Deleted or Nobody runs it panel, before Part of; `desk-games.ts gameOpen`, read with the game): "As its couch sees it,
   read-only · up to Episode 3, where you are" (the show's own episode word; "as far as you've watched" on nothing watched, "all of
   it: you see results straight away" with Hide scores off), "As it ended, read-only" for an ended or archived one, "You play it: it
   opens as you" with a seat (it opens the show space's Games tab on its couch, `setCouch`), and none for a deleted game or one on
   no couch or season (a practice game, a public pool: no couch to see it as). Opening it read-only (`POST /api/desk/games/[id]
   { open: true }`, `openReadOnly`) writes "Opened read-only" in the game's History (`admin_changes` action 'open', nothing to undo;
   its players aren't told, as Calls made in the design said), refused for a game you play or one deleted, then the app's show
   space opens on Games. **Read-only is the browser tab's** (`src/new/read-only.tsx`: sessionStorage, so the admin's other tabs play
   on as themselves): while the tab is on the game's show space, every request it makes to `/api` carries `x-gys-read-only: <game
   id>` (`src/lib/read-only.ts`; a fetch wrapper installed as the module loads). **The server:** `apiRoute` refuses every write
   that carries it (403, "Read-only: nothing here changes. To do it as someone, act as them from their seat"), before any route's
   own checks, which a site admin passes in most routes; only your own follow of the season (`/api/me/follows/`: the spoiler
   chip's Change) stays open. The reads take it as **a site admin's read scope over that couch's game, never a membership**
   (`src/lib/server/read-only.ts readOnlyFor`: a site admin, not someone acting as another; the game's couch and season must be
   the read's, else it's the viewer's own read as ever): `/space` has that one game and the couch's people, `/games` its table as
   anyone on the couch sees it (`game-view.ts gameView` with no seat: nobody "you", no moves, nothing to reveal), `/episodes` its
   episodes with nobody's own line and no Fill it in (`episode-view.ts episodesSeen` with no seat), each at your own spoiler mark
   (`season-games.ts gamesHere`'s `ro`, `readOnlyHere`). Stats and How it works read a couch's games whoever asks already
   (`requireCouch` lets a site admin in as a viewer), and the couch's chat and Tonight's jobs are never read (**Noticed r, taken**).
   **The show space read-only** (`show-space.tsx useShow`'s `readOnly`, the couch from the space read): under the **Read-only**
   caption plate ("Read-only · <game> on <couch>", Back to the desk; the compact show bar sticks under it, `--nd-top`), the back
   says Desk, the couch line "<couch> · <game>"; **Games** is the one game's table (no pills, nobody "you"), Rules and a person's
   team open as ever, and the foot says "Through Episode 3, where you are. 4 players · run by nina."; **Episodes** says "Scored in
   <game>", "Before <game> started" or "After <game> ended" on each row, "<game>: nothing to set before it airs" (or who's set)
   for a game still going, and an episode's page as the couch has it; **Cast** has no Your team; **Tonight and Chat** show the
   mock's panels ("Tonight is each player's own", "<couch>'s chat is theirs", each with Its seats, on the desk), and nothing reads
   the chat, not even its count; no dock, badges, Your moves, reveal, waivers or watch along. What would change something says
   Read-only before anything opens (a capture-phase guard over the show space's write controls, as the mock's DG_WRITE: Reveal,
   Rate it, Something wrong?, an answer, It's new, Fill in what happened, Looks right to us, Suggest a fix, Change the scoring, a
   call, a bingo square, typing; the ⋯ menu), and anything it misses is refused by the server with the same words. **Leaving the
   show space leaves read-only** (`ReadOnlyLayer` in the signed-in layout: Back to the desk, the show bar's Desk, Its seats, on
   the desk, the hub, or a reload on any other page), and the season's queries are dropped as it starts and ends. No migration.
   **Left behind or changed from classic, and why (decision 10):** classic had no read-only view: a site admin opened a league in
   classic as a synthetic all-access member (`requireLeagueRole`'s bypass), able to change anything in it without a line anywhere.
   The desk's look is the couch's (no "you", your own spoiler mark), changes nothing, and is a line in the game's History; acting
   for someone stays Act as them, from their seat (step 1). From the mock: the plate sits under pages pushed over the show (How it
   works, a stats page, an episode's page, each with its own back) rather than over them; the guard chip stays on Games, Episodes
   and Cast (Change moves your own mark), not on the Chat panel; a game on no couch (a practice game, a public pool) has no Open
   row (the mock's games are all on couches); the foot line says "Nothing counted yet, as far as you've watched." before any
   results.
   **Calls made here (Claude's, within the approved screens):** read-only is per tab, not a cookie (an admin's other tabs, and their
   own games, aren't refused); the header goes only from the game's own show space; a write is refused whatever route it's for, the
   desk's own too, and only your own follow is let through; an archived or ended game opens at your own mark like any other (the
   row says "As it ended"); opening it read-only twice writes two lines.
   `/code-review` found an unreadable league failing the whole read (now that game alone, as elsewhere), the Games tab and Episodes
   taking the first game rather than the one open, Episodes' "Scored in" past a span's end, the row's line with Hide scores off,
   "nothing to set" while loading and for a game that's over, the header outliving the show space on a page outside the
   signed-in layout, a copy of `gameView` and the couch's games read twice to keep one: all fixed. Its point that the guard's
   selector list must follow every new write control stands, by design (the mock's own list; the server's refusal backs it).
   **Noticed, not fixed (6c):** (bu) the plate sits under pushed pages (z-index 60 under their 70), so on How it works or an
   episode's page it's hidden until you go back; the page's own back says where you are. (bv) A new write control in the show
   space has to join the guard's list (`read-only.tsx WRITES`) to say Read-only before it opens; until then it says so only when
   the server refuses it. (bw) Find › Couches (Browse's Couches row, with Deleted) and a couch's Delete are mocked (desk.js
   `DK_LIST.couches`, desk-pages.js `dkCouchPage`) but weren't built here: part 6d's (bq). Couches have no `deleted_at` (0100), so
   it needs a migration (0428) and every couch read leaving a deleted couch out.
   Check: `scripts/dev-test/check-desk-readonly.js` 70 PASS at 390 (zt_ro_ fixture, up and down, codes Z7R, every real account and
   league as it was): how each game opens (read-only up to episode 3, as it ended, as you, not at all), only site admins, the
   History line and its refusals, the read scope through the API (/space, /games, /episodes; without the header, another couch,
   a player sending it), writes refused (a reveal, a desk archive, a player's) and your own follow not, no seat or couch row made;
   then the screens: the Open row, the plate, Games, Rules and a team, the ⋯ menu, Tonight and Chat (nothing reading the chat),
   Episodes and Reveal, an episode's page and its flag, Cast, each way out, the header on the reads and gone after, the archived
   and unopenable rows, and Mine opening as you. check-desk-seats, -games, -cast, -bingo, -episode, -research, -setup, -inbox and
   -people, check-classic-admin ("all PASS"), check-new-settings, check-new-settling, check-bingo-bank ("ALL PASS"), check-new-show,
   check-new-stats and check-new-chat pass; unit tests 847; check-new-desk without its rulebook section (a scratch copy, deleted)
   passed whole (67).
   **As built, part 6d (2026-10-29):** **Find › Couches** (`/desk/couches`: `routes.ts` DESK_PAGES gains `couches`,
   `paths.deskCouches`, a couch's page up to Couches; `src/new/desk/couches.tsx`, `desk-couches.ts deskCouches`, `GET
   /api/desk/couches`): a couch's name or who runs it (whoever has it and its games' Commissioners; a deleted one's from its
   line and the lines of the games it took); All · Nobody runs it · New this month (Eastern) · Deleted (the first, the one
   you're on and any with couches in it); Newest first, Most people, Name, A to Z; 25 at a time from the server, the search,
   filter and sort in the address. A row: "6 people · 2 games · run by priya", "its games have no Commissioner", or "run by
   priya · 1 nobody runs" under the Nobody runs it tag (a game people play with no Commissioner, as the Inbox's couch nobody
   runs); a couch with no games is run by whoever has it; a deleted one says "Deleted by quinn Oct 29 · until Nov 28" and
   carries Restore. **Browse's Couches row** ("34 couches · 2 nobody runs · 1 deleted, restorable") and **Find's search**
   (three couches, "Couch · ...", and All N couches matching; couches left `desk.ts find()`'s own rows). **A couch's page**
   (`pages.tsx CouchPage`, as mocked): the lower third Couch or Deleted with "Run by ..." or Nobody runs (some of) its games;
   its facts ("Started Oct 27 · 2 people · 3 games"); Deleted (by whom, until when, "Its games and chat come back with it",
   Restore <couch>) or Nobody runs its games with Hand them on; People; Games (a deleted couch's: the games it took, tagged
   Deleted); Settings (no Override while it's deleted); History (with Started by); and **Delete <couch>** last (decision 4:
   "Its 3 games go too · restorable for 30 days"). **Delete** (tier 3, a hold, "Restorable for 30 days"): "Its N people come
   off it and are told. They keep their accounts and their other couches.", "Its N games are deleted too: everyone's teams,
   picks and scores in them.", "Its chat and history go with it.", "Restorable for 30 days from Couches › Deleted". Held, it
   all happens in one transaction (`desk-couches.ts remove`). Each game gets the new design's soft delete
   (`end-game.ts deleteLeagueIn`: deleteLeague's body taken out so it runs in the couch's transaction), with its line in
   Recent changes ("<who> deleted <game> with <couch> (restorable for 30 days)") and on the desk ("Deleted with <couch>"),
   its chat staying on it. Its people's rows go into the couch's delete line (`admin_changes.after`, with the games and their
   batches) and off the couch. Then `couches.deleted_at` is set (**migration 0428**: `deleted_at`, `deleted_by`, a partial
   index, and the trigger below). It lands on Couches › Deleted with "Deleted <couch> and its 3 games · restore from here for
   30 days". Its people and anyone with a seat in its games hear once, not once a game (`push-events.ts notifyCouchDeleted`,
   under New on your couch, always in their bell). **Restore** (its page or its row; `bringBack`) brings back the couch, its
   people as they were (anyone whose account went meanwhile stays gone; `ensureOwner`) and the games it took (each one's delete
   line undone, `restoreGame`, a desk line "Restored with <couch>"). A game deleted before it, or one deleted for good
   meanwhile, stays as it is. The toast says "<couch> is back, with 3 games" with Undo: deleted again, nobody told twice,
   refused once anything has changed on it since (a game started, archived, deleted or brought back, someone joined, another
   change on its page). Only the newest Delete or Restore has Undo in History. A test couch's Delete is off ("A test couch
   goes from Settings › Test couch"). After 30 days a deleted couch goes for good the next time anyone deletes a game
   (`purgeDeleted`: its games first, then the couch with its chat, invites and plans by 0100's cascades).
   **Every couch read leaves a deleted couch out.** Its people are off it, so home, the hub, the couch switcher,
   `couchMembers`, a person's couches and everything that reads who's on a couch find nothing. The reads by id say so too:
   `requireCouch` 404s for everyone, a site admin included, so the couch's page, hub, chat, games and joins do. Its invite
   codes and its games' join codes lead nowhere (`couch-joins.ts couchOfCode`, `couchInvite`, `joinCouch`); `joinedLeague`
   and `healCouches` never put anyone on one; the desk's Inbox and a person's page leave it out. A game a deleted couch took
   comes back only with it: `restoreGame` refuses it alone and says why, its page says "It went with <couch>, and comes back
   with it from Couches › Deleted", and its row in Games says "deleted with <couch>" with no Restore. One deleted before its
   couch waits for the couch. **0428's trigger** (`leagues_on_a_live_couch`, from /code-review): the database refuses a live
   game on a deleted couch, whichever path makes it (Start a game is the engine lane's file). It reads the couch row with a
   lock, so a game started while the couch's Delete holds that row waits, then sees it deleted.
   **Left behind or changed from classic, and why (decision 10):** neither app had a couch delete (decision 4 made one).
   Classic only ever removed a couch when its last league went (`leagueDeleted`, with the hard league delete), with no way
   back and nobody told. The desk's is soft, restorable for 30 days, tells its people once, and takes its games through the
   new design's own delete. From the mock: a deleted couch's facts and Games count the games it took ("3 games"; the mock
   said "0 games" above three rows tagged Deleted); Browse's row adds "N deleted, restorable" as Games' does; a row with some
   of its games run says "run by priya · 1 nobody runs"; Override isn't offered on a deleted couch.
   **Calls made here (Claude's, within the approved screens):** one notice per person, not one per game; a game's chat stays
   on it rather than moving to the couch's conversation, so Restore brings it back where it was; its people's rows come off
   the couch (kept in its line) rather than a filter on every read, so nothing that reads who's on a couch can show it;
   "this month" is Eastern; Restore tells nobody (as a game's doesn't).
   `/code-review` found these, all fixed: the start-a-game race (the trigger); Deleted not searchable by who ran it; the
   deleted page's "0 games"; the people count differing between the list and the page when an account went meanwhile; an
   offset of Infinity failing the list (fixed in Games, People and Reports too); the actions reading the whole page first; a
   copied `plural`. Kept: the notice under New on your couch (always in the bell; the switch only stops the push, as for a
   game's delete); the filters that are redundant once its people are off it (belt and braces). Left: the `via` update a
   couch's delete makes for each game and then throws away (a few rows).
   **Noticed, not fixed (6d):** (bx) a few reads by couch id that come after their own gate (push-events' couch names,
   community-results' `results_by_anyone`, `ours.ts`, start-game.ts's name) don't check `deleted_at` themselves. Nothing
   reaches them for a deleted couch today: `requireCouch` refuses first, and the couch has nobody on it. (by) A game deleted
   before its couch takes two steps to bring back once the couch is deleted: Restore the couch, then the game. (bz) Someone
   whose couch was deleted sees it only in their bell; their home just leaves it out.
   Check: `scripts/dev-test/check-desk-couches.js` 115 PASS at 390 (zt_dh_ fixture, up and down, codes Z6H, every real account,
   league and couch as it was): the list, its filters, counts, sorts, paging and searches (by who ran a deleted one too), a
   couch's page, a test couch's Delete off; Delete (its games with it at one moment, one deleted before left alone, each
   game's line, its people off it and told once, not once a game), every read leaving it out (home, the couch's own read for
   a site admin too, its chat and hub, its invite and join codes, Find, the Inbox, a person's page), a game it took refused
   on its own, the trigger refusing a game started on it, the couch deleted 40 days ago gone for good; Restore, its Undo
   (nobody told twice; refused with a game archived since; only the newest undoable) and someone whose account went
   meanwhile; then the screens: Browse, the list searched and sorted, a couch's page, the hold, Couches › Deleted, the
   deleted page, a game it took, Restore and the toast's Undo, Restore from the row, Find's three and All N, a test couch.
   check-desk-readonly, -seats, -games, -cast, -bingo, -episode, -research, -setup, -inbox and -people, check-classic-admin
   ("all PASS"), check-new-settings, check-new-settling, check-bingo-bank ("ALL PASS"), check-new-couches, check-new-hub and
   check-new-chat pass; unit tests 847 (tests/new-nav.test.js adds Couches and a couch); check-new-desk without its rulebook
   section (a scratch copy, deleted) passed whole (67).
7. **Shows and site.** Delete a show (refused while games use it, saying which), restore an archived one, a season's details
   when adding it (number, status, wiki), the connector (wiki API, cast heading, research sites), art by URL with its framing;
   Settings: AI models, What's New preview, the rulebooks flag.
   **As mocked (2026-10-28, `desk-shows.js` and `desk-shows.css`, waiting for approval):** the show page's last rows are real.
   **Add a season** (a sheet): its number on a stepper (the next one; a number that's here refused inline), its status (Upcoming,
   Airing, Ended, each saying what it does; Upcoming first), its wiki page guessed from the last season's ("Survivor_51" →
   "Survivor_52", "check it opens"; a show with no wiki: the first page gives the connector its wiki), and What comes with it
   (last season's rulebook, the schedule from the listings or Setup, or for Airing "its Setup is next" and the Inbox, the cast
   from the wiki or our bot, art found on its own, results from sources that agree). Tier 1: it lands on the new season's page
   with Undo. **Its words** (a sheet): one person and many, one group and many, and the episode word ("Race"), with a live
   sample line; used everywhere and by the connector's cast heading. **The connector** (`/desk/s/<show>/connector`): Its wiki
   (the API, or "worked out from Survivor 51's page", and the cast heading, blank = the show's word for its people), Seasons it
   reads (each season's page, from its Setup; a dot on an unended season with none), Try it (step 5's Pull it again, which shows
   what it finds before anything is sent), and Research sites (a row each with ✕, Add a site keeping a pasted page's address,
   "Our usual" = the wiki, tvline.com and parade.com, Back to our usual three). A show with no wiki says its results come from
   research and links the latest season's Setup. **Art and photos** (`/desk/s/<show>/art`): the Header and the Cards, each drawn
   in the crops it's used in (its page and Up next; Your shows and the guide), each with Where it's from (TMDB on its own,
   Recommended; Choose one from TMDB, the desk's own; A link, checked as an image's address, previewed, "a link stops TMDB
   changing it", "only art we're allowed to show") and **Framing**: the whole image with the main crop's window over it, dragged
   (or arrow keys), zoom 1× to 2×, every crop redrawn as it moves, Back to the middle, Save (tier 1). Then Cast photos by season
   (each to its Cast page), Find art and photos again, and No art or photos (a switch). **Archive and restore**: Archive is
   offered by the show's Delete (refused while it has games: "Archive it instead", since its games play on; or the hold's
   alternative); an archived show leads with "Archived" and Restore, saying anyone following keeps it and that adding it by name
   meanwhile makes a new show; Shows › Archived rows carry Restore. **Delete**: refused while it has games, ended and deleted ones
   too (a deleted game is kept until it's gone for good), listed by season ("Survivor 51 · 16 games: 15 playing, 1 deleted");
   else a hold saying its seasons, followers (who lose it from their shows and the guide) and couches' chat go. Every page under a
   show ends with the show's Delete. **Settings**: Our bot becomes Autopilot, **Which AI our bot asks** (ChatGPT signed in,
   Recommended; Claude through its CLI; Gemini greyed: can't do the research prompts), **Reading a wiki** (the paid model that
   turns a season's page into its cast: Haiku 4.5 Recommended, Sonnet 5, Opus 5, with their prices; one setting for the desk) and
   **Paid research** (the seasons it's on for, each set on its own Research and the bot). **What's New**: Paused or On (step 1's),
   The latest with Preview (Oct 16's real items as a player sees them, under a "Preview · not marked seen" bar, Got it back to the
   sheet), the releases before it, and Drafts (none while it's paused); "only players on the classic design see it today". **The
   rulebooks flag**: Games on their rulebook › Every season at once › Check every league (writes nothing; each league on its own,
   rolled back), then the tally (39 score the same; 2 differ, each a link with why, and stay on built-in rules), "every season's
   rulebook is the one its research reads", and Switch on for every season (tier 2, Undo); on, Switch it off says leagues go back
   on built-in rules and Survivor 51, on by itself, stays. Not on the desk yet › Classic admin: "Everything it did is on the desk
   now · it goes with step 8". Mock scenarios: 19 (`shoot-mock-scenarios.js --group=dsv`).
   **What the build needs beyond classic** (Noticed s-z): desk routes over the show's columns with History lines and Undo:
   `archived` both ways; the delete with classic's guard counting every league with the show (deleted ones until they're gone),
   listed by season; a new season from the desk's own path (status Upcoming by default, `results_by` 'leagues', last season's
   rulebook, the art finder queued, the wiki page validated and the API worked out from it), its duplicate shown inline; the
   connector's three columns (`wiki_api_url` checked as an api.php, `cast_section_heading`, `research_domains` as hostnames, null =
   our usual), and wiki-sync working the API out from the season's page instead of falling back to Survivor's; framing per frame
   (`art_style` for the poster, and one for the backdrop: x, y, zoom; colour and strength not brought over) and a link per frame
   (`art_by_hand` no longer stopping the other frame); the words with `episode_term` editable and one source with the rulebook's;
   app settings for the bot's AI (sent with each ask) and the wiki model (default Haiku 4.5, replacing classic's per-browser
   choice, and sent by every pull); the newest release rendered as a preview, not marked seen; the flag's check as a desk job
   (the script's `check`, about a minute for 41 leagues, with progress) and on/off (the backfill's refusal shown; off keeping a
   season switched on by itself, `rulebook_live`, which the build confirms).
   **Calls made in the design (Claude's, 2026-10-28):** every page under a show ends with the show's Delete; Archive lives in
   Delete's sheets, not a row of its own (as a game's does); a new season starts Upcoming and on sources; Try it reuses Pull it
   again rather than a new dry run; framing is a window over the whole image per frame, zoom in four steps; Choose one from TMDB
   stays the desk's Choose art; the bot's AI, the wiki model and paid research are three rows; the flag goes on only after the
   check, and leagues that differ stay as they are (as the script does); What's New keeps step 1's Paused/On and Drafts, shows no
   invented drafts, and previews real releases.
   **Changes at approval (2026-10-28):** no wiki and no paid Claude research (decision 9). Add a season has no wiki page (What
   comes with it: the cast from our bot). The connector page keeps only **Research sites**, its new name: the sites our bot's
   prompt starts from, a row each with ✕, Add a site, and Back to our usual (what `domainsFor` gives: an old show's wiki host
   where it has one, tvline.com, parade.com); its wiki API, cast heading, Seasons it reads and Try it go. Settings keeps Which
   AI our bot asks and loses Reading a wiki and Paid research. What's New is data (decision 8): drafts are written and
   published on the desk, and its drafts editor is mocked with the user before part 7c.
   **As built, part 7a (2026-10-29):** **a show on the desk** (`src/lib/server/desk-shows.ts`, moved out of `desk-couches.ts`
   with its old actions; `src/new/desk/shows.tsx`, out of `pages.tsx`; `GET`, `POST` and `DELETE /api/desk/shows/[id]`).
   **Find › Shows** (`/desk/shows`, `GET /api/desk/shows`): a show's name; All · Airing · Not a game yet · Added by name (the
   Inbox's: by name, not looked at) · Archived with counts; Name, A to Z or Most games; 25 at a time, the search, filter and
   sort in the address. A row: its poster, "A game · Season 51 airing · 14 games", "Not a game yet · Season 2 · 3 watching",
   or "Archived Oct 20 · out of everyone's search" with Restore. **Browse's Shows row** ("38 shows · 12 airing · 1 added by
   name") replaced Find's Airing now (1a kept it until this list), and **Find's search** shows three shows (archived ones too,
   tagged, as find() did and the mock's search does) and All N; shows left `desk.ts find()`'s rows, and New show's "Here
   already" reads the Shows list. **A show's page**, as mocked: its lower third (A game, Not a game yet, Added by name or
   Archived; "A competition · 3 seasons here", "Season 2 · 3 watching"); Archived (since when, anyone following keeps it, its
   games play on, adding it by name makes a new show) with Restore, or Added by name with Looks fine and Archive; **Seasons**
   (its number in a square, "Season 51" or a sport's "2026 season", "Airing · no schedule yet · 1 game" with the dot, each to
   its season's page) and **Add a season**; About the show: **Research sites** and **Its words**; its art as it was (7b gives it
   a page and the row); History; and **the show's Delete**, last. **Add a season** (a sheet, tier 1): its number on a stepper
   (the next one; "Season 52 is here already" inline and the button off), Upcoming · Airing · Ended with what each does,
   Upcoming first, and What comes with it (last season's rulebook, or Make it a game for a show that isn't one; the schedule
   from the listings or Setup, or for Airing its Setup next and the Inbox; the cast from our bot; art on its own; results
   from sources that agree). It lands on the new season's page, "Added Survivor 52 · next: its cast", with Undo (back to the
   show, the season gone again; refused once anything's on it: a game, a follow, its cast, an answer). Noticed s: it's
   `results_by` 'leagues', a bad status is refused (400), never turned into Ended; a set-up show's plays by last season's
   rulebook (`ensureSeasonRulebook`, in the same transaction); its art is looked for after the answer; lines on the show and
   the season. New show's `{ action: "season" }` still adds the next one, Upcoming. **Its words** (a sheet): one person and
   many, one group and many, and the episode word, with the live sample ("3 castaways in 2 tribes · Episode 6 is tonight",
   from its newest season with a cast) and a link to its newest season's rulebook. **Migration 0429**: `shows.castaway_plural`
   and `tribe_plural` (null works it out, as before), and a trigger that clears a plural when its singular changes, whatever
   path writes it (Make it a game, the listings job, classic's show page); it adds behaviour to an existing table, so it's
   rehearsed with the step's merge. `showWords` takes the people's plural (the show space, rosters, recaps, pushes, the desk's
   Cast words read it). **Noticed y**, checked first: neither wrote the other (only Make it a game copied the rulebook's words
   onto the show, once, at set-up; the rulebook editor's word sheet writes the rulebook alone). Now one source: saving Its
   words writes the show's words, then each of its seasons' rulebooks' (its cast word for one and many, its group's, its
   "parts" for an episode word other than Episode) as a fix to the words alone: a new version, pushed to the leagues
   following it and the couches' own copies as any fix, but no answer read again, since words score nothing differently. A
   rulebook that won't take them is said in the toast, not a failed save. Undo puts both back. **Research sites**
   (`/desk/show/<id>/sites`, a page under the show, depth 3; the connector page's only section since approval): a row each
   with where it's from (Its wiki, One of our usual, Added for <show>) and ✕, Add a site (a pasted page kept as its hostname,
   "Kept as realitytea.com."; a duplicate or a non-site refused), Back to our usual (two or three), tier 1 with Undo each;
   `research_domains` as hostnames, null = our usual, a list equal to our usual stored as null, the last one off is our
   usual. What the desk shows as our usual mirrors `episode-research.js domainsFor` (`src/lib/desk-show-sites.ts`; the
   check proves it against research's own context each time). **Archive and Restore** (tier 1, Undo): Archive from the
   added-by-name panel and from the Delete's two sheets (Archive it instead); an archived show leads with Archived and
   Restore, and its row in Shows › Archived carries Restore. **Noticed v**, as the mock says: adding an archived show by name
   meanwhile makes a new show, and its page says so; add-show's matches are unchanged. **The show's Delete** (`DELETE
   /api/desk/shows/[id]`; decision 4): refused while it has games (Noticed u: every league with the show, by its slug or a
   pool or practice game on one of its seasons; ended, archived and deleted ones too until a deleted one's 30 days are up; its
   public pools and practice games are its own and go with it), the sheet listing them by season ("ZT Isle 2 · 2 games: 1
   playing, 1 deleted", one game as itself) with Archive it instead; else a hold: its seasons go with every episode, cast and
   result, its pools and practice games, the people following it lose it from their shows and the guide with any watch along
   planned, couches' chat about it goes too, Archive it instead as the alternative. Held: gone in one transaction (the
   cascades take seasons, follows, chat, plans, research, rulebooks), with a stored `made-` format only it played, a line kept
   in History ("Deleted X, with 2 seasons and 1 practice game"), landing on Shows. Every page under a show (its Research
   sites) ends with the show's Delete.
   **Left behind or changed from classic, and why (decision 10):** classic's Add a season's wiki page and the API worked out
   from it, its cast size and dates (decision 9; the cast is its own, the schedule Setup's); its `results_by` 'admin' and its
   bad status turned into Completed (Noticed s). Classic's connector (wiki API, cast heading) and its format picker stay with
   classic (decisions 9 and 10: rulebooks replace formats); terms through the format went with them. Classic's delete counted
   leagues by `settings.showId` only and deleted with no word to anyone following (Noticed u). Calls made here (Claude's,
   within the approved screens): season rows open the season's page (as mocked), and a show that isn't a game keeps a small
   "Make it a game" link under its seasons into New show (the old rows' only way there); Find's chips count unsearched, as
   Couches' and Games'; the words sheet's sample says "is tonight" as mocked; the group's plural is the desk's (its Cast
   page's words): the app never pluralises a group word, so the season header doesn't carry it.
   `/code-review` found these, all fixed: New show's "Here already" reading Find's show rows (it reads Shows' list now);
   a show's stored kind hidden until it's a game (New show starts from it); a plural outliving its singular when Make it a
   game, the listings job or classic rewrote it (0429's trigger); the words missing the app's "Cast"/"Crew" rule (they're
   `showWords`' now); a rulebook failing part way turning a saved change into an error (each one on its own, said in the
   toast); Looks fine's Undo un-archiving a show archived since (it takes back the look alone; an old line from an archive
   before 7a still puts it back); Find no longer finding an archived show; the chips' counts reading every show's facts; the
   words row's hand-made plural ("matchs"); the group's plural carried in the season header with nothing reading it. The
   rulebook editor's word sheet said its words were used everywhere and found the cast on a wiki: it says what they're for
   now, and that the show's Its words sets them.
   **Noticed, not fixed (7a):** (ca) Add a show from the TV listings still finds an archived show by its TVmaze id
   (`add-show.ts showForListing` doesn't look at `archived`), so following it from the listings follows the archived show,
   which stays out of everyone's search; only by name does it make a new one (as the page says). For whoever next touches
   Add a show. (cb) The rulebook editor's word sheet writes that season's rulebook alone, and the show's Its words overwrites
   it on its next save (one source: the show's); a rulebook's own word change doesn't reach the show. (cc) Its words reaches
   couches' own copies as any fix, so their Recent changes say "A fix to the show's rulebook reached the couch's own" for a
   word change (`ours.ts reachCopies`). (cd) The group's plural is the desk's alone: no app screen pluralises a group word.
   (ce) The words' sample says "is tonight" whatever night it is, as mocked.
   Check: `scripts/dev-test/check-desk-shows.js` 126 PASS at 390 (zt_dv_ fixture, up and down, codes Z7S, every real
   account, league and show as it was): a player refused; Find › Shows' filters, counts, search, paging and sorts, a row's
   season, games and who's watching, Browse's line and Find's three (an archived one too); a show's page (its seasons'
   games and schedules, its words and their sample, its sites, its Delete's games by season); Add a season (a number that's
   here, a bad status refused, Airing in the Inbox, sources that agree, last season's rulebook, both History lines, Undo, Undo
   refused once followed; New show's next one, Upcoming); its words on the show and its season's rulebook, the Cast page
   reading them, Undo, the trigger, Cast's words; research sites against research's own context (`resolveSeasonResearchContext`)
   at each step; Archive and Restore with Undo, out of the catalog, Looks fine's Undo after an Archive, adding an archived
   show by name; the Delete refused, then a show with nothing in the way gone with its follows and practice game, a line in
   History, and one whose games were deleted 40 days ago gone with them; then the screens: Browse, Shows searched,
   Archived's Restore and Undo, a show's page, Add a season (a number that's here; added, Undo back to the show), Its words,
   Research sites (a pasted page, a site off, back to our usual), the Delete refused, Archive it instead, Restore, the hold,
   New show's Here already, Find's three and All N. check-desk-couches, -readonly, -seats, -games, -cast, -bingo, -episode,
   -research, -setup, -inbox and -people, check-classic-admin ("all PASS"), check-new-settings, check-new-settling,
   check-bingo-bank ("ALL PASS"), check-new-show, check-new-stats and check-new-library pass; unit tests 851 (with
   tests/desk-show-sites.test.js, show-words' plural, new-nav's Shows); check-new-desk without its rulebook section (a
   scratch copy, deleted) passed whole (67).
   **As built, part 7b (2026-10-29):** **a show's Art and photos** (`/desk/show/<id>/art`, `src/new/desk/art.tsx`; its
   changes `src/lib/server/desk-show-art.ts`, the finder's columns `show-art.ts`, the framing `src/lib/art-frame.ts`), as
   mocked: its lower third (Art, Off or No art; "Found on its own", "Its header from a link", "Chosen from TMDB"); **Header**
   (On its own page) and **Cards** (Posters and the guide), each drawn in its two crops at the mock's shapes (Its page 2.1 and
   Up next 1.08; Your shows 0.707 and The guide 1.75), with **Where it's from** and **Framing**; **Cast photos** (the newest
   three seasons, "3 of 3 have photos · TMDB and TVmaze", Wikipedia for a sport, each to its Cast page); **Find art and
   photos again** (a History line, no Undo: it only fills what's missing); **Switch it off** (No art or photos); History; the
   show's Delete, last (7a's ShowDeleteRow). The show page's About row "Art and photos" ("From TMDB, on its own · header,
   cards and cast photos", "Header from a link · cards from TMDB", "Off: its name on a plain card everywhere") replaced the
   inline Art section. **Where it's from** (a sheet per frame): TMDB, on its own (Recommended; only when something in the
   frame is held by hand does it change anything: a link goes, a poster or backdrop chosen from TMDB stays until TMDB's own
   pick replaces it, so a TMDB that doesn't answer never empties a frame); Choose one from TMDB (the desk's Choose art as
   built, now per frame: the header's backdrops, or the cards' season and show posters); A link (the address checked as an
   https image address, then loaded out of sight: only one that opens as an image is offered, previewed in both crops with
   "Loaded: host · 1200 × 675"; else the mock's "That doesn't look like an image's address"; "A link stops TMDB changing
   it", "Only art we're allowed to show"). **Framing** (a sheet per frame): the whole image (its own shape, read as it loads)
   with the main crop's window over it, dragged (the window's centre follows the finger) or moved 4% with the arrow keys
   (a slider with its value said), zoom 1×, 1.25×, 1.5×, 2×, every crop redrawn as it moves, Back to the middle, Save the
   framing. Each change is tier 1: a line in the show's History and Undo, which puts every art column back (a snapshot of
   the show's and its seasons'), refused once the art has changed since; Undo of No art or photos turns them back on as they
   were and looks for the photos again. **Noticed x**, all of it: **migration 0430** (three additive columns and a backfill,
   rehearsed with the merge): `backdrop_by_hand` (the header held on its own: `art_by_hand` is the poster's alone now, so a
   link on the header leaves the cards on TMDB, and the other way round; the backfill keeps a by-hand show's existing
   backdrop held), `art_link` (the cards are a link: it shows on every season's cards over their own posters, as a cards
   link must; classic's pasted posters stay what they were, the fallback for a season with no poster of its own), and
   `backdrop_style` (the header's framing). The cards' framing is in `art_style` under `frame` ({ x, y, zoom, url }), beside
   classic's own x, y and zoom (classic's framing of the show's poster, kept and still drawn wherever that poster is) and its
   colour and strength. **A framing is bound to the image it was set on** (its `url`): a new image (TMDB's better one, one
   chosen, a link) starts unframed, so a framing never lands on a picture nobody framed; classic's top-level framing, with no
   image, frames the show's own poster as classic drew it. **It reaches every reader** by riding on the image's address as
   a fragment (`…/poster.jpg#frame=64,50,1.25`, which a browser never sends): the server adds it where it hands out a show's
   art (`show-space.ts seasonHeaders`, the catalog `way-in.ts`), so every screen that passes the address on carries it, the
   off-limits `start-game.ts` included, and `ShowArt` (`src/new/ui/show-bar.tsx`) draws it the way the mock's svImg does
   (object-position, and a scale from that point inside a box of its own so a zoom never spills); the landing's tiles read it
   too. The cards' art is one SQL expression everywhere now (`art-sql.ts cardArtSql`: off, the link, the season's own, the
   show's), in the show space, the catalog, the bell, and the desk's game and rulebook pages. **Up next** draws the header
   frame (the backdrop, else the cards'), as the mock's crops say, so the art that grows into the show bar is the same
   image. Classic reads `art_style` through `classicArtStyle` on `/api/shows` and `/api/shows/art` (the desk's framing in
   place of classic's only when the desk framed the show's own poster); classic's show page keeps the desk's framing when it
   saves its own, and its pasted poster resets `art_link`. Checks reach TMDB through a stand-in (`withTmdbFor`, the
   `x-gys-tmdb` header under `next dev`, as listings and GIFs have; `scripts/dev-test/fake-tmdb.js`).
   **Left behind or changed from classic, and why (decision 10):** classic's colour and strength (not brought over, as
   planned: classic still reads them, and the desk never writes them); classic's continuous zoom (1 to 3) and its one framing
   for the poster as drawn in classic's header (the desk frames each frame in the crops it's used in, four zooms); classic's
   pasted URL as the only link (a link per frame now, the cards' over every season); the old single "Back to automatic"
   (TMDB, on its own per frame). Calls made here (Claude's, within the approved screens): the header's unframed default is
   the show bar's own (50% across, 30% down), so the desk shows what the app draws, and "its framing starts a little above
   the middle" for a header link; a header with no backdrop shows the cards' art in its crops with a line saying so, and no
   Framing row (nothing of its own to frame); the source line says "Chosen from TMDB" and "TVmaze's poster until TMDB has
   one" where the mock had only TMDB or a link; a link is checked by loading it rather than by its extension alone (an
   image address with none still works); the catalog's unframed tiles are centred (they were 50% 40%), as the desk shows.
   `/code-review` found these, all fixed: the header's TMDB, on its own emptying it when TMDB didn't answer; classic's paste
   leaving `art_link` on; classic's save wiping the desk's framing; framing a season's poster deleting classic's framing of
   the show's poster (hence `frame`); the About row calling a chosen frame "on its own"; a show id that isn't one answering
   500; the link check written twice (now `art-frame.ts cleanArtLink`).
   **Noticed, not fixed (7b):** (cf) An art change's Undo snapshot is taken outside a lock: a finder write between a change
   and its Undo (findArtLater after Add a season, the daily sweep) makes that Undo refused as "changed since", and one landing
   mid-change would be put back with it. Rare; for whoever next touches show-art.ts. (cg) The cards' framing is per image:
   framing the newest season's poster leaves the older seasons' own posters unframed, and a new season starts unframed (the
   desk frames the newest one). (ch) Readers that draw a plain img leave the framing out: the couch hub's 22px show chip,
   the bell's thumbnails, the desk's own list thumbnails, and push icons (the OS draws those); they're small squares. (ci)
   Classic's framing of the show's own poster now reaches the new design wherever that poster is drawn (a season with no
   poster of its own, or a cards link); none of production's seasons draws it today (each has its own poster). (cj)
   Classic's show page still edits the top-level framing and its preview shows classic's, not the desk's; it goes at step 8.
   Check: `scripts/dev-test/check-desk-art.js` 100 PASS at 390 (zt_da_ fixture, up and down, code Z7A, TMDB's stand-in and
   the browser's images served by the check, every real account, league and show's art as it was): a player refused; each
   frame's url, source, framing and hold, cast photos by season; a link per frame (refused when not https, the other frame
   left alone, the finder still filling it, every season's cards and the catalog reading the cards' link); framing per frame
   (refused on an image that changed, a zoom off the four refused, kept with its image, carried by the season's header and
   the catalog, classic reading its own only); TMDB, on its own (a link going, refused when on its own); Choose art per
   frame; a season's poster framed beside classic's framing of the show's poster; Undo, refused once moved on; No art or
   photos (found photos down, every reader empty, nothing set while off, Undo back on and photos found again); then the
   screens: the About row, the art page (crops, rows, Cast photos to each Cast page, Delete last), A link (a page's address,
   then an image's, loaded and previewed, used), Framing (zoomed and dragged, the arrow keys, Up next's crop zoomed, Back to
   the middle, saved), Choose one from TMDB, TMDB on its own, the player's show bar drawing the header's framing (the link,
   46% 46%, 1.25×), the switch off and back, a show with nothing. check-show-art-ui (its desk part through the new page),
   check-desk-shows, -couches, -readonly, -seats, -games, -cast, -bingo, -episode, -research, -setup, -inbox and -people,
   check-classic-admin ("all PASS"), check-new-settings, check-new-settling, check-bingo-bank ("ALL PASS"), check-new-hub,
   check-new-guide and check-header-art pass; unit tests 859 (tests/art-frame.test.js); check-new-desk without its rulebook
   section (a scratch copy, deleted) passed whole.
   **As built, part 7c (2026-10-29):** **the desk's Settings, part one** (no migration). **Which AI our bot asks** (Settings ›
   Our bot, "What it looks up on its own, and with which AI."; its row "ChatGPT, signed in · free to us" or "Claude, through
   its CLI · free to us" with the dot off Recommended): as mocked (svBotSheet), ChatGPT signed in (Recommended), Claude, and
   Gemini greyed (`aria-disabled`; a tap says it can't do the research prompts yet), the line of what it asks for, Reset to
   recommended as every Settings sheet has; tier 1, "Our bot asks Claude from its next question" with Undo and a line in
   Settings history (`desk.ts setDeskSetting` `botAi`, `restoreSetting` `bot_ai`). It's `app_settings 'bot_ai'`, read by
   `ask-bot.ts askBot` with each ask (`botProvider`, one small row) and sent as the bot's `provider`; a caller may name one
   (`BotChoice.provider`, additive); askBot's error names the AI asked ("Claude didn't answer"). Every ask goes through askBot,
   so the research runner (`db/bot-research.js`, its exports untouched: the cron route and the desk hand it askBot), Ask our bot
   for a cast, One tap, Make it a game, trivia and bingo all follow it. **The rulebooks flag** (Settings › Rulebooks, its row
   "Every season · N leagues" when on; `src/new/desk/settings-flag.tsx`; `GET` and `POST /api/desk/settings/rulebooks`,
   `src/lib/server/desk-rulebooks-flag.ts`): as mocked (svRbSheet), the seasons on their rulebook by themselves ("On by itself
   · 14 games play by its rulebook"), then Every season at once. **Check every league** is a desk job: the script's check,
   moved to `db/rulebooks-flag.js` (`scripts/rulebooks-flag.js` is its command line now, its exports kept), writes nothing,
   each league and season in its own rolled-back transaction, run after the request answers (`after()`, the route's 300 s),
   its progress and then its tally in `app_settings 'rulebooks_check'`, polled each second while it runs (a bar, "N of M");
   one at a time; a check whose heartbeat is 90 s old is said to have stopped and a new one may start. **The tally**: the
   games that score exactly the same, and the ones that stay on their show's built-in rules, each a link to its game with its
   season and why (`src/lib/rulebooks-flag-words.ts`: "No show picked", "It plays by rules of its own, not its season's
   rulebook"); "every season's rulebook is the one its research reads". **Switch on for every season** (tier 2: the tally is
   what moves) needs a check that passed in the last 15 minutes (an older one says so, with Check again); it runs the backfill
   first, whose refusal is said ("Not switched on: <season>'s rulebook isn't the one its research reads"), then every league;
   "Rulebooks for every season: on (N leagues; M stayed on built-in rules)" in Settings history, with Undo. **On, Switch it
   off**: every league back on its show's built-in rules, "<season>, on by itself, stays on" and "A couch that made the rules
   its own keeps them"; its History line names the seasons that stayed on; Undo switches it on again, which needs a passing
   check too. **Confirmed, and fixed:** the script's off passed `on: false` to every league, so it took Survivor 51's leagues
   (on by themselves, `rulebook_live`) and a couch's own copy (Make it ours) off their rulebook too; now each league is
   walked as its own season decides (`syncLeagueRow` with no `on`), on and off. Classic admin's row: "Only What's New's
   preview is left there · it goes with step 8".
   **Left behind from classic, and why (decision 10):** classic's two per-browser AI models (wiki reads, paid research) and its
   Site page's Paid AI switch: no wiki and no paid research (decision 9), so Settings has no Reading a wiki or Paid research
   rows (Changes at approval). The flag was server-only in both; now it's the desk's. Classic's What's New preview stays in
   classic (part 7d, What's New as data, is postponed). **Calls made here (Claude's, within the approved screens):** the mock's "2 score differently: they
   stay on built-in rules" is what the real check leaves on built-in rules (`syncLeagueRulebook`'s mismatch or reason); a game
   whose rulebook would be written but score differently can't be kept off once the flag is on, so it keeps the switch off,
   listed under "Would score differently" (a Differs tag, why, Check again), as is a season whose research reads something
   else: the mock had no such case, and the script exits 1 on it. Deleted games aren't in the tally, but the switch walks them,
   so a restored one plays by what the flag says. One switch at a time (an advisory lock); a switch on that fails partway is
   put back off. The off sheet says what stays on, where the mock's on-sheet promised every league went back. The ask-AI
   route (a commissioner's Ask ChatGPT for me) follows the setting too: it's one bot. `/code-review` found these, all fixed: an
   Undo switching it on without a check; deleted games in the tally; a passed check too old to switch on from disappearing
   without a word; a failed switch on left half on; two switches at once; "Switching it off puts every league back" no longer
   true; a fourth copy of the list joiner; the check's guard missing real leagues' rulebook ids and timestamps.
   **Noticed, not fixed (7c):** (ck) Copy that names ChatGPT is wrong while Claude is chosen: players' "Ask ChatGPT for me" and
   "ChatGPT is searching the web" (`backstage/ask-ai.tsx`, `results.tsx`), One tap's and the recaps', rosters' and Make it a
   game's own "ChatGPT didn't answer" (`results-ways.ts:179`, `episode-recaps.ts:211`, `rosters.ts:354`, `make-game.ts:513`),
   the desk's "Asking ChatGPT" (`research.tsx`) and "ChatGPT reads the cast" (`cast.tsx`). Player-facing words: a copy pass
   with the user, or "our bot" throughout. (cl) Claude goes through the Claude Code CLI on the bot's computer: the home PC's
   bot has it; whether production's VM bot has the CLI signed in isn't checked. Choosing Claude in production without it fails
   every ask on the VM (each falls to the next bot, then fails); check the VM first (the user's). (cm) The switch walks every
   league inside its request (300 s): production's ~41 take seconds, but hundreds would need the check's job pattern. (cn) A
   check that passed lets the switch go on for 15 minutes; a league whose rules change inside that window isn't checked again
   (`syncLeagueRulebook` still refuses a legacy rulebook that isn't what it plays by, so only a non-legacy one could slip).
   Check: `scripts/dev-test/check-desk-settings.js` 50 PASS at 390 (zt_dz_ fixture, up and down, code Z5Q, the stand-in bot;
   it refuses to run with the flag on or the bot off ChatGPT, puts real leagues' timestamps back, and checks every real
   league's state, rulebook and timestamp and every real rulebook as they were): a player refused; ChatGPT by default, Gemini
   refused, Claude set with its History line, the next ask (a season's Cast › Ask our bot) asking Claude, Undo and the next
   asking ChatGPT, a second Undo refused; the flag: Switch on refused before a check, the check started, a second refused,
   finished with every league and season, the tally (ZT DZ Loose with why, the deleted game left out, nothing differing),
   nothing written; Switch on (every game but ZT DZ Loose, the deleted one walked too), its History line, refused again; Switch
   it off (ZT DZ Isle 1, on by itself, keeping its game on), its History line; Undo both ways and a refused one; a check that
   found a game scoring differently keeping it off; a stalled check said and replaced; then the screens: Settings' Our bot
   rows, Which AI our bot asks (Gemini greyed and saying why, Claude chosen, the toast's Undo), Games on their rulebook (Check
   every league, the tally and its link, Switch on, Switch it off naming the season that stays), a held tally. check-desk-art,
   -shows, -couches, -readonly, -seats, -games, -cast, -bingo, -episode, -research, -setup, -inbox and -people,
   check-classic-admin ("all PASS"), check-new-settings, check-new-settling, check-bingo-bank ("ALL PASS"), check-show-art-ui,
   check-rulebook-flag and `scripts/rulebooks-flag.js check` pass; unit tests 863 (tests/rulebooks-flag-words.test.js);
   check-new-desk without its rulebook section (a scratch copy, deleted) passed whole.
8. **Classic's admin retires**: `/admin` sends a site admin to the desk; classic's admin pages and `src/lib/admin-store.ts` go.
   So does what only classic used, each checked unused first (decision 9): the wiki read (classic's Pull cast, `db/wiki-sync.js`'s
   pull and its nightly `.github/workflows/wiki-sync.yml`) and paid Claude research's hourly `.github/workflows/auto-research.yml`.
   `termsFor` and `stageSeasonCast` stay (episode research and the tapes recorder call them), moved if their file goes.
   HOSTING.md loses the two jobs. What's New stays code while it's postponed (decision 8): classic's admin preview of it goes
   with the rest, and players on the classic design still get its popup from `src/lib/whats-new.ts`; the desk's Classic admin
   row ("Only What's New's preview is left there") goes too.
   **As built, part 8a (2026-10-29, b4bfb4b6): the pages and routes.** **/admin sends a site admin to the desk**:
   `src/app/admin/[[...path]]/route.ts`, a route (a real 307: as a page its redirect streamed inside classic's AuthGate,
   which never mounted it), maps each of classic's addresses to the desk's page for the same thing: users and a user to Find ›
   People and their page, leagues and a league to Find › Games and its page, shows, a show and its settings to Find › Shows and
   its page, New show to `/desk/new`, a season to its page, its setup and cast to theirs, its rules to the season's page, an
   episode and its review to the episode's page, reports to Find › Reports, site to Settings, formats and anything else to the
   Inbox. Signed out, it's sign in with `next` back to the same address; a player (and a site admin acting as someone) goes
   home, as classic's gate only ever refused them. `/reports` still goes through it. **Gone:** classic's 19 pages and their
   layout, 20 of its 24 components (four moved, below), `src/lib/admin-store.ts`, `admin-season.ts`, `paid-ai-store.ts` and `ai-cost.ts` (the
   per-browser AI models: decision 9), every `/api/admin/*` route (36; nothing in the app, a cron, the VM or the tapes called
   one: the VM's tick calls `/api/cron/bot-research`, HOSTING.md; Ask ChatGPT for me calls `/api/ask-ai`, never `/api/admin/ask-ai`, which doesn't exist), their 54 `api.admin*`
   calls and six types only they used, `src/lib/server/season-rule-changes.ts` and `wiki-url.ts` (only those routes read
   them), and the desk's Settings › Not on the desk yet › Classic admin row. **Kept, moved:** the pieces the classic design's
   own flows share: `admin-ui.tsx` to `src/components/ui/act-ui.tsx` (ActButton, Step, StickyBar, Notice, CopyButton and the
   rest the create-league wizard, episode results, the scoreboard's lines and the tour use; the admin page frame, its shows
   query and its date helpers went), `format-research-panel`, `format-review-screen` and `format-rules-view` to
   `src/components/formats/` (the wizard's My show isn't here and League Settings' rules), now self-serve only: their admin
   defaults, the switch-an-existing-show sheet and the props nobody passes went; `admin-users.ts` to `last-active.ts` (the desk's
   `LAST_ACTIVE`); TIME_ZONES into `desk-dates.ts`, its only reader. The classic design's sidebar and More sheet's Admin rows open
   `/desk` (the To do dot went: it read classic's queries, and the new design has no badge either). **Act as them is the only
   way to an hour as someone** (Noticed ae, taken): Settings › Test couch's switches use the desk's route
   (`api.actAsTestPlayer`, `{ from: "test-couch" }`), so their hours are in History too ("from the test couch"), and their
   Return still goes home. **Signing out while acting** (Noticed af, taken): `logOut` and `logOutTo` end the hour first
   (`DELETE /api/desk/acting?ifActing`, which answers `{ back: null }` when there's none) and then sign you out, so no admin
   session waits in the admin_session cookie.
   **Left behind, and why (decision 10):** classic's season rule check (its Rules page: a chat's answer about a season's rule
   changes, approved into every league) has no desk page and goes: rulebooks replace formats and their changes (decisions 9-10,
   Not brought over), and what's approved already still reaches leagues (`db/season-rule-changes.js` stays, read by the games).
   Classic's formats pages and Approve onto an existing show go the same way. Classic's Run now in the request (bb), its hard
   league delete (m), Remove player (n), unlink without the guard (p), the link sheet (q), its cast page and approve (bk), its
   bingo paste (`pasted_by` empty) and Show it again, the Reports delete (ap), the season status PATCH and its prune (aw), the
   top-level framing and preview, the step 0 dark class after the Classic admin link, and Run now's "up to two minutes" (e):
   all gone with their pages, so every one of those Noticed items closes. (bm), the source column on `season_cast_changes`,
   stays Noticed: classic's cast writes are gone, so every row is the desk's Override or a send; a column when the castaway's
   page needs to say which. No migration.
   **Checks:** `check-classic-admin.js` turned round (every old address lands on its desk page signed in as a site admin, a
   player goes home, signed out goes to sign in and back, the `/api/admin` routes 404, no Classic admin row, and signing out
   while acting leaves nobody signed in). `check-tribe-swap.js` moved to the desk's routes (an episode's question, Paste an
   answer, Accept all, Clear everything). `check-ask-ai.js` moved to the wizard's My show isn't here (the same Ask an AI).
   `check-bot-clock.js` lost `--ui` and `check-bot-research.js` its screens (classic's Setup and episode pages: the desk's are
   check-desk-research's and -episode's). `check-rules-tripwire.js` went with the Rules page. `check-desk-people.js` no longer
   expects Settings' Not on the desk yet. Not yet: `check-bingo-bank.js` still calls classic's bingo and bot-research routes
   (part 8b moves it onto the desk's, and then `bingo-bank.ts`'s `saveBingoBank` and `adminFlagSquare`, unused since, go).

## The build lane (planned 2026-10-28)

Steps 1-7 are built in a lane of their own ([PARALLEL-SESSIONS.md](PARALLEL-SESSIONS.md)), one session a part, in this plan's
order, each to the approved mock and its step's Changes at approval.

- **The lane:** `desk`, folder `C:\Users\conor\rfl-desk`, branch `desk` (cut from master at 76e55f14; every part merges master in
  first), port 3003, database `rfl_desk`, **migrations 0420-0449**. Made and checked (`lane.js check desk`) on 2026-10-28. Its
  `.env.local` asks no real bot (`LLM_BROWSER_API_URL` is empty): the VM serves production and the local bot is the playtest
  recorder's, so its checks use the stand-in (`scripts/dev-test/fake-bot.js`, the `x-gys-bot` header).
- **When:** from the weekly usage reset, Thursday 2026-10-29 at 4 PM Eastern (the user: after it). It takes the sports lane's
  slot, as "Who gets the usage" in PLAN-start-a-game-gpt.md says: two lanes, engine and desk, and sports takes the slot back
  whenever the desk waits on the user. **The switch** (the user, or a main-folder session with them):
  1. In the window "Lane sports: session loop", press `s`: it stops after its session, and its hand-off waits.
  2. Close the "Lane keeper" window (its Keep awake window closes with it).
  3. `node scripts/lane.js start desk --prompt-file C:\Users\conor\rfl-desk\.session-loop\seed-desk.md --max-sessions 4`
  4. `node scripts/lane.js keep engine desk --max-sessions 4`: the keeper again, with desk in place of sports.
- **The parts**, one session each (a big one may split in two; its hand-off says so):

| Part | What it builds | Noticed it takes |
|---|---|---|
| 1a | The page frame every desk page shares (lower third, facts, Part of, History's latest three, Delete last and named, Back naming where you came from); Find › Browse and People's list (search by name, username or email; Waiting · Site admins · Everyone; newest, last active, name; paging); Settings regrouped | the Viewing as bar's colour |
| 1b | A person's page: Act as them (Better Auth's impersonation, its start and end in History), Approve, Reset password, Edit name and email, Stop them signing in and Let them back in; Who gets in from the desk | |
| 1c | Their couches and games (a seat's sheet: role, unlink, Open the game; 6b reuses it); Delete account (tier 3) with Hand them on (one person, or game by game), which step 2's couch and step 6 reuse | |
| 2 | The Inbox: Needs you as one list, most urgent first, adding reports, accounts waiting, a cast not sent and no schedule; Coming up; Find › Reports and a report's page | |
| 3a | Setup's season and results: Name, Status (held over its listing's dates: a column), Who decides results, the season's Delete (refused while games play it) | a, c |
| 3b | Setup's schedule: When it airs and Episodes (tier 2, What moves, the prune), times by hand over the listing's, `release` and `drop_at`, a TV listing linked, unlinked and searched | b |
| 4a | Research and the bot: Run now as a queued run with its progress and what it waits behind, the schedule's rail (Autopilot, each run's timing, add, remove, reset), Runs | e |
| 4b | An episode's page: Not in the games yet from the facts (accept, correct, reject, Accept all), Answers with Take it back, Paste an answer as a submission, trivia's Take it out, Clear's two scopes | d |
| 4c | The bingo bank: by episode and the season's, Write them again, Paste, Hide and Show again (an admin's outranks two flags) | |
| 5a | Cast: Ask our bot or Paste, then the review of what changed (staged until sent) and Send to its games (a rename by id); the Inbox's cast item | g, k |
| 5b | Starting groups (Not a group, secret roles together; Hold until Episode 1 without un-approving) and a castaway's page (Name, Photo from TMDB and TVmaze, group; Remove refused while in use) | h, i, j |
| 6a | Find › Games (a join code from three characters, any state, deleted ones within 30 days, Restore) and a game's page: Join code, its Delete (Archive offered, then for good) | m |
| 6b | Seats (signed in, empty, out): Link an account (Game admin too, joining the couch, the seat taking their name, telling them), Unlink, Take out (the app's `takeOut`), Put back, Remove a seat; the last-Commissioner guard on each | n, o, p, q |
| 6c | Open it read-only: a site admin's read scope over the couch's game reads, writes refused while it's on, a History line | r |
| 6d | Find › Couches (Browse's Couches row, with Deleted) and a couch's Delete: its games go too, restorable 30 days, Restore (handed on from 6c; `couches.deleted_at`, a migration) | bq, bw |
| 7a | A show: Add a season, Its words (`episode_term`, one source with the rulebook's), Research sites, Archive and Restore, the show's Delete | s, u, v, y |
| 7b | Art and photos: a source and framing per frame (the poster's `art_style`, one for the backdrop), a link per frame | x |
| 7c | Settings: Which AI our bot asks (an app setting sent with each ask), the rulebooks flag's check as a desk job and its switch | |
| 7d | Postponed (the user, 2026-10-29): What's New as data (decision 8), once there are players enough to want it | z |

- **Every part:** merge master in (`node C:\Users\conor\reality-fantasy-leagues\scripts\lane.js sync desk`, which refuses while
  anything is uncommitted); read its step's As mocked, What the build needs, Changes at approval and Noticed items; read the
  mock in the main folder (`C:\Users\conor\reality-fantasy-leagues\.impeccable\mocks\site\`, read only, since a worktree has no
  mock) and shoot its group with `node scripts/dev-test/shoot-mock-scenarios.js <scratch folder> --group=dsc
  --mock=C:\Users\conor\reality-fantasy-leagues\.impeccable\mocks\site` (groups: dks for steps 1-2, dss, dsr, dsc, dsg, dsv);
  build to it at 390 (wide comes with the desktop pass); weigh what classic does by decision 10; port classic's routes to
  `/api/desk/*`; a check per step in `scripts/dev-test/` (`check-desk-<step>.js`, zt-dk- rows with an up and a down, at 390, on
  its own server), with `check-new-desk.js` and `check-classic-admin.js` still passing; unit tests; `/code-review` on the part's
  diff; its Status line and an As built under its step, saying what it left behind and why; commit on `desk`; hand off.
- **It doesn't wait at a step's end.** The step's last part writes "Step N ready to merge at <commit>" in Status and the lane
  goes on. **It stops for the user only** when the mock doesn't answer a question (never invent a screen), or at 7c's What's New
  if its drafts aren't mocked yet; after 7c it's done.
- **Off limits:** `state-logic.js`, `start-game.ts` and `.tsx`, `src/lib/game/game-spec/`, the engine lab (`/desk/lab`,
  `engine-lab.ts`) and anything else that's the engine lane's; the sports code (`src/lib/server/sports/`, `src/lib/sports/`);
  the tapes recorder and its replays (`tapes.js`, `playtest.js`) and what they call, whose exports keep their shape
  (`db/bot-research.js`, `db/episode-research.js`, `db/trivia-research.js`, `db/bingo-research.js`, `db/rulebooks.js`,
  `db/wiki-sync.js`, `cast-prompt.js`); the mock; the local bot and the VM. Files other lanes change too get small, additive
  edits: `src/new/routes.ts`, `change-log.ts`, `season-decisions.ts`, `bingo.ts`, and `tv-listings.ts` (3b: the sports branch
  changes it too).
- **Bringing a step home:** the user merges a ready step's commit into master from the main folder (`git merge <commit>`), runs
  the full batch and pushes, never on an episode night (Survivor 51: Wednesdays, 8 PM ET). A migration that changes an
  existing table is rehearsed on a Neon branch first (the user's). Then `lane.js sync` for the other lanes. Step 8 follows once
  1-7 are on master.

## The design brief (impeccable shape, 2026-10-27; designed in the site mock, `.impeccable/mocks/site/`, before each step is built)

1. **Job and audience.** A site admin (today: the owner), at a desk or on a phone, with a job in hand: someone can't get in, a
   result is wrong, a season needs its schedule, a report came in, "what is riley seeing?". Operate mode: scan, find, act, done.
2. **Outcome and proof.** Every classic admin job doable from the desk, found where the job starts (the Inbox when something is
   asking, Find when you know what you're after), never needing classic. Success: step 8 ships and nobody misses `/admin`.
3. **Direction.** Inside the mock's world (Lower Third: night ground, white caption plates, one yellow for what must be done) and
   the desk's own patterns: Inbox items with a tag, Find over everything, entity pages with Override · Lock · History. Guards by
   blast radius as everywhere else: tier 1 instant with Undo and a History line (approve, edit, settings); tier 2 previews what
   moves (accept an episode's results, run research); tier 3 a consequence sentence and hold to confirm (delete an account, a game,
   a season, a show). Act as them is its own moment: the person's page says what it does ("For an hour you're riley: anything you
   do is done as them. It's in History."), then the app as them with the existing "Viewing as" bar.
4. **Scope.** Mock screens for every step above, at 390px, in the mock's Admin (`#/admin`: Inbox · Find · Settings, entity pages);
   new entity kinds: person (actions), game, report, season setup/research/bot/cast, show; new Find filters. Untouched: the
   player-facing app, the desk's existing Inbox kinds and Library.
5. **States and ranges.** People: hundreds (paging), some waiting, a few admins; one person in 0-10 couches and 0-30 games. Reports:
   0-50 open. Seasons: one with no schedule, one airing, one finished; research runs pending, failed, done. Empty states for each.
6. **Interaction and layout.** One column; lists of rows (a face or tag, two lines, a chevron); entity pages as a caption plate
   header, then facts, then actions (danger last, set apart); sheets for edits; Undo toasts. Wide later: list beside detail.
7. **Constraints.** 44px targets, 16px in fields, no horizontal scroll at 390; real names never in the mock (demo names only).
   Create account and site roles stay out; stopping someone signing in is in step 1 (decisions 5 and 6).

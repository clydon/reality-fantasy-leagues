# Plan: the desk catches up with classic's admin

Written 2026-10-27. The new design's desk (`/desk`: Inbox · Find · Settings · Library; `src/new/desk/`, `src/lib/server/desk*.ts`)
is ahead of classic's admin in places (disputes and canonical locks, couches nobody runs, rulebooks, TMDB art, undo from
History), but a site admin still has to go back to classic for about 25 things, and the new design has no way into classic's
admin at all (only Settings › Back to the classic design, or typing `/admin`). Nothing in `src/new` calls `/api/admin/*`. This
plan closes that gap, then retires classic's admin.

**Status (2026-10-28, night): Step 1 ready to merge at 049c10db: parts 1a, 1b and 1c** (1a: the page frame, Find › Browse and People,
Settings regrouped, the Viewing as bar; 1b: a person's actions, Let in, Act as them, Name and email, Reset password, Stop
them signing in and Let them back in, with migration 0420; 1c: their couches and games, a seat's sheet, Hand on and Delete
<name>'s account, no migration; their As built is under step 1); **part 2 (the Inbox) is next.** Before it: **the design pass was done, and the
build planned.** Step 0 is done, and the user approved
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
   classic today; a card in the new design is player-facing, not the desk's (BACKLOG 22).
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
8. **Classic's admin retires**: `/admin` sends a site admin to the desk; classic's admin pages and `src/lib/admin-store.ts` go.
   So does what only classic used, each checked unused first (decision 9): the wiki read (classic's Pull cast, `db/wiki-sync.js`'s
   pull and its nightly `.github/workflows/wiki-sync.yml`) and paid Claude research's hourly `.github/workflows/auto-research.yml`.
   `termsFor` and `stageSeasonCast` stay (episode research and the tapes recorder call them), moved if their file goes.
   HOSTING.md loses the two jobs.

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
| 7a | A show: Add a season, Its words (`episode_term`, one source with the rulebook's), Research sites, Archive and Restore, the show's Delete | s, u, v, y |
| 7b | Art and photos: a source and framing per frame (the poster's `art_style`, one for the backdrop), a link per frame | x |
| 7c | Settings: Which AI our bot asks (an app setting sent with each ask), the rulebooks flag's check as a desk job and its switch, What's New as data (decision 8, once its drafts are mocked) | z |

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

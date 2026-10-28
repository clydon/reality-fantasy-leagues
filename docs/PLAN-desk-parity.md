# Plan: the desk catches up with classic's admin

Written 2026-10-27. The new design's desk (`/desk`: Inbox · Find · Settings · Library; `src/new/desk/`, `src/lib/server/desk*.ts`)
is ahead of classic's admin in places (disputes and canonical locks, couches nobody runs, rulebooks, TMDB art, undo from
History), but a site admin still has to go back to classic for about 25 things, and the new design has no way into classic's
admin at all (only Settings › Back to the classic design, or typing `/admin`). Nothing in `src/new` calls `/api/admin/*`. This
plan closes that gap, then retires classic's admin.

**Status (2026-10-28): step 0 done; in the design pass, step 1 (People) is mocked and waiting for the user's approval**
(`.impeccable/mocks/site/desk.js` and `desk.css`; Mock scenarios › Desk · step 1: people). Classic's admin renders: all 19 of its pages at 390px locally
(`scripts/dev-test/check-classic-admin.js`, which step 8 can turn round), and in production To do, Users, Leagues, a league's
page, Shows and Site, with no console errors. The blank `/admin/leagues` seen in production earlier that day didn't come back.
The likeliest cause is classic's boot screen: it covers the page until the first league loads (about a second locally, longer
on Neon), and it's blank but for one small plate. The desk's Settings now has Not on the desk yet › Classic admin (a link to
`/admin`; the check taps it). Next: the design pass with the user (every step's screens in the mock, approved one by one).
Once they're approved, the build (steps 1-7) runs as its own lane (`scripts/lane.js`) beside engine and sports, after the
weekly usage reset. Deletes are the user's sore point: a game's delete looked dead on a phone (a finger that rolled cancelled
the hold; fixed in 1e38aeea, with `scripts/dev-test/check-hold-touch.js`), and a season or a show can't be deleted outside
classic. Make every delete easy to find in the design.

**Noticed, not fixed (step 0):** after the Classic admin link, classic keeps the new design's `dark` class on `<html>`, so it
shows in its dark theme until a reload whatever its own theme is. It reads fine, and classic's admin goes at step 8; a full
page load (`window.location.assign`) would fix it at the cost of the row being a link.

**Noticed, not fixed (design pass):** the new design's "Viewing as" bar (`src/new/session.tsx`) is white 13px text on #5089c4,
about 3.7:1, under the 4.5:1 floor. The step 1 mock uses #3c6ea6 (about 5:1); step 1's build takes it.

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

Open: **a couch's delete is new** (neither app has one; added for decision 4). Ask the user before step 6 builds it.

**Settings, regrouped** (the user, 2026-10-28: "hard to figure out where everything is"): by the question you have, each row
with its value and a dot when it's off its recommended setting (its sheet has Reset to recommended), each change a toast with
Undo and a line in Settings history. **People** (Who gets in, with who's waiting) · **Results** (sources to confirm a result,
when a result is disputed, who fills in results on new couches; "who went home is always checked for free" is said, not a
row) · **Our bot** (Autopilot: the seasons it's on for, each a link; which AI it asks, step 7) · **Rulebooks** (games on
their season's rulebook, each a link; the library) · **Telling players** (What's New: paused, drafts, step 7's preview) ·
**Changes** (Settings history, its own sheet, not a long inline list) · **Not on the desk yet** (Classic admin).
2. **Inbox catches up.** Reports (read, mark done, open the game or screen it came from), accounts waiting, results waiting for
   review (an episode's, all at once), casts pulled and not approved, airing seasons with no schedule, and Coming up (the next
   episode of each airing season, and whether research will run on its own).
3. **Seasons: setup.** A season page's Setup: name, status, wiki page, the schedule (episode count, premiere, air time, zone),
   who decides results (the admin, or each game), delete (tier 3).
4. **Seasons: research and the bot.** Run now (quick, full, schedule, trivia, bingo), the bot's episode length, each run's
   timing, add or remove a run, reset; an episode's research (paste an answer, discard, clear); auto research; the bingo bank
   (an episode's squares and the season's, hide or show, write by paste). The results queue: an episode's pending results with
   Accept all, accept, reject, correct.
5. **Seasons: cast.** Pull from the wiki and pull again, approve and send to the games, remove someone, hold starting groups
   until Episode 1.
6. **Games and couches.** Find's Games (by name or join code); a game's page: its seats and who's in each (link an account,
   change a role, unlink, remove a player), its join code, delete for good (tier 3), open it (as an admin, read-only).
7. **Shows and site.** Delete a show (refused while games use it, saying which), restore an archived one, a season's details
   when adding it (number, status, wiki), the connector (wiki API, cast heading, research sites), art by URL with its framing;
   Settings: AI models, What's New preview, the rulebooks flag.
8. **Classic's admin retires**: `/admin` sends a site admin to the desk; classic's admin pages and `src/lib/admin-store.ts` go.

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

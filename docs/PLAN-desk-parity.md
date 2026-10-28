# Plan: the desk catches up with classic's admin

Written 2026-10-27. The new design's desk (`/desk`: Inbox · Find · Settings · Library; `src/new/desk/`, `src/lib/server/desk*.ts`)
is ahead of classic's admin in places (disputes and canonical locks, couches nobody runs, rulebooks, TMDB art, undo from
History), but a site admin still has to go back to classic for about 25 things, and the new design has no way into classic's
admin at all (only Settings › Back to the classic design, or typing `/admin`). Nothing in `src/new` calls `/api/admin/*`. This
plan closes that gap, then retires classic's admin.

**Status (2026-10-28): step 0 done; in the design pass, step 1 (People) is approved by the user**, with Find › Browse, Hand
on, the desk's pages and how they link, and Settings regrouped (`.impeccable/mocks/site/desk.js`, `desk-pages.js`, `desk.css`;
Mock scenarios › Desk · step 1 and Desk · pages and Settings). A couch's delete stays (approved with the rest). Step 2 (the
Inbox, `desk-inbox.js`) is done in the mock (the user, 2026-10-28). **Step 3 (a season's Setup) is mocked and waiting for
approval** (`desk-setup.js`; Mock scenarios › Desk · step 3: a season's Setup; step 3 below says what it shows and what its build
needs). **Step 4 (a season's Research and the bot) is mocked and waiting for approval** (`desk-research.js`,
`desk-research.css`; Mock scenarios › Desk · step 4: research and the bot; step 4 below says what it shows, what its build
needs and how its three questions were settled). **Step 5 (a season's Cast) is mocked and waiting for approval**
(`desk-cast.js`, `desk-cast.css`; Mock scenarios › Desk · step 5: a season's cast; step 5 below). Classic's admin renders: all 19 of its pages at 390px locally
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

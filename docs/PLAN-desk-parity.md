# Plan: the desk catches up with classic's admin

Written 2026-10-27. The new design's desk (`/desk`: Inbox · Find · Settings · Library; `src/new/desk/`, `src/lib/server/desk*.ts`)
is ahead of classic's admin in places (disputes and canonical locks, couches nobody runs, rulebooks, TMDB art, undo from
History), but a site admin still has to go back to classic for about 25 things, and the new design has no way into classic's
admin at all (only Settings › Back to the classic design, or typing `/admin`). Nothing in `src/new` calls `/api/admin/*`. This
plan closes that gap, then retires classic's admin.

**Decisions (the user, 2026-10-27):**
1. **Act as them.** Opening the app as someone is classic's impersonation as it is: for an hour you are them (Better Auth's
   admin plugin, `impersonateUser`), anything you do is done as them, a bar says so, one tap returns you. Two additions: it's
   written in the desk's History (start and end; classic doesn't log it), and the person's page says what it does before it starts.
2. **Every gap, designed now**, in this plan's order, so each step has its screens when it's built.
3. **Phone first, wide later.** Designed at 390px like the rest of the mock; a wide layout (a list beside its detail) is part of
   the app's desktop pass, after the flows settle.

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
   shown once), Edit name and email, their couches and games with each seat's role (change, unlink), Delete account (what it
   does to their seats said first; tier 3, hold to confirm). New account from Find. Who gets in lets them in from the desk.
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
   Open: whether Create account belongs on the desk at all (sign-up and invites may cover it), and whether site roles and bans
   join step 1.

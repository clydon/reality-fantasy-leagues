# The desk today: the audit (Round 0 of its design pass)

> **Status (2026-11-21): Reference** for the settings plan's Round 5 ([PLAN-settings-overhaul.md](../PLAN-settings-overhaul.md),
> "Round 5: the site admin's desk"). Read from the code (master fa975a24), not rendered: the round renders every surface at 390
> before anything changes. It extends [settings-audit.md](settings-audit.md) §4 (which covered the desk's settings only) to every
> desk surface, control and action. Line numbers drift; search for the words. "Unsure" marks anything the code doesn't settle.

**How to read it.** §1 maps every surface. §2 walks each one top to bottom; every control has a number (D1, D2, ...) so you can
approve or overturn it by number. §3-8 are the cross-cutting findings. The decisions this needs from you are at the end.

| Verdict | Means |
| --- | --- |
| **Keep** | it earns its place as it is (the words may still change in §3) |
| **Rename** | the right control with the wrong words |
| **Move** | the right control in the wrong home (it says where) |
| **Merge** | two controls or pages that are really one (it says with what) |
| **Default** | keep what it does, drop the control: nobody changes it, or the right value is obvious |
| **Drop** | it does nothing useful now |
| **Script** | a one-time or rare switch that belongs in `scripts/`, not on a screen |

The site admin is one person (the owner), mostly at a desk, sometimes on a phone. Results settle by our bot now
([PLAN-results-settle.md](../PLAN-results-settle.md)); the desk sees only what the bot couldn't settle.

---

## 1. The map

One route, `/desk/[[...page]]` (`src/app/(new)/(in)/desk/[[...page]]/page.tsx`), dispatched by `DeskScreen` (desk.tsx:47-79), plus
`/desk/lab`. Every read and write is `/api/desk/*`, each checking `requireDesk`. 3 tabs, 7 list pages, 9 item kinds, 4 season
sub-pages, 2 show sub-pages, an episode and a castaway page, New show and the engine lab: **27 screens**, and about 97 sheets (counting each `<Sheet>`, `GuardSheet`, `HoldSheet` and `MovesSheet` in src/new/desk).

**Doors in:** the hub sheet's "Site admin" row (hub/profile.tsx:140-149), Your settings' "Site admin" row (settings.tsx:138), and a
show's menu "This season in Admin" (show-space.tsx:568, straight to the season page).

| Surface | Route | File | Reached from | Its one job |
| --- | --- | --- | --- | --- |
| Inbox (tab) | `/desk` | desk.tsx:251 InboxTab | the doors; every tab | What needs the admin now, and this week's episodes |
| Find (tab) | `/desk/find` | desk.tsx:359 FindTab | tabs | Search everything; Browse each kind's list |
| Settings (tab) | `/desk/settings` | desk.tsx:648 SettingsTab | tabs | Site-wide switches |
| People | `/desk/people` | people.tsx:86 | Find › Browse; Inbox "waiting"; Who gets in | Every account, searched, filtered, Let in |
| Person | `/desk/person/:id` | people.tsx:269 | People; a couch; a report; search | One account: let in, act as, password, signing in, seats, delete |
| Couches | `/desk/couches` | couches.tsx | Find › Browse | Every couch, Restore a deleted one |
| Couch | `/desk/couch/:id` | pages.tsx:303 | Couches; Inbox "nobody runs"; a game; a person | One couch: hand on, who fills in, delete |
| Games | `/desk/games` | games.tsx | Find › Browse; search by join code | Every game |
| Game | `/desk/game/:id` | games.tsx:344 | Games; a couch; a seat; a castaway's blockers | One game: open it, seats, join code, delete |
| Reports | `/desk/reports` | reports.tsx | Find › Browse | Every report sent |
| Report | `/desk/report/:id` | reports.tsx | Reports; Inbox; a person | Read it, mark done, act as its sender |
| Shows | `/desk/shows` | shows.tsx:146 | Find › Browse | Every show |
| Show | `/desk/show/:id` | shows.tsx:297 | Shows; a season's Back; search | One show: its seasons, sites, art, words, archive, delete |
| Research sites | `/desk/show/:id/sites` | shows.tsx:742 | the show | Where research looks first |
| Art and photos | `/desk/show/:id/art` | art.tsx | the show | Its header and card art, framing, cast photos |
| Season | `/desk/season/:id` | pages.tsx:238 | a show; a game; the show menu door; Coming up | One season: its four pages and its episodes |
| Setup | `/desk/season/:id/setup` | setup.tsx:47 | the season; Inbox "no schedule" | Name, status, schedule, who decides results, made-for games |
| Research | `/desk/season/:id/research` | research.tsx | the season; Settings › Autopilot; Inbox "no run" | The bot: run now, its schedule, its runs |
| Cast | `/desk/season/:id/cast` | cast.tsx | the season; Inbox "cast"; Art | Get the cast, review changes, send to games, groups |
| Castaway | `/desk/season/:id/c/:castId` | castaway.tsx:33+ | Cast | One cast member: override name, photo, group, bio; lock; remove |
| Bingo bank | `/desk/season/:id/bingo` | bingo.tsx | the season; an episode | The squares each episode deals from |
| Episode | `/desk/season/:id/e/:n` | episode.tsx | the season; Inbox results rows; Research | One episode's results, answers, trivia; clear |
| Fact | `/desk/fact/:id` | pages.tsx:62 | an episode's disputed row; search | Decide one disputed result |
| Rulebook | `/desk/rulebook/:id` | rulebook.tsx:57 | a season; a game; Library; Inbox | Edit a rulebook; research it; library controls |
| Library | `/desk/library` | library.tsx | Find › Browse; Settings | Starting points, players' rulebooks, drafts, in use |
| New show | `/desk/new` | new-show.tsx | Library's sticky button; a show's "Make it a game" | Set a show up as a game |
| Castaway (old) | `/desk/castaway/:id` | castaway.tsx:33 | old links | Redirects to the castaway page |
| Engine lab | `/desk/lab` | src/new/lab/lab.tsx | **nothing on the desk links to it** | Start test games from the capability tracker |

---

## 2. Per surface, top to bottom

Labels are verbatim. "→" is the server call. Tier words are the app's guard tiers (toast with Undo; preview then confirm; hold).

### The frame (every page)

| # | Label | What it does | Verdict | Why |
| --- | --- | --- | --- | --- |
| D1 | Header title **"Admin"** (desk.tsx:53, 91; page metadata `title: "Admin"`, page.tsx:6) | names the area | **Rename** "Site admin" | the doors already say "Site admin" (profile.tsx:145, settings.tsx:138) |
| D2 | Badge **"Admin"** on every page (parts.tsx:133) | marks you're on the desk | **Keep** | once D57 renames "Game admin", "Admin" no longer collides |
| D3 | An unlabelled eye, aria "View as" (desk.tsx:91, view-as.tsx:40); sheet "View as" · Player / Commissioner | reloads the app as a lens on your own account → POST/DELETE `/api/view-as` | **Move** to a labelled row in Site settings; **Rename** "Preview as a player" | the most hidden control on the desk, and the way back is only the profile menu (view-as.tsx:10) |
| D4 | Non-admin screen "The desk is for site admins" · "Results settle by the couches. Anything that needs an admin comes here." (desk.tsx:54) | | **Rename** | untrue since results-settle: the bot settles |
| D5 | Tabs **"Inbox · Find · Settings"** (desk.tsx:45, 84-88) | | **Rename** "To do · Search · Site settings" | "Settings" names four screens; the doors already say "To do, search and the site's settings" |
| D6 | Back names the page you came from (parts.tsx:117-119, trail.ts) | | **Keep** | |
| D7 | "Override" button on field rows (parts.tsx:384-388; OverrideSheet "Override · X", "Save override") | | **Rename** "Change", with its line "wins over research" kept | "Override" is the desk's internal verb; the sheet already explains what it wins over |

### Inbox (desk.tsx:251-314; GET `/api/desk/inbox`, desk-inbox.ts)

| # | Label | What it does | Verdict | Why |
| --- | --- | --- | --- | --- |
| D8 | Section **"Needs you"** with a count (desk.tsx:258) | | **Merge** with the tab's name (To do) | the player app dropped "Needs you" for "To do" (settings-r0-names.md) |
| D9 | Empty: "Nothing needs you" · "The couches are handling it." (desk.tsx:268-269) | | **Rename** | the bot handles it, not the couches |
| D10 | Row tag **"Still split"** for both `split` and `stale` (desk.tsx:116-117) | | **Rename** stale's tag "Waiting" | a stale row is "results waiting for a second look" (desk-inbox.ts:101), not a split |
| D11 | "{season}, Episode N: 3 results still split" → the episode page (desk-inbox.ts:107-113) | | **Keep** | the one results job left for the admin |
| D12 | "{season}: when did the X start?" → the rulebook (desk-inbox.ts:137) | | **Keep** | |
| D13 | "{season}: something new in Episode N?" → rulebook, else the season (desk-inbox.ts:255) | | **Keep** | unsure: the season-page fallback has nothing to act on |
| D14 | "Nobody runs X's games" · "Its only Commissioner has gone · N people waiting on results" → the couch (desk-inbox.ts:157-160) | | **Rename** the line | nobody waits on results now; they wait on lineups, waivers and the lock |
| D15 | "X is airing with no schedule" → Setup (desk-inbox.ts:259) | | **Keep** | |
| D16 | "X has no Full results run: …" with an inline **Add** → POST `/seasons/:id/research {addUsual}` (desk.tsx:166-202) | | **Keep** | one tap, with Undo |
| D17 | Cast rows → Cast | | **Keep** | |
| D18 | "N accounts waiting to get in" with faces → People › Waiting (desk-inbox.ts:228-232) | | **Keep** | |
| D19 | A report → the report (desk-inbox.ts:295) | | **Keep** | |
| D20 | "A fix for X's rulebook" → rulebook, else `/desk/find` (desk-inbox.ts:302) | | **Keep** | the Find fallback leads nowhere |
| D21 | "X's rulebook needs a second look" → rulebook (desk-inbox.ts:314) | | **Keep** | |
| D22 | "X was added by name" → the show (desk-inbox.ts:326) | | **Keep** | |
| D23 | "{season}: Episode N would change scores" · "Send it or leave it out" → the episode (desk-inbox.ts:284) | | **Keep** while a catch-up runs | |
| D24 | **"The catch-up is held: N seasons wait"** · "Load the rehearsal's answers (scripts/catch-up-load.js), or release it to ask our bot" → `/desk` (desk-inbox.ts:291) | links to the Inbox itself | **Move**: the release becomes a desk action (M2) | a row that tells you to run a script and links to itself |
| D25 | "{season}: the catch-up stopped" → Setup (desk-inbox.ts:294) | Setup has no catch-up control | **Move** the link to where Try again lives (M3) | POST `/seasons/:id/catchup {start:true}` exists with no button anywhere |
| D26 | "{season}: X has no stats" · "tried again every few hours" → the season (desk-inbox.ts:281) | | **Move** out of To do, to the season's facts | nothing to do: it retries on its own |
| D27 | **"Coming up"** · "This week": rows (time, season, episode, how results come in) → the season; "All N this week" (desk.tsx:273-293) | | **Keep** | |
| D28 | Coming up's lines: "Autopilot: who went home, then full results", "Couches fill in results · no bot", "You decide results · couches' answers count too", "ESPN's results come in on their own" (desk-inbox.ts:169-182) | | **Rename** | "Autopilot" (§3); "You decide" goes with D107 |
| D29 | **"This week, on its own"**: "episodes researched", "confirmed by 2+ sources", "questions settled without you", "house rulings kept" (desk.tsx:294-309) | four counts | **Rename** | "2+" ignores the setting and tells the old rule; "house rulings" is the engine's word (the app says "Keep our result") |
| D30 | Line "Results settle on their own: when answers disagree, our bot looks again and what most answers say stands. Only what it can't settle comes here." (desk.tsx:310) | | **Keep** | true, once D40 defaults the second look on |

### Find (desk.tsx:359-519; GET `/api/desk/find?q=`)

| # | Label | What it does | Verdict | Why |
| --- | --- | --- | --- | --- |
| D31 | Search, placeholder "A show, season, castaway, couch or person", aria "Find anything" (desk.tsx:374) | | **Rename** | "castaway" is Survivor's word; it also finds games, join codes and reports |
| D32 | "Everything can be changed from its page. Changes show their reach before you save, and every one is in its history." (desk.tsx:376) | | **Drop** | filler, and not every change previews its reach |
| D33 | **Browse**: People · Couches · Games · Shows · Library · Reports, each with counts (desk.tsx:379-442) | | **Keep** | the lists are good |
| D34 | "Seasons, episodes, castaways and results are inside their show. The search finds them all." (desk.tsx:443) | | **Rename** "castaways" | |
| D35 | **Recently opened** (desk.tsx:444-453) | | **Keep** | |
| D36 | Results: 3 people, couches, games (a join code too), shows, found items, reports, each with "All N matching" (desk.tsx:456-514) | | **Keep** | |

### Settings (desk.tsx:648-844; GET/PUT `/api/desk/settings`, desk.ts:121-260)

| # | Label | What it does | Verdict | Why |
| --- | --- | --- | --- | --- |
| D37 | **People › "Who gets in"**: "You let each one in" · "Invites let people in" (Recommended) · "Anyone gets in"; Reset to recommended; "Waiting" with Let in (desk.tsx:691-703, 756-765) | PUT `{signups}`, Undo | **Keep**; **Rename** "Sign-up approval" | settings-audit S1 |
| D38 | **"Game previews"**: "Off" · "Site admins only" · "Everyone"; "This month" bar (desk.tsx:704-717, 766-780) | PUT `{livePreviews}` | **Keep** | its budget warning borrows the changed-dot (desk.tsx:709): give it its own mark |
| D39 | **Results › "Sources to confirm a result"**: "2 sources" (Recommended) "Two people's answers agreeing" · 3 · 4 (desk.tsx:720, 781-793) | PUT `{confirmAt}` → settleEverything | **Default** 2, drop | §4: one look reaches the games whatever it says; "people's answers" is wrong (most sources are the bot) |
| D40 | **"When answers disagree"**: "Our bot looks again an hour later" · "It waits for you" (desk.tsx:721, 794-806) | PUT `{tiebreak}` | **Default** on, drop | your rule: the AI settles; on in production since 2026-11-20 but **off in code** (db/bot-research.js:286-290 `tiebreakOn`), so a fresh database starts wrong |
| D41 | **"Who fills in results on new couches"**: "Anyone on the couch" (Recommended) · "Only people who run games" (desk.tsx:722, 807-817) | PUT `{newCouchesAnyone}` → app_settings `new_couch_fill`, copied into each new couch (couches.ts:82-85) | **Default** anyone, drop | nobody changes the site-wide default; a couch keeps its own override (D63) |
| D42 | Section **"Our bot"** · "What it looks up on its own, and with which AI." (desk.tsx:724) | | **Rename** "Research bot" | |
| D43 | **"Autopilot"**: "On for N seasons: …"; sheet lists them, each to its Research (desk.tsx:725-731, 818-827) | read-only list | **Merge** into one Research bot page (C46) | the bot's settings sit in five places |
| D44 | **"Which AI our bot asks"**: "ChatGPT, signed in" (Recommended) · "Claude" (desk.tsx:732, 828-837) | PUT `{botAi}` | **Keep**, **Move** to the Research bot page, with the per-run AIs (M6) | |
| D45 | **Gemini**, dimmed: "Can't do the research prompts yet." (desk.tsx:833) | a toast | **Drop** | not a choice |
| D46 | **Rulebooks › "Games on their season's rulebook"** → sheet: seasons on by themselves, "Every season at once", Check every league, Switch on/off (desk.tsx:735-743; settings-flag.tsx) | POST `/api/desk/settings/rulebooks` | **Script** (C48) | a one-time flag, on in production; `scripts/rulebooks-flag.js status/check/on/off` already does all of it |
| D47 | **"The library"** row (desk.tsx:744) | link | **Drop** here | it's in Search's Browse |
| D48 | **Changes › "Settings history"** sheet, each line with Undo (desk.tsx:746-754, 839-841) | | **Keep**; **Rename** "Change history" | glossary word |

### People list and a person (people.tsx)

| # | Label | What it does | Verdict | Why |
| --- | --- | --- | --- | --- |
| D49 | People: search "Name, username or email"; Everyone · Waiting · Site admins · Can't sign in; sort; "Let in" on a row; Show 25 more (people.tsx:86-210) | GET `/api/desk/people` | **Keep** | the filter group's aria-label is "Show" (people.tsx:135; couches.tsx:141 too): **Rename** "Filter" |
| D50 | Person: "Waiting to get in" panel, **"Let {name} in"** (people.tsx:347-362) | POST `/api/desk/people/:id` | **Keep**; **Rename** "Approve" | settings-r0-names |
| D51 | "{name} can't sign in" panel, "Let them back in" (people.tsx:368-) | | **Keep** | |
| D52 | **"Act as {name}"** · "See and use the app as they do, for an hour"; sheet "Act as X? · For an hour" (people.tsx:384-398; act.tsx) | POST `/api/desk/people/:id/act` (Better Auth impersonation) | **Keep**; **Rename** "Sign in as {name}" | |
| D53 | Account › "Name and email" sheet (people.tsx:404) | | **Keep** | |
| D54 | "Password" · "Reset it: a temporary one, shown once" (people.tsx:406-410) | | **Keep** | |
| D55 | "Signing in" · Stop them / Let them back in (people.tsx:412-419, 761-821) | | **Keep** | |
| D56 | "Couches and games": each couch and each seat, a seat opening its sheet (people.tsx:424-) | | **Keep** | |
| D57 | Seat sheet **"Role"**: "Commissioner" · "Results, waivers, rules and roles"; **"Game admin"** · "Results and waivers; can pick for people"; "Player" · "Plays; sees nothing backstage" (seats.tsx:54-60) | PUT `/api/desk/seats/:league/:user` | **Rename** "Helper"; drop "backstage"; drop "Results" from the lines | the player app says Helper (settings-r4-spec glossary: "Game admin (desk only now)"); runners don't do results now |
| D58 | Seat sheet "The seat": Act as · Link another account · Unlink · Open {game} · "Take {name} out of {game}" (hold) (seats.tsx:245-300) | | **Keep** | |
| D59 | **"Hand it on"** sheet · "Who runs it next?" (seats.tsx:838-1030) | POST `/api/desk/hand-on` | **Keep**; **Rename** "Make someone else the Commissioner" | glossary |
| D60 | "Reports they sent" (people.tsx:499) | | **Keep** | |
| D61 | "Delete {name}'s account" (hold, hand on first) (people.tsx:509-513) | | **Keep** | |

### Couches and a couch (couches.tsx; pages.tsx:303-475)

| # | Label | What it does | Verdict | Why |
| --- | --- | --- | --- | --- |
| D62 | Couches list: All · Nobody runs it · New this month · Deleted; sorts; Restore (couches.tsx) | | **Keep** | |
| D63 | Couch **"Settings" › "Who fills in results"** · Override → "Anyone on the couch" / "Only people who run games" (pages.tsx:406-408, 451-472) | POST `/api/desk/couches/:id {anyone}` | **Keep** as the override; **Rename** the heading | a fourth thing called "Settings"; and the toast has no Undo though the server keeps one (desk-couches.ts:300 vs pages.tsx:464 `useAct`) |
| D64 | Deleted panel + "Restore {couch}"; "Nobody runs its games" + "Hand them on"; People; Games (pages.tsx:348-405) | | **Keep** | |
| D65 | "Delete {couch}" (hold, restorable 30 days) (pages.tsx:410-450) | | **Keep** | |

### Games and a game (games.tsx)

| # | Label | What it does | Verdict | Why |
| --- | --- | --- | --- | --- |
| D66 | Games list: Playing · Nobody runs it · Ended · Archived · Deleted; Newest · Most players · Name; join-code search (games.tsx:30-41) | | **Keep** | |
| D67 | Game page: lower third, facts, Deleted + Restore, "Nobody runs it" + "Hand it on" (games.tsx:385-448) | | **Keep** | |
| D68 | **"Open {game}"** row (OpenRow): as you, else "As its couch sees it, read-only" (games.tsx:~60-110) | POST `/api/desk/games/:id {open}` | **Keep** | |
| D69 | "Part of": couch, season, rulebook (games.tsx:450-479) | | **Keep** | |
| D70 | "Join code" + Copy · "… Find › Games finds the game by it." (games.tsx:481-504) | | **Keep**; **Rename** "Find" | |
| D71 | "Seats" section (seats.tsx:709) | | **Keep** | |
| D72 | "Delete {game}" (hold) with **"Archive it instead"** inside it (games.tsx:506-526) | POST `{delete}` / `{archive}` | **Keep**; **Move** Archive to its own row | archiving a game is only offered inside its Delete; and there is no Unarchive (M7) |
| D73 | "Delete {game} for good, now" (games.tsx:502, 528-556) | DELETE | **Keep** | |

### Reports and a report (reports.tsx)

| # | Label | What it does | Verdict | Why |
| --- | --- | --- | --- | --- |
| D74 | Reports list: Open · Done (reports.tsx:25-28) | | **Keep** | |
| D75 | A report: the message, "Mark done" / "Reopen", **"Act as {who}"**, "From", History, "Delete this report" (hold) (reports.tsx:225-262) | POST `/api/desk/reports/:id` | **Keep**; **Rename** Act as (D52) | no way to answer the sender (M10) |

### Shows, a show, its sites and art (shows.tsx, art.tsx)

| # | Label | What it does | Verdict | Why |
| --- | --- | --- | --- | --- |
| D76 | Shows list: All · Airing · Not a game yet · Added by name · Archived; Name · Most games; Restore (shows.tsx:29-39, 146-270) | | **Keep** | New show isn't here (D148) |
| D77 | Show: lower third; "Archived" + "Restore {show}"; "Added by name: not in the TV listings" + "Looks fine" / "Archive" (shows.tsx:322-371) | POST `/api/desk/shows/:id` | **Keep** | |
| D78 | "Seasons" rows; **"Add a season"** sheet (number, status) (shows.tsx:373-387, 437-560) | | **Keep** | |
| D79 | **"Make it a game: set its rules up"** → New show (shows.tsx:388-392) | | **Keep** | |
| D80 | About the show › "Research sites" · "Art and photos" (shows.tsx:394-404) | | **Keep** | |
| D81 | **"Its words"** sheet: the show's words for its people, groups, episodes (shows.tsx:404-410, 565-626) | | **Rename** "What the show calls things"; **Merge** with the rulebook's cast words (C49) | two places say what the show calls its people |
| D82 | Research sites: each site with ✕, "Add a site", "Back to our usual three" (shows.tsx:775-808) | | **Keep**; **Rename** "our usual" | |
| D83 | A site's source word **"Its wiki"** (shows.tsx:739 FROM_WORD) | | **Drop** | no wiki since decision 9 |
| D84 | Art: Header and Cards, each "Where it's from" and "Framing" (art.tsx:124-131) | `/api/desk/shows/:id/art` | **Keep** | |
| D85 | "Cast photos" by season → Cast; "Find art and photos again" (art.tsx:165-187) | | **Keep** | |
| D86 | **"No art or photos"** panel with "Turn them back on" AND "Switch it off › No art or photos" switch (art.tsx:147-158, 189-198) | `{off}` | **Merge** into one switch, worded positively ("Show art and photos") | two controls, one negative |

### A season and its pages (pages.tsx:238-294; setup.tsx; research.tsx; cast.tsx; castaway.tsx; bingo.tsx; episode.tsx)

**The season page**

| # | Label | What it does | Verdict | Why |
| --- | --- | --- | --- | --- |
| D87 | Lower third, facts; "Part of": the show; "{season}'s rulebook" · "its games play by it" / "its games play by the show's rules" (pages.tsx:249-266) | | **Keep**; **Rename** its line | the second wording can't happen while the rulebooks flag is on |
| D88 | Section **"Running it"**: Setup · "Research and the bot" · Cast · Bingo bank, each with a line and a need-dot (pages.tsx:270-277) | | **Rename** ("Manage season"; "Research bot") | settings-r0-names |
| D89 | "Episodes" rows, each to its page (pages.tsx:279-289) | | **Keep** | |

**Setup** (`/api/desk/seasons/:id/setup`, desk-setup.ts, desk-schedule.ts)

| # | Label | What it does | Verdict | Why |
| --- | --- | --- | --- | --- |
| D90 | "No schedule yet" · "Find it in the TV listings" / "Set it by hand" (setup.tsx:72-88) | | **Keep** | |
| D91 | "The season" › "Name" (Save) · "Status": Upcoming / Airing / Ended, "Back to its listing's dates" (setup.tsx:89-94, 226-303) | | **Keep** | |
| D92 | "Schedule": the rundown, "All N episodes" sheet (setup.tsx:95-125, 146-165) | | **Keep** | |
| D93 | "When it airs": Weekly · Nightly · All at once; First episode; At; Time zone; "What moves"; "Save the new times" (setup-schedule.tsx:94-214) | tier 2 preview | **Keep** | its date and time pickers are forced dark (§8) |
| D94 | "Episodes": stepper, "What's cleared", "Save: N episodes" / "Clear and save" (setup-schedule.tsx:222-296) | | **Keep** | |
| D95 | "TV listing": "Find another listing" · "Unlink it" · "Use this listing" (setup-schedule.tsx:304-446) | | **Keep** | |
| D96 | **"Results" › "Who decides results"**: "Sources that agree" (Recommended) · "You decide" (setup.tsx:132-136, 305-338) | POST setup `{resultsBy}` | **Drop** after its data step (BACKLOG 168) | §4; its line "once 2 agree; what they can't settle comes to your Inbox" tells the old rule |
| D97 | **"Made-for games"**: "Make them" / "Make more"; "Start over" → "Tap again to start over" (setup.tsx:170-224) | POST `/api/desk/seasons/:id/made` | **Keep**; **Rename** "Suggested games" | "Tap again" is a fifth way to confirm: use the hold |
| D98 | Its Delete note "A game is deleted on its own Manage this game until the desk gives games pages of their own." (setup.tsx:373) | | **Rename** | the desk has game pages with Delete (games.tsx:506) |

**Research** (`/api/desk/seasons/:id/research`, desk-research.ts, desk-bot.ts)

| # | Label | What it does | Verdict | Why |
| --- | --- | --- | --- | --- |
| D99 | Lower third **"Autopilot on" / "Autopilot off"** (research.tsx:115) | | **Rename** "Automatic research on/off" | |
| D100 | **"Run now"** · "One at a time": Full results, Who went home, Schedule check, Episode facts, Trivia, Bingo squares; sheet "X, now" · "Ask it now" (research.tsx:118-139, 630-680) | POST research `{now}` | **Keep**; **Rename** "Research now" | |
| D101 | "Its schedule" › switch **"Runs on its own"** · 'Couches see "Autopilot · On for this season."' (research.tsx:157-163) | POST `{on}` | **Keep**; **Rename** | the couch-facing word changes with it |
| D102 | The rail "Around Episode N": each run's switch and timing sheet; the end row's "Change" → **"Episode length"** sheet (research.tsx:164-190, 979-1023) | | **Keep** the rail; **Move** Episode length to Setup's schedule (C49) | length is a schedule fact, not a bot one |
| D103 | "Episode N has its own runs" · "Back to the season's schedule"; "Add a run" (N of 8); "Not in its schedule" · "Our usual runs" with Add (research.tsx:191-243) | | **Keep**; **Rename** "our usual" → "the default schedule" | |
| D104 | Aside **"Reset"** · **"Make this our usual"** (research.tsx:143-153, 301-354) | `{reset}` / `{makeUsual}` (tier 2) | **Move** Make this our usual to the Research bot page | it changes every season's default from inside one season |
| D105 | "Runs": the latest 5, "All N"; a run's sheet, **"Asking ChatGPT"** (research.tsx:246-265, 686-760; line 695) | | **Keep**; **Rename** the AI name | hard-coded even when the bot asks Claude (§3) |
| D106 | "Not in the games yet": episodes with waiting results (research.tsx:268-278) | | **Keep** | decision 7: there for anyone who looks |

**Episode** (`/api/desk/seasons/:id/episodes/:n`, desk-episode.ts)

| # | Label | What it does | Verdict | Why |
| --- | --- | --- | --- | --- |
| D107 | "Hasn't aired" panel; "Players' final results are due …" (episode.tsx:119-137) | | **Keep** | |
| D108 | Switch **"Hide names"** (episode.tsx:138-146) | page state only | **Keep** | a spoiler guard for the admin |
| D109 | "Not in the games yet": rows with ✕ ✓, "Who?", "Accept all N" → MovesSheet (episode.tsx:148-180, 334-347) | `{acceptAll}`, accept/reject | **Keep** | |
| D110 | The note under it: "You decide its results: nothing reaches the games until you accept it." / "Each reaches every game once N sources agree, or once you accept it." (episode.tsx:182) | | **Rename** | both are the old rules; a waiting result now waits for a second look |
| D111 | "Disputed" rows with **"Decide"** → the Fact page (episode.tsx:185-200, 490-493) | | **Merge**: decide in this page's fact sheet (D127) | two pages decide one result |
| D112 | **"Holdings check"** (episode.tsx:202-213) | | **Rename** ("Who holds what doesn't add up") | engine word |
| D113 | Catch-up held card: "Our bot asked this episode again for the catch-up. Its answer would change scores." · "Would change scores" · Send / Leave it out (episode.tsx:887-940) | POST `/seasons/:id/catchup {hold, decision}` | **Keep** while catch-ups exist | the results-settle plan calls the hold "mostly moot" now (PLAN-results-settle.md, Noticed) |
| D114 | "In every game" groups → a group sheet → a fact sheet: "Correct it", "Take it out of every game", "Unlock it", "Put it back" (episode.tsx:217-236, 610-690) | decide/reopen | **Keep** | |
| D115 | "N results rejected or taken out" (episode.tsx:229-233) | | **Keep** | |
| D116 | "A game doesn't match" · "Make every game match" (hold) (episode.tsx:237-251, 410-436) | `{match}` | **Keep** | |
| D117 | "Answers": each source → "Take it back"; **"Paste an answer"** · **"Ask our bot"** (episode.tsx:256-273) | `{paste}` (AskAiPasteSheet) / Run now | **Keep** | paste is the fallback when the bot is down |
| D118 | "Trivia": each question, Take it out / back; "Write trivia now" (episode.tsx:277-307) | | **Keep** | |
| D119 | "Bingo" row → the bank (episode.tsx:310-320) | | **Keep** | |
| D120 | **"Clear Episode N's results"** (hold), alt "Clear only what's waiting" (episode.tsx:323-329, 369-409) | DELETE `?scope=` | **Keep** | |

**The Fact page** (pages.tsx:62-160; `/api/desk/facts/:id`)

| # | Label | What it does | Verdict | Why |
| --- | --- | --- | --- | --- |
| D121 | Tag "Disputed" / **"Canonical"** / "Removed" / "1 source" / "Confirmed"; "in every league" / "in no league" (pages.tsx:54-60, 84) | | **Rename** | "canonical" and "league" are engine words |
| D122 | "Says it happened" / "Says it didn't"; "Where it counts": "N leagues … house rulings keep it whatever you decide" (pages.tsx:101-117) | | **Rename** | "league", "house ruling" |
| D123 | **"It happened" / "It didn't happen"** → GuardSheet "Becomes canonical and locked" (pages.tsx:119-156) | `{decide}` | **Merge** with the episode's fact sheet (Accept / Reject) | one decision, two pages, two vocabularies |
| D124 | "Something else: edit the fact" → "Override · X" sheet (pages.tsx:127-131, 176-234) | `{edit}` | **Merge** with the episode's "Correct it" | same |
| D125 | "Unlock and reopen" (pages.tsx:132-136) | `{reopen}` | **Merge** with "Unlock it" | same |
| D126 | Back defaults to "Inbox" (pages.tsx:67-73) | | **Drop** with the page | it's reached from an episode now |
| D127 | "Part of" · the season · "The season · Episode N" (pages.tsx:98-100) | link | **Merge** into the episode's fact sheet with the rest of the page (D111, D123-126) | the sheet already sits on that episode |

**Cast** (`/api/desk/seasons/:id/cast`, desk-cast-page.ts)

| # | Label | What it does | Verdict | Why |
| --- | --- | --- | --- | --- |
| D128 | Review card "See what changed" → diff (Same person / Someone new; Keep ours / Use theirs) → "Send to N games" (tier 2) (cast.tsx:159-169, 252-270, 378+) | `{send}` | **Keep** | |
| D129 | "No cast yet" · "Ask our bot for it" / "Paste it" (cast.tsx:170-184) | | **Keep** | |
| D130 | "Getting it" › "Ask our bot again" · "ChatGPT reads the cast from the web…" / "Paste it" (cast.tsx:186-197; line 193) | | **Keep**; **Rename** the AI name | |
| D131 | "Starting {groups}" with "Not a {group}"; **"Hold them until Episode N"** switch (cast.tsx:201-240) | `{clearGroup}`, `{hold}` | **Keep** | the hold guards a spoiler |
| D132 | "The {people}" grid → castaway (cast.tsx:242-247) | | **Keep** | |

**Castaway** (castaway.tsx; `/api/desk/castaways/:id`)

| # | Label | What it does | Verdict | Why |
| --- | --- | --- | --- | --- |
| D133 | "About them": Name · Photo · Starting {group} · properties · Bio, each "Override" (castaway.tsx:112-122) | tier 1 with Undo | **Keep** (D7's rename) | |
| D134 | Lock: "Locked: no answer or commissioner changes them" (castaway.tsx:125-130) | | **Keep** | |
| D135 | "Remove {name} from the cast" (blocked list, or hold) (castaway.tsx:133-180) | | **Keep** | |

**Bingo bank** (`/api/desk/seasons/:id/bingo`, desk-bingo.ts)

| # | Label | What it does | Verdict | Why |
| --- | --- | --- | --- | --- |
| D136 | Strip "The season's" · "Ep N"; the bank's panel; "Write them again" / "Paste squares"; Likely · Maybe · Long shot · Out of new cards; a square's sheet, Hide / Show it again (bingo.tsx:105-356) | | **Keep** | |

### Rulebooks, the library and New show (rulebook.tsx, library.tsx, new-show.tsx; `/api/desk/rulebooks/:id`, `/api/desk/library`)

| # | Label | What it does | Verdict | Why |
| --- | --- | --- | --- | --- |
| D137 | "A player made it" · **"Take it over"** (rulebook.tsx:140-153) | `{takeOver}` | **Keep**; **Rename** "Make it official" | settings-r0-names |
| D138 | "In the library": switch "A starting point for new shows"; **"Delete it from the library"**, mid-page, on one tap with no confirm (rulebook.tsx:155-198) | `{delete}` | **Move** Delete to the page's foot as a named red row with a hold | breaks decision 4, and is the desk's only unguarded delete |
| D139 | "Fits these games" · "Fits · comes with episode games (step N)" (rulebook.tsx:200-215) | | **Rename** | "step N" is a plan step number |
| D140 | **"Leagues play by it"** switch (rulebook.tsx:220-245) | `{action:"live"}` | **Drop** | disabled while the flag is on, and ignored by the server (db/rulebooks.js:53-58) |
| D141 | Confirm: "When did X start?" with Episode chips (rulebook.tsx:247-264) | `{phase}` | **Keep** | |
| D142 | "The rulebook" · "Read it"; each part's editor; sticky "N unsaved changes" · Discard / Save → "Fix a mistake" / "The show changed" (rulebook.tsx:267-282, 392-410, 1404-1460) | | **Keep** | the one save that must preview its reach |
| D143 | "Research": "Check for changes", "What scores", "How the scoring is playing"; "Something new?"; "Suggested fixes" (rulebook.tsx:283-341) | | **Keep** | |
| D144 | Lock; "Timeline" · "Not spoiler-safe"; History (rulebook.tsx:344-376) | | **Keep** | History here is full, elsewhere the latest three |
| D145 | "Save as a starting point for new shows" (rulebook.tsx:377-390) | `{template}` | **Keep** | |
| D146 | Library: "Start from" (templates by kind; **Proposed** shapes, dashed, tap → a toast; "Make it a template" once earned); "Made by players"; "Drafts"; "In use" (library.tsx:28-60, 118-158) | `/api/desk/library {earn}` | **Keep**; **Drop** the unearned cards' button look | they look like buttons and only toast (settings-audit) |
| D147 | Library's line "… sends the nearest one to ChatGPT to correct …" (library.tsx:32) | | **Rename** | |
| D148 | Sticky **"New show"** on the Library (library.tsx:65-70) | → `/desk/new` | **Move** to the Shows list | a show is made from Shows, not from rulebooks |
| D149 | New show, step 1 "Which show?" (new-show.tsx:108-215) | | **Keep** | |
| D150 | Step 2 "How do you want to start?": **"Ask ChatGPT for me"** · "Copy and paste it yourself" · "Or start from a starting point" (new-show.tsx:249-288) | | **Keep**; **Rename** "Ask our bot" | the bot may ask Claude; every other screen says "our bot" |

### The engine lab (`/desk/lab`)

| # | Label | What it does | Verdict | Why |
| --- | --- | --- | --- | --- |
| D151 | The whole page (src/new/lab/lab.tsx) | `/api/desk/lab` | **Move**: give it a labelled row (Site settings › Tools) | nothing on the desk links to it (grep finds only the lab's own Back) |

**Counts** (151 items; an item can carry two verdicts, such as Keep and Rename): Keep 101 · Rename 42 · Move 11 · Merge 9 · Drop 8 ·
Default 3 · Script 1, 175 verdicts in all. By each item's first verdict: Keep 101 · Rename 23 · Move 8 · Merge 8 · Drop 7 · Default 3
· Script 1.

---

## 3. Words

| Today | Where | Problem | Proposed |
| --- | --- | --- | --- |
| Admin (title) | desk.tsx:53, 91; page.tsx:6 | the doors say "Site admin" | **Site admin** |
| Inbox · Find · Settings | desk.tsx:45 | "Settings" names four screens | **To do · Search · Site settings** |
| Needs you | desk.tsx:258 | the app dropped it | (the tab's name, To do) |
| Our bot · Autopilot · Runs on its own · Run now · Our usual · Make this our usual | desk.tsx:724-731; research.tsx:115, 118, 157-161, 143-153; desk-bot-words.ts:122-127 | cheeky and five names for one thing | **Research bot · Automatic research · Research now · Default schedule · Make this the default** |
| Research and the bot | pages.tsx:273 | | **Research bot** |
| Running it | pages.tsx:270 | | **Manage season** |
| Act as them / Act as {name} | people.tsx:384-398; reports.tsx:241; seats.tsx:247 | | **Sign in as {name}** |
| View as (an eye) | view-as.tsx:40-43 | unlabelled | **Preview as a player** |
| Who gets in · Let in / Let {name} in | desk.tsx:695; people.tsx:63, 362 | | **Sign-up approval · Approve** |
| Take it over | rulebook.tsx:148 | | **Make it official** |
| Its words | shows.tsx:408, 579 | vague | **What the show calls things** |
| Made-for games | setup.tsx:209 | | **Suggested games** |
| Game admin; "sees nothing backstage" | seats.tsx:54-60 | the app says Helper; Backstage is gone | **Helper**; "Plays" |
| Hand it on / Hand them on | seats.tsx:866; pages.tsx:374; games.tsx:440 | | **Make someone else the Commissioner** |
| Override · Save override | parts.tsx:386, 475-540; castaway.tsx | internal verb | **Change** (keep the line that it wins over research) |
| Settings history | desk.tsx:751 | | **Change history** |
| fact; Fact (page title) | pages.tsx:67-73; desk.tsx:318 "Fact" tag | engine word | **result** |
| Canonical; "Becomes canonical and locked" | pages.tsx:56, 144, 153, 157 | engine word | **Decided by you; locked** |
| league / leagues | pages.tsx:84, 115, 147; desk.tsx:741; rulebook.tsx:232 "Leagues play by it"; settings-flag.tsx "Check every league" | the glossary says game | **game / games** |
| house ruling(s) | desk.tsx:301; pages.tsx:115, 345 | the app says "Keep our result" | **kept their own result** |
| Holdings check | episode.tsx:204 | engine word | **Who holds what doesn't add up** |
| castaway | desk.tsx:374, 443; Find tag "Cast" | Survivor's word on a universal screen (the castaway page itself uses the show's word, castaway.tsx:100) | **cast member** / the show's own word |
| ChatGPT (hard-coded) | research.tsx:695; cast.tsx:193; new-show.tsx:257, 269; library.tsx:32; rulebook.tsx:620; desk-research.ts:183, 490, 585, 644, 680; desk-episode.ts:343 | **wrong when the bot asks Claude** (botAi, desk.tsx:828-835) | **our bot** (or the AI it asked, from `bot_ai`) |
| Still split (on a waiting row) | desk.tsx:117 | misleading | **Waiting** |
| "confirmed by 2+ sources" | desk.tsx:299 | old rule; ignores the setting | **results the bot settled** (unsure: pick the count that matters now) |
| "The couches are handling it"; "Results settle by the couches" | desk.tsx:54, 269 | untrue now | **The bot is handling it** |
| "nothing reaches the games until you accept it" / "once N sources agree" | episode.tsx:182 | old rules | one line: a result is in once the bot reports it; a second look after final |
| "Sources that agree … what they can't settle comes to your Inbox" | setup.tsx:319 | old rule | goes with D96 |
| "Two people's answers agreeing" | desk.tsx:784 | most sources are the bot | goes with D39 |
| "… waiting on results" | desk-inbox.ts:159 | nobody waits on results now | "… waiting on someone to run them" |
| "until the desk gives games pages of their own" | setup.tsx:373 | it has them | "Delete it from its own page" |
| "(step N)" | rulebook.tsx:211 | plan step number | drop the step |
| "Its wiki" | shows.tsx:739 | no wiki | drop |
| aria-label "Show" on filter groups | people.tsx:135; couches.tsx:141; shows.tsx | a filter, and "show" means a TV show here | **Filter** |

---

## 4. Dead or near-dead

| Control | Evidence from the code | What's left of it | Verdict |
| --- | --- | --- | --- |
| **Sources to confirm a result** (D39) | `settleFact` (fact-status.ts:178): a result with no voice against it is `reported` below N and still `live` (fact-status.ts:191-195, "One look is enough"). N only decides `confirmed` vs `disputed` when a majority is short of N (fact-status.ts:178) | a 2-to-1 at N=3 becomes a dispute for the tie-break; the "N sources agree" label (fact-status.ts:203) | **Default** 2 |
| **When answers disagree** (D40) | your rule (2026-11-20) and production's value are "on"; the code's default is off | an emergency stop; the bot's tie-break is the only way a split settles without you | **Default** on (flip the code's default) |
| **Who fills in results on new couches** (D41) | read once, when a couch is made (couches.ts:84-85) | the couch's own switch (D63) still gates a player's Fill in (backstage.ts:82; season-episodes.ts:183) | **Default** anyone |
| **Who decides results** (D96) | every desk accept locks, and a locked result reaches every game either way (BACKLOG 168). Not fully dead: `results_by = 'admin'` adds a cutoff (`results_admin_since`) and lets admin-only results through (season-decisions.ts:160-171, 421-430); Survivor 51 is on "You decide" | the cutoff filter on one season | **Drop** after a data step (BACKLOG 168) |
| **Leagues play by it** (D140) | `seasonLive` returns true for every season while the flag is on (db/rulebooks.js:53-58); the switch is `disabled` (rulebook.tsx:227) | nothing in production | **Drop** |
| **Rulebooks: every season at once** (D46) | a one-time flag, on in production; `scripts/rulebooks-flag.js` does status, check, on, off | a rollback path | **Script** |
| **Gemini** (D45) | a dimmed card that only toasts (desk.tsx:833) | nothing | **Drop** |
| **Autopilot** row (D43) | a read-only list; every change is on each season's Research | a summary | **Merge** into the Research bot page |
| **The library** row in Settings (D47) | a second door to Browse's row | nothing new | **Drop** |
| **Catch-up hold card** (D113) and its Inbox rows (D23-25) | the results-settle plan: with two looks after final, the catch-up's lone answers can't move scores, so the hold is "mostly moot" (PLAN-results-settle.md, Noticed) | the next catch-up, if there is one | **Keep** until the catch-up is retired; unsure when |
| **"Paste an answer"** (D117), **Paste it** (D129), **Paste squares** (D136) | the bot asks on its own; pasting is the admin's own copy-and-paste | a fallback when the bot is down | **Keep**, quieter |
| **Hide names** (D108) | page state only, stores nothing | a spoiler guard | **Keep** |
| **Proposed shapes** (D146) | an unearned card's tap is a toast (library.tsx:146-153) | information | **Drop** the button look |
| **"Its wiki"** (D83) | no wiki reads (wiki-sync.js header; decision 9) | a word | **Drop** |
| **Coming up's "You decide results"** (D28) | goes with D96 | | **Drop** with it |

---

## 5. Missing

What an operator would expect but can't do from the desk. Each is a gap the code shows; none is designed yet.

| # | Missing | Today | Evidence |
| --- | --- | --- | --- |
| M1 | **Settle again** as a desk action (A20) | POST `/api/desk/settle-again`, "no screen of its own" (route.ts:7); run twice on 2026-11-20 as a same-page fetch in a signed-in browser | desk.ts:151-176; PLAN-results-settle.md "After the push" |
| M2 | **Release the catch-up hold** (A20) | `node scripts/catch-up-load.js release --endpoint=… [--production]` with a connection string in a clipboard window; the Inbox row only tells you so (desk-inbox.ts:291) | catch-up.ts:156-160; scripts/catch-up-load.js header |
| M3 | **Start a catch-up, or Try again after it stopped; take its next step now** | POST `/seasons/:id/catchup {start}` / `{step}` exist; no button anywhere; the Inbox's "stopped" row links to Setup, which has none | catchup/route.ts:30-36; desk-inbox.ts:294 |
| M4 | **A game's settings on its desk page** (A19) | the game page has Part of, Join code, Seats, History, Delete (games.tsx:450-527); its rules, lock, pace, waivers and name are only on its own Manage this game | games.tsx |
| M5 | **Is the bot up?** | nothing on the desk says the bot is down until a Run now fails ("Our bot isn't answering right now", desk-research.ts:568, 627, 663) | |
| M6 | **Which AI each kind of run asks** | `bot_ai_runs` is read by the bot and set by PUT `{botAiRuns}` only: "no screen yet" | desk.ts:96-98 |
| M7 | **Unarchive a game**; **archive** without opening Delete | Archive lives inside Delete's sheet (games.tsx:520); no route or row brings an archived game back (desk-games.ts has archive, delete, restore-deleted) | |
| M8 | **Rename a game**; **remove one person from one game** while keeping their seat history | the seat sheet has "Take {name} out of {game}" (a hold); no rename | seats.tsx:275 |
| M9 | **The engine lab's door** | `/desk/lab` exists, nothing links to it | §2 D151 |
| M10 | **Answer a report's sender** | Mark done only; "Delete this report · {who} isn't told" | reports.tsx:233-262 |
| M11 | **The game-specs flag** | `scripts/game-specs-flag.js status/check/on/off` from the user's terminal (on in production since 2026-10-30) | HOSTING.md:1306; keep as a script (it pairs with D46) |
| M12 | **Clear an orphaned catch-up lock** | `scripts/catch-up-locks.js status/clear` (found in production 2026-11-16) | keep as a script: a database repair, rare |
| M13 | **Run the TV listings job now** | `/api/cron/listings` with CRON_SECRET "for a run by hand" | HOSTING.md:1164; unsure it's needed: Setup's TV listing sheet covers one season |
| M14 | **What's New drafts** | postponed by you (2026-10-29: "why bother") | PLAN-desk-parity.md decision 8; not missing for now |

Backups (`scripts/backup-leagues.js`), restores and migrations stay scripts: they need connection strings the site shouldn't hold.

---

## 6. Drill tree

Depth counts taps from the tab. Each level gets a structural verdict (keep, repaint, restructure, new display, new screen).

```
To do (Inbox) ─┬─ a results row ── Episode N ── a fact sheet ── Fact page          (4)
               ├─ a couch row ── Couch ── a person ── a seat sheet                  (4)
               ├─ a rulebook row ── Rulebook ── a part's editor                     (3)
               ├─ report / show / people rows ── their page                         (2)
               └─ Coming up ── Season ── its pages                                  (3)
Search (Find) ─┬─ People ── Person ── a seat sheet ── Act as / Hand on              (4)
               ├─ Couches ── Couch ── Game ── a seat sheet                           (4)
               ├─ Games ── Game ── a seat sheet                                      (3)
               ├─ Shows ── Show ─┬─ Season ─┬─ Setup ── When it airs                 (5)
               │                 │          ├─ Research ── a run's sheet             (5)
               │                 │          ├─ Cast ── Castaway ── Override          (6)
               │                 │          ├─ Bingo ── a square                     (5)
               │                 │          └─ Episode N ── a fact ── Fact page      (6)
               │                 ├─ Research sites                                   (3)
               │                 └─ Art ── Where it's from / Framing                 (4)
               ├─ Library ── Rulebook ── a part's editor;  Library ── New show       (3)
               └─ Reports ── Report                                                  (2)
Site settings ── a setting's sheet ── (Autopilot) a season's Research                (3)
```

| Level | Verdict | Why |
| --- | --- | --- |
| To do (the Inbox list) | **Restructure** | one list of fifteen kinds, sorted by kind not urgency; three rows lead nowhere (D24-26); results rows now one an episode is right |
| Coming up | **Keep** | the week as a rundown is the desk's best display |
| This week, on its own | **New display** | four counts, two in old words; what the owner wants to know now is what the bot settled and what changed after final |
| Search (Find) and Browse | **Keep**, repaint | |
| The seven lists | **Keep** | one pattern (search, filters, sort, 25 at a time, in the address) |
| A person, couch, game, report | **Keep**, repaint | the frame (lower third, facts, Part of, History, Delete last) works |
| A game | **Restructure** | needs its settings (M4) and Archive as its own row (M7) |
| A show | **Keep** | |
| Research sites, Art | **Keep** | Art's two "off" controls merge (D86) |
| A season | **Keep**, repaint | the hub of four pages and the episodes is right; rename its section |
| Setup | **Restructure** | Results goes (D96); Episode length arrives (D102); Made-for games is a different job from scheduling |
| Research | **Restructure** | the season's own runs stay; the site-wide default, which AI, and Autopilot's list go to one Research bot page (**new screen**) |
| Cast, Castaway, Bingo | **Keep** | |
| An episode | **Restructure** | its Results section explains old rules (D110), and Disputed sends you to a second page to decide (D111) |
| The Fact page | **Merge** into the episode's fact sheet | the same decision in two places |
| A rulebook | **Keep**, repaint | its library Delete moves to the foot (D138); the dead switch goes (D140) |
| Library | **Keep** | New show moves out (D148) |
| Site settings | **Restructure** | seven rows become about three (Sign-up approval, Game previews, Change history) plus doors: Research bot (new), Tools (the lab, View as) |
| Research bot | **New screen** | one page for automatic research on every season, the default schedule, which AI (and per run), the second look, and Settle again (M1) |

---

## 7. Duplication

| The thing | Its homes | Note |
| --- | --- | --- |
| Deciding a disputed result | the episode's fact sheet (Accept / Reject / Correct it / Unlock it) and the Fact page (It happened / It didn't happen / edit the fact / Unlock and reopen) | two vocabularies (D111, D123-127) |
| A season's Delete | the foot of the season, Setup, Research, Cast and Bingo pages (pages.tsx:291; setup.tsx:139; research.tsx:281; cast.tsx:250; bingo.tsx:132) | decision 4 says every page ends with its Delete; five copies of one season's is your call (below) |
| A show's Delete | the show, Research sites, Art (shows.tsx:414, 807; art.tsx:201) | same |
| The bot's settings | Settings › Autopilot, Settings › Which AI, each season's Research (on, runs, length, Make this our usual), Settings › When answers disagree | five places (C46) |
| Who fills in results | Settings (new couches), the couch page, Backstage › Results in the player app | |
| What the show calls its people | the show's Its words, the rulebook's cast words | C49 |
| The library | Find › Browse and Settings › The library | D47 |
| Reports and waiting accounts | the Inbox and Find › Browse's counts | fine: the Inbox is the job, Browse the list |
| Art off | the panel's "Turn them back on" and the "Switch it off" switch | D86 |
| Archive a game | only inside Delete; in the player app on its list, settings and Games tab | |
| Getting results in | the episode's Ask our bot, Research's Run now, the episode's Paste an answer | one action, three doors: fine, but the words differ ("Ask our bot", "Run now", "Ask it now") |

**Ways to save**, as they are on the desk:
1. Tap a choice card: at once, toast with Undo (Settings, Setup's Status).
2. A sheet with Save (Name, Its words, Episode length, a run's timing, Name and email).
3. Override, then "Save override" (castaway fields, a fact's edit).
4. A switch: at once, some with Undo (Runs on its own, Hold them until, No art), some without (the rulebook's starting-point switch, `post()` toasts plainly).
5. A preview, then confirm (When it airs, Accept all, Send to games, a fact's decision).
6. A hold (every Delete, Clear, Make every game match).
7. Tap twice within five seconds (Made-for games' Start over, setup.tsx:176-185).
8. A draft with a sticky Discard / Save, then "Fix a mistake" or "The show changed" (the rulebook).
9. Nothing at all: the library's Delete (rulebook.tsx:186-197).
10. Inline ✓ ✕ on a row (the episode's waiting results).

Undos the server keeps that no toast offers: the couch's Who fills in (pages.tsx:464), a fact's decision (pages.tsx:153: the sheet says "Undo it from History"), and the rulebook page's posts.

---

## 8. Wide vs phone

- **Every desk page is a 390 px column at any width.** The new design's shell caps itself at `--nd-col: 390px` (new.css:15, 62-66),
  outlined from 760 px (new.css:72-75). The desk uses one breakpoint class in 13,000 lines. At a desk that's a phone-width strip
  in the middle of the screen: BACKLOG 197 ("Desktop layouts, the desk first"), decision 3 ("a wide layout, a list beside its
  detail, after the flows settle").
- **The pages that waste a wide screen most:** the seven lists (each wants its item beside it); the Inbox (To do beside the week);
  an episode (results, answers and trivia are three columns of one job); Research (the rail and the runs side by side); the
  rulebook (parts beside their editor, now a stack of sheets); Setup's rundown.
- **Sheets on a wide screen:** every edit opens a bottom sheet over the column; at a desk a side panel would keep the page in view.
- **Breaks at 390 (from the code, not rendered):**
  - Setup's date and time pickers are forced dark (`[color-scheme:dark]`, setup-schedule.tsx:18), wrong in Studio.
  - The header's title is capped at 46vw (parts.tsx:131), about 180 px: long season names truncate on every page.
  - The Bingo strip scrolls sideways (bingo.tsx:187), fine on a phone, a hidden overflow on a desk.
  - Unsure: the Research rail's four-column grid (research.tsx rail rows, `grid-cols-[64px_20px_minmax(0,1fr)_auto]`) with long run names.
- **Nothing is phone-only in behaviour** (no swipe-only control); it's all layout.

---

## Needs your decision

1. **"When answers disagree": default on and drop the switch, or keep it as an emergency stop** (on the Research bot page)? The
   settings plan said default (C45).
2. **"Who decides results"' data step** (BACKLOG 168): move Survivor 51 off "You decide" (and its `results_admin_since` cutoff)
   before the control goes. What-would-move first, as for settle-again.
3. **A season's and a show's Delete on every sub-page** (decision 4's "every desk page ends with Delete") or **only on the
   thing's own page**? Today: five copies of a season's, three of a show's.
4. **The Fact page: merge it into the episode's fact sheet** (one place, the episode's words), or keep it as the dispute's own page?
5. **Settle again and the catch-up release as buttons** (M1, M2): on the Research bot page, behind a hold? Both reach every game.
6. **The rulebooks flag to a script** (D46): it has a rollback ("Switch it off"). Fine to lose that from the screen?
7. **A game's settings on its desk page** (M4): the same Manage this game, opened as the site admin, or a desk page of its own?
8. **"Override" → "Change"** across the desk (D7)?

The other renames follow settings-r0-names.md's desk table, which you saw in Round 0; the round's clarify pass checks them.

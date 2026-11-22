# What admin needs that it doesn't have

> **Status (2026-11-22): Reference** for the site admin's desk round (the settings plan's Round 5,
> [PLAN-settings-overhaul.md](../PLAN-settings-overhaul.md); Round 0's papers: [desk-r0-audit.md](desk-r0-audit.md),
> [desk-r0-spec.md](desk-r0-spec.md)). Read on master de50aed6 from docs/BACKLOG.md (every section), docs/PLANS.md, the status,
> next, open and noticed sections of every docs/PLAN-*.md, docs/UI-REVIEW-MAP.md and docs/HOSTING.md, with a few checks in the
> code where a doc was old. Nothing else was changed. Line numbers drift; search for the words.

**What this adds to the audit.** The audit read the desk's code and listed 14 things missing (M1–M14, its §5). They're referred to
here by number, not repeated. This paper reads everything planned or waiting, to find what else admin needs: jobs you do by hand
today (a script, a SQL query, a browser trick, another service's dashboard), known bugs, and the admin work that future features
bring. D numbers are the audit's controls. Each need has a number (N1–N66), so you can answer by number.

**How to read a row**
- **When:** *dated* (needed by a date) · *now* (ready; nothing blocks it) · *next* (after one thing lands) · *future* (a planned
  feature) · *idea* (not planned).
- **Size:** S under an hour · M about a session · L several sessions (the backlog's sizes).
- **Where it belongs:**
  - **This round:** the reorganization itself (navigation, grouping, names, missing buttons), plus small fixes on the pages it
    redraws.
  - **Later round:** it needs its feature, an engine change or your decision first. The new structure leaves room for it.
  - **Outside admin:** it belongs in a script, another service's dashboard, or a server fix with no admin screen.

**The counts:** 66 needs. 27 belong to this round, 29 to a later round and 10 outside admin.

| Area | Needs | This round | Later round | Outside admin |
| --- | --- | --- | --- | --- |
| 1. Results and research | 18 | 10 | 8 | 0 |
| 2. Shows, seasons and cast | 9 | 6 | 2 | 1 |
| 3. Games and couches | 7 | 4 | 0 | 3 |
| 4. People, sign-ups and reports | 7 | 2 | 5 | 0 |
| 5. Site settings, flags and the frame | 7 | 5 | 2 | 0 |
| 6. Hosting and health | 6 | 0 | 1 | 5 |
| 7. Future features | 12 | 0 | 11 | 1 |
| **All** | **66** | **27** | **29** | **10** |

---

## 1. Results and research

| # | What admin needs | Source | When | Size | Where, and why |
| --- | --- | --- | --- | --- | --- |
| N1 | **Know when the research bot is down**, before an episode night's results quietly don't come: up or down, which machine answered (the cloud VM or the home PC), which AI, and what's waiting on it. Today nothing says so until a Run now fails (M5). The bot's self-test emails you through healthchecks.io, and its clock's log is on the VM. | M5; desk-r0-spec.md:31 (S5), :136; BACKLOG 247 (:44), 16 (:727); HOSTING.md:21, :711, :809-810. The server already reads each bot's `/health` (src/lib/server/ask-bot.ts:160) | now | S–M | **This round.** The Research bot page's first line and To do's first row (the spec). It's the one thing that can make "Nothing needs you" untrue. |
| N2 | **A "Nothing needs you" you can trust:** when the bot last looked and what it settled. And "This week" rebuilt to show what the bot settled and what changed after final results. Players are told when a correction after final moves their points; the desk shows none of it, and This week's four counts use the old rules' words (D29). | desk-r0-first-view.md:80, :124-125 (R4, "a small read"); desk-r0-spec.md:115-116; PLAN-results-settle.md:60-62; audit D29 | now | M | **This round.** A new display the spec already asks for, on one small read (each season's last run and what it settled). |
| N3 | **Settle again as a button** (M1), showing what it would move before it runs. On 2026-11-20 it was run twice as a fetch typed into a signed-in browser, and its preview came from `what-would-move.js` on a restored backup. | M1; A20 (PLAN-settings-overhaul.md:329); PLAN-results-settle.md:88-89, :100-102, :123; desk-r0-spec.md:142, :221-222 (choice 6) | now | S–M | **This round.** Research bot › Actions, behind a hold that names its reach ("every game on Survivor 51"). |
| N4 | **The catch-up as buttons:** release the hold (M2; today a script with a connection string in a clipboard window), start one, try again after it stopped, and take its next step now (M3). The "held" and "stopped" To do rows open them (D24, D25). The cast-properties plan promised that Setup could queue a season by hand, but nothing on screen does. An orphaned lock stays a script (M12). | M2, M3, M12; A20; PLAN-cast-properties.md:296-298; PLAN-results-settle.md:172-173 (the hold is "mostly moot" now); audit D24-D25 | now (by the next catch-up) | S | **This round.** Research bot › Actions, and To do rows that lead to them. |
| N5 | **Choose which AI each kind of research asks, on a screen** (M6). The trivia and bingo banks were moved to Codex on 2026-11-07 through `PUT /api/desk/settings`, with no screen. When the ChatGPT Plus trial ends, Codex stops on both bots and they have to go back to ChatGPT. | M6; HOSTING.md:19 (the trial renews as paid unless cancelled), :1394-1401, :1402-1408 | dated (before the Plus trial ends; the date isn't recorded) | S | **This round.** Research bot › Which AI (the spec). If the trial ends first, the same PUT by hand. |
| N6 | **One results rule, explained once.** Move Survivor 51 off "You decide" (a data step, with a what-would-move run first), then drop "Who decides results" and every line that still tells the old rules (D96, D110, the audit's §3). | BACKLOG 168 (:634-639); C44-C45 (PLAN-settings-overhaul.md:293-294); desk-r0-spec.md:215-216 (choice 3) | dated (after the finale, Wed Dec 16) | S–M | **This round.** The words now; the control goes after the data step. |
| N7 | **A finale check for Survivor 51.** Did the winner and the places land? Is anyone research never filed an exit for still "in", above the winner (248)? Is the season marked over? Settle again if a late correction comes. Today this is a walk through the desk by hand (116), and 248's doubts have nowhere to show. | BACKLOG 116 (:31-42), 248 (:49-52); desk-r0-spec.md:32 (S6: "nothing shows the season ended"); desk-r0-check.md:99-104 (finding 3: S6 isn't drawn) | dated (before Wed Dec 16) | M | **This round** for the view, since S6 is one of the round's six situations. This year's walk happens on today's desk, and 248's engine fix goes first, in its own session. |
| N8 | **The desk mustn't spoil your own watching.** Names and outcomes stay hidden on To do and on any episode you haven't marked seen, with one tap to show them. Hide names exists only on the episode page and forgets itself (D108). | desk-r0-check.md:91-97 (finding 2); desk-r0-spec.md:117-119; audit D108 | now | S | **This round.** A rule every shape shares. |
| N9 | **One Research bot page** (C46): every season's automatic research and its schedule in one list you can change, the default schedule, and the tie-break switch. Today Autopilot's list is read-only (D43), so each season is checked one at a time (BACKLOG 124 asks "does Survivor 51 write bingo squares?"). A premiere gets no bingo run (149, a fix to the planner). | C46 (PLAN-settings-overhaul.md:295); desk-r0-spec.md:132-143; audit D43; BACKLOG 124 (:306), 149 (:539-541) | now | M | **This round.** The spec's new screen. 149's planner fix is a server fix beside it. |
| N10 | **Desk leftovers in the results code:** `results-ways.ts` reading desk-bot.ts's schedule, `episode-results.ts` still querying rulings, "in your games" for a ruling only some games keep, and the final push saying what changed since the early results. | BACKLOG 187 (:772-774) | idea (when the files are touched) | S | **This round**, wherever it opens those files: the backlog says to fix them then. |
| N11 | **Phase starts: who confirms them?** Every "when did the merge start?" waits for you on To do (D12; src/lib/server/desk-inbox.ts:122-141), and the rulebook page says "Never guessed: research flags it, you confirm it" (src/new/desk/rulebook.tsx:255). Every show players make adds rows like this. Your rule since 2026-11-20 is that the AI settles and a person corrects afterwards. **A choice for you:** keep confirming each one, or let research's answer stand with a one-tap correction. | audit D12; PLAN-new-design.md:404-407 (its Noticed list, kept as history; still true in the code); PLAN-results-settle.md:33 (decision 1) | next | M | **Later round.** Your decision, then an engine change. To do keeps the row kind for splits. |
| N12 | **A stage's short start name ("the merge")**, written by research for each phase, filled in for older seasons and corrected on the desk. | PLAN-start-a-game-redo.md:879-880 (E7); design-round/decisions.md:1035-1038 | next (with E3's engine work) | S on the desk | **Later round.** The field doesn't exist yet. It'll sit beside the rulebook's phases. |
| N13 | **Edit a rulebook's research checks and research block on the desk.** The editor has no controls for the research block's words or checks, or for the refinements. Per-show checks as data are still an idea. | PLAN-start-a-game-gpt.md:4816-4817, :4894; PLAN-bot-research.md:113-115; BACKLOG 210 (:805-807) | future | M–L | **Later round.** The checks need to be data first. |
| N14 | **Research's "rules note": show it beside Check for changes, or stop asking for it.** Research asks for it every episode, and only classic shows it. | BACKLOG 147 (:531-534) | next (before step C removes classic) | S | **Later round.** It's a prompt change, so it needs your OK first. |
| N15 | **Tell a game's players when a desk rulebook fix moves past points** ("Immunity is worth 3 now, from Episode 1"). The after-final notices cover the bot's corrections to results, not a change to points. | BACKLOG 202 (:793); PLAN-admin-shows-rulebooks.md:660-661; PLAN-results-settle.md:60-62 | idea | S–M | **Later round.** The notice needs designing first. |
| N16 | **Four edges of re-asking after a rulebook change:** episodes that Try again filled after a gap aren't asked again; an episode is asked questions from later rule changes; an edit records the whole points block, so a later fix to the base is undone from the edit on; the re-ask plate cuts off at 390, and a re-ask during a run misses the new question. | BACKLOG ideas 15, 17, 18, 19 (:761-763) | idea | M | **Later round.** The research engine comes first. |
| N17 | **Check for changes floods a built-in format with suggestions** (37 for Traitors 4, 27 for Survivor 49), because research's ids aren't the built-in's. Found 2026-10-28, so check it's still true before acting. | PLAN-playtests.md:1281-1283; BACKLOG 177 (:701-703) | next (after the finale, with S3) | M | **Later round.** It goes with moving Survivor off the built-in reader (S3). |
| N18 | **What a season with no admin trusts:** the rules for a season only the bot watches (tie-break on, sources counted by couch, who left taken from the quick check, a fresh chat for each ask), measured on the tapes before such a season has real players. Take it back on the episode page already withdraws a bot's answer. | BACKLOG 182 (:713-716); src/lib/server/desk-episode.ts `takeBack` | future (before a couch plays a season you don't follow) | M | **Later round.** The rules come first. |

## 2. Shows, seasons and cast

| # | What admin needs | Source | When | Size | Where, and why |
| --- | --- | --- | --- | --- | --- |
| N19 | **A list of seasons** (on air · setting up · over). Today you reach a season only through its show, although it's what you work on most. | desk-r0-spec.md:69-79 (Shape 2's Seasons row); desk-r0-check.md:156-160 (finding 10), :167-170 (finding 12) | now | S–M | **This round.** Navigation. |
| N20 | **A season says what's left:** Rulebook ✓ · Cast ✓ · Schedule — · Games —, each a door. This is a new show's checklist. | desk-r0-spec.md:29 (S3), :122; desk-r0-first-view.md:103-105; desk-r0-check.md:123-128 (finding 6) | now | S | **This round.** |
| N21 | **A season's games, on the season's page.** The page has Part of, Running it and Episodes, but no games (src/new/desk/pages.tsx:238-293), and the Games list can't filter by season. "Games —" above needs this, and so does a split's reach. | src/new/desk/pages.tsx:238-293; audit D66; desk-r0-check.md:130-131 (finding 7: two reach numbers that disagree) | now | S | **This round.** A missing section. |
| N22 | **Cast review: one row per person** when their details and bio both change. Research has its own half: billed names without a quoted nickname, and a property that comes back blank on the first ask. | BACKLOG 146 (:527-529) | now | S | **This round** for the review's rows, since the cast page is repainted. Research's half is outside admin. |
| N23 | **A show whose Getting it ready got stuck should show on To do.** When it stops ("needs a look", or out of tries) only the person who added the show sees it, on the show's page with Try again. The desk's To do has no such row. | src/lib/server/season-fill.ts:229-233; PLAN-getting-it-ready.md:140, :149; src/lib/server/desk-inbox.ts:239-251 (the row kinds) | now | S | **This round.** One more To do row kind, on a read that exists. |
| N24 | **Practice games' counts in the Delete notes** on Setup and a show's page. They're always zero, since the practice games went. | PLAN-start-a-game-redo.md:765-767 | now (when touched) | S | **This round.** The plan says "tidy them when the desk is next touched." |
| N25 | **Add one new cast member mid-season** (a returnee, a new crew member) without re-asking for or pasting the whole cast. And a To do row when research names someone who isn't in the cast. Today the cast page takes whole answers only (D128-D132). | BACKLOG 200 (:791); PLAN-new-design.md:421-423 (its Noticed, kept as history); audit D128-D132 | idea / next | M | **Later round.** It needs a small backend: one person into every game on the season (sports already has one). Leave a To do row kind for it. |
| N26 | **Suggested games made by themselves** after a season's setup research, with each game's blurb checked against its rules. The desk keeps Make more and Start over. | BACKLOG 144 (:470-472); PLAN-start-a-game-redo.md:1218-1220; audit D97 | next | M | **Later round.** The automation comes first. This round only names Setup's section (D97) and swaps "tap again" for a hold. |
| N27 | **Adding a show from the TV listings can land on an archived show.** | BACKLOG 148 (:536-537) | now | S | **Outside admin.** A server fix (`add-show.ts`) with a check case. |

## 3. Games and couches

| # | What admin needs | Source | When | Size | Where, and why |
| --- | --- | --- | --- | --- | --- |
| N28 | **A game's settings on its desk page** (M4): a read-only summary, and "Open Manage this game as the site admin", where rename and remove-one-person already live (M8). | M4, M8; A19 (PLAN-settings-overhaul.md:328); desk-r0-spec.md:123-124, :224-225 (choice 8) | now | M | **This round.** |
| N29 | **Archive a game from its own row, and bring an archived game back** (M7). There's no route that unarchives a game. | M7; audit D72 | now | S | **This round.** One small route. |
| N30 | **The test couch's leftovers:** the desk's test-couch marks, Act as's "from the test couch", and the engine lab's "your test couch". Nothing has used it since 2026-10-31. | BACKLOG 36 (:555-557) | now | M | **This round** drops the desk's marks. The backend and its tables go in a deploy of their own. |
| N31 | **Put the desk on the "when the engine changes, review its screens" map.** A new kind of game, result or sport reaches the desk's game summary (N28), an episode's result kinds and Coming up's lines, but the map lists players' screens only. | docs/UI-REVIEW-MAP.md:16-31 | now | S | **This round**, once the game page has its summary. |
| N32 | **Seats named differently from their accounts:** a one-time `profile.ts renameSeats` run for the seats found. The seat sheet doesn't show the mismatch. | BACKLOG 124 (:316); PLAN-desk-parity.md:74-76 (its Noticed item o) | now (once) | S | **Outside admin.** A one-time script. |
| N33 | **"Make every game match" misses a game holding the wrong value.** It compares by person, so a game with someone in the wrong tribe isn't fixed. | BACKLOG 28 (:367-369); audit D116 | next | S | **Outside admin.** A server fix with a check. The button stays as it is. |
| N34 | **A desk rename of a cast member may not reach every game every time.** Six writers change a game's state outside its lock, and check-new-desk's "every league renames him" is flaky. | BACKLOG 119 (:179-182) | now | S–M | **Outside admin.** A server fix. |

## 4. People, sign-ups and reports

| # | What admin needs | Source | When | Size | Where, and why |
| --- | --- | --- | --- | --- | --- |
| N35 | **Approve everyone waiting at once** (a sign-up wave), and say "Approve both" on a row of two. | desk-r0-check.md:136 (finding 7), :167-170 (finding 12); desk-r0-spec.md:30 (S4) | now | S | **This round.** |
| N36 | **Decide what "Sign in as" may change.** While you're signed in as someone, their follows and settings (their spoiler and follow choices) still accept changes, while pushes, phones, mute and couch chat refuse them. The settings plan left the rule to this round. | PLAN-settings-overhaul.md:770-772, :783-785 | now | S | **This round.** A rule, then a line on the person's page. |
| N37 | **Reply to a report's sender** (M10). | M10; desk-r0-spec.md:156, :227 (choice 10 recommends later) | future | S–M | **Later round.** Mark done stays meanwhile. |
| N38 | **A player's "Something's wrong" on To do.** Today a flag is one more answer for the bot to weigh, and it reaches you only if the bot can't settle it. | BACKLOG 206 (:797) | idea (with a second couch) | S–M | **Later round.** Leave a To do row kind for it. |
| N39 | **Password resets by hand, until people can reset their own.** Username accounts have no email, so the desk's Reset password covers the couch. Continue with Google is built but off, because it needs a Google OAuth client. A self-serve reset by email and Delete my account (A1, A2) wait on this. | BACKLOG 185 (:730-734); PLAN-settings-overhaul.md:306, :310-311; HOSTING.md:24 | future (before strangers sign up) | M | **Later round.** The players' side comes first; then People and Sign-up approval show Google accounts. The OAuth client itself is made in Google Cloud. |
| N40 | **See which notifications went out** (a night's reminders and pushes, per person). The morning-after check for Ep 10 is a production SQL read of `reminder_log`. | BACKLOG 110 (:25-30); PLAN-settings-overhaul.md:313 (A4: the route for a test push exists) | dated (Thu Nov 26, as a read) / future | M | **Later round.** A "pushes sent" list on a person's page. Nov 26's read stays a script. |
| N41 | **Site numbers you ask for by SQL today:** accounts still on classic (before step C), accounts with no push (before email reminders), sign-ups and active couches over time. | BACKLOG 45 (:699-700), idea 5 (:756); desk-r0-spec.md:203-204 (left out for now) | next (before step C, after Dec 16) | S–M | **Later round.** The spec left a numbers page out, so a script for now. Leave room for it. |

## 5. Site settings, flags and the frame

| # | What admin needs | Source | When | Size | Where, and why |
| --- | --- | --- | --- | --- | --- |
| N42 | **A Tools page:** the engine lab's door (M9, D151), Preview as a player as a labelled row (D3), and the switches that stay scripts, listed read-only with what each does: the rulebooks flag (D46), the game-specs flag (M11) and clearing a stuck catch-up lock (M12). | M9, M11, M12; audit D3, D46, D151; C48; desk-r0-spec.md:43-44, :157 | now | S | **This round.** |
| N43 | **The engine lab shows a retired spec part** (`extras.lateLock`). | BACKLOG 64 (:195-196) | now | S | **This round**, when the lab gets its door. |
| N44 | **The desk at a desk's width:** a list beside its detail and side panels at 1280, with the shell's 390 px cap lifted for the desk; a Menu sheet on the phone; and a keyboard path ("/" to search). | BACKLOG 197 (:788); audit §8 (:497-511); desk-r0-spec.md:209-211 (choice 1); desk-r0-shape.md:51; desk-r0-check.md:167-170 | now (Shape 2) | L | **This round** if you pick Shape 2; after the flows settle if you pick Shape 1. |
| N45 | **The desk's own slips, fixed in the repaint:** the tie-break is off in the code, so a fresh database starts wrong (D40); the library's Delete is instant and mid-page (D138, BACKLOG 122); three Undos the server keeps have no toast (§7, D63); "ChatGPT" is written in even when the bot asks Claude (§3, D105); Setup's date pickers are forced dark (D93); three To do rows lead nowhere (D24-D26); long season names are cut at about 180 px (§8). | the audit at those numbers; BACKLOG 122 (:277-278); PLAN-settings-overhaul.md:800-804 | now | M (together) | **This round.** |
| N46 | **The desk's own checks are stale:** check-desk-shows ("Show 5 more"), check-new-desk's rulebook section, and no bot step for rulebooks in check-new-desk. | BACKLOG 70 (:101-104); PLAN-rulebook-research.md:189 | now | S–M | **This round.** The round moves routes, so it has to re-point its checks anyway. |
| N47 | **Preview as a player still answers about 35 server reads as the admin** (couch chat's moderator, a couch owner's rights). | BACKLOG idea 27 (:766) | idea | M | **Later round.** This round labels the control (D3); the reads are server work. |
| N48 | **Game previews: see failures, not only the month's total.** The switch and the month's bar are on the desk (D38). Previews made, failed and refused are logged, but the desk doesn't show them. Turning previews on (site admins, one of your own, then everyone) is your step on the existing switch. | PLAN-preview-release.md:52-57, :373-374, :375-380; audit D38 | future | S | **Later round.** A line beside the bar. This round gives the budget warning its own mark (D38). |

## 6. Hosting and health

| # | What admin needs | Source | When | Size | Where, and why |
| --- | --- | --- | --- | --- | --- |
| N49 | **Did the scheduled jobs run?** The hourly job (reminders, waivers, sports scores, the preview sweep), the daily TV listings job and the bot's clock. Today that's `gh run list`, a GET with a secret, and `journalctl` on the VM. The hourly job has stopped without a word before (minutes ran out on 2026-10-19, and it was found switched off on 10-22). | HOSTING.md:20, :42, :709-714, :913-917; M13 | next | M | **Later round.** A "Site health" block beside the bot's status. The hourly job needs a heartbeat written first; the listings job's last run can be read today. |
| N50 | **A daily Vercel cron as the TV listings' backstop.** Listings move only when the bot's VM calls. | BACKLOG 184 (:725-726); HOSTING.md:76, :408-413; M13 | now | S | **Outside admin.** A `vercel.json` cron. The desk only shows the last run (N49). |
| N51 | **Vercel and Neon housekeeping:** Functions Storage over Hobby's 10 GB since 10-24; Neon's usage numbers and old rehearsal branches; an unread `ANTHROPIC_API_KEY` in Vercel; which KLIPY key production has; and HOSTING.md is behind for 11-16 to 11-19. | BACKLOG 124 (:309-312, :317), 154 (:573-576); HOSTING.md:25, :29, :32-36, :71 | now | S | **Outside admin.** Each service's own dashboard. Previews already show their own month on the desk. |
| N52 | **Rotate the Neon password.** It hasn't been changed since 2026-10-18. | BACKLOG 183 (:723-724); HOSTING.md:37-38, :691-702 | now (not on a Wednesday) | S | **Outside admin.** Neon, Vercel and GitHub, done by you only. |
| N53 | **Backups leave tables out:** `user_days` (couch points) and `app_settings` (the site's switches, so a rehearsal on a backup has to set them by hand). | BACKLOG 37 (:191-192); PLAN-results-settle.md:152-154 | now | S | **Outside admin.** `scripts/backup-common.js`. Backups stay scripts (audit :410). |
| N54 | **The bot's machines:** put the job queue on the VM (so a typed game jumps research's queue), decide on the PC fallback, and fix the PC's ChatGPT route. | BACKLOG 124 (:307-308), 16 (:727-729), 247 (:44-47); HOSTING.md:786 | now | S–M | **Outside admin.** The bot's own repo and the VM. The desk only shows which machine answered (N1). |

## 7. Future features

| # | What admin needs | Source | When | Size | Where, and why |
| --- | --- | --- | --- | --- | --- |
| N55 | **Sports data you can keep an eye on.** ESPN is unofficial and can change or block us. A game the daily job misses for three days is never read again (222). A final that can't be read is flagged on To do ("has no stats"), a row nobody has seen on screen yet (and the audit would move it to the season's facts, D26). A second source should be kept ready (114). | BACKLOG 114 (:748), 222 (:476-479), 212 (:669-671, the January pilot); PLAN-sports-data.md:411; PLAN-sports-ready.md:259-271, :816; HOSTING.md:28 | next (before January's NFL pilot) | M | **Later round.** With Sports in full. Leave a sports line in Site health and the To do row kind. |
| N56 | **A sports season on the desk, at sports scale.** An NFL slate holds about 2,500 people, shown in a cast grid with no search or team filter. Its linked games and their finals have no view. Someone cut stays in, the practice squad isn't marked, and people the bot filled in are never merged with ESPN's. | PLAN-sports-ready.md:167-168, :295, :306; PLAN-sports-data.md:390-397; BACKLOG 209 (:801-804), 175 (:659-660); src/new/desk/cast.tsx:243 | next (before the NFL pilot) | L | **Later round.** Designed with Sports in full (BACKLOG 175). The rail needs room for it. |
| N57 | **Fix a sports score by hand.** Corrections come only from ESPN, so nothing on the desk can correct a final or a player's line when ESPN is wrong or down. It isn't planned: decide after Phase 3's replay whether it's needed. | PLAN-sports-ready.md:108 (exit criterion 4), :259-265 | future | M | **Later round.** Only if the replay or the pilot shows the need. |
| N58 | **Moments a couch adds: see them, and how often research answers them.** Each one adds a short bot ask after every episode, and a new moment at the medium bar goes unanswered about 40% of episodes. The plan shows that rate to the game's maker, not to you. | PLAN-start-a-game-gpt.md:244; STUDY-added-moments.md:37; HOSTING.md:1364-1365 | future (none in production yet) | S–M | **Later round.** A line on the season's Research page. |
| N59 | **What people typed that the engine couldn't make.** Typed games and changes are kept (the words, the bot's answer and our check's verdict), and the writer plan sends requests off the menu "to the tracker", but no screen reads them. They'd show what to build next and feed the local writer's test set. | HOSTING.md:780-787; PLAN-local-game-writer.md:44-45; BACKLOG 156 (:600-603) | future | M | **Later round.** A list under the Library or the Research bot page. |
| N60 | **The local game writer's server, once production calls it:** up or down, how often it was sure, and how much still goes to the bot. | PLAN-local-game-writer.md:155-156 (W5), :166-168; BACKLOG 156 | future | S | **Later round.** A row in Site health. |
| N61 | **A games library, then a public one:** the built-in games and a season's suggested moments rated at its setup (E5), then a public library of games people made, which needs review and taking down. The Library holds rulebooks today, players' ones included (D146). | PLAN-start-a-game-redo.md:870-873; BACKLOG 93 (:769) | future | L | **Later round.** Games people made would be a new kind of entry, with a review queue. |
| N62 | **Bingo and trivia flags:** two people's flags keep a square out, and the desk's Show it again lifts only its own flag; add "Keep it anyway", and flags with a reason the writer can learn from. | PLAN-bingo-bank.md:297-298; BACKLOG 193 (:781-783) | idea | S–M | **Later round.** |
| N63 | **Paid plans and payments:** a person's plan and a couch's season pass, Stripe, refunds, every AI ask counted for caps and pricing, and ad slots. Charging also brings Vercel Pro and TMDB's licence (without it, every image.tmdb.org picture has to go). | BACKLOG 113 (:746-747); PLAN-ai-access.md:3, :237-241, :243-256; HOSTING.md:26, :681-683 | future (tabled 2026-11-16) | L | **Later round.** A "Money" area once it's back on the table. Stripe's and Vercel's consoles stay outside. |
| N64 | **What's New, drafted on the desk** (M14), if you pick it up again. | M14; BACKLOG 22 (:765); PLAN-desk-parity.md:119-127 (decision 8, postponed) | future (paused since 2026-10-29) | M | **Later round.** |
| N65 | **New kinds of show** (talk shows, live events, series): set up from New show with their own starting points, plus who answers a series' or a talk show's moments. | BACKLOG 207 (:798); PLAN-admin-shows-rulebooks.md:666-669 | future | M | **Later round.** New show and the Library already sort starting points by kind. |
| N66 | **The image server** (the nano-banana tool Claude uses for design work): its key, and the Google billing behind it. | BACKLOG 107 (:720-722) | now | S | **Outside admin.** A local tool, not part of the site. |

---

## What the reorganization must leave room for

So the new structure doesn't have to be redone when these arrive:

- **To do grows by kinds, sorted by urgency, never as a fixed list.** Kinds on the way: the bot down (N1); a catch-up held or
  stopped, with its button (N4); finale doubts (N7); a show stuck getting ready (N23); someone new in research (N25); a player's
  "Something's wrong" (N38); a scheduled job that didn't run (N49); sports scores that can't be read (N55, there already); a public
  game to review (N61); a payment problem (N63). Each row opens its decision, and five rows show before a fold (the first-view
  rule R1), so a new kind never needs a new layout.
- **The rail (Shape 2), or Search's lists (Shape 1), takes new rows without regrouping.** Seasons now (N19); sports seasons or a
  Sports row (N56: the spec's "scales to new kinds by adding a rail row"); later Money (N63) and What's New (N64). Grouped in three
  (Now · Things · Site) with a count on To do only, it holds about a dozen rows, and on a phone the Menu sheet has to hold them too.
- **The Research bot page has sections that will grow:** a status line per machine (the VM, the PC fallback, later the writer's
  server: N1, N54, N60); Which AI for each of about twelve run kinds (quick, full, schedule, tie-break, rulebook, trivia, bingo,
  facts, card, call, made-for games and the catch-up: N5); the seasons list, later with each season's added moments and how often
  they're answered (N58); research checks (N13); Actions (N3, N4).
- **A Site health block beside the bot's status:** the hourly job, the listings job, the sports refresh and ESPN's state, the
  preview service's month (already on the desk), the writer's server, and an email quota if email reminders come (idea 5). Usage
  numbers stay as links out to Vercel and Neon (N51).
- **A season's pages:** Setup (the schedule, with Suggested games as a section of its own: N26), Research, Cast (add one person:
  N25; search and a team filter at sports scale: N56), Bingo (and trivia's flags: N62), Episodes, Games (N21), and a what's-left
  line (N20) that can gain steps (a stage's short name: N12).
- **A game's page:** its settings summary grows with each engine capability, so it should read the game's own rows rather than a
  fixed list (N28, N31); Archive and Bring back (N29).
- **A person's page:** the pushes sent to them (N40), their plan (N63), and how they sign in once Google is on (N39).
- **Site settings stays a few rows plus Tools** (N42). A numbers page can sit beside it later (N41).
- **Only if a second admin or strangers arrive:** site roles, chat moderation and taking games down (N61). Nothing plans these
  yet (the spec's "Left out", desk-r0-spec.md:199-205), so build nothing; just don't word the frame as if it can never happen.

## The ten that matter most

1. **Tell me when the research bot is down** (N1), before an episode night's results quietly don't arrive.
2. **Buttons for the big fixes** (N3, N4): "Settle again" and the catch-up, instead of typing into a browser or running scripts
   that need the database password.
3. **Check Survivor 51's finale before Dec 16** (N7): the winner and the places came out right, and nobody who should be out still
   counts.
4. **Pick which AI does each research job, on a screen** (N5). Bingo and trivia use Codex now, and that stops working when the
   ChatGPT Plus trial ends.
5. **Don't spoil my episodes** (N8): hide names on the to-do list and on episode pages until I've watched.
6. **A "nothing needs you" I can believe** (N2): when the bot last checked, what it settled, and what changed after final results.
7. **One way results work, said once** (N6, N45): retire "Who decides results" after the finale, switch the bot's second look on
   in the code, and clear out the old wording.
8. **A game's page that shows the game** (N28, N29, N21): its settings, Archive and Bring back, and a season that lists its games.
9. **Know the scheduled jobs ran** (N49): reminders, waivers and the TV listings have stopped without a word before.
10. **Room for sports before January** (N55, N56): score feeds, games that can't be read and 2,500-player rosters need a home on
    the desk before the NFL pilot.

## Checked and left out

- **Tagged "desk" but not the site admin's:** BACKLOG 20 and 92 are about the game runner's screens (Backstage, now Manage this
  game), and 20's Members screen no longer exists. 233 and 234 are Manage this game's too.
- **Owner to-dos the desk already handles:** Below Deck 13's cast, The Traitors 5's groups and The Traitors (US)'s cast word
  (BACKLOG 124; PLAN-playtests.md:1271-1274); The Challenge 42's first What scores pass (PLAN-rulebook-research.md:187-188);
  turning game previews on (N48).
- **Already on the desk:** cast properties (fixed on a cast member's page, "gender guessed" shown); trivia (take a question out or
  put it back, Write trivia now); withdrawing a bot's answer (Take it back).
- **Developer tools, not admin:** the UI Atlas, the gameplay explorer and its campaigns, the lanes and the season tapes.
- **From classic's admin:** the bingo plan's "Run now offered on an episode that hasn't aired" (PLAN-bingo-bank.md:309-310) was
  about classic's page. Check it on the desk's Research rail before filing it.
- **Not repeated here:** the audit's controls (D1–D151) and Round 0's twelve choices (desk-r0-spec.md:207-234).

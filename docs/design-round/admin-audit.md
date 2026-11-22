# Admin: the full audit

> **Status (2026-11-22): for the user's decisions.** The site owner's admin settings (internally "the desk"), audited whole:
> what we have, what's wrong, what's missing, and how to reorganize it **for a phone first** (the user, 2026-11-22: "I'll be
> using it via a phone more often than not"). It replaces Round 0's wide-screen shapes ([desk-r0-spec.md](desk-r0-spec.md),
> [desk-r0-first-view.md](desk-r0-first-view.md) and its story): their findings stand, their layouts don't. The evidence, by number:
> - **D1–D151**, every control on admin's own pages: [desk-r0-audit.md](desk-r0-audit.md).
> - **O1–O96**, everything admin outside those pages (doors, other admin pages, routes with no screen, scripts, scheduled jobs,
>   switches, what was done by hand this month): [admin-audit-outside.md](admin-audit-outside.md).
> - **N1–N66**, what admin needs, from the backlog and every plan: [admin-audit-needs.md](admin-audit-needs.md).
> - **T1–T16**, your jobs on a phone, tap by tap, and every page's length at 390: [admin-audit-tasks.md](admin-audit-tasks.md).
> - **The Back loop**, confirmed on the running app: `scripts/dev-test/check-admin-back.js` (fails today).

## The direction (the user, 2026-11-22)

- **The goal: complete admin control over whatever we need to run the site.** Results and the research bot; shows, seasons,
  cast and rulebooks; people and sign-ups; couches and games; reports; the site's switches and its health.
- **Admin and game making are two different things, and must never be confused.**
  - A game's maker (its Commissioner, in Manage this game) runs one game for their couch.
  - Admin runs the site, for us.
  - Admin can reach into any game when the site needs it, as the site's override. But its place, its name and its look stay
    distinct from the maker's tools.
- **Phone first,** at 390. Admin is used on a phone more often than not. A wide layout comes later.
- **Free to deviate.** Today's admin, Round 0's mock-ups and this audit's own organization (§6) are starting points, not
  approved designs. A better idea wins; a disagreement goes to the user as a named choice.
- **The philosophy** is the user's settings philosophy (UIUX Studio's steps, minus user testing):
  1. audit every setting;
  2. group by what you want to do;
  3. labels that say the outcome, in plain words;
  4. smart defaults;
  5. the right control for each setting;
  6. search at the top;
  7. confirm changes clearly, with Undo.

  With it, the app's standing rules:
  - literal names;
  - the AI settles first and a person corrects after;
  - Delete last, named and once;
  - Back never loops;
  - no spoilers;
  - the urgent things first;
  - "Nothing needs you" shows its proof.

## The short version

Admin has everything a one-person site needs to run, but it was built page by page, as the features arrived. On a phone that
shows:
1. **Nothing tells you when admin needs you.** No push and no dot: you have to go and look (O18). The count only shows inside
   the hub's profile sheet (O1).
2. **Back can trap you.** Open a season from a show's menu, or from a link, and Back bounces between the season and its show
   forever (confirmed). An installed iPhone app has no other way out.
3. **Your everyday jobs take too many taps.** Deciding a disputed result takes 7 taps, and 4 more for each one after. A sign-up
   takes 4, a report 4 plus a scroll, and adding a show about 15, across six admin pages and the player app (T2–T8).
4. **Some jobs have no button.** Settle again (done twice this month by typing into a browser), releasing the catch-up hold (a
   script that needs the database password), changing a couch's owner, which AI each research job uses, and bringing back an
   archived game (T6, T7, T9; M1–M7).
5. **Nothing says it's all working.** There's no status for the research bot or for the scheduled jobs, which have stopped
   silently before. There's no site-wide list of what changed (T9a, T15; N1, N49).
6. **The words are from the old rules and the engine.** Results "confirmed by 2+ sources", "the couches are handling it", one bot
   with five names, plus canonical, league, house ruling, Override, and Act as next to View as (§3 of the D audit; T worst 10).
7. **The same thing lives in two to five places.** Deciding a result (two pages, two vocabularies), the bot's settings (five
   places), a season's Delete (five pages), and ten different ways to save.
8. **Leftovers.** Dead switches (Gemini, "Leagues play by it"), classic's "Reset all data" (wipes a game, no undo, no record:
   O30), two routes nothing calls (O43, O44), and the paid AI keys still read by one old command (O57, O85).
9. **Preview as a player hides admin for 30 days.** It's a cookie with no bar, and while it's on every door to admin disappears
   (O8).

**The fix:** one **Admin** home built for a phone.
- It answers "does anything need me?" first, with proof that the bot is working.
- Then this week's episodes, and a search that finds anything, settings included.
- Then seven rows, one for each kind of thing.
- You get a push when something needs you.
- Every job is three taps or fewer from there, and Back always goes where you came from.

The work splits into a few small bug fixes now and three design rounds after (§8).

---

## 1. What admin is for

One person runs the site. Results settle on their own (the research bot asks, a second look follows, final results at noon the
day after), so admin is for what the bot can't do and for setting things up.

| Your job | How often | Today it's… |
| --- | --- | --- |
| **Check in:** does anything need me? | most visits; every episode night | a count inside the hub's profile sheet; the list 2 taps in |
| **Decide** what the bot couldn't settle | episode nights, a few times a season | 7 taps over two pages |
| **Let people in:** approve sign-ups | in waves | 4 taps |
| **Read reports** from players | now and then | 4 taps and a scroll; can't reply |
| **Look someone or something up** (a person, a couch, a game by its code), sign in as them, reset a password | weekly | 5–12 taps |
| **Set up a show or season:** rulebook, cast, schedule, games, bingo | a few times a season | about 15 taps, in and out of admin |
| **Keep the bot running:** is it up, research now, settle again, the catch-up | when something's off | no status; two jobs impossible on a phone |
| **Change a site setting:** sign-ups, game previews | rarely | 5 taps |
| **Tools:** preview as a player, the engine lab, the flags | rarely | hidden, unlabelled, or a script |

---

## 2. What we have

### 2a. Admin's own pages

**27 screens, about 97 sheets, 151 controls** (D1–D151). Three tabs (Inbox · Find · Settings), seven lists, nine kinds of page.
Every page is a phone-width column, and works at 390. On a phone, their length (T, Part 2):

| Area | Pages | Phone length | What's good | What's wrong |
| --- | --- | --- | --- | --- |
| **Inbox** | the "Needs you" list, Coming up, This week | 1.9 screens (each to-do row ~100 px; 10 to-dos ≈ 2.6) | Coming up is the best display on admin | sorted by kind, not urgency; 3 rows lead nowhere (D24–D26); old results words (D29) |
| **Find** | search, Browse's six lists, Recently opened | 1 screen | it works | doesn't find settings; says "castaway"; doesn't say it finds join codes |
| **Settings** | 10 rows: Who gets in, Game previews, 3 results rows, Autopilot, Which AI, Gemini, Rulebooks, The library, history | 1.5 screens | Who gets in, Game previews | 5 rows are dead or should be defaults (D39–D47) |
| **People** | the list, a person | 2.7 and 1.6 screens | a person's page works (D49–D61) | "Act as", "Let in", "Game admin"; reset password is 12 taps deep in a task |
| **Couches and games** | two lists, a couch, a game | 2.5, 1.2, 1.4, 1.5 screens | lists are consistent | a couch's owner can't be changed (T6); a game shows no settings; Archive is inside Delete; nothing unarchives (D72, M7) |
| **Reports** | the list, a report | 1 screen | simple | 13th in Inbox's order; no reply (M10) |
| **Shows** | the list, a show, its research sites, its art | 1–1.6 screens | | "Its words" duplicates the rulebook's (D81); two "art off" switches (D86); New show isn't here (D148) |
| **A season** | the hub, Setup, Research, Cast, Bingo, episodes, a cast member | 1–2.3 screens; a 30-episode season ≈ 3.5 | the season hub is right | no games on it (N21); no "what's left"; Made-for games in screen 2; the run log in screen 2; cast faces at the foot of screen 1 |
| **An episode** | results, answers, trivia, bingo, clear | 1.8 screens (≈ 3 with names showing) | | a disputed result is decided on a second page, in other words (D111, D121–D127) |
| **Rulebooks** | the library, a rulebook, New show | Library **4 screens**; a rulebook ≈ 3 | | rulebooks in use are in screen 4; the library's Delete has no confirm (D138); a dead switch (D140) |
| **Engine lab** | one page | 1 screen | | nothing links to it (D151) |

### 2b. Admin outside its own pages

| What | Today | Verdict |
| --- | --- | --- |
| **Doors in** | the hub's profile sheet ("Site admin · N need you"), Your settings' row, a show's ⋯ "This season in Admin", "Its rulebook on the desk" after Make it a game (O1–O4) | keep; add a dot on your picture when something needs you (O1) |
| **Notifications to you** | **none.** Sign-ups, reports ("Goes straight to us" only saves a row), splits, the bot down and a held catch-up all wait for you to look (O18–O25) | add one "Admin" notification (decision 3) |
| **Being someone else** | Act as: a bar, an hour, returns by itself (O7). **View as: no bar, 30 days, hides every admin door** (O8). Read-only: a plate over a couch's game (O9) | View as gets a bar and an hour, renamed Preview as a player |
| **Extra powers in player screens** | you count as every game's Commissioner, a moderator in every couch's chat, one flag removes a bingo square; no limits on asking the bot (O10–O17) | fine as is |
| **Other admin pages** | /admin is classic's, retired, and sends you to the desk (O27). /reports redirects (O28). /research, /dashboard and /scoreboard are classic player pages, not admin (O29). Classic's **"Reset all data"** wipes a game with no undo (O30) | drop Reset all data |
| **Routes with no screen** | Settle again (O35), catch-up start / step / try (O36–O37), which AI per run (O38), the bot clock and the listings job (O39–O40), and two routes nothing calls (O43–O44) | buttons for O35–O38; drop O43–O44 |
| **Scripts you run on production** | backups and restores, migrations' rehearsal, the two flags, the catch-up (load, release, locks, rehearse), preview database, cast links, outside numbers (O46–O60) | backups, restores and migrations stay scripts (they need the connection string). The catch-up release becomes a button. The flags stay scripts, shown read-only |
| **Scheduled jobs** | the hourly GitHub job (reminders, waivers, sports finals, previews), the bot's clock on the VM, its self-test, the daily listings (O61–O64). The hourly job has stopped silently before, and GitHub pauses a public repo's schedule after 60 days without activity | admin shows each one's last run (later round) |
| **Site switches** | 11 settings in `app_settings` (game-specs, rulebooks, tie-break, sources, sign-ups, new couches, previews, which AI, the default schedule, the catch-up hold) and the environment keys (O65–O85). **Backups don't record `app_settings`**, so the switches' values exist only in production | one read-only list of the site's switches |
| **Done by hand this month** | migration rehearsals, the catch-up release, Settle again twice, trivia and bingo moved to Codex with a raw call, the Ep 10 notification check (O86–O96) | buttons for the routine ones; rehearsals stay outside |

---

## 3. Your jobs on a phone, before and after

From the hub (Home), signed in as you. "After" is the plan in §6, to be confirmed by its design round.

| Job | Today (taps) | What's in the way | After (planned) |
| --- | --- | --- | --- |
| T1 Anything need me? | 1 for a count, 2 for the list | no sign on Home; four names for one place | **0**: a dot on your picture, or a push; 2 to see the list |
| T2 Decide a disputed result | 7, then 4 per extra | names hidden by default hide the rows; a second page in engine words | **4**, then 2 per extra, on the episode itself |
| T3 Approve sign-ups | 4 | | **3**; "Approve all" for a wave |
| T4 Read a report, mark it done | 4 and a scroll | reports come 13th | **4**, no scroll (or 2 from a push) |
| T5 Find someone, reset their password | 5 to find; 12 to a new password | | **3** and a search; **5** to a new password |
| T6 Make someone a couch's owner | impossible | "Hand them on" only changes its games' Commissioner | **6** |
| T7 A game by its code: settings, archive | 7; settings unreachable | Archive inside Delete; no unarchive | **5**, settings shown; Bring back too |
| T8 Add a show, get its season ready | about 15, in and out of admin | New show only on the Library; Back loops at the end | **about 10, all in Admin**, guided by the season's checklist (est.) |
| T9a Is the bot working? | no screen | one season's run log, 5 taps and a scroll | **2**: the Research bot row says "Up · ran 2 h ago" |
| T9b Research now for an episode | 7 | | **5–6** |
| T9c Settle a season again | impossible (a browser trick) | | **5**, with what it would move shown first |
| T9d Release the catch-up hold | impossible (a script) | its row links to itself | **4**, from its Needs you row |
| T10 Change a site setting | 5 | | **5**, or a search |
| T11 Fix a cast member's name or photo | 8 | a photo only as a link | **5** and a search |
| T12 Edit a rulebook | about 11 | up to 3 sheets deep | **5–6** |
| T13 Check an episode, correct a result | 10 | 3 sheets in a row | **7** |
| T14 Preview as a player | 4 in, 3 out; no bar | the eye has no label | **5 in, 1 out**, with a bar the whole time |
| T15 What changed recently | site settings only | no site-wide list | **4**, everything admin changed |
| T16 Back to the app | 1 to many; Back can loop | | **1** from anywhere |

---

## 4. What's wrong, step by step

These are the steps of the settings philosophy you picked (UIUX Studio, minus user testing).

### Step 1: audit every setting. Dead, near-dead and duplicated

**Dead or near-dead** (D audit §4):
- the Gemini card;
- "Leagues play by it" (disabled, and the server ignores it);
- "Its wiki";
- Settings' Library row;
- the rulebooks flag on screen (it belongs in its script);
- "Who decides results" (once Survivor 51 moves off it after the finale);
- classic's Reset all data;
- the two routes nothing calls;
- the test couch's leftovers (N30).

**The same thing in several places:**

| The thing | Where it is today | It should be |
| --- | --- | --- |
| Deciding a disputed result | the episode's sheet and a separate Fact page, in different words | the episode, once |
| The bot's settings | Settings › Autopilot, Which AI, When answers disagree; each season's Research; "Make this our usual" inside one season | the Research bot page; a season keeps its own runs |
| A season's Delete / a show's Delete | five pages / three pages | once, last, on its own page |
| What a show calls its people | the show's "Its words" and the rulebook's cast words | one place |
| The library | Find › Browse and Settings | Rulebooks, once |
| Turning off a show's art | a panel's button and a switch | one switch, worded "Show art and photos" |
| Getting results in | "Ask our bot", "Run now", "Ask it now" | one name: Research now |
| Who fills in results | Settings (new couches), the couch, the game's Manage | the couch's own switch; new couches default to anyone |

### Step 2: group by what you want to do

Today admin is grouped by how it was built:
- **Inbox, Find and Settings** are three containers.
- **Settings** holds the bot, a flag and the library.
- **A season is only inside its show,** though it's what you work on most.
- **New show** lives under rulebooks.
- **The engine lab** has no door at all.

Your jobs (§1) are the grouping §6 uses.

### Step 3: labels that say the outcome

The full list is in the D audit §3. The renames that matter most:

| Today | Recommended |
| --- | --- |
| the desk, Admin, Site admin (one place, three names) | **Admin** |
| Inbox · Find · Settings · Needs you | the home screen, **Search**, **Site settings**; the list says "3 things need you" itself |
| Our bot · Autopilot · Runs on its own · Run now · Ask our bot · Our usual | **Research bot · Automatic research · Research now · Default schedule** |
| Act as · View as · Viewing as | **Sign in as {name}** · **Preview as a player** |
| Who gets in · Let in | **Sign-up approval** · **Approve** |
| Game admin; "sees nothing backstage" | **Helper**; "Plays" |
| Hand it on / Hand them on | **Make someone else the Commissioner** / **the owner** |
| Override · Save override | **Change** · **Save** |
| fact · canonical · league · house ruling · Holdings check | **result · decided by you · game · kept their own result · who holds what doesn't add up** |
| Take it over · Its words · Running it · Made-for games | **Make it official · What the show calls things · Manage season · Suggested games** |
| "ChatGPT" written in (14 places) | the AI the bot really asked |
| "confirmed by 2+ sources", "the couches are handling it", "nothing reaches the games until you accept it" | the rule as it is now: the bot settles, a second look, final at noon |
| castaway on screens for every show | the show's own word, or "cast member" |

### Step 4: smart defaults, so there's less to set

- **Sources to confirm a result:** set to 2 and hide it. One look already reaches the games (D39).
- **When answers disagree:** on in production but **off in the code**, so a fresh database starts wrong (D40). Fix the default;
  keep the switch only as an emergency stop (decision 4).
- **Who fills in results on new couches:** set to "anyone" and hide it. A couch keeps its own switch (D41).
- **Phase starts** ("when did the merge start?"): today you confirm every one by hand. Your rule is that the AI settles and a
  person corrects afterwards (decision 13, N11).

### Step 5: the right control for each setting

- **Ten ways to save become four:**
  1. tap a choice and it applies, with Undo;
  2. edit in a sheet with Save;
  3. a change that reaches games shows its reach, then confirms;
  4. a delete or a big fix holds to confirm.

  Gone: "Tap again within five seconds" (Made-for games' Start over), the library's Delete with no confirm, the dimmed card that
  only toasts, and two switches for one thing.
- **Three Undos the server keeps have no toast:** the couch's Who fills in, a fact's decision, and the rulebook page's changes.
- **Setup's date and time pickers are forced dark.**
- **A photo can only be changed by pasting a link** (T11). Uploading from the phone's camera roll is a later question.

### Step 6: search, at the top

Find exists and works. It should also find **admin's own pages and settings** by their words and synonyms: "sign-ups",
"approve", "settle", "bot", "AI", "preview", "history", "flags". And it should say it finds join codes and cast members.

### Step 7: confirm changes clearly

- **Big fixes** (Settle again, a catch-up release, Make every game match) must say what they'll reach and hold to confirm. Settle
  again must also show what it would move first.
- **Deletes** come last and are named ("Delete ZT Survivor 51"), once per thing.
- **A site-wide change history** (today only Settings has one) is the safety net for all of it.

### And: getting around (wayfinding)

- **Back loops** from a page opened from outside admin (confirmed).
- **Pages deep inside admin** have no way home but Back, five times from an episode.
- **One place, four names:** Site admin, Admin, Inbox, Needs you.
- **Long pages bury the thing you came for:** the library's "In use" is in screen 4; a season's run log, its cast and its Made-for
  games are in screen 2.

### And: spoilers

- **Admin shows results before you've watched.** Names are hidden only on the episode page, and the switch forgets itself (D108,
  N8).

---

## 5. What's needed

### Now, in this reorganization

- **Know:**
  - a push and a dot when something needs you (O18, O1);
  - the bot's status, on its row and as the first Needs you row when it's down (N1, M5);
  - "Nothing needs you" with its proof (N2);
  - a site-wide change history (T15).
- **Do (buttons that don't exist):**
  - Settle again, showing what it would move (M1, N3);
  - the catch-up's release, start and try again (M2, M3, N4);
  - which AI each kind of research uses (M6, N5, **before the ChatGPT Plus trial ends**: trivia and bingo are on Codex);
  - change a couch's owner (T6);
  - archive and bring back a game (M7, N29);
  - approve all waiting sign-ups (N35).
- **See:**
  - a season's games on its page (N21);
  - a season's checklist of what's left (N20);
  - a game's settings, with Open Manage this game (M4, N28);
  - a list of seasons (N19);
  - a show stuck "getting it ready" on Needs you (N23);
  - one read-only list of the site's switches (O65–O75).
- **Fix:**
  - names hidden until you've seen an episode (N8);
  - one name per thing, one way to save each kind of change, one Delete per thing;
  - the old results words gone (N6, N45);
  - "Sign in as": decide what it may change (decision 15, N36);
  - the engine lab's door, with the retired part it shows dropped (M9, N42–N43);
  - re-point admin's own checks as routes move (N46).

### Later (the new layout leaves room for these)

- a **Site health** block: the hourly job, the bot's clock, the listings job, sports finals and ESPN's state, and later the game
  writer's server (N49, N55, N60);
- **sports at scale:** an NFL roster of about 2,500, its games and finals, and a hand-fixed score if the pilot shows a need
  (N55–N57), before January's NFL pilot;
- a person's **pushes sent** (N40), their plan once payments come (N63), how they sign in once Google is on (N39);
- **reply to a report** (M10, N37);
- **add one cast member mid-season** (N25);
- **what people typed that the engine couldn't make** (N59);
- the **public games library** and its review queue (N61);
- **What's New** (paused, N64);
- **the wide layout**, a list beside its page at a desk. A nice-to-have now (N44).

### Outside admin

These stay where they are, not on a screen:
- backups, restores and migrations, which need the database password;
- the flags, which stay scripts;
- the Neon password rotation;
- Vercel and Neon's own dashboards;
- the bot's machines;
- the listings backstop cron (BACKLOG 184), a server change;
- the image tool's key (N50–N54, N66).

---

## 6. The new organization

### One name: Admin

"The desk" was only ever an internal name. It's **Admin** everywhere you see it. The address can become /admin once classic's
retired /admin route goes (O27).

### Getting in

- **A dot on your picture** in the hub when something needs you. The hub sheet's row says "Admin · 3 need you".
- **A push** when something new needs you, at most one an hour, that opens Admin (decision 3).
- The show menu's "This season in Admin" stays.

### Admin home (top to bottom, on a phone)

1. **The header:** "Admin", and **Back to the app**.
2. **Search:** "Search people, games, shows, join codes, settings…"
3. **What needs you.**
   - The heading is the answer: "3 things need you", or **"Nothing needs you"** with its proof underneath ("Research bot ran 2 h
     ago · settled Episode 9 on 3 games").
   - Up to five rows, most urgent first: the bot down, a split, a stopped catch-up, then sign-ups, reports, a couch nobody runs, a
     season missing its schedule, a show stuck getting ready, a rulebook to review.
   - Each row has its one action ("Decide", "Approve", "Read"). "All 7" if there are more.
4. **This week:** up to three episodes with where each stands ("last night · settled · final at noon", "Wed 8 PM · the bot asks
   at 11 PM"). It replaces both Coming up and This week.
5. **Seven rows,** each with a live line:

| Row | Its line, for example | What's inside |
| --- | --- | --- |
| **Seasons and shows** | 3 on air · 1 setting up | Add a show; seasons by On air · Setting up · Over; All shows |
| **People** | 214 · 2 waiting to join | Waiting · Everyone · Admins · Can't sign in; Approve all |
| **Couches and games** | 31 couches · 58 games · 1 nobody runs | the two lists, a join code search |
| **Reports** | 1 open | Open · Done |
| **Rulebooks** | 2 to review | To review · Starting points · Made by players · Drafts · In use |
| **Research bot** | Up · ran 2 h ago | its own page (below) |
| **Site settings** | Sign-ups need your OK | Sign-up approval · Game previews · Change history · Site switches · Tools |

That puts every list one tap from Admin home and every page two. Any control is three taps away, and Search reaches anything in
one tap plus typing.

### What each page holds, in order

Every page follows the same pattern:
1. what it is and how it stands;
2. anything on it that needs you;
3. what you came for;
4. what's related;
5. **Delete last**, named, once.

Edits open in a sheet. Back goes where you came from and never loops, and a page opened from outside goes up to its parent and on
to Admin home.

- **A season:**
  1. what's left while it's being set up ("Rulebook done · Cast done · Schedule: set it next · then Games");
  2. what needs you on it;
  3. its episodes (the next and the last three; All 13);
  4. **its games** (new);
  5. Manage: Schedule · Research · Cast · Bingo · Rulebook; Suggested games;
  6. Delete.
- **An episode:**
  1. a disputed result decided in place, both answers side by side, with Keep this · Use that · Correct it and Undo;
  2. its results in the games;
  3. the answers (Research now, Paste an answer);
  4. trivia; bingo;
  5. Clear, last.

  Names stay hidden until you've seen it, with one tap to show.
- **A show:** its seasons; what the show calls things; research sites; art and photos (one switch); Archive; Delete.
- **A person:**
  1. waiting or can't sign in, with the action;
  2. their couches and games; reports they sent;
  3. account: name and email, reset password, signing in;
  4. Sign in as {name};
  5. Delete.
- **A couch:** people; games; **Make someone else the owner** (new); who fills in results; Delete.
- **A game:** its settings in words, with **Open Manage this game**; seats; join code; **Archive / Bring back** (new); Delete.
- **A report:** the message and who sent it; Mark done; Sign in as them; Delete.
- **A rulebook:** its parts, each with Edit; research checks; history; lock; starting-point controls; Delete (held).
- **Research bot:**
  1. **Status** for each machine (the cloud VM, the home PC): last answer, next run, which AI;
  2. the **seasons** it researches, each with on/off and its schedule;
  3. the **default schedule**;
  4. **second look and final results**;
  5. **which AI** for each kind of research;
  6. **when answers disagree** (the tie-break: on);
  7. **recent runs** across every season;
  8. **actions**, below the fold, each holding and naming its reach: Settle {season} again (with what would move), Start a
     catch-up / Try again, Release the catch-up hold.
- **Site settings:**
  - Sign-up approval; Game previews (and the month); Change history (everything admin changed, with Undo where it can);
  - Site switches (a read-only list of every switch and its value, with the script that changes it);
  - Tools: Preview as a player (it now shows a bar, and lasts an hour), the engine lab.
  - Later: Site health.

### Search

Search finds:
- **things:** people (name, username, email), couches, games (name or join code), shows, seasons, cast members, reports and
  rulebooks;
- **admin's own pages and settings**, by their words and synonyms, opening each one in place ("sign-ups" → Sign-up approval,
  "settle" → Research bot's Settle again).

### Where everything moves

| Today | Goes to |
| --- | --- |
| Inbox's Needs you, Coming up, This week | Admin home: what needs you, This week |
| Find, Browse, Recently opened | Search on Admin home; the seven rows; Recently opened under Search |
| Settings › Who gets in, Game previews, Settings history | Site settings |
| Settings › Sources to confirm, Who fills in on new couches | defaults (hidden) |
| Settings › When answers disagree, Autopilot, Which AI; a season's "Make this our usual" | Research bot |
| Settings › Gemini, The library row | gone |
| Settings › Rulebooks flag | its script; listed under Site switches |
| The eye (View as) | Site settings › Tools › Preview as a player, with a bar |
| The engine lab (no door) | Site settings › Tools |
| A show's seasons (the only way to a season) | Seasons and shows lists seasons first |
| The Library's New show | Seasons and shows › Add a show |
| The Fact page | the episode |
| Setup's "Who decides results" | gone after the finale's data step |
| Setup's Made-for games | the season's Suggested games |
| Research's Episode length | Setup's schedule |
| A game's Archive (inside Delete) | its own row, with Bring back |
| Five copies of a season's Delete, three of a show's | one each |
| Classic's Reset all data; /api/briefs/…/fetches; /api/test-couch | gone |

---

## 7. Your decisions

Answer by number, or "take the recommendations".

1. **The organization in §6** (Admin home, then seven rows, a search that finds settings too, a push and a dot). Recommended:
   **yes**.
2. **One name, Admin,** and the /admin address once classic's old route goes. Recommended: **yes**.
3. **Notifications to you:** a push when something new needs you, at most one an hour, none between midnight and 8 AM, opening
   Admin. Recommended: **yes**. The bot being down pushes at once, even at night? Recommended: **only on an episode night**.
4. **When answers disagree:** keep the switch on the Research bot page as an emergency stop, on by default (the code's default
   fixed). Recommended: **yes**.
5. **Who decides results:** move Survivor 51 off "You decide" after the finale, with a what-would-move run first, then drop the
   control. Recommended: **yes, after Dec 16**.
6. **Delete once per thing,** on its own page, last and named. Recommended: **yes**.
7. **The Fact page merges into the episode.** Recommended: **yes**.
8. **Settle again and the catch-up as buttons,** each holding and naming what it reaches (Settle again shows what it would move
   first). Recommended: **yes**.
9. **The rulebooks flag goes back to its script,** listed read-only. Recommended: **yes**.
10. **A game's settings:** admin shows them in words and opens Manage this game to change them. Recommended: **yes**.
11. **"Override" becomes "Change"** everywhere. Recommended: **yes**.
12. **Reply to a report's sender:** later. Recommended: **later** (Mark done stays).
13. **Phase starts:** keep confirming every one by hand, or let research's answer stand with a one-tap correction (your "the AI
    settles" rule)? Recommended: **let it stand, with a correction**.
14. **Preview as a player:** a bar the whole time, lasting an hour like Sign in as. Recommended: **yes**.
15. **While you're signed in as someone,** their own settings (follows, spoilers) can't be changed; their game moves can.
    Recommended: **yes**.
16. **Remove classic's Reset all data,** the two routes nothing calls, and the last code that reads the paid AI keys (then delete
    those keys from Vercel). Recommended: **yes**.
17. **Make a couch's owner changeable from admin.** Recommended: **yes**.
18. **The wide layout** (a list beside its page at a desk): after the phone design. Recommended: **later**.

---

## 8. What happens next

**Fix now (small, no redesign needed; your OK on each):**
1. **Back loops**, from a page opened from outside admin. `scripts/dev-test/check-admin-back.js` fails today and is the test.
2. **The tie-break's default in the code**, so a fresh database starts the way production runs (D40).
3. **The library's Delete** gets a hold, at the foot of the page (D138).
4. **Which AI for trivia and bingo**, before the ChatGPT Plus trial ends: the date isn't recorded; you know it (N5).

**Then three design rounds:** each goes Intent, then Perception-First Design, then Impeccable, at 390, with a screenshot story
and a pause for you.
1. **Getting around:**
   - Admin home: what needs you with its proof, This week, Search finding settings too, the seven rows;
   - the dot and the push; Back that never loops;
   - the names;
   - the Research bot's status line.
2. **The bot and the big fixes:**
   - the Research bot page;
   - Settle again, the catch-up and which AI as buttons;
   - Site settings with switches, tools and a site-wide change history;
   - Preview as a player's bar.
3. **The pages:**
   - a season with its games and checklist;
   - an episode deciding in place, names hidden;
   - a game with its settings and Archive / Bring back;
   - a couch's owner; a person; reports; rulebooks;
   - one Delete each, four ways to save, the hidden Undos.

**Later:** Site health, sports at scale (before January's NFL pilot), and the rest of §5's "Later".

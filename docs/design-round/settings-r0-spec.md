# Settings, Round 0: where everything lives (Intent's spec)

> **Status (2026-11-20): Round 0's structure, step 1 of the design process** (docs/DESIGN-PROCESS.md: Intent, then
> Perception-First Design, then Impeccable). It houses what's left after the approved cuts and adds
> ([PLAN-settings-overhaul.md](../PLAN-settings-overhaul.md); every setting today is in [settings-audit.md](settings-audit.md)),
> and specs the three shapes Round 0 draws as grey boxes at 390. Nothing here is built.

## The job

Every setting a person can change has one home, reached from the thing it's about and named for what it does. The usual reasons
people open settings take two or three taps from wherever they are:
- too many pings;
- spoilers;
- being behind on a show;
- their name;
- leaving something.

A runner's options never reach a player's screens.

## Why people come (the entry points)

| Who | What sends them | Where they are when it happens | What they'd try first |
| --- | --- | --- | --- |
| **Joanna** (forgets) | The couch's chat buzzing through Survivor night | The show's Tonight, or a push on her lock screen | The show she's in, or the push itself. Not a Settings page she's never opened |
| **Andrew** (drives by) | A game he's out of still reminding him | A push, then the game | The game: "leave this game" |
| **The Behind-Watcher** | Fear of a spoiler on a show she streams late | The show, or her picture | Somewhere that says "hide results until I've watched", on that show |
| **Conor** (tinkers) | Starting one more player from Episode 6 | The game's page | The game: its ⋯, a gear, "Manage" |
| **Riley** (Game admin) | A late couch: open this episode's lock | A push, or the strip on episode night | The strip, then the game |
| **Owner of a couch** | Renaming it, a fresh invite code | The hub | The couch's name |
| **The Curious Relative** | Her name, or the dark screen | The hub | Her picture |
| **Anyone, solo** | Name, notifications, theme | The hub | Her picture |

The pattern in that table is the convention every app these people use already teaches:
- Discord and Slack: your settings under your face, a server's or workspace's under its name, a channel's under its header, and
  notification overrides at each level.
- WhatsApp: a chat's mute is in its header.
- Sleeper: each league's gear holds its settings.

People look for a setting on the thing it's about. Today's app breaks that in three places:
- a show's settings for you live partly in Settings;
- a game's rules live in Backstage;
- a couch's controls sit under your picture.

## What has to be housed (after the cuts and adds)

| Subject | Settings | Count |
| --- | --- | --- |
| **You** | your picture, name, colour; notifications on this phone; which kinds (reminders before moves lock, results, your couch's activity); couch chat's default; when results show (shows; sports); how far I've watched is visible to my couches (with the preview); appearance; your account (password, Google, your phones A3, install the app A5, later an email A1 and delete A2); sign out; help (report a problem, the tour, credits) | about 15 |
| **You on a show** | episodes I've watched; when a new episode airs; results on this show (C1's exception); this show's notifications (mute, for a while or for good; each kind); hide this show from my couch; remove it / leave all my games here | about 6 |
| **You on a couch** | its chat notifications; leave it. As its owner: rename, a new invite code, make someone else the owner | about 5 |
| **You in a game** | leave this game | 1 |
| **A game, for whoever runs it** | this episode's lock; how moves lock (fixed) and late moves; who scores each week and the bench; team size (before the draft); the questions; who can join; how long; replacing people who leave (one control: the preset, when, the rule, the windows, the swaps, the timing); points (games scored by moments); who's playing (roles, remove from this game, computer players); the draft's settings (a link to the room); the change history; rename; stop this game; mid-season changes (BACKLOG 230 and 231) | about 15 |
| **A couch's season, for whoever runs its games** | customize the rulebook; freeze rules and joining | 2 |
| **The site, for its admin** | the desk (Round 5) | later |

Lay these in one flat list and it's about 45 items, far past what anyone scans. Subjects of 1 to 15 items each are scannable,
which is the structural case for homes.

---

## Shape 1: homes by subject (the lean)

Four homes. Each opens from its subject, by the same gesture everywhere, and each groups its settings by what you want to do.

**The doors**

| Home | Its door | Also reached from |
| --- | --- | --- |
| **You** | your picture on the hub (as today) | your own person sheet; any "change this in your settings" link, landing on that setting already open; a push's settings link |
| **This show** | the ⋯ on the show's bar, on every tab (as today) | the episode list's "Episodes I've watched"; the bell's row for that show |
| **This couch** | the couch's name on the hub (today it only switches couches) | a couch's row in the switcher; the show bar's couch name |
| **This game** | the ⋯ on the game's page, its card on the Games tab, Tonight's line for it | a change in the history; a runner's job on the strip |

**You** (a page, pushed from the hub). In order, with the most-used first:
1. **Your picture and name.** Your face, name and colour, with Edit, which opens your profile.
2. **Notifications.**
   - This phone: on or off. When off, it's the page's one yellow plate, with Turn on, as today.
   - Which kinds, one row each, value first: Reminders before moves lock; Results; Your couch's activity.
   - Couch chat, your default: Every message · Skip possible spoilers · Never.
   - Underneath, the exceptions you've set elsewhere, each a link: "Muted on Survivor until Fri", "ZT Extra's chat: never".
3. **When results show.**
   - Shows: wait until I've watched (Recommended) · straight away.
   - Sports: live (Recommended) · wait until I've watched.
   - The exceptions, as links: "Straight away on The Traitors".
4. **Privacy.** How far I've watched: visible to my couches (on). With "What riley sees about you", the live preview, and the
   shows you've hidden, as links.
5. **Appearance.** Dark · Light · Same as my phone.
6. **Your account.**
   - Your sign-in name, and Change password.
   - Google (when it's on).
   - Your phones (A3): which get notifications; turn one off; sign out everywhere.
   - Install the app (A5).
   - Later: an email (A1) and delete my account (A2).
7. **Help.** Report a problem · Take the tour · Where art and data come from.
8. **Sign out**, in red, last. It also turns this phone's notifications off.

For a site admin there's a "Site admin" row above Sign out.

**Drill-downs and returns:**
- Edit opens your profile as a sheet; Back returns to You at the same scroll.
- Your phones is a pushed page; Back returns to You.
- An exception link goes to that show's or couch's home with the setting already open. Back returns to You, not to the show.

**This show** (the ⋯ sheet, split in two):
- **First, things to do:** Invite a friend · Plan a watch along · How it works.
- **Then "For you on this show":**
  1. **Episodes I've watched.** The value ("Through Ep 5"); opens the episode list (C14).
  2. **When a new episode airs:** ask me · mark it watched · nothing (C15). Only on a show you follow and don't play: on a show
     you play, your place moves by revealing.
  3. **Results on this show:** your default · wait · straight away (C1's exception).
  4. **Notifications for this show:** Mute (for a day, a week, for good) and each kind (C16).
  5. **Hide this show from my couch** (C17): a switch, with its consequence in one line. Hidden when you're on no couch.
  6. **Leave all my games here** (a player) or **Remove from my shows** (a watcher), in red, last, held.
- **For whoever runs games here:** one row, "Games you run here: 3", listing them, each opening its Manage this game.
- **For the site admin:** "This season in Site admin".
- **Returns:** the sheet closes back to the tab you were on; a pushed row's Back returns to the sheet.

**This couch** (a page, pushed from the hub):
1. **Who's on it:** faces and names; each face opens their sheet.
2. **Invite:** the code and the link (as today's Invite).
3. **Chat notifications for this couch:** your default · every message · skip possible spoilers · never (C26/A9).
4. **For its owner:** Rename · Get a new invite code · Make someone else the owner (with a confirm, C28).
5. **Leave this couch**, in red, last, held.

Switching couches stays on the hub's header (C25): it's navigation, not a setting.

**This game** (the ⋯ sheet on a game's page):
- **For a player:** How it plays · Your sheet · Leave this game (in red, held; A11).
- **For whoever runs it, first:** **Manage this game**, pushed. It's Round 4's page, grown:
  1. The title card.
  2. This episode's lock (Lock now / Open it again), first because it has a deadline.
  3. **The rules, a line each, value first,** opened in place: How moves lock · Who scores each week · On the bench · Team size
     (until the draft) · The questions · Who can join · How long · Replacing people who leave · Points (games scored by moments).
  4. **Who's playing:** each person's role (Commissioner · Game admin · Player); remove from this game; computer players.
  5. **The draft:** its time, timer and away rule, linking both ways with the room.
  6. **Rules for Survivor 51 on ZT Survivor 51:** customize the rulebook; freeze rules and joining. Shared by every game on the
     season, and said so.
  7. **Change history.**
  8. **Rename this game.**
  9. **Stop this game:** Archive (Undo) or Delete (held), last.

  A Game admin reads the same page. The lock is theirs; the other lines carry no chevron, and one notice says why.
- **The runner's jobs** (start the draft, a join request, the lock on episode night) come to the strip like any other move. There's
  no separate home for them.

**Labels** (literal; Impeccable's clarify settles the words):
- **Homes:** "You" (its title is your name); "<Show>: for you"; the couch's name; "Manage this game".
- **Groups:** Notifications; When results show; Privacy; Appearance; Your account; Help.
- **Never:** Backstage, Quiet nights, Keep me live, Lock it down, Make it ours, Everything else.

**Left out, and why:**
- **A Settings item in every bar.** The hub's picture is the convention for You, and the show's ⋯ is already learned.
- **A list of every game you run, across shows.** Each game's own door, plus the show menu's "Games you run here", covers it. A
  cross-show list waits until someone runs games on two shows at once.
- **"Changed elsewhere" as a separate list.** Each exception sits under the group it belongs to, so the answer to "where did I turn
  that off?" is under what it was.

---

## Shape 2: one Settings, scoped

One Settings screen holds every home's settings as tabs, and it opens on the tab for wherever you came from.

**The door.** A gear on every bar: the hub, a show, a game. From the hub it opens on You; from a show, on the show; from a game,
on the game.

**The tabs:** You · <Show> · <Couch> · <Game>. Only the tabs that apply to where you came from are shown: from the hub, You and
your couches; from a game, all four. Each tab holds Shape 1's home, in the same order.

**Drill-downs:** as Shape 1, inside the tab. Back closes Settings to where you came from.

**Labels:** the tabs use the subjects' own names ("Survivor 51", "ZT Survivor 51", "Weekly Lineup").

**Left out:** the show's ⋯ keeps only things to do (Invite, Plan, How it works). All settings move behind the gear.

**Its risks, for Round 0 to show honestly:**
- **Four names at 390 don't fit.** "ZT Survivor 51" and "Survivor 51" sit side by side, telling the couch from the show by one word.
- **Which tab holds chat notifications?** You, the couch, or the show? Scope is an abstraction Joanna doesn't hold.
- **Game rules land under "Settings".** Rules that change the game for everyone sit beside personal preferences, which blurs "my
  settings" with "our game".

---

## Shape 3: ask, don't file

Settings leads with the reasons people come. Each opens just the controls that answer it, wherever they live.

**The door.** Your picture on the hub, as today, plus the same doors as Shape 1 for a show and a game. The questions page is the
You home's first view.

**The first view, in order:**
1. **Get fewer notifications** → this phone; the kinds; mute a show (your shows, each with Mute); each couch's chat.
2. **Hide results until I've watched** → when results show, with each show's exception.
3. **I'm behind (or ahead) on a show** → your shows, each with "Through Ep N" → its episode list.
4. **Change my name or picture** → your profile.
5. **Hide a show from my couch** → your shows, each with a switch.
6. **Leave a game or a couch** → your games and couches, each with Leave.
7. **Run my game** (runners) → the games you run → Manage this game.
8. **Everything else** → the full list, as Shape 1's You.

**Drill-downs:** each question opens a sheet over the questions. Back returns to the questions. A control can appear under two
questions; it's the same control, never a copy.

**Labels:** the questions, in the person's words. They're the labels.

**Left out:** the groups (they're under "Everything else").

**Its risks:**
- **An extra step for the Tinkerer,** who knows exactly what he wants.
- **A question list that grows** with every feature.
- **The show's own controls still need Shape 1's doors**, so it's Shape 1 plus a questions page, not a different structure for
  shows and games.

---

## Judged on the same situations

Taps from where the reason arises to the control. Lower is better; "—" means it can't be done.

| Situation | Today | Shape 1 | Shape 2 | Shape 3 |
| --- | --- | --- | --- | --- |
| Joanna mutes one couch's chat, from the show | 3 (only "off for this show": show ⋯ › Notifications › Couch chat) | 3 (show ⋯ › Notifications for this show › Mute) | 3 (gear › Notifications › chat) | 5 (Home › picture › Get fewer notifications › that couch) |
| The Behind-Watcher keeps one show's results hidden | — (Hide scores only works on shows you play) | 2 (show ⋯ › Results on this show) | 2 | 4 (Home › picture › Hide results › that show) |
| Andrew leaves one game | — (all of a show's games, or none) | 2 + hold (game ⋯ › Leave this game) | 3 + hold | 4 + hold |
| Conor starts one more player from Ep 6 | 3–5 | 3 (game ⋯ › Manage › Who scores each week) | 3 | 5 |
| Riley opens this episode's lock | 3–5 | 1–2 (the strip), or 3 | 3 | 5 |
| An owner renames the couch | 5 | 2 (couch name › Rename) | 3 | 4 |
| Anyone changes their name | 3 | 2 (picture › Edit) | 2 | 3 |
| Someone hides a show from the couch | 3–4 | 2 (show ⋯ › Hide this show) | 2 | 3 |

**Shape 1 wins or ties every row.** Shape 2 ties several but costs the scope tabs. Shape 3 is slowest from inside a show or a game,
where most reasons arise, and fastest only when you start from the hub with no idea where something lives. Shape 1 can borrow that
strength: the You home's groups read as answers to questions, and the exceptions sit under each group.

## Shared by every shape

- **One row grammar:** value first; a tap opens the control in place; a fixed setting says why; Recommended marked one way; a dot
  and Reset to recommended on anything changed.
- **One way to save, by reach** (the plan's rule 6).
- **Every pointer opens the exact setting, already unfolded.** Folds and lines get anchors, so a link can name one.
- **Every push that has a setting behind it carries a link to that setting.** The notification's own words say where.

## Open questions about the structure

1. Should the You door appear beyond the hub, as your face on the show's bar? Shape 1 says no: one tap back to the hub costs less
   than a face on every bar.
2. Should the couch's door also be its name on the show's bar? Shape 1 says yes: it's where the couch is named inside a show.
3. Rules for a couch's season: a section on each game's Manage page, or a small page of their own? Shape 1 says a section,
   because two settings don't earn a page.

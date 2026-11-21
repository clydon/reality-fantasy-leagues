# Settings, Round 1: Your settings, and notifications as one system (Intent's spec)

> **Status (2026-11-20): Round 1, step 1 of the design process** (docs/DESIGN-PROCESS.md: Intent, then Perception-First Design,
> then Impeccable). It specs the You home and every place a notification is set, on the structure Round 0 decided
> ([settings-r0-spec.md](settings-r0-spec.md), Shape 1; [decisions.md](decisions.md), 2026-11-20) and with Round 0's names
> ([settings-r0-names.md](settings-r0-names.md)). The cuts it carries out are the plan's C1–C13, with A3, A5 and BACKLOG 237
> ([PLAN-settings-overhaul.md](../PLAN-settings-overhaul.md)).

## The job

**Your settings** answers "how does the app treat *me*?" in one screen: what reaches me, when results show, what my couches see,
how it looks, my account. Every group reads as its current value, so most visits end at the first view ("yes, that's how it's
set"). A visit that needs a change is one tap to the group and one to the control.

**Notifications, as one system,** answers "why did my phone buzz, and how do I make it stop *just this*?" from wherever the buzz
came from: the push, the bell, the show, the couch. Each place sets the smallest thing that fixes the reason, says what you'll still
get, and links to the others.

## Who comes, and why (the entry points)

| Who | Why they come | Where they start | The fix, and its taps |
| --- | --- | --- | --- |
| **Joanna** (forgets) | The couch's chat buzzed all through Survivor | the push, or the show | the show's ⋯ › Notifications › Mute, or the couch's page › Chat notifications (3) |
| **Joanna**, later | "Why don't I get reminders any more?" | the hub | gear › Notifications: the first line says "Off on this phone", with Turn on (2) |
| **Andrew** (drives by) | Too many pings, all of them | a push (Android: its Notification settings button) | Notifications, opened at its kinds (1–2) |
| **The Behind-Watcher** | Results showing before she's watched | the hub | gear › When results show (2): "Wait until I've watched" |
| **riley**, who only watches The Traitors | wants it marked watched as each episode airs | the hub | gear › When results show › the show's switch (3) |
| **Conor** (tinkers) | "Where did I turn that off?" | the hub | gear: each group's value says, and Your shows, couches and games lists every exception (2) |
| **The Curious Relative** | her name, the dark screen | the hub | gear › Edit (2); Appearance opens in place (2) |
| **Anyone** on a new phone | sign the old one out; does this phone get them? | the hub | gear › Your account › Your phones (3) |
| **An iPhone in Safari** | notifications can't work until it's installed | the yellow plate, or Your account | Install the app (2), the steps for this phone open |

## What changes for whom

| Situation | What Your settings shows differently |
| --- | --- |
| One couch (jordan) | the identity line names the couch |
| Two couches (alex and casey) | the identity line names both; Your shows, couches and games lists both couches |
| Solo (on no couch) | no Privacy group (nobody sees you); "Couch chat" and "Your couch's activity" are gone from Notifications; Your shows, couches and games offers Start or join a couch |
| Watches but doesn't play (riley on The Traitors) | When results show lists the shows that can be marked watched as they air |
| Runs games (alex) | nothing extra here: running a game is Manage this game's (Round 3). The Backstage switch and "Your AI for results" are gone |
| Site admin | a Site admin row above Sign out |
| This phone off, nothing reaches you | the one yellow plate, under the identity: "Notifications are off on this phone", Turn on |
| This phone off, another phone gets them | no plate; Notifications' value says "On for your other phone · off here" |
| Blocked by the browser | the plate says so, with how to allow them; no Turn on |
| iPhone, not installed | the plate is "Add it to your Home Screen first", opening Install the app |
| Notifications on | no plate; Notifications' value lists what's on |
| Google-only account | Your account shows "Signed in with Google"; no Change password |
| Follows a sport | When results show has its Sports line (live by default) |

## The drill tree, with verdicts

Every level the round touches, from the hub down. Verdicts: keep, repaint, restructure, new display, new screen.

| Level | Today | Questions people bring | Verdict |
| --- | --- | --- | --- |
| **The hub's bar** | wordmark · bell · picture (the picture's sheet holds the only Settings door) | "where are my settings?" | **Restructure**: a gear between the bell and the picture opens Your settings (decided). The picture's sheet keeps your couch and numbers, and keeps a quiet Your settings row for anyone who learned that way in; Take the tour leaves it (C13) |
| **Your settings** (/settings) | Quick settings (12 open options) · Everything else (5 folds) · Help and account | "how am I set?", "change X" | **Restructure** into groups with values (below) |
| Notifications | phone plate + chat in Quick settings; six switches in a fold | "too many", "none", "why this one?" | **New screen** (pushed: `?page=notifications`) |
| When results show | Hide scores + Sports scores too in Quick settings; Shows that move along, a fold | "will I be spoiled?" | **New screen** (`?page=results`), one choice for shows and one for sports (C1) |
| Privacy | three levels, four switches, a preview | "what do they see?" | **New screen** (`?page=privacy`): one switch and the preview (C6) |
| Appearance | a three-way choice in Quick settings | "dark or light?" | **Restructure**: one row with its value, opened in place (C12) |
| Your shows, couches and games | Your couches fold; shows nowhere | "where did I set that?" | **New screen** (`?page=yours`): every show, couch and game, each with what's set there |
| Your account | a fold of six rows | password, Google, phones | **New screen** (`?page=account`) |
| Your phones | doesn't exist | "does this phone get them?", "sign the old one out" | **New screen** (`?page=phones`, A3) |
| Install the app | the plate's picture, on iPhone only | "how do I put it on my phone?" | **New display**, a sheet with each kind of phone (A5) |
| Your profile (Edit) | a sheet | name, picture, colour | **Keep**: it works, and Round 0 found nothing against it |
| Help | three rows plus a Credits link | report, tour | **Repaint**: three rows, Credits renamed "Where art and data come from" |
| **A show's Notifications** (⋯ › Notifications) | six switches, off for this show | "quiet this show" | **Restructure**: Mute first (for a day, a week, until I turn it back on), then the kinds for this show, each with what you'll still get (C16, A6) |
| **A couch's page** (its details sheet) | no notification setting | "quiet this couch's chat" | **New display**: a Chat notifications row, its value first, opened in place (C26, A9) |
| **A game** | none | "stop this game pinging me" | **Keep: none.** Per-game notifications are A12, "not now". A game's pings are its show's (mute the show) or end with leaving it (Round 2) |
| **The push** | its words, and a tap that opens the page | "how do I stop these?" | **New display**: a "Notification settings" button on phones that show buttons (Android, computers), opening the place that would quiet it (a show's push: that show's Notifications) |
| **The bell** | the list; a foot while nothing rings | "where are these set?" | **Repaint**: a Notification settings link at its foot |

## Your settings, in order

The title is **Your settings**. Back returns to wherever it opened from (the hub, a link).

1. **You.** Your face, your name, and the couches you're on ("On ZT Extra and ZT Survivor 51"). **Edit** opens your profile.
2. **The plate**, only while nothing reaches you: "Notifications are off on this phone", what that costs ("Reminders before your
   moves lock and results wait in the bell"), **Turn on** and **Not now**. Blocked and not-installed have their own words. It stays
   because it's the one state that's wrong for nearly everyone (Settings D, 2026-10-31; PFD R2).
3. **The groups**, each one row, its name over its value:

| Row | Its value (examples) | Opens |
| --- | --- | --- |
| Notifications | "On · reminders, results, your couch" · "Off on this phone" · "On for your other phone · off here" | the Notifications page |
| When results show | "After you've watched · sports live" | the When results show page |
| Privacy | "Your couches see how far you've watched" · "Hidden from your couches" | the Privacy page (not shown solo) |
| Appearance | "Dark" | in place: Dark · Light · Same as my phone |
| Your shows, couches and games | "3 shows · 2 couches · 3 games" | the Your shows, couches and games page |

4. **Your account** (one row: "zt_nd_alex · 1 phone gets notifications"), opening its page.
5. **Help:** Report a problem · Take the tour · Where art and data come from.
6. **Site admin**, for a site admin.
7. **Sign out**, in red, last. It also turns off this phone's notifications (BACKLOG 237), and says so in its line.

**Left out of the first view, and why:** every open control (chat's three choices, the switches): a visit that only checks a
value shouldn't wade through controls; "Changed elsewhere" as its own list: each group's page and Your shows, couches and games
carry the exceptions, so "where did I turn that off?" is answered under what it was; How each game works (C9: each game's How it
plays); Your AI for results (C8); The full design (C11).

## The pages under it

Each is a pushed page (`/settings?page=<key>`), so the phone's back gesture closes it, a link can open it directly, and Back
returns to Your settings at the same scroll.

### Notifications (`?page=notifications`)

1. **This phone.** Its state and its one action: On for this phone (Turn off) · Off on this phone (Turn on) · Blocked (how to allow
   them) · Add it to your Home Screen first (Install the app). Under it: "Your phones: 2 get notifications ›" (opens Your phones).
2. **What comes to your phones.** One switch each, its outcome as the title, what it covers under it:
   - **Reminders before your moves lock**: only while a pick, lineup, draft turn or waiver claim is still open (C5).
   - **Results**: who went home soon after the episode, then the final scores at noon the next day (C2: one switch).
   - **Your couch's activity**: a new game, a watch along, a poll or prediction, a bingo line.
   - **Invites and join requests**: no switch; "Always on: someone's waiting on you" (C3).
   Each switch, once off, says what you'll still get: "Off · they still land in the bell".
   While nothing reaches you, the list reads as off: a line over it says "None of these reach you until notifications are on", and
   the switches show what you've chosen, dimmed.
3. **Couch chat, on every couch:** Every message · Skip possible spoilers (Recommended) · Never, with its consequence under it, and
   Reset to recommended once changed.
4. **Set on a show or a couch:** every exception, each a link to where it's set: "Survivor: muted until Fri", "ZT Extra's chat:
   never", "The Traitors: results off". With none: "Mute a show from its ⋯ menu; set a couch's chat on its page."
5. A line: "The bell on the hub keeps every notification for 30 days, except chat." (Today's "keeps everything" isn't true.)

Not shown solo: Couch chat, Your couch's activity.

### When results show (`?page=results`)

1. **Shows:** After I've watched (Recommended) · Straight away. Straight away asks first, because Undo can't unsee a result
   ("Results, standings and notifications will say who went home as soon as it's known, on every show, even the week you watch
   late"). It now means what it says on every show, including ones you only follow (C1; today it only works on shows you play).
2. **Sports:** Live (Recommended) · After I've watched ("A game that's begun shows only when it started until you tap Show the
   score").
3. **Marked watched as it airs** (only for shows you follow and don't play: riley's The Traitors): one switch a show, asking first,
   as today's Shows that move along. It moves to each show's own page in Round 2 (C15).
4. A line: "A game's own-pace seat always goes by your reveals, whatever this says."

### Privacy (`?page=privacy`)

1. **Your couches see how far you've watched**: one switch (today's Where I am, with When I'm watching merged into it: C6).
2. **What riley sees about you**: the live preview, through someone on your couch's eyes, its lines changing as the switch does.
3. Two fixed lines: "Your GIFs and reactions show when you post one" (posting is the choice: C6), and "Your picks show once they
   lock: the games need that."
4. **Hidden from your couch:** the shows you've hidden, each a link to it; with none, "Hide one from the show's ⋯ menu".

### Your shows, couches and games (`?page=yours`)

The map. Each row is the thing's name over what's set for you there, so "where did I turn that off?" is a glance:
- **Couches:** faces, name, its value ("You run it · chat: your default", "Chat: never"). Opens the couch's page.
- **Shows:** art, name, "Watched through Ep 5" plus anything set there ("Muted until Fri", "Hidden from your couch"), and under it
  your games on the show (up to three, then "+2 more"). The show opens its ⋯ menu (its settings for you, until Round 2 gives it
  a gear); a game opens the game.
- Solo, or on no couch: "Start a couch or join one", opening the couch switcher's start and join.

### Your account (`?page=account`)

Your sign-in name ("Your name is how you sign in too") · Change password (an account with one) · Google (linked, or Link Google) ·
Your phones › · Install the app › · Back to the classic design (until it goes after Dec 16: C10, with its untrue "Your games are
the same in both" replaced) · later, an email (A1) and delete my account (A2), waiting on BACKLOG 185.

### Your phones (`?page=phones`, A3)

1. **Get notifications:** each phone or computer that gets them, named from its browser ("iPhone · Home Screen app", "Android ·
   Chrome"), "This phone" marked, when one last arrived. Each has **Turn off**.
2. **Signed in:** each place you're signed in, the same names, when it was last used. **Sign out everywhere else**, with a
   sentence first: "Your other phones and computers will need your name and password again, and stop getting notifications."

### Install the app (a sheet, A5)

The steps for this phone open first; the others are a tap away: iPhone (Safari: Share, Add to Home Screen, open it from there),
Android (Chrome: the ⋮ menu, Add to Home screen or Install app), a computer (the install button in the address bar). On an
installed copy: "Installed on this phone."

## Notifications beyond Your settings

### A show's Notifications (its ⋯ › Notifications)

Title "Notifications", subtitle "Survivor · every season" (a show's switches cover every season of it).
1. **Mute Survivor:** its value ("Not muted" · "Muted until Fri 8 PM" · "Muted until you turn it back on"); a tap opens For a day ·
   For a week · Until I turn it back on; while muted, Unmute. Under it, what you'll still get: "Results, your couch's activity and
   chat stay quiet. Reminders before your moves lock still come, so a muted show never costs you a pick. It all stays in the bell."
2. **Just this show:** the four kinds (reminders, results, your couch's activity, couch chat), each off for this show alone. A kind
   that's off everywhere says "Off everywhere, in Your settings" and links there.
3. The phone's line, only while nothing reaches you (as today).
4. A link: "Your settings for every show".

### A couch's page (its details sheet)

**Chat notifications on ZT Extra:** its value ("Your default: skip possible spoilers" or "Never, just on this couch"); a tap opens
Every message · Skip possible spoilers · Never in place, and **Use my default** once it's set here. It covers every show's chat on
that couch. A show's own "Couch chat" off still wins on that show.

### The push

Phones that show buttons on a notification (Android, computers; iPhone doesn't) get one: **Notification settings**. It opens the
place that would quiet that push: a show's push opens that show's Notifications; anything else opens Your settings' Notifications.
The push's own words don't change.

### The bell

Its foot gains **Notification settings**, opening Your settings' Notifications. The "Off on this phone" foot stays.

## How each thing saves (the plan's rule 6)

Everything here is "just you": it applies at once, with a real Undo in the toast. Three ask first:
- **Straight away** (results): a sentence and Show results / Keep them hidden. Undo can't unsee.
- **Marked watched as it airs**: the same, as today.
- **Sign out everywhere else**: a sentence, then Sign them out. No Undo (they sign in again).

Turning this phone on or off has no Undo (the browser's own permission). Sign out has none.

## Backend this calls for

| Change | For |
| --- | --- |
| "Straight away" lets results out on every show you follow, not only those you play (the guard's progressFrom); own-pace seats still go by your reveals | C1 |
| One "Results" moment (early and final types together); a show's old early/final offs read as Results | C2 |
| Invites and join requests always push (no switch can turn them back on) | C3 |
| The Backstage moment goes, and its results-to-fill-in push stops | C4, BACKLOG 235 |
| Where I am and When I'm watching saved together; GIFs and reactions always shared on shows you follow openly | C6 |
| The AI setting and Grok go | C8 |
| Mute a show until a time, or for good (a `muted` column on notification_prefs) | A6, C16 |
| Chat notifications per couch (a column on couch_members) | A9, C26 |
| Your phones: list, turn one off, sign out everywhere else (push_subscriptions, Better Auth's sessions) | A3 |
| Signing out turns this phone's notifications off | BACKLOG 237 |
| A site admin acting as you can't change your notification settings or register their phone for your pushes (the profile route's rule, on the push, phones, mute and couch-chat routes) | Noticed in Round 0 |
| The exceptions (muted shows, a show's kinds off, couch chat set per couch) in the profile read | the "set on a show or a couch" list |

## Returns

| From | Back goes to |
| --- | --- |
| a group's page | Your settings, at the same scroll |
| Your phones | Your account (it's pushed over it; from Notifications' link, Notifications) |
| Install the app (a sheet) | wherever it opened |
| an exception's link (a show) | the show, its ⋯ menu open; the show's own back |
| an exception's link (a couch) | its details sheet over Your settings; closing it returns to the page you were on |
| the push's Notification settings | the app's page it opened, with ordinary back |

## Left out, and why

- **Per-game notifications** (A12): "not now". A game's pings are its show's.
- **Results per show** (A7) and **When a new episode airs** (C15): Round 2, on the show's own page.
- **Privacy per couch** (A10): "not now".
- **An email, and deleting your account** (A1, A2): wait on BACKLOG 185.
- **A test notification** (A4): "not now".
- **Questions at the top** (Shape 3): rejected in Round 0; groups' values carry the answers.
- **Search:** the lists are short after the cuts (the article's step 6 is for long lists).

## Open questions

1. Should Sign out ask first? It doesn't today, and signing in again is quick; the line under it says what it turns off. This
   spec says no.
2. A muted show's chat: quiet even when a couch is set to Every message? This spec says yes: muting the show is the more recent,
   more specific wish for that show.

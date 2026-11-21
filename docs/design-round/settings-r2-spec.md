# Settings, Round 2: a show and a couch, for you (Intent's spec)

> **Status (2026-11-21): Round 2, step 1 of the design process** (docs/DESIGN-PROCESS.md: Intent, then Perception-First Design,
> then Impeccable). It specs a show's own settings for you, Where you are, leaving one game, and the couch, on the structure
> Round 0 decided ([settings-r0-spec.md](settings-r0-spec.md), Shape 1; one gear on every bar) with Round 0's names and Round 1's
> grammar ([settings-r1-spec.md](settings-r1-spec.md)). The cuts it carries out are the plan's C14–C28 with A6–A11 as approved
> ([PLAN-settings-overhaul.md](../PLAN-settings-overhaul.md), Round 2).

## The job

**A show's settings for you** answers "how does this show treat *me*?" on one page behind the gear on the show's bar: how far
I've watched, what happens when a new episode airs, when its results show, what it may send me, whether my couch sees me watch
it, and how I leave it. Each row reads as its value, so most visits end at the first view.

**The show's ⋯** becomes what it was always half-way to: **things to do** (invite, plan a watch along, how it works, the drafts,
recent changes, and for now Backstage and the desk's row). Nothing on it is a setting any more, and Everything else's sheet goes.

**Where you are** answers "how far am I?" and moves it: one list of episodes with "I've watched them all" at its top, and Save
with a real Undo. It stops switching anything else on.

**A game's ⋯** loses Where you are (it's the show's) and gains **Leave this game**, held, one game at a time.

**This couch** answers "who's on it, how do I bring someone, and how does it treat me?" in its sheet, with the owner's rows
below and Leave last. **Which couch the hub shows** moves to the hub's own header, saved for your account rather than the phone.

## Who comes, and why (the entry points)

| Who | Why they come | Where they start | The fix, and its taps |
| --- | --- | --- | --- |
| **Joanna** (forgets) | the couch's chat spoiled Survivor; she watches Thursday | the show | gear › Notifications › Mute › Until the next episode (4) |
| **Joanna**, later | "I watched it, why is it still hiding things?" | the show | the progress control (as today) or gear › Episodes you've watched › I've watched them all › Save (3–4) |
| **Andrew** (drives by) | done with a show he only half-played | a game | its ⋯ › Leave this game › hold (3) |
| **riley**, who only watches The Traitors | wants it marked watched as each episode airs, and its results straight away, on this show only | the show | gear › When a new episode airs › Mark it watched (3); gear › When results show here › Straight away (3) |
| **jordan** | watches The Traitors without wanting the couch to see | the show | gear › Hide this show from my couch (2) |
| **The Behind-Watcher** (sam) | results showing before she's watched, on one show | the show | gear › When results show here › After I've watched (3) |
| **Conor** (tinkers), on two couches | the hub showing the wrong couch, on a new phone | the hub | the couch's name in the header › the other couch (2), kept on every phone |
| **alex**, the couch's owner | hand the couch to casey before he leaves it | the hub | the couch's name › Couch settings › Make someone else the owner › casey › confirm (5) |
| **Anyone** | "Where did I set that?" | Your settings › Your shows, couches and games | a show's row opens its settings page, not its ⋯ (2) |

## What changes for whom

| Situation | What a show's settings page shows differently |
| --- | --- |
| A show you play (own pace or together) | Episodes you've watched is fixed ("Moves as you reveal"): the row opens the ledger with its Reveal action, as today. No "When a new episode airs" (your games move you). Leave all my games here, last |
| A show you only follow | Episodes you've watched opens the editable list. When a new episode airs, while the season's still airing. Remove from my shows, last |
| A sport whose scores show live (the default) | Episodes you've watched says "Scores show live", no chevron, nothing to set (C20). When results show here says what moves the mark (Show the score) only while sports wait |
| A finished season | no "When a new episode airs" (nothing new airs); Mute loses "Until the next episode" |
| A 30-episode season | the list scrolls inside its sheet (the ledger already does), "I've watched them all" stays at the top |
| Solo (on no couch) | no "Hide this show from my couch" (nobody to hide from: the audit's misleading line); Couch chat absent from its Notifications (as Round 1) |
| Runs games here | nothing extra on this page: running a game is Manage this game's (Round 3). Backstage stays on the ⋯ until then |
| The site admin | "This season in Admin" stays on the ⋯ (a thing to do, not a setting of yours) |
| Acting as someone | read-only, as every settings write already is |

| Situation | What This couch shows differently |
| --- | --- |
| Its owner | Rename · Get a new code · Make someone else the owner (with a confirm, C28) |
| A member | none of the owner's rows |
| On two couches | the hub's header names the one shown, with a chevron; the sheet lists both |
| On one couch | the header still names it (it's the couch's door), and the sheet offers Start or join another |

## The drill tree, with verdicts

| Level | Today | Questions people bring | Verdict |
| --- | --- | --- | --- |
| **The show's bar** | back · art and name · status · ⋯ | "where are this show's settings?" | **Restructure**: a gear beside the ⋯ opens the show's settings page (Round 0's decision). The ⋯ keeps things to do |
| **The show's ⋯** | Backstage · Admin · Notifications · Invite · How it works · Where you are · Everything else (a sheet inside a sheet: watch along, drafts, history, Watch privately, Remove, Leave) | "invite someone", "plan a watch along" | **Restructure**: one sheet of things to do, no Everything else. Settings and leaving move to the gear |
| **A show's settings for you** (`?page=you`) | doesn't exist: its parts are in four places | "how is this show set for me?" | **New screen** (below) |
| Episodes you've watched | Where you are, from the ⋯ (players), the progress control, a game's ⋯ | "how far am I?", "I've seen it now" | **Restructure** (C14): one list, "I've watched them all" first, Save with Undo, Keep me live gone |
| When a new episode airs | Keep me live in Where you are (Save) + Settings' Shows that move along (at once): one column, two editors | "mark it as it airs", "ask me", "leave me alone" | **New display** (C15): three choices in place, Recommended marked, "Mark it watched" asks first |
| When results show here | doesn't exist: one account choice | "spoil this show, not the others" | **New display** (A7): Your default · After I've watched · Straight away, in place |
| Notifications for this show | the ⋯'s Notifications sheet (Round 1) | "quiet this show" | **Keep** the sheet, **repaint** Mute: "Until the next episode" first (the user's pick, 2026-11-20), then a day, a week, until I turn it back on |
| Hide this show from my couch | Watch privately, a switch two sheets down | "don't let them see I watch it" | **Restructure** (C17): one level up, renamed, its consequence in the line; absent solo |
| Leave all my games here / Remove from my shows | Everything else | "I'm done with this show" | **Keep** both, red, last; Leave held (as today); Remove gets Undo |
| **Where you are on a game's ⋯** | a row | — | **Drop** (C19): it's the show's |
| **Leave this game** | doesn't exist (leave is every game on the show) | "out of this one, not the others" | **New** (A11): on the game's ⋯, red, last, a hold with the consequence; the server's takeOut already works one game at a time |
| **Add a show's where step** | the stepper, I'm up to date (turns on Live), Keep me live, Look up all N | "how far am I in it?" | **Repaint**: I'm up to date turns nothing on; Keep me live becomes the recommended default ("Ask me", said in a line); Look up stays on by default (C21: already); **add** "Hide it from my couch" while on a couch (A8) |
| **"You both watch"'s Not now** | lasts for good, "We won't ask again", no Undo | "not this one" | **Repaint** (C22): "Don't suggest this one", Undo in the toast |
| **Sports' Show the score** | a button that silently moves your mark for the week | "will this spoil the rest?" | **Repaint** its line: it says what it moves |
| **Sports: Watch it as if live** | only on the hub's card, for 36 hours; no list | "which games am I holding?" | **New display** (C24's list): When results show's Sports part lists the games you're watching as if live, each with I've watched it. Starting one on every finished game is the sports lane's (noted) |
| **Following a team / Add to my shows** | two ways to follow a sport | | **Deferred** (C23): it's a model change in sports' follows, and the sports lane holds those files (step 2.7). Noted for the sports plan |
| **The hub's header** | wordmark · bell · gear · picture; the couch switcher is two sheets down (picture › couch line) | "which couch am I looking at?", "switch" | **Restructure** (C25): the couch's name under the wordmark, a tap opens Your couches; the choice saved for your account |
| **Your couches** (the switcher) | couches · "{couch} details" · Join | "switch", "this couch's settings" | **Repaint**: the current couch first with Couch settings; the others switch; Start and Join last |
| **This couch** (its sheet) | faces · invite code · new code · chat · seasons together · owner rows · Leave | "who's on it?", "invite", "quiet its chat" | **Restructure** to Round 0's first view: faces with the Invite tile, the code, Chat notifications; then seasons together; then the owner's rows; Leave last. **Hand it on** renamed "Make someone else the owner", with a confirm (C28) |
| **Who can fill in results** (C27) | Backstage's couch-wide switch | | **Round 3**: it lives in Backstage's files, which step 2.7 edits; it goes with Backstage |

## A show's settings for you, in order

A pushed page over the show (`/show/<season>/<tab>?page=you`), like How it works and Make it a game: the phone's back closes it,
a link opens it, Back returns to the tab you were on. Its title is the show's name and season ("Survivor 51"); its kicker says
whose ("Your settings"). The show's art sits behind the title (the house look carries the show; Round 1's "soul" line).

1. **Episodes you've watched.** "Through Ep 5 · Wed, Nov 12" (the air date names the episode: the memory "Episode air dates"), or
   "Not started", or "All 13" on a finished season, or on a show you play "Through Ep 5 · moves as you reveal". Opens Where you are.
   On a sport whose scores show live: "Scores show live", fixed, no chevron.
2. **When a new episode airs** (a show you follow and don't play, still airing). Value: "Ask me if I've seen it" (Recommended) ·
   "Mark it watched" · "Nothing: I move it myself". Opens in place as three choices. "Mark it watched" asks first, inline, as Round
   1's did: "Each new episode counts as watched as soon as it airs, so its results show then, even if you watch late."
3. **When results show here.** Value: "Your default: after you've watched" (or "…: straight away"), "After I've watched, here",
   "Straight away, here". Opens in place: Your default (…) · After I've watched · Straight away. Straight away asks first (Undo can't
   unsee). Under it, always: "Your games at your own pace always wait for your reveal." On a sport: "Your default: live" and the
   same three, in sports' words (Live · After I've watched), with Show the score's line under After I've watched.
4. **Notifications.** Value: "On" · "Muted until Thu 8 PM (the next episode)" · "Results off here" · "Off on this phone" (Round 1's
   reach line). Opens the show's Notifications sheet, as Round 1 built it, with Mute's choices now: **Until the next episode**
   (while one is scheduled: "until Thu 8 PM"), For a day, For a week, Until I turn it back on. A mute covers every season of the
   show, and its row says so ("Muted on every season of Survivor").
5. **Hide this show from my couch** (on a couch). A switch. Line: off "Your couch sees you watch it and how far you are"; on "Only
   you see it. Chat and the games still work." At once, with Undo.
6. **Leave all my games here** (a player, red) or **Remove from my shows** (a watcher, red), last. Leave keeps today's hold and its
   consequence. Remove applies at once with Undo, and Back takes you home.

**Left out, and why:** Invite, How it works, watch along, the drafts, recent changes (things to do: the ⋯); Backstage and the
desk's row (Round 3 and Round 5 move them; until then they're jobs, on the ⋯); per-game notifications (A12, "not now"); privacy per
couch (A10, "not now"); a "Changed elsewhere" list (each row's value is the answer here, and Your settings' map lists the show).

## The show's ⋯, after

Title the show's name, subtitle its season and couch. In order: Backstage (a plate while something needs you, else a row; Round 3
replaces it) · This season in Admin (a site admin) · Invite a friend · Plan a watch along · How it works · Draft room / Blind draft
(while there's one) · Recent changes. No Everything else. No Notifications, Where you are, Watch privately, Remove or Leave: the
gear has them, and the ⋯'s foot says so once: "Your settings for this show are under the gear."

## Where you are (C14)

The watching sheet as it is, on the ledger, with:
- **I've watched them all** at the top of the list while you're behind what's aired (it moves the boundary to the latest; it
  doesn't touch When a new episode airs).
- **No Keep me live** in the sheet (it's on the show's page, as When a new episode airs). Its pointer line becomes: "When a new
  episode airs: ask me · Change it in this show's settings" (a link to `?page=you`), only on a show you follow that's airing.
- **Save · through Ep 5**, then a toast "Through Ep 5 on Survivor 51" with **Undo**, which puts the mark back where it was.
- A show you play: unchanged (the fixed ledger and its one Reveal).

## Leaving one game (A11)

The game's ⋯: How it plays · Your sheet · Game settings (runners) · **Leave this game** (red, last). A hold sheet, as Leave these
games has: "You leave Weekly Lineup. Your team and points stay in the standings, but nobody plays it. Your other games here and the
couch stay. Whoever runs it can bring you back for 30 days." Never as its last Commissioner (the same problem line). After: the
toast "You've left Weekly Lineup", and the show's Games tab.

## The hub's couch (C25) and This couch

- **The header.** Under the wordmark, the couch shown: "ZT Survivor 51 ▾" (truncated, a 44 px target). Tap: Your couches. Solo: no
  name (the solo hub has its own Start a couch).
- **Your couches** (the switcher sheet): the current couch first, its faces and "4 people · you run it", with **Couch settings ›**;
  then each other couch as a row that switches (and closes); then Start a couch · Join a couch. The choice is saved for your account
  (a `hub_couch` column on user_settings) and read before the phone's own memory, so a new phone opens on it.
- **This couch** (its sheet; Round 1 calls it the couch's page): title the couch's name, subtitle "4 people · since Survivor 50".
  1. The faces, each opening that person, and the Invite tile.
  2. Your invite code, and Get a new code (its inline confirm, as today).
  3. Chat notifications on this couch (Round 1's row).
  4. Seasons together.
  5. For its owner: Rename the couch · Make someone else the owner. The second picks a person, then asks: "Make casey the owner of
     ZT Survivor 51? casey can rename it, make new codes and hand it on. You stay on the couch." **Make casey the owner** / Keep it.
     Toast with no Undo (it's casey's now; casey can hand it back).
  6. Leave this couch, red, last (its hold, as today).

## Add a show, and the nudge

- **Add a show's where step:** the season, the stepper or ledger, **I'm up to date** (moves to the latest, nothing else), Look up all
  N (on), and while you're on a couch **Hide it from my couch** (off; A8). Keep me live goes; a line under the stepper says what
  happens: "When a new episode airs, Tonight asks if you've seen it. Change it in the show's settings." (The default for a new follow
  of an airing season becomes Ask: the Recommended, so most people never set it.)
- **"You both watch":** Not now becomes **Don't suggest this one**; its toast "We won't suggest Survivor 51 again" has Undo.

## Sports

- **Show the score**'s line: "Shows this game's score and moves where you are to its week, on every season you follow with it."
- **When results show › Sports** (Your settings) lists **Watching as if live**: each game you're holding, "Started Sun 1 PM", with
  **I've watched it** (which ends the hold, as the hub's card does). With none, nothing (no empty heading).

## How each thing saves (the plan's rule 6)

All "just you": at once, with Undo in the toast. Asking first: Mark it watched, Straight away (can't be unseen). Held: Leave all my
games here, Leave this game, Leave this couch. Confirmed, no Undo: Make someone else the owner (it changes who controls the couch;
the new owner can hand it back). Where you are's Save has Undo (it puts the old mark back; nothing was revealed by moving it *back*,
and moving it forward is what Save asked for).

## Returns

| From | Back goes to |
| --- | --- |
| a show's settings page | the tab you opened it from |
| Where you are, from the page | the page (the sheet closes over it) |
| the show's Notifications, from the page | the page |
| Your settings › a show's row | that show's settings page; its Back goes to Your settings |
| Your couches › Couch settings | the couch's sheet, with Back to Your couches |
| Leave this game | the show's Games tab |
| Remove from my shows | the hub (with Undo in the toast) |

## Backend this calls for

| Change | For |
| --- | --- |
| A per-season results choice for you (`show_follows.results`: null, 'wait', 'now'), read wherever the account's choice is read (the guard and the pushes that name who went home), the season's choice first | A7 |
| Leave one game: `POST /api/seasons/<id>/leave?league=<id>` over the same takeOut and its last-Commissioner guard | A11 |
| Mute until the next episode: the mute route takes "next", ending at the season's next scheduled air time (refused when none) | A6, the user's pick |
| The hub's couch saved for the account (`user_settings.hub_couch`) | C25 |
| A new follow of an airing season starts at keep_up 'ask' | C14/C15 default |
| Watch privately written at follow time from Add a show | A8 (the follows route already takes `private`) |

## Left out, and why

- **C23** (one way to follow a sport) and starting **Watch it as if live** from every finished game: the sports lane's files
  (step 2.7 is in flight there). Noted in the plan for the sports plan.
- **C27** (Who can fill in results): with Backstage, in Round 3.
- **A10** (privacy per couch) and **A12** (notifications per game): "not now".
- **Search, questions first:** the page has six rows.

## Open questions

1. Should "When results show here" be per season (as built: it lives on the follow, beside the mark) or follow the show into its
   next season? This spec says per season: a new season starts at your default, and the mute (per show) says "every season".
2. Should the gear show a dot when something's set on this show (muted, results straight away)? This spec says no: the page's
   values say it, and Your settings' map lists it.

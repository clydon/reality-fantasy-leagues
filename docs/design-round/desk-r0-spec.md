# The site admin's desk, Round 0: where everything lives (Intent's spec)

> **Status (2026-11-22): Round 0, for the user's decision.** Built on [desk-r0-audit.md](desk-r0-audit.md) (27 screens, D1–D151,
> M1–M14). The settings plan's Round 5 ([PLAN-settings-overhaul.md](../PLAN-settings-overhaul.md)) widened to the whole desk, at the
> user's request (2026-11-22: "a pass on the admin… the same treatment"). No visuals here: Impeccable draws the shapes after
> Perception-First Design sets their first views. D and M numbers are the audit's.

## The job

**Keep the site running without watching it.** The bot settles results, sign-ups and reports arrive, seasons start and end. The desk
is where the owner (one person, the site's only admin) sees the few things that need a person, does them in a tap or two, and sets
up what's next: a new show, a season's schedule and cast, a rulebook. Everything else is looking something up.

Three kinds of visit, in how often they happen:
1. **Check in** (most visits): "Is anything waiting on me?" The answer must be on the first view, and "nothing" must be a real,
   confident answer, not an empty list.
2. **Look something up** (known-item): a person who wrote in, a couch, a game by its join code, an episode's results.
3. **Set something up** (a few times a season): a show, a season's schedule, its cast, a rulebook, the bot's settings.

The owner is at a desk most of the time and on a phone sometimes (an episode night on the couch). Today the desk is a 390 px
column at every width (audit §8); every shape below uses a wide screen and still works at 390.

## The situations every shape is judged on

| # | Situation | What the owner needs first | Today |
| --- | --- | --- | --- |
| S1 | **A quiet week** | "Nothing needs you", and the week ahead (Coming up) | The Inbox's empty state, then This week's four counts in old words (D27–D30) |
| S2 | **An episode night with a split** | The episode the bot couldn't settle, its answers side by side, one decision | An Inbox row → the episode → a disputed row → a second Fact page in other words (D111, D123–127): four taps, two vocabularies |
| S3 | **A new show to set up** | Add it, then a checklist: rulebook → cast → schedule → games | New show only from the Library's sticky button (D148); the season's pages don't say what's left |
| S4 | **A sign-up wave** | Who's waiting, Approve each or all | An Inbox row → People filtered; fine, words aside (D17, Who gets in) |
| S5 | **The bot is down** | Say so before a run fails; what's waiting on it; Research now when it's back | Nothing until a Run now fails (M5) |
| S6 | **A finale, then final results** | Did the winner and the places land (BACKLOG 116); Settle again if a correction came late | Settle again is a script-like fetch (M1); nothing shows the season ended |

## What has to be housed (after the audit's cuts)

- **To do**: what the bot couldn't settle (one row per episode), sign-ups waiting, reports, couches nobody runs, a season with no
  schedule or cast, a rulebook to review, the bot down (new, M5), a catch-up held or stopped with its action (M2, M3).
- **Coming up**: this week's and next week's episodes across seasons (the desk's best display today, kept).
- **The lists** (one pattern each: search, filters, sort, in the address): People, Couches, Games, Shows, Reports, and the Library.
- **The things**: a person, couch, game, report, show (its sites and art), season (Setup, Research, Cast, Bingo, its episodes and
  cast members), rulebook.
- **Research bot** (new screen, below): automatic research everywhere, the default schedule, which AI, the second look, Settle again.
- **Site settings**, about three rows: Sign-up approval, Game previews, Change history; and **Tools**: Preview as a player (D3), the
  engine lab (M9), the scripts that stay scripts listed with what they do (M11, M12; read-only).

Cut (audit §4): the Gemini card (D45), "Leagues play by it" (D140), Settings' Library row (D47), "Its wiki" (D83), Coming up's "You
decide results" with Who decides results (D28, D96, after BACKLOG 168's data step), the Fact page (merged into the episode, D111).
Defaulted: Sources to confirm (2, D39), When answers disagree (on, D40), Who fills in on new couches (anyone, D41). Moved to a
script: the rulebooks flag (D46).

## Shape 1: today's tabs, widened (the least change)

**Navigation:** three tabs, renamed: **To do · Search · Site settings** (D5). Search keeps Browse's seven lists as its first view.
**At width:** each list sits beside the thing you opened (list-detail, two panes); a season's pages sit beside the season's rail
(Setup · Research · Cast · Bingo · Episodes); sheets open as a side panel, keeping the page in view. **At 390:** as today, renamed.

First level, in rank order:
1. **To do**: the waiting rows by urgency (a split, the bot down, a stopped catch-up first; sign-ups and reports after), then
   Coming up.
2. **Search**: the field, then the seven lists with their counts.
3. **Site settings**: Research bot (door), Sign-up approval, Game previews, Change history, Tools.

- **For:** nothing to relearn; the smallest build; every check (`check-desk-*.js`) keeps its routes.
- **Against:** the lists stay two taps deep (Search › a list); a season, the thing worked on most, has no home of its own; Site
  settings still mixes a page (Research bot) with switches.

## Shape 2: a rail of kinds (the conventional admin) — recommended

**Navigation:** at width, a left rail: **To do** (with its count) · **Coming up** · then the kinds: **Seasons · Shows · People ·
Couches · Games · Reports · Library** · then **Research bot** · **Site settings**. A search field above the rail searches
everything (today's Find, D10–D14), always one keystroke away. The rail's kind opens its list in the middle pane and the thing in
the right pane (list-detail-detail at ≥1280, list-detail at 760–1280). **At 390:** To do is home; a **Menu** button opens the rail as
a sheet; Search stays in the header.

First level, in rank order: To do (the urgent rows, then a confident "Nothing needs you"), Coming up beside it at width.

- **For:** the pattern the owner already knows from every hosted tool (Vercel, Neon, GitHub's settings); every list one tap from
  anywhere; **Seasons** becomes a list of its own (today a season is reached through its show, D49–D52); the Research bot is a
  peer of the kinds, not a row in Settings; scales to new kinds (sports leagues) by adding a rail row.
- **Against:** the most build (a layout the new design hasn't had: the shell caps every page at 390, new.css:15); ten rail rows is
  near the scanning limit (grouped in three, it holds); at 390 the rail is a sheet, one tap more than tabs for a list.

## Shape 3: season-centred (the desk opens on what's airing)

**Navigation:** home is **the seasons on air now**, a card each (Survivor 51: tonight's episode, what the bot settled, what's
waiting); a season opens as a workspace (Episodes · Research · Cast · Bingo · Setup · its games). Everything not about a season
(people, couches, reports, sign-ups, the library, site settings) lives under one **Site** door. To do is split: each season's waiting
items on its card, the site's in Site.

- **For:** matches where the work actually is (S2, S3, S6 all start from a season); the episode night is one tap.
- **Against:** a sign-up wave or a report (S4) is two doors away; "anything waiting on me?" has two answers to add up; seasons off air
  (a catch-up, an old season) need a second way in; the least like any tool the owner uses.

## Judged on the same situations

Taps from the desk's door to the first useful view (at width / at 390).

| | Shape 1 | Shape 2 | Shape 3 |
| --- | --- | --- | --- |
| S1 quiet week: "nothing needs you" | 0 / 0 | 0 / 0 | 0 / 0 (per card) + 1 for Site |
| S2 a split on episode night | 1 / 2 (To do row → the episode, decided there) | 1 / 2 | 1 / 1 |
| S3 a new show | 2 / 2 (Search › Shows › Add) | 1 / 2 (Shows › Add) | 2 / 2 (Site › Library › Add) |
| S4 a sign-up wave | 1 / 1 | 1 / 1 | 2 / 2 |
| S5 the bot down | 0 / 0 (To do's first row) | 0 / 0 | 0 / 0 on every card |
| S6 Settle again after a correction | 2 / 3 (Site settings › Research bot) | 1 / 2 (Research bot) | 2 / 2 (the season › Research) |

Shape 2 is never worst and is best or tied on five of six; Shape 3 wins the episode night by a tap on a phone and loses the site's
own work. Shape 1 is the fallback if the wide layout waits (BACKLOG 197's order).

## Shared by every shape

- **To do is one list by urgency**, not by kind (D15–D26): split results (one row an episode, D19), the bot down, a catch-up held or
  stopped (each with its action, D23–D25), then sign-ups, reports, a couch nobody runs, a season missing its schedule or cast, a
  rulebook to review. A row that leads nowhere is gone (D24–D26). "Nothing needs you" is a full sentence with when the bot last ran.
- **This week, re-made** (new display): what the bot settled this week, what changed after final results (BACKLOG 116's correction
  pushes), what's waiting; never the old counts' words (D27–D30).
- **The desk never spoils the owner's own watching** (the check, 2026-11-22): a result's names and outcomes are hidden on To do and
  on an episode the owner hasn't marked seen, with one tap to show them (today's Hide names on the episode page, made the default
  for an unseen episode and carried to To do's rows: "Episode 9 · one result is split · names hidden").
- **An episode decides a split in place**: its answers side by side (each source's line, the bot's two looks), Keep this · Use that
  · Correct it, with Undo. The Fact page is gone (D111, D123–127: one vocabulary, the episode's).
- **A season says what's left** (S3): a strip on the season — Rulebook ✓ · Cast ✓ · Schedule — · Games —, each a door.
- **A game's desk page** shows its settings read-only with **Open Manage this game as the site admin** (M4, choice 7) and Archive
  as its own row (M7).
- **Delete is last, named, one per thing**: on the thing's own page only (choice 3); sub-pages link back to it. The library's
  unguarded delete becomes a hold at the foot (D138, finding 9).
- **One way to save per kind of change** (audit §7's ten become four): a choice saves at once with Undo; a field edits in a side
  panel with Save; a change that reaches games previews, then confirms; a delete holds. The three hidden Undos get their toasts.
- **Words**: the names table below; "ChatGPT" only where the bot really asks ChatGPT (D-words, finding 4: the bot's own name is
  "the research bot", the AI named from `bot_ai_runs`).

## The Research bot page (new screen)

One page for the bot, replacing five homes (Settings › Autopilot, Which AI, When answers disagree; each season's Research for the
default):
1. **Status**: up or down, its last answer and when, the next scheduled run (M5).
2. **Seasons it researches**: each with on/off and its schedule (today's Autopilot list, D43, now editable here); a season's own
   Research page keeps its runs and its override.
3. **Default schedule** (Our usual, D44): when it asks after an episode, and the second look before final results.
4. **Which AI**: one choice, and per kind of run (results, cast, rulebook, bingo) where it differs (M6: `bot_ai_runs`).
5. **When answers disagree**: the tie-break, on (choice 1: kept as an emergency stop, defaulted on).
6. **Actions**, each behind a hold, saying what it reaches: **Settle again** (M1), **Release the catch-up hold** (M2), **Start a
   catch-up** / **Try again** (M3).

## Where each gap lands

| Gap | Home |
| --- | --- |
| M1 Settle again · M2 release the hold · M3 start / try again a catch-up | Research bot › Actions (and M2, M3 as To do rows when they're due) |
| M4 a game's settings | the game's desk page: read-only, Open Manage this game as the site admin |
| M5 the bot down | To do's first row; Research bot › Status |
| M6 which AI per run | Research bot › Which AI |
| M7 archive / bring back a game | the game's desk page, its own row (not inside Delete) |
| M8 rename a game; remove one person from one game | inside Manage this game (it has both since settings Round 3a) |
| M9 the engine lab | Site settings › Tools |
| M10 answer a report's sender | the report: Reply, sent as a notification (a new small backend; left for its round if the user wants it) |
| M11 game-specs flag · M12 orphaned catch-up lock · the rulebooks flag (D46) | stay scripts; Site settings › Tools lists them read-only with what each does |
| M13 the listings job now | left out: Setup's TV listing covers a season (unsure it's needed) |
| M14 What's New drafts | left out (paused by the user) |

## Drill levels: verdicts

| Level | Verdict | Why |
| --- | --- | --- |
| To do | **Restructure** | by urgency, one row per need, every row leads somewhere (D15–D26) |
| Coming up | **Keep** | the week as a rundown is the desk's best display |
| This week | **New display** | what the bot settled and what changed, not four old counts |
| Search | **Keep**, repaint | it works; the field moves to the header (Shape 2) |
| The seven lists | **Keep**, wide as list-detail | one pattern already |
| A person, couch, report | **Keep**, repaint | the frame works; words (Act as → Sign in as <name>, D-words) |
| A game | **Restructure** | its settings and Archive (M4, M7) |
| A show, its sites, art | **Keep** | Art's two "off" controls merge (D86) |
| A season | **Restructure** | the what's-left strip (S3); its pages as a rail at width |
| Setup | **Restructure** | Results leaves (D96); Episode length arrives (D102); Suggested games is its own section |
| Research (a season's) | **Restructure** | its runs and override stay; the site-wide parts go to the Research bot |
| Research bot | **New screen** | above |
| Cast, a cast member, Bingo | **Keep**, repaint | Override → Change (choice 8) |
| An episode | **Restructure** | decide a split in place, answers side by side (new display); old results words go (D110) |
| The Fact page | **Merge** into the episode | one decision, one place |
| A rulebook | **Keep**, repaint | the dead switch goes (D140); Delete to the foot (D138) |
| Library | **Keep** | New show moves to Shows (D148) |
| Site settings | **Restructure** | seven rows become three, plus Tools |

## Names (literal; settings-r0-names.md's desk table, extended)

| Today | Recommended |
| --- | --- |
| Admin (the header), the desk | **Site admin** |
| Inbox · Find · Settings | **To do · Search · Site settings** (Shape 1); Shape 2's rail as listed |
| Our bot · Autopilot · Run now / Ask our bot / Ask it now · Our usual | **Research bot · Automatic research · Research now · Default schedule** |
| Act as them · View as | **Sign in as <name>** · **Preview as a player** |
| Who gets in · Let in | **Sign-up approval** · **Approve** |
| Take it over · Its words · Running it · Made-for games | **Make official** · **Show terms** · **Manage season** · **Suggested games** |
| Override · Save override | **Change** · **Save** (choice 8), its line "wins over research" kept |
| Game admin (seats) · "sees nothing backstage" | **Helper** · "can't change the game's settings" (D57) |
| Hand it on | **Make someone else the owner** (a couch) / **the Commissioner** (a game) |
| castaway (on universal screens) | the show's own word (Show terms), "cast member" where there's none |

## Left out, and why

- **Roles for other admins, bans by IP, account creation**: one owner; desk-parity's decisions stand.
- **Backups, restores, migrations as buttons**: they need connection strings the site mustn't hold (audit §5).
- **A dashboard of site numbers** (sign-ups over time, active couches): nothing asks for it yet; This week covers the operator's
  question. Offered as an idea, not designed.
- **Card sorts and tree tests** (the skill's usual validation): one user, who reviews the story; the situations table stands in.

## Your choices (with recommendations)

1. **The shape: 1, 2 or 3?** Recommended **2** (the rail), with Shape 1's tabs as its phone form. Reason: the desk is used at a desk;
   every list one tap away; a season gets a home; the Research bot is a peer, not a row. Shape 1 if you'd rather not take on the
   wide layout now (BACKLOG 197).
2. **When answers disagree: default on and drop the switch, or keep it as an emergency stop?** Recommended: **keep it on the
   Research bot page, defaulted on** (the code's default flipped). An off switch is the one way to stop the bot's tie-break if it
   goes wrong on a finale.
3. **Who decides results' data step** (BACKLOG 168): move Survivor 51 off "You decide" before the control goes. Recommended: yes,
   after the finale (Dec 16), with a what-would-move run first; the control stays until then.
4. **A season's and a show's Delete: every sub-page, or only the thing's own page?** Recommended: **only its own page**, last and
   named; five copies of one season's Delete is five places to make a mistake. (This reads decision 4 as "every thing ends with its
   Delete", not every page.)
5. **The Fact page: merge into the episode?** Recommended: **merge** (one decision, the episode's words, answers side by side).
6. **Settle again and the catch-up actions as buttons?** Recommended: **yes, on the Research bot page, each behind a hold** that
   says what it reaches ("every game on Survivor 51").
7. **The rulebooks flag to a script?** Recommended: **yes**; its rollback stays in `scripts/rulebooks-flag.js`, listed under Tools.
8. **A game's settings on its desk page: open Manage this game as the site admin, or a desk page of its own?** Recommended:
   **open Manage this game** (one place to change a game; the desk shows a read-only summary).
9. **"Override" → "Change"** across the desk? Recommended: **yes**.
10. **Reply to a report's sender** (M10, a small backend): in this pass or later? Recommended: **later**; Mark done stays.
11. **A hybrid: Shape 2's rail, with the seasons on air as blocks beside To do** (raised by the check's Impeccable critique: Shape 3
    is a tap faster to a split on a phone). Recommended: **not now**. Coming up already lists the on-air seasons beside To do at
    width, and a split is To do's first row; revisit if episode nights on the phone feel slow.
12. **Where the one yellow goes on an urgent row** (the check's two skills disagree): **PFD**, a chyron line on the waiting row
    itself, so the state is seen before any word; **Impeccable**, a filled Decide button, as DESIGN.md keeps yellow for "what you
    must do". Recommended: **Impeccable's filled button** for the build (it's the system's own rule, and the row's position at the
    top already carries the urgency); the grey boxes show PFD's line.

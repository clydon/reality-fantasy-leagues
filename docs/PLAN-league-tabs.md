# League tabs: one tab bar for every game, Up next, and Team with Waivers

**Status:** designed with the user 2026-10-16/17, not started. Decisions below are the user's unless
marked *proposed*. Mockups (private artifacts, open with the Artifact tool's `read`):

- **Current design, built from real captures of conor's Survivor 51 group:**
  https://claude.ai/artifact/3axU3EyYYiY9uYWPAY8u6M (light/dark toggle, a waiver-settings panel,
  league swipe, Up next with its states, the control room, Team + Waivers)
- **Earlier fully drawn mockup** (castaway sheets with every event's points, both claim flows, a
  made-up Bingo league to test future game types): https://claude.ai/artifact/81WxeUJv59zCRHkS9XqeVr

Read [PLAN-waivers-v2.md](PLAN-waivers-v2.md) and [PLAN-linked-league-groups.md](PLAN-linked-league-groups.md)
first: this keeps the Waivers page and linked groups as they are and changes how you reach them.

## Why

1. **Each league type had a different tab bar.** Classic, Active Roster and Eliminator Pool shared
   Overview · Episodes · Scoreboard, then diverged: slot 4 was Draft, Lineup, Pick, Waivers or Chat by
   type and phase, Research existed only in Active Roster (a fifth tab), and Waivers was a tab in Classic
   but a More row in Active Roster. In a linked group, swiping from Research or Lineup to a game without
   one landed on no matching page.
2. **Players miss things they need to do, or don't know what to do** (user feedback: people forgot
   Pool picks). The alert pager shows one to-do at a time behind "1/3 Next": the second and third are
   invisible unless someone pages, nothing says which is due first, and when everything's done nothing
   says when to come back.
3. **Research is the hook.** The user's own habit, from fantasy football: "who's doing the best, who
   happens to own the best player, which castaway has stats that say high ceiling and I should pick
   up". Classic and Pool players had none of it ("Research is for Active Roster leagues").
4. **Waivers was just revamped** (v2) and shouldn't be wasted, but doesn't need its own tab.

## What each tab is for (the user's definitions; design against these)

| Tab | Job |
|---|---|
| **Overview** | At a glance: tell me what I need to know |
| **Episodes** | Each episode's summary and reveal, predictions, and where the commissioner records what happened |
| **Scoreboard** | Quick hits: which players and castaways are doing best, trends worth calling out, drill into another player |
| **Team / Lineup / Pick** | A to-do tab: get in, do the job, get out |
| **Research** | The deep dive, and the hook: every castaway, who's scoring, who owns them, who has upside |
| **More** | Things about the league (settings, how it works, the finished draft board) and about you. Nothing you play with |

## The tab bar

**Episode-night order, the same six in every game:**
**Overview · Episodes · Scoreboard · [slot 4] · Research · More**

| Slot 4 | Before the draft | During the draft | After the draft |
|---|---|---|---|
| Classic | Draft | Draft ("!" on your turn) | **Team** |
| Active Roster | Draft | Draft ("!") | **Lineup** |
| Eliminator Pool | Pick | Pick | Pick |

- Six fit at 390px (about 63px a slot; "Scoreboard" is 60px wide, the tightest). No label can get longer.
- Lineup and Pick keep today's slot 4, so Active Roster and Pool players' muscle memory survives.
- **Chat** stays on the header icon (linked games share one chat). Not a tab, not a More row.
- The desktop sidebar uses the same order and the same pages.
- The "one tab may differ" allowance is unspent, saved for a future game type (see the end).

### More (the sheet)

- **This league:** Draft board (roster games, after the draft), How this league works, Practice
  round, League Settings (keeps today's commissioner dot).
- **You:** Account, What's new, Report an issue, the tours, Demo season, Admin (admins), Log out.
- **Leaves More:** Waivers (Active Roster), Draft (becomes "Draft board" once done).

### Badges

- **Slot 4 "!"**: any of your moves due in this game (lineup slot open, pick not made, you're short and
  can replace). Driven by the same list as Up next, so they never disagree.
- **Episodes "!"**: the commissioner's results job, as today (the job lives on Episodes).
- Chat's unread count and League Settings' commissioner dot: unchanged.

## Linked groups: one name, a league strip, and the swipe

- **A group has one name**, shown big in Overview's header (the league name's place today) and small
  above every other page's title. It already exists: `league_groups.name` (migration 0047) with
  `groupDisplayName()` in `src/lib/server/league-groups.ts` falling back to show + season. The ▾ beside
  it still opens your other leagues and groups (today's league menu).
- **The league strip** sits under the header on every page of a linked game: one chip per game, by
  game type ("Classic", "Active Roster", "Pool"), the open one in the You fill (bone on Night, ink on
  Studio), a red dot on any other game that needs you. It replaces the league dropdown for switching
  between linked games. 40px tall chips.
- **Swiping stays** (user's call), alongside the strip: same tab, the neighbour's page slides in, never
  from the screen edges, not on a page pushed on top (Waivers). `src/components/league-swipe.tsx`;
  its `LEAGUE_PAGES` gains `/team`, and `/research` now exists in every game.
- An unlinked league shows no strip; its header shows the league's own name.
- Open question for the build: what the chip says when a group has two games of the same type (e.g.
  two Classics) — fall back to the league's own name.

## Up next (Overview), with the control room

Replaces the alert pager on Overview (and the old "Across Couch Crew" idea from the mockups).

**The plate** is the alert strip's caption plate, the same height (52px small plate):
- It shows **this game's** most urgent move (user's call), with its tag ("Replace", "Lineup", "Your
  pick") and time left ("3 hours left", or the deadline).
- Its right column is the pager's 48px column, but a **count** ("+3 / more") instead of "1/3 Next".
  Tapping it opens the rest **in place**: every other move in the group, soonest deadline first, one
  hairline row each (game · what to do · when). Rows from this game say "Here". Tapping a row switches
  game (if needed) and opens the tab the move lives on.
- A deadline under 24 hours is in chyron-line (the waiting-on-you colour), not red (red means someone
  went home).
- **This game has nothing:** a quiet plate, "Nothing to do in Pool" + "Next: picks for Episode 5 open
  after results" (the next thing this game will ask of you, and when). The count still shows the other
  games' moves.
- **Nothing anywhere:** "Nothing to do in Couch Crew" + the group's next deadline.

**The control room** sits above the plate when you're a commissioner with a job (results to fill in,
a draft to schedule, anything in `commissioner-items.ts` that blocks a league):
- One slim strip, 44px against the plate's 52: the **inverse fill** (`--quiet-tag`: ink on Studio,
  Night Panel Raised with a hairline on Night), a knocked-out "Commish" tag, the job in 16px condensed
  caps, the game in small text, a chevron. "+1" when there's more than one.
- Why: players see the white on-air plates; the commissioner gets the backstage slate. No new hue, so
  the one yellow stays the player's.
- Commissioner jobs never pad the player's "+N" count.

Data: `src/lib/game/action-items.js` already gathers to-dos across a linked group (the pager shows
other games' items today) and `commissioner-items.ts` the commissioner's. They need a sortable
deadline each and a `who: "you" | "commish"`. Component: `src/components/action-bar.tsx` (the alert
strip). The status plate (`overview/status-plate.tsx`) covers "nothing to do" today; see the light
touches.

## Team (Classic) and Lineup (Active Roster): Waivers off slot 4

The Waivers page (`src/components/waivers/`, route `/waivers`) **stays exactly as it is**: Your team
with Replace / Swap, the window, When moves happen, Past waivers, Commissioner tools. It's linked off
slot 4. Classic finally gets a team page; today its team is only a section of Overview.

**Page order, top to bottom:**

1. **A status banner** (caption plate, chyron tag), in the alert pager's slot on this page (the pager
   would only repeat it). Tapping it opens Waivers. What it says, from the league's waiver config
   (`WaiverLogic` in `state-logic.js`) and your team:

   | Situation | Banner |
   |---|---|
   | Short and can replace now (window open) | **WINDOW OPEN** · "You're short: replace Jenna and Patt" · "Swap 1 · due Sat 1:33 PM" |
   | Short, can replace some of them | "You're short: replace 1 of 3" · "Jenna, Patt or Rob · Swap 1 · due Tue 8:05 PM" |
   | Short and replacing without a window | **REPLACE** tag, same title |
   | Short, replacements wait for a window | quiet **WAITING** tag · "You're short" · "Replacements wait for the next waiver window" |
   | Not short, a window is open with swaps | **WINDOW OPEN** · "Swap 1 by Tue 8:05 PM" · "Optional: trade someone still in for someone free" |
   | Nothing to do, or waivers off | no banner |

2. **The team** (Classic: Overview's Your team plates; Active Roster: today's Lineup page, unchanged).

3. **Waivers** (section heading, with the league's feel as a small quiet tag, e.g. BALANCED), in this
   order (user's call):
   1. **The way in:** the secondary button carrying an index row's content: shuffle icon, "Waivers
      open" with the chyron-line waiting dot, and "Replace 2 · Swap 1 · due Sat 1:33 PM" in chyron-line
      while a window is open or you're short; otherwise plain "Waivers" · "Past waivers and how it
      works". Opens `/waivers` with "‹ Team" / "‹ Lineup" back.
   2. **When moves happen:** the existing `waivers/when-moves-happen.tsx`, reused.
   3. **"How it works here"** (small condensed caps label, like Episodes' "Your week"): the league's
      settings in plain words, **only the rows the league has on**:

   | Row | Says | Hidden when |
   |---|---|---|
   | Lose someone | "Replace them after the episode" (always) / "Replace them once you're down to N still in", with "You're at 2: replace 1" or "You have 3 still in" (whenShort, N = `replenishAt`) / "They wait for a waiver window" (windows) | replaceRule is `never` |
   | Swaps | "Swap 1 every 3 episodes" / "Swap 1 after any episode" / "Swap 1 when the commissioner opens a window" (up to N / any) | swaps = 0 |
   | Windows | "Every 3 episodes" / "After every episode" / "When the commissioner opens one" | shown only when replacements wait for windows and swaps = 0 |
   | Claims | "Due a day before the episode" (`deadlineWords`) + "Rolling order: you're 3rd in line" (exclusive) or "Everyone can claim the same castaway" (shared) | never |
   | Miss a claim | "We pick for you" (autoFill) / "You play short" | replaceRule is `never` |
   | After claims | "Free agency until airtime" | free agency off |

   Words come from `src/components/waivers/waivers-words.ts` so the page, the settings and the rules
   sheet never say a rule two ways.

**Waivers off** (`WaiverLogic.enabled()` false: no replacements and no swaps): no banner, no section;
Team is just your team.

**Commissioners** keep every action on the Waivers page (Commissioner tools), and reach it as today:
the alert pager / Up next when claims are due, and League Settings › Waivers.

## Research for every game

The Active Roster Research page (`src/components/research/research-tab.tsx`) for all three; remove
its "Research is for Active Roster leagues" guard.

- **Classic:** the same page: points over a window, owners on every row, Everyone / Free agents /
  Mine / a team. The bench pieces stay Active Roster's.
- **Eliminator Pool:** the same page, filters **Open to you · Used · Everyone** (from your past picks),
  and a **Safety** ranking (*to design in the build*: immunity wins, Tribals with no votes, votes
  survived) beside Points, since in a Pool survival matters more than points.
- **Upside markers** (from the earlier mockup, worth carrying over): "Idol in pocket" (found an idol,
  hasn't played it), "Knows of an advantage", "Went on a journey". Several of these events score 0
  today but are exactly the high-ceiling signals the user hunts for.

## Episodes: unchanged

Predictions stay on Episodes (user's call: you predict about an episode, not a team). Your week,
the commissioner's results job and the reveal stay as they are.

## Bottom sheets close with a swipe down

From the grab handle, or anywhere once the sheet is scrolled to its top: the sheet follows the finger,
past ~90px or a quick flick it closes, otherwise it springs back; the scrim fades with it.
`src/components/ui/bottom-sheet.tsx` and the More sheet in `mobile-nav/mobile-nav.tsx`.

## Light touches to existing pieces (decided 2026-10-17, built: "As built: step 7")

1. **The alert pager everywhere becomes Up next's plate: YES**, with the control room above it for
   commissioners. Two exceptions: Team / Lineup keep their own waiver banner (as designed), and Episodes keeps
   leading with this league's own results job (the design system already keeps it out of the strip there; don't
   add it back). Why: the pager hides items 2 and 3 behind paging, which is why people miss things; fixing only
   Overview leaves the problem everywhere else. It's the same component, so one change.
2. **The status plate merges into Up next's "nothing to do" state: YES, keeping its logic.** The rules in
   `lib/game/status-plate.ts` (draft time, who's on the clock, "4 of 5 claims in", when the next episode airs)
   are what the quiet state says: "Nothing to do in Pool · Next: …". The commissioner-blocking item is in the
   control room (step 4). One rule, one component, no information lost.
3. **Episodes' "The cast" link to Research, and removing /cast: NO.** Keep the link and the page. The Cast page
   answers "who's on which tribe and who owns them", which Research's ranked list doesn't show. If it comes up
   later, a "By tribe" view in Research is the place for it.
4. **Overview's Your team (Classic) gets "Team" as its one heading link: YES.** It had no link, so it stays
   within the one-link-per-section rule, and connects the quick look to the Team tab.
5. **Show art stays behind Overview's header, under the group name: YES, but check contrast.** The league strip
   now sits between the header and the first section, over the art. 7:1 for text over art, light and dark, or
   fade the art out before the strip.

## Future game types (Bingo, Trivia, a hub)

The user plans more game types and possibly a hub to start mini games, watch parties or live events.
Checked against this design (the earlier mockup has a made-up Bingo league):
- **Slot 4** is "your play", named for the game: Card (Bingo), Answers (Trivia).
- **Research** is the show's data: in Bingo, how often each square has happened (real Survivor 51
  counts in the mockup). Trivia is the weakest fit; that's where the one-tab allowance would go.
- **Episodes** is where a watch party or live event attaches (an episode page goes live while it airs).
- **The hub** lives above the tabs, as the linked group: Up next already spans it, and an "Add a game"
  entry is how a group would start Bingo, Trivia or a watch party.

## Build order

1. **The tab bar and More** (`mobile-nav/mobile-nav.tsx`, `sidebar.tsx`): six tabs in episode-night
   order with the slot-4 rule; More's new contents; Waivers out of the bar and More; badges from the
   to-do list. Research route for every type (lift the guard; Classic works as is, Pool's filters next).
2. **Team for Classic** (new `/team` route): banner, your team, Waivers section (way in, When moves
   happen, How it works here). **Lineup** gets the same banner and section around today's page.
3. **Linked groups:** group name in the header, the league strip, swipe kept (`LEAGUE_PAGES`), the ▾
   menu for other leagues.
4. **Up next and the control room** on Overview (`action-bar.tsx`, deadlines and `who` on to-dos).
5. **Bottom sheet swipe-down.**
6. **Pool Research** (Open / Used / Everyone, Safety).
7. The light touches the user approves.
8. Then: the guided tour's "Getting around" steps (`src/lib/tour/steps.ts` names tabs), "How this league
   works", DESIGN.md (tab bar, strip, Up next, control room, Team), the User Manual doc, and What's New
   (players only, significant changes, user approves every word).

## Testing

Mobile first: check every change at 390px, light and dark. Reuse `scripts/dev-test/`:
- `view-as.js` (a real league as one of its players, `--linked`, `--dark`, several `--path=`s; it now
  marks What's New read for the zt_ account so its sheet doesn't cover captures). The real S51 group:
  Last Survivor Standing `9270fe9b-…`, Weekly Start/Bench `d64a8b5d-…`, Avoid Elimination Streak
  `1146e487-…`, as `conor`. In Git Bash, prefix with `MSYS_NO_PATHCONV=1` or `--path=/` turns into a
  Windows path.
- `linked-fixture.js` (a throwaway linked group of all three types), `waivers-fixture.js` (a waiver
  week at any phase, with `--scenarios` for every v2 setting: use it to check each banner state and
  each settings row hiding).
- `browser.js` for an isolated headless Chromium.

## As built: step 3 (linked groups), 2026-10-17

- **`src/components/league-strip.tsx`**: `useLinkedGroup()` (from /api/me's league list, which already has each
  group's leagues together in the commissioner's order, so the header has the group on first paint; null for an
  unlinked league or a group you're in only one game of) and `LeagueStrip`. Chips by type ("Eliminator Pool" →
  "Pool"); **two games of one type go by their own league names** (the plan's open question). The open game is a
  You-fill pill (`bg-foreground`) with a second copy of the labels in the fill's ink clipped to it, so mid-swipe the
  pill sits between two chips and each label reads right on both sides of its edge. Red dot from the alert
  strip's `["my-actions"]` query (any item but an invite, so a commissioner's results job counts, as in the mockup).
  A tapped chip moves the pill at once, then opens the game with no loading screen.
- **Header** (`mobile-nav.tsx`): the group's name replaces the league's in both places (Overview's big title, the
  small line over every other page's title), ▾ still opens the league menu. Overview has a line under it: the
  game's type and the show + season ("Classic · Survivor 51"), with the show left out when the group's name already
  is it (the unnamed fallback); it rolls with a swipe (`SwipeTitle`, which now takes `text`/`textFor` and lost its
  dots: the strip says where you are). The strip sits inside the sticky header on every page about the league
  (`isLeaguePage`: the tabs and anything under them, Waivers included; not Chat, Account, Admin).
- **Desktop sidebar**: the plate names the group with the game's line under it; the strip sits under the plate
  (labels may wrap to two lines on the 264px rail).
- **The same tab in another game** is one rule now, `samePageIn()` in `league-tabs.ts`, used by the swipe and the
  strip (`useSwitchLinked()` in `league-swipe.tsx`): slot 4 → the other game's slot 4; Waivers → Waivers, or that
  game's slot 4 if it has none; `/draft*` → Overview in a game with no draft; `/scoreboard/<player>` →
  Scoreboard; `/setup/*` → League Settings; anything else stays (an episode is the same in every game). Always
  `router.replace`, so Back doesn't open the game you left.
- **Swipe**: no longer on `/waivers` (a page pushed on top), per the plan. `useSwipeProgress` carries `targetId`.
- Check: `node scripts/dev-test/check-league-strip.js <outDir> [390|1280] [--dark] [--name="Couch Crew"]`
  (linked-fixture.js, now importable and able to name its group). Verified 390 light/dark, named and unnamed, and
  1280: tap Team → Lineup → Pick, an episode stays put, Waivers → Pool lands on Pick, a real touch swipe captured
  mid-drag and landed. Note `linked-fixture.js down` deletes `zt_tester` (view-as.js's account): re-seed it after.

## As built: step 4 (Up next and the control room), 2026-10-17

- **Data** (`action-items.js`): every item now has `who` (`"you"`, or `"commish"` for the results job) and `deadline`
  (ISO: a lineup or pick locks at air time, a claim at its deadline, a guess before the episode airs; null otherwise).
  `byDue`/`dueAt` sort soonest first: draft turns, blind drafts, late-join starts and results are "now" and lead;
  no deadline goes last. `/api/me/actions` also returns `commish`: `commissioner-items.ts` for every league you run,
  kept out of `items` so the alert strip elsewhere, the strip's red dots and the reminder job are unchanged.
- **`src/components/overview/up-next.tsx`**, rendered by `action-bar.tsx` on Overview only (the pager stays on every
  other page, as the plan says, until the light touches). On Overview the pager keeps only invites, plus the
  notifications nudge once nothing at all needs you.
  - The control room: `bg-quiet-tag` with a hairline on Night, a knocked-out "Commish" tag, the job in 16px caps, the
    game's chip name. Jobs: this league's results and `commissionerItems` first, then every other league you run.
    **"+N" opens the other jobs in place** (the plan only said "+1"; a second job would otherwise be unreachable).
  - The plate: this game's most urgent move with "3 hours left" under a day, else "Locks Wed 8:05 PM" / "Due …" /
    "Airs …"; "+N / more" opens every other move, soonest first: "Here", the chip's name for a linked game, or the
    league's own name for **any other league you're in** (the plan said "the group"; leaving other leagues out would
    hide to-dos the old pager showed). A row in a linked game opens the way the strip does (`useSwitchLinked`).
  - Under-24h deadlines: chyron-line in the list; on the plate (white in both themes) a new token `--plate-line`
    (#845800 in both), since chyron-line is the yellow itself on Night.
  - **This game has nothing:** the existing status plate's own words, with the count added. Not reworded to "Nothing
    to do in Pool · Next: …": that's light touch 2, waiting on the user. When there's no status plate (season over,
    results waiting for the reveal) and other games need you: "All set · Nothing to do in Pool · Next: Active
    Roster · Locks …". Nothing anywhere: the status plate alone, as before.
- `status-plate.ts` lost its commissioner branch (the control room says it now) and `overview/status-plate.tsx` is gone.
- Check: `node scripts/dev-test/check-up-next.js <outDir> [390|1280] [--dark] [--member] [--clear] [--seen=N]`
  (linked-fixture.js plus a made-up season per game so episode 7 has a real air time). Verified 390 light and dark,
  1280, as commissioner and member, with to-dos and all clear: a row lands on Active Roster's Lineup, the control
  room on Pool's results. Unit: `tests/up-next-order.test.js`. (`tests/status-plate.test.js`'s "before the draft"
  fails on the clean tree too: its fixed date has gone by.)

## As built: step 5 (bottom sheets close with a swipe down), 2026-10-17

- **`src/components/ui/use-sheet-swipe.ts`**: one hook for both sheets. A touch that starts on the grab handle
  (`data-sheet-handle`) always drags; anywhere else it drags only if nothing between the finger and the sheet is
  scrolled down. The sheet follows the finger and the scrim fades with it; past 90px, or a flick (over 0.5px/ms and
  at least 24px), it slides the rest of the way and closes, otherwise it springs back. An upward turn hands back to
  scrolling.
- `bottom-sheet.tsx` (Base UI Dialog: the popup and the backdrop get the refs) and the More sheet in
  `mobile-nav.tsx` (which lost its own handlers, which had no scrim fade and no flick) use it. BottomSheet's handle
  is now a taller touch target at the same visual size.
- Check: `node scripts/dev-test/check-sheet-swipe.js <outDir> [390] [--dark] [--keep]` (real touch events with
  stamped times; More and the league menu: short pull springs back, long pull closes, flick closes, nothing left
  covering the page). Verified 390 light; the mid-drag capture shows the scrim fading. Not checked on a real
  phone (iOS Safari's rubber-band at the top of a scrolled sheet).

## As built: step 6 (Pool Research), 2026-10-17

- **Same page, Pool filters** (`research-tab.tsx`): an Eliminator Pool has no owners, so Whose is replaced by **Open to
  you · Used · Everyone**, read from `StateLogic.pickEmEligibility` for the next pick (`pickWindow(state).ep`): Open =
  `available`, Used = `blocked` (the cycle and no-back-to-back rules, the Pick page's words). Rows say "Open to you",
  "Used Ep 4" or "Last pick · Ep 6" in place of an owner. Starts on Open to you; not remembered. Someone with no player
  seat (or no pick to make) sees Everyone only.
- **Safety** (`research-rows.tsx`): `SAFETY_EVENTS` = individual immunity, zero votes (safe at Tribal), votes survived.
  Counted per episode (`EpisodeLine.safe`, `Row.safety`) **even where the league scores them 0**. It is the first entry
  in "Ranked by" for a Pool and the default there; hidden when the show's format has none of the three events
  (`hasSafety`). Column reads "Safe", bars show per-episode counts.
- Check: `node scripts/dev-test/check-pool-research.js <outDir> [390|1280] [--dark] [--keep]` (seeds a few events, walks
  the three filters and the ranking menu). Verified 390 light and dark. Not checked: 1280.

## As built: step 7 (the light touches), 2026-10-17

- **Up next on every page** (`action-bar.tsx`): the items are no longer computed per page; the pager is only what
  isn't a league's (an invite, and the notifications nudge once nothing at all needs you) and its old
  generic-item branch and `byWhen` are gone. Up next (the plate, its "+N more", the control room) renders on every
  page the strip does, including the Dashboard, except:
  - **Team / Lineup when the waiver banner leads** (`bannerHere`): nothing from the strip, as before.
  - **Episodes**: this league's own results job isn't in the control room (`onThisPage`'s `results` rule, now only
    for this league: another league's results job still shows, since it isn't on the page). Anything pointing at the
    page you're on is left out (your pick on /pick, League Settings' draft job on /setup/league), now for the
    control room too.
- **The quiet state is Overview's alone** (`quiet` prop). Elsewhere a game with nothing shows no plate, as the pager
  did, unless another game needs you ("Nothing to do in Pool · Next: Active Roster · Locks …" with the count). Not
  asked for: a quiet "Airs Wed 8 PM" on every page would be noise. Say so if you want it everywhere.
- **"Nothing to do in Pool · Next: …"** (`up-next.tsx`): tag "All set", title "Nothing to do in {game}", and under it
  the status plate's own tag, title and detail ("Next: Ep 7 · Airs Sun 7:40 PM · Tomorrow · the cast is down to 14",
  "Next: Draft · Not scheduled yet · The commissioner starts it", "Next: Waivers · Claims due Tue 8 PM · Your claim is
  in · 4 of 5 in"), up to two lines so no detail is dropped. Plates that say where things stand rather than what
  comes ("Lineup set", "You picked X", "Aired …", "Claims are on hold") drop the "Next:". Its "Order / Watch / Change"
  link stays. `status-plate.ts` is unchanged (it lost its commissioner branch in step 4); no separate status-plate
  component is left.
- **Your Team (Classic) on Overview** has a "Team" link on its heading (`YourTeamCard link`, `DashAside`); the Team
  page's own copy of the card has none.
- **Header art contrast** (`globals.css`, `league-strip.tsx`, `mobile-nav.tsx`). Measured with the new
  `check-header-art.js`: the strip's chips have their own opaque fill, so the art was never behind them, but their
  muted label (5.8:1) fell short, so closed chips now use the ink (15:1). Under the art, the group name was 6.2:1, the
  game's line 2.4:1 (muted grey can't reach 7:1 on a picture), the ▾ 2.1:1 and the chat icon 2.6:1 (Survivor's
  boosted look). Fixed by: the game's line and ▾ in the ink while the art shows, the chat icon on a soft ground disc,
  and a stronger wash on the name's side of the art (`--art-side`: .9 → .85 at 38% → .3 at 68% on Studio, .92 → .88
  → .3 on Night) rather than fading the art before the strip. Result at 390px light and dark, for Survivor, Big
  Brother, The Challenge, Love Island and Dancing with the Stars: every text 9.7:1 or better, every icon 5:1 or better.
- **`status-plate.test.js`'s "before the draft" is fixed**: it used a fixed date while `isDraftStarted` reads the real
  clock; it now runs on `Date.now()`.
- Checks: `node scripts/dev-test/check-up-next.js <outDir> [390|1280] [--dark] [--member] [--clear] [--pages]` (`--pages`
  walks every other page of each game and prints what Up next shows; also prints Your Team's heading link) and
  `node scripts/dev-test/check-header-art.js <outDir> [390] [--dark] [--show=<slug>]` (exits 2 under 7:1 for text, 3:1 for
  icons). Verified 390 light and dark, and 1280 for the pages walk; `npm test` 354/354, tsc clean. Not checked:
  an invite or the notifications nudge sitting above Up next on a non-Overview page (same pager code as before).

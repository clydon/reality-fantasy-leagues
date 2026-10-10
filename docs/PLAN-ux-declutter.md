# Plan: declutter pass (direction A2)

**Status:** decided 2026-10-10, not built. Branch `ux-direction-a` (local; don't push or merge until the
user says). This comes before the merge.

**Why:** next to the canvas mockups, the built app felt cluttered. The mockups showed the same
information in fewer, purposeful sections. Each Overview grew to 6–8 sections. Most sections end in their
own yellow arrow link, explainer sentences repeat, and the page's real job (draft, pickups) sat at the
bottom in Season Status. Pages also felt top-light without the alert plate, and the desktop sidebar and
mobile More menu spoke a different visual language from the plates.

**Mockups:** canvas https://claude.ai/artifact/DeXL8tptC8crqRx8UtkEa5, pages "A2 · Overview",
"A2 · Page opener", "A2 · Episodes, Scoreboard & more", "A2 · Desktop sidebar" and "A2 · More menu".
The chosen options are O1, D1 and M1. **Before:** `docs/ux-baseline/2026-10-10-declutter/` (390 and
1280, dark; no-alert, light, pre-draft and Pickups-round variants), captured with
`docs/ux-baseline/scripts/declutter.js` (read-only; `NOALERT=1` hides the alert strip, `MORE=1` opens
the More sheet).

## Decisions (all the user's, 2026-10-10)

1. **Overview section cuts and moves:** as in the table below.
2. **Default order per league type:** as below. **Reset the saved layouts on merge**
   (`app_settings` keys `overview_layout`, `overview_layout:classic-draft`, `overview_layout:active-roster`,
   `overview_layout:pickem`, locally and in production), and keep Admin → Overview layouts as the editor.
3. **No alert → a status plate (O1).**
4. **Commissioner to-dos:** the one item that blocks the league goes in the status plate. The rest
   become chyron dots on the League Settings rows that fix them. The Commissioner list leaves Overview.
5. **Castaways board after the draft:** a link, not a section (a Cast page linked from Episodes).
6. **Desktop sidebar: D1, the league plate rail.** Account settings, Appearance, What's new, Report an
   issue, Demo season and Log out live in **one expanding account menu** (a popover over the account
   row), not as links in the rail.
7. **Mobile More menu: M1, a league plate plus rows.** The theme picker moves to Account → Appearance.
8. **Mobile Overview header:** the league name left-aligned, **no logo**. New idea from the user: a
   **stylised, faded show background behind it, per league** (the show's key art). See "Header art" below.

## Rules for every page

- **One link per section, on its heading line** (the `DashCard`/`section-title` aside): "Full board",
  "Recap", "Change", "All picks". No arrow links under a section ("View full scoreboard →", "View board ↓",
  "Every episode on the Scoreboard →").
- **No explainer sentences on Overview.** How scoring works lives on Scoreboard ("How it scores", linking to
  `/setup/rules`) and in Scoring & rules.
- **An empty section renders nothing.** No empty-state call to action on Overview.
- **The alert strip skips an item that points at the page you're on** (a pick item on `/pick`, a lineup item
  on `/lineup`). `action-bar.tsx` already knows each item's href.
- **One yellow per screen** still holds. The status plate's tag is quiet, never chyron.

## Overview

The job: where you stand and what's happening this week, in broadcast order. The status plate (or the
alert) comes first, then three sections.

| Section (`overview-layout.ts` id) | Verdict | Detail |
|---|---|---|
| Alert strip | Keep | Plus the "skip the current page" rule above. |
| Commissioner list (`commissioner-card.tsx`) | Move | Blocking item goes to the status plate; the rest go to League Settings dots. "N invites pending" isn't a to-do; it's the Players & invites row's value ("4 players · 1 invite waiting"). `lib/game/commissioner-items.ts` stays as the source of truth. |
| Catch-up sentence (in `overview-dashboard.tsx`) | Move | Into the status plate, and Episodes already says it. |
| League Scoring (`leagueScoring`, Active Roster) | Cut | Already on Lineup ("What each event scores") and Scoring & rules. |
| Season Status (`seasonStatus`) | Cut | Its draft, blind-draft, Pickups and swap status becomes the status plate. "19 / 21 left" is on Episodes. |
| Castaways board (`board`) | Cut after the draft | Moves to a Cast page (below). **Before the draft** it stays, titled "The cast", with a "Scout" link (`/draft`). |
| Predictions (`sideBets`) | Collapse | Renders nothing when there's nothing open; an open prediction you haven't guessed shows as a row, and the alert carries it too. "Propose a prediction" moves to the upcoming episode's page (`episode-detail.tsx`), not Overview. |
| Standings (`standings`) | Keep | "Full board" on the heading line; cut the boot-order line; hidden before the draft (all zeros). Eliminator Pool rows gain this week's Picked / Not yet chip. |
| Your Team (`yourTeam`, Classic) | Keep | Unhidden by the layout reset. |
| Starting this week (`lineupGrid`, Active Roster) | Keep, first | "Change" on the heading line. |
| Last week (`lastWeek`, Active Roster) | Merge | Becomes the second plate under Latest Episode ("You · +8 last week · 3 more sat on your bench"). |
| Latest Episode (`latestEpisode`) | Keep, trim | Title "Episode N", "Recap" on the heading line, the Out plate(s). Active Roster's "League this week" table and its Scoreboard link are cut (Standings' +N column covers it). |
| Your pick & streak (`pickGrid`, Pool) | Keep, first | The streak, then Your picks ("All picks" on the heading line). "Episode N picks" merges into Standings. |
| Your Episode Line (`yourLine`) | Keep | Only when written (already conditional). |
| Notifications (`notifications`) | Keep | Unchanged. |
| Desktop "Overview" h2 | Cut | It's in the wrong typeface; the sidebar shows where you are. |

**Default order** (`DEFAULT_OVERVIEW_ORDER` becomes per type, or one order that reads right after the
eligibility filter):

- **Classic:** Standings, Your team, Latest episode, (Predictions), (Your line n/a).
- **Active Roster:** Starting this week, Latest episode (with your score), Standings, (Your line), (Predictions).
- **Eliminator Pool:** Your pick & streak, Standings (with the Picked chip), Latest episode, (Predictions).
- **Before the draft (Classic / Active Roster):** Draft order (players in pick order, joined or invited, with
  an "Invite" link for the commissioner), The cast. This replaces Standings, Latest Episode and the rest
  until the draft is done. "Draft order" is a new section.

`withNewSections` will append any new ids to saved layouts, but the reset in decision 2 makes the defaults
apply. Keep the Admin editor's label list in step with the removed ids (`leagueScoring`, `seasonStatus`, and
`lastWeek` once merged).

## The status plate (O1)

A caption plate in the alert strip's slot, the same size, shown **only when the alert strip has nothing to
show** for this league. Its tag is quiet (`--qt`-style: Night Panel Raised with bone; ink with white on
Studio), so it never adds yellow. One plate, chosen by the league's phase (the first that applies):

| Phase | Tag | Title | Detail | Action |
|---|---|---|---|---|
| Season over | (the existing `SeasonResultsCard` leads instead) | | | |
| Commissioner, blocking item (draft not scheduled, catch-up episode ready, Pickups due) | Commish | "Draft not scheduled" | "Pick a time, or start it yourself" | Schedule / Reveal / Start |
| Before the draft | Draft | "Sat, Oct 17 · 7 PM" (or "Not scheduled yet") | "In 2 days · you pick 3rd" | Order |
| Draft running, not your turn | Draft | "Sam is on the clock" | "Pick 5 of 12 · you're next" | Watch |
| Blind draft | Draft | "3 of 4 locked in" | "Picks reveal when everyone's in" | — |
| Pickups / swap round, not your turn | Pickups | "Sam's turn" | "Then you" | — |
| Catch-up, player | Ep 5 | "Up next" | "The commissioner reveals it when everyone's watched" | — |
| Pool, pick made | Ep 4 | "You picked Thien" | "Change it until it airs, Wed 8 PM" | Change |
| Active Roster, lineup set | Ep 4 | "Lineup set" | "Locks when it airs, Wed 8 PM" | Change |
| Weekly default | Ep 3 | "Airs Wed 8 PM" | "In 4 days · the cast is down to 19" | — |

Copy follows the show's terms (`useShowTerms`). It reads the trimmed (spoiler-safe) state, like the
commissioner list does. A commissioner's blocking item outranks the player lines; whether it uses a
chyron tag (it is "now" for them) is a judgement call at build time, keeping the one-yellow rule.

## Other pages

- **Episodes** (`episodes-tab.tsx`, `catch-up-panel.tsx`): in catch-up, the info block, the "up next" plate,
  the full-width yellow button and the help line become one muted sentence plus one plate (quiet "Ep 5" tag,
  "Up next", "Both players have picked") with Reveal as its chyron action. That plate stands in for the
  next episode's row (drop the duplicate row). The "19 of 21 castaways still in the game" line becomes a
  link, "The cast", to the Cast page.
- **Cast page** (new, `/cast`): the `CastBoard` / `BoardGrid` that leaves Overview, read-only for everyone,
  header "The cast" with a back button to Episodes. Not in the tab bar or the More menu.
- **Scoreboard** (`scoreboard-tab.tsx`): "After Episode 2" becomes the section heading, with "How it scores"
  beside it; the explainer at the bottom goes. Your season (Active Roster) stays.
- **Lineup** (`lineup-page.tsx`): unchanged, except a locked lineup with no starters says "No starters for
  Episode 3" instead of three dashed "Open slot" boxes that look tappable.
- **Pick**: unchanged.
- **Draft, once finished** (`draft-board.tsx`): drop the "Go to Overview" and "Episodes" buttons; the ⋯
  moves into the page header (mobile) instead of its own row above the plate.
- **League Settings** (`setup-tab.tsx`): `IndexRow`'s `dot` marks the row that fixes each commissioner
  item (League setup for "Draft not scheduled", Swaps & pickups for "Pickups are due", and so on). The
  Players & invites value carries pending invites.

## Desktop sidebar (D1) — `src/components/sidebar.tsx`

- **Top:** the league switcher as a caption plate: a quiet tag with the season ("S51"), a white plate with
  the league name (wrapping to two lines) and "Survivor · Classic", an up/down chevron. It opens the
  existing `LeagueSwitcher`. **No logo** (`BrandLogo kind="sidebar"` goes from here).
- **Nav:** 44px rows with the tab bar's icons and a 15px label. Active: Night Panel Raised fill, an inset
  3px chyron-line bar on the left, bone text, chyron-line icon. Badges: chat's count as a quiet chip; the
  "needs you" badges (Lineup, Pick, Mid-Season) as the tab bar's.
- **Bottom:** an Admin row (shield icon; a chyron-line dot while Admin's To do has anything) for super-admins,
  then the **account row**: a 36px initial square, the username, "Account, help, log out", and ⋯. Tapping it
  **expands a menu** above it: Account settings, Appearance (current value; the theme picker lives here, in
  the menu), What's new (with "2 new"), Report an issue, Demo season, a divider, Log out in red. Signed out:
  the menu has Sign in and Appearance.
- The six chyron-line footer links go.

## Mobile More menu (M1) — `mobile-nav.tsx`

A bottom sheet as now, regrouped:

1. **League plate:** quiet tag with the season, the league name, "Survivor 51 · Classic · 4 players",
   "Switch" (opens the league switcher).
2. **This league:** the displaced pages as rows with their current value on the right (Draft "Done",
   Mid-Season with its badge, Research for Active Roster, League Settings with a chyron dot when a
   commissioner item is waiting).
3. **You:** Account ("Appearance, notifications"), What's new ("2 new"), Report an issue, Demo season.
4. **Admin** (super-admins), then **Log out** last in red.

The theme picker row leaves the sheet; it's in Account → Appearance (already there for signed-in users).

## Mobile header and header art (decision 8)

- Overview's header: the league name left-aligned in 26px condensed caps with the switcher chevron, chat on
  the right, **no logo** (the mockups' header). Other pages keep the small league name over the page title.
- **New, not yet mocked:** a stylised, faded show background behind the header, per league: the show's key
  art (`shows.art_url`, already served by `/api/shows` and used by the create-league show tiles) under a
  heavy fade into the ground colour, so it reads as a texture behind the name, never as a picture competing
  with the plates. A show without art gets the plain ground. It must work in both modes (a Night fade and a
  Studio fade) and keep the name at 4.5:1. **Mock it on the canvas before building** (an "A2 · Header art"
  page, Night and Studio, with and without art). HANDOFF's caution applies: rights to network key art are
  unconfirmed, so check before it ships.

## Build order

1. Overview: cuts, merges and the per-type default order; reset the saved layouts locally.
2. The status plate and the commissioner items' move (Overview plate, League Settings dots, Players value).
3. Cast page, and the Episodes catch-up compaction plus the cast link.
4. Scoreboard heading, Draft (done) trim, Lineup's locked-empty state, alert strip skipping the current page.
5. Desktop sidebar (D1) with the account menu.
6. More sheet (M1).
7. Header: left-aligned, no logo. Header art only after it's mocked and approved.

Verify each at 390×844 dark first, then 1280 dark and 390 light, with `declutter.js` (and the existing
scripts) on `UX Baseline S51` (Classic), `UX AR S51` (Active Roster), `UX D Pre` (before the draft),
`UX D Done` (Pickups round) and a throwaway Eliminator Pool league (`POOL=1 create-flow.js`, deleted after).
Compare against `docs/ux-baseline/2026-10-10-declutter/`. Update DESIGN.md (status plate, sidebar, More
sheet, the one-link-per-section rule) when done.

## Not in scope

The User Manual & Product Guide doc isn't auto-updated. A What's New entry for the player-facing changes
(cleaner Overview, the Cast page) goes with the merge's entry, which the user approves.

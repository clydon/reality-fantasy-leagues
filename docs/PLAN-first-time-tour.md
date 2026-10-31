# Plan: the first-time tour (the new design)

**Status:** built 2026-10-31 on branch `tour` (lane `rfl-tour`, port 3007); not merged (migration 0158). As built at the end.

Shaped with the user on 2026-10-31 through `/impeccable shape`, after everyone was moved onto the new design (0155). The
classic tours (PLAN-guided-tour.md, PLAN-commissioner-tour.md) are classic's and play no part here. The clickable mock the user
approved is a private page, https://claude.ai/artifact/KrgXF9AkNvpFeUv1Xn9qVf (source `.impeccable/mocks/tour/` in the main
folder, gitignored): its Look A, "in place", is the one built.

## What the user asked for

The quickest, most useful tour for a player's first time on Home: skippable, a step count (X/Y), few steps, almost no words,
the real thing lit where it fits, pictures and example UI rather than paragraphs. **The simpler and shorter the better: people
drop long tours.** The couch first (your people; adding any show you watch, not just games; your couch seeing yours and you
adding theirs), then the game. Niche game flows never (waivers: "definitely shouldn't be on the tour"); Start a game left out
(the Start-a-game GPT work will change it); Watch along and ratings get no effort. After the mock: slower examples (a beat
before each starts and before each simulated tap), and navigation that looks authentic (the page scrolls slowly from the top, as
a person would scroll it). Then: a step for Couch points ("engagement scoring") and one for opening a show to see its cast and
stats.

## The steps (9; 8 when this phone already gets reminders)

| # | Title | Line | Lit on Home |
|---|---|---|---|
| 1 | Your couch | Your people, and what everyone's watching this week. | the guide |
| 2 | Add any show | Game or not. No spoilers past your episode. | Add a show (the shelf scrolls to it) |
| 3 | See what they watch | They see yours too. Add theirs in a tap. | The couch is watching |
| 4 | Bring people in | Your couch lives up here. Invite friends anytime. | your picture (the profile: your couches, invites) |
| 5 | Yellow means your move | Some shows are games. Moves lock when the episode airs. | Up next's move plate, else the status line |
| 6 | Results wait for you | Tap Reveal when you've watched. Chat waits too. | Up next's Reveal plate, else the status line's reveal |
| 7 | Inside each show | Tap one for its cast, stats and standings. | your first show's card |
| 8 | Couch points | Play, watch and chat to climb the power rankings. | the Power rankings row |
| 9 | Never miss a move | We'll remind you before your moves lock. | nothing (Turn on · Not now) |

Three acts: the couch (1-4), games (5-7), coming back (8-9). Each step has one line and a short example that plays in the
lower third: made-up content, never a real result (a spoiler for anyone behind): the games' examples use an illustrated,
made-up baking show, **Golden Crust** (its bakers are `public/photos/tour/`, the illustrations the user supplied for classic).
Real show names appear only where nothing is revealed (the guide, Add a show, what the couch watches).

**Solo players** (no couch) get the same tour with the couch pitched: 1 "A couch is your people. See what they watch." (lit:
Watching solo), 3 "On a couch, add what friends watch in a tap." (nothing lit), 4 "Start a couch, or join one with a code."
(lit: Start a couch). No Couch points step (there's no couch to count on).

**A step whose target isn't on this Home** (nothing to reveal, nobody watching anything you don't) keeps its words and
example and lights nothing.

## How it behaves

- **When:** the first time an account opens Home in the new design, once Home's in (never over a deep link into a show, a
  pushed page or a sheet). Per account, not per device (an iPhone's Home Screen app is a device of its own), in
  `user_settings.tour_seen_at` / `tour_reached` (migration 0158). Skip counts as seen, and so does leaving Home mid-tour (the
  phone's back, a notification opened: kept at the step it was on). Not while an admin acts as someone or
  views as a player (it would mark their account; 0048 was the same bug for What's New), and the write is refused then.
- **Replay:** Settings › Help and account › Take the tour (back to Home, which plays it), or `/home?tour=1`.
- **The lower third** (Lower Third, DESIGN.md): a "Skip tour" pill, the example in a box over the shoulder, and the caption
  plate (the count on a quiet tag, the title, the line, Next). Tap anywhere for the next step. Next is the bone ink button,
  never yellow: the tour teaches that yellow is your move. Step 9's Turn on is ink too, as the app's own reminder ask.
- **Navigation that looks real:** the light goes off, the whole Home shows while the page scrolls (ease in and out, 0.9-2 s by
  distance; a shelf scrolls sideways to its card), and the spotlight comes on once the target has arrived; targets on the same
  screen glide. The tour sits a beat on the top of Home before its first move, and goes back to the top when it ends. The
  step's words change as the move starts; its example waits for the light, then a beat before it moves and a beat before
  each simulated tap.
- **Reminders:** step 9 is there only while this phone could start getting them (off, or an iPhone outside the Home Screen
  app, where it shows the three Add to Home Screen pictures). Turn on is the reminder ask's own (remind.tsx), and the tour
  counts as this phone's ask, so the sheet after a first save doesn't ask again.
- **Reduced motion:** no scrolling glide or spotlight glide, and each example shows its teaching picture still.

## Checks

`scripts/dev-test/check-new-tour.js` (new-fixture.js's couch, plus a solo zt account of its own): plays it at 390, each step's
count, words and lit target; Skip and finish write it once; it doesn't come back; Settings' replay and `?tour=1`; acting as
someone neither starts nor writes it; reduced motion; Night and Studio; no overflow or console errors. `tests/tour-steps.test.js`
for the step list (couch, solo, reminders on and off).

## Out of scope, on purpose

Start a game, waivers and other niche game flows, Watch along, ratings, the ⋯ menu, Backstage, the commissioner's jobs.

## As built (2026-10-31, branch `tour`)

- **Code:** `src/new/tour/`: `steps.ts` (the pure step list), `scenes.tsx` (the nine examples, beat-timed by `useBeats`, each
  root carrying `data-beat`), `tour.tsx` (when it plays; the overlay; moving between steps), `store.ts` (Settings' ask, kept in
  the page and this tab's sessionStorage: Back to Home can be a full load). Home mounts it inside `Loaded` and it waits for
  `useShown()` (Home on screen with its reads in), no sheet or pushed page open, and this phone's state known.
- **Data:** migration 0158; `POST /api/me/tour` `{ reached }` keeps the first time it was seen and the furthest step (refused
  while an admin acts as someone: `kept: false`); the home read's `user.tourSeen`; `useTourSeen` (data.ts) marks Home's cache at
  once and posts with `keepalive`, so leaving or reloading straight after doesn't lose it.
- **What it lights:** `data-tour="you"` (the profile button, bars.tsx), `data-upnext-plate` (Up next's plate, by kind),
  `data-tour="rankings"` (the grow note's Couch points line); the rest were there (`data-guide`, `data-add-show-poster`,
  `data-couch-watching`, `data-status`, `data-poster`, `data-more`, `data-solo-invite`, `data-solo-start-couch`).
- **While it's up:** the column (`.nd`) is inert, wheel and touch don't scroll it, and Home gets room at its foot so its last
  rows can scroll clear of the lower third (given back once the tour has scrolled to the top at the end); a shelf scrolls
  sideways to its card; a ResizeObserver keeps the ring on its target if Home's layout moves.
- **Reminders:** `remind.tsx markAsked`: the tour's ask counts as this phone's, so the sheet after a first save doesn't ask again.
- **Changed from the mock:** Turn on is ink (the reminder sheet's), not yellow; the examples with a result, a stat or a pick
  are Golden Crust instead of Survivor 51's real cast (a spoiler for anyone behind); "Inside each show" and "Couch points" were
  added after the mock (the user); the Home behind is the player's own; the example's box is the ground, not the panel (the
  examples' cards are the panel, and would vanish on it); the spotlight's corners are 4px (the broadcast shapes'), not 6.
- **The /impeccable finish review (a fresh reviewer, 2026-10-31; disposition fix) and what changed for it:** the tour focuses
  itself once, not Next each step (a programmatic focus drew the yellow focus ring on Next: the tour spends no yellow);
  finishing scrolls to the top in at most 0.9 s with its clear layer still taking taps, then hands Home back (no tap on a
  moving page); the examples' tables say "You", never your username, and Couch points' ends "Up a place" (not a lead claim
  beside your real place); "Yellow means your move" lights only a real move (Up next's move plate, or the status line when it
  says moves are due), else nothing; its example drops the tab bar (a second yellow); the reminders' example opens with the
  first nudge there; Skip tour is 44px. Left as approved: step 2's "Game or not." (the reviewer suggested "Whatever you watch,
  game or not."; the user's to say).
- **Pictures:** `public/tour/` (80 KB): the three show pictures are the site mock's, four bakers copied from classic's tour.
- **Leaving mid-tour** (Home unmounts with the tour up: the phone's back, a notification) keeps it as a skip at that step, a
  tick after the unmount so React's own remount in development doesn't count. A full unload (the app closed) keeps nothing:
  it plays again next time.
- **Checks:** `check-new-tour.js` (A–I, including "what's lit is clear of the lower third" and leaving mid-tour),
  `tests/tour-steps.test.js` (5); `npm test` 1227 of 1228 (BACKLOG 37's known failure). BACKLOG 38 has what it left.

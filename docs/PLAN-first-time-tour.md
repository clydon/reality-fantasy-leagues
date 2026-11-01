# Plan: the first-time tour (the new design)

## Version 2: welcome first, with practice runs (built 2026-11-01 on branch `tour2`, lane `rfl-tour2`; not merged)

**Status:** built and checked on the lane (`check-new-tour.js` 108 PASS, twice; `npm test` 1237 of 1238, the one failing on master
too); waiting on the user's OK to merge and push, and on the practice shows' data in production (below). No migration.

**Why:** the night after version 1 went live the user found it too passive, turned down a version where players tap pretend examples
("act something out with no payoff... nope"), tried one where each tap opened the real thing, and then asked for something plainer:
"welcome to the app, here are the concepts you need to understand, here's the homepage, here's how you add a show... want to create a
game, here you go, explore". The mock of that (artifact Version 6) left them unsure what to do on its screens (they were pictures), so
they set the real version's rules (2026-11-01):

- **As 1:1 with the real path as possible.** The practice runs open the real sheets and screens, every tap working, with nothing saved.
- **Add a show:** they're directed to add a real show, the first of **Survivor, The Amazing Race, The Challenge** they don't follow.
  The tour types its name into the search for them; they tap it, say where they are, and add it. **It won't show up**, and they're told
  so. **The shows the tour adds already have their rules (and cast) in our database**, so nothing waits on the bot; the tour shows a
  quick, simulated "getting the rules" load instead.
- **Then:** "you don't have to add a show just for the games, tell your couch what you're planning to watch!", and the tour adds
  **HBO's Harry Potter and an NFL game coming up** by itself, then **shows the TV guide**, with their shows (when they share) in it.
- **Reveal:** the Reveal button replays the last reveal of a show they watch (forward only: the server answers an episode already
  revealed as it is now, and writes nothing); someone new gets a made-up reveal.
- **Start a game:** the Prediction Sheet (the easiest right now), on the show they just practice-added, saved nowhere. Plus a
  **"Coming soon: create a game with AI"**, in the tour and in the real Start a game sheet, for everyone.
- **Join a game:** dropped.
- **Remind them** that the show and the game they add in the tour won't show up: it's a demonstration.

### The steps (7; the last asks about reminders only while this phone could get them)

| # | Step | What's lit | Its button (a tap on what's lit does the same) |
|---|---|---|---|
| 1 | **Welcome** card: the wordmark, "Watch with your people. Make any show a game.", the three ideas with pictures of your own (your couch's faces, your shows' art; the tour's own art when there are none) | (a card over Home) | Show me around |
| 2 | **Your Home:** "What needs you is always up top." | the status line and Up next, together | Next |
| 3 | **Add a show:** "Let's add Survivor. Practice: it won't show up." | the Add a show tile | Try it: Add a show, practice, then its demo |
| 4 | **Your couch sees it:** "Shows you add land in the couch's TV guide, when you share what you watch." | the guide, held on today | Next |
| 5 | **Results wait for you:** "Nothing shows until you tap Reveal. Try it: this replays your last one." | Up next's Reveal (else Up next) | Watch a reveal: the replay, or a made-up one |
| 6 | **Start a game:** "Make a Prediction Sheet for Survivor. Practice again: it won't show up." | Home's Start a game | Try it: Start a game, practice |
| 7 | **You're set:** "Want a nudge before your picks lock?" | nothing | Turn on reminders, Explore |

Solo (no couch): step 6 pitches a couch (Start a couch lit, no practice: a game needs a couch); step 4's line says on a couch your
people see them too. No practice show (none of the three, or all on your list): the add says "Add any show you watch", and its
practice opens Add a show with nothing typed. Next (or a tap anywhere but what's lit) moves on without doing a step's practice. Skip
on every step. Back on Home after a practice run, the step ticks (its count turns green, under reduced motion too) and the next one
comes on.

### How the practice runs work

- `openWatching({ kind: "add", practice })` and `openStartGame({ ..., practice })` take a practice: the show to use, and an `onClose`
  the tour waits on. A practice sheet shows a "Practice: nothing you do here is saved" strip at its top, and **never calls a write**:
  Add a show's three (follow, add from a listing, add by name) and Start a game's start each end in a practice finish instead
  (tour/practice.tsx), which says it again, with Done.
- **Add a show (practice):** the sheet opens, the tour types the name, the result is ringed; Where are you? and Add to my shows are the
  real ones. Its finish: "Survivor 51 won't show up on your list: this was just to show you how." and "You don't need a game to add a
  show. Tell your couch what you're watching!", with **Show me**: the demo (watching/sheets.tsx runDemo) types each of its shows in,
  rings its row, taps it, and presses the real Add to my shows, Where are you on the way (still saving nothing): **HBO's Harry Potter**
  (TVmaze 68803) and **whichever of Sunday, Monday or Thursday Night Football is on next**, from September to February (tour/plan.ts
  demoOf), each passed over when you have it already, found by its listing's id. Its finish: "Harry Potter and NBC Sunday Night
  Football won't show up either: just practice." and "Shows you add land on your Home, and in your couch's TV guide when you share what
  you watch."
- **Your couch sees it:** the demo's shows go on Home for that step only (tour/practice-shows.ts: read from their listings, the `next`
  episode included; only Your shows and the guide merge them in, nothing saves them, the tour clears them as it moves on), so the guide
  shows tonight's game on its day and both sit on Your shows; the guide is held on today (an `nd-guide-hold` event on its reel stops its
  roll; let go after).
- **Start a game (practice):** Pick the show lists the practice show first ("The one you just added: practice"); picking it plays the
  simulated rules load (1.3 s, "Getting Survivor 51's rules...", under reduced motion too: a pause, not a movement), then the real
  options with the Prediction Sheet chosen and its questions; Start it ends in the practice finish, with Create a game with AI (coming
  soon), which also sits under the games in the real sheet for everyone.
- **The reveal (practice):** a replay over Home of the last episode they revealed on a show they play (POST `.../reveal` with `replay:
  true`: the beats, no marks moved, no early-night row touched; refused for an episode not yet revealed), without Share your night or
  Reveal Episode N+1 (both would be real): Back to the tour. Nothing to replay (or a replay refused): a made-up episode (Golden Crust,
  the tour's made-up show), no server call.
- While a practice sheet or the replay is up, the tour is out of the way (invisible, Home not inert); it comes back when it closes.

### The practice shows' data (a production step, with the user)

Each of Survivor, The Amazing Race and The Challenge needs its current season in the database **ready as a game** (rulebook, cast,
episodes), before the tour picks it. The local copy (2026-10-16) has Survivor 51 ready, The Amazing Race's show with no seasons (its
rulebook is in the library: `the-amazing-race.rulebook.json`), and The Challenge's season 37 only. The tour only offers a show whose
current season is ready (from the catalog): the couch all play Survivor 51, so for them it's The Amazing Race or The Challenge, which
need their current seasons set up in production through the app (the desk, or Make it a game ahead of time), with the user. Until then
the couch's tour adds "any show you watch" (nothing typed) and Start a game's practice uses a show of theirs.

Production's catalog on 2026-11-01 (read through the user's signed-in Chrome, nothing changed): Survivor 51 only. The Amazing Race's
show is set up, curated and linked to its listing (TVmaze 18) with no season (as in the local copy), and a season of a set-up show is
ready as soon as it's there (the catalog's `ready` is the show's `set_up_at`), so **adding The Amazing Race 39** (on now, Sep 29 to
Dec 9) is the whole step: Add a show from any account makes its season row (and follows it for that account, which can let it go
after). The Challenge 42 ended 2026-10-28, so it's no practice show until its next season.

### As built

- `src/new/tour/`: `steps.ts` (the seven, from `{ solo, reminders, show, replay }`), `plan.ts` (the practice show, the reveal to replay,
  the demo's shows, the made-up reveal), `tour.tsx` (the host and the run: the welcome card, the lights, the practice runs, the demo's
  shows on Home, the guide held), `welcome.tsx` (the card), `practice.tsx` (the strip, the finish, its note), `practice-shows.ts` (the
  demo's shows on Home for a step). `scenes.tsx` (version 1's examples) is gone, and its CSS but the words' rise; `nd-tour-pulse` is new
  (the pulse out of the ring round a step that can be tried).
- `watching/sheets.tsx` and `search.tsx` (Add a show's practice, its demo, the ringed row), `couch/start-game.tsx` (Start a game's
  practice, the rules' moment, Create a game with AI), `show/reveal.tsx` (the reveal's beats shared by the show's reveal and the tour's,
  `TourReveal`), `data.ts` (`revealEpisode(..., { replay })`), the reveal route and `season-episodes.ts revealSeason` (`replay`),
  `server/listings.ts` (`ListingSeason.next`: the next episode to air), `hub/guide.tsx` (the demo's shows; the hold), `hub/sections.tsx`
  (Your shows: the demo's shows).
- Checks: `scripts/dev-test/check-new-tour.js` (rewritten: phases A to J, 108 PASS at 390), `tests/tour-steps.test.js` (15).

## Version 1 (live since 2026-10-31)

**Status:** built 2026-10-31 on branch `tour` (lane `rfl-tour`, port 3007); merged to master and pushed the same day with the
user's go-ahead (migration 0158, pushed without the Neon rehearsal at the user's word, it being two empty columns; the snapshot to
roll back to is the Neon branch `pre-tour-2026-10-31`, auto-deleted after 7 days). As built at the end.

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
- **Every other check gets Home without it:** `scripts/dev-test/browser.js` sets a `gys_tour=off` cookie unless a check asks for
  the tour with `tour: true` (check-new-tour.js does), and the home read counts that cookie as seen. Otherwise every check
  that opens Home as a fresh zt account would find the tour over it.
- **Leaving mid-tour** (Home unmounts with the tour up: the phone's back, a notification) keeps it as a skip at that step, a
  tick after the unmount so React's own remount in development doesn't count. A full unload (the app closed) keeps nothing:
  it plays again next time.
- **Checks:** `check-new-tour.js` (A–I, including "what's lit is clear of the lower third" and leaving mid-tour),
  `tests/tour-steps.test.js` (5); `npm test` 1227 of 1228 (BACKLOG 37's known failure). BACKLOG 38 has what it left.

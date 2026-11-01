# Plan: the first-time tour (the new design)

## Version 3: down Home, then hands on (built 2026-11-01 on branch `tour3`, lane `rfl-tour3`)

**Why** (the user, trying version 2 on their phone, 2026-11-01):
- "The try it button does what we want the user to do. So instead the try it should shake the action they must do."
- "The long start a game sheet is hard to tell you must scroll to the bottom to proceed."
- After the top section, go down Home's sections (Your shows, This week on the couch, On the couch, More on the couch). Then back
  to the top: tap it and it takes you to the moves you need to make. Then Add a show, with its skip "not in the finger spot that
  continues". Then the shows' card flip ("user might not know the card flip button"), then the TV guide and its filters, with a
  Sports filter that says it's coming.
- Their picks (AskUserQuestion): **overview, then hands-on** (Down Home is one step with a beat per section, not four), and your
  moves go to **the real page, then back**.

**The steps** (10 when every part is there; steps.ts, numbered by `numbered`):

| # | Step | What's lit | The real thing to tap (the plate's Try it only shakes it) |
|---|---|---|---|
| 1 | **Welcome** card | (a card over Home) | Show me around |
| 2 | **Your Home:** "What needs you is always up top." | the status line and Up next | (Next) |
| 3 | **Down Home**, a beat each, a dot each under "3/10": Your shows · This week on the couch · On the couch · More on the couch | each section in turn (one this Home hasn't got is left out; solo: in the page's order) | (Next from beat to beat) |
| 4 | **Your moves:** "Tap the top line: it takes you straight to what needs you." | the status line | the line itself: its own page for real, a **"4/10 Back to the tour"** pill under the header there (tour/back.tsx), Back to Home, the step ticks and the tour carries on (not a skip). Nothing due: "When something needs you, it shows up here." and Next |
| 5 | **Add a show** (practice, as version 2) | the Add a show tile | the tile; "Skip adding a show" |
| 6 | **Flip a show:** "Tap a show's corner to see your games on it." | a show of yours that has the corner | the show: it turns over to your games, 2.6 s, and back. Only when a show has your games |
| 7 | **The TV guide:** "Shows you add land here, for your couch too. Filter it below." | the guide (the demo's shows still in it) | its filters, for real through the tour (`play`); **Sports** says "Sports are coming soon." (in the guide for everyone) |
| 8 | **Results wait for you** (the replay, as version 2) | Up next's Reveal | Reveal; "Skip the reveal" |
| 9 | **Start a game** (practice, as version 2) | Home's Start a game | the button; "Skip starting a game" |
| 10 | **You're set** | nothing | Turn on reminders, Explore |

**How it behaves:**
- **On a step with something to do**, the plate says **Try it** with an up arrow where Next is on the others. It, or a tap anywhere
  off what's lit, **shakes the thing to tap** (Web Animations; under reduced motion only the ring blinks). Only a tap on what's
  lit does it, so a thumb's habit never does it by accident and the tour never does it for them.
- **The skip pill** sits up top left by Skip tour, in its step's words. During a tick nothing moves on or starts again.
- **Start a game's Start it** lives in the sheet's foot (ui/sheet.tsx `foot`), so it's in sight however long the options run. This
  holds in the real sheet for everyone.
- **One path through each practice** (the user, 2026-11-01: "don't let the user stray from the intended path, for instance they
  shouldn't be able to tap Outlast"; "I shouldn't be able to tap any other show than The Amazing Race"). A tap off the path is
  stopped and the next thing on it shakes (tour/practice.tsx `keepToPath`, the sheet content's onClickCapture; the demo's own
  taps, from script, go through):
  - **Add a show:** the search is read-only (the tour types it), and only the show it typed in can be picked. Another result
    shakes it ("For practice, tap The Amazing Race"). On Where are you, only Where are you and Add to my shows work, so Back to
    search shakes Add. Then only the finish's button. During the demo, nothing ("Just watch: the tour's adding these for you").
  - **Start a game:** in Pick the show, only the practice show; another of yours shakes its row. In the options, only Start it.
    Another game, Starts, How long or a switch shakes Start it ("Practice: just tap Start it").
  - **The reveal** is one path already (its beats, Skip to the end, Back to the tour).
- **The reveal step's Home is drawn as it is with results waiting** (the user, 2026-11-01: "this should simulate that top card as
  results waiting"). The show the replay plays gets its episode's final results in (tour/practice-shows.ts `withPracticeReveal`,
  read by screens/home.tsx for that step alone). So Up next shows "Episode 6 final results are in · Reveal" and the top line says
  so; the tap on Reveal plays that episode again. Nothing's read or written for it, and Home's back as it was after the step. With
  nothing to replay (someone new), Up next is lit as it is and the reveal is the made-up one.
- **The demo adds Harry Potter and Saturday Night Live** (TVmaze 361) now, the NFL's weekly game taken out: sports aren't set up
  yet (the user, 2026-11-01; docs/PLAN-sports-add.md).
- **Your practice-added show is on Home with the demo's** (the user, 2026-11-01: "make sure the practice shows we add show up in the
  guide"). Once you've added it (Add a show's `onAdded`), the show the practice typed in is read from its listing (PracticeShow
  `tvmazeId`, from the catalog: The Amazing Race is 18). It goes on Your shows (a game: `ready`) and on its night in the guide, beside
  Harry Potter and SNL, for the flip and guide steps. On the guide step the reel glides to those nights in turn, yours first
  (Wednesday's), then SNL's (Saturday's), about 2.6 s on each: held on today they'd be off to the right, unseen.
- **`tour_reached`** keeps the step number as the count shows it (Down Home's beats are one).

**Checks:**
- `check-new-tour.js`, rewritten for version 3 (A to L): 183 PASS. It covers each real tap, the visit and its way back, the flip,
  the filters through the tour, Start it in the foot, and Try it shaking at the thumb's spot. Also each practice's one path, the
  reveal step's results waiting, and SNL and your practice show on their nights in the guide.
- `tests/tour-steps.test.js`: 17.
- The regressions with the Start button's new place (their selectors now look in the dialog): check-new-start-game 75,
  -phase-starts 57, -spans 98, -questions 97. Also check-new-guide 67, -hub 106, -watching 116.
- `npm test` 1239 of 1240 (the known watch-along one) and `next build`.

## Version 2: welcome first, with practice runs (built 2026-11-01 on branch `tour2`, lane `rfl-tour2`; merged and pushed the same day)

**Status:** live: merged to master and pushed 2026-11-01 with the user's go-ahead ("Merge and push once it's in"), no migration,
after the practice show's data went into production (below). Checked on the lane: `check-new-tour.js` (phases A to K), `npm test`
1237 of 1238 (the one failing on master too), `next build`. **Follow-up the same day** (branch `tour3`, after the user tried it on
their phone): on a step with a practice run the plate tries it instead of Next, and the tour's own typing and tapping slowed down
to be followed (A step with a practice run; Slow enough to follow); check-new-tour phase L.

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
- **Take it again** from the menu behind your picture on Home (Take the tour, beside Settings: Home plays it as the menu closes), as
  well as Settings › Help and account or `/home?tour=1`; its end says "Tap your picture to take the tour again." (the user,
  2026-11-01: "restarted and manually started again from the first level menu when pressing your profile image").

### The steps (7; the last asks about reminders only while this phone could get them)

| # | Step | What's lit | The plate's button (a tap on what's lit does the same) |
|---|---|---|---|
| 1 | **Welcome** card: the wordmark, "Watch with your people. Make any show a game.", the three ideas with pictures of your own (your couch's faces, your shows' art; the tour's own art when there are none) | (a card over Home) | Show me around |
| 2 | **Your Home:** "What needs you is always up top." | the status line and Up next, together | Next |
| 3 | **Add a show:** "Let's add Survivor. Practice: it won't show up." | the Add a show tile | Try it: Add a show, practice, then its demo |
| 4 | **Your couch sees it:** "Shows you add land in the couch's TV guide, when you share what you watch." | the guide, held on today | Next |
| 5 | **Results wait for you:** "Nothing shows until you tap Reveal. Try it: this replays your last one." | Up next's Reveal (else Up next) | Try it: the replay, or a made-up one |
| 6 | **Start a game:** "Make a Prediction Sheet for Survivor. Practice again: it won't show up." | Home's Start a game | Try it: Start a game, practice |
| 7 | **You're set:** "Want a nudge before your picks lock?" | nothing | Turn on reminders, Explore |

Solo (no couch): step 6 pitches a couch (Start a couch lit, no practice: a game needs a couch); step 4's line says on a couch your
people see them too. No practice show (none of the three, or all on your list): the add says "Add any show you watch", and its
practice opens Add a show with nothing typed. Skip tour on every step.

**A step with a practice run** (fixed 2026-11-01 after the user tried it on their phone: Next sat where the thumb goes from habit,
so it skipped the practice by accident): the plate itself says **Try it ›** where Next is on the others, so that habitual tap tries
it; **Skip this step** is a pill up by Skip tour, away from the thumb; a tap anywhere else gives the plate a shake and stays put (on
the other steps a tap anywhere moves on). Back on Home after a practice run, the step ticks (its count turns green, under reduced
motion too, for a second) and the next one comes on; no tap moves on or tries it again while it ticks.

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
- **Slow enough to follow** (the user, 2026-11-01: "slow down the simulated actions more so a player can visually digest what's
  happening"): the typing starts 0.9 s after the sheet's up and takes a letter every 0.1 s (it was 0.45 s and 0.055 s); the demo
  rings a row 1.5 s before its tap and shows the tap (pressed in), holds Where are you 1 s, then rings Add to my shows and presses it,
  and holds each Added 1.7 s; about 8 to 9 s a show (it was about 5). Under reduced motion the name goes in at once and nothing's
  pressed in, but every hold stays (they were cut to 0.06 s, so the demo flashed by).
- **Your couch sees it:** the demo's shows go on Home for that step only (tour/practice-shows.ts: read from their listings, the `next`
  episode included; only Your shows and the guide merge them in, nothing saves them, the tour clears them as it moves on), so the guide
  shows tonight's game on its day and both sit on Your shows; the guide is held on today (an `nd-guide-hold` event on its reel stops its
  roll; let go after).
- **Start a game (practice):** Pick the show lists the practice show first ("The one you just added: practice"); picking it plays the
  simulated rules load (2 s since 2026-11-01, was 1.3 s; "Getting Survivor 51's rules...", under reduced motion too: a pause, not a
  movement), then the real
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

**Done in production, 2026-11-01** (the user: "You can add it to production... I just want the show's data to be ready"; through
their signed-in Chrome). Production's catalog had Survivor 51 only, and unlike the local copy **no Amazing Race show at all**. The
desk's New show added it from its listing (TVmaze 18: a new show with its season 39, on now, Sep 29 to Dec 9, following nothing),
then Make it a game with the bot (Ask ChatGPT for me): a competition, 26 racers, Survival Pool, Weekly Lineup, Outlast and the
Prediction Sheet (seven questions); approved as drafted. Now the catalog has **The Amazing Race 39 ready** (airing, six aired), on
nobody's Home (no one follows it) and not on first run's wall (the desk's add keeps who made the show, so it isn't "curated"); Start
a game on the couch offers all four games. The couch all play Survivor 51, so their practice show is The Amazing Race 39. The
Challenge 42 ended 2026-10-28, so it's no practice show until its next season. (The catalog is edge-cached for five minutes, ten more
stale: a new game shows within a quarter of an hour.)

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
- `tour/store.ts` (the ask to play it again, heard at once by Home's tour: `useTourAsked`), `hub/profile.tsx` (Take the tour beside
  Settings in the menu behind your picture).
- Checks: `scripts/dev-test/check-new-tour.js` (rewritten: phases A to K at 390; K is your picture's Take the tour),
  `tests/tour-steps.test.js` (15).

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

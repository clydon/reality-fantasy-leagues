# Plan (overview): the couch, the hub and episode night

Status: **overview, 2026-10-18.** Written straight after the overdrive mock sessions, to fix the
shape of the next big piece of work. It is deliberately high level: it names the pieces, the model
that ties them together, the data underneath, what changes in today's app, and the order to build
in. A second pass (a fresh session) drills each part down into screens, routes, migrations and
steps; the end of this file lists what that pass must produce.

Mocks (open in Chrome; they link to each other): `.impeccable/mocks/overdrive/`
- `hub.html`: the hub (4 / 12 / new-player toggle), the TV guide, the show page without a league,
  watch along and Rate it on Below Deck.
- `flow.html`: one show through episode night: show space, Before / During / After, the games,
  bingo, watch along, the one reveal.
- `nav.html`, `overview.html`: earlier navigation and Overview explorations (partly superseded).
- `landing.html`: the signed-out landing page, **shipped** in 8f32f2b (`src/components/landing/`).

Memory that records the decisions behind this: couch-group-term, explore-shows-without-league,
non-competition-shows-direction, future-game-types-hub, league-tabs-redesign.

**Changed since, by the full-site mock (2026-10-22, `.impeccable/mocks/site/`; decisions in memory
`site-mock-decisions`).** Where this plan and the site mock disagree, the site mock wins:
- Game names: Classic → **Outlast**, Active Roster → **Weekly Lineup**, Elimination Pool → **Survival Pool**.
- The show space's Before / During / After became **tabs per show**: Tonight · Episodes · Standings ·
  Cast · Chat, with every game inside them (no per-game tabs, no game switcher; Research folds into Cast).
  Today's six league tabs (PLAN-league-tabs.md, shipped) get replaced, not wrapped.
- Picks and lineups live in a **moves dock** above the tab bar until airtime (Set → Edit → locked).
- Results come in **stages** (who went home ~30–60 min after airtime, final scores the next morning),
  with one reveal per episode.
- Commissioner tools are a per-game **Backstage** (results with Ask an AI, waivers, rules, members and
  roles, settings, recent changes); commissioner and player screens look the same.
- First run is **pick a show first**; solo players get a solo hub; joining mid-season depends on ownership.
- Guards and undo by blast radius; settings organised by the question people have.

## Why

The product is a fantasy-football-style app for TV, and its edge is that any show can become a game
and every rule can be customised. Today the app is organised around **one league**: you live inside
it, linked leagues on the same season are a strip of chips, and anything across leagues or across
shows has nowhere to live. The plans for bingo, trivia, watch parties, non-competition shows and
exploring a show without playing all need a level above the league. This plan adds that level
without making the league screens themselves worse.

What we know about how people will use it (from the user, 2026-10-18):
- Most people start in **one league** with friends. If they enjoy it, they run it back next season
  with the same people (maybe more), and some add another show with the same group. Several shows at
  once is for bought-in users. Creating a league is rare.
- Side games (bingo, watch parties, more) are add-ons played **with the people you already play
  with**, not a separate social network.
- Groups are typically 3 to 4 people, sometimes 12, occasionally 20 or more. Every screen has to
  hold up at all three sizes.
- Not every show wants a competition (Below Deck, Real Housewives, scripted shows, live events). Those
  need engagement without commitment.

## The model

Three levels, and one idea that runs through all of them.

```
Hub (you, every couch, every show)
 └─ Show space (one show, one couch, one season)        ← new
     ├─ Season games  (Classic, Active Roster, Elimination Pool)   ← today's league screens
     └─ Episode games (predictions, bingo, watch along, rate it)   ← one episode each, skip freely
```

**The idea: everything hangs off the episode.** Episode night is the product's heartbeat (PRODUCT.md
principle 4), so the show space is organised in three phases, Before, During and After, and every
game, whatever its type, shows up in the phase where it needs you.

### Vocabulary (decided)

- **Couch**: the lasting group of people. "Start a couch", "Join a couch", "4 on the couch". It
  outlives seasons and spans shows. (Memory: couch-group-term.)
- **League**: one game on one season (unchanged meaning). A couch has many leagues over time.
- **Show space**: the home of one show for one couch. Working name; the screen just shows the show's
  name ("Survivor 51").
- **Season game / episode game**: the two kinds of play. Season games need a draft or a season-long
  commitment; episode games are one night each.
- **Watching**: following a show without playing it. Anyone can add a show they watch.

## The pieces

### 1. The hub (the landing screen once signed in)

What it must do: stand out, lead quickly to your leagues, scale from 4 to 20+ people, organise
current and past seasons, show how the couch is doing, start a league or a mini game, feel social for
regulars and calm for newcomers. Direction chosen: **Tonight's Guide**. Mock: `hub.html`.

Top to bottom:
- **Greeting and the couch line**: "Evening, alex. 2 moves due this week", and "Couch Council · 4 on
  the couch ›".
- **This week on the couch (the TV guide)**: the highlight feature. A rolling week of listings, one
  column per day (Today, Tomorrow, then Tue Oct 20 …), every show **anyone in the couch watches**:
  full title, airtime, season and episode, the faces of who watches. Shows you play are solid; shows
  you only watch are dashed. Same-time overlaps sit in a "Same time · 9:00 PM" bracket. A "Now" line
  in today's column. It **rolls on its own** and stops for any touch, scroll or hover, then resumes
  after a few idle seconds; off under reduced motion. Tapping a listing makes it Up next.
- **Up next (the hero)**: the selected show as a poster-style hero with a live countdown, your one
  to-do as a caption plate, and faces of who in the couch has done theirs.
- **Your shows**: posters for the shows **you** play or watch (personal, unlike the guide). Best
  place or "Watching · Ep 4", a needs-you dot; tap to flip to its games, or to open it. The last
  poster is **Add a show** (tell the couch what you're watching; playing is optional).
- **Power rankings**: across every show in the couch this year, each bar split by show, movement
  arrows; top 5 plus you when the couch is big; tabs for This year / All-time / Head to head.
- **On the couch**: activity mixed with chat (lineups set, bingo joined, hot takes), with reactions.
- **Commercial break**: mini games (bingo, a poll, trivia, a watch party).
- **Trophy shelf**: past seasons, the winner, "Run it back".
- New league and Join a couch, quiet, at the foot.

**New player** (no couch yet): no rankings or chat. A headline that rolls the show name, a wall of
shows airing now, three steps (Pick a show, Start a couch, Watch and play), "Someone saved you a
seat? Join their couch", and a practice round.

### 2. The show space (new)

One show for one couch: the piece that keeps season games and episode games from feeling like
separate apps. Mock: `flow.html`.

- **The show bar** travels with you: big at the top of the show space, a slim strip ("SURVIVOR 51 ·
  Ep 5 · 3d 05:40") inside any league, bingo or watch along, red "On air" while the episode runs. Its
  back arrow always returns to the show space. This persistent bar is the anti-disjointedness device.
- **Before / During / After**, switching on its own with the clock:
  - *Before*: one checklist across every game on this show ("1 of 5 done"): set your lineup, pick who
    survives, answer predictions, replace someone (waivers), your bingo card. Each row opens the exact
    place to do it, then drops you back.
  - *During*: Watch along is the hero ("riley and sam are watching"); under it, tonight's bingo,
    your locked lineup (scores hidden), your pick.
  - *After*: **one reveal for every game at once** (who went out, your +14, "Active Roster: up to
    1st · Pool: streak 4 · Predictions: you called it"), then Rate it, graded predictions, the bingo
    result.
- **Your games**: a card per season game with your place, opening today's league screens.
- **Every episode**: tiles for predictions, bingo, watch along, rate it ("No season commitment").
- Couch chat for this show, spoiler-folded.

### 3. Today's league screens, inside the show space

Kept, not rebuilt. The league's tabs, plates, tiles and standings stay as they are, under the slim
show bar instead of today's league header. Episode games appear as dashed chips in the game strip
(Bingo, Predictions) so they're one tap from any league. The Pool keeps Pick; Active Roster keeps
Lineup; Classic keeps Team. (Relates to PLAN-league-tabs.md; that plan's strip and group name become
the show bar and the show space.)

### 4. Show pages without a league ("explore")

Any show a couch member watches can be opened without a league. Mock: the Challenge in `hub.html`.

- **Where are you in it?** asked on first visit: *I'm live* (through the latest episode), *I'm on
  episode N* (a stepper), or *Haven't started* (cast only). Remembered per person per show season.
- Then only what you've seen: who's scoring (Research's rows, without anyone's ownership), the
  episodes you've reached (later ones "Hidden until you're there"), "the lineup that would be
  winning", and who on the couch watches it.
- The hook at the foot: **Play it with your couch** (start a league pre-filled with this show and
  season).
- Data is already per season (results are approved once per season and shared), so this reuses
  Research with the league parts removed.

### 5. Non-competition shows: the engagement ladder

A show never needs a league. Every show sits on a ladder and the show's kind decides which rungs it
offers first (see PLAN-admin-shows-rulebooks.md's "kind of show" layer):

| Rung | What you do | Commitment |
|---|---|---|
| Watch | Add the show, mark where you are | None |
| React | Rate it, the couch verdict, bingo, watch along | One episode, skip freely |
| Call it | One-tap weekly predictions, a personal "called it" streak | A tap a week |
| Play | A league | The season |

Rules for the lower rungs: every unit is one episode, skipping costs nothing, nothing has a deadline
you can miss. Competition shows invite you up to Play; a series offers React and Call it, never a draft.

### 6. Watch along

Playback-synced watching with the couch. Mock: Below Deck in `hub.html`, Survivor in `flow.html`.

- **Start watching**, then *Streaming, no ads* (the clock follows the episode) or *Live on TV* (tap
  **Ad break** so the clock waits). Pause, −10s / +10s, "At the opening credits".
- Comments are pinned to the episode's **runtime**, not the wall clock, so a Friday streamer and a
  Wednesday live viewer line up. Each one appears as you reach its moment.
- **Bias late (non-negotiable)**: comments show a safety margin (30s) after their timestamp, never
  before. Being 30 seconds late beats being 30 seconds early on a big moment. Nothing ahead of you is
  hinted at, not even busy-moment ticks on the progress bar.
- People watching right now within a minute of you show as live; near enough, comments become real
  time.
- Your games come with you: tabs for Couch, Bingo and Lineup (points hidden).
- Finishing marks the episode watched (which updates your progress) and leads into Rate it.
- **Drift is a must-solve** (the user, 2026-10-18), settled in the drill-down: manual pause/nudge and
  a credits marker first; options such as syncing to someone ahead come later.
- Rejected: "moment buttons" (tap when something happens). Spoiler-prone, and nobody does it.

### 7. Rate it and the couch verdict

After the episode, 1 to 5 stars and an optional one-line take; then the couch's average, the spread,
the best take, and "you agree with the couch · taste twin: riley". Spoiler-safe because you only see
the verdict after marking the episode watched. Agreement, not ranking, is the non-competitive hook.

### 8. The landing page (shipped)

Signed-out visitors at `/` get the landing page (8f32f2b): free, any show, do it yourself, real
casts, a working spoiler-gate replay, FAQ JSON-LD, and a quiet Preview chip. Sign in is at
`/sign-in`. Before it's promoted publicly, swap the wiki cast photos for licensed ones.

## The data underneath (shape, not schema)

| Concept | Today | Needed |
|---|---|---|
| Couch | none. `league_groups` links leagues **on one season** | a lasting couch: members, name, created by; its leagues across seasons and shows |
| Couch membership | per league (`league_memberships`) | per couch, with league memberships still per league |
| Show season a couch follows | implied by its leagues | an explicit "watching" list per person (and so per couch) |
| Where you are in a show | per league: `league_memberships.results_seen_through`, lateJoin `seenThrough` | **per person per show season**, shared by every league, show page, chat fold and watch along on it |
| Episode airtimes | `show_seasons.air_time`, `air_tz`, `premiere_date` (partial) | reliable per-episode air dates for the guide, including nightly shows and overlaps |
| Episode games | predictions live in league state (bets) | bingo cards and marks, ratings, watch-along comments (with runtime timestamp), polls: per couch, per episode |
| Power rankings | none | points per person per league, normalised across league types, summed per couch per year |
| Trophy shelf | finished leagues exist | a season result per league (winner, places) to show and "run it back" from |

The one decision everything else rests on: **per-person progress through a show season.** It powers
the spoiler gate, the show page, the chat fold, watch along, Rate it and the guide's "sam's on Ep 3".
Design it once, at the person-and-season level, and have leagues read from it.

The second: **how a couch relates to `league_groups`.** Likely: a couch contains seasons; each
season's linked leagues stay a `league_groups` row (one chat, one reveal), now owned by a couch. The
drill-down confirms or replaces this.

## What changes in today's app

- **Signed-in `/`** becomes the hub. Today it's the loaded league's Overview (with the Dashboard for
  leagueless users).
- **The league header and strip** become the slim show bar plus the game strip.
- **Overview** stays the per-league overview inside the show space; the show space takes over the
  cross-game job (what's due, the reveal).
- **Up next / the alert strip** (`action-items.js`, `commissioner-items.ts`) feed the show space's
  Before checklist and the hub's hero.
- **The reveal** moves up a level: one per episode per couch, covering every game, rather than one
  per league or per linked group.
- **The bottom tab bar** inside a league stays as is (the earlier nav rethink, `nav.html`, is parked:
  the show bar solves the disjointedness it was reaching for).
- **Create a league** grows a "with which couch" step; **Join** becomes "Join a couch" where the code
  is a couch's.
- Copy across the app: "group" and "linked leagues" become "couch".

## Order of work (proposed)

Each step ships on its own and leaves the app coherent.

1. **Couch and per-person progress (data).** The couch model, migrating today's linked groups into
   couches, and progress per person per show season with leagues reading from it. No UI change
   beyond naming.
2. **Show space and the show bar.** Wrap today's leagues; Before / During / After from existing
   to-dos; one reveal for every game.
3. **The hub.** Your shows, Up next, the trophy shelf, then the TV guide (needs reliable air dates),
   then power rankings.
4. **Show pages without a league.** Where are you in it, Research without ownership, Play it with your
   couch. Adding a show you watch.
5. **Episode games.** Rate it and the couch verdict first (smallest), then bingo, then polls.
6. **Watch along.** Including the drift work.
7. **Non-competition shows** on the ladder, as their kinds land in the rulebooks work.

## Open questions (for the drill-down or the user)

Each has a lean from the mock sessions; the drill-down confirms or overturns it.

- **The hero: soonest show, or the one that needs you most?** Lean: needs-you first (an open move
  with the nearest deadline), else the soonest airing. The mock picks soonest, which led with "All
  set" while a Survivor lineup was open; that read wrong.
- **One couch per person, or many?** Lean: the model allows many from day one (a different group for
  a different show is real), but the hub shows one at a time with a switcher, and most people will
  only ever have one.
- **Is per-person progress visible to the couch?** Lean: yes by default, as "sam's on Ep 3" (it's
  what makes per-person chat folding and "watch along with someone near you" possible), with a
  per-person opt-out.
- **Power rankings across league types.** Lean: rank by finishing position, not raw points (1st in a
  league of N earns N points, last earns 1), summed per year; raw points don't compare across
  Classic, Active Roster and the Pool.
- **Show pages for signed-out visitors?** Lean: not in the first build. Revisit once show pages
  exist; it's strong for search but needs its own spoiler default and moderation thinking.
- **Watch along: live chat distance and notifications.** Lean: real-time only within ~60s of each
  other, otherwise timestamped comments. "riley started Episode 4" notifications off by default for
  couches over 6, on (once per episode) for smaller ones.
- **Reliable airtimes.** Lean: per-season `air_time` plus a weekday pattern, set by the admin or the
  research prompt, with per-episode overrides; the guide shows only what it's confident about.
- **The bottom tab bar inside leagues.** Lean: keep as is (this plan's assumption) and revisit once
  the show space has been used for a few weeks.

## What the drill-down pass must produce

A fresh session, using this file and the mocks, writes one detailed plan per step above (or one
file with a section each), in the house style of the other `docs/PLAN-*.md` files:
- screens at 390px first, each state (empty, 4 / 12 / 20+ people, new player, spoiler-hidden)
- routes and navigation (what replaces `/`, where the show space lives, deep links, back behaviour)
- migrations and the data model, including the couch ↔ `league_groups` decision and the progress
  table, with how existing leagues and groups migrate
- which existing components are reused, wrapped or retired (`auth-gate.tsx`, `action-bar.tsx`,
  `league-strip.tsx`, `results-in-banner.tsx`, the dashboard)
- the drift approach for watch along, biased late
- test fixtures in `scripts/dev-test/` keyed on `zt-` with up/down, per CLAUDE.md
- a decision or a recommendation for every open question above

---

## Appendix: fidelity notes from the mock sessions (2026-10-18)

Detail a fresh session can't recover from the mocks alone: the specific behaviour, numbers and copy
that were tested and agreed, what was tried and rejected, the real-data facts the mocks rest on, and
the pitfalls already hit. Treat the numbers as starting values, not specs.

### How the user works on design (keep doing this)

- **Mobile first at 390px**, then check desktop. Players and commissioners are on phones.
- **Pause per screen** for the user to look before moving on; offer two or three directions with
  trade-offs before building anything big; ask only about the end goal or real forks.
- **Real data, real photos** in mocks and demos; **never real usernames** (demo names: alex, riley,
  jordan, sam, maya, dev, priya, luis, kat, ben, noor, theo). Features may be invented in mocks;
  user counts, testimonials and press may not.
- **"Overdrive" is welcome** for the highlight pieces (the guide, the reveal, watch along) as long as
  the everyday screens stay calm.
- The user follows along on a phone through the Claude app: send screenshots (cheap) or a
  self-contained HTML (`node scripts/dev-test/inline-mock.js <mock.html>`); a mock that loads local
  files won't open there.

### The TV guide ("This week on the couch")

- One column per day, **158px** wide, about 2.5 days visible at 390px; day headers "Today · Sun Oct
  18", "Tomorrow · Mon Oct 19", then "Tue Oct 20". Today's label sits on a chyron tag.
- A listing card: airtime, the full title in condensed caps, "S4 · Ep 6", up to 4 watcher faces then
  "+N". Played shows use the show's colour (a red dot if a move is due); watched-only shows are a
  dashed panel with a colour edge and "· watching". A show on now says "On now" with a pulsing dot.
- **Overlap**: shows at the same time group in a bracket with a chyron left rule, "SAME TIME · 9:00
  PM". (The user was unsure about showing times at all; they stayed because they make overlaps make
  sense. "Same night" is the fallback if times are dropped.)
- A "Now 1:26 PM" line inside today's column between what's aired and what's coming; empty days say
  "Nothing on".
- **Auto-roll**: about **22px per second**, looping the week seamlessly (render the week twice, wrap
  at half the scroll width). Any pointerdown, wheel, touch, focus or hover pauses it ("Rolling" →
  "Paused"); it resumes after **4s** idle. Off under reduced motion.
- Tap a listing: it becomes Up next (the hero swaps with a short staggered rise). Tap a watched show
  that is already selected: open its show page. A show in the guide only because someone else watches
  it (Love Island in the mock) can't be opened until you add it.
- Footer line: "Dashed: watching, not playing yet · + Add a show".

### The hub, other details

- **Hero by show type**: Lineup "2 of 3 set · Locks Wed 8:05 PM"; Predict "Who gets banished?";
  Explore "You're on Episode 4 · Stats and recaps up to there" (quiet tag); Watch along, for a series,
  "Start Episode 7 · Comments land as you reach them" (chyron tag). Under it, faces and "11 of 12
  lineups set" / "3 of 4 watching".
- Countdown: four boxes (days, hrs, min, sec); digits flip as they change.
- Posters 168×236: tilt toward the finger (±8°) with a glare that follows it; a tap flips (0.7s) to a
  back with each game, "N players", your place (1st in chyron) and "Open". Watched shows don't flip:
  badge "Watching · Ep 4". A series shows "★ Couch gave Ep 6 a 4.4".
- Power rankings at 12+: top 5, a dashed "N more" line, then your row. A one-sentence callout ("You're
  18 back of riley. You lead the group in Survivor; a good Wednesday puts you level.").
- Chatter: the mock drops a fake line in every ~7s, with "sam is typing" / "kat and 2 others are
  typing". In the real thing it's live activity only, never fabricated.
- 4 vs 12 people changed only: greeting counts, face stacks (6 then "+N"), rankings truncation,
  chatter volume. Nothing needed a separate layout.

### The show space

- Show bar sizes: an XL band (~236px: the show's gradient, a huge faint season number, "‹ Home", the
  name in 50px condensed caps, couch faces, status) and a slim strip (52px: back arrow, name, status
  pill). Status: "Ep 5 · 3d 05:40:13" before, "● On air · Ep 5" during (the bar turns red), "Ep 5
  results in" / "Ep 5 revealed" after. Moving between sizes is a shared-element morph (the mock uses
  the View Transitions API with `view-transition-name: showbar`).
- Phase switcher: three tiles, Before "Get set", During "Watch along", After "Results"; finished
  phases get a teal dot; During turns live red.
- Before checklist rows (64px): icon, a small-caps kind line ("ACTIVE ROSTER"), the job, one detail
  line, a chyron status ("1 open", "Not yet", "2 open", "Due Tue") or teal when done, with a segmented
  progress bar above. Finishing a job returns to the show space with a toast ("Locked in Brady ·
  streak 3 on the line").
- During: a white plate hero, "● ON AIR · riley and sam are watching / WATCH ALONG / Comments land as
  you reach them. Your bingo card and lineup come with you. / Start watching ›".
- After: "Ep 5 · Results are in · Reveal when you're ready · nothing shows until then". The reveal
  plays full screen: "Survivor 51 · Episode 5", "Previously on the couch", the Out plate, a 140px
  chyron "+14", then one line per game. Chat stays folded ("sent a message · reveal to read").
- Inside a league, episode games are dashed chips at the end of the game strip (Bingo, Predictions).

### Show pages without a league

- "Where are you in it?" bottom sheet: *I'm live* ("Caught up through Episode 6"), *I'm on episode*
  with a −/+ stepper (1 to the latest aired), *Haven't started* ("Cast and format only"), and a chyron
  button "Show me through Episode 4". The page restates it at the top ("Through Episode 4 · no
  spoilers past it · Change").
- Leaderboard: rank, photo, name, "5.8 a week" or "Out · Episode 3" (row faded), a bar per aired
  episode where episodes past yours are **hatched and locked**, and the total. A slider (Ep 1 → your
  episode) re-sorts the rows live.
- "The lineup that would be winning": the top three still in, their faces and combined score.
- Episodes past yours: "Hidden until you're there" with an eye icon.
- Foot: a white "Play it" plate: "Challenge 37 with your group · sam and dev already watch. Draft from
  this cast, score every episode from here on. Takes two minutes; we set up the rules. [Start a
  league]".

### Watch along and Rate it

- Start screen: "Watch Episode 7 with the couch / Start when your episode starts. What the couch said
  shows up as you reach it, so nothing spoils." Choices: *Streaming, no ads* ("The clock follows the
  episode") and *Live on TV* ("Tap Ad break when the ads start, so the clock waits"). Under them,
  who's on now and who watched earlier.
- Running: an 84px clock "22:59 of 42:00", a progress bar with your marker and a live friend's marker
  ahead, "riley is watching now · 40s ahead", and the rule in plain words: **"Comments arrive 30s
  after the moment, never before it."** Comments show the author and "at 21:58", plus "· watching
  now" for live ones.
- Controls: −10s, a big Pause/Resume, Ad break (Live TV only; becomes "Back to show"), +10s, "At the
  opening credits". The comment box says "Say something at 22:59" and pins to that moment.
- Safety margin **30s**; the progress bar shows busy moments only behind you.
- Rate it: "How was Episode 7?", five 56px stars, "One-line take (optional)", then a white verdict
  plate: the average in 64px, a bar per star, the best take, "You agree with the couch · taste twin:
  riley" (or "Spicy. You're the couch's contrarian this week").

### Tried and set aside

- **Moment buttons** (tap when something happens): rejected by the user; spoiler-prone, high effort.
- **Rethinking the bottom tab bar** (`nav.html`): a "Tonight" centre button that changes with the
  week, a bar that folds into a pill on scroll, a broadcast stinger wipe between games, a couch sheet
  growing out of the header. Parked: the show bar solves the disjointedness. The stinger and the
  sheet-from-the-header are worth reusing for game switching and the couch sheet.
- **Overview "race"** (`overview.html`): the season as a scrubbable points race with rows re-sorting
  live, form strips on starters, a projection meter, an episode waterfall. Not adopted yet; a strong
  candidate for Scoreboard or the show space's After.
- Group names rejected: crew (generic), network (jargon), watch party (collides with the side game).
  Hub concepts not chosen: The Couch (social-first) and Season Wall (achievement-first).

### DESIGN.md rules the mocks bent (decide per piece when building)

The user allowed breaking rules in mocks. Bent: more than one yellow on screen (guide blocks, hero
tags), motion beyond transform and opacity (clip-path wipes, blur on page depth, view transitions),
sparkline-like form bars, decorative shimmer, two links on a section heading. The drill-down should
say which bends become DESIGN.md amendments and which revert.

### Real-data facts the mocks rest on

- The Survivor 51 couch in local data is one `league_groups` row (unnamed, so the UI falls back to
  "Survivor 51") linking three leagues: Weekly Start/Bench (Active Roster), Last Survivor Standing
  (Classic), Avoid Elimination Streak (Pool).
- Seasons with cast photos: Survivor 44, 49, 51; Traitors US 5; Challenge 37. Scored results:
  Survivor 49 (13 episodes, complete), Survivor 51 (4), Traitors 5 (3); Challenge 37 none.
- Only Survivor 51 has `air_time` (20:05 America/New_York). Reliable per-episode airtimes are a real
  gap for the guide.
- `scripts/dev-test/export-showcase.js` exports all of this read-only and resizes photos to 480px
  JPEG (175 MB of wiki originals → 2 MB). They're fan-wiki images: fine for mocks, need licensed
  replacements before public promotion.

### Pitfalls already hit (save the next session the time)

- A CSS grid column holding a marquee or reel stretches to the reel's full width: use
  `minmax(0, 1fr)` columns (and `min-width: 0`).
- `scrollLeft` rounds to whole pixels, so a slow auto-scroll adding under 1px a frame never moves:
  keep a float position and assign it.
- Text measured before the webfont loads is too narrow: measure after `document.fonts.ready` and on
  resize.
- Reading `cookies()` in the root layout makes pages dynamic and streams metadata into a hidden
  `<div>` in `<body>`, which raced hydration; fixed with `htmlLimitedBots: /.*/` in `next.config.ts`.
- On Windows, `sharp` holds files open: read into a buffer and set `sharp.cache(false)` before
  deleting.
- Git Bash rewrites `/dashboard`-style arguments into Windows paths: prefix `MSYS_NO_PATHCONV=1` when
  passing app paths to `scripts/dev-test/view-as.js`.
- Better Auth's session cookie is `better-auth.session_token`, `__Secure-` prefixed on https; match
  with `endsWith`.

### Tools made in this session (`scripts/dev-test/`)

- `shoot-mock.js`: screenshots any standalone mock; `--query=`, `--range=`, `--scroll`, `--full`,
  `--at=<selector,...>` for one viewport per section.
- `inline-mock.js`: a self-contained copy of a mock (data and photos embedded) for the phone.
- `export-showcase.js`: real show data and photos for mocks and the landing page.
- `check-landing.js`: the signed-out front-door flow at any width.

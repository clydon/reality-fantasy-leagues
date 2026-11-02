# Up next for you (Tonight), and a slim All set

The user, 2026-11-01, after React with a GIF shipped: "put much more thought into the reveal next episode UI/UX": a way to ask
people to watch along, to move on to the next episode yourself, and to add your GIF when you reveal (or wherever makes the best
sense); it can't get in the way of Your moves, "because we don't want people to miss that accidentally". Asked: ping now or plan
later (both); on a show you play, "I watched it" and the reveal are the same moment, and you're always offered a GIF for the
episode you just watched; three directions, full flow. Mocked with /impeccable on a private Design canvas
(https://claude.ai/artifact/BcE68eG6VHXPQGy2PomGHv: A the plate, B the filmstrip, C the couch line, each through caught up,
behind on a show you watch, behind on a show you play). **The user picked A**, with: "Make sure the UI and wording makes sense
and is not confusing for users, especially users who are behind", and "slim down the all set cards" (a screenshot: the tick on
its own row and the empty space under the words).

## As built (branch `reactions`, lane `rfl-reactions`; no migration)

- **The plate** (`src/new/show/up-next.tsx`, `UpNext`, `upNextEpisode`): one caption plate for the next episode you haven't
  watched.
  - A show you only watch: the next one that's aired past where you are (not while Live's Seen it? asks). Under the episode
    heading, above the spoiler chip. "Up next for you · Episode 3 · You're up to Episode 2 (of 14)", who's at your spot or has
    seen it (and how many of the couch's reactions wait in its watch along). Watch along (ink), I watched it.
  - A show you play: the next one with results in (not a catch-up game's: its strip reveals it), **under Your moves**. "Final
    results are in" / "Early results are in" (with the stage bar under it) / "You're 2 behind", "Watched it? Your results are
    ready. Nothing shows until you say.", who has revealed it. I watched it (ink), Watch along. It's what used to be
    AfterEpisode's results-in plate above Your moves (its `data-results-in` and `data-revealed` stay on it).
  - Its tag is the chyron's yellow only while none of Your moves is due; then it's quiet, and the yellow stays with the move.
  - While it shows, Tonight's Watch along card and Plan a watch along stay away (the plate has both).
- **I watched it always asks first**: "Watched all of Episode 3?". A show you play: "Its results play next: who went home, the
  couch's GIFs, then your games. Nothing shows until you say yes." Yes, show me plays the reveal (its The couch reacts slide asks
  for your GIF). A show you watch: "What happened in it, the couch's chat and their GIFs for it will show. Picked the wrong one?
  Move back any time in Where you are." Yes moves where you are (`watching.follow`), a toast "You're up to Episode 3" with Undo
  (which also closes the GIF sheet), and the GIF sheet opens with "You watched Episode 3". Not yet moves nothing.
  A move card's own "Reveal Episode N" (a move waiting on the reveal) asks the same question (`askWatched`).
- **Ask the couch** (the plate's row, on a couch with someone else on it): "Watch Episode 3 with…": everyone else on the couch,
  those at your spot first and picked, then who's seen it ("might rewatch"), then the rest. **Start now and ask them**: a planned
  night that starts now (`plansApi.plan` with `now: true`; watch-plans.ts): their push says "riley is starting Episode 3 now", a
  line from you goes in the couch chat ("Starting Episode 3 now. Join me in the watch along?", which may also reach people as a
  chat notification, as any message does, under their chat settings), and the watch along opens together. **Pick a time
  instead** opens Plan a watch along for that episode. One watch along per episode per couch still (409).
- **Caught up**: no plate. Plan a watch along reads "Watch Episode 7 together · Ask the couch for the live airing, or pick a time"
  (the mock's quiet "Watch it together"); your GIF for the last episode stays in Extras.
- **All set, slim** (`tonight.tsx` AllSet): with nothing due, one line ("✓ You're set for Episode 7 · Change anything until Wed
  8:00 PM", Change on its end when there's nothing else), then each move you've made as a 52px row with its button's word. Locked
  ("Your moves are locked") is the same line. With moves due, the carousel stays: open cards first, then done cards with their
  tick on the title's line.
- Checks: `scripts/dev-test/check-tonight-up-next.js` (new; 34 PASS at 390); check-new-reveal, check-gif-reactions and
  season-forward.js now tap I watched it, then Yes, show me.

## Noticed, not fixed

- Other ways into the reveal still open it straight away (Episodes' hidden row, the chat fold's Reveal Episode N, the reveal's
  own Reveal Episode N at its end): the plate and Your moves are the prominent ones; give the rest the same question if the user
  wants it everywhere.
- A weekly show you're behind on shows two episode numbers on Tonight: the heading (the next airing, "Episode 4 · Tue 9:00 PM")
  and the plate (yours, "Episode 3 · You're up to Episode 2"). Read together they're clear; a heading that says "Episode 4 airs
  Tue" might be clearer still.
- check-new-episode-games.js part 2 (Call it) has a timed step on talk-fixture.js that fails between midnight UTC and 11:30 PM
  Eastern (it dates the show from the database's UTC date): not this change's.

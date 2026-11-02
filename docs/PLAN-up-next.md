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
- **Replay the reveal** (the user, 2026-11-02: "a way to replay the reveal from the Episodes tab"): an episode's page has Replay the
  reveal at its top (a show you play, or one you watch whose results are in); a show you only watch with no results has rows
  instead, and a watched row replays (its GIFs on the row's end are their own button, the GIF sheet). A replay asks the reveal with
  `replay` (season-episodes.ts: writes nothing, only an episode you've seen), opens on "Previously on the couch", and ends on Back to
  the show (never Reveal Episode N).
- **The reveal plays for a show you only watch too** (the user, 2026-11-02, after watching The Challenge's Episode 2: "Shouldn't I
  have gotten that full screen reveal?"; and "some shows might not have an elimination but we should still expect that summary
  reveal including everyone's gifs"). Yes, I watched it moves where you are, then the reveal plays (season-episodes.ts
  watchedReveal, from the season's accepted results as the Episodes tab reads them; it writes nothing): the opener, **In this
  episode** (the write-up, season_episodes.summary, for every reveal now, games or not), what happened and who went home only
  where the results say (never "Nobody went home" on a show without eliminations), then The couch reacts with Add your GIF; no
  games, no Share your night, Back to the show. Every reveal now ends its results on the GIF slide, solo too ("Your reaction",
  just yours). A reveal that can't be read at all opens the GIF sheet instead. Undo closes the reveal (and the GIF sheet).
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

- An episode's page on a show you only watch still asks a player's reads (its results, calls, bingo results), which answer 403
  (`useEpisodeResults` expects it). Harmless, but noise in the console: give them `enabled` only where you play.

- **On hold (the user, 2026-11-02: hold it if it's heavy; it is, mostly in the checks):** the other ways into the reveal still
  open it straight away: the dock's reveal, Episodes' reveal plate and hidden rows, Games' "As of Episode 4", the solo pool's
  reveal, the chat fold's Reveal Episode N, and the reveal's own Reveal Episode N at its end. The way to do it: the question as
  one sheet any screen can open (askWatched's store moved out of UpNext into a host in the signed-in layout), those eight calls
  through it, and a browser.js helper so the checks that tap them tap Yes too. The rule: it asks before the first time you'd see
  results, never before what you've already seen (a watch along's own Reveal your scores, the final-results link).
- **Done 2026-11-02:** two episode numbers on Tonight. While the plate shows, the heading is always the next airing, labelled TV's
  ("Episode 6 · On TV Thu 8:00 PM · in 3 days", the one Your moves are for), never the episode you're catching up on (it used
  to say "Episode 4 · Results" over moves for Episode 6); the plate is yours.
- check-new-episode-games.js part 2 (Call it) has a timed step on talk-fixture.js that fails between midnight UTC and 11:30 PM
  Eastern (it dates the show from the database's UTC date): not this change's.

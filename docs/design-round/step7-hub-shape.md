# The hub and the TV guide: the look (step 7, Impeccable)

Operate mode. The committed world is Lower Third (DESIGN.md): night ground, caption type, colour rationed, yellow fill only for
what's due. Built on [the spec](step7-hub-spec.md) and [the first view](step7-hub-first-view.md); the parts are the round's own
(step 3's strip object and ruler mark, the guide's existing cards).

- **The next thing** stays the hub's one big picture: the show's art full bleed in a 4 px card, 280 px tall (from 330), the
  slow Ken Burns kept. At its head the quiet tag ("Up next", "Results are in", red "On now") and "Season 51 · Ep 6"; the name in
  44 px caption caps; under it "Wed 8 PM · in 4 days" once, in 20 px caption caps. Then the white caption plate, the strip's
  object: its chyron tag says the episode ("Ep 6", "Reveal"), its title the move ("Pick who survives", "Reveal Ep 4", "Your pick
  now"), its line in 13 px plate-muted the count ("0 of 4 in") and a lock only when it isn't the airtime. All set: the plate is
  the night panel with a tick, no yellow. Under the plate, only when there is one: "1 more move · Traitors 5 ›" in 14 px on the
  art, and the planned night or Watch along (only when there's something out to watch).
- **On TV** is a channel bug and a crawl, the Lower Third's own form: a 76 px band under the plate. At its left a fixed 76 px
  bug, the night panel with a 3 px chyron line down its left edge's inside (not a fill: the plate has the yellow), "ON TV" in
  22 px caption caps over "Guide ›" in 13 px muted, and a 7 px live dot (red, pulsing) beside "On TV" while something's on now.
  To its right, under a fade, the week's cards in miniature (120 × 76: the art, the time chip, the name in 15 px caps), today
  first from what's on now or next, drifting left at the guide's reel speed once the plate has landed (a 1.2 s hold), held for
  four seconds under a finger. A card opens the guide on its day; the bug opens it on today. Reduced motion: still, the same.
- **Your people** is one 64 px line: the couch's name in 17 px caption caps over "Ep · Survivor 51" in 12 px muted (what the
  numbers count), then the faces at 34 px, you first and ringed, each with its mark under it in 13 px number face (bone when
  caught up, muted when behind, nothing when not shared), the live dot on whoever's watching along.
- **Your shows** keeps its posters (164 × 232); the game chips leave the front, the Best tag and the due dot stay; no "Tap to
  open".
- **The guide** is a pushed page (`?page=guide`, the bar's Back says Home). Under the bar: the switch (the existing segmented
  control) and Add a show on one line; the week as seven cells across the width (52 px each: the day in 13 px caption caps, the
  date in 19 px number face, up to three 12 px art squares for your shows that night, a live dot on today's when something's on),
  the chosen day on the foreground fill (inverting with the ground, as the segmented control does), today's label in chyron line.
  Then the day as a rundown: a 58 px time gutter in 15 px caption caps on the left, the cards (the guide's existing cards, full
  width, 104 px; two at the same time side by side, under the same time) on the right, the Now line in chyron line across both.
  A swipe across the day turns to the next or previous. Also on under the day, then At your own pace (the streaming rail moved
  here), then N hidden.
- Motion: the On TV crawl is the one authored moment on the hub; the plate's Ken Burns stays as it is. In the guide, the day's
  cards rise once when the day changes (nd-rise). Nothing else new.

## A fifth hub: Previously on · Next time on (TEMP-UI, `look=previously`)

The user asked (2026-11-15) for one more hub, dug for with Impeccable. A surface roll (concept-seed, surface scope, operate) dealt
from a grounded list of new structures (channels, a week-shaped hub, a cross-show scoreboard, a living room, previously/next, a
people-by-shows matrix, a ticker); its lead was previously/next, which also fits the product best: the weekly ritual is the
product (an episode airs, you reveal it, you talk, you set the next move), and television already has a graphic for exactly that
cycle. One challenger held an axis (a full-bleed vertical feed: one thing owns the screen, the next a snap away) and lends that
discipline: the lead show owns the first view. The others lost on product clarity.

- **The thesis:** the hub is your next show's episode cycle, told the way TV tells it. One card, split at your mark: above,
  **Previously on** (the last episode you've seen, the art drained of colour: its title, who left with their photo, your line in
  each game, the couch's GIFs for it); below, **Next time** (the built plate, joined: when, the move or the reveal, Watch along).
- **The signature move: the seam.** Between the halves, a band in the chyron line saying where you are ("You're on Ep 5"), with the
  couch's faces and their episodes on it (tap one for their sheet). It is the hub's "now": the past above it, the future below.
  Revealing an episode is the seam moving down one.
- Then On TV (decision 7), then your other shows as quiet rows (art, where you are, the next airing, the controller), and the
  Finished fold.
- Spoilers: everything above the seam is read at your mark (the episodes read); someone with results waiting sees the episode
  before them, and the reveal sits below the seam.

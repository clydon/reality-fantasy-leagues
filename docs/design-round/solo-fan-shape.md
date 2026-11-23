# Solo (sports-couch C4): the shape brief (Impeccable, step 3)

On [the spec](solo-fan-spec.md) and [the first-view requirements](solo-fan-first-view.md). Mode: **Operate**. The committed world:
Lower Third on Night and Studio. The interview was answered by the spec and the first view (asked once, no answer round: the user
reviews at the story). Nothing new in the palette or type. C2's parts are reused, not copied: `CallRow`, `FanCard`, `CallsCard` and
`CallTicks` in `src/new/sports/fan-call.tsx` take a solo form (no couch: `couchId` null); the season call is new in
`src/new/sports/season-call.tsx` (`SeasonCallRow`, `SeasonCallSheet`).

- **The thesis: the fan's own scorecard.** On a couch the call is a voice the couch answers; alone it's a line in his own book. So the
  solo forms are C2's with the couch taken out, never a second look: the same two team-mark buttons, the same "Your call", the same
  ticks and record type. What's new is one figure fans actually say: **the season's record** in the number type ("12–4–1").
- **Your call row, solo** (`CallRow`, couch null): the voice line "Your call" (no avatar: it's only ever you; the 20 px face goes), then
  the two 48 px buttons in the two-up grid, "Lions win" first in the chyron fill when the page's yellow is free, the other outlined; under
  them, 13 px muted, "Your record starts here · change it until kickoff" before the first call ever, else "Change it until kickoff".
  Called: the voice line "You called **Lions**", a single row under it: "Yours alone until kickoff" 13 px muted, Change as the 44 px text
  button. Over: C2's result line in the caption type ("You called it" / "You missed it"). No backing line exists.
- **The fan band, solo** (`FanCard`, couch null): drawn only once there's a call (R1: no empty card). The card ground, 14 px in: line one
  "Your team" 14 px semibold · "since Sep" muted (no face: the page is his); then C2's record row: "Your calls" over the record at 28 px,
  the ticks filling the row. Nothing about a couch. Hidden: C2's "N calls this season · results hidden" with Show the season.
- **The season call row** (team's page, under the call row, both solo and couch fans; a hairline above it, no card): left, "The season"
  13 px muted over the figure; right, the action. States:
  - none: the figure is the record now ("8–2–1", the number type at 22 px) with "6 left" 13 px muted beside it; the action "Call the
    season" a 44 px outlined button (never yellow).
  - called, open: "You called" 13 px muted over the called record at 22 px; under, 13 px muted, "at 8–2–1 · needs 4 of 6, has 1" (the
    sweat's line); a 4 px track under it, the full width: the wins still needed as hollow segments, the ones won filled teal, the ones
    lost a muted fill, a segment a game left at the call (the same tick language as the calls, laid flat). No action.
  - settled: "You called 12–4–1 · finished 11–5–1" and the verdict in the caption type, "Spot on" or "Off by 1"; the track's segments as
    they finished.
  - hidden (hiding scores): "You called 12–4–1", "the season so far · results hidden" and nothing about how it's going.
- **The season call sheet** (`SeasonCallSheet`, the app's `Sheet`): title "Call the season", subtitle the team's short name. Body:
  1. The record now: the team's xs mark, "Lions 8–2–1" 15 px semibold, "6 games left" muted.
  2. The stepper: a centred row, a 48 px round outlined minus, the called record at the number-hero size (44 px) between, a 48 px round
     outlined plus; under the figure, 13 px muted "4 more wins of 6". The record moves as he steps (tnum, no layout shift). Starts at the
     record's pace, rounded (8 of 10 decided → 5 of 6 left: 13–3–1... capped to the games left).
  3. A 4 px track of the games left, the called wins filled in ink from the left: the call drawn, not described (R5).
  4. "One call a season, pinned to today's record." 13 px muted.
  5. Call it: the full-width chyron button (the sheet's one yellow). Saving: "Calling…" disabled; failed: the alert line under it.
- **This week, solo:** the calls card above Your teams, its head "Your calls" (not "This week's calls": nobody else calls), the rows
  `CallRow` solo with their game line (the team's xs mark, "Lions vs Bears", the time). The table's line says "Your call, above" only
  while the card draws that row, else "You called Lions" once called.
- **Games, solo:** Your games here (unchanged rows: your calls, season calls, drafts; due first). Then **Your team** (B1's couch group,
  the same rows: "Every Lions game", "The rest of the season · Pick'em on its games, or a draft of its players"), into the wizard with no
  couch. Then the couch line, 13 px muted, one line: "Play with friends: Start a couch · Join one".
- **More on the team** (team's page, solo, after the season call row): a 13 px caption-type label "More on the Lions", two 60 px rows
  (Games' row form, chevron right): "A draft of Lions players" · "You and computer players, the rest of the season"; "Every Lions game" ·
  "Pick'em on each, or Best Ball". Then the couch line as on Games.
- **States:** loading (the row's skeleton as C2's; the season row's figure a 22 px skeleton bar); failed read ("Couldn't load your calls ·
  Try again"); a save failed ("Didn't save · Try again" under the row); postponed (C2's); off-season or no game left (no call row, no
  season row; the band's record stays).
- **Motion:** the picked button fills from the tap (150 ms, C2's); the stepper's figure doesn't animate (a number that slides reads as
  a slot machine); the track segment fills 150 ms. Nothing under reduced motion.
- **Anti-goals:** no "start a game" words on a call; no yellow on the season call row or More; no percentages or odds; no streak guilt
  ("missed it", never "blew it"); no push for a solo call; nothing about a couch on the solo page but the one quiet line at its foot.

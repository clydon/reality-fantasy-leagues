# A league's page, This week (sports-couch B1): the shape brief (Impeccable, step 3)

On [the spec](league-page-spec.md) and [the first-view requirements](league-page-first-view.md). Mode: Operate. The committed
world: Lower Third (DESIGN.md), Night and Studio. Shape's interview round was skipped: the spec, the first-view requirements and
the user's settled calls answer its questions; assumptions are marked.

- **Job:** a fan sees the couch in their league this week (whose teams meet, how they stand, what's theirs to do) and the league
  a tab away. Real content: the stand-in ESPN's ZT football and basketball leagues (check-sports-couch.js's world), the zt_nd
  couch's four people and their follows; the frames' scores, records and picks are the stand-in's, marked as made up.
- **The frame:** the show space's compact bar (Night in both themes, a dark plate), without art: Home, then the league's name in
  caption caps (22 px, truncating) with "Week 12 · 2026" muted under it, A3's Follow toggle on the right. The tab bar is the
  show's, with the league's tabs (This week: a calendar-week icon; Scores: a scoreboard list; Games: the trophy). Tabs replace
  history and slide by order.
- **Your move:** the show strip's own form (a white plate, the chyron tag "Your move", the move's words, a chevron), so the page
  speaks the strip's language. The one yellow. Absent when nothing's due.
- **The rivalry:** a panel (`bg-card`, 4 px: one chunk, like the league card), its head a caption label "Rivalry" with a small
  muted swords icon and the game's day and time (or Started / On now with the live dot / Final) on the right. Two side lines,
  away over home: the team's mark, its name, under it the fan's face (18 px) and name and the record; the score at the right in
  `number-row` type when it may show, the winner's in foreground and the loser's muted. One outlined button under them: Start a
  game on it. No VS, no slab, no team colour beyond the marks.
- **The couch's table:** standings rows (DESIGN.md's standings-row, yours on `standings-row-you`): line one rank (tabular, muted;
  the leader's in chyron-line), the mark, the name, the fans' faces (Faces, 20 px, yours first), the record right-aligned in
  tabular caption figures; line two, indented under the name, five form ticks (the team sheet's: teal-tinted W, outlined L, a
  half-filled T; 18 × 16) and this week's game in detail type. Hidden: no rank, no record, no ticks; the head's aside is Show
  records (an outlined 44 px control). The rivalry's teams say "Rivalry, above".
- **Rivalries this season:** caps heading with the couch's rivalry record by fan as its aside; rows of 52 px: the day, the two
  marks (xs) and "Giants at Eagles", the result or the time right; under, "Andrew over Riley" or "Andrew vs Riley" muted.
- **Your games, the rest:** the sheet's OpenRows and outlined MoreAction; the rest of the league one OpenRow into Scores.
- **States:** a move due, none; a rivalry before / on / final, hidden; no rivalry; one team (no rank); no couch team; solo ("Your
  teams", no faces); a bye; a daily sport (next game and "+2 more this week"); off-season (the bar says Off-season, the table no
  records); loading (the bar's skeleton and three row skeletons); a read that fails (one line and Try again).
- **Anti-goals:** a second yellow; numbers when hidden; the table ordered by record when hidden; a kicker over a heading; cards in
  cards; a team's game twice; red for a loss.

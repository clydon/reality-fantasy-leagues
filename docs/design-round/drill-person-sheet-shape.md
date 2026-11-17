# The castaway sheet and the stat's board: the look (Impeccable)

Operate mode, a reference surface: the sheet calm in its first view, the board dense on purpose. The committed world is Lower Third
(DESIGN.md): night ground, caption type, colour rationed, groups only as tags or swatches. Built on [the spec](drill-person-sheet-spec.md)
and [the first view](drill-person-sheet-first-view.md). No new tokens, no new type sizes: every piece below is a part the app
already has, used one way.

- **One sheet, one silhouette.** From every way in: the crumb when it's a level up, the name as the sheet's title, "ZT Survivor ·
  up to Ep 5" under it (the show's `ep` word, never "Episode" here). Then the who block exactly as the Cast tab drew it: the 76 × 96
  photo at the left, at its right a 10 px swatch of the group's colour and its name (· position) in 14 px muted, the status in
  15 px semibold ("Still in", "Out · Ep 5 · Voted out"), "Started on Savu" and a revealed role in 13 px muted. The game sheet's
  filled gold tribe tag goes (a fill reads as the app's one yellow).
- **The lens sits on the chart.** "Counted by" (12 px muted) and the plate buttons from the Cast tab's numbers (40 px, the chosen
  one the bone `foreground` fill, the rest outlined in `edge`, no yellow: choosing a lens isn't due), directly over the chart it
  changes, only when the castaway is in a game you play that counts people week by week. One chart part (the merge of MomentsChart
  and CastChart): stacked columns on a hairline zero, the episode numbers under it, the one they left in live red, labels over each
  column (a count, or a signed number in a game's lens), a key under it. The caption is the headline: "Each episode" at the left,
  "5 moments so far" or "+7.5 so far · 3rd of 18" at the right. **A stat keeps one colour for the season** in both lenses (the
  season's three most frequent stats take ember, orchid and lake; everything else the chart grey), so a kind learned on one face
  holds on the next and in the other lens. In a game's lens where the season's stats aren't that game's (Outlast lends nothing),
  the columns are one colour, the game's own (`gameColour`), totals only. The weeks a castaway counted for you are underlined
  numbers, as step 2b drew them. A column is a door: a tap scrolls the sheet to that episode in their story, which fades in a
  raised fill for a moment (opacity only).
- **In your games, compact.** A row a game (56 px, hairline above): the game's name in 15 px semibold, under it who holds or
  picked them in 13 px muted ("On your team and riley's", "Picked by you for Ep 2"), her number there at the right in the 20 px
  number face, and a down chevron. A tap opens the row in place (the chevron turns up): the holders as 52 px rows (28 px face, the
  name, "Counted for you in 5 episodes", what they got from her), each with a right chevron, opening that person's sheet in that
  game. Closed by default in both lenses: one line says who, so a game everyone shares costs one row, not four.
- **Their numbers.** The caption with "Rank of 18" at the right; a 48 px row a stat: the rulebook's name in 14 px, its rank in
  12.5 px muted ("1st", "T1", "2nd"), the count in the 20 px number face, a right chevron. The whole row is the target.
- **The door mark.** One rule, everywhere on these sheets: a row that opens a level ends in a 16 px muted right chevron; a row that
  opens in place ends in a down chevron; a row with neither opens nothing. No colour, no underline, no button chrome on rows.
- **The board** (a sheet over the sheet). Title: the stat's name, wrapping to two lines in the sheet's 22 px caps; under it
  "ZT Survivor · up to Ep 5 · 7 of 18". Rows of 52 px: the place in the 17 px number face, muted (T for a tie), a 32 px face (out:
  dimmed, as the wall does), the first name in 15 px semibold with "· Out Ep 3" or the position after it in 12.5 px muted, and
  under the name a 4 px bar on one scale (the stat's season colour, or bone for a stat outside the three), the count in the 20 px
  number face at the right, then, in a game's lens, who holds them (the shared `Faces` stack at 20 px, yours first and ringed;
  "Free" in 12.5 px muted in a game with one owner each), and the right chevron. **The castaway you came from** is framed: a 1 px
  `foreground` outline inset on the row, 3 px corners, her name in bold. Not the raised fill (that's yours), not a coloured edge.
  The board opens with that row in view. "None so far" is a 12.5 px muted caption over everyone without it (their rows the same,
  a muted middle dot for the count, no bar). At the foot, one outlined button, "See it beside every stat", to The numbers sorted
  by it.
- **Compare with…** stays the one outlined button at the sheet's foot; it opens a sheet "Compare Jelly with…" holding the face
  wall (four to a row, by group), and a face swaps that sheet for the two side by side: the counts compare in the show's lens, the
  game's points compare in a game's.
- **A sport.** The athlete's sheet takes the same order: who (the headshot in the same 76 × 96 frame, team · position, the season's
  line), the lens over Game by game (the AthleteChart), In your games, This season's games, Past seasons.
- **Motion.** Nothing new beyond the column-to-story highlight: each level rises as every sheet does (380 ms), the In your games
  row opens without animation, reduced motion removes the highlight's fade but still scrolls.

Assumptions marked for the story's open items: the lens never follows a tap on a game row (the row opens in place; the lens
is changed only on the control, so the chart above never changes out of sight); the stats page on the hub ("By the numbers")
keeps its rows as they are this round (it sits outside a show, where the sheet's drill isn't mounted).

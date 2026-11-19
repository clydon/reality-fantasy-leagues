# A show's games when short games are frequent: the look (Round 3, Impeccable)

Operate mode, in the committed world (Lower Third, DESIGN.md): night ground, caption caps for names and numbers, yellow only for
what's due (the strip's), teal for a win, red never for a loss. Built on [the spec](round3-short-games-spec.md) and
[the first view](round3-short-games-first-view.md). Behind `?games=r3` (TEMP-UI, remembered for the browser tab; `?games=off` drops
it), on the real reads: the season's games (each view says `over`), `/archive` a page at a time, and `/archive?record=1` for the
record.

- **A block per time.** Each block is a caption heading over one card on the night panel, rows inside it split by hairlines (step
  6's card, one per block instead of one per game). The heading is 15 px caption caps ("EPISODE 20"), with its aside muted at 13 px
  ("Sun 8 PM · 3 games"). The blocks: the next episode, Running all season (step 6's cards as they are, one per game), the last
  episode's results with the door at the card's foot, Starting later. An episode block for someone behind folds to its heading row
  with a chevron and "3 games · answered"; a tap opens it in place.
- **A night row** is about 64 px, in two lines.
  - The first line holds the game's dot in its ink, its name in 17 px caption caps (the row opens the game's page) and, right, the
    outlined 36 px button with the move ("Answer", "Change", "Pick").
  - The second line holds who's in: 22 px faces, you first. Anyone who has answered is solid; anyone who hasn't is at 40%
    opacity inside a dashed ring. Then the state in 13 px muted ("2 of 4 in · locks Sun 8 PM", "Answered · change until Sun
    8 PM", "Results when you reveal Ep 18").
  - No leaderboard and no place: nothing has counted.
- **A result row** is about 56 px, one part on the tab, in the archive and on Tonight.
  - Left, the winner's 32 px face: two faces overlapped for a shared win; a hairline circle with "–" when nobody scored.
  - Then the game's name in 12 px caption caps, muted, over the result in 16 px bold: "Jordan won", "You won", "Tied: you and
    Riley", "Nobody scored".
  - Right, your place in 22 px number face ("2nd", "T1"), with "3 pts" in 12 px muted under it. Your win sets the place in teal.
  - The row opens the game's page.
- **The door** closes the results card: "All finished games" in 15 px bold with its count in number face, your record's one line in
  13 px muted ("You've won 19 · most on the couch"), a chevron. It pushes the archive over the tab, like How it works.
- **The archive** is a pushed page ("Finished games", Back).
  - **Your record** first, no card: "19" in the 44 px hero number with "wins of 57 · 4 shared" beside it.
  - **A row per opponent** (44 px): a 26 px face, the name, then the split bar on one scale for every row (the most games shared
    sets the full width). You above them is a bone fill, level the line grey, them above a dusk fill, each 8 px tall and square
    ended. Your count sits at its left and theirs at its right, in 17 px number face. A computer player's row carries its robot
    face and the quiet "Computer" tag.
  - **The kind chips** (the existing Chip) wrap under it, never sideways: "All 57", "Prediction Sheet 19" and so on. A chip
    re-reads the record and the list for that kind.
  - **By episode:** each episode a heading ("EPISODE 19", "Nov 15") and a card of result rows.
  - **The foot:** an outlined full-width button, "Episodes 11 to 1", loading the next page under the last.
- **A finished game's page:** the week card's line becomes the result ("Jordan won · you 2nd of 4", "Tied 1st with Riley · 1 pt");
  a one-episode game drops The season's grid of one column. A tie is never "in front" (a words fix, everywhere).
- **Tonight** keeps a mini per season game. Under them:
  - "EPISODE 19 · RESULTS": the result rows, compact in one card.
  - "EPISODE 20 · 3 GAMES": each game as one 44 px line, its dot, its name and its state, opening its page.
- **The reveal's night beat:** the kicker "Episode 18's games", then a row per game at the reveal's size.
  - Each row: the winner's 40 px face; the game's name in 13 px caption caps over the result in 26 px caption; your place right in
    32 px number face, teal when you won.
  - Under the rows, "You won 1 of 3 tonight" in 17 px muted, or "Nobody won outright tonight".
  - The rows rise in one at a time (the existing nd-rise, 60 ms apart; none under reduced motion). It replaces those games' own
    beats.
- **Motion and sound:** nothing new beyond the beat's rise. Pages and folds use the app's existing push and chevron turn.

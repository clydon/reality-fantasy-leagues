# The Games tab as the way into games: the visual brief

- **Job and mode.** Operate. Someone looks for something to play: the next episode's one-episode games, their own longer games'
  state, a game the couch started, a way to start one. Joanna and Casey read the first block and tap one button; Andrew reads the
  longer rows' second lines and leaves; Conor starts things. Structure: [the page spec](games-launcher-spec.md); first view:
  [R1–R5](games-launcher-first-view.md).
- **Direction: the rundown for the next episode.** The committed world, Lower Third on Night, and Tonight's grammar. Where
  Tonight is the results crawl for the episode that played, Games is the run-of-show for the one coming: headed by the episode
  and when it airs, then the line-up of what's on. Sections are `Block`s with a caps heading and a small aside; rows are
  hairline-separated in a panel, never boxed cards a game.
- **A one-episode game's row** (about 60 px): the game's own name in caps (17 px, `type-caption`), its second line the faces of
  who's in (22 px, 3 px corners, overlapping by 6 px, you first, ringed in the foreground) and a few words (13 px, muted); its
  button on the right, outlined (`Btn tone="optional"`), Pick or Join alike. A game you haven't moved in: your face dashed, as
  today's night row says it. Nothing yellow.
- **A longer game's row** (about 64 px): Tonight's row exactly (the game's ink dot, the name in caps at 19 px, its length small),
  the second line your next move's faces (22 px) and its state; the right side your place as a condensed number (22 px) with
  "of 4" under it at 12 px; a chevron. A due move adds the strip's 7 px chyron-line dot before the words. A draft on: the second
  line says it ("You're up · R2 pick 7").
- **Starting things.** Dashed rows (the app's create affordance): "Start a one-episode game" inside the episode's panel, one line
  with a plus; Again as outlined chips under it naming the kinds; "Start a longer game" as its own dashed row after the longer
  games. Same plus, same dash, so they read as one family.
- **A game to join** (block 4): the longer row's first line, faces leading the second, Join on the right as on the one-episode row.
- **Your record:** one row, the count of finished games as a condensed number, the firsts line, a chevron to the finished games'
  page. Teal only when you lead the couch.
- **Colour.** Yellow only in the strip and the due dot. Teal for a first (the record). Game inks only on the dot. People colours
  on avatars.
- **Motion.** None new: this tab lists, it doesn't report. A fold opens in place with the chevron's turn.
- **States and ranges.** 0 to 9 one-episode games an episode (three rows, then "n more for Ep 7", opened in place); 0 to 9 longer
  games (five, or four and a fold naming the rest); faces 1 to 12 (four, then "+n"); names to 20 characters (truncate the name,
  never the button); a draft (its words), archived (its words), starting later (its length says when); behind (an aired episode
  folds to a line); watching only (no Your longer games); nothing at all on a show nobody's set up (Play it, unchanged).
- **Untouched.** The bar, the strip, Join's sheet, Start a game, the finished games' page, the draft room, a game's page, the
  read-only view.

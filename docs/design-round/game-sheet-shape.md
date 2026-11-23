# A game's sheet with Play (sports-couch B4): the shape brief (Impeccable, step 3)

On [the spec](game-sheet-spec.md) and [the first-view requirements](game-sheet-first-view.md). Mode: **Operate**. The committed
world: Lower Third. Little new is drawn: the sheet is the app's `Sheet`, the game is the shared scorebug (moved out of the team
page into `src/new/sports/game-bug.tsx` so both draw one), the types are the gallery's `OptionCard` (a night panel; chosen, the
white plate with a check: the app's chosen look, never yellow), the decision is `PlayPlate` (the one yellow), the bigger scopes are
`OpenRow`, Join is the show's Join sheet.

- **Title:** the sheet's caption title is the matchup ("Cowboys at Giants"); while the schedule loads, "A game". Under it, 14 px
  muted, its day and time, network and line ("Sun 4:25 PM · CBS · NYG by 3"); after kickoff the bug says it, so nothing.
- **The bug:** wide, its couch faces, its ask for a hidden game; it opens nothing more here (it is the game).
- **The couch line** (13 px, under the bug, only when a side has a couch fan): "Sam's Cowboys at Jordan's Giants", "Your Eagles at
  Riley's Jets"; two names a side at most ("Riley and Sam's").
- **On the couch** (a `SportsLabel` "On the couch" only when there's one): a 60 px row a game: its name in 16 px bold, under it
  who's in ("Riley, Sam · 2 in") and, for a game over more than this one, "this game counts in it"; at the right its action as
  text: Join (opens the Join sheet), Open ("You're in"), or muted "Full". Two rows, then "+N more". When the couch's one-game game is
  of the chosen kind and you're not in it, the decision below is **Join** it.
- **Play** (`SportsLabel` "Play"): the rail's one-game types that fit, four at most, a 2×2 of `OptionCard`s (name, one short line:
  "Who wins", "Three players", "A few players each", "The party grid"); Pick'em chosen. Under the grid, the chosen type's line from
  the rail, 13 px muted.
- **The decision:** `PlayPlate`: "Start Pick'em" (or "Join Riley's Pick'em" per the rule; "Make your pick" when you're in and it's
  due), its line the lock words: "Picks lock at kickoff, Sun 4:25 PM · the couch is told, 10 seconds to undo". With Join the
  yellow, "Start another Pick'em" sits under it as `MoreAction` (outlined). Solo: no plate; "Starting a sports game needs a couch for
  now. Start a couch · Join one".
- **Go bigger** (`SportsLabel` "Go bigger", `OpenRow`s): the series still to finish with this game in it, "Every Giants game left ·
  6" (the couch's team's side, else home), "All of this week's games" (the slate's Pick'em start). Then **More options…** (13 px
  bold underlined text link): the chosen type in Start a game's screens.
- **After kickoff:** the bug; the couch line; "On the couch" rows with Open for yours (no Join: picks closed); the talk link ("3
  messages in its thread", Scores' form) or nothing; one muted line "Picks closed at kickoff." while it's on.
- **States:** loading, the bug's skeleton and two tile skeletons; the game not on the team's schedule, one line; postponed, the bug
  says it and Play is replaced by "Postponed: its makeup is a game of its own."
- **Motion:** none new; the sheet's own rise.
- **Anti-goals:** no second yellow; no yellow tile; no pick or standing from a couch game shown before its lock; no score for anyone
  hiding; no odds beyond ESPN's line in words; no VS graphic.

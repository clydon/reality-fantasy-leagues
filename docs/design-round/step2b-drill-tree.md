# The game page, step 2b: the drill tree

Head to head on a Weekly Lineup, with the structural lens ([DESIGN-PROCESS.md](../DESIGN-PROCESS.md), "Not a repaint"): every level
you can reach from the page, what people bring to it, what the views already hold, today's form, and a verdict. It extends
[the step 2 spec](step2-game-page-spec.md); the first-view rules ([R1–R5](step2-game-page-first-view.md)) hold inside each sheet.

## The tree

| Level | Reached from | The casual question | The sweat's question | Data held | Today | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| The page | the Games tab, Tonight, a push | Who do I play, anything to do? | How's everyone else's week going? | the view, `games` (every seat's pairing this week) | step 2's page | **Add a section**: This week's games |
| A matchup | the card, last week, a square, a game row | Did I win? | Who did they start, who sat, what did I leave on my bench? | both teams (`table[].team`), the week's lines and benches (`weeks[]`), locked lineups (`locked`, `games[].locked`) | starters only, the bench folded | **Restructure**: both full teams |
| A person | a name, Week by week, a matchup's header | How's their season going? | Their week-by-week, who they've started, what they've left on the bench | `weeks[]` (started, bench, totals), the grid's results | a weekly bar chart and a week pager | **Keep the chart** (it answers the casual question), **new display** under it: results against each opponent, the lineup matrix (data round 3's C), bench points |
| A cast member | any face | How's this castaway doing? | What do they score on, week by week, and who's had them? | season stats: points per episode, every scored moment (`perEp`, `events`) | who holds them, their story as a list | **New display**: points per episode, split by what scored |
| An athlete | any face, on a sport | How's this player doing? | Their numbers game by game | the game log: each game's opponent and stat line (`items`) | the log as a list | **New display**: their main stats charted game by game; the log stays as the table under it |
| An episode | an episode number in the grid | What happened that night? | Every game's score that week | `plays.rows[].result` (each pairing and score) | everyone's plays that night | **Restructure** for head to head: that week's games first |

## Each level's first view (inside its sheet)

Each sheet opens on one anchor, then one comparison, then the depth: four chunks at most (R1), the anchor a chart or a face
(R2), the same forms as the page (R3: the result square, the signed points scale, faces).

- **A matchup.** Both totals and the result; then each side's starters on the shared scale; then each side's bench with what
  it scored ("left on the bench: +6"), and the best lineup each could have started from their team ("best possible: 9").
  Before the lock: your starters and bench (yours to change), and their whole team, unsplit (a split would give their lineup
  away). After the lock: both sides split.
- **This week's games** (on the page, under the card): one row a game, the two faces and records; before the lock, whether
  each is set; once locked, "locked"; once in, the score. Each row opens that matchup. Yours isn't repeated.
- **A person.** Today's chart and week pager stay first; under them, their season: a row of results (a square a week with
  the opponent's initial and the score), the lineup matrix (a castaway a row, a week a column: started with points, benched
  dim, out marked), and the season's bench points.
- **A cast member.** Points per episode as signed bars on one scale, each split by what scored (the three biggest kinds and
  "the rest"), the total and a short key; then who holds them here; then their story.
- **An athlete.** Their three main stats, each a small bar chart game by game on its own scale (the opponent under each
  game); then the log.
- **An episode** (head to head): that week's games as rows (each opening its matchup), then everyone's plays as today.

## Spoilers and pace

Every chart stops at the viewer's mark (the views and stats are cut there already). Others' lineups only from the lock;
their benches with it. A friend behind is never shown a week past theirs (their copy).

## Open questions

- Should the best possible lineup respect position slots on a sport (it can't be computed without them)?

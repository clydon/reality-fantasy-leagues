# A league's page, Scores (sports-couch B1, session 2): the page spec (Intent, step 1)

2026-11-22, the `sports-couch` lane. Intent's `organize`, once. On the page's frame and This week
([league-page-spec.md](league-page-spec.md), approved as built), round 1's structure ([sports-space-spec.md](sports-space-spec.md):
"Scores: a week switcher for weekly sports, a day strip for daily ones; your teams first, then live, then later today, then the rest
of the week by day. Each game row is the shared game row") and its first views ([sports-space-first-view.md](sports-space-first-view.md)
R2, R3: one game row everywhere), and A1's approved scorebug ([hub-scorebug-shape.md](hub-scorebug-shape.md)).

## The job

**The league's own front page: any week's (or day's) games, what's on, what's coming, how they ended, with the couch's faces on
the games that are theirs.** This week is the couch in the league; Scores is the whole league, browsable back and forward. The
sweat comes here to check every score; the casual fan comes from This week's "The rest of Week 12".

## Where it lives

- The second tab of `/league/<sport>/<code>/`, as today (`/scores`). Nothing else in the frame changes.
- **The switcher sits at the top of the tab**, under the bar, sticky with it while the list scrolls (a long Sunday is 16 rows; you
  should never scroll back up to change week).
  - **A sport cut by weeks (football):** one row of week chips, every week of the season and the playoffs in order ("Week 1" …
    "Week 18", "Wild Card" … "Super Bowl"), each with its dates under it ("Nov 19–24"); it opens on the current week, scrolled to
    show it; the chosen chip is marked, the current week's chip says so even when another is chosen.
  - **A sport by days (the NBA, NHL, MLB, soccer):** the seven days of a Monday-to-Sunday week as chips ("Mon 17" … "Sun 23"),
    today's marked, a day with no games dimmed but tappable (it says so); arrows either side move a week. It opens on today.
    *Changed in the build (the shape, for the user's review):* a chip a game day of the season, one scroller like football's weeks:
    seven chips and two arrows in 358 px are 38 px each, under the 44 px floor.
    Soccer reads by day here too (a round needs every fixture, league-now.ts: BACKLOG 254 b).
  - Away from now, one quiet link at the switcher's end: **This week** (or **Today**), back to it.
  - Bounded by the season the calendar lists: no chips before its first week or after its last; the arrows stop there.
- **The list, in rank order for the chosen week (or day):**
  1. **The couch's games** (solo: **Your teams' games**): every game with a couch team (or yours) in it, or a game you play, by
     kickoff. Only when there is one. Their faces say whose they are.
  2. **Every other game, a day at a time** ("Sunday, Nov 22"), by kickoff. A day-cut sport shows the one chosen day, so its list
     is the couch's games, then "Every other game".
  A game is listed once: in the couch's group or under its day, never both (This week's rule, round 2's R1).
- **No Play button on the rows.** The row opens its game's sheet, which already holds Start a game on that one game; B4 makes it
  the Play sheet round 1 drew (Pick'em chosen, two taps from the row). A button on every row of a 16-game list is noise the sweat
  scans past and the casual fan doesn't need yet. Open for the user below.

## The shared game row

**A1's scorebug, full width**, not a third design: round 1's first-view R3 ("one game row everywhere: the same layout, the same
spoiler treatment") and A1's approved bug are the same idea, and A1's all-games sheet already draws the bug at full width. It moves
out of the hub into the sports parts, and both the strip and Scores draw it.
- Two team lines (the colour slab, the team, up to two couch faces of who follows it, the score, or the record before kickoff), a
  status column behind a hairline (live: period and clock, the red rule, football's down; before: the time, the network, the line
  in words; final: Final, "Final/OT"). At full width a team is its short name ("Eagles"), not its code; the bug on the strip keeps
  the code.
- Your pick is the chyron underline; a game you play wears the controller, its chyron dot while a move is due (A1).
- Winner in the foreground, loser muted; a tie both foreground.
- **Live is fresh only on screen:** a live row asks `/api/sports/now` every 15 s while it's on screen and shown live (A1's poll,
  per row, so a 9-game Sunday afternoon polls only the rows you can see); off screen it keeps the week read's clock.
- **The score rule is the sports pages'** (B1's decision 2): a final shows its score unless you hide sports scores. Hidden (or
  watching as if live), a game that has begun says Started and its time, its score slot an eye (or the TV); a tap asks Show the
  score or Watch it as if live (A1's ask sheet). The hub's 36-hour ask stays the hub's.
- **One Show scores at the list's head** while you hide scores and the chosen week has hidden games: it shows every game of that
  week (or day) for the visit, as This week's Show records does. Each row's eye stays for one game.

## Situations, in rank order

| # | Who, when | First need |
| --- | --- | --- |
| 1 | Andrew, Sunday 2 PM, the 1 PM games on | which games are live and their scores, his Giants among the couch's games first |
| 2 | Conor tinkers, Tuesday | last week's finals (one tap back), next week's slate |
| 3 | Anyone, from This week's "The rest of Week 12" | the week's other games by day |
| 4 | Hiding sports scores | the same rows saying Started, nothing told; one way to show a game, one to show the week |
| 5 | A daily sport (the NBA on a Wednesday) | today's games, the couch's first; yesterday's one tap left |
| 6 | A day with no games (the NBA on Christmas Eve) | that it has none, and the next day that does, a tap |
| 7 | Solo | "Your teams' games" first |
| 8 | Nobody on the couch follows a team here | no couch group; every game by day |
| 9 | Off-season (MLB in November) | Off-season and when it's back; no switcher, nothing to browse |
| 10 | A week that didn't load | that it didn't, Try again; the switcher still works |
| 11 | A game postponed or moved | its row says so (the note), never a score |

## Each surface and its verdict

| Level | Questions (casual · sweat) | Data held | Today | Verdict |
| --- | --- | --- | --- | --- |
| The switcher | Which week am I on? · any week of the season | the league's calendar (weeks, days, season bounds) | none: this week only | **new display** |
| The couch's games | Is my team on, what's the score? | the week, the couch's follows, your games | none (one list) | **new display** (a group) |
| The game row | Who's playing, score or time? · clock, down, line, records | the week read, the live read | the guide's two-mark row, a 13 px score | **restructure**: A1's bug, shared |
| The day groups | What's later, what's done? | the week read | day headings | **keep** (they work) |
| A game (tap a row) | Score, play | team schedule | game sheet | **keep** (B4's Play sheet) |
| A game you play (tap) | my move | home moves | the game page | **keep** |
| The ask (hidden, tap) | Show it or watch it? | recordings | A1's ask sheet | **keep** (moved to shared parts) |

## The data (what's new)

- **The league's calendar for the switcher:** league-now (already read for the bar) gains `weeks` (a week-cut league's weeks of
  both stages: label, first and last day) and `first`/`last` (the season's first and last day, the arrows' bounds). Pure in
  league-now.ts, tested. No new call: the calendar is the one it already reads.
- **A week of one league:** the week read gains `only=1` (read just the asked league, not every pro league: a past week of one
  league costs ESPN 7 day reads at most, each kept 30 days once over) and `to` (a calendar week longer than 7 days, the Super Bowl's
  gap, up to 14 days). This week's read moves to it too. HOSTING.md gets the entry.
- **Live rows:** the existing `/api/sports/now` (A1), on screen only. No migration, no engine change (UI-REVIEW-MAP doesn't apply).

## Left out, and why

- **Play on every row:** B4 (above). **The couch's chat count on a row:** there's no league chat until the Chat tab. **Standings
  and records beyond the bug's:** the Standings tab. **Event sports' Scores** (a leaderboard): a tour's league keeps today's list.
  **The guide's Sports and a team's schedule on the shared row:** their own steps (the guide's review; B2's team page), named so
  R3 finishes there.

## Open for the user

- **Play on each row before kickoff** (round 1's drawing), or the row opens the game and B4's sheet holds Play (recommended: the
  latter, a quiet list).
- **Show scores for the week** at the list's head while hiding, beside each row's eye (recommended: yes, as Show records).

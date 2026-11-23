# A team's page (sports-couch B2): the shape brief (Impeccable, step 3)

On [the spec](team-page-spec.md) and [the first-view requirements](team-page-first-view.md). Mode: **Operate**. The committed world:
Lower Third (DESIGN.md), Night and Studio. No interview round: the user asked for the round to run to the story and stop there, and
the spec's one open choice goes to them in it. Most parts exist: the lower third (`TeamPlate`), the follow line and toggle (A3),
the scorebug (A1/B1), `PlayPlate`, `OpenRow` (2.8's scopes), `SportsLabel`. New: the season chart, the schedule's one-side row,
the Month grid.

- **Job:** one team: is it on, when next, how's the season, a game on it. The team's name is the page's title.
- **Topology:** `src/new/screens/team-page.tsx` at `/league/<sport>/<code>/team/<id>` (`paths.team`; `?against=<id>` opens the
  schedule filtered, for search's matchup). No tab bar. Every `openSports({ kind: "team" })` becomes a push to the page; Add's
  team step closes the sheet and pushes it.
- **The bar** (56 px, sticky, the league bar's Night gradient in both themes, as LeagueFrame): ‹ Back (the page you came from,
  else the league's This week), then Follow at the right (A3's toggle: the quiet fill when on). Nothing else: the plate below is
  the title.
- **The head:** `TeamPlate` (name on the white plate after the colour's tag) and its dark sub plate: the league's short name (a
  link up to the league), the record and the place ("ZTCF · 7–3 · 1st ZTN East"), the record and place only when told. Then the
  follow line (faces and A3's words, Make the X your team). The fan card's place (C2) is under it: nothing drawn now.
- **Now:** the scorebug, `wide`, both teams named; its fans the couch's followers of each side; the clock and line from the
  league's week read when the game's in it. Before it, a 13 px muted line saying what it is ("On now", "Next game", "Today").
  **Play the next game** under it (the one yellow), its line naming the game ("Pick'em · Sun 4:25 PM vs Giants · tells the couch").
  Off-season or nothing left: one line ("Season over · their last game Sun, Jan 4") in place of both.
- **The season:** `SportsLabel` "The season" with its aside "7–3 · Won 2" (the streak in words). A 96 px SVG, full width: a
  baseline across the middle; a bar a game in date order, up for a win and down for a loss, its height the margin (scaled to the
  season's biggest, a 3 px floor so a one-point game still shows); a tie a short tick on the line; a game to come a 6 px faint tick
  (so the season's length reads); the bye a gap with "BYE" under it in 9 px caps; a dashed rule where the playoffs start. Wins in
  the app's good teal, losses in muted ink at half strength: never the team's colour, never yellow or red. Month initials under
  the first game of each month (11 px muted). A football season's bars about 16 px with 4 px gaps; a daily sport's hairlines (162
  at about 2 px). **Read, not tapped** (a deviation from the spec's "one tap on a bar": a football bar is narrower than a 24 px
  target and touches its neighbours, and a daily sport's can't be hit; the schedule is the way into a game, as PFD's gap asks).
  `role="img"` with a label in words ("10 games: 7 won, 3 lost; biggest win by 21; won the last 2").
- **Start a game on:** 2.8's rows unchanged (The next game · Their season · series still to finish).
- **The schedule:** `SportsLabel` "Schedule" with, for a daily sport, a two-segment List · Month (the standings switch's form, 36
  px, the chosen on raised fill in ink). Then the Against chips: one scrolling row, 36 px tall chips with a 44 px hit area, "All"
  chosen (ink fill), then the couch's teams they play (up to three: name, and its fan's face), then "All opponents · N" which
  wraps every opponent in. A chosen opponent shows "Every Giants game · 2 left · both teams' players" as an `OpenRow` at the list's
  top (2.8's meetings scope).
  - **Months:** a 13 px caps heading per month ("November", the count in muted), more space above than below. Earlier months fold
    under one 52 px row "Earlier · Sep–Oct · 8 games" with a chevron. A daily sport's months after the next one fold to their
    heading row with a chevron (open on tap).
  - **The row** (the scorebug's one-side form, 60 px, hairline between rows, no card): a 56 px date column (weekday 13 px bold
    over "Nov 29" 12 px muted), the opponent's `TeamMark sm`, "vs Giants" / "at Giants" 16 px semibold with a muted 12.5 px second
    line only for a note ("Wild Card", "Postponed"), then the bug's status column: 78 px, a hairline at its left, right-aligned,
    the bug's words: before, the time (tabular, bold) over the network; on now, the red dot and clock over the score; a final, "W"
    or "L" (W in good teal, L muted) over the score, tabular. The next game's row sits on a raised panel (where now is in the list).
    Hidden: a begun game's column says "Played" (or "Started" while on), nothing else, and no eye per row.
  - **A series:** consecutive rows against one opponent: the second and later rows drop the mark and say "Game 2 of 3" in muted
    text where the name was, with a 1 px muted bracket joining the mark column. **The bye:** a 44 px row, "Week 10" in the date
    column, "Bye" muted.
  - **A daily sport's runs:** inside the month, before a homestand's or road trip's first game, a 36 px line: a 15 px icon (house,
    plane: lucide), "Road trip · 5 games · Dec 2–9" 13 px semibold muted, and at its right, while any of it is to come, "Start a
    game on it ›" as a text button (2.8's `games` scope on those games, up to the scope's limit).
  - **Month view:** ‹ November 2026 › (44 px buttons, the month in caps 15 px), weekday initials Monday first, then the grid:
    seven square cells (about 48 px), the date at the top left 10 px muted, the opponent's `TeamMark xs` centred, a home game's
    cell on the raised fill, an away game's outlined in a 1 px line (a road trip reads as a run of outlines), W or L 10 px bold
    under the mark when told, today ringed 2 px in ink. A cell with a game is a button that opens it (48 px: a real target). One
    muted line under: "Filled: home · Outlined: away". Opens on the month of the next game.
- **Under the list:** "From ESPN" 12 px muted.
- **Hidden** (Hide sports scores, or unknown yet): the sub plate says the league alone; the bug says Started; the season block is
  the label, then a panel: "N games played. Results are hidden." and an outlined 44 px **Show the season** (a key of its own,
  `season:<league>/<team>`, moving no mark: Standings' form). Shown: everything but a game watched as if live, which stays Started
  with its ask on the bug and its row.
- **States:** loading, the head's plate and three blocks as skeletons; failed, "Their season didn't load." and Try again; no such
  team, "No such team in ZTCF" and a link to the league.
- **Motion:** none new beyond the app's push transition (the page arrives as every depth-2 page does). The one moment the page
  could earn (the season's bars growing from the baseline on first open) is left out: the frame says one good moment per surface,
  and this page's is the live bug.
- **Anti-goals:** no "A team"; no team colour beyond the plate's tag and the marks; no second yellow; no per-row eye; no card per
  row; no VS graphic; nothing sideways but the Against chips' own scroll.

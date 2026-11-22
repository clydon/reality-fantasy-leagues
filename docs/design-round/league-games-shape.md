# A league's page, Games (sports-couch B1, session 3): the shape brief (Impeccable, step 3)

On [the spec](league-games-spec.md) and [the first-view requirements](league-games-first-view.md). Mode: **Operate**. The committed
world: Lower Third (DESIGN.md). Nothing new is drawn: the rows are the show launcher's (`LaunchRow`, `People`, `JoinButton`), the
rivalry row borrows This week's season rivalry row, the plate and outlined starts are the sports parts' (`PlayPlate`, `MoreAction`).

- **Job:** play in this league: do what's due, join the couch's, start something, by who it's with.
- **Headings:** the league page's quiet caps (`SportsLabel`): "Your games here", "With the couch", "Rivals", "Your team" (or "Your
  teams"), each with its count as the aside where it folds.
- **Your games here:** `LaunchRow` whole-row links: the game's name in caption caps 19 px, its people as faces (yours ringed), and
  the move in chyron line and semibold when due, else "All set" muted (PFD's gap: never a place or a score). Due first.
- **With the couch:** the couch's games to join as `LaunchRow`s with the show's Join button (it opens the show's join sheet), four
  and a fold; then Play this week's games (the chyron plate while nothing of yours is due anywhere here, else outlined) and Play the
  season (outlined).
- **Rivals:** rows of 60 px: the two `xs` marks side by side (BACKLOG 254 j's fix), "Eagles at Jets" 15 px semibold over "Sun, Nov
  29 · you vs Riley" 13 px muted, a 44 px outlined **Start** on the right. Under a pair's last row, when it meets twice or more still
  to come, a quiet 44 px text line "Every Eagles–Jets game · 2 left ›". Three rows, then "All N ›".
- **Your team:** one `OpenRow` a team, its mark at the start: "Every Eagles game" over "The rest of the season · Pick'em, a draft
  or your own call", a chevron.
- **Solo:** Your games here, then one muted line: "Starting a sports game needs a couch for now." **Off-season:** your games, then
  "Nothing to start until the season does." **Empty** (no games, nothing to join): With the couch leads.
- **Anti-goals:** no boxes around rows; one yellow; no result anywhere (places, scores, records); no start that can't be done.

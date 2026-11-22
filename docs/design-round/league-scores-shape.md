# A league's page, Scores (sports-couch B1, session 2): the shape brief (Impeccable, step 3)

On [the spec](league-scores-spec.md) and [the first-view requirements](league-scores-first-view.md). Mode: **Operate** (a
scoreboard the sweat scans and the casual fan glances at). The committed world: Lower Third on Night and Studio (DESIGN.md);
nothing new is invented: the switcher borrows the tab bar's chyron rule and the row is A1's approved scorebug.

- **Job:** any week (or day) of the league as a scoreboard, now by default, the couch's games first.
- **The switcher** (sticky under the league's bar, 56 px, on the ground with a hairline under it): one horizontal scroller of
  chips, snap-x, edges masked like the strip's reel.
  - Football: a chip a week, 76 px wide: the label in caption caps 15 px ("Week 12"; playoff weeks shortened to the word fans use:
    "Wild Card", "Divisional", "Conference", "Super Bowl"), its dates under it at 12 px muted ("Nov 19–24"); the current week's
    second line says "This week" in the foreground instead.
  - A daily sport (and soccer): a chip a game day of the season, 56 px wide: the weekday in caption caps over "Nov 19"; today's
    says "Today". A day the league doesn't play has no chip (the calendar lists game days only), so no empty day is ever chosen.
  - Chosen: foreground text and a 3 px chyron-line rule under it (the tab bar's indicator); the rest muted. Opens scrolled so the
    chosen chip sits second from the left (the one before it shows there's a past).
- **Above the list, only when needed,** one 44 px line: **Show scores** (outlined, the eye) while hiding with something hidden in
  view; **This week ›** (or **Today ›**) at the right while away from now.
- **The list:** quiet caps headings (SportsLabel) over full-width scorebugs, 72 px each, 8 px apart: "The couch's games" (solo:
  "Your teams' games"), then each day ("Today · Sun, Nov 22", "Mon, Nov 23"). Kickoff order inside every group.
- **The row (the shared scorebug):** the bug moves to `src/new/sports/scorebug.tsx`; the strip and Scores both draw it. Full width,
  a team is its short name in caption caps 18 px (truncating), faces after it, the score 26 px in its column, the 66 px status
  column behind a hairline. In a list grouped by day, a game to come says its time, network and line (never its day again), and a
  final says Final. Finals show their score (the sports pages' rule); hidden or watching, Started and the eye or TV. A live row
  polls only while on screen.
- **States:** loading (three bug-shaped blocks at the card colour, pulsing), a week that failed (a line and Try again, the
  switcher still live), an empty week ("No games listed for Week 18 yet"), off-season (one line where the switcher would be:
  "Off-season · back Mar 26"), hidden, a couch of none (no couch group), solo.
- **Anti-goals:** no yellow fill anywhere on the tab; no Play buttons on rows; no state-ordered lists (kickoff only); no new
  colours; no cards around groups.

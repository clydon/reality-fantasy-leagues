# A league's page, Standings (sports-couch B1, session 4): the shape brief (Impeccable, step 3)

On [the spec](league-standings-spec.md) and [the first-view requirements](league-standings-first-view.md). Mode: **Operate**. The
committed world: Lower Third (DESIGN.md). Little new is drawn: the rows are This week's standings rows in one line (`TeamMark sm`,
`Faces`, `type-num`), headings the league page's `SportsLabel`, the hidden plate the page's outlined Show.

- **Job:** where every team stands, the league's way, the couch's teams found without reading.
- **The switch** (two-level leagues only): a 44 px segmented control under the bar, full width, two segments ("Division",
  "Conference"; MLB "League"), the chosen on `bg-secondary` in ink with its label bold, the other muted. Not sticky: the groups'
  headings carry where you are. Kept per league for the visit (sessionStorage, a convenience).
- **A group:** `SportsLabel` with the group's name ("AFC East", "American Football Conference" short as "AFC"); under it a 24 px
  row of column heads in 12 px caps muted (`Div`/`Seed`, then the sport's columns, right-aligned over their numbers).
- **A row, 48 px, one line:** place (22 px, tabular, muted; the group's first in bold foreground, never yellow), the mark
  (`TeamMark sm`, 30 px), the short name 16 px bold, the couch's faces (20 px, three at most) after it, a muted word "In"/"Out"
  where ESPN marks it, then the numbers: the record 16 px `type-num`, the sport's next numbers 15 px muted `type-num`, each in a
  fixed width column (record 64, others 44). Your team's row `bg-secondary` rounded (the standings row "you"); others a hairline.
  An out team's name muted.
- **Conference view:** the seed in the place column; a division leader carries a small muted "Div" tag after the name (PFD's gap:
  the order explains itself).
- **The row opens** (the whole row a button, `aria-expanded`): a panel under it, the row's ground continued, two lines of 13 px
  pairs ("Home 3-1 · Road 5-0 · Div 1-1 · Conf 5-1", "Last 10 7-3 · PF 287 · PA 199 · Streak W5", whichever the sport has) and
  "Open the Bills ›" (44 px, a text link). One open at a time; the chevron turns.
- **Under the last group:** soccer's places key (a 4 px colour bar and its words, a line each), then "From ESPN · as of 2:14 PM",
  12 px muted.
- **Hidden** (Hide sports scores, or a game watched as if live): the first group's heading, then a panel: "Standings carry every
  result so far." (for a recording: "You're watching Eagles at Jets as if live. Standings would give it away.") and an outlined
  44 px **Show the standings** (**Show anyway**). Nothing else draws, no row, no number. Unknown setting: the skeleton.
- **Off-season:** the first line under the switch "Final standings · 2026" muted 13 px.
- **Loading:** three groups' skeletons (heading bar, four 48 px bars). **Failed:** "Standings didn't load." + Try again. **None:**
  "No standings for {league} from ESPN."
- **Anti-goals:** no yellow; no fourth number; no letters (x, y, e) without words; no re-sorting inside a group; nothing sideways.

# Add a show or team: the shape brief (Impeccable, step 3)

On [the spec](search-spec.md) and [the first-view requirements](search-first-view.md). Mode: Operate. The committed world: Lower
Third on Night (DESIGN.md), Studio for the light theme. Shape's interview was skipped: the spec and R1-R5 settle the open questions,
and the user reviews the story. Built on the real sheet (src/new/watching/sheets.tsx `AddShowSheet`, src/new/sports/search.tsx),
the same parts first run draws.

- **Job:** type a name, see the thing you meant first, one tap to where it lives; one reversible action at most (Follow, or Pick).
- **The card** (one, for a strong sports meaning): no panel of its own (the sheet is the card colour; the check's C4), flush with the rows, the scorebug its only fill; a header line (the team's
  mark at md, the name in Archivo caps 22, the league short name in muted 13 after it, Follow at the right), the couch line
  in 13 px with faces and names, and the shared scorebug (`GameBug`, wide) with its day as a caps caption over it. A matchup card:
  both marks overlapped, "Eagles at Cowboys" in caps, "Their next meeting · Thu Nov 26" in muted, the bug. A league card: a 40 px
  caps abbreviation tile (the league row's), the name, "Week 12 · 4 on now", Follow. The card's own area opens the place (a team's
  page, a league's page; a matchup's game sheet); the bug opens its game's sheet. Height at most 190 px.
- **Scopes:** All · Shows · Sports as text tabs under the field, 40 px tall, the chosen one in ink weight with a 2 px ink rule
  under it (B1's chosen-chip rule; never yellow); a hairline under the row. `role="tablist"`-free: a group of three pressed
  buttons, so arrow keys aren't promised.
- **Groups:** caps captions over hairline rows, as the sheet has them: Shows (the catalog), From the TV listings (the listings, no
  chip: the group says it), Teams, Leagues. Three rows under a card, then a quiet "More shows · 7" text row that opens the rest in
  place.
- **Team rows:** today's 64 px row (mark, name, a line, chevron), the line in the team page's words: "NFL · Thu 4:30 PM at Cowboys",
  "MLB · Season starts Mar 26", "NFL · On now at Jets" (never a score), "TBD" for ESPN's midnight. The couch's team rows carry the
  person's face and "Riley's team". College teams named alike fold under "More teams named Eagles · 11".
- **Tours (event sports):** a league row with no chevron and no press state, its line "Golf · its page comes later".
- **Before typing, Sports:** the leagues as a 2 × 4 grid of 64 px tiles (caps short name 20, the state line 12 muted, a check when
  followed), then Your couch follows. All: the couch's shows as today's poster tiles, then Your couch follows.
- **Entry words:** the sheet "Add a show or team", "Shows, teams and leagues. Playing is optional."; the field "Shows, teams,
  leagues"; the hub's row "Add a show or team"; the guide keeps "Add a show" and opens on Shows.
- **First run:** the same card and rows, Pick for Follow (a check pill, as the show rows' Picked); a team picked becomes a wall tile
  in its colour with its mark.
- **States:** loading (the card's place holds a 120 px pulse while a strong match's schedule reads), ESPN down ("Teams didn't load"
  with Try again, in the sports place), no match (Add by name; in Sports, "No team or league by that name").
- **Anti-goals:** no yellow fill anywhere in search; no second card; no score in a row; no new colours; team colour only on marks;
  no VS graphics.

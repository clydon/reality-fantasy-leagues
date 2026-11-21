# How a sport's game scope is offered: the shape brief (Impeccable, step 3)

On [the spec](sports-scope-spec.md) and [the first-view requirements](sports-scope-first-view.md). Mode: Operate. The committed world:
Lower Third on Night (chyron yellow is the one action per view; type-caption condensed caps for labels; muted 13–15 px lines).
Assumptions are marked; the user's review of the story confirms or corrects them (the design process's pause).

- **Team's sheet.** The outlined "Start a game…" card becomes a labelled group, `START A GAME ON` (SportsLabel), of OpenRow rows,
  each two lines: *The next game* · "vs Dolphins · tomorrow · a draft, squares or props"; *Their season* · "9 games left · Bills
  players only"; a picked rival's *Every Dolphins game* · "2 games · Dolphins and Bills players"; a series' row as today plus "· both
  teams' players". The rival chips stay below the group as a filter, and their old in-sentence link goes. The yellow plate is untouched.
  *Assumed:* "Their season" uses the team's short name in its line, not its title, so the title stays short.
- **One game's sheet.** "Another game on it…" keeps its card; its line gains "· Dolphins and Bills players".
- **Their season opens on the season.** The sheet's "Their season" sends `length: "season"`: a game that can run the season opens on
  the regular season; the next game's row keeps `length: "next"`.
- **A game's screen.** The title card's marks are the scope's teams, never the page's first two. Under the sentence, one muted line
  `data-gallery-whose`: the marks small, then "Bills players only · 74" / "Dolphins and Bills players · 157", or "Getting the Bills'
  players…" while they fill. It follows How long. The base's "from the two teams" reads "from the Bills" on a one-team scope.
- **Too small.** The Start bar's warn line: "8 of you × 10 each is more than the Bills' 74 players ·" and the fix "Make it shared";
  Start disabled while it stands. *Assumed:* shared over "draft fewer": it always fits and keeps the size the maker chose.
- **The gallery's draft card.** The scope's marks and count; "Getting the players…" instead of "0 players". The sheet reads the season
  again every few seconds while a scoped season has nobody listed.
- **Anti-goals:** no new colours, no second yellow, no new component kinds, nothing on Pick'em or the yellow plate about players.

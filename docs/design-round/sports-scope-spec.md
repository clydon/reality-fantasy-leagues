# How a sport's game scope is offered: the page spec (Intent, step 1)

Step 2.8's design round (docs/PLAN-sports-ready.md 2.8, "Left"), 2026-11-21. Intent's `journey`, once. The user's decision this rests
on: a team's season picks from that team's players only ("a Bills game is a Bills fan's game"); one game from its two teams; a series
or a rival's meetings from both teams. A league's whole season is its own sheet's (LeagueView) and isn't in this round.

## The job

**A fan starts a game on their team at the size they mean, and knows before Start whose players are in it.** Two surfaces share it:
the team's sheet (choosing the scope) and Start a game's screens (choosing the game, and seeing whose players it draws from).

## What's wrong today (seen on nfl-slate-fixture.js at 390, the "before" frames)

1. **Start a game… says one thing and does another.** Its line promises "The rest of the season, a run of games, a rival"; it opens
   on "Just Game 10". The season is reachable only by finding How long on the next screen and changing it.
2. **The scopes are scattered.** The next game is the yellow plate; the season hides behind Start a game…; a rival's meetings appear
   only after you pick a chip, as an underlined link in a sentence ("Play every meeting"); a series is a row lower down (NBA, MLB);
   one later game is behind its row in Coming up. Four ways in that look like four different kinds of thing.
3. **Nothing says whose players.** A draft on the Bills' season shows the base's sentence "everyone drafts three players from the two
   teams" (false there: it's the Bills' alone) and two team marks taken from the page's first two teams (HOU and BUF: an opponent
   picked by list order, not the game).
4. **A pool too small is found only at Start.** The sheet's check runs without the scope's limit, so it passes, and the server refuses
   after the tap ("make it shared"). On a team's season made just now the sheet also has nobody to count (its players fill after the
   add: the gallery card reads "0 players").

## Situations and lenses

- **Andrew drives by:** wants a game on Sunday's Bills game in one tap. The yellow plate already does it (Pick'em). Must stay one tap.
- **Joanna forgets:** a friend sent "let's do a Bills draft". She must not need to know what "scope" or "pool" means; the screen says
  "Bills players only" in plain words, once, where she'd look before Start.
- **Conor tinkers:** wants the whole season, a rival's meetings, or a bigger draft. Every scope one tap from the team's sheet, and the
  pool's size with the number, so he can see why 10 each for 8 of us doesn't fit the Bills' 74.
- **Flavor:** sports only. **Pace:** unchanged (each scope plays together or at your own pace as today). **Spoilers:** no scores move
  into these surfaces (the record and form strip keep Hide scores). **Drafts:** exclusive (each player once) is where size bites;
  shared (two can have the same one) never runs out.

## The team's sheet: content in rank order

1. **The team:** plate, league and record, Follow with the couch's faces, the form strip. *Keep:* it's who you came for.
2. **A game on now**, when there is one. *Keep.*
3. **Play the next game** (the one yellow): Pick'em on the next game, one tap, tells the couch. *Keep:* Andrew's path; Pick'em picks
   no players, so it needs no whose-players line.
4. **Start a game on…** *Restructure:* the outlined Start a game… card and the rival's in-sentence link become one labelled list of
   scopes, each a row whose title is the scope and whose line says how many games and whose players:
   - **The next game** · "vs Dolphins, tomorrow · a draft, squares or props" (opens Start a game on just that game).
   - **Their season** · "9 games left · Bills players only" (opens on the season, How long already the regular season).
   - **Against a rival:** the chips stay (they filter Coming up, which is useful on its own); picking one adds its row here,
     **Every Dolphins game** · "2 games · both teams' players".
   - **A series** (NBA, MLB, NHL): its row here, "4 games · both teams' players".
   Why a list: the scopes are the same kind of choice (how much of their schedule the game covers), so they read as siblings in one
   place, and the yellow stays the single primary. Whose players is said once per row because it's the one fact that differs between
   "the season" and "a game", and it's what decides a draft.
5. **Coming up**, folded by month; **Earlier**, folded. *Keep.* A game's row opens its sheet.

**One game's sheet:** Play this game (yellow, Pick'em) *keep*; Another game on it… *repaint its line:* "Squares, a draft or Pick a few ·
Dolphins and Bills players".

## Start a game (the gallery, then a game's screen)

- **The gallery (step 1):** its header already names the season ("Bills, 2026 season"). The draft card's picture shows the teams it
  draws from and how many players: the scope's mark(s) and count, never the page's first two teams. While the season's players are
  still being fetched, it says so ("Getting the Bills' players…") and fills in when they arrive; it never says "0 players".
- **A game's screen (step 2), when the game picks players** (a draft, a pick of players):
  - The title card's marks are the scope's teams (one mark for a team's season, two for one game, a series or a rival).
  - The base's sentence names the scope where it named "the two teams" ("from the Bills" on the season).
  - **One line, under the sentence, says whose players and how many:** "Bills players only · 74", or "Dolphins and Bills players ·
    157". It follows How long: picking Regular season changes it to the Bills' alone; back to Just Game 10, both teams.
  - **Too small, caught before Start:** our check counts the scoped pool. When an exclusive draft needs more players than the scope
    has, the Start bar says it in numbers and offers the fix in place: "8 of you × 10 each is more than the Bills' 74 players ·
    Make it shared". Start stays disabled until it fits (a change of How long to one game, fewer each, or shared fixes it).
- **A game that picks no players** (Pick'em, squares, props, Pick a few's questions): no whose-players line. A question about one game
  already names only that game's players (2.8's engine rule).

## Flows and returns

- Team sheet → a scope row → "Getting the Bills' games…" → the gallery on that season (How long set for the scope) → a game → Start.
  Back from the gallery returns to the team's sheet (today's `back`).
- Team sheet → a rival chip → its row → the gallery on the meetings' season. Unpicking the chip removes the row.
- Coming up → a game → its sheet → Another game on it… → the gallery on that one game (the team's season, How long one game).
- A game's screen → How long changes → the whose-players line and the size check follow at once; no trip back.
- The too-small warning's fix changes the game in place; Undo is the row's usual Undo.

## Left out, and why

- **A picker for whose players** (e.g. "only the Bills" on a single game): the user chose the scope rule; a per-game choice would ask
  everyone a question only Conor wants. The maker's own typed limit still wins (2.8).
- **Whose players on the yellow plate or on Pick'em games:** they pick no players; the line would be noise.
- **The league's season sheet:** a separate sheet, not this round.
- **A pool too small by position** (one team's three quarterbacks for eight lineups): our check counts the whole pool, not each slot;
  recorded as open, not designed around.
- **A team's season question asked once** naming every opponent's roster (2.8's Left): an engine rule, not this screen.

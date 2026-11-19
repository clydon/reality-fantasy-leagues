# Start a game, the bold pass: page spec (Round 2b)

The user, 2026-11-18, after Round 2 and its notes: "another pass on the design and make sure its bold, has character & soul for both
shows and all supported sports (especially our core sports), and improves on readability, intuitive entry and modification. and
ensure all game types are possible and intuite to create (its okay to repeat yourself in the UI because the engine we developed to a
human understandable game isnt always a one to one)." Built beside Round 2 (`?start=bold`; Round 2 stays at `?start=gallery`) so
it can be kept or reverted.

## The job

Unchanged from Round 2 ([wizard-r2-spec.md](wizard-r2-spec.md)): "let's make a game of this" to a game the couch can play, found by
what a person calls it, changed by taps, seen working, then started. Two additions:
- **The game is drawn with the season's own people and moments** before anyone opens it: the gallery shows what each kind of game
  looks like on this show or sport.
- **Every game type a fan knows by name is a square found by that name,** on shows and on every supported sport, even where two
  names reach one engine game. The engine's own groupings don't have to be the person's.

## The verdicts (the structural lens)

| Surface or level | Verdict | Why |
|---|---|---|
| The gallery's first view | restructure | Its categories were a stock grid: 56 near-identical squares. Each category now leads with its best-known game **drawn with the season** (the lead tile); the rest stay squares. The ready game, Community and saved games, the field and the chips stay. |
| A category | new display | The lead tile: the game as it would look on this show (faces still in, the next episode's questions, a card of the show's own moments, the couch paired off). |
| A square | repaint | Readability: the name a step bigger, the line in plain ink, never more than two lines. |
| Names and search | restructure | Each base carries what people call it ("also called"), searched and said on its screen. Names that collide get one meaning each. A base sits in every category a person would look in. |
| A base's screen | restructure | It opens as the game's own page will look (its name over the show's art, the title card), then How long and When moves lock (Round 2's order, the user's), then **Make it…** (U0's settled quick changes: More competitive, More casual, Different scoring, each showing its next step) and **the rules** (every row in view as a plain line, no fold), then **Find a change** (any change by its words). |
| A change | repaint | Its squares and controls, with the same type steps as the gallery. |
| How long, When moves lock, Preview, Ask, Describe, Community and saved, Start | keep | Round 2 and its notes; the user hasn't asked for changes there. |
| A sport's gallery | new screen | Round 2 left sports on today's sheet. The same gallery in the sport's own words and games, entered from a team, a league's week or a sport's season. |
| A sport's base screen | new screen (the same parts) | Its length is the team's games (Next game, Rest of season, Against a rival) or the league's weeks; its lock is each game's start. |

## 1. The gallery

**First view, in order** (Survivor 51, mid-season):
1. The sheet's head (Start a game, the show, the couch) and the field ("Find a game, or describe one…").
2. The ready game for the next episode, one plate with Start (U0's one tap).
3. Community and saved games, one row (the notes).
4. The chips.
5. The first category's heading and its **lead tile**: Fantasy league, drawn with the castaways still in ("10 still in · pick 5,
   start 3 each week"), then the start of its squares.

**A lead tile per category, by flavor.** One wide tile, the category's best-known game, made of this season's own things. It opens
that game's screen, as its square does.

| Category | Competition (Survivor 51) | Story (Below Deck 13) |
|---|---|---|
| Fantasy | Fantasy league: the faces still in, how many each picks | the same, the crew |
| Pools | Survival pool: the next episode, "Who stays?", a face marked safe | Weekly picks: who scores this week |
| Predictions | Prediction sheet: the next episode's real questions and when it locks | the same: the show's own calls |
| Betting | Betting pool: one worked bet from the bank ("50 on a boot pays 50") | the same |
| Head to head | Head-to-head league: the couch paired off for the first week | the same |
| Bingo & trivia | Bingo: a 3 × 3 card of the show's own moments | the same, its moments |
| Party | Secret Traitors: the couch's faces, two of them masked | the same |
| Just you | Beat the bot: you against our bot | the same |
| Big season | Two halves: the season split at the merge | its stages by name |

Faces are as of where the person is (the Cast tab's own read), so nobody sees a face leave before they've watched it go.

## 2. Known names, repeated where people look

- **Also called.** Each base lists the names people use: Survival pool is also an eliminator pool and a survivor pool; Fantasy
  league a season-long league and a weekly lineup; Best ball "draft and forget"; Head-to-head league matchups; Confidence picks a
  confidence pool; Betting pool a bank; Prop bets props; Bingo bingo cards. Search reads them; a base's screen says them once
  under its name.
- **More than one shelf.** A base sits in each category a person would look in: Survival pool and Last one standing in Just you
  too (a pool you can play alone); Bingo in Party too; Beat the bot in Predictions too; Head-to-head picks in Pools too.
- **One meaning per name** (the writer spike's collisions): Prop sheet becomes **Prop bets** (bets, not the Prediction sheet's
  points); Parlay ticket becomes **Parlay**, the same word as the change that makes one; A new sheet each episode becomes **A new
  card each episode**.

## 3. A base's screen

**First view, in order:**
1. **The title card:** the game's name in title-card caps on the show's art (greyscale, as the show's page has it), what it's also
   called, the plain sentence, what everyone does and Try it.
2. How long (Round 2: the strip and its chips).
3. When moves lock (Round 2: closed, naming someone only when it costs them).

**Deeper, in order:**
4. **Make it…**: three buttons, each its next step on a second line: More competitive ("head to head each episode"), More casual
   ("most points wins"), Different scoring ("only the big moments"). A tap makes that step with a toast and Undo, the row it
   changed marked. Nothing left that way: the button is dashed and says why. The ladders are U0's (docs/PLAN-start-a-game-gpt.md,
   "Settled: B, with quick changes"), drawn on the catalog's changes.
5. **The rules:** every row, each one plain line with its value in bold ("How you win · **Head to head**, the top 2 meet in a
   final"), the row's icon, and Changed with Undo where it changed. No More changes fold: a game's rules are short enough to
   read.
6. **Find a change:** one field; any change by its words ("captain", "bets", "head to head", "lives") as its squares, each tapped on
   or off where it lands.
7. Ready games like it; Every rule.
8. The Start bar (the heart, Start, Ask the couch first).

## 4. A sport's gallery

- **Ways in:** a team's sheet (the team's next game as its length), a league's week (its slate), a sport's season on the couch.
- **First view:** the head (Start a game, the team or league), the field, the ready game (the next game: "Fri 7:30 · 76ers at
  Celtics · Pick'em · Start"), Community and saved games, the chips, the first category with its lead tile.
- **Categories in the sport's own words,** the game types its fans name (the sports catalog: `src/lib/game/start-gallery/sports.json`).
  Core sports first: NFL, NBA, MLB.
- **Lead tiles, the sport's flavor:** lists and schedules rather than one face each (the frame: a face per player doesn't scale).
  A season league shows the team's top players with a stat each; Pick'em shows the next games to pick; props the next game's
  line; Squares a corner of the grid with the two teams; a bracket its first round.
- **A team's colour is a tag,** never a fill (DESIGN.md's Tags Not Fills Rule).

## By situation

- **Competition, mid-season** (Survivor 51): faces still in; fitted drafts say their number (Round 2).
- **Story, before results** (Below Deck 13): its moments and stages; nobody leaves, so pools read "who scores".
- **Aired, own pace** (The Challenge 42): the lead tiles from where the person is.
- **Sports:** a team's next game, its rest of season; a league's week.
- **Lenses:** own pace (said up front), shared and exclusive drafts (the fitted number), stages (Big season's lead tile), spoilers
  (faces and counts as of the person's mark).

## Left out, and why

- **Change it in your words** (a sentence that changes the game) waits for the writer's W1 (docs/PLAN-local-game-writer.md); Find a
  change finds changes by their words without reading sentences.
- **Creative moments** (U0's fourth quick change) needs our AI; it stays with Describe.
- **The sport's quick changes** come when the sports catalog's games carry the same rows as a show's.

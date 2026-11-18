# Start a game, the bold pass as built: Perception-First Design evaluation (Round 2b's check)

Real renders at 390 × 844 in `.ui-atlas/stories/wizard-r2b/after/` (first views `*.jpg`, whole sheets `*.full.jpg`, words `*.txt`):
Survivor 51 mid-season (Episode 8 seen, 9 tonight), Below Deck 13, The Challenge 42 aired, and two stand-in sports pages (the
Eagles' 2026 season; the Sixers–Knicks series). The before is Round 2's same screens (`.ui-atlas/stories/wizard-r2/after/`). Judged
against [wizard-r2b-first-view.md](wizard-r2b-first-view.md) R1 to R5, [the spec](wizard-r2b-spec.md), [the shape](wizard-r2b-shape.md),
the round's frame (docs/DESIGN-ROUND-PACKET.md) and DESIGN.md. The fixtures' "ZT" team names and 9:31 AM kickoffs are stand-ins and
aren't judged.

## Score: 62 / 100

| Layer | Score | Status |
|---|---|---|
| L0, cognitive load | 72 | pass |
| L1, first impression | 62 | fail |
| L2, processing fluency | 58 | fail |
| L3, perception bias | 55 | fail |
| L4, decision architecture | 58 | fail |

(72 × 1.5 + 62 + 58 + 55 + 58) / 5.5 = 62. No cap applies: L0 and L1 are above 40, and no violation blocks a whole layer.

By flavor, on the same rubric: competition shows about 72, the story show about 62, sports about 50. On Survivor and The Challenge
the pass does what was asked: the season's faces, its next questions and a card of its own moments sit in the first view, and a game
changes by goal with its next step named. It loses one thing Round 2 had (the warning that costs someone a move, now below the
fold), and the sports pages, the user's "especially our core sports", carry the show's parts without the sport's words, games or
look. On this evidence the pass is worth keeping; the batch below is mostly what brings sports up to it. Defects 1 to 6 together
should move sports to the show's level and the whole to about 70.

## Context

- **Audience:** whoever starts games for a couch, on a phone, often in passing (Andrew), choosing for people who aren't there
  (Joanna), or wanting every piece (Conor); for sports, fans of a team who know their game types by name (fantasy, pick'em,
  survivor pool, squares).
- **Intent:** recognise a game by what playing it looks like, find it by the name you know, bend it by what you want, try it, start
  it without costing anyone a move. Operate, with the lead tiles allowed a little persuasion (they sell a kind of game).
- **Positioning:** free, inside an app the couch already uses; the commitment is cheap in money and costly in goodwill.
- **What's already working:** the engine-checked catalog (every square plays or says why); Lower Third's plates, condensed caps and
  hairlines; the one yellow on Start; the fitted draft saying its number; Ask the couch first as a peer of Start.
- **Meta-level:** the gallery is the app's promise that any game can be made, for any show or sport; its own coherence is the trust
  signal for that promise.

## Design system

Tailwind v4 utilities over the app's Lower Third tokens (`bg-card`, `bg-secondary`, `type-caption`, `bg-chyron`, `outline-border`),
Base UI's dialog for the sheet. Confidence 95. Fixes below are in design terms, as asked.

## The requirements, met or not

| Requirement | Verdict | Where it shows |
|---|---|---|
| **R1.** The gallery's first view at most five chunks, a lead tile one composition; a base's first view three | Partly met | g1-first: the lead tile is one composition (eight faces as one strip, "+2", one line, no names), but the squares' upper halves show under it and the community is said twice (the row and the first chip, both "22"): six blocks. z-nfl-first: eight (the lead tile, a dead Salary cap square, an empty half row, the next shelf's heading). b1-outlast, y8-fantasy: met (the title card with Try it, How long, When moves lock). |
| **R2.** The season's faces in the gallery's first view; the show's art and a title card on a base's | Met on competition shows; partly on the story show; not on sports | g1-first, c42-first: the faces still in. bd1-first: five of nine face squares blank at first paint. b1-outlast, y8-fantasy: the name in title-card caps, but the art at 30% greyscale under a 40 to 100% wash (barely there). z-nfl-first, z-nba-first, z-nfl-base: nothing of the team (no colour, no mark, no headshot, no art). |
| **R3.** One grammar from the app's parts, one name per thing, reading text 15 px in plain ink, yellow on Start alone, a team's colour only as a tag | Partly met | Met: yellow on Start alone (every game's screen); squares' lines 15 px in bone (g1-first). Not: "Also called" 13 px muted (b1-outlast); the bone badge on every sports square (z-nfl-first); "Predictions" opening "Props and brackets" (z-nfl-shelf); "Community & saved" beside "Community and saved games" (g1-first); "game" meaning ours and theirs (z-nfl-base); the dash meaning "add this" (y12-own). |
| **R4.** Lead tiles show the game's action with the season's things; known names found and said | Met on Survivor and The Challenge; not on the story show; partly on sports | y1 to y7: a face picked for Ep 9, three questions, one worked bet, the couch paired off, a 3 × 3 card of the season's moments, two of the couch masked, the season split at the merge. bd1-first (whole sheet): five lead tiles are the same face strip. z-nfl-first: the schedule and the prop line show the action; the draft is position chips; the squares grid is drawn wrong. y13-aka: "eliminator" finds Survival pool, but the square doesn't say why. |
| **R5.** Changes by goal naming their next step, undone in one tap; every rule a line; Try it early; Start alone in yellow | Met on shows; not on sports | y9-makeit (the toast's Undo, the row marked Changed with Undo), y14-outlast-casual (dashed, with why), y10-rules (every rule a line), b1-outlast (Try it, Start). z-nfl-base, z-nba-base: More casual and Different scoring both dashed; one goal left. |

## The layers

### L0, cognitive load: 72 (pass)

- **Reasoning:** Survivor's first view holds the sheet's head, the field, one block for the ready plate and the community row, the
  chips, and Fantasy leagues with its lead tile. A game's screen holds the three R1 asks for plus a five-part Start bar. The gallery
  runs 11.8 screens on Survivor (about 70 squares, some on two shelves as the user allowed); with the chips it is a browse surface,
  where many options are not a defect.
- **Violations:**
  - (major on football, minor on Survivor) over the first view's budget (F-CL-004, mobile): football eight blocks, Survivor six.
    Cowan (2010): four or so chunks.
  - (minor) the community said twice in one view (the row and the chip, the same 22); FANTASY LEAGUES over FANTASY LEAGUE, two
    stacked caps lines of nearly the same words at 24 and 26 px. Hassin et al. (2009): noise spends working memory unattended.
  - (minor) a game's screen stacks two titles (START A GAME and Survivor 51 over the 52 px name), which pushes When moves lock's
    warning out of the first view (see L4).
- **Strengths:** one lead tile per shelf, its faces never named; every rule in view with no fold; Find a change one field; the chips
  follow the scroll.

### L1, first impression: 62 (fail)

- **Reasoning:** in 50 ms Survivor's gallery reads as this season: eight real faces under a 26 px name, then calm squares; Bingo's
  card of Survivor's own moments and the stages strip carry it deeper; The Challenge's own promo faces do the same. A game's screen
  opens on its name at 52 px, the boldest moment in the flow. Sports and the story show don't get that read.
- **Violations:**
  - (major) the sports first views have nothing of the sport in them: a dark FRI tag, matchup lines in plain text, QB WR RB TE chips,
    a dead square right under the lead tile, and a game's title card of white words on black (z-nfl-first, z-nba-first,
    z-nfl-base). Lindgaard et al. (2006): colour, density and image are what register in 50 ms, and there's no colour or image here.
  - (major) Below Deck paints five of nine face squares blank at first view (they load lazily) and repeats one face strip on five
    shelves (bd1-first). Tractinsky et al. (2006): that first read is the one nearly everyone gets.
  - (minor) the title card's art at about a tenth of its strength, so Survivor's card is text on dark (b1-outlast, y8-fantasy).
  - (minor) the lead tile sits on the ground colour, darker than the squares' panel under it: the featured game is the dimmest
    surface on its shelf. Wertheimer (1923), figure and ground.
- **Strengths:** one yellow, on Start; faces as of the person's mark (10 still in, no exit shown early); the bingo card.

### L2, processing fluency: 58 (fail)

- **Reasoning:** on shows one grammar holds: squares choose, rows open, chips pick one, bone is chosen, dashed can't be had, yellow is
  Start; the season's length quiet and a bone badge for anything shorter (decided 2026-11-18). The sports adapter and the pictures'
  fallbacks break it.
- **Violations:**
  - (major) every sports square wears the bone badge ("THEIR GAMES", "1 GAME"), so it no longer marks the short games (z-nfl-first).
    Wertheimer (1923): one look, two meanings.
  - (major) show words on the sport's screen: "aired", "airs", "once you've watched it", "The show's points", and "game" for both the
    app's game and the NFL's (z-nfl-base, z-nba-base). Reber & Schwarz (1999): what reads wrong reads untrue.
  - (major) the squares grid drawn wrong: "GIANTS" where row 0's digit goes, no team over the columns (z-nfl-first, whole sheet;
    "SIXERS" the same on z-nba-first).
  - (minor) the dash means five things: Coming, needs setup, nothing left that way, aired episodes, and on Your own moments a
    suggestion to add (y12-own).
  - (minor) one thing, two names: the chip "Predictions" opens "Props and brackets" (z-nfl-shelf); "Community & saved" beside
    "Community and saved games" (g1-first); "game one" beside "game 2" (g1-first, bd1-first).
  - (minor) "Also called" at 13 px muted grey, under R3's 15 px plain ink (b1-outlast).
  - (minor) Your team changes meaning: "Draft 5, start 3" on Survivor, "Game 5" on the Eagles, "All season" on The Challenge.
  - (minor) four people in two colours, so the couch's pairs read as two teams (y4-versus).
- **Strengths:** Archivo's two widths do the work; plates only for the ready game and the toast; hairline rows for the rules.

### L3, perception bias: 55 (fail)

- **Reasoning:** Survivor's lead tiles do what R4 asks, so a game is recognised before its name is read; "eliminator" finds Survival
  pool and the screen says what else it's called. The failures come where the picture or the words come from somewhere else.
- **Violations:**
  - (major, ethics) the save counts are invented: "Made by us · ♡178", "♡210", a "Most saved" sort; the code says "made up until
    couches share", and only the foot of See all says so (g2-ready-open, n5-open-saved, Ready games like it on y11-find). Cialdini
    (2001): fabricated social proof is a violation, not a feature; it fails Sincerity (Learning #14).
  - (major) Below Deck's pictures fall back to the same face strip for Bingo, The show's calls and both pools, and lead with leaving
    ("Who stays?", "10 still in", "Who goes home?") where the spec's story column has Weekly picks, "who scores this week"
    (bd1-first). Clark (2013): a tile that predicts a game the show won't play.
  - (major) "SCORING · The show's points" on a football game tells a fan nothing about a touchdown (z-nfl-base). Clark (2013).
  - (minor) the search result doesn't say it matched a known name (y13-aka).
  - (minor) the pool tile's teal tick on a face before Ep 9 reads as "safe", a result (teal means safe in DESIGN.md) (y1-pools).
  - (minor) the title card's reason ("as the started game's own page will look") no longer holds: the live game page puts the
    name in its bar and its art in colour (DESIGN.md, Motion, since the design round's step 2).
- **Strengths:** dashed changes say why ("As casual as Outlast gets here"); the fitted draft says its number ("2 each: 10 castaways
  left for 4 of you"); "Bet points, never money".

### L4, decision architecture: 58 (fail)

- **Reasoning:** on a show's game the trail runs understand, stretch, try, change, commit: Try it on the effort line, Make it… with
  its next step and Undo, every rule a line, Start the one yellow with what it does ("Episode 9 to the finale · picks by tonight
  8 PM", "Tells 3 who watch it"), Ask the couch first beside it. One regression and the sports pages break the trail.
- **Violations:**
  - (major) the line that costs riley moves sits under the fold while Start is in view (b1-outlast; Round 2's b1-outlast had it in
    the first view): a decision for the couch taken without its cost. Thaler & Sunstein (2008).
  - (major) a team's page has none of the sport's season games (the catalog keeps the season-long league, best ball, the confidence
    and survivor pools for a league's season page) and no way to them: "Fantasy leagues" ends at a one-game draft (z-nfl-first).
    Pirolli & Card (1999): the scent stops.
  - (major) Make it… is two-thirds dashed on every sports game shown (z-nfl-base, z-nba-base): changing a core sport's game is one
    button. Thaler & Sunstein (2008).
  - (minor) the sport's gallery has no Community and saved row (the spec's sport first view has it), so the heart's toast names a
    place this gallery doesn't show (z-nfl-first, z-nfl-base).
  - (minor) Coming squares among the playable: the first square under football's lead tile is dead (z-nfl-first). Green & Swets
    (1966): noise beside the signal.
  - (minor) Find a change's result gives no sign it toggles (y11-find); "The details · The draft's time" names a topic, not when.
- **Strengths:** Start named for the game ("START OUTLAST"); one tap from the ready plate; the toast's Undo; dashed with why.

## Cross-layer

- **Experiential self-contradiction (Learning #15):** the pass's thesis is "bold, with character, for shows and every sport"; on the
  core sports the lived screen is text lists, a dead square and a TV app's words. In small: "Also called", the known-names feature,
  is the faintest line on the card.
- **Backend mechanics surfaced (Learning #18):** the catalog's page types (a league's season, a team's games, events) decide which
  games a fan can find, so from a team's page the core fantasy games aren't there; "Your team · Game 5" is the span leaking into a
  roster row.
- **A fallback cascade:** one data gap (Below Deck's moments too long for a card) turns five pictures into one face strip; each
  picture needs its own next-best before faces.

## The defects to fix in one batch, ranked

1. **The sport's game screen speaks show** (L2, L3; z-nfl-base, z-nba-base)
   - Seen: "1–4 aired", "before Game 6 airs", "Or sooner, once you've watched it", "SCORING · The show's points", "YOUR TEAM · Game
     5", "OVER THE SEASON · One game", and "The rest of the season" on a three-game series. A football fan reads a TV app's leftovers
     and learns nothing about how a touchdown scores.
   - Change: the sport's words through the same parts. How long's cells "played"; When moves lock "At kickoff, each game" (tip-off,
     first pitch by sport), its own-pace clause only when someone on the couch hides scores; the behind line in games ("riley hasn't
     seen Games 3 and 4"); Scoring as the table's first line in a fan's terms ("6 a touchdown, 1 per 10 yards"); Your team as its
     shape ("Draft 3 from both teams"); no Over the season row on a one-game page; "The rest of the series" on a series. On a sport,
     "game" is theirs; ours goes by its name ("this draft").

2. **The cost to riley fell out of the first view** (L0, L4; b1-outlast against Round 2's b1-outlast, z-nfl-base)
   - Seen: Start in view; "riley is 2 episodes behind… or miss moves" and Wait for riley under the fold. Andrew starts it in passing;
     Joanna loses moves nobody saw were at stake.
   - Change: the Start bar's line names the cost ("Episode 9 to the finale · picks by tonight 8 PM · riley would miss moves"), its
     last part opening Wait for riley; and the sheet's head folds into the title card (back and close over the art, "Survivor 51"
     small above the name), giving back about 60 px.

3. **A team's page hides the sport's core games** (L4, L3; z-nfl-first, z-nba-first)
   - Seen: "Fantasy leagues" holds a one-game draft and a dead Salary cap. Someone after a season-long fantasy football league, best
     ball, a confidence pool or a survivor pool finds none, and nothing says where they are (sports.json keeps them for a league's
     season page).
   - Change: the team's gallery puts the league's season games on its shelves with their own length ("NFL season"), or leads the
     Fantasy and Pools shelves with a row "The NFL's season games: head-to-head league, best ball, survivor pool ›" that opens the
     league's gallery. Either way a fan's first guess is answered on the first shelf.

4. **Invented save counts** (L3, ethics gate; g2-ready-open, n5-open-saved, y11-find's Ready games like it)
   - Seen: "Made by us · ♡178", "♡210" and a "Most saved" sort: other couches' saves that don't exist; the line admitting it is at
     the foot of See all.
   - Change: no number until couches share: the heart alone, filled and "Saved" when it's yours; no "Most saved" sort until there's
     something to sort.

5. **Make it… is two-thirds dead on sports** (L4; z-nfl-base, z-nba-base)
   - Seen: More casual ("As casual as Game-night draft gets here") and Different scoring ("No other way to score this one here") both
     dashed; one live change.
   - Change: the sport's own ladders, from its catalog and its scoring table: More casual "Next: your best 2 of 3 count", then "Next:
     just pick the winner (Pick'em)"; Different scoring "Next: only touchdowns" (basketball "only points", baseball "only home
     runs"). Where a rung needs the engine, plan that step rather than ship two dashed rows.

6. **No team in the sport's pictures or title card** (L1, L3; z-nfl-first, z-nba-first, z-nfl-shelf, z-nfl-base)
   - Seen: a dark FRI tag, "ZT Eagles at ZT Giants" in plain text, position chips, a title card of white words on black: nothing in
     50 ms says Eagles, or football. The app already has the part: TeamMark (the city code on the team's colour with the cut corner,
     decided 2026-11-15); the gallery never uses it.
   - Change: TeamMark wherever a team appears: on the ready plate beside the kickoff ("FRI 8:15"), before each side of every matchup
     line (Pick'em, Prop sheet, Squares' axes), and on the title card, which takes the hub's sports plate treatment (both teams'
     colours behind the name, no art) with the matchup and kickoff under it. The draft tile shows the top players as 34 px headshots
     where ESPN has them, with one line of their season stat (or the three names with a stat each where it doesn't).

7. **Below Deck: one face strip five times, leading with leaving** (L3, L1; bd1-first)
   - Seen: Outlast, Survival pool, The show's calls, Bingo and Survival pool again all draw the same eight faces; Pools asks "Who
     stays?" over "10 still in", Match the majority "Who goes home?". Bingo doesn't look like bingo; the calls don't look like
     questions.
   - Change: each picture's own next-best before faces: Bingo's card from the season's moments shortened to fit (or the couch's own
     moments), The show's calls as its next two questions, Match the majority's question in the show's words; on a story show Pools
     leads with Weekly picks ("Ep 7 · Mon 8 PM · who scores most?"), as the spec's story column says; a face strip at most once per
     gallery.

8. **The squares grid is drawn wrong** (L2, L3; z-nfl-first and z-nba-first, whole sheets)
   - Seen: rows labelled "GIANTS" then "1": a team's name where the 0 goes, the other team missing from the top. Anyone who has
     played squares sees a broken grid.
   - Change: the column team over the digits (TeamMark and EAGLES over 0 to 4), the row team down the left (GIANTS), rows numbered 0
     and 1; one square lit as yours.

9. **Every sports square wears the bone badge** (L2; z-nfl-first, z-nba-first)
   - Seen: "THEIR GAMES" and "1 GAME" both as white badges, so the one-game games stop standing out, and "their" doesn't say whose.
   - Change: the season-length mark quiet, as SEASON is on a show, named for the page ("EAGLES' SEASON", "THE SERIES"); the bone
     badge only on 1 GAME.

10. **Chips and headings disagree** (L2, L4; z-nfl-shelf, g1-first)
    - Seen: the chip "Predictions" opens "Props and brackets", which has no bracket on a team's page; "Community & saved" beside
      "Community and saved games".
    - Change: a chip is its heading's first word ("Props"); a heading names only what's on its shelf ("Props and calls" here,
      "Props and brackets" where a bracket plays); one spelling, "Community and saved".

11. **A sport's gallery has no Community and saved games** (L4; z-nfl-first, z-nba-first; the heart on z-nfl-base)
    - Seen: the show's gallery opens on the ready plate with the community row under it and its chip first; the sport's on the plate
      alone. The heart on a sports game toasts "It's in Community and saved games", a place this gallery doesn't show.
    - Change: the same block on every gallery, as the spec's sport first view lists: the ready plate, then the row (the page's
      ready-made games and your saved ones; with neither, its "Tap the heart beside Start" line), its chip first.

12. **The title card: the art doesn't show, "Also called" barely does** (L1, L2; b1-outlast, y8-fantasy)
    - Seen: the show's art at about a tenth of its strength (30% greyscale under a 40 to 100% wash), so the card is text on dark;
      "Also called…" in 13 px muted grey, the line that tells someone who searched "eliminator" they're in the right place.
    - Change: the art as the live game page's top has it (its own colours, washed toward Night at the left and the foot), so the
      card previews the page it becomes; "Also called" at 15 px in plain ink, the searched name first.

13. **Search doesn't say why it matched** (L3; y13-aka)
    - Seen: "eliminator" brings SURVIVAL POOL, "Pick 1 who stays, each week": nothing confirms it's the eliminator pool they meant.
    - Change: a square found by a known name says it: "Also called eliminator pool" as its line, the plain line under it.

14. **The couch as two-colour initials** (L3, L2; y4-versus, y6-party, bd1-first)
    - Seen: "A vs R, J vs S" in blue and orange squares, beside Team battle: the pairs read as a blue team against an orange one.
    - Change: the couch's faces at 26 px with first names under them (the spec's "names paired with vs"), each in their own people
      colour; where two share a colour, the names carry it.

15. **The dash means five things** (L2; y12-own, b1-outlast, g1-first)
    - Seen: the suggested moments ("+ A blindside", "+ A trick play goes for a touchdown") wear the dash that elsewhere means Coming or
      nothing left, so they look unavailable.
    - Change: suggestions as solid outlined chips with a plus (Find a change's look); the dash kept for what can't be had now.

16. **Coming squares among what plays** (L1, L4; z-nfl-first, g1-first, bd1-first)
    - Seen: the first square under football's lead tile is a dead Salary cap; four of football's fourteen are Coming.
    - Change: Coming last on its shelf, folded into one line at the shelf's foot ("Coming: Salary cap, Live calls"), never the first
      square under a lead tile.

### Small, in the same batch

- **Two near-identical headings** (g1-first): the category heading as the small caps label (14 px, as How long) with its line
  beside it, so the lead tile's name is the one loud line; this also drops the squares below the fold (R1).
- **The lead tile's surface** (g1-first): on the panel, or the squares on the ground, so the featured game is the brightest surface on
  its shelf.
- **The pool tile's tick** (y1-pools): a white ring, the app's "chosen"; teal stays for a result.
- **The Prediction sheet's tile** (y2-predict): "Ep 9 · tonight 8 PM" over its questions, as the pool's tile has; its hairlines full
  width (they stop at the longest question).
- **The stages** (y7-season, bd1-first): "Game 1 · Tribes", "Game 2 · from the merge", not "game one" and "game 2"; names on two
  lines instead of "CREW SETTLES …"; one fill for every stage with "now" on the current one (the outlined later stages read as
  chosen).
- **The worked bet** (y3-bets): "if it's right, you have 750", not "right, you have 750".
- **Pick'em's dates** (z-nfl-first): the kickoff never cut ("FRI, NOV 27, …"): "Fri 8:15 PM" within a week, the date on its own line
  beyond.
- **Your team** (z-nfl-base, c42-base): always the team's shape ("Draft 3", "Draft 5, start 3"), never the span.
- **After a change** (y9-makeit): "Your version · head to head" under the name, so the card and Start say what they make.
- **The details** (b1-outlast): the value, not the topic ("The draft · tonight 7:30 PM").
- **First paint** (bd1-first): the first lead tile's faces load first, the pulse until each lands, never a blank square.
- **Find a change's results** (y11-find): the plus that Make it…'s rows have, so a square says it toggles.
- **A sport's known names** (z-nfl-base): every sports base's "Also called" on its card, as a show's (Game-night draft has none).

## What breaks "the sport feels and navigates like the show"

The way around is the show's: the same sheet, field, ready plate, chips, shelves with lead tiles, and the same game's screen (title
card, How long, When moves lock, Make it…, the rules, Find a change, Your own moments, the Start bar). What breaks the feel, all in
the batch above:

- **Words:** 1 (aired, airs, The show's points, the rest of the season on a series).
- **What can be made:** 3 (the core fantasy and pool games unreachable from a team's page), 5 (Make it… dead).
- **Look:** 6 (no team anywhere), 8 (the squares grid), 9 (the bone badge everywhere), 16 (a dead square first), and the title card
  without art or "Also called" (12, small).
- **Way around:** 10 (the chip and its heading disagree), 11 (no Community and saved).

## A rule question for the user

A moment nobody on the field makes (a fan runs onto it, a call is overturned) added to Game-night draft "scores like any other moment"
(z-nfl-own, z-nba-own), but in a draft a moment scores for the player who made it. Whose points are these? Three ways: a yes/no each
person answers before the game; points to whoever's drafted players are on the field at the time; or a card of such moments (sports
have no bingo in the catalog, the natural home for them).

## Not in these frames

Needed before the user reviews sports:
- a league's season (the NFL's own gallery), where the core fantasy games live;
- MLB, a core sport (the user's own example, overturned ABS calls, is baseball's);
- a league's week, the spec's other way in;
- a sports game once started from the gallery (the page its title card previews).

> *Initial findings. Ralph Loop a layer score, cite further, switch to solve / analyze, or ask any follow-up to dig deeper.*

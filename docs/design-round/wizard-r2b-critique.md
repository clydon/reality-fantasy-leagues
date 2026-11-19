# Start a game, the bold pass as built: Impeccable critique (Round 2b's check)

Method: dual-agent (A: the design review; B: the detector and the browser), isolated, synthesized here; every finding below was
re-checked against its frame or its code. Frames: real renders at 390 × 844 on Survivor 51 (Episode 8 aired), Below Deck 13, The
Challenge 42 (all aired) and the stand-in Eagles and Knicks–Sixers seasons (`.ui-atlas/stories/wizard-r2b/after/`); the before is
Round 2 (`.ui-atlas/stories/wizard-r2/after/`, `.ui-atlas/stories/wizard-r2-notes/after/`). Code: `src/new/couch/gallery-bold/`.

## Design health: 26/40 (Acceptable)

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 2 | What the lock costs riley sits under the Start bar (Round 2 had it in view); "Community & saved" is lit while Fantasy fills the screen; after Make it… turns a Fantasy league head to head, Start still reads "Start Fantasy league" |
| 2 | Match with the real world | 2 | Shows speak their own words (stages, castaways, the season's moments); an NFL game reads "The show's points", "Your team · Game 5", "before Game 6 airs", "once you've watched it"; Below Deck is asked "Who stays?" |
| 3 | User control and freedom | 3 | Undo on the toast and on each changed rule, Back keeps the scroll, a dashed choice says why; a sport's saved game can't be reopened |
| 4 | Consistency and standards | 2 | The bone fill means "chosen" and also marks every short game's length; a sport's chips open differently named sections; two toasts for two confirmations |
| 5 | Error prevention | 3 | Every change is checked by the engine; the ready plate's one tap skips a lock that costs someone moves; the heart on a sport saves a game the gallery can't open |
| 6 | Recognition rather than recall | 3 | Lead tiles show the game played with the season's own things; "eliminator" finds Survival pool without saying why; Below Deck repeats one crew strip |
| 7 | Flexibility and efficiency | 3 | Search by fans' names, chips, the one-tap ready game, Make it…, Find a change, Describe; from a team's page the season-long games can't be reached |
| 8 | Aesthetic and minimalist design | 2 | A base's first view is calm; the gallery's holds seven chunks, one said twice, "Season" on about 45 squares, a white chip on nearly every sports square; the gallery grew from 8.8 to 11.8 screens |
| 9 | Error recovery | 3 | Clear reasons, and "No game by that name here" offers Describe; "best ball" on the Eagles' page says no such game exists; a sport's saved game gives a false reason |
| 10 | Help and documentation | 3 | Try it, Every rule, How a bet works, Also called; the game's core rule is 14 px muted; on a sport, Try it walks through a lineup and "an episode airs" |

## Specificity

**Shows: the content is authored; the frame around it is half stock.** Wherever the gallery draws on the season, nothing else could
ship it: the Fantasy lead is the castaways still in as of the person's mark ("10 still in", g1-first), the Prediction sheet's lead the
next episode's own questions (y2-predict), Bingo a card of the show's own moments ("Survived a rock draw", y5-quiz; "Picked last",
c42-first), Head to head the couch paired off (y4-versus), How long the show's own stages (bd2-base), and a base opens on its name in
title-card caps over the show's art (b1-outlast). Around that: about 45 same-size squares (icon, caps name, a line, "Season" in the
corner); the rules a settings list (icon tile, caps label, value, chevron; y10-rules); and the lead tile, meant as each category's
stage, the darkest, flattest block in the sheet (a `bg-background` well under raised squares, leads.tsx:250). Lower Third's signature,
the caption plate's angled tag, appears once (the ready plate).

**Sports: interchangeable.** The Eagles' and Knicks–Sixers' galleries could belong to any app: no team colour, mark or athlete
anywhere; the fantasy lead's picture is four grey position chips ("QB WR RB TE · 14 players", z-nfl-first); matchups are plain caps;
the title card is a bare panel (z-nfl-base); the screens borrow the show's words. The app already has the user's own team identity
(`TeamMark`, `TeamPlate`, `src/new/sports/parts.tsx:31–57`), unused here.

**The detector** can't judge this; it found no anti-pattern inside the sheet.

## The detector and the browser

**CLI** (`impeccable detect --json src/new/couch/gallery-bold/`): exit 0; 61 findings, all the advisory `design-system-font-size`:
14 px ×43, 12 px ×7, 20 px ×4, 17 px ×4, and one each of 21 px (a square's name, parts.tsx:45), 30 px (a category's heading,
parts.tsx:77) and 52 px (the title card, parts.tsx:208). The first four are DESIGN.md's ramp lagging the code (each size is used in 47
to 113 files): false positives here. The three one-offs are choices off the ramp: the 30 px heading is in finding 8, the 52 px title
card under Left open. `src/new/couch/gallery/`: 40 of the same advisory, all in Round 2's sheet, which the bold sheet doesn't import.

**In the page** (detect.js injected at 390 on all five seasons):
- `bounce-easing` on every view, from the shared toast, the show bar and `new.css`: outside the gallery, open since Round 2.
- `edge-flush-cards` on the sticky chips (The Challenge 42 and both sports): a chip cut by the right edge, the sideways scroller's
  intended peek. A false positive.
- `low-contrast` 2.1:1 on both sports seasons: the show bar's no-art stand-in behind the sheet ("EAGLES, 2026 SEASON" at 25%), which
  reads as a doubled title in every sports first view. Outside the gallery.

**Measured:** no text under 4.5:1 in the sheet (lowest 5.18:1; the title card's 13 px "Also called" over the art is the tightest
reading text, 5.41:1); no horizontal overflow; every field 16 px; Start the only yellow (the focused field's chyron-line border is the
system's focus colour); no console errors or React warnings. Under 44 px: the shared sheet's Back and Close (40 × 40,
`src/new/ui/sheet.tsx:97`, `:123`) and, from code, the change screens' controls (finding 13). Clipped: Pick'em's three dates on the
Eagles' lead (28 px over each), Below Deck's Big season stage labels (five, up to 42 px over), a sport's Betting pool line (cut at two
lines).

**Where the two reads meet:** the same clipped text, the doubled sports title, Start as the one yellow, the 40 px header buttons.
Focus, the lock's cost, a sport's words and the invented counts are past what a detector sees.

## What's working (keep it)

- **A base's title card and calm first view** (b1-outlast, y8-fantasy, c42-base): the game's name at 52 px over the show's greyscale
  art, one plain sentence, then How long and When moves lock; the Start bar says what Start does ("Episode 9 to the finale · picks by
  tonight 8 PM").
- **Lead tiles made of the season** (g1-first, y2-predict, y4-versus, y5-quiz, y7-season): the game is recognised before its name is
  read (PFD's R4), its faces as of the person's mark.
- **Make it…** (y9-makeit, y14-outlast-casual): changes by goal, each naming its next step, a toast with Undo, the changed rule marked
  with its own Undo, a dead end that says why ("As casual as Outlast gets here"). Your own moments carries each world's oddities ("A
  kicker makes a tackle", z-nfl-own).

## The busy test and the people

A base's first view holds four chunks (the title card, the effort row with Try it, How long, When moves lock) against R1's three, and
reads calm. The gallery's holds seven (the field, the ready plate, the saved row, the chips, a heading, the lead, two squares' names)
against R1's five, one of them said twice; a five-second look names "Start a game", "The Tribal Forecast", "Community and saved games"
and the faces. Past four options: categories of 13 (Fantasy, Predictions), 10 chips, 9 rules on every base.

- **Joanna** (forgets) is the couchmate the hidden lock costs.
- **Andrew** (drives by) meets "Start Fantasy league" on a game he just made head to head, "The show's points" in an NFL game, and a
  saved game "not in the gallery any more".
- **Conor** (tinkers) can't reach best ball, head-to-head points or a survivor pool from the Eagles' page.
- **A keyboard or switch user** loses their place on every lead tile.

## The findings, one batch

### P1

**1. The lock's cost is out of sight at Start.** Both. b1-outlast, n3-heart, bd2-base, z-nfl-base; the ready plate on g1-first.
- Wrong: the title card pushed "riley is 2 episodes behind… or miss moves · Wait for riley" under the Start bar (Round 2 had it in
  the first view), and the ready plate's Start starts without passing it (bold-sheet.tsx:261–265). A maker can start a game that costs
  someone moves without seeing it.
- Change: when the lock costs someone, the Start bar's line above Start is that cost in 15 px plain ink ("riley would miss moves from
  Episode 10"), with Wait for riley as a 44 px outlined button beside it; the stretch joins the line under Start. The ready plate does
  the same: its second line names the cost and its Start opens the game's screen. With no cost, one tap still starts (Round 2's "Start
  starts").

**2. Sports have no identity.** Sports (NFL, NBA). z-nfl-first, z-nba-first, z-nfl-shelf, z-nfl-base, z-nba-base.
- Wrong: no team colour, mark or athlete anywhere: the ready plate's tag is a grey "FRI", the fantasy lead four grey position chips,
  matchups plain caps, the squares corner one team ("GIANTS"), the title card a bare panel. The pack's teams carry only an id and a
  name (`src/lib/game/game-words/index.d.ts:46–49`).
- Change: carry each team's abbreviation and colour into the wizard's pack and use the team parts the user approved: a 30 px
  `TeamMark` before each team in every matchup line and on both axes of the squares corner; the ready plate's angled tag in the team's
  colour; the title card on the team's lower third (`TeamPlate`), or the next game's two marks at 64 px, where there's no art; the
  fantasy lead as both teams' top three players, a row each (mark, name, position, one stat). Colour stays on marks and tags.

**3. A sport's screens speak TV, and a length leaks into the rules.** Sports, plus one show bug. z-nfl-base, z-nba-base, c42-base.
- Wrong: an NFL draft's rules read "Scoring · The show's points" and "Your team · Game 5"; the lock says "before Game 6 airs… or
  sooner, once you've watched it"; the strip says "aired"; How a bet works bets "on who goes home" (bold-sheet.tsx:927); Try it walks
  through choosing who plays before each episode for a game with no lineup (seen live). The rule-value filter (bold-sheet.tsx:827)
  lets a length through as Your team's value: "Game 5" on a sport, "All season" on The Challenge 42.
- Change: a sport's own words on these screens. Scoring names the sport's scoring (the stats it counts), never the show's points;
  Your team says the draft ("Draft 3 from both teams"); the strip says "played"; the lock reads "When the next game starts" or "At
  kickoff" (tip-off, first pitch); costs read "before Game 6 starts"; no "once you've watched it" where results show straight away;
  Try it and How a bet works come from the game's own kind. The filter drops every length, so Your team always says the team.

**4. From a team's page, a sport's best-known games can't be found.** Sports. z-nfl-first, z-nfl-shelf, z-nba-first, z-nba-shelf.
- Wrong: season-long fantasy, best ball, head-to-head points and the survivor and confidence pools live on a league's week and are
  dropped from a team's gallery without a word (sport.ts:97); searching "best ball" there says "No game by that name here". A team's
  gallery has four categories to a show's nine (no Head to head, Bingo & trivia, Party, Just you or Big season), and its chips don't
  say what their sections say ("Predictions" opens "Props and brackets", which holds no bracket).
- Change: the league's games sit in their categories as squares with a quiet tag saying where they play ("NFL-wide ›"), opening that
  page's gallery on the game, and search finds them from any page. A sport keeps the show's categories and names, each filled from the
  sport or shown as dashed Coming squares with what brings them, never missing; a chip and its heading say the same words. MLB and a
  league's week get frames before sports count as covered.

**5. A sport's saved game can't be opened.** Sports. Seen live on the Eagles' Game-night draft.
- Wrong: the heart says "Saved. It's in Community and saved games"; the saved row then reads "That kind of game isn't in the gallery
  any more" and a tap does nothing. Saved games are looked up in the show catalog only (saved.ts:131).
- Change: saved games are looked up in the page's own catalog, sports included; until then the heart doesn't show on a sport's
  screen.

**6. Keyboard focus is invisible on the lead tiles and the outlined buttons.** Both. Seen live on the lead tiles (leads.tsx:250), Try
it, Wait for riley, the heart and Ask the couch first.
- Wrong: their edges are drawn with an outline, which replaces the focus ring, so focus changes nothing; elsewhere the ring is the
  browser's 1 px, not DESIGN.md's 3 px (WCAG 2.4.7).
- Change: one focus style across the sheet, a 3 px chyron-line outline offset 2 px on focus-visible, with the outline-drawn edges
  moved to a border or an inset shadow; inside the white ready plate, a 3 px plate-line ring.

**7. Invented popularity on the ready-made games.** Shows. g2-ready-open, n5-open-saved, y9-makeit ("Ready games like it").
- Wrong: "Survival pool · Made by us · 178": the heart counts are made up from each game's name (model.ts:395, "Made up for the
  frames… there's no community yet"). PRODUCT.md rules out invented counts; here they read as other couches' approval.
- Change: no counts until real ones exist; each row keeps its base and "Made by us".

### P2

**8. The gallery's first view runs over, says one thing twice, and its lead recedes.** Both. g1-first, g2-ready-open, bd1-first,
c42-first.
- Wrong: the saved row ("22 made for Survivor 51") and a lit chip ("Community & saved 22") stack one over the other, and the chip
  stays lit while Fantasy fills the screen (bold-sheet.tsx:544): seven chunks to R1's five. The lead, each category's stage, is a dark
  well under raised squares, and the 30 px category heading outshouts its 26 px name ("FANTASY LEAGUES" over "FANTASY LEAGUE", in
  every category).
- Change: drop the Community & saved chip (the row is its way in; the chips are kinds of game), and light only the chip whose heading
  is in view. The lead takes the squares' raised fill without the outline, its name at 28 px; the category heading drops to the 24 px
  section heading. At 844 only the squares' top edge shows.

**9. The length mark breaks the gallery's grammar.** Both; worst on sports. g1-first (the whole sheet), z-nfl-first, z-nba-first.
- Wrong: a short game's length is a bone fill ("1 GAME", "1 EPISODE"), the fill this gallery uses for "chosen" (parts.tsx:17–24);
  "Season" sits on about 45 show squares; on a team's page nearly every square carries "THEIR GAMES" or "1 GAME", and "their" names
  nobody.
- Change: one outlined caps tag in muted ink, only where a game's length differs from the page's usual; no "Season" on a show's
  squares; "Eagles' games" where the team must be said.

**10. A story show is dealt competition games and the same picture again and again.** Story shows. bd1-first, bd2-base.
- Wrong: Below Deck's leads are Outlast, Survival pool ("Who stays?") and Match the majority ("Who goes home?") where the spec named
  Weekly picks, the show's calls and Bingo; Bingo, the show's calls and Big season fall back to the same crew strip when the season
  has fewer than eight moments (leads.tsx:160–175); four of the strip's faces were blank squares when shot (photos not yet in).
- Change: on a story show each category leads with its story game (Weekly picks, "who scores this week"; the show's calls as their
  questions; Bingo); a short card fills from the season's moments plus Your own moments' suggestions as dashed cells, never faces; one
  face strip per screen at most; a face shows the person's initial until its photo arrives.

**11. Names collide, a changed game keeps its old name, and search hides its reason.** Both. b1-outlast with the Pools shelf's Last
one standing (y1-pools), y9-makeit, y13-aka.
- Wrong: Outlast is "also called… last one standing draft" (known.ts:12) while Last one standing is another game; after More
  competitive makes a Fantasy league head to head, the toast and the rule say so but Start still reads "Start Fantasy league" and the
  title card keeps its name and Also called; "eliminator" finds Survival pool without saying why.
- Change: Outlast drops that name. A changed game takes the wizard's "Your version" tag on its title card with the change in a line
  under the name, hides Also called, and Start reads "Start your version". A search hit found by a fan's name says "Also called
  eliminator pool", the match in bold.

**12. The pool lead marks an unaired pick with a result.** Shows. y1-pools (leads.tsx:133).
- Wrong: under "EP 9 · TONIGHT 8 PM · WHO STAYS?" one face carries the teal tick that means a pick stayed; before the episode airs it
  reads as a hint or a result.
- Change: draw the pick as chosen, a white ring (the game page's chosen), and keep teal for results.

**13. The change screens' controls are under 44 px.** Both; from code, as no frame opens them. Segments 40 px (parts.tsx:350), chips
36 px (:367, :372), steppers 40 px (:419, :423), the field's Clear (:66).
- Change: 44 px for each, DESIGN.md's target.

### P3

**14. Reading text under 15 px.** The game's core rule (bold-sheet.tsx:914) is 14 px muted and Also called 13 px muted (y8-fantasy,
b1-outlast). Change: 15 px in plain ink, as the squares' lines are now.

**15. Clipped text.** Pick'em's dates (z-nfl-first; leads.tsx:238) take the calm short form ("Fri 27 · 9:31 AM") in a column sized to
it; Below Deck's Big season labels (bd1-first) take the stage's short name, its start on the second line; a sport's Betting pool line
becomes "Bet points on the total or the margin".

**16. Words.** "Next: now Best ball: no lineups to set" (ladders.ts:45–49, every "now …") becomes "Next: Best ball, no lineups"; Big
season's "game one" beside "game 2 · the merge" (leads.tsx:169) becomes "Game 1 · to the merge", "Game 2 · from the merge"; "The
details · The draft's time" (y10-rules) becomes "When the draft opens · who can join".

**17. Small grammar.** The Save toast (n5-open-saved) is on the quiet tag where Make it…'s is on the teal check: one confirmation,
the teal check. The Challenge 42's Split the pot lead draws a bank bet ("Bet 50 of 100… you have 150") over "Everyone right splits 10
points" (c42-first; leads.tsx:138–147): the lead draws its own game's bet. A base's screen stacks the sheet's "Start a game" header
over the title card (b1-outlast): the title card can carry Back and Close over the art and give the first view back about 70 px.

## Where shows and sports diverge

**In feel:**
- The title card: the show's art behind the name; on a sport, a bare panel.
- The lead pictures: faces, questions, a card of moments, the couch paired off; on a sport, grey position chips, plain schedule rows
  and a squares corner with one team.
- The ready plate: a quiet tag on both; no team colour on a sport.
- Length marks: a quiet "Season" on a show; a white chip on nearly every sports square.
- Words: the show's own; on a sport, "airs", "aired", "once you've watched it", "The show's points".

**In navigation:**
- Categories: nine on a show, four on a team's page.
- Chips: a show's chip names its section; a sport's doesn't ("Predictions" opens "Props and brackets").
- League-wide games: every show game is in the one gallery; a sport's season-long games are on another page, unsaid.
- Saved games: a show's open; a sport's can't.
- Make it…: two or three live goals on a show; one of three on Game-night draft ("No other way to score this one here").
- How long: a show's stages over the strip; none on a sport, and the spec's "Against a rival" isn't there.

**The same on both:** the sheet and its levels, the field, the ready plate's place, the chips' place, Back, Your own moments, Describe
and Surprise me, the Start bar.

## Left open

- **A choice for the user: the title card.** A base's screen opens "as the started game's own page will look", but the game page
  dropped its title card in the design round's step 2 (`src/new/show/game-page.tsx:290`; DESIGN.md, Motion, "A game's own page") and
  drew its art in full colour, where this is greyscale. Either the game page gets its title card back (both at DESIGN.md's 64 px, 48
  px when long), or the wizard's title card is its own part and DESIGN.md records it at 52 px and 44 px.
- **Still the user's, from Round 2:** when the recommended lock costs someone a move, should the game start on When you've watched
  it? Finding 1 shows the cost either way.
- **Outside the gallery:** the shared sheet's 40 px Back and Close; the bounce easing in the shared toast, the show bar and
  `new.css`; the show bar's no-art stand-in on a sport (a 2.1:1 doubled title); DESIGN.md's type ramp (12, 14, 17 and 20 px in wide
  use, plus this sheet's 21 and 30 px).
- **The build's stand-ins:** Try it's practice copy ("Round 2: the practice copy…") and the started step's raw spec.
- **Not shot:** MLB; a league's week; the gallery as someone behind (sam, riley); the change screens.

Questions skipped: run as a subagent with no way to ask the user; the choices above wait for the round's screenshot story.

## Fixed in the one batch (with PFD's evaluation's, [wizard-r2b-pfd-eval.md](wizard-r2b-pfd-eval.md), 62/100)

- **The lock's cost is where Start is.** The Start bar's line says who'd miss moves and carries Wait for them; Start's would-make
  screen says it too (the ready plate's one tap reaches it). The title card is tighter, so How long is back in the first view.
- **Sports carry their own identity.** The teams' marks (TeamMark, from ESPN's team lists) on the lead tiles, the title card and the
  matchups; the ready plate's tag in the home side's colour; the squares grid drawn the right way round (one team across, the other
  down, the last digit).
- **Sports speak sports.** "Played", "Last · Game 7", "Every game left", "When the next one starts", "once you've seen it",
  "Standard points"; a length never shown as a rule's value ("Your team · Draft 3", not "Game 5"; not "All season" on a show either).
- **Every game type on a team's page.** Season-long fantasy, best ball, survivor and confidence pools sit on the shelf dashed, each
  saying which page it's made for; the chips say their headings' words (Pick'em, Props, Betting).
- **Make it… on sports** steps between a sport's own game types (pick'em to winner and margin, props to a parlay, a draft to Pick a
  few), so the three buttons work as a show's do.
- **Saved sports games reopen** from the sports catalog.
- **Focus** shows on every lead tile, square, rule, Make it… row, heart and fix (a 3 px chyron-line ring).
- **No invented counts:** the made-for games' hearts show only your own save; "Most saved" is gone until couches share.
- **One grammar:** the lead tile on the squares' surface; a length mark outlined (never the chosen fill) and silent for the whole run;
  what can't play here after what can; no chip lit until a category's heading passes; one name for the section ("Community and
  saved"), always shown, "Nothing saved yet" when empty.
- **Shows:** Outlast's other name no longer names another game; a story show's pools ask who scores and its predictions lead with
  the show's calls; a pool's pick is marked as a choice (bone), not a result (teal); search says which fan's name matched; a
  changed game's Start says "Start your …"; the change screens' controls are 44 px; the title card's art at half strength.

## Still open after the batch

- **Choices for the user:** the title card here, where the game page dropped its own in step 2 (bring it back there, or record this
  one in DESIGN.md); Round 2's default lock; whose points a couch's own moment is in a player draft (PFD's rule question).
- **Not fixed:** the dash's several meanings; the couch's initials in two colours; two toast styles; Split the pot drawn as a bank bet;
  some 13 px reading text; clipped dates on the strip.
- **Not in the frames:** MLB, a league's week (a slate), a person who's behind starting the game, a real league's colours (the
  stand-in's are ESPN-shaped; the payload carrying them is the plan's E10).

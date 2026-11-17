# The castaway sheet scored by the show: Perception-First Design evaluation

Built frames at 390 × 844 under `.ui-atlas/stories/person-sheet/score/` (Survivor 51 at Ep 7, Survivor 49's winner through the
finale, The Traitors 5 at Ep 3; the zt couch as alex, sam and riley; a made-up 30-episode season and amount), against `before/`,
judged by [the spec](drill-person-sheet-scoring-spec.md), [the first-view requirements](drill-person-sheet-scoring-first-view.md)
and DESIGN.md's Colors and Do's and Don'ts. Mode 1, run once; nothing edited but this file and the PFD plugin's insight log (entry
at the foot); the corpus' HTML rebuild was skipped under the round's one-file rule, so fixes are in design terms. Class colours from
`new.css` (Night teal #35b5a5, grey #75708a, Ember #f2804b; the red option #f2545b), all configured tokens (the Tailwind profile's
off-palette check passes); distances are OKLab ΔE×100 under Machado (2009) colour-blind simulation on the sheet's #221f2c.

## Score: 74 / 100

| Layer | Score | Why |
| --- | --- | --- |
| Foundation (L0) | 76 | One key line of fixed words (three lines of names before), three chart colours (four hues), Counted by gone, a player's games whole in the first view; a shared game's holders repeat one fact four times, and the who block pushes a game page's number under 600 px |
| L1 first impression | 80 | Her face opens every sheet in one place; the chart's glance answers "doing well?" by position and colour (teal on the line, Ember hanging under it) where before it named kinds; but a winner's sheet glances as eliminated, and an amount's figure outranks her name |
| L2 fluency | 76 | One class mark (a piece of bar) in the key, the rows and the story; one signed format; ⌄ and › keep one meaning each; Ember clears the colour-blind floor; but a rank in three forms, a door outside its block, a chevron over an amount, the 30-episode chart off the rail |
| L3 prediction | 64 | Up is good and down is bad, red stays for leaving, every row shows its worth and the caption says the order; but the winner is marked "went home" in red, and the rows' worth isn't named as the show's beside games that count differently |
| L4 decisions | 74 | Points and place on every game row, the game you came from first and open, its weeks on the chart's own columns; the board two taps away, its door under the strip; but that number lands at 630 px, Outlast opens to almost nothing, "See everyone" has weak scent |

(76 × 1.5 + 80 + 76 + 64 + 74) / 5.5 = 74.2. No caps (nothing under 40, nothing critical); the 16-point spread is L3 carrying the
one major. Closest anchor: "good"; the last round's built sheet scored 72. Ethics: Alignment and Golden Rule pass, no pressure
anywhere; Sincerity wobbles once, on the winner (#1). Spoilers hold: sam-sheet stops at Ep 3 (four moments, Weekly Lineup +6.5),
Ada's role stays secret (riley-traitors), Xavier's shows once he's gone (real-xavier).

## Requirements

| | Met? | Evidence |
| --- | --- | --- |
| R1 key one chunk; a row two things; four blocks | **Met** | One key line, the same three words on every sheet (real-sharonda, real-xavier, riley-traitors, fx-30); rows read name and count, worth and rank muted; first views hold who, the chart, then Their numbers (watcher) or In your games (player), plus the figure only on an amount show (fx-amount: four) |
| R2 the glance answers "doing well?"; the face anchors; a figure under the name | **Partly** | Position and colour both carry the class in every frame; the face at 194–290 px, 221–317 under a crumb. But real-savannah glances as "went home" (#1), and fx-amount's figure is set larger than the name (#5) |
| R3 one form per fact; a piece of bar; ⌄ in place, › a level; ΔE ≥ 12 | **Mostly** | The bar mark in key, rows and story, apart from the tribe's square; "+2 each", "−0.5 each", "+7.5"; chevrons right everywhere; Ember's tightest pair is teal against Ember, 12.5 for protan eyes (Studio's 9.5 waits for Studio). Drift: a rank in three forms (#9), a door off its block (#8) |
| R4 every order keyed; no borrowed colour; the worth named as the show's | **Partly** | "Most valuable first" and each row's worth; the classes in the stack's order; Ember keeps red for leaving. But the winner wears the leaving red (#1), the worth is never named as the show's (#4), and the red option borrows "went home" (#2) |
| R5 Joanna and Andrew with no tap; Conor two taps, the door under the strip | **Mostly** | Every game row carries points and place (fx/cast-sheet, 610–765 px); game-sheet opens Weekly Lineup first, its bars on the show chart's columns (the same x for every episode); real-sharonda-open goes row, strip, "See everyone ›", board. But the number sits at 630 px (#3), and Outlast's open row has no weeks (#6) |

## The measures

- **Met:** her face within 300 px (194–290 from the Cast tab, 221–317 under a crumb); the key one line, two with "went home"
  (real-savannah, real-xavier); no chart colour but the three classes and the went-home red (every Ember frame); a watcher's first
  numbers row in view (real-sharonda 635 px, real-savannah 552, real-xavier 556, real-danny 603, riley-traitors 529); every row's
  worth (every frame; a worth of 0 says "No points": real-xavier, fx-30); ⌄ only in place and › only a level (numbers and game rows
  ⌄, turning over once open; See everyone, holders, the figure and board rows ›).
- **Not met:** the opened game row's number above 600 px from a game page (630–644 px in game-sheet and outlast-sheet; production
  had 225); no words over words in fx-amount-board, where the chevron sits on the last digit of "10,150" (the overlap check passes
  every frame because the chevron is an icon, not text; #7).

## Findings (most severe first)

1. **Major, L3 · L1: the winner reads as voted out (real-savannah).** Survivor 49's Sole Survivor has a grey photo, "Out · Ep 13 ·
   Sole survivor", the axis's 13 in Live Red and "Ep 13: went home" in red under the key. Here red means eliminated, and colour is
   read before words, so Joanna's "is she doing well?" gets the opposite of the season's biggest fact before "Sole survivor" is
   reached (Lindgaard 2006; Clark 2013); the Ember setback under Ep 12 hangs beside the red 13 (ΔE 6.3 for deutan eyes), one exit.
   Finalists would get the same. **Fix:** the finale isn't an exit: a winner's or finalist's last column and the key's second line
   carry the show's word ("Ep 13: Sole Survivor", "Runner-up") in the foreground, the photo stays in colour and the status leads
   with it; red only for an elimination, in the show's own word ("Ep 3: murdered").
2. **Major if chosen, L3 · L2: the red option (fx-red, real-sharonda-red).** Red blocks under Ep 5 and 6 on a castaway who's still
   in predict "went home" twice (Clark 2013), and on anyone who has left a setback and the exit would share a colour in one chart
   (Savannah's 12 and 13). It fails R3's floor too: teal against red 10.3 for deutan eyes, the grey against red 8.1 for protan
   (Bujack et al. 2022). Ember's one cost is small: it's also sam's face colour (sam-sheet), which DESIGN.md allows a chart colour.
   **Fix:** keep Ember, the default, and drop the option (the user's named choice; PFD's answer is Ember).
3. **Minor, L4 · L0: the game you came from sits at 630 px (game-sheet, outlast-sheet).** Andrew's "+7.5 · 2nd of 18" is in the
   first view, so R5 holds, but 30 px under its measure; a real castaway's longer who block (Sharonda's start, holding and two-line
   bio) under a crumb would put it near 660 px, the row's weeks under the fold. The season first is the round's accepted cost; the
   lost margin isn't (Cowan 2010). **Fix:** from a game page the opened row takes In your games' heading's place (the crumb names
   the game; "Points there" rides the number), the heading moving under it to head the other games: the number near 595 px.
4. **Minor, L3: the show's points aren't named as the show's (fx/cast-sheet, game-sheet, outlast-sheet).** On a player's sheet
   "+4 each" sits a screen under "Points there" from games that may count differently: Outlast says +6 where the rows' worth sums
   to 7.5. A worth near a game's number predicts that game's scoring, the violation R4 was written for (Clark 2013). **Fix:** on a
   player's sheet Their numbers' caption names the scale, "The show's points · most valuable first"; a watcher's stays as it is.
5. **Minor, L1: the figure outranks her name (fx-amount).** "7,550" is set at 28 px bold against the name's 26 px (numerals 19 px
   tall, the caps 18), so on a Below Deck sheet the eye goes from the face to a number with no subject before the name answers
   "who's she?" (R2; Lindgaard 2006). Its strip floats with no baseline, in Bone, a face colour. **Fix:** the figure set under the
   name (22 px), its strip standing on a hairline on the chart's columns: face, name, then figure.
6. **Minor, L3 · L4: Outlast opens to almost nothing (outlast-sheet).** From Outlast's page its row opens to one holder line,
   "riley · On riley's team", under a row that already says "On riley's team": no weeks, so "+6" against the show's 7.5 has nothing
   to explain it, and open looks like closed (Green & Swets 1966). **Fix:** Outlast's weeks under its row on the chart's columns,
   as Weekly Lineup's are; a game with no weeks to draw makes its holder the row's own face (a door), and its row carries no ⌄.
7. **Minor, L2: a chevron over an amount (fx-amount-board).** "10,150" runs under its row's ›, the number column sized for counts
   of one or two digits; a glyph on a glyph reads as breakage, not a door (Reber & Schwarz 1999). **Fix:** the number column sized
   to the board's widest value, the bar giving up the room.
8. **Minor, L2 · L4: "See everyone" reads as a list row (real-sharonda-open, fx-open, fx-30).** The door starts at the list's edge
   (16 px, under the class marks, not the names' 28 px), bold, between two hairlines, so the strip and its door share no region and
   it reads as the next item; "everyone" doesn't say what's ranked (Wertheimer 1923; Pirolli & Card 1999). **Fix:** the door
   inside the opened block at the names' indent, no hairline between it and the strip, named for where it goes: "See all 21 ›".
9. **Minor, L2 · L3: a rank in three forms (real-sharonda, real-stat-level, fx/cast-sheet).** Sharonda's reward wins are "10th
   most, tied with 4" on the sheet and "T10" on the board a tap away; games say "2nd of 18" and "T1 of 18"; and "of 21" ends the
   numbers' caption over the count column, where "2 of 21" is the easy read (the last round's #1, softer; Reber & Schwarz 1999).
   **Fix:** one form, the games' and the board's: "T10 of 21" as the row's second line, and "of 21" leaves the caption.
10. **Minor, L0: a shared game's holders repeat one fact (game-sheet, cast-in-game).** Opened, Weekly Lineup says "On every team ·
    +7.5", "Counted for you every episode", then four rows of "+7.5 · Counted for [name] in 5 episodes", pushing Outlast and Their
    numbers down (Cowan 2010; Sweller 1988). **Fix:** when every holder's number is the row's, the holders are the row's own faces
    (each a door) under one line saying so; rows only when they differ.
11. **Cosmetic, L2: the 30-episode chart stops short (fx-30).** Its baseline ends at 346 px, the 7-episode chart's at 371: one
    chart on two widths (practitioner observation, after Learning #16). **Fix:** every chart on one rail; at 30 the gaps grow.

Carried over, unfixed: the board's framed row 6 px off the rails, her bar 6 px short of an equal count's (real-stat-level; the last
round's #7), and its lens's "Who has them in: Nobody", an answer, not a choice ("No game"). Not ranked: from the Cast tab the row
where she's yours comes second (fx/cast-sheet); grey is most of every chart (28 of Savannah's 39), so the glance rests on the teal.

## Top three fixes

1. **The finale isn't an exit (#1).** L3 about +6, L1 +2: the one false glance goes, and the key's second line speaks the show.
2. **Andrew's number above 600 px, the show's points named (#3, #4).** L4 about +3, L3 +3, L0 +1.
3. **One form per fact (#7 to #11).** L2 about +4, L0 +2. Keeping Ember (#2) costs nothing; red would take L3 down about 10.

## Insight log entry (appended to the PFD skill's `references/insights-log.md`)

### 2026-11-17 — Mode 1 evaluation of a fantasy TV app's castaway sheet scored by the show (three value classes), 390 × 844
**Type:** image
**Domain:** consumer mobile app (reference detail sheet with a per-episode value chart)
**Key finding:** An exit marker keyed to "the last episode they were in" (live red, "went home") misfires on the season's winner,
who also stops at the finale: an end-state code needs a non-exit terminal, or the glance states the opposite of the biggest fact.
**Layer(s):** L3, L1
**Promote?:** maybe
**Notes:** An overlap check over text boxes passed an icon drawn on a number (cf. 2026-11-15's exact-token counter: checks testing
the wrong primitive). A size rule relative to another element ("under her name") was inverted by the shape step's absolute scale
(28 px against 26). The red option fails the colour-blind floor on two pairs, so meaning and colour vision agree on Ember.

*Initial findings. Ralph Loop a layer score, cite further, switch to solve / analyze, or ask any follow-up to dig deeper.*

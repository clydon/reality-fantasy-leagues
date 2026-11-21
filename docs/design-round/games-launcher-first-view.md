# The Games tab as the way into games, first view: requirements

Mode 2 derivation on [the page spec](games-launcher-spec.md), at 390 × 844, building on Phase 0's app-wide
[R1–R5](phase0-first-views.md) and Tonight's night ([its first view](tonight-night-first-view.md): the row the longer games share).
Today's frames: `.ui-atlas/stories/games-launcher/before/` (story-games-launcher.js): `week` (jordan, three games, a one-episode
game to play and one to join for Ep 7, a season game to join, one starting later), `watcher` (casey, plays nothing), `busy` (seven
games), `behind` (sam), `patterns` (a game of every main block), `draft`, `sport`, `short` (three one-episode games an episode for
20 episodes), with their words in the `.txt` beside each.

## The problem

Someone opens Games to find something to play: tonight's one-episode game, a game the couch started, a way to start one. Today
jordan's tab (`week`) is 2,577 px: Ep 7's one-episode game sits in the first view, then three season games at about 300 px each
(a place line, a move card with faces, a four-row leaderboard, Last picks), then Ep 6's results, Starting later, and only at
2,100 px the two games jordan could join, both called "Survival Pool". Casey, who plays nothing (`watcher`), meets seven games to
join, each about 160 px with a yellow Join: five yellow fills in two screens, four games called "Survival Pool" and two "Weekly
Lineup", told apart only by a sentence of small print. Seven games (`busy`) run the tab to 4,006 px.

## L0 · Cognitive load

**Constraint.** Working memory holds three to five chunks, and unattended noise still spends it.

**Violation.** `week`'s first view is four chunks, but the tab behind it is fourteen: three leaderboards of four rows each (twelve
people-rows nobody came here to read: Tonight and each game's page hold them), Last picks, Teams, the results, two kinds of Start.
`watcher` spends each joinable game on four lines (name, tag, sentence, button), so two games fill a screen.

**R1.** The first view holds four chunks: the bar with the progress control, the strip, the next episode's one-episode games as one
block (yours, the couch's, Start one), and the head of your longer games. A one-episode game's row is at most 60 px; a longer
game's row at most 64 px (Tonight's row); a game to join at most 64 px with its button on the row. With three longer games, all
three are in the first two screens, and jordan's whole tab is under 1,400 px. Seven games hold the height of five (four rows and a
fold). Casey's seven games to join fit two screens. No leaderboard, no faces past four in a row, at most five type sizes.

**Citations:** Cowan (2001) for the three-to-five chunk ceiling; Hassin et al. (2009) for unattended noise spending working memory.

## L1 · First impression

**Constraint.** Meaning is judged in about 50 ms; faces are processed first and fastest.

**Violation.** The first thing under the strip is "EPISODE 7 · Sat 7:21 AM · 1 game" and a row of four dashed placeholder tiles:
the faces of who's in are there, but as dashed outlines at 22 px (everyone "not in yet"), so the first 50 ms reads as empty. For
Casey the first thing is a game's base name and a tag ("Exclusive"), not who on the couch is playing it.

**R2.** Under the strip, the first thing is the next episode named with when it airs, then its first game: its own name and the
faces of who's in it, real faces at full strength (who hasn't moved yet is said in words, not by fading the face). On a game to
join, the faces lead the second line: who's in is the reason to join (the round's spirit: friends are the reason). The tab opens on
people and a near episode, never on a number or a tag.

**Citations:** Lindgaard et al. (2006) for the 50 ms judgement; Leder et al. (2004) for perception before classification.

## L2 · Processing fluency

**Constraint.** One form per fact reads as true; a second form costs a re-read and erodes trust.

**Violation.** The same game is named three ways: "Who goes home? Ep7" (its own name, with its episode), "Survival Pool" (its base,
in Also on the couch) and "Episode 7 only" (in the sentence). A game you play is drawn two ways (the night row, the season card),
and Tonight draws it a third (the row led by its name and length). A due move is yellow in the strip and a yellow dot on two
cards, and on Casey's tab yellow is five Join buttons. Places are said in two forms ("1st of 4 · 25 pts" and the leaderboard's
"1 You 25").

**R3.** Each fact has one form, the same on Tonight and here. A game is called by its own name everywhere; when two longer games of
one kind are on the couch, each by its couch name ("Second Chance Pool"), never two rows reading "Survival Pool". A longer game's
row is Tonight's: the name in caps and its length on the first line, faces and a few words on the second, the measure on the right.
A one-episode game's row is one part for yours and for the couch's, differing only in its button (your move, or Join). Your place
is said once, in its row's right. The yellow fill is the strip's alone: Join, Pick and Answer are outlined; a due longer game
carries the strip's small dot.

**Citations:** Reber and Schwarz (1999) for one form reading as true; Alter and Oppenheimer (2009) for the cost of a second form.

## L3 · Prediction

**Constraint.** People act on prediction and notice only what breaks it.

**Violation.** A season card has four targets (its name, the move card, a leaderboard row, the Last picks fold) that look alike.
The two Start rows sit far apart (the next episode's Again chips mid-page, Start a game at the foot) and say different things
("A season game for this show"), so Conor, looking for a one-episode game to start, finds the season one.

**R4.** Every row predicts its target. A longer game's whole row opens its game's page (its draft room while it drafts), with a
chevron. A one-episode game's name opens its page and its button the move; a game to join's button opens Join's sheet. A dashed
row starts something, and it says which kind: "Start a one-episode game · for Ep 7" in the episode's block, "Start a longer game"
after the longer games. Again sits with the first Start (it starts the same kind again). A link from elsewhere (?game=<id>) lands
on that game's row.

**Citations:** Clark (2013) for prediction and its violations; Nisbett and Wilson (1977) for behaviour over stated preference.

## L4 · Decision

**Constraint.** One decision per view, with what decides it beside it; no manufactured urgency.

**Violation.** Casey's decision ("is there something I'd play?") is spread over seven equal cards, each with a full-weight yellow
button and none saying who's in; the deciding fact (riley and sam are in it, it locks before Saturday's episode) is missing or in
small print. jordan's decision ("am I set for Ep 7?") shares the view with leaderboards that decide nothing here.

**R5.** The tab's decision is what to play next, and the easiest step decides first: the next episode's one-episode games lead,
yours and then the couch's, then your longer games, then longer games to join, then Start. Beside each offer, what decides it: who's
in (faces), what it asks ("One pick"), when it locks (a real time). Nothing else presses: no count of open places, no countdown, no
"last chance", no badge on Start; the record says firsts plainly and never what you missed.

**Citations:** Iyengar and Lepper (2000) for one decision at a decision point; Trope and Liberman (2010) for concrete words on a
near-term step ("One pick · locks Sat 7:21 AM") over abstract ones ("a season game").

## The first views, then

**Caught up, three games (jordan).** The bar and control; the strip; "For Ep 7 · Sat 7:21 AM"; Who goes home? (your faces of who's
in, "Pick before you watch", Pick outlined); Who survives? (riley's and sam's faces, "One pick · locks Sat 7:21 AM", Join
outlined); Start a one-episode game (dashed, one line) with Again; the extras' quiet fold; "Your longer games" and its first row
at the fold. Must not: a leaderboard, the results, a yellow button.

**Watching only (casey).** The bar; "For Ep 7": the couch's one-episode games with faces and Join; Start one; "Longer games to join"
and its first rows. The eye: faces of friends, the game's own name, Join.

**Seven games.** The same, with four longer rows and a fold row naming the rest.

**Behind (sam).** His next episode's block (Ep 5), an aired episode waiting on his reveal as one folded line; his longer games at his
mark.

**A draft on (alex).** The draft's row in Your longer games: "OUTLAST · Season", "You're up · R2 pick 7" with the strip's dot, the
room a tap; a draft not started says when it starts.

The eye's order everywhere: the next episode → who's in (faces) → the one button → your longer games → the ways in.

## The gap

The spec named a game to join by its base ("Survival Pool") and drew it under its own block: R3 asks for the couch name when two of
a kind are on the couch, and R2 for faces leading its second line. Both are taken into the spec's block 4 row.

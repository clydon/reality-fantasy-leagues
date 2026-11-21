# Tonight's games, the night: first-view requirements

Mode 2 derivation on [the page spec](tonight-night-spec.md), at 390 × 844, under Phase 0's app-wide
[R1–R5](phase0-first-views.md) and step 3's [Tonight requirements](step3-tonight-first-view.md), which still hold for the blocks
above this section. Today's section is measured from a real phone (Survivor 51, Ep 9, the couch's three games, 2026-11-21).

## The problem

The day after an episode, someone opens Tonight to find out what the night did to them in each game, and how their friends did.
Today each game is a mini of four or five lines of text in one shape: a big place, a line under it, a result line, an episode tag.
Three of its facts say themselves twice ("streak 8" in the place line and the result line; "3 of 3 still in" twice; "Ep 9" on every
result line beside a section that is all Ep 9). Castaways are names in a sentence ("+4 · Mike +2 · Thien +2 · Jelly 0"), never
faces. Nobody else on the couch appears except one gap line ("12 behind …"), so the social half of the night, who picked whom and
whose pick went home, isn't there at all. A game with news looks exactly like a game without any. Three minis take about 555 px,
and each added game adds about 185.

## Foundation · Cognitive load

**Constraint.** Working memory holds three to five chunks, and extraneous load (the same fact twice, a label that adds nothing)
spends the same capacity as the task.

**Violation.** The three minis hold about fifteen lines and nine distinct facts, four of them repeated. Adding everyone's picks to
the closed card the same way (five people, three to five faces each) would put twenty-plus faces in front of someone who asked one
question: "how did my night go?"

**R1.** A closed card holds three chunks and no more: your standing (place and its movement, bound as one), your night (the change
and your picks' faces, bound as one), and at most one line about the couch. Everyone else's picks appear only when the card opens.
Each fact is said once per card; the episode is said once, in the section's heading, never per card. A closed card is at most
170 px tall at 390; past three season games the rest fold to one row; past three quick games likewise; the extras are one card.
Open, a card shows at most five people.

**Citations:** Cowan (2010) for the three-to-five chunk ceiling; Sweller (1988) for repeated facts as extraneous load.

## Layer 1 · First impression

**Constraint.** The gist of a view forms in about 50 ms, and only what is prominent gets interpreted at all; feeling arrives before
words (a loss is felt before the sentence saying it is read).

**Violation.** Every mini has the same silhouette, and every outcome is a word ("Survived", "All safe"), so the eye can't tell which
game had news without reading each one. The section has no faces, so nothing in it is recognised at a glance, and the one thing that
should be felt first (a pick that went home, a castaway lost) has no mark of its own.

**R2.** Each card's outcome reads before any word is: your picks are faces (cast photos), each carrying its result as a mark on the
face (a pick that stayed: a teal check; one that went home: a live-red cross and the face greyed; a lineup's starter: its points
under the face); the movement is a glyph beside the place (up in teal, down plain, held as a dash); a card where nothing happened to
you is visibly quieter than one with news (no arrow, no red). One large number per card, the place; every other number is small.
Motion, the strongest pre-attentive cue, is spent on the one change on each card, once per episode; motion everywhere, or every
visit, lowers the signal of the motion that matters.

**Citations:** Lindgaard et al. (2006) for the 50 ms gist; Green & Swets (1966) for the one change's signal against everything
else that moves or shouts.

## Layer 2 · Processing fluency

**Constraint.** What is easy to process feels true and is trusted; elements that look alike are read as alike.

**Violation.** Today's minis vary their lines by game in free text (a streak sentence, a points sentence, a still-in sentence), so
each is read as prose. The ledger ("Who scored") draws a third form. The reveal, the person sheet and the game's episode sheet
already mark the same results their own way (NightBadge, Tick, the ledger's bar).

**R3.** One grammar for every game kind, in the same places on every card: head (the game), standing (place, movement, of how
many), your night (change, then faces), the couch line with the open control. One result vocabulary across Tonight, the reveal and
the sheets: the same check, cross, greyed face and bar as the person sheet and the episode sheet. Inside an open card, every person
is one row in one form (place, movement, face, name, their picks, their change), your row in it like theirs and marked, every
number in a card on one scale. The open card is an excerpt of the game's episode sheet, so See all lands on the same rows, longer.

**Citations:** Reber & Schwarz (1999) for ease of processing read as truth; Wertheimer (1923) for alike-looking things read as
belonging together.

## Layer 3 · Perception bias

**Constraint.** People arrive with a prediction ("did my pick survive?", "did I pass Riley?"); a match is skimmed and a surprise
draws attention. Social proof works when it's real, and a loss weighs about twice a gain of the same size.

**Violation.** The minis answer what a person already predicted at the same weight as what they didn't, and the surprises (someone
else's pick went home, someone passed you) aren't there. What people say they'll do ("I'll open every game") isn't what Joanna and
Andrew do: they read the closed state and leave, so anything only inside a card is unseen by them.

**R4.** The closed card answers each person's own prediction first (their place and their picks), and puts the night's one surprise
about someone else in the couch line, with that person's face. Cards with news come before cards without. Everyone shown is a real
person on the couch, by face; there are no counts of strangers. A loss is shown as the fact it is, the same size as a win, and
nothing amplifies it (no red fill, no "ouch"). The open list compares you with the person you could pass next, not only the leaders.

**Citations:** Clark (2013) for a prediction met being skimmed and a violated one drawing attention; Cialdini (2001) for social
proof that works only when genuine; Kahneman & Tversky (1979) for losses weighing more, which is why they're stated, not stressed.

## Layer 4 · Decision architecture

**Constraint.** The easiest path is the one taken; information scent (a label that says what's behind it) decides whether anyone
opens a door.

**Violation.** Today the mini's body goes to the game's page, a different place, while the depth people want (everyone's night)
doesn't exist; "Who scored · Ep 9" names only your own lineup. A watcher has no way in from Tonight at all ("Play a game on this
show" is on the Games tab).

**R5.** Depth opens in place: the whole closed card (but its head) opens it, and the open control says what's inside with the faces
of who's in it ("Everyone's night" beside the couch's small faces). The head alone goes to the game's page. See all names the count
("See all 10"); a fold names what it holds (each folded game's place as a chip). A watcher's way in is one row that shows what
joining asks (the game in plain words, "one pick"), who's in by face and when it locks, with Join as one tap that opens the move:
outlined, never the yellow that means something is due. Nothing on the row pressures: no countdown, no remaining spots, nothing that
returns after it's ignored.

**Citations:** Thaler & Sunstein (2008) for the easy path as the chosen one; Pirolli & Card (1999) for scent that decides whether a
door is opened.

## R1–R5, together

| | Requirement | Measured by |
| --- | --- | --- |
| R1 | Three chunks a closed card; each fact once; ≤ 170 px; fold past three; five people when open | words, repeats and height per card at 390; rows when open |
| R2 | Outcome before words: faces with marks, movement glyph, one big number; motion only for the change, once | a face per pick; one number ≥ 24 px a card; motion fires once per episode |
| R3 | One card grammar, one result vocabulary with the sheets and the reveal, one row form, one scale | the same slots on every kind; the same marks as the person sheet |
| R4 | Your prediction first, the surprise in the couch line, news cards first, real faces, losses stated not stressed | couch line present when there's news; card order |
| R5 | Open in place with scent; the head to the page; See all N; a watcher's honest one-tap Join | taps to everyone's night (1); taps to join (1) |

## The solution, at 390

**(a) A season game's card, closed.** About 160 px:
1. **Head** (44 px): the game's dot and name in muted caps, a chevron; the only door to the game's page.
2. **Standing** (one line): the place as the card's one big number (30 px), the movement glyph beside it (teal ▲2, plain ▼1, muted
   –), "of 5" small; at the right edge, the night's change in the game's own measure (22 px numerals: "+4", "8 in a row", "−1 in",
   "W 12–9").
3. **Your picks** (36 px faces): a lineup's starters with points under each; a pool's pick with its check or cross; a team's
   castaways still in, tonight's loss crossed in live red, earlier losses left off; up to five faces, then "+3". Each face opens its
   castaway.
4. **The couch line, which opens the card** (44 px): the news about someone else with their face ("Sam's pick went home"), or
   "Everyone's night" when there is none; the couch's small faces stacked at the right, then the chevron.

**(b) Open.** The card grows in place, its head fixed:
1. Your picks row grows into your night in full, the same faces now with names, what scored and step 3's bar on one scale (the
   ledger); a pool's pick with what happened; a team with who left.
2. **Everyone's night**: up to five rows of 52 px: place and movement, a 28 px face, the name, their picks as 28 px faces with
   marks (four, then "+n"), their change at the right, the couch's best night bright. Your row sits in standings order on the
   secondary fill. A dotted gap row marks a jump in places.
3. **See all 10**, when there are more than five: the game's episode sheet.
4. Open, a card is at most 560 px, so it fits one screen with its head.

Head to head: the open list is the episode's matchups, yours first, each two faces and two scores on one line, the winner bright,
opening the matchup sheet.

**(c) Order and the fold.** Cards with news for you first (a place moved, a castaway lost, a streak ended or grew, a matchup
decided), then the rest, each group in the Games tab's order. Three cards show; the rest are one 52 px row, "4 more games", each
folded game a chip with its dot and your place, opening them in place.

**(d) Quick games and extras.** A quick game's card is the same card: its standing is the result ("Riley won" with the winner's
face, your place small); past three, one row ("Ep 6's 5 quick games: you won 2"). The extras are one card, a line each (56 px):
Bingo, each player's three-by-three card at 22 px (ticked squares filled, counted lines drawn), the first line's person named;
Trivia, each player's score as three dots. Each line opens its sheet.

**(e) A watcher's Join row**, in Next · Ep N+1 beside the plans, the plans' own row height: the game in plain words ("Who goes
home? · one pick"), who's in as faces ("Riley, Sam and 2 more"), when it locks, and an outlined Join. Two rows at most; more as
"More on the Games tab".

**(f) Motion.** When a card is at least half in view for the first time after a new episode: the place counts from where it was
(600 ms), the movement glyph slides in after it (200 ms), a lineup's bars grow from zero (400 ms, 40 ms apart), a crossed face greys
(300 ms). Under a second a card; transform and opacity only; nothing for a card without a change; nothing with reduced motion;
remembered per device and episode.

## Earlier proposals against R1–R5

| Proposal | R1 | R2 | R3 | R4 | R5 |
| --- | --- | --- | --- | --- | --- |
| Today's minis | fails: four repeats, ~185 px a game | fails: names, no faces, one silhouette | fails: free-text lines by game | fails: no couch | fails: body leaves for the page |
| Closed = numbers only, picks inside (the first idea) | passes | fails: the outcome is a word or a number to read, the faces only after a tap | passes | partial: no surprise until opened | passes |
| The Games tab's rows (mini leaderboard, Last picks folded) | fails: four to five people closed | partial: faces only when unfolded | passes | partial: leaders only | partial: the fold names "Last picks" without whose |
| Top four and you when open | passes | passes | passes | partial: the person to pass next missing | passes |

## The gap

None of the earlier proposals carries the couch's surprise in the closed state (R4) while staying at three chunks (R1). The answer
is the last row doing two jobs: the night's news about someone else, with their face, is also the control that opens everyone's
night, with the couch's faces as its scent. The other gap is the open state repeating your picks: your faces row grows into your
ledger in place instead of a second copy appearing.

*Initial findings. Ralph Loop a requirement, cite further, switch to analyze / evaluate, or ask any follow-up to dig deeper.*

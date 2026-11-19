# Round 3, short games: Impeccable critique of the built screens (2026-11-18)

Method: partly degraded. Assessment A (the design review) ran in this reviewer's own context, because this critique was itself
delegated as a read-only sub-agent. Assessment B (the detector) ran as a separate, isolated sub-agent. A was written down before
B's output was read. There was no browser overlay, because the review was told not to start servers.

What was judged: the real 390 px captures in `.ui-atlas/stories/round3-short-games/` (after, after-30, after-bots, compared with
before), with `src/new/show/games-r3.tsx` and the r3 hooks (`games.tsx`, `tonight.tsx`, `reveal.tsx` NightBeat, `game-page.tsx`)
read where a capture left a question open.

A note on the captures: the stitched `.full.jpg` files show the tab bar halfway down the page, covering the RUNNING heading.
On the archive they also show the Games tab under the pushed page. Both come from how the page was stitched, not from the
screens themselves, and neither is counted below.

## Design health score

| # | Heuristic | Score | Key issue |
|---|-----------|-------|-----------|
| 1 | Visibility of system status | 2 | Someone behind sees three different gates for the same episode's moves (the strip says "After you reveal Ep 18"; one row can be answered now; two say "Opens after you reveal Ep 19"). |
| 2 | Match system / real world | 2 | The record needs a footnote to read. "3 wins of 57 · 9 shared", "Level" and "All 4 tied" next to a "–" tile each leave room for two readings. |
| 3 | User control and freedom | 3 | Back from the archive, folds that open in place, and paging by a named button ("Episodes 12 to 6") all work. |
| 4 | Consistency and standards | 2 | The same game name is MATCH THE MAJORITY on the tab, "Match the majority" on Tonight and in the chips. "1 question" on the tab is "1 to answer" on Tonight; a heading is "EPISODE 19'S RESULTS" on the tab and "EP 19'S RESULTS" on Tonight. A tie shows two faces on the tab and one in the reveal. The page shows "1 pts" where the rows show "1 pt". |
| 5 | Error prevention | 3 | Lock times and "change until" are stated. The rows say what's answered. |
| 6 | Recognition rather than recall | 2 | Nothing marks which face is you on a night row. "Which kind am I best at" means tapping three chips and remembering three numbers. Archive episodes are headed "3 games", not the date they aired. |
| 7 | Flexibility and efficiency | 3 | The kind chips, the door's count, a button on every row and the folds help. "Again for Episode 20" is in none of the captures and not in the code. |
| 8 | Aesthetic and minimalist design | 3 | Before, the tab was 18,186 px; now it is about 2,400 and stays that size at 30 episodes. Still, the first view says the lock time six times, and a behind viewer's first view is three rows with nothing to do. |
| 9 | Error recovery | 2 | Nothing captured shows an error. In the code, if the archive read fails it pulses forever, with no message and no retry. |
| 10 | Help and documentation | 3 | How ZT Survivor works, the record's explainer line and the game page's How it plays are all there. The explainer line is doing work the chart should do itself. |
| **Total** | | **25/40** | **Acceptable** (a big structural step forward; the details let it down) |

## Design specificity verdict

**Review (Assessment A).** Most of it feels made for this product. The parts that do are the condensed caps for names, the night
ground, teal used only for your own win, red never used for a loss, and the who's-in faces on a night row. Those faces are this
product's own idea: they show the couch answering before the episode, in place of four "–" leaderboard rows. The spoiler wording
("results when you reveal it", "as far as you've seen") also comes from the product's rules.

Two parts could belong to any app:

- **The archive.** It is a list of cards, one per episode, each with the same three names in the same order 19 times. That is
  generic history UI.
- **The record.** It is a stock stacked bar with a legend sentence under it.

Both are where the 2026-11-12 direction toward expressive data display applies most. The archive is really a grid of episodes by
game kinds, and your place in each cell would tell the season's story at a glance. The night beat in the reveal is the one moment
meant for the broadcast look, and right now it is a muted list.

**Detector (Assessment B).** It found 75 advisory findings across the five files. Only 9 are in `games-r3.tsx`, and all 9 are
font sizes outside DESIGN.md's type scale:

- 12 px: the kind label and "pts" in the result row, and the record's column labels (lines 89, 98, 363).
- 14 px: Tonight's two compact headings (lines 456, 464).
- 17 px: the night-row name, the door's count and the record's counts (lines 140, 283, 376, 384).

None is a false positive against DESIGN.md. Most were choices written into the shape doc, so the real decision is whether to move
them onto the scale or add the sizes to DESIGN.md. The detector found nothing inside NightBeat. Its one other finding (a bounce
easing at `reveal.tsx:811`) is older code, not r3.

**Where they agree.** The review had already flagged the 12 px caps kind label in the result row as too small: it sits under the
13 px detail size, and it is the only place a result row says which game it was. The detector confirms it. The detector misses
every issue below (touch targets, contradictions between parts, the chart's legibility), because it reads code, not the screens.

## Overall impression

The structure is right, and it is a large gain. The tab dropped from 18,186 px to about 2,400. Tonight dropped from 12,450 px to
about 2,450. A 30-episode season gives the same tab as a 20-episode one. The finished game page lost its one-column grid.

What lets it down is that the parts don't agree with each other: the strip against the rows, the result row against the game
page, Tonight's names against the tab's. Also, two of the three new displays (the record, the night beat) need words to explain
what they should show on their own.

The biggest opportunity: make the next episode's block mean everything for the next episode, and make the behind view lead with
the one thing to do, which is to reveal.

## What's working

1. **The tab no longer grows with the season.** It shows the next episode, three season games, the last results and a door with
   a count ("All finished games 57"). The archive pages in whole episodes behind a button that names what comes next ("Episodes
   12 to 6"), not an endless scroll. after-30 proves it: the same view, 87 games behind the door.
2. **The result row reads in one pass.** The sentence comes first ("jordan won", "Tied: you and riley"), your place sits right in
   number type, teal appears only when you won, and nothing is red for a loss. That keeps the colour rules in DESIGN.md (one
   chyron yellow; red only for someone leaving).
3. **Who's in, not a blank leaderboard.** A night row's faces, with the ones still to answer dimmed inside a dashed ring, replace
   four "–" rows. They say what is actually happening before an episode, and the bots case works the same way with robot faces.

## Priority issues

**[P1] Someone behind gets a first view that contradicts itself and leads with nothing to do** (games-sam, tonight-sam)
- **Why it matters.** Sam's first phone view is Episode 18's three rows, each "4 of 4 in · Answered": there is nothing to do in
  any of them. Under it, the strip says Episode 20's moves come "After you reveal Ep 18". Episode 20's rows then say three
  different things: Prediction Sheet has a live Answer button ("locks Sun 8:00 PM"), while Match the Majority and Split the Pot say
  "Opens after you reveal Ep 19". Joanna can't tell whether to reveal first, answer first, or which reveal unlocks what. The one
  thing to do (Reveal Ep 18, yellow, up in the show bar) has no echo in the content.
- **Fix.**
  - Fold the episode the viewer must reveal next into one line, like Episode 19: "Episode 18 · 3 games · answered · results when
    you reveal it", with the reveal as its action.
  - Give every move on one episode the same gate, worded the same in the strip and the rows. If Prediction Sheet can really be
    answered now, the strip must not say "After you reveal Ep 18". If it can't, its button must not be live.
  - On Tonight, the same change applies: "EP 18'S GAMES" × "Results when you reveal it" × 3 becomes one line.
- **Command.** /impeccable clarify (wording), then /impeccable distill (fold the block).

**[P1] "Episode 20" isn't everything about Episode 20** (games-alex; compare with before/games-alex)
- **Why it matters.** The block says "Episode 20 · 3 games" and holds three Answer buttons, so it reads as the whole job. But the
  Survival Pool pick for Episode 20 ("Pick a survivor for Episode 20 · Locks Sun 8:00 PM") and the Weekly Lineup's Episode 20 Edit
  sit about 1,400 px lower, inside RUNNING. Before this round, the Survival Pool pick was the first card on the tab. This round
  pushed a due move out of the first view. The reverse also happens: for sam, "Episode 18 bingo" sits under the EPISODE 20
  heading, because This week was folded into the next-episode block.
- **Fix.**
  - Sort what's due by the episode it's for, not by the game's length. Under the episode heading, put a one-line "also due for
    Episode 20" row for each season game with a move (its dot, its name, its button), linking down to its card.
  - Put the bingo card for the episode the viewer watches next (Episode 18 for sam) in that episode's block, never under a later
    episode's heading.
- **Command.** /impeccable layout.

**[P2] The record doesn't read without its footnote** (archive-alex, archive-kind, archive-sam, after-bots/archive-alex)
- **Why it matters.** This display is meant to answer "who do I beat", and it takes three looks to decode:
  - The column labels don't sit over what they name. "YOU AHEAD" is over the names, not over the bar's left end. "LEVEL" is centred
    over the whole bar, while the level segment moves from row to row.
  - The level count is never printed.
  - Bone (you ahead) and dusk (them ahead) are both pale. At 8 px tall they separate weakly.
  - The headline is ambiguous. "3 wins of 57 · 9 shared" reads as "9 of the 3 were shared". Under a kind chip it becomes a giant
    "0" for someone who tied for first 4 times.
  - Conor's question, "which kind am I best at", means tapping three chips and holding three numbers in his head.
- **Fix.**
  - Drop the header row. Print the three counts on the bar itself: yours left in bone, level in the middle, theirs right, each with
    its own count ("10 · 29 · 18").
  - Make "them ahead" clearly darker than yours, or give it a hairline outline, so the two ends never read as the same colour.
  - Count shared firsts in the headline: "12 firsts of 57", with "3 alone · 9 shared" under it.
  - Put each kind's firsts in its chip ("Split the pot · 5 of 19"), so the best kind can be seen without tapping.
  - Then delete the footnote.
- **Command.** /impeccable clarify, then /impeccable typeset (the chart's numbers).

**[P2] Ties and "All 4 tied" are hard to read and disagree between screens** (games-sam, archive-*, archived-game, after-bots, reveal-4)
- **Why it matters.**
  - An "All 4 tied" row shows the same empty "–" tile as "Nobody scored", with no place at the right. The game's own page, though,
    says "Tied 1st of 4 · 1 pts" with +1. So did you win or not? The row and the page give different answers.
  - Two overlapped faces show only a 14 px sliver of the first winner. It reads as a coloured tab beside one face, not as two
    people. With robots it looks broken: the sliver shows as a stray "{".
  - The reveal shows one face for a tie and the tab shows two, for the same result.
- **Fix.**
  - Give "All 4 tied" its place ("T1", teal if it counts as your shared win) and a tile of its own, such as a small "=" or the
    four faces in a 2×2. Keep "–" for "Nobody scored" only.
  - For a shared win, stack two faces at 60% overlap or more with a 2 px ring of the row's own colour, or use one face with a "+1"
    count tile.
  - Use the same tie treatment on the tab, the archive, Tonight and the reveal.
- **Command.** /impeccable polish.

**[P2] The first view repeats itself and drops below the craft floor** (games-alex, after-30, after-bots)
- **Why it matters.**
  - Sunday 8:00 PM appears six times in one phone view: the show bar, the strip ("Lock when it airs"), the block heading, and
    "locks Sun 8:00 PM" on each of three rows. The second row cuts off ("locks Sun 8:00 ...").
  - The card mixes two row styles. The games use caps names, a dot, an outlined button and faces. The extras use an icon tile, a
    sentence-case title and a muted word with a chevron. The right-hand words mix a state ("Ready") with actions ("Play").
  - Answer buttons and name links are 36 px tall, under DESIGN.md's 44 px minimum.
  - Nothing marks which face is you, so a dimmed first face reads as "someone hasn't answered", not "you haven't".
- **Fix.**
  - Say the lock once, in the heading ("Episode 20 · locks Sun 8 PM · 3 games"), and leave it off a row unless that row's lock
    differs. The row's line then fits: "2 of 4 in · 1 question".
  - Raise buttons and name links to 44 px.
  - Give your own face a bone ring, or put "you" under it.
  - Make the extras' right-hand word an action every time ("Open", "Play", "Ask"). Set them in a sub-group under a hairline and a
    13 px muted label ("Also for Episode 20"), so the two row styles read as two groups, not one list that changes halfway.
- **Command.** /impeccable distill, then /impeccable adapt (touch targets).

## Persona red flags

**Joanna (forgets; arrives from a push "3 games on Episode 20").** She answers the three rows and leaves believing she's done,
missing the Survival Pool pick for Episode 20 at around 1,400 px. When she's behind (sam's view), the strip says to reveal first,
one row lets her answer anyway, and two say "Opens after you reveal Ep 19". She won't know which to trust.

**Andrew (drives by; "my place, and did I win last night").** On the Games tab, last night's results come after all three season
cards, the last block before How it works, so he scrolls the whole tab to learn whether he won. Tonight serves him better (results
directly under the minis). On the tab, a one-line "Last night: you won 1 of 3" near the top would answer him without the scroll.

**Conor (tinkers; opens the archive).** He can read the chart once he finds the footnote. To learn his best kind he taps three
chips and compares from memory. Under a chip, every episode becomes a heading plus a card holding one row, 19 times. He can't tap
an opponent's row (not this round, as the spec says), and he gets no hint that he can't.

**Jordan (first time ever).** "T3", "Level", "9 shared", "4 of 4 in", and dimmed faces in dashed rings come with no key. "All 4
tied" next to a "–" looks like nobody won.

## Minor observations

- **[P2] Reveal, two identical slides.** Frames 7 and 8 are the same beat twice ("YOUR PREDICTIONS · 0 OF 1 RIGHT · None right
  this time"), with no game named. These are `r.predictions` beats from season games, all labelled "Predictions". The kicker
  should name the game ("Your Outlast predictions").
- **[P2] Reveal, the night beat buries its headline.** The beat's verdict ("You won 2 of 3 tonight.") is the last thing on it, in
  17 px muted text, under an empty top half. That is the moment the reveal exists for. Lead with the verdict in number type
  ("2 OF 3", teal) over the rows. In the capture, the line counts a tie ("Tied: you and riley · T1") as an outright win. The
  current code would say "won 1 … and shared 1", so the capture may be stale; re-capture to confirm.
- **[P2] The archive's episode headings say "3 games", which is true of every episode.** Use the air date ("Nov 15"), as the spec
  asks and as the episode air-dates rule (`episode-air-dates.md`) requires everywhere.
- **[P2] Under a kind chip, drop the per-episode headings.** Make it one card of rows, each with "Ep 19" in its kind slot.
- **[P2] The archive has no error state.** In `games-r3.tsx` it shows `!q.data`, a pulse forever on failure. It needs "Couldn't
  load finished games" with Try again.
- **[P2] The finished game page says "Tied 1st of 4" three times.** It appears in the title card, the YOU row and the Episode 17
  row, under a giant "YOU" for a four-way tie. For a one-episode game, drop the Episode 17 row (it repeats the game) and put the
  result in the title card.
- **[P3] Points.** "1 pts" on the game page (twice); the rows say "1 pt" correctly.
- **[P3] Name case.** Pick one case for a game's name across the tab (caps), Tonight's compact lines and the chips (both sentence
  case today).
- **[P3] Move wording.** "1 question" on the tab is "1 to answer" on Tonight. Pick one.
- **[P3] Tonight's count.** Its header says "3 on ZT Survivor 51" but then lists 3 more games under EP 20'S GAMES. Count all six,
  or say "3 running".
- **[P3] Dot colour.** All three night games carry the same green dot, because the colour comes from the game type. Inside the
  block, the dot tells the rows nothing.
- **[P3] Heading with an apostrophe.** "EPISODE 19'S RESULTS" in condensed caps puts a stray apostrophe-s in a broadcast heading.
  "EPISODE 19 · RESULTS" matches the shape doc and reads cleaner.
- **[P3] The door line.** "riley has won more" doesn't say more than whom, or how many more. Use "riley leads with 8".
- **[P3] Start a game.** Its line still says "A season game for this show". One-episode games now outnumber season games 19 to 1.
- **[P3] Off-scale sizes (detector).** The 12 px caps for the kind label should be 13 px, the detail size. The 17 px sizes should
  move to the 19/15 caption sizes or be added to DESIGN.md.
- **[P3] Again for Episode N.** It appears in no capture and no code: not on the tab, not on the finished game's page, not at the
  reveal's end. Without it, Joanna's next night's three games are three trips through the wizard.
- **[P3] The game page's How it plays (older text, seen here).** Words run together: "Pick who most of us will 1 point if yours
  is…". It also says "Before each episode" for a one-episode game.

## Questions to consider

- What if the next episode's block were the whole night: its games, the season games' moves for it, and its bingo, in one card?
- Does the archive want to be a list at all? An episodes-by-kinds grid of your places (teal where you won) would show a 60-game
  season on one screen and answer "which kind am I best at" with no chips.
- Should the night beat be the reveal's loudest beat when you won, and close to silent when nobody did?

## For the user (targeted questions; relay)

1. **Which to fix first?** (a) The behind view and its gates (P1). (b) Making the episode block hold everything due for that
   episode (P1). (c) The record and tie displays (P2).
2. **The archive: repaint or restructure?** (a) Keep the list and fix the dates, the filter and the ties. (b) Restructure into an
   episodes-by-kinds grid, as a new display for the record round.
3. **Scope:** (a) The two P1s only. (b) The P1s and P2s. (c) Everything, including the P3 wording and casing pass.

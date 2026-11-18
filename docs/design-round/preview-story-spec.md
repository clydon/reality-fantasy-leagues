# The game preview's story: page spec (Intent, step 1)

The user, 2026-11-18, after P0 (docs/PLAN-game-preview.md, decision 3): someone setting up a game wants to know it plays correctly
and as they expect, and the answer is "a visual story, not words and paragraphs: quick, intuitive and to the point". The real
screens become a drill-in.

## The job

Before the game exists, show the person making it **how a season of it goes**, in pictures, in about half a minute, so they either
start it with confidence or change the one thing that surprised them. Success: they can say, without reading a rule, what they'll
do each week, when the game changes shape, how it's won, and whether anything about it looks wrong.

## Where it sits

- **In:** from the gallery's game sheet (the game as set: base, changes, span), "See it play". The sheet's spec, the season's page
  facts and the couch go in; nothing is created.
- **Out:** Close returns to the sheet exactly as it was. A fix taken on a card (below) returns with that change applied to the
  sheet, shown there as any change is, so it can be undone where it was made.
- **Drill-in:** each card can open its moment on the app's real screens (P0's frames; built later, P2). A face opens that
  castaway's made-up weeks; a person opens their season.

## The person

The couch's organizer, mid-setup, on a phone, deciding. Casual: wants the shape and "is it fun / fair". The sweat: wants to see the
numbers move (is my weekly pick worth anything, can a lead be overturned). Both on the same cards: the picture for one, the number on
it for the other.

## The cards, in order (one season, made up; this round: the Fantasy league with a new draft at the merge)

Each card has one job, one picture and at most one line of words. A card that would say nothing in this game isn't shown (a game
with no weekly move has no "each week" card).

| # | Card | Its one question | What it shows, in rank order |
| - | ---- | ---------------- | ---------------------------- |
| 1 | **The season** | What is this game, start to end? | The episodes 9 to 13 as a strip: the two stages as bands, the new draft at the merge, the finale's crown; a mark on every episode where you have a move (the draft, a lineup, the new draft); who won. The flag count if any ("1 to check"). |
| 2 | **The draft** | What do I start with? | Your five faces, large; the couch's teams as rows of small faces, a face on several teams marked as shared. The move: pick five, in private. |
| 3 | **Each week** | What do I do, and does it matter? | One episode up close: your five, three lit as starters with what they scored, two dimmed with what they'd have scored. The swing: the best and worst lineup that week on one bar, and what's typical across seasons (about 7 points a week). |
| 4 | **The race** | Does it stay close? | Everyone's running total, 9 to 13, the merge marked, the lead changing hands where it does. |
| 5 | **The merge** | What changes, and is it OK? | Who's still in (seven faces); the four new teams as rows; the castaway on every team singled out. **The flag**: teams this alike in 29 of 30 seasons. **The fix**, in place: draft 3, start 2 at the merge, the rows redrawn with it (alike in 7 of 30). |
| 6 | **The finale** | Who wins, and how? | The winner crowned; each person's total as two stacked parts, before and after the merge (the overall adds them up); the margin. What's typical: a close finish in 12 of 30, the first stage's leader goes on to win in 15 of 30. |

Always on: "Made-up season" (never mistaken for the show; nothing in it is real but the cast), Shuffle (another season), Close, and
where you are among the cards.

## Flags (what makes a card say "check this")

A flag comes from many seasons (30 here, each its own seed), never from the one shown: it's raised when the thing happens in most
seasons. Each names the card it lives on and offers its fix when the gallery has one. This round's: the merge's teams. Others the
data already holds (not flagged here, nothing wrong): a weekly pick worth less than a point (a lineup that doesn't matter), a
winner decided before the last stage in most seasons.

## Situations this round shows

- The Fantasy league with a new draft at the merge, as set (the flag raised).
- The same with the fix taken (draft 3, start 2 at the merge): the merge card without the flag.
- Shuffle: a second season of the same game (the shape holds, the people and numbers change).

Not this round (P3, breadth): one game without stages (no merge card), a game with no weekly move (Outlast: no "each week"), a
game of questions, sports, own pace.

## Left out, and why

- **Rules as text:** the sheet already lists them; the cards show them happening.
- **Tonight, chat, GIFs, the reveal, side bets:** the app around a game, not how the game plays. Reachable through the drill-in.
- **Exact scoring per moment:** a face's points carry it; the castaway's weeks are a tap away.

## The drill tree

| Level | Question | Data held | Verdict |
| ----- | -------- | --------- | ------- |
| The story (cards) | How does this game go? | The sample season, the typical numbers (story-data.json) | **New screen** |
| A card's moment | What will I see then? | P0's live tier | **Keep** the real screens (P0), reached later (P2) |
| A face | What did they do each week? | castWeeks, why | **Keep**: the castaway's sheet, made-up weeks |
| A person | How did their season go? | each week's starters and bench | **Keep**: the person's sheet |

## Return paths

Close (or back) from any card: the sheet, unchanged. Fix taken: the sheet with the change, the story closed (seeing it again shows
the fixed game). Shuffle: the same card of another season. A drill-in returns to the card it left.

## The round (2026-11-18)

Built as a development-only mock at /start/preview-story (src/new/preview/story.tsx), fed by scripts/dev-test/preview-story-data.js
(three sample seasons for Shuffle, 30 for what's typical, the merge drafted smaller as the fix); frames by
scripts/dev-test/story-preview.js. Checked once each: Impeccable's critique (design review 25/40; the detector: 18 advisory type
sizes, one contrast miss and labels past the gutter on Each week) and PFD's evaluation (61/100). One batch of fixes: YOU on every
card; Each week shows a typical, named week with the bench dimmed (grey stays "gone home") and what's typical as a bracket on the bar;
the draft's "×N" became the other holders' chips; the race's new draft between 11 and 12, labelled stages, totals at the line ends;
the merge's columns fixed across the fix, its flag carrying Check; the finale's legend matching its bars and "a close finish" as its
typical; type snapped to the ramp, labels inside the gutter, no overlaps. The story: https://claude.ai/artifact/KzNrXUwPap7yTpFsGoueKQ.

**Decided:** the last card's buttons are "Go back" and "Create this game" (yellow), the user, 2026-11-18.
**Choice for the user:** the stages' names ("Before Merged" is the gallery's; recommended: fix them in the gallery).
**Open:** the fix redraws the merge only (the race and finale still show the game as set); Close, Change it, Use and the drill-ins
aren't wired; one game type; 30 seasons take about 50 s headless; the season card's lower third is empty.

## The rebuild on the game's own parts (2026-11-18, decision 5)

The user: the preview must follow the game's UI and be accurate, so the bench can show it for hundreds of games. Now the data is
the production game view at three moments (before results, when a stage ends, the end), unchanged
(scripts/dev-test/preview-story-data.js, schema 2). Whatever the game shows is drawn by its own component: Your team at the draft
(card 2), the person's week-by-week season with its bench cost (card 3, `PersonSeason`, `bestOf`), the overall season grid
(card 6, `SeasonGrid`, now exported), faces and people's squares everywhere. Only the strip (card 1), the race, the merge's teams side
by side and the "N of 30" ticks are the preview's own; the ticks are counted in the page from each season's end tables with the
game's own `bestOf`. The fix is now played whole: every card follows "Try 3 each". The race's sums equal the game's totals
(24 of 24 checked).

Checked once each: Impeccable's critique 23/36, PFD's evaluation 62/100. One batch of fixes: card 2 at the draft's moment, not
the stage's end (the end showed points a benched castaway scored, adding to 22.5 against a score of 22); card 3 one stage, led by
"Your bench cost 4 · you lost by 1.5" and "2nd's best lineups would have won" (27 of 30); the race lights you and the winner only
(the app gave two people the same blue) and marks where the lead last changed; the finale drops the stages' sentence; card 1 drops
the winner (the finale's) for the crown on the last episode and larger moves; the merge names who's on every team, says YOU, and
quiets Next while the fix is on.

**Found in the app by its own parts:** Your team's number is a castaway's points in the game, started or benched, so a team's numbers
don't add up to its score; people's colours come from their id and collide (two of this couch's four are the same blue); the game's
line says "Redraft at merged".

## The real screens in a phone (2026-11-18, decision 6)

The user, after the rebuild: "I'm still struggling to see the 1 to 1 view from preview to game ... we want to see the tonight game
section, games tab, draft stage, quick actions, game page, etc. ... a 'iPhone/phone free screen' where we put the real game screen
snapshot in that view." So each card is a moment of the made-up season, shown as the app's real screens at that moment, in a phone
frame; the cards' own drawings go. The season is played on the real screens (scripts/dev-test/preview-story-shots.js: the zt-gb
live tier, Alex's moves made in the real draft room and on Your moves, the reveal run as Alex), and the card's line and check read
the production views of that same run, so screen and words are one season.

| # | Moment | Its real screens (the first opens) | Its line | Its check (over 30 seasons) |
| - | ------ | ---------------------------------- | -------- | --------------------------- |
| 1 | Your games | Games tab · Tonight (the draft due) | the game's own line | |
| 2 | The draft | Draft room, picked · revealed | Before Episode 9 · 5 each, in private | |
| 3 | Each episode | Tonight (Set your lineup) · Your moves | Start 3 of your 5 before it airs | 2nd's best lineups would have won |
| 4 | After Episode 10 | Game page (the season) · Tonight's game section | where you stand | |
| 5 | The merge | Draft room, revealed · Tonight · picked | After Episode 11 · 7 still in · draft 5 again | Same castaway on every team (Check); Try 3 each swaps in that season's screens |
| 6 | The finale | Reveal (where everyone finished) · Game page | who wins, by how much | A close finish |

The phone: the shot as the phone shows it (390 x 844, at 2x), its foot under the card's check; the screen names above it switch
the moment's screens; a tap opens the screen at full size, which on a phone is exactly the app. Shuffle and the fix swap in
another live run's screens. The screens show the app as it is, bugs included: that's the point of looking (Tonight's game section
says "0 of 0 still in"; the finale's reveal shows the first stage's standings while the overall says otherwise).

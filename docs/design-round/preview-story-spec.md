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

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

**The round (2026-11-18, decision 6).** Built, then checked once each: Impeccable's critique 20/40, PFD's evaluation 63/100. One
batch of fixes:
- The capture records where the thing that proves each card's line sits on its screen (Brady's ×4 on every team, your row, the
  lineup strip, the starters, the Games tab's game, the final standing), and checks what each screen says against the season: "All
  set" while a draft is due (the Games tab, Tonight, Tonight at the merge), "0 of 0 still in" in a points game, Your team's numbers
  against your score, the finale's reveal table against who wins overall.
- The story rings the proof and marks a contradiction with a dashed ring and an "App differs" line. The screen a card opens on is
  the first that doesn't differ (the finale opens on the game page).
- The line is the headline; the moment's name sits in the top bar (no eyebrow). The check sits under the line and counts "made-up
  seasons"; the draft has its own same-castaway check (17 of 30).
- The phone shows whole, tab bar and Lock in included, sized to the room; its status bar says "Made-up season". Full size fits the
  screen above its own bar.
- Tabs are underlines; "Revealed" is "The teams". "Use" is gone: trying 3 each carries to Create this game, the top bar says
  "Trying 3 each". The last card keeps its back arrow.
- The couch's colours are chosen through the real profile route (fixed, distinct, the same in every run); the seeded couch chat is
  left out (a made-up season has none; its GIFs didn't load).
- Not changed: the made-up Episodes 1 to 8 copy how many went home each aired episode (P0's choice). Inventing the counts left 13
  still in at Episode 9 where 10 really are; which results a preview may show is a question for the user.

## Round 4: any game, made by the bench (Intent, 2026-11-18)

The user, after the real screens: the bench makes a preview of any game it runs, with no one driving it; the cards come from what
each game has; the truth check widens to what's due; the marks say what's wrong in plain words; a sheet shows many previews side by
side; and the story is judged by the lay of the land (docs/PLAN-game-preview.md, "The bench's previews"; §6B of the explorer plan).

### Who it's for, and what they're doing

- **Someone making a game** (the product, later): mid-setup, on a phone, deciding. They want the game's shape and whether it plays
  as they expect. They leave knowing the lay of the land, or change something and look again.
- **Someone sweeping the games** (the bench, now): the user and the design skills, at a desk, scanning tens to hundreds of games.
  They judge, in order: does the player know what to do on every screen; does each game have its own soul; does the preview tell
  the truth. They need to compare games and moments side by side, and to see at a glance where the app said something wrong.

### The lay of the land, moment by moment

A preview passes when, after it, someone can say **what the game is, what they'll do each week, when moves lock and how to win**.
Each question has the moment that answers it, and each such moment must carry the answer in its words, not only on its screens:

| Question | Answered by | Carried on the card as |
| --- | --- | --- |
| What is the game? | The game | the game's name as the headline, its own line beneath (the app's: "From Episode 9 · 3 questions") |
| What do I do each week? | Each episode | the move in the game's own terms ("Start 3 of your 5", "Answer 3 questions", "Pick 1 to stay in") |
| When do moves lock? | Each episode | the lock, from the engine: "Locks when Episode 9 airs, Wed 8:00 PM" |
| How do I win? | The finale | who won and by how much, and how it's won ("Most points from Episode 9 to 13") |

### The moments, in season order (each shown only if the game has it)

| # | Moment | When | Its real screens (the first opens) | Its headline | Its second line | Its check |
| - | ------ | ---- | ---------------------------------- | ------------ | --------------- | --------- |
| 1 | The game | the start | Games tab · How it plays | the game's name | the game's own line | none |
| 2 | The draft | the start, a draft to make | Tonight · Draft room · The teams | Pick 5 in private | before Episode 9 | the same castaway on every team |
| 3 | Each episode | the first episode | Tonight · the quick action it opens | the move, in the game's terms | when it locks | the weekly move matters (lineups) |
| 4 | After Episode N | the first results | Game page · Tonight's game section | where you stand | how points came (the week's best) | none |
| 5 | The next stage | a stage's new draft opens | Tonight · Draft room · The teams | 7 left: draft 5 again | after Episode 11 | the same castaway on every team |
| 6 | Out | the viewer's first time out | Game page | You're out after Episode N | how ("your pick went home") | none |
| 7 | The finale | the last episode | Game page · Reveal | Jordan wins by 1.5 | how it's won | a close finish |

For the first slice that gives the Fantasy league six moments (no Out), the Prediction sheet and the Survival pool four each (the
game, each episode, after Episode 9, the finale): three stories that differ in length and in screens, as the games do.

### What every card carries, and nothing else

1. Where you are: the progress, "Made-up season", the moment's name.
2. The claim: one headline in the game's terms, and at most one second line (the lock, the rule, the stage).
3. At most one check, counted over the made-up seasons ("n of 10 made-up seasons"), only where the game has the thing it counts.
4. The real screens, by the app's own names, in the phone; a ring on what proves the claim.
5. **App bugs, said plainly:** a screen whose words the season contradicts is marked on its tab, ringed with a dashed line, and named
   in one line under the tabs: "App bug: says 'All set for Ep 9', but your draft is due". The card opens on a screen that agrees.
6. The way on: Next names the next moment; the last card is Go back and Create this game.

### The sheet (the sweep's view)

- **Job:** compare many games' previews at once, at the size a phone shows them, and see where the app was wrong.
- **Shape:** a row of phones, one per game, each the game's own story at 390, side by side and scrolling sideways; above each, the
  game's name, what it has (a draft, a weekly lineup, questions, a pool, stages) and its bug count; below, its bugs as plain lines.
- **One moment across games:** a control sets every phone to the same moment (The game, Each episode, The finale…), so the same
  question can be asked of every game at once: does the player know what to do here, and does this game look like its own. A game
  without that moment says so in its column ("No draft in this game").
- **Never edits, never saves:** each column is a preview the bench made; the sheet only shows them.

### Decisions (this round)

- **The fix toggle goes for now** (Try 3 each): it was this one game's; a fix for any game needs the gallery's changes matched to a
  check, later. The check stays.
- **Bug marks are the bench's.** They show in the story and the sheet here; a product preview shows the app as it is, with no
  marks (by then the bugs are fixed, or the bench is how they're found).
- **One season per game** (Shuffle when there are more), and ten made-up seasons for what's typical, per the plan's cost table.
- **A moment the game doesn't have isn't shown,** and no card is padded to keep stories the same length.

### The round (2026-11-18)

Built through Intent (this section), Perception-First Design (first-view requirements, "Round 4", R1 to R5) and Impeccable, then
checked once each: Impeccable's critique 21/40, PFD's evaluation 64/100. One batch of fixes:
- Each moment opens on the game's own screen (how it plays, its draft room, its move), the screens every game shares after it, and
  never on a screen that contradicts it while one that agrees is there; each screen rings what proves the claim (the move's own
  question in Your move, the top two rows at the finale).
- Headlines in the strips' own words ("Pick who survives each episode", "Fill in your sheet: 3 questions"); the finale quotes the
  game's own rule for how it's won ("Longest streak wins; ties go to the most right picks").
- Checks as plain sentences, the count first ("5 of 10 made-up seasons ended level at the top"); a tie counted where totals are
  small; no tag that looks like a tab.
- App bugs tagged "App bug" on the tab, the ring and the line (the app's own dashes mean "not yet"); the reveal checked against the
  whole game's standings; a draft waiting for whoever runs the game named; "Your team" said plainly.
- A fixed height for the claim, so the phone stays put; the progress tappable, Close wired; type on the scale.
- The sheet: phones without the story's controls, each column's bugs above its phone, every column lined up.

Not done: one airtime across previews (the screens show when each was made; it needs the app's clock faked), and the fix toggle
for any game (a later step, with the gallery's changes matched to a check).

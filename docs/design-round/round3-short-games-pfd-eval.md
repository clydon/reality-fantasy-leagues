# A show's games when short games are frequent: PFD evaluation of the built screens (Round 3, Mode 1)

One evaluation of the after frames at 390 px (`.ui-atlas/stories/round3-short-games/after/`: `games-alex`, `games-sam`,
`tonight-alex`, `archive-alex`, `archive-sam`, `archived-game`, `reveal-sam.reveal-4`; `after-30/` and `after-bots/` for the 30-episode
season and the computer players). It is measured against [the spec](round3-short-games-spec.md) and
[the first-view requirements](round3-short-games-first-view.md). The before frames were read for comparison only. The evaluate skill
normally adds an HTML rebuild of its fixes and an insight log; both were skipped here, because the fixes go into the app in the
round's one batch.

## Context

- **Audience:** a friend couch on phones, three one-episode games before every episode.
  - Joanna answers what the strip points at.
  - Andrew wants his place and last night's result.
  - Conor wants the record.
- **Intent:**
  - the Games tab is what's on, in time order;
  - the archive is the past, with the record at its head;
  - Tonight and the reveal treat a night's games as one thing.
- **Already working:**
  - The tab is 2,403 px tall at 20 episodes and at 30, against 18,168 and 26,241 before.
  - A night's games are one card under their episode.
  - Who's in reads as faces, with the not-yet ones dashed.
  - Results say who won in words, and a tie of everyone is never a win.
  - Sam sees nothing past Episode 17: his tab's results and his archive both start there.
  - The reveal's night beat replaces three identical "0 pts on your sheet" beats with one table: 12 beats down to 10.
- **Design system:** Tailwind utilities on the Lower Third tokens. Judged against general perception principles, with no corpus
  profile.

## Scores

| Layer | Score | Why, in one line |
| --- | --- | --- |
| Foundation (L0), cognitive load | 72 | The night's games are one chunk; the next episode's other one-night things push the season games below the fold |
| L1, first impression | 80 | Faces lead every part; the record opens on one large number; the reveal's night beat is a table of winners |
| L2, processing fluency | 70 | One result row everywhere; the lock time is said four times in one block; every short game wears the same dot |
| L3, prediction | 80 | Time order, folded later episodes with counts, a door that names its count, pages that say what's next |
| L4, decision architecture | 74 | One yellow, Answer one tap from the row; Again (play it again next episode) isn't offered anywhere yet |
| **Overall** | **75** | (72 × 1.5 + 80 + 70 + 80 + 74) / 5.5 |

No dependency caps apply: no layer is under 40 and nothing is critical. Before, on the same rubric, L0 would sit near 30 (63
full-weight rows, 18,000 px, the next episode's games at row 18) and L2 near 50 ("nothing counted yet" over "Final · you won it").

Ethics: passes Alignment, Sincerity and the Golden Rule.
- No streak to lose and no count of days played.
- A loss is a place in the same type as a win; only a win is teal.
- The record says plainly that a game nobody scored in counts for neither side.

## Findings, by severity

### Major

**V-F-001 · The next episode's one-night things push the season games below the fold** (`games-alex`).
- **What's wrong:** Bingo ("Opens Sun 8:00 PM · tap squares as it happens · Ready"), trivia and Start a poll sit at full row height
  inside Episode 20's card, about 420 px of the first view. Running and Survival Pool's place start at about 1,560 px, so R1's "the
  first season game's name and place are in the first view" fails.
- **Why it matters:** each row is a chunk of its own, so the first view holds about seven where R1 allowed four, and none of the three
  is due.
- **Fix:** keep them in the block (where Intent put them) as **one line**: "Also for Episode 20 · Bingo · Trivia · Start a poll", which
  opens in place.

**Citations:** Cowan (2001) for the chunk ceiling; Sweller (1988) for extraneous load from elements that don't serve the task.

**V-L4-001 · Again isn't offered** (spec, "Start a game"; R5).
- **What's wrong:** the spec's repeat path (the same games on the next episode, one tap) isn't on the finished game's page or on the
  reveal's last beat. On the busy fixture the next episode's games always exist, so the frames can't show it either way. Today's
  Start a game row still offers Run it back for the newest finished game, one game at a time.
- **Why it matters:** the decision a frequent short game asks for has no path but the wizard.
- **Fix:** build it in B3, where the reveal's last beat and the result block can offer it once the next episode isn't covered; it's
  listed as open in the story.

**Citations:** Thaler and Sunstein (2008) for making the wanted choice the easy one; Pirolli and Card (1999) for a path that's
missing being a dead end for the scent.

### Minor

**V-L2-001 · The lock time is said four times** (`games-alex`): the block's heading says "Sun 8:00 PM" and each night row says "locks
Sun 8:00 PM". The third row's line truncates ("locks Sun 8:00 …"). **Fix:** a row drops its lock time when it is the episode's air time
(the heading says it once), keeping "2 of 4 in · 3 questions".

**Citations:** Reber and Schwarz (1999) for one form reading as true.

**V-L2-002 · Every short game wears the same dot** (`games-alex`, `archive-alex`): Match the majority, Prediction sheet and Split the
pot share the engine's "questions" ink, so the dot says nothing while looking as if it distinguishes. **Fix:** drop the dot from night
and result rows (the name says the kind); season games keep theirs.

**Citations:** Alter and Oppenheimer (2009) for the cost of a cue that doesn't carry its meaning.

**V-L2-003 · "Level" has no number** (`archive-alex`): the record's bar shows level as a segment between two numbers, so its count is
only a length. **Fix:** the level count in the bar's middle segment, small, or under the bar.

**V-F-002 · Two lines of prose under the record** (`archive-alex`): "Who finished higher, game by game. Level: the same place. A game
nobody scored in counts for neither." **Fix:** keep the last sentence only. The legend row already names the segments.

**V-L1-001 · A tie's stacked faces on robots read as a bracket** (`after-bots/archive-alex`): the first robot tile shows only a 14 px
sliver ("{" at a glance). **Fix:** a wider offset (18 px), so a sliver of the first face reads as a face.

**V-L3-001 · A finished all-tied game's page leads with "YOU"** (`archived-game`): "FINAL · YOU · All 4 tied" puts your name first on a
game nobody won. Small: the line says the truth, and the page is the deep end.

## Requirements check

| Requirement | Met | Where it falls short |
| --- | --- | --- |
| R1, four chunks a view | partly | V-F-001 (the one-night things); the archive, Tonight and the reveal meet it |
| R2, people first | yes | faces lead night rows, results, the record and the beat |
| R3, one form per fact | mostly | one result row, one tie rule; V-L2-001, V-L2-002 |
| R4, time order, doors that predict | yes | |
| R5, one decision, nothing presses | partly | V-L4-001 (Again) |

> *Initial findings. Ralph Loop a layer score, cite further, switch to solve / analyze, or ask any follow-up to dig deeper.*

# Changing a game later: PFD evaluation of the built screens (Round 4, Mode 1)

One evaluation of the after frames at 390 px (`.ui-atlas/stories/round4-game-settings/after/`), against
[the spec](round4-game-settings-spec.md) and [the first-view requirements](round4-game-settings-first-view.md); the before frames
for comparison only. The skill's HTML rebuild and insight log were skipped (the fixes go into the app in one batch).

## Scores

| Layer | Score | Why, in one line |
| --- | --- | --- |
| Foundation (L0), cognitive load | 84 | A game's whole settings in one view (five lines, the lock, Stop); the list's three rows and two folds in one |
| L1, first impression | 78 | The game's own title card leads; the list leads with names; no art on the test show, so the card is a dark band there |
| L2, processing fluency | 70 | Start a game's lines and cards; two lines share a near-identical people pictogram; a Game admin reads the same refusal five times |
| L3, prediction | 80 | Chevrons open, padlocks say why; Game settings is in the game's ⋯ menu; Stop's key icon predicts nothing |
| L4, decision architecture | 80 | One open line at a time with its consequence; archive one tap with Undo, delete held |
| **Overall** | **79** | (84 × 1.5 + 78 + 70 + 80 + 80) / 5.5 |

Before, on the same rubric, L0 would sit near 35 (every control of every game open; past 65,000 px on a busy season) and L2 near
55 (the lock choice in the engine's words, unlike Start a game's).

## Findings

### Major

**V-L2-001 · A Game admin reads "Only the Commissioner changes this" five times** (`riley-game`). The title card's sentence already
says it once (R4). **Fix:** a padlock with no reason on each line, keeping the line's own second part ("2 on the bench").

**Citations:** Reber and Schwarz (1999) for repetition read as noise once the fact is known; Sweller (1988) for redundant text as
extraneous load.

### Minor

**V-L2-002 · Who scores each week and Who can join share a near-identical people pictogram** (`settings-game`). **Fix:** who can
join takes the joining pictogram (a person coming in).

**V-L3-001 · Stop this game wears a key** (inherited from Backstage's archive row). **Fix:** the archive box glyph, which says
what Archive does.

**V-L1-001 · The title card on a show without art is a flat band** (the test show). Real shows carry their art; nothing to change.

## Requirements check

| Requirement | Met |
| --- | --- |
| R1, four chunks a view, one control open | yes |
| R2, the game leads | yes |
| R3, Start a game's forms | yes, but for V-L2-002 |
| R4, the menu's way in; no dead controls for a Game admin | yes, but for V-L2-001's repetition |
| R5, one decision; delete guarded | yes |

> *Initial findings. Ralph Loop a layer score, cite further, switch to solve / analyze, or ask any follow-up to dig deeper.*

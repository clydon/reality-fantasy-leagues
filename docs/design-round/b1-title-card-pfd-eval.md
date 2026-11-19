# The game page's title card: PFD evaluation (B1, chunk 7, step 4)

Mode 1 (perception-first-design:evaluate) on the after frames in `.ui-atlas/stories/b1-title-card/after/` (390 × 844, images at
2×), the before frames as the baseline; measures from each dir's `index.json`, no overlaps in either `overlaps.json`. Built in
[game-title.tsx](../../src/new/show/game-title.tsx), wired in [game-page.tsx](../../src/new/show/game-page.tsx) `GamePageBody`.
Requirements: [b1-title-card-first-view.md](b1-title-card-first-view.md). Design system: Tailwind with the app's own tokens
("Lower Third"), confidence 90.

**Context.** A friend or the maker opens one game on a couch of friends: the job is "which game, who I play, my move, by when".
The card is identity, the week block is news. What works: the bar's centre is empty, the card holds no state and no yellow, the
art runs behind card and week block as one surface, the name steps by measured lines (t3 at 34 in two lines, t4 at 40 in one),
and the yellow move plate keeps the highest contrast below the name in every due frame.

## Score: 69 / 100

| Layer | Score | Why, in one line |
| --- | --- | --- |
| L0 Load | 74 | Four chunks hold; seven type sizes in the first view, not five; the scrolled page has no bar at all |
| L1 First impression | 76 | Name + your tile in one glance (tile ≤ 243 px everywhere); the sport card has no team marks, no art |
| L2 Fluency | 55 | The card isn't the setup card's same object: size, art, kicker and sentence all differ |
| L3 Bias | 70 | No state, no yellow on the card; the sentence carries rules and engine words ("an Outlast") |
| L4 Decision | 68 | Every move ends ≤ 423 px; scrolled, nothing names the game or leads back |

Overall = (74 × 1.5 + 76 + 55 + 70 + 68) / 5.5 = 69. No dependency caps (no layer < 40, no critical finding).

## Findings, by severity

1. **Major (L2): the card is not the setup card's object; four mismatches on the one effect it exists for.** t0 → t1: the setup
   names FANTASY LEAGUE at 40 px (`parts.tsx` uses `name.length > 12`), the page at 48; the setup's art is grayscale at 50 %,
   the page's in colour; the setup's kicker reads "SURVIVOR · S51", the page's "SURVIVOR · SEASON 51"; the setup says "Everyone
   picks a team of five castaways.", the page "Everyone drafts 5 and starts 3 each episode, Episode 9 to the finale." Each
   difference is a prediction error at the moment continuity should be felt (Reber & Schwarz 1999; Clark 2013).
   **Fix:** one sizing rule for both cards (the page's measured lines, applied to the setup card too); one kicker string from
   one function; the page's sentence is the setup's first sentence (the gallery catalog's), not `gameSentence`; the art the same
   on both: **the user's named choice** (both grayscale, or both colour); only the mismatch fails.
2. **Major (L2/L3): the sport's sentence speaks in episodes.** t5: "Everyone answers one question before Episode 5: who wins."
   beside a "G 3" plate, under an "EAGLES" kicker. Vocabulary from two systems in one block costs fluency (Alter & Oppenheimer
   2009). **Fix:** the sentence takes the sport's nouns (game, week), as the week block does; a check that no sport frame says "Ep".
3. **Major (L4/L0): scrolled, the game has no name and no way back.** t7: the bar isn't sticky (before and after alike), so the
   spec's "the bar takes the name as the card scrolls under it" can't happen; the name is on screen zero times, not once
   (Pirolli & Card 1999: no scent once the card leaves). **Fix:** make the bar sticky with the name (and the show's name small)
   fading in only once the card's name passes under it; the centre stays empty while the card shows.
4. **Minor (L3): the sentence is rules and engine words.** t1 and t2 restate counts and span that How it plays leads with; t4
   opens "Draft, an Outlast:" (a base name surfaced as copy, practitioner observation, Learning #18). **Fix:** resolved by #1's
   source (the setup's plain sentence, in the season's nouns); Intent's words for any base whose sentence names its base.
5. **Minor (L2): the sentence is cut mid-word.** t3: "who goes home, who wins immunity and does anyo…" (`line-clamp-2`). A cut
   word reads as an error (Reber & Schwarz 1999). **Fix:** sentences written to fit two lines at 390, the clamp only a guard;
   the give-way order already lets the sentence go before the move moves.
6. **Minor (L0/L2): seven type sizes in the first view.** t2: 11, 13, 14, 15, 20, 26 and 48; the card itself uses only 11, 15
   and 48, but R1's snap of the week block's 14, 19, 20 and 22 wasn't made (`game-week.tsx` still holds 12–34). Each size is
   another level to rank (Cowan 2010). **Fix:** snap to display, heading, 15, 13, 11 caps as R1 lists.
7. **Minor (L1): the sport card has no team marks and no art.** t5 sits on a plain purple wash; the spec puts the team marks at
   the card's right and the team's colour behind (no letter tiles). **Fix:** pass the team marks into the card's right slot and
   the team colour to the backdrop, as the setup card's `mark` does.
8. **Minor (L3): the sentence lasts until a first result, not a first move.** `firstVisit` is "no score yet", so t1's maker sees
   it after setting a lineup, until results, every visit (Clark 2013: a constant line is learned and skipped). **Fix:** key it
   on "has made a move in this game" where the view knows it; the score proxy only where it doesn't.

## The first-view requirements

| Requirement | Result | Measured (CSS px; faces by eye, the script's `facesTop` came back null in every frame) |
| --- | --- | --- |
| Faces ≤ 290 | **Met** | your tile's top: t1 226, t2 226, t3 243, t4 219, t5 226, t6 176 |
| A due move ends ≤ 664 | **Met** | t1 363, t2 373, t3 423, t5 386, t6 311 (before: 242, 252, 285, 265, 239); t4 has no move, its Starts plate ends ~374 |
| Bar + card caps (≤ 140 lean, ≤ 220 with the sentence) | **Met** | week block starts: t6 136 lean; t1/t2/t5 186, t4 179, t3 203 with the sentence |
| Name steps by measured lines | **Met** | 48 (t1, t2, t5, t6), 40 one line (t4), 34 two lines (t3); no ellipsis in the name |
| The name on screen once | **Half** | once in every first view (bar centre empty); zero times scrolled (t7, #3) |
| The card never shows state, no yellow | **Met** | no record, place or "Final" in any frame; no yellow on the card |
| At most five type sizes | **Missed** | seven in t2's first view (#6) |
| Same object as the setup card (R3) | **Missed** | size, art, kicker, sentence (#1) |
| The toast never covers the move | **Not shown** | no frame captures Start's toast; add one to the story |
| Sport: marks, no "Ep" | **Missed** | no marks; "Episode 5" in the sentence (#2, #7) |

The cost of the card: the move moves down 72 to 138 px against the before, and still ends inside 424 px in every frame, so the
user's call (the name back) costs no due move. Whether people read past the name on a busy night stays a question for the playtest.

Not done from the skill's process, by this step's scope: the HTML rebuild of the top fixes and the plugin's insight log (no
code edits here; the fixes go to Impeccable's one batch).

> *Initial findings. Ralph Loop a layer score, cite further, switch to solve / analyze, or ask any follow-up to dig deeper.*

# A castaway opened from a week: Perception-First Design check (BACKLOG 251)

Mode 1 (evaluate), run once on the build, from real renders at 390×844: `.ui-atlas/stories/week-door/after/` against
`../before/`. Judged against [the spec](week-door-spec.md) and [the first-view requirements R1–R5](week-door-first-view.md).

## The findings, ranked

The block works. It answers the question the tap asked, and it's the first thing on the sheet. The sums close in every frame
(+4 +1.5 +5.5 = +11; +4 −0.5 = +3.5; +1 +1 = +2), and the head is laid out exactly like the week's own head, so the eye recognises
where it just came from. What's left is a handful of places where the sheet contradicts itself or names one thing two ways.
They're all small to fix, and every one of them costs trust, which is the thing the block exists to build.

| # | Finding | Layer | Severity | Frame | Fix |
| --- | --- | --- | --- | --- | --- |
| 1 | **A bench player who scored 0 is told he "scored".** The line reads "Weekly Lineup · On your bench: scored, didn't count" over a muted 0 and "Nothing that scores in this game". Three lines apart, the sheet says he scored and that he didn't. A 0 on the bench is a common week (Devin Way is 0 on the bench in every week shown). The phrase comes from the week's Bench label ("Scored, didn't count"), which is true of a section but false of one person who scored nothing. | L3 trust | Major | season-cell | In `howCounted` (cast-sheet.tsx), when the week is a bench week and nothing scored, say "On your bench" (or "On ahaskell's bench") with nothing after it. The muted 0 and "Nothing that scores in this game" already say the rest. The same goes for best ball's "Not in your best 3: didn't count" when the total is 0. |
| 2 | **A captain's week is bigger than his season, on the same screen.** The block says Episode 2 is +11 (Captain ×2 +5.5). Lower in the same first view, the game's row says "Weekly Lineup +5 · 1st of 12", and its chart's marked Episode 2 column says "+5.5". Both numbers are correct: one is what he earned for Ann's seat, the other is his own points. But nothing on screen says which is which. The reconciling "You · Counted for you in 2 episodes +10.5" is one scroll down. Joanna reads "+11 this week, +5 all season" as a bug. | L3 trust | Major | captain | Name whose the doubling is, in both places. In the block, make the factor row say who it belongs to, e.g. "Your captain ×2 +5.5" ("ahaskell's captain ×2" for someone else). In the game row's chart, when the block's week had a seat factor, have the marked column carry it, e.g. "+5.5" with a small "×2 yours" under it. Then +5.5 → +11 reads as one fact. When there's no holder (Everyone's table), factors are already left out, so nothing changes there. |
| 3 | **The same moment has two names on one sheet.** The block uses the game's names ("Individual immunity win +4", "Reward win", "Individual challenge: 2nd place", "Individual challenge: 3rd place"). Their numbers and Their story, further down the same sheet, use the show's names ("Won the Immunity challenge", "Won the Reward challenge", "2nd in the Immunity challenge", "3rd in the Immunity challenge"). The "Also:" line adds a third form: "Learned of an idol/advantage", where the story says "Learned of an idol or advantage privately". R3 was met against the week's card (the card's "Individual immunity win" is in the list). But the failure R3 warned about ("a breakdown in other words would read as a different set of facts") now happens inside the sheet. Conor will stop and match them up. | L2 fluency | Major | captain (full), start, step, bench, table-cell | Use one name per moment across the card, the block, Their numbers and Their story. **Your choice:** the game's rulebook name everywhere, or the show's moment name everywhere. Either way, the "Also:" line must use the exact string the story uses, since those moments aren't in the game's rulebook. |
| 4 | **The marked column in Each episode shows a count, right under a points total.** The raised fill ties the block's "+3.5" to the Each episode column above "Ep 4", but that column's number is "2", a count of moments. In the captain frame, "+11" is tied to a "2". The chart heading "EACH EPISODE" doesn't name its unit; only the right-hand note "9 moments so far" hints at it. The mark sets up a comparison ("this week, there") that the number then breaks. The other chart that's marked (the game row's) is in points and agrees with the block (+3.5 / +3.5), except in finding 2. | L3 (predictive processing) | Minor, leaning Major | step, captain, table-cell, bench | Name the unit in the heading: "MOMENTS EACH EPISODE" (or "MOMENTS" with the episodes under it). Keep the mark: being able to find the week's moments in the season is worth it. |
| 5 | **The door to the night is close to invisible.** "Episode 5"'s underline is `decoration-border` (Night Line #2e2a3a) on the sheet's panel (#221f2c), about 1.2:1, so it reads as a rule under a heading, not a link. The crumb above uses a bright underline for its links, so the sheet has two link styles and the quiet one is the one that matters here. The button is `py-1` on a 26px line, about 34px tall, under the 44px target. The door itself works (night frame: it opens as a level, and the crumb gains "Eric ›"). Note that the week's own "Episode 5" title has the same faint line, so this is shared, not new. | L4 information scent | Minor | start (all block frames), week | Use `decoration-(--edge)` (Control Edge, 3:1, the token for "an edge that has to be seen"), on the block and on the week's own title, so the two still match (R3). Make the button at least 44px tall without changing the type (`min-h-11 inline-flex items-end`). It stays quiet (no yellow, no chevron) and passes R5. |
| 6 | **"Nothing that scores in this game" when nothing happened at all.** Cristian's Episode 5 (zero) and Danny's Episode 3 (season-cell) are "Nothing recorded" in their story and empty columns in the chart. "Nothing that scores in this game" implies he did things that this game doesn't pay for. | L2 / L3 | Minor | zero, season-cell | When the episode recorded no moments for them, use the story's words, "Nothing recorded". Keep "Nothing that scores in this game" for weeks that do have an "Also:" line. |
| 7 | **A pick-pool door lands on a half-cut row.** The pick door (no block, by design) scrolls toward Episode 5 of Their story. The story is the end of the sheet, so the scroll stops short: Episode 5 sits mid-screen, and the last row of Their numbers is cut off under the sheet's header ("+0.5 each … T1 of 18", plus a stray tick at the right edge). The episode's light fades after 1.7 s, so the screenshot (and anyone who glances a moment late) can't see which episode the tap meant. | L1 polish / L4 | Minor | pool-pick | When the target episode can't reach the top, scroll to the start of the section ("THEIR STORY") so nothing is cut off. Leave a lasting quiet mark on the target episode's heading (the raised fill the charts use), not only a fade. |

Not findings (checked, and they hold):
- **Back** returns to the week at the same scroll position (start-back is the week frame, pixel for pixel).
- **‹ ›** sits at the block's foot, muted, with 44px targets (`min-h-11`). Stepping swaps the block in place and moves the marks on both charts (step). The step that doesn't exist is absent, not greyed out (start: only "‹ Ep 4").
- **No yellow** anywhere in the block. No new primary action. No stepper beside the number.
- **Ink tells counted from not counted.** On the bench, the head, the row names and the row points are all muted (bench), and the words say it too. Lost points are muted in the column (−0.5), as DESIGN.md says.
- **Factors read as their own kind of row.** A dashed hairline separates what he earned from what multiplied it, and a factor row has no band mark (captain). That's good grouping: proximity and line style do the work without a label.
- **The doors that shouldn't get a block don't** (cast-wall is unchanged; pool-pick hands the episode only).

## R1–R5: does the build meet the first view?

| Req | Verdict | Evidence |
| --- | --- | --- |
| **R1** one closed group first, at most five rows before a fold | **Met, with one miss on the must-not list** | The block is first and closed by a hairline. It's about 150px tall with one row (start), 210–225px with two or three (step, captain), so Who's photo lands at 376–448px, comfortably in view. The five-row fold exists in code (`FOLD = 5`, "N more") but no frame exercises it, so it's unverified. **Miss:** because typical blocks are shorter than the 200px the first-view doc assumed, its "must not be in it" items, the Each episode chart with its band key and the game row's season total (+8.5 at about 708px), are in the first view of every block frame. That's harmless where the numbers agree. Where they don't, it's findings 2 and 4. Fix those, and don't pad the block. |
| **R2** first fixation on the tapped number and episode, in the week's forms | **Met** | "+1" (34px condensed, tabular) is the largest glyph on the sheet, top right of the content. "Episode 5" (26px condensed) is top left. Same type, same arrangement, same size as the week's head (compare week and start). The castaway's name (22px caps) sits above as a third heavy element, but it's the sheet's title, read in order, not competing. Before, the first fixation was a photo and a bio, and the glance classified the sheet as "a profile". |
| **R3** the card's words, the app's number form, the chart's colours, the week head's layout | **Partly met** | The card's reason is findable ("Went on a journey"; "Individual immunity win"). Signs, the minus sign and halves match the app's form. The band marks match the chart's bands (light teal = Good, dark teal = Great, ember = Setbacks). The head mirrors the week's. **Fails** inside the sheet: finding 3 (two names per moment) and finding 6 ("Nothing that scores" against "Nothing recorded"). |
| **R4** one column that adds up, factors as rows, counted shown by ink and words, the holder named | **Met in the block, broken across the sheet** | Every frame's column closes on its head. The holder is named ("Started for you"; with no holder, "Their points in Weekly Lineup"). **Fails:** finding 1 (the words contradict a 0) and finding 2 (the holder's +11 against the castaway's +5.5/+5 on the same screen). |
| **R5** back unchanged; ‹ › quiet at the foot; the episode's name opens the night; the season charts mark the episode | **Met, with weak scent on the night door** | Back is unchanged (start-back). ‹ › is at the foot. Both season charts get a raised fill on the block's episode, and it moves with ‹ › (step). The night door works (night) but is nearly invisible (finding 5). The counts chart's mark needs its unit named (finding 4). |

## The three people

- **Joanna (forgets)** taps Eric's face with "+1" under it and gets "Episode 5 · +1 · Went on a journey +1": the answer in one glance,
  in the words the card used. She trips in two places. A captain week shows "+11" at the top and "Weekly Lineup +5" lower down (finding 2).
  A bench nobody who "scored, didn't count" with a 0 (finding 1).
- **Andrew (drives by)** asks "did my bench outscore my starters?". The muted "+2" and "On your bench: scored, didn't count" answer
  it without reading further, and Back puts him exactly where he was on the week. Nothing in the block slows him down.
- **Conor (tinkers)** gets every factor as its own row and ‹ › through his weeks without leaving the sheet. He'll also be the one who notices
  "Individual immunity win +4" against "Won the Immunity challenge +4 each" eight rows down (finding 3). He'll notice the marked column's "2"
  under "+3.5" (finding 4), and that his "+11" week sits in a "+5" season (finding 2).

---

## The full evaluation

### Context (step 0)

- **Audience:** players in a couch's game, on a phone, usually the night after an episode, mid-way through reading a person's week.
  Mixed sophistication: Joanna, Andrew and Conor.
- **Intent:** answer "how did he get that number?" in one look, so they feel the game is fair and legible. Then let them go back, or on
  to the next question. Nothing is sold. The "conversion" is a question answered and trust kept.
- **Positioning and model:** a free social game. Trust in the arithmetic is the product's credibility, because the scoring is the
  game.
- **What's already working:** the Lower Third system (Archivo split by width, tabular condensed numbers, hairlines not boxes,
  rationed colour). The week page the tap comes from already has a strong head (title, line, big number), and the block reuses it.
- **Meta-level:** the block is itself a claim ("these rows make that number"), so its execution is the evidence. A sum that closes is
  the trust signal. A sum that's contradicted elsewhere on the sheet undoes it.

### Design system detection

- Framework: Tailwind CSS v4 (`tailwindcss ^4` and `@tailwindcss/postcss` in package.json; utilities like `min-h-11`, `decoration-2`,
  `underline-offset-[5px]`, `motion-safe:animate-[…]`, CSS-variable arbitrary values `text-(--nd-good)` in `cast-sheet.tsx`).
- Component library: the project's own (shadcn-style tokens: `text-muted-foreground`, `border-border`), plus the project's type utilities
  (`type-caption`, `type-num`).
- Confidence: 95. The Tailwind profile was applied. Fixes are given in Tailwind and project-token terms.

### Heuristic rules (step 2)

| Rule | Result |
| --- | --- |
| F-CL-001 element count | Pass: about 12–20 interactive elements in the first view. |
| F-CL-002 / L2-TY-001 font families | Pass: Archivo only. |
| F-CL-003 viewport | Pass. |
| F-CL-004 above-fold density (mobile threshold 4) | Minor: 5 blocks in view (header, the week block, Who, Each episode with its key, the game row). The week block clearly leads, so this is only a cost where their numbers disagree (findings 2, 4). |
| F-CL-006 / L4-NV-001 depth and crumb | Pass: the crumb names every level (night: "Weekly Lineup › alex › Eric ›"). |
| F-PD-001 progressive disclosure | Pass in code (a fold after five rows). Not shown in any frame. |
| L1-FI-001 opening message | Pass: the block's head is the sheet's opening answer. |
| L1-FI-003 visual hierarchy (mobile escalates) | Advisory: three heavy elements in the top 300px (name 22px, Episode 26px, total 34px). They're ordered who → when → how much and read top-down, so not flagged. |
| L2-TC-001 palette / L2-TC-002 near-miss | Pass: band marks use the chart set's exact values. |
| L2-SP-001 spacing | Pass: block rows are a steady 36px (`min-h-9`). |
| L2-BT-001 link/button consistency | Minor: three link treatments in the top 400px (the crumb's bright underline, the episode's near-invisible underline, the steps' muted chevron text). Finding 5. |
| L3-FR-001 urgency | Pass: none. |
| L4-CT-001 single dominant action | Pass by design: the answer, not an action, dominates. No yellow. |
| L4-CT-002 label specificity | Pass: "‹ Ep 4" says where it goes. The episode door's scent is weak (finding 5). |

### Foundation (L0): 76/100 (pass)

- **Reasoning:** The question carried across the tap ("which week, which game, why that number") is answered by one closed group, so
  the reader holds nothing. The block is at most 225px, with rows on one 36px rhythm, so it reads as one chunk. What raises the load is
  what follows it in the same view: Who, a moments chart with its four-item key, and a game row with a second chart. That's 4–5 chunks and
  about 14 numbers in three units (points, moment counts, episode indices) in the first view of start and captain. That's at the top
  of the 3–5 chunk range.
- **Violations:**
  - [Minor] The first view carries the first-view doc's must-not items (the Each episode chart, the band key, the game row's season
    total), because short blocks leave room. *Cowan 2010: the 4 ± 1 chunk ceiling. The answer is one chunk, and three more season
    chunks follow it in the same glance.*
  - [Minor] Mixed units directly under the answer (a points block, then a count chart, then a points chart). *Sweller 1988: telling
    units apart is extraneous load that the layout puts on the reader.*
- **Strengths:** One closed group, with nothing before it. The fold exists in code. The steps are absent rather than disabled when there's
  nowhere to go. The block's height doesn't depend on season length (the steps hold, per the spec's 30-episode case).
- **Fixes:** findings 2 and 4 remove the cost. Padding the block to push the season out is not the fix.

### Layer 1, first impression: 80/100 (pass)

- **Reasoning:** Before, a tap on "+1" opened a photo and bio. The glance classified it as "a profile", and the question went unanswered.
  After, the largest glyph on the sheet is the number they tapped, in the same type and the same place as the week's head. The first
  classification ("is this what I tapped?") succeeds. The visual quality matches the system: flat, hairlines, no box, no new colour.
- **Violations:**
  - [Minor] Three heavy type elements in the top 300px (name, Episode, total). They're ordered, so the risk is small. Stepping the episode
    title down would break R3's match with the week's head, so leave it. *Lindgaard 2006: in the 50 ms judgement, layout and weight register
    before text does.*
  - [Minor] The pick-pool landing's half-cut row under the header reads as a glitch (finding 7). *Tractinsky 2006: a broken-looking
    edge is judged consistently negatively.*
- **Strengths:** The tapped number leads. The head copies the week's head. The before/after difference is exactly the classification the
  first-view doc called for.

### Layer 2, processing fluency: 66/100 (fail)

- **Reasoning:** Within the block, fluency is high: the week's head form, the app's signed numbers with a true minus, band marks in the
  chart's exact colours, muted ink for the bench, and a dashed hairline for factors. Across the sheet, the same moments are named two or
  three ways (finding 3). The empty-week phrase differs from the story's (finding 6). The sheet's links come in three styles (finding 5).
- **Violations:**
  - [Major] Two vocabularies for the same moments on one sheet, plus a third shortened form in "Also:". *Alter & Oppenheimer 2009: fluency
    works below awareness. Two names for one fact read as two facts, and the reader feels it before they can say why. Reber & Schwarz 1999:
    disfluency lowers judged truth.*
  - [Minor] "Nothing that scores in this game" where the story says "Nothing recorded". *Reber & Schwarz 1999.*
  - [Minor] The episode door's underline is near-invisible next to the crumb's bright ones. *Wertheimer 1923: elements that do the same job
    should look alike. Three link looks break the grouping.*
- **Strengths:** The head mirrors the week's. Band colours are exact. Halves and signs are in one form. The bench is muted throughout its row.
  The factor separator is a good grouping device.
- **Fixes:** one moment, one name (your choice which source); "Nothing recorded" for an empty episode; `decoration-(--edge)` on the
  episode door.

### Layer 3, perception bias (trust): 62/100 (fail)

- **Reasoning:** The core trust mechanic works: every frame's rows visibly add up to the head, and factors are their own rows. But the
  sheet contradicts itself in two common situations, and the new episode mark invites a comparison its number can't support. Trust
  is perceived, not argued (as R4 says): a contradiction on screen beats a correct footnote one scroll down.
- **Violations:**
  - [Major] A bench 0 is told it "scored" (finding 1). *Clark 2013: the line predicts points, the 0 and "Nothing that scores" break the
    prediction, and attention fires on the conflict.*
  - [Major] The holder's +11 against the castaway's +5.5 (the week) and +5 (the season) on one screen (finding 2). *Kahneman & Tversky 1979:
    the reader judges against a reference point. "His season" is the obvious one, and a week bigger than a season reads as an error.*
  - [Minor, leaning Major] The marked moments column's count under a points total (finding 4). *Clark 2013: the shared mark predicts "same
    number", and a different one is a prediction error.*
- **Strengths:** Sums close. The holder is named. Counted versus not counted is told by ink and words. Factors that belong to a seat are left
  out when there's no holder.

### Layer 4, decision architecture: 74/100 (pass)

- **Reasoning:** The next steps are in the predicted order and never louder than the answer. Back is unchanged and returns to the exact
  place. The neighbouring weeks are quiet steps at the foot with full targets. The night opens as a level and the crumb records it. The
  season is reached by scrolling, with the week marked. The one weak link is the scent of the night door.
- **Violations:**
  - [Minor] The night door's affordance is near-invisible and its target is about 34px (finding 5). *Pirolli & Card 1999: a door that
    doesn't look like a door has no scent. Green & Swets 1966: an underline at about 1.2:1 sits in the noise.*
  - [Minor] The pick-pool landing has no lasting mark on the episode it was opened for (finding 7). *Pirolli & Card 1999.*
- **Strengths:** No yellow, no new primary action. The steps sit under the rows, not beside the number. History is untouched by a step.
  Ethics: the block shows the real arithmetic, seat factors included, with nothing hidden. Alignment, Sincerity and the Golden Rule all pass.

### Cross-layer patterns

- **The answer is right and the page argues with it.** The block is internally correct. The contradictions all come from the season
  sections below, which now share the first view with it (findings 2, 3, 4). Because the block sits above unchanged sections that use
  other names and other units, its success raises the cost of their inconsistency. Fixing the shared names and units does more
  than adjusting the block.
- **One phrase, carried from a section to a person.** "Scored, didn't count" is true as the week's Bench label and false for a single 0
  (finding 1). Watch for any section label reused as a per-person line.

### Overall: 72/100

(76 × 1.5 + 80 + 66 + 62 + 74) / 5.5 = 396 / 5.5 = 72.0. A clear, well-built answer that does what the user asked for. It's held back by
trust and fluency breaks between the block and the unchanged sections below it, rather than by anything in the block itself. That's
closest to the "good" anchor.

### Top 3 fixes

1. **Remove the two contradictions** (findings 1 and 2). L3 and L0. Expected: L3 +10 (to about 72). The first-view's must-not miss
   stops costing anything.
2. **One name per moment across the sheet and the card** (finding 3, plus finding 6's empty week). L2 and L3. Expected: L2 +10 (to about 76).
   Which name wins is the user's choice.
3. **Name the moments chart's unit, and give the night door a visible, full-size underline** (findings 4 and 5). L3, L4 and L2. Expected:
   L3 +3, L4 +4.

### Dependency notes

No caps apply: Foundation is 76, L1 is 80, and no Critical violations were found. The spread is 62–80.

### Not done, and why

The skill's HTML rebuild of the top fixes and its plugin insight-log append were left out, because this check's brief is one file and no
source edits. The fixes go to the round's one batch of fixes, made by Impeccable. The insight-log entry:

> **2026-11-22: A castaway's week block (Game Your Show).** Type: image. Domain: mobile game dashboard sheet. Key finding: a new answer
> block that's correct in itself raises the cost of inconsistency in the unchanged sections that now share its first view (other names, other
> units, a seat factor shown on one side only). Layers: L2, L3. Promote? Maybe. Notes: related to l015, experiential self-contradiction,
> but here the page contradicts its own new answer rather than a claim.

*Initial findings. Ralph Loop a layer score, cite further, switch to solve / analyze, or ask any follow-up to dig deeper.*

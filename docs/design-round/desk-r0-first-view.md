# The site admin's desk, Round 0: what's noticed first (Perception-First Design, Mode 2)

> **Status (2026-11-22): Round 0.** Derived from [desk-r0-spec.md](desk-r0-spec.md) (Intent's structure, which owns what's on each
> page) and [desk-r0-audit.md](desk-r0-audit.md) (today). This owns what comes first and how much at once. Where it disagrees with
> the spec, it says so as advice.

## 1. The problem

The owner opens the desk to learn one thing: **does anything need me?** Most of the time the honest answer is no, and the desk should
say so and let them leave. Today the first view at 1280 px is a 390 px column in the middle of the screen. Its top is fifteen kinds
of row sorted by kind, some leading nowhere, then four counts in words from before the bot settled results ("confirmed by 2+
sources", "the couches are handling it"). To answer the question, the owner reads every row and decides for each whether it's
theirs. When nothing is waiting, the page is a short list and an empty space, which reads as "maybe it didn't load".

## 2. The layers, bottom-up

### Foundation (L0): cognitive load

- **Constraint.** Working memory holds about 3 to 5 chunks (Cowan, 2001). Unattended clutter still spends it (Hassin et al., 2009).
- **Violation.** The To do list mixes up to fifteen kinds with equal weight. Every row has to be classified ("mine? urgent?") before
  any can be acted on. The old-rules counts add four more items that each need decoding.
- **R1.** The first view **must** present at most **three groups**, each already classified: needs you now · coming up ·
  everything else (one door). Within "needs you now", at most five rows before a fold. Every row names its action in its own words,
  so nobody decides what a row means.
- **Citations:** Cowan (2001) for the 3–5 chunk ceiling; Hassin et al. (2009) for unattended clutter spending working memory.

### Layer 1: first impression

- **Constraint.** The first glance decides whether to engage, in about 50 ms (Lindgaard et al., 2006). At that speed the eye reads
  layout and contrast, not words.
- **Violation.** At 1280, two thirds of the screen is blank margin. That reads as "a phone app stretched", not a workspace. At any
  width, an urgent split and a routine sign-up look the same.
- **R2.** The state **must** be readable before any word is: one strong signal at the top-left of the content (a calm,
  quiet-confident line when nothing waits; a single yellow chyron-line accent when something does, the app's one reserved accent).
  At 1280 the layout **must** fill the width with structure (rail, list, detail), never with margin.
- **Citations:** Lindgaard et al. (2006) for the 50 ms judgement; Leder et al. (2004) for perception before classification.

### Layer 2: processing fluency

- **Constraint.** What is easy to process is felt as true and trustworthy (Reber & Schwarz, 1999). Inconsistency erodes that
  signal (Alter & Oppenheimer, 2009).
- **Violation.** One action has three names ("Ask our bot", "Run now", "Ask it now"). One decision has two vocabularies (the
  episode's Accept or Reject against the Fact page's "It happened"). The header says "Admin" while the doors say "Site admin". The
  desk also saves ten different ways. The owner can't predict what a tap does, so every tap costs attention.
- **R3.** Each concept **must** have one name everywhere on the desk (the spec's names table), and each kind of change one way of
  saving. The first view **must** use the player app's visual system unchanged ("Lower Third": its type, its one accent), so the
  desk reads as the same product.
- **Citations:** Reber & Schwarz (1999) for fluency as felt truth; Alter & Oppenheimer (2009) for inconsistency eroding trust.

### Layer 3: perception bias

- **Constraint.** People act on prediction and notice only what breaks it (Clark, 2013). Trust comes from what's seen, not what's
  argued (Seckler et al., 2015).
- **Violation.** The owner predicts that a quiet desk means all is well. Today a quiet desk can also mean the bot is down (nothing
  says so: M5), or a catch-up that stopped (its row points elsewhere). The prediction breaks only after something has gone wrong.
- **R4.** "Nothing needs you" **must** carry its own evidence: when the bot last ran and what it settled ("Research bot ran 2 h
  ago · settled Ep 9 on 4 games"). Anything that would make that sentence false (the bot down, a hold) **must** replace it as the
  first row, never sit below it.
- **Citations:** Clark (2013) for prediction and violation; Seckler et al. (2015) for trust as a perceptual output.

### Layer 4: decision architecture

- **Constraint.** Make the right action the easiest one (Thaler & Sunstein, 2008). Concrete words for near actions, abstract words
  for far ones (Trope & Liberman, 2010).
- **Violation.** Deciding a split takes four taps and a second page. Settle again is a script. A season's Delete appears on five
  pages, so the riskiest action is also the easiest to stumble into.
- **R5.** Each "needs you" row **must** open straight to its decision, with the evidence beside it (both answers side by side) and
  Undo after. An action that reaches every game (Settle again, release a hold, Delete) **must** take a deliberate hold that names
  what it reaches, appear once, and never be the first or easiest control on a page. Labels are concrete verbs ("Keep this answer",
  "Settle Survivor 51 again").
- **Citations:** Thaler & Sunstein (2008) for choice architecture; Trope & Liberman (2010) for matching words to distance.

## 3. The requirements, together

| | Requirement (all non-negotiable) |
| --- | --- |
| **R1** | At most three classified groups in the first view; at most five "needs you" rows before a fold; each row names its action |
| **R2** | The state reads before the words (one accent when something waits, a calm line when not); at 1280 the width holds structure, not margin |
| **R3** | One name per concept, one way to save per kind of change, the player app's visual system unchanged |
| **R4** | "Nothing needs you" carries its evidence (the bot's last run and what it settled); anything that would falsify it comes first |
| **R5** | A row opens straight to its decision with the evidence side by side and Undo; actions that reach every game hold, name what they reach, and appear once |

## 4. What satisfies all five: the first views

**The shared To do, the first view in every shape:**
- **1280:** top-left of the content area, one line: either **"Nothing needs you."** with its evidence underneath (R4), or **"2
  things need you"** with a yellow chyron-line on the first row (R2). Below it, at most five rows (R1), urgency first: the bot down,
  a split, a stopped catch-up, then sign-ups and reports. To the right, **Coming up** (this week's episodes as a rundown) as the second
  group. The third group is one quiet line: "Everything else: Search, or pick a kind from the rail".
- **390:** the same line and rows, Coming up below them. Nothing else above the fold, and no counts.
- **Must not:** counts without an action ("3 confirmed"), rows that lead nowhere, the old results words, the same thing twice (a
  count of sign-ups and a sign-up row).
- **Eye order:** the state line → the first row's action → Coming up's next episode.
- **Five-second test:** "Does anything need me?" answered by the first line alone, yes or no, with the evidence.

**An episode deciding a split in place:**
- **1280:** the disputed result on top, then the two answers side by side, each with its source line and the bot's two looks. Then
  **Keep this · Use that · Correct it**, then Undo after. The episode's other results sit below, quiet.
- **390:** the result, then the two answers stacked as a pair on one scale (A above B, the difference marked), then the three
  choices.
- **Must not:** a second page, engine words ("Canonical", "house ruling"), or the episode's whole results above the decision.

**A season's what's-left strip:** one row under the season's name: **Rulebook ✓ · Cast ✓ · Schedule — · Games —**. A finished item is
quiet, and the first unfinished one is the strip's only accent. When everything's done, the strip collapses to "Ready · on air from
Sep 24".

**The Research bot page:**
- **First view:** its status line (up, last answer and when, the next run). A down bot puts its state in red text with when it was
  last up, and the day's waiting runs. Below it, the seasons it researches.
- **Must be below the fold:** the Actions (Settle again, the catch-up). They're rare and reach every game (R5).
- **Must not:** Which AI or the tie-break above the seasons. They're set once.

## 5. The shapes, tested (first-view fitness, 0–100)

| Shape | R1 | R2 | R3 | R4 | R5 | Score | Why |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Today | ✗ fifteen kinds | ✗ margin; no accent by urgency | ✗ three names, ten saves | ✗ quiet is ambiguous | ✗ four taps, Delete ×5 | **31** | |
| **1, tabs widened** | ✓ | ◐ the width is list-detail only on lists, so To do at 1280 is still one column unless Coming up sits beside it | ✓ | ✓ | ✓ | **74** | fills the width only partly; the tabs' labels carry the orientation |
| **2, the rail** | ✓ the rail is outside the content, so it isn't a fourth group in the first view if it's quiet (labels, no counts except To do's) | ✓ rail, list, detail | ✓ | ✓ | ✓ | **86** | the rail's ten rows risk L0 if each shows a count or a badge; only To do's count is allowed |
| **3, season-centred** | ✗ one card per season on air, each with its own waiting items: "anything waiting on me?" is a sum the owner does | ✓ | ✓ | ◐ the evidence is per card, so "nothing" is never one sentence | ✓ | **61** | fails R1 and R4 in the most common visit (the check-in) |

## 6. The gap, and advice to Intent

- **The gap no shape closed by itself:** R4's evidence line. None of the three shapes as written says what proves "nothing needs
  you". It's added above to the shared To do, and it needs a small read: the bot's last run per season and what it settled.
- **Advice on Shape 2 (Intent owns the call):**
  - the rail should group its ten rows into three, with dividers and no headings (Now: To do, Coming up; Things: the seven kinds;
    Site: Research bot, Site settings);
  - the rail shows no counts except To do's;
  - the search field sits above the content, not inside the rail, so a known-item lookup starts where the eye already is.
- **Advice on the spec's "This week, re-made":** keep it off the first view. It's an answer to a question the owner asks after a
  night, not on every visit. As a row in Coming up ("Ep 9 · settled · 2 changes after final") it serves R1. As its own block it
  breaks the three-group ceiling.
- **Agreement:** Shape 2 is the strongest first view (86). Shape 1 is a sound fallback (74).

*Initial findings. Ralph Loop a requirement, cite further, switch to analyze / evaluate, or ask any follow-up to dig deeper.*

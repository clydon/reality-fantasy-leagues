# The site admin's desk, Round 0: the check (step 4)

> **Status (2026-11-22): Round 0's one check.** Run once on the 12 grey-box frames (`.ui-atlas/stories/desk-r0/greybox/*.jpg`,
> source `greybox.html`) and today's desk at 390 (`.ui-atlas/stories/desk-r0/before/`), per [DESIGN-PROCESS.md](../DESIGN-PROCESS.md):
> Perception-First Design `evaluate` once, Impeccable `critique` once, findings only. Nothing here was fixed; the fixes are one batch
> after this. Built on [desk-r0-spec.md](desk-r0-spec.md), [desk-r0-first-view.md](desk-r0-first-view.md) and
> [desk-r0-shape.md](desk-r0-shape.md).

## How it ran

- **PFD `evaluate`**: run in this session against the plugin's corpus (layer rubric, constitutional caps, psychology reference,
  heuristics F/L1–L4, learnings l004, l012, l013, l018, l023). No framework profile matched (custom CSS on Lower Third tokens).
  Two of the skill's own steps were **skipped** because this step may write one file only: the HTML rebuild of its top three fixes
  and its insight log.
- **Impeccable `critique`**: Assessment A (design review) and Assessment B (detector + headless browser) ran as two isolated
  sub-agents. The detector found 46 findings in 6 rules; only one matters (the caption over a button, below). Its snapshot under
  `.impeccable/critique/` was **not written** (same one-file limit), and **Questions skipped:** the round's open choices go to the user
  in the screenshot story, not as questions from the check.
- **Today's frames changed mid-check.** The first `before/*.fail.jpg` capture was replaced by a clean re-capture. Scoring used both;
  the only difference seen is that the re-capture no longer has the Next.js dev badge over the times.

## The scores

| | PFD (0–100) | Impeccable (Nielsen, /40) | |
| --- | --- | --- | --- |
| **Today's desk** (390, at every width) | **39** | **17 / 40**, Poor | |
| **Shape 1**, tabs widened | **67** | **24 / 40**, Acceptable | partly low because it's drawn thinner (finding 1) |
| **Shape 2**, the rail (recommended) | **69** | **28 / 40**, Good (low end) | |
| **Shape 3**, season-centred | **51** | **21 / 40**, Acceptable (low) | partly low because it's drawn thinner and off-system |

Both skills rank them the same way: **Shape 2, then Shape 1, then Shape 3, then today**. Both say the gap between Shapes 1 and 2 is
smaller than the frames make it look.

### PFD, layer by layer

Overall = (L0 × 1.5 + L1 + L2 + L3 + L4) / 5.5. No dependency caps applied (no L0 or L1 under 40, no critical violation).

| Layer | Today | Shape 1 | Shape 2 | Shape 3 |
| --- | --- | --- | --- | --- |
| **L0 cognitive load** | **45**: up to 15 kinds of row with equal weight, rows that lead nowhere, four counts to decode; not adapted to a wide screen | **76**: three tabs, one To do list, three groups; the lists are two deep | **74**: three groups in the first view; the rail's 11 rows exceed the 7-item nav ceiling (F-CL-006, Hick 1952), held by grouping in three and the expert-tool qualifier; the season page stacks a strip and a tab row | **55**: the check-in's answer is a sum of cards plus a header button (Cowan 2010) |
| **L1 first impression** | **50**: strong Lower Third character at 390 (tag cuts, plates), but a split and a sign-up look the same; at 1280 a phone column in margin | **66**: To do and Coming up fill the width; rows thinner than Shape 2's (drawing) | **72**: the state line reads before the words; the width holds structure; the yellow is spent three times (count, line, and twice on the split) | **52**: two boxed cards and 55% empty screen at 1280; each card's white name plate outshines its split |
| **L2 fluency** | **35**: three names for one action, two vocabularies for one decision, ten ways to save, a script path in a row | **66**: one vocabulary; two selected-state idioms on one screen (bone tab, raised row) | **60**: mostly one name per thing, but "ran" / "last answer" / "the bot asks" / "next run" for the bot's run; "settled on 2 of 3 games" against "reaches 3 games"; red on a non-delete; a status strip drawn as a second tab bar | **55**: boxed cards and stacked plates against Lower Third's flat sections; two yellow counts |
| **L3 perception** | **30**: a quiet desk can be lying (the bot down says nothing); old results words ("confirmed by 2+ sources") contradict how results work now | **64**: the evidence line, as in Shape 2; Coming up loses its "Last night" line | **68**: the evidence line meets the falsifiability triad (l023: specific, checkable, time-stamped); but the state that would falsify it (the bot down) isn't drawn, and names are shown on an episode the owner may not have watched | **42**: no evidence line in any frame; "Nothing needs you here" per card can't be checked |
| **L4 decision** | **30**: four taps and a second page to decide a split; Delete on five pages; the Research bot spread over five homes | **58**: lists and the Research bot one level deeper; Search lists six kinds, no Seasons; the split in place not drawn for this shape | **70**: Decide is one click; the verbs quote the values (Keep "Voted out" · Use "Quit"); reach and Undo in one sentence; but the Settle hold is in the first view, red, and names no season; "Approve" on two people doesn't say both | **50**: the split is one tap on a phone (the best of all); sign-ups and reports two doors away; no search; seasons off air have no door |
| **Overall** | **39** | **67** | **69** | **51** |

Self-check: Shape 2's five layers sit within 14 points. The rubric treats that as a flag for lazy scoring. It was re-examined and
kept: a grey box drawn to one brief is evenly mid-to-good, with no layer failing outright. Today's 39 is above the first-view
document's 31 because this scores the pages' perception, not their fit to R1–R5.

**PFD's top three fixes** (highest lift): draw the state that falsifies "Nothing needs you" and hide names until watched (L3, Shape 2
to about 75); spend the one yellow once (L1/L2); make the what's-left strip a quiet line and push the bot's Actions below the fold
(L0/L4).

### Impeccable, Nielsen's heuristics (0–4)

| Heuristic | Today | Shape 1 | Shape 2 | Shape 3 |
| --- | --- | --- | --- | --- |
| 1 System status | 2 | 3 | 3 | 2 |
| 2 Real-world match | 1 | 3 | 3 | 3 |
| 3 Control and freedom | 2 | 2 | 3 | 2 |
| 4 Consistency | 1 | 3 | 2 | 2 |
| 5 Error prevention | 2 | 2 | 3 | 2 |
| 6 Recognition | 2 | 2 | 3 | 2 |
| 7 Flexibility | 1 | 2 | 3 | 1 |
| 8 Minimalist | 2 | 3 | 3 | 3 |
| 9 Error recovery | 1 | 2 | 2 | 2 |
| 10 Help | 3 | 2 | 3 | 2 |
| **Total** | **17** | **24** | **28** | **21** |

Cognitive-load checklist failures: Shape 1, 1 (rows without a detail line make the owner open them to judge them); Shape 2, 2 (the
season page's hierarchy; the bot's Actions in the first view); Shape 3, 3 (no single focus, a sum held in memory, urgent site work
behind a door). Design specificity: the structure is any hosted console's; the state line with its evidence, Coming up as a
rundown and the split's quoted verbs are this product's. Today's desk at 390 has more Lower Third character (the angled tag cuts,
the research timeline's NOW line) than any grey box.

## Findings, ranked

Each: the frames, what's wrong, why it matters to the owner, the fix. **[Drawing]** is about how the grey boxes are drawn;
**[Structure]** is about the shape itself and would survive a redraw.

1. **The shapes aren't drawn to the same depth, so the comparison isn't fair.** [Drawing] *(Impeccable P0; PFD agrees)*
   `s1-night-1280` drops the detail lines Shape 2's identical To do has (no "zt_new_one, zt_new_two · sign-up approval is on", no
   `"My lineup didn't save" · yesterday`) and Coming up's second lines and its Last night row. Shape 3 has no evidence line, no
   Coming up, no search and no frame of the season workspace it's built around, and is drawn in boxes the system doesn't use.
   Deciding in place, which the spec says every shape shares, is drawn only for Shape 2. Shape 2 has six frames, the others three.
   **Why:** Round 0's one job is a fair choice. The owner will read Shape 2 as richer when part of the difference is drawing.
   **Fix:** use the same To do markup in Shapes 1 and 2 and say in the story that it's identical; draw Shape 3 flat with the evidence
   line and a search; add a Shape 3 season workspace frame; label the split frame "every shape".

2. **The desk spoils the owner's own episode.** [Structure] *(Impeccable P1; PFD L3)*
   `s2-night-1280`, `s1-night-1280`, `s3-home-1280` ("Jelly · two answers disagree on how they left", "Jelly · how they left") and
   `s2-split-1280` (VOTED OUT / QUIT, "Immunity · Ori", "Found an idol · Kristin"). Today's episode page has **Hide names**, on by
   itself for an episode you haven't seen (`src/new/desk/episode.tsx`). **Why:** the owner also plays, on the couch, and may open the
   desk before watching; "never spoil" is product principle 3, and the spec and first-view docs don't carry it. **Fix:** the To do
   row reads "Episode 9: one result is split · how someone left" until the owner has watched; the split opens behind one Show names
   tap; draw that state in one frame. Add it to the spec's shared rules.

3. **The states that test the shapes aren't drawn.** [Structure] *(both)*
   No frame shows the bot down (S5), the one state R4 says must replace "Nothing needs you"; nor the finale and Settle again (S6), a
   sign-up wave in Shapes 1 or 2 (S4), the split at 390 stacked on one scale (the first-view doc specifies it), or Shape 2's phone
   home with the Menu closed (`s2-night-390` shows it only under the sheet's scrim). **Why:** "is the quiet desk lying?" is the
   check-in's core risk, and the phone is the episode-night device. **Fix:** add the bot-down To do (1280 and 390) for every shape,
   `s2-split-390`, and `s2-night-390` with the Menu closed.

4. **The one yellow is spent three or four times.** [Drawing, but it would mislead the build] *(both)*
   `s2-night-1280` and `s2-night-390`: the rail's yellow "3" and the row's yellow line. `s2-split-1280`: both answers underlined in
   yellow (so the line marks nothing) plus the rail's "3". `s2-season-1280`: the Schedule underline beside three white fills.
   `s3-site-1280`: two yellow counts. The row's line is drawn as the row's **bottom** edge (`.row.hot`, inset bottom shadow), so it
   reads as a divider above "2 people want to join". **Why:** R2 and DESIGN.md's One Chyron Rule: the eye should find the one thing
   waiting before reading. **Fix:** counts in bone; yellow only on the most urgent row, attached to it (a left bar or its top edge);
   on the split, mark the difference with position or weight, not yellow on both.

5. **The Research bot's Actions break the rules set for them.** [Structure and drawing] *(both)*
   `s2-bot-1280`: "Settle a season again · Hold to settle…" sits inside the 1280×800 first view (the first-view doc: "Must be below
   the fold"). It's drawn in Live Red, which DESIGN.md keeps for leaving and deleting; settling again deletes nothing. It names no
   reach ("a season", not "Settle ZT Survivor 51 again · 3 games", R5). "Release the catch-up hold" and "Try again" are off the frame.
   "When answers disagree" sits under the Which AI heading, though the spec gives it its own section. The On/Off controls are drawn
   as buttons, so it's unclear whether they show the state or change it, and a finished season (ZT Survivor 50, "season over") still
   has one. **Fix:** Actions below the fold (or folded to "Actions (3)"); a neutral outline that fills as you hold; choose the season
   inside the hold, which then names it and its games; switches, not buttons; no switch on a finished season.

6. **The what's-left strip looks like a second tab bar, with its emphasis backwards.** [Drawing and structure] *(both)*
   `s2-season-1280`: a bordered segmented row (Rulebook · done | Cast · done | Schedule · next | Games) directly over the season's
   page tabs (Setup · Research · Cast · Bingo · Episodes); "Cast" is in both. Done items are bright, the unfinished Games is muted
   with no state word. The first-view doc asks the opposite: done quiet, the first gap the only accent. The spec also asks for the
   season's pages "as a rail at width"; they're drawn as tabs. **Fix:** one quiet text line under the name ("Rulebook ✓ · Cast ✓ ·
   Schedule — · Games —"), each a link, the first gap in chyron-line; or fold the state into the page tabs so there's one row.

7. **The words and the data contradict each other.** [Structure, words] *(Impeccable P2; PFD L2/L3)*
   - "settled Episode 9 on 2 of 3 games" (To do) against "Your choice reaches 3 games" (the split).
   - The bot's run has four names across frames: "ran", "last answer", "the bot asks at 11 PM", "next run Wed 11 PM".
   - Coming up lists "Last night" under its heading, below two future episodes.
   - Traitors 5 is "Episode 5 · settled" in Shape 3 and "watched only · no games" in Shape 2.
   - The bot page lists ZT Survivor 50; the Seasons list doesn't, and has no filter to say why.
   - "Approve" on a row of two people doesn't say whether it approves both.
   - The search placeholder ("people, couches, games, shows, join codes") leaves out seasons and cast, the things worked on most.

   **Fix:** one reach number; one name for the bot's run (the spec's names table should add it); "Last night" as its own line
   above Coming up, or the rundown in time order; "Approve both" or "Review 2"; "Search seasons, people, couches, games, join
   codes…".

8. **Shape 3 is drawn off the system, and the 1280 view is mostly empty.** [Drawing, partly structure] *(both)*
   `s3-home-1280`, `s3-home-390`: panel-filled cards with a border and 6px corners (DESIGN.md: sections flat, no card box, nothing
   rounded past 4px) and a white plate per card (DESIGN.md: plates for single moments, never stacked as list items). At 1280 two
   cards fill the top 45%; the rest is ground. At 390 "Site · 3" is an unexplained number, and the cards drop "Jelly · how they left"
   and the next episode. **Fix:** draw it flat (a season block per heading, hairlines), the evidence line on top, "Site · 2 sign-ups ·
   1 report" spelled out at 390.

9. **Phone sizes and the Menu sheet.** [Drawing mostly] *(Impeccable P2; detector)*
   Every button is 36 px tall, every tab and rail row 36.3 px (`s2-night-390`, `s1-quiet-390`, `s3-home-390`): under DESIGN.md's 44 px
   targets and 48 px rows. The rows drop their detail lines at 390. The Menu sheet has no title and no close, unlike DESIGN.md's
   sheet. Shape 1 puts its tabs at the top on a phone. **Fix:** 44 px controls, 48 px rows; keep detail lines; a titled sheet with
   Close; say whether Shape 1's phone tabs are at the top or the foot.

10. **Shape 1's Search isn't one keystroke away and is missing Seasons.** [Structure] *(Impeccable)*
    `s1-search-1280`: the search field is inside the Search tab, and its lists are People, Couches, Games, Shows, Reports, Library:
    six, not the spec's seven, with no Seasons. At width this Search is already a rail, list and detail, so Shapes 1 and 2 differ
    mainly in whether that rail is always there. **Fix:** add Seasons; say plainly in the story that the real choice between 1 and 2
    is "the rail always on screen, or one tab away".

11. **Coming up appears twice in Shape 2 at width.** [Structure] *(Impeccable)*
    `s2-night-1280`, `s2-quiet-1280`: a rail row "Coming up" while the right pane already shows it. **Why:** a wasted click and a
    fourth rail group's worth of noise (R1). **Fix:** at width the rail row opens a fuller rundown (two weeks, all seasons), or
    leaves the rail; at 390 it stays.

12. **The power-user path isn't drawn.** [Structure] *(Impeccable, Alex)*
    No filter or sort on the lists (the spec promises search, filters and sort in the address), no Approve all for a sign-up wave,
    no keyboard path ("/" to search, Enter to Decide). **Fix:** draw a list's filter row once (Seasons: on air · setting up · over),
    and Approve all on the sign-ups row.

13. **Small drawing slips.** [Drawing]
    - In `s2-season-1280` and `s1-search-1280` the selected list row's fill overhangs the hairlines by 12 px each side (`.selected`
      margin).
    - In `s2-split-1280` the rail still says To do · 3 on the episode page; after a decision it should drop to 2.
    - The split page has a breadcrumb, which DESIGN.md doesn't use (see disagreement 3).
    - White fills are used for buttons, the active tab and plates alike; DESIGN.md keeps white for plates and the You badge.

14. **The "before" doesn't match the "after".** [Story] *(PFD)*
    Today's desk is captured only at 390, so the claim that drives the round (at 1280 it's a phone column in two-thirds margin) has
    no frame. Its data is a different moment (Episode 5–6, Nov 18–25) from the grey boxes' Episode 9, so no situation is shown before
    and after. Today's Inbox count is in Live Red, against its own rule. **Fix:** capture today's home at 1280, and the before frames
    on the zt Episode 9 state where it exists.

15. **The first-view doc cites studies PFD's corpus doesn't hold.** [Process] *(PFD)*
    Hassin et al. 2009, Leder et al. 2004, Seckler et al. 2015, Trope & Liberman 2010 and Cowan 2001 (the corpus has Cowan 2010).
    PFD's rule is to cite only its loaded reference or say "practitioner observation". The requirements stand; the citations
    should be marked.

## Where the two skills disagree

Stated, not settled (DESIGN-PROCESS.md: each skill wins only in its own question; a choice that changes what the owner experiences
goes to the user).

1. **Where the one yellow goes.** PFD (what's noticed first): the yellow marks the **state**, a chyron line on the waiting row,
   so the eye finds what's waiting before any word (R2), and the brief draws Decide as a bone fill. Impeccable (how it looks):
   DESIGN.md makes the chyron fill "the primary action" and "yellow only for what you must do"; deciding a split is a must-do, so
   the yellow belongs on the **Decide button** as a fill, with the row quiet. Either way it's one yellow; the user picks which.
2. **Shape 3's phone speed.** Impeccable notes Shape 3's phone home is the fastest to the split (one tap; the spec's table agrees)
   and asks whether a hybrid would beat all three: Shape 2's rail with Shape 3's on-air season blocks in the right pane where Coming
   up sits. PFD scores Shape 3 lowest because the check-in answer becomes a sum and loses its evidence line (R1, R4), and would
   keep one To do list on top. Where things live is Intent's call; this goes to the user as a named option.
3. **The split page's breadcrumb.** PFD (L4, information scent, Pirolli & Card 1999) credits "To do › ZT Survivor 51 › Episode 9" as
   the return path on a deep page. Impeccable records it as a deviation from DESIGN.md, which uses no breadcrumb trail, and leans to
   keeping it as long as it's recorded. Small; it needs a line in DESIGN.md either way.

## Overlapping or clipped text (frames at full size)

- **`s2-bot-1280`:** the fixed caption "Grey box · Round 0 · not approved" sits on top of the "Start…" button in the Start a
  catch-up row (about 40×6 px; `.mark` is `position: fixed`, `z-index: 9`). The only real overlap in the grey boxes.
- **`s2-bot-1280`:** the Start a catch-up row is cut by the frame's bottom edge (the page is 835 px in an 800 px view), button border
  included; the rest of Actions is off the frame.
- **`s2-night-390`:** the caption "… · the Menu open" sits in the sheet's foot just under "Site settings". It doesn't touch it but
  reads as a sheet item. (The sheet covering Coming up and the dimmed rows is intended.)
- **Today, `before/desk-r0-find.jpg`:** the search placeholder is cut mid-word: "A show, season, castaway, couch or persc".
- **Today, first capture (`*.fail.jpg`, since replaced):** the Next.js dev badge covered "WED 8:00 PM" on the home and an episode
  row's icon on the season page. Not in the re-capture.
- Detector, separately: the caption is 11 px at 4.3:1 contrast (under 4.5); a mock label, not product text. No product text is
  under 13 px or under AA contrast; nothing overflows its box or scrolls sideways.

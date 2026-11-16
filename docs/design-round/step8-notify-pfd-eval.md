# Notifications and waivers: PFD evaluation of the built pages (step 8, Mode 1)

One evaluation of the after frames at 390 px (`.ui-atlas/stories/step8-notify/after/`, `.ui-atlas/stories/step8-waivers/after/`),
against [the spec](step8-notify-spec.md) and [the first-view requirements](step8-notify-first-view.md). The before frames were read
for comparison only. The waivers source (`src/new/show/waivers.tsx`) was read to confirm two behaviours a still frame can't show:
Bring in claims in one tap with Undo in the toast, and the weekly bars share one maximum across the options and the team. The HTML
rebuild of fixes and the insight log that the evaluate skill normally adds were skipped: this run was read-only except this file.

## Context

- **Audience:** a friend couch playing fantasy games on a TV show, on phones. Joanna forgets, so the page has to carry the move and
  the safety net; Andrew drives by and wants two taps; Conor tinkers and wants the numbers to decide.
- **Intent:** the bell is the record of what changed; waivers answers "who comes in, and by when", then "what happened".
- **What's already working:** the Lower Third plate (a yellow episode wedge on a white slab) now carries the move once, and yellow
  appears only where a move is due (the plate, the Reveal button). The art thumbnails and per-row dots are gone from the bell. The
  sticky foot and the ticking countdown are gone from waivers. The spoiler gates (Sam, Josie) are clean, single-purpose screens.
- **Design system:** Tailwind utility classes on a custom token set (the Lower Third system). No corpus profile was applied; it was
  judged against general perception principles.

## Scores

| Layer | Score | Why, in one line |
| --- | --- | --- |
| Foundation (L0), cognitive load | 76 | The bell and the owed page each say one fact once; the ran page, the swap week and the picker still repeat themselves |
| L1, first impression | 70 | Waivers opens on the move; the bell's dot is too small to register, and the ran page leads with a count, not your news |
| L2, processing fluency | 66 | Yellow discipline holds; wording, time format, the game switch and the selected-state fill drift between frames |
| L3, prediction | 74 | Newest first in New and Earlier, stale reminders gone, options on the page; a swap week and ties break the model |
| L4, decision architecture | 78 | Three best options, one tap to claim with Undo, the deadline stated; the bars are too small for Conor to compare |
| **Overall** | **73** | (76 × 1.5 + 70 + 66 + 74 + 78) / 5.5 |

No dependency caps apply (no layer under 40, no critical violation). The spread is narrow (12 points) because each requirement R1–R5
targeted one layer and the build met most of them; the remaining issues are majors and minors, not layer failures. The closest
anchor is "good" (65–75). The before frames were not scored formally; on the same rubric they would sit roughly 20 points lower,
mainly on L0 (nine chunks on the owed page, ten pictures in the bell) and L2 (yellow meaning "new").

Ethics: passes Alignment, Sincerity and Golden Rule. The countdown is gone (no manufactured urgency, Kahneman & Tversky 1979: the
loss frame is no longer pumped), the safety net is stated beside the choice, and a one-tap claim comes with Undo.

## Findings, by severity

| # | Severity | Frame | Layer | Finding | The change that fixes it |
| --- | --- | --- | --- | --- | --- |
| 1 | Major | hub-bell-dot | L1, L4 | The bell's "new" dot is about 4 CSS px of white at the icon's corner. It is the only cue for Andrew, who ignores pushes and opens the bell days later, and at that size it hardly stands out from the icon (Green & Swets 1966; Fogg 2003: what isn't prominent isn't read) | An 8–10 px dot in the foreground colour with a 2 px ring of the header's background, offset off the glyph; keep it not-red |
| 2 | Major | processed-classic-sam | L0, L1 | The ran page says each of your moves twice in one view: two result cards ("Maggie for Jelly", "Patt for Kilby"), then the same two rows in Everyone's moves. The headline "2 swaps went through" is a count, not the news (R2 asked for "You got Maggie for Jelly") (Cowan 2010; Lindgaard 2006) | Plate: "You got Maggie and Patt", line "for Jelly and Kilby · 2nd choices"; drop the two cards; Everyone's moves stays the one list, your rows marked "You" |
| 3 | Major | waivers-alex, open-classic-sam | L4 | The weekly bars are about 30 px wide for five episodes, with no episode marks and no values. Conor can see who has some points but can't compare weeks across rows, which was R5's point. When every row is zero the column is a run of dashes that costs width and says nothing (Hertwig & Erev 2009 via the first-view doc; Wertheimer 1923: the bars don't group into a readable scale) | Widen the bar column to ~64 px, mark the latest episode's bar, and show the points on tap; when all shown rows are zero, hide the column and say "No one has scored yet" once under the heading |
| 4 | Major | open-classic-kim | L3, L4 | A swap-only week shows Your team with three equal Swap buttons and no one who's free. To find out whether any swap is worth it, someone has to open the picker from a row, which is the old two-sheet path R4/R5 removed for the owed case. The spec's situation table puts Who's free on this page | Show the top three free under the move, read-only with their bars, plus "All N free"; Swap on a team row stays the way in |
| 5 | Major | waivers-alex vs open-classic-sam | L2 | The game switch is two different controls depending on the context: pills under the bar in one fixture, a "⇆ Outlast" chip in the bar in the other. The spec asked for one control, shown only with two games (Reber & Schwarz 1999; Clark 2013) | One control everywhere: the pills when two games run waivers, nothing when one does; remove the bar chip |
| 6 | Minor | claimed-classic-sam | L2, L3 | After a claim, the section heading changes from "Who comes in" to "For Jelly", so the same list gets a new name | Keep "Who comes in" and put "for Jelly" in the sub-label |
| 7 | Minor | open-classic-sam | L3 | "Forget, and whoever's free with the most points comes in" can't be predicted when every free person has 0, which is a real early-season state | Add the tie-break in the same line ("…most points, then the picking list's order") |
| 8 | Minor | waivers-alex | L2 | White fill means "selected" (the Outlast pill, the "You" chip) and is also the move plate's slab. The selected pill sits right above the plate, so two bright slabs compete in the first view | Mark the selected pill with an outline or underline instead, so white fill belongs to the move plate |
| 9 | Minor | hub-bell, hub-bell-sam | L2 | The push grammar drifts. The bell shows "8:00 PM" where the spec has "8 PM" and "ZT Survivor 51" where it has the short name. The join and joined rows don't start their body with the show. Sam's alex reminder buries the sender in a three-line body | Format times as "8 PM"; use the short name; start every body with the show; title the nudge "alex: your Ep 6 moves are open" (the spec's wording) |
| 10 | Minor | hub-bell-more | L2 | Earlier rows have the same weight as New rows (white titles), where the spec has them "a step quieter". New and Earlier are told apart only by their headings | Earlier titles in the secondary text colour and icons at reduced opacity |
| 11 | Minor | hub-bell | L1 | With something new, the sheet's head shows no count, but with nothing new it says "Nothing new". The spec's head said "3 new" | "Notifications · 8 new" in the head's sub-line, matching the "Nothing new" state |
| 12 | Minor | processed-classic-sam | L3 | Free agency says "nothing left to move this week" next to a deadline and an "All 5 free" link that implies a move | When nothing can move, drop the deadline and label the link "See who's free" |
| 13 | Minor | waivers-riley | L4 | Riley's quiet week shows only the picking order and How, with no Last time and no read-only Who's free, so 60% of the frame is empty. idle-classic-sam does show Last time | Show Last time when a run exists, and the read-only Who's free in every quiet week (the spec's quiet-week row) |
| 14 | Minor | hub-bell | L4 | The first-view doc has notices that need a decision lead New. The watch along asking "Are you in?" sits third, behind a move | Sort decision rows (requests, Are you in?) to the top of New, then the rest newest first |
| 15 | Cosmetic | waivers-pick | L0 | The picker's sub-line repeats the title's "Carter" and the plate's deadline | Sub-line "Ranked by points, episodes 1–5" or nothing |
| 16 | Cosmetic | processed, idle (sam) | L2 | In Everyone's moves, your tile and Kim's are the same orange "Z", so your rows only show by their wording (partly the zt fixture's names) | Mark your rows with the "You" chip used in Picking order |

## The requirements, met or not

| | Verdict | Evidence |
| --- | --- | --- |
| R1 one fact once | **Met on the bell and the owed page; partial elsewhere** | Bell: no due row, no repeated art, no per-row dot (hub-bell). Owed waivers: the move, the deadline and the options once, no sticky foot, one accent (waivers-alex). Repeats remain on the ran page (#2), in the swap week's "1 free" said twice, and in the picker's sub-line (#15) |
| R2 the news first | **Mostly met** | Waivers opens on "Replace Carter", then "by Wed 8:00 PM · in 2 days". The bell's first row is the newest and a decision. The ran page leads with a count (#2). The push on a lock screen isn't rendered, so the bell's titles stand in for it ("Replace Carter by 8:00 PM", "Ep 6 locks in about 3 days": both inside ~32 characters, the change first) |
| R3 one grammar, one colour | **Partial** | The colour rule is met: yellow only on due moves, the bell's dot not red, red only for Out. "Replace Carter" reads the same on the bell and the plate. The grammar drifts in time format, show name and body order (#9), the game switch (#5), the heading (#6) and the white fill (#8) |
| R4 every way in keeps its promise | **Met for the bell and the owed page; partial for swap weeks** | Newest first in New and Earlier; the stale "airs in about 2 hours" reminder is gone; the owed page shows who could come in. The swap week shows no one (#4). Push tap landings aren't shown in these frames, so they're unverified |
| R5 decide where asked | **Met, with a legibility gap** | Three best first, Bring in claims in one tap with Undo (the toast in source), All N free a tap away, the deadline stated (minutes only inside the last hour, per `stated()`), the safety net beside the options, bars on one shared scale. The bars are too small to compare (#3) and ties are unexplained (#7) |

## Top three fixes

1. **Make the bell's dot findable (#1).** L1 and L4; about +4 to L1. It is the only thing that brings Andrew back.
2. **Say the ran week's news once (#2) and give a swap week its options (#4).** L0, L1, L3 and L4; about +3 to L0 and +3 to L3.
   Both carry the owed page's pattern to the other waiver states.
3. **One control and one wording per meaning (#5, #6, #8, #9).** L2; about +8. None of these is large alone, but together they are
   the gap between "one mind designed it" and what's built.

*Initial findings. Ralph Loop a layer score, cite further, switch to solve / analyze, or ask any follow-up to dig deeper.*

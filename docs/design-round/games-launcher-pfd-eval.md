# Games launcher: PFD evaluation (Mode 1)

2026-11-21. One run of perception-first-design:evaluate on the real 390 px renders in
`.ui-atlas/stories/games-launcher/after/` (week, join, archive, watcher, busy, behind, draft, sport, short,
patterns kinds-1/2), compared with `before/` (week, watcher, busy). Read-only: no redesign, no code. The
skill's HTML rebuild and insight log were skipped (this check edits nothing but this file).

## Score: 71 / 100

| Layer | Score | Status | In one line |
|---|---|---|---|
| Foundation (L0) load | 78 | pass | Week page 5154 → 2944 px, busy 8012 → 3066 px; standings tables gone; one row a game |
| L1 first impression | 76 | pass | Strip owns the yellow and the first glance; For Ep 7 rows sit right under it |
| L2 fluency | 68 | fail | One row grammar, one button style; but a two-dot gutter, a 6-hue kind code and rank numerals louder than the name |
| L3 bias / honesty | 70 | pass | No countdowns, no open-spot counts; faces are true social proof; a few labels point at the wrong game |
| L4 decision | 60 | fail | Strip is a clear primary; inside the list, due moves can fold away, and your move looks like a Join |

Overall = (78 x 1.5 + 76 + 68 + 70 + 60) / 5.5 = 71. No caps apply (Foundation and L1 above 40, no
critical). Calibrates near the "good" anchor (65-75). A rough read of the before tab on the same rubric
lands in the mid 50s: Foundation was the failure (a 300 px card a game, 7 yellow Joins for Casey).

## Context (Step 0)
- Audience: a friend group on phones; Joanna (forgets, "anything tonight?"), Andrew (am I set, leave),
  Conor (starts games), Casey (watches only, needs a pressure-free way in).
- Intent: "what can I play, and how do I get in?" No results here (Tonight has them).
- Design system: custom Tailwind-style tokens, dark "Night" theme, condensed display caps + grotesk body.
  Tailwind profile applies loosely (confidence ~60); judged on general perception principles.

## What's working (keep)
- The strip is the one yellow fill and states the night's moves in a sentence (L1, Fogg 2003 prominence).
- One row per longer game with a constant grammar: name + length, faces, move state, place (L2, Wertheimer
  1923 similarity). Joins are ghost buttons now, not seven yellow fills (L4 d-prime restored for the strip).
- Due moves get three redundant cues: bold white line, dashed empty slot, due dot.
- Honest copy: "2 in · from Ep 7", "One pick · before you watch". No scarcity, no timers (Ethics: pass).
- Behind state: the strip goes grey and "Reveal Ep 4" takes the yellow; gated rows say why.

## Findings, by severity

### Major
1. **The fold hides due moves** (busy.full). Four rows show (Couch Cup, with nothing due, first), then
   "4 more games · Fire Tokens Cup · Last One Standing · The Tribe Has Spoken…". In the before frame Last
   One Standing and The Tribe Has Spoken both had a lineup or pick due. Andrew cannot confirm "I'm set"
   without opening the fold; the list's signal is lost to the fold (Green & Swets 1966: a hidden signal has
   d' of zero). Smallest fix: rows with a move due never fold (sort due first within the visible five), and
   the fold line says "all set" or "1 needs a pick".
2. **Place outweighs the move** (week.s2, busy, patterns). "1st / 3rd / 4th" is set in the display face at
   about the game name's size, the heaviest mark in each row, while the due cue is an ~8 px dot. On a page
   that holds no results, the scan path lands on standings first (Lindgaard 2006: the first-fixation
   impression sticks). Smallest fix: drop the place numeral to the body face at the state line's size (keep
   "of 4" beneath), so the name and the move line lead.
3. **Two dots, two meanings, one gutter** (week.s2, draft, sport, patterns.kinds-1). Each row has a coloured
   kind dot beside the name and a yellow due dot directly under it: same size, same shape, same column.
   Proximity makes them read as one status mark; the kind code (orange, blue, teal, purple, green, grey,
   repeated across games) is explained nowhere on the page, and five yellow dots in patterns dilute the
   strip's ownership of yellow (Wertheimer 1923; Bujack 2022 on hue load). Smallest fix: drop the due dot
   from rows (the bold line and dashed slot already carry it), or make it a different shape on the right.
4. **The strip names a game you're not in** (week.top, short.top). Strip: "Set your lineup · Pick who
   survives". Below it, "WHO SURVIVES?" is a one-episode game jordan is NOT in (Join). The move it means is
   Survival Pool's "Pick a survivor". In short, "Pick who survives · Fill in your sheet" omits Match the
   Majority and Split the Pot, whose buttons say "Answer". Broken scent (Pirolli & Card 1999). Smallest
   fix: strip phrases use the rows' own words ("Pick a survivor") or game names, never a game's title as a verb.
5. **Your move looks like a Join** (week.top, short.top). "Who goes home? · Pick" (yours) and "Who
   survives? · Join" (not yours) are identical ghost buttons; the only "you're in" cue is a 24 px dashed
   avatar tile. Joanna scanning for "mine" gets no pre-attentive split (Hick 1952: equal options cost
   decision time). Smallest fix: a small "Yours" / "You're in" label on the line, or a filled (not yellow)
   button for your own move, ghost for Join.
6. **Casey's lightest way in is the quietest thing** (watcher.top, watcher.full vs before). For someone with
   no games the page opens on seven equal Join/Ask buttons; the no-commitment extras (bingo, trivia, calls,
   polls), which before were a visible "This week" list, are now a grey fold line. Nothing says watching is
   fine. Not a dark pattern, but the pressure-free option has the lowest salience (Thaler & Sunstein 2008:
   the easy choice should be the visible one). Smallest fix: open the extras fold by default when you're
   in no games.
7. **"Again" repeats a name already on screen** (week.top, busy.top). "Again for Episode 7 · [Who
   survives?]" sits under a live "WHO SURVIVES?" row with Join. Same label, two different actions (start a
   new copy vs join the running one); before said "Who survives? Ep 6". Prediction error (Clark 2013).
   Smallest fix: hide an Again chip whose kind is already on for this episode (the spec says "kinds not on
   again yet"), or label it "Start another Who survives?".

### Minor
8. **Behind shows the wrong episode's games** (behind.full). Sam (through Ep 3) gets "FOR EP 7" with two
   rows that only say "Reveal Episode 4 first"; the spec has his next episode's games. "Reveal Episode 4
   first" appears four times on the page. Fix: per the spec, For Ep N follows his mark; one gate line, not four.
9. **Archive bars encode nothing by length** (week.archive). Every bar spans the full width; side is shown
   only by the number's position, and riley's white bar is the brightest object on the page. Fix: bars grow
   from the centre "Level" line toward the ahead side, length = count.
10. **Header counts with no noun** ("1 on the couch", "5 on the couch"). Reads as people, not games. Fix: "1 game".
11. **Merge Lineup row breaks the grammar** (week.s2, patterns.kinds-2). No faces, no place, "2 players" alone
    on line two: looks unfinished next to full rows. Fix: faces of who's in, "Starts Ep 9" as the state line.
12. **Finished row's "1" numeral** (week.s2). The big display "1" beside "Finished game" reads as a place;
    teal "1 first · most on the couch" is a results colour on a no-results page. Fix: body-size count, grey text.
13. **Join sheet says the name three times** (week.join): heading, sub-line, button "Join Who survives?"; a
    "?" inside a button reads as a question. Fix: heading "Join Who survives?", button "Join for Ep 7".
14. **Ask and Join look alike** (watcher.top). Ask is a request someone answers; same button, same weight.
    Fix: "Ask to join" in full (as before), so the different outcome is said.

## Top 3 fixes (highest impact)
1. Never fold a row with a move due; the fold line says whether anything inside needs you. L4 + L0. ~+6 L4.
2. Quiet the place numeral and remove the row due dot. L2 + L4 (one change, two layers). ~+5 L2, +3 L4.
3. Strip phrases in the rows' words; mark your own one-episode game apart from Join. L3 + L4. ~+4 each.
With all three: about 76 overall.

## Self-check
Layer spread 60-78 (18 points). Citations only from the loaded MVS reference. Settled rules respected: Z
tiles not reported, one yellow fill judged as met by the strip, no pressure tactics found.

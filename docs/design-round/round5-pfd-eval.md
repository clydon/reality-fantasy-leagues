# Round 5 (a draft that waits, three fixes, the preview's path): Perception-First Design evaluation

Mode 1, run once on the built frames at 390 px (2x) and the sheet at 1440: `.ui-atlas/stories/game-preview/draft/` (runner and
player, no time set and a time set), `story/` (the path and the sheet), `round4/` (before), and
`.ui-atlas/previews/fantasy-51/shots/after-team.jpg` and `after-tonight.jpg`. Held against
[draft-start-first-view.md](draft-start-first-view.md) R1 to R5 and [preview-story-first-view.md](preview-story-first-view.md)
"Round 5" R1 to R5, with both specs and DESIGN.md (the alert strip, the One Chyron Rule). The `.txt` beside each frame (the page's
whole text) was read for what sits below a frame's crop, and the source for causes. Read-only except this file and the skill's
insight log; the corpus' HTML rebuild of the top fixes was skipped (a review, as in earlier rounds), so fixes are in design and
code terms.

## Score: 65 / 100

| Layer | Score | Why |
| --- | --- | --- |
| Foundation (L0) | 76 | One state, one fact, one reason on the strip; the path one row; the hub's line and the sheet's columns carry a chunk too many |
| L1 first impression | 70 | The runner's yellow plate and the player's hourglass panel read in a glance; yellow leaks onto the room's eye and a false ⋯ dot; the sheet's first step compares chrome |
| L2 fluency | 60 | "Start the draft" holds everywhere; the wait has three wordings and loses its shape on the game page; the draft's time has three forms; the sheet's control mixes pills and chevrons |
| L3 priors and trust | 52 | The strip's lie is gone, but "Set", "1st", "Tied 1st · in front" and "Best 1st" say it again below and beside it; a late draft time reads as calm |
| L4 decisions | 62 | Two taps to Start, never from the strip; the ⋯ dot has two owners and cries wolf; the room's "when everyone's in" can't be read off its seats |

Overall = (76 × 1.5 + 70 + 60 + 52 + 62) / 5.5 = 358 / 5.5 = 65.1, so **65**. No dependency caps. Round 4 scored 64
(72/66/62/52/62).

The runner's yellow strip and everyone else's hourglass strip work where they were built (Tonight, the Games tab, the hub), and
the three fixes hold. But the false status the round removed survives a scroll down and on three other surfaces, the wait is said
three ways, and the runner gets two false signals (the ⋯ dot, a late time read as calm).

## Findings, ranked

1. **Major, L3 (L2): the "All set" the round removed is still on the page, as "Set" and "1st".** runner-page.png and
   player-page.png (and their .txt), runner-hub.png, player-hub.png, runner-tonight.txt. Before anyone can pick, under its own
   "Start the draft · Nobody can pick until you do", the game page says "Overall: 1st of 4 · 0 pts" (first view), "Tied 1st of 4 ·
   0 pts · in front" (player-page.png's first line, and the timed runner's), "YOU · Tied 1st of 4", and in Week by week "Set ·
   Airs Thu 4:09 PM · Yours to change until it airs. Nobody sees it before then. · Change your lineup". The hub's poster tags the
   show "Best 1st" right under the plate; Tonight's Your games reads "T1 of 4 · 0 pts". Only the Games tab is honest ("4 players ·
   nothing counted yet", player-games.png). The status nobody tests (the round's own premise, R4) now contradicts the strip one
   scroll away, and "Tied 1st … in front" contradicts itself.
   *Why:* the page's experience disproves its own top line (Learning #15); a prominent element with a false interpretation costs
   more credibility than its absence (Fogg 2003); the conflict resolves toward disbelieving both (Clark 2013).
   *Cause:* each reader decides "nothing pending" for itself: lineup-sheet.tsx WeekPane calls a week with no team "Set"
   (`next.done`); this-week.ts:290 adds "in front" for any place 1, tied or not; tonight.tsx:361 says "No team yet" only when the
   game itself has `draftSoon`, which a game in stages doesn't (its stage does); the poster's Best counts a tie at 0.
   *Fix:* one pre-draft rule, in the Games tab's words, for every reader of the game: while it (or its current stage) hasn't
   drafted, the hero line, the Overall line and Tonight's game line say "4 players · nothing counted yet" with no rank; Week by week
   says "No team yet · Airs Thu 4:09 PM" and "Your lineup opens once the draft is done", with no Change your lineup; the poster's
   Best counts only games with a team; "in front" only when alone at the top.

2. **Major, L2 (L1): the wait is said three ways, and on the game page it loses its shape.** player-tonight.png, player-page.png,
   player-room.png (and the timed pages' .txt). The strip says "Waiting for Alex to start the draft · You pick your team when it
   starts" on the quiet panel with the hourglass. The game page says "Waiting for Alex to start the draft · Pick in private, reveal
   together" as a bold line with a chevron: no Draft tag, no hourglass, no panel, the shape the page keeps for an optional move
   ("Optional swaps open"). The room's card says "Not started yet · Alex starts it". R3 names exactly these three surfaces for one
   wording; R1 gives the wait its own icon. The time set repeats it: "The draft starts Sat 11:12 AM" on the strip and the page,
   "· in 2 days" on the hub, "Starts Sat 11:12 AM · in 2 days" in the room.
   *Why:* one fact in three forms reads as three facts, and the felt mismatch costs trust without being noticed (Reber & Schwarz
   1999; Alter & Oppenheimer 2009); drawn like an optional move, the wait is grouped with optional moves (Wertheimer 1923).
   *Cause:* your-move.ts:68 swaps draft-words' line for "Pick in private, reveal together"; game-page.tsx:209 sends any move that
   isn't due and has a destination to `OptionalLine`; strip.tsx:92 formats the time with `airTime`, the hub with the calm clock.
   *Fix:* on the game page, render a draft that hasn't started through `Strip` (model.ts:376 already tags it "Draft", quiet) with
   the hourglass, as strip.tsx draws it; your-move.ts keeps `soon.line` until the draft starts; the room's line for everyone else
   reads "Waiting for Alex to start the draft · You pick your team when it starts" (draft.tsx:947); every surface writes the time
   in the calm form, "Sat 11:12 AM · in 2 days" (DESIGN.md, calm clocks).

3. **Major, L4 (L1): the ⋯ dot says "needs you" while the strip says nothing is due.** runner-timed-tonight.png (the dot beside "It
   starts by itself"), runner-tonight.png. With the draft's time set, the runner's strip turns quiet, but the ⋯ keeps its yellow
   needs-you dot. The dot is Backstage's needs (show-space.tsx:605), and Backstage's draft job (backstage.ts:329) asks only "not
   started, no time": it skips the checks runnerItems makes (action-items.js `draftStartDue`: a later stage's draft still waiting
   on results, own pace, no cast, fewer than two seats). The likely source here is the Merged stage's draft, untimed and waiting on
   the merge, which Backstage counts and the strip rightly doesn't. Two owners for one fact.
   *Why:* a needs-you mark that fires when nothing is needed is a false alarm; each one lowers the mark's worth as a signal and
   teaches the runner to ignore it, including when it's true (Green & Swets 1966).
   *Fix:* Backstage's draft need calls `draftStartDue`, one rule for the strip, the hub, the dot and Backstage's row; the dot then
   follows the strip.

4. **Major, L3: a draft set after the game's first episode reads as calm.** runner-timed-tonight.png, player-timed-tonight.png,
   runner-timed-room.txt. The show bar: Ep 9 airs Thu 4:09 PM; the game counts from Episode 9; the draft is set for Sat 11:12 AM,
   "in 2 days". The runner's strip is quiet, "The draft starts Sat 11:12 AM · It starts by itself", and nobody will have a team when
   Ep 9 airs. The server takes any future time (draft.ts:175), so a runner can set exactly this. The quiet line confirms the prior
   the first-view doc warned about ("a draft starts on its own") at the one moment it's wrong.
   *Why:* a status that matches the prior is never tested (Kahneman 2011, the rubric's L3; Clark 2013: no prediction error, no
   attention); it's the round's "All set" in another form.
   *Fix:* `draftSoonWords` takes the first counted episode's air time; when the set time is after it, the runner's strip stays due:
   tag Draft, "Move the draft before Ep 9", line "It's set for after Ep 9 airs", opening the room's Change time; everyone else's
   line "It starts after Ep 9 airs". With finding 2's calm clock.

5. **Major, L4 (L1): the room tells the runner to wait for a state its seats can't show, and its icon is yellow.** runner-room.png,
   player-room.png, fantasy-51-2-draft-s2.png. "Everyone's waiting on you · start it when everyone's in" sits over four dimmed
   seats that all read "Waiting", the runner's own included. Once the draft starts, the same row says "In" for a locked-in team
   (fantasy-51-2-draft-s2.png), so "in" means joined before the start and locked after it: the cue to start can't be read off the
   room. Backstage's row says the same ("Start it when everyone's in, or pick a time"). And the card's eye is chyron
   (`text-chyron-line`, draft.tsx:934): nothing in the player's room is theirs, yet its only yellow is that eye (R2: no yellow for
   everyone else); in the runner's room it's a second yellow beside Start the draft now.
   *Why:* a cue that doesn't predict what it points at breaks the scent to the decision (Pirolli & Card 1999); one word with two
   meanings in consecutive states is a prediction error (Clark 2013); a second yellow lowers Start's d-prime, and the player's
   yellow turns attention on for nothing (Green & Swets 1966; Lindgaard 2006).
   *Fix:* before the start, the seats read "Joined" at full strength (the runner's "You · starts it") and the line "Everyone's
   waiting on you · all 4 have joined" (Backstage's detail in the same words); "In" stays for locked picks after the start; the
   icon in the foreground (`text-foreground`), so the runner's Start is the room's one yellow.

6. **Minor, L3: "+1 benched" asks to be added, and the total isn't there to check.** after-team.jpg, fantasy-51-4-after-s3.png.
   "Points from when they started: they add up to your total" heads a column where two rows carry "+1 benched" and "+2 benched"
   under their numbers. Adding what's on the screen gives 6.5; the total is 3.5, and it isn't in the section.
   *Why:* a plus sign is a learned prediction, "add this" (Clark 2013); a claim checked in place reads true, one that needs a scroll
   back reads as an assertion (Reber & Schwarz 1999).
   *Fix:* write the bench without a sign, "1 on the bench" (game-week.tsx:549), and close the five rows with "Your total · 3.5", so
   the sum is checked where it's claimed.

7. **Minor, L3: the draft card opens on a screen that says the opposite of its headline.** fantasy-51-2-draft.png,
   fantasy-player-51-2-draft.png. Headline "Pick 5 in private · Before Episode 9"; step one rings "Start the draft · Nobody can pick
   until you do" (the runner's) or "Waiting for Alex to start the draft" (the player's). Round 4's R4 (a card never opens on a
   screen that contradicts it) and round 5's path (where you meet it comes first, whatever it says) pull apart here.
   *Why:* the first fixation, the headline, predicts a pick; the ringed proof denies it (Clark 2013); the ring proves a claim the
   card doesn't make.
   *Fix:* the second line carries the sequence, the same on all three steps: "You start it, then everyone picks 5 · before Ep 9"
   (the player's: "Alex starts it, then you pick 5 · before Ep 9"), so step one's ring proves its first half. If the line can't
   hold it, it's a named choice for the user between the two rules, not another pass.

8. **Minor, L2 (L0): the sheet's step control is the grammar R3 ruled out, and each column shows its path twice.**
   sheet-draft.png, sheet-week.png, sheet-week-s2.png. "Where you meet it › What it opens › What it leads to" is three boxed pills,
   the current one white, with chevrons between: the segmented control with chevrons that R3's gap names, in words that aren't the
   cards' ("Tonight › Draft room › The teams"). Each column then gives its path twice, as a header line and as the card's own tabs:
   four chunks over the card where round 4's R1 allows three.
   *Why:* pills say "pick one", chevrons "this, then this"; mixed, neither reads at a glance (Wertheimer 1923); a duplicate row
   spends a chunk for nothing (Cowan 2010).
   *Fix:* draw the step control in the cards' path grammar (plain condensed caps, the app's chevron, the current step bone with the
   underline, no boxes), and drop each column header's path line, since the card's tabs already underline the step.

9. **Minor, L1: at "Where you meet it", the sheet compares four copies of Tonight.** sheet-week.png. Every column's phone shows the
   same hero art, couch row and Last time's two red OUT plates; the one difference, the strip's words, is about a fourteenth of each
   phone, under plates that outshine it. R4's words say which step it is, but the eye compares chrome (round 4's log found the same).
   *Why:* a small signal against identical, louder noise (Green & Swets 1966); the row's 50 ms gist is "the same app four times"
   (Lindgaard 2006).
   *Fix:* at step one, crop each phone to the show bar and the ringed strip (or set the ringed strip at 2x above its phone), so each
   column's one difference is its biggest thing.

10. **Minor, L4: "Game page › Your team" is a scroll drawn as a tap.** fantasy-51-4-after-s2.png, fantasy-51-4-after-s3.png. Your
    team is the game page scrolled (s2 already shows it under The season); the chevron is the app's mark for a screen a tap opens,
    and the spec's path for this moment has two steps.
    *Why:* the mark predicts a destination that isn't there (Pirolli & Card 1999).
    *Fix:* two steps (Tonight › Game page), the game page's ring moving to Your team's column when the claim is about it; or a third
    step that is a tap (Week by week, Your team's heading link).

11. **Minor, L0: the hub's line carries three chunks.** runner-hub.png, player-hub.png. "Nobody can pick until you do · Fantasy
    league · Before Merged" wraps to two lines; the player's line breaks "Before / Merged". The stage league's full name rides in
    (sections.tsx:258, `move.leagueName`); the spec's copy is "· Fantasy league".
    *Why:* R1's one reason a line; each extra name is a chunk (Cowan 2010).
    *Fix:* the game's name without its stage; the stage only when two stages of the show both wait.

12. **Minor, L2: small wording.** after-tonight.jpg: "+3.5 pts · In Before Merged": episode-view.ts:157's "In {stage}" breaks on
    any stage name that isn't a place; write "{stage} stage" or the name alone (the names themselves are the wizard lane's,
    decision 8). fantasy-51-3-week.png: the tab "Your move" opens a sheet titled "Your moves"; use the app's name.
    player-tonight.png: the title leaves "draft" alone on its second line; `text-balance` on the strip's title.

Not ranked: runner-page.png's strip title is condensed caps ("START THE DRAFT") where Tonight's is sentence case, the caption plate
and the strip differing as before this round. runner-hub.png says the job in yellow twice (the plate and the poster's corner dot),
both sanctioned needs-you marks. The ⋯ dot is `bg-chyron` where the Fill Not Line Rule wants `chyron-line` (invisible on Night,
pre-existing). The finale's step one (fantasy-51-6-finale.png) rings the spoiler gate under the outcome headline, which is the
path's design and doesn't contradict it.

## Requirements

### A draft that waits (draft-start-first-view.md)

| | Met? | Evidence |
| --- | --- | --- |
| R1 sorts in one look; the wait its own icon; one fact, one reason; the draft leads with a count | **Partly** | The strip (Tonight, Games) and the hub: yellow plate against a quiet panel with the hourglass, never the tick. The game page draws the wait as a plain line with no tag or icon (2); the hub's line has three chunks (11) |
| R2 the runner turned on; everyone else neither on nor off | **Partly** | runner-tonight.png: the yellow plate, in the first view under the show bar. player-tonight.png: no yellow, no tick. The player's room has a yellow eye (5); the ⋯ dot turns the runner on when nothing is due (3) |
| R3 one wording on every surface | **Partly** | "Start the draft" holds on the strip, the hub, the game page and Backstage ("Start the Fantasy league draft"), the room's button continuing it. Everyone else's wait has three wordings, the time three forms (2) |
| R4 the runner's line states the exception; everyone else's names the person | **Met, with a gap** | "Nobody can pick until you do", "Waiting for Alex". A time set after the first episode confirms the prior (4), and the page below contradicts the strip (1) |
| R5 one tap to the room; Start there; Pick a time beside it, lighter; nothing asked of anyone else | **Met, with a gap** | runner-room.png: Pick a time (outlined) beside Start the draft now (yellow, wider); the strip never starts it; two taps from any tab. The room can't show who's in (5) |

### The preview's path (preview-story-first-view.md, Round 5)

| | Met? | Evidence |
| --- | --- | --- |
| R1 one row, never wrapping, at most three steps, only the current one filled; the sheet's controls in two rows | **Met** | Every card's path is one row; Full size folds to its icon at three steps; the sheet has the moment row and the step row |
| R2 the place on the phone and the soul in the headline; the path's direction | **Partly** | Each episode, after the first results and the finale hold; the draft's step one contradicts its headline (7) |
| R3 the app's grammar for going deeper; the sheet's step control in the cards' words | **Partly** | Cards: names in order, the app's chevron, the current one bone and underlined. The sheet's control is boxed pills with chevrons, in other words (8); a scroll drawn as a step (10) |
| R4 the sheet says each phone's step in words; each column names its screen | **Met** | Each column's header underlines its step ("Tonight"); "No draft in this game" |
| R5 the next step beside the current; Next between moments only; the sheet's step sets every phone | **Met, as far as shown** | Next names the next moment ("Each episode"); one control sets every column. No frame shows a shorter game held at its last step |

### The three fixes

| Fix | Held? | Evidence |
| --- | --- | --- |
| Tonight's game line without "0 of 0 still in" | **Yes** | after-tonight.jpg: "4th of 4 · 3.5 pts", "+3.5 pts · In Before Merged" (12) |
| Your team adds up to your total | **Yes, with a sign that misleads** | after-team.jpg: 0 + 2 + 2 − 0.5 + 0 = 3.5; "+1 benched" (6) |
| The finale's reveal ranks the whole game | **Yes** | fantasy-51-6-finale-s2.png: Riley 34, Sam 32.5 (wins by 1.5, as the headline says), "You're 4th, 3 behind Jordan", where round 4 showed one stage |

## Layer notes

**Context.** Two audiences. Whoever runs a game (its Commissioner, often just back on Tonight after making it) and the rest of
the couch, on phones, days before the game's first episode; and, in the preview, someone deciding on a game or sweeping hundreds.
Nothing is sold: the conversion is the runner's two taps to Start, and everyone else staying calm and informed. Free and social, in
the Lower Third look (white plates on night, yellow only for "now, and yours"). The preview's execution is its own trust signal: a
sweep's verdicts are only as good as its screens' agreement.

**Design system.** Tailwind (v4 utilities and arbitrary values) with shadcn-style semantic tokens and the project's own (`bg-plate`,
`bg-chyron`, `text-chyron-line`, `type-caption`), lucide icons; confidence 95, read from the source (strip.tsx, draft.tsx,
game-page.tsx). Fixes name the components and classes.

**Tier 1 rules.** Pass: F-CL-001 (elements), F-CL-002 (one family, Archivo), F-CL-003 (viewport), L2-TY-001, L2-TC-001, L2-BT-001
(Start filled, Pick a time outlined), L4-CT-001, L4-CT-002 ("Start the draft now", "Pick a time", "Change time" name their
outcome). L3-FR-001: "Nobody can pick until you do" is real urgency, compliant. Flagged: L1-FI-003 (one primary per view) in the
runner's room (5). F-CL-004 on mobile (more than four blocks above the fold on Tonight) is older than this round.

**L0, 76.** One state, one fact, one reason and a chevron on the strip; the path one row; the sheet's controls two rows. Lost: the
hub's three-chunk line (11), the sheet's doubled path (8), and four status lines in the player's game page first view, three of
them false (1).

**L1, 70.** The runner's yellow plate sits in the first view under the show bar (runner-tonight.png, runner-hub.png,
runner-page.png); the player's quiet panel with the hourglass reads "coming, not mine" (player-tonight.png, player-hub.png). Lost:
the yellow eye in both rooms (5), the false dot (3), the sheet's first step (9).

**L2, 60.** The quiet tone reuses the strip's quiet shape with its own icon, so tone and shape sort before reading (Treisman &
Gelade 1980, via L2-BT-001); "Draft" and "Start the draft" hold; the path borrows the app's own chevron. Lost: the wait three ways
and the game page's optional-move shape, three clock forms (2), the sheet's control grammar (8), small wording (12).

**L3, 52.** The named wait and the runner's stated exception are right, and the strip, the hub and the game page's strip no longer
say "All set". But the false status moved one scroll down and onto three other surfaces (1), a time set too late lies the same
way (4), and two claims don't match their screens (6, 7).

**L4, 62.** Two taps to Start, never from the strip, Pick a time beside it (R5); Next moves between moments, the tabs between
steps. Lost: the dot's false alarm (3), the room's unreadable cue (5), a scroll drawn as a step (10).

**Cross-layer.** One pattern runs under findings 1 to 4: the round fixed a false status where it was reported (the strip) rather
than on the state that produced it ("no team yet"), and every other reader of that state still decides for itself: the week pane,
the hero line, Tonight's line, the poster, Backstage's need. That's Learning #15 at page scale (a top line disproved below it) and
l018's one decidable state, across readers. The ethics tests pass (nothing here sells), though Sincerity is the one finding 1
strains: the page offers to change a lineup that can't exist yet.

**Top 3 fixes.**
1. One pre-draft rule for every reader (1): L3 +8, L2 +2.
2. The game page's wait as the strip's quiet plate in the strip's words, one clock form (2): L2 +6, L1 +2.
3. One owner for "the draft waits on you" (Backstage reads `draftStartDue`) and a due state for a time set too late (3, 4): L4 +5,
   L3 +4.
Together about 76/72/68/64/67, overall about 71.

**Dependency notes.** No caps: L0 (76) and L1 (70) are above 40, and no violation is Critical. Finding 1 comes closest, but it
doesn't block L3, since the strip itself is right.

**Self-check.** Spread 52 to 76 (24 points). Citations from the loaded reference (Treisman & Gelade from the loaded L2 rules); the
arithmetic in 6 is observation. No severity inflation: the worst failures are contradictions below a correct top line, not a
blocked layer. Closest anchor: "good" (70), pulled down here by contradiction across surfaces rather than a third party's styles.

*Initial findings. Ralph Loop a layer score, cite further, switch to solve / analyze, or ask any follow-up to dig deeper.*

# Start a game, Round 2c (where you are, and each view's job): the check

Run once each, on the built frames at 390 × 844 (`.ui-atlas/stories/wizard-r2c/after/`; the before is
`.ui-atlas/stories/wizard-r2b/after/`), against [the paper](wizard-r2c-steps.md)'s R1 to R5, DESIGN.md (Lower Third) and the
round's busy test (docs/DESIGN-ROUND-PACKET.md, "The round's frame"). Stand-ins (the ZT couch and team names, 9:31 AM kickoffs)
aren't judged.

- **PFD evaluate: 68/100** (Round 2b: 62). L0 70, L1 76, L2 68, L3 60, L4 66; (70 × 1.5 + 76 + 68 + 60 + 66) / 5.5 = 68, no cap.
  By flavor: competition shows about 70 (b1, y8, t11), an aired season about 70 (c42), the story show about 66 (bd2), sports
  about 63 (z-nfl, z-nba).
- **Impeccable critique: 29/40, Good** (Round 2b: 26/40). Method: DEGRADED: single-context (a focused round, run inside the one
  check agent). The design review was scored before the detector ran; no browser overlay (the frames were given, no server
  touched).

**What changed, in one line:** How long is now plainly a decision, and every view says its step and its job. What the round added
is mostly repetition: the same answer three or four times in a first view, the game told three times, a cost line that belongs
to no decision.

Keep: the step line; question heads; the season bar with its joined band; option cards that carry their consequence; Where your
couch is; yellow on Start alone.

## PFD, by layer

| Layer | Score | Why |
|---|---|---|
| L0 load | 70 | Each decision is one chunk under its own head; the rules stay behind rows. Against it: a first view states the current answer three or four times ("Just Game 1" four, z-nba; "Episode 9 to the finale" three, y8, c42) and the game three times (its sentence, the effort line, a scoring paragraph under the lock, y8); the game screen grew by a third (2.3 to 3.0 phone heights, b1; 2.4 to 3.1, y8). |
| L1 first impression | 76 | The first view says where you are and what's being decided: Step 2 of 3, the game's name on the show's art, HOW LONG? over the season drawn as a bar. Against it: three caps heads in the top half (SET IT UP, the name, HOW LONG?), and the white chosen plate is the brightest thing after Start. |
| L2 fluency | 68 | One shape and one chosen look (DESIGN.md's flow option card) for a length, a lock and a rule's choice (b1, c1). Against it: two decisions keep the old shapes (t11, m2); the step line's words change form view to view; stage names and reasons are cut mid-word; the new parts sit off the type ramp (14 px details where Detail is 13; 12 and 20 px on the bar). |
| L3 bias | 60 | A lock card names who'd miss moves; the couch's marks sit beside the lock. Against it: the cost line under How long's cards never says it's the lock's (b1); the Start bar promises "picks by tonight 8 PM" under "When you've watched it" (y8; "guesses by", t11); a reason loses its point ("not a team", c1); Ready to start promises who it tells and names nobody (s1); a football stretch ends at "the finale" and locks "At airtime" (z-nfl). |
| L4 decisions | 66 | Step N of 3 on every view; one tap changes an answer; Undo takes a rule back (y9). Against it: Recommended never shows (b1, y8); the lock's answer isn't in the first view (b1); a ready game says Step 1 of 3 and starts from there, past the lock, who it tells and Ask (m2). |

## Impeccable, Nielsen

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 3 | Step N of 3 and a job head on every view; the lock's answer is out of the first view and its cost line unnamed (b1) |
| 2 | Match with the real world | 3 | Plain questions ("How long?", "When do moves lock?", "Where your couch is"); a football game runs "to the finale" and locks "At airtime" (z-nfl); "the B-lane" on Try it (p1) |
| 3 | User control and freedom | 3 | Back, Done, Undo on the toast and on the changed row, a card tapped again; a ready game starts in one tap from step 1 (m2) |
| 4 | Consistency and standards | 3 | One decision shape on the game screen; The moment (t11) and a ready game's length (m2) keep the old ones; "Wait for riley" names the card "When you've watched it" differently; dashed means can't-be-had and also add-this (y12) |
| 5 | Error prevention | 3 | Engine-checked choices; costs on the lock cards and above Start; the ready path skips both (m2) |
| 6 | Recognition rather than recall | 3 | Every option in view with its line; "FROM CH…", "FROM CL…" (bd2) and "playo…" (y9) leave you guessing |
| 7 | Flexibility and efficiency | 3 | Search, ready games, Make it…, Find a change, Every rule, Describe |
| 8 | Aesthetic and minimalist design | 2 | The same answer three or four times per first view; the game said three times; the screen a third longer |
| 9 | Error recovery | 3 | Can't-be-had cards say why; two reasons cut (y9, c1) |
| 10 | Help and documentation | 3 | Each sub-view's first line says what it's for; Try it and Every rule one tap away; the questions' add grid is unlabelled (q1) |
| | **Total** | **29/40** | **Good** |

Detector (`impeccable detect`, `src/new/couch/gallery-bold/`): 79 findings, no slop patterns. 77 advisory font sizes off DESIGN.md's
ramp (14 px 52 times, 12 px 12, 20 px 5, 17 px 4; 21, 30, 40 and 48 px once each); 2 side-tab warnings at parts.tsx:103 are false
positives (the chosen band's closing edges). Specificity: authored where it draws on the season (its stages on the bar, the couch
by name and how far behind, a cost to a named person); the rules list under it is still a stock settings list (carried from 2b).

## R1 to R5

| | Verdict | On the frames |
|---|---|---|
| **R1** load | Partly met | Met: the first view holds the step line, the title card, what everyone does with Try it, and How long's question, answer and bar (b1, y8, bd2, c42, z-nfl, z-nba). Not: The moment's panel pushes the bar under the Start bar (t11); "Wait for riley", a lock option, shares the first view with How long's cards (b1, bd2, z-nfl). Mid-scroll shows the lengths' last row with the first two lock cards (y8, whole sheet); left as is, the lock's head sits between them. |
| **R2** first impression | Met | Question heads at section size read as the page's structure; How long is a bar and cards, not a chip row off the edge (b1 against 2b's b1). Weak cases: Below Deck's stages cut to "FROM CH…", "FROM CL…" (bd2); an aired season's bar is one outlined box (c42). |
| **R3** fluency | Mostly met | One shape, and chosen as a white plate with a chyron-line outline and a tick, for a length, a lock and a rule's choice (b1, y8, c1). Not: The moment keeps its old label and Change link (t11); a ready game keeps the old "HOW LONG" label and box strip (m2). |
| **R4** bias | Partly met | Met: each lock card names who'd miss moves (b1, y8, z-nfl). Not: reasons cut ("…1 round of playo…", y9; "Lives need a pick or a guess each episode,…" without "not a team", c1); no length says how many episodes beyond "One episode" (y8; c42 knows all 14); the Start bar's cost line sits under How long's cards without naming the lock (b1, bd2, z-nfl). |
| **R5** decision architecture | Partly met | Met: "Step N of 3" on every view (all frames); one tap changes, Undo takes back (y9). Not: Recommended never shows, because the tag gives way to the tick and the default is the recommended way; lengths mark none (b1, y8). The lock's answer isn't in the first view (b1). A ready game says Step 1 of 3 and starts from there (m2). |

## The batch (one), ranked

### P1

1. **The Start bar's cost line belongs to no decision** (b1, bd2, z-nfl, first views). "riley would miss moves (2 behind) · Wait
   for riley" sits right under How long's cards, so it reads as the cost of the length; it never names the lock, and its fix, a
   lock option, shows inside How long's first view (R1). Under "When you've watched it" the same slot promises "picks by tonight
   8 PM" (y8) and "guesses by tonight 8 PM" (t11), a deadline that lock doesn't set.
   **Change:** the bar's line is the lock's, always in one form: the lock's answer in its card's words, then what it means for the
   couch, then the fix named for the card it picks. "Locks when the next one airs: riley would miss moves · Wait for riley";
   under own pace "Each locks when they've watched it", plus "Draft by tonight 8 PM" only when the draft sets a time. It never
   restates the length.

2. **One answer printed three or four times in a first view** (z-nba "Just Game 1" four times, two of them back to back under
   HOW LONG?; z-nfl "Just Game 5" three; y8 and c42 "… to the finale" three, besides the bar's band). The busy test: say each
   thing once.
   **Change:** each line in a section says something the others don't. The question head keeps its answer (the casual read); its
   detail line goes, or says what no card says (the dates, how many episodes: "Wed 18 to the finale, no date yet"), and never
   repeats the answer's words; the chosen card keeps its line like its neighbours; the Start bar stops restating the length (1).

3. **A ready game says Step 1 of 3 and starts from there** (m2; the gallery's ready plate goes straight to what Start makes, g1).
   The step line promises two more steps while the view's yellow button finishes; Start goes past the lock (riley's cost isn't
   shown), who it tells and Ask the couch first, all of which a game's screen carries.
   **Change:** a ready game's view is the Start step: segments lit to 3, "Step 3 of 3 · Start · a ready-made game"; its length on
   the same bar, read-only, the band its span, under a plain label (it isn't a question here); Start's own bar (the lock's line,
   Tells 3 who watch it, Ask the couch first). "Change it first" goes to Set it up. The ready plate opens this view instead of
   starting past it whenever the lock would cost someone.

### P2

4. **Recommended never shows** (b1, y8). The default is the recommended way and the tick replaces its tag, so it's never seen; on
   Outlast that default is the one costing riley moves, with no reason given. Lengths mark none.
   **Change:** the recommended card keeps "Recommended" beside its tick, with its reason in a few words ("a draft plays each
   episode together"); How long marks the game's usual length the same way.

5. **A can't-be-had card cuts its reason** (y9 "The game is too short for 1 round of playo…"; c1 "Lives need a pick or a guess
   each episode,…", losing "not a team"). The cards have room for two lines; a 44-character cap kept from the old chip row (y9)
   and a two-line clamp on a rule's squares (c1) cut them.
   **Change:** the whole reason on the card, never cut by a character count or a clamp; one that won't fit two lines is
   shortened in words at the source.

6. **The game is said three times, and its scoring sits under the lock** (b1: "Take turns picking two castaways, then just watch."
   over "Everyone: pick once, then just watch"; y8: picks five, then "choose who plays each episode", then "Before each episode
   you choose three to play…" between the lock cards and THE RULES, where it reads as the lock's footnote; also bd2, z-nfl, t11).
   **Change:** the title card says what you do and how it scores, in one or two sentences; the effort line keeps the effort and
   the numbers ("2 each from the 10 left, once"); nothing sits between When do moves lock? and The rules.

7. **Below Deck's stages are cut on the bar** (bd2: "FROM CH…" and "FROM CL…", both "no date yet", drawn over "… the rest" and
   FINALE, where neither stage need fall).
   **Change:** stage names whole. When undated stages don't fit over the bar, one line under it in order ("Then Charter Season,
   then Closing Charter · no dates yet"); a stage sits over a cell only when its date puts it there.

8. **The moment, on Who does it most?, keeps the old shape** (t11: a small caps "THE MOMENT" label in a panel with a Change link,
   the very link the paper retired), and pushes How long's bar under the Start bar (R1).
   **Change:** "Which moment?" as a question head, "Cries" as its answer, its choices as the same option cards (the season's own
   moments first, then suggested ones; a few in view, the rest a tap away), compact enough that How long's head still makes the
   first view.

9. **The questions' grid has no head** (q1). Nineteen tiles ("Who goes home", "Who wins"…) follow the three questions with nothing
   saying they're kinds to add, and "Who goes home" is both question 1 and a tile; the first line repeats the head ("The questions
   everyone answers").
   **Change:** "Add a question" over the grid, with what a tap does; a first line that adds to the head: "Each episode, before it
   airs" (the paper's).

10. **Sports words in the new parts** (z-nfl, z-nba: "Game 5 to the finale", "At airtime · Everything locks when the game
    starts").
    **Change:** a sport's stretch ends at its last game ("Game 5 to Game 7"); its strict lock says the sport's start ("At kickoff",
    "At tip-off", or "When it starts").

### P3

11. **The step line changes form** (p1 "Step 2 of 3 · Fantasy league · nothing saves", without the step's name, and "nothing
    saves" again in its first line; m2 wraps "a ready-made / one" onto a third line; z-nfl and z-nba wrap to two).
    **Change:** one form, "Step N of 3 · <step> · <game or show>", on one line, the last part truncating; each fact said once.

12. **Lengths say too little where the season is known** (c42: the bar is one outlined box, "1–14 all out", which reads as a
    chosen field; "The whole season" never says 14 episodes).
    **Change:** 14 episodes fit at 390: draw them, the band over the chosen stretch; a bar that can't show a stretch is left off.
    Each length card gives its count where it's known ("14 episodes").

13. **Dashed means two things** (y12: the suggested moments "+ A blindside" are dashed; on the game screen dashed means can't be
    had). Carried from 2b.
    **Change:** suggestions as solid chips with a plus; dashed only for what can't be had and for aired episodes.

14. **The prototype's end screens** (s1 promises "who it tells" and lists nobody; p1 and s1 notes in builder's words, "the
    B-lane", "our check passed").
    **Change:** s1 names the three it tells (or "Just you for now"), or its line ends at "the game Start makes"; the Round 2 notes
    in plain words for the reviewer.

15. **The new parts sit off the type ramp** (the detector: 14 px details 52 times where Detail is 13; 12 and 20 px on the bar;
    question heads and the sheet's head both 26 px, between the ramp's 24 px section heading and the flow's 30 px question).
    **Change:** snap to ramp steps, or add the flow's sizes to DESIGN.md once, on purpose.

## Open (for the user)

- **What the lock recommends when someone is behind.** For a draft (Outlast, Reverse draft) the engine recommends locking when
  the next one airs, so the default costs riley, 2 behind, his moves (b1, bd2). Fix 4 makes it visible with its reason. Whether
  the recommendation follows the game (a draft plays one episode together) or the couch (wait once anyone is two behind) is a rule
  to decide.

## Noticed, not this round's

- The gallery still says "Community and saved" twice in its first view (the row and the first chip, g1); Round 2b settled on one
  spelling. For the gallery's next pass.
- The shared sheet's title is 26 px everywhere (`src/new/ui/sheet.tsx`); DESIGN.md's ramp gives sheet titles 22 px. App-wide, for
  the design system's owner.
- In Ask the couch first's preview, "I'm in" is a white plate, the flow's chosen look, so the couch's card can read as already
  answered (a1). For the chat card's own pass.

## Fixed in the one batch

- **The Start bar names the lock, never the length:** "Moves lock when the next one airs · picks by tonight 8 PM"; at your own pace
  "Moves lock as each of you watches"; who it would cost under it, with the card that fixes it as the action ("When you've watched
  it").
- **Each line adds something:** How long's head gives the range only when the answer doesn't; a length card gives its count or its
  day ("3 games", "One episode · Wed 18"); the scoring sentence left under the lock goes (Every rule has it).
- **A ready-made game is the Start step** (3 of 3) with its own Start bar (the lock, who it costs, Ask the couch first). The ready
  plate's one tap lands on Start's screen, which now names who Start tells, offers Ask them first, and carries the lock's fix.
- **Recommended shows on the chosen card;** a reason is never cut off (a choice's why, a rule's detail, a stage's name wraps).
- **The moment** is a question like the others ("Which moment?"), its choices in view; the questions' add grid says what it is.
- **Sports:** "the last game", "When the game starts", "seen it".
- **One step line, one wording:** "Step N of 3 · Choose a game / Set it up / Start · …" on every view; a suggestion is solid (dashed
  means can't be had); the would-start note in plain words; a ready-made game's length on the same timeline.

## Still open

- **Settled after the check (the user, 2026-11-18):** the lock is two plain cards on every game, Together and At your own pace, with
  no Recommended tag and no "at airtime" (decisions.md). That replaces "Recommended shows on the chosen card" above; the card that
  starts chosen is unchanged.
- **Not fixed:** font sizes off DESIGN.md's ramp (BACKLOG 106); the Start bar's warning takes two lines when someone's behind; a long
  sport page's step line wraps.

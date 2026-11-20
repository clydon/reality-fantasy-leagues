Method: dual-agent Impeccable critique (A: design review · B: detector and rendered evidence) and a PFD Mode 1 evaluation, each
run once, isolated, on the first 51 frames (`.ui-atlas/stories/strip-night/frames/`); one batch of fixes; one confirming render
(`frames2/`).

# Episode night, the late window: the check

Target: the strip and the sheet it opens in the window (src/new/show/strip.tsx, strip-night.ts, dock.tsx; `?strip=a|b|c`), at 390
on night-fixture.js, against [the spec](strip-night-spec.md) and [the first-view requirements](strip-night-first-view.md).

## Scores

| | Today | A | B | C |
| --- | --- | --- | --- | --- |
| Nielsen (Impeccable A), /40 | 12 | 25 | 27 | 27 |
| PFD overall (Mode 1), /100 | 31 | 59 | 64 (70 with a carried lineup set) | 57 |

All three reads chose B and said not to ship C (it fails R1: a 233 to 304 px plate that pushes Last time out of the first view,
and a second shape for the same job). All three named the same deciding element: a lineup carried in complete counts as due once
the episode airs, so the strip goes yellow, the badge counts it and a push goes out for a lineup that's already set; under that
rule B's faces contradict its own words. With it set, B is the only look that passes R1 to R5 but R4 in its due state.

The detector: exit 0, seven advisory font sizes. Four are 14 px, a working size the app uses 549 times that DESIGN.md's ramp
doesn't list (a DESIGN.md question, not this round's); two are a monogram's size; two are real and old (dock.tsx's 10 px
STARTING tag and 14 px pool name against the cast tile's 15). The question added mid-round had 17 and 12.5 px: fixed to 16 and 13.

## The user's rule, mid-round

"We also don't want someone who's watching live to be mistaken that they can make moves because that would be cheating." It
arrived while the check ran and joined the batch: the words name the moment you start ("Locks when you start watching", "Before
you start watching"); Your moves asks "Have you started watching Episode 6?" before it opens the moves (Not yet, change my moves /
I'm watching, lock them in; once results are in, I've watched it, the reveal); I'm watching and starting Watch along lock your
moves in every game (simulated in the browser until the engine step exists: a seat's own lock for an episode).

## The batch, and what each fix answered

| Fix | Found by |
| --- | --- |
| The due state leads with the condition: title "Before you start watching", the moves under it (A names them; B counts them, "1 to set", one line, and its dashed places show which) | PFD fix 2, Impeccable A P2, the user's rule |
| All set says so in words: "All set" over "Locks when you start watching"; the tag names the episode, so titles don't repeat it | Impeccable A P3 and "Ep 6 five times" |
| B is A's two lines plus faces in every state: one height from due to set, so the all-set moment doesn't jump the page | Impeccable A P3 |
| Moves never split inside ("Pick who survives"); a line breaks between them with the dot leading, never dangling | Impeccable A and B |
| A replacement owed keeps its own time ("Replace Ana by Sat 8:00 PM"), outside "before you start watching"; drawn as an empty place, never the face of whoever left (it read as a locked face) | PFD fixes 4, Impeccable A P2, B |
| The game's dot always shows, deepened on the white plate to 3:1; a padlock follows a group that's locked while the rest isn't; locked faces read frozen (grey, dimmed) | Impeccable B (2.75:1 and 2.79:1 measured), PFD L1 |
| Locked at airtime: "Locked at airtime" on the strip; the sheet's subtitle "Episode 6 · locked at airtime" (it said "change anything until Wed 8:41 PM", past), no Save, no foot | PFD fix 3, Impeccable A P4, B |
| Two games at different paces: "Your pick locks when you start watching; the rest locked at airtime" | Impeccable A P4 |
| A partial save names what's left: "Saved. Pick who survives before you start watching." | PFD fix 5, Impeccable A |
| "+N" never hides an empty place; the dots count against the room | Impeccable A, B |
| The empty place's edge on the night panel is the control edge (it was 1.37:1) | Impeccable B |
| The screen reader's name for the strip carries its line (it dropped "Before you watch it") | Impeccable A |
| The sheet's tabs carry the game's dot, so the strip's dots are learnt one tap away | Impeccable A, PFD (dots as the only cue) |
| C: its head is a door (the view's one yellow was dead), its rows' words wrap instead of cutting "1 open", its "them" counts only what's open | Impeccable B, A |
| The frames: sheets shot after the pager's once-a-device peek; B shot last, so its save doesn't hand C a fresh couch | PFD, Impeccable B |

## Checked, not a finding

- **Two yellows once results are in with something due** (Impeccable A, inferred from code): the progress control's reveal is the
  primary only when every due move waits on it (`watchAction`), and a late move doesn't, so the strip holds the one yellow.

## Open, for the user or later

- **The carried lineup** (the spec's question 1): every read recommends all set, on the server's due moves, the badge and the push.
- **The dots name the game by colour alone** (WCAG 1.4.1); proximity and order help, the tabs now teach them, and the button's name
  says each game. Two of the colours sit near the couch's people colours on the ruler above.
- **The engine step** behind I'm watching and Watch along (a seat's own lock for an episode, closing its window as a reveal does),
  and the couch's marker saying a move was set during the airing.
- **Not rendered:** Studio (light mode), "+N" (no situation has seven tiles), a show without cast photos.
- **Old, seen on the way:** the tab bar's badge is Live Red (against "red is for leaving"); dock.tsx's 10 px STARTING tag and 14 px
  pool name; check-strip-settle.js's "Not yet is remembered" failed once and passed on its rerun (a save racing a reload).

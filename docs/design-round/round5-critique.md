# Round 5 of the game preview, as built: Impeccable critique (the round's check)

Method: dual-agent (A: a3b8f4ac6ffc231d0, the design review · B: a78e1d0cd8e21e138, the detector and the browser), isolated;
synthesized here, with A's main claims checked against the frames and the code. Frames: real renders at 390 under
`.ui-atlas/stories/game-preview/` (`draft/`, `story/`, and `round4/` for before) and `.ui-atlas/previews/fantasy-51/shots/`. Each
draft frame is one phone screen; anything lower on a page is quoted from the frame's `.txt`.

## Design health: 27/40 (Nielsen, this round's changed surfaces together): Acceptable, top of the band

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 2 | The strip now tells the truth, but the same screens still say "Set · Change your lineup", "Tied 1st · in front", "T1 of 4" and "BEST 1ST", and the ⋯ dot says Backstage needs the runner after a time is set |
| 2 | Match with the real world | 3 | "Nobody can pick until you do" and "Waiting for Alex" are plain and social; the fixes leak "In Before Merged" and "STAGES STANDINGS" |
| 3 | User control and freedom | 3 | The strip opens the room and never starts the draft; Start the draft now tells everyone at once, with no undo |
| 4 | Consistency and standards | 2 | One fact, four renderings: a plate with an hourglass (strip, hub), a bare link line (game page), "Not started yet · Alex starts it" (room), the time with and without "in 2 days" |
| 5 | Error prevention | 3 | Strip, then room, then Start is right; a runner alone gets a strip that sends them to the wrong place |
| 6 | Recognition rather than recall | 3 | The job sits where the runner already looks; Your team claims a total it doesn't show |
| 7 | Flexibility and efficiency | 3 | Two taps from any tab or the hub, Pick a time beside Start; the sheet compares games by moment and step |
| 8 | Aesthetic and minimalist design | 3 | One yellow fill per screen; the not-yours strip wraps to three lines, taller than the runner's two |
| 9 | Error recovery | 2 | "The draft can't start yet · Backstage says what it needs" names no need, and its tap opens the draft room (code; no frame) |
| 10 | Help and documentation | 3 | The runner's line is the right help at the right moment; "start it when everyone's in" can't be checked (every seat says Waiting) |

**The round in one line:** the decision is right and well made (one strip, the runner's job worded as theirs, an honest quiet wait),
but it stops at the strip. The same screens still claim teams and places nobody has yet, and the ⋯ dot keeps its own idea of what's
due.

## What works

- **One strip, not a runner card** (`draft/runner-tonight.png`, `runner-page.png`, `runner-hub.png`). The runner's job comes in the
  shape every due move already has: the chyron "Draft" tag, the white plate, an order as the title, the stakes as the line. It is
  the only yellow fill on each runner screen and reads as theirs at first glance. Nothing competes with it.
- **An honest wait with its own icon** (`draft/player-tonight.png`, `runner-timed-tonight.png`, `player-timed-tonight.png`). The
  hourglass and "Draft" on the night panel, the wait named ("Waiting for Alex"), no tick, no yellow. It differs from All set without
  colour (icon, tag word, verb). The timed line splits right by role: "It starts by itself" for the runner, "You pick your team
  then" for everyone else.
- **Routing over recovery** (`draft/runner-room.png`). The strip opens the room, never the start; the room leads with the
  continuation, Start the draft now, with Pick a time beside it.
- **The fixes' numbers are right.** "0 of 0 still in" is gone ("4th of 4 · 3.5 pts", `after-tonight.jpg` against
  `round4/fantasy-51-4-after-tonight.png`); Your team sums to the total (0 + 2 + 2 − 0.5 + 0 = 3.5, `after-team.jpg`); the finale
  ranks the whole game (Riley 34, Sam 32.5, Jordan 25, Alex 22, matching "Riley wins by 1.5", `story/fantasy-51-6-finale-s2.png`
  against `round4/fantasy-51-6-finale-reveal.png`).
- **The preview walks the app's way.** Each moment opens where you meet it ("TONIGHT › YOUR MOVE", `story/fantasy-51-3-week.png`,
  against round 4's move-first `round4/fantasy-51-3-week.png`); the path fits one row at 390; the sheet says in words which step
  every phone is on, names each column's screen and holds a shorter path at its last step (`story/sheet-draft.png`,
  `sheet-week-s2.png`).

## The Tonight exception: it holds, as a test

Starting a draft that has no time is a turn in the game's own play order, every other seat is waiting on it, and it's done one tap
from the strip. Results, invites, join requests and settings are upkeep that blocks nobody's turn, so they stay in Backstage and
Episodes. That line is principled. But DESIGN.md states it as one case ("the game's first move and nobody can pick until they make
it"), and two things already push past it: `runnerItems()` (`action-items.js:73`) is a general channel whose every item reaches the
strip, the hub's plate and the game page, and the code already puts a second runner state on the strip (finding 4). Write the test
into DESIGN.md's ⋯-menu bullet: **a runner's job takes the strip only if it is a turn in the game's play order, every other seat is
waiting on it now, and the strip's tap leads to where it is done.**

## Findings, by severity

### 1. [P1] The same screens still say everyone has a team and a place
- **Where:** `draft/player-page.png`: "Tied 1st of 4 · 0 pts · in front" sits directly above "Waiting for Alex to start the draft",
  with "Overall: 1st of 4" below ("Tied" and "in front" also contradict each other; the runner's timed page says the same,
  `runner-timed-page.txt`). `draft/runner-page.txt` and `player-page.txt`, below the first screen: Week by week says Ep 9 is "Set ·
  Yours to change until it airs · Change your lineup". `draft/runner-tonight.txt` and `player-tonight.txt`: Your games says "T1 of 4
  · 0 pts". `draft/runner-hub.png` and `player-hub.png`: "BEST 1ST" on the show card (and "Power rankings: you're 2nd" in
  `player-hub.txt`).
- **Why it matters:** the round's own rule is "never a tick or All set before someone has a team". "Set" with Change your lineup is
  the same claim, one scroll under a strip that says nobody can pick, and its link leads to a lineup that doesn't exist. Nobody tests
  a status that agrees with what they hoped (the first-view doc's L3), so the strip's honesty is spent one tap later.
- **Fix:** one "no team yet" test (the game's draft, or any of its stages', not started), read by Tonight's game line, the game page
  and the hub. Place shows "–" with "No team yet" (the Games tab already says "nothing counted yet", `draft/runner-games.png`); Week
  by week's Ep 9 square becomes the quiet hourglass "After the draft", with no Change link; Overall and the hub's Best badge wait
  until a team exists. Two causes in code: `tonight.tsx:361` reads `draftSoon` on the parent game, which a game in stages never has
  (its drafts are its stages'); `this-week.ts:290` adds "· in front" whenever place is 1, ties included.
- **Command:** /impeccable harden

### 2. [P1] The ⋯ dot keeps its own idea of what's due
- **Where:** `draft/runner-timed-tonight.png`: the strip says "It starts by itself" while the ⋯ dot stays lit and the button announces
  "Backstage needs you". `story/fantasy-51-3-week.png`: still lit after the first draft has started, beside "Set your lineup".
- **Why it matters:** Backstage's draft need (`backstage.ts:326-339`, a block this round reworded) keeps its own test: not started,
  and no classic `settings.draftScheduledAt`. The round's one rule, `draftStartDue` (`action-items.js:60`), reads the room's own time
  and also skips a draft that waits on results, a game without a cast and a game of one. So after a time is set, and while the
  merge stage's draft waits (most likely what lights it in the second frame), Backstage still says "Start the Fantasy league draft".
  A dot that says "needs you" when nothing can be done teaches the runner to ignore it. A dot that agrees with the strip, as on
  `draft/runner-tonight.png`, is fine: DESIGN.md allows chyron-line "needs you" dots.
- **Fix:** Backstage's draft need is `draftStartDue(state)`; a stage that waits on results says when it opens, as the strip does, and
  is not a need. While there: the dot is `bg-chyron` (`src/new/screens/show-space.tsx:605`), and the Fill Not Line rule wants
  `chyron-line` (the same on Night, wrong when Studio returns).
- **Command:** /impeccable harden

### 3. [P2] "Coming, and not yours" stops at the strip, and one fact is said four ways
- **Where:** `draft/player-page.png`: the game page shows the wait as a bare link line ("Waiting for Alex to start the draft · Pick
  in private, reveal together"), with no plate, tag or hourglass, and not the strip's line. `draft/player-room.png`: "Not started yet
  · Alex starts it". The timed state: "The draft starts Sat 11:12 AM" with no "in 2 days" on the strip
  (`draft/runner-timed-tonight.png`, `player-timed-tonight.png`) or the page (`runner-timed-page.txt`, whose line is "Pick in private,
  reveal together", not "It starts by itself"), against "· in 2 days" on the hub and in the room (`runner-timed-hub.txt`,
  `runner-timed-room.png`).
- **Why it matters:** it fails the round's R1 and R3 and DESIGN.md's game-page rule ("otherwise a small plate on a quiet tag (…
  Draft)"), and the strip breaks Calm clocks (`strip.tsx:92` passes `airTime`; the hub and the room use the calm form). A player
  walking strip, page, room reads three statements of one fact, and a bare weekday misreads for a draft more than a week out.
- **Fix:** the page's soon state uses the strip's quiet plate (small size, hourglass and "Draft", the strip's line by role); the room
  says "Waiting for Alex to start the draft" (and the spec's copy table, which contradicts its own R3, says so too); the strip and
  the page add "in 2 days".
- **Command:** /impeccable polish

### 4. [P2] The exception is already wider than its words
- **Where:** code; no frame shows it. `draft-words.ts:11` with `strip.tsx:90-93`: a runner alone in the game, or with no cast, gets
  "The draft can't start yet · Backstage says what it needs" on every show tab, in the not-yours hourglass tone, and its tap opens
  the draft room, not Backstage. The spec's "Left out" gives this state to Backstage.
- **Why it matters:** a runner who has just made a game nobody has joined gets a vague chore on Tonight that points to the wrong
  place, and it's a second runner state on the strip, one the test above would keep off.
- **Fix:** don't simply drop it: without it the strip falls through to "All set for Ep 9" (`strip.tsx:96-104`), the false status
  this round removed. Say the fact and send the tap where it's fixed: "The draft needs one more person · Invite someone" (or "Add the
  cast first"), quiet tone, opening Backstage's Invite people. Put the test in DESIGN.md and narrow `runnerItems` to turns by name.
- **Command:** /impeccable distill

### 5. [P2] Two of the three fixes are right in number but don't read as fixed
- **Where:** `after-team.jpg` and `story/fantasy-51-4-after-s3.png`: "they add up to your total", but no total in the column, and
  "+1 benched" beside a 0 reads as something to add. `story/fantasy-51-6-finale-s2.png`: the reveal's kicker reads "STAGES
  STANDINGS" (`reveal.tsx:1035`, "{game} standings", and this game is named Stages), which reads as standings by stage, the very bug
  just removed; nothing on the reveal says overall. `after-tonight.jpg`: "+3.5 pts · In Before Merged" isn't English.
- **Fix:** a total row at the foot of Your team ("Your total · 3.5", a hairline above, the same tabular column) and one decimal place
  down the column when any value has one; benched points as words on the muted line ("1 more on the bench, not counted"); the
  reveal's kicker "Overall standings" for a game in stages (the game page's own word: "Overall … both stages' points add up");
  Tonight's line "+3.5 pts · Before Merged" (drop "In"; Ep 9 already sits on the row's right).
- **Command:** /impeccable clarify

### 6. [P3] The preview's path looks like tabs and claims taps the app doesn't have
- **Where:** `story/fantasy-51-2-draft.png`: the current step is underlined over a full-width hairline, a tab bar with chevrons
  (Round 5's R1 and R3 ask for the current step filled). "Draft room › The teams" is the same room later
  (`fantasy-51-2-draft-s3.png`); "Game page › Your team" is the same page scrolled (`fantasy-51-4-after-s3.png`; the spec's After
  path has two steps); "Reveal › Game page" has no tap behind it (the reveal ends on "Back to Survivor",
  `fantasy-51-6-finale-s2.png`). `story/sheet-draft.png`: each column shows its path twice, in its header and in the card's own row
  (four chunks a column where R1 allows three), and the step control is equal pills with chevrons.
- **Why it matters:** the story teaches the app by walking it (R5); a chevron where there's no tap teaches a path that isn't there,
  and the tab look says "pick one".
- **Fix:** the current step as a bone-filled chip (the app's chosen fill), no hairline; the chevron only between a place and what a
  tap there opens, and a muted "then" before a later state of the same screen (or drop Your team as a step); on the sheet, drop the
  header's path row and keep the column's screen name.
- **Command:** /impeccable polish

### Smaller (P3)
- **An orphaned word** (`draft/player-tonight.png`): "Waiting for Alex to start the / draft" makes the not-yours strip three lines,
  taller than the runner's due strip. Balance the title's wrap (`text-wrap: balance`).
- **A decorative yellow in the room** (`draft/runner-room.png`, `player-room.png`): the waiting card's eye is chyron-line; on the
  player's room it is the only yellow, beside words that say nothing is theirs. Use the hourglass, in the foreground or muted (the
  icon predates the round; the words beside it are the round's).
- **"When everyone's in", with nobody in** (`draft/runner-room.png`): every seat, the runner's own included, says "Waiting". Drop
  "Waiting" from the runner's seat and say who's here ("4 of 4 here"), or drop "when everyone's in".
- **An optional start in yellow** (`draft/runner-timed-room.png`): with a time set, Start the draft now is optional, so under "Yellow
  only for what you must do" it's an outline beside Change time.
- **No undo on the start** (`draft/runner-room.png`): it tells three people at once with a plain toast. The wizard's Start it already
  has the pattern ("3 hear in 10 seconds", Undo).
- **One game, two names** (`draft/runner-hub.png`): the hub's plate says "Nobody can pick until you do · Fantasy league · Before
  Merged" (three facts over two lines; the spec has "· Fantasy league"), while Tonight and the game page call the game Stages. Name
  the game as its page does, and add the stage only when two drafts wait.
- **Fixture:** Alex and Sam share one blue (`draft/runner-page.png`, `runner-room.png`): the fixture's colours, not the round's.

## Detector and browser (B)

- **CLI** (`impeccable detect --json` on the round's nine changed .tsx files): exit 0, no primary findings; 93 advisories, all
  `design-system-font-size`. One sits on a line the round changed (`sections.tsx:379`, a 14px that predates it); every size the round
  added is on the ramp (11, 13, 15, 16, 22 px). Without DESIGN.md the scan is empty. As round 2's critique noted, DESIGN.md's
  front-matter ramp is what's missing (14, 17 and 20 px are named in its own prose and used widely).
- **Browser:** the overlay ran on five views of the preview story and sheet, which render without a session: one finding,
  `edge-flush-cards` on the sheet's column scroller (`sheet.tsx:42` and `68`, untouched by the round), most likely the desktop
  scrollbar taking 15 px at a narrow window, not the phone. The hub, Tonight, the game page and the draft room redirect to sign-in,
  and the preview shows them as screenshots, so their markup had only the static scan; the frames carried their review. B closed its
  tab and stopped its live server; no overlay is left open.
- **Together:** the detector and the design review agree the round adds no visual anti-pattern. Every real problem here is the truth
  of a state and its words, which a static scan can't see.

## Personas

- **The runner (Alex):** the job is unmissable on every tab, the round's win. Then the room says "start it when everyone's in" with
  every seat "Waiting"; after setting a time or starting, the ⋯ dot stays lit; their own page says their Ep 9 lineup is "Set".
- **A player (Riley, seat R):** one honest claim that they have no team (the strip), then three that say they do: "Tied 1st · in
  front" and "Set · Change your lineup" on the page, "BEST 1ST" on the hub.
- **Casey (one-handed, interrupted):** the timed strip's bare "Sat 11:12 AM" can't be told from today at a glance, and nothing says
  whether the draft lands before Ep 9 airs in under five hours (`draft/runner-tonight.png`).
- **Sam (screen reader):** the ⋯ button announces "Backstage needs you" when nothing can be done (`runner-timed-tonight.png`); the
  seats' "Waiting" is small muted text at reduced opacity. The quiet states pass: their words carry the meaning, not the icon.
- **A stress tester:** a runner alone gets a strip that opens the draft room while saying Backstage; a draft timed for Saturday,
  after Thursday's Ep 9 (`runner-timed-tonight.png`), draws no word on whether Ep 9 still counts; with two runners, "Waiting for
  Alex" names only the first.

**Cognitive load:** moderate, 3 of 8 failing: hierarchy on the player's page (the rank above the wait, which lost its plate),
working memory (Your team's total and the room's "everyone's in" both live elsewhere), and the sheet's seven moment pills
(acceptable on a desk tool, since they run in the season's order). **Emotional journey:** the runner's false calm ("All set")
becomes a small, clear "it's on you", resolved in two taps; the ending sours when the dot stays lit and Backstage still says "Start
the … draft". The player's "Waiting for Alex" earns trust that the page spends one tap later.

**Trend for `src-new`:** first run for this target, no trend yet (27/40). Snapshot for `/impeccable polish`:
`.impeccable/critique/2026-11-19T16-47-10Z__src-new.md`.

## Questions for the user (to relay at the story's pause)

1. **Before anyone has a team, what is a game's page?** (a) Today's page with honest words: "–", "No team yet", the Ep 9 square
   "After the draft". (b) A pre-draft phase of its own: the draft's plate, the seats and How it plays, with no season grid, Overall
   or Week by week until the draft. (c) Fix the false words now and decide the phase later.
2. **A runner alone in the game, or without a cast:** (a) a quiet strip that names the need ("The draft needs one more person ·
   Invite someone") and opens Backstage; (b) the yellow, since the game can't begin until they act; (c) ask when the draft is while
   making the game ("When's the draft?", with "I'll start it" as the second answer), so the exception fires only for runners who
   chose it.
3. **As the first counted episode nears:** (a) Start the draft escalates inside its last day (the time left in plate-line, as Up next
   does) and a time set after that episode warns in Pick a time; (b) only the warning in Pick a time; (c) neither (the show bar
   already counts down).

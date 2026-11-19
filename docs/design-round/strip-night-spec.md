# Episode night, the late window: page spec (the strip and Your moves)

The user, 2026-11-18, on Survivor 51's Ep 9 night (8:03 PM, Ep 9 on air, through Ep 8, every game on the live pace): "survivor
is airing now. But I haven't started yet... I come to this thinking 'oh maybe I should edit my lineup before watching', but the
UI reads immediate as it's locked... the other scenario is I'm actually all set with my lineup and I'm just visiting the page to
see who I started. Both scenarios need to work flawlessly without confusion."

## What's wrong today

The live pace (every running game's since 2026-11-14: docs/PLAN-own-pace-games.md, "Pace is the game's setting") keeps a move
for an aired episode open, for anyone who hasn't watched it, until they watch it or the next episode airs. Own pace keeps it open
until they watch it. The engine, the routes, the home's moves and the Games tab's card all hold the window; the strip and the
sheet's head contradict it.

| When | Where | Says today | True for someone who hasn't watched |
| --- | --- | --- | --- |
| On air | The strip (every tab) | 🔒 EP 9 · **Locked for Ep 9** · Scores stay hidden until you reveal | Open until they watch it; no scores exist yet |
| On air | Tonight's tab badge | 3 (the late moves, due) | The strip above hides all three |
| On air | Your moves, subtitle | Episode 9 · change anything until Wed 8:00 PM | 8:00 PM has passed; open until they watch |
| On air | Your moves, Save's toast | All set. Change anything until Wed 8:00 PM. | The same |
| On air | Your moves, honour note | Episode 9 **has aired** | It's on now |
| On air, aired before results | The honour note's **I've watched it** | Opens a reveal with nothing to show (no results yet) | A dead end |
| After it airs | The strip | EP 9 · Set your lineup · Pick who survives · **Lock when it airs** | "It" reads as Ep 9, which aired; watching it is the lock |
| Results in, not revealed | The strip | ✓ EP 10 · **All set for Ep 10** · Change anything until it airs | The moves still open are Ep 9's; Ep 10's aren't open yet |
| 7:59 PM → 8:00 PM | The strip, the push | A lineup carried in complete: **All set** → **Set your lineup** (the yellow, and a push) | The same lineup on both sides of airtime |

The cause of the first row: `stripState` returns the locked state whenever the episode is on air, before it reads the moves or the
window (src/new/show/strip.tsx:57). It was written in step 3 (2026-11-15), the day after the pace shipped; step 3's `show-locked`
situation was a live-only game, where nothing stays open.

Faults, by harm:
1. **The strip says locked while the moves are open.** Scenario A is told the wrong thing, and the badge counts moves the strip
   hides.
2. **Who's starting is nowhere on Tonight's first view.** Scenario B needs a tap into a sheet of editable tiles, and "Locked"
   makes that tap look read-only.
3. **Times already past** in the sheet's subtitle and toast.
4. **"Lock when it airs"** after the airing points at the wrong lock.
5. **A carried lineup flips from set to due at airtime**, with a push, though nothing about it changed.

## The job

On episode night, say once whether your moves for the episode on now (or just aired) are still yours to change, what they are
and what's missing, with one tap to change them. The honour rule lives in the words: you change them only before you watch.

The unit is **your episode**: the one your window is open for, across every game you play on the show.

## Who comes, and what they need

| Who | When | Came for | Without a tap | In one tap |
| --- | --- | --- | --- | --- |
| Conor, not watched yet (A) | On air, before he starts | "Should I change my lineup first?" | It's open until he watches; what's set | Your moves, editable, the honour note |
| Conor, all set (B) | On air | "Who did I start?" | Who he started in each game, and that it's in | The same sheet |
| Andrew (drives by) | Any time that night | Anything due? | The yellow only if something's missing | Set it, Save |
| Joanna (forgets): watched it live on TV, set nothing | After it airs | Nothing in particular; the app nags | "Before you watch": it isn't hers to set now | Seen Ep 9? (once results are in) closes it |
| Anyone in a strict game, or an episode locked by hand | On air | Who's in | Locked, and who | The sheet, read-only |

## Watching live isn't "before you watch"

The user, 2026-11-18, mid-round: "We also don't want someone who's watching live to be mistaken that they can make moves because
that would be cheating." During the airing most people opening the app are watching it. A strip that says "Change it before you
watch" over an open lineup reads, to someone twenty minutes in, as permission. The window stays (the late joiner and the person
who hasn't started still need it); what changes is that nobody can use it by mistake:

- **The words name the moment you start, not the episode.** "Locks when you start watching", "Before you start watching". The
  person watching reads that it's locked for them; the person who hasn't started reads that it's open.
- **The sheet asks before it opens the moves.** In the window, Your moves first asks "Have you started watching Ep 9?" with two
  answers of equal weight: **Not yet, change my moves** (the moves open, as now) and **I'm watching, lock them in** (once results
  are in, **I've watched it**, which opens the reveal). Your moves show behind the question, read-only, so who you started is
  still there to see. Asked every time the sheet opens in the window: a deliberate answer each time, never a habit.
- **Saying you're watching locks your moves for that episode, in every game** (an engine step: a seat's own lock for an episode,
  set from the question, closes its window the way a reveal does; until it's built the story simulates it in the client).
- **Watch along is watching.** Starting it while your moves are open says so first: "Watching along locks your Ep 9 moves", with
  Start watching and Change my moves first. Starting it locks them.
- **The couch's marker says when.** A move set after airtime already shows "Set after it aired, before they watched"; one set
  while the episode was on air can say so ("Set during the airing, 8:41 PM, before they watched"), the social half of the honour
  system.

## The night, phase by phase

The game's pace sets what each phase does. Live: the window closes when you watch, or when the next episode airs. Own pace:
when you watch. Strict, or locked by hand before airtime: at airtime.

| Phase | The progress control (unchanged) | The strip, window open (live, own pace) | The strip, strict or hand-locked |
| --- | --- | --- | --- |
| Before airtime | Through Ep 8 · Ep 9 · Wed 8:00 PM | Due: Set your lineup · Locks when it airs. Set: All set for Ep 9 · Change anything until it airs (both unchanged) | the same |
| On air | Through Ep 8 · 1 behind · Ep 9 on air now · **Watch along** | **Open** (the table below) | **Locked for Ep 9**, with who you've got |
| Aired, results on their way | Ep 9 just aired · results soon | **Open** | Locked for Ep 9, with who |
| Results in, not revealed | **Seen Ep 9?** (one at a time) | **Open** (Joanna's way out is the control's Yes) | Locked for Ep 9, with who |
| Revealed | Through Ep 9 · Ep 10 · Wed 8:00 PM | Moves on to Ep 10 (unchanged) | the same |
| Ep 10 airs, Ep 9 still unwatched (live) | Seen Ep 9? | Ep 9 closed as it stood; Ep 10 waits on the reveal (unchanged) | the same |

**Open**, by what's in:

| Your moves for the episode | Tone | Tag | Title | Line |
| --- | --- | --- | --- | --- |
| Every move in: a lineup saved for it, a pick made | Set: plain, a tick | ✓ EP 9 | All set for Ep 9 | Locks when you start watching |
| Something missing: an empty slot, no pick, someone to replace | Due: the one yellow | EP 9 | Set your lineup · Pick who survives (as today, "· N more" past two) | Before you start watching |
| A lineup carried in complete from last week | Set or due (the open question below) | | | |

The next airing within a day adds its lock to the line: "Before you start watching · locks Wed 8:00 PM". Locked by your own
answer (you said you're watching): "Locked in for Ep 9", who you've got, no yellow. Otherwise the cap isn't on
the strip: on the night it's a week away.

**Who you've got** sits on the strip in every state of the window, and in the locked state: the lineup's starters and the pick,
by game. How (names, faces, or a plate on Tonight) is the shape's question; three directions follow.

## Your moves, opened in the window

| Part | Says |
| --- | --- |
| Subtitle | Episode 9 · on now, or Episode 9 · aired |
| The question (replaces the honour note) | **Have you started watching Ep 9?** Moves lock when you start, so the couch plays fair. **Not yet, change my moves** / **I'm watching, lock them in** (results in: **I've watched it**, the reveal) |
| After Not yet | One line over the moves: "Not started · change anything until you do" |
| After I'm watching | The sheet closes; "Locked in for Ep 9. Enjoy the episode." |
| Save's toast | All set. It locks when you start watching. |
| Foot | Saving doesn't lock anything. Watching it does. (kept) |
| A strict or hand-locked game's tab | Locked for Episode 9: Kristin, Sam, Joe. (kept) |

The Games tab's card says the same words: "Before you start watching" where it says "Ep 9 aired · you haven't watched it · set
your lineup first", and "Locks when you start watching" where it says "Change until you watch it".

## Three directions for who you've got

| | A · Say it straight | B · Who you've got | C · Before you watch |
| --- | --- | --- | --- |
| The strip | Today's shape, honest words; who you've got is one tap away | A's words with a row of faces under them: the starters, then the pick, an empty slot dashed | B's strip on every tab but Tonight |
| Tonight, in the window | The strip | The strip | A plate in the strip's place: each game's move for the episode (faces, names, Change), the state once, the honour line |
| Scenario A (change it first) | Read "open", one tap | Read "open", one tap | Read "open", one tap to the game's tab |
| Scenario B (who did I start) | One tap | No tap: faces | No tap: faces and names, every game |
| Cost | Least change | A taller strip, faces at 28 px | A taller first view on the night; repeats what Your games says lower down |

## The pick: C, with Lock in (the user, 2026-11-18)

"C i think is best because it give you not only a way in to set each missing or desired-edit per game but it also helps the 'at a
glance' who do i have set question. Maybe in that first row on the right side of the banner theres a Lock In button to essentially
say, 'I made my picks, Im about to watch'."

| Part | What it is |
| --- | --- |
| The first row | The tag (EP 9, a tick when all set, the yellow when something's missing), **Before you watch**, what's left ("2 to set" or "All set"), and **Lock in** on the right |
| A row a game | Its name, its people (faces and first names; a long line wraps, never cut), and its verb, the Games tab's: **Set** a lineup, **Pick**, **Edit** what's in, **Claim** a replacement, or Locked. The row opens that game's move, through the sheet's question |
| Lock in | Locks your moves for the episode in every game (the self-lock). All set: at once, "Locked in for Episode 9. Enjoy the episode." with Undo for a few seconds. Something unset: it asks first, listing what isn't set, **Set them first** or **Lock in anyway** |
| Once locked in | The plate gives way to the one-line strip, "Locked in · You're watching it" and the frozen faces: tall only while there's something to decide |
| The sheet's question | "Have you started watching Episode 9?" **Not yet** (change my moves) / **Yes** (lock in; once results are in, see the results) |
| Every other tab | The one-line strip, in the same states |

The checks' costs of C, and the answer to each: the first view (the plate collapses once you lock in; the honour line is gone, Lock in
says it; rows are one line of people), truncation (names wrap), the head as a dead zone (it holds Lock in), a second shape on other tabs
(the one-line strip is C's collapsed form).

## At a glance on the Games tab (the user, 2026-11-18)

"We mention Thien but never show her face plate. We don't see our lineup here either." Each game's card on the Games tab shows
who you've got under its move's words and button, all week:

| Game | Plates |
| --- | --- |
| A lineup | Its starters as the pool sheet's face plates (face, first name, points), an open slot dashed, the bench in words in the row's last cells |
| A pick | The pick's plate, ticked as the pool sheet ticks it, and what it puts on the line beside it ("Streak 4 → 5 if Cristian survives"); not made yet, a dashed Pick and what you can pick from |

**One row a game** (the user, version 5: "keep the vertical real estate in check. Because who's to know how many games could be
going on in a given moment"). The glance is the move's own row, Tonight's plate's row without the game's name (the card's head has
it): up to three small cast tiles (26 x 34), the words, the verb as text with a chevron. Set, the words are who you've got ("Cristian,
Danny and Devin", "Cristian"); something missing, a claim, or swaps on your team, they're the move's own ("Set your Episode 6
lineup", "Maggie for Ana", "Optional swaps open"); a lineup too big to name is counted ("9 starting"). The line under them is the
move's (when it locks). The tiles open the plates above in place (Show less closes them); the words and verb open Your moves; each
plate opens that castaway's or athlete's sheet.

**Each game in its own shape** (the user: "different game types should have different at a glance views ... a collapsible/expandable
section or a quick pop up"; "the UI should consider a large starting lineup"). Three places in the row; past three, the empty ones
first (what's missing never hides), then faces, then **+N** (dashed when everything it counts is empty). Opened: every plate, four a
row, tagged by slot where the game has them; a lineup with nothing in it opens to one dashed line naming its slots. A glance that
isn't faces opens its own sheet as the quick pop-up.

| Game | In its row | Its tiles opened |
| --- | --- | --- |
| A lineup | Starters, an open slot dashed; set, their names | Plates with points; the bench beside them |
| A sport's lineup (slots) | Three places and +N; set, "9 starting" | Plates tagged by slot; an open slot named ("Open · TE"); nothing set: one dashed line naming the slots |
| A pick / several picks | Each pick ticked, +N past three; set, its name | Each plate; what it puts on the line |
| A waiver claim | Who leaves (greyed), who comes in | Their plates |
| A team (Outlast), or swaps open on it | Your team, still in first, out greyed | Every plate |
| Head to head | Yours against theirs, theirs once locked | The matchup sheet |
| A prediction sheet | How many answered; the first answers in words | The sheet |
| Bingo | The card as a small grid, ticks filled | The card |
| Weekly calls | Your two calls in words | |
| Best ball | Your roster, last week's scorers ringed | +N |
| A draft | Your picks so far, who's next in your queue | The draft room |

Built in the round (games.tsx `Glance`): a show's lineup, a sport's nine (story frames on draft-fixture.js `--sport --slots`), a
pick, a claim, a team. C's rows on Tonight count a big lineup ("9 starting · 1 open") and show four tiles and a "+N".

## However many games are going (the user, 2026-11-18, version 5)

Heights that hold whatever the couch is playing:

| Where | Up to three games | More |
| --- | --- | --- |
| Tonight's plate (C) | Its head and a row a game, as before | Its head, two rows (what needs you first) and one fold row: "N more games", a face a game (an empty place where one's missing), "All set" or "N to set", Show; opened in place, then Show less |
| A game card's glance | One row (above) | The same, every card |
| The one-line strip elsewhere (B's faces) | Faces under the line | Words only ("2 to set"); never faces on the Games tab in C, whose cards show who |

Measured on night-fixture.js `--extra=4` (seven games, all set), the Games tab's whole length: today 3,257 px, version 4's plates
4,263 px, the row 3,285 px (about 4 px a card). Tonight's plate with seven games ends where three games' did. Most of a card is its
leaderboard, glance or not: a shorter card for a busy couch is a separate question (Open questions). On Round 3's Games tab
(after the wizard merge, 2026-11-19; whats-on.tsx's season games carry the glance through `GameRow`): 3,125 px without the
switch, 3,136 px with the glance; all set, 3,108 and 3,136.

## Flows

1. **Change it first (A):** Tonight → the strip (open) → Your moves asks "Have you started watching Ep 9?" → **Not yet, change
   my moves** → tap a starter, tap a bench player → Save → "All set. It locks when you start watching." → the strip: All set for
   Ep 9, the new starters.
2. **Who did I start (B):** Tonight → the strip (B, C: read the faces; A: tap, the moves show behind the question) → close.
   Watching live: the same, and **I'm watching, lock them in** (or starting Watch along) settles it.
3. **Watched it live, set nothing (Joanna):** Tonight after the airing → the strip, yellow: "Before you start watching" → she
   taps it anyway → "Have you started watching Ep 9?" → **I've watched it** (or **I'm watching**) → locked as it stood.
   Once results are in → the control's **Seen Ep 9?** → Yes → the guard → the reveal → Ep 9 closes as it stood → the strip moves
   on to Ep 10.
4. **Strict:** on air → Locked for Ep 9, who you've got → tap → the sheet, read-only.

## Left out, and where it went

- **"Scores stay hidden until you reveal":** no scores exist during the airing; once they do, the progress control's Seen Ep 9? /
  Reveal Ep 9 says what's waiting.
- **A countdown to the next airing:** a week away on the night; said only within a day.
- **A Set · Watch · Reveal stepper:** the own-pace plate's steps were folded into the strip (the move) and the progress control
  (watch, reveal) on 2026-11-15; the night keeps that split.
- **Locking your own moves** ("Lock it in", or Watch along locking them): a new rule; the honour words carry the night without it.
- **The push:** its words already say "before you watch it"; who gets it follows the open question below.

## Open questions

1. A lineup carried in complete from last week, while the window is open: all set (as before airtime, calm, no push) or due (as
   today: the yellow and a push, every night, for everyone behind)?
2. ~~Which direction for who you've got: A, B or C?~~ C, with Lock in (the user, 2026-11-18).
3. Two games on a couch at different paces (one strict, one live) on the night: does the strip speak for the open one, with the
   locked one said in its tab only?
4. A busy couch's Games tab: seven games run about 3,130 px on Round 3's tab (3,260 on the one before it) with or without the
   glance, four standings rows a card. A shorter card
   (your place and the move, the table a tap away) once a couch has more than a few games?

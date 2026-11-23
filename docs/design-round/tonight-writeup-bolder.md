# Last time's write-up: the bolder round (Impeccable, bolder)

The user, 2026-11-23, on the built write-up (tonight-writeup-shape.md): "Can we make the summary a bit more of a bold design with some
character. Right now it's just a plain text. Nothing grabbing the users attention. Give me several impeccable mocks of what this
could look like. Make sure it doesn't feel out of place, but not soulless either."

This overrides the first round's R2 (the write-up as quiet body text, below the plate in weight) in the user's own words. The plate
should still lead. The write-up now has to earn a second look.

**Why it read flat (bolder's question).** Last time's other parts use the system's strongest moves: the Out plate (a face, the red
tag's angled cut, condensed caps) and the stat plate (a caption tag on a plate). The write-up used none of them. Every look below
borrows one of the system's own moves, and none adds a colour, a font or a primitive DESIGN.md doesn't already have.

| Look | The move it borrows | Height (3 lines) |
| --- | --- | --- |
| lede | the reveal's "In this episode": the first sentence bold and big, the rest muted behind "more" | 74 px |
| tag | the stat plate's tag on a Night panel, "In this episode" | 129 px |
| faces | the reveal's face plates, small and in the line: the face, the name, the tribe's colour on the end; grey once out; a tap opens their sheet | 79 px |
| headline | the display caps: a line over the story, which sits quiet under it (needs a headline the search doesn't write: the open choice) | 78-101 px |
| tagfaces | tag and faces | 135 px |
| headfaces | headline and faces | ~80-100 px |

The fixes made in this round, after the first look: a possessive stays on its plate ("Aesha Monroe's"), and someone with no photo
gets a name plate, not a grey initial (it read as a broken picture).

**Risks seen in the frames.** The tribe colour is the tribe as of your episode, so in a swap episode it can disagree with the
sentence ("sent Carter to Toka", on Savu's colour). The opened faces look is busy: eight plates in eight lines on Survivor's Ep 3.
The tag looks add about 56 px, which pushes a player's Your night further down.

Code: `tonight.tsx` `useWriteUpLook` (development only, `?writeup=<look>`). Frames: `story-writeup.js --look=<look>`. Once the user
picks, that look becomes the only one, the rest are deleted, and the chosen one gets the round's single check (PFD evaluate,
Impeccable critique) and one batch of fixes.

## The pick: B, with a headline (the user, 2026-11-23)

"Let's do B. I think it not only looks the best, but it's the lightest weight. I love the headline, but I don't want to do a
headline backfill. Unless we can do a one time AI ask for all existing prod episode (one prompt give us a list of headlines for all
episodes) then new episodes from here on out have the headline built in."

We can. Production (backup 2026-11-21) has 25 write-ups (The Challenge 42: 13, The Traitors 5: 8, Below Deck 13: 4), about 8,000
characters, so one ask covers them. The headline comes from the write-up's own words, with no new search.
`scripts/headlines-once.js prompt` builds the ask from a backup or a database. The answer for production's 25 is in
`scripts/headlines-once.prod-answer.json`, written in this session from each write-up, so no paid key or bot was used. `apply` writes
each one only where a write-up has none yet. New write-ups get theirs from the recap search itself: the prompt asks for a headline
of 60 characters or fewer, `readHeadlines` keeps one clean line of 80 or fewer and drops longer ones, never cutting them, and
`saveRecaps` saves it with the summary.

**As built.** B as the stat plate's dark sibling:
- the same anatomy: tag, a title in the caption caps at the stat title's 18 px, then text;
- the summary muted and two lines under a headline;
- with no headline, the foreground and three lines;
- the other five looks and the development switch deleted.

The reveal never reads the headline: its "In this episode" plays before who went home.

## The check (once): PFD evaluate

| Layer | Score | Reasoning |
| --- | --- | --- |
| Foundation | 80 | One panel (131 px; 154 px with a two-line headline), one control. The headline compresses the episode into one chunk, the thing Joanna lacked. A player's first view still shows the Out plate and the headline. |
| L1 | 84 | White Out plate, dark panel, white stat plate: the panel breaks the white stack into a rhythm, and the plate still takes the first glance. The caps headline is the second fixation, as intended this round. |
| L2 | 88 | It's the stat plate's anatomy exactly, so it reads as a sibling (Gestalt similarity). It uses the same tag, the same title size, and no new colour, font or shape. |
| L3 | 80 | The headline puts the point first (who left and how), which story order never did. The guard checks the summary's names, not the headline's, so a headline could still disagree with the plates. |
| L4 | 82 | Tap opens and "less" closes, as before. The doors below are unchanged, and the headline primes Discuss. |

Overall (80×1.5 + 84 + 88 + 80 + 82) / 5.5 = **83**. No caps apply.

## The check (once): Impeccable critique

Two separate reviewers. The detector found one new advisory: the headline's 18 px is off DESIGN.md's type ramp. It's the same
as the stat title beside it (and `text-[18px]` 36 times in src/new), so the ramp is behind the code. Everything else it found
was older code. Measured: the headline 14.5:1, the muted text 6.7:1 on the panel (6.4:1 in Studio), "more" a 52×44 tap area,
no overlaps, no sideways scroll at 390 or 320. The design review scored Nielsen 21/36. Its priority issues, and what happened to
each:
- **P1 The headline was unguarded.** Fixed: `headlineAgrees`. The headline shows only when it names someone who left and its count
  is in the write-up (the `guard-headline` frame).
- **P1 A competition headline repeats the plate** (it asks for "the turn the plate can't show"). Kept as approved. The user saw the
  named headline ("ROB WALKS OUT, PATT BLINDSIDED 6–5") and chose it, and the count and the turn are in it.
- **P2 Height.** 60 characters measured two lines at 390. The one stated limit is now **45** (`HEADLINE_MAX`), one line on an
  ordinary phone and two at 320 (measured). The headline also has a two-line clamp in case a font falls back.
- **P2 Studio, sports.** The panel is `bg-secondary`, Studio's raised grey, so it no longer reads as a pale twin of the white
  plates (measured, frame). The tag is the show's own word ("In this game"). A sports summary that repeats the score under its
  headline is left open.
- **P3** All fixed:
  - Opened text lifts to the foreground.
  - The cut never ends on a small word that needs the next ("on his…").
  - A count never breaks at its dash (word joiners).
  - The headline wraps `pretty`, not balanced.
  - The panel presses.
  - No semicolons in headlines: the prompt says so.

**What production's real results changed.** The first guard required the write-up (and headline) to name *everyone* who left.
Checked against the backup, that hid 4 of the 25:
- the Challenge finale, whose "leavers" are its nine finalists;
- Traitors murders recorded an episode after the write-up tells them.

Both guards are now *someone* who left (`namesAnyone`). That still keeps another episode's write-up off (the `guard` frame).
All 25 production headlines pass (`check-prod-agree`, run 2026-11-23).

Open: the headline on the episode's own page ("What happened"); the tag carrying the air date instead of "In this episode" (the
design review's question: Joanna can't place "Ep 3"); a sports summary that opens with the score its headline already gives;
DESIGN.md's type ramp brought up to the code (18 px).

## Every show (the user, 2026-11-23)

Seen live: Survivor had no headline. Production had no Survivor write-ups at all, because write-ups were asked for only for a
show nobody plays (a tap on Episodes, or Getting it ready). The Survivor frames in the stories used write-ups from the local copy;
that should have been flagged. The user: "Automatic and fill S51 now. All shows should have summaries. The challenge, traitors,
survivor etc, I think even sports." For the reveal: "Summary after the vote".

- **The research clock's last job** (episode-recaps.ts runDueRecaps, recapsNextAt; api/cron/bot-research). It runs on a call that
  ran no results, Getting it ready or catch-up job. It covers every season someone follows or plays, and only its newest 10 aired
  episodes (RECAP_WINDOW), so a sport's long season never backfills a year. An episode is asked about two hours after it ends,
  and again 6 hours after an ask that found some, a day after one that found none or failed. A new episode never waits on an old
  one's retry (`recapsDueAt`, tested). One ask brings the write-ups and their headlines.
- **The reveal** (reveal.tsx): "In this episode" plays after the vote cards when someone left, and first when nobody did.
- **Production's catch-up** after the deploy: Survivor 51's aired episodes, filled at once on the user's word; then, by the clock,
  whatever else is missing among each followed or played season's newest 10.

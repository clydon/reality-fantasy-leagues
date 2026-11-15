# First-view requirements for every layer (Phase 0, 2026-11-14)

A derivation from perception's hard limits to what each layer's first phone view (390 × 844) must and must not hold. Inputs: the
census in `.ui-atlas/stories/phase0/census/` and [the system map](phase0-system-map.md). People: Joanna forgets (back after a week,
reads the top for "is anything for me"), Andrew drives by (taps the one bright thing and leaves), Conor tinkers (goes three levels
deep for the numbers).

## The problem

Someone opens the app, or a show in it, in a spare minute: before an episode, between other things, or after a week away. In one
look they want three answers: where they are (the show, the episode, how far they've watched), what matters now (a move due and
when it locks, a result waiting, what their friends did), and what to do next. Today each first view gives those answers among a
median of 11 type sizes, 100 to 220 words and the same deadline said three times, beside states of the engine they didn't ask
about (setting chips, a spoiler line on five tabs). The answer a head-to-head player wants most, who they play, is on no screen. At
a sport's scale the same screens break: face tiles for 49 athletes run four screens, and the words are a show's.

## L0 · Cognitive load

**Constraint.** Working memory holds about three to five chunks, and visual noise spends it even when nobody attends to it.

**Violation.** The hub's first view holds seven chunks (a strip, the couch's faces, a plate, its move, its time, "0 of 4 picked",
Watch along). The game page holds 32 to 46 controls in view, because every square of the grid is one. The lock time appears three
times on Tonight and three on the hub. Engine state reaches the surface as if it were news: "BLIND DRAFT", "WAIVERS", "ONE OWNER
EACH", a game titled "ACTIVE-ROSTER", "Spoiler protection is off", a reveal button on each game for one reveal that covers them all.
Each is a backend fact turned into a frontend chunk.

**R1.** Each layer's first view must carry at most four chunks for the person's situation right now: where they are, what matters
now, the next action, and one social signal. Each fact is said once per view. An engine state appears only where it changes what
the person does now; everything else sits one named tap away.

**Citations:** Cowan (2001) for the three-to-five chunk ceiling; Hassin et al. (2009) for unattended noise spending working memory.

## L1 · First impression

**Constraint.** Appeal is judged in about 50 ms, and what looks good is judged to work better. The first impression is where
attention switches on.

**Violation.** Where the show's art and the cast's faces lead (the hub's Up next with Survivor's art, the welcome page's cast, the
Your moves face grid), the 50 ms read is "TV night with my people". Deeper in, it isn't. The game page opens on a two-line display
title that fills a quarter of the view and says only the game's name ("WEEKLY LINEUP", or "ACTIVE-ROSTER" for a sport). Every
show header carries a ghost copy of its own title. A show without art (a new show, most talk and story shows, the census's
fixtures) falls to grey slabs. A sport's athletes are letter tiles. The same app reads as a TV night on one screen and a settings
page on the next.

**R2.** The first 50 ms of every layer must land on one recognizable anchor of the show or its people (art, a face, a scoreline,
a chart of the season), tied to the person's situation, never a label or a title alone. Each layer must have an equally deliberate
form for a show with no art, a cast of 300, or a story with no one leaving.

**Citations:** Lindgaard et al. (2006) for the 50 ms gate; Kurosu & Kashimura (1995) for the aesthetic-usability effect.

## L2 · Processing fluency

**Constraint.** What's easy to process is judged truer, more trustworthy and more likeable, and the signals must tell one story.
Consistency beats invention.

**Violation.** One meaning takes many forms: the move seven, the result six, a cast member six, the episode card six, a friend's
face and position seven. Viewing progress lives in four places in four forms. Words drift: a football game says "You're set for
Episode 3", a series with no game says "Locked at 10:12 PM", a Players tile says "7.5 pts" without saying whose points. In a game
about scores and spoilers, trust is the product, and each re-learned form reads as "is this right?".

**R3.** Each shared part (the move, the result, the matchup, the person, the episode, the progress control, a friend's position,
the stat table, the person sheet) must have one form and one vocabulary per flavor, shown at every distance as the same object
nearer or farther: an excerpt, never a redesign. Type sizes and colours come from a small fixed scale (about five sizes in any
first view, one accent with one job).

**Citations:** Reber & Schwarz (1999) for fluency judged as truth; Spence (2011) for coherence across signals.

## L3 · Perception bias

**Constraint.** People act on autopilot and explain afterwards. The brain predicts: a match runs on autopilot, a mismatch fires
attention. Trust is perceived from coherence before any argument is read.

**Violation.** "Busy and overwhelming" is the couch's after-the-fact summary. The behavior under it: Joanna scans the top for
"anything for me?", Andrew taps the yellow and leaves, Conor scrolls for numbers. Each entry sets a prediction. A TV app predicts
"my episode, and when". A fantasy app predicts "who I play and my lineup", and that one goes unmet. Yellow marks a due move, but
also Reveal, Start it, Save, Claim and a decorative slab on four cards, so "yellow means for me, now" is spent. The spoiler line on
every tab trains people not to read it, so the one time it matters (a sport's "results show as they come") goes unseen.

**R4.** Every layer must meet the prediction its way in sets: a show, my episode and its time; a game, who I play and my lineup; a
sport, my players' games and their numbers. Each layer keeps its one attention signal (the accent, motion, a badge) for the one
thing that is new or due for this person, so that its absence reliably means "nothing for you here".

**Citations:** Clark (2013) for prediction match and violation; Nisbett & Wilson (1977) for behavior diverging from stated reasons.

## L4 · Decision architecture

**Constraint.** Make the right choice the easiest. Simplify decision points, not workspaces: experts need dense tools. Show rather
than describe, and match the words to how near the commitment is.

**Violation.** The facts a sweat decides on (recent lines, the opponent, who's on whose team) live on other tabs; the casual
player's tap opens the same full editor. The lock is described three times ("Picks close at airtime · Wed 8:00 PM") rather than
shown once as a state. The dock can't reach a game's page. The reveal's consequence (every game at once) is small print. A failed
read never says so. Meanwhile the deep surfaces, where density is right, spend their first view on titles and chips.

**R5.** Each decision point must offer a one-tap instinct path (a sensible default, the move named with its episode) and, beside it
rather than a tab away, the one comparison a sweat needs. Deep surfaces (the game page, the sheets, Players, stat tables) must be
dense workspaces, reached by tapping the thing on screen and returning to the same place with the same unsaved choice. Urgency is
the real lock, said once as a state, never manufactured.

**Citations:** Hertwig & Erev (2009) for decisions from experience over description; Trope & Liberman (2010) for concrete words at
near commitments.

## R1–R5, together

1. **R1** At most four chunks for the situation now; each fact once; engine state only where it changes the next action.
2. **R2** A recognizable anchor of the show or its people in the first 50 ms, with deliberate forms for no art, 300 athletes, no one
   leaving.
3. **R3** One form and one vocabulary per flavor for each shared part, at every distance; a small type scale, one accent with one
   job.
4. **R4** Meet the prediction of the way in; keep the one attention signal for what's due or new for this person.
5. **R5** A one-tap instinct path with the sweat's comparison beside it; dense workspaces one tap deep, returning to the same place.

Lower layers win conflicts: when an anchor (R2) and the four-chunk limit (R1) compete, the anchor counts as one of the four.

## Per layer: what the first view holds, in the eye's order

| Layer | First view, in the eye's order | Never in the first view | The casual path | The sweat's path |
| --- | --- | --- | --- | --- |
| Hub | 1 Your next thing: one plate with the show's art, its episode and when, or "results waiting". 2 What's due, folded into that plate when it's the same show. 3 Your people: faces with their marks. 4 Your shows (art). A labeled, animated "On TV" entry near the top opens the full guide | A move's details; the lock said twice; the guide's grid squeezed to 390; nudges, couch numbers, Start / Join a couch (except with no couch) | The plate's move opens the move itself: one tap to the editor | A face opens that person; the guide opens as its own place |
| Tonight | 1 The show's art with one progress control: last watched, next, behind, caught up or live. 2 One strip: "2 due for Ep 6" (opens quick moves) or "All set for Ep 6". 3 The couch's faces on one line at their marks. 4 This person's one action: Watch along, I watched it, or Reveal Ep 4 (every game at once) | The move editors (today's carousel); the lock time a second time; a reveal button per game; Start a game | Strip, then the move, then done | Below the first view: last episode's recap, GIFs and talk, each game's mini with contributions, standings |
| Episodes | 1 Your place on the season's line, with the next episode. 2 Episodes, each with faces at each person's mark and your result in a word. 3 One reveal entry when results wait | The same reveal four times; the dock; the spoiler line as a banner | Tap the waiting episode to reveal it | An episode's page: who left, every game's line, top scorers |
| Quick moves (strip, sheet) | The strip: what's due, for which episode, the first lock. The sheet: a tab per game; each move named with its game and episode; a default ready; Save | A second quick-move surface saying the same (the dock beside the strip); moves for games that need nothing | One tap from the strip, one to choose, Save | Each move's header opens its game's page; each candidate shows its recent line |
| Games tab | 1 Each game as one row: its real name, your standing in its own unit (2nd of 4 · 21 pts, or 5–2), its one action named with its episode, and this week's opponent for head to head. 2 Extras (bingo, calls, trivia, polls) as their own group. 3 Start a game last | Every game's full table at once; setting chips; an engine key as a name | The row's action | The row opens the game's page |
| Game page and sheets | 1 This week: you against your opponent with both records, or your place and gap. 2 Your move for the episode, named, one tap, its lock as a state. 3 The season's chart beginning in the first view | A display title filling a quarter of the view; setting chips; the spoiler line as a banner | The move | The matchup sheet, a person's sheet (why the score), the stat table, history: each opened from the thing on screen |
| The reveal | One beat at a time: the show's art and faces, who left, each game's result for you, the table moving (the one big motion), then back where you were | Text-only beats where art exists; every number at once | Tap through, or Skip to results | Each game's beat opens its contribution breakdown and returns to the same beat |
| Players / Cast | 1 One way in: search or the flavor's grouping (tribes for a competition, positions and teams for a sport, characters for a story). 2 The first rows with the show's own facts (out, still in, a stat), not one game's points unless a game is chosen | Three mode buttons, a range slider and a dropdown before the first face; face tiles at sports scale | Scan the faces or search a name | Rank and By episode as sorts of one table; the person's sheet |
| Chat | Which episode's talk, your boundary once, the latest messages, the GIF button and the composer | A second boundary banner | Type or send a GIF | Older threads; the fold opens after you've seen it |
| Notifications | One line: what, what it means for you, by when, no spoiler; the tap lands on that exact thing | Anything mid-episode | Tap and act | |

## Today's app, against R1–R5

| | R1 | R2 | R3 | R4 | R5 |
| --- | --- | --- | --- | --- | --- |
| Hub | fails: seven chunks, the lock twice | passes with art; fails without | fails: the move in two forms in one view | partly: due is first, but yellow is spent | partly: two taps to the editor |
| Tonight | fails: lock three times, a carousel of editors | passes with art | fails: progress in four places | passes for watchers (Up next for you); fails for head to head | passes: the Your moves sheet is a good instinct path |
| Episodes | fails for someone behind (reveal four times) | partly | fails: the reveal in three forms | fails: the signal repeated until it's noise | passes |
| Games tab | fails: every table at once | partly | fails: placing chips repeat the tables | fails: no opponent | passes |
| Game page | fails: title and chips take the first view | fails: a name, not an anchor | fails: the move in a seventh form | fails: who you play is missing | partly: the sweat's facts are a sheet away, which is right |
| Reveal | passes | passes with art; text only without | passes | passes | passes |
| Players | fails: three controls before a face | passes for 18 faces; fails at 49 | fails: whose points? | partly | fails at sports scale |
| Chat | passes | passes | passes | passes | passes |
| A sport, any tab | fails | fails: letter tiles, an engine key | fails: a show's words | fails: kickoffs and opponents missing | fails: tiles don't scale |

## The gap

No surface today, and no proposal reviewed so far, meets R3 across the whole app: one form for each shared part that holds at 18
faces, at 300 athletes and for a story where nobody leaves, at every distance. The person part and the progress control (with
friends' positions on the same scale) carry the most weight. Next is R4's signal discipline app-wide: one accent kept for "due for
you", so its absence means something. Both have to be settled before any single page is drawn, or each page round will invent its
own version and the app will drift back to seven forms.

> *Initial findings. Ralph Loop a requirement, cite further, switch to analyze / evaluate, or ask any follow-up to dig deeper.*

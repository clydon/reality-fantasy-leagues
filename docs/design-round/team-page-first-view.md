# A team's page (sports-couch B2): first-view requirements (Perception-First Design, step 2)

Mode 2 derivation on [team-page-spec.md](team-page-spec.md), once, bottom-up, for a team's page at 390 × 844. The page has no tab
bar, so the first view is everything under the status bar: about 800 px, the page's own bar (about 56 px) included.

## The problem

A fan opens a team to answer one question: is it on (and the score), when do they play next, or how is the season going. Today
the answer sits under a sheet titled "A team", a follow line and eight W/L tiles, and the next game's Play plate lands at the
fold's edge (before frames: the Eagles' plate at 1,817 px of a 2,400 px tall sheet, the Sixers' at 1,410; at 844 it's the last
thing in view or below it). What gets in the way: the team's identity comes second, the game that answers "is it on / when" is
not the first block, the season is shown without magnitude or order, and the schedule is split into three lists.

## The layers

**Foundation, load.** Constraint: working memory holds about four chunks (Cowan 2001), and a first view is judged as a whole before
it's read (the gist: Oliva 2005). Violation: today's first view spends its chunks on a title, a follow sentence, eight tiles and
a live plate before the move; the page's spec adds a season graphic and Start a game on's rows, which would make six.
- **R1. The first view holds four groups, in this order: who (the plate and its line: league, record, place), now (the live or
  next game as one bug), the move (Play the next game), and the season (one graphic with its record in words). Who follows them
  rides inside "who" as one line of faces, not a group of its own. Start a game on and the schedule start below; the schedule's
  head may peek at the fold as the sign there's more.**
- **Citations:** Cowan (2001) for the four-chunk limit; Oliva (2005) for the first view read as a gist before its parts.

**L1, the first glance.** Constraint: a screen is classified in about 50 ms (Lindgaard et al. 2006), by its largest, most
contrasting element; colour that means one thing is found pre-attentively (Treisman & Gelade 1980). Violation: "A TEAM" is the
largest word today; a team's colour spread across tiles, bars and rows would compete with the app's two signal colours (live
red, the chyron's yellow).
- **R2. The team's name is the largest thing and the first (the plate under the bar, its colour only on the plate's tag and the
  marks). The live red appears only on a game that's on (the bug's rule); the one yellow is Play the next game. The season's bars
  use two quiet tones (a win in the app's good green at low strength, a loss in the muted ink), never the team's colour, so the
  colour that's loud on the page is the team's identity and nothing else.**
- **Citations:** Lindgaard et al. (2006) for the 50 ms first impression; Treisman & Gelade (1980) for pop-out by a single feature.

**L2, fluency.** Constraint: a form already learned reads without effort and feels right (Reber & Schwarz 1999; Alter &
Oppenheimer 2009). Fans know a team page's order (name, now, schedule) from every sports app, and this app has taught its own
scorebug on the hub and Scores. Violation: a now block that's a plate of its own (today's "ON NOW · AT JETS · 14–10") and
schedule rows in a third form make the same game look three ways.
- **R3. Now is the shared scorebug, unchanged (two teams named, the status column at the right). The schedule's rows keep the
  bug's grammar: the date at the left, the opponent's mark and "vs/at" name, and the status column at the same right edge and
  width, speaking the same words (a time and network before, the clock and red while on, "W 24–17" after). One row height for
  the whole list. The page's order is the convention's: name, now, season, schedule.**
- **Citations:** Reber & Schwarz (1999) for fluency read as rightness; Alter & Oppenheimer (2009) for learned forms spreading trust.

**L3, what people predict.** Constraint: people act on a model of the page and notice when it breaks (Clark 2013); the system's
state must be visible (Norman 1988). Violation: a page that shows a result to someone hiding scores breaks the app's one promise;
a schedule that opens on September in late November, or that silently leaves the bye out, makes the list lie about "now"; a
season graphic with no line between played and to come can't say where in the season we are.
- **R4. Hide sports scores holds every result before anything draws (while the setting is unknown too): the plate line without
  record or place, the season block as one held row with Show the season, rows "Played". The schedule opens on the current
  month, earlier months folded under a row that says how many games it holds. The season graphic draws every game of the season
  (played as bars, to come as faint ticks) with the bye as a named gap, so its played part ends where today is. A daily sport's
  List · Month shows which is on.**
- **Citations:** Clark (2013) for prediction and its violation; Norman (1988) for visible system state.

**L4, the decision.** Constraint: decision time grows with the options in view (Hick 1952), and a default carries most choices
(Johnson & Goldstein 2003). The page has one move, Play the next game, and a handful of bigger starts. Violation: today the rival
chips sit between Start a game on and the lists, so a filter reads as more starts; with a live game and Play in view, a Play
plate that doesn't name its game reads as playing the game that's on.
- **R5. One yellow, one tap: Play the next game, its line naming that game ("Sun 1:00 PM vs Giants"), so with a game on above it
  there's no doubt which. Start a game on's rows quiet and below the season. The Against filter sits inside the schedule's head
  with All chosen by default; no Play on schedule rows (a row opens its game, as on Scores: decision 2026-11-22).**
- **Citations:** Hick (1952) for decision time growing with choices; Johnson & Goldstein (2003) for defaults carrying the choice.

## What satisfies all five

From the top: the bar (Back, Follow) 56; the plate (48) and its line (league · record · place) 24; who follows them, one line of
faces and words 44; the now bug (80); Play the next game (72, naming its game); the season: the record and streak in words, then
the bars (football's 17 at about 18 px each with 3 px gaps; a daily sport's 82 or 162 as hairlines), about 120 with its labels.
Total about 470 + margins (6 × 16) ≈ 570: the schedule's head and its first month heading peek at about 620–700 (R1's "sign
there's more"), Start a game on just under it or above it (see the gap).

Per situation, the first view:
- **On now** (Andrew): plate · the live bug with the score (red rule) · Play the next game (the one after) · the season.
- **Midweek** (Joanna): plate · the next game's bug (day, time, network, the line) · Play the next game · the season.
- **The sweat** (Conor): the same, plus the place on the plate line; the margins in the bars; the schedule a scroll away.
- **Hidden:** plate (league only) · the bug saying "Started" or the time · Play · one held season row with Show the season.
- **A daily sport:** plate · today's game (or the next) · Play · 82 hairline bars; List · Month at the schedule's head.
- **Off-season:** plate · "Season over · their last game Jan 4" in place of the bug · no Play · last season's bars.
- **Not followed / another's team:** the bar's Follow is outlined; who follows them names the couch member ("Sam follows them").

Must not be in the first view: the rival filter above the season, a second yellow, the team's colour on anything but its plate tag
and marks, a per-row eye, the earlier months' results (the bars tell them).

## The spec's proposals against R1–R5

- A page with the team's name as its plate, the place on its line: passes R2 (the name first and largest) and R1.
- Now as the shared scorebug: passes R3.
- Play under the now bug, the one yellow: passes R5 only if its line names its game (add to the build: today's says "Pick'em ·
  Sun, Nov 29 4:26 PM vs Giants · tells the couch", which does; keep the date words).
- The season as a bar a game by margin, to come as ticks, the bye a gap: passes R4 and gives the sweat's data at a glance; passes R2
  only in two quiet tones.
- Start a game on above the schedule: passes R5 (quiet rows); its place against R1 below.
- The schedule opening on the current month, earlier folded, the Against filter in its head: passes R4 and R5.
- Hide sports scores as one held season row and "Played" rows: passes R4.

## The spec's open choice: the schedule's row

**One-side form.** R3 asks that the schedule speak the bug's grammar, not that it repeat the bug's two team lines: the status
column, its words and its spoiler rule are what a fan has learned, and they carry over. R1's load argues for one side: the page's
team is every row's subject, and a second line naming it on all 17 rows (82, 162) adds 17 identical chunks to scan past and
doubles the list's height, pushing the current month off the screen a scroll sooner. The two-team bug stays where a game is the
subject: the now block. **PFD's verdict: the one-side form, provided its status column is the bug's (same width, same right edge,
same words, same hidden rule).** The choice still goes to the user as the spec says; this is the perceptual side of it.

## The gap

The spec puts **Start a game on above the schedule**, which at 390 lands it in the first view's last 100 px on a quiet day, where
three quiet rows compete with the schedule's head as the "what's next" signal and nudge the season block up against R1's four. Put
Start a game on **under the schedule's current month** (after the games a fan scans for), or keep it above and let the season
graphic end the first view: either passes R1 if, at 844, the first view ends with the season block whole and nothing of Start
cut half-way. Recommended: keep it above the schedule (it's 2.8's approved order: bigger starts beside the one yellow) and check at
the build that the season block ends the first view on the stand-in's gameday and the real NFL page.

A second gap: **a daily sport's 162 bars** are read, not tapped (about 2 px each). The spec says so; the build must not give them
hover or tap affordances that can't be hit (WCAG 2.5.8's 24 px target), and the schedule stays the way into a game.

> *Initial findings. Ralph Loop a requirement, cite further, switch to analyze / evaluate, or ask any follow-up to dig deeper.*

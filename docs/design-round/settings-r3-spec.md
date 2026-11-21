# Settings, Round 3a: running a game (Intent's spec)

> **Status (2026-11-21): Round 3a, step 1 of the design process** (docs/DESIGN-PROCESS.md: Intent, then Perception-First Design,
> then Impeccable). Round 3 is split in two (the main session's call, 2026-11-21, because it holds about 4,000 lines of Backstage
> screens and a new feature): **3a** retires Backstage and gives each game its home; **3b** is changing a game once it's under
> way (A15's safe options, A17's vote, typed undos for the lock, pace, the questions, the freeze and computer players). Each gets
> its own story and pause. 3a carries out the plan's C27, C29–C38, C40–C43, A13, A14 and the part of A16 that already exists
> (Pick for them), on Round 0's decided structure ([settings-r0-spec.md](settings-r0-spec.md), "This game") with Round 0's
> names (Manage this game; Games you run; Helper; Relaxed · Standard · Strict) and Rounds 1–2's grammar.

## The job

**Manage this game** answers "how is this game set up, who's in it, and what does it need from me?" on one page that belongs to
the game. Everything Backstage held about one game moves here: this episode's lock, how it plays (value first, opened in place),
who's playing (roles, remove one person, computer players), the draft's settings, this game's changes, rename, and Stop. A runner
reaches it from the game itself, in one or two taps, wherever they meet the game.

**Games you run** replaces Backstage on the show's ⋯: a sheet listing the games you run on this show (finished and stopped ones
folded, so Bring it back is always reachable), each opening its Manage this game. It's an index, not a place: nothing is set there.

**This season's rules on this couch** is the one short section for what covers every game on the season: the couch's own copy of
the rulebook (the Tinkerer's) and Freeze rules and joining (was Lock it down / Competitive mode, off by default). It sits inside
Manage this game, near the bottom, and says it's shared by every game here.

**A runner's jobs** (the lock on episode night, start the draft, a join request, a waiver window to run) come to the strip like
any other move, and each opens the game at that job. There's no separate home for jobs.

**Results stop being a runner's chore** where the bot settles the season (every season today: the user's rule of 2026-11-20, "let the AI settle so the app runs itself"). The
runner's override, "Fix who went home" and the house rulings, moves to the episode's page, runners only. Who can fill them in,
How results get in, One tap and Autopilot go (C27, C30; they return with the paywall, BACKLOG 113).

## Who comes, and why (the entry points)

| Who | Why they come | Where they start | The fix, and its taps |
| --- | --- | --- | --- |
| **alex**, Commissioner of three games | rename "Lineup League" to "The Tuesday League" | the game | gear › Rename this game › type › Save (3 + typing) |
| **alex** | sam stopped playing Pool Party but still plays the other two | the game | gear › sam › Remove from this game › hold (3 + hold) |
| **alex** | Pool Party is done for the season and clutters the Games tab | the game | gear › Stop this game › Archive (3, Undo) |
| **alex**, a week later | wants Pool Party back | the show | ⋯ › Games you run › Finished › Pool Party › Bring it back (5) |
| **riley**, a Helper on Lineup League | episode night: lock it early because the West Coast airing spoils it | the strip | the strip's "Ep 6's lineups: open" › Lock now (2) |
| **riley** | wonders why she can't change the bench size | the game | gear › Who scores each week reads its value, no chevron; one line says the Commissioner changes the rules (1) |
| **Joanna**, a casual starter with one game | "Waivers? I don't want any of that" | the game | gear › Replacing people who leave › Relaxed (3) |
| **Joanna** | someone asked to join | the strip / a push | the strip's "jordan asked to join" › Let them in (2) |
| **Conor** (tinkers) | wants this couch's Survivor rulebook to score idols differently | the game | gear › This season's rules › Customize the rulebook (3) |
| **Conor** | wants nobody to join late or change rules for the season | the game | gear › This season's rules › Freeze rules and joining (3) |
| **alex**, mid-draft | change the pick timer | the draft room / the game | the room's gear (as today), or gear › The draft › Pick timer (3) |
| **Anyone on the couch** | "who changed the points?" | the show | ⋯ › Recent changes › a line opens the game (3) |

Today's taps for the same jobs: Backstage is ⋯ › Backstage › a page (3) before anything starts, a game's settings 4–5, and rename,
remove-from-one-game and Bring it back (with every game archived) can't be done at all.

## The doors to Manage this game

A runner meets a game in five places. Each gets a door; none is a new destination:
1. **The game's bar:** a gear, for whoever runs it (Commissioner or Helper), left of the ⋯ (as the show's bar since Round 2). A
   player's game bar keeps only the ⋯.
2. **The game's ⋯:** for a runner, "Manage this game" first; How it plays, Your sheet and Leave this game as today.
3. **The game's card on the Games tab:** for a runner, a quiet "Manage" link in the card's foot (not a second button style).
4. **The strip:** a runner's job opens the game's Manage this game at that job (scrolled and opened).
5. **A change line** (Recent changes, the game's own history): opens that game; a runner lands on Manage this game.

The show's ⋯ keeps one row, **Games you run here** ("3 games · 1 needs you"), for the runner who thinks "the show" first. It
replaces the Backstage row and its yellow plate; the plate's urgency moves to the strip, and the ⋯'s dot stays while a job waits.

## Manage this game, in order

Order is by deadline, then by how often people come, then by blast radius (rule 6, 7):

1. **The head:** the game's name (44 px, as a show's settings page), its type and the show; one line for your role: "You run this
   game" (Commissioner) or "You help run this game: the lock, waivers and who's in are yours" (Helper).
2. **Needs you** (only while something does; the same items the strip shows): this episode's lock when it's open on an episode
   night; a join request (Let them in · Not now); start the draft; this week's waiver window (Run now · Pick for them). Each item
   is the job itself, not a link to it.
3. **This episode's lock** (only on games that lock by episode; BACKLOG 157's three states said plainly): "Ep 6's lineups: open ·
   lock automatically Tue 8 PM" with Lock now; once locked, "Locked by you · Open it again"; after a manual change, "Back to
   automatic". Always here on episode-locking games, even when Needs you is empty, because its deadline is the page's.
4. **How it plays** (value first, a tap opens in place; Commissioner changes, Helper reads):
   How moves lock (fixed: says why) · Who scores each week, and the bench · Team size (a real control until the draft, then fixed:
   says why; C40) · The questions · Who can join · How long (reads "Till the merge" for a game that ends at a phase, not "the
   season's end") · **Replacing people who leave** (one control, C32: the preset Relaxed · Standard (Recommended) · Strict, when
   replacements start, the rule, the windows, the swaps; the fallback pick on by default; the read-only timing rows go until 3b
   makes them real; "Every N" windows only with their N) · **Points** (games scored by moments: the list, pushed, as today's
   Change the points). **What players see** (C33) becomes How it plays' last line: "Players read this in the game's How it plays".
5. **Who's playing** (C35): one row a person: name, role (Commissioner · Helper · Player), and their state if it matters ("left
   Nov 3", "computer · Casual"). A person opens a sheet: their role (Commissioner only), **Pick for them** (this week's waiver, as
   today's Pick for them; A16's 166 in its existing form), **Remove from this game** (held; A14: "Their team leaves this game.
   Their other games and the couch stay."). **Computer players** (C36): Add one (before the draft), each one's level, Take it out
   (held). No Invite and no Leave here: they're the couch's and the game's ⋯'s (C35 drops the duplicates).
6. **The draft** (until it's done; C42): when it starts, the pick timer, when time runs out, in the wizard's words; "Open the
   draft room" links there, and the room's gear links back here. After the draft: one line, "Drafted Sun Nov 2", no controls.
7. **This season's rules on this couch** (C34, C37): "Shared by every game on Survivor 51 here." Customize the rulebook (pushed:
   today's Scoring rules page without its per-game points, which moved to 4) · Freeze rules and joining (a switch, off, its
   consequence in one line). A Commissioner of any game here changes it; a Helper reads it.
8. **This game's changes** (C41): its last three lines, then "All changes"; each line with its real Undo where one exists today.
9. **Rename this game** (A13): the name in a field, Save, Undo in the toast and a change line.
10. **Stop this game** (C38): last, after a gap, drawn quiet (Round 2's pick): Archive (it leaves the Games tab; Undo; Bring it back
    from Games you run) or Delete (held, says what's lost, restorable 30 days). One Stop; Backstage's list and its archive go.

A finished game shows 1, 4 (all fixed, saying "finished"), 5 (read only), 8, 9 and 10 with Bring it back in place of Archive.

## The strip's runner jobs

Each job is a move, sorted with the others by deadline, and opens Manage this game at that job:
- **The lock** on an episode night, only on games that lock together: "Ep 6's lineups lock at 8 PM" (Auto), "Locked early by
  riley", "Opened again by alex". Tapping it opens the lock in place (BACKLOG 157).
- **Start the draft** when it's due (today's draft plate, which led to Backstage).
- **A join request:** "jordan asked to join Lineup League · Let them in".
- **A waiver window to run**, only when the game runs windows by hand.
"Remind them" (C31) goes: the hourly reminders already push everyone with an open move. No result jobs on seasons the bot runs.

## Retiring Backstage (C29)

| Today | Goes to |
| --- | --- |
| Backstage home: Needs you, Remind them, six fixed rows | Needs you → the strip and each game's Needs you; Remind → dropped; the rows → each game's Manage |
| Results | Dropped where the bot settles; Fix who went home + house rulings → the episode's page, runners only |
| Waivers: the week's window, Pick for them, Run now, last run's Undo | Needs you on the game (Run now, Pick for them), Who's playing (Pick for them) |
| Waivers' settings sheet | How it plays › Replacing people who leave (merged with the game's line) |
| Scoring rules: the rulebook copy | This season's rules › Customize the rulebook |
| Scoring rules: each game's points | How it plays › Points, on that game |
| Members & roles | Who's playing, per game; roles across games go (set per game) |
| Computer players | Who's playing › Computer players, per game |
| Game settings, the list; Competitive mode; archive/delete | Games you run (the list); This season's rules (Freeze); Stop this game |
| Recent changes | Stays on the show's ⋯ for everyone, renamed "Changes in these games"; each game's own on its page |

Old links (`/show/<id>/backstage[/page]`, pushes, the tour) land on the show with Games you run open, or on the one game when
there's only one; nothing 404s.

## Words (matched to Start a game's; Round 4 sweeps the rest)

| Today, in Backstage | From now on |
| --- | --- |
| Game admin | Helper |
| Ask me first | They ask first |
| Replace right away · Only when short · Wait for a waiver window | Whenever one goes home · When your team is short · In set windows |
| Lowest score first · Picks due 1 day before | Fewest points · Claims close 24 h before |
| Pick timer: Off · 2 min · 60 sec; When the timer runs out: pick from their queue | A clock on each pick: None · 1 min · 2 min; Someone away: use their list |
| Casual · Balanced (Suggested) · Competitive | Relaxed · Standard (Recommended) · Strict |
| Competitive mode · Lock it down · Locked down | Freeze rules and joining |
| Make it ours | Customize the rulebook |
| "Set in the draft room" (team size) | the real control, or "Fixed: the draft is done" |
| "The draft needs its cast · Add it in Backstage" | "The draft needs its cast. It comes in when the show announces it" (the bot adds casts) |

One "Recommended" tag, the same on every control.

## Situations (the story's and the checks')

- **People:** alex (Commissioner of Couch Cup, Lineup League, Pool Party); riley (Helper on Lineup League, a player elsewhere);
  a casual starter with one game (the solo fixture or a new zt_ couch); jordan, a player (to prove nothing runner-only spills).
- **Seasons and moments:** the live ZT Survivor 51 (an episode night with the lock open); a busy season of short games (57
  finished, the many-games rule: fold, hold the height); a game mid-draft; a finished game; every game archived (Bring it back).
- **Shapes:** own pace with exclusive teams (no lock section; How moves lock says own pace); a sport (its words; a lock by the
  day or week); a staged game (How long by phase).

## Interaction and saving (rule 6, as far as 3a reaches)

- Just you / reversible for others: applies at once, toast with Undo, a change line (rename, roles, who can join, the preset).
- Moves standings: not in 3a (points on a running game keep today's behaviour; 3b brings preview, confirm and the vote).
- Hard to undo: Remove from this game, Take out a computer player, Delete: a sentence, hold, restorable where the server already
  restores (30 days for removal and delete).
- Where today's Undo isn't real (the lock, pace, the questions, the freeze, computer players), 3a keeps today's toast and says
  nothing new; 3b makes them real. No new fake Undo.

## Backend 3a calls for

- **Remove one person from one game** (A14): Round 2's leaveGames takes a league; the runner's route takes another person and one
  league (the takeOut it wraps, logged as "alex took sam out of Pool Party").
- **Rename a game** (A13): one route, the Commissioner's, logged, with Undo.
- **Team size before the draft** (C40): the server already takes it; the control writes it.
- **The fallback pick on by default** (C32) for new games; existing games keep their value.
- **Redirects** for the retired Backstage paths.
- **A read of one game's settings** if the page is slow with 57 games (measure first; otherwise later).

## Fixed bugs on the way (the plan's "Noticed" for Round 3)

"Every N" windows with no N; "Set in the draft room"; "Add it in Backstage"; "Till <phase>" reading the season's end; Bring a
game back unreachable with every game archived; Needs you asking for results on bot-run seasons; results captions naming three
fixed games (the page goes).

## Left out, and why

- **A cross-show list of games you run.** Round 0's reasoning holds: each game's doors plus Games you run here cover it.
- **Roles across games in one sheet** (today's Members & roles). Roles are per game now; a Commissioner of three games sets each.
  Fewer surprises (riley helping on one game shouldn't touch the others), at three taps per game for the rare change.
- **3b's parts:** options after the start (A15), the vote (A17, BACKLOG 230–231), typed undos, replacements on by default (164),
  an empty slot filling from the bench (165), making any missing move for someone (166 beyond Pick for them).
- **A18** (hand a seat to someone else): not approved in Round 0.

## Open questions about the flow

- Should Needs you live on Manage this game at all, or only on the strip? (Kept here so a runner who comes in by the gear sees
  the job without hunting; PFD to judge the load.)
- Does a Helper need the gear on the game bar, or only the ⋯ row? (Given here: the gear; their lock and waivers are real jobs.)

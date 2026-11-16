# Notifications, then waivers: page spec (step 8, competition shows first)

Before frames: `.ui-atlas/stories/step8-notify/before/` (census-app.js `--only='bell|waivers|notify'`, on notes-fixture.js's week
of notices) and `.ui-atlas/stories/step8-waivers/before/` (story-waivers.js: waivers-fixture.js's week, open → claimed → ran →
idle, as the owed player, the commissioner and the one who hasn't revealed).

# Part 1: notifications (the push and the bell)

## The job

**The push** is one line that something changed or is due, said for you: what, what it means for you, by when, never a result
you haven't seen; a tap lands on that exact thing (Phase 0's rule). **The bell** is the record of those lines on the hub: what's
new since you last looked first, then the rest of the month, each opening where it's about. It's the one place a person whose
phone doesn't ring still hears everything.

People: Joanna's phone says "Ep 6 pick locks in 2 hours"; she taps, the pick is open, she picks, done (two taps, no hunting).
Andrew ignores pushes and opens the bell on the hub a few days later: three new things, the newest first, the one that needs him
first in its group. Conor wants to know whether the prediction he made paid off: "You got it right (+2)" opens that game's week.

Ways in: the lock screen; the hub's bell (its dot is the only count); a show's ⋯ menu (Notifications, this show's switches);
Settings (Which notifications).

## The push: one grammar for every kind

- **Title: the news for you, in about 32 characters** (a phone cuts it after that), number first when an episode is the subject
  (the user, 2026-11-01): "Ep 6 pick locks in 2 hours", "Ep 5 results are in", "You got Maggie", "riley planned a watch along".
  Never a game's or a league's name first: today four kinds lead with "Lineup League:" or "ZT Survivor 51:" and the phone cuts
  the news off.
- **Body: where, then what to do.** The show (its short name, "ZT Survivor"), then the game when it's about one game, then the
  action or the time: "ZT Survivor · Couch Cup · Forget, and the best one free comes in."
- **The tap lands on the thing**, not near it (table below): a move opens it in Your moves; a prediction opens its game's week; a
  waiver run opens the run.
- **One push per moment per person per show** (as today for results and reminders): three linked games are one notice.
- **A lock is a lock, not an airing.** A reminder names when the move locks ("locks in 2 hours"), which for a game at your own
  pace isn't the airtime; "episode 5 airs in about 2 hours" is the TV guide's news, not the game's.
- **Spoilers:** a name of who went home only when your mark has passed that episode (as today); no score, no place; the bell
  rewords a kept notice through the guard when it's read (as today).
- **Nothing mid-episode** (the live-games room): no push between an episode's start and its end, except one you asked for (a
  watch along starting now).

| Kind | Today (title / body) | Proposed | Lands on (today → proposed) |
| --- | --- | --- | --- |
| Reminder, a day and two hours before (db/reminders.js) | "Lineup League: episode 5 airs in about 2 hours" / "Set your episode 5 lineup (1 empty slot)" | "Ep 5 locks in 2 hours" / "ZT Survivor · Set your lineup (1 empty) · Make your Couch Cup pick" | Tonight → the show with Your moves open (`?moves=`) |
| Remind everyone (remind-moves.js) | "ZT Survivor 51: you still have a move to make" / "alex sent a reminder · …" | "alex: your Ep 6 moves are open" / "ZT Survivor · Make your Couch Cup pick · Set your lineup" | Tonight → Your moves open |
| An aired episode, a move left (db/reminders.js) | "Lineup League: episode 5 has aired" / "… before you watch it" | "Ep 5 aired: set your lineup first" / "ZT Survivor · It locks when you watch" | Your moves open |
| Early results | "Ep 5: Carter Krull went home" (seen) or "Ep 5 results are in" / "ZT Survivor 51 · Final results by noon tomorrow. Waivers process Wed 8:00 PM." | keep the titles; body "ZT Survivor · Final results by noon tomorrow · Waivers close Wed 8 PM" | Tonight (its control has Reveal): keep |
| Final results | "Ep 5 final results are in" / "… See where you stand." | keep | keep |
| Waiver reminder, six hours before | "Claims due at 8:00 PM" / "Couch Cup: you have someone to replace." | seen: "Replace Carter by 8 PM" / "ZT Survivor · Couch Cup · Forget, and the best one free comes in"; not seen: "Ep 5 waivers close at 8 PM" / "ZT Survivor · Couch Cup · Reveal Ep 5 first to claim" | Waivers: keep |
| Waivers ran | "You got Rob" / "Waivers Classic: waivers processed. Free agency is open until…" | "You got Rob" / "ZT Survivor · Couch Cup · Free agency until Thu 8 PM"; not seen: "Couch Cup waivers ran" / "ZT Survivor · Reveal Ep 5 to see every move" | the Waivers page → the run itself (its beats, then the page) |
| A commissioner's window (open, changed, off) | "Waiver window open: …" | "Waivers open: replace Carter" etc., same grammar | keep |
| Draft turn | "You're on the clock" / "It's your turn to draft in Couch Cup." | keep the title (the idiom fans know); body "ZT Survivor · Couch Cup draft · Pick now" | the room: keep |
| New prediction | "New prediction" / "\"Who finds the next idol?\" · Lineup League" | "jordan asks: who finds the next idol?" / "ZT Survivor · Lineup League · Call it before Thu 8 PM" | the Games tab → the game's week (the bet) |
| Prediction graded | "You got it right (+2)" / "\"…\" — you guessed Kyle" | keep | the Games tab → the game's week |
| Poll, watch along, BINGO, someone joined, a game started, join request, let in, ready, flags | as today | keep; each already leads with the person or the news | keep |

## The bell, top to bottom (Alex: a week since he looked, ten notices, a commissioner)

| # | Block | Holds | Opens |
| --- | --- | --- | --- |
| 1 | **The sheet's head** | "Notifications", and "3 new" or "Nothing new" (said once: the empty line below doesn't say it again) | |
| 2 | **New** (only while there's something new) | The notices since you last looked, newest first, grouped by show: a show's header once (its art small, its name), its notices under it, each with a kind icon (results, a move, waivers, the couch, a prediction, a request), the title, the body without the show's name, the time. A request that needs you (a join request) leads its group | each notice: its landing (the table) |
| 3 | **Earlier** | The rest of 30 days, the same grouping, quieter (no new mark at all: the heading says it) | as above |
| 4 | **A reminder, done** | A reminder or a waiver deadline whose move is made or has locked drops out of the list: it was an instruction, and an instruction for a moment that's gone is noise (today "episode 5 airs in about 2 hours" sits there four days later, marked new) | |
| 5 | **The foot**, only while no phone of yours rings | "Notifications are off on this phone · Turn on" | the phone's ask (as the show's sheet does) |
| 6 | **Empty** | "Nothing yet. Results, reminders and what the couch is up to land here." | |

Removed: **the due row** at the top ("2 moves due · your ZT Survivor pick locks Thu 8:00 PM"). The bell lives on the hub, whose
plate says the due move right behind the sheet; the row said it a second time in different words and pushed what's new down
(Phase 0's system map flagged it). **The yellow dot on every new row** (yellow is the move's colour across the app; ten dots in
one view say nothing the heading doesn't). **The show's art on every row** (ten copies of one picture: it's on the group's header
once).

## The drill tree

| Level | Questions brought to it | Holds today | Verdict |
| --- | --- | --- | --- |
| The push | What happened; do I need to act; by when | Titles led by a league's name; "airs" for a lock; a tap that lands near the thing | **Restructure** the words (one grammar) and the landings |
| The bell's dot | Is anything new | A red dot (red is live or out, step 7's rule) | **Repaint**: one meaning, new since you looked, not the live colour |
| The bell | What did I miss | A due row, then a flat list, every row with the same art and a yellow dot; stale reminders kept as new | **Restructure**: New and Earlier, grouped by show, done reminders out, no due row |
| A notice | What's this about | Art, title, body, time | **Repaint**: a kind icon; the show said once by its group |
| A notice's landing | Take me there | Tonight for most; the Games tab for predictions | **Restructure** where it misses (moves, predictions, a run) |
| A show's Notifications (⋯ menu) | Turn this show's off | Its switches, the phone's state | **Keep**: one job, done |
| Settings › Which notifications | What do I hear | Moments, Couch chat's choice | **Keep** (the settings track, step 12); the moments' lines take the new words |

## The five lenses

- **Own pace:** a reminder names your lock (your mark, or the airing for a live game), never the airing for its own sake; an aired
  episode you haven't watched says the move locks when you watch.
- **A shared draft / an exclusive draft:** the draft turn and the waiver run keep their own pushes; "You got Maggie" is exclusive
  only (a shared game has no one to lose to).
- **Stages:** a notice names its game when the show has several; linked games' results are one notice.
- **Spoilers:** as today, worded per reader and reworded on read; a waiver reminder before your reveal never names who to replace.

## Sports (the short check)

A sports game's reminder is its lock at kickoff ("Week 12 locks at 1 PM · Set your lineup (2 empty)"), a slate's at each game's
start. No score is pushed (a sport's score is the guide's and the scoreboard's, behind Hide sports scores; the hub keeps a just
finished game behind a tap). A sports couch's bell groups by the team or league the way a show groups by show.

# Part 2: waivers

## The job

**Waivers** (`/show/<id>/waivers`, pushed over the show) answers: can I bring someone in, who's worth it, and by when; then, once
it runs, what I got and what everyone else did. The move first, the numbers beside the choice, the rules a tap away.

People: Joanna's push says "Replace Carter by 8 PM"; she taps, sees one line and a button, taps it, takes the top of the list,
done (or forgets, and the best one free comes in for her, which the page says). Andrew gets "You got Maggie" and taps to see the
run. Conor compares the free castaways' weeks before claiming, and checks who picks before him.

Ways in: the strip and Your moves ("Replace Carter"); a push; Tonight's "Waivers ran" plate; Episodes' waiver row; the game page.

> **Superseded in part (the user, 2026-11-16, reviewing the story):** no options on the page. An owed spot is a plate with who's
> leaving by face and Swap, opening the picker; Who's free and its one-tap claim are gone. See decisions.md.

## The page, top to bottom (Alex: Carter went home, his to replace, a free swap too)

| # | Block | Holds | Opens |
| --- | --- | --- | --- |
| 1 | **The bar** | Back to the show; "Waivers"; the game's switch only when you play two games with waivers, as one control (today it's twice: the pills and a chip in the bar) | |
| 2 | **The move** | What's yours to do and by when, once: "Replace Carter" and "by Wed 8 PM · in 2 days" (no seconds ticking: a countdown only inside the last hour, in minutes), one primary button ("Choose who comes in"), and the safety net in a line ("Forget, and whoever's free with the most points comes in"). With claims in: "Maggie comes in for Carter · backup Patt", with Change | the picker |
| 3 | **Who's free** (new) | The best five free, ranked by points over the season, each with their weekly points as a small bar row and their tribe; "All 9 free" | a person: step 5's sheet (their weekly graph), Claim at its foot; All: the picker |
| 4 | **Your team** | Each person, season points and the same weekly bars; Carter in his slot with Out · Ep 5; an optional swap as a quiet Swap on each row, only when one's allowed this week ("1 free swap" said once, in the section's head) | a row: their sheet; Swap: the picker for that spot |
| 5 | **Picking order** (exclusive games only) | One row of faces in order, you marked, and its rule in a line ("Highest score picks first · claims stay private until Wed 8 PM") | |
| 6 | **How waivers work here** | as today | its sheet |

Removed: the sticky foot that repeated the move ("Carter's spot is open · Replace by Wed 8:00 PM · Swap"), the title, chip and
row button saying "Replace Carter" four times between them, the three yellows, the seconds-ticking countdown (a casino's urgency,
which the frame rules out), the picking order as a grid of large cards (a third of the screen for a fact read once).

## The page, by situation

| Situation | The move | Below it |
| --- | --- | --- |
| Owed, no claim (Alex) | "Replace Carter · by Wed 8 PM", Choose who comes in, the safety net | Who's free, Your team, Picking order |
| Claims in | "Maggie comes in for Carter · backup Patt · Change"; "Change anything until Wed 8 PM" | as above, the claimed marked in Who's free |
| A swap only (Riley's kind of week, swaps allowed) | "Any swaps? 1 free this week" quiet, no yellow (nothing's owed) | Who's free, Your team with Swap |
| Nothing to do this week | "Nothing to do until after Ep 6" quiet | **Last time** (the last run's moves: what everyone did), Who's free (read only), Picking order |
| Not revealed (Sam) | "Reveal Ep 5 first: who you can replace would give away who went home", Reveal Ep 5 (opens the reveal itself) | nothing else (as today) |
| Ran, free agency open | "You got Maggie for Carter" (good news) or "Kim got Rob first: Maggie came in" | **Free agency**: open spots or a swap left as the move ("5 free until Thu 8 PM · first come") with the list; Everyone's moves; Watch the run again; Past waivers |
| Ran, free agency closed | the result, quiet | Everyone's moves, Past waivers |
| A commissioner | the player's page (their tools are Backstage's, as today) | |
| Shared game (Weekly Lineup) | as above, with no picking order and no "if taken" | |

## The picker (the sheet: "Who comes in for Carter?")

Keep its structure (Ranked by, Show, the episode range, the list, backups) and add each person's weekly bars beside the season
total, so the comparison reads across rows on one scale (data first, side by side); a tap on a face opens their sheet over the
picker and back keeps the choice; the confirm says the move ("Bring in Ori", not "Tap someone").

## The drill tree

| Level | Questions brought to it | Holds today | Verdict |
| --- | --- | --- | --- |
| The page | What's mine to do; by when | The deadline three times, "Replace Carter" four, three yellows, a ticking countdown, a sticky foot repeating the move | **Restructure**: the move once at the top; the foot gone |
| Who's free | Who's worth claiming | Only inside the picker | **New display**: the top five on the page, weekly bars |
| Your team | Who do I have; who's out | Rows with season points, a big Swap on each | **Repaint**: weekly bars; Swap quiet, only when allowed |
| A person | How have they done | Nothing (the rows don't open) | **New**: step 5's sheet, Claim or Swap at its foot |
| The picker | Choose | A ranked list with season totals and a bar | **Restructure** lightly: weekly bars, the face opens the sheet, a confirm that names the move |
| Picking order | Who picks before me | Four to five large cards | **Repaint**: one row of faces and a line |
| A quiet week | Anything happening | "Nothing to do" and the order: an empty page | **Restructure**: Last time (the last run) and Who's free |
| The run (its beats) | What happened | A title card, then each move | **Keep**: the moment, step 4's reveal form |
| A ran week | What did I get; what now | The result, Everyone's moves, Free agency as a link row below them | **Restructure**: free agency is the move while it's open |
| How waivers work here | The rules | The three questions and the When moves happen grid | **Keep** |
| Past waivers | What happened before | A row to the past weeks | **Keep** |

## The five lenses

- **Own pace:** a window waits on your reveal (the gate, as today); its deadline is the game's, said in your zone.
- **A shared draft:** no picking order and no "if taken": everyone can have anyone.
- **An exclusive draft:** the scarcity is the page: the order, who's free, a claim that loses and its backup said plainly.
- **Stages:** the game switch when two games run waivers on the show.
- **Spoilers:** nothing names who left before you've revealed; the run's push names only what you got, and only once you've seen.

## Sports (the short check)

A sport's waivers are a weekly pickup from hundreds of free athletes: Who's free needs a position filter and the sport's own
ranking (step 6's ranked list), the picker is the searchable list of step 5, and the weekly bars are the athlete's stat line by
week. The move and the deadline read the same.

## Open questions

- Who's free on the page: five, or only the picker? It's the sweat's numbers beside the choice (the frame), but it adds a block to
  a page whose first view should be the move: PFD's to place.
- The bell's grouping: by show inside New and Earlier, or by time only? Grouping says the show once (no art ten times), but a
  second level of headings is structure PFD should weigh.

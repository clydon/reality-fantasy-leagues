# Episodes and the reveal: page spec (step 4, competition shows first)

## The job

**Episodes** is the season as a line you're somewhere on: what's out, what you've seen, what's waiting for you, and what's still
to air, each episode one row that opens its page. It answers, in this order: where am I on the season (and who's where), is
anything waiting for me (results in, hidden), and what happened in the ones I've seen (who left, how my games did, what the couch
said). It is the season's index; Tonight is its latest page (the brief: "Tonight is the living detail of the person's latest
episode, closely related to drilling into an episode from Episodes").

**The reveal** is the episode's one showcase: one reveal for every game you play on the show, full screen, "Last time on" the
show, then what happened, who left, each of your games in its own measure, and the table moving (PRODUCT.md principle 13).

**Where you are** is the one place your mark is changed (a show you watch) or read (a show you play: it moves with your reveals).
Data round 3's episode ledger A, the user's pick on 2026-11-15, is its form: the same rows as Episodes, with a boundary.

People: Joanna opens Episodes after a week away to see what she's missed without being spoiled; Andrew taps the one bright thing
(the reveal) and leaves; Conor drills from an episode into a game's week and back.

Ways in ([R4](phase0-first-views.md)): the tab bar inside a show ("what's out, what have I seen"); a push "Ep 5 results are in"
lands on the reveal; Tonight's Last time "Ep N recap" lands on that episode's page; the progress control's mark opens Where you
are; the episode marker on a game page opens that episode's page.

## The shared parts this round decides or uses

- **The progress control, compact** (step 3's spec, "On the other tabs it is the compact bar's line"): your mark and the one
  watching action, no scale: "Through Ep 3 · 2 behind" with **Reveal Ep 4**, "Through Ep 5" with nothing, "Ep 6 · on air now"
  with Watch along. It replaces the spoiler line ("Spoiler-safe · you're up to Ep 3 · Change") and the bar's chip on every tab but
  Tonight, and its mark opens Where you are. Built in this round because Episodes is the first tab after Tonight to need it; it is
  the same component on Games, Cast and Chat (ripple check after).
- **The strip** (step 3): unchanged, under the bar.
- **The episode row** (Phase 0's shared "episode card", at list distance): the number, its face (who left, or the show's art), a
  title line, your result in a word, and the couch's faces at that mark. One component for Episodes and the Where you are ledger.
- **The episode page** is the episode card at full distance; Tonight's Last time is its excerpt (step 3).
- **A game's result** at reveal distance: the game page's This week card (step 2) as one beat, in the game's own measure, never
  summed across games.

## Episodes, top to bottom

| # | Block | Holds | Opens |
| --- | --- | --- | --- |
| 1 | **The show bar, compact** | Back, the show's name and season, the menu; the progress control's line at its foot | Where you are; the reveal; Watch along |
| 2 | **The strip** | as on every tab | Your moves |
| 3 | **Next** (the season's next row, lifted) | "6 · Wed 8:00 PM" (or "on air now", "drops Fri"), and the couch's readiness for it in words ("4 of 4 lineups set · 0 of 4 picked") | Watch along once it's on; nothing before |
| 4 | **Waiting for you** (only when results past your mark are in) | One folded row: "4 and 5 · results in, hidden until you reveal Ep 4", the faces of who's seen them; no second Reveal button (the control holds it) | The reveal of the first one (the same as the control's) |
| 5 | **Seen** (newest first) | Each episode you've seen: its number, who left (face and how), your night in a word ("You +2 in Weekly Lineup", "Your pick survived"), the couch's faces at that mark (yours lifted, "You're here"), a few GIFs. Waiver weeks between the episodes they fall between, as today | The episode's page |
| 6 | **Still to air** | "+ 8 still to air · Episodes 6 to 13" | nothing |
| 7 | Under the list | Who hasn't started; who plays without sharing their place | |

The recaps card and the filmstrip while episodes are being looked up keep their place above the list.

## An episode's page (?page=epN), top to bottom

| # | Block | Holds | Opens |
| --- | --- | --- | --- |
| 1 | **The episode** | Its number and title (once seen), aired date; who left as the OUT plate (the show's own graphic) | A face: the cast sheet |
| 2 | **What happened** | The write-up (Fill in what happened), the challenges and who won them, the vote | |
| 3 | **The couch** | The couch's GIFs for it (yours first, or Add yours) and **Discuss Ep N** (the chat at that episode) | The reactions sheet; the chat |
| 4 | **Your games** | One row per game, in its own measure (Outlast "Lost Carter · 2 of 3 still in"; Weekly Lineup "+1 · Eric +1, Cristian 0"; Survival Pool "Survived · you picked Ori · streak 5"); under Weekly Lineup, its own top scorers, labeled as that game's ("Weekly Lineup's best this episode") | The game's page at that week |
| 5 | **Replay the reveal** | A quiet button: it's a rewatch, so it follows the content rather than leading it | The reveal, replayed (writes nothing) |
| 6 | **Corrections and Something wrong** | as today | as today |

Top scorers move under their game: their points are that game's (the user, 2026-11-15: "a game's scoring lives inside the
game"). The show's own facts (who left, who won what, the vote) stay the page's.

## The reveal, beat by beat

| # | Beat | Holds | When |
| --- | --- | --- | --- |
| 1 | **Last time on** | The show's art full bleed, darkened at the foot; "Last time on ZT Survivor", the episode, and what it covers in one line: "Every game: Outlast · Weekly Lineup · Survival Pool" (the consequence, not small print: Phase 0 R5) | always ("Final scores are in" when it's an early reveal's final) |
| 2 | **In this episode** | The write-up, a sentence at a time | when written up |
| 3 | **What happened** | Challenges and their winners | when recorded |
| 4 | **Who went home** | The vote card(s) with photos, or "Nobody went home" | in a game's reveal always; a watcher's when someone did |
| 5 | **The couch** | The couch's GIFs for it, and Add yours | only when someone on the couch has added one: an empty slide is no beat (the end offers yours) |
| 6 | **One beat per game** | Its result in its own measure, drawn: a lineup's starters as signed bars on one scale (data round 3's ledger: negatives left of zero, zero a dot) and the total; a pool's pick and streak; Outlast's team, still in and out; a sheet's right answers | per game you play, in the couch's order |
| 7 | **The table moving** | The one big motion: the game's standings from before to after, your row lifted, your gap in words | when a game has a table |
| end | **What's next** | Add your GIF (when you haven't), Share your night, Reveal Ep N+1 when it's out, Back to the show | |

Skip goes to the end; tap and swipe as today. A replay writes nothing. A watcher (no games) gets beats 1 to 5 and the end.

**At your own pace** the reveal is the same full screen: the control's Reveal Ep 4 for games at your own pace plays these beats
from what each game's catch-up reveal returns (who left, each game's result), not a sheet. One episode at a time, as the engine
holds it.

## Where you are (the episode ledger)

| Show | Holds | Does |
| --- | --- | --- |
| You watch it | The season's rows grouped **Seen**, **Out, not seen**, **Still to air** (dates on each; titles only on seen ones); your boundary as a line between the groups; tap a row to move it there (a draft until Save); "I'm up to date"; Keep me live | Save says what it does: "Save · through Ep 5"; Undo after |
| You play a game on it | The same rows, the boundary fixed; results-in rows marked; one line: your mark moves as you reveal; **Reveal Ep 4 · every game** | The reveal |

Nothing past your mark is named: an unseen episode's row has its number and date, never its title or who left.

## By situation

| Situation | Control (compact) | Episodes' first view | The reveal |
| --- | --- | --- | --- |
| caught up, results revealed (Alex) | Through Ep 5 | Next 6 · readiness; Seen 5 (Carter out, your nights) | (on its page: Replay) |
| two behind, results in (Sam) | Through Ep 3 · 2 behind · **Reveal Ep 4** | Next 6; Waiting for you: 4 and 5; Seen 3 | beats 1 to 7 for Ep 4, then Reveal Ep 5 |
| early results | Through Ep 4 · **Reveal Ep 5's early results** | Waiting for you: 5 · early results | lineup "so far", final at noon |
| waiting for results (just aired) | Ep 5 just aired · results soon | Next replaced by "5 · aired, results soon" | none |
| watching only, behind (Riley) | Through Ep 3 · **I watched Ep 4** | Out, not seen: 4, 5; Seen 3 | the watcher's beats |
| own pace, two behind (bench) | Through Ep 3 · 2 behind · **Reveal Ep 4** | Waiting for you: 4 and 5 | the same full screen, from the catch-up reveal |
| season over | You finished it | Seen, all of it | |
| a streaming drop | Drops Fri | Still to air: all 8 drop Fri | |

## The drill tree

| Level | Questions brought to it | Holds today | Verdict |
| --- | --- | --- | --- |
| Episodes | Where am I; what's waiting; what did I miss | This week's block, a reveal plate, a spoiler banner, "Every episode" with a Reveal on each hidden row | **Restructure**: the control holds the reveal once; rows grouped Next / Waiting / Seen / To air |
| An episode row | Who left; how did I do; who's seen it | Number, face, one line, the couch's faces | **Keep**: it already answers its three questions; it becomes the shared row the ledger reuses |
| An episode's page | Everything that happened; how each game went | Replay first, OUT, your games, top scorers (a game's points on the show's page), how was it, what happened | **Restructure**: the episode first, the couch, your games with their own scorers, Replay last |
| A game at that week | Why that score | The game page (step 2) | **Keep**: approved |
| A cast member | Their season | The cast sheet | **Keep**: step 5 (Players / Cast) decides it |
| The reveal | What happened to me in every game | Text openers on black, an empty GIF slide, one beat for all other games | **Restructure**: the art opens it, a beat per game drawn as data, the GIF beat only with GIFs |
| Where you are | Where am I; change it | A stepper row (a show you watch), a statement (a show you play) | **New display**: the episode ledger (data round 3 A) |

## Left off, and where each went

- The spoiler line on Episodes ("Spoiler-safe · you're up to Ep 3 · Change"): the compact progress control.
- The bar's chip ("Ep 4 results are in"): the control's line.
- "Episode 6 · This week" with the art: the Next row.
- The reveal plate ("Final results are in · Hidden until you reveal") and each hidden row's Reveal: the control's reveal, and one
  folded Waiting row.
- "A face marks the last episode each person has seen": "You're here" on your row says it.
- Top scorers on the episode's page: under their game.
- "Previously on the couch" on black: "Last time on" over the show's art.
- The empty "Yours goes here" slide: the end's Add your GIF.
- The own-pace result sheet: the full-screen reveal.

## Open questions

- Head to head's beat could show your opponent's lineup beside yours (the matchup, data round 3's B); the reveal's data carries
  only your own lineup today. A server change; listed, not built this round.
- Does Where you are on a show you play need anything besides Reveal (a way to say "I've seen 4 and 5" at once is the behind
  question's Yes on Tonight)?

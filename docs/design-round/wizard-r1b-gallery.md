# Start a game: the gallery of bases (the redo's Round 1b, the user's direction)

The user, 2026-11-17, on Round 1's four directions: "I'll be honest, not of these work. As far as I can see I don't see a simple
way to do head to head or teams or betting. What if we had a large scrollable page of base games, we try our best to think of
every single 'base' (base being what a user would think, not necessarily what our engine considers a base), it'll be displayed as
squares, each one will have a monocolor icon-like depiction of the game (we have a nano banana mcp that can do this later). We can
sort them by what a human would place them in as categories. Then after than main selector is chosen we can drill down different
modifiers."

Frames: `.ui-atlas/stories/wizard-r1/gallery/` (`.impeccable/mocks/wizard-r1/make-gallery.js`); every base is checked on Survivor
51's live page (`bases.js`, with crying added as a season moment for the silly ones). The spec's taxonomy, the moment picker and
the game library (`wizard-r1-spec.md`) carry over; the four directions are set aside.

## The structure

1. **The gallery.** One scrollable page of every base a person would name, as squares (an icon, the name, what the game is in
   everyday words, its length in the square's corner), in nine categories a person would sort them into, after the community's
   games. Category chips in one sideways row (Community first) say what's on the page and jump to it; search finds a base by any
   word ("head to head", "bet", "cries") and takes a description too. The next episode's ready-made game sits above as one line
   with Start (U0's one tap, kept small). Bases a show can't play aren't on its page; bases still to build are dashed squares saying
   "Coming". The page ends with Describe your game.
2. **A base's screen.** What it is in two plain sentences and what everyone does; How long, as a strip of the season; Preview how it
   plays; popular changes as one-tap squares (the pieces the tracker's games use most with it); the changes people reach for (who's
   playing, compete, bets) as rows; More changes for the rest (your team or the questions, scoring, twists, over the season, moves
   lock, the details); the community's games of its kind. The stretch it covers and Start at the foot, with "or ask them first".
3. **A change's drill-down.** The choices as squares again (icon, name, effect); the chosen one white; one that doesn't go with this
   game dashed with why. A choice with its own setting shows it underneath (head to head's playoffs, a bank's size). Back on the
   base, the row reads the change, marked.

A base is an entry point, not a different game: the same piece can be a base and a change. Head to head is a base (Head-to-head
league, Head-to-head picks) and a choice under Compete on any game; teams are a base (Team battle) and a choice under Who's playing;
betting is a base (Betting pool, Prop sheet, Parlay ticket…) and the Bets drill-down on any game of calls.

## Head to head, teams and betting, simply

| | As a base | On any game |
|---|---|---|
| Head to head | Head-to-head league: its square, Start (3 taps) | Compete › Head to head (2 taps from its screen) |
| Teams | Team battle: its square, Start (3) | Who's playing › In two teams (2) |
| Betting | Betting pool: its square, Start (3) | Bets › A bank (2), on a game of calls; side bets on a draft |

## Version 3: the preview, describe, community, plain words, length

The user, 2026-11-17, on version 2: "This feels much much better. I'm sure we can refine it even more too. One thing that would be
super helpful, if possible, is to have a short 'game preview' if possible. Someone might think this is what they want until they jump
into a game, so much time is wasted and a season could possibly be ruined if friends join and they start only to find out the game
doesn't play as they thought it would. Also I might have missed it but still a subtle 'GPT you game, describe the game you want'
(heck, if it's possible for the got to essentially interview you in plain language that'd be huge). And the 'community game
section', which is assume would also have our made for games. We can just pretend the games that were generated are community too.
We want to make sure those base games have descriptions that people who aren't used to the terminology could look at and read. Also
Im not sure how obvious the game length is."

**Preview how it plays** (frames g21 to g25):
- A button on every base's and community game's screen, under How long: four cards, swiped.
  1. Before it starts: who picks, how many, by when, and the rule that surprises people (the same castaway on two teams).
  2. Each episode: what everyone does, what locks and when; side bets in a line.
  3. How points come in: the last episode the viewer has seen, replayed with this game's points on the season's accepted results.
     On Survivor 51, Episode 8 for a team playing Cristian Chavez (10.5: an idol that cancelled votes +5, found an idol +3, got votes
     and survived +2, three more +0.5), Jelly Loblack (7.5) and Sharonda Cox (2.5) makes 20.5; Devin Way and Eric Macksoud sat out
     (3); Kristin Flickinger and Danny Kilby went home (−2 each). Never an episode the viewer hasn't seen. With none seen, or a
     moment research hasn't asked yet (Cries, from Episode 9), it's an example with made-up names.
  4. Who wins and how long: the season strip again, when scores come in (right after each episode, final at noon the next day), and
     until when the rules can change (the game's start). It ends on Start and "or ask them first".
- The cards come from the game's own spec: describeSpec's rules, shortened, and the engine's scoring of the replayed episode, so a
  preview can't promise what the engine won't play.
- What card 3 replays, by kind: a team (drafts), a pick and what became of it (pools), the questions with the episode's answers
  (predictions), a card (bingo), a bet and what it paid (bets).
- **Ask the couch first** (g25), a link under Start: it posts the game to the couch's chat with its plain line, its length and How it
  plays, each viewer's replay from their own last-seen episode. Everyone answers I'm in or Not for me (which asks what they'd
  change); the maker starts it when ready and can change the rules until then. It borrows the poll sheet's rows
  (`src/new/show/polls.tsx`), its answers shown at once.

**Describe your game** (g26, g27):
- The search field takes a sentence ("Find a game, or describe one…"): the closest bases first, then Build it from your words.
  Describe is also the last row of every search and of the gallery.
- Our AI's one turn (about 40 seconds and ten asks a day, as today; leave and it's waiting) says what it heard, what can't count yet
  and the closest that can, and asks only what it couldn't settle, each question with its answers ready.
- Each answer arrives with the change it makes, checked by our engine with the rest, so a tap applies at once; only a typed answer
  asks our AI again. Today a non-default answer goes back to our AI as a typed change (`src/new/couch/start-wizard.tsx` AskResult,
  "Your call"), so the bot's reply needs each option's change beside it.
- The example, "guess who cries the most each episode, finale counts double": a doubled finale is a draft's (`score.times`), not a
  game of guesses', so the interview offers both. Keep it guesses (no double), or a team game scored by crying with the finale ×2;
  each passes our check on Survivor 51 (a game of questions; a team game with "Points in the finale count double").
- It ends on Start, or "Open it to change more" (the game's screen with its changes marked).

**Community games** (g1, g4, g28, g29):
- The gallery's first section holds three community games (most liked) and See all, with a category chip of its own; each base's
  screen ends with the community's games of its kind.
- The list: each row leads with its base and the engine's line for it, then its length, likes, couches and maker; sorted by most
  liked, newest, made by us or shortest.
- A community game's screen: the engine's account (two plain sentences and its rules) first, the maker's words as a quote under it,
  then How long, the preview, Like, Change it first (a base's screen with its changes marked) and Start your own copy (from Episode 9,
  the couch's own from then on).
- Our made-for games are community games marked "Made by us". Their hooks are AI-written and can disagree with their rules: of
  Survivor 51's 22, The Safety Net's says "one life" and "one bad call can end your season", and the game has two lives.
- A couch shares a game from its page once it has started: the rules only, never who played or how they did. The frames' makers,
  likes and couch counts are made up.

**Plain words** (every square; the catalog below):
- Each square's line says what its game is in everyday words; what everyone does is the first line of its screen.
- Each screen opens with two sentences written from the engine's rules for that game on Survivor 51 (`bases.js` WORDS).
- The words avoid draft, lineup, boot, prop, parlay and categories, and say "guess" where the app says "call".
- The categories' lines: "Pick a team of castaways", "One pick each episode", "Guess what happens", "Bet points, never money".

**Length** (g1, g4, g20, g24):
- Each square's corner: its length if started now. "Season"; "1 episode" for the prediction sheet, bingo, live calls and the bot; on
  a sport, "1 game" or "Playoffs".
- A base's screen: How long right under the description, as a strip of the season. The aired run is one block (so a 30-episode
  season fits), then the next episodes with their dates, the rest, and the finale (its date not out yet). The stretch is filled, a
  new draft at the merge is marked on it, and chips change it: Just Episode 9, Till the merge, The rest of the season, Pick episodes.
- A length the game can't take is dashed with the engine's reason, shortened. From Episode 9 on Survivor 51, the Head-to-head league
  can't be just Episode 9 ("too short for 1 round of playoffs") or till the merge ("Playoffs need a set last episode"), and Season
  predictions, The final vote and Seal your winner run to the finale ("It's known at the season's end"). Every other base takes all
  three (`bases.js` lens).
- Start's line names the stretch ("Episode 9 to the finale · picks by Wed 8 PM"); the preview's last card shows the strip again.

**Also in version 3:** the category chips scroll in one row (ten didn't fit in three); Start is full width again, with "or ask them
first" as a link beside the people it tells; the next episode's ready-made game reads "Just Episode 9" (it airs tomorrow, not
tonight).

## Version 4: nothing to replay, a show's own stages, how it runs

The user, 2026-11-17, on version 3: the preview's replay of last week "won't always work, new shows or the first time a show has
been added to the app"; "Remember different shows have different stages, if the stages are know that should be a length option for
both start and ending"; "There may or may not be a 'own pace possible' or 'live only' warning me might want to give if some games
can only be played in a a certain way."

**The preview's card 3, when there's nothing to replay** (g23, g33). Cards 1, 2 and 4 come from the rules and the schedule and
always work. Card 3 picks its episode in this order:
1. the last episode this viewer has seen that has accepted results, on this season;
2. else an episode they've seen from the show's previous season;
3. else an example episode built from the show's own moments and points, with made-up names ("A deckhand", "A stew"), saying it's
   an example. This covers a new show, a show just added whose results aren't in, someone who hasn't watched yet, and a moment
   research hasn't asked yet.

A sport replays the team's last game, unless the viewer hides sports scores. Below Deck 13 is the real case locally: six episodes
out, no accepted results. Its example (a team game scored by its research-answered moments) shows a guest's praise +1, a tip
singled out +1, and $3,000 in tips +1.2 (0.4 for each $1,000, by its rules).

**How long, from the show's own stages** (g4, g20, g30, g31). This replaces version 3's fixed chips.
- The strip draws the season under the rulebook's stages (its phases), each named over its run of episodes, "now" on the current
  one, "no date yet" where research hasn't marked its start.
- Starts lists the episodes still to come (with dates) and each stage still to come ("When Merged starts · no date yet: it waits
  for it"). Ends lists after a listed episode, before each stage still to come, and the finale.
- The chips are the lengths those stages make: Just the next episode, Until a stage, Just a middle stage, From or Just the last
  stage, The rest of the season. Survivor 51: Just Episode 9, Until Merged, From Merged, The rest of the season. Below Deck 13
  (Crew Settles In, Charter Season, Closing Charter): Just Episode 7, Until Charter Season, Just Charter Season, Just Closing
  Charter, The rest of the season. A one-stage show (The Challenge 42, Traitors 5) gets episodes only.
- Each passes our check: on Survivor 51 from or until Merged; on Below Deck 13 until Charter Season, Charter Season only ("from
  when Charter Season starts until Closing Charter starts") and from Closing Charter. A length a game can't take is dashed with the
  engine's reason, as before.

**How it runs** (g4, g20, g30, g31, g32), under How long: two choices, Live ("Locks as each episode airs"; a late watcher's move
stays open until they've seen it or the next episode airs) and Own pace ("Waits for each of you"). When only one works, the other
is dashed with today's reason:
- A game started from an episode that's aired runs only at your own pace (`paceAsked`).
- A game that starts at a stage runs live, for now (`paceAsked`; BACKLOG 67).
- A game in stages runs live, for now (Designs needed 33); task 4's new draft at the merge shows it.
- On an aired season, only the pool and the team games play at your own pace yet (`start-game.ts` PACED: "an episode still to
  air, for now"). The gallery leaves the rest out there, as the own-pace design decided. One reached another way (search, a
  community game, Describe) says "Live only, for now" on its screen and offers the ones that play (g32).

Strict (everything locks at airtime) stays under More changes › Moves lock. The preview's card 2 says the late window as the game
runs it.

## Version 5: the preview on the real screens

The user, 2026-11-17, on version 4: "Could the preview also include what real screen would look like? Interactive maybe?"

**The preview is the practice round, before the game exists** (g34 to g37; a working sample in the story).
- The practice round (`docs/PLAN-practice-round.md`, decided 2026-10-11; `src/lib/tour/practice.ts`): the guided tour on a
  throwaway copy, with the real cast and rules, made-up results under a red MADE-UP RESULTS tag, two practice players with made-up
  names, nothing written to the server. Today it's offered after joining a league, for three game types (lineups, Outlast drafts,
  pools).
- Here it's offered from a base's screen before anything starts, built from the spec on the season as it stands. Each of the four
  steps is the real screen with the tour's spotlight on one thing and one host line:
  1. the draft room, spotlight on your team;
  2. the game page, spotlight on Change your lineup;
  3. the episode airs (lineups lock, a beat, then results are in), and points land on the result sheet;
  4. the season table, spotlight on what decides it (the playoffs line); it ends on Start and "or ask them first".
- Doing is optional: Next always moves on (the tour moves on only when you do the thing), so it's 30 seconds to skim or a few
  minutes to play. A choice made in one step carries to the next: the three you start are the three that score.
- The episode that airs in it follows card 3's order. With an episode the viewer has seen, it's that one with its real results
  (the tag reads "Episode 8 · real results"); otherwise made-up results under the red tag, by the practice round's rule (never the
  real next boot first).
- What it needs: a practice copy built from a spec and a season (today's `buildPracticeState` copies a joined league), and a
  script for every kind of game, made from the spec's moves (pick, draft, lineup, answer, bet, then air, reveal, standings) rather
  than the three written by hand.
- The frames use the app's own renders from earlier rounds (a ZT Survivor 52 test draft; the gameplay bench's made-up show), since
  Round 2 renders it on the game itself. The story's sample plays Survivor 51's real Episode 8 at the season's points: pick three of
  five, play it, see your total against two practice players (Cristian, Jelly and Sharonda or Devin make the best, 20.5).

**Made-up results use the real cast.** Version 4's example used made-up crew; the practice round's rule is the real cast and rules
with made-up results, tagged, so the example card now names Below Deck 13's real crew under the red tag (g33).

## Version 6: when moves lock, for a couch that doesn't all watch live

The user, 2026-11-17, on version 5's reading of their pace note: "not necessarily what I meant, I mean both that and a show that's
airing but people watching at their own pace (couple episodes behind, watches the next day, etc)".

**When moves lock replaces version 4's "How it runs"** (g38 to g40; closed on g4, g8, g20, g29 to g32). It's today's wizard control
(`src/new/couch/start-wizard.tsx` Pace, PACE_WORDS), with its words and defaults, chosen as the game starts and the same for
everyone (docs/PLAN-own-pace-games.md, "Pace is the game's setting"):
- **When you've watched it** (own pace): "However late that is: after the draft, the game waits for each of you." A move stays open
  until you've watched that episode, however far behind. Recommended for a show's game from an episode still to air (the user,
  2026-11-13).
- **When the next one airs** (live): "Or sooner, once you've watched it." A move stays open after an episode airs until you've
  watched it or the next one airs: a day late is fine, two behind isn't. Recommended for a draft where nobody shares a castaway
  (BACKLOG 68: at its own pace it takes nobody new once its draft starts) and for a sport.
- **At airtime** (strict): "Everything locks when the episode starts."

Closed, it's one line with Change. Opened, it shows **where the couch is**: each person's mark on the season, the same marks as
"where everyone is" elsewhere (made up in the frames: sam one behind, riley two). Each choice then says what it means for the people
behind:
- When you've watched it: "sam and riley play Episode 9 when they reach it; nobody sees its results before they've watched."
- When the next one airs: "Fine a day late. riley, 2 behind, has until Episode 10 airs to catch up."
- At airtime: "sam and riley would choose before seeing the episodes before it."

**Where a game syncs at your own pace**, in a dashed note, from the plan's census (words only: nothing stops anyone going on):
- a draft where nobody shares a castaway, or an auction: everyone drafts together; with waivers on, a waiver week waits until
  everyone's watched that episode (g39);
- answers that depend on each other (match the majority, split the pot, only unique answers) and co-op's shared lives: an episode
  settles once everyone has watched it, "Settles when riley reaches Episode 9" (g40).

**Closed, it names someone only when the setting would cost them a move** (the user, 2026-11-17: "I'm happy", on Claude's
recommendation; g41, g42, g4, g30). Otherwise it's one line.

| Setting | Named while closed |
|---|---|
| When you've watched it | Nobody: nobody's cut off |
| When the next one airs | Anyone 2 or more episodes behind (one behind can still catch up before the next airs) |
| At airtime | Anyone not up to date |
| Can't wait for people yet | The person, with the fix that's left: a stage start offers "Start from Episode 9 instead to wait for riley"; a game in stages only warns |

- The fix is one tap, not Change: "Wait for riley" switches to When you've watched it, and the line then carries that choice's
  trade-off ("Nobody can join once the draft starts") and where it syncs ("Syncs at the draft").
- The words: "riley is 2 episodes behind and would miss moves." Within the couch only; the app already shows where everyone is.
- Why: casual players start on the defaults and don't open settings, so what matters has to be visible closed; a line that names
  people every time becomes wallpaper, and the one that matters gets missed; a friend's name lands faster than a rule.

**When only one works**, the other choices say why, in today's words: a game that starts at a stage, or a game in stages, can't
wait for people yet (When the next one airs); a game started from an aired episode is at your own pace only, and on an aired season
only the pool and the team games play at your own pace yet.

## The bases (56 on Survivor 51, 13 on a sport)

**Fantasy leagues** (13) · "Pick a team of castaways"

| Base | Its square | Its screen | Everyone | Length from Episode 9 | On Survivor 51 | From |
|---|---|---|---|---|---|---|
| Fantasy league | Pick 5; choose 3 to play each week | Everyone picks a team of five castaways. Before each episode you choose three to play, and they score for what they do: winning immunity, finding an idol, surviving a vote. | A lineup each episode | Season; any | plays | preset weekly-lineup |
| Head-to-head league | Your team vs a friend's each week | A fantasy league where each episode your team plays one of the couch's, and more points wins the episode. The two with the most wins meet in a final at the end. | A lineup each episode | Season; not just Episode 9 or till the merge | plays | dial: head to head with playoffs |
| Outlast | Pick 3, then cheer for them to last | Take turns picking three castaways, then just watch. Each scores a point for everyone who goes home before them, so the last one standing carries you. | Draft once, then watch | Season; any | plays | preset outlast |
| Best ball | Pick 5; your best 3 count for you | A fantasy league with nothing to do each week. Everyone picks five, and every episode your three best scorers count by themselves. | Draft once, then watch | Season; any | plays | s09 |
| Auction draft | Bid for your team, 100 to spend | Everyone has 100 to bid, in private, on the castaways they want; the highest bid gets each one. Then choose three to play each episode. | Bid once, then watch | Season; any | plays | s03 |
| Salary cap | Buy a team; prices follow form | Every castaway has a price that follows how they're doing, the best costing most. Pick four under a cap of 100; two play each episode. | A lineup each episode | Season; any | plays | s04 |
| Stock market | Buy and sell castaways like shares | Castaways trade like shares, their prices following how they play. Buy and sell after each episode; your cash plus your team's worth is your score. | Trade each week | Season; any | plays | s22 |
| Guillotine | Lowest score each week is out | Take turns picking four castaways. Each episode the lowest score is out and their castaways go back up for grabs; the last one left wins. | A lineup each episode | Season; any | plays | s01 |
| Reverse draft | Points for going home first | Take turns picking three castaways you think go home first. The sooner they're out, the more they score. | Draft once, then watch | Season; any | plays | s07 |
| Out of a hat | Dealt at random; just watch | Everyone is dealt a castaway at random: nothing to pick, nothing to set. Whoever's lasts longest wins. | Nothing to do | Season; any | plays | s38 |
| One from each tribe | One from each tribe, then watch | Take turns picking three castaways, spread across the tribes (Toka and Savu), then just watch. The longer they last, the more they score. | Draft once, then watch | Season; any | plays | s05 |
| Keeper league | Keep some of last season's team | Keep a few from your team in this couch's last season of the show, then pick the rest. For shows whose cast comes back. | A lineup each episode | Season; its stages' own | needs a game on this couch last season | s17 (needs this couch's game last season) |
| One-moment draft | Only one moment scores, like crying | Everyone picks three castaways, but only one moment scores, and you choose it: crying, a confessional, a blindside. The most of it wins. | Draft once, then watch | Season; any | plays | new (a draft scored by one moment) |

**Pools** (6) · "One pick each episode"

| Base | Its square | Its screen | Everyone | Length from Episode 9 | On Survivor 51 | From |
|---|---|---|---|---|---|---|
| Survival pool | Pick 1 who stays, each week | No team. Before each episode, pick one castaway you think stays in. Every right pick adds to your streak; the longest streak wins. | 1 pick an episode | Season; any | plays | preset survival-pool |
| Last one standing | Pick who stays; 2 lives | Before each episode, pick one castaway you think stays in. A wrong pick costs one of your two lives, and you can buy back in once before the merge. | 1 pick an episode | Season; any | plays | s10 |
| No repeats | Pick who stays, never twice | Before each episode, pick one castaway you think stays in, never the same one twice. One wrong pick and you're out; the last one left wins. | 1 pick an episode | Season; any | plays | w047 |
| Weekly picks | Pick 1; get their points | Before each episode, pick one castaway; you get the points they score in it. Pick anyone, even the same one again. | 1 pick an episode | Season; any | plays | base picks |
| Objectives | Pick 3 to hit the week's goals | Each episode comes with five goals, like winning a challenge or finding an idol. Pick three castaways; a point for each goal they hit. | 3 picks an episode | Season; any | plays | p12 |
| Confidence picks | Rank who's going home, surest first | Before each episode, rank everyone by how likely they are to go home, surest first. The higher you ranked whoever goes, the more you score. | A ranking an episode | Season; any | plays | s12 |

**Predictions** (10) · "Guess what happens"

| Base | Its square | Its screen | Everyone | Length from Episode 9 | On Survivor 51 | From |
|---|---|---|---|---|---|---|
| Prediction sheet | 3 guesses before each episode | Before each episode, answer three questions: who goes home, who wins immunity, does anyone find an idol. Points for each right answer. | 3 calls an episode | 1 episode; any | plays | base questions |
| Season predictions | Guess the winner and final three | Before it starts, guess the winner and the final three, then watch it play out. 5 points for the winner, 1 for each finalist. | Once, then watch | Season; not just Episode 9 or till the merge | plays | w070, w066 |
| Boot order | Guess the order they go home | Before it starts, put everyone in the order you think they'll go home. 2 points for each one within two places. | Once, then watch | Season; any | plays | s13 |
| Who does it most? | Who cries most? Or any moment | Pick any moment, even one the show doesn't score, like crying. Guess who does it most by the finale: 5 points if you're right. | 1 call, then watch | Season; any | plays | new (settled by a moment's most) |
| The show's calls | 2 guesses each episode | Before each episode, make two guesses about what happens in it. The couch settles them as you watch; the most right wins. | 2 calls an episode | Season; any | plays | preset weekly-calls |
| Over / under | Over or under a number? | Will a number end up over or under a line? Idols played this season: over or under 6.5. | Once, then watch | Season; any | plays | w073 |
| Who outlasts whom | Pairs: who lasts longer? | Ten pairs of castaways, the same for everyone: guess who lasts longer in each. A point for each one you get. | Once, then watch | Season; any | plays | s46 |
| The final vote | Guess the jury's vote split | Guess how the jury splits its votes at the finale. 5 points for the split exactly. | Once, then watch | Season; not just Episode 9 or till the merge | plays | s47 |
| Title quote | Who says the episode's title? | Every episode is named for something someone says in it. Guess who says it; a point if you're right. | 1 call an episode | Season; any | plays | s28 |
| Seal your winner | Guess the winner; early pays more | Guess who wins whenever you're ready: the earlier you call it, the more it's worth. Everyone right splits the points. | 1 call, change it if you like | Season; not just Episode 9 or till the merge | plays | p13 |

**Betting** (6) · "Bet points, never money"

| Base | Its square | Its screen | Everyone | Length from Episode 9 | On Survivor 51 | From |
|---|---|---|---|---|---|---|
| Betting pool | Bet points on your guesses | Everyone starts with 500 points to bet on three guesses each episode, or on a ticket of them. Right bets win, wrong ones lose. Points, never money. | Bets each episode | Season; any | plays | p26 |
| Prop sheet | A new sheet of bets each week | Each episode brings a sheet of five things to bet on, like who goes home or does anyone go on a journey. Bet from a bank of 500; points, never money. | Bets each episode | Season; any | plays | p10 |
| Parlay ticket | Both guesses right: triple | Guess who goes home and who wins immunity. Get both right and your points triple. | A ticket each episode | Season; any | plays | s15 |
| Split the pot | Everyone right splits 10 points | Each episode, 10 points go to whoever guesses who goes home, split between everyone right: the fewer of you, the more each gets. | 1 call an episode | Season; any | plays | s29 |
| Double or nothing | Bet your points: double or nothing | Guess who goes home and bet any of your points on it. Right, you win as many again; wrong, you lose them. | 1 call an episode | Season; any | plays | s34 |
| Jackpot | Nobody right? It rolls over | Guess who goes home. If nobody's right, the points roll over to the next episode and the pot grows. | 1 call an episode | Season; any | plays | s32 |

**Head to head & teams** (7) · "Who you play against"

| Base | Its square | Its screen | Everyone | Length from Episode 9 | On Survivor 51 | From |
|---|---|---|---|---|---|---|
| Head-to-head league (also above) | Your team vs a friend's each week | A fantasy league where each episode your team plays one of the couch's, and more points wins the episode. The two with the most wins meet in a final at the end. | A lineup each episode | Season; not just Episode 9 or till the merge | plays | dial: head to head with playoffs |
| Head-to-head picks | Your pick vs a friend's each week | Before each episode, pick one castaway you think stays in, and play one of the couch: whoever's pick stays wins the episode. Most wins takes it. | 1 pick an episode | Season; any | plays | p18 |
| Team battle | The couch in two teams | The couch splits into two teams at random. Everyone plays their own fantasy team, and a team's score is its players' average. | A lineup each episode | Season; any | plays | p21 (teams) |
| Race to a target | First to 50 points wins | A fantasy league with a finish line: the first to 50 points wins, and the game ends there. | A lineup each episode | Season; any | plays | s36 (to 50) |
| Together vs the show | Together vs the show; 3 lives | Everyone guesses who goes home, together against the show. You share three lives; an episode nobody gets right costs one. | 1 call an episode | Season; any | plays | dial: co-op |
| Two against one | Three of you: two against one | For a couch of three: each episode two of you team up against the third, taking turns. | A lineup each episode |  | coming (C8) | p29 (C8: not built) |
| Me vs the bot (also above) | Our bot plays as a player | Play any game with our bot as the other player. For when it's just you. | Any game |  | coming (E1) | E1 (the simple bot: not built) |

**Play along** (4) · "While it's on"

| Base | Its square | Its screen | Everyone | Length from Episode 9 | On Survivor 51 | From |
|---|---|---|---|---|---|---|
| Bingo | Tick off moments as they happen | A new bingo card every episode: eight things that might happen. Tick them as they do; three in a row is a line. | A card while you watch | 1 episode; any | plays | preset weekly-bingo |
| Trivia | A quiz on the last episode | A few questions about the episode before, the same for everyone. A point for each right answer. | A quiz an episode | Season; any | plays | dial: trivia |
| Bingo & trivia | A bingo card and a quiz | A bingo card while you watch and a few trivia questions before the next. 5 points a line, 1 a right answer. | A card and a quiz | Season; its stages' own | plays | p1 |
| Live calls | Guess while it's on; early pays | Guess what happens while it's on, as it unfolds. The earlier you call it, the more it pays. | Calls while you watch |  | coming (A15) | s49-s57 (A15: not built) |

**Party games** (7) · "Twists between friends"

| Base | Its square | Its screen | Everyone | Length from Episode 9 | On Survivor 51 | From |
|---|---|---|---|---|---|---|
| One-moment draft (also above) | Only one moment scores, like crying | Everyone picks three castaways, but only one moment scores, and you choose it: crying, a confessional, a blindside. The most of it wins. | Draft once, then watch | Season; any | plays | new (a draft scored by one moment) |
| Who does it most? (also above) | Who cries most? Or any moment | Pick any moment, even one the show doesn't score, like crying. Guess who does it most by the finale: 5 points if you're right. | 1 call, then watch | Season; any | plays | new (settled by a moment's most) |
| Secret Traitors | 2 of you are secret traitors | Take turns picking three castaways, but two of you are secretly Traitors, scoring when the others' castaways go home. Nobody knows who until the end. | Draft once, then watch | Season; any | plays | s24 |
| Rotating host | Take turns setting the questions | Each episode a different one of you picks three moments for everyone to guess on, and plays too. | 3 calls an episode | Season; any | plays | s43 |
| Match the majority | Guess what most of you will say | Guess who goes home, but you score for matching what most of the couch says. Read your friends, not the show. | 1 call an episode | Season; any | plays | s31 |
| Bounty hunters | Vote theirs out, steal their points | Take turns picking three castaways. When one of yours votes out someone else's, you take 2 points from them. | Draft once, then watch | Season; any | plays | s16 |
| Twist of the week | The top scorer picks a twist | A fantasy league where each episode's top scorer picks the next one's twist: double points, or half. | A lineup each episode | Season; any | plays | s40 |

**Just you** (3) · "Alone, or against the bot"

| Base | Its square | Its screen | Everyone | Length from Episode 9 | On Survivor 51 | From |
|---|---|---|---|---|---|---|
| Solo predictions | Just you and your guesses | Just you: guess who goes home each episode and see how you do across the season. | 1 call an episode | Season; any | plays | w013 |
| Beat the bot | Score when the bot is wrong | Guess who goes home. Our bot guesses too; you score when you're right and it's wrong. | 1 call an episode | Season; any | plays | s35 |
| Me vs the bot | Our bot plays as a player | Play any game with our bot as the other player. For when it's just you. | Any game |  | coming (E1) | E1 (the simple bot: not built) |

**Big season games** (4) · "A game that changes shape"

| Base | Its square | Its screen | Everyone | Length from Episode 9 | On Survivor 51 | From |
|---|---|---|---|---|---|---|
| Season of mini-games | A new game every few weeks | A different game for each stretch of the season: bingo, then a draft, then guesses. | Changes as it goes | Season; its stages' own | needs its own setup | dial: a season of mini-games |
| Two halves | One game to the merge, one after | Two games in one: pick a team until the merge, then a new one after it. Win more halves to win. | A new draft at the merge | Season; its stages' own | plays | s39 |
| Redraft on a shake-up | New teams when the show changes | Whenever the show shakes things up (a swap, the merge), everyone picks a new team. Points add up across them all. | A draft at each change | Season; its stages' own | plays | p7 |
| Two shows, one league | One league, two shows | One league across two shows, like Survivor then The Traitors: a team for each, one set of standings. | A draft for each show | Season; its stages' own | needs the second show's season set up | s20 (plays on its page; needs the second season set up as a game) |

**A sport (the 76ers)** (13)

| Base | Its square | Its screen | Everyone | Length | From |
|---|---|---|---|---|---|
| Season league | Players; a lineup each game day | Pick a team of players and choose who plays each game day; each week you play one of the couch. | A lineup each day | Season | basketball.json season |
| Best ball | Players; your best count for you | Pick a team of players once; each week your best ones count by themselves. | Draft once, then watch | Season | basketball.json bestBall |
| Categories league | Win more stats than a friend | Each week you face one of the couch across nine stats (points, rebounds, assists and more). Win more of them to win the week. | A lineup each day | Season | basketball.json categories |
| Roto league | Rank in every stat | Every stat ranks the whole couch; add up your places across them all. | A lineup each day | Season | basketball.json roto |
| Game-night draft | A few players, one game | Pick a few players for one game. Most points that night wins. | Draft once, then watch | 1 game | basketball.json short |
| Pick'em | Pick who wins each game | Pick the winner of each game. Most right picks wins. | 1 pick a game | Season | basketball.json pickem |
| Pick a few | Pick 3 to score most | Pick three players; their points are yours. | 3 picks a game | 1 game | basketball.json pickAFew |
| Game day props | Winner, top scorer, the total | Three guesses before tip-off: who wins, who scores most, and is the total over or under the line. | 3 calls a game | 1 game | w003 |
| Over / under | Over or under the total? | Will the game's total be over or under the line? | 1 call a game | 1 game | w031 (line: game) |
| Playoff bracket | Pick every playoff round | Fill in the playoff bracket; points for each round you get. | Once, then watch | Playoffs | bracket on playoffs (on a playoffs slate) |
| Betting pool | Bet points on the game | Bet from a bank of points on the game's calls. Points, never money. | Bets each game | 1 game | bank + wager (C6) |
| Squares | A grid of the score's last digits | Take squares on a 10-by-10 grid of the scores' last digits. When a quarter ends, the matching square wins. | Take squares once | 1 game | basketball.json squares |
| Live calls | Guess each play as it happens | Guess each play as it happens. | Calls while you watch (coming) | 1 game | s59-s60 (A15, L4: not built) |

On Survivor 51, 50 of the 56 play as checked; 3 are coming (live calls A15, two against one C8, the bot as a player E1); the
keeper league needs this couch's game last season, two shows need the second season set up, and the season of mini-games plays as
the tracker's dial. Every name above is a working label.

## The changes (drill-downs), and where each base shows them

| Row | Its squares | Shown on |
|---|---|---|
| How long | Tonight · The next few · Till the merge · The rest of the season · Pick episodes (like dates) | every base; a season base starts on the rest of the season, a one-night base (prediction sheet, bingo, props) on tonight |
| Who's playing | The couch, each for themselves · In two teams · In three teams · Share a team · Just me · Me and the bot · Newcomers' head start | every base |
| Compete | Most points · Head to head (playoffs) · Most weeks won · Knockouts · Race to a target · Last one standing · Together · Longest streak | every base, a square dashed where it doesn't fit (together is for games of calls) |
| Bets | No bets · Side bets (drafts) · A stake on each call · A bank · Split the pot · Parlay ticket · Jackpot · The couch's odds | every base; points, never money |
| Your team (drafts) | How many · How many play · Same castaway on two teams? · How the draft runs (by turns, in private, out of a hat, bids, prices) · One from each tribe · Replacements · Keepers · A slot for a pair | draft bases, under More changes |
| The questions (games of calls) | Add a question (who goes home, who wins immunity, does it happen, who does it, how many, which episode, the final vote, pairs, title quote, trivia) · A new sheet each episode (the AI's, in turn, a host's) · When each is asked · Points each | question bases, as a headline row |
| Scoring | The show's points · No points lost · Big moments only · Only one moment · Each moment once · Captain · Finale counts double · Reverse · Bounties · Pickups count double | under More changes |
| Twists | Secret Traitors · Rotating host · Twist of the week · Match the majority · Beat the bot · Worth more early | under More changes |
| Over the season | One game · A new draft at the merge · Two halves · Mini-games · A redraft on a shake-up · Then another show | under More changes |
| Moves lock | When you've watched it · When the next one airs · At airtime | under More changes |
| The details | The draft's time and timer, waivers, who can join, starters hidden, ties, quiet nights, what if the show changes | under More changes; also Backstage later |

Every group of the coverage target (`wizard-r1-prep.md` §1) sits under one of these rows, so every value is reachable by taps; the
bases are faster starts to the common combinations.

## Each change's controls (the user, 2026-11-17: "Each modifier can expose ui inputs. Like betting certainly has many possible inputs and controls")

**How a change opens** (frames g12 to g19):
- Choosing a change's square opens its controls under the squares, the chosen square white; Done returns to the base with the row
  reading the change, marked.
- Controls run in the order people change them; the rare ones sit under More options.
- A number offers chips for the common values plus Other…, a number entry held to the engine's range and saying it.
- A two- or three-way choice is a segmented control whose words carry the consequence ("You're out", "Wrong bets, shared").
- A small whole number is a stepper held to its range; which-ones are a checklist; a genuine on-or-off is a switch.
- Where numbers meet (a bet, a ticket, lives and buybacks, a replacement's worth, a multiplier), an example card works them through
  with the settings as they stand.
- Every control starts on its default (the engine's or ours), so nothing has to be touched to start.

**Every change's inputs**, each held to the engine's own limits (`GAME-PIECES.md` "Size limits", the schema's values):

| Change | Inputs (range; default) |
|---|---|
| Bets › A bank | starts with (1 to 10,000; 100) · a call can take (any of your bank, or up to a number) · a right bet pays (even money, or the couch's odds; even) · calls you can bet on (any one-answer call; all) · at zero (keep playing, or you're out; keep playing) |
| Bets › A ticket | calls at least and at most (2 to 6, within the calls it's built from; 2 to all) · pays for each size (more than 0 to 1,000, never less for more; 3, 7, 15, 31, 63) · the bet (any of your bank, or up to a number) · built from (two or more one-answer calls) |
| Bets › A fixed parlay | its calls (2 to 4, asked the same way) · times (more than 1 to 10; 3) · up to 6 parlays |
| Bets › Up to a number a call | the most (chips and Other) · pays (even, or the couch's odds) |
| Bets › Side bets (a draft's) | on or off (on) · worth (1 to 3; 1) |
| A question's own pay | shared (everyone right, a pot split between them, or only a lone right one; pot 0 to 100) · rolls over (off) · worth less the later you call (its start, less each episode or each change) |
| Compete › Head to head | playoffs (none, or the top 2 to 8) · an odd number of you (the middle score, or a bye; the middle score) · a night nobody scores (skipped, or a tie; skipped) |
| Compete › Most weeks won | a tied week (each wins it, they share it, or nobody; each) |
| Compete › Knockouts | when (every 1 to 10 episodes, after an episode, or when a phase starts) · how many go (1 to 20, or half; 1) · a tie at the line (nobody tied goes, or all do; nobody) · a night nobody goes home (cut anyway, or skipped; cut) · up to 4 cuts · one left (it ends, or plays on) |
| Compete › Race to a target | the target (1 to 1,000) |
| Compete › Last one standing | lives (1 to 5) · wrong picks forgiven (0 to 3) · buybacks (1 to 3; until an episode, a phase or any time; cost 0 to 20) · everyone left out on one night (all out on points, share the win, or all back in) |
| Compete › Together | lives (1 to 5) · a night is saved by (one of you, most, or all; one) |
| Compete › Longest streak | picks repeat (after everyone's been used, never, or freely) · nobody left to pick (a miss, or skipped) · a second pick on a double boot (counts, or void) |
| Who's playing › Teams | how many (2 to 6; 2) · made (drawn, or chosen; drawn) · a team's points (average, or added up; average) · a late joiner (the smaller team, or none) · names (24 letters) |
| Who's playing › Share a team | up to 2 to 4 people a team |
| Who's playing › Newcomers' head start | points an episode (1 to 50) · new to (this couch, or this show) |
| Who's playing › Who can join | open, ask, or locked · nobody new and no rule changes after the start |
| Who's playing › Me and the bot | bots (1 to 3) · picks (at random, or by the points so far) (E1) |
| Your team | drafts (1 to 10 by lasting; up to 14 with a bench) · starts (1 to 8), or the best count, or all · the same castaway on two teams (yes in private, or no by turns: counted against the pool) · the draft (in private, by turns, out of a hat, or bids from a budget of 1 to 1,000, the lowest bid, a short team filled or left short) · prices (a cap's total, floor and ceiling; someone gone counts nothing or their last price) · buying and selling (a fee; money left as cash or lost) · one from each (tribe, or a cast property: department, gender) · replacements (never, always, when short, or in windows; from anyone or only free ones; worth full, or a list of up to 6 factors per team or per spot, then repeat or keep halving) · keepers (how many; costing a place, a round or their price; nobody named: their best or none) · a slot for a pair or team (1 or 2; shared or yours; can change; unsure: void, follow, or the next stage; average or added) · when (a time, or whenever before the lock) · the clock (none, 60 seconds, 2 minutes) · someone away (wait, or their queue) |
| Scoring | start from (the show's, no points lost, big moments only, only some) · each moment's points (a stepper; off) · only these count (1 to 40) · each moment once (every time, once a pick, once an objective) · captain (more than 1 to 10; 2) · points multiply (an episode, a run, a phase or the finale; 0.5 to 10; up to 8) · reverse (by lasting) · how they joined (drafted, a pickup, a replacement, a swap: a factor each) · bounties (0.5 to 10 in halves, on vote-outs) · secret roles (1 to 5 of you; 0.5 to 10; on any exit or a vote; revealed at the end or after an episode; they see each other or not; the role's name) · twist of the week (2 to 5 twists, each a factor or one moment; chosen by the top or bottom scorer, by the episode or the standings; a tie; closes 0 to 48 hours before; nobody chooses: none or a twist) |
| The questions › a question | answered (one, pick 1 to 10, yes or no, a number, over or under a line, a choice of 2 to 12, an order of 2 to 24 within 0 to 5, a ranking of 2 to 24, chips 2 to 100, a vote split, pairs 1 to 12) · asked (once, each episode, every 2 to 10, each phase; over the next 2 to 10; open until the finale) · worth (0 to 100) · shared · rolls over · worth less later · a bet · against the bot (a night it made no call: plays or void) · match the majority (or the fewest; a tie: nobody or all) · groups unsure (void, follow, or the next stage) · up to 12 questions |
| The questions › a new sheet each episode | lines (1 to 12, from 1 to 40 moments) · drawn (in turn, the AI's pick, or a host's: their deadline 1 to 48 hours before, the host answering too or not) · not ready in time (in turn, or no sheet that episode) |
| How long | tonight, the next 2 to 5, till a phase, from a phase, the rest, or picked episodes (like dates, stages as bands) · the premiere (left out, or included) |
| Over the season | stages (2 to 6, each a base with its own changes) · a stage starts at (an episode, a phase, or a format change: teams or pairs formed, a split, the merge, a swap, a newcomer, a new phase, everyone swapped; each time, up to 12) · beside the game (at the same time, or a side game while a pair holds 1 to 6 episodes) · on another show's season · the overall (points, a places table of up to 12, or stages won) · a change taken (by itself with Undo, on the maker's OK, or by vote) · nobody answered (start, or carry on) |
| Moves lock | when you've watched it, when the next one airs, or at airtime (a sport: by the day, the week, or each game) |
| The details | waivers (casual, balanced or competitive; replace always, when short, in windows or never; windows every episode, every few or by hand, with swaps or not; order rolling, least points or most; 12, 24 or 48 hours before; free agency; auto-fill; from a phase) · starters hidden until the lock |

This table is the start of Round 2's coverage table: each value above gets its path (the base, the row, the control) there.

## The eleven tasks

| # | Task | Gallery | A | B | C | D | Today |
|---|---|---|---|---|---|---|---|
| 1 | Quick, tonight | 2 (tonight's line) | 2 | 2 | 2 | 2 | 2 |
| 2 | Outlast, the season | 3 (its square, Start) | 4 | 6 | 5 | 5 | 5, shared only; gone on the real S51 |
| 3 | Easy for Joanna | 3 (Out of a hat: nothing to do) | 7 | 8 | 5 | 6 | 4 |
| 4 | Lineup + captain + redraft + side bets | 5 (Fantasy league, Captain, New draft at the merge, Start; side bets on) | 8 | 10 | 7 | 7 | no |
| 5 | Just me vs the bot | 3 (Me vs the bot: E1) | 5 | 4 | 5 | 4 | no |
| 6 | 76ers: winner, top scorer, total | 4 (Game day props, Sat vs Bucks, Start) | 9 | 8 | 7 | 5 | no |
| 7 | Nine lines, a bank of 200 | 7 (Prop sheet, 9 lines, a bank of 200) | 12 | 10 | 11 | 7 | AI only |
| 8 | Below Deck: fired, hookup | 8 + typing (Prediction sheet, the questions, fired, typed, Add, Done) | 8 | 7 | 8 | 6 | AI only |
| 9 | Live call's place | 2 (the Play along chip) | 3 | 2 | 2 | 3 | no |
| 10 | Again next episode | 2 | 2 | 2 | 2 | 2 | 2 |
| 11a | Who cries most | 5 (Who does it most?, the moment, Cries, Start) | 6 | 6 | 6 | 6 | AI only |
| 11b | The Cry Draft | 5 (One-moment draft, the moment, Cries, Start) | 6 | 6 | 7 | 6 | AI only |
| | **All eleven** | **49** | 72 | 71 | 67 | 59 | 3 by taps |

Task 3 can also be Outlast drafted in private (6 taps); the square's plain line ("Dealt at random; just watch") is what makes Out of
a hat findable for it. Version 3 changes no task's taps: the preview and Ask the couch first are optional, a tap each.

## Calls made here (the user's to change)

- The next episode's ready-made game kept as one line above the gallery (U0's one tap); it can go.
- Nine categories and their names; a base listed in two where a person would look in both (Head-to-head league under Fantasy and
  Head to head; the one-moment draft and Who does it most? under Party too).
- Each square says what its game is in everyday words and its length in the corner; what everyone does is the first line of its
  screen (version 2's squares said what each asks of everyone).
- "Guess" in Start a game's words, where the app says "call".
- Popular changes on a base's screen come from what the tracker's games use most with that base.
- Made-for games are community games marked "Made by us": first in the gallery, and on their base's screen among the community's
  games of its kind.
- The preview is four cards, its third replaying the last episode the viewer has seen; Ask the couch first is a link under Start.
- Describe is the search field and the last row, not a button of its own.
- The category chips scroll in one row.
- The drill-downs are squares like the gallery, not lists.
- Icons are one placeholder per category until each base gets its own (the nano-banana MCP).

## Open questions

- Which names should the bases carry ("Outlast" or "Draft & watch"; "Survival pool" or "Survivor pool")?
- Should the categories' order follow the season (one-night games first mid-season), or stay fixed?
- Is "Popular changes" right, or should the four headline rows be the only shortcut?
- Is four cards the right length for the preview, and should a friend's first visit to a started game open it once by itself?
- Who can share a community game (any couch, once it has started, rules only?), and does most liked lead, or made for this show?
- Should our AI's reply carry each answer's change (so the interview's taps apply at once), or should a non-default answer keep going
  back to our AI?
- "Guess" or "call" across Start a game?
- Stage names come from research and can read oddly ("Merged"): should a stage carry a short name for its start ("the merge")?
- On an aired season, should games that can't play at your own pace stay off the gallery, or show dashed with why?
- Should the real screens be the preview, or come after the quick cards as "Try it on the real screens"?

# Start a game, the gallery: page spec (the redo's Round 2)

## The job

**Start a game** turns "let's make a game of this" into a game the couch can play: a game found by what a person would call it,
changed by taps into exactly what they want, seen working before anyone commits, then started. Every game the engine makes is
reachable this way: every value of its 71 settings, every number it holds to, and every one of the tracker's 239 requests that
play (the coverage table: [wizard-r2-coverage.md](wizard-r2-coverage.md); 228 of them within 6 taps of the gallery, median 2).
Describe your game (our AI) and a ready-made game are shortcuts to the same screens, never the only way to a piece.

The order of its answers: what game is this, and what does everyone do; how long does it run; when do moves lock for someone
behind; how does it play (the preview); then everything else a game can be; then Start.

## Ways in

| Way in | Opens on |
|---|---|
| A show's Games tab, Start a game (the most common) | the gallery for that show and season |
| The hub's Start a game | which show (the couch's shows, the next to air first; skipped with one), then its gallery |
| A team's sheet | the sport's gallery, the team's next game as its length |
| Run it back, on a finished game | that game's base screen on the next season, its changes marked |
| Again, on a finished short game | that game's base screen on the next episode |
| A season that's finished airing | the gallery at your own pace, from where you are |
| A community game, shared | its screen |
| The tour's practice | the gallery with the Practice strip; Start ends in the practice finish |

## 1. The gallery

**Its job:** every base game a person would name, found by looking or by a word, with nothing to set before a game is chosen.

**First view, in order:**
1. The sheet's head: Start a game, the show and couch ("Survivor 51 · ZT Survivor 51").
2. Find a game, or describe one: one field.
3. The next episode's ready-made game, one line with Start ("Just Episode 9 · The Tribal Forecast · Start"): U0's one tap.
4. The category chips, one sideways row: Community, Fantasy, Pools, Predictions, Betting, Head to head, Play along, Party, Just
   you, Big season. Each jumps to its section.
5. Community games, collapsed: one row, "22 made for Survivor 51, and couches' favourites". Opened in place: made for this season
   first, then couches' most liked; each with its length badge (1 episode, a stage by name, Season); See all.
6. The first category, Fantasy leagues ("Pick a team of castaways"), its squares two across.

**Deeper on the page:** the other eight categories, each a heading with its plain line and its squares; then Describe your game and
Surprise me as the gallery's last two rows.

**A square:** an icon, the base's known name (Outlast, Best ball, Survival pool), its plain line ("Pick 3, then cheer for them to
last"), and its length in the corner ("Season", "1 episode"). A base listed in two categories is the same square in both. A base
still to build is dashed and reads "Coming" (Live calls, Two against one, Me vs the bot). A base that needs setup elsewhere is
dashed with what it needs (Keeper league: "Needs a game on this couch last season").

**Search:** finds a base by any word in its name, line or screen ("head to head", "bet", "cries", "draft and watch"). A sentence
finds the closest bases first, then offers Build it from your words (our AI). Nothing found: the closest category and Describe.

**Returns:** a square opens its base's screen; Back returns to the gallery at the same scroll and chip. Closing the sheet keeps
the game being made for the session ("Continue: Fantasy league, with a captain").

**On a season that's finished airing:** the whole gallery, every game at your own pace (the user, 2026-11-17: open it up). A
square that can't yet play at your own pace there is built before it's offered to people; in Round 2's frames it is shown as
offered, and the engine step that opens it is in the plan (every kind's catch-up loop, `paceOf`).

**Verdict against today:** restructure. Today's first view is a settings panel (17 to 20 controls before a game is chosen); the
gallery's first view holds one field, one ready game and the start of the bases.

## 2. A base's screen

**Its job:** this game, in plain words, with its length and how it plays, and every change it can take.

**First view, in order:**
1. The base's name, its two plain sentences, and what everyone does ("A lineup each episode").
2. How long: the season as a strip under its own stages, with its starts and ends (section 4).
3. When moves lock: one closed line (section 5).
4. Preview how it plays (section 6).

**Deeper, in order:**
5. Popular changes: one-tap squares, the changes the tracker's games use most with this base (Fantasy league: a captain, head to
   head, a new draft at the merge).
6. The headline rows: Who's playing, How you win, Bets; for a game of questions or a card, its own row leads them (The questions,
   Your card). Each row reads what's on ("Head to head · the top 2 meet in a final") or its default ("Everyone for themselves").
7. More changes: Your team (or Your pick), Scoring, Twists, Over the season, The details.
8. The community's games of its kind (Fantasy league: The Deep Bench, Race to Sole Survivor).
9. The Start bar, fixed at the foot: the stretch and first lock ("Episode 9 to the finale · picks by Wed 8 PM"), Start, and "or ask
   them first" beside who Start tells.

**Every change is said where it lands:** the row that changed is marked ("Changed"), with Undo on it. A change that can't go with
this game is shown dashed with the engine's reason, never hidden, never switched to silently (picks only flow down).

**Returns:** a row opens its change (section 3); Done returns here, scrolled to that row, the row marked.

**Verdict against today:** restructure. Today's white card with its three steps and four quick changes becomes this screen: the
same engine underneath (rolled, checked and worded on the phone), every piece now behind a named row.

## 3. A change: its squares and controls

**Its job:** the row's choices, each saying what it does, and the chosen one's settings.

**First view:** the row's name; its choices as squares (an icon, the name, its effect in a line), the chosen one white; one that
doesn't go with this game dashed with the engine's reason ("Head to head needs 2 or more of you"). Under the chosen square, its
controls on their defaults, in the order people change them; the rare ones under More options. Done.

**Controls:** chips with Other… for numbers (the entry held to the engine's range and saying it: "1 to 1,000"), segmented
choices whose words carry the consequence ("Drafted in private; anyone can join later"), steppers for small whole numbers,
checklists for which-ones, a switch only for a true on-or-off. Where numbers meet (a bet, a ticket, lives and buybacks, a
multiplier), an example card works them through with the settings as they stand.

**Returns:** Done, or Back, returns to the base's screen with the row marked. A change made and taken back leaves the row as it
was, unmarked.

**Verdict against today:** new screen. Today's step screens (Before, Each episode, To win) hold a few chips each; most of the
engine's values had no control.

## 4. How long

**Its job:** the game's stretch of the season, seen as the season, chosen by the show's own stages or by episodes.

**Closed (on the base's screen):** the strip: the aired run as one block ("Ep 1–8 aired", so a 30-episode season fits at 390), then
the next episodes with their air dates, the rest, the finale ("date not out"), each stage named over its run with "now" on the
current one. The game's stretch is filled; a new draft at a stage is marked on it. Under it, the chips the stages make: Just
Episode 9 · Till the merge · From the merge · The rest of the season · Pick episodes. The chosen chip is white.

**A stage's name** is its short start name, from research ("the merge"; "charter season"), editable on the desk; a stage without
one reads its own name. A stage whose start research hasn't dated says "no date yet: it waits for it".

**Opened (Pick episodes):** Starts and Ends: each lists the episodes still to come with their dates and each stage still to come;
Ends adds "the finale". The premiere is left out of the whole season unless Include the premiere is on (before Episode 2 airs).

**A length the game can't take** is dashed with the engine's reason, shortened ("Too short for a final", "Known at the season's
end"). The default follows the season: the whole season until Episode 2 has aired, then the next episode for a one-night base and
the rest of the season for a season base. A season nobody knows the length of runs "to the end", never to its last listed
episode.

**Verdict against today:** new display. Today's When it runs (Tonight · The season · Custom) becomes the strip and the chips the
show's own stages make.

## 5. When moves lock

**Its job:** the game's one rule for anyone who watches late, chosen as the game starts, and who on this couch it would cost.

**Closed:** one line, "When you've watched it · Change". It names someone only when the setting would cost them a move ("riley is 2
episodes behind and would miss moves"), with the fix as one tap ("Wait for riley"). When you've watched it names nobody: nobody's
cut off.

**Opened:** today's three choices and words (When you've watched it, recommended for a show's game; When the next one airs,
recommended for a draft where nobody shares a castaway and for a sport; At airtime), under where the couch is: each person's mark
on the season (the same marks as "where everyone is"). Each choice says what it means for the people behind ("sam and riley play
Episode 9 when they reach it"). Where a game syncs at your own pace is said in a line: a draft where nobody shares a castaway, or
an auction, syncs at its draft (and at waivers when they're on); answers that depend on each other settle once everyone has
watched.

**A choice that can't be had** says why in today's words: a game that starts at a stage, or a game in stages, can't wait for
people yet; a game from an aired episode is at your own pace only.

**A sport:** the same row reads the sport's locks: at each game's start, by the day, by the week.

**Verdict against today:** keep the control, its words and its defaults (the user, 2026-11-17); restructure its closed state;
new display for where the couch is.

## 6. Preview how it plays: the real screens

**Its job:** let the starter (and later each friend) use the game before it exists, so nobody finds out in week three that it
plays differently than they thought (the user, 2026-11-17). The preview is the real screens (the user, Round 2), not cards about
them.

**What it is:** the practice round before the game exists: a throwaway copy of this game, built from its spec on the season as it
stands, with the real cast and rules and two practice players; nothing is saved and nobody is told. Four steps, each the real
screen with a spotlight on one thing and one host line:
1. **Before it starts:** the draft room, spotlight on your team (a pick's game: the pick sheet; a game of questions: the answer
   sheet; a card: the card).
2. **Each episode:** the game page, spotlight on what you do each week (Change your lineup, Your pick, Your answers).
3. **An episode airs:** moves lock, a beat, then results; points land on the result sheet. The episode is the last one this viewer
   has seen with accepted results, played with its real results ("Episode 8 · real results"); with none, the real cast with
   made-up results under the red MADE-UP RESULTS tag, never the real next boot first.
4. **Who wins:** the season table, spotlight on what decides it (the final's line, the lives, the streak); then Start and "or
   ask them first".

**Doing is optional:** Next is always there, so it's thirty seconds to skim or a few minutes to play; a choice made in one step
carries to the next (the three you start are the three that score). Exit returns to the base's screen unchanged.

**For friends:** a game someone started, and the Ask the couch first post, offer "How it plays · Try it" as their first row; it
never opens by itself (the user, Round 2).

**Each kind's steps come from its spec's moves:** draft, pick, lineup, answer, bet, then air, reveal, standings. A move the game
page can't play yet (Designs needed 24, 27, 30, 26) is built before its game reaches people.

**Verdict against today:** new screen. Today's How it plays is a list of rules (RulesScreen); every rule stays reachable from the
preview's last step and from the base's screen as Every rule.

## 7. Ask the couch first

**Its job:** let the people who'll play see the game, try it and say they're in before anything is set.

**What it does:** posts the game to the couch's chat: its name, its plain line, its length and "How it plays · Try it" (each
friend's practice on their own last-seen episode). Everyone answers I'm in or Not for me (which asks what they'd change); the
answers show at once. The starter starts it when ready, and can change the rules until then. It borrows the poll sheet's rows
(`src/new/show/polls.tsx`).

**Returns:** the base's screen, with "Asked the couch · 2 in" on the Start bar.

**Verdict against today:** new.

## 8. Describe your game

**Its job:** a game in someone's own words, for whoever would rather type, in one turn of our AI.

**Where it is:** the search field takes a sentence ("Find a game, or describe one…"): the closest bases first, then Build it from
your words. Describe your game is also the gallery's last row and every search's last row.

**The wait:** our AI's one turn, about 40 seconds and ten asks a day (as today), says its time with Keep looking; leave and it's
waiting when you're back (a See it toast). Its errors say what happened and what still works: the bot's away ("Our AI is away:
everything here works by tapping"), today's ten asks are used ("Back tomorrow at 7 AM"), nothing it heard can be a game (the
closest bases instead).

**The result:** what it heard, in its words, marked as theirs; what can't count yet and the closest that can; then only the
questions it couldn't settle, each with answers ready. **Each answer carries the change it makes** (a change and its settings,
checked by our engine), so a tap applies at once; only typing your own answer asks our AI again (the user, Round 2). It ends on
Start, or "Open it to change more" (the base's screen with what it set marked as ours).

**Verdict against today:** restructure. Today's Describe is its own screen behind a button, and a different answer is another ask.

## 9. Community games

**Its job:** ready games other couches played and liked, and ours made for this season, started as your own copy.

**In the gallery:** a collapsed section first (section 1); made for this season first, then couches' most liked.

**The list (See all):** each row leads with its base and the engine's own line for it, then its length badge (1 episode, a stage by
name, Season), likes, couches and maker ("Made by us" for ours); sort by Made for this season, Most liked, Newest, Shortest.

**A community game's screen:** the engine's account first (its base and its rules in plain words), the maker's words under it as a
quote (a made-for game's hook can disagree with its rules: The Safety Net says one life, the game has two), How long, Preview
how it plays, Like, Change it first (a base's screen with its changes marked) and Start your own copy (from the next episode, the
couch's own from then on).

**Sharing:** any couch, once its game has started, from the game's page: the rules only, never who played or how they did (the
user, Round 2).

**Verdict against today:** new (today's made-for rail becomes Made by us inside it).

## 10. Start

**Its job:** start it, say who's told, and undo for a moment.

**The Start bar:** the stretch and the first lock in the game's words ("Episode 9 to the finale · picks by Wed 8 PM"), Start, and
"or ask them first" beside who Start tells ("Tells 3 who watch it"). Start holds Tell the couch for a 10-second Undo; the
footer's words say what happens next ("Next: everyone picks 3, before Wed 8 PM").

**In Round 2's build:** the switch's Start saves nothing: it shows the spec our check passed and what Start would do.

**Verdict against today:** keep, with the stretch named.

## By situation

| Situation | What changes |
|---|---|
| Mid-season (Survivor 51: Episode 8 aired, 9 airs Wed) | the ready line is Just Episode 9; one-night bases default to Episode 9, season bases to the rest of the season |
| Before the premiere, or until Episode 2 airs | every base defaults to the season, the premiere left out; the ready line is the premiere's game |
| A season that's finished airing (The Challenge 42) | the whole gallery at your own pace; Starts reads where you are and from the top; When moves lock is one line, "At your own pace: every episode is out", with where it syncs |
| A story show (Below Deck 13) | the categories hold what its results can settle; nothing asks who goes home unless its results say who does; questions and moments lead; three stages make its chips |
| A sport (the 76ers) | its 13 bases; How long is the team's games (next game, rest of season, against a rival, pick games); the lock is by game, day or week |
| A couch of one | Just me under Who's playing; a base that needs company (head to head, a pot, weeks won, teams, the majority) says "needs 2 or more of you" and offers Me and the bot, Coming |
| Someone behind | When moves lock names them closed only when the setting costs them a move, with the one-tap fix |
| A 30-episode season | the strip folds the aired run into one block; chips by stage or by week where the show has weeks |
| Spoilers | the cast and moments as the starter has seen them; made-for games' names and hooks speak of the season's shape, never its results; the preview's episode is one they've seen |
| No results yet (a new show, a show just added) | the preview airs made-up results with the real cast under the red tag |

## Hard cases

- **A twisty game:** Secret Traitors with two traitors who know each other; Twist of the week.
- **A game in stages:** task 4, a Fantasy league with a captain, a new draft at the merge and side bets; Two halves.
- **A sport:** the 76ers, Game day props (winner, top scorer, the total).
- **A story show:** Below Deck 13, who gets fired, and a moment the show doesn't track.
- **The bot's wait and its errors:** Describe's wait, the bot away, the day's asks used.
- **A piece that isn't playable yet:** the Coming squares (Live calls, Two against one, Me vs the bot) and the Coming choices
  (Worth more on a streak, Bids on free agents); a piece the engine plays whose play screen isn't built is built first.
- **A couch of one:** Just me, and a base that needs company.

## The drill tree

| Level | Opens from | Back lands on |
|---|---|---|
| Which show (from the hub) | the hub's Start a game | the hub |
| The gallery | a way in; Back from a base | where it was opened |
| A base's screen | a square, a community game's Change it first, Describe's Open it, Run it back, Again | the gallery, its scroll and chip kept |
| A change | a row or a popular change | the base's screen, at that row, marked |
| A control's Other… | a chip row | the change, the number set |
| Preview's steps | Preview how it plays; a friend's Try it | the screen it was opened from, unchanged |
| Ask the couch first | the Start bar | the base's screen, "Asked the couch" on the bar |
| Describe's wait, result, interview | the field, the last row | the gallery; the result opens a base's screen |
| Community list, a community game | the section's See all, a row | the gallery; the list |

## What every screen carries

- Picks only flow down; a choice that can't be had is shown with what it needs.
- Icons carry their names; bets say "bet", points never money; what scores names its scoring; faces carry a qualifier.
- "Guess" in Start a game's words (the game pages keep "call").
- The known names (Outlast, Best ball, Survival pool), each with its plain line.
- Every number held to the engine's range, saying it.

## Left out

- **The show's games and the archive** of finished short games: Round 3.
- **Changing a game later** (Backstage › Game settings): Round 4.
- **Live calls themselves** (A15): the next round; their square is here, Coming.
- **How the practice copy is made** without writing to the server: the build (B-lane), from the spec.
- **Ads in the AI's wait:** none until an ad network is chosen (the user, 2026-11-09).

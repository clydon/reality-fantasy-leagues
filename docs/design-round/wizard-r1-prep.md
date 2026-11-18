# Start a game, redone: Round 1's prep (2026-11-17)

The plan: [PLAN-start-a-game-redo.md](../PLAN-start-a-game-redo.md), Round 1. This is what the directions are judged against: the
coverage target (every game the engine makes), today's Start a game in each situation (the "before"), U0's canvas and what the
user said about it, and the Designs needed items a piece's play screen still waits on. Frames: `.ui-atlas/stories/wizard-r1/before/`
(`node scripts/dev-test/story-start-wizard.js`). Engine words: `.impeccable/mocks/wizard-r1/data.json` (`build-data.js`, on the real
pages `read-pages.js` read from the cast-properties lane's database: Survivor 51, Below Deck 13, The Challenge 42).

## 1. The coverage target: what "every and any game" means

A game is one spec (`settings.game`): span, pool, get, count, score, rank, ask, closes, extras, and either stages with an overall or
a card. The wizard's job is to make any spec the engine plays, plus three things around it the spec doesn't hold: who plays (the
couch, just you, you and the bot), the pace (own pace, live, live strict) and the game's name and Tell the couch.

**The dials, by the question a person would ask** (the schema's `VOCAB`: 71 settings, 215 values, 210 built; every one placed in a
group, none left over):

| Group | Settings | Values (built) | What it covers |
|---|---|---|---|
| When it runs | 3 + the span | 10 (10) | the span (an episode, a phase, the end), a sport's lock by the day, week or game, a question's window (once, each, every few, per phase; closing at the start or the finale) |
| What you hold | 19 | 51 (49) | a draft (snake, private, a draw, an auction), a pick each episode, a card, nothing, squares; shared or all yours; lineups, best ball, everyone counts; group slots, a spread across groups or a property, prices and a cap, a stock market, keepers, a second pick, never twice; where a replacement comes from |
| What you're asked | 5 | 25 (25) | 16 answer kinds (a person, a group, yes or no, a number, over/under, a choice, an order, a ranking, chips, a vote split, pairs, a side, a bracket, trivia, the show's calls, a ticket); about each person or each game; a card from the moments, the AI or a host |
| What settles it | 6 | 22 (21) | results, a moment research answers, a role, a phase, points, the calls, trivia, an episode fact, the players' own answers, a ticket's legs, a sport's final and stats (an outside number is built but off) |
| What scores | 15 | 43 (41) | how long they last, what they do, staying in, bingo lines, right answers, stages, a sport's stats, squares; hits; when points multiply; a captain; how a holding joined; bounties; secret roles; the top scorer's twist |
| Bets and shares | 3 + switches | 6 (6) | a pot split, only a lone right answer, even money or the couch's odds, a call that shrinks; with a stake, a bank, a rollover, parlays and a ticket (switches and numbers) |
| How you win | 15 | 40 (40) | most points, a streak, last one standing (cuts, lives, mulligans, buybacks), worth, co-op, head to head (playoffs, an odd one out, a quiet night), weeks won, a sport's categories and roto; a race; teams of players; a handicap |
| Shape over the season | 5 + stages | 18 (18) | 2 to 6 stages, one after another or alongside, a stage at a format change (8 kinds) or beside a lasting group, another season; how the overall adds up; how a change is taken |

Plus the numbers and switches the VOCAB doesn't list (team size, starters, lives, a race's target, a bank, a stake's size, playoffs'
size, a handicap's points, a card's lines, a multiplier's times...): `docs/GAME-PIECES.md`, "Size limits".

**The requests.** The tracker (`docs/ENGINE-CAPABILITIES.md`) holds 296 requests people would type: 239 play now, 27 wait on a step
(18 of them A15's live calls), 4 on a rule, 3 aren't planned, 23 are the GPT's to ask or refuse.

**Randomize's pieces** (`roll.js`): 8 bases (Outlast, Weekly Lineup, Best Ball, Survival Pool, Weekly Picks, a game of questions,
Weekly Bingo, Weekly Calls), 7 ways to win, 29 twists (a draft's, a pool's, a game of questions', anyone's, and two that make a
game in stages: the redraft and trivia too), 6 lengths.

**The made-for library** (G5): Survivor 51 has 22 (6 one-episode, 6 a few, 10 the season; 21 play on its page today: "The Tribal
Forecast", "One More Night", "The Safety Net", "Race to Sole Survivor", "The Deep Bench"...). A sport has its standard games instead
(basketball's 8: the season league, a short draft, Pick'em, Pick a few, categories, roto, Best Ball, Squares; football's 6).

**The ten tasks, as the engine plays them** (on the real pages; Survivor 51's next is Episode 9, Wed Nov 18, 8 PM):

| # | Task | The engine's game | Verdict |
|---|---|---|---|
| 1 | Something quick for tonight | The Tribal Forecast (made for Survivor 51): "everyone answers three questions before Episode 9: who goes home, who wins individual immunity and does anyone find an idol or advantage" | plays |
| 2 | Outlast for the rest of the season | "An Outlast for Survivor 51: everyone drafts 3, Episode 9 to the finale" (all yours, by turns: the preset's own) | plays |
| 3 | Something easy Joanna will finish | Outlast drafted in private (shared): one move, then just watch; or the Survival Pool (one pick an episode) | plays |
| 4 | Weekly Lineup + captain + redraft at the merge + side bets | "Weekly Lineup, redrafted": two stages, each a lineup with a captain who scores double and side bets, the second drafting when Merged starts | plays (side bets go on each stage, not the whole) |
| 5 | Just me tonight, against the bot | a one-episode Prediction Sheet; the bot is a seat (E1: not built), not a rule | the game plays; the bot seat waits on E1 |
| 6 | 76ers next home game: winner, top scorer, total | the tracker's w003: "everyone answers three questions before Game 1: who wins, who scores the most points and total points: over or under (the game's line)" | plays (the opener itself has been played: our check asks for the next one) |
| 7 | Nine "which player will" squares, a bank of 200, a stake on each | on The Challenge 42 (all aired: at your own pace): "everyone answers nine questions before each episode: who does each of the card's nine moments", a bank of 200, stake any of it on each | plays |
| 8 | Below Deck: who gets fired, who hooks up | "who gets fired" plays (the Captain's dismissal, a moment); "who hooks up" is no moment of the show (the new-moment path, our AI); "who hooks up with whom" is a pair of people, an answer kind still to build (E3, BACKLOG 94) | half plays |
| 9 | Call who goes home at minute 30 | A15, live calls | a place only |
| 10 | The same game again next episode | The Tribal Forecast on Episode 10 | plays |

## 2. Today's Start a game: the before

Twelve situations at 390, as zt_nd_alex on the test couch (frames and words in `.ui-atlas/stories/wizard-r1/before/`):

| Frame | What opens | First view | Tall |
|---|---|---|---|
| hub-pick | the hub's Start a game: the wizard on the show that airs next (the crew show, Monday) | 17 controls | 2.3 screens |
| wiz-tonight | a show mid-season: the wizard on Tonight (When it runs, When moves lock, Start from's rail, the white card, quick changes, Add a bet, What scores, Describe, Surprise me, the couch, Start it) | 18 | 2.2 |
| wiz-season | The season tapped | 20 | 2.5 |
| wiz-step | a step's screen (Each episode: kinds, how many play, twists) | 14 | 1.9 |
| wiz-scores | What scores (16 moments, on/off and points) | 33 | 2.3 |
| wiz-every | Every game | 9 | 1 |
| wiz-custom | Custom (stages, then episodes like dates) | 26 | 2.8 |
| wiz-describe | Describe a new game | 7 | 1 |
| aired | a season that's aired: the wizard at your own pace, with Computer players | 19 | 2.4 |
| again | Run it back: the older list (four games, Starts, How long, Computer players) | 9 | 1.8 |
| story | a story show (a Below Deck crew): the same wizard in a competition's words | 17 | 2.3 |
| team | a sport (the 76ers, real ESPN): Start a game on a team (Next game · Rest of season · Against a rival · Pick games; Pick'em, Pick a few, a draft; quick changes dashed "Coming for sports") | 13 | 1.4 |

**What the renders show, beyond UX-IDEAS' list of 2026-11-14:**
- **On the real Survivor 51, "the rest of the season" is two episodes, and Outlast and the Survival Pool aren't offered.** Nobody
  knows the season's length, so the wizard takes the last listed episode (10) as its last (`start-spec.ts`: `last` falls back to
  the listing). The same page with the length unknown offers 18 games, Outlast and the pool among them. Task 2 can't be done today
  on the real season. (Noticed, not fixed: the wizard's `last` should be null when the listing is only the next few.)
- **A sport has no way to add a question.** The team's sheet offers Pick'em (who wins), Pick a few and a draft; the quick changes are
  dashed. Task 6 (winner, top scorer and total) can't be made by taps, and the team sheet has no Describe.
- **Three surfaces, not one:** the wizard (live and aired seasons), the older list (Run it back, a sport's season on the couch),
  and the team sheet. The plan's "three starts still use the old list" is now two: an aired season moved into the wizard.
- **The hub's Start a game skips choosing the show** and opens the wizard on whichever show airs next (the crew show here). Someone
  who wanted Survivor has to close it and go to Survivor's page.
- **A story show reads as a competition:** "Prediction Sheet · The classic", "A team", "Weekly Lineup" on a yacht crew.
- **The first view is a settings panel:** 17 to 20 controls before the game is chosen; the game itself is half a screen down.

## 3. U0's canvas and what the user said (memory: u0-design-round)

The canvas (https://claude.ai/artifact/DrbDz9CCCqNiha6yaUGckj, "Start a Game Pickers") holds every wizard board from 2026-11-07 and 08:

| Board | The idea | The user |
|---|---|---|
| A · Everything visible | the pickers in one sheet: How long, The game, How you win, a dice | round 2 re-ordered it: How long → the game → how you win ("picking the game then how to win"); the dice confused, became Versions; unlabelled icons failed ("icons always carry their names") |
| B · Three slots | the pickers as three slots | parked |
| C · The sentence is the control | tap an underlined word to change it; "Roll the rest"; say it your way | **never dealt** (impeccable's seed skipped it); parked in the old order |
| D · The menu as a list | How long, then "Made for Survivor 51": every made-for game for that length, select one into a plate, Change it | "where are the premade games displayed?" led here; **the user liked D** (round 4) |
| E · The menu as shelves | three sideways shelves by length | not picked |
| D2 · Timing, filters, make it yours | Starts × Ends in the show's stages; filters decide what's shown, modifiers what you get; then the season scrubber, then episodes picked like dates | "not quite" on the scrubber; episodes like dates with tappable stage bands; Tonight · The season · Custom; the default follows the season; the whole season leaves out the premiere |
| TimingCases | long, open and uncertain seasons (BB by week, Love Island folded, an unknown length "6+", undatable stages "≈", The Traitors' rounds) | "the number of episodes should be known"; stages aren't a rare fallback; episode types moved to twists, then tabled |
| F · The complete sheet | D2 + Describe a game + What scores + wagers | led to round 14 |
| Round 14: A shortlist, **B strip**, C deck, D host | four ways to show the made-for games and tinker, three low-fi rounds each and a blind test by four agents | **picked B, the strip**, "the best so far"; then quick changes on the card (More competitive · More casual · Different scoring · Creative moments), the white card kept |
| Find a team, The guide's Sports, Start a game on a team, The AI's errors | one search finds shows, teams and leagues; a team opens its schedule | done; built as the team sheet |

The user's calls that hold unless argued with (the plan's list): picks only flow down; icons carry their names; lengths most wanted
first (tonight, the season, a stage, a span), the default following the season, the premiere left out; the made-for games are a
starting point; what the engine changes is instant (the AI only for new words); bets say "bet"; what scores names its scoring; faces
carry a qualifier. And from 2026-11-14 on today's build: "we desperately need to redo the wizard ... the user flow, intuitive-ness,
everything"; then 2026-11-17: "every and any game ... in an easy intuitive way".

What U0's own record says about the blind test: four fresh agents at ~80k tokens each; its lessons (bets visible, "Change the
rules", twists saying their effect, plain step words, the footer saying what's next) are in today's build.

## 4. Designs needed: the play screens a piece still waits on (checked in the code today)

| Item | The piece | Status |
|---|---|---|
| 10 | Knocked out of a draft (a cut, a race won): the page still asks for a lineup | open (BACKLOG 47) |
| 21 | Beat the bot: the bot's calls and the couch's record | open (nothing on the page shows a bot call) |
| 24 | A captain: nobody can name one | open (nothing in `src/new` sends `captainId`) |
| 26 | A pool's mulligans and buyback: what happened to you | open |
| 27 | A pool's second pick: nobody can make one | open (nothing sends `second: true`) |
| 28 | Group slots: nobody can fill one | **built** (the game page's `SlotPicker`, the group-slots route) |
| 30 | An auction: what anyone paid | open |

The plan's rule: every game is creatable, and a piece's play screen is built (B2) before the wizard offers it to people. So a
direction must say what it shows for a piece that isn't playable yet (task 4's captain is one: today it would start a game whose
captain nobody can name).

## Noticed, not fixed

- `start-spec.ts` reads a season's last listed episode as its last when nobody knows its length (above): Survivor 51's season
  games are two episodes long in today's wizard, and Outlast and the pool drop out. Who takes it: the build (B1), or a small fix
  now if the user wants the live wizard right before the redo lands.
- The short form counts a card's question as one ("The Challenge 42 · 1 question · Bank of 200" for nine lines a week). The
  engine's words (describe.js); E3 or E4.
- `story-start-wizard.js`'s team frame reads the real ESPN through the dev server (a person's search does the same); every other
  frame is the zt fixtures.

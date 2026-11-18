# Start a game, redone: the wizard, the engine it reaches, and short games with an archive

The user, 2026-11-17:
- "I really want to prioritize the create a game wizard. But with that probably should be remaining engine ideas, and related
  fixes. Also update the UIUX to properly display one episode/one game games. As in have some kind of game archive on a show so we
  don't show all games that ever existed (because we want to hope daily games are frequent, whether is against other players or
  against a bot)"
- Later the same day: "I really don't like our current wizard so I think there's a lot of room for redesigns and mockups to
  approve. We want every and any game to be possible to create from the wizard in an easy intuitive way."
- After Round 1's story, the same day: "One thing to add is the future plan of having a game library, and they could include
  common built in games. I want an end goal that if someone wanted to create a silly game the whole season where you guess who
  does X moment the most, or you draft players and score based on who will do moment X the most. And that silly moment could be
  crying. The user should be able to easily and intuitively create this game."

Earlier words this plan carries:
- **2026-11-14:** "we desperately need to redo the wizard for creating a game. The user flow, intuitive-ness, everything needs a
  lot of help." What's wrong, as seen first-hand, and the ideas since: [UX-IDEAS.md](UX-IDEAS.md), "Start a game, redone".
- **2026-11-09:** "i want to use the wizard for everything so i have the same limitless options for game types"
  ([PLAN-own-pace-games.md](PLAN-own-pace-games.md), "Every game at your own pace, through the wizard").
- **2026-11-09:** "maybe rather than computer players we allow users to play solo. for now at least, then introduce bots (or we
  just have a very simple bot that picks randomly or based on players total points)" (the same plan, "Solo, then a simple bot").
- **2026-10-28:** simple on top, powerful underneath; the bot drafts and our check decides
  ([PLAN-start-a-game-gpt.md](PLAN-start-a-game-gpt.md), "The wizard").
- **U0's round (2026-11-07 and 08):** fourteen rounds of mocks on the canvas (https://claude.ai/artifact/DrbDz9CCCqNiha6yaUGckj,
  to version 58). They settled on B, the strip, which U1 built. Reference, not approval.

## The measure

- **Every and any game.** Every game the engine makes can be made in the wizard:
  - every value of the engine's dials ([ENGINE-CAPABILITIES.md](ENGINE-CAPABILITIES.md), "The dials") and every request the
    tracker plays;
  - in all three flavors: competition shows, sports and story shows;
  - from every way in: the hub, a show, a team, Run it back, a season that's aired.
- **Easy and intuitive.** Judged on the tasks below with the round frame's tests ([DESIGN-ROUND-PACKET.md](DESIGN-ROUND-PACKET.md),
  "The round's frame"): one thing first, the casual path (Joanna, Andrew) and the sweat's (Conor). Each task counts taps and wrong
  turns.
- **The silly-moment test** (the user's end goal, 2026-11-17). A season-long game about a moment the show doesn't track, crying
  the example, made easily and intuitively both ways: guess who does it the most, or draft people and score only that moment. The
  moment is added where it's picked (the new-moment path: our AI checks recaps report it, then research asks it each episode).
- **One game library** (the user, 2026-11-17, with BACKLOG 93). Ready games come from one place: the common built-in games, the
  season's made-for games (G5), and later the games people publish (BACKLOG 93: browse, vote, start from one and change your copy).
  A built-in game can leave a part open for the starter (a moment: "Who does it most?").
- **By taps, with shortcuts.** This is the main session's reading of "easy intuitive way" (2026-11-17), and the user can overturn
  it. Every piece can be reached by tapping. Describe a game (the bot, about 40 seconds) and Randomize are shortcuts to the same
  result, never the only way to reach a piece.
- **Proof, in two parts:**
  - Round 2: a coverage table giving each dial value and each tracker request its path through the design;
  - the build: a check that drives the built wizard to each one.

## The tasks every direction is tried on

1. "Something quick for tonight's episode" (Andrew, with the couch).
2. "Outlast for the rest of the season" (a named game: UX-IDEAS's blind test).
3. "Something easy that Joanna will actually finish" (effort).
4. "A Weekly Lineup with a captain, a redraft at the merge, and side bets" (Conor).
5. "Just me tonight: play me against the bot" (solo, daily).
6. "76ers home opener: predict the winner, the top scorer and the total" (sports; the GPT plan's example).
7. "Nine 'which player will…' squares, a 200-point bank, a wager on each" (the user's typed game on Challenge 42, 2026-11-09).
8. "A Below Deck game: who gets fired, who hooks up" (a story show).
9. "Call who goes home at minute 30" (live: A15's, a place only).
10. "The same game again next episode" (a short game's repeat).
11. "Who cries the most this season": guess it (11a), or draft three and only crying scores (11b). Crying isn't one of the show's
    moments (the user's end goal, 2026-11-17).

## The user's earlier calls (kept unless a design reason argues otherwise, raised head on)

From U0 (2026-11-07 and 08) and since:
- **Picks only flow down.** A later tap never changes an earlier pick. A choice that can't be made is shown with what it needs,
  and is never switched to silently. The built wizard breaks this (UX-IDEAS, 2026-11-14).
- **Icons always carry their names.**
- **Lengths, most wanted first:** tonight, then the whole season, then a stage, then a span of episodes.
  - The default follows the season: the whole season until Episode 2 has aired, then tonight.
  - The whole season leaves out the premiere by default.
  - A custom length picks episodes like dates, with stages tappable.
- **The season's made-for games are a starting point** (the user, round 3: "where are the premade games displayed?").
- **What the engine can change is instant.** The AI is only for new words: a typed game, a new moment.
- **Bets say "bet".** Points are never money.
- **What scores always names its scoring.**
- **Faces carry a qualifier:** tribe, role or position.
- **The built sheet's own calls are reference, not rules:** "Tell the couch" on by default, and the steps listing every game
  (2026-11-09).

## Where things stand (2026-11-17)

- **The wizard** (U1 step 3, live since 2026-11-09): `src/new/couch/start-wizard.tsx`, `src/lib/game/start-wizard/`,
  `src/lib/server/start-spec.ts`, checked by `scripts/dev-test/check-start-a-game.js`. It's the "before" in every story, and the
  baseline being replaced.
- **Three starts still use the old list** (`start-game.tsx` StartRouter, BACKLOG 42): a season that's aired (at your own pace),
  Run it back, and a sport's TV listing.
- **The engine** plays 239 of the tracker's 296 requests.
  - Still waiting: A15's live calls (18), C8's 2-on-1 head to head (1), TVmaze's ratings (2, which the user turned down), sports (3)
    and new moments (3).
  - Four requests wait on a rule (p25, s06, s45, s58), and three aren't planned.
- **What the engine doesn't tell the wizard yet:**
  - where a game syncs (`paceOf`, planned 2026-11-09 and not built);
  - what each person does each week;
  - which lengths a game can run, and why it can't run the others;
  - whether it plays alone (68% of 2,701 specs do);
  - its sentence as clauses, each opening its own choice;
  - its first week, with real times.
- **Short games:**
  - A game can run one episode, or one sports game (`settings.endEpisode`, since 2026-10-27).
  - Once over, it stays on the show's Games tab for good ("Final · Episode 4").
  - Every visit to a show's page reads each game you play on the season in full (`season-games.ts gamesHere`: each league's
    state loaded and walked; `seasonGames`: a whole view of each), so finished games slow the page.
- **Computer players** play only drafts and survival pools (`botsFit`). Solo play and the simple bot aren't built.
- **The game page can't yet play every piece** (the explorer's [Designs needed](PLAN-GAMEPLAY-SCENARIO-EXPLORER.md)): a captain
  (24), a pool's second pick (27), group slots (28), an auction's spend (30), beat the bot's record (21), knocked out of a draft (10)
  and a pool's mulligans (26). Round 1's prep confirms which are still open.
- **Cast properties' chunk 7** was left for the wizard ([PLAN-cast-properties.md](PLAN-cast-properties.md)): draft needs in the
  wizard, and `get.needs` in the GPT's manual.

## Decided for this plan (the main session, 2026-11-17; the user can overturn any)

- **Design leads.** Rounds of mockups go to the user for approval before the wizard is built. The packet's step 12 (the wizard)
  moves ahead of its steps 10 and 11.
- **Low-fi directions first, then hi-fi in the app for the direction picked.** This is how the user ran U0 ("LOW-FI until the last
  round", 2026-11-08). The story comes from real renders at 390, as [DESIGN-PROCESS.md](DESIGN-PROCESS.md) asks. Each round runs
  Intent, then PFD, then Impeccable, once each, and ends with a pause.
- **Every game the engine makes is creatable.** Whatever a piece lacks to be played is built before that piece reaches people.
  This replaces the morning's "offer only what plays".
- **A15 (live calls) is the next round.** The wizard's structure leaves it a place (task 9).
- **The bot you play against is the simple bot of 2026-11-09:** a seat that answers as a person does, free and instant, picking
  at random or by the points so far, and grown to answer every kind of question. Beat the bot (the AI's calls as the bar) stays a
  rule a game of questions can have.
- **A finished game leaves the show's Games tab** for the show's archive.

## Steps

**Order and overlap.** The design rounds come first, each ending in the user's approval. The engine steps can run in a lane
beside them (`scripts/lane.js`). The build follows the approvals.

**Model and checks.**
- Each step is one session, on Opus 5.5 at high. Round 1 runs at xhigh: the direction is where depth pays most.
- A step that changes the engine runs the unit tests, the tracker and the golden replays.
- A step with screens runs its browser check at 390.

### Round 1: directions (low-fi)

**Prep.**
- The coverage target: the tracker's dials, [GAME-PIECES.md](GAME-PIECES.md), roll.js's bases and twists, and G5's made-for library
  for Survivor 51 and one sport.
- Today's wizard, rendered in each situation, as the "before".
- U0's canvas: what was tried and what the user said about it (memory: u0-design-round).
- The Designs needed items, confirmed open or done.

**Intent: the structure.**
- The journey from the hub, a show or a team to a game started.
- How the engine's dials are reached.
- Whether there are doors, and the order of the questions.

**PFD:** the first views.

**Impeccable: three or four directions at 390.**
- Each is low-fi: grey boxes with real words and real games from the engine.
- Each is tried on the ten tasks, with taps counted, and comes with a coverage sketch (which dials it reaches, and how).
- Models worth exploring (none decided):
  - start from a made-for or standard game and change it;
  - the sentence is the control (U0's C, never dealt);
  - one question at a time, by effort;
  - describe it first;
  - build from pieces, as a bet slip adds legs.

**Output:** one Artifact. The user picks a direction or mixes them, then **pause**.

**As run (2026-11-17).** The four directions (the menu, the sentence, the interview, the slip:
https://claude.ai/artifact/S8Xxqv7UJJ2MyLAb2mToyR) were set aside by the user: "not of these work … I don't see a simple way to do
head to head or teams or betting." Their direction, drawn as Round 1b (https://claude.ai/artifact/LWAkJjLjdvZNLCpMXHxRDL,
docs/design-round/wizard-r1b-gallery.md): a big scrollable gallery of every base a person would name (56 on a show, 13 on a sport,
each checked against the engine), square icon tiles in human categories, then a base's screen and drill-down changes. Round 2 builds
the gallery once the user has reviewed it; its icons come from nano-banana (one per base). Version 2 (same link) added each change's controls.
Version 3 (same link) adds the user's five asks: a four-card preview that replays an episode the viewer has seen with the game's
points (and Ask the couch first), Describe as the search field with an AI interview whose answers apply at once, community games
(the made-for library standing in), plain words on every base, and the length in each square, first on each screen as a strip of
the season, and on Start's line. Version 4 (same link) answers
the user's notes on it: the preview's fallback when there's nothing to replay, length from each show's own stages as starts and
ends, and how each game can run (live or own pace) with today's reasons. Version 5 (same link) puts the preview on the real screens: the
practice round offered before the game exists, built from its spec, with a working sample in the story. Version 6 (same link) keeps today's When moves lock (version 4's
"How it runs" contradicted it), opened to show where the couch is and what each choice means for someone a day late or a couple
of episodes behind, and where a game syncs at your own pace. Version 7 (same link) draws the user's pick: closed, it names someone only
when the setting would cost them a move, with the fix as one tap.
Next (the user, 2026-11-17): Round 2 in a fresh session, then the design round's step 10 (Sports in full), then step 11. The engine
lane beside Round 2 starts with Designs needed 33, BACKLOG 42's second part, the practice round from a spec, then E1.

### Round 2: the direction picked, in full (hi-fi, in the app)

- Built behind a switch on a dev route that saves nothing, on real data.
- **Every screen and state, including the hard cases:**
  - a twisty game, a game in stages, a sport, a story show;
  - the bot's wait and its errors;
  - a piece that isn't playable yet;
  - a couch of one.
- **The coverage table, complete.**
- **One check and one batch of fixes:** PFD evaluate and Impeccable critique.
- **A blind test on the tasks, optional.** It's costly: about 80k tokens a tester in U0, so it's the user's call.
- **The story, then approval.**

**As run (2026-11-18).** The gallery built in the app behind `?start=gallery` (TEMP-UI, saves nothing), on the real Survivor 51, Below
Deck 13 and The Challenge 42 (a second dev server on `rfl_castprops`), through Intent ([wizard-r2-spec.md](design-round/wizard-r2-spec.md)),
PFD ([wizard-r2-first-view.md](design-round/wizard-r2-first-view.md)) and Impeccable ([wizard-r2-shape.md](design-round/wizard-r2-shape.md)),
checked once (PFD 74/100, [wizard-r2-pfd-eval.md](design-round/wizard-r2-pfd-eval.md); Impeccable 26/40 from two isolated reviewers,
[wizard-r2-critique.md](design-round/wizard-r2-critique.md)), fixed in one batch, one confirming look. The story: https://claude.ai/artifact/KcBwn263YnZ45Yh5Xib1D5.
- **The coverage table** ([wizard-r2-coverage.md](design-round/wizard-r2-coverage.md), `scripts/dev-test/gallery-coverage.js`) is generated
  from the catalog the screens render (`src/lib/game/start-gallery`): of the 210 values the engine plays now, 209 have a home proven by
  a game our check passes from it (TVmaze's ratings left out on the user's no); 40 limits tied to controls; the tracker's 239 playing
  requests each given a base and path, 228 within 6 taps (median 2).
- **The user's answers to the story's nine open questions** (decisions.md, 2026-11-17 and 18): community a collapsed section, made for
  this season first, with length badges; known names; "guess"; an aired season gets the whole gallery (E6 below); a stage's short
  start name from research; the preview is the real screens, offered to friends, never opened; our AI's reply carries each answer's
  change; any couch shares once started; solid pictograms.
- **Built:** the gallery, a base's screen, a change with its controls, How long by stages, When moves lock (closed and opened, the
  cost said once), the questions, the moment picker (task 11 in 4 taps), Ask the couch first, Describe (wait, result, errors), the
  community list and a game's screen, Start (saves nothing). Fixture and frames: `scripts/dev-test/gallery-fixture.js`,
  `scripts/dev-test/story-start-gallery.js` (`--before` for today's wizard on the same seasons).
- **Not built in the round:** the sport's gallery, a question's own moment picker, Pick episodes, the practice copy behind Try it
  (B-lane), the nano-banana icons (vector stand-ins; the Gemini account's billing was paused on 2026-11-18).
- **One choice waits on the user:** start on When you've watched it whenever the recommended lock would cost someone on this couch?
  (PFD's R4 against BACKLOG 68's live default for all-yours drafts.)
- **The user's notes on Round 2 (2026-11-18), built the same day** (the story: https://claude.ai/artifact/48NzZXE1SkYabuYcWhsVVL;
  decisions.md 2026-11-18): **saved games**, one heart beside Start on every game's screen (and beside Start your own copy), kept as
  the game's recipe and opened on any season from the next episode (`src/new/couch/gallery/saved.ts`; TEMP in this browser's
  localStorage); the collapsed section is **Community and saved games**, a row with an icon tile and its count, Saved first when
  opened; a ready game's heart counts saves (likes folded in); Trivia's category is **Bingo & trivia** ("A card while it's on, a
  quiz after") and Live calls moved to Predictions. Two fixes found on the way: a game's words follow its own draft size (sizeFit),
  and the chip row slides to keep the lit chip in view. Their other note, a game writer on our own machines, is
  docs/PLAN-local-game-writer.md.
- **For the build (B1), from the notes:** saves on the account (a table of recipes per person: base, rules without dates, length,
  where it was saved), re-fitted to the season they're opened on (fitCouch, fitMoments) and counted per community game; whether a
  saved game updates in place ("Save changes") or saves another (today's snapshot rule).

### Round 2b: the bold pass (2026-11-18, built beside Round 2 for the user to keep or revert)

The user, after Round 2's notes: "another pass on the design and make sure its bold, has character & soul for both shows and all
supported sports (especially our core sports), and improves on readability, intuitive entry and modification. and ensure all game
types are possible and intuite to create (its okay to repeat yourself in the UI ...). At the end i can tell you if this pass is
something we should carry over or revert back." Mid-pass: sports get custom moments ("fan ran on field, or overturned ABS calls"),
and "the sport create a game should at least feel and navigate just like the show even if its technincally different."

- **Where it lives:** `src/new/couch/gallery-bold/` behind `?start=bold` (Round 2 stays at `?start=gallery`); a sport's season takes
  it too (`start-game.tsx`'s router, before today's sport sheet). Reverting deletes the folder and its two switch lines; Round 2's
  files are snapshotted in `.ui-atlas/snapshots/gallery-r2-notes-2026-11-18/`.
- **Papers:** [wizard-r2b-spec.md](design-round/wizard-r2b-spec.md) (Intent), [wizard-r2b-first-view.md](design-round/wizard-r2b-first-view.md)
  (PFD), [wizard-r2b-shape.md](design-round/wizard-r2b-shape.md) (Impeccable); decisions.md 2026-11-18.
- **Built:** a lead tile per category drawn with the season (faces still in as far as you've seen, the next episode's questions, a
  bingo card of the season's moments, the couch paired off or masked, a worked bet, the season's stages; a sport's players, next
  games, line and a squares corner); a game's screen opening on its title card over the show's art; Make it… (U0's ladders on the
  catalog's changes); every rule as a line with its value first; Find a change; Your own moments (shows and sports); known names,
  extra shelves and one name per thing; the sports catalog (`src/lib/game/start-gallery/sports.json`, `sports.js`: 48 game types
  across nine families, `scripts/dev-test/sport-gallery-check.js` proving each) through the same screens, its next game as the ready
  plate.
- **Engine steps it surfaced** (the user's rule: open the limits, don't design around them):
  - **E8. Your own moments in a game:** a moment added at start (its words, points, who settles it) carried in the spec; the couch's
    settle (whoever sees it taps it, the others confirm) for a sport's oddities ESPN won't carry; research's ask for what recaps
    report (G1's added moments). **Who scores it (the user, 2026-11-18, "Player's owner, else a call"):** a moment about a player
    (a batter's overturned call) scores whoever has that player; a moment about the game (a fan on the field) becomes a yes or no
    call everyone answers before the episode or game, and right calls score. Proof: a couch-settled moment scores in a sport's
    game and a show's, both ways.
  - **E9. A sport's missing game types:** a survivor pool on a sport (one team to win each week, never twice), against the spread
    (a line kept per game), a salary cap priced by stats, dynasty's rookie draft, first scorer (play order), an exact-score answer,
    a stake on who wins; our check told a slate from a game page (BACKLOG 108). Each is shown Coming with its reason until then.
  - **E10. A team's colour, abbreviation and logo in the wizard's page,** so a sport's tiles carry its teams' tags (today they're in
    ESPN's team list, not the payload).
- **Noticed:** a gallery level opened at the previous level's scroll (fixed in the pass; BACKLOG 109 for Round 2); the slate Pick'em
  that may never grade (BACKLOG 108).
- **The user's calls on it (2026-11-18):**
  - **Kept:** the bold pass and Round 2c are the direction ("i think i agree with the direct and ready to start").
  - **How moves lock is two plain cards on every game:** "Together" (everyone's move for each episode locks when it airs, and
    whoever is behind is named with what it costs them) and "At your own pace" (your move locks when you start watching; nobody's
    cut off). The stricter "at airtime" way isn't offered in Start a game, and neither card is marked Recommended; the card that
    starts chosen is unchanged (a draft where each castaway is one person's starts on Together, every other game at your own
    pace). Asked after the three ways confused the user: "if im still confused im CERTAIN people like joanna would be confused."
  - **The title card comes back on the game page:** the started game's page opens the way its setup screen did (the game's name
    over the show's art), so making a game and playing it feel continuous. A step for the build (B1's game page part), through
    docs/DESIGN-PROCESS.md.

### Round 3: a show's games when short games are frequent

- **The Games tab** holds only what's on: running games, tonight's, and games starting soon.
- **The archive:** finished games by episode, each with its winner and your place. Each opens its page as it stood, with Run it
  back.
- **Your record,** against the couch and against the bot.
- **Daily games** against the bot.
- **Tonight and the reveal** with many games in a night.

**Its situations:**
- a new couch;
- a busy season: a zt fixture, `scripts/dev-test/short-games-fixture.js` (up and down, zt- keyed), with about 60 one-episode games
  over 20 episodes;
- someone behind (spoiler-safe);
- a 30-episode season;
- a sport's daily games.

The story, then approval.

### Round 4: changing a game later

Backstage › Game settings, plus anything Round 2 leaves for the deep end. Skipped if Round 2's design already covers it. The story,
then approval.

### Engine (a lane, beside the rounds)

- **E1. Solo play and the simple bot.**
  - **The user's aim (2026-11-18):** "the ability to play any game against a bot and/or add bots to a game so you can have real players
    and bots." Computer players (`computer-players.ts`) already take seats in drafts and survival pools, at a level, from today's
    wizard and Backstage › Members; E1 makes them play every kind, and Start a game's Who's playing offers them (how many, how
    sharp) on every base, Coming where the bot can't play yet. The practice couch is hidden until then (`PRACTICE_COUCH` in
    src/new/show/solo.tsx); the bold gallery doesn't offer computer players yet, a gap for the build.
  - A couch of one can start any game. Someone invited later joins where they are.
  - The bot answers every kind: a pick, a lineup, questions, a card, calls and a draft. It picks at random or by the points so far,
    and keeps pace at your own pace.
  - Proof: every spec in the corpus plays to its end with one person and a bot (blind.js).
  - **E1, planned (the wizard lane, 2026-11-18, after B1; not started until the user says go).** Where it stands: bot-logic.js plays
    drafts (snake, blind, auction), lineups, group slots, Survival/Eliminator picks, waiver claims and finale picks, at three levels
    (easy, normal, sharp), deterministically, run by `server/bots.ts` after every write and when a league is read with a bot move
    waiting; `botsPlay` refuses anything with questions, calls or bingo; startFromSpec already takes `bots` and `level` (up to 5);
    Backstage › Members adds and removes them. What doesn't exist: a bot's answer to a question (answers live in `game_answers`,
    outside state, like blind-draft submissions), a bot's bingo card or calls, and Start a game offering any of it.
    - **E1a. Who's playing offers computer players where they play today** (a small UI change: Impeccable alone). The "Me and the
      bot" square (`CHANGES` id `bot`, `coming: 'E1'`) becomes "Computer players", a change with two controls in the approved
      grammar: How many (1 to 5, 1 first) and How sharp (Easy, Normal, Sharp; Normal first). It's dashed with its reason on a base
      they can't play yet ("Computer players answer questions with E1b"), from a catalog predicate mirroring `botsPlay` on the
      spec's kind (a draft or a pick: yes; questions, a card, calls, bingo: not yet). The game carries the choice outside its spec
      (a field on the sheet's Game, sent as `bots` and `level`); Ready to start and the Start bar say "with 2 computer players".
      "Just me" starts a game that tells nobody (already the server's: Start with no one else watching). Checks:
      check-start-a-game.js (a draft started with two, their seats and level), check-new-computer-players.js back to Start a game,
      wizard-coverage.js (the new controls are values too).
      **Done (2026-11-18, the user's go: "E1a, then E1b"):** the catalog's `bot` change is "Computer players" with `botsFit`; the
      sheet keeps how many and how sharp on its Game (controls under the square; a second tap takes them off), Who's playing's line,
      the Start bar and Ready to start say them, and Start sends `bots`/`level` while the game is one they play.
      check-start-a-game.js (a Fantasy league with two sharp ones; dashed on a Prediction sheet) and check-new-computer-players.js
      pass (but the hidden practice couch, as before).
    - **E1b. Computer players answer questions** (the engine lane). `bot-logic.js answersFor(state, ask, level)` for each answer
      kind the corpus uses, from what the league knows (the ratings it already keeps): a person (who goes home: the most in danger;
      who wins: the best rated), yes or no (the moment's rate so far), a number and over/under (the median so far), a choice (its
      taste, seeded), an order and confidence (the ratings), pairs, chips; easy plays more at random, sharp reads more. The server
      writes them into `game_answers` before each question locks (bots.ts, beside the blind submissions), and at your own pace as
      each bot reaches the episode (catchUpTo). Proof: a unit test per answer kind; a Prediction sheet, a prop card with wagers
      and a Beat the bot game played to their ends with one person and two bots.
      **Done, its first slice (2026-11-18):** `bot-logic.js answers(state, stored, o)` gives each computer player playing live an
      answer to each open question it hasn't answered (this episode's window, or one asked once while open), one the engine accepts
      (`Spec.answerProblem`): a person or a group (who goes home: the most in danger by the league's own ratings; who wins, scores,
      does it first: the best rated), yes or no, a number, over or under, a choice (its taste for that question that episode, a
      sharp one leaning to what usually happens). Deterministic. `server/bots.ts answerForBots` writes them into `game_answers`
      (never over one there) inside every league write, and startFromSpec runs one write after a start with computer players, so
      their first answers are in at once. `botsPlay` takes a game of questions every one of whose questions they answer
      (`answersAll`); the gallery's `botsFit` keeps the same list, and says why for the rest ("Computer players don't answer "The
      order they go" yet", a bingo card, a card's lines, calls, stages). Held back: an order, confidence, chips, pairs, a split,
      trivia, a side, a bracket, a ticket, a stake from a bank, a question about each person or game; and a game of questions at
      your own pace (a computer player catches up on its own copy, where it answers nothing yet: refused on both sides). Proof:
      tests/bots-answer.test.js (five tests: one answer a question a window, accepted by the engine, none twice, none closed, the
      gallery's list the same, played through four episodes); check-start-a-game.js (a Prediction sheet with two sharp computer
      players has their six answers in at once; a Bingo card refused; the square offered on a Prediction sheet and dashed on Bingo);
      the whole unit suite (2,427) passes. Also: tests/pieces.test.js's guard now reads the catalog's own kinds as kinds (`KIND`),
      which it had flagged since Round 2.
      **Reviewed** (`/code-review high` on the E1 commits, 2026-11-18), all ten fixed and re-checked (2,429 unit tests;
      check-start-a-game.js all pass): own pace counts a game set to it (the lock card), not only a season that's aired, and lives in
      `botsPlay` (Backstage's add follows it), while a draft with finale picks at your own pace still takes them; Weekly Calls and
      Bingo say why by their preset; a stake says "Computer players don't stake points yet"; Sharp and Normal differ on yes or no,
      over or under, a choice and a count; the write after a start can't fail it; one rule for which questions they answer
      (game-spec answers.js `botAnswers`, read by bot-logic and the gallery); bots.ts reads the table only for a game with such a
      question. So on a show's game, which starts at your own pace, Computer players on a game of questions wait until Together is
      chosen, and the square says so.
      Noticed: with no results yet, a computer player's "who goes home" and "who wins immunity" can name the same person (its taste
      is the only signal before results); they part as results come in.
      **E1b's second slice, part 1, done (2026-11-18): answers at your own pace, people's first.** Starting it found that nobody
      could answer a game of questions at their own pace while catching up: answers.ts refused it ("Catch up first: questions open
      once you're on the live episode") and the read listed no questions, though Start a game makes such a game (a Prediction
      sheet on a season that's aired, or one behind). That's docs/PLAN-own-pace-games.md's part 4, never built ("answers lock per
      person by their mark"). Built here, since computer players answering where people can't would be unfair:
      - **People.** `AnswerLogic.ownWeek(state, seat)`: catching up in a game at your own pace (a live game's late joiner still
        waits for the live episode). For such a seat, `lateEpisode` is the episode after your mark, and `closed` closes a question
        once you've seen the episode that closes it (or the game's last); nothing else does (not its air time, not results you
        haven't seen, not a finished season's `gameOver`). answers.ts lets them answer and lists their week; its `closesAt` is null
        there, and the game page's plate says "Locks when you reveal it" / "Change until you reveal it" (game-page/model.ts), the
        words a pick there already used. Who goes home lists who's still in as far as you've seen.
      - **Computer players.** `bot-logic.js catchUpAnswers(state, stored, n)`: each one catching up answers each week up to the
        week after `n` (null: its own mark), each on its own copy before that week (`GhostLogic.viewFor` at the week before), with
        the same `closed` rule. `bots.ts catchUpBots` writes them and then runs `catchUpTo`, where a reveal moved them (reveal.ts,
        late-join.ts, inside the lock); `answerForBots` adds each one's next week after every write, so a start has its first
        week's answers in at once and each next week's are in before anyone opens it. The own-pace refusals are gone (`botsPlay`,
        startFromSpec, the sheet's `botsWhy`, now just `gm.botsFit`).
      - **Proof.** tests/bots-answer.test.js: each week's answers as it catches up, never twice, and the spoiler guarantee (a season
        the same through Episode 2 with a different Episode 3 gives the same Episode 3 answers); a person's week and lock by their
        mark (and a live game's late joiner unchanged). check-start-a-game.js: a Prediction sheet over Episodes 1-3 at your own pace
        with a computer player has Episode 1's answers at the start, then 2's and 3's as alex reveals, nothing past the game; the
        square offered at your own pace. Probed through the routes: alex answers Episode 1 before revealing it, Episode 2 after,
        Episode 1 refused once seen ("Answers are open for Episode 2"), alex's right answer scores; two computer players answer all
        three weeks and sit in the table with robot faces (the page at 390 showed Episode 2's questions, "2 on the couch have
        answered", the season grid's SET for them). The unit suite (2,431) passes; check-own-pace-live.js's API steps pass.
      - Noticed, not fixed (lane: whoever next touches the checks): check-own-pace-live.js's browser step waits for Tonight's
        `[data-move='lineup-…']` card, an attribute nothing renders since Tonight's rebuild; a stale selector, not this change. A
        shrinking call (`shrink`) made at your own pace on a season that's aired counts every episode as started (`startedNow`), so
        it's worth its least; a question closing at the finale reads the schedule's finale, which a catching-up seat answers up to.
      **Left for E1b's second slice:** the held-back kinds above (an order and confidence from the ratings; chips spread by them;
      pairs; a stake: a share of the bank by level); a prop card with wagers and Beat the bot played to their ends with computer
      players.
    - **E1c. Cards, calls and bingo** (each its own small step, after a named question to the user: a bingo card or a call is
      honour-based, tapped by whoever sees it; should a computer player mark its card from what research settles after the
      episode, or sit those games out?). Until then they stay dashed in Who's playing with the reason.
      **Done (2026-11-18), on the user's answers ("calls are guesses so that could be essentially randomized. Bingo is settled by AI
      too, so sure"; "make sure bots have their profile picture a robot icon"):**
      - **Weekly Calls:** a computer player's calls are made up as each episode is graded (calls.ts `botCalls`): who goes home,
        someone still in before that episode at random; each other call yes or no, a sharp one leaning to no. The same every read
        (by seat, episode and question), never stored; tallied by seat beside people's. Probed through the real routes on
        new-fixture's season (results through Episode 5): three computer players called 5, 4 and 3 right.
      - **Weekly Bingo:** a computer player's card is dealt from each episode's bank by its seat (the same card every read, never
        stored), each square ticked once it's settled as happened (the couch's says, or the results), every full line called
        (bingo.ts `bingoLines`). Probed with a bank whose squares two of the couch said happened: 8 lines an episode each.
      - `botsPlay` and the gallery's `botsFit` take both; check-start-a-game.js starts each with computer players and reads them
        back as computer players; tests/computer-players.test.js holds the new rule.
      - **A robot for a computer player's face:** the games read marks their seats (`ui/bot-seats.ts`), and `Avatar` draws a robot
        on a quiet tile for any of them (Backstage › Members already drew one), so every face of a seat (the season grid, matchups,
        sheets) says it's a computer.
    - **E1d. Proof across the corpus:** blind.js plays every spec in the corpus to its end with one person and a computer player;
      the tracker records which kinds bots play; the GPT's manual and Randomize's pieces learn `bots`; the practice couch (hidden
      since 2026-11-18) is retired or reborn as "Just me and the bot" on the user's word.
    - Sizes: E1a one session (UI and checks); E1b one to two (the engine's answer kinds, then the server and own pace); E1c one each
      after the user's answer; E1d one. No migration expected (bots are seats; answers use `game_answers`).
- **E2. Short games at scale.**
  - A finished game's result is kept small: its final places and winner, as of its last episode.
  - The show's page reads only running games in full.
  - The archive is read a page at a time, spoiler-safe by each person's mark.
  - Proof: Round 3's fixture reads within a set time.
- **E3. The remaining engine ideas.** Each lands in the tracker, the GPT's manual and Randomize's pieces.
  - C8: 2-on-1 head to head (p29).
  - BACKLOG 94's two answer kinds: a pair of people, and "pick as many as you think". Then BACKLOG 92's Guess who hooks up as a
    made-for idea.
  - s06: a guy and a girl each (cast properties' gender now records it; re-run the tracker).
  - s45: stages that take turns all season.
  - p25: a parlay on a split pot (the recommended rule, with the user's OK).
  - BACKLOG 84: a head-to-head game in stages ranks its overall by places.
  - BACKLOG 62: an Outlast stage that starts mid-season.
  - BACKLOG 42's two parts:
    - the drafter's invented moments get an ask of their own;
    - a choice the engine can change locally skips the bot's wait.
  - Cast properties' chunk 7.
- **E4. What the approved design reads** (after Round 2): whichever of `paceOf`, effort, lengths with reasons, `soloFit`, the
  sentence's clauses and the first week the design uses. All pure functions, tested on the spec corpus.
- **E5. The library's built-in games** (the user's game library, 2026-11-17): common games as specs, some with a part left open
  for the starter (a moment, a length), each checked by the engine once filled; and, if Round 2 keeps them, a season's suggested
  moments (crying, a blindside, a fish caught) rated at its setup the way made-for games are made, so picking one is instant and only
  a typed moment waits for our AI. The public library (BACKLOG 93) stays later; the design leaves its place.

- **E6. Every game at your own pace on a season that's aired** (the user, Round 2, 2026-11-17: "I want to push back that that is the
  technical limit and we should open it up much more of what's possible"; their own 2026-11-09 direction). Today only the pool,
  Outlast and the lineup have a catch-up loop (`start-game.ts` PACED). The loop for every kind of spec game, `paceOf(spec)` naming its
  sync points (part of E4), then PACED goes. Proof: every spec in the corpus plays from an aired episode at your own pace (blind.js).
- **E7. A stage's short start name** (the user, Round 2): research writes one with each phase ("the merge"), the desk edits it, a
  catch-up fills seasons already in; How long's chips and the engine's sentences read it (the gallery's TEMP map until then).

### Build (after the approvals)

- **B1. The wizard, everywhere** (the bold pass's code, `src/new/couch/gallery-bold/`, becomes the wizard; Round 2's
  `gallery/` and today's wizard go).
  - It covers every start: a live season, a season that's aired, Run it back, a sport's season, a team. The old list goes
    (`start-game.tsx` StartRouter).
  - How moves lock as the two plain cards (the user's call above); the engine's strict pace stays for games that already use it.
  - The game page opens on the game's title card, as its setup screen does.
  - Its checks:
    - `check-start-a-game.js`, rewritten;
    - a coverage check that drives the wizard to each dial value;
    - `check-game-page.js`.

  **B1 as run (the wizard lane, 2026-11-18 on; branch `wizard`, port 3013, database rfl_wizard).** In chunks, each committed on
  `wizard` once its checks pass; nothing merged or pushed.
  - **Chunk 1. The bold sheet is Start a game for every start.** `start-game.tsx`'s StartRouter opens `gallery-bold/` for a live
    season, a season that's aired (at your own pace: where you are, or from the top), Run it back (the old game's spec reopened on
    its base screen, `again.spec` from startOptions), a sport's season, Include it (the episode on now), Make it a game's chain and
    the first-time tour's practice (Start ends on the practice finish, nothing made). The `?start=` switch, the old list
    (StartSheet), today's wizard (`start-wizard.tsx`) and Round 2's `gallery/` go; what bold read from `gallery/` (model, saved,
    icons) moves into `gallery-bold/`. The wizard's logic library (`src/lib/game/start-wizard/`) stays: the made-for games and the
    bench read it.
  - **Chunk 2. Start starts the game.** Ready to start's Start sends the spec (`wizardApi.start`: name, pace, late, `made` with
    its base and where it came from), the couch hears after the 10-second Undo, and the game's page opens (`paths.gamePage`).
    Pieces that don't play yet aren't offered to people (the plan's rule): Try it (the preview lane's P0), Ask the couch first (no
    post exists yet), Your own moments (E8) and the suggested moments (E5) are held behind flags in `gallery-bold/flags.ts`, each
    named there with the step that turns it on. A game in stages is refused by the server (`startFromSpec`), so its Start says so
    until the engine starts one from a spec. Describe asks our AI for real (the wizard's job store, kept past the sheet); with the
    lane's keys blank it shows its away state.
  - **Chunk 3. Saved games on the account.** Migration **0442_saved_games** (master's last is 0441; another lane that takes 0442
    renumbers at the merge): a recipe per person (base, rules without dates, length, its name, the season it was saved on), keyed
    by its recipe; `GET/POST/DELETE /api/me/saved-games`; `saved.ts` reads it (react-query), and a browser's localStorage saves from
    Round 2 move up once. Re-fitted on the season it opens on (fitCouch, the season's own moments) as before. Snapshot rule kept
    (a changed game saves another).
  - **Chunk 4. Known names in the catalog.** `known.ts`'s fans' names, shelves, leads and names move into
    `src/lib/game/start-gallery` (bases.json `aka`, `shelves`; `searchKnown`; `LEADS`), the sports' into sports.json; the coverage
    table reads them.
  - **Chunk 5. A team and a slate.** A team's Start a game… and a league's slate add their games (`/api/sports/add`) and open the
    same sheet on that season, its length chosen from what was asked (the next game, a rival's meetings, a run); today's
    `start-sport.tsx` goes. Play the next game (one tap, Pick'em) stays.
  - **Chunk 6. The checks.** `check-start-a-game.js` rewritten for the bold sheet (API and browser: every start, Start, Undo, saves,
    Describe's away state, refusals); `wizard-coverage.js`, a browser run driving the sheet to each catalog value (the coverage
    table's homes) and starting a sample; `check-game-page.js`; `story-start-gallery.js --db=rfl_wizard --base-url=http://localhost:3013`.
  - **Chunk 7. The game page opens on its title card** (the user's call). Not designed yet, so it goes through DESIGN-PROCESS.md:
    Intent, PFD, Impeccable, one check, the captioned before/after story at 390 as an Artifact, then a stop for the user's review.
  - **Progress.**
    - Chunks 1 to 3 committed together (one commit: the router, Start and saves touch the same sheet). `check-start-a-game.js`
      rewritten and passing (API and browser, 390). Ported to the sheet and passing: `check-own-pace.js`, `check-made-games.js
      --screens`, `check-episode-lock.js`'s Include it, `check-new-computer-players.js` (Who's playing says the bot is coming),
      `capture-show-overview.js`. Still driving the old sheets, for chunk 6: `check-spans.js`, `check-phase-starts.js`,
      `check-questions.js`, `check-own-pace-start.js`, `check-new-start-game.js` (their `--api` halves stand), `check-new-tour.js`'s
      practice, `story-start-wizard.js` (Round 1's "before": kept as history, it can't run now), `check-gameplay-bench-flows.js`'s
      wizard surface, `check-sports-couch.js`'s team sheet (chunk 5).
    - Chunk 4 committed: `known.ts` is gone. Each base's fans' names (`aka`), its other shelves (`shelves`) and the renamed bases
      (Prop bets, Parlay) are in bases.json; each category's `leads` and `storyLeads` too; the sports' names and leads in
      sports.json (in the file's own one-line style); the changes' names (A new card each episode, Parlay) and what people call
      them (`aka`) in index.js, with `searchKnown`. The coverage table regenerated (210 of 210 homed, 209 proven) now says the
      catalog's names; `sport-gallery-check.js` passes (181 rows).
    - Chunk 5 committed: `sports/start-sport.tsx` is gone. A team's Start a game… and a league's Play the season, week by week go
      through `sports/start-handoff.tsx`: the games added (`/api/sports/add`: the team's season, a rival's meetings, a run of games;
      a league's slate), then Start a game on that season, a team's Next game opening every game it can be on just that game
      (`length: "next"`). `check-sports-couch.js` ported (Squares on the next game, Every game left, its page) and passing but for
      the guide's Sports order (below); its `/home` guide step points at the guide's own page now (`?page=guide`, a move from an
      earlier step). The slate's handoff isn't driven by a browser check yet (no way in by URL to a league's sheet); its API is
      `check-slate.js`'s.
    - Noticed, not fixed: `check-sports-couch.js` fails "the guide's Sports leads with the couch's team's game" (the guide moved
      to its own page in an earlier step; the guide, untouched here).
    - Chunk 6 committed: `wizard-coverage.js` drives the sheet to every value the coverage table proves (`gallery-coverage.js
      --json` now gives each value's taps), reads what landed through the sheet's development-only `window.__START_GAME__`, and starts
      every 12th: 193 of 193 reached, 12 refused by our check on today's Survivor 51 for season reasons (an auction too big for 10
      left; keepers with no game last season) and printed HERE, 15 started and taken back. What it found, fixed: a question's
      settings had no way to tap there (they open under the question now); a game of questions' other ways to ask (a new card each
      episode) were unreachable (More ways to ask); added questions lacked their kind's line, options and pairs; a ticket's legs
      read as missing; a base's questions about a moment the show doesn't have now leave it (fitMoments: Traitors 5 and Challenge 42
      gain two playable bases each). Ported and passing: `check-own-pace-start.js`, `check-new-tour.js` (the practice now opens on
      the Prediction sheet's screen, one path, Start shakes), `check-game-page.js` (the zt couch's games), `check-sports-couch.js`
      (but its guide step, below). Ported, their B1 parts passing, failing on screens B1 doesn't touch (below): `check-spans.js`,
      `check-phase-starts.js`, `check-questions.js`, `check-new-start-game.js`. `story-start-gallery.js` draws the built gallery by
      default (`--before` prints SKIP: Round 1's wizard is gone).
    - Chunk 7 built and reviewed: **the user's calls (2026-11-18): the art in colour on both screens; the sentence and the bar left
      to Claude**, kept as built (the sentence until the game has scored for you; the name once, the bar taking it after the card
      scrolls away). The greyscale switch went; DESIGN.md's Title card and Show Art say so. Built as reviewed (the story: https://claude.ai/artifact/XR92umAKtd2gSFt1H7Grtd): the game page
      opens on its title card (`src/new/show/game-title.tsx`; one object with the setup card through `src/new/ui/title-card.ts`: the
      kicker, the measured size 48/40/34, the art; the setup's sentence carried onto the game at Start as `settings.about`, else the
      engine's, numbers left out); a bar stays at the top with the name once the card scrolls away. Papers:
      docs/design-round/b1-title-card-spec.md (Intent), -first-view.md (PFD), -pfd-eval.md (69/100), -critique.md (Impeccable 29/40),
      fixed in one batch. Frames: `scripts/dev-test/story-game-title.js` (`.ui-atlas/stories/b1-title-card/before|after`). Three
      choices wait on the user: the art in colour or greyscale on both screens (`useCardArtGray`, development's `?card-art=gray`;
      colour now); how long the sentence stays; the name in the bar. Open: Start's toast over the card's top for its 10 seconds; a
      sport's card without team marks (E10); the sentence until a first result rather than a first move; the week block's seven
      type sizes (step 2's).
    - Code review (`/code-review high master...wizard`, 2026-11-18), its findings fixed and re-checked (`check-start-a-game.js` all
      pass, 29 unit tests): a game in stages offers only the rest of the season as its length (its stages set its stretch); the
      server checks a staged game's first stage's start and refuses Include it for one; saved games index a sha256 of the recipe
      (0442 edited before any merge: re-applied on rfl_wizard), a batch skips an entry that doesn't read, and the recipe's key drops
      undefined keys as JSON does; Run it back keeps only the questions this season can ask; the setup's sentence is kept only for
      a game started unchanged and only while its rules are still those (a fingerprint); a team's Next game checks a base's own
      one-game spec; a dead sort by made-up save counts went; the setup screen's row values are read once per game; the game view
      reads its spec's words once. Since then a draft run back is held to today's limits (starters, bench, a team's size), as the old
      path did.
    - Not done in B1, for the next session: the gameplay bench's wizard surface (`tools/gameplay-bench/router.cjs`, `check-gameplay-
      bench-flows.js`) still drives the old wizard's rail (`data-start-game`, `data-sport-game`): the explorer lane's adapter work.
      DESIGN.md's Title card and Show Art lines wait on the user's art call.
    - Noticed, not fixed (for the main session at the merge; none touched by B1): `check-spans.js` "a start that has aired: refused"
      (an aired start is now an own-pace catch-up) and the Games tab's span lines (`[data-span]`) not appearing for these games
      (also `check-phase-starts.js`); `check-questions.js` waits for `.nd-dock`, which doesn't appear; `check-new-start-game.js`
      may still need its talk-show and series steps looked at after this run. `check-episode-lock.js` fails "and a new pick doesn't go in" (a pick after Backstage › Settings locks the
      episode); the lock API, untouched here. `check-new-computer-players.js` still expects the practice couch the user hid on
      2026-11-18. Both for the main session at the merge.
    - Dropped from the old list on purpose: the practice show's two-second "getting its rules" wait (the practice opens the gallery
      straight away); a span picked like dates and a later listed episode as the start (the bold design's lengths are the show's
      stages; Pick episodes was never built in Round 2b); Tell the couch as a switch (the Start bar says who it tells; it always does).
  - **After B1: E1, computer players in Who's playing** (planned, not started): Who's playing's "Just me" and "Against the bot"
    squares (today "coming") become how many computer players and how sharp, on every base where `botsPlay` holds; a base where
    they can't play yet says Coming with its reason. Until then computer players join from Backstage › Members, as today; Start a
    game no longer offers them (today's wizard did, for drafts and pools).

- **B2. The play screens for every piece the wizard makes that the page can't play yet,** each before the wizard offers that piece
  to people.
- **B3. The show's games and the archive** (Round 3's design).
- **B4. Game settings** (Round 4's design).

### Fixes, any time

A lane can take these beside the main steps.
- **The round's small ones, from 2026-11-17:**
  - BACKLOG 39 (a cold start fails a real request);
  - 85;
  - 92 (Backstage's "All clear");
  - 96's contrast and the rest of 96;
  - 102, 91 and 95.
- **BACKLOG 42's small wizard items, if the redo keeps what they touch:**
  - Tonight's word on another day;
  - a season over 13 episodes scrolling sideways;
  - `check-new-tour.js`.

## Open questions (asked one at a time, at their step)

- **Round 1, structural:** what before how long, or how long first?
  - U0 put How long first, and that was the main session's reading.
  - The user then said "picking the game then how to win".
  - On 2026-11-14, "when before what" confused in practice.
  
  The directions may differ on this, so the pick answers it.
- **Round 3:** does a short game played every episode stay one game with a winner each night (C5's week as a result), or start a
  new game each time?
- **Round 3:** do short games count toward the couch's Power rankings and a profile's best finish?
- **Round 3:** does every short game tell the couch, or only the first one of a night?
- **Rounds 2 and 3:** what does a couch of one see as its standings: its own best, or its record against the bot?

## Noticed, not fixed

- **Round 1 (2026-11-17): today's wizard takes a season's last listed episode as its last** when nobody knows its length
  (`start-spec.ts` `wizardOptions`: `last` falls back to the listing). On the real Survivor 51 (Episode 9 next, 9 and 10 listed) "the
  rest of the season" reads "2 eps" and Outlast and the Survival Pool drop out; with the length unknown the same page offers 18
  games. Who takes it: B1 (the wizard everywhere), or a small fix now on the user's word.
- **Round 1: the short form counts a card's lines as one question** ("All season · 1 question · Bank of 200" for nine lines a
  week). describe.js `shortSpec`; E3 or E4.
- **Round 1: "three starts still use the old list" is now two.** A season that's aired opens the wizard (at your own pace, with
  Computer players); Run it back and a sport's season on the couch still open the older list, and a team has its own sheet
  (`src/new/sports/start-sport.tsx`).
- **Round 1's task 11 (2026-11-17): the engine's words on a one-moment game.** The short form says "Only 1 moments count"; a
  season-long question beside a weekly one reads "two questions before each episode: who cries the most and who cries this
  episode"; and a draft where only crying scores still says "Scored by Survivor 51's rules, with one moment's points changed". All
  describe.js; E3 or E4.
- **Round 1: an undated phase reads as open-ended in the wizard's made-for lengths** (`madeFor` by n: "until the merge" with no
  date counts as the season, so the "few" made-for games, The Merge Survivor among them, don't show under it). Round 2's design
  decides what a stage's list holds.
- **Round 1b version 3 (2026-11-17): the engine's rules name the merge by its phase's name** ("until Merged starts", "Out before
  Merged starts?"). describe.js; E3 or E4.
- **Round 1b version 3: some rules run a question into its answer** with no stop ("Rank everyone from most to least likely to go
  home Rank 18", "The boot order Put 18 in order", "Trivia about the episode before A few questions", "The final jury vote split 5
  points for the split exactly"), and a bank game's questions read "0 points if you're right" before the stake. describe.js; E3 or E4.
- **Round 1b version 3: a made-for game's hook can disagree with its rules.** Survivor 51's The Safety Net says "one life" and "one
  bad call can end your season"; the game has two lives. The made-for check reads the spec, not the hook. Who takes it: G5, before
  community games show hooks.
- **Round 1b version 3: a game of guesses can't double the finale** ("times" isn't part of a game scored by answers; `score.times` is
  a draft's). "Finale counts double" is a natural ask for any game. Engine lane, on the user's word.
- **Round 1b version 4 (2026-11-17): a span from one phase to another loses its start in the short form** ("Until Closing Charter ·
  Draft 3, start 2" for Charter Season only; the sentence has both). describe.js `shortSpec`; E3 or E4.
- **Round 1b version 4: a base checked on Survivor 51 doesn't carry to every show.** Survivor's Weekly Lineup fails on Below Deck
  13 ("Was caught sleeping on duty is the couch's word: research doesn't answer it"), and its prediction sheet does too ("The show's
  results don't say who goes home or wins"). A show's gallery builds each base from its own answerable moments and results.
  Round 2's coverage table, per show; B1.
- **Round 1b version 4: Below Deck 13's local data** (rfl_castprops) has six episodes out and no accepted results, and its
  rulebook marks no start for Charter Season or Closing Charter at Episode 7. Data, not code; it made the preview's no-results case
  real.
- **Round 1b version 5 (2026-11-17): the practice round copies a joined league, for three game types.** `buildPracticeState`
  takes a league's state, and scripts exist for lineups, Outlast drafts and pools (`practice-steps.ts`). A preview before the start
  needs it built from a spec on a season, with steps made from the spec's moves for every kind of game. Who takes it: Round 2's
  design, then the build (B-lane).
- **Round 2 (2026-11-18): a base on a season late in it can't seat everyone.** Survivor 51 with 10 still in for a couch of 4: every
  all-yours draft of 3 is refused by our check. The gallery fits each to who's left (2 each, else shared: roll.js exclusiveFits' way)
  and says the number on its square; the build (B1) keeps that, and the engine's words should say it too.
- **Round 2: the bases' plain words are Survivor's.** The gallery swaps nouns and drops Survivor-only sentences on other shows (a
  stand-in); a show's own words for each base come with B1 (the plan's "A show's gallery builds each base from its own answerable
  moments and results").

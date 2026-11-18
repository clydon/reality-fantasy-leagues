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
  - A couch of one can start any game. Someone invited later joins where they are.
  - The bot answers every kind: a pick, a lineup, questions, a card, calls and a draft. It picks at random or by the points so far,
    and keeps pace at your own pace.
  - Proof: every spec in the corpus plays to its end with one person and a bot (blind.js).
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

### Build (after the approvals)

- **B1. The wizard, everywhere.**
  - It covers every start: a live season, a season that's aired, Run it back, a sport's season, a team. The old list goes
    (`start-game.tsx` StartRouter).
  - Its checks:
    - `check-start-a-game.js`, rewritten;
    - a coverage check that drives the wizard to each dial value;
    - `check-game-page.js`.
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

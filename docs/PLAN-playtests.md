# Season tapes and playtests

For the playtest lane's sessions and the user. Status: planned 2026-10-28, started that night in the playtest lane
(`../rfl-playtest`, branch `playtest`, database `rfl_playtest`, port 3005).

## What the user asked for (2026-10-28, going to sleep with the survivor and engine lanes running)

> In case we wrap up those two windows and there's nothing asked of me, either continue or collect some baseline research for
> several different shows, at least 2-3 seasons of each, and the full season's episodes (Survivor, Traitors, The Challenge,
> Dancing with the Stars, Below Deck). Collect what every prompt would return (rules, cast, scoring, brief episode, full
> episode, trivia, bingo, etc.; I may be over- or understating this list) and save it locally so we can run tests on the
> seasons at will. Use my local GPT bot. We'd mimic a full season with different user workflows, all different types of games
> and game parameters, and how a user might use the prompt: casually, solo, small group, big group, niche game, popular game,
> very customised, something that doesn't make sense. Try to leave no stone unturned until we have extreme confidence.
> Subjectively look at how each game is being played and see if it's fun, if it makes sense to the user, and if it plays well.
> You decide if this can run concurrently too or if it comes after. The end goal is we keep moving: I expect to wake up and
> we're still crunching.

And, while that was being set up: "Locally, for debugging, we'd want both the input prompt and the output structure."

## Decisions (made overnight, for the user to change)

| Question | Decision |
|---|---|
| At the same time, or after? | **At the same time, as its own lane.** It only adds files (the recorder, the replays, this plan and its report), so it shares nothing in flight with the survivor and engine lanes, and the local bot is free: S2 and A2 don't ask it anything. |
| Who asks the bot all night? | **A plain script in its own window, not a Claude session.** It keeps asking while the usage window is used up, and costs none of it. Sessions build it, start it, and use what it has recorded. |
| Which bot? | **Only the local one** (`http://127.0.0.1:8765`), never production's (`bot.gameyourshow.com`), where the live app's research runs. The lane's `.env.local` lists only the local bot. |
| What a recording keeps | **The input prompt, the raw answer and the parsed output, side by side** (the user's ask), with when, how long, which bot and the app's commit. A parser that changes later re-reads the raw answers without asking again. |
| Whose prompts and parsers? | **The app's own**, run through its own code (`db/bot-research.js` `runJob` for quick, full, trivia and bingo; the rulebook, the cast, recaps, and every other prompt the app sends), never copies of them. One way to catch every kind, the TypeScript-only ones the lane's server sends included: a recording proxy in front of the local bot, with the lane's server pointed at it. |
| Where the tapes live | **`C:\Users\conor\rfl-tapes\`**, outside every worktree, so removing a lane can't take them and every lane reads them by full path. Not in git (the repo is public), so not backed up either. |
| In what order | **Breadth first**, so the morning has something for every show: (1) one complete season of each show, its core (rules, cast, then each episode's quick and full research); (2) the words corpus (short questions, P2) as soon as the recorder runs; (3) those seasons' game content (trivia, bingo, recaps); (4) second seasons; (5) third. |
| Which seasons | **The three most recent complete seasons of each** (check TVmaze): Survivor (48 to 50 expected; 49's 13 researched episodes are in the local database already and go on its tape as stored, not asked), The Traitors (US), The Challenge, Dancing with the Stars, Below Deck. Below Deck isn't in the app yet: adding it through the app's own add-a-show path is part of the test. |
| Which engine the replays use | **Today's.** The same replays through A2's spec engine, once A2 is on master, are A2's proof (every league scores the same) in docs/PLAN-start-a-game-gpt.md's track A. |

## Steps

**P1. The recorder** (`scripts/dev-test/tapes.js`; one session).
- **Inventory first:** every prompt the app sends to the bot or hands a person to paste, its parser, and whether it's about a
  season, an episode or one league. Leads: `db/bot-research.js` (quick, full, trivia, bingo, schedule, tie-break, asked),
  `db/trivia-research.js`, `db/bingo-research.js`, `src/lib/game/formats/` (rulebook-research, cast-prompt, proposal,
  season-check, each format's episodesPrompt), `src/lib/server/` (make-game's rules and cast, rosters, episode-recaps,
  results-ways, show-changes, backstage's resultsPrompt, desk-rulebooks, ai-briefs, calls), `src/lib/game/episode-team-summary.ts`.
  `scripts/dev-test/fake-bot.js`'s `kindOf` names most of them. The inventory goes in this plan, under P1's As built.
- **A season onto the lane's database** the way the app does it (the show from TVmaze, its episodes and air dates, its
  rulebook, its cast), then each kind of question for it, in the order above.
- **The tape:** `C:\Users\conor\rfl-tapes\<show>\<season>\` holds `season.json` (the season: its listing, its episodes, cast
  and compiled rulebook) and one file per question, `e<NN>-<kind>.json` (`{ kind, show, season, episode, prompt, answer,
  parsed, ok, message, seconds, at, bot, commit }`), with `.prompt.md` and `.answer.md` beside it for reading.
- **Commands:** `record` (a queue that resumes where it stopped, skipping what's on tape), `status` (what's recorded, per show
  and season, and the last error), `load <show> <season>` (a tape into this lane's database, for replays and checks), and a
  way for any check to have `fake-bot.js` answer from a tape, so the app's real flows run on a recorded season offline.
- **All night, gently:** one question at a time; a pause between questions; on a failure, back off (5, 15, then 60 minutes);
  an answer that reads like a usage limit or a bot check pauses it an hour rather than asking again. A journal
  (`rfl-tapes\journal.log`) has a line per question.
- **Started in its own window** (`cmd /c start "Tapes: recording" ...`), so it outlives the session that starts it. Every
  session in this lane looks at the journal's last lines first, and starts it again if it has stopped.
- A check of its own: one episode recorded end to end against the real local bot, and the unit tests for anything new.

**P2. The words corpus** (Start a game's typed requests; part of a session).
- A hundred or so requests, as the user would type them: casual one-liners, solo, a small group, a big group (20+), popular
  shows, niche ones (a cooking competition, a show from another country), very customised (several rules at once), sports (the
  GPT plan's three examples among them), a show that isn't a competition (Below Deck, a talk show), a span (one episode, the
  finale, after the merge), predictions only, typos and slang, two games in one message, ones that contradict themselves, ones
  that make no sense, a season that doesn't exist.
- Each with its expected reading: the sensible game, what the wizard should ask, what should be questioned or refused. Kept in
  the repo as Start a game's eval set (`scripts/dev-test/start-a-game-words.json`), G1's in docs/PLAN-start-a-game-gpt.md.
- The bot asked each one with that plan's draft request shape; inputs and outputs on tape (`rfl-tapes\words\`), and a table
  here of how well it understood. The request shape is a draft: the inputs and expected readings are what last.

**P3. Replays** (`scripts/dev-test/playtest.js`; a session or two).
- A recorded season played through today's engine, episode by episode, as zt- fixtures with an `up`/`down` pair: leagues of
  every kind (Outlast, Weekly Lineup, Survival Pool, Weekly Calls, Bingo), across their settings (team size, bench, slots,
  join modes, spans: the whole season, from episode N, one episode, after the merge; late joiners; waivers), played by groups
  (solo, 2, 4, 8, 16) of computer players with different habits: the forgetter, the drive-by, the tinkerer, and a few extras
  (docs only by role, never a real name: the repo is public).
- Each episode's results reach the games through the app's own path, from the tape's parsed full research, so the points are
  the app's own.
- Each replay keeps, per episode: standings, points and why, who's out, teams with nobody left, lead changes, ties, the
  decisions each player had and what they did. Saved as `rfl-tapes\replays\<show>-<season>-<game>-<settings>-<group>.json`
  with a short `.md` beside it.
- The matrix is too big to run whole: pick a set that covers each pair of settings at least once, and say which and why.
- A few looks at 390 on the lane's server, as a player, at the moments that matter (after the draft, mid-season, the finale).
  Screenshots stay in the tapes folder, never committed.

**P4. Reviews** (`docs/PLAYTEST-REPORT.md`; every session after P3).
- Each replay judged as a player would, against the questions below, with the replay as evidence. Findings get a severity and
  the plan step that could take them. A bug gets a failing test or an exact repro.
- **Fun:** how many can still win after each episode, lead changes, when the winner is settled, weeks with nothing at stake,
  teams wiped out early, whether choices or luck decided it.
- **Makes sense:** could a casual player say why they got their points from what the app shows them? Any surprises?
- **Plays well:** dead ends, ties, late joiners, the forgetter (crushed or carried?), a game that doesn't fit its show (Outlast
  on Below Deck), how many taps to set up and how much each week asks.

**P5. Coverage, and keep going.** Second and third seasons, more of the matrix, the words corpus again when G1 changes the
request, and the replays through A2's spec engine once A2 is on master.

## Rules for this lane

- **Its own folder, database and port.** Never another lane's folder (the main one, `rfl-survivor`, `rfl-engine`,
  `reality-fantasy-leagues-sports`), database or server, and never real accounts or leagues.
- **The local bot is this lane's while it records.** The other lanes' checks use the stand-in (`fake-bot.js`), as the GPT
  plan's rule 7 says.
- **It writes only its own files:** `scripts/dev-test/tapes*`, `playtest*`, `start-a-game-words.json`, this plan and
  `docs/PLAYTEST-REPORT.md`. A bug in a file another lane owns (`state-logic.js` and the game spec are the engine lane's; the
  rulebook compiler, `db/episode-research.js` and the formats are the survivor lane's) goes in the report with its failing
  test or repro, for that lane. HANDOFF.md, BACKLOG.md and the GPT plan change at merge time.
- **Migrations, if any:** 0400-0419.
- **Sessions don't babysit the recorder** (no waiting loops that spend usage): they build on what's recorded and move on.
- Unit tests pass (`npm test`), and `/code-review` on each step's diff before it's committed on `playtest`.

## As built

(Each step adds its own here.)

## Noticed, not fixed

(Each step adds what it saw and left alone, with the step that could take it.)

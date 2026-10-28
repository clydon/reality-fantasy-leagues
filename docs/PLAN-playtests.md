# Season tapes and playtests

For the playtest lane's sessions and the user. Status: planned 2026-10-28, started that night in the playtest lane
(`../rfl-playtest`, branch `playtest`, database `rfl_playtest`, port 3005). P1 built and recording; P2 started (the local bot
was silent from 09:17 to 11:00 UTC on 2026-10-28, its ChatGPT profile capped, and answers again on a fresh one; the corpus records
behind Below Deck 12's quick checks; its judge and report are ready, eleven expected readings fixed, and what G1 should change
written down); P3 parts 1 and 2 built (96 replays of Survivor 49, the Traitors 4, The Challenge 41 and Dancing with the Stars 34,
and the looks at 390; Below Deck 12's full research comes back but its cast is every season's crew: finding 10, corrected); P4
done for the four seasons on tape (taps a week, someone away, the directions tried as variants); P5 part 1 done (the measures
read data; the forgetter's looks at 390); P5 part 2 done (what accepting the bot's held results changes, and who can still win
by each game's own best week); P5 part 3 done (what findings 1 and 6 cost: who left from the quick check); P5 part 4 done (what a
player sees when a game ends, findings 17 to 20; the judge to the game's own end); findings in
[PLAYTEST-REPORT.md](PLAYTEST-REPORT.md).

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
  the repo as Start a game's eval set (`scripts/dev-test/start-a-game-words.json`, since step A5 of docs/PLAN-start-a-game-gpt.md
  the capability tracker's corpus: `tests/fixtures/engine-capabilities.json`), G1's in docs/PLAN-start-a-game-gpt.md.
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
- **It writes only its own files:** `scripts/dev-test/tapes*`, `playtest*`, the tracker's `corpus` (once `start-a-game-words.json`), this plan and
  `docs/PLAYTEST-REPORT.md`. A bug in a file another lane owns (`state-logic.js` and the game spec are the engine lane's; the
  rulebook compiler, `db/episode-research.js` and the formats are the survivor lane's) goes in the report with its failing
  test or repro, for that lane. HANDOFF.md, BACKLOG.md and the GPT plan change at merge time.
- **Migrations, if any:** 0400-0419.
- **Sessions don't babysit the recorder** (no waiting loops that spend usage): they build on what's recorded and move on.
- Unit tests pass (`npm test`), and `/code-review` on each step's diff before it's committed on `playtest`.

## As built

### P1. The recorder (2026-10-28, playtest lane)

**`scripts/dev-test/tapes.js`** (its header says it all) runs the app's own code in its own process: the CommonJS research code
directly, and the TypeScript server through jiti, as the unit tests load it (`@`, `@db`, and `next/server`'s `after()` on
`next-after-stub.js`). No dev server is needed. It asks the local bot only, and refuses a `LLM_BROWSER_API_URL` that names
anything else, or a database that isn't local.

**Commands:**
- `record [--only=<show>:<season>] [--kinds=…] [--pause=60] [--max=N]`: the queue, resuming. It skips what's on tape.
- `plan`: what `record` would ask next.
- `status`: per show and season, the last error, and the journal's tail.
- `one <show> <season> <kind> [<episode>]`: one question now.
- `load <show> <season>`: a tape into a database, with no bot and without touching the tape.
- `unload <show> <season>`: takes out what the tapes made.
- `require("./tapes").answerer(show, season)`: fake-bot.js's `answer` from a tape. It finds the same prompt, else the same kind of
  question about the same episode. Trivia, its check and recaps are `other` to `kindOf`, so for those only the exact prompt is found.

Unit tests: `tests/tapes.test.js` (the queue's order, backing off, the limit detector, names, the journal line, answering from a
tape).

**How each question is asked, all through the app's own functions:**
- **The season:** the show by its TVmaze id. A show that isn't here is added the way the desk's New show adds it (`add-show.ts
  addShow`). The season comes from its listing (`listedSeason`: its row and every episode's air time); a season already here
  keeps its schedule. A set-up show's season gets its rulebook (`db/rulebooks.js ensureSeasonRulebook`). No bot.
- **Rules:**
  - A show that isn't a game yet: Make it a game's question (`make-game.ts makePrompt`), pasted back (`pasteMake`).
  - A set-up show: the desk's Check for changes on the season's rulebook (`desk-rulebooks.ts rulebookPrompt`), reviewed as the desk
    reviews it (`reviewAnswer`, which writes nothing).
- **Cast:**
  - A show that isn't a game yet: Make it a game's cast question (none when the listing has the cast), pasted, then Looks right
    (`confirmMake`).
  - A set-up show: the cast-import prompt (`cast-prompt.js buildCastPrompt` on the season's format, read by `parseCastImport`),
    staged as the season's cast the way the classic admin's pull stages one (`wiki-sync.js stageSeasonCast`).
  - A season whose cast was here already keeps it, and the answer is only recorded.
- **Quick, full, trivia, bingo, and the season's bingo bank:** `db/bot-research.js runJob`, as the desk's Run now runs it but without
  `send`. So a full answer is stored and staged for review (pending), and the next episode's "who's still in" is the app's own.
  Trivia and bingo read pending results up to their episode.
- **Recaps:** `episode-recaps.ts recapPromptFor`, then `pasteRecaps`. zt_tapes follows the season first.
- **Parsed output:** the recorder wraps the parsers runJob calls through their modules (`researchFromPaste`'s own parse before it's
  merged, with its problems and what it staged; `parseTriviaAnswer`, `parseBingoAnswer` and both `parseCheckAnswer`s). It keeps the
  run's whole result too.
- **The bot call** is `ask-bot.ts askBot`'s request (ChatGPT, search on, keepalive), with a longer wait. askBot stops at 285 s for
  Vercel's routes; the recorder waits 420 s (`BOT_WAIT_S`). Traitors 4 episode 1's full research stalled at 270 s on its first
  try and answered in 42 s on the next.

**The tape** is `~\rfl-tapes\<show>\<season>\`:
- `season.json`: the season row, its listing, episodes, cast, compiled rulebook, and the ids the tapes made.
- `season-<kind>.json` and `e<NN>-<kind>.json`, each with `.prompt.md` and `.answer.md` beside it. A record holds `{ kind, show,
  season, episode, prompt, answer, parsed, ok, message, seconds, at, bot, commit, result, tries }`, plus `check` for trivia's and
  bingo's second ask.
- Failed tries are kept as `.try<N>.json`. The third failure becomes the tape (`ok: false, gaveUp`), and the queue moves on.
- Also in `~\rfl-tapes\`: `journal.log` (a line a question) and `state.json` (the backoff).

**The queue** goes breadth first, as decided:
1. Each show's first season, its core.
2. The words corpus (the capability tracker's since A5, once `start-a-game-words.json`). Its runner is P2's.
3. Those seasons' content: trivia and bingo per episode, then the season's bank and recaps.
4. Second seasons, core then content.
5. Third seasons.

A season's episodes wait for its cast. A question gets three tries; consecutive failures back off 5, 15, then 60 minutes. A usage
limit or bot check waits an hour and uses up no try. There's a 60 s pause after each question.

**Seasons** (by TVmaze, 2026-10-28): Survivor 49, 50, 48 (49's 13 researched episodes go on tape as stored, with their
provenance), The Traitors (US) 4, 3, 2, The Challenge 41, 40, 39, Dancing with the Stars 34, 33, 32, and Below Deck 12, 11, 10.
Below Deck came in through Add a show, then Make it a game (a series; its cast from the listing).

**What the app writes.** These rows aren't zt- keyed, by design: they're real seasons, named as the prompts name them, on the lane's
own copy. Only the zt_tapes user (who adds a show and makes it a game) is zt-. `unload` takes out what the tapes made; the copy's
own Survivor 49 is never touched beyond what the app writes when asked about it.

**Checked end to end on the real local bot, before the night's run.** The Traitors 4 season was made from its listing (12
episodes), then:

| Question | Seconds | What came back |
|---|---|---|
| Rules | 33 | read; 37 changes the desk would see |
| Cast | 21 | 23 players, real |
| Episode 1 quick | 16 | "Nobody left", with three sources |
| Episode 1 full | 42 | 23 players; 11 results staged |
| Episode 1 trivia | 34 | 6 of 6 passed |
| Episode 1 bingo | 36 | 18 of 30 passed |
| Recaps | 24 | 12 of 12 |

Below Deck 12 was added, then rules (59 s: a series · reality), then its cast from the listing and Looks right. The recorder
started at 04:43 UTC in its own window ("Tapes: recording"). Survivor 49's setup and its quick checks went first, one a minute.

**The prompt inventory** (every prompt the app sends to the bot or hands someone to paste; files under `db/`, `src/lib/game/formats/`
and `src/lib/server/`):

| Kind | Builder | Parser | About | Sent by | On tape |
|---|---|---|---|---|---|
| quick | `bot-research.js buildQuickPrompt` | `parseQuickAnswer` | an episode (the season's cast still in; Backstage's: one league's) | the bot's runs, Run now, One tap; copy and paste in Backstage | yes |
| full | `episode-research.js buildPasteImportPrompt` → `buildPastePrompt` (structured) | `researchFromPaste` → `parseJsonAnswer`, `validateResearch` | an episode, season-wide (also the tie-break and asked runs; `only: missing`) | the bot's runs, Run now; the admin's paste | yes |
| full, one league | `leagueResearchStatus` | `researchFromPasteForLeague` | one league's episode | One tap; classic's results page | no (a league's: P3) |
| full, prose | `buildPastePrompt` (not structured) | a paid Anthropic `structure()` | an episode | copy only | no (paid) |
| schedule | `bot-research.js buildSchedulePrompt` | `parseScheduleAnswer` | when the next episode airs | the bot's runs | no: a past season's answer is its listing |
| trivia (+ check) | `trivia-research.js buildTriviaPrompt`, `buildCheckPrompt` | `parseTriviaAnswer`, `parseCheckAnswer`, `judged` | an episode and the season so far | the bot's runs | yes |
| bingo (+ check) | `bingo-research.js buildBingoPrompt`, `buildCheckPrompt` | `parseBingoAnswer`, `parseCheckAnswer`, `judged` | the episode coming up, or the season's bank | the bot's runs; the admin's bingo bank paste | yes (`bingo`, `bingo-season`) |
| setup (rules) | `rulebook-research.js buildRulebookPrompt` (a template) | `parseRulebookAnswer`, `reviewRulebook` | a show or season | Make it a game (`make-game.ts`), the desk's Check for changes (`desk-rulebooks.ts`), the test couch, shadow-leagues.js | yes |
| rulebook change | `buildRulebookPrompt` with `change` (`show-changes.ts`) | the same, additions kept | a season from one episode on | the bot, when two couches say "It's new" | no (needs a flagged change: P3) |
| cast | `cast-prompt.js buildCastPrompt` | `parseCastImport` | a season | Make it a game; classic's Import a cast | yes |
| roster | `rosters.ts rosterPrompt` | `readRoster` | a sport's season | Fill in who's playing | no (sports) |
| recaps | `episode-recaps.ts recapPrompt` | `readRecaps` | a season's aired episodes with none | Fill in what happened | yes |
| format proposal | `formats/proposal.js buildProposalPrompt` | `parseProposal`, `reviewProposal` | a show's format | copy only (classic's New show) | no (classic) |
| rule check | `formats/season-check.js buildCheckPrompt` | `parseCheck`, `reviewCheck` | a season's rule changes | copy only (classic admin) | no (classic) |
| team lines | `episode-team-summary.ts buildLeaguePrompt` | `parseLeagueReply` | one league's episode | copy only | no (a league's: P3) |
| start a game | the GPT plan's request (G1) | the resolver (G2) | a typed request | not built | P2 (`rfl-tapes\words\`) |

Not prompts to the bot: `ai-brief.ts briefLine` (the Open in ChatGPT link's wrapper), the tour's `tourPrompt`, each format's
`episodesPrompt` (Anthropic API, tests only), and `runFor` (the paid research APIs).

### P2. The words corpus, started (2026-10-28, the same session as P1)

**The corpus:** `scripts/dev-test/start-a-game-words.json` (moved whole into `tests/fixtures/engine-capabilities.json`'s `corpus` by
step A5 of the GPT plan, each request now typed on a page), 104 requests, each with its expected reading:
- `about`: the show and season, or the sport and teams;
- `when`: the span's kind;
- `game`: the sensible game;
- `said`: what must carry over, with numbers only as said;
- `wizard`: what it should ask;
- `flag`: question or refuse, with why.

It's dated 2026-10-28 (what's airing that day decides some answers). The groups, as the step lists them: the GPT plan's three
examples, casual (10), solo (5), small groups (7), big ones (5), popular shows and sports (7), niche shows (8: a cooking
competition, other countries' versions), very customised (8), sports (8), shows that aren't competitions (6), spans (6),
predictions only (5), typos and slang (6), two games in one message (3), contradictions (5), nonsense and an injection attempt
(6), and seasons that don't exist (6).

**The runner:** `scripts/dev-test/tapes-words.js`. Its request prompt is a **draft**, labelled as one, because the app has no
request prompt until G1:
- it's the GPT plan's request shape;
- it gives today's date;
- it fences the words as a description, never instructions;
- it asks for no web search.

It parses and judges each reading:
- the show, by the app's own `listing.ts sameShow`, so another country's version doesn't count;
- the season and the span;
- no number invented (number words and commas count as said);
- an expected question or refusal shows as something unsure.

What wasn't said must come back empty. `tapes.js` asks the corpus as the queue's round 2 (`one words <id>` for one). `status`
judges every words tape again with today's judge. A reading that's off is still the tape and isn't re-asked.

**Asked so far:** w002 (the Red Sox series: baseball, both teams, "series", draft 3 each, both scores, nothing invented) and w084
("5 each, everyone gets 3": draft 5, start 3, and "everyone gets 3" in unsure). Both read as expected.

**Left for P2's next session:**
- the rest of the corpus, which the recorder asks after the first seasons' core;
- the table here of how well it understood, by group;
- whether the expected readings need changing once the bot's are seen (they're a first draft too).

### P3. Replays, part 1 (2026-10-28, playtest lane)

P2's corpus wasn't on tape yet (2 of 104 at 05:00 UTC: the recorder asks it after every show's first season's core), so P3 came
first. **`scripts/dev-test/playtest.js`** (its header says it all) plays a recorded season through today's engine, all through the
app's own code loaded with jiti (no dev server):

- **The season** is a zt- copy (show slug `zt-pt-<show>`, the same name, format, rulebook and cast). The recorder's tapes keep
  writing to the real rows, and the lane's copy of Survivor 49 has a league of its own, so the copy keeps both untouched.
- **The copy is the real season moved forward whole weeks** (to start about a week from today, weekdays and same-night double
  episodes kept), and every date inside its recorded answers moves the same (`shiftAnswer`: `airDate`, `nextEpisode.airsAt`).
  - Nothing has aired by the clock, so an episode closes when its results land.
  - A waiver week runs until whoever runs the game says Run now.
  - Start a game's `now` (an hour before an episode) starts a game at any episode.
  - The bot's own same-night check still reads an answer against the schedule: Traitors 4 premiered with three episodes on
    one night.
  - It's marked airing (Start a game refuses a finished season).
- **A cast nobody approved** is approved on the copy, as classic's Approve would, and each replay's log says so. Traitors 4's
  was staged by the recorder (P1's Noticed).
- **Each game** goes through:
  - Start a game (`startGame`, on a couch of its own, Tell the couch off; three Normal computer players for a solo group);
  - everyone else through Join (`joinGame`; Ask me first is asked and let in);
  - ownership through classic's League Settings (the new design has no choice for it);
  - team and lineup sizes through Backstage's Game settings (`settingsWrite`), waivers off through Fine-tune (`waiverWrite`);
  - the draft through the draft room's own writes (`startDraft`, `pickInDraft`, `lockBlindFor`);
  - a late joiner through Join with a team from Join's own pool (`joinOptions`).
- **Each week's moves** are the lineup and pick routes' own writes under `withLeagueLock`, then waiver claims (`saveClaim`)
  and Backstage's Run now.
- **Each episode's results** come from the bot's own run: `runJob` quick, then full, with `bot-results.ts` `botSend`, which is
  Autopilot. Its answers come from the tape (`tapes.answerer`), so what reaches every game is the season sync's own.
- **Survivor 49's stored answers** (production's, pasted under an older prompt) lack fields today's schema requires
  (`sourcesRead` and others). `upgradeStored` adds them, empty, so the app's own parse reads them. Nothing they said changes.

**The players** are zt_pt_ accounts named by role. Their habits are deterministic: a role's share of weeks, spread evenly, and
taste by castaway name.
- **Tinkerer**: runs every game; the sharpest read every week; claims on waivers.
- **Forgetter**: misses the draft, so whoever runs it picks for them, first on the list. Remembers one week in three.
- **Drive-by**: first on the list for everything; sets a lineup once, then only when it's short.
- **Fan**: favourites, every other week.
- **Reader**: a solid read; skips one week in ten.
- **Contrarian**: never the room's top third.
- **Steady**: solid, every week.

Bigger groups add more forgetters and drive-bys. A late joiner is the group's last seat. Computer players' own picks hash
castaway ids (`bot-logic.js` taste), so they vary between runs; the people's don't.

**The matrix** is a greedy pairwise set over game (Outlast, Weekly Lineup, Survival Pool), ownership, size (small, standard,
big), span (season, from a third in, one episode, from the merge, through half), late joiner, waivers and group (1, 2, 4, 8,
16).
- Settings that don't apply are left out: a pool has no teams, a one-episode game has no late joiner, a season with no merge
  has no merge span.
- Every pair that can go together is played once. That's 27 replays for Survivor 49 (the merge read from the tape: the
  first episode anyone won immunity alone, 6) and 22 for Traitors 4, instead of 965 and 740.
- "standard" is whatever Start a game gives. small and big are what someone sensible would pick: big on a one-team-each game
  is cut to what the cast still in can fill, and the log says so.
- Waivers mean Start a game's own: shared games have none ("This game doesn't use waivers").

**Commands**: `matrix <show> <season>` (the set and why), `run <show> <season> [--only=] [--through=] [--keep]` (down first, and
again after unless `--keep`), `summary` (a line per replay, also `replays\SUMMARY.md`), `down`. A season runs in about 80 s.
Unit tests: `tests/playtest.test.js` (the matrix covers every pair and is stable, what doesn't apply, names, seats, habits' weeks,
preferences, the merge, spans, the answer shift, the stored-answer upgrade, the summary's line).

**What's on file** (`rfl-tapes\replays\`, 49 replays and SUMMARY.md): Survivor 49 and The Traitors (US) 4, every replay
through its last episode. Each keeps, per episode:
- who went home;
- the table (labels, never usernames);
- the leader and lead changes;
- ties;
- teams with nobody left;
- each seat's move ("set", "kept (carried)", "no lineup (forgot)", "picked X");
- points and why (a lineup's starters with each scoring moment, the bench's what-ifs, and what the app tells the player:
  `episodeTeamBullets`; a pool's pick and whether it survived; an Outlast team's who's out);
- a rough "still in it";
- the results' messages and waiver claims and runs.

The draft is kept per seat ("picked for them" for the forgetter).

**What the replays found** (details, repros and owners in [PLAYTEST-REPORT.md](PLAYTEST-REPORT.md)):
1. **No season-long game ever ends.** Every finale's full answer, on all three seasons recorded so far (Survivor 49 stored,
   Traitors 4 and Challenge 41 asked with today's prompt), leaves the winner and finalists in the game. The quick check gets
   them right (Savannah "Sole Survivor", Rob "Winner"). On Autopilot the full answer replaces the quick's, the winner's exit
   is removed, `seasonWinner` finds nobody, and every game says it isn't over. The Noticed item below (the quick check
   reporting every finalist as gone) was the right answer: leaving with the winner's exit is how a season crowns someone.
2. **The bot's own quick and full answers disagreeing on how someone left holds the exit forever** on a season nobody else
   answers. Survivor 49's Rizo: quick "Other", full "Lost Fire-Making"; he stays in every game.
3. **Medium-confidence answers never reach a game the bot alone answers.**
   - Traitors 4: 58 of 169 castaway answers, holding 80 of 247 scoring events.
   - Challenge 41: 203 of 431.
   - Survivor 49's stored answers were all high.
4. **Outlast with more people than castaways still in can't finish its draft.** Start a game offers it; the draft stops with
   nobody able to pick (three 16-person Survivor 49 games).
5. **Outlast over a short span ends in a mass tie** (one episode: 7 to 15-way ties; through half: 10-way). Nobody's people
   have left yet, so nothing tells the teams apart.

**Left for P3's rest:**
- the looks at 390 (as a player, after the draft, mid-season and the finale: `run --keep --through=N` leaves a replay's games
  standing);
- the next seasons as they're recorded (The Challenge 41 is complete; Below Deck 12, a series, needs its own game list:
  Survival Pool and Outlast don't fit);
- Weekly Calls and Weekly Bingo, which need a talk show.

Then P4 judges the replays.

### P3. Replays, part 2 (2026-10-28, playtest lane)

P2's corpus still wasn't on tape (2 of 104 at 07:15 UTC; the recorder reaches it after Below Deck 12's core, about 08:40), so P3's
rest came first. **What changed in `playtest.js`:**
- **Each season plays only what Start a game offers it** (`gamesOf`, `dimsFor`: `rulebook-fits.js gamesFor` on the tape's
  rulebook, the games that fit and can start). The Challenge 41, Survivor 49 and the Traitors 4 get all three; Dancing with the
  Stars 34 gets Outlast and Weekly Lineup (its rulebook has no one going home each episode: finding 9); Below Deck 12, a series,
  gets Weekly Lineup only, 20 replays covering every pair of the rest (`matrix below-deck 12`). No special case for a series:
  it's the app's own rule.
- **The copy plays by the season's own rulebook.** The app reads a season's rulebook by the season's id (`rulebooks.js
  seasonRulebook`), and the copy had none, so Start a game on it could read another (the format's). `copySeason` now copies the
  real season's rulebook to the copy (`copyRulebook`, owner the copy; it goes with the show at `down`), and the matrix is worked
  out from that copy.
- **Waivers on means on.** Start a game leaves every game's waivers off (finding 7), so P3 part 1's "waivers on" replays had
  none. The tinkerer now picks Balanced in Backstage › Waivers before the draft (one more of `settingsFor`'s writes). A refusal,
  or waivers off again after the draft fits them to the teams (no free agents), is a problem in the replay, so a replay never
  claims waivers it didn't have. Shared Outlast has no waivers at all, so waivers don't apply to it in the matrix.
- **`exits <show> <season>`**: who left by the quick check and by the full research, per episode, and where they disagree
  (`exitsOf`, names matched to the cast as the app matches them; also `replays\exits-<show>-<season>.md`). It's how finding 6
  was found.
- **`run --before=N`** stops with episode N's games started, drafted and its moves made, before its results (the look after the
  draft). A part of a season (`--before`, `--through`) is written to `replays\partial\`, never over the whole replays or into the
  summary. `--keep` now sets the copy's clock to the moment it stopped (N airs in two hours, or the last episode aired 12 hours
  ago; the schedule's own time for it, every row, the drop and the premiere moved together) and prints each replay's couch: the
  replay runs with every episode still to air, so a look without it said "Ep 1 · in 8 days" with three episodes' results in.
- A run whose matrix (or `--only`) leaves nothing to play stops before filing a season of results.
- **`scripts/dev-test/playtest-looks.js <label> [--pages=] [--width=]`**: signs in as the tinkerer on the lane's server, picks
  each kept replay's couch as the switcher does (`gys.couch`), and screenshots each page of the show space full length into
  `rfl-tapes\replays\shots\` (never committed), with any console errors.

Unit tests (`tests/playtest.test.js`): the games a rulebook fits (a competition, one with no one going home, a series, none) and
the pairwise set over a series' games; shared Outlast without waivers; who left by each answer (agree, disagree, one side not on
tape yet, curly quotes, accents, a first name and a hyphen as one person, a stored answer's own JSON).

**The replays now on file** (`rfl-tapes\replays\`, 96 and SUMMARY.md): Survivor 49 (30), the Traitors 4 (22), The Challenge 41
(22) and Dancing with the Stars 34 (22), every one to its last episode with waivers on where asked. A season replays in 70 to 90
seconds. The matrix changed (shared Outlast's waivers), so part 1's replay numbers moved: the report's repros give today's.

**What a new show broke in the harness:** nothing. The Challenge's pairs are people in the cast like anyone else (a pair leaving
together is two exits), and a season with no merge already drops the merge span. Dancing with the Stars' 14 celebrities make the
16-person drafts dead-end (finding 4). What the new shows found is in the app and its research: findings 6 to 9 in
[PLAYTEST-REPORT.md](PLAYTEST-REPORT.md), and more evidence for 1 to 5.

**The looks at 390** (the Traitors 4, before the matrix changed: a Weekly Lineup from episode 4 for 4 people, one team each
with waivers; a whole-season Survival Pool for 4; an Outlast for 8; as the tinkerer; Tonight, Games and Episodes at each
moment; `rfl-tapes\replays\shots\`):
- **After the draft** (`--before=4`): Tonight leads with "You're set for Episode 4" and the countdown, episode 3's result card,
  and the Weekly Lineup card "T1 · 0 pts". Games has the four level at 0 and "All set for Episode 4" with the three starters.
  Reads right.
- **Mid-season** (`--through=7`): "Set your lineup · 1 open slot" (a starter went home at 7, the app took them out), 1st on
  21.5; Outlast's table with each team's people and who's out dimmed; the pool's table with each pick so far. Reads right.
- **The finale** (all 12): finding 1 as a player sees it. "Season over" in the bar; the Outlast card says "1st · 1 of 2 still
  in"; nothing names a winner; the Weekly Lineup table says what it says every week.
- No console errors on any page.

**The recorder, changed and restarted** (07:57 UTC, pid 43768): Below Deck 12's episode 1 full research timed out twice at 420 s
(a 47,533-character prompt for its crew of 40: finding 10). Three tries with the backoffs after each, for every episode, would
have held the words corpus for about a day. So a season whose full research gives up with no answer now holds its other
episodes' full research (`tapes.js fullHeld`; `status` says so, and deleting that episode's `e<NN>-full.json` asks again), and the
queue goes on: Below Deck's quick checks, then the words corpus. Unit test in `tests/tapes.test.js`.

**Left for P3:** Below Deck 12, once its cast is the season's crew (finding 10): its full research, then `run below-deck 12` (20
Weekly Lineup replays) and a look. With only quick checks on tape, a Weekly Lineup on it scores nothing, so a replay now would
only show that. Weekly Calls and Weekly Bingo, which need a talk show. Second seasons as they're recorded.

### P4. Reviews, a first pass (2026-10-28, the same session as P3 part 2)

**`playtest.js judge`** measures P4's questions over the replays on file, per game, for all shows and each (`judgeOf`; also
`replays\JUDGE.md`): whether the game says it's over, lead changes, how far in the winner took first place for good, a tie at
the top, quiet weeks (nobody's points or streak moved), teams wiped out before the end, where the tinkerer and the forgetter
finished, replays with problems, and Weekly Lineup starters who scored with no reason to show (the reveal's `why`). Unit test in
`tests/playtest.test.js`.

**The first pass** is in [PLAYTEST-REPORT.md](PLAYTEST-REPORT.md) ("P4, a first pass"), from the 96 replays: Weekly Lineup plays
best (choices decide it, every score explained) but crushes the forgetter; Outlast has the most suspense and the least to
decide; Survival Pool never changes leader and ends tied or with the forgetter last. Each with a direction and who could take it.

**Left for P4:** Below Deck once it has full research; taps per week; the forgetter's "first on the list"; second seasons.

### P4's rest, and P2's judge and report (2026-10-28, playtest lane)

The words corpus was still 2 of 104 on tape (the recorder gave Below Deck 12's episode 1 full research up at 08:17 UTC and
backed off an hour; Below Deck's quick checks, then the corpus, come after), so P4's rest went first, without the bot.

**What changed in `playtest.js`:**
- **What each week asks.** `moves` and `waivers` record per seat and episode `asks`: whether the app showed a move to make (a
  lineup with an open slot, a pick not made, a replacement owed) and the taps the move took (`TAPS`, counted from Tonight's
  card on the new design's screens: `lineupTaps`, `claimTaps`). `judge` adds a table, "How much each week asks", by game and
  role (`asksOf`), and counts weeks someone set no lineup and the app still praised their calls (finding 11).
- **Variants** (`run ... --away=favourites`, `--window=merge`, `variantOf`): habits changed from the whole set's, playing only
  the replays they change (`changedBy`: away needs a draft and a forgetter who drafts, so not a pool and not a group of two
  whose forgetter is the late joiner; both flags together play what either changes) into `replays\variants\<variant>\`;
  `compare <variant>` puts each beside the whole set's replay of the same name (`compareOf`). `--away=favourites`: someone away from the draft gets the room's favourites
  (`favourites`: what the app knows, then the others' own picks), not the first on the list. `--window=merge`: whoever runs
  an exclusive Outlast game opens one waiver window after the merge (a season with none: its middle episode), "Swap anyone"
  (`openWindow`); each waiver week now records who had nobody left before it ran and who got someone back.
- **Directions worked out from the replay files alone**, as `judge` columns: Weekly Lineup's open slots filled from the bench
  in draft order (`defaultLineupOf`), a pool's missed picks made for them or the streak frozen (`poolFallbackOf`; its recount
  of the streaks as played is checked against the app's table: all 12 pools match), Outlast's ties broken by the most still in
  (`stillInBreakOf`).
- **`says <episode>`**: on kept replays, each seat's lineup and what the app says to them about the episode (finding 11's repro).

The 96 replays were played again first (about 80 s a season), then the two variants (60 and 20 replays); after the code
review's fixes, all three again from clean folders. Unit tests
(`tests/playtest.test.js`): the room's favourites, taps, variants and what they change, the asks measure, the default lineup,
the pool's made-for-you pick and frozen streak, the still-in tie-break, and the compare.

**What P4 found** (details, numbers and repros in [PLAYTEST-REPORT.md](PLAYTEST-REPORT.md), "P4's rest"):
- **Taps a week:** Outlast nothing after the draft, Weekly Lineup 2.3 (a card in a third of weeks; the tinkerer 3.2 and near
  the top, the drive-by 1.2), Survival Pool 2.2 with a card every week for everyone (3 taps, 39 a season).
- **Findings 11 to 14:** the app praises a lineup nobody set; Survival Pool's missed week (freeze the streak: 86% → 69%; a
  made-for-you pick, 86% → 33%, is too generous); Weekly Lineup's forgetter loses to open slots, which filling from the bench
  would fix (67% → 20%); someone away from the draft should not get the favourites (Outlast from mid-season: 53% → first).
- **Directions tried:** an Outlast window after the merge cuts the weeks teams sit wiped out by a fifth (265 → 206, only where
  free agents are left) and changed the winner in 9 of 17 (loosely: autofill is a random draw); "most still in" breaks 1 of
  Outlast's 36 tied ends. And a correction: on a small group Outlast's waivers are weekly replacements, not only windows.

**The forgetter's draft stays "first on the list"** in the harness: P3's question is answered (finding 14).

**P2's judge and report, while the corpus waits** (`tapes-words.js`):
- **The judge checks what carried over** (`carried`, `carriedOf`): each part of `expect.said` the draft request shape has a
  place for (named, players, each, start, order, own, the scoring lines' points, the questions, a line, the unsure bits) must
  come back in it; `missed` names what didn't. The rest of what the corpus says (computer, public, finale, repeat, ties, bench,
  waivers, from, to) has no place in the draft shape: for G1 to add. `status` re-judges every tape with it.
- **`node scripts/dev-test/tapes-words.js report`**: P2's table from the tapes, by group (on tape, checks as expected, misses
  by check) and each miss quoted with what was read (`reportOf`, `reportMarkdown`; also `rfl-tapes\words\REPORT.md`). Unit
  tests in `tests/tapes.test.js`.
- The request prompt is unchanged (G1's draft). The two on tape (w002, w084) read as expected, 11 of 11.

**Left for P2:** the table once the corpus is on tape (`tapes-words.js report`), the expected readings to fix and the judge to
tune from it, and what G1 should change. **Left for P3 and P4:** Below Deck 12 (finding 10: its cast staged by hand once the
corpus is on tape, then its full research and 20 replays); second seasons as they're recorded.

### P5, part 1: the measures read data, and the forgetter's looks (2026-10-28, playtest lane)

The words corpus was still 2 of 104 on tape at 08:50 UTC (the recorder backing off until 09:17 after Below Deck 12's episode 1
full research gave up), so P5's first Noticed item and the looks for findings 11 and 13 went first, without the bot.

**Ids, points and flags beside the words** (`playtest.js`). Each replay still writes its words for reading, and now the same as
data beside them:
- an episode's `left` (who went home: `{ id, name, method }`) beside `out`, and `did` (each seat's move: `{ kind: "lineup" |
  "pick", act, ids }`, act set, looked, kept, carried, forgot, refused, picked, notTaken, nobodyLeft or noEpisode) beside
  `moves`;
- a Weekly Lineup line's `starters` (`{ id, name, points, items }`), `benched` (everyone on the bench, those who'd have scored
  nothing too) and `saysKinds` (the reveal lines' kinds: perfect, best, costly, benchSaved) beside `started`, `bench`, `says`;
  a pool line's `picked` (`{ id, name, correct }`) beside `pick`; an Outlast line's `members` (`{ id, name, out }`) beside `team`;
- the record's `drafted` (each seat's picks, `{ id, name, forThem }`) beside `draft`;
- a waiver week's `pairs` (each seat's claim) and `moved` (what ran: `{ seat, addId, dropId, via }`) beside `claims` and `ran`.

The measures read them through small readers (`leftKeys`, `startersOf`, `benchOf`, `pickOf`, `stillInOf`, `praisedOf`,
`poolMoveOf`, `forgotLineup`, `draftedOf`), each the data when a file has it, else that file's words, read as before. A castaway
is a key either way: its id from the data, its name from the words. `defaultLineupOf`, `poolFallbackOf`, `stillInBreakOf`,
`asksOf` and `judgeOf`'s silent count use them. `compareOf` already read `byHand` before the log's words.

**Checked three ways:**
- On the files from before (words only), `judge` and both `compare`s wrote JUDGE.md and COMPARE.md byte for byte as they were.
- The 96 replays and both variants (60 and 20) were played again (about 10 minutes, no bot), so every file on record has the
  data. Each measure was then read from the data and from the same file with the data stripped (a scratchpad one-off): every
  measure on all 176 is the same both ways but one `weeks` count. The data's bench lists everyone, so a week whose open slot
  only a 0-point pickup could fill now counts as covered; points and places are unchanged. `judgeOf` over all is the same.
- A unit test reads a replay in data form (ids that aren't names, a name with a number in it, which the words would read
  wrongly) and gets what the words tests get.

The second run moved `judge`'s numbers by the computer players' variation between runs (JUDGE.md has today's): Weekly Lineup's
covered forgetter 67% → 29% (P4's run: 20%), the tinkerer's median finish 13% → 0%. The away-favourites comparison came out the
same as P4's (Outlast to the end from mid-season: 53% → first, first or level in 6 against 3).

**The looks at 390 as the forgetter** (`playtest-looks.js`, now `--as=<seat>`, `--reveal=N`, `--moves`). The replays mark
every episode watched for everyone, and the app never moves a player's mark back (`follows.ts setFollow`), so `--reveal=N`
first puts that seat where someone who has watched through N - 1 is, in both designs' marks (`watchedThrough`: its follow of the
kept zt- copy with `finished_at` kept as follows.ts keeps it, and its `results_seen_through` on the kept games), before each
couch's pages so every couch's shots start from the same place. Then it taps Reveal Episode N on Tonight and screenshots each
beat. `--moves` opens Tonight's Set lineup. What they showed (details and repros in
[PLAYTEST-REPORT.md](PLAYTEST-REPORT.md)):
- **Finding 11, corrected.** The praise for a lineup nobody set is only in classic's team-lines prompt (`buildLeaguePrompt`'s
  "Notable:", for an AI chat). The new design's reveal of the forgotten episode says "Nobody started this episode · 0" and the
  table, honestly, but not what forgetting cost.
- **Finding 13, as the forgetter sees it:** "Set your lineup · 1 open slot" on Tonight, and the sheet with Steven on the bench
  (15.5 points) beside the open slot, two weeks running.
- **Finding 4, as a player sees it:** a draft that dead-ended at pick 15 leaves "Your turn to draft" at the top of the
  forgetter's Tonight every week after, and the late joiner on 0 with no team.
- **Finding 15 (new, low):** the Games page heads every Weekly Lineup "Start your best three each week", whatever its lineup
  (4 here).

**A harness bug the looks found, fixed:** `run --keep` set the clock on Survivor 49's copy wrong. That season has no listed
episode rows (its times come from the premiere and its air time), and the premiere moved by a rounded number of days, so
"episode 10 airs in two hours" put it in the past: locked, no Set lineup card. Such a season's premiere now moves by the days
that keep the episode ahead (`--before`: within a day) or aired (`--through`), and the run says how far it is ("airs in 14.8
hours"). The reveal's table beat moves from before to after at 700 ms, so the looks now wait 1.5 s a beat before the screenshot.

Unit tests (`tests/playtest.test.js`): the measures over a replay in data form. `npm test` passes (794).

### P2, part 2: the bot stopped answering; the corpus fixed where it contradicts its own rule; what G1 should change (2026-10-28, the same session)

**The bot stopped answering at 09:17 UTC.** The recorder came out of its hour's backoff at 09:17 and got Below Deck 12's episode 2
quick check in 18 s, then nothing: episode 3's quick check had no reply in 420 s at 09:25 and again at 09:37. A three-line words
request (`tapes.js one words w001`, asked in the recorder's 15-minute backoff to tell a stalled prompt from a silent bot) had no
reply in 420 s at 09:45 either. `/health` says ok, ChatGPT open and busy while asked; its last answer was 09:17:43. The lane
doesn't restart or change the bot (C:\Users\conor\llm-browser-api), so it's for the user. The recorder keeps backing off (5, 15,
then 60 minutes; a question that fails three times is given up and the queue moves on) and picks up when the bot answers again.
A given-up tape is asked again by deleting its `.json` (`status` lists them). It was restarted in its backoffs with this part's
`tapes.js` and `tapes-words.js`, at 09:27 and again at 09:50 UTC (pid 44428, window "Tapes: recording").

**P2's table, as far as it's on tape:** 2 of 104 (w002, the Red Sox series, and w084, "5 each, everyone gets 3"), 11 of 11 checks
as expected, no misses (`node scripts/dev-test/tapes-words.js report`, `rfl-tapes\words\REPORT.md`). Left: the other 102, then
the table by group with the misses quoted, from the same command.

**Expected readings fixed** (`start-a-game-words.json`), where the corpus contradicted its own rule and the draft prompt's ("the
season as a number when they said one"; the judge's "what wasn't said must come back empty"), whatever the bot answers:
- **Ten implied seasons** (w064, w066, w068, w069, w071, w072, w073, w074, w083, w102: "tonight's", "this season", "the finale",
  "next two weeks", or no season at all) expected the season on now ("51", "5", "35", "13"). The request carries none: the bot has
  no web search and can't know what's on, and picking the season on now is the resolver's (G2, from TVmaze). Their
  `about.season` is null now and the season moved to a new `expect.resolves` (`{ season, why }`), so the resolver's answer isn't
  lost. The corpus's header says so. w010 ("tonight's traitors") and w013 ("the Traitors this season") already expected no season
  and got their `resolves` too. The report's expected line shows it, so a reading of "51" for "tonight's" reads as the request
  shape's rule, not a wrong answer.
- **w098** "survivor 50 league, starting next week" expected `when: next` (the next episode only). "Starting next week" runs from
  then on: `from` (the prompt's "from an episode or a moment on"), as w065 "starting after the merge" and w087 "starting episode
  3" read.

**The judge** (`tapes-words.js`): `assumed` lists the choices of how picks are got that the bot filled in and nobody said
(`order`, `own`; said is the corpus's `said` or the words naming the value, "blind"), from w002's tape (`own: "exclusive"` for "a
draft where we draft 3 players each"). Not a miss: the prompt lets in what they "plainly meant", and a sports draft is usually
one each. The report lists them under "Assumed". And `tapes.js status` now judges the words tapes as `report` does
(`statusLine`, over `reportOf`: the corpus's words and expected readings). It used each tape's stored ones, so a fixed reading
would have read differently in the two. Unit tests in `tests/tapes.test.js`.

**What G1 should change in the request** (the draft's shape is the GPT plan's; the corpus says what it has no place for). Each
is a field of the spec already, or one the resolver needs:
1. **The span's bounds:** `when.from` and `when.to`, an episode number or a named moment (merge, finale). Today `when` has a kind
   and the words only. w044 "from episode 7", w065 "after the merge", w067 "episodes 8 through 10", w087 "only the finale, starting
   episode 3" (a contradiction G1 can only see with both bounds). w101 "points only count once your castaway makes the merge" is a
   condition on scoring, not the game's span: the spec's `count` with a phase (A3).
2. **Who plays, beside how many:** `game.with`, friends, the computer or anyone: w014 "against the computer", w015 "me vs
   everyone".
3. **A pick's repeat rule:** `game.get.repeat` (never, cycle), the spec's own: w047 "can't pick the same person twice".
4. **The bench as said:** `game.count.bench`: w050 "a bench of 2". The spec's bench is what's drafted less who starts, so the
   request carries the words and the resolver works out the draft.
5. **The extras as said:** `game.extras` (waivers, trades, finale, and `rank`'s ties): w050 "waivers every tuesday, no trades",
   w047 "ties split", w046 "double in the finale".
6. **A doubt that says which:** `doubt: { kind: question | refuse, why }` beside `unsure`. With only `unsure`, a contradiction
   (w084 to w088), a past game (w003), a season that doesn't exist (w095 to w099) and something no data can settle (w054's MVP
   pool, w090's weather, w093's injection) read the same, and the judge can only check that something's unsure. 40 of the 104
   expect a question, 7 a refusal.
7. **More than one game:** `also: [request]`: w081 to w083 ("a survivor draft and also a traitors pool"). Today the second game
   has nowhere to go but `unsure`.
8. **Choices not said stay null,** said plainly in the prompt: w002's `own: exclusive`. Or the resolver shows them as defaults it
   chose (the wizard's "what we chose reads as ours"), which is what `assumed` is for.

The corpus's `expect.said` keys for these (computer, public, finale, repeat, ties, bench, waivers, from, to) are what the judge
would check once G1 gives them a place (`tapes-words.js CARRIED`).

### P5, part 2: what the held results cost, and who can still win (2026-10-28, playtest lane)

**The bot was still silent** (its last answer 09:17:43 UTC; `/health` ok). The recorder (pid 44428, window "Tapes: recording")
gave Below Deck 12's episode 3 quick check up at 10:00 UTC after a third 420 s silence and paused an hour; the words corpus is
still 2 of 104. So this part is P5's bot-free work. Delete `below-deck/12/e03-quick.json` once the bot answers, so it's asked
again.

**`run ... --results=accepted`** (`playtest.js`, a variant into `replays\variants\results-accepted\`): after each episode's
results land, whoever runs each game in play (the tinkerer) opens Backstage › Results and accepts what the bot's results held,
as `src/new/backstage/results.tsx` does it, through the app's own functions:
- Show me: `backstage.ts backstageRead` with `show`;
- It's right on a quick check that waited (its names that match the cast, or "nobody" when it named nobody): `applyChosen` with
  `quick` and `wait`. It's offered only when a name matches (else it's Not right and entered by hand, which isn't accepting:
  the replay notes it). Backstage shows a wait only while nobody's results are in, and the full research files right after
  the quick check, so on these tapes it never showed;
- every result that waits, ticked and applied: `applyChosen` with their ids.

A ticked result is a source of its own (the tinkerer's), so with the bot's it's two that agree: confirmed, it reaches every game
on the season. The first couch to look takes the held results for everyone, and the season's record keeps who accepted what
(`tape.results[].accepted`). Each replay keeps its own: `accepted` on the episode, the review's taps on the tinkerer's `asks`
(`TAPS` review 2, confirm 2, a tick each), a line in the log.

**The copy's clock.** Nothing has aired on the copy (an episode closes when its results land), and Backstage reviews only an
aired episode. So once an episode's results are in, the copy's clock puts it a minute behind now while every couch looks, then
puts it back (`clockTo`, `clockBack`; `--keep`'s clock moves now use them too). An episode whose time comes from the premiere
moves by whole days, so `clockTo` checks where it landed and moves it a day more if it's on the wrong side (a rounding, or a
clock change). The app restamps air times on every read and write, so nothing after sees the move. If Backstage offers another
episode, the replay records a problem rather than skipping quietly.

**`--results=autopilot`**: the whole set's own way, played again into `variants\results-autopilot\`. It's the floor under
every comparison: what changes between two runs with nothing changed.

**`compare <variant> [--base=variants/<v>]`** now opens with a table by game (`compareByGame`): winners changed, the median
change in the table's points, in how many went home, the games that say they're over, and "gone, still played". That last is
`ghostsOf` over `seasonExits`: someone who went home by one set's answers and never by the other's, drafted after they'd gone
(every team, computer players' too, and a late joiner's from Join's pool: each record now keeps `joinedWith`), started, picked,
or still on a team at the end. A results variant's rows add points, who went home in only one, and what was
accepted. `--base` writes `COMPARE-<v>.md` beside `COMPARE.md`.

**Who can still win** (`inItOf`, P3's Noticed): from each game's own best possible week, not the best week anyone has had. The
leader could score nothing more, so a seat is in it if what it could still add reaches the leader:
- **Outlast:** a point per elimination for each of its people still in. To the season's end, everyone still in but one goes
  (`look` now records `stillIn`); a game that ends sooner, the most in one episode so far times the episodes left;
- **Weekly Lineup:** its team as it stands, each person at their best episode so far, the best `activeSlots` of them (rough,
  not a bound: a finale's bigger points can beat it);
- **Survival Pool:** a streak that can still catch the leader's, as before.

Episodes left run to the game's own end (Start a game's, which the rough count reads too).

`judge` adds "In it at half" and "In it at three quarters" (the mean share of the table, rough → own; the median is everyone at
the half in nearly every game).

**Played** (no bot, about 75 s a season): the four seasons on tape with `--results=autopilot` (96 replays), then
`--results=accepted` (96). After the code review's fixes, the whole set and both variants again from clean folders (about 12
minutes), so every record has `stillIn` and `joinedWith`. Then `compare` both against the whole set, accepted against autopilot,
and `judge` on each. The numbers here and in the report are that second round's.

Unit tests (`tests/playtest.test.js`): the results variants and the review's taps; who can still win in each game (Outlast to
the season's end and sooner, the game's own end) and the judge's columns; the results comparison and its by-game table; someone
gone still played (a late joiner's team, a computer player's draft, a file from before the data). `npm test` passes.

**What it found** (details in [PLAYTEST-REPORT.md](PLAYTEST-REPORT.md), "P5 part 2"):
- **What was held**, per season:
  - the Traitors 4: 85 results in 10 of its 12 episodes, mostly Round Table vote details, 35 in episode 4 alone;
  - The Challenge 41: 16 (13 events, Cara Maria's exit, two "nobody went home");
  - Survivor 49: 1 (Rizo's exit);
  - Dancing with the Stars 34: none.
- **Finding 2's cost.** On Autopilot, 25 of the 96 games drafted after they'd gone, started, picked or kept to the end someone the
  bot's own answers said had left (Rob Cesternino, Cara Maria Sorbello): in Outlast a ghost who never leaves earns a point at
  every elimination, in a pool a pick that can't lose. Accepted: none. Between two runs with nothing changed: none.
- **Finding 3's cost:** Weekly Lineup's points +5% to +25% on the Traitors 4 (median 16%), nothing on Survivor 49 or Dancing
  with the Stars, and no winner beyond what changes between runs.
- **Findings 1 and 6 aren't held results:** nothing a review offers changes them (the same 37 Outlast games say they're over).
- **Correction:** P4's first pass put The Challenge 41's quiet Weekly Lineup weeks (34%) down to finding 3. Accepted, they're
  32%. They're episode 9, the finale's two parts (nothing the rulebook scores) and the reunions.
- **New finding 16:** accepting is a long list of ticks with no "tick all" (39 taps in one Traitors week).
- **Who can still win:**

  | | At the half | Three quarters in |
  |---|---|---|
  | Outlast | 89% | 72% |
  | Weekly Lineup | 81% | 70% |
  | Survival Pool | 94% | 63% (The Challenge 41: 38%) |

  These are the whole set on file. The rough count said nearly everyone at the half.

### P5, part 3: what findings 1 and 6 cost; the bot back; Below Deck's full research held for its cast (2026-10-28, playtest lane)

**The bot answers again.** At 11:00 UTC the main session, with the user's OK, restarted the local bot on a fresh ChatGPT profile:
the old one was capped from 07:43 (no message box; one quick check got through at 09:17). Below Deck 12's episode 1 and episode 3
quick check, given up while it was capped, were moved to `below-deck\12\gave-up-capped-bot\` and asked again: episode 3's quick
check in 13 s, episode 1's full research (47,533 characters) in 52 s, episode 2's in 36 s. So finding 10 was the profile, not the
prompt's length; the report's finding 10 is corrected (what the 40-person listing cast costs is an answer that's nearly empty).

**`castHeld`** (`tapes.js`): a series whose cast came from its TV listing (`season-cast.json`'s `fromListing`, Make it a game
asking no cast question, on a season whose rulebook kind is `series`) holds its questions about its people: full research,
trivia, bingo and recaps (`CAST_HELD_KINDS`). Below Deck 12's cast is every season's crew (40, of whom 3 are on season 12), so
its episodes 3 to 16 would have been asked with the wrong cast and asked again once the season's cast is staged by hand
(finding 10): about half an hour of the bot, which the cap counts. Episodes 1 and 2 stay on tape as the evidence; the quick
checks go on (who left, in the show's own words), then the words corpus. `status` says why it's held and how to lift it
(`CAST_HELD_HOW`: the season's cast staged by hand, below). The recorder was restarted with it at 11:04 UTC between two
questions (pid 64528, window "Tapes: recording"); the code review's narrowing (a series only, and trivia and bingo too) came
after, and the recorder reads it at its next restart.

**`run ... --results=quick-exits`** (`playtest.js`, a variant into `replays\variants\results-quick-exits\`): each episode's full
research filed as the report's directions would, who left from the bot's quick check that episode and everything else from the
full research, so at each finale the quick check's winner and finalists are kept (findings 6 and 1). `fileResults`' `ask` keeps
the quick check's answer as asked, reads it as the app does (`bot-research.js parseQuickAnswer`), and reshapes the full answer
before `runJob` files it (`quickExits`, pure); the tape isn't touched. Exactly what it changes:
- **Who left:** someone the quick check names whom the full research has staying (or "unknown") leaves as `bot-results.ts
  botSend` files a quick check: `results-changes.ts quickVerdict`'s method (the show's words, else "Other"), confidence "high"
  and its sources beside the entry's own. Confidence is the entry's, so its other "yes" answers go to high with it (`raised`:
  on these tapes only Nia Moore's "nominated" at 3, which scores nothing once she's left). Someone the full research has leaving
  whom the quick check doesn't name stays (`leftTheGame` "no", no method). A quick check that found nothing (or none asked, or
  one the app can't read) leaves who left as the full research has it. One that names someone the prompt doesn't ask about
  isn't a whole account: its matched names leave and nobody's turned back. One that says nobody left is taken at its word
  (the direction), though the app holds it as a doubt on its own: the Challenge's episode 11, where Leo and Will stay.
- **Not how:** someone both name keeps the full research's method and confidence, so an exit the two word differently (Rizo
  Velovic, Cara Maria Sorbello: finding 2) is held as before. That keeps this variant to findings 1 and 6; `--results=accepted`
  measured 2.
- **The answer fits its prompt:** an entry for exactly who the app's prompt asks about (`episode-research.js pasteSkeleton`'s
  entries, from `resolveSeasonResearchContext`, as `runJob` builds the prompt), a name as asked first, then the app's
  forgiving match (`findCastawayByName`). Once a replay's exits differ from the recording's
  (Nia Moore out at 3, not 9), the prompt asks about other people than the tape's answer covers. Someone still in here who'd gone
  by the recording gets the prompt's own non-committal entry, staying in ("added"), else `validateResearch` refuses the whole
  answer for a missing person. An answer about someone gone here is dropped (the app wouldn't have asked). A one-off check
  (`asked-vs-answered`, not kept) found every recorded full answer names exactly who its prompt asked, so nothing moves on
  episodes where who's still in agrees.
- **Everything else** (events, votes, the summary, the next episode) is the full research's, untouched.

Each episode's record keeps what its reshape did (`tape.results[].reshaped`: `left`, `stayed`, `raised`, `added`, `dropped`,
`unasked`, `winners`, and `quick`: found, nobody, unknown-name, nothing or none), the run prints it a line an episode, and a game's log has a line for each episode it counts in where who
left changed. `compare` shows the people reshaped per replay for this variant (instead of "accepted").

**Played** (no bot, about 75 s a season): the four seasons on tape, 96 replays, then `compare results-quick-exits
--base=variants/results-autopilot` and `judge --dir=variants/results-quick-exits`; played again after the code review's fixes
(the numbers here and in the report are that second run's). The review's other fixes: one jiti loader for the app's TypeScript
(`tsApp`, shared by `appCode` and the pure helpers), the season's research context read once per full answer, a source given
as a string kept whole, and a stray non-entry in an answer listed as dropped.

Unit tests: `tests/playtest.test.js` (the reshape: who left both ways, both naming someone, a finale's winners, a how not in the
show's words, nobody, nothing found or no quick check, the prompt's fit, an answer that isn't JSON; the variant's name; the
reshaped count in `compare`), `tests/tapes.test.js` (`castHeld`). `npm test` passes.

**What it found** (details in [PLAYTEST-REPORT.md](PLAYTEST-REPORT.md), "P5 part 3" and findings 1, 6, 8 and 10):
- **Every season-long game ends** (96 of 96, against 56 on Autopilot) once the quick check's winner is kept at the finale.
  Outlast's ties at the top at the end fall from 58% to 47%, and nobody makes a move at the reunions (7 games asked, 84 taps).
- **The Challenge's wrong exits:**
  - put right: Nia Moore (3), Dee Valladares (12; on Autopilot she never left and was started 45 times after), Will Gagnon (16);
  - not put right: Leonardo Dionicio never leaves (no quick check names him), and Gabe Wai and Jonna Mannion still never leave
    (episode 11's quick list is empty, though its headline names them);
  - made wrong: the Traitors 4's Rob Cesternino, murdered at the top of episode 3, stays in (the quick check misses it).
- **The quick check is right in 7 of the 9 disagreements** on who left, the full research in 1, both wrong in 1, and
  confidence doesn't separate them. Finding 6's direction is refined: the quick check's who left, a full research's extra exit
  held as disputed for the tie-break, and a quick check asked again when its headline and list disagree.
- **Finding 10 corrected:** Below Deck's full research comes back. Its 40-person listing cast has 3 of season 12's crew and misses
  the rest (Caio, Solène, Chef Lawrence). The answers are nearly empty (episode 1: two "yes" answers in all; episode 2: every
  entry "unknown"), and episode 5's quick check ("Caio Poltronieri left") names someone not in the cast, so it waits.

### P5, part 4: what a player sees when a game ends; the judge to the game's own end (2026-10-28, playtest lane)

**The bot was still capped.** Its last answer was at 11:11:47 UTC. The recorder (pid 63680 since 11:33 UTC, window "Tapes:
recording") gave Below Deck 12's episode 11 quick check up at 11:54 and paused until 12:54. By then `/health`'s history had been
cleared (the bot restarted by someone else; this lane leaves it alone). One ask inside the pause (`tapes.js one below-deck 12 quick
11`, 12:13 UTC) had no reply in 420 s either. Once the bot answers, delete `below-deck
\e11-quick.json` so it's asked again.
The words corpus is still 2 of 104, so P2's table and Below Deck's cast by hand (step 3 of the seed) wait. This part is P5's work
without the bot.

**The looks at 390 once a season-long game ends** (details in [PLAYTEST-REPORT.md](PLAYTEST-REPORT.md), "P5 part 4"):
- **What was looked at:** three whole-season games kept at each finale with the quick check's winner kept (`run the-challenge 41
  --only=1,5,14 --results=quick-exits --through=19 --keep`, the Traitors 4 the same at 11). Looked at as the tinkerer, as the forgetter
  revealing the finale (`--reveal=19`), and on the hub.
- **Does anything name the winner?** The game's winner only on the hub's trophy shelf, a tap from Home ("zt_pt_forgetter won
  Outlast by 3"). The
  show's winner only as an exit, under a red OUT: "Olivia Kaiser · Winner · finished 11th". The Challenge's pair are both
  "Winner", 11th and 10th.
- **What the games say once over:** the same as any week. Tonight sets up the reunion with moves and extras, Games reads "Through
  Episode 19. Standings move when you reveal.", the reveal ends "You're 1st, 8 ahead", and the pool says "Your streak starts again".
- **The waiver replacement owed after the finale (P5 part 3's Noticed):** yes, shown. "Replace Maura · Pick who comes in" with the
  Tonight tab's badge, on a game that's over, with nobody free to pick.
- **Findings:**
  - **17 (high):** a finale's places are the order the bot names them in. Dancing with the Stars' winner finishes 5th and the fifth
    place 1st. Outlast's winner changes in 5 of the 8 of its games that reach the finale on Autopilot, and 2 of the Challenge's 6 with
    the winner kept. It has a failing test for the owner.
  - **18 (medium):** a game that's over looks like any week.
  - **19 (medium):** waivers run after the end, and a finalist counts as someone to replace.
  - **20 (low):** a finale with nothing to score stays "Early results" for good.

**`playtest-looks.js --pages`** takes the hub too: `home`, and `home-<page>` for one of its couch pages (`home-trophies`, the trophy
shelf; the keys are read from `couch-pages.tsx`'s PAGES, so a page that isn't one is refused). It opens the hub in the shape a
settled player has (`?hub=focus`). The seats joined their couch minutes ago and would get the new member's ("More shows up as the
couch plays"), which is what the first shots showed before the code review. The show's own pages (`waivers`) already worked.

**The judge to the game's own end** (`playtest.js`, P5 part 3's Noticed):
- **What `look` records:** each episode's `over` (`StateLogic.gameOver` on the game as it stood after it).
- **`endOf`:** the first episode that says it's over, else the replay's last. A file from before `over` that's over at the end: its
  span's end when it has one and got there (Start a game's `endEpisode` first), else its last exit (the finale: a reunion has none).
- **`gameRecord`:** the replay cut at `endOf` (`gameEpisodes`), marked `cut` when episodes were left off. `judgeOf` and
  `summaryLine` read every measure from it. A cut record's lead changes, when it was settled and the rough count of who can still
  win are worked out again from its own episodes (`leadChangesOf`, `settledOf`, `roughInItOf`); a file that isn't cut reads as it
  was. Who can still win counts the weeks left to the game's own end (`gameEnd`). How much each week asks (`asksOf`) still counts
  every week the app asks something, after the end too. JUDGE.md's header says so.
- **Checked:** five of the Challenge's replays played to episode 20 (the finale and a reunion, into `partial\`). The recorded `over`
  and the end worked out without it agree: 19, and 10 for the game through half.
- **What JUDGE.md shows now:**
  - the whole set and the variants `results-autopilot`, `results-accepted`, `away-favourites` and `window-merge` are unchanged,
    every table row byte for byte (on Autopilot only Dancing with the Stars' games end, at its last episode);
  - `results-quick-exits` moves (22 of its 96 records are cut). Outlast wiped 46% → 39% (Autopilot's own 39%: P5 part 3's rise
    was the reunions), quiet 11% → 7%, settled 75% → 80%, in it at three quarters 71% → 76%. Weekly Lineup wiped 43% → 24%, quiet
    17% → 12%. The pool's in it at the half 91% → 88% (fewer weeks left to catch up).

The report has the table.

**What the finale's order costs** was measured by a one-off over the files (not kept, as it reads one finding's arithmetic): each
Outlast replay's final table moved by each finale leaver's place as filed (the quick check's order) against the place their exit
ranks.

Unit tests (`tests/playtest.test.js`): the game's own end, said, worked out from a file before `over`, never over, a span's end; a
cut record's lead changes, settled and rough count against an uncut one's. `npm test` passes (802).

**The code review's fixes:**
- the first cut changed only five measures, while who can still win, lead changes, the finishes and the forgetter's covered weeks
  still read to the season's end; every measure now reads the cut record;
- the hub was shot in the new member's shape;
- a `home-` page with a typo was shot as the plain hub.

### P5, part 5: finding 17's direction played through the app; the looks at Dancing with the Stars' and Survivor's finales (2026-10-28, playtest lane)

**The bot was still capped.** At 12:26 UTC ChatGPT's last error was the 12:13 ask (no reply in 420 s). The recorder (pid 63680 since
11:33 UTC, window "Tapes: recording") was paused until 12:54 after giving Below Deck 12's episode 11 quick check up. The main session
committed the recorder's `BOT_PROVIDER` option (2bb475c6, the user's signed-in Gemini) and wrote in the journal to leave the recorder
on ChatGPT: Gemini searched in 1 of 6 runs on the full research prompt and answered all-unknown otherwise, which passes the
checklist as junk. The words corpus is still 2 of 104, so P2's table and Below Deck's cast by hand wait. This part is bot-free.

**`run ... --results=placed`** (`playtest.js`, a variant into `replays\variants\results-placed\`): quick-exits, plus each episode's
exits filed in the order they rank, so the app's own numbering places them right (finding 17's direction played through the app).
The order: anyone knocked out first (an exit that isn't one of the format's `endgameExitMethods`), then the endgame exits in the
format's order (every format lists them lowest place first, the winner last), the filed order kept only between two of the same.
- **How (`placeExits`, pure):** before the app reads an answer, the quick check's `left` list is put in that order, then the full
  answer's castaways who left, among their own slots, after the quick-exits reshape. Only what the app would file is ranked:
  - a quick check that says found false is left alone, and a name the app can't match to the cast stays where it is;
  - a quick check's exit is the one the app files: its "how" in the show's words, a missing one (or one over 32 characters,
    which `parseQuickAnswer` drops) the format's first exit, anything else "Other";
  - a full answer's leaver is one `itemsFromChecklist` files: `leftTheGame` exactly "yes", with an exit.

  The winner's exit ranks last wherever the format lists it (`exitRank`, with the format's `winnerExitMethod`). The text is
  rewritten only when a ranked leaver moves (`rankInPlace` says so from its own sort); nothing else in either answer changes.
  `fileResults` reads the format and cast from the research context for the quick check too. If that context can't be read,
  the quick check keeps its answer as it came and the record says why.
- **Where:** each episode's record keeps what moved (`tape.results[].placed`: `quick`, `full`, each `{ before, after }`), the run
  prints a line, and a game's log has a line for each episode it counts in.
- **The places in every record:**
  - `look`'s `left` keeps each leaver's `placementOrder`, the place as Tonight's results word it (`finished`, from
    `episode-view.ts outsOf`: "finished 11th") and whether theirs is the winner's exit (`winner`);
  - each episode keeps `crowned`: the show's winners so far and where they finish now, since an exit landing later can move a
    place;
  - `compare` has a "Show's winner finished" column per replay and, by game, "Show's winner 1st" (`crownedOf`, from the last
    episode's `crowned`; "–" for files from before, which have no places).

**What it moved on these tapes:**
- **Dancing with the Stars' finale:** the quick check named the winner first; now Fifth place to Winner.
- **The Challenge's finale:** the winners came first and the disqualified last; now the disqualified, then the finalists, then
  the winners.
- **Survivor 49's and the Traitors 4's finales:** the order filed was already right.
  - The Traitors' quick check names the winner last and is filed.
  - Survivor's quick check waits (two of its names say "Other"), so its finale comes from the full research. It was filed
    Kristina Mills, Sage Ahrens-Nichols, Sophi Balerdi, Savannah Louie from two answers that listed them in different orders
    (quick-exits' and this variant's). `episode-research.js candidatesFor` moves the winner last; what orders the rest wasn't
    traced (Noticed). So the full answer's reorder changed nothing filed on these tapes.

**Played** (no bot, about seven minutes for the four seasons): 96 replays, twice. The second run came after the code review's
fixes, from a clean folder; the numbers are its own, and where the first run's differ it says so. One Dancing with the Stars
replay was kept at its finale first, to check the app's own places: Robert Irwin `placementOrder` 14 of 14 (finished 1st), Elaine Hendrix 10, and the
Forgetter won 27 to 23, the one-off's figure. Then:
- `compare results-placed --base=variants/results-quick-exits` and `--base=variants/results-autopilot` (the two COMPARE files beside
  it);
- `judge --dir=variants/results-placed`;
- two one-off checks over the files (not kept, as they read one variant's question): where each show's winner finished, and, for
  each Outlast game that reaches the finale, whether its winner changed and whether both runs went into the finale with the same
  table and teams (then the change is the finale's alone).

The problems recorded are the same as quick-exits' (findings 4 and 7).

**What it found** (details in [PLAYTEST-REPORT.md](PLAYTEST-REPORT.md), "P5 part 5" and findings 17 and 21):
- **Every finale's places come out in rank order:** Dancing with the Stars 1. Robert Irwin, 2. Alix Earle ... 5. Elaine Hendrix.
- **The show's winner finishes 1st only where everyone else left:** Dancing with the Stars, in all 11 games that crowned one.
  In the 40 elsewhere someone the results never removed is still in above the winner:
  - Survivor (Rizo Velovic, held: finding 2) and the Traitors (Rob Cesternino, whose murder the quick check missed): the winner
    2nd;
  - the Challenge (Cara Maria Sorbello, Gabe Wai, Leonardo Dionicio): the winners 4th and 5th.

  Someone still in is on a team at the end in 16 of the 22 Outlast games there, and on the winning team in 13 (18 and 14 in the
  first run). That's the new finding 21 (high), with a failing test for the engine lane.
- **The one-off's numbers, played:**
  - Dancing with the Stars: the Outlast winner changes in 5 of 8 against quick-exits and Autopilot, 6 of 8 against the whole
    set. The one-off said 5 of 8 on the whole set, 4 of 8 on the others. Only 4 of the 8 go into the finale with the same teams
    and table as quick-exits (waivers' autofill is random), and 2 of those change, in both runs. So played numbers can't split
    the order from the run-to-run floor any further; the one-off's arithmetic on one file stays the clean count, and nothing
    played contradicts it.
  - The Challenge: 4 of 6 change (3 in the first run). The others are solo games, or games whose teams already differ before
    the finale; of the 3 with the same teams and table going in, 1 changes (to a tie), in both runs. The one-off's 2 of 6 is
    about right; the order's own part is the smaller.
  - Survivor (2 of 10) and the Traitors (3 of 6): none in a game with the same teams and table going in. Run-to-run noise:
    their finales were in order already.
  - Weekly Lineup (4 of 21) and the pool (2 of 16), which don't score places: every change starts before the finale, in both
    runs.
- **The judge moves within the run-to-run floor.** Two runs of placed give Outlast's settled 75% and 88% (quick-exits 80%), tied
  at the top 47% and 49% (47%). What moves the same way in both runs is Dancing with the Stars:
  - the forgetter's median finish 20% → 7%: first on the list is Alix Earle, the runner-up, now 13th of 14 rather than 11th;
  - the tinkerer's 33% → 67% and 87%.

**The looks at 390** (quick-exits, as the seed asked: what a player sees today with the winner kept; details in the report):
- **Dancing with the Stars 34's finale** (`run dancing-with-the-stars 34 --only=1,5 --results=quick-exits --through=11 --keep`),
  as the tinkerer, then the forgetter revealing it (`--reveal=11`):
  - Tonight says "Season over" (no episode is left), but its plate reads "Robert Irwin · Winner · finished 5th" and "Elaine
    Hendrix · Fifth place · finished 1st";
  - the reveal's card has "WINNER · Robert Irwin · Finished 5th" and "FOURTH PLACE · Dylan Efron · Finished 2nd";
  - replay 1's Forgetter wins Outlast 25 to 23 by Elaine's 14 (with the places right, the Tinkerer, holding the winner, would win
    25 to 23).
- **Survivor 49's finale** (`--only=1,5,15 --through=13`): the places are right but the Sole Survivor's 2nd. The Castaways page
  still lists Rizo Velovic on his tribe after "Season over", and the pool's tinkerer "Survived · You picked Rizo", tied 1st.
- **Beyond findings 17 to 20, only finding 21.** The rest are findings 18 and 19 again ("Waivers ran" after the finale, "All safe
  · 0 of 2 still in").

**Leaving the sets as compared.** A `--keep` run to a season's last episode writes into the variant's own folder, so the looks'
runs would have replaced five of quick-exits' records with a new run. They were copied aside first and put back (Noticed).
`playtest.js down` after, and the lane's dev server stopped.

Unit tests (`tests/playtest.test.js`):
- the variant's name;
- the order: Dancing with the Stars' finale, the Challenge's with two of the same, a "how" not in the show's words or too long,
  and the winner last when the format lists it first;
- an answer in order, with nobody, or that found nothing, left as it came, and a name not in the cast left where it is;
- a full answer, only the leavers the app files moving;
- where the show's winner finished in a record (the last episode's `crowned`, or each winner's exit in an older file), and the
  by-game column.

`npm test` passes (803).

**The code review's fixes:**
- each record's results now keep what the order moved (`summarize` had left `placed` out);
- the winner ranks last wherever the format lists it, not only when the format lists it last;
- only what the app files is ranked or said to have moved (a quick check that found nothing, a name not in the cast, a full
  answer's "YES");
- the quick check's context failing loses only its order;
- the places come from the app's own `outsOf`;
- `placementOrder` keeps the app's name (the app's `place` means the finish);
- `crowned` reads a place as it stands at the end;
- the app's `ordinal`, and two helpers that shared a name renamed.

The second run above was played after them.

### P5, part 6: finding 21's "fewer of them" played through the app (2026-10-28, playtest lane)

**The bot answers again.** The main session moved the local bot to signed-in ChatGPT (the user's Plus trial: GPT-6 at Instant
by default, temporary and unpersonalized chats) and restarted the recorder at 13:08 UTC (pid 63768, commit 133d35d7, window
"Tapes: recording"). Below Deck 12's given-up episode 11 quick check answered at 13:09 and its last quick checks by 13:16. The
words corpus started at 13:17, about 80 seconds a request with the pause. This part is bot-free; the corpus is P2 part 3's.

**`run ... --results=both-exits`** (`playtest.js`, into `replays\variants\results-both-exits\`): placed, and a full research's
exit that the quick check doesn't name kept as well. Who left is both answers' exits, the quick check's how first, ranked as
placed ranks them.
- **How:**
  - `bothExits` (pure): before the app reads the quick check, its `left` gets everyone the episode's full research on tape
    (`tapedFull`: the stored answer, else the last recorded that's ok) has leaving whom it doesn't name, each with the full's
    exit as its "how". Only those the app would file count (`leftTheGame` exactly "yes", with an exit), matched to who the
    quick prompt asks about as the app matches a name, a name as written first (`castMatcher`, which `quickExits` uses now
    too). A quick check the app reads as finding nothing (found false, or nobody named and no headline) is left alone.
  - Someone both answers name keeps the quick check's how, unless it's a catch-all (`catchAll`: none, not in the show's
    words, or "Other"). Then the quick check's how becomes the full's exit instead (finding 2's direction). `quickExits`'s
    `quickHow` gives the quick check's how to the full answer (`worded`), so the two always agree and nothing's held for
    wording an exit differently.
  - An exit over 32 characters can't be a quick check's how (`parseQuickAnswer` drops it), so it's left as the full has it
    (`skipped`; none on these tapes).
  - Then placed's order, in both answers.

  So the variant plays the tie-break run siding with the full research every time.
- **Where:** each episode's record keeps what the quick check got (`tape.results[].both`: `kept`, `worded`, `skipped`) and
  what the full answer got (`reshaped.worded`). The run prints a line, each game's log has one, and placed's line says when
  its "was" includes names added. Once the show's winner is crowned, each episode keeps who's still in by name
  (`stillInNames`).

**What it changed on these tapes** (four episodes in the four seasons):
- the Traitors 4's episode 3: Rob Cesternino (Murdered) added to the quick check, which then filed "Donna Kelce & Rob
  Cesternino left";
- the Challenge 41's 5: Cara Maria Sorbello "Quit", the quick check's how (the full research said "Other");
- the Challenge's 11: Leonardo Dionicio and Will Gagnon (Eliminated) added to a quick check that said nobody;
- Survivor 49's 13: Rizo Velovic "Lost Fire-Making", the full research's (the quick check's catch-all "Other").

Dancing with the Stars, where the two answers agree on all 11, is unchanged: in this pair it's the run-to-run floor.

**`compare`, two new measures,** kept so the next variant has them (P5 part 5's one-off finale check is one of them now):
- by game, "Still in at the crown": of the games that crowned the show's winner, those with anyone still in then
  (`atCrownOf`);
- by game, "Same going in: winner changed": of the games that went into the same crowning episode with the same table and
  teams in both sets, how many changed winner (`goingInOf`, `sameGoingIn`). By name, as ids are new in every run; a pool's
  table has its current streaks and its "team" is its picks so far;
- a section, "At the crown, by season": who was still in and in how many replays, and where the winners finished
  (`crownBySeason`). A file from before `stillInNames` counts only the replays with anyone.

**`--keep` writes to `partial\`** whatever its `--through` (`partialOf`; P5 part 5's Noticed), so a look to a season's last
episode no longer replaces a set's records.

**Played** (no bot; under a minute a season): 96 replays, twice. The second run came after the code review's fixes, and the
numbers are its own; where the first run's differ, they're in brackets. Then `compare results-both-exits
--base=variants/results-placed` and `--base=variants/results-autopilot` (the COMPARE files beside it), and `judge
--dir=variants/results-both-exits`. The problems recorded are placed's (findings 4 and 7).

**What it found** (details in [PLAYTEST-REPORT.md](PLAYTEST-REPORT.md), "P5 part 6" and findings 21 and 22):
- **At the crown:** nobody still in on Dancing with the Stars, Survivor and the Traitors. On the Challenge, only Gabe Wai, in
  all 11 games that crowned, whose exit no answer files. With placed, someone was in at every crown outside Dancing with the
  Stars (18, 11 and 11 games).
- **The show's winner** finishes 1st in every game that crowned one on three shows (11, 18 and 11). The Challenge's pair is
  2nd and 3rd, below Gabe Wai (placed: 4th and 5th).
- **Outlast's winners, the clean test:** 11 Outlast games go into the finale with the same table and teams in both sets
  (Survivor's 7, Dancing with the Stars' 4; 12 in the first run). 5 change, all Survivor's: whoever held Rizo Velovic (the
  Reader in 4, the Tinkerer in 1) loses the lead, his 18 points as still in 15 as 4th. (The first run had a sixth, a tie
  at the top split as the winner moved up from 2nd.) Dancing with the Stars' 4 don't change. Every other change (22 of 59
  Outlast winners against placed; 21) starts before the finale: the Challenge's and the Traitors' exits move mid-season,
  and Dancing with the Stars' 4 of 17 (5) are the floor.
- **Gone, still played** (someone gone by one set's answers and still used in the other): 22 of placed's games (12 Outlast, 5
  pool, 5 Weekly Lineup), none of both-exits'.
- **The cost:** the full research's wrong exits file too. Leonardo Dionicio and Will Gagnon leave at 11; Will left at 16, and
  Leo was competing at 14. At 16 the quick check names Will again, who's gone by then, and the app holds the whole quick check
  as "couldn't match to the cast", Aviv Melmed's right exit with it. That's finding 22 (new; Autopilot does the same).
- **The judge moves within the floor:** Outlast settled 73% in both runs (placed's two runs 75% and 88%), tied at the top 46%
  (placed 47% and 49%).

Unit tests (`tests/playtest.test.js`):
- the variant's name and what each results mode does (`resultsSteps`);
- `bothExits`: the Traitors' episode 3, a name matched as the app matches one, a gone "Rob" who can't take Rob Cesternino's
  place, a quick check that said nobody, nothing to add, a quick check the app reads as finding nothing, not an answer, an
  exit too long to carry, and Survivor's finale (a catch-all "Other" and a missing how worded as the full has them);
- `quickHow`: Cara Maria's "Other → Quit", a catch-all left as the full has it, and without it as before;
- `castMatcher`, `catchAll`, `bothLine`, placed's line with names added, `tapedFull` and `partialOf`;
- `atCrownOf`, `goingInOf` and `sameGoingIn`: by name, a team that differs, a lineup's bench, a crown at another episode, a
  pool's streaks and picks, a crown with nothing before it;
- the by-game and by-season columns.

`npm test` passes (805).

**The code review's fixes:**
- the quick check's how first only where it says one: a catch-all gives way to the full's exit, in the quick check too (the
  first run had Rizo Velovic filed "Other", and a winner with no how would have lost the crown);
- one cast matcher, a name as written first, over every entry in the full answer (a gone "Rob" took Rob Cesternino's place);
- a quick check the app reads as finding nothing is left alone, as `parseQuickAnswer` reads it, not only `found: false`;
- an exit too long to be a quick check's how is left out, not filed as the format's first exit;
- the finale's key has the crowning episode, and a pool's current streaks and picks;
- `tapedFull` takes only what `fileResults` would ask (ok), and falls back when a stored answer is empty;
- the by-season finishes come only from replays that saw the crown;
- placed's line says when its "was" has names added;
- `fileResults` takes the results mode, and three smaller tidy-ups.

The second run above was played after them.

## Noticed, not fixed

(Each step adds what it saw and left alone, with the step that could take it.)

From P1 (2026-10-28):
- **Below Deck's cast is every season's crew.** Make it a game on a series takes its cast from the TV listing (`make-game.ts
  listingCast` reads TVmaze's show cast). For Below Deck 12 that was 40 people from every season (Kate Chastain, Ben Robinson...),
  so each episode's research asks about all 40. It wants TVmaze's per-season or per-episode cast (guest cast) for a series with
  rotating crews. P4 judges how much it hurts; then make-game.ts's owner fixes it (the survivor lane, or the merge).
- **"These are the casts still in the game".** The Traitors (US) has `castaway_term` 'Cast', which `plural()` makes "casts", so the
  quick prompt, the full prompt ("23 casts") and the research log read wrongly. The copy has it from production, and the shows
  row is likely the same there. The fix is a data one (the term "Player" or "Contestant", from the desk) or a pluralizer that
  knows mass nouns. For the merge.
- **A past season can't be added in the app.** Add a show takes the season on now, else the next, else the latest (`pickSeason`),
  so the recorder calls `listedSeason` itself. Adding Below Deck also made season 13 (the one on now). The GPT plan's resolver
  needs a season by number (G2).
- **A set-up show's new season has no cast path in the new design.** Its cast comes from a league importing one (self-serve) or the
  classic admin's wiki pull (paid Anthropic). The recorder stages the cast-import prompt's answer with the classic pull's
  `stageSeasonCast`, unapproved. For desk parity (PLAN-desk-parity.md).
- **The desk's Check for changes on a built-in format suggests dozens of changes** (37 for Traitors 4, 27 for Survivor 49), because
  a research answer's ids aren't the built-in's. It's the same as the shadow leagues' finding (PLAN-researched-survivor.md); the
  event map planned for Survivor 52 should cover the desk's review too.
- **Bingo for a past episode is written in hindsight.** The squares for an episode coming up are asked after it aired, so ChatGPT
  can write from the recaps, and "likely" squares may be likelier than they'd be live. P4 judges bingo with that in mind. The
  quick check's "it aired very recently, look for tonight's live blogs" still found its sources for the 2025-26 seasons.
- **fake-bot.js `kindOf` doesn't name trivia, its check or recaps** (they're "other"), so a tape answers those only to their exact
  prompt. Naming them in `kindOf` would let a reworded prompt fall back as the others do. That's a small change to a shared file
  (P3, if a replay needs it).
- **A finale's quick check says everyone left.** Survivor 49 episode 13 came back as "Kristina Mills & Rizo Velovic & Sage
  Ahrens-Nichols & Sophi Balerdi & Savannah Louie left", the winner included. The finale's "who left the game" reads as "the
  game ended for everyone". If that's filed (with `send`, a quick answer applies when trusted), the winner shows as gone. The
  quick prompt (`bot-research.js buildQuickPrompt`) could ask about a finale differently, or the filing could skip the winner.
  P3 replays the finales to see what reaches the games; then the survivor lane, which owns research.
- **The review's efficiency note, left.** The queue re-plans and re-reads each season's `season.json` before every question (about
  a hundred small reads a minute). It's harmless at this pace.

From P3 (2026-10-28):
- **The finale item above, replayed:** the quick check was right; the full answer is the one that's wrong. It's PLAYTEST-REPORT.md's
  first finding, for the survivor lane (it owns research).
- **`season_air_dates` is a view over `show_seasons`, and Postgres lets you delete through it.** A `DELETE FROM season_air_dates
  WHERE season_id = $1` deletes the season itself. playtest.js did that to its own copy once, while clearing dates. Nothing in the
  app deletes from it today. A trigger refusing writes (or a `security_barrier` view) would close the trap. For the merge.
- **Survivor 49's stored research doesn't pass today's schema** (`sourcesRead`, `nextEpisode`, `rulesNote` and others are required
  now), so an old paste can't be filed again through `researchFromPaste` as it stands. The stored rows are fine; only re-filing
  fails. The replays add the missing fields, empty. P5, if a re-research of old seasons is ever wanted.
- **The forgetter's blind-draft team is whoever's first on the list**, because Pick for someone left has no "best available". On
  Traitors 4 that was Candiace, Caroline and Colton (alphabetical, and two lasted long), so the forgetter won two replays. P4
  judges whether luck decides too much there.
- **The "still in it" count is rough** (the best week anyone has had, times the episodes left), so most replays read "everyone"
  at the halfway mark. P4 should judge from the tables, or the count wants each game's own maximum per episode.
- **Computer players vary between runs** (`bot-logic.js` taste hashes castaway ids, which are new in every game), so a solo
  replay's result isn't repeatable to the seat. Only matters for comparing two runs of the same replay.

From P3 part 2 (2026-10-28):
- **The Challenge 41's episode 20 has no episode to choose for** in every game: after the finale (19) the games make no next
  episode until 20's results arrive, then 21 as usual. Nothing's lost (it's a reunion: finding 8), but it's a gap in
  `ensureNextEpisode` after an episode the listing calls a finale. For the engine lane, if finding 8 doesn't remove it.
- **A quick check's `left` can be empty while its headline names who went home** (The Challenge 41, episode 11). The app holds
  it as "says nobody went home", the right call. `bot-research.js parseQuickAnswer` could notice the two disagree and ask once
  more. For the survivor lane, with finding 6.
- **The forgetter wins often on Dancing with the Stars** (6 of 21 replays, the forgetter or Forgetter 2): the picks made for
  them are first on the list, alphabetical, and Alix Earle (the runner-up) is first. The list is alphabetical on every season
  taped, so nothing leaks. P4 judges whether "first on the list" should be the default pick for someone who's away.
- **The look's air time is the clock's** ("Wed 5:30 AM": two hours from when the look ran). Only the looks; harmless.
- **Seats show usernames** (zt_pt_tinkerer) in the tables because the replays' accounts are named that way; a real couch's
  show their names. Nothing to fix.

From P4's rest (2026-10-28):
- **Autofill happens when a waiver week closes** (at the next episode's results), after Run now, so a waiver week's `backIn`
  only counts those who claimed; the next episode's "teams with nobody left" shows autofill too. The report's window numbers
  use the next episode's. Harness only.
- **A seat whose draft dead-ended has no team at all** (finding 4's 16-person games), and `look` counts it among the "teams with
  nobody left" every episode; the waiver week's own count leaves it out (nobody to replace). Both right for what they say.
- **The bots' waiver claim lists every add for every drop** (`bot-logic.js waiverClaim`: up to eight pairs for two spots), so
  the claim's taps count spots, not pairs: what a person taps is a spot and a pick (backups off).
- **A pool's made-for-you pick, as worked out, copies the room**, which on a big cast is nearly as good as anyone's own read
  (the forgetter, missing 12 of 21 weeks, would finish second on The Challenge 41's season pool). Any fallback the app adds
  should be weaker than playing (finding 12).
- **Outlast with waivers on isn't repeatable run to run**: its weekly replacements autofill a free agent at random, keyed on
  the waiver week's id, which is new in every run (`WaiverLogic.autoPick`). A replay's winner can differ between two runs of
  the same config; compare such replays by their measures over many, not one by one. By design in the app (fixed per week);
  harness only.
- **The taps leave out the reveal** (the spoiler-safe "Reveal Episode N" before a lineup or pick can change). It's the same
  for every game and every week; whether it's a tap or a pleasure is G0's and the looks' to judge, not a count's.
- **`judge`'s finishes count ties two ways**: the Tinkerer and Forgetter columns by table order (as P4's first pass did), the
  "covered while away" column with ties level. Each column says which; they aren't to be compared with each other.
- **The measures read the replays' words** (a starter's "Name 3.5 (moments)", a bench's "would have scored", a move's "picked
  X", the log's "opened a window after episode N"), so rewording one in `look` or `moves` would quietly zero a measure, and a
  name with a number in it would be cut short. Recording ids, points and flags beside the words in `look`, `moves` and
  `waivers` (and reading those) would end it. P5, before the next new measure. **Done in P5 part 1.**
- **Waiver moves were logged without names since P3** (`waivers` read `addId`/`dropId`; the log's are `addedCastawayId` and
  `droppedCastawayId`), so every replay's "ran" lines read "zt_pt_tinkerer:  (waivers)". Fixed in P4's rest; the replays were
  run again.

From P5 part 1 (2026-10-28):
- **The away-favourites variant's Weekly Lineup rows moved on the second run**: the forgetter's median (ties level) 67% → 43%
  with the favourites, where P4's report says "little change". Outlast's rows came out exactly as P4's. Weekly Lineup's weekly
  moves and the computer players' picks vary between runs; finding 14's answer (not the favourites) doesn't rest on it. P5's
  next pass over the variants, if it matters.
- **Full-length screenshots draw fixed bars mid-page** (the tab bar and the dock land where the viewport ended): Playwright's
  full-page capture with fixed elements. Harness only; read the page's top for what a phone shows first.
- **The forgetter forgot two weeks running from the start** in replay 3 (episodes 6 and 7, the game's first two): the
  forgetter's weeks are a fixed third, spread from a starting point of its own (`movesThisWeek`), and a game that starts mid-season
  can begin on two off weeks. As designed; the forgetter's first lineup came at episode 8.

From P5 part 2 (2026-10-28):
- **The Challenge's two-part finale scores nothing in a Weekly Lineup.** The full research for "Finale Part I" and "Finale Part II"
  (episodes 18 and 19) has nobody doing anything the rulebook scores: its events are daily challenges and eliminations, and a
  final has neither. With finding 1 (the winner never leaves) and finding 8 (two reunions), a whole-season Weekly Lineup's last
  four weeks are quiet. A final's stages (a leg won, a checkpoint, a place) as events is the rulebook's (the survivor lane).
- **Weekly Lineup with only people in it isn't quite repeatable run to run** (1 of 17 winners changed between two runs with
  nothing changed, 3 of 17 in an earlier pair); Outlast and Survival Pool with only people are (0 of 21, 0 of 12). Not traced: likely waiver autofill or a late
  joiner's team from Join's pool. Compare Weekly Lineup variants over many replays, never one by one. P5's next pass, if a
  Weekly Lineup comparison ever hangs on it.
- **The held results are one couch's to accept for every couch.** In the replays the first couch to look (replay 1's) does all
  the ticking and every other couch sees nothing waiting. In the app it's the same: whoever opens Backstage first on a season does
  it for everyone, and nobody else is told it was done. As designed (results are shared); for the user if a couch should know.
- **The Traitors' held results are mostly vote-level details** (32 "zero votes against", 19 "voted for a Faithful who was
  banished", 7 "on the murder shortlist"), the same kinds every week, judged medium by the bot. Whoever runs a game can't check
  them from memory either. Evidence for finding 3's direction: trust by kind, or ask the tie-break run, not a person.
- **A reproducible noise floor for earlier variants.** P4's window-merge "changed the winner in 9 of 17" sits on Outlast with
  waivers on, whose winners change in 6 of 30 between two runs with nothing changed (random autofill). It's still above the
  floor, but `compare <variant> --base=variants/results-autopilot` is the fairer comparison from now on.
- **Backstage's review takes no `now`** (`backstage.ts backstageRead` reads `latestAired(schedule)` against the real clock), so
  the harness moves the copy's schedule rows around each episode's review and back (`clockTo`, `clockBack`). It isn't
  transactional: a crash between the two leaves the copy's clock moved (the next `run` brings the copy down first, so nothing
  lasts). An optional `now` on `backstageRead`, as `startGame` already takes, would let the harness drop the move. For the
  merge (it's not this lane's file).
- **The whole set was played again at the end of P5 part 2** (with `stillIn` and `joinedWith` in every record), so JUDGE.md and
  the earlier variants' `compare` against it moved by the run-to-run floor. The away-favourites and window-merge COMPARE.md
  files are from their own runs; `compare <variant>` again sets them beside today's whole set.

From P5 part 3 (2026-10-28):
- **`validateResearch` says an answer about someone not asked is "dropped", but a first full research keeps it** (read, not run:
  only a merge filters `parsed.castaways` to who was asked, in `researchFromPaste`; `storeResearch`, `stageResearchDecisions`
  and `botSend.full` take the rest as it came). No recorded answer has one (every full answer on tape names exactly who its
  prompt asked), so it costs nothing today. The survivor lane, if a bot ever volunteers someone already gone.
- **Leonardo Dionicio's real exit is on no tape.** The full research has him out at 11; episode 14's quick check has him losing
  an elimination with Ashley Mitchell, who alone went home; he isn't among the finale's eight. Pairs, partner swaps and a final
  with stages are where both answers slip (finding 6). A wiki check by hand would settle it; the replays don't need it.
- **"Wiped before the end" counts the reunions** for a game that's over at the finale (the replays look at every episode to the
  season's last), so with the winner kept Outlast's wiped share rises (39% → 46%, part of it between runs: Dancing with the Stars,
  which nothing reshaped, 29% → 35%; the finale's exits empty teams with two
  reunions still to come). A measure's quirk, not the game's. P5's next measure pass, if "wiped" is ever leaned on. **Done in P5
  part 4:** every measure stops at the game's own end, and quick-exits' Outlast wiped is 39%, Autopilot's own.
- **The Challenge crowns a pair** (Olivia Kaiser and Yeremi Hykel, both "Winner"); `seasonWinner` takes the first it finds,
  which is enough to end the season. Who the app names as the winner on a pair show (the looks) is for a look at 390, not done here.
  **Looked at in P5 part 4:** both are "Winner", 11th and 10th in the order the quick check named them (finding 17), and nothing
  names them but their exits (finding 18).
- **A waiver replacement owed after the season's over.** With the finale's winner kept, two Outlast games with weekly waivers
  (the Challenge's and the Traitors' for two) still have a replacement owed at the reunions: the finale's exits leave teams with
  someone out, and the waiver week runs after every episode. The harness counts it as a card (no taps). Whether the app shows
  it on Tonight once a game is over is for a look at 390 (`run the-challenge 41 --only=1 --results=quick-exits --keep`), then
  the engine lane (`WaiverLogic`), if it does. **Looked at in P5 part 4:** it does, finding 19.
- **The working copy's scripts and tests are LF** after this part's edits (the docs stay CRLF); git stores LF either way
  (`core.autocrlf`), so the commit's diff is clean.

From P5 part 4 (2026-10-28):
- **Two counts of who's still in disagree on one screen.** After the Challenge's finale Tonight's "Your games" says "Outlast 2nd · 2
  of 2 still in" (`yourLine` counts by `isKnockedOut`: a winner is in), while "Your night" says "All safe · 1 of 2 still in after
  this episode" (the night's count takes the winner as gone). Both right by their own rule. With finding 18 (the new design), once a
  game that's over says so.
- **Tonight's stats list the winner as "Out · Ep 11"** (the Traitors' Rob Rausch, in "As a Traitor, voted out a Faithful"): the
  stats' line for anyone with an exit. With finding 18's crown, not an exit.
- **A reunion that airs the night of the finale waits for results on a game that's over** (the Traitors 4's episode 12: "Episode 12
  · Aired · Waiting for results"). A reunion's quick check says nobody left, which the app holds as a doubt, so the wait could
  stay. With findings 8 and 18: nothing to wait for once the game's over.
- **The reveal's opener names a game on another couch.** The forgetter's reveal on replay 1's couch (Outlast only) opens "Weekly
  Lineup's full scores come later": the forgetter also plays replay 5's Weekly Lineup on the same season, on another couch. The
  reveal covers every game you play on the season. That's harness-shaped (one seat on three couches of one season), so it's left
  alone; a look with one couch per season would show it as a player has it.
- **The finale order's measure assumes the quick check filed first** (Autopilot's early stage), so its order is the order filed.
  It's true on these tapes: the full research agrees on who left at Dancing with the Stars' finale and skips anyone already out. **Checked in P5 part 5:** not for Survivor 49, whose quick check waits (two "Other"s), so its finale is
  filed from the full research in the cast's order with the winner moved last (`candidatesFor`). That order is right on this tape
  (alphabetical), so the one-off's Survivor numbers stand.
  It's a one-off (not kept), so a fix to finding 17 is checked by playing the replays again.

From P5 part 5 (2026-10-28):
- **Played counts can't split a finale's own effect from the run-to-run floor in a game with waivers.** Its autofill is random,
  so two runs go into the finale with different teams though often the same table. The one-off finale check (not kept) counts
  only games with the same table and teams going in, and that leaves 4 of Dancing with the Stars' 8. For one finale's arithmetic,
  the one-off over a single file (P5 part 4's) is the clean count; a variant shows what a player gets. P5's next variant over a
  finale, if it matters.
- **A kept run to a season's last episode replaces that variant's records** (`--through` equal to the season's last isn't
  `partial\`). This part's looks copied five quick-exits records aside and put them back. A `--keep` run could write to
  `partial\` (or a `looks\` folder) whatever its `--through`. Harness only; P5's next pass. **Done in P5 part 6:** `--keep` writes to
  `partial\` (`partialOf`).
- **"All safe · 0 of 2 still in after this episode"** (Dancing with the Stars' and Survivor's forgetter, both finalists on the
  team): P5 part 4's two counts disagreeing, now with nobody left. With finding 18.
- **A pair of winners gets two places** (the Challenge's Yeremi Hykel 4th and Olivia Kaiser 5th, in the order filed). With
  finding 18's crown, a pair show's winners would share the top place; for the new design and `orderPlacementsByEpisode`'s
  owner.
- **A finalist the quick check words "Other" ranks as knocked out** (Survivor's Sage Ahrens-Nichols, 4th below Sophi Balerdi).
  The order is right for the exit as filed; the exit's word is findings 2 and 6. Nothing for this variant.
- **The hub's "zt_pt_tinkerer started an Outlast · tap to join"** sits on the couch feed after the season's over (the game is
  minutes old in the harness). A real couch's line would be weeks old; whether a feed line offers a game that's over is
  finding 18's. Harness-shaped; left.
- **What orders a full research's exits in one episode wasn't traced.** Survivor 49's finale was filed Kristina Mills, Sage
  Ahrens-Nichols, Sophi Balerdi, Savannah Louie from two answers listing them in different orders. Decisions are stamped
  `clock_timestamp()` as they're inserted and the sync applies them in that order; `candidatesFor` moves the winner last.
  Something between the answer and the insert orders the rest. For finding 17's owner, who'll want the order in one place.
- **Among the knocked out, the filed order stands.** Survivor's format doesn't list "Lost Fire-Making" as an endgame exit, so a
  finale's fire-making loser and its last boot keep the order filed (on these tapes Rizo Velovic's exit is held, so it didn't
  come up). A place for every exit would need the format to rank them; for the rulebook's owner, with finding 17.
- **The order lives only in the harness** (`exitRank`, `placeExits`). Finding 17's fix belongs beside
  `decision-apply.ts orderPlacementsByEpisode`, as a helper the harness can then call instead of its own, so the variant keeps
  measuring what the app does. For the engine lane with finding 17; the harness switches once it exists.

From P5 part 6 (2026-10-28):
- **Jonna Mannion isn't in the Challenge 41's cast.** It has 32 people without her (she arrived in episode 5), so finding 6's
  "Jonna Mannion never leaves" is "she was never in": nobody can draft her, and an exit for her has nobody to file against. A
  mid-season arrival is the cast's (the cast import, `make-game.ts`); for the survivor lane or the merge, with finding 10's
  per-season cast.
- **Both-exits plays the tie-break always siding with the full research.** A real tie-break run asks a third time and could
  side with the quick check (the Challenge's 11, where both are wrong, or the Traitors' 3, where the full is right). So the
  variant is the "fewest still in" end of finding 6's direction, not the direction itself. Only a tie-break on tape would
  measure that; the recorder has none (`bot-research.js`'s tie-break prompt isn't asked).
- **Both-exits' rule lives only in the harness,** with placed's order (`bothExits`, `catchAll`, beside `exitRank` and
  `placeExits`). If the app takes finding 6's or 21's direction (in `bot-results.ts` or `results-changes.ts`), the variant
  should call the app's helper instead, as P5 part 5 says for the order, so it keeps measuring what the app does.
- **The base's names at the crown.** Placed's files are from before `stillInNames`, so beside them `compare` counts only the
  replays with anyone in. P5 part 5's report names them (Rizo Velovic, Rob Cesternino, Cara Maria Sorbello, Gabe Wai, Leonardo
  Dionicio). Harness only.

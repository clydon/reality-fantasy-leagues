# Season tapes and playtests

For the playtest lane's sessions and the user. Status: planned 2026-10-28, started that night in the playtest lane
(`../rfl-playtest`, branch `playtest`, database `rfl_playtest`, port 3005). P1 built and recording; P2 started (its corpus waits on
the recorder); P3 part 1 built (49 replays of Survivor 49 and Traitors 4); findings in [PLAYTEST-REPORT.md](PLAYTEST-REPORT.md).

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
2. The words corpus, once `start-a-game-words.json` exists. Its runner is P2's.
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

**The corpus:** `scripts/dev-test/start-a-game-words.json`, 104 requests, each with its expected reading:
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

# Plan: Survivor on researched rules, tested on shadow leagues during Season 51

Status: **the season-forward rehearsal is done (2026-10-30, below): the couch's three Survivor 51 games played from
production's 2026-10-30 backup to a finale three ways (realistic, the rough weeks, the daylight-saving week), every read the
same with the game-specs flag off and on and through master's engine, every invariant holding, the screens' words the same.**
Next, for the main folder: merge `survivor-data`; then R2, the flag on in production, with the user (`scripts/game-specs-flag.js
on`); R1 runs `season-forward.js rehearse --before=master` from its tree as its proof; set Survivor 51's episode count on the
desk before the finale (item 4 of the rehearsal's "What's wrong"); route item 1 (a correction reorders a night with two exits: the season sync; it moves Outlast's points) and item 3 (a replacement nobody can make).
Before that: **shadow leagues built 2026-10-27** (`scripts/dev-test/shadow-leagues.js`), and **the test couch** the same day (the same
idea in production, in the app: below; pushed 2026-10-27); the switch itself is not started, and is now planned mid-season
(item 4 below; track S of `docs/PLAN-start-a-game-gpt.md`). The goal
(the user, 2026-10-27): every show plays by researched rules, nothing baked into the app. Survivor is the last big built-in
in use, so it's the test: does it still score and research the same once its rules are researched, and what breaks if not?

**The scoring requirement (the user, 2026-10-27):** research may well find more scoring events than the built-in has, and that's
welcome, but every event both have keeps **today's built-in points**. A switch is ready only when the shadow diff says "every
one at today's points" and every table matches.

## Where Survivor is today

Every season has had a rulebook since the rulebooks work (R1-R3, 2026-10-24; `docs/PLAN-rulebooks-implementation.md`), but
Survivor 51's is **frozen from the built-in code** (`compiled_source 'legacy'`) and still reads results through the **built-in
Survivor reader** (`reader 'survivor'`: `src/lib/game/formats/survivor.js`, its wiki connector and its hand-written research
checks). `shows.format` is still `survivor`. Nothing was ever switched to researched rules; that was deliberately left for
later so the couch's three live games couldn't score differently mid-season (the implementation plan's decision 2).

## The shadow leagues (how to test it during the season)

`scripts/dev-test/shadow-leagues.js` (its header has everything): the couch's three Survivor 51 games, cloned from a production
backup into a local couch of their own, played by mock players (one per real person, named from the backup at run time, so no
real name is in the repo) who copy every real move, on different rules. Each week: take a production backup
(`scripts/backup-leagues.js`, from your own terminal), then `sync --from=<it>` and `diff`. Nothing is written to production.

- `--rules=same` (the baseline): every table, every episode, matches the real one exactly. The copy is faithful.
- `--rules=template`: Survivor's own library blocks compiled as a rulebook, with the template's aliases.
- `--rules=fresh`: the same blocks compiled the way research compiles a rulebook (Make it a game: no aliases).
- `--rules=ask`: Survivor 51's rules researched now by our bot, compiled as Make it a game compiles them.
- `--rules=<file>`: a saved answer to `prompt`.

## The test couch (production, in the app)

The user wanted the same thing live, to see it and fiddle with it during the season (2026-10-27): **Settings › Test couch**, for
site admins. Pick one of your couches' seasons with games on it and the rules, then Make: the real games are copied (every move
and result as they are; `src/lib/game/shadow.ts`, shared with the local tool) onto a couch named `Test · <couch>`, played by
**test players**, one per person in those games, named `<their username>_test` (account and seats: "slightly similar so I know
who to mimic"), each with the same seat and role. **Yours runs the games** (Commissioner where you are; at least Game admin) and
owns the couch; the real you isn't on it, so your own home doesn't change.

- **Switching:** your profile menu lists the test players (who each stands in for, their role). Switch is classic's impersonation
  (`/api/admin/users/[id]/impersonate`: the "Viewing as" bar, an hour); from one test player straight to another, and **Back to
  me**. Test players have no password: the switch is the only way in.
- **Results** reach the test games as they reach every game on the season (`syncSeasonLeagues` finds them by show and season).
  Test players can't fill in results, flag them, or flag bingo squares: those are shared by every game on the season, so they'd
  reach the real games (`src/lib/server/test-players.ts`, in `community-results.ts` submit/flagResult and `bingo.ts` flagBingo).
- **Rules** (changed any time, the moves left as they are): Today's rules as a rulebook (the template, default), The real games'
  own (`same`), Fresh ids, or **Researched by our bot**: asked after the answer (`after()`, as Make it a game), the answer kept
  so switching back to it needs no new ask. Held as the couch's own rulebook (Make it ours's shape), so nothing takes it out.
- **Copy the real games again** puts every test game back to its real game as it is now (what was done as test players goes;
  new people in the real games get test players); **Remove** takes the couch, its games, rulebook and test players.
- Code: `src/lib/server/test-couch.ts`, `/api/test-couch` (GET; POST make; PATCH copy or rules; DELETE), `db/migrations/
  0151_test_couches.sql` (`test_couches`, `test_players`), `src/new/settings/test-couch.tsx` (the switches and the section).
  Check: `scripts/dev-test/check-test-couch.js` (390px, every step above, a stand-in bot for the researched rules).
- One test couch per admin; temporary tooling: remove it (and the tables) once Survivor's switch is done.

## What it showed (production backup of 2026-10-26, through Episode 5)

1. **Survivor's own blocks score exactly the same, with aliases.** `template`: all three games, every episode, identical. The
   compiler is sound on real data, not only the golden fixtures.
2. **Without aliases, Weekly Lineup collapses.** `fresh`: Survival Pool and Outlast are untouched (they score who's left, not
   events), but Weekly Lineup's totals fall to near zero (the leader 58.5 → 4.5): nine recorded result types are ids the new
   rules don't have (tribe immunity ×45, reward wins ×35, zero votes and safe ×36, voted with the majority ×29, against ×12,
   idols found ×5 and played ×5, survived votes ×4, journeys ×3), and "Voted Out" isn't one of its ways out ("Voted out"), so
   the points a way out implies don't fire either.
3. **Research would ask different questions.** Every compile from blocks (aliased or not): 19 of the built-in reader's 27
   questions are gone and 16 new ones replace them (`attendedTribal` → `tribalCouncilAttended`, `wonIndividualImmunity` →
   `immunityChallengeWon`, ...). Research answers already stored under the old keys aren't read by the new rules.
4. **Research loses Survivor's whole-episode checks.** The built-in reader has `episodeProblems` (tribal attendance against tribe
   immunity, all-zero votes, votes against voters: hand-written on 2026-10-16); the research reader has none, so a
   contradictory episode wouldn't be flagged.
5. **A freshly researched rulebook** (`ask`, our bot, 96 seconds): research does find more, as the user expected: 42 scoring
   events against the built-in's 27. But only 5 share an id with today's rules (and `quit` among them is −3, not −5), so 22 of
   today's are missing (individual and tribe immunity, reward, idols found and played, voted with the majority, zero votes,
   fire-making, jury votes, ...). Twelve recorded result types score nothing, and its ways out are worded differently ("Voted
   Out at Tribal Council", "Quit the Game"), so the recorded "Voted Out" and "Quit" don't fire either. Weekly Lineup's four
   totals at Episode 5 go 58.5, 56, 36, 34.5 → 0, 1, 2, 2; Survival Pool and Outlast are untouched. It also double-counts in
   places (`wonIndividualImmunity` 5 beside `immunityChallengeWon` 2), and research would ask 31 new questions in place of 20.
   The answer is saved in `backups/shadow/` (gitignored) for reruns: `up --rules=backups/shadow/<file>`.

## What the switch needs (in order)

1. **Map a researched rulebook onto today's events, points and all.** Results are stored as event ids and exit names, so a
   researched rulebook must alias its moments and ways out onto the built-in's (or every recorded result must be rewritten),
   and each mapped moment takes **today's points** (the user's requirement). A moment research adds that today's rules don't
   have stays new, at the points research gave it, until someone sets them. Moments that mean the same thing (research's
   `wonIndividualImmunity` and `immunityChallengeWon`) merge onto one event. The template already carries the map; a
   researched one needs it made at switch time: matched by the moment's meaning, offered for review, never guessed silently.
2. **Read old research answers through the new questions** (or re-research the season's episodes under them): a question map
   like the event map, built the same way.
3. **Whole-episode checks as rulebook data** (memory: research checks as data): Survivor's three checks expressed as
   conditions over checklist answers, so the research reader runs them for any show.
4. ~~**Switch at a season boundary** (Survivor 52), with the shadow leagues green on Survivor 51's last episodes first.~~
   **Changed (the user, 2026-10-27): mid-season, once proven.** The test couch plays the data rules for two episodes with every
   table matching at today's points, then Survivor 51's three games switch and Survivor's code is deleted. The steps are track S
   of `docs/PLAN-start-a-game-gpt.md` (S1 blocks that say everything the code half does, S2 checks as data and no shared code
   naming Survivor, S3 the switch). That plan's "What's there today" lists every place that still names Survivor. For Survivor
   51 itself the ids stay as they are (the template's aliases, plus a question map), so items 1 and 2 above matter for a freshly
   researched rulebook, not for this switch.

## The season-forward rehearsal (2026-10-30)

The proof both switches need before today's games go onto the game-as-data structure (R2, the game-specs flag on in
production; R1, today's games rebuilt from the engine's pieces: docs/PLAN-start-a-game-gpt.md): the couch's three real
Survivor 51 games played forward past Episode 6, locally, through everything the rest of the season can throw at them, every
read and every screen checked. Tool: `scripts/dev-test/season-forward.js` (its header has everything); scenarios as data in
`scripts/dev-test/season-forward/`.

**How it works.** `up --from=backups/<dir>` clones the three games (shadow-leagues.js `--rules=same`: mock players copying
every real move) onto a zt- copy of the backup's Survivor 51 (show `zt-sf-survivor`: its cast, schedule, results with their
sources, research, rulebook, and each game's ledger of which results it has), so results filed on it reach only the shadow
games; it's checked faithful by running the season sync on it, which must change nothing. `play` then plays each episode from
the scenario, in-process on a clock of its own (`sim-clock.js`: the weeks ahead air; nothing outside the process sees it):
two days before, waiver claims and every mock player's move through the app's own writes by the archetypes' habits
(playtest.js: the Tinkerer sets the best every week, the Fan Who Forgets moves one week in three, the Drive-By once; finale
predictions the week before the finale and on its night through the question sheet's write); a move five minutes either
side of the lock where the scenario says (taken before, refused after); the hourly job's waiver clock; then the episode as
research would answer it (generated coherently from whoever's still in by the copy's own research context: only the
losing tribes at Tribal, everyone votes, an idol's votes cancelled), filed by the bot's own quick run at the episode's end
(early) and full run 12 hours on (final), the desk's Accept all for anything waiting, a held quick check confirmed in
Backstage, the desk's "When did Merged start?", each player's reveal, and the scenario's corrections. Every game's state is
kept after each episode's early and final results. `rehearse` plays each scenario twice, with the game-specs flag off and on
(this database only), and compares: every read the same (golden.js's read: as nobody and as each seat, at every mark: the
table, the span, this week's episode, finale predictions' points and the answer, the game's questions), the same states read
by `--before=<ref>`'s engine against this tree's (R1's proof: `compare <run> --before=master` from its working tree), the
invariants, and with `--look` the screens at 390 on the run's clock (a dev server carrying sim-clock.js) and their words
flag off against on.

**The scenarios** (from prod-2026-10-30: through Episode 6, 13 still in, results by sources that agree; a 13-episode season):

| Scenario | What it covers |
| --- | --- |
| `realistic` | the swap at 7 (also the first episode after the clocks go back), an idol found at 8 and played at 10 cancelling the votes on its holder, the merge at 9 with the desk's "When did Merged start?", individual immunity from then, a double boot at 11, a medical evacuation (out with no vote) beside a vote at 12, the finale (votes to four, fire-making, the jury's Sole Survivor, every finishing place), finale predictions made and graded, waivers on the hourly job's clock, the Drive-By at Episode 8's lock |
| `rough` | a quit beside a vote at the swap (7); a night nobody goes home (8: the bot's quick check holds it, the Tinkerer's It's right in Backstage); a week off the air before 9 (research says two weeks on); the merge at 9, then a player flags its immunity win and the desk decides it didn't happen; a double boot with an idol at 10, then the desk corrects the first boot's exit; at 11 one game is given a result of its own and the desk's Make every game match takes it out; another double boot at 12; the Drive-By at 9's lock |
| `dst` | Episode 7 locks at 8 PM EST (the Drive-By at 7:55, taken: a lock at October's offset would have shut at 7, and at 8:05, refused); Episode 7's research writes Episode 8's start with October's offset (`-04:00`, as research once did) and the app must still file 8 PM EST (the Drive-By at 8's lock shows it) |

**Results (2026-10-30, prod-2026-10-30): every read is the same with the flag off and on, and through master's engine, in
every scenario: nothing stands in the way of R2, or of R1 using this as its proof. One fault of the app's own, the same
either way (item 1 below).**

| Scenario | Invariants, flag off / on | Reads, flag off against on | master's engine against this tree's (off, on) | Screens' words, off against on |
| --- | --- | --- | --- | --- |
| realistic | hold / hold | 2,856, every one the same | 2,856 / 2,856, the same | 50 pages, the same (looks at 7, 9, 12, 13) |
| rough | hold / hold, but one: a correction moved two finishing places (item 1 below: the check came after this run, and fails the same with the flag off or on) | 2,856, every one the same | 2,856 / 2,856, the same | 60 pages, the same (looks at 8, 9, 10, 11, each again after its corrections) |
| dst | hold / hold | 2,856, every one the same | 2,856 / 2,856, the same | 26 pages, the same (looks at 7, 8) |

The invariants: a pool pick never repeats (every pick was one the pool offered then: it opens everyone again once you've
picked everyone still in, its own rule); every game ends at the finale and not before; Outlast ends with the show's winner
the last one standing; every score finite as nobody and as each seat; nothing scored past a game's span; no move refused that
the app offered, none taken after the lock; every episode's results filed and accepted. The flag-on runs carried their specs
(Survival Pool, Weekly Lineup, Outlast). Seen working on the way: Episode 7 airs and locks at 8 PM EST (01:00 UTC), and the
`-04:00` research filed Episode 8 at 8 PM EST all the same; the week off ("Episode 9 · Wed 8:00 PM · in 13 days", Episode 10
a week after it); "Nobody went home" in the reveal and "No one out" on the Episodes list; the merge confirmed on the desk; the
idol's cancelled votes; the finale's places (5th voted out, 4th lost fire-making, 3rd and 2nd by the jury, the Sole
Survivor) and "Season over" on every game; finale predictions graded (6, 2 and 1 points); the flag and the desk's "no"
taking the result out of every game; the correction; Make every game match leaving no game apart; Weekly Lineup's waivers
run by the clock (13 moves in the rough season). Also run on prod-2026-10-26-pre-merge (an older schema, through Episode 5,
results decided by the desk): the same.

**What's wrong** (none of it in the reads: flag on and the engine change nothing):
1. **A correction of how someone left reorders a night with two exits** (rough, Episode 10: Brady was voted out first, then
   Maggie; the desk corrected Brady's exit to Medically Evacuated, and in every game he now finished 9th and Maggie 10th:
   placementOrder 12 → 13 and 13 → 12). The season sync (season-decisions.ts syncLeagueDecisions) undoes the re-decided
   elimination and applies it again after the episode's others, and orderPlacementsByEpisode orders only across episodes.
   Outlast scores by finishing order (EliminationOrderScoringStrategy), so its points move by one for whoever had either, and
   the pages say the swapped places. What it'd take: re-apply an episode's eliminations in the season's order (the decisions'
   own, as the sync's query sorts them) whenever one of them is re-applied, or order within an episode by it; a unit test of a
   double boot corrected. The season sync is every game's: the main folder's to route (or this lane's next step).
   season-forward.js's "a correction moves nobody's finishing place" catches it.
2. **Fixed here: a lock weeks away read as this week.** Finale predictions close when the finale starts, and Tonight's
   Extras said "until Wed 8:00 PM" six weeks out. `lockTime` (src/new/clock.ts) adds the date once a lock is a week or more
   away ("Wed, Dec 16, 8:00 PM"); the question sheet's rows use it; tests/new-nav.test.js has it.
3. **Weekly Lineup asks for a replacement nobody can make** (realistic, Episode 12): with all five still in on teams, Tonight's
   first move is "Replace Jelly · Due Tue 8:00 PM · you pick who comes in" and the waivers page's yellow "Replace Jelly" (one of
   three "to do"). What it'd take: count a replacement owed only while someone's free to come in (StateLogic.WaiverLogic
   `replacementsOwed`, read by Tonight's moves and the waivers page), and say "Nobody's free to pick up" there. The engine's
   (R1 touches waivers) or the main folder's to route.
4. **Production's Survivor 51 has no episode count** (null in the backup). Finale predictions close when the season's last
   episode starts; with no count the finale isn't known, and by the code (AnswerLogic.closesAt: "A finale nobody's listed
   yet: at the game's end") they stay open through the finale's broadcast until its results land. The rehearsal sets 13, as
   the desk would. Before the finale (mid-December): set Survivor 51's episode count on the desk, from the listings.
5. **Research's vote checks on a double Tribal** (log lines only; nothing held): "19 votes counted against people, but 10
   people at Tribal are recorded voting" and "voted out despite winning individual immunity" on every double boot: the
   checklist has one vote and one immunity a person an episode, and two Tribals the same night don't fit it. Every real
   double boot will say so. For S2's checks as data, or the research prompt, to know a double Tribal.
6. **Words:** Survival Pool says "Pick one survivor each episode. Never the same twice." (the Games tab, How it works) while
   its rule picks everyone again once you've had them all (seen at the finale on the 10-26 backup); Tonight after the finale
   says "Nothing to set until the next episode" when there is none.

**Run it** (this lane, or R1's from its own tree): `node scripts/dev-test/season-forward.js rehearse
--from=backups/prod-2026-10-30 --scenario=realistic,rough,dst --before=master` (about 4 minutes; add `--look=...` with the
dev server above for the screens). A newer backup works the same; a scenario plays from whatever week its backup reached.

## Noticed, not fixed

- Season-forward rehearsal: on sources that agree, the bot's answers reached every game on their own (one source, trusted):
  nothing waited for the desk's Accept all all season but the held "nobody went home". The tool accepts whatever waits.
- Season-forward rehearsal: Outlast starts at Episode 2 and reads 3 each at mark 0, 6 after Episode 1 (its points are who's
  still standing, counted from the draft): the real game reads the same. Not a span fault; worth a line in How it works.
- Season-forward rehearsal: the answers it writes have one entry a person an episode, as research's do, so a double boot's
  two votes are added together and its last vote is the one recorded; the castaways are drawn by a hash of the scenario's
  seed, so a backup a week on draws different people (and the realistic finale's winner changes).
- Season-forward rehearsal: golden.js is a module now (its trees and read; its run only as a script), and requiring it no
  longer replays the tapes.

- The diff compares totals; a per-castaway breakdown would point at a single wrong result faster.
- The shadow games share the local Survivor 51 season's results: if an admin accepts results locally, they reach the shadows too.
- Test couch: the "Viewing as" session lasts an hour (Better Auth's impersonation); after that you're signed out and sign in again
  as yourself. Switching from one test player to another is two requests (back to you, then in as them): if the second fails
  you're left as yourself, which is safe.
- Test couch: test players are ordinary accounts (role user, approved), so the desk's people lists and any count of accounts
  include them; and they follow the season (at their person's mark), so a season's follower counts do too.
- Test couch: turning on notifications while viewing as a test player would register your phone for them (push is per account).
- Test couch: people who leave the real games keep their test players until Remove (Copy again only adds).
- Test couch: `same` in both tools now keeps whatever rulebook the real game has (its season's legacy one, for Survivor 51)
  rather than taking it out: truer to "the real games' own".
- Waiver claims still pending and blind-draft picks not yet revealed aren't copied (they live outside a league's state); a sync
  after the week's waivers have run catches them.

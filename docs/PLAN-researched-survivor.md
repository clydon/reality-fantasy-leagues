# Plan: Survivor on researched rules, tested on shadow leagues during Season 51

Status: **shadow leagues built 2026-10-27** (`scripts/dev-test/shadow-leagues.js`), and **the test couch** the same day (the same
idea in production, in the app: below; pushed 2026-10-27); the switch itself is not started. The goal
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
4. **Switch at a season boundary** (Survivor 52), with the shadow leagues green on Survivor 51's last episodes first.

## Noticed, not fixed

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

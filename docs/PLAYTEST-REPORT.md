# Playtest report

For the user and the lanes that own what's found. Written by the playtest lane (docs/PLAN-playtests.md): the replays (P3) and
their reviews (P4). The replays themselves are in `C:\Users\conor\rfl-tapes\replays\` (not in git: the tapes hold real shows'
data). `node scripts/dev-test/playtest.js summary` prints a line per replay.

Each finding has:
- a severity: **high** (a game plays wrong for everyone), **medium** (some games, or a choice that hurts), **low**;
- the lane or step that could take it;
- an exact repro.

The lane writes only its own files, so a fix in another lane's file is that lane's.

## Findings from the replays (P3 part 1, 2026-10-28)

### 1. No season-long game ever ends: a finale's full research leaves the winner in the game (high; the survivor lane, research)

On every finale recorded so far, the full research answer says the winner and the finalists didn't leave the game:

| Season | The full answer (a fresh one for Traitors and Challenge) | The quick check (asked the same night) |
|---|---|---|
| Survivor 49, episode 13 (stored, an older prompt) | Savannah Louie, Sophi Balerdi, Sage Ahrens-Nichols: `leftTheGame: "no"` | Savannah "Sole Survivor", Sophi "Lost Final Tribal (Jury Vote)", Sage "Other" |
| The Traitors (US) 4, episode 11 (today's prompt) | Rob Rausch: `leftTheGame: "no"` | Rob "Winner" |
| The Challenge 41, episode 19 (today's prompt) | Olivia Kaiser, Yeremi Hykel, four finalists, two disqualified: all "no" | the winners "Winner", the finalists "Finalist" |

**How it plays.**
- In the app's model, the winner leaves the game with the format's winner exit ("Sole Survivor", "Winner"). That's how
  `state-logic.js` `seasonWinner` crowns them, and how `gameOver` ends a season-long game.
- On Autopilot the quick check files first (the early stage), and every game shows the finalists gone and the winner crowned.
- The full answer then files as the same voice ("bot:autopilot"). It answered for those people and said they stayed, so
  their exits are removed (`fact-status.ts`: a newer answer from the same source replaces the older).
- Every game on the season ends with the winner still "in". Nothing says it's over, and Outlast's last places never
  score. In the replays, every whole-season and from-episode-N game ends "not over" (`summary`'s Over column).

The P1 Noticed item worried that the quick check reports every finalist as gone. It's the other way round: the quick check is
right, the full answer is wrong.

**Not every show** (P3 part 2): Dancing with the Stars 34's finale full answer gives the winner "Winner" and every finalist a
place ("Runner-up", "Third place"...), the same as the quick check, and every DWTS replay ends. Its format's exits are
places, so the checklist asks for a place. Survivor's, the Traitors' and the Challenge's ask whether they left.

**What a player sees** (the look at 390 after the Traitors 4 finale, as the tinkerer): the bar says "Season over" and the
Outlast card on Tonight says "1st · 1 of 2 still in". Nothing names a winner, and the Weekly Lineup's table reads "Through
Episode 12. Standings move when you reveal", as on any other week.

**Repro.**
- `node scripts/dev-test/playtest.js run the-traitors-us 4 --only=14 --keep`, then:
  ```sql
  SELECT castaway_name, method, status, fact_status FROM season_decisions d
    JOIN show_seasons ss ON ss.id = d.season_id JOIN shows s ON s.id = ss.show_id
   WHERE s.slug = 'zt-pt-the-traitors-us' AND d.episode_number = 11 AND d.kind = 'elimination';
  ```
  Rob Rausch shows `Winner`, `rejected`, `removed`.
- The tape: `rfl-tapes\the-traitors-us\4\e11-full.json`, `parsed.parsed.castaways`, Rob Rausch.
- `playtest.js down` after.

**A direction.** The full prompt (`db/episode-research.js` `buildPastePrompt` and each format's checklist wording for
`leftTheGame` and `exitMethod`) could say plainly that at the finale the winner and every finalist leave the game, the winner
with the winner's exit. The prompt does list "Sole Survivor" and asks `juryVotesReceived`, but ChatGPT still reads "left the
game" as "was eliminated". A belt to go with it: a full answer that names a winner's exit nowhere, for an episode the listing
calls the finale, keeps the quick check's winner.

### 2. The bot's own quick and full answers disagreeing on how someone left holds the exit back for good (medium; whoever owns `fact-status.ts`, with the survivor lane)

`fact-status.ts` trusts a single source's fact only if no answer for the episode says otherwise, "any of them, not just each
source's newest". The bot's quick check and its full research are one source but two answers, and they often word an exit
differently.

**On tape:**
- Survivor 49, episode 13: Rizo Velovic, quick "Other", full "Lost Fire-Making".
- The Challenge 41, episode 5: Cara Maria Sorbello, quick "Quit", full "Other".

The exit is held (pending) with nobody to settle it on a season where only the bot answers: Rizo is still in every Survivor 49
game after the finale.

**Whether someone left, too** (P3 part 2). The quick check answers for everyone still in (`coversFact`), so a quick check that
leaves someone out says they stayed. One answer saying otherwise is enough to hold a fact (`contradicted`, "any of them"):
- **The Traitors 4, episode 3:** the full research has Rob Cesternino murdered (high confidence, with two recaps); the quick
  check names only Donna Kelce. Rob stays in every game all season: the forgetter is still starting him at the reunion.
- **The Challenge 41, episode 5:** Cara Maria Sorbello left for a family emergency (quick "Quit", full "Other"). At the
  season's end she's still in 8 of 16 people's lineups in a 16-person Weekly Lineup (`the-challenge-41-weeklyLineup-shared-standard-from-waivers-g16`:
  never out, so waivers never replace her), and she's picked in a Survival Pool at episodes 19 and 21.

**Repro.**
- `node scripts/dev-test/playtest.js run survivor 49 --only=1 --keep`, then episode 13's eliminations (the query in 1, with
  `zt-pt-survivor`): Rizo Velovic shows `pending`, `reported`, two sources.
- `node scripts/dev-test/playtest.js run the-traitors-us 4 --only=6 --keep`, then the query in 1 for episode 3: Rob Cesternino
  shows `Murdered`, `pending`, `reported`, one high-confidence source.
- `node scripts/dev-test/playtest.js exits the-traitors-us 4` lists the two answers side by side (finding 6).

**A direction.** A catch-all method ("Other") from the quick check shouldn't count as saying otherwise against a specific one
from the full research. A quick check that names nobody for someone shouldn't count against a confident full answer that names
them (its job is who went home, and it misses some). Or a source's own newer answer could settle its older one, which is what
"one voice per source" says for the count.

### 3. Medium-confidence answers never reach a game the bot alone answers (medium; design, with `fact-status.ts`)

A reported fact goes live only from a high-confidence source. How much the bot answers below high:
- **Traitors 4:** 58 of 169 castaway answers were medium and 2 low. 80 of 247 scoring events stayed pending all season.
- **Challenge 41:** 177 medium and 26 low of 431.
- **Dancing with the Stars 34:** 4 medium of 106, the rest high.
- **Survivor 49** (stored, an older prompt): all high.

On a season where the bot is the only source (Autopilot, or a show nobody else on a couch fills in), a third to half of
Weekly Lineup's points never arrive. It's the same everywhere, so nobody sees a gap, only lower scores and the wrong winner
when it lands unevenly.

**Repro.** `node scripts/dev-test/playtest.js run the-traitors-us 4 --only=14 --keep`, then:
```sql
SELECT d.status, fs.confidence, count(*) FROM season_decisions d JOIN fact_sources fs ON fs.decision_id = d.id
  JOIN show_seasons ss ON ss.id = d.season_id JOIN shows s ON s.id = ss.show_id
 WHERE s.slug = 'zt-pt-the-traitors-us' AND d.kind = 'event' GROUP BY 1, 2;
```

**A direction** (a design call): trust a medium-confidence source when nobody contradicts it by the next episode, or ask the
tie-break run for medium answers.

### 4. Outlast for more people than there are castaways still in: the draft dead-ends (medium; Start a game, the engine lane's spec work)

Start a game fits Outlast's team to the couch: each person gets the still-in cast divided by the number of people, at least
one. With 16 people and 14 still in (Survivor 49 from episode 4), that's teams of 1 for 16 people. The turn-based draft stops
at pick 15 with nobody able to pick, and the game can't start properly. Three Survivor 49 replays hit it (16 people, from
episode 4, from the merge, and one episode).

**Repro.** `node scripts/dev-test/playtest.js run survivor 49 --only=13` (16 people from the merge) prints "The draft ran out of
castaways at pick 13: 16 teams of 1 need 16, and 12 are still in". (P3 part 1 numbered it 22; the matrix changed in part 2.)

**Nothing checks that a draft can fill** (P3 part 2):
- **Start a game, more people than cast:** "each" is the cast still in over the people, and under one it's skipped
  (`start-game.ts`: `each >= 1 && each < teamSize`), so Outlast keeps its own team of 3: 16 teams of 3 from 14 celebrities
  on Dancing with the Stars 34 (seen in part 2's first run).
- **Classic's League Settings:** a Weekly Lineup switched to one team each (exclusive) keeps Start a game's 3 + 2. From a third
  of the way in, 3 people need 15: on Dancing with the Stars 34 (11 still in) the draft stops at pick 12, on Survivor 49 (14
  still in) at pick 15. The new design has no ownership choice, so only classic gets here.
- **A late joiner's seat counts too:** 15 of 16 people drafting teams of 1 on Dancing with the Stars 34's 14 stops at pick 15.

`node scripts/dev-test/playtest.js run dancing-with-the-stars 34 --only=2,4` prints the last two.

**A direction.** Don't offer one-team-each Outlast when people outnumber the cast still in, or offer castaways on several teams
(shared) instead. Classic's ownership switch (and Game settings' team size) could refuse a shape the cast can't fill, as the
waiver recommendation's feasibility check already does (`WaiverLogic.recommend`: `T * R > C`).

### 5. Outlast over a short span ends in a mass tie (low; P4 to judge, then Start a game's span offer)

Outlast scores when your people leave, so over one episode or the first half nobody's team has lost anyone, or only one has.
The replays end with everyone level:
- one episode: 7 of 8, 10 of 16 and 3 of 4 (Survivor 49); 4 of 4 twice and 2 of 2 (the Traitors 4); 2 of 4 twice (The
  Challenge 41); 9 of 16, 8 of 8, 4 of 4 twice and 2 of 2 (Dancing with the Stars 34);
- through half: 10 of 16 and 4 of 4 (Survivor 49), 12 of 16 and 4 of 4 (the Traitors 4), 8 of 16 and 4 of 4 (The Challenge
  41), 10 of 16 (Dancing with the Stars 34).

Start a game offers every span for Outlast.

**Repro.** `rfl-tapes\replays\survivor-49-outlast-exclusive-small-one-g16.md`, `...-outlast-exclusive-big-through-late-nowaivers-g16.md`.

**A direction.** Offer Outlast only for spans that run to the season's end, or break ties by who's left (most still in wins).

## Findings from the replays (P3 part 2, 2026-10-28: The Challenge 41, Dancing with the Stars 34, the looks at 390)

### 6. The full research gets who left wrong where the quick check is right, and Autopilot files it over the quick (high on The Challenge; the survivor lane, research, with `fact-status.ts`'s owner)

`playtest.js exits <show> <season>` puts the two answers side by side. On The Challenge 41 they disagree on who left in 6 of 21
episodes. Where the real result could be checked, the quick check was right:
- **Episode 3:** the quick check has Nia Moore disqualified (an MRI, out before her elimination; Wikipedia's table has her out
  in episode 3). The full answer says she stayed, and has her "Eliminated" in episode 9, where nobody went home. Every game
  shows her out at 9.
- **Episode 11:** the quick check's headline is right ("Aviv Melmed and Yeremi Hykel win the climbing elimination, sending Gabe
  Wai and Jonna Mannion home", as the recaps say), but its list of who left is empty. The app holds it ("It says nobody went
  home"), which is the safety net working. The full answer names Leonardo Dionicio and Will Gagnon instead. Leo is still
  competing in episode 14's elimination by that episode's quick check, and Will leaves in episode 16 by its quick check. Gabe
  and Jonna never leave any game, and Leo and Will leave early.
- Episodes 12 and 16: the quick check has a second person leaving (Dee Valladares; Will Gagnon, whom the full research had out
  at 11), the full doesn't.
- Episode 19, the finale: finding 1.

Survivor 49 (stored) and the Traitors 4 disagree only at the finale, plus the Traitors 4's episode 3 (finding 2). Dancing with
the Stars 34 agrees on all 11.

**How it plays.** Both answers file as the bot ("bot:autopilot"), and the full one comes second, so for the people it
names it replaces the quick one (one voice per source, the newest). Who went home is the quick check's whole job and the full
research's smaller part, and on The Challenge the full one is the weaker. A show with pairs, mid-season arrivals (Jonna Mannion
joined in episode 5) and two-part eliminations is where it slips.

**Repro.** `node scripts/dev-test/playtest.js exits the-challenge 41` (the table, also in `rfl-tapes\replays\exits-the-challenge-41.md`).
In the replays, `the-challenge-41-survivalPool-season-g4.md` shows Nia Moore out at 9, Leonardo Dionicio and Will Gagnon at 11,
and Gabe Wai and Jonna Mannion never. The tapes: `rfl-tapes\the-challenge\41\e03-full.json` and `e11-full.json`,
`parsed.parsed.castaways`.

**A direction.** When the bot's own quick and full answers disagree on who left, don't let the second win silently: hold the
exit as disputed, and let the tie-break run ask a third time. Or take who left from the quick check (its job) and everything
else from the full research. Separately, a quick answer whose headline says someone was sent home while its list is empty
could be asked again once, not just held.

### 7. Start a game starts every game with waivers off (medium; Start a game's owner, `start-game.ts`, and the GPT plan's presets)

Classic's Create a league turns the waiver recommendation on for a drafted game (`create-league-flow.tsx`: `waiverRecommendation`
"balanced"), and so do the practice couch (`solo.ts`) and the tour. Start a game doesn't, and nothing after it does until whoever
runs the game finds Backstage › Waivers. So a castaway who goes home is never replaced, in every game started from the new design.
`AGAIN_KEEPS` lists `waiverRecommendation`, but it isn't a stored setting, so Run it back keeps nothing either.

Every one of P3 part 1's "waivers on" replays ran with waivers off because of this. The harness now turns them on as someone who
wants them would (Backstage › Waivers › Balanced, before the draft), and the replays were run again. With them on, Weekly
Lineup's weeks run after every episode; Outlast's recommendation is windows the commissioner opens, so its replays still have none.

**Repro.** `node scripts/dev-test/playtest.js run the-traitors-us 4 --only=10 --before=6 --keep` (a Weekly Lineup the harness
sets nothing on), then the game's state (`SELECT state FROM leagues WHERE slug LIKE 'zt-pt-10-%'`): `settings.replaceRule` and
`settings.waiverWindows` are unset, so `StateLogic.WaiverLogic.supported(state)` is true and `enabled(state)` false. `playtest.js
down` after.

**A direction** (or a decision that it's meant): apply the recommendation in `startGame`'s `after` for a drafted game, as classic
does, and let the draft fit it (`WaiverLogic.refit`). In the GPT plan, A1's presets carry `extras.waivers`.

### 8. Reunions are game episodes (low; the listings and spans, for the merge)

TVmaze lists a season's reunions as its last episodes (The Challenge 41's 20 and 21, the Traitors 4's 12). Season-long games run
through them: Weekly Lineup asks for a lineup and a Survival Pool for a pick on a reunion week, and a pick at "Reunion Part 2"
counts as surviving (nobody went home), a free point. A season game's last episode is the last reunion, not the finale. Nothing
else scores, so it's up to two weeks with nothing at stake, asked for anyway.

**Repro.** `rfl-tapes\replays\the-challenge-41-survivalPool-season-g4.md`, episodes 20 and 21; `...-weeklyLineup-shared-small-season-late-nowaivers-g2.md`.

**A direction.** An episode the listing titles a reunion (or the research says had no competition) is a special: games skip it
and a season game's span ends at the finale.

### 9. Dancing with the Stars gets no Survival Pool (low; the rulebook, the desk)

Someone went home in 8 of the season's 11 episodes, but the season's rulebook doesn't say so: its segments ("Scoring",
"Survival", "Performance") are every episode with `decidedBy: "nobody"` and no `onTheLine: "goingHome"`, so
`rulebook-fits.js goingHomeEachEpisode` is false and Start a game offers Outlast and Weekly Lineup only.

**Repro.** `node scripts/dev-test/playtest.js matrix dancing-with-the-stars 34` prints "outlast, weeklyLineup (what Start a game
offers)". The rulebook is on the tape: `rfl-tapes\dancing-with-the-stars\34\season.json`, `rulebook.blocks.segments`.

**A direction.** The desk's rulebook page fixes it for this show (the results show's segment sends someone home, decided by the
vote). The rulebook prompt could ask plainly whether someone goes home most episodes.

### 10. Below Deck's full research never comes back: a crew of 40 from every season makes a prompt too big to answer (high for a series made from a listing; whoever owns `make-game.ts`, the survivor lane or the merge)

Make it a game took Below Deck's cast from TVmaze's show cast: 40 people from every season (P1's Noticed). Each episode's full
research asks about all 40, so its prompt is 47,533 characters. The others that answered: Dancing with the Stars 15,046 (55 s),
The Challenge 22,873 (107 s), the Traitors 31,397 (42 s). The local bot gave no reply to Below Deck 12's episode 1 in 420 s,
twice (07:43 and 07:55 UTC); the quick check, which names nobody, answered in 20 s. Production's bot stops at 285 s (`askBot`),
so Autopilot and One tap would fail the same way, every episode. A Weekly Lineup on Below Deck, the one game a series gets,
would never score.

**Repro.** `rfl-tapes\below-deck\12\e01-full.try1.json` (`prompt`, 47,533 characters; `message` "No reply after 420s"), or
`node scripts/dev-test/tapes.js one below-deck 12 full 1` (asks the local bot again, up to 7 minutes; not while the recorder is
asking: the bot takes one question at a time).

**A direction.** A series' cast from the season's own episodes (TVmaze's per-episode guest cast, or the season's cast once the
listing has one), not the show's whole history. Then, for any show, a full prompt over a size could be asked in parts (who's
in it split in two), as the research already asks only for what's missing (`only: missing`).

The recorder now holds a season's other full research once one gives up with no answer (`tapes.js fullHeld`), so the queue moves
on to the quick checks and the words corpus. Delete `e01-full.json` to ask again once the cast is fixed.

## P4, a first pass: each game judged as a player would (2026-10-28)

From the 96 replays' files, measured by `node scripts/dev-test/playtest.js judge` (`rfl-tapeseplaysJUDGE.md`, by game and by
show), and read in the tables. "To the end" is a whole-season game or one from episode N or the merge; "short" is one episode
or through half. Finishes: 0% first, 100% last (the median seat in that role). Findings 1 to 3 run under all of it: no
season-long game but Dancing with the Stars' says it's over, and held results leave people in.

| Game | Replays | Lead changes | Winner settled | Tied at the top | Quiet weeks | Tinkerer | Forgetter |
|---|---|---|---|---|---|---|---|
| Weekly Lineup, to the end | 13 | 2 | 50% of the way | 15% | 19% | 0% | 67% |
| Weekly Lineup, short | 8 | 0 | 40% | 25% | 3% | 27% | 43% |
| Outlast, to the end | 30 | 3.5 | 75% | 27% | 11% | 59% | 53% |
| Outlast, short | 29 | 0 | 23% | 90% | 7% | 0% | 14% |
| Survival Pool, to the end | 8 | 0 | from the first episode | 25% | 6% | 0% | 100% |
| Survival Pool, short | 8 | 0 | from the first episode | 100% | 4% | 0% | 67% |

**Weekly Lineup plays best.** Fun: the lead changes twice in a median season and the winner isn't settled until halfway;
choices decide it (the tinkerer, who sets the sharpest lineup every week, finishes first in the median replay). Makes sense:
every starter who scored in a reveal comes with the moments that scored ("Perfect score 3 · Reached the finale 3"), none
without (`judge`'s Silent column: 0%), and what the bench would have scored is there too. Plays well, mostly:
- **The forgetter is crushed** (67%: last but one in a group of four). The game scores nothing until a first lineup is set,
  even though the draft (made for them) picked a team. Medium; a default lineup from the draft (its first picks start until
  you choose) is the fix, for Start a game's owner or the engine lane.
- **Quiet weeks** are 34% on The Challenge 41: medium-confidence results held (finding 3), so weeks pass with nobody scoring.
  Fix finding 3 and they go.

**Outlast is suspense with little to decide.** Fun: the most lead changes of any game (3.5) and the winner settled late (75% of
the way in). But after the draft nothing anyone does matters: the tinkerer finishes no better than the forgetter (59% and 53%),
and someone whose team is wiped out sits a median 29% of the season with nothing left. Short spans tie (finding 5). Plays well,
low: it's the game working as designed; the one lever is waivers, and Outlast's recommendation is windows the commissioner has
to open (finding 7's replays: none opened). A design call: open one window on its own after the merge, so a wiped team gets
back in.

**Survival Pool is the least fun as played here.** Nobody's lead ever changes, the leader is known from the first episode, and
a quarter of whole-season pools end tied at the top (every short one does). On The Challenge 41's 32 people, the drive-by
picking the first name on the list survived 17 weeks in a row: with 30 safe picks and one or two going home, there's little
to read. The forgetter finishes last in six of the seven whole-season pools with one (14th of 16 in the other):
one missed pick resets the streak. Medium, a design call for P5 or the user:
- break ties by picks survived in all, then by the fewest picks of the favourites (or say who's tied, as a shared win);
- a pick for someone who forgets (the favourite nobody's used, as waivers' fallback does), so a missed week doesn't end a
  season;
- offer it on a big cast only from the merge or a third in, where picks run short.

**Makes sense, for every game:** the looks at 390 read right after the draft and mid-season (findings 1 and 8 aside). The
season's end is where it doesn't: "Season over" with no winner named (finding 1).

Still for P4 (the next session's): Below Deck, once it has full research (finding 10); how much each week asks (taps) from the
moves' counts; whether the blind draft's "first on the list" for someone away should be the favourites instead (P3's Noticed);
and the same measures on second seasons.

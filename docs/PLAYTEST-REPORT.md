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
Episode 12. Standings move when you reveal", as on any other week. Once a game does end, it looks the same (finding 18, P5 part 4).

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

**What it costs** (P5 part 3, `--results=quick-exits`: each full answer reshaped before the app files it, who left from that
episode's quick check, so at each finale the quick check's winner and finalists are kept; beside the same replays played again
unchanged). A season-long game ends only when the format's winner exit lands (`state-logic.js` `seasonEnded`):
- **Every game ends.** On Autopilot 40 of the 96 replays never say they're over: Survivor 49's 18 of 30, the Challenge's 11 of
  22, the Traitors' 11 of 22 (Dancing with the Stars' 22 all end). With the finale's winner kept, all 96 do.
- **The last places score.** Outlast's ties at the top at the end fall from 58% to 47% (Survivor 49: 67% to 39%, the finale's
  three exits being Outlast's last places). Three of Survivor 49's Outlast games with only people in them change winner, against
  none between two runs with nothing changed.
- **The finalists stop being played.** On Autopilot the Challenge's eight finalists and the Traitors' winner, Rob Rausch, stay on
  36 teams to the end and are started 66 times after the finale (the reunions: finding 8).
- **The reunions stop asking.** On Autopilot, 7 games still ask for a lineup or a pick after the finale (23 person-weeks, 84
  taps). With the finale's winner kept, the games are over and nobody makes a move after the finale (two Outlast
  games with weekly waivers still show a replacement owed there).

Survivor 49's games end even though Rizo Velovic's exit is still held (finding 2): a crowned winner is enough.

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

**What it costs** (P5 part 2, `compare results-accepted --base=variants/results-autopilot`). Someone held in is still in every
game that starts after they've gone, and they're the best pick there is. In 96 replays on Autopilot, 25 games drafted, started,
picked or kept to the end someone the bot's own answers said had left (Rob Cesternino, Cara Maria Sorbello):
- **Outlast:** a ghost never leaves, so they earn a point at every elimination, as the winner does. The Traitors 4's Outlast
  from episode 4 for eight: the Contrarian drafted Rob Cesternino (murdered in episode 3) and won, 43 to 38. With the held
  results accepted, nobody can draft him, and the Steady wins, 45 to 37.
- **Survival Pool:** a ghost is a pick that can't lose. Cara Maria Sorbello was picked three times in the Challenge's season pool
  after she'd left. In the Traitors 4's season pool for four, Rob was picked four times, and the Tinkerer won. With the held
  results accepted, the Drive-by wins.
- **Weekly Lineup:** a starter who scores nothing: Cara Maria was started 70 times in one 16-person game.

When whoever runs the game accepts what was held (below), none of it happens. Between two runs with nothing changed, none
either. Repro: `node scripts/dev-test/playtest.js run the-traitors-us 4 --results=accepted` (and `--results=autopilot`), then
`node scripts/dev-test/playtest.js compare results-accepted --base=variants/results-autopilot`, column "Gone, still played".

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

**Measured** (P5 part 2: the replays again with whoever runs each game accepting what was held, `--results=accepted`, beside the
same replays played again unchanged). The answers counted above aren't all points: many below-high answers carry nothing that
scores. What was actually held, and what accepting it changed:
- **The Traitors 4:** 85 results in 10 of its 12 episodes, nearly all events (32 "zero votes against", 19 "voted for a Faithful
  who was banished", 8 shields, 7 "on the murder shortlist"). Weekly Lineup's points rise 5% to 25% (median 16%), Outlast's
  4% to 11% (Rob Cesternino's exit is one more elimination for everyone else's people; the one that falls, 13%, is the
  Contrarian's, whose ghost was earning them).
- **The Challenge 41:** 16 (12 "nominated and survived", Cara Maria's exit, two "nobody went home"). Weekly Lineup's points rise
  31% to 94%, on small totals.
- **Survivor 49:** 1 (Rizo's exit, finding 2). **Dancing with the Stars 34:** none.

The winners mostly don't move: 2 of 17 Weekly Lineups with only people in them change winner, against 1 of 17 between two runs
with nothing changed. On these four seasons finding 3 lowers everyone's scores about evenly. What it does change is finding
2's: who's still in.

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

**What a player sees** (P5's look at 390, 2026-10-28: Survivor 49's replay 2, a Weekly Lineup from episode 4 for four, one team
each, whose draft stopped at pick 15 with the forgetter's fifth pick to make). Six episodes later, the night before episode 10,
the forgetter's Tonight still leads with "Your turn to draft · Weekly Lineup · Draft" ("1 to do before Wed"), and the Games
page's dock says "Your draft turn · Draft". Nobody's left to pick, so the move can never be made, and it's been the top of
Tonight every week since the draft. The fan, who joined late at episode 7, is 4th on 0 with no team at all. Repro: `node
scripts/dev-test/playtest.js run survivor 49 --only=2 --before=10 --keep`, then `node scripts/dev-test/playtest-looks.js
deadend10 --as=forgetter --pages=tonight,games` (the lane's server); `playtest.js down` after.

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

**What it costs** (P5 part 3, `--results=quick-exits`, beside the same replays played again unchanged). Who left taken from the
quick check, everything else from the full research:
- **Nia Moore** leaves at 3 (Disqualified) in every game, not 9. A game from episode 7 on no longer sees her go mid-game.
- **Dee Valladares** leaves at 12, as the quick check and its headline say ("sending both Derrick and his partner Dee
  home"). On Autopilot she never leaves: in 7 games she's started 45 times after episode 12, kept on 4 teams to the end, and
  picked once in a pool.
- **Will Gagnon** leaves at 16, not 11.
- **Leonardo Dionicio never leaves.** No quick check names him. Episode 14's headline has him on the losing side of an
  elimination, but only Ashley is sent home, and he isn't among the finale's eight. Taking the quick check's word swaps one
  wrong exit (11) for none: in 8 games he's kept on 5 teams to the end, started 21 times and picked twice after episode 11.
  Episode 11's quick check said nobody left, which the app holds as a doubt on its own; the variant takes it at its word (the
  direction), so Leo and Will staying at 11 rests on an answer the app wouldn't apply by itself.
- **Gabe Wai and Jonna Mannion still never leave.** Episode 11's quick check names them in its headline, but its list is empty,
  so by its list nobody left at 11 either. Only asking again when the two disagree (the direction's last line) would catch them.
- **The Traitors 4's Rob Cesternino** goes the other way. The quick check reports episode 3's banishment and misses the murder at
  the top of the episode. The full research has it, citing an episode recap ("Rob Cesternino is murdered after suspecting a
  murder in plain sight"). Taken from the quick check, he stays in all season. That's the same as Autopilot for the games (held
  there, finding 2), and worse than accepting what was held (out at 3).

Across the four seasons' tapes the two disagree on who left in 9 episodes. The quick check is right in 7 (the Challenge's 3, 9,
12, 16 and 19, and the Traitors' and Survivor's finales), the full research in 1 (the Traitors' 3), and both are wrong in 1 (the
Challenge's 11). Confidence doesn't tell them apart: every wrong exit in the full research (Nia at 9, Leo and Will at 11) is
high, as Rob Cesternino's right one is. So the quick check is the better reader of who left, but not a safe one alone. The
direction the evidence supports: take who left from the quick check, and hold a full answer's exit the quick check doesn't name
as disputed for the tie-break run, rather than dropping it (the Traitors' 3) or filing it (the Challenge's 9 and 11). And ask a
quick check again when its headline names someone its list doesn't (the Challenge's 11).

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

**Most of it is finding 1** (P5 part 3). Once the finale's winner is crowned, the season is over and the reunions ask nothing: on
Autopilot 7 games ask for a lineup or a pick after the finale (23 person-weeks, 84 taps), against no move made once the
winner is kept (`--results=quick-exits`). A season whose finale doesn't crown anyone (Dancing with the Stars 34 crowns its
winner, so it's every show taped) would still run through them.

### 9. Dancing with the Stars gets no Survival Pool (low; the rulebook, the desk)

Someone went home in 8 of the season's 11 episodes, but the season's rulebook doesn't say so: its segments ("Scoring",
"Survival", "Performance") are every episode with `decidedBy: "nobody"` and no `onTheLine: "goingHome"`, so
`rulebook-fits.js goingHomeEachEpisode` is false and Start a game offers Outlast and Weekly Lineup only.

**Repro.** `node scripts/dev-test/playtest.js matrix dancing-with-the-stars 34` prints "outlast, weeklyLineup (what Start a game
offers)". The rulebook is on the tape: `rfl-tapes\dancing-with-the-stars\34\season.json`, `rulebook.blocks.segments`.

**A direction.** The desk's rulebook page fixes it for this show (the results show's segment sends someone home, decided by the
vote). The rulebook prompt could ask plainly whether someone goes home most episodes.

### 10. Below Deck's cast is every season's crew and leaves out this season's, so its research comes back nearly empty (high for a series made from a listing; whoever owns `make-game.ts`, the survivor lane or the merge)

Make it a game took Below Deck's cast from TVmaze's show cast: 40 people from every season (P1's Noticed). Each episode's full
research asks about all 40, so its prompt is 47,533 characters. The others that answered: Dancing with the Stars 15,046 (55 s),
The Challenge 22,873 (107 s), the Traitors 31,397 (42 s).

**Corrected (P5 part 3): the length isn't the problem.** P3 said this prompt never came back: the local bot gave no reply in
420 s, twice (07:43 and 07:55 UTC). That was the bot's ChatGPT profile, capped from 07:43 (no message box), not the prompt. On a
fresh profile at 11:00 UTC the same 47,533 characters answered in 52 s, and episode 2's in 36 s. What it costs is the cast:
- **3 of the 40 are on season 12** (Captain Kerry Titheradge, Fraser Olender, Rainbeau de Roos). The other 37 are from other
  seasons (Kate Chastain, Ben Robinson...), and this season's bosun Caio Poltronieri, Solène and Chef Lawrence Snowden aren't in
  it at all.
- **The answers are nearly empty.** Episode 1's has 40 entries: 39 "didn't leave" at medium confidence, and two "yes" answers in
  all (a crew party for Fraser and Rainbeau). Episode 2's has all 40 "unknown" at low confidence: "The available episode
  synopsis does not establish individual event counts, tip details, or departures for the 40 people in the supplied
  checklist."
- **The quick check names this season's crew, so it waits.** Episode 5's "Caio Poltronieri left" (fired by Captain Kerry) names
  someone not in the cast, so it waits in Backstage (a name it can't match), and no game hears of it.
- A Weekly Lineup on Below Deck, the one game a series gets, would draft from 40 names of whom 37 never appear, and barely score.

**Repro.** `rfl-tapes\below-deck\12\e01-full.json` and `e02-full.json` (`parsed.parsed.castaways`; `season.json`'s `cast` is
the 40), and `e05-quick.json` (Caio). The capped profile's tries are kept in `below-deck\12\gave-up-capped-bot\`.

**A direction.** A series' cast from the season's own episodes (TVmaze's per-episode guest cast, or the season's cast once the
listing has one), not the show's whole history. Asking in parts isn't needed for length.

The recorder holds a season's full research while its cast is the listing's (`tapes.js castHeld`, since P5 part 3), so the
queue goes on to the quick checks and the words corpus. Episodes 1 and 2 are on tape with the listing's cast, as the evidence.
The season's cast is to be staged by hand once the words corpus is on tape (docs/PLAN-playtests.md), then the full research
asked again.

## P4, a first pass: each game judged as a player would (2026-10-28)

From the 96 replays' files, measured by `node scripts/dev-test/playtest.js judge` (`rfl-tapes\replays\JUDGE.md`, by game and by
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
  Fix finding 3 and they go. **Corrected in P5 part 2:** with every held result accepted they're still 32%. They're the same
  episodes in every replay:
  - episode 9 (nobody went home; the only result filed is finding 6's wrong exit);
  - the finale's two parts (18 and 19: nothing the rulebook scores, then finding 1);
  - the two reunions (finding 8).

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
and the same measures on second seasons. (Taps and the favourites: the next section.)

## P4's rest: how much each week asks, someone away, and the directions tried (2026-10-28)

The 96 replays were played again with what each week asks recorded (`playtest.js` TAPS), so `judge`'s numbers above moved a
little (computer players vary between runs; `rfl-tapes\replays\JUDGE.md` has today's). The report's directions were then tried
cheaply: two as **variants** (habits changed, the replays they change played again into `replays\variants\<variant>\`, and
`playtest.js compare <variant>` puts them beside the whole set), and three **worked out from the replay files alone** (each
forgotten week records what the bench would have scored and what everyone else picked), as `judge` columns.

### How much each week asks

Taps are counted from Tonight's card on the new design's screens: a lineup is open the sheet, a tap per start or bench, Save
(looking and keeping it, 2); a pool pick 3; a waiver claim 1 plus 3 a spot; opening a window 5. The reveal before them isn't
counted. "Card" is a week the app showed a move to make. From `judge` (person-weeks in play, all four seasons):

| Game | Taps a week | Weeks with a card | Tinkerer: taps a week, a whole season | Drive-by | Forgetter | Most in a week |
|---|---|---|---|---|---|---|
| Outlast | 0 | under 1% | 0, 0 | 0 | 0 | 4 |
| Survival Pool | 2.2 | 100% | 3, 39 | 3 | 0.9 | 3 |
| Weekly Lineup | 2.3 | 34% | 3.2, 30 | 1.2 | 1.1 | 10 |

- **Weekly Lineup asks the right amount, and effort pays.** A third of weeks show a card (someone on your lineup went home, or
  no lineup yet); otherwise last week's carries. The tinkerer spends 3.2 taps a week (about 30 a season) and finishes near the
  top (13%, median); the drive-by spends 1.2 and finishes 67%. The heaviest week is 10 taps: a lineup rebuilt and a waiver claim.
- **Outlast asks nothing after the draft** (the few cards are waiver replacements): little effort, and nothing to decide (P4's
  first pass).
- **Survival Pool asks the most, every week, of everyone**: 3 taps and a card every week (39 a season), nothing carried over,
  and missing a week is punished hardest (finding 12).

### 11. The app praises a lineup nobody set (low; whoever owns `episode-team-summary.ts`)

Someone who set no lineup for an episode is told "Good call benching Matt Williams (voted out)". With no lineup, every
castaway on the team counts as benched (`episodeTeamBullets`: `benched` is the roster minus the starters), so the worst of them
is a good call. The same reading can say "Perfect lineup: you started your best possible team" with nobody started, on a week
where the team's best possible total is 0 or less. In the replays: 4 of 51 forgotten Weekly Lineup weeks (all Survivor 49,
where the forgetter's team had someone voted out; `judge`'s Idle praise column). The forgetter, the player who most needs to
hear "you didn't set a lineup", reads that they made a good call.

**Repro.** `node scripts/dev-test/playtest.js run survivor 49 --only=2 --through=4 --keep`, then `node
scripts/dev-test/playtest.js says 4` prints `zt_pt_forgetter, episode 4: lineup none; says ["Good call benching Matt Williams
(voted out)"]`. `playtest.js down` after.

**A direction.** No lineup, no lines about the calls: say what happened instead ("No lineup for Episode 4: your team would have
scored 6"), which also tells the forgetter what forgetting cost.

**Where it reaches a player** (P5's look at 390 as the forgetter, 2026-10-28; corrects the above). `episodeTeamBullets` is read
only by `buildLeaguePrompt`: classic's Scoreboard "why it mattered" lines, where the commissioner copies one prompt into an AI
chat and pastes its lines back. The praise is the prompt's "Notable:" line, so it reaches the forgetter only if the AI repeats
it. The new design never shows those lines. Its reveal of the forgotten episode is honest: "Your Weekly Lineup · Nobody started
this episode · 0", then the table ("You're 3rd, 4.5 behind zt_pt_driveby"), and Tonight's "Your night" reads "0 · Nobody
started". What it doesn't say is what forgetting cost (the direction's "your team would have scored 6"). So: low, and only in
classic's team lines; the cost line is the new design's to add. Repro: `node scripts/dev-test/playtest.js run survivor 49
--only=2 --through=4 --keep`, then `node scripts/dev-test/playtest-looks.js forgot4 --as=forgetter --reveal=4` (the lane's
server; it sets the forgetter's own progress on the zt- copy back to episode 3 so Tonight offers the reveal).

### 12. Survival Pool: the heaviest weekly ask, and one missed week ends a season (medium; design, for P5 or the user)

Every week asks a pick of everyone (above), and a missed one resets the streak the pool ranks by. The forgetter finishes last or
next to last in the median pool (86%, ties level). Two directions, worked out from the replays (`judge`'s "Forgetter, covered
while away", from `poolFallbackOf`; its recount of the streaks as played matches the app's table in all 12 pools):
- **A pick made for whoever forgets** (the room's most picked that week that they haven't used, nobody twice): 86% → 33%.
  Too generous: copying the room is a strong strategy, and on The Challenge 41's whole-season pool the forgetter, who forgot
  12 of its 21 weeks, would finish second (a streak of 16 to the drive-by's 17). Missing weeks shouldn't pay that well.
- **A missed week freezes the streak** (it neither ends nor adds to it): 86% → 69%. The forgetter stays behind those who
  picked every week, but one busy week no longer ends their season.

**A direction.** Freeze, not fill, for a missed pick. With its weekly ask, Survival Pool suits a couch that wants to play every
week. The first pass's other directions (tie-breaks, offering it from the merge on a big cast) still stand.

### 13. Weekly Lineup's forgetter loses to open slots, not to the first lineup (medium; Start a game's owner or the engine lane)

The first pass put the forgetter's crushing down to the game scoring nothing until a first lineup is set. The replays say
otherwise: forgotten weeks are few (51 in 21 replays, one or two each), and after that the lineup carries. What costs them is
an open slot: someone on their lineup goes home and the slot stays empty until they come back (the forgetter has a card in 43%
of weeks, the tinkerer in 24%). Filling each open slot from the bench in draft order, then anyone else on it (no lineup, or
someone gone home), worked out from what each week's bench would have scored (`defaultLineupOf`), moves the forgetter's median
finish from 67% to 20% (13 replays): up the table, still behind the tinkerer (13%), who sets the best lineup.

**Repro.** `node scripts/dev-test/playtest.js judge`: the Weekly Lineup rows' "Forgetter, covered while away" (67% → 20%); per
replay, `defaultLineupOf` in `playtest.js` on its JSON.

**A direction.** An open slot fills itself at lock time from the bench, in draft order (or by points so far), and the reveal
says so ("Ann started for you: Bo went home"). Setting your lineup still wins.

**As the forgetter sees it** (P5's look at 390, 2026-10-28: Survivor 49's replay 3, a blind-draft Weekly Lineup from the merge
for eight, 4 start and 2 on the bench, the night before episode 10). Tonight leads with "Set your lineup · 1 open slot · locks
Wed 8:00 PM". The moves sheet says "Start 4 of your 4": Kristina, Sophi and Sophie starting, Steven on the bench with 15.5
points, Alex (out at 9) and MC (out at 8) greyed, and an "Open slot · Start someone". The slot has been open since MC went
home at 8, with Steven beside it on the bench both weeks. Games has them 8th of 8 on 30 with the dock "1 open slot · Set". For
someone who opens the app it's two taps; for the forgetter it's nothing, and the direction above would have started Steven.
On the second run of the replays (P5, the measures reading data), the covered forgetter's median moved 67% → 29% (20% on P4's
run): computer players vary between runs; the direction holds. Repro: `node scripts/dev-test/playtest.js run survivor 49
--only=3 --before=10 --keep`, then `node scripts/dev-test/playtest-looks.js openslot10 --as=forgetter --moves
--pages=tonight,games`.

### 14. Someone away from the draft: "first on the list" is the fairer stand-in; the favourites would make missing the draft pay (low; the draft's Pick for them, and the GPT plan's `extras.draft.away`)

P3 asked whether the forgetter's team (picked for them, first on the list) should be the favourites instead. In the app, nothing
picks for someone away: in the blind draft whoever runs it picks ("Pick for X" starts empty), and the turn-based draft waits
(or takes from their queue when the timer runs out). The variant `--away=favourites` gave the forgetter the room's favourites
(what the app knows of each, `bot-logic.js` ratings, then the others' own picks) in the 60 replays with a draft and a forgetter
who drafts (`compare away-favourites`):
- **Outlast to the end, starting mid-season** (11 replays): the forgetter's median finish goes from 53% to first, first or
  level in 6 (3 as played). From a third of the way in or the merge, the app knows who's been safe, and a team of the
  favourites beats the people who drafted their own.
- **Outlast from episode 1** (12): 38% → 23%, first or level in 6 (4). Before any results the ratings are level and the
  room's own picks decide: the consensus team. These move between runs (an earlier run gave 43% → first): Outlast with
  weekly replacements fills them with a free agent drawn at random (below).
- **Weekly Lineup** (13): little change; the weekly moves decide it.

First on the list puts the forgetter mid-table on average across the four seasons (Outlast 38 to 53%). Dancing with the Stars'
lucky alphabet (Alix Earle, the runner-up, first) is one season's names. **Answer:** not the favourites. If the app ever fills a
team for someone away, it should be middling (the first on the list, or a draw) and said plainly, never the strongest at the
table. The harness keeps first on the list.

**Repro.** `node scripts/dev-test/playtest.js run survivor 49 --away=favourites` (and the other three seasons), then
`node scripts/dev-test/playtest.js compare away-favourites`; e.g. `survivor-49-outlast-exclusive-standard-merge-late-nowaivers-g8`:
the forgetter 7th of 8 → 1st.

### The other directions, tried

- **Outlast: a waiver window after the merge** (`--window=merge`: whoever runs it opens one, "Swap anyone", after the merge or
  a season's middle episode, in the 20 exclusive Outlast replays with waivers on that play past it). Teams spent 206 weeks
  wiped out after the window instead of 265, and by the next episode 20 teams had nobody left instead of 28. It helps only
  where free agents are left: where 16 people hold one each there are none, and nothing changed. "Replace who's out" refills
  everyone's out castaways, not just wiped teams': by claim, or by autofill when the window closes (Balanced's fallback, the
  forgetter's way back) if anyone's still free. The winner changed in 9 of the 17 with people, but loosely: Outlast's autofill
  draws a free agent at random (`WaiverLogic.autoPick`, keyed on the week's id, new each run), so which way it changed is luck
  as much as choice. The window is the one decision Outlast offers after the draft. A direction for Outlast's waiver
  recommendation: open one window by itself after the merge (the preset the sheet already suggests then), and say so on
  Tonight. `compare window-merge`.
- **Outlast's ties broken by who has most still in** (finding 5's direction): breaks 1 of 36 tied ends (61% of ends tied at
  the top, 59% after; `judge`'s "Tied top, most still in breaks it"). The ties are the games where nobody's people have left
  yet, or the same number have. A tie-break needs something else (what their people scored by the rulebook), or Outlast stays
  off short spans.
- **A correction to the first pass and finding 7:** Outlast's waiver recommendation isn't only windows the commissioner opens.
  On a small group (plenty of free agents) it's replacements every week (`replaceRule` "always"): 13 of the whole set's Outlast
  replays had weekly waiver weeks, the replacements autofilled at random for anyone who doesn't claim. Windows by hand are the
  recommendation only where free agents are short.
- **Weekly Lineup's default lineup** and **Survival Pool's made-for-you pick**: findings 13 and 12.

## From P5's looks (2026-10-28: the forgetter at 390)

### 15. The Games page says "Start your best three each week" whatever the game's lineup (low; the new design, `src/new/games.ts`)

The Games page heads each game with its one-liner (`GAME_STYLE`, `games.ts`; read by `lineOf` in the show's Games page), and
Weekly Lineup's is fixed: "Start your best three each week." A game with another lineup says the same. On Survivor 49's replay 3
(4 start, 2 on the bench: "big" in the matrix) the Games page says "best three" while the moves sheet above it says "Start 4 of
your 4". A small one (2 start) would read the same. The landing and the solo hub say "three" too, but there it's the preset
described, which is fine.

**Repro.** `node scripts/dev-test/playtest.js run survivor 49 --only=3 --before=10 --keep`, then `node
scripts/dev-test/playtest-looks.js openslot10 --as=forgetter --pages=games --moves`
(`rfl-tapes\replays\shots\survivor-49-3-openslot10-games.png` and `-moves.png`). `playtest.js down` after.

**A direction.** The line from the game's own settings ("Start your best 4 each week"), as the moves sheet's "Start 4 of your 4"
already is, or a line without the number.

## P5 part 2: what accepting the bot's held results changes, and who can still win (2026-10-28)

Findings 2, 3 and 6 are results the bot's answers left held or wrong on a season nobody else answers. P5 part 2 measured what
they cost by playing every replay again with **whoever runs each game accepting what was held** after each episode, through the
app's own review: Backstage › Results, Show me, It's right on a quick check that waits, every waiting result ticked
(`playtest.js run <show> <season> --results=accepted`). Beside it, the same replays **played again unchanged**
(`--results=autopilot`): what changes between two runs with nothing changed, the floor under any comparison. `compare
results-accepted --base=variants/results-autopilot` puts them side by side (`rfl-tapes\replays\variants\results-accepted\`).

| Game | Replays | Winner changed (between two runs with nothing changed) | Went home | Says it's over | Gone, still played |
|---|---|---|---|---|---|
| Outlast | 59 | 18 (10) | the same, but finding 2's | 37 → 37 | 14 → 0 |
| Survival Pool | 16 | 1 (0) | +0.5 a game | 8 → 8 | 5 → 0 |
| Weekly Lineup | 21 | 5 (1) | the same, but finding 2's | 11 → 11 | 6 → 0 |

Split by what makes two runs differ, games with only people in them are the clean test:
- **Outlast:** 4 of 21 winners change when the held results are accepted, against 0 of 21 between two runs with nothing
  changed. Rizo's exit breaks Survivor 49's finale ties, and Rob Cesternino can no longer be drafted after he's gone.
- **Survival Pool:** 1 of 12 against 0 of 12: Rob picked four times after he'd gone (finding 2).
- **Weekly Lineup:** 2 of 17 against 1 of 17, hardly beyond what runs vary by.

The games with computer players (solo) and Outlast with waivers (a random autofill) vary too much run to run to say.

What it means for each finding:
- **Finding 2** (an exit held because the bot's two answers word it differently) is the costly one: someone gone, still played
  in 25 games (finding 2, "What it costs").
- **Finding 3** (medium confidence held) lowers scores about evenly: the Traitors 4's Weekly Lineup points are 16% short (the
  median), and hardly a Weekly Lineup's winner changes beyond the floor (finding 3, "Measured").
- **Findings 1 and 6 aren't held:** the finale's winner is removed, not held, and the Challenge's wrong exits are applied. So a
  review offers nothing for them, the same 37 Outlast games say they're over, and Gabe Wai and Jonna Mannion still never leave.
  Fixing those is the research's (the survivor lane).

### 16. Accepting held results is a tick per result, with no "tick all" (low; the new design's Backstage results, `src/new/backstage/results.tsx`, with finding 3)

Show me lists each waiting result with its own tick ("Tick what's right"), then Apply and the sheet's Apply. On the Traitors 4,
whoever runs it has results waiting in 10 of 12 weeks, 85 in all. Episode 4 alone has 35 (39 taps): "At the Round Table, zero
votes against" for eleven people, "voted for a Faithful who was banished" for seven, and so on. Nobody can check those from
memory, so the realistic choices are to tick all 35 blind or to leave them. Whoever looks first does it for every couch on the
season. In the replays that's replay 1's runner, an Outlast for two that otherwise asks nothing after the draft: 125 taps over
the season (7, 13, 5, 39, 0, 6, 12, 10, 18, 10, 5, 0), and a card (results waiting, or a waiver replacement owed) in 11 of 12
weeks.

**Repro.** `node scripts/dev-test/playtest.js run the-traitors-us 4 --only=1 --through=4 --results=accepted`, then
`rfl-tapes\replays\variants\results-accepted\partial\the-traitors-us-4-outlast-exclusive-small-season-waivers-g2-through4.json`:
`tape.results[3].accepted.full` (35) and `episodes[3].asks.Tinkerer` (39 taps).

**A direction.** Group the waiting results by kind, each with "these are right" ("Zero votes against: 11 people"), or "Accept
all" with the count. Better, finding 3's own direction (trust a medium-confidence answer nobody contradicts by the next episode)
makes the list short enough to read.

### Who can still win (P4's Fun question, measured properly)

P3's "still in it" was rough: the best week anyone had, times the episodes left, so nearly everyone was "in it" at the half.
`judge` now also works it out from each game's own best possible week (`inItOf`; the leader could score nothing more):
- **Outlast:** a point per elimination for each of a team's people still in (to the season's end, everyone still in but one
  goes);
- **Weekly Lineup:** a team as it stands, each person at their best episode so far (rough: a finale's bigger points can beat it);
- **Survival Pool:** a streak that can still catch the leader's.

As the mean share of the table (the whole set on file):

| Game | At the half (rough → own) | Three quarters in |
|---|---|---|
| Outlast | 100% → 89% | 98% → 72% |
| Weekly Lineup | 99% → 81% | 84% → 70% |
| Survival Pool | 94% | 63% |

By show:
- **Weekly Lineup on the Traitors 4:** 67% at the half (Dancing with the Stars 34: 60%). A team that's lost its scorers
  can't catch up, whatever its lineup.
- **Survival Pool on The Challenge 41:** 38% three quarters in. One broken streak can't be caught on a long season (P4's first
  pass: the pool's leader is known early).
- **Outlast:** about three in ten have no way to win by three quarters, nearly all with a team that's lost most of its people
  (P4: wiped teams, and the window after the merge as the way back in).

**Repro.** `node scripts/dev-test/playtest.js judge` ("In it at half", "In it at three quarters"; `rfl-tapes\replays\JUDGE.md`).

### Between two runs with nothing changed

A different winner in 11 of 96 replays (the whole set against `--results=autopilot`): Outlast with waivers 6 of 30 (its
autofill is random), the solo games 4 of 16 (computer players), Weekly Lineups with only people in them 1 of 17 (not traced),
and Outlast or pools with only people in them never. A first pair of runs, earlier the same morning, gave 16 of 96 (7 solo, 3
Weekly Lineups). Earlier variants' winner counts sit on that floor: P4's window after the merge changed 9 of 17 Outlast-with-waivers
winners, against 6 of 30 between two runs. From now on, compare a variant against a fresh run
(`compare <variant> --base=variants/results-autopilot`).

## P5 part 3: what findings 1 and 6 cost (2026-10-28)

P5 part 2 showed a review can't reach findings 1 and 6: the finale's winner is removed, not held, and the Challenge's wrong exits
are applied. So P5 part 3 played every replay again with each episode's full research **filed as the report's directions
would**: who left from the bot's quick check that episode, everything else from the full research, so at each finale the quick
check's winner and finalists are kept (`playtest.js run <show> <season> --results=quick-exits`;
`rfl-tapes\replays\variants\results-quick-exits\`). The harness reshapes each full answer before the app's own `runJob` files it
(`playtest.js quickExits`), never the tape:
- someone the quick check names whom the full research has staying (or doesn't know about) leaves, with the quick check's method
  in the show's words, at high confidence (as the app files a quick check), with its sources. The confidence is the whole
  entry's, so the entry's other answers go to high with it; on these tapes that raised one answer (Nia Moore's "nominated" at
  3), which scores nothing once she's left;
- someone the full research has leaving whom the quick check doesn't name stays, unless the quick check found nothing or names
  someone it can't match to the cast. A quick check that says nobody left is taken at its word, though the app holds one as a
  doubt on its own: that's the Challenge's episode 11, where it keeps Leo and Will in;
- someone both name keeps the full research's method and confidence, so finding 2's holds (Rizo, Cara Maria) stay as they were;
- the answer fits its prompt. Once who's still in differs from the recording, the app asks about other people than the tape's
  answer covers: someone still in here gets the prompt's own non-committal entry, and an answer about someone gone here is
  dropped. Every recorded full answer names exactly who its prompt asked, so nothing else moves.

What it reshaped:
- **Survivor 49:** the finale (Sophi Balerdi, Sage Ahrens-Nichols and Savannah Louie left; Savannah crowned).
- **The Traitors 4:** episode 3 (Rob Cesternino stayed) and the finale (Rob Rausch crowned).
- **The Challenge 41:** episodes 3 (Nia Moore left), 11 (Leonardo Dionicio and Will Gagnon stayed), 12 (Dee Valladares left), 16
  (Will Gagnon left) and 19 (all eight; Olivia Kaiser and Yeremi Hykel crowned).
- **Dancing with the Stars 34:** nothing, since its two answers agree every episode. Its 22 replays are a control: 2 winners
  changed there, one in a game with computer players and one in a Weekly Lineup with only people in it (the 1 in 17 that runs
  vary by).

Beside the same replays played again unchanged (`compare results-quick-exits --base=variants/results-autopilot`):

| Game | Replays | Winner changed | Points | Went home | Says it's over | Gone, still played |
|---|---|---|---|---|---|---|
| Outlast | 59 | 18 | 0% | the same | 37 → 59 | 12 → 5 |
| Survival Pool | 16 | 3 | 0% | +0.5 a game | 8 → 16 | 3 → 1 |
| Weekly Lineup | 21 | 4 | +1% | the same | 11 → 21 | 5 → 2 |

"Gone, still played" counts each side by the other's answers. On Autopilot it's people gone by the quick check's word: Dee
Valladares, the Challenge's finalists and the Traitors' winner after the finale. With quick-exits it's people gone by the full
research's word: only Leonardo Dionicio.

Winners changed in games with only people in them (the clean test), against between two runs with nothing changed:
- **Outlast:** 6 of 21 (0 of 21). Survivor 49's finale breaks three ties at the top, and the Challenge's episode 11 games tie once
  Leo and Will stay.
- **Weekly Lineup:** 2 of 17 (1 of 17): the Traitors 4's, and one on Dancing with the Stars, where nothing was reshaped.
- **Survival Pool:** 1 of 12 (0 of 12), the Challenge's episode 11 pool, where nobody goes home now.

**How season-long games end.** A season-long game ends when the winner's exit lands, and on three of the four seasons the full
research drops it. With the quick check's winner kept:
- every game ends, 96 of 96 against 56;
- the finale's last places score (Outlast's ties at the top at the end: 58% → 47%; Survivor 49: 67% → 39%);
- nobody makes a move at the reunions (finding 8: on Autopilot 7 games still ask for moves after the finale).

It's the cheapest of the fixes found so far: one rule at the finale, and every game on the season plays to a result. It's in
finding 1, "What it costs".

**The Challenge's wrong exits** (finding 6, "What it costs"):
- Nia Moore leaves at 3, not 9.
- Dee Valladares leaves at 12. On Autopilot she never left, and was started 45 times after it.
- Will Gagnon leaves at 16, not 11.
- Leonardo Dionicio never leaves, because no quick check names him: one wrong exit traded for none.
- Gabe Wai and Jonna Mannion still never leave: episode 11's list is empty, though its headline names them.
- On the Traitors 4, Rob Cesternino's murder in episode 3 is lost. The full research had it right; the quick check missed it.

Of the 9 episodes where the two answers disagree on who left, the quick check is right in 7, the full research in 1, and both
are wrong in 1. Confidence doesn't separate them. So taking who left from the quick check fixes most of finding 6 but not all
of it. The direction in finding 6: the quick check's who left, any exit only the full research names held as disputed for the
tie-break run, and a quick check asked again when its headline names someone its list doesn't.

**Repro.**
- `node scripts/dev-test/playtest.js run the-challenge 41 --results=quick-exits` (and `--results=autopilot`). The run prints what
  each episode's reshape changed ("reshaped: left Nia Moore (Disqualified)"), and each record keeps it (`tape.results[].reshaped`).
- `node scripts/dev-test/playtest.js compare results-quick-exits --base=variants/results-autopilot` (`COMPARE-results-autopilot.md`
  in the variant's folder), and `judge --dir=variants/results-quick-exits`.

## P5 part 4: what a player sees when a season-long game ends (2026-10-28)

With the quick check's winner kept at the finale (`--results=quick-exits`), every season-long game ends (P5 part 3). So P5 part 4
kept three games at each finale and looked at them at 390 as a player would:
- **The games:** Outlast for two with weekly waivers, a Weekly Lineup for two and a Survival Pool for four, each the whole season
  (`playtest.js run the-challenge 41 --only=1,5,14 --results=quick-exits --through=19 --keep`, and the Traitors 4 the same at its
  finale, 11).
- **The tinkerer,** who has seen everything: `playtest-looks.js over19 --pages=tonight,games,episodes,cast,waivers,home`.
- **The forgetter,** who watched through the semi-final and reveals the finale: `--as=forgetter --reveal=19`.
- **The hub:** the looks can open it now, in the shape a settled player has (`--pages=home`, `home-trophies`).

Screenshots are in `rfl-tapes\replays\shots\` (`the-challenge-41-<n>-over19-*`, `-finale19-*`, `the-traitors-us-4-<n>-over11*`,
`-finale11-*`).

**Does anything name the winner?**
- **The game's winner:** only the hub's trophy shelf, a tap from Home (More on the couch › Trophy shelf, "0 titles · 1 season
  played"): "2nd · Traitors (US) 4 · zt_pt_forgetter won Outlast by 3".
- **The show's winner:** only as an exit. Tonight lists each finalist and the winner under the same red OUT plate as any boot:
  "OUT · Olivia Kaiser · Winner · finished 11th". The reveal's card has a red WINNER tag over "Finished 11th". The Challenge's pair
  are both "Winner", Olivia Kaiser 11th and Yeremi Hykel 10th, in the order the quick check named them (finding 17).

**What each game says once it's over** (the Challenge; the Traitors the same):
- **Tonight** sets up the next episode, a reunion (finding 8), as on any week: "Episode 20 · in 6 days", "You're set for Episode 20 ·
  Change anything until Tue", "Call it for Episode 20", the watch along. The Traitors' reunion aired the same night, so there it's
  "Episode 12 · Aired · Waiting for results". "Your games" says "Outlast 2nd · 2 of 2 still in" (a winner counts as in), while "Your
  night" says "All safe · 1 of 2 still in after this episode". The pool: "Survived · You picked Cara · streak 4" (Cara Maria
  Sorbello's exit is held: finding 2).
- **Games:** each table reads "Through Episode 19. Standings move when you reveal." The bar under it says "All set for Episode 20 ·
  Edit". Weekly Lineup's table is 7 against −3, "+0" this week.
- **The finale's reveal** (the forgetter):
  - it opens "Early results: who went home. Weekly Lineup's full scores come later" (finding 20);
  - Weekly Lineup: "Nobody started this episode · 0 so far · full scores to come";
  - the pool: "No pick · Your streak starts again";
  - Outlast's last beat: "Outlast standings · You're 1st, 8 ahead of zt_pt_tinkerer", as any week.
- **The hub:** "You're all set · nothing due this week", the show's card "Best 2nd", "Power rankings · You're 2nd · 9 back of
  zt_pt_forgetter".
- **Waivers:** a waiver week opens and runs after the finale. Tonight carries "Waivers ran · See who got who". On the Traitors, the
  forgetter is asked to replace a finalist, with nobody free (finding 19).

### 17. A finale's places are the order the bot names them in: Dancing with the Stars' winner finishes fifth, and Outlast pays the final backwards (high; whoever owns placement: `decision-apply.ts orderPlacementsByEpisode` and `state-logic.js addElimination`, the engine lane)

Outlast scores someone by their place in the boot order (`state-logic.js EliminationOrderScoringStrategy`: "out 4th = 4, the winner
of 18 = 18"). The places on Tonight, the reveal's "Finished 11th" and the medals (`selectors.ts medalFor`) read the same number.
- **How the places are set:** exits in one episode are numbered in the order they're filed. `addElimination` hands out the next
  number, and `orderPlacementsByEpisode` re-sorts by episode after each sync but keeps the filed order within an episode.
- **What files first:** on Autopilot the quick check, in the order its answer names who left, and the bot names the winner first:
  - **Dancing with the Stars 34:** Robert Irwin (Winner), Alix Earle (Runner-up), Jordan Chiles (Third place), Dylan Efron (Fourth
    place), Elaine Hendrix (Fifth place). In the game, Robert Irwin finished 5th (10 points) and Elaine Hendrix 1st (14), with the
    gold medal.
  - **The Challenge 41:** Olivia Kaiser and Yeremi Hykel, the winners, 11th and 10th. The two disqualified in the final, Theo
    Campbell and Adrienne Naylor, 5th and 4th.
  - **The Traitors 4 and Survivor 49:** their quick checks name the winner last, so they come out right by luck.

**What it costs.** For each Outlast replay that reaches a finale, each finale leaver's points were moved from their place as filed
to their place by their exit, and the winner read again (a one-off over the files, not kept):
- **The whole set (Autopilot):** Dancing with the Stars' Outlast winner changes in 5 of the 8 games that reach its finale (4 of 8 in
  the Autopilot run again, and in quick-exits). In replay 1 (Outlast for two) the Tinkerer won 25 to 21. With the places right, the
  Forgetter wins 27 to 23: they hold the winner and the runner-up.
- **With the quick check's winner kept** (quick-exits): the Challenge's winner changes too, in 2 of 6.

**Someone still in at the end outscores the winner.** When a winner is crowned while someone the research never removed is still in
(Cara Maria Sorbello, finding 2; Gabe Wai and Leonardo Dionicio, finding 6), they're scored as outlasting everyone: 30 points on the
Challenge, against the winner's 22. Replay 1's forgetter won Outlast with Cara Maria and Gabe Wai, both gone mid-season by the show's
account.

**Repro.**
- `node scripts/dev-test/playtest.js run dancing-with-the-stars 34 --only=1 --through=11 --keep`, then read the kept game's
  castaways (`leagues.state->'castaways'` on the `zt-pt-` game): Robert Irwin `placementOrder` 10 of 14, Elaine Hendrix 14.
  `playtest.js down` after.
- A failing test, for `tests/` (it fails today: the winner gets 16 of 18):

  ```js
  const test = require("node:test");
  const assert = require("node:assert/strict");
  const path = require("path");
  const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
  const { buildDemoState } = jiti("../src/lib/game/demo-season-builder.ts");
  const { applyDecision, orderPlacementsByEpisode } = jiti("../src/lib/game/decision-apply.ts");
  const { medalFor } = jiti("../src/lib/game/selectors.ts");
  const S = require("../src/lib/game/state-logic.js");

  test("a finale filed winner first still places the winner first", () => {
    const EPISODES = 16; // one boot an episode, the final three at the finale
    const data = {
      id: "test", showId: "survivor", showName: "Test", seasonName: "Test", episodeCount: EPISODES,
      players: ["ann", "bo"].map((key) => ({ key, name: key, color: "#000" })),
      castaways: Array.from({ length: 18 }, (_, i) => ({
        key: `k${i}`, name: `Castaway ${i}`, placement: i + 1, exitEpisode: Math.min(i + 1, EPISODES),
        exitMethod: i === 17 ? "Sole Survivor" : i >= 15 ? "Lost Final Tribal (Jury Vote)" : "Voted Out",
      })),
    };
    const fact = (name, method) => ({ episode_number: EPISODES, post_merge: true, kind: "elimination", castaway_name: name, method, event_type: "", jury_votes: null, units: null, applied: null });
    const s = S.migrateLeagueState(JSON.parse(JSON.stringify(buildDemoState(data, "classic-draft", EPISODES - 1))));
    // The quick check's order: the winner first.
    applyDecision(s, fact("Castaway 17", "Sole Survivor"), []);
    applyDecision(s, fact("Castaway 15", "Lost Final Tribal (Jury Vote)"), []);
    applyDecision(s, fact("Castaway 16", "Lost Final Tribal (Jury Vote)"), []);
    orderPlacementsByEpisode(s);
    const winner = s.castaways.find((c) => c.name === "Castaway 17");
    assert.equal(S.seasonWinner(s)?.name, "Castaway 17");
    assert.equal(winner.placementOrder, s.castaways.length, "the winner's place is 1st");
    assert.equal(medalFor(s, winner.placementOrder), "gold");
  });
  ```

**A direction.**
- **Order an episode's exits by what they are,** whatever order they were filed in: anyone knocked out (not an endgame exit) first,
  then the format's `endgameExitMethods` in their own order. Every format lists those lowest place first and the winner last
  (Dancing with the Stars: Fifth place, Fourth place, Third place, Runner-up, Winner). Keep the filed order only between two of the
  same exit. In `orderPlacementsByEpisode`, which runs after every sync, and `applyEliminationsImport`.
- **A belt:** the quick prompt (`bot-research.js buildQuickPrompt`) asks for who left in the order they left, the winner last.
- **Someone still in when the winner's crowned** can't have outlasted the winner. Hold them as a doubt for whoever runs it ("3
  people never left: when did they go?"), and don't score them above the winner.

### 18. A game that's over looks like any week: nothing names its winner where the couch looks (medium; the new design: Tonight, Games, the reveal)

Once a season-long game is over (`StateLogic.gameOver`, which the couch's own list already reads as `ended`), what a player sees is
above:
- the next episode set up as usual, moves and extras included;
- the table "Through Episode 19. Standings move when you reveal.";
- the finale's reveal ending "You're 1st, 8 ahead", as any week;
- the pool's "Your streak starts again";
- the show's winner under a red OUT, "finished 11th".

The app's own `isKnockedOut` (`selectors.ts`) says a winner or a finalist reached the end and shouldn't read as out, but Tonight's
results plate (`tonight.tsx LastTime`) shows every exit as OUT. The game's winner is named only on the trophy shelf.

**Repro.** `node scripts/dev-test/playtest.js run the-challenge 41 --only=1,5,14 --results=quick-exits --through=19 --keep`, then
`node scripts/dev-test/playtest-looks.js over19 --pages=tonight,games` and `node scripts/dev-test/playtest-looks.js finale19
--as=forgetter --pages=tonight --reveal=19`. `playtest.js down` after.

**A direction.**
- **Name the winner where the couch looks:** a game that's over shows its final table with its winner on Tonight and Games ("Forgetter
  won Outlast by 8", as the trophy shelf words it), and the finale's reveal ends on it.
- **Nothing after the end:** no moves, extras or "next episode" for a game that's over. A couch with nothing else on the show could
  see "Season over", which Tonight already has for a season with no episode left.
- **The show's winner as a crown, not an exit:** the finale's results list the places, the winner first.

### 19. Waivers keep running after the game is over, and ask someone to replace a finalist with nobody free (medium; the engine lane, `state-logic.js WaiverLogic.replacementsOwed`, and `action-items.js waiverItems`)

After the finale a waiver week opens and runs, and Tonight carries a "Waivers ran · See who got who" card. The waivers page says
"No change for you · Free agency · 0 free · Past waivers: After Episode 11 · 0 moves". On the Traitors 4 (quick-exits) the
forgetter, whose team is Maura Higgins (Finalist) and Rob Cesternino (still in: the quick check missed his murder), sees "Your
moves · 1 to do before airtime · Replace Maura · Pick who comes in" on Tonight, with the tab's badge. Free agency has nobody to
pick.
- **No stop at the end:** `replacementsOwed` stops only when `MidSeasonLogic.seasonOver`, nobody active. A crowned winner, or a game
  over its span, doesn't stop it, so someone the research never removed keeps the waivers going.
- **A finalist counts as a loss:** the losses leave out only the winner (`!isWinnerExit`), so a finalist is owed a replacement. The
  app's own `isKnockedOut` says a finalist reached the end.

On a season where everyone left by the finale, `seasonOver` holds and nothing is owed. With finding 1 fixed, every season where the
research missed an exit (the Challenge 41 has three) shows it.

**Repro.** `node scripts/dev-test/playtest.js run the-traitors-us 4 --only=1 --results=quick-exits --through=11 --keep`, then
`node scripts/dev-test/playtest-looks.js over11f --as=forgetter --pages=tonight,waivers`
(`rfl-tapes\replays\shots\the-traitors-us-4-1-over11f-tonight.png`, `-waivers.png`). `playtest.js down` after.

**A direction.** No waiver week once `gameOver(state)`, and a loss is someone knocked out, never one of the format's endgame exits.
An owed replacement with nobody free makes no move card.

### 20. A finale with nothing to score stays "Early results" for good (low; whoever owns `season-decisions.ts`, the survivor lane with research)

The Challenge's finale scores nothing (P5 part 2's Noticed). With the quick check's winner kept, its full research agrees on who
left, so the sync touches nothing in episode 19. An episode's stage is set only when the sync touches it (`season-decisions.ts`,
after `orderPlacementsByEpisode`), and `episode-research-apply.ts` sets "final" only for scoring moments. So the finale stays
"early":
- Tonight: "Episode 19 · Early results";
- the reveal: "Early results: who went home. Weekly Lineup's full scores come later";
- the lineup beat: "0 so far · full scores to come".

Episodes 9 and 18 aren't affected: their quick checks said nobody left and weren't applied, so the full research touched them. On
Autopilot it doesn't show, because the full research takes the finale's exits away (finding 1). Fixing finding 1 brings it out.

**Repro.** `node scripts/dev-test/playtest.js run the-challenge 41 --only=5 --results=quick-exits --through=19 --keep`, then the
kept game's `state->'episodes'`: episode 19 has `resultsStage: "early"` and no scoring events. `playtest.js down` after.

**A direction.** A full answer filed for an episode makes it final whether or not it changed anything, as `fullAnswers` already
says for an episode where nothing scored.

### The judge, to the game's own end

`judge` walked every episode a replay looked at, to the season's last. So a game that's over at the finale counted the reunions as
its quiet weeks and as "before the end" (P5 part 3's Noticed). Each measure now stops at the game's own end: when it says it's over
(each episode's `over`, recorded from now on), else its last episode. A file from before is read as over at its span's end, or at
its last exit. Who can still win counts the weeks left to that end. How much each week asks still counts every week the app asks
something, after the end too (finding 19's card).

- **Unchanged:** the whole set and the variants `results-autopilot`, `results-accepted`, `away-favourites` and `window-merge`,
  every table row byte for byte. On Autopilot the Challenge's, the Traitors' and Survivor's games never say they're over (finding
  1), Dancing with the Stars' finale is its last episode, and a span's game stops at its span's end.
- **`results-quick-exits`:** 22 of its 96 games end before the season's last episode (the Challenge's and the Traitors' that run
  to the finale). With the "In it" columns' own counts:

  | Game | Settled | Quiet | Wiped | In it at half | In it at three quarters |
  |---|---|---|---|---|---|
  | Outlast | 75% → 80% | 11% → 7% | 46% → 39% | 90% | 71% → 76% |
  | Survival Pool | 0% | 7% → 2% | 0% | 91% → 88% | 66% → 69% |
  | Weekly Lineup | 40% | 17% → 12% | 43% → 24% | 79% → 83% | 70% |

So keeping the winner doesn't wipe out more Outlast teams after all: 39%, the same as on Autopilot. P5 part 3's 39% → 46% was
the reunions. Its Weekly Lineup wiped share is below Autopilot's (24% against 38%): on Autopilot a game that never says it's over
runs to the season's last episode, so the teams the finale empties count as wiped before the end. The Challenge's Weekly Lineup was the most quiet; to its own end that's 35% → 29%.

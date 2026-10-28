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

**Repro.** `node scripts/dev-test/playtest.js run survivor 49 --only=1 --keep`, then episode 13's eliminations (the query in 1,
with `zt-pt-survivor`): Rizo Velovic shows `pending`, `reported`, two sources.

**A direction.** A catch-all method ("Other") from the quick check shouldn't count as saying otherwise against a specific one
from the full research. Or a source's own newer answer could settle its older one, which is what "one voice per source" says
for the count.

### 3. Medium-confidence answers never reach a game the bot alone answers (medium; design, with `fact-status.ts`)

A reported fact goes live only from a high-confidence source. How much the bot answers below high:
- **Traitors 4:** 58 of 169 castaway answers were medium and 2 low. 80 of 247 scoring events stayed pending all season.
- **Challenge 41:** 177 medium and 26 low of 431.
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

**Repro.** `node scripts/dev-test/playtest.js run survivor 49 --only=22` prints "The draft ran out of castaways at pick 15:
16 teams of 1 need 16, and 14 are still in".

**A direction.** Don't offer one-team-each Outlast when people outnumber the cast still in, or offer castaways on several teams
(shared) instead.

### 5. Outlast over a short span ends in a mass tie (low; P4 to judge, then Start a game's span offer)

Outlast scores when your people leave, so over one episode or the first half nobody's team has lost anyone, or only one has.
The replays end with everyone level:
- one episode: 7 of 8, 10 of 16 and 15 of 16 tied;
- through half: 10 of 16.

Start a game offers every span for Outlast.

**Repro.** `rfl-tapes\replays\survivor-49-outlast-exclusive-small-one-g16.md`, `...-outlast-exclusive-standard-through-nowaivers-g16.md`.

**A direction.** Offer Outlast only for spans that run to the season's end, or break ties by who's left (most still in wins).

## Still to judge (P4)

The replays carry everything P4's questions ask about: fun, makes sense, plays well.
- Lead changes and when the winner was settled are in `summary`.
- What the app told each player about their week is in each episode's `why.says`.
- How the forgetter did (rank, and weeks with no lineup) is in the files.

Already visible, for P4 to weigh:
- **The forgetter.** Weekly Lineup scores 0 until a first lineup is set (no default lineup), then it carries. A Survival
  Pool's missed pick costs the streak.
- **The blind draft's "first on the list"** (the forgetter's picks made for them, and the drive-by's own) decided two
  Traitors 4 replays.
- **Survival Pools often end level:**
  - two-way shared wins in three of the ten;
  - the half-season solo pools four-way, everyone having survived every pick.

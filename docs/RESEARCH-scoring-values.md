# Research: what Survivor scoring values should reward

**Status:** Research, 2026-10-02. Recommendations below have **not** been applied to any league or to
the code defaults yet — see "Open decisions" at the end.

**What this is.** An evidence-based review of the Active Roster point values for Survivor
(`src/lib/game/formats/survivor.js`, `events`). It asks two questions of every scoring category:

1. **Does it reward good gameplay?** Do the people who earn it more often go further in the game?
2. **Can a roster manager act on it?** Does information available *before* an episode predict it?

The guiding idea (from the league owner): a lot of what looks like "passive" scoring — being on the
tribe that wins, voting with the majority — is actually where roster management lives ("I think this
tribe will win", "this person is in a strong alliance"). So passive-looking categories aren't bad by
default; what matters is whether they track good play and whether a manager can read them.

**"Current" in this doc** means the league's values as set on 2026-10-02 (screenshot from the settings
page), **not** the code defaults in `survivor.js`, which differ in several places.

---

## 1. Recommended values

In the order the settings page lists them. **Bold** = changed from current.

| Category | Current | Proposed | Proposed ×2 |
|---|---|---|---|
| **Challenges** | | | |
| Individual immunity win | 3 | 3 | 6 |
| Individual challenge: 2nd place | 2 | **1** | 2 |
| Individual challenge: 3rd place | 1 | **0.5** | 1 |
| Tribe/team immunity win | 1.5 | **1** | 2 |
| Reward win | 1 | 1 | 2 |
| Chosen to join a reward (without winning it) | 0.5 | 0.5 | 1 |
| Sat out a challenge | -0.5 | -0.5 | -1 |
| **Tribal Council** | | | |
| Played an idol/advantage that cancelled votes | 2 | **3** | 6 |
| Received votes at Tribal but survived | 1 | 1 | 2 |
| Voted with the majority | 1 | 1 | 2 |
| Safe at Tribal, zero votes against | 0.5 | **1** | 2 |
| Voted against the majority | -0.2 | **-0.25** | -0.5 |
| Voted out | -3 | -3 | -6 |
| **Idols & Advantages** | | | |
| Idol/advantage found | 3 | **2** | 4 |
| Idol/advantage played | 2 | **1** | 2 |
| Learned of an idol/advantage (privately) | 0.5 | 0.5 | 1 |
| Had an advantage used against them | -0.5 | -0.5 | -1 |
| **Journeys & Exile** | | | |
| Went on a journey | 1 | **0.5** | 1 |
| Sent to Exile | 0 | 0 | 0 |
| **Leaving the Game** | | | |
| Medically evacuated | 0 | 0 | 0 |
| Quit | -5 | -5 | -10 |
| **Endgame** | | | |
| Reached Final Tribal Council | 3 | 3 | 6 |
| Each jury vote received | 1 | 1 | 2 |
| Sole Survivor (bonus) | 3 | 3 | 6 |
| Won fire-making | 2 | 2 | 4 |
| Lost fire-making | -1 | -1 | -2 |
| Finalist with no jury votes | -3 | -3 | -6 |

Why each change was made is in section 4. Two values were deliberately left alone despite open
questions:

- **Learned of an idol/advantage, privately (0.5):** couldn't be tested (not in the dataset), and
  research still can't detect it reliably — it lives in recap prose, not tables. 0 is the cautious
  choice until that's checked. **If it can be detected reliably, 0.5 is the right value** — see
  "Learned about someone else's idol" in section 4 for why, and for the two counting rules it needs.
- **Reward win (1):** see "Reward win" in section 4 — the better fix is a code change, not a value.

---

## 2. Data and method

**Dataset:** [survivoR](https://github.com/doehm/survivoR) (Daniel Oehm), the curated R dataset of
every US Survivor season, downloaded as `dev/xlsx/survivoR.xlsx`. Tables used: Castaways, Challenge
Results, Vote History, Advantage Movement, Journeys, Jury Votes, Confessionals, Castaway Scores.

**Scope:** new-era seasons **41–50** (season 51 was in progress). Every castaway, every episode they
were in the game: **1,538 castaway-episodes**, about 150 per season.

**Scoring model:** each castaway-episode scored with the league's values, mapping the dataset onto the
app's event types the same way `researchItems` / `impliedEvents` in `survivor.js` do:

| App event | Taken from |
|---|---|
| individualImmunity | `won_individual_immunity` |
| tribeImmunity | `won_tribal_immunity` or `won_team_immunity` |
| rewardWin | any tribal/team/individual reward win, once per episode (like the app) |
| chosenForReward | `chosen_for_reward` without a reward win |
| challengeRunnerUp / Third | `order_of_finish` 2 / 3 in an individual challenge |
| satOut | `sit_out` |
| votedWithMajority / AgainstMajority | voter's final-round vote vs who went home, voter not going home |
| zeroVotesSafe / survivedVotes | first-round votes received at a Tribal they attended and survived |
| advantageTargeted | lost vote to steal-a-vote / vote-blocker (approximate) |
| idolFound | advantage events Found, Found (beware), Received |
| idolPlayed / votesNegated | Played / Played with `votes_nullified > 0` (credited to the player) |
| wentOnJourney | Journeys table |
| wonFireMaking | fire challenge, outcome Won |
| votedOut, quit, medevac, lostFireMaking, finalist, juryVote, zeroJuryVotes, soleSurvivor | Castaways `result` + Jury Votes |

**Measures:**

- **Link to going far** — Spearman correlation between how often someone earned a category and how
  far they went (making the merge, or finishing position). Rates are per pre-merge episode or per
  Tribal attended, never per episode overall (that biased the first pass: deep players spend more
  episodes post-merge, where tribe immunity can't happen, so their per-episode tribe-immunity rate
  looked *negative*).
- **Predictability** — AUC of a signal available before the episode (0.5 = coin flip, 1 = perfect),
  plus the event rate for castaways in the top vs bottom third of that signal.

**Data quality notes:**

- Individual challenge finishing order is recorded for only **18%** of individual challenges, even in
  this curated dataset. 2nd/3rd place is scored from patchy data whatever the source.
- "Found" includes advantages handed out on journeys; "had an advantage used against them" is
  approximate; "learned of an advantage" isn't in the data at all.

---

## 3. Findings

### 3.1 Where the points come from (current values)

Per season, across the whole cast:

| Category | Events/season | Points/season | Share of + points |
|---|---|---|---|
| Tribe immunity | 58.5 | 87.8 | **21.8%** |
| Reward win | 65.9 | 65.9 | **16.3%** |
| Voted with majority | 63.0 | 63.0 | 15.6% |
| Idol/advantage found | 14.1 | 42.3 | 10.5% |
| Zero votes, safe | 66.2 | 33.1 | 8.2% |
| Individual immunity | 10.0 | 30.0 | 7.4% |
| Survived votes | 17.2 | 17.2 | 4.3% |
| Challenge 2nd place | 6.5 | 13.0 | 3.2% |
| Idol played | 6.3 | 12.6 | 3.1% |
| Finalist | 3.0 | 9.0 | 2.2% |
| Journey | 8.9 | 8.9 | 2.2% |
| Each jury vote | 8.3 | 8.3 | 2.1% |
| Votes cancelled | 1.6 | 3.2 | 0.8% |
| Voted out | 13.9 | -41.7 | — |
| Sat out | 14.5 | -7.2 | — |
| Voted against majority | 14.9 | -3.0 | — |

About 403 positive points per season. Tribe challenges dominate pre-merge: new-era challenges often pay
reward **and** immunity together, so a winning tribe usually banks 2.5 at current values.

### 3.2 What good gameplay looks like

| Category | Link to going far | Notes |
|---|---|---|
| Voted with majority (per Tribal) | **+0.57** with making merge, **+0.47** post-merge depth | Strongest signal in the data |
| Zero votes (per Tribal) | **+0.62** / **+0.46** | Stronger than surviving votes |
| Individual immunity (post-merge) | +0.21 | |
| Idol played | +0.27 | |
| Survived votes | +0.14 | |
| Tribe immunity (per pre-merge ep) | +0.19 | Weak |
| Reward win (per pre-merge ep) | +0.20 | Weak |
| Idol found | +0.13 | Weak |
| Journey | **−0.16** | Journey-goers tend to go out earlier; ~¼ of journeys cost a vote |
| Voted against majority (per Tribal) | **+0.19** | Mildly *positive*: deep players end up on the wrong side of split votes and still survive |

This matches outside analysis of winners: "votes for bootee" (correct votes) is among the strongest
predictors of winning, alongside individual immunity wins
([UCLA DataRes](https://ucladatares.medium.com/an-analysis-of-survivor-winners-38925081aaf9)).

### 3.3 What a manager can predict

| Event | Signal known beforehand | Top ⅓ vs bottom ⅓ | AUC |
|---|---|---|---|
| Idol played | Currently holding one | 10% vs 1% | **0.80** |
| Tribe immunity | Tribe bigger than the others | 77% vs 52% | 0.63 |
| Voted with majority (pre-merge) | Own voting record so far | 74% vs 58% | 0.59 |
| Individual immunity | Past individual wins | 24% vs 15% | 0.59 |
| Voted with majority (post-merge) | Own voting record so far | 71% vs 60% | 0.56 |
| Tribe immunity | Tribe's win record so far | 67% vs 60% | 0.55 |
| Voted out | Votes received last Tribal / so far | 16–21% vs 13–16% | 0.52–0.55 |
| Idol found | Past finds | — | **0.46** (worse than a coin flip) |
| Voted out / majority | Confessional share (the edit) | — | 0.49–0.54 |

- The owner's point holds for **majority and zero votes**: they're the best gameplay signal and partly
  readable from voting history. Reading alliances is a real manager skill here.
- **Tribe immunity** is a real decision but mostly a coin flip with a tilt; tribe size is the best tell.
  Its weight (22% of points, plus stacked rewards) is too heavy for how weakly it tracks good play.
- **Idol finds** are unpredictable and barely tied to doing well, yet were 10% of points.
- **Confessional counts** (the edit) predicted almost nothing week to week.
- Weekly scores are noisy under **any** values: ranking starters by their points so far predicts an
  above-median week at AUC ≈ 0.54–0.55 for both the current and proposed values. Scoring changes *what*
  gets rewarded, not how predictable weeks are; manager skill shows up as small edges over a season.

### 3.4 Per-start value

- Pre-merge: a starter whose tribe won immunity averaged **2.7** points; one who went to Tribal **1.5**
  (including the chance of −3).
- Post-merge: an individual immunity winner averaged **6.3** (immune players still collect majority and
  zero-vote points); a non-immune Tribal attendee **1.7**.

### 3.5 Archetypes: good players vs players who lasted

Going far and playing well aren't the same thing: good players get targeted *because* they're good,
cockroaches last without being threats, and winners usually combine both. survivoR's **Castaway
Scores** table separates these: outwit / outplay / outlast scores plus a **challenge threat** and
**strategic threat** score (stats from [survivorstatsdb.com](https://survivorstatsdb.com); field
definitions in `man/castaway_scores.Rd` in the survivoR repo).

Archetypes, seasons 41–50. Points per episode **before finale points**, as a percentile within their
own season (50 = average):

| Archetype | n | Avg finish | Current | Proposed |
|---|---|---|---|---|
| Sole Survivor | 10 | 1st | 84 | **89** |
| Finalist with 0 jury votes | 8 | 3rd | 81 | 84 |
| Strategic threat (top 15%) | 18 | 4th | 79 | 82 |
| Challenge beast (top 15% challenge threat) | 24 | 6th | 79 | 82 |
| **Targeted threat** (top 25% threat, out post-merge before FTC) | 21 | 7th | 69 | **73** |
| Cockroach (final 6, below-median threat) | 9 | 5th | 57 | 59 |
| Pre-merge boot | 65 | 16th | 29 | 25 |

- **Targeted threats score like good players**, not early boots (Ricard, Drea, Maria, Kyle, Cody ≈ 90th
  percentile per episode under proposed values). Their −3 on the way out is the roster decision: bench
  the threat the week the target lands.
- **Cockroaches** score about average per week and collect by lasting.
- Points per episode vs skill (mean of outwit + outplay, excluding outlast), among post-merge players:
  **0.48 current → 0.60 proposed**. Caveat: those skill scores are partly built from the same challenge
  and vote events being scored, so it's not a fully independent check.

**The "goat" label is wrong.** The new-era finalists with zero jury votes are Xander, Joe, Owen, Jake,
Carolyn, Ben, Sue and Romeo. Most aren't goats in the fan sense; Xander and Joe were their season's top
scorers before the finale. The category mostly catches **strong players the jury punished**. The −3 is
still defensible (it nets the finalist +3 to 0 after a season of banked points), but the label should
drop "(goat)".

### 3.6 Current vs proposed, on the same ten seasons

| | Current | Proposed |
|---|---|---|
| Share of + points from weak, hard-to-predict categories¹ | 55% | 44% |
| Points per episode vs how far players go | +0.68 | +0.82 |
| Points per episode vs skill (post-merge players) | 0.48 | 0.60 |
| Week-to-week predictability (AUC) | 0.54 | 0.55 |
| Winner's rank in pre-finale points, S41–S50 | 4,1,5,9,4,1,1,1,1,2 | 3,1,4,5,3,1,1,1,1,3 |

¹ Tribe immunity, reward win, idol found, journey, chosen for reward, 2nd/3rd place.

---

## 4. Reasoning per change

- **2nd / 3rd place → 1 / 0.5.** Only 18% of individual challenges record finishing order, so a high
  value rewards whichever weeks happened to get reported. At 2 it was also two-thirds of a win, and a
  win is what decides the game.
- **Tribe immunity 1.5 → 1.** Largest single category, weakly tied to good play (+0.19), weakly
  predictable (0.55–0.63). Still worth something: avoiding Tribal is survival, and tribe size gives a
  manager a real read.
- **Idol found / played / cancelled votes: 3 / 2 / 2 → 2 / 1 / 3.** Moves points from the unpredictable
  find (AUC 0.46) to the successful play. Holding an idol is the most predictable signal in the game
  (0.80), so the payoff for fielding a holder is a real manager reward. A successful idol still totals 6;
  a wasted play gets 1. Same shape as Purple Rock's league (find 3, successful play 4).
- **Zero votes 0.5 → 1.** A stronger good-play signal than surviving votes (+0.46–0.62 vs +0.14), which
  is worth 1.
- **Voted against majority −0.2 → −0.25 (tiebreaker).** The data says it isn't bad play (+0.19), but it's
  a fun "missed read" flag, so it stays at a size that can't decide anything. An average player does it
  0.8 times a season (max seen: 5 → −1.25), against a median of 24 season points for players who make
  the merge. At −0.25 it changes the season-total order of **0.3%** of player pairs (5 of 1,653); at
  −0.5 it would be 1.4%. A positive value would read oddly (rewarding being on the wrong side), so it
  stays negative.
- **Journey 1 → 0.5.** Journey-goers tend to go out earlier (−0.16), and about a quarter of journeys
  cost a vote. Still non-zero; any advantage found there also scores "found".
- **Learned about someone else's idol — 0.5, assuming it can be detected reliably.** Reasoned, not
  measured. Being told about an idol is a trust signal: it says you're inside an alliance, the same
  kind of read as being chosen to join a reward (also 0.5). That kind of standing does track good play
  (majority voting is the strongest signal in section 3.2), and a manager can partly see it coming
  (strong-alliance players get told). But the castaway doesn't *do* anything, so it belongs below a
  find (2) and at the bottom of the positive values. Two counting rules matter more than the value:
  1. **Once per person per advantage.** Learning about the same idol again next week scores nothing.
  2. **Private knowledge only** — learned alone, or within an alliance or small group. When an idol is
     played at Tribal everyone learns about it, so that must not count.
  Both rules are now in the research question (`learnedOfAdvantage` in `checklistSchema`) and the
  scoring label ("Learned of an idol/advantage (privately)"; once per advantage is in the research question only). Research
  answers one episode at a time, so "once per advantage" relies on the model knowing what came before;
  there is no code-level de-duplication by advantage.
  Without those rules it would be one of the most frequent events in the game and quietly become a
  large passive category.
- **Reward win — kept at 1, but split it.** 16% of points, mostly from tribe challenges where immunity was
  paid too. Lowering it to 0.5 improved every measure, but it would also cut individual reward wins,
  which are real achievements. The clean fix is splitting `rewardWin` into tribe reward and individual
  reward (code change in `survivor.js` events + `researchItems`, which already has `wonTribeReward` /
  `wonIndividualReward` separately).

---

## 5. Scaling everything up (×2)

Multiplying every value by the same number **changes nothing in the standings**: rankings and relative
gaps stay identical. It's purely cosmetic: whole numbers are easier to read and type. With the
proposed values the smallest step is 0.5, so ×2 makes everything whole except voted-against (−0.5,
which suits the settings inputs' 0.5 step).

Side effects:

- **Predictions count for half as much.** Side-bet predictions are added to the same total and are
  clamped to 1–3 points in code (`MAX_BET_POINTS` / `clampBetPoints` in `state-logic.js`). Doubling the
  event values halves their weight unless that cap is raised.
- **"Use recommended values" resets to the built-in defaults**, which are on the old scale, unless the
  defaults in `survivor.js` are updated to match.

---

## 6. What the data can't measure

Villain, hero and social superlatives are about perception, not what happened in the game, so no stats
table has them. Options, none perfect:

1. **Fan polls and rankings** (r/survivor community rankings, podcast awards): real sentiment, but
   scattered and inconsistent across seasons.
2. **An AI reading of each player's wiki page and recaps**: the episode research setup (`db/episode-research.js`)
   already does this kind of reading and could tag players. Consistent, but an opinion.
3. **Jury votes as "social"**: the only objective social measure, and only for finalists.

Recommendation: **don't put superlatives in weekly scoring.** They're judged after the fact, so a
manager can't act on them week to week, and they're subjective, so disputes have no clean answer.
They'd work as **end-of-season awards / badges**, or as **prediction questions** ("Who will be this
season's villain?") through the existing side-bet system.

---

## 7. How other leagues score

- **[Purple Rock Podcast Pick-4 (S51)](https://www.purplerockpodcast.com/pick-4-survivor-51-fantasy-league-presented-by-the-purple-rock-survivor-podcast/):**
  tribe reward 1 (3-tribe: 2/1), tribe immunity 2 (3-tribe: 3/2), individual reward 2, individual
  immunity 4, find idol 3, play idol successfully 4, vote for who goes home 1 pre-merge / 2 post-merge,
  making the merge 3, fire-making win 2, each FTC vote 2. Advantages earned outside challenges score
  nothing.
- **[Fantasy Survivor Game](https://www.fantasysurvivorgame.com/rules.html):** tribe immunity 3,
  individual immunity 2.
- **[FanDuel's printable sheet](https://www.fanduel.com/research/theduel/survivor-fantasy-league-how-to-play-rules-printable-scoring-sheet-01e0tkftrm6y/):**
  immunity 2, find idol 2, play idol 1, reward 1, big bonus for picking the winner.

Common thread: individual immunity and successful idol plays are the big-ticket items, finds are
worth less than (or equal to) successful plays, and correct votes are scored.

---

## 8. Open decisions

- [ ] Apply the proposed values to the league (base or ×2).
- [ ] If ×2: double the defaults in `survivor.js` so "Use recommended values" matches, and decide whether
      to raise `MAX_BET_POINTS` so predictions keep their weight.
- [ ] Rename "Finalist with no jury votes (goat)" → "Finalist with no jury votes".
- [ ] Split `rewardWin` into tribe reward and individual reward.
- [ ] Check whether research detects `learnedOfAdvantage` reliably before scoring it above 0. The two
      counting rules (private; once per advantage) are in the prompt and label as of 2026-10-02.
- [ ] Re-run this analysis when survivoR adds season 51 (the Exile Island season) to see whether
      exile and journeys should be worth anything.
- [ ] Superlatives as end-of-season awards or prediction questions (feature idea, not scoring).
- [ ] Test the exclusive vs shared split with mock exclusive leagues: does owning the Sole Survivor
      decide the league, and do the lower exclusive values fix it? Traitors did this
      (`docs/RESEARCH-traitors-scoring-values.md` §3.7); see BACKLOG.

## 9. Re-running this

1. Download `https://github.com/doehm/survivoR/raw/master/dev/xlsx/survivoR.xlsx` and load the sheets
   listed in section 2 with pandas (`openpyxl` needed), filtered to `version == 'US'` and the seasons
   wanted.
2. Build one row per castaway per episode in the game (episode 1 through their exit episode; the
   finale for finalists) and map events as in the table in section 2.
3. Score with a values map; compare value sets with the measures in section 2, using per-Tribal and
   per-pre-merge-episode rates rather than per-episode rates.
4. Archetypes come from the Castaway Scores sheet (`threat_challenge`, `threat_strategic`,
   `threat_level`, `score_outwit`, `score_outplay`, `score_outlast`).

## Sources

- survivoR dataset: https://github.com/doehm/survivoR (Castaway Scores definitions: `man/castaway_scores.Rd`)
- Survivor Stats DB (source of the threat/skill scores): https://survivorstatsdb.com
- Purple Rock Podcast Pick-4 S51 scoring: https://www.purplerockpodcast.com/pick-4-survivor-51-fantasy-league-presented-by-the-purple-rock-survivor-podcast/
- Fantasy Survivor Game rules: https://www.fantasysurvivorgame.com/rules.html
- FanDuel fantasy Survivor scoring sheet: https://www.fanduel.com/research/theduel/survivor-fantasy-league-how-to-play-rules-printable-scoring-sheet-01e0tkftrm6y/
- UCLA DataRes, An Analysis of Survivor Winners: https://ucladatares.medium.com/an-analysis-of-survivor-winners-38925081aaf9
- True Dork Times winners' box scores: https://www.truedorktimes.com/survivor/boxscores/winners.htm

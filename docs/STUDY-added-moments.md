# Study: does the feasibility ask predict what research returns? (G1 part 4)

For the user, 2026-11-07. The user's concern (docs/PLAN-start-a-game-gpt.md, the Decisions table's "A preset's rule"): what a moment's
rating says research can answer may differ from what research actually returns at the end of each episode. Before a season can add
its own moments (G1 part 4), this measures it on the season tapes (`C:\Users\conor\rfl-tapes`), with `scripts/dev-test/moment-asks.js`
(the local bot only, at 127.0.0.1:8765, one question at a time while it was idle; nothing written to any database). The answers are
kept beside the tapes (`<show>\<season>\moments\`), never over one.

## What was measured

1. **What research returned** for every yes-or-no question it was asked, on every recorded episode's full research (15 seasons,
   five shows; no bot): an episode is **settled** when someone's answer is yes or everyone's is no (what "did it happen?" needs),
   and the share of people answered unknown.
2. **The feasibility ask** (`momentPrompt`, as our check asks it: how reliably research could answer it each episode, from what's
   usually written; no web search) for each of those questions on one season of each show (Survivor 50, The Challenge 41, The
   Traitors 4, Below Deck 12, Dancing with the Stars 34), the question itself left out of the moments it lists, and for 18 moments
   the shows don't have (someone cries, a blindside, a fight, a hookup, a standing ovation...).
3. **The added moments' short ask** (`db/moments-research.js`, with web search) for those 18 on four recorded episodes of each
   season (Below Deck: three read), asked as if the full run had said nothing about them: the worst case, since live it asks only
   what the full run left unknown. Settled: a sure no, or a sure yes naming someone in the cast.

Accuracy isn't measured: there's no truth on file for these moments (a spot check reads plausibly: Survivor 50 Episode 5's crying
and blindside both name the person voted out). What's measured is how often research says anything for sure, which is what a game
can score on.

## The answer

| The rating | Questions research already asks (the full run, 7 to 62 episodes each) | Moments the shows don't have (the short ask, 3 or 4 episodes each) |
|---|---|---|
| high | 10 questions, settled on average **99%** (every one 90% or more) | none rated high |
| medium | 24, on average **93%** (17 at 90% or more, 1 under 70%) | 10, on average **60%** (3 at 90% or more: Survivor's crying and blindside, The Traitors' accusations; 6 under 70%) |
| low | 9, on average **83%** (5 at 90% or more, 3 under 70%) | 8, on average **53%** (none at 90%, 5 under 70%) |

- **The rating orders reliability, but doesn't give its level.** High is safe; medium and low overlap widely. On the questions
  research already asks, the bot is cautious (Dancing with the Stars' lowest score rated low, settled every week); on new moments it
  is optimistic (The Challenge's fight rated medium, settled one week in four).
- **A new moment is much less reliable than the show's own**, at the same rating: a medium new moment would be void about 40% of
  episodes. Recaps say what the show is built around (who won, who went home); a moment nobody asked about before is said when it's
  a story (Survivor's tears and blindsides are; a fight in The Challenge's house mostly isn't, in the recaps the bot found).
- So the bar alone can't promise a game plays: the nets the Decisions table's recommendation names carry it. **An episode research
  can't settle is void** (built: no points either way), and **the moment's real rate as the season goes** is what to show the maker
  (not built: U1's).

## Recommendation (the user's call: the Decisions table's "Custom moments" bar)

Keep **medium** as the bar (high would offer almost nothing new: no new moment was rated high), and add one net before games lean on
it: after an added moment's first three asked episodes, its settled rate is known; under 50%, the wizard says so to anyone making a
game on it, and the maker of a game already on it is told (the void already keeps scoring fair). The rating shown when it's offered
should say plainly that recaps may miss it. Measure again on Survivor 51's live episodes once a moment is added there.

## The numbers

### Each moment: its rating and what research returned

Research asks it: the full run's checklist on the tapes (episodes across the show's taped seasons). No: the short ask on this
study's episodes.

| Show | Moment | Research asks it | Rated | Episodes | Settled | Happened |
|---|---|---|---|---|---|---|
| Survivor | merged | yes | high | 0 | - | 0 |
| Survivor | attendedTribal | yes | medium | 39 | 100% | 39 |
| Survivor | wonIndividualImmunity | yes | high | 39 | 100% | 24 |
| Survivor | wonTribeImmunity | yes | high | 39 | 100% | 17 |
| Survivor | wonIndividualReward | yes | medium | 39 | 100% | 15 |
| Survivor | wonTribeReward | yes | medium | 39 | 97% | 23 |
| Survivor | satOutOfChallenge | yes | medium | 39 | 97% | 15 |
| Survivor | chosenForReward | yes | medium | 26 | 96% | 7 |
| Survivor | wonFireMaking | yes | high | 26 | 100% | 2 |
| Survivor | foundAdvantage | yes | medium | 39 | 100% | 21 |
| Survivor | playedAdvantage | yes | high | 39 | 100% | 22 |
| Survivor | advantageUsedAgainstThem | yes | medium | 39 | 100% | 7 |
| Survivor | learnedOfAdvantage | yes | low | 26 | 62% | 12 |
| Survivor | wentOnJourney | yes | medium | 26 | 100% | 9 |
| Survivor | exiled | yes | high | 39 | 100% | 3 |
| Survivor | cried | no | medium | 4 | 100% | 4 |
| Survivor | blindsided | no | medium | 4 | 100% | 4 |
| Survivor | hurt | no | medium | 4 | 50% | 1 |
| Survivor | family | no | low | 4 | 50% | 2 |
| The Challenge | wonDailyChallenge | yes | medium | 59 | 88% | 44 |
| The Challenge | wasCaptain | yes | low | 59 | 75% | 9 |
| The Challenge | wasNominated | yes | medium | 59 | 95% | 51 |
| The Challenge | competedInElimination | yes | high | 59 | 97% | 49 |
| The Challenge | wonElimination | yes | high | 59 | 90% | 44 |
| The Challenge | cried | no | low | 4 | 75% | 3 |
| The Challenge | fight | no | medium | 4 | 25% | 0 |
| The Challenge | hurt | no | medium | 4 | 25% | 1 |
| The Challenge | drunk | no | low | 4 | 25% | 1 |
| The Traitors | isTraitor | yes | high | 34 | 100% | 33 |
| The Traitors | becameTraitor | yes | medium | 34 | 100% | 4 |
| The Traitors | recruitedAsTraitor | yes | medium | 34 | 100% | 3 |
| The Traitors | declinedRecruitment | yes | low | 34 | 94% | 1 |
| The Traitors | attendedRoundTable | yes | high | 34 | 100% | 29 |
| The Traitors | wonShield | yes | medium | 34 | 97% | 21 |
| The Traitors | gaveShield | yes | low | 34 | 100% | 5 |
| The Traitors | wonPower | yes | medium | 34 | 97% | 2 |
| The Traitors | missionStandout | yes | low | 34 | 91% | 8 |
| The Traitors | missionBlunder | yes | medium | 34 | 79% | 6 |
| The Traitors | onMurderShortlist | yes | medium | 34 | 94% | 13 |
| The Traitors | consideredForMurder | yes | low | 34 | 100% | 27 |
| The Traitors | shieldSavedThem | yes | medium | 34 | 100% | 1 |
| The Traitors | cried | no | low | 4 | 75% | 4 |
| The Traitors | accused | no | medium | 4 | 100% | 4 |
| The Traitors | lastIn | no | low | 4 | 25% | 1 |
| Below Deck | tipRevealed | yes | medium | 50 | 70% | 17 |
| Below Deck | largeTip | yes | low | 50 | 62% | 8 |
| Below Deck | crewParty | yes | medium | 50 | 88% | 30 |
| Below Deck | romanticDevelopment | yes | medium | 50 | 84% | 41 |
| Below Deck | romanticConflict | yes | medium | 50 | 68% | 32 |
| Below Deck | crewConfession | yes | low | 50 | 60% | 29 |
| Below Deck | cried | no | low | 3 | 33% | 1 |
| Below Deck | hookup | no | low | 3 | 67% | 2 |
| Below Deck | drunk | no | medium | 3 | 33% | 1 |
| Below Deck | complaint | no | medium | 3 | 67% | 1 |
| Dancing with the Stars | perfectScore | yes | medium | 32 | 100% | 11 |
| Dancing with the Stars | highestScore | yes | medium | 32 | 100% | 32 |
| Dancing with the Stars | lowestScore | yes | low | 32 | 100% | 31 |
| Dancing with the Stars | atRisk | yes | medium | 32 | 78% | 19 |
| Dancing with the Stars | guestJudgePresent | yes | high | 32 | 100% | 13 |
| Dancing with the Stars | cried | no | low | 4 | 75% | 2 |
| Dancing with the Stars | ovation | no | medium | 4 | 25% | 1 |
| Dancing with the Stars | hurt | no | medium | 4 | 75% | 3 |

high: 10 moment(s), settled on average 99%; 9 at 90% or more, 0 under 70%
medium: 34 moment(s), settled on average 83%; 20 at 90% or more, 7 under 70%
low: 17 moment(s), settled on average 69%; 5 at 90% or more, 8 under 70%

### What the full run returned, every taped season

Settled: someone's yes or everyone's no. Everyone: every person's answer yes or no (what "who did it?" needs). Unknown: the share of people answered unknown.

**Survivor**

| Question | Episodes | Settled | Everyone | Unknown |
|---|---|---|---|---|
| advantageUsedAgainstThem | 39 | 100% | 100% | 0% |
| attendedTribal | 39 | 100% | 100% | 0% |
| chosenForReward | 26 | 96% | 96% | 0% |
| exiled | 39 | 100% | 100% | 0% |
| foundAdvantage | 39 | 100% | 100% | 0% |
| learnedOfAdvantage | 26 | 62% | 31% | 51% |
| newGroup | 1 | 0% | 0% | 100% |
| playedAdvantage | 39 | 100% | 100% | 0% |
| satOutOfChallenge | 39 | 97% | 97% | 4% |
| wentOnJourney | 26 | 100% | 100% | 0% |
| wonFireMaking | 26 | 100% | 100% | 0% |
| wonIndividualImmunity | 39 | 100% | 100% | 0% |
| wonIndividualReward | 39 | 100% | 100% | 0% |
| wonTribeImmunity | 39 | 100% | 97% | 0% |
| wonTribeReward | 39 | 97% | 97% | 3% |

**The Challenge**

| Question | Episodes | Settled | Everyone | Unknown |
|---|---|---|---|---|
| competedInElimination | 59 | 97% | 83% | 4% |
| wasCaptain | 59 | 75% | 73% | 21% |
| wasNominated | 59 | 95% | 76% | 10% |
| wonDailyChallenge | 59 | 88% | 75% | 14% |
| wonElimination | 59 | 90% | 73% | 23% |

**The Traitors**

| Question | Episodes | Settled | Everyone | Unknown |
|---|---|---|---|---|
| attendedRoundTable | 34 | 100% | 97% | 0% |
| becameTraitor | 34 | 100% | 100% | 0% |
| consideredForMurder | 34 | 100% | 82% | 12% |
| declinedRecruitment | 34 | 94% | 94% | 0% |
| gaveShield | 34 | 100% | 97% | 3% |
| isTraitor | 34 | 100% | 97% | 0% |
| missionBlunder | 34 | 79% | 76% | 15% |
| missionStandout | 34 | 91% | 91% | 8% |
| onMurderShortlist | 34 | 94% | 91% | 3% |
| recruitedAsTraitor | 34 | 100% | 100% | 0% |
| shieldSavedThem | 34 | 100% | 100% | 0% |
| wonPower | 34 | 97% | 97% | 1% |
| wonShield | 34 | 97% | 91% | 6% |

**Below Deck**

| Question | Episodes | Settled | Everyone | Unknown |
|---|---|---|---|---|
| crewConfession | 50 | 60% | 10% | 76% |
| crewParty | 50 | 88% | 38% | 26% |
| largeTip | 50 | 62% | 60% | 40% |
| romanticConflict | 50 | 68% | 18% | 58% |
| romanticDevelopment | 50 | 84% | 22% | 50% |
| tipRevealed | 50 | 70% | 68% | 32% |

**Dancing with the Stars**

| Question | Episodes | Settled | Everyone | Unknown |
|---|---|---|---|---|
| atRisk | 32 | 78% | 75% | 19% |
| guestJudgePresent | 32 | 100% | 100% | 0% |
| highestScore | 32 | 100% | 100% | 0% |
| lowestScore | 32 | 100% | 100% | 0% |
| perfectScore | 32 | 100% | 100% | 0% |

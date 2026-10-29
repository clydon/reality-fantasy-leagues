# Study: format changes nobody announced (F1)

For the user to read. Step F1 of [PLAN-start-a-game-gpt.md](PLAN-start-a-game-gpt.md), "Formats nobody announced": take
seasons whose stages are known, lay out how their format changed episode by episode, and check what each episode's
research (today's prompt, recorded on the season tapes) said about each change, and whether the engine could act on it.
Written 2026-10-28 on the `engine` branch. Nothing here changes the app, the research prompt or the engine.

**The proposals at the end (the change vocabulary, the format state's shape and the prompt section) are the user's to
approve at the merge** that brings F2 to production. Research's prompt is shared by every show's research, production's
included, so F2 changes it on the `engine` branch only.

## How it was made

- **The ground truth**: each season's Wikipedia page, read from its raw wikitext (the revision is in each file) and
  hand-checked: the format section, the game summary (who went home and how) and, for The Challenge, the team-progress
  table (who was paired or teamed with whom, episode by episode). It's stored as data in
  `tests/fixtures/format-timelines/<show>-<season>.json`, under the tapes' cast names (The Challenge 39 isn't on tape: it
  uses Wikipedia's short names). A grouping is a list of **spells**: who was with whom, from when it took effect (an
  episode's start, or partway through it) and when viewers learned of it (shown at an episode's start, mid-episode or end).
- **What research said**: the season tapes (`C:\Users\conor\rfl-tapes`, [PLAN-playtests.md](PLAN-playtests.md)). The
  Challenge 41, The Challenge 40 and The Traitors 4 were recorded on 2026-10-28 with today's prompt. Survivor 49's research
  is the one stored in production before the tapes, from **before** `newGroup` and `rulesNote` existed (so its swaps can't
  show what today's prompt would do; F2 asks those episodes again).
- **The script**: `node scripts/dev-test/format-study.js` (`--md` for these tables, `--check` for the fixtures' own checks).
  It works out every change by **comparing one spell with the next**, our code and not anyone's labels, the way F3 will,
  then looks for each change in the research of the episode it was shown in, the episode it took effect and the one after
  (a late report). Its pure parts are tested in `tests/format-study.test.js`, and F2 scores against them
  (`stateAtEnd`: the groups as known at an episode's end).
- **Seasons**: The Challenge 41 (*Vets & New Threats*: rotating pairs, an individual episode, locked pairs, a claim), 40
  (*Battle of the Eras*: era teams, then individual), 39 (*Battle for a New Champion*: new pairs or teams every episode,
  then individual; not on tape, so its timeline only), Survivor 49 (two swaps and the merge) and The Traitors 4 (a Secret
  Traitor, a recruit, the Dagger). The Challenge 40 finished recording its full research during this step and is now
  loaded into this lane's database too (its first golden replay: 22 games, 3,772 reads, every one the same).

## What it found

1. **Of 35 changes on tape, the engine could act on one.** The Traitors 4's recruit (Eric Nam) is data
   (`recruitedAsTraitor`), and the engine already moves his role. Everything else, every swap, re-pairing, split, merge,
   claim, newcomer, phase and twist, came only as free text. On the four seasons on tape: Survivor 49, 4 changes, all free
   text; The Challenge 40, 8, all free text; The Challenge 41, 17, all free text; The Traitors 4, 6, one acted on.

2. **Today's prompt asks about the wrong grouping on The Challenge.** It knows one group per person: the cast list's
   (`tribe_name`), named by the format's word for it, and it asks for `newGroup` only when *that* group changes. On The
   Challenge 41 the cast's group is **Vets or New Threats** (a label nobody changes) and the format's word is **"agency"**
   (the built-in Challenge format's term, from *Spies, Lies & Allies*), so the prompt says: "If agencys were swapped,
   re-divided, dissolved or merged in this episode, give each person's new agency in newGroup". The bot rightly left
   `newGroup` empty every episode: the pairs, which are what people actually play in, aren't a group the prompt knows. The
   Challenge 40's cast group is the era (Era 1-4): right for episodes 3-9, when the eras were the teams, but the change
   that mattered (teams to individuals, Episode 10) isn't a change of anyone's era.

3. **The pairings are there, in free text, one person at a time.** In The Challenge 41's Episode 5 every pair was redrawn,
   and its research says so only in per-person `notableTwist` notes (28 notes for the 29 people listed, 23 of them saying
   who they're paired with now: "Re-paired with Gabe Wai at the end of the episode.", "Re-paired with Cedric Hodges.") and
   one line of summary ("the remaining contestants selected new partners, reshuffling
   the pairings"), next to Cara Maria leaving, a coin toss and an alternate arriving. Counting pairs a member's note names
   together: Episodes 4 to 7's notes name 13 of 14, 12 of 13, 11 of 13 and 11 of 12 of the pairs for the next episode. But
   the notes don't say which pairs they mean: Episode 4's mix the pairs that played ("His pair with Adrienne Naylor won
   their heat") with the pairs for Episode 5 ("Paired with Yeremi Hykel."), in the same words.

4. **Some changes leave nothing at all.** The Lock In (Episode 9's end: twelve permanent pairs, chosen in points order):
   `rulesNote` says "The Lock-In establishes permanent partnerships for the remainder of the season", and every note says
   "her specific assignment could not be verified". Episode 10's notes name 5 of the 12 pairs in passing. Stake a Claim
   (from Episode 10) first appears in Episode 11's summary. The claim that re-formed two pairs mid-Episode 16 is in the
   summary and two notes.

5. **A change of how people play comes through `rulesNote` when the show announces it**, as one sentence: The Challenge
   40's "TJ announces that the team phase is over and the game will proceed individually" (Episode 9) and The Challenge
   41's Lock In (announced in Episode 7, done in 9). That's because `rulesNote` asks for "a change to how the game is
   played that is new this season"; a format the show always has (Survivor's swap and merge, The Challenge's final) isn't
   new, so it isn't there. Today a `rulesNote` asks the couches "It's new / Not new" and can add a moment to the rulebook
   when two agree; it never touches a game's groups or structure.

6. **A format change also breaks who went home.** From Episode 10 of The Challenge 41 a pair goes home together. Episode
   12's full research kept Dee in ("sending Derrick home while Dee survives"; the quick check had both). Episode 16's claim
   moved Will onto Aviv's team mid-episode, and the full research lost him. Episode 11's full research had Leo and Will leaving
   (citing later episodes) instead of Gabe and Jonna, and because the next episodes' prompts list only who's still in, Leo and
   Will were never asked about again (Leo's real exit in 14, Will's in 16 couldn't be reported) while Gabe stayed listed.
   F2's format section helps here: "this episode a whole pair went home" is a check our code can make on the exits.

7. **A newcomer isn't in the cast.** Jonna Mannion came in for Cara Maria at Episode 5's start. She was never on the
   research's list, so no answer could give her a result, a group or an exit (she went home in Episode 11 with Gabe). The
   format section needs a place for someone new.

8. **Changes don't all come at the same moment.** By when the show brought them in: at the end of the episode before
   (The Challenge 41's seven re-pairings after each elimination, the Lock In, The Challenge 40's end of the team phase),
   at an episode's start (Survivor 49's swaps in 4 and 6, the merge in 7; Jonna's arrival;
   Theo's MRI sitting him out of Episode 8, so Will took his place beside Dee), mid-episode (the claim in 16; The Traitors'
   twists), and announced ahead (the Lock In, three episodes early). Two pairs were **shown and never played**: Cara Maria &
   Leo (shown at Episode 4's end; she left before Episode 5) and Theo & Dee (shown at 7's end; the MRI at 8's start).

9. **How long groupings lasted** (the "when a grouping lasts" note):
   - The Challenge 41: 112 rotating pairs in episodes 1-8, **every one for one episode** (the rule: never the same partner
     twice); none in Episode 9 (individual); then 12 locked pairs from Episode 10, lasting 1 to 10 episodes (until they
     went home), two of them broken by the claim in 16, which made two new ones. 126 pairs in all.
   - The Challenge 39: 47 pairs and teams in episodes 5-14, **every one for one episode** (drawn for each challenge); then
     individual.
   - The Challenge 40: the four eras never changed members (they were the teams in episodes 3-9, then a label).
   - Survivor 49: the starting tribes lasted 3 episodes, the first swap's 2, the second swap's 1, the merged tribe 7.
   - What it means for "a side draft once a grouping has held 2 episodes": on The Challenge 41 it opens once, after
     Episode 11 (the locked pairs); never in episodes 1-8; never on The Challenge 39; on Survivor 49 after Episode 2, again
     after 5 (closing at 6's swap), and after 8 for the merged tribe. **Group slots** (a +1 pair slot): on The Challenge 41
     they'd open after each of episodes 1-7 for one episode and drop every week, then hold from Episode 10 up to the end.
   - Whether someone going home ends their group matters: by exact members (an exit ends it), Survivor 49's tribes last 1
     to 3 episodes and The Challenge 40's eras 1 to 5; if leaving doesn't end it, 1 to 7 and the whole season. (A
     question for the user, below.)

## Per season: the changes and what research said

(The full tables, with each episode's phase, how it was played, the groups and who went home, are in the appendix.)

**The Challenge 41.** Seven re-pairings (end of 1 to 7), each "every group new", and the notes name most of the next
pairs at the episode they were drawn in; a newcomer at 5's start (Jonna, in the summary: "Jonna Mannion entered as an
alternate"); Theo's MRI at 8's start (only in the notes, as who partnered whom in Episode 8's challenge); the individual
Episode 9 (nothing says so but "the Mini-Final"; the script's match on "individual" is the summary's "every individual
performance"); the Lock In at 9's end (rulesNote, as a sentence, with no pairs); Stake a Claim
(first named in 11's summary, a week late); the claim at 16 (summary and two notes); the final at 18. **Engine today:
can't act on any of them.**

**The Challenge 40.** The Era Invitational and the Karma Vote (rulesNote, Episodes 1-2); the eras becoming teams at 3
(rulesNote mentions teams); targets (rulesNote at 3's end); individual play from 10 (rulesNote at 9's end and 10); the
Purge at 12 (summary only: "a punishing mini-final that doubled as a purge"); the final's scoring with karma points
(rulesNote, 18). **Engine today: can't act on any of them.**

**Survivor 49** (stored research from before `newGroup`). The swap to two tribes at 4's start (summary: "The game swapped
from three tribes to two"; notes: "Swapped to Hina"), back to three at 6 (summary: "reshuffled from two tribes back to
three"), the merge at 7 (summary: "The remaining 11 castaways merged at Kele"), the split immunity at 8 (summary). Today's
prompt would ask `newGroup` (each person's new tribe) and `merged`, which the engine acts on; F2 re-asks 4, 6 and 7 to see.

**The Traitors 4.** The Secret Traitor (rulesNote, 1), a murder in plain sight (rulesNote, 2), the collective shield
(rulesNote, 5), the Dagger (rulesNote, 7), Eric's recruitment (**`recruitedAsTraitor`, acted on**, 9; the ultimatum in 8's
summary), the endgame (summary, 11). No groupings: everyone plays for themselves, with secret roles.

**The Challenge 39** (not on tape): Control (everyone together, 1-4), Chaos (pairs or teams drawn every episode, 5-14:
pairs, then three teams, six teams, two teams, pairs and a trio, two teams, four teams four times), Conquest
(individual, 15-17), the final (as a group, then random pairs per checkpoint, then individual). The hardest case for any
game built on groups: nothing lasts.

## Proposals for F2 (the user's to approve at the merge)

### The change vocabulary

Our code names a change by comparing an episode's format state with the one before (as `format-study.js` does now), so the
bot's own label is a cross-check, not the truth: when they disagree, the change is treated as unsure (the safe fallbacks
only, flagged), as the 8:15 PM note asks. The kinds:

| Kind | Means | Seen in |
|---|---|---|
| `teams-formed` | people now play as teams or tribes (from individuals, pairs or one group) | The Challenge 40 ep 3, 39 ep 6 and 10 |
| `pairs-formed` | people now play in pairs | The Challenge 41 ep 10 (the Lock In), 39 ep 5 and 9 |
| `split-into-individuals` | the groups end; everyone for themselves | The Challenge 41 ep 9, 40 ep 10, 39 ep 15 |
| `merge` | the groups become one (Survivor's merge) | Survivor 49 ep 7 |
| `swap` | people moved between groups of the same kind: some (a claim, a substitution) or all (a re-draw: "every group new") | Survivor 49 eps 4, 6; The Challenge 41 eps 2-8, 16; 39 eps 7-14 |
| `newcomer` | someone new joined the game (an alternate, a returning player) | The Challenge 41 ep 5 |
| `new-phase` | the season moved into a stage of its own, groups changing or not (the Lock In, Conquest, the final, the endgame) | all |
| `twist` | a rule changed how the game is played, not who's with whom (a purge, a double elimination, the Dagger, a Secret Traitor) | all |
| `role` | someone's secret role changed (a recruit) | The Traitors 4 ep 9 |

"Major" (for a stage that starts on a change, A12) is then a list of these kinds in the spec. A sensible default, for the
user to choose: `teams-formed`, `pairs-formed`, `split-into-individuals`, `merge`, and a `swap` where every group is new.

### The format state's shape (one per episode, at its end)

```jsonc
{
  "playedAs": "pairs",            // how this episode's main contest treated people: everyone | tribes | teams | pairs |
                                  //   individuals | mixed | none (no game: a reunion)
  "phase": "Rotating pairs",      // the show's own name for the stage it's in, or null
  "groups": [                     // who is with whom at the END of this episode, going into the next: every group the
    { "name": null, "members": ["Aneesa Ferreira", "Gabe Wai"] },   //   show has now, its name if it has one
    { "name": null, "members": ["Ashley Mitchell", "Will Gagnon"] }
  ],                              // [] when everyone plays for themselves
  "alone": ["Olivia Kaiser"],     // in the game but in no group (unpaired, sitting out)
  "labels": null,                 // a fixed grouping that isn't how they play (Vets / New Threats), when the cast has one:
                                  //   kept from the cast, asked only if it changes
  "newcomers": [{ "name": "Jonna Mannion", "replaces": "Cara Maria Sorbello", "group": "Leonardo Dionicio" }],
  "wentHomeAs": "individuals",    // individuals | groups: did a whole pair or team go home together?
  "changes": [                    // the bot's own account, a cross-check on ours
    { "kind": "swap", "when": "end", "from": 6, "what": "Everyone chose a new partner after the elimination", "sure": "high" },
    { "kind": "newcomer", "when": "start", "from": 5, "what": "Jonna Mannion came in for Cara Maria", "sure": "high" }
  ]
}
```

- **The groups at the episode's end**, not who played in it, because that's what the next lock needs, and the groups that
  played an episode are the previous episode's end plus any `changes` this one made at its start or partway through.
- **Our code** (F3) keeps these as one state per episode and works out the changes and every grouping's lifetime itself;
  a report corrected later works everything after it out again.
- **Two layers, not one**: `groups` is how people play (pairs, teams, tribes); `labels` is a fixed classification the cast
  already has (Vets / New Threats, the eras when they aren't teams). Survivor's tribes are `groups`, with no `labels`.

### The prompt section (a draft of the words)

> **How the game is organised.** Going into this episode, as far as we know, people played as {pairs}; each person's
> {partner} is after their name above. Then, for the whole cast at once:
> - `playedAs`: how this episode's main challenge treated people: everyone together, tribes, teams, pairs, individuals,
>   mixed, or none (no game was played).
> - `groups`: who is grouped with whom at the END of this episode, going into the next one: every tribe, team or pair, its
>   name if the show gives one, its members by the names in the list. An empty list if everyone now plays for themselves.
>   Anyone still in the game but in no group (sitting out, unpaired) goes in `alone`.
> - `newcomers`: anyone who joined the game this episode and isn't in the list (an alternate, a returning player): their
>   name, who they replaced, and their group.
> - `wentHomeAs`: whether people went home on their own or a whole pair or team went home together.
> - `changes`: each change this episode made to who is grouped with whom or how the game is played, with its kind (one of:
>   teams-formed, pairs-formed, split-into-individuals, merge, swap, newcomer, new-phase, twist), when it happened (start,
>   mid, end), the episode it takes effect from (a later one if the show announced it ahead), one sentence on what it is,
>   and how sure you are (high or low: low if the sources don't say who is with whom). Nothing changed: an empty list.
>
> This is the only place a group change is recorded, so don't leave it in notableTwist alone.

It replaces today's `newGroup` per person and `merged` (both can be worked out from `groups`). The words for the groups
come from the season ({pairs}, {partner}, a tribe's name), not from the format's built-in term ("agency").

### How F2 proves it

Ask recorded episodes again with the new section, through the local bot only (`http://127.0.0.1:8765`, waiting for the tapes
recorder between questions), and score each answer against these timelines (`stateAtEnd`): `playedAs`; the groups at the
episode's end (each pair or team found exactly, each person's group); `alone`; newcomers; `wentHomeAs`; and the changes
(our code's from the bot's groups, and the bot's own, against the fixture's: kind, the episode it takes effect, when). A
first set, about 25 questions: The Challenge 41 episodes 4-10 and 16 (re-pairings, a newcomer, the MRI, the individual
episode, the Lock In, the claim), The Challenge 40 episodes 2, 3, 9, 10 and 12, Survivor 49 episodes 3-8 (asked with
today's prompt for the first time), and The Traitors 4 episodes 1, 7, 8 and 9.

## What it means for the steps after F2

- **F3** keeps the state per episode and the lifetimes as `format-study.js` does (`lifetimes`, `changes`, `stateAtEnd` are
  the first sketch), with a `label` layer apart from the `play` layer.
- **A10's group slots**: a group shown at an episode's end can be overtaken before it plays (Cara Maria & Leo, Theo & Dee);
  a group can change mid-episode (the claim in 16); a newcomer can join a group (Jonna). Each needs a rule (below).
- **A11's teams** read the same groups; on The Challenge 39 nothing lasts more than an episode.
- **A12's stages**: The Challenge 41 changed its structure three times (individual at 9, locked pairs at 10, the claim
  mechanic); The Challenge 40 once (individual at 10, announced at 9's end); The Challenge 39 three times (phases). Each was
  brought in a different way, so "from the episode research says it took effect" needs `from` and `when`, not only the
  episode it was mentioned in.

## Open questions for the user (with a recommendation; also in the plan's Noticed)

1. **Does someone going home end their group?** Recommended: no for a tribe or team (a tribe that loses a member is still
   that tribe; a slot riding with it carries on), yes for a pair (one person isn't a pair). Any join or move ends it.
2. **A group shown at an episode's end that changes before the next one starts** (a slot already picked on it): recommended,
   the slot is void for that episode (no points either way) and reopens for the next.
3. **A group that changes mid-episode** (The Challenge 41's claim): recommended, the group in force at the episode's start
   is the one that scored it (a slot keeps that episode's points), and the slot drops after it.
4. **The same members together again later** (it happens: rotating pairs can't, but tribes can): recommended, a new group,
   not the old one continuing.
5. **"Major" by default** for a stage started by a change: recommended, teams formed, pairs formed, split into individuals,
   the merge, and a swap where every group is new; not a partial swap, a newcomer, a phase or a twist.
6. **The vocabulary, the state's shape and the prompt section above**: the user's to approve at F2's merge.

## Appendix: the timelines

Generated with `node scripts/dev-test/format-study.js --md`. "Brought in" is when viewers learned of a change, against when it
took effect. "Research said" counts, per episode looked at (where it was shown, where it took effect, and the one after,
marked late), the fields that mention it and the words they matched; "names N of M groups" is how many of the change's new
groups a member's `notableTwist` names together. Lifetimes count the episodes a group was in play.

### Survivor 49 (survivor 49)

| Ep | Phase | Played as | tribes in play | Went home |
|---|---|---|---|---|
| 1 | Tribes | tribes | Hina 6, Kele 6, Uli 6 | Nicole Mazullo (voted out) |
| 2 | Tribes | tribes | Hina 6, Kele 5, Uli 6 | Annie Davis (voted out) |
| 3 | Tribes | tribes | Hina 6, Kele 4, Uli 6 | Jake Latimer (evacuated), Jeremiah Ing (voted out) |
| 4 | Tribes | tribes | Hina 7, Kele 7 | Matt Williams (voted out) |
| 5 | Tribes | tribes | Hina 6, Kele 7 | Jason Treul (voted out) |
| 6 | Tribes | tribes | Hina 4, Kele 4, Uli 4 | Shannon Fairweather (voted out) |
| 7 | Merged | individuals | Lewatu 11 | Nate Moore (voted out) |
| 8 | Merged | individuals | Lewatu 10 | MC Chukwujekwu (voted out) |
| 9 | Merged | individuals | Lewatu 9 | Alex Moore (voted out) |
| 10 | Merged | individuals | Lewatu 8 | Jawan Pitts (voted out) |
| 11 | Merged | individuals | Lewatu 7 | Sophie Segreti (voted out) |
| 12 | Merged | individuals | Lewatu 6 | Steven Ramm (voted out) |
| 13 | Merged | individuals | Lewatu 5 | Kristina Mills (voted out), Rizo Velovic (fire), Sage Ahrens-Nichols (placed), Sophi Balerdi (placed), Savannah Louie (won) |

| Took effect | Kind | Brought in | What | Research said | The engine today |
|---|---|---|---|---|---|
| 4 | swap | at the start | every group new. Day 8: Uli dissolved, two tribes of seven. | E4: summary ("swap"), notableTwist names 2 of 2 groups; E5 (late): notableTwist names 2 of 2 groups | can't act (free text) |
| 6 | swap | at the start | every group new. Day 11: back to three tribes of four. | E6: summary ("reshuffl"), notableTwist names 2 of 3 groups | can't act (free text) |
| 7 | merge | at the start | Lewatu 11. The merge (Day 13): one tribe, Lewatu. | E7: summary ("merge"); E8 (late): summary ("merge") | can't act (free text) |
| 8 (mid) | twist | mid-episode | Split immunity: two groups of five for one challenge, the losers to Tribal. | E8: summary ("two groups", "groups of five", "split"), notableTwist (2 notes) | can't act (free text) |

tribe lifetimes, an exit doesn't end it: 9 groups; 3 lasted 1, 2 lasted 2, 3 lasted 3, 1 lasted 7; longest 7, median 2

tribe lifetimes, exact members (an exit ends it): 18 groups; 15 lasted 1, 1 lasted 2, 2 lasted 3; longest 3, median 1

### Battle for a New Champion (the-challenge 39)

| Ep | Phase | Played as | teams in play | Went home |
|---|---|---|---|---|
| 1 | Control | everyone | none | Jessica (eliminated) |
| 2 | Control | everyone | none | Chauncey (eliminated) |
| 3 | Control | everyone | none | Jujuy (eliminated) |
| 4 | Control | everyone | none | Hughie (eliminated) |
| 5 | Chaos | pairs | 10 × 2 | Ciarran (eliminated) |
| 6 | Chaos | teams | Blue 6, Red 6, Turquoise 7 | - |
| 7 | Chaos | teams | Team 4 4, Team 6 3, Team 5 3, Team 3 3, Team 1 3, Team 2 3 | Callum (eliminated) |
| 8 | Chaos | teams | Blue 9, Orange 9 | Big T (eliminated) |
| 9 | Chaos | pairs | 7 × 2 + 1 × 3 | Melissa (eliminated) |
| 10 | Chaos | teams | Orange 8, Blue 8 | - |
| 11 | Chaos | teams | Team 3 4, Team 2 4, Team 1 4, Team 4 4 | - |
| 12 | Chaos | teams | Team 1 4, Team 4 4, Team 3 4, Team 2 4 | - |
| 13 | Chaos | teams | Team 2 4, Team 4 4, Team 1 4, Team 3 4 | - |
| 14 | Chaos | teams | Blue 4, Turquoise 4, Yellow 4, Orange 4 | Asaf (eliminated) |
| 15 | Conquest | individuals | none | Ravyn (purged), Zara (eliminated) |
| 16 | Conquest | individuals | none | Ed (purged), Horacio (eliminated), Kyland (eliminated) |
| 17 | Conquest | individuals | none | Michele (purged), James (eliminated), Olivia (eliminated) |
| 18 | Final | mixed | none | - |
| 19 | Final | mixed | none | - |
| 20 | Reunion | none | - | - |

| Took effect | Kind | Brought in | What | Research said | The engine today |
|---|---|---|---|---|---|
| 1 | twist | at the start | The prize pot moves with challenges and eliminations. | not on tape | - |
| 5 | pairs-formed | at the start | 10 × 2. Drawn for the episode's challenge (at random, or by where people stood). | not on tape | - |
| 5 | new-phase | at the start | Chaos: pairs or teams, and a former champion in every Arena (the Draw). | not on tape | - |
| 6 | teams-formed | at the start | Blue 6, Red 6, Turquoise 7. Drawn for the episode's challenge (at random, or by where people stood). | not on tape | - |
| 7 | swap | at the start | every group new. Drawn for the episode's challenge (at random, or by where people stood). | not on tape | - |
| 8 | swap | at the start | every group new. Drawn for the episode's challenge (at random, or by where people stood). | not on tape | - |
| 9 | pairs-formed | at the start | 7 × 2 + 1 × 3. Drawn for the episode's challenge (at random, or by where people stood). | not on tape | - |
| 10 | teams-formed | at the start | Orange 8, Blue 8. Drawn for the episode's challenge (at random, or by where people stood). | not on tape | - |
| 11 | swap | at the start | every group new. Drawn for the episode's challenge (at random, or by where people stood). | not on tape | - |
| 12 | swap | at the start | every group new. Drawn for the episode's challenge (at random, or by where people stood). | not on tape | - |
| 13 | swap | at the start | every group new. Drawn for the episode's challenge (at random, or by where people stood). | not on tape | - |
| 14 | swap | at the start | every group new. Drawn for the episode's challenge (at random, or by where people stood). | not on tape | - |
| 15 | split-into-individuals | at the start | Conquest: everyone for themselves. | not on tape | - |
| 15 | new-phase | at the start | Conquest: individual, last place purged, a chain of safety. | not on tape | - |
| 16 | twist | mid-episode | Double eliminations in 16 and 17. | not on tape | - |
| 18 | new-phase | at the end of the episode before | The final. | not on tape | - |

team lifetimes, an exit doesn't end it: 47 groups; 47 lasted 1; longest 1, median 1

team lifetimes, exact members (an exit ends it): 47 groups; 47 lasted 1; longest 1, median 1

### Battle of the Eras (the-challenge 40)

| Ep | Phase | Played as | eras in play | Went home |
|---|---|---|---|---|
| 1 | Era Invitational | individuals | Era 1 10, Era 2 10, Era 3 10, Era 4 10 | - |
| 2 | Era Invitational | individuals | Era 1 10, Era 2 10, Era 3 10, Era 4 10 | Amanda Garcia (eliminated), Leroy Garrett (eliminated), Mark Long (eliminated), Katie Cooley (eliminated), Paulie Calafiore (eliminated), Nurys Mateo (eliminated), KellyAnne Judd (eliminated), Brandon Nelson (eliminated) |
| 3 | Eras as teams | teams | Era 1 8, Era 2 8, Era 3 8, Era 4 8 | Tony Raines (eliminated), Jodi Weatherton (eliminated) |
| 4 | Eras as teams | teams | Era 1 7, Era 2 8, Era 3 7, Era 4 8 | Aneesa Ferreira (eliminated), Horacio Gutiérrez Jr. (eliminated) |
| 5 | Eras as teams | teams | Era 1 6, Era 2 8, Era 3 7, Era 4 7 | Emily Schromm (eliminated), CT Tamburello (eliminated) |
| 6 | Eras as teams | teams | Era 1 5, Era 2 7, Era 3 7, Era 4 7 | Brad Fiorenza (eliminated), Jonna Mannion (eliminated) |
| 7 | Eras as teams | teams | Era 1 4, Era 2 7, Era 3 6, Era 4 7 | Tina Barta (eliminated), Darrell Taylor (eliminated) |
| 8 | Eras as teams | teams | Era 1 2, Era 2 7, Era 3 6, Era 4 7 | Averey Tressler (eliminated), Derrick Kosinski (eliminated) |
| 9 | Eras as teams | teams | Era 1 1, Era 2 7, Era 3 5, Era 4 7 | Devin Walker (eliminated), Kaycee Clark (eliminated) |
| 10 | Individual | individuals | Era 1 1, Era 2 7, Era 3 4, Era 4 6 | Ryan Kehoe (eliminated) |
| 11 | Individual | individuals | Era 1 1, Era 2 6, Era 3 4, Era 4 6 | Nia Moore (eliminated) |
| 12 | Individual | individuals | Era 1 1, Era 2 6, Era 3 3, Era 4 6 | Nehemiah Clark (purged), Laurel Stucky (purged), Theo Campbell (eliminated) |
| 13 | Individual | individuals | Era 1 1, Era 2 4, Era 3 3, Era 4 5 | Olivia Kaiser (eliminated) |
| 14 | Individual | individuals | Era 1 1, Era 2 4, Era 3 3, Era 4 4 | Josh Martinez (eliminated) |
| 15 | Individual | individuals | Era 1 1, Era 2 4, Era 3 3, Era 4 3 | Aviv Melmed (eliminated) |
| 16 | Individual | individuals | Era 1 1, Era 2 3, Era 3 3, Era 4 3 | Cory Wharton (eliminated) |
| 17 | Individual | individuals | Era 1 1, Era 2 3, Era 3 2, Era 4 3 | Cara Maria Sorbello (eliminated) |
| 18 | Final | individuals | Era 1 1, Era 2 2, Era 3 2, Era 4 3 | - |
| 19 | Final | individuals | Era 1 1, Era 2 2, Era 3 2, Era 4 3 | Jordan Wiseley (won), Jenny West (won), Rachel Robinson (won), Derek Chavez (placed), Johnny "Bananas" Devenanzio (placed), Michele Fitzgerald (placed), Kyland Young (placed), Tori Deal (placed) |
| 20 | Reunion | none | - | - |
| 21 | Reunion | none | - | - |

| Took effect | Kind | Brought in | What | Research said | The engine today |
|---|---|---|---|---|---|
| 1 | twist | at the start | The Era Invitational: each era competes against itself; eight eliminations. | E1: rulesNote ("era invitational", "invitational"), summary ("era invitational", "invitational"); E2 (late): summary ("era invitational", "invitational") | can't act (free text) |
| 2 | twist | mid-episode | The Karma Vote: each eliminated player rates those left from 1 to 5 (its use revealed in the final). | E2: rulesNote ("karma"), summary ("karma") | can't act (free text) |
| 3 | teams-formed | at the start | The eras compete as teams; each era has a male and a female target, chosen by the last Arena's winners (representatives in Episode 3). | E3: rulesNote ("team") | can't act (free text) |
| 4 | twist | at the end of the episode before | Targets: the Arena's winners pick a man and a woman from each era to be at risk next. | E3: rulesNote ("target"), summary ("target"), notableTwist (10 notes); E4: summary ("target"), notableTwist (10 notes); E5 (late): summary ("target"), notableTwist (11 notes) | can't act (free text) |
| 10 | split-into-individuals | at the end of the episode before | Individual: eliminations alternate men and women; still representing their eras. | E9: rulesNote ("individual", "each for", "team phase is over"), summary ("individual", "team phase is over"); E10: rulesNote ("individual"), summary ("individual") | can't act (free text) |
| 11 | twist | at the end of the episode before | Targets, individual phase: the Arena's winner names three of the other gender. | E10: summary ("target"), notableTwist (5 notes); E11: summary ("target"), notableTwist (3 notes); E12 (late): summary ("target"), notableTwist (4 notes) | can't act (free text) |
| 12 | twist | at the start | The Purge: Duned's last man and woman out on the spot; last place's penalty moves to second-to-last. | E12: summary ("purge"), notableTwist (2 notes) | can't act (free text) |
| 18 | new-phase | at the start | The final, scored by checkpoint points plus the Karma Vote. | E18: rulesNote ("karma", "final"), summary ("final"), notableTwist (7 notes); E19 (late): summary ("karma", "final"), notableTwist (8 notes) | can't act (free text) |

era lifetimes, an exit doesn't end it: 4 groups; 1 lasted 8, 3 lasted 19; longest 19, median 19

era lifetimes, exact members (an exit ends it): 29 groups; 10 lasted 1, 10 lasted 2, 5 lasted 3, 4 lasted 5; longest 5, median 2

### Vets & New Threats (the-challenge 41)

| Ep | Phase | Played as | pairs in play | Went home |
|---|---|---|---|---|
| 1 | Rotating pairs | pairs | 16 × 2 | Rogan O’Connor (eliminated) |
| 2 | Rotating pairs | pairs | 15 × 2 | Blue Kim (eliminated) |
| 3 | Rotating pairs | pairs | 15 × 2 | Nia Moore (medical) |
| 4 | Rotating pairs | pairs | 14 × 2 | Johnny "Bananas" Devenanzio (eliminated) |
| 5 | Rotating pairs | pairs | 14 × 2 | Cara Maria Sorbello (quit), Ben Davis (eliminated) |
| 6 | Rotating pairs | pairs | 13 × 2 | Leka Sodade (eliminated) |
| 7 | Rotating pairs | pairs | 13 × 2 | Izzy Fairthorne (eliminated) |
| 8 | Rotating pairs | pairs | 12 × 2 | Derek Chavez (eliminated) |
| 9 | Mini-Final | individuals | none | - |
| 10 | Locked pairs | pairs | 12 × 2 | CT Tamburello (eliminated), Tay Wilcoxson (eliminated) |
| 11 | Locked pairs | pairs | 11 × 2 | Gabe Wai (eliminated), Jonna Mannion (eliminated) |
| 12 | Locked pairs | pairs | 10 × 2 | Dee Valladares (eliminated), Derrick Kosinski (eliminated) |
| 13 | Locked pairs | pairs | 9 × 2 | America Lopez (eliminated), Leroy Garrett (eliminated) |
| 14 | Locked pairs | pairs | 8 × 2 | Ashley Mitchell (eliminated), Leonardo Dionicio (eliminated) |
| 15 | Locked pairs | pairs | 7 × 2 | Aneesa Ferreira (eliminated), Jake Cornish (eliminated) |
| 16 | Locked pairs | pairs | 6 × 2, then 6 × 2 (mid) | Aviv Melmed (eliminated), Will Gagnon (eliminated) |
| 17 | Locked pairs | pairs | 5 × 2 | Justin Hinsley (eliminated), Nany González (eliminated) |
| 18 | Final | pairs | 4 × 2 | - |
| 19 | Final | pairs | 4 × 2 | Adrienne Naylor (disqualified), Theo Campbell (disqualified), Cedric Hodges (placed), Michaela Bradshaw (placed), Sydney Segal (placed), Turbo (placed), Olivia Kaiser (won), Yeremi Hykel (won) |
| 20 | Reunion | none | - | - |
| 21 | Reunion | none | - | - |

| Took effect | Kind | Brought in | What | Research said | The engine today |
|---|---|---|---|---|---|
| 1 | twist | at the start | Performance Points (episodes 1-9), scored from Episode 1; what they're for (the Lock In's order) explained in Episode 7. | E1: notableTwist (12 notes) | can't act (free text) |
| 2 | swap | at the end of the episode before | every group new. New partners chosen after Episode 1's elimination, in daily-challenge order. | E2: summary ("shake"), notableTwist names 2 of 15 groups | can't act (free text) |
| 2 | twist | at the end of the episode before | The Hangnail: whoever's partner went home sits out the next daily and is up for the vote (episodes 2-8, when numbers are odd). | E2: summary ("hangnail"), notableTwist (1 notes) | can't act (free text) |
| 3 | swap | at the end of the episode before | every group new. New partners chosen after Episode 2's elimination, in daily-challenge order. | E2: summary ("shake"); E3: notableTwist names 4 of 15 groups; E4 (late): notableTwist names 1 of 15 groups | can't act (free text) |
| 4 | swap | at the end of the episode before | every group new. New partners chosen after Episode 3's elimination, in daily-challenge order. | E4: notableTwist names 3 of 14 groups; E5 (late): summary ("new partner", "reshuffl") | can't act (free text) |
| 5 | swap | at the end of the episode before | every group new. New partners chosen after Episode 4's elimination, in daily-challenge order. | E4: notableTwist names 13 of 14 groups; E5: summary ("new partner", "reshuffl"), notableTwist names 5 of 14 groups | can't act (free text) |
| 5 | newcomer | at the start | new: Jonna Mannion; 1 × 2. Cara Maria withdrew before the daily; Jonna came in as her replacement and took her place beside Leo. | E5: summary ("alternate", "entered") | can't act (free text) |
| 6 | swap | at the end of the episode before | every group new. New partners chosen after Episode 5's elimination, in daily-challenge order. | E5: summary ("new partner", "reshuffl"), notableTwist names 12 of 13 groups; E6: notableTwist names 3 of 13 groups; E7 (late): summary ("new partner") | can't act (free text) |
| 7 | swap | at the end of the episode before | every group new. New partners chosen after Episode 6's elimination, in daily-challenge order. | E6: notableTwist names 11 of 13 groups; E7: summary ("new partner"), notableTwist names 4 of 13 groups; E8 (late): notableTwist names 1 of 13 groups | can't act (free text) |
| 8 | swap | at the end of the episode before | every group new. New partners chosen after Episode 7's elimination, in daily-challenge order. | E7: summary ("new partner"), notableTwist names 11 of 12 groups; E8: notableTwist names 6 of 12 groups | can't act (free text) |
| 8 | swap | at the start | 3 moved. Theo was waiting on an MRI, so he was made the Hangnail and Will took his place beside Dee. | E8: notableTwist names 1 of 1 groups | can't act (free text) |
| 9 | split-into-individuals | at the start | No new pairs after Episode 8: Episode 9 was an individual Mini-Final for Performance Points. | E9: summary ("individual"), notableTwist (3 notes) | can't act (free text) |
| 10 | pairs-formed | at the end of the episode before | 12 × 2. The Lock In: partners chosen for the rest of the season, in Performance Points order. | E9: rulesNote ("partner", "lock-in", "lock in", "permanent"), summary ("partner", "lock-in", "lock in", "permanent"); E10: summary ("partner", "permanent"), notableTwist names 5 of 12 groups; E11 (late): notableTwist names 5 of 12 groups | can't act (free text) |
| 10 | new-phase | announced ahead (Episode 7) | The Lock In: permanent partners for the rest of the season, announced in Episode 7, chosen at Episode 9's end. | E7: rulesNote ("permanent"), summary ("permanent"); E10: summary ("permanent") | can't act (free text) |
| 10 | twist | at the start | Stake a Claim: once a team, claim another team's partner; win the race and the pairs re-form, lose and both go to the Arena. | E11 (late): summary ("stake a claim", "claim"), notableTwist (4 notes) | can't act (free text) |
| 16 (mid) | swap | mid-episode | 4 moved. Stake a Claim: Yeremi claimed Olivia and beat Will in the race, so Olivia & Yeremi and Aviv & Will. | E16: summary ("claim"), notableTwist names 2 of 2 groups; E17 (late): notableTwist names 1 of 2 groups | can't act (free text) |
| 18 | new-phase | at the end of the episode before | The final (episodes 18-19): four pairs race; first to the finish wins. | E17: summary ("final"), notableTwist (5 notes); E18: summary ("final"), notableTwist (10 notes); E19 (late): summary ("final") | can't act (free text) |

pair lifetimes, an exit doesn't end it: 126 groups; 114 lasted 1, 1 lasted 2, 1 lasted 3, 2 lasted 4, 1 lasted 5, 1 lasted 6, 2 lasted 7, 1 lasted 8, 3 lasted 10; longest 10, median 1; 2 shown but never played (Cara Maria Sorbello + Leonardo Dionicio; Dee Valladares + Theo Campbell)

pair lifetimes, exact members (an exit ends it): 126 groups; 114 lasted 1, 1 lasted 2, 1 lasted 3, 2 lasted 4, 1 lasted 5, 1 lasted 6, 2 lasted 7, 1 lasted 8, 3 lasted 10; longest 10, median 1; 2 shown but never played (Cara Maria Sorbello + Leonardo Dionicio; Dee Valladares + Theo Campbell)

### The Traitors (US) season 4 (the-traitors-us 4)

| Ep | Phase | Played as | Went home |
|---|---|---|---|
| 1 | Game | everyone | - |
| 2 | Game | everyone | Ian Terry (murdered), Porsha Williams (banished) |
| 3 | Game | everyone | Rob Cesternino (murdered), Donna Kelce (banished) |
| 4 | Game | everyone | Caroline Stanbury (murdered), Tiffany Mitchell (banished) |
| 5 | Game | everyone | Monét X Change (murdered), Michael Rapaport (banished) |
| 6 | Game | everyone | Ron Funches (banished) |
| 7 | Game | everyone | Yamil “Yam Yam” Arocho (murdered), Lisa Rinna (banished) |
| 8 | Game | everyone | Colton Underwood (murdered), Candiace Dillard Bassett (banished) |
| 9 | Game | everyone | Dorinda Medley (murdered), Stephen Colletti (banished) |
| 10 | Game | everyone | Kristen Kish (murdered), Natalie Anderson (banished) |
| 11 | Endgame | everyone | Mark Ballas (murdered), Johnny Weir (banished), Tara Lipinski (banished), Eric Nam (banished), Maura Higgins (placed), Rob Rausch (won) |
| 12 | Reunion | none | - |

| Took effect | Kind | Brought in | What | Research said | The engine today |
|---|---|---|---|---|---|
| 1 | twist | at the start | The Secret Traitor: hidden from the Traitors (and the audience), shortlists the murders. | E1: rulesNote ("secret traitor"), summary ("secret traitor"), notableTwist (6 notes); E2 (late): rulesNote ("secret traitor"), notableTwist (6 notes) | can't act (free text) |
| 2 (mid) | twist | mid-episode | A murder in plain sight: burn a shortlisted Faithful's card in the breakfast room. | E2: rulesNote ("plain sight"), summary ("plain sight"); E3 (late): summary ("plain sight"), notableTwist (3 notes) | can't act (free text) |
| 5 (mid) | twist | mid-episode | A collective shield: if nobody takes one, nobody can be murdered that night. | E5: rulesNote ("shield"), summary ("shield"); E6 (late): summary ("shield"), notableTwist (2 notes) | can't act (free text) |
| 7 (mid) | twist | mid-episode | The Dagger: two votes at one of the next four Round Tables. | E7: rulesNote ("dagger"), summary ("dagger"), notableTwist (5 notes) | can't act (free text) |
| 9 | role | at the end of the episode before | Recruitment by ultimatum: Eric becomes a Traitor. | E8: summary ("ultimatum", "recruit"), notableTwist (2 notes); E9: recruitedAsTraitor: Eric Nam, summary ("ultimatum", "recruit"), notableTwist (3 notes) | acts on it |
| 11 (mid) | new-phase | mid-episode | The endgame: the Fire of Truth, banishments without a reveal. | E11: summary ("fire of truth"), notableTwist (2 notes) | can't act (free text) |

No groupings: everyone plays for themselves.


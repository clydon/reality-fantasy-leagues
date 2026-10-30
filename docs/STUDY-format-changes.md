# Study: format changes nobody announced (F1)

For the user to read. Step F1 of [PLAN-start-a-game-gpt.md](PLAN-start-a-game-gpt.md), "Formats nobody announced": take
seasons whose stages are known, lay out how their format changed episode by episode, and check what each episode's
research (today's prompt, recorded on the season tapes) said about each change, and whether the engine could act on it.
Written 2026-10-28 on the `engine` branch. Nothing in F1 changed the app, the research prompt or the engine; F2 (2026-10-29)
built the section proposed here into the prompt on the `engine` branch, and its results are near the end ("F2: the format
section asked again"); F3 (2026-10-29) built the engine's format state over time from those answers ("F3: the state over
time", after it); F4 (2026-10-29) replayed the seasons blind, as if live, through every game the engine plays ("F4: blind
replays", after F3).

**The proposals at the end (the change vocabulary, the format state's shape and the prompt section) are the user's to
approve at the merge** that brings F2 to production. Research's prompt is shared by every show's research, production's
included, so F2 changes it on the `engine` branch only.

## How it was made

- **The ground truth**: each season's Wikipedia page, read from its raw wikitext (the revision is in each file) and
  hand-checked: the format section, the game summary (who went home and how) and, for The Challenge, the team-progress
  table (who was paired or teamed with whom, episode by episode). It's stored as data in
  `tests/fixtures/format-timelines/<show>-<season>.json`, under the tapes' cast names (The Challenge 39's moved to them in F4, once it was on tape). A grouping is a list of **spells**: who was with whom, from when it took effect (an
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
  then individual; on tape since 2026-10-29, after F1, so F1's tables had its timeline only), Survivor 49 (two swaps and the merge) and The Traitors 4 (a Secret
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

**The Challenge 39** (on tape since 2026-10-29, after this study; its research is in the appendix's table): Control (everyone together, 1-4), Chaos (pairs or teams drawn every episode, 5-14:
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
  the first sketch), with a `label` layer apart from the `play` layer. (As built: the section's groups are how people play,
  and the labels stay the cast list's, so the timeline reads only the section; "F3: the state over time", below.)
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
6. **The vocabulary, the state's shape and the prompt section above**: the user's to approve at F2's merge (as built: "F2:
   the format section asked again", below; recommended as they are). With them, F3's tribe moves from the section, `newGroup`
   asked beside it only for whoever moved and went home the same night ("F3: the state over time"; recommended).
7. **A group question's default when its pairs aren't sure** (F3 part 2): recommended void (no points either way; a pick of a
   pair re-drawn before it played is void too), with "follow the people" for a game that asks for it.
8. **Pairs nobody reviews** (F3 part 2): a season's pairs come straight from research's format section, unlike Survivor's tribe
   moves, which a person accepts. Recommended: as built, "sure" being the guard, the timeline shown on the desk, and a wrong
   pair put right by asking the episode again.

## F2: the format section asked again (2026-10-29)

F2 built the section proposed above into research's prompt (`db/episode-research.js`; its vocabulary, its loose read, its
checks and our own comparison in `src/lib/game/formats/format-state.js`), on the `engine` branch. **The vocabulary, the
state's shape and the prompt section as built are the user's to approve at F2's merge**; until then production's research
is as it was. What changed from the proposals: `wentHomeAs` can also say `nobody` or `unknown`, `playedAs` `unknown`; a
change's `when` and `from` may be null (not said); `labels` isn't asked (the cast list keeps its own groups, and the prompt
says those may be only a label); `role` is one of the kinds. `newGroup` and `merged` are still asked beside it (a live
season's staging reads them until F3 reads the state).

**How it was proven.** The study's set, 23 recorded episodes (The Challenge 41 episodes 4-10 and 16, Survivor 49 3-8, The
Challenge 40 2, 3, 9, 10 and 12, The Traitors 4 1, 7, 8 and 9), asked again through the local bot only (signed-in ChatGPT,
http://127.0.0.1:8765, between the tapes recorder's own questions), each with the whole full-research prompt the bot's run
sends, kept beside the tapes (`~\rfl-tapes\<show>\<season>\format\`) and read by the app's own parser and checks, nothing
written to the database. The groups going in, as the prompt shows them: this run's answer for the episode before, else
F1's truth at its end (the first of a run, or a gap). Each answer is scored against F1's fixtures:
`node scripts/dev-test/format-asks.js score` (`--md` for these tables; `ask`, `reread`, `prompt`, `plan`: its header says
how). Survivor 49 was asked with today's prompt (and so `newGroup` and `merged`) for the first time.

The prompt was tuned once, after the first two answers: the kinds' words now say a "formed" kind is people playing that way
after playing some other way, and that re-drawn pairs are a `swap` (Episode 5's re-pairing had come back as
`pairs-formed`), and `newGroup`'s paragraph and the section no longer both claim to be "the only place" a change is
recorded. Episodes 4 and 5 of The Challenge 41 were asked again with the final words (the first answers are kept beside the
new ones; scoring reads the latest), and everything else was asked with them. One answer (The Challenge 40's Episode 3)
wasn't valid JSON (a list left unclosed) and was asked again, as the bot's own runs retry.

### What came back

1. **Who is with whom is data now, and right.** Every one of the 23 answers said who was with whom; 18 exactly. 104 of the
   109 groups were found exactly (5 more listed that weren't there), and 281 of 298 people were placed right (94%).
   Survivor 49: every tribe at every episode, through both swaps and the merge. The Challenge 41: 87 of its 91 pairs,
   including the pairs drawn at each episode's end for the next (what F1 found only in per-person notes, a person at a
   time) and the Lock In's 12 permanent pairs, where F1 found nothing at all. The Challenge 40: the four eras exact while
   they played as teams. The Traitors 4: no groups, every time. The newcomer (Jonna Mannion, for Cara Maria beside Leo)
   came back as a newcomer, in her pair.
2. **The changes are data, mostly right.** Of the 24 changes the fixtures say were shown in these episodes, the answer named
   18 by kind, 17 with the episode they take effect from, and 14 with when they came in. Survivor's two swaps (at the
   start) and the merge, The Challenge 41's re-pairings (at the end, from the next), the newcomer, the claim mid-Episode 16,
   the Lock In's pairs from 10 (at 9's end), The Challenge 40's targets and the end of its team phase (from 10, at 9's
   end), The Traitors' Secret Traitor and the Dagger. Before F2, none of the 14 grouping changes among them reached the
   engine as data (F1).
3. **Our comparison and the answer's cross-check each other.** Comparing the state going in with the answer's (our code,
   `changesBetween`), 9 of the 14 grouping changes were found, and the answer agreed on all 9 (sure). Where they disagreed,
   the change is unsure, which is the safe fallback the 8:15 PM note asks for: Survivor 49's Episode 8 said `teams-formed`
   (sure) for the split immunity's two groups of five, which lasted one challenge; the groups at its end show none, so it's
   unsure and would move nothing. 15 changes the answers listed aren't in the fixtures: mostly twists and roles (a casting
   announcement, The Traitors' Secret Traitor also as a role, Eric's recruitment again the week after it was reported) and changes already reported (the end of The Challenge 40's team phase said
   again at 10). A `twist` never moves a game's structure (F1's question 5: "major" by default is grouping kinds only), so
   these cost nothing but a note.
4. **`newGroup` beside it isn't reliable.** At Survivor 49's first swap, the same answers' `newGroup` named a new tribe for 1
   person (11 changed tribe), at the second 6 (6 did), at the merge none (10 did); the section had every tribe exactly right
   each time. `merged` said yes at the merge. That's F3's case for working `newGroup` and `merged` out from the state.
5. **What it missed, and what each means for F3:**
   - **A whole pair going home together** read as `individuals` twice (The Challenge 41's Episodes 10 and 16): our code can
     tell from the exits and the groups going in (both partners left), so F3 needn't trust the word.
   - **A label as a group.** The Challenge 40's Episode 9 said everyone plays alone from 10 (right) and still listed the
     eras, a label by then, as its groups at the end; its Episode 2 listed them a week early. The review now flags an answer
     that contradicts itself (a split said with groups still listed; a merge with several; teams formed with none); F3
     should believe the change and the next episode's state over a contradicted list, or keep it unsure.
   - **An individual episode between paired ones** (The Challenge 41's Episode 9, played alone, ending with the Lock In's
     pairs): comparing two paired states can't see that everyone played alone between them. F3 reads `playedAs` with the
     groups (the answer said `individuals` there).
   - **A change announced ahead** (the Lock In, announced in 7 for 10) came as a twist from 7, and Theo's MRI swap at
     Episode 8's start was missed (it kept Dee with Theo, the pair shown the week before: 9 of its 11 pairs right). The
     Challenge 41's Episodes 6 and 7 each left one pair out, its members nowhere (the review flags someone still in but
     in no group).
   - **How it was played** was right in 17 of 23: The Traitors read "individuals" for "everyone" (people play for
     themselves, together), Survivor's merge episodes and The Challenge 40's Episode 3 "mixed". Nothing reads `playedAs` yet but F3's comparison, which only
     needs grouped against not grouped.
   - The merged tribe came without its name (Lewatu).
6. **It costs time.** The prompt is about 40% longer (The Challenge 41: 28.0k characters against 19.8k on its tapes, most of
   it the section's JSON schema) and the answers took about twice as long (136 s against 71 s on The Challenge 41, 128 s
   against 93 s on The Challenge 40; the longest 198 s, The Traitors' Episode 1). The app's bot asks stop at 285 s (Vercel's
   300 s route), so this is the merge's to watch (in the plan's Noticed).

### The answers, scored

"Going in" is where the groups shown in the prompt came from. "Groups at the end": found of expected (+ listed that weren't
there; "next start" when the answer matched the groups at the next episode's start, which counts too). "Its changes" and
"Ours": each change the fixture says was shown in that episode, as kind, episode it takes effect / when, and whether the
answer had it (yes, partly: the kind but not the episode or when, missed), with + for one listed that isn't in the fixture.

**Vets & New Threats (the-challenge 41)**

| Ep | Going in | Played as | Groups at the end | People | New | Went home as | Its changes (want: got) | Ours |
|---|---|---|---|---|---|---|---|---|
| 4 | truth | pairs | 14 of 14 | 28 of 28 | - | individuals | swap 5/end: yes (high) | swap 5/end: yes (high) |
| 5 | answer | pairs | 13 of 13 | 27 of 27 | Jonna Mannion | individuals | newcomer 5/start: mid partly (high); swap 6/end: yes (high) | newcomer 5/start: mid partly (high); swap 6/end: yes (high) |
| 6 | answer | pairs | 12 of 13 | 24 of 26 | - | individuals | swap 7/end: yes (high) | swap 7/end: yes (high) |
| 7 | answer | pairs | 11 of 12 | 23 of 25 | - | individuals | swap 8/end: yes (high); new-phase 10/end: missed; +twist 7 (high) | swap 8/end: yes (high) |
| 8 | answer | pairs | 9 of 11, +1 | 19 of 24 | - | individuals | swap 8/start: missed; +twist 8 (high); +role 8 (high); +new-phase 9 (high) | swap 8/start: missed |
| 9 | answer | individuals | 12 of 12 | 24 of 24 | - | nobody | split-into-individuals 9/start: missed; pairs-formed 10/end: yes (high); +twist 10 (high) | split-into-individuals 9/start: missed; pairs-formed 10/end: missed; +swap ? (low) |
| 10 | answer | pairs | 11 of 11 | 22 of 22 | - | individuals (want groups) | twist 10/start: mid partly (high); +new-phase 10 (high); +split-into-individuals 11 (high) | none, none |
| 16 | truth | pairs | 5 of 5 | 10 of 10 | - | individuals (want groups) | swap 16/mid: yes (high) | swap 16/mid: yes (high) |

- answered 8 of 8
- played as right 8 of 8
- who's with whom known 8 of 8, exactly right 5 of 8
- groups found 87 of 91 (+1 not there)
- each person's group 177 of 186
- newcomers 1 of 1 (+0)
- went home as 6 of 8
- changes: the answer's own kind 8 of 11, its episode 8 of 11, when 6 of 11, +7 not in the fixture
- ours (grouping changes) 6 of 9, sure 6 of 9, +1

**Survivor 49 (survivor 49)**

| Ep | Going in | Played as | Groups at the end | People | New | Went home as | Its changes (want: got) | Ours |
|---|---|---|---|---|---|---|---|---|
| 3 | truth | tribes | 3 of 3 | 14 of 14 | - | individuals | none, none | none, none |
| 4 | answer | tribes | 2 of 2 | 13 of 13 | - | individuals | swap 4/start: yes (high) | swap 4/start: yes (high) |
| 5 | answer | tribes | 2 of 2 | 12 of 12 | - | individuals | none, none | none, none |
| 6 | answer | tribes | 3 of 3 | 11 of 11 | - | individuals | swap 6/start: yes (high) | swap 6/start: yes (high) |
| 7 | answer | mixed (want individuals) | none, none | - | - | individuals | merge 7/start: yes (high); +twist 7 (high) | merge 7/start: yes (high) |
| 8 | answer | mixed (want individuals) | none, none | - | - | individuals | twist 8/mid: yes (high); +teams-formed 8 (high) | none, none |

- answered 6 of 6
- played as right 4 of 6
- who's with whom known 6 of 6, exactly right 6 of 6
- groups found 10 of 10 (+0 not there)
- each person's group 50 of 50
- newcomers - (+0)
- went home as 6 of 6
- changes: the answer's own kind 4 of 4, its episode 4 of 4, when 4 of 4, +2 not in the fixture
- ours (grouping changes) 3 of 3, sure 3 of 3, +0

**Battle of the Eras (the-challenge 40)**

| Ep | Going in | Played as | Groups at the end | People | New | Went home as | Its changes (want: got) | Ours |
|---|---|---|---|---|---|---|---|---|
| 2 | truth | individuals | 3 of 4, +1 (next start) | 24 of 32 | - | individuals | twist 2/mid: from 3 end partly (high); +teams-formed 3 (high) | +teams-formed 3 (high) |
| 3 | answer | mixed (want teams) | 4 of 4 | 30 of 30 | - | individuals | teams-formed 3/start: missed; twist 4/end: yes (high) | teams-formed 3/start: missed |
| 9 | truth | teams | 0 of 0, +3 | - | - | individuals | split-into-individuals 10/end: yes (high) | split-into-individuals 10/end: missed |
| 10 | answer | individuals | none, none | - | - | individuals | twist 11/end: missed; +split-into-individuals 10 (high); +new-phase 10 (high) | +split-into-individuals 10 (high) |
| 12 | truth | individuals | none, none | - | - | individuals | twist 12/start: mid partly (high) | none, none |

- answered 5 of 5
- played as right 4 of 5
- who's with whom known 5 of 5, exactly right 3 of 5
- groups found 7 of 8 (+4 not there)
- each person's group 54 of 62
- newcomers - (+0)
- went home as 5 of 5
- changes: the answer's own kind 4 of 6, its episode 3 of 6, when 2 of 6, +3 not in the fixture
- ours (grouping changes) 0 of 2, sure 0 of 2, +2

**The Traitors (US) season 4 (the-traitors-us 4)**

| Ep | Going in | Played as | Groups at the end | People | New | Went home as | Its changes (want: got) | Ours |
|---|---|---|---|---|---|---|---|---|
| 1 | none | everyone | none, none | - | - | nobody | twist 1/start: yes (high); +role 1 (high) | can't compare |
| 7 | truth | individuals (want everyone) | none, none | - | - | individuals | twist 7/mid: yes (high) | none, none |
| 8 | answer | individuals (want everyone) | none, none | - | - | individuals | role 9/end: missed; +twist 9 (high) | none, none |
| 9 | answer | individuals (want everyone) | none, none | - | - | individuals | +role 9 (high) | none, none |

- answered 4 of 4
- played as right 1 of 4
- who's with whom known 4 of 4, exactly right 4 of 4
- groups found - (+0 not there)
- each person's group -
- newcomers - (+0)
- went home as 4 of 4
- changes: the answer's own kind 2 of 3, its episode 2 of 3, when 2 of 3, +3 not in the fixture
- ours (grouping changes) -, sure -, +0, 1 answer(s) not comparable

**All**

- answered 23 of 23
- played as right 17 of 23
- who's with whom known 23 of 23, exactly right 18 of 23
- groups found 104 of 109 (+5 not there)
- each person's group 281 of 298
- newcomers 1 of 1 (+0)
- went home as 21 of 23
- changes: the answer's own kind 18 of 24, its episode 17 of 24, when 14 of 24, +15 not in the fixture
- ours (grouping changes) 9 of 14, sure 9 of 14, +3, 1 answer(s) not comparable

### What it means for F3

- **The state over time is buildable from these answers.** Groups are right far more often than not, and where an answer is
  wrong, the next one usually isn't (each answer compares with the groups going in), so a corrected state works out what
  follows (F3's "a corrected report works out everything after it again").
- **Our comparison decides; the answer's kinds cross-check.** Changes both see are sure; the rest are unsure and get only the
  safe fallbacks. `playedAs` joins the comparison (an individual episode between paired ones), and an answer that
  contradicts itself is unsure.
- **`newGroup` and `merged` can be worked out from the state**, and the section is the better source (item 4).
- **Exits, not words, say a pair went home together**; `wentHomeAs` is a cross-check.
- **Newcomers join the cast** (F3), so they get results and exits, not only a place in a group.

## F3: the state over time (2026-10-29)

F3's first part built the engine's format state over time from these answers (`src/lib/game/formats/format-timeline.js`; the
plan's F3 says what it holds and what reads it). For every episode: who is with whom at its end and whether that's sure (and
why not), how the episode was played and in which groups, what changed (our comparison crossed with the answer's), which
groups went home whole (from the exits); for the season, every group's lifetime and every grouping's spell, and the
newcomers. It's built from every episode's answer at once, so a corrected answer works out everything after it again.

**How it was proven.** `node scripts/dev-test/format-asks.js timeline --md`, no bot: the timeline built from F2's kept
answers as the engine builds it from stored research (an episode F2 didn't ask again is carried on with the fixture's exits;
the groups going into the first asked episode are F1's truth, as F2's first asks were shown), and scored against F1's
fixtures. "Sure" is what a game's structure would move on; "unsure" gets the safe fallbacks only.

**In short:**
- **Nothing wrong was called sure.** 11 grouping changes were sure, all 11 right: The Challenge 41's four re-drawn pairings,
  the Lock In's pairs from 10 and the claim at 16; Survivor 49's two swaps and the merge; The Challenge 40's teams from 3 and
  its split from 10. Of the 13 grouping changes the fixtures have within reach, 11 were sure, 1 unsure (The Challenge 41's
  Episode 9 played alone, said only by `playedAs`) and 1 missed (Theo's MRI swap at 8's start, which the answer missed).
- **The 3 unsure episodes are exactly the 3 answers that contradict themselves** (The Challenge 41's 10: a split the pairs
  don't show; Survivor 49's 8: the split immunity's teams; The Challenge 40's 9: a split with the eras still listed), and the
  next answer settled each one that has a next (40's 10 made the split sure).
- **An episode played alone between paired ones is seen** (3 of 3: The Challenge 41's 9, 40's 10, Survivor 49's merge as
  one tribe of everyone), and the Lock In's pairs come out as pairs formed (F2's comparison of groups alone had called them
  a swap).
- **Whole groups going home come from the exits:** 22 of 23 right (the answers said 21 of 23); the one missed is the pair
  the claim formed partway through 16, which isn't in any state at an episode's end.
- **Lifetimes: 85 of 85 groups the fixtures have played exactly the episodes they did** (3 groups were the answers' own
  mistakes). Side stages after a grouping held 2 episodes, as F1 measured: The Challenge 41 after 11 (the locked pairs,
  closed by the claim at 16), Survivor 49 after 5 (closed by the swap at 6, nothing scored), The Challenge 40 after 4 (the
  eras as teams, closed by the split at 10).
- **Tribe moves from the section, not `newGroup`.** Each person's tribe move is now worked out from the section (a tribe's
  name said another way is that tribe; pairs and an unnamed group move nobody), so beside it `newGroup` asks only for
  someone who moved and then went home in the same episode, whom the groups at the end can't hold (a pass about some of the
  cast, which leaves the section out, still asks it of everyone). On Survivor 49 the section's moves were 11 of 11 at the
  first swap and 6 of 6 at the second, none wrong; `newGroup` had 1 of 11 and 6 of 6. Neither named the merged tribe, so
  the merge moves nobody's tribe either way (the merge's phase comes from `merged`, still asked). On The Challenge 41,
  `newGroup` had named partners as groups; the section moves nobody there. **This is the user's to approve with the
  section at the merge.**

**What it means for F4 and A10 to A12.**
- **F4** builds the timeline the same way from each replayed season's research, one report at a time, as if live: what a
  game read at each lock is `goingInto` of the timeline as built from the reports so far, and a blind replay's `start` is
  what was known before the premiere (unsure).
- **A10's group slots** read `groupSlots` (a slot opens after the episode that showed its group, scores the episodes it then
  played, drops after its last; an unsure lock voids it by default, and a group shown and never played voids the next
  episode, F1's Q2).
- **A11's teams** read `playedIn` (the groups that played an episode, the ones at its start when a change came partway).
- **A12's side stages** read `sideStages` (a grouping already gone in the report of the episode it would open after never
  opens; one changed at the next episode's start opened, live, and closes having scored nothing: a question for the user)
  and its stage triggers `stageTriggers` (sure changes of the spec's kinds act from the episode they take effect; unsure
  ones are held, flagged).
- What F3 can't see: a group formed partway through an episode that went home whole, and who went home in an episode whose
  groups changed at its start (the plan's Noticed).

### The timeline, scored

"Groups at the end" as the answer said them (found of the fixture's, + listed that weren't there). "Played apart": the
episode played without the groups that went into it. "Went home as": ours (from the exits) / the answer's word.

**Vets & New Threats (the-challenge 41)**

| Ep | Groups at the end | Sure | Played apart | Went home as (ours / the answer's) |
|---|---|---|---|---|
| 4 | 14 of 14 | sure | - | individuals / individuals |
| 5 | 13 of 13 | sure | - | individuals / individuals |
| 6 | 12 of 13 | sure | - | individuals / individuals |
| 7 | 11 of 12 | sure | - | individuals / individuals |
| 8 | 9 of 11, +1 | sure | - | individuals / individuals |
| 9 | 12 of 12 | sure | yes | nobody / nobody |
| 10 | 11 of 11 | unsure: the answer says split-into-individuals from episode 11, but its groups don't show it | - | groups / individuals |
| 16 | 5 of 5 | sure | - | individuals (want groups) / individuals |

- sure changes: swap (every group new) from 5; swap (every group new) from 6; swap (every group new) from 7; swap (every
  group new) from 8; pairs-formed (every group new) from 10; swap from 16
- the fixture's grouping changes within reach: swap (every group new) from 5, 6, 7 and 8: sure; swap from 8: missed;
  split-into-individuals from 9: unsure; pairs-formed (every group new) from 10: sure; swap from 16: sure
- lifetimes: 74 of 76 groups the fixture has, 74 with the episodes it played exactly
- side stages (held 2): after 11, closed after 16 (unsure: episodes 11-15 weren't asked again, so carried on)
- newcomers: Jonna Mannion (5, for Cara Maria Sorbello)

**Survivor 49 (survivor 49)**

| Ep | Groups at the end | Sure | Played apart | Went home as (ours / the answer's) |
|---|---|---|---|---|
| 3 | 3 of 3 | sure | - | individuals / individuals |
| 4 | 2 of 2 | sure | - | individuals / individuals |
| 5 | 2 of 2 | sure | - | individuals / individuals |
| 6 | 3 of 3 | sure | - | individuals / individuals |
| 7 | none, none | sure | yes | individuals / individuals |
| 8 | none, none | unsure: the answer says teams-formed from episode 8, but its groups don't show it | - | individuals / individuals |

- sure changes: swap (every group new) from 4; swap (every group new) from 6; merge from 7 (all three right)
- lifetimes: 7 of 8 groups the fixture has, 7 with the episodes it played exactly
- side stages (held 2): after 5, closed after 5

**Battle of the Eras (the-challenge 40)**

| Ep | Groups at the end | Sure | Played apart | Went home as (ours / the answer's) |
|---|---|---|---|---|
| 2 | 0 of 0, +4 | sure | - | individuals / individuals |
| 3 | 4 of 4 | sure | - | individuals / individuals |
| 9 | 0 of 0, +3 | unsure: the answer says split-into-individuals from episode 10, but its groups don't show it | - | individuals / individuals |
| 10 | none, none | sure | yes | individuals / individuals |
| 12 | none, none | sure | - | individuals / individuals |

- sure changes: teams-formed (every group new) from 3; split-into-individuals from 10 (both right; Episode 2's eras, listed a
  week early, are the teams that played from 3)
- lifetimes: 4 of 4 groups the fixture has, 4 with the episodes it played exactly
- side stages (held 2): after 4, closed after 9 (unsure: episodes 4-8 carried on)

**The Traitors (US) season 4**: no groups, nothing changed, every episode sure.

**All**

- episodes 23: sure 20; groups at the end exactly right 18
- played apart 3 of 3 (+0 not)
- went home as: ours 22 of 23, the answer's 21 of 23
- sure grouping changes 11, right 11, wrong 0
- the fixture's within reach 13: sure 11, unsure 1, missed 1
- lifetimes: 85 of 85 exactly (3 groups the fixture doesn't have)

## F3 part 2: where the engine reads it (2026-10-29)

F3's second part puts the state over time to work (the plan's F3 has the details):
- **Built from the database, on read**: each season's stored research makes its timeline each time something reads it (one
  query), so a corrected answer changes everything after it the next time anything looks.
- **The prompt's groups going in** come from the timeline: whoever went home since is dropped, and when it isn't sure the
  prompt says so ("We aren't sure of these ... check them against what you find"). The words are otherwise F2's.
- **Newcomers** (finding 8: Jonna was never in the cast): from the episode after research says someone came in, research asks
  about them like anyone, so their results and exit are staged for the season. Adding them to the cast every game sees stays
  a person's: the review of the episode they came in says so, and the desk can list them (who, when, for whom, when they
  left).
- **One word for the groups** (finding 2: "agency"): beside the section the prompt says the season's word when the timeline
  knows it (tribe or team), else the show's own (its data: a couple, an alliance), and on a season where the names' groups are
  only a label (The Challenge's Vets and New Threats beside its pairs) it says so, naming no word. Survivor's words are
  unchanged. The Challenge's show row still calls its groups an "agency", which its premiere's prompt says: a data fix on the
  desk (recommended "Team").
- **A6's group question on a season played in pairs**: "Which pair wins?" offers the pairs going into the lock ("Ann & Bea"),
  and is graded on the pairs that played: a pair re-drawn at the episode's start is void for whoever picked it, and an
  episode whose pairs aren't sure is void for everyone (no points either way) unless the game follows the people (each pair
  graded by who was in it). Which one is the default is the user's. Survivor's tribes keep coming from its staged tribe
  moves, as before.

**What it changes for F4 and A10 to A12.**
- **F4** replays a season as if live with these readers in place: each episode's prompt is built from the timeline of the
  episodes before it (the groups going in, the newcomers on the checklist), so a blind replay asks what the live season would
  have been asked; a group question on The Challenge's pairs is one of the games it plays.
- **A10's group slots** read the same `groupFacts`-style source (the pairs going into each lock, held or not) and need ids
  that survive a correction (today a group's id carries the episode it was first shown).
- **A11's teams** and **A12's stages** read the timeline from the database the same way (`db/format-timeline.js`).

## F4: blind replays (2026-10-29)

F4 replayed each studied season as if it were live, through every game the engine plays, with each format change arriving
only in its episode's research (`node scripts/dev-test/blind.js run`; the plan's F4 says how it's built). In short:

- **The games**: every ✅ row of the capability tracker, each spec once, checked on the season by the engine lab's own check;
  those that play were made before the premiere, from what was known then (the season's rules, and of its format nothing),
  with four players of the friend-group archetypes answering every question by habit. A group question asked each episode
  played twice, void by default and following the people, and The Challenge got its own (which pair or team wins the daily
  challenge), since the tracker's is Survivor's tribe immunity.
- **The research**: the tape's answers, with the format section they don't have. Where F2 asked an episode again with today's
  prompt (23 of the 88), the local bot's own answer, mistakes and all; elsewhere a stand-in from F1's fixture at the episode's
  end, as research would say it if it were right. Who went home is the fixture's (the tapes get a few wrong), so a held exit
  doesn't stand in for a format change. The local bot didn't answer during F4, so nothing new was asked; a run of whole
  seasons with today's prompt would replace the stand-ins (the plan's Noticed).
- **What it proves**: the engine's side, through every change on five seasons: every game kept playing, scored only what
  was settled, and ended, its questions settled but for those waiting on an episode whose results stayed early. Research's side (how often the section is right) is F2's proof.

**What it found, fixed in the grader** (each would have scored nonsense through a change nobody announced):

1. **A paired season's premiere was graded on labels.** The Challenge 41's "which pair wins" offered the league's own groups at
   the premiere, the cast list's Vets and New Threats; every pair is one of each, so everyone who answered was right. Now an
   episode research says was played in pairs, when nothing said so going in, is off once its research lands (no points
   either way). The picker at the premiere still offers the labels, since nothing is known then: the plan's Noticed has the
   recommendation (read the rulebook's "groups change all the time").
2. **Groups the league holds that nobody plays in were graded.** The Challenge 40's eras are its cast list's groups, but they
   were teams only in Episodes 3 to 9: in 1 and 2 everyone played together (all four eras were right) and from 10 each for
   themselves (graded on the daily winner's era). Now an episode played without groups, or with nobody in a group going in,
   is off, and nothing is offered at its lock. Survivor after its merge reads the same way; its tribes before it are as before.

**What it found and left:** a question about The Challenge 41's finale never settles: the finale's results stay early (the
playtest report's finding 20), so its moments never come in. Settling it in the grader (off once the game is over) would read
every finale moment question off through the hours before the full research on every finale night, so the fix is finding
20's (the plan's Noticed), and the replay reports such questions as waiting on early results, not as a game that didn't end.
And The Challenge 39's fixture had no final (F1 recorded nobody leaving in 18 and 19), so its first blind replay crowned
nobody: the final is in the fixture now, from the same Wikipedia revision.

### The seasons, replayed

`node scripts/dev-test/blind.js summary --md`. "Sections": the episodes whose format section is the local bot's own (F2's)
against F1's stand-in. "Sure changes" and "Held": what the timeline called sure (a game's structure would move on it) and what
it held as unsure, every kind (twists and phases too). "Waiting on early results": games with a question still waiting on an
episode whose results stayed early (finding 20).

| Season | Episodes | Sections (bot / stand-in) | Sure changes | Held | Games | Played through | Over | Waiting on early results |
|---|---|---|---|---|---|---|---|---|
| Survivor 49 | 13 | 6 / 7 | 5 | 1 | 69 | 69 | 69 | 0 |
| The Challenge 39 (Battle for a New Champion) | 21 | 0 / 20 | 16 | 0 | 51 | 50 | 51 | 1 |
| The Challenge 40 (Battle of the Eras) | 21 | 5 / 16 | 8 | 1 | 51 | 50 | 51 | 1 |
| The Challenge 41 (Vets & New Threats) | 21 | 8 / 13 | 18 | 5 | 51 | 51 | 51 | 3 |
| The Traitors 4 | 12 | 4 / 8 | 8 | 0 | 51 | 51 | 51 | 0 |

Every game ended on every season. The two not "played through" are the same game (the tracker's w072, "will anyone quit this
season?", asked once): nobody quit on The Challenge 40 or 39, and "no" waits for every episode's moments, while The Challenge
40's finale and The Challenge 39's Episode 3 stayed early. The replay classes that as finding 20's now (a later run reports
it under "waiting on early results"). Of the tracker's 81 distinct specs, 51 play on each Challenge season and The Traitors 4,
and 69 on Survivor 49 (the rest name a moment, a phase or a role those shows don't have: an idol, the merge, secret roles).

**The Challenge 41**, the hard test (rotating pairs every episode in 1-8, an individual episode at 9, the Lock In's pairs from
10, the claim at 16, a newcomer at 5). "Which pair or team wins the daily challenge?", void by default and following the
people, lock by lock:

| Ep | Void by default | Following the people |
|---|---|---|
| 1 | 2 offered (the labels); off | 2 offered; off |
| 2 | none offered; off (the premiere's report can't be checked) | 15 offered; right: Leka Sodade & Turbo |
| 3-8 | 15, 14, 14, 13, 12, 11 offered: each episode's new pairs; the winning pair right | the same |
| 9 | 10 offered; off (played alone) | 10 offered; off |
| 10 | 12 offered (the Lock In's); right: Michaela Bradshaw & Cedric Hodges | the same |
| 11 | none offered; off (10's answer contradicted itself) | 11 offered; right: Derrick Kosinski & Dee Valladares |
| 12-15 | 10, 9, 8, 7 offered; the winning pair right | the same |
| 16 | 6 offered; off (the claim partway: unsure) | 6 offered; right: Turbo & Sydney Segal |
| 17 | none offered; off | 5 offered; right: Turbo & Sydney Segal |
| 18 | 4 offered; off | 4 offered; off |
| 19 | 4 offered; waiting (the finale's results stayed early) | the same |
| 20-21 | none offered; off | the same |

Every re-pairing reached the next lock as its new pairs, the Lock In's twelve pairs from 10, the newcomer (Jonna Mannion) on
the checklist from 6 and in her pair (Jake Cornish & Jonna Mannion; only Jake resolves to the cast until a person adds her), and
the tapes' wrong exits made right (Gabe Wai and Jonna Mannion at 11, Leonardo Dionicio at 14).

**The Challenge 40** (everyone together in 1-2, the eras as teams in 3-9, each for themselves from 10): the group question is
off at 1 and 2, graded on the eras in 3-9, and off from 10 (none offered from 11). The eras are the league's own groups (the
cast list's), so they read as Survivor's tribes do; the timeline only says when nobody plays in them.

**The Challenge 39** (everyone in 1-4, pairs or teams drawn at the start of nearly every episode in 5-14, each for themselves
from 15): off in 1-5 (3 waiting on its early results) and from 15; the drawn pairs at 6 and 10 void for whoever picked
(re-drawn at the start); but the named teams are staged as tribe moves, so each lock offered the teams the league then had
and the episode was graded on its new ones: at 7, 8, 11 and 14 the right team wasn't on offer, and at 13 it was by name only
(Team 1 to 4 were drawn afresh each episode in 11-13 under the same names).
That one is the plan's Noticed (a pick of a group that didn't play as offered, on the league's own groups: void, recommended),
with Survivor's swaps, which read the same way by name.

**Survivor 49** (two swaps and the merge): the tribe question offered the tribes each lock from 2 (the premiere offered none:
Noticed), followed the swaps at 4 and 6 by the staged tribe moves (graded on the new tribes by name), and is off from the merge
(7) on. The split immunity at 8 (two teams for one challenge) was held, never acted on.

**The Traitors 4**: no groups; the twists (the Secret Traitor, the Dagger) and the recruit came as twists and a role, never
moving a game's structure; every game, its secret-role questions among them, ended.

### What it means for A10 to A12

- **A10's group slots** read the same groups a group question does: the void default holds up (a re-drawn pair, an unsure
  lock, the premiere), and the open item above (a group that didn't play as offered, on the league's own groups) needs its
  answer before a slot holds a tribe or a drawn team. Group ids still carry the episode a group was first shown (F3 part 2's
  item).
- **A11's teams** and **A12's stages** read `playedIn` and `stageTriggers`: on these seasons every sure trigger was right
  (re-pairings, the Lock In, the swaps, the merge, the eras as teams and their split); the held ones were the premiere's, 10's
  contradicted answer, the claim at 16, the finale's split and Survivor 49's split immunity.
- **The blind replay is the check for each of them**: `blind.js run` after each step that touches a reader of the format.

## A10 part 1: group slots, replayed blind (2026-10-29)

A10's first part built the user's group slots (the plan's "When a grouping lasts": a solo draft plus a +1 or +2 slot that
holds a pair or a team the show forms; state-logic.js `GroupSlotLogic`, on the timeline's groups at each episode's end and as
played). The blind replays played two such games on every season, a Weekly Lineup with two slots and one with one (the
defaults: shared, no swaps, void when the groups aren't sure, a group's points its people's mean), each seat filling an empty
or dropped slot before each episode with the group on offer holding most of its team. Every game ended on all five seasons
(the season table below), and what the slots did at each change is what the design says:

| Season | Groups | Slot-episodes held / void / dropped / empty (two-slot game) | What the slots did |
|---|---|---|---|
| The Challenge 41 | pairs re-drawn nearly every episode, the Lock In from 10, the claim at 16 | 96 / 34 / 22 / 16 | a fresh pick at nearly every episode (a pick each episode, as the user said); nothing on offer at the premiere or at 2 (the premiere's report can't be checked); void at the Lock In's unsure 11 and the claim at 16-17 |
| The Challenge 40 | the eras as teams in 3-9, each for themselves from 10 | 56 / 8 / 88 / 16 | the eras ridden through 3-9 (a side draft, as the user said), every slot dropped at the split |
| The Challenge 39 | teams drawn at the start of nearly every episode | 0 / 80 / 48 / 40 | never held: the groups at an episode's end, the ones a slot is picked from, never play the next (the plan's Noticed: say so up front, and offer a pick each episode there) |
| Survivor 49 | tribes, two swaps, the merge | 24 / 24 / 48 / 8 | the tribes ridden, void at the swaps (re-drawn at an episode's start), every slot dropped at the merge (one tribe of everyone isn't a grouping) |
| The Traitors 4 | none | 0 / 0 / 0 / 96 | nothing ever offered: the game plays as a solo draft |

The season table (`blind.js summary --md`, with A10 part 1's two games among each season's):

| Season | Episodes | Sections (bot / stand-in) | Sure changes | Held | Games | Played through | Over | Waiting on early results |
|---|---|---|---|---|---|---|---|---|
| Survivor 49 | 13 | 6 / 7 | 5 | 1 | 71 | 71 | 71 | 0 |
| The Challenge 39 (Battle for a New Champion) | 21 | 0 / 20 | 16 | 0 | 53 | 53 | 53 | 2 |
| The Challenge 40 (Battle of the Eras) | 21 | 5 / 16 | 8 | 1 | 53 | 53 | 53 | 2 |
| The Challenge 41 (Vets & New Threats) | 21 | 8 / 13 | 18 | 5 | 53 | 53 | 53 | 3 |
| The Traitors 4 | 12 | 4 / 8 | 8 | 0 | 53 | 53 | 53 | 0 |

## A10 part 3: the spread and the draw, replayed blind (2026-10-29)

A10's third part built a draft spread across the cast's groups as the data has them when it drafts ("Everyone drafts one
castaway from each tribe": state-logic.js `SpreadLogic`) and names out of a hat (a draft dealt at random when it starts,
seeded and recorded: `DrawLogic`). The blind replays played four such games on every season: an Outlast of three spread across
the groups (s05), a blind Weekly Lineup of five spread across them (`who.spread`), an Outlast of one each out of one hat (s38)
and an Outlast of two each from a hat each (`answer.draw`). Every game ended on all five seasons (The Challenge 41, 40 and 39
60 of 60, Survivor 49 79 of 79, The Traitors 4 58 of 58), with no problem in any game's moves.

- **The draws** dealt every seat at the draft, before the premiere: from one hat four different people, from a hat each some
  the same (Survivor 49's Jeremiah Ing on two teams), each line in the draft's log, the seed recorded.
- **The spread drafts drafted plainly on every season**, the fallback for a show not divided when it drafts: every game is made
  before the premiere, and no league had groups then. Survivor 49's cast has its tribes from the premiere on (`tribes_from_episode`
  1, a spoiler guard), so a league sees them once Episode 1 has results; by then the draft is done (the blind spread Weekly Lineup
  gave two seats five Kele each). The Challenge's teams come only from research, after the episodes. On The Traitors 4 both spread
  games were refused (nobody on the show is in a group), as the data rule says.
- **What it means:** a spread draft spreads only where the groups are known when it drafts: a draft after the premiere, a later
  start, or a season whose desk shows the starting tribes ahead. The plan's Noticed (A10 part 3, item 4) has the options for the
  user, with a recommendation: say so at Start a game and offer to draft after the premiere, and show the tribes ahead on the desk
  wherever they're public.

## A10 part 3b: the auction and the salary cap, replayed blind (2026-10-29)

A10's part 3b built a draft's prices: an auction by sealed bids settled at once (state-logic.js `AuctionLogic`) and a salary cap
whose prices follow the data, each castaway's points so far by the game's rules (`PriceLogic`, `BudgetLogic`). The blind
replays played three such games on every season: an Outlast auction of three (`answer.bid`), a Weekly Lineup auction of five
(s03, 100 each) and a blind Weekly Lineup of four under a salary cap of 100 (s04). Every game ended on all five seasons (The
Challenge 41, 40 and 39 63 of 63, Survivor 49 82 of 82, The Traitors 4 61 of 61), with no problem in any game's moves.

- **The auctions settled at the draft, before the premiere**, every seat's sheet in: the seats bid by habit (the budget over
  the team they wanted most, backups at 1), the forgetter's sheet was locked in empty for them and filled at 1 each, from a
  seeded hat (The Challenge 41's Outlast: the tinkerer paid 49, 33 and 17; the forgetter got three at 1). Where two wanted the
  same castaway, the higher bid won and the other's place went to a backup (The Traitors 4's Weekly Lineup: one of the
  tinkerer's first five went to a higher bid, and Monét X Change, a backup, filled it at 1).
- **The salary cap didn't bite at the draft on any season**: every game is made before the premiere, when nobody has scored, so
  every price is the same (the middle: 25 for a team of four under 100) and every team fits. Its prices move once results come
  in, and from then on it holds every change (waivers, a replacement filled at the lock) within the cap, or no further over.
- **What it means:** a salary cap drafted before the premiere is a plain draft whose later changes are capped. The plan's
  Noticed (A10 part 3b, item 8) has the options for the user, with a recommendation: say so at Start a game ("prices start equal
  and move after each episode"), offer the cap where teams change each episode, and a draft after Episode 1 where a maker wants
  the draft itself to bite.

## A10 part 3c: the stock market, replayed blind (2026-10-29)

A10's part 3c built buying and selling each week on part 3b's prices (state-logic.js `MarketLogic`): everyone has the budget to
buy a team at the draft, then sells one of theirs at today's price and buys someone at theirs in each waiver week, cash a ledger
worked out from the logs, nobody spending more than they have. The blind replays played two such games on every season: an
exclusive snake Weekly Lineup of four that trades (`answer.trade`) and a shared Weekly Lineup of five, 100 each, ranked by
worth (s22). Every game ended on all five seasons (The Challenge 41, 40 and 39 65 of 65, Survivor 49 84 of 84, The Traitors 4
63 of 63), with no problem in any game's moves and nobody's cash below nothing in any week.

- **The trades happened where a castaway's price ran ahead of their form.** Only the tinkerer swaps by habit (the other three
  seats only replace someone gone home, or nothing); it traded one to six times a season, selling high and buying in form
  (Survivor 49's s22: Sophie Segreti sold at 21 for Rizo Velovic at 14, 7 in hand; Steven Ramm at 22 for Savannah Louie at 14;
  Alex Moore at 39 for Sophi Balerdi at 35; then MC Chukwujekwu bought at 26 with Rizo's 18 and what it had saved). The first run,
  before the seats learned to rank only what a sale pays for, barely traded: the best-rated free agents were the dearest.
- **Nobody could replace someone who went home.** Every game is drafted before the premiere, when every price is the middle,
  so a team costs exactly the budget and everyone starts with nothing left; someone gone home sells for nothing, and the
  cheapest still in costs 1, so a seat that hadn't made money trading held its castaways out for the rest of the season (the
  autofill fills only someone they can afford). The game keeps playing, as its fallback says, but the seats that don't trade
  watch their teams empty (on The Challenge 41 and 40 the drive-by and the forgetter ended near or below zero).
- **What it means:** the starting cash and what someone gone home sells for decide whether a market is playable for a couch
  that doesn't trade. The plan's Noticed (A10 part 3c, items 1, 5 and 7) has the options for the user, with a recommendation:
  leave some cash at the start (a market's highest price set so the draft leaves a tenth of the budget), so a replacement at
  the lowest prices is always within reach.

## A10 part 4: keepers, replayed blind (2026-10-29)

A10's part 4 built keepers across seasons (state-logic.js `KeeperLogic`, the server's `keepers.ts`): a game that continues last
season's, each seat keeping up to N of its team there who are on this season's cast, named before the draft (or its best, by
last season's own measure, for someone who names nobody), locked as the draft starts, the draft filling the rest. Nothing in the
data links a person across seasons, so they're matched by name as each season's cast records it (accents, case, punctuation, a
nickname in quotes and a Jr. left out, nothing looser). The blind replays played two such games on every season: s17 (an Outlast
of three keeping up to two) and the dial row (a snake Weekly Lineup of four keeping one, at the cost of a first round). For each,
`blind.js` first made last season's game for the same four seats, an Outlast on the show's previous season as this database has
it loaded, every seat dealt a team at random from its own hat (a shared draw, so two seats can hold the same castaway). Every
game ended on all five seasons (The Challenge 41, 40 and 39 67 of 67, Survivor 49 86 of 86, The Traitors 4 65 of 65).

- **Returning players are found by name.** The Challenge 41 has 11 of 40's cast (Johnny "Bananas" Devenanzio among them), 40 has
  5 of 39's (Horacio Gutiérrez Jr. with his accent and suffix). Each seat kept who it had among them, best first, and every team
  was filled to its size by the draft.
- **Two seats can want the same keeper** when last season's game was shared and this one is exclusive: on The Challenge 40 the
  tinkerer and the forgetter both had Horacio Gutiérrez Jr.; the tinkerer, first in the draft's order, kept him, and the forgetter
  kept its other returnee (Kyland Young). The plan's Noticed (A10 part 4, item 4) asks the user how such a clash should go, with a
  recommendation (first come, said up front).
- **A season with no previous one loaded** (The Challenge 39, Survivor 49, The Traitors 4) keeps nobody, and every team is drafted
  whole: the fallback when last season's game can't be found.
- **Survivor 49 can't hold an exclusive snake of five for four** (18 castaways): the replays start a tracker game without the
  couch's count, which the check would have refused. The dial row drafts four now; the plan's Noticed asks that the replays pass
  their four seats as the count.

## A10 part 4b: a shared team, replayed blind (2026-10-29)

A10's part 4b let up to N accounts hold one seat (the spec's `extras.seats`, the server's `shared-seats.ts`): a second person
joins by an invite to it, either makes its moves (the last one counts, who made each recorded), each keeps their own spoiler mark
(the lowest where the seat's own state depends on one), one leaving keeps it for the other, and the couch credits each of them with
the team's place. None of that touches the format: a shared team is one team, and every format reader (group slots, a spread draft,
group questions, a stage that starts on a change) reads it as one seat. The blind replays played the tracker's two sharing games on
every season, who.sharedTeam (an exclusive snake Outlast of three, two a team) and s18 (a Weekly Lineup, two a team), with one
account a seat (the replays' four seats each have their own), so they prove the games play and end through every format change
(The Challenge 41, 40 and 39 69 of 69, Survivor 49 88 of 88, The Traitors 4 67 of 67), not the sharing itself: that is
`check-shared-seats.js`, through the app's API. A replay with two of its people on one team is the plan's Noticed (A10 part 4b).

## A11 part 1: a race and knockouts, replayed blind (2026-10-29)

A11's part 1 built a draft's race and players knocked out (the spec's `rank.race` and `rank.cut`, state-logic.js `KnockoutLogic`):
the first to N points wins and the game ends there; the lowest every n episodes is out (the guillotine), or the bottom n or half
after an episode or before a phase; last one standing, one left ending it; a knocked-out player's castaways back in the pool in an
exclusive draft. None of it reads the show's groups: it reads the game's own points, episode by episode, each team as it stood
then. The blind replays played the tracker's four such games on every season they fit: win.race and s36 (a Weekly Lineup, first to
20), win.guillotine (an exclusive Outlast of three, the lowest every two episodes out), win.cut and s02 (a Weekly Lineup, the
bottom half cut before Merged: Survivor 49 only, the one season with that phase) and s01 (an exclusive best ball of four, the
lowest each episode out, with waivers). Every game ended on all five seasons (The Challenge 41, 40 and 39 72 of 72, Survivor 49
92 of 92, The Traitors 4 70 of 70).

| Season | The race (to 20) | The guillotine, every two | The guillotine, each episode (s01) | The cut before Merged |
|---|---|---|---|---|
| The Challenge 41 | never reached (Fan 9 at the end; its scoring runs negative): played to the season's end, 19 | over at 8 | over at 7 | (no Merged) |
| The Challenge 40 | won in the finale, 19 (Fan 17 to 27) | over at 6 | over at 3 | (no Merged) |
| The Challenge 39 | won at 10 (Tinkerer 26) | over at 8 | over at 5 | (no Merged) |
| Survivor 49 | won at 5 (Tinkerer 21.5) | over at 6 | over at 3 | Drive-by and Forgetter cut; played to 13 |
| The Traitors 4 | won at 6 (Drive-by 23) | over at 8 | over at 4 (Forgetter wins on 11, Tinkerer cut last on 12.5) | (no Merged) |

- **An episode where nothing scored can stay at early results for good.** The first run had The Challenge 39's Episode 3 (who went
  home, nothing to score) marked early forever, since the season sync marks an episode final only on a scoring moment or the full
  answers; the walk waited on it, and the season's race and both guillotines never moved again. Now only the newest episode's early
  results wait: an earlier one counts once a later one has results. The plan's Noticed has the stage itself, for whoever next
  touches results' stages.
- **The harness offered moves the engine refused:** the replay's seats tried lineups for a seat already cut and for an episode
  after a race's finish (Survivor 49's race and cut, The Traitors 4's race); the engine refused each. `playtest.js` now makes no move
  for a seat that's out or after an early end, as the app will offer none.
- **Last one standing can beat the most points:** on The Traitors 4 the each-episode guillotine was won by the forgetter on 11, with
  the tinkerer cut last on 12.5, and on new-fixture.js's couch (`check-knockouts.js`) sam won on 12 to jordan's 13: a guillotine
  cuts on the episode's points, not the total.
- **The teams are read as they stood:** a waiver move counts from the episode after it's made (the mid-season log), so a castaway
  picked up, or a knocked-out player's freed castaway claimed, never reaches back to change who was cut before it.

## A11 part 2: a pool's knockouts, replayed blind (2026-10-30)

A11's part 2 built a pool's knockouts beyond A10 part 2's lives: a pick that never repeats (`get.repeat` 'never', a night with
nobody left a missed pick by default), and last one standing's end as settings (`rank.oneLeft`: one or none left ends the game;
`rank.allOut`: the night everyone left goes out, by points, shared or all back in), walked everyone together (state-logic.js
`PickEmLogic.walk`). Like A10's pool it reads who went home, never the show's groups, so a swap, a merge or The Challenge's pairs
reach it only as exits. The blind replays played the tracker's new game, the corpus row w047 (a Survival Pool that never repeats,
one life, last one standing, none or one left ending it, a shared win), on every season, with all the others: every game ended on
all five seasons (The Challenge 41, 40 and 39 73 of 73, Survivor 49 93 of 93, The Traitors 4 71 of 71), no move refused.

| Season | w047: over at | Its winner | Who was out when |
|---|---|---|---|
| The Challenge 41 | 1 | Drive-by, on 1 | Tinkerer's premiere pick went home; Forgetter and Fan made none |
| The Challenge 40 | 7 | Tinkerer, on 7 | Drive-by's pick went home in 7 (6); Forgetter and Fan out at 1 |
| The Challenge 39 | 5 | Tinkerer, on 5 | Drive-by out in 5 (4); Forgetter and Fan out at 1 |
| Survivor 49 | 2 | Tinkerer, on 2 | Drive-by out in 2 (1); Forgetter and Fan out at 1 |
| The Traitors 4 | 10 | Tinkerer, on 10 | Drive-by out in 10 (9); Forgetter and Fan out at 1 |

- **One life ends a forgetter's game at once:** the forgetter picks every third week and the fan every other one (the harness's
  habits), so neither picks for the premiere, and a missed pick costs the only life: both are out after Episode 1 on every season,
  as in A10 part 2's pools with lives. It's A10 part 2's Noticed item 2 seen live (a missed pick filled at the lock, or a first
  missed pick forgiven, would keep the Fan Who Forgets in).
- **None or one left ends it, early:** every season's w047 was over well before its finale (at 1 on The Challenge 41, whose premiere
  sent the tinkerer's pick home), so nobody reached the end of the cast, and no night sent everyone left out together: the shared
  win and a night with nobody left to pick are proven by the unit tests and `check-pool-knockouts.js`, not by the tapes.
- **Nothing reads a format change:** a pool's picks name people as the cast has them at each lock (who's still in), so The Challenge's
  re-pairings, Survivor 49's swaps and merge and The Traitors 4's twists change nothing for it, which the replays bear out.

## A11 part 2b: a game of questions' knockouts, replayed blind (2026-10-30)

A11's part 2b gave a game of questions a race and cuts on its answers' points, and lives on its answers (a wrong answer, or none,
to a question a life rides on costs one once it's settled; at none you're out), walked over the graded answers by the server on each
copy of the league it reads (state-logic.js `AnswerLogic.walk`, handed to the engine as `answerWalk`). Its first tracker game is
the stretch request s48, "Guess every elimination winner; a wrong guess knocks you out" (Who wins the elimination? each episode, by
The Challenge's `eliminationWin`, one life, last one standing), which plays on The Challenge's three seasons only: Survivor 49's and
The Traitors 4's rules have no elimination winner. The blind replays played it with every other game: every game ended on all five
seasons (The Challenge 41, 40 and 39 74 of 74, Survivor 49 93 of 93, The Traitors 4 71 of 71), no answer refused (the harness answers
nothing for a seat that's out or after a game ended early, as the app offers nothing then).

| Season | s48: over at | How |
|---|---|---|
| The Challenge 41 | 1 | Tinkerer and Drive-by guessed the premiere's elimination winner wrong; Forgetter and Fan answered nothing: everyone out the same night, tied on 0 |
| The Challenge 40 | 2 | The premiere had no elimination winner (nobody lost a life); in 2 only Drive-by named one of its six winners: the last one standing, on 1 |
| The Challenge 39 | 1 | As on 41: two wrong, two silent, everyone out at once |

- **It reads elimination winners, not the format:** who won an elimination is a moment research records per person, so The
  Challenge's pairs, teams and each-for-themselves stretches reach it only as who won (on 40's pairs episodes, several winners at once:
  naming any of them is right). A night with no elimination winner (40's premiere) is off: nothing to be wrong about, nobody loses a
  life, answered or not.
- **One life among four seats is over at once:** two of the four seats skip weeks by habit, so on a premiere with an elimination they
  answer nothing and go out, and two guesses at a single winner are likely wrong: on 41 and 39 the night sent everyone left out
  together, and by default (`rank.allOut` 'points') they're all out, tied on nothing. The game's own end is the user's (A11 part 2b's
  Noticed items 1 and 5): all back in for such a night, or a missed answer forgiven, would have kept it going.
- **The walk on what each has seen:** the tables recorded are as the runner sees them once each episode is in; the unit tests and
  `check-answer-knockouts.js` prove that a viewer behind isn't knocked out by what they haven't seen.

## A11 part 3: co-op against the show, replayed blind (2026-10-30)

A11's part 3 gave a game of questions co-op: its lives are the couch's together (`rank.by 'coop'`), a question they ride on costing
one on a night unless enough of the couch saw it coming (`score.saves`, by default one right answer among those who answered), the
game lost by all the episode the last one goes and won by all at its end with one left, walked over the graded answers as part 2b's
lives are (state-logic.js `AnswerLogic.walk`, its co-op branch). Two tracker games: the dial row win.coop (Who goes home? each
episode, three lives), which plays on all five seasons, and the stretch request s37, "Co-op: together we have 5 lives; every faithful
banished we didn't see coming costs one" (Which Faithful will be banished? each episode, five lives, settled by The Traitors' own
implied moment `banishedAsFaithful`), which plays on The Traitors 4 only. The blind replays played them with every other game: every
game ended on all five seasons (Survivor 49 94 of 94, The Challenge 41, 40 and 39 75 of 75, The Traitors 4 73 of 73), no answer
refused, no problem in the moves.

| Season | win.coop: lost at | Lives lost | s37: lost at | Lives lost |
|---|---|---|---|---|
| Survivor 49 | 4 | 1, 3, 4 (saved 2) | | |
| The Challenge 41 | 3 | 1, 2, 3 | | |
| The Challenge 40 | 9 | 3, 5, 9 (the premiere off: nobody went home; the rest saved, pairs going home together) | | |
| The Challenge 39 | 3 | 1, 2, 3 | | |
| The Traitors 4 | 4 | 2, 3, 4 (the premiere off) | 10 | 3, 4, 6, 9, 10 (the premiere, 7 and 8 off: no Faithful banished; 2 and 5 saved) |

- **It reads who went home, not the format:** win.coop's question is who goes home, as people, so The Challenge's pairs, teams and
  each-for-themselves stretches reach it only as who left (on 40's pairs episodes two at once: naming either saves the night). s37's
  is who was banished as a Faithful, the role as of that episode, so a night only a murder happened, a Traitor was banished or nobody
  left is off and costs nothing; The Traitors 4's changes (twists at 5, 7 and 9, a role at 9, a new phase at 11) changed nothing it reads.
- **Four seats rarely call a boot:** two of the four seats answer by habit and two skip weeks, and guessing who goes home among a
  big cast is hard, so three shared lives last three or four episodes on most seasons; on 40, where pairs go home together, it lasted
  to 9, and s37's five lives on The Traitors to 10 of 12. Who saves a night and how many lives (A11 part 3's Noticed items 1 and 6)
  are the user's.
- **The walk on what each has seen:** the records are the runner's view as each episode came in; the unit tests and `check-coop.js`
  prove a viewer behind still sees both lives, and a corrected result bringing a lost game back.

## A11 part 4: head to head, replayed blind (2026-10-30)

A11's part 4 gave a draft head to head (`rank.by 'matchups'`): each episode everyone plays one of the others on that episode's
points by the game's own scoring, on a round robin of the seats; the standings by wins (a tie half), then points; and the playoffs
(`rank.playoffs`), the top seeds over the game's last episodes as the data has them (its span's end, else the season's episode
count from its schedule, kept once their first round has results), a round an episode, the champion first in the table
(state-logic.js `MatchupLogic`). The dial row win.h2h (a Weekly Lineup, the top four in the playoffs over the last two episodes)
plays on all five seasons. The blind replays played it with every other game: every game ended on all five seasons (Survivor 49 95
of 95, The Challenge 41, 40 and 39 76 of 76, The Traitors 4 74 of 74), no problem in the moves.

| Season | Episodes (count) | Playoffs placed | The season's finale | Seeds (by record) | Champion |
|---|---|---|---|---|---|
| Survivor 49 | 13 | 12 and 13 | 13 | tinkerer 10-1, fan 6-5, drive-by 4-5-2, forgetter 0-9-2 | the fan (the second seed: 69 points to the tinkerer's 106) |
| The Challenge 41 | 21 | 20 and 21 | 19 | drive-by 6-3-7, tinkerer 8-6-2, fan 6-7-3, forgetter 2-6-8 | the drive-by (the season over first: never played) |
| The Challenge 40 | 21 | 20 and 21 | 19 | fan 11-2-1, forgetter 4-5-5, drive-by 2-5-7, tinkerer 3-8-3 | the fan (the same) |
| The Challenge 39 | 21 | 20 and 21 | 19 | tinkerer 9-3-4, drive-by 5-4-7, fan 7-8-1, forgetter 2-8-6 | the tinkerer (the same) |
| The Traitors 4 | 12 | 11 and 12 | 11 | tinkerer 4-4-1, fan 4-4-1, drive-by 3-3-3, forgetter 2-2-5 | the tinkerer (the semifinals at 11; 12 after the finale) |

- **The schedule counts the reunion:** The Challenge's three seasons count 21 episodes, but their final is 18 and 19 (F1's
  timelines: The Challenge 41's "the final (episodes 18-19)"), and The Traitors 4's 12 includes one after its finale at 11. So the
  playoffs, placed at the season's end as its schedule says, landed after it. The fallback held: the season over first, nothing
  after its finale plays, and the best seed still in wins (on The Challenge, before the playoffs began: the regular season's
  leader). The first run, before that rule, played the rounds on the reunion's results after the game read over at 19 (all ties, so
  the same champions, but a champion could have changed after the game was over). Where the playoffs should go on such a season (a
  finale episode in the schedule beside its count; the playoffs starting when research says the final begins, a new phase F2's
  section reports, as A12's stage on a phase) is the user's: A11 part 4's Noticed item 12.
- **Head to head isn't the most points:** on Survivor 49 the tinkerer scored 106 to the fan's 69, finished the regular season 10-1,
  and lost the final; the table puts the champion first. How the table says it (the record beside the points) is U1's: item 10.
- **It reads points, not the format:** a matchup is each team's points that episode, so The Challenge's pairs, teams and each for
  themselves reach it only as what its drafted people scored; nothing in the format changes the schedule.
- **Ties are common on The Challenge:** with shared drafts of five and three starters, two seats often score the same (the
  forgetter's 2-6-8 on 41), each a half win by default (item 3's standings, item 2's night nobody scores).
- **The walk on what each has seen:** the records are the runner's view as each episode came in; the unit tests and `check-h2h.js`
  prove a viewer behind sees the records only through what they've seen, a corrected final changing the champion, and a seat
  brought in later playing from the next episode with the weeks played unchanged.

## A11 part 4b: head to head on a game of questions, replayed blind (2026-10-30)

A11's part 4b gave a game of questions part 4's head to head: each episode everyone plays one of the others on that episode's points,
which are what the answers settled by then add (its own questions in it; one over several episodes in the episode its window ends;
one about the whole game at the game's end), handed to the engine by the server's walk over the graded answers (state-logic.js
`AnswerLogic.walk`'s series, read by `MatchupLogic.series`, where a draft's come from its own scoring). The newest episode waits for
its full results and for any question about it alone still to settle; nothing after the game's final, or the season's finale, plays.

- **No row plays it yet:** the capability tracker's corpus has no request for a game of questions played head to head (win.h2h is a
  Weekly Lineup's), so the blind replays don't start one; `blind.js` records one's matchups (`.matchups`) the day a row does. The
  proof is the unit tests (`tests/answer-matchups.test.js`) and `check-answer-h2h.js` on the fixture's couch.
- **Everything else played as before:** every game ended on all five seasons (Survivor 49 95 of 95, The Challenge 41, 40 and 39 76 of
  76, The Traitors 4 74 of 74), nothing refused, and win.h2h's records, seeds and champions are part 4's table above, unchanged.
- **Nothing after the finale plays, a week nor a round:** part 4 kept the playoffs off the reunion; part 4b keeps a regular-season
  week off it too (a draft's and a game of questions'). On these five seasons it changes nothing: The Challenge's playoffs sat on the
  reunion (20 and 21, after the final at 19), and The Traitors 4's regular season ended before its finale.
- **What it would meet on these seasons:** a game of questions' nights are often nobody's (everyone wrong, or nobody went home), which
  count for nobody by default (part 4's `quiet` skip: Noticed item 4); on The Challenge a pair question's void picks (F3 part 2's
  fallback) earn nothing either way, so the rest of the night decides the matchup; and an episode research gives no scoring moment
  stays at early results, so its matchup waits for the next episode (Noticed item 2).

## A11 part 5: teams of players, replayed blind (2026-10-30)

A11's part 5 split the couch into teams that score together (`rank.teams`, state-logic.js `TeamLogic`): each of you still plays your
own game, and your points go to your team while you're on it, each episode, summed or their mean; the teams are drawn at the game's
start (or chosen before it), kept once it starts, and the game ranks the teams (by their points, or head to head between them).

- **who.teams played on all five seasons:** a Weekly Lineup in two teams drawn from the four seats, two and two, its own draw on each
  season. Every game ended on all five (Survivor 49 96 of 96, The Challenge 41, 40 and 39 77 of 77, The Traitors 4 75 of 75), nothing
  refused.

| Season | The winning team | Its points | The other | Their points |
|---|---|---|---|---|
| Survivor 49 | the tinkerer and the forgetter (106, 6.5) | 56.25 | the drive-by and the fan (22, 69) | 45.5 |
| The Challenge 41 | the drive-by and the fan (-4, 9) | 2.5 | the tinkerer and the forgetter (2, -9) | -3.5 |
| The Challenge 40 | the drive-by and the fan (-7, 27) | 10 | the tinkerer and the forgetter (4, 1) | 2.5 |
| The Challenge 39 | the tinkerer and the fan (40, 23) | 31.5 | the forgetter and the drive-by (12, 23) | 17.5 |
| The Traitors 4 | the tinkerer and the drive-by (65, 18) | 41.5 | the forgetter and the fan (16, 30) | 23 |

- **A team's points are its members' mean, episode by episode:** with two on each team every season it's half their sum, so the table
  above adds up from each member's own total; a team carrying a member who forgets (Survivor 49's forgetter, 6.5) can still win on its
  other member's points, which the mean doesn't hide (Noticed item 3: mean or sum).
- **Teams of players don't read the show's format:** The Challenge's re-pairings every episode and Survivor 49's swaps reach a team only
  through each member's own lineup (its own fallbacks), so nothing in teams waited, voided or moved on a format change. Teams that
  follow one of the show's own groups through a swap (`made` 'group') are part 5b's, on F3's grouping lifetimes.
- **Not on these replays:** a seat that leaves, a late joiner, a move between teams and head to head between teams (the four seats stay
  for the whole season, and win.h2h plays the seats); the unit tests (`tests/teams.test.js`) and `check-teams.js` cover them.

## A11 part 5b: handicaps, replayed blind (2026-10-30)

A11's part 5b gave newcomers a handicap (`rank.handicap`, state-logic.js `HandicapLogic`): points each episode the game plays, for
anyone with no game on the couch from an earlier season. Who's new is data the server works out from the couch's games
(src/lib/server/handicaps.ts) and the engine keeps once the game starts. Each replay's game sits on a couch of its own, so `blind.js`
now seats the tinkerer and the fan in an earlier game there first (`earlierGame`), and the drive-by and the forgetter are the
newcomers.

- **who.handicap and s19 played on all five seasons:** a Weekly Lineup, 5 points an episode for newcomers to the couch. Every game
  ended on all five (Survivor 49 97 of 97, The Challenge 41, 40 and 39 78 of 78, The Traitors 4 76 of 76), nothing refused, and the
  newcomers were kept from the premiere on each.

| Season | Episodes it counted | The newcomers (their own + the handicap) | The veterans | First |
|---|---|---|---|---|
| Survivor 49 | 13 | the drive-by 22 + 65 = 87, the forgetter 6.5 + 65 = 71.5 | the tinkerer 106, the fan 69 | the tinkerer |
| The Challenge 41 | 19 | the drive-by -4 + 95 = 91, the forgetter -9 + 95 = 86 | the fan 9, the tinkerer 2 | the drive-by |
| The Challenge 40 | 19 | the forgetter 1 + 95 = 96, the drive-by -7 + 95 = 88 | the fan 27, the tinkerer 4 | the forgetter |
| The Challenge 39 | 19 | the drive-by 23 + 95 = 118, the forgetter 12 + 95 = 107 | the tinkerer 40, the fan 23 | the drive-by |
| The Traitors 4 | 11 | the drive-by 18 + 55 = 73, the forgetter 16 + 55 = 71 | the tinkerer 65, the fan 30 | the drive-by |

- **It stops at the season's finale:** The Challenge's schedule counts 21 episodes and its reunion (20 and 21) has results of its own;
  the first run, on the reviewed code, counted them (105 each, where the game is over at 19). It stops at the finale now, as head to
  head's weeks do: 19 there, 11 on The Traitors 4 (its 12th comes after the winner).
- **The size matters:** a lineup on The Challenge scores little over a season (-9 to 27 here), so 5 an episode decides the game; on
  Survivor 49 it closes most of a gap (the tinkerer still first). What a handicap is worth belongs to the show's scoring (the plan's A11
  part 5b Noticed item 8: the wizard scaling it to a typical episode).
- **A handicap doesn't read the show's format:** it counts episodes played, so The Challenge's re-pairings every episode and Survivor
  49's swaps reach the game only through each one's lineup (its own fallbacks).
- **Not on these replays:** a late joiner, a team two people share, a seat taken over, the history changing mid-season and a game of
  questions with a handicap (the four seats stay all season, and the tracker's row is a lineup); `tests/handicaps.test.js` and
  `check-handicaps.js` cover them.

## A11 part 5c: the late joiners' leftovers, replayed blind (2026-10-30)

A11's part 5c refused teams of players that follow the show's own groups (`rank.teams.made` 'group') and finished the late joiners'
leftovers (nobody new once someone's out in every game that knocks people out, someone catching up in a pool with lives, a late joiner
dealt after a draw and paying under a price, a late joiner's captain and second pick, computer players' group slots).

- **Every game ended on all five seasons**, as after part 5b: Survivor 49 97 of 97, The Challenge 41, 40 and 39 78 of 78, The Traitors 4
  76 of 76, no problem in the moves, nothing refused; the questions waiting on early results are finding 20's as before (2, 2 and 3 on
  The Challenge).
- **Why teams that follow the show's groups are refused, from these seasons:** a team of players lasts the whole game, and the groups
  here don't. The Challenge 41's pairs were re-drawn at almost every episode (one-episode lifetimes, 2 to 8), all of The Challenge 39's
  teams lasted one episode, The Challenge 40's eras were teams only in Episodes 3 to 9, Survivor 49's tribes ended at its two swaps and
  the merge, and every Challenge season ends each for themselves. A team tied to one of them would end mid-game, or be made again at
  every change, which is what A12's stages are for (a stage per grouping, a side stage once a grouping lasts, a stage a format change
  starts). Riding the show's groups is a group slot (A10 part 1's section above), a group question each episode (A6), or a stage.
- **Not on these replays:** the four seats join before the premiere and stay all season, so a late joiner, a joiner after someone's out,
  a drawn game's late deal and a late team's price never run here; `tests/late-joins.test.js` and `scripts/dev-test/check-late-joins.js`
  play them. Computer players don't sit in the replays.

## A12 part 1: stages, replayed blind (2026-10-30)

A12's part 1 built a game in stages (the spec's `stages` and `overall`, state-logic.js `StageLogic`): each stage a game of its own,
played as a league of its own tied to the game (src/lib/server/stages.ts), the game's table the overall; a game that ends before a
phase starts; and a later stage's draft that opens at its start, from who's still in, made shared then when an exclusive one no longer
fits. `blind.js` plays each stage as a game of its own (a record each, its draft when it opens) beside the game, whose table it reads as
it stands. Nothing here reads the show's format changes: a stage a format change starts is part 2's.

- **Every game ended on all five seasons**, the stages among them: Survivor 49 110 of 110 (102 tracker games, eight stage records), The
  Challenge 41, 40 and 39 81 of 81 (79 and two), The Traitors 4 79 of 79 (77 and two); nothing refused; the questions waiting on early
  results are finding 20's as before (2, 2 and 3 on The Challenge).
- **On Survivor 49, the merge** (research says it from Episode 7, known once its results are in): the stages that end before Merged
  end with 7 and the ones that start at it start with 8, as a start at a phase known only once it's begun always has (A3). The Weekly
  Lineup until the merge (when.toPhase) played 1 to 7 and was over there.

| Game (Survivor 49) | Its stages | The second draft | The overall |
|---|---|---|---|
| A second draft at the merge (shape.stages, by points) | Weekly Lineups, 1–7 and 8 on | at 8, from the 11 left | the Tinkerer 45 + 64 = 109, the Fan 21.5 + 63.5 = 85, the Drive-by 71, the Forgetter 51 |
| Rules per phase (shape.phaseRules, by places) | a Weekly Lineup 1–7, a Survival Pool 8 on | (a pool: none) | the Tinkerer 4 + 4 = 8, the Drive-by 5, the Fan 5, the Forgetter 3 |
| Pre-merge and post-merge Outlasts (s39, by stages won) | Outlasts of 3 each, 1–7 and 8 on | at 8: 4 × 3 is more than the 11 left, so shared | the Fan won Pre-merge (22), the Tinkerer Post-merge (42): one each |
| The season's halves (shape.episodes, by places) | a Weekly Lineup 1–6, a Survival Pool 7 on | (a pool: none) | the Tinkerer 7, the Drive-by 6, the Fan 5, the Forgetter 3 |

- **The season's halves on the other shows** (shape.episodes: a Weekly Lineup for Episodes 1 to 6, a Survival Pool from 7, by places),
  each stage over where it ends, the game over with the second: The Challenge 41 the Tinkerer and the Drive-by 7 each, The Challenge 40
  the Tinkerer and the Fan 6, The Challenge 39 the Tinkerer 8, The Traitors 4 the Drive-by 7. The first half's ties share a place (The
  Challenge 41's Fan and Forgetter, -5 each, 2 points each).
- **Not on these replays:** a seat leaving mid-game, a game deleted and restored, the merge corrected, and someone joining once the game
  has started (the four seats stay all season); `tests/stages.test.js` and `scripts/dev-test/check-stages.js` cover them. The stages
  ride the show's results only: The Challenge's re-pairings and Survivor 49's swaps reach each stage through its own game (its group
  questions' and slots' fallbacks), never its structure; that's part 2's.

## R1 part 1: today's games on the pieces, replayed blind (2026-10-30)

R1's part 1 drafts and scores every game by the pieces its spec names (state-logic.js `piecesOf`: the draft mechanic by `get.order`,
the scorer by `score.by`), never a league type; nothing reads a format change differently. Replayed blind again as a check that
nothing moved: **every game ended on all five seasons**, as after A12 part 1 (Survivor 49 110 of 110, The Challenge 41, 40 and 39 81 of
81 each, The Traitors 4 79 of 79; nothing refused; the questions waiting on early results are finding 20's 2, 2 and 3 as before). The
golden replays, which compare every read of every game before and after, found every one the same against this branch's code before
the part and against master's.

## A12 part 2: stages a format change starts, replayed blind (2026-10-30)

A12's part 2 is the first piece of the engine whose structure follows the show's format changes: a game in stages whose later stage
says `on` { change: the kinds that count, again } gets a copy of that stage, a league of its own, each time research is sure the format
changed that way (format-timeline.js `stageTriggers`' `act`; an unsure change is held and never acted on), from the episode the change
takes effect or the first still open, the stage before it ending there (state-logic.js `StageLogic.changePlan`; src/lib/server/
change-stages.ts, from the season sync). The tracker's p7 ("automatically start a new draft stage whenever there is a major format
change such as split into teams or split into individuals") plays: a Draft (an Outlast of 3 each) from Episode 1, then a New draft
(the same) at each major change (F3's `MAJOR`, by default). `blind.js` finds each copy after the episode whose research made it and
plays it from there as a game of its own, its draft at its start, from who's left.

- **Every game ended on all five seasons**, the copies among them: Survivor 49 115 of 115, The Challenge 41 90 of 90, 40 85 of 85, 39 94
  of 94, The Traitors 4 81 of 81; nothing refused; no copy taken away (F2's answers and the stand-ins are never corrected: the unit tests
  and check-change-stages.js cover a corrected report); the questions waiting on early results are finding 20's as before.
- **When a copy starts.** A change research says at an episode's end (from the next) starts its copy with that next episode: The
  Challenge's re-pairings. A change at an episode's start is only known from its research, after it airs, so its copy starts with the
  episode after: Survivor 49's swaps at 4 and 6 start copies at 5 and 7, its merge at 7 one at 8. A change held unsure at one episode
  and sure at the next starts from the first episode still open then: The Challenge 40's split (said for 10 at 9, unsure; sure at 10)
  starts its copy at 11.

| p7 on | Copies (each from) | What started them |
|---|---|---|
| The Challenge 41 | 7: 3, 4, 5, 6 and 7 (one episode each), 8-9, 10 on | every pair re-drawn at the ends of 2 to 7 (a swap that left no group as it was), then pairs formed at 9's end |
| The Challenge 40 | 2: 3-10, 11 on | teams formed (the eras) at 2's end; everyone on their own, sure at 10 |
| The Challenge 39 | 11: 6 to 15 one episode each, 16 on | pairs, teams and a re-draw of every team at nearly every episode's end; the split at 15's end |
| Survivor 49 | 3: 5-6, 7, 8 on | the two swaps (at 4's and 6's start) and the merge (at 7's start) |
| The Traitors 4 | none: its first stage plays the season | no major change (a recruit is a role, a twist never counts) |

- **What "major" by default does here:** The Challenge 39's and 41's re-draws make a new draft nearly every week (ten and five copies of
  one episode), each scoring about the same for everyone (an Outlast over one episode: everyone outlasts the same few). With the kinds
  of play only (no all-new swap), it would be five copies on 39, one on 41, one on Survivor 49 (the merge), two on 40 and none on The
  Traitors: the plan's Noticed asks the user which, with that as the recommendation.
- **The drafts as they open** are counted then, as part 1's: four of you × 3 fits The Challenge's casts at every copy; Survivor 49's
  copies from 7 were shared (a private draft revealed at once) once 4 × 3 no longer fit who was left.
- **Not on these replays:** the maker's OK, a corrected report taking a copy away and bringing it back, research missing for a while, the
  game deleted and restored: `tests/change-stages.test.js` and `scripts/dev-test/check-change-stages.js` cover them.

## R1 part 3: a pool's finale, replayed blind (2026-10-30)

R1's part 3 grades a pool's finale by the user's decision (only the winner survives it: state-logic.js `nightOf`, every game's one
reading of a night). Nothing about a format change reads differently. Replayed blind with A12 part 2b (below): every game ended on all
five seasons. The golden replays found one game changed: The Challenge 40's Survival Pool, one seat whose pick at the final (Episode 19)
was a winner, now right.

## A12 part 2b: the 'next-stage' fallbacks, replayed blind (2026-10-30)

A12's part 2b ends a stage whose group question or group slots can't be played as the groups stand, and starts the game's next stage,
once research is sure nobody is in a group going into an episode (format-timeline.js `groupsGone`: everyone on their own, or the
merge's one group of everyone, after groups; an unsure state is void and held; a re-draw moves nothing), through part 2's plan. No
request in the corpus words it, so no tracker row plays it; `blind.js` now records, at each episode, where such a stage would end (its
format record's `groupsGone`), as if live.

- **Every game ended on all five seasons**, as after part 2: Survivor 49 115 of 115, The Challenge 41 90 of 90, 40 85 of 85, 39 94 of
  94, The Traitors 4 81 of 81; nothing refused; the questions waiting on early results are finding 20's 3, 2 and 2, as before.

| Season | Where 'next-stage' would end a stage (the next from) | What ends the groups |
|---|---|---|
| Survivor 49 | 8 | the merge, at 7's start (one group of everyone at 7's end): known from 7's research, so the next stage starts with 8 |
| The Challenge 40 | 11 | everyone on their own: said for 10 at 9 (ahead, so unsure going in), sure at 10's research |
| The Challenge 39 | 16 | everyone on their own at 15's end, sure |
| The Challenge 41 | none in the season | the split at the final (19's end), held unsure at 19 and sure at 20's research: from 21, past the final (18 and 19) |
| The Traitors 4 | none | never in groups |

- **The same episodes part 2's split copies start at** (The Challenge 40's 11, 39's 16; Survivor 49's merge copy at 8): the fallback and a
  stage's own `split-into-individuals` or `merge` kinds read the same change, under the same key, so a stage named by both starts once.
- **The re-pairings and re-draws that make p7's one-episode copies move nothing here** (The Challenge 41's pairs re-drawn at the ends of
  2 to 7, 39's teams nearly every week): the game is still in groups, so the question offers the new ones and the slots drop and open
  again. The Challenge 41's individual Episode 9 between paired ones ends in pairs again: nothing moves.
- **The Challenge 41 shows the finale's edge:** the groups go only at the final itself, so the next stage would start after the season
  (the schedule's 21 episodes past the final's 19). The plan's Noticed (A12 part 2b, item 5) has it with part 2's edge cases.
- **Not on these replays:** an unsure state turned sure later, a corrected report taking the next stage away and bringing it back, the
  maker's OK: `tests/next-stage.test.js` and `scripts/dev-test/check-next-stage.js` cover them.

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
| 1 | Control | everyone | none | Jessica Brody (eliminated) |
| 2 | Control | everyone | none | Chauncey Palmer (eliminated) |
| 3 | Control | everyone | none | Jujuy Jiménez (eliminated) |
| 4 | Control | everyone | none | Hughie Maughan (eliminated) |
| 5 | Chaos | pairs | 10 × 2 | Ciarran Stott (eliminated) |
| 6 | Chaos | teams | Blue 6, Red 6, Turquoise 7 | - |
| 7 | Chaos | teams | Team 4 4, Team 6 3, Team 5 3, Team 3 3, Team 1 3, Team 2 3 | Callum Izzard (eliminated) |
| 8 | Chaos | teams | Blue 9, Orange 9 | Big T Fazakerley (eliminated) |
| 9 | Chaos | pairs | 7 × 2 + 1 × 3 | Melissa Reeves (eliminated) |
| 10 | Chaos | teams | Orange 8, Blue 8 | - |
| 11 | Chaos | teams | Team 3 4, Team 2 4, Team 1 4, Team 4 4 | - |
| 12 | Chaos | teams | Team 1 4, Team 4 4, Team 3 4, Team 2 4 | - |
| 13 | Chaos | teams | Team 2 4, Team 4 4, Team 1 4, Team 3 4 | - |
| 14 | Chaos | teams | Blue 4, Turquoise 4, Yellow 4, Orange 4 | Asaf Goren (eliminated) |
| 15 | Conquest | individuals | none | Ravyn Rochelle (purged), Zara Zoffany (eliminated) |
| 16 | Conquest | individuals | none | Ed Eason (purged), Horacio Gutiérrez Jr. (eliminated), Kyland Young (eliminated) |
| 17 | Conquest | individuals | none | Michele Fitzgerald (purged), James Lock (eliminated), Olivia Kaiser (eliminated) |
| 18 | Final | mixed | none | Jay Starrett (eliminated) |
| 19 | Final | mixed | none | Moriah Jadea (eliminated), Berna Canbeldek (placed), Corey Lay (placed), Colleen Schneider (placed), Nurys Mateo (placed), Emanuel Neagu (won) |
| 20 | Reunion | none | - | - |

| Took effect | Kind | Brought in | What | Research said | The engine today |
|---|---|---|---|---|---|
| 1 | twist | at the start | The prize pot moves with challenges and eliminations. | E1: rulesNote ("pot"), summary ("pot") | can't act (free text) |
| 5 | pairs-formed | at the start | 10 × 2. Drawn for the episode's challenge (at random, or by where people stood). | E5: rulesNote ("pair"), summary ("pair"), notableTwist names 1 of 10 groups | can't act (free text) |
| 5 | new-phase | at the start | Chaos: pairs or teams, and a former champion in every Arena (the Draw). | E5: rulesNote ("chaos", "champion"), summary ("chaos", "champion"), notableTwist (1 notes); E6 (late): summary ("champion"), notableTwist (1 notes) | can't act (free text) |
| 6 | teams-formed | at the start | Blue 6, Red 6, Turquoise 7. Drawn for the episode's challenge (at random, or by where people stood). | E6: summary ("team"), notableTwist names 1 of 3 groups | can't act (free text) |
| 7 | swap | at the start | every group new. Drawn for the episode's challenge (at random, or by where people stood). | E8 (late): newGroup on 18 | acts on it, late |
| 8 | swap | at the start | every group new. Drawn for the episode's challenge (at random, or by where people stood). | E8: newGroup on 18 | acts on it |
| 9 | pairs-formed | at the start | 7 × 2 + 1 × 3. Drawn for the episode's challenge (at random, or by where people stood). | E10 (late): summary ("lock-in", "lock in") | can't act (free text) |
| 10 | teams-formed | at the start | Orange 8, Blue 8. Drawn for the episode's challenge (at random, or by where people stood). | E10: summary ("team"); E11 (late): summary ("team") | can't act (free text) |
| 11 | swap | at the start | every group new. Drawn for the episode's challenge (at random, or by where people stood). | nothing | nothing to act on |
| 12 | swap | at the start | every group new. Drawn for the episode's challenge (at random, or by where people stood). | nothing | nothing to act on |
| 13 | swap | at the start | every group new. Drawn for the episode's challenge (at random, or by where people stood). | nothing | nothing to act on |
| 14 | swap | at the start | every group new. Drawn for the episode's challenge (at random, or by where people stood). | E14: notableTwist names 1 of 4 groups; E15 (late): newGroup on 15 | acts on it, late |
| 15 | split-into-individuals | at the start | Conquest: everyone for themselves. | E15: rulesNote ("individual"), summary ("individual"), notableTwist (9 notes); E16 (late): summary ("individual") | can't act (free text) |
| 15 | new-phase | at the start | Conquest: individual, last place purged, a chain of safety. | E15: rulesNote ("conquest"), summary ("conquest"), notableTwist (13 notes); E16 (late): rulesNote ("conquest"), summary ("conquest", "purge"), notableTwist (3 notes) | can't act (free text) |
| 16 | twist | mid-episode | Double eliminations in 16 and 17. | nothing | nothing to act on |
| 18 | new-phase | at the end of the episode before | The final. | E17: summary ("final"); E18: summary ("final"), notableTwist (6 notes); E19 (late): summary ("final"), notableTwist (4 notes) | can't act (free text) |

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


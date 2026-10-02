# Research: which Traitors events can be determined reliably

**Status:** Decided and implemented, 2026-10-02 (`src/lib/game/formats/traitors.js`; tests in
`tests/traitors-events.test.js`). Point values were set afterwards from 20 seasons of data:
`docs/RESEARCH-traitors-scoring-values.md`. Scoring values are deliberately out of scope; this decides the **catalog and its categories**, the
way `docs/RESEARCH-extractable-stats.md` did for Survivor before `docs/RESEARCH-scoring-values.md`
set the numbers.

**How the data will be gathered.** Traitors episodes will be read **mostly from recaps on a list of
trusted sites**, through the same copy-paste prompt flow Survivor uses: the admin copies the prompt,
a web-searching chat (ChatGPT etc.) answers with structured JSON, and it's pasted back for review
(`buildPasteImportPrompt` in `db/episode-research.js`; the checklist is `format.research.checklistSchema`;
trusted sites are `shows.research_domains`). So an event qualifies if **trusted recaps report it
consistently enough for a structured read to get it right, with "unknown" as an allowed answer**.
Being in a wiki table is a bonus (a cross-check), not a requirement.

---

## 1. What was read

Three complete, recent US seasons, every episode:

| Season | Recaps | Tables used as a cross-check |
|---|---|---|
| US2 (2024) | Peacock's official weekly recap (all 11 episodes) | Wikipedia season page; fandom `Template:US2 Voting History` |
| US3 (2025) | Gold Derby, every episode 1–11 | Same |
| US4 (2026) | Today.com (eps 1–10), A.V. Club (ep 10), Gold Derby (finale) | Same |

### Recommended trusted recap sites

| Site | Quality | Notes |
|---|---|---|
| **goldderby.com** | Best | Names each voter at most Round Tables, says who led each accusation, reports the turret's murder options, and gives mission detail per person. Covers US3 and US4 in full. |
| **today.com** | Good | Outcomes, Round Table accusations, shortlists and mission highlights. Gives vote totals more often than per-person votes. |
| **peacocktv.com** (blog) | Good, official | Outcomes and accusations. Its episode labels drift at cliffhangers (Peter's banishment is filed under ep 10). |
| **avclub.com** | OK | Opinionated, but its detail on accusations and missions is reliable. |
| tvline.com, parade.com | Not read in full | Turned up in searches with per-episode recaps; worth a spot-check before trusting. |
| vulture.com | Unknown | Blocks automated fetching, so it couldn't be checked here. A chat tool may still read it. |

Wikipedia and the fandom wiki stay useful as a **cross-check** on votes, shields and roles, where a
table beats prose (see §1.1, finding 2).

### 1.1 Cross-check findings

1. **The recaps and the tables agreed on every murder, banishment and recruitment across all 33
   episodes, with no contradictions on shields.** Recaps don't name every shield winner (Peacock skips
   US2 eps 2–3), but none named a different one.
2. **Prose vote counts are the weak spot.** Today.com says Porsha (US4 ep 2) got "one more vote than
   Kelce"; the grid says 10–8–4. When a recap gives only a total, `votesReceived` should come back
   null, not a guess, or be checked against a table.
3. **Tables aren't automatically right either.** The US3 Wikipedia Missions table lists 11 shields in
   ep 1; its own grid lists 12, and Gold Derby says 12.
4. **Cliffhangers split events across episodes, and sources disagree on which episode they belong
   to.** Examples: Peter's banishment (US2 ep 9 → 10), Danielle's tie (US3 ep 10 → 11), Eric's
   ultimatum (US4 ep 8 → 9), and the jack-in-the-box shortlist (set in US4 ep 9, murder in ep 10). The
   prompt needs a rule (§5).

---

## 2. Confidence scale (recap-first)

- **High:** every recap reports it, in plain words, every time it happens. Usually also in a table.
- **Moderate:** most recaps report it most weeks, but it either needs a small judgement call ("who
  led the case") or relies on the more detailed sites (Gold Derby). Expect some "unknown" answers.
- **Low:** rarely reported, or needs real interpretation. **Not scored.**

---

## 3. The proposed catalog, by category

`(existing)` = already in `traitors.js`; everything else is new. "Check" = the field the paste
prompt would ask for (§6). "Derived" = computed in code from other answers, never asked directly.

### Missions

| Event | Check / derivation | Confidence | Notes |
|---|---|---|---|
| `shieldWon` (existing) | `wonShield` | **High** | Every recap names the shield winners when it covers the mission. Earned, gifted, chain-of-safety and antidote all count; see §5. |
| `wonPower`: won a mission power (Dagger, Seer, …) | `wonPower` + `powerName` | **High** when it happens | US3 Seer (Britney), US4 Dagger (Rob R.). Generic, so next season's twist fits. |
| `missionStandout`: credited by the recap with carrying the mission | `missionStandout` | **Moderate** | Recaps single these people out: Bergie reading the spotlights (US2 ep 3), John on the catapult (US2 ep 6), Tom singing the nursery rhymes (US3 ep 8), Nam last on the carousel (US4 ep 10). Not every mission has one; "no" is fine. |
| `missionBlunder`: blamed for failing a mission or costing the pot money | `missionBlunder` | **Moderate** | For example: the four who quit the tunnels (−$4,000, US2 ep 8), Chrishell dropping out first (US3 ep 7), Candiace and Tara's wrong guess (US4 ep 6), Phaedra abandoning the crossbow strategy (US2 ep 9). Must be the *recap's* attribution, not inferred. |
| `gaveShield`: gave a shield they controlled to someone else | `gaveShield` | **High** when it happens | Rare: the US3 ep 2 intruders, Danielle twice in US3 ep 5. Recaps make a point of it because it reads as a tell. The recipient scores `shieldWon`. |

### Murder & the Turret (replaces "Twists")

| Event | Check / derivation | Confidence | Notes |
|---|---|---|---|
| `murdered` (existing, implied) | `exitMethod` | **High** | |
| `onMurderShortlist`: named on a formal murder shortlist and not murdered | `onMurderShortlist` (+ not murdered) | **High** in twist episodes | Recaps name every formal shortlist (Today listed all four in US4). Seen 3* / 2 / 11 across US2/3/4. Never counts for a Traitor (Rob R. on Donna's list, Lisa in the cage list). |
| `consideredForMurder`: a Traitor option for murder this episode who survived the night | `consideredForMurder` | **Moderate** | Gold Derby reports the turret's options almost every week (US3: "Sam, Robyn and Gabby"; "Wes, Bob H., Ivar"); Today.com does too in US4 ("Medley, Anderson, Colletti"). Viewer-only knowledge, but it's a real read on danger, and it is the Traitors' view of threats. Excludes formal shortlists (that's `onMurderShortlist`). |
| `shieldSavedThem`: the Traitors chose them, and a shield blocked the murder | `shieldSavedThem` | **High** when it happens | US2 Bergie. Unmistakable in every recap. |
| `recruited` (existing, implied) | `recruitedAsTraitor` | **High** | Offers and ultimatums. |
| `declinedRecruitment`: turned down the Traitors' offer | `declinedRecruitment` | **High** when it happens | US2 Peter. Refusing an *ultimatum* means being murdered, so only offers count. |

*US2's chain of safety (ep 7) left five people "up for sacrifice"; counted as a shortlist, that's 3
Faithful survivors. Recommended: count it.

### Round Table

| Event | Check / derivation | Confidence | Notes |
|---|---|---|---|
| `accusedAtRoundTable`: named as a suspect at the Round Table and survived it | `accusedBy` non-empty, not banished | **Moderate–High** | **Kept at the league owner's direction.** The Round Table is what every recap covers most, and they say plainly who was put on the spot: Ron on Porsha, Colton on Tiffany, Underwood calling out Rinna, Kish on Underwood, Weir on Colletti (US4); Gabby on Tony, Rob on Bob, Derrick on Rob (US3). Count only named accusations *at the table* (not castle gossip) for a person who **survived** (the banished person scores their banishment instead). Expect "unknown" when a recap only gives the outcome. |
| `ledCaseAgainstTraitor`: led the accusation that banished a Traitor | derived: in `accusedBy` of a banished Traitor | **Moderate** | Comes free from the same `accusedBy` answers. Clear-cut in about half of the Traitor banishments (Rob on Bob, Danielle on Carolyn, Gabby on Danielle, Colton on Lisa); shared in the rest. |
| `votedOutTraitor` (existing): **a Faithful** voted for a banished Traitor | derived from `votedFor` + roles | **High**/Moderate | High from Gold Derby (it lists voters); moderate from sites that give only totals. Proposal: Faithfuls only. |
| `turnedOnTraitor`: a Traitor voted for a fellow Traitor who was banished | derived | **High** | Every season, 3–7 times: at least 3 in US2 (Phaedra on Dan and on Parvati, Kate on Phaedra), 7 in US3, 3 in US4 (Rob R. on Lisa, on Candiace, on Eric). Recaps always remark on it. |
| `votedOutFaithful`: voted for a banished Faithful | derived | **High**/Moderate | The most common outcome. Track it; whether it costs a Faithful or rewards a Traitor is a scoring call. |
| `survivedRoundTable` (existing): received votes but survived | `votesReceived` > 0, not banished | **Moderate** | Per-person totals depend on the recap (§1.1, finding 2). Recaps often say "X and Y received two votes each" (Today, US4 ep 9). |
| `zeroVotes`: attended and received no votes | derived | **Moderate** | Needs a full vote breakdown; null otherwise. |
| `banishedAsFaithful` / `banishedAsTraitor` (existing, implied) | `exitMethod` + role | **High** | Includes Fire of Truth banishments. |

### Leaving the game

| Event | Check / derivation | Confidence |
|---|---|---|
| `leftGame` (existing, implied) | `exitMethod` | **High** |

### Endgame

| Event | Check / derivation | Confidence | Notes |
|---|---|---|---|
| `finalist` (existing, implied) | `exitMethod` | **High** | |
| `seasonWinner` (existing, implied) | `exitMethod` | **High** | Winners were 2 / 4 / 1. Whether a shared win scores like a sole win is a later scoring call. |
| `wonAsTraitor` (implied: winner + role) | derived | **High** | US4 Rob R. |

### Proposed `eventCategories`

```js
eventCategories: [
  { id: 'missions',   label: 'Missions',            events: ['shieldWon', 'wonPower', 'missionStandout', 'gaveShield', 'missionBlunder'] },
  { id: 'turret',     label: 'Murder & the Turret', events: ['shieldSavedThem', 'onMurderShortlist', 'consideredForMurder', 'recruited', 'declinedRecruitment', 'murdered'] },
  { id: 'roundTable', label: 'Round Table',         events: ['votedOutTraitor', 'turnedOnTraitor', 'ledCaseAgainstTraitor', 'accusedAtRoundTable', 'survivedRoundTable', 'zeroVotes', 'votedOutFaithful', 'banishedAsFaithful', 'banishedAsTraitor'] },
  { id: 'leaving',    label: 'Leaving the game',    events: ['leftGame'] },
  { id: 'endgame',    label: 'Endgame',             events: ['seasonWinner', 'wonAsTraitor', 'finalist'] },
],
```

Categories are plain config (`format.eventCategories`, rendered via `src/lib/game/scoring-groups.ts`),
so this needs no plumbing.

---

## 4. Still rejected

These fail on reliability, not on missing from a wiki:

| Candidate | Why not |
|---|---|
| Suspected or gossiped about *around the castle* | Everyone, every day, and recaps only cover the bits that matter later. `accusedAtRoundTable` covers the version that's on the record. |
| Money a player personally banked | Named only when the mission is built around it (US3 riddles, US4 hill climb). The standout and blunder checks cover the cases a recap singles out. |
| Mission earned the full pot | It's a team result, so everyone gets it and there's no roster decision in it. |
| Antidote holder (US4 ep 7) | Already a shield (`shieldWon`). |
| Late entrant / intruder; chosen as an original Traitor | Cast and role facts, not events. |
| Vote totals from a recap that gives only the winning margin | §1.1, finding 2: answer null rather than guess. |

---

## 5. Rules the prompt needs to state

1. **Episode attribution: an event belongs to the episode where its outcome is revealed.** Peter's
   banishment counts in US2 ep 10, the jack-in-the-box survivals in US4 ep 10, Eric's recruitment in
   US4 ep 9. That's what a league reaching that episode has seen, which is what the reveal-gating is
   for.
2. **Shields:** earned, gifted, chain-of-safety and antidotes all count as `wonShield`. Some missions
   hand out shields wholesale (12 in US3 ep 1, 14 in US4 ep 1, 15 in US4 ep 5); others give one. That's
   reliable data and a scoring question.
3. **Roles:** never give a Traitor `onMurderShortlist`, `consideredForMurder` or `shieldSavedThem` credit.
4. **Accusations:** at the Round Table only; the people who *made the case* (a name thrown out in
   passing is not an accusation); and only from the recap, not inferred from votes.
5. **Votes:** per-person `votedFor` only when a source names that person's vote. Totals only when
   stated. "Unknown" over arithmetic from a margin.
6. **Revotes and the Fire of Truth:** report the *final* round's vote (as Survivor's checklist does).

---

## 6. What was implemented

**Research checklist** (`traitors.js` → `research.checklistSchema`, which is what the paste prompt asks).
It asks for primitives, and code derives the outcomes:

| Field | Type | Asks |
|---|---|---|
| `isTraitor` | Answer | A Traitor at this episode's Round Table (or by the end of the episode). Used only to derive vote outcomes; never staged on its own |
| `becameTraitor` | Answer | Started as a Traitor this episode (chosen by the host, or entered as one). Stages the original `Traitor` role, so recap-only seasons get their Traitors without the wiki |
| `recruitedAsTraitor`, `declinedRecruitment` | Answer | Accepted / turned down recruitment |
| `votedFor` | string[] \| null | **Now a list**: one name per banishment vote (a finale has several), final round of any revote |
| `accusedBy` | string[] \| null | Who made a case against them at the Round Table |
| `wonShield`, `gaveShield`, `wonPower` + `powerName`, `missionStandout`, `missionBlunder` | Answer | Missions |
| `onMurderShortlist`, `consideredForMurder`, `shieldSavedThem` | Answer | Murder danger |

`votedForBanishedTraitor` is gone. Every Round Table outcome is derived in `researchItems` from
`votedFor` + `isTraitor` + who was banished, through `banishmentVoteEvent`, which the wiki's
`derivedEvents` shares so both sources score a vote the same way. An unknown role produces no vote
event. The search hint states the attribution rule (§5.1). `researchEntryProblems` flags a Traitor
marked as in murder danger, a shield save without a shield, chosen-and-recruited, standout-and-
blunder, a power without a name, and a vote from someone not at the table.

**Wiki read:** `derivedEvents` now gives `votedOutTraitor` to Faithfuls only, `turnedOnTraitor` to
Traitors, `votedOutFaithful` for any banished Faithful, and `zeroVotes` to voters nobody voted for. The
wiki *schema* is unchanged: shortlists, `rno`, Dagger and Seer come from research.

**Other:** `impliedEvents` adds `wonAsTraitor`; `eventCategories` as in §3; bot `SIGNALS` treat
`accusedAtRoundTable`/`onMurderShortlist`/`consideredForMurder` as danger and `zeroVotes` as safe.
`validateLeniently` (db/episode-research.js) now wraps a lone name pasted where a list is expected,
and reports the repair rather than failing the whole paste.

**Not done:** any wiki-schema additions. Point values: `docs/RESEARCH-traitors-scoring-values.md`.
**Existing data:** research cached before this change has no `isTraitor`/`accusedBy`, so re-run it
(Force) to get the new events. Wiki reads re-stage from cache with the new vote split; a Traitor
previously staged `votedOutTraitor` will now be `turnedOnTraitor`.

### Decisions (all taken as recommended, 2026-10-02)

1. The US2 chain-of-safety "unprotected five" counts as a shortlist (the checklist says "the people
   left unprotected").
2. `votedOutTraitor` is Faithfuls only; Traitors get `turnedOnTraitor`.
3. An event belongs to the episode where its outcome is revealed.
4. `accusedAtRoundTable` skips anyone who left the game that episode, so it isn't double-scored with the
   exit.

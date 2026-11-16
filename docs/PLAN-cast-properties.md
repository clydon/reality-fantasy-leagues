# Cast properties: what a show sorts its people by, researched for every show, usable in a game's rules

The user, 2026-11-15 (the design round's step 5, Players / Cast): "Remember we need positions: NFL WR, QB etc. Survivor tribes.
Below Deck: interior / chief stew, second stew etc." Then: "games around Below Deck depend on this: draft one deck team member, one
interior", and "games could be draft two men two women, or draft one person from each tribe, draft one veteran and one newbie. So
that might mean cast properties." If the data isn't there, the research prompts change so it is, in all cases. BACKLOG 89.

## When

**Now, beside or after the design round's step 8** (the user, 2026-11-16, replacing 2026-11-15's "after the design round"):
cast properties run in their own lane (`../rfl-castprops`, branch `cast-props`, port 3012) while step 8 (notifications, then
waivers) runs on `explorer-sports`, and the round's steps 9 to 12 come after it, with the wizard (step 12) taking in chunk 7.
Chunks 1 to 3 go first; chunk 4 waits until step 8 is merged into the lane, since its "Needs" line lands in the draft room and in
waivers, which step 8 redesigns. The round's designs leave room for it, so nothing here needs a redesign: the draft room and
waivers (step 6, step 8) a line for what a team still needs ("Needs: 1 Interior"), the lineup sheet slots with a label, and the
cast tab (step 5) a second property line and filter chips by property.

## The idea

A **cast property** is something a show itself sorts its people by, in the show's own words: a department and a job (Below Deck),
a tribe (Survivor), whether someone is a veteran or a rookie (The Challenge), gender where the show splits by it (The Challenge's
eliminations), pro or celebrity (Dancing with the Stars), a sport's position (QB, WR). Every one does three jobs:

1. **Rules.** A game can be built on it: "one from each", "two of each", "one Interior and one Deck", "only veterans", a lineup
   of "1 QB, 2 RB, 1 FLEX".
2. **Display.** The cast tab shows a person's main property under their name and groups or filters by any of them (step 5 built
   the line from `season_cast.role`).
3. **Research.** The rulebook's research decides which properties a show has; the cast research fills them for each person.

Tribes stay what they are (the rulebook's `cast.groups`, dated by episode, already in every rule that reads them); a property is
everything else, and the plan treats the group as the first property so the rules and the display read both the same way. A
**secret role** (a Traitor) is not a property: it stays a twist, revealed on leaving, and never shows or rules before then.

## What exists today

Research and data:
- The rulebook's cast block is `{ unit, singular, plural, usualSize?, groups: null | { type, singular, change } }`
  (src/lib/game/formats/rulebook-schema.js:8); its research asks only that (rulebook-research.js:98-108). Below Deck's library
  rulebook says `groups: null`.
- The cast prompt (src/lib/game/formats/cast-prompt.js) asks a name, a photo, `startingGroup` when the rulebook has groups, and
  `startingRole` for a secret role. Nothing else. Its answer is staged as `season_cast_answers.people` (`{ name, group, photo }`,
  src/lib/desk-cast-diff.ts:15) and reviewed on the desk.
- `season_cast.role` (migration 0144) is written only by a sport's roster (ESPN's position). No TV cast writer sets it.

Engine (the map, 2026-11-15):
- **The one composition rule is the spread:** `draft.across = { of: "group" | "gender"; then: "keep" }` (game-spec/index.d.ts:624),
  at most ceil(each/k) from one group and at least floor(each/k) of each (`spreadBounds`, schema.js:760). `gender` is in the vocab
  as "later" and always refused: "Nothing in the show's data says who's a guy and who's a girl" (schema.js:4248).
- **Where a draft rule plugs in:** `draftFits(state, picked, candidates)` (state-logic.js:3328) chains `SpreadLogic.allowed` and
  `BudgetLogic.allowed`; the snake pick, the blind submission, the draw, the auction and the bots all ask it, so a new rule there
  reaches every draft and every bot. Waivers and replacements don't (`then: keep`: a replacement comes from anyone).
- **The pool filter** `pool.where` takes a sport's `teams` and `positions` (PoolLogic, state-logic.js:5926), stamped per read from
  the roster (`state.statGroups`, `statTeams`: StatsLogic.stamp :3624, built in src/lib/server/sports/score.ts from
  `season_cast.role` through `groupOf`), never stored. `{ group }` is typed but refused (schema.js:2299).
- **Lineups take no positions**, not even a sport's: `activeSlots` is `count.start`, and `validateLineup` (:4194) checks the lock,
  duplicates, the count and the roster. Bot lineups take the top N.
- **Tribes over time** are dated: `episode.groups` moves (`GroupLogic`, :4611), `castaway.tribeId` is now, and
  `SpoilerLogic.viewThrough` (:9334) rewinds them for a viewer.

## The model

**In the rulebook** (`cast.properties`, beside `groups`): a list, each

```
{ key: "department",                 stable id
  name: "Department",                in the show's words; plural is derived or given
  values: ["Interior", "Deck", "Galley", "Bridge"] | null,   null: free text (a job title)
  changes: "never" | "sometimes",    a firing, a promotion, a swap
  main?: true,                       the one shown under a name (one per rulebook)
  of?: "department" }                a job that sits inside another property (Chief stew is Interior)
```

Below Deck: `department` (values) and `job` (free text, `of: "department"`, `main`). The Challenge: `status` (Veteran, Rookie) and
`gender` (as the show presents it). A sport needs no rulebook entry: its `position` comes from the roster as today.

**In the season's cast**: `season_cast.props jsonb` (`{ department: "Interior", job: "Chief stew" }`), the season's starting
values; `season_cast.role` stays the sport's position and reads as its `position` property. A changing property's later values
are dated facts (below).

**In a game's state**: stamped per read like a sport's positions (`state.castProps`: castaway id to `{ key: value }`, the season's
values as the viewer has seen them), never stored in the league, so one source and no copies to sync. Tribes keep their own path.

**What's allowed to be a property** (research must hold to it, and the review refuses others): only what the show itself bills or
splits by, on screen or in its own cast announcements. Never inferred from a name or a photo, with one exception: gender (the
user, 2026-11-16, below). Never ethnicity, religion, sexuality, health or age bands. A property's value is "not stated" rather than
a guess.

**Gender, every show** (the user, 2026-11-16, choosing "infer when not stated" over the recommended "as billed": "i dont see
man/woman or any kind of assumed gender... we definitely want that"). Every season has a Gender property (Man, Woman, Nonbinary;
rulebook-schema.js `withGender`) without its rulebook declaring it (a rulebook's own gender stands). The cast research asks it of
everyone: from the show's own billing (a network bio's he or she, a men's or women's split) wherever it says, else the research's
inference from name and photo, and `props.genderFrom` says which (`billed`, `inferred`, or `desk` once the desk sets it). The
desk shows an inferred one as "gender guessed" and fixes it; an answer filling in a gender applies by default, and one that would
change a gender we have keeps ours by default. The app shows it as a fact: in the sheet's details line and as Man / Woman chips
on the wall; it's never the wall's grouping or the line under a name. Rules (chunk 4) can read it like any property: "two men, two
women". **Nonbinary flexes by default** (the user, 2026-11-16: "it could be male or female. That way any argument becomes internal
and faith based rather than semantics"): a property's `flex` (`{ Nonbinary: ["Man", "Woman"] }` on Gender) says a value also counts
as others, read by `propertyMatches`. Filters show them under Man and Woman; in chunk 4 a Nonbinary person fills either a man's or a
woman's need, and in a spread counts on whichever side lets the team fit (`draftFits` tries both); a game may turn it off.

## Rules a game can make

All in the game spec, all through `draftFits` (so every draft and bot), each refused by the spec's check when the season has no
such property (as gender is today), each in describe.js's words:

| Rule | Spec | Example |
| --- | --- | --- |
| Spread (exists) | `draft.across = { of: <key> }` | one from each tribe; one from each department; two men, two women in a team of four |
| Needs | `draft.needs = [{ of, value, n }]` | one Interior and one Deck; one veteran and one rookie |
| Only | `pool.where = { [key]: [values] }` | an all-rookie draft; Interior only |
| Lineup slots | `count.slots = [{ of, values, n }]` plus FLEX | 1 QB, 2 RB, 2 WR, 1 TE, 1 FLEX; start one Interior each week |

Needs work like the spread: they never block a draft (a need nobody left can fill drops, said), a pick that would leave a need
unfillable is refused with the reason ("You still need someone from Deck, and 2 picks are left"), and bots satisfy them through
`draftFits`. Replacements and waivers: a rule's `then` says whether a replacement must keep the shape (`keep`) or comes from anyone
(today's), the game's choice.

## Changing properties (dated)

A firing, a promotion or a swap is a dated fact like a tribe move: a season result `{ episode, castaway, key, value }`, found by
episode research (a question the rulebook adds when a property `changes: "sometimes"`), settled by the AI's answer and in the games
at once, the desk confirming or changing it after (the user, 2026-11-16: "AI decides and settles. Desk can then confirm or
change, that way no one is ever waiting"; `SETTLES_AT_ONCE` in fact-status.ts), spoiler-guarded by
`viewThrough` like `episode.groups`. A drafted team's shape is judged at the draft; a later change never breaks a team (said on
the person: "Promoted to Bosun, Ep 6"). Lineup slots read the value as of that episode.

## Holdings: what someone has right now (the user, 2026-11-16; decided the same day, below)

"We also need a 'currently has' property for players. Survivor tracks if they found an advantage or idol. But suppose they use it or
give it away, it's hard to determine in our current landscape if they currently have anything of value."

**What's there today:** episode research asks whether someone found an idol or advantage (and its name) and whether they played one
(Survivor's `foundAdvantage` / `playedAdvantage`, a rulebook advantage twist's `Got` and `Played` moments), plus "Went home
holding" for one that lasts until played. Found minus played isn't what someone holds: a gift, a theft, an expiry ("good for the
next two Tribal Councils"), a loss (a Shot in the Dark that comes up empty is gone either way), an idol played on someone else, and
two of the same kind each break it, and nothing asks about them.

**Not a property, a dated ledger.** A property is what someone is (a department); a holding is what they have at the end of an
episode, and it changes every week, like chunk 6's dated changes and a tribe's moves. One row per thing held:
`{ castaway, twist (the rulebook's advantage), name ("Hidden Immunity Idol", "Block a Vote"), from: { episode, how: found | won |
given (by whom) | bought }, until: { episode, how: played (on whom) | gave (to whom) | expired | lost | stolen | wentHome } | null }`.
"Currently has" at a viewer's mark is every row open at their episode; it's spoiler-guarded by `viewThrough` like `episode.groups`.

**Research, recommended both ways at once:**
1. **Events** on each episode, for each advantage twist the rulebook has: got one (how, from whom), played one (on whom), gave one
   away (to whom), lost one or it expired. Each is a fact like any other, settled at once by the AI's answer like a property's
   change, the desk confirming or changing it after.
2. **A snapshot** at each episode's end: "who holds what now", which a show's wiki keeps as a table. The ledger is built from the
   events; the snapshot checks it, and a disagreement goes to the desk ("the ledger says Kristin still has her idol; the snapshot
   says nobody does: did she give it away?") rather than either one silently winning.
   A holding the show hasn't aired (found off camera, revealed later) starts the episode it's shown, never before.

**Shown:** on the person sheet's head under their details ("Has a Hidden Immunity Idol · found Ep 3"), as a small mark on the
wall's face when they hold anything (the one exception to step 5's names-only faces, to be designed), and in a game's sheets;
"Played it on Eric, Ep 7" in their story. **Games** could read it like a property later (a moment for each episode someone keeps an
idol, a pool pick that avoids holders) but that's a game rule for chunk 4's successors, not this.

**Where it fits:** with chunk 6 (dated changes), as **6b**, after 4 and 5: the same episode-research plumbing, the same desk accept,
the same `viewThrough`. Generic over every rulebook's advantage twists, not Survivor's code ([universal-not-curated]).

**Decided (the user, 2026-11-16):**
- **(a) Both:** events each episode and an end-of-episode snapshot, a disagreement to the desk.
- **(b) The sheet for sure; the wall's mark only if it reads neutral.** "I'm torn because we don't want it to read as an advantage
  or disadvantage because it could be both, unless there's an indicator or icon that represents that well." So 6b ships the
  sheet's line, and the wall's mark is a design question for its Impeccable pass, shown to the user as a named choice in its
  story, never shipped unasked. What the mark must do: say "holds something" and nothing about good or bad (no safe teal, no live
  red, no shield or skull; plain ink, like a tribe's tag without its colour), and open what it is on a tap. Without a mark the user
  approves, the wall stays names only.
- **(c) Yes, backfill:** the season's aired episodes are re-asked through our bot for their holdings (Survivor 51's so far, and any
  season with an advantage twist that has aired), reviewed on the desk like any results, before holdings show.

## Bios: who they are, beside what they did (the user, 2026-11-15)

"For show importing cast bios would be a nice touch too outside of stats (if the draft was performed after the first episode).
Bios could be as simple as hometown or whatever wikis provide us." A draft before the premiere has no stats to show, so the person
sheet (step 5's, opened from the draft room since step 6) needs something to say who someone is. A bio is display, not a property:
no game rule reads it.
- **What:** what the show itself bills for each person, as it bills it: hometown (and where they live now, when billed apart),
  age as billed at the premiere, occupation, and a one-line description in the billing's own words where there is one (a
  network's cast page, the show's wiki infobox). "Not stated" allowed; never inferred, never anything the show doesn't publish
  (decided item 1's limits hold: no ethnicity, religion, sexuality or health, even where a page mentions them).
- **Where from:** the cast research (chunk 2) asks for it beside the properties, with its source; our bot does the research
  ([paid-services-contained]). A previous season's facts (a returnee's past seasons and finish) are the season's own data, linked
  where the show has run before.
- **Kept:** `season_cast.bio` (JSONB: hometown, residence, age, occupation, line, source), reviewed and fixed on the desk like the
  cast (decided item 4), a dated fact only for age (as billed at the premiere).
- **Shown:** the person sheet's head, under the name and group ("Ocean City, NJ · 25 · Nurse"), and its one line, in every place
  the sheet opens (Players / Cast, the draft room, a game page); the draft room's face wall stays faces and names (step 5's rule).

## Chunks, in dependency order

Each ends with focused tests; the long checks once per milestone ([long-checks-once-per-step]).

1. **Rulebook schema and research.** `cast.properties` in rulebook-schema.js (shape, words, validation, the allowed-kinds rule),
   rulebook-research.js's question ("what does this show itself sort its people by, beyond groups?", with the allowed list and
   examples), the review (refuses a disallowed kind, a `main` twice), the editor on the desk (Who's playing). Library rulebooks:
   Below Deck, The Challenge, Dancing with the Stars, Survivor (returnee status when a season has one). Done when a fresh research
   of Below Deck returns department and job, and of Survivor 51 none (or returnees, if billed).
2. **Cast prompt, import and the desk.** `season_cast.props` (migration), cast-prompt.js asks each declared property (values
   listed, "" for not stated), parseCastImport validates against the values, `TheirCastaway.props`, castChanges diffs them, the
   desk's cast page shows and edits them, history logs them; the bot path and Paste alike. Bios ride the same answer
   (`season_cast.bio`, "Bios" above). Done when the bot's Below Deck answer lands on the desk with every crew member's department,
   job and bio, reviewable, and Survivor 51's with every castaway's hometown, age and occupation.
3. **Stamp and display.** The season stats read and the game reads stamp `castProps` (and the sport's position as `position`),
   the cast tab's line reads the `main` property (step 5's line), its faces group by the group or, with none, by the first
   property with values, and filter chips by property; the person sheet's head shows the bio. Done when a researched Below Deck
   season reads by department with jobs, and a castaway's sheet in a pre-premiere draft says who they are.
4. **Draft rules.** `across.of` any property key (gender allowed once data exists), `draft.needs`, `pool.where` by property (and
   `{ group }` working), in schema.js, describe.js, `draftFits` (CompositionLogic beside SpreadLogic), the draft room and waivers
   saying what's needed, bots through `draftFits`. Done when a bench scenario drafts "one Interior, one Deck" exclusively with two
   bots and a person, and a refused pick says why.
   **Built 2026-11-16** (lane castprops, after step 8 merged in): `get.needs` (settings `draftNeeds`), `get.across.of` a property's
   key (gender plays now), `pool.where.props` ("Interior only"), checked against `SpecContext.properties` (question-choices.ts
   `contextOf`); `CastPropLogic` (a castaway's values from the stamp, flex counted), the spread by any property (a flex value a
   wildcard), `CompositionLogic` (needs as a matching, so Nonbinary fills whichever side fits; never blocking; a refused pick's
   reason), chained into `draftFits` (bots, a draw, a blind team, the timer) and the snake's engine and server checks, and waiver
   replacements (`pairProblem`: the shape kept while someone free can). Words in describe.js and the GPT's manual; the draft room's
   "Needs: 2 Men, 1 Woman" (`DraftGame.needs`, `YourSlots`) and waivers' owed spot ("Needs: 1 Deck · Out · Ep 5", `WaiverWeek.needs`).
   "Done when" was met in tests/cast-props-draft.test.js (two bots and a person drafting one Interior and one Deck each; the refused
   pick's words), not a bench scenario: the bench's runtime builds no cast-property stamp yet. **Left:** an auction's bids and a late
   joiner's team (GhostLogic.teamAt) don't check needs (neither checks the spread today); the blind room has no "Needs" line; the
   waivers page's line is unit-tested, not rendered (no fixture has a needs game mid-waivers); `pool.where { group }` still waits;
   the GPT's manual says nothing of `get.needs` yet (chunk 7).
5. **Lineup slots.** `count.slots` (by property, with FLEX), validateLineup, the lineup sheet (slots labelled), bot lineups, the
   matchup pairing reads real slots (step 2c paired a sport by position already). Shared with sports: a sport's lineup gains its
   positions here. Done when NFL's 1 QB, 2 RB, 2 WR, 1 TE, 1 FLEX is enforced and drawn.
   **Built 2026-11-16:** `count.slots = [{ label?, of, values, n }]` beside start or best (settings `lineupSlots`; together the whole
   count), checked against the season's properties (a sport's `position` is its roster's). `SlotLogic` matches a lineup's ids to its
   slots (stored lineups unchanged, no migration): validateLineup refuses someone no open slot takes ("QB2 has no open slot: the
   lineup is 1 QB, 2 WR, ..."), a short lineup stays fine; the bots and best ball take the best legal lineup (points order, each
   kept while the slots take everyone: a matching's greedy, the best one). Football's standard games carry their defaults' slots
   (sports/index.ts `withLineupSlots`: QB, 2 WR, 2 RB, TE, W/R/T, K, DEF; other sports' `takes` are position groups and wait). Your
   moves says the shape, each starter's tag is its slot ("QB", "W/R/T"), each open tile names its slot, and a tap no slot takes says
   which is full (src/lib/lineup-slots.ts matches in the browser from `LineupMove.lineupSlots`); a matchup pairs slot by slot
   (`GameView.slotPlan`, game-week.tsx `pairLines`). Fixed beside it: a game's face read "Man" for a sport (gender is never the main
   line unless a rulebook says so), and Backstage's starter count kept the slots only while they still add up. **Left:** the
   gameplay bench plays football without slots (its world stamps no positions; its frozen states predate them); soccer and others'
   slots (their `takes` are groups); the read-only weekly sheet (lineup-sheet.tsx) and the lineup's "set" count aren't per slot yet.
6. **Dated changes.** The season result kind, the episode research question, the desk's accept, `viewThrough`, the person's line.
   **6b. Holdings** (the user, 2026-11-16, decided: "Holdings" above): what someone has right now, a dated ledger from episode
   research (events and an end-of-episode snapshot), spoiler-guarded, on the person sheet and maybe the wall.
   **How to build 6 and 6b (mapped 2026-11-16; the code's own paths, so a session can start here):**
   - **6, a property's change: a new decision kind `prop`,** copying the tribe move (`kind 'group'`): `castaway_name` the person,
     `event_type` the property's key, `method` the new value (fits the unique index: one a person, key and episode). A migration
     re-lists `season_decisions`' kind and shape checks (the latest: 0116). Every switch on `kind` takes it, or `applyDecision`
     falls through to the exile branch: `DecisionRow.kind` and `applyDecision`/`undoDetail` (decision-apply.ts), `ownResults` /
     `settledKinds`, `SubmittedFact.kind`, `METHOD_KINDS` (fact-status.ts, or two sources never dispute), `labelOf`/`ownRow`
     (season-decisions.ts), `factLabel` (community-results.ts), the desk's label (desk-episode.ts) and `decideFact`'s choices
     (desk-facts.ts), the episode page's Correct options (src/new/desk/episode.tsx). **Asked** from rulebook-compile.js: each
     `changes: "sometimes"` property a per-person nullable string ("only if it changed this episode: their new job"), recorded as
     `research.propChanges`, staged by episode-research.js `itemsFromChecklist` as `add('prop', key, value)`; each name's value
     going in beside it in the prompt, as `groupsGoingInto` does for groups. **Applied** like groups: `ep.props = [{ castawayId, key,
     value }]`, emptied on hidden episodes in `SpoilerLogic.viewThrough`, counted in `hasResults`, a migrate default;
     `CastPropLogic.valueOf` reads the latest at or before an episode, else the stamp (starting values stay stamped); `SlotLogic`
     passes the episode (a lineup reads the value as of its episode). **Shown:** seasonFacts already applies accepted decisions to
     the viewer's mark, so `castStats` gains each change and the current value; the sheet's details line shows the current one and
     the story "Bosun from Ep 6 (was Deckhand)" (no "promoted" or "demoted": nothing records which; ask the user if wanted). A
     firing is a way out, not a property change. Stored rulebooks recompile (db/backfill-rulebooks.js).
   - **6b, holdings:** `research.holdings = [{ twist, oneIsCalled }]` compiled from the advantage twists; a structured section of the
     episode schema beside `formatState` (episode-research.js), asked only with it: `changes: [{ who, name, how: found | won | given |
     bought | played | gave | expired | lost | stolen, other }]` and `atEnd: [{ holder, name }]`. Today the found and played *names*
     never reach `season_decisions` (only in `episode_research.payload`), and the bot's "idols" are found minus played
     (bot-logic.js). Changes staged as a new kind `holding` (`castaway_name` the holder, `event_type` `<twist>:<how>:<name slug>`,
     `method` the other person), a migration as above; the ledger a pure builder beside format-timeline.js from accepted
     `holding` facts; the snapshot kept in the payload as `formatState` is, compared on read, a disagreement a "Holdings check" block
     on the desk's episode page (or a `fact_disputes` row). The sheet's line "Has a Hidden Immunity Idol · found Ep 3" and the
     story's "Played it on Eric, Ep 7" from `CastStat.holds` (optional fields: StoryBody is a game's sheets' too). **Backfill** (decided
     (c)): a short run kind `holdings` modelled on the facts run (db/facts-research.js, bot-research.js `factsJob`), asking only the
     new section, through the desk's queue (desk_runs and bot_research_runs kinds re-listed); Survivor 51 here has research stored for
     Episodes 1–4 only, so 5–8 want full runs (`POST /api/desk/seasons/<id>/runs { kind: 'full', episode }`) and 1–4 the short one;
     "Ask again: missing" skips questions that score nothing, so it won't reach these. cast-props-research.js gains an `episodes`
     command for it.
   **6 built 2026-11-16:** migration **0440** (kinds `prop` and `holding`; may need renumbering at merge, like 0439); `PropChangeLogic`
   (`ep.props`, `latest`, `changes`), `CastPropLogic.valueOf(..., asOf)` and `SlotLogic` reading as of a lineup's episode;
   `applyDecision`/`undoDetail`/`ownResults` for both kinds (a holding never touches a league: the season's ledger, 6b); research's
   `<key>Now` question per changing property (`research.propChanges`, staged by `itemsFromChecklist`); the shared words
   (src/lib/game/dated-fact-words.ts: "Job: Bosun", "Found a hidden immunity idol") on the desk, a league's plates and
   season-decisions; the desk's Correct with the property's values; the stats read's `changes` and the latest value, the story's
   "Lead deckhand from here · was Deckhand". Below Deck's library compile re-saved. No migrate default for `ep.props` (frozen bench
   states stay byte for byte). **Left for 6b:** everything holdings-specific (the research section, staging, the ledger, the check,
   the sheet's line, the backfill).
   **6b built 2026-11-16:** `research.holdings` compiled from advantage twists (and written into Survivor's and The Traitors' own
   formats, so an unedited built-in still compiles to its format); the episode schema's `holdings` section (`changes`, `atEnd`)
   beside `formatState`; `candidatesFor` stages each change as kind `holding`; src/lib/game/holdings.ts (`ledger`, `holdsAt`,
   `snapshotDisagreements`, `holdsLine`); the desk's episode page shows a "Holdings check" where the snapshot and the record disagree;
   the stats read's `holds` ("Has a hidden immunity idol · found Ep 3") and `held` (the story's lines). Backfill: an edited season
   rulebook doesn't follow the compiler, so `cast-props-research.js recompile <seasonId>` first, then `episodes <seasonId> --from
   --to` (the desk's full Run now by our bot, one by one); a short "holdings only" run kind wasn't needed. No wall mark (decided (b)).
   **6c. The catch-up** (the user, 2026-11-16: "it needs to get done, all episodes and the show, and cast need to be redone, compared
   against the original and applied. we should note and approve any changes that will change current scoring"; scope: "lets just
   do the shows that are on the prod app, survivor 51, traitors, the challenge, below deck"). Nothing in 1 to 6b fills in what
   aired before the merge, so a season catches up by itself after the deploy, through our bot only, on the bot's clock:
   - **The job.** A row per season (`season_catchups`, beside Getting it ready's `season_fills`, run the same way: one due job a
     clock call when no research run or fill is due, a step at a time, tries and a stuck state, a line on the desk: "Catching up
     S51: cast done, Ep 4 of 8"). Which seasons: the four shows' seasons that have a game that isn't archived (the migration
     queues them; the desk's Setup can queue any other season by hand).
   - **Order: show, cast, then each aired episode from 1.** Episode questions come from the rulebook and answers match on the
     cast's names.
     - **Show:** the season's rulebook is recompiled (holdings and property questions), and the rulebook's Check for changes is
       asked of our bot. Its properties go in when the rulebook has none (they never score); every other difference stays on the
       rulebook's desk page as the check's card, as today: the catch-up never changes how a game scores on its own.
     - **Cast:** our bot's cast answer, staged, and only what can't move anything sent: people's details where we have none
       (properties, gender), bios where we have none. A new spelling, a starting group, a changed value and someone new (a
       played season's cast is whole, so someone new is far likelier a name we spell another way, and results waiting on a name
       land when they join) stay in the cast review for the desk.
     - **Episodes:** the full research run, its answer a source of its own (`catchup`) beside the original, which stays as it
       was: agreement confirms, a disagreement is a dispute the desk sees, a result an admin decided never moves.
   - **The scoring guard.** Before an episode's answer is sent, it's tried: filed and every game on the season synced inside one
     transaction, each game's totals read before and after, then rolled back (nothing written, nobody told). No game's total
     moves: sent (quietly; an old episode pushes nothing). Any total moves: held, on the desk's Inbox and the season's page as
     "Would change scores": the episode, each game and player and by how much; Send it or Leave it out. A game scored outside its
     state (Weekly Calls, bingo, a game of questions) can't be priced by the try, so anything that would change its results is
     held too (decided 2026-11-16, the recommendation).
   - Going forward nothing changes: a new episode's results, property changes and holdings settle as 6 and 6b say. The guard is
     only for rewriting what's been played.
   - **Rehearsed** on a fresh production backup locally before the push, the held list shown to the user first.
   **6c built 2026-11-16** (migration 0441; `src/lib/server/catch-up.ts`): `season_catchups` and `catchup_holds`, the `catchup`
   research source, the migration's queue. The clock (cron/bot-research) runs `runDueCatchUp` when it ran no research and no
   fill. Steps: `showStep` (Check for changes asked; properties saved with `saveChain` when the rulebook has none; else compiled
   again; never `pushRulebook`, so its games keep the copy they score by), `castStep` (`askCastNow`, then
   `desk-cast-page.ts fillCastDetails`: the default picks' details and new bios only, the answer left unsent), `episodeStep`
   (`buildPasteImportPrompt` + `researchFromPaste` dry, `bot-results.ts factsOfRun`, `community-results.ts tryResults`, then
   `sendResults` or a hold). `tryResults` runs `submitIn` (submit's body, split out) and `syncLeagueDecisions` for every game in
   one transaction, totals by `StateLogic.computeScores` before and after, and always rolls back. The desk: the episode page's
   "Would change scores" (Send it / Leave it out), the Inbox's `catchup` items (a held episode; a catch-up that stopped),
   `/api/desk/seasons/[id]/catchup` (GET; POST start, step, hold + decision). The Holdings check reads the newest answer with a
   snapshot, the catch-up's included. Driven locally with `scripts/dev-test/catch-up.js` (status, step, start, decide, rewind).
   **Rehearsed 2026-11-16** on the Neon branch `rehearse-castprops-1116` (`pre-castprops-1116` kept 7 days to roll back to) with
   `scripts/catch-up-rehearse.js` (the catch-up run to the end outside Next, our bot only, printing what it would hold), from a
   window the user starts after copying the branch's string. It caught production's The Traitors slug (`the-traitors`, not this
   copy's `the-traitors-us`): fixed in 0441, and the script runs the migration's queue again so a copy migrated before a fix
   catches up too. The guard reads how a game scores from its pieces (answers, lines, squares), never its type's name.
   **Side by side (the user, 2026-11-16: "parallel bots").** ChatGPT's browser answers one question at a time a bot, so asks in
   parallel only queued; Codex answers three at once a bot (llm-browser-api's CODEX_PARALLEL), and there are two bots (the VM,
   then the PC). So the catch-up asks as run kind `catchup`, Codex by default (`bot-runs.ts RUN_DEFAULTS`; the desk can send it
   elsewhere), each clock call runs `askBotSlots` items at once (three a bot answering), every ask starting at a different bot
   (`askBot`'s `spread`); a season's episodes are rows of their own (`catchup_episodes`) asked together, its show and cast in
   turn, its try-and-send one at a time (a session advisory lock). Not done: more signed-out ChatGPT machines (raised by the
   user, advised against: it works around ChatGPT's per-person limits and bot checks, against its terms, and puts the bot that
   live research needs at risk); Claude through the CLI on the user's subscription is the next lever if more is wanted.
7. **The wizard and the GPT.** SpecContext carries the season's properties so Start a game offers only rules the season can hold
   ("Draft one from each department"), Randomize can roll them, and the spec's check refuses a property the season lacks.

Chunks 1 to 3 make the data exist and show for every show; 4 is the user's Below Deck game; 5 also fixes sports lineups; 6 and 7
follow.

## Checks

- Unit: rulebook-schema (properties validation, the allowed kinds), cast-prompt (prompt lines, parse and repairs), castChanges,
  spec validation and words, CompositionLogic (needs, fallbacks, never blocking), validateLineup slots.
- Bench: a scenario per rule (needs, spread by property, lineup slots), with bots; the campaign's oracle restates each rule apart
  from the engine.
- Real shows: a bot research run of Below Deck, The Challenge and Survivor 51 (rulebook then cast), reviewed on the desk before
  anything reaches a game. Nothing spends the site's paid keys ([paid-services-contained]): research goes through our bot.

## Decided (the user, 2026-11-15, taking each recommendation)

1. **What may be a property:** only what the show itself bills or splits by; never ethnicity, religion, sexuality, health or age
   bands; never inferred from a name or a photo. **Changed for gender (the user, 2026-11-16):** every show has it, as billed or
   else inferred, said which (see "Gender, every show" above).
2. **Replacements:** each game's choice; the default keeps the shape for needs and takes anyone for the spread, as today.
3. **A change after the draft:** the team's shape is judged at the draft; a later change never breaks a team and is said on the
   person; lineup slots read the value as of that episode.
4. **Who fixes a property:** the desk only, as with the cast today, so every game on a season reads one set of values.

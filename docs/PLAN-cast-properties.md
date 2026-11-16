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
episode research (a question the rulebook adds when a property `changes: "sometimes"`), accepted on the desk, spoiler-guarded by
`viewThrough` like `episode.groups`. A drafted team's shape is judged at the draft; a later change never breaks a team (said on
the person: "Promoted to Bosun, Ep 6"). Lineup slots read the value as of that episode.

## Holdings: what someone has right now (the user, 2026-11-16; proposed, not decided)

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
   away (to whom), lost one or it expired. Each is a fact like any other, accepted on the desk.
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

**For the user to decide:** (a) events and a snapshot together (recommended), or events only (fewer questions, silent errors), or a
snapshot only (simplest, no "how"); (b) the wall's mark for someone holding something, or the sheet only; (c) whether the existing
results for aired episodes are re-asked to backfill holdings (S51: its episodes so far, through our bot) or holdings start from the
next episode.

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
5. **Lineup slots.** `count.slots` (by property, with FLEX), validateLineup, the lineup sheet (slots labelled), bot lineups, the
   matchup pairing reads real slots (step 2c paired a sport by position already). Shared with sports: a sport's lineup gains its
   positions here. Done when NFL's 1 QB, 2 RB, 2 WR, 1 TE, 1 FLEX is enforced and drawn.
6. **Dated changes.** The season result kind, the episode research question, the desk's accept, `viewThrough`, the person's line.
   **6b. Holdings** (the user, 2026-11-16, proposed: "Holdings" above): what someone has right now, a dated ledger from episode
   research (events and an end-of-episode snapshot), spoiler-guarded, on the person sheet and maybe the wall.
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

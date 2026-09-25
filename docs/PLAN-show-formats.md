# Plan: show formats (Survivor, The Traitors, The Challenge, …)

See `docs/ADDING-A-SHOW-FORMAT.md` for the reusable research playbook this plan's Traitors/Challenge
sections were built from — use it for any show added after these three.

## The problem

The pipeline itself is already show-agnostic: the show catalog, per-show terminology (`castaway_term`,
`tribe_term`), wiki endpoint and cast-section discovery, season decisions, admin review, reveal /
catch-up, air schedule, auto-research, embeddings, side bets. What isn't is the **game vocabulary**
those pieces carry — and it's Survivor's, hard-coded, in about a dozen places. A Traitors season
pulled today would be read with a prompt that looks for Tribal Council and immunity, forced into exit
methods like "Lost Fire-Making", and scored with events like "Idol played".

## The idea: a format per show

Add `shows.format` (`survivor` | `traitors` | `challenge` | `generic`), picked when a show is added.
Everything show-specific moves into one **format definition** per format, in code:

```
src/lib/game/formats/
  index.js        -- registry: formatFor(id), with 'generic' as the fallback
  survivor.js     -- today's behaviour, moved here unchanged
  traitors.js
  challenge.js
  generic.js      -- safe minimal set for any show we haven't modelled yet
```

Why code rather than database config: a format is more than lists. It carries extraction prompts,
validation rules ("individual immunity can't happen before the merge") and the mapping from research
answers to scoring events. That's logic, and it needs tests. The database only says which format a
show uses.

Plain CommonJS, the same as `state-logic.js`, so the connectors (`db/*.js`, run under bare `node`),
the server routes and the browser all read the same definitions.

### What a format defines

| Piece | Survivor today (where it lives now) | Used by |
|---|---|---|
| Exit methods, and which one means the winner | `EXIT_METHODS` in `state-logic.js` and `wiki-sync.js`; "Sole Survivor" checked by name | episode card, admin edit, replenish, season-over detection |
| Scoring events (id, label, default points) | `ACTIVE_ROSTER_EVENTS` in `state-logic.js` | Active Roster scoring, settings, review UI |
| Phases (has a merge? what's it called?) | `postMerge` everywhere, plus the Post-merge checkbox | episode card, wiki validation |
| Wiki: section names, extraction prompt, event enum, method mapping | `VOTE_SECTIONS` / `GUIDE_SECTIONS`, `EpisodesSchema`, `extractEpisodes` prompt | wiki episodes pull |
| Wiki validation rules | `validateEpisodes` (merge / zero-votes checks) | wiki episodes pull |
| Research checklist (questions), prompt wording, answer → event mapping | `CastawayChecklist`, `buildPrompt`, `itemsFromChecklist` | research, auto-research |
| Default research sites | seeded for Survivor only | research |
| Winner title for copy | "Sole Survivor" in scoreboard text | UI copy |

Things that stay shared: cast pull (already driven by terms), season decisions, review, reveal, air
schedule, auto-research, embeddings, side bets, draft and pick'em mechanics, placement scoring.

### League side

When a league picks a show, it stores `settings.showFormat` in its state, the same way it already
caches `showId`, so the client-side `StateLogic` knows the league's exit methods and events without a
database call. Survivor's event ids stay exactly as they are, so no existing league state needs
migrating. New formats add their own ids.

## Catalogs for the new formats (confirmed with the user 2026-09-25, informed by ground-truth wiki
pulls of two completed seasons — Traitors US4 and Challenge: Vets & New Threats — and the two
in-production seasons, Traitors US5 and Challenge: Cutthroat. Traitors AU3 and Challenge: All Stars 4
were suggested as further ground truth but haven't been pulled yet.)

**The Traitors**
- Exit methods / placements, confirmed against US4's full cast table: **Murdered**, **Banished**
  (Faithful `banf` or Traitor `bant` — the wiki distinguishes these visually but it's the same
  banishment event), **Finalist** (reached the end, didn't win — *not* an elimination), **Winner**
  (Faithful or Traitor). Left/Quit and Other stay as fallbacks for anything not seen yet.
- Roles: Traitor / Faithful, **tracked and scored**. A per-castaway `role`, recorded as a season
  decision like everything else, hidden from league members until publicly revealed (murder,
  banishment, or recruitment). Mid-season recruitment (Faithful → Traitor) is a confirmed recurring
  mechanic, not a one-off — Katie in US5 (from Episode 3), Eric Nam in US4 (from Episode 9) — so the
  schema needs a `role_reveal_episode` (or equivalent) and to allow role to change mid-season, not
  just be fixed at draft.
- Scoring events (confirmed):
  1. Won a shield (individual safety)
  2. Survived a Round Table (received banishment votes but wasn't banished)
  3. Voted for a Traitor who was banished
  4. Recruited as a Traitor mid-season
  5. Reached the end as Finalist (non-winner)
  6. Won the season (as Faithful or Traitor)
  7. Murdered
  8. Banished as a Traitor (caught)
- Wiki structure note: a season's real tables are **not** on the season page itself — they're
  transcluded from per-season `Template:` pages, e.g. `Template:US5 Contestant Info`,
  `Template:US5 Contestant History`, `Template:US5 Voting History` (naming pattern:
  `{ShowCode}{SeasonNumber} Contestant Info` / `Contestant History` / `Voting History`), confirmed on
  US4 and US5. This is **already handled**: Survivor's wiki does the same (`{{S44votetable}}`), and
  `expandTranscludedTables` in `db/wiki-sync.js` resolves table-bearing templates for any show. What
  Traitors needs is the right section names: its per-episode table sits under `== Voting History ==`,
  which Survivor's `voteSections` list already includes, and its cast table (Faction / Result / Exit
  Episode / Finish) sits under `== Contestants ==`.

**The Challenge**
- Exit methods / placements, confirmed against Vets & New Threats' full cast table: **Eliminated**,
  **Disqualified**, **Quit**, **Medically removed**, **Runner-up** (reached the final, didn't win —
  *not* an elimination, same shape as Traitors' Finalist), **Winner**. Other stays as a fallback.
- Groups: teams or pairs that change during the season (the existing "tribe" plumbing, relabelled).
  Team identity in the wikitext is color-coded (`bgcolor="#FFA500"` etc.) rather than a named column,
  so team assignment needs to be resolved from nearby prose/infobox naming (e.g. "Blue Team", "Gray
  Team", "Orange Team" on the Cutthroat page) within that season's pull, not assumed to be a stable
  scheme across seasons.
- Scoring events (confirmed):
  1. Daily/main challenge win
  2. Elimination round win (Arena / Jungle / etc.)
  3. Nominated for elimination and survived
  4. Finals placement (reached and completed the final)
  5. Won the season
  6. Eliminated / Disqualified / Quit / Medically removed (as its own trackable event, not just the
     exit method)
  7. Served as team captain / leader
- Format variance note: unlike Traitors (whose rules are stable across seasons), the Challenge's rules
  genuinely change season to season — Cutthroat's page has 3-then-2 team mechanics with rotating
  captains; Vets & New Threats additionally has `Partner Progress` and `Performance Points Progress`
  tables that Cutthroat doesn't. The `==Format==` prose section is load-bearing per season, not
  boilerplate. The extraction prompt/checklist likely needs to read that season's Format section
  before extracting, rather than assuming one fixed table shape across all Challenge seasons.

**Generic** (the fallback for any other show): Eliminated / Quit / Removed / Winner / Other;
challenge win; safe while at risk. Research asks only generic questions.

## Phases

1. **Plumbing, no behaviour change — DONE (branch `format-phase1-survivor`).**
   - Migration `0021_show_format.sql` adds `shows.format`. Every existing show gets `survivor`,
     including the Traitors show already added, because that's how every show has been read and scored
     so far. An admin switches a show's rules in Admin → Shows → show settings ("Rules").
   - `src/lib/game/formats/` holds the registry (`index.js`, `formatFor`, default `survivor`) and
     `survivor.js`: exit methods, winner, event catalog, merge, the wiki's episodes schema, prompt,
     section names and event checks, and research's checklist, search hint, contradiction checks and
     answer→event mapping. Everything was moved verbatim. The schemas are functions handed `z`, so the
     module has no dependencies and can go in the browser bundle.
   - `state-logic.js` reads rules through `formatOf(state)`, which uses `settings.showFormat`. That
     field is set by the league settings route when a show is picked, and pushed to every league on a
     show when an admin changes its format. A missing value reads as Survivor, so there's no
     league-state backfill. That matters because league rows are read without `migrateLeagueState`.
     `EXIT_METHODS` and `ACTIVE_ROSTER_EVENTS` are gone from its exports.
   - Wiki and research reads record `format` in their provenance. A cached read made under a different
     format isn't reused. Reads from before this record none and count as Survivor, so nothing
     existing is re-read or re-billed.
   - There's no `generic.js` yet. The default stays `survivor` so nothing changes; add `generic` when
     there's a show that needs it.
   - Verified: a regression harness captured every request the connectors send (system prompt, user
     prompt, JSON schema) plus validation and game-rule results on fixed fixtures. Output before and
     after the refactor is byte-identical. `tsc`, `eslint src` and `next build` pass. **Not verified
     against a database:** the local dev DB is at migration 0015 and lacks `pgvector` (needed by 0016),
     so the new routes haven't been exercised locally.
   - Deferred to phase 2: three display-only renderers of Survivor research answers (`printResearch`
     in `db/episode-research.js`, `notesFor` in `db/embeddings.js`, `notesFor` in
     `src/components/admin/shows-section.tsx`) and the `ResearchCastaway` type. They only affect
     wording and tolerate missing fields, so generalise them once there's a second checklist to
     generalise against.
2. **The Traitors — BUILT (same branch), not yet run against the model or a database.**
   - `formats/traitors.js`:
     - Exit methods: Banished, Murdered, Left the game, Finalist, Winner, Other. The winner method is
       `Winner`, and several people can share it, which ends the season the same way.
     - No merge.
     - The 8 confirmed events.
     - Per-show defaults, all editable: 0 for Murdered and Caught, since whether those cost points is
       the league's call.
   - **Roles** are a fourth kind of season decision, `role` (migration `0022_role_decisions.sql`):
     - The value is `Traitor` (original, episode 1) or `Recruited Traitor` (at the recruitment
       episode), carried in `method`.
     - They reach leagues through the same reveal-gated sync as eliminations. The audience knows the
       Traitors from episode 1, so "hidden until revealed" means hidden until the league reaches that
       episode.
     - League state: `episode.roles`, `StateLogic.roleOf / addRole / removeRole`.
   - **Implied events:** Murdered, Finalist, Won the season, Banished as a Traitor and Recruited are
     not stored or reviewed.
     - `ActiveRosterLogic.episodeEvents` derives them on every read from exits and roles
       (`format.impliedEvents`).
     - So correcting an exit moves the points with it, and nothing can be scored twice.
     - `addEvent` refuses them. The UI marks them "auto" and "(automatic)".
   - **Wiki read:**
     - Contestants table → exits, original and recruited Traitors.
     - Voting History → each Round Table's votes and banishment, plus shields.
     - "Survived a Round Table" and "Voted out a Traitor" are derived in code from the votes
       (`derivedEvents`), rather than tallied by the model.
     - "Won a shield" counts the wiki's Shielded *and* Immune cells.
   - **Cast read:** the format adds a note so the Faction column is never read as a tribe. Read as a
     tribe, it would publish the Traitors to every league.
   - **Research:** a Traitors checklist (shield, Round Table votes, voted out a Traitor, recruited).
     A research "recruited" answer stages a `role` decision.
   - The three display renderers deferred from phase 1 now go through `format.research.notes` /
     `sentences`.
   - **Verified offline:**
     - Survivor harness output is unchanged except for two additive fields.
     - A Traitors check script ran against the real US4/US5 wiki pages: sections found, templates
       expanded, about 15K characters in total.
     - It also checked the prompt and schema, derived events on a US4-shaped read, and roles,
       implied-event scoring, exit correction and multiple winners in league state.
     - `tsc`, `eslint` and `next build` pass.
   - **Not verified yet:**
     - A real model read of a Traitors season. Do US4 first (completed, ground truth), with
       `--dry` / Opus.
     - The new routes against a database.
   - **Deferred:**
     - Entering a role by hand in a league (roles arrive only through admin decisions, like exile).
     - Showing a role badge on rosters and the draft board.
   - **Switching the existing Traitors show over:**
     - In Admin → Shows → Rules, pick "The Traitors".
     - Its next pull re-reads the cast and episodes (cached reads are tied to the old format).
     - If its cast was already pulled under Survivor rules, check the cast review: the Faction column
       may have been staged as tribes ("Traitor"/"Faithful"). A re-pull won't overwrite a tribe
       already staged, so clear those by hand.
3. **The Challenge.** Same again. Teams and pairs change often, so check that the held-tribes and
   group logic copes with regrouping.
4. **Tidy-up.** Remove the remaining Survivor wording from shared UI copy. ("Season over" is already
   generic: phase 1 made it the format's `winnerExitMethod`.)

## Risks and open points

- **Wiki shape — largely de-risked.** Ground-truth pulls (via `curl` against each wiki's MediaWiki
  API, which this dev environment *can* reach even though the WebFetch tool 402s — use
  `https://<wiki>.fandom.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&format=json&titles=...`)
  confirm the exit-method/placement taxonomies above. Traitors' template-transcluded tables are the
  same shape as Survivor's and already handled. The real structural difference is the Challenge: its
  table shape (and rules) vary season to season and are driven by the season's prose. It's still to
  be proven that extraction holds up against a *live, incomplete* season (US5, Cutthroat), not just
  the completed seasons pulled so far.
- **Research-only facts.** Things like mission contributions or who was on the death list may not be
  in any table; research is the only source, so confidence matters more for these.
- **Existing leagues** on a show that later changes format keep their past results. Only new
  decisions use the new vocabulary.

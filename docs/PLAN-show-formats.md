# Plan: show formats (Survivor, The Traitors, The Challenge, …)

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

## Draft catalogs for the new formats (to confirm)

**The Traitors**
- Exit methods: Banished (at the Round Table), Murdered, Left/Quit, Eliminated at the end game,
  Winner (Faithful), Winner (Traitor), Other.
- Roles: Traitor / Faithful. A role is often secret until the person leaves, and a Faithful can be
  recruited mid-season. Proposal: a per-castaway `role`, recorded as a season decision like everything
  else, and hidden from league members until it's publicly revealed.
- Candidate scoring events: won a shield; survived a Round Table where they received votes; voted for
  a Traitor who was banished; recruited as a Traitor; nominated for murder / on the "death list" and
  survived; won or contributed to a mission (only if sources attribute it to named people).

**The Challenge**
- Exit methods: Eliminated (lost an elimination), Disqualified, Quit, Medically removed, Finalist
  (placed), Winner, Other.
- Groups: teams or pairs that change during the season (the existing "tribe" plumbing, relabelled).
- Candidate scoring events: daily challenge win; elimination win (e.g. The Arena / Jungle); thrown
  into or nominated for elimination and survived; finals placement.

**Generic** (the fallback for any other show): Eliminated / Quit / Removed / Winner / Other;
challenge win; safe while at risk. Research asks only generic questions.

## Phases

1. **Plumbing, no behaviour change.** `shows.format` column (existing Survivor show = `survivor`,
   others = `generic`), a format picker in Admin → Add show / show Settings, and the format registry
   with `survivor.js` holding today's lists and prompts, moved rather than rewritten. Every call site
   in the table above reads from `formatFor(show.format)`. Success = all current tests pass and a
   Survivor pull/research gives byte-identical prompts.
2. **The Traitors.** Write `traitors.js` (catalog, wiki sections and prompt, research checklist,
   default sites, roles if we want them). Pull a *completed* US season first, as ground truth to judge
   extraction against, then Season 5.
3. **The Challenge.** Same again. Teams and pairs change often, so check that the held-tribes and
   group logic copes with regrouping.
4. **Tidy-up.** Remove the remaining Survivor wording from shared UI copy, and make "season over"
   generic (the format's winner exit method, not the string "Sole Survivor").

## Risks and open points

- **Wiki shape.** Each show's wiki lays out its tables differently. The format's section names and
  prompt are the lever, but only a real pull tells us whether they work. This dev environment can't
  reach fandom.com (network policy), so the first pulls happen on the live site, or after allowing
  `*.fandom.com` in this environment's network settings.
- **Research-only facts.** Things like mission contributions or who was on the death list may not be
  in any table; research is the only source, so confidence matters more for these.
- **Existing leagues** on a show that later changes format keep their past results. Only new
  decisions use the new vocabulary.

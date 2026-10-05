# Plan: AI-researched show formats (self-serve, beyond the hardcoded three)

Builds on `docs/PLAN-show-formats.md` (which shipped `survivor`/`traitors`/`challenge` as hand-written
code) and turns `docs/ADDING-A-SHOW-FORMAT.md`'s manual research playbook into a product feature,
reusing the "ask for primitives, derive the stats" discipline `docs/RESEARCH-extractable-stats.md` and
`docs/PROMPT-stat-research.md` already validated by hand. See `docs/PLAN-new-user-onboarding-flow.md`
for where a normal user first reaches this (the "+ Add it" tile) — the two plans share that one seam.

## The problem

`formats/index.js` is `{ survivor, traitors, challenge }`, exactly as phase 1 of `PLAN-show-formats.md`
shipped it. Adding a fourth ruleset today means a developer manually works through
`ADDING-A-SHOW-FORMAT.md`: pull two wiki seasons by hand, derive the exit-method taxonomy, check for
hidden roles, draft a scoring catalog, confirm it with the user, write
`src/lib/game/formats/<show>.js`, register it, ship a deploy. Multi-hour session, every time, and only
reachable by asking a developer.

Both `ADDING-A-SHOW-FORMAT.md` and `PLAN-show-formats.md` already name a fourth format, `generic` —
"the fallback for any other show" — as a cheap universal option. It was never built (`formats/index.js`
only has three). That's the closest thing to free money in this whole plan: ship it first, independent
of everything else below.

## What moves to data, what stays code

The pipeline around a format is already show-agnostic (`PLAN-show-formats.md`'s own framing); what's
hardcoded is the *vocabulary* a format carries. Not all of it can honestly move to data:

| Piece | Today | Plan |
|---|---|---|
| Exit methods, winner method | array literal per format file | **data** |
| Scoring event catalog (id, label, category, default points, auto/manual) | array literal per format file | **data** — this is most of what League Settings already renders generically, so the UI barely changes |
| Checklist fields (what research asks per castaway) | hand-written Zod schema per format | **data**: field name/type/enum/description, with one shared builder that constructs the runtime Zod schema from it. The one real engineering departure in this plan — prototype before committing (see Risks) |
| Wiki section names (`voteSections`/`guideSections`) | array literal per format file | **data** |
| Trusted research domains, terminology | already DB fields (`ShowSettings`, `castaway_term`/`tribe_term`) | unchanged |
| `impliedEvents`, `wiki.derivedEvents` (derived scoring — e.g. Traitors crediting a banishment vote by role) | function per format file | **stays code.** A show that needs this isn't eliminated by this plan, it's caught earlier by the research step and handed to a developer with findings already written up, instead of a blank page |
| Hidden/evolving roles (Traitor/Faithful-style) | schema + code per format | the *mechanic* stays code; *whether a show has one* becomes something the research step detects and flags |
| Season-to-season rule variance (Challenge-style) | handled ad hoc in the prompt | **data**, phase 5 below: season-scoped deltas on top of a show's base catalog |

## The pipeline

1. **Add a show → research gameplay → propose a catalog.** Admin (or, once exposed, any commissioner
   — see the onboarding plan) names a show, optionally a wiki URL. The app builds a prompt adapting
   `PROMPT-stat-research.md`'s primitive/tier (A–D) methodology. Paste into your own AI chat (free) or
   let the app call one (paid — extends the existing Research/Paste-research split). Paste the answer
   back. Output: a proposed event catalog, point defaults, exit methods, checklist fields, and
   suggested research-source domains — **plus an explicit flag** when the research surfaces a
   mechanic that needs real code rather than silently forcing it into the data shape.
2. **Review screen** (new — nothing like it exists yet). Rows grouped by category the way Active
   Roster Settings already groups them, each editable inline, each carrying its A–D confidence tier; a
   collapsed "not reliably trackable" section for tier-D findings (mirrors
   `PROMPT-stat-research.md`'s "Table 4 — don't bother," so nothing is silently dropped without saying
   so); suggested source domains as checkboxes, pre-checked where they match known-reputable patterns
   but never auto-applied. A flagged-mechanic callout surfaces the pre-written findings write-up (the
   same shape `ADDING-A-SHOW-FORMAT.md` step 7 already asks a human researcher to produce) ready to
   hand to a developer. Primary action **"Approve & create show"**; secondary **"Save as draft"**
   (same stage-then-approve discipline as `SeasonCastReview` / episode decisions).
3. **Add a season → research what's different.** Folds into `SeasonCard`'s existing pipeline as one
   more step between cast approval and episode review: "check for rule changes." Output is a
   season-scoped delta on the show's base catalog, not a new format — reviewed the same row-by-row
   way. (`RESEARCH-scoring-values.md`'s own open item — re-running the analysis once Survivor 51's
   Exile Island twist has data — is a real example of exactly this need.)
4. **"Already researched — import it?"** Once catalogs are DB rows, this is cloning one, with an
   option to tweak after. Cheap, ship anytime after step 1 lands.
5. **Episode research.** Unchanged in user experience — this is today's "Paste research" loop. It
   generalizes for free the moment the checklist schema is read from the DB instead of a hardcoded
   file, so no new UI is actually needed here.

## Phases

1. **Ship `generic.js` for real.** Closes the existing doc/code gap, zero new architecture, usable as
   a manual-entry fallback for any show immediately (exit methods + elimination-order scoring only, no
   wiki/research dependency) — also doubles as the honest answer to "this show is too obscure to
   model."
2. **Migrate `survivor`/`traitors`/`challenge` into the new data shape.** Prove it byte-identical
   against the regression-harness method `PLAN-show-formats.md` phase 1 already used and trusted
   (fixed fixtures, before/after diff). Don't trust AI-generated catalogs against an unproven data
   model — prove the model against known-good formats first.
3. **Build the research-propose-review flow**, admin-only, targeting a genuinely new format.
4. **Expose "+ Research new rules with AI" in the normal create-league flow** (see the onboarding
   plan) — this is also where the self-serve catalog-trust question below gets resolved in code.
5. **Season-level delta research.**

## Risks and open points

- **Checklist-schema-as-data is the one real engineering risk.** Everything else here is "move an
  array from a JS file to a DB row." Building a Zod schema at runtime from a declarative field list
  needs its own small prototype before the rest of this plan leans on it.
- **Catalog trust once this is self-serve.** A show a random commissioner researches shouldn't publish
  straight into the global picker other users see. Default: usable in the creator's own league
  immediately, not in the public picker until reviewed. Needs an explicit reviewer step (admin
  spot-check, most likely) before phase 4 ships.
- **Cost shape is unknown.** A new-show research pass is a much bigger prompt/response than one
  episode's checklist — needs its own cost estimate before any AI-credit pricing is attached to it.
- **This does not make every show fully automatic.** A show with hidden/evolving roles or heavy
  season-to-season variance still needs a developer for its derivation logic. The honest win is: 90%
  less manual research and a clear flag for the remaining 10%, not "zero code forever."

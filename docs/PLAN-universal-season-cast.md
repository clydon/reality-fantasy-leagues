# Plan: one cast per season, shared by every league on it

Follows `docs/PLAN-episode-research-compiled-cache.md` (and fixes the gap its smoke test found: an
admin couldn't review a self-serve season's results) and `docs/PLAN-cast-import-prompt.md` (whose
"cast import duplicates research across leagues" follow-on this absorbs). Decided in conversation
2026-10-08; grounded in the cast code as it stands (`src/lib/server/season-cast.ts`,
`src/lib/server/cast-import.ts`, `src/app/api/admin/seasons/[id]/cast/*`, `StateLogic.applyCastImport`).

## The problem

A season's cast lives in two places today, and which one is real depends on who set the season up:

- **Catalogued (admin-run) seasons:** `season_cast` is the master. The admin pulls and approves it, and
  approval copies it into every league on the season (`applyCastToState`), now and on joining.
- **Self-serve seasons:** there is no master. Each league types its own roster, or pastes one in
  with "Import a cast", straight into its own state.

That split causes most of the trouble the episode-research smoke test hit:

- Two leagues on one season spell people differently ("Jess" / "Jess White"), so shared research has
  to match names loosely, and a result stored under one spelling has to be resolved for the other.
- Cast research is done again by every league on the season.
- Admin review needs one canonical cast, so a self-serve season's Episodes step is stuck at
  "Approve the cast first", with no way to unlock it.
- Approving a cast also switches on the admin's push-to-every-league Accept for results. So
  "give this season a master cast" and "the admin now decides this season's results" can't be done
  separately.

There's also no stable link between a league's castaway and its `season_cast` row. Matching is by
exact name (`applyCastImport`'s `sameName`), so renaming someone in the season cast would ADD a second
person to every league rather than rename them.

## Decided

- **Cast is universal: one per season, the same for every league on it.** It applies to catalogued and
  self-serve seasons alike. No per-league exceptions: a league can't add, rename or drop castaways of its
  own (that was raised and deliberately left out; revisit only if a real need appears).
- **Strictly just cast.** "Cast" means the people: names, photos and **starting** tribes/factions.
  Making the cast universal says nothing about results. Mid-season tribe swaps, eliminations and roles
  (a Traitor) are results, not cast (see open question 2 for roles).
- **Who writes it:** the first league on a season to enter a cast creates it (its commissioner, by
  typing or by "Import a cast"). An admin can create it too, from Admin, as today. **Once it's created,
  only an admin can change it.** Every change reaches every league on the season, so it's the one write
  a commissioner would otherwise make to leagues they don't run.
- **Starting tribes are never a spoiler.** They reach a league immediately only if they were public
  before the premiere; otherwise they're held until the league reveals the episode they're first shown
  in. This is the existing `show_seasons.tribes_from_episode` hold (`tribesDue`): null = known
  pre-premiere, N = held until episode N. The new commissioner entry path must ask the question,
  not assume.
- **Results get their own per-season switch**, separate from cast approval:
  - **Admin-decided:** the admin's Accept pushes results into every league (`syncLeagueDecisions`).
    This is how the three Survivor 50 leagues work today, and it is unchanged.
  - **League-decided:** each commissioner applies results to their own league (the episode research
    panel). The admin's Episodes step becomes a curator view (below) and never pushes into leagues.

  Existing catalogued seasons with an approved cast migrate to admin-decided; lazily created seasons
  and new self-serve ones default to league-decided.

## The pieces

1. **A stable link from league castaway to season cast.** League castaways get a `seasonCastId`, set
   when the cast is applied. From then on, matching uses the ID; names are only used once, to link
   existing rosters (piece 6). A rename, new photo or starting-tribe fix in `season_cast` then updates
   each league's linked castaway in place. Nothing per-league moves: owners, status, scoring and lineups
   all key on the league's own castaway id, which doesn't change.
2. **Commissioner cast entry writes the season cast.** The league cast routes (`castaways` POST,
   `castaways/[id]` PATCH/DELETE, `castaways/import`) on a league that has a show and season:
   - season cast not created yet → create it from this league's input (`show_seasons` row created
     lazily, as episode research already does), approve it, and apply it to every league on the season;
   - season cast exists → refused for a commissioner ("This season's cast is shared; ask an admin to
     change it"). An admin goes through Admin, as today.

   "Import a cast" keeps its review screen. It gains the pre-premiere tribes question, and roles are
   split off (open question 2).
3. **"When does creation end?"** The creating league has to be able to finish typing a cast before it
   locks (open question 1).
4. **The per-season results switch:** `show_seasons.results_by` (`admin` | `leagues`), via a migration.
   `syncLeagueDecisions` / `syncSeasonLeagues` do nothing for a `leagues` season. Shown and changed in the
   season's Settings in Admin. Switching from `leagues` to `admin` needs a cutoff (open question 3).
5. **Admin's Episodes step, curator mode** (league-decided seasons), replacing "Approve the cast first":
   - per episode: counts, and which leagues applied each result (worked out on read from league state,
     like the commissioner panel's `inLeague`; nothing stored);
   - per result: **Flag as wrong** (the shared row is rejected) and **Correct…** (the shared row is
     fixed). Neither touches a league. Commissioners see a flagged row struck out and unticked, and a
     corrected row in its corrected form; a league that already applied a flagged row gets told
     (that's the start of the parked dispute inbox), not changed;
   - results applied by no league are called out, with a link to the show's rules ("often a rule
     problem": that's how the Love Island format's `enteredVilla` → "Entered as bombshell" bug showed
     up in the smoke test);
   - the Admin-wide spoiler-free mode still applies (counts until "Show this episode's results").
6. **One-time migration of existing rosters.** For each season with leagues but no season cast, take
   the most complete league roster as the season cast. Link every league's castaways by exact name,
   then by `findCastawayByName`. Anyone that still doesn't match goes to a review list for an admin,
   never auto-added (a guessed match could hand someone's drafted castaway to the wrong person).
   Seasons that already have an approved cast just get linked by name.
7. **Episode research simplifies.** With one cast, a season's research asks about the season cast,
   and staged names match league castaways by `seasonCastId`. The loose matching stays only as a
   fallback for data from before the migration.

## Order of work

1. Piece 1 (the link) plus piece 6's linking pass for seasons that already have an approved cast. Prove
   on the local copies of WUYXVU / T9FUMY / B999RR that every castaway links and scoring is unchanged
   (score before and after, then diff).
2. Piece 4 (results switch + migration), with Survivor 50 = admin. Prove the season sync is unchanged
   for admin seasons and does nothing for league seasons.
3. Piece 2 (commissioner entry writes the season cast) and piece 3, then piece 6 for self-serve rosters.
4. Piece 5 (curator mode), then piece 7.
5. Smoke test by hand, against the local dev server: two leagues on a fresh self-serve season (first
   one imports the cast with held tribes; second joins and receives it, tribes still hidden until
   revealed; second's commissioner can't edit it; admin renames someone and both leagues update in
   place), then the episode-research flow over it with no spelling differences, then curator mode. Plus
   a regression pass on the three Survivor 50 copies.
6. Gates per `docs/HANDOFF.md`.

## Risks

- **Linking existing leagues by name is the dangerous step.** A wrong link moves a drafted castaway's
  identity. Exact match first, forgiving match second, and nothing beyond that without an admin
  confirming; dry-run the migration and show its report before writing anything.
- **Cast changes now reach other leagues.** That's the point, but an admin rename or tribe fix mid-season
  touches every league at once. Log each change (who, when, before/after) on the season.
- **Tribes as spoilers.** Every new write path for starting tribes must go through the
  `tribes_from_episode` hold. Test a catching-up league specifically.
- **Leagues with no season** (a show but no season number, or hand-built leagues) have nothing to share
  a cast with. They keep their own roster as today; this plan only changes leagues on a season.

## Open questions

1. **When does the creating league's cast lock?** Suggestion: its commissioner can keep editing until
   they press "Finish cast", or automatically when any league on the season starts its draft, whichever
   comes first.
2. **Roles (e.g. Traitors).** "Import a cast" records roles today. Under "strictly just cast" they're
   not cast. Suggestion: roles a show reveals to viewers in the premiere become episode-1 results (they
   already exist as `role` season decisions), so they're spoiler-gated like any result.
3. **Switching a season from league-decided to admin-decided.** Suggestion: the push only covers results
   the admin accepts after the switch, and each league's existing results are treated as already there,
   so nothing a commissioner chose not to apply gets pushed in.

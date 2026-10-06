# Plan: a copy/paste research prompt for a season's cast

Same shape as `docs/PLAN-ai-generated-show-formats.md`'s "paste first" research loop and
`docs/PLAN-stage-3-format-proposals.md`'s review screen, applied to a different problem: getting a
season's cast INTO a league, not getting a show's rules.

## The problem

`src/components/setup/castaways-section.tsx` adds one castaway at a time, by name, with no way to set a
photo or starting tribe/team except editing each one afterward. For a show with a real wiki connector
(Survivor, Traitors, The Challenge), this doesn't matter much -- `db/wiki-sync.js` extracts the cast
programmatically and a commissioner reviews a proposal, never typing names by hand. But a show researched
through the self-serve "Research a new show" paste flow (`docs/PLAN-ai-generated-show-formats.md`) has no
wiki connector at all, so every one of its leagues is stuck re-typing the full cast, one name at a time,
with no photos and no starting groups, every single season.

**The good news: the hard part already exists.** `StateLogic.applyCastImport` and
`StateLogic.applyCastTribes` (`src/lib/game/state-logic.js` ~1301-1356) already take exactly the shape
this needs -- `{ tribes: [{ name, color? }], castaways: [{ name, photoUrl, tribeName }] }` -- and are
already additive, idempotent (safe to run twice, safe to run on a partial list and finish later) and
careful never to touch a castaway's id (so a draft already run against them is never orphaned). They were
built for `wiki-sync.js`'s proposal. What's missing is a way to GET that proposal for a show the wiki
connector can't reach: a prompt to paste into any web-searching chat, the same way
`docs/PLAN-ai-generated-show-formats.md`'s show-research prompt already works.

## Decided (from conversation)

- **Photo URLs are asked for directly**, as a real image file URL. An empty string when the chat can't
  find one -- not null, not omitted -- which needs zero new handling: `applyCastImport` already treats a
  falsy `photoUrl` as "no photo" (`if(c.photoUrl) created.photoUrl = c.photoUrl`), and `CastawayAvatar`
  already renders initials when a photo URL is empty or broken. The risk of a dead or wrong link is
  accepted; the existing fallback is the safety net, not prompt engineering trying to prevent it.
- **Starting faction/group is asked for too, including a secret one** (Traitor/Faithful), because by the
  time anyone bothers importing a cast instead of typing it in at the very start of a season, the episode
  that reveals it has usually aired already (or the show's own publicity reveals it, depending on format)
  -- so refusing to ask for it at the DATA layer buys nothing the app's existing client-side spoiler trim
  doesn't already handle. Same reasoning the rest of the app already uses: results, tribe moves and role
  reveals all reach the browser in full and are trimmed for display, never withheld from storage.
- **A secret role is not a tribe**, and must be asked for and applied separately from a starting group.
  `traitors.js`'s own wiki code already has a guard against exactly this confusion (`castNote`: "The
  Faction column... is a secret role, NOT a group: never report it as a tribe"). The cast-import prompt
  keeps that boundary: `startingGroup` only exists when `format.hasGroups`, `startingRole` only exists
  when `format.roles`, and they are validated and applied through two different functions.
- **Role import reuses the existing role-fact shape**, not a new mechanism. `wikiRoles()`
  (`traitors.js`) already produces `{ episode: 1, name, role }` facts for exactly this case (the original
  Traitors, known from episode 1); a cast-import role answer becomes the same shape, applied the same way,
  so whatever reveal-gating already governs an episode-1 role fact governs this one too, automatically.
- **Self-serve researched formats never have `roles` today** (`formats/custom.js`: "No roles in v1" -- a
  secret-role mechanic is always left in `flagged` instead). So `startingRole` has exactly one real format
  to exercise right now, `traitors`, but the code should read `format.roles` generically and not special-case
  Traitors by name -- a future built-in format could add one.

## The pieces

1. **`buildCastPrompt(format, { seasonName })`** -- new, small, plain CommonJS (mirrors
   `buildProposalPrompt` in `src/lib/game/formats/proposal.js`; put it in a new
   `src/lib/game/formats/cast-prompt.js` so it stays dependency-free and browser-safe like every other
   format file). Asks for one JSON object:
   ```jsonc
   {
     "castaways": [
       {
         "name": "Full name",
         "photoUrl": "a direct image file URL (official cast photo, press kit, or the show's own site) -- empty string if none found",
         "startingGroup": "their starting <tribe/team term>, only if this show has them", // omitted entirely from the prompt when !format.hasGroups
         "startingRole": "their starting role, one of <format.roles.values + default>, only for a show with hidden roles" // omitted when !format.roles
       }
     ],
     "sources": ["every URL actually read"]
   }
   ```
   Uses `format.terms.castaway`/`format.terms.tribe` for wording, same as every other prompt in this app.
2. **`parseCastImport(raw, format)`** -- validation/repair, same philosophy as `parseProposal`: a bad row
   is kept with a reason rather than failing the whole batch. Checks `startingRole` against
   `format.roles.values` when present (an unrecognized value is dropped with a repair note, not guessed at).
3. **Splitting into what the existing functions expect** -- the parsed result turns into:
   - `{ tribes: [...], castaways: [{ name, photoUrl, tribeName }] }` for the EXISTING
     `StateLogic.applyCastImport` (name + photo + group) -- no changes needed to that function at all.
   - a new, small `StateLogic.applyCastRoles(state, { castaways: [{ name, role }] }, episode = 1)`,
     written the same way `applyCastTribes` already works (match by name, additive, safe to re-run): for
     each matched castaway, record a role fact at the given episode if one doesn't already exist for them
     there. This is new code, but it's a thin sibling of `applyCastTribes`, not a new concept.
4. **A review screen** -- reuse the plain-list-of-rows style already proven in `format-review-screen.tsx`
   (not its heavy rule editor -- this needs far less): one row per castaway, with a small photo preview
   (`CastawayAvatar`'s own broken-image handling covers a dead URL for free), editable name/tribe/role, and
   a problems list from `parseCastImport`'s repairs. Paste, review, confirm -- same shape as every other
   paste flow in this app.
5. **Entry point** -- a panel next to `CastawawysSection` in League Settings, *not* restricted to
   self-serve/researched shows. Any league's commissioner has today's one-at-a-time problem regardless of
   which show it's on; the wiki-driven shows just happen to rarely need it because `wiki-sync.js` already
   fills the cast in for them.
6. **New route**, e.g. `POST /api/leagues/[id]/castaways/import`, body `{ proposal }` ->
   `{ added }`, calling `applyCastImport` then `applyCastRoles` inside the same `withLeagueLock` write every
   other league mutation already uses, so both land atomically.

## Order of work

1. `cast-prompt.js`: `buildCastPrompt`, `parseCastImport`, with unit tests covering a show with groups, one
   with roles, and one with neither (`generic.js`) -- mirrors how `tests/format-proposal.test.js` already
   covers the rules proposal.
2. `StateLogic.applyCastRoles`, tested the same way `applyCastTribes` already is in the existing test
   suite (match-by-name, idempotent re-run, a role already recorded for that episode is left alone).
3. The route, `withLeagueLock`-wrapped, tested against a league on `traitors` (exercises `startingRole`)
   and one on `survivor` or `generic` (exercises groups only, confirming `startingRole` never shows up in
   the prompt or the payload when the format has no `roles`).
4. The review screen component and the League Settings entry point.
5. Manual smoke test: paste a researched cast for a real season (groups) and for a Traitors season
   (groups absent, roles present), confirm `applyCastImport`/`applyCastRoles` both ran, and confirm the
   role fact is actually spoiler-gated the same way a wiki-driven one already is (a league that hasn't
   revealed past episode 1 shouldn't show it even though it's in the stored state).
6. Gates: `npx tsc --noEmit -p .`, `npx eslint src`, `npm test`.

## Risks

- **Import order matters.** `applyCastRoles` matches castaways BY NAME, so it has to run after
  `applyCastImport` has created anyone new in the same request, not before -- same composition
  `wiki-sync.js`'s pipeline already relies on for `applyCastTribes`.
- **Hallucinated photo URLs** are an accepted risk per the Decided section above, not something this plan
  tries to engineer away.
- **Don't let this replace `wiki-sync.js`.** The wiki connector stays the primary, programmatic path for
  any show with a real wiki page; this prompt exists specifically for shows it can't reach (or a
  commissioner who'd rather paste once than wait).
- **`startingRole` must validate against `format.roles.values`**, not free text -- an unrecognized role
  name from the chat should repair-and-drop, the same way an unrecognized exit method already does
  elsewhere in this app, never get written as a role fact verbatim.

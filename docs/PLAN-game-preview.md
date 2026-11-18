# A game's preview, on the real screens (the user, 2026-11-18)

> "Still want a game preview ... every game, before creating, you are able to preview the stages: (the starting phase; draft, picks,
> whatever. later stages. quick actions. the game page. the player stat sheets. etc). is that possible? we could use as much real data
> that we have then randomize values so no spoilers exist. thisll be dynamic and show the real ui as it will be created rather than
> duplicate code."

**Status:** a plan; P0 (the proof) is next, and A or B is picked after it (the user, 2026-11-18: "Prove it first, then pick"). It builds on the gameplay explorer (docs/GAMEPLAY-EXPLORER.md), the user's bench decision (plan §3.4 of
docs/PLAN-GAMEPLAY-SCENARIO-EXPLORER.md: "no duplicated response layer, so new screens, API changes and engine updates appear by
themselves"), and Round 2's answer that the preview is the real screens (docs/PLAN-start-a-game-redo.md).

## What a preview is

Before a game exists, Try it plays it forward on the app's own screens, with this season's real cast, faces, groups, episodes and
moments and made-up results, so it spoils nothing and nobody can mistake it for the real season.
- **The stages, as a stepper:** the start (the draft, the first picks or the first questions), each episode's move and its result, a
  stage's change (a new draft at the merge), the finale.
- **At each stage, the screens it touches:** your move (Tonight's quick move, the dock), the game page (standings, the matchup, the
  week), a person's sheet and a cast member's or athlete's sheet with their weekly graphs, the reveal.
- **Your couch, made up around you:** the couch's real names and faces, their moves made up by the engine within its rules (the
  user, 2026-11-18: it's the game you'd play with them). Computer players come in only where the couch has no one else.
- **Said plainly:** "Sample results, not the show's" on every frame; Shuffle gives another season; nothing in it saves.

## What exists

- **The engine half: the explorer's runtime** (`tools/gameplay-bench/explorer/runtime.cjs`). It takes a full spec on a seeded world
  that keeps the names and photos it's given and makes up the results ("missing released-event facts are generated from the seed and
  context once"). It plays lineups, picks, answers, reveals and results through production rules, and names any point to return to
  (checkpoints, forks, replay). Twenty-six capabilities run (head to head, lives, banks, phases, secret roles, a captain…), plus
  sports statistics in seven slices.
- **The screens half: the bench's live tier** (`tools/gameplay-bench/live-db.cjs`). It writes a case into the local database as
  zt-gb- rows and frames the real app pages through the real routes, as each person. That's the user's own rule, and it already
  shows Tonight, Episodes, the hub and the game surfaces for a generated world. But it's for development: the local database, the
  Atlas proxy.
- **The old practice round** (`src/lib/tour/practice.ts` `buildPracticeState`): a throwaway copy of a joined league, for three game
  types, on the classic screens. It shows the idea works on real screens, and the new design doesn't use it.

## The gap, and two ways to close it

The real screens read the real routes, and the routes read the database. A preview in production needs those routes to answer from a
preview world without writing a row anyone else can read.

| | **A. A preview database** | **B. The same builders, in memory** |
|---|---|---|
| How | Every route's database access goes through one pool, so a preview request (`/api/preview/<id>/…`, from the same pages with their fetch prefix swapped) runs the **unchanged route handlers** on a separate, disposable database. The live tier's materializer moves into the app, copies the season's cast and episodes in, and writes the made-up results there. | Each route splits into a load (the database) and a build (pure). A preview loads from the explorer's in-memory state instead, and the builds are the production functions. The pages are unchanged; their fetches go to `/api/preview/<id>/…`. |
| No duplicated code | Yes: the route handlers themselves. | Yes: the builds are the production functions (the runtime's gameView already works this way). |
| Writes | Into the preview database only, deleted when the preview closes or after a day. | None. |
| Speed | Seconds to open (rows written), about a second per stage. | Well under a second per stage, since state is replayed from the seed. |
| Cost and risk | A second database (a Neon branch or another database within Free's limits), a cleanup job, and keeping its copied season fresh. | The work of splitting each route that a previewed screen reads (games, space, episodes, stats, how it works, the draft). |
| First proof | Today, on development: the live tier frames these screens for a world built from Survivor 51's real cast. | After the first routes are split. |

**Recommendation:** prove it on development now with the live tier (a session, no product change), then build **A** for the first
release. It reuses the materializer and every route as they are, and previews are rare (only while making a game), so the second
database stays small. Move to **B** route by route as each gets the split anyway; once every previewed read has one, the preview
database goes.

## What it can't show yet (each said on the frame, never hidden)

- **A live draft:** the runtime seeds who owns whom; it doesn't run the draft room. Until it does, the start shows the teams the draft
  would make, and the draft room is a gap to close (the runtime's acquisition step).
- **Waivers, a postponed game, a week in progress (sports):** the runtime's gaps.
- **A rule the engine doesn't play:** no preview, as no game.

## Steps

- **P0. The proof (development):** the live tier on a world built from Survivor 51's cast and episodes, a Fantasy league from the
  gallery, made-up results: the screens at the start, Episode 9's move, the game page after Episode 10, a castaway's sheet, the
  merge's new draft, the finale. A screenshot story; the user decides the shape before any product work.
- **P1. The preview's own screen** through the design process: the stepper, the screens at each stage, Shuffle, "Sample results",
  leaving back to the game's screen with nothing changed.
- **P2. A, built:** the preview database, the request-scoped pool, the materializer in the app, the cleanup, the spoiler check (no
  real result reaches a preview, nothing from a preview reaches a real read).
- **P3. Breadth:** every gallery base and sport game type previews, or says which gap stops it; a check opens every one.
- **P4. Toward B:** routes split one by one as they're touched; the preview database retires when the last previewed read has its
  split.

## Decided (the user, 2026-11-18)

1. **Prove it first, then pick A or B.** P0 is a development-only screenshot story; the first release's approach waits on it. The
   recommendation after the proof stays A.
2. **Who plays beside you:** the couch's real names, their moves made up by the engine.

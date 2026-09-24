# Plan: spoiler-free catch-up (a league that starts mid-season plays from episode 0)

**Status:** Designed, not built. Written in response to: *"there's an edge case where someone
creates a league after the first episode or two have premiered and they don't want to know the
details of those later episodes (maybe they want their friends to catch up and play as if it hadn't
aired yet)."*

## The problem

The wiki connector reads a **whole season** at once. `db/wiki-sync.js` extracts every episode the
wiki knows about and fans it out as `wiki_proposal_items` — one row per elimination, scoring event
and exile, all episodes at once. For a league that starts before the premiere that's harmless: the
wiki has nothing yet, and each week adds a little more. For a league that starts in week 4, the
first sync hands the commissioner the entire season to date, and the Episodes tab shows who went
home in episodes 1–3 before anyone has drafted.

What the league actually wants is to play episode 1 as though it were airing tonight: draft against
the full starting cast, make picks, then have the commissioner reveal episode 1's results, score it,
and move on — catching up to real time at whatever pace suits them.

## The proposed storage change, and why this plan doesn't do it

The suggestion was to **snapshot cast and episode data per episode** (index 0 = pre-premiere) at
extraction time, so a reveal replays the snapshot taken after that episode aired.

Two problems:

1. **It only works for seasons we happened to start watching early.** The suggestion says as much —
   *"if the wiki retrievals started pre premiere"*. A league formed in week 4 of a season nobody
   was tracking, or one playing a season that finished two years ago, has no snapshots to replay,
   and those are exactly the cases this feature is for.
2. **There is nothing spoiler-bearing to snapshot that isn't already keyed by episode.** The
   episode extraction is *already* per-episode: every elimination and event carries its episode
   number (`EpisodesSchema` in `db/wiki-sync.js`). The cast extraction deliberately takes only
   name, original tribe and photo filename — all pre-premiere facts. It does not read the wiki's
   Finish column at all (see `CastSchema`).

So the same outcome comes from **deriving** rather than snapshotting: keep the one season-wide
extraction (which the whole app already shares between leagues via `wiki_extractions`, and which
costs one model call per season), and give each league a **reveal pointer** that decides how much of
it that league is allowed to see. One extraction serves a caught-up league and a spoiler-free league
at the same time, and the feature works on any season, tracked early or not.

The one thing snapshots would buy that this doesn't: if the wiki later *rewrites* a pre-premiere
fact (a corrected original tribe), a snapshot would preserve what was true at the time. That isn't
worth a per-episode copy of every season's payload.

## Design

### 1. Per-league reveal pointer

`settings.revealedThroughEpisode: number | null` (new field, `state-logic.js` `DEFAULT_SETTINGS`):

- `null` — **live mode**, today's behaviour exactly. No gate; whatever the wiki knows is offered for
  review. Default for every existing league (absent → null, same pattern `setupComplete` uses).
- `0..n` — **catch-up mode**. The league may see episodes 1..n. `0` means nothing yet: the season is
  at the starting line whatever the wiki says.

Set during guided setup (a new step, only offered when the chosen season's catalog status is
`airing` or `completed`) and editable in League Settings while no episode has been revealed yet.

### 2. The connector fans out only what's revealed

`fanOutEpisodes()` filters by the league's pointer before writing items:

```js
const gate = league.state.settings.revealedThroughEpisode;   // null = no gate
const visible = gate === null ? items : items.filter((it) => it.episode <= gate);
```

That is the entire spoiler containment, and it's in the right place: the season-scoped half (fetch +
extract + cache) is untouched, so the nightly job and the admin Pull buttons keep costing one model
call per season however many leagues are behind. `notifyCommissionersOfReview` then only ever fires
for revealed episodes — a push notification naming an unaired episode would leak the thing this
feature exists to hide.

### 3. Revealing an episode

`POST /api/leagues/:leagueId/reveal-next` (commissioner only):

1. `withLeagueLock` → `revealedThroughEpisode += 1`.
2. Re-run the league-scoped fan-out **from the cached extraction** for that season — no wiki read,
   no model call (`wiki_extractions` already holds the payload; this is `fanOutEpisodes` with a
   higher gate).
3. Return the updated state; the new episode's items appear on the Episodes tab for the normal
   per-item review (accept / correct / reject). **Revealing is not applying** — the commissioner
   still confirms each decision, same as today.

If the cached extraction doesn't reach that episode yet (the wiki hasn't been read since it aired),
reveal still advances the pointer and files nothing; the next sync fills it in. The UI says so
rather than looking broken.

There's no un-reveal. Once the room knows, it knows — and the items may already be applied. The
escape hatch is the existing per-item reject plus manual editing, not a rewind button.

### 4. UI

- **Episodes tab**: a "Reveal episode N" button for the commissioner, with the count of episodes the
  wiki has beyond the pointer *hidden* — "the connector has more results ready" is fine to say, "3
  more episodes" is a spoiler about how far the season has run.
- **Overview**: a small "Catching up — through episode N" marker, so nobody wonders why the standings
  look early.
- **League Settings**: the mode picker, locked once `revealedThroughEpisode > 0`.

### 5. Cast-order spoiler (worth fixing regardless)

The wiki's cast table is ordered **by finish** — last boot first, winner last, on most season pages.
`validateCast` preserves that order into the proposal, so a cast list imported for a completed
season is itself a spoiler, reveal pointer or not. Sort the extracted cast alphabetically (or by
original tribe, then name) before filing the proposal. This is a two-line change in `fanOutCast` and
should ship whether or not the rest of this plan does.

## Edge cases

- **Draft timing.** Catch-up mode only makes sense if the draft happens against the full starting
  cast, which is what already happens — nothing in the draft reads episode results.
- **Pick'em and Active Roster.** These are the league types that gain most: their whole loop is
  "pick before the episode airs", which a mid-season league can't do today. Locking picks per
  episode already exists; the reveal is what makes an already-aired episode behave like an unaired
  one.
- **A player who watches ahead.** Out of scope. This hides the app's own spoilers, not the internet's.
- **Mid-season mechanics** (replenish/trade) key off applied episodes, so they follow the reveal
  pointer with no change.
- **`wiki_proposal_items`' identity index** (`league_id, episode_number, kind, castaway_name,
  event_type`) already makes re-running a fan-out idempotent, so raising the gate and re-running
  cannot duplicate an earlier episode's decisions or resurrect a rejected one.

## Work items

1. `state-logic.js`: `revealedThroughEpisode` in default settings + a `RevealLogic` helper
   (`isCatchingUp`, `revealedThrough`, `nextEpisodeToReveal`), with the settings-update path
   validating it.
2. `db/wiki-sync.js`: gate in `fanOutEpisodes`; alphabetical cast order in `fanOutCast`.
3. `POST /api/leagues/:leagueId/reveal-next`, reusing the cached extraction.
4. Episodes tab reveal control; Overview marker; League Settings mode picker + guided-setup step.
5. Tests: gate filtering at three pointer values, reveal raising the pointer and filing exactly one
   episode's items, re-running a sync not leaking past the gate, and a rejected item staying
   rejected across a reveal.

No migration: the pointer lives in the league's existing JSONB settings, and nothing about
`wiki_extractions` or `wiki_proposal_items` changes shape.

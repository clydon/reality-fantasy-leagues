# Plan: League types expansion (ownership modes, Pick'em, Active Roster) + wiki connector

**Status:** Step 1 of "Suggested execution order" (the `ownerId` -> `ownerIds` refactor) is
**implemented and verified**; Features A-D are still unbuilt. Written from a multi-turn design
conversation — read this file plus the referenced source files and you have everything needed to
execute without that conversation's history.

## Context (read this first)

Today there's exactly one league type (`classic-draft`: snake draft, exclusive ownership,
elimination-order scoring) behind the `LEAGUE_TYPES`/`SHOWS` strategy-pattern seam in
`src/lib/game/state-logic.js` — see that file's own top comment for the extension pattern before
adding anything below. This plan:

1. Adds a configurable **ownership mode** (exclusive vs. shared) to Classic Draft, with a new
   blind-draft mechanic for shared mode.
2. Adds **Pick'em**, a new no-roster league type.
3. Adds **Active Roster**, a new league type with bench slots, a weekly lineup lock, and
   configurable event-based scoring (immunity/reward/idol/etc.), reusing the existing
   mid-season replenish/trade mechanics unchanged.
4. Adds a **wiki connector** (MediaWiki API + AI extraction + commissioner confirm/override) that
   feeds elimination data today and Active Roster's event log once that ships.

Existing pieces this plan reuses rather than rebuilds — know these before writing new code:
`ReplenishLogic`/`TradeLogic` (already gated behind `supportsReplenish`/`supportsTrade` flags,
reused as-is by Active Roster), the per-episode bet/prediction infrastructure (`BetLogic`,
`proposeBet`/`addBetPrediction`/`setBetPredictionCorrect`, see `src/lib/api.ts`) which Pick'em
should be evaluated against before writing new prediction-tracking schema, and `FinaleLogic`
(structurally similar to what a future jury-prediction mode would need — out of scope here, just
worth knowing it exists).

**Cross-cutting requirement: every setting this plan introduces is commissioner-editable in
League Settings, well organized, not just something set once at league creation or only reachable
via API/seed data.** That's `ownershipMode`, `activeSlots`/`benchSlots`, and every entry in
`eventPoints` below — and as this list grows with future league types, it needs to stay organized
into sensible sections, not become a flat wall of toggles. Follow the section-per-concern pattern
already established in `src/components/setup/*` (League Info, Players, Tribes, Castaways,
General/Side-Bet/Finale Settings, Backup, Invites) rather than dumping new settings into whichever
existing section is topically closest:
- `ownershipMode` belongs alongside the League Type/Show pickers already in League Info.
- Active Roster's `activeSlots`/`benchSlots` and `eventPoints` warrant their own new section
  (e.g. `active-roster-settings.tsx`), modeled directly on the existing
  `side-bet-settings-section.tsx` — same "list of point-value inputs, one per category" shape —
  gated on the league's type the same way `finale-settings-section.tsx` is already gated on
  `supportsFinalePredictions`.
- Pick'em's per-correct-pick point value (see Feature B) gets the same treatment once it's a real
  setting rather than a hardcoded constant, even though that's a single field rather than a whole
  section.

---

## Foundational: `ownerId` → `ownerIds` (ships first, before any new league type) — DONE

**Implemented.** See README's "Castaway ownership is `ownerIds: string[]`" section for the shipped
shape, the `Core` helper contract, and the verification that was run. Two notes for whoever builds
Feature A on top of this:

- One assumption in this section turned out to be wrong: it is **not** zero-migration. Ownership
  does live in the `state` JSONB, but `withLeagueLock` reads that column raw and never calls
  `Migrations.migrateLeagueState` (that runs on backup import only), so existing league rows needed
  a real one-time conversion — `db/migrations/0003_castaway_owner_ids.sql`. Any future change to the
  shape of `state` has the same trap; don't assume JSONB means migration-free.
- `formerOwnerId` is still a scalar, on purpose — it's history/display only and never scored. Shared
  mode will need to decide what "former owner" means when a castaway had several owners; that's
  Feature A's call, not a gap in this step.

**Decision, and why:** castaway ownership today is `castaway.ownerId: string | null` — exclusive
by construction, one owner or none. Shared ownership (multiple players owning the same castaway)
can't be represented by a scalar field. The alternative — bolt a second, parallel field onto
castaways that's only used by shared-ownership leagues — would mean every piece of
ownership-aware code forever branches on league mode. Since this is a zero-migration decision
(ownership lives entirely inside the `state` JSONB column, not a Postgres column — this is a
`state-logic.js`/`types.ts` shape change only, no SQL involved either way), there's no reason to
take the bifurcated option. Unify on one representation for every league type:
`castaway.ownerIds: string[]`. Exclusive-mode leagues are just the case where the array never
exceeds length 1, enforced by the draft strategy, not the data shape.

This is unrelated to `league_memberships.player_id` in Postgres (real account↔seat linkage,
untouched) — don't conflate the two "ownership" concepts while doing this.

**New `Core` helpers** so call sites stop touching `.ownerId` directly:
- `Core.ownersOf(state, castawayId): string[]`
- `Core.ownedCastawayIds(state, playerId): string[]`
- `Core.isOwnedBy(state, castawayId, playerId): boolean`
- `Core.setOwner(state, castawayId, playerId)` — exclusive-mode convenience: clears any existing
  owners, sets to `[playerId]`.
- `Core.addOwner(state, castawayId, playerId)` / `Core.removeOwner(...)` — shared-mode primitives.

**Call sites to migrate** (grep `.ownerId` across the codebase before starting — this is a
starting point, not exhaustive): `ScoringLogic.compute` (per-player owned-castaway lookup),
`RosterLogic.removePlayer`/`activatePlayer`, `DraftLogic`/`SnakeDraftStrategy.pick` (set
ownership on pick), `TradeLogic` (swap ownership between two players), `ReplenishLogic` (assign
replacement ownership), `freeAgents`/`activeOwnedCount` (still exclusive-mode-only concepts post-
refactor — read via the new helpers instead of `.ownerId`, but don't try to make them mean
something in shared mode, see below). Frontend reads: `players-section.tsx`, `board-grid.tsx`,
`free-agents-panel.tsx`, `draft-board.tsx`, `draft-results-panel.tsx`.

**Shared mode has no "free agents"** — nothing is ever removed from availability, so every pick
offers the full cast every time. `freeAgents`/`activeOwnedCount` stay exclusive-mode-only
helpers; shared-mode draft/roster UI simply doesn't call them.

**Verification:** before building anything new on top of this, confirm every existing Classic
Draft league (today's only shipped type, always exclusive-mode post-refactor) behaves
identically — same scoring output, same free-agent list, same trade/replenish behavior — against
a real fixture league compared pre- and post-refactor. This is a pure refactor; if anything
observable changes for an existing exclusive-mode league, something's wrong.

---

## Feature A: Classic Draft — ownership mode + blind draft

**Player count:** 2–6.

New league setting: `ownershipMode: 'exclusive' | 'shared'` — fixed pairing, not two independent
choices. Exclusive → today's `SnakeDraftStrategy`, unchanged. Shared → new `BlindDraftStrategy`.
Commissioner-editable in League Info (see the cross-cutting settings note above) — before the
draft starts only, same as the existing League Type/Show pickers are already disabled once the
draft may be running.

**Blind draft mechanic:** every player submits their full set of picks privately; picks stay
hidden from other players until *everyone* has locked in, then all reveal simultaneously. Needs:
a per-player "locked, not yet revealed" state (e.g. `state.draftLockedPlayerIds: string[]`), and
a reveal trigger — auto-reveal the instant every player in the league has locked in (simplest;
nothing to wait on once all parties have submitted, no commissioner action needed).

Scoring is unchanged in both modes (`EliminationOrderScoringStrategy`) — it sums per-player via
`Core.ownedCastawayIds` and doesn't care whether a castaway has one owner or several.

**Routes:** new endpoints for "lock in my blind picks"; reveal is implicit (poll/refetch the
existing draft-state endpoint once all players are locked, matching how the rest of this app
already polls — see `use-league-poll.ts` — rather than adding a push mechanism).

**Frontend:** draft UI needs a blind-submission mode (checkbox-select N castaways, "Lock In"
button, "waiting on N other players" state) as an alternative to the existing turn-based picking
UI, gated on `ownershipMode`.

**Verification:** two fixture leagues — one exclusive (confirm identical to pre-refactor
behavior) and one shared (confirm picks stay hidden until all locked then reveal together,
confirm the same castaway can appear on multiple rosters, confirm scoring sums correctly for a
player who shares a castaway with someone else).

---

## Feature B: Pick'em

**Player count:** 2+, no upper bound — there's no roster to run out of.

**Rules:** each episode, pick who *survives* (not who's voted off); can't pick the same castaway
you picked the immediately-previous episode. **Scoring is assumed +1 for a correct pick, 0 for a
wrong one, unless corrected at kickoff — this was never explicitly confirmed in the design
conversation this plan comes from, flag it before building.** Whatever the value ends up being,
it's a commissioner-editable setting (see the cross-cutting settings note above), not a hardcoded
constant — same reasoning as Active Roster's `eventPoints`.

No persistent roster at all — this is exactly the shape `state-logic.js`'s own top comment warns
doesn't fit the `DraftStrategy` seam ("a weekly pick'em league... almost certainly won't fit the
DraftStrategy shape above — don't force it in"). This needs its own top-level state branch, not a
real `LEAGUE_TYPES` draft/scoring strategy pair — though it can still register under
`LEAGUE_TYPES` for dispatch purposes with every `supports*` flag false.

**Before writing new prediction-tracking schema:** check whether the existing per-episode
bet/prediction infrastructure (`BetLogic`) already fits this shape closely enough to extend
rather than duplicate. If it does, Pick'em could be a thin wrapper around a standing per-episode
bet rather than new infrastructure — worth an hour of investigation before committing to new
schema.

**Schema (if new infra turns out to be needed):** a per-player, per-episode pick record with a
reference to the previous episode's pick, for the no-repeat check.

**Verification:** 3–4 fixture players across a few fixture episodes — confirm correct/incorrect
scoring, confirm repicking last week's castaway is rejected, confirm repicking an earlier
(non-consecutive) castaway is allowed.

---

## Feature C: Active Roster

**Player count:** 2–6, with a setup-time nudge toward shared ownership as player count rises —
compare `players × teamSize` against the league's actual cast size (`state.castaways.length`)
once populated, softer generic nudge before then. Not a hard block — "critically suggested," not
required.

**Draft:** reuses Feature A's `ownershipMode` setting and strategies unchanged (exclusive→snake,
shared→blind-with-reveal). No new draft code.

**New:** `activeSlots`/`benchSlots` settings (e.g. 3/2), replacing/extending the flat `teamSize`
concept for this league type specifically. Commissioner-editable in the new Active Roster settings
section (see the cross-cutting settings note above).

**New: weekly lineup lock.** A given episode's score must reflect who was active *at lock time*
for that episode, not whatever a player's active set happens to be later — this needs a
per-episode snapshot (`episode.lockedLineups: {[playerId]: castawayId[]}`), not a single mutable
"current active set" field. Otherwise a player changing their bench next week would retroactively
change last week's score.

**New: event log + configurable scoring.** Per-episode event log
(`episode.events: [{type, castawayId}]`) and per-league configurable point values
(`state.settings.eventPoints: {[eventType]: number}`), one input per event type in the same new
Active Roster settings section as `activeSlots`/`benchSlots` above — same shape as the existing
side-bet point-value inputs, including letting the commissioner zero out a category they don't
want to use rather than only offering a fixed catalog.

**Event catalog — candidate v1 set:** individual immunity win, tribe/team immunity win, reward
win, idol/advantage found, idol/advantage played, safe at Tribal with zero votes cast against
you. Each independently configurable, defaulting to some reasonable point value the commissioner
can change or zero out entirely.

**Manual entry first, wiki-assisted second.** This is the framing to carry into the build: every
event type must be enterable by the commissioner by hand from day one, regardless of connector
status. Which of these event types the wiki connector (Feature D) can actually detect reliably is
genuinely unknown until that connector is prototyped against real pages — **don't gate Active
Roster's ship-readiness on connector coverage of any particular event type.** Once Feature D
exists, it becomes a "propose events for this episode, commissioner confirms/edits/adds" layer on
top of the same manual entry UI, not a replacement for it.

**Replenish/Trade:** reused unchanged, `supportsReplenish`/`supportsTrade` both true. Newly
replenished castaways start **benched**, not auto-activated — commissioner/player promotes them
at the next lineup lock.

**New scoring strategy:** `ActiveRosterEventScoringStrategy` — for each episode, sum
`eventPoints[event.type]` for events whose castaway was in that player's locked-active-lineup for
that episode.

**Verification:** fixture league through a full draft → several episodes with a mix of events
logged → confirm only active-lineup castaways' events score, benched castaways' events don't,
changing next week's lineup doesn't retroactively change last week's score, replenish-assigned
castaways start benched, trade behaves identically to Classic Draft's trade.

---

## Feature D: Wiki connector (MediaWiki API + AI extraction + commissioner review)

**Source:** MediaWiki Action API against `survivor.fandom.com` — wikitext via
`action=query&prop=revisions`, not scraped rendered HTML, since it's more stable against layout
drift and closer to structured source data (season pages have a consistent "Voting History"
table with named fields).

**Extraction:** AI extraction of structured data (episode number, boot, exit method, tribe
assignments, and — pending investigation below — immunity/reward winners, idol finds/plays,
zero-vote safes) from the fetched wikitext/page content.

**Every extraction is a pending proposal, never auto-applied.** Commissioner reviews and
confirms/edits/rejects before anything lands in league state. Applies uniformly to eliminations
(already-existing data) and, once Feature C ships, to Active Roster's event log.

**Where it runs:** a standalone script following this repo's existing pattern (`db/migrate.js`,
`db/seed-dev-admin.js`), scheduled externally (Windows Task Scheduler locally; a scheduled
trigger if this is ever deployed) rather than inside the Next.js app itself, which has no
persistent server process.

**First step is investigation, not implementation.** Prototype extraction against 2–3 real,
already-aired episode pages — a mix of a normal boot and at least one messier case (double boot,
medevac, revote) — and record what fields come back reliably vs. what needs a human every time.
That result determines which Active Roster event types get an "auto-suggested" badge in the
commissioner review queue and which stay manual-only. Don't hardcode an assumption about
connector coverage into Feature C's UI before this investigation happens.

---

## Suggested execution order

1. ~~`ownerId` → `ownerIds` refactor, verified in isolation against existing Classic Draft leagues
   before anything else touches it.~~ **DONE** — see the Foundational section above.
2. Classic Draft ownership setting + blind draft (builds directly on #1).
3. Pick'em — fully independent of #1/#2 (no castaway ownership involved at all); can run in
   parallel with either.
4. Active Roster — depends on #1 (`ownerIds`) and #2 (the blind-draft mechanic).
5. Wiki connector investigation — can start in parallel with any of the above; its *integration*
   into Active Roster's event review queue naturally comes after #4 ships with manual entry
   working end-to-end.

Commit and verify each numbered item independently, matching this repo's existing convention (one
feature, build+lint+real-API-check, one commit) — not as a single giant change.

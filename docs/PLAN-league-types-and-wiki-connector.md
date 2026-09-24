# Plan: League types expansion (ownership modes, Pick'em, Active Roster) + wiki connector

**Status:** Step 1 (`ownerId` -> `ownerIds`) and Features A (ownership mode + blind
draft), B (Pick'em) and C (Active Roster) are all **implemented and verified**. Feature D (wiki
connector) is **investigated, with cast import built** (`db/wiki-sync.js` plus the
`wiki_proposals` review queue); its per-episode event extraction is the only work left in this
plan. Written from a multi-turn design conversation — read this file plus the referenced source files
and you have everything needed to execute without that conversation's history.

## Context (read this first)

When this plan was written there was exactly one league type (`classic-draft`: snake draft,
exclusive ownership, elimination-order scoring) behind the `LEAGUE_TYPES`/`SHOWS` strategy-pattern
seam in `src/lib/game/state-logic.js`. As of now that seam carries two league types plus two draft
mechanics for `classic-draft` (snake/blind, by `settings.ownershipMode`) — see that file's own top
comment for the current extension pattern before adding anything below. This plan:

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

## Feature A: Classic Draft — ownership mode + blind draft — DONE

**Implemented and verified.** See README's "Shared ownership + blind draft" section for the shipped
design and the reasoning behind the one load-bearing decision. Notes for whoever touches this next:

- **The escalation that preceded this was right, and the answer was a separate table.** Unrevealed
  picks live in `blind_draft_picks`, not in `state`, because `state` is broadcast wholesale.
  Redaction was the alternative and was rejected on failure mode: it makes ~40 current and all
  future state-returning routes fail OPEN (miss one and picks leak silently), whereas keeping the
  data out of `state` fails CLOSED. The privacy property is enforced by where the data lives, not by
  remembering to filter — which is what makes it survive future edits by people who don't know this
  feature exists. A direct leak test asserts it over the wire (see README).
- `withLeagueLock`'s mutator now also receives the transaction `client`. Only blind draft uses it,
  for reveal atomicity (insert + "is everyone in?" read + reveal write all under one row lock).
  Every other caller ignores the extra argument. If you need to touch a table alongside `state`
  atomically in future, this is the seam.
- **Replenish and Swap are gated on capability AND commissioner choice**, via
  `replenishAvailable`/`tradeAvailable`. Capability: shared mode sets `supportsReplenish`/
  `supportsTrade` false, since both are free-agent mechanics and shared mode has no free agents.
  Choice: `settings.replenishEnabled`/`tradeEnabled`, League Settings toggles, **both default off** —
  they're optional mechanics, not something every league runs. A shared-mode replenish could
  plausibly mean "add any still-active castaway" instead; that's an open design question,
  deliberately not guessed at. If the answer is wanted, it changes `ReplenishLogic.assign`'s owner
  guard and flips `supportsReplenish` back on in `CLASSIC_DRAFT_SHARED`.
- **Impersonation sees the impersonated player's blind picks**, and that's expected rather than a
  hole: impersonation makes you that user for every request, which is the point of the feature, and
  isn't specific to blind draft. Noted explicitly in `src/lib/server/blind-draft.ts` so "self-only"
  isn't misread as "unreachable by an admin who deliberately becomes that player".
- **One permission exception, on purpose:** the commissioner may submit blind picks on a player's
  behalf but may NOT read anyone else's, not even as super-admin. Reading would hand a
  commissioner-who-is-also-a-player perfect information. Don't "fix" this asymmetry without
  replacing it with something that keeps the mechanic honest.
- **Known limitation, left as-is:** `RosterLogic.activatePlayer` (post-draft late joiner) still only
  assigns castaways nobody owns, which is unnecessarily restrictive in shared mode where sharing is
  the point. Degrades gracefully (the commissioner just has fewer options) rather than breaking, and
  the plan doesn't cover late joiners in shared mode, so it wasn't guessed at either.
- Sonnet's prediction in the previous version of this note held: a new mechanic again exposed latent
  single-mode assumptions in existing UI (`SeasonStatusCard` rendered "?'s turn to draft (pick
  undefined)" with no turn to report; Board grid and Castaways list showed only `ownerIds[0]`;
  Mid-Season's intro described removed mechanics). Expect the same for Feature C.

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

## Feature B: Pick'em — DONE

**Implemented, verified.** See README's "Pick'em" section (under "League types and shows") for the
shipped design, the BetLogic investigation's conclusion (new infra, not a thin wrapper — this
section's own hedge was right to leave that open), and the verification that was run. Notes for
future work that touches this:

- **The +1/0 scoring assumption below was never actually confirmed — still open.** Shipped as the
  default (`settings.pickemCorrectPoints`), commissioner-editable, exactly per this section's own
  instruction, but nobody has said "yes, +1 is right." Worth closing out with whoever's running
  the real league before this ships to actual players.
- A real scoring bug was caught and fixed during the build, not after: the first version scored a
  pick as "correct" the instant it was submitted, before the episode it was for had even happened
  (nothing in a future episode's `ep.events` yet to contradict it). Fixed by gating on
  `ep.events.length > 0` (same heuristic `EpisodeLogic.ensureUpcoming` already uses for "has this
  episode happened"). If Active Roster (Feature C) or anything else ever scores against
  `ep.events` similarly, check for this same class of bug.
- No privacy/hidden-state design was needed here (picks are visible in the ordinary broadcast
  `state`, same as everything else) — contrast with Feature A, where that IS the hard part. Don't
  assume Pick'em's approach generalizes to blind draft.
- A second `LEAGUE_TYPES` entry exposed several latent single-league-type assumptions across the
  frontend (nav, League Info's type-picker lock, General Settings, Players' roster badge, Season
  Status's "go to draft" copy) — all fixed as part of this feature, all gated on the new
  `hasRoster`/`hasWeeklyPicks` flags. Expect Feature A and Feature C to each surface more of these;
  grep for `StateLogic.isDraftStarted`/`currentDraftTurn`/`freeAgents`/`activeOwnedCount` call
  sites before assuming everything's already covered.

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

## Feature C: Active Roster — DONE

**Implemented and verified.** See README's "Active Roster" section for the shipped design. Notes:

- **This section's field name for the event log was wrong and had to change.** It specified
  `episode.events: [{type, castawayId}]`, but `episode.events` already exists and means
  ELIMINATIONS — it drives `placementOrder`, `EpisodeLogic.remove` walks it to un-eliminate
  castaways, and it is the "has this episode happened" signal for `ensureUpcoming` AND Pick'em's
  scoring. An "immunity win" in there would have made Pick'em score that castaway as voted out.
  Scoring events live in `episode.scoringEvents`; eliminations keep `episode.events`.
- **`teamSize` is derived, not duplicated.** `rosterSize(state)` returns
  `activeSlots + benchSlots` for this league type and every draft mechanic asks through it, so a
  commissioner can't set teamSize=3 against 3+2 slots and get an unfillable roster. The General
  Settings roster-size field is hidden for this type.
- **The lineup lock is explicit, not derived** from whether eliminations exist yet. Deriving it
  would invert the intent: the lock belongs before the episode airs, eliminations are entered after,
  so a derived lock leaves a window to rewrite a lineup already knowing the outcome.
- Per-episode lineups (rather than a current set plus snapshots) are what make retroactive rescoring
  structurally impossible. Asserted directly, in memory and over HTTP: rewriting a later episode's
  lineup leaves the earlier episode's snapshot byte-identical.
- "Replenished castaways start benched" needed no code — benched just means "not in this episode's
  lineup", so a newly assigned castaway is benched until someone fields them.
- The setup-time shared-ownership nudge is in League Info, advice only, never a block: it compares
  eligible seats x rosterSize against cast size, with a softer generic line before any cast exists.

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

## Feature D: Wiki connector — BOTH PHASES BUILT

**Phase one: cast import.** `db/wiki-sync.js` fetches a season's cast, extracts it with Claude under a
strict schema, validates it against the league, and files a pending proposal into the `wiki_proposals`
table; League Settings has the review/apply/reject UI.

**Phase two: per-episode import** (`node db/wiki-sync.js episodes <leagueId>`). Reads the vote grid and
the episode guide, extracts both in ONE model call, and files TWO proposals — `eliminations` (high
trust: a direct read of the Finish column) and `scoringEvents` (low trust: inference over rowspan-heavy
cells, footnote markers and vote arithmetic), each event carrying its own confidence. Both apply paths
are additive and idempotent.

See README's "Wiki connector" section for the shipped design of both, and for what was and wasn't
verified — including the honest finding that the eliminations half reproduced exactly across two runs
while the scoring-events half did not.

**Answers to the open questions this section left:**

- **Double/multiple-boot episodes** — still untested against a real season with one (S44 has none), but
  the data model and both apply paths handle it: eliminations are a list per episode, order within the
  list is preserved, and `placementOrder` is assigned in that order. Covered by fixture, not by real
  data.
- **Footnote numbers being season-specific** — handled by instructing extraction to match footnotes by
  ANCHOR rather than by number, which is what the "two corrections" note below established.
- **Zero-votes-safe** — extracted, and it is indeed the highest-volume event type (~50 per season). It
  is also the least reliable: validation drops any that name someone eliminated in that same episode,
  and that guard fired on both verification runs.
- **Idol finds** — deliberately NOT offerable. The value is absent from the extraction schema's enum,
  so it cannot be emitted at all, rather than being filtered afterwards. Manual-only, as recommended.

**Decisions, all the user's, two against my recommendation:** LLM extraction (not a deterministic
parser), a scheduled script (not an on-demand button), cast import first then events. Mitigations for
the non-determinism that brings: structured outputs for shape, a separate content-validation layer
that rejects a whole run rather than filing a partly-trusted proposal, and stored provenance.

**Two corrections to the investigation notes below, found when grounding the options:**

- Footnote **numbers** are season-specific (`idol` is #2 in S44, #5 in S43) but footnote
  **anchors** are semantic and recur, with verbatim-identical prose. A deterministic parser keyed on
  the anchor is more viable than the note below implies. New mechanics do appear per season
  (`votesteal`, `extravote`, `control`), so any parser must degrade on unknown anchors.
- **Zero-votes-safe is derivable from the vote grid**, not footnote-dependent as stated below: the
  grid records who each player voted for, so votes-received per castaway is arithmetic. Pre-merge it
  additionally needs tribal attendance, which the epguide's immunity column gives. This matters
  because it's the highest-volume event type (~10 per post-merge tribal) and therefore the biggest
  labour saver.

**Also newly established:** the `==Castaways==` table is inline on the season page (not a
transclusion like the vote/episode tables) and is the most structured thing on the wiki — name,
original tribe, finish, votes-against, photo filename — which is why cast import needs one page
fetch and became phase one.

---

**Original investigation findings, unchanged, below.**
**Investigation done, connector itself NOT built** (per this section's own instruction: "first
step is investigation, not implementation"). Real findings below, against real pages, via direct
`curl` against `survivor.fandom.com/api.php` — not WebFetch, which returned HTTP 402 on every
`survivor.fandom.com` URL tried (season page, api.php, Special:Search) while working fine against
other sites (Wikipedia) in the same session; looked like Fandom's bot-protection rejecting
WebFetch's request signature specifically. Irrelevant to the real connector (a standalone script
using a normal HTTP client, same as `curl` here, not Claude's own tools) but worth knowing if a
future Claude Code session tries to investigate further this same way.

**Source confirmed workable**: MediaWiki Action API against `survivor.fandom.com` — wikitext via
`action=query&prop=revisions`, not scraped rendered HTML, since it's more stable against layout
drift and closer to structured source data. Season pages exist at the predictable title
`Survivor <N>` (confirmed via `action=query&list=search`, e.g. `Survivor 44`, `Survivor 43`).

**Real structural finding the plan didn't anticipate: season pages do NOT contain the voting or
episode data inline.** `Survivor 44`'s own wikitext has `==Voting History==` followed by nothing
but `{{S44votetable}}` — a template transclusion. The actual per-player-per-episode vote grid
lives on a SEPARATE page, `Template:S44votetable`, fetched with its own `action=query&prop=revisions`
call. Same story for `==Season Summary==` and `{{S44epguide}}` → `Template:S44epguide` (the
per-episode reward/immunity/elimination table). Confirmed this naming convention
(`Template:S<N>votetable` / `Template:S<N>epguide`) holds for at least two seasons (44, 43) — a
real connector needs to know it has to make (at least) three fetches per season, not one, and
needs the season number to build the two template titles.

**Field-by-field reliability, from real Survivor 44 data** (Bruce medically evacuated episode 1 —
`{{tribebox|status|''Evacuated''}}` — with footnote prose "Bruce was evacuated due to a head
injury. No vote occurred for his removal."; Matthew quit episode 6 for a shoulder injury, same
`{{tribebox|status|''Quit''}}` pattern; five separate idol-negation events flagged across the
season, e.g. `4-0{{sup|[[#endnote idol|2]]}}`; no double-boot episode found in either S44 or S43,
so that specific case from this section's own list is still untested):
- **Episode number, air date, tribe assignments, exit method (voted out / evacuated / quit)** —
  reliably structured. The votetable's last populated cell in a player's row distinguishes a
  normal vote-received cell (`{{tribebox|<tribe>|<name>}}`) from a `{{tribebox|status|<verb>}}`
  terminal marker, consistently, across at least the two seasons checked. Good auto-suggest
  candidates.
- **Immunity/reward winners** — present and reasonably structured, but in the SEPARATE epguide
  template, not the votetable — a connector needs both. The wiki's own columns don't distinguish
  individual vs. tribe immunity as a field; that has to be inferred (pre-merge tribe columns vs.
  post-merge individual cells), which an LLM handles better than a fixed-column parser would, but
  it's inference, not a direct read. Auto-suggest candidate, flagged lower-confidence than exit
  method.
- **Idol plays, zero-vote safes** — present, but only via footnote-marker cross-referencing: a
  numeric superscript on the episode's vote-count cell (e.g. `{{sup|[[#endnote idol|2]]}}`) that
  has to be matched to prose in a `Notes:` block at the bottom of the SAME template, and separately
  cross-referenced against which specific player's cell carries a matching marker to identify who.
  Real, extractable, but a genuine multi-hop inference — and footnote numbers are page-specific
  (season 44's idol marker happens to be "2"; nothing guarantees that number means the same thing
  on a different season's page), so a rule-based parser keyed to a fixed number would silently
  break the moment it's pointed at a different season. Auto-suggest, but clearly marked
  lower-confidence / "verify this one" in the review queue, not treated the same as exit method.
- **Idol finds** (as opposed to idol *plays*) — not present in either template checked. Likely
  lives only in per-episode prose recaps or individual castaway pages, neither investigated here.
  **Manual-only** until a further investigation finds a structured source for it — don't build
  auto-suggest UI for this event type on the assumption the connector will cover it.
- **Double/multiple-boot episodes** — the plan's own suggested "messier case" — not found in
  either season checked (S44 has zero double boots; didn't dig further into S43). Untested, not
  confirmed either way. Worth checking a season known to have one (the plan doc mentions this
  possibility existing) before Feature C's UI locks in an assumption about it.

**Recommendation for Active Roster's review-queue badge, per this section's own ask**:
auto-suggested + high confidence for exit method/tribe assignments; auto-suggested + lower
confidence (still commissioner-reviewed either way, per "every extraction is a pending proposal"
below, but worth visually distinguishing) for immunity/reward winners and idol plays/zero-vote
safes; manual-only for idol finds until further investigated.

**Original plan text below, unchanged, for reference:**

**Extraction:** AI extraction of structured data (episode number, boot, exit method, tribe
assignments, and — see the investigation findings above for per-field reliability — immunity/
reward winners, idol finds/plays, zero-vote safes) from the fetched wikitext/page content.

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
2. ~~Classic Draft ownership setting + blind draft (builds directly on #1).~~ **DONE** — see
   Feature A's status note above.
3. ~~Pick'em — fully independent of #1/#2 (no castaway ownership involved at all); can run in
   parallel with either.~~ **DONE** — see Feature B's status note above.
4. ~~Active Roster — depends on #1 (`ownerIds`) and #2 (the blind-draft mechanic).~~ **DONE**
   — see Feature C's status note above.
5. ~~Wiki connector investigation~~ **INVESTIGATED**, and **cast import now BUILT**
   — see Feature D's own status note above for the per-field reliability findings. The connector
   *implementation* and its *integration* into Active Roster's event review queue are both still
   unbuilt; integration still naturally comes after #4 ships with manual entry working
   end-to-end.

Commit and verify each numbered item independently, matching this repo's existing convention (one
feature, build+lint+real-API-check, one commit) — not as a single giant change.

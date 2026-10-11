# Late joiners ("ghosts"): joining a league that's already underway

**Status:** Built 2026-10-11, not yet committed. Resolves BACKLOG's "Members joining a started league".
UX pattern chosen with `/impeccable shape` (the user pre-accepted its choice): **"Replay feed"**, below.

## What the user asked for

- Someone can join an ongoing league late, start at **any episode**, and play forward **one episode
  at a time without spoilers**; or **jump to current**.
- The commissioner allows it. **By default late joiners are ghosts:** the rest of the league can't
  see them until the commissioner converts them. Some never get converted, and that's fine.
- A ghost's own view looks normal, as if playing in real time; they see themselves on the scoreboard.
- Above all: a late joiner must never **accidentally** get further into the season than they meant to.
- "Are you sure / have you watched episode N?" confirms, saying a reveal spoils it.
- Late joiners who are behind **can't submit predictions** (side bets, finale): there's no fair way to
  predict an episode the rest of the league has already graded.

## The model

Two flags on the player (`state-logic.js`, `GhostLogic`):

- `ghost: true`: invisible. Stripped from every other viewer's copy of the league. Their team is
  private, so it takes nothing off the board: exclusivity checks use `leagueOwnersOf` (owners minus
  ghosts), and `Core.setOwner` keeps ghost owners when the league reassigns a castaway. They sit out
  the draft order, blind-draft lock-ins and pickup/swap rounds (`inLeagueRotation`).
- `lateJoin: { startEpisode, catchingUp, seenThrough }`: their own season. `startEpisode` is null
  until they choose it and draft. `catchingUp` stays true while their spoiler mark
  (`league_memberships.results_seen_through`) is behind the latest results. `seenThrough` mirrors that
  mark into state, so the commissioner can see progress. It stays set after conversion.

`settings.allowLateJoiners` is **on unless explicitly false** (it covers old leagues). When it's off,
joining an underway league gives the old inactive seat that the commissioner activates.

### The spoiler guarantee: the league ends at their week

`GhostLogic.viewFor(state, viewer, seen)` is the one projection every screen reads (the store's
`views()`):

1. Strip every ghost except the viewer.
2. The usual `SpoilerLogic.viewThrough` at their mark.
3. For a late joiner who is catching up, `rewindTo(seen)`:
   - Episodes after `seen+1` are removed: no results, no titles, no numbers past their week.
   - Their week (`seen+1`) loses its air time and lock, so lineups and picks open "as if it airs
     tonight". Its title is hidden too, since a title can give the episode away.
   - Pickups and swaps logged after their mark are undone (a pickup implies someone left).
   - League catch-up mode is switched off in their copy (its pointer says how far the season has run).

Because their `fullState` also ends at their week (with only that week's results kept, for the
reveal), the existing banner, Reveal sheet and `/reveal/N` page can only ever offer **one** episode.
Even a hand-typed `/reveal/13` clamps to their week.

The server holds the same line:

- `POST results-seen` refuses to move a catching-up mark by more than one, unless `jump: true`.
  Their reveal doesn't propagate to linked leagues or post a chat line.
- Lineups and Eliminator Pool picks run through `GhostLogic.applyAs`. The move is validated and
  applied against *their view*, then only their entry is copied back to the real episode. Any
  episode other than their week is refused.
- Side bets and finale predictions are refused while catching up (`refuseWhileCatchingUp`).
- Chat is closed to ghosts and to anyone catching up (GET returns nothing; POST is 403). Ghosts are
  left out of "Read by".
- Pushes: nobody hears that a ghost joined. Commissioners hear when a late joiner has started. League
  broadcasts skip anyone catching up. Episode results include caught-up ghosts.
- `actionItems` (the action bar and reminder job) gives a late joiner only "Choose where to start",
  then nothing while catching up, since those checks read the real latest episode.

Scoring: a ghost's points start at their own start episode (`GhostLogic.startFor`). Active Roster
scores per-episode lineups (they have none before their start). Classic draws only from castaways
still in at their start. Eliminator Pool history starts at their episode.

## The UX: "Replay feed"

The late joiner's app *is* the normal app on a time-shifted clock. One broadcast element marks the
difference:

- **The bug** (`late-join/replay-bug.tsx`): `● REPLAY | EP 4` while catching up, `○ OFF AIR` for a
  ghost who's caught up. On a phone it takes the header's chat slot (they have no chat); on desktop
  it sits above the page. Tapping it opens the **catch-up sheet**: a progress strip (watched / this
  week / to come), what's happening, and **Jump to the latest episode**. That asks a second time:
  "Jump to episode 13? This reveals episodes 5 to 13 all at once…", with **Keep catching up** as the
  primary action and **Reveal through 13** in red.
- **The weekly loop** reuses the results banner: "Watched episode 4? Make your picks, watch it, then
  reveal it." The Reveal sheet becomes **"Have you watched Episode 4?"**. It explains what revealing
  shows and that it can't be undone, warns if their lineup or pick for it isn't set, and confirms
  with "I've watched it". "Reveal first" gates (lineup, pick, Overview grids) don't apply to them:
  their hidden episode *is* this week (`useHiddenResults().blocksChoices`).
- **Starting** (`/late-join`, full screen; AuthGate redirects there until they've started):
  1. "Where do you start?" lists episode numbers only (no titles), from "From the start" to "Live,
     with the league".
  2. "Draft your team": tiles of the cast as it stood before that episode. Anyone can be picked,
     whoever else owns them. League types without a draft skip this step.
- **Commissioner** (Players & invites → Late joiners): a "Let people join late" toggle, then one row
  per late joiner with an OFF AIR / REPLAY chip and where they are ("Started at episode 4 · on
  episode 5 of 13"). Their ⋯ sheet has **Add to the league** and Remove.

## Decisions and known limits

- **Exclusive ownership:** a ghost may own a castaway someone in the league also owns. On conversion
  that castaway stays shared between them: the one place exclusivity bends.
- **Converted while still behind:** they keep catching up one episode at a time (the projection
  follows `lateJoin.catchingUp`, not `ghost`). They're visible to the league meanwhile.
- **Ghosts don't take part in pickups or swaps.** A ghost's roster can run down over a long season;
  converting them brings them into later rounds.
- **Not a secret, a courtesy:** like spoiler protection, the client still receives the raw league
  state. Ghosts are hidden on every screen and in every push, not from the network tab. That matches
  the app's existing trust model (friends' leagues).
- The jump doesn't play the reveal broadcast. It moves the mark and reloads.
- What's New entry: not written (the user approves those).

## Verified

- `tests/late-joiners.test.js` (14 tests; Classic and Eliminator Pool added 2026-10-11): joining makes a ghost; the setting off restores the old
  seat; draft pool as of the start; begin's validation; ownership kept through the league's own moves;
  others' view strips the ghost; the ghost's view ends at their week with that week open; `applyAs`
  accepts their week and refuses others; scoring from their start; caught up and convert; pickups
  after their mark undone. Full suite: 274 pass.
- End to end in headless Chromium at 390×844 on a copy of the local "S49 Active Roster" league (13
  scored episodes) with throwaway accounts `ljcomm` / `ljghost` (torn down after, no orphans):
  join by code → redirected to start → start at 4 and draft 5 → Overview, Episodes (ends at 4),
  Scoreboard (sees self) → lineup for episode 4 accepted, episode 9 refused, skipping the reveal to 7
  refused → "Have you watched Episode 4?" → reveal → on episode 5 → catch-up sheet → jump confirm →
  commissioner's scoreboard has no ghost, Players lists them → jump to 13 → no longer catching up →
  Add to the league → the league sees them. Scripts: the session scratchpad (`lj-setup.js`,
  `lj-browser.js`, `lj-teardown.js`), not kept in the repo.

## Classic and Eliminator Pool (verified 2026-10-11)

- Unit tests: Classic drafts a full team from who was left and scores their placements; Eliminator
  Pool skips the draft, its pick lands on the real episode, the cycle and back-to-back rules follow
  only their own picks (checked against who was still in at their week), and their streak starts at
  their start episode.
- End to end at 390x844 on copies of "Last Survivor Standing" (Classic) and "Avoid Elimination
  Streak" (Eliminator Pool), throwaway accounts `ljtcomm` / `ljtghost`, torn down after: join by code
  -> start at 2 (and draft, Classic) -> Episodes ends at 2 -> pick for 2 lands (Pool) -> sees self on
  the scoreboard -> "Have you watched" -> reveal -> caught up -> commissioner's scoreboard has no
  ghost -> Add to the league -> the league sees them. No page or server errors.
- **Open question (Classic fairness):** Classic scores finishing position, and a late joiner drafts
  only from who's still in, so they can't hold an early boot and will tend to out-score anyone who
  drafted on day one. Fine while they're a ghost; matters once a commissioner adds them. Not decided.

## Linked leagues (fixed and verified 2026-10-11)

Linked leagues share one reveal and one chat (league-groups.ts), which crossed the late joiner's line:

- **A reveal elsewhere no longer moves their mark.** Someone who's an ordinary player in league A and a
  late joiner catching up in linked league B: revealing episode 6 in A used to set B's mark to 6 too,
  skipping their catch-up. results-seen now leaves out any linked league where they're catching up
  (`catchingUpIn`, late-join.ts); only their own reveal in B moves B's mark.
- **The shared chat.** "Read by" now leaves out anyone who's a late joiner in every linked league
  they're in (`outOfGroupChat`), not just the league being viewed; a late joiner's chat read is skipped,
  so they never get a chat_reads row. Chat pushes use the same rule, so someone who's a late joiner in
  B but an ordinary player in A still hears A's conversation (they read it through A).
- Accepting a linked league's invites ("Accept all") joins through joinLeague, so an underway league
  makes a late joiner as usual; each league's catch-up is its own.
- Verified against the dev server and the local database with two linked copies of "S49 Active
  Roster" and throwaway accounts (one mixed, one ghost only), torn down after. With the fixes out,
  five checks fail (B's mark jumped to 6); with them in, all pass.

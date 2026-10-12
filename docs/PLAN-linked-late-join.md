# Plan: linked leagues, one answer and one catch-up

**Status:** Decided 2026-10-11 (with `/impeccable shape`). **Built 2026-10-11, awaiting review/commit**
(see "As built" at the end).

How far someone has watched is a fact about them and the season, so it's asked once per linked group
(`league-groups.ts`), never once per league. Today each linked league runs its own late-join step, keeps
its own spoiler mark and catches up separately (`src/lib/server/late-join.ts` deliberately leaves a
catching-up league out of the group's shared reveal).

## Decisions

- **Joining several linked leagues late at once** (e.g. "Accept all" invites): the "Which episodes have
  you watched?" step (`src/components/late-join/late-join-flow.tsx`) gets one line under the heading:
  "This sets where you start in all 3 linked leagues: A, B, C." The strip, footer readback and "Start
  somewhere else" apply to the whole group. Then the drafts follow in sequence, one per league with a
  draft ("Draft 1 of 2 · A"), with the progress ticks counting them. Leagues without a draft add no step.
- **Joining a linked league late while already playing another in the group:** don't ask. Their mark
  there is the answer. Open with the strip prefilled to it and the footer saying "Same as in A: you've
  watched episodes 1 to 6. You'll start at episode 7." Button ready; "Start somewhere else" still works.
- **"Start somewhere else" in a group sets the start for every league in the group** (confirmed).
- **Catch up together:** a late joiner's leagues in one group share one mark. Revealing an episode in any
  of them moves all of them; "jump to the latest" moves all. The REPLAY bug shows the same episode in each.
- **Exception:** a linked league whose own first episode is later just starts there (the existing
  "This league starts there." footer note).
- Each league keeps its own team and draft.

Server: the `late-join` and `results-seen` routes and `catchingUpIn` need group-aware handling. Verify
with two or three linked clones of a league (see `PLAN-late-joiners.md`, "Linked leagues", for the
earlier fix and how it was tested). 390px first.

## As built (2026-10-11)

- **Server.** `GET /api/leagues/[id]/late-join` returns the person's linked group in the group's order
  (`lateJoinGroup`, late-join.ts): each league, whether it's still waiting on a start, and their mark
  where they're already playing. `POST` is unchanged (one league per call); the flow calls it per league.
- **One mark.** `revealAcrossGroup` (late-join.ts) replaces `catchingUpIn`. After any reveal, each other
  linked league they're in follows: a catching-up one only when it was at the same mark (in step), one
  episode, or to its latest on a jump; anywhere else forward to n as before. So the earlier guarantee
  holds: a reveal in A can't move B past the week they've watched in B unless B was at the same mark.
- **Flow** (`late-join-flow.tsx`). Loads the group first. Other pending leagues' states are fetched for
  their drafts. Steps: the answer, then one draft per league with a draft ("Draft 2 of 3 · B", the header
  names the league being drafted, the button "Next: draft for B"). "Begin" starts each league in group
  order; one that fails can be retried without restarting the ones that went through. Each league's
  start goes through `startIn`: the same episode, or that league's own first episode if later.
- **Prefill.** Already playing linked leagues: the lowest mark among them (never assume more), with the
  footer "Same as in A: you've watched episodes 1 to 5. You'll start at episode 6." Tapping another
  row drops it back to the ordinary readback.
- **Verified** at 390px against the dev server with three linked clones of "S49 Active Roster" and two
  throwaway accounts (17 checks: the linked line, 1 of 4 progress, three drafts in sequence, all three
  start at 4, a reveal in B moving all, no skipping ahead, a jump in C catching up all three, the
  prefill from A and that reveal in A moves B). Fixtures torn down after.

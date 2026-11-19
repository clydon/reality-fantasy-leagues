# A draft that waits for whoever runs the game (Intent)

Round 5 of the game preview lane (2026-11-19). The user, on the preview's first slice: "we should fix the unstarted draft. the user
or game runner should have that more prominently shown... maybe as a game-runner-only component? idk, go with the best UIUX
decision." The bug, as the bench found it: docs/PLAN-game-preview.md, "Noticed, not fixed", 1.

## The problem

A game with a draft that has no time set doesn't start until whoever runs it presses Start. A draft with a time starts by itself
then (state-logic.js draftTimeCame), and a later stage's draft can't start until the results before it are in (DraftLogic.waits).
So the unscheduled one is the trap. Until it starts, nobody can pick, and the game's first episode comes closer. Today:

| Surface | Whoever runs it sees | Everyone else sees |
| --- | --- | --- |
| The strip, under the show bar on every show tab but Chat (strip.tsx) | "All set for Ep 9" | "All set for Ep 9" |
| The hub's plate for the show (hub/sections.tsx) | "All set for Ep 9" | "All set for Ep 9" |
| The game page's strip (game-page/model.ts stripOf) | "All set · Nothing to do before Ep 9" | the same |
| Backstage, Needs you (backstage.ts) | "Schedule the Fantasy league draft" | nothing |
| The draft room (draft.tsx WaitingCard) | "Start it when everyone's in", Pick a time, **Start the draft now** | "Not started yet · whoever runs the game starts it" |

The one place that says the draft waits for its runner is two levels down in Backstage, and the strip, which every show tab
shares, tells them they're all set. Everyone else is told the same, though they have no team yet.

## Who, and in what situation

- **Whoever runs the game** (its Commissioner: the room's Start needs that role, draft.ts requireCommissioner). Usually they've just
  made it and gone back to Tonight, or they come back days later. They expect the app to say what's next, as it does for a lineup.
- **Everyone else in it.** Nothing to do until the draft starts, but they need to know a draft is coming, and who it waits for. "All
  set" hides both.

| Situation | Whoever runs it | Everyone else |
| --- | --- | --- |
| No time set, the draft could start (a cast, two seats or more, not waiting on results) | **Due: Start the draft** | Waiting for them, by name |
| A time set, not reached | The draft's time (it starts by itself) | The same |
| A later stage's draft waiting on results (DraftLogic.waits) | When it opens, in the engine's words | The same |
| Started | The draft's own move (Lock in your draft picks, Your turn to draft), as now | The same, as now |
| A game at your own pace drafting together (pace-plate.tsx) | Its plate, as now (it has its own Start) | Its plate, as now |

Left out, and why: a runner alone in the game or without a cast is Backstage's (Invite people, Add the cast) and comes before a
draft can start; a push to the runner is the reminder job's (not REMINDABLE; a later step, in "Still open").

## The flow

```
any show tab ─ strip: Draft │ Start the draft │ Nobody can pick until you do ─tap→ the draft room
the hub ─ the show's plate: Draft │ Start the draft │ Fantasy league ────────tap→ the draft room
the game page ─ its strip: Draft │ Start the draft ───────────────────────────tap→ the draft room
the draft room ─ Start the draft now (or Pick a time) → started: the strip says the draft's own move
```

1. **The strip** carries it, because it's "the show's one statement of what's yours to set" and sits in the same place on every
   tab: starting the draft is the runner's to set. Due, so the view's one yellow, tagged **Draft**. It leads the strip, like a draft
   turn: everyone waits on it.
2. **One tap opens the draft room, never the start itself.** Starting opens picking for everyone and pushes them; the room shows
   who's in and offers a time instead. Starting from the strip would skip both (error prevention over recovery).
3. **The room** already leads with Start the draft now (the yellow button) and Pick a time beside it. Its line tells the runner
   why it's theirs: "Everyone's waiting on you · start it when everyone's in".
4. **After Start**, the strip turns into the draft's own move from the next read (Lock in your draft picks; Your turn to draft; or
   nothing yet, someone else on the clock), as it does today once a draft is on.

**Not a separate component for the runner.** A "you run this game" card beside the strip would make two statements of what's
yours, competing for the one yellow. The runner's job goes through the same strip as everyone's moves, worded as their job.

**What everyone else sees** instead of "All set": the same strip, quiet (no yellow, nothing asked of them), tagged **Draft**:
"Waiting for Riley to start the draft", line "You pick your team when it starts". A time set: "The draft starts Wed 8 PM". Tapping
opens the draft room, whose waiting card says the same, with the runner's name for "whoever runs the game".

## One rule, where the engine keeps it

When the draft is the runner's to start is the engine's: `runnerItems(state)` in src/lib/game/action-items.js, beside actionItems,
one item `draftStart` when a game with a draft (draft-view.ts draftKind: a turn-based, blind, draw or auction draft) hasn't started,
has no time set, isn't waiting on results (DraftLogic.waits), has someone active to draft and two seats or more. Read by:
- the new design's home (/api/me/home), as one of your moves in each game you run, so the strip, the hub's plate and the game
  page's strip all have it from the moves they already read;
- the bench's due check (tools/gameplay-bench/preview/preview.cjs engineDue), for a viewer who runs the game, so the check that
  each screen says what the engine says is due covers the runner too, and its separate "start" check goes.

Not read by actionItems itself, so the classic action bar (which lists "Draft not scheduled" from commissioner-items.ts) and the
hourly reminders read exactly what they did.

## Copy

| Where | Tag | Title | Line |
| --- | --- | --- | --- |
| Strip, the runner | Draft | Start the draft | Nobody can pick until you do (· the game's name when two games here have one) |
| Strip, everyone else | Draft | Waiting for Riley to start the draft | You pick your team when it starts |
| Strip, a time set | Draft | The draft starts Wed 8 PM | It starts by itself (the runner) · You pick your team then (everyone else) |
| Strip, a stage's draft waiting on results | Draft | The draft opens after Ep 11's results | Nothing to do till then |
| The hub's plate, the runner | Draft | Start the draft | Nobody can pick until you do · Fantasy league |
| The game page's strip, the runner | Draft | Start the draft | Nobody can pick until you do |
| The game page's strip, everyone else | Draft | Waiting for Riley to start the draft | You pick your team when it starts |
| The draft room, the runner | | (Blind draft / The draft) | Everyone's waiting on you · start it when everyone's in |
| The draft room, everyone else | | | Not started yet · Riley starts it |

"Riley" is the game's Commissioner's name (two: the first). "Draft" is the game's own word for it.

## How we'll know

- The bench's due check agrees at the draft for the runner before Start (the strip due, the engine's runnerItems listing it), and
  for everyone after it, in every preview with a draft.
- No strip says "All set" in a game whose draft hasn't started.
- Taps from any show tab to Start: two (the strip, then Start the draft now).

## Decisions

1. The strip, not a separate runner-only component: one statement of what's yours (the strip's own rule); the runner's job worded as
   theirs.
2. The strip opens the room; it never starts the draft (the room shows who's in and offers a time).
3. Everyone else: quiet and named ("Waiting for Riley"), never yellow (nothing's theirs) and never "All set" (they have no team).
4. The rule lives in the engine beside actionItems and is read by the new design's home and the bench; the classic bar and the
   reminders stay as they were.

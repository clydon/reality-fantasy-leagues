# Step 9 Chat: Impeccable critique (after frames, 390 px)

DEGRADED: single-context (a light review asked for; already running as a sub-agent). The design review was finished before the
detector ran. No browser overlay: the review used the committed renders in `.ui-atlas/stories/step9-chat/`, not a live page.

Frames: `after/chat-alex.jpg` (caught up), `after/chat-sam.jpg` (2 behind, fold), `after/watchonly-riley-chat.jpg` (watch only,
1 behind), checked against `before/` versions. Source: `src/new/show/chat.tsx` (`itemsOf`, `Fold`).

## Heuristic scores

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 3 | Landmarks and the fold's count say where you are; empty landmarks blur it |
| 2 | Match with the real world | 3 | "Show them" is vague about the risk; mixed airing formats |
| 3 | User control and freedom | 3 | Unfolding lasts the whole visit and can't be undone |
| 4 | Consistency and standards | 2 | The fold has different actions and copy for players and watch-only viewers |
| 5 | Error prevention | 2 | The spoiling action has the same weight as the safe one, with no warning |
| 6 | Recognition rather than recall | 3 | The nearest EP chip above answers "which episode is this about" |
| 7 | Flexibility and efficiency | 3 | Long press to react, earlier messages, GIF; fine for a chat |
| 8 | Aesthetic and minimalist design | 2 | Too many dividers for the number of messages (Alex: 7 separators for 5 messages in view) |
| 9 | Error recovery | 3 | Failed sends and reactions toast "Not sent: …" |
| 10 | Help and documentation | 3 | The fold's line explains itself ("They unfold when you've seen it") |
| **Total** | | **27/40** | Acceptable, at the top of the band; one batch of fixes from Good |

**Specificity:** authored, not generic. The EP chip with its slanted cut is the Lower Third episode form placed in the stream.
Grouped reveal lines ("riley and jordan revealed Ep 4") halve the old noise. The yellow stays out of chat. The structure is right.
The faults are in the details: what the dividers weigh, and what the fold offers.

**Detector:** 8 advisory findings, all `design-system-font-size`. 14px appears 7 times (lines 234, 250, 358, 361, 401, 407, 411)
and 12px once (line 344), neither on the DESIGN.md ramp (11/13/15/16). No pattern bans fired. The review agrees: this is real but minor.

## Findings

**[P1] The fold gives the spoiling choice equal weight with the safe one.** Frames: chat-sam, watchonly-riley-chat.
In Sam's fold, "Reveal Episode 4" and "Show them" are two identical half-width outlined buttons. One tap on Show them unfolds
Ep 4 talk for the rest of the visit, with no warning. Riley's fold offers *only* Show them. The safe "I watched Ep 3" is up in the
strip, which has scrolled out of sight in a longer stream. Fix: give every fold the same anatomy. The safe action comes first, full
width (Reveal Episode N for a player, I watched Ep N for a watcher, the same action as the strip). Show them becomes a quiet
underlined text link that names the risk: "Show them anyway (may spoil Ep 4)".

**[P2] Empty landmarks: episode chips with nothing under them.** Frames: watchonly-riley-chat, chat-sam. Riley sees EP 2 and EP 3
stacked with nothing between. Below Sam's fold, EP 5 sits between Sam's own message and a reveal line and frames no talk. The fold
says "since Episode 4" while the episode markers carry on beneath it. Fix in `itemsOf`: emit an `ep` item only when a visible message
or the fold follows before the next landmark. Merge a run of empty airings into the last one ("EP 3 · aired Tue 9:00 PM"). After
the fold, hide landmarks whose messages all sit inside it.

**[P2] Day dividers are drawn too heavily, and some exist only for a reveal line.** Frame: chat-alex. Each day divider is a full
caption-caps label with a rule on both sides. FRI, NOV 6 and FRI, NOV 13 exist only to hold a one-line reveal note, so the EP chip
is no longer the only strong marker in the stream. Fix: a reveal line doesn't open a day divider. Put the day in the line instead
("Fri · riley and jordan revealed Ep 4"). Make the day divider muted 11px body (not caption caps), or shorten its rules, so the
EP chip stays the strongest marker in view.

**[P3] Airing times use two formats in one stream.** Frame: chat-alex. "EP 4 aired Nov 5" next to "EP 5 aired Thu 8:00 PM"
(`airedAt` switches to a weekday within the week). The landmark replaces that day's divider, so it should always give the date.
Fix: one format, the day divider's ("aired Thu, Nov 12 · 8 PM").

**[P3] The avatar's initial and the name come from different fields.** Frames: all. Every face reads "Z", because `Avatar` takes its initial from `usePerson`'s
name (the `zt-` fixture name) while the bubble shows `m.name` ("riley"). The fixture caused it, but the same mismatch would show
for any real person whose profile name differs from their chat name. Fix: pass the name the bubble shows to the face too, then re-run
the census so the frames show distinct initials.

**[P3] Font sizes off the ramp.** The detector's 8 findings above. Fix: move 14px to 13 or 15 (the fold title, its buttons, the EP
chip) and 12px to 11 or 13. If 14 is meant to stay, add it to DESIGN.md.

## Through the couch's people

- **Joanna** (behind, opens after the episode): with Show them on equal terms, she can spoil herself by accident (P1).
- **Andrew** (taps a push, reads one): lands at the newest message. Fine.
- **Conor** (scrolls back): the landmarks work. Empty EP chips and dividers that hold only a reveal note slow his scan (P2s).

Questions skipped: running as a sub-agent with no way to ask the user. The caller relays these findings.

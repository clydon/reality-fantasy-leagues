# The victory lap (sports-couch C3): the check and its one batch (step 4)

The built screens at 390 (story-victory-lap.js's frames in `.ui-atlas/stories/victory-lap/after/`: Jordan's card after the Giants'
win, in Studio, the game sheet's ask, the lap sheet's pick, say and posted, This week after; Sam's game sheet, room thread and hub;
Casey hiding scores and after Show records; alex's rivalry win, Not this time and the sheet's quiet link; Riley, who lost), checked
once by PFD's `evaluate` (against [victory-lap-first-view.md](victory-lap-first-view.md)) and Impeccable's `critique` (a design review
and the detector, run apart). Every finding below was fixed in one batch, or is listed as open.

## PFD evaluate (once)

Foundation 80 · L1 78 · L2 74 · L3 84 · L4 86. No yellow on any lap card (the sheet's Post it is its own view's one); the card is 120 px
and the rivalry still starts in the first view; two taps from the sheet to post; nothing about a lap for Casey until she shows the week.
The corpus's "rebuild the top fixes as HTML in the plugin's folder" step wasn't run: the fixes were made in the app and re-shot.

| # | Severity | Layer | Finding | Fix |
| --- | --- | --- | --- | --- |
| P1 | Major | Foundation, R1 | The card measured 128 px (the house button's 52 px height beat the card's 44). | The ask's button at 44 px: 120 px. |
| P2 | Major | L2, R3 | Victory laps said itself twice: the section's label and the lap tag beside it. | The label alone, with the trophy. |
| P3 | Minor | L2, R3 | The posted preview put the tag at the result's right; the room puts it above. | The room's form in both. |
| P4 | Minor | L4, R5 | The sheet's ask read "Giants won. Take a victory lap? You called it." over a "Take a victory lap" button: the ask twice. | "Giants won · You called it" over the buttons. |

## Impeccable critique (once: a design review and the detector, run apart)

**Design review:** the result leads (the team's mark and "Giants won" in the caption type, the score in the number type), the ask is the
ink button, never the chyron; the lap looks the same in the room, on the feed and on the sheet (tag, result, GIF whole, line). Nielsen
31/40 (status 4, real world 3, control 3, consistency 3, prevention 3, recognition 4, flexibility 2, minimalism 3, recovery 3, help 3).
**Detector:** exit 0, 0 anti-patterns; seven advisory font-size notes (12, 14 and 20 px: the house sizes C1 and C2's cards use; DESIGN.md's
ramp to update, not this file). The frames' words: no overlaps (overlaps.json empty, once the dev server's badge was kept out of frames
taken after a navigation).

| # | Severity | Finding | Fix (one batch) |
| --- | --- | --- | --- |
| C1 | Major (found shooting) | Posting closed the sheet before it could say Posted: answering the lap took the card away, and the sheet inside it with it. | The sheet holds its lap once opened and stays at one place in the tree (card and sheet prompt both). |
| C2 | Major | On the game sheet the ask sat on a card panel the same colour as the sheet: invisible, it read as a stray indent. | Flush on the sheet. |
| C3 | Minor | (P2, P3, P4 above.) | |

## The confirming look (once)

The whole story re-shot: every scripted check passes (21), no overlaps; the card 120 px; the sheet stays open on Posted; the sheet's ask
flush; one Victory laps label.

## Open (not chased)

- **"You called it" twice on This week:** the lap card's line and, below it, the call row's "You called it". The card is the fan's moment
  and the row is the couch's call; folding them is a choice for the user (below in the story).
- **The where-it-goes line** names the league by its slug's words in the stand-in world ("Zt Scf"); the real NFL reads "NFL".
- **The fixture's names** are usernames (zt_nd_jordan); real couches read "Jordan".
- **A co-fan's "Casey took one"** is built but not shot: the stand-in couch has one fan a team.
- **Noticed, not fixed (C2's):** the hub feed says "zt_nd_jordan started a zt_nd_jordan's call · Game 12 · tap to join": a fan's call
  game shows as a started game. BACKLOG.

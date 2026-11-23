# The lone fan (sports-couch C2): the check and its one batch (step 4)

The built screens at 390 (story-lone-fan.js's frames in `.ui-atlas/stories/lone-fan/after/`: Jordan's call to make, Casey with nothing
to back, the call made, Sam with his own call and Jordan's to back or fade, Sam's fade, Jordan's call standing, the Giants' page as
Jordan and as Sam, on now with two watching, the game sheet's I'm watching, over, over while hiding scores and after Show records, the
fan card after the final, Studio), checked once by PFD's `evaluate` (against [lone-fan-first-view.md](lone-fan-first-view.md)) and
Impeccable's `critique` (a design review and the detector, run apart). Every finding below was fixed in one batch, or is listed as open.

## PFD evaluate (once)

Foundation 78 · L1 80 · L2 76 · L3 82 · L4 84. One yellow a view in every frame (the fan's own call, or the page's Play the next game;
none once his call is made); a call is one tap in place; nothing about a result shows while hiding.

| # | Severity | Layer | Finding | Fix |
| --- | --- | --- | --- | --- |
| P1 | Major | L2, R3 | The fan card's ticks: a wrong call (outlined, muted) and this week's open call (outlined, ink) read as the same mark at 8 px. | A wrong call is a muted fill; open stays the hollow ink outline; right the good teal; no call a faint dash. |
| P2 | Minor | Foundation, R1 | The team page's call row repeated "calls 9–1" just under the fan card's big 9–1 (team-fan). | The row on the team's page drops the record (`bare`); This week's rows keep it. |
| P3 | Minor | L3, R4 | The backing counts read "1 back · 1 fades": a noun and a verb. | Both verbs, agreeing: "1 backs · 2 fade". |

## Impeccable critique (once: a design review and the detector, run apart)

**Design review:** the voice reads first on every row (a face, the name, the bold side), the couch's answer under it in C1's sides
language, the result line in the caption type, the only display-type line. The fan card reads as standings (won–lost big, a tick a
game), not a hero metric. Nielsen 30/40 (status 3, real world 3, control 3, consistency 4, prevention 3, recognition 3, flexibility 2,
minimalism 3, recovery 3, help 3). **Detector:** exit 0, 0 anti-patterns; eight advisory font-size notes (14 px and 17 px: the house
sizes the league page and C1's card already use; DESIGN.md's ramp to update, not this file). Its scan of the frames' words: no overlaps
(overlaps.json empty).

| # | Severity | Finding | Fix (one batch) |
| --- | --- | --- | --- |
| C1 | Major | Back and Fade truncated the verb's partner and, picked, read "Fading zt_nd_jor…" (spectator-faded): with a long name the button lost what it does. | A name of more than nine letters leaves the buttons ("Back", "Fade"; the line above names whose call it is); a short one stays ("Back Andrew"). |
| C2 | Minor | The game sheet's On the couch row named the call game twice ("zt_nd_jordan's zt_nd_jordan's call") and offered Join, a plain join with no pick. | A rivalry's or call's game says its own name, and its action says what you'd do on its card ("Back or fade", "Pick a side"), which it opens (couch-joins.ts `picked`). |
| C3 | Major (found building) | Backing a call, or picking a rivalry's side, joins its game, and joining sent every member "New league member … joined" (C1's too: its check counted only the challenge). | A game of public picks never announces a joiner (join-league.ts): the challenge stays the only push. |

## The confirming look (once)

The whole story re-shot: every scripted check passes (15), no overlaps; the ticks tell wrong from open; the team page's row without the
record; "1 backs · 1 fades"; Back · Fade whole. C1's story-rivalry.js re-run on the changed join and rivalry check: its 13 pass.

## Open (not chased)

- **Play the next game is yellow again once the fan has called** (team-fan): it's another game (a Pick'em for the couch) on the same
  game; after a call it may be one too many asks. A choice for the user (below in the story).
- **The follow line and the fan card both say whose team it is** ("You follow them", "Your team on the couch"): the follow line carries
  Make it your team and the league link; folding them is a head restructure, B2's.
- **The fixture's names** are usernames (zt_nd_jordan, 12 letters): real couches read "Back Andrew". The caption type uppercases them.
- **The made-up history** (Jordan's ten earlier calls) is written straight into the fixture's rows and stamped final, because past
  episodes refuse answers (rightly) and the stand-in world doesn't run the app's final reads.

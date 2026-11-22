# The league card in Your shows (sports-couch A2): the check

2026-11-22, the `sports-couch` lane. DESIGN-PROCESS.md step 4: PFD evaluate and Impeccable critique on the built card, once each,
then one batch of fixes. The frames are real renders at 390 (`.ui-atlas/stories/hub-league-card/after/`, story-hub-sports.js).
The brief is hub-scorebug-shape.md, "The league card in Your shows" (Impeccable's shape step, already done).

## PFD evaluate (Mode 1)

Loaded: the Tier 2 template, the layer rubric, the constitutional constraints, the psychology reference, the anti-patterns, the
learnings index, the output schema, one anchor's scores (good) and the heuristic rules' names (searched for this component, not
walked rule by rule: a 72 px card, not a page). The template's HTML rebuild of the top fixes was skipped: the fixes are copy and
behaviour on the real card, rebuilt there and reshot.

**Context.** Audience: a couch of friends on phones; the hub is their way in (Joanna forgets, Andrew drives by, Conor tinkers).
Intent: know at a glance which leagues the couch is into and what's going on there, without repeating the scores strip above;
open the league. Not a conversion surface: a quiet index card. Design system: the app's Lower Third tokens on Tailwind (100).

| Layer | Score | |
| --- | --- | --- |
| Foundation | 82 | Three chunks (league and week, the marks, one line), well inside 3-5 (Cowan 2010); 72 px, one tap target; off-season collapses to one line (progressive disclosure). Minor: five 4-letter marks plus "+1" and a chevron is the row's densest moment. |
| L1 First impression | 74 | Reads as subordinate to a show band in the first glance (no art, panel tone, smaller caps): the brief's "a smidge subtler" holds (Lindgaard 2006: density and tone are what's read first). |
| L2 Fluency | 76 | One family, the app's caps for names and the week, tokens only; your teams ringed as your face is on a band (Wertheimer 1923, similarity). Minor: the chevron is on the card but not on bands, which open on the same tap (Clark 2013: a prediction the bands don't keep). |
| L3 Perception | 62 | Major: the line can read "Predictions · Game 1: 3 playing", the engine's name for a sports Pick'em, which says little (Reber & Schwarz 1999: disfluent words read as less credible). Minor: "Nothing on the couch here yet" (where is "here"?). Minor: a daily sport's "Week 5" is the app's cut, not how NBA fans count (Clark 2013), though it is how the app's NBA games are named. |
| L4 Decision | 58 | Major: the due dot promises your move, but the tap opens the league's week, which doesn't show that move (Pirolli & Card 1999: the scent breaks). Minor: an off-season card opens a sheet that says only "No games this week". |

Overall (Foundation ×1.5): **71**. No caps apply. Spread 58-82.

**Top fixes.**
1. *L4, the due dot's scent:* either the tap leads where the move is, or the destination shows it. The brief keeps the tap on the
   league (until B1, whose This week leads with "the strip's due move"); so the league sheet should show your games there, first.
2. *L3, the line's words:* name a sports game by what it is to the person ("Pick'em"), and say plainly when nothing's going.
3. *L2, the chevron:* drop it (a band has none and opens on the same tap), or keep it as the one cue that this opens a sheet, not
   a page.

## Impeccable critique

Method: dual-agent (A: a design review, B: the detector and render measurements), isolated from each other and from the PFD read.

- **Health (A):** Nielsen 20/32 (two n/a): status 3, real-world match 2, control 3, consistency 2, recognition 3, efficiency 2,
  minimalism 3, help 2. Specificity: "on-system but generic", a settings-list row beside a broadcast band.
- **Detector (B):** 0 findings in league-cards.tsx; 4 advisory font-size findings in older code (parts.tsx, bands.tsx), none in
  the change. Contrast of the muted line and the week: 6.68:1 (Night), 6.41:1 (Studio). Card 358 × 72 (off-season 358 × 48).
- **Priority issues:** (1) the due dot opens a sheet whose yellow starts a new game, with no way to the move (A; PFD's L4 too);
  (2) the bands jump as the cards slot in (A); (3) lines that read as system output: "Predictions · Game 1: 3 playing" (two
  separators), "Nothing on the couch here yet" (A; PFD's L3); (4) a chevron the bands don't have, two rings that touch (B
  measured 0 px), navy marks at 1.02:1 on the dark card (B); (5) a long league name ("NCAA Men's Basketball") overflows the row
  even at 390 (B); minor: the spoken label's stray spaces; stale frames (B: some were shot before the last edit).

## The one batch of fixes

1. **The sheet leads with your games** in the league (`LeagueView`, sports/sheets.tsx): each a row, a move that's due named in its
   own words in chyron-line and opening the move itself; while one is due, "Play this week's games" steps down to an outline (the
   One Chyron Rule). The tap still opens the league's sheet, as the brief says; B1's This week replaces this.
2. **No reflow:** Your shows' rows wait for the cards' few small reads, so bands and cards land once, in their places.
3. **Words:** one separator ("Predictions · Game 1 · 3 playing"); "No games on the couch yet" (solo: "No games yet"); "Eagles lead
   the couch's teams, 7-3"; nothing said when you're the only fan (the marks say it). The solo card's spoken label says "Your
   teams".
4. **The row:** no chevron (a band has none); marks 6 px apart so rings never touch; the xs mark's edge from the foreground (a navy
   team holds on the dark card); the name truncates before the marks, the week first; the off-season name capped at 60%.
5. **The story's solo world** was the couch hub (the home read puts a game's player back on the couch): it now uses
   solo-fixture.js's zt_so_alex, on no couch. A1's "solo" frame had the same fault.

**Kept, with reasons:** the focus ring stays the strip's inset foreground ring (A1, approved) rather than DESIGN.md's chyron-line
(the two hub rows match); the week stays loose muted caps rather than a quiet caption tag (the brief: quieter than a band); the
off-season line names its teams in words, as the brief's example does; a sports Pick'em's name ("Predictions · Game 1") is the
engine's, used everywhere (BACKLOG); a daily sport's "Week 5" is the app's own cut, as its games are named.

**The confirming look:** the reshot frames and check-sports-couch (below in the plan's notes).

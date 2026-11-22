# Following a league (sports-couch A3): the check

2026-11-22, the `sports-couch` lane. DESIGN-PROCESS.md step 4: PFD evaluate and Impeccable critique on the built surfaces, once
each, then one batch of fixes. The frames are real renders at 390 (`.ui-atlas/stories/league-follow/after/`, story-hub-sports.js
`--only=follow`) and check-sports-couch.js's frames 7–11.

## PFD evaluate (Mode 1)

Loaded: the Tier 2 template, the layer rubric, the constitutional constraints. Walked at component scale (three rows and a toast,
not a page), as A2's check did; the template's HTML rebuild of the top fixes was skipped: the fixes are words and one style on
the real components, rebuilt there and reshot.

**Context.** A couch of friends on phones (Joanna forgets, Andrew drives by, Conor tinkers). Intent: put a league on your shows,
or take it off, where you meet it; say which team is yours. Operate mode, not a conversion surface. Design system: Lower Third on
Tailwind.

| Layer | Score | |
| --- | --- | --- |
| Foundation | 80 | Each surface adds one row of three chunks (faces, a line, the toggle); the search row keeps four things with the toggle in the chevron's slot (R1); nothing pushes Your games or the week's play out of the first view. |
| L1 First impression | 72 | The follow state is the sheet's first line (R2). Minor: the filled Following pill is the brightest thing on the sheet after the yellow. |
| L2 Fluency | 78 | One toggle, one face stack, one voice across search, the league and the team (R3). Minor: the unfollow toast ends with a full stop and the follow toast doesn't. |
| L3 Perception | 58 | Major: the league sheet's line truncates exactly at its cause ("On your shows · your team, th…"; "you and zt_nd_ril…"), the words R4 exists for (Clark 2013: an unexplained state is a prediction error). Major: "Make them your team" sits under "Your ZTCF team: the Eagles", so "them" reads as the Eagles. |
| L4 Decision | 72 | One tap from search, no second screen; unfollow's consequence in the toast at the moment it happens (R5); never yellow. Minor: the search row no longer shows that it opens. |

Overall (Foundation ×1.5): **73**. No caps apply. Spread 58–80.

**Top fixes.** (1) L3: let the line wrap rather than cut at its cause. (2) L3: name the team in the button ("Make the Lions your
team"). (3) L1/L2: quiet the Following state; one punctuation for the toasts.

## Impeccable critique

Method: dual-agent (A: a design review, B: the detector and measurements), isolated from each other and from the PFD read.

- **Health (A):** Nielsen 26/36 (error recovery n/a: no failure frame): status 3, real world 3, control 3, consistency 3, error
  prevention 3, recognition 2, flexibility 3, minimalism 3, help 3. Specificity: specific (the app's own row, faces, toast and plates;
  no yellow on a follow), with one generic part, the stock social pill.
- **Detector (B):** 19 advisory `design-system-font-size` findings (14 px and 12 px off DESIGN.md's ramp); 3 in this change, all
  carried over from the old team pill and search row; 16 in older code. Contrast: the muted line 6.68:1 (Night), 6.41:1 (Studio);
  Follow's outline edge 3.42:1 (Night), 4.20:1 (Studio). The toggle 44 px tall; the follow row 44 px; no nested targets. Truncation
  seen only in the league sheet's line. "Make them your team" had no focus style of its own.
- **Priority issues (A):** (P1) the league sheet's line cut at its cause; (P1) "them" ambiguous; (P2) the filled white Following
  pill too loud, competing with the yellow 40 px below on the team sheet; (P2) the search row lost its cue that it opens; (P3)
  "Follow" beside "Add to my shows", "the ZTCB" in the toast, the full stop. Minor: the pill changes width between states.

## The one batch of fixes

1. **The league sheet's line wraps** to two lines (never cut at its cause); the row stays 44 px with one line, about 52 with two.
2. **"Make the Lions your team"**, the team named; it gains a focus ring.
3. **Following is a quiet state:** a raised panel fill with a check, the foreground's text; Follow stays an outline. One width either
   way (7.5 rem), so the line beside it never jumps. On every surface at once (the team sheet's too).
4. **One voice for the toasts:** no closing full stop ("Unfollowed: the ZTCB leaves your shows. The Eagles stay followed").

**Kept, with reasons:**
- **No chevron on the search row.** PFD's R1 (one end-of-row cue, not two) owns how much is at once. The row's name and its line
  ("Every game, week by week") are the cue, as a band opens on its tap with no chevron (A2).
- **"Follow" for a league, not "Add to my shows":** a league isn't a show, and Follow is the sports word; the toast says what it
  does.
- **The short name in the toast ("the ZTCB")**, as the card and the sheet's title name it.
- **14 px on the toggle**, the old team pill's size (the ramp drift is older than this step).

**The confirming look:** the reshot frames (the line on two lines, the Lions named, the quiet Following on Night and Studio), and
check-sports-couch.js's A3 steps, all passing.

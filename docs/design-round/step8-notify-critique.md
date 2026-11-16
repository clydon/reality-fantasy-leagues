# Step 8 critique: the bell and the waivers page (impeccable critique, 2026-11-16)

⚠️ DEGRADED: single-context (run as a delegated sub-agent asked for one read-only pass; the design review was finished and
recorded before the detector ran, so detector output did not anchor it).

Evidence: the after frames in `.ui-atlas/stories/step8-notify/after/` (hub-bell, hub-bell-sam, hub-bell-more, waivers-alex,
waivers-pick, waivers-riley, waivers-sam, waivers-how) and `step8-waivers/after/` (open, claimed, processed and idle as Sam,
open as Kim and Josie), against their before frames; `src/new/hub/notes.tsx`, `src/new/show/waivers.tsx`; the step 8 spec;
DESIGN.md (Lower Third). Mode: Operate.

## Design health score

| # | Heuristic | Score | Key issue |
|---|-----------|-------|-----------|
| 1 | Visibility of system status | 3 | The move plate states every week clearly; a claim confirms by toast with Undo. New vs Earlier rows differ only by 80% text |
| 2 | Match system / real world | 3 | "Bring in", "Picking order" read naturally; "2 swaps went through" for a replacement, "Going", and How's "voted out" (Survivor's term) slip |
| 3 | User control and freedom | 3 | Undo, Change, Clear my pick exist; a one-tap Bring in on a claimed page replaces the pick and its backups |
| 4 | Consistency and standards | 2 | Four verbs for one act (Bring in, Swap, Swap in, Change); "Who comes in" becomes "For Jelly"; a bar chip with a switch icon that isn't a switch; Ep/Episode and 8 PM/8:00 PM mixed |
| 5 | Error prevention | 2 | Row Bring in commits instantly and, once a claim exists, drops the backups without saying so |
| 6 | Recognition rather than recall | 3 | Bars carry no episode axis; the picker's bars vanish once a range is set |
| 7 | Flexibility and efficiency | 3 | One-tap claim for the hurried, picker with stat, tribe and range for the tinkerer |
| 8 | Aesthetic and minimalist design | 3 | Big gain over before (one plate, no sticky foot, no ticking seconds); the ran week still says its result three times |
| 9 | Error recovery | 2 | "Couldn't load them. Try again." has no retry control; picker and claim errors show the server's raw message |
| 10 | Help and documentation | 3 | How waivers work and the safety-net line are in place; the grid's legend explains only one of its three cell states |
| **Total** | | **27/40** | **Acceptable** (top of band; 28 is Good) |

Cognitive load: 2 of 8 checklist items fail (moderate). **Minimal choices**: waivers-alex offers five routes into one
decision (the plate, three Bring in buttons, All 4 free, plus each face opening a sheet with its own Bring in).
**Visual hierarchy**: three full-weight outlined buttons in the Who comes in block outweigh everything but the plate.

## Design specificity verdict

Authored, not generic. The move plate (a white caption plate with a slanted tag: yellow EP 5 while owed, a quiet panel with a
check once claimed, RAN after, THIS WEEK when idle) is one object carried through every state, which is the Lower Third
system doing its job; the spoiler gate (Reveal Episode 5 first, one yellow button) is product-specific. The weekly bars are
the one place the page reaches for "expressive data" and, at present, they read as texture rather than data (P1 below).
The bell is competent but category-standard: icon, title, body, time.

Detector (`impeccable detect --json`, both files): exit 0, 27 advisory findings, all `design-system-font-size`: 14px ×16,
12px ×4, 18px ×4, 20px, 34px, 48px (notes.tsx lines 91, 117, 161, 167; waivers.tsx from line 485). No anti-pattern rule
fired. 14px and 18px are used so widely that DESIGN.md's ramp (13, 15, 16, 19, 22...) looks stale rather than the code
wrong; record the steps in DESIGN.md or move the code to 13/15/19, one or the other. No browser overlay was run (static frames).

## What's working

- **One plate, one yellow.** Owed pages carry exactly one chyron fill (the EP tag); claimed, swap-only, ran and idle states
  drop to the quiet panel. The before page had three yellows, a sticky foot and "Replace Carter" four times.
- **Calm deadline.** "by Wed 8:00 PM · in 2 days" replaces the seconds countdown; minutes appear only in the last hour.
- **The bell lost its noise.** Ten copies of the show's art and ten yellow dots became kind icons; titles lead with the news
  ("Replace Carter by 8:00 PM", "Ep 5 waivers close at 8:00 PM" for the unrevealed reader, so no spoiler); the stale
  "episode 5 airs in about 2 hours" reminder is gone; the phone foot ("Off on this phone · Turn on") is quiet and useful.

## Priority issues

**[P1] One decision, five doors, and one door commits silently.** Frames: waivers-alex, claimed-classic-sam.
The plate (with a chevron) opens the full picker; each Bring in claims in one tap (`bringIn` → `write.pick(spot, [add.id])`);
on the claimed page the same Bring in replaces Rob *and* clears "Backup: Maggie", with only a toast's Undo to recover.
Fix: make the plate a statement on the owed page (drop its chevron; the rows are the action). On a claimed page, change the
row action to "Switch", which opens the picker with the new choice pre-selected above the existing backups, so nothing is
dropped unseen; keep one-tap Bring in only while the spot is open. Command: `/impeccable clarify`, then `/impeccable harden`.

**[P1] The weekly bars don't compare.** Frames: waivers-alex, open-classic-sam/kim, open-classic-josie, waivers-pick.
Bars are 5px wide, up to 22px tall, with no episode marks; zero is a 2px dash in the line colour, so the test couch shows rows
of identical dashes. In Who comes in the bars sit left of a 88px button, in Your team they sit flush right, so the two
columns don't line up and the cross-row comparison the spec promised (Ori vs Eric) has to be done by eye across 200px.
Fix: one fixed bar column at the same x in every section (reserve the action width on team rows even when empty); 7px bars on
a visible baseline with the latest episode labelled ("Ep 5") under the last bar; when every value is 0, replace the bars
with "No points yet". In the picker keep the bars when a range is set (slice to the range) instead of hiding them.
Command: `/impeccable layout`.

**[P2] The ran week says its result three times and names nobody first.** Frame: processed-classic-sam.
Plate "2 swaps went through" (one was a replacement), then two J > M cards, then Everyone's moves repeats "You got Maggie ·
for Jelly · 2nd choice: Kim got Rob first" word for word. The cards use a chevron between faces, which reads as tappable.
Fix: plate title names the people ("Maggie and Patt are yours"); keep the cards and show only *others'* moves under
Everyone's moves (or keep the list and drop the cards); an arrow, not a chevron, between faces. Command: `/impeccable distill`.

**[P2] The bell repeats the show on every row and runs bodies to three lines.** Frames: hub-bell, hub-bell-sam, hub-bell-more.
"ZT Survivor 51 ·" opens 7 of 8 bodies; Sam's reminder body is four dot-joined clauses over three lines. The spec's "show
said once" (by group) was dropped without a replacement. Fix: when every notice in a band is from one show, drop the prefix
and put the show's name once beside the band heading; otherwise group by show. Cap a body at where + one action
("Couch Cup · make your pick +1 more"). Command: `/impeccable clarify`.

**[P2] Yellow multiplies in the picker once someone is chosen.** Frame: waivers-pick (selected state, from source).
A picked row gets a chyron outline, a chyron-filled "Your pick" tag, and the save button is a chyron fill: two fills and an
outline, against the One Chyron Rule. Fix: the row keeps the chyron-line outline and a check; the tag becomes caption ink on
the panel; the save button ("Ori comes in") is the sheet's only fill. Command: `/impeccable polish`.

## Persona red flags

**Joanna (forgets):** push → page → Bring in on Ori: two taps, done, and the safety-net line covers forgetting. Works. If she
taps the yellow plate instead, she lands in a sheet led by an episode-range slider and two selects before any name.
**Andrew (drives by):** "You got Maggie" lands on the ran page whose plate says "2 swaps went through": the name he was told
is not the first thing he reads. **Conor (tinkers):** cannot compare weeks across rows (bars misaligned, unlabelled); sets a
range in the picker and the bars disappear; a stray Bring in on the claimed page wipes his backup order.
**Sam (assistive tech):** WeekBars has `role="img"` with every value read out (good); the bar chip "⇆ Outlast" in
open-classic-sam looks like a control but is a status label with no role.

## Minor observations

- The single-game bar chip carries the switch icon (⇆) but switches nothing; drop the icon or make it a label without a pill.
- Kim's swap-only week: three full-weight Swap buttons where the spec asked for a quiet Swap; "1 free swap" said in the plate
  and again in Your team's head. Use a text-weight Swap and say the count once.
- Section head changes "Who comes in" → "For Jelly" after a claim; "Going" on Kilby needs "Swapping out".
- Picking order wraps to two lines at four or five players (the spec: one row); faces-only chips with the number would fit.
  The same person's avatar colour changes between states (Josie green → purple, You orange → purple): check `Avatar`'s id.
- A due time under 24 hours ("in 6 hours") stays muted on the white plate; DESIGN.md asks for `plate-line` amber.
- Riley's quiet week (ZT couch) is 60% empty: the spec's read-only Who's free and Last time aren't there when no run exists.
- How waivers work: "Someone of yours voted out?" is Survivor's verb (principle 1: any show; use "out"); the grid's legend
  explains bright teal but not dim teal (passed) or the empty cell.
- The reveal gate says "Reveal Episode 5 first" then "Reveal Ep 5"; the head could be the reason, the button the action.
- Mixed formats: "Ep 5"/"Episode 6", "8:00 PM"/"8 PM" (the spec chose "8 PM").
- `notes.tsx` error state "Couldn't load them. Try again." needs a Try again button.

## Questions to consider

- If Bring in is the real action, does the plate need to be a button at all on the owed page?
- What would the bars look like if they were the *primary* datum of a row (points as a number beside them) rather than garnish?
- Should the ran week open on what you got, with everyone else's moves one tap down?
- With one show on the couch, is the show's name in a notice ever information?

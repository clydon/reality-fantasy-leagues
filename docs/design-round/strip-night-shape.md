# Episode night, the late window: shape (Impeccable)

From [the spec](strip-night-spec.md) and [the first-view requirements](strip-night-first-view.md). Operate mode, inside the
committed world (Lower Third, Night and Studio; DESIGN.md). Built in the app behind a TEMP-UI switch, `?strip=a|b|c` (kept per
browser in `gys_strip`; `?strip=off` clears it); without it the app is unchanged.

## Job and audience

A person opens a show on episode night before watching the episode that's on. Two needs, both on the strip: "can I still change
it?" (A) and "who did I start?" (B). The strip stays the show's one statement of what's yours to set, on every tab.

## The direction, per look

- **A · Say it straight.** Today's strip, true words. Window, all in: quiet tag ✓ EP 9, "All set for Ep 9", line "Change it
  before you watch". Window, something missing: the plate and the one yellow tag, the moves' titles as today, line "Before you
  watch it". Locked (strict, by hand): 🔒 EP 9, "Locked for Ep 9", line the lead game's starters by first name.
- **B · Who you've got** (derived). The strip's content column becomes two rows: the sentence (state and condition in one), then
  a row of cast portrait tiles (3:4, 26 × 34, the lineup sheet's shape at a glance's size, distinct from the couch's square
  avatars on the ruler). Each game's group is led by its ink dot (the minis' dot: the game's colour as a dot, never a fill), the
  lineup's starters then the pick. An open slot or a missing pick is a dashed tile with a plus, the sheet's open slot in small.
  Sentences: all in, "Change it before you watch" (the tick in the tag says all set); missing, "Before you watch: 2 to set";
  locked, "Locked for Ep 9". Past six tiles, five and "+N".
- **C · Before you watch.** On Tonight only, in the window, a plate in the strip's place: its tag and "Before you watch" in the
  small plate title, one row per game with a weekly move (the dot, the game's name, the faces and first names, Set or Change),
  and the honour line under them. Every other tab shows B's strip.

## Shared by every look (the bug's other half)

Your moves in the window: subtitle "Episode 9 · change it before you watch"; the honour note's title "Episode 9 is on now"
during the airing, else "has aired"; its body "Open until you watch it. Watching now, or seen it already? Leave it as it is.";
"I've watched it" only once results are in; Save's toast "All set. Change it before you watch." The Games tab's card in the
window: "Before you watch Ep 9" in place of "Ep 9 aired · you haven't watched it · … first".

## States and ranges

One to three games with a weekly move (a lineup, a pick); an Outlast team has none and isn't drawn. Starters one to five (a
sport's nine are past the window: sports show results at once). A missing photo is the Face part's initials. Truncation: A's
locked line ellipsizes; B's row never wraps.

## Interaction

The strip stays one button: it opens Your moves at the first game with something missing, else the first game with a move. C's
rows each open their own game's tab. The all-set moment (the tag's yellow draining to the tick, nd-settle) stays the one motion.
Each tile is decorative inside the button; the button's name says everything: "Ep 9. All set: starting Kristin, Sam and Joe;
your pick, Maggie. Change it before you watch."

## For the story only

`?carried=set` shows the open question's other answer in the client: a lineup carried in complete reads as all set in the
window (the badge and the strip lose its late move). The server's rule and the push are unchanged; frames using it say so.

## Assumptions to confirm in the review

- The game's ink dot is enough to tell the lineup's group from the pick's without words.
- 26 × 34 tiles are big enough for a fan to know their castaways at a glance.
- C's plate is shown to compare, not recommended (it fails R1: it pushes Last time out of the first view).

# Episodes and the reveal: the look (step 4, Impeccable)

Operate mode for Episodes, the episode's page and Where you are; Experience mode for the reveal (the visitor is inside the
moment). The committed world is Lower Third (DESIGN.md): night panels, caption type, one chyron yellow for what's due for you,
the show's art as identity. Built on [the spec](step4-episodes-spec.md) and [the first view](step4-episodes-first-view.md).

- **The compact progress control** is a night band under the sticky show bar, scrolling with the page (the bar stays 96 px, so a
  sticky line doesn't take a fifth of the screen). Your mark at 15 px bold, what's next at 13 px muted, a chevron (it's Where you
  are's door), and one action at the right edge: yellow only when it's the view's one due thing (a reveal with nothing due, or
  that a due move waits on), else a white outline. No ruler: the ruler is Tonight's.
- **Episodes' list** keeps the row anatomy people know (the big number, a face, a line, the couch's faces, your row lifted).
  Groups are labeled in the caption face at 17 px, muted; no section title above them. The next episode is the first row, its
  face the show's art. Hidden rows keep their stripes (the hidden texture is already learned); their "Reveal" word becomes a
  chevron. One departure from the spec: the waiting episodes stay a row each instead of folding into one, because each carries
  the couch's faces at its own mark ("riley and alex are on 5"), which the spec's own drill tree keeps; the reveal is still said
  once, in the control.
- **The episode's page** reorders without new parts: the OUT plate, What happened (the write-up joins the challenges), How was
  it? with Discuss, Your games with the lineup's best under it (faces at 28 px, first names, points in the number face), then
  Replay as a plain button at the foot.
- **The reveal's opener** puts the show's art full bleed behind the first beat only, under a gradient that keeps type above
  4.5:1 (darkest at the foot where the words sit); it fades out as the next beat comes in (500 ms opacity; none under reduced
  motion). "Last time on" at 30 px over the show's name at 60 px; the games it covers at 16 px semibold.
- **The lineup beat** draws each starter's points as a bar on one signed scale beside the number: teal for points, live red for
  a loss, a dot for zero, a hairline at zero; at least four points wide. The bars wipe in from zero one after another (500 ms,
  exponential ease-out, 70 ms apart); final values are present from the start, and reduced motion skips the wipe.
- **Other games** are a beat each at 44 px caption type: the result is the beat.
- **The end** has one filled button (Reveal Ep N+1, else Back), with Add your GIF and Share your night side by side as outlined
  buttons above it.
- **Where you are** is a list, not a stepper: oldest first, the boundary a 2 px chyron-line rule labeled "You're here · through
  Ep 3" (the chyron line colour, not fill: it marks you, it isn't a call to act). Rows past it are muted. Save names the result.
  On a season you play the rows are text, not buttons, and the reveal is the sheet's one action.

# Last time's write-up: the look (Impeccable, shape)

**Superseded on 2026-11-23** by the user's pick B in the bolder round (tonight-writeup-bolder.md): a Night panel with the "In
this episode" tag and a headline. The cut, the opening and closing, and the guard below still hold.

After the spec (`tonight-writeup-spec.md`) and the first-view requirements (`tonight-writeup-first-view.md`). Operate mode, in
the committed world (Lower Third, DESIGN.md), refinement: everything else in Last time stays as it is.

- **What it is:** the episode's own words, said plainly between the broadcast pieces. The plates and the stat card are the
  graphics, and the write-up is the voiceover under them. So it gets no plate, card, rule or kicker (the craft floor bans the
  kicker, and DESIGN.md keeps shadows and fills off ordinary text). It's Archivo body at 15 px, leading 1.6, the foreground at
  90%: the same setting as Episodes' "What happened" paragraph, so the fact reads the same in both places.
- **The cut:** three lines. As built after the check (tonight-writeup-check.md), the third line ends on a whole word, a sentence
  end when there's one in its second half, never inside a name, then "… more" (semi-bold, foreground, underlined at 35%). The
  first build put "more" on a fade over the text, and that cut words in half. Opened, it's the whole text, then "less" inline at
  its end. Tapping the text opens it, and only "less" closes it. The control is a real button with `aria-expanded`, and a screen
  reader hears the whole write-up either way. It opens instantly, with no motion: this is reading, not a moment, and the reveal
  keeps the authored motion for this text.
- **Where:** under the Out plates. With nobody out, first under the heading, with "Nobody left in Ep N." under it as now. Above
  the stat of the week, the GIFs and the two doors. 12 px gaps, as the block has.
- **States:** no write-up means nothing at all. A short one (three lines or fewer) shows whole, with no "more". It measures
  whether it's cut after layout and again on resize (a font swap or a rotation can change it). Studio (light) mode uses the
  same tokens.
- **Untouched:** the reveal's "In this episode" beat, the Episodes page's paragraph (both lose the source markup, nothing
  else), the plates, the stat, the GIF strip, the doors.

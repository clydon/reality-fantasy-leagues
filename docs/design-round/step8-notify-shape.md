# Notifications and waivers: the look (step 8, Impeccable)

Operate mode. The committed world is Lower Third (DESIGN.md): night ground, caption type, colour rationed, yellow fill only for
what's due (the One Chyron Rule). Built on [the spec](step8-notify-spec.md) and [the first view](step8-notify-first-view.md); the
parts are the round's own: the strip's move object (a caption plate with a chyron tag), step 5's person sheet with an action foot
(step 6's `DraftFaceSheet`), the picker's controls. Discovery was the spec's and PFD's; no new visual world.

## The bell (`hub/notes.tsx`)

- The sheet's head as today ("Notifications", "3 new" / "Nothing new"). No due row.
- **New** and **Earlier**: 13 px caption-caps labels in muted, a 6 px rule's worth of space above Earlier. New's rows: a 36 px icon
  box (secondary fill, the kind's lucide icon in foreground), the title at 15 px semibold in foreground, the body at 13 px muted
  (the show's short name first), the time at 12 px muted on the right. Earlier's rows the same with the title in muted: quieter by
  one step, never a dot. A row that needs a decision (a join request) sorts first in New.
- A done reminder isn't listed: the read drops a move's reminder once that episode has locked for you (your mark has passed it, or
  it aired on a live game) and a waiver reminder once its week has run.
- The foot, only while no phone of yours rings: one muted line with a bell-off icon, "Off on this phone", and Turn on (the
  show's sheet's own ask).
- The bell's dot: the foreground colour with the ground's 2 px ring (not live red).

## Waivers (`show/waivers.tsx`)

- **The bar:** the show's bar as today; its status chip (the game's name) only when you play one game with waivers here. With two,
  the segmented pills under it, as today, and no chip.
- **The move, owed:** the strip's object, a white caption plate: its chyron tag "Ep 5", its title "Replace Carter" (Archivo 24),
  its line "by Wed 8:00 PM · in 2 days" in plate-muted. The deadline once; no seconds, no countdown (`calm`'s words, minutes only
  inside the last hour). This is the page's one yellow.
- **Who comes in**, directly under it on the ground: the three best free (by the season's points, as the picker ranks), each a row:
  48 px face, the name (16 px bold), "Dina · 6.5 pts" (13 px muted), their points by episode as small bars (the last eight
  episodes, 5 px bars, one scale across all three rows and Your team so they compare), and an outlined Bring in (40 px, the
  system's optional button). A tap on Bring in claims at once (toast with Undo); a tap on the face or name opens their sheet (step
  5's) with Bring in at its foot. Under the three, the safety net in one muted line with the bolt ("Forget, and whoever's free
  with the most points comes in"), and "All 9 free ›" (opens the picker). The section's head says what the bars are ("Points by
  episode", aside).
- **Claimed:** the plate becomes the quiet night panel with a teal tick: "Ori comes in for Carter", "if taken, the best one left ·
  change until Wed 8 PM", and Change (opens the picker). Ori's row in Who comes in reads "Your pick" in place of Bring in.
- **Your team:** the same row form (face, name, "pts · tribe", bars), a quiet outlined Swap only while a swap is left (the head's
  aside says "1 free swap"); the out person in the slot with "Out · Ep 5" in live red and no button (the plate is their move); a
  swap in flight shows "Going" and the incoming line as today.
- **Picking order** (exclusive only): one line of chips, each a 24 px avatar and the name, numbered, you inverted; under it one
  line, "Highest score first · claims stay private until Wed 8 PM".
- **Quiet week:** the plate in its quiet form ("Nothing to do until after Ep 6"), then **Last time** (the last run's moves, the
  existing MovesList), then the order.
- **Ran:** the result as today (teal "Waivers ran" kicker, the headline, the swap cards); then, while it's open and you can move,
  **Free agency** as a section with its head line ("until Thu 8 PM · first come, first served"), the top three free in the same row
  form with Swap in, and "All 5 free ›" (the existing sheet); then Everyone's moves.
- Gone: the Due kicker and its ticking clock, the chips row, the sticky foot, the big order cards, the yellow Swap buttons.
- **The picker:** each row's single bar becomes the same episode bars on the rows' one scale; the empty confirm reads "Choose
  someone".
- Motion: none new. The claim's feedback is the plate changing and the toast.

## The push

Words only, by the spec's table. A sports or show push is the same grammar.

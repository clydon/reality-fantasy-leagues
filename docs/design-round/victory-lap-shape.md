# The victory lap (sports-couch C3): the shape brief (Impeccable, step 3)

On [the spec](victory-lap-spec.md) and [the first-view requirements](victory-lap-first-view.md). Mode: **Operate**. The committed world:
Lower Third on Night and Studio. The interview was answered by the spec and the first view (asked once, no answer round: the user
reviews at the story). New parts live in `src/new/sports/lap.tsx` (`LapCard`, `LapSheets`, `LapPrompt`, `VictoryLaps`, `LapTag`), built
from React with a GIF's parts (`GifPicker` from ui/gif-sheet.tsx, `GifTile` from show/react.tsx: shared, not copied) and C2's result
type. Nothing new in the palette.

- **The thesis: the result earns the GIF.** A lap is never a bare GIF: it always wears the final that earned it, from the fan's side, in
  the number type. The focal moment is "Giants won" in the caption type beside the team's mark: the one display line on the card, the
  same voice as C2's "Jordan called it".
- **The lap tag:** one small mark, the same everywhere a lap is drawn: the lucide `Trophy` at 13 px and "Victory lap" in the caption type
  at 12 px, tracking 0.06em, muted, on no fill (a yellow tag would spend the page's one yellow; a plate would read as a name). On a room
  bubble and a feed row it sits on the line above the result.
- **The lap card (This week, under the move strip):** B1's card ground (`bg-card`, 4 px radius, 14 px in), no border. Line one: the
  team's sm mark, "Giants won" in the caption type at 22 px, the score at the right in the number type at 20 px from the team's side
  ("24–17"). Line two, 13 px muted: "vs Bears" (or "vs Riley's Eagles" when a couch fan has the other side: the rivalry said by its
  opponent), then " · You called it" when their pick was right. The ask: a 44 px ink button ("Take a victory lap", the `Btn tone="ink"`)
  and "Not this time" a 44 px text button beside it. A co-fan's lap already in: one 13 px line under the ask with their 16 px face
  ("Casey took one"). About 112 px.
- **The lap sheet:** the house `Sheet`, title "Victory lap", subtitle "Giants 24–17 Bears · Sun". Step 1: `GifPicker` with `initial`
  "Giants win". Step 2: the chosen GIF as `GifTile wide you`, "Pick another" a text button at the right of its row; the line, a 48 px
  field ("Add a line (optional)", 120 characters, never auto-focused); "To the NFL room and On the couch · waits for anyone hiding
  scores" 13 px muted; **Post it** the chyron `Btn tone="must" wide`. Posted: the lap as `LapCard`'s preview form (tag, result, GIF,
  line), "Posted" muted with "Take it back" a text button, then Done (ink). GIFs off: step 2 alone with the line required.
- **The game sheet's final:** under the couch line, the fan's `LapPrompt` (the card's ask alone: the bug already says the score; a single
  line "Giants won. Take a victory lap?" over the two buttons); after Not this time, a quiet "Take a victory lap" text link. Then, after
  the thread link, **Victory laps** (the house `SportsLabel`): each lap a `GifTile` 2-up with its name strip, the line under in 13 px.
- **The room's lap message:** the author's bubble as any GIF message, with the lap tag and the result ("Giants 24–17 Bears", 13 px, the
  numbers in the number type) on the line above the picture, the line under it in the bubble's text size.
- **The feed's lap row:** FeedRow's form: the 28 px face; "**Jordan** took a victory lap"; then the team's xs mark and "Giants 24–17
  Bears · NFL" 12 px muted; the GIF at the feed's 150 px; the line under. The row opens the game's thread.
- **States:** loading (the card isn't drawn until the read answers; the sheet's picker its own skeleton); a post failed ("Didn't post ·
  Try again" under Post, choices kept); Not this time failed (the card comes back with "Didn't save · Try again"); GIFs off (line only);
  hidden (nothing).
- **Motion:** the card leaves by height and opacity (200 ms ease-out) on Not this time or Done; the sheet's step change cross-fades
  (150 ms); nothing under reduced motion.
- **Anti-goals:** no yellow on the card; no confetti, trophies as decoration or slogans; no "Congrats!"; no countdown; nothing at all
  for a hider; no consolation for the loser.

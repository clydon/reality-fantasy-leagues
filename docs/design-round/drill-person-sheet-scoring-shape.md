# The castaway sheet scored by the show: shape

Refinement of the incumbent sheet (`src/new/show/cast-sheet.tsx`), inside Lower Third. Operate mode: a reference sheet read in a
glance on the couch, drilled by the sweat. Inputs: [the page spec](drill-person-sheet-scoring-spec.md) and
[R1–R5](drill-person-sheet-scoring-first-view.md).

## Thesis

The season reads as a verdict before it reads as data: teal rising from the line where the show paid her well, quiet grey for the
small stuff, Ember hanging under the line for the setbacks. One code, three marks, the same on the chart, on every row of Their
numbers, in the story and on the board's bars. A game's points are a row's detail, drawn on the chart's own episode columns.

## The class colours (tokens in `new.css`)

| Token | Night | Studio | Meaning |
| --- | --- | --- | --- |
| `--nd-big` | Safe Teal #35b5a5 | #0b7568 | a big moment (more than 1 point for one) |
| `--nd-small` | #75708a (the edge grey) | #8e889c | a small moment (0 to 1) |
| `--nd-setback` | Ember #f2804b | #b4541c | a setback (below 0), always under the line |

The red option (`gys_keyv=score-red`, for the user's named choice) swaps `--nd-setback` for Live Red. Validated on the sheet's
panel: Night colour-blind ΔE 12.5, normal 19.3, every mark 3:1; Studio 9.5, 17.0, 3:1; red on Night 8.1 from the grey.

## The parts

- **The class mark**: a piece of bar, 4 × 12 px, 1 px corners, in the class colour; never the group's square. It leads every row of
  Their numbers, every moment in the story, and each item of the key.
- **The key**, under the chart, one line at 390 (two with the went-home note): "▮ Big moments ▮ Small moments ▮ Setbacks", 13 px
  muted, the same words on every sheet; then "Ep 6: went home" in live red when they left.
- **Each episode**: columns fitted to the sheet (up to 52 px each; 30 episodes at 11 px), bars at most 24 px wide and centred, a
  2 px gap between classes; big from the line, small stacked over, setbacks under the line; the night's count over each column to
  14 episodes; the axis under the lowest bar, every 2nd or 5th number when columns narrow, the one they left in live red.
- **Their figures** (amounts only), between Who and the chart: a row a figure; the total in 28 px `type-num` (thousands grouped,
  one decimal at most), its place ("2nd of 9") at the right, the moment's name under it in 13 px muted (two lines at most), and
  under that its amount each episode as thin Bone bars on the chart's own columns; › opens its board.
- **Their numbers' row**: two lines. Line 1: the mark, the name (14 px, wraps), the count (20 px `type-num`). Line 2, muted 13 px:
  the worth ("+2 each", "−0.5 each", "No points") under the name, the rank words at the right. ⌄ at the end, turning over when
  open. Caption: "Their numbers", right "Most valuable first · of 21".
- **A numbers row, open** (in place, several may be open): the season's episodes on the chart's columns, a dot (8 px) in the class
  colour in each episode it happened, the count in the colour's place when more than one, a 2 px grey tick where it didn't, nothing
  after they left; the episode numbers under it; then "See everyone ›" (a 44 px row): the stat's board.
- **In your games' row**: two lines. Line 1: the game's name (15 px semibold), their points there, signed (20 px `type-num`).
  Line 2, muted 13 px: the holders' faces and line, their place in that game's cast ("3rd of 18") at the right. ⌄ at the end. A
  pick game shows its line and no number. Caption right: "Points there".
- **A game row, open**: their points there each episode on the chart's columns, 64 px tall, in the game's colour, signed values
  over the bars to 14 episodes, a dot under the weeks they counted for you (when only some did, with its note); then the holders as
  today (› each).
- **The story**: each moment's name led by its class mark; the form otherwise as approved.
- **The board's bars, the stats page's and Tonight's rows**: the kind's class colour.
- **Door marks**: ⌄ opens in place, › opens a level; nothing else wears either.

## States and ranges

- Kinds per castaway: 1 to 15 (Survivor 51's Sharonda 7, Savannah at Survivor 49's finale 11); episodes 1 to 30.
- No moments yet: "Nothing recorded for Jelly yet." in the chart's place; Their numbers absent.
- A pick game: no number; a game with no points yet: "0" and no place.
- Figures: none on Survivor or The Traitors; Below Deck's gratuity share (thousands); a judge's score (decimals).
- Watcher: no In your games; nothing else changes.

## Untouched

Who, the header and crumb, Compare, the board's form, the athlete's sheet (sports keep their own parts), the Cast tab's own
Counted by on The numbers.

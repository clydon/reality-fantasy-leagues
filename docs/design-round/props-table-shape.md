# Prop sheet round: shape (Impeccable)

On [the spec](props-table-spec.md) and [first-view requirements](props-table-first-view.md). Mode: Operate. World: Lower Third
(DESIGN.md), dark Night by default. Nothing new in the visual language: this round is a table built from the existing parts.

## The player table (a "person" question a stat settles)

- **Reuses** the NumbersTable idiom (cast.tsx): a sticky first column with the right-edge shadow, 1 px `border` row rules, the
  sorted column on `bg-card`, `type-num` numbers. Not a copy: a new `StatPicker` in answer-controls.tsx, since a pick table selects
  and the cast table drills.
- **Row:** 52 px tall (a thumb target). Player cell 156 px: a 28 px square headshot (`Face`, radius 3), the name in body-strong
  15 px ("J. Daniels"), under it a 12 px muted line, "WSH · QB", with the injury code as a `live-red` 11 px badge ("Q") when there
  is one. Numbers: `type-num` 17 px, centred in 64 px columns. The sorted column's top value is set in `foreground` at 20 px, the
  first view's figure (R2); the rest of the column is 17 px.
- **Header:** 11.5 px muted labels ("YDS/G", "LAST", "SEASON", then the group's counts: "TD", "INT", "CMP", "ATT"), the sorted one
  bold with the chevron (the cast table's). Tapping a header sorts by it.
- **Picked:** the row's background `secondary`, a 2 px `foreground` bar on its left edge, and the headshot swapped for a tick on a
  `foreground` square. The same tap takes the pick back. The Save button names the pick ("Save: J. Daniels") from the existing
  `answerWords`.
- **Folds** (R3, R4): the contenders (the settling stat > 0) capped at 5; then "More who've thrown · 2" if there are more; then
  "Everyone else · 51", a 44 px text row with a chevron, opening the rest sorted by position then name, the numbers shown as "·".
- **No stat yet** (no game seen yet): the rows sort by position (the question's group's positions first: QB for passing), a line
  above the table: "No games yet this season: sorted by position."
- **Hidden scores** (the viewer behind): every number is to the viewer's mark, the same rule as the grid; a game past it never
  counts.
- **Wide:** the table scrolls sideways under the sticky player column. A 32 px fade on the right edge says there's more.

## The game's name

- `sportsGameName(episode)` on the server's episode listing: "Week 11 at Bengals" (long), "at Bengals" (short), "@CIN" (tag).
- Game page: the header's second line "PROP SHEET · AT BENGALS"; its eyebrow "COMMANDERS · WEEK 11". The strip: "3 questions for
  Monday at Bengals".
- "Who wins?": sides as "Commanders" and "Bengals" (the short name), never truncated.

# A castaway opened from a week: shape (BACKLOG 251)

Impeccable's brief, on [the spec](week-door-spec.md) and [the first view](week-door-first-view.md). Mode: Operate (a reference sheet
read on the couch); a refinement inside Lower Third, so everything on the castaway sheet below the new block is kept as it is.

- **Job and proof.** "Carter +6" tapped on a person's week opens Carter's sheet with Episode 9 in that game first: the moments, each
  with its points at the game's scoring, closing on the +6. Proof: the rows add up on every situation the story shows (started,
  0, bench, captain, no holder), and the first view at 390 holds the block and Who's photo row.
- **Direction.** The block is the week pane's head carried over (the user just read it): the episode in 26px condensed caps,
  underlined as a door; its line in 13px muted; the total in the 34px condensed row number, right. Under it the moments as the
  story draws them (a 4×12 band mark, the rulebook's name in 14px), but with their points in a 17px tabular column under the total.
  A factor is the same row with no band mark ("Captain ×2"), over a hairline. Moments a game gives nothing for: one 13px muted line.
  The foot: "‹ Ep 8" and "Ep 10 ›", 13px semibold muted, 44px tall. A hairline closes the block; Who follows.
- **Ink.** No yellow (nothing is due). A bench week's total and rows in muted ink, its line saying "scored, didn't count". A setback's
  points in muted ink with the minus (Red Is For Leaving); someone who went home that night gets the story's live-red exit line.
- **States and ranges.** 0 to 7 scoring moments a week on the seasons on hand; more than five fold to "N more" in place. A week with
  nothing: "Nothing that scores in this game." Without a holder: "Their points in Weekly Lineup". 30-episode seasons: the block's
  height never depends on the season's length.
- **Motion.** ‹ › swaps the week in place: the rows cross-fade (opacity, 160 ms, ease-out); reduced motion swaps instantly. Nothing
  moves on first paint. The season chart and the game's row mark the block's episode with the raised fill behind its column (the
  week strip's highlight), so the week is found in the season without motion.

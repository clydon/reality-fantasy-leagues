# Last time's write-up (page spec, Intent)

The user, 2026-11-23, from a Below Deck phone screenshot: "I see some benefit to having this summary on the tonight tab of what
happened last episode. Does it fit nicely even in competition shows like Survivor?" The summary is the episode's write-up
(`season_episodes.summary`, written by the recap search in `src/lib/server/episode-recaps.ts`: "two or three plain sentences: the
main things that happened, and who left or won anything"). Today it shows on the reveal's "In this episode" beat and on the
Episodes page, never on Tonight.

## Verdict: it belongs, in Last time

Tonight's job (tonight-night-spec.md) is "What happened last episode, to me and to everyone?" Last time answers it for the show
with who left, the stat of the week, the couch's GIFs and two doors, but nothing says what the episode *was*. The write-up is
the only part that tells the story. For the four people:

- **Joanna** (forgets) opens Tonight days later. The write-up is their "previously on". Today they'd have to find the recap door.
- **Andrew** (drives by) wants who left and his games. The write-up must not push Your night far down: a short excerpt, not
  the whole text.
- **Conor** (tinkers) reads all of it. The full text opens in place.
- **Casey** (only watches) has no games. For them, Tonight is the show itself, and the write-up is the most content it has.

**Survivor and other competition shows:** yes. Survivor's write-ups say how the vote went ("blindsided and voted out 6–5", "gave
his idol to Carter before leaving"), which the Out plate can't. The write-up repeats who left in its last sentence, but the plate
says it first and the write-up adds how. **Story shows (Below Deck):** yes, and more so. With nobody leaving, the write-up is the
episode's main fact. **Sports:** the same Tonight and the same rule (the write-up there is the final score and what decided it).
Not rendered this round.

## What Last time holds, in order

| # | Part | When | Change |
| --- | --- | --- | --- |
| 1 | Who left: the Out plates | someone left | none |
| 2 | **The write-up**, a three-line excerpt that opens in place to the whole text | a write-up exists | **new** |
| 3 | "Nobody left in Ep N." | nobody left (not sports) | now sits under the write-up |
| 4 | The stat of the week | as now | none |
| 5 | The couch's GIFs | as now | none |
| 6 | Discuss Ep N · Ep N recap | as now | none |
| 7 | Bingo and trivia | as now | none |

One fixed order, so each situation ranks itself. With a boot, the outcome leads (the plate), then how it happened. With nobody
out, the story leads, and "Nobody left" becomes a footnote to it.

## The drill

- **The excerpt opens in place**, not on another page: the whole write-up is three to six more lines, and leaving Tonight to
  read it costs more than it gives. A second tap closes it. Your place on the page doesn't move.
- **Ep N recap** stays the way into the episode's page (what happened, row by row: winners, the moments). Keep, with reason: it
  holds the per-moment rows the write-up doesn't.
- **The reveal's "In this episode"** stays. The reveal is the one-time moment. Tonight is where it stays standing for the days
  after.

## What's left out, and why

- **No heading or kicker** over the write-up. The block's title, "Last time · Ep 2", already says what it is.
- **No placeholder** while there's no write-up yet ("Looking up what happened…" belongs to Episodes, where someone came for it).
  Tonight says nothing rather than promise.
- **No source line.** Some write-ups end in the research's citation, "[Source: Paramount+ recap](https://…)". It's raw markdown,
  shown today on the reveal and on Episodes as-is. It's dropped everywhere the write-up shows (a bug fix that comes with this
  round), and the recap search stops saving it.
- **Spoilers:** none possible. Last time is your own last-watched episode (`latestSeen`), and the server sends a write-up only
  for an episode you've watched (`season-episodes.ts`: `summary: watched ? … : null`). Own pace follows from the same mark.

## Situations the story must show

1. Survivor 51 (competition), a player, someone voted out: before and after.
2. Survivor, a double boot (two plates and the write-up).
3. A story show (ZT Yacht, standing in for Below Deck), a watcher with no games, nobody left: before and after.
4. The excerpt opened.
5. A write-up with a source line, now clean.

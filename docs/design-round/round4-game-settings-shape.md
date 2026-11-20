# Changing a game later: the look (Round 4, Impeccable)

Operate mode, in the committed world (Lower Third, DESIGN.md), and in Start a game's own parts (`gallery-bold/parts.tsx`), so a
game's settings read as the screen that made it. Built on [the spec](round4-game-settings-spec.md) and
[the first view](round4-game-settings-first-view.md). Behind `?settings=r4` (TEMP-UI, remembered for the browser tab;
`?settings=off` drops it) until the user approves.

- **The list** (Backstage › Game settings) uses Round 3's block form.
  - Each block is a caption heading (15 px caps, its aside 13 px muted) over one card on the night panel, rows split by hairlines.
  - A row is about 60 px: the game's name in 17 px caption caps, one line of what's notable in 13 px muted, and a chevron. A
    "Changed" quiet tag shows when anything differs from recommended.
  - The blocks: Running; a night's games, one block per episode, folded to a line; Finished, folded to a line.
  - Competitive mode and Archive or delete stay under them, as today.
- **A game's settings** is a page pushed over the game or over Backstage ("Game settings", Back).
  - **The title card first:** Start a game's TitleCard, with the show and season as its kicker, the game's name over the show's
    art, and one sentence for your role ("You run this game.", or "Game admin: you open or close this episode's lock.").
  - **This episode's lock:** today's row (the padlock, Open or Locked, Auto or Override), unchanged.
  - **The rules:** Start a game's rule lines. A 40 px pictogram tile, the label in 13 px caption caps, then the value in 16 px
    semibold with its second part muted. A chevron opens the control under the line, on a sunk panel (the background colour,
    3 px corners), and only one is open at a time. A fixed line has a padlock where the chevron was, its reason as the second
    part, and opens nothing.
  - **How moves lock** uses Start a game's two OptionCards, Together and At your own pace. The card that can't be had says why
    in its `off` line ("Chosen when the game started"). Under Together, "Late moves" offers two smaller cards: on the honour
    system (open until you've watched it, or the next one airs), or none (everything locks at airtime).
  - **Stop this game** is today's archive-or-delete fold, for this game only and named for it.
- **The game's ⋯ menu** gains a "Game settings" row (Row, the sliders icon) for whoever runs the game. It opens the page over the
  game.
- **Motion:** none new. A line's control opens with the app's existing chevron turn.

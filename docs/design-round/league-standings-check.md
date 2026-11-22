# A league's page, Standings (sports-couch B1, session 4): the check

2026-11-22, the `sports-couch` lane. DESIGN-PROCESS.md step 4: PFD evaluate and Impeccable critique on the built tab, once each (two
independent reviewers, neither shown the other's read), then one batch of fixes and one confirming look. Frames: real renders at
390 × 844, `.ui-atlas/stories/league-standings/after/` (`scripts/dev-test/story-league-page.js --only=standings`): the stand-in's
worlds and real ESPN tables (the NFL, NBA, NHL, MLB, Premier League).

## Found in the build, before the check

- ESPN lists a division's teams in no order (the NBA's Atlantic came 14th seed first): ordered by the league's seed, soccer by rank.
- ESPN's games behind is the division's: by conference it's counted from the conference's leader.
- Soccer's record as its tables say it (W-D-L; ESPN's summary is W-L-D); a place colour ESPN wrote "##B5E7CE"; a soccer season named
  with its league ("2026-27 English Premier League").
- Racing's driver table (people, not teams) came back as an empty group: dropped.
- BACKLOG 254 (k), fixed first: Hide sports scores reads as on until the profile answers, on every sports screen.

## Scores

- **PFD evaluate:** Foundation 84, L1 70, L2 68, L3 78, L4 78; overall **76**.
- **Impeccable critique** (single-context): Nielsen **30/40**. Contrast passes in both themes except the chosen view in Studio
  (1.1:1 fill); every target 44 px or more. Detector: 8 advisory sizes off the ramp (14 and 12 px, as the sibling tabs use).

## The one batch

- **Names cut short** (both, the top finding: "G…" beside "1st East", "Yank…" beside "In"): the division lead, In and Out and a
  soccer place's name go on a 12 px line under the name, never beside it; two faces at most.
- **Every division leader marked by conference** (PFD: only the exceptions were, so the rule couldn't be learned).
- **The deciding number in ink** (both: soccer's P was bold and its PTS grey; hockey's record over its points): each sport's
  ranking columns strong, the rest muted (football W-L and PCT; basketball and baseball W-L and GB; hockey and soccer PTS).
- **Your row in view on switching to Conference** (PFD: the Eagles were seed 16, far below), the league's order unchanged.
- **Rows look tappable** (Impeccable): a chevron at the end that turns when the row opens.
- **The chosen view inverted** (both: Studio's was 1.1:1), ink with the ground as its text, as the You badge.
- **The recording plate names its game** ("You're watching Eagles at Jets as if live"), from this week's games.
- **A soccer place in words** on its first row and in the row's spoken label and splits (colour alone carried it: WCAG 1.4.1).
- **A leader's games behind as a dash** ("—", not a hyphen that read as missing).
- **No switch over a held table** (it only changed a greyed heading).

## Kept, and why

- **The 14 and 12 px sizes** (detector): the sibling tabs' sizes; a house-wide ramp change if it changes.
- **The failed state's one line** (Impeccable, P3): the earlier tabs' failed states are the same; one rule for all.
- **The soccer swatch as a dot, not a 4 px row edge** (Impeccable): a coloured edge on list items is one of the craft floor's
  refusals; the words now carry the meaning, and the colours are ESPN's own.

## Open after the confirming look (not chased)

- **Names still truncated where it was tightest** (a name with a face beside it: "Cow…", "Yank…"): **settled** at the review, the
  faces on the line under the name; only the longest names still cut ("Comman…").
- **The chosen view in Night was the brightest fill on the tab** (a white segment): **settled** at the review, Night's raised
  panel with an ink outline, Studio's ink fill kept.
- **A soccer place's words truncate** under a long name ("Champions Leag…").
- **The team sheet says "A team"** as its title (Impeccable, P3; B2's team page replaces the sheet).

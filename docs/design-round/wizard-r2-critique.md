# Start a game, the gallery as built: Impeccable critique (Round 2's check)

Method: dual-agent (A: the design review, B: the detector and the browser), isolated; synthesized here. Frames: real renders at 390
on the real Survivor 51, Below Deck 13 and The Challenge 42 (`.ui-atlas/stories/wizard-r2/after/`, shot before the batch).

## Design health: 26/40 (Nielsen, before the batch)

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 2 | The chips didn't follow the scroll ("Ready 0" lit on The Challenge 42); dashed bases did nothing when tapped |
| 2 | Match with the real world | 3 | Plain names and the show's own stages; "castaways" and "tribe" leaked onto other shows |
| 3 | User control and freedom | 3 | Undo on each changed row, Back keeps the scroll; the lock's sheet had no Done |
| 4 | Consistency and standards | 2 | Yellow links beside the yellow Start; Done bone-filled where bone means chosen |
| 5 | Error prevention | 3 | Every choice checked by the engine; riley flagged before Start |
| 6 | Recognition rather than recall | 3 | Scoring marked Changed still read "The show's points" after a captain |
| 7 | Flexibility and efficiency | 3 | Search, chips, popular changes, our AI; the ready game's Start took two taps |
| 8 | Aesthetic and minimalist design | 2 | A base's first view near seven chunks; "Season" on 52 of 56 squares (quiet, but there) |
| 9 | Error recovery | 2 | Reasons cut off on the chips; a game in stages warned with no way out |
| 10 | Help and documentation | 3 | Every rule is there; the preview is a list of steps in this round |

**Specificity:** the content is authored (the show's own stages and air dates, the couch named in the lock line, "Bet points, never
money"); the shelf's frame was stock (a two-across grid, settings rows), and Lower Third's caption plate appeared nowhere.

**Detector:** exit 0, no primary findings; 39 advisories, all `design-system-font-size` (14, 12, 17 and 20 px off DESIGN.md's ramp; the
app uses them in 100+ files, so DESIGN.md's ramp is what's missing). In the page: one anti-pattern, a bounce easing on `<body>` from
`src/app/(new)/new.css` and `src/new/ui/show-bar.tsx`, outside the gallery. Under 44 px: the ready row's Start, both chip rows (36 px),
When moves lock's Change (50 × 21), and the shared sheet's Back and Close (40 px). Contrast: nothing under 4.5:1 (lowest 6.1:1). No
horizontal overflow. React: a duplicate key in the redraft pictogram.

## Fixed in the one batch (with PFD's evaluation's)

- **Start starts.** The ready game's Start and Start your own copy go to what Start makes; Change it first opens the game's screen.
- **No dead end for someone behind.** One wording for what a lock costs, closed and opened ("riley is 2 episodes behind: they'd have
  to catch up before Episode 10 airs, or miss moves"); a game in stages says it can't wait for people yet and offers One game instead;
  Wait for riley is marked Changed with Undo.
- **One grammar.** Yellow on Start alone (links, Undo, See all, Every rule in bone); Done outlined; the strip's stretch outlined so Start
  is the only heavy fill; Like a real toggle; a dashed choice says why where you tapped.
- **Each show's words.** Category lines and base names in the season's nouns (cast members, its groups); a line never left empty; a
  game in stages takes its first stage's verb; rows say what changed ("A new draft at the merge"; a game in stages lists its stages).
- **Status and targets.** The chips follow the scroll and an empty one hides; a dashed base says why on a tap; 44 px for the ready
  plate, the chips, Try it, the lock's fix and Change.
- **Smaller:** search drops little words ("to" no longer finds Together); "for" in the sheet's subtitle; Best ball and No bets get
  their own pictograms; the final's chips fit one line; a bank's numbers worked through on the game's screen; Try it on a community
  game; the maker's words said as theirs; the ready game drawn as Lower Third's caption plate; the sheet keeps a steadier height.

## Left open

- **A choice for the user:** when the recommended lock would cost someone on this couch a move (an all-yours draft defaults to When the
  next one airs, the user's own call, BACKLOG 68), should the gallery start on When you've watched it instead? PFD's R4 says safe
  defaults; the user's decision says live. Today: live, with the person named and the one-tap fix.
- **Outside the gallery:** the shared sheet's 40 px Back and Close; the bounce easing in `new.css` and the show bar; DESIGN.md's type
  ramp (14, 12, 17 and 20 px are in wide use but undocumented).
- **The build's:** the preview's practice copy from a spec (the steps are listed here, the real screens come in the B-lane); the sport's
  gallery; the nano-banana pictograms.

Questions skipped: the round pauses at its screenshot story for the user's review.

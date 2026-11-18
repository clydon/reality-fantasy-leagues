# B1, the game page's title card: Impeccable critique (step 4)

Method: dual-agent (A: design review · B: detector and measures), synthesized once. Target `src/new/show/game-title.tsx` in
`game-page.tsx` (`<header data-game-title>`), on the real 390 px frames in `.ui-atlas/stories/b1-title-card/after` (before in
`../before`). No code was edited. Impeccable owns craft here; the art's colour and the bar's name stay **the user's choices**
(spec open questions 1 and 3), and are named below, not decided.

## Score: 29/40 (Good, at the low end of the band)

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of status | 3 | The card rightly carries no state; t7 scrolled shows neither the name nor Back |
| 2 | Match with the real world | 3 | The TV title card lands; t5 says "before Episode 5" for an NFL game beside a "G 3" plate |
| 3 | User control | 3 | Back is first in view, but the bar isn't sticky (t7) |
| 4 | Consistency | 2 | Not yet the setup card's object: size, art, kicker and sentence all differ (t0 vs t1) |
| 5 | Error prevention (spoilers) | 4 | Series art only, no "Final" or place: the card can't spoil |
| 6 | Recognition over recall | 3 | The name is once in the first view; zero times after scroll |
| 7 | Flexibility and efficiency | 2 | It costs 72 to 139 px of every visit and nothing compacts on scroll |
| 8 | Aesthetic and minimalism | 3 | Strong hierarchy; the sentence restates How it plays' span (t1, t4) |
| 9 | Error recovery | 3 | The fit degrades gracefully (34 px, two lines, no ellipsis); the sentence clamps mid-word (t3) |
| 10 | Help | 3 | The sentence is a real introduction for the couch's others, but it is garbled in t4 |

**Specificity: authored, not generic.** Condensed caps over the show's own art, a show-and-season kicker, and the art
running from the bar into the week block as one surface: the Lower Third language, made for this product.

**Detector:** `impeccable detect` on `game-title.tsx`: 0 findings. `game-page.tsx`: 16 advisory `design-system-font-size`
findings, none in the header. The setup `TitleCard` (`parts.tsx` 312, 315) is flagged for `text-[40px]/[48px]/[14px]`. A clean
exit isn't proof of the ramp: the card's `text-[11px]`, `text-[15px]` and inline `fontSize` aren't checked. `overlaps.json`
records no words over words in all 16 frames, and every frame is within budget.

## What works
- **Measured stepping holds.** t1, t2, t5 and t6 are 48 px, one line. t4 "REDRAFT AT THE MERGE" is 48 px, edge to edge.
  t3's 41-character name is 34 px on two lines, with no ellipsis. The worst move ends at 423 px (t3).
- **The One Chyron Rule holds.** The card adds no yellow and no control. The only yellow is the move (t3, t5), and t6 has none.
- **The name is in the first view once, as a real `<h1>`**, with the bar's centre emptied.

## Findings, ranked

**[P1] Not the same object as the setup card (t0 vs t1).** There are five divergences:
- **Size.** The same name, FANTASY LEAGUE, is 40 px on setup (`parts.tsx` `long ? "text-[40px]" : "text-[48px]"`, `name.length > 12`) and 48 px on the page.
- **Art.** The setup card's art is grayscale at 50 % opacity, with `object-center` on a 150 px band. The page's is full colour at `objectPosition: center 25%`, behind a page-height backdrop.
- **Kicker.** "SURVIVOR · S51" vs "SURVIVOR · SEASON 51".
- **Sentence.** "Everyone picks a team of five castaways." vs "Everyone drafts 5 and starts 3 each episode, Episode 9 to the finale."
- **Team marks.** The setup card has a slot for a sport's marks; the page's card has none.

**Fix:**
- Move `STEPS`, `LEADING` and the fit into a shared `useTitleStep(ref, name)` and use it in both cards. Delete the length rule.
- Write one `titleKicker(show, season)` formatter in the bar's kicker form, used by the setup kicker, the card and the bar.
- Give the card the setup screen's own first sentence, from the same source, not a second writer.
- Give `GameTitleCard` a `mark?: ReactNode` in parts.tsx's `flex items-end justify-between gap-3` wrapper.
- Use one shared object-position for the art.
- **The art's tone goes to the user** as a named choice: grayscale on both (add `grayscale` and an opacity token to
  Backdrop's `<img>`; DESIGN.md's Show Art already says grayscale), or colour on both (drop `grayscale opacity-50` in
  parts.tsx). Only a mismatch fails. If grayscale wins, the orange "EP 9" plate (t1 to t4) also stops being the loudest
  colour in a view with no yellow.

**[P1] The sentence fails the person it exists for (t3, t4, t5).**
- t3: `line-clamp-2` cuts it at "does anyo…".
- t4: it reads "Draft, an Outlast: everyone drafts 2…".
- t5: an NFL game says "Episode 5".

**Fix:** build it with `show.words` (a sport says Game, Week, players); cap it at about 90 characters (two lines of 15 px
over 358 px) at the writer and drop `line-clamp-2`, so it never ends in an ellipsis. Taking the setup's source (above)
removes t4's garble with the second writer.

**[P2] Scrolled, nothing names the game or leads back (t7).** The spec's Scroll section ("the bar takes the name") can't
happen, because TopBar sits inside the `overflow-hidden` header and isn't sticky. This was already true before the card.

**Fix:** lift TopBar out of the header as `sticky top-0 z-10` with a ground fill once scrolled, and an IntersectionObserver
on `[data-game-card-name]` that hands the bar the name while the card's is out of view. (Open question 3, the user's; this
is the "once" option perception backs.)

**[P2] The kicker is muted ink over bright art (t1, t3, t4: the sunset sky behind the kicker).**
`type-caption truncate text-[11px] tracking-[0.08em] text-foreground/80`, under a 0.55 scrim.

**Fix:** use `text-foreground` (full ink, as DESIGN.md asks for text over art) and keep the 11 px caps, which is PFD's size.

**[P2] The fit can lock in a too-small step.** `useLayoutEffect` fits on mount and on resize only. If Archivo's `wdth`
axis loads after the first paint, the wider fallback font steps the name down, and it stays down.

**Fix:** also run `document.fonts.ready.then(fit)`, or swap the resize listener for a `ResizeObserver` on the `<h1>`.

**[P3] Markup.** Wrap the kicker and the `<h1>` in `<hgroup>` (the kicker sits outside the heading today), and have TopBar
render nothing instead of an empty `type-caption <b>` when `show=""`.

## Minor
- DESIGN.md's Title card entry (64 px, then 48 past 14 characters) and its Show Art line are stale; update both once the
  art's colour is decided. `firstVisit` keys on results, not your first move, so a watcher keeps the sentence for good
  (spec open question 2).
- Leave the spacing (`pt-1`, `mt-1`, `mt-2`, `pb-3`): about 24 px between the sentence and the EP plate (t1) separates
  identity from news cleanly.

## Same object? Not yet: a close sibling
The two cards share the face (`type-caption`, leading 0.86), white caps, the 16 px gutter, the 48 px step and a sentence under
the name. They part on size, art tone, art crop, kicker form, sentence wording and the sport's mark slot. Fixing those six
(the P1 batch, with the user's colour choice) makes them read as one object. The name's height on screen (about 207 px under
the setup sheet, about 75 px under the page's bar) is inherent to a sheet becoming a page and is fine.

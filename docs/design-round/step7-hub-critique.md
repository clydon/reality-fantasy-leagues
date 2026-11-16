# Step 7 critique: the hub (/home) and its TV guide

Method: dual-agent (A: design review, a077afc0423343e15 · B: detector + render evidence, aeeacb9bc391b1501). Impeccable `critique`, run once on 2026-11-15.
The evidence is the real 390×844 renders in `.ui-atlas/stories/step7-hub/after/` (and `before/`) plus `src/new/hub/{sections,guide}.tsx` and `src/new/screens/home.tsx`.
The live overlay was not injected: `/home` redirects to `/signin`, and signing in as an account was out of bounds. I checked sports-hub, hub-alex, hub-guide and sports-guide-sports by eye.
Fixture names and the empty All TV are not counted as faults.

## Design health score (Operate mode)

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 3 | The plate says the next thing well. "Pick who survives · 1 more / 0 of 4 picked" is ambiguous about whose count it is. |
| 2 | Match with the real world | 3 | Guide, TONIGHT and the NOW line read as TV. Sports "G 1" and "G 0" are jargon. |
| 3 | User control and freedom | 3 | The guide is a pushed page with ‹ Home, and you can swipe between days. The crawl moves targets under the thumb, endlessly. |
| 4 | Consistency and standards | 2 | "Due" is yellow on the plate but red on posters and guide cards. The Sports tab drops the week cells. Dashed outlines mean three things. |
| 5 | Error prevention | 3 | The page mostly reads and navigates. Drifting crawl tiles invite mis-taps. |
| 6 | Recognition over recall | 3 | Episode marks under faces are good. The day cells' 12 px art is unrecognisable, and muted vs bright marks are never explained. |
| 7 | Flexibility and efficiency | 3 | A crawl card opens the guide on its own day. The plate is one tap. The "+1 more" move has no direct way in. |
| 8 | Aesthetic and minimalist design | 3 | A big cut from the before. The sports title repeats its kicker, and the guide ends in half a screen of nothing. |
| 9 | Error recovery | 2 | The fallback states (no art, solo, sports) leave large empty or colliding slabs. |
| 10 | Help and documentation | 2 | Nothing says what a face's "Ep 5" counts. The guide has no key for faded couch cards. |
| **Total** | | **27/40** | **Acceptable, top of the band.** It has a solid structure and is held back by consistency, small type and its fallback states. |

**Cognitive load: moderate (2 fails, 1 partial).**
- Fail, one thing at a time: the endless crawl and the Ken Burns art both move beside the one call to action.
- Fail, four choices or fewer: the guide header has 5 controls in a row.
- Partial, working memory: you have to decode "1 more" plus "0 of 4". The day cells ask you to recognise art from 12 px thumbnails.

## Design specificity

**Authored, not interchangeable.** The channel bug with its crawl, the lower-third plate on the show's key art, the guide's time column with a yellow NOW line, and the side-by-side same-time cards are all TV graphics language. They belong to Lower Third. The parts that read generic:
- the guide's top row: a segmented control plus an outlined "+ Add", like a settings page
- the half-width dashed "At your own pace" card
- the sports Up next with no art: a dark slab with a ghost watermark

**Detector:** 50 findings, all from one advisory rule, `design-system-font-size`. No anti-pattern rules fired, and home.tsx is clean. By file: guide 15, sections 14, couch-pages 12, notes 3, streaming 3, profile 2, solo-hub 1. The 14 px hits are borderline false positives (inside the 13–15 tag step, though used as body text). The detector missed fractional sizes (`text-[12.5px]` at sections:1018, `text-[13.5px]` at :1065 and :1073). Agreeing with the review, the guide is where the small type concentrates.

## What's working

1. **One next thing.** The before stacked a status line, the couch row and a plate with a second, duplicated "moves due". The after folds all of it into one plate on the art. In hub-alex, all four sections (Up next, On TV, faces, Your shows) fit in the first 844 px, which is principle 6 met.
2. **Faces with episode marks** (hub-alex) answer "where is everyone" in one glance, spoiler-safe. You are ringed, each face is a 44×56 target, and the aria-labels carry what colour can't.
3. **The rundown** (hub-guide, hub-guide-tomorrow): a time column, NOW line and "TOMORROW Mon Nov 16" make a real TV guide that reads well at 390.

## Findings, most severe first

1. **[P1] The sports Up next collides and repeats itself** (sports-hub, sports-hub-hidden; also in before).
   - The when-line "TUE 7:18 PM · IN 2 DAYS" prints on top of the ghost watermark "COWBOYS AT EAGLES, NOV 17".
   - The 44 px title says the kicker again word for word ("Cowboys at Eagles, Nov 17 · G 1") and wraps to two lines.
   - The tag says "G 1", and in sports-hub-hidden your face says "G 0".

   Fix:
   - With no art, drop the watermark, or crop it top-right where no text sits.
   - The title becomes "Cowboys at Eagles". The date stays in the when-line, and the kicker becomes "NFL · Week 11".
   - Write "Game 1" (or the sheet's name) and hide a mark of 0.
2. **[P1] The plate's copy misleads at a glance** (hub-alex). "Pick who survives · 1 more" over "0 of 4 picked" reads as "pick 4 castaways, 1 to go". Andrew's 5-second read gets it wrong.

   Fix:
   - Title "Pick who survives", line "Couch: 0 of 4 in".
   - The second due move goes in its own "+1 more" affordance (DESIGN.md's Up next pager), never appended to the title.
3. **[P1] Guide type and targets fall below the system** (hub-guide, hub-guide-tomorrow, hub-guide-alltv).
   - Switch labels are 12 px in a 36–40 px control (guide.tsx:180).
   - Card metadata is 11 px (:343, :378, :670).
   - Watcher faces are 8 px letters in 14 px squares (:303).
   - The NOW line is 12 px (:571).
   - The own-pace "+" is about 34 px.
   - The measured chips are Couch 52×36, Competitions 90×36, All TV 48×36, Sports 53×36 and Add 67×40.

   Fix:
   - Switch at 15 px and 44 px tall.
   - Move "+ Add" into the pushed page's header right slot, so the row has 4 controls.
   - Metadata at 13 px, faces at 18 px, "+" at 44 px.
4. **[P2] The Sports tab is a different guide** (sports-guide-sports).
   - The week's seven day cells disappear, replaced by day columns that scroll sideways.
   - TUE 17 is cut mid-card ("ZDAL", "7:18" sliced) with no scroll cue.
   - The page contradicts its own spec ("a week of day cells, then the chosen day's rundown").

   Fix: keep the day cells on every tab and render sports as the same time-ordered rundown, with the score card as the row's content.
5. **[P2] "Due" and "live" share red.** Posters (hub-sam, hub-casey) and guide cards mark a due move with a red dot, while the plate says due in yellow. Red also means live (the ON TV dot, "On now", "ON NOW", the TODAY dot) and out.

   Fix: due is always chyron yellow, and red is only live or out.
6. **[P2] Perpetual motion competes with the plate** (hub-alex, sports-hub).
   - The crawl loops forever (`useRoll`, `loop: true`) beside infinite Ken Burns art and pulsing live dots. That is three endless motions in the first view, against DESIGN.md's "motion explains a change".
   - Bug: the guide card's live dot (guide.tsx:347) pulses with no `motion-reduce:animate-none`.

   Fix: the crawl drifts once and rests, and add the reduced-motion guard.
7. **[P2] The On TV bug changes shape** (hub-alex, sports-hub). The 86 px bug wraps "ON / TV" onto two lines when the live dot shows.

   Fix: widen it to about 96 px, or move the dot beside "Guide ›".
8. **[P2] hub-new-couch overloads the first view.** "Get the couch going" is a second full white plate under Up next, with three yellows (the EP 6 tag, the NEW COUCH tag, the "1" box). That breaks the one-yellow rule and puts a list in a plate, and pushes On TV and the faces below the fold.

   Fix: hairline rows under a 24 px heading, ink step numbers, no yellow.
9. **[P3] Fallback states end flat.**
   - hub-solo keeps a 280 px art slab with no plate.
   - The guide ends with a half-width dashed card and about 50% empty screen (hub-guide, sports-guide-sports).
   - The own-pace no-art thumbnail clips "ZT DRO…" in 54 px.

   Fix:
   - Let the slab shrink when there's no plate.
   - Make the own-pace card full width.
   - Give the no-art thumbnail a monogram rather than clipped words.

## Words over words, clipping, wrapping

- **sports-hub, sports-hub-hidden:** the when-line sits on the watermark game name (finding 1).
- **hub-guide, -tomorrow, -alltv:** the red live dot (guide.tsx:534, `right-1.5 top-1.5`) sits on the "Y" of TODAY.
- **hub-sam, hub-casey, first poster:** "ZT SURVIVOR" is set over the art's own baked-in SURVIVOR logo and reads doubled. A scrim, or a rule that skips the title when the art carries a logo, would fix it.
- **hub-alex:** the art's logo letterforms peek out under the plate (about y 680 in the 2× render).
- **hub-alex, sports-hub:** "ON / TV" wraps (finding 7).
- **hub-alex.full, feed:** season numbers are orphaned on their own line ("ZT Same Night / 3", "ZT Late Show / 12"). Use a non-breaking space before the number.
- **sports-hub-hidden:** the couch subline truncates to "Cowboys at Eagles, …".
- **sports-guide-sports:** the TUE 17 card is cut at the edge (finding 4).
- **All guide frames:** the own-pace no-art thumbnail clips the show name.

## Type sizes (DESIGN.md: 24 / 22 / 19 / 15 tag / 16 body / 13 detail / 11 badge)

- **Below 13 px in the renders:**
  - guide: switch 12 (:180), NOW 12 (:571), time and "On now" tags 11 (:343, :670), episode line 11 (:378), faces 8 (:303)
  - sections: couch subline 12 (:489), poster "Best 1st" and season 12 (`text-xs`, :563, :576)
  - The render JSON confirms sizes 8, 9, 11 and 12 on hub-guide, and 11 and 12 on hub-alex.
- **Below 13 px in code paths these renders don't show:**
  - guide: 10 px at :361, :373, :464, :477, :479; 11 px at :422–427; 12 px at :487
  - streaming: 9 px at :140
- **Off the scale:**
  - 14 px: plate line (sections:313), "2 more moves" (:331), rundown date (guide:592)
  - 17 px: guide:377, :426; sections:488, :598, :701
  - 18 px and 20 px: when-line at sections:286
  - 12.5 and 13.5 px: sections:1018, :1065, :1073
  - The 44 px Up next title is a defensible hero.
- **Rule:** an 11 px size is legitimate only as a caps badge. Lines that people read (detail and metadata) go to 13 px.

## Targets under 44 px

- **hub-sam:** Watch along 122×36 (sections:346).
- **hub-alex:** "2 more moves" at 36 px tall (:331). The poster back faces have Flip back 40×40 (:599) and Open 142×40, and "Add to my shows" is 176×40.
- **Guide:** the switch chips at 36 px tall, and the own-pace "+" at 34×34.

## Persona red flags

- **Andrew (glances for 5 seconds):** reads the plate's title, misses the extra move, and takes "0 of 4 picked" as his own count.
- **Joanna (has lost track):** hub-sam's "Reveal the results · Ep 4" is right, but nothing says she is two behind. Add "You're on Ep 3 · 2 behind" to the plate's line.
- **Casey (one-handed):** the guide switch is at the top left and 36–40 px tall. The crawl is a moving target, and Watch along is 36 px.
- **Sam (accessibility):** 8–12 px type across the guide. The muted vs bright mark is colour-only on screen. The live dot ignores reduced motion. The red/yellow "due" split hurts colour-deficient users most.
- **Jordan (first-timer):** "G 1" means nothing to Jordan, and no key explains faded couch cards.

## Questions for the user (to choose the next pass)

1. Which first-view element earns endless motion? (a) the crawl only, with the art still; (b) the art only, with the crawl drifting once; (c) neither, both move once on arrival.
2. Should "due" be yellow everywhere and red be live only? (a) yes; (b) keep red dots for due on posters; (c) give live its own tone.
3. Scope of the fix pass? (a) the three P1s only; (b) P1s plus the guide's Sports-tab consistency; (c) everything above.

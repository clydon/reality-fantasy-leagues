---
name: Reality Fantasy Leagues
description: Fantasy leagues for any TV show, styled as the on-screen graphics reality TV runs.
colors:
  night-ground: "#16141d"
  night-panel: "#221f2c"
  night-panel-raised: "#2a2633"
  night-rail: "#100e15"
  night-line: "#2e2a3a"
  night-field-line: "#3a3548"
  bone-text: "#f4f2f8"
  dusk-muted: "#a9a4b8"
  chyron-yellow: "#ffc531"
  chyron-ink: "#121018"
  caption-plate: "#ffffff"
  plate-ink: "#121018"
  plate-muted: "#4a4558"
  live-red: "#f2545b"
  live-ink: "#2a0a0c"
  safe-teal: "#35b5a5"
  safe-ink: "#0e2b27"
  gold-accent: "#e0b23a"
  chyron-line-night: "#ffc531"
  studio-ground: "#ecebf1"
  studio-panel: "#f8f7fb"
  studio-raised: "#e1dfe8"
  studio-hover: "#dcd9e4"
  studio-line: "#d6d3de"
  studio-field-line: "#b9b4c6"
  night-ink: "#16141d"
  studio-muted: "#5d586b"
  chyron-line-studio: "#845800"
  live-red-studio: "#c02a34"
  safe-teal-studio: "#0b7568"
  gold-accent-studio: "#85601a"
  chart-ember: "#f2804b"
  chart-orchid: "#a76bb0"
  chart-lake: "#5089c9"
typography:
  caption-xl:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "0.01em"
    fontVariation: "'wdth' 62"
  caption-lg:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "0.01em"
    fontVariation: "'wdth' 62"
  caption-md:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "19px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "0.01em"
    fontVariation: "'wdth' 62"
  caption-tag:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "0.04em"
    fontVariation: "'wdth' 62"
  number-hero:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "44px"
    fontWeight: 800
    lineHeight: 1
    fontFeature: "'tnum' 1"
    fontVariation: "'wdth' 62"
  number-row:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 800
    lineHeight: 1
    fontFeature: "'tnum' 1"
    fontVariation: "'wdth' 62"
  body:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  body-strong:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.4
  detail:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.3
  badge:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.025em"
  mono:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.4
rounded:
  plate: "3px"
  base: "4px"
  button: "6px"
  sheet: "14px"
  pill: "9999px"
spacing:
  gutter: "16px"
  plate-x: "12px"
  plate-y: "8px"
  row-gap: "12px"
  section: "24px"
components:
  caption-plate:
    backgroundColor: "{colors.caption-plate}"
    textColor: "{colors.plate-ink}"
    typography: "{typography.caption-lg}"
    rounded: "{rounded.plate}"
    padding: "8px 12px"
    height: "60px"
  caption-plate-sm:
    backgroundColor: "{colors.caption-plate}"
    textColor: "{colors.plate-ink}"
    typography: "{typography.caption-md}"
    rounded: "{rounded.plate}"
    padding: "8px 12px"
    height: "52px"
  caption-tag-chyron:
    backgroundColor: "{colors.chyron-yellow}"
    textColor: "{colors.chyron-ink}"
    typography: "{typography.caption-tag}"
    padding: "0 20px 0 12px"
  caption-tag-live:
    backgroundColor: "{colors.live-red}"
    textColor: "{colors.live-ink}"
    typography: "{typography.caption-tag}"
    padding: "0 20px 0 12px"
  caption-tag-good:
    backgroundColor: "{colors.safe-teal}"
    textColor: "{colors.safe-ink}"
    typography: "{typography.caption-tag}"
    padding: "0 20px 0 12px"
  caption-tag-quiet:
    backgroundColor: "{colors.night-panel-raised}"
    textColor: "{colors.bone-text}"
    typography: "{typography.caption-tag}"
    padding: "0 20px 0 12px"
  button-primary:
    backgroundColor: "{colors.chyron-yellow}"
    textColor: "{colors.chyron-ink}"
    rounded: "{rounded.button}"
    padding: "8px 15px"
  button-secondary:
    backgroundColor: "{colors.night-panel}"
    textColor: "{colors.bone-text}"
    rounded: "{rounded.button}"
    padding: "8px 15px"
  button-destructive:
    backgroundColor: "{colors.live-red}"
    textColor: "{colors.caption-plate}"
    rounded: "{rounded.button}"
    padding: "8px 15px"
  plate-button-chyron:
    backgroundColor: "{colors.chyron-yellow}"
    textColor: "{colors.chyron-ink}"
    rounded: "{rounded.plate}"
    padding: "0 16px"
    height: "44px"
  input:
    backgroundColor: "{colors.night-panel}"
    textColor: "{colors.bone-text}"
    rounded: "{rounded.base}"
    padding: "7px 10px"
    height: "44px"
  bottom-sheet:
    backgroundColor: "{colors.night-panel}"
    textColor: "{colors.bone-text}"
    rounded: "{rounded.sheet}"
    padding: "8px 16px 16px"
  sheet-action:
    textColor: "{colors.bone-text}"
    typography: "{typography.body-strong}"
    height: "52px"
  sheet-action-danger:
    textColor: "{colors.live-red}"
    typography: "{typography.body-strong}"
    height: "52px"
  standings-row:
    textColor: "{colors.bone-text}"
    typography: "{typography.body-strong}"
    height: "48px"
  standings-row-you:
    backgroundColor: "{colors.night-panel-raised}"
    textColor: "{colors.bone-text}"
    rounded: "{rounded.plate}"
    height: "48px"
  you-badge:
    backgroundColor: "{colors.bone-text}"
    textColor: "{colors.night-ground}"
    typography: "{typography.badge}"
    rounded: "2px"
    padding: "1px 6px"
---

# Design System: Reality Fantasy Leagues

<!-- Scope: both modes are direction A ("Lower Third"): the same components, type and shapes on two
     grounds. Unprefixed colour tokens above are dark mode ("Night", the `.dark` block in
     src/app/globals.css); the `studio-*` and `*-studio` tokens are light mode ("Studio", `:root`).
     Plate, plate ink, chyron fill and chyron ink are the same in both. Component tokens reference
     the Night values; on Studio each resolves to its Studio twin through the same CSS variable. -->

## Overview

**Creative North Star: "Lower Third"**

The app speaks in the on-screen graphics reality TV already uses: the strip across the bottom of the frame that names who's talking, the yellow bar that says something is happening now, the red bar when someone's gone home. Players use it on a phone, on the couch, the night an episode airs, so the ground is night-dark and everything that matters sits on a white caption plate that reads instantly against it. The rest of the screen stays quiet and flat so those plates carry the news.

Density is a rundown, not a dashboard. Overview sections have no boxes, just a condensed caps heading over their content, in the order a broadcast would run them. One family, Archivo, does everything, and its width axis does most of the work: normal width for anything you read, the condensed end in caps for names, headings and numbers. Colour is rationed. Chyron yellow means "now" or "you", live red means out, and tribe or team colours appear only as small tags.

It runs on two grounds. **Night** (dark mode) is the evening couch: a violet-black ground. **Studio** (light mode) is the same graphics package on a bright set: a pale cool grey, so the white plates still read as laid over the picture, with the night colour as ink. Everything but the colour values is shared; a component never changes shape between modes.

The product is any show, not just Survivor, so the vocabulary is broadcast television in general, not one show's world. No torches, tiki, jungle textures or tribal patterns.

**Key Characteristics:**
- Night or Studio ground, white caption plates, one yellow accent for "now".
- Archivo throughout; condensed (wdth 62) 800-weight caps for captions and numbers.
- Flat sections separated by headings and hairlines, not cards.
- Nearly square corners (3–4px) on everything that is broadcast graphics; only the bottom sheet is rounded.
- Mobile first: designed at 390px, 44px minimum touch targets, 16px text in every field.

## Colors

A cool violet-black night (or its daylight twin, a pale violet-grey studio) with one hot accent and one alarm colour; everything else is neutral. The values below are Night's; **Studio** is listed after them.

### Primary
- **Chyron Yellow** (#ffc531): "This is happening now, and it's yours." The alert strip's tag, your turn, the primary action, text selection. It is the shadcn `primary` in both modes, always as a fill with Chyron Ink on it.
- **Chyron Line** (`--chyron-line`): the chyron used as text, an outline, a border or a small dot: links, the active tab, the leader's rank, focus rings, a selected tile's outline, progress segments, "needs you" dots. On Night it is the yellow itself; on Studio it is a deep amber (#845800), because yellow as a line or text disappears on a light ground. It is also `ring` and `accent-foreground`.
- **Caption Plate** (#ffffff): the white bar that names and moments sit on. It's a surface, not text colour: only plates, the alert strip and the "You" badge are white-backed.

### Secondary
- **Live Red** (#f2545b): eliminations, "Out", destructive actions and errors. Its ink (#2a0a0c) is near-black red, so a red tag reads like broadcast "LIVE", not a warning dialog.
- **Safe Teal** (#35b5a5): good news: safe, correct pick, points gained. Tag ink is #0e2b27 (`--good-foreground`).

### Tertiary
- **Gold Accent** (#e0b23a): the old `accent-2`, kept for secondary emphasis that predates the redesign. Prefer Chyron Yellow in new work.
- **Chart set**: Ember (#f2804b), Safe Teal, Orchid (#a76bb0), Lake (#5089c9), Chyron Yellow. Only in charts and player colour dots.

### Neutral
- **Night Ground** (#16141d): the page.
- **Night Rail** (#100e15): the sidebar and menu panel, one step darker than the page.
- **Night Panel** (#221f2c): cards, popovers, sheets and fields; the only raised surface.
- **Night Panel Raised** (#2a2633): muted fills: your own standings row, the quiet tag, secondary buttons on hover.
- **Night Line** (#2e2a3a): row dividers and borders; also the hover fill (`accent`).
- **Field Line** (#3a3548): input borders, a step brighter than row lines so fields are findable.
- **Bone Text** (#f4f2f8): body text on the night.
- **Dusk Muted** (#a9a4b8): secondary text, ranks other than first, labels.
- **Plate Ink** (#121018) and **Plate Muted** (#4a4558): text on a caption plate.

### Studio (light mode)
The same roles on a bright set. Plates, plate ink, the chyron fill and its ink don't change.
- **Studio Ground** (#ecebf1): the page. Pale and cool, a step darker than a plate so white plates still read as graphics over it.
- **Studio Panel** (#f8f7fb): cards, popovers, sheets, fields, and the header, tab bar and sidebar (a step brighter than the ground, where Night's rail is a step darker).
- **Studio Raised** (#e1dfe8): muted fills: your own row, the quiet tag, the segmented control's track. **Studio Hover** (#dcd9e4) is `accent`.
- **Studio Line** (#d6d3de) for row hairlines; **Studio Field Line** (#b9b4c6) for input borders.
- **Night Ink** (#16141d): body text, the night colour turned into ink. **Studio Muted** (#5d586b): secondary text, 5.2:1 or better on every Studio fill.
- **Chyron Line** is deep amber (#845800). **Live Red** deepens to #c02a34 with white ink, **Safe Teal** to #0b7568 with white ink, **Gold Accent** to #85601a: each is 4.5:1 or better as text on the ground and as the fill behind its ink.
- The You badge, the chosen side of a segmented control and your turn pills, bone on Night, are ink on Studio: they're `foreground` fills, so they invert with the ground.

### Named Rules
**The Fill Not Line Rule.** `chyron` (and `primary`) is only ever a fill with Chyron Ink on it. Anything else yellow (text, an outline, a border, a dot, an underline) uses `chyron-line`. On Night they look identical, so the mistake only shows on Studio. The same split holds for `good` (the colour) and `good-foreground` (the ink on a `good` fill); never hard-code tag ink.

**The One Chyron Rule.** Yellow means "now" or "you". If more than one thing on a screen is yellow, one of them is wrong. Never use it for decoration or as a generic brand colour.

**The Red Is For Leaving Rule.** Live Red is for someone going home and for actions that delete. Losing points is not an elimination; use muted text or a down chart bar, not red text everywhere.

**The Tags Not Fills Rule.** Tribe, team and player colours appear as a small tag, dot or the angled end of a plate, never as a large background.

## Typography

**Display Font:** Archivo, condensed end (variable `wdth` 62%, weight 800), uppercase
**Body Font:** Archivo, normal width (weights 400–700)
**Label/Mono Font:** IBM Plex Mono, kept only for code-like content and a few legacy number cells

**Character:** One family split by width, like a broadcast package. The condensed caps are loud and compact, so a long castaway name still fits a 390px plate; the normal width underneath is plain and readable.

### Hierarchy
- **Section heading** (800, 24px, condensed caps, line-height 1): Overview sections and other page sections (`section-title`, `DashCard`).
- **Page title / plate title** (800, 22px, condensed caps): the mobile header's page name, caption plate titles, bottom sheet titles.
- **Small plate title** (800, 19px, condensed caps): the alert strip and small plates.
- **Tag** (800, 13–15px, condensed caps, 0.04em tracking): the angled tag on a plate.
- **Hero number** (800, 44px, condensed, tabular): the single big number in a section (`DashBig`).
- **Row number** (800, 24–26px, condensed, tabular): ranks and totals in standings rows.
- **Body** (400–600, 16px): rows, names, paragraphs. Names in rows are 600.
- **Detail** (400, 13px): the second line on a plate, the league name above a page title.
- **Badge** (700, 11px, caps, wide tracking): "You" and similar inline badges.

### Named Rules
**The Width Not Weight Rule.** Hierarchy comes from switching to the condensed caps, not from piling on sizes. Body text stays normal width; captions and numbers go condensed. There is no third style.

**The Tabular Numbers Rule.** Any number that sits in a column (rank, score, streak) is condensed and tabular so columns line up.

**The 16px Field Rule.** On phones every text field is 16px, whatever its size class, so iOS never zooms on focus. This is a global rule in `globals.css` and must not be overridden.

## Layout

Single column at phone width with a 16px gutter; designed and checked at 390×844 first. The `nav` breakpoint (880px) is the only structural one: below it, a top header plus a bottom tab bar; above it, a sidebar. Overview sections become a two-column grid from `sm` up, with wide sections spanning both.

The mobile header centres the page's own name in condensed caps, with the league name small above it (still the league switcher, still swipeable between linked leagues). The alert strip sits at the top of the content, one item at a time with a pager.

Rows are at least 48px tall, separated by hairlines rather than gaps. Touch targets are at least 44px; inputs and selects are 44px tall on phones (40px for the dense size). Sections are spaced roughly 24px apart; within a section, rows run edge to edge with no internal padding.

## Elevation & Depth

Flat by default. Sections have no box, border or shadow; depth comes from tone (ground → panel) and from hairlines. Shadows exist only on things that float over the broadcast, as tokens so each mode gets its own strength (`shadow-plate`, `shadow-sheet`, `shadow-bar`, `bg-(--scrim)`):

- **Plate lift** (`--plate-shadow`; Night `0 6px 18px rgba(0,0,0,0.3)`, Studio `0 1px 2px rgba(22,20,29,0.1), 0 4px 14px rgba(22,20,29,0.14)`): caption plates, the alert strip and the vote-out card, so they read as graphics laid over the picture. On Studio the tight first layer gives a white plate its edge against the pale ground.
- **Sheet lift** (`--sheet-shadow`; Night `0 -12px 30px rgba(0,0,0,0.45)`, Studio `0 -10px 30px rgba(22,20,29,0.16)`): bottom sheets, rising from below.
- **Bar lift** (`--bar-shadow`; Night `0 -10px 24px rgba(0,0,0,0.35)`, Studio `0 -6px 18px rgba(22,20,29,0.1)`): sticky confirm and action bars.
- **Scrim** (`--scrim`; Night `rgba(8,6,12,0.6)`, Studio `rgba(22,20,29,0.45)`): behind sheets and dialogs.

### Named Rules
**The Only Plates Float Rule.** If it isn't a caption plate, an alert, a sheet or a popover, it doesn't get a shadow.

## Shapes

Broadcast graphics are hard-edged, so nearly everything is square: 3px on plates, strips and the buttons inside them, 4px as the dark theme's base radius (shadcn `--radius`), 2px on badges. The signature shape is the caption tag's angled right edge (`clip-path: polygon(0 0, 100% 0, 84% 100%, 0 100%)`), which the white plate tucks under by 10px. The one soft shape is the bottom sheet's 14px top corners, because it's a phone-native surface, not a graphic. Round shapes are only for dots (player colours), the sheet's grab handle and avatar-style icons.

## Components

### Caption Plate (signature)
Direction A's signature, in `src/components/ui/caption-plate.tsx`, for the moments that matter: your turn, results are in, last week's score, who went home. Not for every row.
- **Structure:** an angled tag (one or two words: "New", "Ep 3", "Out") in a tone colour, then a white plate with a condensed caps title and an optional one-line detail, then an optional action label with a chevron.
- **Tones:** chyron (now / yours), live (out), good (safe, won), quiet (informational). A tribe's own colour can replace the tag colour.
- **Sizes:** 60px tall (22px title) or 52px small (19px title).
- **States:** as a link or button, hover brightens slightly (`brightness 1.04`); focus shows a 3px chyron-line outline offset 2px.
- **Variants built from it:** the alert strip (`action-bar.tsx`), the reveal prompt and "reveal first" (`results-in-banner.tsx`), Last Week, who left (episode page and Overview), and Classic's "banks" plate with a player-coloured tag.

### Alert Strip
The caption plate as the app's to-do list (`action-bar.tsx`). Chyron tag names the kind of thing ("Your pick", "Lineup", "Invite"), the plate gives the message and the league. Controls inside the plate are 44px square, divided by faint plate-muted lines; an invite's "Join" is a small chyron button, "Decline" an outlined one.

### Buttons
- **Shape:** slightly rounded (6px). Still the ported shape from the old app; plate-embedded buttons are 3px.
- **Primary:** Chyron Yellow with Plate Ink, 8px × 15px, 13.6px semibold.
- **Secondary:** night panel with a hairline border, no shadow; hover fills with Night Panel Raised.
- **Destructive:** Live Red. Use it only in a confirmation step; in lists, destructive actions go in a bottom sheet as red text.
- **Hover / Focus:** hover brightens 6%, press nudges down 1px, focus is a 3px ring in the ring colour at 50%. Disabled is 40% opacity.

### Inputs / Fields
- **Style:** panel fill, Field Line border, 4px radius; 44px tall on phones (40px dense), 16px text.
- **Focus:** the border switches to chyron-line with a 3px soft halo (`--focus-halo`: 18% yellow on Night, 16% amber on Studio).
- **Disabled:** 50% opacity, not-allowed cursor.

### Bottom Sheet
Row actions in a sheet from the bottom (`bottom-sheet.tsx`), replacing rows of buttons. Night panel, 14px top corners, a grab handle, a condensed caps title with an optional detail beside it, actions as 52px rows split by hairlines, destructive actions last in red text, and a full-width Cancel at the bottom. Slides up over 200ms; respects the safe-area inset. On wide screens it's capped at 480px and centred.

### Cast Tile and Confirm Bar (pickers)
Every picker (draft, blind draft, replenish, swap) works the same way, in `src/components/draft/draft-ui.tsx`: tap a tile to select it, then confirm in a bar. Nothing happens on a single tap.
- **Cast tile:** a white plate with the photo on top (fixed height on phones, square from `sm` up), the first name in 15px condensed caps, and the tribe as a small colour square plus name. Selected to add: 3px chyron outline with a chyron tick badge. Selected to drop: the same in live red with a cross. Unavailable: muted fill, greyed photo, and optionally a line saying why in place of the tribe ("Used Ep 1"). Four across on a phone (three for the roomier mid-season grids).
- **Confirm bar:** sticky at the bottom of its picker, sitting on `--tabbar-h` so it clears the mobile tab bar; full bleed on phones, a bordered bar on desktop. A small muted line (the pick, who it's for), the selection's name in 22px condensed caps, and one chyron button that names the action ("Draft Jelly", "Give to Sam", "Lock in", "Swap"), disabled until there's something to confirm.
- **Turn pills:** the order strip. Your turns are bone-white like the You badge; the current turn has a 3px chyron underline; finished turns are struck through.

### Settings pages
League Settings is a list of pages, like a phone's settings (`src/components/setup/settings-ui.tsx`).
- **Index row:** 60px, icon, name in 16px semibold, its current value in 13px muted underneath, chevron. The list doubles as a summary; a chyron dot marks one that needs the commissioner.
- **Toggle row:** label and a line of help on the left, a switch on the right (chyron when on); the whole row toggles.
- **Stepper row:** label and help on the left, − value + with 44px buttons on the right; read-only, just the number.
- **Fields:** label above, 48px full-width control, help below. Anything locked or read-only is plain text (with a lock when it's locked by the game), never a greyed-out control.
- **Row actions** are a ⋯ button opening a bottom sheet; page actions are a ⋯ beside the page's first line. Page-level destructive actions sit in a collapsed Danger zone at the bottom of the index.

### Full-screen flow (create a league)
A multi-step task gets the whole screen, with no tab bar or sidebar (`/new-league`, `create-league-flow.tsx`): a header with ✕ (first and last step) or back, the flow's name and "N of 4"; a row of 4px segments, chyron up to the current step; the step's question as a 30px condensed caps heading; and one full-width 52px button in a sticky footer. Choices are **option cards**: a night panel with a hairline, and when chosen a white plate with a 3px chyron outline and a tick. Show tiles are 84px key art (a plain 64px tile without art) with the season as a small dark chip.

### Section (Overview)
`DashCard` and the shared `section-title`: no box at all, just a 24px condensed caps heading in Bone Text over the content, with an optional aside on the heading line. Sections read like a broadcast rundown.

### Standings Row
48px rows divided by hairlines: a condensed rank (ties as "T1"; the leader's in chyron-line, and nobody's when everyone is level), the player's colour dot, the name in 16px semibold, and a condensed tabular total on the right. Active Roster adds the latest episode's score in 13px muted text before the total. Your own row is lifted with a Night Panel Raised fill and a white "You" badge. Classic rows are 62px: the name line carries "2 of 3 standing" in 12px muted, and under it the team as 30px faces (still in first; out ones greyed with their finishing place on a small live-red corner badge, a finalist's in teal), then one muted line on how boot-order scoring works.

### Scoreboard and the commissioner's to-do list
- **Scoreboard rows** link to the player's own page and take the shape of the league type's scoring: a team's faces (out ones greyed, with where they finished in Live Red), a per-episode table, or streak columns. Ranks show ties as "T1"; the leader's rank is chyron-line, and nobody's when everyone is level. Your row is lifted like the standings row.
- **Commissioner list** (top of Overview): a muted 19px condensed caps label, then hairline rows (title, one line of detail, the action's name and a chevron). Only shown when something is waiting, and with no yellow, because the alert strip above it already holds the screen's "now".

### Lineup (Active Roster)
Setting a lineup is the weekly job, so it has its own page and tab (`/lineup`, `lineup/lineup-page.tsx`).
- **Mine / Everyone:** a two-way segmented control on a night panel; the chosen side is a bone-white
  fill with dark text, like the You badge. Under it, one muted line with a clock: when it locks and
  how long until then (a lock icon once it has).
- **Starters** are cast tiles three across with 112px photos; tapping one benches it. An empty slot
  is a dashed plate-muted outline with a plus and "Open slot".
- **Bench rows** are 62px: a 46px square photo, name, tribe and last episode's points (saying when
  they were benched), and Start on the right. Start is the chyron button only while there's room;
  otherwise it's an outlined "Full", so yellow shows only when there's something to do.
- **Everyone rows** are 76px: the player's dot and name over a small Set (teal) / Not set (muted)
  chip, then their starters as 44px faces, "?" squares when hidden, dashed squares for open slots.
- **Starting this week** on Overview is the read-only version of the tiles with a Change link, the
  bench as 32px round faces, and Last week as a small good-tone caption plate.
- **Your season** (Scoreboard): two-up night-panel cards (4px corners), a muted label, a 40px face,
  the first name and a 20px condensed number; points left on the bench are muted.

### Classic: team plates and the boot order
Classic scores by who's still standing, so its screens lead with faces and places.
- **Your Team** (Overview): one 60px row per castaway, a 54px photo then a white plate with the name in 21px condensed caps and a line under it (tribe chip and "Still in"). Someone out drops to a Night Panel Raised plate with a greyed photo, a live-red "Out" chip and "Episode 1 · finished 21st · +1"; the winner gets a chyron chip. Two up from `sm`.
- **Latest episode** (Overview, every type but Active Roster's league table): who left as small "Out" caption plates, Classic's detail being "Finished 20th · Sam banks 2", and a link to the episode's page.
- **Episode page:** the Out plate says where they finished; then a small plate per owner who scored, "+3" in a tag of **the player's own colour** (`colourTag` picks plate ink or white for it) and "Andrew banks 3"; then "Called it" (good tone) when your prediction paid. **Boot order** follows: everyone out so far as 52px greyed faces with their place in live red (this episode's ringed), then "19 castaways still in, 2 of yours among them" with the number in 28px condensed.
- **Episodes list:** a Classic row's detail is who banked what and whether your prediction paid ("You bank 1 · your prediction was right, +2"); under the list, "19 of 21 castaways still in the game".

### Eliminator Pool: the pick and the streak
The Pool is one pick a week and a streak, so its screens lead with those two things.
- **Pick page** (`/pick`, `pick/pick-page.tsx`, the tab bar's fourth slot): a muted line with a clock (when picks close; "Open until Episode 3 is revealed" in a catch-up league), "Who survives Episode 3?" with one muted sentence on who's used and why, the tribe filter, and everyone still in as cast tiles four across. Used ones are dimmed with "Used Ep 1" (or "Last pick · Ep 2") in place of the tribe line. Tap a tile, then **Lock in Rob** in the confirm bar; with a pick saved, the bar names it and says it can change until it airs.
- **Overview:** the streak as a 104px condensed number (bone, not chyron: the alert strip owns the yellow) beside "In a row" and one muted line on where it leaves you ("Tied for 1st with Josie"). Then **Your picks**: 64px faces, oldest first, with a teal tick (survived) or live-red cross (went home, face greyed) on the corner, and this week's slot as a dashed square with a plus. Then **Episode N picks**: one 48px row per player, a Picked (teal) or Not yet (muted) chip; nobody else's pick shows until the episode airs.
- **Episode page:** your pick as the reveal's vote-out card (230px photo, a good or live tag "Your pick survived" / "went home", the name and the streak on a white plate); the Out plate for the same person is left out. Then everyone else's pick as 64px rows: face (greyed if out), "Josie picked Patt", "Streak 3" or "Streak ends at 2", and a Safe / Out / Missed chip.

### Spoiler gate and the reveal
Results a player hasn't chosen to see stay out of every screen until they do.
- **The question:** every Reveal opens one bottom sheet, "Reveal Episode 3?", one sentence on what
  they'll see, and two buttons side by side: **Not yet** (secondary) and **Reveal** (chyron, wider).
  No other Cancel.
- **While hidden:** the alert plate says "Episode 3 is in"; Standings carries an "As of Episode 2"
  pill (eye-off icon, night panel); the latest episode is a locked card with grey placeholder
  shapes under a blur and a lock. Never blur real photos or names: a blurred face is still a face.
- **The reveal** (`/reveal/N`) is full screen with no app chrome, and **always plays on Night**, even in light mode (its root carries `dark`): it's the broadcast itself, like the TV coming on. Its layout: league name and Skip at the top,
  progress dots at the bottom, tap anywhere for the next beat. Beats run like a broadcast: a
  "Previously on" bumper in 64px condensed caps, each challenge's winners as caption plates (good
  tone, or the tribe's colour in the tag), each exit as the **vote-out card** (the photo full width,
  a live-red tag with how they left, the name in 30px on a white plate across its foot), earlier
  plates of the same episode staying stacked above in the small size, then the viewer's result as a
  140px chyron number with one or two muted lines. The last beat's button is a white plate, so the
  number stays the only yellow. Beats fade and slide up over 300ms, only when motion is allowed.

### Admin area
Admin is desktop-first but built to work at 390px, in the same vocabulary as League Settings: pages, rows and sheets, not one long page (`/admin/*`, `src/components/admin/`).
- **Chrome:** its own, never a league's. On a phone a header (Back, a small "Admin" line over the page's name in 22px condensed caps, and a **Paid AI on/off** chip that links to Site; chyron when on) and a tab bar of **To do · Shows · Users · Leagues · Site**, with a chyron dot on To do while anything waits. On desktop a Night Rail sidebar with "Back to {league}" on top, the same sections plus Formats & rules and Reports. No alert strip, league swipe or install banner.
- **To do:** "Needs you" as 60px rows (a 40px icon square, title, one line of detail, the action), most urgent first; only the first row's button is chyron. A season with more than two waiting episodes is one row. "Coming up" lists each airing season's next episode.
- **Pages:** `AdminPage` gives each one a desktop back link and 28px title, one muted summary line, and a ⋯ for page actions. Lists are hairline rows; anything destructive is red text last in a ⋯ sheet or behind a collapsed Danger zone. A season page has four segmented tabs (Episodes, Cast ✓, Rules, Setup), each its own route.
- **Sticky bar:** the one primary action of a page (Approve and send to 4 leagues, Accept all 12, Review 31, Review the format) sits in a bar above the tab bar, with one muted line of what it does. Pages are at least a screen tall, so on a short page the bar rests at the bottom.
- **Review:** a segmented "Spoilers hidden / Show names" (it follows Site's switch until flipped). Hidden is counts only. Shown, "Needs a look" rows (low confidence or not in the cast) carry their reason in Gold Accent and a 44px live-red ✕ and teal ✓; the rest are one row per kind of result that opens to its people. Any result opens a sheet with its sources, confidence, who decided it, and Accept / Correct… / Reject.
- **Copy-and-paste flows** (an episode's research, a new show's rules): numbered steps with a 30px step number, chyron on the current step; the copy button is chyron until something's pasted.

### Navigation
Mobile: a header with the page's name in 22px condensed caps and the league name in 12px above it, chat on the right; a fixed bottom tab bar. Its fourth slot follows the league and the season's phase: Draft until the draft is done, then Lineup (Active Roster), Mid-Season or Chat; Eliminator Pool has no draft, so its slot is always Pick, badged while your pick is due (Chat is on the header); Research and anything else displaced go in More. Desktop (880px+): a Night Rail sidebar. The current tab is marked in chyron.

## Do's and Don'ts

### Do:
- **Do** put "now" moments on a Caption Plate with a chyron tag, and keep them to one or two per screen.
- **Do** use the condensed caps (`type-caption`) for names, headings and tags, and `type-num` for any number in a column.
- **Do** keep sections flat in both modes: a heading and hairlines, no card box.
- **Do** check every new screen in both modes; a yellow line or text that looks right on Night is invisible on Studio.
- **Do** design at 390px first, with 44px touch targets and 48px rows.
- **Do** use the show's own terms (castaways, tribes, Faithful, teams). The graphics are generic TV; the words belong to the show.
- **Do** put destructive row actions last in a bottom sheet, as red text after a divider.

### Don't:
- **Don't** use Chyron Yellow decoratively or on more than one competing element.
- **Don't** use Live Red for anything except leaving the game and deleting.
- **Don't** fill large areas with tribe or team colours; they're tags.
- **Don't** add shadows to sections, rows or ordinary cards.
- **Don't** round graphics past 4px, or give the caption tag a straight edge.
- **Don't** use Survivor-specific motifs (torches, tiki, jungle, tribal patterns) in shared UI.
- **Don't** put a filled red button next to routine buttons.
- **Don't** reveal results anywhere outside the reveal: no names, eliminations or scores in teasers, plates or tags before a player has chosen to see them.
- **Don't** use `text-chyron`, `border-chyron`, `outline-chyron` or a small `bg-chyron` dot: those are `chyron-line`. Don't hard-code shadows, scrims or tag inks; use the tokens.
- **Don't** gate structure on the mode (`dark:` for a box, a border or a layout). Modes differ only in token values; the one deliberate exception is the reveal, which forces Night.

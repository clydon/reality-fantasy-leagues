---
name: Game Your Show
description: Games for any TV show, styled as the on-screen graphics reality TV runs.
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
  desktop-backdrop: "#0b0a0f"
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
    # Studio: Night Ink with white (--quiet-tag / --quiet-tag-foreground).
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

# Design System: Game Your Show

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
- The **quiet tag** (`--quiet-tag` / `--quiet-tag-foreground`, `bg-quiet-tag`) is Night Panel Raised with bone on Night, and Night Ink with white on Studio, where a pale raised fill would melt into the white plate beside it.

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

The mobile header has no logo. On Overview it is the league name, left-aligned in 26px condensed caps with the switcher's chevron beside it; every other page centres its own name in condensed caps with the league name small above it (still the league switcher, still swipeable between linked leagues), a named back on the left for a page under another ("‹ Overview", "‹ Episodes": the page you came from, else its parent; `lib/nav-trail.ts`). Back always says where it goes. The app is two levels deep, so it gets no breadcrumb trail. The alert strip sits at the top of the content, one item at a time with a pager; when it has nothing for this league, Overview opens on the status plate in the same slot.

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

Broadcast graphics are hard-edged, so nearly everything is square: 3px on plates, strips and the buttons inside them, 4px as the dark theme's base radius (shadcn `--radius`), 2px on badges. The signature shape is the caption tag's angled right edge: a fixed slant (`tag-cut`, `--tag-slant`, 14px on plates), with the next piece tucked under it by exactly that length (`tag-tuck`) and the plate colour under the whole strip, so tag and plate always meet on one straight diagonal whatever the tag says (globals.css). The one soft shape is the bottom sheet's 14px top corners, because it's a phone-native surface, not a graphic. Round shapes are only for dots (player colours), the sheet's grab handle and avatar-style icons.

## Components

### Caption Plate (signature)
Direction A's signature, in `src/components/ui/caption-plate.tsx`, for the moments that matter: your turn, results are in, last week's score, who went home. Not for every row.
- **Structure:** an angled tag (one or two words: "New", "Ep 3", "Out") in a tone colour, then a white plate with a condensed caps title and an optional one-line detail, then an optional action label with a chevron.
- **Tones:** chyron (now / yours), live (out), good (safe, won), quiet (informational). A tribe's own colour can replace the tag colour.
- **Sizes:** 60px tall (22px title) or 52px small (19px title).
- **States:** as a link or button, hover brightens slightly (`brightness 1.04`); focus shows a 3px chyron-line outline offset 2px.
- **Variants built from it:** the alert strip (`action-bar.tsx`), the reveal prompt and "reveal first" (`results-in-banner.tsx`), Last Week, who left (episode page and Overview), and Classic's "banks" plate with a player-coloured tag.

### Alert Strip
The caption plate as the app's to-do list (`action-bar.tsx`). Chyron tag names the kind of thing ("Your pick", "Lineup", "Invite"), the plate gives the message and the league. **The message gets the width:** its title wraps to two lines (an invite's, which carries the league's name, to three) and never truncates mid-message, so the strip grows taller rather than cutting text. An item with two answers (an invite's Join / Decline, the notifications nudge's Turn on / Not now) puts them on their own line under the message: a small chyron button and an outlined one, wrapping at 320px. With more than one item, the pager is a single 48px column, "1/3" over "Next", divided by a faint plate-muted line; it cycles round. **The pager is now only what isn't a league's own to-do:** an invite, and the notifications nudge once nothing else needs you. Every league to-do is in Up next (below).

### Up next and the control room
Every page about a league leads with Up next (`overview/up-next.tsx`, rendered by `action-bar.tsx`), so a player sees every move due instead of paging to it. Built from `action-items.js`, where each item has a `who` ("you" or "commish") and an ISO `deadline`; `byDue` sorts soonest first.
- **The plate** is a 52px small caption plate: this game's most urgent move, its tag ("Replace", "Lineup", "Your pick") and the time ("3 hours left" under a day, else "Locks Wed 8:05 PM"). Its right column is the pager's 48px column with a **count** ("+3" over "more") instead of "1/3 Next". Tapping it opens the rest in place: every other move, soonest first, one hairline row each (where · what · when). Rows from this game say "Here"; a linked game uses its chip's name; any other league you're in, its own name. A row opens the tab the move lives on, switching game first when it has to (`useSwitchLinked`).
- **Under 24 hours** the time is in chyron-line in the list and in `--plate-line` (#845800 in both modes) on the white plate, since chyron-line is the yellow itself on Night. Never red: red means someone went home.
- **Nothing due in this game, on Overview:** tag "All set", "Nothing to do in Pool", and under it the status plate's own words ("Next: Ep 7 · Airs Sun 7:40 PM"), up to two lines. Plates that say where things stand rather than what comes ("Lineup set", "You picked X") drop the "Next:". Other pages show no plate for a quiet game unless another game needs you.
- **Focus:** a 3px ring drawn inside the plate (they clip their own overflow): `plate-line` on a white plate (chyron-line is the yellow itself on Night and vanishes on white), the strip's own ink on the control room, chyron-line on the list rows.
- **Where it's left out:** Team and Lineup, when their own waiver banner leads; Episodes leaves out this league's own results job (the page leads with it); anything pointing at the page you're on is dropped everywhere.
- **The control room** sits above the plate for a commissioner with a job (results to fill in, a draft to schedule, anything in `commissioner-items.ts` that blocks a league): a 44px slim strip on the **inverse fill** (`--quiet-tag`: ink on Studio, Night Panel Raised with a hairline on Night), a knocked-out "Commish" tag, the job in 16px condensed caps, the game's chip name small, a chevron, and "+N" that opens the other jobs in place. Players get white on-air plates; the commissioner gets the backstage slate, and no new hue, so the one yellow stays the player's. Commissioner jobs never pad a player's "+N".

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
Row actions in a sheet from the bottom (`bottom-sheet.tsx`), replacing rows of buttons. Night panel, 14px top corners, a grab handle, a condensed caps title with an optional detail beside it, actions as 52px rows split by hairlines, destructive actions last in red text, and a full-width Cancel at the bottom. Slides up over 200ms; respects the safe-area inset. On wide screens it's capped at 480px and centred. **Closes with a swipe down** (`ui/use-sheet-swipe.ts`, shared with the More sheet): a touch on the grab handle always drags, anywhere else only once the sheet is scrolled to its top. The sheet follows the finger and the scrim fades with it; past 90px, or a quick flick, it closes, otherwise it springs back.

### Cast Tile and Confirm Bar (pickers)
Every picker (draft, blind draft, waiver pickups and add/drops, free agency) works the same way, in `src/components/draft/draft-ui.tsx`: tap a tile to select it, then confirm in a bar. Nothing happens on a single tap.
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

### Landing page (signed out, `/`)
A first-time visitor at `/` gets the landing page (`landing/landing-page.tsx`, its own scoped `landing.css`), server-rendered for search with FAQ and WebApplication JSON-LD. AuthGate shows it when the request carries no session cookie (the root layout passes `hasSession`). It always plays on Night, like the reveal, and leads with free, any show, do it yourself: a hero with the rolling show name on a white plate beside a drifting wall of real cast photos, how it works, ways to play, a working spoiler gate replaying Survivor 49, any show, the couch, watch along, Free (Autopilot as one quiet optional card, never a pricing table), FAQ. Faces and points are real (`showcase.json` from `scripts/dev-test/export-showcase.js`, photos in `public/landing/`); couch members are made-up names, never usernames. A dashed **Preview** chip beside the wordmark (and a line in the footer) says it's early without a banner. Sign in links to `/sign-in`; Start free and Join go to `/account`. Checked by `scripts/dev-test/check-landing.js`.

### Front door (signed out)
Without a session every route other than `/` is the front door (`login-screen.tsx`, `auth/front-door.tsx`): sign in and create account on one screen, opening on Sign in at `/sign-in` (and any deep link) and on Create account at `/account`. Forgot and reset password use the same shell. No tab bar, sidebar or alert strip.
- **Cold open:** a top bar with the wordmark (`auth/wordmark.tsx`, 26px tall: GAME SHOW in outlined condensed caps with YOUR on a slanted wedge between them, the in-app colourway of the logo in PRODUCT.md's Brand Commitments; the wedge is a `foreground` fill with YOUR knocked out in `background`, like the You badge, never chyron) and the page's one secondary way out on the right ("Take the tour", "Tour" under 360px; "‹ Sign in" on forgot/reset). Then a title card in 44–60px condensed caps filling the space above the sheet.
- **Show roll** (`auth/show-roll.tsx`): "Turn [plate] into a game." The plate has a quiet tag with a TV icon. Its show name rolls up through shows people play every 1.5s, then lands on "Your show" and stays there, so nothing moves while someone types. Under reduced motion it reads "Your show" from the start. Screen readers get one static h1. Show names only, no network art.
- **The sheet:** Night Panel, 14px top corners, sheet shadow, rising 28px on load. It sits in the page flow, not fixed, so a phone keyboard scrolls the field into view. No grab handle, because it can't be dragged. Capped at 480px and centred on wide screens. Inside: the two-way switch (tabs, the You fill on the chosen side, arrow keys move between them), labelled 48px fields (label above, a hint muted beside it, password with a show/hide eye), errors in red above the action, and one full-width 52px chyron button in 22px condensed caps. That button is the screen's only yellow fill.

### Section (Overview)
`DashCard` and the shared `section-title`: no box at all, just a 24px condensed caps heading in Bone Text over the content, with an optional aside on the heading line. Sections read like a broadcast rundown: an opener (the alert or the status plate), then three sections per league type (Classic: Standings, Your team, Episode N; Active Roster: Starting this week, Episode N with your week, Standings; Eliminator Pool: your streak and picks, Standings with this week's Picked chip, Episode N; before a draft: Draft order and The cast).

**The One Link Rule.** A section gets at most one link, on its heading line, in chyron-line (`DashAside`: "Full board", "Recap", "Change", "All picks", "How it scores"). No arrow links under a section, no explainer sentences on Overview (how scoring works lives on Scoreboard's "How it scores" and in Scoring & rules), and a section with nothing to show renders nothing, never an empty-state call to action.

### Status Plate
What Up next's quiet state says on Overview when this game has nothing due (what it says in `lib/game/status-plate.ts`; there is no separate component any more): a small caption plate in the strip's slot and size with a **quiet tag**, so it never adds yellow. One plate, the league's next beat by phase, the first that applies (a commissioner's blocking to-do is the control room's now): the draft's time and your pick position, who's on the clock, a blind draft's count, your waiver claim ("4 of 5 in", an add/drop week with no claim, free agency with your add/drop unused), catch-up's next episode, your Pool pick or set lineup, then when the next episode airs and how many are left. Its action is a chevron, like the alert strip's (the word is for screen readers). Nothing while results wait to be revealed (the reveal prompt has the slot) or once the season's over.

### Show Art
Overview's mobile header can carry the league's show key art (`shows.art_url`) behind the header and the opener (`.show-art` in `globals.css`): greyscale at low strength, faded out before the first section, and the header clear over it until the page scrolls. It's a texture, never a picture: no colour. The mode's values are tokens (`--art-opacity`, `--art-filter`, `--art-side`). **The wash:** `--art-side` is a stronger side-to-side gradient on the name's side (Studio .9 → .85 at 38% → .3 at 68%; Night .92 → .88 → .3), rather than fading the art out before the league strip, which sits over it. Over the art the game's line and the ▾ use the ink, not muted grey (which can't reach 7:1 on a picture), and the chat icon sits on a soft ground disc. Measured with `scripts/dev-test/check-header-art.js`: every text 7:1 or better, every icon 3:1 or better, on all five show arts, light and dark. A show without art gets the plain ground. Rights to network key art are unconfirmed.

### Standings Row
48px rows divided by hairlines: a condensed rank (ties as "T1"; the leader's in chyron-line, and nobody's when everyone is level), the player's colour dot, the name in 16px semibold, and a condensed tabular total on the right. Active Roster adds the latest episode's score in 13px muted text before the total. Your own row is lifted with a Night Panel Raised fill and a white "You" badge. Classic rows are 62px: the name line carries "2 of 3 standing" in 12px muted, and under it the team as 30px faces (still in first; out ones greyed with their finishing place on a small live-red corner badge, a finalist's in teal). "Full board" on the heading; hidden before the draft. Eliminator Pool rows show the best streak, and while this week's pick is open a Picked (teal) / Not yet chip in its own column.

### Scoreboard and the commissioner's to-do list
- **Scoreboard rows** link to the player's own page and take the shape of the league type's scoring: a team's faces (out ones greyed, with where they finished in Live Red), a per-episode table, or streak columns. Ranks show ties as "T1"; the leader's rank is chyron-line, and nobody's when everyone is level. Your row is lifted like the standings row.
- **Results to fill in** are the one commissioner to-do in the alert strip (tag "Results", "Fill in episode 4's results"; `action-items.js` `resultsDueEpisode`): an aired, in-play episode with nothing recorded, in any league. It shows in the control room (see Up next), left out on this league's own Episodes pages, which lead with it themselves. Also a push the morning after airtime.
- **Commissioner to-dos** (`lib/game/commissioner-items.ts`): the one that blocks the league is in the control room; each is also a chyron dot on the League Settings row that fixes it (and on League Settings in the sidebar and the More sheet). Pending invites are the Players & invites row's value, not a to-do.
- **Scoreboard heading:** "After Episode N" is the section heading, with "How it scores" (Scoring & rules) beside it.

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
  bench as 32px round faces. Locked with nobody in it, it says "No starters for Episode N" instead of dashed slots (on Lineup too). Your week is a small good-tone "You" plate under the latest episode's Out plates ("+8 last week", what sat on your bench).
- **Episode page:** how the league did leads, "What happened" comes last. Under the Out plates, a
  good-tone "You" plate ("+6 · tied 2nd of 3", then what sat on your bench or who led your lineup),
  then **This episode**: every player as a 60px row ranked by what their lineup scored (rank, dot,
  name, the top two scorers in 13px muted, a 26px number, a chevron). Your row is lifted like the
  standings row and starts open; any row opens to its starters and scoring bench. Before scoring, the
  rows just say who's starting, with no number. The commissioner's lock and event log sit in a
  collapsed "Commissioner tools" at the foot of the page.
- **What happened** (episode page, every type): hairline rows with a 92px muted label (Reward,
  Immunity) and tribe chips in the tribe's own colour (`colourTag` ink) or small face chips. Roles and
  tribe moves are grouped, one row per destination ("→ Dina" chip, then first names), never one row
  per person. Who left isn't repeated: the Out plates already say it.
- **Your season** (Scoreboard): two-up night-panel cards (4px corners), a muted label, a 40px face,
  the first name and a 20px condensed number; points left on the bench are muted.

### Classic: team plates and the boot order
Classic scores by who's still standing, so its screens lead with faces and places.
- **Team** (`/team`, the tab bar's fourth slot once the draft is done): a status banner when waivers have something for you, then the same Your team plates, then the **Waivers section** (see Team and Lineup below). Classic had no team page before; this is it.
- **Your Team** (Overview, with "Team" as its one heading link): one 60px row per castaway, a 54px photo then a white plate with the name in 21px condensed caps and a line under it (tribe chip and "Still in"). Someone out drops to a Night Panel Raised plate with a greyed photo, a live-red "Out" chip and "Episode 1 · finished 21st · +1"; the winner gets a chyron chip. Two up from `sm`.
- **Latest episode** (Overview): "Episode N" with Recap on the heading line, then who left as small "Out" caption plates, Classic's detail being "Finished 20th · Sam banks 2" (Active Roster adds your week's plate; every team's points are Standings' +N column).
- **Episode page:** the Out plate says where they finished; then a small plate per owner who scored, "+3" in a tag of **the player's own colour** (`colourTag` picks plate ink or white for it) and "Andrew banks 3"; then "Called it" (good tone) when your prediction paid. **Boot order** follows: everyone out so far as 52px greyed faces with their place in live red (this episode's ringed), then "19 castaways still in, 2 of yours among them" with the number in 28px condensed.
- **Episodes list:** a Classic row's detail is who banked what and whether your prediction paid ("You bank 1 · your prediction was right, +2"); "19 of 21 still in" and "The cast" sit on the "All episodes" heading line, linking to the Cast page (`/cast`: the tribe-grouped cast board, read-only, a dot per owner, for every league type). In a catch-up league the list opens on one muted sentence and one quiet "Up next" plate whose Reveal is a chyron block on the plate's end (CaptionPlate's `actionTone`), standing in for that episode's row.

### Eliminator Pool: the pick and the streak
The Pool is one pick a week and a streak, so its screens lead with those two things.
- **Pick page** (`/pick`, `pick/pick-page.tsx`, the tab bar's fourth slot): a muted line with a clock (when picks close; "Open until Episode 3 is revealed" in a catch-up league), "Who survives Episode 3?" with one muted sentence on who's used and why, the tribe filter, and everyone still in as cast tiles four across. Used ones are dimmed with "Used Ep 1" (or "Last pick · Ep 2") in place of the tribe line. Tap a tile, then **Lock in Rob** in the confirm bar; with a pick saved, the bar names it and says it can change until it airs.
- **Overview:** the streak as a 104px condensed number (bone, not chyron: the alert strip owns the yellow) beside "In a row" and one muted line on where it leaves you ("Tied for 1st with Josie"). Then **Your picks**: 64px faces, oldest first, with a teal tick (survived) or live-red cross (went home, face greyed) on the corner, and this week's slot as a dashed square with a plus. Who else has picked is Standings' Picked / Not yet chip; nobody else's pick shows until the episode airs.
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

### What's New
A bottom sheet (`whats-new-modal.tsx`), once per release per account and from More / the account menu. "What's new" as the sheet title with the release date beside it ("Every update" for the full list). Each item is a hairline row: the title in 16px semibold, its detail right under it in 15px muted (always shown, never behind a tap), and a "Show me ›" in chyron-line when it links somewhere. The full list groups by day under 14px condensed caps dates, older than a week folded behind "See older releases". Footer: **All updates** (outlined) and **Let's go!** (chyron, wider), or one outlined Done in the full list. It focuses the sheet, not its first link, since it opens on its own. No emoji: the titles carry it.

### Chat
One conversation per set of linked leagues (`/chat`, `chat/chat-tab.tsx`), flat on the ground like every other page.
- **Messages** run in groups: one author, nothing in between, under ten minutes apart. The first of a group has the author's colour dot, name (13px bold) and time; the rest are just bubbles 4px apart. Other people's bubbles are Night Panel; **yours sit on the right in the "You" fill** (`bg-foreground`: bone on Night, ink on Studio), never chyron. 4px corners, 16px text, 85% wide at most.
- **A day changing** is a small condensed caps label ("Today", "Yesterday", "Wed, Oct 7") between hairlines. Reveal lines are one centred muted line with an eye icon and the time.
- **Tap a message** for its sheet: six quick reactions (yours outlined in chyron-line) and + for the full picker (on the app's tokens), then Copy text, Edit (a text sheet) and Delete in red. Nothing sits on the bubble itself. Reactions show under it as 32px chips (emoji and a condensed count; yours with a chyron-line border), tap to toggle.
- **Spoiler line:** "Episode 3 has started" in condensed caps with one muted sentence between hairlines, then Show all / Reveal Episode 3 as plain buttons. Each hidden message is a dashed outline with an eye-off icon, "May contain spoilers · tap to show".
- **Composer:** a field that grows to about five lines (Enter sends, Shift+Enter is a new line) and a 44px send icon button, chyron only while there's text.
- **Motion:** a message that arrives while the page is open rises 10px and fades in (220ms); a new reaction chip pops. Nothing on first load, nothing under reduced motion (`.chat-in`, `.chat-pop` in `globals.css`).

### Predictions
Free-text questions, one row each, in hairline rows (`predictions/prediction-ui.tsx`).
- **The row:** the question in 16px semibold, "Episode 3 · Asked by Sam" muted under it, and "+2 / if right" as a condensed number on the right, then a ⋯ when there's something to do. Each guess is a 44px line: the guesser's dot and name, " · ", their answer, and how it went: a teal **Right +2** chip, a muted **Wrong** chip, or "Not graded" (left out on Overview, where nothing can be graded yet).
- **Overview** lists the open ones under "Predictions" with "2 to guess" muted beside the heading; your guess is a field with Guess beside it, chyron only once something's typed. The ⋯ has the commissioner's **Grade guesses** (to the episode's page) and Remove.
- **Episode page:** once the episode has results the commissioner gets "Grade N guesses", which turns each line's result into 44px ✓ / ✕ buttons (✓ fills teal; ✕ fills with the You ink, not red: nobody left) plus Remove, a "Suggest from research" block on a raised fill, and Done grading. The ⋯ also has Edit question or points (a sheet with the 44px points picker, chosen value in the You fill) and Remove.

### Research (scouting, every game)
Every castaway ranked by the points they've scored (`/research`, `research/research-tab.tsx`; the canvas's Scouting board), so a player can see who to start, who to pick up and who owns the best. It's a tab in every game (the hook: the deep dive). Classic gets the same page; the bench pieces stay Active Roster's.
- **Eliminator Pool:** nobody owns anyone, so the Whose chips become **Open to you · Used · Everyone** (from your past picks, by the Pick page's rules; it opens on Open to you), and rows say "Open to you", "Used Ep 4" or "Last pick · Ep 6" in place of an owner. **Safety** joins Points in "Ranked by" and is the Pool's default: immunity wins, Tribals with no votes and votes survived, counted even where the league scores them 0; hidden when the show has none of the three.
- **Top:** the window as a segmented control like Lineup's (Season · Last 5 · Last 3 · Last ep; only windows shorter than what's aired), then filter chips (Everyone · Free agents · Mine · Team ▾, which opens a sheet of the other players and then shows that player's name). Rank per episode, hide who's out and count pre-league episodes sit behind the page's ⋯ (the header's on a phone), as toggle rows in a sheet that closes with Done.
- **Rows:** 58px hairline rows: a condensed muted rank, a 40px photo, the name over who has them ("Yours", "Yours · bench", player names, **Free agent** in teal, or "Out · Episode 3", the row faded), a bar per episode in the window (teal for a week that scored, muted for one that didn't, a stub once out; last six), and the total (or average) in 22px condensed. A small caps header row names the columns.
- **Tap a row** for a sheet: the total and per-episode average, then one hairline row per episode, newest first, with what scored ("Won the week +3 · Bottom two −1") and that week's number.
- **Under the list**, one muted line names up to three free agents scoring like starters (at least the weakest of the league's top N owned, N being every team's starting slots).

### Scoring (the maker's, a made game)
`/show/[seasonId]/scoring` (`src/new/show/scoring.tsx`), a page over the show like backstage's, reached from "Change the scoring" (a button under How it works' points, a muted line with a chevron on the Players tab), shown only to whoever may change it.
- **The moments** grouped by part (small caps heads on a hairline), each a hairline row with the backstage Stepper (− value +, by 0.5 from −20 to 20); a moment added by hand says what scores it ("Its own question", "From: Votes at Round Table") and has a 44px ✕ to take it out. A changed one says "Was +2" under its name.
- **The save bar:** fixed to the bottom while anything's changed: "2 moments changed", "Every episode is counted again, straight away.", Cancel and the yellow **Save points**.
- **Add a moment** (bottom sheet): what happens; Counted (Once an episode · Each time · Per amount, a segmented row); Scored from (A new question · An answer we get, the second opening a list of the questions research already asks, in words, of the kind that fits); its points on a Stepper; the yellow **Add it**.
- **Looking them up again:** a moment with a question of its own, saved while episodes were looked up before it, opens a sheet ("Episodes 1–4 were looked up before this question"): the yellow **Just the new question** (about a minute each, nothing already counted changes), **Everything again** (2 to 4 minutes each), and a "Not now" text link. Until they're asked the page leads with a card naming the episodes with no answer to it and a **Look them up again** button; while they're asked, a row ("Looking up Episodes 1–4 again", with a chevron to the Episodes tab). There, Fill in what happened's roll call puts "The new question · " or "Everything again · " before its line.
- **Not theirs to change** (not the maker, a game started, locked): the same rows with the points as plain condensed numbers, and the line under the bar says why.

### Episodes: the week
Episodes opens as a rundown (`episodes/week.tsx`) before the list, each part a section headed by its episode ("Episode 4", a 24px section title) over one 13px line, a bold kicker and when ("This week · Aired last night", "This week · Airs in 2 days · Sun 8:00 PM", "On now"), with Details or Recap on the heading line.
- **This week:** the episode in play. The commissioner's task plate when it's due (below), else for players one muted line with an hourglass while results are pending. Then **Your week** under a small condensed caps label: 60px index rows (icon, name, where you stand, up to four 32px faces, chevron) for what this league type asks of you: Your lineup ("1 empty slot · locks Thu 8:00 PM", "3 starting · locked"), Your pick, Your team (Classic), Predictions ("2 to guess"). A row still waiting on you gets the chyron-line dot and its value in chyron-line. Under them one muted line with a people icon: "3 of 4 lineups set" / "2 of 4 picked" until it locks.
- **Last time:** the latest results as "Out" caption plates (small) and your line ("You +3 · top: bo +15"). While they're hidden it's **New results** with the "Episode 4 is in" reveal plate, and goes first unless the commissioner has results to fill in (then the reveal plate goes quiet: one yellow).
- **All episodes:** the list. Episodes after this week's that haven't aired fold into one "+8 · Episodes 5–12 still to air" row that opens to them. A commissioner's aired row with nothing recorded says "Needs results" with a chyron-line dot. A row's Reveal is outlined; the week's plate has the yellow.

### Episode results (commissioner)
Filling in each episode's results is every commissioner's weekly job by default (an admin, or later paid automation, may get there first; then nothing is due). From research where the league has a season (`/episodes/N/research`, `episodes/episode-results-page.tsx`; the canvas's "Fill the gap"), else by hand on the episode's page.
- **The task plate** (`episodes/results-task.tsx`), on Episodes' week and the episode's page: a quiet "Commish" tag and a chyron action block, like catch-up's Up next. "Fill in the results · Ask an AI chat, then paste · Start", "Finish the results · 2 found so far · Open", "Results are in · 4 to check, then apply · Check". One muted line under it: standings move once you apply; players still reveal when ready. The episode page adds "Or enter them by hand" in chyron-line under it.
- **The page** is numbered steps, the current one's number chyron: 1 Copy the question (who it asks about, the chyron Copy button, "ChatGPT, Claude, Gemini: any chat that can search the web"), 2 Paste its answer (field, Read the answer), 3 Check and apply ("2 of 2 ticked" on its line). When research already covers everyone, 1 and 2 are one teal-ticked done line and checking is step 1.
- **What research found:** grouped under small condensed caps by what happened (Left the game first, then each scoring event in the show's order). Each result is a 64px row that ticks as a whole: a 24px tick square (chyron fill when kept, an outline when not), a 40px photo, the name over how sure research is ("Wiki and research agree", or **Low confidence · check first** in Gold Accent), and a ⋯ that opens a sheet to correct who, how they left or what happened. Results already in the league fold into one "31 already in your league" row; one an admin flagged as wrong stays open in live red.
- **Apply** is a full-width chyron button in a sticky bar ("Apply 4 results to this league") once checking is the step at hand; before that an outlined "Apply 2 found so far" at the end of the list. When everything lands it replaces itself with the episode's own page, so back goes to Episodes.

### Waivers (mid-season moves)
Replacements and swaps are private ranked claims, processed together at the claim deadline in one waiver order, then free agency until airtime (`src/components/waivers/`; docs/PLAN-waivers-v2.md and its "Waivers v2 options" canvas). Words: **Replace** (someone out; their points stay), **Swap** (someone still in; their points go), **waiver window**, **claim deadline** ("Due Tue 8:05 PM"), "you're 3rd in line". Never "pickup" or "add/drop" on screen. If it needs a paragraph, the screen is wrong: short labels, no sums.
- **Where it lives:** off the tab bar and the More sheet both. `/waivers` is a page pushed on top of **Team** (Classic) or **Lineup** (Active Roster), reached from a Waivers section on that page (see Team and Lineup, below); the "needs you" badge is on that tab's "!". It has no league swipe, being a pushed page.
- **The page, claims open (2A):** a plate ("REPLACE PATT · SWAP 1 / Due Tue 8:05 PM · you're 3rd in line", chyron tag Window or Waivers; teal "In" once your claim's in), then **Your team** (62px rows: photo, name, points; an outlined Replace on each castaway you may replace, Swap on each still in while a swap is left; a You-fill "Swaps allowed" badge on the heading), then **Your claims grouped by spot**: one group per replacement ("REPLACING PATT · You get 1"), then the swap group, each row numbered with a grip (drag; tap for Move up / Move down / Remove) and "+ Add a backup" in chyron-line. Shared ownership has no claims section: the team row shows the pick ("Sharonda for Patt · Joins your team Tue 8:05 PM", Change).
- **The picker** (`/waivers/claim?drop=`): "Replace Patt" / "Swap Lewis", one muted line, then Research's own controls (the window segmented control and "RANKED BY ▾", `research-rows.tsx`), Cast Tiles numbered in pick order (shared: a tick), and the Confirm Bar ("For Patt · backup Rob" / SHARONDA / Save).
- **A quiet week:** a quiet plate saying why and when that changes ("Patt waits for a window", "3 still in: enough to start", "Out is out in this league", "Nothing to do this week"), then **When moves happen**: Replace and Swap lanes over ten episode columns from two before the latest, fading right; solid where moves are open, hatched for "only if you're short", one dashed run for "your commissioner decides"; past columns dimmed, a chyron-line mark under the latest; a legend of only the swatches used; one sentence.
- **After a run:** a teal "Got" plate ("Sharonda for Patt / Your first choice") or a quiet "Short" one, one line of why ("Josie got Maggie first, so Lewis stays."), then Free agency and Past waivers rows. Results are sentences per player, replacements then swaps.
- **Commissioner:** an open window leads the page as a quiet "Waiver window open" plate with Change and Turn off (red text). **Open a waiver window** is a sheet (3B): "Replace castaways who are out" (a You-fill switch, only where replacements wait for windows or never happen), "Swap castaways still in" (−/+ None · 1 … · All), a no-names preview plate of what players get (dashed "Nothing to claim yet" when empty), Not now · Open window (the one chyron). Then Process now, who has claims in, Nudge, Claim for (one spot at a time), Undo last waiver run.
- **Settings (1A):** the Suggested card (night panel: numbers line, Casual · Balanced · Competitive in You-fill segments, four icon bullets the switch rewrites, chyron Apply or a teal tick "Your league is on Balanced"), then radio rows for when someone's voted out (Suggested in a chyron-line outline badge; Classic has no "Only when short"), Waiver windows (segmented + swaps counter, "Next window: after Episode 9"), Timing value rows opening option sheets, the Auto-fill switch, and "Preview what players see". The create wizard asks "How many teams?" and shows the same card, or "4 teams of 5 needs 20 castaways; this season has 18. Try one of these:".
- **Team and Lineup** (`waivers/team-waivers.tsx`): waivers reach the player from slot 4, around the team (Classic's new Team page, Active Roster's Lineup). On top, a **status banner** in Up next's slot (Up next stays off these two pages while it shows, since it would only repeat it): chyron WINDOW OPEN or REPLACE when you can act ("You're short: replace Jenna and Patt · Swap 1 · due Sat 1:33 PM"), a quiet WAITING when replacements wait for a window, WINDOW OPEN for an optional swap when you're not short; none when there's nothing to do or waivers are off. Tapping it doesn't open Waivers: its action is a down chevron, and it scrolls the way in (below) to mid-screen and rings it in chyron-line (3px, over the button's own border, blinking once and fading over 2.4s; still under reduced motion), so players learn where Waivers lives instead of being carried past it. Under the team, a **Waivers** section: the way in (a secondary button carrying an index row: shuffle icon, "Waivers open" and the waiting dot, "Replace 2 · Swap 1 · due Sat 1:33 PM" in chyron-line while a window is open or you're short, else plain "Waivers · Past waivers and how it works"), When moves happen, then **How it works here** under a small condensed caps label: the league's settings in plain words, only the rows it has on (lose someone, swaps, windows, claims, miss a claim, after claims), worded by `waivers-words.ts` so the page, the settings and this section never say a rule two ways. With waivers off, Team is just your team.
- **Alerts:** Up next's Replace item ("Replace Jelly by Tue 8 PM · first choice, then backups"), its quiet state (claims in, a window's optional swap), the reveal's "Your move", and the push types. Not revealed shows no names and no outcomes, the same words for everyone.

### Episode lines and lineups (Active Roster)
- **Lineups** on an episode's page: "Lineups" with a lock or clock line, then one hairline row per player (dot, name, "2 of 3 started" or "Last lineup reused", the total in 26px condensed), their starters who scored as 44px lines (36px photo, name, a live "Out" chip if they left, the points in 18px condensed, a chevron that opens the events behind it), "Also started: …" for the rest, and the bench under a small caps **Bench** label, greyed. Lost points are muted, never red. The commissioner's "Log a scoring event" is two full-width selects and a plain button.
- **Episode lines** (`/scoreboard/lines`, from the Scoreboard's ⋯): the admin copy-and-paste steps. 1 Copy the prompt, 2 Paste its reply, 3 Check each team's line, with Save in a sticky bar; Copy is the chyron until a line is pasted or typed, then Save is.

### Admin area
Admin is desktop-first but built to work at 390px, in the same vocabulary as League Settings: pages, rows and sheets, not one long page (`/admin/*`, `src/components/admin/`).
- **Chrome:** its own, never a league's. On a phone a header (Back, a small "Admin" line over the page's name in 22px condensed caps, and a **Paid AI on/off** chip that links to Site; chyron when on) and a tab bar of **To do · Shows · Users · Leagues · Site**, with a chyron dot on To do while anything waits. On desktop a Night Rail sidebar with "Back to {league}" on top, the same sections plus Formats & rules and Reports. No alert strip, league swipe or install banner.
- **To do:** "Needs you" as 60px rows (a 40px icon square, title, one line of detail, the action), most urgent first; only the first row's button is chyron. A season with more than two waiting episodes is one row. "Coming up" lists each airing season's next episode.
- **Pages:** `AdminPage` gives each one a desktop back link and 28px title, one muted summary line, and a ⋯ for page actions. Lists are hairline rows; anything destructive is red text last in a ⋯ sheet or behind a collapsed Danger zone. A season page has four segmented tabs (Episodes, Cast ✓, Rules, Setup), each its own route.
- **Sticky bar:** the one primary action of a page (Approve and send to 4 leagues, Accept all 12, Review 31, Review the format) sits in a bar above the tab bar, with one muted line of what it does. Pages are at least a screen tall, so on a short page the bar rests at the bottom.
- **Review:** a segmented "Spoilers hidden / Show names" (it follows Site's switch until flipped). Hidden is counts only. Shown, "Needs a look" rows (low confidence or not in the cast) carry their reason in Gold Accent and a 44px live-red ✕ and teal ✓; the rest are one row per kind of result that opens to its people. Any result opens a sheet with its sources, confidence, who decided it, and Accept / Correct… / Reject.
- **Format review** (`/admin/formats/[id]`, `format-review-screen.tsx`; also the wizard's "+ Add it"): read first, tap to edit. It opens on the verdict, on a night panel like an episode's coverage: one bold line ("Ready to approve. Nothing needs fixing." or "3 problems to fix before approving."), the counts, then one row per thing to fix (red alert icon, its name, the cause first and "and N more"), each opening what it's about. Then flat sections: Scoring (events under small condensed caps group names, each a hairline row with the name, its rule as a muted sentence and the points as a 24px condensed number), Other rules, What research answers, Ways to leave (read only), Needs a developer, Research sites (toggle rows), and two disclosures (what was left out, and Advanced: the raw JSON for every rule). Patchy (tier C) reporting is a Gold Accent word, never red. A row opens a bottom sheet with its fields (label above, 48px), its rules with their own Edit, and Done; text saves when the sheet closes. The sticky bar has Save and the chyron Approve, which in Admin opens a sheet: create a new show, or switch one you have.
- **Copy-and-paste flows** (an episode's research, a new show's rules): numbered steps with a 30px step number, chyron on the current step; the copy button is chyron until something's pasted.

### Navigation
Mobile: a header with no logo (see Layout), chat on the right, or a page's own ⋯ in its place while that page sets one (`header-action-store.ts`; the finished Draft and Research do); a fixed bottom tab bar. **The same six tabs in every game, in episode-night order:** Overview · Episodes · Scoreboard · slot 4 · Research · More (each label fits at 390px; "Scoreboard" at 60px is the tightest, so no label gets longer). Slot 4 is your play, the to-do tab (get in, do the job, get out): Draft until the draft is done, then **Team** (Classic) or **Lineup** (Active Roster); Eliminator Pool has no draft, so it's always **Pick**. It carries a "!" for any move of yours due in this game (the same list as Up next, so they never disagree); Episodes carries the commissioner's results "!". Chat is on the header, not a tab. The current tab is marked in chyron-line. The Cast page (`/cast`, linked from the count under the Episodes list) keeps Episodes marked. Each tab has one job: Overview tells you what you need to know, Episodes holds each episode and its predictions, Scoreboard the quick hits, Research the deep dive.
- **League strip and group name** (`league-strip.tsx`): a linked group has one name (`league_groups.name`, else show + season), big in Overview's header and small above every other page's title, with ▾ opening the league menu. Under the header on every page about the league, one 40px chip per game by type ("Classic", "Active Roster", "Pool"; two of one type use their league names). The open game is a You-fill pill (bone on Night, ink on Studio) with a second copy of the label in the fill's ink clipped to it, so mid-swipe each label reads right on either side of the edge; a red dot on any other game that needs you. Tapping a chip, or swiping sideways (never from the screen's edges, not on a pushed page like Waivers), moves to the same tab in the other game (`samePageIn()` in `league-tabs.ts`: slot 4 to slot 4, an episode stays put). An unlinked league shows no strip and its own name. On the desktop sidebar the strip sits under the plate.
- **More sheet (M1):** a bottom sheet that opens on the league as a small caption plate (a quiet season tag, the name, "Survivor 51 · Classic · 4 players", and Switch, which opens the league menu); then **This league** as 50px hairline rows with their value on the right (Draft board once the draft is done, League Settings with its join code and a chyron dot while a commissioner to-do waits, How this league works, and Practice round where the league's game type has one; Waivers is no longer here); then **You** (Account, What's new with "2 new", Report an issue, Take the tour, Commissioner tour, Demo season); Admin; Log out last in red. The theme lives in Account → Appearance (in the sheet only while touring without an account).
- **Desktop sidebar (D1, 880px+):** a Night Rail. Top: the league as a caption plate (quiet season tag, the name on up to two lines, show · type, an up/down chevron) that opens the league menu; no logo. Then 44px rows with the tab bar's icons in its order; the current one on a raised fill with a 3px chyron-line inset bar and a chyron-line icon; needs-you badges as the tab bar's, chat's count as a quiet chip, League Settings' commissioner dot. At the bottom an Admin row (a chyron-line dot while its To do has anything) and the **account row** (a 36px initial square, the username, "Account, help, log out", ⋯) whose menu opens above it: Account settings, Appearance (the theme picker), What's new, Report an issue, Demo season, a divider, Log out in red.
- **League menu** (`league-menu.tsx`): on a phone a bottom sheet, "Your leagues" (from the header's league name or the More sheet's Switch); on desktop the same list in a 4px popover under the sidebar's plate. Rows are index rows: 60px, the name in 16px semibold (a muted star on the league a linked group opens on), a 13px muted line with the show and type (a muted crown first when you're the commissioner), hairlines between. Leagues on their own come first, unheaded; each linked group follows as its own section, all open, under a 14px condensed caps heading with a link icon and "3 linked · one chat". The open league sits on the raised fill with a chyron-line tick. Pinned under the list: **New league** and **Join with a code** as two outlined buttons (the same pair as My Leagues; Join opens it with the code field showing). No yellow fill: the menu's job is switching.

## Motion

Mobile first, and for a thumb: motion explains a change you just made, never delays a tap, and never blocks input. **Only `transform` and `opacity` animate** (no layout property, no blur or backdrop-filter, no shadow); 120-300ms, ease-out for arrivals; springs only where a finger already drives it (the sheet swipe, the league swipe and its strip pill). Every animation is off under `prefers-reduced-motion`; the state change it announced still shows. No bounce, confetti or emoji, no new colour, and the chyron yellow never animates for decoration. Haptics and sound are out of scope.
- **Shared pieces** (`globals.css`): `.chat-in` rises and fades (220ms; `--rise` and `--dur` make it smaller and quicker), `.chat-pop` (chat reactions only), `.badge-in` (a tab "!" growing in, 160ms, no overshoot), `.tag-slide` (a plate's tag sliding in from behind its edge, 260ms), `.tour-wipe` (the tour's caption; it animates `clip-path`, so nothing new uses it), and `src/components/motion.tsx` (Motion, for flows with their own sequencing).
- **Up next** (`overview/up-next.tsx`): the plate's text and the "+N" count rise 6px in 160ms when they change while you watch (a move done, the next one up); a count only counts when it goes down, so other leagues' moves arriving never animate. "+N more" rows drop in from above, 25ms apart for the first four. **"All set"** is the one authored moment: when your last move in a game clears, the quiet tag slides in, once per clear (`action-bar.tsx` counts clears, so doing it on Lineup and walking to Overview still plays it). Nothing plays on first paint, a league switch or arriving on a page.
- **League strip pill** (`league-strip.tsx`): one `translateX` over 220ms (swipe-driven while dragging); its ink labels sit in a layer carried back by the same distance, so they stay put as the pill passes. It used to animate `left` and `clip-path`.
- **Tab bar**: the tapped tab lights at once (a route can take a moment); a "!" grows in only if it turns up while you look (not on load or a league switch) and clears instantly. `:active` is a polish, not the answer: a touchscreen delays it ~100ms.
- **Sheets**: every sheet slides 200ms ease-out (the More sheet used to be 150ms ease-in-out); reduced motion is no slide, scrim fade only. The swipe-down is unchanged.
- **Waiver banner → way in** (`waivers/team-waivers.tsx`): tapping Team / Lineup's banner smooth-scrolls to the Waivers way in and plays `.way-in-lit` on it once it's in view (opacity, plus a 1.02 → 1 settle), and focuses it.
- **Applied**: applying an episode's results opens its page with a quiet "Applied · N results in your league" plate rising in once (`lib/applied-results-store.ts`; a reload or a later visit shows nothing).
- **Roll call** (`new/show/recaps.tsx`, Fill in what happened's results): the episode our bot is writing up is a loading broadcast graphic. A small caption plate (quiet tag "Ep 3", the stage or "9 of 22 written up") comes on from the left (`.roll-in`, 300ms) when a new episode starts while you watch; under it a rail of one segment per person, each lighting as it's written up (`.seg-lit`: opacity and a scaleY from the bottom, 280ms, 45ms apart across the ones that arrive together); while ChatGPT searches, a light sweeps the rail (`.roll-sweep`, the loading mark's sweep). The live episode's chip fills from the bottom as a meter (`scaleY`, 700ms ease-out), and a chip that goes live or lands settles (`.chip-land`, 240ms). Past where you are it's one meter with no head count (how many are still in would give exits away). Nothing on first paint; under reduced motion the lit segments, the meter and the plate show, still.
- **Check**: `scripts/dev-test/check-motion.js` (parts: strip, sheet, tap, upnext, lineup, reduce, apply; fails on any animation that isn't transform or opacity), with `open({ motion: "on" | "off" | "reduce", watch })` in `scripts/dev-test/motion.js` for capturing deterministically.

## The new design (docs/PLAN-new-design.md, from step 0c)

The full-site mock (`.impeccable/mocks/site/`, decisions in memory `site-mock-decisions`) is being ported onto the real app as a new set of screens: `src/app/(new)/` for its routes, `src/new/` for everything else. It is direction A, so everything above holds; this is what it adds or bends. Until the cutover both designs run side by side, opted into per account (`user_settings.ui`).

- **Night only, for now.** The new design forces Night (`dark` on `<html>` while you're on it) with exactly the Night tokens above, through the same utilities (`bg-background`, `bg-card`, `bg-secondary`, `border-border`, `text-muted-foreground`, `bg-chyron`, `bg-plate`). Studio comes back in step 15. Its own CSS is `src/app/(new)/new.css`: the phone column and the motion, nothing else.
- **A phone column.** Designed at 390px; on a desktop it is a centred 390px column on the **Desktop Backdrop** (#0b0a0f) with a hairline either side, and the tab bar, sheets, toasts and pushed pages stay inside it (`.nd-fixed-x`). Desktop layouts come after step 15.
- **Yellow only for what you must do** (the critique, 2026-10-23): an optional action is an outline (`Btn tone="optional"`), never a yellow fill; Weekly Lineup's colour is Lake (#5089c9), not yellow; tribes never fill. **The mock's one bend of the One Chyron Rule:** the TV guide pins Today (or Tonight) in yellow beside a yellow "needs you", so the guide can carry two.
- **One spoiler chip** on every guarded surface: "Spoiler-safe · you're on Ep N · Change" (`GuardChip`, teal on a 10% teal fill). "Live" is not a spoiler word.
- **Calm clocks**: anything more than a day away reads in days ("Wed 8:05 PM · in 5 days"); seconds tick only inside the last day (`src/new/clock.ts`).
- **Plates are for single moments**, never stacked as list items; lists are rows (`Row`: a 40px icon box, a 15px title, a 13px muted line, hairlines between). **Watch along** is the only name for watching together.
- **Sheets** keep classic's behaviour (Base UI, swipe down to close) in the mock's shape: a 26px condensed title with one muted line under it and a close button, 380ms on the mock's ease-out (`cubic-bezier(.16,1,.3,1)`). **Toasts** drop from the top as a white plate with a teal check tag, Undo on the end when there is one. **Pushed pages** (How it works, More on the couch's pages) slide in from the right over the screen you're on and close with the back gesture (`?page=`).
- **Navigation moves** (the bend of "nothing plays on arriving on a page"): every navigation is a view transition that says where you went, ported from the mock's `nav.js` (`src/new/nav.tsx`, `routes.ts`). Deeper pushes in from the right over the old screen, which steps back; back slides it off to the right; a show's tabs nudge sideways by tab order with the show bar and tab bar still and the tab marker sliding; the hub and a show change the channel (the show's art grows from its card into the show bar, and back). On a desktop, pushes are the short nudge. Reduced motion is a short crossfade. Transform and opacity only.
- **Chat** (`src/new/show/chat.tsx`, step 4): one chat per couch and show, flat on the ground. Day lines between hairlines; others' bubbles on the card, the name and time inside a run's first bubble and a 28px face beside its last; yours in bone on the right; reveal lines centred and muted with an eye ("riley revealed Episode 5"); reactions under the bubble; a message's sheet holds the quick reactions, Copy, Edit and Delete. The composer sits above the tab bar (lifted over the keyboard) and its send is grey, never yellow. What others said since an episode you haven't seen aired is **one dashed fold** where the first of it was ("5 messages since Episode 4 aired", who has revealed it, then Reveal Episode N and Show them, both outlines); its words never reach the page until you ask.
- **Preview**: a part of a new screen not yet on real data has a 2px dashed Field Line outline and a small "Preview" tag, and its taps say "Coming soon" (`<Preview id>`, `src/new/preview.ts`). It isn't decoration; it goes as each step makes the part real.

## Do's and Don'ts

### Do:
- **Do** put "now" moments on a Caption Plate with a chyron tag, and keep them to one or two per screen. Informational plates (the status plate, catch-up's "Up next") take the quiet tag.
- **Do** give a section one link, on its heading line, and let an empty section render nothing.
- **Do** use the condensed caps (`type-caption`) for names, headings and tags, and `type-num` for any number in a column.
- **Do** keep sections flat in both modes: a heading and hairlines, no card box.
- **Do** check every new screen in both modes; a yellow line or text that looks right on Night is invisible on Studio.
- **Do** design at 390px first, with 44px touch targets and 48px rows.
- **Do** use the show's own terms (castaways, tribes, Faithful, teams). The graphics are generic TV; the words belong to the show.
- **Do** put destructive row actions last in a bottom sheet, as red text after a divider.
- **Do** animate only `transform` and `opacity`, for a change the person just made, and never on first paint.

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

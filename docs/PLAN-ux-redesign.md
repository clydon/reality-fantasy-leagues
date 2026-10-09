# PLAN: UX redesign for commissioner and admin workflows (mobile-first)

Status: **proposal, nothing built.** Revised 2026-10-09. No code was changed for this document.

This is a **mobile-first** app for players and commissioners, so every design here starts at
**390px**, and desktop is the variant. Admin is mostly done at a desk, so admin screens are designed
desktop-first, but they must still work on a phone (nothing cut off, nothing unreachable).

**Evidence.** The screenshots are in [`docs/ux-baseline/`](ux-baseline/README.md):

- `m/…` means `ux-baseline/2026-10-09-mobile/…` (390×844). **This is the primary baseline.**
- `d/…` means `ux-baseline/2026-10-09/…` (1280×900). It's used for states the mobile set doesn't
  have: the create wizard's final step, guided setup, pre-draft and live draft, the reveal banner,
  and adding players or invites.

Design rules are cited by id from the **ui-ux-pro-max** skill (`~/.claude/skills/ui-ux-pro-max`,
`references/quick-reference.md`), for example `touch-target-size`.

Goals, from the brief:

- **Less clutter.** Fewer things competing per screen, clear hierarchy, no stacked banners, no
  repeated controls.
- **Friendlier workflows.** The common jobs (set up a league, run the draft, review weekly
  results, approve cast and results as admin) are obvious and short. Rare or dangerous actions are
  out of the way.
- **Works at 390px**, and for commissioners and players it is *designed* at 390px.

Effort: **S** = a day or less, mostly one component; **M** = a few days, several components or a
new route; **L** = a week+, new navigation or data plumbing.
Priority: **P1** do first, **P2** next, **P3** nice to have.

---

## 0. Capture notes

- The mobile set has no live-draft or pre-draft capture. The live draft is the one commissioner
  screen most likely to be used on a phone, so recapture it at 390px before building 2d.
- `d/mobile/02-admin-survivor-expanded-full.png` (the old, smaller mobile set) is actually the
  Episodes page. The new `m/admin/…` set replaces it.
- The admin results review was captured with spoilers off in both sets, so the review itself is
  hidden. Section 3d is based on the screenshots plus
  `src/components/admin/season-decisions-review.tsx`.
- The capture README notes that on mobile the scripts had to click with `dispatchEvent` "because
  the bottom tab bar covers buttons". The cause is in 1d.

---

## 1. Mobile foundations (shared components, fix once)

These come up on almost every mobile screen. Most are fixed in a handful of shared components.

### 1a. Form controls are too small for a phone

- **Text is under 16px, so iOS zooms in on every field.** `src/components/ui/input.tsx` uses
  `text-[0.88rem]` (14px) by default and `text-[0.75rem]` (12px) for `size="sm"`. Selects and the
  player-row controls in `players-section.tsx` use `text-xs`. iOS Safari zooms the page whenever a
  field under 16px gets focus, then leaves it zoomed. That hits every form in the app:
  `m/commissioner/03-league-settings/03`, `/07`, `/08`, `m/commissioner/06-episodes/03`.
  (`readable-font-size`)
- **Fields are ~34px tall by default and ~26px for `sm`**, under the 44px minimum
  (`touch-friendly-input`).
- **Checkboxes are ~13px**, with the label as the only bigger target: *Enable Replenish*, *Enable
  Swap*, *Enable Predictions*, *Computer player* (`m/…/03-league-settings/04`, `/05`, `/07`). The
  ⓘ hints next to them are ~14px (`touch-target-size`).
- **Icon-only and text-link actions are tiny and close together**:
  - the unlabelled ✏️ button is ~32×24 (`m/…/06-episodes/03`);
  - the cast table's ✎ and ✕ are ~12px and ~8px apart, so a slip removes a castaway
    (`m/admin/03-cast-review/02`, crop at y≈1700);
  - *Undo* on an eliminated card is a small pill (`m/…/06-episodes/06`);
  - text links like *← Back*, *Settings*, *Paste research*, *Clear data*, *Re-pull ≈4¢* and *view
    rules* have ~16px-tall hit areas (`m/commissioner/01-create-league/02`,
    `m/admin/02-shows-seasons/02`).

  (`touch-target-size`, `touch-spacing`, `no-precision-required`)

**Fix.**

- Below the mobile breakpoint, inputs, selects and textareas use 16px text and at least 44px height.
  Keep `sm` for desktop only, or give it a 16px/44px floor on mobile.
- Checkboxes become full-row toggle rows: the whole row is the target, with a switch on the right.
- Icon buttons get a 44×44 hit area (visual size can stay smaller) and an `aria-label`.
- Text-link actions become real buttons or move into a `⋯` sheet (1c).

Effort **S** (`input.tsx`, `select.tsx`, a new toggle-row component), then **M** to swap checkboxes
across settings. Priority **P1**. It's the cheapest change with the widest effect.

### 1b. Things don't fit the screen width

- The **Results** select runs past the card's right edge (`m/…/03-league-settings/03`).
- The research panel's selects overflow their cards (`m/…/06-episodes/05`).
- The **Users table is cut off**. Columns after Email, including *Impersonate* and *Edit*, are off
  the right edge (`m/admin/06-users-leagues/01`), so an admin can't edit a user on a phone without
  sideways scrolling.
- The *Research sites* and *Wiki URL* inputs are truncated with no way to see the value
  (`m/admin/02-shows-seasons/04`).
- **Nesting eats the width.** Season content sits four bordered boxes deep (page card → show card →
  season card → episode list), which leaves ~230px for content (`m/admin/04-episode-results/02`).
  Labels wrap to two lines ("Draft scheduled / for:", `m/…/03-league-settings/03`).

(`horizontal-scroll`, `content-priority`)

**Fix.** Below 480px:

- labels go above fields, and every field and select is full width;
- tables become card lists (name, one secondary line, a `⋯` button);
- no more than one bordered container inside a page card, using dividers instead of nested boxes;
- long values like URLs get a full-width field.

Effort **S** for the settings forms and the users table, **M** for the admin nesting (it mostly goes
away with 3b). Priority **P1**, because the users-table cut-off is a real break.

### 1c. Row actions: use a bottom sheet, and put danger last

On a phone, filled red buttons are the boldest thing on screen, so they read as the main action:

- every player and tribe has a red *Remove* (`m/…/03-league-settings/07`, `/08`);
- *Reset All Data* and *Leave League* are big red buttons in the same scroll as routine settings
  (`m/…/03-league-settings/01`);
- every league row has a red *Delete* (`m/admin/06-users-leagues/04`), and league members have red
  *Unlink* and *Delete player*;
- the user modal has a red *Remove* per league plus *Delete Account* (`m/admin/06-users-leagues/02`);
- *Delete Episode* is a red button next to the episode number (`m/…/06-episodes/06`);
- there are 12 *Undraft* buttons on a finished draft (`m/commissioner/05-draft/06-complete-full`);
- *Clear data* appears in red on every admin episode row (`m/admin/02-shows-seasons/03`).

**Pattern.**

```
 ● Bot Alpha   computer · 3/3      [⋯]
                                     │
 ┌──────────────────────────────────┐▼  bottom sheet
 │ Bot Alpha                        │
 │  Rename                          │
 │  Colour                          │
 │  Skill: Solid                 ›  │
 │  Hand over to a person…          │
 │ ──────────────────────────────── │
 │  Remove from league   (red text) │
 │  [ Cancel ]                      │
 └──────────────────────────────────┘
```

- Row actions open a **bottom sheet** on mobile (a dropdown menu on desktop). Destructive items go
  last, in red text, after a divider (`overflow-menu`, `destructive-emphasis`).
- Page-level destructive actions go in a collapsed **Danger zone** at the bottom of the page.
- Deleting a league, show, season or account asks you to type its name. Smaller removals get an
  **Undo** toast instead of a confirm dialog (`undo-support`).
- Filled red is used only for the final confirm button.

Effort **S** for the shared sheet and danger-zone components, **M** to roll out. Priority **P1**.

### 1d. The bottom bar covers content when the page scrolls to it

The main area reserves bottom padding for the tab bar (`auth-gate.tsx`, `pb-[calc(84px+…)]`), so
the *end* of each page is clear. But anything scrolled into view programmatically (focusing a
field, jumping to an anchor, an error, the capture scripts) lands at the screen's bottom edge, under
the bar. That's why the capture scripts couldn't click buttons normally. Users hit the same thing
when the keyboard moves focus or a "jump to" link fires.

**Fix.** Set `scroll-padding-bottom` on the page to the bar height plus the safe-area inset. Set
`scroll-padding-top` to the header height. Effort **S**, priority **P1** (`fixed-element-offset`).

### 1e. Navigation hides the commissioner's tools

`m/commissioner/00-more-menu-sheet`, every `m/` screen:

- The bottom bar is **Overview · Episodes · Scoreboard · Chat · More**. **Chat appears twice**,
  as a tab and as the header icon.
- The commissioner's two main tools are in **More**: *Draft Results* (the draft page is labelled
  "Draft" on desktop and "Draft Results" here) and *League Settings*. Running the draft or inviting
  someone is two taps behind a generic menu.
- **No page has a title on mobile.** The header always shows the league name. With every card
  styled alike, Settings, Draft and Admin are hard to tell apart at a glance
  (`m/…/03-league-settings/01`, `m/…/05-draft/06`, `m/admin/01-admin-home/02`).
- The dashboard (join/create) still shows the league's bottom bar, plus a small text link,
  "← Back to UX Baseline S51" (`m/commissioner/01-create-league/01`).
- Admin opens inside the league's chrome: league name in the header, league tabs at the bottom
  (`m/admin/01-admin-home/01`).

(`nav-hierarchy`, `bottom-nav-limit`, `persistent-nav`, `nav-state-active`)

**Proposal.**

```
┌────────────────────────────────────┐
│ ‹  League Settings         💬  ⌄   │  ← page title; league name moves to the switcher (⌄)
├────────────────────────────────────┤
│ …                                  │
├────────────────────────────────────┤
│  ⌂        📅        ⚑         🏆    ☰ │
│Overview Episodes  Draft  Scoreboard More│  ← slot 3 follows the season phase
└────────────────────────────────────┘
```

- **Drop the Chat tab.** Chat stays as the header icon with its unread badge. That frees a slot.
- **Slot 3 follows the season phase, in a fixed position:** *Draft* before and during the draft,
  then *Lineup*, *Pick* or *Mid-season*, depending on league type. `mobile-nav.tsx` already has a
  "promoted 4th tab" mechanism (~line 155). The slot keeps its place and changes only between
  season phases, not between pages, which keeps it within `navigation-consistency`.
- **More**, for commissioners, starts with *League Settings* and *Invite players*, then the
  player items, then a separate **Admin** group for admins.
- Every page shows its **title** in the header. The league name moves into the switcher button.
- The dashboard and the admin area get their own headers, and no league tab bar (3a).

Effort **S–M**. Priority **P1**.

> Decision for you: dropping the Chat tab assumes the header icon plus badge is enough for chat.
> If chat is a core habit for your players, swap Scoreboard into More instead.

### 1f. Banners take a quarter of the screen

`m/commissioner/06-episodes/02`: the header (~55px), the *Turn on notifications* banner (~75px) and
the bottom bar (~65px) together use ~23% of an 844px screen before any content. On desktop the
same slot stacks up to three banners (*Results are in!*, notifications, create-success;
`d/commissioner/02-guided-setup/02`, `d/…/05-draft/03`). *Reveal results* even shows on a league
that hasn't drafted (`d/…/05-draft/01`) and on /admin (`d/admin/01-admin-home/01`).

**Proposal: one slim attention strip.**

```
┌────────────────────────────────────┐
│ ● Your pick · round 2       Go ›  1/3│  ← 44px, top item only, pager for the rest
└────────────────────────────────────┘
```

- Merge `results-in-banner.tsx` into the `action-bar.tsx` queue, ranked: your draft turn > results
  to reveal > lineup or pick due > invite > notifications nudge.
- One 44px row, showing only the top item. The pager already exists.
- Don't offer *Reveal* before the league has drafted. Show no league items on /admin, /reports or
  /account.
- The notifications nudge leaves the strip. Show it once on the dashboard after joining a league,
  and keep it in Account settings.
- The "created your league" notice becomes the wizard's invite step (2a).

Effort **S–M**. Priority **P1**.

### 1g. Developer copy and misplaced controls

- Admin copy names files and models: "(src/lib/whats-new.ts)", "Haiku 4.5 ($1/$5)", "≈13¢ /
  episode" (`m/admin/01-admin-home/01`, `m/admin/02-shows-seasons/07`).
- The commissioner's rules view lists the **AI research checklist**, with field names like
  `wonIndividualImmunity` and `(integer)` (`m/commissioner/04-league-rules/02`, `d/…/04-league-rules/02`).
- The scoreboard footer tells every player how Sole Survivor "should be logged"
  (`m/…/07-overview-scoreboard/03`).
- **Customize Overview (admin only)** sits at the top of one league's Overview and wraps awkwardly
  on mobile (`m/…/07-overview-scoreboard/01`, `/02`). It changes the layout for every league of
  that type.

**Fix.** Move model and price details to Admin → Site. Show the research checklist to admins only,
in the format view. Move the Sole Survivor note into the commissioner's episode editor. Move
Customize Overview to Admin → Site. Effort **S**, priority **P2**.

---

## 2. Commissioner workflows (designed at 390px)

### 2a. Create a league

**Screens:** `m/commissioner/01-create-league/01`–`03`; `d/…/01-create-league/04`,
`d/…/02-guided-setup/01`–`02` for the parts the mobile set lacks.

**Problems**

- On a phone, step 1 starts below the notifications banner, a "Signed in as" line, a small text
  link back to the league, and the *Join a league* card (`m/…/01`). The wizard is a card inside the
  page, not a focused flow.
- Step 3's *Create League* button sits beside the name field, squeezing it (`m/…/03`). *← Back* is
  a small text link.
- Test shows (*Test Island Quest*, *Test Island Quest Two*) are offered to everyone.
- After *Create*, you land on League Settings, which asks for **name and show again**, then the
  **season**, then repeats **league type** next to Results, Starts-at and Ownership
  (`d/…/02-guided-setup/01`, `/02`). Season is what everything depends on, and the wizard skips it.
- A red *Leave League* is the second card a new commissioner sees (`d/…/02-guided-setup/01`).
- The join code, the thing you share, appears only in a dismissible notice.

**Redesign: a full-screen, 4-step flow.**

```
┌────────────────────────────────────┐
│ ✕  New league               1 of 4 │
│ ▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│                                    │
│ What are you playing?              │
│ ┌──────────────┐┌──────────────┐   │
│ │ 🏝 Survivor  ││ 🎬 Traitors  │   │
│ └──────────────┘└──────────────┘   │
│ Which season?                      │
│ ┌────────────────────────────────┐ │
│ │ ● Season 51 · airing · 21 cast │ │
│ │ ○ Season 49 · finished         │ │
│ └────────────────────────────────┘ │
│                                    │
│ [            Next             ]    │  ← full-width, sticky above the keyboard
└────────────────────────────────────┘
```

1. **Show and season.** Picking a finished or mid-season season sets results to catch-up and says
   so in one line.
2. **How to play.** The three type cards, full width.
3. **Name**, plus an optional draft date. The name field is full width and the button is below it.
4. **Invite.** A big join code with **Share** (the phone's share sheet via `navigator.share`, with
   *Copy* as fallback) and an invite-by-username field. *Done* lands on **Draft**.

- The progress bar and a full-width *Back* button make it a proper multi-step flow
  (`multi-step-progress`).
- Results, Starts-at and Ownership get defaults (live, 1, exclusive) and live in Settings. Guided
  mode in `setup-tab.tsx` goes away.
- Join league becomes a separate button on the dashboard, not a card above the wizard.
- Hide test and archived shows from non-admins.
- The only commissioner never sees *Leave League*. They get *Transfer commissioner* and *Delete
  league* in the danger zone.

Effort **M**. Priority **P1**.

### 2b. League Settings

**Screens:** `m/commissioner/03-league-settings/01`–`10` (`/01` is 3,025px tall).

**Problems**

- **One long scroll of 11 cards** for a Classic league: Invites, League info, General, Rules,
  Predictions, Finale predictions, Players, Tribes, Castaways, Backup, Leave League. Other league
  types add up to 7 more (`setup-tab.tsx`). Set-once, occasional and dangerous items all have the
  same weight.
- **League Info at 390px**: eight label-and-field pairs with wrapping labels, three of them greyed
  out after the draft, an overflowing Results select, and four lines of grey small print
  (`/03`). *Season* is still enabled after the draft while *Show* and *League type* are locked,
  which is worth checking.
- **Single-control cards**: *General* is one number and two checkboxes (`/04`). *Predictions* is a
  checkbox and a number (`/05`). *Finale predictions* is one checkbox (`/06`).
- **Player rows are four lines tall**: swatch, a truncated hex code (`#45A89/`), a small name field,
  roster count, a checkbox, a skill select, *Hand over…*, red *Remove*, and the same two-line bot
  description on every bot (`/07`).
- **Tribes** repeat the hex code and red *Remove* (`/08`).
- **Castaways** is a read-only list drawn as disabled inputs, including a photo-path field
  (`/10`).
- The join code isn't on this page at all.

**Redesign: a settings list that opens separate pages** (the phone-settings pattern; on desktop the
same pages sit beside a left sub-nav).

```
┌────────────────────────────────────┐
│ League Settings                    │
├────────────────────────────────────┤
│ Join code HXG27Y        [Share]    │
├────────────────────────────────────┤
│ 👥 Players & invites        4   ›  │
│ 🏝 League setup  S51 · Classic  ›  │
│ 🧮 Scoring & rules  custom      ›  │
│ 🎯 Predictions        on       ›  │
│ 🛡 Tribes & castaways        ›  │
│ 💾 Backup                     ›  │
├────────────────────────────────────┤
│ Danger zone                    ⌄   │
└────────────────────────────────────┘
```

Each row shows its current value, so the list doubles as a summary. Each opens its own page with a
back arrow and its own URL (`/setup/players`, …) so the action strip can deep-link to it
(`deep-linking`, `back-behavior`).

```
┌────────────────────────────────────┐
│ ‹  Players & invites               │
├────────────────────────────────────┤
│ [ username or email      ][Invite] │
│ test1 · invite pending        [⋯]  │
│ ────────────────────────────────── │
│ ● uxbaseline   you · commish  2/3  │
│ ● Bot Alpha    computer       3/3 ⋯│
│ ● Bot Bravo    computer       3/3 ⋯│
│ ● Bot Charlie  computer       3/3 ⋯│
│ [ + Add player ]  [ + Add computer ]│
└────────────────────────────────────┘
```

- **Players & invites**: invites, then one-line player rows. Colour, skill, hand over and remove go
  in the row's bottom sheet (1c). The bot description shows once, in the add-computer dialog.
- **League setup**: name, season, type, draft date, results mode. Starts-at and Ownership go behind
  "More options". Locked fields render as plain text with 🔒, and one sentence explains the lock
  (`read-only-distinction`).
- **Scoring & rules**: roster size, replenish and swap as toggle rows, and the rules (2c).
- **Predictions**: predictions and finale predictions as two toggle rows with their points, on one
  page.
- **Tribes & castaways**: tribes as swatch + name rows, and castaways as a read-only photo list
  with tribe chips.
- **Backup**: Export and Import.
- **Danger zone**: Reset all data, and Leave league or Delete league. Collapsed, at the bottom.

Effort **M** (it mostly re-parents existing section components into routes, plus the player-row
rewrite). Priority **P1**.

### 2c. League rules

**Screens:** `m/commissioner/04-league-rules/01`–`02` (`/02` is **7,600px** tall).

**Problems**

- Rules expand inline inside Settings, so opening them pushes everything else thousands of pixels
  down.
- Each rule takes 3–4 lines at 390px: title, "3 excl. / 4 shared pts" (both modes, though the
  league uses one), and a condition that repeats the title (`/01`).
- The view ends with the AI research checklist (1g).
- The *Edit* and *Abandon — go back to the show's rules* buttons are small and side by side, and
  *Abandon* is as prominent as *Edit*. There's also a nested *Close* button.
- In edit mode, *Save changes* sits at the very bottom of the 7,600px page.
- Admin's format rules view is a near-copy in a different place.

**Redesign**

```
┌────────────────────────────────────┐
│ ‹  Scoring & rules                 │
│ Following Survivor's rules         │
│ [ Customise ]                      │
├────────────────────────────────────┤
│ CHALLENGES                         │
│ Individual immunity win        3   │
│ Individual challenge, 2nd    1.5   │
│ Tribe immunity win             1   │
│ TRIBAL COUNCIL                     │
│ Voted out (automatic)         −3   │
│ …                                  │
└────────────────────────────────────┘
```

- One line per rule, showing only this league's points. Tap a row to see its condition.
- Categories collapse after the first two, so the page fits in about two screens.
- **Customise** turns the same list into an editor: tap a row to edit it in a bottom sheet, one
  *+ Add rule* per category, and a sticky *Save · N changes* bar above the tab bar. *Revert to
  show's rules* goes in the page's `⋯` sheet.
- One rules component with three modes: read-only, league edit (commissioner) and format edit
  (admin). Admin's view uses it too (3e).

Effort **M** (**L** if format editing is unified too). Priority **P2**.

### 2d. Draft

**Screens:** `m/commissioner/05-draft/06-complete-full`; `d/…/05-draft/01`–`05` for the pre-draft
and live states (not captured at 390px).

**Problems**

- On a phone, the **draft order with ↑↓ buttons takes the first screen**, even after the draft is
  done (`m/…/06`). The arrows stay live after the start (`draft-order-panel.tsx` has no lock).
- On your turn (`d/…/05-draft/03`), the castaways come *after* the order panel, a status card and
  the results grid. At 390px that's two to three screens of scrolling before you can pick.
- **One tap drafts.** Each free-agent card is a tap target with a tiny *Draft* pill. On a phone,
  scrolling past a card can draft it, and the only fix is Undraft.
- **12 Undraft buttons** on the finished draft, one per pick (`m/…/06`).
- The page is labelled "Draft Results" in More, and has no Draft tab (1e).
- The start confirm mentions "ignoring any scheduled time" when none is set
  (`d/…/05-draft/02`). "Draft complete!" tells you where to go without linking there.

**Redesign: three phase layouts.**

Live, your turn:

```
┌────────────────────────────────────┐
│ ‹  Draft                 Round 2/3 │
├────────────────────────────────────┤
│ 🟢 You're on the clock · pick 8    │  ← sticky
├────────────────────────────────────┤
│ [ Search…        ] Toka Savu  All  │
│ ┌──────┐┌──────┐┌──────┐           │
│ │ 🙂   ││ 🙂   ││ 🙂   │  3-up grid │
│ │Brady ││Danny ││Devin │  tap =     │
│ └──────┘└──────┘└──────┘  select    │
│ …                                  │
├────────────────────────────────────┤
│ Brady Booker      [ Draft Brady ]  │  ← sticky confirm, above the tab bar
├────────────────────────────────────┤
│  ⌂     📅    ⚑ Draft    🏆     ☰     │
└────────────────────────────────────┘
   Teams ▸  (a sheet: each team's picks)
```

- **Before the draft**: the order list (drag handle plus ↑↓, *Randomise*), *Schedule…* and *Start
  draft now*. Free agents are collapsed.
- **Live**: a sticky "on the clock" row, castaways first, then **select, then confirm** in a sticky
  bar (`touch-target-size`, `gesture-alternative`). Teams open in a sheet. When it isn't your turn,
  the sticky row says who's picking and the grid is read-only.
- **Complete**: "Draft complete ✓" with *Go to Overview* and *Episodes* buttons, then the teams with
  no buttons. *Edit picks* (commissioner only, in `⋯`) reveals Undraft.
- The order panel disappears once the draft starts. It becomes one line: "Snake order: you, Bot
  Alpha, …".
- Start confirm: "Start the draft now? The order can't change after this." Mention the schedule
  only if one is set.

Effort: **S** to hide the order and Undraft after the start; **M** for select-then-confirm and the
live layout. Priority **P1** for both. On a phone, accidental drafts are the riskiest interaction in
the app.

### 2e. Episodes (weekly results)

**Screens:** `m/commissioner/06-episodes/02`–`06`.

**Problems**

- **The list says nothing**: three rows reading "Episode 3 / 2 / 1" (`/02`). No date, no status,
  nothing to say whether results are waiting.
- **Unaired Episode 3** opens the same editor as a scored one: "Nothing logged yet" plus two entry
  forms (`/04`).
- **Manual entry is the default view**, even in a Live league that gets results automatically. On
  a phone the two forms are taller than the recap above them (`/03`).
- **An unlabelled ✏️** (~32×24) toggles edit mode, which adds a red *Delete Episode* next to the
  episode number (`/06`).
- **Research this episode** is the first thing in every expanded episode. Open, it's ~2,800px at
  390px, with selects running off the card edge and a disabled checkbox and "Already in your
  league." on every row (`/05`).
- *+ Add Eliminated Player* scrolls under the tab bar mid-page (1d).

**Redesign: a status list, a read view, and editing behind a button.**

```
┌────────────────────────────────────┐
│ Episodes                           │
├────────────────────────────────────┤
│ Ep 3 · Wed Oct 7                   │
│ 🔴 Results ready        [ Reveal ] │
├────────────────────────────────────┤
│ Ep 2 · Wed Sep 30                  │
│ ✓ Ana Sani out · you +1          › │
├────────────────────────────────────┤
│ Ep 1 · Wed Sep 23                  │
│ ✓ Aaliyah Puglia out             › │
├────────────────────────────────────┤
│ Ep 4 · Wed Oct 14   airs in 5 days │  ← muted, not tappable
└────────────────────────────────────┘
```

Tapping a scored episode opens its own page:

```
┌────────────────────────────────────┐
│ ‹  Episode 2               [⋯]     │  ⋯ = Edit results, Research, Delete
├────────────────────────────────────┤
│ Immunity  SAVU                     │
│ Out       Ana Sani · voted out     │
│ This week  you +1 · Alpha 0 · …    │
│ Events (12)                     ⌄  │
└────────────────────────────────────┘
```

- Each row shows a date and one status: *Airs in N days*, *Results ready (Reveal)*, *Scored*, or
  *Needs results* for manual and catch-up leagues.
- Each episode is its own page (`/episodes/2`), so back works and the list stays short.
- **The read view is the default.** *Edit results* (in `⋯`, plus a button when results are
  missing) shows the entry forms with full-width fields and per-item Undo.
- *Research* moves into edit mode as "Fill gaps with research". It shows only when the league
  enters results itself or there are gaps, and "already in your league" rows collapse into a count.
- *Delete episode* and *Renumber* go last in `⋯`.

Effort **M**. Priority **P1**.

### 2f. Overview and Scoreboard (as a commissioner)

**Screens:** `m/commissioner/07-overview-scoreboard/01`–`03`.

These work reasonably at 390px. Commissioner fixes:

- Move *Customize Overview* out (1g). On mobile it's a wrapped, dashed box above Standings.
- Remove the scoreboard's Sole Survivor footnote (1g).
- Add a **commissioner card** at the top of Overview, shown only when something needs doing: "Draft
  not scheduled · Schedule", "Ep 3 ready · Reveal", "2 invites pending". On a phone this replaces
  digging through More → League Settings.
- Standings and Latest Episode sit side by side in ~170px columns. Stack them below 420px.

Effort **S**, priority **P2**.

---

## 3. Admin workflows (desktop-first, must work on mobile)

### 3a. Admin structure

**Screens:** `m/admin/01-admin-home/01`–`02`, `m/admin/02-shows-seasons/01`, `/07`;
`d/admin/01-admin-home/01`–`02`.

**Problems**

- **One page holds everything**: the paid-AI and spoiler toggles, What's New, the model picker,
  every show → season → episode row, add or research a show, the formats list, users and leagues. At
  390px it's ~2,550px collapsed (`m/…/01-admin-home/02`), and **7,000–9,000px** with a show
  expanded (`m/…/02-shows-seasons/07`, `m/…/04-episode-results/01`). There are no anchors, tabs or
  sub-pages.
- **There's no "what needs me" view.** The weekly job, reviewing new results, means finding one
  *Results ✓* button among dozens.
- The two global toggles and their explanations fill the first screen on a phone
  (`m/…/01-admin-home/01`).
- *Settings* toggles look alike, swap labels in place, and stay open, so the page keeps growing.
- Admin runs inside a league's chrome: league name in the header, league tabs at the bottom (1e).

**Redesign: an admin area with a work queue and separate pages.**

```
┌────────────────────────────────────┐
│ ‹ Leagues     Admin   [Paid AI off]│
├────────────────────────────────────┤
│ NEEDS ATTENTION                    │
│ Survivor 51 · Ep 3                 │
│   12 results pending   [ Review ]  │
│ Traitors S4 · cast                 │
│   not approved         [ Review ]  │
│ Reports · 1 new          [ Open ]  │
├────────────────────────────────────┤
│ Shows & seasons                 ›  │
│ Formats & rules                 ›  │
│ Users                       7   ›  │
│ Leagues                     8   ›  │
│ Reports                         ›  │
│ Site settings                   ›  │  ← paid AI, spoilers, What's New, models, Overview layouts
└────────────────────────────────────┘
```

- The **Needs attention** queue is built from data the page already loads.
- Each section is its own route. On desktop the list becomes a left sidebar.
- The paid-AI and spoiler toggles move to *Site settings*. A chip in the admin header shows when
  paid AI is on, so it's always visible.
- Admin gets its own header and no league tab bar.

Effort **L**. Priority **P2** now (P1 before the mobile-first reframe). A cheaper first step (**S–M**)
is to keep one page but add the Needs-attention card at the top and a sticky row of section
anchors.

### 3b. Shows & seasons

**Screens:** `m/admin/02-shows-seasons/01`–`07`; `d/admin/02-shows-seasons/01`–`07`.

**Problems**

- Show → season → episode is nested inside one accordion. Completed seasons list all 13–14
  episodes, each with *Results ✓*, *Paste research* and red *Clear data*. At 390px, *Clear data*
  wraps onto its own line under the other links (`m/…/03`, crop of `m/…/07`).
- The steps 1–2–3 (Cast, Rules, Episodes) are a good idea, but only Cast shows real state.
- **Auto-research** shows "is on" with a red *Switch off* even when paid AI is off (`m/…/02`). With
  paid AI on, it's a select, an hours field and a model select (`m/…/07`). Same setting, two UIs.
- The schedule row (*Episodes ?*, date, time, timezone) wraps onto three lines at 390px and warns
  in red on a finished season (`m/…/03`).
- Show settings mix everyday labels with plumbing (Wiki API, Cast section heading, Art, Research
  sites), and put *Delete show* next to *Archive show* (`m/…/04`).
- Test shows with nothing in them take as much room as Survivor.

**Redesign: a show list, then a season page with tabs** (desktop-first, stacking at 390px).

```
┌────────────────────────────────────┐
│ ‹  Survivor · Season 51   [⋯]      │
│ Airing · 4 leagues                 │
│ [Episodes] [Cast ✓] [Rules] [Setup]│
├────────────────────────────────────┤
│ Airs Wed 8 PM ET · auto 12h  Edit  │
├────────────────────────────────────┤
│ Ep 4 · Oct 14   upcoming           │
│ Ep 3 · Oct 7    12 pending  Review │
│ Ep 2 · Sep 30   ✓ 43          ⋯    │
│ Ep 1 · Sep 23   ✓ 31          ⋯    │
└────────────────────────────────────┘
  ⋯ = Open, Research again, Paste research, Clear data (danger)
```

- Each season gets a page with four tabs, so nesting drops from four levels to one.
- Episode rows show a date, one status and one primary action. Everything else goes in a sheet.
- Completed seasons show the last 3 episodes and "Show all".
- Auto-research is one control. With paid AI off it reads "paused (paid AI off)".
- The schedule is a one-line summary with *Edit*, and warns only while a season is airing.
- Show settings split into *Basics* and *Connector* (behind a disclosure). *Delete show* goes in the
  danger zone.
- Hide empty and test shows behind "Archived / empty (3)".

Effort **L**. Priority **P2**.

### 3c. Cast review

**Screens:** `m/admin/03-cast-review/01`–`02` (`/02` is ~8,300px); `d/admin/03-cast-review/…`.

**Problems**

- The cast table opens inline inside the season card, mid-page.
- At 390px, names wrap to two lines, Tribe reads "hidden" on every row, and the ✎ / ✕ icons are
  ~12px and ~8px apart (1a).
- *Re-approve & push to leagues* is a filled red button at the bottom with four lines of
  explanation. *Re-pull ≈4¢* is a plain text link that costs money and replaces the cast.

**Redesign.** Cast becomes a tab on the season page (3b), with a header line ("21 castaways ·
approved Oct 2 · in 4 leagues"). Rows show photo, name, tribe chip (or "hidden · show spoilers")
and a `⋯` sheet with Edit and Remove. A sticky *Approve & push to 4 leagues · 3 changes* bar, in
primary colour, appears only when something changed. *Re-pull from wiki* goes in the tab's `⋯`
with its price and a confirm. Effort **M**, priority **P2**.

### 3d. Episode results review

**Screens:** `m/admin/04-episode-results/01`–`02`, `m/admin/02-shows-seasons/07`;
`season-decisions-review.tsx`.

**Problems**

- The review opens inline under the episode row, four levels deep. The column is ~230px wide at
  390px (`m/…/02`).
- With spoilers off it collapses to a count, so you can't see what's pending without revealing.
- Three ways to add results (*Pull results from wiki*, *Research*, *Paste research* / *Paste notes
  instead*) are equal-weight links on every row.
- Paste research explains a 3-step flow in a run-on paragraph and labels its button *Stage*
  (`m/…/02`).

**Redesign: a focused review page.**

```
┌────────────────────────────────────┐
│ ‹  S51 · Episode 3                 │
│ 12 pending · 31 accepted  [+ Add ▾]│
├────────────────────────────────────┤
│ ⚠ NEEDS A LOOK (2)                 │
│ Danny Kilby · voted w/ majority    │
│ research only · low confidence     │
│ [Accept] [Reject] [Correct…]       │
├────────────────────────────────────┤
│ Tribal Council (8)  all agree    ⌄ │
│ Challenges (10)                  ⌄ │
│ ✓ Left the game (1)  accepted    ⌄ │
├────────────────────────────────────┤
│ [ Accept all 12 · pushes to 4 ]    │  ← sticky
└────────────────────────────────────┘
```

- Its own route (`/admin/shows/survivor/51/episodes/3`).
- Order: low-confidence rows and source disagreements first, then pending groups, then accepted
  groups collapsed to one line.
- Spoiler-off mode keeps the structure but masks names ("Castaway A · voted out").
- One *+ Add results* menu (Pull wiki, Research, Paste). Paste is a 2-step sheet: copy the prompt,
  paste the answer, *Add to review*.
- One sticky *Accept all* bar. The component can render it in two places today (~lines 131 and
  149).

Effort **M**. Priority **P1**. It's the weekly admin job, and admins will check it from a phone on
the night an episode airs.

### 3e. Show formats & rules

**Screens:** `m/admin/05-show-formats-rules/01`–`03`.

The rules viewer opens inside show settings. *Research a new show* and the researched-formats list
share the Shows card. Draft formats named after built-in shows sit next to them, each with a red
*Delete*, and at 390px the research form is five stacked fields with half-width inputs (`m/…/03`).

**Redesign.** A *Formats & rules* page: built-in formats (read-only, using the shared rules
component from 2c) and researched formats with status chips (*draft*, *approved*, *in use by N*).
*Research a new show* opens a sheet. Delete goes in `⋯`, and is disabled with a reason when a format
is in use. Effort **M**, priority **P3**.

### 3f. Users & leagues

**Screens:** `m/admin/06-users-leagues/01`–`05`.

**Problems**

- The **users table is cut off at 390px**, with *Impersonate* and *Edit* off-screen (`m/…/01`).
- The user modal truncates league names ("Avoid Elimi…") to fit a select and a red *Remove*, and
  ends with a red *Delete Account*. *Save* sits between Email and Password, so it's unclear what it
  saves (`m/…/02`).
- Every league row has *Members* and a red *Delete*. Rows don't show show, season, type, member
  count, commissioner or activity (`m/…/04`).
- League members show *Change*, red *Unlink* and red *Delete player* side by side, and the
  explanation is jargon.
- The delete-league confirm is a plain two-button dialog (`m/…/05`).

**Redesign** (cards on mobile, a table on desktop):

```
┌────────────────────────────────────┐
│ ‹  Users (7)        [ + Create ]   │
│ [ Search users…               ]    │
├────────────────────────────────────┤
│ jordan                          ⋯  │
│ jordan@example.com · 3 leagues     │
├────────────────────────────────────┤
│ conor  super-admin              ⋯  │
│ conor@example.com · active today   │
└────────────────────────────────────┘
  ⋯ = Edit, Impersonate, Reset password, Delete (danger)
```

- League cards show name, "Survivor 51 · Classic · 4 players", the commissioner and last activity,
  plus a `⋯` with Open, Members, Copy join code and Delete.
- The user editor becomes a full-screen sheet on mobile with sections: *Profile* (with its own
  Save), *Password*, *Leagues* (full names, a role chip, `⋯`) and a collapsed *Danger zone*.
- Members open as a sheet: name, linked account, role chip, `⋯`.
- Delete league asks you to type its name and says what will go.

Effort **M**. Priority **P1** for making the table usable at 390px (S, via 1b), **P2** for the rest.

### 3g. Reports

`m/admin/07-reports/01` is an empty page in league chrome. Fold it into the admin area with a count
in Needs attention. Effort **S**, priority **P3**.

---

## 4. Summary table

| # | Change | Area | Effort | Priority |
|---|---|---|---|---|
| 1a | 16px / 44px form controls, toggle rows, real hit areas | all | S → M | P1 |
| 1b | Nothing wider than the screen; labels above fields; tables → cards | all | S–M | P1 |
| 1c | Bottom-sheet row actions, danger zones, typed confirms, Undo | all | S → M | P1 |
| 1d | `scroll-padding` for the header and tab bar | all | S | P1 |
| 1e | Phase-aware tab bar, no Chat tab, page titles, own headers for admin and dashboard | nav | S–M | P1 |
| 1f | One slim attention strip | all | S–M | P1 |
| 1g | Developer copy out; Customize Overview to admin | rules, admin | S | P2 |
| 2a | Full-screen 4-step create flow with season and a share step | create | M | P1 |
| 2b | Settings as a list of pages; one-line player rows | settings | M | P1 |
| 2c | Compact rules list; edit in sheets; shared rules component | rules | M (L) | P2 |
| 2d | Phase layouts; select-then-confirm; hide order and Undraft after start | draft | S + M | P1 |
| 2e | Episode status list; episode pages; read view by default | episodes | M | P1 |
| 2f | Commissioner to-do card; stack Overview columns | overview | S | P2 |
| 3a | Admin area: Needs attention + separate pages | admin | L (S–M first) | P2 |
| 3b | Show list → season page with tabs | admin | L | P2 |
| 3c | Cast tab with sticky approve bar | admin | M | P2 |
| 3d | Focused results review page | admin | M | P1 |
| 3e | Formats & rules page | admin | M | P3 |
| 3f | Users/leagues as cards on mobile, `⋯` rows | admin | S + M | P1 / P2 |
| 3g | Reports inside admin | admin | S | P3 |

---

## 5. Shortlist: best payoff for the effort (mobile-first)

1. **Mobile-safe form controls (1a, 1b, 1d), S.** 16px text and 44px height in the shared input and
   select components, toggle rows instead of 13px checkboxes, labels above fields, no overflow,
   and scroll padding for the bars. Three or four shared files fix the iOS zoom-on-focus problem,
   the tiny targets and the clipped controls across every form, and make the users table usable
   at 390px.
2. **One slim attention strip (1f), S–M.** It gives back most of the ~75–200px of banners above
   every page on a 844px screen, and stops *Reveal results* showing on undrafted leagues and in
   admin.
3. **A tab bar and header for commissioners (1e), S–M.** Draft in a fixed, phase-aware slot, Chat
   only in the header, League Settings first in More, and a title on every page. The draft and
   settings stop being two taps behind a generic menu.
4. **League Settings as a list of pages, with sheet-based row actions (2b + 1c), M.** A 3,025px
   scroll of 11 cards becomes one short list that summarises each section's current value. Player
   rows shrink from four lines to one, the join code gets a home with a Share button, and the red
   buttons move into sheets and a danger zone.
5. **Episodes status list with a read view by default (2e), M.** It's the weekly job. Each row says
   what happened and whether anything is waiting, unaired episodes stop showing entry forms, and
   the 2,800px research panel moves out of the default view.

Close behind: **lock the draft order and hide Undraft once the draft starts (S), then
select-then-confirm picks (M) (2d).** One tap drafting on a phone is the riskiest interaction in the
app. It sits sixth only because the live draft wasn't captured at 390px. Recapture it first, then
build it.

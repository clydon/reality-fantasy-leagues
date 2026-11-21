# Settings, Round 2: the build brief (Impeccable `shape`)

> **Status (2026-11-21): Round 2, step 3 of the design process.** Impeccable's shape on Intent's spec
> ([settings-r2-spec.md](settings-r2-spec.md)) and PFD's first views ([settings-r2-first-view.md](settings-r2-first-view.md)).
> Discovery is answered by the user's Round 0 and Round 1 decisions; the user confirms at the screenshot story, not mid-round.
> Assumptions are marked.

1. **Job and audience.** Operate mode. Someone inside a show (or on the hub) with one reason: be spoiled or not, be pinged or not,
   be seen or not, leave a game, bring someone, switch couch. They check a value or change one thing and go back to the show.
2. **Outcome and proof.** At 390 on real fixture people (alex the owner and runner, riley who only watches The Traitors, jordan, sam
   behind, casey on a second couch, solo): the gear opens "Your settings · Survivor 51" with ≤ 5 value rows in the first view; the ⋯
   has no settings and says where they went; Where you are opens at your boundary with I've watched them all; Leave this game holds
   for one game; the hub names its couch and a new phone opens on it.
3. **Direction.**
   - **Visual authority:** DESIGN.md's Lower Third, as built; Round 1's settings grammar reused, not redrawn: `PageSection`,
     `Row`, `SwitchRow`, `Choice`, `ResetLink`, the inline ask (settings/controls.tsx, results.tsx). One new part only: the show
     page's head.
   - **Thesis: the show carries its own settings.** The page head is the show's art band (as the ⋯ sheet and Notifications already
     use it), the kicker "YOUR SETTINGS" in condensed caps over the season's name. Rows below are Round 1's, so the show page and Your
     settings read as one system with a different subject on top.
   - **Focal moment:** Episodes you've watched, first row, its value with the air date in bone and the rest dusk-muted.
   - **Soul, not sterile:** the art band, the show's own words (Ep/Game/Week from show-words), and the ledger's chyron-line "You're
     here". No new yellow: the page has none unless Save is due.
   - **The gear:** the same lucide `Settings` glyph as the hub's, the same 44 px button as the ⋯, sitting left of it, so the bar
     reads back · show · status · gear · ⋯.
4. **Scope.** `src/new/screens/show-space.tsx` (the bar's gear, the ⋯ after, the page), a new `src/new/settings/show-page.tsx`, the
   watching sheet and `WhereAsk` (`src/new/watching/*`), `src/new/show/game-page.tsx`'s ⋯, `src/new/show/notify-sheet.tsx`'s Mute,
   `src/new/couch/couch-sheets.tsx` (switcher, details, hand-on), the hub's `TopBar` (`src/new/ui/bars.tsx`), the nudge's words
   (hub/sections.tsx), Show the score's line (hub/bands.tsx), When results show's Sports list (settings/results.tsx), Your settings'
   map rows (settings/yours.tsx), and their routes. Untouched: Backstage and Game settings (Round 3; step 2.7 edits them), the
   desk, Start a game, the sports lane's follow model. **Anti-goals:** a second card style; settings rows on the ⋯; red in a first
   view; a modal for anything but the holds; cheeky names.
5. **States and ranges.** Play / follow only / sport live / sport waiting / finished season / not started / 30 episodes; muted (until
   the next episode, a day, a week, for good), results off here; on a couch / solo; owner / member; one couch / two; acting as someone
   (read-only). Names to 30 characters; season labels like "The Traitors 5"; couch names to 30.
6. **Interaction and layout.**
   - The show page is a pushed page (`?page=you`, `usePushedPage`), its Back naming the tab it returns to.
   - Rows that open choices open them in place under the row (Round 1's pattern); one open at a time.
   - At once with Undo in the toast; Mark it watched and Straight away ask inline first; Leave holds (HoldSheet); Make someone else
     the owner confirms inline in its sheet, the safe choice filled on the left.
   - Where you are: the ledger scrolls to "You're here" on open; I've watched them all is a full-width secondary button above it;
     Save stays at the sheet's foot.
   - 44 px targets, 60–64 px rows, hairlines, `SectionHead` caps; the switcher's current couch is a card (panel fill), others plain
     rows.
7. **Constraints and open decisions.**
   - New client calls go in `src/new/settings/api.ts` (the sports lane shares data.ts).
   - *Assumed:* the page's kicker is "Your settings" and its title the season label; the ⋯'s foot line draws the gear glyph inline.
   - *Assumed:* the header's couch name is 13 px dusk-muted under the wordmark with a chevron, its tap target the full 44 px row.
   - *Assumed:* "Until the next episode" ends at the next episode's scheduled air time, shown "until Thu 8 PM"; hidden when the
     season has none.
   - Builders must not invent: a dot on the gear; per-game notifications; privacy per couch.

# Settings, Round 1: the build brief (Impeccable `shape`)

> **Status (2026-11-20): Round 1, step 3 of the design process.** Impeccable's shape on Intent's spec
> ([settings-r1-spec.md](settings-r1-spec.md)) and PFD's first views ([settings-r1-first-view.md](settings-r1-first-view.md)). The
> discovery questions are answered by the user's Round 0 decisions; the user confirms at the screenshot story (DESIGN-PROCESS.md),
> not mid-round. Assumptions are marked.

1. **Job and audience.** Operate mode. Someone arrives with a reason (a buzz, a worry, a fix), checks a value or changes one thing,
   and leaves. Most visits end at the first view, so each row's value has to be the answer.
2. **Outcome and proof.** At 390, on real fixture people: Your settings reads as "my settings" in five seconds and holds five group
   rows under the identity; every notification place says what you'll still get; a push or the bell reaches the exact control.
3. **Direction.**
   - **Visual authority:** DESIGN.md's Lower Third, as built (no new world). Night ground; hairline rows; values in dusk-muted; one
     chyron yellow, only on the plate while nothing reaches you. Settings pages follow DESIGN.md's "Settings pages" grammar (index
     row: icon, name, value under it, chevron), already used by Settings D's folds.
   - **Thesis: value as consequence.** The muted second line under every row is the shared part that makes four places one system: it
     says what a row is set to, and for anything that changes what reaches you, what that leaves you with. Built once (a row part and
     a "still get" line), used on You, Notifications, a show's sheet and a couch's row.
   - **Focal moment:** the first view of Your settings: face and name, then five rows that read like a summary of you.
   - **Soul, not sterile:** the identity card leads (your face at 52, your name in condensed caps), each group tile carries its own
     glyph, and the show's sheet shows the show's art strip behind "Mute Survivor". No slogans, no decoration beyond the house's.
4. **Scope.** Production code in the settings lane (`src/new/settings/*`, the hub bar, the show's notify sheet, the couch's details
   sheet, the bell, the service worker, the routes behind them). Untouched: the profile sheet's contents (Edit), the desk, Backstage,
   Start a game. **Anti-goals:** a new card style; a second yellow; controls open on the first view; cheeky names.
5. **States and ranges.** This phone: loading, on, off (nothing reaches you / another phone does), blocked, iPhone not installed,
   unsupported. 0–2 couches; 0–30 shows followed; 0–57 games on a show (the busy season: a show lists three games, then "+N");
   names up to 30 characters; 0–6 exceptions; 1–6 phones; a site admin; someone acting as another (read-only, said once).
6. **Interaction and layout.**
   - Groups push a page (`?page=`), so back closes it and a link lands on it; Appearance opens in place.
   - Every change applies at once with Undo in the toast; "Straight away", "Marked watched as it airs" and "Sign out everywhere else"
     ask first, inline, never in a modal.
   - A changed account-level choice shows Reset to recommended; a place-level override shows Use my default.
   - Mute's three durations open in place under its row; muted, the row's one action is Unmute.
   - 44 px targets; 64 px rows; hairlines between rows; section headings in condensed caps (`SectionHead`).
7. **Constraints and open decisions.**
   - The settings lane shares `src/new/data.ts` with the sports session: new hooks go in `src/new/settings/api.ts`, not data.ts.
   - *Assumed:* the gear sits between the bell and your picture on the hub's bar; the picture's sheet keeps a quiet "Your settings"
     row.
   - *Assumed:* Your phones names a device from its browser's user agent ("iPhone · Home Screen app"); no stored device names.
   - *Assumed:* Mute's "for a day" ends 24 hours from now, "for a week" 7 days from now, shown in the person's own time.

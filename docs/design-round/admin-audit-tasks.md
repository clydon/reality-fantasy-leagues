# Admin on a phone: the tasks, the page lengths, and the worst ten

> **Status (2026-11-21): Reference** for the desk's design round (Round 5 of [PLAN-settings-overhaul.md](../PLAN-settings-overhaul.md)).
> Read from the code (master de50aed6) and measured on the Round 0 renders at 390 × 844
> (`.ui-atlas/stories/desk-r0/before/`). Nothing was changed. It sits beside [desk-r0-audit.md](desk-r0-audit.md), which numbers
> every control (D1–D151) and every gap (M1–M14); where a finding here is one of those, it says so. Evidence only: no fixes
> are proposed here (they go through the round's Intent → Perception-First Design → Impeccable process).

The site's admin area is called "Site admin" on its doors, "Admin" in its header and "the desk" in the code. This page says
**admin**. Its three tabs are named as the screen names them: **Inbox**, **Find**, **Settings**.

**Paths.** Short paths are under `src/new/` (`desk/desk.tsx` is `src/new/desk/desk.tsx`); `server/` is `src/lib/server/`;
anything else is from the repo root. Line numbers drift: search for the words.

**Counting.** Every task starts on Home (`/home`), signed in as the site admin, on a phone 390 px wide. A **tap** is one press: a
row, a button, a switch, a chip, a field you type into (the typing counts with it), or a hold. **Scroll** marks where the next
control is off the screen. **Page** or **sheet** says where the job is done. **(code)** marks something read from the code that
no render shows.

---

## The three doors in

| Door | Taps to get in | Where it lands | Notes |
| --- | --- | --- | --- |
| **A. Your picture → Site admin** | 2 | the Inbox | Your picture, top right of Home (ui/bars.tsx:123-125), opens your profile sheet; "Site admin" sits under your couch numbers (hub/profile.tsx:139-149). Its line says "4 need you" once the sheet is open (it asks only then: :99). |
| **B. The gear → Your settings → Site admin** | 2 + a scroll | the Inbox | The row is at the foot of Your settings, above Sign out (settings/settings.tsx:130-152, row :138). Its line, "To do, search and the site's settings", names tabs that don't exist. |
| **C. A show → ⋯ → This season in Admin** | 3 | that season's admin page | Only for a show on your Home. The ⋯ is top right of the show (screens/show-space.tsx:547); the row is the menu's first or second (:567-569). Lands deep in admin with no tabs, and Back can't get out (Worst 1). |

Nothing on Home itself says admin needs you: your picture carries no dot (ui/bars.tsx:118-126).

---

## Part 1. The tasks, today, on a phone

### At a glance

| Task | Taps, door to done | Done in | Possible today? |
| --- | --- | --- | --- |
| T1 Anything need me? | 1 for a count, 2 for the list | sheet, then page | yes |
| T2 Decide a disputed result | 7 (6 if names already show), then 4 per extra result | page → second page → sheet | yes, by a maze |
| T3 Approve a waiting sign-up | 4 | page | yes |
| T4 Read a report, mark it done | 4 (+ a scroll) | page | yes; can't answer the sender |
| T5 Find a person, sign in as them, reset their password | 5 to find, 7 to be them, 12 to a new password | page, 2 sheets, 2 full reloads | yes |
| T6 Fix a couch nobody runs (make someone the owner) | 5-6 | sheet | games only: **the owner can't be changed from admin**; impossible if the owner's account is gone |
| T7 Find a game by its code, see its settings, archive it | 7 without the settings; about 13 with the detour | page → hold sheet | **its settings: not reachable** (only its rules in words) |
| T8 Add a show and get its season ready | about 15, plus two waits | 6 admin pages and 1 player-app page | yes, long |
| T9a Is the research bot working? | 5, for one season | page → sheet | **no screen says so**; one season at a time |
| T9b Run research now for an episode | 7 | sheet | yes |
| T9c Settle a season again | — | — | **impossible: a browser-console call** |
| T9d Release the catch-up hold | — | — | **impossible: a script** |
| T10 Change a site setting | 5 | sheet | yes |
| T11 Fix a cast member's photo or name | 8 | sheet | yes; a photo only as a link |
| T12 Edit a rulebook | about 11 | up to 3 sheets deep | yes |
| T13 Check an episode's results, correct one | 10 (9 if names show) | 3 sheets in a row | yes |
| T14 Preview the app as a player | 4 in, 3 out | sheet | yes, hidden |
| T15 See what changed recently | 4, site settings only | sheet | **across the site: impossible** |
| T16 Back to the app | 1 from a tab; 1 per level deeper | — | from door C and other outside doors, **Back loops** (code) |

### T1. Check whether anything needs me

1. Your picture → profile **sheet**. The Site admin row says "4 need you" or "Nothing needs you" (hub/profile.tsx:139-149). **1 tap answers yes or no.**
2. Site admin → the Inbox **page**, "Needs you" first (desk/desk.tsx:251-272). **2 taps to the list.**

- **Four names for one place:** "Site admin" (the door), "Admin" (the header, desk/desk.tsx:91), "Inbox" (the tab, :45), "Needs you" (the list, :258).
- **Rows are tall.** At 390 each row is about 100 px (the title wraps beside its tag): the render's four took 460 px. From about seven, "Coming up" (this week's episodes) is off the first screen.
- **Fixed order, by kind, not urgency** (server/desk-inbox.ts:252-327): split results, phase starts, "something new?", couches nobody runs, missing schedules, missing research runs, cast, sign-ups, sports stats, catch-up rows, reports, rulebook fixes, new rulebooks, shows added by name.
- **Three kinds of row lead nowhere.** "The catch-up is held" links to the Inbox itself (server/desk-inbox.ts:289-292). "The catch-up stopped" opens Setup, which has no catch-up button (:293-294). "… has no stats · tried again every few hours" opens the season with nothing to do (:280-281). (audit D24-D26)
- **Words:** "Still split" also tags results that are only waiting (desk/desk.tsx:116-117); "Scores"; "confirmed by 2+ sources" and "house rulings kept" (:298-301).

### T2. Decide a disputed (split) result

1. Your picture → sheet.
2. Site admin → Inbox.
3. The yellow "Still split" row, "{season}, Episode N: K results still split … decide on the episode's page" (server/desk-inbox.ts:106-114; first in the list, :252) → the episode **page**.
4. Turn **Hide names** off (desk/episode.tsx:138-146). It's on by itself for an episode you haven't marked as watched (:82). While it's on, "Disputed" shows only "K results: the sources split", with no buttons (:188-189).
5. Scroll down past "Not in the games yet" → **Decide** on a disputed row (:490-493) → a **second page**, the result's own (`/desk/fact/…`, desk/pages.tsx:62-160).
6. Scroll past "Says it happened", "Says it didn't" and "Where it counts" (code: the buttons sit about the foot of the first screen, and more sources push them lower; this page wasn't rendered) → **It happened** or **It didn't happen** (:119-126) → confirm **sheet** "Keep it for everyone?" (:139-156).
7. **Keep it** / **Remove it** (ui/guards.tsx GuardSheet). Toast: "Kept · canonical".

**7 taps; every further result: Back, Decide, choice, confirm = 4 more.**

- **Detour:** tapping a disputed row's words (not its Decide) opens the episode's own result sheet, whose only button, "Decide it", goes to the same second page (desk/episode.tsx:636-639).
- **Two vocabularies for one decision.** The episode's sheets say Accept, Reject, Correct it, Unlock it (:644-688). The second page says It happened, It didn't happen, "Something else: edit the fact" → "Override · …" → "Save override", Unlock and reopen (desk/pages.tsx:119-136, 176-233). (audit D111, D123-D127)
- **Engine words on the second page:** "Canonical" (:56), "in every league / in no league" (:84), "house ruling(s)" (:115, 144), "Becomes canonical and locked" (:144). (audit D121-D122)

### T3. Approve a waiting sign-up

1. Your picture. 2. Site admin.
3. "N accounts waiting to get in", tag "People", with their faces (server/desk-inbox.ts:215-235) → People **page**, filtered to Waiting.
4. **Let in** on their row (desk/people.tsx:47-66, 242-247). Toast "… is in · told by email", with Undo (:33-45).

**4 taps.**

- Two other ways: Settings › Who gets in, whose sheet lists the waiting with Let in (desk/desk.tsx:597-631, 764): 5 taps. Their own page's "Let {name} in" (desk/people.tsx:345-364).
- The row is the eighth kind in the Inbox's order (server/desk-inbox.ts:269): with results or schedules above it, scroll.
- **Words:** "approve" is **Let in**; the setting is **Who gets in**; the row says "signed up without an invite".

### T4. Read a report and mark it done

1. Your picture. 2. Site admin.
3. Scroll to the report row (tag "Report"). Reports come after twelve other kinds (server/desk-inbox.ts:295) → the report **page**; its words and Mark done are in the first screen (desk/reports.tsx:223-235).
4. **Mark done.** Toast with Undo.

**4 taps, plus a scroll when the list is long.** Find › Reports › the report › Mark done is 6.

- **Dead end:** no way to answer the sender (audit M10). Its Delete says "… isn't told" (desk/reports.tsx:262).

### T5. Find a person, sign in as them, then reset their password

1. Your picture. 2. Site admin. 3. **Find** tab (desk/desk.tsx:86).
4. Tap the search and type their name (:372-375). The first three people who match come first (:460-471).
5. Their row → their **page** (desk/people.tsx:269-559).
6. **Act as {name}**, "See and use the app as they do, for an hour" (:385-399) → **sheet** "Act as {name}? · For an hour" (desk/act.tsx:15-58).
7. **Act as {name}** → the app reloads as them, under a blue bar "Viewing as {name} · N min left · Return to my account" (session.tsx:39-86).
8. **Return to my account** → reloads onto their admin page, toast "Back to your account · it's in {name}'s History" (session.tsx:48-62; desk/people.tsx:286-296).
9. **Password** · "Reset it: a temporary one, shown once" (desk/people.tsx:410) → **sheet** (:689-758). It's in the page's first screen.
10. **Make a temporary password** (:732-752). 11. **Copy** (:708-723). 12. **Done** (:725-727).

**5 taps to their page, 7 to be them, 12 to a new password.**

- **Words:** "sign in as" is **Act as**; its bar says **Viewing as**; the admin header's eye is **View as**, which is a different thing (T14).
- Act as is greyed out for someone waiting, someone stopped, or another site admin, with the reason (desk/people.tsx:318-326).

### T6. Fix a couch nobody runs (make someone the owner)

1. Your picture. 2. Site admin.
3. "Nobody runs {couch}'s games · Its only Commissioner has gone · N people waiting on results", tag "Couch" (server/desk-inbox.ts:147-161) → the couch **page**.
4. **Hand them on**, in the "Nobody runs its games" panel under the couch's name (desk/pages.tsx:365-378) → **sheet** "Hand on {couch}'s games", "Who runs them next?" (desk/seats.tsx:841-878, 944-980). The most active person is already picked.
5. (Optional) pick someone else.
6. **Hand all N to {name}** (:1026-1028). They're told and "become Commissioner" (:1022-1025). Toast with Undo.

**5-6 taps.**

- **It isn't the owner.** This makes someone the Commissioner of the couch's games. The couch's owner (its "Started it" person, desk/pages.tsx:383) can't be changed from admin: only the owner can hand a couch on, from the couch sheet in the player app (couch/couch-sheets.tsx:375-380; the server refuses anyone else, server/couch-joins.ts:141-142).
- **Impossible from any screen if the owner's account is gone.** While it exists, the only way is to Act as the owner (T5 steps 3-7), then their Home › couch name › couch sheet › "Make someone else the owner" › pick › confirm, then Return: about 13 taps.
- **Words:** "Hand them on"; "Commissioner" when you came to fix an owner; "N people waiting on results" is no longer true (audit D14).

### T7. Find a game by its join code, see its settings, archive it

1. Your picture. 2. Site admin. 3. Find.
4. Type the code in the search. Find does match codes, though its placeholder reads "A show, season, castaway, couch or person" (desk/desk.tsx:374). The row then reads "Game · Join code ABC123 · …" (desk/games.tsx:164-182).
5. The game → its admin **page** (desk/games.tsx:337-558).

**Its settings aren't on this page** (audit M4). The detour:

6. **Open {game}**, "As its couch sees it, read-only" (:60-109) → the season's Games tab in the player app, read-only (:75, :83): not the game itself.
7. The game's card → its page. 8. Its ⋯. 9. **How it plays** (show/game-page.tsx:373): its rules in words. Its real settings, Manage this game, show only for its Commissioner or Helper (:369-372), so they're out of reach.
10. Back two or three times to the admin game page (leaving the show ends read-only, read-only.tsx:18).

Archive:

11. Scroll to the page's foot (it's 1.5 screens; Delete starts the second): **Delete {game}** (desk/games.tsx:505-507) → hold **sheet** "Delete {game}?".
12. **Archive it instead** (:520), the only Archive in admin. Toast with Undo.

**7 taps without the settings, about 13 with the detour, and its settings themselves: not reachable.**

- No Unarchive anywhere (audit M7). You archive by tapping a red Delete.
- **Words:** "trophy shelf"; the page says "Find › Games finds the game by it" (:494-495) when Find's own search does too.

### T8. Add a new show and get its season ready

1. Your picture. 2. Site admin. 3. Find.
4. **Library** in Browse (desk/desk.tsx:419-434).
5. **New show**, the yellow bar fixed to the Library's foot (desk/library.tsx:65-70). It's the only door, apart from an existing show's "Make it a game" link (desk/shows.tsx:388-392). Shows, where you'd look first, has none (audit D148).
6. Type the show's name (desk/new-show.tsx:108-113).
7. Its TV listing (:130-141): the show is added, and "it comes with its schedule".
8. **Ask ChatGPT for me** (:254-260) → **leaves admin** for the player app's "Make it a game" page (:30, 229-237). "Asking…": 2½ to 4 minutes.
9. "Does this look right?" (kind, cast, how it works) → scroll → **Looks right · make it a game** (show/make-game.tsx:435-616, button :613) → back into admin, on the season's rulebook page (:169). The rulebook and the cast are done.
10. Back → the season page (desk/rulebook.tsx:86-87).
11. **Setup** (desk/pages.tsx:272): the schedule from the listing is in its first screen. (Added by name instead: "Find it in the TV listings" or "Set it by hand", desk/setup.tsx:72-88, 2-4 more taps.)
12. Scroll to the second screen: **Made-for games › Make them** (desk/setup.tsx:209-222). The bot writes about 30 suggested games, "a minute or three".
13. Back. 14. **Research and the bot** (desk/pages.tsx:273). 15. **Runs on its own**, switched on (desk/research.tsx:158-166).

**About 15 taps and two waits, over six admin pages and one player-app page.**

- After step 9 you're on an admin page reached from outside admin, so its Back alternates between the rulebook and the season (Worst 1).
- **Words:** "Ask ChatGPT for me" (fixed, even when the bot asks Claude), "Make it a game", "Made-for games", "Research and the bot", "Autopilot", "Runs on its own".

### T9a. Check the research bot is working

**No screen says whether the bot is up** (audit M5). The server can tell (server/ask-bot.ts:228), but asks only when you press Ask it now.

The closest, by door C: 1. the show on Home; 2. ⋯; 3. This season in Admin; 4. **Research and the bot** → the Research page. Its line reads "Asks ChatGPT · N runs this week" (server/desk-research.ts:490: always "ChatGPT", whichever AI asked). 5. Scroll about a screen to **Runs** (desk/research.tsx:246-265) → a run → **sheet** saying "Done in …" or "Failed" (:683-760).

**5 taps, for one season.** By door A it's also 5 (picture, Site admin, a Coming up row, Research and the bot, a run), but only for a season airing this week.

- Settings' "Our bot" section says which AI, not whether it answers (desk/desk.tsx:724-733).
- Otherwise a down bot shows only when Run now fails: "Our bot isn't answering right now" (server/desk-research.ts:568).
- **Partly impossible:** there's no one screen for the whole site.

### T9b. Run research now for an episode

By door C: 1. the show; 2. ⋯; 3. This season in Admin; 4. Research and the bot; 5. **Full results** under "Run now" (desk/research.tsx:118-139) → **sheet** "Full results, now"; 6. the episode (:647-666); 7. **Ask it now** (:673-675).

**7 taps.** By door A: 7 when the season airs this week (picture, Site admin, its Coming up row, …), 9 by Find and the season's name.

- From an episode's page, **Ask our bot** (desk/episode.tsx:268-270), just below its first screen, opens the same sheet.
- **Words:** one action, four names: Run now, Ask our bot, Ask it now, Write trivia now.

### T9c. Settle a season again

**Impossible from a screen.** `POST /api/desk/settle-again` "has no screen of its own" (src/app/api/desk/settle-again/route.ts:5-7). It was run as a fetch in a signed-in desktop browser (audit M1). There's no phone way.

### T9d. Release the catch-up hold

**Impossible from a screen.** The Inbox row "The catch-up is held: N seasons wait · Load the rehearsal's answers (scripts/catch-up-load.js), or release it to ask our bot" links to the Inbox itself (server/desk-inbox.ts:289-292). Releasing is `node scripts/catch-up-load.js release --endpoint=… [--production]`, with a database connection string (scripts/catch-up-load.js:7-14). (audit M2)

Next to it, "the catch-up stopped" opens Setup, where nothing starts it again (server/desk-inbox.ts:293-294; audit M3).

### T10. Change a site setting (sign-up approval, game previews)

1. Your picture. 2. Site admin. 3. **Settings** tab (desk/desk.tsx:87).
4. **Who gets in** (:691-703) or **Game previews** (:704-717). Both are in the first screen. → **sheet**.
5. A choice (:756-765 or :766-780): applied at once, toast with Undo.

**5 taps.**

- **Words:** sign-up approval is "Who gets in" ("You let each one in", "Invites let people in", "Anyone gets in"). "Game previews" means who can try a game before making it, not previewing the app (that's the eye: T14).

### T11. Fix a cast member's photo or name

1. Your picture. 2. Site admin. 3. Find.
4. Type their name. Find matches cast members (server/desk.ts:423) → a "Cast · {season}" row.
5. Tap it → their **page** (desk/castaway.tsx:56-180).
6. **Override** beside Name or Photo (:113-114; desk/parts.tsx:377-391) → **sheet** "Override · name" or "Override · photo" (desk/castaway.tsx:224-300).
7. Type the name, or paste a link to a photo.
8. **Save.** Toast with Undo.

**8 taps.** Door C is also 8: the show, ⋯, This season in Admin, Cast, scroll (the faces start at the foot of the first screen), the person, Override, the field, Save.

- **No photo upload.** It takes a link copied from somewhere else, or "Look on TMDB and TVmaze" fills one (:280-281).
- **Words:** "Override"; "Castaway" (Survivor's word, in Find); "Lock · Answers and commissioners can correct them".

### T12. Edit a rulebook

1. The show. 2. ⋯. 3. This season in Admin.
4. **{season}'s rulebook** (desk/pages.tsx:257-265) → the rulebook **page**. Scroll past "Fits these games" and the switch "Leagues play by it" (desk/rulebook.tsx:201-246; it does nothing while rulebooks are on everywhere, audit D140) to "The rulebook".
5. A part's **Edit** (:267-281) → **sheet**.
6. For a list (segments, ways out, twists, moments): an item → its **sheet** (:763-860).
7. Change it. 8. **Done** (:864-882).
9. **Save** on the bar fixed to the foot, "N unsaved changes" (:392-408).
10. **Fix a mistake** or **The show changed** (and from which episode) (:1404-1425).
11. **Save the fix** or **Save the change** (:1438-1453).

**About 11 taps, up to three sheets deep.**

- By door A instead: Find › Library, then scroll to "In use" in the Library's fourth screen: 1 more tap and three screens of scrolling. Or Find, type the season, its row, its rulebook.
- **Words:** "Leagues play by it"; "N leagues follow it"; "house rulings keep theirs"; "Take it over"; "(step N)".

### T13. Check an episode's results and correct one

1. The show. 2. ⋯. 3. This season in Admin.
4. Scroll a little (the first screen holds only the next episode) → **Episode N** → its **page**.
5. **Hide names** off, unless you've marked it watched. While it's on, "In every game" is only a count (desk/episode.tsx:218-221).
6. A group under "In every game", such as "Voted out" (:513-539) → **sheet** of that group (:696-707).
7. The result → its **sheet** (:587-693).
8. **Correct it** → **sheet** "Correct it" (:710-781).
9. Who it was (a grid of faces), and "What happened".
10. **Correct and accept** (:764-779). Toast with Undo.

**10 taps (9 if names already show), three sheets in a row.** Door A by Find › Shows › show › season › episode: 13.

- **Words:** "In every game · 2 sources agree"; "Correct and accept"; "locked as you decided"; "Holdings check"; "A game doesn't match".

### T14. Preview the app as a player

1. Your picture. 2. Site admin.
3. The **eye** at the top right: no label, and only on the three tab pages (desk/desk.tsx:91; desk/view-as.tsx:40-42) → **sheet** "View as".
4. **Player** (desk/view-as.tsx:44-60) → the app reloads at Home, as a player.

To come back: 1. your picture → "Admin · Viewing as a player: back to you" (:67-92); 2. tap it → reloads into admin; 3. "‹ Home".

**4 taps in, 3 out.**

- **Nothing on screen says you're previewing** (desk/view-as.tsx:9-10). The only sign is that row in your profile sheet. Meanwhile the doors into admin are gone (src/app/(new)/(in)/layout.tsx:34).

### T15. See what changed recently

Site settings only: 1. your picture; 2. Site admin; 3. Settings; 4. scroll to the second screen → **Settings history** (desk/desk.tsx:746-754) → **sheet** (:839-841).

**4 taps, for site settings only.**

- Anything else lives in each page's own History: the latest three, then "All N" (desk/parts.tsx:273-292). That's one thing at a time.
- **There's no list of what changed across the site: impossible on one screen.**

### T16. Get back to the app from admin

- **From Inbox, Find or Settings:** "‹ Home" (desk/desk.tsx:91). 1 tap.
- **From further in:** one Back per level. Inner pages have no tabs and no Home link. An episode reached by Find › Shows › show › season takes 5 Backs. Find's "Recently opened" (desk/desk.tsx:444-453) is the only shortcut.
- **From a page reached from outside admin** (door C, the end of Make it a game, a link): **Back alternates between that page and its parent, and never reaches the tabs or Home** (code: desk/trail.ts:79-96 with nav.tsx:231-241). Worst 1 has the detail.
  - The phone's own back escapes in a browser tab, or in Android's installed app (src/components/phone-back.tsx:14-18).
  - An iPhone home-screen app has no system back (:14).
- **From the engine lab:** "‹ The desk" (lab/lab.tsx:233-234).

---

## Part 2. How long each admin page is on a phone

**Method.** The renders are 780 px wide: device scale 2 (scripts/dev-test/browser.js:63) over a 390 × 844 screen
(scripts/dev-test/story-settings.js:58). Screens tall = the `.full.jpg` height ÷ 2 ÷ 844. A `.full.jpg` exactly 1688 px tall
means the page fits one screen: a whole-page shot is never shorter than the screen. Rows and controls are counted from each
page's `.txt`, and the first screen from each `.jpg`.

**Caveats.** The frames come from a local copy of production plus test rows: lists hold whatever that copy holds, the test
season has 5 aired episodes, and pages grow with real data (noted). The rulebook, a report and a disputed result's page weren't
captured (estimated from the code, marked est.). ⚑ = over 3 screens.

| Page | Screens | Rows / controls | In the first screen | Below the third screen |
| --- | --- | --- | --- | --- |
| Inbox (`/desk`) | 1.91 | 15: Back, the eye, 3 tabs, 4 to-dos, 5 episodes this week, "All 6" (plus 4 count tiles) | tabs, Needs you (4), Coming up and 1½ rows | nothing here; each to-do adds ~100 px (10 to-dos ≈ 2.6 screens, 20 ≈ 3.8 ⚑) |
| Find | 1.00 | 12: search, 6 Browse rows | all | — |
| Find, a word typed | first view only | about 22 results | 3 people, 3 couches, 3 games, a show | not measured |
| Settings | 1.48 | 15: 10 setting rows | Who gets in, Game previews, the 3 Results rows, Autopilot, Which AI | nothing; Rulebooks, The library and Settings history are in screen 2 |
| **Library** ⚑ | **3.97** | 33: 9 starting points, 8 "Proposed" cards that look tappable and only toast (D146), 6 drafts, 8 in use, New show | the intro, about 6 starting points, New show fixed at the foot | **"In use", the 8 rulebooks live seasons play by** (screen 4); Drafts start in screen 3 |
| People | 2.66 | about 32: search, 3 filters, sort, 25 people, 1 Let in, "Show 2 more" | search, filters, about 9 people | nothing; under "Everyone" the one waiting account was row 22 (screen 2). Each "Show 25 more" adds about 2 screens |
| People › Waiting | 1.00 | 8 | all | — |
| Couches | 2.47 | 31: search, 3 filters, sort, 25 couches, "Show 25 more" (73 left) | search, filters, about 10 couches | nothing; the rest behind "Show 25 more" |
| Games | 1.21 | 16: search, 3 filters, sort, 10 games | search, filters, about 9 games | — |
| Shows | 1.30 | 17: search, 2 filters, sort, 12 shows (no New show) | search, filters, about 9 shows | — |
| Reports | 1.00 | 4 (none open) | — | — |
| New show, step 1 | 1.00 | 2 | — | — |
| Engine lab | 1.00 | 6 | all (nothing in admin links to it) | — |
| A person | 1.56 | 12: Act as, Name and email, Password, Signing in, 2 couches, 4 seats, Delete | who, Act as, the three account rows, the first couch and its games | nothing |
| A couch | 1.38 | 10: 4 people, 3 games, Override, Delete | who, People, Games (the "Nobody runs" panel sits under the name when it applies) | nothing; "Who fills in results · Override" is in screen 2 |
| A game | 1.52 | 10: Open, 2 Part of, Copy, 4 seats, Delete (Archive is inside Delete) | Open, Part of, the join code, 3 seats | nothing; Delete and Archive are in screen 2 (lower with more seats) |
| A show | 1.01 | 7 | nearly all | — |
| Research sites | 1.00 | 5 | all | — |
| Art and photos | 1.62 | 7 | the header and card frames, where each came from, the cast photos row | nothing; "Find art and photos again" and the "No art or photos" switch are in screen 2 |
| A season | 1.66 | 14: 2 Part of, 4 Running it, 6 episodes, Delete | the show, its rulebook, Setup, Research and the bot, Cast, Bingo bank, **only the next episode** | nothing here; each aired episode adds ~63 px (13 aired ≈ 2.2 screens; a 30-episode season ≈ 3.5 ⚑) |
| Setup | 1.70 | 10 | Name, Status, the schedule rundown, All 13 episodes, When it airs, Episodes | nothing; TV listing, Who decides results and **Made-for games** are in screen 2 |
| Research | 2.24 | about 17: 6 Run now buttons, Runs on its own, 6 run switches and Change, Add a run | 6 big Run now buttons, Runs on its own, the start of the timeline | nothing; **Runs (the log)** and "Not in the games yet" are in screen 2. With 5 runs logged ≈ 2.5 screens |
| Bingo bank | 1.37 | about 20: 8 episode chips, Write them again, Paste squares, 8 squares | the strip, the bank, its buttons, the first squares | — |
| Cast | 2.33 | about 26: Ask our bot again, Paste it, 3 "Not a tribe", Hold switch, 18 faces | Getting it, Starting tribes, the Hold switch | nothing; **the faces start at the foot of screen 1** |
| An episode, aired, names hidden | 1.77 | 8: Hide names, Make every game match, Paste an answer, Ask our bot, Write trivia now, Bingo, Clear | Hide names, Not in the games yet, In every game (a count), Make every game match | nothing; **Answers (Ask our bot)** starts just below screen 1. With names shown, every result group, disputed result, answer and trivia question is a row (est. about 3 screens on a full episode) |
| An episode, not aired | 1.00 | 3 | all | — |
| A cast member | 1.25 | 9: Part of, 5 Overrides, Lock, Remove | all five Overrides and Lock | — |
| A rulebook (est.) | about 3 ⚑ | about 25: 7 parts with Edit, 3 research rows, 2 switches, Read it, Lock, Save as a starting point | the header, "Fits these games", the dead "Leagues play by it" switch | Timeline, the full History, "Save as a starting point" (est.) |
| A report (est.) | about 1.1 | 6 | the words, Mark done, Act as | — |
| A disputed result's page (est.) | about 1.3 | 5 | its sources; its two decision buttons at about the foot | — |

**Over 3 screens:** the Library (3.97, measured). Likely with real data: a long season's page, a rulebook, a full episode with
names shown, and the Inbox with ten or more to-dos.

**Important things buried:**
- The Library's **"In use"** (screen 4): the only list there of the rulebooks real seasons play by.
- Research's **Runs**: the one place that shows the bot worked or failed, in screen 2, under six big buttons and a seven-step timeline.
- An episode's **Ask our bot**, below its first screen.
- Setup's **Made-for games**, in screen 2.
- A game's **Archive**, inside its Delete, in screen 2.
- Settings' **Settings history**, in screen 2.

---

## Part 3. The worst ten

In plain words, worst first.

1. **Back can trap you.** Open an admin page from outside admin: the show menu's "This season in Admin", the end of adding a show,
   or a link. Its Back then flips between two pages and never reaches the admin tabs or Home.
   - Why: the first page you land on has no page before it, so its Back goes up and *replaces* it with its parent. The parent then
     treats the page you left as the one before it (desk/trail.ts:79-96, nav.tsx:231-241).
   - Pairs that loop: season ↔ show (desk/pages.tsx:248, desk/shows.tsx:322); rulebook ↔ season after Make it a game
     (show/make-game.tsx:169).
   - On an iPhone home-screen app there's no system back to escape (src/components/phone-back.tsx:14).
   - Even when Back works, inner pages have no tabs or Home: 5 Backs from an episode.
   - Evidence: T8, T11-T13 by door C, T16. Read from the code: **check it on a phone first**.
2. **Some jobs have no button at all.**
   - Settling a season again needs a browser-console call (T9c).
   - Releasing the catch-up hold needs a script and a connection string (T9d). Its to-do row tells you to run that script, then
     links back to the to-do list (server/desk-inbox.ts:291).
   - A couch's owner can't be changed from admin, and can't be changed at all once the owner's account is gone (T6).
3. **Deciding a disputed result is a maze.**
   - The to-do row opens the episode, where names are hidden by default, so the disputed results don't show.
   - Turn names on, tap Decide, and a second page asks again in different words ("It happened", "canonical", "league") from the
     episode's own sheet ("Accept", "Reject").
   - Evidence: T2, 7 taps for the first result and 4 for each after it. This is the main job admin still has: the bot settles
     the rest.
4. **The to-do list doesn't put first things first, and Home doesn't tell you it's there.**
   - The count hides in your profile sheet (T1). The list runs in a fixed order by kind; reports come thirteenth (T4).
   - Each row is about 100 px tall, so seven fill the screen and push this week's episodes off it.
   - Three kinds of row lead nowhere (T1).
5. **Doors you can't see.**
   - "New show" is a bar on the Library page, not on Shows (T8).
   - "Preview as a player" is an unlabelled eye on three pages, and nothing tells you you're still previewing (T14).
   - The engine lab has no door at all (D151).
   - The search finds join codes and cast members, but doesn't say so (T7, T11).
6. **Long pages bury the one thing you came for.**
   - The Library is 4 screens, and the rulebooks in use are in the fourth (T12).
   - Research is 2.2+ screens, and its run log (the proof the bot works) is in the second (T9a).
   - The cast faces start at the bottom of the first screen (T11). An episode's Ask our bot is below the first (T9b).
7. **Adding a show takes you out of admin and back.** About 15 taps across six admin pages and the player app's "Make it a
   game" page. There's a 2½ to 4 minute wait, then the schedule, the games and the research switch each sit on a different
   season page. The trip ends on a page whose Back loops (T8; Worst 1).
8. **A game's admin page can't show its settings, and Archive hides inside Delete.**
   - To see its rules you open it read-only in the player app, find it on the Games tab, then ⋯ › How it plays. Its real
     settings are out of reach.
   - Archiving means tapping the red Delete, then "Archive it instead". Nothing unarchives (T7: 7 to 13 taps).
9. **Nothing tells you it's all working.**
   - No screen says whether the research bot is up: you dig into one season's run log (T9a, 5 taps and a scroll).
   - No screen lists what changed across the site: only site settings keep a list, and everything else is one item at a time
     (T15).
10. **Words you have to translate.**
    - Override; Act as, View as, Viewing as, and Game previews (four kinds of "as" and "preview").
    - Autopilot, Runs on its own, Run now, Ask our bot, Ask it now (one bot, five names).
    - Hand them on, and Commissioner when you came to fix an owner; canonical, league, house ruling; Holdings check;
      Made-for games; Its words; Castaway.
    - "Still split" on results that aren't split; "waiting on results" when nobody waits on results.
    - Evidence: T2, T5, T6, T9, T11, T14; audit §3.

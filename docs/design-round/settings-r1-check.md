# Settings, Round 1: the check, the fixes and what's open

> **Status (2026-11-20): Round 1, step 4 of the design process.** One check by two independent reviewers on the built screens
> (frames: `.ui-atlas/stories/settings-r1/after/`, from `scripts/dev-test/story-settings.js --only=^r1-`), one batch of fixes, and
> one confirming look. Nothing here was chased past that (DESIGN-PROCESS.md, "Bounded: no loops").

## The scores

| Reviewer | The check | After the fixes | The bar |
| --- | --- | --- | --- |
| Perception-First Design, `evaluate` | 76 / 100 (L0 84, L1 78, L2 72, L3 68, L4 76) | **82** (L0 86, L1 80, L2 79, L3 78, L4 84); R1–R5 all pass | 80 |
| Impeccable, `critique` | 29 / 40 | **33 / 40** | 32 |

The PFD reviewer put today's screens at about 55.

## What the check found, and the fix

| Finding (both reviewers unless marked) | Fix |
| --- | --- |
| While nothing reaches you the switches were dimmed but still drawn On, and the dimming put their lines under 4.5:1 | They read Off and read-only, at full contrast, each line saying "Chosen · comes once notifications are on" or "Not chosen" (the plan's own words: "the kinds read as off while this phone is"). On a muted show only the quieted switches dim |
| Blocked notifications were a dead end | "Show me how" on the plate and on Notifications' phone row opens Allow notifications, steps for each kind of phone |
| Exceptions: a show and a couch with near names looked the same | Each row leads with the show's art or the couch's faces and says "Show ·" or "Couch ·" |
| Two confirms styled opposite ways (PFD) | One style: the safe choice filled, on the left |
| A mute's end to the minute, wrapping "PM" | A mute ends on the hour; said by distance ("until tomorrow 10 PM", "until Fri, Nov 27") |
| The Mute row inset from the list, with no value | Flush with the list; "Not muted. Muting quiets…" |
| A yellow focus ring on Back when a page opens from a link | A pushed page focuses its heading (ui/page.tsx) |
| The phone's state said three or four times in the first view | The plate's headline is "Notifications are off"; while it shows, the Notifications row says what's chosen; Your account no longer counts phones |
| A couch couldn't show it follows your default (Impeccable) | Its choices start with "My default (…, as set in Your settings)" |
| Rows on different left edges (Impeccable) | Opened choices line up with their row's text; faces and art sit in a 60 px slot |
| Words: the preview's "is up to Episode 5"; "The look"; Back saying "Back"; the bell's "what the couch is up to"; couch rows two ways; lines repeating their label; Sign out's line when the phone's already off | "has watched through Ep 5"; "Classic design"; Back names where it returns; "your couch's activity"; one couch line ("4 people · you run it · chat: …"); the repeats cut; Sign out's line only while this phone is on |

## Open (the confirming look still found these)

1. ~~A bottom sheet's close button gets a focus ring when the sheet opens from a link.~~ **Fixed on the user's word (2026-11-20):**
   the shared sheet (ui/sheet.tsx) focuses itself on open unless the keyboard opened it.
2. **Show art is an empty dark square when a show has none** (the test shows have no art; researched shows often don't either). Impeccable's fix: a plate with the show's initials.
3. **A muted show is "ZT Survivor" on Notifications and its season "ZT Survivor 51" on Your shows** (PFD): a mute covers every season, and the row there is a season. A wording question for Round 2's show page.
4. **Mute's three buttons don't say when each would end** (Impeccable, minor).
5. **Single words wrapping onto their own line** ("hub." on the phone row, "the bell." in the muted row), and the game rows under a show have no chevron (Impeccable, minor).
6. **Unverified in frames:** the Undo toasts (they're in the checks, not the story); the push's own button (a phone draws it, not a page).

## Choices for the user (the rules didn't settle them)

**Decided 2026-11-20: the user took all four picks** (decisions.md): Off on both; Not now as it is; "Until the next episode" in
Round 2; quiet rows. Built the same day.

1. **A quieted switch: drawn Off, or On and dimmed?** PFD wants the muted show's quieted kinds drawn Off, like Notifications' while nothing reaches you ("the knob is what people predict from"). Impeccable says Off beside "Chosen" says two things at once, and would put a static "Chosen" tag where the switch is, or keep it On and dimmed. Built: Off on Notifications (the plan's words), On-and-dimmed on a muted show.
2. **What Not now on the plate does.** Today (Settings D): gone for good on this phone, and Notifications still says Off. Or: back after some days, which serves Joanna but nags Andrew.
3. **Mute by the clock or by the show.** Built: for a day, a week, or until I turn it back on. Or: "through tonight's episode", "until the next one airs" (closer to why people mute; needs air dates, which every show has).
4. **How much character below the identity.** Built: quiet Operate rows, the house look in the plate and the headings. Or: your name on a caption plate with your couch as its chyron (more soul; blurs "a white plate means something's wrong").

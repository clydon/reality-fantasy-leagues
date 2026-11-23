# League art: the check (PFD evaluate, Impeccable critique, one batch of fixes)

Built from [league-art-spec.md](league-art-spec.md) and [league-art-first-view.md](league-art-first-view.md) in the lane `league-art`
(2026-11-23). Frames: `.ui-atlas/stories/league-art/{before,after}` (`story-hub-sports.js`, worlds many, one, hidden, studio, solo).

## What was checked

- **PFD evaluate** (the first-view requirements against the renders): R1, R4 and R5 held. R2 failed: the night photos under the
  band's fade read as a plain dark card (the sport didn't say itself). R3 failed in one place: the ruler hid its last week whenever
  the couch's teams stood near the end, so "12" had no "of 18".
- **Impeccable critique, dual-agent** (A: design review; B: the detector, the overlay in a live page, and measurements). A scored
  **28/40** (Good, low edge). B: the detector clean of anything but advisories; every text over the art 5.6:1 or better (ruler ends
  at white/55 the tightest; the name 19:1, the line 10:1), the gear 44 x 44, no sideways scroll at 390 or 320; **the band's focus
  ring was invisible** (an inset shadow paints under the art in the band's own stacking context); the art's median luminance behind
  the fade about 0.005.

## Fixed, in one batch

| Finding | Fix |
| --- | --- |
| The art barely reads (PFD R2; A's P1; B's luminance) | Band crops re-made by `scripts/league-art-derive.js`: football's strip moved down to the stands and turf (out of the sky), both lifted (brightness 1.6 to 1.7, gamma 1.25 to 1.3). The bar's fade lighter at the top (.3, .55 at 45%, .92 at the foot, where the words are). The band keeps the show band's fade exactly (R3). |
| Two leagues in Arena look alike (A) | A shared art has windows; each league takes one by its name (`league-art.ts` `windowOf`), the same every time. |
| Your own team could fall into "+N" (A's P1) | The four places go to your teams first, then the couch's others, then the four by name; "+N" counts the rest. |
| The ruler's end number hid (PFD R3; A's P2) | Only now's number can meet an end's (the teams stand above the line, the numbers under it): the ends hide by that, measured in the number's width. |
| A daily sport's ruler in dates under a title in weeks (A) | Weeks wherever the title says one: `LeagueNow.regular.weeks` counts the regular season's weeks as `week` does ("Week 6" of 25); a league with no weeks (soccer) still by the date, with nothing under the teams. The stand-in basketball calendar now lists a whole season of game days, as ESPN's does (it said "6 of 7"). |
| No focus ring on a band (B) | An outline, inside the edge (it paints over the art). |
| Radios that arrow keys don't move (A, B) | Each choice a toggle button (`aria-pressed`), named "Under the lights, in use". |
| Choices didn't look like their result (A) | Each choice is your own band in that art, full size, stacked; the one in use ringed with the quiet In use tag. PFD's R5 met literally (you choose by seeing the band). |
| Undo saved the default as a choice (A) | Undo puts back exactly what was set, none included, so a league never chosen keeps taking its sport's first (a new photo included). |
| "On this page" was unclear (A) | "On your NFL band in Your shows and at the top of the league's page. Only you see it." |
| Following 2 px from the gear (A) | 8 px between them. |
| `many-league` in the story waited for the old league sheet | Waits for the league's page (B1 made it one). |

## Kept, with why

- **The gear on a league with one art** (every sport but football, for now) opens a page with one choice. A suggested hiding the gear
  until a second art exists; the user chose the gear and photos only knowing that, and the page says so in words ("Arena is the one
  art for baseball so far"). A named choice in the story.
- **12 px ruler numbers** (the detector's advisory): the show band's own.
- **The teams at now on the ruler** (A's question, "what does it say that a row wouldn't?"): parity with the show band's faces, which
  the user asked for in "the same static height as shows"; the ruler itself is the season's progress.

## Noticed, not this round's (pre-existing)

- **The show band on Studio:** its due dot is Studio's dark amber on its dark plate (it lacks the band's `dark`), and it has no spoken
  sentence (it reads "1 | 13 | Z | Z | +1"). The league band has both. Small; anyone.
- **PushedPage** (every settings page): focus can leave it for the page under it, and its h3 follows the page's h1. Shared component.
- **check-sports-couch.js "its Chat tab…"** fails on master too (PLAN-team-logos.md, "Noticed, not fixed").

## After the user's review (2026-11-23): the couch's art and your own picture

The user: "I actually want per user but me as the admin can set it for everyone. Or a simple 'if no one has set the background it
takes the first existing in the couch'. Whichever is easiest… End goal is everyone in my couch sees art without action on their
end, if they want to change it they can." And: "'Uploading your own picture': bypass this guardrail for now and implement it."

- **Both, in one rule** (league-art.ts `artInUse`): yours, else the couch's (its owner's choice, else the first member's to
  choose, by when they joined), else the league's own. One query works out the couch's pick (league-art.ts on the server).
- **The settings page** names whose pick you're seeing ("zt_nd_alex's pick for the couch") and, for the person the couch follows,
  says "Everyone on ZT Survivor 51 who hasn't chosen sees yours too". Someone who chose one of the app's photos can go back to the
  couch's ("Use the couch's").
- **Your own picture:** a section of its own under the choices (Upload a picture, Replace your picture, Remove it, which asks
  first since Undo can't bring a picture back). It's cut to 16:9 from the middle in the browser; the server checks its bytes and
  size. The takedown and safety steps are skipped, by the user's call (PLAN-team-logos.md, "An exception").
- Not re-run through the three skills: a change to who sees which art and one new section in the established page, built in the
  page's own parts (the stacked bands, PageSection, Btn, the inline ask).

## Checks after the batch

`tests/league-art.test.js` (17 with league-now's), `npm test` 2,640 pass after the couch and upload change (2,634 after the batch); `check-league-art.js` 13 pass, tsc clean, ESLint clean on the app files.
Story: https://claude.ai/artifact/9r85M529majKLKSBUKZHTk.
`check-sports-couch.js --browser`: 32 pass, the Chat tab's one fail as on master; its new league-art steps (126 px in and out of
season, football's photo, the ruler at 12, Arena off-season, the bar's art, the gear's page, Arena tapped and saved, a baseball
league refused football's photo) all pass. `story-hub-sports.js`: every frame passes, no overlaps but the guide's (as before).

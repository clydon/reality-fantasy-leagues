# The design round's packet

Prepared 2026-11-14 for the game UI/UX overhaul. It merges three lists into one, ranked and grouped by the page each item lands on:
the explorer plan's [Designs needed](PLAN-GAMEPLAY-SCENARIO-EXPLORER.md) (39 items, "DN" below), the backlog's UI items
([BACKLOG.md](BACKLOG.md), "B"), and the overhaul index and ideas in [UX-IDEAS.md](UX-IDEAS.md). Nothing here is designed or
approved. The round follows the [fresh-start brief](APP-REVIEW-DESIGN-BRIEF.md): one page with its situation variants, through
impeccable (shape, then critique) at 390 px first, then a pause for your review before anything else is redesigned.

**Evidence.** Each item names where it was seen:
- screenshots and recorded page words are in `.ui-atlas/explorer-page/` (local, not in git): `05h-h2h-week.png`, or
  `sports-page.json` for the words the page showed;
- each capability's section of [GAMEPLAY-EXPLORER.md](GAMEPLAY-EXPLORER.md) says how it was found;
- "specimens" is how many of the matrix's 1,312 generated show games use the mechanic (`.ui-atlas/gameplay-matrix.json`). It
  measures breadth across possible games, not how often real couches play them.

**How it's ranked.** Pages by how much of the list lands on them. Within a page, in this order:
1. your stated priority;
2. something wrong on screen today (a false fact, or a control that can't be reached while the rule is on);
3. what a default game meets (the app's own Weekly Lineup, the sports defaults);
4. breadth (specimens);
5. words-only fixes, which can ship any time because the overhaul keeps them.

---

## Decisions you owe (before or at the start of the round)

1. **The first page: the game page, or Tonight?** The brief's default pilot is Tonight. **I recommend the game page** (a
   generated game's own page with its sheets):
   - 36 of the 39 explorer findings land on it, and so do your priority (head to head, B46/DN 3) and every sports finding;
   - Tonight's components are mid-review (no choice from the [data round 3](show-soul-review/tonight-data-round3-2026-11-12.md)
     is recorded yet), and Tonight's game section is a summary of this page, so it's better designed after it;
   - the bench can already drive this page on the real routes for shows and sports (part 4 below).

   Tonight second, composing the chosen round 3 components with the game page's new mini.
2. **The pilot game for that page.** I recommend head to head on a Weekly Lineup, with its sports twin:
   - Survivor: draft 3, start 2, head to head with a two-seat playoff;
   - its sports twin: the NFL's own season game (head to head, a weekly lock, a lineup of nine).

   Why: head to head is your priority, the most common ranking among generated games (146 specimens), and it carries the most
   states (this week's opponent, a record, quiet nights, playoffs, a champion). The other families (points totals, pools,
   questions, Outlast, categories, fields) are variants to check the design against, not separate designs.
3. **Round 3's lineup component, chosen or not?** The game page's week reuses one of: A (expandable ledger), B (contribution
   comparison on a shared scale) or C (lineup matrix and trend). Choose one, or let the round propose fresh with all three as
   references.
4. **Side bets in the new app (DN 1).** Weekly Lineup has them on by default and the new app lets players guess, but not post or
   settle. Is posting and settling part of this round (it lives on the game page's week and in Backstage), or deferred?
5. **Rule questions that change what a screen says.** Each is waiting on you already:
   - B54: group slots on a finale played in pairs are void unless research says the pairs split;
   - B58: a waiver window opened by hand about a day ahead runs within minutes;
   - B62: an Outlast stage that starts mid-season starts everyone on points;
   - DN 32: a waiver window turned off can't be opened again for that episode. A rule to change, or a state to say?
6. **B81 (new today): fix it now?** A slate week whose first game is postponed still locks at that game's start. It's a small
   engine fix, and nothing scores wrong.

---

## 1. The game page (and its sheets): 36 of 39 findings

The page: `src/new/show/game-page/`, its model `game-page/model.ts` and `game-view.ts`, and the sheets in `game-sheets.tsx` and
`lineup-sheet.tsx`. The brief keeps its season grid, graphs and data layout as a strong reference ("the user likes them").

### 1a. Head to head (your priority)

| # | What | Evidence |
| --- | --- | --- |
| 1 | **Who you play this week.** `matchups.next` is in every game view and read nowhere, on a show or a sport. | DN 3, B46. `05h-h2h-week.png`. NFL: `sports-locks-page.json`, `05zzl`. 146 specimens. |
| 2 | **The playoffs.** No bracket, no champion named. The losing finalist is marked OUT like those who missed the playoffs. The final's square is unmarked in the grid. A champion with a worse record is ranked above a better one with no reason shown. | DN 3, B46. `05i-h2h-final.png`. |
| 3 | **A quiet night.** It's counted for nobody and shown as unexplained dashes. A cancelled sports game now gives the same quiet night (today's slice). Under weeks won, a shared week's half point looks like a whole win. | DN 3, DN 39. `05j-weeks.png`. 98 specimens of weeks won. |
| 4 | **Categories head to head.** No category's values or which ones a week was won on (the record shows since B77's fix). Roto's season grid shows 0 every week (roto has no weeks). A seat at its own pace has no record and isn't told why. | DN 35. `05zzo` to `05zzq`, `sports-categories-page.json`. |

### 1b. Wrong on screen today, or a control that can't be reached

| # | What | Evidence |
| --- | --- | --- |
| 5 | **A captain can't be named.** "Captain scores double" is on the page, but nothing in the new app sends `captainId`. | DN 24. `05zn`, `05zo`, `captain-page.json`. 24 specimens. |
| 6 | **A pool's second pick can't be made.** The sheet takes one pick. | DN 27. `05zu`, `05zv`. 5 specimens. |
| 7 | **A group slot can't be filled.** Nothing sends the route's PUT. | DN 28. `05zw`, `05zx`. 17 specimens. |
| 8 | **Someone knocked out is still asked for a lineup**, and the server refuses it. The out state itself is undesigned. Design it with #19. | DN 10, B47. `05r-cut.png`, `cut-page.json`. 54 specimens of cuts, 63 of races. |
| 9 | **Outlast in reverse says "Fewest points wins"**, and its week reads a running value as points scored. | DN 22, B51. `05zi`. 31 specimens. |
| 10 | **Hits counted once each don't add up** to the standings on the grid and the week. | B49. 109 specimens of hits. |
| 11 | **A pool's skipped night reads "No pick · missed".** | DN 29, B55. `05zy`. 11 specimens. |
| 12 | **The weekly card calls itself a Survival Pool** ("Who survives… Streak 1"), and names no card. | DN 20. `05zf`, `05zg`. 74 specimens. |
| 13 | **Weekly Calls' How it plays tells a talk show's rule** on a show whose results settle it. | DN 18. `05zc`, `05zd`. 11 specimens. |
| 14 | **A sport's game in a show's words**: "contestant", "episode", "Airtime", "castaways", "All safe · 3 of 3 still in", and its table as stat keys ("2 a 2PT, -1 an INT"). | B75, DN 34. `sports-page.json` and every sports word file. |
| 15 | **"Spoiler protection is off" on every sports page**, for someone who turned nothing off. | DN 34. `sports-page.json`. |
| 16 | **The reveal doesn't open over a game's own page.** | B66. |

### 1c. The week and the season grid: where points came from

| # | What | Evidence |
| --- | --- | --- |
| 17 | **Multipliers**: which episodes count extra, the squares that did, and lines at their own points with the factor shown once. | DN 15. `05x`, `05y`. 45 specimens. |
| 18 | **Bounties**: who took what from whom; the grid's squares don't add up to the total. | DN 12. `05u`. 57 specimens. |
| 19 | **Whole-game and season-long answers once settled**: where they live through the season and at its end (the person sheet says "Nothing was asked that episode"). | DN 2, DN 17. `05e`, `05f`, `05g`, `05za`, `05zb`. 152 specimens asked once. |
| 20 | **Parlays**: each leg saying it's one; a paid parlay marked. | DN 14. `05w`. 51 specimens. |
| 21 | **A survival pool's mulligans and buyback**: a forgiven pick, a bought-back night and its cost, what's left. | DN 26. `05zs`, `05zt`. 8 specimens of buybacks, 6 of mulligans. |
| 22 | **Beat the bot**: the bot's call beside each settled answer, and the couch against the bot. | DN 21. `05zh`. 75 specimens. |
| 23 | **The top scorer's twist**: who chose it, and the doubled week marked. | DN 23. `05zj` to `05zm`. 35 specimens. |
| 24 | **An auction**: what each castaway cost and what's left of the budget. | DN 30. `05zz`. 12 specimens. |
| 25 | **Teams of players**: each team's points and place, and when a late joiner joins one. | DN 13. `05v`. 49 specimens. |

### 1d. Sports on the game page (the defaults every sports couch meets)

| # | What | Evidence |
| --- | --- | --- |
| 26 | **An athlete's line**: what they did, what each stat paid at this table, their position and opponent on the lineup tile. "Your sheet" has no week by week. | DN 34, B74's rest, B43. `05zzi` to `05zzk`. |
| 27 | **A week of several games**: when each of your players plays, against whom, done or to come, and each game's points for whoever was in the lineup then. | DN 38, B80 (TEMP-UI). `05zzz` to `05zzz3`, `sports-slate-page.json`. |
| 28 | **A field's places**: "T14", "2nd", "Missed the cut", and F1's three places a weekend. The natural view is a leaderboard. | DN 36. `05zzr` to `05zzt`, `sports-places-page.json`. |
| 29 | **A card's matches**: who a player played, the score in sets, best of five, a retirement. | DN 37. `05zzx`, `05zzy`, `sports-tennis-page.json`. |
| 30 | **A game called off, and a week in progress** (today): "Postponed · free to move" on the tile, and "2 of 3 games final · counts when Thursday's is in". | DN 39. `check-sports-explorer.js --case=calledoff`. |
| 31 | **A lock by the week or the day**: when it fell, when the next lineup opens. A locked lineup can't be opened to look at. | DN 34. `05zzl` to `05zzn`. |

### 1e. Rules and words in How it works, and the sheets (small; can ship any time)

| # | What | Evidence |
| --- | --- | --- |
| 32 | What scores, when only some moments count or hits are counted. | DN 4. `05k`, `only-hits-how-it-works.json`. 109 specimens. |
| 33 | Shared points' worth ("4 points, split between everyone right"). | DN 6. `05m`, `05n`. 117 specimens. |
| 34 | Stakes: quick amounts for big banks. | DN 8. `05p`. 79 specimens. |
| 35 | Rollovers' total, and confidence picks' worth. | DN 16, DN 19. `05z`, `05ze`. 43 specimens of rollovers. |
| 36 | Settled by the couch: the rider's words. | DN 9. 25 specimens. |
| 37 | Phases' names ("From merged") and a first week with no last week. | DN 11. `05s`, `05t`. |
| 38 | A drawn game's chip ("Order drawn"), and a draft spread across tribes. | DN 7, DN 25. `05o`, `05zr`. |
| 39 | Co-op's lives left beside the rule. | DN 5. `05l`, `coop-page.json`. 48 specimens. |

### 1f. A game in stages (one page reading several leagues)

| # | What | Evidence |
| --- | --- | --- |
| 40 | The game's page says "All set" while a stage has a move due; the overall is one number; a stage waiting for the merge invites a draft that can't open; the next stage's draft mid-season; words. | DN 33, UX-IDEAS ("A game in stages carries its stages' moves", "The next stage's draft announces itself"). `05zzc` to `05zzi`, `stages-page.json`. 32 specimens. |

## 2. Tonight, the dock and Your moves

| # | What | Evidence |
| --- | --- | --- |
| 41 | This week's head-to-head opponent on Tonight. | DN 3. |
| 42 | A replacement you're still owed, while free agency is open. | DN 31. `05zz2`, `05zz3`. |
| 43 | The own-pace plate leads with what's safe, not what you've missed. | UX-IDEAS ("Tonight says the game is waiting for you"). |
| 44 | The waivers result offers the new one the empty slot. | UX-IDEAS, B69. |
| 45 | No way from the dock or Your moves to a game's page. | B40. |
| 46 | "You're all set" confirmation. | B3. |

Tonight's own composition (identity, viewing progress, friends, recap, game updates, the top strip) is the data round 3's (no choice
recorded yet).

## 3. Waivers and Backstage

| # | What | Evidence |
| --- | --- | --- |
| 47 | A held week after Undo still gives its old time. | DN 32, B59. `05zza`. |
| 48 | A window turned off, how long people get, a game with none. | DN 32, B58 (a question). `05zz4` to `05zzb`. |
| 49 | The lock row's three states after airtime. | UX-IDEAS ("The lock row says who it's open for"). |
| 50 | Side bets: where one is posted, where the commissioner settles it. | DN 1 (decision 4 above). `05c`, `05d`. Weekly Lineup's default. |

## 4. Start a game (the wizard: its own redesign, "another time")

| # | What | Evidence |
| --- | --- | --- |
| 51 | The whole flow: when before what, silent changes, settings above their subject, the rail, about fifty controls. | UX-IDEAS "Start a game, redone" (first-hand, 2026-11-14), B42. |
| 52 | Own pace says where it will wait (a draft with turns, exclusive waivers). | UX-IDEAS. |
| 53 | A game in stages can't start from here, and so has no own pace. | DN 33. |

## 5. App-wide (do once, on the new screens)

| # | What | Evidence |
| --- | --- | --- |
| 54 | The phone's back closes an open sheet. | B12. |
| 55 | Optional buttons' faint edge and 40 px height; the welcome page's faint "Nothing on". | B34, B35. |
| 56 | What's New has no place; the tour follows the screens it teaches. | B22, B38. |
| 57 | One leaderboard across linked games. | B4. |

---

## The recommended first page, and what its redesign must show

**The game page, piloted on head to head**, shows first and its NFL twin beside it. The fresh-start brief's variants for it, and
whether the bench produces each today, are in [docs/GAME-PAGE-SITUATIONS.md](GAME-PAGE-SITUATIONS.md) (part 4: each situation
opened in one click from the explorer page's Open menu, with what's still a gap).

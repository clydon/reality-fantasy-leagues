# Own-pace UI screenshot inventory — 2026-11-10

The current local implementation, captured for reviewing the experience of watching at your own pace, whether a season is still airing or finished. Product screens were not changed.

Open `captures/own-pace-2026-11-10/index.html` in a browser, or serve it locally:

```powershell
node scripts/dev-test/serve-captures.js captures/own-pace-2026-11-10
```

The gallery is then at http://127.0.0.1:4300. Filter by scenario group; click a screenshot for its original resolution. Supplementary captures also have full-page images and text snapshots. `manifest.json` records titles, context, URLs and viewport dimensions. Screenshot artifacts stay in the gitignored `captures/` directory.

| Group | Screens | Coverage |
| --- | ---: | --- |
| `watching` | 13 | No game: not started, mid-season, finished, confirming an episode watched, spoiler controls, private progress, friends' progress, asking friends to watch, watch along, episodes, folded chat, and behind/caught up on a still-airing season. |
| `solo-and-sync` | 11 | One human with no bots; a friend joining; both on the same episode; waiting for a draft to start; active draft entry and both seats in the room; lineup editing and saved lineup; starting earlier on a still-airing season. |
| `finished-season` | 16 | Games at your episode, start wizard, pick due, reveal without a pick, pick saved, warning about moving ahead, reveal result, behind a friend, join at your own episode, finish while someone is behind, shared team selection, draft checkpoint, waiver wait and open waivers. Includes a second wizard screenshot. |
| `finished-extra` | 9 | Multiplayer game page and player detail from the behind player's perspective, episode list, chat, next episode, where everyone is, bingo, calls and the pick editor. |
| `live` | 7 | Commissioner's per-game own-pace setting; the late player's Tonight and Games; an opponent's waiting matchup and episode detail; the saved-late marker and its explanation. |
| `live-boundaries` | 4 | Before airtime, aired with results still missing, more than one episode behind, and after the next airtime. JSON snapshots accompany these screens. |
| **Total** | **60** | **390 × 844 CSS pixel mobile baseline, at 2× device scale.** |

The multiplayer captures use fixture users (`zt_nd_alex`, `zt_nd_riley`, `zt_nd_jordan`, `zt_nd_sam`), with computer players only where identified. No real account or league was used. Completed-season games use the local Survivor 49 season's existing cast/results; the watching-only and live boundary scenarios use fixture seasons. The shared couch's fixture name remains “ZT Survivor 51” even when its game is on Survivor 49.

## Capture and verification

```powershell
node scripts/dev-test/capture-own-pace.js captures/own-pace-2026-11-10 --season=1825d8a7-2da2-4cda-855a-83730c9a8140
```

Needs the existing local dev server on port 3000, local Postgres, and the Playwright/Chromium installation found by `scripts/dev-test/browser.js`. The season ID above is local to this checkout; select a completed season with accepted results on another database.

The capture script reuses `check-own-pace-live.js` and `check-own-pace.js`, then captures additional scenarios. It refreshes and removes `new-fixture.js`'s fixture accounts, couches and leagues, so do not run it alongside another check using that fixture. Existing fixture helpers may seed a missing completed season's bingo bank with a stand-in bot; they do not call a real AI service. `--reuse-live`, `--reuse-checks`, `--extended-only` and `--gallery-only` are documented in the script header.

Both existing own-pace checks completed successfully during this work. A repeat of the live check hit its transient toast-text assertion while its setting, behavior checks and seven screenshots succeeded; the successful live captures were reused for the final inventory. The completed-season check was updated to accept the current shared wizard as well as the legacy start sheet. The final supplementary runs captured every requested scenario in the runner with zero capture failures. All 60 manifest image paths exist; none of the supplementary pages had document-level horizontal overflow. Fixture accounts were removed after capture.

The changed JavaScript passes targeted ESLint with `@typescript-eslint/no-require-imports` disabled for the check, matching these existing CommonJS development scripts. No full application build or broad unit-test run was needed for screenshot tooling.

## Review limits

- This is an inventory of interaction states, not every combination of game spec, episode, ownership mode and number of people. Trivia/question-game variants, co-op settlement, every bingo outcome, and every waiver interaction have not each been photographed.
- Phone portrait and the current theme only; desktop, alternate themes and other phone widths are not covered.
- Some local Survivor 49 artwork and contestant photo URLs fail to load. Those placeholders are visible in the captures; they are not evidence about production asset availability.
- The Next.js development indicator is visible in some captures. Nothing was hidden or restyled to improve the screenshots.
- Screenshots record what the UI says. Boundary snapshots are not a new proof of all deadline rules; the existing live check separately verifies that moves are refused once watched or when the setting is turned off.
- A screenshot does not establish spoiler safety by itself. The inventory includes folded chat and guarded player/episode views for inspection; a broader spoiler audit remains separate work.

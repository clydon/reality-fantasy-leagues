# Review decisions

## 2026-11-10 · The compact composition needs a new visual pass

- Decided by: user.
- Why: the first proposal stripped too much soul and character. Artwork, bold graphics and social pleasure are part of the app's value. They may also be reimagined; preserving the old appearance exactly is not required.
- Supersedes: treating the compact row-based study as the proposed final visual direction, or treating whole-page viewport fit as a goal.
- Preserves: the established navigation, consistent action eligibility, spoiler boundaries, clear deadlines and rich detailed tools.
- Next evidence: [revised study brief](../show-soul-review/brief.md), [PFD requirements](../show-soul-review/perception-first.md) and the local review board at http://127.0.0.1:4302.

Three parallel reviews for visual character, watching/social behavior, and expert depth/sports completed for the revised study. That supersedes the earlier worker-availability limitation for this new pass; it does not retroactively make the original broader review independently assessed.

## 2026-11-10 · Simplicity and first-view clarity apply to the entire show experience
- Decided by: user.
- Why: real users describe the app as overwhelming and confusing; the desired experience combines high information at a glance with detailed drill-down screens.
- Rejected: limiting the critique to own-pace catching up, indiscriminately shrinking UI, or removing capabilities to make a screenshot cleaner.
- Rests on: the conversation and the updated [Product principles](../../PRODUCT.md).

## 2026-11-10 · Keep the existing hierarchy and visual identity in the mock
- Decided by: user defined the hierarchy; Codex selected an in-system composition study.
- Why: hub → show → Tonight, Episodes, Games, Players/stats and Chat is already established. The main opportunity is the distribution of information and actions between overview and detail.
- Rejected: replacing the five tabs, introducing a new visual brand, or using image-generated screenshots of controls instead of a clickable code prototype.
- Rests on: the conversation, [DESIGN.md](../../DESIGN.md), and the Impeccable Operate guidance.

## 2026-11-10 · Use local artwork and fixture accounts for representative captures
- Decided by: Codex.
- Why: existing `public/mock/showcase/art/` and cast-photo files load successfully and the saved production backup includes artwork metadata. A new production database restore is not needed to make the UI representative.
- Rejected: overwriting the local database, importing production identities into screenshots, or treating old broken remote artwork as a product layout problem.
- Rests on: `backups/prod-2026-10-30/shows.json`, `public/mock/showcase/`, and 14 current captures with zero failed images in the capture manifest.

No fresh Neon production snapshot was downloaded or restored. No configured production database connection or Vercel CLI authentication was found in the inspected local settings. Current captures use the app's real rendering, fixture show/couch rows and local art; the concept uses illustrative show/state data and simulated local interactions. It does not execute real game mutations, search external services or implement the full game engine. Some secondary filters and long workflows demonstrate their destination rather than a complete implementation.

## 2026-11-10 · A 390 × 844 viewport is the first composition check
- Decided by: Codex default, based on the standing 390px phone-first direction.
- Why: it supports a concrete comparison with the existing capture set and a testable first-view requirement.
- Rejected: asserting that every possible number of games or messages must fit without any scrolling, or cutting touch targets below 44px to fit more material.
- Rests on: the user's latest brief and [concept browser checks](../../scripts/dev-test/check-show-overview-mock.js).

Representative hub and non-chat overviews fit in one 844px-tall viewport in both appearances. Main actions were checked for being inside the viewport and unobscured at their centers. Chat history intentionally scrolls while its composer remains fixed. Smaller screens, browser toolbars, safe areas, large text, keyboard behavior and unusually many tasks require further validation. More than a short action list needs an explicit counted all-actions route.

## 2026-11-10 · Complete the broader review directly when independent reviewers are unavailable
- Decided by: Codex default to continue the authorized task.
- Why: both critique agents and the capture agent hit account usage limits; the user explicitly said to continue.
- Rejected: silently labeling the broader work a completed independent dual-agent assessment, or abandoning the mockups while waiting for workers.
- Rests on: agent failure messages and the user's continuation instruction.

The earlier own-pace review completed independent assessments. This broader review is a single-context continuation. Before failing, the evidence worker produced `captures/show-overview-2026-11-10/detector.json`: 56 font-size advisories and one bounce-easing advisory across nine source files. They do not establish 57 distinct usability defects. No fresh app-DOM detector overlay is claimed. The human-visible evidence is the current screenshots, saved control locations, source inspection and functioning prototype. No participant usability study, assistive-technology audit or production performance test was conducted.

The finished prototype's one mechanical scan returned four radius findings whose snippets incorrectly include surrounding JavaScript/HTML text (the actual inline values are the established 3px/4px radii), plus a colored-side-border advisory on the existing game's color marker. The marker preserves the established game-color convention. No broader claims of accessibility compliance are inferred from that detector. Browser checks passed both themes, all six primary views, first-view action placement, no horizontal overflow, loaded art, pick saving, lineup selection, one-episode reveal progression, game setup's checkpoint explanation, player search/detail and local chat. The final own-pace game/team branch was separately checked to avoid showing an unsubmitted or future replacement claim.

Questions skipped: the user supplied the product goal, navigation boundary, permission to suggest programmatic changes and desire for visual mockups. The concept is available for concrete review before any product implementation decision.

The comparison server is intentionally left available at http://127.0.0.1:4301 for the requested visual review. It serves only the ignored capture directory, read-only on loopback. The app's product screens and database schema were not changed. Fixture users and shows are cleaned up after capture verification; the screenshots and prototype remain.

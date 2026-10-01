# Backlog

User feedback triage (2026-10-01). Companions worth doing together: #2+#11, #7+#15, #8+#18, #24+#26+#28.
Check existing `docs/PLAN-*.md` before designing — e.g. #4 and #22 overlap `PLAN-spoiler-free-catch-up.md`.

## Bugs
1. ~~DONE~~ My Leagues dropdown still flashes unsorted — sort at fetch time (add a sort param if needed), not after render.
2. ~~DONE~~ Desktop sidebar: league name + type/commissioner row overflow, horizontal scroll.
3. ~~DONE~~ Clicking outside the expanded My Leagues menu doesn't close it.
4. ~~DONE~~ Catch-up league (S49 Active Roster, 13 episodes) offers "reveal episode 14" after Sole Survivor is decided — season is over.
5. ~~DONE~~ Draft: order is set, but the user section below isn't sorted to match.
6. ~~DONE~~ Active Roster → Draft shows fewer players than drafted — always show original picks.
7. ~~DONE~~ Research: episodes before league start aren't tracked (episode 1 stats missing).
8. ~~DONE~~ Dark mode selector cut off on mobile.
9. ~~DONE~~ Active Roster → Scoreboard → Roster detail: cluttered everywhere, text escapes cards on desktop (demo season). Rethink, mobile first.
10. Members joining a started league just appear in standings — no defined path after "activate" (see #31).

## Quick tweaks
11. ~~DONE~~ Widen the sidebar slightly (with #2).
12. ~~DONE~~ Remove the post-merge checkbox — episode data retrieval determines it.
13. ~~DONE~~ Episodes page: all episodes collapsed by default.
14. ~~DONE~~ Rename "bets" → "predictions" everywhere.
15. ~~DONE~~ Research: "Hide eliminated" off by default; "Include own castaways" on by default.
16. ~~DONE~~ Color picker: accept hex input (to sync colors across leagues).

## Design / copy decisions
17. Dark palette too dark — lighter pass; add dark-mode logo variant.
18. Desktop: move dark mode selector to Account Settings (mobile keeps its spot, fix #8).
19. Wiki Connector section in League Settings confusing for non-commissioners, possibly obsolete — simplify, hide, or cut.

## Features (brainstorm first)
20. ~~DONE~~ End-of-season results card on Overview, winner callout with confetti popping out of the card.
21. ~~DONE~~ Active Roster episode sub-header: top 3 users that episode with gold/silver/bronze numbered circles + points.
22. Spoiler protection: pause results/scores, designed so it can't hide results longer than intended.
23. Account Settings: "test" button per notification toggle.
24. ~~DONE~~ Redesign "Your lineup for episode X": Active section with dashed-outline empty slots, separator, roster below sorted by current tribe with tribe badge centered above each photo.
25. ~~DONE~~ New scoring option: "No Final Tribal Council votes" (goat penalty for a finalist in your starting lineup).
26. ~~DONE~~ Collapsed-by-default condensed scoring chart inside "Your lineup for episode X".
27. ~~DONE~~ App-wide bold action-needed bar: elimination pick, incomplete lineup, pending prediction, draft turn, mid-season turn. One at a time with `<` / `>`, each links to the right league/page.
28. ~~DONE~~ (Partly exists: ActiveRosterLogic.lineupFor already carries the last set lineup forward -- verify the eliminated-starter case.) Starters carry over week to week; an eliminated starter leaves an empty slot.
29. ~~DONE~~ Active Roster Board → "This Week's Starters": row per user (starters, right-aligned bench), then compact tribe-grouped cast view showing who's drafted.
30. (PARTLY DONE: invites and reminders are in -- action bar + db/reminders.js) Notifications/invites: global persistent surface, reminders; "You're Invited" on Join/Create is too subtle and invisible if already in a league.
31. Joining mid-season: can activated members draft? Starting-points adjustment? Varies by draft type/ownership/rules?
32. (BACKBURNER 2026-10-01: too many moving parts, a tour would go stale fast) Onboarding / guided walkthrough (coachmarks highlighting e.g. the lineup section when action is needed) — research libraries/UX patterns.

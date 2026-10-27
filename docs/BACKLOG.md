# Backlog

What's open, newest thinking first. **Decided against** and **done** are kept below so a later
session doesn't re-propose them. Context for everything here is in `docs/HANDOFF.md`.

Last updated 2026-10-27.

## Open: needs design or a decision first

1. ~~**Members joining a started league**~~ **Built 2026-10-11 as late joiners** (`docs/PLAN-late-joiners.md`);
   the notes below are kept for history. **Deferred (user, 2026-10-11): Classic fairness.**
   Classic scores how far each pick lasts, and a late joiner drafts only from who's still in, so they
   can't hold an early boot and tend to out-score day-one drafters once a commissioner adds them. Not
   urgent: late joiners are hidden (ghosts) by default. Options in `docs/PLAN-late-joiners.md`.
   History (from feedback #10/#31): before this, they just appeared in standings, and after a commissioner "activates" them there's no defined path.
   - Can an activated member draft? Should there be a starting-points adjustment?
   - Should it vary by league type or ownership (Classic draft / Active Roster / Eliminator Pool;
     shared vs exclusive)?
   - Possibly a commissioner-set starting score.
   - Brainstorm before building. It's also an onboarding problem: a late joiner should always have a
     clear next step in the action bar.
2. **"How this league works" cards.** A dismissible card per league type on Overview (rules, what
   scores, when lineups lock), reachable again from a "?". Proposed as the answer to "people don't
   know what to do" without a guided tour.
3. **"You're all set" confirmation.** The user's idea: a green bar saying "you're all set" that
   disappears after 5 seconds, shown when nothing is due. They asked to test the app first before
   deciding. Pairs with #2.
4. **Combined leaderboard across linked leagues.** One standings view across the three linked
   leagues (a "decathlon"). Offered, not decided.
5. **Email reminders as a fallback** for players without push. Reuse `db/reminders.js` and the app's
   existing Resend email; same once-per-episode rule. Only worth it if reminders prove valuable.
6. **"Learned about someone's idol/advantage" points.** It's tracked at 0 now. After a few
   researched episodes, compare research's answers with the episodes in Admin's review. Then 0.5 if
   reliable, 0.25 if mixed, or keep at 0. Avoid ≥1 unless very accurate.
7. **Test Survivor's shared vs exclusive values.** Traitors' split was tested with mock exclusive
   leagues (`docs/RESEARCH-traitors-scoring-values.md` §3.7: owning the winner decided 80% of
   leagues, 70% after the split). Survivor's split was reasoned, never tested. Not a quick retrofit:
   the Survivor study ran on the survivoR spreadsheet with scripts that weren't kept, so it needs that
   event mapping rebuilt first (`docs/RESEARCH-scoring-values.md` §2 and §9 describe it). The
   Traitors `ownership.py` shows the mock-draft method to copy.
8. **Local dev DB repair** (see HANDOFF): re-apply 0017–0024 (minus 0016/0023, which need
   pgvector), then 0033–0040. Needs the user's go-ahead.

9. **Sports data beyond ESPN** (2026-10-27; docs/PLAN-sports-data.md). The first build is ESPN only. Add these behind the same
   provider interface when a gap shows, each checked live already (the plan's table has the details):
   - MLB Stats API (no key): every minor-league level, plus KBO and NPB, with headshots. ESPN has no minor-league baseball.
   - NHL's API (no key; not probed yet); the AHL (ESPN doesn't have it; no free source found yet).
   - The Premier League's fantasy API (no key): its players' official headshots (ESPN's soccer has few; Wikipedia covers most meanwhile).
   - OpenLigaDB (no key): German soccer backup. Jolpica / OpenF1 (no key): F1.
   - With a second source: the chain's tests (the plan's 1b: a roster holding the players its box scores show, and so on), remembering
     the winner per league (`sports_picks`), and a circuit breaker for a source that's down or rate limited.
   - Only if a test keeps failing (free signups): CricketData, football-data.org. Not used: TheSportsDB (free team lists stop at 10
     players), API-Sports (free is old seasons only), FotMob (didn't answer).

10. **Games over a span: what's still open** (2026-10-27; docs/PLAN-sports-data.md step 6, its As built and follow-up). Built: a
    game from the next episode through a chosen one, Run it back on the next span, plaques that name it, and its end in Game
    settings. Open:
   - **Moving its start.** Only the end moves (Game settings' How long). A start that moves before its first episode airs would
     cover "post-merge" or "just the playoffs" without waiting to start the game then.
   - **Side bets after the end.** One proposed after a span's last episode goes on a later episode and never pays
     (`BetLogic.addToUpcoming`): it should be refused, or not offered.
   - **One word for an episode.** The start sheet says the rulebook's (`partWord`), the hub, plaques and Game settings the
     show's (`episode_term`). They agree on every show today; a rulebook saying "event" for a show saying "Game" would read both.
   - **Run it back's "same length again" counts episodes, not nights**: a span over a double-header night is two.
   - **Places that don't know the end yet:** the classic app's catch-up reveal (`RevealLogic.isComplete`, `revealNext`),
     Backstage's open episodes (`backstage.ts` `takes`), and How it works' updates (they say only where a game starts).

## Open: small or polish

8. **League swipe tuning.** Everything is a constant at the top of `league-swipe.tsx`: DEAD_ZONE
   18px, GAP 32px, EDGE 28px, settle at 30% of the width or a flick. Watch for jank on older phones,
   since both neighbours' pages are pre-rendered. The fallback idea was a lighter peek (name + first
   card).
9. **Notification test copy** in `push-core.js` `sample` messages: review the wording when there's a
   moment.
10. **Predictions lock?** A player asked whether predictions should close when the episode starts.
    The user decided to keep them open for now ("a bit of nuance in what should be allowed").
    Revisit if it causes disputes.
11. **Keep show art and cast photos for the installed app (added 2026-10-26).** Today the browser's own cache holds them:
    TMDB and TVmaze send a year's `max-age`; Wikimedia sends none, only ETag/Last-Modified, so browsers recheck it cheaply.
    No service lookups happen on a page load: the finder (`src/lib/server/show-art.ts`) stores URLs once. The gap is the
    installed PWA. Phones evict that cache under storage pressure (iOS readily), and offline nothing shows, because
    `public/sw.js` deliberately caches only the offline page.
    - **The fix:** a cache-first rule in `sw.js` for images from `image.tmdb.org`, `static.tvmaze.com` and
      `upload.wikimedia.org` only, in its own cache with an entry cap (oldest out), and nothing else changed.
    - **The catch:** TMDB sends no CORS header, so its responses are opaque, and Chrome counts each opaque cached response
      as ~7 MB of quota. Keep the cap small (~100), or load those images with `crossOrigin` if TMDB's host allows it
      (check first).
    - **Not localStorage:** text only, ~5 MB.
    - **When:** only if offline start-up with art matters, or players notice posters reloading on start-up.
12. **The phone's back doesn't close an open sheet (noticed 2026-10-27, building the phone's back).** The new design's
    sheets (`src/new/ui/sheet.tsx`, Base UI's Dialog) close on Escape, a scrim tap or a swipe down, but Android's back
    goes to the history: it moves the page underneath, and a sheet mounted in `(in)/layout.tsx` (the couch's, Start a
    game, Rate it…) can stay open over the new page. A native app closes the sheet first.
    - **The fix:** a close watcher while a sheet is open (`new CloseWatcher()`, its `onclose` closing the sheet,
      destroyed when it closes). It's opened by a tap, so it gets a group of its own above the phone's-back watcher
      (`src/components/phone-back.tsx`, which drops its own watcher on that tap anyway). Classic's More sheet already
      closes on back (a history entry, `mobile-nav.tsx`).
    - **Check:** extend `scripts/dev-test/check-phone-back.js`: open a sheet, Escape, the sheet closes and the path stays.
13. ~~**The Cast tab hides a set-up cast until results come in**~~ **Built 2026-10-27:** with nothing counted the Cast tab
    shows the faces (no numbers) and a line; and Fill in what happened now looks up each episode's results too, for a show
    made a game that nobody plays (`src/lib/server/research-asks.ts`, migration 0152; check:
    `scripts/dev-test/check-research-asks.js`).
14. **Making a game drops the cast's starting roles (noticed 2026-10-27, Traitors 5).** The cast answer's `startingRole`
    (the season's two starting Traitors) is parsed by `cast-prompt.js`, but `confirmMake`
    (`src/lib/server/make-game.ts`) writes only name, group and photo, so `season_cast.role` stays null. `toCastRoles`
    exists for a league's import. Decide whether a confirmed starting role belongs on the season's cast (spoiler-guarded
    from episode 1) or should come in as an episode-1 `role` result.
15. **Results looked up one episode at a time: a gap isn't asked around (noticed 2026-10-27, building research asks).** Each
    episode's question lists who's still in by the results so far (`db/episode-research.js` stillInGame). When one episode
    isn't found (two tries, then given up), the next ones still go, so their questions can include someone who actually
    left in the missing one; Try again fills the gap later, but the episodes after it aren't asked again.
    - **The fix, if it shows:** when a given-up episode is filled in by Try again, ask again (merge) the asked episodes
      after it, or hold a season's later asks while one before them is given up. `src/lib/server/research-asks.ts`,
      `db/bot-research.js` planAsks.

## Decided against (don't re-propose without new information)

- **An AI draft/lineup/pick advisor for players** ("Coach"): rejected. Feels like pay-to-win inside
  a friend group, and worse, a live-research advisor working off an airing season risks leaking a
  real result dressed up as a statistical lean — directly against the spoiler protection
  (`SpoilerLogic`, the results-in reveal gate, catch-up mode) the rest of the app is built around.
  Any future "skip the effort" feature for players, not just commissioners, should stay retrospective
  (season recaps, shareable cards) rather than touching an in-progress decision.
- **A guided onboarding tour / coachmarks:** revived 2026-10-10 as a scripted mock-mode season; see
  `docs/PLAN-guided-tour.md` (which answers the staleness concern).
- **A notification bell/inbox:** the action bar already lists everything actionable, and a bell
  would mostly repeat it. Revisit only if people ask for "what did I miss" history.
- **"Survived the episode" points:** skipped. It's a baseline everyone earns, so not much signal.
- **"Made the merge" / "made the jury" points:** skipped.
- **"Vote cancelled by an idol" (−0.5), "Shot in the Dark played and safe" (+1) and "played an idol
  for someone else" (+1):** offered, not chosen.
- **"Each vote against you":** clashes with the existing "+1 survived votes".
- **Confessional counts, "big moves", blindsides:** not on the wiki, so research would guess.
- **Chat in spoiler protection:** someone reading chat is choosing to risk spoilers.
- **Tags on chat messages saying which league they're about:** one conversation, no tags.

## Done (2026-10-01/02)

From the original feedback triage, all done:

- **Bugs:**
  - league dropdown flash
  - sidebar overflow
  - click-outside closing the league menu
  - catch-up "reveal episode 14" after the finale
  - draft order sorting
  - missing original draft picks
  - Research missing pre-league episodes
  - mobile theme picker cut off
  - Scoreboard roster detail
- **Tweaks:**
  - wider sidebar
  - no post-merge checkbox
  - episodes collapsed by default
  - bets → predictions
  - Research defaults
  - hex colour input
- **Design:**
  - lighter dark mode and dark logo
  - theme picker in Account
  - Wiki Connector trimmed
- **Features:**
  - season results card with confetti
  - top-3 players per episode
  - spoiler protection
  - notification tests
  - lineup redesign and scoring chart
  - goat penalty
  - action bar
  - starters carry over
  - Overview Board as this week's starters
  - invites in the bar
  - episode reminders

Since then:

- **Scoring:**
  - endgame jury votes
  - fire-making +2/−1
  - chosen for a reward
  - the advantage-knowledge category, tracked at 0
  - predictions capped at 1–3
  - scoring categories in the chart and League Settings
- **Locks:** lineups and picks lock at air time.
- **Starters board:** live starters, with an optional "hide until it airs" (grey "?" squares).
- **Scoreboard:** bars as a centre-line chart (gains up/losses down, benched outlines), per-event
  breakdown lines, one legend per page.
- **Linked leagues:** shared chat, one reveal for all, reveal lines in chat, automated chat lines
  retired.
- **League swipe** with a live peek and a rolling title.
- **What's New:**
  - one-time popup with stacking releases
  - Admin preview
  - the More/sidebar link with "See older releases"
  - "Show me" links
- **Admin:**
  - spoiler-free review and research
  - auto-research "N hours after air"
- **Notifications nudge** in the action bar.
- **Chat:** fills the screen and stays above the keyboard; correct unread badge.
- **Mobile fixes:**
  - More-sheet links
  - swipe-down to close
  - tab bar painting on the season-complete page
- **Demo seasons:** fixed for all of the above.

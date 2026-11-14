# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

Mobile web first, installable as a PWA. Players and commissioners use it mainly on phones; admin work is mostly done at a desk but must still work on a phone.

## Users

- **Watchers: people following shows or sports with their friends.** Watching at their own pace, seeing where friends are, chatting, reacting with GIFs and sharing what they watch are complete uses of the app. They may never play, try a one-episode game occasionally, or play solo for fun. Watch-along is part of this experience, though its current implementation is still underdeveloped. (User direction, 2026-11-10.)
- **Players: reality TV fans playing with a group.** They join a league with friends, family or other fans, draft or pick contestants, and follow along week by week, usually on a phone around the night an episode airs. The product is aimed at the general public, not only the owner's own groups.
- **Commissioners: the player who runs a league.** They create the league, pick the show and season, invite people, run the draft, and keep results flowing each week. Every commissioner is also a player.
- **Admins: whoever operates the site.** They add shows and seasons, research and approve casts and show formats, and review episode results that feed every league on a season.

## Product Purpose

Make watching shows and sports more social and enjoyable: follow at your own pace, find your people, chat and react, and turn the viewing into a game when you want to. Games range from a one-night gut pick to a season of detailed, informed decisions.

Success means watchers have a satisfying experience without starting a game, and players can start a game for what they actually watch, get results with little commissioner effort, and explore the detail they need. Nobody should be spoiled before they've watched. The product should be beautiful and pleasurable to use as well as understandable. (Expanded user direction, 2026-11-10.)

## Positioning

**DIY: any show can become a league.** Other fantasy apps support a fixed set of shows. Here, a user can research a show's format and cast themselves (by pasting a generated prompt into any AI chat with web search) and turn it into a playable league with its own events and scoring. The long-term intent is that this covers any show with recurring events: competition reality (Survivor, The Traitors, The Challenge, Dancing with the Stars), other reality formats (for example Below Deck), and even scripted shows (for example a sitcom like Scrubs).

Supporting differences, all confirmed:

- **Spoiler-safe.** When an episode's results are ready, each player is told and chooses when to reveal them. Catch-up leagues can play an already-aired season as if it were airing.
- **Several ways to play.** Classic, Active Roster and Eliminator Pool today, with exclusive or shared ownership. More game types are planned.
- **Easy commissioning.** Results come from a show's wiki connector or from copy/paste AI research, so nobody types up every episode by hand.

## Operating Context

- **The weekly ritual.** An episode airs; results become available; each player reveals when they've watched; standings, lineups or picks update; the league talks about it in chat.
- **Research is copy/paste today.** The app builds a prompt; the user runs it in any web-searching AI chat (ChatGPT, Claude.ai, Gemini, whatever they have) and pastes the answer back. This applies to show formats, casts and episode results. It is free.
- **Paid automation is a future feature.** Payment will buy convenience: scheduled, automatic research that loads results without copy/paste. It will not gate league counts or the free copy/paste path.
- **Wiki connectors** exist for Survivor, The Traitors and The Challenge; other shows rely on research.
- **Shared seasons.** One cast and one set of approved results per season, shared by every league on that season. Admins approve season-level data; commissioners can fill gaps for their own league.

## Capabilities and Constraints

- **Shows:** Survivor, The Traitors, The Challenge, Dancing with the Stars, plus self-serve researched shows ("+ Add it"). Each show names its own people and groups (castaways and tribes on Survivor, for example); copy must use the show's own terms, not Survivor's.
- **League types:**
  - *Classic:* snake-draft a team; each castaway earns 1 point plus 1 per elimination they outlast, counted live (so they end on their place in the boot order); optional predictions.
  - *Active Roster:* draft a roster (active slots plus bench), set a lineup each episode before it locks at airtime; only starters' events score.
  - *Eliminator Pool:* no draft; each episode every player picks one contestant they think survives; no repeats until everyone still in has been used, never the same pick twice in a row; ranked by longest streak, then total correct.
- **Ownership:** exclusive (snake draft) or shared (blind draft: everyone picks privately, all picks reveal together, a contestant can be on several teams).
- **Mid-season:** pickups (replenish) after eliminations and swap windows, each optional and commissioner-enabled.
- **Also:** per-league scoring rules (a commissioner can customise a copy of the show's rules), predictions and side bets, finale predictions, league chat, computer players, catch-up mode, spoiler reveal per player.
- **Accounts:** one account system (username, with admin roles) for everything. No other login.
- **Technical:** an existing Next.js codebase with its own backend and Postgres database. It must not depend on the legacy SurvivorDraft server.
- **Planned:** more game types; automated (paid) research; research prompts that handle non-competition and scripted shows.
- **Undecided:** a shorter home-screen name (see Brand Commitments); pricing and what exactly the paid tier includes beyond scheduled automatic research.

## Brand Commitments

- **Name: Game Your Show** (decided 2026-10-12; gameyourshow.com is owned). It replaces the working names "Reality Fantasy Leagues" and "LeagueCrafter". Brand copy leads with making a game out of any show, not with fantasy leagues. Only the repo name and its history still carry the old names.
- **Logo: direction C, "Insert"** (chosen 2026-10-12). GAME SHOW in Archivo condensed caps (width 62, weight 800, outlined so it never waits on a font), with YOUR inserted on a slanted chyron wedge: any show becomes your own game show. Two colourways:
  - **Brand** (app icon, marketing): bone or ink letters, the wedge in chyron with YOUR in ink. The app icon stacks GAME / YOUR / SHOW on Night ground (#16141d) in both modes; the favicon is a G on the wedge.
  - **In-app** (the front door's wordmark, `src/components/auth/wordmark.tsx`): the wedge is a `foreground` fill with YOUR knocked out in `background`, like the You badge, so it inverts with the theme and the screen's one yellow stays its action (the One Chyron Rule).
- **Name in the app:** `PRODUCT_NAME` in `wordmark.tsx`, the manifest (`src/app/manifest.ts`, name and short_name both "Game Your Show") and the root layout's metadata. iOS cuts the home-screen label to "Game Your S…"; a shorter short_name is still undecided.
- No voice guide or other identity constraints have been confirmed. The tagline "Pick a show. Make it a game. Bring your friends." is proposed, not confirmed.

## Evidence on Hand

- Season 51 cast photos: `public/photos/s51/`, and earlier seasons under `public/photos/`.
- Show artwork can be set per show (`shows.art_url`).
- A user manual and product guide exists as a Claude Doc (linked from `docs/HANDOFF.md`).
- UX baselines: `docs/ux-baseline/2026-10-09-mobile/` (primary) and `docs/ux-baseline/2026-10-09/`.
- **Absent, so never fabricate:** user counts, testimonials, reviews, press, partnerships, pricing, and any claim of official affiliation with a network or show. Network key art (for example CBS or Peacock promotional images) has no confirmed usage rights.

## Product Principles

1. **Any show can be a league.** Design for the show the user brings, not just Survivor. Nothing in the product should assume tribes, idols or tribal council.
2. **Free stays complete.** The copy/paste path must be fully usable on its own. Paid features buy convenience, never access.
3. **Never spoil.** Each player decides when they see results. Nothing outside the reveal should give an episode away.
4. **The episode night comes first.** The weekly loop (reveal, see what happened, set the next lineup or pick) must be fast and clear on a phone.
5. **Commissioning is light work.** Results should arrive, not be typed. A commissioner's job is to check and approve, not to enter data.
6. **Understand at a glance, then drill down.** The hub and show-tab overviews must make the current situation and necessary next actions clear in the first phone viewport. Summaries open detailed screens for history, standings, rules and analysis. Essential actions must not depend on discovering a sideways carousel or scrolling through unrelated detail.
7. **Simplicity comes from hierarchy.** Keep the hub → individual show → Tonight / Episodes / Games / Players (stats) / Chat structure. Use readable, moderately sized text and controls: neither oversized sections that crowd out actions nor subtle controls people overlook. Real users have reported that the app feels overwhelming and confusing; adding a capability must not add another competing overview section by default. (User direction, 2026-11-10.)
8. **Keep the character; the art may evolve.** Show artwork, bold television graphics, expressive cast imagery, GIFs and social moments are product value. They may be reimagined, not merely preserved pixel for pixel. Clarity must not turn the app into a clinical utility. The first-view rule applies to necessary information and actions, not a demand to squeeze the whole page into one screen. (User direction, 2026-11-10.)
9. **Let participation grow naturally.** Watching only, occasional play, solo play and committed multiplayer all deserve a pleasant complete experience. Show applicable actions without forcing a casual/expert identity choice. Support a quick gut choice and an informed decision from the same flow; detailed statistics remain rich and reachable. Use the sport or show's own terms and preserve delayed-viewing boundaries. (User direction, 2026-11-10.)
10. **Sports is a flexible family of experiences.** The intended scope includes the sports ESPN provides, including baseball, hockey, NFL football, tennis and soccer, with sport-specific presentations where useful and a neutral fallback where no custom presentation exists. Do not make NFL's teams, field, periods, scoring or terminology the universal sports model. The current UI study uses NFL as its representative sport. Data availability and engine eligibility still govern which statistics and games can actually be offered. (User direction, 2026-11-10.)
11. **Play at your own pace by default.** Couch members should be able to make picks before watching and reveal afterward on the honor system. Game makers may explicitly choose **Live only** per game for shared deadlines. Ordinary own-pace play is not a special couch mode or an exception requiring the commissioner's permission. Keep watching progress and episode reveal state understandable; one episode reveal opens that episode across all games. Make live-only restrictions clear. This is the intended policy; review existing engine/settings defaults before claiming it is fully implemented. (User clarification, 2026-11-11.)
12. **Overview to detail is always connected.** A person, cast member, athlete, team, game, score or result already on an overview should open its deeper context directly. Preserve episode, game, filters, scroll and draft selections when returning. Every drill-down respects the same visibility boundary as its entry point. Players should see their last-episode outcomes and permitted comparisons, with a choice of showcase or quick-summary reveal. (User direction, 2026-11-11.)
13. **The episode is the reveal.** Revealing an episode reveals it across all of the person's games for that episode. Keep the showcase full screen: a visual “last time on” recap, then bold game, player and standings stories with appropriate motion. Watchers get a complete recap/reaction experience without game slides. Tonight follows identity, unified viewing progress and friends' pace, watch controls, last-episode recap/social activity, then game updates. A prominent compact top strip opens due decisions or confirms readiness. (User correction, 2026-11-11.)

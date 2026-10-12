# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

Mobile web first, installable as a PWA. Players and commissioners use it mainly on phones; admin work is mostly done at a desk but must still work on a phone.

## Users

- **Players: reality TV fans playing with a group.** They join a league with friends, family or other fans, draft or pick contestants, and follow along week by week, usually on a phone around the night an episode airs. The product is aimed at the general public, not only the owner's own groups.
- **Commissioners: the player who runs a league.** They create the league, pick the show and season, invite people, run the draft, and keep results flowing each week. Every commissioner is also a player.
- **Admins: whoever operates the site.** They add shows and seasons, research and approve casts and show formats, and review episode results that feed every league on a season.

## Product Purpose

Turn any TV show into a fantasy league that a group can play together, week by week, without anyone doing tedious data entry.

Success means a group can start a league for the show they actually watch, the weekly results arrive with little effort from the commissioner, and nobody gets spoiled before they've watched.

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
- **Undecided:** the product name (see Brand Commitments); pricing and what exactly the paid tier includes beyond scheduled automatic research.

## Brand Commitments

- **Name: undecided, leaning "LeagueCrafter"** (2026-10-11; leaguecreator.com was taken). The front door shows LeagueCrafter as type (`src/components/auth/wordmark.tsx`, one constant). The app manifest still says "Reality Fantasy Leagues", and the Dashboard banner still says "Survivor Fantasy Engine" with a torch. None of these is binding yet, and there's no logo or icon art. Future work should not lock in a name without a decision.
- No other brand assets, voice guide or identity constraints have been confirmed.

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

# Plan: team pictures and logos a couch adds itself

> **Status (2026-11-22): settled direction, not started.** The user's call (2026-11-22): logos follow the user-uploaded
> content model. The site never supplies a team, league or show logo; a person on a couch may upload one, and **only that
> couch sees it** (option A of A/B/C: not just the uploader, never the whole site). Terms with a takedown policy come first.
> Not legal advice: a lawyer reads the Terms before the app charges money.
>
> **2026-11-22, later:** the user: carry on with everything as if the Terms were complete and final (no address, phone or DMCA
> filing for now; the emails stand). **L0 done** on branch `team-logos` (lane `logos`, `../rfl-logos`, port 3020; 4d67f120).
> Next: one design round for L3, L4 and L5 together (below, "Next").

## Why this shape

- **The model:** the site hosts what users upload, passively. It needs four things: no logo gallery or picker supplied by the
  site, no money made from the logos, Terms that make the uploader responsible, and quick takedowns with a repeat-infringer rule.
- **Copyright vs trademark:** the DMCA safe harbor (17 U.S.C. 512) covers copyright only. Logos are also trademarks, and
  trademark law has no safe harbor. A host is liable for a user's trademark use only once it knows of the specific case
  (*Tiffany v. eBay*), so the same quick takedown is the practical protection for both.
- **Why per couch:** couches are private, behind sign-in, so a logo is seen by a few friends, never crawled. Site-wide (C) would
  make user uploads the site's own team logos, which amounts to a gallery built by users. Only-me (B) is safe but makes every
  friend upload the same file.
- **Upload first, links later or never:** if a linked address is drawn as-is, the image stays on its own server, every
  view tells that server the viewer's IP address, and it can break or be swapped. A link done properly means the server fetches
  it once, guards against fetching internal addresses (SSRF), checks it's an image, shrinks it and stores a copy. That is an
  upload with more risk, so v1 is upload only (L5 revisits it).

## Steps

### L0. Stop drawing ESPN's logos (before the Terms can say "the app doesn't provide logos")

Found 2026-11-22: a sports fill gives each NFL defense (`def:<team>`, D/ST) the **ESPN team logo** as its picture
(`src/lib/server/sports/cast.ts` 107-118, step 1.3, commit 7676a520), hotlinked from `a.espncdn.com`. `team_follows`,
`week.ts` and `find.ts` also carry ESPN's `logo` address in their read shapes (cached; no screen draws them today, as far as a
grep of `src/new` shows).

- A defense's picture becomes **our own mark**: the team's abbreviation on its colour, the rule `src/new/sports/parts.tsx` 36
  already follows (the user, 2026-11-15: "use the city name abbreviated and have our icon square stylized"). Then the couch's
  uploaded picture for that team when there is one (L4).
- Drop `logo` from the read shapes that reach a phone, and clear it from stored rows (`team_follows.logo`, and the people's
  `photoUrl` that are ESPN logo addresses: recognisable by host and path, so one `UPDATE`).
- A check (`scripts/dev-test/check-no-league-logos.js`): no client-bound sports response or stored person picture holds an
  `espncdn.com/i/teamlogos/` address.
- **Open, for the user (not decided here): athletes' headshots.** The app also hotlinks ESPN's player headshots
  (`espn.ts` 163-177, through ESPN's resizer). That isn't a logo question: they're ESPN's (or its photographers') photos, and
  players' likenesses. Same family of risk, a separate call. Options: keep as is (common among small fan apps; takedown if
  asked), move to Wikipedia/Commons photos with credits (the research doc's chain, fewer faces), or initials on the team's colour.

**Done 2026-11-22 (4d67f120).** As built: `src/lib/sports/team-badge.ts` (`teamBadgeSrc`, the TeamMark as a ~600-byte SVG
data: URL, with its faint white inner edge; `LEAGUE_LOGO`, ESPN's logo addresses); `teamBg`/`teamInk` moved there (parts.tsx
re-exports them). `logo` is gone from `Team`, `ListedTeam`, `TeamHit`, `WeekSide` and `FollowedTeam`. A defense's picture is the
badge; `saveCast` replaces a stored ESPN logo, an empty photo or an older badge with it and counts it (`pictured`), which brings
the season's games in line (`intoGames`). Migration 0449 clears `team_follows.logo`, blanks `logo` inside `sports_cache` in
place, and clears ESPN logos from `season_cast.photo_url` and games' states (initials until the daily refresh gives the badge).
The bench's defenses take the badge too (`sports-roster.cjs`). Checks: `check-nfl-defenses.js` (badges 32 of 32; a season
filled with ESPN's logos, 32 in its game, has none after its next fill), `check-find-game.js`, `check-sports-new-players.js`,
`npm test` (2,557, `tests/team-badge.test.js` new). Seen at 390 on the draft's DEF list: 32 badges, no ESPN logo. The
separate check script planned above wasn't needed: `check-nfl-defenses.js` carries it.

### L1. Terms (draft done 2026-11-22)

[legal/TERMS-draft.md](legal/TERMS-draft.md): plain-words boilerplate with the uploader's promise, the takedown and
counter-notice process, repeat infringers, "not affiliated with any league", 13+, no prizes or betting, AI results can be
wrong, third-party data. It names no person (the user, 2026-11-22): the party is Game Your Show, with
support@gameyourshow.com and copyright@gameyourshow.com; the postal address is described ("the registered owner of the
gameyourshow.com domain", on request), never given. The user reads it.

### L2. The user's part (outside the app)

1. **Register a DMCA designated agent: not now, and not a gate (the user, 2026-11-22: go ahead without it).** The Terms
   give the emails and describe the postal address as the gameyourshow.com domain owner's, offered on request. Known
   trade-off: without a filing the DMCA safe harbor doesn't apply, so quick takedowns are the protection (good practice,
   and what trademark law looks at anyway). If it's filed later: the Copyright Office's online system (dmca.copyright.gov), **$6**, renewed **every 3 years** (it lapses silently:
   put the date in a calendar). Service: **Game Your Show** (gameyourshow.com); agent: the role "Copyright Agent" (a
   position is allowed instead of a person's name). It needs a mailing address and phone, which are **public**: a P.O. box
   and a forwarding number keep them from identifying anyone. Then section 7 of the Terms gains a line pointing to the
   directory.
   - **The domain's registration won't stand in for it.** Public WHOIS for most registrars has been redacted since 2018
     (or shows a privacy proxy), and the safe harbor asks specifically for an agent filed with the Copyright Office.
2. **Make the two addresses receive mail:** `support@` and `copyright@gameyourshow.com`. Resend only sends today, so they
   need forwarding to an inbox the user reads (the domain's DNS host's email routing, free on Cloudflare).
3. **Also wanted: a Privacy Policy.** The app keeps emails, pictures, phones for notifications and chat. A policy is expected
   of any site with accounts, and Google requires a privacy policy link before it verifies a sign-in app. Its own short draft,
   when the user wants it.

### L3. The Terms page and where it's linked (a screen: the design process)

- `/terms`, readable signed out, at 390 first. Linked from the landing page's footer, sign-in and making an account ("By
  making an account you agree to the Terms"), and Settings › Help, beside Credits.
- The landing disclaimer (`src/new/welcome/landing.tsx` 176) adds sports leagues and teams.
- **No age check exists today.** The Terms say 13+. Whether to ask at sign-up (a single "I'm 13 or older" tick, or a birth
  year) is the user's call (open).
- Through the design process (docs/DESIGN-PROCESS.md), small: one page, its words already written.

### L4. A couch's team pictures (the feature; the design process, whole)

- **Two kinds, one store:** (a) a real team's picture as the couch sees it (the Chiefs, in that couch's games, its scores
  and its defenses), and (b) a person's own fantasy team picture in a game (their seat). Both shown only to that couch.
- **Store:** reuse the profile picture's pipeline (`user_pictures`, migration 0135; `/api/me/picture`,
  `/api/people/[userId]/picture`): shrunk in the browser, a cap of ~100 KB, served only to the couch's members, cached by
  version (`private, max-age=31536000, immutable`). Logos need transparency, so PNG or WebP rather than JPEG. A new table,
  roughly `couch_pictures (couch_id, kind, key [league + team id, or seat], bytes, type, version, set_by, set_at,
  removed_at, removed_why)`. Not backed up, like faces.
- **Who sets one** (open, for the design round): recommend anyone on the couch, newest wins, "set by Andrew" beside it, the
  couch's owner can remove it.
- **Where it shows:** inside that couch's places only. **Open:** the hub and the scores strip (A1 of
  PLAN-sports-couch.md) span couches, so a person on two couches could have two Chiefs pictures. Recommend our own mark
  there (abbreviation on colour), the couch's picture only inside a couch.
- **Never:** in share or preview images (`opengraph-image.tsx`, invite links), push notification images, the landing page,
  signed-out pages, any picker or suggestion of where to find a logo, preview games' fixtures, bench fixtures, test
  screenshots in this public repo or in story Artifacts (made-up badges there), anything paid.
- Upload words say it plainly: "Only your couch sees this. Use a picture you have the right to use."
- **Checks:** a `zt-` fixture couch with an `up`/`down` pair; a non-member gets a 404 for a couch's picture; a removed
  picture stops serving at once (a new version).

### L5. Takedowns on the desk

- On the desk: find a picture (by couch, team, or who set it), see it, **remove it with a reason**, and the uploader is told
  in the app. A notices log (`takedown_notices`: who complained, what, when it was removed, the counter-notice and outcome),
  since the counter-notice timing needs a record.
- Strikes: one notice can take away that person's uploads; repeated ones close the account (the Terms' section 7).
- A desk control fits the admin direction (complete control, phone first). It joins the desk's Round 1 work
  (docs/design-round/admin-r1-*), not a separate admin.
- Later, if wanted: links (the server fetches once, with SSRF guards, then it's an upload).

## Next: one design round for L3, L4 and L5

Read docs/DESIGN-PROCESS.md and docs/DESIGN-ROUND-PACKET.md first. Intent, then Perception-First Design, then Impeccable,
once each, then one check and one batch of fixes; phone first at 390; real renders on this lane's server; a captioned
before/after screenshot story published as an Artifact; then pause for the user. The surfaces:

1. **The Terms page** (`/terms`) and its links (landing footer, sign-in and making an account, Settings › Help beside
   Credits), with the landing disclaimer's sports line. Words from legal/TERMS-draft.md as written.
2. **A couch's team pictures:** where a person sets one (a team in the couch's games; their own fantasy team's seat), what the
   upload sheet says ("Only your couch sees this. Use a picture you have the right to use."), who set it, removing it, and
   every place it then shows inside the couch (rows, the game page, the draft, the reveal), with TeamMark as the fallback.
3. **The desk's takedown:** find a picture (by couch, team or who set it), remove it with a reason, the uploader told, the
   notices log, a strike that takes away uploads. It joins the desk's Round 1 shape (design-round/admin-r1-*).

The open calls go to the user as named choices in the story, never decided silently: who on a couch can set a picture; the
hub and the scores strip (two couches, two Chiefs pictures: the recommendation is our TeamMark outside a couch); an age tick
at sign-up. Athletes' ESPN headshots (L0's open question) stay out of this round unless the user answers it.

## Order

L0 first: it's a correctness fix and needs no design. L1 is done. L2 is the user's, any time. L3 can be built now and goes
live once both addresses receive mail. L4 and L5 ship together after it. L4 and L5 ship together: no uploads without the takedown button.

## Noticed, not fixed

- ESPN athlete headshots are hotlinked (L0's open question, the user's).
- No Privacy Policy and no age check (L2.3, L3: the user's).

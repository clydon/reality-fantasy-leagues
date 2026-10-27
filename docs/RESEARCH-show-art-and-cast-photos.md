# Research: show and season art and cast photos, filled in automatically

Researched 2026-10-26. When a show or season is added, its graphics (the header and the cards) and its cast photos should
arrive on their own. Free sources only; signing up for keys is fine. Sports should be covered eventually. This is research
plus a recommended design, not a build plan yet: the open decisions at the end come first.

## What the app has today

- **Show art:** `shows.art_url` (migration 0051), one free-text URL per show, with `art_style` (0056) for how it looks
  behind a header. Add a show fills it with TVmaze's **medium poster** (210 x 295, hotlinked; `listing.ts` `hitOf`). That
  one portrait image is drawn everywhere: full-bleed landscape cards, squares, 54 x 72 tiles and the tall show bar, where
  it's soft (PLAN-new-design "Noticed, not fixed": Posters are TVmaze's medium image).
- **No season art.** `ShowArt` takes a `seasonId`, but the URL is always the show's.
- **Cast photos:** `season_cast.photo_url` (0011) and each league castaway's `photoUrl`. They come from the Fandom wiki
  connector (`db/wiki-sync.js`) for Survivor, Traitors and The Challenge, from TVmaze's show cast for a series or talk show
  (`castFromListing`), or from the cast prompt (`cast-prompt.js` asks the chat for a `photoUrl`, an accepted
  hallucination risk). Survivor 51's are hand-cropped copies in `public/photos/s51/` (0044), because Fandom only lets other
  sites load small images.
- **Unused already:** TVmaze's `/shows/:id?embed=seasons` (`listings.ts` `showListing`) returns an `image` for every
  season and the show's `externals` (its IMDb and TheTVDB ids). The app reads neither.

## What each source offers

V means checked live on 2026-10-26; D means from the source's docs.

| Source | Key | Commercial use | Hotlinking | Show and season art | Cast photos for each season (reality) |
|---|---|---|---|---|---|
| **TMDB** | free sign-up | **No** without a written agreement (charging users counts; price on request) | works (V) | posters, backdrops (some textless), **PNG logos**, **season posters**, episode stills, in fixed sizes | **Complete, including the season on air** (V) |
| **TVmaze** (already used) | none | **Yes** (CC BY-SA, credit and link) | allowed, cache forever (D) | show poster, backgrounds (original size only, ~2 MB), title art, **one poster per season** | good for finished seasons; thin for seasons on air (V) |
| **TheTVDB v4** | free sign-up | free under $50k a year revenue, with a link to TheTVDB; $1,000 a year to $250k (D) | works (V) | posters, backgrounds, banners, clear logos; seasons mostly posters | weak: one list for the whole show, newest season missing (V) |
| **Fanart.tv** | free sign-up | no commercial clause found; fan uploads | D | logos, clear art, season posters, season thumbs, season banners | none |
| **IMDb** | datasets free, API ~$150k a year | datasets non-commercial (V) | n/a | no images in the free data | not organised by season |
| **OMDb** | free key | no (CC BY-NC) | n/a | one poster (big ones for patrons) | names only |
| **Fandom wikis** (already used) | none | text CC BY-SA; images unlicensed; terms ban scraping (D) | only ~200 px from other sites (V) | season logos and cast group photos at full size, but not loadable cross-site | full portraits exist, ~200 px hotlinkable (V) |
| **Wikipedia / Wikidata** | none | free images yes; season logos are local fair-use files (V) | yes (V) | season logo ~400 px, fair use for Wikipedia only | cast names; almost no photos (V) |
| **TheSportsDB** (sports; not used) | test key `123` is development only; $9 a month to publish (V) | paid tier only, and even that "does not grant rights to third-party artwork" (V) | works (V) | league logos, badges, banners, posters, event art | player thumbs and cutouts, mostly not cleared for public use (V) |

**Cast photos for each season, checked (people listed, with a photo):**

| Season | TMDB | TVmaze (premiere's guest cast) |
|---|---|---|
| Survivor 47 (finished) | all | 18 of 18 |
| Survivor 49 (finished) | 18 of 18 | 3 of 18 |
| Survivor 50 (finished) | 27 of 27 | 24 of 24 |
| Survivor 51 (on air) | **21 of 21** | **2 of 21** |
| The Traitors US 4 | 25 of 26 | 23 of 23 |
| Big Brother US 27 | 47 of 52 (incl. celebrity guests) | 17 of 17 |
| Love Island USA 7 | 49 of 51 | none listed |

IMDb's Survivor cast isn't split by season, as noticed. TMDB's is: each person's role reads "Self - Contestant",
"Self - Houseguest", "Self - Islander", "Self - Host" or "Self - Guest", so hosts and guests filter out by that text.

## Recommendation

**TMDB first, TVmaze as the keyless and commercial-safe fallback, the wikis and hand-set URLs as they are now.** TMDB is the
only source with complete per-season casts and the right shapes of art (a landscape backdrop for the header, a portrait
season poster for cards, a transparent logo). Its free key is non-commercial, which fits the app today. So store every image
with its source, which keeps TMDB's images removable in one step if the app goes paid without a TMDB licence.

### Show and season graphics

| Use | First choice | Then | Then |
|---|---|---|---|
| **Cards and tiles** (portrait) | TMDB season poster (`w342`, `w500` for full-bleed) | TVmaze season `image` | show poster (TMDB, then TVmaze) |
| **Header** (landscape, behind the title) | TMDB show backdrop, textless ones first (`w780` phone, `w1280` desktop) | TMDB season poster, cropped | today's poster |
| **Logo** (optional, over the backdrop) | TMDB show logo, PNG (`w500`) | none | the typeset name, as now |

- A hand-set URL always wins and is never overwritten (the `COALESCE` pattern `wiki-sync.js` already uses).
- **Season logos aren't really available.** TMDB has show logos, not season ones. Fandom has big season logos but won't
  serve them to other sites, and Wikipedia's are fair use for Wikipedia only. TMDB's season posters usually carry the
  season's logo, so the card gets it that way.
- Pick automatically: TMDB lists images best-voted first. Take the first English poster and logo, and the first textless
  backdrop (else English). An admin can change it in a "Choose art" sheet listing the other candidates, next to the
  existing art URL and art style fields.
- TMDB has no season backdrops. A header that changes per season would use the season poster, cropped and treated by
  `art_style`. Episode stills are spoilers past the premiere, so never use them.

### Cast photos for each season

1. **TMDB** `/tv/{id}/season/{n}/aggregate_credits`: drop hosts, judges and guests by role text, then **match by name**
   against the season's cast (normalised: case, accents, punctuation; then first name when it's unique in the season).
   Matching against about 20 people is reliable, so the chat doesn't need to supply ids.
2. **TVmaze**: the guest cast of episodes 1 and 2 (finished seasons, and shows TMDB lacks).
3. **The Fandom wiki** icons the connector already brings (~200 px).
4. The cast prompt's `photoUrl`, then a hand-set URL, then initials (all already handled by `CastawayAvatar`).

**Spoilers (important).** TMDB sorts a season's cast by episodes appeared in and shows each count. For Survivor 51 that
lists the first boot last with 1 episode. Take **only name to photo** from TMDB: never its order, counts or later episodes.
The app keeps its own spoiler-free order (tribe, then name). The same goes for TVmaze: read the premiere's guest cast only.

### How it fits with the chat prompt

The chat stays the source for what the APIs don't have: starting tribes or teams, secret roles, and full episode results.
The APIs replace the part it's worst at, which is photos. The cast prompt's `photoUrl` stops being the main source (keep it
as a last fallback). Photos come from TMDB by name, after the cast is staged or imported, from any route (wiki connector,
Make it a game, cast import).

TMDB's credits can also supply the cast list for a show with no wiki connector, leaving the chat to add groups and roles.
That is one less thing for someone to paste.

### Sports: free, through Wikipedia (a sports listing already becomes a `sport` show; the chat supplies its athletes)

**TheSportsDB is out.** Its terms (V) allow the free key for development only, and "a paid API subscription does not grant
rights to third-party artwork". Its images marked unknown "must not be used ... publicly". So paying wouldn't clear its
photos either. ESPN's hidden API, OpenF1's headshots and formula1.com's are personal or non-commercial use only. Wikidata
can't supply rosters: its current members of the Chiefs were 7 people, of the Lakers 6 (V).

**Wikipedia can.** Its page image API returns only freely licensed photos (Wikimedia Commons, CC licences). They are free,
need no key, and stay usable if the app goes paid, with the photographer's credit.

| Measured 2026-10-26 (V) | People | With a free photo |
|---|---|---|
| F1 2026 drivers (all Jolpica lists, reserves included) | 32 | **32** |
| Lakers, Wikipedia's current roster template (players and staff) | 25 | 21 |
| Chiefs, Wikipedia's current roster template (incl. practice squad and coaches) | 76 (+2 with no article) | 50 |
| F1 2026 teams: free logo | 11 | 6 (all 11 have a fair-use logo on Wikipedia) |

Stars nearly always have one; depth players often don't.

1. **Who's in it:** the chat, as now, plus **each athlete's and team's Wikipedia link and each team's colour**. A link is
   easy to check, where an image URL is easy to invent. Verify the link: the page exists, Wikidata says it's a person,
   in the right sport. Else search Wikipedia for the name and sport, and take only one clear hit. For F1, Jolpica
   (`api.jolpi.ca/ergast/f1/{year}/drivers`, `/constructors`, free, no key) gives the season's field with Wikipedia
   links, so nothing is guessed.
2. **Photos:** the free page image by that link (one API request covers 50 people), hotlinked from upload.wikimedia.org
   at a standard thumbnail width. The photographer and licence come from the image's metadata (one more request), for
   the zoom view or a credits line. Then TMDB's photo through Wikidata's TMDB person id (P4985; 19 of 32 F1 drivers have
   one, few team-sport players), the chat's `photoUrl`, and initials on the team's colour.
3. **Teams:** the free logo where there is one (Wikidata P154 / the page image), else the team's colour and short name,
   which the app's groups already draw. Wikipedia's fair-use logos could come in under the same per-show switch as
   network art.
4. **League and event art** (header, cards): the same TMDB, then TVmaze, chain as any listing.
5. **Wikipedia rate-limits bursts** (this probe got 429s after ~15 quick requests). Ask for a roster in batched requests,
   one at a time, with a user agent that names the app and a contact, and keep the answers in the database.

Cost: nothing. The TMDB fallback is the only non-commercial piece, as everywhere else.

## Storage and hosting

- **Hotlink, don't copy.** TMDB serves every size we need from its own CDN, and TVmaze and TheSportsDB allow hotlinking. So
  there's nothing for Neon (1 GB storage) or Vercel image optimisation (5,000 transformations a month on Hobby) to carry.
  Copy only if a source forces it. That means TVmaze backgrounds (original size only) or a future commercial licence that
  requires it. Cloudflare R2's free tier (10 GB, free egress) is the place then.
- **Store TMDB images as plain URLs** at a fixed size in the existing free-text columns (`art_url`, `photo_url`, a league
  castaway's `photoUrl`): posters `w500`, backdrops `w1280`, logos `w500`, cast photos `w185`. They're recognisable by
  their host, so "remove TMDB" is one `UPDATE ... WHERE url LIKE 'https://image.tmdb.org/%'`, and nothing has to resolve a
  special scheme. A `tmdb:` scheme was the first idea; as built, plain URLs won because every existing reader already works
  with them.
- **Calls:** linking a show is one `/find` (by the IMDb or TheTVDB id TVmaze already returns). A season is about three
  calls: show images, season images and season credits. They happen when a show or season is made or its cast is staged.
  Nothing polls. TMDB allows about 40 requests a second.
- **TMDB's six-month rule:** cached TMDB data may be kept up to six months. Re-check a season's TMDB paths when the daily
  listings job touches its show, or on a monthly upkeep. Seasons over six months old and untouched could drop to
  TVmaze or the wiki.
- `docs/HOSTING.md` gains TMDB as a service when this is built (the standing request).

## Rights and the paid-app switch

- The APIs' licences cover their data, not the images. Key art, season posters and cast photos belong to the networks
  (Fandom marks no licence; Wikipedia marks them non-free). HANDOFF already has "rights to network key art are unconfirmed".
- The practical posture for a small free fan app:
  - small images only;
  - credit the source (TMDB needs its logo plus "uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise
    approved by TMDB" on an About or credits page; TVmaze's credit is already shown);
  - nothing that implies the network endorses the app;
  - a visible way to ask for removal;
  - a per-show switch back to initials and no art.
  
  The realistic risk is a takedown notice, and it grows once the app charges.
- **Fandom:** keep the ~200 px images it allows. Don't use `referrerPolicy="no-referrer"` to pull the full-size ones: it
  dodges a deliberate block, and when Fandom changes it the failure is a silent grey placeholder.
- **Going paid:** TMDB's free key ends (TMDB decides what counts as commercial). Either license TMDB (price on request;
  one unconfirmed third-party figure is $149 a month) or switch to TheTVDB (free under $50k revenue, weak casts) plus
  TVmaze. Their host makes that a clean cut. Vercel Hobby is non-commercial too, so going paid already means
  plan changes.

## Suggested build order

1. **Keyless, small:** read TVmaze's season `image` (already in `showListing`'s answer) into a new `show_seasons.art_url`.
   Cards use `COALESCE(season art, show art)`.
2. **Link TMDB:** a `TMDB_READ_TOKEN` env var (Vercel and `.env.local`, never committed). Add `shows.tmdb_id` and an
   optional `show_seasons.tmdb_season` for shows whose numbering differs (check The Challenge). Find the TMDB id from
   TVmaze's `externals` when a show is made or linked (`add-show.ts`, the desk's New show, `tv-listings.ts`'s next
   season), plus an admin "Find art" for existing shows such as Survivor.
3. **Art:** `shows.backdrop_url` and `shows.logo_url`, season posters, auto-picked; the "Choose art" sheet in Show
   settings; the header reads the backdrop. This retires the soft-poster noticed item.
4. **Cast photos:** after any cast is staged or imported, fill empty photos from TMDB by name, then TVmaze. Admin review
   shows each photo's source.
5. **Credits:** the TMDB logo and notice, the per-show off switch, a removal contact.
6. **Sports:** the cast prompt asks a sport show for Wikipedia links and team colours (Jolpica's field for F1). Photos
   and free logos come from Wikipedia, with credits.

Additive migrations only, as always; every reader keeps working when the new columns are empty.

## As built (2026-10-26, on `new-design`; not committed yet)

- **Migration 0139** (`shows.tmdb_id, backdrop_url, logo_url, art_by_hand, art_off, art_checked_at`; `show_seasons.art_url,
  art_by_hand, tmdb_season, photos_checked_at`). Art an admin had already set (not a TVmaze poster) is marked chosen by hand.
- **The pure half:** `src/lib/game/show-art.ts`. It picks art (English poster, wordless backdrop first, English logo) and
  reads credits as name and photo only (hosts, judges and guests left out; never order or counts). It matches names: any
  form, a short name, a nickname, first and last name, and each step counts only when exactly one person fits. It also says
  which photos may be replaced: none, a wiki icon or a TVmaze one; anything else someone chose stays.
  Tested by `tests/show-art.test.js`.
- **The network half:** `src/lib/server/show-art.ts`.
  - `linkTmdb` uses TVmaze's IMDb, then TheTVDB, ids, else a search by name and country.
  - `fillShowArt` and `fillSeasonArt` fill the art; `fillCastPhotos` fills photos from TMDB's season credits, then
    TVmaze's guest cast of episodes 1-2, or for a sport from Wikipedia (via Jolpica for F1, else a search checked against
    Wikidata). Then every league on an approved cast gets them.
  - `findArtLater` runs after the answer; `sweepArt` is the daily job's share; `deskArt`, `chooseArt`, `artAutomatic` and
    `setArtOff` back the desk.
- **When it runs:**
  - Add a show (a show nobody had added, or a season made from its listing);
  - Make it a game's Looks right;
  - the desk's New season;
  - the daily listings job (`run.art`), which also backfills the shows already here (Survivor and the rest) over a few days.
  - Each listing season also takes its own TVmaze poster when made (`add-show.ts listedSeason`).
- **What players see:** the show bar (tall and compact) uses the backdrop when there is one. Its fade keeps the name on
  the dark left; without a backdrop, the poster on the right as before. Cards and tiles use the season's own poster, else
  the show's (`show-space.ts seasonHeaders`, `way-in.ts catalog`, notifications, the desk's rulebooks). A show with art off
  draws none.
- **The desk:** the Show page has Art (`src/new/desk/art.tsx`):
  - the header and card images now, and where they came from;
  - Choose art (TMDB's header images and posters, the newest season's posters first; the chosen one ringed in white);
  - Back to automatic and Find art and photos;
  - "No art or photos", which takes down the art and found photos, in the games too, and stops looking.
  
  The classic admin's pasted art URL counts as chosen by hand.
- **Credits:** Settings › Help › Credits (`src/new/settings/credits.tsx`). It has TMDB's logo and its exact notice,
  TVmaze, Wikimedia Commons and Jolpica, the networks' ownership, and "Ask for something to come down" (Report a problem).
- **Checked:** `scripts/dev-test/check-show-art.js` runs live against TMDB, TVmaze, Wikipedia and Jolpica on `zt-art-`
  shows:
  - Survivor 51: 21 of 21 photos from the wiki's spellings;
  - TVmaze alone: 2 of 21, as TVmaze has;
  - F1 2026: 12 of 12;
  - NFL names incl. Josh Allen: 6 of 6, the right people.

  `scripts/dev-test/check-show-art-ui.js` passes 24 of 24 at 390 on new-fixture's zt couch: the finder, header, hub, Credits,
  the desk's Art, Choose art, back to automatic, off and on, real leagues unchanged. `npm test` 654 of 654; tsc clean;
  eslint on `src` shows only two problems in files this didn't touch.

## Noticed, not fixed

- **Athletes' photo credits are general, not per photo.** Commons' CC BY photos want each photographer named. Credits says
  where they come from and that each photo's page names its author. Before sports has real players, store each photo's
  author and licence (Wikipedia's `imageinfo` `extmetadata`, one batched call) and show it in the photo's zoom view.
  (For the step that builds sports for real.)
- **The cast prompt still asks the chat for a `photoUrl`** and, for a sport, not for Wikipedia links. The finder replaces
  missing or worse photos, and a hallucinated URL that loads stays as someone's choice. Asking for a Wikipedia link per
  athlete would settle common names the search can't. (For a cast-prompt pass.)
- **Season posters carry their own title art**, so the hub's Your shows card shows "SURVIVOR" from the poster under the
  card's set name. It reads fine, but a design pass may want those cards to crop lower or use the backdrop. (Studio/design
  step.)
- **Only the show bar uses the wide image.** Guide cards, This week's cards and watch-plan cards are wide too and still
  crop the poster. Worth a look once real shows have backdrops. (A later polish.)
- **Logos are stored, never drawn** (decision 4). Team logos for sports aren't fetched (teams keep their colour). (A design
  mock first.)
- **A sport show links to TMDB by name** too (Formula 1 found a TMDB entry with no images). Harmless, since a sport's
  photos come only from Wikipedia, but an admin may want to clear a wrong link. There's no control for that.

## Decisions (2026-10-26: the user went with the recommendations, and wants it done today)

1. **TMDB's free key now**, stored so its images can be removed in one step (by their host, `image.tmdb.org`). Decide between a TMDB licence
   and the TheTVDB/TVmaze switch only when the app goes paid. The user is signing up for the key; it goes in
   `.env.local` and Vercel as `TMDB_READ_TOKEN`, never in chat or the repo.
2. **Network art ships** with:
   - small images;
   - the TMDB logo and notice, and the TVmaze credit, on an About or credits page;
   - a way to ask for removal;
   - a per-show switch back to initials and no art.
3. **Automatic, with an admin override** ("Choose art" in Show settings). A hand-set value is never overwritten.
4. **Header:** the backdrop behind today's header and typeset name. Store the show's logo, but hold the logo-over-backdrop
   look until it's mocked.
5. **Sports is free:** Wikipedia/Wikidata (plus Jolpica for F1), not TheSportsDB.

## Sources

TMDB: [season 51 cast](https://www.themoviedb.org/tv/14658-survivor/season/51/cast),
[API terms](https://www.themoviedb.org/api-terms-of-use), [rate limiting](https://developer.themoviedb.org/docs/rate-limiting),
[image basics](https://developer.themoviedb.org/docs/image-basics). TVmaze: [API and licence](https://www.tvmaze.com/api).
TheTVDB: [API sign-up and pricing](https://thetvdb.com/api-information/signup). IMDb:
[non-commercial datasets](https://developer.imdb.com/non-commercial-datasets/),
[AWS listing](https://aws.amazon.com/marketplace/pp/prodview-yeuyizioqmfsy). Fandom: [licensing](https://www.fandom.com/licensing).
TheSportsDB: [documentation](https://www.thesportsdb.com/documentation), [pricing](https://www.thesportsdb.com/pricing),
[terms](https://www.thesportsdb.com/docs_terms_of_use.php). Wikimedia:
[reusing Commons content](https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia). Hosting:
[Vercel image optimisation limits](https://vercel.com/docs/image-optimization/limits-and-pricing),
[Cloudflare R2 pricing](https://filebase.com/blog/cloudflare-r2-pricing-costs-savings-and-alternatives-in-2026/) (secondhand;
check Cloudflare's page).

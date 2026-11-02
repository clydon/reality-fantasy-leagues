# React with a GIF (in place of Rate it), and I watched Episode X

The user, 2026-11-01: "There's nothing fun about rating just by stars. Instead let's rate an episode with a gif. The Reveal
Episode X will have a slide that follows data results and precedes game updates that show the gif reactions." Then, in the same
conversation, each call replacing the one before: an emoji (ten picks, 🏆🔥😂🍿🫣🤯😭😤🥱🤦‍♂️) plus a GIF was proposed and
dropped; **a reaction is one GIF, searched for freely, no rating at all**; **shelve Rate it**; **after you watch an episode, ask
for your GIF**. Then "Love it. Implement." on the mock, and: "if you are catching up, there needs to be a more prominent way to say
you watched episode X (and confirm just in case they misclicked)", on the main Tonight tab, open to mocks.

Mock (private Design canvas): https://claude.ai/artifact/7duhYx7EANctqciXV4475g. Row 1 the ask and yours-is-in, Tonight /
Episodes / Watch along; row 2 the reveal's slide; row 3 the three I-watched-it ideas (A, B, C below).

## Decisions

- **A reaction is one GIF**, anything you search for on KLIPY (the chat's picker, `ui/gif-sheet.tsx`, split into `GifPicker`
  and `GifSheet`). One per person per episode of a season; change it any time ("Pick another"); `{ gif: null }` takes it back.
  No score, no emoji, no preset shelves.
- **Rate it is shelved** (the user): stars, the couch verdict, the take, taste twin, Agree with the couch, the rating accolades
  (taste twins, the contrarian, never misses a rating), the hub's Couch verdicts page, Episodes' verdict marks, the watch along's
  stars, the profile's ratings line. `episode_ratings` and its rows stay (0128; backed up); nothing reads them but Couch points.
  The code is in git: the last commit with it is master's `05ffa5e5` (rate.tsx, lib/server/ratings.ts, lib/game/ratings.ts,
  the ratings and verdicts routes, tests/ratings.test.js).
- **My calls, open to the user** (the mock's notes): the couch's GIFs show whether or not you've added yours (Rate it made you
  rate first; this is casual-first); only people who've seen an episode see any GIF for it (a GIF can say who went home);
  someone else's only while they follow the show openly and share My episode GIFs; without a couch with someone else on it,
  only yours (strangers' never leave the server). No push when someone reacts.
- **The ask:** the GIF sheet opens by itself once you say you watched an episode (Tonight's I watched it, below; a watch
  along's React with a GIF), and the reveal has its own slide. Tonight's Extras keeps a row for the latest episode you've seen
  (React to Episode 5, or Your GIF for Episode 5 · See all).
- **The reveal's slide** "The couch reacts": after who went home, before your lineup, games and table; on a couch only (no slide
  solo). Yours wide (or "Yours goes here"), up to four of the couch's, "3 of 5 on the couch"; Add your GIF under the stage (the
  stage is one big Next button, so nothing to tap inside it). The sheet opens over the reveal (z-80 over its z-75).
- **What your couch sees:** "My episode ratings" became "My episode GIFs" (`share_gifs`, copied from `share_ratings` in 0162;
  `share_ratings` stays, unread). The switch's key is `gifs`.
- **Couch points:** an episode's GIF is worth what a rating was (kind `rating`, "A GIF for an episode"), and the ratings made
  before still count: one an episode either way.

## As built (branch `reactions`, lane `rfl-reactions`, port 3009, migration 0162)

- `db/migrations/0162_episode_gifs.sql`: `episode_gifs` (user, season, episode, gif jsonb), `user_settings.share_gifs`.
- `src/lib/server/episode-gifs.ts`: `episodeGifs`, `reactToEpisode` (KLIPY's hosts only, `gifs.ts` gifFrom; seen and aired as
  Rate it checked), `seasonGifs` (the Episodes read's `gifs: { n, mine, urls }`, in place of `verdict`).
- `GET/POST /api/seasons/[id]/gifs/[n]?couch=` (route answers `search`: whether GIFs are set up here).
- `src/new/show/react.tsx`: `openGif`, `EpisodeGifSheets` (mounted in the signed-in layout where RateSheets was), `GifTile`,
  `GifRow` (Tonight, the episode page), `GifStack` (Episodes rows), `GifsBeat` / `GifsAction` (the reveal), `showLabel` (the
  short show name the episode sheets use; was rate.tsx's `rateLabel`).
- `data.ts`: `useEpisodeGifs`, `episodeGifsApi.react`, `useAfterGif`.
- Landing (new and classic): the Rate it card is a React card (three tiles with names).
- Read-only (an admin acting as someone): `data-episode-gif`, `data-gif-row`, `data-watch-gif`, `data-gifs-add` are writes.
- Checks: `scripts/dev-test/check-gif-reactions.js` (new); Rate it's parts came out of check-new-episode-games.js, -sharing,
  -hub and -watch-along.

## I watched Episode X (on Tonight; waiting on the user's pick)

Today a show you only watch moves along only through the spoiler chip's Change (the Where you are sheet) or, in Keep me live,
the Seen it? card when an episode airs; nothing on Tonight says "I watched Episode 4" to someone catching up. On a show you play,
Reveal Episode N moves you along the moment it's tapped, so a stray tap spoils results. Three mocks (canvas row 3), each
confirming before anything moves, then opening the GIF sheet:

- **A, Up next plate:** a plate at the top of Tonight, "Up next for you · Episode 4", I watched Episode 4; a sheet asks
  "Watched all of Episode 4?" (Yes / Not yet).
- **B, catch-up rail:** the season as a rail (seen, next, aired, to come), a press-and-hold button; no second step.
- **C, the heading:** today's own-pace heading gets I watched it; it turns into Yes, watched / Oops, no in place.

On a show you play the same button would open the reveal on Yes. Built once the user picks.

## Noticed, not fixed

- The watch along's React with a GIF marks a show you only watch seen without a confirm (as its stars did): it's the end of
  watching it along, so it's on purpose; revisit with the I-watched-it confirm.
- `share_ratings` and `episode_ratings` stay in the database, unread but by Couch points; drop them in a later migration if
  Rate it never comes back.

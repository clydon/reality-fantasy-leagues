import { frameFor, framedUrl } from "@/lib/art-frame";

// Which art a season shows, for every query that hands one out (docs/PLAN-desk-parity.md part 7b; src/lib/art-frame.ts).

/** A season's cards: nothing while its show's art is off; the show's link over every season's own poster (shows.art_link);
 *  else the season's own poster, else the show's. `s` is the shows row's alias, `ss` the season's. */
export const cardArtSql = (s = "s", ss = "ss") =>
  `CASE WHEN ${s}.art_off THEN NULL WHEN ${s}.art_link THEN ${s}.art_url ELSE COALESCE(NULLIF(${ss}.art_url, ''), ${s}.art_url) END`;

/** The cards' art with its framing (shows.art_style), from the art drawn and the show's own poster. */
export const framedCard = (url: string | null | undefined, style: unknown, own: string | null | undefined) => framedUrl(url, frameFor(style, url, own));

/** The header's (shows.backdrop_url) with its framing (shows.backdrop_style). */
export const framedHeader = (url: string | null | undefined, style: unknown) => framedUrl(url, frameFor(style, url, url));

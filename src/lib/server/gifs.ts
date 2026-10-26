import { cleanGif, giphyUrl, type Gif } from "@/lib/game/watch-along";
import { HttpError } from "./db";

// GIFs for Watch along (docs/PLAN-new-design.md step 13 part 1): GIPHY's search and trending, asked from the server so its key stays
// here. Behind config, as Continue with Google is: no GIPHY_API_KEY, no GIFs (the watch along shows no GIF button and /api/gifs
// answers 404). Tenor, the plan's other choice, closed its API on 2026-06-30. GIPHY's own media hosts are the only pictures a GIF
// reaction may carry (watch-along.ts giphyUrl), and "Powered by GIPHY" goes under the picker (their attribution). A new key is a
// beta key (100 calls an hour): /api/gifs is kept at the edge an hour per search, so that's plenty for a few couches; more needs
// GIPHY's production key (docs/HOSTING.md).
//
// Checks never ask GIPHY: under `next dev`, a request from a loopback address naming a stand-in in its `x-gys-gifs` header
// (scripts/dev-test/fake-gifs.js) is asked instead, and its pictures' host is allowed too. Production never reads the header.

const GIPHY = "https://api.giphy.com";
const TIMEOUT_MS = 6000;
const LIMIT = 24;

export interface GifSource {
  base: string;
  key: string;
  /** A stand-in's origin, whose pictures a GIF may carry under `next dev`. */
  allow: string | null;
}

/** Where GIFs come from for this request: GIPHY with the key, a check's stand-in, or nowhere (null: no GIFs). */
export function gifsFor(req: Request): GifSource | null {
  if (process.env.NODE_ENV === "development") {
    const asked = req.headers.get("x-gys-gifs");
    if (asked) {
      try {
        const u = new URL(asked);
        if (u.protocol === "http:" && (u.hostname === "127.0.0.1" || u.hostname === "localhost")) return { base: u.origin, key: "zt-stand-in", allow: u.origin };
      } catch {
        /* not a URL: as for anyone */
      }
    }
  }
  const key = process.env.GIPHY_API_KEY?.trim();
  return key ? { base: GIPHY, key, allow: null } : null;
}

/** A GIF as it may be kept from this source (a stand-in's own pictures under `next dev`), or null. */
export function gifFrom(src: GifSource | null, g: unknown): Gif | null {
  if (!src) return null;
  const kept = cleanGif(g);
  if (kept) return kept;
  if (!src.allow || !g || typeof g !== "object") return null;
  const o = g as Record<string, unknown>;
  if (typeof o.url !== "string" || !o.url.startsWith(`${src.allow}/`)) return null;
  // The stand-in's picture: checked as GIPHY's would be, with its host swapped in.
  const as = cleanGif({ ...o, url: `https://media.giphy.com${o.url.slice(src.allow.length)}` });
  return as ? { ...as, url: o.url } : null;
}

export interface GifHit extends Gif {
  /** A smaller picture for the picker's grid. */
  preview: string;
}

type GiphyImage = { url?: string; webp?: string; width?: string; height?: string };
type GiphyGif = { id?: string; title?: string; images?: Record<string, GiphyImage | undefined> };

/** Trending (no words) or a search, rated PG-13 at most, up to 24. */
export async function searchGifs(src: GifSource, q: string): Promise<GifHit[]> {
  const words = q.replace(/\s+/g, " ").trim().slice(0, 50);
  const params = new URLSearchParams({ api_key: src.key, limit: String(LIMIT), rating: "pg-13", bundle: "messaging_non_clips" });
  if (words) {
    params.set("q", words);
    params.set("lang", "en");
  }
  let res: Response;
  try {
    res = await fetch(`${src.base}/v1/gifs/${words ? "search" : "trending"}?${params}`, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
  } catch {
    throw new HttpError(503, "GIFs didn't answer. Try again in a moment.");
  }
  if (!res.ok) throw new HttpError(503, res.status === 429 ? "Too many GIF searches this hour. Try again later." : "GIFs didn't answer. Try again in a moment.");
  const body = (await res.json().catch(() => ({}))) as { data?: GiphyGif[] };
  const out: GifHit[] = [];
  for (const g of body.data ?? []) {
    const im = g.images ?? {};
    const keep = im.fixed_width;
    const small = im.fixed_width_small ?? keep;
    const url = keep?.webp || keep?.url;
    const hit = gifFrom(src, { id: g.id, url, w: Number(keep?.width), h: Number(keep?.height), title: g.title ?? "" });
    const preview = small?.webp || small?.url;
    if (hit && preview && ((!!src.allow && preview.startsWith(`${src.allow}/`)) || giphyUrl(preview))) out.push({ ...hit, preview });
  }
  return out;
}

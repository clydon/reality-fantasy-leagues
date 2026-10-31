import { cleanGif, type Gif } from "@/lib/game/watch-along";
import { HttpError } from "./db";

// GIFs for Watch along and the couch chat (docs/PLAN-new-design.md step 13 part 1; KLIPY since 2026-10-31): KLIPY's search and
// featured, asked from the server so its key stays here. Behind config, as Continue with Google is: no KLIPY_API_KEY, no GIFs
// (no GIF button anywhere, and /api/gifs answers 404). The user's pick of the free options on 2026-10-31: Tenor closed its API on
// 2026-06-30, GIPHY's free key stays at 100 calls an hour (more is paid), and KLIPY's test key (100 an hour) becomes an unlimited
// production key on request in its Partner Panel, its ads optional (we show none). KLIPY's v2 API is Tenor's shape. KLIPY's own
// media hosts are the only pictures a GIF may carry (watch-along.ts gifUrl; GIPHY's still read for anything sent before), and
// "Powered by KLIPY" goes under the picker (their attribution). /api/gifs is kept at the edge an hour per search (docs/HOSTING.md).
//
// Checks never ask KLIPY: under `next dev`, a request from a loopback address naming a stand-in in its `x-gys-gifs` header
// (scripts/dev-test/fake-gifs.js) is asked instead, and its pictures' host is allowed too. Production never reads the header.

const KLIPY = "https://api.klipy.com";
const TIMEOUT_MS = 6000;
const LIMIT = 24;
/** Who's asking, as KLIPY's `client_key` names an integration. */
const CLIENT_KEY = "gameyourshow";

export interface GifSource {
  base: string;
  key: string;
  /** A stand-in's origin, whose pictures a GIF may carry under `next dev`. */
  allow: string | null;
}

/** Where GIFs come from for this request: KLIPY with the key, a check's stand-in, or nowhere (null: no GIFs). */
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
  const key = process.env.KLIPY_API_KEY?.trim();
  return key ? { base: KLIPY, key, allow: null } : null;
}

/** A GIF as it may be kept from this source (a stand-in's own pictures under `next dev`), or null. */
export function gifFrom(src: GifSource | null, g: unknown): Gif | null {
  if (!src) return null;
  const kept = cleanGif(g);
  if (kept) return kept;
  if (!src.allow || !g || typeof g !== "object") return null;
  const o = g as Record<string, unknown>;
  if (typeof o.url !== "string" || !o.url.startsWith(`${src.allow}/`)) return null;
  // The stand-in's picture: checked as KLIPY's would be, with its host swapped in.
  const as = cleanGif({ ...o, url: `https://static.klipy.com${o.url.slice(src.allow.length)}` });
  return as ? { ...as, url: o.url } : null;
}

export interface GifHit extends Gif {
  /** A smaller picture for the picker's grid. */
  preview: string;
}

type KlipyMedia = { url?: string; dims?: [number, number]; width?: number; height?: number };
type KlipyResult = { id?: string | number; title?: string; content_description?: string; media_formats?: Record<string, KlipyMedia | undefined> };

/** Featured (no words) or a search, rated PG-13 at most (KLIPY's `low` filter, Tenor's scale), up to 24. */
export async function searchGifs(src: GifSource, q: string): Promise<GifHit[]> {
  const words = q.replace(/\s+/g, " ").trim().slice(0, 50);
  const params = new URLSearchParams({
    key: src.key,
    client_key: CLIENT_KEY,
    limit: String(LIMIT),
    contentfilter: "low",
    media_filter: "mediumgif,gif,tinygif",
    locale: "en_US",
  });
  if (words) params.set("q", words);
  let res: Response;
  try {
    res = await fetch(`${src.base}/v2/${words ? "search" : "featured"}?${params}`, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
  } catch {
    throw new HttpError(503, "GIFs didn't answer. Try again in a moment.");
  }
  if (!res.ok) throw new HttpError(503, res.status === 429 ? "Too many GIF searches this hour. Try again later." : "GIFs didn't answer. Try again in a moment.");
  const body = (await res.json().catch(() => ({}))) as { results?: KlipyResult[] };
  const dims = (m: KlipyMedia | undefined) => (m?.dims ? m.dims : [Number(m?.width), Number(m?.height)]);
  const out: GifHit[] = [];
  for (const g of body.results ?? []) {
    const mf = g.media_formats ?? {};
    const keep = mf.mediumgif ?? mf.gif;
    const small = mf.tinygif ?? keep;
    const [w, h] = dims(keep);
    const hit = gifFrom(src, { id: String(g.id ?? ""), url: keep?.url, w: Math.round(w), h: Math.round(h), title: g.title || g.content_description || "" });
    const preview = small?.url;
    if (hit && preview && cleanGif({ ...hit, url: src.allow && preview.startsWith(`${src.allow}/`) ? `https://static.klipy.com${preview.slice(src.allow.length)}` : preview }))
      out.push({ ...hit, preview });
  }
  return out;
}

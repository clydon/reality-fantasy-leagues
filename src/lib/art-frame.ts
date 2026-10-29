import type { CSSProperties } from "react";

// A show's art, framed (docs/PLAN-desk-parity.md part 7b, Noticed x; the mock's desk-shows.js svImg). Each frame (the Header:
// shows.backdrop_url; the Cards: a season's poster, else the show's) has a framing: the point every crop keeps, in % of the
// image (object-position's percentages), and a zoom from that point. Stored on the show (shows.backdrop_style for the
// header, shows.art_style for the cards, beside classic's colour and strength) with the image it was framed on, so a new
// image (TMDB's better one, one chosen, a link) starts unframed. The cards' sits in art_style under `frame` ({ x, y, zoom,
// url }), beside classic's own top-level x, y and zoom: those have no image, framed the show's own poster (shows.art_url) as
// classic drew it, and still frame it wherever it's drawn. The header's (a column of its own) is { x, y, zoom, url }.
//
// It reaches every reader by riding on the image's address as a fragment ("…/poster.jpg#frame=64,50,1.25"): the server
// adds it (framedUrl) wherever it hands out a show's art, every screen that passes the address on carries it, and ShowArt
// (src/new/ui/show-bar.tsx) draws it. A browser never sends a fragment, so the image loads as it always did.

export interface Frame {
  /** The point the crop keeps, across, 0-100. */
  x: number;
  /** And down, 0-100. */
  y: number;
  /** 1, 1.25, 1.5 or 2: scaled up from that point. */
  zoom: number;
}

/** The zooms the desk offers. */
export const ZOOMS = [1, 1.25, 1.5, 2] as const;

export const CENTRED: Frame = { x: 50, y: 50, zoom: 1 };

/** How an unframed image is drawn: the cards centred; the header's backdrop a little above the middle (ShowBar's). */
export const UNFRAMED = { header: { x: 50, y: 30, zoom: 1 }, cards: CENTRED } as const satisfies Record<string, Frame>;

const num = (v: unknown, min: number, max: number): number | null => {
  const n = Number(v);
  return v === null || v === undefined || v === "" || !Number.isFinite(n) ? null : Math.min(max, Math.max(min, n));
};

/**
 * The framing a stored style gives the image drawn (`drawn`), or null when it doesn't frame it: none was set, or it was set
 * for another image. The desk's (`frame`, with its image) first; then the style's own x, y and zoom: on its `url`, else
 * classic's, which framed `own` (the show's poster), with classic's defaults for what it left out (centred across, 40% down,
 * no zoom).
 */
export function frameFor(style: unknown, drawn: string | null | undefined, own?: string | null): Frame | null {
  if (!drawn || !style || typeof style !== "object") return null;
  const s = style as Record<string, unknown>;
  if (s.frame && typeof s.frame === "object" && (s.frame as Record<string, unknown>).url === drawn) {
    const desk = frameFor(s.frame, drawn);
    if (desk) return desk;
  }
  const x = num(s.x, 0, 100);
  const y = num(s.y, 0, 100);
  const zoom = num(s.zoom, 1, 3);
  if (x === null && y === null && zoom === null) return null;
  const on = typeof s.url === "string" ? s.url : own;
  if (on !== drawn) return null;
  return { x: x ?? 50, y: y ?? 40, zoom: zoom ?? 1 };
}

/** A framing as the desk saves it: x and y whole percentages, the zoom one of ZOOMS. Null when it isn't one. */
export function cleanFrame(v: unknown): Frame | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const x = num(o.x, 0, 100);
  const y = num(o.y, 0, 100);
  const zoom = Number(o.zoom);
  if (x === null || y === null || !(ZOOMS as readonly number[]).includes(zoom)) return null;
  return { x: Math.round(x), y: Math.round(y), zoom };
}

const FRAGMENT = /#frame=(\d+(?:\.\d+)?),(\d+(?:\.\d+)?),(\d+(?:\.\d+)?)$/;

/** The image's address carrying its framing (none: as it is). */
export function framedUrl(url: string | null | undefined, frame: Frame | null): string | null {
  if (!url) return null;
  return frame ? `${url.replace(FRAGMENT, "")}#frame=${frame.x},${frame.y},${frame.zoom}` : url;
}

/** An address split into the image's own and the framing it carries. */
export function splitFrame(url: string | null | undefined): { src: string | null; frame: Frame | null } {
  if (!url) return { src: null, frame: null };
  const m = url.match(FRAGMENT);
  if (!m) return { src: url, frame: null };
  return { src: url.slice(0, m.index), frame: { x: Math.min(100, Number(m[1])), y: Math.min(100, Number(m[2])), zoom: Math.min(3, Math.max(1, Number(m[3]))) } };
}

/** An object-fit: cover image's style for a framing: its point kept, scaled from that point (the mock's svImg). */
export function frameStyle(frame: Frame): CSSProperties {
  const at = `${frame.x}% ${frame.y}%`;
  return frame.zoom > 1 ? { objectPosition: at, transform: `scale(${frame.zoom})`, transformOrigin: at } : { objectPosition: at };
}

/** "Centred", or "64% across, 50% down · 1.25× zoom" (the mock's svFrLine). */
export function frameLine(f: Frame): string {
  if (f.x === 50 && f.y === 50 && f.zoom === 1) return "Centred";
  return `${Math.round(f.x)}% across, ${Math.round(f.y)}% down${f.zoom > 1 ? ` · ${f.zoom}× zoom` : ""}`;
}

/**
 * Where the crop's window sits over the whole image, as fractions of it: an image of aspect `image` (width / height) in a
 * crop of aspect `crop`, covered, then zoomed from the framing's point. Its centre follows the point the crop keeps.
 */
export function frameWindow(f: Frame, image: number, crop: number): { left: number; top: number; width: number; height: number } {
  const width = Math.min(1, crop / image) / f.zoom;
  const height = Math.min(1, image / crop) / f.zoom;
  return { left: (1 - width) * (f.x / 100), top: (1 - height) * (f.y / 100), width, height };
}

/** The framing that puts the window's centre at (cx, cy), fractions of the whole image (a finger on the stage). */
export function frameAt(f: Frame, image: number, crop: number, cx: number, cy: number): Frame {
  const { width, height } = frameWindow(f, image, crop);
  const along = (c: number, size: number) => (size >= 1 ? 50 : Math.round(Math.min(1, Math.max(0, (c - size / 2) / (1 - size))) * 100));
  return { ...f, x: along(cx, width), y: along(cy, height) };
}

/** The style as classic reads it (x, y, zoom, colour and strength, on the show's own poster): the desk's framing in place of
 *  classic's when the desk framed that same poster, else classic's own as it was. */
export function classicArtStyle<T>(style: T, artUrl: string | null | undefined): T {
  if (!style || typeof style !== "object") return style;
  const { frame, ...own } = style as Record<string, unknown>;
  if (!frame || typeof frame !== "object") return style;
  const f = frame as Record<string, unknown>;
  const out = f.url === artUrl && artUrl ? { ...own, x: f.x, y: f.y, zoom: f.zoom } : own;
  return (Object.keys(out).length ? out : null) as T;
}

/** An image's address the desk takes for a link: https, a host with a dot, a path, no spaces, 2,000 characters at most. */
export function cleanArtLink(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t || t.length > 2000 || /\s/.test(t)) return null;
  try {
    const u = new URL(t);
    return u.protocol === "https:" && u.hostname.includes(".") && u.pathname.length > 1 ? u.toString() : null;
  } catch {
    return null;
  }
}

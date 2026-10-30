import { cleanFrame, frameLine } from "@/lib/art-frame";
import { isUuid, type SessionUser } from "./auth-helpers";
import { pool, tx, HttpError } from "./db";
import { logDesk } from "./desk";
import {
  artFromTmdb,
  artSnapshot,
  chooseArt,
  cleanArtLink,
  findArtForShow,
  putArtBack,
  setArtFrame,
  setArtLink,
  setArtOff,
  type ArtFrameKey,
  type ArtSnapshot,
} from "./show-art";

// A show's Art and photos on the desk (docs/PLAN-desk-parity.md part 7b; the mock's desk-shows.js svArtPage, svSrcSheet and
// svFrameSheet): for each frame, the Header and the Cards, where it's from (TMDB on its own, one chosen from TMDB, or a
// link) and its framing; Find art and photos again; and No art or photos. Each change is tier 1: a line in the show's
// History and Undo, which puts every art column back as it was (show-art.ts artSnapshot), refused once it's moved since.
// Find again has no Undo (it only fills what's missing). The finder and its columns are show-art.ts's.

const WORD: Record<ArtFrameKey, string> = { header: "Header", cards: "Cards" };
const hostOf = (url: string) => new URL(url).hostname.replace(/^www\./, "");

/** Same art, column for column (jsonb's own key order aside). */
const sameArt = (a: ArtSnapshot, b: ArtSnapshot) => JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));
function sorted(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sorted);
  if (v && typeof v === "object") return Object.fromEntries(Object.keys(v).sort().map((k) => [k, sorted((v as Record<string, unknown>)[k])]));
  return v;
}

/** Runs one art change (which says its History line and its toast) and writes its line, with Undo back to how it was. */
async function changed(user: SessionUser, id: string, action: string, run: () => Promise<{ line: string; text: string }>): Promise<{ changeId: string; text: string }> {
  const was = await artSnapshot(id);
  const { line, text } = await run();
  const now = await artSnapshot(id);
  const changeId = await logDesk(pool, { entity: "show", entityId: id, action, text: line, undo: { type: "showArt", id, was, now }, userId: user.id });
  return { changeId, text };
}

const frameKey = (v: unknown): ArtFrameKey => {
  if (v !== "header" && v !== "cards") throw new HttpError(400, "frame is header or cards");
  return v;
};

/**
 * `{ art: { … } }` on a show: `{ frame, tmdb: true }` (TMDB, on its own), `{ frame, link }` (an image's address),
 * `{ frame, x, y, zoom, url }` (its framing, on the image `url` it was set on), `{ choose: { poster | backdrop |
 * seasonId + seasonPoster } }` (Choose art), `{ find: true }` (Find art and photos again) and `{ off: boolean }`.
 */
export async function deskArtAction(user: SessionUser, id: string, a: Record<string, unknown>): Promise<{ changeId?: string; text: string }> {
  if (!isUuid(id)) throw new HttpError(404, "Show not found");
  const { rows } = await pool.query("SELECT art_off FROM shows WHERE id = $1", [id]);
  if (!rows.length) throw new HttpError(404, "Show not found");
  const off = rows[0].art_off as boolean;
  if (typeof a.off === "boolean") {
    if (a.off === off) throw new HttpError(409, off ? "Its art and photos are off already" : "Its art and photos are on already");
    if (a.off)
      return changed(user, id, "artOff", async () => {
        const { photos } = await setArtOff(id, true);
        const down = photos ? ` · ${photos} found photo${photos === 1 ? "" : "s"} down` : "";
        return { line: `No art or photos${down}`, text: `No art or photos · its name on a plain card${down}` };
      });
    return changed(user, id, "artOff", async () => {
      await setArtOff(id, false);
      return { line: "Art and photos back on", text: "Art and photos are back" };
    });
  }
  if (a.find === true) {
    if (off) throw new HttpError(409, "Its art and photos are off");
    const found = await findArtForShow(id);
    const what = [found.art ? "the show's art" : null, found.seasons ? `${found.seasons} season poster${found.seasons === 1 ? "" : "s"}` : null, found.photos ? `${found.photos} photo${found.photos === 1 ? "" : "s"}` : null].filter(Boolean);
    const text = what.length ? `Looked for art and photos: ${what.join(", ")}` : "Looked for art and photos: nothing new";
    await logDesk(pool, { entity: "show", entityId: id, action: "findArt", text, userId: user.id });
    return { text };
  }
  if (off) throw new HttpError(409, "Its art and photos are off: turn them back on first");
  if (a.choose && typeof a.choose === "object")
    return changed(user, id, "chooseArt", async () => {
      const what = await chooseArt(id, a.choose as Record<string, unknown>).catch((e) => {
        throw new HttpError(400, (e as Error).message);
      });
      return { line: `Chose ${what} from TMDB`, text: `${what[0].toUpperCase()}${what.slice(1)} is chosen · TMDB won't change it` };
    });
  const key = frameKey(a.frame);
  if (a.tmdb === true)
    return changed(user, id, "artTmdb", async () => {
      await artFromTmdb(id, key).catch((e) => {
        throw new HttpError(409, (e as Error).message);
      });
      return { line: `${WORD[key]} back to TMDB, on its own`, text: "Back to TMDB, on its own" };
    });
  if (a.link !== undefined) {
    const url = cleanArtLink(a.link);
    if (!url) throw new HttpError(400, "That doesn't look like an image's address: copy the image's address (https://…), not its page's");
    return changed(user, id, "artLink", async () => {
      await setArtLink(id, key, url);
      return { line: `${WORD[key]} from a link: ${hostOf(url)}`, text: `${WORD[key]}: your link · TMDB won't change it` };
    });
  }
  const f = cleanFrame(a);
  if (!f || typeof a.url !== "string") throw new HttpError(400, "tmdb, link, or a framing: x and y from 0 to 100, a zoom of 1, 1.25, 1.5 or 2, and the image's url");
  const url = a.url;
  return changed(user, id, "artFrame", async () => {
    await setArtFrame(id, key, f, url).catch((e) => {
      throw new HttpError(409, (e as Error).message);
    });
    return { line: `Framing of its ${key}: ${frameLine(f).toLowerCase()}`, text: "Framing saved · everywhere it shows" };
  });
}

/** History's Undo of an art change: every art column as it was, refused once anything's changed since. Undoing No art or
 *  photos turns them back on as they were and looks for the photos again. */
export async function restoreShowArt(u: Record<string, unknown>): Promise<void> {
  const id = String(u.id);
  const was = u.was as ArtSnapshot;
  await tx(async (db) => {
    const { rows } = await db.query("SELECT id FROM shows WHERE id = $1 FOR UPDATE", [id]);
    if (!rows.length) throw new HttpError(409, "That show was deleted");
    if (!sameArt(await artSnapshot(id, db), u.now as ArtSnapshot)) throw new HttpError(409, "Its art has changed since");
    await putArtBack(id, was, db);
  });
  const wasOff = was.show.art_off;
  const nowOff = (u.now as ArtSnapshot).show.art_off;
  // Back on: the photos it took down are looked for again. Back off: the photos found since come down too.
  if (!wasOff && nowOff) await findArtForShow(id).catch((e) => console.error("[desk-show-art] looking again:", e));
  if (wasOff && !nowOff) await setArtOff(id, true);
}

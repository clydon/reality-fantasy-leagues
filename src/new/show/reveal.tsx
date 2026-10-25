"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Send } from "lucide-react";
import { chatCouch, postToCouch, revealEpisode, useAfterReveal, type SeasonReveal } from "../data";
import { ordinal } from "../games";
import type { ShowData } from "../screens/show-space";
import { Avatar } from "../ui/bars";
import { usePushedPage } from "../ui/page";
import { Btn } from "../ui/parts";
import { Sheet } from "../ui/sheet";
import { ShowArt } from "../ui/show-bar";
import { toast } from "../ui/toast";
import { first } from "./moves";
import { Face } from "./parts";

// The one reveal (the mock's episode.js revealPlay, stages.js, share.js; docs/PLAN-new-design.md step 2): one
// broadcast per episode for every game you play on the show. Tapping Reveal asks the server to reveal it in all of
// them at once (POST /api/seasons/[id]/reveal: your progress moves, the chat hears it), and plays what comes back a
// beat at a time: the episode, what happened, who went home, your Weekly Lineup, your other games, the table
// moving. At the early stage (who went home only) the lineup reads "so far" and the pool's streaks move instead.
// The last beat offers Share your night: a post to the couch, or a card for outside it that leaves out who went home
// unless you say so. It's in the history (?page=reveal), so back closes it.

let asked: number | null = null;
const listeners = new Set<() => void>();

function ask(n: number) {
  asked = n;
  listeners.forEach((l) => l());
}

/** Opens the reveal of episode `n`. */
export function useOpenReveal() {
  const page = usePushedPage("reveal");
  return (n: number) => {
    ask(n);
    page.show();
  };
}

function useAsked() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => asked,
    () => null
  );
}

const noop = () => () => {};
const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0");

/** "Up to 1st", "Down to 3rd", "Still T2". */
export function headline(r: SeasonReveal): string {
  const me = r.table?.rows.find((x) => x.you);
  if (!me) return r.lineup ? `${signed(r.lineup.total)} in ${r.lineup.gameName}` : `Episode ${r.episode}`;
  const place = me.after.rank.startsWith("T") ? me.after.rank : ordinal(me.after.place);
  return me.after.place < me.before.place ? `Up to ${place}` : me.after.place > me.before.place ? `Down to ${place}` : `Still ${place}`;
}

export function RevealScreen({ show, seasonId }: { show: ShowData; seasonId: string }) {
  const page = usePushedPage("reveal");
  const n = useAsked() ?? show.episodes?.reveal?.episode ?? null;
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  if (!mounted) return null;
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-hidden={!page.open}
      aria-label="The reveal"
      className={`nd-fixed-x fixed inset-y-0 z-[75] flex flex-col bg-[#0b0a10] text-foreground transition-[opacity,visibility] duration-300 motion-reduce:transition-none ${
        page.open ? "visible opacity-100" : "invisible opacity-0"
      }`}
    >
      {page.open && n != null && <Broadcast key={n} show={show} seasonId={seasonId} n={n} onClose={page.close} />}
    </div>,
    document.body
  );
}

function Broadcast({ show, seasonId, n, onClose }: { show: ShowData; seasonId: string; n: number; onClose: () => void }) {
  const [r, setR] = useState<SeasonReveal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [k, setK] = useState(0);
  const [sharing, setSharing] = useState(false);
  const after = useAfterReveal();
  const asked = useRef(false);
  const name = (show.header?.show.name ?? "The show").replace(/^The /, "");

  useEffect(() => {
    // Once per episode (a second ask would only say "again").
    if (asked.current) return;
    asked.current = true;
    revealEpisode(seasonId, show.couch?.id ?? null, n)
      .then((res) => {
        setR(res);
        after();
      })
      .catch((e: Error) => setError(e.message));
  }, [seasonId, show.couch?.id, n, after]);

  const beats: { key: string; node: ReactNode }[] = r
    ? [
        { key: "open", node: <Opener r={r} show={show} /> },
        ...(r.happened.length ? [{ key: "happened", node: <Challenges r={r} /> }] : []),
        { key: "out", node: <VoteCards r={r} /> },
        ...(r.lineup ? [{ key: "lineup", node: <LineupBeat r={r} /> }] : []),
        ...(r.games.length + r.predictions.length ? [{ key: "games", node: <OtherGames r={r} /> }] : []),
        ...(r.table ? [{ key: "table", node: <TableBeat r={r} /> }] : []),
      ]
    : [];
  const last = beats.length > 0 && k >= beats.length - 1;
  const at = Math.min(k, Math.max(0, beats.length - 1));

  return (
    <>
      <div className="flex h-14 flex-none items-center justify-between px-4 pt-[env(safe-area-inset-top,0px)]">
        <span className="type-caption text-[15px] tracking-[0.04em] text-muted-foreground">{name}</span>
        {r && !last ? (
          <button type="button" onClick={() => setK(beats.length - 1)} className="h-11 px-2 text-[15px] font-bold">
            Skip
          </button>
        ) : (
          <button type="button" onClick={onClose} className="h-11 px-2 text-[15px] font-bold">
            Close
          </button>
        )}
      </div>
      <button
        type="button"
        data-stage
        aria-label={last ? "The last beat" : "Next"}
        onClick={() => !last && setK((x) => x + 1)}
        className="flex min-h-0 flex-1 flex-col justify-center overflow-hidden px-4 text-left"
      >
        {error ? (
          <p className="text-sm text-muted-foreground">{error}</p>
        ) : !r ? (
          <span aria-busy className="type-caption animate-pulse text-[22px] text-muted-foreground">
            Episode {n}
          </span>
        ) : (
          <div key={beats[at].key} data-beat={beats[at].key} className="nd-beat w-full">
            {beats[at].node}
          </div>
        )}
      </button>
      <div className="flex flex-none flex-col gap-2.5 px-4 pb-[calc(16px+env(safe-area-inset-bottom,0px))]">
        {beats.length > 1 && (
          <div className="mb-2 flex justify-center gap-1.5" aria-hidden>
            {beats.map((b, i) => (
              <i key={b.key} className={`h-1 w-[22px] rounded-[2px] transition-colors ${i <= at ? "bg-foreground" : "bg-secondary"}`} />
            ))}
          </div>
        )}
        {last && r && (
          <>
            <Btn wide onClick={() => setSharing(true)}>
              <Send className="size-[18px]" aria-hidden />
              Share your night
            </Btn>
            {r.next ? (
              <>
                {/* The next one in the same place: back still closes the reveal. */}
                <Btn tone="ink" wide onClick={() => ask(r.next!)}>
                  Reveal Episode {r.next}
                </Btn>
                <button type="button" onClick={onClose} className="h-11 text-[15px] font-semibold text-muted-foreground">
                  Back to {name}
                </button>
              </>
            ) : (
              <Btn tone="ink" wide onClick={onClose}>
                Back to {name}
              </Btn>
            )}
          </>
        )}
      </div>
      {r && <ShareSheet open={sharing} onOpenChange={setSharing} r={r} show={show} />}
    </>
  );
}

// ---------- the beats ----------

function Kicker({ children }: { children: ReactNode }) {
  return <span className="type-caption mb-3 block text-[15px] tracking-[0.06em] text-muted-foreground">{children}</span>;
}

function Opener({ r, show }: { r: SeasonReveal; show: ShowData }) {
  const season = show.header?.seasonNumber;
  return (
    <div>
      <Kicker>
        {(show.header?.show.name ?? "").replace(/^The /, "")}
        {season ? ` ${season}` : ""} · Episode {r.episode}
      </Kicker>
      {r.again && r.stage === "final" ? (
        <h2 className="type-caption text-[56px] leading-[.92]">
          Final scores
          <br />
          are in
        </h2>
      ) : (
        <h2 className="type-caption text-[56px] leading-[.92]">
          Previously
          <br />
          on the couch
        </h2>
      )}
      <p className="mt-4 text-[15px] text-muted-foreground">
        {r.stage === "early" ? "Early results: who went home. Weekly Lineup's full scores come later. " : ""}Tap anywhere to go on
      </p>
    </div>
  );
}

function Challenges({ r }: { r: SeasonReveal }) {
  return (
    <div>
      <Kicker>What happened</Kicker>
      <div className="flex flex-col gap-2.5">
        {r.happened.map((h, i) => (
          <div key={h.label} style={{ ["--i" as string]: i }} className="nd-beat-row flex min-h-[64px] items-stretch overflow-hidden rounded-[3px] bg-plate text-plate-foreground shadow-plate">
            <span className="type-caption -mr-[13px] flex w-[110px] flex-none items-center bg-secondary py-0 pl-3 pr-[22px] text-sm tracking-[0.04em] text-foreground [clip-path:polygon(0_0,100%_0,calc(100%_-_13px)_100%,0_100%)]">
              {h.label}
            </span>
            <span className="flex flex-1 flex-wrap items-center gap-1.5 py-2 pl-5 pr-3">
              {h.winners.map((w) => (
                <span
                  key={w.name}
                  className="type-caption rounded-[2px] px-2 py-0.5 text-[17px]"
                  style={w.colour ? { background: w.colour, color: "#121018" } : undefined}
                >
                  {w.name}
                </span>
              ))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function VoteCards({ r }: { r: SeasonReveal }) {
  if (!r.out.length) {
    return (
      <div>
        <Kicker>Episode {r.episode}</Kicker>
        <h2 className="type-caption text-[48px] leading-[.95]">Nobody went home</h2>
      </div>
    );
  }
  const two = r.out.length > 1;
  return (
    <div className={two ? "grid grid-cols-2 gap-2.5" : ""}>
      {r.out.map((c) => (
        <div key={c.id} data-out={c.name} className="nd-vote overflow-hidden rounded-[4px] bg-plate text-plate-foreground shadow-plate">
          <div className="relative">
            <Face src={c.photo} name={c.name} className={`w-full ${two ? "aspect-[3/4] text-[48px]" : "aspect-square max-h-[48dvh] text-[80px]"}`} />
            <span className="type-caption absolute bottom-0 left-0 bg-live py-1.5 pl-3 pr-6 text-[15px] tracking-[0.04em] text-live-foreground [clip-path:polygon(0_0,100%_0,calc(100%_-_12px)_100%,0_100%)]">
              {c.method ?? "Out"}
            </span>
          </div>
          <div className="px-3 pb-3 pt-2">
            <b className={`type-caption block leading-none ${two ? "text-[22px]" : "text-[34px]"}`}>{c.name}</b>
            {c.place && <small className="mt-1 block text-sm text-plate-muted">Finished {ordinal(c.place)}</small>}
          </div>
        </div>
      ))}
    </div>
  );
}

function LineupBeat({ r }: { r: SeasonReveal }) {
  const l = r.lineup!;
  return (
    <div>
      <Kicker>Your {l.gameName}</Kicker>
      <div className="flex flex-col gap-2">
        {l.starters.map((s, i) => (
          <div key={s.name} style={{ ["--i" as string]: i }} className="nd-beat-row flex items-center gap-3 rounded-[4px] bg-card p-2">
            <Face src={s.photo} name={s.name} className="size-12 flex-none rounded-[3px]" />
            <span className="min-w-0 flex-1">
              <b className="block text-[16px]">{first(s.name)}</b>
              <small className="block truncate text-[13px] text-muted-foreground">{s.why || "Nothing scored"}</small>
            </span>
            <b className={`type-num text-[26px] ${s.points > 0 ? "text-good" : s.points < 0 ? "text-live" : "text-muted-foreground"}`}>{signed(s.points)}</b>
          </div>
        ))}
        {!l.starters.length && <p className="text-[15px] text-muted-foreground">Nobody started this episode.</p>}
      </div>
      <div className="mt-5 flex items-baseline gap-3">
        <b className="type-num text-[64px] leading-none">{signed(l.total)}</b>
        {l.soFar && <small className="text-sm text-muted-foreground">so far · full scores to come</small>}
      </div>
    </div>
  );
}

function OtherGames({ r }: { r: SeasonReveal }) {
  const rows = [...r.games, ...r.predictions];
  return (
    <div>
      <Kicker>{r.lineup ? "Your other games" : "Your games"}</Kicker>
      {rows.map((g, i) => (
        <div key={`${g.leagueId}-${g.gameName}`} style={{ ["--i" as string]: i }} className="nd-beat-row border-t border-border py-3.5">
          <span className="type-caption block text-[13px] tracking-[0.06em] text-muted-foreground">{g.gameName}</span>
          <b className="mt-0.5 block text-[24px] font-bold leading-tight">{g.title}</b>
          {g.streak && g.streak.to > 0 ? (
            <span className="mt-1 flex items-baseline gap-1.5 text-[15px]">
              {g.streak.from !== g.streak.to && <s className="type-num text-[20px] text-muted-foreground">{g.streak.from}</s>}
              <b className="type-num text-[30px] text-good">{g.streak.to}</b>
              in a row
            </span>
          ) : (
            <small className="mt-0.5 block text-[15px] text-muted-foreground">{g.line}</small>
          )}
        </div>
      ))}
    </div>
  );
}

/** "You're 1st, 2 ahead of riley." "You're 3rd, 4 behind jordan." "You're tied 2nd with riley." */
function standingNote(r: SeasonReveal): string | null {
  const rows = [...(r.table?.rows ?? [])].sort((a, b) => a.after.place - b.after.place);
  const i = rows.findIndex((x) => x.you);
  if (i < 0) return null;
  const me = rows[i];
  const tied = rows.filter((x) => !x.you && x.after.place === me.after.place);
  if (tied.length) return `You're tied ${ordinal(me.after.place)} with ${tied.map((x) => x.name).join(" and ")}.`;
  const gap = (a: number, b: number) => Math.round(Math.abs(a - b) * 10) / 10;
  if (i === 0) return rows[1] ? `You're 1st, ${gap(me.after.total, rows[1].after.total)} ahead of ${rows[1].name}.` : "You're 1st.";
  return `You're ${ordinal(me.after.place)}, ${gap(rows[i - 1].after.total, me.after.total)} behind ${rows[i - 1].name}.`;
}

function TableBeat({ r }: { r: SeasonReveal }) {
  const t = r.table!;
  const [moved, setMoved] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setMoved(true), 700);
    return () => clearTimeout(id);
  }, []);
  const by = (key: "before" | "after") => [...t.rows].sort((a, b) => a[key].place - b[key].place || a.name.localeCompare(b.name)).map((x) => x.playerId);
  const order = by(moved ? "after" : "before");
  const ROW = 54;
  const shown = t.rows.slice(0, 6);
  return (
    <div>
      <Kicker>{t.gameName} standings</Kicker>
      <div data-table-move={moved ? "after" : "before"} className="relative" style={{ height: Math.min(shown.length, 6) * ROW }}>
        {t.rows.map((x) => {
          const idx = order.indexOf(x.playerId);
          if (idx >= 6) return null;
          const s = moved ? x.after : x.before;
          return (
            <div
              key={x.playerId}
              className={`absolute inset-x-0 flex h-[48px] items-center gap-3 rounded-[3px] px-3 transition-transform duration-700 ease-[cubic-bezier(.34,1.2,.64,1)] motion-reduce:transition-none ${
                x.you ? "z-[1] bg-plate text-plate-foreground" : "bg-card"
              }`}
              style={{ transform: `translateY(${idx * ROW}px)` }}
            >
              <span className="type-num w-8 text-[22px]">{s.rank}</span>
              <Avatar id={x.userId ?? x.playerId} name={x.name} size={28} />
              <b className="min-w-0 flex-1 truncate text-[16px]">{x.name}</b>
              <span className="type-num text-[24px]">{s.total}</span>
            </div>
          );
        })}
      </div>
      <p className={`mt-4 text-[15px] text-muted-foreground transition-opacity duration-500 ${moved ? "opacity-100" : "opacity-0"}`}>{standingNote(r)}</p>
    </div>
  );
}

// ---------- share your night ----------

/** The card's words: who it's from, the headline, and its line. */
function cardWords(r: SeasonReveal, show: ShowData, withOut: boolean) {
  const showName = `${(show.header?.show.name ?? "").replace(/^The /, "")}${show.header?.seasonNumber ? ` ${show.header.seasonNumber}` : ""}`;
  const line = [r.lineup ? `${signed(r.lineup.total)}${r.lineup.soFar ? " so far" : ""} in ${r.lineup.gameName}` : r.games[0]?.title, `${showName}, Episode ${r.episode}`]
    .filter(Boolean)
    .join(" · ");
  const out = withOut && r.out.length ? `${r.out.map((c) => c.name).join(" and ")} ${r.out.length > 1 ? "went home" : (r.out[0].method ?? "went home").toLowerCase()}` : null;
  return { tag: show.couch?.name ?? "On the couch", head: headline(r), line, out };
}

function ShareSheet({ open, onOpenChange, r, show }: { open: boolean; onOpenChange: (o: boolean) => void; r: SeasonReveal; show: ShowData }) {
  const [withOut, setWithOut] = useState(false);
  const [busy, setBusy] = useState(false);
  const words = cardWords(r, show, withOut);
  // The couch's chat about this show (none on your own: then only the image).
  const couchId = chatCouch(show);
  const seasonId = show.header?.seasonId ?? null;
  const post = async () => {
    if (!couchId || !seasonId) return;
    setBusy(true);
    try {
      await postToCouch(seasonId, couchId, [words.head, words.line, words.out].filter(Boolean).join(" · "));
      onOpenChange(false);
      toast("Posted to the couch chat");
    } catch (e) {
      toast(`Not posted: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };
  const image = async () => {
    try {
      const file = await cardImage(show, words);
      const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
      if (nav.canShare?.({ files: [file] })) await nav.share({ files: [file], title: words.head });
      else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(file);
        a.download = file.name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        toast("Saved the card");
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") toast(`Couldn't make the card: ${(e as Error).message}`);
    }
  };
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Share your night" subtitle={words.line.split(" · ").slice(-1)[0]}>
      <div data-share-card className="relative isolate mt-2 flex aspect-[4/5] max-h-[46dvh] w-full flex-col justify-between overflow-hidden rounded-[4px] p-3">
        {show.header && <ShowArt seasonId={show.header.seasonId} artUrl={show.header.show.artUrl} name={show.header.show.name} className="absolute inset-0 -z-[2] size-full" />}
        <span aria-hidden className="absolute inset-0 -z-[1] bg-[linear-gradient(180deg,rgba(16,14,21,.1),rgba(16,14,21,.55))]" />
        <span className="type-caption flex items-center text-[15px] text-white">
          Game
          <span className="mx-1 bg-white px-1.5 text-[#121018]">Your</span>
          Show
        </span>
        <div className="rounded-[3px] bg-plate p-3 text-plate-foreground shadow-plate">
          <span className="type-caption inline-block bg-plate-foreground py-[3px] pl-1.5 pr-3 text-[11px] tracking-[0.06em] text-plate [clip-path:polygon(0_0,100%_0,calc(100%_-_7px)_100%,0_100%)]">
            {words.tag}
          </span>
          <b className="type-caption mt-1 block text-[34px] leading-none">{words.head}</b>
          <small className="mt-1 block text-[13px] text-plate-muted">{words.line}</small>
          {words.out && <small data-share-out className="mt-0.5 block text-[13px] font-semibold text-live">{words.out}</small>}
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={withOut}
        onClick={() => setWithOut((x) => !x)}
        className="mt-3 flex min-h-[60px] w-full items-center gap-3 border-t border-border py-2 text-left"
      >
        <span className="min-w-0 flex-1">
          <b className="block text-[15px] font-semibold">Say who went home</b>
          <small className="block text-[13px] text-muted-foreground">{withOut ? "On: anyone who sees it is spoiled" : "Off, so you don't spoil anyone who hasn't watched"}</small>
        </span>
        <span className={`relative h-7 w-12 flex-none rounded-full transition-colors ${withOut ? "bg-good" : "bg-input"}`}>
          <i className={`absolute top-1 size-5 rounded-full bg-white transition-transform ${withOut ? "translate-x-6" : "translate-x-1"}`} />
        </span>
      </button>
      <div className={`mt-2 grid gap-2 pb-1 ${couchId ? "grid-cols-2" : ""}`}>
        <Btn onClick={image}>
          <Send className="size-[18px]" aria-hidden />
          Share image
        </Btn>
        {couchId && (
          <Btn tone="must" onClick={post} disabled={busy}>
            Post to the couch
          </Btn>
        )}
      </div>
    </Sheet>
  );
}

/** The card as an image (a 1080 × 1350 PNG): the show's art, the wordmark, the plate. Drawn on a canvas. */
async function cardImage(show: ShowData, w: { tag: string; head: string; line: string; out: string | null }): Promise<File> {
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#16141d";
  ctx.fillRect(0, 0, W, H);
  const art = show.header?.show.artUrl;
  if (art) {
    const img = new Image();
    img.src = art;
    await img.decode().catch(() => {});
    if (img.naturalWidth) {
      const scale = Math.max(W / img.naturalWidth, H / img.naturalHeight);
      const dw = img.naturalWidth * scale;
      const dh = img.naturalHeight * scale;
      ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
    }
  }
  const shade = ctx.createLinearGradient(0, 0, 0, H);
  shade.addColorStop(0, "rgba(16,14,21,.1)");
  shade.addColorStop(1, "rgba(16,14,21,.6)");
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, W, H);
  // The caption face the page uses, if it's loaded.
  const probe = document.createElement("span");
  probe.className = "type-caption";
  document.body.appendChild(probe);
  const caption = getComputedStyle(probe).fontFamily || "sans-serif";
  probe.remove();
  const body = getComputedStyle(document.body).fontFamily || "sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.font = `700 44px ${caption}`;
  ctx.fillText("GAME YOUR SHOW", 56, 96);
  const plateH = w.out ? 360 : 310;
  const y = H - 56 - plateH;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(56, y, W - 112, plateH);
  ctx.fillStyle = "#121018";
  ctx.fillRect(88, y + 32, Math.min(W - 176, ctx.measureText(w.tag.toUpperCase()).width + 48), 52);
  ctx.fillStyle = "#ffffff";
  ctx.font = `700 34px ${caption}`;
  ctx.fillText(w.tag.toUpperCase(), 104, y + 70);
  ctx.fillStyle = "#121018";
  ctx.font = `800 104px ${caption}`;
  ctx.fillText(w.head.toUpperCase(), 88, y + 188, W - 176);
  ctx.fillStyle = "#4a4558";
  ctx.font = `500 34px ${body}`;
  ctx.fillText(w.line, 88, y + 250, W - 176);
  if (w.out) {
    ctx.fillStyle = "#d63a4f";
    ctx.font = `600 34px ${body}`;
    ctx.fillText(w.out, 88, y + 302, W - 176);
  }
  const blob = await new Promise<Blob>((ok, no) => canvas.toBlob((b) => (b ? ok(b) : no(new Error("no image"))), "image/png"));
  return new File([blob], "my-night.png", { type: "image/png" });
}

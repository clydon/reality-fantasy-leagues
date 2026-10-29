"use client";

import { useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { Check, Crop, Flag, Image as ImageIcon, Lock, Search } from "lucide-react";
import { CENTRED, cleanArtLink, frameAt, frameLine, frameStyle, frameWindow, UNFRAMED, ZOOMS, type Frame } from "@/lib/art-frame";
import { paths } from "../routes";
import { Btn, EmptyState } from "../ui/parts";
import { Sheet } from "../ui/sheet";
import { useDesk, type ArtFrameKey, type DeskFrame, type DeskShow } from "./data";
import { ChoiceCard, DeskHeader, DeskRow, Field, IconLead, LatestHistory, Section, SwitchRow } from "./parts";
import { SeasonNumber, ShowDeleteRow, ShowThird, useShowChange } from "./shows";

// A show's Art and photos (docs/PLAN-desk-parity.md part 7b; the mock's desk-shows.js svArtPage, svSrcSheet, svFrameSheet and
// svCrops): the Header (its page and Up next) and the Cards (Your shows and the guide), each drawn in the crops it's used in,
// each with Where it's from (TMDB on its own, Recommended; Choose one from TMDB, the desk's Choose art; or A link, loaded and
// previewed before it's used) and its Framing (the whole image with the main crop's window over it, dragged or moved with the
// arrow keys, zoomed 1× to 2×, every crop redrawn as it moves). Then Cast photos by season, each to its Cast page, Find art and
// photos again, and No art or photos (for a removal request); History and the show's Delete, last. Each change is tier 1 with
// Undo (src/lib/server/desk-show-art.ts); the finder is show-art.ts's, the framing src/lib/art-frame.ts's.

/** Where each frame is used, and the crop's shape (width / height): the first is the one the framing window shows. */
const USE: Record<ArtFrameKey, [string, number][]> = {
  header: [
    ["Its page", 2.1],
    ["Up next", 1.08],
  ],
  cards: [
    ["Your shows", 0.707],
    ["The guide", 1.75],
  ],
};
const WORD: Record<ArtFrameKey, string> = { header: "Header", cards: "Cards" };
const NOTE = "mt-2.5 text-[13px] leading-snug text-muted-foreground";
const LINK = "inline-flex min-h-11 items-center text-[14px] font-bold underline decoration-input underline-offset-[3px]";
const bare = (url: string) => url.replace(/^https?:\/\/(www\.)?/, "");
const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

/** What a frame shows on the art page and in the frame's crops: its own image, or (a header with none) the cards'. */
function drawnOf(s: DeskShow, k: ArtFrameKey): { url: string | null; frame: Frame } {
  const own = s.art[k];
  if (k === "header" && !own.url) return { url: s.art.cards.url, frame: s.art.cards.frame ?? UNFRAMED.cards };
  return { url: own.url, frame: own.frame ?? UNFRAMED[k] };
}

/** One frame in the crops it's used in (the mock's svCrops). */
function Crops({ k, url, frame, name }: { k: ArtFrameKey; url: string | null; frame: Frame; name: string }) {
  return (
    <div data-crops={k} className="mb-1.5 flex items-end gap-2.5">
      {USE[k].map(([label, ratio], i) => (
        <figure key={label} data-crop={label} className={`m-0 min-w-0 ${(k === "header") === (i === 0) ? "flex-1" : k === "header" ? "w-[33%] flex-none" : "w-[30%] flex-none"}`}>
          <span className="relative block w-full overflow-hidden rounded-[3px] bg-card shadow-plate" style={{ aspectRatio: ratio }}>
            {url ? (
              // eslint-disable-next-line @next/next/no-img-element -- a show's art from wherever it was found
              <img src={url} alt="" className="absolute inset-0 size-full object-cover" style={frameStyle(frame)} />
            ) : (
              <b className="type-caption absolute inset-0 grid place-items-center p-2 text-center text-[17px] text-muted-foreground">{name}</b>
            )}
          </span>
          <figcaption className="mt-1.5 text-[12.5px] text-muted-foreground">{label}</figcaption>
        </figure>
      ))}
    </div>
  );
}

/** Where it's from, as its row says it (the mock's svSrc). */
function sourceLine(s: DeskShow, k: ArtFrameKey): ReactNode {
  const f = s.art[k];
  if (f.source === "link" && f.url)
    return (
      <>
        A link · <span className="break-all">{bare(f.url)}</span>
      </>
    );
  if (f.source === "chosen") return "Chosen from TMDB · TMDB won't change it";
  if (f.source === "tvmaze") return "TMDB, on its own · TVmaze's poster until TMDB has one";
  if (f.source === "tmdb") return k === "header" ? "TMDB, on its own · a backdrop without words first" : "TMDB, on its own · each season's own poster";
  if (!s.art.tmdb) return "TMDB isn't set up here · its name on a plain card";
  if (k === "header" && s.art.cards.url) return "TMDB, on its own · none yet, so its page shows the cards'";
  return "Nothing on TMDB yet · its name on a plain card";
}

const Loading = () => <div aria-busy className="mx-4 mt-6 h-64 animate-pulse rounded-[4px] bg-card" />;

export function ArtPage({ id }: { id: string }) {
  const q = useDesk<DeskShow>(`/shows/${id}`);
  const change = useShowChange(id);
  const [sheet, setSheet] = useState<{ k: ArtFrameKey; what: "source" | "frame" | "choose" } | null>(null);
  const [busy, setBusy] = useState(false);
  const back = { label: "Show", href: paths.deskItem("show", id) };
  if (q.error)
    return (
      <>
        <DeskHeader title="Art" back={back} name={null} />
        <EmptyState title="Not here" line={(q.error as Error)?.message ?? "It's gone."} />
      </>
    );
  if (!q.data)
    return (
      <>
        <DeskHeader title="Art" back={back} name={null} />
        <Loading />
      </>
    );
  const s = q.data;
  const a = s.art;
  const go = async (art: Record<string, unknown>) => {
    setBusy(true);
    await change({ art }).catch(() => {});
    setBusy(false);
  };
  const any = !!(a.header.url || a.cards.url);
  const linked = a.header.source === "link" ? "Its header from a link" : a.cards.source === "link" ? "Its cards from a link" : null;
  const chosen = a.header.source === "chosen" || a.cards.source === "chosen";
  const frame = (k: ArtFrameKey) => {
    const d = drawnOf(s, k);
    return (
      <Section title={WORD[k]} aside={k === "header" ? "On its own page" : "Posters and the guide"}>
        <Crops k={k} url={d.url} frame={d.frame} name={s.name} />
        {k === "header" && !a.header.url && a.cards.url && <p className="mb-1 text-[13px] leading-snug text-muted-foreground">No header of its own yet: its page and Up next show its cards&apos; art.</p>}
        <div className="border-b border-border">
          <DeskRow data={`art-${k}-source`} onClick={() => setSheet({ k, what: "source" })} lead={<IconLead icon={ImageIcon} />} title="Where it's from" line={sourceLine(s, k)} />
          {a[k].url && (
            <DeskRow data={`art-${k}-frame`} onClick={() => setSheet({ k, what: "frame" })} lead={<IconLead icon={Crop} />} title="Framing" line={frameLine(a[k].frame ?? UNFRAMED[k])} />
          )}
        </div>
      </Section>
    );
  };
  const sport = s.kind === "sport";
  return (
    <div className="pb-16" data-desk-art={a.off ? "off" : any ? "on" : "none"}>
      <DeskHeader title="Art" back={{ label: s.name, href: paths.deskItem("show", id) }} name="Art and photos" />
      <ShowThird
        s={s}
        lead={a.off ? null : a.cards.url}
        tag={a.off ? "Off" : any ? "Art" : "No art"}
        tone={a.off || !any ? "stopped" : "quiet"}
        detail={a.off ? "No art or photos anywhere" : !any ? "Nothing found yet" : (linked ?? (chosen ? "Chosen from TMDB" : "Found on its own"))}
      />
      {a.off ? (
        <section className="mt-5 px-4">
          <div data-art-off-panel className="rounded-[4px] p-3.5 outline-1 -outline-offset-1 outline-input">
            <b className="block text-[17px]">No art or photos</b>
            <small className="mt-1 block text-[14px] leading-snug text-muted-foreground">
              Everywhere shows {s.name}&apos;s name on a plain card, and its cast without photos. Nothing is looked for.
            </small>
            <Btn data-art-on wide className="mt-3" disabled={busy} onClick={() => void go({ off: false })}>
              Turn them back on
            </Btn>
          </div>
        </section>
      ) : (
        <>
          {frame("header")}
          {frame("cards")}
        </>
      )}
      <Section title="Cast photos">
        <div className="border-b border-border">
          {s.art.photos.slice(0, 3).map((x) => (
            <DeskRow
              key={x.id}
              data={`art-photos-${x.number}`}
              href={paths.deskSeasonPage(x.id, "cast")}
              lead={<SeasonNumber n={x.number} />}
              title={x.name}
              line={a.off ? "Off" : x.cast ? `${x.with} of ${x.cast} have photos · ${sport ? "Wikipedia" : "TMDB and TVmaze"}` : "No cast yet"}
            />
          ))}
          {!s.art.photos.length && <p className="py-3 text-[14px] text-muted-foreground">No seasons yet.</p>}
        </div>
        {!a.off && (
          <>
            <Btn data-art-find wide className="mt-3.5" disabled={busy} onClick={() => void go({ find: true })}>
              <Search className="size-[18px]" aria-hidden />
              {busy ? "Looking…" : "Find art and photos again"}
            </Btn>
            <p className={NOTE}>Looks on TMDB and TVmaze for anything missing. Art you chose or linked stays.</p>
          </>
        )}
      </Section>
      <Section title="Switch it off">
        <SwitchRow
          data="art-off"
          on={a.off}
          disabled={busy}
          title="No art or photos"
          line={a.off ? "On: its name on a plain card everywhere" : "For a show whose art shouldn't be shown"}
          onChange={(off) => void go({ off })}
        />
        <p className={NOTE}>TMDB&apos;s and TVmaze&apos;s are credited in Settings › Credits.</p>
      </Section>
      <LatestHistory lines={s.history} emptyLine="Nothing changed here yet." />
      <ShowDeleteRow s={s} />
      <SourceSheet
        open={sheet?.what === "source"}
        k={sheet?.k ?? "header"}
        s={s}
        onClose={() => setSheet(null)}
        onChoose={(k) => setSheet({ k, what: "choose" })}
        go={go}
      />
      <FrameSheet open={sheet?.what === "frame"} k={sheet?.k ?? "header"} s={s} onClose={() => setSheet(null)} go={go} />
      {sheet?.what === "choose" && <ChooseArt show={s} k={sheet.k} go={go} onClose={() => setSheet(null)} />}
    </div>
  );
}

// ---------- Where it's from ----------

function SourceSheet({
  open,
  k,
  s,
  onClose,
  onChoose,
  go,
}: {
  open: boolean;
  k: ArtFrameKey;
  s: DeskShow;
  onClose: () => void;
  onChoose: (k: ArtFrameKey) => void;
  go: (art: Record<string, unknown>) => Promise<void>;
}) {
  const f: DeskFrame = s.art[k];
  const [linking, setLinking] = useState(false);
  const [text, setText] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<{ url: string; w: number; h: number } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const shut = () => {
    setLinking(false);
    setText(null);
    setLoaded(null);
    setFailed(null);
    onClose();
  };
  const pick = linking || f.source === "link" ? "link" : f.source === "chosen" ? "choose" : "tmdb";
  const showLink = pick === "link";
  const typed = text ?? (f.source === "link" ? (f.url ?? "") : "");
  const url = cleanArtLink(typed);
  const ok = !!url && loaded?.url === url;
  const bad = !!typed.trim() && (!url || failed === url);
  const same = f.source === "link" && url === f.url;
  const options: [string, string, string][] = [
    ["tmdb", "TMDB, on its own", k === "header" ? "A backdrop without words first, then the most liked. It changes when TMDB has a better one." : "Each season's own poster, then the show's. It changes when TMDB has a better one."],
    ["choose", "Choose one from TMDB", k === "header" ? "Its backdrops, to pick from" : "Its posters and each season's, to pick from"],
    ["link", "A link", "Art from anywhere on the web, by the image's address"],
  ];
  return (
    <Sheet open={open} onOpenChange={(o) => !o && shut()} title={`${WORD[k]}: where it's from`} subtitle={s.name}>
      <div className="flex flex-col gap-2.5" data-art-source={k}>
        {options.map(([o, title, line]) => (
          <ChoiceCard
            key={o}
            on={pick === o}
            title={title}
            line={line}
            recommended={o === "tmdb"}
            attrs={{ "data-src": o }}
            onClick={() => {
              if (o === "tmdb") {
                // Back on its own only when something in it is held by hand; else it's there already.
                shut();
                if (f.held) void go({ frame: k, tmdb: true });
                return;
              }
              if (o === "choose") {
                if (!s.art.tmdb) return;
                shut();
                onChoose(k);
                return;
              }
              setLinking(true);
            }}
          />
        ))}
      </div>
      {showLink && (
        <div data-art-link className="mt-4">
          <Field
            data="art-link"
            label="The image's address"
            type="url"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            placeholder="https://…/key-art.jpg"
            value={typed}
            onChange={(e) => setText(e.target.value)}
            hint="Long-press the image and Copy Image Address: the address of the image, not of its page."
          />
          {url && loaded?.url !== url && failed !== url && (
            // Loaded out of sight first: only an address that opens as an image is offered.
            // eslint-disable-next-line @next/next/no-img-element -- the address being checked
            <img
              src={url}
              alt=""
              className="hidden"
              onLoad={(e) => setLoaded({ url, w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
              onError={() => setFailed(url)}
            />
          )}
          {ok && loaded ? (
            <div data-art-preview className="mt-3.5">
              <Crops k={k} url={url} frame={UNFRAMED[k]} name={s.name} />
              <p className={NOTE}>
                Loaded: {hostOf(url)} · {loaded.w} × {loaded.h}. Its framing starts {k === "cards" ? "centred" : "a little above the middle"}.
              </p>
            </div>
          ) : bad ? (
            <p data-art-link-bad className="mt-2.5 text-[14px] font-semibold leading-snug text-live">
              That doesn&apos;t look like an image&apos;s address. It ends in .jpg, .png or .webp: copy the image&apos;s address, not its page&apos;s.
            </p>
          ) : url ? (
            <p className={NOTE}>Loading it…</p>
          ) : null}
          <ul className="mt-4 flex flex-col gap-2.5">
            <Point icon={Lock}>A link stops TMDB changing it. TMDB, on its own undoes that.</Point>
            <Point icon={Flag}>Only art we&apos;re allowed to show. TMDB&apos;s is credited for us; a link isn&apos;t.</Point>
          </ul>
          <Btn
            data-art-use
            tone="must"
            wide
            className="mt-4"
            disabled={!ok || same}
            onClick={() => {
              if (!ok || same || !url) return;
              shut();
              void go({ frame: k, link: url });
            }}
          >
            Use this art
          </Btn>
        </div>
      )}
    </Sheet>
  );
}

const Point = ({ icon: Icon, children }: { icon: typeof Lock; children: ReactNode }) => (
  <li className="flex gap-2.5 text-[15px] leading-snug text-muted-foreground">
    <Icon className="mt-0.5 size-[18px] flex-none text-foreground" aria-hidden />
    <span>{children}</span>
  </li>
);

// ---------- Framing ----------

/** Framing (the mock's svFrameSheet): the whole image with the main crop's window over it; drag it, or the arrow keys, and
 *  zoom; every crop follows. x and y are object-position's percentages, so every crop agrees. */
function FrameSheet({ open, k, s, onClose, go }: { open: boolean; k: ArtFrameKey; s: DeskShow; onClose: () => void; go: (art: Record<string, unknown>) => Promise<void> }) {
  const own = s.art[k];
  const was = own.frame ?? UNFRAMED[k];
  const [draft, setDraft] = useState<Frame | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const f = draft ?? was;
  const shut = () => {
    setDraft(null);
    setSize(null);
    setDragging(false);
    onClose();
  };
  if (!own.url) return null;
  const url = own.url;
  const image = size ? size.w / size.h : k === "header" ? 16 / 9 : 2 / 3;
  const crop = USE[k][0][1];
  const win = frameWindow(f, image, crop);
  const at = (e: ReactPointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setDraft(frameAt(f, image, crop, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height));
  };
  const moved = f.x !== was.x || f.y !== was.y || f.zoom !== was.zoom;
  return (
    <Sheet open={open} onOpenChange={(o) => !o && shut()} title={`Framing: ${k === "header" ? "its header" : "its cards"}`} subtitle={s.name}>
      <div
        data-frame-stage={k}
        className={`relative w-full touch-none select-none overflow-hidden rounded-[3px] bg-black ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
        style={{ aspectRatio: image }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          setDragging(true);
          at(e);
        }}
        onPointerMove={(e) => {
          if (dragging) at(e);
        }}
        onPointerUp={() => setDragging(false)}
        onPointerCancel={() => setDragging(false)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- a show's art from wherever it was found */}
        <img src={url} alt={`${s.name}'s art, whole`} draggable={false} className="pointer-events-none absolute inset-0 size-full" onLoad={(e) => setSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} />
        <span
          data-frame-window
          tabIndex={0}
          role="slider"
          aria-label={`What the ${USE[k][0][0].toLowerCase()} crop keeps`}
          aria-valuetext={frameLine(f)}
          aria-valuenow={f.x}
          onKeyDown={(e) => {
            const d = ({ ArrowLeft: [-4, 0], ArrowRight: [4, 0], ArrowUp: [0, -4], ArrowDown: [0, 4] } as Record<string, [number, number]>)[e.key];
            if (!d) return;
            e.preventDefault();
            setDraft({ ...f, x: Math.min(100, Math.max(0, f.x + d[0])), y: Math.min(100, Math.max(0, f.y + d[1])) });
          }}
          className={`absolute shadow-[0_0_0_999px_rgba(10,9,14,.68)] outline-[1.5px] -outline-offset-1 outline-white/90 focus-visible:outline-[3px] focus-visible:-outline-offset-2 focus-visible:outline-chyron motion-safe:duration-[250ms] ${dragging ? "motion-safe:transition-[width,height]" : "motion-safe:transition-[left,top,width,height]"}`}
          style={{ left: `${win.left * 100}%`, top: `${win.top * 100}%`, width: `${win.width * 100}%`, height: `${win.height * 100}%` }}
        >
          {["left-[-2px] top-[-2px] border-l-[3px] border-t-[3px]", "right-[-2px] top-[-2px] border-r-[3px] border-t-[3px]", "bottom-[-2px] left-[-2px] border-b-[3px] border-l-[3px]", "bottom-[-2px] right-[-2px] border-b-[3px] border-r-[3px]"].map((c) => (
            <i key={c} aria-hidden className={`absolute size-4 border-white ${c}`} />
          ))}
        </span>
      </div>
      <p className={NOTE}>Drag the window to what every crop should keep: faces, the title. Arrow keys move it too.</p>
      <div className="mt-4">
        <span className="mb-1.5 block text-[14px] font-semibold text-muted-foreground">Zoom</span>
        <div className="flex gap-[3px] rounded-[3px] bg-background p-[3px] outline-1 -outline-offset-1 outline-input" role="radiogroup" aria-label="Zoom">
          {ZOOMS.map((z) => (
            <button
              key={z}
              type="button"
              role="radio"
              aria-checked={f.zoom === z}
              data-zoom={z}
              onClick={() => setDraft({ ...f, zoom: z })}
              className={`h-11 flex-1 rounded-[2px] text-[15px] font-bold ${f.zoom === z ? "bg-foreground text-background" : "text-muted-foreground"}`}
            >
              {z}×
            </button>
          ))}
        </div>
      </div>
      <div className="mb-2.5 mt-6 flex items-baseline justify-between gap-3">
        <h3 className="type-caption text-[17px] tracking-[0.04em] text-muted-foreground">Where it shows</h3>
        <button type="button" data-frame-middle onClick={() => setDraft({ ...CENTRED })} className={LINK}>
          Back to the middle
        </button>
      </div>
      <Crops k={k} url={url} frame={f} name={s.name} />
      <Btn
        data-frame-save
        tone="must"
        wide
        className="mt-4"
        disabled={!moved}
        onClick={() => {
          if (!moved) return;
          shut();
          void go({ frame: k, x: f.x, y: f.y, zoom: f.zoom, url });
        }}
      >
        Save the framing
      </Btn>
    </Sheet>
  );
}

// ---------- Choose one from TMDB ----------

interface Choice {
  kind: "poster" | "backdrop" | "logo";
  url: string;
  thumb: string;
  lang: string | null;
}
interface Choices {
  tmdb: boolean;
  linked: boolean;
  show: Choice[];
  season: Choice[];
}

/** The desk's Choose art, as built (docs/RESEARCH-show-art-and-cast-photos.md), for one frame: the header's backdrops, or the
 *  cards' posters, this season's own and the show's. */
function ChooseArt({ show, k, go, onClose }: { show: DeskShow; k: ArtFrameKey; go: (art: Record<string, unknown>) => Promise<void>; onClose: () => void }) {
  const season = show.seasons[0] ?? null;
  const q = useDesk<Choices>(`/shows/${show.id}/art${season ? `?season=${season.id}` : ""}`);
  const a = show.art;
  const seasonPoster = a.seasons.find((x) => x.id === season?.id)?.poster ?? null;
  const pick = (choose: Record<string, unknown>) => {
    onClose();
    void go({ choose });
  };
  const c = q.data;
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} title={`${WORD[k]}: choose one`} subtitle={`${show.name} · from TMDB`}>
      {!c ? (
        <div aria-busy className="h-48 animate-pulse rounded-[4px] bg-card" />
      ) : !c.linked ? (
        <p className="text-[15px] leading-snug text-muted-foreground">TMDB doesn&apos;t know this show, so there&apos;s nothing to choose from.</p>
      ) : (
        <div data-choose-art={k} className="flex flex-col gap-5">
          {k === "header" ? (
            <Group title="Header" line="Wide, behind the show's name. Ones without words look best.">
              <div className="grid grid-cols-2 gap-2">
                {c.show.filter((x) => x.kind === "backdrop").map((x) => (
                  <Pick key={x.url} choice={x} on={a.header.url === x.url} wide onPick={() => pick({ backdrop: x.url })} />
                ))}
              </div>
            </Group>
          ) : (
            <>
              {season && c.season.length > 0 && (
                <Group title={`Cards · ${season.name}`} line="This season's own poster, on its cards and tiles.">
                  <div className="grid grid-cols-3 gap-2">
                    {c.season.map((x) => (
                      <Pick key={x.url} choice={x} on={seasonPoster === x.url && a.cards.source !== "link"} onPick={() => pick({ seasonId: season.id, seasonPoster: x.url })} />
                    ))}
                  </div>
                </Group>
              )}
              <Group title="Cards · every season" line="The show's poster, for a season without its own.">
                <div className="grid grid-cols-3 gap-2">
                  {c.show.filter((x) => x.kind === "poster").map((x) => (
                    <Pick key={x.url} choice={x} on={a.poster === x.url} onPick={() => pick({ poster: x.url })} />
                  ))}
                </div>
              </Group>
            </>
          )}
        </div>
      )}
    </Sheet>
  );
}

function Group({ title, line, children }: { title: string; line: string; children: ReactNode }) {
  return (
    <section>
      <b className="block text-[16px]">{title}</b>
      <small className="mb-2 block text-[13px] leading-snug text-muted-foreground">{line}</small>
      {children}
    </section>
  );
}

function Pick({ choice, on, wide, onPick }: { choice: Choice; on: boolean; wide?: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      data-art-pick={choice.kind}
      onClick={onPick}
      className={`nd-press relative block overflow-hidden rounded-[3px] bg-card ${wide ? "aspect-video" : "aspect-[2/3]"} ${on ? "outline-2 outline-offset-2 outline-foreground" : ""}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- TMDB's image host */}
      <img src={choice.thumb} alt={choice.lang ? "With words" : "No words"} loading="lazy" className="size-full object-cover" />
      {on && (
        <span className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-foreground text-background">
          <Check className="size-4" aria-hidden />
        </span>
      )}
    </button>
  );
}

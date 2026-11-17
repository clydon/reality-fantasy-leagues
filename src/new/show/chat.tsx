"use client";

import dynamic from "next/dynamic";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Theme } from "emoji-picker-react";
import { ChevronRight, Eye, MessageCircle, Plus, Send } from "lucide-react";
import { openCouchSheet } from "../couch/couch-sheets";
import { NavLink } from "../nav";
import { paths } from "../routes";
import { chatEarlier, useChatActions, useCouchChat, type ChatLine, type CouchChat } from "../data";
import { GifSheet } from "../ui/gif-sheet";
import type { ShowData } from "../screens/show-space";
import { Avatar, useNow } from "../ui/bars";
import { Btn, CaptionPlate, EmptyState } from "../ui/parts";
import { useShown } from "../ui/loaded";
import { Sheet } from "../ui/sheet";
import { toast } from "../ui/toast";
import { useOpenReveal } from "./reveal";
import { useNight } from "../appearance";

// Chat (the mock's show.js tabChat and watching.js wChat; docs/PLAN-new-design.md step 4): the couch's one chat about
// this show (its games' chat, which classic shows as the linked group's, or the couch's own on a show it only
// watches), by day, with the reveal lines, reactions, and the composer above the tab bar. Folded past where you are
// on the server (couch-chat.ts): what others said since an episode you haven't seen aired arrives without its words,
// and shows as one dashed line with Reveal and Show them. Polls a version every 5 s while it's open. Earlier messages (step 15
// part 4): it opens on the newest 300; a tap at the top reads the 100 before (folded the same), and from then on the poll asks
// for everything since the earliest you've read back to, so it's one conversation that keeps updating.

const EmojiPicker = dynamic(() => import("emoji-picker-react"), { ssr: false });
const QUICK = ["👍", "❤️", "😂", "😮", "😢", "🔥"];
/** A run: the same person within ten minutes, under one name. */
const RUN_MS = 10 * 60_000;

// "Show them", per couch and show, for this visit: through the episode that was latest when you tapped.
const unfolds = new Map<string, number>();

const timeOf = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const dayKey = (iso: string) => new Date(iso).toDateString();

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric", year: d.getFullYear() === today.getFullYear() ? undefined : "numeric" });
}

/** "riley revealed episode 5" as the design says it: "riley revealed Episode 5". */
const revealWords = (text: string) => text.replace(/\b(episodes?)(?= \d)/i, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());

const names = (list: string[]) => (list.length <= 2 ? list.join(" and ") : `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`);

type Item =
  | { kind: "day"; key: string; label: string }
  | { kind: "ep"; key: string; n: number; at: string; sameDay: boolean }
  | { kind: "reveals"; key: string; n: number | null; day: string; lines: ChatLine[] }
  | { kind: "line"; m: ChatLine; starts: boolean; ends: boolean }
  | { kind: "fold"; key: string; lines: ChatLine[] };

/** The episode a reveal line is about ("riley revealed episode 4" → 4). */
const revealedEp = (m: ChatLine) => {
  const n = /(\d+)\s*$/.exec(m.text ?? "")?.[1];
  return n ? Number(n) : null;
};

/**
 * The conversation as rows: a day line where the day changes, runs of one person, and every folded message as one
 * line where the first of them was (the mock's one fold), so your own and the reveal lines keep their places.
 */
/**
 * The stream (the design round's step 9): days, with each episode's airing as a landmark where it falls in time ("Ep 5 · aired Wed
 * 8:00 PM": public, so it spoils nothing), so anywhere you scroll the nearest landmark above says which episode the talk is about.
 * A landmark right after a day's divider stands in for it (it carries the day). Reveal lines in a row about the same episode are
 * one line, the names together. `airings`: the episodes that have aired, oldest first.
 */
function itemsOf(messages: ChatLine[], airings: { n: number; at: string }[] = [], foldEp: number | null = null): Item[] {
  const out: Item[] = [];
  const folded = messages.filter((m) => m.folded);
  let day: string | null = null;
  // Only the airings inside the conversation's span: none before its first message.
  const first = messages[0] ? Date.parse(messages[0].at) : Infinity;
  const marks = airings.filter((a) => Date.parse(a.at) >= first);
  let k = 0;
  messages.forEach((m, i) => {
    const prev = messages[i - 1];
    const next = messages[i + 1];
    if (m.folded && m !== folded[0]) return;
    // Every airing up to this message's time, in order, each where it falls; one on a new day carries that day (it says when it
    // aired), so the day's own divider isn't drawn too.
    while (k < marks.length && Date.parse(marks[k].at) <= Date.parse(m.at)) {
      const a = marks[k++];
      const sameDay = dayKey(a.at) === day;
      day = dayKey(a.at);
      out.push({ kind: "ep", key: `e-${a.n}`, n: a.n, at: a.at, sameDay });
    }
    // A reveal line doesn't start a day of its own: it carries its day ("Fri · riley and jordan revealed Ep 4"), and one about the
    // episode a fold is for isn't drawn (the fold says who's revealed it).
    if (m.type === "reveal" && !m.folded) {
      const n = revealedEp(m);
      if (foldEp != null && n === foldEp) return;
      const last = out[out.length - 1];
      if (last?.kind === "reveals" && last.n === n) last.lines.push(m);
      else out.push({ kind: "reveals", key: `r-${m.id}`, n, day: dayLabel(m.at), lines: [m] });
      return;
    }
    if (dayKey(m.at) !== day) {
      day = dayKey(m.at);
      out.push({ kind: "day", key: `d-${m.id}`, label: dayLabel(m.at) });
    }
    if (m.folded) {
      out.push({ kind: "fold", key: `f-${m.id}`, lines: folded });
      return;
    }

    const sameRun = (a?: ChatLine, b?: ChatLine) =>
      !!a && !!b && !a.folded && !b.folded && a.type === "message" && b.type === "message" && a.userId === b.userId && dayKey(a.at) === dayKey(b.at) && Math.abs(Date.parse(b.at) - Date.parse(a.at)) < RUN_MS;
    out.push({ kind: "line", m, starts: !sameRun(prev, m), ends: !sameRun(m, next) });
  });
  // A landmark only where talk (a message or the fold) follows it before the next landmark: a run of airings nobody talked about
  // collapses into the last of them, and an episode inside a fold isn't marked.
  return out.filter((it, i) => {
    if (it.kind !== "ep") return true;
    for (let j = i + 1; j < out.length && out[j].kind !== "ep"; j++) if (out[j].kind === "line" || out[j].kind === "fold") return true;
    return false;
  });
}

export function Chat({ seasonId, show }: { seasonId: string; show: ShowData }) {
  const couchId = show.couch?.id ?? null;
  const unfoldKey = `${seasonId}:${couchId}`;
  const [unfold, setUnfold] = useState<number | null>(() => unfolds.get(unfoldKey) ?? null);
  // Earlier messages: where the conversation's read from once you've read back, and the page that's shown until that read is in
  // (the last read stands in meanwhile). Once it's in it starts at that message, or at the next one if it's been deleted.
  const [since, setSince] = useState<Pick<ChatLine, "id" | "at"> | null>(null);
  const [page, setPage] = useState<{ messages: ChatLine[]; more: boolean } | null>(null);
  const [reading, setReading] = useState(false);
  const chat = useCouchChat(seasonId, couchId, unfold, since);
  const actions = useChatActions(seasonId, couchId);
  const openReveal = useOpenReveal();
  const [open, setOpen] = useState<ChatLine | null>(null);
  const [gifOpen, setGifOpen] = useState(false);
  const data = chat.data && "messages" in chat.data ? chat.data : null;
  const read = data?.messages ?? [];
  const waiting = !!page && chat.isPlaceholderData && read[0]?.id !== since?.id;
  const messages = waiting ? [...page.messages, ...read.filter((m) => !page.messages.some((p) => p.id === m.id))] : read;
  const more = waiting ? page.more : !!data?.more;
  // Reading back keeps your place: the page grows above you.
  const keep = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (keep.current == null) return;
    window.scrollTo({ top: document.documentElement.scrollHeight - keep.current, behavior: "instant" });
    keep.current = null;
  }, [messages.length]);
  const earlier = async () => {
    const first = messages[0];
    if (!first || reading || !couchId) return;
    setReading(true);
    try {
      const got = await chatEarlier(seasonId, couchId, first, unfold);
      if ("messages" in got && got.messages.length) {
        keep.current = document.documentElement.scrollHeight - window.scrollY;
        setPage({ messages: [...got.messages, ...messages], more: got.more });
        setSince(got.messages[0]);
      } else if ("messages" in got) setPage({ messages, more: false });
    } catch (e) {
      toast.quiet(`Didn't load: ${(e as Error).message}`);
    } finally {
      setReading(false);
    }
  };

  // Opens at the newest message and keeps up with new ones, unless you've scrolled up to read back.
  const atBottom = useRef(true);
  const placed = useRef(false);
  useEffect(() => {
    const onScroll = () => {
      const el = document.documentElement;
      atBottom.current = el.scrollHeight - window.scrollY - window.innerHeight < 140;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const newest = messages[messages.length - 1]?.at ?? null;
  // Once it's on screen (ui/loaded.tsx: hidden, the page has none of its height).
  const shown = useShown();
  useLayoutEffect(() => {
    if (!data || !shown) return;
    if (!placed.current || atBottom.current) window.scrollTo({ top: document.documentElement.scrollHeight, behavior: placed.current ? "smooth" : "instant" });
    placed.current = true;
  }, [data, messages.length, shown]);

  // What's on screen is read: the badge clears here and in classic.
  const readUpTo = useRef<string | null>(null);
  useEffect(() => {
    if (!newest || !data?.you.canPost || readUpTo.current === newest || document.visibilityState !== "visible") return;
    readUpTo.current = newest;
    actions.read(newest).catch(() => {});
  }, [newest, data?.you.canPost]); // eslint-disable-line react-hooks/exhaustive-deps

  const showName = show.header ? `${show.header.show.name}${show.header.seasonNumber ? ` ${show.header.seasonNumber}` : ""}` : "this show";
  // One line above the keyboard: the show is in the bar (step 9).
  const placeholder = "Message the couch";
  const now = useNow(false);
  const airings = (show.episodes?.episodes ?? [])
    .filter((e) => e.airAt && Date.parse(e.airAt) <= now)
    .map((e) => ({ n: e.number, at: e.airAt! }))
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const epWord = show.words.ep;
  // The episodes you've seen: a landmark for one opens its page (the drill pass, 2026-11-17).
  const seen = new Set((show.episodes?.episodes ?? []).filter((x) => x.status === "seen").map((x) => x.number));

  if (chat.data && "out" in chat.data) {
    return (
      <div className="px-4 pt-5">
        <CaptionPlate
          tag="Replay"
          tone="quiet"
          title="Chat opens later"
          subtitle="The couch is talking about episodes you haven't seen. It opens when you're caught up and in the game."
        />
      </div>
    );
  }
  if (!data) {
    return chat.error ? (
      <EmptyState icon={MessageCircle} title="Chat didn't load" line={(chat.error as Error).message} />
    ) : (
      <div aria-busy className="animate-pulse px-4 pt-6">
        <div className="h-12 w-3/5 rounded-[4px] bg-card" />
        <div className="ml-auto mt-3 h-12 w-1/2 rounded-[4px] bg-card" />
        <div className="mt-3 h-12 w-2/3 rounded-[4px] bg-card" />
      </div>
    );
  }

  const showThem = () => {
    if (!data.fold) return;
    unfolds.set(unfoldKey, data.fold.latest);
    setUnfold(data.fold.latest);
  };
  const reveal = show.episodes?.reveal?.episode ?? null;

  return (
    <div data-chat className="px-4 pb-4 pt-1">
      {more && (
        <div className="flex justify-center pb-1 pt-3">
          <Btn data-earlier className="h-10 px-4 text-[14px]" disabled={reading} onClick={earlier}>
            {reading ? "Loading…" : "Earlier messages"}
          </Btn>
        </div>
      )}
      {messages.length === 0 && (
        <div className="py-14 text-center">
          <p className="type-caption text-[22px]">No messages yet</p>
          <p className="mt-1.5 text-[15px] text-muted-foreground">Say something to the couch about {showName}.</p>
        </div>
      )}
      {itemsOf(messages, airings, data.fold && !data.fold.byMark ? data.fold.episode : null).map((item) => {
        if (item.kind === "ep") {
          // The episode's landmark: its chip in the app's episode form, when it aired; unlike a day's divider at a glance.
          return (
            <div key={item.key} data-ep-mark={item.n} role={seen.has(item.n) ? undefined : "separator"} className="mb-1.5 mt-5 flex items-center gap-2.5">
              {seen.has(item.n) ? (
                // The episode itself (who left, what happened); a taller link than its chip, for the thumb.
                <NavLink href={`${paths.show(seasonId, "episodes")}?page=ep${item.n}`} data-ep-door={item.n} className="nd-press -my-2 -mr-1 flex-none py-2">
                  <span className="type-caption flex h-7 items-center gap-0.5 bg-secondary pl-2.5 pr-3.5 text-[14px] tracking-[0.04em] [clip-path:polygon(0_0,100%_0,calc(100%_-_8px)_100%,0_100%)]">
                    {epWord} {item.n}
                    <ChevronRight className="size-3.5 text-muted-foreground" aria-hidden />
                  </span>
                </NavLink>
              ) : (
                <span className="type-caption -mr-1 flex h-7 items-center bg-secondary pl-2.5 pr-3.5 text-[14px] tracking-[0.04em] [clip-path:polygon(0_0,100%_0,calc(100%_-_8px)_100%,0_100%)]">
                  {epWord} {item.n}
                </span>
              )}
              <span className="flex-none text-[13px] text-muted-foreground">
                aired {item.sameDay ? timeOf(item.at) : `${dayLabel(item.at)} · ${timeOf(item.at)}`}
              </span>
              <i className="h-px flex-1 bg-border" aria-hidden />
            </div>
          );
        }
        if (item.kind === "reveals") {
          const who = names(item.lines.map((m) => m.name));
          return (
            <button key={item.key} type="button" data-reveal-line onClick={() => setOpen(item.lines[0])} title={timeOf(item.lines[0].at)} className="my-3 flex w-full items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <Eye className="size-3.5" aria-hidden />
              {item.day} · {item.n != null ? `${who} revealed ${epWord} ${item.n}` : revealWords(item.lines[0].text ?? "")}
            </button>
          );
        }
        if (item.kind === "day") {
          return (
            <div
              key={item.key}
              data-day
              role="separator"
              className="mb-1.5 mt-4 flex items-center gap-2.5 text-[13px] text-muted-foreground before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border"
            >
              {item.label}
            </div>
          );
        }
        if (item.kind === "fold") return <Fold key={item.key} lines={item.lines} fold={data.fold} reveal={reveal} epWord={epWord} onShow={showThem} onReveal={openReveal} />;
        return <Line key={item.m.id} item={item} me={data.you.userId} couchId={couchId} onOpen={() => setOpen(item.m)} onReact={(e) => actions.react(item.m.id, e).catch((err) => toast.quiet(`Not sent: ${err.message}`))} />;
      })}
      {data.you.canPost && <Composer placeholder={placeholder} onGif={data.gifs ? () => setGifOpen(true) : undefined} onSend={async (text) => {
        atBottom.current = true;
        await actions.post(text);
      }} />}
      <MessageSheet m={open} chat={data} onClose={() => setOpen(null)} actions={actions} />
      {data.gifs && (
        <GifSheet
          open={gifOpen}
          subtitle={`To the couch about ${showName.replace(/^The /, "")}`}
          onOpenChange={setGifOpen}
          onPick={(g) => {
            setGifOpen(false);
            atBottom.current = true;
            actions.post("", g).catch((e) => toast.quiet(`Not sent: ${(e as Error).message}`));
          }}
        />
      )}
    </div>
  );
}

/** One message, or a reveal line. */
function Line({ item, me, couchId = null, onOpen, onReact }: { item: Extract<Item, { kind: "line" }>; me: string; couchId?: string | null; onOpen: () => void; onReact: (emoji: string) => void }) {
  const { m, starts, ends } = item;
  if (m.type === "reveal") {
    return (
      <button type="button" data-reveal-line onClick={onOpen} title={timeOf(m.at)} className="my-3.5 flex w-full items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <Eye className="size-3.5" aria-hidden />
        {revealWords(m.text ?? "")}
      </button>
    );
  }
  const mine = m.userId === me;
  const reactions = Object.entries(m.reactions);
  // The face sits beside the run's last bubble; reactions go under the bubble, clear of it.
  return (
    <div data-msg={m.id} className={`${starts ? "mt-2.5" : "mt-1"} ${ends ? "mb-0.5" : ""}`}>
      <div className={`flex items-end gap-2 ${mine ? "justify-end" : ""}`}>
        {/* Someone's face opens them on the couch: where they're up to, their games (the drill pass, 2026-11-17). */}
        {!mine &&
          (ends ? (
            couchId && m.userId ? (
              <button type="button" data-door-person={m.userId} aria-label={`${m.name}: on the couch`} onClick={() => openCouchSheet({ kind: "person", couchId, userId: m.userId! })} className="nd-press flex-none rounded-full">
                <Avatar id={m.userId} name={m.name} size={28} />
              </button>
            ) : (
              <Avatar id={m.userId ?? m.name} name={m.name} size={28} />
            )
          ) : (
            <span className="w-7 flex-none" aria-hidden />
          ))}
        <button
          type="button"
          onClick={onOpen}
          aria-haspopup="dialog"
          className={`max-w-[78%] whitespace-pre-wrap break-words rounded-[4px] text-left text-[15px] leading-[1.35] [overflow-wrap:anywhere] ${
            // A GIF of yours shows bare; someone else's keeps a slim card for their name over it.
            m.gif ? (mine ? "" : "bg-card p-1.5") : `px-[11px] py-2 ${mine ? "bg-foreground text-background" : "bg-card"}`
          }`}
        >
          {!mine && starts && (
            <small className={`mb-0.5 flex items-baseline gap-1.5 text-[11px] font-bold text-muted-foreground ${m.gif ? "px-1 pt-0.5" : ""}`}>
              {m.name}
              <time dateTime={m.at} className="font-medium">
                {timeOf(m.at)}
              </time>
            </small>
          )}
          {m.gif ? (
            // eslint-disable-next-line @next/next/no-img-element -- a GIF from KLIPY's own hosts (0156)
            <img data-chat-gif src={m.gif.url} alt={m.gif.title || "GIF"} className="block max-h-[200px] w-[200px] max-w-full rounded-[3px] object-cover" style={{ aspectRatio: `${m.gif.w} / ${m.gif.h}` }} />
          ) : (
            m.text
          )}
          {m.edited && <span className="ml-1.5 text-[12px] opacity-60">edited</span>}
        </button>
      </div>
      {reactions.length > 0 && (
        <div className={`mt-1 flex flex-wrap gap-1 ${mine ? "justify-end" : "pl-9"}`}>
          {reactions.map(([emoji, r]) => {
            const yours = r.userIds.includes(me);
            return (
              <button
                key={emoji}
                type="button"
                aria-pressed={yours}
                aria-label={`${emoji} ${r.count}${yours ? ", including you" : ""}`}
                onClick={() => onReact(emoji)}
                className={`inline-flex h-8 items-center gap-1 rounded-[3px] border bg-card px-2 text-[14px] ${yours ? "border-foreground" : "border-border"}`}
              >
                <span aria-hidden>{emoji}</span>
                <span className="type-num text-[14px]" aria-hidden>
                  {r.count}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Messages folded for you: who said something since an episode you haven't seen aired (or, on a season watched at its own
 *  pace, who had seen further than you when they wrote), and the way to see them. */
function Fold({
  lines,
  fold,
  reveal,
  epWord,
  onShow,
  onReveal,
}: {
  lines: ChatLine[];
  fold: CouchChat["fold"];
  reveal: number | null;
  epWord: string;
  onShow: () => void;
  onReveal: (n: number) => void;
}) {
  const who = [...new Set(lines.map((l) => l.name))];
  const count = lines.length;
  // The landmark above says which episode (step 9): the fold says how many, and who's seen it.
  const title = `${count} ${count === 1 ? "message" : "messages"}${!fold ? "" : fold.byMark ? " from further along" : ` since ${epWord} ${fold.episode} aired`}`;
  const sub = fold?.revealed.length
    ? `${names(fold.revealed)} ${fold.revealed.length === 1 ? "has" : "have"} revealed it`
    : fold?.byMark
      ? `From ${names(who)}. They unfold as you catch up.`
      : `From ${names(who)}. They unfold when you've seen it.`;
  return (
    <div data-fold={fold?.episode ?? ""} className="mt-2 rounded-[4px] border border-dashed border-input px-3 py-2.5 text-[13px] text-muted-foreground">
      <div className="flex items-start gap-2">
        <Eye className="mt-px size-4 flex-none" aria-hidden />
        <span>
          <b className="block text-[14px] font-semibold text-foreground">{title}</b>
          <span className="mt-0.5 block">{sub}</span>
        </span>
      </div>
      {/* The safe way first, full width; reading them anyway is a quiet link that says what it risks (the critique's P1). */}
      {reveal && (
        <Btn wide data-fold-reveal className="mt-2.5 h-11 text-[15px] text-foreground" onClick={() => onReveal(reveal)}>
          Reveal {epWord} {reveal}
        </Btn>
      )}
      <button type="button" data-fold-show onClick={onShow} className="mt-2 w-full py-1.5 text-center text-[13px] font-semibold text-muted-foreground underline underline-offset-4">
        Show them anyway{fold && !fold.byMark ? ` (may spoil ${epWord} ${fold.episode})` : ""}
      </button>
    </div>
  );
}

/** The field above the tab bar, lifted over the keyboard while you type. Enter sends; Shift+Enter is a new line. */
function Composer({ placeholder, onSend, onGif }: { placeholder: string; onSend: (text: string) => Promise<void>; onGif?: () => void }) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);
  const box = useRef<HTMLFormElement>(null);
  const [lift, setLift] = useState(0);
  const [height, setHeight] = useState(72);

  // The keyboard covers the bottom of the screen: sit just above it (the tab bar is behind it then).
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const fit = () => {
      const covered = window.innerHeight - (vv.height + vv.offsetTop);
      setLift(covered > 120 ? covered : 0);
    };
    vv.addEventListener("resize", fit);
    vv.addEventListener("scroll", fit);
    return () => {
      vv.removeEventListener("resize", fit);
      vv.removeEventListener("scroll", fit);
    };
  }, []);
  // The field grows with what's typed, up to about five lines; the page keeps room for it.
  useLayoutEffect(() => {
    const el = field.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
    if (box.current) setHeight(box.current.offsetHeight);
  }, [draft]);

  const send = async () => {
    const text = draft.trim();
    if (!text || busy) return;
    setBusy(true);
    setDraft("");
    try {
      await onSend(text);
    } catch (e) {
      setDraft(text);
      toast.quiet(`Not sent: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {/* The show space keeps 72px under the content for this; anything taller needs the rest. */}
      <div aria-hidden style={{ height: Math.max(0, height - 72) }} />
      <form
        ref={box}
        data-composer
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="nd-fixed-x fixed z-[25] flex items-end gap-2 border-t border-border bg-background/95 px-4 pb-4 pt-2.5 backdrop-blur-md"
        style={{ bottom: lift ? lift : "calc(66px + env(safe-area-inset-bottom, 0px))" }}
      >
        {onGif && (
          <button type="button" data-chat-gif-button aria-label="Send a GIF" onClick={onGif} className="type-caption grid h-[46px] w-11 flex-none place-items-center rounded-[3px] bg-secondary text-[15px]">
            GIF
          </button>
        )}
        <textarea
          ref={field}
          rows={1}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // Not mid-composition (IME), or it sends half a word.
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={placeholder}
          aria-label="Message"
          enterKeyHint="send"
          className="min-h-[46px] min-w-0 flex-1 resize-none rounded-[3px] border border-input bg-card px-3 py-[11px] text-base leading-snug outline-0 placeholder:text-muted-foreground focus:border-chyron-line"
        />
        <button type="submit" aria-label="Send" disabled={!draft.trim() || busy} className="grid size-[46px] flex-none place-items-center rounded-[3px] bg-secondary disabled:text-muted-foreground">
          <Send className="size-5" aria-hidden />
        </button>
      </form>
    </>
  );
}

/** A message's sheet: quick reactions (any emoji behind +), Copy, and Edit and Delete for yours (or anyone's, for
 *  whoever runs a game here). A reveal line's has only Remove, for them. */
function MessageSheet({ m, chat, onClose, actions }: { m: ChatLine | null; chat: CouchChat; onClose: () => void; actions: ReturnType<typeof useChatActions> }) {
  const [picker, setPicker] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const night = useNight();
  // Keeps showing the message it opened with while it slides away.
  const [shown, setShown] = useState<ChatLine | null>(m);
  if (m && m !== shown) setShown(m);
  const me = chat.you.userId;
  const mine = shown?.userId === me;
  const canChange = mine || chat.you.moderator;
  const close = () => {
    setPicker(false);
    setEditing(null);
    onClose();
  };
  const run = (p: Promise<unknown>, done?: string) =>
    p.then(() => done && toast(done)).catch((e) => toast.quiet(`Didn't work: ${(e as Error).message}`));
  const isReveal = shown?.type === "reveal";

  return (
    <Sheet
      open={!!m}
      onOpenChange={(o) => !o && close()}
      title={isReveal ? "Reveal line" : mine ? "Your message" : (shown?.name ?? "")}
      subtitle={shown ? `${dayLabel(shown.at)} · ${timeOf(shown.at)}` : undefined}
    >
      {shown && isReveal && (
        <>
          <p className="py-2 text-[15px]">{revealWords(shown.text ?? "")}</p>
          {chat.you.moderator ? (
            <Btn wide className="mt-2 text-live" onClick={() => (close(), run(actions.remove(shown.id), "Removed"))}>
              Remove
            </Btn>
          ) : (
            <p className="text-[13px] text-muted-foreground">Says who has caught up, so the couch knows what&apos;s safe to talk about.</p>
          )}
        </>
      )}
      {shown && !isReveal && editing !== null && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const text = editing.trim();
            close();
            if (text && text !== shown.text) run(actions.edit(shown.id, text), "Edited");
          }}
        >
          <textarea
            autoFocus
            value={editing}
            onChange={(e) => setEditing(e.target.value)}
            aria-label="Message"
            rows={4}
            className="w-full resize-none rounded-[3px] border border-input bg-background px-3 py-2.5 text-base leading-snug outline-0 focus:border-chyron-line"
          />
          <Btn type="submit" tone="ink" wide className="mt-3">
            Save
          </Btn>
        </form>
      )}
      {shown && !isReveal && editing === null && (
        <div data-message-sheet>
          <div className="flex items-center justify-between gap-1 border-y border-border py-2">
            {QUICK.map((emoji) => {
              const yours = !!shown.reactions[emoji]?.userIds.includes(me);
              return (
                <button
                  key={emoji}
                  type="button"
                  aria-label={`React ${emoji}`}
                  aria-pressed={yours}
                  onClick={() => (close(), run(actions.react(shown.id, emoji)))}
                  className={`grid size-11 place-items-center rounded-[3px] text-[24px] hover:bg-secondary ${yours ? "bg-secondary outline-2 outline-foreground" : ""}`}
                >
                  {emoji}
                </button>
              );
            })}
            <button
              type="button"
              aria-label="More reactions"
              aria-expanded={picker}
              onClick={() => setPicker((p) => !p)}
              className={`grid size-11 place-items-center rounded-[3px] border border-border text-muted-foreground ${picker ? "bg-secondary text-foreground" : ""}`}
            >
              <Plus className="size-5" aria-hidden />
            </button>
          </div>
          {picker && (
            <div className="pt-2">
              <EmojiPicker
                onEmojiClick={(d) => (close(), run(actions.react(shown.id, d.emoji)))}
                width="100%"
                height={320}
                theme={(night ? "dark" : "light") as Theme}
                previewConfig={{ showPreview: false }}
                lazyLoadEmojis
              />
            </div>
          )}
          <div className="mt-3 flex flex-col gap-2">
            {!shown.gif && (
              <Btn
                wide
                onClick={() => {
                  close();
                  navigator.clipboard?.writeText(shown.text ?? "").then(() => toast("Copied"), () => {});
                }}
              >
                Copy text
              </Btn>
            )}
            {canChange && !shown.gif && (
              <Btn wide onClick={() => setEditing(shown.text ?? "")}>
                Edit
              </Btn>
            )}
            {canChange && (
              <Btn wide className="text-live" onClick={() => (close(), run(actions.remove(shown.id), "Deleted"))}>
                Delete
              </Btn>
            )}
          </div>
        </div>
      )}
    </Sheet>
  );
}

"use client";

// A league's Chat (docs/PLAN-sports-couch.md B1, session 5; the design: docs/design-round/league-chat-spec.md, -first-view.md,
// -shape.md): the couch's room about the league, a message about one real game carrying that game (its thread). The message, its
// sheet, the GIF sheet and the composer are the show Chat's (show/chat.tsx), so a message here is a message everywhere.
//
// Spoilers by the game, on the phone, as every sports score is (sports/scores.tsx): for anyone hiding sports scores (or watching that
// game as if live), the others' messages in a game's thread written after its kickoff fold into one dashed line for the game until
// its score is shown (Show the score: showScore, the same reveal everywhere). Talk before kickoff and the room's own aren't folded.
// Where a message goes is shown before Send: in a thread, that game; in All while a couch game is on, its About chip (on by default,
// × for the room); otherwise the room.

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Eye, MessageCircle, Plus, X } from "lucide-react";
import { roomEarlier, useCurrentCouch, useHome, useLeagueRoom, useRoomActions, useSportsRecordings, type RoomLine, type RoomThread, type WeekGame } from "../data";
import { openCouchSheet } from "../couch/couch-sheets";
import { Composer, dayKey, dayLabel, Line, MessageSheet, names } from "../show/chat";
import { GifSheet } from "../ui/gif-sheet";
import { Btn, EmptyState } from "../ui/parts";
import { Sheet } from "../ui/sheet";
import { toast } from "../ui/toast";
import { begun, showScore, useHideSports, useHideSportsKnown, useNow, useShownScores } from "../sports/scores";
import { useLeagueWeek } from "../sports/sheets";
import type { LeagueNow } from "@/lib/sports/league-now";
import { useTableTeams } from "./league-page";
import { LapResultLine, LapTag } from "../sports/lap";

const RUN_MS = 10 * 60_000;
/** A game counts as on for this long after its start, by the clock alone, for anyone hiding its score (the league card's rule). */
const ON_MS = 3.5 * 3_600_000;
/** A thread with talk this recent keeps its chip. */
const RECENT_MS = 3 * 86_400_000;

type Thread = { event: string; name: string; at: string | null; live: boolean; started: boolean; last: number };

const gameName = (g: WeekGame) => `${g.sides.find((s) => !s.home)?.short ?? ""} at ${g.sides.find((s) => s.home)?.short ?? ""}`;

type Item =
  | { kind: "day"; key: string; label: string }
  | { kind: "line"; m: RoomLine; starts: boolean; ends: boolean }
  | { kind: "fold"; key: string; event: string; lines: RoomLine[] };

/** The stream: days, runs of one person about one thing, and each held game's folded messages as one line where its first was. */
function itemsOf(messages: RoomLine[], held: (m: RoomLine) => boolean): Item[] {
  const out: Item[] = [];
  const folds = new Map<string, RoomLine[]>();
  for (const m of messages) if (held(m)) folds.set(m.event!, [...(folds.get(m.event!) ?? []), m]);
  let day: string | null = null;
  const sameRun = (a?: RoomLine, b?: RoomLine) =>
    !!a && !!b && !held(a) && !held(b) && a.userId === b.userId && a.event === b.event && dayKey(a.at) === dayKey(b.at) && Math.abs(Date.parse(b.at) - Date.parse(a.at)) < RUN_MS;
  messages.forEach((m, i) => {
    const h = held(m);
    if (h && folds.get(m.event!)![0] !== m) return;
    if (dayKey(m.at) !== day) {
      day = dayKey(m.at);
      out.push({ kind: "day", key: `d-${m.id}`, label: dayLabel(m.at) });
    }
    if (h) out.push({ kind: "fold", key: `f-${m.event}`, event: m.event!, lines: folds.get(m.event!)! });
    else out.push({ kind: "line", m, starts: !sameRun(messages[i - 1], m), ends: !sameRun(m, messages[i + 1]) });
  });
  return out;
}

/** The message line before item `i` (a day or a fold between doesn't count: the talk is what changes game). */
function prevLine(items: Item[], i: number): RoomLine | undefined {
  for (let j = i - 1; j >= 0; j--) {
    const it = items[j];
    if (it.kind === "line") return it.m;
    if (it.kind === "fold") return it.lines[it.lines.length - 1];
  }
  return undefined;
}

export function LeagueChat({ league, name, lnow }: { league: string; name: string; lnow: LeagueNow | null }) {
  const home = useHome().data;
  const couch = useCurrentCouch(home);
  const couchId = couch?.id ?? null;
  const params = useSearchParams();
  const [thread, setThread] = useState<string | null>(() => params.get("thread"));
  const [since, setSince] = useState<Pick<RoomLine, "id" | "at"> | null>(null);
  const [page, setPage] = useState<{ messages: RoomLine[]; more: boolean } | null>(null);
  const [reading, setReading] = useState(false);
  const room = useLeagueRoom(league, couchId, since);
  const actions = useRoomActions(league, couchId);
  const week = useLeagueWeek(league, lnow?.from ?? null, lnow?.to ?? null);
  const { teams } = useTableTeams(league);
  const known = useHideSportsKnown();
  const hide = useHideSports();
  const shown = useShownScores();
  const recordings = useSportsRecordings().data?.recordings;
  const now = useNow();
  const [open, setOpen] = useState<RoomLine | null>(null);
  const [gifOpen, setGifOpen] = useState(false);
  const [more3, setMore3] = useState(false);
  // The About chip ×'d for a game: posts go to the room until it's put back.
  const [dropped, setDropped] = useState<string | null>(null);

  const data = room.data && "messages" in room.data ? room.data : null;
  // What's read, with the earlier page you've read back to in front of it (each message once).
  const all = useMemo(() => {
    const read = data?.messages ?? [];
    return page ? [...page.messages.filter((p) => !read.some((m) => m.id === p.id)), ...read] : read;
  }, [data, page]);
  const more = page ? page.more : !!data?.more;

  // Hidden for you: a game whose score you hide (and haven't shown), or one you're watching as if live.
  const recorded = useMemo(() => new Set((recordings ?? []).map((r) => r.game)), [recordings]);
  const hiddenGame = (event: string) => !known || (hide && !shown.has(event)) || recorded.has(event);
  const me = data?.you.userId ?? home?.user.id ?? "";
  const held = (m: RoomLine) => !!m.event && m.userId !== me && !!m.eventAt && Date.parse(m.at) >= Date.parse(m.eventAt) && hiddenGame(m.event);

  // The couch's teams' games this week, and every game with talk lately: the threads.
  const couchTeams = useMemo(() => new Set(teams.map((t) => t.id)), [teams]);
  const hiddenSet = useMemo(() => ({ hide: !known || hide, shown, recorded }), [known, hide, shown, recorded]);
  const threads = useMemo(() => {
    const isHidden = (id: string) => (hiddenSet.hide && !hiddenSet.shown.has(id)) || hiddenSet.recorded.has(id);
    // On now: its state for someone shown it; for someone hiding it, the clock alone (begun, and not 3.5 hours gone).
    const onNow = (g: WeekGame) => begun(g, now) && (isHidden(g.id) ? !!g.at && now - Date.parse(g.at) < ON_MS : g.state !== "post" && !g.final);
    const byId = new Map<string, Thread>();
    for (const g of week.games) {
      if (!g.sides.some((s) => couchTeams.has(s.id)) || (g.called && g.called !== "suspended")) continue;
      const started = begun(g, now);
      const live = onNow(g);
      const today = !!g.at && Math.abs(Date.parse(g.at) - now) < 14 * 3_600_000;
      if (!today && !live) continue;
      byId.set(g.id, { event: g.id, name: gameName(g), at: g.at, live, started, last: 0 });
    }
    for (const m of all) {
      if (!m.event || now - Date.parse(m.at) > RECENT_MS) continue;
      const t = byId.get(m.event);
      if (t) t.last = Math.max(t.last, Date.parse(m.at));
      else {
        const g = week.games.find((x) => x.id === m.event);
        byId.set(m.event, { event: m.event, name: g ? gameName(g) : (m.eventName ?? "A game"), at: g?.at ?? m.eventAt, live: !!g && onNow(g), started: !!m.eventAt && Date.parse(m.eventAt) <= now, last: Date.parse(m.at) });
      }
    }
    return [...byId.values()].sort((a, b) => Number(b.live) - Number(a.live) || b.last - a.last || Date.parse(a.at ?? "") - Date.parse(b.at ?? ""));
  }, [week.games, couchTeams, all, now, hiddenSet]);
  const threadOf = (event: string | null) => (event ? threads.find((t) => t.event === event) : undefined);
  const picked = threadOf(thread) ?? (thread ? { event: thread, name: all.find((m) => m.event === thread)?.eventName ?? "This game", at: null, live: false, started: false, last: 0 } : undefined);
  const liveCouch = threads.find((t) => t.live && week.games.some((g) => g.id === t.event));
  // Where a message goes (R4): the thread you're in, else the live couch game unless ×'d, else the room.
  const about: Thread | undefined = picked ?? (liveCouch && dropped !== liveCouch.event ? liveCouch : undefined);
  const toThread = (t: Thread | undefined): RoomThread | null => (t ? { event: t.event, eventAt: t.at, eventName: t.name } : null);
  const messages = thread ? all.filter((m) => m.event === thread) : all;

  // Opens at the newest message and keeps up with new ones, unless you've scrolled up to read back.
  const atBottom = useRef(true);
  const placed = useRef(false);
  const keep = useRef<number | null>(null);
  useEffect(() => {
    const onScroll = () => {
      const el = document.documentElement;
      atBottom.current = el.scrollHeight - window.scrollY - window.innerHeight < 140;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useLayoutEffect(() => {
    if (keep.current != null) {
      window.scrollTo({ top: document.documentElement.scrollHeight - keep.current, behavior: "instant" });
      keep.current = null;
      return;
    }
    if (!data) return;
    if (!placed.current || atBottom.current) window.scrollTo({ top: document.documentElement.scrollHeight, behavior: placed.current ? "smooth" : "instant" });
    placed.current = true;
  }, [data, messages.length, thread]);
  // What's on screen is read: the tab's badge clears.
  const newest = all[all.length - 1]?.at ?? null;
  const readUpTo = useRef<string | null>(null);
  useEffect(() => {
    if (!newest || !data?.you.canPost || readUpTo.current === newest || document.visibilityState !== "visible") return;
    readUpTo.current = newest;
    actions.read(newest).catch(() => {});
  }, [newest, data?.you.canPost]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!couch && home) {
    return (
      <div data-league-chat-solo className="pt-6">
        <p className="text-[15px] leading-snug">Chat is for a couch: your friends talking about {name}.</p>
        <p className="mt-1 flex gap-4">
          <button type="button" onClick={() => openCouchSheet({ kind: "new" })} className="nd-press inline-flex h-11 items-center font-semibold underline underline-offset-[3px] focus-visible:outline-2 focus-visible:outline-foreground">
            Start a couch
          </button>
          <button type="button" onClick={() => openCouchSheet({ kind: "join" })} className="nd-press inline-flex h-11 items-center font-semibold underline underline-offset-[3px] focus-visible:outline-2 focus-visible:outline-foreground">
            Join one
          </button>
        </p>
      </div>
    );
  }
  if (!data || !known) {
    return room.error ? (
      <EmptyState icon={MessageCircle} title="Chat didn't load" line={(room.error as Error).message} />
    ) : (
      <div aria-busy data-league-chat-loading className="animate-pulse pt-6">
        <div className="h-12 w-3/5 rounded-[4px] bg-card" />
        <div className="ml-auto mt-3 h-12 w-1/2 rounded-[4px] bg-card" />
        <div className="mt-3 h-12 w-2/3 rounded-[4px] bg-card" />
      </div>
    );
  }

  const earlier = async () => {
    const first = all[0];
    if (!first || reading || !couchId) return;
    setReading(true);
    try {
      const got = await roomEarlier(league, couchId, first);
      keep.current = document.documentElement.scrollHeight - window.scrollY;
      setPage({ messages: [...got.messages, ...all], more: got.more });
      if (got.messages[0]) setSince(got.messages[0]);
    } catch (e) {
      toast.quiet(`Didn't load: ${(e as Error).message}`);
    } finally {
      setReading(false);
    }
  };
  const pick = (event: string | null) => {
    setThread(event);
    setMore3(false);
    atBottom.current = true;
    placed.current = false;
  };
  const shownChips = threads.slice(0, 3);
  if (picked && !shownChips.some((t) => t.event === picked.event)) shownChips.splice(2, 1, picked);
  const rest = threads.filter((t) => !shownChips.includes(t));
  // A run's game, where the talk turns to it (the message before was about something else): words on its name line, not a control
  // (a button inside the message's would be two at once); the chips above are the way into a thread.
  const tagOf = (m: RoomLine, prev: RoomLine | undefined) => {
    if (!m.event || thread || prev?.event === m.event) return null;
    const label = threadOf(m.event)?.name ?? m.eventName ?? "a game";
    return (
      <span data-thread-tag={m.event} className="font-semibold text-muted-foreground">
        {m.userId === me ? label : `· ${label}`}
      </span>
    );
  };

  return (
    <div data-league-chat={thread ?? "all"} className="flex min-h-[calc(100dvh-var(--league-bar,96px)-66px-120px)] flex-col pb-4">
      {/* The threads (R1: one row at most, none with nothing to choose; R5: All and three games, live first). */}
      {threads.length > 0 && (
        <div data-threads className="sticky top-[var(--league-bar,0px)] z-10 -mx-4 flex gap-2 overflow-x-auto bg-background px-4 py-1 [scrollbar-width:none]">
          {[null, ...shownChips.map((t) => t.event)].map((e) => {
            const t = e ? threadOf(e) ?? picked : undefined;
            const on = thread === e;
            const live = !!t?.live && !hiddenGame(t.event);
            return (
              <button
                key={e ?? "all"}
                type="button"
                data-thread={e ?? "all"}
                aria-pressed={on}
                onClick={() => pick(e)}
                className={`nd-press flex h-11 flex-none items-center gap-1.5 rounded-[4px] px-3 text-[14px] font-semibold outline-1 -outline-offset-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground ${on ? "bg-foreground text-background outline-foreground" : "text-muted-foreground outline-edge"}`}
              >
                {live && <i className="size-[7px] flex-none rounded-full bg-live" aria-hidden />}
                {e ? t?.name : "All"}
                {/* Hidden and begun: "Started", never live or final (2026-11-09). */}
                {e && t?.started && hiddenGame(t.event) && <span className={on ? "font-medium" : "font-medium text-muted-foreground"}>· Started</span>}
              </button>
            );
          })}
          {rest.length > 0 && (
            <button type="button" data-threads-more onClick={() => setMore3(true)} className="nd-press flex h-11 flex-none items-center rounded-[4px] px-3 text-[14px] font-semibold text-muted-foreground outline-1 -outline-offset-1 outline-edge focus-visible:outline-2 focus-visible:outline-foreground">
              +{rest.length}
            </button>
          )}
        </div>
      )}
      {more && (
        <div className="flex justify-center pb-1 pt-3">
          <Btn data-earlier className="h-11 px-4 text-[14px]" disabled={reading} onClick={earlier}>
            {reading ? "Loading…" : "Earlier messages"}
          </Btn>
        </div>
      )}
      {/* Pushes a short stream down to the composer. */}
      <div className="flex-1" aria-hidden />
      {messages.length === 0 && (
        <div data-league-chat-empty className="py-14 text-center">
          <p className="type-caption text-[22px]">No messages yet</p>
          <p className="mt-1.5 text-[15px] text-muted-foreground">{picked ? `Say something about ${picked.name}.` : `Say something to the couch about ${name}.`}</p>
        </div>
      )}
      {itemsOf(messages, held).map((item, i, items) => {
        if (item.kind === "day") {
          return (
            <div key={item.key} data-day role="separator" className="mb-1.5 mt-4 flex items-center gap-2.5 text-[13px] text-muted-foreground before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">
              {item.label}
            </div>
          );
        }
        if (item.kind === "fold") {
          const t = threadOf(item.event);
          const label = t?.name ?? item.lines[0].eventName ?? "a game";
          const n = item.lines.length;
          return (
            <div key={item.key} data-room-fold={item.event} className="mt-2 flex items-center gap-2 rounded-[4px] border border-dashed border-input py-1.5 pl-3 pr-1.5 text-[13px] text-muted-foreground">
              <Eye className="size-4 flex-none" aria-hidden />
              <span className="min-w-0 flex-1">
                <b className="block text-[14px] font-semibold leading-tight text-foreground">
                  {n} {n === 1 ? "message" : "messages"} in {label} since it started
                </b>
                <span className="mt-0.5 block truncate">From {names([...new Set(item.lines.map((l) => l.name))])}</span>
              </span>
              <button type="button" data-room-fold-show onClick={() => showScore(item.event, league)} className="nd-press flex h-11 flex-none items-center rounded-[4px] px-3 text-[14px] font-semibold text-foreground outline-1 -outline-offset-1 outline-edge focus-visible:outline-2 focus-visible:outline-foreground">
                Show the score
              </button>
            </div>
          );
        }
        return (
          <Line
            key={item.m.id}
            item={{ m: { ...item.m, type: "message" }, starts: item.starts, ends: item.ends }}
            me={me}
            couchId={couchId}
            tag={item.starts ? tagOf(item.m, prevLine(items, i)) : null}
            onOpen={() => setOpen(item.m)}
            onReact={(e) => actions.react(item.m.id, e).catch((err) => toast.quiet(`Not sent: ${err.message}`))}
            lap={
              item.m.lap ? (
                <span data-room-lap className="flex flex-col gap-1">
                  <LapTag />
                  <LapResultLine r={item.m.lap} league={league} />
                </span>
              ) : undefined
            }
          />
        );
      })}
      {data.you.canPost && (
        <Composer
          placeholder={about ? `Message about ${about.name}` : "Message the couch"}
          onGif={data.gifs ? () => setGifOpen(true) : undefined}
          above={
            picked ? null : about ? (
              <div data-about={about.event} className="mb-2 flex items-center">
                <span className="flex h-8 items-center gap-1 rounded-[4px] pl-2.5 text-[13px] font-semibold outline-1 -outline-offset-1 outline-edge">
                  About {about.name}
                  <button type="button" data-about-drop aria-label={`Post to the room, not about ${about.name}`} onClick={() => setDropped(about.event)} className="nd-press -my-1.5 grid size-11 place-items-center focus-visible:outline-2 focus-visible:outline-foreground">
                    <X className="size-4" aria-hidden />
                  </button>
                </span>
              </div>
            ) : liveCouch ? (
              <div className="mb-1 flex">
                <button type="button" data-about-add onClick={() => setDropped(null)} className="nd-press -ml-1 flex h-11 items-center gap-1 px-1 text-[13px] font-semibold text-muted-foreground focus-visible:outline-2 focus-visible:outline-foreground">
                  <Plus className="size-4" aria-hidden /> About {liveCouch.name}
                </button>
              </div>
            ) : null
          }
          onSend={async (text) => {
            atBottom.current = true;
            await actions.post(text, undefined, toThread(about));
          }}
        />
      )}
      <MessageSheet m={open ? { ...open, type: "message" } : null} chat={data} onClose={() => setOpen(null)} actions={actions} />
      {data.gifs && (
        <GifSheet
          open={gifOpen}
          subtitle={about ? `To the couch about ${about.name}` : `To the couch about ${name}`}
          onOpenChange={setGifOpen}
          onPick={(g) => {
            setGifOpen(false);
            atBottom.current = true;
            actions.post("", g, toThread(about)).catch((e) => toast.quiet(`Not sent: ${(e as Error).message}`));
          }}
        />
      )}
      <Sheet open={more3} onOpenChange={setMore3} title="Every thread">
        <ul className="flex flex-col pb-2">
          {rest.map((t) => (
            <li key={t.event}>
              <button type="button" data-thread-row={t.event} onClick={() => pick(t.event)} className="nd-press flex min-h-12 w-full items-center gap-2 border-b border-border text-left text-[15px] font-semibold">
                {t.live && !hiddenGame(t.event) && <i className="size-[7px] rounded-full bg-live" aria-hidden />}
                {t.name}
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
    </div>
  );
}

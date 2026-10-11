"use client";

import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { EyeOff, SendHorizontal } from "lucide-react";
import type { ChatMessage } from "@/lib/game/types";
import { useLeagueStore } from "@/lib/store";
import { useChatStore, DEMO_VISITOR_ID } from "@/lib/chat-store";
import { ChatMessageRow, ChatAuthor } from "./chat-message-row";
import { ActButton } from "@/components/admin/admin-ui";
import StateLogic from "@/lib/game/state-logic.js";
import { useHiddenResults } from "@/components/results-in-banner";
import { useLateJoin } from "@/components/late-join/replay-bug";
import { CaptionPlate } from "@/components/ui/caption-plate";
import { cn } from "cn";

// Port of renderChat() (public/app.js). Polls every 5s while mounted, matching the live app's
// loadChatMessages interval -- gated to live mode only: polling in mock mode would periodically
// reset `messages` back to the seed data, discarding anything just sent locally, since mock mode
// has no server to actually persist to. load() also calls markSeen() on success, keeping the
// unread badge elsewhere at 0 while this tab is the one actively open.
//
// Direction A (DESIGN.md, Chat): flat on the ground, no box. Messages run in groups -- one author,
// one sitting -- under the author's name and colour; your own sit on the right in the "You" fill
// (bone on Night, ink on Studio), never chyron, so yellow keeps meaning "now". A day changing is a
// small caps divider. Everything you can do to a message is in its sheet (chat-message-row.tsx).
export function ChatTab() {
  const lateJoin = useLateJoin();
  const state = useLeagueStore((s) => s.state);
  const mode = useLeagueStore((s) => s.mode);
  const leagueId = useLeagueStore((s) => s.leagueId);
  const { messages, reads, loaded, load, markSeen, send } = useChatStore();
  const [draft, setDraft] = useState("");
  const userId = useLeagueStore((s) => s.userId);
  const myPlayerId = useLeagueStore((s) => s.membership?.playerId ?? null);
  const me = mode === "mock" ? DEMO_VISITOR_ID : userId;

  // Spoiler protection: once an episode this viewer hasn't revealed starts airing, people watching
  // live may be talking about it (SpoilerLogic.chatWindow). Everything posted since sits behind a
  // "may contain spoilers" line, each message tapped open one by one -- or all at once, with Show all
  // or by revealing the episode (which moves the line on). Your own messages and reveal lines show.
  const fullState = useLeagueStore((s) => s.fullState);
  const seen = useLeagueStore((s) => s.membership?.resultsSeenThrough);
  const window_ = mode === "live" ? StateLogic.SpoilerLogic.chatWindow(fullState, seen) : null;
  const { hidden: hiddenResults, reveal } = useHiddenResults();
  const shownIds = useChatStore((s) => s.shownIds);
  const showMessage = useChatStore((s) => s.showMessage);
  const since = window_ ? new Date(window_.since).getTime() : null;
  const isOwnMsg = (m: ChatMessage) => !!me && m.user_id === me;
  const guarded = (m: ChatMessage) =>
    since !== null && m.type === "message" && !isOwnMsg(m) && new Date(m.created_at).getTime() >= since && !shownIds.includes(m.id);
  const firstInWindow = since === null ? -1 : messages.findIndex((m) => new Date(m.created_at).getTime() >= since);
  const anyGuarded = messages.some(guarded);

  // "Read by" for the newest message: everyone else in the league (not its author, not you) whose
  // read position has reached it. All of them -> "Read by all"; none -> nothing shown.
  const last = messages[messages.length - 1];
  let readLabel: string | null = null;
  if (last) {
    const others = reads.filter(
      (r) => r.userId !== last.user_id && r.userId !== userId && r.playerId !== myPlayerId && r.playerId !== last.user_id
    );
    const readers = others.filter((r) => r.lastReadAt && new Date(r.lastReadAt) >= new Date(last.created_at));
    const nameOf = (r: (typeof reads)[number]) => state.players.find((p) => p.id === r.playerId)?.name ?? r.name ?? "someone";
    if (others.length > 0 && readers.length === others.length) readLabel = "Read by all";
    else if (readers.length > 0) readLabel = `Read by ${readers.map(nameOf).join(", ")}`;
  }

  // An author's colour is their player's in this league; someone only in a linked league has none.
  function colourOf(m: ChatMessage): string | null {
    if (mode === "mock") return state.players.find((p) => p.id === m.user_id)?.color ?? null;
    const pid = reads.find((r) => r.userId === m.user_id)?.playerId;
    return (pid && state.players.find((p) => p.id === pid)?.color) || null;
  }

  // Messages that arrive while the page is open slide in; what was already there when it opened
  // doesn't. Null until the first load has landed (set during render, React's pattern for state that
  // follows a prop, so the first loaded render already knows not to animate).
  const [openedWith, setOpenedWith] = useState<Set<string> | null>(() => (loaded ? new Set(messages.map((m) => m.id)) : null));
  if (openedWith === null && loaded) setOpenedWith(new Set(messages.map((m) => m.id)));

  useEffect(() => {
    if (mode === "mock" && !loaded) load();
  }, [mode, loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  useQuery({
    queryKey: ["chat-active-poll", leagueId],
    queryFn: () => load(),
    enabled: mode === "live" && !!leagueId,
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  });

  // markSeen() also runs once on mount even before the first poll resolves, in case messages
  // were already loaded (e.g. navigating back to Chat) -- avoids a stale unread badge lingering
  // for the ~5s until the first poll completes.
  useEffect(() => {
    markSeen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Opens at the newest message and keeps up with new ones -- unless you've scrolled up to read
  // back, then it stays put. Also re-pinned when the box resizes (the keyboard opening).
  const boxRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const atBottom = useRef(true);
  const height = useFitToVisible(boxRef);
  useLayoutEffect(() => {
    const el = listRef.current;
    if (el && atBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages.length, height]);

  // The field grows with what's typed, up to about five lines, then scrolls.
  useLayoutEffect(() => {
    const el = fieldRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
  }, [draft]);

  async function handleSend() {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    atBottom.current = true; // your own message: always show it
    await send(text);
    markSeen();
  }

  // Where each message sits: a day divider before the first of a day, and the author's name only at
  // the start of a run (same author, within ten minutes, nothing in between).
  const rows = messages.map((m, i) => {
    const prev = messages[i - 1];
    const day = dayKey(m.created_at);
    const newDay = !prev || dayKey(prev.created_at) !== day;
    const continues =
      !!prev &&
      !newDay &&
      i !== firstInWindow &&
      m.type === "message" &&
      prev.type === "message" &&
      prev.user_id === m.user_id &&
      new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < 10 * 60_000;
    const next = messages[i + 1];
    const runEnds =
      !next ||
      next.type !== "message" ||
      next.user_id !== m.user_id ||
      dayKey(next.created_at) !== day ||
      i + 1 === firstInWindow ||
      new Date(next.created_at).getTime() - new Date(m.created_at).getTime() >= 10 * 60_000;
    return { m, newDay, continues, runEnds };
  });

  // A late joiner has no chat yet (StateLogic.GhostLogic): the league can't see them, and while
  // they're catching up the conversation is ahead of them. The server sends nothing either.
  if (lateJoin) {
    return (
      <CaptionPlate
        tag={lateJoin.catchingUp ? "Replay" : "Off air"}
        tone="quiet"
        title="Chat opens later"
        subtitle={
          lateJoin.catchingUp
            ? "The league is talking about episodes you haven't seen. It opens when you're caught up and in the league."
            : "It opens once your commissioner adds you to the league."
        }
      />
    );
  }

  return (
    // Sized to the space actually visible (useFitToVisible): down to the tab bar, or to just above the
    // keyboard while typing. The negative margin cancels main's bottom padding on mobile -- that
    // padding is there to clear the tab bar, which this already does -- so there's no gap to scroll.
    // (Desktop: main's 90px bottom padding less the 24px the fit leaves -- the page ends with the box.)
    <div
      ref={boxRef}
      className="-mb-[66px] flex h-[70vh] max-w-[720px] flex-col max-nav:-mb-[calc(84px+env(safe-area-inset-bottom,0px))]"
      style={height ? { height } : undefined}
    >
      <h2 className="type-caption mb-2 text-[28px] max-nav:hidden">Chat</h2>
      <div
        ref={listRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        className="-mx-4 flex flex-1 flex-col overflow-y-auto overscroll-contain px-4 pb-2 nav:mx-0 nav:px-0"
        aria-label="Messages"
      >
        {messages.length === 0 ? (
          loaded && (
            <div className="m-auto flex flex-col items-center gap-1.5 text-center">
              <p className="type-caption text-[22px]">No messages yet</p>
              <p className="text-[15px] text-muted-foreground">Say something to your league.</p>
            </div>
          )
        ) : (
          <div className="mt-auto flex flex-col">
            {rows.map(({ m, newDay, continues, runEnds }, i) => (
              <Fragment key={m.id}>
                {newDay && <DayDivider iso={m.created_at} />}
                {i === firstInWindow && window_ && (
                  <div className="my-3 flex flex-col items-center gap-1 border-y border-border py-3 text-center">
                    <p className="type-caption text-[17px]">Episode {window_.episode} has started</p>
                    <p className="text-[13px] text-muted-foreground">Messages from here may contain spoilers.</p>
                    {(anyGuarded || hiddenResults.length > 0) && (
                      <div className="mt-1.5 flex flex-wrap justify-center gap-2">
                        {anyGuarded && (
                          <ActButton onClick={() => messages.filter(guarded).forEach((g) => showMessage(g.id))}>Show all</ActButton>
                        )}
                        {hiddenResults.length > 0 && (
                          <ActButton onClick={() => reveal()}>Reveal Episode {hiddenResults[hiddenResults.length - 1].number}</ActButton>
                        )}
                      </div>
                    )}
                  </div>
                )}
                <div className={cn(openedWith && !openedWith.has(m.id) && "chat-in")}>
                  {guarded(m) ? (
                    <div className={cn("flex flex-col items-start", continues ? "mt-1" : "mt-3", runEnds && "mb-1")}>
                      {!continues && <ChatAuthor name={m.author_name} colour={colourOf(m)} at={m.created_at} />}
                      <button
                        type="button"
                        className="flex min-h-11 max-w-[85%] items-center gap-2 rounded-[4px] border border-dashed border-input px-3 py-2 text-left text-[15px] text-muted-foreground hover:bg-accent"
                        onClick={() => showMessage(m.id)}
                      >
                        <EyeOff className="size-4 shrink-0" aria-hidden />
                        May contain spoilers · tap to show
                      </button>
                    </div>
                  ) : (
                    <ChatMessageRow m={m} state={state} own={isOwnMsg(m)} colour={colourOf(m)} continues={continues} runEnds={runEnds} />
                  )}
                </div>
              </Fragment>
            ))}
            {readLabel && <p className="mt-1 text-right text-[12px] text-muted-foreground">{readLabel}</p>}
          </div>
        )}
      </div>
      <form
        className="flex items-end gap-2 border-t border-border pt-2 pb-2"
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
      >
        <textarea
          ref={fieldRef}
          rows={1}
          aria-label="Message"
          enterKeyHint="send"
          className="min-h-11 min-w-0 flex-1 resize-none rounded-[3px] border border-input bg-card px-3.5 py-[9px] text-base leading-snug text-foreground placeholder:text-muted-foreground focus:border-chyron-line focus:shadow-[0_0_0_3px_var(--focus-halo)] focus:outline-none"
          placeholder="Message your league"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends; Shift+Enter is a new line. Not mid-composition (IME), or it sends half a word.
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <button
          type="submit"
          aria-label="Send"
          disabled={!draft.trim()}
          className="flex size-11 shrink-0 items-center justify-center rounded-[3px] bg-chyron text-chyron-foreground transition-[filter,background-color] hover:brightness-[1.06] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-chyron-line disabled:bg-muted disabled:text-muted-foreground disabled:hover:brightness-100"
        >
          <SendHorizontal className="size-5" strokeWidth={2.2} aria-hidden />
        </button>
      </form>
    </div>
  );
}

const dayKey = (iso: string) => new Date(iso).toDateString();

/** "Today", "Yesterday", or "Wed, Oct 7" between two hairlines. */
function DayDivider({ iso }: { iso: string }) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const label =
    d.toDateString() === today.toDateString()
      ? "Today"
      : d.toDateString() === yesterday.toDateString()
        ? "Yesterday"
        : d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric", year: d.getFullYear() === today.getFullYear() ? undefined : "numeric" });
  return (
    <div className="mt-4 mb-1 flex items-center gap-3 first:mt-1" role="separator">
      <span className="h-px flex-1 bg-border" />
      <span className="type-caption text-[13px] tracking-[0.04em] text-muted-foreground">{label}</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

// The height that fills what's actually on screen below the box's top: to the top of the mobile tab
// bar, or -- with the keyboard open, when the tab bar is behind it -- to just above the keyboard,
// so the message box is never covered. Reads the visual viewport (what's visible once a keyboard
// takes part of the screen), on iPhone and Android alike. Null until measured (the CSS height stands).
function useFitToVisible(ref: React.RefObject<HTMLDivElement | null>): number | null {
  const [height, setHeight] = useState<number | null>(null);
  useLayoutEffect(() => {
    const vv = window.visualViewport;
    function fit() {
      const el = ref.current;
      if (!el) return;
      const visibleBottom = (vv?.offsetTop ?? 0) + (vv?.height ?? window.innerHeight);
      const keyboardOpen = !!vv && window.innerHeight - vv.height > 120;
      // Shown = has a size (it's display:none on desktop). Not offsetParent: that's always null for a
      // fixed element, which read as "no tab bar" and let the chat run underneath it.
      const tabBarRect = document.querySelector<HTMLElement>("[data-mobile-tabbar]")?.getBoundingClientRect();
      const tabBarShown = !!tabBarRect && tabBarRect.height > 0;
      const tabBarHeight = tabBarShown && !keyboardOpen ? tabBarRect.height : 0;
      // Desktop: leave the page's own bottom breathing room.
      const gap = tabBarShown ? 0 : 24;
      if (keyboardOpen) {
        // The phone may scroll the page to keep the box in view while typing: fit to what's showing.
        setHeight(Math.max(220, Math.floor(visibleBottom - tabBarHeight - gap - el.getBoundingClientRect().top)));
        return;
      }
      // Otherwise the page itself should never scroll: size from the box's place on the PAGE (not where
      // it happens to sit on screen) so everything fits exactly, and undo any drift -- something
      // appearing above (the action bar) could leave the page scrolled, tucking it under the top bar.
      const pageTop = el.getBoundingClientRect().top + window.scrollY;
      setHeight(Math.max(220, Math.floor((vv?.height ?? window.innerHeight) - tabBarHeight - gap - pageTop)));
      if (window.scrollY > 0) window.scrollTo(0, 0);
    }
    fit();
    vv?.addEventListener("resize", fit);
    vv?.addEventListener("scroll", fit);
    window.addEventListener("resize", fit);
    // Anything appearing above the chat after it's laid out moves its top down -- the action bar
    // (fetched a moment later), "Results are in!", a flash message, the install hint, the top bar
    // gaining its league dots -- and the box would then run under the tab bar. Re-fit whenever the
    // page's layout changes size, whatever caused it.
    const ro = new ResizeObserver(() => fit());
    ro.observe(document.body);
    const header = document.querySelector("header");
    if (header) ro.observe(header);
    return () => {
      vv?.removeEventListener("resize", fit);
      vv?.removeEventListener("scroll", fit);
      window.removeEventListener("resize", fit);
      ro.disconnect();
    };
  }, [ref]);
  return height;
}

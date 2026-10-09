"use client";

import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLeagueStore } from "@/lib/store";
import { useChatStore } from "@/lib/chat-store";
import { ChatMessageRow } from "./chat-message-row";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import StateLogic from "@/lib/game/state-logic.js";
import { useHiddenResults } from "@/components/results-in-banner";

// Port of renderChat() (public/app.js). Polls every 5s while mounted, matching the live app's
// loadChatMessages interval -- gated to live mode only: polling in mock mode would periodically
// reset `messages` back to the seed data, discarding anything just sent locally, since mock mode
// has no server to actually persist to. load() also calls markSeen() on success, keeping the
// unread badge elsewhere at 0 while this tab is the one actively open.
export function ChatTab() {
  const state = useLeagueStore((s) => s.state);
  const mode = useLeagueStore((s) => s.mode);
  const leagueId = useLeagueStore((s) => s.leagueId);
  const { messages, reads, loaded, load, markSeen, send } = useChatStore();
  const [draft, setDraft] = useState("");
  const userId = useLeagueStore((s) => s.userId);
  const myPlayerId = useLeagueStore((s) => s.membership?.playerId ?? null);

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
  const isOwnMsg = (m: (typeof messages)[number]) => !!userId && m.user_id === userId;
  const guarded = (m: (typeof messages)[number]) =>
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
  const atBottom = useRef(true);
  const height = useFitToVisible(boxRef);
  useLayoutEffect(() => {
    const el = listRef.current;
    if (el && atBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages.length, height]);

  async function handleSend() {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    atBottom.current = true; // your own message: always show it
    await send(text);
    markSeen();
  }

  return (
    // Sized to the space actually visible (useFitToVisible): down to the tab bar, or to just above the
    // keyboard while typing. The negative margin cancels main's bottom padding on mobile -- that
    // padding is there to clear the tab bar, which this already does -- so there's no gap to scroll.
    // (Desktop: main's 90px bottom padding less the 24px the fit leaves -- the page ends with the box.)
    <div
      ref={boxRef}
      className="-mb-[66px] flex h-[70vh] flex-col max-nav:-mb-[calc(84px+env(safe-area-inset-bottom,0px))]"
      style={height ? { height } : undefined}
    >
      <h2 className="mb-3 text-2xl font-bold tracking-tight max-nav:hidden">Chat</h2>
      <div
        ref={listRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        className="flex-1 overflow-y-auto overscroll-contain rounded-lg border border-border bg-card p-3"
      >
        {messages.length === 0 ? (
          <div className="text-sm italic text-muted-foreground">No messages yet — say hello!</div>
        ) : (
          messages.map((m, i) => (
            <Fragment key={m.id}>
              {i === firstInWindow && window_ && (
                <div className="my-2 flex flex-wrap items-center justify-center gap-2 border-y border-border py-2 text-center text-xs text-muted-foreground">
                  <span>Episode {window_.episode} has started — chat from here may contain spoilers.</span>
                  {anyGuarded && (
                    <button
                      className="font-semibold text-foreground underline underline-offset-2"
                      onClick={() => messages.filter(guarded).forEach((g) => showMessage(g.id))}
                    >
                      Show all
                    </button>
                  )}
                  {hiddenResults.length > 0 && (
                    <button className="font-semibold text-foreground underline underline-offset-2" onClick={reveal}>
                      Reveal episode {hiddenResults[hiddenResults.length - 1].number}
                    </button>
                  )}
                </div>
              )}
              {guarded(m) ? (
                <button
                  className="mb-2 block max-w-[80%] rounded-lg bg-secondary p-2.5 text-left"
                  onClick={() => showMessage(m.id)}
                  title="Show this message"
                >
                  <div className="mb-1 text-xs font-semibold opacity-80">{m.author_name}</div>
                  <div className="text-sm italic text-muted-foreground">May contain spoilers — tap to show</div>
                </button>
              ) : (
                <ChatMessageRow m={m} state={state} />
              )}
            </Fragment>
          ))
        )}
        {readLabel && <div className="mt-1 text-right text-[0.7rem] text-muted-foreground">{readLabel}</div>}
      </div>
      <div className="mt-2 flex gap-2 pb-2">
        <Input
          className="min-w-0 flex-1"
          placeholder="Message your league..."
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
        />
        <Button onClick={handleSend}>Send</Button>
      </div>
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

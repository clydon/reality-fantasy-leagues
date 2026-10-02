"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLeagueStore } from "@/lib/store";
import { useChatStore } from "@/lib/chat-store";
import { ChatMessageRow } from "./chat-message-row";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
          messages.map((m) => <ChatMessageRow key={m.id} m={m} state={state} />)
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
      const tabBar = document.querySelector<HTMLElement>("[data-mobile-tabbar]");
      const tabBarHeight = !keyboardOpen && tabBar && tabBar.offsetParent !== null ? tabBar.getBoundingClientRect().height : 0;
      // Desktop: leave the page's own bottom breathing room.
      const gap = tabBar && tabBar.offsetParent !== null ? 0 : 24;
      setHeight(Math.max(220, Math.floor(visibleBottom - tabBarHeight - gap - el.getBoundingClientRect().top)));
    }
    fit();
    vv?.addEventListener("resize", fit);
    vv?.addEventListener("scroll", fit);
    window.addEventListener("resize", fit);
    return () => {
      vv?.removeEventListener("resize", fit);
      vv?.removeEventListener("scroll", fit);
      window.removeEventListener("resize", fit);
    };
  }, [ref]);
  return height;
}

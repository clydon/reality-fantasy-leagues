"use client";

import { useEffect, useState } from "react";
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
  const { messages, loaded, load, markSeen, send } = useChatStore();
  const [draft, setDraft] = useState("");

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

  async function handleSend() {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    await send(text);
    markSeen();
  }

  // Note: the live app's Chat gets a special fixed-height, flush layout (.app-shell.chat-mode in
  // public/styles.css, overriding main's normal padding) so the compose box stays pinned at the
  // viewport bottom. Not replicated exactly here -- this just fits inside the normal content
  // column's padding with its own bounded height, a simplification not a redesign.
  return (
    <div className="flex h-[70vh] flex-col">
      <h2 className="mb-3 text-2xl font-bold tracking-tight max-nav:hidden">Chat</h2>
      <div className="flex-1 overflow-y-auto rounded-lg border border-border bg-card p-3">
        {messages.length === 0 ? (
          <div className="text-sm italic text-muted-foreground">No messages yet — say hello!</div>
        ) : (
          messages.map((m) => <ChatMessageRow key={m.id} m={m} state={state} />)
        )}
      </div>
      <div className="mt-3 flex gap-2">
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

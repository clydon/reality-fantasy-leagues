"use client";

import { useEffect, useState } from "react";
import { useLeagueStore } from "@/lib/store";
import { useChatStore } from "@/lib/chat-store";
import { ChatMessageRow } from "./chat-message-row";
import { Button } from "@/components/ui/button";

// Port of renderChat() (public/app.js). No auto-polling here -- see chat-store.ts's note; a
// manual Refresh button stands in for the live app's 5-second poll loop, since no tab in this
// POC has live-refresh infrastructure yet.
export function ChatTab() {
  const state = useLeagueStore((s) => s.state);
  const { messages, loading, loaded, load, send } = useChatStore();
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (!loaded) load();
  }, [loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSend() {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    await send(text);
  }

  // Note: the live app's Chat gets a special fixed-height, flush layout (.app-shell.chat-mode in
  // public/styles.css, overriding main's normal padding) so the compose box stays pinned at the
  // viewport bottom. Not replicated exactly here -- this just fits inside the normal content
  // column's padding with its own bounded height, a simplification not a redesign.
  return (
    <div className="flex h-[70vh] flex-col">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Chat</h2>
        <button className="text-xs text-muted-foreground underline underline-offset-2" onClick={() => load()} disabled={loading}>
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto rounded-lg border border-border bg-card p-3">
        {messages.length === 0 ? (
          <div className="text-sm italic text-muted-foreground">No messages yet — say hello!</div>
        ) : (
          messages.map((m) => <ChatMessageRow key={m.id} m={m} state={state} />)
        )}
      </div>
      <div className="mt-3 flex gap-2">
        <input
          className="min-w-0 flex-1 rounded-md border border-border bg-card px-3 py-2 text-sm"
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

"use client";

import { useState } from "react";
import type { ChatMessage, LeagueState } from "@/lib/game/types";
import { formatDateTime } from "@/lib/game/selectors";
import { useLeagueStore, useCanManage } from "@/lib/store";
import { useChatStore, DEMO_VISITOR_ID } from "@/lib/chat-store";
import { confirm } from "@/lib/confirm-store";
import { MentionText } from "./mention-text";
import { cn } from "cn";
import EmojiPicker from "emoji-picker-react";

// Real picker, unlike the live app's emoji-mart (public/app.js's mountOpenEmojiPickers()), which
// built a real DOM node imperatively and was explicitly called out in the original code as not
// fitting a declarative render model. emoji-picker-react is a normal React component, so it slots
// straight into the same popup this component already had for the old fixed 5-emoji palette.
// react() (chat-store.ts) already accepted any emoji string, so no store/API changes were needed.

export function ChatMessageRow({ m, state }: { m: ChatMessage; state: LeagueState }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(m.text);
  const [pickerOpen, setPickerOpen] = useState(false);
  const mode = useLeagueStore((s) => s.mode);
  const userId = useLeagueStore((s) => s.userId);
  const canManage = useCanManage();
  const { edit, remove, react } = useChatStore();

  const isOwn = mode === "mock" ? m.user_id === DEMO_VISITOR_ID : !!userId && m.user_id === userId;
  // A reveal line ("conor revealed episode 9") can't be edited; a commissioner can still remove one.
  const canEdit = m.type === "message" && (isOwn || canManage);
  const canDelete = m.type === "message" ? isOwn || canManage : canManage;
  const mine = mode === "mock" ? DEMO_VISITOR_ID : userId;

  async function handleDelete() {
    if (!(await confirm("Delete this message?", { danger: true, confirmLabel: "Delete" }))) return;
    await remove(m.id);
  }
  async function saveEdit() {
    const text = draft.trim();
    if (!text) return;
    setEditing(false);
    await edit(m.id, text);
  }

  const reactionsRow = (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      {Object.entries(m.reactions || {}).map(([emoji, info]) => (
        <button
          key={emoji}
          className={cn(
            "rounded-full border border-border bg-card px-1.5 py-0.5 text-xs",
            mine && info.userIds.includes(mine) && "border-primary bg-primary/10"
          )}
          onClick={() => react(m.id, emoji)}
        >
          {emoji} {info.count}
        </button>
      ))}
      <div className="relative">
        <button
          className="rounded-full border border-dashed border-border px-1.5 py-0.5 text-xs text-muted-foreground"
          title="Add a reaction"
          onClick={() => setPickerOpen((o) => !o)}
        >
          +
        </button>
        {pickerOpen && (
          <div className="absolute bottom-full left-0 z-10 mb-1 shadow-md">
            <EmojiPicker
              onEmojiClick={(data) => {
                react(m.id, data.emoji);
                setPickerOpen(false);
              }}
              width={300}
              height={360}
            />
          </div>
        )}
      </div>
    </div>
  );

  if (m.type === "reveal") {
    return (
      // One short centred line -- "👀 conor revealed episode 9 · 10:42 PM" (the full date on hover) --
      // that wraps as a whole if a name is long, rather than squeezing the name against a long date.
      <div className="my-1.5 px-4 text-center text-xs text-muted-foreground">
        <span className="font-semibold">👀 {m.text}</span>
        <span title={formatDateTime(m.created_at)}>
          {" · "}
          {new Date(m.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
        </span>
        {canDelete && (
          <button className="ml-2 align-middle" title="Remove" onClick={handleDelete}>
            ✕
          </button>
        )}
      </div>
    );
  }

  if (m.type === "system") {
    return (
      <div className="flex items-center gap-2 py-1 text-center text-xs text-muted-foreground">
        <span className="flex-1">
          <MentionText state={state} text={m.text} />
        </span>
        <span>{formatDateTime(m.created_at)}</span>
        {canDelete && (
          <button title="Remove" onClick={handleDelete}>
            ✕
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={cn("mb-2 max-w-[80%] rounded-lg p-2.5", isOwn ? "ml-auto bg-primary text-primary-foreground" : "bg-secondary")}>
      <div className="mb-1 flex items-center gap-2 text-xs opacity-80">
        <span className="font-semibold">{m.author_name}</span>
        <span>
          {formatDateTime(m.created_at)}
          {m.edited_at ? " (edited)" : ""}
        </span>
        {canEdit && (
          <button title="Edit" onClick={() => setEditing(true)}>
            ✏️
          </button>
        )}
        {canDelete && (
          <button title="Delete" onClick={handleDelete}>
            ✕
          </button>
        )}
      </div>
      {editing ? (
        <div className="flex gap-1.5">
          <input
            className="min-w-0 flex-1 rounded border border-border bg-background px-2 py-1 text-sm text-foreground"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveEdit()}
            autoFocus
          />
          <button className="rounded bg-background px-2 py-1 text-xs text-foreground" onClick={saveEdit}>
            Save
          </button>
          <button className="rounded px-2 py-1 text-xs" onClick={() => setEditing(false)}>
            Cancel
          </button>
        </div>
      ) : (
        <div className="text-sm">
          <MentionText state={state} text={m.text} />
        </div>
      )}
      {reactionsRow}
    </div>
  );
}

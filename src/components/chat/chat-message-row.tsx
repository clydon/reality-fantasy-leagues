"use client";

import { useState } from "react";
import { Eye, Plus } from "lucide-react";
import type { ChatMessage, LeagueState } from "@/lib/game/types";
import { formatDateTime } from "@/lib/game/selectors";
import { useLeagueStore, useCanManage } from "@/lib/store";
import { useChatStore, DEMO_VISITOR_ID } from "@/lib/chat-store";
import { BottomSheet, SheetAction } from "@/components/ui/bottom-sheet";
import { TextSheet } from "@/components/setup/settings-ui";
import { MentionText } from "./mention-text";
import { cn } from "cn";
import EmojiPicker, { Theme } from "emoji-picker-react";

// One chat line (DESIGN.md, Chat). Tapping a message opens its sheet: a row of quick reactions (any
// other emoji behind +), Copy, Edit and Delete -- in place of the ✏️, ✕ and + that used to sit on
// every bubble. The emoji picker is emoji-picker-react, a normal React component (the live app's
// emoji-mart built a DOM node imperatively); react() (chat-store.ts) accepts any emoji string.

const QUICK = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

const timeOf = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

/** A run's first line: the author's colour dot, name and time. */
export function ChatAuthor({ name, colour, at, align = "start" }: { name: string; colour: string | null; at: string; align?: "start" | "end" }) {
  return (
    <div className={cn("mb-1 flex items-baseline gap-1.5 px-0.5", align === "end" && "self-end")}>
      {align === "start" && (
        <span className="size-2 shrink-0 translate-y-[-1px] self-center rounded-full bg-muted-foreground" style={colour ? { background: colour } : undefined} aria-hidden />
      )}
      {align === "start" && <span className="text-[13px] font-bold">{name}</span>}
      <time className="text-[12px] text-muted-foreground" dateTime={at} title={formatDateTime(at)}>
        {timeOf(at)}
      </time>
    </div>
  );
}

export function ChatMessageRow({
  m,
  state,
  own,
  colour,
  continues,
  runEnds,
}: {
  m: ChatMessage;
  state: LeagueState;
  own: boolean;
  colour: string | null;
  /** Same author as the line above, so no name or time. */
  continues: boolean;
  /** The last of its author's run. */
  runEnds: boolean;
}) {
  const [sheet, setSheet] = useState<null | "actions" | "edit">(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const mode = useLeagueStore((s) => s.mode);
  const userId = useLeagueStore((s) => s.userId);
  const canManage = useCanManage();
  const { edit, remove, react } = useChatStore();

  // A reveal line ("conor revealed episode 9") can't be edited; a commissioner can still remove one.
  const canEdit = m.type === "message" && (own || canManage);
  const canDelete = m.type === "message" ? own || canManage : canManage;
  const mine = mode === "mock" ? DEMO_VISITOR_ID : userId;
  const reactions = Object.entries(m.reactions || {});

  function close() {
    setSheet(null);
    setPickerOpen(false);
  }
  async function handleDelete() {
    close();
    await remove(m.id);
  }
  function toggle(emoji: string) {
    close();
    react(m.id, emoji);
  }

  if (m.type === "reveal" || m.type === "system") {
    // One short centred line -- "conor revealed episode 9 · 10:42 PM" -- that wraps as a whole if a
    // name is long. A commissioner can tap it to remove it.
    const line = (
      <>
        {m.type === "reveal" && <Eye className="mr-1.5 inline size-3.5 -translate-y-px" aria-hidden />}
        <span className="font-semibold">{m.type === "reveal" ? m.text : <MentionText state={state} text={m.text} />}</span>
        <time dateTime={m.created_at} title={formatDateTime(m.created_at)}>
          {" · "}
          {timeOf(m.created_at)}
        </time>
      </>
    );
    return (
      <>
        {canDelete ? (
          <button type="button" className="my-1 block w-full px-4 text-center text-[13px] text-muted-foreground hover:text-foreground" onClick={() => setSheet("actions")}>
            {line}
          </button>
        ) : (
          <p className="my-1 px-4 text-center text-[13px] text-muted-foreground">{line}</p>
        )}
        <BottomSheet open={sheet === "actions"} onOpenChange={(o) => !o && close()} title={m.type === "reveal" ? "Reveal line" : "Message"}>
          <SheetAction danger onClick={handleDelete}>
            Remove
          </SheetAction>
        </BottomSheet>
      </>
    );
  }

  return (
    <div className={cn("flex flex-col", own ? "items-end" : "items-start", continues ? "mt-1" : "mt-3", runEnds && "mb-1")}>
      {!continues && <ChatAuthor name={m.author_name} colour={colour} at={m.created_at} align={own ? "end" : "start"} />}
      <button
        type="button"
        onClick={() => setSheet("actions")}
        aria-haspopup="dialog"
        className={cn(
          "max-w-[85%] whitespace-pre-wrap break-words rounded-[4px] px-3 py-2 text-left text-base leading-snug transition-[filter] hover:brightness-[1.04] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-chyron-line",
          own ? "bg-foreground text-background" : "bg-card text-foreground"
        )}
      >
        <MentionText state={state} text={m.text} />
        {m.edited_at && <span className="ml-1.5 text-[12px] opacity-60">edited</span>}
      </button>
      {reactions.length > 0 && (
        <div className={cn("mt-1 flex flex-wrap gap-1", own && "justify-end")}>
          {reactions.map(([emoji, info]) => {
            const yours = !!mine && info.userIds.includes(mine);
            return (
              <button
                key={emoji}
                type="button"
                aria-pressed={yours}
                aria-label={`${emoji} ${info.count}${yours ? ", including you" : ""}`}
                className={cn(
                  "chat-pop inline-flex h-8 items-center gap-1 rounded-[3px] border bg-card px-2 text-[14px]",
                  yours ? "border-chyron-line" : "border-border"
                )}
                onClick={() => react(m.id, emoji)}
              >
                <span aria-hidden>{emoji}</span>
                <span className="type-num text-[14px]" aria-hidden>
                  {info.count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <BottomSheet open={sheet === "actions"} onOpenChange={(o) => !o && close()} title={own ? "Your message" : m.author_name} description={timeOf(m.created_at)}>
        <div className="flex items-center justify-between gap-1 border-t border-border py-2">
          {QUICK.map((emoji) => {
            const yours = !!mine && !!m.reactions?.[emoji]?.userIds.includes(mine);
            return (
              <button
                key={emoji}
                type="button"
                aria-label={`React ${emoji}`}
                aria-pressed={yours}
                onClick={() => toggle(emoji)}
                className={cn("flex size-11 items-center justify-center rounded-[3px] text-[24px] hover:bg-accent", yours && "bg-secondary outline-2 outline-chyron-line")}
              >
                {emoji}
              </button>
            );
          })}
          <button
            type="button"
            aria-label="More reactions"
            aria-expanded={pickerOpen}
            onClick={() => setPickerOpen((o) => !o)}
            className={cn("flex size-11 items-center justify-center rounded-[3px] border border-border text-muted-foreground hover:bg-accent", pickerOpen && "bg-secondary text-foreground")}
          >
            <Plus className="size-5" aria-hidden />
          </button>
        </div>
        {pickerOpen && (
          <div className="chat-sheet pb-2">
            <EmojiPicker
              onEmojiClick={(data) => toggle(data.emoji)}
              width="100%"
              height={320}
              theme={typeof document !== "undefined" && document.documentElement.classList.contains("dark") ? Theme.DARK : Theme.LIGHT}
              previewConfig={{ showPreview: false }}
              lazyLoadEmojis
            />
          </div>
        )}
        <SheetAction
          onClick={() => {
            close();
            navigator.clipboard?.writeText(m.text).catch(() => {});
          }}
        >
          Copy text
        </SheetAction>
        {canEdit && <SheetAction onClick={() => setSheet("edit")}>Edit</SheetAction>}
        {canDelete && (
          <SheetAction danger onClick={handleDelete}>
            Delete
          </SheetAction>
        )}
      </BottomSheet>
      {sheet === "edit" && (
        <TextSheet
          title="Edit message"
          label="Message"
          initial={m.text}
          submit="Save"
          onClose={close}
          onSubmit={(text) => {
            close();
            if (text !== m.text) edit(m.id, text);
          }}
        />
      )}
    </div>
  );
}

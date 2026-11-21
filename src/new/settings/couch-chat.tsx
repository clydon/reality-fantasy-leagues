"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, MessageCircle } from "lucide-react";
import { CHAT_CHOICES, type ChatMode } from "@/lib/moments";
import { useProfile } from "../data";
import { toast } from "../ui/toast";
import { couchChatApi, useCouchChat } from "./api";
import { Choice } from "./controls";

// Chat notifications on one couch (settings Round 1, A9 and C26; docs/design-round/settings-r1-first-view.md §4): a row on the
// couch's page, its value first ("Your default · skip possible spoilers", or this couch's own), opening its choices in place: My
// default first (chosen while this couch follows Your settings), then the three. It covers every show's chat on this couch; a show's
// own Couch chat off still wins there.

const title = (c: ChatMode) => CHAT_CHOICES.find((x) => x.id === c)!.title;

export function CouchChatRow({ couchId, couchName }: { couchId: string; couchName: string }) {
  const own = useCouchChat(couchId);
  const { data: p } = useProfile();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const fallback = (p?.notify.chat ?? "quiet") as ChatMode;
  const mine = own.data?.chat ?? null;
  const save = async (chat: ChatMode | null, undo = true) => {
    const was = mine;
    try {
      const out = await couchChatApi.save(couchId, chat);
      qc.setQueryData(["new-design", "couch-chat", couchId], out);
      void qc.invalidateQueries({ queryKey: ["new-design", "profile"] });
      if (undo) toast(chat ? `${couchName}'s chat: ${title(chat).toLowerCase()}` : `${couchName}'s chat: your default`, { undo: () => save(was, false) });
    } catch (e) {
      toast.quiet((e as Error).message);
    }
  };
  return (
    <div data-couch-chat={mine ?? "default"} className="border-t border-border">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="nd-press flex min-h-[64px] w-full items-center gap-3 py-2 text-left">
        <span className="grid size-10 flex-none place-items-center rounded-[3px] bg-secondary">
          <MessageCircle className="size-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <b className="block text-[15px] font-semibold">Chat notifications on {couchName}</b>
          <small className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">
            {own.data ? (mine ? `${title(mine)} · just this couch` : `Your default · ${title(fallback).toLowerCase()}`) : "…"}
          </small>
        </span>
        <ChevronDown className={`size-5 flex-none text-muted-foreground transition-transform duration-300 ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open && own.data && (
        <div className="nd-unfold pb-3 pl-[52px]" role="radiogroup" aria-label={`Chat notifications on ${couchName}`}>
          <Choice data="couch-chat-default" on={!mine} title="My default" line={`${title(fallback)}, as set in Your settings`} onPick={() => save(null)} />
          {CHAT_CHOICES.map((c) => (
            <Choice key={c.id} data={`couch-chat-${c.id}`} on={mine === c.id} title={c.title} line={c.line} onPick={() => save(c.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { Eye, Send } from "lucide-react";
import { CHAT, ME } from "../fixtures/chat";
import { DemoAvatar } from "../hub/sections";
import type { ShowData } from "../screens/show-space";
import { Preview } from "../ui/preview";

// Chat (the mock's show.js tabChat): the couch's chat about this show, by day, with the reveal lines, and a composer
// above the tab bar. On a fixture behind Preview until step 4 makes it one chat per couch and show, folded past
// where each reader is.

export function Chat({ show }: { show: ShowData }) {
  const name = show.header ? `${show.header.show.name.replace(/^The /, "")}${show.header.seasonNumber ? ` ${show.header.seasonNumber}` : ""}` : "this show";
  return (
    <Preview id="show.chat" className="mx-2 mt-5 px-2 pb-4 pt-3">
      {CHAT.map((line, i) => {
        if ("day" in line) {
          return (
            <div
              key={i}
              className="type-caption mb-1.5 mt-3 flex items-center gap-2.5 text-xs tracking-[0.06em] text-muted-foreground before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border"
            >
              {line.day}
            </div>
          );
        }
        if ("system" in line) {
          return (
            <p key={i} className="my-3.5 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <Eye className="size-3.5" aria-hidden />
              {line.system}
            </p>
          );
        }
        const mine = line.who === ME;
        return (
          <div key={i} className={`mt-1.5 flex items-end gap-2 ${mine ? "justify-end" : ""}`}>
            {!mine && <DemoAvatar who={line.who} size={28} />}
            <div className={`max-w-[78%] rounded-[4px] px-[11px] py-2 text-[15px] leading-[1.35] ${mine ? "bg-foreground text-background" : "bg-card"}`}>
              {!mine && <small className="mb-0.5 block text-[11px] font-bold text-muted-foreground">{line.who}</small>}
              {line.text}
            </div>
          </div>
        );
      })}
      <div className="nd-fixed-x fixed bottom-[calc(66px+env(safe-area-inset-bottom,0px))] z-[25] flex gap-2 border-t border-border bg-[rgba(22,20,29,.95)] px-4 pb-4 pt-2.5 backdrop-blur-md">
        <input
          readOnly
          placeholder={`Message the ${name} couch`}
          aria-label="Message"
          className="h-[46px] min-w-0 flex-1 rounded-[3px] border border-input bg-card px-3 text-base outline-0"
        />
        <button type="button" aria-label="Send" className="grid size-[46px] place-items-center rounded-[3px] bg-secondary">
          <Send className="size-5" aria-hidden />
        </button>
      </div>
    </Preview>
  );
}

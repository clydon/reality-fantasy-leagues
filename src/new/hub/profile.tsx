"use client";

import { ChevronRight, Settings, Star, Users, Zap } from "lucide-react";
import type { Couch } from "../data";
import { PROFILE } from "../fixtures/hub";
import { NavLink } from "../nav";
import { paths } from "../routes";
import { Row } from "../ui/parts";
import { Preview } from "../ui/preview";
import { Sheet } from "../ui/sheet";

// Your profile, from the hub's avatar (the mock's index.html profileSheet): your couch at the top (moved off the hub
// on 2026-10-23; it opens the couch switcher, step 9), your numbers (step 8), and Settings.

export function ProfileSheet({ open, onOpenChange, me, couch }: { open: boolean; onOpenChange: (open: boolean) => void; me: { name: string }; couch: Couch | null }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={me.name} subtitle={couch?.name}>
      {couch && (
        <Preview id="hub.couch-switcher" tag={false} className="mb-3.5">
          <button type="button" className="flex h-12 w-full items-center gap-2.5 rounded-[3px] bg-secondary pl-2 pr-3 text-left">
            <span className="grid size-[30px] flex-none place-items-center rounded-[3px] bg-card text-muted-foreground">
              <Users className="size-4" aria-hidden />
            </span>
            <b className="flex-1 truncate text-[15px] font-semibold">{couch.name}</b>
            <small className="text-[13px] text-muted-foreground">{couch.members.length} on the couch</small>
            <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
          </button>
        </Preview>
      )}
      <Preview id="hub.profile">
        <div className="p-3">
          <div className="grid grid-cols-3 gap-2">
            {PROFILE.stats.map(([n, label]) => (
              <div key={label} className="rounded-[3px] bg-secondary px-2.5 py-2">
                <b className="type-num block text-[28px]">{n}</b>
                <small className="text-xs text-muted-foreground">{label}</small>
              </div>
            ))}
          </div>
          <p className="type-caption mb-2 mt-4 text-xs tracking-[0.06em] text-muted-foreground">Your best show</p>
          <div className="relative h-24 overflow-hidden rounded-[4px]">
            {/* eslint-disable-next-line @next/next/no-img-element -- fixture art from the published mock */}
            <img src={PROFILE.bestShow.art} alt="" className="size-full object-cover" style={{ objectPosition: PROFILE.bestShow.position }} />
            <b className="type-caption absolute bottom-2 left-3 text-[28px] [text-shadow:0_2px_12px_rgba(0,0,0,.6)]">{PROFILE.bestShow.name}</b>
          </div>
          <div className="mt-2 flex flex-col">
            {PROFILE.lines.map((l) => (
              <Row key={l.title} icon={l.icon === "star" ? Star : Zap} title={l.title} detail={l.line} />
            ))}
          </div>
        </div>
      </Preview>
      <NavLink
        href={paths.settings}
        className="nd-press mt-3.5 flex h-[52px] items-center justify-center gap-2 rounded-[3px] bg-card text-[15px] font-bold outline-1 -outline-offset-1 outline-input"
      >
        <Settings className="size-5" aria-hidden />
        Settings
      </NavLink>
    </Sheet>
  );
}

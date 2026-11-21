"use client";

import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { Recommended } from "../ui/recommended";

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/** A choice on Manage this game: chosen in bone with a tick (the chyron stays for what's due), or set aside with why. Shared by the
 *  game's own lines (game-settings.tsx) and its waivers' (backstage/waivers.tsx), so a rule picked anywhere on the page looks the
 *  same. `dataset`: the choice's own data attributes for the checks (`{ "data-feel": "casual" }`); `children` sit under its line. */
export function Choice({
  data,
  title,
  line,
  why,
  tag,
  recommended,
  chosen,
  onPick,
  dataset,
  children,
}: {
  data: string;
  title: string;
  line: string;
  why?: string | null;
  tag?: string | null;
  /** The one Recommended tag (ui/recommended.tsx). */
  recommended?: boolean;
  chosen: boolean;
  onPick?: () => void;
  dataset?: Record<string, string>;
  children?: ReactNode;
}) {
  const off = !chosen && !!why;
  return (
    <button
      type="button"
      data-settings-choice={data}
      {...dataset}
      aria-pressed={chosen}
      aria-disabled={off || !onPick}
      onClick={() => !off && onPick?.()}
      className={`nd-press flex w-full flex-col rounded-[4px] px-3 py-2.5 text-left ${FOCUS} ${chosen ? "bg-secondary outline-[1.5px] -outline-offset-[1.5px] outline-foreground" : off ? "border border-dashed border-edge" : "bg-secondary"}`}
    >
      <span className="flex items-start justify-between gap-2">
        <b className={`text-[16px] font-semibold leading-tight ${off ? "text-muted-foreground" : ""}`}>{title}</b>
        <span className="flex flex-none items-center gap-1.5 pt-0.5">
          {recommended && <Recommended />}
          {tag && <span className="type-caption text-[12px] tracking-[0.05em] text-muted-foreground">{tag}</span>}
          {chosen && <Check className="size-5" strokeWidth={3} aria-hidden />}
        </span>
      </span>
      <span className="mt-1 text-[14px] leading-snug text-muted-foreground">{line}</span>
      {off && <span className="mt-1 text-[13px] font-semibold leading-snug">{why}</span>}
      {children}
    </button>
  );
}

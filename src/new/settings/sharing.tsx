"use client";

import { useState } from "react";
import { ChevronRight, EyeOff } from "lucide-react";
import { presetOf, PRESET_WORDS, SHARE_DEFAULT, SHARE_SWITCHES, SWITCH_WORDS } from "@/lib/sharing";
import type { Profile, profileApi } from "../data";
import { useMe } from "../session";
import { Avatar } from "../ui/bars";
import { Choice, SwitchRow } from "./controls";

// What your couch sees (docs/PLAN-new-design.md step 15 part 3; the mock's share.js privHTML / wirePriv): three levels (Everything,
// recommended · Just my games · Only what games need), what someone on your couch sees about you under the one you're on (each
// line from your own shows, ratings and reactions, or Hidden), and Customize, the four switches under the levels. A tap saves, with
// Undo. The server enforces it (guard.ts rule 3); a show watched privately stays yours whatever this says.

type Save = (body: Parameters<typeof profileApi.save>[0], said: string, undo?: Parameters<typeof profileApi.save>[0]) => Promise<void>;

/** Settings' "What your couch sees". `viewer`: someone else on the couch you're on, whose eyes the lines are seen through. */
export function SharingSection({ p, save, viewer }: { p: Profile | undefined; save: Save; viewer: string | null }) {
  const me = useMe();
  const on = p?.sharing.on ?? SHARE_DEFAULT;
  const level = presetOf(on);
  const [open, setOpen] = useState(level === "custom");
  return (
    <div data-settings-sharing data-level={level}>
      <div role="radiogroup" aria-label="What your couch sees" className="px-4">
        {PRESET_WORDS.map((w) => (
          <Choice
            key={w.id}
            data={`share-${w.id}`}
            on={level === w.id}
            title={w.title}
            line={w.line}
            recommended={w.recommended}
            onPick={() => p && save({ sharing: { preset: w.id } }, "Saved · your couch sees this from now on", { sharing: { ...on } })}
          />
        ))}
      </div>

      <div className="mx-4 mt-3 rounded-[4px] bg-background p-3 outline-1 -outline-offset-1 outline-border" data-sharing-preview>
        <span className="type-caption mb-2 block text-[12px] tracking-[0.06em] text-muted-foreground">
          {viewer ? `What ${viewer} sees about you` : "What your couch sees about you"}
        </span>
        {SHARE_SWITCHES.map((k) => (
          <div key={k} data-sees={k} data-shown={on[k] ? "yes" : "no"} className={`flex min-h-[34px] items-center gap-2.5 text-[14px] ${on[k] ? "" : "text-muted-foreground"}`}>
            {on[k] ? (
              <Avatar id={me.id} name={p?.name ?? me.name} size={22} />
            ) : (
              <span className="grid size-[22px] flex-none place-items-center rounded-[3px] bg-secondary" aria-hidden>
                <EyeOff className="size-[13px]" />
              </span>
            )}
            <span className="min-w-0">{on[k] ? (p?.sharing.lines[k] ?? SWITCH_WORDS[k].title) : "Hidden"}</span>
          </div>
        ))}
      </div>

      <details className="group mx-4 mt-2.5 border-t border-border" open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)} data-sharing-custom>
        <summary className="nd-press flex min-h-[56px] cursor-pointer list-none items-center gap-2.5 [&::-webkit-details-marker]:hidden">
          <b className="text-[15px] font-semibold">Customize</b>
          <small className="flex-1 text-[13px] text-muted-foreground">{level === "custom" ? "Your own mix" : "Using the choice above"}</small>
          <ChevronRight className="size-5 rotate-90 text-muted-foreground transition-transform group-open:-rotate-90" aria-hidden />
        </summary>
        {SHARE_SWITCHES.map((k) => (
          <SwitchRow
            key={k}
            data={`share-${k}`}
            on={on[k]}
            disabled={!p}
            title={SWITCH_WORDS[k].title}
            line={SWITCH_WORDS[k].line}
            onChange={(next) => {
              setOpen(true);
              void save({ sharing: { [k]: next } }, `${SWITCH_WORDS[k].title}: ${next ? "shared" : "hidden"}`, { sharing: { [k]: !next } });
            }}
          />
        ))}
        <p className="mb-1 mt-2 text-[13px] leading-snug text-muted-foreground">
          Your picks always show once they lock: the games need that. To keep one show to yourself, use &ldquo;Watch privately&rdquo; in its ⋯ menu, under Everything else.
        </p>
      </details>
    </div>
  );
}

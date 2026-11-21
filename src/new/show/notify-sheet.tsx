"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BellOff, ChevronDown } from "lucide-react";
import { notesApi, useShowNotify, type ShowNotify } from "../data";
import { NavLink } from "../nav";
import { paths } from "../routes";
import { muteApi, muteEnd, type MuteFor } from "../settings/api";
import { SwitchRow } from "../settings/controls";
import { useNow } from "../ui/bars";
import { Btn } from "../ui/parts";
import { Sheet } from "../ui/sheet";
import { toast } from "../ui/toast";
import { turnOn, useReach } from "./remind";

// A show's Notifications, from its ⋯ menu (docs/PLAN-new-design.md step 15 part 2; settings Round 1, C16 and A6,
// docs/design-round/settings-r1-spec.md): every season of the show.
//   1. Mute the show, first, because it's the one move that quiets everything at once: for a day, a week or until you turn it back
//      on. Under it, always, what you'll still get: reminders before your moves lock still come (a muted show never costs you a
//      pick), and it all stays in the bell.
//   2. Just this show: each kind off for this show alone, over what Your settings says for every show. A kind that's off
//      everywhere says so, and links there.
// Saves as it's tapped, with Undo. While nothing of yours rings (this phone off, or an iPhone not yet on the Home Screen), a line
// says so, with Turn on, since a switch that's on for a phone that never rings is the "looks on but isn't" failure.

// Settings Round 2 (the user's pick on Round 1's story): "Until the next episode" first, closer to why people mute (tonight's
// spoilers), while one is scheduled; then the clock's three. Each says when it would end.
const MUTES: { id: MuteFor; title: string }[] = [
  { id: "next", title: "Until the next episode" },
  { id: "day", title: "For a day" },
  { id: "week", title: "For a week" },
  { id: "forever", title: "Until I turn it back on" },
];

/** When a mute picked now would end, in Mute's words: "until Thu 8 PM". The day and the week end on the hour after, as the server does. */
function muteWhen(id: MuteFor, now: number, nextAt: string | null): string {
  if (id === "forever") return "";
  if (id === "next") {
    if (!nextAt) return "";
    // The day and the time: the next episode is a moment, not a date (the check's finding).
    const at = new Date(nextAt);
    return `Until ${at.toLocaleDateString([], { weekday: "short" })} ${at.toLocaleTimeString([], { hour: "numeric", minute: at.getMinutes() ? "2-digit" : undefined })}`;
  }
  const end = new Date(Math.ceil((now + (id === "day" ? 1 : 7) * 86_400_000) / 3_600_000) * 3_600_000).toISOString();
  return muteEnd(end, now).replace(/^until/, "Until");
}

export function ShowNotifySheet({
  seasonId,
  open,
  onOpenChange,
  nextAt = null,
  finished = false,
}: {
  seasonId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When the season's next episode starts (Mute's "Until the next episode"); null when none is coming up. */
  nextAt?: string | null;
  finished?: boolean;
}) {
  const q = useShowNotify(seasonId, open);
  const qc = useQueryClient();
  const now = useNow(false);
  const { phone, reaches } = useReach(open);
  const [choosing, setChoosing] = useState(false);
  const data = q.data;
  const key = ["new-design", "show-notify", seasonId];
  const after = (d: ShowNotify) => {
    qc.setQueryData(key, d);
    void qc.invalidateQueries({ queryKey: ["new-design", "profile"] });
  };
  const set = async (moment: ShowNotify["moments"][number], on: boolean, undo = true) => {
    try {
      after(await notesApi.show(seasonId, moment.id, on));
      if (undo) toast(`${moment.title}: ${on ? "on" : "off"} for ${data?.show ?? "this show"}`, { undo: () => set(moment, !on, false) });
    } catch (e) {
      toast.quiet((e as Error).message);
    }
  };
  const mute = async (m: MuteFor | null) => {
    const was = data?.muted ?? null;
    setChoosing(false);
    try {
      const d = await muteApi.mute(seasonId, m);
      after(d);
      toast(m ? `${d.show}: muted ${muteEnd(d.muted ?? "forever", now)}` : `${d.show}: unmuted`, {
        undo: async () => {
          try {
            after(await muteApi.restore(seasonId, was));
          } catch (e) {
            toast.quiet((e as Error).message);
          }
        },
      });
    } catch (e) {
      toast.quiet((e as Error).message);
    }
  };
  const muted = data?.muted ?? null;
  const show = data?.show ?? "this show";
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Notifications" subtitle={data ? `${data.show} · every season` : "…"}>
      <div data-show-notify data-muted={muted ? "yes" : "no"}>
        {/* Mute leads, on the same left edge as the kinds under it; its line says what you'll still get, muted or not. */}
        <div data-show-mute className="border-b border-border">
          {muted ? (
            <div className="flex min-h-[64px] items-center gap-3 py-2">
              <span className="grid size-10 flex-none place-items-center rounded-[3px] bg-foreground text-background">
                <BellOff className="size-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <b className="block text-[15px] font-semibold">Muted {muteEnd(muted, now)}</b>
                <small className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">Reminders before your moves lock still come. Everything else waits in the bell.</small>
              </span>
              <button
                type="button"
                data-unmute
                onClick={() => mute(null)}
                className="nd-press h-11 flex-none rounded-[3px] bg-card px-3.5 text-sm font-semibold outline-1 -outline-offset-1 outline-edge"
              >
                Unmute
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                data-mute
                aria-expanded={choosing}
                disabled={!data}
                onClick={() => setChoosing(!choosing)}
                className="nd-press flex min-h-[64px] w-full items-center gap-3 py-2 text-left disabled:opacity-60"
              >
                <span className="grid size-10 flex-none place-items-center rounded-[3px] bg-secondary">
                  <BellOff className="size-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <b className="block text-[15px] font-semibold">Mute {show}</b>
                  <small className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">
                    Not muted. Muting quiets results, your couch&rsquo;s activity and chat; reminders before your moves lock still come.
                  </small>
                </span>
                <ChevronDown className={`size-5 flex-none text-muted-foreground transition-transform duration-300 ${choosing ? "rotate-180" : ""}`} aria-hidden />
              </button>
              {choosing && (
                <div data-mute-choices className="nd-unfold grid grid-cols-1 gap-1.5 pb-3 pl-[52px]">
                  {MUTES.filter((m) => m.id !== "next" || (!!nextAt && !finished)).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      data-mute-for={m.id}
                      onClick={() => mute(m.id)}
                      className="nd-press flex min-h-[52px] items-center justify-between gap-3 rounded-[3px] bg-card px-3 py-1.5 text-left outline-1 -outline-offset-1 outline-edge"
                    >
                      <span className="text-[15px] font-semibold">{m.title}</span>
                      <small className="text-right text-[12.5px] leading-tight text-muted-foreground">{muteWhen(m.id, now, nextAt)}</small>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Blocked is this phone's own fact, true whatever else of yours rings; off and install only matter while nothing does. */}
        {((reaches === false && (phone === "off" || phone === "install")) || phone === "blocked") && (
          <div data-show-notify-phone={phone} className="mt-3 flex items-center gap-3 rounded-[3px] bg-secondary p-3">
            <span className="min-w-0 flex-1">
              <b className="block text-[15px] font-semibold">{phone === "blocked" ? "Blocked on this phone" : "Off on this phone"}</b>
              <small className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">
                {phone === "off"
                  ? "None of these reach you until you turn them on."
                  : phone === "install"
                    ? "On iPhone, notifications work once Game Your Show is on your Home Screen: Share, then Add to Home Screen."
                    : "Your browser blocks notifications from this site. Allow them in its settings, then come back."}
              </small>
            </span>
            {phone === "off" && (
              <Btn tone="ink" data-show-notify-on className="h-11 flex-none px-3.5 text-sm" onClick={() => turnOn(() => qc.invalidateQueries({ queryKey: ["new-design", "profile"] }))}>
                Turn on
              </Btn>
            )}
          </div>
        )}

        <h4 className="type-caption mb-0.5 mt-5 text-[19px]">Just this show</h4>
        <div>
          {data?.moments.map((m) => {
            // Muted, everything but the reminders is quiet: those switches read Off and can't be changed until you unmute (the
            // user's pick, 2026-11-20), as Notifications' do while nothing reaches you; the reminders still come, so theirs stays.
            const quietByMute = !!muted && m.id !== "lineup";
            return (
              <div key={m.id}>
                <SwitchRow
                  data={`show-${m.id}`}
                  on={m.on && m.here}
                  still={quietByMute}
                  disabled={!m.on}
                  title={m.title}
                  line={
                    !m.on
                      ? "Off everywhere, in Your settings"
                      : !m.here
                        ? "Off for this show · it still lands in the bell"
                        : quietByMute
                          ? "Quiet while it's muted · back when you unmute"
                          : m.id === "lineup" && muted
                            ? "Still comes while it's muted"
                            : m.line
                  }
                  onChange={(on) => set(m, on)}
                />
              </div>
            );
          })}
        </div>
        {q.isError && <p className="py-6 text-center text-[14px] text-muted-foreground">Couldn&rsquo;t load them. Try again.</p>}
        <p className="mt-3 text-[13px] leading-snug text-muted-foreground">
          <NavLink href={`${paths.settings}?page=notifications`} className="font-semibold text-foreground underline underline-offset-2" onClick={() => onOpenChange(false)}>
            Your settings for every show
          </NavLink>
          , and how much couch chat reaches you. The bell on the hub keeps everything but chat.
        </p>
      </div>
    </Sheet>
  );
}

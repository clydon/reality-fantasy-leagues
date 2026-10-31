"use client";

import { useEffect, useState } from "react";
import { BellOff, BellRing, Smartphone } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { CHAT_CHOICES, MOMENTS, type ChatMode, type MomentId } from "@/lib/moments";
import { disablePushOnThisDevice, enablePushOnThisDevice, isIOS, isPushSupported, isStandalone, isThisDeviceSubscribed, notificationPermission } from "@/lib/push-client";
import type { Profile, profileApi } from "../data";
import { useMe } from "../session";
import { ADD_TO_HOME_ART } from "../show/remind";
import { toast } from "../ui/toast";
import { Recommended, Segmented, SettingBlock, SwitchRow } from "./controls";

// Settings' notifications (docs/PLAN-new-design.md step 15 part 2; the 2026-10-31 redesign, option D): in Quick settings,
// this phone (QuickPhone) and Couch chat's three choices (ChatSetting); under Everything else, Which notifications, the
// moments (moments.js: Lineup reminders, Early results are in, Final results are in, Invites and join requests, On the couch,
// and Backstage for whoever runs a game). When nothing reaches you (this phone's off and no other gets them), this phone is
// the screen's one yellow plate until you turn it on or say Not now. A switch saves as it's tapped, with Undo. Whatever's
// off, the bell on the hub still lists it.

type Save = (body: Parameters<typeof profileApi.save>[0], said: string, undo?: Parameters<typeof profileApi.save>[0]) => Promise<void>;

export type PhoneState = "loading" | "unsupported" | "install" | "blocked" | "off" | "on";

/** This phone: whether it can show notifications, and whether it's turned on (the browser's own state, not the account's).
 *  The reminder ask reads it too (show/remind.tsx). */
export function usePhone(): [PhoneState, (s: PhoneState) => void] {
  const [state, setState] = useState<PhoneState>("loading");
  useEffect(() => {
    let live = true;
    // The browser's push state is only there in the browser, read once the page is up.
    (async () => {
      const next: PhoneState = !isPushSupported()
        ? isIOS() && !isStandalone()
          ? "install"
          : "unsupported"
        : notificationPermission() === "denied"
          ? "blocked"
          : (await isThisDeviceSubscribed().catch(() => false))
            ? "on"
            : "off";
      if (live) setState(next);
    })();
    return () => {
      live = false;
    };
  }, []);
  return [state, setState];
}

/** Not now on the plate: this device stops asking (it's the person's own choice; the row still says Off). */
function useNotNow(): [boolean, () => void] {
  const me = useMe();
  const key = `gys-notify-not-now:${me.id}`;
  // Read as it mounts: the first render (server and browser alike) is still asking the browser, so it never shows the plate.
  const [said, setSaid] = useState(() => {
    try {
      return typeof window !== "undefined" && localStorage.getItem(key) === "1";
    } catch {
      return false;
    }
  });
  return [
    said,
    () => {
      try {
        localStorage.setItem(key, "1");
      } catch {}
      setSaid(true);
    },
  ];
}

const ROW: Record<PhoneState, { title: string; line: string }> = {
  loading: { title: "Notifications on this phone", line: "Checking…" },
  unsupported: { title: "This browser can't show notifications", line: "Everything still collects in the bell on the hub." },
  install: { title: "Add it to your Home Screen first", line: "On iPhone, notifications work once Game Your Show is on your Home Screen: Share, then Add to Home Screen." },
  blocked: { title: "Blocked on this phone", line: "Your browser's settings block notifications from this site. Allow them there, then come back." },
  off: { title: "Off on this phone", line: "Everything waits in the bell on the hub." },
  on: { title: "On for this phone", line: "The reminders and results you choose come here." },
};

/** Quick settings' first row: this phone's notifications, on or off. A plate when nothing reaches you yet. */
export function QuickPhone({ devices, state, setState }: { devices: number; state: PhoneState; setState: (s: PhoneState) => void }) {
  const [busy, setBusy] = useState(false);
  const [notNow, quiet] = useNotNow();
  const qc = useQueryClient();
  const toggle = async () => {
    setBusy(true);
    try {
      if (state === "on") {
        await disablePushOnThisDevice();
        setState("off");
        toast("Off for this phone");
      } else {
        await enablePushOnThisDevice();
        setState("on");
        toast("On for this phone");
      }
      void qc.invalidateQueries({ queryKey: ["new-design", "profile"] });
    } catch (e) {
      if (notificationPermission() === "denied") setState("blocked");
      // Our own refusals are in plain words; the browser's (its push service unreachable, say) aren't.
      toast.quiet(e instanceof DOMException || !(e as Error).message ? "Couldn't do that on this phone. Try again." : (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!devices && !notNow && (state === "off" || state === "install" || state === "blocked")) {
    const later = (
      <button type="button" data-phone-not-now onClick={quiet} className="h-11 px-3 text-[14px] font-semibold text-plate-foreground underline underline-offset-[3px]">
        Not now
      </button>
    );
    return (
      <div data-phone={state} data-phone-plate className="mb-3.5 mt-1 overflow-hidden rounded-[3px] bg-plate text-plate-foreground shadow-plate">
        <span className="type-caption tag-cut inline-block bg-chyron py-1.5 pl-3 pr-6 text-[14px] tracking-[0.04em] text-chyron-foreground">{state === "install" ? "One step first" : "This phone"}</span>
        <div className="px-3.5 pb-3 pt-2.5">
          <b className="type-caption block text-[24px]">{state === "install" ? "Add it to your Home Screen" : state === "blocked" ? "Notifications are blocked" : "Nothing reaches you yet"}</b>
          <p className="mt-1.5 text-[14px] leading-snug text-plate-muted">
            {state === "install"
              ? "On iPhone, reminders and results only reach you from the Home Screen app."
              : state === "blocked"
                ? "Your browser blocks them for this site. Allow them in its settings, then come back."
                : "Lineup reminders and results wait in the bell on the hub until notifications are on."}
          </p>
          {state === "install" ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- a static picture from public/, at its own size (the reminder ask's) */}
              <img
                src={ADD_TO_HOME_ART}
                alt="1: in Safari, tap Share, the square with an arrow pointing up. 2: tap Add to Home Screen. 3: open Game Your Show from your Home Screen."
                className="mt-3 block aspect-[372/120] w-full rounded-[4px]"
              />
              <ol className="mt-2 grid grid-cols-3 gap-2" aria-hidden>
                {["Tap Share", "Add to Home Screen", "Open it from there"].map((s, i) => (
                  <li key={s} className="flex items-start gap-1.5 text-[13px] font-bold leading-tight">
                    <i className="grid size-5 flex-none place-items-center rounded-full bg-plate-foreground text-[12px] not-italic text-plate">{i + 1}</i>
                    {s}
                  </li>
                ))}
              </ol>
              <div className="mt-1 flex justify-end">{later}</div>
            </>
          ) : (
            <div className="mt-3.5 flex items-center gap-1">
              {state === "off" && (
                <button
                  type="button"
                  data-phone-toggle
                  disabled={busy}
                  onClick={toggle}
                  className="nd-press h-11 flex-1 rounded-[3px] bg-plate-foreground px-4 text-[15px] font-bold text-plate disabled:opacity-60"
                >
                  {busy ? "…" : "Turn on notifications"}
                </button>
              )}
              <span className={state === "off" ? "" : "ml-auto"}>{later}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  const words = state === "off" && devices ? { ...ROW.off, line: `They go to your other ${devices === 1 ? "phone" : "devices"}. Turn them on here too.` } : ROW[state];
  const Icon = state === "on" ? BellRing : state === "off" || state === "loading" ? Smartphone : BellOff;
  return (
    // Still asking the browser: the page waits for it (ui/loaded.tsx) rather than saying "Checking…" and then the answer.
    <div className="flex min-h-[64px] items-center gap-3 py-2" data-phone={state} aria-busy={state === "loading" || undefined}>
      <span className="grid size-10 flex-none place-items-center rounded-[3px] bg-secondary">
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <b className="block text-[15px] font-semibold">{words.title}</b>
        <small className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">{words.line}</small>
      </span>
      {(state === "on" || state === "off") && (
        <button
          type="button"
          data-phone-toggle
          disabled={busy}
          onClick={toggle}
          className="nd-press h-11 flex-none rounded-[3px] bg-card px-3.5 text-sm font-semibold outline-1 -outline-offset-1 outline-edge disabled:opacity-60"
        >
          {busy ? "…" : state === "on" ? "Turn off" : "Turn on"}
        </button>
      )}
    </div>
  );
}

const CHAT_SHORT: Record<ChatMode, string> = { all: "Every message", quiet: "Quiet nights", off: "Never" };
const CHAT_LINE: Record<ChatMode, string> = {
  all: "Every message, as it's sent",
  quiet: "Quiet on episode nights: catch up when you reveal",
  off: "Never: check chat when you open the app",
};

/** Quick settings' Couch chat: Every message · Quiet nights (recommended) · Never, with Back to recommended once changed. */
export function ChatSetting({ p, save }: { p: Profile | undefined; save: Save }) {
  const chat = (p?.notify.chat ?? "quiet") as ChatMode;
  const pick = (id: ChatMode) => {
    if (!p) return;
    void save({ notify: { chat: id } }, `Couch chat: ${CHAT_CHOICES.find((c) => c.id === id)!.title}`, { notify: { chat } });
  };
  return (
    <SettingBlock
      data="settings-chat"
      title="Couch chat notifications"
      end={
        chat === "quiet" ? (
          <Recommended />
        ) : (
          <button type="button" data-chat-reset onClick={() => pick("quiet")} className="-my-2.5 min-h-11 text-[13px] font-semibold underline underline-offset-[3px]">
            Back to recommended
          </button>
        )
      }
      line={CHAT_LINE[chat]}
    >
      <Segmented
        label="Couch chat notifications"
        options={CHAT_CHOICES.map((c) => ({ id: c.id as ChatMode, title: CHAT_SHORT[c.id as ChatMode] }))}
        value={chat}
        onPick={pick}
        attrs={(id) => ({ "data-choice": `chat-${id}` })}
        disabled={!p}
      />
    </SettingBlock>
  );
}

/** What starts the switches below, by why this phone isn't getting them. */
const QUIET_LINE: Partial<Record<PhoneState, string>> = {
  off: "They start once you turn notifications on above. Until then, everything waits in the bell on the hub.",
  install: "They start once it's on your Home Screen and turned on there. Until then, everything waits in the bell on the hub.",
  blocked: "They start once your browser allows them. Until then, everything waits in the bell on the hub.",
  unsupported: "This browser can't show them. Everything waits in the bell on the hub.",
};

const shownMoments = (runs: boolean) => MOMENTS.filter((m) => m.id !== "chat" && (m.id !== "backstage" || runs));
/** Nothing reaches you: this phone isn't getting them and no other phone of yours is. */
const unreached = (p: Profile | undefined, phone: PhoneState) => !!p && !p.notify.devices && phone !== "on" && phone !== "loading";

/** Which notifications' line: how many are on, and whether any reach you. */
export function momentsLine(p: Profile | undefined, phone: PhoneState, runs: boolean) {
  const shown = shownMoments(runs);
  const on = shown.filter((m) => p?.notify.moments[m.id as Exclude<MomentId, "chat">] ?? true).length;
  return unreached(p, phone) ? `${on} of ${shown.length} chosen · none reach you yet` : `${on} of ${shown.length} on`;
}

/** Everything else's Which notifications: the moments, dimmed under a line when none of them reach you. `runs`: you run a game
 *  somewhere (Backstage's moment shows). */
export function MomentsList({ p, save, runs, phone }: { p: Profile | undefined; save: Save; runs: boolean; phone: PhoneState }) {
  const notify = p?.notify;
  // The switches pick what you hear; they only reach you once a phone gets notifications. With none that does, say so, so a
  // switch that's on doesn't read as a reminder that's coming.
  const quiet = unreached(p, phone) ? QUIET_LINE[phone] : null;
  return (
    <div data-settings-notify>
      {quiet && (
        <p data-notify-quiet={phone} className="mb-1 flex gap-2.5 text-[13px] leading-snug text-muted-foreground">
          <BellOff className="mt-0.5 size-4 flex-none" aria-hidden />
          <span>
            <b className="block text-[15px] font-semibold text-foreground">None of these reach you yet</b>
            {quiet}
          </span>
        </p>
      )}
      <div className={quiet ? "opacity-60" : undefined}>
        {shownMoments(runs).map((m) => {
          const on = notify?.moments[m.id as Exclude<MomentId, "chat">] ?? true;
          return (
            <SwitchRow
              key={m.id}
              data={`moment-${m.id}`}
              on={on}
              disabled={!notify}
              title={m.title}
              line={m.line}
              onChange={(next) => save({ notify: { moment: m.id, on: next } }, `${m.title}: ${next ? "on" : "off"}`, { notify: { moment: m.id, on: !next } })}
            />
          );
        })}
      </div>
      <p className="mt-3 text-[13px] leading-snug text-muted-foreground">
        A notification never says more than you&rsquo;ve seen: with Hide scores on, it&rsquo;s &ldquo;Episode 5 results are in&rdquo;, never who went home. Each show&rsquo;s ⋯ menu turns its own
        off, and the bell on the hub keeps everything either way.
      </p>
    </div>
  );
}

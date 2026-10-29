"use client";

import { useEffect, useState } from "react";
import { BellOff, BellRing, Smartphone } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { CHAT_CHOICES, MOMENTS, type ChatMode, type MomentId } from "@/lib/moments";
import { disablePushOnThisDevice, enablePushOnThisDevice, isIOS, isPushSupported, isStandalone, isThisDeviceSubscribed, notificationPermission } from "@/lib/push-client";
import type { Profile, profileApi } from "../data";
import { Btn } from "../ui/parts";
import { toast } from "../ui/toast";
import { Choice, SwitchRow } from "./controls";

// What we notify you about (docs/PLAN-new-design.md step 15 part 2; the mock's settings.js accountRoute): this phone's
// notifications on or off, then the moments (moments.js: Lineup reminders, Early results are in, Final scores are in, Invites and
// join requests, and two the mock didn't have: On the couch, and Backstage for whoever runs a game), then Couch chat's three
// choices. A switch saves as it's tapped, with Undo. Whatever's off, the bell on the hub still lists it.

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

function PhoneRow({ devices, state, setState }: { devices: number; state: PhoneState; setState: (s: PhoneState) => void }) {
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const words: Record<PhoneState, { title: string; line: string }> = {
    loading: { title: "Notifications on this phone", line: "Checking…" },
    unsupported: { title: "This browser can't show notifications", line: "Everything still collects in the bell on the hub." },
    install: { title: "Add it to your Home Screen first", line: "On iPhone, notifications work once Game Your Show is on your Home Screen: Share, then Add to Home Screen." },
    blocked: { title: "Blocked on this phone", line: "Your browser's settings block notifications from this site. Allow them there, then come back." },
    off: {
      title: "Off on this phone",
      line: devices ? `They go to your other ${devices === 1 ? "phone" : "devices"}. Turn them on here too.` : "Turn them on to hear when results are in and it's your move.",
    },
    on: { title: "On for this phone", line: "The moments you've switched on below come here." },
  };
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
  const Icon = state === "on" ? BellRing : state === "off" || state === "loading" ? Smartphone : BellOff;
  return (
    // Still asking the browser: the page waits for it (ui/loaded.tsx) rather than saying "Checking…" and then the answer.
    <div className="flex min-h-[64px] items-center gap-3 py-2" data-phone={state} aria-busy={state === "loading" || undefined}>
      <span className="grid size-10 flex-none place-items-center rounded-[3px] bg-secondary">
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <b className="block text-[15px] font-semibold">{words[state].title}</b>
        <small className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">{words[state].line}</small>
      </span>
      {(state === "on" || state === "off") && (
        <Btn className="h-10 flex-none px-3.5 text-sm" data-phone-toggle disabled={busy} onClick={toggle}>
          {busy ? "…" : state === "on" ? "Turn off" : "Turn on"}
        </Btn>
      )}
    </div>
  );
}

/** What starts the switches below, by why this phone isn't getting them. */
const QUIET_LINE: Partial<Record<PhoneState, string>> = {
  off: "They start once you turn notifications on above. Until then, everything waits in the bell on the hub.",
  install: "They start once it's on your Home Screen and turned on there. Until then, everything waits in the bell on the hub.",
  blocked: "They start once your browser allows them. Until then, everything waits in the bell on the hub.",
  unsupported: "This browser can't show them. Everything waits in the bell on the hub.",
};

/** Settings' "What we notify you about". `runs`: you run a game somewhere (Backstage's moment shows). */
export function NotifySection({ p, save, runs }: { p: Profile | undefined; save: Save; runs: boolean }) {
  const notify = p?.notify;
  const [phone, setPhone] = usePhone();
  const shown = MOMENTS.filter((m) => m.id !== "chat" && (m.id !== "backstage" || runs));
  // The switches pick what you hear; they only reach you once a phone gets notifications. With none that does (this one
  // isn't on and no other is), say so, so a switch that's on doesn't read as a reminder that's coming.
  const quiet = notify && !notify.devices && phone !== "on" && phone !== "loading" ? QUIET_LINE[phone] : null;
  return (
    <div data-settings-notify>
      <div className="px-4">
        <PhoneRow devices={notify?.devices ?? 0} state={phone} setState={setPhone} />
      </div>
      {quiet && (
        <p data-notify-quiet={phone} className="mx-4 mt-1 flex gap-2.5 border-t border-border pt-3 text-[13px] leading-snug text-muted-foreground">
          <BellOff className="mt-0.5 size-4 flex-none text-chyron-line" aria-hidden />
          <span>
            <b className="block text-[15px] font-semibold text-foreground">None of these reach you yet</b>
            {quiet}
          </span>
        </p>
      )}
      <div className="mt-1 px-4">
        {shown.map((m) => {
          const on = notify?.moments[m.id as Exclude<MomentId, "chat">] ?? true;
          return (
            <SwitchRow
              key={m.id}
              data={`moment-${m.id}`}
              on={on}
              disabled={!notify}
              title={m.title}
              line={m.line}
              onChange={(next) =>
                save({ notify: { moment: m.id, on: next } }, `${m.title}: ${next ? "on" : "off"}`, { notify: { moment: m.id, on: !next } })
              }
            />
          );
        })}
      </div>
      <div className="mt-4 px-4" role="radiogroup" aria-label="Couch chat">
        <b className="mb-1 block text-[17px] font-semibold">Couch chat</b>
        {CHAT_CHOICES.map((c) => (
          <Choice
            key={c.id}
            data={`chat-${c.id}`}
            on={(notify?.chat ?? "quiet") === c.id}
            title={c.title}
            line={c.line}
            recommended={c.recommended}
            onPick={() => notify && save({ notify: { chat: c.id as ChatMode } }, `Couch chat: ${c.title}`, { notify: { chat: notify.chat } })}
          />
        ))}
      </div>
      <p className="mx-4 mt-3 text-[13px] leading-snug text-muted-foreground">
        A notification never says more than you&rsquo;ve seen: with Hide scores on, it&rsquo;s &ldquo;Episode 5 results are in&rdquo;, never who went home. Each show&rsquo;s ⋯ menu turns its own
        off, and the bell on the hub keeps everything either way.
      </p>
    </div>
  );
}

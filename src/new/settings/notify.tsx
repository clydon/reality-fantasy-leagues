"use client";

import { useEffect, useState } from "react";
import { BellOff, BellRing, ChevronRight, Smartphone } from "lucide-react";
import { FaceStack } from "../couch/couch-sheets";
import { ShowArt } from "../ui/show-bar";
import type { Home } from "../data";
import { useQueryClient } from "@tanstack/react-query";
import { CHAT_CHOICES, MOMENTS, type ChatMode, type MomentId } from "@/lib/moments";
import { disablePushOnThisDevice, enablePushOnThisDevice, isIOS, isPushSupported, isStandalone, isThisDeviceSubscribed, notificationPermission } from "@/lib/push-client";
import type { Profile, profileApi } from "../data";
import { NavLink } from "../nav";
import { paths } from "../routes";
import { useMe } from "../session";
import { useNow } from "../ui/bars";
import { toast } from "../ui/toast";
import { muteEnd } from "./api";
import { Choice, PageSection, ResetLink, SwitchRow } from "./controls";

// Notifications, as one system (docs/PLAN-settings-overhaul.md Round 1; docs/design-round/settings-r1-spec.md and -first-view.md):
// the parts Your settings and its Notifications page share.
//   - The plate (PhonePlate), Your settings' one yellow, only while nothing reaches you (this phone's off and no other phone of
//     yours gets them): "Notifications are off on this phone", Turn on and Not now; blocked and not-installed say their own.
//   - This phone (ThisPhone): its state and its one action, on the Notifications page.
//   - What comes to your phones (Kinds): Reminders before your moves lock, Results, Your couch's activity, each a switch whose line
//     turns into what you'll still get once it's off; invites always come, said as a fact. While nothing reaches you, the switches
//     read as off: dimmed under a line saying so.
//   - Couch chat, on every couch (ChatSetting): Every message · Skip possible spoilers (recommended) · Never.
//   - Set on a show or a couch (Exceptions): every mute, a show's kinds turned off and a couch's own chat, each a link.
// Each change applies at once, with Undo in the toast.

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

/** Not now on the plate: this device stops asking (it's the person's own choice; Notifications still says Off). */
export function useNotNow(): [boolean, () => void] {
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

/** Nothing reaches you: this phone isn't getting them and no other phone of yours is. */
export const unreached = (p: Profile | undefined, phone: PhoneState) => !!p && !p.notify.devices && phone !== "on" && phone !== "loading";

/** Whether Your settings shows the plate: nothing reaches you, a state it can do something about, and no Not now here. */
export const plateShows = (p: Profile | undefined, phone: PhoneState, notNow: boolean) =>
  unreached(p, phone) && !notNow && (phone === "off" || phone === "install" || phone === "blocked");

/** Turning this phone on or off, from a tap (the browser's permission prompt needs one). */
function usePhoneToggle(state: PhoneState, setState: (s: PhoneState) => void) {
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const toggle = async () => {
    setBusy(true);
    try {
      if (state === "on") {
        await disablePushOnThisDevice();
        setState("off");
        toast("Off on this phone. Everything still lands in the bell");
      } else {
        await enablePushOnThisDevice();
        setState("on");
        toast("On for this phone");
      }
      void qc.invalidateQueries({ queryKey: ["new-design", "profile"] });
      void qc.invalidateQueries({ queryKey: ["new-design", "phones"] });
    } catch (e) {
      if (notificationPermission() === "denied") setState("blocked");
      // Our own refusals are in plain words; the browser's (its push service unreachable, say) aren't.
      toast.quiet(e instanceof DOMException || !(e as Error).message ? "Couldn't do that on this phone. Try again." : (e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return { busy, toggle };
}

/** Your settings' one yellow: the plate, only while nothing reaches you (and you haven't said Not now on this phone). `onInstall`
 *  opens Install the app. */
export function PhonePlate({
  p,
  state,
  setState,
  onInstall,
  onAllow,
  notNow,
  quiet,
}: {
  p: Profile | undefined;
  state: PhoneState;
  setState: (s: PhoneState) => void;
  onInstall: () => void;
  /** Blocked: how to allow them in this browser. */
  onAllow: () => void;
  notNow: boolean;
  quiet: () => void;
}) {
  const { busy, toggle } = usePhoneToggle(state, setState);
  if (!plateShows(p, state, notNow)) return null;
  const later = (
    <button type="button" data-phone-not-now onClick={quiet} className="h-11 px-3 text-[14px] font-semibold text-plate-foreground underline underline-offset-[3px]">
      Not now
    </button>
  );
  return (
    <div data-phone={state} data-phone-plate className="mx-4 mt-4 overflow-hidden rounded-[3px] bg-plate text-plate-foreground shadow-plate">
      <span className="type-caption tag-cut inline-block bg-chyron py-1.5 pl-3 pr-6 text-[14px] tracking-[0.04em] text-chyron-foreground">{state === "install" ? "One step first" : "This phone"}</span>
      <div className="px-3.5 pb-3 pt-2.5">
        <b className="type-caption block text-[24px] leading-none">
          {state === "install" ? "Add it to your Home Screen" : state === "blocked" ? "Notifications are blocked" : "Notifications are off"}
        </b>
        <p className="mt-1.5 text-[14px] leading-snug text-plate-muted">
          {state === "install"
            ? "On iPhone, reminders and results only reach you from the Home Screen app."
            : state === "blocked"
              ? "Your browser blocks them for this site. Allow them in its settings, then come back."
              : "Reminders before your moves lock, and results, wait in the bell on the hub until you turn them on."}
        </p>
        <div className="mt-3 flex items-center gap-1">
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
          {(state === "install" || state === "blocked") && (
            <button
              type="button"
              data-phone-install={state === "install" ? "" : undefined}
              data-phone-allow={state === "blocked" ? "" : undefined}
              onClick={state === "install" ? onInstall : onAllow}
              className="nd-press h-11 flex-1 rounded-[3px] bg-plate-foreground px-4 text-[15px] font-bold text-plate"
            >
              Show me how
            </button>
          )}
          <span>{later}</span>
        </div>
      </div>
    </div>
  );
}

const PHONE_ROW: Record<PhoneState, { title: string; line: string }> = {
  loading: { title: "Notifications on this phone", line: "Checking…" },
  unsupported: { title: "This browser can't show notifications", line: "Everything still lands in the bell on the hub." },
  install: { title: "Add it to your Home Screen first", line: "On iPhone, notifications only work from the Home Screen app." },
  blocked: { title: "Blocked on this phone", line: "Your browser blocks them for this site. Allow them in its settings, then come back." },
  off: { title: "Off on this phone", line: "Everything waits in the bell on the hub." },
  on: { title: "On for this phone", line: "What you choose below comes here." },
};

/** The Notifications page's first row: this phone, its state and its one action. `devices`: how many phones of yours get them. */
export function ThisPhone({
  devices,
  state,
  setState,
  onInstall,
  onAllow,
}: {
  devices: number;
  state: PhoneState;
  setState: (s: PhoneState) => void;
  onInstall: () => void;
  onAllow: () => void;
}) {
  const { busy, toggle } = usePhoneToggle(state, setState);
  const others = state === "on" ? devices - 1 : devices;
  const words = state === "off" && others > 0 ? { ...PHONE_ROW.off, line: `Your other ${others === 1 ? "phone gets" : `${others} phones get`} them. Turn them on here too.` } : PHONE_ROW[state];
  const Icon = state === "on" ? BellRing : state === "off" || state === "loading" ? Smartphone : BellOff;
  return (
    // Still asking the browser: the page waits for it (ui/loaded.tsx) rather than saying "Checking…" and then the answer.
    <div className="flex min-h-[64px] items-center gap-3 py-2" data-phone={state} aria-busy={state === "loading" || undefined}>
      <span className={`grid size-10 flex-none place-items-center rounded-[3px] ${state === "on" ? "bg-foreground text-background" : "bg-secondary"}`}>
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
      {(state === "install" || state === "blocked") && (
        <button
          type="button"
          data-phone-install={state === "install" ? "" : undefined}
          data-phone-allow={state === "blocked" ? "" : undefined}
          onClick={state === "install" ? onInstall : onAllow}
          className="nd-press h-11 flex-none rounded-[3px] bg-card px-3.5 text-sm font-semibold outline-1 -outline-offset-1 outline-edge"
        >
          Show me how
        </button>
      )}
    </div>
  );
}

/** The kinds a switch covers on Your settings (Couch chat is its own choice; invites always come). Solo: no couch, so no couch kinds. */
const kindsOf = (solo: boolean) => MOMENTS.filter((m) => m.id !== "chat" && !m.fixed && (!solo || m.id !== "couch"));
const SHORT: Partial<Record<MomentId, string>> = { lineup: "reminders", results: "results", couch: "your couch" };

/** Your settings' Notifications row: what reaches you, read as off while nothing does. While the plate says that already
 *  (`plate`), the row says what's chosen instead, so the first view doesn't say "off" three times. */
export function notifyValue(p: Profile | undefined, phone: PhoneState, solo: boolean, plate = false): { text: string; off: boolean } {
  if (!p || phone === "loading") return { text: "…", off: false };
  const on = kindsOf(solo).filter((m) => p.notify.moments[m.id as Exclude<MomentId, "chat">]);
  if (plate) return { text: on.length ? `Chosen: ${on.map((m) => SHORT[m.id]).join(", ")}` : "Nothing chosen", off: false };
  const others = phone === "on" ? p.notify.devices - 1 : p.notify.devices;
  if (phone !== "on" && !others) {
    const why = phone === "blocked" ? "Blocked on this phone" : phone === "install" ? "Add it to your Home Screen first" : phone === "unsupported" ? "This browser can't show them" : "Off on this phone";
    return { text: why, off: true };
  }
  const what = on.length ? on.map((m) => SHORT[m.id]).join(", ") : "nothing chosen";
  return { text: phone === "on" ? `On · ${what}` : `On for your other ${others === 1 ? "phone" : "phones"} · off here`, off: false };
}

/** What comes to your phones: a switch a kind, each line turning into what you'll still get once it's off. */
export function Kinds({ p, save, phone, solo }: { p: Profile | undefined; save: Save; phone: PhoneState; solo: boolean }) {
  const notify = p?.notify;
  const quiet = unreached(p, phone);
  const invites = MOMENTS.find((m) => m.id === "invites")!;
  return (
    <PageSection
      data="settings-kinds"
      title="What comes to your phones"
      line={quiet ? <b className="font-semibold text-foreground" data-notify-quiet={phone}>None of these reach you until notifications are on.</b> : undefined}
    >
      {/* While nothing reaches you the switches read as off (the plan: "the kinds read as off while this phone is"), read-only,
          each saying whether it's chosen; they come back as chosen once a phone gets them. */}
      <div>
        {kindsOf(solo).map((m) => {
          const on = notify?.moments[m.id as Exclude<MomentId, "chat">] ?? true;
          return (
            <SwitchRow
              key={m.id}
              data={`moment-${m.id}`}
              on={on}
              still={quiet}
              disabled={!notify}
              title={m.title}
              line={quiet ? (on ? "Chosen · comes once notifications are on" : "Not chosen") : on ? m.line : "Off · they still land in the bell on the hub"}
              onChange={(next) => save({ notify: { moment: m.id, on: next } }, `${m.title}: ${next ? "on" : "off. They still land in the bell"}`, { notify: { moment: m.id, on: !next } })}
            />
          );
        })}
      </div>
      <p data-moment-fixed="invites" className="border-t border-border py-3 text-[13px] leading-snug text-muted-foreground">
        <b className="block text-[15px] font-semibold text-foreground">{invites.title}</b>
        {invites.line}
      </p>
    </PageSection>
  );
}

const CHAT_TITLE = (c: ChatMode) => CHAT_CHOICES.find((x) => x.id === c)!.title;

/** Couch chat, on every couch: your account's choice, with Reset to recommended once changed. */
export function ChatSetting({ p, save }: { p: Profile | undefined; save: Save }) {
  const chat = (p?.notify.chat ?? "quiet") as ChatMode;
  const pick = (id: ChatMode) => {
    if (!p || id === chat) return;
    void save({ notify: { chat: id } }, `Couch chat: ${CHAT_TITLE(id)}`, { notify: { chat } });
  };
  return (
    <PageSection data="settings-chat" title="Couch chat, on every couch" line="A couch can have its own, set on its page.">
      <div role="radiogroup" aria-label="Couch chat, on every couch">
        {CHAT_CHOICES.map((c) => (
          <Choice key={c.id} data={`chat-${c.id}`} on={chat === c.id} title={c.title} line={c.line} recommended={c.recommended} onPick={() => pick(c.id)} />
        ))}
      </div>
      {chat !== "quiet" && (
        <div className="mt-1">
          <ResetLink data="chat" label="Reset to recommended" onClick={() => pick("quiet")} />
        </div>
      )}
    </PageSection>
  );
}

/** One line for what a show's own setting leaves you with: "Show · muted until Thu, Nov 27". */
function showLine(muted: string | null, off: MomentId[], now: number) {
  const offWords = off.map((m) => (m === "lineup" ? "reminders" : m === "results" ? "results" : m === "couch" ? "couch activity" : "chat")).join(", ");
  if (muted) return `Show · muted ${muteEnd(muted, now)}${offWords ? ` · ${offWords} off` : ""}`;
  return `Show · ${offWords} off here`;
}

/** Set on a show or a couch: every exception, each a link to where it's set, led by the show's art or the couch's faces (a show
 *  and a couch can share a name). With none, where you'd set one. */
export function Exceptions({ p, home, onCouch }: { p: Profile | undefined; home: Home | undefined; onCouch: (couchId: string) => void }) {
  const now = useNow(false);
  const shows = p?.notify.elsewhere.shows ?? [];
  const couches = p?.notify.elsewhere.couches ?? [];
  return (
    <PageSection
      data="settings-elsewhere"
      title="Set on a show or a couch"
      line={shows.length || couches.length ? "Each applies there, over what's above." : "Mute a show from its ⋯ menu, or set a couch's chat on its page."}
    >
      {shows.map((s) => {
        const season = home?.shows.find((x) => x.seasonId === s.seasonId);
        const body = (
          <>
            <span className="grid w-[60px] flex-none place-items-start">
              <ShowArt seasonId={s.seasonId ?? s.showId} artUrl={season?.show.artUrl ?? null} name={s.show} bare className="size-10 rounded-[3px]" />
            </span>
            <span className="min-w-0 flex-1">
              <b className="block truncate text-[15px] font-semibold">{s.show}</b>
              <small className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">{showLine(s.muted, s.off, now)}</small>
            </span>
            {s.seasonId && <ChevronRight className="size-5 flex-none text-muted-foreground" aria-hidden />}
          </>
        );
        return s.seasonId ? (
          <NavLink key={s.showId} data-exception-show={s.show} href={`${paths.show(s.seasonId)}?notify=1`} className="nd-press flex min-h-[60px] items-center gap-3 border-t border-border py-2 first:border-t-0">
            {body}
          </NavLink>
        ) : (
          <div key={s.showId} data-exception-show={s.show} className="flex min-h-[60px] items-center gap-3 border-t border-border py-2 first:border-t-0">
            {body}
          </div>
        );
      })}
      {couches.map((c) => (
        <button
          key={c.couchId}
          type="button"
          data-exception-couch={c.name}
          onClick={() => onCouch(c.couchId)}
          className="nd-press flex min-h-[60px] w-full items-center gap-3 border-t border-border py-2 text-left first:border-t-0"
        >
          <span className="grid w-[60px] flex-none place-items-start">
            <FaceStack people={home?.couches.find((x) => x.id === c.couchId)?.members ?? []} size={22} />
          </span>
          <span className="min-w-0 flex-1">
            <b className="block truncate text-[15px] font-semibold">{c.name}</b>
            <small className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">Couch · chat: {CHAT_TITLE(c.chat).toLowerCase()}</small>
          </span>
          <ChevronRight className="size-5 flex-none text-muted-foreground" aria-hidden />
        </button>
      ))}
    </PageSection>
  );
}

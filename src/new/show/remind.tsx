"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { BellRing, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { enablePushOnThisDevice, notificationPermission } from "@/lib/push-client";
import { useProfile } from "../data";
import { episodesOf, type ShowData } from "../screens/show-space";
import { useMe } from "../session";
import { useNow } from "../ui/bars";
import { usePhone, type PhoneState } from "../settings/notify";
import { Btn } from "../ui/parts";
import { Sheet } from "../ui/sheet";
import { toast } from "../ui/toast";
import { IconBox } from "./parts";

// The reminder ask (the 2026-10-26 archetype critique's P0, option B of .impeccable/mocks/reminders/index.html): reminders are
// web push only and the way in never asks, so the person who most needs one (the Fan Who Forgets) never gets one. Once, right
// after the first save in Your moves, a sheet shows the notification itself and asks; on an iPhone outside the installed app it
// shows Add to Home Screen as three pictures instead, and asks again once the app is opened from there. Not now leaves a quiet
// row under Tonight's heading until it's closed; a move that slipped by brings it back once ("Episode 6's pick slipped by"), at
// most once a week. Only while no phone of yours gets notifications (this phone not on, Settings' notify.devices 0), only on a
// season with a schedule (no schedule, no reminders), never on the way in. Remembered on this device, per account: no backend.

/** The three pictures of Add to Home Screen. Placeholder art: the generated image replaces this file (no labels in it; the
 *  sheet writes them). */
export const ADD_TO_HOME_ART = "/remind/add-to-home-screen.svg";

const WEEK = 7 * 24 * 60 * 60 * 1000;

interface Memory {
  /** When the sheet asked, and what this phone could do then ("install": the pictures, so it asks again once installed). */
  asked?: { at: number; as: "off" | "install" };
  /** The row under Tonight's heading was closed. */
  closed?: number;
  /** The last missed move the row said "slipped by" about, and when. */
  slipped?: { key: string; at: number };
}

const keyOf = (userId: string) => `gys.remind.${userId}`;
let memory: { userId: string; m: Memory } | null = null;
/** The sheet: closed, asked for after a save (`kinds`: what was saved), or opened from the row. */
let sheet: { open: boolean; kinds: string[]; fromRow: boolean } = { open: false, kinds: [], fromRow: false };
/** This phone, once turned on (or blocked) from here, until the page reloads and the browser says so itself. */
let phoneNow: PhoneState | null = null;
let version = 0;
const listeners = new Set<() => void>();
const emit = () => {
  version++;
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const useVersion = () => useSyncExternalStore(subscribe, () => version, () => 0);

function read(userId: string): Memory {
  if (memory?.userId === userId) return memory.m;
  let m: Memory = {};
  try {
    m = JSON.parse(localStorage.getItem(keyOf(userId)) ?? "{}") ?? {};
  } catch {
    /* nothing remembered: as if never asked */
  }
  memory = { userId, m };
  return m;
}

function remember(userId: string, patch: Memory) {
  const m = { ...read(userId), ...patch };
  memory = { userId, m };
  try {
    localStorage.setItem(keyOf(userId), JSON.stringify(m));
  } catch {
    /* not kept past this page: it may ask again */
  }
  emit();
}

/** Your moves saved: ask once, if this device hasn't (or asked only for the Home Screen and the app is installed now). */
export function askAfterSave(kinds: string[]) {
  sheet = { open: true, kinds, fromRow: false };
  emit();
}

const closeSheet = () => {
  sheet = { ...sheet, open: false };
  emit();
};

/** Whether this phone could start getting them from here: off (Turn on), or an iPhone outside the installed app (the pictures). */
export const askable = (p: PhoneState): p is "off" | "install" => p === "off" || p === "install";

/** The phone's state as the ask sees it, and whether any phone of yours gets notifications (null until the profile's read).
 *  The show's ⋯ menu and its Notifications sheet read it too, so what they say about this phone is what the ask says. */
export function useReach(wanted: boolean) {
  useVersion();
  const [browser] = usePhone();
  const phone = phoneNow ?? browser;
  const p = useProfile(wanted && askable(phone));
  const reaches = phone === "on" ? true : p.data ? p.data.notify.devices > 0 : null;
  return { phone, reaches };
}

/** Turns this phone on from a tap (the permission prompt needs one), then says so. */
export async function turnOn(after: () => void) {
  try {
    await enablePushOnThisDevice();
    phoneNow = "on";
    emit();
    toast("On for this phone. We'll nudge you before anything locks.");
    after();
  } catch (e) {
    if (notificationPermission() === "denied") {
      phoneNow = "blocked";
      emit();
    }
    toast.quiet(e instanceof DOMException || !(e as Error).message ? "Couldn't do that on this phone. Try again." : (e as Error).message);
  }
}

/** The reminder you'd get: for the next episode after this one (you've just set this one), as db/reminders.js words it. */
function lockScreen(show: ShowData, kinds: string[]) {
  const up = show.upNext;
  if (!up?.airAt) return null;
  const last = episodesOf(show);
  const next = !last || up.number < last;
  const n = next ? up.number + 1 : up.number;
  // A week on by the calendar, not by the hour (a week can cross a clock change), then two hours before.
  const at = new Date(up.airAt);
  if (next) at.setDate(at.getDate() + 7);
  at.setHours(at.getHours() - 2);
  const kind = kinds.includes("pick") ? "pick" : kinds.includes("lineup") ? "lineup" : show.play?.some((g) => g.pick) ? "pick" : "lineup";
  const game = show.play?.find((g) => (kind === "pick" ? g.pick : g.lineup)) ?? show.play?.[0];
  return {
    clock: at.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).replace(/\s?[AP]M$/i, ""),
    date: at.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }),
    title: `${game?.name ?? "Your game"}: episode ${n} airs in about 2 hours`,
    body: kind === "pick" ? `Make your episode ${n} pick` : `Set your episode ${n} lineup`,
    before: `${game?.name ?? "Your game"}: episode ${n} airs in about 24 hours`,
  };
}

function Notification({ title, body, when, dim }: { title: string; body?: string; when: string; dim?: boolean }) {
  return (
    <div className={`mt-2 flex items-start gap-2.5 rounded-[14px] bg-white/[.14] px-3 py-2.5 backdrop-blur-md ${dim ? "scale-[.97] opacity-70" : ""}`}>
      <span className="type-caption grid size-[34px] flex-none place-items-center rounded-[8px] bg-[#ffc531] text-[11px] text-[#121018]" aria-hidden>
        GYS
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex justify-between text-[12px] font-bold text-white/75">
          <span>GAME YOUR SHOW</span>
          <span>{when}</span>
        </span>
        <b className="block text-[14px] leading-snug text-white">{title}</b>
        {body && <span className="block text-[13px] leading-snug text-white/85">{body}</span>}
      </span>
    </div>
  );
}

/** The sheet: mounted once in the show space, opened after a save or from the row. */
export function RemindSheet({ show }: { show: ShowData }) {
  const me = useMe();
  useVersion();
  const qc = useQueryClient();
  const asked = read(me.id).asked;
  const want = sheet.open && !!show.upNext?.airAt && !show.upNext.live;
  const { phone, reaches } = useReach(want);
  // After a save it asks once per device, again only if it showed the pictures and the app's on the Home Screen now; from the
  // row, it's asked for.
  const due = want && askable(phone) && (sheet.fromRow || !asked || (asked.as === "install" && phone === "off"));
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!sheet.open || phone === "loading" || (due && reaches === null)) return;
    if (!due || reaches) return closeSheet();
    // Just after Your moves closes: a beat, so one sheet goes before the next comes.
    const t = setTimeout(() => {
      if (!sheet.fromRow) remember(me.id, { asked: { at: Date.now(), as: phone as "off" | "install" } });
      setOpen(true);
    }, 450);
    return () => clearTimeout(t);
  }, [due, reaches, phone, me.id]);
  const close = () => {
    setOpen(false);
    closeSheet();
  };
  const pic = lockScreen(show, sheet.kinds);
  const install = phone === "install";
  return (
    <Sheet open={open} onOpenChange={(o) => !o && close()} title="Want a nudge?" subtitle={install ? "On iPhone it takes one step first, about 10 seconds." : undefined}>
      <div data-remind-sheet={install ? "install" : "off"}>
        {install ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- a static picture from public/, at its own size */}
            <img
              src={ADD_TO_HOME_ART}
              alt="1: in Safari, tap Share, the square with an arrow pointing up. 2: tap Add to Home Screen. 3: open Game Your Show from your Home Screen."
              className="block aspect-[372/120] w-full rounded-[6px]"
            />
            <ol className="mt-2 grid grid-cols-3 gap-2" aria-hidden>
              {["Tap Share", "Add to Home Screen", "Open it from there"].map((s, i) => (
                <li key={s} className="flex items-start gap-1.5 text-[14px] font-bold leading-tight">
                  <i className="grid size-5 flex-none place-items-center rounded-full bg-foreground text-[12px] not-italic text-background">{i + 1}</i>
                  {s}
                </li>
              ))}
            </ol>
            <Btn tone="ink" wide className="mt-5" data-remind-got onClick={close}>
              Got it
            </Btn>
          </>
        ) : (
          <>
            <p className="mb-4 text-[15px] leading-snug text-muted-foreground">We&rsquo;ll tap your phone before anything locks, so a move is never missed.</p>
            {pic && (
              <div
                data-remind-picture
                role="img"
                aria-label={`A notification on your lock screen: ${pic.title}. ${pic.body}.`}
                className="mb-5 overflow-hidden rounded-[6px] bg-[linear-gradient(160deg,#3a2f5a_0%,#1d1830_55%,#120f1c_100%)] px-3 pb-3.5 pt-4"
              >
                <div className="text-center text-[64px] font-light leading-none tracking-[-.02em] text-white">{pic.clock}</div>
                <div className="mb-3.5 mt-0.5 text-center text-[14px] font-semibold text-white/85">{pic.date}</div>
                <Notification title={pic.title} body={pic.body} when="now" />
                <Notification title={pic.before} when="yesterday" dim />
              </div>
            )}
            <Btn tone="ink" wide data-remind-on onClick={() => turnOn(close).then(() => qc.invalidateQueries({ queryKey: ["new-design", "profile"] }))}>
              Turn on
            </Btn>
          </>
        )}
        <button type="button" data-remind-later onClick={close} className="mt-1 h-11 w-full text-[15px] font-bold text-muted-foreground">
          Not now
        </button>
        {!install && <p className="mt-1 text-center text-[13px] text-muted-foreground">Change what you hear anytime in Settings.</p>}
      </div>
    </Sheet>
  );
}

/** The last episode you've seen, if a move of yours for it never came in: "Episode 6's pick slipped by". */
function slippedBy(show: ShowData, seasonId: string) {
  const e = show.episodes?.episodes.find((x) => x.status === "seen");
  const missed = e?.lines?.filter((l) => l.missed) ?? [];
  if (!e || !missed.length) return null;
  const what = missed.every((l) => l.gameType === "pickem") ? "pick" : missed.every((l) => l.gameType === "active-roster") ? "lineup" : "moves";
  return { key: `${seasonId}:${e.number}`, title: `Episode ${e.number}'s ${what} slipped by` };
}

/** Under Tonight's heading: after Not now, until it's closed; or once after a move slipped by. */
export function RemindRow({ seasonId, show }: { seasonId: string; show: ShowData }) {
  const me = useMe();
  useVersion();
  const m = read(me.id);
  const now = useNow(false);
  const up = show.upNext;
  const slip = slippedBy(show, seasonId);
  const freshSlip = slip && m.slipped?.key !== slip.key && (!m.slipped || now - m.slipped.at > WEEK) ? slip : null;
  const want = !!up?.airAt && !up.live && (!!freshSlip || (!!m.asked && !m.closed));
  const { phone, reaches } = useReach(want);
  if (!want || !askable(phone) || reaches !== false) return null;
  const close = () => remember(me.id, freshSlip ? { closed: Date.now(), slipped: { key: freshSlip.key, at: Date.now() } } : { closed: Date.now() });
  const on = () => {
    if (phone === "install") {
      sheet = { open: true, kinds: [], fromRow: true };
      emit();
    } else void turnOn(() => {});
  };
  return (
    <div data-remind-row={freshSlip ? "slipped" : "ask"} className="mx-4 flex items-center gap-3 border-b border-border py-3.5">
      <IconBox icon={BellRing} />
      <span className="min-w-0 flex-1">
        <b className="block text-[15px] font-bold leading-tight">{freshSlip ? freshSlip.title : "Get a nudge before it locks?"}</b>
        <small className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">
          {freshSlip ? `Want a nudge before Episode ${up!.number} locks?` : "The day before, and 2 hours before."}
        </small>
      </span>
      <Btn className="h-10 flex-none px-3.5 text-sm" data-remind-row-on onClick={on}>
        Turn on
      </Btn>
      <button type="button" aria-label="Not now" data-remind-row-close onClick={close} className="-ml-1.5 grid h-10 w-8 flex-none place-items-center text-muted-foreground">
        <X className="size-[18px]" aria-hidden />
      </button>
    </div>
  );
}

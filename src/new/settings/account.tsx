"use client";

import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AtSign, Download, KeyRound, MonitorSmartphone, Smartphone, UserRound } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useInstallPrompt } from "@/lib/use-install-prompt";
import { switchDesign, type Profile } from "../data";
import { paths } from "../routes";
import { ADD_TO_HOME_ART } from "../show/remind";
import { useNow } from "../ui/bars";
import { Btn, Row } from "../ui/parts";
import { Sheet } from "../ui/sheet";
import { toast } from "../ui/toast";
import { phonesApi, PHONES_KEY, usePhones, type PhoneRow } from "./api";
import { GroupRow, PageSection, Segmented } from "./controls";

// Your account, Your phones and Install the app (settings Round 1; docs/design-round/settings-r1-spec.md):
//   - Your account: your sign-in name (it's also the name your couch sees), Change password, Google, Your phones, Install the app,
//     and Back to the classic design until it goes after Dec 16 (C10). An email and deleting your account wait on BACKLOG 185.
//   - Your phones (A3): the phones and computers that get your notifications, each with Turn off, and where you're signed in, with
//     Sign out everywhere else (a sentence first; it also stops the other phones' notifications).
//   - Install the app (A5): the steps for this kind of phone first, the others a tap away; Chrome's own Install where it offers one.

/** "2 days ago", "Nov 18" (the bell's words, said in full). */
function when(iso: string | null, now: number) {
  if (!iso) return "";
  const m = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  if (m < 2) return "just now";
  if (m < 60) return `${m} minutes ago`;
  if (m < 24 * 60) return `${Math.round(m / 60)} ${Math.round(m / 60) === 1 ? "hour" : "hours"} ago`;
  if (m < 7 * 24 * 60) return `${Math.round(m / (24 * 60))} ${Math.round(m / (24 * 60)) === 1 ? "day" : "days"} ago`;
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}

/** Your settings' Your account row: how you sign in (your phones' state is Notifications' to say). */
export function accountValue(p: Profile | undefined) {
  if (!p) return "…";
  const name = p.account.username ?? p.name;
  return `${name} · ${p.account.password ? "password" : "Google"}${p.account.password && p.account.google.linked ? " and Google" : ""}, your phones`;
}

export function AccountPage({ p, onPassword, onPhones, onInstall }: { p: Profile | undefined; onPassword: () => void; onPhones: () => void; onInstall: () => void }) {
  const [linking, setLinking] = useState(false);
  const [switching, setSwitching] = useState(false);
  const { standalone } = useInstallPrompt();
  const phones = usePhones(!!p);
  const username = p?.account.username ?? p?.name ?? "";
  const googleOnly = !!p && !p.account.password && p.account.google.linked;
  const notifyCount = phones.data?.notify.length ?? p?.notify.devices ?? 0;
  const signedIn = phones.data?.signedIn.length ?? 0;
  return (
    <div data-settings-account className="pb-10">
      <PageSection title="Signing in">
        <Row icon={UserRound} title={username} detail={googleOnly ? "Signed in with Google. It's also the name your couch sees" : "Your name is how you sign in, and the name your couch sees"} />
        {p?.account.password && <Row icon={KeyRound} title="Change password" onClick={onPassword} />}
        {p?.account.google.available && (
          <Row
            icon={AtSign}
            title={p.account.google.linked ? "Google is linked" : linking ? "Opening Google…" : "Link Google"}
            detail={p.account.google.linked ? "You can sign in with Google too" : "Sign in with your Google account as well"}
            onClick={
              p.account.google.linked
                ? undefined
                : async () => {
                    setLinking(true);
                    const r = await authClient.linkSocial({ provider: "google", callbackURL: `${paths.settings}?page=account` }).catch(() => null);
                    if (!r || r.error) {
                      setLinking(false);
                      toast.quiet("Couldn't open Google. Try again.");
                    }
                  }
            }
          />
        )}
      </PageSection>
      <PageSection title="Your phones">
        <GroupRow
          id="phones"
          icon={Smartphone}
          title="Your phones"
          value={`${notifyCount ? `${notifyCount} ${notifyCount === 1 ? "gets" : "get"} notifications` : "None get notifications"}${signedIn ? ` · signed in on ${signedIn}` : ""}`}
          onClick={onPhones}
        />
        <GroupRow id="install" icon={Download} title="Install the app" value={standalone ? "Installed on this phone" : "An icon on your Home Screen, and notifications on iPhone"} onClick={onInstall} />
      </PageSection>
      <PageSection title="Classic design">
        <Row
          icon={MonitorSmartphone}
          title={switching ? "Switching…" : "Back to the classic design"}
          detail="Until December 16. Newer games (Weekly Calls, Bingo, questions) only show here"
          onClick={async () => {
            if (switching) return;
            setSwitching(true);
            try {
              await switchDesign("classic");
            } catch {
              setSwitching(false);
              toast.quiet("Couldn't switch. Try again.");
            }
          }}
        />
      </PageSection>
    </div>
  );
}

function PhoneLine({ r, now, action, used }: { r: PhoneRow; now: number; action?: ReactNode; used?: boolean }) {
  return (
    <div data-phone-row={r.here ? "here" : r.id} className="flex min-h-[60px] items-center gap-3 border-t border-border py-2 first:border-t-0">
      <span className="min-w-0 flex-1">
        <b className="block truncate text-[15px] font-semibold">
          {r.name}
          {r.here && <span className="type-caption ml-2 rounded-[2px] bg-foreground px-1.5 text-[11px] text-background">This one</span>}
        </b>
        <small className="block text-[13px] text-muted-foreground">
          {r.at ? (used ? `Last used ${when(r.at, now)}` : r.fresh ? `Turned on ${when(r.at, now)}, nothing sent yet` : `Last notification ${when(r.at, now)}`) : ""}
        </small>
      </span>
      {action}
    </div>
  );
}

export function PhonesPage({ open }: { open: boolean }) {
  const phones = usePhones(open);
  const qc = useQueryClient();
  const now = useNow(false);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const data = phones.data;
  const after = () => {
    void qc.invalidateQueries({ queryKey: PHONES_KEY });
    void qc.invalidateQueries({ queryKey: ["new-design", "profile"] });
  };
  const turnOff = async (r: PhoneRow) => {
    setBusy(r.id);
    try {
      await phonesApi.turnOff(r.id);
      toast(`${r.name}: notifications off`);
      after();
    } catch (e) {
      toast.quiet((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  const signOut = async () => {
    setBusy("others");
    try {
      const { signedOut } = await phonesApi.signOutOthers();
      setAsking(false);
      toast(signedOut ? `Signed out of ${signedOut} ${signedOut === 1 ? "other place" : "other places"}` : "Nowhere else to sign out of");
      after();
    } catch (e) {
      toast.quiet((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  if (!data) return <div aria-busy className="mx-4 mt-4 h-40 animate-pulse rounded-[3px] bg-card" />;
  const others = data.signedIn.filter((r) => !r.here).length;
  return (
    <div data-settings-phones className="pb-10">
      <PageSection title="Get notifications" line={data.notify.length ? undefined : "No phone gets your notifications yet. Turn them on in Notifications."}>
        {data.notify.map((r) => (
          <PhoneLine
            key={r.id}
            r={r}
            now={now}
            action={
              <button
                type="button"
                data-phone-off={r.id}
                disabled={busy === r.id}
                onClick={() => turnOff(r)}
                className="nd-press h-11 flex-none rounded-[3px] bg-card px-3.5 text-sm font-semibold outline-1 -outline-offset-1 outline-edge disabled:opacity-60"
              >
                {busy === r.id ? "…" : "Turn off"}
              </button>
            }
          />
        ))}
      </PageSection>
      <PageSection title="Signed in">
        {data.signedIn.map((r) => (
          <PhoneLine key={r.id} r={r} now={now} used />
        ))}
        {others > 0 &&
          (asking ? (
            // One confirm style (settings Round 1's check): the safe choice filled, on the left; the one that can't be undone outlined.
            <div data-sign-out-others="ask" className="mt-3 rounded-[3px] bg-card p-3 text-[14px] leading-snug outline-1 -outline-offset-1 outline-border">
              Your other {others === 1 ? "phone or computer" : `${others} phones and computers`} will need your name and password again, and stop getting notifications.
              <div className="mt-3 flex gap-2">
                <Btn tone="ink" className="h-11 flex-1" onClick={() => setAsking(false)}>
                  Keep them
                </Btn>
                <button
                  type="button"
                  data-sign-out-others-go
                  disabled={busy === "others"}
                  onClick={signOut}
                  className="nd-press flex h-11 flex-1 items-center justify-center rounded-[3px] bg-card text-[15px] font-bold outline-1 -outline-offset-1 outline-edge disabled:opacity-60"
                >
                  Sign them out
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              data-sign-out-others
              onClick={() => setAsking(true)}
              className="nd-press mt-3 flex h-11 w-full items-center justify-center rounded-[3px] bg-card text-[15px] font-semibold outline-1 -outline-offset-1 outline-edge"
            >
              Sign out everywhere else
            </button>
          ))}
      </PageSection>
    </div>
  );
}

type Kind = "iphone" | "android" | "computer";

const ALLOW: Record<Kind, string[]> = {
  iphone: ["Open your iPhone's Settings app", "Tap Notifications, then Game Your Show", "Turn on Allow Notifications, then come back here and tap Turn on"],
  android: ["In Chrome, tap the icon left of the address", "Tap Permissions (or Site settings), then Notifications", "Choose Allow, then come back here and tap Turn on"],
  computer: ["Click the icon left of the address bar", "Find Notifications and choose Allow", "Reload this page, then tap Turn on"],
};

/** Notifications blocked: how to allow them in this browser (settings Round 1's check: blocked was a dead end), laid out as
 *  Install the app is. */
export function AllowSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [picked, setKind] = useState<Kind | null>(null);
  const kind = picked ?? kindHere();
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Allow notifications" subtitle="Your browser blocks them for this site">
      <div data-allow-sheet={kind}>
        <Segmented
          label="Your kind of phone"
          options={[
            { id: "iphone" as Kind, title: "iPhone" },
            { id: "android" as Kind, title: "Android" },
            { id: "computer" as Kind, title: "Computer" },
          ]}
          value={kind}
          onPick={setKind}
          attrs={(id) => ({ "data-allow-kind": id })}
        />
        <ol className="mt-4 flex flex-col gap-3">
          {ALLOW[kind].map((s, i) => (
            <li key={s} className="flex items-start gap-3 text-[15px] leading-snug">
              <i className="type-caption grid size-7 flex-none place-items-center rounded-full bg-foreground text-[15px] not-italic text-background">{i + 1}</i>
              <span className="pt-0.5">{s}</span>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-[13px] leading-snug text-muted-foreground">Until then, everything still lands in the bell on the hub.</p>
      </div>
    </Sheet>
  );
}

const STEPS: Record<Kind, string[]> = {
  iphone: ["In Safari, tap Share: the square with an arrow pointing up", "Tap Add to Home Screen", "Open Game Your Show from your Home Screen, then turn on notifications"],
  android: ["In Chrome, tap the ⋮ menu at the top right", "Tap Add to Home screen, or Install app", "Open Game Your Show from your Home Screen"],
  computer: ["In Chrome or Edge, find the install button at the right of the address bar", "Click Install", "It opens in its own window, like any app"],
};

function kindHere(): Kind {
  if (typeof navigator === "undefined") return "iphone";
  if (/iPhone|iPad|iPod/.test(navigator.userAgent)) return "iphone";
  if (/Android/.test(navigator.userAgent)) return "android";
  return "computer";
}

/** Install the app: the steps for this kind of phone first, the others a tap away. */
export function InstallSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { standalone, canPrompt, promptInstall } = useInstallPrompt();
  // This kind of phone, read when it's open (never during the page's first render, which the server shares).
  const [picked, setKind] = useState<Kind | null>(null);
  const kind = picked ?? kindHere();
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Install the app" subtitle="Game Your Show on your Home Screen">
      <div data-install-sheet={kind}>
        {standalone && <p className="mb-3 rounded-[3px] bg-secondary p-3 text-[14px] font-semibold">Installed on this phone.</p>}
        <Segmented
          label="Your kind of phone"
          options={[
            { id: "iphone" as Kind, title: "iPhone" },
            { id: "android" as Kind, title: "Android" },
            { id: "computer" as Kind, title: "Computer" },
          ]}
          value={kind}
          onPick={setKind}
          attrs={(id) => ({ "data-install-kind": id })}
        />
        {kind === "iphone" && (
          // eslint-disable-next-line @next/next/no-img-element -- a static picture from public/, at its own size (the reminder ask's)
          <img src={ADD_TO_HOME_ART} alt="" className="mt-4 block aspect-[372/120] w-full rounded-[4px]" />
        )}
        <ol className="mt-4 flex flex-col gap-3">
          {STEPS[kind].map((s, i) => (
            <li key={s} className="flex items-start gap-3 text-[15px] leading-snug">
              <i className="type-caption grid size-7 flex-none place-items-center rounded-full bg-foreground text-[15px] not-italic text-background">{i + 1}</i>
              <span className="pt-0.5">{s}</span>
            </li>
          ))}
        </ol>
        {kind !== "iphone" && canPrompt && (
          <Btn tone="ink" wide className="mt-5" data-install-now onClick={() => void promptInstall()}>
            Install it now
          </Btn>
        )}
        <p className="mt-4 text-[13px] leading-snug text-muted-foreground">
          {kind === "iphone" ? "On iPhone, notifications only work once it's on your Home Screen." : "Installing is optional: notifications work in the browser too."}
        </p>
      </div>
    </Sheet>
  );
}

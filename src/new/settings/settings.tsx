"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Bell, Compass, Eye, KeyRound, LibraryBig, LifeBuoy, LogOut, ShieldCheck, Tv, UserRound } from "lucide-react";
import { logOutTo } from "@/lib/auth-client";
import { profileApi, useAfterProfile, useCurrentCouch, useHome, useProfile, type Profile } from "../data";
import { openCouchSheet } from "../couch/couch-sheets";
import { useNav } from "../nav";
import { paths } from "../routes";
import { useMe } from "../session";
import { askTour } from "../tour/store";
import { Avatar, PageHeader } from "../ui/bars";
import { Loaded } from "../ui/loaded";
import { PushedPage, usePushedPage } from "../ui/page";
import { Row, SectionHead } from "../ui/parts";
import { toast } from "../ui/toast";
import { CreditsSheet } from "./credits";
import { PasswordSheet, ProfileSheet, ReportSheet } from "./sheets";
import { GroupRow } from "./controls";
import { ChatSetting, Exceptions, Kinds, notifyValue, PhonePlate, plateShows, ThisPhone, useNotNow, usePhone } from "./notify";
import { PrivacyPage, privacyValue } from "./sharing";
import { AppearanceRow } from "./appearance";
import { ResultsPage, resultsValue } from "./results";
import { YoursPage, yoursValue } from "./yours";
import { AccountPage, accountValue, AllowSheet, InstallSheet, PhonesPage } from "./account";

// Your settings (/settings; settings Round 1, docs/design-round/settings-r1-spec.md, -first-view.md and -shape.md; Round 0 chose
// the shape: groups with their values). Opened by the hub's gear (and a quiet row on your picture's sheet). In the eye's order:
//   1. You: your face, your name and the couches you're on, with Edit (your profile).
//   2. The plate, the page's one yellow, only while nothing reaches you (notify.tsx PhonePlate).
//   3. Five groups, each its name over its value, so most visits end here: Notifications, When results show, Privacy (not solo),
//      Appearance (opens in place), and Your shows, couches and games (the map of what's set where).
//   4. Account and help: Your account, Report a problem, Take the tour, Where art and data come from, Site admin, and Sign out
//      last, in red (it turns this phone's notifications off too: BACKLOG 232).
// Each group is a page pushed over this one (`?page=`), so the phone's back gesture closes it and a link can open it directly.
// Every change applies at once, with Undo in the toast; the few that Undo can't take back ask first, in place.

type Sheet = "profile" | "password" | "report" | "credits" | "install" | "allow" | null;

export function SettingsScreen() {
  const me = useMe();
  const nav = useNav();
  const params = useSearchParams();
  const { data: home } = useHome();
  const { data: p } = useProfile();
  const after = useAfterProfile();
  const current = useCurrentCouch(home);
  const [phone, setPhone] = usePhone();
  const [sheet, setSheet] = useState<Sheet>(null);
  const notifications = usePushedPage("notifications");
  const results = usePushedPage("results");
  const privacy = usePushedPage("privacy");
  const yours = usePushedPage("yours");
  const account = usePushedPage("account");
  // Your phones opens from Your account or from Notifications, and its Back says which (`from`).
  const phones = usePushedPage("phones", ["from"]);
  const phonesFrom = params.get("from");
  const [notNow, quiet] = useNotNow();
  const plate = plateShows(p, phone, notNow);
  const open = (s: Sheet) => () => setSheet(s);
  const close = (o: boolean) => !o && setSheet(null);

  const save = async (body: Parameters<typeof profileApi.save>[0], said: string, undo?: Parameters<typeof profileApi.save>[0]) => {
    try {
      await after(await profileApi.save(body));
      toast(said, undo ? { undo: async () => void (await after(await profileApi.save(undo))) } : {});
    } catch (e) {
      toast.quiet((e as Error).message);
    }
  };

  const couches = home?.couches.map((c) => c.name) ?? [];
  const solo = !!home && !home.couches.length;
  const sports = !!home?.shows.some((s) => s.show.kind === "sport" && (s.following || s.games.length));
  const hidden = (home?.shows ?? []).filter((s) => s.following && s.private);
  const line = couches.length > 2 ? `On ${couches.length} couches` : couches.length ? `On ${couches.join(" and ")}` : "On no couch yet";
  const notify = notifyValue(p, phone, solo, plate);
  const away = (p?.notify.elsewhere.shows.length ?? 0) + (p?.notify.elsewhere.couches.length ?? 0);
  const viewer = current?.members.find((m) => m.userId !== me.id)?.name ?? null;

  return (
    <div className="pb-16" data-settings>
      <PageHeader title="Your settings" back={{ label: "Home", parent: paths.home }} />
      {/* Your profile, your couches and this phone, all at once once they're in (ui/loaded.tsx). */}
      <Loaded fallback={<SettingsSkeleton />}>
        <div className="mx-4 mt-5 flex items-center gap-3.5" data-me-card>
          <Avatar id={me.id} name={p?.name ?? me.name} size={52} />
          <div className="min-w-0 flex-1">
            <b className="type-caption block truncate text-[28px] leading-[0.95]" data-me-name>
              {p?.name ?? me.name}
            </b>
            <small className="mt-1 block text-[13px] leading-snug text-muted-foreground">{line}</small>
          </div>
          <button
            type="button"
            data-edit-profile
            onClick={open("profile")}
            className="nd-press inline-flex h-11 flex-none items-center justify-center rounded-[3px] bg-card px-3.5 text-sm font-semibold outline-1 -outline-offset-1 outline-edge"
          >
            Edit
          </button>
        </div>

        <PhonePlate p={p} state={phone} setState={setPhone} onInstall={open("install")} onAllow={open("allow")} notNow={notNow} quiet={quiet} />

        <section className="mt-5 px-4" data-settings-groups>
          <GroupRow
            id="notifications"
            icon={Bell}
            title="Notifications"
            value={`${notify.text}${away ? ` · ${away} set on a show or couch` : ""}`}
            tone={notify.off ? "off" : undefined}
            onClick={notifications.show}
          />
          <GroupRow id="results" icon={Eye} title="When results show" value={resultsValue(p, sports)} onClick={results.show} />
          {!solo && <GroupRow id="privacy" icon={ShieldCheck} title="Privacy" value={privacyValue(p)} onClick={privacy.show} />}
          <AppearanceRow p={p} initial={params.get("open") === "appearance"} />
          <GroupRow id="yours" icon={Tv} title="Your shows, couches and games" value={yoursValue(home)} onClick={yours.show} />
        </section>

        <section className="mt-8" data-settings-help>
          <SectionHead title="Account and help" />
          <div className="flex flex-col px-4">
            <GroupRow id="account" icon={UserRound} title="Your account" value={accountValue(p)} onClick={account.show} />
            <Row icon={LifeBuoy} title="Report a problem" detail="Or an idea. It goes straight to us" onClick={open("report")} />
            <Row
              icon={Compass}
              title="Take the tour"
              detail="A quick look around Home, a couple of minutes"
              onClick={() => {
                // Home plays it (tour/store.ts), back where Your settings came from.
                askTour();
                nav.back(paths.home);
              }}
            />
            <Row icon={LibraryBig} title="Where art and data come from" detail="Shows' art, photos and listings" onClick={open("credits")} />
            {me.isSuperAdmin && <Row icon={KeyRound} title="Site admin" detail="To do, search and the site's settings" href={paths.desk()} />}
            <button
              type="button"
              data-sign-out
              onClick={() => logOutTo(paths.welcome)}
              className="nd-press flex min-h-[64px] w-full items-center gap-3 border-t border-border py-2 text-left text-live"
            >
              <span className="grid size-10 flex-none place-items-center rounded-[3px] bg-secondary">
                <LogOut className="size-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <b className="block text-[15px] font-semibold">Sign out</b>
                {phone === "on" && <small className="mt-0.5 block text-[13px] text-muted-foreground">Turns off notifications on this phone too</small>}
              </span>
            </button>
          </div>
        </section>
      </Loaded>

      <PushedPage open={notifications.open} onClose={notifications.close} title="Notifications" back="Your settings">
        <div data-settings-notify className="pb-10">
          <div className="px-4 pt-2">
            <ThisPhone devices={p?.notify.devices ?? 0} state={phone} setState={setPhone} onInstall={open("install")} onAllow={open("allow")} />
            <button type="button" data-open-phones onClick={() => phones.showWith({ from: "notifications" })} className="flex min-h-11 items-center text-[14px] font-semibold underline underline-offset-[3px]">
              Your phones and where you&rsquo;re signed in
            </button>
          </div>
          <Kinds p={p} save={save} phone={phone} solo={solo} />
          {!solo && <ChatSetting p={p} save={save} />}
          <Exceptions p={p} home={home} onCouch={(couchId) => openCouchSheet({ kind: "details", couchId })} />
          <p className="mx-4 mt-6 text-[13px] leading-snug text-muted-foreground">
            The bell on the hub keeps every notification for 30 days, except chat. A notification never says more than you&rsquo;ve watched.
          </p>
        </div>
      </PushedPage>
      <PushedPage open={results.open} onClose={results.close} title="When results show" back="Your settings">
        <ResultsPage p={p} save={save} sports={sports} />
      </PushedPage>
      <PushedPage open={privacy.open} onClose={privacy.close} title="Privacy" back="Your settings">
        <PrivacyPage p={p} save={save} viewer={viewer} hidden={hidden} />
      </PushedPage>
      <PushedPage open={yours.open} onClose={yours.close} title="Shows, couches and games" back="Your settings">
        <YoursPage home={home} p={p} />
      </PushedPage>
      <PushedPage open={account.open} onClose={account.close} title="Your account" back="Your settings">
        <AccountPage p={p} onPassword={open("password")} onPhones={() => phones.showWith({ from: "account" })} onInstall={open("install")} />
      </PushedPage>
      <PushedPage
        open={phones.open}
        onClose={phones.close}
        title="Your phones"
        back={phonesFrom === "account" ? "Your account" : phonesFrom === "notifications" ? "Notifications" : "Your settings"}
      >
        <PhonesPage open={phones.open} />
      </PushedPage>

      <ProfileSheet open={sheet === "profile"} onOpenChange={close} />
      <PasswordSheet open={sheet === "password"} onOpenChange={close} />
      <ReportSheet open={sheet === "report"} onOpenChange={close} />
      <CreditsSheet open={sheet === "credits"} onOpenChange={close} onReport={() => setSheet("report")} />
      <InstallSheet open={sheet === "install"} onOpenChange={close} />
      <AllowSheet open={sheet === "allow"} onOpenChange={close} />
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div aria-busy className="animate-pulse px-4 pt-5">
      <div className="flex items-center gap-3.5">
        <div className="size-[52px] rounded-[4px] bg-card" />
        <div className="h-7 flex-1 rounded-[3px] bg-card" />
      </div>
      <div className="mt-5 h-[320px] rounded-[3px] bg-card" />
      <div className="mt-8 h-6 w-48 rounded-[3px] bg-card" />
      <div className="mt-3 h-[260px] rounded-[3px] bg-card" />
    </div>
  );
}

export type { Profile };

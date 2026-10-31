"use client";

import { useState } from "react";
import { ArrowLeftRight, AtSign, Bell, BookOpen, Bot, Eye, FastForward, KeyRound, LayoutTemplate, LifeBuoy, LogOut, Mail, MonitorSmartphone, Plus, TriangleAlert, UserRound, Users } from "lucide-react";
import { authClient, logOutTo } from "@/lib/auth-client";
import { presetOf, PRESET_WORDS, SHARE_DEFAULT } from "@/lib/sharing";
import { profileApi, switchDesign, useAfterProfile, useCurrentCouch, useHome, useProfile, type AiChoice, type Profile } from "../data";
import { couchLine, FaceStack, openCouchSheet } from "../couch/couch-sheets";
import { paths } from "../routes";
import { useMe } from "../session";
import { Avatar, PageHeader } from "../ui/bars";
import { Loaded } from "../ui/loaded";
import { Btn, Row, SectionHead } from "../ui/parts";
import { toast } from "../ui/toast";
import { CreditsSheet } from "./credits";
import { GamesSheet, PasswordSheet, ProfileSheet, ReportSheet } from "./sheets";
import { Choice, Fold, SwitchRow } from "./controls";
import { ChatSetting, MomentsList, momentsLine, QuickPhone, usePhone } from "./notify";
import { SharingSection } from "./sharing";
import { AppearanceSection } from "./appearance";
import { AutoSection, autoShows, plain } from "./keep-up";

// Settings (/settings; docs/PLAN-new-design.md step 15; redesigned 2026-10-31 from .impeccable/mocks/settings/, option D, after
// the /impeccable critique of three mocks: the old page had every section open at once). You (your face, name and couches,
// with Edit), then Quick settings, the four people change, each one tap: this phone's notifications (notify.tsx; the screen's
// one yellow plate when nothing reaches you), Couch chat, Hide scores (turning it off asks first: Undo can't unsee a result)
// and Appearance (appearance.tsx). Then Everything else, each a row saying what it's set to that opens in place (Fold): Which
// notifications, Shows that move along by themselves (keep-up.tsx), What your couch sees (sharing.tsx), Your couches, and Your
// AI for results for whoever runs a game (only Backstage's Ask an AI reads it). Then Help and account: How each game works,
// Report a problem, Your account (with the classic design), Sign out, Credits. (A site admin's Test couch went 2026-10-31.)
// In plain words; every choice says what it does, the recommended one marked; a switch or a choice saves as it's tapped, with
// Undo where it matters.

const AIS: { id: AiChoice; title: string; line: string }[] = [
  { id: "chatgpt", title: "ChatGPT", line: "Opens the app or chatgpt.com" },
  { id: "grok", title: "Grok", line: "Opens the app or grok.com" },
  { id: "ask", title: "Ask each time", line: "Choose when it comes up" },
  { id: "copy", title: "I'll copy and paste", line: "Works with any AI" },
];

/** An outlined button whose edge can be seen (--edge, 3:1), 44px tall. */
const EDGE_BTN = "nd-press inline-flex h-11 flex-none items-center justify-center rounded-[3px] bg-card px-3.5 text-sm font-semibold outline-1 -outline-offset-1 outline-edge disabled:opacity-60";

export function SettingsScreen() {
  const me = useMe();
  const { data: home } = useHome();
  const { data: p } = useProfile();
  const after = useAfterProfile();
  const current = useCurrentCouch(home);
  const [phone, setPhone] = usePhone();
  const [sheet, setSheet] = useState<"profile" | "password" | "report" | "games" | "credits" | null>(null);
  const [switching, setSwitching] = useState(false);
  const [linking, setLinking] = useState(false);
  const [hideAsk, setHideAsk] = useState(false);
  const couches = home?.couches.map((c) => c.name) ?? [];
  const runs = !!home?.couches.some((c) => c.games.some((g) => g.yourRole === "commissioner" || g.yourRole === "admin"));
  const open = (s: typeof sheet) => () => setSheet(s);
  const close = (o: boolean) => !o && setSheet(null);

  const save = async (body: Parameters<typeof profileApi.save>[0], said: string, undo?: Parameters<typeof profileApi.save>[0]) => {
    try {
      await after(await profileApi.save(body));
      toast(said, undo ? { undo: async () => void (await after(await profileApi.save(undo))) } : {});
    } catch (e) {
      toast.quiet((e as Error).message);
    }
  };

  const line = [couches.length > 2 ? `On ${couches.length} couches` : couches.length ? `On ${couches.join(" and ")}` : "On no couch yet", p?.since && `since ${p.since}`]
    .filter(Boolean)
    .join(" · ");
  const hide = p?.hideScores ?? true;
  const level = presetOf(p?.sharing.on ?? SHARE_DEFAULT);
  const auto = autoShows(home?.shows);
  const autoOn = auto.filter((s) => s.keepUp === "auto");
  const ai = AIS.find((a) => a.id === (p?.ai ?? "chatgpt")) ?? AIS[0];
  const username = p?.account.username ?? p?.name ?? me.name;
  const couchesValue = !home?.couches.length
    ? "None yet: start one or join with a code"
    : home.couches.length === 1
      ? home.couches[0].name
      : `${current?.name ?? home.couches[0].name} on the hub · ${home.couches.length} couches`;

  return (
    <div className="pb-16" data-settings>
      <PageHeader title="Settings" back={{ label: "Home", parent: paths.home }} />
      {/* Your profile, your couches and this phone, all at once once they're in (ui/loaded.tsx). */}
      <Loaded fallback={<SettingsSkeleton />}>
        <div className="mx-4 mt-4 flex items-center gap-3" data-me-card>
          <Avatar id={me.id} name={p?.name ?? me.name} size={44} />
          <div className="min-w-0 flex-1">
            <b className="block truncate text-[17px] font-semibold" data-me-name>
              {p?.name ?? me.name}
            </b>
            <small className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">{line}</small>
          </div>
          <button type="button" className={EDGE_BTN} data-edit-profile onClick={open("profile")}>
            Edit
          </button>
        </div>

        <section className="mt-7" data-settings-quick>
          <SectionHead title="Quick settings" />
          <div className="px-4">
            <QuickPhone devices={p?.notify.devices ?? 0} state={phone} setState={setPhone} />
            <ChatSetting p={p} save={save} />
            <div className="border-t border-border" data-settings-spoilers>
              <SwitchRow
                data="hide-scores"
                on={hide}
                disabled={!p}
                title="Hide scores until I reveal"
                line={hide ? "Results wait for you to reveal them: the hub, posters, standings and notifications. Recommended" : "Off: results show as soon as they're in, everywhere, notifications too"}
                onChange={(on) => {
                  if (!on) return setHideAsk(!hideAsk);
                  setHideAsk(false);
                  void save({ hideScores: true }, "On: results wait for you to reveal them", { hideScores: false });
                }}
              />
              {/* Showing scores straight away can spoil an episode, and Undo can't take that back: it asks first, as Move along does. */}
              {hideAsk && hide && (
                <div data-hide-warn className="mb-3 rounded-[3px] bg-card p-3 outline-1 -outline-offset-1 outline-border">
                  <p className="flex gap-2 text-[13.5px] leading-snug">
                    <TriangleAlert className="mt-0.5 size-4 flex-none" aria-hidden />
                    <span>
                      <b className="font-semibold">Show scores straight away?</b> The hub, standings and notifications will say who went home as soon as it&rsquo;s known, even the
                      week you watch late. Undo can&rsquo;t unsee it.
                    </span>
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Btn tone="ink" className="flex-1" data-hide-keep onClick={() => setHideAsk(false)}>
                      Keep them hidden
                    </Btn>
                    <button
                      type="button"
                      data-hide-confirm
                      className="nd-press flex h-[52px] flex-1 items-center justify-center rounded-[3px] bg-card text-[15px] font-bold outline-1 -outline-offset-1 outline-edge"
                      onClick={() => {
                        setHideAsk(false);
                        void save({ hideScores: false }, "Off: results show as soon as they're in", { hideScores: true });
                      }}
                    >
                      Show scores
                    </button>
                  </div>
                </div>
              )}
            </div>
            <AppearanceSection p={p} />
          </div>
        </section>

        <section className="mt-7" data-settings-more>
          <SectionHead title="Everything else" />
          <div className="px-4">
            <Fold id="notify" icon={Bell} title="Which notifications" value={momentsLine(p, phone, runs)}>
              <MomentsList p={p} save={save} runs={runs} phone={phone} />
            </Fold>
            {auto.length > 0 && (
              <Fold id="auto" icon={FastForward} title="Shows that move along by themselves" value={autoOn.length ? autoOn.map(plain).join(", ") : "None: you move each one along"}>
                <AutoSection />
              </Fold>
            )}
            <Fold
              id="sharing"
              icon={Eye}
              title="What your couch sees"
              value={level === "custom" ? "Your own mix" : `${PRESET_WORDS.find((w) => w.id === level)?.title ?? "Everything"}${level === "all" ? " · recommended" : ""}`}
            >
              <SharingSection p={p} save={save} viewer={current?.members.find((m) => m.userId !== me.id)?.name ?? null} />
            </Fold>
            <Fold id="couches" icon={Users} title="Your couches" value={couchesValue}>
              <div className="flex flex-col" data-settings-couches>
                {home?.couches.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    data-settings-couch={c.name}
                    onClick={() => openCouchSheet({ kind: "details", couchId: c.id })}
                    className="nd-press flex min-h-[64px] items-center gap-3 border-t border-border py-2 text-left first:border-t-0"
                  >
                    <FaceStack people={c.members} />
                    <span className="min-w-0 flex-1">
                      <b className="block truncate text-[15px] font-semibold">
                        {c.name}
                        {c.id === current?.id && <span className="ml-2 text-[12px] font-semibold text-muted-foreground">On the hub</span>}
                      </b>
                      <small className="block truncate text-[13px] text-muted-foreground">{couchLine(c)}</small>
                    </span>
                  </button>
                ))}
                {current && home && home.couches.length > 1 && (
                  <Row icon={ArrowLeftRight} title="Switch couches" detail={`The hub shows ${current.name}`} onClick={() => openCouchSheet({ kind: "switch" })} />
                )}
                <Row icon={Plus} title="Start a couch" detail="Name it, get a code, send it to your people" onClick={() => openCouchSheet({ kind: "new" })} />
                <Row icon={KeyRound} title="Join a couch" detail="Got a code? Pull up a seat" onClick={() => openCouchSheet({ kind: "join" })} />
              </div>
            </Fold>
            {runs && (
              <Fold id="ai" icon={Bot} title="Your AI for results" value={`${ai.title} · for games you run`}>
                <div data-settings-ai>
                  <p className="mb-1 text-[13px] leading-snug text-muted-foreground">When you fill in results or add a show, we open your AI with the question ready. Free versions work.</p>
                  <div role="radiogroup" aria-label="Your AI for results">
                    {AIS.map((a) => (
                      <Choice
                        key={a.id}
                        data={a.id}
                        on={ai.id === a.id}
                        title={a.title}
                        line={a.line}
                        recommended={a.id === "chatgpt"}
                        onPick={() => p && save({ ai: a.id }, `Saved: ${a.title}`)}
                      />
                    ))}
                  </div>
                </div>
              </Fold>
            )}
          </div>
        </section>

        <section className="mt-7" data-settings-help>
          <SectionHead title="Help and account" />
          <div className="flex flex-col px-4">
            <Row icon={BookOpen} title="How each game works" detail="Outlast, Weekly Lineup, Survival Pool and the rest, in plain words" onClick={open("games")} />
            <Row icon={LifeBuoy} title="Report a problem" detail="Or an idea. It goes straight to us" onClick={open("report")} />
            <Fold id="account" icon={UserRound} title="Your account" value={`${username}${p?.account.google.linked ? " · Google linked" : ""}`}>
              <div className="flex flex-col" data-settings-account>
                <Row icon={UserRound} title={`Signed in as ${username}`} detail="Your name is how you sign in too" />
                <Row icon={Mail} title={p?.account.email ?? "No email"} detail={p?.account.email ? "For resetting your password" : "You sign in with your name and password"} />
                {p?.account.password && <Row icon={KeyRound} title="Change password" onClick={open("password")} />}
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
                            const r = await authClient.linkSocial({ provider: "google", callbackURL: paths.settings }).catch(() => null);
                            if (!r || r.error) {
                              setLinking(false);
                              toast.quiet("Couldn't open Google. Try again.");
                            }
                          }
                    }
                  />
                )}
                <Row
                  icon={MonitorSmartphone}
                  title={switching ? "Switching…" : "Back to the classic design"}
                  detail="Your games are the same in both. Come back any time from the menu."
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
                <Row
                  icon={LayoutTemplate}
                  title="The full design"
                  detail="Every screen as it's designed, with demo people. Opens in a new tab."
                  onClick={() => window.open("/mock", "_blank", "noopener")}
                />
              </div>
            </Fold>
            <button
              type="button"
              data-sign-out
              onClick={() => logOutTo(paths.welcome)}
              className="nd-press flex min-h-[60px] w-full items-center gap-3 border-t border-border py-2 text-left text-live"
            >
              <span className="grid size-10 flex-none place-items-center rounded-[3px] bg-secondary">
                <LogOut className="size-5" aria-hidden />
              </span>
              <b className="text-[15px] font-semibold">Sign out</b>
            </button>
          </div>
          <div className="mx-4 mt-2">
            <button type="button" data-credits onClick={open("credits")} className="min-h-11 text-left text-[13px] text-muted-foreground underline underline-offset-[3px]">
              Credits: where shows&rsquo; art, photos and listings come from
            </button>
          </div>
        </section>
      </Loaded>

      <ProfileSheet open={sheet === "profile"} onOpenChange={close} />
      <PasswordSheet open={sheet === "password"} onOpenChange={close} />
      <ReportSheet open={sheet === "report"} onOpenChange={close} />
      <CreditsSheet open={sheet === "credits"} onOpenChange={close} onReport={() => setSheet("report")} />
      <GamesSheet open={sheet === "games"} onOpenChange={close} />
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div aria-busy className="animate-pulse px-4 pt-4">
      <div className="flex items-center gap-3">
        <div className="size-11 rounded-[4px] bg-card" />
        <div className="h-5 flex-1 rounded-[3px] bg-card" />
      </div>
      <div className="mt-7 h-6 w-44 rounded-[3px] bg-card" />
      <div className="mt-3 h-[320px] rounded-[3px] bg-card" />
      <div className="mt-7 h-6 w-48 rounded-[3px] bg-card" />
      <div className="mt-3 h-[260px] rounded-[3px] bg-card" />
    </div>
  );
}

export type { Profile };

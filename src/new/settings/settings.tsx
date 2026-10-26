"use client";

import { useState } from "react";
import { ArrowLeftRight, AtSign, BookOpen, KeyRound, LayoutTemplate, LifeBuoy, Mail, MonitorSmartphone, Plus, UserRound } from "lucide-react";
import { authClient, logOutTo } from "@/lib/auth-client";
import { profileApi, switchDesign, useAfterProfile, useCurrentCouch, useHome, useProfile, type AiChoice, type Profile } from "../data";
import { couchLine, FaceStack, openCouchSheet } from "../couch/couch-sheets";
import { paths } from "../routes";
import { useMe } from "../session";
import { Avatar, PageHeader } from "../ui/bars";
import { Btn, Row, SectionHead } from "../ui/parts";
import { Preview } from "../ui/preview";
import { toast } from "../ui/toast";
import { GamesSheet, PasswordSheet, ProfileSheet, ReportSheet } from "./sheets";

// Settings (/settings; docs/PLAN-new-design.md step 15 part 1; the mock's settings.js accountRoute and share.js), in the mock's
// order: you (your face, name and couches, with Edit), what we notify you about (part 2), keeping you spoiler-free, what your
// couch sees (part 3), your AI for results, appearance (part 4), your couches, help, your account, and the classic design.
// Organised by the question people have, in plain words; every choice says what it does, the recommended one marked; a switch
// or a choice saves as it's tapped (with Undo where it matters).

const AIS: { id: AiChoice; title: string; line: string }[] = [
  { id: "chatgpt", title: "ChatGPT", line: "Opens the app or chatgpt.com" },
  { id: "grok", title: "Grok", line: "Opens the app or grok.com" },
  { id: "ask", title: "Ask each time", line: "Choose when it comes up" },
  { id: "copy", title: "I'll copy and paste", line: "Works with any AI" },
];

/** A setting that's on or off: its title, a line on what it does, and the switch (bone when on: yellow is only for a must). */
function SwitchRow({ on, title, line, onChange, data, disabled }: { on: boolean; title: string; line: string; onChange: (on: boolean) => void; data: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      data-setting={data}
      data-on={on ? "on" : "off"}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className="nd-press flex min-h-[64px] w-full items-center gap-3 border-t border-border py-2 text-left first:border-t-0 disabled:opacity-60"
    >
      <span className="min-w-0 flex-1">
        <b className="block text-[15px] font-semibold">{title}</b>
        <small className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">{line}</small>
      </span>
      <span aria-hidden className={`relative h-[30px] w-[52px] flex-none rounded-full transition-colors ${on ? "bg-foreground" : "bg-secondary"}`}>
        <i className={`absolute top-[3px] size-6 rounded-full transition-[left] ${on ? "left-[25px] bg-background" : "left-[3px] bg-muted-foreground"}`} />
      </span>
    </button>
  );
}

/** One of a few choices: a ring, its title (Recommended marked) and a line on what it does. */
function Choice({ on, title, line, recommended, onPick, data }: { on: boolean; title: string; line: string; recommended?: boolean; onPick: () => void; data: string }) {
  return (
    <button type="button" role="radio" aria-checked={on} data-choice={data} onClick={() => !on && onPick()} className="nd-press flex min-h-[56px] w-full items-center gap-3 py-1.5 text-left">
      <i className={`grid size-5 flex-none place-items-center rounded-full border-2 ${on ? "border-foreground" : "border-input"}`} aria-hidden>
        {on && <i className="size-2.5 rounded-full bg-foreground" />}
      </i>
      <span className="min-w-0">
        <b className="block text-[15px] font-semibold">
          {title}
          {recommended && <em className="type-caption ml-2 rounded-[2px] bg-secondary px-1.5 text-[11px] not-italic">Recommended</em>}
        </b>
        <small className="text-[13px] text-muted-foreground">{line}</small>
      </span>
    </button>
  );
}

export function SettingsScreen() {
  const me = useMe();
  const { data: home } = useHome();
  const { data: p } = useProfile();
  const after = useAfterProfile();
  const current = useCurrentCouch(home);
  const [sheet, setSheet] = useState<"profile" | "password" | "report" | "games" | null>(null);
  const [switching, setSwitching] = useState(false);
  const [linking, setLinking] = useState(false);
  const couches = home?.couches.map((c) => c.name) ?? [];
  const open = (s: typeof sheet) => () => setSheet(s);
  const close = (o: boolean) => !o && setSheet(null);

  const save = async (body: Parameters<typeof profileApi.save>[0], said: string, undo?: Parameters<typeof profileApi.save>[0]) => {
    try {
      await after(await profileApi.save(body));
      toast(said, undo ? { undo: async () => void (await after(await profileApi.save(undo))) } : {});
    } catch (e) {
      toast((e as Error).message);
    }
  };

  const line = [couches.length > 2 ? `On ${couches.length} couches` : couches.length ? `On ${couches.join(" and ")}` : "On no couch yet", p?.since && `since ${p.since}`]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="pb-16" data-settings>
      <PageHeader title="Settings" back={{ label: "Home", parent: paths.home }} />

      <div className="mx-4 mt-5 flex items-center gap-3 rounded-[3px] bg-card p-3" data-me-card>
        <Avatar id={me.id} name={p?.name ?? me.name} size={56} />
        <div className="min-w-0 flex-1">
          <b className="block truncate text-[17px] font-semibold" data-me-name>
            {p?.name ?? me.name}
          </b>
          <small className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">{line}</small>
        </div>
        <Btn className="h-10 px-3.5 text-sm" data-edit-profile onClick={open("profile")}>
          Edit
        </Btn>
      </div>

      <section className="mt-8">
        <SectionHead title="What we notify you about" />
        <Preview id="settings.notifications" className="mx-4" />
      </section>

      <section className="mt-8" data-settings-spoilers>
        <SectionHead title="Keeping you spoiler-free" />
        <div className="px-4">
          <SwitchRow
            data="hide-scores"
            on={p?.hideScores ?? true}
            disabled={!p}
            title="Hide scores until I reveal"
            line={
              (p?.hideScores ?? true)
                ? "Results wait for you to reveal them: the hub, posters, standings and notifications. Recommended"
                : "Off: results show as soon as they're in, everywhere, notifications too"
            }
            onChange={(on) =>
              save(
                { hideScores: on },
                on ? "On: results wait for you to reveal them" : "Off: results show as soon as they're in",
                { hideScores: !on }
              )
            }
          />
        </div>
      </section>

      <section className="mt-8">
        <SectionHead title="What your couch sees" />
        <Preview id="settings.sharing" className="mx-4" />
      </section>

      <section className="mt-8" data-settings-ai>
        <SectionHead title="Your AI for results" />
        <p className="mx-4 mb-2 rounded-[3px] bg-card p-3 text-[14px] leading-snug">
          When you fill in results or add a show, we open your AI with the question ready. Free versions work.
        </p>
        <div role="radiogroup" aria-label="Your AI for results" className="px-4">
          {AIS.map((a) => (
            <Choice
              key={a.id}
              data={a.id}
              on={(p?.ai ?? "chatgpt") === a.id}
              title={a.title}
              line={a.line}
              recommended={a.id === "chatgpt"}
              onPick={() => p && save({ ai: a.id }, `Saved: ${a.title}`)}
            />
          ))}
        </div>
      </section>

      <section className="mt-8">
        <SectionHead title="Appearance" />
        <Preview id="settings.appearance" className="mx-4" />
      </section>

      <section className="mt-8" data-settings-couches>
        <SectionHead title="Your couches" aside={home ? `${home.couches.length}` : undefined} />
        <div className="flex flex-col px-4">
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
      </section>

      <section className="mt-8" data-settings-help>
        <SectionHead title="Help" />
        <div className="flex flex-col px-4">
          <Row icon={BookOpen} title="How each game works" detail="Outlast, Weekly Lineup, Survival Pool and the rest, in plain words" onClick={open("games")} />
          <Row icon={LifeBuoy} title="Report a problem" detail="Or an idea. It goes straight to us" onClick={open("report")} />
        </div>
      </section>

      <section className="mt-8" data-settings-account>
        <SectionHead title="Your account" />
        <div className="flex flex-col px-4">
          <Row icon={UserRound} title={`Signed in as ${p?.account.username ?? p?.name ?? me.name}`} detail="Your name is how you sign in too" />
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
                        toast("Couldn't open Google. Try again.");
                      }
                    }
              }
            />
          )}
        </div>
      </section>

      <section className="mt-8">
        <SectionHead title="The new design" />
        <div className="flex flex-col px-4">
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
                toast("Couldn't switch. Try again.");
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
      </section>

      <div className="mx-4 mt-8">
        <Btn wide data-sign-out className="text-live" onClick={() => logOutTo(paths.welcome)}>
          Sign out
        </Btn>
      </div>

      <ProfileSheet open={sheet === "profile"} onOpenChange={close} />
      <PasswordSheet open={sheet === "password"} onOpenChange={close} />
      <ReportSheet open={sheet === "report"} onOpenChange={close} />
      <GamesSheet open={sheet === "games"} onOpenChange={close} />
    </div>
  );
}

export type { Profile };

"use client";

import { useState } from "react";
import { ChevronLeft, LayoutTemplate, LogOut, MonitorSmartphone } from "lucide-react";
import { logOut } from "@/lib/auth-client";
import { switchDesign, useHome } from "../data";
import { useNav } from "../nav";
import { paths, START_STEPS } from "../routes";
import { useMe } from "../session";
import { Avatar, PageHeader } from "../ui/bars";
import { Btn, Row, SectionHead } from "../ui/parts";
import { Preview } from "../ui/preview";
import { toast } from "../ui/toast";

// Settings (/settings), first run (/start/[step]) and joining a couch (/join/[code]): step 0c's shells. Settings
// has the one real setting the new design needs now, going back to the classic design; the rest is step 15
// (mock settings.js) and step 9 (round2.js, landing.js).

export function SettingsScreen() {
  const me = useMe();
  const { data: home } = useHome();
  const [switching, setSwitching] = useState(false);
  const couches = home?.couches.map((c) => c.name) ?? [];
  return (
    <div className="pb-16">
      <PageHeader title="Settings" back={{ label: "Home", parent: paths.home }} />
      <div className="mx-4 mt-5 flex items-center gap-3 rounded-[3px] bg-card p-3">
        <Avatar id={me.id} name={me.name} size={56} />
        <div className="min-w-0 flex-1">
          <b className="block truncate text-[17px] font-semibold">{me.name}</b>
          {couches.length > 0 && <small className="mt-0.5 block text-[13px] text-muted-foreground">On {couches.join(" and ")}</small>}
        </div>
        <Preview id="settings.profile" tag={false}>
          <Btn className="h-10 px-3.5 text-sm">Edit</Btn>
        </Preview>
      </div>
      <Preview id="settings.account" className="mx-4 mt-6" />
      <Preview id="settings.couches" className="mx-4 mt-3" />
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
          <Row icon={LogOut} title="Sign out" onClick={() => logOut()} />
        </div>
      </section>
    </div>
  );
}

const START = [
  { title: "What are you watching?", line: "Pick as many as you like. Play them with friends, or just follow along." },
  { title: "Where are you in them?", line: "So nothing past your episode ever shows." },
  { title: "Save your shows", line: "An account keeps your shows and games on every device." },
  { title: "Bring your people", line: "Start a couch, join one with a code, or keep it just you." },
];

export function StartScreen({ step }: { step: number }) {
  const nav = useNav();
  const s = START[step - 1];
  const last = step === START_STEPS;
  return (
    <div className="flex min-h-dvh flex-col pb-[calc(16px+env(safe-area-inset-bottom,0px))]">
      <header className="flex items-center gap-3 px-2.5 pt-[calc(8px+env(safe-area-inset-top,0px))]">
        <button
          type="button"
          aria-label="Back"
          onClick={() => (step > 1 ? nav.back(paths.start(step - 1)) : nav.back(paths.home))}
          className="grid size-11 place-items-center rounded-[3px]"
        >
          <ChevronLeft className="size-5" aria-hidden />
        </button>
        <div className="flex flex-1 gap-1.5" aria-hidden>
          {Array.from({ length: START_STEPS }, (_, i) => (
            <i key={i} className={`h-1 flex-1 rounded-full ${i < step ? "bg-chyron-line" : "bg-secondary"}`} />
          ))}
        </div>
        <span className="pr-2 text-[13px] font-semibold text-muted-foreground">
          {step} of {START_STEPS}
        </span>
      </header>
      <h1 className="type-caption px-4 pt-6 text-[44px] leading-[.95]">{s.title}</h1>
      <p className="px-4 pt-3 text-[15px] leading-snug text-muted-foreground">{s.line}</p>
      <Preview id="start.steps" className="mx-4 mt-6" />
      <div className="mt-auto px-4 pt-6">
        <Btn tone="must" wide onClick={() => nav.push(last ? paths.home : paths.start(step + 1))}>
          {last ? "Done" : "Next"}
        </Btn>
      </div>
    </div>
  );
}

export function JoinScreen({ code }: { code: string }) {
  return (
    <div className="pb-16">
      <PageHeader title="Join a couch" back={{ label: "Home", parent: paths.home }} />
      <p className="px-4 pt-6 text-[15px] text-muted-foreground">
        Invite code <b className="type-num text-[22px] tracking-[0.08em] text-foreground">{code.toUpperCase()}</b>
      </p>
      <Preview id="join.couch" className="mx-4 mt-5" />
    </div>
  );
}

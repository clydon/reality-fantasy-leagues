"use client";

import { useState } from "react";
import { BookOpen, ChevronRight, MessageSquare, Plus, Trophy, Tv, Zap, type LucideIcon } from "lucide-react";
import type { RulebookKind } from "@/lib/game/formats/rulebook-schema";
import { NavLink, useNav } from "../nav";
import { paths } from "../routes";
import { Btn } from "../ui/parts";
import { toast } from "../ui/toast";
import { deskSend, useAfterDesk, useDesk, type DeskLibrary, type LibraryTemplateCard, type ProposedShape } from "./data";
import { DeskHeader, ItemRow, Section, Tag } from "./parts";

// The library on the desk (docs/PLAN-new-design.md step 10 part 3; PLAN-rulebooks-implementation.md 7.9), from Find: the
// starting points new shows start from, by kind (the design plan's proposed shapes dashed until two real shows here play
// like one, then Make it a template), the rulebooks players made (Take it over, on each one's page), drafts, and every
// rulebook in use. Each opens its rulebook's page. Sticky: New show. Server: src/lib/server/desk-library.ts.

export const KIND_ICON: Record<RulebookKind, LucideIcon> = { competition: Trophy, series: Tv, talk: MessageSquare, sport: Zap };

export function LibraryPage() {
  const q = useDesk<DeskLibrary>("/library");
  const lib = q.data;
  return (
    <div className="pb-36" data-desk-library>
      <DeskHeader title="Library" back={{ label: "Find", href: paths.desk("find") }} />
      {!lib ? (
        <div aria-busy className="mx-4 mt-6 h-64 animate-pulse rounded-[4px] bg-card" />
      ) : (
        <>
          <Section title="Start from" aside={`${lib.counts.templates} ${lib.counts.templates === 1 ? "template" : "templates"}, ${lib.counts.proposed} proposed`}>
            <p className="mb-1 text-[14px] leading-snug text-muted-foreground">
              A template is a finished rulebook with the show&apos;s names left blank. Make it a game sends the nearest one to ChatGPT to correct, and New show can start from one. Any rulebook in use can be saved as one.
            </p>
            {lib.kinds.map((k) => (
              <KindGroup key={k.kind} kind={k.kind} name={k.name} templates={k.templates} proposed={k.proposed} />
            ))}
          </Section>
          {lib.made.length > 0 && (
            <Section title="Made by players" aside={lib.made.length}>
              <p className="mb-1 text-[13px] leading-snug text-muted-foreground">Every couch plays by them. Another couch checking one settles it; take one over to make it the desk&apos;s.</p>
              <div data-library-made>
                {lib.made.map((m) => (
                  <ItemRow key={m.id} data="made" href={paths.deskItem("rulebook", m.id)} tag={m.review === "checked" ? "Checked" : "New"} tone={m.review === "checked" ? "good" : "must"} title={m.name} line={m.line} />
                ))}
              </div>
            </Section>
          )}
          <Section title="Drafts" aside={lib.drafts.length || "None"}>
            <div data-library-drafts>
              {lib.drafts.map((d) => (
                <ItemRow key={d.id} data="draft" href={paths.deskItem("rulebook", d.id)} tag="Draft" title={d.name} line={d.line} />
              ))}
              {!lib.drafts.length && <p className="text-[14px] text-muted-foreground">Nothing researched waits to be a starting point.</p>}
            </div>
          </Section>
          <Section title="In use" aside={lib.inUse.length}>
            <div data-library-in-use>
              {lib.inUse.map((r) => (
                <ItemRow key={r.id} data="in-use" href={paths.deskItem("rulebook", r.id)} title={r.name} line={r.line} />
              ))}
            </div>
          </Section>
        </>
      )}
      <div className="nd-fixed-x fixed bottom-0 z-30 border-t border-border bg-[rgba(22,20,29,.96)] px-4 pb-[calc(env(safe-area-inset-bottom,0px)+12px)] pt-3 backdrop-blur-md">
        <NavLink href={paths.deskNew()} data-new-show className="nd-press flex h-[52px] w-full items-center justify-center gap-2 rounded-[3px] bg-chyron text-[17px] font-bold text-chyron-foreground">
          <Plus className="size-5" strokeWidth={2.6} aria-hidden />
          New show
        </NavLink>
      </div>
    </div>
  );
}

function KindGroup({ kind, name, templates, proposed }: { kind: RulebookKind; name: string; templates: LibraryTemplateCard[]; proposed: ProposedShape[] }) {
  const Icon = KIND_ICON[kind];
  return (
    <div data-library-kind={kind} className="mt-5">
      <h3 className="flex items-center gap-2 text-[15px] font-bold">
        <span className="grid size-8 place-items-center rounded-[3px] bg-card">
          <Icon className="size-[18px]" aria-hidden />
        </span>
        {name}
      </h3>
      <div className="mt-2 flex flex-col gap-2">
        {templates.map((t) => (
          <TemplateCard key={t.id} t={t} />
        ))}
        {proposed.map((p) => (
          <ProposedCard key={p.id} p={p} />
        ))}
        {!templates.length && !proposed.length && <p className="text-[14px] text-muted-foreground">No starting points yet.</p>}
      </div>
    </div>
  );
}

const likeLine = (like: string[], max = 3) => (like.length > max ? `${like.slice(0, max).join(", ")} +${like.length - max} more` : like.join(", "));

function TemplateCard({ t }: { t: LibraryTemplateCard }) {
  return (
    <NavLink href={paths.deskItem("rulebook", t.id)} data-template-card={t.id} data-shape={t.shape ?? undefined} className="nd-press flex min-h-[72px] items-center gap-3 rounded-[4px] bg-card p-3">
      <span className="min-w-0 flex-1">
        <b className="type-caption block text-[19px] leading-tight">{t.name}</b>
        {t.like.length > 0 && <small className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">Plays like {likeLine(t.like)}</small>}
        {t.tags.length > 0 && (
          <span className="mt-1.5 flex flex-wrap gap-1">
            {t.tags.map((g) => (
              <i key={g} className="rounded-[2px] bg-secondary px-1.5 py-0.5 text-[11.5px] font-semibold not-italic">
                {g}
              </i>
            ))}
          </span>
        )}
      </span>
      <ChevronRight className="size-5 flex-none text-muted-foreground" aria-hidden />
    </NavLink>
  );
}

function ProposedCard({ p }: { p: ProposedShape }) {
  const after = useAfterDesk();
  const nav = useNav();
  const [busy, setBusy] = useState(false);
  const earned = p.shows.length >= 2;
  const earn = async () => {
    setBusy(true);
    try {
      const out = await deskSend<{ id: string }>("/library", { action: "earn", shape: p.id });
      await after();
      toast(`${p.name} is a starting point now`);
      nav.push(paths.deskItem("rulebook", out.id));
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const status = earned
    ? `${p.shows.slice(0, 2).map((s) => s.name).join(" and ")}${p.shows.length > 2 ? ` and ${p.shows.length - 2} more` : ""} play like it`
    : p.shows.length === 1
      ? `${p.shows[0].name} plays like it · one more and it earns its place`
      : "No show here plays like it yet";
  return (
    <div
      data-proposed={p.id}
      data-earned={earned || undefined}
      role={earned ? undefined : "button"}
      tabIndex={earned ? undefined : 0}
      onClick={earned ? undefined : () => toast("It earns a template once two real shows share its shape.")}
      onKeyDown={earned ? undefined : (e) => (e.key === "Enter" || e.key === " ") && toast("It earns a template once two real shows share its shape.")}
      className={`rounded-[4px] p-3 ${earned ? "bg-card outline-2 -outline-offset-2 outline-chyron-line" : "cursor-pointer outline-1 -outline-offset-1 outline-dashed outline-input"}`}
    >
      <div className="flex items-start gap-2">
        <b className={`type-caption min-w-0 flex-1 text-[19px] leading-tight ${earned ? "" : "text-muted-foreground"}`}>{p.name}</b>
        <Tag tone={earned ? "must" : "quiet"}>{earned ? "Earned" : "Proposed"}</Tag>
      </div>
      <small className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">
        {p.line} · like {likeLine(p.like)}
      </small>
      <small data-proposed-status className="mt-1 block text-[13px] leading-snug">{status}</small>
      {earned && (
        <Btn data-earn tone="must" wide disabled={busy} className="mt-2.5 h-11 text-[15px]" onClick={earn}>
          <BookOpen className="size-4" aria-hidden /> Make it a template
        </Btn>
      )}
    </div>
  );
}

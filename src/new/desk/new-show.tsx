"use client";

import { useDeferredValue, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Copy, Plus, Search, Sparkles, Tv } from "lucide-react";
import type { RulebookKind } from "@/lib/game/formats/rulebook-schema";
import { make } from "../data";
import { useNav } from "../nav";
import { paths } from "../routes";
import { toast } from "../ui/toast";
import { deskSend, useAfterDesk, useDesk, type DeskLibrary, type DeskShow, type LibraryTemplateCard, type ShowsList } from "./data";
import { KIND_ICON } from "./library";
import { DeskHeader, Section } from "./parts";

// New show on the desk (docs/PLAN-new-design.md step 10 part 3; PLAN-rulebooks-implementation.md 7.10, with the kind inferred
// rather than asked first: PLAN-admin-shows-rulebooks.md's layer zero). Two steps, then Make it a game's own review:
//
//   1 Which show?        one already here (its season, or a new one), a TV listing (made as Add a show makes it, not
//                        followed), or a name the listings don't have
//   2 How to start?      Ask ChatGPT for me or copy and paste (the make page asks, as for anyone), or start from one of the
//                        library's starting points (the show's kind first): its blocks are the answer to how the show works
//
// The review, the kind's Change and Looks right are the make page's (src/new/show/make-game.tsx over make-game.ts), so a show
// the desk sets up is set up exactly as a player's is, checked as it's made; Looks right comes back to its rulebook's page. A show that's a game already: its new season
// starts as the last season's rulebook (the show's page, New season).

type Picked = { seasonId: string; showId: string | null; label: string; kind: RulebookKind | null };

const makePage = (seasonId: string) => `${paths.show(seasonId, "games")}?page=make&from=desk`;

export function NewShowFlow() {
  const params = useSearchParams();
  const seasonParam = params.get("season");
  const [picked, setPicked] = useState<Picked | null>(null);
  const fromParam = useQuery({
    queryKey: ["new-design", "desk", "new-season", seasonParam],
    enabled: !!seasonParam && !picked,
    queryFn: async () => {
      const res = await fetch(`/api/seasons/${seasonParam}/make`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "That season isn't here");
      return body as { label: string; ready: boolean };
    },
  });
  const current: Picked | null = picked ?? (seasonParam && fromParam.data && !fromParam.data.ready ? { seasonId: seasonParam, showId: null, label: fromParam.data.label, kind: null } : null);
  return (
    <div className="pb-16" data-new-show-flow={current ? 2 : 1}>
      <DeskHeader title="New show" back={{ label: "Library", href: paths.desk("library") }} />
      <div className="mx-4 mt-3 grid grid-cols-2 gap-1.5" aria-label={`Step ${current ? 2 : 1} of 2`}>
        <i className="h-1 rounded-full bg-chyron" />
        <i className={`h-1 rounded-full ${current ? "bg-chyron" : "bg-secondary"}`} />
      </div>
      {current ? <HowToStart picked={current} onBack={() => setPicked(null)} /> : <WhichShow onPick={setPicked} />}
    </div>
  );
}

// ---------- 1. Which show? ----------

interface ListingHit {
  tvmazeId: number;
  name: string;
  type: string | null;
  network: string | null;
  year: number | null;
  kind: RulebookKind;
}

function WhichShow({ onPick }: { onPick: (p: Picked) => void }) {
  const nav = useNav();
  const after = useAfterDesk();
  const [q, setQ] = useState("");
  const [showId, setShowId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const term = useDeferredValue(q.trim());
  // Shows that are here (Find › Shows' read, part 7a: archived ones are out of everyone's search, the desk's too).
  const here = useDesk<ShowsList>(term.length >= 2 ? `/shows?${new URLSearchParams({ q: term, limit: "6", counts: "0" })}` : null);
  const listings = useQuery({
    queryKey: ["new-design", "desk", "listings", term],
    enabled: term.length >= 2,
    queryFn: async () => (await (await fetch(`/api/listings/search?q=${encodeURIComponent(term)}`)).json()) as { hits: ListingHit[]; unavailable?: boolean },
    staleTime: 60_000,
  });
  const shows = here.data?.shows ?? [];

  const add = async (body: { listing: number } | { name: string }) => {
    setBusy(true);
    try {
      const out = await deskSend<{ seasonId: string; showId: string; label: string; ready: boolean; made: boolean }>("/shows", body);
      await after();
      if (out.ready) {
        toast.quiet(`${out.label} is a game already: here's its show`);
        nav.push(paths.deskItem("show", out.showId));
        return;
      }
      if (out.made) toast(`Added ${out.label}`);
      onPick({ seasonId: out.seasonId, showId: out.showId, label: out.label, kind: "listing" in body ? (listings.data?.hits.find((h) => h.tvmazeId === body.listing)?.kind ?? null) : null });
    } catch (e) {
      toast.quiet((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (showId) return <SeasonsOf showId={showId} onBack={() => setShowId(null)} onPick={onPick} />;
  return (
    <Section title="Which show?">
      <label className="flex h-12 items-center gap-2 rounded-[3px] bg-card px-3 outline-1 -outline-offset-1 outline-input">
        <Search className="size-5 text-muted-foreground" aria-hidden />
        <input data-new-show-q value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search shows and TV listings" aria-label="Which show?" autoFocus className="h-full min-w-0 flex-1 bg-transparent text-base outline-none" />
      </label>
      <p className="mt-2 text-[13px] leading-snug text-muted-foreground">One that&apos;s here already, one from the TV listings (it comes with its schedule), or just its name.</p>
      {term.length >= 2 && (
        <div aria-busy={busy || undefined}>
          {shows.length > 0 && (
            <>
              <p className="mt-4 text-[13px] font-semibold text-muted-foreground">Here already</p>
              {shows.map((s) => (
                <button key={s.id} type="button" data-new-show-here={s.id} onClick={() => setShowId(s.id)} className="nd-press flex min-h-[60px] w-full items-center gap-3 border-t border-border py-2 text-left first:border-t-0">
                  <span className="min-w-0 flex-1">
                    <b className="block text-[16px] font-semibold">{s.name}</b>
                    <small className="block text-[13px] text-muted-foreground">{[s.kind ? "A game" : "Not a game yet", s.season].filter(Boolean).join(" · ")}</small>
                  </span>
                  <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
                </button>
              ))}
            </>
          )}
          <p className="mt-4 text-[13px] font-semibold text-muted-foreground">TV listings</p>
          {listings.data?.unavailable && <p className="text-[14px] text-muted-foreground">TV listings aren&apos;t answering right now.</p>}
          {(listings.data?.hits ?? []).map((h) => (
            <button key={h.tvmazeId} type="button" disabled={busy} data-new-show-listing={h.tvmazeId} onClick={() => add({ listing: h.tvmazeId })} className="nd-press flex min-h-[60px] w-full items-center gap-3 border-t border-border py-2 text-left first:border-t-0 disabled:opacity-60">
              <Tv className="size-5 flex-none text-muted-foreground" aria-hidden />
              <span className="min-w-0 flex-1">
                <b className="block text-[16px] font-semibold">{h.name}</b>
                <small className="block text-[13px] text-muted-foreground">{[h.type, h.network, h.year].filter(Boolean).join(" · ")}</small>
              </span>
              <Plus className="size-5 text-muted-foreground" aria-hidden />
            </button>
          ))}
          {listings.data && !listings.data.hits.length && !listings.data.unavailable && <p className="text-[14px] text-muted-foreground">Nothing in the listings by that name.</p>}
          <button type="button" disabled={busy} data-new-show-name onClick={() => add({ name: q.trim() })} className="nd-press mt-3 flex min-h-[56px] w-full items-center gap-3 rounded-[3px] bg-card px-3 text-left disabled:opacity-60">
            <Plus className="size-5 flex-none" aria-hidden />
            <span className="min-w-0 flex-1">
              <b className="block text-[15px] font-semibold">Add &lsquo;{q.trim()}&rsquo; by name</b>
              <small className="block text-[13px] text-muted-foreground">No schedule: it&apos;s only a name until the listings have it</small>
            </span>
          </button>
        </div>
      )}
    </Section>
  );
}

/** A show that's here: its seasons (each to set up, or its rulebook once it's a game) and New season. */
function SeasonsOf({ showId, onBack, onPick }: { showId: string; onBack: () => void; onPick: (p: Picked) => void }) {
  const q = useDesk<DeskShow>(`/shows/${showId}`);
  const nav = useNav();
  const after = useAfterDesk();
  const [busy, setBusy] = useState(false);
  const s = q.data;
  const newSeason = async () => {
    setBusy(true);
    try {
      const out = await deskSend<DeskShow & { seasonId: string }>(`/shows/${showId}`, { action: "season" });
      await after();
      const made = out.seasons.find((x) => x.id === out.seasonId);
      if (out.setUp && made?.rulebookId) {
        toast(`${made.name} plays by last season's rulebook`);
        nav.push(paths.deskItem("rulebook", made.rulebookId));
      } else onPick({ seasonId: out.seasonId, showId, label: made?.name ?? out.name, kind: (out.kind as RulebookKind | null) ?? null });
    } catch (e) {
      toast.quiet((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Section title={s?.name ?? "Its seasons"}>
      <button type="button" onClick={onBack} className="mb-2 flex min-h-11 items-center gap-1 text-[15px] font-semibold">
        <ChevronLeft className="size-5" aria-hidden /> Another show
      </button>
      {!s ? (
        <div aria-busy className="h-32 animate-pulse rounded-[4px] bg-card" />
      ) : (
        <>
          <p className="mb-2 text-[14px] leading-snug text-muted-foreground">{s.setUp ? "A game already: a new season starts as last season's rulebook." : "Not a game yet: pick the season to set up."}</p>
          {s.seasons.map((x) =>
            s.setUp ? (
              <button key={x.id} type="button" data-new-show-season={x.id} disabled={!x.rulebookId} onClick={() => x.rulebookId && nav.push(paths.deskItem("rulebook", x.rulebookId))} className="nd-press flex min-h-[60px] w-full items-center gap-3 border-t border-border py-2 text-left first:border-t-0">
                <span className="min-w-0 flex-1">
                  <b className="block text-[16px] font-semibold">{x.name}</b>
                  <small className="block text-[13px] text-muted-foreground">{x.rulebookId ? "Its rulebook" : "No rulebook of its own"}</small>
                </span>
                <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
              </button>
            ) : (
              <button key={x.id} type="button" data-new-show-season={x.id} onClick={() => onPick({ seasonId: x.id, showId, label: x.name, kind: (s.kind as RulebookKind | null) ?? null })} className="nd-press flex min-h-[60px] w-full items-center gap-3 border-t border-border py-2 text-left first:border-t-0">
                <span className="min-w-0 flex-1">
                  <b className="block text-[16px] font-semibold">{x.name}</b>
                  <small className="block text-[13px] text-muted-foreground">{x.status ?? "upcoming"} · set it up</small>
                </span>
                <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
              </button>
            )
          )}
          <button type="button" disabled={busy} data-new-season onClick={newSeason} className="nd-press mt-3 flex min-h-[56px] w-full items-center gap-3 rounded-[3px] bg-card px-3 text-left disabled:opacity-60">
            <Plus className="size-5 flex-none" aria-hidden />
            <b className="text-[15px] font-semibold">New season {Math.max(0, ...s.seasons.map((x) => x.number)) + 1}</b>
          </button>
        </>
      )}
    </Section>
  );
}

// ---------- 2. How to start? ----------

function HowToStart({ picked, onBack }: { picked: Picked; onBack: () => void }) {
  const nav = useNav();
  const lib = useDesk<DeskLibrary>("/library");
  const [busy, setBusy] = useState<string | null>(null);
  const templates: LibraryTemplateCard[] = (lib.data?.kinds ?? []).flatMap((k) => k.templates);
  // The ones the desk saved from real rulebooks before the mirrors of stored formats, each the show's kind first (the
  // listing's guess, which calls every reality show a competition).
  const rank = (t: LibraryTemplateCard) => (t.saved ? 0 : 2) + (picked.kind && t.kind !== picked.kind ? 1 : 0);
  const ordered = [...templates].sort((a, b) => rank(a) - rank(b));
  const ask = async () => {
    setBusy("ask");
    try {
      await make.ask(picked.seasonId, null);
    } catch (e) {
      toast.quiet((e as Error).message);
    }
    nav.push(makePage(picked.seasonId));
  };
  const fromTemplate = async (t: LibraryTemplateCard) => {
    setBusy(t.id);
    try {
      await make.template(picked.seasonId, null, t.id);
      nav.push(makePage(picked.seasonId));
    } catch (e) {
      toast.quiet((e as Error).message);
      setBusy(null);
    }
  };
  return (
    <Section title="How do you want to start?">
      <button type="button" onClick={onBack} className="mb-1 flex min-h-11 items-center gap-1 text-[15px] font-semibold">
        <ChevronLeft className="size-5" aria-hidden /> {picked.label}
      </button>
      <p className="mb-3 text-[14px] leading-snug text-muted-foreground">Either way you check what it found before it&apos;s a game: the kind, the cast, each episode, what scores.</p>
      <button type="button" data-new-show-ask disabled={!!busy} onClick={ask} className="nd-press flex min-h-[72px] w-full items-center gap-3 rounded-[4px] bg-plate p-3.5 text-left text-plate-foreground shadow-plate disabled:opacity-70">
        <Sparkles className="size-6 flex-none" aria-hidden />
        <span className="min-w-0 flex-1">
          <b className="block text-[17px]">{busy === "ask" ? "Asking…" : "Ask ChatGPT for me"}</b>
          <small className="block text-[13px] leading-snug opacity-80">Free. Our bot asks how it works, starting from the nearest rulebook, then who&apos;s in it.</small>
        </span>
      </button>
      <button type="button" data-new-show-paste disabled={!!busy} onClick={() => nav.push(makePage(picked.seasonId))} className="nd-press mt-2 flex min-h-[64px] w-full items-center gap-3 border-b border-border pb-2 text-left">
        <Copy className="size-5 flex-none text-muted-foreground" aria-hidden />
        <span className="min-w-0 flex-1">
          <b className="block text-[15px] font-semibold">Copy and paste it yourself</b>
          <small className="block text-[13px] text-muted-foreground">Any AI chat that searches the web</small>
        </span>
      </button>
      <p className="mt-5 text-[13px] font-semibold text-muted-foreground">Or start from a starting point</p>
      <p className="text-[13px] leading-snug text-muted-foreground">Its rulebook, named for {picked.label}; then who&apos;s in it, from ChatGPT, a paste or the TV listing.</p>
      <div data-new-show-templates className="mt-2 flex flex-col gap-2">
        {!lib.data && <div aria-busy className="h-24 animate-pulse rounded-[4px] bg-card" />}
        {ordered.map((t) => {
          const Icon = KIND_ICON[t.kind];
          return (
            <button key={t.id} type="button" data-new-show-template={t.id} disabled={!!busy} onClick={() => fromTemplate(t)} className="nd-press flex min-h-[64px] w-full items-center gap-3 rounded-[4px] bg-card p-3 text-left disabled:opacity-60">
              <Icon className="size-5 flex-none text-muted-foreground" aria-hidden />
              <span className="min-w-0 flex-1">
                <b className="block text-[15px] font-semibold">{busy === t.id ? "Starting…" : t.name}</b>
                <small className="block truncate text-[13px] text-muted-foreground">{t.like.length ? `Plays like ${t.like.slice(0, 3).join(", ")}` : t.tags.join(" · ")}</small>
              </span>
              <ChevronRight className="size-5 flex-none text-muted-foreground" aria-hidden />
            </button>
          );
        })}
      </div>
    </Section>
  );
}

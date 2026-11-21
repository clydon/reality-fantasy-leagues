"use client";

import { useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronRight, Clock, Users, Zap, type LucideIcon } from "lucide-react";
import { airTime, lockTime } from "../clock";
import { backstage, gameAdmin, type WaiverAdminGame, type WaiverWeek } from "../data";
import { Pictogram } from "../couch/gallery-bold/icons";
import { Choice } from "../manage/choice";
import { NavLink } from "../nav";
import { paths } from "../routes";
import { WaiversHow } from "../show/waivers";
import { Avatar } from "../ui/bars";
import { GuardSheet } from "../ui/guards";
import { Btn } from "../ui/parts";
import { Sheet } from "../ui/sheet";
import { toast } from "../ui/toast";
import { Face } from "../show/parts";

// A game's waivers for whoever runs it (the mock's backstage.js bsWaivers with waivers.js's simple settings and 3B window; docs/
// PLAN-new-design.md step 6a). Since settings Round 3a (the user's pick, 2026-11-21) they live on the game's Manage this game,
// not a Backstage page of their own: an open week is a job (WaiverJob) that opens in place to who has picks in (never what they
// are: picks are private until they run), Pick for them, Run now (tier 2: a preview first, Undo while free agency is open) and
// the window's Change or Turn off; Replacing people who leave opens in place (WaiverRule) to the week as it stands, the last run
// with Undo, how waivers work (one choice of feel, Relaxed · Standard · Strict, applied on tap with Undo, the rest under
// Fine-tune) and what players see. A Helper runs the week; the feel and Fine-tune are a Commissioner's. Pick for them (step 7):
// someone who hasn't put picks in, helped over the phone; you see their spots and who's free, never what they picked. It's also
// on that person's sheet in Who's playing (manage/people.tsx).

/** Pick for them: one spot of theirs and who comes in, sent for them; the rest of their picks stay as they are. */
export function ClaimFor({ seasonId, couchId, game, who, onClose }: { seasonId: string; couchId: string; game: WaiverAdminGame; who: { playerId: string; name: string } | null; onClose: () => void }) {
  const after = useAfter();
  const view = useQuery({
    queryKey: ["new-design", "bs2", "claim-for", game.leagueId, who?.playerId ?? null],
    queryFn: () => gameAdmin.waivers<{ week: WaiverWeek }>(seasonId, couchId, game.leagueId, { action: "claimView", playerId: who!.playerId }),
    enabled: !!who,
    staleTime: 10_000,
    retry: false,
  });
  const week = view.data?.week ?? null;
  const failed = view.error ? (view.error as Error).message : null;
  const [chosen, setSpot] = useState<string | null>(null);
  const spot = chosen ?? week?.replace[0] ?? null;
  const [add, setAdd] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const first = (n: string) => n.split(" ")[0];
  const spots = week ? [...week.replace, ...(week.swapsAllowed ? week.team.filter((f) => f.out == null && !week.replace.includes(f.id)).map((f) => f.id) : [])] : [];
  const face = (id: string) => week?.team.find((f) => f.id === id);
  return (
    <Sheet open={!!who} onOpenChange={(o) => !o && onClose()} title={who ? `Pick for ${who.name}` : "Pick for them"} subtitle={`${game.name} · you won't see what they picked`}>
      <div data-claim-for>
        {failed ? (
          <p className="py-4 text-sm text-muted-foreground">{failed}</p>
        ) : !week ? (
          <div aria-busy className="h-40 animate-pulse rounded-[4px] bg-secondary" />
        ) : !spots.length ? (
          <p className="py-4 text-sm text-muted-foreground">{who?.name} has nobody to replace this week, and no swaps.</p>
        ) : (
          <>
            <p className="type-caption mb-2 text-[13px] tracking-[0.06em] text-muted-foreground">{week.replace.length ? "Who goes" : "Swap out"}</p>
            <div className="flex flex-wrap gap-1.5">
              {spots.map((id) => (
                <button
                  key={id}
                  type="button"
                  data-claim-spot={id}
                  aria-pressed={spot === id}
                  onClick={() => setSpot(id)}
                  className={`flex h-9 items-center rounded-[2px] px-3 text-sm font-semibold ${spot === id ? (week.replace.includes(id) ? "bg-chyron text-chyron-foreground" : "bg-foreground text-background") : "bg-secondary"}`}
                >
                  {week.replace.includes(id) ? "Replace" : "Swap"} {first(face(id)?.name ?? "someone")}
                </button>
              ))}
            </div>
            <p className="type-caption mb-1 mt-5 text-[13px] tracking-[0.06em] text-muted-foreground">Who comes in</p>
            <ul className="max-h-[42dvh] overflow-y-auto">
              {week.free.map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    data-claim-add={f.id}
                    aria-pressed={add === f.id}
                    onClick={() => setAdd(add === f.id ? null : f.id)}
                    className={`flex min-h-14 w-full items-center gap-3 border-t border-border px-1 text-left ${add === f.id ? "bg-[rgba(255,197,49,.12)]" : ""}`}
                  >
                    <Face src={f.photo} name={f.name} className="size-10 rounded-[3px]" />
                    <span className="min-w-0 flex-1">
                      <b className="block truncate text-[15px]">{f.name}</b>
                      <small className="block truncate text-[13px] text-muted-foreground">{[f.group?.name, f.tag].filter(Boolean).join(" · ")}</small>
                    </span>
                    {add === f.id && <Check className="size-5 text-chyron-line" strokeWidth={3} aria-hidden />}
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[13px] leading-snug text-muted-foreground">It goes in as their pick for this spot, in place of anything they picked for it. Their other picks stay.</p>
            <Btn
              tone="must"
              wide
              className="mt-3"
              data-claim-send
              disabled={!spot || !add || busy}
              onClick={async () => {
                if (!who || !spot || !add) return;
                setBusy(true);
                try {
                  await gameAdmin.waivers(seasonId, couchId, game.leagueId, { action: "claimFor", playerId: who.playerId, dropId: spot, addIds: [add] });
                  await after();
                  toast(`Sent ${first(who.name)}'s pick: it's in their waivers`);
                  onClose();
                } catch (e) {
                  toast.quiet((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Send {who ? `${first(who.name)}'s` : "their"} pick
            </Btn>
          </>
        )}
      </div>
    </Sheet>
  );
}

const FEEL_WORDS = {
  casual: "Forgiving. Nobody falls behind for bad luck.",
  balanced: "Replacements wait for a window; a swap every few episodes.",
  competitive: "Every loss costs you. Stay sharp.",
} as const;
const RULES: [WaiverAdminGame["settings"]["replaceRule"], string, string][] = [
  ["always", "Whenever one goes home", "After any episode"],
  ["whenShort", "When your team is short", "Once a team is down to its starters"],
  ["windows", "In set windows", "Out castaways sit until then"],
  ["never", "No replacements", "Out is out"],
];
// A feel's name: Round 0's (Relaxed · Standard · Strict), as Start a game will say it.
const FEEL_NAME = { casual: "Relaxed", balanced: "Standard", competitive: "Strict" } as Record<string, string>;
const cap = (s: string) => FEEL_NAME[s] ?? s.charAt(0).toUpperCase() + s.slice(1);
const schedule = (w: WaiverAdminGame["settings"]["windows"]) => (w.schedule === "manual" ? "you open windows" : w.schedule === "everyEpisode" ? "a window every episode" : `every ${w.every} episodes`);
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

function useAfter() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: ["new-design"] });
}

function useUndoBatch(seasonId: string, couchId: string) {
  const after = useAfter();
  return async (batch: string, what: string) => {
    try {
      await backstage.undo(seasonId, couchId, batch);
      await after();
      toast(`Undone: ${what}`);
    } catch (e) {
      toast.quiet((e as Error).message);
    }
  };
}

/** A small label inside an opened line, as How moves lock's "Late moves". */
function Caption({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`type-caption pb-1.5 text-[13px] tracking-[0.05em] text-muted-foreground ${className}`}>{children}</p>;
}

/** Replacing people who leave's value on Manage this game: when they're replaced, then how windows come (one name per fact: the
 *  check's finding 2, so "every 3 episodes" is on the line, not only on a page behind it). */
export function waiverRuleValue(g: WaiverAdminGame): string {
  const rule = RULES.find(([k]) => k === g.settings.replaceRule)?.[1] ?? "";
  return [rule, schedule(g.settings.windows), g.start.name ? `starts with ${g.start.name}` : null].filter(Boolean).join(" · ");
}

/** An open waiver window as a job on Manage this game (settings Round 3a, the user's pick on the check's second choice: the week on
 *  the game, not a page of its own). Its row is the page's one yellow while it's due, and opens in place to who's picked, Pick
 *  for them and Run now. */
export function WaiverJob({ seasonId, couchId, g }: { seasonId: string; couchId: string; g: WaiverAdminGame }) {
  const [open, setOpen] = useState(false);
  const p = g.period;
  if (p?.phase !== "open") return null;
  const n = g.claims.filter((c) => c.in).length;
  return (
    <div data-job="waivers" data-bs-plate="open" data-job-open={open ? "yes" : "no"} className="border-t border-border first:border-t-0">
      <button type="button" data-job-toggle aria-expanded={open} onClick={() => setOpen(!open)} className={`nd-press flex min-h-[72px] w-full items-center gap-3 py-2.5 text-left ${FOCUS}`}>
        <span className="grid size-12 flex-none place-items-center rounded-[3px] bg-chyron text-chyron-foreground">
          <Pictogram id="swap" className="size-7" />
        </span>
        <span className="min-w-0 flex-1">
          <b className="block text-[16px] leading-tight">{p.window ? "A waiver window is open" : "Waivers are open"}</b>
          <small className="block text-[13px] leading-snug text-muted-foreground">{[p.line, p.due ? `due ${lockTime(Date.parse(p.due))}` : null].filter(Boolean).join(" · ")}</small>
          <small className="block text-[13px] leading-snug text-muted-foreground">
            {n} of {g.claims.length} have picks in
          </small>
        </span>
        {!open && <span className="flex-none text-[15px] font-semibold">See picks</span>}
        <ChevronRight className={`size-5 flex-none text-muted-foreground transition-transform duration-200 ${open ? "rotate-90" : ""}`} aria-hidden />
      </button>
      {open && <WaiverWeek seasonId={seasonId} couchId={couchId} g={g} />}
    </div>
  );
}

/** The open week: who's picked (never what), Pick for them, Run now (tier 2: a preview first), then the window's Change or Turn off. */
function WaiverWeek({ seasonId, couchId, g }: { seasonId: string; couchId: string; g: WaiverAdminGame }) {
  const [opening, setOpening] = useState(false);
  const [helping, setHelping] = useState<{ playerId: string; name: string } | null>(null);
  // Run now's preview (tier 2): false closed, null while it's asked.
  const [guard, setGuard] = useState<RunPreview | null | false>(false);
  const after = useAfter();
  const undoBatch = useUndoBatch(seasonId, couchId);
  const p = g.period!;
  const turnOff = async () => {
    try {
      await gameAdmin.waivers(seasonId, couchId, g.leagueId, { action: "window", swaps: null });
      await after();
      toast("Window off · the couch has been told");
    } catch (e) {
      toast.quiet((e as Error).message);
    }
  };
  const preview = async () => {
    setGuard(null);
    try {
      setGuard(await gameAdmin.waivers<RunPreview>(seasonId, couchId, g.leagueId, { action: "preview" }));
    } catch (e) {
      setGuard(false);
      toast.quiet((e as Error).message);
    }
  };
  return (
    <div data-waiver-week className="mb-3 rounded-[3px] bg-background px-3 pb-3 pt-2">
      <ul className="flex flex-col">
        {g.claims.map((c) => (
          <li key={c.playerId} data-claim={c.name} className="flex min-h-[56px] items-center gap-3 border-t border-border py-1.5 first:border-t-0">
            <Avatar id={c.userId ?? c.playerId} name={c.name} size={32} />
            <span className="min-w-0 flex-1">
              <b className="flex items-center gap-2 text-[16px]">
                <span className="truncate">{c.name}</span>
                {c.you && <span className="type-caption flex-none rounded-[2px] bg-foreground px-1.5 text-[12px] text-background">You</span>}
              </b>
              <small className="block text-[13px] text-muted-foreground">{c.in ? "Picks in" : "No picks yet"}</small>
            </span>
            {c.you ? (
              <NavLink href={`${paths.showPage(seasonId, "waivers")}?game=${g.leagueId}`} className="nd-press flex h-10 flex-none items-center rounded-[3px] px-3 text-[14px] font-bold outline-1 -outline-offset-1 outline-input">
                Your swaps
              </NavLink>
            ) : c.in ? (
              <span className="flex flex-none items-center gap-1 text-[14px] font-bold text-good">
                <Check className="size-4" strokeWidth={3} aria-hidden />
                In
              </span>
            ) : g.revealFirst ? null : (
              <button
                type="button"
                data-claim-for-open={c.name}
                onClick={() => setHelping({ playerId: c.playerId, name: c.name })}
                className="nd-press flex h-10 flex-none items-center rounded-[3px] px-3 text-[14px] font-bold outline-1 -outline-offset-1 outline-input"
              >
                Pick for them
              </button>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-1 text-[13px] leading-snug text-muted-foreground">Picks stay private until they run, even from you.</p>
      {/* Not yellow: the week runs on its own when it's due; this is only sooner. */}
      <Btn data-bs-run wide className="mt-3" onClick={preview}>
        Run now
      </Btn>
      {p.due && <p className="mt-1.5 text-center text-[13px] text-muted-foreground">Or on its own, {airTime(Date.parse(p.due))}</p>}
      <div className="mt-2 flex justify-center gap-2">
        <button type="button" data-bs-change onClick={() => setOpening(true)} className={`nd-press h-11 rounded-[3px] px-3 text-[14px] font-bold ${FOCUS}`}>
          {p.window ? "Change the window" : "Make it a window"}
        </button>
        {p.window && p.byHand && (
          <button type="button" data-bs-off onClick={turnOff} className={`nd-press h-11 rounded-[3px] px-3 text-[14px] font-bold ${FOCUS}`}>
            Turn it off
          </button>
        )}
      </div>
      <OpenWindowSheet open={opening} onOpenChange={setOpening} seasonId={seasonId} couchId={couchId} g={g} />
      <ClaimFor key={helping?.playerId ?? "none"} seasonId={seasonId} couchId={couchId} game={g} who={helping} onClose={() => setHelping(null)} />
      <GuardSheet
        open={guard !== false}
        onOpenChange={(o) => !o && setGuard(false)}
        title="Run waivers now?"
        subtitle="Picks are private until they run. This is what happens."
        lines={guard ? [] : null}
        body={guard ? <RunLines r={guard} /> : null}
        cta="Run waivers"
        undoNote="You can undo it from Recent changes while free agency is open."
        onConfirm={async () => {
          const r = await gameAdmin.waivers(seasonId, couchId, g.leagueId, { action: "run" });
          await after();
          toast("Waivers ran · the couch gets the reveal", r.batch ? { undo: () => void undoBatch(r.batch!, "the waiver run") } : {});
        }}
      />
    </div>
  );
}

/** Replacing people who leave, opened in place on Manage this game: the week as it stands (a window to open, the last run with
 *  Undo), how waivers work (the Commissioner's to change; a Helper reads it as a value), and what players see. */
export function WaiverRule({ seasonId, couchId, g }: { seasonId: string; couchId: string; g: WaiverAdminGame }) {
  const [opening, setOpening] = useState(false);
  const [how, setHow] = useState(false);
  const after = useAfter();
  const undoBatch = useUndoBatch(seasonId, couchId);
  const p = g.period;
  const now =
    p?.phase === "open"
      ? `${p.window ? "A window is open" : "Waivers are open"}: who's picked is at the top.`
      : p
        ? `Free agency is open, after Episode ${p.episode}${p.until ? `, until ${airTime(Date.parse(p.until))}` : ""}.`
        : g.how.starts
          ? `No window open. ${g.how.starts}, then a window to replace everyone who's out.`
          : "No window open. Players replace who's out when one opens.";
  const undoRun = async () => {
    if (g.run!.batch) return undoBatch(g.run!.batch, "the waiver run");
    try {
      await gameAdmin.waivers(seasonId, couchId, g.leagueId, { action: "undo" });
      await after();
      toast("Waiver run undone · picks are back");
    } catch (e) {
      toast.quiet((e as Error).message);
    }
  };
  return (
    <div data-waiver-rule data-bs-plate={p ? p.phase : "none"} className="pb-2">
      <Caption>This week</Caption>
      <p className="text-[15px] leading-snug">{now}</p>
      {!p && (
        <Btn data-bs-open wide className="mt-2.5" onClick={() => setOpening(true)}>
          Open a waiver window
        </Btn>
      )}

      {g.run && (
        <div data-last-run className="mt-4">
          <div className="flex items-baseline justify-between gap-3">
            <Caption>Last run · after Episode {g.run.episode}</Caption>
            {(g.run.batch || g.run.undoable) && (
              <button type="button" data-bs-undo-run onClick={() => void undoRun()} className={`h-9 px-1 text-[14px] font-bold ${FOCUS}`}>
                Undo
              </button>
            )}
          </div>
          {g.run.moves === null ? (
            <p className="text-[14px] text-muted-foreground">Reveal Episode {g.run.episode} to see who got who.</p>
          ) : g.run.moves.length ? (
            <ul className="flex flex-col">
              {g.run.moves.map((m, i) => (
                <li key={i} className="flex min-h-[48px] items-center gap-2.5 border-t border-border py-1.5 first:border-t-0">
                  <Face src={m.photo} name={m.add ?? undefined} className="size-9 flex-none rounded-[3px]" />
                  <span className="text-[15px]">
                    <b>{m.name}</b> got {m.add}
                    {m.drop ? <small className="text-muted-foreground"> for {m.drop}</small> : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[14px] text-muted-foreground">Nobody moved.</p>
          )}
        </div>
      )}

      <Caption className="mt-5">How waivers work</Caption>
      {g.commissioner ? (
        <WaiverSettings seasonId={seasonId} couchId={couchId} g={g} onUndo={undoBatch} />
      ) : (
        <div data-bs-feel-read className="rounded-[4px] bg-secondary px-3 py-2.5">
          <b className="block text-[16px] font-semibold leading-tight">{g.recommended ? cap(g.feel) : "Customized"}</b>
          <span className="mt-1 block text-[14px] leading-snug">{waiverRuleValue(g)}</span>
          <small className="mt-1 block text-[13px] text-muted-foreground">The Commissioner&apos;s to change</small>
        </div>
      )}

      <button type="button" data-bs-how onClick={() => setHow(true)} className={`nd-press mt-3 flex min-h-12 w-full items-center gap-3 border-t border-border text-left ${FOCUS}`}>
        <span className="min-w-0 flex-1">
          <b className="block text-[15px] font-semibold">What players see</b>
          <small className="block text-[13px] text-muted-foreground">How waivers work, when moves happen</small>
        </span>
        <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
      </button>

      <OpenWindowSheet open={opening} onOpenChange={setOpening} seasonId={seasonId} couchId={couchId} g={g} />
      <WaiversHow open={how} onOpenChange={setHow} how={g.how} gameName={g.gameName} />
    </div>
  );
}

interface RunPreview {
  claimsIn: number;
  of: number;
  fallback: boolean;
  until: string | null;
  shared: boolean;
  orderBy: string;
}

/** What Run now does, with nothing private in it: how many picks are in, what happens to anyone who forgot, then free agency. */
function RunLines({ r }: { r: RunPreview }) {
  const missing = r.of - r.claimsIn;
  const lines: [LucideIcon, string][] = [
    [Users, `${r.claimsIn} of ${r.of} have picks in${r.shared ? "" : ` · they go through ${r.orderBy === "leastPoints" ? "lowest score first" : "in picking order"}`}`],
    ...(missing ? [[Zap, r.fallback ? "Anyone who forgot gets whoever's free with the most points" : "Anyone who forgot plays short this week"] as [LucideIcon, string]] : []),
    ...(r.until ? [[Clock, `Then free agency until ${airTime(Date.parse(r.until))}`] as [LucideIcon, string]] : []),
  ];
  return (
    <div data-run-preview className="flex flex-col gap-1.5">
      {lines.map(([Icon, text]) => (
        <div key={text} className="flex items-center gap-2.5 rounded-[3px] bg-background p-2.5">
          <Icon className="size-5 flex-none text-muted-foreground" aria-hidden />
          <span className="text-[15px] font-semibold">{text}</span>
        </div>
      ))}
    </div>
  );
}

// ---------- Open a waiver window: three presets, or something else ----------

const PRESETS: [string, string, string, boolean, (roster: number) => number][] = [
  ["rep", "Replace who's out", "Everyone replaces who's out.", true, () => 0],
  ["one", "Replace + 1 swap", "And 1 optional swap each, for anyone.", true, () => 1],
  ["all", "Swap anyone", "Replace who's out and swap any of the rest, e.g. after the merge.", true, (r) => r],
];

function windowWords(replace: boolean, swaps: number, roster: number): string {
  return [replace ? "Replace who's out" : "", swaps ? (swaps >= roster ? "swap anyone" : `${swaps} optional swap${swaps > 1 ? "s" : ""} each`) : ""].filter(Boolean).join(" · ").replace(/^./, (c) => c.toUpperCase());
}

function OpenWindowSheet({ open, onOpenChange, seasonId, couchId, g }: { open: boolean; onOpenChange: (o: boolean) => void; seasonId: string; couchId: string; g: WaiverAdminGame }) {
  const R = g.settings.roster;
  const [replace, setReplace] = useState(true);
  const [swaps, setSwaps] = useState(g.period?.window ? g.period.swaps : 1);
  const [custom, setCustom] = useState(false);
  const [busy, setBusy] = useState(false);
  const after = useAfter();
  const line = windowWords(replace, swaps, R);
  const go = async () => {
    setBusy(true);
    try {
      const r = await gameAdmin.waivers<{ batch: string; fresh: boolean }>(seasonId, couchId, g.leagueId, { action: "window", swaps, replace });
      await after();
      onOpenChange(false);
      toast(
        `Window open · the couch got "${line}"`,
        r.fresh
          ? {
              undo: async () => {
                await gameAdmin.waivers(seasonId, couchId, g.leagueId, { action: "window", swaps: null });
                await after();
              },
            }
          : {}
      );
    } catch (e) {
      toast.quiet((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={g.period?.window ? "Change the window" : "Open a waiver window"} subtitle={`${g.gameName} · after Episode ${g.period?.episode ?? g.latest}`}>
      <div data-bs-window className="flex flex-col gap-2">
        {!custom ? (
          <>
            {PRESETS.map(([k, t, d, rep, n]) => {
              const on = replace === rep && swaps === n(R);
              return (
                <button key={k} type="button" data-preset={k} aria-pressed={on} onClick={() => { setReplace(rep); setSwaps(n(R)); }} className={`rounded-[3px] p-3 text-left ${on ? "bg-foreground text-background" : "bg-background"}`}>
                  <span className="flex items-center gap-2">
                    <i className={`grid size-5 place-items-center rounded-full border-2 ${on ? "border-background" : "border-input"}`} aria-hidden>
                      {on && <i className="size-2.5 rounded-full bg-background" />}
                    </i>
                    <b className="type-caption text-[18px]">{t}</b>
                  </span>
                  <small className={`mt-1 block pl-7 text-[13px] ${on ? "text-background/75" : "text-muted-foreground"}`}>{d}</small>
                </button>
              );
            })}
            <button type="button" onClick={() => setCustom(true)} className="h-11 text-[14px] font-semibold text-muted-foreground">
              Something else
            </button>
          </>
        ) : (
          <>
            <Toggle on={replace} onClick={() => setReplace(!replace)} title="Replace castaways who are out" line={replace ? "Each gets a free agent." : "Out castaways stay on the team."} />
            <Stepper title="Optional swaps each" line={swaps === 0 ? "Nobody still in can move." : swaps >= R ? "Any of them." : `Up to ${swaps} each.`} value={swaps === 0 ? "None" : swaps >= R ? "All" : String(swaps)} onStep={(d) => setSwaps(Math.max(0, Math.min(R, swaps + d)))} />
          </>
        )}
        <p className="mt-1 text-[13px] text-muted-foreground">{line ? "Everyone gets a notification saying what they can swap and by when." : "Nothing to swap yet."}</p>
        <div className="mt-1 grid grid-cols-2 gap-2">
          <Btn onClick={() => onOpenChange(false)}>Not now</Btn>
          <Btn data-bs-open-go tone="ink" disabled={!line || busy} onClick={go}>
            {busy ? "Opening…" : g.period?.window ? "Change it" : "Open window"}
          </Btn>
        </div>
      </div>
    </Sheet>
  );
}

// ---------- How waivers work: one choice of feel, Fine-tune under it (the Commissioner's, in place on Manage this game) ----------

function WaiverSettings({ seasonId, couchId, g, onUndo }: { seasonId: string; couchId: string; g: WaiverAdminGame; onUndo: (batch: string, what: string) => Promise<void> }) {
  const [fine, setFine] = useState(false);
  const after = useAfter();
  const S = g.settings;
  const write = async (body: Parameters<typeof gameAdmin.waivers>[3], said: string) => {
    try {
      const r = await gameAdmin.waivers(seasonId, couchId, g.leagueId, body);
      await after();
      toast(said, r.batch ? { undo: () => void onUndo(r.batch!, "the waiver settings") } : {});
    } catch (e) {
      toast.quiet((e as Error).message);
    }
  };
  const set = (k: string, v: unknown) => write({ action: "set", set: { [k]: v } }, "Saved · the couch sees it in How it works");
  const st = g.start;
  // When they start: from the start, or with a later phase of the season (only where the season has one, or one's set).
  const starts: [string | null, string, string][] = [
    [null, "From the start", "As set below, from the game's first episode"],
    ...st.phases.map((x): [string, string, string] => [
      x.id,
      `When ${x.name} starts`,
      `Nothing before it. ${st.phase === x.id && st.at !== null ? `Episode ${st.at}` : "Its first episode"} opens a window to replace everyone who's out, then as set below`,
    ]),
  ];
  const seg = (on: boolean) => `h-10 rounded-[3px] text-[14px] font-bold ${FOCUS} ${on ? "bg-foreground text-background" : "bg-secondary"}`;
  return (
    <div data-bs-feel-sheet className="flex flex-col gap-2">
      {(st.phases.length > 0 || st.phase) && (
        <div data-bs-start className="mb-2 flex flex-col gap-2">
          <p className="text-[14px] font-semibold">When they start</p>
          {starts.map(([k, t, d]) => (
            <Choice key={k ?? "start"} data={`start-${k ?? "start"}`} dataset={{ "data-start": k ?? "start" }} title={t} line={d} chosen={st.phase === k} onPick={() => st.phase !== k && set("waiverStartPhase", k)} />
          ))}
        </div>
      )}
      <p className="text-[14px] leading-snug text-muted-foreground">Pick a feel. It sets everything under it; your players see it in How it works.</p>
      {g.feels.map((f) => {
        const on = g.recommended && g.feel === f.key;
        return (
          <Choice
            key={f.key}
            data={`feel-${f.key}`}
            dataset={{ "data-feel": f.key }}
            title={cap(f.key)}
            recommended={f.key === "balanced"}
            line={FEEL_WORDS[f.key]}
            chosen={on}
            onPick={() => write({ action: "feel", feel: f.key }, `Waivers on ${cap(f.key)} · the couch sees it in How it works`)}
          >
            {on && (
              <ul className="mt-2 flex flex-col gap-1 text-[13px] leading-snug">
                {f.lines.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            )}
          </Choice>
        );
      })}
      <button type="button" data-fine aria-expanded={fine} onClick={() => setFine(!fine)} className={`mt-1 flex min-h-12 w-full items-center gap-2 border-t border-border text-left ${FOCUS}`}>
        <b className="flex-1 text-[15px]">Fine-tune</b>
        <small className="text-[13px] text-muted-foreground">{g.recommended ? "Using the feel above" : "Customized"}</small>
        <ChevronRight className={`size-5 text-muted-foreground transition-transform ${fine ? "rotate-90" : ""}`} aria-hidden />
      </button>
      {fine && (
        <div data-fine-body className="flex flex-col gap-2 pb-1">
          <p className="text-[14px] font-semibold">When they&apos;re replaced</p>
          {RULES.map(([k, t, d]) => (
            <Choice key={k} data={`rule-${k}`} dataset={{ "data-rule": k }} title={t} line={d} chosen={S.replaceRule === k} onPick={() => S.replaceRule !== k && set("replaceRule", k)} />
          ))}
          <p className="mt-2 text-[14px] font-semibold">Waiver windows</p>
          <div className="grid grid-cols-3 gap-1" role="group" aria-label="When windows open">
            {(
              [
                ["everyEpisode", "Every episode"],
                ["every", `Every ${S.windows.every}`],
                ["manual", "You decide"],
              ] as const
            ).map(([k, l]) => (
              <button key={k} type="button" aria-pressed={S.windows.schedule === k} onClick={() => set("waiverWindows", { schedule: k })} className={seg(S.windows.schedule === k)}>
                {l}
              </button>
            ))}
          </div>
          <Stepper
            title="Optional swaps each"
            line={S.windows.schedule === "manual" ? "Set when you open one" : "For anyone still on the team"}
            value={S.windows.swaps === 0 ? "None" : S.windows.swaps >= S.roster ? "All" : String(S.windows.swaps)}
            onStep={(d) => set("waiverWindows", { swaps: Math.max(0, Math.min(S.roster, S.windows.swaps + d)) })}
            atMin={S.windows.swaps <= 0}
            atMax={S.windows.swaps >= S.roster}
          />
          {/* Settings Round 3b (A15): the timing is real now, safe to change while the game runs: each takes effect from the next
              window (free agency at once), and says so. */}
          <p className="mt-2 text-[14px] font-semibold">Timing</p>
          <p className="-mt-1 text-[13px] leading-snug text-muted-foreground">From the next window on. A window already open keeps its times.</p>
          <Stepper
            title="Claims close"
            line="Before it airs"
            value={`${S.processHours} h`}
            onStep={(d) => {
              const i = HOURS.indexOf(S.processHours);
              const next = HOURS[Math.max(0, Math.min(HOURS.length - 1, (i < 0 ? HOURS.indexOf(24) : i) + d))];
              if (next !== S.processHours) set("waiverProcessHours", next);
            }}
            atMin={S.processHours <= HOURS[0]}
            atMax={S.processHours >= HOURS[HOURS.length - 1]}
          />
          {/* The round's tick cards for a pick of one from a few (the check's fix: PFD R3). */}
          <p className="mt-1 text-[14px] font-semibold">Who goes first, when two claim the same one</p>
          {(
            [
              ["leastPoints", "Fewest points", "The team that's behind gets first pick"],
              ["mostPoints", "Most points", "The leader gets first pick"],
              ["rolling", "Rolling", "Whoever got one last goes to the back"],
            ] as const
          ).map(([k, t, d]) => (
            <Choice key={k} data={`order-${k}`} dataset={{ "data-order": k }} title={t} line={d} chosen={S.orderBy === k} onPick={() => S.orderBy !== k && set("replenishOrderBy", k)} />
          ))}
          <Toggle on={S.freeAgency} onClick={() => set("freeAgencyEnabled", !S.freeAgency)} title="Free agency" line={S.freeAgency ? "After the claims, anyone left is free to take until airtime" : "Off: only claims, in the windows"} />
          <Toggle on={S.autoFill} onClick={() => set("autoFill", !S.autoFill)} title="Fallback pick" line="Forget to pick? They get whoever's free with the most points." />
        </div>
      )}
    </div>
  );
}
/** Claims close this many hours before an episode airs (Settings Round 3b: Fine-tune's timing, real). */
const HOURS = [6, 12, 24, 48];

function Toggle({ on, onClick, title, line, disabled }: { on: boolean; onClick: () => void; title: string; line: string; disabled?: boolean }) {
  return (
    <button type="button" aria-pressed={on} disabled={disabled} onClick={onClick} className="flex items-center gap-3 rounded-[3px] bg-secondary p-2.5 text-left">
      <span className="min-w-0 flex-1">
        <b className="block text-[15px]">{title}</b>
        <small className="text-[13px] text-muted-foreground">{line}</small>
      </span>
      <span className={`relative h-6 w-10 flex-none rounded-full transition-colors ${on ? "bg-good" : "bg-secondary"}`} aria-hidden>
        <i className={`absolute top-0.5 size-5 rounded-full bg-white transition-transform ${on ? "translate-x-[18px]" : "translate-x-0.5"}`} />
      </span>
    </button>
  );
}

/** A setting stepped up or down. `atMin`/`atMax`: that way is as far as it goes (the button is off). */
export function Stepper({ title, line, value, onStep, disabled, atMin, atMax }: { title: ReactNode; line?: string; value: string; onStep: (d: number) => void; disabled?: boolean; atMin?: boolean; atMax?: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-[3px] bg-background p-2.5">
      <span className="min-w-0 flex-1">
        <b className="block text-[15px]">{title}</b>
        {line && <small className="text-[13px] text-muted-foreground">{line}</small>}
      </span>
      <span className="flex items-center gap-1">
        <button type="button" aria-label="Fewer" disabled={disabled || atMin} onClick={() => onStep(-1)} className="grid size-11 place-items-center rounded-[3px] bg-card text-[20px] font-bold disabled:opacity-40">
          −
        </button>
        <b className="type-num w-11 text-center text-[22px]">{value}</b>
        <button type="button" aria-label="More" disabled={disabled || atMax} onClick={() => onStep(1)} className="grid size-11 place-items-center rounded-[3px] bg-card text-[20px] font-bold disabled:opacity-40">
          +
        </button>
      </span>
    </div>
  );
}

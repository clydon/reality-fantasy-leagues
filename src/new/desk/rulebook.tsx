"use client";

import { useMemo, useState } from "react";
import { BookOpen, Check, ChevronRight, Clock, Copy, Plus, X } from "lucide-react";
import { OPT, QUESTIONS, TWIST_FIELDS, blockLabel, blocksProblems, camelId, dropMisfitRefinements, labelOf, optionsFor, type RulebookBlocks } from "@/lib/game/formats/rulebook-schema.js";
import { momentsFor, WAY_POINTS } from "@/lib/game/formats/rulebook-moments.js";
import { diffBlocks, opLines } from "@/lib/game/formats/rulebook-patch.js";
import { airTime } from "../clock";
import { useNav } from "../nav";
import { paths } from "../routes";
import { HowItWorksBody } from "../show/how-it-works";
import { Btn, Chip } from "../ui/parts";
import { Sheet } from "../ui/sheet";
import { toast } from "../ui/toast";
import { deskSend, useAfterDesk, useDesk, type DeskRulebook } from "./data";
import { Choice, DeskHeader, History, LockRow, Multi, Section, Stepper, Tag, Text } from "./parts";

// A rulebook on the desk, as its editor (docs/PLAN-new-design.md step 6b part 2; rulebooks phases 4-6; the mock's
// rulebook.js adminRulebook, with each part's Override made the part's own questions). The parts are listed as they
// read now; tapping one opens its editor (the schema's questions and choices: rulebook-schema.js, so the editor, the
// research prompt and the validator can't drift), changes collect as a draft with a live count of what changed, and
// Save asks what kind of change it is: Fix a mistake (every couch rescored from the start) or The show changed (from an
// episode on). Check for changes asks research for the rulebook again and shows what its answer would change. Lock,
// the Timeline, History, and Save as a starting point. Step 10 part 3 adds Fits these games (rulebook-fits.js gamesFor, what
// each game needs), Take it over for a rulebook a player made, and a library rulebook's own controls (offered as a starting
// point or not, Delete while nothing's made from it). Server: src/lib/server/desk-rulebooks.ts and desk-library.ts.

type Obj = Record<string, unknown>;
type Block = "kind" | "cast" | "season" | "segments" | "waysOut" | "twists" | "points";
type Editing = { block: Block } | { block: "segment" | "wayOut" | "twist" | "phase" | "custom" | "finale"; id: string | null; type?: string };

const opts = (key: string, blocks?: RulebookBlocks) => (blocks ? optionsFor(key, blocks) : (OPT as Record<string, [string, string, string][]>)[key] ?? []) as [string, string, string][];
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const str = (v: unknown) => (typeof v === "string" ? v : "");
const lst = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

/** A new item's id from its name, unique in the rulebook. */
function newId(blocks: RulebookBlocks, name: string) {
  const used = new Set<string>([
    ...lst<Obj>(blocks.segments).map((x) => str(x.id)),
    ...lst<Obj>(blocks.waysOut).map((x) => str(x.id)),
    ...lst<Obj>(blocks.twists).map((x) => str(x.id)),
    ...lst<Obj>(blocks.customMoments).map((x) => str(x.id)),
    ...lst<Obj>(blocks.season?.phases).map((x) => str(x.id)),
  ]);
  const base = camelId(name || "item") || "item";
  let id = base;
  for (let i = 2; used.has(id); i++) id = `${base}${i}`;
  return id;
}

export function RulebookPage({ id }: { id: string }) {
  const q = useDesk<DeskRulebook>(`/rulebooks/${id}`);
  const after = useAfterDesk();
  const nav = useNav();
  const [draft, setDraft] = useState<RulebookBlocks | null>(null);
  const [seenVersion, setSeenVersion] = useState<number | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [saving, setSaving] = useState(false);
  const [reading, setReading] = useState(false);
  const [checking, setChecking] = useState(false);
  const page = q.data;
  // A new version from the server (a save, an undo) starts the draft again.
  if (page && seenVersion !== page.version) {
    setSeenVersion(page.version);
    setDraft(clone(page.now));
  }
  const ops = useMemo(() => (page && draft ? diffBlocks(page.now, draft) : []), [page, draft]);
  const lines = useMemo(() => (page && draft ? opLines(ops, page.now, draft) : []), [ops, page, draft]);
  const problems = useMemo(() => (draft ? blocksProblems(draft) : []), [draft]);
  const backTo = page?.season
    ? { label: page.season.name, href: paths.deskItem("season", page.season.id) }
    : page?.ownerKind === "library"
      ? { label: "Library", href: paths.desk("library") }
      : { label: "Find", href: paths.desk("find") };
  if (q.error) return <><DeskHeader title="Rulebook" back={backTo} /><p className="px-4 pt-6 text-sm text-muted-foreground">{(q.error as Error).message}</p></>;
  if (!page || !draft) return <><DeskHeader title="Rulebook" back={backTo} /><div aria-busy className="mx-4 mt-6 h-64 animate-pulse rounded-[4px] bg-card" /></>;

  const post = async (body: Obj, done: string) => {
    try {
      const out = await deskSend<Obj>(`/rulebooks/${id}`, body);
      await after();
      toast(done);
      return out;
    } catch (e) {
      toast.quiet((e as Error).message);
      throw e;
    }
  };
  const parts = [
    { block: "kind" as const, label: "Kind", summary: `${labelOf("kind", draft.kind)}${draft.kind === "series" && draft.start ? ` · ${labelOf("start", draft.start)}` : ""}` },
    ...blockSummariesOf(draft).map((p) => ({ block: p.block as Block, label: p.label, summary: p.summary })),
  ];
  const live = !!page.season && (page.season.live || page.season.everywhere);

  return (
    <div className={`pb-16 ${ops.length ? "pb-44" : ""}`} data-desk-rulebook={page.version}>
      <DeskHeader title="Rulebook" back={backTo} />
      <Section>
        <div className="flex items-center gap-3">
          {page.season?.art ? (
            // eslint-disable-next-line @next/next/no-img-element -- a show's art from wherever it was imported
            <img src={page.season.art} alt="" className="size-[72px] flex-none rounded-[3px] object-cover" />
          ) : (
            <span className="grid size-[72px] flex-none place-items-center rounded-[3px] bg-card">
              <BookOpen className="size-7 text-muted-foreground" aria-hidden />
            </span>
          )}
          <span className="min-w-0">
            <b className="type-caption block text-[26px] leading-none">{page.season?.name ?? page.name}</b>
            <small className="block text-[14px] text-muted-foreground">
              {page.kindLabel} · version {page.version}
              {page.edited ? " · edited" : ""}
            </small>
          </span>
        </div>
        <p className="mt-2.5 text-[14px] leading-snug text-muted-foreground">{page.reach.line}</p>
        {page.lineage.length > 0 && (
          <p data-lineage className="mt-1 text-[13px] leading-snug text-muted-foreground">
            From {page.lineage.join(" › ")}
          </p>
        )}
        {page.made?.review === "reviewed" && <p className="mt-1 text-[13px] leading-snug text-muted-foreground">{page.made.line}</p>}
      </Section>

      {page.made && page.made.review !== "reviewed" && (
        <Section>
          <div data-made={page.made.review} className="rounded-[4px] bg-card p-3.5">
            <Tag tone={page.made.review === "checked" ? "good" : "must"}>{page.made.review === "checked" ? "Checked" : "New"}</Tag>
            <b className="mt-2 block text-[16px]">A player made it</b>
            <small className="block text-[13px] leading-snug text-muted-foreground">
              {page.made.line}
              {page.made.couches.length ? ` (${page.made.couches.join(", ")})` : ""}. Every couch on the season plays by it. Take it over and it&apos;s the desk&apos;s: How it works stops calling it new. Whoever made it stays its first maker.
            </small>
            <Btn data-take-over tone="must" wide className="mt-2.5 h-11 text-[15px]" onClick={() => post({ action: "takeOver" }, "Taken over: it's the desk's now")}>
              Take it over
            </Btn>
          </div>
        </Section>
      )}

      {page.library && (
        <Section title="In the library">
          <div data-library-controls>
            <button
              type="button"
              role="switch"
              aria-checked={page.library.template}
              data-template-switch={page.library.template ? "on" : "off"}
              onClick={() => post({ action: page.library!.template ? "untemplate" : "template" }, page.library!.template ? "No longer a starting point" : "Offered as a starting point")}
              className="nd-press flex min-h-[64px] w-full items-center gap-3 rounded-[4px] bg-card p-3.5 text-left"
            >
              <span className="min-w-0 flex-1">
                <b className="block text-[16px]">A starting point for new shows</b>
                <small className="block text-[13px] leading-snug text-muted-foreground">
                  {page.library.template
                    ? `Make it a game starts from it for ${page.library.shows.length ? `shows like ${page.library.shows.slice(0, 3).join(", ")}` : `a show called ${page.name}`}${page.kind === "series" || page.kind === "talk" ? `, and for any new ${page.kindLabel.replace(/^An? /, "").toLowerCase()} while it's the newest` : ""}. New show lists it.`
                    : "A draft: not offered to new shows yet."}
                </small>
              </span>
              <span className={`relative h-[30px] w-[52px] flex-none rounded-full ${page.library.template ? "bg-foreground" : "bg-secondary"}`}>
                <i className={`absolute top-[3px] size-6 rounded-full ${page.library.template ? "left-[25px] bg-background" : "left-[3px] bg-muted-foreground"}`} />
              </span>
            </button>
            <p className="mt-2 text-[13px] leading-snug text-muted-foreground">
              {page.library.shape ? `The ${page.library.shape} shape. ` : ""}
              {page.library.seasons ? `${page.library.seasons} ${page.library.seasons === 1 ? "rulebook was" : "rulebooks were"} made from it.` : "Nothing's been made from it yet."}
            </p>
            {page.library.deletable && (
              <button
                type="button"
                data-library-delete
                onClick={async () => {
                  await post({ action: "delete" }, `Deleted ${page.name} from the library`);
                  nav.push(paths.desk("library"));
                }}
                className="mt-2 flex min-h-11 items-center text-[15px] font-semibold text-destructive"
              >
                Delete it from the library
              </button>
            )}
          </div>
        </Section>
      )}

      <Section title="Fits these games" aside={`${page.fits.filter((g) => g.fits).length} of ${page.fits.length}`}>
        <ul data-fits>
          {page.fits.map((g) => (
            <li key={g.key} data-fit={g.key} data-fits-it={g.fits ? (g.soon ? "soon" : "yes") : "no"} className="flex items-start gap-3 border-t border-border py-2.5 first:border-t-0">
              <span className={`mt-0.5 grid size-6 flex-none place-items-center rounded-full ${g.fits ? (g.soon ? "bg-secondary" : "bg-good/20 text-good") : "bg-secondary text-muted-foreground"}`}>
                {g.fits ? g.soon ? <Clock className="size-3.5" aria-hidden /> : <Check className="size-3.5" strokeWidth={3} aria-hidden /> : <X className="size-3.5" strokeWidth={3} aria-hidden />}
              </span>
              <span className="min-w-0 flex-1">
                <b className={`block text-[15px] ${g.fits ? "" : "text-muted-foreground"}`}>{g.name}</b>
                <small className="block text-[13px] leading-snug text-muted-foreground">
                  {g.fits ? (g.soon ? `Fits · comes with episode games (step ${g.soon})` : "Fits: Start a game offers it") : `Doesn't fit: needs ${g.needs}`}
                </small>
              </span>
            </li>
          ))}
        </ul>
        {page.shapes.length > 0 && page.ownerKind === "season" && <p data-shapes className="mt-2 text-[13px] leading-snug text-muted-foreground">Plays like the library&apos;s {page.shapes.join(", ")} shape.</p>}
      </Section>

      {page.season && (
        <Section>
          <button
            type="button"
            role="switch"
            aria-checked={live}
            data-live={live ? "on" : "off"}
            disabled={page.season.everywhere}
            onClick={() => post({ action: "live", live: !page.season!.live }, page.season!.live ? "Its leagues went back to the show's rules" : "Its leagues play by this rulebook now")}
            className="nd-press flex min-h-[64px] w-full items-center gap-3 rounded-[4px] bg-card p-3.5 text-left disabled:opacity-80"
          >
            <span className="min-w-0 flex-1">
              <b className="block text-[16px]">Leagues play by it</b>
              <small className="block text-[13px] leading-snug text-muted-foreground">
                {page.season.everywhere
                  ? "Rulebooks are on for every season."
                  : live
                    ? "Its leagues score by this rulebook: every save reaches them."
                    : "Its leagues play by the show's rules for now. Switch them on, and they get this rulebook (an unedited one scores exactly the same)."}
              </small>
            </span>
            <span className={`relative h-[30px] w-[52px] flex-none rounded-full ${live ? "bg-foreground" : "bg-secondary"}`}>
              <i className={`absolute top-[3px] size-6 rounded-full ${live ? "left-[25px] bg-background" : "left-[3px] bg-muted-foreground"}`} />
            </span>
          </button>
        </Section>
      )}

      {page.phases
        .filter((p) => p.needs)
        .map((p) => (
          <Section key={p.id}>
            <div data-confirm-phase={p.id} className="rounded-[4px] bg-card p-3.5">
              <Tag tone="must">Confirm</Tag>
              <b className="mt-2 block text-[16px]">When did {p.name} start?</b>
              <small className="block text-[13px] text-muted-foreground">Its segments wait until it&apos;s set. Never guessed: research flags it, you confirm it.</small>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {Array.from({ length: Math.max(1, page.season?.aired ?? 1) }, (_, i) => i + 1).map((n) => (
                  <Chip key={n} data-phase-episode={n} className="h-11" onClick={() => post({ action: "phase", phaseId: p.id, episode: n }, `${p.name} started in Episode ${n}`)}>
                    Episode {n}
                  </Chip>
                ))}
              </div>
            </div>
          </Section>
        ))}

      <Section title="The rulebook" aside={<button type="button" data-read-it onClick={() => setReading(true)} className="font-semibold text-foreground">Read it</button>}>
        {parts.map((p) => {
          const changed = lines.some((l) => partOfLine(l, p.block));
          return (
            <button key={p.block} type="button" data-part={p.block} onClick={() => setEditing({ block: p.block })} className="nd-press flex min-h-[64px] w-full items-center gap-3 border-t border-border py-2 text-left first:border-t-0">
              <span className="min-w-0 flex-1">
                <small className="block text-[12.5px] text-muted-foreground">{p.label}</small>
                <b className="block text-[15px] font-semibold leading-snug">{p.summary}</b>
              </span>
              {changed && <i className="size-2.5 flex-none rounded-full bg-chyron-line" aria-label="Changed" />}
              <span className="text-[14px] font-bold text-chyron-line">Edit</span>
            </button>
          );
        })}
        <Btn data-check-changes wide className="mt-3" onClick={() => setChecking(true)}>
          Check for changes
        </Btn>
      </Section>

      {page.notices.length > 0 && (
        <Section title="Something new?" aside={page.notices.length}>
          {page.notices.map((n) => (
            <div key={n.id} data-notice={n.id} className="border-t border-border py-2.5 first:border-t-0">
              <b className="block text-[15px]">&ldquo;{n.note}&rdquo;</b>
              <small className="block text-[13px] text-muted-foreground">
                Episode {n.episode} · {n.line ?? "The couches split"} · {n.yes} say it&apos;s new, {n.no} say it isn&apos;t
              </small>
              <p className="mt-1 text-[13px] leading-snug text-muted-foreground">Add it with an edit above (The show changed from Episode {n.episode}), or Check for changes; then mark it.</p>
              <div className="mt-2 flex gap-2">
                <Btn data-notice-added className="h-10 flex-1 text-[14px]" onClick={() => post({ action: "notice", notice: n.id, status: "added" }, "Marked added")}>
                  It&apos;s in now
                </Btn>
                <Btn data-notice-not-new className="h-10 flex-1 text-[14px]" onClick={() => post({ action: "notice", notice: n.id, status: "not_new" }, "Put away: not new")}>
                  Not new
                </Btn>
              </div>
            </div>
          ))}
        </Section>
      )}
      {page.suggestions.length > 0 && (
        <Section title="Suggested fixes" aside={page.suggestions.length}>
          {page.suggestions.map((s) => (
            <div key={s.id} data-suggestion={s.id} className="border-t border-border py-2.5 first:border-t-0">
              <b className="block text-[15px]">&ldquo;{s.note}&rdquo;</b>
              <small className="block text-[13px] text-muted-foreground">
                {s.who} · {s.about} · {airTime(Date.parse(s.at))}
              </small>
              <div className="mt-2 flex gap-2">
                <Btn data-suggestion-done className="h-10 flex-1 text-[14px]" onClick={() => post({ action: "suggestion", suggestion: s.id, status: "done" }, "Marked fixed")}>
                  Fixed it
                </Btn>
                <Btn className="h-10 flex-1 text-[14px]" onClick={() => post({ action: "suggestion", suggestion: s.id, status: "dismissed" }, "Dismissed")}>
                  Dismiss
                </Btn>
              </div>
            </div>
          ))}
        </Section>
      )}

      <Section>
        <LockRow
          locked={!!page.locked}
          on="Locked: couches suggest fixes and say what's new, but only you change it"
          off="When couches agree an episode brought something new, it's added from that episode. Fixes are yours."
          onChange={(lock) => post({ action: "lock", lock }, lock ? "Locked" : "Unlocked")}
        />
      </Section>

      <Section title="Timeline" aside="Not spoiler-safe">
        <div data-timeline>
          <div className="border-t border-border py-2.5 first:border-t-0">
            <b className="block text-[15px]">In force from the premiere</b>
            <small className="text-[13px] text-muted-foreground">{page.edits.some((e) => e.kind === "fix") ? "With every fix folded in" : "As it was made"}</small>
          </div>
          {page.edits
            .filter((e) => e.status === "in_force")
            .map((e) => (
              <div key={e.id} data-edit={e.fromEpisode} className="border-t border-border py-2.5">
                <b className="block text-[15px]">Episode {e.fromEpisode} · The show changed</b>
                {e.lines.map((l) => (
                  <small key={l} className="block text-[13px] text-muted-foreground">
                    {l}
                  </small>
                ))}
              </div>
            ))}
        </div>
      </Section>
      <Section title="History">
        <History lines={page.history} />
      </Section>
      {page.ownerKind === "season" && (
        <Section>
          <Btn
            data-template
            wide
            onClick={async () => {
              const out = (await post({ action: "template" }, "Saved as a starting point: new shows like it can start from it")) as { id?: string };
              if (out?.id) nav.push(paths.deskItem("rulebook", out.id));
            }}
          >
            Save as a starting point for new shows
          </Btn>
        </Section>
      )}

      {ops.length > 0 && (
        <div data-unsaved={ops.length} className="nd-fixed-x fixed bottom-0 z-30 border-t border-border bg-background/96 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+12px)] pt-3 backdrop-blur-md">
          <b className="block text-[15px]">
            {ops.length} unsaved {ops.length === 1 ? "change" : "changes"}
          </b>
          <small className="block truncate text-[13px] text-muted-foreground">{lines.slice(0, 2).join(" · ")}</small>
          {problems.length > 0 && <small data-problems className="mt-0.5 block text-[13px] text-destructive">{problems[0].message}</small>}
          <div className="mt-2 flex gap-2">
            <Btn data-discard className="h-12 w-[34%]" onClick={() => setDraft(clone(page.now))}>
              Discard
            </Btn>
            <Btn data-save tone="must" className="h-12 flex-1" disabled={problems.length > 0} onClick={() => setSaving(true)}>
              Save
            </Btn>
          </div>
        </div>
      )}

      {editing && <PartEditor key={JSON.stringify(editing)} draft={draft} setDraft={setDraft} editing={editing} setEditing={setEditing} page={page} />}
      {saving && (
        <SaveSheet
          page={page}
          lines={lines}
          onClose={() => setSaving(false)}
          onSave={async (kind, fromEpisode, summary) => {
            const out = (await post({ action: "save", blocks: draft, kind, fromEpisode, summary }, kind === "fix" ? "Fixed: every couch rescored from the start" : `Saved: the show changed from Episode ${fromEpisode}`)) as {
              push: { written: number; stayed: string[] };
            };
            setSaving(false);
            if (out.push.stayed.length) toast(`${out.push.stayed.length} ${out.push.stayed.length === 1 ? "league stayed" : "leagues stayed"} on the show's rules`);
          }}
        />
      )}
      {reading && (
        <Sheet open onOpenChange={setReading} title="How it works" subtitle={`${page.season?.name ?? page.name}, as everyone reads it now`}>
          <div className="-mx-2">
            <HowItWorksBody page={{ how: page.how, cast: [] }} seasonId={page.season?.id ?? page.id} name={page.season?.name ?? page.name} seasonNumber={null} artUrl={page.season?.art ?? null} />
          </div>
        </Sheet>
      )}
      {checking && <CheckSheet id={id} onClose={() => setChecking(false)} onUse={(blocks) => { setDraft(blocks); setChecking(false); toast("Its changes are in your draft: look them over, then save"); }} />}
    </div>
  );
}

/** blockSummaries from rulebook-describe, kept here as plain words for the editor's list. */
function blockSummariesOf(b: RulebookBlocks) {
  const out: { block: string; label: string; summary: string }[] = [];
  const add = (block: Block, summary: string) => {
    const label = blockLabel(b, block === "kind" ? "cast" : block);
    if (label) out.push({ block, label, summary });
  };
  add("cast", `${b.cast?.usualSize ? `${b.cast.usualSize} ` : ""}${b.cast?.plural ?? "people"}${b.cast?.groups ? `, in ${b.cast.groups.singular}s` : ""}`);
  add("season", [...lst<Obj>(b.season?.phases).map((p) => str(p.name)), ...(b.season?.finale ? ["Finale"] : [])].join(" › ") || "One phase");
  add("segments", lst<Obj>(b.segments).map((s) => str(s.name)).join(", ") || "None");
  add("waysOut", lst<Obj>(b.waysOut).map((w) => str(w.name)).join(", ") || "None");
  add("twists", lst<Obj>(b.twists).map((t) => str(t.name)).join(", ") || "None");
  add("points", `${momentsFor(b).length} moments, suggested points`);
  return out;
}

/** Which part a change line is about, for the dot on its row. */
function partOfLine(line: string, block: Block) {
  if (block === "kind") return line.startsWith("~ The kind of show") || line.startsWith("~ Where the series starts");
  if (block === "cast") return line.startsWith("~ Who's playing");
  if (block === "season") return /phase|finale/i.test(line);
  if (block === "points") return /Suggested points|moment/i.test(line);
  if (block === "segments") return /segment/i.test(line) || (line.startsWith("~ ") && !/phase|finale|points|playing|kind/i.test(line));
  if (block === "waysOut") return /way out/i.test(line);
  return /advantage|role|comeback|side trip|twist/i.test(line);
}

// ---------- the part editors ----------

function PartEditor({
  draft,
  setDraft,
  editing,
  setEditing,
  page,
}: {
  draft: RulebookBlocks;
  setDraft: (b: RulebookBlocks) => void;
  editing: Editing;
  setEditing: (e: Editing | null) => void;
  page: DeskRulebook;
}) {
  const close = () => setEditing(null);
  // A refinement the edit no longer fits (a group's win on a part nobody plays as a group) goes with it: the sheets don't
  // show them, and saving says what changed.
  const put = (b: RulebookBlocks) => {
    const next = clone(b);
    dropMisfitRefinements(next);
    setDraft(next);
  };
  const word = (block: string) => (blockLabel(draft, block as never) ?? block).toString();
  switch (editing.block) {
    case "kind":
      return <KindSheet draft={draft} onDone={(b) => { put(b); close(); }} onClose={close} />;
    case "cast":
      return <CastSheet draft={draft} title={word("cast")} onDone={(b) => { put(b); close(); }} onClose={close} />;
    case "season":
      return (
        <ListSheet
          title={word("season")}
          lede="A phase is a stretch of the season that plays differently, like the merge."
          items={lst<Obj>(draft.season?.phases).map((p) => ({ id: str(p.id), title: str(p.name), line: phaseLine(p, page) }))}
          extra={{ id: "finale", title: "Finale", line: draft.season?.finale ? labelOf("finale", draft.season.finale.decidedBy) : "None" }}
          addLabel="Add a phase"
          onOpen={(id) => setEditing(id === "finale" ? { block: "finale", id: null } : { block: "phase", id })}
          onAdd={() => setEditing({ block: "phase", id: null })}
          onClose={close}
        />
      );
    case "segments":
      return (
        <ListSheet
          title={word("segments")}
          lede="The regular parts of an episode. Each one's answers decide what scores, so there's nothing to write by hand."
          items={lst<Obj>(draft.segments).map((s) => ({ id: str(s.id), title: str(s.name), line: `${labelOf("decidedBy", s.decidedBy)} · ${labelOf("often", s.often)}${s.onTheLine ? ` · ${labelOf("onTheLine", s.onTheLine).toLowerCase()}` : ""}` }))}
          addLabel="Add a segment"
          onOpen={(id) => setEditing({ block: "segment", id })}
          onAdd={() => setEditing({ block: "segment", id: null })}
          onClose={close}
        />
      );
    case "waysOut":
      return (
        <ListSheet
          title={word("waysOut")}
          lede="Each one scores on its own when someone leaves or finishes that way."
          items={lst<Obj>(draft.waysOut).map((w) => ({ id: str(w.id), title: str(w.name), line: `${labelOf("means", w.means)}${w.cause ? ` · ${causeLabel(draft, w.cause)}` : ""}` }))}
          addLabel="Add a way out"
          onOpen={(id) => setEditing({ block: "wayOut", id })}
          onAdd={() => setEditing({ block: "wayOut", id: null })}
          onClose={close}
        />
      );
    case "twists":
      return (
        <ListSheet
          title={word("twists")}
          lede="Anything that bends the usual episode. Each twist makes its own moments."
          items={lst<Obj>(draft.twists).map((t) => ({ id: str(t.id), title: str(t.name), line: labelOf("twistType", t.type) }))}
          addLabel="Add a twist"
          onOpen={(id) => setEditing({ block: "twist", id })}
          onAdd={() => setEditing({ block: "twist", id: null })}
          onClose={close}
        />
      );
    case "points":
      return <PointsSheet draft={draft} title={word("points")} onDone={(b) => { put(b); close(); }} onCustom={(cid) => setEditing({ block: "custom", id: cid })} onClose={close} />;
    case "segment":
      return <SegmentSheet draft={draft} id={editing.id} onDone={(b) => { put(b); setEditing({ block: "segments" }); }} onClose={() => setEditing({ block: "segments" })} />;
    case "wayOut":
      return <WaySheet draft={draft} id={editing.id} onDone={(b) => { put(b); setEditing({ block: "waysOut" }); }} onClose={() => setEditing({ block: "waysOut" })} />;
    case "twist":
      return <TwistSheet draft={draft} id={editing.id} onDone={(b) => { put(b); setEditing({ block: "twists" }); }} onClose={() => setEditing({ block: "twists" })} />;
    case "phase":
      return <PhaseSheet draft={draft} id={editing.id} onDone={(b) => { put(b); setEditing({ block: "season" }); }} onClose={() => setEditing({ block: "season" })} />;
    case "finale":
      return <FinaleSheet draft={draft} onDone={(b) => { put(b); setEditing({ block: "season" }); }} onClose={() => setEditing({ block: "season" })} />;
    case "custom":
      return <CustomSheet draft={draft} id={editing.id} onDone={(b) => { put(b); setEditing({ block: "points" }); }} onClose={() => setEditing({ block: "points" })} />;
  }
}

const phaseLine = (p: Obj, page: DeskRulebook) => {
  const s = (p.starts ?? {}) as Obj;
  const confirmed = page.phases.find((x) => x.id === p.id)?.confirmed;
  const start = s.type === "episode" ? `From episode ${s.n}` : s.type === "remaining" ? `When ${s.n} are left` : "When the show says so";
  return `${start}${confirmed ? ` · started in Episode ${confirmed}` : ""}`;
};
const causeLabel = (b: RulebookBlocks, cause: unknown) => (cause && typeof cause === "object" ? lst<Obj>(b.segments).find((s) => s.id === (cause as Obj).segment)?.name ?? "a segment" : labelOf("cause", cause));

function Footer({ onClose, onDone, done = "Done", onRemove, disabled }: { onClose: () => void; onDone: () => void; done?: string; onRemove?: () => void; disabled?: boolean }) {
  return (
    <>
      {onRemove && (
        <button type="button" data-remove onClick={onRemove} className="mt-5 flex min-h-11 items-center text-[15px] font-semibold text-destructive">
          ✕ Remove
        </button>
      )}
      <div className="mt-4 flex gap-2">
        <Btn className="w-[34%]" onClick={onClose}>
          Cancel
        </Btn>
        <Btn data-done tone="must" className="flex-1" disabled={disabled} onClick={onDone}>
          {done}
        </Btn>
      </div>
    </>
  );
}

function ListSheet({
  title,
  lede,
  items,
  extra,
  addLabel,
  onOpen,
  onAdd,
  onClose,
}: {
  title: string;
  lede: string;
  items: { id: string; title: string; line: string }[];
  extra?: { id: string; title: string; line: string };
  addLabel: string;
  onOpen: (id: string) => void;
  onAdd: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} title={title} subtitle={lede}>
      <div data-list-sheet={title}>
        {[...items, ...(extra ? [extra] : [])].map((i) => (
          <button key={i.id} type="button" data-item={i.id} onClick={() => onOpen(i.id)} className="nd-press flex min-h-[60px] w-full items-center gap-3 border-t border-border py-2 text-left first:border-t-0">
            <span className="min-w-0 flex-1">
              <b className="block text-[15px]">{i.title}</b>
              <small className="block text-[13px] text-muted-foreground">{i.line}</small>
            </span>
            <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
          </button>
        ))}
        <Btn data-add wide className="mt-3" onClick={onAdd}>
          <Plus className="size-4" aria-hidden />
          {addLabel}
        </Btn>
        <Btn wide className="mt-2" onClick={onClose}>
          Done
        </Btn>
      </div>
    </Sheet>
  );
}

function KindSheet({ draft, onDone, onClose }: { draft: RulebookBlocks; onDone: (b: RulebookBlocks) => void; onClose: () => void }) {
  const [kind, setKind] = useState(str(draft.kind));
  const [start, setStart] = useState(str(draft.start) || "reality");
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} title="What kind of show?" subtitle="It renames the rulebook's parts, hides the ones that don't apply, and decides which games fit">
      <Choice data="kind" label={QUESTIONS.kind.kind} value={kind} options={opts("kind")} onChange={setKind} />
      {kind === "series" && <Choice data="start" label={QUESTIONS.kind.start} value={start} options={opts("start")} onChange={setStart} />}
      <Footer
        onClose={onClose}
        onDone={() => {
          const b = clone(draft) as RulebookBlocks & Obj;
          b.kind = kind as RulebookBlocks["kind"];
          if (kind === "series") b.start = start as RulebookBlocks["start"];
          else delete b.start;
          onDone(b);
        }}
      />
    </Sheet>
  );
}

function CastSheet({ draft, title, onDone, onClose }: { draft: RulebookBlocks; title: string; onDone: (b: RulebookBlocks) => void; onClose: () => void }) {
  const c = (draft.cast ?? {}) as Obj;
  const g = (c.groups ?? null) as Obj | null;
  const [unit, setUnit] = useState(str(c.unit) || "people");
  const [singular, setSingular] = useState(str(c.singular));
  const [plural, setPlural] = useState(str(c.plural));
  const [size, setSize] = useState(Number(c.usualSize) || 0);
  const [groupType, setGroupType] = useState(g ? str(g.type) : "none");
  const [groupName, setGroupName] = useState(g ? str(g.singular) : "");
  const [groupChange, setGroupChange] = useState(g ? str(g.change) : "never");
  const q = QUESTIONS.cast;
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} title={title} subtitle="Used everywhere in the app, and to find the cast on a wiki">
      <Choice data="unit" label={q.unit} value={unit} options={opts("unit")} onChange={setUnit} />
      <div className="grid grid-cols-2 gap-2">
        <Text data="singular" label={q.singular} value={singular} onChange={setSingular} placeholder="castaway" />
        <Text data="plural" label={q.plural} value={plural} onChange={setPlural} placeholder="castaways" />
      </div>
      <Stepper data="usualSize" label={q.usualSize} value={size} onChange={setSize} max={200} />
      <Choice data="groups" label={q.groups} value={groupType} options={opts("groupType")} onChange={setGroupType} />
      {groupType !== "none" && (
        <>
          <Text data="groupSingular" label={q.groupSingular} value={groupName} onChange={setGroupName} placeholder="tribe" />
          <Choice data="groupChange" label={q.groupChange} value={groupChange} options={opts("groupChange")} onChange={setGroupChange} />
        </>
      )}
      <Footer
        onClose={onClose}
        disabled={!singular.trim() || !plural.trim() || (groupType !== "none" && !groupName.trim())}
        onDone={() => {
          const b = clone(draft);
          b.cast = {
            ...(b.cast ?? {}),
            unit: unit as never,
            singular: singular.trim(),
            plural: plural.trim(),
            ...(size ? { usualSize: size } : {}),
            groups: groupType === "none" ? null : ({ type: groupType, singular: groupName.trim(), change: groupChange } as never),
          } as never;
          if (!size) delete (b.cast as Obj).usualSize;
          onDone(b);
        }}
      />
    </Sheet>
  );
}

/** One list item's sheet: a local copy, Done writes it back (or adds it), Remove takes it out. */
function useItem(draft: RulebookBlocks, list: "segments" | "waysOut" | "twists" | "customMoments" | "phases", id: string | null, blank: () => Obj) {
  const items = list === "phases" ? lst<Obj>(draft.season?.phases) : lst<Obj>((draft as unknown as Obj)[list]);
  const [item, setItem] = useState<Obj>(() => clone(items.find((x) => x.id === id) ?? blank()));
  const set = (k: string, v: unknown) => setItem((x) => {
    const n = { ...x };
    if (v === undefined) delete n[k];
    else n[k] = v;
    return n;
  });
  const write = (fn: (list: Obj[]) => Obj[]) => {
    const b = clone(draft) as unknown as Obj;
    if (list === "phases") b.season = { ...((b.season as Obj) ?? {}), phases: fn(lst<Obj>((b.season as Obj)?.phases)) };
    else b[list] = fn(lst<Obj>(b[list]));
    return b as unknown as RulebookBlocks;
  };
  const save = () => {
    const name = str(item.name ?? item.label);
    const out = { ...item, id: id ?? newId(draft, name) };
    return write((l) => (id ? l.map((x) => (x.id === id ? out : x)) : [...l, out]));
  };
  const remove = () => write((l) => l.filter((x) => x.id !== id));
  return { item, set, save, remove, isNew: !id };
}

function SegmentSheet({ draft, id, onDone, onClose }: { draft: RulebookBlocks; id: string | null; onDone: (b: RulebookBlocks) => void; onClose: () => void }) {
  const { item, set, save, remove, isNew } = useItem(draft, "segments", id, () => ({ name: "", decidedBy: "result", takesPart: "everyone", decides: "winner", onTheLine: "nothing", often: "everyEpisode" }));
  const q = QUESTIONS.segment;
  const d = str(item.decidedBy);
  // Answers that only go with who decides it (blocksProblems refuses the rest).
  const pick = (decidedBy: string) => {
    set("decidedBy", decidedBy);
    set("voters", decidedBy === "vote" ? str(item.voters) || "cast" : undefined);
    set("pickers", decidedBy === "pick" ? str(item.pickers) || "onePerson" : undefined);
    set("decides", ["result", "judges", "headToHead"].includes(decidedBy) ? str(item.decides) || "winner" : undefined);
    set("takesPart", decidedBy !== "nobody" ? str(item.takesPart) || "everyone" : undefined);
  };
  const built = id ? momentsFor(draft, { includeOff: true }).filter((m) => m.from.segment === id && !m.custom) : [];
  const off = lst<string>(item.momentsOff);
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} title={isNew ? "Add a segment" : str(item.name) || "Segment"} subtitle="The show's own name for it">
      <div data-segment-sheet={id ?? "new"}>
        <Text data="name" label={q.name} value={str(item.name)} onChange={(v) => set("name", v)} placeholder="Tribal Council, The weigh-in" />
        <Text data="summary" label={q.summary} value={str(item.summary)} onChange={(v) => set("summary", v || undefined)} multiline />
        <Choice data="decidedBy" label={q.decidedBy} value={d} options={opts("decidedBy")} onChange={pick} />
        {d === "vote" && <Choice data="voters" label={q.voters} value={str(item.voters)} options={opts("voters")} onChange={(v) => set("voters", v)} />}
        {d === "pick" && <Choice data="pickers" label={q.pickers} value={str(item.pickers)} options={opts("pickers")} onChange={(v) => set("pickers", v)} />}
        {d !== "nobody" && <Choice data="takesPart" label={q.takesPart} value={str(item.takesPart)} options={opts("takesPart")} onChange={(v) => set("takesPart", v)} />}
        {["result", "judges", "headToHead"].includes(d) && <Choice data="decides" label={q.decides} value={str(item.decides)} options={opts("decides")} onChange={(v) => set("decides", v)} />}
        {d !== "nobody" && <Choice data="onTheLine" label={q.onTheLine} value={str(item.onTheLine)} options={opts("onTheLine")} onChange={(v) => set("onTheLine", v)} />}
        <Choice data="often" label={q.often} value={str(item.often)} options={opts("often")} onChange={(v) => { set("often", v); set("phase", v === "onePhase" ? str(item.phase) || "finale" : undefined); }} />
        {item.often === "onePhase" && <Choice data="phase" label={q.phase} value={str(item.phase)} options={opts("phase", draft)} onChange={(v) => set("phase", v)} />}
        {built.length > 0 && (
          <div className="mt-4">
            <b className="block text-[15px]">{q.moments}</b>
            <small className="block text-[13px] text-muted-foreground">Built from the answers above. Switch off anything this show doesn&apos;t do.</small>
            {built.map((m) => {
              const isOff = off.includes(m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  role="switch"
                  aria-checked={!isOff}
                  data-moment={m.id}
                  onClick={() => {
                    const next = isOff ? off.filter((x) => x !== m.id) : [...off, m.id];
                    set("momentsOff", next.length ? next : undefined);
                  }}
                  className="flex min-h-12 w-full items-center gap-3 border-t border-border text-left first:border-t-0"
                >
                  <span className={`min-w-0 flex-1 text-[15px] ${isOff ? "text-muted-foreground line-through" : ""}`}>{m.label}</span>
                  <span className={`text-[13px] font-bold ${isOff ? "text-muted-foreground" : "text-good"}`}>{isOff ? "Off" : "On"}</span>
                </button>
              );
            })}
          </div>
        )}
        <Footer onClose={onClose} disabled={!str(item.name).trim()} onDone={() => onDone(save())} onRemove={isNew ? undefined : () => onDone(remove())} />
      </div>
    </Sheet>
  );
}

function WaySheet({ draft, id, onDone, onClose }: { draft: RulebookBlocks; id: string | null; onDone: (b: RulebookBlocks) => void; onClose: () => void }) {
  const { item, set, save, remove, isNew } = useItem(draft, "waysOut", id, () => ({ name: "", means: "out" }));
  const q = QUESTIONS.wayOut;
  const causeValue = item.cause && typeof item.cause === "object" ? str((item.cause as Obj).segment) : str(item.cause);
  const pointsKey = id ?? "";
  const current = id && typeof draft.points?.[pointsKey] === "number" ? (draft.points[pointsKey] as number) : WAY_POINTS[str(item.means)] ?? 0;
  const [points, setPoints] = useState(current);
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} title={isNew ? "Add a way out" : str(item.name) || "Way out"} subtitle="Scores on its own when someone leaves or finishes that way">
      <div data-way-sheet={id ?? "new"}>
        <Text data="name" label={q.name} value={str(item.name)} onChange={(v) => set("name", v)} placeholder="Voted out, Fired, Tapped out" />
        <Choice data="means" label={q.means} value={str(item.means)} options={opts("means")} onChange={(v) => set("means", v)} />
        <Choice
          data="cause"
          label={q.cause}
          value={causeValue}
          options={opts("cause", draft)}
          onChange={(v) => set("cause", lst<Obj>(draft.segments).some((s) => s.id === v) ? { segment: v } : v)}
        />
        {!isNew && <Stepper data="points" label={q.points} value={points} onChange={setPoints} min={-20} max={20} step={0.5} />}
        <Footer
          onClose={onClose}
          disabled={!str(item.name).trim()}
          onDone={() => {
            const b = save();
            if (!isNew && points !== current) b.points = { ...(b.points ?? {}), [pointsKey]: points };
            onDone(b);
          }}
          onRemove={isNew ? undefined : () => onDone(remove())}
        />
      </div>
    </Sheet>
  );
}

function TwistSheet({ draft, id, onDone, onClose }: { draft: RulebookBlocks; id: string | null; onDone: (b: RulebookBlocks) => void; onClose: () => void }) {
  const { item, set, save, remove, isNew } = useItem(draft, "twists", id, () => ({ name: "", type: "" }));
  const q = QUESTIONS.twist;
  const type = str(item.type);
  // A new twist's answers, once its kind is chosen: the first of each list, so it's usable straight away.
  const start = (t: string) => {
    set("type", t);
    const fields = TWIST_FIELDS[t as keyof typeof TWIST_FIELDS] as Record<string, string | string[]>;
    for (const [field, key] of Object.entries(fields)) {
      const k = Array.isArray(key) ? key[0] : key;
      set(field, Array.isArray(key) ? [opts(k)[0][0]] : opts(k)[0][0]);
    }
    if (t === "secretRole") set("roles", ["", ""]);
    if (t === "advantage" || t === "sideTrip") set("oneIsCalled", "");
  };
  const fields = (TWIST_FIELDS[type as keyof typeof TWIST_FIELDS] ?? {}) as Record<string, string | string[]>;
  const label = (k: string) => (q as Record<string, string>)[k] ?? k;
  const roles = lst<string>(item.roles);
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} title={isNew ? "Add a twist" : str(item.name) || "Twist"} subtitle={type ? labelOf("twistType", type) : "What kind of twist?"}>
      <div data-twist-sheet={id ?? "new"}>
        {!type ? (
          <Choice data="type" label={q.type} value="" options={opts("twistType")} onChange={start} />
        ) : (
          <>
            <Text data="name" label={q.name} value={str(item.name)} onChange={(v) => set("name", v)} placeholder="Block a Vote, Exile Island" />
            <Text data="summary" label={q.summary} value={str(item.summary)} onChange={(v) => set("summary", v || undefined)} multiline />
            {type === "secretRole" && (
              <Text data="roles" label={q.roles} value={roles.join(", ")} onChange={(v) => set("roles", v.split(",").map((x) => x.trim()))} placeholder="Traitor, Faithful" />
            )}
            {(type === "advantage" || type === "sideTrip") && <Text data="oneIsCalled" label={q.oneIsCalled} value={str(item.oneIsCalled)} onChange={(v) => set("oneIsCalled", v)} placeholder="an idol, a journey" />}
            {Object.entries(fields).map(([field, key]) =>
              Array.isArray(key) ? (
                <Multi key={field} data={field} label={label(key[0])} value={lst<string>(item[field])} options={opts(key[0])} onChange={(v) => set(field, v)} />
              ) : (
                <Choice key={field} data={field} label={label(key === "comebackWho" || key === "tripWho" ? key : key === "comebackHow" ? "comebackHow" : key)} value={str(item[field])} options={opts(key)} onChange={(v) => { set(field, v); if (field === "gotBy") set("wonAt", v === "wonAt" ? str(item.wonAt) || str(opts("wonAt", draft)[0]?.[0]) : undefined); }} />
              )
            )}
            {type === "advantage" && item.gotBy === "wonAt" && <Choice data="wonAt" label={q.wonAt} value={str(item.wonAt)} options={opts("wonAt", draft)} onChange={(v) => set("wonAt", v)} />}
            {type === "advantage" && <small className="mt-2 block text-[13px] text-muted-foreground">This only decides what&apos;s worth scoring. Nothing is simulated: research reports what actually happened.</small>}
          </>
        )}
        <Footer onClose={onClose} disabled={!type || !str(item.name).trim()} onDone={() => onDone(save())} onRemove={isNew ? undefined : () => onDone(remove())} />
      </div>
    </Sheet>
  );
}

function PhaseSheet({ draft, id, onDone, onClose }: { draft: RulebookBlocks; id: string | null; onDone: (b: RulebookBlocks) => void; onClose: () => void }) {
  const { item, set, save, remove, isNew } = useItem(draft, "phases", id, () => ({ name: "", starts: { type: "episode", n: 2 }, changes: [] }));
  const q = QUESTIONS.phase;
  const starts = (item.starts ?? { type: "episode" }) as Obj;
  const only = lst<Obj>(draft.season?.phases).length <= 1;
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} title={isNew ? "Add a phase" : str(item.name) || "Phase"} subtitle="A stretch of the season that plays differently">
      <div data-phase-sheet={id ?? "new"}>
        <Text data="name" label={q.name} value={str(item.name)} onChange={(v) => set("name", v)} placeholder="Merged, Casa Amor, Live shows" />
        <Choice
          data="starts"
          label={q.starts}
          value={str(starts.type)}
          options={opts("startType")}
          onChange={(v) => set("starts", v === "announced" ? { type: v } : { type: v, n: Number(starts.n) || (v === "remaining" ? 12 : 2) })}
        />
        {starts.type !== "announced" && (
          <Stepper data="n" label={starts.type === "episode" ? q.episode : q.remaining} value={Number(starts.n) || 1} min={1} max={60} onChange={(n) => set("starts", { ...starts, n })} />
        )}
        <Multi data="changes" label={q.changes} value={lst<string>(item.changes)} options={opts("changes")} onChange={(v) => set("changes", v)} />
        <Text data="summary" label={q.summary} value={str(item.summary)} onChange={(v) => set("summary", v || undefined)} multiline />
        <Footer onClose={onClose} disabled={!str(item.name).trim()} onDone={() => onDone(save())} onRemove={isNew || only ? undefined : () => onDone(remove())} />
      </div>
    </Sheet>
  );
}

function FinaleSheet({ draft, onDone, onClose }: { draft: RulebookBlocks; onDone: (b: RulebookBlocks) => void; onClose: () => void }) {
  const f = (draft.season?.finale ?? { decidedBy: "juryVote" }) as Obj;
  const [decidedBy, setDecidedBy] = useState(str(f.decidedBy) || "juryVote");
  const [finalists, setFinalists] = useState(Number(f.finalists) || 0);
  const [summary, setSummary] = useState(str(f.summary));
  const q = QUESTIONS.finale;
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} title="The finale" subtitle="How the season ends">
      <Choice data="finale" label={q.decidedBy} value={decidedBy} options={opts("finale")} onChange={setDecidedBy} />
      {!["nobody", "groupWins"].includes(decidedBy) && <Stepper data="finalists" label={q.finalists} value={finalists} min={0} max={20} onChange={setFinalists} />}
      <Text data="summary" label={q.summary} value={summary} onChange={setSummary} multiline />
      <Footer
        onClose={onClose}
        onDone={() => {
          const b = clone(draft);
          const finale: Obj = { ...f, decidedBy };
          if (finalists && !["nobody", "groupWins"].includes(decidedBy)) finale.finalists = finalists;
          else delete finale.finalists;
          if (summary.trim()) finale.summary = summary.trim();
          else delete finale.summary;
          b.season = { ...(b.season ?? { phases: [] }), finale: finale as never };
          onDone(b);
        }}
      />
    </Sheet>
  );
}

function PointsSheet({ draft, title, onDone, onCustom, onClose }: { draft: RulebookBlocks; title: string; onDone: (b: RulebookBlocks) => void; onCustom: (id: string | null) => void; onClose: () => void }) {
  const moments = momentsFor(draft);
  const [points, setPoints] = useState<Record<string, number | { exclusive: number; shared: number }>>(() => clone((draft.points ?? {}) as Record<string, number | { exclusive: number; shared: number }>));
  const valueOf = (id: string, d: unknown) => {
    const v = points[id] ?? d;
    return typeof v === "number" ? v : ((v as { shared?: number })?.shared ?? 0);
  };
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} title={title} subtitle="Most of these are built from the other parts. Each game sets its own points; these are the suggestions.">
      <div data-points-sheet>
        <Btn data-add-moment wide onClick={() => onCustom(null)}>
          <Plus className="size-4" aria-hidden />
          Add a moment
        </Btn>
        <div className="mt-2">
          {moments.map((m) => (
            <div key={m.id} data-points-row={m.id} className="border-t border-border py-1 first:border-t-0">
              {m.custom ? (
                <button type="button" onClick={() => onCustom(m.id)} className="flex min-h-11 w-full items-center gap-2 text-left">
                  <span className="min-w-0 flex-1 text-[15px]">{m.label}</span>
                  <span className="rounded-[2px] bg-secondary px-1.5 py-px text-[11px] font-bold text-muted-foreground">added</span>
                  <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                </button>
              ) : null}
              <Stepper
                data={`pts-${m.id}`}
                label={m.custom ? "Suggested points" : m.label}
                value={valueOf(m.id, m.defaultPoints)}
                min={-20}
                max={20}
                step={0.5}
                onChange={(v) => setPoints((p) => ({ ...p, [m.id]: typeof m.defaultPoints === "number" ? v : { exclusive: v, shared: v } }))}
              />
            </div>
          ))}
        </div>
        <Footer
          onClose={onClose}
          onDone={() => {
            const b = clone(draft);
            const kept = Object.fromEntries(Object.entries(points).filter(([k]) => moments.some((m) => m.id === k)));
            if (Object.keys(kept).length) b.points = kept;
            else delete b.points;
            onDone(b);
          }}
        />
      </div>
    </Sheet>
  );
}

function CustomSheet({ draft, id, onDone, onClose }: { draft: RulebookBlocks; id: string | null; onDone: (b: RulebookBlocks) => void; onClose: () => void }) {
  const { item, set, save, remove, isNew } = useItem(draft, "customMoments", id, () => ({ label: "", counted: "yesNo", answeredBy: "research" }));
  const q = QUESTIONS.moment;
  const during = item.during && typeof item.during === "object" ? str((item.during as Obj).segment ?? (item.during as Obj).twist) : "anywhere";
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} title={isNew ? "Add a moment" : str(item.label) || "Moment"} subtitle="Something anyone watching could see happen">
      <div data-custom-sheet={id ?? "new"}>
        <Text data="label" label={q.label} value={str(item.label)} onChange={(v) => set("label", v)} placeholder="Got in a fight, Cried at Tribal Council" />
        <Choice
          data="during"
          label={q.during}
          value={during}
          options={opts("during", draft)}
          onChange={(v) =>
            set("during", v === "anywhere" ? undefined : lst<Obj>(draft.segments).some((s) => s.id === v) ? { segment: v } : { twist: v })
          }
        />
        <Choice data="counted" label={q.counted} value={str(item.counted)} options={opts("counted")} onChange={(v) => set("counted", v)} />
        <Choice data="answeredBy" label={q.answeredBy} value={str(item.answeredBy)} options={opts("answeredBy")} onChange={(v) => { set("answeredBy", v); if (v === "league") set("reliability", undefined); }} />
        {item.answeredBy === "research" && <Choice data="reliability" label={q.reliability} value={str(item.reliability)} options={opts("reliability")} onChange={(v) => set("reliability", v)} />}
        <Footer onClose={onClose} disabled={!str(item.label).trim()} onDone={() => onDone(save())} onRemove={isNew ? undefined : () => onDone(remove())} />
      </div>
    </Sheet>
  );
}

// ---------- saving ----------

function SaveSheet({ page, lines, onClose, onSave }: { page: DeskRulebook; lines: string[]; onClose: () => void; onSave: (kind: "fix" | "show_changed", fromEpisode: number, summary: string) => Promise<void> }) {
  const earliest = Math.max(2, page.lastChange);
  const [kind, setKind] = useState<"fix" | "show_changed">("fix");
  const [from, setFrom] = useState(Math.max(earliest, (page.season?.aired ?? 0) + 1));
  const [summary, setSummary] = useState("");
  const [busy, setBusy] = useState(false);
  const live = !!page.season && (page.season.live || page.season.everywhere);
  const reach = `${page.reach.following} ${page.reach.following === 1 ? "league follows" : "leagues follow"} it`;
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} title="What kind of change?" subtitle={lines.slice(0, 3).join(" · ")}>
      <div data-save-sheet className="flex flex-col gap-2">
        {([
          ["fix", "Fix a mistake", "It was always like this. Every couch is rescored from the start; house rulings keep theirs."],
          ["show_changed", "The show changed", "From one episode on. Earlier episodes keep their scores."],
        ] as const).map(([k, t, d]) => (
          <button key={k} type="button" data-kind={k} aria-pressed={kind === k} onClick={() => setKind(k)} className={`nd-press rounded-[3px] p-3.5 text-left ${kind === k ? "outline-2 -outline-offset-2 outline-foreground" : "bg-background"}`}>
            <b className="block text-[16px]">{t}</b>
            <small className="text-[13px] leading-snug text-muted-foreground">{d}</small>
          </button>
        ))}
      </div>
      {kind === "show_changed" && <Stepper data="from" label="From episode" value={from} min={earliest} max={page.season?.episodeCount ?? 99} onChange={setFrom} />}
      <Text data="summary" label="In a sentence · optional" value={summary} onChange={setSummary} placeholder="A new advantage, Block a Vote" />
      <p data-impact className="mt-3 rounded-[3px] bg-background p-3 text-[14px] leading-snug">
        {live
          ? kind === "fix"
            ? `Reaches every league that follows it (${reach}), from the premiere: each one's scores are worked out again.`
            : `Reaches every league that follows it (${reach}) from Episode ${from}. Episodes before it keep their rules and scores.`
          : `Saved to the rulebook. Its leagues still play by the show's rules: switch them on and they get it then.`}
      </p>
      <div className="mt-4 flex gap-2">
        <Btn className="w-[34%]" onClick={onClose}>
          Cancel
        </Btn>
        <Btn
          data-save-confirm
          tone="must"
          className="flex-1"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onSave(kind, from, summary);
            } catch {
              setBusy(false);
            }
          }}
        >
          {kind === "fix" ? "Save the fix" : "Save the change"}
        </Btn>
      </div>
    </Sheet>
  );
}

// ---------- research: check for changes ----------

function CheckSheet({ id, onClose, onUse }: { id: string; onClose: () => void; onUse: (blocks: RulebookBlocks) => void }) {
  const prompt = useDesk<{ prompt: string }>(`/rulebooks/${id}?prompt=1`);
  const [answer, setAnswer] = useState("");
  const [review, setReview] = useState<{ blocks: RulebookBlocks; problems: { at: string; message: string }[]; warnings: { at: string; message: string }[]; leftOut: string[]; lines: string[]; changes: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} title="Check for changes" subtitle="Research describes the show again, starting from this rulebook">
      <div data-check-sheet>
        <ol className="flex flex-col gap-3">
          <li>
            <b className="block text-[15px]">1 · Copy the question</b>
            <small className="block text-[13px] text-muted-foreground">Paste it into any AI chat that can search the web.</small>
            <Btn
              data-copy-prompt
              tone={answer ? "optional" : "must"}
              wide
              className="mt-2"
              disabled={!prompt.data}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(prompt.data!.prompt);
                  toast("Question copied");
                } catch {
                  toast.quiet("Couldn't copy here");
                }
              }}
            >
              <Copy className="size-4" aria-hidden />
              Copy the question
            </Btn>
          </li>
          <li>
            <b className="block text-[15px]">2 · Paste the answer</b>
            <textarea data-check-answer rows={4} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="The AI's whole answer" className="mt-2 w-full rounded-[3px] bg-background p-3 text-base outline-1 -outline-offset-1 outline-input" />
            <Btn
              data-review
              wide
              className="mt-2"
              disabled={!answer.trim()}
              onClick={async () => {
                setError(null);
                try {
                  setReview(await deskSend(`/rulebooks/${id}`, { action: "review", answer }));
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Review it
            </Btn>
          </li>
        </ol>
        {error && (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {error}
          </p>
        )}
        {review && (
          <div data-review-result className="mt-4 rounded-[4px] bg-background p-3">
            <b className="block text-[16px]">{review.problems.length ? `${review.problems.length} ${review.problems.length === 1 ? "thing" : "things"} to fix before it can be used` : review.changes ? `${review.changes} ${review.changes === 1 ? "change" : "changes"} from the rulebook now` : "Nothing changed"}</b>
            {review.problems.map((p) => (
              <small key={p.at + p.message} className="block text-[13px] text-destructive">
                {p.message}
              </small>
            ))}
            {review.lines.map((l) => (
              <small key={l} data-change-line className="block text-[13px]">
                {l}
              </small>
            ))}
            {review.leftOut.length > 0 && <small className="mt-1 block text-[13px] text-muted-foreground">Didn&apos;t fit: {review.leftOut.join(" · ")}</small>}
            {review.changes > 0 && !review.problems.length && (
              <Btn data-use-review tone="must" wide className="mt-3" onClick={() => onUse(review.blocks)}>
                Use these changes
              </Btn>
            )}
          </div>
        )}
      </div>
    </Sheet>
  );
}

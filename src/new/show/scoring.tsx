"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Plus, RotateCw, Trophy, X } from "lucide-react";
import { scoring, useScoring, type ScoringMoment, type ScoringPage } from "../data";
import { NavLink, useNav } from "../nav";
import { paths } from "../routes";
import { isTabOf, useShow } from "../screens/show-space";
import { Btn, BtnLink, EmptyState } from "../ui/parts";
import { Sheet } from "../ui/sheet";
import { ShowBar } from "../ui/show-bar";
import { toast } from "../ui/toast";
import { Stepper } from "../backstage/waivers";

// The maker's scoring (docs/PLAN-maker-scoring.md step 4; maker-scoring.ts): a made game's moments and what each is worth, over
// the show. Whoever made it a game changes them until a game's played on it (anyone else, or after that, reads them with why).
// Points change with − and + and save together from the bar (every episode counted again at once); Add a moment scores
// something new, from an answer research already gets ("each vote received at the Round Table": counted straight away) or
// from a question of its own (the episodes already looked up then need asking again for it: the re-run sheet, for just the new
// question or everything; the page keeps saying so while any episode has no answer to it, and while they're being asked again).

const STEP = 0.5;
const LIMIT = 20;
const pts = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n)}`;

/** "Episode 4", "Episodes 1–7", "Episodes 1, 2 and 5". */
function episodesLabel(ns: number[], one: string, many: string): string {
  const sorted = [...ns].sort((a, b) => a - b);
  if (sorted.length === 1) return `${one} ${sorted[0]}`;
  if (sorted.every((n, i) => i === 0 || n === sorted[i - 1] + 1)) return `${many} ${sorted[0]}–${sorted[sorted.length - 1]}`;
  return `${many} ${sorted.slice(0, -1).join(", ")} and ${sorted[sorted.length - 1]}`;
}

type Counted = "yesNo" | "eachTime" | "perUnit";
const COUNTED: [Counted, string][] = [
  ["yesNo", "Once an episode"],
  ["eachTime", "Each time"],
  ["perUnit", "Per amount"],
];

export function ScoringScreen({ seasonId }: { seasonId: string }) {
  const show = useShow(seasonId);
  const nav = useNav();
  const data = useScoring(seasonId);
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Record<string, number>>({});
  const [adding, setAdding] = useState(false);
  const [again, setAgain] = useState(false);
  const [busy, setBusy] = useState(false);
  const name = show.header?.show.name ?? "Show";
  const back = { label: name.replace(/^The /, ""), onClick: () => nav.back(paths.show(seasonId, "cast"), isTabOf(seasonId)) };
  const page = data.data;
  const moments = page?.groups.flatMap((g) => g.moments) ?? [];
  const changed = Object.fromEntries(Object.entries(draft).filter(([id, v]) => moments.find((m) => m.id === id)?.points !== v));
  const n = Object.keys(changed).length;

  const w = show.words;
  /** A save landed: the page as it is now, and everything counted from it read again; a new question the episodes looked up
   *  already have no answer to offers to ask them again. */
  const landed = async (r: { page: ScoringPage; ask: { id: string; label: string }[] }, said: string) => {
    qc.setQueryData(["new-design", "scoring", seasonId], r.page);
    if (r.ask.length && r.page.behind.length) setAgain(true);
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["new-design", "stats", seasonId] }),
      qc.invalidateQueries({ queryKey: ["new-design", "episodes", seasonId] }),
      qc.invalidateQueries({ queryKey: ["new-design", "how", seasonId] }),
    ]);
    toast(said);
  };
  const save = async () => {
    setBusy(true);
    try {
      const r = await scoring.save(seasonId, { points: changed });
      setDraft({});
      await landed(r, `Saved · every ${show.words.episode.toLowerCase()} counted again`);
    } catch (e) {
      toast.quiet((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const remove = async (m: ScoringMoment) => {
    try {
      await landed(await scoring.save(seasonId, { remove: [m.id] }), `Took out ${m.label}`);
    } catch (e) {
      toast.quiet((e as Error).message);
    }
  };

  return (
    <>
      {show.header ? (
        <ShowBar show={{ seasonId, name, seasonNumber: show.header.seasonNumber, artUrl: show.header.show.artUrl, backdropUrl: show.header.show.backdropUrl }} back={back} title="Scoring" />
      ) : (
        <div className="h-24 animate-pulse bg-card" aria-busy />
      )}
      {data.error ? (
        <EmptyState icon={Trophy} title="Couldn't load its scoring" line={(data.error as Error).message} />
      ) : data.data === null ? (
        <EmptyState icon={Trophy} title="No scoring to change here" line="This show plays by its own built-in rules." />
      ) : !page ? (
        <div aria-busy className="mx-4 mt-6 h-72 animate-pulse rounded-[4px] bg-card" />
      ) : (
        <div className={`px-4 pt-5 ${n ? "pb-40" : "pb-12"}`} data-scoring={page.editable ? "edit" : "read"}>
          <p className="text-[14px] leading-snug text-muted-foreground" data-scoring-line>
            {page.editable ? `What each moment is worth. A change counts for every ${show.words.episode.toLowerCase()} at once, the ones already in too.` : page.why}
          </p>
          {page.editable && page.again.length > 0 ? (
            <NavLink
              href={paths.show(seasonId, "episodes")}
              data-scoring-again="asking"
              className="mt-4 flex min-h-12 items-center gap-3 rounded-[4px] bg-card px-3 py-2.5 outline-1 -outline-offset-1 outline-border"
            >
              <RotateCw className="size-[18px] flex-none" aria-hidden />
              <span className="min-w-0 flex-1 text-[14px] leading-snug">
                <b className="block">{`Looking up ${episodesLabel(page.again, w.episode, w.episodes)} again`}</b>
                <small className="block text-[13px] text-muted-foreground">{`How far it's got is on the ${w.episodes} tab. We'll tell you as each one comes in.`}</small>
              </span>
              <ChevronRight className="size-4 flex-none text-muted-foreground" aria-hidden />
            </NavLink>
          ) : null}
          {page.editable && page.behind.length > 0 ? (
            <div data-scoring-again="behind" className="mt-4 flex flex-col gap-2 rounded-[4px] bg-card p-3 outline-1 -outline-offset-1 outline-border">
              <span className="text-[14px] leading-snug">
                <b className="block">{`${episodesLabel(page.behind, w.episode, w.episodes)} ${page.behind.length === 1 ? "has" : "have"} no answer to a new question yet`}</b>
                <small className="block text-[13px] text-muted-foreground">{"They were looked up before it was added. Until they're asked again, it scores nothing in them."}</small>
              </span>
              <Btn wide data-scoring-again-open onClick={() => setAgain(true)}>
                Look them up again
              </Btn>
            </div>
          ) : null}
          {page.groups.map((g) => (
            <section key={g.id} className="mt-6" data-scoring-group={g.id}>
              <h2 className="type-caption border-b border-border pb-1.5 text-[14px] tracking-[0.04em] text-muted-foreground">{g.label}</h2>
              {g.moments.map((m) => {
                const v = draft[m.id] ?? m.points;
                const from = m.custom ? (m.uses ? `From: ${page.questions.find((q) => q.key === m.uses)?.words ?? "an answer research gets"}` : "Its own question") : undefined;
                return page.editable ? (
                  <div key={m.id} data-scoring-moment={m.id} className="flex items-center gap-1 border-b border-border py-1.5">
                    <div className="min-w-0 flex-1">
                      <Stepper
                        title={m.label}
                        line={changed[m.id] !== undefined ? `Was ${pts(m.points)}` : from}
                        value={pts(v)}
                        onStep={(d) => setDraft((x) => ({ ...x, [m.id]: Math.max(-LIMIT, Math.min(LIMIT, v + d * STEP)) }))}
                      />
                    </div>
                    {m.custom && (
                      <button type="button" aria-label={`Take out ${m.label}`} data-scoring-remove={m.id} onClick={() => remove(m)} className="grid size-11 flex-none place-items-center rounded-[3px] text-muted-foreground">
                        <X className="size-5" aria-hidden />
                      </button>
                    )}
                  </div>
                ) : (
                  <div key={m.id} data-scoring-moment={m.id} className="flex min-h-[48px] items-center justify-between gap-3 border-b border-border py-1.5">
                    <span className="min-w-0">
                      <span className="block text-[15px] font-semibold">{m.label}</span>
                      {from && <small className="block text-[13px] text-muted-foreground">{from}</small>}
                    </span>
                    <b className={`type-num flex-none text-[22px] ${m.points < 0 ? "text-muted-foreground" : ""}`}>{pts(m.points)}</b>
                  </div>
                );
              })}
            </section>
          ))}
          {page.editable && (
            <Btn wide className="mt-6" data-scoring-add onClick={() => setAdding(true)}>
              <Plus className="size-4" aria-hidden />
              Add a moment
            </Btn>
          )}
        </div>
      )}
      {n > 0 && (
        <div data-scoring-bar className="nd-fixed-x fixed bottom-0 z-30 border-t border-border bg-background/96 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+12px)] pt-3 backdrop-blur-md">
          <b className="block text-[15px]">{`${n} ${n === 1 ? "moment" : "moments"} changed`}</b>
          <small className="block text-[13px] text-muted-foreground">{`Every ${show.words.episode.toLowerCase()} is counted again, straight away.`}</small>
          <div className="mt-2 flex gap-2">
            <Btn className="h-12 w-[34%]" onClick={() => setDraft({})}>
              Cancel
            </Btn>
            <Btn data-scoring-save tone="must" className="h-12 flex-1" disabled={busy} onClick={save}>
              {busy ? "Saving…" : "Save points"}
            </Btn>
          </div>
        </div>
      )}
      {adding && page && <AddSheet seasonId={seasonId} page={page} onClose={() => setAdding(false)} landed={landed} />}
      {again && page && page.behind.length > 0 && <AgainSheet seasonId={seasonId} page={page} words={w} onClose={() => setAgain(false)} />}
    </>
  );
}

/** The way in, for whoever may change the scoring (nobody else sees it): a button under How it works' points, a line on the
 *  Players tab. */
export function ScoringLink({ seasonId, variant }: { seasonId: string; variant: "button" | "line" }) {
  const data = useScoring(seasonId);
  if (!data.data?.editable) return null;
  const href = paths.showPage(seasonId, "scoring");
  return variant === "button" ? (
    <BtnLink href={href} wide className="mt-3" data-scoring-link>
      Change the scoring
    </BtnLink>
  ) : (
    <NavLink href={href} data-scoring-link className="mt-3 flex min-h-11 items-center gap-1 text-[14px] font-semibold text-muted-foreground underline underline-offset-2">
      Change the scoring
      <ChevronRight className="size-4" aria-hidden />
    </NavLink>
  );
}

/** Ask the bot again about the episodes looked up before a new question: for just the new question (only what their answers
 *  have nothing for, merged in: nothing already counted changes) or everything (the whole episode again, merged field by field).
 *  The asks join Fill in what happened's queue and roll call (research-asks.ts askAgain). */
function AgainSheet({ seasonId, page, words: w, onClose }: { seasonId: string; page: ScoringPage; words: ReturnType<typeof useShow>["words"]; onClose: () => void }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<"missing" | "full" | null>(null);
  const several = page.groups.flatMap((g) => g.moments).filter((m) => m.custom && !m.uses).length > 1;
  const eps = episodesLabel(page.behind, w.episode, w.episodes);
  const ask = async (mode: "missing" | "full") => {
    setBusy(mode);
    try {
      const r = await scoring.again(seasonId, mode);
      qc.setQueryData(["new-design", "scoring", seasonId], r.page);
      await qc.invalidateQueries({ queryKey: ["new-design", "recaps", seasonId] });
      onClose();
      toast(`Asked about ${r.asked} ${r.asked === 1 ? w.episode.toLowerCase() : w.episodes.toLowerCase()} again · we'll tell you as each comes in`);
    } catch (e) {
      toast.quiet((e as Error).message);
      setBusy(null);
    }
  };
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} title="Look them up again?" subtitle={`${eps} ${page.behind.length === 1 ? "was" : "were"} looked up before ${several ? "these questions" : "this question"}`}>
      <div data-scoring-again-sheet className="flex flex-col gap-2">
        <Btn data-scoring-again-mode="missing" tone="must" wide className="h-auto! min-h-14 flex-col gap-0.5 py-2.5" disabled={!!busy} onClick={() => ask("missing")}>
          <span>{busy === "missing" ? "Asking…" : several ? "Just the new questions" : "Just the new question"}</span>
          <small className="text-[12.5px] font-normal opacity-80">About a minute each. Nothing already counted changes.</small>
        </Btn>
        <Btn data-scoring-again-mode="full" wide className="h-auto! min-h-14 flex-col gap-0.5 py-2.5" disabled={!!busy} onClick={() => ask("full")}>
          <span>{busy === "full" ? "Asking…" : "Everything again"}</span>
          <small className="text-[12.5px] font-normal text-muted-foreground">{`2 to 4 minutes each. Each ${w.episode.toLowerCase()} is filled in again, keeping what it had.`}</small>
        </Btn>
        <button type="button" data-scoring-again-later onClick={onClose} className="min-h-11 text-[14px] font-semibold text-muted-foreground underline underline-offset-2">
          Not now
        </button>
      </div>
    </Sheet>
  );
}

/** Add a moment: its name, how it counts, what scores it (an answer research already gets, or a question of its own), and
 *  its points. */
function AddSheet({
  seasonId,
  page,
  onClose,
  landed,
}: {
  seasonId: string;
  page: ScoringPage;
  onClose: () => void;
  landed: (r: { page: ScoringPage; ask: { id: string; label: string }[] }, said: string) => Promise<void>;
}) {
  const [label, setLabel] = useState("");
  const [counted, setCounted] = useState<Counted>("yesNo");
  const [from, setFrom] = useState<"new" | "asked">("new");
  const [uses, setUses] = useState<string | null>(null);
  const [points, setPoints] = useState(1);
  const [busy, setBusy] = useState(false);
  // An answer research already gets, of the kind this counts: yes or no for once an episode, a number for the others.
  const fits = page.questions.filter((q) => (counted === "yesNo" ? q.type === "answer" : q.type !== "answer"));
  const chosen = from === "asked" ? fits.find((q) => q.key === uses) ?? null : null;
  const ready = label.trim().length >= 3 && (from === "new" || !!chosen);
  const add = async () => {
    setBusy(true);
    try {
      const r = await scoring.save(seasonId, { add: [{ label: label.trim(), counted, points, ...(chosen ? { uses: chosen.key } : {}) }] });
      onClose();
      await landed(r, chosen ? `Added · counted from the answers already in` : `Added · research asks it from now on`);
    } catch (e) {
      toast.quiet((e as Error).message);
      setBusy(false);
    }
  };
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} title="Add a moment" subtitle="Something the recaps would say">
      <div data-scoring-add-sheet className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="type-caption text-[13px] tracking-[0.04em] text-muted-foreground">What happens?</span>
          <input
            data-scoring-label
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Each vote received at the Round Table"
            className="h-12 rounded-[3px] bg-background px-3 text-base outline-1 -outline-offset-1 outline-input"
          />
        </label>
        <div>
          <p className="type-caption mb-1.5 text-[13px] tracking-[0.04em] text-muted-foreground">Counted</p>
          <div className="grid grid-cols-3 gap-2">
            {COUNTED.map(([k, l]) => (
              <button
                key={k}
                type="button"
                data-scoring-counted={k}
                aria-pressed={counted === k}
                onClick={() => {
                  setCounted(k);
                  setUses(null);
                }}
                className={`nd-press min-h-12 rounded-[3px] px-2 text-[14px] font-semibold ${counted === k ? "bg-foreground text-background" : "bg-background"}`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="type-caption mb-1.5 text-[13px] tracking-[0.04em] text-muted-foreground">Scored from</p>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ["new", "A new question"],
                ["asked", "An answer we get"],
              ] as const
            ).map(([k, l]) => (
              <button
                key={k}
                type="button"
                data-scoring-from={k}
                aria-pressed={from === k}
                disabled={k === "asked" && !fits.length}
                onClick={() => setFrom(k)}
                className={`nd-press min-h-12 rounded-[3px] px-2 text-[14px] font-semibold disabled:opacity-40 ${from === k ? "bg-foreground text-background" : "bg-background"}`}
              >
                {l}
              </button>
            ))}
          </div>
          {from === "asked" ? (
            <div className="mt-2 flex max-h-56 flex-col overflow-y-auto rounded-[3px] bg-background" role="radiogroup" aria-label="The answer it's scored from">
              {fits.map((q) => (
                <button
                  key={q.key}
                  type="button"
                  role="radio"
                  aria-checked={uses === q.key}
                  data-scoring-question={q.key}
                  onClick={() => setUses(q.key)}
                  className={`min-h-12 border-b border-border px-3 py-2 text-left text-[14px] last:border-b-0 ${uses === q.key ? "bg-foreground font-semibold text-background" : ""}`}
                >
                  {q.words}
                </button>
              ))}
            </div>
          ) : null}
          <small className="mt-2 block text-[13px] leading-snug text-muted-foreground">
            {from === "asked"
              ? "Counted from the answers already in, straight away: nothing to look up again."
              : page.researched.length
                ? `Research asks it from now on. The ${page.researched.length === 1 ? "episode" : "episodes"} already looked up can be asked again for it after.`
                : "Research asks it from now on."}
          </small>
        </div>
        <Stepper title="Points" line={counted === "yesNo" ? "When it happens" : counted === "eachTime" ? "Each time" : "Per one"} value={pts(points)} onStep={(d) => setPoints((p) => Math.max(-LIMIT, Math.min(LIMIT, p + d * STEP)))} />
        <Btn data-scoring-add-it tone="must" wide disabled={!ready || busy} onClick={add}>
          {busy ? "Adding…" : "Add it"}
        </Btn>
      </div>
    </Sheet>
  );
}

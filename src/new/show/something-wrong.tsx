"use client";

import { useState } from "react";
import { Check, ChevronRight, CircleQuestionMark, KeyRound, Plus, RotateCcw } from "lucide-react";
import { flagResult, useAfterResults, useEpisodeResults, type Correction, type EpisodeResults } from "../data";
import { Btn, Chip } from "../ui/parts";
import { Sheet } from "../ui/sheet";
import { toast } from "../ui/toast";
import { usePushedPage } from "../ui/page";
import { first } from "./moves";
import { Face } from "./parts";

// Results from everyone, as players see it (docs/PLAN-new-design.md step 6b; the mock's community.js): a correction the
// shared check made shows as its own line in Episodes and a plate on the episode ("Corrected · Brady's idol removed ·
// Weekly Lineup: you −4"), with any house ruling under it; and "Something wrong?" at the foot of every episode page (and
// on each episode of a castaway's story): who it's about, which result (or something missing), then why. A flag goes to
// the shared check, never prominent, never hidden: nothing changes in anyone's games until it's settled.

const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n)}`;

/** "Brady's idol removed" said plainly: "Brady · Found an idol, taken out" / "Devin · Found an idol, added" / "Mike · Voted Out → Quit". */
export function correctionWhat(c: Pick<Correction, "name" | "label" | "change" | "to">): string {
  if (c.change === "removed") return `${first(c.name)} · ${c.label}, taken out`;
  if (c.change === "added") return `${first(c.name)} · ${c.label}, added`;
  return `${first(c.name)} · ${c.label} → ${c.to?.split(" · ").pop() ?? ""}`;
}

/** What a house ruling does here: keeps the old result, or keeps an added one out. */
const rulingLine = (c: Pick<Correction, "change">) =>
  c.change === "added" ? "It doesn't count in your games. The shared results count it." : "The old result still counts in your games. The shared results don't count it.";

/** Your points from it, game by game: "Weekly Lineup: you −4". */
const yours = (c: Correction) => c.you.filter((y) => y.delta).map((y) => `${y.game}: you ${signed(y.delta)}`);

/** The Episodes tab's line for a correction, above every episode (like anything else that happened). */
export function CorrectionRow({ c }: { c: Correction }) {
  const page = usePushedPage(`ep${c.episode}`);
  const mine = yours(c);
  return (
    <button type="button" data-correction-row={c.episode} onClick={page.show} className="nd-press flex min-h-[68px] w-full items-center gap-3 border-t border-border bg-good/[0.06] text-left">
      <span className="grid w-7 place-items-center text-good">
        <RotateCcw className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <b className="block truncate text-base font-semibold">
          Episode {c.episode} corrected{c.ruling ? " · house ruling" : ""}
        </b>
        <small className="mt-0.5 block truncate text-[13px] text-muted-foreground">
          {c.ruling
            ? c.change === "added"
              ? `${correctionWhat(c).replace(", added", "")} doesn't count here`
              : `${correctionWhat(c).replace(", taken out", "")} still counts here`
            : [correctionWhat(c), ...mine].join(" · ")}
        </small>
      </span>
      <ChevronRight className="size-5 flex-none text-muted-foreground" aria-hidden />
    </button>
  );
}

/** The plate at the top of an episode's page: what the shared check corrected, and any house ruling here. */
export function CorrectionPlates({ results }: { results: EpisodeResults | undefined }) {
  if (!results?.corrections.length && !results?.rulings.length) return null;
  return (
    <div className="mb-3 flex flex-col gap-2.5">
      {results.corrections.map((c) => (
        <div key={c.decisionId} data-corrected={c.decisionId} className="flex gap-3 rounded-[4px] bg-card p-3.5 outline-1 -outline-offset-1 outline-border">
          <span className="type-caption h-fit flex-none bg-good px-2 py-0.5 text-[11px] text-background">Corrected</span>
          <div className="min-w-0 flex-1">
            <b className="block text-[15px] leading-snug">{correctionWhat(c)}</b>
            <small className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">
              The shared results changed it for everyone.{yours(c).length ? ` ${yours(c).join(". ")}.` : ""}
            </small>
            {c.ruling && (
              <p data-house-ruling className="mt-2 flex gap-2 text-[13px] leading-snug">
                <KeyRound className="mt-0.5 size-4 flex-none" aria-hidden />
                <span>
                  <b>House ruling{c.ruling.by ? ` (${c.ruling.by})` : ""}</b> {rulingLine(c)}
                </span>
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

type Reason = "didnt-happen" | "wrong-person" | "wrong-episode" | "other" | "missing";
const REASONS: [Reason, string][] = [
  ["didnt-happen", "Didn't happen"],
  ["wrong-person", "Wrong person"],
  ["wrong-episode", "Wrong episode"],
  ["other", "Something else"],
];

/** "Something wrong in this episode?", at the foot of its page. */
export function SomethingWrong({ seasonId, couchId, episode }: { seasonId: string; couchId: string | null; episode: number }) {
  const [open, setOpen] = useState(false);
  if (!couchId) return null;
  return (
    <section className="mt-[26px]">
      <button
        type="button"
        data-something-wrong
        onClick={() => setOpen(true)}
        className="nd-press flex min-h-12 w-full items-center justify-center gap-2 rounded-[3px] border border-dashed border-border text-[14px] font-semibold text-muted-foreground"
      >
        <CircleQuestionMark className="size-[18px]" aria-hidden />
        Something wrong in this episode?
      </button>
      {open && <DisputeSheet seasonId={seasonId} couchId={couchId} episode={episode} onClose={() => setOpen(false)} />}
    </section>
  );
}

/** The flag, three steps in one sheet: who → which result (or something missing) → why. `who`: start on someone. */
export function DisputeSheet({ seasonId, couchId, episode, who: start = null, onClose }: { seasonId: string; couchId: string; episode: number; who?: string | null; onClose: () => void }) {
  const q = useEpisodeResults(seasonId, couchId, episode);
  const refresh = useAfterResults();
  const [who, setWho] = useState<string | null>(start);
  const [what, setWhat] = useState<string | null>(null);
  const [reason, setReason] = useState<Reason | null>(null);
  const [note, setNote] = useState("");
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const people = q.data?.people ?? [];
  const person = who && who !== "*" ? (people.find((p) => p.name === who || first(p.name) === who) ?? null) : null;
  const result = person?.results.find((r) => r.id === what) ?? null;
  const missing = what === "+";
  const step = !who ? "who" : !what ? "what" : "why";

  const title = step === "who" ? `Something wrong in Episode ${episode}?` : step === "what" ? (person ? `${first(person.name)} · Episode ${episode}` : `Episode ${episode}`) : missing ? `Missing from Episode ${episode}` : `${first(person?.name ?? "")} · ${result?.label ?? ""}`;
  const subtitle =
    step === "who"
      ? "Who is it about? Your flag goes to a shared check; nothing changes until it's settled."
      : step === "what"
        ? "Which result is wrong?"
        : `Episode ${episode} · flags from anyone who's seen it are checked against the next answer`;

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await flagResult(seasonId, couchId, {
        episode,
        decisionId: missing ? undefined : (result?.id ?? undefined),
        reason: missing ? "missing" : reason!,
        note: note.trim() || undefined,
        link: link.trim() || undefined,
      });
      await refresh();
      onClose();
      toast(r.others ? `Sent. ${r.others} other${r.others === 1 ? "" : "s"} flagged this too.` : "Sent. It's checked against the next answer.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} title={title} subtitle={subtitle}>
      <div data-dispute={step}>
        {q.isLoading ? (
          <div aria-busy className="h-48 animate-pulse rounded-[3px] bg-background" />
        ) : q.error ? (
          <p role="alert" className="text-sm text-destructive">
            {(q.error as Error).message}
          </p>
        ) : step === "who" ? (
          <>
            <div className="grid grid-cols-4 gap-2">
              {people.map((p) => (
                <button key={p.name} type="button" data-dispute-who={p.name} onClick={() => setWho(p.name)} className="nd-press flex flex-col overflow-hidden rounded-[3px] bg-plate text-left text-plate-foreground">
                  <Face src={p.photo} name={p.name} className="aspect-square w-full text-2xl" />
                  <span className="px-1.5 py-1">
                    <b className="type-caption block truncate text-[13px]">{first(p.name)}</b>
                    <small className="block text-[11px] text-plate-muted">
                      {p.results.length} {p.results.length === 1 ? "result" : "results"}
                    </small>
                  </span>
                </button>
              ))}
            </div>
            {!people.length && <p className="text-sm text-muted-foreground">Nothing is in for this episode yet.</p>}
            <button type="button" data-dispute-who="*" onClick={() => { setWho("*"); setWhat("+"); }} className="nd-press mt-2 flex min-h-[60px] w-full items-center gap-3 text-left">
              <span className="grid size-10 flex-none place-items-center rounded-[3px] bg-secondary">
                <CircleQuestionMark className="size-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <b className="block text-[15px]">Something else</b>
                <small className="block text-[13px] text-muted-foreground">Missing from the results, or not about one person</small>
              </span>
              <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
            </button>
          </>
        ) : step === "what" ? (
          <div className="flex flex-col">
            {(person?.results ?? []).map((r) => (
              <button
                key={r.id}
                type="button"
                data-dispute-what={r.id}
                disabled={r.yours}
                onClick={() => setWhat(r.id)}
                className="nd-press flex min-h-[60px] items-center gap-3 border-t border-border py-2 text-left first:border-t-0 disabled:opacity-70"
              >
                <span className="min-w-0 flex-1">
                  <b className="block text-[15px]">{r.label}</b>
                  <small className="block text-[13px] text-muted-foreground">
                    {r.line}
                    {r.yours ? " · you flagged this" : r.flags ? ` · ${r.flags} flagged` : ""}
                  </small>
                </span>
                {r.yours ? <Check className="size-5 text-good" aria-hidden /> : <ChevronRight className="size-5 text-muted-foreground" aria-hidden />}
              </button>
            ))}
            <button type="button" data-dispute-what="+" onClick={() => setWhat("+")} className="nd-press flex min-h-[60px] items-center gap-3 border-t border-border py-2 text-left">
              <span className="grid size-10 flex-none place-items-center rounded-[3px] bg-secondary">
                <Plus className="size-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <b className="block text-[15px]">Something&apos;s missing</b>
                <small className="block text-[13px] text-muted-foreground">It happened, but it isn&apos;t here</small>
              </span>
              <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {!missing && (
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="What's wrong">
                {REASONS.map(([k, l]) => (
                  <Chip key={k} data-reason={k} on={reason === k} onClick={() => setReason(k)} className="h-11">
                    {l}
                  </Chip>
                ))}
              </div>
            )}
            <label className="flex flex-col gap-1.5">
              <span className="type-caption text-[13px] text-muted-foreground">{missing ? "What happened?" : "Anything to add? Optional"}</span>
              <textarea
                data-dispute-note
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder={missing ? "e.g. Kristin found an idol clue at the well" : "e.g. It was Devin's idol; Brady only found the clue"}
                className="rounded-[3px] bg-background p-3 text-base outline-1 -outline-offset-1 outline-input"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="type-caption text-[13px] text-muted-foreground">A link that shows it · optional</span>
              <input
                data-dispute-link
                type="url"
                inputMode="url"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="Paste a link"
                className="h-12 rounded-[3px] bg-background px-3 text-base outline-1 -outline-offset-1 outline-input"
              />
            </label>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Btn data-dispute-send tone="must" wide disabled={busy || (missing ? !note.trim() : !reason)} onClick={send}>
              Send
            </Btn>
            <p className="text-center text-[13px] text-muted-foreground">Your scores don&apos;t change until it&apos;s settled.</p>
          </div>
        )}
      </div>
    </Sheet>
  );
}

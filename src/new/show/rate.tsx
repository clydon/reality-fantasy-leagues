"use client";

import { useState, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Star } from "lucide-react";
import { againstCouch, verdictText } from "@/lib/game/ratings";
import { ratingsApi, useAfterRating, useEpisodeVerdict, type CouchHub, type EpisodeVerdict, type EpisodeVerdictLine } from "../data";
import type { ShowData } from "../screens/show-space";
import { useMe } from "../session";
import { Avatar } from "../ui/bars";
import { Btn } from "../ui/parts";
import { Sheet } from "../ui/sheet";
import { toast } from "../ui/toast";

// Rate it (docs/PLAN-new-design.md step 12 part 1; the mock's watching.js rateSheet, episode.js rate5 and the watch along's
// rate-it), opened from anywhere signed in with openRate: "How was Episode 5?", five stars (a tap saves), then the couch verdict
// on a plate (the average, from how many, "You agree with the couch" or the contrarian's line, everyone's stars and takes),
// and a one-line take. Solo (no couch, or a couch of one) the verdict is everyone on Game Your Show's, a number only. Also the
// rows that open it (Tonight's Extras, the episode page) and each episode's mark on Episodes. Only for an episode you've seen:
// the server refuses the rest (ratings.ts).

export type RateTarget = { seasonId: string; couchId: string | null; episode: number; label: string; solo: boolean };

type Store = { target: RateTarget | null; n: number };
let store: Store = { target: null, n: 0 };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const SERVER: Store = { target: null, n: 0 };

/** Open Rate it for an episode you've seen. */
export function openRate(target: RateTarget) {
  store = { ...store, target: null };
  emit();
  setTimeout(() => {
    store = { target, n: store.n + 1 };
    emit();
  }, 30);
}

const close = () => {
  store = { ...store, target: null };
  emit();
};

function useRateTarget(): Store {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => store,
    () => SERVER
  );
}

/** The sheet's host, in the signed-in layout. */
export function RateSheets() {
  const { target, n } = useRateTarget();
  return <RateSheet key={n} target={target} onOpenChange={(o) => !o && close()} />;
}

// ---------- the words ----------

/** "Survivor 51": the show as the rate sheet names it. */
export const rateLabel = (show: ShowData) =>
  show.header ? `${show.header.show.name.replace(/^The /, "").replace(/\s*\([^)]*\)\s*$/, "")}${show.header.seasonNumber ? ` ${show.header.seasonNumber}` : ""}` : "";

/** "★ 4.3" */
export const starsText = (avg: number | null) => `★ ${verdictText(avg)}`;

/** Tonight's row and the episode page's: Rate Episode 5, or what you gave it and the verdict. */
export function rateWords(n: number, v: EpisodeVerdictLine | undefined, solo: boolean): { title: string; line: string; state: string } {
  if (!v?.mine) return { title: `Rate Episode ${n}`, line: solo ? "Two seconds, then see how everyone rated it" : "Two seconds, then the couch verdict", state: "Rate" };
  const others = v.n - 1;
  return {
    title: `You gave Episode ${n} ${"★".repeat(v.mine)}`,
    line: others > 0 ? `${solo ? "Everyone" : "The couch"} says ${starsText(v.avg)} · from ${v.n}` : solo ? "You're the first to rate it" : "You're first · the couch verdict fills in as they rate",
    state: "Rated",
  };
}

// ---------- the sheet ----------

function RateSheet({ target, onOpenChange }: { target: RateTarget | null; onOpenChange: (open: boolean) => void }) {
  const open = !!target;
  const v = useEpisodeVerdict(target?.seasonId ?? null, target?.couchId ?? null, target?.episode ?? null, open);
  const afterRating = useAfterRating();
  // What you tapped, until the server's answer has it (so the stars move at once).
  const [tapped, setTapped] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const mine = v.data?.mine ?? null;
  const shown = tapped ?? mine?.stars ?? 0;
  const rate = async (stars: number) => {
    if (!target || saving) return;
    setTapped(stars);
    setSaving(true);
    try {
      afterRating(await ratingsApi.rate(target.seasonId, target.couchId, target.episode, { stars }), target.couchId);
    } catch (e) {
      setTapped(null);
      toast((e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  const status = (v.error as { status?: number } | null)?.status;
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={`How was Episode ${target?.episode ?? ""}?`}
      subtitle={target ? `${target.label} · then ${target.solo ? "everyone's verdict" : "the couch verdict"}` : undefined}
    >
      {v.isPending && open ? (
        <div aria-busy className="h-[220px] animate-pulse rounded-[4px] bg-secondary" />
      ) : !v.data ? (
        <p className="py-4 text-sm text-muted-foreground">{status === 403 ? `You haven't seen Episode ${target?.episode} yet.` : "Couldn't load it. Try again in a moment."}</p>
      ) : (
        <div data-rate-sheet={v.data.episode}>
          <div className="my-2 flex justify-center gap-1.5" role="radiogroup" aria-label="Your stars">
            {[1, 2, 3, 4, 5].map((i) => (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={shown === i}
                aria-label={`${i} ${i === 1 ? "star" : "stars"}`}
                data-star={i}
                disabled={saving}
                onClick={() => rate(i)}
                className="grid size-[52px] place-items-center rounded-[4px]"
              >
                <Star
                  className={`size-10 transition-[color,transform] duration-300 motion-reduce:transition-none ${i <= shown ? "scale-[1.08] fill-current text-chyron-line" : "fill-current text-input"}`}
                  strokeWidth={0}
                  aria-hidden
                />
              </button>
            ))}
          </div>
          <VerdictPlate v={v.data} couchId={target?.couchId ?? null} />
          {mine && <TakeField key={`${v.data.episode}-${mine.take ?? ""}`} target={target!} v={v.data} />}
          <Btn wide className="mt-4" onClick={() => onOpenChange(false)}>
            {mine ? "Done" : "Not now"}
          </Btn>
        </div>
      )}
    </Sheet>
  );
}

/** The couch verdict on a plate (the mock's .verdict): shown once you've rated, sliding up as it arrives. */
function VerdictPlate({ v, couchId }: { v: EpisodeVerdict; couchId: string | null }) {
  const me = useMe();
  const client = useQueryClient();
  const couch = v.scope === "couch";
  if (!v.mine) {
    return (
      <p data-verdict-wait className="mt-1 text-center text-[13px] text-muted-foreground">
        {v.n ? `${v.n} ${couch ? "on the couch" : "on Game Your Show"} rated it · tap your stars to see ${couch ? "the couch verdict" : "theirs"}` : `Nobody${couch ? " on the couch" : ""} has rated it yet`}
      </p>
    );
  }
  // Everyone else's stars: the couch's one by one, or everyone's (solo) as the average less yours.
  const others = couch ? v.people.filter((p) => p.userId !== me.id).map((p) => p.stars) : v.n > 1 && v.avg !== null ? [(v.avg * v.n - v.mine.stars) / (v.n - 1)] : [];
  const said = againstCouch(v.mine.stars, others);
  // Your taste twin, when the couch's hub has said who it is (it's read with the hub) and they rated this one too.
  const twin = couch ? (client.getQueryData<CouchHub>(["new-design", "couch-hub", couchId])?.taste?.twin ?? null) : null;
  const twinHere = twin && v.people.some((p) => p.userId === twin.userId) ? twin.name : null;
  const line =
    said === "first"
      ? couch
        ? "You're the first on the couch to rate it"
        : "You're the first to rate it"
      : said === "agree"
        ? couch
          ? `You agree with the couch${twinHere ? ` · taste twin: ${twinHere}` : ""}`
          : "You agree with everyone"
        : said === "contrarian"
          ? couch
            ? "Spicy. You're the contrarian this week"
            : "Spicy. Everyone else saw it differently"
          : null;
  const takes = [...v.people.filter((p) => p.take && p.userId !== me.id), ...v.people.filter((p) => p.take && p.userId === me.id)];
  return (
    <div data-verdict className="nd-beat mt-3 rounded-[4px] bg-plate p-4 text-plate-foreground">
      <span className="type-caption inline-block bg-chyron py-1 pl-2 pr-4 text-xs tracking-[0.06em] text-chyron-foreground [clip-path:polygon(0_0,100%_0,calc(100%_-_8px)_100%,0_100%)]">
        {couch ? "Couch verdict" : "Everyone's verdict"}
      </span>
      <div className="mt-2 flex items-end gap-2.5">
        <b data-verdict-score className="type-num text-[56px] leading-[.85]">
          {verdictText(v.avg)}
        </b>
        <span className="pb-1 text-[13px] text-plate-muted">from {v.n} {couch ? "on the couch" : "on Game Your Show"}</span>
      </div>
      {line && (
        <p data-verdict-said={said ?? ""} className="mt-2 text-sm font-semibold">
          {line}
        </p>
      )}
      {couch && v.people.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-2" data-verdict-people>
          {v.people.map((p) => (
            <span key={p.userId} className="flex items-center gap-1.5" data-verdict-person={p.name}>
              <Avatar id={p.userId} name={p.name} size={26} />
              <b className="type-num text-[16px]">★ {p.stars}</b>
            </span>
          ))}
        </div>
      )}
      {takes.map((p) => (
        <p key={p.userId} data-take={p.name} className="mt-2.5 text-sm leading-snug [overflow-wrap:anywhere]">
          <b>{p.userId === me.id ? "You" : p.name}:</b> &ldquo;{p.take}&rdquo;
        </p>
      ))}
      {v.everyone && (
        <p data-verdict-everyone className="mt-2.5 text-[13px] text-plate-muted">
          Everyone on Game Your Show: {starsText(v.everyone.avg)} from {v.everyone.n}
        </p>
      )}
    </div>
  );
}

/** Your one-line take, once you've rated: posted with your stars. */
function TakeField({ target, v }: { target: RateTarget; v: EpisodeVerdict }) {
  const afterRating = useAfterRating();
  const [text, setText] = useState(v.mine?.take ?? "");
  const [saving, setSaving] = useState(false);
  const was = v.mine?.take ?? "";
  const changed = text.trim() !== was;
  const save = async () => {
    if (!v.mine || !changed) return;
    setSaving(true);
    try {
      afterRating(await ratingsApi.rate(target.seasonId, target.couchId, target.episode, { stars: v.mine.stars, take: text }), target.couchId);
      toast(text.trim() ? "Your take is in" : "Take taken back");
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="mt-3 flex gap-2">
      <input
        data-take-input
        value={text}
        maxLength={140}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && save()}
        placeholder={target.solo ? "A one-line take, just for you (optional)" : "One-line take for the couch (optional)"}
        aria-label="Your take"
        className="h-12 min-w-0 flex-1 rounded-[3px] bg-secondary px-3 text-base outline-none placeholder:text-muted-foreground focus:outline-1 focus:outline-input"
      />
      <Btn data-take-save disabled={!changed || saving} onClick={save} className="flex-none px-4">
        {was && !text.trim() ? "Remove" : "Post"}
      </Btn>
    </div>
  );
}

// ---------- where it opens from ----------

/** A row that opens Rate it (Tonight's Extras, the episode page): the stars you gave and the verdict, or Rate. */
export function RateRow({ target, verdict }: { target: RateTarget; verdict: EpisodeVerdictLine | undefined }) {
  const w = rateWords(target.episode, verdict, target.solo);
  return (
    <button
      type="button"
      data-rate-row={target.episode}
      data-rated={verdict?.mine ? "yes" : "no"}
      onClick={() => openRate(target)}
      className="nd-press flex min-h-[60px] w-full items-center gap-3 border-t border-border py-2 text-left"
    >
      <span className="min-w-0 flex-1">
        <b className="block text-[15px] font-semibold">{w.title}</b>
        <small className="mt-0.5 block text-[13px] text-muted-foreground">{w.line}</small>
      </span>
      <span className="text-[13px] font-semibold text-muted-foreground">{w.state}</span>
      <ChevronRight className="size-5 flex-none text-muted-foreground" aria-hidden />
    </button>
  );
}

/** An episode's mark on Episodes: the verdict, and yours ("you 4"), or Rate where the row opens Rate it. */
export function VerdictMark({ v, solo, rate }: { v: EpisodeVerdictLine | undefined; solo: boolean; rate?: boolean }) {
  if (!v?.n) return rate ? <span className="flex-none text-[15px] font-semibold text-muted-foreground">Rate</span> : null;
  return (
    <span data-verdict-mark className="flex-none text-right">
      <b className="type-num block text-[19px] leading-none text-chyron-line">{starsText(v.avg)}</b>
      <small className="mt-1 block text-[11px] text-muted-foreground">{v.mine ? `you ${v.mine}` : solo ? "everyone" : "couch"}</small>
    </span>
  );
}

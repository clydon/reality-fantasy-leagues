"use client";

import { useEffect, useState } from "react";
import { CalendarClock, Check, CircleQuestionMark, KeyRound, Users } from "lucide-react";
import { airTime } from "../clock";
import { backstage, useAfterResults, type Backstage, type Correction, type PreviewLine } from "../data";
import { Block } from "../show/parts";
import { GuardSheet } from "../ui/guards";
import { Btn, Row } from "../ui/parts";
import { Sheet } from "../ui/sheet";
import { toast } from "../ui/toast";

// Backstage › Results' part of results from everyone (docs/PLAN-new-design.md step 6b; the mock's community.js
// bsResults): who can fill in the full scores and how each recent episode's stand ("filled in by riley · 2 sources
// agree"), the corrections the shared check made to your games (Keep our old result: a house ruling, previewed first, tier
// 2; Drop the ruling), and the flags sent from this couch.

const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n)}`;
const first = (name: string) => name.split(" ")[0];
// "Brady · Found an idol"; a fact about no one ("Nobody went home", step 6c) is its label alone.
const what = (name: string, label: string) => (name ? `${first(name)} · ${label}` : label);

/** "Removed: Brady · Found an idol", "Added: Devin · Found an idol", "Changed: Mike · Voted Out → Quit". */
export function correctionTitle(c: Pick<Correction, "name" | "label" | "change" | "to">): string {
  if (c.change === "removed") return `Removed: ${what(c.name, c.label)}`;
  if (c.change === "added") return `Added: ${what(c.name, c.label)}`;
  return `Changed: ${what(c.name, c.label)} → ${c.to?.split(" · ").pop() ?? ""}`;
}

/** Who can fill them in, then each recent episode that someone has filled in, and how far its sources agree. */
export function FillState({ seasonId, couchId, data }: { seasonId: string; couchId: string; data: Backstage }) {
  const [choosing, setChoosing] = useState(false);
  const refresh = useAfterResults();
  const runners = [...new Set(data.games.map((g) => g.name))].length;
  const set = async (anyone: boolean) => {
    setChoosing(false);
    if (anyone === data.fill.anyone) return;
    try {
      await backstage.setFill(seasonId, couchId, anyone);
      await refresh();
      toast(anyone ? "Anyone on the couch can fill in results" : "Only people who run games fill in results", {
        undo: async () => {
          await backstage.setFill(seasonId, couchId, !anyone);
          await refresh();
        },
      });
    } catch (e) {
      toast((e as Error).message);
    }
  };
  return (
    <div data-fill-state className="mb-3">
      <Row
        icon={Users}
        title={<span data-who-fills>Who can fill them in</span>}
        detail={data.fill.anyone ? "Anyone on the couch · one paste covers every game" : "Only people who run games here"}
        onClick={() => setChoosing(true)}
      />
      {data.fill.episodes
        .filter((e) => e.sources > 0)
        .map((e) => (
          <div key={e.episode} data-filled={e.episode} className="flex min-h-[60px] items-center gap-3 border-t border-border py-2">
            <span className="grid size-10 flex-none place-items-center rounded-full bg-good/20 text-good">
              <Check className="size-4" strokeWidth={2.6} aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <b className="block text-[15px] font-semibold">
                Episode {e.episode} · {e.here && e.by ? `filled in by ${e.by}` : e.bot ? "filled in by our bot" : "filled in on another couch"}
              </b>
              <small className="block text-[13px] text-muted-foreground">{e.sources >= 2 ? `Confirmed · ${e.sources} sources agree` : "Reported · 1 source so far"}</small>
            </span>
          </div>
        ))}
      <Sheet open={choosing} onOpenChange={setChoosing} title="Who can fill in results?" subtitle={`One paste covers every game here${runners > 1 ? ` (${runners})` : ""}`}>
        <div className="flex flex-col gap-2">
          {[
            [true, "Anyone on the couch", "Whoever's up first pastes the AI's answer. Recommended"],
            [false, "Only people who run games", "The quick check, the full scores and anything that waits stay yours"],
          ].map(([v, t, d]) => (
            <button
              key={String(v)}
              type="button"
              data-anyone={String(v)}
              aria-pressed={data.fill.anyone === v}
              onClick={() => set(v as boolean)}
              className={`nd-press rounded-[3px] p-3.5 text-left ${data.fill.anyone === v ? "outline-2 -outline-offset-2 outline-foreground" : "bg-background"}`}
            >
              <b className="block text-[16px]">{t}</b>
              <small className="text-[13px] text-muted-foreground">{d}</small>
            </button>
          ))}
        </div>
      </Sheet>
    </div>
  );
}

/** A disputed episode: one more answer about everyone settles it. */
export function QuestionCard({ episode, count, tiebreakAt, onAsk }: { episode: number; count: number; tiebreakAt?: string | null; onAsk: () => void }) {
  return (
    <div data-question={episode} className="rounded-[4px] bg-card p-3.5">
      <div className="flex items-start gap-3">
        <span className="grid size-9 flex-none place-items-center rounded-[3px] bg-secondary">
          <CircleQuestionMark className="size-5" aria-hidden />
        </span>
        <span className="flex-1">
          <b className="block text-[16px]">
            {count === 1 ? "A result" : `${count} results`} {count === 1 ? "is" : "are"} disputed
          </b>
          <small className="text-[13px] leading-snug text-muted-foreground">
            Someone flagged it, or the sources don&apos;t agree. Nothing changes until it&apos;s settled: one more answer about everyone settles most.
            {tiebreakAt ? ` If nobody checks it, our bot does ${airTime(Date.parse(tiebreakAt))}.` : ""}
          </small>
        </span>
      </div>
      <Btn data-ask="check" wide className="mt-3.5" onClick={onAsk}>
        Check it again
      </Btn>
    </div>
  );
}

/** What a correction did to each game: "Weekly Lineup: alex −4, jordan −4". */
function deltaLine(c: Correction): string {
  const parts = c.games.filter((g) => g.deltas.length).map((g) => `${g.name}: ${g.deltas.map((d) => `${d.name} ${signed(d.delta)}`).join(", ")}`);
  return parts.length ? `${parts.join(". ")}.` : "Nobody's points moved.";
}

/** The shared check's corrections to your games, each with Keep our old result or Drop the ruling. */
export function Corrections({ seasonId, couchId, corrections }: { seasonId: string; couchId: string; corrections: Correction[] }) {
  const [keeping, setKeeping] = useState<Correction | null>(null);
  const refresh = useAfterResults();
  if (!corrections.length) return null;
  const drop = async (c: Correction) => {
    try {
      await backstage.drop(seasonId, couchId, c.decisionId);
      await refresh();
      toast("Ruling dropped · the correction applies");
    } catch (e) {
      toast((e as Error).message);
    }
  };
  return (
    <Block title="Corrections" aside="From the shared check">
      <div className="flex flex-col gap-2.5">
        {corrections.map((c) => (
          <div key={`${c.episode}-${c.decisionId}`} data-correction={c.decisionId} className="flex gap-3 rounded-[4px] bg-card p-3.5">
            <span className={`type-caption h-fit flex-none px-2 py-0.5 text-[11px] ${c.ruling ? "bg-chyron text-chyron-foreground" : "bg-good text-background"}`}>{c.ruling ? "Ruling" : "Applied"}</span>
            <div className="min-w-0 flex-1">
              <b className="block text-[15px] leading-snug">
                Episode {c.episode} · {correctionTitle(c)}
              </b>
              <small className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">{deltaLine(c)}</small>
              {c.ruling ? (
                <>
                  <p data-ruling className="mt-2 flex gap-2 text-[13px] leading-snug">
                    <KeyRound className="mt-0.5 size-4 flex-none" aria-hidden />
                    <span>
                      <b>House ruling{c.ruling.by ? ` (${c.ruling.by})` : ""}</b> {c.change === "added" ? "It doesn't count in your games." : "The old result still counts in your games."} Your players see this ruling on Episode {c.episode}.
                    </span>
                  </p>
                  <Btn data-drop-ruling className="mt-2.5 h-10 px-3 text-[14px]" onClick={() => drop(c)}>
                    Drop the ruling
                  </Btn>
                </>
              ) : (
                <Btn data-keep-old className="mt-2.5 h-10 px-3 text-[14px]" onClick={() => setKeeping(c)}>
                  {c.change === "added" ? "Don't count it in our games" : "Keep our old result"}
                </Btn>
              )}
            </div>
          </div>
        ))}
      </div>
      {keeping && <KeepSheet seasonId={seasonId} couchId={couchId} correction={keeping} onClose={() => setKeeping(null)} onDone={refresh} />}
    </Block>
  );
}

/** Tier 2: what keeping the old result does to each game, from the server's dry run, then the ruling. */
function KeepSheet({ seasonId, couchId, correction, onClose, onDone }: { seasonId: string; couchId: string; correction: Correction; onClose: () => void; onDone: () => Promise<unknown> }) {
  const [lines, setLines] = useState<PreviewLine[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    backstage
      .keepPreview(seasonId, couchId, correction.decisionId)
      .then((r) => live && setLines([...r.lines, { face: { kind: "player", userId: null, name: "Your players" }, label: "Your players", change: `See the ruling on Episode ${correction.episode}`, dir: null }]))
      .catch((e: Error) => live && setFailed(e.message));
    return () => {
      live = false;
    };
  }, [seasonId, couchId, correction]);
  return (
    <GuardSheet
      open
      onOpenChange={(o) => !o && onClose()}
      title={correction.change === "added" ? "Leave it out of your games?" : "Keep your old result?"}
      subtitle={failed ?? "A house ruling: your games only. Shared stats stay correct."}
      lines={failed ? [] : lines}
      cta="Keep it as a house ruling"
      undoNote="Drop the ruling any time and the correction applies."
      onConfirm={async () => {
        await backstage.keep(seasonId, couchId, correction.decisionId);
        await onDone();
        toast("House ruling saved · your players can see it", {
          undo: async () => {
            await backstage.drop(seasonId, couchId, correction.decisionId);
            await onDone();
          },
        });
      }}
    />
  );
}

const FLAG_STATUS: Record<string, string> = {
  open: "Sent to the shared check",
  kept: "Settled: the sources say it happened",
  upheld: "Settled: taken out for everyone",
  checked: "Looked at again",
};

/** What this couch has flagged, and how each stands. */
export function CouchFlags({ flags }: { flags: Backstage["flags"] }) {
  if (!flags.length) return null;
  return (
    <Block title="Flags from your couch">
      {flags.map((f) => (
        <div key={f.id} data-couch-flag={f.status} className="flex min-h-[60px] items-center gap-3 border-t border-border py-2 first:border-t-0">
          <span className="grid size-10 flex-none place-items-center rounded-full bg-secondary">
            {f.status === "open" ? <CalendarClock className="size-5" aria-hidden /> : <Check className="size-5 text-good" aria-hidden />}
          </span>
          <span className="min-w-0 flex-1">
            <b className="block text-[15px] font-semibold">
              {f.who} flagged {f.what ? `“${f.what}”` : `something missing from Episode ${f.episode}`}
            </b>
            <small className="block text-[13px] text-muted-foreground">
              Episode {f.episode} · {FLAG_STATUS[f.status] ?? f.status}
            </small>
          </span>
        </div>
      ))}
    </Block>
  );
}

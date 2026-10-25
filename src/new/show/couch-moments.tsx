"use client";

import { useState } from "react";
import { Check, Users } from "lucide-react";
import { answerCouchMoment, useAfterResults, useCouchMoments, type CouchMoments } from "../data";
import { Btn } from "../ui/parts";
import { Sheet } from "../ui/sheet";
import { toast } from "../ui/toast";
import { Face } from "./parts";

// The couch's own moments on an episode's page (docs/PLAN-new-design.md step 6b part 3; the mock's rulebook.js "The
// couch answers"): the moments a couch added to its own rulebook (Backstage › Scoring rules, Make it ours), for anyone
// who plays here once they've seen the episode. Tick who did it; whoever runs the games settles it alone, otherwise two
// agreeing do, and every game on the couch counts it then. Only this couch sees it.

type Moment = CouchMoments["moments"][number];
const first = (name: string) => name.split(" ")[0];
const pickLine = (picks: { name: string; times?: number }[]) => (picks.length ? picks.map((p) => `${first(p.name)}${p.times ? ` ×${p.times}` : ""}`).join(", ") : "Nobody");

export function CouchMomentsCard({ seasonId, couchId, episode }: { seasonId: string; couchId: string | null; episode: number }) {
  const q = useCouchMoments(seasonId, couchId, episode);
  const [answering, setAnswering] = useState<Moment | null>(null);
  if (!couchId || !q.data?.moments.length) return null;
  const data = q.data;
  return (
    <section data-couch-moments={episode} className="mt-[26px]">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="type-caption text-[24px]">Your couch&apos;s moments</h2>
        <span className="text-[13px] text-muted-foreground">The couch answers</span>
      </div>
      {data.moments.map((m) => (
        <div key={m.id} data-couch-moment={m.id} className="flex min-h-[64px] items-center gap-3 border-t border-border py-2">
          <span className={`grid size-9 flex-none place-items-center rounded-[3px] ${m.by ? "bg-good text-background" : "bg-secondary"}`}>
            {m.by ? <Check className="size-[18px]" strokeWidth={3} aria-hidden /> : <Users className="size-[18px]" aria-hidden />}
          </span>
          <span className="min-w-0 flex-1">
            <b className="block text-[15px] leading-snug">{m.label}</b>
            <small data-couch-status className="block text-[13px] leading-snug text-muted-foreground">
              {m.by
                ? `${pickLine(m.settled)}${m.by === "runner" ? " · settled by whoever runs the games" : " · two of you agree"}`
                : m.waiting.length
                  ? `${m.waiting.map((w) => first(w.name)).join(", ")} · one says so, waiting for a second`
                  : m.answers
                    ? "Answers don't agree yet"
                    : "Nobody's answered yet"}
            </small>
            {m.yours && (
              <small className="block text-[13px] text-muted-foreground">
                You said: {pickLine(m.yours)}
              </small>
            )}
          </span>
          <Btn data-couch-answer={m.id} className="h-10 flex-none px-3 text-[14px]" onClick={() => setAnswering(m)}>
            {m.yours ? "Change" : "Answer"}
          </Btn>
        </div>
      ))}
      {answering && <AnswerSheet seasonId={seasonId} couchId={couchId} episode={episode} m={answering} data={data} onClose={() => setAnswering(null)} />}
    </section>
  );
}

function AnswerSheet({ seasonId, couchId, episode, m, data, onClose }: { seasonId: string; couchId: string; episode: number; m: Moment; data: CouchMoments; onClose: () => void }) {
  const refresh = useAfterResults();
  const [picks, setPicks] = useState<Map<string, number>>(() => new Map((m.yours ?? []).map((p) => [p.name, p.times ?? 1])));
  const [busy, setBusy] = useState(false);
  const each = m.counted === "eachTime";
  const toggle = (name: string) =>
    setPicks((x) => {
      const n = new Map(x);
      if (!n.has(name)) n.set(name, 1);
      else if (each && (n.get(name) ?? 1) < 9) n.set(name, (n.get(name) ?? 1) + 1);
      else n.delete(name);
      return n;
    });
  const send = async (list: { name: string; times?: number }[]) => {
    setBusy(true);
    try {
      const view = await answerCouchMoment(seasonId, couchId, episode, m.id, list);
      await refresh();
      onClose();
      const now = view.moments.find((x) => x.id === m.id);
      toast(now?.by ? `Settled: ${pickLine(now.settled)} · every game on the couch counts it` : "Sent · it counts once someone else agrees");
    } catch (e) {
      toast((e as Error).message);
      setBusy(false);
    }
  };
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} title={m.label} subtitle={`Episode ${episode} · who did it?${each ? " Tap again for each time." : ""}`}>
      <div data-answer-sheet className="grid grid-cols-4 gap-2">
        {data.cast.map((c) => {
          const n = picks.get(c.name);
          return (
            <button
              key={c.name}
              type="button"
              data-pick={c.name}
              aria-pressed={!!n}
              onClick={() => toggle(c.name)}
              className={`nd-press relative flex flex-col overflow-hidden rounded-[3px] text-left ${n ? "outline-2 -outline-offset-2 outline-good" : "bg-card"}`}
            >
              <Face src={c.photo} name={c.name} className="aspect-square w-full text-xl" />
              <b className="truncate px-1.5 py-1 text-[13px]">{first(c.name)}</b>
              {n ? <span className="type-num absolute right-1 top-1 grid min-w-6 place-items-center rounded-[3px] bg-good px-1 text-[14px] text-background">{each ? `×${n}` : "✓"}</span> : null}
            </button>
          );
        })}
      </div>
      <div className="mt-4 flex gap-2">
        <Btn data-answer-nobody className="w-[38%]" disabled={busy} onClick={() => send([])}>
          Nobody did
        </Btn>
        <Btn
          data-answer-send
          tone="must"
          className="flex-1"
          disabled={busy || !picks.size}
          onClick={() => send([...picks].map(([name, times]) => (each && times > 1 ? { name, times } : { name })))}
        >
          Send
        </Btn>
      </div>
      <p className="mt-2 text-center text-[13px] text-muted-foreground">{data.runs ? "You run the games here: your answer settles it." : "Two of you agreeing settles it. Only this couch sees it."}</p>
    </Sheet>
  );
}

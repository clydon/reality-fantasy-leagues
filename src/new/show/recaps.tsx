"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Copy, Sparkles } from "lucide-react";
import { recaps, useRecaps, type SeasonEpisodes } from "../data";
import type { ShowData } from "../screens/show-space";
import { Btn } from "../ui/parts";
import { Sheet } from "../ui/sheet";
import { toast } from "../ui/toast";

// Fill in what happened (episode-recaps.ts, db/migrations/0143) on a show's Episodes tab: when episodes you've seen only say when
// they aired, one card asks ChatGPT what happened in each (our bot, else copy and paste the same prompt). The recaps are the
// season's, everyone's, and each row shows its own once you've seen it. While our bot asks, the card says so and the read polls;
// when it's done, the episodes read again.

export function RecapsCard({ seasonId, show, eps }: { seasonId: string; show: ShowData; eps: SeasonEpisodes }) {
  const blank = eps.episodes.filter((e) => e.status === "aired" && e.watched && !e.summary).map((e) => e.number);
  const state = useRecaps(seasonId, blank.length > 0);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [paste, setPaste] = useState(false);
  const asking = !!state.data?.asking;
  const was = useRef(asking);
  // The ask finished: read the episodes again, and say how it went.
  useEffect(() => {
    if (was.current && !asking) {
      qc.invalidateQueries({ queryKey: ["new-design", "episodes", seasonId] });
      if (state.data?.message) toast.quiet(state.data.message);
      else toast("Filled in what happened");
    }
    was.current = asking;
  }, [asking, qc, seasonId, state.data?.message]);
  if (!blank.length && !asking) return null;
  const w = show.words;
  const [lo, hi] = [Math.min(...blank), Math.max(...blank)];
  const which = blank.length === 1 ? `${w.episode} ${lo}` : `${w.episodes} ${lo}–${hi}`;
  const ask = async () => {
    setBusy(true);
    try {
      qc.setQueryData(["new-design", "recaps", seasonId], await recaps.ask(seasonId));
    } catch (e) {
      toast.quiet((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="mt-[18px] px-4" data-recaps={asking ? "asking" : "ask"}>
      <div className="flex flex-col gap-2 rounded-[4px] bg-card p-4 outline-1 -outline-offset-1 outline-border">
        <b className="flex items-center gap-2 text-[17px] leading-tight">
          <Sparkles className="size-[18px] flex-none" aria-hidden />
          Fill in what happened
        </b>
        <small className="text-[13.5px] leading-snug text-muted-foreground">
          {asking
            ? "ChatGPT is looking it up. It takes a minute or two; you can leave this page."
            : `${which} only say when ${blank.length === 1 ? "it" : "they"} aired. ChatGPT can look up ${show.header?.show.kind === "sport" ? "the score, who won and who stood out" : "what happened"} in each. Everyone on the show sees them, only for the ones they've seen.`}
        </small>
        {!asking && state.data?.message && <small className="text-[13px] font-semibold leading-snug text-live">{state.data.message}</small>}
        {!asking && (
          <div className="mt-1 flex flex-col gap-1.5">
            {state.data?.available !== false && (
              <Btn tone="must" wide data-recaps-ask disabled={busy || !state.data} onClick={ask}>
                {busy ? "Asking…" : "Ask ChatGPT for me"}
              </Btn>
            )}
            <button type="button" data-recaps-paste onClick={() => setPaste(true)} className="self-start py-1.5 text-[13px] font-semibold text-muted-foreground underline underline-offset-2">
              {state.data?.available === false ? "Our bot's away: copy and paste instead" : "Or copy and paste it yourself"}
            </button>
          </div>
        )}
      </div>
      <PasteSheet open={paste} onOpenChange={setPaste} seasonId={seasonId} />
    </section>
  );
}

/** Copy and paste: the prompt to copy into any AI chat that searches the web, and its answer pasted back. */
function PasteSheet({ open, onOpenChange, seasonId }: { open: boolean; onOpenChange: (o: boolean) => void; seasonId: string }) {
  const qc = useQueryClient();
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText((await recaps.prompt(seasonId)).prompt);
      toast("Copied. Paste it into ChatGPT, then paste its answer here");
    } catch (e) {
      toast.quiet((e as Error).message);
    }
  };
  const save = async () => {
    setBusy(true);
    try {
      const out = await recaps.paste(seasonId, answer);
      qc.setQueryData(["new-design", "recaps", seasonId], out);
      await qc.invalidateQueries({ queryKey: ["new-design", "episodes", seasonId] });
      toast(`Filled in ${out.filled}`);
      setAnswer("");
      onOpenChange(false);
    } catch (e) {
      toast.quiet((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Copy and paste" subtitle="Any AI chat that searches the web">
      <div data-recaps-sheet className="flex flex-col gap-3">
        <Btn wide data-recaps-copy onClick={copy}>
          <Copy className="size-4" aria-hidden />
          Copy the question
        </Btn>
        <textarea
          data-recaps-answer
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Paste its whole answer here"
          rows={6}
          className="w-full rounded-[3px] bg-background p-3 text-[15px] outline-2 -outline-offset-2 outline-border focus:outline-chyron-line"
        />
        <Btn tone="must" wide data-recaps-save disabled={busy || !answer.trim()} onClick={save}>
          {busy ? "Saving…" : "Save"}
        </Btn>
      </div>
    </Sheet>
  );
}

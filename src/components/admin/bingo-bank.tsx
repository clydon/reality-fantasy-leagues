"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, Grid3x3, Layers } from "lucide-react";
import type { AdminBankSquare, AdminBingoBank } from "@/lib/server/bingo-bank";
import { api } from "@/lib/api";
import { fieldCls } from "@/components/setup/settings-ui";
import { AskAi, useElapsed } from "@/components/ask-ai";
import { ActButton, Notice, Row, Rows, Section, Step, count, errorText } from "./admin-ui";
import { cn } from "cn";

// Bingo's bank on the admin episode page (docs/PLAN-bingo-bank.md step 1): what this episode's cards are dealt from (its own bank,
// else the season's, else nothing: no card), each bank's squares, live and dropped with why, and the free paste path to write
// either: copy the prompt into any AI chat with web search and paste its answer back. Or Write squares now: our bot writes them
// and checks each in a second chat (db/bot-research.js's bingo run, step 2), as its schedule does a day before each episode;
// the run and every square it wrote are listed under Bot research. A new bank replaces the old one; a card someone has
// ticked keeps its squares, and every other card is dealt afresh from the new one. Each live square says how many have flagged
// it as unfair (step 4), with Hide: an admin's flag takes it out of new cards at once (Unhide takes the flag back).

type Scope = "episode" | "season";

const LIKELY: Record<AdminBankSquare["likelihood"], string> = { likely: "Likely", maybe: "Maybe", longshot: "Long shot" };

const liveOf = (list: AdminBankSquare[]) => list.filter((s) => s.status === "live").length;

function bankLine(list: AdminBankSquare[], using: boolean, none: string) {
  if (!list.length) return none;
  const live = liveOf(list);
  const out = list.filter((s) => s.status === "live" && s.hidden).length;
  return `${count(live - out, "square")}${out ? `, ${out} flagged out` : ""}${list.length > live ? `, ${list.length - live} dropped` : ""}${using ? " · cards use these" : ""}`;
}

export function BingoBank({ seasonId, episode }: { seasonId: string; episode: number }) {
  const queryClient = useQueryClient();
  const [writing, setWriting] = useState<Scope | null>(null);
  const [showing, setShowing] = useState<Scope | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const scope = writing ?? "episode";
  const key = ["admin-bingo", seasonId, episode, scope];
  // Switching which bank to write keeps the rows as they were while the other prompt loads.
  const { data, error } = useQuery({ queryKey: key, queryFn: () => api.adminBingoBank(seasonId, episode, scope), placeholderData: (prev) => prev });
  // The bot's run, by hand: up to four minutes (it writes, then checks).
  const bot = useMutation({
    mutationFn: (s: Scope) => api.adminBotRunNow(seasonId, episode, "bingo", { scope: s }),
    onMutate: () => setNote(null),
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-bingo", seasonId, episode] });
      await queryClient.invalidateQueries({ queryKey: ["bot-runs", seasonId, episode] });
    },
  });
  const elapsed = useElapsed(bot.isPending, bot.submittedAt);
  const hide = useMutation({
    mutationFn: ({ id, on }: { id: string; on: boolean }) => api.adminFlagBingoSquare(seasonId, episode, scope, id, on),
    onSuccess: (b) => queryClient.setQueryData(key, b),
  });

  const write = (s: Scope) => {
    setNote(null);
    setWriting((w) => (w === s ? null : s));
  };
  const saved = (b: AdminBingoBank & { live: number; dropped: number }) => {
    queryClient.setQueryData(key, b);
    void queryClient.invalidateQueries({ queryKey: ["admin-bingo", seasonId, episode] });
    setNote(`${count(b.live, "square")} saved${b.dropped ? `, ${b.dropped} dropped` : ""}.`);
    setShowing(b.scope);
    setWriting(null);
  };

  const ep = data?.banks.episode ?? [];
  const season = data?.banks.season ?? [];
  const using = data?.using ?? null;
  const loading = !data && !error;
  return (
    <Section title="Bingo" className="mt-2" aside={<span className="pb-1 text-[13px] text-muted-foreground">Written before it airs</span>}>
      <div data-bank-ready={data ? "yes" : undefined}>
        <Rows className={loading ? "animate-pulse" : undefined}>
          <Row
            icon={Grid3x3}
            title="This episode"
            detail={loading ? "Reading its squares…" : bankLine(ep, using === "episode", using === "season" ? "No squares yet · cards use the season's" : "No squares yet · no bingo card until there are some")}
            trailing={
              <span className="flex items-center gap-2" data-bank-row="episode">
                {ep.length > 0 && <ActButton onClick={() => setShowing((v) => (v === "episode" ? null : "episode"))}>{showing === "episode" ? "Close" : "See"}</ActButton>}
                <ActButton tone={!using && writing !== "episode" ? "chyron" : "plain"} onClick={() => write("episode")}>
                  {writing === "episode" ? "Cancel" : ep.length ? "Again" : "Write"}
                </ActButton>
              </span>
            }
          />
          <Row
            icon={Layers}
            title="The season"
            detail={loading ? "Reading its squares…" : bankLine(season, using === "season", "No squares yet · for any episode without its own")}
            trailing={
              <span className="flex items-center gap-2" data-bank-row="season">
                {season.length > 0 && <ActButton onClick={() => setShowing((v) => (v === "season" ? null : "season"))}>{showing === "season" ? "Close" : "See"}</ActButton>}
                <ActButton onClick={() => write("season")}>{writing === "season" ? "Cancel" : season.length ? "Again" : "Write"}</ActButton>
              </span>
            }
          />
        </Rows>
      </div>
      <div className="flex flex-wrap items-center gap-2" data-bank-bot>
        <ActButton disabled={bot.isPending} onClick={() => bot.mutate("episode")}>
          <Bot className="size-[18px]" strokeWidth={2.2} aria-hidden />
          {bot.isPending && bot.variables === "episode" ? `Asking… ${elapsed}s` : "Write squares now"}
        </ActButton>
        <ActButton disabled={bot.isPending} onClick={() => bot.mutate("season")}>
          {bot.isPending && bot.variables === "season" ? `Asking… ${elapsed}s` : "The season's now"}
        </ActButton>
      </div>
      {bot.isPending && <Notice tone="quiet">Our bot asks ChatGPT, then checks each square in a second chat: up to four minutes. Leave this open.</Notice>}
      {bot.isError && <Notice tone="bad">{errorText(bot.error)}</Notice>}
      {bot.data && <Notice tone={bot.data.ok ? "good" : "bad"}>{bot.data.message}</Notice>}
      {error && <Notice tone="bad">{errorText(error, "Couldn't read the squares.")}</Notice>}
      {note && <Notice>{note}</Notice>}
      {writing && <WritePanel seasonId={seasonId} episode={episode} scope={writing} prompt={data?.scope === writing ? data.prompt : undefined} min={data?.min ?? 8} onSaved={saved} />}
      {showing && !writing && <Squares list={showing === "episode" ? ep : season} busy={hide.isPending} onHide={(id, on) => hide.mutate({ id, on })} />}
      {hide.isError && <Notice tone="bad">{errorText(hide.error)}</Notice>}
    </Section>
  );
}

/** What's been said of a square as unfair: who flagged it, and whether that's taken it out of new cards. */
function flagWords(s: AdminBankSquare) {
  if (s.mine) return s.flags > 1 ? `Hidden by you · flagged by ${s.flags - 1} more` : "Hidden by you · out of new cards";
  if (s.hidden) return `Flagged by ${s.flags} · out of new cards`;
  return s.flags ? `Flagged by ${s.flags} as unfair · one more takes it out` : null;
}

/** A bank's squares: the live ones by how likely (each with its flags and Hide), then the dropped ones with why. */
function Squares({ list, busy, onHide }: { list: AdminBankSquare[]; busy: boolean; onHide: (id: string, on: boolean) => void }) {
  return (
    <ul className="flex flex-col" data-bank-squares>
      {list.map((s) => {
        const flags = s.status === "live" ? flagWords(s) : null;
        return (
          <li key={s.id} data-bank-square={s.status} data-hidden={s.hidden ? "yes" : undefined} className="flex items-center gap-3 border-t border-border py-2">
            <span className="min-w-0 flex-1">
              <span className={cn("text-[15px]", (s.status === "dropped" || s.hidden) && "text-muted-foreground line-through")}>{s.label}</span>
              <small className="block text-[13px] text-muted-foreground">
                {LIKELY[s.likelihood]}
                {s.note ? ` · Dropped: ${s.note}` : flags ? ` · ${flags}` : ""}
              </small>
            </span>
            {s.status === "live" && (
              <ActButton disabled={busy} onClick={() => onHide(s.id, !s.mine)} className="min-h-10 px-3 text-[14px]">
                {s.mine ? "Unhide" : "Hide"}
              </ActButton>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** The paste path for one bank: the prompt (Ask ChatGPT for me, or copy it into any chat with web search), then the answer. */
function WritePanel({
  seasonId,
  episode,
  scope,
  prompt,
  min,
  onSaved,
}: {
  seasonId: string;
  episode: number;
  scope: Scope;
  prompt: string | undefined;
  min: number;
  onSaved: (b: AdminBingoBank & { live: number; dropped: number }) => void;
}) {
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      onSaved(await api.adminSaveBingoBank(seasonId, episode, scope, answer));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <ol className="flex flex-col gap-4" data-bank-write={scope}>
      <Step n={1} on={!answer.trim()} label="Ask an AI">
        <span className="text-[13px] text-muted-foreground">
          {scope === "episode" ? `Thirty squares for Episode ${episode}, fitted to it.` : "Thirty squares for any episode of the season, for episodes without their own."}
        </span>
        {!prompt && <span className="text-[13px] text-muted-foreground">Building the prompt…</span>}
        <AskAi prompt={prompt} task={scope === "episode" ? `writing bingo squares for episode ${episode}` : "writing bingo squares for the season"} onAnswer={setAnswer} answered={!!answer.trim()} />
        <span className="text-[13px] text-muted-foreground">Or copy the prompt into any AI chat that can search the web.</span>
      </Step>
      <Step n={2} on={!!answer.trim()} label="Paste the answer">
        <textarea
          aria-label="The chat's answer"
          rows={5}
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Paste the chat's JSON answer. A code fence or a line of chatter around it is fine."
          className={cn(fieldCls, "min-h-[120px] resize-y py-3 font-mono text-sm")}
        />
        {error && <Notice tone="bad">{error}</Notice>}
        <ActButton tone="chyron" disabled={busy || !answer.trim()} onClick={() => void save()} className="min-h-12 self-start">
          {busy ? "Saving…" : "Save squares"}
        </ActButton>
        <span className="text-[13px] text-muted-foreground">Replaces {scope === "episode" ? "this episode's" : "the season's"} squares. Needs at least {min} that pass.</span>
      </Step>
    </ol>
  );
}

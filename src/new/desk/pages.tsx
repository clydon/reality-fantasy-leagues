"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { airTime } from "../clock";
import { NavLink, useNav } from "../nav";
import { paths } from "../routes";
import { Face } from "../show/parts";
import { GuardSheet } from "../ui/guards";
import { Btn, Chip, EmptyState } from "../ui/parts";
import { Sheet } from "../ui/sheet";
import { toast } from "../ui/toast";
import { deskSend, useAfterDesk, useDesk, type DeskCastaway, type DeskCouch, type DeskFact, type DeskLine, type DeskPerson, type DeskSeason, type DeskShow, type SeasonBot } from "./data";
import { DeskHeader, FieldRow, History, ItemRow, LockRow, OverrideSheet, Section, SwitchRow, Tag } from "./parts";

// One thing on the desk (docs/PLAN-new-design.md step 6b part 2; the mock's community.js adminFact and adminEntity): a
// disputed fact's two sides and the admin's decision; a season (its rulebook, its cast by group, its episodes' results);
// a castaway (Override, Lock, History); a couch (who runs its games, Hand it to, who fills in); a person; a show (who added
// it, Looks fine or Archive for one added by name, its seasons and their rulebooks, New season: step 10 part 3).

const Loading = () => <div aria-busy className="mx-4 mt-6 h-64 animate-pulse rounded-[4px] bg-card" />;
const back = { label: "Find", href: paths.desk("find") };

function useAct<T>(path: string) {
  const after = useAfterDesk();
  return async (body: unknown, done: string) => {
    try {
      const out = await deskSend<T>(path, body);
      await after();
      toast(done);
      return out;
    } catch (e) {
      toast((e as Error).message);
      throw e;
    }
  };
}

function NotFound({ error }: { error: unknown }) {
  return <EmptyState title="Not here" line={(error as Error)?.message ?? "It's gone."} />;
}

// ---------- a fact ----------

const STATUS_TAG: Record<string, [string, "must" | "good" | "quiet" | "bad"]> = {
  disputed: ["Disputed", "must"],
  canonical: ["Canonical", "good"],
  removed: ["Removed", "bad"],
  reported: ["1 source", "quiet"],
  confirmed: ["Confirmed", "good"],
};

export function FactPage({ id }: { id: string }) {
  const q = useDesk<DeskFact>(`/facts/${id}`);
  const act = useAct<DeskFact>(`/facts/${id}`);
  const [deciding, setDeciding] = useState<"yes" | "no" | null>(null);
  const [editing, setEditing] = useState(false);
  if (q.error) return <><DeskHeader title="Fact" back={{ label: "Inbox", href: paths.desk() }} /><NotFound error={q.error} /></>;
  if (!q.data) return <><DeskHeader title="Fact" back={{ label: "Inbox", href: paths.desk() }} /><Loading /></>;
  const f = q.data;
  const [tag, tone] = STATUS_TAG[f.status] ?? [f.status, "quiet"];
  return (
    <div className="pb-16" data-desk-fact={f.status}>
      <DeskHeader title="Fact" back={{ label: "Inbox", href: paths.desk() }} />
      <Section>
        <div className="flex min-h-[80px] items-stretch overflow-hidden rounded-[3px] bg-plate text-plate-foreground shadow-plate">
          <Face src={f.photo} name={f.name} className="w-20 flex-none text-2xl" />
          <span className="flex flex-col justify-center gap-1 py-2 pl-3 pr-3">
            <Tag tone={tone}>{tag}</Tag>
            <b className="type-caption text-[19px] leading-tight">
              {[f.name, f.label].filter(Boolean).join(" · ")}
            </b>
            <small className="text-[13px] text-plate-muted">
              {f.season.name} · Episode {f.episode}
              {f.live ? " · in every league" : " · in no league"}
            </small>
          </span>
        </div>
        {f.locked && (
          <p data-decided className="mt-3 flex gap-2 text-[14px] leading-snug text-muted-foreground">
            <Check className="mt-0.5 size-4 flex-none text-good" aria-hidden />
            <span>
              {f.locked.by ? `${f.locked.by} decided` : "An admin decided"}: <b className="text-foreground">{f.live ? "it happened" : "it didn't happen"}</b>
              {f.applied ? " (as overridden)" : ""}. Locked: no answer moves it.
            </span>
          </p>
        )}
      </Section>
      <Section title="Says it happened" aside={f.yes.length}>
        {f.yes.length ? f.yes.map((s, i) => <SourceRow key={i} yes text={`${s.who}${s.couch ? ` · ${s.couch}` : ""}`} line={`${s.source} · ${airTime(Date.parse(s.at))}${s.method ? ` · said "${s.method}"` : ""}`} />) : <p className="text-[14px] text-muted-foreground">{f.community ? "Nobody any more." : "Decided before results were shared: no sources."}</p>}
      </Section>
      <Section title="Says it didn't" aside={f.no.length + f.flags.length}>
        {f.no.map((s, i) => (
          <SourceRow key={`n${i}`} text={`${s.who}${s.couch ? ` · ${s.couch}` : ""}`} line={`${s.source} · ${airTime(Date.parse(s.at))} · answered for them and didn't report it`} />
        ))}
        {f.flags.map((x, i) => (
          <SourceRow key={`f${i}`} text={`${x.who} flagged it`} line={`${x.reason}${x.note ? ` · "${x.note}"` : ""}${x.status !== "open" ? ` · ${x.status}` : ""}`} />
        ))}
        {!f.no.length && !f.flags.length && <p className="text-[14px] text-muted-foreground">Nobody.</p>}
      </Section>
      <Section title="Where it counts">
        <p className="text-[14px] leading-relaxed text-muted-foreground">
          {f.leagues} {f.leagues === 1 ? "league" : "leagues"} on {f.season.name} · {f.rulings ? `${f.rulings} house ${f.rulings === 1 ? "ruling keeps" : "rulings keep"} it whatever you decide · ` : ""}shared stats follow your decision.
        </p>
      </Section>
      <Section>
        <div className="grid grid-cols-2 gap-2">
          <Btn data-decide="yes" onClick={() => setDeciding("yes")}>
            It happened
          </Btn>
          <Btn data-decide="no" onClick={() => setDeciding("no")}>
            It didn&apos;t happen
          </Btn>
        </div>
        {f.kind !== "noexit" && (
          <button type="button" data-edit-fact onClick={() => setEditing(true)} className="mt-1 flex min-h-11 w-full items-center justify-center text-[14px] font-semibold text-muted-foreground">
            Something else: edit the fact
          </button>
        )}
        {f.locked && f.community && (
          <Btn data-reopen wide className="mt-2" onClick={() => act({ reopen: true }, "Reopened · settled again from its sources")}>
            Unlock and reopen
          </Btn>
        )}
      </Section>
      <Section title="History">
        <History lines={f.history} />
      </Section>
      {deciding && (
        <GuardSheet
          open
          onOpenChange={(o) => !o && setDeciding(null)}
          title={deciding === "no" ? "Remove it for everyone?" : "Keep it for everyone?"}
          subtitle="Becomes canonical and locked. Couches with a house ruling keep theirs."
          lines={[
            { face: { kind: "castaway", name: f.name, photo: f.photo }, label: `${[f.name, f.label].filter(Boolean).join(" · ")} · Ep ${f.episode}`, change: deciding === "no" ? "Removed" : "Stays", dir: null },
            { face: { kind: "player", userId: null, name: "Leagues" }, label: `${f.leagues} ${f.leagues === 1 ? "league" : "leagues"}`, change: deciding === "no" ? (f.live ? `Corrected after each reveals Episode ${f.episode}` : "No change") : f.live ? "No change" : "It goes in", dir: null },
            ...(f.flags.some((x) => x.status === "open") ? [{ face: { kind: "player" as const, userId: null, name: "Flags" }, label: "People who flagged it", change: "Answered", dir: null }] : []),
          ]}
          cta={deciding === "no" ? "Remove it" : "Keep it"}
          undoNote="Undo it from History, or unlock and reopen it from this page."
          onConfirm={async () => {
            await act({ decide: deciding }, deciding === "no" ? "Removed for everyone · canonical" : "Kept · canonical");
          }}
        />
      )}
      {editing && <EditFactSheet fact={f} onClose={() => setEditing(false)} onSave={(edit) => act({ edit }, "Overridden · canonical")} />}
    </div>
  );
}

function SourceRow({ yes, text, line }: { yes?: boolean; text: string; line: string }) {
  return (
    <div data-source={yes ? "yes" : "no"} className="flex min-h-[60px] items-center gap-3 border-t border-border py-2 first:border-t-0">
      <span className={`grid size-10 flex-none place-items-center rounded-full ${yes ? "bg-good/20 text-good" : "bg-live/20 text-live"}`}>
        {yes ? <Check className="size-4" strokeWidth={2.6} aria-hidden /> : <X className="size-4" strokeWidth={2.6} aria-hidden />}
      </span>
      <span className="min-w-0 flex-1">
        <b className="block text-[15px] font-semibold">{text}</b>
        <small className="block text-[13px] leading-snug text-muted-foreground">{line}</small>
      </span>
    </div>
  );
}

function EditFactSheet({ fact, onClose, onSave }: { fact: DeskFact; onClose: () => void; onSave: (edit: Record<string, string>) => Promise<unknown> }) {
  const [who, setWho] = useState(fact.name);
  const [method, setMethod] = useState(fact.method);
  const [eventType, setEventType] = useState(fact.eventType);
  const [busy, setBusy] = useState(false);
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} title={`Override · ${fact.name} · Episode ${fact.episode}`} subtitle="Becomes canonical and locked">
      <b className="block text-[15px]">Who</b>
      <select data-edit-who value={who} onChange={(e) => setWho(e.target.value)} className="mt-1.5 h-12 w-full rounded-[3px] bg-background px-3 text-base outline-1 -outline-offset-1 outline-input">
        {fact.choices.cast.map((c) => (
          <option key={c}>{c}</option>
        ))}
      </select>
      {fact.kind === "elimination" && (
        <div className="mt-4">
          <b className="block text-[15px]">How they left</b>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {fact.choices.methods.map((m) => (
              <Chip key={m} on={m === method} onClick={() => setMethod(m)} className="h-11">
                {m}
              </Chip>
            ))}
          </div>
        </div>
      )}
      {fact.kind === "event" && (
        <>
          <b className="mt-4 block text-[15px]">What happened</b>
          <select data-edit-what value={eventType} onChange={(e) => setEventType(e.target.value)} className="mt-1.5 h-12 w-full rounded-[3px] bg-background px-3 text-base outline-1 -outline-offset-1 outline-input">
            {fact.choices.events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.label}
              </option>
            ))}
          </select>
        </>
      )}
      <p className="mt-3 text-[13px] text-muted-foreground">Saved as an admin override: it wins over couch answers and research, and it&apos;s in the history with undo.</p>
      <Btn
        data-edit-save
        tone="must"
        wide
        className="mt-3"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await onSave({ castawayName: who, ...(fact.kind === "elimination" ? { method } : {}), ...(fact.kind === "event" ? { eventType } : {}) });
            onClose();
          } catch {
            setBusy(false);
          }
        }}
      >
        Save override
      </Btn>
    </Sheet>
  );
}

// ---------- a season ----------

type BotRun = SeasonBot["schedule"][number];
const RUN_WORDS: Record<BotRun["kind"], string> = { quick: "Who went home", full: "The full results", schedule: "When the next episode airs" };
const minutes = (m: number) => (m < 60 ? `${m} min` : Number.isInteger(m / 60) ? `${m / 60} h` : `${Math.floor(m / 60)} h ${m % 60} min`);
// The runs a season can switch on: its own, and the usual ones it hasn't got (off until switched on).
const USUAL: BotRun[] = [
  { kind: "quick", after: 5, on: false },
  { kind: "full", after: 60, on: false },
  { kind: "full", after: 540, on: false },
  { kind: "schedule", after: 30, on: false },
];

/**
 * The bot's schedule for a season (step 6c part 2): Autopilot's trial. On or off, each run on or off, and its latest runs.
 * Each change is a line in the season's History with Undo.
 */
function SeasonBotSection({ id, bot }: { id: string; bot: SeasonBot }) {
  const act = useAct<{ bot: SeasonBot }>(`/seasons/${id}`);
  const runs = [...bot.schedule, ...USUAL.filter((u) => !bot.schedule.some((r) => r.kind === u.kind && r.after === u.after) && !(u.kind === "schedule" && bot.schedule.some((r) => r.kind === "schedule")))].sort((a, b) => a.after - b.after);
  const save = (body: { on?: boolean; schedule?: BotRun[] }, done: string) => act({ bot: body }, done).catch(() => undefined);
  // A run of its own is switched on or off in place; a usual one it hasn't got is added, on.
  const flip = (run: BotRun) => {
    const own = bot.schedule.some((r) => r.kind === run.kind && r.after === run.after);
    const schedule = own ? bot.schedule.map((r) => (r.kind === run.kind && r.after === run.after ? { ...r, on: !r.on } : r)) : [...bot.schedule, { ...run, on: true }];
    void save({ schedule }, `${RUN_WORDS[run.kind]} ${run.on ? "off" : "on"} · undo from History`);
  };
  return (
    <Section title="Autopilot trial" aside="Our bot">
      <div data-season-bot className="flex flex-col gap-2">
        <SwitchRow
          data="bot"
          on={bot.on}
          title="The bot's schedule"
          line={
            bot.on
              ? `On: our bot asks after each episode ends (${bot.episodeMinutes ?? 60} min after it starts). Its answers are sources like anyone's.`
              : "Off: the bot asks only when a couch taps One tap. Switch it on to try Autopilot on this season."
          }
          onChange={(on) => save({ on }, on ? "The bot's schedule is on · undo from History" : "The bot's schedule is off · undo from History")}
        />
        {runs.map((r) => (
          <SwitchRow
            key={`${r.kind}@${r.after}`}
            data={`run-${r.kind}@${r.after}`}
            on={r.on}
            disabled={!bot.on}
            title={`${RUN_WORDS[r.kind]} · ${minutes(r.after)} after it ends`}
            line={r.kind === "quick" ? "Free for every couch: keeps whoever runs a game spoiler-safe." : r.kind === "full" ? "Every scoring moment, for every game on the season." : "Moves lineup locks and reminders when the show takes a week off."}
            onChange={() => flip(r)}
          />
        ))}
      </div>
      {bot.recent.length > 0 && (
        <div data-bot-runs className="mt-3">
          <p className="type-caption text-[11px] tracking-[0.06em] text-muted-foreground">Latest runs</p>
          {bot.recent.map((r, i) => (
            <div key={`${r.at}-${i}`} className="flex items-start gap-2 border-t border-border py-2 text-[13px] first:border-t-0">
              <span className={`mt-0.5 flex-none font-bold ${r.ok ? "text-good" : r.ok === false ? "text-chyron-line" : "text-muted-foreground"}`}>{r.ok ? "Done" : r.ok === false ? "Failed" : "Asking"}</span>
              <span className="min-w-0 flex-1 text-muted-foreground">
                Episode {r.episode} · {r.kind === "tiebreak" ? "tie-break" : r.slot === "tap" ? "One tap" : (RUN_WORDS[r.kind as BotRun["kind"]] ?? r.kind).toLowerCase()} · {airTime(Date.parse(r.at))}
                {r.message ? <span className="block truncate">{r.message}</span> : null}
              </span>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

export function SeasonPage({ id }: { id: string }) {
  const q = useDesk<DeskSeason & { bot: SeasonBot; history: DeskLine[] }>(`/seasons/${id}`);
  const act = useAct<{ people: number; leagues: number }>(`/seasons/${id}`);
  const [clearing, setClearing] = useState<{ group: string; preview: { people: number; leagues: number } | null } | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  if (q.error) return <><DeskHeader title="Season" back={back} /><NotFound error={q.error} /></>;
  if (!q.data) return <><DeskHeader title="Season" back={back} /><Loading /></>;
  const s = q.data;
  return (
    <div className="pb-16" data-desk-season>
      <DeskHeader title="Season" back={back} />
      <Section>
        <b className="type-caption block text-[30px] leading-none">{s.name}</b>
        <small className="mt-1 block text-[14px] text-muted-foreground">
          {s.status ?? "Upcoming"} · {s.leagues} {s.leagues === 1 ? "league" : "leagues"} on {s.couches} {s.couches === 1 ? "couch" : "couches"}
        </small>
      </Section>
      {s.rulebook && (
        <Section title="Rulebook">
          <ItemRow
            data="rulebook"
            href={paths.deskItem("rulebook", s.rulebook.id)}
            title={`${s.name}'s rulebook`}
            line={`Version ${s.rulebook.version}${s.rulebook.edited ? " · edited" : ""} · ${s.rulebook.everywhere || s.rulebook.live ? "its leagues play by it" : "its leagues play by the show's rules"}`}
          />
        </Section>
      )}
      <SeasonBotSection id={id} bot={s.bot} />
      <Section title="Cast" aside={`${s.cast.length} people`}>
        {s.groups.length > 0 && (
          <div className="mb-3 flex flex-col gap-2">
            {s.groups.map((g) => (
              <div key={g.name} data-group={g.name} className="flex items-center gap-3 rounded-[4px] bg-card p-3">
                <span className="min-w-0 flex-1">
                  <b className="block text-[15px]">{g.name}</b>
                  <small className="block text-[13px] text-muted-foreground">
                    {g.people} start in it{g.secretRole ? " · named like a secret role: it gives the role away" : ""}
                  </small>
                </span>
                <Btn
                  data-clear-group={g.name}
                  className="h-10 px-3 text-[13px]"
                  onClick={async () => {
                    setClearing({ group: g.name, preview: null });
                    const p = await deskSend<{ people: number; leagues: number }>(`/seasons/${id}`, { clearGroup: g.name, preview: true }).catch(() => null);
                    setClearing({ group: g.name, preview: p });
                  }}
                >
                  Not a group
                </Btn>
              </div>
            ))}
          </div>
        )}
        <div className="grid grid-cols-4 gap-2">
          {s.cast.map((c) => (
            <NavLink key={c.id} href={paths.deskItem("castaway", c.id)} data-castaway={c.name} className="nd-press flex flex-col overflow-hidden rounded-[3px] bg-plate text-plate-foreground">
              <Face src={c.photo} name={c.name} className="aspect-square w-full text-xl" />
              <span className="px-1.5 py-1">
                <b className="type-caption block truncate text-[12px]">{c.name.split(" ")[0]}</b>
                <small className="block truncate text-[11px] text-plate-muted">{c.locked ? "Locked" : (c.group ?? "No group")}</small>
              </span>
            </NavLink>
          ))}
        </div>
      </Section>
      <Section title="Episodes" aside={s.aired ? `${s.aired} aired` : undefined}>
        {s.episodes.length ? (
          s.episodes.map((e) => (
            <div key={e.number} className="border-t border-border first:border-t-0">
              <button type="button" data-episode-facts={e.number} onClick={() => setOpen(open === e.number ? null : e.number)} className="nd-press flex min-h-[56px] w-full items-center gap-3 text-left">
                <span className="type-num w-8 text-[26px] text-muted-foreground">{e.number}</span>
                <span className="min-w-0 flex-1 text-[14px] text-muted-foreground">
                  {e.facts.filter((f) => f.live).length} in the leagues
                  {e.facts.some((f) => f.status === "disputed") ? ` · ${e.facts.filter((f) => f.status === "disputed").length} disputed` : ""}
                  {e.facts.some((f) => f.status === "reported" && f.live) ? ` · ${e.facts.filter((f) => f.status === "reported" && f.live).length} from 1 source` : ""}
                </span>
              </button>
              {open === e.number &&
                e.facts.map((f) => (
                  <ItemRow key={f.id} data="fact" href={paths.deskItem("fact", f.id)} tag={STATUS_TAG[f.status]?.[0] ?? f.status} tone={STATUS_TAG[f.status]?.[1]} title={[f.name, f.label].filter(Boolean).join(" · ")} line={f.live ? "In every league" : "In no league"} />
                ))}
            </div>
          ))
        ) : (
          <p className="text-[14px] text-muted-foreground">No results yet.</p>
        )}
      </Section>
      <Section title="History">
        <History lines={q.data.history} />
      </Section>
      {clearing && (
        <GuardSheet
          open
          onOpenChange={(o) => !o && setClearing(null)}
          title={`Take out ${clearing.group}?`}
          subtitle="A secret role, not a group: off the season's cast and out of every league on it"
          lines={clearing.preview ? [] : null}
          body={
            clearing.preview ? (
              <p data-clear-preview className="rounded-[3px] bg-background p-3 text-[14px] leading-snug">
                {clearing.preview.people} {clearing.preview.people === 1 ? "person starts" : "people start"} in {clearing.group}. {clearing.preview.leagues}{" "}
                {clearing.preview.leagues === 1 ? "league loses it" : "leagues lose it"}: nobody is on it, and no board shows it.
              </p>
            ) : undefined
          }
          cta={`Take out ${clearing.group}`}
          undoNote="Undo it from History: the group goes back on the same people."
          onConfirm={async () => {
            await act({ clearGroup: clearing.group }, `${clearing.group} taken out`);
          }}
        />
      )}
    </div>
  );
}

// ---------- a castaway ----------

export function CastawayPage({ id }: { id: string }) {
  const q = useDesk<DeskCastaway>(`/castaways/${id}`);
  const act = useAct<DeskCastaway>(`/castaways/${id}`);
  const [field, setField] = useState<"name" | "group" | "photo" | null>(null);
  if (q.error) return <><DeskHeader title="Castaway" back={back} /><NotFound error={q.error} /></>;
  if (!q.data) return <><DeskHeader title="Castaway" back={back} /><Loading /></>;
  const c = q.data;
  const values = { name: c.name, group: c.group ?? "", photo: c.photoUrl ?? "" };
  const labels = { name: "Name", group: "Group", photo: "Photo" };
  return (
    <div className="pb-16" data-desk-castaway>
      <DeskHeader title="Castaway" back={{ label: c.season.name, href: paths.deskItem("season", c.season.id) }} />
      <Section>
        <div className="flex items-center gap-3">
          <Face src={c.photo} name={c.name} className="size-[72px] flex-none rounded-[3px] text-2xl" />
          <span>
            <b className="type-caption block text-[26px] leading-none">{c.name}</b>
            <small className="text-[14px] text-muted-foreground">Cast · {c.season.name}</small>
          </span>
        </div>
      </Section>
      <Section>
        <FieldRow data="name" label="Name" value={c.name} onOverride={() => setField("name")} />
        <FieldRow data="group" label="Group" value={c.group ?? "No group"} onOverride={() => setField("group")} />
        <FieldRow data="photo" label="Photo" value={c.photoUrl ? "From the season cast" : "None"} onOverride={() => setField("photo")} />
      </Section>
      <Section>
        <LockRow
          locked={c.locked}
          on="Locked: no commissioner's cast entry changes them; flags still reach you"
          off="Couches can correct them while their cast is being made"
          onChange={(locked) => act({ lock: locked }, locked ? "Locked" : "Unlocked")}
        />
      </Section>
      <Section title="History">
        <History lines={c.history} />
      </Section>
      {field && (
        <OverrideSheet
          open
          onClose={() => setField(null)}
          title={c.name}
          reach={c.reach}
          label={labels[field]}
          value={values[field]}
          choices={field === "group" ? c.groups : undefined}
          onSave={async (value) => {
            await act({ field, value }, "Overridden · in the history with undo");
          }}
        />
      )}
    </div>
  );
}

// ---------- a couch, a person, a show ----------

export function CouchPage({ id }: { id: string }) {
  const q = useDesk<DeskCouch>(`/couches/${id}`);
  const act = useAct<DeskCouch>(`/couches/${id}`);
  const [filling, setFilling] = useState(false);
  if (q.error) return <><DeskHeader title="Couch" back={back} /><NotFound error={q.error} /></>;
  if (!q.data) return <><DeskHeader title="Couch" back={back} /><Loading /></>;
  const c = q.data;
  return (
    <div className="pb-16" data-desk-couch>
      <DeskHeader title="Couch" back={back} />
      <Section>
        <b className="type-caption block text-[30px] leading-none">{c.name}</b>
        <small className="mt-1 block text-[14px] text-muted-foreground">
          {c.members.length} on it · {c.games.length} {c.games.length === 1 ? "game" : "games"}
          {c.rulings ? ` · ${c.rulings} house ${c.rulings === 1 ? "ruling" : "rulings"}` : ""}
        </small>
      </Section>
      {c.stranded.length > 0 && (
        <Section title="Nobody runs it">
          {c.stranded.map((g) => {
            const players = c.games.find((x) => x.leagueId === g.leagueId)?.players ?? [];
            return (
              <div key={g.leagueId} data-stranded={g.leagueId} className="mb-2 rounded-[4px] bg-card p-3.5">
                <b className="block text-[15px]">{g.name}</b>
                <small className="block text-[13px] text-muted-foreground">Hand it to someone who plays it: they become its Commissioner.</small>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {players.map((p) => (
                    <Btn key={p.userId} data-hand={p.name} className="h-10 px-3 text-[14px]" onClick={() => act({ hand: { leagueId: g.leagueId, userId: p.userId } }, `Handed ${g.name} to ${p.name}`)}>
                      Hand it to {p.name}
                    </Btn>
                  ))}
                </div>
              </div>
            );
          })}
        </Section>
      )}
      <Section>
        <FieldRow data="members" label="On the couch" value={c.members.map((m) => `${m.name}${m.role === "owner" ? " (started it)" : ""}`).join(", ") || "Nobody"} />
        {c.games.map((g) => (
          <FieldRow key={g.leagueId} data="game" label={`${g.gameName} · ${g.season}`} value={`${g.name} · run by ${g.runners.join(", ") || "nobody"}`} />
        ))}
        <FieldRow data="fill" label="Who fills in results" value={c.anyone ? "Anyone on the couch" : "Only people who run games"} onOverride={() => setFilling(true)} />
      </Section>
      <Section title="History">
        <History lines={c.history} />
      </Section>
      <Sheet open={filling} onOpenChange={setFilling} title={`Override · ${c.name}`} subtitle="Who can fill in its results">
        <div className="flex flex-col gap-2">
          {([
            [true, "Anyone on the couch"],
            [false, "Only people who run games"],
          ] as const).map(([v, t]) => (
            <button
              key={String(v)}
              type="button"
              data-couch-anyone={String(v)}
              aria-pressed={c.anyone === v}
              onClick={async () => {
                setFilling(false);
                await act({ anyone: v }, `Overridden: ${t.toLowerCase()}`).catch(() => {});
              }}
              className={`nd-press rounded-[3px] p-3.5 text-left ${c.anyone === v ? "outline-2 -outline-offset-2 outline-foreground" : "bg-background"}`}
            >
              <b className="text-[16px]">{t}</b>
            </button>
          ))}
        </div>
      </Sheet>
    </div>
  );
}

export function PersonPage({ id }: { id: string }) {
  const q = useDesk<DeskPerson>(`/people/${id}`);
  if (q.error) return <><DeskHeader title="Person" back={back} /><NotFound error={q.error} /></>;
  if (!q.data) return <><DeskHeader title="Person" back={back} /><Loading /></>;
  const p = q.data;
  return (
    <div className="pb-16" data-desk-person>
      <DeskHeader title="Person" back={back} />
      <Section>
        <b className="type-caption block text-[30px] leading-none">{p.name}</b>
        {p.email && <small className="mt-1 block text-[14px] text-muted-foreground">{p.email}</small>}
      </Section>
      <Section title="Couches">
        {p.couches.length ? p.couches.map((c) => <ItemRow key={c.id} href={paths.deskItem("couch", c.id)} title={c.name} line={c.role === "owner" ? "Started it" : "On it"} />) : <p className="text-[14px] text-muted-foreground">None.</p>}
      </Section>
      <Section title="Games">
        {p.games.length ? p.games.map((g) => <FieldRow key={g.leagueId} label={g.role === "commissioner" ? "Runs it" : g.role === "admin" ? "Game admin" : "Plays"} value={g.name} />) : <p className="text-[14px] text-muted-foreground">None.</p>}
      </Section>
    </div>
  );
}

export function ShowPage({ id }: { id: string }) {
  const q = useDesk<DeskShow>(`/shows/${id}`);
  const act = useAct<DeskShow & { seasonId?: string }>(`/shows/${id}`);
  const nav = useNav();
  if (q.error) return <><DeskHeader title="Show" back={back} /><NotFound error={q.error} /></>;
  if (!q.data) return <><DeskHeader title="Show" back={back} /><Loading /></>;
  const s = q.data;
  const byName = !!s.added && !s.added.listing;
  const newSeason = async () => {
    const out = await act({ action: "season" }, s.setUp ? "Added: it plays by last season's rulebook" : "Added a season");
    const made = out.seasons.find((x) => x.id === out.seasonId);
    if (!out.seasonId) return;
    if (out.setUp && made?.rulebookId) nav.push(paths.deskItem("rulebook", made.rulebookId));
    else nav.push(paths.deskNew(out.seasonId));
  };
  return (
    <div className="pb-16" data-desk-show={s.setUp ? "game" : "watching"}>
      <DeskHeader title="Show" back={back} />
      <Section>
        <b className="type-caption block text-[30px] leading-none">{s.name}</b>
        <small className="mt-1 block text-[14px] text-muted-foreground">
          {s.setUp ? `A game · ${s.kind ?? "competition"}` : "Not a game yet"}
          {s.archived ? " · archived" : ""}
          {s.added ? ` · added by ${s.added.by ?? "someone"} ${s.added.listing ? "from the TV listings" : "by name"}` : ""}
        </small>
      </Section>
      {byName && !s.reviewed && !s.archived && (
        <Section>
          <div data-show-review className="rounded-[4px] bg-card p-3.5">
            <Tag tone="must">Look it over</Tag>
            <b className="mt-2 block text-[16px]">Added by name: not in the TV listings</b>
            <small className="block text-[13px] leading-snug text-muted-foreground">
              It&apos;s in everyone&apos;s search with no schedule. Keep it if it&apos;s a real show; archive it if it isn&apos;t (anyone following it keeps it).
            </small>
            <div className="mt-2.5 flex gap-2">
              <Btn data-show-fine tone="must" className="h-11 flex-1 text-[15px]" onClick={() => act({ action: "reviewed" }, "Looks fine")}>
                Looks fine
              </Btn>
              <Btn data-show-archive className="h-11 flex-1 text-[15px]" onClick={() => act({ action: "archive" }, "Archived: out of everyone's search")}>
                Archive it
              </Btn>
            </div>
          </div>
        </Section>
      )}
      <Section title="Seasons" aside={s.seasons.length}>
        {s.seasons.map((x) => (
          <ItemRow
            key={x.id}
            data="season"
            href={s.setUp ? paths.deskItem("season", x.id) : paths.deskNew(x.id)}
            title={x.name}
            line={`${x.status ?? "Upcoming"}${s.setUp ? (x.rulebookId ? " · has its rulebook" : "") : " · set it up"}`}
          />
        ))}
        <Btn data-show-new-season wide className="mt-3" onClick={newSeason}>
          New season {Math.max(0, ...s.seasons.map((x) => x.number)) + 1}
        </Btn>
        {!s.setUp && (
          <p className="mt-2 text-[13px] leading-snug text-muted-foreground">Not a game yet: tap a season to set it up (anyone can, from its Make it a game, too).</p>
        )}
      </Section>
      <Section title="History">
        <History lines={s.history} emptyLine="Nothing changed here yet." />
      </Section>
    </div>
  );
}

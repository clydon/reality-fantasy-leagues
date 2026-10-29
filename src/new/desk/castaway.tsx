"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Trophy, Users } from "lucide-react";
import { useNav } from "../nav";
import { paths } from "../routes";
import { Face } from "../show/parts";
import { HoldSheet } from "../ui/guards";
import { Btn, EmptyState } from "../ui/parts";
import { Sheet } from "../ui/sheet";
import { toast } from "../ui/toast";
import { deskSend, useAfterDesk, useDesk, type DeskCastaway } from "./data";
import { DeleteRow, DeskHeader, DeskRow, Facts, Field, FieldRow, IconLead, LatestHistory, LockRow, LowerThird, Section, useChangeToast } from "./parts";

// A castaway's page under its season's Cast (docs/PLAN-desk-parity.md step 5, part 5b; the mock's desk-cast.js csPersonPage,
// csEdit and csRemove): their photo in the lower third (Still in, Out, New), how many teams have them, Part of (the cast), Name,
// Photo (a link, No photo, or Look on TMDB and TVmaze) and Starting group, each with Override reaching every game on the season
// (tier 1, Undo), Lock, History, and Remove <name> from the cast, last: refused while a team, pick, result or call has them
// (their games listed, Override their name offered), otherwise a hold (out of the cast and every game). The old
// /desk/castaway/<id> sends here. Server: src/lib/server/desk-cast.ts.

const NOTE = "mt-2.5 text-[13px] leading-snug text-muted-foreground";
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const Loading = () => <div aria-busy className="mx-4 mt-6 h-64 animate-pulse rounded-[4px] bg-card" />;

type Field = "name" | "photo" | "group";
type Changed = DeskCastaway & { changeId: string; text: string };

/** /desk/castaway/<id>, the page's old address: on to its place under the season's Cast. */
export function OldCastawayPage({ id }: { id: string }) {
  const q = useDesk<DeskCastaway>(`/castaways/${id}`);
  const router = useRouter();
  const season = q.data?.season.id;
  useEffect(() => {
    if (season) router.replace(paths.deskCastaway(season, id));
  }, [season, id, router]);
  const back = { label: "Find", href: paths.desk("find") };
  if (q.error)
    return (
      <>
        <DeskHeader title="Castaway" back={back} name={null} />
        <EmptyState title="Not here" line={(q.error as Error).message} />
      </>
    );
  return (
    <>
      <DeskHeader title="Castaway" back={back} name={null} />
      <Loading />
    </>
  );
}

export function CastawayPage({ seasonId, id }: { seasonId: string; id: string }) {
  const path = `/castaways/${id}`;
  // Removed: its read stops, so nothing asks for someone who isn't there any more.
  const [gone, setGone] = useState(false);
  const q = useDesk<DeskCastaway>(gone ? null : path);
  const after = useAfterDesk();
  const changed = useChangeToast();
  const nav = useNav();
  const [sheet, setSheet] = useState<Field | "remove" | null>(null);
  const router = useRouter();
  // A link with the wrong season (an old or edited one): on to their own season's page.
  const theirs = q.data?.season.id;
  const wrong = !!theirs && theirs !== seasonId;
  useEffect(() => {
    if (wrong) router.replace(paths.deskCastaway(theirs!, id));
  }, [wrong, theirs, id, router]);
  const castPath = paths.deskSeasonPage(seasonId, "cast");
  const back = { label: "Cast", href: castPath };
  if (q.error)
    return (
      <>
        <DeskHeader title="Castaway" back={back} name={null} />
        <EmptyState title="Not here" line={(q.error as Error).message} />
      </>
    );
  if (!q.data || wrong)
    return (
      <>
        <DeskHeader title="Castaway" back={back} name={null} />
        <Loading />
      </>
    );
  const c = q.data;
  const T = c.terms;
  const close = () => setSheet(null);
  /** An Override or the Lock: the page as it is now, and the toast's Undo. */
  const write = async (body: Record<string, unknown>) => {
    const r = await deskSend<Changed>(path, body);
    await after();
    changed(r.text, r.changeId);
  };
  const groupValue = c.groupSecret ? "Hidden: named like a secret role" : (c.group ?? `No ${T.group}`);
  return (
    <div className="pb-16" data-desk-castaway={c.tag}>
      <DeskHeader title={cap(T.person)} back={back} name={c.first} kind="Castaway" />
      <LowerThird
        lead={<Face src={c.photo} name={c.name} className="size-16 flex-none rounded-[3px] text-2xl shadow-plate" />}
        tag={c.tag}
        tone={c.tag === "New" ? "stopped" : "quiet"}
        title={c.first}
        detail={c.detail}
      />
      <Facts>{c.meta}</Facts>
      <Section title="Part of">
        <DeskRow data="part-of" href={castPath} lead={<IconLead icon={Users} />} title={`${c.season.name}'s cast`} line={plural(c.castSize, T.person, T.people)} />
      </Section>
      <Section title="About them">
        <FieldRow data="name" label="Name" value={c.name} onOverride={() => setSheet("name")} />
        <FieldRow data="photo" label="Photo" value={c.photoFrom} onOverride={() => setSheet("photo")} />
        <FieldRow data="group" label={`Starting ${T.group}`} value={groupValue} onOverride={() => setSheet("group")} />
        <p className={`${NOTE} border-t border-border pt-3`}>
          Each change reaches {c.games > 1 ? `all ${plural(c.games, "game")}` : c.games ? "its game" : "every game"} on {c.season.name}, with a line in History and Undo.
        </p>
      </Section>
      <Section>
        <LockRow
          locked={c.locked}
          on="Locked: no answer or commissioner changes them"
          off="Answers and commissioners can correct them"
          onChange={(locked) => void write({ lock: locked }).catch((e) => toast.quiet((e as Error).message))}
        />
      </Section>
      <LatestHistory lines={c.history} />
      <DeleteRow data="castaway" title={`Remove ${c.first} from the cast`} line={c.remove.line} onClick={() => setSheet("remove")} />

      {/* Mounted while open: each opens with what they have now. */}
      {sheet === "name" && <NameSheet open onClose={close} c={c} onSave={(value) => write({ field: "name", value })} />}
      {sheet === "photo" && <PhotoSheet open onClose={close} c={c} path={path} onSave={(value) => write({ field: "photo", value })} />}
      {sheet === "group" && <GroupSheet open onClose={close} c={c} onSave={(value) => write({ field: "group", value })} />}
      {!c.remove.ok && (
        <Sheet open={sheet === "remove"} onOpenChange={(o) => !o && close()} title={`${c.first} stays in the cast`} subtitle="Remove is for someone listed by mistake">
          <div data-remove-refused>
            <p className="rounded-[3px] bg-background p-3.5 text-[16px] leading-snug">{c.remove.why}</p>
            {c.remove.games.length > 0 && (
              <>
                <div className="mt-4 mb-1 flex items-baseline justify-between gap-3">
                  <h3 className="type-caption text-[17px] text-muted-foreground">{c.remove.games.some((g) => g.teams) ? "Their teams" : "Their games"}</h3>
                  <span className="text-[13px] text-muted-foreground">{plural(c.remove.games.length, "game")}</span>
                </div>
                <div className="border-b border-border">
                  {c.remove.games.map((g) => (
                    <DeskRow key={g.id} data={`their-game-${g.id}`} lead={<IconLead icon={Trophy} />} title={g.name} line={[c.season.name, g.couch].filter(Boolean).join(" · ")} />
                  ))}
                </div>
              </>
            )}
            <Btn data-remove-rename wide className="mt-4" onClick={() => setSheet("name")}>
              Override their name
            </Btn>
          </div>
        </Sheet>
      )}
      {c.remove.ok && (
        <HoldSheet
          open={sheet === "remove"}
          onOpenChange={(o) => !o && close()}
          title={`Remove ${c.first} from the cast?`}
          subtitle="This can't be undone"
          consequence={null}
          body={
            <ul data-remove-cons className="flex flex-col gap-3 rounded-[3px] bg-background p-3.5 text-[16px] leading-snug">
              <li className="flex gap-3">
                <i className="mt-2 size-2 flex-none rounded-[1px] bg-live" aria-hidden />
                <span>
                  {c.name} comes out of {c.season.name}&apos;s cast and out of {c.games > 1 ? `all ${plural(c.games, "game")}` : c.games ? "its game" : "every game made on it"}: nobody has them, so no
                  team or pick changes.
                </span>
              </li>
              <li className="flex gap-3">
                <i className="mt-2 size-2 flex-none rounded-[1px] bg-live" aria-hidden />
                <span>An answer that lists them would bring them back as someone new.</span>
              </li>
            </ul>
          }
          cta={`remove ${c.first}`}
          restore="Can't be undone"
          onConfirm={async () => {
            const r = await deskSend<{ seasonId: string; text: string }>(path, { remove: true });
            setGone(true);
            nav.push(castPath);
            // Once this page has let go of their read: the Cast page without them.
            setTimeout(() => {
              void after();
              toast(r.text);
            }, 150);
          }}
        />
      )}
    </div>
  );
}

/** Save in a sheet: busy while it saves, the problem under it if refused. */
function useSave(onClose: () => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, setError, run };
}

/** Override · name: every game renames them. */
function NameSheet({ open, onClose, c, onSave }: { open: boolean; onClose: () => void; c: DeskCastaway; onSave: (v: string) => Promise<void> }) {
  const [name, setName] = useState(c.name);
  const s = useSave(onClose);
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title="Override · name" subtitle={c.reach}>
      <Field data="cast-name" data-override-input="" label="Name" value={name} onChange={(e) => setName(e.target.value)} error={s.error} />
      <p className={NOTE}>An answer that spells it another way comes back as a change to look at, unless they&apos;re locked.</p>
      <Btn
        data-override-save
        tone="must"
        wide
        className="mt-3.5"
        disabled={s.busy}
        onClick={() => {
          const v = name.trim();
          if (!v) return s.setError("A name can't be blank.");
          if (v === c.name) return onClose();
          void s.run(() => onSave(v));
        }}
      >
        Save
      </Btn>
    </Sheet>
  );
}

/** Override · photo: a link, No photo, or Look on TMDB and TVmaze (the season's credits) to fill the link. */
function PhotoSheet({ open, onClose, c, path, onSave }: { open: boolean; onClose: () => void; c: DeskCastaway; path: string; onSave: (v: string) => Promise<void> }) {
  const [link, setLink] = useState("");
  const [looking, setLooking] = useState(false);
  const s = useSave(onClose);
  const look = async () => {
    setLooking(true);
    try {
      const r = await deskSend<{ photo: string | null; from: string | null; same: boolean }>(path, { look: true });
      if (!r.photo) toast("Neither TMDB nor TVmaze has a photo of them");
      else if (r.same) toast(`${r.from} has one for them: the one they have`);
      else {
        setLink(r.photo);
        toast(`${r.from} has one for them: Save to use it`);
      }
    } catch (e) {
      toast.quiet((e as Error).message);
    } finally {
      setLooking(false);
    }
  };
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title="Override · photo" subtitle={c.reach}>
      {c.photo && (
        <div data-photo-now className="mb-3.5 flex items-center gap-3.5 rounded-[3px] bg-background p-3">
          <Face src={c.photo} name={c.name} className="size-[72px] flex-none rounded-[3px]" />
          <span className="text-[15px] leading-snug">{c.photoFrom}. A link replaces it.</span>
        </div>
      )}
      <Field data="cast-photo" label="A link to the photo" type="url" inputMode="url" placeholder="https://" value={link} onChange={(e) => setLink(e.target.value)} error={s.error} />
      <button type="button" data-photo-look disabled={looking} onClick={() => void look()} className="nd-press mt-3 h-11 text-[16px] font-bold underline decoration-1 underline-offset-4 disabled:opacity-60">
        {looking ? "Looking…" : "Look on TMDB and TVmaze"}
      </button>
      <div className="mt-1.5 grid grid-cols-2 gap-2">
        <Btn data-photo-none disabled={s.busy || !c.photoUrl} onClick={() => void s.run(() => onSave(""))}>
          No photo
        </Btn>
        <Btn
          data-photo-save
          tone="must"
          disabled={s.busy}
          onClick={() => {
            const v = link.trim();
            if (!v) return onClose();
            if (!/^https?:\/\/\S+$/i.test(v)) return s.setError("That isn't a link. It starts https://");
            void s.run(() => onSave(v));
          }}
        >
          Save
        </Btn>
      </div>
    </Sheet>
  );
}

/** Override · starting group: one of the season's, or none. A secret-role group is shown as Hidden. */
function GroupSheet({ open, onClose, c, onSave }: { open: boolean; onClose: () => void; c: DeskCastaway; onSave: (v: string) => Promise<void> }) {
  const [g, setG] = useState<string | null>(c.group);
  const s = useSave(onClose);
  const T = c.terms;
  const opts: [string | null, string, string | null][] = [...c.groups.map((x): [string, string, string | null] => [x.name, x.secret ? "Hidden" : x.name, x.color]), [null, `No ${T.group}`, null]];
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title={`Override · starting ${T.group}`} subtitle={c.reach}>
      <div data-group-pick className="flex flex-wrap gap-2">
        {opts.map(([v, label, color], i) => (
          <button
            key={v ?? `none-${i}`}
            type="button"
            data-pick-group={v ?? ""}
            aria-pressed={g === v}
            onClick={() => setG(v)}
            className={`nd-press flex h-11 items-center gap-2 rounded-[3px] px-3.5 text-[15px] font-bold ${g === v ? "bg-foreground text-background" : "bg-background outline-1 -outline-offset-1 outline-input"}`}
          >
            {color && <i className="size-3 rounded-[2px]" style={{ background: color }} aria-hidden />}
            {label}
          </button>
        ))}
      </div>
      <p className={NOTE}>The {T.group} they started in. A swap&apos;s come from results.</p>
      {s.error && (
        <p role="alert" className="mt-2 text-[13px] text-live">
          {s.error}
        </p>
      )}
      <Btn data-group-save tone="must" wide className="mt-3.5" disabled={s.busy} onClick={() => (g === c.group ? onClose() : void s.run(() => onSave(g ?? "")))}>
        Save
      </Btn>
    </Sheet>
  );
}

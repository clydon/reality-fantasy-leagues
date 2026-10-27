"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Btn } from "../ui/parts";
import { Sheet } from "../ui/sheet";
import { useDesk, type DeskShow } from "./data";
import { Section, SwitchRow } from "./parts";

// A show's art on the desk (docs/RESEARCH-show-art-and-cast-photos.md; src/lib/server/show-art.ts). Mostly the finder's job:
// this shows what it found, lets an admin look again, choose by hand (Choose art: TMDB's images, by where they show), go back
// to automatic, or switch art and found photos off for the show (a removal request). Logos are found and kept but not offered:
// nothing draws one yet.

interface Choice {
  kind: "poster" | "backdrop" | "logo";
  url: string;
  thumb: string;
  lang: string | null;
}
interface Choices {
  tmdb: boolean;
  linked: boolean;
  show: Choice[];
  season: Choice[];
}

type Act = (body: unknown, done: string) => Promise<unknown>;

function where(a: DeskShow["art"]) {
  if (a.off) return "Off for this show: no art, and the cast's found photos are down.";
  if (!a.poster && !a.backdrop) return a.tmdb ? (a.checkedAt ? "TMDB has nothing for it yet." : "Not looked for yet.") : "None yet. TMDB isn't set up (TMDB_READ_TOKEN).";
  return a.byHand ? "Chosen by hand." : "Found on its own (TMDB, else TVmaze).";
}

export function ArtSection({ show, act }: { show: DeskShow; act: Act }) {
  const [choosing, setChoosing] = useState(false);
  const [busy, setBusy] = useState(false);
  const a = show.art;
  const run = async (body: unknown, done: string) => {
    setBusy(true);
    try {
      await act(body, done);
    } catch {
      /* act toasts it */
    } finally {
      setBusy(false);
    }
  };
  return (
    <Section title="Art">
      <div data-desk-art className="flex gap-2.5">
        <Frame label="Header" url={a.off ? null : a.backdrop} wide />
        <Frame label="Cards" url={a.off ? null : (a.seasons[0]?.poster ?? a.poster)} />
      </div>
      <p className="mt-2 text-[13px] leading-snug text-muted-foreground">{where(a)}</p>
      {!a.off && (
        <div className="mt-3 flex gap-2">
          <Btn data-art-choose className="h-11 flex-1 text-[15px]" disabled={!a.tmdb || busy} onClick={() => setChoosing(true)}>
            Choose art
          </Btn>
          <Btn data-art-find className="h-11 flex-1 text-[15px]" disabled={busy} onClick={() => run({ action: "findArt" }, "Looked again")}>
            {busy ? "Looking…" : "Find art and photos"}
          </Btn>
        </div>
      )}
      <div className="mt-2.5">
        <SwitchRow
          data="art-off"
          on={a.off}
          disabled={busy}
          title="No art or photos"
          line="For a removal request: takes down this show's art and the cast photos found for it, and stops looking."
          onChange={(off) => run({ action: "artOff", off }, off ? "Art and found photos are down" : "Art and photos back on")}
        />
      </div>
      {choosing && <ChooseArt show={show} act={act} onClose={() => setChoosing(false)} />}
    </Section>
  );
}

function Frame({ label, url, wide }: { label: string; url: string | null; wide?: boolean }) {
  return (
    <figure className={wide ? "min-w-0 flex-[1.6]" : "w-[76px] flex-none"}>
      <span className={`block overflow-hidden rounded-[3px] bg-card ${wide ? "aspect-video" : "aspect-[2/3]"}`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- TMDB's and TVmaze's image hosts */}
        {url && <img src={url} alt="" className="size-full object-cover" />}
      </span>
      <figcaption className="mt-1 text-[12px] font-semibold text-muted-foreground">{label}</figcaption>
    </figure>
  );
}

function ChooseArt({ show, act, onClose }: { show: DeskShow; act: Act; onClose: () => void }) {
  const season = show.seasons[0] ?? null;
  const q = useDesk<Choices>(`/shows/${show.id}/art${season ? `?season=${season.id}` : ""}`);
  const a = show.art;
  const seasonPoster = a.seasons.find((x) => x.id === season?.id)?.poster ?? null;
  const pick = (body: Record<string, unknown>, done: string) => act({ action: "chooseArt", ...body }, done).catch(() => {});
  const c = q.data;
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} title="Choose art" subtitle={`${show.name} · from TMDB`}>
      {!c ? (
        <div aria-busy className="h-48 animate-pulse rounded-[4px] bg-card" />
      ) : !c.linked ? (
        <p className="text-[15px] leading-snug text-muted-foreground">TMDB doesn&apos;t know this show, so there&apos;s nothing to choose from.</p>
      ) : (
        <div data-choose-art className="flex flex-col gap-5">
          <Group title="Header" line="Wide, behind the show's name. Ones without words look best.">
            <div className="grid grid-cols-2 gap-2">
              {c.show.filter((x) => x.kind === "backdrop").map((x) => (
                <Pick key={x.url} choice={x} on={a.backdrop === x.url} wide onPick={() => pick({ backdrop: x.url }, "The header's image is chosen")} />
              ))}
            </div>
          </Group>
          {season && c.season.length > 0 && (
            <Group title={`Cards · ${season.name}`} line="This season's own poster, on its cards and tiles.">
              <div className="grid grid-cols-3 gap-2">
                {c.season.map((x) => (
                  <Pick key={x.url} choice={x} on={seasonPoster === x.url} onPick={() => pick({ seasonId: season.id, seasonPoster: x.url }, "The season's poster is chosen")} />
                ))}
              </div>
            </Group>
          )}
          <Group title="Cards · every season" line="The show's poster, for a season without its own.">
            <div className="grid grid-cols-3 gap-2">
              {c.show.filter((x) => x.kind === "poster").map((x) => (
                <Pick key={x.url} choice={x} on={a.poster === x.url} onPick={() => pick({ poster: x.url }, "The show's poster is chosen")} />
              ))}
            </div>
          </Group>
          <Btn
            data-art-automatic
            wide
            disabled={!a.byHand && !a.seasons.some((x) => x.byHand)}
            onClick={() => act({ action: "artAutomatic" }, "Back to automatic").then(onClose, () => {})}
          >
            Back to automatic
          </Btn>
        </div>
      )}
    </Sheet>
  );
}

function Group({ title, line, children }: { title: string; line: string; children: React.ReactNode }) {
  return (
    <section>
      <b className="block text-[16px]">{title}</b>
      <small className="mb-2 block text-[13px] leading-snug text-muted-foreground">{line}</small>
      {children}
    </section>
  );
}

function Pick({ choice, on, wide, onPick }: { choice: Choice; on: boolean; wide?: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      data-art-pick={choice.kind}
      onClick={onPick}
      className={`nd-press relative block overflow-hidden rounded-[3px] bg-card ${wide ? "aspect-video" : "aspect-[2/3]"} ${
        on ? "outline-2 outline-offset-2 outline-foreground" : ""
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- TMDB's image host */}
      <img src={choice.thumb} alt={choice.lang ? "With words" : "No words"} loading="lazy" className="size-full object-cover" />
      {on && (
        <span className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-foreground text-background">
          <Check className="size-4" aria-hidden />
        </span>
      )}
    </button>
  );
}

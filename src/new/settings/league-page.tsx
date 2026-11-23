"use client";

// A league's settings for you (docs/design-round/league-art-spec.md, -first-view.md and -check.md; the user, 2026-11-23: "Allow this
// to be set by user in settings", the gear they chose over a picture icon, then "per user but me as the admin can set it for
// everyone… everyone in my couch sees art without action on their end, if they want to change it they can", and uploads): the page
// behind the gear on the league's bar (settings Round 0's "one gear on every bar", as a show's), pushed over the league
// (`?page=you`). One section for now, Art. Each choice is your own band, as Your shows will show it, in that art, so you choose by
// seeing the result: the couch's pick when it's someone's picture (choosing it follows the couch), your own picture, then the app's
// photos (league-art.ts). The one in use is ringed and says so, and whose pick it is when it's the couch's. A tap saves at once, with
// Undo. Under them, your own picture: upload, replace or remove (removing asks first: Undo can't bring it back).

import { useRef, useState } from "react";
import { ImageUp } from "lucide-react";
import { useCouchHub, useCurrentCouch, useHome, useLeagueArt, useLeagueArtActions, type Home } from "../data";
import { LeagueCard, useLeagueCards, type LeagueCardData } from "../hub/league-cards";
import { useNow } from "../sports/scores";
import { usePushedPage, PushedPage } from "../ui/page";
import { Btn } from "../ui/parts";
import { toast } from "../ui/toast";
import { PageSection, ResetLink } from "./controls";
import type { LeagueNow } from "@/lib/sports/league-now";
import { artFor, artInUse, pictureArt, rulerOf, UPLOAD, type LeagueArt } from "@/lib/sports/league-art";

const KEY = "you";

/** Opening this page (`?page=you` over the league). */
export function useLeagueSettings() {
  return usePushedPage(KEY);
}

export function LeagueSettingsPage({ league, name, now }: { league: string; name: string; now: LeagueNow | null }) {
  const page = useLeagueSettings();
  const { data: home } = useHome();
  return (
    <PushedPage open={page.open} onClose={page.close} title="Your settings" back={name}>
      <div data-league-settings={league} className="pb-12">
        {page.open && home && <ArtSection home={home} league={league} name={name} now={now} />}
      </div>
    </PushedPage>
  );
}

/** A picture made ready in the browser: the middle 16:9 of it, 1280 by 720 at most, as a JPEG (~100-250 KB). Drawing it again leaves
 *  its metadata (a phone photo's place and time) behind. */
async function widePicture(file: File): Promise<Blob> {
  const fail = () => new Error("Couldn't read that picture. Try another.");
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const [w, h] = [img.naturalWidth, img.naturalHeight];
    if (!w || !h) throw fail();
    // The widest 16:9 that fits, from the middle.
    const [cw, ch] = w / h > 16 / 9 ? [Math.round((h * 16) / 9), h] : [w, Math.round((w * 9) / 16)];
    const scale = Math.min(1, 1280 / cw);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(cw * scale);
    canvas.height = Math.round(ch * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw fail();
    ctx.drawImage(img, (w - cw) / 2, (h - ch) / 2, cw, ch, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(fail())), "image/jpeg", 0.82));
  } catch (e) {
    throw e instanceof Error && e.message.startsWith("Couldn't") ? e : fail();
  } finally {
    URL.revokeObjectURL(url);
  }
}

interface Choice {
  key: string;
  art: LeagueArt;
  /** What a tap saves: an art's id, UPLOAD, or null (follow the couch). */
  value: string | null;
  /** "Riley's pick for the couch", under the one the couch wears. */
  note: string | null;
}

function ArtSection({ home, league, name, now }: { home: Home; league: string; name: string; now: LeagueNow | null }) {
  const couch = useCurrentCouch(home);
  const couchId = couch?.id ?? null;
  const { data: hub } = useCouchHub(couchId);
  const cards = useLeagueCards(home, couch, hub);
  const state = useLeagueArt(couchId).data;
  const act = useLeagueArtActions(couchId);
  const today = new Date(useNow()).toLocaleDateString("en-CA");
  const [busy, setBusy] = useState<"choose" | "upload" | "remove" | null>(null);
  const [removing, setRemoving] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const me = home.user;

  const inUse = artInUse(league, state, me);
  const mine = state?.mine[league] ?? null;
  const myPicture = state?.pictures[league] ?? null;
  const theirs = state?.couch[league] && state.couch[league].by !== me.id ? state.couch[league] : null;
  const pickNote = theirs ? `${theirs.name}'s pick for the couch` : null;

  // Your band as Your shows has it; a league not on Your shows (opened from search) still shows its own name and season.
  const own = cards?.find((c) => c.league === league);
  const card: LeagueCardData | null =
    own ?? (cards ? { league, name, seasons: [], now, teams: [], line: null, due: false, plays: false, best: null, solo: !couch, at: Infinity, art: inUse.art, ruler: rulerOf(now, today) } : null);

  const choices: Choice[] = [
    // The couch's pick when it's someone's own picture: choosing it is following the couch (your choice cleared).
    ...(theirs?.art === UPLOAD && theirs.picture ? [{ key: "couch", art: pictureArt(league, theirs.by, theirs.picture, `${theirs.name}'s picture`), value: null, note: pickNote }] : []),
    ...(myPicture ? [{ key: "mine", art: pictureArt(league, me.id, myPicture, "Your picture"), value: UPLOAD, note: null }] : []),
    ...artFor(league).map((a) => ({ key: a.id, art: a, value: a.id, note: theirs?.art === a.id ? pickNote : null })),
  ];

  const pick = async (c: Choice) => {
    if (c.art.id === inUse.art.id || busy) return;
    // Undo puts back exactly what was set: a choice, or none (following the couch, else the league's own).
    const was = mine;
    setBusy("choose");
    try {
      await act.choose(league, c.value);
      toast(`${name}: ${c.art.name}`, { undo: () => void act.choose(league, was).catch((e) => toast.quiet((e as Error).message)) });
    } catch (e) {
      toast.quiet((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const upload = async (f: File | undefined) => {
    if (!f || busy) return;
    const was = mine;
    setBusy("upload");
    try {
      await act.upload(league, await widePicture(f));
      toast(`${name}: your picture`, { undo: () => void act.choose(league, was).catch((e) => toast.quiet((e as Error).message)) });
    } catch (e) {
      toast.quiet((e as Error).message);
    } finally {
      setBusy(null);
      if (file.current) file.current.value = "";
    }
  };

  const remove = async () => {
    setBusy("remove");
    try {
      await act.remove(league);
      setRemoving(false);
      toast(`${name}: your picture removed`);
    } catch (e) {
      toast.quiet((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  // Whose choice the couch sees, in words: the couch's pick you're seeing, yours that the couch sees, or yours alone.
  const reach = !couch
    ? "Only you see it."
    : inUse.from === "couch"
      ? `You're seeing ${inUse.by!.name}'s pick for the couch until you choose.`
      : state?.couch[league]?.by === me.id
        ? `Everyone on ${couch.name} who hasn't chosen sees yours too.`
        : "Only you see your choice.";

  return (
    <>
      <PageSection title="Art" line={`On your ${name} band in Your shows and at the top of the league's page. ${reach}`} data="league-art">
        <div role="group" aria-label={`Art for ${name}`} className="mt-3 flex flex-col gap-4">
          {choices.map((c) => {
            const on = c.art.id === inUse.art.id;
            return (
              <button
                key={c.key}
                type="button"
                aria-pressed={on}
                aria-label={[c.art.name, c.note, on ? "in use" : null].filter(Boolean).join(", ")}
                data-art-choice={c.key}
                data-on={on || undefined}
                disabled={!card || !!busy}
                onClick={() => void pick(c)}
                className="nd-press group block w-full rounded-[4px] text-left focus-visible:outline-2 focus-visible:outline-offset-[5px] focus-visible:outline-foreground"
              >
                {/* Your band in this art: what you pick is what Your shows will show. The one in use ringed (white, never the yellow:
                    this is a value, not "now"). */}
                <span aria-hidden className={`block rounded-[4px] ${on ? "outline-2 outline-offset-2 outline-foreground" : ""}`} data-league-settings-band={on || undefined}>
                  {card ? <LeagueCard card={{ ...card, art: c.art }} preview /> : <span className="block h-[126px] rounded-[4px] bg-card" />}
                </span>
                <span aria-hidden className="mt-2 flex min-h-6 flex-wrap items-center gap-x-2 gap-y-1">
                  <b className="truncate text-[15px] font-semibold">{c.art.name}</b>
                  {on && (
                    // The quiet caption tag (Lower Third's informational plate).
                    <span data-art-in-use className="type-caption flex-none bg-plate py-0.5 pl-1.5 pr-2.5 text-[13px] text-plate-foreground [clip-path:polygon(0_0,100%_0,calc(100%_-_6px)_100%,0_100%)]">
                      In use
                    </span>
                  )}
                  {c.note && <span className="text-[13px] text-muted-foreground">{c.note}</span>}
                </span>
              </button>
            );
          })}
        </div>
        {/* Back to following the couch, for someone who chose one of the app's photos over its pick. */}
        {mine && theirs && theirs.art !== UPLOAD && (
          <div className="mt-3">
            <ResetLink data="league-art" label={`Use the couch's (${theirs.name}'s pick)`} onClick={() => void pick({ key: "couch", art: artFor(league).find((a) => a.id === theirs.art) ?? inUse.art, value: null, note: null })} />
          </div>
        )}
      </PageSection>

      <PageSection
        title="Your own picture"
        line={`Use a picture you have the right to use. It's cut to the band's shape from the middle.${couch ? " People on your couches can see it." : ""}`}
        data="league-picture"
      >
        <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => void upload(e.target.files?.[0])} data-league-picture-input />
        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2">
          <Btn data-league-picture-upload disabled={!!busy} onClick={() => file.current?.click()}>
            <ImageUp className="size-5" aria-hidden />
            {busy === "upload" ? "Uploading…" : myPicture ? "Replace your picture" : "Upload a picture"}
          </Btn>
          {myPicture && !removing && (
            <button type="button" data-league-picture-remove onClick={() => setRemoving(true)} className="min-h-11 text-[14px] font-semibold text-muted-foreground underline underline-offset-[3px]">
              Remove it
            </button>
          )}
        </div>
        {removing && (
          // Undo can't bring a picture back, so this asks first, in place (the settings' rule).
          <div data-league-picture-ask className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[4px] bg-card px-3.5 py-3">
            <span className="min-w-0 flex-1 text-[14px]">Remove your picture? It can&apos;t be brought back.</span>
            <Btn data-league-picture-remove-yes disabled={!!busy} onClick={() => void remove()} className="h-11 text-destructive">
              Remove
            </Btn>
            <Btn disabled={!!busy} onClick={() => setRemoving(false)} className="h-11">
              Keep it
            </Btn>
          </div>
        )}
      </PageSection>
    </>
  );
}

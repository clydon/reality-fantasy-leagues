"use client";

import { useEffect, useState } from "react";
import { Btn } from "../ui/parts";
import { PreviewStory, type LivePass, type Preview } from "./story";

// A game's preview made on demand (docs/PLAN-game-preview.md, "On demand"). Two halves, on two hosts:
// - LiveStory, on the app's own host, signed in as you: asks the server to play a made-up season now (src/lib/server/preview-live.ts)
//   and says what's happening while it does; then hands over to the preview host (its own cookies), replacing itself in the history,
//   so Back from the story leaves it rather than making another.
// - LiveStoryShow, on the preview host, signed in there as the preview's own viewer by its enter route: the story, each screen the
//   real app on that same host, live. Its copies go when it closes (and after half an hour regardless).

const NAMES: Record<string, string> = { fantasy: "Fantasy league", sheet: "Prediction sheet", pool: "Survival pool" };

function Making({ game, error, secs, onRetry }: { game: string; error: string | null; secs: number; onRetry?: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background text-foreground" data-live-making={error ? "error" : "making"}>
      <style>{`@keyframes nd-live-sweep{from{transform:translateX(-100%)}to{transform:translateX(200%)}}`}</style>
      <div className="mx-auto flex w-full max-w-[430px] flex-1 flex-col justify-center gap-4 px-6 pb-[max(24px,env(safe-area-inset-bottom,0px))]">
        <span className="type-caption inline-flex h-7 w-fit items-center bg-secondary pl-2.5 pr-5 text-[15px] tracking-[0.04em] [clip-path:polygon(0_0,100%_0,calc(100%-9px)_100%,0_100%)]">Made-up season</span>
        {error ? (
          <>
            <h1 className="type-caption text-[26px] leading-[0.95] [text-wrap:balance]">The preview didn&apos;t come together</h1>
            <p className="text-[15px] leading-snug text-muted-foreground">{error}</p>
            {onRetry && (
              <Btn tone="ink" className="mt-2 w-fit px-5" onClick={onRetry}>
                Try again
              </Btn>
            )}
          </>
        ) : (
          <>
            <h1 className="type-caption text-[26px] leading-[0.95] [text-wrap:balance]">Playing a season of {NAMES[game] ?? "this game"}</h1>
            <p className="text-[15px] leading-snug text-muted-foreground">On the app&apos;s real screens, with every move but yours made by the computer players. Everything after where you are is made up.</p>
            <span className="mt-1 block h-[3px] w-full overflow-hidden rounded-full bg-secondary" aria-hidden>
              <span className="block h-full w-1/3 animate-[nd-live-sweep_1.4s_ease-in-out_infinite] rounded-full bg-foreground/70 motion-reduce:animate-none" />
            </span>
            <p className="type-num text-[15px] text-muted-foreground">{secs} s</p>
          </>
        )}
      </div>
    </div>
  );
}

/** On the app's own host: make the preview, then go to its story on the preview host. */
export function LiveStory({ game }: { game: string }) {
  const [error, setError] = useState<string | null>(null);
  const [tries, setTries] = useState(0);
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    let gone = false;
    const t0 = Date.now();
    const tick = setInterval(() => setSecs(Math.floor((Date.now() - t0) / 1000)), 500);
    fetch("/api/preview-live", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ game }) })
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(r.status === 401 ? "Sign in first: a preview is made for you." : body.error || `It didn't work (${r.status})`);
        return body as LivePass;
      })
      .then((m) => {
        if (gone) return void fetch(`/api/preview-live/${m.id}`, { method: "DELETE", keepalive: true });
        const host = `${window.location.protocol}//preview.${window.location.host}`;
        const to = `/start/preview-story/live/${m.id}`;
        window.location.replace(`${host}/api/preview-live/enter?p=${m.id}&e=${m.expires}&t=${encodeURIComponent(m.pass)}&to=${encodeURIComponent(to)}`);
      })
      .catch((e: Error) => !gone && setError(e.message))
      .finally(() => clearInterval(tick));
    return () => {
      gone = true;
      clearInterval(tick);
    };
  }, [game, tries]);
  return <Making game={game} error={error} secs={secs} onRetry={() => { setError(null); setSecs(0); setTries((n) => n + 1); }} />;
}

/** On the preview host, as the preview's viewer: its story, read with the pass, its screens live. */
export function LiveStoryShow({ id }: { id: string }) {
  const [story, setStory] = useState<{ preview: Preview; pass: LivePass } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const pass: LivePass = { id, expires: Number(q.get("e")), pass: q.get("t") ?? "" };
    fetch(`/api/preview-live/${id}?e=${pass.expires}&t=${encodeURIComponent(pass.pass)}`)
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(body.error || `It didn't work (${r.status})`);
        setStory({ preview: body as Preview, pass });
      })
      .catch((e: Error) => setError(e.message));
    // Its copies go when the story closes: leaving the page, or this tab closing.
    const close = () => fetch(`/api/preview-live/${id}?e=${pass.expires}&t=${encodeURIComponent(pass.pass)}`, { method: "DELETE", keepalive: true });
    window.addEventListener("pagehide", close);
    return () => window.removeEventListener("pagehide", close);
  }, [id]);
  if (!story) return <Making game="" error={error} secs={0} />;
  return <PreviewStory preview={story.preview} live={story.pass} />;
}

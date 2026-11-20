"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { paths } from "../routes";
import { Btn } from "../ui/parts";
import { refusal, refusalOf, type Refusal } from "./refusals";
import { PreviewStory, type LivePass, type Preview } from "./story";

// A game's preview made on demand (docs/PLAN-game-preview.md, "On demand"). Two halves, on two hosts:
// - LiveStory, on the app's own host, signed in as you: asks the server to play a made-up season now (src/lib/server/preview-live.ts)
//   and says what's happening while it does; then hands over to the preview host (its own cookies), replacing itself in the history,
//   so Back from the story leaves it rather than making another.
// - LiveStoryShow, on the preview host, signed in there as the preview's own viewer by its enter route: the story, each screen the
//   real app on that same host, live. Its copies go when it closes (and after half an hour regardless).
//
// The wait and every way it can stop share one frame (docs/design-round/preview-flow-spec.md §2 and §4; first-view R1 to R5), in one
// place on the screen whatever it says, told apart by shape: working is the "Made-up season" tag and a moving track; a limit is the
// "Preview" tag and a button (nothing broke: a rule or a queue); gone is no tag at all and a button. Never the error colour; one way
// on that can work now. Its words are one live region that stays mounted, so a screen reader hears the wait become a refusal.

const NAMES: Record<string, string> = { fantasy: "Fantasy league", sheet: "Prediction sheet", pool: "Survival pool" };
/** How long before the wait says a long season takes longer (most are made in 2 to 7 seconds). */
const SLOW_MS = 8000;
/** The story's reads that may fail in a row (a second apart, then slower) before what's still coming is called never made: about
 *  the half minute the wait promises. */
const READ_TRIES = 12;

type FrameState = "working" | "still" | "gone";
interface FrameProps {
  state: FrameState;
  title: string;
  line: ReactNode;
  /** Under the track, while working (the slow line). */
  after?: ReactNode;
  actions: ReactNode;
}

const TAG = "type-caption inline-flex h-7 w-fit items-center bg-secondary pl-2.5 pr-5 text-[15px] tracking-[0.04em] [clip-path:polygon(0_0,100%_0,calc(100%-9px)_100%,0_100%)]";

/** The wait's frame: what's being made (or why it isn't), and the way on at the foot. Its block sits at a fixed height, so nothing
 *  moves when a line arrives or the wait becomes a refusal (first-view R1). */
export function PreviewFrame({ state, title, line, after, actions }: FrameProps) {
  const head = useRef<HTMLHeadingElement>(null);
  // A refusal or a gone story takes the focus to what it says (the wait's own Back is gone from under it).
  useEffect(() => {
    if (state !== "working") head.current?.focus();
  }, [state, title]);
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background text-foreground" data-live-making={state === "working" ? "making" : state === "still" ? "limit" : "gone"} aria-busy={state === "working"}>
      <style>{`@keyframes nd-live-sweep{from{transform:translateX(-100%)}to{transform:translateX(200%)}}`}</style>
      <div className="mx-auto flex w-full max-w-[430px] flex-1 flex-col px-4 pt-[env(safe-area-inset-top,0px)] pb-[max(20px,env(safe-area-inset-bottom,0px))]">
        <div className="flex flex-col gap-4 pt-[clamp(96px,30dvh,260px)]" aria-live="polite">
          <span className={`${TAG} ${state === "gone" ? "invisible" : ""}`} aria-hidden={state === "gone"}>
            {state === "working" ? "Made-up season" : "Preview"}
          </span>
          <h1 ref={head} tabIndex={-1} className="type-caption text-[26px] leading-[0.95] outline-none [text-wrap:balance]" data-frame-title>
            {title}
          </h1>
          <div className="max-w-[34ch] text-[15px] leading-snug text-muted-foreground" data-frame-line>
            {line}
          </div>
          {state === "working" && (
            <>
              {/* Moving: a sweep; under reduced motion a still hatch the width of the track (never a part-full bar, which reads as
                  stuck at a third). */}
              <span className="mt-1 block h-[3px] w-full overflow-hidden rounded-full bg-secondary motion-reduce:bg-[repeating-linear-gradient(135deg,var(--secondary)_0_6px,color-mix(in_oklab,var(--foreground)_40%,transparent)_6px_9px)]" aria-hidden data-track="working">
                <span className="block h-full w-1/3 animate-[nd-live-sweep_1.4s_ease-in-out_infinite] rounded-full bg-foreground/70 motion-reduce:hidden" />
              </span>
              {after}
            </>
          )}
        </div>
        <div className="mt-auto flex flex-col items-stretch gap-1">{actions}</div>
      </div>
    </div>
  );
}

/** A quiet way out at the foot (Back to the game; a second choice under a refusal's first). */
function Quiet({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="nd-press flex h-12 items-center justify-center text-[15px] font-bold underline decoration-input underline-offset-[3px]" data-frame-quiet>
      {children}
    </button>
  );
}

/** Where "Back to the game" goes: the game's page when the gallery says (`back`), else wherever you came from. */
function goBack(back?: string) {
  if (back) window.location.assign(back);
  else if (history.length > 1) history.back();
  else window.location.assign("/");
}

/** The app's home, from the preview host: where a story that's gone sends you. The service says where the app is (`app`, its
 *  PREVIEW_APP_URL: on its own ….vercel.app address the app isn't its host less "preview."); development drops "preview.". */
const appHome = (app?: string) => (app ? app.replace(/\/$/, "") : `${window.location.protocol}//${window.location.host.replace(/^preview\./, "")}`) + paths.home;

/** A refusal as the frame shows it: its headline and line, then the one way on that can work now (and Back, where Try again or
 *  the couch leads). */
function refusalFrame(r: Refusal, back?: string, onRetry?: () => void, app?: string): FrameProps {
  const lead = (label: string, go: () => void) => (
    <Btn tone="ink" wide onClick={go}>
      {label}
    </Btn>
  );
  const actions = r.gone ? (
    lead(r.why === "used" ? "Open the app" : "Back to the app", () => window.location.assign(appHome(app)))
  ) : r.why === "signin" ? (
    <>
      {lead("Sign in", () => window.location.assign(paths.signin(window.location.pathname + window.location.search)))}
      <Quiet onClick={() => goBack(back)}>Back to the game</Quiet>
    </>
  ) : r.why === "couch" ? (
    <>
      {lead("Your couches", () => window.location.assign(paths.home))}
      <Quiet onClick={() => goBack(back)}>Back to the game</Quiet>
    </>
  ) : r.retry && onRetry ? (
    <>
      {lead("Try again", onRetry)}
      <Quiet onClick={() => goBack(back)}>Back to the game</Quiet>
    </>
  ) : (
    lead("Back to the game", () => goBack(back))
  );
  return { state: r.gone ? "gone" : "still", title: r.title, line: <p data-refusal={r.why}>{r.line}</p>, actions };
}

/** A refusal on the frame, on its own (a page that's only that: a used link). */
export function RefusalFrame({ r, onRetry, back, app }: { r: Refusal; onRetry?: () => void; back?: string; app?: string }) {
  return <PreviewFrame {...refusalFrame(r, back, onRetry, app)} />;
}

/** One make per try, however often the page's effect runs (React runs it twice in development): the first ask's answer, shared. */
const asked = new Map<string, Promise<Response>>();
const askOnce = (key: string, game: string) => {
  if (!asked.has(key)) asked.set(key, fetch("/api/preview-live", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ game }) }));
  return asked.get(key)!.then((r) => r.clone());
};

/** On the app's own host: make the preview, then go to its story on the preview host. `back`: the game's page (the gallery's). */
export function LiveStory({ game, name, back }: { game: string; name?: string; back?: string }) {
  const [stop, setStop] = useState<Refusal | null>(null);
  const [tries, setTries] = useState(0);
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    let gone = false;
    const late = setTimeout(() => setSlow(true), SLOW_MS);
    askOnce(`${game}:${tries}`, game)
      .then(
        async (r) => {
          const body = await r.json().catch(() => ({}));
          if (!r.ok) throw refusalOf(r.status, body.error);
          return body as { id: string; entry: string };
        },
        () => {
          throw refusalOf(null);
        }
      )
      .then((m) => {
        // An effect cleaned up does nothing: the one still running for this try (the same ask) goes on to the story; a page left
        // while it was made leaves it to the sweep (half an hour).
        if (gone) return;
        // Its way in is used once: the preview host spends it, signs in as the preview's viewer and opens the story.
        const host = `${window.location.protocol}//preview.${window.location.host}`;
        const to = `/start/preview-story/live/${m.id}`;
        window.location.replace(`${host}/api/preview-live/enter?w=${encodeURIComponent(m.entry)}&to=${encodeURIComponent(to)}`);
      })
      .catch((e: unknown) => !gone && setStop(e && typeof e === "object" && "why" in e ? (e as Refusal) : refusal("failed")))
      .finally(() => clearTimeout(late));
    return () => {
      gone = true;
      clearTimeout(late);
    };
  }, [game, tries]);
  // One frame throughout (its live region stays mounted): the wait, or why it stopped.
  const frame: FrameProps = stop
    ? refusalFrame(stop, back, () => {
        setStop(null);
        setSlow(false);
        setTries((n) => n + 1);
      })
    : {
        state: "working",
        title: `Playing a season of ${name ?? NAMES[game] ?? "this game"}`,
        line: <p>On the app&apos;s real screens, with every move but yours made by the computer players. Real up to where you&apos;ve watched; made up after that.</p>,
        after: slow ? (
          <p className="text-[15px] leading-snug text-muted-foreground" data-frame-slow>
            Still going: a long season takes up to half a minute.
          </p>
        ) : null,
        actions: <Quiet onClick={() => goBack(back)}>Back to the game</Quiet>,
      };
  return <PreviewFrame {...frame} />;
}

/** On the preview host, as the preview's viewer (signed in by its way in): its story, its screens live. */
export function LiveStoryShow({ id, app }: { id: string; app?: string }) {
  const [story, setStory] = useState<{ preview: Preview & { complete?: boolean; failed?: string | null }; pass: LivePass } | null>(null);
  const [stop, setStop] = useState<Refusal | null>(null);
  useEffect(() => {
    const url = `/api/preview-live/${id}`;
    let timer: ReturnType<typeof setTimeout> | null = null, misses = 0, done = false, got = false;
    // The first moment is there at once; the rest land while you look: ask again until they all have (and what's typical). A read
    // that fails is asked again, more slowly; after about half a minute of them, what's still coming is called never made (so no
    // phone says "Getting this moment ready" for ever).
    const read = () =>
      fetch(url)
        .then(async (r) => {
          const body = await r.json().catch(() => ({}));
          // Not this browser's (signed out, swept, closed): ended, the same for every reason (a link can't be probed).
          if (!r.ok) throw r.status === 401 || r.status === 403 || r.status === 404 ? refusal("ended") : refusalOf(r.status, body.error);
          misses = 0;
          got = true;
          setStory({ preview: body as Preview & { complete?: boolean }, pass: { id, expires: Number(body.expires) } });
          if (!body.complete) timer = setTimeout(read, 1000);
        })
        .catch((e: unknown) => {
          if (done) return;
          const r = e && typeof e === "object" && "why" in e ? (e as Refusal) : refusal("down");
          // Before the story's first answer, or once it has ended: say why. Else keep the story, and ask again.
          if (!got || r.why === "ended") {
            setStory(null);
            setStop(r);
          } else if (++misses >= READ_TRIES) setStory((s) => (s ? { ...s, preview: { ...s.preview, complete: true } } : s));
          else timer = setTimeout(read, Math.min(5000, 1000 * 2 ** Math.min(misses, 3)));
        });
    read();
    // Its copies go when the story closes: leaving the page, or this tab closing.
    const close = () => fetch(url, { method: "DELETE", keepalive: true });
    window.addEventListener("pagehide", close);
    return () => {
      done = true;
      if (timer) clearTimeout(timer);
      window.removeEventListener("pagehide", close);
    };
  }, [id]);
  if (stop && !story) return <RefusalFrame r={stop} app={app} />;
  if (!story) return <PreviewFrame state="working" title="Opening your preview" line={<p>The first moment is ready; the rest land while you look.</p>} actions={null} />;
  return <PreviewStory preview={story.preview} live={story.pass} />;
}

/** On the preview host, where the enter route sends a way in that's spent, ended or unknown: one page for every reason. */
export function LiveStoryGone({ app }: { app?: string }) {
  return <RefusalFrame r={refusal("used")} app={app} />;
}

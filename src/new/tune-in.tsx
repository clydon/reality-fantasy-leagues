"use client";

import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { showWords } from "@/lib/game/show-words";
import { splitFrame, UNFRAMED } from "@/lib/art-frame";
import { airTime } from "./clock";
import { useCouchForSeason, useHome, useSeasonEpisodes, useSeasonGames, useSpace, type CouchShow, type HomeShow } from "./data";
import { clearNav, markNav } from "./nav";
import { navigating } from "./ui/sheet-history";

// Tune in (the user, 2026-10-30; mocked and approved on a canvas first): going from the hub into a show plays a TV bumper.
//   1. The tapped card gives, and its art blooms out of it to the whole phone, still the card's own picture; the hub sinks back.
//   2. A scanline runs down the screen and paints the show's banner in above it, like a set changing channel (from Up next the
//      card already is the banner, so only the line passes).
//   3. A lower third slams in: the show's colour on the angled tag (from its art; never yellow, which is for what you must do),
//      its name on a white caption plate, the season and next episode on a dark plate.
//   4. It holds on a slow push-in for at least 1.5 s, and for as long as the show is still loading (the page says when it's
//      ready: tunedIn); past 1.5 s a bar in the show's colour runs along the plate. A tap once it's ready skips the rest.
//   5. It folds: the art crops into the show's header, the name flies to the header's title, Tonight rises under it, and the
//      overlay hands over to the real page.
// Back from the show is the quick reverse: the header's art drops into the show's card on the hub. The page under the bumper
// changes once the scanline has passed (its reads start at the tap), with a "tune" navigation that starts no view transition
// (nav.tsx), so the bumper is the only thing moving; and everything that moves while the page renders is a transform or an
// opacity, which the GPU runs on its own. Reduced motion: the bumper fades up, holds and crossfades; Back is the plain calm
// move. Tests that switch motion off (motion.js) skip it.

type Picture = { src: string; box: DOMRect; position: string; w: number; h: number };
type Go = { kind: "go"; id: number; seasonId: string; href: string; el: HTMLElement; scope: DOMRect; art: Picture | null };
type Back = { kind: "back"; id: number; seasonId: string; header: DOMRect; art: Picture | null };
type Request = Go | Back;

const MIN = 1500;
const CAP = 4000;
const FOLD = 460;
const EXPO = "cubic-bezier(0.16, 1, 0.3, 1)";
const FOLD_EASE = "cubic-bezier(0.7, 0, 0.18, 1)";
const SCAN_EASE = "cubic-bezier(0.45, 0, 0.55, 1)";
// The scanline's sweep, and where its bright edge sits in its band (the band trails above the edge).
const SWEEP = 420;
const SCAN_EDGE = 93;
// The app's chart colours, for a show whose art can't be read (another site's picture without CORS).
const FALLBACK = ["#f2804b", "#a76bb0", "#5089c9", "#35b5a5", "#e56b9f"];

let request: Request | null = null;
let ids = 0;
const ready = new Set<string>();
const readyAt = new Map<string, number>();
// The fold waits this long after the page says it's in, so the page's render has settled before the fold moves over it.
const SETTLE = 120;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
/** Off for tests that switch motion off (scripts/dev-test/motion.js), and where the browser can't animate. */
const canRun = () => typeof window !== "undefined" && !!Element.prototype.animate && (window as unknown as { __ndMotion?: string }).__ndMotion !== "off";

/** The picture an element shows, where it's a plain image that has loaded (not a framed zoom, nor the name on a plate). */
function pictureOf(el: Element | null): Picture | null {
  if (!(el instanceof HTMLImageElement) || !el.complete || !el.naturalWidth) return null;
  return { src: el.currentSrc || el.src, box: el.getBoundingClientRect(), position: getComputedStyle(el).objectPosition || "50% 50%", w: el.naturalWidth, h: el.naturalHeight };
}

/**
 * From a channel link (NavLink): start the bumper into the show at `href`, from the card `scope` the link sits in. False when
 * it can't run (one's already playing, motion off): the link then moves as it always has.
 */
export function startTuneIn(href: string, scope: HTMLElement): boolean {
  const seasonId = href.split("/")[2]?.split("?")[0];
  if (request || !seasonId || !href.startsWith("/show/") || !canRun()) return false;
  ready.delete(seasonId);
  request = { kind: "go", id: ++ids, seasonId, href, el: scope, scope: scope.getBoundingClientRect(), art: pictureOf(scope.querySelector("[data-art]")) };
  emit();
  return true;
}

/** From the show's Back: the header's art drops into the show's card on the hub. False under reduced motion (the calm move). */
export function startTuneBack(seasonId: string): boolean {
  if (request || !canRun() || reduced()) return false;
  const bar = document.querySelector<HTMLElement>(".nd-showbar");
  if (!bar) return false;
  request = { kind: "back", id: ++ids, seasonId, header: bar.getBoundingClientRect(), art: pictureOf(bar.querySelector("[data-art]")) };
  emit();
  return true;
}

/** The show's page has what Tonight needs: the bumper may fold once it's held long enough. */
export function tunedIn(seasonId: string) {
  if (ready.has(seasonId)) return;
  ready.add(seasonId);
  readyAt.set(seasonId, performance.now());
  if (request?.kind === "go" && request.seasonId === seasonId) emit();
}

/** Where an image sits when it covers a box (object-fit: cover) at an object-position. */
function cover(w: number, h: number, box: { x: number; y: number; w: number; h: number }, position: string) {
  const k = Math.max(box.w / w, box.h / h);
  const dw = w * k;
  const dh = h * k;
  const [px, py] = position.split(/\s+/).map((p) => (p.endsWith("%") ? parseFloat(p) / 100 : p === "left" || p === "top" ? 0 : p === "right" || p === "bottom" ? 1 : 0.5));
  return { x: box.x + (box.w - dw) * (Number.isFinite(px) ? px : 0.5), y: box.y + (box.h - dh) * (Number.isFinite(py ?? px) ? (py ?? 0.5) : 0.5), w: dw, h: dh };
}

const rel = (r: DOMRect, root: DOMRect) => ({ x: r.left - root.left, y: r.top - root.top, w: r.width, h: r.height });
const clipOf = (r: { x: number; y: number; w: number; h: number }, W: number, H: number, round = 0) =>
  `inset(${r.y}px ${W - r.x - r.w}px ${H - r.y - r.h}px ${r.x}px round ${round}px)`;
const place = (img: HTMLImageElement, g: { x: number; y: number; w: number; h: number }) => {
  Object.assign(img.style, { left: `${g.x}px`, top: `${g.y}px`, width: `${g.w}px`, height: `${g.h}px` });
};
const toward = (from: { x: number; y: number; w: number }, to: { x: number; y: number; w: number }) => `translate(${to.x - from.x}px, ${to.y - from.y}px) scale(${to.w / from.w})`;

/** The text of an element's first line as a box (a Range over its first text node): where a name's letters sit. */
function textBox(el: Element | null): DOMRect | null {
  const node = el && [...el.childNodes].find((n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim());
  if (!node) return null;
  const range = document.createRange();
  range.selectNodeContents(node);
  const r = range.getBoundingClientRect();
  return r.width ? r : null;
}

const colours = new Map<string, string>();
/** The show's colour, from its banner: the saturated pixels' hue, brightened; never yellow (the One Chyron Rule). */
function colourOf(seasonId: string, src: string | null): Promise<string> {
  const fallback = FALLBACK[[...seasonId].reduce((t, c) => t + c.charCodeAt(0), 0) % FALLBACK.length];
  if (colours.has(seasonId)) return Promise.resolve(colours.get(seasonId)!);
  if (!src) return Promise.resolve(fallback);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        c.width = c.height = 24;
        const g = c.getContext("2d", { willReadFrequently: true })!;
        g.drawImage(img, 0, 0, 24, 24);
        const d = g.getImageData(0, 0, 24, 24).data;
        let x = 0;
        let y = 0;
        let total = 0;
        for (let i = 0; i < d.length; i += 4) {
          const [r, gr, b] = [d[i] / 255, d[i + 1] / 255, d[i + 2] / 255];
          const max = Math.max(r, gr, b);
          const min = Math.min(r, gr, b);
          const l = (max + min) / 2;
          const s = max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1));
          if (max === min) continue;
          const h = max === r ? ((gr - b) / (max - min) + 6) % 6 : max === gr ? (b - r) / (max - min) + 2 : (r - gr) / (max - min) + 4;
          const wgt = s * (1 - Math.abs(l - 0.5) * 2);
          x += Math.cos((h * Math.PI) / 3) * wgt;
          y += Math.sin((h * Math.PI) / 3) * wgt;
          total += wgt;
        }
        if (total < 4) return resolve(fallback);
        let hue = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
        if (hue >= 40 && hue <= 72) hue = 26;
        const out = `hsl(${Math.round(hue)} 68% 56%)`;
        colours.set(seasonId, out);
        resolve(out);
      } catch {
        resolve(fallback);
      }
    };
    img.onerror = () => resolve(fallback);
    img.src = src;
  });
}

type Show = HomeShow | CouchShow;

/** The show's reads, from the tap: the same queries its page asks once it's there, so they're in (or on their way). */
function Warm({ seasonId }: { seasonId: string }) {
  const home = useHome();
  const couchId = useCouchForSeason(home.data, seasonId)?.id ?? null;
  useSpace(seasonId, couchId, !!home.data);
  useSeasonGames(seasonId, couchId, !!home.data);
  useSeasonEpisodes(seasonId, couchId, !!home.data);
  return null;
}

/** Mounted once, in the new design's shell: the bumper, whenever one's asked for. */
export function TuneIn() {
  const req = useSyncExternalStore(subscribe, () => request, () => null);
  const home = useHome();
  const router = useRouter();
  const show: Show | null = req ? (home.data?.shows.find((s) => s.seasonId === req.seasonId) ?? home.data?.couchShows.find((s) => s.seasonId === req.seasonId) ?? null) : null;
  const rootRef = useRef<HTMLDivElement>(null);
  const dimRef = useRef<HTMLDivElement>(null);
  const artRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLImageElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const bannerRef = useRef<HTMLImageElement>(null);
  const shadeRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const thirdRef = useRef<HTMLDivElement>(null);
  const tagRef = useRef<HTMLSpanElement>(null);
  const plateRef = useRef<HTMLSpanElement>(null);
  const nameRef = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);
  const seasonRef = useRef<HTMLSpanElement>(null);
  const scanRef = useRef<HTMLDivElement>(null);
  // Windows that open by sliding while what's inside them slides back, so it stands still: the fold's lift, the scanline's curtain,
  // the plates' wipes. Transforms only, so the GPU keeps them smooth while the show's page renders underneath (a clip-path
  // animation runs on the page's own thread and stalls with it).
  const liftRef = useRef<HTMLDivElement>(null);
  const liftInRef = useRef<HTMLDivElement>(null);
  const curtainRef = useRef<HTMLDivElement>(null);
  const curtainInRef = useRef<HTMLDivElement>(null);
  const plateWinRef = useRef<HTMLSpanElement>(null);
  const plateInRef = useRef<HTMLSpanElement>(null);
  const seasonWinRef = useRef<HTMLSpanElement>(null);
  const seasonInRef = useRef<HTMLSpanElement>(null);
  const run = useRef<{ id: number; anims: Animation[]; timers: number[]; fold?: () => void; folded?: boolean; start: number; unsub?: () => void; swept?: number; nav?: number; hub?: HTMLElement } | null>(null);
  const bannerSrc = show ? splitFrame(show.show.backdropUrl || show.show.artUrl).src : null;
  const bannerPosition = show?.show.backdropUrl ? `${UNFRAMED.header.x}% ${UNFRAMED.header.y}%` : "50% 40%";
  const name = show ? show.show.name.replace(/^The /, "") : "";
  const words = showWords(show?.show.terms);
  const line = show
    ? [show.seasonNumber ? `Season ${show.seasonNumber}` : show.seasonName, show.upNext ? `${words.ep} ${show.upNext.number}` : null, show.upNext?.airAt ? airTime(Date.parse(show.upNext.airAt)) : null]
        .filter(Boolean)
        .join(" · ")
    : "";

  // A go whose show the hub doesn't have (or with no picture to fold): just go there.
  useEffect(() => {
    if (req?.kind !== "go" || !home.data || show) return;
    request = null;
    emit();
    markNav("fade");
    navigating();
    router.push(req.href);
  }, [req, home.data, show, router]);

  useLayoutEffect(() => {
    if (!req || (req.kind === "go" && !show)) return;
    if (run.current?.id === req.id) return;
    const refs = { root: rootRef, dim: dimRef, art: artRef, card: cardRef, wrap: wrapRef, banner: bannerRef, shade: shadeRef, head: headRef, third: thirdRef, tag: tagRef, plate: plateRef, name: nameRef, bar: barRef, season: seasonRef, scan: scanRef, lift: liftRef, liftIn: liftInRef, curtain: curtainRef, curtainIn: curtainInRef, plateWin: plateWinRef, plateIn: plateInRef, seasonWin: seasonWinRef, seasonIn: seasonInRef };
    const els = Object.fromEntries(Object.entries(refs).map(([k, v]) => [k, v.current])) as { [K in keyof typeof refs]: NonNullable<(typeof refs)[K]["current"]> };
    if (Object.values(els).some((e) => !e)) return;
    const state: NonNullable<typeof run.current> = { id: req.id, anims: [], timers: [], start: performance.now() };
    run.current = state;
    const add = (el: Element | null | undefined, kf: Keyframe[], o: { duration: number; delay?: number; easing?: string; fill?: FillMode }) => {
      if (!el) return null;
      const a = el.animate(kf, { fill: "both", easing: "linear", ...o, duration: Math.max(1, o.duration) });
      state.anims.push(a);
      return a;
    };
    const later = (ms: number, f: () => void) => state.timers.push(window.setTimeout(f, ms));
    const end = () => {
      state.unsub?.();
      state.timers.forEach(clearTimeout);
      state.anims.forEach((a) => a.cancel());
      if (state.nav) clearNav(state.nav);
      state.hub?.style.removeProperty("visibility");
      if (run.current === state) run.current = null;
      if (request?.id === req.id) {
        request = null;
        emit();
      }
    };
    /** Open a window: `win` slides from `from` to its place while `inside` slides from `back`, so what's inside stands still. */
    const reveal = (win: Element, inside: Element, from: string, back: string, o: { duration: number; delay?: number; easing?: string }) => {
      add(win, [{ transform: from }, { transform: "none" }], o);
      add(inside, [{ transform: back }, { transform: "none" }], o);
    };
    /** Windows open from the start (reduced motion; Back). */
    const opened = (...win: HTMLElement[]) => win.forEach((e) => (e.style.transform = "none"));
    const R = els.root.getBoundingClientRect();
    const W = R.width;
    const H = R.height;

    // ---------- back: the header drops into the show's card ----------
    if (req.kind === "back") {
      const head = rel(req.header, R);
      els.art.style.background = "transparent";
      add(els.art, [{ clipPath: clipOf(head, W, H) }, { clipPath: clipOf(head, W, H) }], { duration: 1 });
      // The header's own shading, so the art doesn't brighten as it lifts off.
      els.head.style.top = `${head.y}px`;
      els.head.style.height = `${head.h}px`;
      els.head.style.opacity = "1";
      opened(els.curtain, els.curtainIn);
      if (req.art) {
        els.banner.src = req.art.src;
        place(els.banner, cover(req.art.w, req.art.h, rel(req.art.box, R), req.art.position));
      }
      // The hub comes back under it (the browser's back, then React's commit): find the show's card, then go to it.
      let tries = 0;
      const look = () => {
        const card = [...document.querySelectorAll<HTMLElement>(`[data-art="${req.seasonId}"]`)].find((el) => {
          const b = el.getBoundingClientRect();
          return !el.closest(".nd-showbar") && b.bottom > 40 && b.top < window.innerHeight - 40 && b.width > 20;
        });
        if (!card && tries++ < 18) return later(50, look);
        if (!card || !req.art) {
          add(els.root, [{ opacity: 1 }, { opacity: 0 }], { duration: 200 });
          return later(210, end);
        }
        const scope = card.closest<HTMLElement>("[data-art-scope]") ?? card.closest<HTMLElement>("a") ?? card;
        const to = rel(scope.getBoundingClientRect(), R);
        const pic = pictureOf(card);
        const from = cover(req.art.w, req.art.h, rel(req.art.box, R), req.art.position);
        const onto = cover(req.art.w, req.art.h, rel(pic?.box ?? card.getBoundingClientRect(), R), pic?.position ?? "50% 50%");
        const EASE = "cubic-bezier(0.4, 0, 0.2, 1)";
        add(els.art, [{ clipPath: clipOf(head, W, H) }, { clipPath: clipOf(to, W, H, 4) }], { duration: 400, easing: EASE });
        add(els.banner, [{ transform: "none" }, { transform: toward(from, onto) }], { duration: 400, easing: EASE });
        add(els.head, [{ opacity: 1 }, { opacity: 0 }], { duration: 260 });
        add(els.root, [{ opacity: 1 }, { opacity: 1, offset: 0.7 }, { opacity: 0 }], { duration: 400 });
        const hub = document.querySelector<HTMLElement>("[data-hub]");
        if (hub) {
          hub.style.transformOrigin = `50% ${window.scrollY + window.innerHeight * 0.45 - (hub.getBoundingClientRect().top + window.scrollY)}px`;
          add(hub, [{ transform: "scale(0.96)" }, { transform: "none" }], { duration: 420, easing: EXPO, fill: "none" });
        }
        later(410, end);
      };
      later(30, look);
      return;
    }

    // ---------- go ----------
    const still = reduced();
    const scope = rel(req.scope, R);
    els.name.style.fontSize = "64px";
    // The name fits the plate: smaller for a long one.
    const room = W - 32 - 26 - 40;
    const nameBox = textBox(els.name);
    if (nameBox && nameBox.width > room) els.name.style.fontSize = `${Math.max(34, Math.floor((64 * room) / nameBox.width))}px`;
    colourOf(req.seasonId, bannerSrc).then((c) => {
      els.tag.style.background = c;
      els.bar.style.background = c;
    });
    // The banner, as the whole phone shows it. When it's the very picture the card showed (a show with no backdrop; Up next, which
    // shows the backdrop already), it takes the card's own crop, so the curtain changes nothing but the light.
    const art = req.art;
    const abs = (u: string | null) => {
      try {
        return u ? new URL(u, window.location.href).href : null;
      } catch {
        return u;
      }
    };
    const position = art && abs(art.src) === abs(bannerSrc) ? art.position : bannerPosition;
    const bannerReady = () => !!els.banner.naturalWidth;
    const fullBanner = () => cover(els.banner.naturalWidth || W, els.banner.naturalHeight || H, { x: 0, y: 0, w: W, h: H }, position);
    const placeBanner = () => bannerReady() && place(els.banner, fullBanner());
    placeBanner();
    els.banner.addEventListener("load", placeBanner, { once: true });
    // The card's own picture, as the whole phone shows it, starting where it sat on the card.
    if (art) {
      els.card.src = art.src;
      const full = cover(art.w, art.h, { x: 0, y: 0, w: W, h: H }, art.position);
      place(els.card, full);
      add(els.card, [{ transform: toward(full, cover(art.w, art.h, rel(art.box, R), art.position)) }, { transform: "none" }], { delay: 20, duration: 480, easing: EXPO });
    } else {
      els.card.style.display = "none";
    }

    // Into the show, under the bumper: once the scanline has passed (the page's first render would stall it), or at 1 s if
    // the banner is still loading. Its reads started at the tap (Warm), so waiting doesn't make the hold any longer.
    const navigate = () => {
      if (state.nav) return;
      state.nav = markNav("tune");
      navigating();
      router.push(req.href);
    };
    router.prefetch(req.href);
    later(still ? 200 : 1000, () => (state.swept && performance.now() < state.swept ? later(state.swept - performance.now() + 40, navigate) : navigate()));
    if (still) {
      opened(els.curtain, els.curtainIn, els.plateWin, els.plateIn, els.seasonWin, els.seasonIn);
      add(els.root, [{ opacity: 0 }, { opacity: 1 }], { duration: 200 });
      add(els.shade, [{ opacity: 1 }, { opacity: 1 }], { duration: 1 });
    } else {
      // The tap: the card gives; the hub sinks back while the art blooms out of the card to the whole phone.
      add(req.el, [{ transform: "scale(1)" }, { transform: "scale(0.97)" }], { duration: 120, easing: "ease-out", fill: "forwards" });
      const hub = document.querySelector<HTMLElement>("[data-hub]");
      if (hub) {
        hub.style.transformOrigin = `50% ${window.scrollY + window.innerHeight * 0.45 - (hub.getBoundingClientRect().top + window.scrollY)}px`;
        add(hub, [{ transform: "none" }, { transform: "scale(0.94)" }], { delay: 30, duration: 520, easing: EXPO, fill: "forwards" });
        // Once the art covers the phone, the hub goes from under it: it would be redrawn at its new size as it settles, unseen,
        // stalling the bumper's first moves.
        state.hub = hub;
        later(510, () => (hub.style.visibility = "hidden"));
      }
      add(els.dim, [{ opacity: 0 }, { opacity: 0.6 }], { delay: 30, duration: 420 });
      add(els.art, [{ opacity: 0 }, { opacity: 1 }], { delay: 20, duration: 110 });
      add(els.art, [{ clipPath: clipOf(scope, W, H, 4) }, { clipPath: clipOf({ x: 0, y: 0, w: W, h: H }, W, H) }], { delay: 20, duration: 480, easing: EXPO });
      add(els.shade, [{ opacity: 0 }, { opacity: 1 }], { delay: 160, duration: 360 });
      // Tuning in: once the banner has loaded (never a sweep over a picture that isn't there yet), the scanline curtains it in,
      // its bright edge on the new picture's edge: the curtain slides down while the banner in it slides back up, on the line's
      // clock and curve, so the two move as one. The banner waits behind the curtain until then.
      const sweep = () => {
        if (state.swept || state.folded) return;
        state.swept = performance.now() + SWEEP;
        placeBanner();
        reveal(els.curtain, els.curtainIn, "translateY(-100%)", "translateY(100%)", { duration: SWEEP, easing: SCAN_EASE });
        add(els.scan, [{ transform: `translateY(${-SCAN_EDGE}px)`, opacity: 0 }, { opacity: 1, offset: 0.06 }, { opacity: 1, offset: 0.92 }, { transform: `translateY(${H - SCAN_EDGE}px)`, opacity: 0 }], {
          duration: SWEEP,
          easing: SCAN_EASE,
          fill: "none",
        });
        // Nothing of the card's picture left under it (it would show through as the banner settles into the header).
        add(els.card, [{ opacity: 1 }, { opacity: 0 }], { delay: SWEEP, duration: 1, fill: "forwards" });
        // The hold: a slow push-in on the banner.
        add(els.wrap, [{ transform: "none" }, { transform: "scale(1.08)" }], { delay: SWEEP, duration: CAP, fill: "forwards" });
        later(SWEEP + 20, () => tryFold());
        later(SWEEP + 40, navigate);
      };
      // Decoded first, so the curtain never opens on a picture still being decoded (a big one from another site).
      const decoded = () => els.banner.decode().then(sweep, sweep);
      later(460, () => (bannerReady() ? decoded() : els.banner.addEventListener("load", decoded, { once: true })));
      // The lower third slams in: the colour first, then the name on its plate, then the season under it.
      add(els.tag, [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], { delay: 720, duration: 220, easing: EXPO });
      reveal(els.plateWin, els.plateIn, "translateX(-100%)", "translateX(100%)", { delay: 760, duration: 340, easing: EXPO });
      add(els.name, [{ transform: "translateX(-20px)" }, { transform: "none" }], { delay: 780, duration: 440, easing: EXPO });
      reveal(els.seasonWin, els.seasonIn, "translateX(-100%)", "translateX(100%)", { delay: 920, duration: 280, easing: EXPO });
    }

    // Still loading past the 1.5 s: a bar in the show's colour runs along the plate.
    later(MIN, () => {
      if (state.folded || ready.has(req.seasonId)) return;
      add(els.bar, [{ opacity: 0 }, { opacity: 1 }], { duration: 160 });
      add(els.bar, [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], { duration: CAP - MIN });
    });

    // ---------- the fold ----------
    state.fold = () => {
      if (state.folded) return;
      state.folded = true;
      // When it folded, and why (the show was in, or the cap ran out): for check-tune-in.js.
      els.root.dataset.fold = String(Math.round(performance.now() - state.start));
      els.root.dataset.why = ready.has(req.seasonId) ? "ready" : "cap";
      const bar = document.querySelector<HTMLElement>(".nd-showbar");
      const page = bar?.parentElement?.querySelector("main") ?? null;
      const tabs = document.querySelector<HTMLElement>(".nd-tabbar");
      if (!bar) {
        add(els.root, [{ opacity: 1 }, { opacity: 0 }], { duration: 220 });
        return later(230, end);
      }
      if (still) {
        add(els.root, [{ opacity: 1 }, { opacity: 0 }], { duration: 220, fill: "forwards" });
        return later(230, end);
      }
      const head = rel(bar.getBoundingClientRect(), R);
      const headArt = pictureOf(bar.querySelector("[data-art]"));
      const title = bar.querySelector("h1, b");
      const to = textBox(title);
      const from = textBox(els.name);
      // The art crops into the header, the banner settling where the header shows it: the lift slides up while what's in it slides
      // back down. (A clip where the header isn't at the top, which it always is today.)
      const lift = H - (head.y + head.h);
      if (head.y < 1) {
        add(els.lift, [{ transform: "none" }, { transform: `translateY(${-lift}px)` }], { duration: FOLD, easing: FOLD_EASE, fill: "forwards" });
        add(els.liftIn, [{ transform: "none" }, { transform: `translateY(${lift}px)` }], { duration: FOLD, easing: FOLD_EASE, fill: "forwards" });
      } else {
        add(els.art, [{ clipPath: clipOf({ x: 0, y: 0, w: W, h: H }, W, H) }, { clipPath: clipOf(head, W, H) }], { duration: FOLD, easing: FOLD_EASE, fill: "forwards" });
      }
      // The name leaves its plate: nothing may clip it on its way to the title.
      els.plateWin.style.overflow = "visible";
      const now = getComputedStyle(els.wrap).transform;
      state.anims.filter((a) => (a.effect as KeyframeEffect | null)?.target === els.wrap).forEach((a) => a.cancel());
      add(els.wrap, [{ transform: now === "none" ? "none" : now }, { transform: "none" }], { duration: FOLD, easing: FOLD_EASE, fill: "forwards" });
      if (headArt && bannerReady() && headArt.src === els.banner.currentSrc) {
        add(els.banner, [{ transform: "none" }, { transform: toward(fullBanner(), cover(headArt.w, headArt.h, rel(headArt.box, R), headArt.position)) }], { duration: FOLD, easing: FOLD_EASE, fill: "forwards" });
      }
      els.head.style.top = `${head.y}px`;
      els.head.style.height = `${head.h}px`;
      add(els.head, [{ opacity: 0 }, { opacity: 1 }], { delay: FOLD * 0.3, duration: FOLD * 0.7, fill: "forwards" });
      add(els.shade, [{ opacity: 1 }, { opacity: 0 }], { duration: FOLD * 0.6, fill: "forwards" });
      add(els.dim, [{ opacity: 0.6 }, { opacity: 0 }], { duration: FOLD, fill: "forwards" });
      add(els.plate, [{ opacity: 1 }, { opacity: 0 }], { duration: FOLD * 0.4, fill: "forwards" });
      add(els.tag, [{ opacity: 1 }, { opacity: 0, transform: "translateX(-12px)" }], { duration: FOLD * 0.35, fill: "forwards" });
      add(els.season, [{ opacity: 1 }, { opacity: 0, transform: "translateY(8px)" }], { duration: FOLD * 0.35, fill: "forwards" });
      add(els.bar, [{ opacity: Number(getComputedStyle(els.bar).opacity) || 0 }, { opacity: 0 }], { duration: 150, fill: "forwards" });
      // The name flies to the header's title, from its letters to its letters.
      if (to && from) {
        const n = els.name.getBoundingClientRect();
        els.name.style.transformOrigin = `${from.left - n.left}px ${from.bottom - n.top}px`;
        const s = parseFloat(getComputedStyle(title!).fontSize) / parseFloat(getComputedStyle(els.name).fontSize);
        add(els.name, [{ transform: "none" }, { transform: `translate(${to.left - from.left}px, ${to.bottom - from.bottom}px) scale(${s})` }], { duration: FOLD, easing: FOLD_EASE, fill: "forwards" });
        // Its colour on its own: a colour can't run on the GPU, and in the same animation it would hold the flight back with it.
        add(els.name, [{ color: "#121018" }, { color: "#ffffff" }], { duration: FOLD, easing: FOLD_EASE, fill: "forwards" });
      } else {
        add(els.name, [{ opacity: 1 }, { opacity: 0 }], { duration: FOLD * 0.5, fill: "forwards" });
      }
      // Tonight rises under it, and the tabs come up.
      add(page, [{ opacity: 0, transform: "translateY(36px)" }, { opacity: 1, transform: "none" }], { delay: FOLD * 0.45, duration: 460, easing: EXPO, fill: "backwards" });
      add(tabs, [{ transform: "translateY(100%)" }, { transform: "none" }], { delay: FOLD * 0.3, duration: 420, easing: EXPO, fill: "backwards" });
      // Then the real page takes over.
      add(els.root, [{ opacity: 1 }, { opacity: 0 }], { delay: FOLD, duration: 180, fill: "forwards" });
      later(FOLD + 190, () => {
        // The page's own animations keep running; only the bumper's go.
        state.anims = state.anims.filter((a) => {
          const t = (a.effect as KeyframeEffect | null)?.target;
          return t !== page && t !== tabs;
        });
        end();
      });
    };
    // (Called by the sweep, which only runs later, so it's defined in time.)
    const tryFold = () => {
      const t = performance.now() - state.start;
      // Never mid-sweep: a banner that loaded late finishes its curtain first.
      if (state.folded || (typeof state.swept === "number" && performance.now() < state.swept)) return;
      const settled = ready.has(req.seasonId) && performance.now() - (readyAt.get(req.seasonId) ?? 0) >= SETTLE;
      if ((t >= MIN && settled) || t >= CAP) state.fold?.();
      else if (t >= MIN && ready.has(req.seasonId)) later(SETTLE, tryFold);
    };
    later(MIN, tryFold);
    later(CAP, tryFold);
    // Until it ends: a later render (the hub's data coming back) must not drop the page's "ready".
    state.unsub = subscribe(tryFold);
    // Runs once per request (keyed on its id inside); the refs are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [req, show]);

  if (!req || (req.kind === "go" && !show)) return null;
  // A tap once the show is ready skips the rest of the hold.
  const skip = () => {
    if (req.kind === "go" && ready.has(req.seasonId) && run.current && !run.current.folded) run.current.fold?.();
  };
  return (
    <div ref={rootRef} data-tune-in={req.kind} onClick={skip} className="nd-fixed-x fixed inset-y-0 z-[95] overflow-hidden" aria-hidden>
      {req.kind === "go" && <Warm seasonId={req.seasonId} />}
      <div ref={dimRef} className="absolute inset-0 bg-[#08070c] opacity-0" />
      <div ref={artRef} className="absolute inset-0 overflow-hidden bg-[#16141d]">
        <div ref={liftRef} className="absolute inset-0 overflow-hidden">
          <div ref={liftInRef} className="absolute inset-0">
            {/* eslint-disable-next-line @next/next/no-img-element -- the card's art, wherever it's hosted */}
            <img ref={cardRef} alt="" className="absolute left-0 top-0 max-w-none origin-top-left" />
            <div ref={curtainRef} data-tune-curtain className="absolute inset-0 overflow-hidden" style={{ transform: "translateY(-100%)" }}>
              <div ref={curtainInRef} className="absolute inset-0" style={{ transform: "translateY(100%)" }}>
                <div ref={wrapRef} className="absolute inset-0 origin-[50%_40%]">
                  {/* eslint-disable-next-line @next/next/no-img-element -- the show's banner, wherever it's hosted */}
                  <img ref={bannerRef} src={req.kind === "go" ? (bannerSrc ?? undefined) : undefined} alt="" className="absolute left-0 top-0 max-w-none origin-top-left" />
                </div>
              </div>
            </div>
            <div
              ref={shadeRef}
              className="absolute inset-0 opacity-0 bg-[linear-gradient(180deg,rgba(16,14,21,.35)_0%,rgba(16,14,21,0)_20%,rgba(16,14,21,0)_46%,rgba(16,14,21,.72)_76%,rgba(16,14,21,.94)_100%)]"
            />
            <div
              ref={headRef}
              className="absolute inset-x-0 opacity-0 bg-[linear-gradient(90deg,#16141d_0%,rgba(22,20,29,.85)_30%,rgba(22,20,29,.1)_65%),linear-gradient(180deg,transparent_60%,#16141d_100%)]"
            />
          </div>
        </div>
      </div>
      <div ref={thirdRef} className="absolute inset-x-4 bottom-[18%]" style={{ display: req.kind === "go" ? undefined : "none" }}>
        <div className="flex items-stretch">
          <span ref={tagRef} className="relative z-[1] w-[26px] flex-none origin-left bg-[#5089c9] [clip-path:polygon(0_0,100%_0,calc(100%_-_10px)_100%,0_100%)]" />
          <span className="relative -ml-2.5 block min-w-0">
            {/* Room in the window for the plate's shadow: on the inside, so the window and what's in it slide the same distance. */}
            <span ref={plateWinRef} className="-my-10 -mr-10 block overflow-hidden" style={{ transform: "translateX(-100%)" }}>
              <span ref={plateInRef} className="relative block py-10 pr-10" style={{ transform: "translateX(100%)" }}>
                <span ref={plateRef} className="absolute inset-y-10 left-0 right-10 bg-white shadow-[0_10px_30px_rgba(0,0,0,.35)]" />
                <span ref={nameRef} className="type-caption relative block whitespace-nowrap pb-1 pl-4 pr-[22px] pt-2 leading-none text-[#121018]">
                  {name}
                </span>
              </span>
            </span>
            <span ref={barRef} data-tune-bar className="absolute inset-x-0 bottom-0 h-[3px] origin-left bg-[#5089c9] opacity-0" />
          </span>
        </div>
        <span ref={seasonWinRef} className="ml-[30px] mt-1.5 inline-block overflow-hidden align-top" style={{ transform: "translateX(-100%)" }}>
          <span ref={seasonInRef} className="block" style={{ transform: "translateX(100%)" }}>
            <span
              ref={seasonRef}
              className="type-caption block bg-[#16141d] py-[7px] pl-3 pr-[22px] text-[15px] leading-none tracking-[0.05em] text-white [clip-path:polygon(0_0,100%_0,calc(100%_-_9px)_100%,0_100%)]"
            >
              {line}
            </span>
          </span>
        </span>
      </div>
      <div
        ref={scanRef}
        data-tune-scan
        className="pointer-events-none absolute inset-x-0 top-0 h-[96px] opacity-0 mix-blend-screen bg-[linear-gradient(180deg,rgba(255,255,255,0)_0%,rgba(255,255,255,.05)_55%,rgba(255,255,255,.2)_90%,rgba(255,255,255,.95)_96.5%,rgba(255,255,255,.3)_98.5%,rgba(255,255,255,0)_100%)]"
      />
    </div>
  );
}

"use client";

import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useQueryClient, type Query, type QueryClient } from "@tanstack/react-query";

// A page shows its loading look once and then its content, never content that comes and goes (the user, 2026-10-29: on
// several pages parts weren't loaded yet, or showed and then went). A page's sections each have their own reads and came
// in one by one, an empty state or a default first ("On no couch yet", "Checking…") and the real thing after, the page
// shifting each time. So the page's content is put up hidden, under its loading look, and shown all at once when it has
// loaded: no read on screen still on its first load and nothing in it still a skeleton ([aria-busy]), for a moment
// running (a read that waits on another starts just after it). Then it stays: a later read is the page's own business.
// Content whose reads are all in already (a page you come back to) shows at once, before anything paints. A read that
// never comes back doesn't hold the page past MAX_MS. A section that measures or scrolls itself into place (Chat opening
// at the newest message) waits for useShown(). scripts/dev-test/check-flashes.js checks it.

const QUIET_MS = 120;
const MAX_MS = 4000;
/** A read made this recently that nothing has subscribed to yet (its section does once it's committed) counts as loading. */
const STARTING_MS = 1000;

// When each read was made, per client: one listener for the app's life, so a page made in the same render as its reads
// (useShow's, in the tab's own render) still sees them.
const made = new WeakMap<QueryClient, WeakMap<Query, number>>();
function madeOf(qc: QueryClient) {
  let log = made.get(qc);
  if (!log) {
    const at = new WeakMap<Query, number>();
    log = at;
    made.set(qc, at);
    qc.getQueryCache().subscribe((e) => {
      if (e.type === "added") at.set(e.query, performance.now());
    });
  }
  return log;
}

/** A read on screen still on its first load, or one just made that's about to start. */
function reading(qc: QueryClient) {
  const at = madeOf(qc);
  const now = performance.now();
  return qc
    .getQueryCache()
    .getAll()
    .some((q) => q.state.status === "pending" && (q.getObserversCount() > 0 ? q.state.fetchStatus !== "idle" : now - (at.get(q) ?? -Infinity) < STARTING_MS));
}

const Shown = createContext(true);
/** Whether the content is on screen yet (true outside a Loaded): for a section that measures or scrolls itself into place. */
export const useShown = () => useContext(Shown);

export function Loaded({ fallback, children }: { fallback: ReactNode; children: ReactNode }) {
  const qc = useQueryClient();
  // Before the content renders, so the reads it makes are logged.
  madeOf(qc);
  const box = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const loading = () => reading(qc) || !!box.current?.querySelector("[aria-busy]:not([aria-busy=false])");

  // Everything in already: shown before the first paint.
  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- before paint, so the loading look never shows
    if (!loading()) setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, as it mounts
  }, []);

  useEffect(() => {
    if (ready) return;
    const start = performance.now();
    let quietFrom: number | null = null;
    let frame = 0;
    const tick = () => {
      const now = performance.now();
      if (loading()) quietFrom = null;
      else quietFrom ??= now;
      if ((quietFrom != null && now - quietFrom >= QUIET_MS) || now - start >= MAX_MS) setReady(true);
      else frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loading reads the cache and the box as they are
  }, [ready]);

  return (
    <Shown.Provider value={ready}>
      {!ready && fallback}
      {/* The same element either way, so the content isn't mounted twice. Hidden, it's laid out in the phone's column but
          not seen, read or tapped, and adds nothing to the page's height. */}
      <div
        ref={box}
        data-loaded={ready || undefined}
        aria-hidden={ready ? undefined : true}
        inert={!ready}
        className={ready ? undefined : "nd-fixed-x pointer-events-none invisible fixed top-0 h-0 overflow-hidden"}
      >
        {children}
      </div>
    </Shown.Provider>
  );
}

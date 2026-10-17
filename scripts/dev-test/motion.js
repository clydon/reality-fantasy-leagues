// Dev-only test bank: control and observe motion in the headless test browser (docs/PLAN-league-tabs.md,
// the animate + delight pass). Mid-interaction captures are flaky while things move, so a check picks how
// the browser treats motion, and can ask what actually animated.
//
//   const { open } = require("./browser");
//   const { page, settle, motion } = await open({ user, pass, motion: "off" });   // or MOTION=off in the env
//
// motion: "on" (default, real timings) | "off" (every animation and transition runs for 0s, so a capture
// sees the end state at once; timers and gestures still run) | "reduce" (prefers-reduced-motion: the app's
// own reduced paths, which is what a check of those wants). `watch: true` (or MOTION_WATCH=1) also records
// every animation and transition that starts, for `motion.seen()`:
//   [{ kind: "CSSTransition"|"CSSAnimation", name, props: ["transform", ...], ms, target: "div.pill", at }]
// (`at` is performance.now() in the page when it was first seen, to compare with a tap's own timestamp).
// `settle()` waits for everything running to finish (after a tap, before a capture, in "on" mode).
// `motion.offProps(seen)` lists the ones animating anything but transform and opacity: the house rule.
// Nothing here touches the database, so there is nothing to key with zt- or take down.

const OFF_CSS =
  "*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition-duration:0s!important;transition-delay:0s!important;scroll-behavior:auto!important}";

/** Runs in every page of the context, before the app: motion off, and/or the animation recorder. */
async function install(context, { mode, watch }) {
  if (mode === "off") {
    await context.addInitScript((css) => {
      const add = () => {
        const el = document.createElement("style");
        el.textContent = css;
        (document.head || document.documentElement).appendChild(el);
      };
      if (document.head) add();
      else document.addEventListener("DOMContentLoaded", add, { once: true });
    }, OFF_CSS);
  }
  if (watch) {
    await context.addInitScript(() => {
      window.__motion = [];
      const seen = new WeakSet();
      const skip = new Set(["offset", "easing", "composite", "computedOffset"]);
      const name = (el) => (el ? `${el.tagName.toLowerCase()}${el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".") : ""}` : "?");
      const tick = () => {
        for (const a of document.getAnimations()) {
          if (seen.has(a)) continue;
          seen.add(a);
          const e = a.effect;
          let props = [];
          try {
            props = [...new Set(e.getKeyframes().flatMap((k) => Object.keys(k).filter((x) => !skip.has(x))))];
          } catch { /* no keyframes */ }
          window.__motion.push({
            kind: a.constructor.name,
            name: a.animationName || a.transitionProperty || "",
            props: a.transitionProperty ? [a.transitionProperty] : props,
            ms: e ? e.getComputedTiming().duration : 0,
            target: name(e && e.target),
            at: performance.now(),
          });
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }
}

const settle = (page) =>
  page.evaluate(async () => {
    for (let i = 0; i < 20; i++) {
      const running = document.getAnimations().filter((a) => a.playState === "running");
      if (!running.length) return;
      await Promise.allSettled(running.map((a) => a.finished));
    }
  });

const motionApi = (page) => ({
  /** Everything that has started animating since `clear()` (needs watch). */
  seen: () => page.evaluate(() => window.__motion || []),
  clear: () => page.evaluate(() => { window.__motion = []; }),
  /** Entries that animate something other than transform or opacity (the house rule). */
  offProps: (list) => list.filter((a) => a.props.some((p) => !["transform", "opacity", "translate", "scale", "rotate"].includes(p))),
});

module.exports = { install, settle, motionApi };

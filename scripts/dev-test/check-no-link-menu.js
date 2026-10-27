// Checks no-link-menu.tsx: in the installed app on a phone, a long press's contextmenu event is
// cancelled on links (no "copy link address / download link" menu) but not in a text box (paste
// still works); in a browser tab nothing is cancelled. Headless Chromium can't be installed, so a
// "standalone" run stands in for it by answering (display-mode: standalone) true in matchMedia.
// The iOS half (-webkit-touch-callout in globals.css) isn't checkable here: Chromium ignores it.
//
//   node scripts/dev-test/check-no-link-menu.js [width=390]
//
// Needs `npm run dev`. Signed out, on /sign-in (a link and a text box); touches no data.
const { open } = require("./browser");

(async () => {
  const width = parseInt(process.argv[2] || "390", 10);
  const fails = [];
  const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) fails.push(what); };

  for (const standalone of [true, false]) {
    const { page, errors, BASE, close } = await open({ width });
    if (standalone) {
      await page.addInitScript(() => {
        const real = window.matchMedia.bind(window);
        window.matchMedia = (q) => (/display-mode:\s*standalone/.test(q) ? { ...real(q), matches: true, media: q } : real(q));
      });
    }
    await page.goto(BASE + "/sign-in", { waitUntil: "networkidle" });
    // Whether a contextmenu fired at the first match of `sel` was cancelled.
    const cancelled = (sel) => page.evaluate((s) => {
      const el = document.querySelector(s);
      if (!el) return null;
      const e = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
      el.dispatchEvent(e);
      return e.defaultPrevented;
    }, sel);
    const where = standalone ? "installed app" : "browser tab";
    const link = await cancelled("a[href]");
    const input = await cancelled("input");
    check(link === standalone, `${where}: long press on a link ${standalone ? "is" : "isn't"} cancelled (got ${link})`);
    check(input === false, `${where}: long press in a text box isn't cancelled (got ${input})`);
    // Signed out, the session fetch 401s: that's the page working, not an error.
    const real = errors.filter((e) => !/status of 401/.test(e));
    check(real.length === 0, `${where}: no page errors${real.length ? ": " + real.join(" | ") : ""}`);
    await close();
  }
  console.log(fails.length ? `\n${fails.length} failed` : "\nall ok");
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

// Dev-only test bank: contrast of Overview's header text over the show's key art (docs/PLAN-league-tabs.md,
// step 7, light touch 5). Needs npm run dev, and network for the show's art_url (the art is a remote image).
//
//   node scripts/dev-test/check-header-art.js <outDir> [width] [--dark] [--name="Couch Crew"] [--show=survivor] [--keep]
//
// Brings linked-fixture.js up (so the league strip is in the header), opens Overview as its zt_tester, hides
// the header's text, screenshots what's behind it, and measures every piece of text and every icon against the
// pixels under it: the worst pixel's WCAG contrast ratio and the 5th-percentile pixel's. The design system wants
// 7:1 for text over art (DESIGN.md). Prints one line per piece and FAIL under 7:1 (icons: under 3:1); writes
// <outDir>/art-<width>[-dark].png (the header as a player sees it). A chip with the open pill behind it sits on
// its own fill, not the art, so it's measured against the pill (foreground) instead. --show swaps the fixture
// league's show to another with art (the catalog's art_style is the show's own look, so each can differ).
// Nothing here touches a real league: it's all zt-*.
require("dotenv").config({ path: ".env.local", quiet: true });
const { Pool } = require("pg");
const { open } = require("./browser");
const fixture = require("./linked-fixture");

(async () => {
  const [out, w = "390", ...flags] = process.argv.slice(2);
  if (!out) throw new Error('usage: check-header-art.js <outDir> [width] [--dark] [--name="Couch Crew"] [--show=survivor] [--keep]');
  const width = parseInt(w, 10);
  const dark = flags.includes("--dark");
  const groupName = (flags.find((f) => f.startsWith("--name=")) || "").slice(7) || "Couch Crew";
  const show = (flags.find((f) => f.startsWith("--show=")) || "").slice(7) || null;
  const suffix = `${width}${dark ? "-dark" : ""}${show ? `-${show}` : ""}`;
  const pool = new Pool({ connectionString: process.env.AUTH_DATABASE_URL });
  let failed = false;
  try {
    const made = await fixture.up(pool, { groupName });
    if (show) {
      for (const l of made) {
        const { rows } = await pool.query(`SELECT state FROM leagues WHERE id = $1`, [l.leagueId]);
        rows[0].state.settings.showId = show;
        await pool.query(`UPDATE leagues SET state = $2 WHERE id = $1`, [l.leagueId, JSON.stringify(rows[0].state)]);
      }
    }
    const { LATEST_RELEASE_ID } = require("jiti")(__filename)("../../src/lib/whats-new.ts");
    await pool.query(
      `INSERT INTO user_settings (user_id, whats_new_seen) SELECT id, $2 FROM "user" WHERE username=$1
       ON CONFLICT (user_id) DO UPDATE SET whats_new_seen = $2`,
      [fixture.USERNAME, LATEST_RELEASE_ID]
    );
    const { page, errors, BASE, close } = await open({ user: fixture.USERNAME, pass: fixture.PASSWORD, width });
    await page.addInitScript((t) => {
      localStorage.setItem("rfl.theme", t);
      localStorage.setItem("rfl.notifyNudge", JSON.stringify({ dismissals: 1, until: Date.now() + 864e5 }));
    }, dark ? "dark" : "light");
    await page.goto(`${BASE}/?league=${made[0].leagueId}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    const go = page.locator("button", { hasText: /Let.s go!/ });
    if (await go.count()) await go.first().click().catch(() => {});
    await page.waitForSelector(".show-art img", { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(800);
    const hasArt = await page.evaluate(() => {
      const img = document.querySelector(".show-art img");
      return !!img && img.complete && img.naturalWidth > 0;
    });
    if (!hasArt) console.log("NOTE: no art loaded for this show (no art_url, or the image didn't load): nothing to measure.");

    const header = page.locator("header").first();
    await header.screenshot({ path: `${out}/art-${suffix}.png` });

    // What each piece of text / icon is, where, and its colour; then hide them all and photograph the art alone.
    const items = await page.evaluate(() => {
      const h = document.querySelector("header");
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      const rgb = (c) => {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = "#000";
        ctx.fillStyle = c;
        ctx.fillRect(0, 0, 1, 1);
        const d = ctx.getImageData(0, 0, 1, 1).data;
        return [d[0], d[1], d[2], d[3] / 255];
      };
      const hb = h.getBoundingClientRect();
      const list = [];
      const walker = document.createTreeWalker(h, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = walker.nextNode())) {
        if (!n.textContent.trim()) continue;
        const el = n.parentElement;
        const r = document.createRange();
        r.selectNodeContents(n);
        const b = r.getBoundingClientRect();
        if (b.width < 2 || b.height < 2) continue;
        // The strip's second, clipped copy of the labels is read through the pill; skip it (its parent is clipped).
        const cs = getComputedStyle(el);
        const onPill = !!el.closest("[class*='bg-foreground']") || !!el.closest("[class*='text-background']");
        list.push({ kind: "text", what: n.textContent.trim().slice(0, 28), x: b.left - hb.left, y: b.top - hb.top, w: b.width, h: b.height, color: rgb(cs.color), onPill });
      }
      for (const svg of h.querySelectorAll("svg")) {
        const b = svg.getBoundingClientRect();
        if (b.width < 2) continue;
        const cs = getComputedStyle(svg);
        list.push({ kind: "icon", what: svg.closest("button,a")?.getAttribute("aria-label") || "icon", x: b.left - hb.left, y: b.top - hb.top, w: b.width, h: b.height, color: rgb(cs.color), onPill: false });
      }
      const pill = h.querySelector("[role=group] .bg-foreground");
      const fg = rgb(getComputedStyle(document.body).color);
      const pillColor = pill ? rgb(getComputedStyle(pill).backgroundColor) : fg;
      return { list, pillColor };
    });
    await page.addStyleTag({ content: "header *{color:transparent !important;stroke:transparent !important;caret-color:transparent !important}header svg{opacity:0 !important}header [class*='bg-foreground'],header [class*='text-background']{opacity:0 !important}" });
    await page.waitForTimeout(200);
    const shot = (await header.screenshot()).toString("base64");

    const results = await page.evaluate(
      async ({ shot, items }) => {
        const img = new Image();
        img.src = "data:image/png;base64," + shot;
        await img.decode();
        const k = img.naturalWidth / document.querySelector("header").getBoundingClientRect().width;
        const c = document.createElement("canvas");
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        const ctx = c.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(img, 0, 0);
        const lum = ([r, g, b]) => {
          const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
          return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
        };
        const ratio = (a, b) => {
          const [hi, lo] = lum(a) > lum(b) ? [lum(a), lum(b)] : [lum(b), lum(a)];
          return (hi + 0.05) / (lo + 0.05);
        };
        return items.list.map((it) => {
          const bg = (px) => px;
          const fg = it.color;
          if (it.onPill) {
            const r = ratio(fg, items.pillColor);
            return { ...it, worst: r, p5: r, own: true };
          }
          const x = Math.max(0, Math.floor(it.x * k)), y = Math.max(0, Math.floor(it.y * k));
          const w = Math.max(1, Math.min(c.width - x, Math.ceil(it.w * k))), h = Math.max(1, Math.min(c.height - y, Math.ceil(it.h * k)));
          const d = ctx.getImageData(x, y, w, h).data;
          const rs = [];
          for (let i = 0; i < d.length; i += 4) {
            // Blend the text colour's own alpha over this pixel.
            const a = fg[3];
            const mixed = [0, 1, 2].map((j) => fg[j] * a + d[i + j] * (1 - a));
            rs.push(ratio(mixed, [d[i], d[i + 1], d[i + 2]]));
          }
          rs.sort((a, b) => a - b);
          return { ...it, worst: rs[0], p5: rs[Math.floor(rs.length * 0.05)] };
        });
      },
      { shot, items }
    );

    console.log(`\nheader over ${hasArt ? "art" : "(no art)"} at ${width}px ${dark ? "dark" : "light"}:`);
    for (const r of results) {
      const need = r.kind === "icon" ? 3 : 7;
      const bad = r.worst < need;
      if (bad) failed = true;
      console.log(
        `  ${bad ? "FAIL" : "ok  "} ${r.kind.padEnd(4)} ${String(r.what).padEnd(28)} worst ${r.worst.toFixed(1)}:1  p5 ${r.p5.toFixed(1)}:1${r.own ? "  (on the open pill)" : ""}`
      );
    }
    if (errors.length) console.log("\nerrors:", errors.slice(0, 5));
    await close();
  } finally {
    if (!flags.includes("--keep")) await fixture.down(pool);
    await pool.end();
  }
  if (failed) process.exitCode = 2;
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

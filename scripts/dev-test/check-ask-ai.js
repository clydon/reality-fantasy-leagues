// Dev-only test bank: the "Or skip the copy: open it in (test)" links (components/ask-ai.tsx), on Admin >
// New show. Types a show name, waits for the brief to be parked, checks every chat link carries the
// one-liner pointing at /b/<code>, fetches that page the way ChatGPT's fetcher would (its user agent),
// and checks the row's "Read by" line names ChatGPT. Also checks the brief's JSON twin (the custom GPT's
// action) and that a made-up code 404s.
//
//   node scripts/dev-test/check-ask-ai.js up
//   node scripts/dev-test/check-ask-ai.js run <outDir> [width=390] [--dark]   (needs `up` + npm run dev)
//   node scripts/dev-test/check-ask-ai.js down
//
// Makes a throwaway admin, zt_ask_admin / zt-pass-12345. Briefs it parks are keyed on that user, so
// `down` deletes them with it and can't touch real data. Never run against a real database.
require("dotenv").config({ path: ".env.local", quiet: true });
const crypto = require("crypto");
const fs = require("fs");
const { Pool } = require("pg");

const ADMIN = "zt_ask_admin";
const PASSWORD = "zt-pass-12345";
const id = () => Array.from(crypto.randomBytes(24), (b) => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join("");
const CHATGPT_UA = "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot";

async function down(pool) {
  await pool.query(`DELETE FROM ai_briefs WHERE created_by IN (SELECT id FROM "user" WHERE username=$1)`, [ADMIN]);
  await pool.query(`DELETE FROM "user" WHERE username=$1`, [ADMIN]);
}

async function up(pool) {
  await down(pool);
  const { hashPassword } = await import("better-auth/crypto");
  const userId = id();
  await pool.query(
    `INSERT INTO "user" (id, name, email, "emailVerified", username, "displayUsername", role, "createdAt", "updatedAt")
     VALUES ($1,$2,$3,true,$2,$2,'admin',now(),now())`,
    [userId, ADMIN, `${ADMIN}@example.invalid`]
  );
  await pool.query(
    `INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt") VALUES ($1,$2,'credential',$2,$3,now(),now())`,
    [id(), userId, await hashPassword(PASSWORD)]
  );
  console.log(`up: admin ${ADMIN} / ${PASSWORD}`);
}

async function run(out, width, flags) {
  fs.mkdirSync(out, { recursive: true });
  const { open, BASE } = require("./browser");
  const failures = [];
  const expect = (ok, what) => (ok ? console.log("ok  ", what) : (failures.push(what), console.log("FAIL", what)));
  const tag = `${width}-${flags.includes("--dark") ? "dark" : "light"}`;

  const { page, errors, close } = await open({ user: ADMIN, pass: PASSWORD, width });
  await page.addInitScript((t) => localStorage.setItem("rfl.theme", t), flags.includes("--dark") ? "dark" : "light");
  await page.goto(`${BASE}/admin/shows/new`, { waitUntil: "networkidle" });
  // A fresh name each run: the same prompt is the same brief, which an earlier run has already read.
  await page.getByLabel("Show name").fill(`zt Ask Show ${Date.now() % 100000}`);
  await page.waitForSelector("text=Nobody has opened the brief yet.", { timeout: 20000 });

  const hrefs = await page.$$eval("a[target=_blank]", (as) => as.map((a) => ({ name: a.textContent.trim(), href: a.href })));
  const chats = hrefs.filter((h) => /chatgpt|claude|gemini|google|perplexity|grok|copilot/.test(h.href));
  expect(chats.length >= 7, `seven chat links (${chats.map((c) => c.name).join(", ")})`);
  const line = decodeURIComponent(new URL(chats[0].href).searchParams.get("q") || "");
  const briefUrl = (line.match(/https?:\/\/\S+\/b\/[A-Za-z0-9_-]{16}/) || [])[0];
  expect(!!briefUrl, `the one-liner points at a brief: "${line.slice(0, 90)}…"`);
  expect(line.length < 500, `the one-liner is short (${line.length} chars)`);
  expect(chats.every((c) => decodeURIComponent(c.href).includes(briefUrl)), "every link carries the same brief");
  await page.screenshot({ path: `${out}/ask-ai-${tag}-links.png`, fullPage: true });

  const res = await fetch(briefUrl, { headers: { "User-Agent": CHATGPT_UA } });
  const body = await res.text();
  expect(res.ok && res.headers.get("content-type").startsWith("text/plain"), "the brief is served as plain text");
  expect(res.headers.get("x-robots-tag")?.includes("noindex"), "the brief is noindex");
  expect(body.length > 2000, `the brief is the full prompt (${body.length} chars)`);
  const code = briefUrl.split("/b/")[1];
  const json = await (await fetch(`${BASE}/api/briefs/${code}`)).json();
  expect(json.instructions === body, "the GPT action's JSON carries the same text");
  expect((await fetch(`${BASE}/b/AAAAAAAAAAAAAAAA`)).status === 404, "an unknown code 404s");

  await page.waitForSelector("text=/Read by .*ChatGPT/", { timeout: 15000 }).catch(() => {});
  const readBy = await page.locator("text=/Read by/").first().textContent().catch(() => "");
  expect(/ChatGPT/.test(readBy), `the row says who read it: "${readBy}"`);
  await page.locator("text=/Read by/").first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${out}/ask-ai-${tag}-read.png` });

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(!overflow, "no horizontal scroll");
  expect(errors.length === 0, `no page errors${errors.length ? `: ${errors.join(" | ")}` : ""}`);
  await close();
  if (failures.length) {
    console.log(`\n${failures.length} failed`);
    process.exitCode = 1;
  }
}

(async () => {
  const [cmd, out, w = "390", ...flags] = process.argv.slice(2);
  const pool = new Pool({ connectionString: process.env.AUTH_DATABASE_URL });
  try {
    if (cmd === "up") await up(pool);
    else if (cmd === "down") {
      await down(pool);
      console.log("down: removed");
    }
    else if (cmd === "run" && out) await run(out, parseInt(w, 10), flags);
    else throw new Error("usage: check-ask-ai.js up | run <outDir> [width] [--dark] | down");
  } finally {
    await pool.end();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

// Plays the linked-league reveal (needs linked-fixture.js up + npm run dev) and screenshots each beat.
//   node scripts/dev-test/check-reveal.js <outDir> [width]
const { open } = require("./browser");
(async () => {
  const out = process.argv[2], width = parseInt(process.argv[3] || "390", 10);
  const { page, errors, BASE, close } = await open({ user: "zt_tester", pass: "zt-pass-12345", width });
  await page.goto(BASE + "/reveal/6", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  for (let i = 0; i < 40; i++) {
    await page.screenshot({ path: `${out}/beat-${String(i).padStart(2, "0")}.png` });
    if (await page.getByText("See the full recap").count()) break;
    await page.mouse.click(width / 2, 300);
    await page.waitForTimeout(450);
  }
  console.log("errors:", errors.slice(0, 5));
  await close();
})().catch((e) => { console.error(e); process.exit(1); });

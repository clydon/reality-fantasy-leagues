// The corrections on an episode's page (src/new/show/something-wrong.tsx Corrections), for the checks that drive them
// (check-new-community.js, check-new-settling.js, check-new-ours.js): never at the top of the page or as rows in the
// Episodes list, only one section right above "Something wrong in this episode?", closed by default, saying how many
// ("9 corrections to this episode", a house ruling counted too); opened, a plate each.
//
//   const { openCorrections, noCorrections, noCorrectionRows } = require("./corrections");
//   const plates = await openCorrections(page, check, { count: 1, rulings: 1 });   // on an episode page; returns the plates' texts
//   await noCorrections(page, check);                                               // an episode with none: no section
//   await noCorrectionRows(page, check);                                            // the Episodes list: no correction rows
//
// `check(ok, label, detail)` is the calling check's own. Needs nothing else: no fixture, no rows of its own.

/** `phrase` in `text` as whole words and numbers: "1 correction" isn't in "11 corrections", nor "1 house ruling" in "1 house rulings". */
const says = (text, phrase) => new RegExp(`(?:^|[^0-9])${phrase}(?:$|[^a-z])`, "i").test(text);

/** On an episode page with corrections: where the section sits, closed with its count, then opened. Returns the plates' texts. */
async function openCorrections(page, check, { count, rulings = 0, where = "the episode page" } = {}) {
  const section = page.locator("[data-corrections]");
  await section.waitFor({ timeout: 20000 });
  const toggle = section.locator("[data-corrections-toggle]");
  const placed = await page.evaluate(() => {
    const ep = document.querySelector("[data-episode-page]");
    const wrong = document.querySelector("[data-something-wrong]")?.closest("section");
    const corr = document.querySelector("[data-corrections]");
    // Right above Something wrong's own section, and not the page's first thing.
    return { above: !!wrong && wrong.previousElementSibling === corr, first: ep?.firstElementChild === corr };
  });
  check(placed.above && !placed.first, `${where}: the corrections sit right above "Something wrong in this episode?", not at the top`, JSON.stringify(placed));
  check((await toggle.getAttribute("aria-expanded")) === "false" && (await page.locator("[data-corrected]").count()) === 0, `${where}: the corrections are closed, no plates shown`);
  const row = await toggle.innerText();
  const said = `${count} ${count === 1 ? "correction" : "corrections"} to this episode`;
  check(says(row, said), `${where}: the row says ${said}`, row);
  check(rulings ? says(row, `${rulings} house ruling${rulings === 1 ? "" : "s"}`) : !/house ruling/i.test(row), `${where}: ${rulings ? `the row names ${rulings} house ruling${rulings === 1 ? "" : "s"}` : "no house ruling on the row"}`, row);
  await toggle.click();
  await page.locator("[data-corrected]").first().waitFor({ timeout: 10000 });
  const plates = await page.locator("[data-corrected]").allInnerTexts();
  check((await toggle.getAttribute("aria-expanded")) === "true" && plates.length === count && plates.every((p) => /Corrected/i.test(p) && /changed it for everyone/.test(p)), `${where}: opened, a Corrected plate each`, plates.join(" | "));
  return plates;
}

/** An episode page with nothing corrected: no section at all, once its results are in (data-results-in). */
async function noCorrections(page, check, where = "an episode with no corrections") {
  await page.locator("[data-episode-page][data-results-in]").waitFor({ timeout: 20000 });
  check((await page.locator("[data-corrections], [data-corrected]").count()) === 0, `${where}: no corrections section`);
}

/** The Episodes list: corrections live only on the episode's page (data-correction-row was the old row's mark). */
async function noCorrectionRows(page, check) {
  await page.locator("[data-ep]").first().waitFor({ timeout: 20000 });
  check((await page.locator("[data-correction-row], [data-corrected], [data-corrections]").count()) === 0, "the Episodes list: no correction rows");
}

module.exports = { openCorrections, noCorrections, noCorrectionRows };

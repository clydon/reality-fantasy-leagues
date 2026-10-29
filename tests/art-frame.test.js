// A show's art, framed (docs/PLAN-desk-parity.md part 7b; src/lib/art-frame.ts): a framing set for one image frames that image
// only (classic's, with no image of its own, framed the show's poster), it rides on the image's address and comes back off it,
// the window over the whole image follows the point the crops keep, and classic never reads one set for another image.
// Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { cleanArtLink, cleanFrame, classicArtStyle, frameAt, frameFor, frameLine, frameStyle, framedUrl, frameWindow, splitFrame } = jiti("../src/lib/art-frame.ts");

const POSTER = "https://image.tmdb.org/t/p/w500/s51.jpg";
const SHOW = "https://example.com/key-art.jpg";

test("a framing frames the image it was set on, and nothing else", () => {
  const style = { x: 64, y: 20, zoom: 1.25, url: POSTER };
  assert.deepEqual(frameFor(style, POSTER, SHOW), { x: 64, y: 20, zoom: 1.25 });
  assert.equal(frameFor(style, "https://image.tmdb.org/t/p/w500/s50.jpg", SHOW), null);
  assert.equal(frameFor(style, null, SHOW), null);
  assert.equal(frameFor(null, POSTER, SHOW), null);
  // The desk's cards framing sits under `frame`, beside classic's own: each frames its own image.
  const both = { y: 88, color: 1, frame: { x: 8, y: 50, zoom: 2, url: POSTER } };
  assert.deepEqual(frameFor(both, POSTER, SHOW), { x: 8, y: 50, zoom: 2 });
  assert.deepEqual(frameFor(both, SHOW, SHOW), { x: 50, y: 88, zoom: 1 });
  assert.equal(frameFor({ frame: { x: 8, y: 50, zoom: 2, url: POSTER } }, SHOW, SHOW), null);
  // Colour and strength alone are no framing.
  assert.equal(frameFor({ color: 0.5, strength: 3 }, SHOW, SHOW), null);
});

test("classic's framing (no image of its own) frames the show's poster, with classic's defaults", () => {
  assert.deepEqual(frameFor({ y: 88, color: 1 }, SHOW, SHOW), { x: 50, y: 88, zoom: 1 });
  assert.deepEqual(frameFor({ x: 68 }, SHOW, SHOW), { x: 68, y: 40, zoom: 1 });
  // A season's poster isn't what classic framed.
  assert.equal(frameFor({ x: 55, y: 0, zoom: 1.9 }, POSTER, SHOW), null);
  // Out of range is clamped.
  assert.deepEqual(frameFor({ x: 140, y: -3, zoom: 9 }, SHOW, SHOW), { x: 100, y: 0, zoom: 3 });
});

test("a framing rides on the image's address and comes back off it", () => {
  const f = { x: 64, y: 50, zoom: 1.25 };
  const url = framedUrl(POSTER, f);
  assert.equal(url, `${POSTER}#frame=64,50,1.25`);
  assert.deepEqual(splitFrame(url), { src: POSTER, frame: f });
  assert.deepEqual(splitFrame(POSTER), { src: POSTER, frame: null });
  assert.deepEqual(splitFrame(null), { src: null, frame: null });
  assert.equal(framedUrl(POSTER, null), POSTER);
  assert.equal(framedUrl(null, f), null);
  // Framed again, it carries the new one only.
  assert.equal(framedUrl(url, { x: 1, y: 2, zoom: 1 }), `${POSTER}#frame=1,2,1`);
  // A fragment of the image's own stays the image's.
  assert.deepEqual(splitFrame("https://x.org/a.jpg#top"), { src: "https://x.org/a.jpg#top", frame: null });
});

test("the desk saves whole percentages and one of its four zooms", () => {
  assert.deepEqual(cleanFrame({ x: 63.6, y: 20.2, zoom: 1.5 }), { x: 64, y: 20, zoom: 1.5 });
  assert.equal(cleanFrame({ x: 50, y: 50, zoom: 1.4 }), null);
  assert.equal(cleanFrame({ x: 50, zoom: 1 }), null);
  assert.equal(cleanFrame(null), null);
  assert.deepEqual(cleanFrame({ x: 120, y: -5, zoom: 2 }), { x: 100, y: 0, zoom: 2 });
});

test("a framing draws as object-position, and a zoom from that point", () => {
  assert.deepEqual(frameStyle({ x: 64, y: 50, zoom: 1 }), { objectPosition: "64% 50%" });
  assert.deepEqual(frameStyle({ x: 8, y: 50, zoom: 2 }), { objectPosition: "8% 50%", transform: "scale(2)", transformOrigin: "8% 50%" });
  assert.equal(frameLine({ x: 50, y: 50, zoom: 1 }), "Centred");
  assert.equal(frameLine({ x: 64, y: 50, zoom: 1 }), "64% across, 50% down");
  assert.equal(frameLine({ x: 8, y: 30, zoom: 1.25 }), "8% across, 30% down · 1.25× zoom");
});

test("the window over the whole image is what the main crop keeps", () => {
  // A 16:9 image in a poster crop (0.707): the crop keeps a narrow column, full height.
  const w = frameWindow({ x: 0, y: 50, zoom: 1 }, 16 / 9, 0.707);
  assert.ok(Math.abs(w.width - 0.707 / (16 / 9)) < 1e-9);
  assert.equal(w.height, 1);
  assert.equal(w.left, 0);
  assert.equal(frameWindow({ x: 100, y: 50, zoom: 1 }, 16 / 9, 0.707).left + w.width, 1);
  // Zoomed 2×: half as big, still inside.
  const z = frameWindow({ x: 100, y: 100, zoom: 2 }, 16 / 9, 0.707);
  assert.equal(z.height, 0.5);
  assert.ok(Math.abs(z.left + z.width - 1) < 1e-9 && Math.abs(z.top + z.height - 1) < 1e-9);
  // A finger at the image's left edge puts the window there; at its centre, the middle; the axis it can't move stays 50.
  assert.deepEqual(frameAt({ x: 50, y: 50, zoom: 1 }, 16 / 9, 0.707, 0, 0.9), { x: 0, y: 50, zoom: 1 });
  assert.deepEqual(frameAt({ x: 10, y: 50, zoom: 1 }, 16 / 9, 0.707, 0.5, 0.5), { x: 50, y: 50, zoom: 1 });
});

test("classic reads the desk's framing of its own poster, and never one set for another image", () => {
  assert.deepEqual(classicArtStyle({ y: 88, color: 1, frame: { x: 8, y: 50, zoom: 2, url: POSTER } }, SHOW), { y: 88, color: 1 });
  assert.equal(classicArtStyle({ frame: { x: 8, y: 50, zoom: 2, url: POSTER } }, SHOW), null);
  assert.deepEqual(classicArtStyle({ y: 88, color: 1, frame: { x: 8, y: 50, zoom: 2, url: SHOW } }, SHOW), { x: 8, y: 50, zoom: 2, color: 1 });
  // Classic's own (no image) is as it was.
  assert.deepEqual(classicArtStyle({ x: 55, y: 0, zoom: 1.9, color: 0.85 }, SHOW), { x: 55, y: 0, zoom: 1.9, color: 0.85 });
  assert.equal(classicArtStyle(null, SHOW), null);
});

test("a link is an image's https address, nothing else", () => {
  assert.equal(cleanArtLink("  https://images.example.com/a/key-art.jpg "), "https://images.example.com/a/key-art.jpg");
  for (const x of ["http://images.example.com/a.jpg", "https://images.example.com/", "https://localhost/a.jpg", "not a link", "https://x.com/a b.jpg", `https://x.com/${"a".repeat(2000)}.jpg`, null, 5])
    assert.equal(cleanArtLink(x), null, String(x).slice(0, 40));
});

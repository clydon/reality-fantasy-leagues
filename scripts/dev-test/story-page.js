// A screenshot story's page (docs/DESIGN-PROCESS.md, "The screenshot story"), built from a story-spec.json: an intro, sections of
// before/after pairs and single frames with captions, and any closing HTML, in story-page.template.html's look (a reading column,
// phone frames on a quiet ground, a tap to see a frame full size). Frames are copied next to the page under img/, and files.json
// lists them for the Artifact publish's `files`.
//
// The spec: { title, name, root, intro (HTML), sections: [{ id, title, lede (HTML), pairs: [{ caption, lens, before, after }],
// frames: [{ caption, lens, src }], after (HTML) }] }. Paths in pairs and frames are relative to `root` (or start with ".ui-atlas/").
// Needs nothing running. Run: node scripts/dev-test/story-page.js <story-spec.json>   -> <root>/story/<name>.html
const fs = require("fs");
const path = require("path");

const specPath = process.argv[2];
if (!specPath) throw new Error("usage: node scripts/dev-test/story-page.js <story-spec.json>");
const spec = JSON.parse(fs.readFileSync(specPath, "utf8"));
const repo = path.resolve(__dirname, "../..");
const root = path.resolve(repo, spec.root);
const out = path.join(root, "story");
fs.mkdirSync(path.join(out, "img"), { recursive: true });
const files = [];
const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/** A frame copied under img/ (its path flattened), its published path back. */
function img(src) {
  const from = src.startsWith(".ui-atlas/") ? path.resolve(repo, src) : path.resolve(root, src);
  if (!fs.existsSync(from)) throw new Error(`no frame ${from}`);
  const name = `img/${src.replace(/[\\/]/g, "__")}`;
  fs.copyFileSync(from, path.join(out, name));
  if (!files.includes(name)) files.push(name);
  return name;
}
function figure(src, { tag, lens, caption }) {
  const at = img(src);
  const alt = `${tag ? `${tag === "before" ? "Before" : "After"}: ` : ""}${lens || ""}`;
  return `<figure class="frame"><button class="shot" type="button" data-full="${at}" aria-label="Open full size: ${esc(alt)}">${tag ? `<span class="tag tag-${tag}">${tag}</span>` : ""}<img src="${at}" alt="${esc(alt)}" loading="lazy"></button><figcaption>${lens ? `<p class="lens">${lens}</p>` : ""}${caption || ""}</figcaption></figure>`;
}

const body = [`<header class="top">${spec.intro}</header>`];
body.push(`<nav class="toc" aria-label="Sections">${spec.sections.map((s) => `<a href="#${s.id}">${s.title}</a>`).join("")}</nav>`);
for (const s of spec.sections) {
  const parts = [`<section id="${s.id}"><h2>${s.title}</h2>`];
  if (s.lede) parts.push(`<div class="read lede2">${s.lede}</div>`);
  for (const p of s.pairs ?? []) parts.push(`<div class="pair">${figure(p.before, { tag: "before" })}${figure(p.after, { tag: "after", lens: p.lens, caption: p.caption })}</div>`);
  if (s.frames?.length) parts.push(`<div class="frames">${s.frames.map((f) => figure(f.src, f)).join("")}</div>`);
  if (s.after) parts.push(`<div class="read">${s.after}</div>`);
  parts.push("</section>");
  body.push(parts.join(""));
}
const template = fs.readFileSync(path.join(__dirname, "story-page.template.html"), "utf8");
const page = template.replace("{{TITLE}}", esc(spec.title)).replace("{{BODY}}", body.join("\n"));
fs.writeFileSync(path.join(out, `${spec.name}.html`), page);
fs.writeFileSync(path.join(out, "files.json"), JSON.stringify(files, null, 1));
console.log(`${path.join(out, `${spec.name}.html`)} · ${files.length} frames`);

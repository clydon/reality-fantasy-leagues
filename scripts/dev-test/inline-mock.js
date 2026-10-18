// Makes a self-contained copy of an HTML mock: inlines ../showcase/data.js and turns every showcase
// photo it references into a data: URI, so the file opens anywhere (phone, Claude app) on its own.
//
//   node scripts/dev-test/inline-mock.js <mock.html> [out.html]
//
// Default out: <mock>-standalone.html next to the input. One-off safe to re-run; no DB access.
const fs = require("fs"), path = require("path");
const [inp, outArg] = process.argv.slice(2);
if (!inp) throw new Error("usage: inline-mock.js <mock.html> [out.html]");
const dir = path.dirname(inp);
let html = fs.readFileSync(inp, "utf8");
const dataPath = path.join(dir, "../showcase/data.js");
let data = fs.readFileSync(dataPath, "utf8");
// photos referenced as img/... inside the data become data: URIs
data = data.replace(/"img\/([^"]+\.jpg)"/g, (m, p) => {
  const f = path.join(dir, "../showcase/img", p);
  return fs.existsSync(f) ? `"data:image/jpeg;base64,${fs.readFileSync(f).toString("base64")}"` : m;
});
html = html.replace('<script src="../showcase/data.js"></script>', () => `<script>${data}</script>`);
// mocks build URLs as ../showcase/<photo>; a data: URI must pass through untouched
html = html.replace(/`\.\.\/showcase\/\$\{([^}]+)\}`/g, (m, expr) => `((${expr})||'').startsWith('data:')?(${expr}):\`../showcase/\${${expr}}\``);
const out = outArg || inp.replace(/\.html$/, "-standalone.html");
fs.writeFileSync(out, html);
console.log("wrote", out, (fs.statSync(out).size / 1e6).toFixed(1) + " MB");

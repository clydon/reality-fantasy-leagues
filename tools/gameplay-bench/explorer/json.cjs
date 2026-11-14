const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const clone = value => JSON.parse(JSON.stringify(value));
function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (object(value)) return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  return JSON.stringify(value);
}
const digest = value => crypto.createHash('sha256').update(canonical(value)).digest('hex');
const pointer = value => String(value).replace(/~/g, '~0').replace(/\//g, '~1');

// A local-tool execution budget, not a gameplay limit. Inspect before cloning or hashing.
function assertJson(value) {
  let count = 0;
  const parents = new Set();
  const walk = (v, at, depth) => {
    if (++count > 250000 || depth > 64) throw Error('Scenario inspection budget exceeded at ' + at);
    if (v === null || typeof v === 'boolean' || typeof v === 'string') return;
    if (typeof v === 'number' && Number.isFinite(v)) return;
    if (!v || typeof v !== 'object' || (!Array.isArray(v) && ![Object.prototype, null].includes(Object.getPrototypeOf(v)))) throw Error('Expected JSON data at ' + at);
    if (parents.has(v)) throw Error('Cyclic scenario data at ' + at);
    parents.add(v);
    for (const [key, item] of Object.entries(v)) {
      if (['__proto__', 'constructor', 'prototype'].includes(key)) throw Error('Reserved object key at ' + at + '/' + pointer(key));
      if (/^(password|accessToken|refreshToken|apiKey|secret|authorization|cookie|session_token)$/i.test(key) && typeof item === 'string' && item.trim()) throw Error('Credential-shaped data at ' + at + '/' + pointer(key));
      walk(item, at + '/' + pointer(key), depth + 1);
    }
    parents.delete(v);
  };
  walk(value, '', 0);
}

function filesIn(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? filesIn(path.join(dir, entry.name)) : [path.join(dir, entry.name)]).sort();
}
function treeHash(dir, skip = () => false) {
  return digest(filesIn(dir).filter(file => /\.(cjs|js|ts|json|html|css)$/.test(file) && !skip(path.relative(dir, file).split(path.sep).join('/'))).map(file => [path.relative(dir, file).split(path.sep).join('/'), fs.readFileSync(file, 'utf8')]));
}
let cachedVersions;
function versions() {
  if (!cachedVersions) {
    const game = path.resolve(__dirname, '../../../src/lib/game');
    cachedVersions = {
      document: 2,
      engine: digest([treeHash(game), treeHash(path.resolve(game, '../sports'))]),
      // Presentation-only files (the explorer page, the design mock, the old shell) can't change a game's state, so editing
      // them must not invalidate saved runs.
      adapters: treeHash(path.resolve(__dirname, '..'), rel => /^(explorer\/page\/|design\/)|^shell\.(html|css|js)$|^runtime-client\.js$/.test(rel)),
    };
  }
  return clone(cachedVersions);
}
module.exports = { object, clone, canonical, digest, pointer, assertJson, filesIn, treeHash, versions };

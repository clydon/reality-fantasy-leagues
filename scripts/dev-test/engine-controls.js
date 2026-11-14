// Positive controls on the engine, one after another: each is a temporary edit of a source file (a rule broken on purpose), a
// command run in a fresh process against it, and the file put back byte for byte (docs/GAMEPLAY-EXPLORER.md, "Lessons from the
// breadth program": a control on the engine is an edit of its file, never an in-process patch, because the projection's
// TypeScript loads its own copy). A check has teeth only if the broken rule makes it fail: the command's output says how many.
//
// For each control: the file is copied aside, `find` (which must occur exactly once) is replaced by `replace`, `--run` is executed,
// the copy is written back and its SHA-256 compared with the one taken before. A control whose text isn't found exactly once is
// skipped and reported (the engine moved on: fix the control). The file is restored even when the run throws or is interrupted
// (Ctrl+C); if this process is killed outright, restore by hand from <file>.control-backup.
//
// NEVER while a campaign runs (its workers load the engine fresh for each case: a case in that window plays the broken rule).
// The file may hold uncommitted work: the restore keeps it (it restores what was there, not git's copy).
//
// Controls file (JSON): [{ "name": "what is broken", "file": "src/lib/game/state-logic.js", "find": "exact text", "replace": "text" }]
//   (file optional: src/lib/game/state-logic.js). A rule two guards protect needs both broken at once: give "edits": [{ find, replace }, ...]
//   in place of find and replace (a control that passes may only show the other guard held).
// Run:   node scripts/dev-test/engine-controls.js --controls=<controls.json> --run="node .ui-atlas/campaigns/<name>/control.cjs 80" [--log=<file>] [--only=<regex>]
//        The run's stdout is printed (trimmed with --tail=<chars>, default 1500) under each control's name, after a first run on
//        the unedited file (the baseline: it must show no failure for the controls to mean anything).
const fs = require('fs'), path = require('path'), crypto = require('crypto'), { execSync } = require('child_process');
const root = path.resolve(__dirname, '../..');
const arg = k => process.argv.find(a => a.startsWith('--' + k + '='))?.slice(k.length + 3);
const controlsFile = arg('controls'), run = arg('run'), logFile = arg('log'), only = arg('only'), tail = Number(arg('tail') || 1500);
if (!controlsFile || !run) { console.error('Use --controls=<controls.json> --run="<command>" (see the header)'); process.exit(1); }
const controls = JSON.parse(fs.readFileSync(path.resolve(controlsFile), 'utf8')).filter(c => !only || new RegExp(only, 'i').test(c.name));
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const lines = [], say = text => { console.log(text); lines.push(text); if (logFile) fs.writeFileSync(path.resolve(logFile), lines.join('\n') + '\n'); };
const exec = () => { try { return execSync(run, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024, timeout: 3600000 }); } catch (e) { return (e.stdout || '') + '\n[exit ' + (e.status ?? e.signal) + '] ' + (e.stderr || e.message || '').slice(-600); } };
const trim = text => { const t = text.trim(); return t.length > tail ? '…' + t.slice(-tail) : t; };

const files = [...new Set(controls.map(c => path.resolve(root, c.file || 'src/lib/game/state-logic.js')))], before = new Map(files.map(f => [f, sha(f)]));
for (const f of files) { if (fs.existsSync(f + '.control-backup')) { console.error('A backup from an interrupted run exists: ' + f + '.control-backup. Compare and restore it by hand first.'); process.exit(1); } }
let editing = null;
const restore = () => { if (!editing) return; fs.copyFileSync(editing + '.control-backup', editing); fs.unlinkSync(editing + '.control-backup'); editing = null; };
process.on('SIGINT', () => { restore(); process.exit(130); });
for (const f of files) say('before ' + path.relative(root, f) + ' ' + before.get(f));
say('BASELINE (unedited): ' + trim(exec()));
for (const c of controls) {
  const file = path.resolve(root, c.file || 'src/lib/game/state-logic.js'), source = fs.readFileSync(file, 'utf8'), edits = c.edits || [{ find: c.find, replace: c.replace }];
  const off = edits.map(e => source.split(e.find).length - 1).find(n => n !== 1);
  if (off !== undefined) { say('SKIPPED ' + c.name + ': one of its texts occurs ' + off + ' times in ' + path.relative(root, file) + ', not once'); continue; }
  fs.copyFileSync(file, file + '.control-backup'); editing = file;
  try { fs.writeFileSync(file, edits.reduce((text, e) => text.replace(e.find, () => e.replace), source)); say('CONTROL ' + c.name + ': ' + trim(exec())); }
  finally { restore(); }
  if (sha(file) !== before.get(file)) { say('NOT RESTORED: ' + path.relative(root, file) + ' differs from before. Stop and look.'); process.exit(2); }
}
for (const f of files) say('after  ' + path.relative(root, f) + ' ' + sha(f) + (sha(f) === before.get(f) ? ' (identical)' : ' (DIFFERENT)'));

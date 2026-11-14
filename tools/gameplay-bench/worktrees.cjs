// The local app servers a bench case can be rendered by: this checkout and each git worktree (lanes), each with its own
// port (BETTER_AUTH_URL) and its own local database (AUTH_DATABASE_URL) in its .env.local (scripts/lane.js sets these).
// Database URLs stay server-side: callers return only branch, folder name and port.
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const ROOT = path.resolve(__dirname, '../..');
const local = url => { try { return ['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname); } catch { return false; } };
function worktreeApps() {
  let text = '';
  try { text = execFileSync('git', ['-C', ROOT, 'worktree', 'list', '--porcelain'], { encoding: 'utf8', windowsHide: true }); } catch { return []; }
  return text.split(/\r?\n\r?\n/).filter(Boolean).map(block => {
    const line = k => (block.match(new RegExp('^' + k + ' (.*)$', 'm')) || [])[1];
    const dir = path.resolve(line('worktree') || ''), branch = (line('branch') || '').replace('refs/heads/', '') || null;
    const file = path.join(dir, '.env.local');
    if (!fs.existsSync(file)) return null;
    const env = require('dotenv').parse(fs.readFileSync(file));
    const port = env.BETTER_AUTH_URL ? Number(new URL(env.BETTER_AUTH_URL).port || 80) : (dir === ROOT ? 3000 : null);
    const db = env.AUTH_DATABASE_URL && local(env.AUTH_DATABASE_URL) ? env.AUTH_DATABASE_URL : null;
    return port && db ? { dir, folder: path.basename(dir), branch, port, db, main: dir === ROOT } : null;
  }).filter(Boolean);
}
module.exports = { worktreeApps };

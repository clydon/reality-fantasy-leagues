// Gameplay explorer page (approved bench-v2 design, 2026-11-12). Talks to the bench's runtime routes
// (tools/gameplay-bench/router.cjs runtime/*); every case is live (zt-gb rows, real routes). In compare mode a second case
// is opened from the same input on another app version and every action is applied to both, so they stay at one step.
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const COLORS = ['#c79be0', '#f0c24c', '#7fd0bf', '#f29a7a', '#8fb4f0', '#e48fb6'];
  const released = s => ['partial', 'final', 'corrected'].includes(s);
  // Times relative to the case's now: the app shows the same airing at its shifted wall-clock time, so absolute scenario
  // dates would disagree with the screen; "in 1 day" never does.
  const rel = (iso, now) => { const d = Date.parse(iso) - now, a = Math.abs(d), h = Math.round(a / 3600000), dd = Math.round(a / 86400000), span = a >= 36 * 3600000 ? dd + ' days' : a >= 20 * 3600000 ? '1 day' : h >= 1 ? h + (h === 1 ? ' hour' : ' hours') : 'moments'; return d > 0 ? 'in ' + span : span + ' ago'; };
  // Only rewrite a region when its content changed: a re-render mid-click must not swap the button under the pointer.
  const setHTML = (el, html) => { if (el.dataset.html !== html) { el.dataset.html = html; el.innerHTML = html; } };

  const ui = { surface: 'tonight', gameId: null, viewerId: null, app: 'http://localhost:3000', appB: null, compare: false, size: '390x844', theme: 'night', panel: 'checks', evidence: true, episode: null };
  const sides = { a: null, b: null }; // { id, state, frame, oracles, routeCheck }
  let opened = null, renderers = [], seq = 0, busy = false, meta = null;

  async function api(route, body) {
    const res = await fetch('/__atlas/bench/' + route, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {});
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw Error(json.error || 'Request failed (' + res.status + ')');
    return json;
  }
  function error(e) { $('error').textContent = e ? (e.message || String(e)) : ''; $('error').hidden = !e; }
  // Actions run one after another, in the order they were asked for: one started while another runs waits its turn,
  // never silently dropped (a choice made mid-refresh used to vanish).
  let queue = Promise.resolve();
  function task(fn) {
    queue = queue.then(async () => {
      busy = true; $('stage').classList.add('busy'); error(null);
      try { await fn(); } catch (e) { error(e); } finally { busy = false; $('stage').classList.remove('busy'); render(); }
    });
    return queue;
  }
  // Saves and reveals made inside the app reach the runtime through the server, not through this page: look every 2.5 s
  // (skipped while an action runs) and re-render when the run moved on, so Who's watching and the evidence stay current.
  setInterval(async () => {
    const a = sides.a; if (busy || !a?.id || !a.state) return;
    try {
      const s = await api('runtime/state?id=' + encodeURIComponent(a.id));
      if (busy || sides.a !== a) return;
      if (s.hash !== a.state.hash || s.trace.length !== a.state.trace.length) { a.state = s; render(); }
    } catch { /* closed meanwhile */ }
  }, 2500);

  // ---------- opening ----------
  async function normalize(saved, name) {
    if (saved?.kind === 'gameplay-campaign-reproducer') {
      const run = await api('execute', { input: saved.input, steps: saved.executeSteps || [] });
      if (!run.execution) throw Error('The reproducer did not run: ' + (run.message || run.status));
      const failed = saved.result?.outcome && saved.result.outcome !== 'pass';
      return { input: run.execution, label: 'Campaign ' + saved.campaign + ' · case ' + saved.index, source: (failed ? 'fail:' : '') + (saved.result?.signature || saved.result?.outcome || 'reproducer') };
    }
    if (saved?.execution?.kind === 'gameplay-execution' && !saved.kind) return { input: saved.execution, label: name, source: 'Execution result · ' + name };
    if (saved?.kind === 'gameplay-bench') throw Error('This is a run from the old recipe bench. Open it there (Open… → Start from a recipe).');
    const kinds = { 'gameplay-scenario': 'Definition', 'gameplay-execution': 'Saved execution', 'gameplay-bench-runtime': 'Saved explorer run' };
    if (!kinds[saved?.kind] && !saved?.spec) throw Error('Choose a definition, saved run, execution or campaign reproducer (JSON).');
    return { input: saved, label: name, source: (kinds[saved.kind] || 'Spec') + ' · ' + name };
  }
  async function openCase(next) {
    await closeAll();
    opened = next;
    // A new case starts fresh: the last case's game and people don't exist in this one.
    ui.gameId = null; ui.viewerId = null; ui.episode = null; if (['full', 'quick', 'detail', 'reveal'].includes(ui.surface)) ui.surface = 'tonight';
    const a = await openSide(ui.app);
    if (a.status === 'blocked') { showGap(a); return; }
    sides.a = a; ui.viewerId = a.state.viewerId; ui.gameId = a.state.gameId; ui.episode = null;
    if (ui.compare && ui.appB) { const b = await openSide(ui.appB); if (b.status !== 'blocked') sides.b = b; }
    try { $('notes').value = localStorage.getItem('explorer-notes:' + a.state.documentId) || ''; } catch {}
  }
  async function openSide(app) {
    const r = await api('runtime/open', { input: opened.input, app, surface: ui.surface, theme: ui.theme, gameId: ui.gameId || undefined, viewerId: ui.viewerId || undefined, label: opened.label, source: opened.source });
    if (r.status === 'blocked') return r;
    return { id: r.state.id, state: r.state, frame: r.frame, oracles: null, routeCheck: null, app };
  }
  async function closeAll() {
    // Frames first, then their cases, so nothing is left loading from a server that's going away.
    const ids = ['a', 'b'].filter(k => sides[k]).map(k => sides[k].id); sides.a = sides.b = null; renderStage();
    for (const id of ids) await api('runtime/close', { id }).catch(() => {});
    $('gap').hidden = true;
  }
  function showGap(report) {
    $('gap').hidden = false; $('gap-title').textContent = 'This can’t open in the shared runtime yet';
    $('gap-why').textContent = (report.message || '').replace(/[.\s]*$/, '.');
    const needs = (report.gaps || []).map(g => g.reason || g.message || g.key).filter(Boolean);
    setHTML($('gap-list'), [...needs.map(n => '<li>Needs: ' + esc(n) + '</li>'), '<li>Nothing was generated in its place, and the previous screens were closed so they can’t be mistaken for it.</li>'].join(''));
  }

  // ---------- everything after: one case or two in step ----------
  const each = async fn => { const out = []; for (const k of ['a', 'b']) if (sides[k]) out.push(await fn(sides[k], k)); return out; };
  async function frames(extra = {}) {
    const mine = ++seq;
    await each(async side => {
      const r = await api('runtime/select', { id: side.id, viewerId: ui.viewerId, gameId: ui.gameId || undefined, surface: ui.surface, theme: ui.theme, ...(ui.surface === 'reveal' && ui.episode ? { episode: ui.episode } : {}), ...extra });
      if (mine !== seq) return; // a newer request wins
      side.state = r.state; side.frame = r.frame; side.oracles = null; side.routeCheck = null;
    });
  }
  async function refresh() { await each(async side => { side.state = await api('runtime/state?id=' + encodeURIComponent(side.id)); }); }
  async function act(action) { await each(async side => { const r = await api('runtime/apply', { id: side.id, action }); if (r.result?.status !== 'accepted') throw Error(r.result?.message || 'Not accepted'); side.state = r.state; }); await frames(); }
  async function publish(eventId, status) { await each(async side => { const r = await api('runtime/publish', { id: side.id, eventId, status }); if (r.result?.status !== 'accepted') throw Error(r.result?.message || 'Not accepted'); side.state = r.state; }); await frames(); }

  // ---------- rendering ----------
  function render() {
    const s = sides.a?.state;
    $('reset').disabled = $('export').disabled = !s;
    renderCase(s); renderPeople(s); renderBets(s); renderEpisodes(s); renderTabs(s); renderStepper(s); renderStage(); renderEvidence();
    $('layout').classList.toggle('no-evidence', !ui.evidence);
  }
  function renderCase(s) {
    if (!s) { $('case-title').textContent = $('gap').hidden ? 'Nothing open' : (opened?.label || 'Can’t open'); setHTML($('case-meta'), $('gap').hidden ? '<span class="small">Open a definition, a saved run or a campaign reproducer, or start from the example.</span>' : '<span class="chip fail">Can’t run yet</span>'); return; }
    const fail = (s.source || '').startsWith('fail:');
    $('case-title').textContent = s.title;
    setHTML($('case-meta'), (s.live ? '<span class="chip live">Real routes · local database</span>' : '<span class="chip">Shaped responses (no database)</span>') +
      (s.source ? '<span class="chip' + (fail ? ' fail' : '') + '">' + esc(fail ? 'Failed: ' + s.source.slice(5) : s.source) + '</span>' : '') +
      '<span class="small">' + s.people.length + (s.people.length === 1 ? ' person' : ' people') + ' · ' + s.games.length + (s.games.length === 1 ? ' game' : ' games') + ' · ' + s.events.length + ' episodes · revision ' + s.revision + '</span>');
  }
  function renderPeople(s) {
    $('people-hint').hidden = !s;
    if (!s) { setHTML($('people'), '<p class="hint">Nothing to situate yet.</p>'); return; }
    const latest = s.latest;
    setHTML($('people'), s.people.map((p, i) => {
      const behind = latest - p.seen, viewing = p.id === ui.viewerId;
      const dots = s.events.map(e => '<i class="' + (e.number <= p.seen ? 'seen' : '') + '"></i>').join('');
      const reveal = behind > 0 ? '<button class="link" data-reveal="' + esc(p.id) + '">Reveal ' + (p.seen + 1) + '</button>' : '';
      return '<div class="person" role="radio" tabindex="0" data-viewer="' + esc(p.id) + '" aria-checked="' + viewing + '"><span class="face" style="background:' + COLORS[i % COLORS.length] + '">' + esc(p.name[0]) + '</span>' +
        '<span><b>' + esc(p.name) + '</b><small>' + (p.seen ? 'Watched through ' + p.seen : 'Nothing watched yet') + (behind > 0 ? ' · <span class="tag">' + behind + ' behind</span>' : '') + '</small><span class="dots" aria-hidden="true">' + dots + '</span></span>' +
        '<span style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">' + (viewing ? '<span class="viewing">Viewing</span>' : '') + reveal + '</span></div>';
    }).join(''));
  }
  function renderEpisodes(s) {
    $('episodes-section').hidden = !s; if (!s) return;
    const clock = Date.parse(s.clock || 0), next = s.events.find(e => !released(e.resultStatus));
    setHTML($('episodes'), s.events.map(e => {
      const st = e.resultStatus, isNext = next && e.id === next.id, aired = e.airAt && Date.parse(e.airAt) <= clock;
      const line = released(st) ? (e.out.length ? esc(e.out.join(' and ')) + ' went home' : 'Results in · nobody went home') : aired ? 'Aired · nothing published' : e.airAt ? 'Not aired' : 'No air time';
      let doIt = '<span class="state">Later</span>';
      if (released(st)) doIt = '<span class="do"><span class="state ' + st + '">' + (st === 'corrected' ? 'Corrected' : st === 'partial' ? 'Partial' : 'Final') + '</span>' + (st === 'partial' ? '<button data-publish="final" data-ev="' + e.id + '">Final</button>' : '<button data-publish="corrected" data-ev="' + e.id + '">Correct</button>') + '</span>';
      else if (isNext) doIt = aired ? '<span class="do"><button data-publish="partial" data-ev="' + e.id + '">Partial</button><button data-publish="final" data-ev="' + e.id + '">Final</button></span>' : '<button data-air="' + e.id + '">Air it</button>';
      return '<div class="ep' + (isNext ? ' next' : '') + '"><span class="n">' + e.number + '</span><span><b>' + (e.airAt ? (aired ? 'Aired ' : 'Airs ') + esc(rel(e.airAt, clock)) : 'Episode ' + e.number) + '</b><small title="' + line.replace(/"/g, '&quot;') + '">' + line + '</small></span>' + doIt + '</div>';
    }).join(''));
    $('clock').textContent = 'Times are relative to this case’s now, which the app sees as the real now.';
  }
  // Side bets: the app lets players guess, but not post or grade, so the explorer does those (as runtime actions).
  function renderBets(s) {
    const on = !!s?.betGames?.length; $('bets-section').hidden = !on; if (!on) return;
    const clock = Date.parse(s.clock), open = s.events.filter(e => !released(e.resultStatus) && !(e.airAt && Date.parse(e.airAt) <= clock));
    setHTML($('bet-episode'), open.map(e => '<option value="' + esc(e.id) + '">Episode ' + e.number + '</option>').join('') || '<option value="">No open episode</option>');
    $('bet-game').hidden = s.betGames.length < 2; setHTML($('bet-game'), s.betGames.map(g => '<option value="' + esc(g.id) + '">' + esc(s.games.find(x => x.id === g.id)?.name || g.id) + '</option>').join(''));
    $('bet-post').disabled = !open.length;
    const me = s.people.find(p => p.id === ui.viewerId), boss = id => s.people.find(p => p.id === s.betGames.find(g => g.id === id)?.commissioner)?.name || 'the commissioner';
    $('bet-who').textContent = 'Posted as ' + (me?.name || '') + '. Guesses are made in the app (Your moves → Predictions).';
    const name = id => s.people.find(p => p.id === id)?.name || id;
    setHTML($('bets'), s.bets.slice().reverse().map(b => {
      const ev = s.events.find(e => e.id === b.eventId), closed = released(ev?.resultStatus) || (ev?.airAt && Date.parse(ev.airAt) <= clock);
      const guesses = b.predictions.length ? b.predictions.map(q => '<div class="guess"><span>' + esc(name(q.playerId)) + ': ' + esc(q.guess) + (q.correct === true ? ' <span class="right">right</span>' : q.correct === false ? ' <span class="wrong">wrong</span>' : '') + '</span>' +
        (closed ? '<span class="mark"><button data-grade="true" data-bet="' + esc(b.betId) + '" data-pred="' + esc(q.id) + '" data-game="' + esc(b.gameId) + '" data-ev="' + esc(b.eventId) + '">Right</button><button data-grade="false" data-bet="' + esc(b.betId) + '" data-pred="' + esc(q.id) + '" data-game="' + esc(b.gameId) + '" data-ev="' + esc(b.eventId) + '">Wrong</button></span>' : '<span class="small">open</span>') + '</div>').join('') : '<p class="hint" style="margin-top:6px">No guesses yet.</p>';
      return '<div class="bet"><b>' + esc(b.label) + '</b><small>Episode ' + b.episode + ' · ' + b.points + (b.points === 1 ? ' point' : ' points') + (closed && b.predictions.length ? ' · mark as ' + esc(boss(b.gameId)) : '') + '</small>' + guesses + '</div>';
    }).join(''));
  }
  function renderTabs(s) {
    document.querySelectorAll('[data-surface]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.surface === ui.surface)));
    const games = s ? s.games.filter(g => g.contextId === s.contextId) : [];
    setHTML($('game'), '<option value="">Games…</option>' + games.map(g => '<option value="' + esc(g.id) + '"' + (ui.surface === 'full' && g.id === ui.gameId ? ' selected' : '') + '>' + esc(g.name) + '</option>').join(''));
    $('game').classList.toggle('on', ui.surface === 'full');
    $('more').value = ['quick', 'detail', 'reveal', 'wizard'].includes(ui.surface) ? ui.surface : '';
    $('app-b').hidden = !ui.compare; $('compare').setAttribute('aria-checked', String(ui.compare));
    for (const el of document.querySelectorAll('#tabs button,#tabs select,#app,#app-b,#compare,#size,#theme')) el.disabled = !s;
  }
  function renderStepper(s) {
    const st = s?.steps; $('stepper').hidden = !st || !st.recorded;
    if (!st || !st.recorded) return;
    $('stepper').classList.toggle('failing', (s.source || '').startsWith('fail:'));
    $('step-label').innerHTML = 'Step <b style="color:var(--ink)">' + Math.min(st.at, st.recorded) + '</b> of ' + st.recorded + (st.at > st.recorded ? ' · then ' + (st.at - st.recorded) + ' of yours' : '');
    setHTML($('step-track'), Array.from({ length: st.recorded }, (_, i) => '<i class="' + (i + 1 < st.at ? 'done' : i + 1 === st.at ? 'at' : '') + '"></i>').join(''));
    $('step-back').disabled = st.at <= 0; $('step-forward').disabled = st.at >= st.recorded;
  }
  const scaleFor = () => { const [w, h] = ui.size.split('x').map(Number), desk = w > 800, phoneLayout = innerWidth < 760; return { w, h, desk, s: desk ? (ui.compare ? .3 : .5) : phoneLayout ? .62 : ui.compare ? .72 : .8 }; };
  function renderStage() {
    const open = ['a', 'b'].filter(k => sides[k]), recipe = !$('recipe').hidden;
    $('empty').hidden = !!open.length || !$('gap').hidden || recipe; $('stage').hidden = !$('gap').hidden || recipe; $('same').hidden = open.length < 2;
    const { w, h, desk, s } = scaleFor();
    for (const k of ['a', 'b']) {
      let dev = $('device-' + k);
      if (!sides[k]) { dev?.remove(); continue; }
      if (!dev) { dev = document.createElement('div'); dev.className = 'device'; dev.id = 'device-' + k; dev.innerHTML = '<div class="who"></div><div class="phone"><iframe title=""></iframe></div><div class="checks" aria-live="polite"></div>'; $('stage').append(dev);
        // After each load: the screen's UI checks (bridge.js), and the case's state (a save in the app may have changed it).
        const key = k; dev.querySelector('iframe').addEventListener('load', () => setTimeout(() => { const side = sides[key], win = dev.isConnected && dev.querySelector('iframe')?.contentWindow; if (!side?.frame || !win) return; /* replaced meanwhile (another case opened) */ win.postMessage({ atlasCommand: true, type: 'oracles' }, side.frame.origin); refresh().then(render).catch(() => {}); }, 1500)); }
      const side = sides[k], st = side.state, me = st.people.find(p => p.id === ui.viewerId), label = renderers.find(r => r.app === side.app)?.label || side.app;
      dev.querySelector('.who').innerHTML = open.length > 1 ? '<b>' + esc(label.replace(/ \(:\d+\)$/, '')) + '</b>' + esc((label.match(/\(:\d+\)$/) || [''])[0]) : '<b>' + esc(me?.name || '') + '</b>· ' + esc(surfaceName()) + ' · ' + esc(label.replace(/ \(:\d+\)$/, ''));
      const phone = dev.querySelector('.phone'); phone.classList.toggle('desk', desk); phone.style.setProperty('--w', w); phone.style.setProperty('--h', h); phone.style.setProperty('--s', s);
      const frame = dev.querySelector('iframe'); frame.title = 'The app as ' + (me?.name || '') + ': ' + surfaceName();
      if (side.frame && frame.dataset.url !== side.frame.url + '#' + st.revision + ui.viewerId) { frame.dataset.url = side.frame.url + '#' + st.revision + ui.viewerId; frame.src = side.frame.url; }
      dev.querySelector('.checks').innerHTML = side.oracles ? (side.oracles.found.length ? side.oracles.found.map(f => '<span class="no" title="' + esc(f.detail) + '"><svg><use href="#i-x"/></svg>' + esc(ORACLES[f.oracle] || f.oracle) + '</span>').join('') : '<span class="ok"><svg><use href="#i-check"/></svg>No sideways scroll</span><span class="ok"><svg><use href="#i-check"/></svg>Choices read differently</span><span class="ok"><svg><use href="#i-check"/></svg>Every control named</span>') : '<span class="wait">Checking this screen…</span>';
    }
  }
  const KNOWN = { 'known:classic-state-spoiler': 'The classic league state route (GET /api/leagues/{id}/state) returns the whole league: results past a person’s mark, and others’ open guesses. The app doesn’t read it; anyone calling it directly would see them.' };
  const ORACLES = { overflow: 'Scrolls sideways', indistinct: 'Choices read the same', unnamed: 'A control has no name', 'due-offscreen': 'Due move below the first screen' };
  const surfaceName = () => ({ tonight: 'Tonight', episodes: 'Episodes', hub: 'Hub', chat: 'Chat', full: (sides.a?.state.games.find(g => g.id === ui.gameId)?.name || 'Game'), quick: 'Quick action', detail: 'Player detail', reveal: 'Episode reveal', wizard: 'Create game' })[ui.surface] || ui.surface;
  function renderEvidence() {
    document.querySelectorAll('[data-panel]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.panel === ui.panel)));
    for (const p of ['checks', 'actions', 'data', 'notes']) $('panel-' + p).hidden = p !== ui.panel;
    $('ev-tabs').hidden = $('ev-body').hidden = !ui.evidence; $('ev-toggle').setAttribute('aria-expanded', String(ui.evidence)); $('ev-toggle').setAttribute('aria-label', ui.evidence ? 'Hide evidence' : 'Show evidence'); $('ev-toggle').title = $('ev-toggle').getAttribute('aria-label');
    const s = sides.a?.state;
    if (!s) { setHTML($('panel-checks'), '<p class="hint">Checks appear once a case is open.</p>'); setHTML($('panel-actions'), ''); setHTML($('panel-data'), ''); return; }
    const card = (kind, title, body) => '<div class="card ' + kind + '"><h4>' + (kind === 'good' ? '<svg><use href="#i-check"/></svg>' : kind === 'bad' ? '<svg><use href="#i-x"/></svg>' : '') + esc(title) + '</h4>' + (body ? '<p>' + body + '</p>' : '') + '</div>';
    let html = '';
    for (const k of ['a', 'b']) {
      const side = sides[k]; if (!side) continue; const st = side.state, who = sides.b ? (renderers.find(r => r.app === side.app)?.label || side.app) + ': ' : '';
      if (st.live) {
        const c = st.live.comparisons || [], bad = c.filter(x => !x.agree);
        html += c.length ? (bad.length ? card('bad', who + 'Server and runtime disagree', bad.map(x => esc(x.method + ' ' + x.path.replace(/[0-9a-f-]{36}/g, '…') + ': server ' + x.status + (x.serverError ? ' (' + x.serverError + ')' : '') + ', runtime ' + x.runtime.join(', '))).join('<br>')) : card('good', who + 'Server and runtime agree', c.length + (c.length === 1 ? ' save' : ' saves') + ' made in the app ' + (c.length === 1 ? 'was' : 'were') + ' replayed by the runtime: same result each time.')) : card('', who + 'No saves yet', 'Make a decision in the app: it goes to the server, then the runtime replays it and compares.');
        if (side.routeCheck) html += side.routeCheck.problems.length ? side.routeCheck.problems.slice(0, 6).map(p => card('bad', who + (p.signature === 'spoiler' ? 'Spoiler for ' + nameOf(st, p.person) : p.signature.replace(/-/g, ' ')), esc(typeof p.detail === 'string' ? p.detail : JSON.stringify(p.detail)))).join('') : card('good', who + 'No spoilers, standings match', 'Every route each person’s app read carried nothing past their own mark, and their tables equal the runtime’s (' + side.routeCheck.people + ' people, at revision ' + side.routeCheck.revision + ').');
        for (const n of st.notes || []) html += card('', who + 'Note', esc(n.note));
        for (const k of side.routeCheck?.known || []) html += card('', who + 'Known defect, still present', esc(KNOWN[k] || k));
        if ((st.live.untracked || []).length) html += card('', who + 'Writes not compared', st.live.untracked.length + ' social or settings ' + (st.live.untracked.length === 1 ? 'write' : 'writes') + ' went to the app and ' + (st.live.untracked.length === 1 ? 'was' : 'were') + ' logged, not replayed.');
      }
      for (const g of st.gaps || []) html += card('', who + 'Not connected: ' + g.surface, esc(g.message));
    }
    html += '<button id="route-check" style="margin-top:10px">Check spoilers and standings now</button>';
    setHTML($('panel-checks'), html);
    setHTML($('panel-actions'), s.trace.length ? '<ul class="trace">' + s.trace.slice().reverse().map(t => '<li><span class="i">' + (t.index + 1) + '</span><span>' + esc(t.type) + '<small>' + esc(t.origin === 'bench-frame-live' ? 'made in the app' : t.origin === 'bench-control' ? 'from the explorer' : t.origin) + (t.message ? ' · ' + esc(t.message) : '') + '</small></span><span class="s ' + esc(t.status) + '">' + esc(t.status) + '</span></li>').join('') + '</ul>' : '<p class="hint">No actions yet. Saves in the app, Air it, Publish and Reveal appear here.</p>');
    setHTML($('panel-data'), '<div class="card"><h4>Case</h4><p>Definition <span class="mono">' + esc(s.documentId) + '</span><br>Revision ' + s.revision + ' · state <span class="mono">' + esc(s.hash.slice(0, 12)) + '</span><br>' + (s.steps.recorded ? s.steps.recorded + ' recorded steps<br>' : '') + 'App: ' + esc(renderers.find(r => r.app === sides.a.app)?.label || sides.a.app) + (sides.b ? '<br>Compared with: ' + esc(renderers.find(r => r.app === sides.b.app)?.label || sides.b.app) : '') + '</p></div><div class="card" id="missing-card"><h4>Failed reads</h4><p id="missing">Looking…</p></div>');
    missing();
  }
  const nameOf = (s, id) => s.people.find(p => p.id === id)?.name || id;
  async function missing() {
    try {
      const st = await (await fetch('/__atlas/status')).json(), ids = ['a', 'b'].filter(k => sides[k]).map(k => sides[k].frame?.caseId);
      const list = st.frames.filter(f => ids.includes(f.caseId)).flatMap(f => f.missing);
      if ($('missing')) $('missing').textContent = list.length ? list.join('\n') : 'None on the screens open now.';
    } catch {}
  }

  // ---------- frame checks (bridge.js 'oracles') ----------
  addEventListener('message', e => {
    const d = e.data; if (!d?.atlas) return;
    const side = ['a', 'b'].map(k => sides[k]).find(s => s?.frame && s.frame.caseId === d.caseId && s.frame.origin === e.origin);
    if (!side) return;
    if (d.type === 'oracles') { side.oracles = { found: d.found || [] }; renderStage(); }
  });

  // ---------- controls ----------
  document.addEventListener('click', e => {
    const t = e.target.closest('button, [data-viewer]'); if (!t) return;
    if (t.dataset.reveal) { e.stopPropagation(); const p = sides.a.state.people.find(x => x.id === t.dataset.reveal); ui.viewerId = p.id; ui.surface = 'reveal'; ui.episode = p.seen + 1; return task(frames); }
    if (t.dataset.viewer) { ui.viewerId = t.dataset.viewer; if (ui.surface === 'reveal') ui.episode = null; return task(frames); }
    if (t.dataset.surface) { ui.surface = t.dataset.surface; return task(frames); }
    if (t.dataset.air) { const ev = sides.a.state.events.find(x => x.id === t.dataset.air); return task(() => act({ type: 'clock', at: new Date(Date.parse(ev.airAt) + 3600000).toISOString() })); }
    if (t.dataset.publish) return task(() => publish(t.dataset.ev, t.dataset.publish));
    if (t.dataset.grade) { const g = sides.a.state.betGames.find(x => x.id === t.dataset.game); return task(() => act({ type: 'grade', gameId: t.dataset.game, personId: g.commissioner, eventId: t.dataset.ev, betId: t.dataset.bet, predId: t.dataset.pred, value: t.dataset.grade === 'true' })); }
    if (t.dataset.panel) { ui.panel = t.dataset.panel; return renderEvidence(); }
    if (t.id === 'route-check') return task(async () => { await each(async side => { side.routeCheck = await api('runtime/check', { id: side.id }); }); });
  });
  document.addEventListener('keydown', e => { const p = e.target.closest?.('[data-viewer]'); if (p && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); p.click(); } });
  $('game').onchange = () => { if (!$('game').value) return; ui.surface = 'full'; ui.gameId = $('game').value; task(frames); };
  $('more').onchange = () => { if (!$('more').value) return; ui.surface = $('more').value; if (ui.surface === 'reveal') { const me = sides.a.state.people.find(p => p.id === ui.viewerId); ui.episode = Math.max(1, Math.min(me.seen + 1, sides.a.state.latest)); } task(frames); };
  $('theme').onchange = () => { ui.theme = $('theme').value; task(frames); };
  $('size').onchange = () => { ui.size = $('size').value; render(); };
  $('app').onchange = () => task(async () => {
    ui.app = $('app').value; if (!sides.a) return; await api('runtime/close', { id: sides.a.id }).catch(() => {}); sides.a = null;
    const a = await openSide(ui.app); if (a.status === 'blocked') throw Error(a.message); sides.a = a; await frames();
  });
  $('compare').onclick = () => task(async () => {
    ui.compare = !ui.compare; ui.evidence = !ui.compare; // the evidence column folds away for side by side (approved tweak)
    // Remove its frame first, then close the case, so nothing is left loading from a server that's going away.
    if (!ui.compare) { const b = sides.b; sides.b = null; renderStage(); if (b) await api('runtime/close', { id: b.id }).catch(() => {}); return; }
    ui.appB = $('app-b').value || renderers.find(r => r.app !== ui.app)?.app;
    if (!ui.appB) { ui.compare = false; throw Error('Only one app version is running. Start a worktree’s dev server (node scripts/lane.js dev <name>) to compare.'); }
    $('app-b').value = ui.appB;
    if (sides.a) { const b = await openSide(ui.appB); if (b.status === 'blocked') throw Error(b.message); sides.b = b; await frames(); }
  });
  $('app-b').onchange = () => task(async () => { ui.appB = $('app-b').value; if (sides.b) await api('runtime/close', { id: sides.b.id }).catch(() => {}); sides.b = null; if (sides.a) { const b = await openSide(ui.appB); sides.b = b.status === 'blocked' ? null : b; await frames(); } });
  $('bet-form').onsubmit = e => { e.preventDefault(); const label = $('bet-label').value.trim(); if (!label || !$('bet-episode').value) return; task(async () => { await act({ type: 'bet', gameId: $('bet-game').value || sides.a.state.betGames[0].id, personId: ui.viewerId, eventId: $('bet-episode').value, label, points: Number($('bet-points').value) }); $('bet-label').value = ''; }); };
  $('ev-toggle').onclick = () => { ui.evidence = !ui.evidence; render(); };
  $('reset').onclick = () => task(async () => { await each(async side => { side.state = (await api('runtime/reset', { id: side.id })).state; }); await frames(); });
  $('export').onclick = () => task(async () => {
    const data = await api('runtime/export?id=' + encodeURIComponent(sides.a.id));
    const blob = new Blob([JSON.stringify({ ...data, review: { notes: $('notes').value, surface: ui.surface, size: ui.size, theme: ui.theme } }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'explorer-' + sides.a.state.documentId + '-r' + sides.a.state.revision + '.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  $('step-back').onclick = () => task(async () => { const at = sides.a.state.steps.at; await each(async side => { side.state = (await api('runtime/seek', { id: side.id, to: Math.min(at, side.state.steps.recorded) - 1 })).state; }); await frames(); });
  $('step-forward').onclick = () => task(async () => { const at = sides.a.state.steps.at; await each(async side => { side.state = (await api('runtime/seek', { id: side.id, to: at + 1 })).state; }); await frames(); });
  $('notes').oninput = () => { try { if (sides.a) localStorage.setItem('explorer-notes:' + sides.a.state.documentId, $('notes').value); } catch {} };
  const menu = open => { $('open-menu').hidden = !open; $('open').setAttribute('aria-expanded', String(open)); };
  $('open').onclick = e => { e.stopPropagation(); menu($('open-menu').hidden); };
  document.addEventListener('click', e => { if (!e.target.closest('#open-menu,#open')) menu(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') menu(false); });
  $('open-file').onclick = () => { menu(false); $('file').click(); };
  // ---------- recipes (the old bench's form, as v2 definitions: explorer/recipes.cjs) ----------
  const showContext = () => meta?.contexts.find(c => c.id === 'show');
  function recipeFields(values = {}) {
    const game = showContext()?.games.find(g => g.id === $('r-game').value); if (!game) return;
    $('r-fields').innerHTML = game.controls.fields.map(f => '<label>' + esc(f.label) + '<input id="r-f-' + esc(f.key) + '" data-key="' + esc(f.key) + '" type="number" min="' + f.min + '" max="' + f.max + '" value="' + esc(values[f.key] ?? f.value) + '"' + (f.fixed ? ' readonly' : ' required') + '></label>').join('');
    $('r-mechanic').textContent = game.controls.summary || '';
  }
  function fillRecipe(v) {
    for (const [id, key] of [['r-players', 'players'], ['r-history', 'history'], ['r-status', 'status'], ['r-pace', 'pace'], ['r-timing', 'timing'], ['r-labels', 'labels'], ['r-seed', 'seed']]) if (v[key] !== undefined) $(id).value = v[key];
    recipeFields(v);
  }
  async function openRecipe() {
    menu(false); meta = meta || await api('meta');
    $('r-game').innerHTML = showContext().games.filter(g => g.implemented).map(g => '<option value="' + esc(g.id) + '">' + esc(g.name) + '</option>').join('');
    $('recipe-presets').innerHTML = meta.presets.map(p => '<button type="button" data-preset="' + esc(p.id) + '">' + esc(p.name) + '</button>').join('');
    fillRecipe(meta.defaults); $('gap').hidden = true; $('recipe').hidden = false; renderStage(); $('r-game').focus();
  }
  $('open-recipe').onclick = () => task(openRecipe);
  $('r-game').onchange = () => recipeFields();
  $('r-cancel').onclick = () => { $('recipe').hidden = true; render(); };
  $('recipe-presets').onclick = e => { const b = e.target.closest('[data-preset]'); if (!b) return; fillRecipe({ ...meta.defaults, ...meta.presets.find(p => p.id === b.dataset.preset).values }); };
  $('recipe').onsubmit = e => { e.preventDefault(); task(async () => {
    const config = { showGame: $('r-game').value, players: Number($('r-players').value), history: Number($('r-history').value), status: $('r-status').value, pace: $('r-pace').value, timing: $('r-timing').value, labels: $('r-labels').value, seed: Number($('r-seed').value) };
    for (const input of $('r-fields').querySelectorAll('input:not([readonly])')) config[input.dataset.key] = Number(input.value);
    const recipe = await api('runtime/recipe', { config });
    $('recipe').hidden = true; await openCase({ input: recipe.input, label: recipe.label, source: 'Recipe' }); if (sides.a) await frames();
  }); };
  $('gap-open').onclick = () => $('file').click();
  const example = () => task(async () => { menu(false); const ex = await api('runtime/example'); await openCase({ input: ex.input, label: ex.label, source: 'Built-in example' }); await frames(); });
  $('open-example').onclick = example; $('empty-example').onclick = example;
  $('file').onchange = () => task(async () => {
    const file = $('file').files[0]; $('file').value = ''; if (!file) return;
    if (file.size > 12 * 1024 * 1024) throw Error('This file is too large (maximum 12 MB).');
    const next = await normalize(JSON.parse(await file.text()), file.name);
    await openCase(next); if (sides.a) await frames();
  });
  addEventListener('resize', () => renderStage());

  (async () => {
    try {
      renderers = (await api('runtime/renderers')).renderers;
      const opts = renderers.map(r => '<option value="' + esc(r.app) + '">' + esc(r.label) + '</option>').join('');
      $('app').innerHTML = opts || '<option value="http://localhost:3000">This checkout (:3000)</option>'; $('app-b').innerHTML = opts;
      ui.app = $('app').value;
    } catch (e) { error(e); }
    render();
    window.__GAMEPLAY_EXPLORER_PAGE__ = { ready: true, ui, sides };
  })();
})();

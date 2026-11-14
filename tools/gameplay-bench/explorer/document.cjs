// Full specs and shared world data. Validation here is structural; game legality belongs to the engine.
const J = require('./json.cjs');
const KIND = 'gameplay-scenario';
const MODES = ['playable', 'invalid-definition', 'legacy-presentation'];
const SURFACES = ['create', 'mini', 'quick', 'full', 'detail', 'reveal'];
const ROOT_KEYS = ['kind', 'schemaVersion', 'id', 'revision', 'seed', 'testMode', 'versions', 'world', 'games', 'situation', 'content', 'setup', 'history', 'transport', 'presentation', 'provenance', 'evidence', 'compatibility'];
const fail = (at, message) => { throw Error('Scenario ' + at + ': ' + message); };
// Each game in stages' stages as games of their own (stages.cjs: loaded on first use, it reads the engine). Rows that aren't games
// yet are left for validation to refuse.
const withStages = games => games.every(g => J.object(g) && J.object(g.spec)) ? require('./stages.cjs').expand(games) : games;
const isId = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 200;
const record = (value, at) => { if (!J.object(value)) fail(at, 'expected an object'); };
function list(value, at) { if (!Array.isArray(value)) fail(at, 'expected an array'); }
function unique(rows, at) {
  list(rows, at);
  const ids = new Set();
  rows.forEach((row, i) => { record(row, at + '/' + i); if (!isId(row.id) || ids.has(row.id)) fail(at + '/' + i + '/id', 'expected a unique nonempty ID'); ids.add(row.id); });
  return ids;
}
function validate(d) {
  J.assertJson(d);
  record(d, '');
  for (const key of Object.keys(d)) if (!ROOT_KEYS.includes(key)) fail('/' + J.pointer(key), 'unknown document field; version or explicitly map it instead of dropping it');
  if (d.kind !== KIND || d.schemaVersion !== 2) fail('/schemaVersion', 'expected gameplay-scenario version 2');
  if (!isId(d.id) || !Number.isInteger(d.revision) || d.revision < 1) fail('/id', 'expected an ID and positive integer revision');
  if (!['string', 'number'].includes(typeof d.seed)) fail('/seed', 'expected a string or number');
  if (!MODES.includes(d.testMode)) fail('/testMode', 'choose playable, invalid-definition or legacy-presentation');
  for (const key of ['versions', 'world', 'situation', 'content', 'setup', 'history', 'transport', 'presentation', 'provenance', 'evidence']) record(d[key], '/' + key);
  for (const key of ['engine', 'adapters']) if (typeof d.versions[key] !== 'string' || !d.versions[key]) fail('/versions/' + key, 'expected a version/fingerprint');
  const contexts = unique(d.world.contexts, '/world/contexts');
  if (!contexts.size) fail('/world/contexts', 'provide an actual context; no implicit Survivor fallback');
  const people = unique(d.world.people, '/world/people');
  unique(d.world.participants, '/world/participants');
  const events = unique(d.world.events, '/world/events');
  unique(d.world.facts, '/world/facts');
  list(d.world.media, '/world/media');
  d.world.contexts.forEach((c, i) => {
    if (!['show', 'sport'].includes(c.kind)) fail('/world/contexts/' + i + '/kind', 'expected show or sport');
    record(c.engine, '/world/contexts/' + i + '/engine');
    if (!Object.keys(c.engine).length) fail('/world/contexts/' + i + '/engine', 'context cannot be empty');
    if (c.format !== undefined && (!J.object(c.format) || !isId(c.format.id))) fail('/world/contexts/' + i + '/format', 'expected an explicit format descriptor');
  });
  for (const collection of ['participants', 'events', 'facts']) for (const row of d.world[collection]) {
    if (!contexts.has(row.contextId)) fail('/world/' + collection + '/' + row.id, 'unknown context reference');
    if (collection === 'events' && (!Number.isInteger(row.number) || row.number < 1)) fail('/world/events/' + row.id + '/number', 'expected a positive event number');
    if (collection === 'events' && !['unavailable', 'partial', 'final', 'corrected', 'postponed', 'cancelled'].includes(row.resultStatus)) fail('/world/events/' + row.id + '/resultStatus', 'unknown event result status');
    if (row.eventId !== undefined && (!events.has(row.eventId) || d.world.events.find(e => e.id === row.eventId).contextId !== row.contextId)) fail('/world/' + collection + '/' + row.id + '/eventId', 'unknown or cross-context event reference');
  }
  const eventNumbers = new Set();
  for (const event of d.world.events) { const key = J.canonical([event.contextId, event.number]); if (eventNumbers.has(key)) fail('/world/events/' + event.id, 'duplicate event number in context'); eventNumbers.add(key); }
  const gameIds = unique(d.games, '/games');
  if (!gameIds.size) fail('/games', 'provide at least one game spec');
  for (const game of d.games) {
    for (const key of Object.keys(game)) if (!['id', 'name', 'contextId', 'spec', 'contextOverrides', 'contextBindings', 'seats', 'roles', 'timing', 'stageOf', 'stageKey'].includes(key)) fail('/games/' + game.id + '/' + J.pointer(key), 'unknown game field; quantities belong to the actual spec');
    // A stage's own game (stages.cjs expand: derived from its parent's spec on every read, never written by hand).
    if ((game.stageOf !== undefined || game.stageKey !== undefined) && !(gameIds.has(game.stageOf) && game.stageOf !== game.id && isId(game.stageKey))) fail('/games/' + game.id + '/stageOf', 'a stage game names its game in stages and its stage');
    if (!contexts.has(game.contextId)) fail('/games/' + game.id + '/contextId', 'unknown context reference');
    record(game.spec, '/games/' + game.id + '/spec');
    record(game.contextOverrides, '/games/' + game.id + '/contextOverrides');
    record(game.roles, '/games/' + game.id + '/roles');
    if (!['own-pace', 'live-only'].includes(game.timing)) fail('/games/' + game.id + '/timing', 'expected own-pace or live-only');
    list(game.seats, '/games/' + game.id + '/seats');
    if (new Set(game.seats).size !== game.seats.length || game.seats.some(id => !people.has(id))) fail('/games/' + game.id + '/seats', 'expected unique known people');
    for (const [personId, role] of Object.entries(game.roles)) if (!people.has(personId) || !['member', 'commissioner', 'spectator'].includes(role)) fail('/games/' + game.id + '/roles', 'expected known people and explicit member/commissioner/spectator roles');
    list(game.contextBindings, '/games/' + game.id + '/contextBindings');
    const paths = new Set();
    for (const binding of game.contextBindings) {
      if (!J.object(binding) || !contexts.has(binding.contextId) || !/^\/stages\/\d+(?:\/game)?(?:\/stages\/\d+(?:\/game)?)*$/.test(binding.path) || paths.has(binding.path)) fail('/games/' + game.id + '/contextBindings', 'invalid or duplicate stage/context binding');
      paths.add(binding.path);
      let target = game.spec;
      for (const part of binding.path.split('/').slice(1)) target = target?.[part];
      if (!J.object(target)) fail('/games/' + game.id + '/contextBindings', 'binding does not target a stage in the supplied spec');
    }
  }
  if (typeof d.situation.clock !== 'string' || !Number.isFinite(Date.parse(d.situation.clock))) fail('/situation/clock', 'expected an explicit ISO timestamp');
  if (!/(?:Z|[+-]\d\d:\d\d)$/.test(d.situation.clock)) fail('/situation/clock', 'include a UTC offset or Z');
  try { new Intl.DateTimeFormat('en', { timeZone: d.situation.timezone }).format(); } catch { fail('/situation/timezone', 'unknown timezone'); }
  if (!d.situation.timezone) fail('/situation/timezone', 'expected an explicit timezone');
  if (d.situation.viewerId !== null && !people.has(d.situation.viewerId)) fail('/situation/viewerId', 'unknown person');
  list(d.situation.marks, '/situation/marks');
  const marks = new Set();
  for (const mark of d.situation.marks) {
    const key = J.canonical([mark.contextId, mark.personId]);
    if (!people.has(mark.personId) || !contexts.has(mark.contextId) || !Number.isInteger(mark.through) || mark.through < 0 || marks.has(key)) fail('/situation/marks', 'expected unique person/context marks with nonnegative through values');
    marks.add(key);
    const supplied = d.world.events.filter(e => e.contextId === mark.contextId);
    const released = supplied.filter(e => ['partial', 'final', 'corrected'].includes(e.resultStatus)).map(e => e.number);
    if (supplied.length && mark.through > Math.max(0, ...released)) fail('/situation/marks', 'viewing mark exceeds supplied released events');
  }
  for (const key of ['gameStates', 'stores']) record(d.setup[key], '/setup/' + key);
  for (const id of Object.keys(d.setup.gameStates)) if (!gameIds.has(id)) fail('/setup/gameStates/' + id, 'unknown game');
  for (const key of ['entries', 'checkpoints']) list(d.history[key], '/history/' + key);
  unique(d.history.entries, '/history/entries'); unique(d.history.checkpoints, '/history/checkpoints');
  if (!['setup', 'head'].includes(d.history.snapshotAt)) fail('/history/snapshotAt', 'declare whether setup is before or after the recorded entries');
  for (const row of [...d.history.entries, ...d.history.checkpoints]) {
    record(row, '/history');
    if (row.gameId !== undefined && !gameIds.has(row.gameId)) fail('/history/gameId', 'unknown game');
    if (row.personId !== undefined && row.personId !== null && !people.has(row.personId)) fail('/history/personId', 'unknown person');
  }
  if (!SURFACES.includes(d.presentation.surface)) fail('/presentation/surface', 'unknown surface');
  const viewport = d.presentation.viewport;
  if (!J.object(viewport) || !Number.isInteger(viewport.width) || viewport.width < 1 || !Number.isInteger(viewport.height) || viewport.height < 1) fail('/presentation/viewport', 'expected positive integer dimensions');
  if (!isId(d.presentation.renderer) || !isId(d.presentation.theme)) fail('/presentation', 'expected renderer and theme');
  list(d.evidence.records, '/evidence/records');
  if (d.compatibility !== undefined) {
    record(d.compatibility, '/compatibility');
    const original = d.compatibility.original;
    if (d.compatibility.kind !== 'gameplay-bench-v1' || original?.kind !== 'gameplay-bench' || original.schemaVersion !== 1 || !J.object(original.scenario) || !J.object(original.scenario.state) || !J.object(original.scenario.spec) || !J.object(original.scenario.context) || !Array.isArray(original.commands)) fail('/compatibility', 'unknown or incomplete compatibility envelope');
    if (original.fixture) require('../../ui-atlas/data.cjs').validateBundle(original.fixture);
  }
  return d;
}

function create(input) {
  J.assertJson(input);
  record(input, '');
  for (const key of Object.keys(input)) if (!ROOT_KEYS.includes(key)) fail('/' + J.pointer(key), 'unknown constructor field');
  if (input.kind !== undefined && input.kind !== KIND) fail('/kind', 'unknown scenario kind');
  if (input.schemaVersion !== undefined && input.schemaVersion !== 2) fail('/schemaVersion', 'unknown scenario version');
  if (input.games !== undefined) list(input.games, '/games');
  const world = input.world || {};
  const d = {
    kind: KIND, schemaVersion: 2, id: input.id || 'scenario-' + J.digest(input).slice(0, 20), revision: input.revision ?? 1,
    seed: input.seed ?? 42, testMode: input.testMode || 'playable', versions: input.versions || J.versions(),
    world: { contexts: [], people: [], participants: [], events: [], facts: [], media: [], ...world },
    // A game in stages gets each stage's own game after it (stages.cjs expand).
    games: withStages((input.games || []).map(game => ({ contextOverrides: {}, contextBindings: [], seats: [], roles: {}, timing: 'own-pace', ...game }))),
    situation: { clock: '2026-11-12T12:00:00.000Z', timezone: 'America/New_York', viewerId: null, marks: [], lifecycle: 'unspecified', ...input.situation },
    content: input.content || {}, setup: { gameStates: {}, stores: {}, ...input.setup },
    history: { snapshotAt: 'setup', entries: [], checkpoints: [], ...input.history }, transport: input.transport || {},
    presentation: { surface: 'full', viewport: { width: 390, height: 844 }, theme: 'night', renderer: 'current', ...input.presentation },
    provenance: input.provenance || { source: 'full-spec-input' }, evidence: { records: [], ...input.evidence },
    ...(input.compatibility ? { compatibility: input.compatibility } : {}),
  };
  validate(d);
  return J.clone(d);
}

function fromSpec(spec, context, options = {}) {
  const documentOptions = Object.fromEntries(Object.entries(options).filter(([key]) => !['kind', 'context', 'timing', 'adapters', 'format'].includes(key)));
  J.assertJson({ spec, context, options: documentOptions });
  record(spec, '/spec'); record(context, '/context');
  const kind = options.kind || (context.sport ? 'sport' : 'show');
  return create({ ...documentOptions, world: { ...options.world, contexts: [{ id: 'context-1', kind, engine: context, ...(options.format ? { format: options.format } : {}) }] }, games: [{ id: 'game-1', contextId: 'context-1', spec, timing: options.timing || 'own-pace' }] });
}

function fromLegacy(input) {
  J.assertJson(input);
  if (input?.kind !== 'gameplay-bench' || input.schemaVersion !== 1 || !J.object(input.scenario) || !J.object(input.initialConfig) || !Array.isArray(input.commands)) fail('/compatibility', 'expected a version-1 bench export with a snapshot');
  const s = input.scenario;
  for (const key of ['context', 'spec', 'state', 'config', 'marks']) record(s[key], '/compatibility/scenario/' + key);
  if (!Array.isArray(s.state.players) || !s.state.players.length || !Number.isFinite(s.now)) fail('/compatibility/scenario', 'missing players or clock');
  if (input.fixture) require('../../ui-atlas/data.cjs').validateBundle(input.fixture);
  const contextId = 'context-1', gameId = input.fixture?.context?.gameId || 'game-1';
  const people = s.state.players.map(p => ({ id: p.id, name: p.name, ...(p.color ? { color: p.color } : {}) }));
  const participants = (s.state.castaways || []).map(p => ({ id: p.id, contextId, name: p.name, ...(p.role ? { role: p.role } : {}), photoUrl: p.photoUrl || null }));
  const events = (s.state.episodes || []).map(e => ({ id: e.id, contextId, number: e.number, title: e.title || null, airAt: e.airsAt || null, resultStatus: e.number <= s.config.history ? 'final' : 'unavailable' }));
  const facts = (s.state.episodes || []).filter(e => e.number <= s.config.history).map(e => ({ id: 'facts-' + e.id, contextId, eventId: e.id, source: 'legacy-synthetic-setup', data: Object.fromEntries(Object.entries(e).filter(([key]) => !['lineups', 'picks', 'calls', 'bets'].includes(key))) }));
  let viewer = input.initialConfig.viewer ?? 0;
  const entries = input.commands.map((command, i) => {
    const personId = command.playerId || s.state.players[viewer]?.id || null;
    if (command.type === 'viewer') viewer = command.index;
    return { id: 'legacy-action-' + (i + 1), gameId, personId, source: 'legacy-command-unverified-origin', command: J.clone(command) };
  });
  return create({
    id: 'legacy-' + J.digest(input).slice(0, 20), seed: input.initialConfig.seed ?? 42,
    world: { contexts: [{ id: contextId, kind: s.sport ? 'sport' : 'show', engine: s.context, key: s.sport?.league || 'survivor', format: { id: s.state.settings.showFormat || 'survivor' } }], people, participants, events, facts, media: [] },
    games: [{ id: gameId, contextId, spec: s.spec, seats: people.map(p => p.id), roles: Object.fromEntries(people.map(p => [p.id, 'member'])), timing: s.config.timing || 'own-pace' }],
    situation: { clock: new Date(s.now).toISOString(), timezone: 'America/New_York', viewerId: s.state.players[s.config.viewer]?.id || null, marks: Object.entries(s.marks).map(([personId, through]) => ({ personId, contextId, through })), lifecycle: s.config.status },
    content: { labels: s.config.labels, images: s.config.images }, setup: { gameStates: { [gameId]: s.state } },
    history: { snapshotAt: 'head', entries, checkpoints: [] },
    provenance: { source: 'legacy-import', originalHash: J.digest(input), importedWith: J.versions(), originalVersions: { adapter: input.adapterFingerprint || null, source: input.sourceFingerprint || null }, warnings: ['Setup is the saved head snapshot. Recorded entries must not be applied to it again.', 'Legacy checks, review notes and artifacts are preserved in the compatibility archive; no coverage or approval is promoted.'] },
    compatibility: { kind: 'gameplay-bench-v1', original: input, importedDefinitionHash: J.digest({ spec: s.spec, context: s.context }) },
  });
}

function read(input, options = {}) {
  J.assertJson(input);
  if (input?.kind === KIND) return J.clone(validate(Array.isArray(input.games) ? { ...input, games: withStages(input.games) } : input));
  if (input?.kind === 'gameplay-bench') return fromLegacy(input);
  if (J.object(input?.spec) && J.object(input.context)) return fromSpec(input.spec, input.context, { ...options, ...(input.format ? { format: input.format } : {}) });
  if (options.context) return fromSpec(input, options.context, options);
  fail('', 'provide a scenario document, version-1 replay, or {spec, context}; a bare spec needs an explicit context');
}
function originalLegacy(document) {
  validate(document);
  if (!document.compatibility) fail('/compatibility', 'no legacy archive');
  // An archive download is explicitly the original run, not a reverse migration of edited v2 data.
  return J.clone(document.compatibility.original);
}
module.exports = { KIND, MODES, SURFACES, create, validate, fromSpec, fromLegacy, read, originalLegacy };

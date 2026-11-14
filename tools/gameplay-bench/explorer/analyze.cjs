const path = require('path');
const D = require('./document.cjs'), J = require('./json.cjs'), Planner = require('./planner.cjs'), Registry = require('./registry.cjs');
const G = require('../../../src/lib/game/game-spec');
const jiti = require('jiti')(__filename, { alias: { '@': path.resolve(__dirname, '../../../src') } });
const Compiler = jiti('../../../src/lib/game/game-page/compile.ts');
const Grammar = jiti('../../../src/lib/game/game-page/grammar.ts');

function analyze(input, options = {}) {
  const document = D.read(input, options), requirements = [], nodes = [], diagnostics = [];
  const contextById = new Map(document.world.contexts.map(c => [c.id, c]));
  const sourceVocabulary = G.VOCAB;
  function supplied(at) {
    let value = document;
    for (const key of at.split('/').slice(1).map(p => p.replace(/~1/g, '/').replace(/~0/g, '~'))) { if (value === null || typeof value !== 'object' || !Object.hasOwn(value, key)) return false; value = value[key]; }
    return true;
  }
  const add = (node, key, at, extra = {}) => requirements.push({ scope: node.scope, gameId: node.gameId, contextId: node.contextId, parentScope: node.parentScope, engineStatus: node.engine.status, compiled: !!node.page, compilerHoles: node.page?.holes.length ?? null, key, origins: at ? [at] : [], sourceLocations: at ? [{ path: at, source: supplied(at) ? 'supplied' : 'engine-default' }] : [], ...extra });

  function specNode(raw, game, relativePath, parent, contextId, engineContext, stage) {
    const base = '/games/' + document.games.indexOf(game) + '/spec' + relativePath;
    const scope = 'game:' + game.id + relativePath;
    let spec, problems = [], waits = [], type = null, page = null;
    try { spec = G.fullSpec(raw); problems = G.specProblems(raw, engineContext); waits = G.specWaitsFor(raw); type = G.typeOf(raw); }
    catch (e) { problems = [{ at: '', problem: e.message }]; }
    if (spec) try { page = Compiler.compileGame(spec); } catch (e) { diagnostics.push({ kind: 'compiler-error', path: base, message: e.message }); }
    const problemPath = at => at ? '/' + at.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean).map(J.pointer).join('/') : '';
    const engine = { status: problems.length ? 'invalid' : waits.length ? 'gated' : !type ? 'unmapped' : 'valid', type, problems: problems.map(p => ({ ...p, sourcePath: base + problemPath(p.at) })), waits: waits.map(w => ({ ...w, sourcePath: base + problemPath(w.at) })) };
    const node = { kind: parent ? 'stage' : 'game', scope, parentScope: parent?.scope || null, gameId: game.id, contextId, contextHash: J.digest(engineContext), path: base, engine, page, normalizedSpec: spec || null };
    nodes.push(node);
    add(node, 'check:engine', base);
    add(node, 'check:compiler', base);
    add(node, 'runtime:scenario', base);
    add(node, 'fact:people', '/world/people');
    add(node, 'fact:events', '/world/events');
    add(node, 'fact:viewing-boundaries', '/situation/marks');
    if (Object.keys(document.content).length) add(node, 'content:profile', '/content');
    if (Object.keys(document.transport).length) add(node, 'transport:conditions', '/transport');
    if (Object.keys(document.setup.stores).length) add(node, 'input:external-stores', '/setup/stores');
    if (!spec) return;
    for (const hole of page?.holes || []) diagnostics.push({ kind: 'compiler-hole', path: base, requirement: hole });
    for (const place of (page?.places || []).filter(p => !spec.stages || p === 'main:stages')) add(node, 'place:' + place, base);
    if (G.stageSeason(stage)) add(node, 'context:stage-season', base);
    if (spec.get?.by === 'draft') { add(node, 'fact:participants', base + '/get'); add(node, 'fact:ownership', base + '/get'); }
    if (spec.get?.by === 'pick') { add(node, 'fact:participants', base + '/get'); add(node, 'action:picks', base + '/get'); }
    if (spec.count?.start) add(node, 'action:lineup', base + '/count/start');
    if (['moments', 'survive', 'place', 'stats', 'lines', 'squares'].includes(spec.score?.by)) add(node, 'fact:results/' + spec.score.by, base + '/score');
    if (spec.stages) add(node, 'composition:stages', base + '/stages');
    if (!parent && document.setup.gameStates[game.id]) add(node, 'input:state-snapshot', '/setup/gameStates/' + J.pointer(game.id));
    else add(node, 'generation:fixture', base);

    function fields(value, parts, at, owner = node) {
      if (Array.isArray(value)) {
        if (!value.length) { add(owner, 'field:' + parts.join('/'), at); return; }
        value.forEach((v, i) => fields(v, [...parts, '*'], at + '/' + i, owner));
      } else if (J.object(value)) {
        if (!Object.keys(value).length) add(owner, 'field:' + parts.join('/'), at);
        for (const [key, item] of Object.entries(value)) {
          const dial = parts.join('.');
          const enumEntry = sourceVocabulary[dial]?.[key];
          if (enumEntry && (typeof item === 'number' || item === true || J.object(item))) add(owner, 'dial:' + dial + '=' + key, at + '/' + J.pointer(key), { engineAvailability: enumEntry });
          fields(item, [...parts, key], at + '/' + J.pointer(key), owner);
        }
      } else {
        const dial = parts.filter(p => p !== '*').join('.'), enumEntry = ['string', 'boolean'].includes(typeof value) ? sourceVocabulary[dial]?.[value] : undefined;
        if (enumEntry) add(owner, 'dial:' + dial + '=' + value, at, { engineAvailability: enumEntry, mapped: !!Grammar.GRAMMAR[dial]?.[value] });
        else add(owner, 'field:' + parts.join('/'), at);
      }
    }
    // Do not flatten child specs into their parent's scope: stage IDs and question data stay distinct.
    for (const [key, value] of Object.entries(spec)) if (!['stages', 'ask'].includes(key)) fields(value, [key], base + '/' + J.pointer(key));
    for (const [index, question] of (Array.isArray(spec.ask) ? spec.ask : []).entries()) {
      const q = { ...node, kind: 'question', scope: scope + '/ask/' + index, parentScope: scope, path: base + '/ask/' + index };
      const compiled = page?.questions[index];
      add(q, 'control:' + String(question.answer), q.path + '/answer');
      add(q, 'fact:question-options', q.path);
      add(q, 'fact:question-settlement', q.path + '/settle');
      add(q, 'action:answer', q.path);
      for (const rider of compiled?.riders || []) add(q, 'rider:' + rider.kind, q.path);
      fields(question, ['ask', '*'], q.path, q);
    }
    for (const [index, child] of (Array.isArray(spec.stages) ? spec.stages : []).entries()) {
      const original = raw.stages?.[index] || child;
      const childPath = relativePath + '/stages/' + index + (J.object(original.game) ? '/game' : '');
      const binding = game.contextBindings.find(b => b.path === childPath);
      const childContextId = binding?.contextId || contextId;
      const childContext = binding ? contextById.get(childContextId).engine : engineContext;
      if (G.stageSeason(original) && !binding) { diagnostics.push({ kind: 'missing-stage-context', path: base + '/stages/' + index, message: 'Bind this cross-season stage to an explicit world context' }); add(node, 'context:missing-stage-binding', base + '/stages/' + index); }
      specNode(original.game || original, game, childPath, node, childContextId, childContext, original);
      for (const [key, value] of Object.entries(child)) if (key !== 'game') fields(value, ['stages', '*', key], base + '/stages/' + index + '/' + J.pointer(key));
    }
  }
  // A stage's own game (document.cjs derives one after its game in stages, for the runtime) is analyzed where it's written: as its
  // parent's stage node below, with that stage's context binding. Never a second time as a game.
  const written = document.games.filter(g => g.stageOf === undefined);
  for (const game of written) {
    const context = contextById.get(game.contextId);
    specNode(game.spec, game, '', null, game.contextId, { ...context.engine, ...game.contextOverrides }, null);
  }
  // Merge repeated semantic fields while retaining each exact source location.
  const merged = new Map();
  for (const requirement of requirements) {
    const key = J.canonical([requirement.scope, requirement.key]), existing = merged.get(key);
    if (existing) { existing.origins = [...new Set([...existing.origins, ...requirement.origins])].sort(); existing.sourceLocations = [...new Map([...existing.sourceLocations, ...requirement.sourceLocations].map(location => [J.canonical(location), location])).values()]; }
    else merged.set(key, requirement);
  }
  const declarations = options.adapters || Registry.adapters;
  const adapterPlan = Planner.plan([...merged.values()], declarations, { document });
  const statuses = nodes.map(n => n.engine.status);
  const engineStatus = statuses.includes('invalid') ? 'invalid' : statuses.includes('gated') ? 'gated' : statuses.includes('unmapped') ? 'unmapped' : 'valid';
  const runtimeSupport = engineStatus === 'valid' && document.testMode === 'playable'
    ? require('./runtime-profile.cjs').inspect(document)
    : { status: 'blocked', profile: 'core-post-acquisition-v1', gaps: [{ gameId: null, path: '/testMode', reason: 'Execution requires an engine-valid playable definition' }] };
  const eligible = runtimeSupport.status === 'supported-profile' && !diagnostics.length;
  return {
    kind: 'gameplay-scenario-analysis', schemaVersion: 1, documentId: document.id, documentHash: J.digest(document), analyzedWith: J.versions(),
    engine: { status: engineStatus, expectation: document.testMode }, nodes, diagnostics, adapterPlan,
    runtimeSupport,
    readiness: { fixture: written.every(g => document.setup.gameStates[g.id]) ? 'snapshots-supplied-not-runtime-verified' : eligible ? 'runtime-eligible-not-executed' : 'generation-adapters-needed', perGame: written.map(g => ({ gameId: g.id, snapshotSupplied: !!document.setup.gameStates[g.id], runtime: runtimeSupport.gaps.some(gap => gap.gameId === null || gap.gameId === g.id || document.games.some(c => c.stageOf === g.id && c.id === gap.gameId)) ? 'blocked' : 'profile-eligible-not-executed' })), runtime: eligible ? 'headless-available' : 'blocked', rendering: 'unverified', interaction: 'unverified', design: 'unreviewed', userApproval: 'not-requested' },
    summary: { games: written.length, specNodes: nodes.length, requirements: adapterPlan.requirements.length, declaredSteps: adapterPlan.steps.length, missingAdapters: adapterPlan.gaps.length, conflicts: adapterPlan.conflicts.length, cycles: adapterPlan.cycles.length },
  };
}
module.exports = { analyze };

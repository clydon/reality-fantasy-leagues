// Dependency planning only. A declared adapter is not a rendered or interaction-tested surface.
const { canonical, digest, object } = require('./json.cjs');

function plan(input, adapters, environment = {}) {
  const ids = new Set();
  for (const adapter of adapters) {
    if (typeof adapter.id !== 'string' || !adapter.id || ids.has(adapter.id) || !Number.isInteger(adapter.version) || adapter.version < 1 || !Array.isArray(adapter.provides) || adapter.provides.some(key => typeof key !== 'string') || !Array.isArray(adapter.requires) || !Array.isArray(adapter.owns) || (adapter.when && typeof adapter.when !== 'function')) throw Error('Invalid/duplicate adapter declaration: ' + adapter.id);
    ids.add(adapter.id);
  }
  const requirements = new Map(), instances = new Map(), providers = new Map(), gaps = [], conflicts = [];
  const keyOf = r => canonical([r.scope, r.key]);
  const instanceId = (adapter, requirement) => adapter.id + '@' + adapter.version + ':' + requirement.scope;
  const idOf = r => 'req-' + digest([r.scope, r.key]).slice(0, 20);
  const dependency = (definition, requirement) => {
    const d = typeof definition === 'string' ? { key: definition, scope: 'same' } : definition;
    if (!object(d) || typeof d.key !== 'string' || !['same', 'parent', 'context', 'world'].includes(d.scope || 'same')) throw Error('Invalid dependency declaration');
    const scope = { same: requirement.scope, parent: requirement.parentScope, context: 'context:' + requirement.contextId, world: 'world' }[d.scope || 'same'];
    if (!scope) throw Error('Dependency needs a parent/context scope: ' + d.key);
    return { ...requirement, scope, key: d.key, requested: false, origins: [], sourceLocations: [], dependencyOf: requirement.id };
  };
  function resolve(raw, depth = 0) {
    if (depth > 100 || requirements.size > 5000) throw Error('Adapter planning budget exceeded; no gameplay limit is implied');
    const key = keyOf(raw);
    if (requirements.has(key)) {
      const existing = requirements.get(key);
      existing.origins = [...new Set([...(existing.origins || []), ...(raw.origins || [])])].sort();
      existing.sourceLocations = [...new Map([...(existing.sourceLocations || []), ...(raw.sourceLocations || [])].map(location => [canonical(location), location])).values()];
      if (raw.requested) existing.requested = true;
      return existing;
    }
    const req = { ...raw, id: idOf(raw) };
    requirements.set(key, req);
    const choices = adapters.filter(a => a.provides.includes(req.key) && (!a.when || a.when(req, environment)));
    if (!choices.length) { gaps.push({ requirementId: req.id, scope: req.scope, key: req.key, origins: req.origins || [], sourceLocations: req.sourceLocations || [], reason: 'No matching adapter declaration' }); return req; }
    if (choices.length > 1) { conflicts.push({ kind: 'ambiguous-provider', requirementId: req.id, scope: req.scope, key: req.key, adapters: choices.map(a => a.id).sort() }); return req; }
    const adapter = choices[0], id = instanceId(adapter, req);
    providers.set(key, id);
    if (!instances.has(id)) {
      const node = { id, adapterId: adapter.id, version: adapter.version, scope: req.scope, contextId: req.contextId || null, requires: [], owns: adapter.owns.map(own => dependency(own, req)), evidence: adapter.evidence || 'declaration-only' };
      instances.set(id, node);
      for (const need of adapter.requires) node.requires.push(resolve(dependency(need, req), depth + 1).id);
    }
    return req;
  }
  for (const raw of [...input].sort((a, b) => keyOf(a).localeCompare(keyOf(b)))) resolve({ ...raw, requested: true });
  const byReqId = new Map([...requirements.values()].map(r => [r.id, r]));
  const ownership = new Map();
  for (const instance of instances.values()) for (const own of instance.owns) {
    const key = keyOf(own), previous = ownership.get(key);
    if (previous && previous !== instance.id) conflicts.push({ kind: 'competing-writers', scope: own.scope, resource: own.key, adapters: [previous, instance.id].sort() });
    else ownership.set(key, instance.id);
  }
  const visiting = new Set(), visited = new Set(), ordered = [], cycles = [];
  function visit(id, chain) {
    if (visiting.has(id)) { cycles.push([...chain.slice(chain.indexOf(id)), id]); return; }
    if (visited.has(id)) return;
    visiting.add(id);
    const instance = instances.get(id);
    for (const dep of instance.requires) {
      const requirement = byReqId.get(dep), provider = providers.get(keyOf(requirement));
      if (provider) visit(provider, [...chain, id]);
    }
    visiting.delete(id); visited.add(id); ordered.push(instance);
  }
  for (const id of [...instances.keys()].sort()) visit(id, []);
  // Unresolved dependencies propagate to dependents; a resolved root name is not readiness.
  const unavailable = new Set(), readiness = new Map();
  function ready(id, chain = new Set()) {
    if (chain.has(id)) return false;
    if (readiness.has(id)) return readiness.get(id);
    const next = new Set([...chain, id]);
    const instance = instances.get(id);
    const result = instance.requires.every(dep => { const req = byReqId.get(dep), provider = providers.get(keyOf(req)); return provider && ready(provider, next); });
    if (!result) unavailable.add(id);
    readiness.set(id, result);
    return result;
  }
  for (const id of instances.keys()) ready(id);
  const blocked = gaps.length > 0 || conflicts.length > 0 || cycles.length > 0;
  for (const gap of gaps) { const req = byReqId.get(gap.requirementId); gap.origins = req.origins || []; gap.sourceLocations = req.sourceLocations || []; }
  return {
    status: blocked ? 'blocked' : 'planned', execution: 'not-executed',
    requirements: [...requirements.values()].map(r => ({ ...r, provider: providers.get(keyOf(r)) || null })),
    steps: ordered.map(n => ({ ...n, status: unavailable.has(n.id) ? 'dependency-blocked' : 'declared' })), gaps, conflicts, cycles,
  };
}
module.exports = { plan };

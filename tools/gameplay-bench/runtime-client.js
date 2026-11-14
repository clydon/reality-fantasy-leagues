// Stateless browser transport for the shared runtime. No ephemeral pilot session is required.
// Keep a returned execution bundle per branch; never overwrite a global "current run" on response.
window.__GAMEPLAY_EXPLORER__ = Object.freeze({
  async execute(input, steps = [], queries = [], options = {}) {
    const response = await fetch('/__atlas/bench/execute', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ input, steps, queries }),
      signal: options.signal,
    });
    const result = await response.json();
    if (!response.ok) throw Error(result.error || 'Runtime transport failed: ' + response.status);
    return result; // A blocked/rejected case is a structured result, not a transport failure.
  },
});

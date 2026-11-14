// Synthetic identity only. No recorded application account or production data is required.
module.exports = {
  schemaVersion: 1,
  context: { username: 'zt_bench', userId: 'fixture-user', seasonId: 'season', couchId: 'couch', gameId: 'old-game' },
  responses: {
    '/api/me/home': { status: 200, body: { user: { id: 'fixture-user' }, shows: [], couches: [{ id: 'couch', members: [] }] } },
    '/api/seasons/season/space?couch=couch': { status: 200, body: { show: { name: 'Survivor', artUrl: null }, schedule: {}, you: {} } },
    '/api/seasons/season/games?couch=couch': { status: 200, body: { games: [] } },
  },
};

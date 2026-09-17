import assert from 'node:assert/strict';
import worker from '../worker.js';

class MemoryKv {
  constructor(entries = {}) { this.data = new Map(Object.entries(entries)); }
  async get(key, options) {
    const value = this.data.get(key);
    if (value == null) return null;
    return options && options.type === 'json' ? JSON.parse(value) : value;
  }
  async put(key, value) { this.data.set(key, String(value)); }
  async list({ prefix = '' } = {}) {
    return { keys: [...this.data.keys()].filter((key) => key.startsWith(prefix)).map((name) => ({ name })) };
  }
}

const leagueId = 'source-test';
const leagueKey = 'nfl~6c8af73a-4b6b-4c98-a9ec-86d3f1c5bc49';
const kv = new MemoryKv({
  [`league:${leagueId}`]: JSON.stringify({ id: leagueId, name: 'Off with their Heads', meOwner: 'Ilyn Payne', leagueType: 'guillotine' }),
  [`leagueSnapshot:${leagueId}`]: JSON.stringify({
    roster: [],
    available: [{ name: 'Puka Nacua', pos: 'WR', team: 'LAR' }],
    coverage: { available: 'saved' }
  })
});
const env = { MOCKS: kv };

let response = await worker.fetch(new Request(`https://draft.test/api/data-sources?league=${leagueId}`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ fantasyProsUrlOrKey: `https://www.fantasypros.com/nfl/myplaybook/matchup.php?key=${leagueKey}` })
}), env, {});
assert.equal(response.status, 200);
assert.equal((await response.json()).fantasyProsConfigured, true);

const nativeFetch = globalThis.fetch;
globalThis.fetch = async (input) => {
  const url = String(input);
  if (!url.startsWith('https://mpbnfl.fantasypros.com/json/matchup')) throw new Error(`Unexpected fetch: ${url}`);
  return new Response(JSON.stringify({
    key: leagueKey,
    teamName: 'Ilyn Payne',
    matchup: {
      team1: {
        name: 'Ilyn Payne',
        starters: [{ full: 'Josh Allen', real_position: 'QB', real_team: 'BUF', original_proj: 23.16, ecr: 'QB1', sos: 4 }],
        bench: [{ full: 'Courtland Sutton', real_position: 'WR', real_team: 'DEN', original_proj: 8.72, ecr: 'WR36', sos: 1 }]
      }
    }
  }), { headers: { 'Content-Type': 'application/json' } });
};

try {
  response = await worker.fetch(new Request(`https://draft.test/api/data-sources/sync?league=${leagueId}`, { method: 'POST' }), env, {});
  assert.equal(response.status, 201);
  const snapshot = await response.json();
  assert.equal(snapshot.coverage.roster, 'fantasypros');
  assert.equal(snapshot.coverage.available, 'saved');
  assert.equal(snapshot.roster[0].name, 'Josh Allen');
  assert.equal(snapshot.roster[0].week_proj, 23.16);
  assert.equal(snapshot.available[0].name, 'Puka Nacua');
  assert.equal(snapshot.sourceStatus.yahoo.ok, false);
  assert.equal(snapshot.sourceStatus.fantasypros.ok, true);

  response = await worker.fetch(new Request(`https://draft.test/api/data-sources?league=${leagueId}`), env, {});
  const status = await response.json();
  assert.equal(status.fantasyProsConfigured, true);
  assert.equal('fantasyProsLeagueKey' in status, false);
} finally {
  globalThis.fetch = nativeFetch;
}

console.log('League source sync tests passed');

import assert from 'node:assert/strict';
import worker from '../worker.js';

const data = new Map();
const kv = {
  get: async (key) => data.has(key) ? JSON.parse(data.get(key)) : null,
  put: async (key, value) => data.set(key, value),
  delete: async (key) => data.delete(key),
  list: async () => ({ keys: [] })
};

globalThis.fetch = async (url) => {
  const target = String(url);
  if (target.includes('preseason.json')) return {
    ok: true,
    json: async () => ({ generated_at: '2026-09-28', players: [{ id: 1, n: 'Test Skater', gp: 80, g: 30, a: 40, pm: 5, ppp: 20, sog: 250, hit: 50, blk: 25 }] })
  };
  if (target.includes('hashtaghockey.com')) return {
    ok: true,
    text: async () => '<tr><span id="Label2_0">Test Skater</span><td>1.5</td><td>C</td><td>TST</td><td>80</td><span id="LGOALS_0">0.4</span><span id="LASSISTS_0">0.6</span><span id="LPLUS_MINUS_0">0.1</span><span id="LPP_POINTS_0">0.2</span><span id="LSHOTS_ON_GOAL_0">3</span><span id="LHITS_0">0.5</span><span id="LBLOCKED_SHOTS_0">0.2</span>'
  };
  throw new Error('Unexpected fetch: ' + target);
};

const response = await worker.fetch(new Request('https://draft.test/api/nhl/preseason-projections'), { MOCKS: kv }, {});
assert.equal(response.status, 200);
const body = await response.json();
assert.equal(body.generatedAt, '2026-09-28');
assert.equal(body.sources.length, 2);
assert.equal(body.sources[0].rows[0].g, 30);
assert.equal(body.sources[1].rows[0].g, 32);
assert.equal(body.sources[1].rows[0].sog, 240);
console.log('NHL preseason raw projection source tests passed.');

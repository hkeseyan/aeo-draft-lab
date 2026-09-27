import assert from 'node:assert/strict';
import worker from '../worker.js';

const kv = {
  async get(key, options) {
    if (key !== 'yahooAuth:default') return null;
    const value = { access_token: 'test-token', expires_at: Date.now() + 600000 };
    return options?.type === 'json' ? value : JSON.stringify(value);
  }
};
const oldFetch = globalThis.fetch;
const seen = [];
globalThis.fetch = async input => {
  const url = String(input); seen.push(url);
  if (url.includes('/league/999.l.123/settings')) return new Response(JSON.stringify({
    fantasy_content: { league: [
      { league_key: '999.l.123', name: 'Saturday NHL', num_teams: 10 },
      { settings: [{ draft_type: 'live', scoring_type: 'headpoint',
        roster_positions: [{ roster_position: { position: 'D', count: 4 } }],
        stat_modifiers: { stats: [{ stat: { stat_id: '1', value: '6' } }] } }] }
    ] }
  }));
  if (url.includes('game_keys=nhl')) return new Response(JSON.stringify({
    fantasy_content: { users: [{ user: [{}, { games: {
      count: 1, 0: { game: [{}, { leagues: { count: 1,
        0: { league: [{ league_key: '999.l.123', name: 'Saturday NHL', season: '2026' }] }
      } }] }
    } }] }] }
  }));
  throw new Error(`Unexpected Yahoo request: ${url}`);
};
try {
  let res = await worker.fetch(new Request('https://draft.test/api/yahoo/leagues?game=nhl'), { MOCKS: kv }, {});
  assert.equal(res.status, 200);
  assert.equal((await res.json()).leagues[0].key, '999.l.123');
  res = await worker.fetch(new Request('https://draft.test/api/yahoo/league-settings?key=999.l.123'), { MOCKS: kv }, {});
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.teams, 10);
  assert.equal(data.rosterPositions[0].roster_position.count, 4);
  assert.equal(data.scoringType, 'headpoint');
  // Three outbound calls, not two: listing leagues, then settings, then the
  // per-league eligibility pull that the settings route now also performs.
  assert.equal(seen.length, 3);
  res = await worker.fetch(new Request('https://draft.test/api/yahoo/league-settings?key=not-a-key'), { MOCKS: kv }, {});
  assert.equal(res.status, 400);
  // An invalid key is rejected before any request goes out, so the count holds.
  assert.equal(seen.length, 3);
  console.log('Yahoo NHL league and settings tests passed');
} finally {
  globalThis.fetch = oldFetch;
}

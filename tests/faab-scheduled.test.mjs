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
  async delete(key) { this.data.delete(key); }
  async list({ prefix = '' } = {}) {
    return { keys: [...this.data.keys()].filter((key) => key.startsWith(prefix)).map((name) => ({ name })) };
  }
}

const leagues = [
  { id: 'off-with-their-heads', name: 'Off with their Heads', teams: 18, yahooLeagueKey: '461.l.18', meOwner: 'Ilyn Payne' },
  { id: 'off-with-their-heads-too', name: 'Off with their heads pt 2', teams: 12, yahooLeagueKey: '461.l.12', meOwner: 'Daejon Loves U' }
].map((profile) => ({
  ...profile,
  leagueType: 'guillotine',
  starters: { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 2 },
  flexEligible: ['RB', 'WR', 'TE'],
  playersCsv: `name,pos,team,ecr,week_proj,proj
Puka Nacua,WR,LAR,2,16.9,287.3
Malik Nabers,WR,NYG,10,11.4,193.8
Emeka Egbuka,WR,TB,16,10.5,178.5
Tucker Kraft,TE,GB,5,9.0,153`
}));

const entries = {
  'yahooAuth:default': JSON.stringify({ access_token: 'fixture-token', refresh_token: 'fixture-refresh', expires_at: Date.now() + 86400000 })
};
for (const profile of leagues) {
  entries[`league:${profile.id}`] = JSON.stringify(profile);
  entries[`leagueSource:${profile.id}`] = JSON.stringify({ yahooEnabled: true, fantasyProsEnabled: false });
  entries[`inseason:${profile.id}`] = JSON.stringify({ week: 3, startingBudget: 1000, remainingBudget: 1000, teamsAlive: profile.teams, scheduleEnabled: true });
}

const rosterPlayers = [
  ['461.p.1', 'Josh Allen', 'QB', 'BUF'],
  ['461.p.2', "De'Von Achane", 'RB', 'MIA'],
  ['461.p.3', 'Tony Pollard', 'RB', 'TEN'],
  ['461.p.4', 'Courtland Sutton', 'WR', 'DEN'],
  ['461.p.5', 'Keenan Allen', 'WR', 'LAC'],
  ['461.p.6', 'Tyler Warren', 'TE', 'IND']
];
const droppedPlayers = [
  ['461.p.101', 'Puka Nacua', 'WR', 'LAR'],
  ['461.p.102', 'Malik Nabers', 'WR', 'NYG'],
  ['461.p.103', 'Emeka Egbuka', 'WR', 'TB'],
  ['461.p.104', 'Tucker Kraft', 'TE', 'GB']
];
const playerNode = ([player_key, full, display_position, editorial_team_abbr], extra = {}) => ({ player_key, name: { full }, display_position, editorial_team_abbr, ...extra });

const staleProfile = { ...leagues[1], id: 'stale-pool', name: 'Stale pool fixture', yahooLeagueKey: '461.l.99' };
entries[`league:${staleProfile.id}`] = JSON.stringify(staleProfile);
entries[`leagueSource:${staleProfile.id}`] = JSON.stringify({ yahooEnabled: true, fantasyProsEnabled: false });
entries[`leagueSnapshot:${staleProfile.id}`] = JSON.stringify({
  roster: rosterPlayers.map((player) => playerNode(player)),
  available: droppedPlayers.map((player) => playerNode(player)),
  coverage: { roster: 'yahoo', available: 'yahoo' },
  freshness: { available: { current: true, source: 'yahoo', syncedAt: Date.now() - 86400000 } }
});
entries[`inseason:${staleProfile.id}`] = JSON.stringify({ week: 3, startingBudget: 1000, remainingBudget: 1000, teamsAlive: 12, scheduleEnabled: true });

const kv = new MemoryKv(entries);
const env = { MOCKS: kv, PUBLIC_ORIGIN: 'https://draft.test' };
const nativeFetch = globalThis.fetch;
globalThis.fetch = async (input) => {
  const url = new URL(String(input));
  if (url.pathname.includes('461.l.99')) return Response.json({ error: { description: 'This application is not authorized to perform this action.' } }, { status: 403 });
  const leagueKey = url.pathname.includes('461.l.18') ? '461.l.18' : url.pathname.includes('461.l.12') ? '461.l.12' : '';
  if (!url.hostname.includes('yahooapis.com') || !leagueKey) throw new Error(`Unexpected fetch: ${url}`);
  const suffix = leagueKey.endsWith('.18') ? '18' : '12';
  if (url.pathname.endsWith('/teams')) {
    return Response.json({ teams: [
      { team: { team_key: `${leagueKey}.t.1`, name: { full: suffix === '18' ? 'Ilyn Payne' : 'Daejon Loves U' }, is_owned_by_current_login: 1, faab_balance: 699 } },
      { team: { team_key: `${leagueKey}.t.2`, name: { full: 'Rival' }, faab_balance: 225 } }
    ] });
  }
  if (url.pathname.includes(`/team/${leagueKey}.t.1/roster`)) return Response.json({ players: rosterPlayers.map((player) => ({ player: playerNode(player) })) });
  if (url.pathname.includes('status=W')) return Response.json({ players: droppedPlayers.map((player) => ({ player: playerNode(player, { status: 'W' }) })) });
  if (url.pathname.includes('status=FA')) return Response.json({ players: [] });
  if (url.pathname.includes('/transactions')) {
    const timestamp = Math.floor(Date.now() / 1000);
    return Response.json({ transaction: { type: 'commish', timestamp, players: droppedPlayers.map((player) => ({ player: playerNode(player, { transaction_data: { type: 'drop', source_team_key: `${leagueKey}.t.9` } }) })) } });
  }
  throw new Error(`Unexpected Yahoo endpoint: ${url}`);
};

async function fireTuesday(iso) {
  let pending;
  worker.scheduled({ scheduledTime: Date.parse(iso) }, env, { waitUntil(promise) { pending = promise; } });
  await pending;
}

try {
  await fireTuesday('2026-09-22T08:00:00Z');
  for (const profile of leagues) {
    const state = await kv.get(`inseason:${profile.id}`, { type: 'json' });
    const reports = await kv.get(`inseasonReports:${profile.id}`, { type: 'json' });
    assert.equal(state.lastScheduledRun.status, 'created');
    assert.equal(state.lastScheduledRun.poolKind, 'newly_dropped_plus_available');
    assert.equal(state.remainingBudget, 699);
    assert.equal(reports.length, 1);
    assert.equal(reports[0].count, 4);
  }
  const staleState = await kv.get('inseason:stale-pool', { type: 'json' });
  assert.equal(staleState.lastScheduledRun.status, 'skipped');
  assert.match(staleState.dataSyncError, /Yahoo rejected Fantasy Sports access/);
  assert.equal(await kv.get('inseasonReports:stale-pool', { type: 'json' }), null);

  await fireTuesday('2026-11-10T08:00:00Z');
  assert.equal((await kv.get('inseasonReports:off-with-their-heads', { type: 'json' })).length, 1);
  await fireTuesday('2026-11-10T09:00:00Z');
  assert.equal((await kv.get('inseasonReports:off-with-their-heads', { type: 'json' })).length, 2);
  await fireTuesday('2026-11-10T09:00:00Z');
  assert.equal((await kv.get('inseasonReports:off-with-their-heads', { type: 'json' })).length, 2);
} finally {
  globalThis.fetch = nativeFetch;
}

console.log('Scheduled FAAB end-to-end fixture tests passed');

import assert from 'node:assert/strict';
import worker from '../worker.js';

// Accounts are off when GOOGLE_CLIENT_ID/SECRET are absent, which makes the
// caller an admin — enough to reach the import route without a real session.
const kv = { get: async () => null, put: async () => {}, delete: async () => {}, list: async () => ({ keys: [] }) };
const env = { MOCKS: kv };

function stubFantrax(responses) {
  globalThis.fetch = async (url) => {
    const u = String(url);
    const key = u.includes('getLeagueInfo') ? 'info' : u.includes('getTeamRosters') ? 'rosters' : null;
    assert.ok(key, 'unexpected outbound request: ' + u);
    return { ok: true, status: 200, json: async () => responses[key] };
  };
}
const call = (id) => worker.fetch(new Request(`https://x.test/api/import/fantrax/${id}`), env, {});

// ---- happy path -----------------------------------------------------------
stubFantrax({
  info: {
    leagueName: 'Puck Dynasty',
    draftType: 'SNAKE_DRAFT',
    rosterInfo: { maxTotalPlayers: 20 },
    teamInfo: { t1: { name: 'Ice Cold', id: 't1' }, t2: { name: 'Blue Line', id: 't2' } },
    playerInfo: {
      p1: { name: 'Connor McDavid' },
      p2: { firstName: 'Cale', lastName: 'Makar' },
      p3: { fullName: 'Igor Shesterkin' },
    },
  },
  rosters: {
    period: 1,
    rosters: {
      t1: { teamName: 'Ice Cold', rosterItems: [{ id: 'p1', position: 'C' }, { id: 'p2', position: 'D' }] },
      t2: { teamName: 'Blue Line', rosterItems: [{ id: 'p3', position: 'G' }] },
    },
  },
});
let res = await call('abc123');
let body = await res.json();
assert.equal(res.status, 200, 'happy path should succeed');
assert.equal(body.name, 'Puck Dynasty');
assert.equal(body.teams, 2);
assert.deepEqual(body.owners, ['Ice Cold', 'Blue Line']);
assert.deepEqual(body.ownerSlot, { 'Ice Cold': 1, 'Blue Line': 2 });
assert.equal(body.draftType, 'snake', 'SNAKE_DRAFT should map to snake');
assert.equal(body.rosterSize, 20);
assert.equal(body.rostersRaw,
  'Ice Cold|Connor McDavid|FA|NONE\nIce Cold|Cale Makar|FA|NONE\nBlue Line|Igor Shesterkin|FA|NONE',
  'all three name spellings should resolve');

// ---- Fantrax reports failure in the body, with HTTP 200 -------------------
stubFantrax({
  info: { error: { code: 'WARNING', message: "Invalid 'leagueId' parameter - league ID: nope not found" } },
  rosters: { error: { code: 'INVALID_LEAGUE_ID', message: 'Missing or invalid league ID.' } },
});
res = await call('nope');
body = await res.json();
assert.equal(res.status, 404, 'a 200-with-error body must not be treated as success');
assert.match(body.error, /Invalid 'leagueId'/);

// ---- two franchises sharing a display name -------------------------------
stubFantrax({
  info: { leagueName: 'Dupes', teamInfo: {}, playerInfo: { p1: { name: 'A Player' }, p2: { name: 'B Player' } } },
  rosters: {
    rosters: {
      t1: { teamName: 'The Kings', rosterItems: [{ id: 'p1' }] },
      t2: { teamName: 'The Kings', rosterItems: [{ id: 'p2' }] },
    },
  },
});
res = await call('dupes');
body = await res.json();
assert.deepEqual(body.owners, ['The Kings', 'The Kings (2)'], 'duplicate names must not collapse two rosters into one');
assert.equal(body.rostersRaw, 'The Kings|A Player|FA|NONE\nThe Kings (2)|B Player|FA|NONE');

// ---- player dictionary missing an entry ----------------------------------
stubFantrax({
  info: { leagueName: 'Sparse', teamInfo: {}, playerInfo: { p1: { name: 'Known Guy' } } },
  rosters: { rosters: { t1: { teamName: 'T', rosterItems: [{ id: 'p1' }, { id: 'p9' }] } } },
});
res = await call('sparse');
body = await res.json();
assert.match(body.rostersRaw, /T\|Known Guy\|FA\|NONE/);
assert.match(body.rostersRaw, /T\|p9\|FA\|NONE/, 'an unnamed player keeps its id rather than vanishing');
assert.match(body._note, /1 roster entries kept their Fantrax player id/);

// ---- auction leagues -----------------------------------------------------
stubFantrax({
  info: { leagueName: 'Cap', draftSettings: { draftType: 'AUCTION' }, teamInfo: {}, playerInfo: {} },
  rosters: { rosters: { t1: { teamName: 'T', rosterItems: [] } } },
});
body = await (await call('cap')).json();
assert.equal(body.draftType, 'auction', 'draftType should also be read from draftSettings');

console.log('Fantrax import: all checks passed.');

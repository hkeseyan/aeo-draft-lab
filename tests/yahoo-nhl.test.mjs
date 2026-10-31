import assert from 'node:assert/strict';
import worker from '../worker.js';

const kv = {
  async get(key, options) {
    if (key === 'league:fixture-goz') return {id:'fixture-goz',sport:'nba',name:'Game of Zones',yahooLeagueKey:'466.l.777'};
    if (key !== 'yahooAuth:default') return null;
    const value = { access_token: 'test-token', expires_at: Date.now() + 600000 };
    return options?.type === 'json' ? value : JSON.stringify(value);
  }
};
const oldFetch = globalThis.fetch;
const seen = [];
globalThis.fetch = async input => {
  const url = String(input); seen.push(url);
  if (url.includes('/league/466.l.777/draftresults')) return new Response(JSON.stringify({fantasy_content:{league:[{league_key:'466.l.777'},{draft_results:{count:2,0:{draft_result:{pick:1,round:1,team_key:'466.l.777.t.1',player_key:'466.p.1',cost:'37',is_keeper:'0'}},1:{draft_result:{pick:2,round:1,team_key:'466.l.777.t.1',player_key:'466.p.2',is_keeper:'1'}}}}]}}));
  if (url.includes('/league/466.l.777/teams')) return new Response(JSON.stringify({fantasy_content:{league:[{teams:{count:1,0:{team:[[{team_key:'466.l.777.t.1'},{name:'Ball Don’t Lie'},{is_owned_by_current_login:1}]]}}}]}}));
  if (url.includes('/players;player_keys=466.p.1,466.p.2')) return new Response(JSON.stringify({fantasy_content:{players:{count:2,0:{player:[[{player_key:'466.p.1'},{name:{full:'Anthony Davis'}}]]},1:{player:[[{player_key:'466.p.2'},{name:{full:'Nikola Jokić'}}]]}}}}));
  if (url.includes('/league/999.l.123/settings')) return new Response(JSON.stringify({
    fantasy_content: { league: [
      { league_key: '999.l.123', name: 'Saturday NHL', num_teams: 10 },
      { settings: [{ draft_type: 'live', scoring_type: 'headpoint',
        roster_positions: [{ roster_position: { position: 'D', count: 4 } }],
        stat_modifiers: { stats: [{ stat: { stat_id: '1', value: '6' } }] } }] }
    ] }
  }));
  if (url.includes('/league/999.l.123/teams')) return new Response(JSON.stringify({
    fantasy_content: { league: [{ league_key: '999.l.123' }, { teams: { count: 1,
      0: { team: [[{ team_key: '999.l.123.t.1' }, { name: 'Hovo' }, { is_owned_by_current_login: 1 }, { draft_position: 6 }]] }
    } }] }
  }));
  if (url.includes('game_keys=nba')) return new Response(JSON.stringify({
    fantasy_content: { users: [{ user: [{}, { games: {
      count: 1, 0: { game: [{}, { leagues: { count: 1,
        0: { league: [{ league_key: '466.l.777', name: 'Showtime', season: '2026' }] }
      } }] }
    } }] }] }
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
  // Four outbound calls: listing leagues, then settings, then the per-league
  // eligibility pull and the team list that the settings route also performs.
  assert.equal(seen.length, 4);
  assert.deepEqual(data.teamList, [{ key: '999.l.123.t.1', name: 'Hovo', draftPosition: 6, mine: true }]);
  res = await worker.fetch(new Request('https://draft.test/api/yahoo/league-settings?key=not-a-key'), { MOCKS: kv }, {});
  assert.equal(res.status, 400);
  // An invalid key is rejected before any request goes out, so the count holds.
  assert.equal(seen.length, 4);
  // NBA leagues list through the NBA game key.
  res = await worker.fetch(new Request('https://draft.test/api/yahoo/leagues?game=nba'), { MOCKS: kv }, {});
  assert.equal(res.status, 200);
  assert.equal((await res.json()).leagues[0].name, 'Showtime');
  res=await worker.fetch(new Request('https://draft.test/api/yahoo/draft-results?key=466.l.777'),{MOCKS:kv},{});
  assert.equal(res.status,200);
  const actual=await res.json();
  assert.equal(actual.count,2);assert.equal(actual.results[0].name,'Anthony Davis');
  assert.equal(actual.results[0].cost,37);assert.equal(actual.results[0].team,'Ball Don’t Lie');
  assert.equal(actual.results[1].cost,null,'a missing salary must not become a free player');assert.equal(actual.results[1].keeper,true);
  res=await worker.fetch(new Request('https://draft.test/api/yahoo/draft-results?league=fixture-goz'),{MOCKS:kv},{});
  assert.equal(res.status,200);assert.equal((await res.json()).results[0].cost,37,'resolve the saved connected profile without a pasted Yahoo key');
  res=await worker.fetch(new Request('https://draft.test/api/yahoo/draft-results?key=bad'),{MOCKS:kv},{});assert.equal(res.status,400);
  res=await worker.fetch(new Request('https://draft.test/api/yahoo/draft-results?key=466.l.777'),{MOCKS:kv,GOOGLE_CLIENT_ID:'test',GOOGLE_CLIENT_SECRET:'test'},{});assert.equal(res.status,401);
  console.log('Yahoo NHL/NBA league and settings tests passed');
} finally {
  globalThis.fetch = oldFetch;
}

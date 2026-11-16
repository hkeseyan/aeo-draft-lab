import assert from 'node:assert/strict';
import worker from '../worker.js';
import { yahooHockeySettings, buildYahooHockeyWaiverExport } from '../yahoo-hockey-export.js';

class MemoryKv {
  constructor(initial={}) { this.data = new Map(Object.entries(initial).map(([k,v]) => [k,typeof v==='string'?v:JSON.stringify(v)])); }
  async get(key, options) { const value=this.data.get(key);return value==null?null:options?.type==='json'?JSON.parse(value):value; }
  async put(key, value) { this.data.set(key,String(value)); }
  async delete(key) { this.data.delete(key); }
}
const leagueKey='999.l.135526';
const profile={id:'yahoo-h2h-135526',name:'Yahoo Prize H2H-Pts 135526',sport:'nhl',platform:'yahoo',scoringMode:'h2h-points',yahooLeagueKey:leagueKey};
const yahooSettings={fantasy_content:{league:[
  {league_key:leagueKey,name:'Prize Hockey Points',num_teams:'12',season:'2026'},
  {settings:[{scoring_type:'headpoint',max_weekly_adds:'4',min_goalie_appearances:'3',waiver_type:'1',
    roster_positions:[{roster_position:{position:'C',count:'2'}},{roster_position:{position:'D',count:'4'}}],
    stat_categories:{stats:[{stat:{stat_id:'1',name:'Goals',display_name:'G'}}]},
    stat_modifiers:{stats:[{stat:{stat_id:'1',value:'6'}}]}}]}
]}};
const normalize=yahooHockeySettings(yahooSettings);
assert.equal(normalize.waiverRules.maxWeeklyAdds,4);
assert.equal(normalize.waiverRules.minGoalieAppearances,3);
assert.deepEqual(normalize.rosterPositions[0],{position:'C',count:2});
assert.equal(normalize.statModifiers[0].points,6);
assert.equal(normalize.statModifiers[0].name,'Goals');
const player=(key,name,team,position)=>({player:[
  {player_key:key},{name:{full:name}},{editorial_team_abbr:team},
  {eligible_positions:[{position}]},{selected_position:{position:'BN'}}
]});
const rosterRaw={fantasy_content:{team:[{team_key:leagueKey+'.t.1'},{roster:{players:{count:1,0:player('999.p.1','My Center','BUF','C')}}}]}};
const pool=(key,name,team,status)=>({fantasy_content:{league:[
  {league_key:leagueKey},{players:{count:1,0:player(key,name,team,'LW')}}
]}});
const env={AUTH_TOKEN:'test-export-private-key',MOCKS:new MemoryKv({
  ['league:'+profile.id]:profile,
  'yahooAuth:default':{access_token:'super-private-token',expires_at:Date.now()+600000,client_id:null}
})};
const originalFetch=globalThis.fetch;
const calls=[];
globalThis.fetch=async(input)=>{
  const url=String(input);calls.push(url);
  const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
  if(url.includes('/league/'+leagueKey+'/teams'))return json({fantasy_content:{league:[{}, {teams:{count:1,0:{team:[[{team_key:leagueKey+'.t.1'},{name:'My Hockey Team'},{is_owned_by_current_login:1},{faab_balance:35}]]}}}]}});
  if(url.includes('/team/'+leagueKey+'.t.1/roster'))return json(rosterRaw);
  if(url.includes('/league/'+leagueKey+'/players;status=W'))return json(pool('999.p.2','Waiver Wing','MTL','W'));
  if(url.includes('/league/'+leagueKey+'/players;status=FA'))return json(pool('999.p.3','Free Agent Wing','VAN','FA'));
  if(url.includes('/league/'+leagueKey+'/transactions'))return json({fantasy_content:{league:[{}, {transactions:{count:0}}]}});
  if(url.includes('/league/'+leagueKey+'/settings'))return json(yahooSettings);
  throw Error('Unexpected Yahoo URL: '+url);
};
try{
  const endpoint='https://draft.test/api/yahoo/hockey-waiver-export?league='+profile.id;
  let response=await worker.fetch(new Request(endpoint,{headers:{'x-auth-token':'test-export-private-key'}}),env,{});
  assert.equal(response.status,404,'GET should not trigger a live refresh');
  response=await worker.fetch(new Request(endpoint,{method:'POST',headers:{'x-auth-token':'test-export-private-key'}}),env,{});
  assert.equal(response.status,201);
  const data=await response.json();
  assert.equal(data.verifiedLiveYahoo,true);
  assert.equal(data.freshForCurrentRequest,true);
  assert.equal(data.roster[0].name,'My Center');
  assert.equal(data.roster[0].roster_slot,'BN');
  assert.equal(data.availablePlayers.length,2);
  assert.deepEqual(data.availablePlayers.map(p=>p.availability_status).sort(),['FA','W']);
  assert.equal(data.settings.waiverRules.maxWeeklyAdds,4);
  assert.equal(data.myTeam.name,'My Hockey Team');
  assert.equal(data.availablePool.poolLimitPerStatus,200);
  assert.equal(data.availablePool.potentiallyTruncated,false);
  assert.ok(!JSON.stringify(data).includes('super-private-token'));
  assert.ok(calls.some(path=>path.includes('/settings')));
  response=await worker.fetch(new Request(endpoint,{headers:{'x-auth-token':'test-export-private-key'}}),env,{});
  assert.equal(response.status,200);
  const cached=await response.json();
  assert.equal(cached.cached,true);
  assert.equal(cached.freshForCurrentRequest,false);
  assert.equal(cached.roster.length,1);
  assert.equal((await env.MOCKS.get('hockeyWaiverExport:'+profile.id,{type:'json'})).verifiedLiveYahoo,true);

  // A saved pool from a prior run is not permission to present the answer as live.
  globalThis.fetch=async()=>new Response('Yahoo API 403: This application is not authorized to perform this action',{status:403});
  await env.MOCKS.put('leagueSnapshot:'+profile.id,JSON.stringify({
    roster:[{name:'Old Player'}],available:[{name:'Old Free Agent'}],
    coverage:{roster:'saved',available:'saved'},
    freshness:{roster:{current:false},available:{current:false}}
  }));
  response=await worker.fetch(new Request(endpoint,{method:'POST',headers:{'x-auth-token':'test-export-private-key'}}),env,{});
  assert.equal(response.status,503);
  const failed=await response.json();
  assert.equal(failed.fallbackOnly,true);
  assert.equal(failed.sourceStatus.yahoo.ok,false);
}finally{globalThis.fetch=originalFetch;}
console.log('Yahoo hockey live export, privacy and stale-fallback tests passed.');

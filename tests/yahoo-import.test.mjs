import assert from 'node:assert/strict';
import worker from '../worker.js';

// Drives GET /api/import/yahoo/:leagueKey with stubbed Yahoo responses shaped
// like the real Fantasy API's JSON (numbered-key objects, meta arrays).
class MemoryKv {
  constructor(entries={}) { this.data=new Map(Object.entries(entries)); }
  async get(key, options) {
    const v=this.data.get(key); if(v==null)return null;
    return options&&options.type==='json'?JSON.parse(v):v;
  }
  async put(key,value){this.data.set(key,String(value));}
  async delete(key){this.data.delete(key);}
  async list({prefix=''}={}){return {keys:[...this.data.keys()].filter(k=>k.startsWith(prefix)).map(name=>({name}))};}
}
const grant={access_token:'tok',refresh_token:'r',expires_at:Date.now()+3600000,connected_at:Date.now(),client_id:'cid'};
const env=()=>({MOCKS:new MemoryKv({'yahooAuth:default':JSON.stringify(grant)}),YAHOO_CLIENT_ID:'cid',YAHOO_CLIENT_SECRET:'s'});

// Keeper info is put in a later block of the player node, not the meta array, to
// check the importer looks across the whole node.
const player=(key,full,pos,extra=[])=>({player:[[{player_key:key},{name:{full}},{display_position:pos}],{selected_position:[{position:pos}]},...extra]});
const team=(key,id,name,players,extra=[])=>({team:[[{team_key:key},{team_id:id},{name},...extra,{managers:[{manager:{nickname:'x',is_current_login:extra.length?'1':undefined}}]}],
  {roster:{0:{players:Object.assign({count:players.length},...players.map((p,i)=>({[i]:p})))}}}]});

const settings={fantasy_content:{league:[
  {league_key:'449.l.123',name:'Sunday Funday',num_teams:2,game_code:'nfl'},
  {settings:[{draft_type:'live',is_auction_draft:'0',scoring_type:'head',roster_positions:[
    {roster_position:{position:'QB',count:1}},{roster_position:{position:'WR',count:2}},
    {roster_position:{position:'W/R/T',count:1}},{roster_position:{position:'Q/W/R/T',count:1}},
    {roster_position:{position:'DEF',count:1}},{roster_position:{position:'BN',count:5}},
    {roster_position:{position:'IR',count:2}}]}]}]}};
const teams={fantasy_content:{league:[{league_key:'449.l.123'},{teams:{count:2,
  0:team('449.l.123.t.1',1,'Hovo Ball',[player('449.p.1','Josh Allen','QB'),player('449.p.2',"Ja'Marr Chase",'WR',[{is_keeper:{status:'1',cost:'2',kept:true}}])],[{is_owned_by_current_login:1}]),
  1:team('449.l.123.t.2',2,'Rival',[player('449.p.3','Puka Nacua','WR')]),
}}]}};
const draft={fantasy_content:{league:[{league_key:'449.l.123'},{draft_results:{count:3,
  0:{draft_result:{pick:1,round:1,team_key:'449.l.123.t.2',player_key:'449.p.2'}},
  1:{draft_result:{pick:2,round:1,team_key:'449.l.123.t.1',player_key:'449.p.3'}},
  2:{draft_result:{pick:3,round:2,team_key:'449.l.123.t.1',player_key:'449.p.1'}},
}}]}};

function stub(map){
  globalThis.fetch=async(url,opts)=>{
    const u=String(url);
    assert.equal(opts.headers.Authorization,'Bearer tok');
    const hit=Object.keys(map).find(k=>u.includes(k));
    assert.ok(hit,'unexpected request '+u);
    const v=map[hit];
    return v===404?{ok:false,status:404,text:async()=>'nope'}:{ok:true,status:200,text:async()=>JSON.stringify(v)};
  };
}
const call=(key,e=env())=>worker.fetch(new Request('https://x.test/api/import/yahoo/'+key),e,{});

// ---- happy path -------------------------------------------------------------
stub({'/settings':settings,'/teams/roster':teams,'/draftresults':draft});
let res=await call('449.l.123'), body=await res.json();
assert.equal(res.status,200,JSON.stringify(body));
assert.equal(body.name,'Sunday Funday');
assert.equal(body.teams,2);
assert.equal(body.sport,'nfl');
assert.deepEqual(body.owners,['Hovo Ball','Rival']);
assert.equal(body.meOwner,'Hovo Ball');
// Draft order from round 1 of the draft results: Rival picked first.
assert.deepEqual(body.ownerSlot,{'Hovo Ball':2,'Rival':1});
assert.equal(body.mySlot,2);
assert.deepEqual(body.starters,{QB:1,WR:2,FLEX:1,SUPERFLEX:1,DST:1});
assert.equal(body.superflex,true);
assert.equal(body.rosterSize,11,'starters + bench, IR excluded');
assert.equal(body.irSlots,2);
assert.equal(body.draftType,'snake');
assert.equal(body.yahooLeagueKey,'449.l.123');
assert.equal(body.rostersRaw,["Hovo Ball|Josh Allen|2|NONE","Hovo Ball|Ja'Marr Chase|1|NONE","Rival|Puka Nacua|1|NONE"].join('\n'));
assert.equal(body.platformEligibility.yahoo['josh allen'],'QB');
assert.match(body._note,/1 rostered player\(s\) as keepers/);

// ---- not drafted yet: draftresults fails, everyone FA, team_id order --------
stub({'/settings':settings,'/teams/roster':teams,'/draftresults':404});
body=await (await call('449.l.123')).json();
assert.deepEqual(body.ownerSlot,{'Hovo Ball':1,'Rival':2});
assert.ok(body.rostersRaw.split('\n').every(l=>l.endsWith('|FA|NONE')));
assert.match(body._note,/hasn't drafted yet/);

// ---- errors -----------------------------------------------------------------
assert.equal((await call('not-a-key')).status,400);
assert.equal((await call('449.l.123',{MOCKS:new MemoryKv(),YAHOO_CLIENT_ID:'cid'})).status,401);
stub({'/settings':404,'/teams/roster':teams,'/draftresults':draft});
res=await call('449.l.123');
assert.equal(res.status,502);
assert.match((await res.json()).error,/Yahoo import failed: Yahoo API 404/);

console.log('Yahoo league import tests passed.');

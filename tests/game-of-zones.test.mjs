import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';

let source=fs.readFileSync('public/index.html','utf8').replace(/<script src="\/auction-values\.js"><\/script>/,()=>'<script>'+fs.readFileSync('public/auction-values.js','utf8')+'</script>');
const puts=[],history=[],setups=new Map(),errors=[];
let cloud=[];
const dom=new JSDOM(source,{url:'https://example.test/',runScripts:'dangerously',pretendToBeVisual:true,beforeParse(w){
  w.fetch=async(raw,options={})=>{
    const url=new URL(String(raw),'https://example.test/'),p=url.pathname,key=url.searchParams.get('league'),method=options.method||'GET',body=options.body?JSON.parse(options.body):null;
    let result={};
    if(p==='/api/me')result={accountsEnabled:false,signedIn:false,admin:true,user:null};
    else if(p==='/api/leagues')result=cloud;
    else if(p.startsWith('/api/leagues/')){if(method==='PUT')puts.push(body);result=body||{};}
    else if(p==='/api/setup'){
      if(method==='PUT'){if(setups.has(key))history.push(setups.get(key));setups.set(key,body);}
      result=setups.get(key)||{};
    }else if(p.endsWith('/history')||p==='/api/mocks')result=[];
    return {ok:true,status:200,json:async()=>result,text:async()=>JSON.stringify(result)};
  };
  w.addEventListener('error',e=>errors.push(e.message));
}});
await new Promise(r=>setTimeout(r,600));
const w=dom.window,ev=s=>w.eval(s);
ev('applyLeagueProfile("game-of-zones-2026")');
await new Promise(r=>setTimeout(r,50));
assert.equal(ev('KEEPERS.length'),61);
assert.equal(ev('leagueKeeperKeys().length'),61);
assert.equal(ev('auctionTeamState(mySlot).left'),99);
assert.equal(ev('auctionTeamState(mySlot).open'),12);
assert.equal(ev('findPlayer("Trey Murphy III").drafted'),true);
assert.equal(ev('findPlayer("Scottie Barnes").drafted'),false);
assert.equal(ev('nbaCatWeight("TO")'),.25);
assert.equal(ev('nbaCatWeight("FT%")'),1);
assert.ok(ev('findPlayer("Cade Cunningham").categoryValue>findPlayer("Giannis Antetokounmpo").categoryValue'));
assert.ok(ev('auctionTargetValues().get(findPlayer("Cade Cunningham").id)>auctionTargetValues().get(findPlayer("Giannis Antetokounmpo").id)'));
for(const kind of ['auctionMarketValues()','auctionTargetValues()']){
  assert.equal(ev(`${kind}.size`),59);
  assert.equal(ev(`[...${kind}.values()].reduce((a,v)=>a+v,0)`),441);
}
assert.equal(w.document.querySelectorAll('#auctionPoolTable tbody tr').length,ev('available().filter(auctionEligible).length'));
assert.ok(w.document.querySelectorAll('#auctionPoolTable tbody tr').length>300);
assert.ok(w.document.querySelector('#auctionPoolTable thead').textContent.includes('Win est. $'));
assert.ok(w.document.querySelector('#auctionPoolTable tbody').textContent.includes('Last in tier'));
assert.ok(w.document.querySelector('#auctionPoolTable tbody').textContent.includes('FT impact'));
assert.ok(ev('(()=>{const pool=available(),t=nbaAuctionTierMap(pool,auctionTargetValues());return t.get(findPlayer("Cade Cunningham").id).tier<t.get(findPlayer("Scottie Barnes").id).tier})()'));

// Update the exact existing imported league, retaining its ID, Yahoo linkage,
// nomination order and date, with no duplicate profile and no stale points mode.
const def=ev('LEAGUES_DEFAULT["game-of-zones-2026"]');
puts.length=0;
cloud=[{...def,id:'fixture-existing-goz',name:'Game of Zones Dynasty',keeperDataRevision:null,leagueKeepers:[],rostersRaw:'',playersCsv:'',scoringMode:'points',categoryWeights:{TO:1},teams:8,rosterSize:18,yahooLeagueKey:'fixture-nba.l.fixture',draftDateLabel:'Fixture draft date',ownerSlot:Object.fromEntries(def.owners.map((o,i)=>[o,[3,1,2,4,5,6][i]]))}];
const migrated=await ev('fetchCloudLeagues()');
assert.ok(migrated['fixture-existing-goz']);
assert.equal(migrated['game-of-zones-2026'],undefined);
const profile=migrated['fixture-existing-goz'];
assert.equal(profile.yahooLeagueKey,'fixture-nba.l.fixture');
assert.equal(profile.draftDateLabel,'Fixture draft date');
assert.equal(profile.mySlot,3);
assert.equal(profile.scoringMode,'roto');
assert.equal(profile.categoryWeights.TO,.25);
assert.equal(profile.leagueKeepers.length,61);
assert.ok(puts.some(p=>p.id==='fixture-existing-goz'&&p.leagueKeepers.length===61));
assert.ok(!puts.some(p=>p.id==='game-of-zones-2026'));
w.__migrated=migrated;ev('LEAGUES=window.__migrated;delete window.__migrated;');
const stale={assigned:["Ball Don't Lie|Scottie Barnes"],auctionPicks:[{playerId:1,owner:1,price:90}],puntCats:['FT%'],picks:[]};
setups.set('fixture-existing-goz',stale);
ev('applyLeagueProfile("fixture-existing-goz")');
await new Promise(r=>setTimeout(r,100));
assert.equal(ev('KEEPERS.length'),61);
assert.equal(ev('auctionTeamState(mySlot).left'),99);
assert.equal(ev('auctionPicks.length'),0);
assert.equal(ev('PUNT_CATS.size'),0);
assert.ok(history.includes(stale),'old setup backed up before final baseline replaces it');
assert.equal(setups.get('fixture-existing-goz').keeperDataRevision,def.keeperDataRevision);

// A manual sale changes the actual pool and both price layers, respects legal
// bids, survives reload, and updates the last-player-in-tier signal.
ev('el("auctionPlayerInput").value="Cade Cunningham";el("auctionWinner").value=ME_OWNER;el("auctionPrice").value=30;recordAuctionSale()');
assert.equal(ev('auctionPicks.length'),1);
assert.equal(ev('auctionTeamState(mySlot).left'),69);
assert.equal(ev('auctionTargetValues().size'),58);
assert.equal(ev('[...auctionTargetValues().values()].reduce((a,v)=>a+v,0)'),411);
assert.ok(!w.document.querySelector('#auctionPoolTable tbody').textContent.includes('Cade Cunningham'));
await new Promise(r=>setTimeout(r,700));
await ev('loadSetup()');
assert.equal(ev('auctionPicks.length'),1);
assert.equal(ev('auctionTeamState(mySlot).left'),69);
assert.equal(ev('KEEPERS.length'),61);
assert.ok(ev(`(()=>{const t=auctionTargetValues(),m=auctionMarketValues();return available().every(p=>{const b=nbaAuctionBidGuide(p,t,m);return b.target<=b.stretch&&b.stretch<=auctionTeamState(mySlot).maxBid})})()`));
assert.ok(ev(`(()=>{for(let i=0;i<58;i++){if(!simAuctionSale()||OWNERS.some(o=>!auctionTeamState(OWNER_SLOT[o]).valid))return false;}return auctionPicks.length===59&&OWNERS.every(o=>auctionTeamState(OWNER_SLOT[o]).used===20)&&!simAuctionSale()})()`));
assert.deepEqual(errors,[]);
dom.window.close();
console.log('Game of Zones: final keepers, existing-league migration, category tiers, exact budgets, persistence and complete auction passed.');

import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
await import('../public/roto-forecast.js');
const R=globalThis.RotoForecast;
const cats=[{key:'PTS',stat:'pts'},{key:'TO',stat:'to',lowerBetter:true},{key:'FG%',ratio:{numerator:'fgm',denominator:'fga'}}];
const player=(id,eligibleSlots,games,priority,stats={pts:games*10,to:games,fgm:games*4,fga:games*8})=>({id,name:id,eligibleSlots,games,priority,stats});
const slot=(key,count=1,gamesPerSlot=82)=>({key,count,gamesPerSlot,capacity:count*gamesPerSlot});

// Weighted matching protects the best legal core and reroutes dual eligibility.
let t=R.projectTeam({id:'a',name:'A',players:[player('star',['G','F'],40,20),player('guard',['G'],82,15),player('reserve',['F'],60,1)]},[slot('G'),slot('F')],cats,.75);
assert.equal(t.players.find(p=>p.id==='star').countedGames,40);
assert.equal(t.players.find(p=>p.id==='guard').countedGames,82);
assert.equal(t.players.find(p=>p.id==='reserve').replacementGames,31.5);
assert.equal(t.games,153.5);
assert.equal(t.values.PTS,1535);
assert.equal(t.values['FG%'],.5);
assert.ok(t.usage.every(s=>s.used<=s.capacity));
assert.ok(t.players.every(p=>p.countedGames<=p.games));

const limited=[player('g',['G'],40,9),player('f',['F'],40,8),player('dual',['G','F'],10,1)];
t=R.projectTeam({id:'limited',players:limited},[slot('G'),slot('F')],cats,1);
assert.equal(t.replacementGames,10,'one reserve GP budget is shared across positions');
assert.equal(t.games,90);
const weekly=R.projectTeam({id:'weekly',players:[player('core',['G'],42,5),player('bench',['G'],82,1)]},[slot('G')],cats,.5);
assert.equal(weekly.replacementGames,20,'weekly coverage is an explicit partial gap assumption');
assert.equal(R.projectTeam({id:'out',players:[player('out',['G'],0,100,{pts:999}),player('healthy',['G'],40,1)]},[slot('G')],cats,1).games,40,'no synthetic replacement credit for an absent player');

const rateTeam=R.projectTeam({id:'rate',players:[player('volume',['G'],1,5,{pts:10,to:1,fgm:100,fga:200}),player('small',['F'],1,5,{pts:10,to:1,fgm:90,fga:100})]},[slot('G'),slot('F')],cats,0);
assert.ok(Math.abs(rateTeam.values['FG%']-190/300)<1e-10,'percentages pool attempts');
let standings=R.standings([{id:'x',name:'x',values:{PTS:10,TO:5,'FG%':.5}},{id:'y',name:'y',values:{PTS:10,TO:2,'FG%':.6}},{id:'z',name:'z',values:{PTS:1,TO:2,'FG%':.4}}],cats);
assert.equal(standings.find(t=>t.id==='x').categoryPoints.PTS,2.5,'tied positions split points');
assert.equal(standings.find(t=>t.id==='y').categoryPoints.TO,2.5,'turnovers reverse direction at full standings weight');
assert.equal(standings.reduce((n,t)=>n+t.points,0),18,'three categories each distribute six points');
const empty=R.projectTeam({id:'empty',players:[]},[slot('G')],cats,1);
assert.equal(empty.values.TO,null,'empty teams must not win lower-is-better categories');

const swapBase=R.projectTeam({id:'swap',players:[player('from',['G'],82,10),player('to',['G'],60,1,{pts:1200,to:30,fgm:300,fga:500})]},[slot('G')],cats,0);
const swap=R.transfer(swapBase,[slot('G')],cats,'from','to',20);
assert.equal(swap.moved,20);assert.equal(swap.team.games,82);assert.equal(swap.team.values.PTS,1020);
assert.equal(swap.team.players.find(p=>p.id==='to').countedGames,20);
assert.equal(R.transfer(swapBase,[slot('G')],cats,'from','to',99).moved,60,'replacement cannot exceed projected availability');
assert.equal(R.transfer(swapBase,[slot('G')],cats,'from','unowned',20).moved,0);
assert.equal(R.transfer({...swapBase,players:swapBase.players.map(p=>p.id==='to'?{...p,eligibleSlots:['C']}:p)},[slot('G')],cats,'from','to',20).moved,0);
assert.equal(swapBase.players.find(p=>p.id==='to').countedGames,0,'scenarios never mutate the baseline');

// Hockey and future sports use category definitions, never NBA-specific math.
const goalieCats=[{key:'W',stat:'w',group:'goalie'},{key:'SV%',group:'goalie',ratio:{numerator:'sv',denominator:'sa'}},{key:'GAA',group:'goalie',lowerBetter:true,ratio:{numerator:'ga',denominator:'minutes',multiplier:60}}];
const hockey=R.projectTeam({id:'hockey',players:[{...player('g1',['G'],40,10,{w:20,sv:1000,sa:1100,ga:100,minutes:2400}),group:'goalie'},{...player('g2',['G'],30,5,{w:10,sv:500,sa:600,ga:100,minutes:1800}),group:'goalie'}]},[slot('G',2)],goalieCats,1);
assert.equal(hockey.values.W,30);assert.equal(hockey.values['SV%'],1500/1700);assert.equal(hockey.values.GAA,200/4200*60);
const baseballCats=[{key:'HR',stat:'hr'},{key:'ERA',lowerBetter:true,ratio:{numerator:'er',denominator:'ip',multiplier:9}}];
const baseball=R.projectTeam({id:'baseball',players:[player('pitcher',['P'],30,10,{er:60,ip:180,hr:0})]},[slot('P',1,162)],baseballCats,0);
assert.equal(baseball.values.ERA,3);

let html=fs.readFileSync('public/index.html','utf8');
for(const script of ['auction-values','roto-forecast','roto-ui'])html=html.replace(`<script src="/${script}.js"></script>`,()=>'<script>'+fs.readFileSync(`public/${script}.js`,'utf8')+'</script>');
const errors=[],saves=[];let snapshot=null;
const dom=new JSDOM(html,{url:'https://example.test/',runScripts:'dangerously',pretendToBeVisual:true,beforeParse(w){
  w.fetch=async(raw,options={})=>{
    const u=String(raw);let data={};
    if(u==='/api/me')data={accountsEnabled:false,admin:true};
    else if(u==='/api/leagues')data=[];
    else if(u.startsWith('/api/yahoo/roto-rosters'))data=snapshot;
    else if(u.startsWith('/api/setup')&&options.method==='PUT')saves.push(JSON.parse(options.body));
    else if(u.includes('/history')||u.startsWith('/api/mocks'))data=[];
    return {ok:true,status:200,json:async()=>data,text:async()=>JSON.stringify(data)};
  };
  w.addEventListener('error',e=>errors.push(e.message));
}});
await new Promise(r=>setTimeout(r,600));
const w=dom.window,ev=s=>w.eval(s);
ev('applyLeagueProfile("game-of-zones-2026")');
await new Promise(r=>setTimeout(r,50));
assert.equal(w.document.querySelector('#rotoForecastCard').style.display,'');
assert.equal(w.document.querySelectorAll('#rotoStandingsTable [data-roto-team]').length,6);
assert.match(w.document.querySelector('#rotoForecastStatus').textContent,/Incomplete rosters/);
const beforePicks=ev('JSON.stringify(auctionPicks)');
snapshot={source:'Yahoo current rosters',fetchedAt:'2026-10-31T12:00:00Z',teams:[
  {id:'live-a',name:'My live team',mine:true,players:[{name:'Nikola Jokic',player_key:'n.1',pos:'C'},{name:'Keyonte George',player_key:'n.2',pos:'PG'},{name:'Paul George',player_key:'n.3',pos:'SG/SF'}]},
  ...['Stephen Curry','Anthony Davis','Jalen Johnson','Shai Gilgeous-Alexander','Victor Wembanyama'].map((name,i)=>({id:'live-'+i,name:'Fixture '+i,players:[{name,player_key:'f.'+i}]}))]};
await ev('loadRotoYahooRosters()');
assert.equal(ev('ROTO_FORECAST.source'),'yahoo');
assert.equal(ev('JSON.stringify(auctionPicks)'),beforePicks);
assert.match(w.document.querySelector('#rotoForecastStatus').textContent,/Yahoo roster snapshot/);
assert.equal(w.document.querySelectorAll('#rotoPlayerGames tbody tr').length,3);
const input=w.document.querySelector('[data-roto-gp="n.2"]');input.value='20';input.dispatchEvent(new w.Event('change'));
assert.equal(ev('ROTO_FORECAST.games["live-a|n.2"]'),20);
await new Promise(r=>setTimeout(r,700));
assert.equal(saves.at(-1).rotoForecast.games['live-a|n.2'],20);
const cfg=ev('getConfig()');assert.equal(cfg.rotoForecast.source,'yahoo');
ev('applyLeagueProfile("yahoo-nhl-public-roto")');
assert.equal(ev('ROTO_FORECAST.source'),undefined,'league switches isolate scenarios');
assert.equal(w.document.querySelector('#rotoForecastCard').style.display,'');
assert.equal(w.document.querySelectorAll('#rotoStandingsTable [data-roto-team]').length,12);
ev('applyLeagueProfile("yahoo-nba-public-cat")');
assert.equal(w.document.querySelector('#rotoForecastCard').style.display,'none','H2H is not mislabeled roto');
await new Promise(r=>setTimeout(r,800));
assert.deepEqual(errors,[]);
dom.window.close();
console.log('Roto forecast: legal allocation, replacement limits, pooled ratios, ties, full category scoring, scenarios, Yahoo isolation, persistence and NBA/NHL UI passed.');

import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';

let source=fs.readFileSync('public/index.html','utf8');
for(const file of ['auction-values','roto-forecast','roto-ui'])source=source.replace(`<script src="/${file}.js"></script>`,()=>'<script>'+fs.readFileSync(`public/${file}.js`,'utf8')+'</script>');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function boot(url,storage={},identity={accountsEnabled:false,admin:true,signedIn:false}){
  const errors=[];
  const dom=new JSDOM(source,{url,runScripts:'dangerously',pretendToBeVisual:true,beforeParse(w){
    w.localStorage.__proto__.getItem=k=>storage[k]??null;
    w.localStorage.__proto__.setItem=(k,v)=>storage[k]=String(v);
    w.fetch=async(raw,options={})=>{
      const path=new URL(String(raw),'https://example.test').pathname;
      let data={};
      if(path==='/api/me')data=identity;
      else if(path==='/api/leagues')data=[];
      else if(path.startsWith('/api/leagues/')&&options.body)data=JSON.parse(options.body);
      else if(path==='/api/rankings')data={events:[]};
      else if(path==='/api/mocks'||path.includes('/history'))data=[];
      return {ok:true,status:200,json:async()=>data,text:async()=>JSON.stringify(data)};
    };
    w.addEventListener('error',e=>errors.push(e.message));
  }});
  await delay(650);
  return {dom,w:dom.window,ev:s=>dom.window.eval(s),errors};
}
const storage={};
let app=await boot('https://example.test/?league=game-of-zones-2026',storage);
let {w,ev}=app;
const click=selector=>w.document.querySelector(selector).click();
const active=()=>w.document.querySelector('main .view.active')?.id;
assert.equal(ev('ACTIVE_AREA'),'inseason');
assert.equal(active(),'view-roto');
assert.equal(w.document.querySelector('#rotoForecastCard').closest('.view').id,'view-roto');
assert.equal(w.document.querySelector('#view-room #rotoForecastCard'),null);
assert.equal(w.document.querySelectorAll('#rotoForecastCard').length,1);
assert.equal(w.document.querySelectorAll('#rotoPuntControls [data-cat-weight]').length,9);
assert.equal(w.document.querySelector('#pageNav').getAttribute('aria-label'),'In-season pages');

ev('ROTO_FORECAST.coverage=.5;ROTO_FORECAST.games={"fixture|player":20};auctionPicks=[{playerId:findPlayer("Stephen Curry").id,owner:mySlot,price:14}];render()');
const savedState=ev('JSON.stringify([auctionPicks,KEEPERS,ROTO_FORECAST])');
click('[data-area="draft"]');
assert.equal(active(),'view-room');
assert.equal(w.document.querySelector('[data-view="trades"]').textContent,'Draft Trades');
assert.equal(w.document.querySelector('[data-view="season-trades"]').style.display,'none');
click('[data-view="mocks"]');
assert.equal(active(),'view-mocks');assert.equal(w.location.hash,'#draft/mocks');
click('[data-area="inseason"]');
assert.equal(active(),'view-roto');
click('[data-area="draft"]');
assert.equal(active(),'view-mocks','returning to an area restores its page');
assert.equal(ev('JSON.stringify([auctionPicks,KEEPERS,ROTO_FORECAST])'),savedState,'navigation preserves draft and forecast state');
click('[data-area="inseason"]');click('[data-view="season-trades"]');
assert.equal(active(),'view-season-trades');
assert.match(w.document.querySelector('#view-season-trades').textContent,/Planned/);
assert.equal(w.document.querySelector('[data-view="h2h"]').dataset.available,'false');
ev('switchLeague("yahoo-nba-public-points")');
assert.equal(ev('ACTIVE_AREA'),'inseason','switching leagues retains the management area');
assert.equal(w.document.querySelector('[data-view="h2h"]').dataset.available,'true');
click('[data-view="h2h"]');
assert.equal(active(),'view-h2h');
ev('switchLeague("game-of-zones-2026")');
assert.equal(active(),'view-season-trades','an inapplicable matchup page restores this league’s last In-season page');
assert.equal(w.document.querySelector('[data-view="radar"]').style.display,'none');

click('[data-area="tools"]');
assert.equal(active(),'view-tools-home');
click('#openPlayerRanker');
assert.equal(ev('SPORT.id'),'nfl');assert.equal(active(),'view-ranker');
assert.equal(w.location.hash,'#tools/ranker');
ev('switchLeague("game-of-zones-2026")');
assert.equal(active(),'view-tools-home','NFL-only ranker falls back within Tools');
click('[data-area="commissioner"]');
assert.equal(active(),'view-leagues');
assert.equal(w.document.querySelector('[data-view="data"]').style.display,'');

// History navigation uses the route, and a direct route beats saved preferences.
w.history.replaceState({},'','?league=game-of-zones-2026#draft/teams');
w.dispatchEvent(new w.PopStateEvent('popstate'));
assert.equal(active(),'view-teams');
assert.equal(w.document.querySelectorAll('main .view.active').length,1);
await delay(800);assert.deepEqual(app.errors,[]);app.dom.window.close();

app=await boot('https://example.test/?league=game-of-zones-2026',storage);
assert.equal(app.ev('ACTIVE_PAGE'),'teams','reload restores the last area and page');
await delay(800);assert.deepEqual(app.errors,[]);app.dom.window.close();
app=await boot('https://example.test/?league=game-of-zones-2026#inseason/roto',storage);
assert.equal(app.ev('ACTIVE_PAGE'),'roto','direct link overrides saved Draft navigation');
await delay(800);assert.deepEqual(app.errors,[]);app.dom.window.close();

// New navigation cannot widen access or leave private roto data in guest DOM.
app=await boot('https://example.test/?league=game-of-zones-2026#commissioner/commish',{}, {accountsEnabled:true,admin:false,signedIn:true,user:{name:'Fixture'}});
assert.equal(app.w.document.querySelector('[data-area="commissioner"]').style.display,'none');
assert.equal(app.ev('showAppPage("commish")'),false);
assert.equal(app.w.document.querySelector('#view-commish'),null);
assert.equal(app.ev('ACTIVE_AREA'),'inseason');
await delay(800);assert.deepEqual(app.errors,[]);app.dom.window.close();
app=await boot('https://example.test/?guest=1#inseason/roto');
assert.equal(app.ev('ACTIVE_PAGE'),'room');
assert.equal(app.w.document.querySelector('#rotoForecastCard'),null);
assert.equal(app.w.document.querySelector('[data-area="inseason"]').style.display,'none');
assert.equal(app.w.document.querySelector('[data-area="tools"]').style.display,'none');
await delay(800);assert.deepEqual(app.errors,[]);app.dom.window.close();
console.log('Workspace navigation: hierarchy, standalone roto, state preservation, league fallbacks, NFL tools, deep links, reload and access boundaries passed.');

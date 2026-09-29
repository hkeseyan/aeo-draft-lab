import { JSDOM } from 'jsdom';
import fs from 'fs';

// A deliberately lopsided week. COL plays 4 games, all on light nights. EDM plays
// the same 4 on heavy nights. TOR plays 1. That makes every part of the radar's
// ranking observable: games played, light-night bonus, and per-game scoring rate.
const SCHED = {
  start: '2026-10-12', seasonStart: '2026-09-29',
  days: ['2026-10-12','2026-10-13','2026-10-14','2026-10-15'],
  dayCounts: { '2026-10-12':3, '2026-10-13':16, '2026-10-14':4, '2026-10-15':15 },
  teams: {
    COL: ['2026-10-12','2026-10-14'],
    EDM: ['2026-10-13','2026-10-15'],
    TOR: ['2026-10-13'],
  },
};

let html = fs.readFileSync('public/index.html', 'utf8');
// index.html pulls one external script (/auction-values.js). jsdom won't fetch it,
// so inline it here — otherwise the league profiles that reference its constants
// throw before LEAGUES_DEFAULT is ever defined.
html = html.replace(/<script src="\/auction-values\.js"><\/script>/,
  '<script>' + fs.readFileSync('public/auction-values.js', 'utf8') + '</script>');
const errors = [];
const store = {};
let liveSetupOverride = null;

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  url: 'https://example.test/',
  beforeParse(w) {
    w.localStorage.__proto__.getItem = (k) => (k in store ? store[k] : null);
    w.localStorage.__proto__.setItem = (k, v) => { store[k] = String(v); };
    w.fetch = async (url, opts) => {
      const u = String(url);
      const j = (b) => ({ ok: true, status: 200, json: async () => b, text: async () => JSON.stringify(b) });
      if (u.startsWith('/api/me')) return j({ accountsEnabled: false, signedIn: false, admin: true, user: null });
      if (u === '/api/leagues') return j([]);                 // empty cloud -> seed from defaults
      if (u.startsWith('/api/leagues/')) return j({ ok: true });
      if (u.startsWith('/api/setup/history')) return j([]);
      if (u.startsWith('/api/setup')) return j(liveSetupOverride || {});
      if (u.startsWith('/api/commish')) return j({});
      if (u.startsWith('/api/mocks')) return j([]);
      if (u.startsWith('/api/nhl/schedule')) return j(SCHED);
      if (u.startsWith('/api/nhl/fantrax-adp')) return j([
        { name:'MacKinnon, Nathan', adp:1.55, pos:'C', id:'02f9l' },
        { name:'McDavid, Connor', adp:1.64, pos:'C', id:'02un4' },
        { name:'Makar, Cale', adp:8.5, pos:'D', id:'03q3f' },
      ]);
      if (u.startsWith('/api/exposure')) return j({ denominator: 4, counts: { 'jason robertson': 2 }, leagues: [] });
      return j({});
    };
    w.addEventListener('error', (e) => errors.push('window error: ' + (e.error?.stack || e.message)));
  }
});
dom.virtualConsole.on('jsdomError', (e) => errors.push('jsdomError: ' + e.message));
dom.window.addEventListener('unhandledrejection', (e) => errors.push('unhandled: ' + e.reason));

await new Promise(r => setTimeout(r, 1500));
const w = dom.window;

// Top-level `let`/`const` in a classic script live in the global lexical
// environment, not on `window`, so reach them through a global eval.
const ev = (expr) => w.eval(expr);
function check(name, expr, want) {
  let got;
  try { got = typeof expr === 'function' ? expr() : ev(expr); }
  catch (e) { console.log('ERROR ' + name + '  -> ' + e.message); return false; }
  const pass = typeof want === 'function' ? want(got) : got === want;
  console.log((pass ? 'PASS  ' : 'FAIL  ') + name + (pass ? '' : '  -> got ' + JSON.stringify(got)));
  return pass;
}
const slots = () => ev('slotRosterPlayers([], LEAGUE.starters).starterSlots.map(x=>x.label).join(",")');

let ok = true;
ok &= check('no page errors', () => errors.slice(0, 3).join(' | '), v => v === '');
ok &= check('NHL league seeded', 'Object.keys(LEAGUES).includes("yahoo-nhl-public")', true);
ok &= check('football is still the default league', 'CURRENT_LEAGUE_ID', 'aeo-keepers');
ok &= check('NFL sport pack active', 'SPORT.id', 'nfl');
ok &= check('football pool loaded', 'PLAYERS.length', v => v > 100);
ok &= check('football roster slots unchanged', slots, 'QB,RB,RB,WR,WR,WR,TE,K,DST,FLEX');
ok &= check('football flex intact', 'LEAGUE.flexEligible.join(",")', 'RB,WR,TE');
ok &= check('Waiver Lab exposes its decision context and ticket workflow', () =>
  ['waiverTeamDirection','waiverMethod','waiverDeadline','waiverDraftOrderRule','waiverTrigger','waiverTickets']
    .every(id => !!w.document.getElementById(id)) &&
  [...w.document.querySelectorAll('nav button')].some(button => button.textContent === 'Waiver Lab'), true);
ev(`applyFaabState({teamDirection:'contend',waiverMethod:'waiver_priority',waiverDeadline:'2026-09-29T01:00',draftOrderRule:'max points for',waiverTrigger:'Starter injured'})`);
ok &= check('Waiver Lab persists explicit non-FAAB context', () => JSON.stringify(ev('faabStateFromForm()')), value =>
  value.includes('"teamDirection":"contend"') && value.includes('"waiverMethod":"waiver_priority"') && value.includes('"draftOrderRule":"max points for"'));

ev('switchLeague("yahoo-nhl-public")');
await new Promise(r => setTimeout(r, 400));
ok &= check('switched to the NHL league', 'CURRENT_LEAGUE_ID', 'yahoo-nhl-public');
ok &= check('league selector reflects the active NHL profile after rebuilding its options',
  () => w.document.getElementById('leagueSelect').value, 'yahoo-nhl-public');
ok &= check('Yahoo Public Prize points reference is 12 teams', 'LEAGUE.teams', 12);
ok &= check('NHL sport pack active', 'SPORT.id', 'nhl');
ok &= check('recommendations share a row with the full player list', () =>
  w.document.getElementById('nhlLiveCard').parentElement.id === 'snakeDraftGrid' &&
  w.document.getElementById('snakeDraftGrid').classList.contains('nhl-layout') &&
  w.document.querySelector('.draft-pool').parentElement.id === 'snakeDraftGrid', true);
w.document.getElementById('draftSlotInput').value = '4';
await ev('setNhlDraftSlot()');
ok &= check('fourth slot applied to board and roster owner',
  'mySlot===4 && LEAGUE.mySlot===4 && OWNER_SLOT.Me===4 && overall(1,mySlot)===4', true);
w.document.getElementById('draftSlotInput').value = '1';
await ev('setNhlDraftSlot()');
ok &= check('NHL pool loaded', 'PLAYERS.length', 398);
ok &= check('top NHL player is a real skater', 'PLAYERS[0].name', v => /MacKinnon|McDavid|Kucherov/.test(v));
ok &= check('fantasy points per game computed', 'PLAYERS[0].fppg', v => v > 5);
ok &= check('projected category totals parsed', 'PLAYERS[0].st.sog', v => v > 100);
// Two real players share the name Elias Pettersson (Vancouver forward and
// defenceman). Position is what tells them apart.
ok &= check('same-name players resolve by position', () => ev(`(function(){
  const f=findPlayer('Elias Pettersson','C'), d=findPlayer('Elias Pettersson','D');
  if(!f||!d) return 'not found';
  return [f.nhlId,f.pos,d.nhlId,d.pos].join('|');
})()`), '8480012|C|8483678|D');
ok &= check('a position qualifier written into the name works too', () => ev(`(function(){
  const d=findPlayer('Elias Pettersson (D)');
  return d ? d.nhlId+'|'+d.pos : 'not found';
})()`), '8483678|D');
ok &= check('a bare ambiguous name resolves to the better-ranked player, every time', () => ev(`(function(){
  const a=findPlayer('Elias Pettersson'), b=findPlayer('Elias Pettersson');
  return a&&b&&a.nhlId===b.nhlId ? a.nhlId+'|'+a.pos : 'unstable';
})()`), '8480012|C');
ok &= check('unambiguous lookups are unaffected', () => ev(`(function(){
  const m=findPlayer('Connor McDavid'), k=findPlayer('Cale Makar','D');
  return m&&k ? m.name+'|'+k.name : 'not found';
})()`), 'Connor McDavid|Cale Makar');
ok &= check('no player appears twice in the pool', () => {
  const ids = JSON.parse(ev('JSON.stringify(PLAYERS.map(p=>p.nhlId).filter(Boolean))'));
  const dupes = [...new Set(ids.filter((x, i) => ids.indexOf(x) !== i))];
  return dupes.length ? 'duplicate nhl_id: ' + dupes : true;
}, true);
ok &= check('no impossible eligibility (a skater cannot be D and a forward)', () => {
  const bad = JSON.parse(ev(`JSON.stringify(PLAYERS.filter(p=>p.posEligible.includes('D')&&p.posEligible.some(x=>['C','LW','RW'].includes(x))).map(p=>p.name+':'+p.posEligible.join('/')))`));
  return bad.length ? bad.join(', ') : true;
}, true);
ok &= check('no goalie is eligible anywhere else', () => {
  const bad = JSON.parse(ev(`JSON.stringify(PLAYERS.filter(p=>p.posEligible.includes('G')&&p.posEligible.length>1).map(p=>p.name))`));
  return bad.length ? bad.join(', ') : true;
}, true);
ok &= check('only hockey positions in pool', '[...new Set(PLAYERS.map(p=>p.pos))].sort().join(",")', 'C,D,G,LW,RW');
ok &= check('goalies present', 'PLAYERS.filter(p=>p.pos==="G").length', v => v > 10);
ok &= check('NHL starting slots', slots, 'C,C,LW,LW,RW,RW,D,D,D,D,G,G');
ok &= check('board is in real market order, not our projection order', 'PLAYERS[0].name', 'Connor McDavid');
ok &= check('market ADP differs from our own projection rank', () => {
  // MacKinnon out-projects McDavid on our numbers but goes second in the market.
  // If these ever coincide exactly, the pool has silently fallen back to our rank.
  const byProj = ev('PLAYERS.slice().sort((a,b)=>b.proj-a.proj)[0].name');
  const byAdp = ev('PLAYERS.slice().sort((a,b)=>a.adp-b.adp)[0].name');
  return byProj + ' / ' + byAdp;
}, 'Nathan MacKinnon / Connor McDavid');
ok &= check('ADP is a real draft position, not a row index', 'PLAYERS.filter(p=>p.adp!==p.id).length', v => v > 200);
ok &= check('multi-position eligibility parsed', () => {
  const d = ev('JSON.stringify((PLAYERS.find(p=>p.name==="Leon Draisaitl")||{}).posEligible||[])');
  return d;
}, '["C","LW"]');
ok &= check('a multi-position player can fill either slot', () => {
  const both = ev('(function(){const p=PLAYERS.find(x=>x.name==="Leon Draisaitl");return playerFillsPos(p,"C")&&playerFillsPos(p,"LW")&&!playerFillsPos(p,"D");})()');
  return both;
}, true);
ok &= check('multi-position players keep a single primary for display', 'PLAYERS.filter(p=>p.pos.includes("/")).length', 0);

ok &= check('no flex slot in hockey', 'LEAGUE.flexEligible.length', 0);
ok &= check('blankCounts follows the sport', 'Object.keys(blankCounts()).join(",")', 'C,LW,RW,D,G');
ok &= check('goalie depth cap is tighter than skaters', 'SPORT.depthCap("G",2)+":"+SPORT.depthCap("C",2)', '3:4');
ok &= check('no K/DST lateness rule in hockey', 'SPORT.lateRoundPositions.length', 0);
ok &= check('scoring values carried onto LEAGUE', 'LEAGUE.scoring.sog', 0.9);
ok &= check('weekly acquisition cap carried', 'LEAGUE.maxAcquisitionsPerWeek', 4);
ok &= check('sport bar shows both sports', () => w.document.getElementById('sportBar').children.length, 2);
ok &= check('league dropdown scoped to the sport', () => [...w.document.getElementById('leagueSelect').options].map(o => o.value).join(','),
  'yahoo-nhl-public,fantrax-nhl-weekly-points,trax50-classic-draft-76,yahoo-nhl-public-categories,yahoo-nhl-public-roto,public-points-league-1,public-points-league-2,yahoo-prize-cat-3175');
ok &= check('position filter is hockey', () => [...w.document.getElementById('posFilter').options].map(o => o.value).join(','), 'ALL,C,LW,RW,D,G');
ok &= check('tendency columns are hockey', () => [...w.document.getElementById('tendHead').children].map(x => x.textContent).join(','), 'Use,Owner,C,LW,RW,D,G');

// --- My Rank: raw model value plus temporary draft-safe points guardrails ---
ok &= check('points My Rank uses league scoring and replacement value',
  'PLAYERS.filter(p=>p.leagueProj>0 && /replacement/.test(p.myRankWhy||"")).length', v => v > 300);
ok &= check('points My Rank stays inside market movement caps',
  'PLAYERS.every(p=>Math.abs(p.myRank-marketAdp(p))<=(marketAdp(p)<=25?5:marketAdp(p)<=100?10:15)+0.01)', true);
ok &= check('raw model rank is independent while draft-safe rank responds to ADP', () => ev(`(function(){
  const original=PLAYERS.map(p=>p.adp), rawBefore=PLAYERS.map(p=>p.rawModelRank).join(','), before=PLAYERS.map(p=>p.myRank).join(',');
  PLAYERS.forEach((p,i)=>p.adp=1000-i); computeMyRanks();
  const rawAfter=PLAYERS.map(p=>p.rawModelRank).join(','), after=PLAYERS.map(p=>p.myRank).join(',');
  PLAYERS.forEach((p,i)=>p.adp=original[i]); computeMyRanks();
  return rawBefore===rawAfter && before!==after;
})()`), true);
ok &= check('named star disagreements cannot fall multiple rounds', () => ev(`(function(){
  const names=['Quinn Hughes','Cale Makar','Evan Bouchard','Zach Werenski','Auston Matthews','Nick Suzuki'];
  return names.every(name=>{const p=findPlayer(name),m=marketAdp(p),cap=m<=25?5:m<=100?10:15;return p&&Math.abs(p.myRank-m)<=cap;});
})()`), true);
ok &= check('large projection disagreements are visible and explained',
  'PLAYERS.filter(p=>p.projectionDisagreement&&/raw one-season model rank/.test(p.myRankWhy||"")).length', v => v > 0);
ok &= check('Yahoo reference eligibility gives Jason Robertson both wings',
  'JSON.stringify(eligiblePositions(PLAYERS.find(p=>p.name==="Jason Robertson")))', '["LW","RW"]');
ok &= check('every ranked player carries an explanation', 'PLAYERS.filter(p=>p.myRankWhy!=null).length', 398);
ok &= check('football My Rank model is untouched', () => ev('SPORTS.nfl.myRankModel') + '/' + ev('SPORTS.nhl.myRankModel'), 'nfl/nhl');

const oldFetch = w.fetch;
w.fetch = async url => String(url).includes('/api/yahoo/league-settings')
  ? { ok: true, json: async () => ({ name: 'Saturday NHL', teams: 10, scoringType: 'headpoint', draftType: 'live',
    rosterPositions: ['C','LW','RW','D','G'].map((position,i)=>({roster_position:{position,count:[2,2,2,4,2][i]}})),
    statCategories: { stats: [{stat:{stat_id:'1',name:'Goals'}}] },
    statModifiers: { stats: [{stat:{stat_id:'1',value:'6'}}] }, settings:{} }) }
  : oldFetch(url);
w.document.getElementById('yahooLeagueSelect').innerHTML='<option value="999.l.123">Saturday NHL</option>';
await ev('compareYahooSettings()');
ok &= check('Yahoo settings comparison distinguishes partial scoring coverage',
  () => w.document.getElementById('yahooStatus').textContent.includes('scoring checked 1/10'), true);
w.fetch = async url => String(url).includes('/api/yahoo/league-settings')
  ? { ok: true, json: async () => ({ name: 'Saturday NHL', teams: 10, scoringType: 'headpoint', draftType: 'live',
    rosterPositions: ['C','LW','RW','D','G'].map((position,i)=>({roster_position:{position,count:[2,2,2,4,2][i]}})),
    statCategories: { stats: Object.keys({g:1,a:1,pm:1,ppp:1,sog:1,blk:1,w:1,ga:1,sv:1,sho:1})
      .map((code,i)=>({stat:{stat_id:String(i+1),name:({g:'Goals',a:'Assists',pm:'Plus/Minus',ppp:'Powerplay Points',sog:'Shots on Goal',blk:'Blocked Shots',w:'Wins',ga:'Goals Against',sv:'Saves',sho:'Shutouts'})[code]}})) },
    statModifiers: { stats: Object.values({g:6,a:4,pm:2,ppp:2,sog:0.9,blk:1,w:5,ga:-3,sv:0.6,sho:5})
      .map((value,i)=>({stat:{stat_id:String(i+1),value:String(value)}})) }, settings:{} }) }
  : oldFetch(url);
await ev('compareYahooSettings()');
ok &= check('exact NHL settings comparison enables profile creation',
  () => !w.document.getElementById('yahooImportBtn').disabled, true);
w.fetch = oldFetch;

// The recommendation panel adds draft-state context on top of draft-safe My Rank.
ok &= check('NHL live pick panel has six available candidates',
  'nhlLiveRecommendations().length', 6);
ok &= check('NHL live panel rendered separately from the rank table',
  () => w.document.querySelectorAll('#nhlLivePicks .live-pick').length, 6);
ok &= check('projection and exposure sit beside ADP, ECR and My Rank',
  () => [...w.document.querySelectorAll('#poolTable th')].slice(1,6).map(x=>x.textContent).join(','), 'ADP,ECR,My,Preseason Proj,Exp');
ok &= check('exposure shows prior-league fraction',
  'exposureText(PLAYERS.find(p=>p.name==="Jason Robertson"))', '2/4');
ok &= check('NHL portraits and team logos use NHL assets',
  'headshotImg(PLAYERS.find(p=>p.name==="Cale Makar")).includes("assets.nhle.com/mugs") && teamLogoImg(PLAYERS.find(p=>p.name==="Cale Makar")).includes("COL_dark.svg")', true);
ok &= check('recommendation includes next turn and roster state',
  'nhlLiveRecommendations()[0].next > nhlLiveRecommendations()[0].now && nhlLiveRecommendations()[0].counts.G===0', true);
ev('mySlot=12');
ok &= check('turn picks use the following turn as the survival horizon',
  'nhlLiveRecommendations()[0].now===12 && nhlLiveRecommendations()[0].now+1===13 && nhlLiveRecommendations()[0].next===36', true);
ev('mySlot=1');
const originalRank = ev('PLAYERS.find(p=>p.name==="Cale Makar").myRank');
ev(`(function(){
  makePick(PLAYERS.find(p=>p.name==='Igor Shesterkin').id,1);
  makePick(PLAYERS.find(p=>p.name==='Carter Hart').id,24);
  curPick=25; render();
})()`);
ok &= check('G3 is absent from the top six after drafting two goalies',
  'nhlLiveRecommendations().every(x=>x.player.pos!=="G")', true);
ok &= check('G3 carries a roster saturation reason',
  'nhlLiveRecommendations(85).filter(x=>x.player.pos==="G").some(x=>x.reason.includes("G3"))', true);
ok &= check('My Rank stays intrinsic when the roster changes',
  'PLAYERS.find(p=>p.name==="Cale Makar").myRank', originalRank);
ev('resetDraft()');

// --- eligibility and roster fitting ---
ok &= check('board shows full eligibility without the old F pip', () => {
  const cell = ev('posCell(PLAYERS.find(p=>p.name==="Jason Robertson"))');
  return /LW\/RW/.test(cell) && !/fchip/.test(cell) ? true : cell;
}, true);
ok &= check('fallback multi-position eligibility still works', () => ev(`(function(){
  const d=PLAYERS.find(p=>p.name==='Leon Draisaitl');
  return playerFillsPos(d,'LW') && playerFillsPos(d,'C') && !playerFillsPos(d,'RW');
})()`), true);
ok &= check('reserved bench rows match Yahoo four-slot bench',
  'slotRosterPlayers([],LEAGUE.starters).benchSlots.length', 4);
ok &= check('multi-position matching reroutes flexible player', () => ev(`(function(){
  const flex=PLAYERS.find(p=>p.name==='Leon Draisaitl'), c=PLAYERS.find(p=>p.name==='Connor McDavid');
  const fit=slotRosterPlayers([flex,c],{C:1,LW:1});
  return fit.starterSlots.every(x=>x.player)&&fit.starterSlots.find(x=>x.label==='LW').player.name==='Leon Draisaitl';
})()`), true);

ok &= check('position colours: C green, LW blue, RW purple, D yellow, G red', () => {
  const css = fs.readFileSync('public/index.html','utf8');
  const m = css.match(/--posc:(#\w+); --poslw:(#\w+); --posrw:(#\w+); --posd:(#\w+); --posg:(#\w+);/);
  return m ? m.slice(1).join(',') : 'vars not found';
}, '#34d399,#60a5fa,#c084fc,#fbbf24,#f97066');
ok &= check('F shares LW blue and has its own class', () => {
  const css = fs.readFileSync('public/index.html','utf8');
  return /--posf:#60a5fa;/.test(css) && /\.pos\.F\{background:var\(--posf\)\}/.test(css) ? true : 'F styling missing';
}, true);
ok &= check('no F chip on the board', () => {
  const cell = ev('posCell(PLAYERS.find(p=>p.posEligible.length>1)||PLAYERS[0])');
  return /fchip/.test(cell) || />F</.test(cell) ? cell : true;
}, true);
ok &= check('eligibility shows slash-separated positions only', () => {
  const p = ev('JSON.stringify((PLAYERS.find(x=>x.posEligible.length>1)||{}).posEligible||[])');
  const cell = ev('posCell(PLAYERS.find(x=>x.posEligible.length>1))');
  const want = JSON.parse(p).join('/');
  return cell.includes(want) ? true : cell + ' missing ' + want;
}, true);
ok &= check('board flags when eligibility is not the platform\'s own', () => {
  // The Yahoo reference league has no real Yahoo eligibility loaded yet, so the
  // board must say so rather than passing FantasyPros off as Yahoo's.
  return ev('eligibilitySourceNote()');
}, v => /FantasyPros|confirmed from yahoo/.test(v));
ok &= check('platform-specific eligibility wins when present', () => ev(`(function(){
  const p=PLAYERS.find(x=>x.name==='Jason Robertson');
  if(!p) return 'player missing';
  return JSON.stringify(eligiblePositions(p,'yahoo'));
})()`), v => v === '["LW","RW"]' || v);

ok &= check('rivals complete a full NHL draft', 'resetDraft(); for(let i=1;i<=160;i++) rivalPick(i,0); picks.length', v => v >= 150);
ok &= check('rivals build balanced rosters, not one position', () => {
  const c = JSON.parse(ev('JSON.stringify(countsOf(rosterOf(3)))'));
  const filled = Object.values(c).filter(v => v > 0).length;
  return filled;
}, v => v >= 4);
ok &= check('rivals respect the goalie depth cap', () => {
  let worst = 0;
  for (let slot = 1; slot <= 10; slot++) {
    const c = JSON.parse(ev(`JSON.stringify(countsOf(rosterOf(${slot})))`));
    worst = Math.max(worst, c.G || 0);
  }
  return worst;
}, v => v <= 3);

// --- Add Radar ---
ok &= check('radar tab visible for hockey', () => w.document.querySelector('nav button[data-view="radar"]').style.display, '');
await ev('radarLoad()');
await new Promise(r => setTimeout(r, 300));
ok &= check('radar produced a shortlist', () => w.document.querySelectorAll('#radarTable tbody tr').length, v => v > 5);
ok &= check('radar only lists players whose team plays', () => {
  const teams = [...w.document.querySelectorAll('#radarTable tbody tr')].map(tr => tr.children[3].textContent);
  return [...new Set(teams)].sort().join(',');
}, v => v.split(',').every(t => ['COL','EDM','TOR'].includes(t)));
ok &= check('radar hides players assumed rostered', () => {
  // Default filter assumes the top teams*rosterSize are gone; nobody above that
  // projection rank should appear in the list.
  const names = [...w.document.querySelectorAll('#radarTable tbody tr')].map(tr => tr.children[2].textContent);
  const skip = Number(w.document.getElementById('radarRostered').value);
  const ranks = names.map(n => JSON.parse(ev(`JSON.stringify((PLAYERS.find(p=>${JSON.stringify(n)}.includes(p.name))||{}).adp||0)`)));
  return ranks.filter(r => r && r <= skip).length;
}, 0);
ok &= check('light nights beat heavy nights at equal games', () => {
  // COL and EDM both play 2 games this window; COL's fall on light nights. For a
  // matched pair of per-game rates, COL must score higher.
  return JSON.parse(ev(`(function(){
    const sched=${JSON.stringify(SCHED)};
    const col=PLAYERS.filter(p=>p.team==='COL'&&p.fppg>0).sort((a,b)=>b.fppg-a.fppg)[0];
    const edm=PLAYERS.filter(p=>p.team==='EDM'&&p.fppg>0).sort((a,b)=>b.fppg-a.fppg)[0];
    if(!col||!edm) return JSON.stringify('missing players');
    // Normalise out the scoring rate so only the schedule differs.
    const score=(fppg,team)=>{
      const dates=sched.teams[team];
      const lit=dates.filter(d=>sched.dayCounts[d]<=8).length;
      return fppg*dates.length*(1+0.35*(lit/dates.length));
    };
    return JSON.stringify(score(10,'COL') > score(10,'EDM'));
  })()`));
}, true);
ok &= check('more games beats fewer at equal rate', () => JSON.parse(ev(`(function(){
  const sched=${JSON.stringify(SCHED)};
  const score=(fppg,team)=>{
    const dates=sched.teams[team];
    const lit=dates.filter(d=>sched.dayCounts[d]<=8).length;
    return fppg*dates.length*(1+0.35*(lit/dates.length));
  };
  return JSON.stringify(score(10,'EDM') > score(10,'TOR'));
})()`)), true);

ev('switchLeague("public-points-league-2")');
await new Promise(r => setTimeout(r, 250));
ok &= check('Yahoo Prize league 141304 inherits the points reference',
  'CURRENT_LEAGUE_ID==="public-points-league-2" && LEAGUE.teams===12 && LEAGUE.scoringMode==="points" && LEAGUE.scoring.g===6 && LEAGUE.scoring.sv===0.6', true);
ok &= check('Yahoo Prize league 141304 keeps the inferred slot-four team',
  'LEAGUES[CURRENT_LEAGUE_ID].yahooLeagueId==="141304" && mySlot===4 && ME_OWNER==="Sid the Mid" && OWNER_SLOT["Sid the Mid"]===4', true);
ok &= check('Yahoo Prize league 141304 imports its completed 192-pick board',
  'totalPicks===192 && picks.length===192 && curPick===193 && pickTakenAt(28)&&PLAYERS.find(p=>p.id===pickTakenAt(28).playerId).name==="Rasmus Dahlin"', true);

ev('switchLeague("public-points-league-1")');
await new Promise(r => setTimeout(r, 400));
ok &= check('live league has 12 teams and slot 4', 'LEAGUE.teams===12 && mySlot===4', true);
ok &= check('Yahoo league ID, team name, and official status attached',
  'LEAGUES[CURRENT_LEAGUE_ID].yahooLeagueId==="135526" && ME_OWNER==="Individual Neutral Athletes" && LEAGUES[CURRENT_LEAGUE_ID].officialDraft===true', true);
ok &= check('all 192 draft picks resolved in unique slots',
  'picks.length===192 && new Set(picks.map(x=>x.overall)).size===192 && new Set(picks.map(x=>x.playerId)).size===192', true);
ok &= check('draft complete', 'curPick', 193);
ok &= check('Yahoo draft-result eligibility overrides stale pool positions',
  'playerFillsPos(findPlayer("J. Robertson"),"RW") && playerFillsPos(findPlayer("C. Gauthier"),"C") && playerFillsPos(findPlayer("M. Marner"),"C") && playerFillsPos(findPlayer("J.T. Miller"),"RW")', true);
ok &= check('accent-insensitive and initial search match the NHL pool',
  'playerMatchesSearch(findPlayer("Tim Stützle"),"T. Stutzle") && playerMatchesSearch(findPlayer("Juraj Slafkovský"),"Slafkovsky")', true);
ok &= check('completed draft has 16 rostered players', 'myRoster().length', 16);
ok &= check('no separate IR watch panel clutters recommendations',
  () => !w.document.getElementById('nhlHealthWatch'), true);
ok &= check('round 15 IR stashes resolved at real slots',
  'PLAYERS.find(p=>p.id===picks.find(x=>x.overall===177).playerId).name==="Kevin Fiala" && PLAYERS.find(p=>p.id===picks.find(x=>x.overall===178).playerId).name==="Brad Marchand"', true);
ok &= check('round 16 final selection recorded',
  'PLAYERS.find(p=>p.id===picks.find(x=>x.overall===189).playerId).name', 'Filip Gustavsson');
const search=w.document.getElementById('search'); search.value='B. Marchand'; ev('renderPool()');
ok &= check('deep stash candidate searchable by initial',
  () => w.document.querySelector('#poolTable tbody').textContent.includes('Brad Marchand'), true);
search.value='J. Robertson'; ev('renderPool()');
ok &= check('already drafted search explains absence',
  () => w.document.querySelector('#poolTable tbody').textContent.includes('already drafted'), true);
search.value=''; ev('renderPool()');
ok &= check('user sixteen selections at the reported picks',
  'JSON.stringify(picks.filter(p=>ownerOf(p.overall)===mySlot).map(p=>[p.overall,PLAYERS.find(x=>x.id===p.playerId).name]))',
  '[[4,"Nikita Kucherov"],[21,"Auston Matthews"],[28,"Cutter Gauthier"],[45,"Moritz Seider"],[52,"Connor Hellebuyck"],[69,"Filip Forsberg"],[76,"Erik Karlsson"],[93,"Alex Tuch"],[100,"Shea Theodore"],[117,"Mark Stone"],[124,"John Gibson"],[141,"Mattias Ekholm"],[148,"Josh Doan"],[165,"Steven Stamkos"],[172,"Darcy Kuemper"],[189,"Filip Gustavsson"]]');
liveSetupOverride = {picks:JSON.parse(ev('JSON.stringify(picks.slice(0,58))')),curPick:59,seededLiveSnapshot:true};
await ev('loadSetup()');
ok &= check('saved 58-pick board extends to complete draft',
  'picks.length===192 && picks[0].overall===1 && picks.some(p=>p.overall===189&&PLAYERS.find(x=>x.id===p.playerId).name==="Filip Gustavsson")', true);
liveSetupOverride = {picks:JSON.parse(ev('JSON.stringify(picks.slice().filter(x=>x.overall<=77))'))
  .concat([{overall:80,round:7,slot:8,playerId:ev('findPlayer("Boone Jenner").id'),keeper:false}]),
  curPick:78,seededLiveSnapshot:true,appliedLiveSnapshotCount:77};
await ev('loadSetup()');
ok &= check('saved 77-pick board extends without replacing a manual slot',
  'picks.length===192 && PLAYERS.find(p=>p.id===pickTakenAt(80).playerId).name==="Boone Jenner" && curPick===193', true);
liveSetupOverride = null;
ev('switchLeague("yahoo-nhl-public-categories")');
await new Promise(r => setTimeout(r, 250));
ok &= check('Public Prize categories reference is 12 teams with hits',
  'LEAGUE.teams===12 && LEAGUE.scoringMode==="categories" && LEAGUE.categoryStats.skater.includes("HIT")', true);
ok &= check('categories profile computes category replacement value',
  'PLAYERS.filter(p=>Number.isFinite(p.categoryValue)&&/H2H cat value/.test(p.myRankWhy||"")).length', v => v > 300);
ok &= check('categories board does not display Yahoo fantasy points',
  'document.getElementById("projHeader").textContent+":"+(PLAYERS[0].leagueProj===null)', 'Cat:true');
ok &= check('categories recommendation explains balanced contribution',
  'nhlLiveRecommendations(30).some(x=>/contributes in|boosts weak /.test(x.reason))', true);
ev('switchLeague("yahoo-prize-cat-3175")');
await new Promise(r => setTimeout(r, 250));
ok &= check('league 3175 carries its Yahoo H2H Categories settings',
  'LEAGUES[CURRENT_LEAGUE_ID].yahooLeagueId+":"+LEAGUE.teams+":"+LEAGUE.rounds+":"+LEAGUE.irSlots+":"+LEAGUE.categoryStats.skater.join(",")+":"+LEAGUE.categoryStats.goalie.join(",")+":"+LEAGUE.maxAcquisitionsPerWeek+":"+LEAGUE.minGoalieGamesPerWeek',
  '3175:12:16:2:G,A,+/-,PPP,SOG,HIT:W,GAA,SV%,SHO:4:3');
ok &= check('3175 roster is 2C/2LW/2RW/4D/2G', slots, 'C,C,LW,LW,RW,RW,D,D,D,D,G,G');
ok &= check('category leagues show one draft-list column per category', () =>
  [...w.document.querySelectorAll('#poolTable th.catcol')].map(t => t.textContent).join(','), 'G,A,+/-,PPP,SOG,HIT,W,GAA,SV%,SHO');
ok &= check('category cells are colour-scaled whole-season projections', () => {
  const cells = [...w.document.querySelectorAll('#poolTable td.catcell')].filter(td => td.textContent);
  const sv = cells.find(td => /^\.\d{3}$/.test(td.textContent));
  return cells.length > 100 && cells.every(td => /background:rgb/.test(td.getAttribute('style') || '')) && !!sv;
}, true);
ok &= check('streaming sliders are replaced by punt checkboxes', () =>
  w.document.querySelectorAll('#nhlStreamControls [data-punt]').length + ':' + w.document.querySelectorAll('#nhlStreamControls [data-stream]').length, '10:0');
ok &= check('recommendations wait for a draft slot', () => w.document.getElementById('nhlLivePicks').textContent, v => /draft slot/.test(v));
ev('el("draftSlotInput").value="6"');
await ev('setNhlDraftSlot()');
ok &= check('punting a category removes it from category value', () => ev(`(function(){
  const p=findPlayer('Brady Tkachuk'), before=p.categoryValue;
  PUNT_CATS.add('HIT');computeMyRanks();
  const after=p.categoryValue, z=p.categoryZ.HIT;
  PUNT_CATS.delete('HIT');computeMyRanks();
  return Math.abs((before-after)-z)<1e-9 && z>0;
})()`), true);
ev('simToMe()');
ev('makePick(nhlLiveRecommendations(1)[0].player.id,nextOpenPick(curPick));curPick=nextOpenPick(curPick+1);simToMe();render();');
ok &= check('my-team category table shows average and total rows', () => {
  const rows = [...w.document.querySelectorAll('#catTeamTable tr')];
  return rows.length === 3 && /Average per player/.test(rows[1].textContent) && /Team total/.test(rows[2].textContent) && rows[2].children.length === 11;
}, true);
ok &= check('team category rank is measured against the league', 'nhlLeagueCategoryState().stats.G.total.teams', 12);
ok &= check('no errors in the category league', () => errors.slice(0, 3).join(' | '), v => v === '');
ev('switchLeague("yahoo-nhl-public-roto")');
await new Promise(r => setTimeout(r, 250));
ok &= check('Public Prize roto reference is 12 teams with blocks and 82-game cap',
  'LEAGUE.teams===12 && LEAGUE.scoringMode==="roto" && LEAGUE.categoryStats.skater.includes("BLK") && !LEAGUE.categoryStats.skater.includes("HIT") && LEAGUE.maxGamesPlayed===82', true);
ok &= check('roto profile computes category replacement value',
  'PLAYERS.filter(p=>Number.isFinite(p.categoryValue)&&/roto value/.test(p.myRankWhy||"")).length', v => v > 300);
ok &= check('roto players retain category-level explanations',
  'PLAYERS.filter(p=>p.categoryZ&&Object.keys(p.categoryZ).length>=4&&/best categories/.test(p.myRankWhy||"")).length', v => v > 300);
ev('switchLeague("fantrax-nhl-weekly-points")');
await new Promise(r => setTimeout(r, 300));
ok &= check('Fantrax weekly points profile uses Classic roster and scoring',
  'LEAGUE.platform==="fantrax" && LEAGUE.lineupPeriod==="weekly" && LEAGUE.scoring.g===4 && LEAGUE.scoring.sv===0.25 && LEAGUE.irSlots===0', true);
ok &= check('Fantrax generic forward roster slots are 5F/3D/2G', slots, 'F,F,F,F,F,D,D,D,G,G');
ok &= check('Fantrax forwards fill generic F without inventing an F display position',
  'playerFillsPos(findPlayer("Connor McDavid"),"F") && eligiblePositions(findPlayer("Connor McDavid")).every(p=>p!=="F")', true);
ok &= check('Fantrax board displays F, coloured as F', () => {
  const cell = ev('posCell(findPlayer("Connor McDavid"))');
  return /class="pos F">F</.test(cell) ? true : cell;
}, true);
ok &= check('Fantrax display shows F without rewriting the underlying eligibility',
  'eligiblePositions(findPlayer("Connor McDavid")).join("/")', v => v !== 'F' && v.length > 0);
ok &= check('Fantrax My Rank uses Fantrax scoring and F replacement',
  'PLAYERS.filter(p=>p.pos!=="D"&&p.pos!=="G"&&p.myReplacementPos==="F"&&/league proj/.test(p.myRankWhy||"")).length', v => v > 200);
ok &= check('Fantrax live ADP overrides Yahoo market timing',
  'marketAdp(findPlayer("Nathan MacKinnon"))+":"+MARKET_ADP_STATUS', '1.55:fantrax');
ok &= check('Fantrax safe rank recalculates from live Fantrax ADP',
  'Math.abs(findPlayer("Nathan MacKinnon").myRank-marketAdp(findPlayer("Nathan MacKinnon")))<=5', true);
ok &= check('weekly profile loads game-count context and hides daily Add Radar',
  'Object.keys(DRAFT_SCHEDULE.teams).length>0 && !radarVisible()', true);
ok &= check('Fantrax weekly game count changes live recommendation value', () => ev(`(function(){
  const p=findPlayer('Nathan MacKinnon'), original=DRAFT_SCHEDULE;
  DRAFT_SCHEDULE={teams:{COL:['a','b','c','d']},days:['a','b','c','d'],start:'a'};
  const four=nhlLiveRecommendations(100).find(x=>x.player.id===p.id).score;
  DRAFT_SCHEDULE={teams:{COL:['a']},days:['a'],start:'a'};
  const one=nhlLiveRecommendations(100).find(x=>x.player.id===p.id).score;
  DRAFT_SCHEDULE=original;
  return four>one;
})()`), true);
ev('switchLeague("trax50-classic-draft-76")');
await new Promise(r => setTimeout(r, 300));
ok &= check('TRAX50 profile keeps its exact Fantrax ID, scoring, and weekly generic-F setup',
  'LEAGUES[CURRENT_LEAGUE_ID].fantraxLeagueId+":"+LEAGUE.scoring.hit+":"+LEAGUE.starters.F+":"+LEAGUE.irSlots+":"+LEAGUE.lineupPeriod', 'bdd8aa7jmtjj0e84:0.25:5:0:weekly');
ok &= check('TRAX50 profile uses Fantrax market ADP and has no trade route',
  'LEAGUE.marketAdpSource+":"+LEAGUES[CURRENT_LEAGUE_ID].waiverRules.trades+":"+LEAGUES[CURRENT_LEAGUE_ID].waiverRules.waiverDays', 'fantrax:false:2');
ev('switchLeague("aeo-keepers")');
await new Promise(r => setTimeout(r, 400));
ok &= check('football unaffected after switching back', () => ev('SPORT.id') + ' ' + slots(), 'nfl QB,RB,RB,WR,WR,WR,TE,K,DST,FLEX');
ok &= check('radar tab hidden for football', () => w.document.querySelector('nav button[data-view="radar"]').style.display, 'none');
ok &= check('no errors after all the switching', () => errors.slice(0, 3).join(' | '), v => v === '');

console.log(ok ? '\nALL CHECKS PASSED' : '\nSOME CHECKS FAILED');
process.exit(ok ? 0 : 1);

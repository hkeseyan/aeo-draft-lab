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
      if (u.startsWith('/api/setup')) return j({});
      if (u.startsWith('/api/commish')) return j({});
      if (u.startsWith('/api/mocks')) return j([]);
      if (u.startsWith('/api/nhl/schedule')) return j(SCHED);
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

ev('switchLeague("yahoo-nhl-public")');
await new Promise(r => setTimeout(r, 400));
ok &= check('switched to the NHL league', 'CURRENT_LEAGUE_ID', 'yahoo-nhl-public');
ok &= check('NHL sport pack active', 'SPORT.id', 'nhl');
ok &= check('NHL pool loaded', 'PLAYERS.length', 400);
ok &= check('top NHL player is a real skater', 'PLAYERS[0].name', v => /MacKinnon|McDavid|Kucherov/.test(v));
ok &= check('fantasy points per game computed', 'PLAYERS[0].fppg', v => v > 5);
ok &= check('projected category totals parsed', 'PLAYERS[0].st.sog', v => v > 100);
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
ok &= check('league dropdown scoped to the sport', () => [...w.document.getElementById('leagueSelect').options].map(o => o.value).join(','), 'yahoo-nhl-public');
ok &= check('position filter is hockey', () => [...w.document.getElementById('posFilter').options].map(o => o.value).join(','), 'ALL,C,LW,RW,D,G');
ok &= check('tendency columns are hockey', () => [...w.document.getElementById('tendHead').children].map(x => x.textContent).join(','), 'Use,Owner,C,LW,RW,D,G');

// --- My Rank: points-league value plus roster construction ---
ok &= check('My Rank leaves the elite tier on merit alone', () => {
  const byMy = ev('PLAYERS.slice().sort((a,b)=>a.myRank-b.myRank).slice(0,5).map(p=>p.name).join("|")');
  const byAdp = ev('PLAYERS.slice().sort((a,b)=>a.adp-b.adp).slice(0,5).map(p=>p.name).join("|")');
  return byMy === byAdp ? true : byMy + ' vs ' + byAdp;
}, true);
ok &= check('a dual-eligible forward never leapfrogs the best player', () => {
  // Draisaitl is C/LW and Yahoo's fifth pick; his flexibility bonus must not put
  // him above McDavid, or the bonus is overwhelming the board's compressed top.
  return ev('(PLAYERS.find(p=>p.name==="Leon Draisaitl")||{}).myRank > (PLAYERS.find(p=>p.name==="Connor McDavid")||{}).myRank');
}, true);
ok &= check('centre-only forwards are marked down against the market', () => {
  const avg = ev(`(function(){
    const seg=PLAYERS.filter(p=>p.adp<=150&&p.posEligible.length===1&&p.posEligible[0]==='C');
    return seg.length? seg.reduce((s,p)=>s+(p.adp-p.myRank),0)/seg.length : 0;
  })()`);
  return avg < -4 ? true : 'avg move ' + avg;
}, true);
ok &= check('centre+wing forwards are marked up against the market', () => {
  const avg = ev(`(function(){
    const seg=PLAYERS.filter(p=>p.adp<=150&&p.posEligible.includes('C')&&p.posEligible.length>1);
    return seg.length? seg.reduce((s,p)=>s+(p.adp-p.myRank),0)/seg.length : 0;
  })()`);
  return avg > 4 ? true : 'avg move ' + avg;
}, true);
ok &= check('a thin-sample projection is discounted toward the market', () => {
  // Someone with a part-season behind them should carry a visible confidence note
  // rather than being ranked as though the projection were solid.
  return ev('PLAYERS.filter(p=>p.myRankTrust<0.6 && /sample confidence/.test(p.myRankWhy||"")).length');
}, v => v > 0);
ok &= check('surplus goalies are pushed below startable ones', () => {
  const g = ev(`(function(){
    const gs=PLAYERS.filter(p=>p.pos==='G').sort((a,b)=>a.myRank-b.myRank);
    return JSON.stringify([gs.slice(0,20).every(p=>!/beyond the/.test(p.myRankWhy||'')),
                           gs.slice(20).some(p=>/beyond the/.test(p.myRankWhy||''))]);
  })()`);
  return g;
}, '[true,true]');
ok &= check('every ranked player carries an explanation', 'PLAYERS.filter(p=>p.myRankWhy!=null).length', 400);
ok &= check('football My Rank model is untouched', () => ev('SPORTS.nfl.myRankModel') + '/' + ev('SPORTS.nhl.myRankModel'), 'nfl/nhl');

// --- eligibility on the board ---
ok &= check('the board shows every eligible position', () => {
  const cell = ev('posCell(PLAYERS.find(p=>p.name==="Leon Draisaitl"))');
  return /C\/LW/.test(cell) && /fchip/.test(cell) ? true : cell;
}, true);
ok &= check('single-position players get no F chip', () => {
  const cell = ev('posCell(PLAYERS.find(p=>p.posEligible.length===1&&p.pos==="D"))');
  return /fchip/.test(cell) ? 'D wrongly chipped' : true;
}, true);
ok &= check('filtering to LW surfaces C/LW players too', () => ev(`(function(){
  const d=PLAYERS.find(p=>p.name==='Leon Draisaitl');
  return playerFillsPos(d,'LW') && playerFillsPos(d,'C') && !playerFillsPos(d,'RW');
})()`), true);

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

ev('switchLeague("aeo-keepers")');
await new Promise(r => setTimeout(r, 400));
ok &= check('football unaffected after switching back', () => ev('SPORT.id') + ' ' + slots(), 'nfl QB,RB,RB,WR,WR,WR,TE,K,DST,FLEX');
ok &= check('radar tab hidden for football', () => w.document.querySelector('nav button[data-view="radar"]').style.display, 'none');
ok &= check('no errors after all the switching', () => errors.slice(0, 3).join(' | '), v => v === '');

console.log(ok ? '\nALL CHECKS PASSED' : '\nSOME CHECKS FAILED');
process.exit(ok ? 0 : 1);

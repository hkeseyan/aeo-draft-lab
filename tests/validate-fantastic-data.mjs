import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const auctionValuesSource=fs.readFileSync(new URL('../public/auction-values.js',import.meta.url),'utf8');
const expression=(start,end)=>source.slice(source.indexOf(start)+start.length,source.indexOf(end,source.indexOf(start)+start.length)).trim();
const strategy=Function(`return (${expression('const FANTASTIC_2026_STRATEGY=',';\n\n// ---------- LEAGUE PROFILES')})`)();
const rosterText=expression('const ROSTERS_RAW_FANTASTIC = `','`;\n\nconst ROSTERS_RAW_AEOK_AUCTION');
const keeperBlock=source.match(/'fantastic-auction': \{[\s\S]*?leagueKeepers:\[([\s\S]*?)\],\n\s*myLocked:/)?.[1]||'';
const keepers=[...keeperBlock.matchAll(/"([^"]+)\|([^"]+)"/g)].map(([,manager,name])=>({manager,name}));
const playerCsv=auctionValuesSource.slice(
  auctionValuesSource.indexOf('const PLAYERS_CSV_FANTASTIC = `')+'const PLAYERS_CSV_FANTASTIC = `'.length,
  auctionValuesSource.indexOf('`;',auctionValuesSource.indexOf('const PLAYERS_CSV_FANTASTIC = `'))
);
const playerNames=new Set(playerCsv.trim().split(/\r?\n/).slice(1).map(line=>line.split(',')[0]));
const aliases={'49ers':'San Francisco 49ers','Broncos':'Denver Broncos','Chargers':'Los Angeles Chargers','Eagles':'Philadelphia Eagles','Rams':'Los Angeles Rams','Ravens':'Baltimore Ravens','Seahawks':'Seattle Seahawks','Texans':'Houston Texans','Vikings':'Minnesota Vikings'};
const roster=new Map(rosterText.trim().split(/\r?\n/).map(line=>{
  const [manager,name,,cost]=line.split('|'); return [`${manager}|${name}`,Number(cost)];
}));

assert.equal(keepers.length,106);
assert.equal(new Set(keepers.map(k=>k.manager)).size,14);
let keeperSalary=0;
for(const {manager,name} of keepers){
  const cost=roster.get(`${manager}|${name}`);
  assert.ok(Number.isFinite(cost),`${manager} / ${name} roster cost`);
  assert.ok(playerNames.has(aliases[name]||name),`${manager} / ${name} player pool resolution`);
  keeperSalary+=cost;
}
assert.equal(keeperSalary,1454);
assert.equal(14*16-keepers.length,118);
const hovo=keepers.filter(k=>k.manager==='Hovo');
assert.equal(hovo.length,8);
assert.equal(hovo.reduce((n,k)=>n+roster.get(`${k.manager}|${k.name}`),0),111);
assert.equal(strategy.budgetAtDraft,89);
assert.equal(strategy.openRosterSpots,8);
assert.deepEqual(strategy.preferredBuild,[40,25,10,10]);

const header=playerCsv.split(/\r?\n/,1)[0].split(',');
for(const required of ['yahoo_default','yahoo_avg_salary','fp_value','sleeper_id','rookie'])assert.ok(header.includes(required),`player CSV has ${required}`);

console.log(`Fantastic data valid: ${keepers.length} keepers, $${keeperSalary} kept, ${14*16-keepers.length} open slots.`);

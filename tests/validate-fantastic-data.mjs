import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const auctionValuesSource=fs.readFileSync(new URL('../public/auction-values.js',import.meta.url),'utf8');
const expression=(start,end)=>source.slice(source.indexOf(start)+start.length,source.indexOf(end,source.indexOf(start)+start.length)).trim();
const teams=Function(`return (${expression('const FANTASTIC_FINAL_TEAMS=',';\nconst FANTASTIC_DEFAULT_ASSIGNED')})`)();
const strategy=Function(`return (${expression('const FANTASTIC_2026_STRATEGY=',';\n\n// ---------- LEAGUE PROFILES')})`)();
const rosterText=expression('const ROSTERS_RAW_FANTASTIC = `','`;\n\nconst ROSTERS_RAW_AEOK_AUCTION');
const playerCsv=auctionValuesSource.slice(
  auctionValuesSource.indexOf('const PLAYERS_CSV_FANTASTIC = `')+'const PLAYERS_CSV_FANTASTIC = `'.length,
  auctionValuesSource.indexOf('`;',auctionValuesSource.indexOf('const PLAYERS_CSV_FANTASTIC = `'))
);
const playerNames=new Set(playerCsv.trim().split(/\r?\n/).slice(1).map(line=>line.split(',')[0]));
const aliases={'49ers':'San Francisco 49ers','Broncos':'Denver Broncos','Chargers':'Los Angeles Chargers','Eagles':'Philadelphia Eagles','Rams':'Los Angeles Rams','Ravens':'Baltimore Ravens','Seahawks':'Seattle Seahawks','Texans':'Houston Texans','Vikings':'Minnesota Vikings'};
const roster=new Map(rosterText.trim().split(/\r?\n/).map(line=>{
  const [manager,name,,cost]=line.split('|'); return [`${manager}|${name}`,Number(cost)];
}));

assert.equal(teams.length,14);
assert.deepEqual(teams.map(t=>t.nominationOrder),Array.from({length:14},(_,i)=>i+1));
assert.equal(new Set(teams.map(t=>t.manager)).size,14);
assert.equal(new Set(teams.map(t=>t.teamName)).size,14);

let keepers=0, keeperSalary=0, remaining=0;
for(const team of teams){
  const sum=team.keepers.reduce((n,[,cost])=>n+cost,0);
  assert.equal(sum,team.keeperSalary,`${team.manager} keeper salary`);
  assert.equal(team.startingBudget-team.keeperSalary,team.remainingBudget,`${team.manager} remaining budget`);
  assert.ok(team.keepers.length<=16,`${team.manager} roster size`);
  assert.ok(team.remainingBudget>=16-team.keepers.length,`${team.manager} minimum-slot reserve`);
  for(const [name,cost] of team.keepers){
    assert.equal(roster.get(`${team.manager}|${name}`),cost,`${team.manager} / ${name} roster cost`);
    assert.ok(playerNames.has(aliases[name]||name),`${team.manager} / ${name} player pool resolution`);
  }
  keepers+=team.keepers.length; keeperSalary+=sum; remaining+=team.remainingBudget;
}

assert.equal(keepers,106);
assert.equal(keeperSalary,1454);
assert.equal(remaining,1346);
assert.equal(14*16-keepers,118);
assert.equal(keeperSalary+remaining,14*200);

const hovo=teams.find(t=>t.manager==='Hovo');
assert.equal(hovo.nominationOrder,11);
assert.equal(hovo.keepers.length,8);
assert.equal(hovo.keeperSalary,111);
assert.equal(hovo.remainingBudget,89);
assert.equal(strategy.budgetAtDraft,89);
assert.equal(strategy.openRosterSpots,8);
assert.deepEqual(strategy.preferredBuild,[40,25,10,10]);

console.log(`Fantastic final data valid: ${teams.length} teams, ${keepers} keepers, $${keeperSalary} kept, $${remaining} remaining, ${14*16-keepers} open slots.`);

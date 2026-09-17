import assert from 'node:assert/strict';
import { analyzeFaab, parseCsvObjects } from '../worker.js';

const profile = {
  id: 'off-with-their-heads',
  name: 'Off With Their Heads',
  teams: 18,
  starters: { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 2 },
  flexEligible: ['RB', 'WR', 'TE'],
  playersCsv: `name,pos,team,ecr,proj
Puka Nacua,WR,LAR,2,287.3
Malik Nabers,WR,NYG,10,193.8
Emeka Egbuka,WR,TB,16,178.5
Tucker Kraft,TE,GB,5,153
Courtland Sutton,WR,DEN,38,150.6
Keenan Allen,WR,LAC,59,113.2
Tyler Warren,TE,IND,4,164.9`
};

const input = {
  week: 2,
  startingBudget: 1000,
  remainingBudget: 1000,
  teamsAlive: 18,
  aggression: 0.8,
  rosterCsv: `name,pos,team,week_proj,ros_rank
Josh Allen,QB,BUF,23.5,1
De'Von Achane,RB,MIA,14.5,11
Tony Pollard,RB,TEN,8.9,34
Aaron Jones Sr.,RB,MIN,8.6,42
Davante Adams,WR,LAR,10.7,23
Courtland Sutton,WR,DEN,8.9,38
Keenan Allen,WR,LAC,6.7,59
Tyler Warren,TE,IND,9.7,4`,
  availableCsv: `name,pos,team,week_proj,ros_rank,endgame,role,schedule,injury
Puka Nacua,WR,LAR,16.9,2,100,100,4,10
Malik Nabers,WR,NYG,11.4,10,75,85,3,25
Emeka Egbuka,WR,TB,10.5,16,55,85,3,8
Tucker Kraft,TE,GB,9.0,5,40,65,3,15`
};

assert.equal(parseCsvObjects('name,pos\n"Nacua, Puka",WR')[0].name, 'Nacua, Puka');

const report = analyzeFaab(input, profile);
const byName = Object.fromEntries(report.recommendations.map((p) => [p.name, p]));

assert.equal(report.calibrationVersion, 'off-with-their-heads-2025-plus-2026-09-16');
assert.equal(byName['Puka Nacua'].tier, 'elite');
assert.ok(byName['Puka Nacua'].projectedWinningBid >= 300);
assert.ok(byName['Puka Nacua'].recommendedBid < byName['Puka Nacua'].projectedWinningBid);
assert.ok(byName['Malik Nabers'].projectedWinningBid >= 150 && byName['Malik Nabers'].projectedWinningBid <= 220);
assert.ok(byName['Emeka Egbuka'].projectedWinningBid >= 45 && byName['Emeka Egbuka'].projectedWinningBid <= 70);
assert.ok(byName['Tucker Kraft'].projectedWinningBid >= 15 && byName['Tucker Kraft'].projectedWinningBid <= 30);
assert.ok(byName['Puka Nacua'].lineupUpgrade > byName['Emeka Egbuka'].lineupUpgrade);
assert.ok(byName['Tucker Kraft'].lineupUpgrade < byName['Emeka Egbuka'].lineupUpgrade);

const twelve = analyzeFaab({ ...input, teamsAlive: 12 }, { ...profile, teams: 12 });
const twelvePuka = twelve.recommendations.find((p) => p.name === 'Puka Nacua');
assert.ok(twelvePuka.projectedWinningBid < byName['Puka Nacua'].projectedWinningBid);

console.log('FAAB engine tests passed');

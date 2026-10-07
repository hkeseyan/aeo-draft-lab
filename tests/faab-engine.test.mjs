import assert from 'node:assert/strict';
import { analyzeFaab, fantasyProsLeagueKey, normalizeFantasyProsMatchup, parseCsvObjects } from '../worker.js';

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
  rosterCsv: `name,pos,team,week_proj,ros_rank,drop_class,drop_notes
Josh Allen,QB,BUF,23.5,1,protected,
De'Von Achane,RB,MIA,14.5,11,protected,
Tony Pollard,RB,TEN,8.9,34,replaceable,replace when waiver plan has a better use
Aaron Jones Sr.,RB,MIN,8.6,42,conditional,
Davante Adams,WR,LAR,10.7,23,protected,
Courtland Sutton,WR,DEN,8.9,38,conditional,
Keenan Allen,WR,LAC,6.7,59,conditional,
Tyler Warren,TE,IND,9.7,4,protected,`,
  availableCsv: `name,pos,team,roster_pct,roster_trend,trend_metric,trend_window_hours,trend_source,week_proj,ros_rank,endgame,role,schedule,injury
Puka Nacua,WR,LAR,99.2,1.8,roster_pct_delta,,yahoo,16.9,2,100,100,4,10
Malik Nabers,WR,NYG,96.5,0.4,roster_pct_delta,,yahoo,11.4,10,75,85,3,25
Emeka Egbuka,WR,TB,71.0,134,adds,24,sleeper,10.5,16,55,85,3,8
Tucker Kraft,TE,GB,44.0,52,adds,24,sleeper,9.0,5,40,65,3,15`
};

assert.equal(parseCsvObjects('name,pos\n"Nacua, Puka",WR')[0].name, 'Nacua, Puka');
assert.equal(
  fantasyProsLeagueKey('https://www.fantasypros.com/nfl/myplaybook/matchup.php?key=nfl~6c8af73a-4b6b-4c98-a9ec-86d3f1c5bc49'),
  'nfl~6c8af73a-4b6b-4c98-a9ec-86d3f1c5bc49'
);
assert.equal(fantasyProsLeagueKey('not-a-league'), '');

const fantasyProsSnapshot = normalizeFantasyProsMatchup({
  key: 'nfl~6c8af73a-4b6b-4c98-a9ec-86d3f1c5bc49',
  teamName: 'Ilyn Payne',
  matchup: {
    team1: {
      name: 'Ilyn Payne',
      starters: [{ full: 'Josh Allen', real_position: 'QB', real_team: 'BUF', original_proj: 23.16, ecr: 'QB1', sos: 4, opponent: 'vs. DET' }],
      bench: [{ full: 'Courtland Sutton', real_position: 'WR', real_team: 'DEN', original_proj: 8.72, ecr: 'WR36', sos: 1, opponent: 'vs. JAC' }]
    }
  }
}, profile);
assert.equal(fantasyProsSnapshot.roster.length, 2);
assert.equal(fantasyProsSnapshot.roster[0].week_proj, 23.16);
assert.equal(fantasyProsSnapshot.roster[1].ros_rank, 36);
assert.deepEqual(fantasyProsSnapshot.lineup.starters, ['Josh Allen']);

const report = analyzeFaab(input, profile);
const byName = Object.fromEntries(report.recommendations.map((p) => [p.name, p]));

assert.equal(report.calibrationVersion, 'off-with-their-heads-through-2026-09-30-v2');
assert.equal(byName['Puka Nacua'].tier, 'elite');
assert.ok(byName['Puka Nacua'].projectedWinningBid >= 300);
assert.ok(byName['Puka Nacua'].recommendedBid < byName['Puka Nacua'].projectedWinningBid);
assert.ok(byName['Malik Nabers'].projectedWinningBid >= 150 && byName['Malik Nabers'].projectedWinningBid <= 220);
assert.ok(byName['Emeka Egbuka'].projectedWinningBid >= 45 && byName['Emeka Egbuka'].projectedWinningBid <= 70);
assert.ok(byName['Tucker Kraft'].projectedWinningBid >= 15 && byName['Tucker Kraft'].projectedWinningBid <= 30);
assert.equal(byName['Puka Nacua'].competitiveMarketBid, 350);
assert.equal(byName['Puka Nacua'].outlierWinningBid, 400);
assert.ok(byName['Puka Nacua'].historicalMarket.sampleSize >= 1);
assert.ok(byName['Puka Nacua'].lineupUpgrade > byName['Emeka Egbuka'].lineupUpgrade);
assert.ok(byName['Tucker Kraft'].lineupUpgrade < byName['Emeka Egbuka'].lineupUpgrade);

assert.equal(byName['Puka Nacua'].suggestedDrop, 'Tony Pollard');
assert.equal(byName['Puka Nacua'].suggestedDropClass, 'replaceable');
assert.equal(byName['Puka Nacua'].rosterPct, 99.2);
assert.equal(byName['Puka Nacua'].rosterTrend, 1.8);
assert.equal(byName['Puka Nacua'].trendMetric, 'roster_pct_delta');
assert.equal(byName['Puka Nacua'].trendSource, 'yahoo');
assert.equal(byName['Emeka Egbuka'].rosterTrend, 134);
assert.equal(byName['Emeka Egbuka'].trendMetric, 'adds');
assert.equal(byName['Emeka Egbuka'].trendWindowHours, 24);
assert.equal(byName['Emeka Egbuka'].trendSource, 'sleeper');
assert.equal(byName['Puka Nacua'].trendPercentile, 100);
assert.equal(byName['Emeka Egbuka'].trendPercentile, 100);
assert.equal(byName['Puka Nacua'].discoveryRank, 1);
assert.equal(byName['Emeka Egbuka'].discoveryRank, 2);
assert.ok(byName['Puka Nacua'].discoveryScore > byName['Malik Nabers'].discoveryScore);
assert.ok(byName['Puka Nacua'].lineupDisplaced);
assert.equal(report.bidOrderLocked, true);
assert.equal(report.claimOrderRule, 'bid_descending');
assert.ok(report.recommendations.every((p, i, rows) => i === 0 || rows[i - 1].recommendedBid >= p.recommendedBid));
assert.deepEqual(report.recommendations.map(p => p.claimOrder), report.recommendations.map((_, i) => i + 1));

const twelve = analyzeFaab({ ...input, teamsAlive: 12 }, { ...profile, teams: 12 });
const twelvePuka = twelve.recommendations.find((p) => p.name === 'Puka Nacua');
assert.ok(twelvePuka.projectedWinningBid < byName['Puka Nacua'].projectedWinningBid);

const managed = analyzeFaab({
  ...input,
  remainingBudget: 699,
  competitorBudgets: [{ name: 'Me', faabBalance: 699, mine: true }, { name: 'Rival A', faabBalance: 225 }, { name: 'Rival B', faabBalance: 180 }],
  playerOverridesCsv: `name,suggested_bid,max_bid,drop_first,drop_second,secondary_multiplier,decision,notes
Puka Nacua,250,266,Tate,Sutton,0.5,,endgame lock without emptying the bank
Tucker Kraft,0,0,,,,pass,already strong at tight end`
}, profile);
const managedByName = Object.fromEntries(managed.recommendations.map((p) => [p.name, p]));
assert.equal(managedByName['Puka Nacua'].recommendedBid, 250);
assert.equal(managedByName['Puka Nacua'].stretchBid, 266);
assert.equal(managedByName['Puka Nacua'].suggestedDrop, 'Tate');
assert.equal(managedByName['Puka Nacua'].backupDrop, 'Sutton');
assert.equal(managedByName['Puka Nacua'].backupBid, 125);
assert.equal(managedByName['Puka Nacua'].projectedWinningBid, 226);
assert.equal(managedByName['Tucker Kraft'].recommendedBid, 0);
assert.equal(managedByName['Tucker Kraft'].stretchBid, 0);
assert.equal(managed.competitorBudgetSummary.max, 225);

// A shrinking 18-team guillotine league must retain its 18-team market
// calibration. "Teams alive = 12" is season phase, not permission to import
// the separate 12-team league's RB/WR medians. It should also distinguish an
// elite RB from replacement-level players and treat next week's bye as a
// roster-specific discount rather than erasing the broader market.
const weekFive = analyzeFaab({
  week: 5,
  startingBudget: 1000,
  remainingBudget: 699,
  teamsAlive: 12,
  initialTeams: 18,
  aggression: 0.8,
  zeroBidAllowed: true,
  rosterCsv: `name,pos,team,week_proj,ros_rank,status,bye_week,roster_slot,drop_class
Josh Allen,QB,BUF,22.9,1,,7,QB,protected
Saquon Barkley,RB,PHI,13.4,16,,10,RB,protected
Tony Pollard,RB,TEN,8.8,29,,9,RB,replaceable
Emeka Egbuka,WR,TB,8.5,33,,10,WR,conditional
Davante Adams,WR,LAR,13,13,,11,WR,protected
Jameson Williams,WR,DET,9.9,26,,6,FLEX,conditional`,
  availableCsv: `name,pos,team,week_proj,ros_rank,endgame,role,schedule,injury,bye_week,status
Jahmyr Gibbs,RB,DET,19.3,1,100,100,3,8,6,W
Ladd McConkey,WR,LAC,0,28,35,70,3,60,7,W
J.K. Dobbins,RB,DEN,0,80,10,30,3,100,10,W
Tyler Allgeier,RB,ARI,4,55,15,45,3,8,14,W
MarShawn Lloyd,RB,GB,3,65,10,35,3,20,11,W`
}, profile);
const weekFiveByName = Object.fromEntries(weekFive.recommendations.map((p) => [p.name, p]));
assert.ok(weekFiveByName['Jahmyr Gibbs'].competitiveMarketBid >= 280);
assert.ok(weekFiveByName['Jahmyr Gibbs'].projectedWinningBid >= 300);
assert.ok(weekFiveByName['Jahmyr Gibbs'].outlierWinningBid >= 375);
assert.ok(weekFiveByName['Jahmyr Gibbs'].recommendedBid >= 150 && weekFiveByName['Jahmyr Gibbs'].recommendedBid <= 220);
assert.ok(weekFiveByName['Jahmyr Gibbs'].reasons.some((reason) => reason.includes('guaranteed next-week zero')));
assert.ok(weekFiveByName['Ladd McConkey'].projectedWinningBid >= 20 && weekFiveByName['Ladd McConkey'].projectedWinningBid <= 80);
assert.ok(weekFiveByName['Ladd McConkey'].recommendedBid <= 10);
assert.equal(weekFiveByName['J.K. Dobbins'].recommendedBid, 0);
assert.ok(weekFiveByName['Tyler Allgeier'].projectedWinningBid < 30);
assert.ok(weekFiveByName['MarShawn Lloyd'].projectedWinningBid < 30);
assert.notEqual(weekFiveByName['Jahmyr Gibbs'].competitiveMarketBid, weekFiveByName['Tyler Allgeier'].competitiveMarketBid);

console.log('FAAB engine tests passed');

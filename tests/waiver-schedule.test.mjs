import assert from 'node:assert/strict';
import worker, { analyzeFaab, parseCsvObjects } from '../worker.js';
import { analyzeScheduleWaivers, fitLineup, planningWindow } from '../waiver-planner.js';
import { manualGameSchedule, normalizeNbaSchedule, fetchGameSchedule } from '../waiver-schedules.js';

const days=['2026-10-12','2026-10-13','2026-10-14','2026-10-15','2026-10-16','2026-10-17','2026-10-18'];
const profile={id:'hockey',name:'Hockey',sport:'nhl',scoringMode:'points',lineupPeriod:'daily',starters:{LW:1,RW:1},maxAcquisitionsPerWeek:4,waiverRules:{mode:'continuous'}};
const input={planStart:days[0],planEnd:days[6],planningMode:'next_week',acquisitionsActiveFrom:days[0],acquisitionsRemaining:2,gameSchedule:{days,teams:{BOS:[days[1],days[3],days[5]],TOR:[days[1],days[3]],COL:[days[0],days[2],days[4]],EDM:[days[1],days[3],days[5]]}},roster:[
  {name:'Star LW',pos:'LW',team:'BOS',fppg:10,drop_class:'protected'},
  {name:'Crowded LW',pos:'LW',team:'BOS',fppg:4,drop_class:'replaceable'},
  {name:'Held RW',pos:'RW',team:'TOR',fppg:6,drop_class:'protected'}
],available:[{name:'Off-night winger',pos:'LW',team:'COL',fppg:4},{name:'Busy RW',pos:'RW',team:'EDM',fppg:4}]};
const run=(overrides={},p=profile)=>analyzeScheduleWaivers({...input,...overrides},p,parseCsvObjects);
let report=run();
assert.equal(report.dropCandidates[0].name,'Crowded LW');
assert.equal(report.dropCandidates[0].scheduledGames,3);
assert.equal(report.dropCandidates[0].usableGames,0);
assert.equal(report.recommendations[0].name,'Off-night winger');
assert.equal(report.recommendations[0].netGames,3);
assert.equal(report.recommendations[0].recommendedBid,null,'No NFL price calibration');
assert.equal(report.recommendations[0].claimAction,'review');
assert.equal(run({acquisitionsActiveFrom:days[3]}).recommendations.find(p=>p.name==='Off-night winger').usableGames,1,'Exclude games before acquisition');
assert.equal(run({acquisitionsActiveFrom:''}).recommendations[0].claimAction,'pass','Continuous claims require timing');
assert.equal(run({acquisitionsRemaining:0}).recommendations[0].claimAction,'pass');
assert.equal(run({waiverProcessing:'free_agency_only',acquisitionsActiveFrom:''}).recommendations[0].claimAction,'review','Explicit host mechanics override default continuous profile');
assert.throws(()=>run({acquisitionsActiveFrom:'not-a-date'}),/effective dates/);
assert.equal(run({roster:input.roster.map(p=>({...p,drop_class:'protected'}))}).recommendations[0].suggestedDrop,null);
assert.equal(run({roster:input.roster.map(p=>({...p,drop_class:''}))}).dropCandidates.length,0);
assert.equal(run({roster:input.roster.map(p=>p.name==='Crowded LW'?{...p,drop_class:'conditional',ros_rank:50}:p),available:[{...input.available[0],ros_rank:60}]}).recommendations[0].claimAction,'pass');
assert.equal(run({roster:input.roster.map(p=>p.name==='Crowded LW'?{...p,drop_class:'conditional',ros_rank:50}:p),available:[{...input.available[0],ros_rank:40}]}).recommendations[0].claimAction,'review');
const open=run({openRosterSpots:1,roster:input.roster.filter(p=>p.name!=='Crowded LW')});
assert.equal(open.recommendations[0].suggestedDrop,null);
assert.equal(open.recommendations[0].netGames,3);
const partial=run({planStart:days[3],gameSchedule:input.gameSchedule});
assert.equal(partial.dropCandidates[0].scheduledGames,2);
assert.equal(partial.recommendations.find(p=>p.name==='Off-night winger').usableGames,1);
const goalie=run({openRosterSpots:1,available:[{name:'Goalie',pos:'G',team:'COL',fppg:8}]},{...profile,starters:{G:1}});
assert.equal(goalie.recommendations[0].usableGames,null,'Missing expected starts are unknown, not zero');
assert.equal(goalie.recommendations[0].claimAction,'pass');
assert.equal(run({openRosterSpots:1,available:[{name:'Goalie',pos:'G',team:'COL',fppg:8,start_dates:days[2]}]},{...profile,starters:{G:1}}).recommendations[0].usableGames,1);

const fit=fitLineup([{name:'Dual',pos:'LW/RW',priority:10},{name:'LW only',pos:'LW',priority:8}],profile);
assert.equal(fit.players.length,2,'Reassign dual eligibility to preserve both players');
assert.equal(new Set(fit.players).size,2);
assert.equal(fitLineup([{name:'Centre',pos:'C',priority:10}],{...profile,starters:{F:1}}).players.length,1);
const nba={...profile,sport:'nba',starters:{PG:1,SG:1,UTIL:1}};
assert.equal(fitLineup([{name:'Dual',pos:'PG/SG',priority:10},{name:'PG',pos:'PG',priority:8},{name:'C',pos:'C',priority:5}],nba).players.length,3);
assert.equal(run({}, {...profile,lineupPeriod:'weekly'}).recommendations.find(p=>p.name==='Off-night winger').usableGames,0,'Weekly bench does not start on star’s off days');
assert.equal(run({planningMode:'remaining_week'}, {...profile,lineupPeriod:'weekly'}).recommendations[0].claimAction,'pass','Locked weekly lineup is not inferred');
assert.throws(()=>run({}, {...profile,leagueType:'bestball'}),/Best Ball/);
assert.throws(()=>run({gameSchedule:{days:days.slice(1),teams:{}}}),/complete schedule/);
assert.throws(()=>run({planStart:'2026-02-30'}),/valid planning window/);
assert.deepEqual(planningWindow({},new Date('2026-10-12T05:00:00Z')).days,days,'Sunday Pacific plans upcoming Monday');
assert.equal(planningWindow({planningMode:'remaining_week'},new Date('2026-10-15T01:00:00Z')).start,days[2],'Explicit midweek begins local today');
assert.equal(planningWindow({},new Date('2026-10-12T08:00:00Z')).start,days[0],'Monday default still covers this Monday');

const unresolved=run({roster:input.roster.map(p=>({...p,drop_class:'protected'}))}).recommendations.find(p=>p.name==='Off-night winger');
assert.equal(unresolved.usableGames,3,'Lineup opportunity is independent of drop authorization');
assert.equal(unresolved.netGames,null);
assert.equal(unresolved.dropResolved,false);
for(const status of ['Q','DTD','D'])assert.equal(run({available:[{...input.available[0],status}]}).recommendations[0].usableGames,3);
assert.equal(run({available:[{...input.available[0],status:'IR'}]}).recommendations[0].lane,'injury_watch');
const ir=run({roster:[...input.roster,{name:'IR hold',pos:'LW',team:'COL',roster_slot:'IR',drop_class:'replaceable'}]});
assert.equal(ir.rosterOpportunity.find(p=>p.name==='IR hold').dropClass,'protected');
assert.equal(ir.dropCandidates.some(p=>p.name==='IR hold'),false);
const contextRun=run({openRosterSpots:1,available:[{name:'Igor Shesterkin',pos:'G',team:'NYR',ros_rank:1,roster_pct:99},{name:'Sidney Crosby',pos:'C/LW',team:'COL',fppg:9,ros_rank:38,roster_pct:97}]},{...profile,starters:{C:1,LW:1,G:1}});
assert.equal(contextRun.recommendations[0].name,'Sidney Crosby');
assert.equal(contextRun.recommendations[0].pos,'C/LW','Context must not overwrite platform eligibility');
const injured=contextRun.recommendations.find(p=>p.name==='Igor Shesterkin');
assert.equal(injured.lane,'excluded');assert.equal(injured.claimAction,'pass');assert.equal(injured.usableGames,0);assert.match(injured.injurySource,/nhl.com/);
for(const name of ['New season-out skater','Another future injured star']){
  const general=run({openRosterSpots:1,available:[{name,pos:'LW',team:'COL',ros_rank:1,roster_pct:99,target_class:'core_add',injury_outlook:'season_out',injury_confidence:'confirmed',injury_source:'https://example.test/verified-team-announcement',injury_checked_at:'2026-10-12'}]});
  assert.equal(general.recommendations[0].lane,'excluded','Season-ending exclusion is based on evidence, not name');
  assert.equal(general.recommendations[0].claimAction,'pass');
}
assert.equal(run({available:[{...input.available[0],status:'IR',injury_outlook:'temporary'}]}).recommendations[0].lane,'injury_watch','IR alone is not a season-ending exclusion');
const noGames=run({openRosterSpots:1,available:[{name:'Sidney Crosby',pos:'LW',team:'NONE',fppg:9}]});
assert.equal(noGames.recommendations[0].lane,'streamer','Position incompatible with known identity cannot inherit Crosby context');
const coreZero=run({openRosterSpots:1,available:[{name:'Core target',pos:'LW',team:'NONE',target_class:'core_add'}]});
assert.equal(coreZero.recommendations[0].usableGames,0);assert.equal(coreZero.recommendations[0].claimAction,'review','Core acquisition does not require immediate games');
assert.equal(run({targetPreferences:[{name:'Off-night winger',pos:'LW',targetClass:'schedule_watch'}]}).recommendations.find(p=>p.name==='Off-night winger').lane,'watch');
const personal=run({roster:[{name:'John Gibson',pos:'G',team:'COL',start_dates:days[0],drop_class:'replaceable'},{name:'Thomas Novak',pos:'C',team:'BOS'}]},{...profile,yahooLeagueId:'135526',starters:{C:1,G:1}});
assert.equal(personal.rosterOpportunity.find(p=>p.name==='John Gibson').dropClass,'protected');
assert.equal(personal.rosterOpportunity.find(p=>p.name==='Thomas Novak').dropClass,'replaceable');
assert.equal(run({acquisitionsRemaining:null}, {...profile,yahooLeagueId:'141304'}).streamingPlan.followUpAdds,3);
assert.equal(run({streamingSlots:2,acquisitionsRemaining:4}).streamingPlan.followUpAdds,2);
const contingency=report.rosterOpportunity.find(p=>p.name==='Crowded LW');
assert.equal(contingency.contingentGames,3);assert.equal(contingency.contingentCredit,0.3);
const earlyCycle=run({roster:[{name:'Monday hold',pos:'LW',team:'EARLY',fppg:6,drop_class:'replaceable'}],gameSchedule:{days,teams:{EARLY:[days[0]],COL:[days[2],days[4]]}},available:[{name:'Later winger',pos:'LW',team:'COL',fppg:5}],acquisitionsRemaining:1});
assert.equal(earlyCycle.streamingPaths[0].hold,'Monday hold');assert.equal(earlyCycle.streamingPaths[0].activeFrom,days[1]);assert.equal(earlyCycle.streamingPaths[0].netGames,2);assert.equal(earlyCycle.streamingPaths[0].addsRequired,1);
assert.equal(run({acquisitionsRemaining:0}).streamingPaths.length,0);

const window={start:days[0],end:days[6],days};
assert.throws(()=>manualGameSchedule([['date','team'],[days[0],'BOS']],window),/every date/);
const manual=manualGameSchedule([['date','team'],...days.map(d=>[d,'']),[days[0],'BOS'],[days[0],'COL']],window);
assert.equal(manual.dayCounts[days[0]],1);
const nbaFeed={leagueSchedule:{gameDates:[{games:[{gameId:'0022600001',gameCode:'20261013/BOSNYK',awayTeam:{teamTricode:'BOS'},homeTeam:{teamTricode:'NYK'}},{gameId:'0012600001',gameCode:'20261012/BOSNYK',awayTeam:{teamTricode:'BOS'},homeTeam:{teamTricode:'NYK'}}]}]}};
assert.deepEqual(normalizeNbaSchedule(nbaFeed,window).teams.BOS,[days[1]],'Preseason excluded');
assert.throws(()=>normalizeNbaSchedule({leagueSchedule:{gameDates:[{games:[{gameId:'0022500001',gameCode:'20251013/BOSNYK'}]}]}},window),/does not cover/);
assert.equal(analyzeFaab(input,profile).planner,'schedule','Worker dispatch uses sport');
const rescored=run({roster:[],openRosterSpots:1,available:[{name:'Scorer',pos:'LW',team:'COL',gp:10,g:5,a:5}]},{...profile,scoring:{g:4,a:3}});
assert.equal(rescored.recommendations[0].adjustedWeekProjection,10.5,'Projection uses this league’s raw-stat scoring');

const native=globalThis.fetch;
globalThis.fetch=async()=>Response.json({gameWeek:days.map(date=>({date,games:date===days[2]?[{gameType:2,awayTeam:{abbrev:'BOS'},homeTeam:{abbrev:'COL'}}]:[]}))});
try{
  const schedule=await fetchGameSchedule({get:async()=>null,put:async()=>{}},'nhl',window);
  assert.deepEqual(schedule.teams.BOS,[days[2]]);
  assert.deepEqual(schedule.days,days);
}finally{globalThis.fetch=native;}
class MemoryKv {
  data=new Map();
  async get(k,options){const v=this.data.get(k);return v==null?null:options?.type==='json'?JSON.parse(v):v;}
  async put(k,v){this.data.set(k,String(v));}
  async list({prefix=''}){return {keys:[...this.data.keys()].filter(k=>k.startsWith(prefix)).map(name=>({name}))};}
}
const kv=new MemoryKv(),env={MOCKS:kv};
await kv.put('league:hockey',JSON.stringify(profile));
const scheduleCsv='date,team\n'+days.map(d=>d+',').join('\n')+'\n'+Object.entries(input.gameSchedule.teams).flatMap(([team,dates])=>dates.map(d=>d+','+team)).join('\n');
const request=(path,body)=>new Request('https://draft.test'+path+'?league=hockey',{method:body?'POST':'GET',...(body?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
const response=await worker.fetch(request('/api/inseason/reports',{...input,gameScheduleCsv:scheduleCsv}),env);
assert.equal(response.status,201);
const savedReport=await response.json();
assert.equal(savedReport.planner,'schedule');
assert.equal((await kv.get('inseasonReports:hockey',{type:'json'}))[0].window,'2026-10-12 – 2026-10-18');
const ticketResponse=await worker.fetch(request('/api/inseason/tickets',{player:'Off-night winger',pos:'LW',recommendedBid:1,planningStart:days[0],planningEnd:days[6],acquisitionsActiveFrom:days[0],usableDates:[days[0],days[2],days[4]]}),env);
assert.equal(ticketResponse.status,201);
assert.deepEqual((await ticketResponse.json()).usableDates,[days[0],days[2],days[4]]);
const bad=await worker.fetch(request('/api/inseason/reports',{...input,gameScheduleCsv:'date,team\n2026-10-12,COL'}),env);
assert.equal(bad.status,422);
assert.equal((await kv.get('inseasonReports:hockey',{type:'json'})).length,1,'Invalid schedule never saves a report');
assert.equal((await bad.json()).error.includes('every date'),true);
// NHL does not accidentally run its saved legacy Tuesday checkbox.
await kv.put('inseason:hockey',JSON.stringify({...input,scheduleEnabled:true,sportsScheduleEnabled:false}));
let pending;worker.scheduled({scheduledTime:Date.parse('2026-10-13T08:00:00Z')},env,{waitUntil(p){pending=p;}});await pending;
assert.equal((await kv.get('inseasonReports:hockey',{type:'json'})).length,1);
await kv.put('league:hockey',JSON.stringify({...profile,yahooLeagueKey:'466.l.1'}));
await kv.put('leagueSource:hockey',JSON.stringify({yahooEnabled:true,fantasyProsEnabled:false}));
await kv.put('yahooAuth:default',JSON.stringify({access_token:'fixture',expires_at:Date.now()+86400000}));
globalThis.fetch=async input=>{
  const path=new URL(String(input)).pathname;
  if(path.endsWith('/teams'))return Response.json({team:{team_key:'466.l.1.t.1',name:{full:'Me'},is_owned_by_current_login:1}});
  if(path.includes('/roster'))return Response.json({player:{player_key:'466.p.1',name:{full:'Multi forward'},display_position:'C',editorial_team_abbr:'COL',status:'DTD',eligible_positions:[{position:'C'},{position:'LW'},{position:'RW'}],selected_position:{position:'BN'}}});
  if(path.includes('status=W'))return Response.json({player:{player_key:'466.p.2',name:{full:'Free winger'},display_position:'RW',editorial_team_abbr:'COL',eligible_positions:[{position:'LW'},{position:'RW'}]}});
  if(path.includes('status=FA')||path.includes('/transactions'))return Response.json({players:[]});
  throw new Error('Unexpected fixture endpoint '+path);
};
try{
  const response=await worker.fetch(request('/api/data-sources/sync',{}),env);
  assert.equal(response.status,201);
  const synced=await response.json();
  assert.equal(synced.roster[0].pos,'C/LW/RW','Yahoo eligible positions survive source sync');
  assert.equal(synced.roster[0].status,'DTD');
  assert.equal(synced.roster[0].roster_slot,'BN');
  assert.equal(synced.available[0].pos,'LW/RW');
}finally{globalThis.fetch=native;}
console.log('NHL/NBA schedule-aware waiver engine and API tests passed');

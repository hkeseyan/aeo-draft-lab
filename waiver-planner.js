import { reviewedContext, leagueRosterPreference } from './player-context.js';
// Schedule opportunity is separate from the NFL guillotine bid model.
const number = (v, fallback = 0) => v !== '' && v != null && Number.isFinite(Number(v)) ? Number(v) : fallback;
export function localDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {timeZone:'America/Los_Angeles', year:'numeric', month:'2-digit', day:'2-digit'}).formatToParts(now);
  const get = key => parts.find(p => p.type === key).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export function shiftDate(date, days) {
  const d = new Date(date + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0,10);
}
export function planningWindow(input = {}, now = new Date()) {
  const today = localDate(now), weekday = new Date(today+'T12:00:00Z').getUTCDay();
  const mode = input.planningMode || 'sunday_monday';
  const monday = shiftDate(today, -(weekday + 6) % 7);
  const upcomingMonday=weekday===1?today:shiftDate(monday,7);
  const start = input.planStart || (mode === 'sunday_monday'?upcomingMonday:mode === 'next_week' ? shiftDate(monday, 7) : today);
  const end = input.planEnd || (mode === 'sunday_monday'?shiftDate(upcomingMonday,6):mode === 'next_week' ? shiftDate(monday, 13) : shiftDate(monday, 6));
  if (![start,end].every(d => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d+'T12:00:00Z')) && shiftDate(d,0)===d) || end < start || (Date.parse(end)-Date.parse(start))/86400000 > 20) throw new Error('Choose a valid planning window of at most 21 days.');
  const days = []; for (let d=start; d<=end; d=shiftDate(d,1)) days.push(d);
  return {start,end,days,mode};
}
const split = value => Array.isArray(value) ? value : String(value || '').toUpperCase().split(/[\s/;|,]+/).filter(Boolean);
function eligible(player, slot, profile) {
  const positions = split(player.pos);
  if (positions.includes(slot)) return true;
  if (slot === 'F' && profile.sport === 'nhl') return positions.some(p => ['C','LW','RW','F'].includes(p));
  if (slot === 'F' && profile.sport === 'nba') return positions.some(p => ['SF','PF','F'].includes(p));
  if (slot === 'G' && profile.sport === 'nba') return positions.some(p => ['PG','SG','G'].includes(p));
  if (['UTIL','UT','FLEX'].includes(slot)) return profile.sport === 'nba' || positions.some(p => p !== 'G');
  return false;
}
function slotList(profile) {
  return Object.entries(profile.starters || {}).flatMap(([pos,count]) => Array.from({length:Math.min(20,Math.max(0,number(count)))},()=>pos.toUpperCase()));
}
// Greedy by player value with augmenting paths maximizes weighted independent
// player sets in this matching matroid. Reassigning accepted players preserves
// flexible eligibility without counting a player twice.
export function fitLineup(players, profile, weight = p => p.priority) {
  const slots=slotList(profile), assigned=slots.map(()=>null);
  const insert = (p, seen) => {
    for (let i=0;i<slots.length;i++) {
      if (seen.has(i) || !eligible(p,slots[i],profile)) continue;
      seen.add(i);
      if (!assigned[i] || insert(assigned[i],seen)) { assigned[i]=p; return true; }
    }
    return false;
  };
  players.slice().sort((a,b)=>weight(b)-weight(a)||a.name.localeCompare(b.name)).forEach(p=>insert(p,new Set()));
  return {players:assigned.filter(Boolean), openSlots:slots.filter((_,i)=>!assigned[i]), assignments:assigned.map((p,i)=>({slot:slots[i],player:p?.name||null}))};
}
function normalize(raw, pool, profile, date, overrides) {
  // Identity includes position, so the two Elias Petterssons cannot share inputs.
  const matches=pool.filter(p=>String(p.name).toLowerCase()===String(raw.name||raw.player||'').toLowerCase());
  const base=matches.find(p=>!raw.pos||split(p.pos).some(pos=>split(raw.pos).includes(pos)||(profile.sport==='nhl'&&split(raw.pos).includes('F')&&['C','LW','RW'].includes(pos))))||{};
  const context=reviewedContext({...base,...raw},profile,date,overrides);
  const {name:contextName,pos:contextPos,sport:contextSport,nhl_id:contextId,...contextFields}=context;
  const row={...base,...Object.fromEntries(Object.entries(raw).filter(([,v])=>v!==''&&v!=null)),...contextFields};
  if(raw.target_class)row.target_class=raw.target_class;
  let fppg=number(row.fppg ?? row.per_game_projection, NaN);
  if(!Number.isFinite(fppg)&&profile.scoringMode!=='categories'&&profile.scoringMode!=='roto'&&number(row.gp)>0){
    const scoring=Object.entries(profile.scoring||{});
    const observed=scoring.filter(([stat])=>row[stat]!==''&&row[stat]!=null);
    if(observed.length)fppg=observed.reduce((sum,[stat,mult])=>sum+number(row[stat])*number(mult),0)/number(row.gp);
    else if(!scoring.length&&number(row.proj)>0)fppg=number(row.proj)/number(row.gp);
  }
  const rank=number(row.ros_rank ?? row.ecr,999);
  const priority=number(row.lineup_priority, Number.isFinite(fppg)&&profile.scoringMode!=='categories'&&profile.scoringMode!=='roto'?fppg:1000-rank);
  const suppliedTeam=String(row.team||'').toUpperCase();
  const aliases=profile.sport==='nhl'?{LA:'LAK',NJ:'NJD',SJ:'SJS',TB:'TBL',MON:'MTL',CLB:'CBJ',ANH:'ANA',WAS:'WSH'}:{GS:'GSW',NY:'NYK',NO:'NOP',SA:'SAS',PHO:'PHX',UTAH:'UTA'};
  const reserve=['IR','IR+','IL','IL+','NA'].includes(String(row.roster_slot||'').toUpperCase());
  return {...row,name:String(row.name||row.player||''),pos:String(row.pos||row.position||'').toUpperCase(),team:aliases[suppliedTeam]||suppliedTeam,fppg,rosRank:rank,priority,dropClass:reserve?'protected':String(row.drop_class||'unclassified').toLowerCase(),rosterSlot:String(row.roster_slot||'').toUpperCase()};
}
function opportunities(p,schedule,window,from) {
  const teamDates = schedule.teams[p.team];
  const missingTeam = !p.team;
  const goalie = schedule.sport === 'nhl' && split(p.pos).includes('G');
  const hasStarts = p.start_dates != null && p.start_dates !== '';
  const gameDates = (teamDates||[]).filter(d=>window.days.includes(d));
  const dates=(goalie?(hasStarts?split(p.start_dates):[]):gameDates).filter(d=>window.days.includes(d)&&gameDates.includes(d)&&(!from||d>=from));
  const seasonOut=p.injury_outlook==='season_out'&&p.injury_confidence==='confirmed';
  const unavailable=seasonOut||['IR','IR+','IL','IL+','NA'].includes(p.rosterSlot)||['O','OUT','IR','IR+','IL','IL+','SUSP','NA'].includes(String(p.status||'').toUpperCase());
  const unknown=missingTeam || !p.pos || (goalie&&!hasStarts);
  return {gameDates, dates:unavailable?[]:dates,unknown,goalie,unavailable,seasonOut};
}
function evaluate(roster,profile,window) {
  const weekly=profile.lineupPeriod==='weekly';
  const weeklyLineup=weekly?fitLineup(roster.filter(p=>p.dates.length),profile,p=>p.priority*p.dates.length):null;
  const days=window.days.map(date=>{
    const active=roster.filter(p=>p.dates.includes(date));
    const fit=weekly?fitLineup(weeklyLineup.players.filter(p=>p.dates.includes(date)),profile):fitLineup(active,profile);
    return {date,scheduled:active.length,started:fit.players.length,benched:active.filter(p=>!fit.players.includes(p)).map(p=>p.name),openSlots:fit.openSlots,starters:fit.players.map(p=>p.name),assignments:fit.assignments,_players:fit.players};
  });
  const counts=new Map(roster.map(p=>[p,days.filter(d=>d._players.includes(p)).map(d=>d.date)]));
  const total=days.reduce((s,d)=>s+d.started,0);
  const points=roster.every(p=>Number.isFinite(p.fppg))?roster.reduce((s,p)=>s+counts.get(p).length*p.fppg,0):null;
  return {days:days.map(({_players,...day})=>day),counts,total,points};
}
export function analyzeScheduleWaivers(input,profile,parseRows,now=new Date()) {
  const window=planningWindow(input,now),schedule={...input.gameSchedule,sport:profile.sport};
  if (!schedule.teams || !Array.isArray(schedule.days) || window.days.some(d=>!schedule.days.includes(d))) throw new Error('A complete schedule for the selected window is required; refresh the schedule or paste it.');
  if (!Object.keys(profile.starters||{}).length) throw new Error('Set this league’s starting lineup slots before planning.');
  if (['lock_in','lockin','bestball'].includes(profile.lineupPeriod)||profile.leagueType==='bestball') throw new Error('This planner supports daily and weekly lineups; Lock-In and Best Ball need their own opportunity rules.');
  const rows=key=>{const parsed=parseRows(input[key+'Csv']||'');return parsed.length?parsed:Array.isArray(input[key])?input[key]:[];};
  const pool=parseRows(profile.playersCsv||'');
  const today=localDate(now);
  const roster=rows('roster').map(p=>{
    const normalized=normalize(p,pool,profile,today,input.playerContext);
    const preference=(input.rosterPreferences||[]).find(t=>t.name===normalized.name&&t.pos===normalized.pos)||leagueRosterPreference(normalized,profile);
    if(preference&&!['IR','IR+','IL','IL+','NA'].includes(normalized.rosterSlot)){normalized.dropClass=preference.dropClass;normalized.dropNotes=preference.dropNotes||'';}
    return normalized;
  });
  const available=rows('available').map(p=>normalize(p,pool,profile,today,input.playerContext));
  const warnings=[];
  if(input.dataFreshness?.roster?.current===false||input.dataFreshness?.available?.current===false)warnings.push('Saved roster/availability fallback is not current; refresh the host or verify the pasted pool before claiming.');
  if(roster.some(p=>!Number.isFinite(p.fppg)&&p.lineup_priority==null))warnings.push('Lineup order falls back to ROS rank where per-game points/lineup_priority are missing; review that order before submitting.');
  if(roster.some(p=>!p.team||!p.pos)) warnings.push('Roster rows with missing team/position make lineup coverage incomplete; fill them before claiming.');
  const unknownRoster=roster.some(p=>!p.team||!p.pos);
  roster.forEach(p=>Object.assign(p,opportunities(p,schedule,window)));
  if(roster.some(p=>p.goalie&&p.unknown)) warnings.push('Goalie team games are not starts. Supply start_dates (semicolon-separated YYYY-MM-DD) to evaluate goalies; unknown goalies are excluded.');
  const base=evaluate(roster,profile,window);
  const rosterOpportunity=roster.map(p=>{
    const usableDates=base.counts.get(p),contingentDates=p.unknown||p.unavailable?[]:p.dates.filter(d=>!usableDates.includes(d));
    return {name:p.name,pos:p.pos,team:p.team,rosterSlot:p.rosterSlot,dropClass:p.dropClass,dropNotes:p.dropNotes||'',scheduledDates:p.gameDates,scheduledGames:p.gameDates.length,usableGames:p.unavailable?0:p.unknown?null:usableDates.length,usableDates,contingentDates,contingentGames:contingentDates.length,contingentCredit:Number((contingentDates.length*0.1).toFixed(1)),firstUsableDate:usableDates[0]||null,lastUsableDate:usableDates.at(-1)||null,injuryStatus:p.status||'',reserve:['IR','IR+','IL','IL+','NA'].includes(p.rosterSlot)};
  });
  const droppable=roster.filter(p=>['dead','replaceable','conditional'].includes(p.dropClass)&&!p.unknown).sort((a,b)=>base.counts.get(a).length-base.counts.get(b).length||b.rosRank-a.rosRank);
  const drops=droppable.map(p=>({name:p.name,pos:p.pos,dropClass:p.dropClass,scheduledGames:p.gameDates.length,usableGames:base.counts.get(p).length,usableDates:base.counts.get(p),benchedGames:p.dates.length-base.counts.get(p).length,rosRank:p.rosRank}));
  const openSpots=Math.max(0,number(input.openRosterSpots));
  const addsRemaining=input.acquisitionsRemaining===''||input.acquisitionsRemaining==null?null:Math.max(0,number(input.acquisitionsRemaining));
  const plannedSlots=Math.max(1,Math.min(4,number(input.streamingSlots,1)));
  const planningBudget=addsRemaining??profile.maxAcquisitionsPerWeek??null;
  const streamingPlan={plannedSlots,planningBudget,budgetAssumed:addsRemaining==null,initialAdds:planningBudget==null?plannedSlots:Math.min(plannedSlots,planningBudget),followUpAdds:planningBudget==null?null:Math.max(0,planningBudget-plannedSlots),contingentWeight:0.1,note:'For new Sunday acquisitions, initial adds consume this budget. Keeping an existing Monday streamer uses no new acquisition; its first replacement costs one add. This is a next-step plan, not a verified full-week transaction chain.'};
  if(planningBudget!=null&&planningBudget<plannedSlots)warnings.push('The available acquisition budget cannot fill all selected streaming slots with new adds.');
  if(addsRemaining===null&&profile.maxAcquisitionsPerWeek)warnings.push('Enter acquisitions remaining to enforce this league’s weekly add limit.');
  if(profile.scoringMode==='categories'||profile.scoringMode==='roto')warnings.push('Usable-game opportunity only; category matchup needs, rate-stat impact and Roto games caps require separate review.');
  if(profile.lineupPeriod==='weekly')warnings.push('Weekly lineups select one lineup for the whole window. Use next week before its lock; current locked lineups cannot be inferred.');
  const mode=input.waiverProcessing&&input.waiverProcessing!=='unknown'?input.waiverProcessing:profile.waiverRules?.mode;
  const continuous=['continuous','continuous_waivers'].includes(mode);
  const recommendations=available.map(p=>{
    const sundayDefault=window.mode==='sunday_monday';
    const effectiveFrom=p.available_from||input.acquisitionsActiveFrom||((sundayDefault||!continuous)?window.start:'');
    if(effectiveFrom&&(!/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom)||shiftDate(effectiveFrom,0)!==effectiveFrom))throw new Error('Acquisition effective dates must be valid YYYY-MM-DD dates.');
    const timingUnknown=!effectiveFrom;
    const op=opportunities(p,schedule,window,effectiveFrom);Object.assign(p,op);
    const projected=evaluate([...roster,p],profile,window);
    const potentialDates=projected.counts.get(p);
    let best=null;
    const paths=openSpots?[null]:droppable.filter(drop=>drop.dropClass!=='conditional'||(p.rosRank<999&&p.rosRank<drop.rosRank));
    for(const drop of paths){
      // Preserve games from the departing player before the transaction takes effect.
      const outgoing=drop?{...drop,dates:drop.dates.filter(d=>effectiveFrom&&d<effectiveFrom)}:null;
      const next=evaluate([...roster.filter(r=>r!==drop),...(outgoing?[outgoing]:[]),p],profile,window);
      const usableDates=next.counts.get(p),netGames=next.total-base.total;
      const netPoints=next.points==null||base.points==null?null:Number((next.points-base.points).toFixed(2));
      const path={drop,usableDates,netGames,netPoints};
      if(!best || netGames>best.netGames || netGames===best.netGames&&(netPoints??0)>(best.netPoints??0))best=path;
    }
    const dates=best?.usableDates||potentialDates;
    const usable=op.unavailable?0:op.unknown?null:dates.length;
    const contingentDates=op.unknown||op.unavailable?[]:p.dates.filter(d=>!dates.includes(d));
    const earlyUsableGames=dates.filter(d=>d<=shiftDate(window.start,1)).length;
    const streamingScore=Number(((best?.netGames??usable??0)+contingentDates.length*0.1+(plannedSlots===1?earlyUsableGames*0.15:0)).toFixed(2));
    const ownership=number(p.roster_pct,0),adp=number(p.adp,999);
    const inferredCore=ownership>=95&&p.rosRank<=60&&adp<=75;
    const preference=(Array.isArray(input.targetPreferences)?input.targetPreferences:[]).find(t=>t.name===p.name&&t.pos===p.pos);
    const selectedTarget=preference?.targetClass||p.target_class;
    const target=['core_add','schedule_watch','streamer','ir_stash','avoid'].includes(selectedTarget)?selectedTarget:inferredCore?'core_add':'streamer';
    const lane=p.seasonOut||target==='avoid'?'excluded':p.unavailable?'injury_watch':target==='core_add'?'core_add':target==='schedule_watch'||target==='ir_stash'?'watch':'streamer';
    const reasons=[`${op.gameDates.length} team games; ${usable==null?'usable games unknown':usable+' usable games'}`,best?`${best.netGames>=0?'+':''}${best.netGames} net starting games after roster replacement`:'Drop unresolved: displayed games show lineup fit if acquired, not a completed roster transaction'];
    if(lane==='core_add')reasons.push(p.target_notes||'High ownership plus established pool value: review as a long-term add independent of schedule');
    if(lane==='watch')reasons.push('Longer-term watch target: favor a useful schedule, then review whether to keep');
    if(p.seasonOut)reasons.push('Confirmed season-ending absence: exclude from pickups this season');
    else if(p.unavailable)reasons.push('Injured/out: not an immediate streamer; review return news and IR capacity before a long-term stash');
    else if(['Q','DTD','D','DAY-TO-DAY'].includes(String(p.status||'').toUpperCase()))reasons.push('Q/day-to-day: assumed to play for schedule planning');
    if(!p.injury_source&&!p.injury_checked_at)reasons.push('No separately verified recent injury news; host status may lag');
    if(best?.drop)reasons.push(`Drop ${best.drop.name}: ${base.counts.get(best.drop).length} usable games (${best.drop.dropClass})`);
    if(timingUnknown)reasons.push('Confirm acquisition effective date under this league’s waiver rules');
    if(op.unknown)reasons.push(op.goalie?'Expected goalie starts required':'Player team/position required');
    const lockedWeek=profile.lineupPeriod==='weekly'&&(!['next_week','sunday_monday'].includes(window.mode)||effectiveFrom>window.start);
    const worthy=lane==='core_add'||(best&&(best.netGames>0||(best.netPoints??0)>0));
    const actionable=!!best&&!p.unavailable&&lane!=='excluded'&&!timingUnknown&&(!op.unknown||lane==='core_add')&&!unknownRoster&&!lockedWeek&&addsRemaining!==0&&worthy;
    return {name:p.name,pos:p.pos,team:p.team,rosRank:p.rosRank,lane,targetClass:target,targetClassSource:selectedTarget?'manager/reviewed context':inferredCore?'ownership + established value heuristic':'default streamer',injuryStatus:p.status||'',injuryOutlook:p.injury_outlook||'',injurySource:p.injury_source||'',injuryCheckedAt:p.injury_checked_at||'',injuryNote:p.injury_note||p.notes||'',scheduledGames:op.gameDates.length,scheduledDates:op.gameDates,contingentDates,contingentGames:contingentDates.length,contingentCredit:Number((contingentDates.length*0.1).toFixed(1)),earlyUsableGames,streamingScore,firstUsableDate:dates[0]||null,lastUsableDate:dates.at(-1)||null,usableGames:usable,usableDates:op.unknown?[]:dates,dropResolved:!!best,netGames:best?.netGames??null,lineupUpgrade:best?.netPoints,adjustedWeekProjection:Number.isFinite(p.fppg)&&usable!=null?Number((p.fppg*usable).toFixed(2)):null,suggestedDrop:best?.drop?.name||null,suggestedDropClass:best?.drop?.dropClass||null,acquisitionsActiveFrom:effectiveFrom||null,claimAction:actionable?'review':'pass',requiresReview:true,recommendedBid:null,claimOrderRule:'review_priority',bidOrderLocked:input.waiverMethod==='faab',reasons,notes:p.notes||'',rosterPct:number(p.roster_pct,NaN),tier:lane};
  }).sort((a,b)=>({core_add:4,streamer:3,watch:2,injury_watch:1,excluded:0}[b.lane]-{core_add:4,streamer:3,watch:2,injury_watch:1,excluded:0}[a.lane])||(b.claimAction==='review')-(a.claimAction==='review')||b.streamingScore-a.streamingScore||(b.netGames??-999)-(a.netGames??-999)||(b.lineupUpgrade??0)-(a.lineupUpgrade??0)||(b.usableGames??-1)-(a.usableGames??-1)||a.rosRank-b.rosRank);
  const streamingPaths=[];
  if(profile.lineupPeriod!=='weekly'&&planningBudget!==0){
    for(const drop of droppable){
      const usableDates=base.counts.get(drop),last=usableDates.at(-1);
      if(!last||last>shiftDate(window.start,2))continue;
      for(const p of available){
        const recommendation=recommendations.find(r=>r.name===p.name&&r.pos===p.pos);
        if(!recommendation||!['streamer','watch'].includes(recommendation.lane)||p.unknown||p.unavailable)continue;
        if(drop.dropClass==='conditional'&&!(p.rosRank<drop.rosRank))continue;
        const from=[shiftDate(last,1),p.available_from||input.acquisitionsActiveFrom||window.start].sort().at(-1);
        const incoming={...p,dates:p.dates.filter(d=>d>=from)};
        const outgoing={...drop,dates:drop.dates.filter(d=>d<from)};
        const next=evaluate([...roster.filter(r=>r!==drop),outgoing,incoming],profile,window);
        const netGames=next.total-base.total;
        if(netGames<=0)continue;
        streamingPaths.push({hold:drop.name,useThrough:last,replaceWith:p.name,activeFrom:from,usableDates:next.counts.get(incoming),netGames,addsRequired:1,claimTiming:'Submit before the host cutoff for the effective date, after confirming the outgoing game/lock permits the change.'});
      }
    }
  }
  streamingPaths.sort((a,b)=>b.netGames-a.netGames||a.activeFrom.localeCompare(b.activeFrom));
  return {id:`${Date.now().toString(36)}-${crypto.randomUUID().slice(0,8)}`,createdAt:Date.now(),leagueId:profile.id,leagueName:profile.name,planner:'schedule',plannerVersion:2,sport:profile.sport,window,lineupPeriod:profile.lineupPeriod||'daily',dataSyncedAt:input.dataSyncedAt||null,dataFreshness:input.dataFreshness||null,scheduleSource:schedule.source||'supplied',scheduleFetchedAt:schedule.fetchedAt||null,rosterDays:base.days,rosterOpportunity,streamingPlan,streamingPaths:streamingPaths.slice(0,6),dropCandidates:drops,acquisitionsRemaining:addsRemaining,warnings,recommendations,assumptions:['Protected and unclassified players are never automatic cuts. Conditional cuts need a better supplied ROS rank.','Each add/drop and keep-then-cycle path is an independent alternative, not a combined claim plan. Recalculate after a successful acquisition.','FAAB prices are manual for NHL/NBA; NFL guillotine price calibration is not applied.','Available-from dates refer to the first scoring date after host processing and lineup locks; verify the host’s cutoff.','Backup games have provisional 0.1 option credit, not guaranteed fractional starts. One-slot streamer ties give early usable games a provisional 0.15 preference.']};
}

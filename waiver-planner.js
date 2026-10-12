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
  const mode = input.planningMode || (weekday === 0 ? 'next_week' : 'remaining_week');
  const monday = shiftDate(today, -(weekday + 6) % 7);
  const start = input.planStart || (mode === 'next_week' ? shiftDate(monday, 7) : today);
  const end = input.planEnd || (mode === 'next_week' ? shiftDate(monday, 13) : shiftDate(monday, 6));
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
function normalize(raw, pool, profile) {
  // Identity includes position, so the two Elias Petterssons cannot share inputs.
  const matches=pool.filter(p=>String(p.name).toLowerCase()===String(raw.name||raw.player||'').toLowerCase());
  const base=matches.find(p=>!raw.pos||split(p.pos).some(pos=>split(raw.pos).includes(pos)))||{};
  const row={...base,...Object.fromEntries(Object.entries(raw).filter(([,v])=>v!==''&&v!=null))};
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
  return {...row,name:String(row.name||row.player||''),pos:String(row.pos||row.position||'').toUpperCase(),team:aliases[suppliedTeam]||suppliedTeam,fppg,rosRank:rank,priority,dropClass:String(row.drop_class||'unclassified').toLowerCase(),rosterSlot:String(row.roster_slot||'').toUpperCase()};
}
function opportunities(p,schedule,window,from) {
  const teamDates = schedule.teams[p.team];
  const missingTeam = !p.team;
  const goalie = schedule.sport === 'nhl' && split(p.pos).includes('G');
  const hasStarts = p.start_dates != null && p.start_dates !== '';
  const gameDates = (teamDates||[]).filter(d=>window.days.includes(d));
  const dates=(goalie?(hasStarts?split(p.start_dates):[]):gameDates).filter(d=>window.days.includes(d)&&gameDates.includes(d)&&(!from||d>=from));
  const unavailable=['IR','IR+','IL','IL+','NA'].includes(p.rosterSlot)||['O','OUT','IR','IL','SUSP','NA'].includes(String(p.status||'').toUpperCase());
  const unknown=missingTeam || !p.pos || (goalie&&!hasStarts);
  return {gameDates, dates:unavailable?[]:dates,unknown,goalie};
}
function evaluate(roster,profile,window) {
  const weekly=profile.lineupPeriod==='weekly';
  const weeklyLineup=weekly?fitLineup(roster.filter(p=>p.dates.length),profile,p=>p.priority*p.dates.length):null;
  const days=window.days.map(date=>{
    const active=roster.filter(p=>p.dates.includes(date));
    const fit=weekly?fitLineup(weeklyLineup.players.filter(p=>p.dates.includes(date)),profile):fitLineup(active,profile);
    return {date,scheduled:active.length,started:fit.players.length,benched:active.filter(p=>!fit.players.includes(p)).map(p=>p.name),openSlots:fit.openSlots,starters:fit.players.map(p=>p.name),_players:fit.players};
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
  const roster=rows('roster').map(p=>normalize(p,pool,profile));
  const available=rows('available').map(p=>normalize(p,pool,profile));
  const warnings=[];
  if(input.dataFreshness?.roster?.current===false||input.dataFreshness?.available?.current===false)warnings.push('Saved roster/availability fallback is not current; refresh the host or verify the pasted pool before claiming.');
  if(roster.some(p=>!Number.isFinite(p.fppg)&&p.lineup_priority==null))warnings.push('Lineup order falls back to ROS rank where per-game points/lineup_priority are missing; review that order before submitting.');
  if(roster.some(p=>!p.team||!p.pos)) warnings.push('Roster rows with missing team/position make lineup coverage incomplete; fill them before claiming.');
  const unknownRoster=roster.some(p=>!p.team||!p.pos);
  roster.forEach(p=>Object.assign(p,opportunities(p,schedule,window)));
  if(roster.some(p=>p.goalie&&p.unknown)) warnings.push('Goalie team games are not starts. Supply start_dates (semicolon-separated YYYY-MM-DD) to evaluate goalies; unknown goalies are excluded.');
  const base=evaluate(roster,profile,window);
  const droppable=roster.filter(p=>['dead','replaceable','conditional'].includes(p.dropClass)&&!p.unknown).sort((a,b)=>base.counts.get(a).length-base.counts.get(b).length||b.rosRank-a.rosRank);
  const drops=droppable.map(p=>({name:p.name,pos:p.pos,dropClass:p.dropClass,scheduledGames:p.gameDates.length,usableGames:base.counts.get(p).length,usableDates:base.counts.get(p),benchedGames:p.dates.length-base.counts.get(p).length,rosRank:p.rosRank}));
  const openSpots=Math.max(0,number(input.openRosterSpots));
  const addsRemaining=input.acquisitionsRemaining===''||input.acquisitionsRemaining==null?null:Math.max(0,number(input.acquisitionsRemaining));
  if(addsRemaining===null&&profile.maxAcquisitionsPerWeek)warnings.push('Enter acquisitions remaining to enforce this league’s weekly add limit.');
  if(profile.scoringMode==='categories'||profile.scoringMode==='roto')warnings.push('Usable-game opportunity only; category matchup needs, rate-stat impact and Roto games caps require separate review.');
  if(profile.lineupPeriod==='weekly')warnings.push('Weekly lineups select one lineup for the whole window. Use next week before its lock; current locked lineups cannot be inferred.');
  const mode=input.waiverProcessing&&input.waiverProcessing!=='unknown'?input.waiverProcessing:profile.waiverRules?.mode;
  const continuous=['continuous','continuous_waivers'].includes(mode);
  const recommendations=available.map(p=>{
    const effectiveFrom=p.available_from||input.acquisitionsActiveFrom||(!continuous?window.start:'');
    if(effectiveFrom&&(!/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom)||shiftDate(effectiveFrom,0)!==effectiveFrom))throw new Error('Acquisition effective dates must be valid YYYY-MM-DD dates.');
    const timingUnknown=!effectiveFrom;
    const op=opportunities(p,schedule,window,effectiveFrom);Object.assign(p,op);
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
    const reasons=[`${op.gameDates.length} team games; ${best?.usableDates.length||0} usable games`,best?`${best.netGames>=0?'+':''}${best.netGames} net starting games after roster replacement`:'No permitted drop path or open roster spot'];
    if(best?.drop)reasons.push(`Drop ${best.drop.name}: ${base.counts.get(best.drop).length} usable games (${best.drop.dropClass})`);
    if(timingUnknown)reasons.push('Confirm acquisition effective date under this league’s waiver rules');
    if(op.unknown)reasons.push(op.goalie?'Expected goalie starts required':'Player team/position required');
    const lockedWeek=profile.lineupPeriod==='weekly'&&(window.mode!=='next_week'||effectiveFrom>window.start);
    const actionable=!!best&&!timingUnknown&&!op.unknown&&!unknownRoster&&!lockedWeek&&addsRemaining!==0&&(best.netGames>0||(best.netPoints??0)>0);
    return {name:p.name,pos:p.pos,team:p.team,rosRank:p.rosRank,scheduledGames:op.gameDates.length,usableGames:best?.usableDates.length||0,usableDates:best?.usableDates||[],netGames:best?.netGames??0,lineupUpgrade:best?.netPoints,adjustedWeekProjection:Number.isFinite(p.fppg)?Number((p.fppg*(best?.usableDates.length||0)).toFixed(2)):null,suggestedDrop:best?.drop?.name||null,suggestedDropClass:best?.drop?.dropClass||null,acquisitionsActiveFrom:effectiveFrom||null,claimAction:actionable?'review':'pass',requiresReview:true,recommendedBid:null,claimOrderRule:'review_priority',bidOrderLocked:input.waiverMethod==='faab',reasons,notes:p.notes||'',rosterPct:number(p.roster_pct,NaN),tier:'schedule opportunity'};
  }).sort((a,b)=>(b.claimAction==='review')-(a.claimAction==='review')||b.netGames-a.netGames||(b.lineupUpgrade??0)-(a.lineupUpgrade??0)||b.usableGames-a.usableGames||a.rosRank-b.rosRank);
  return {id:`${Date.now().toString(36)}-${crypto.randomUUID().slice(0,8)}`,createdAt:Date.now(),leagueId:profile.id,leagueName:profile.name,planner:'schedule',sport:profile.sport,window,lineupPeriod:profile.lineupPeriod||'daily',dataSyncedAt:input.dataSyncedAt||null,dataFreshness:input.dataFreshness||null,scheduleSource:schedule.source||'supplied',scheduleFetchedAt:schedule.fetchedAt||null,rosterDays:base.days,dropCandidates:drops,acquisitionsRemaining:addsRemaining,warnings,recommendations,assumptions:['Protected and unclassified players are never automatic cuts. Conditional cuts need a better supplied ROS rank.','Each add/drop is an independent alternative. Recalculate after a successful acquisition; candidates may compete for the same slot.','FAAB prices are manual for NHL/NBA; NFL guillotine price calibration is not applied.','Available-from dates refer to the first scoring date after host processing and lineup locks; verify the host’s cutoff.']};
}

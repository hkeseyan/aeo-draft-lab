import { shiftDate } from './waiver-planner.js';

export function normalizeNbaSchedule(data, window) {
  const blocks=data?.leagueSchedule?.gameDates;
  if(!Array.isArray(blocks)||!blocks.length)throw new Error('NBA schedule feed shape is unavailable. Paste the schedule CSV instead.');
  const teams={},dayCounts=Object.fromEntries(window.days.map(d=>[d,0]));
  let regularDates=[];
  for(const block of blocks)for(const game of block.games||[]){
    // NBA regular-season IDs begin 002; excludes preseason, playoffs and
    // the Cup final, which does not count as a regular-season fantasy game.
    if(!String(game.gameId||'').startsWith('002'))continue;
    const date=String(game.gameCode||'').slice(0,8);
    const iso=/^\d{8}$/.test(date)?`${date.slice(0,4)}-${date.slice(4,6)}-${date.slice(6,8)}`:String(game.gameDateEst||'').slice(0,10);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(iso))throw new Error('NBA game date is missing.');
    regularDates.push(iso);
    if(!window.days.includes(iso))continue;
    const pair=[game.awayTeam?.teamTricode,game.homeTeam?.teamTricode];
    if(pair.some(t=>!t))throw new Error('NBA team abbreviations are missing.');
    dayCounts[iso]++;
    pair.forEach(t=>(teams[t]=teams[t]||[]).push(iso));
  }
  regularDates.sort();
  if(!regularDates.length||window.start>regularDates.at(-1))throw new Error('NBA feed does not cover this season/window; paste a current schedule.');
  return {start:window.start,days:window.days,dayCounts,teams,seasonStart:regularDates[0],source:'NBA CDN regular-season schedule',fetchedAt:Date.now()};
}
export async function fetchGameSchedule(kv,sport,window) {
  if(!['nhl','nba'].includes(sport))throw new Error('Schedule planner supports NHL and NBA.');
  const key=`waiver:schedule:${sport}:${window.start}:${window.end}`;
  const cached=await kv.get(key,{type:'json'});if(cached)return cached;
  let out;
  if(sport==='nba'){
    const r=await fetch('https://cdn.nba.com/static/json/staticData/scheduleLeagueV2_1.json');
    if(!r.ok)throw new Error(`NBA schedule returned ${r.status}; paste schedule CSV as a fallback.`);
    out=normalizeNbaSchedule(await r.json(),window);
  }else{
    const byDate={},teams={},dayCounts={};let cursor=window.start;
    for(let i=0;i<4;i++){
      const r=await fetch(`https://api-web.nhle.com/v1/schedule/${cursor}`);
      if(!r.ok)throw new Error(`NHL schedule returned ${r.status}`);
      const data=await r.json();
      for(const day of data.gameWeek||[])byDate[day.date]=(day.games||[]).filter(g=>g.gameType===2);
      if(window.days.every(d=>Object.hasOwn(byDate,d)))break;
      if(!data.nextStartDate||data.nextStartDate===cursor)break;
      cursor=data.nextStartDate;
    }
    if(window.days.some(d=>!Object.hasOwn(byDate,d)))throw new Error('NHL schedule did not cover every requested date; paste a complete schedule.');
    for(const date of window.days){
      dayCounts[date]=byDate[date].length;
      for(const game of byDate[date])for(const team of [game.awayTeam?.abbrev,game.homeTeam?.abbrev]){
        if(!team)throw new Error('NHL schedule team abbreviation is missing.');
        (teams[team]=teams[team]||[]).push(date);
      }
    }
    out={start:window.start,days:window.days,dayCounts,teams,source:'NHL schedule API (regular season)',fetchedAt:Date.now()};
  }
  await kv.put(key,JSON.stringify(out),{expirationTtl:21600});return out;
}

export function manualGameSchedule(matrix,window) {
  // CSV lists one team per row/date, including name-less schedule rows.
  // Explicit date rows with blank team mark off days. Every date is required.
  const header=matrix[0]||[],di=header.indexOf('date'),ti=header.indexOf('team');
  if(di<0||ti<0)throw new Error('Schedule CSV needs date,team headers. Include every date; leave team blank on off days.');
  const covered=new Set(),teams={},dayCounts={};
  for(const row of matrix.slice(1)){
    const date=row[di],team=String(row[ti]||'').toUpperCase();
    if(!window.days.includes(date))continue;
    covered.add(date);
    if(team){const dates=teams[team]=teams[team]||[];if(!dates.includes(date))dates.push(date);}
  }
  if(window.days.some(d=>!covered.has(d)))throw new Error('Schedule CSV must cover every date, including off days.');
  for(const d of window.days)dayCounts[d]=Object.values(teams).filter(dates=>dates.includes(d)).length/2;
  return {start:window.start,days:window.days,dayCounts,teams,source:'manual CSV',fetchedAt:Date.now()};
}

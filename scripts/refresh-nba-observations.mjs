// Public ESPN season-to-date observations. These are evidence, not projections.
import fs from 'node:fs';
const season=2027,asOf=new Date().toISOString().slice(0,10);
const url=`https://lm-api-reads.fantasy.espn.com/apis/v3/games/fba/seasons/${season}/segments/0/leaguedefaults/1?view=kona_player_info`;
const filter={players:{limit:1000,filterStatsForSourceIds:{value:[0,1]},filterStatsForExternalIds:{value:[season]},sortPercOwned:{sortPriority:1,sortAsc:false}}};
const response=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0',Accept:'application/json','X-Fantasy-Filter':JSON.stringify(filter)},signal:AbortSignal.timeout(30000)});
if(!response.ok)throw Error('ESPN '+response.status);
const raw=await response.json();
const keys=['gp','min','pts','reb','ast','stl','blk','to','tpm','fgm','fga','ftm','fta'];
const statIds=[42,40,0,6,3,2,1,11,17,13,14,15,16];
const rows=(raw.players||[]).map(x=>{
  const p=x.player||{};
  const stat=(p.stats||[]).find(s=>s.seasonId===season&&s.statSourceId===0&&s.statSplitTypeId===0);
  const line=stat?.stats||{};
  return [p.fullName,p.id,p.proTeamId,p.injuryStatus||'',...statIds.map(id=>Math.round((Number(line[id])||0)*1000)/1000)];
}).filter(r=>r[0]&&r[4]>0);
if(rows.length<200)throw Error('Insufficient observed-player coverage: '+rows.length);
const data={asOf,source:url,columns:['name','espnId','teamId','status',...keys],rows};
fs.mkdirSync('data',{recursive:true});
fs.writeFileSync(`data/nba-observations-${asOf}.json`,JSON.stringify(data)+'\n');
console.log(JSON.stringify({asOf,players:rows.length,examples:rows.filter(r=>/Ajay Mitchell|Jared McCain|Ace Bailey|Yaxel Lendeborg|Anthony Black/.test(r[0]))}));
process.exit(0);

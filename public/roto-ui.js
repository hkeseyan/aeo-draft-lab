// Saved with the active league's setup, never with the public player dataset.
let ROTO_YAHOO_LOADING=false;
let ROTO_LAST_MODEL=null;
function rotoForecastEnabled(){return isCategoryLeague()&&LEAGUE.scoringMode==='roto';}
function rotoForecastCategories(){
  const cfg=nhlCategoryConfig();
  return cfg.skater.concat(cfg.goalie).map(key=>{
    const d=catDef(key),c={key,label:d.label,stat:d.key,lowerBetter:!!d.lowerBetter,group:SPORT.id==='nba'?'player':cfg.goalie.includes(key)?'goalie':'skater'};
    if(d.makes)c.ratio={numerator:d.makes,denominator:d.attempts};
    if(key==='SV%')c.ratio={numerator:'sv',denominator:'_shotsAgainst'};
    if(key==='GAA')c.ratio={numerator:'_gaaNumerator',denominator:'_gaaExposure'};
    return c;
  });
}
function rotoForecastInput(){
  const profile=LEAGUES[CURRENT_LEAGUE_ID]||{},horizon=Number(profile.seasonGames)||(SPORT.id==='nhl'?84:82);
  const cap=Number(LEAGUE.maxGamesPlayed)>0?Number(LEAGUE.maxGamesPlayed):horizon;
  const slots=Object.entries(LEAGUE.starters||{}).filter(([key,n])=>n>0&&!/^(BN|IR|IL|NA)/.test(key)).map(([key,count])=>({key,count,capacity:count*cap,gamesPerSlot:cap}));
  const snapshot=ROTO_FORECAST.source==='yahoo'?ROTO_FORECAST.yahoo:null;
  const rawTeams=snapshot?.teams||Array.from({length:LEAGUE.teams},(_,i)=>({id:'draft-'+(i+1),name:teamLabel(SLOT_OWNER[i+1])||'Team '+(i+1),mine:i+1===mySlot,players:rosterOf(i+1).map(p=>({modelPlayer:p}))}));
  const unmatched=[];
  const teams=rawTeams.map(t=>{
    const players=t.players.flatMap(row=>{
      const p=row.modelPlayer||findPlayer(row.name,row.pos);if(!p){unmatched.push(row.name);return [];}
      const gp=statGames(p),id=String(row.player_key||p.id),override=ROTO_FORECAST.games?.[t.id+'|'+id];
      const games=typeof override==='number'&&Number.isFinite(override)?Math.max(0,Math.min(horizon,override)):Math.max(0,Math.min(horizon,gp));
      const st={...(p.st||{})};
      if(SPORT.id==='nhl'&&nhlCatGroup(p)==='goalie'){
        st._shotsAgainst=(+st.sv||0)+(+st.ga||0);
        // The embedded goalie prior lacks minutes; retain its games-weighted
        // GAA rather than averaging individual rates or using shooting volume.
        st._gaaExposure=gp;st._gaaNumerator=nhlGoalieGaa(p)*gp;
      }
      Object.keys(st).forEach(k=>{st[k]=gp>0?Number(st[k])*games/gp:0;});
      const positions=row.pos?row.pos.split(/[\/,]/).map(x=>x.trim().toUpperCase()):null;
      const eligibleSlots=slots.filter(s=>positions?(positions.includes(s.key)||(slotGroup(s.key)||[]).some(pos=>positions.includes(pos))):playerFillsPos(p,s.key)).map(s=>s.key);
      return [{id,name:p.name,games,sourceGames:gp,stats:st,eligibleSlots,group:SPORT.id==='nba'?'player':nhlCatGroup(p),priority:100/Math.sqrt(p.myRank||p.ecr||p.adp||999),status:row.status||p.review?.status||'',rosterSlot:row.roster_slot||''}];
    });
    return {...t,players,partial:t.players.length<(LEAGUE.rosterSize||LEAGUE.rounds),unmatched:t.players.length-players.length};
  });
  return {teams,slots,categories:rotoForecastCategories(),unmatched,snapshot,horizon,cap};
}
function rotoForecastModel(){
  const input=rotoForecastInput(),coverage=ROTO_FORECAST.coverage??(LEAGUE.lineupPeriod==='weekly'?.5:.75);
  const teams=input.teams.map(t=>RotoForecast.projectTeam(t,input.slots,input.categories,coverage));
  return {...input,coverage,teams,standings:RotoForecast.standings(teams,input.categories)};
}
function renderRotoForecast(){
  const card=el('rotoForecastCard');if(!card)return;
  card.style.display=rotoForecastEnabled()?'':'none';if(!rotoForecastEnabled()||typeof RotoForecast==='undefined')return;
  const priorities=el('rotoPuntControls');if(priorities)renderPuntControls(priorities);
  const model=rotoForecastModel();ROTO_LAST_MODEL=model;
  const esc=faabEsc,fmt=v=>Number.isFinite(v)?v.toFixed(1):'—';
  const source=el('rotoRosterSource');source.value=model.snapshot?'yahoo':'draft';
  source.querySelector('option[value="yahoo"]').disabled=!ROTO_FORECAST.yahoo;
  source.onchange=()=>{ROTO_FORECAST.source=source.value;renderRotoForecast();saveSetup();};
  const sync=el('rotoYahooSync'),profile=LEAGUES[CURRENT_LEAGUE_ID]||{};
  sync.style.display=ME.admin&&!GUEST_MODE&&profile.platform==='yahoo'?'':'none';sync.disabled=ROTO_YAHOO_LOADING;sync.onclick=loadRotoYahooRosters;
  const coverage=el('rotoBenchCoverage');coverage.value=String(model.coverage);coverage.onchange=()=>{ROTO_FORECAST.coverage=Number(coverage.value);renderRotoForecast();saveSetup();};
  const warnings=[];
  if(model.teams.some(t=>t.partial))warnings.push('Incomplete rosters: standings are provisional.');
  if(model.unmatched.length)warnings.push(model.unmatched.length+' player(s) have no matching projection: '+model.unmatched.join(', ')+'.');
  if(!model.teams.some(t=>t.players.length))warnings.push('Load connected rosters or draft players to populate the forecast.');
  const projection=SPORT.id==='nba'?('NBA pool '+(profile.poolDataRevision||'embedded prior')+(isNbaRotoAuction()?' · injury/role review '+NBA_ROTO_REVIEW.asOf:'')):'NHL embedded projection prior';
  el('rotoForecastStatus').textContent=(model.snapshot?'Yahoo roster snapshot · '+new Date(model.snapshot.fetchedAt).toLocaleString():'Current draft / mock rosters')+' · '+projection+'. '+warnings.join(' ');
  el('rotoForecastMethod').textContent=`Full-season capacity estimate; ${LEAGUE.lineupPeriod==='weekly'?'weekly':'daily'} lineup assumption. ${model.cap} games per starting spot${LEAGUE.maxGamesPlayed?' (league cap)':' (season opportunity, not a league cap)'}. A legal primary lineup contributes its projected GP; rostered bench players can fill ${Math.round(model.coverage*100)}% of the uncovered capacity. Each player has one GP budget across all eligible positions. Shooting percentages pool attempts; hockey GAA is games-weighted and SV% pools shots. All actual scoring categories count equally, including punted categories and TO. This is not a calendar forecast or banked-actuals-plus-remaining-season forecast; no unrostered replacements are assumed.`;
  const header='<tr><th>Rank</th><th>Team</th><th>Roto points</th><th>Counted GP</th><th>Bench GP</th><th>Unfilled</th>'+model.categories.map(c=>`<th>${esc(c.key)}</th>`).join('')+'</tr>';
  const n=model.teams.length;
  el('rotoStandingsTable').innerHTML='<thead>'+header+'</thead><tbody>'+model.standings.map(t=>`<tr data-roto-team="${esc(t.id)}"><td>${t.rank??'—'}</td><td>${t.mine?'★ ':''}${esc(t.name)}${t.partial?' <span class="muted small">partial</span>':''}</td><td><b>${fmt(t.points)}</b></td><td>${fmt(t.games)}</td><td>${fmt(t.replacementGames)}</td><td>${fmt(t.unfilled)}</td>`+model.categories.map(c=>{
    const pts=t.categoryPoints[c.key],style=Number.isFinite(pts)?nhlCatColor(n>1?(pts-(n+1)/2)/((n-1)/2):0):'';
    return `<td style="${style}" title="${esc(c.label)}: rank ${t.categoryRanks[c.key]??'—'}; ${fmt(pts)} standings points"><b>${Number.isFinite(t.values[c.key])?nhlCatFormat(c.key,t.values[c.key]):'—'}</b><div class="small">${fmt(pts)} pts</div></td>`;
  }).join('')+'</tr>').join('')+'</tbody>';
  const select=el('rotoPlanTeam'),wanted=model.teams.some(t=>t.id===ROTO_FORECAST.team)?ROTO_FORECAST.team:model.teams.find(t=>t.mine)?.id;
  select.innerHTML=model.teams.map(t=>`<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('');
  if(model.teams.some(t=>t.id===wanted))select.value=wanted;
  select.onchange=()=>{ROTO_FORECAST.team=select.value;renderRotoForecast();saveSetup();};
  const team=model.teams.find(t=>t.id===select.value);if(!team)return;
  el('rotoPositionUsage').textContent=team.usage.map(s=>`${s.key}: ${fmt(s.used)} / ${s.capacity} projected games`).join(' · ');
  el('rotoPlayerGames').innerHTML='<thead><tr><th>Player</th><th>Projected GP</th><th>Counted GP</th><th>Bench fill GP</th><th>Position allocation</th></tr></thead><tbody>'+team.players.map(p=>`<tr><td>${esc(p.name)}${p.status?' <span class="small muted">'+esc(p.status)+'</span>':''}</td><td><input type="number" min="0" max="${model.horizon}" step="1" data-roto-gp="${esc(p.id)}" aria-label="${esc(p.name)} projected games" value="${p.games.toFixed(1)}" style="width:70px" title="Source projection ${p.sourceGames.toFixed(1)} GP; edits change availability, not per-game rates"></td><td>${fmt(p.countedGames)}</td><td>${fmt(p.replacementGames)}</td><td class="small">${team.allocations.filter(a=>a.playerId===p.id).map(a=>esc(a.slot)+' '+fmt(a.games)).join(' · ')||'No counted starts'}</td></tr>`).join('')+'</tbody>';
  el('rotoPlayerGames').querySelectorAll('[data-roto-gp]').forEach(input=>input.onchange=()=>{
    if(input.value===''||!Number.isFinite(Number(input.value)))return;
    ROTO_FORECAST.games=ROTO_FORECAST.games||{};ROTO_FORECAST.games[team.id+'|'+input.dataset.rotoGp]=Math.max(0,Math.min(model.horizon,Number(input.value)));renderRotoForecast();saveSetup();
  });
  el('rotoResetGames').onclick=()=>{ROTO_FORECAST.games={};renderRotoForecast();saveSetup();};
  const from=el('rotoSwapFrom'),to=el('rotoSwapTo'),previous=[from.value,to.value];
  const opts=team.players.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');from.innerHTML=opts;to.innerHTML=opts;
  [from,to].forEach((s,i)=>{if(team.players.some(p=>p.id===previous[i]))s.value=previous[i];else if(i&&s.options.length>1)s.selectedIndex=1;});
  [from,to,el('rotoSwapGames')].forEach(control=>control.onchange=renderRotoSwap);
  renderRotoSwap();
}
function renderRotoSwap(){
  const model=ROTO_LAST_MODEL;if(!model)return;
  const team=model.teams.find(t=>t.id===el('rotoPlanTeam').value);if(!team)return;
  const result=RotoForecast.transfer(team,model.slots,model.categories,el('rotoSwapFrom').value,el('rotoSwapTo').value,Number(el('rotoSwapGames').value));
  const before=model.standings.find(t=>t.id===team.id),after=RotoForecast.standings(model.teams.map(t=>t.id===team.id?result.team:t),model.categories).find(t=>t.id===team.id);
  const fmt=v=>Number.isFinite(v)?v.toFixed(1):'—',delta=v=>Number.isFinite(v)?(v>0?'+':'')+v.toFixed(1):'—';
  const pointDelta=Number.isFinite(before.points)&&Number.isFinite(after.points)?after.points-before.points:null;
  el('rotoSwapSummary').textContent=result.moved?`${fmt(result.moved)} counted games shifted within projected availability. Team roto points: ${fmt(before.points)} → ${fmt(after.points)} (${delta(pointDelta)}). This tests a game allocation, not a dated lineup instruction.`:result.reason;
  el('rotoSwapTable').innerHTML=result.moved?'<thead><tr><th>Category</th><th>Before</th><th>After</th><th>Change</th><th>Roto points change</th></tr></thead><tbody>'+model.categories.map(c=>{
    const a=before.values[c.key],b=after.values[c.key],d=Number.isFinite(a)&&Number.isFinite(b)?b-a:null,dp=Number.isFinite(after.categoryPoints[c.key])&&Number.isFinite(before.categoryPoints[c.key])?after.categoryPoints[c.key]-before.categoryPoints[c.key]:null;
    return `<tr><td>${faabEsc(c.key)}</td><td>${nhlCatFormat(c.key,a)}</td><td>${nhlCatFormat(c.key,b)}</td><td style="${Number.isFinite(d)&&d?nhlCatColor((c.lowerBetter?-1:1)*Math.sign(d)) :''}">${d==null?'—':(d>0?'+':'')+(catDef(c.key).rate?d.toFixed(4):d.toFixed(1))}</td><td>${delta(dp)}</td></tr>`;
  }).join('')+'</tbody>':'';
}
async function loadRotoYahooRosters(){
  if(ROTO_YAHOO_LOADING)return;
  const leagueId=CURRENT_LEAGUE_ID;ROTO_YAHOO_LOADING=true;renderRotoForecast();
  el('rotoForecastStatus').textContent='Loading current Yahoo rosters…';
  try{
    const r=await fetch('/api/yahoo/roto-rosters?league='+encodeURIComponent(leagueId),{headers:tokenHdr()}),data=await r.json();
    if(leagueId!==CURRENT_LEAGUE_ID)return;
    if(!r.ok)throw Error(data.error||'Roster sync failed.');
    ROTO_FORECAST.yahoo=data;ROTO_FORECAST.source='yahoo';renderRotoForecast();saveSetup();
  }catch(e){if(leagueId===CURRENT_LEAGUE_ID)el('rotoForecastStatus').textContent=e.message+' The previous forecast is retained.';}
  finally{ROTO_YAHOO_LOADING=false;el('rotoYahooSync').disabled=false;}
}

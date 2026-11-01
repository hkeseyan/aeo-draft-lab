// Category- and sport-independent season game-allocation model.
// No fabricated free agents, banked stats, schedules or additional player games.
(function(root){
  'use strict';
  const EPS=1e-8, num=v=>typeof v==='number'&&Number.isFinite(v)?v:0;
  const sum=a=>a.reduce((s,v)=>s+v,0);

  // Maximum-cost flow with residual edges: flexible players can be moved to
  // another legal position instead of blocking a specialist. Fractional games
  // are expected values, not a claim about a particular calendar date.
  function allocate(players,slots,limits){
    const n=players.length,m=slots.length,s=n+m,t=s+1,g=Array.from({length:t+1},()=>[]),edges=[];
    const add=(u,v,cap,cost)=>{const a={to:v,rev:g[v].length,cap,cost,initial:cap},b={to:u,rev:g[u].length,cap:0,cost:-cost};g[u].push(a);g[v].push(b);return a;};
    players.forEach((p,i)=>{
      add(s,i,Math.max(0,num(limits[p.id])),0);
      slots.forEach((sl,j)=>{if(p.eligibleSlots.includes(sl.key)){const e=add(i,n+j,1e6,1000+Math.max(-100,Math.min(100,num(p.priority))));edges.push({p,sl,e});}});
    });
    slots.forEach((sl,j)=>add(n+j,t,Math.max(0,num(sl.capacity)),0));
    for(let iter=0;iter<(n+m+1)*4;iter++){
      const dist=Array(t+1).fill(-Infinity),prev=Array(t+1);dist[s]=0;
      for(let pass=0;pass<t;pass++){
        let changed=false;
        for(let u=0;u<=t;u++)if(Number.isFinite(dist[u]))g[u].forEach((e,k)=>{
          if(e.cap>EPS&&dist[e.to]<dist[u]+e.cost-EPS){dist[e.to]=dist[u]+e.cost;prev[e.to]=[u,k];changed=true;}
        });
        if(!changed)break;
      }
      if(!prev[t])break;
      let flow=Infinity;
      for(let v=t;v!==s;){const [u,k]=prev[v];flow=Math.min(flow,g[u][k].cap);v=u;}
      if(!(flow>EPS))break;
      for(let v=t;v!==s;){const [u,k]=prev[v],e=g[u][k];e.cap-=flow;g[v][e.rev].cap+=flow;v=u;}
    }
    return edges.map(({p,sl,e})=>({playerId:p.id,slot:sl.key,games:e.initial-e.cap})).filter(x=>x.games>EPS);
  }

  function categoryLine(players,allocations,categories){
    const byId=new Map(players.map(p=>[p.id,p])),raw={},groups={};
    for(const a of allocations){
      const p=byId.get(a.playerId);if(!p||!(p.games>0))continue;
      groups[p.group||'player']=(groups[p.group||'player']||0)+a.games;
      Object.entries(p.stats||{}).forEach(([k,v])=>{if(Number.isFinite(v))raw[k]=(raw[k]||0)+v/p.games*a.games;});
    }
    const values={};
    for(const c of categories){
      if(!(groups[c.group||'player']>0)){values[c.key]=null;continue;}
      if(c.ratio){const d=raw[c.ratio.denominator];values[c.key]=d>0?(raw[c.ratio.numerator]||0)/d*(c.ratio.multiplier||1):null;}
      else values[c.key]=raw[c.stat]??null;
    }
    return {raw,values};
  }

  function projectTeam(team,slots,categories,coverage=1){
    const players=[...new Map((team.players||[]).filter(p=>p&&p.id!=null).map(p=>[p.id,p])).values()];
    const active=players.filter(p=>p.games>0&&p.eligibleSlots?.length);
    const core=allocate(active,slots.map(s=>({...s,capacity:s.count})),Object.fromEntries(active.map(p=>[p.id,1])));
    const primary=core.map(a=>({...a,games:Math.min(active.find(p=>p.id===a.playerId).games,slots.find(s=>s.key===a.slot).gamesPerSlot),kind:'primary'}));
    const primaryById=Object.fromEntries(primary.map(a=>[a.playerId,a.games]));
    const left=slots.map(s=>({...s,capacity:Math.max(0,s.capacity-sum(primary.filter(a=>a.slot===s.key).map(a=>a.games)))*Math.max(0,Math.min(1,coverage))}));
    // A primary player cannot also be his own replacement. The same rostered
    // bench player has one shared GP budget across every eligible position.
    const bench=active.filter(p=>!Object.hasOwn(primaryById,p.id));
    const replacements=allocate(bench,left,Object.fromEntries(bench.map(p=>[p.id,p.games]))).map(a=>({...a,kind:'replacement'}));
    return summarize({...team,players},slots,categories,primary.concat(replacements));
  }

  function summarize(team,slots,categories,allocations){
    const line=categoryLine(team.players,allocations,categories);
    const usage=slots.map(s=>({...s,used:sum(allocations.filter(a=>a.slot===s.key).map(a=>a.games))}));
    const players=team.players.map(p=>({...p,countedGames:sum(allocations.filter(a=>a.playerId===p.id).map(a=>a.games)),replacementGames:sum(allocations.filter(a=>a.playerId===p.id&&a.kind==='replacement').map(a=>a.games))}));
    return {...team,players,allocations,usage,...line,games:sum(allocations.map(a=>a.games)),replacementGames:sum(allocations.filter(a=>a.kind==='replacement').map(a=>a.games)),unfilled:sum(usage.map(s=>Math.max(0,s.capacity-s.used)))};
  }

  function standings(teams,categories){
    const out=teams.map(t=>({...t,categoryPoints:{},categoryRanks:{},points:null}));
    for(const c of categories){
      const valid=out.filter(t=>Number.isFinite(t.values[c.key]));
      for(const t of valid){
        const value=t.values[c.key],better=valid.filter(q=>c.lowerBetter?q.values[c.key]<value-EPS:q.values[c.key]>value+EPS).length;
        const tied=valid.filter(q=>Math.abs(q.values[c.key]-value)<EPS).length;
        t.categoryRanks[c.key]=better+1;
        t.categoryPoints[c.key]=valid.length-better-(tied-1)/2;
      }
    }
    out.forEach(t=>{if(categories.every(c=>Number.isFinite(t.categoryPoints[c.key])))t.points=sum(Object.values(t.categoryPoints));});
    out.sort((a,b)=>(b.points??-Infinity)-(a.points??-Infinity)||String(a.name).localeCompare(String(b.name)));
    out.forEach(t=>{t.rank=t.points==null?null:1+out.filter(q=>q.points!=null&&q.points>t.points+EPS).length;});
    return out;
  }

  function transfer(team,slots,categories,fromId,toId,requested){
    if(fromId===toId)return {team,moved:0,reason:'Choose two different players.'};
    const to=team.players.find(p=>p.id===toId);
    if(!to)return {team,moved:0,reason:'The replacement must be on this roster.'};
    let remaining=Math.max(0,Math.min(num(requested),to.games-to.countedGames));
    const allocations=team.allocations.map(a=>({...a})),extra=[];let moved=0;
    for(const a of allocations){
      if(a.playerId!==fromId||!to.eligibleSlots.includes(a.slot)||remaining<=EPS)continue;
      const take=Math.min(a.games,remaining);a.games-=take;remaining-=take;moved+=take;
      extra.push({playerId:toId,slot:a.slot,games:take,kind:'scenario'});
    }
    return {team:summarize(team,slots,categories,allocations.filter(a=>a.games>EPS).concat(extra)),moved,reason:moved?'':'No additional projected games fit: the favored player may already use all projected GP, or the positions do not match.'};
  }
  root.RotoForecast={allocate,projectTeam,standings,transfer,categoryLine};
})(typeof globalThis==='object'?globalThis:this);

// Reviewed evidence, not a claim that every player's news is monitored live.
// Scope both facts and manager preferences to a season; stale context must not
// become permanent injury status. Per-league playerContext can add newer notes.
export const REVIEWED_PLAYER_CONTEXT = [
  {sport:'nhl',name:'Igor Shesterkin',pos:'G',nhl_id:'8478048',validFrom:'2026-10-10',validThrough:'2027-06-30',injury_outlook:'season_out',injury_confidence:'confirmed',injury_source:'https://www.nhl.com/news/new-york-rangers-goalie-igor-shesterkin-out-for-season',injury_checked_at:'2026-10-12',injury_note:'Season-ending absence announced by the Rangers; exclude from 2026–27 pickups.'},
  {sport:'nhl',name:'Sidney Crosby',pos:'C',nhl_id:'8471675',validFrom:'2026-10-11',validThrough:'2027-06-30',target_class:'core_add',target_notes:'Manager priority: add for long-term value regardless of this week’s schedule. Review recent deployment and slow-start causes; rebound is not assumed.'}
];
export function reviewedContext(player,profile,date,overrides=[]) {
  const match=row=>row.sport===profile.sport&&row.name.toLowerCase()===String(player.name||player.player||'').toLowerCase()&&(!row.pos||row.nhl_id&&String(row.nhl_id)===String(player.nhl_id)||String(player.pos||'').toUpperCase().split(/[\s/,;|]+/).includes(row.pos));
  const eligible=row=>(!row.validFrom||date>=row.validFrom)&&(!row.validThrough||date<=row.validThrough);
  const seed=REVIEWED_PLAYER_CONTEXT.find(row=>match(row)&&eligible(row))||{};
  const newer=(Array.isArray(overrides)?overrides:[]).find(row=>match(row)&&eligible(row))||{};
  return {...seed,...newer};
}

export function leagueRosterPreference(player,profile) {
  if(profile.sport!=='nhl'||!(String(profile.yahooLeagueId)==='135526'||profile.id==='public-points-league-1'))return null;
  const name=String(player.name||'');
  const holds=['Mark Stone','Moritz Seider','Erik Karlsson','Shea Theodore','Filip Forsberg','Auston Matthews','Nikita Kucherov','John Gibson'];
  if(holds.includes(name))return {dropClass:'protected',dropNotes:name==='John Gibson'?'Team-specific hold: thin goalie depth.':'Manager confirmed hold for this team.'};
  if(['Thomas Novak','Tommy Novak','Egor Chinakhov','Josh Doan'].includes(name))return {dropClass:'replaceable',dropNotes:'Manager: possible schedule-dependent drop, not an automatic cut.'};
  return null;
}

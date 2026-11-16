// An owner-only, read-only export of the connected Yahoo NHL league's live data.
// The Worker authenticates and refreshes; this pure helper never sees OAuth tokens.
const statItems = (section) => {
  const items = section?.stats || section?.stat || [];
  const values = Array.isArray(items) ? items : Object.values(items).filter(x => typeof x === 'object');
  return values.map(row => row?.stat || row).filter(Boolean);
};
const numericOrNull = (value) => value == null || value === '' || !Number.isFinite(Number(value)) ? null : Number(value);

export function yahooHockeySettings(raw) {
  const league = raw?.fantasy_content?.league || [];
  const meta = Array.isArray(league) ? (league[0] || {}) : league;
  const section = Array.isArray(league) ? league.find(part => part && part.settings)?.settings : league?.settings;
  const settings = Array.isArray(section) ? (section[0] || {}) : (section || {});
  const categoryById = new Map(statItems(settings.stat_categories).map(s => [String(s.stat_id), s]));
  const modifiers = statItems(settings.stat_modifiers).map(s => ({
    statId: String(s.stat_id ?? ''),
    name: categoryById.get(String(s.stat_id))?.name || s.name || '',
    displayName: categoryById.get(String(s.stat_id))?.display_name || '',
    points: numericOrNull(s.value)
  }));
  const categories = statItems(settings.stat_categories).map(s => ({
    statId: String(s.stat_id ?? ''),
    name: s.name || '',
    displayName: s.display_name || '',
    isOnlyDisplayStat: String(s.is_only_display_stat || '0') === '1'
  }));
  const slots = (Array.isArray(settings.roster_positions) ? settings.roster_positions : Object.values(settings.roster_positions || {}))
    .map(row => row?.roster_position || row).filter(row => row && row.position)
    .map(row => ({ position: String(row.position), count: numericOrNull(row.count) }));
  return {
    name: meta.name || '',
    season: meta.season || '',
    yahooScoringType: settings.scoring_type || '',
    yahooScoringFormat: settings.scoring_format || '',
    numTeams: numericOrNull(meta.num_teams),
    rosterPositions: slots,
    statCategories: categories,
    statModifiers: modifiers,
    waiverRules: {
      waiverType: settings.waiver_type ?? null,
      waiverRule: settings.waiver_rule ?? null,
      usesFaab: settings.use_faab ?? null,
      maxWeeklyAdds: numericOrNull(settings.max_weekly_adds),
      maxAdds: numericOrNull(settings.max_adds),
      minGoalieAppearances: numericOrNull(settings.min_goalie_appearances),
      waiverTime: numericOrNull(settings.waiver_time),
      tradeEndDate: settings.trade_end_date || null
    },
    providerSettings: settings
  };
}

export function buildYahooHockeyWaiverExport(profile, snapshot, rawSettings) {
  const yahoo = snapshot.sourceStatus?.yahoo;
  if (!yahoo?.ok || !snapshot.freshness?.roster?.current || !snapshot.freshness?.available?.current ||
      snapshot.coverage?.roster !== 'yahoo' || snapshot.coverage?.available !== 'yahoo') {
    throw new Error('Yahoo did not return both a fresh roster and fresh available-player pool. The saved fallback is not verified live data.');
  }
  const settings = yahooHockeySettings(rawSettings);
  const syncedAt = new Date(yahoo.syncedAt || snapshot.syncedAt).toISOString();
  return {
    schemaVersion: 1,
    purpose: 'Yahoo NHL H2H waiver review; read-only, no claims submitted',
    source: 'AEO Draft Lab / connected Yahoo Fantasy Sports API',
    verifiedLiveYahoo: true,
    syncedAt,
    league: {
      draftLabId: profile.id,
      yahooLeagueKey: yahoo.yahooLeagueKey,
      name: settings.name || profile.name || snapshot.leagueName,
      sport: 'nhl',
      scoringMode: profile.scoringMode || null,
      season: settings.season,
      yahooScoringType: settings.yahooScoringType,
      yahooScoringFormat: settings.yahooScoringFormat,
      numTeams: settings.numTeams
    },
    settings: {
      rosterPositions: settings.rosterPositions,
      statCategories: settings.statCategories,
      statModifiers: settings.statModifiers,
      waiverRules: settings.waiverRules
    },
    myTeam: snapshot.myTeam || null,
    roster: snapshot.roster,
    availablePlayers: snapshot.available,
    availablePool: {
      waiverCount: yahoo.waiverCount || 0,
      freeAgentCount: yahoo.freeAgentCount || 0,
      newlyDroppedCount: yahoo.newlyDroppedCount || 0,
      returnedCount: snapshot.available.length,
      poolLimitPerStatus: yahoo.poolLimitPerStatus || 100,
      potentiallyTruncated: !!yahoo.poolPotentiallyTruncated,
      scope: 'Yahoo available/waiver pool ordered by ownership; not necessarily exhaustive',
      // Explicit availability status is separate from an injury status.
      availabilityField: 'availability_status'
    },
    budgets: snapshot.budgets || null,
    freshness: snapshot.freshness,
    warnings: [
      ...(yahoo.poolPotentiallyTruncated ? ['Yahoo returned the maximum requested available-player page count; lower-owned players may be missing.'] : []),
      ...(yahoo.warning ? [yahoo.warning] : []),
      'Waiver claims are NOT submitted by Draft Lab.',
      'Actual remaining acquisitions, queued claims and future-day lineups are not verified by this export.'
    ]
  };
}

// Read-only Yahoo pending-trade normalization. No transaction mutation methods.
function nodesNamed(value, name, found = []) {
  if (Array.isArray(value)) {
    for (const part of value) nodesNamed(part, name, found);
  } else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (key === name) found.push(child);
      nodesNamed(child, name, found);
    }
  }
  return found;
}

function fields(value, omit = new Set()) {
  const out = {};
  const visit = (part) => {
    if (Array.isArray(part)) return part.forEach(visit);
    if (!part || typeof part !== 'object') return;
    for (const [key, child] of Object.entries(part)) {
      if (omit.has(key)) continue;
      if (key === 'name' && child && typeof child === 'object' && child.full) {
        out.name = child.full;
      } else if (child && typeof child === 'object') {
        visit(child);
      } else if (child != null) {
        out[key] = child;
      }
    }
  };
  visit(value);
  return out;
}

export function normalizeYahooPendingTrades(raw, myTeamKey, teams = []) {
  if (!myTeamKey) throw new Error('A verified Yahoo team key is required.');
  const collections = nodesNamed(raw?.fantasy_content?.league, 'transactions');
  if (collections.length !== 1 || !collections[0] || typeof collections[0] !== 'object') {
    throw new Error('Yahoo did not return a pending-trades collection.');
  }
  const transactions = nodesNamed(collections[0], 'transaction');
  const expectedCount = collections[0].count;
  if (expectedCount != null && (!/^\d+$/.test(String(expectedCount)) || Number(expectedCount) !== transactions.length)) {
    throw new Error('Yahoo returned incomplete pending-trade data.');
  }
  const teamNames = new Map(teams.map(t => [String(t.team_key), String(t.name || t.team_key)]));
  const offers = [];
  for (const transactionNode of transactions) {
    const meta = fields(transactionNode, new Set(['players', 'player', 'transaction_data', 'draft_picks']));
    if (meta.type !== 'pending_trade' || !meta.transaction_key) continue;
    const trader = String(meta.trader_team_key || '');
    const tradee = String(meta.tradee_team_key || '');
    if (trader !== myTeamKey && tradee !== myTeamKey) continue;
    const giving = [], receiving = [], unassigned = [];
    for (const playerNode of nodesNamed(transactionNode, 'player')) {
      const p = fields(playerNode, new Set(['transaction_data', 'player_stats', 'player_points']));
      const tdNode = nodesNamed(playerNode, 'transaction_data')[0];
      const movement = tdNode ? fields(tdNode) : {};
      const player = {
        key: String(p.player_key || ''),
        name: String(p.name || p.full || p.player_key || 'Unknown player'),
        position: String(p.display_position || p.primary_position || ''),
        sourceTeamKey: String(movement.source_team_key || ''),
        destinationTeamKey: String(movement.destination_team_key || '')
      };
      if (player.sourceTeamKey === myTeamKey && player.destinationTeamKey !== myTeamKey) giving.push(player);
      else if (player.destinationTeamKey === myTeamKey && player.sourceTeamKey !== myTeamKey) receiving.push(player);
      else unassigned.push(player);
    }
    const partnerKey = trader === myTeamKey ? tradee : trader;
    const draftPickNodes = nodesNamed(transactionNode, 'draft_pick');
    const rawTime = Number(meta.trade_proposed_time || meta.timestamp || 0);
    offers.push({
      transactionKey: String(meta.transaction_key),
      status: String(meta.status || 'unknown'),
      direction: trader === myTeamKey ? 'outgoing' : 'incoming',
      partnerTeamKey: partnerKey,
      partnerTeamName: teamNames.get(partnerKey) || partnerKey || 'Unknown team',
      traderTeamKey: trader,
      tradeeTeamKey: tradee,
      proposedAt: Number.isFinite(rawTime) && rawTime > 0 ? new Date(rawTime * 1000).toISOString() : null,
      note: String(meta.trade_note || ''),
      giving,
      receiving,
      unassigned,
      containsDraftPicks: draftPickNodes.length > 0,
      complete: unassigned.length === 0 && draftPickNodes.length === 0
    });
  }
  return offers.sort((a, b) => (b.proposedAt || '').localeCompare(a.proposedAt || ''));
}

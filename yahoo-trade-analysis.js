import { keeperCost } from "./yahoo-auction-draft.js";

// League rules are commissioner policy. Yahoo supplies the actual draft prices,
// settings, teams and rosters independently of this register.
const AUCTION_RULES = {
  "aeok-auction": { leagueId: "868349", teamCount: 12, budget: 200, draftableSlots: 18, minOpenSlotBid: 1,
    scoring: { ppr: 1, superflex: true },
    annualIncrease: 1, undraftedQb: 6, undraftedOther: 2, maxKeepers: null },
  "fantastic-auction": { leagueId: "835427", teamCount: 14, budget: 200, draftableSlots: 16, minOpenSlotBid: 1,
    scoring: { ppr: 1, superflex: false, passTouchdownPoints: 6 },
    annualIncrease: 1, undraftedQb: 2, undraftedOther: 2, maxKeepers: null }
};
const HORIZONS = {
  redraft: ["rest-of-season", "playoffs"],
  "auction-keeper": ["rest-of-season", "playoffs", "next-season-keeper-surplus"],
  keeper: ["rest-of-season", "playoffs", "keeper-cost"],
  dynasty: ["rest-of-season", "multi-year"]
};
const INTENTS = ["contending", "rebuilding", "eliminated", "undecided"];

export function tradeLeagueRules(profile, key) {
  const rules = AUCTION_RULES[profile.id];
  if (rules && key.endsWith(".l." + rules.leagueId)) {
    return { ...rules, source: "Draft Lab commissioner league rules" };
  }
  return null;
}

function teamIntent(profile, teamKey, season) {
  const entry = profile.tradeAnalysis?.teamStrategies?.[teamKey];
  if (entry?.season !== season || !INTENTS.includes(entry.intent) || !Number.isFinite(Date.parse(entry.asOf))) return null;
  const playoffOdds = Number.isFinite(entry.playoffOdds) && entry.playoffOdds >= 0 && entry.playoffOdds <= 1
    ? entry.playoffOdds : null;
  return { intent: entry.intent, playoffOdds, asOf: entry.asOf, source: entry.source || "Draft Lab team strategy" };
}

function rosterContext(roster, outgoing, incoming, rules) {
  if (!roster) return null;
  const players = roster.players || [];
  const eligible = players.filter(player => !["IR", "IR+", "IL", "IL+", "NA"].includes(player.roster_slot));
  const ownedKeys = new Set(players.map(player => player.player_key));
  const rosterMatchesOffer = outgoing.every(player => ownedKeys.has(player.key));
  const outgoingKeys = new Set(outgoing.map(player => player.key));
  const rosterSlotsAdded = incoming.length - eligible.filter(player => outgoingKeys.has(player.player_key)).length;
  const activeAfter = eligible.length + rosterSlotsAdded;
  const positions = {};
  for (const player of eligible) {
    for (const position of new Set(String(player.pos || "").split(/[ ,/]+/).filter(Boolean))) {
      positions[position] = (positions[position] || 0) + 1;
    }
  }
  return { activeBefore: eligible.length, activeAfter, rosterSlotsAdded, rosterMatchesOffer,
    requiredRosterCuts: rules && rosterMatchesOffer ? Math.max(0, activeAfter - rules.draftableSlots) : null,
    openRosterSpots: rules && rosterMatchesOffer ? Math.max(0, rules.draftableSlots - activeAfter) : null,
    positions, record: roster.record ?? null, rosterFetchedAt: roster.fetchedAt ?? null };
}

function validNumber(value) {
  return Number.isFinite(value) && value >= 0;
}

function suppliedValues(input) {
  return input && typeof input.source === "string" && input.source.trim() &&
    Number.isFinite(Date.parse(input.asOf)) && input.values && typeof input.values === "object";
}

function projectionComparison(input, giving, receiving) {
  if (!suppliedValues(input) || ![...giving, ...receiving].every(player => validNumber(input.values[player.key]))) return null;
  const sum = players => players.reduce((total, player) => total + input.values[player.key], 0);
  return { source: input.source, asOf: input.asOf, giving: sum(giving), receiving: sum(receiving),
    acquiredPlayerPointsDelta: sum(receiving) - sum(giving) };
}

// Rank-weight incremental assets above the replacement floor. The first
// asset carries its full marginal value; each additional asset has less impact.
// This is a Draft Lab heuristic, using comparable values from one source.
function packageValue(players, values, floor, replacementFloor) {
  const sorted = players.map(player => values[player.key]).sort((a, b) => b - a);
  return sorted.reduce((sum, value, index) => {
    const baseline = index < floor ? 0 : replacementFloor;
    return sum + Math.max(0, value - baseline) / (index + 1);
  }, 0);
}

function marketComparison(input, format, giving, receiving, context) {
  if (!suppliedValues(input) || !validNumber(input.replacementValue) ||
      typeof input.format !== "string" || !input.format.trim()) return null;
  const players = [...giving, ...receiving];
  if (!players.every(player => validNumber(input.values?.[player.key]))) return null;
  const theirSpots = context.partner?.openBefore;
  const mySpots = context.mine?.openBefore;
  const calculate = (players, spots) => packageValue(players, input.values, spots ?? 0, input.replacementValue);
  const mine = calculate(receiving, mySpots) - calculate(giving, mySpots);
  const partner = calculate(giving, theirSpots) - calculate(receiving, theirSpots);
  const dynastyProxy = input.format.toLowerCase().includes("dynasty") && format !== "dynasty";
  return { source: input.source, asOf: input.asOf, sourceFormat: input.format, dynastyProxy,
    replacementValue: input.replacementValue, myMarketDelta: mine, partnerMarketDelta: partner,
    partnerMarketPosition: dynastyProxy ? null : partner > 0 ? "above-estimated-market" : partner < 0
      ? "below-estimated-market" : "at-estimated-market" };
}

function keeperScenario(players, rules, projectedAuction) {
  const costs = players.map(player => player.keeperCost?.nextCost);
  if (!costs.length || !costs.every(validNumber)) return null;
  const totalCost = costs.reduce((total, cost) => total + cost, 0);
  const reserve = Math.max(0, rules.draftableSlots - players.length) * rules.minOpenSlotBid;
  const suitableProjections = suppliedValues(projectedAuction) &&
    players.every(player => validNumber(projectedAuction.values[player.key]));
  const projectedSurplus = suitableProjections
    ? players.reduce((sum, player, i) => sum + projectedAuction.values[player.key] - costs[i], 0) : null;
  return { totalCost, minimumOpenSlotReserve: reserve, remainingAfterReserve: rules.budget - totalCost - reserve,
    projectedSurplus };
}

export function analyzeYahooOffers({ profile, live, draft, settings, rosters, valuations, counters = [] }) {
  const values = valuations ?? profile.tradeAnalysis?.valuations ?? {};
  const rules = tradeLeagueRules(profile, live.leagueKey);
  const configuredFormat = profile.tradeAnalysis?.format || profile.leagueType;
  const format = rules ? "auction-keeper" : Object.hasOwn(HORIZONS, configuredFormat) ? configuredFormat :
    profile.id === "aeo-keepers" ? "keeper" : "unclassified";
  const season = settings?.season ?? draft?.season ?? null;
  const strategy = {
    mine: teamIntent(profile, live.team.key, season),
    partners: Object.fromEntries([...new Set([...live.offers, ...counters].map(offer => offer.partnerTeamKey))].map(key =>
      [key, teamIntent(profile, key, season)]))
  };
  const horizons = HORIZONS[format] || [];
  const prioritizedHorizon = ["eliminated", "rebuilding"].includes(strategy.mine?.intent)
    ? horizons.at(-1) ?? null : horizons[0] ?? null;
  const analyze = offer => {
    if (offer.error) return offer;
    const withContext = (player, teamKey) => {
      const onRoster = rosters[teamKey]?.players.find(row => row.player_key === player.key);
      return { ...player, yahooStatus: onRoster?.status || null,
        ...(rules ? { keeperCost: keeperCost(player, draft, rules) } : {}) };
    };
    const giving = offer.giving.map(player => withContext(player, live.team.key));
    const receiving = offer.receiving.map(player => withContext(player, offer.partnerTeamKey));
    const mine = rosterContext(rosters[live.team.key], giving, receiving, rules);
    const partner = rosterContext(rosters[offer.partnerTeamKey], receiving, giving, rules);
    const validOffer = offer.complete && giving.length > 0 && receiving.length > 0 &&
      [mine, partner].every(context => context?.rosterMatchesOffer !== false);
    const context = {
      mine: { ...mine, openBefore: rules && mine ? Math.max(0, rules.draftableSlots - mine.activeBefore) : null },
      partner: { ...partner, openBefore: rules && partner ? Math.max(0, rules.draftableSlots - partner.activeBefore) : null }
    };
    const market = validOffer ? marketComparison(values.market, format, giving, receiving, context) : null;
    const production = validOffer ? {
      restOfSeason: projectionComparison(values.projectedRestOfSeason, giving, receiving),
      playoffs: projectionComparison(values.projectedPlayoffs, giving, receiving),
      multiYear: format === "dynasty" ? projectionComparison(values.projectedMultiYear, giving, receiving) : null
    } : null;
    const before = validOffer && rules ? keeperScenario(giving, rules, values.projectedAuction) : null;
    const after = validOffer && rules ? keeperScenario(receiving, rules, values.projectedAuction) : null;
    const keeper = before && after ? { outgoing: before, incoming: after,
      salaryFreedIfAllKept: before.totalCost - after.totalCost,
      budgetFreedAfterOpenSlotReserve: after.remainingAfterReserve - before.remainingAfterReserve,
      projectedSurplusDelta: before.projectedSurplus !== null && after.projectedSurplus !== null
        ? after.projectedSurplus - before.projectedSurplus : null,
      projectionSource: before.projectedSurplus !== null && after.projectedSurplus !== null
        ? { source: values.projectedAuction.source, asOf: values.projectedAuction.asOf } : null } : null;
    return { ...offer, giving, receiving, rosterImpact: { mine, partner }, keeper, market, production,
      missing: [
        ...(!validOffer ? ["complete current offer"] : []),
        ...(!mine || !partner ? ["current rosters"] : []),
        ...(rules && !keeper ? ["verified keeper costs"] : []),
        ...(rules && keeper?.projectedSurplusDelta == null ? ["league-matched projected auction values"] : []),
        ...(!market ? ["comparable market values and replacement value"] : []),
        ...(!production?.restOfSeason ? ["league-scored rest-of-season projections"] : []),
        ...(!strategy.mine || !strategy.partners[offer.partnerTeamKey] ? ["dated team strategy"] : [])
      ] };
  };
  return { ...live, offers: live.offers.map(analyze), counteroffers: counters.map(analyze), leagueContext: { format, season, settings, keeperRules: rules,
    horizons, prioritizedHorizon, strategy } };
}
